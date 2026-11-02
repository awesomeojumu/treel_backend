import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import argon2 from 'argon2';
import {
  OrganizationModel,
  UserModel,
  ClientModel,
  LeadModel,
  BookingModel,
  PaymentModel,
} from '@/models';
import { seedLiveDatabase } from '@/core/database/seedDatabase';

/**
 * Dynamically resolves the active tenant (organizationId, user, org) based on:
 * 1. x-organization-id header or query param ?orgId=
 * 2. x-user-email header or query param ?email=
 * 3. Latest registered user in MongoDB Atlas
 * 4. Fallback baseline 'org_skyline_lagos'
 */
async function resolveOrganization(req: FastifyRequest): Promise<{
  organizationId: string;
  user?: any;
  org?: any;
}> {
  const query = (req.query || {}) as { orgId?: string; email?: string };
  const headers = req.headers;
  const orgHeader = (headers['x-organization-id'] || query.orgId) as string | undefined;
  const emailHeader = (headers['x-user-email'] || query.email) as string | undefined;

  // 1. By Email
  if (emailHeader) {
    const user = await UserModel.findOne({ email: emailHeader.trim().toLowerCase() }).lean();
    if (user && user.organizationId) {
      const org = await OrganizationModel.findOne({ organizationId: user.organizationId }).lean();
      return { organizationId: user.organizationId, user, org };
    }
  }

  // 2. By Organization ID
  if (orgHeader && orgHeader !== 'undefined' && orgHeader !== 'null') {
    const org = await OrganizationModel.findOne({ organizationId: orgHeader }).lean();
    const user = await UserModel.findOne({ organizationId: orgHeader, roleKey: 'OWNER' }).lean();
    return { organizationId: orgHeader, user, org };
  }

  // 3. By latest active user in MongoDB Atlas
  const latestUser = await UserModel.findOne({}).sort({ _id: -1 }).lean();
  if (latestUser && latestUser.organizationId) {
    const org = await OrganizationModel.findOne({ organizationId: latestUser.organizationId }).lean();
    return { organizationId: latestUser.organizationId, user: latestUser, org };
  }

  // 4. Default fallback
  const fallbackOrg = await OrganizationModel.findOne({ organizationId: 'org_skyline_lagos' }).lean();
  return { organizationId: 'org_skyline_lagos', org: fallbackOrg };
}

export async function registerLiveDatabaseRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get Workspace Full Live Snapshot from MongoDB Atlas
  app.get('/api/v1/live/workspace', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { organizationId, user, org } = await resolveOrganization(req);
      const staffMembers = await UserModel.find({ organizationId }).select('-passwordHash').lean();
      const clients = await ClientModel.find({ organizationId }).lean();
      const leads = await LeadModel.find({ organizationId }).lean();
      const bookings = await BookingModel.find({ organizationId }).lean();
      const payments = await PaymentModel.find({ organizationId }).lean();

      return reply.send({
        connected: true,
        database: 'Treel',
        agency: org || {
          organizationId,
          name: user?.name ? `${user.name}'s Agency` : 'Agency Workspace',
          rcNumber: 'RC-PENDING',
          branch: 'Headquarters, Nigeria',
        },
        staffCount: staffMembers.length,
        owner: staffMembers.find((s) => s.roleKey === 'OWNER') || user,
        staffMembers,
        clients,
        leads,
        bookings,
        payments,
      });
    } catch (err: any) {
      return reply.status(500).send({
        connected: false,
        error: err.message,
      });
    }
  });

  // 2. Get Staff Members for Active Tenant
  app.get('/api/v1/live/staff', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { organizationId } = await resolveOrganization(req);
      const users = await UserModel.find({ organizationId }).select('-passwordHash').lean();
      return reply.send({
        total: users.length,
        users,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 3. Authenticate User against MongoDB Atlas
  app.post('/api/v1/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required.' });
    }

    try {
      const user = await UserModel.findOne({ email: email.toLowerCase() });
      if (!user) {
        return reply.status(401).send({ error: 'Invalid email or password.' });
      }

      const isValid = await argon2.verify(user.passwordHash, password);
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid email or password.' });
      }

      const org = await OrganizationModel.findOne({ organizationId: user.organizationId }).lean();

      const userSafe = {
        userId: user.userId,
        organizationId: user.organizationId,
        agencyName: org?.name || 'My Agency',
        name: user.name,
        email: user.email,
        initials: user.initials,
        roleKey: user.roleKey,
        roleLabel: user.roleLabel,
        branch: user.branch,
        phone: user.phone,
        statusText: user.statusText,
        isLive: user.isLive,
      };

      return reply.send({
        success: true,
        user: userSafe,
        token: `jwt_treel_${user.userId}_${Date.now()}`,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 4. Trigger Seeding via API
  app.post('/api/v1/live/seed', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const summary = await seedLiveDatabase();
      return reply.send(summary);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 5. Live Clients CRUD
  app.get('/api/v1/live/clients', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { organizationId } = await resolveOrganization(req);
      const clients = await ClientModel.find({ organizationId }).lean();
      return reply.send({ total: clients.length, clients });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post('/api/v1/live/clients', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    try {
      const { organizationId, user } = await resolveOrganization(req);
      const clientId = `CL-${Date.now().toString().slice(-4)}`;
      const client = await ClientModel.create({
        clientId,
        organizationId,
        name: body.name,
        phone: body.phone,
        email: body.email || '',
        tag: body.tag || 'Individual',
        ownerName: body.ownerName || user?.name || 'Owner',
        ownerUserId: body.ownerUserId || user?.userId || 'usr_owner',
        passportMasked: body.passportMasked || 'A00••••••',
        passportExpiry: body.passportExpiry || '2030-01-01',
      });
      return reply.status(201).send(client);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 6. Live Bookings CRUD
  app.get('/api/v1/live/bookings', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { organizationId } = await resolveOrganization(req);
      const bookings = await BookingModel.find({ organizationId }).lean();
      return reply.send({ total: bookings.length, bookings });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post('/api/v1/live/bookings', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    try {
      const { organizationId, user } = await resolveOrganization(req);
      const bookingId = `BK-2026-${Math.floor(100 + Math.random() * 900)}`;
      const booking = await BookingModel.create({
        bookingId,
        organizationId,
        title: body.title,
        clientId: body.clientId,
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        type: body.type || 'Flight',
        soldBy: body.soldBy || user?.name || 'Owner',
        soldByUserId: body.soldByUserId || user?.userId || 'usr_owner',
        status: body.status || 'Part-paid',
        items: body.items || [],
        totalKobo: body.totalKobo || 0,
        paidKobo: body.paidKobo || 0,
        owedKobo: (body.totalKobo || 0) - (body.paidKobo || 0),
        dateLabel: body.dateLabel || 'Travels soon',
        entryOrigin: body.entryOrigin || 'QUICK_ADD_SALE',
      });
      return reply.status(201).send(booking);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 7. Live Leads CRUD
  app.get('/api/v1/live/leads', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { organizationId } = await resolveOrganization(req);
      const leads = await LeadModel.find({ organizationId }).lean();
      return reply.send({ total: leads.length, leads });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post('/api/v1/live/leads', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    try {
      const { organizationId, user } = await resolveOrganization(req);
      const leadId = `LD-2026-${Math.floor(100 + Math.random() * 900)}`;
      const lead = await LeadModel.create({
        leadId,
        organizationId,
        clientId: body.clientId || 'CL-001',
        clientName: body.clientName,
        phone: body.phone,
        requestSummary: body.requestSummary,
        source: body.source || 'WhatsApp',
        stage: body.stage || 'New',
        ownerUserId: body.ownerUserId || user?.userId || 'usr_owner',
        ownerName: body.ownerName || user?.name || 'Owner',
        valueKobo: body.valueKobo || 0,
        followUpLabel: body.followUpLabel || 'Follow up tomorrow',
        isOverdue: false,
        isReadOnly: false,
      });
      return reply.status(201).send(lead);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 8. Live Payments CRUD
  app.get('/api/v1/live/payments', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { organizationId } = await resolveOrganization(req);
      const payments = await PaymentModel.find({ organizationId }).lean();
      return reply.send({ total: payments.length, payments });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post('/api/v1/live/payments', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    try {
      const { organizationId, user } = await resolveOrganization(req);
      const paymentId = `PAY-2026-${Math.floor(100 + Math.random() * 900)}`;
      const payment = await PaymentModel.create({
        paymentId,
        organizationId,
        bookingId: body.bookingId,
        clientName: body.clientName,
        amountKobo: body.amountKobo,
        channel: body.channel || 'Direct Bank Transfer',
        reference: body.reference,
        receivedAt: new Date().toISOString(),
        recordedBy: body.recordedBy || user?.name || 'Owner',
        recordedByUserId: body.recordedByUserId || user?.userId || 'usr_owner',
        proofFileName: body.proofFileName,
        status: 'Confirmed',
      });

      // Update booking paid & owed in MongoDB
      if (body.bookingId) {
        const booking = await BookingModel.findOne({ organizationId, bookingId: body.bookingId });
        if (booking) {
          booking.paidKobo += body.amountKobo;
          booking.owedKobo = Math.max(0, booking.totalKobo - booking.paidKobo);
          booking.status = booking.owedKobo === 0 ? 'Paid' : 'Part-paid';
          await booking.save();
        }
      }

      return reply.status(201).send(payment);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}

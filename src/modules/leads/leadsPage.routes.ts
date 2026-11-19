import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  listLeadsPageRules,
  validateLeadInput,
  checkExistingClientOrLead,
  validateStageTransition,
  calculatePipelineColumnTotals,
  filterLeads,
  logCommunicationAttempt,
  reassignLead,
  aggregateSourcesPerformance,
  convertLeadToQuote,
  reopenLostLead,
  DEFAULT_PIPELINE_STAGES,
  LeadRecord,
  PipelineStageConfig,
  ServiceType,
} from '@/core/leads/leadsPageRules';
import { LeadModel, ClientModel } from '@/models';

const DEFAULT_SOURCES: string[] = [
  'WhatsApp Inbound',
  'Referral',
  'Corporate Contract',
  'Website Lead',
  'Instagram',
  'Other',
];

const PIPELINE_STAGES: PipelineStageConfig[] = [...DEFAULT_PIPELINE_STAGES];

function getOrgId(req: FastifyRequest): string {
  const fromHeader = (req.headers['x-organization-id'] as string | undefined)?.trim();
  const fromQuery = ((req.query as any)?.organizationId as string | undefined)?.trim();
  const fromBody = ((req.body as any)?.organizationId as string | undefined)?.trim();
  return fromHeader || fromQuery || fromBody || 'org_default';
}

function normalizeStageKey(stage: string | undefined): string {
  const s = (stage || 'new').trim().toLowerCase();
  if (s === 'new') return 'new';
  if (s === 'contacted') return 'contacted';
  if (s === 'quoted') return 'quoted';
  if (s === 'negotiating') return 'negotiating';
  if (s === 'won') return 'won';
  if (s === 'lost') return 'lost';
  return 'new';
}

function docToLeadRecord(doc: any): LeadRecord & { reopenReason?: string } {
  const createdIso = doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString();
  const updatedIso = doc.updatedAt ? new Date(doc.updatedAt).toISOString() : createdIso;
  return {
    id: doc.leadId || String(doc._id),
    organizationId: doc.organizationId || 'org_default',
    clientName: doc.clientName || 'Unnamed Lead',
    phone: doc.phone || '',
    email: doc.email || undefined,
    serviceType: (doc.serviceType || 'flight') as ServiceType,
    destination: doc.destination || doc.requestSummary || 'Unspecified destination',
    travelDates: doc.travelDates?.dateSummary
      ? doc.travelDates
      : {
          type: 'rough',
          dateSummary: 'Dates TBD',
        },
    travellersCount: doc.travellersCount || 1,
    budgetKobo: typeof doc.valueKobo === 'number' ? doc.valueKobo : 0,
    source: doc.source || 'WhatsApp Inbound',
    sourceNote: doc.sourceNote || undefined,
    ownerStaffId: doc.ownerUserId || 'usr_owner',
    ownerStaffName: doc.ownerName || 'Workspace Owner',
    branchId: doc.branchId || 'br-hq',
    branchName: doc.branchName || 'Head Office',
    stage: normalizeStageKey(doc.stage),
    nextFollowUpDate: doc.nextFollowUpDate || undefined,
    notes: Array.isArray(doc.notes) ? doc.notes : [],
    linkedClientId: doc.linkedClientId || doc.clientId || undefined,
    linkedQuoteId: doc.linkedQuoteId || undefined,
    linkedBookingId: doc.linkedBookingId || doc.convertedBookingId || undefined,
    lostReason: doc.lostReason || undefined,
    reopenReason: doc.reopenReason || undefined,
    createdAt: createdIso,
    updatedAt: updatedIso,
    lastActivityAt: doc.lastActivityAt || updatedIso,
    activityLogs: Array.isArray(doc.activityLogs) ? doc.activityLogs : [],
  };
}

async function persistLeadRecord(lead: LeadRecord & { reopenReason?: string }): Promise<void> {
  await LeadModel.findOneAndUpdate(
    { leadId: lead.id },
    {
      $set: {
        leadId: lead.id,
        organizationId: lead.organizationId || 'org_default',
        clientId: lead.linkedClientId || '',
        clientName: lead.clientName,
        phone: lead.phone,
        email: lead.email,
        requestSummary: `${lead.serviceType} · ${lead.destination}`,
        serviceType: lead.serviceType,
        destination: lead.destination,
        travelDates: lead.travelDates,
        travellersCount: lead.travellersCount,
        source: lead.source,
        sourceNote: lead.sourceNote,
        stage: normalizeStageKey(lead.stage),
        ownerName: lead.ownerStaffName,
        ownerUserId: lead.ownerStaffId,
        branchId: lead.branchId,
        branchName: lead.branchName,
        valueKobo: lead.budgetKobo || 0,
        followUpLabel: lead.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 10) : 'None',
        nextFollowUpDate: lead.nextFollowUpDate,
        convertedBookingId: lead.linkedBookingId,
        linkedClientId: lead.linkedClientId,
        linkedQuoteId: lead.linkedQuoteId,
        linkedBookingId: lead.linkedBookingId,
        lostReason: lead.lostReason,
        reopenReason: lead.reopenReason,
        notes: lead.notes || [],
        activityLogs: lead.activityLogs || [],
        lastActivityAt: lead.lastActivityAt || new Date().toISOString(),
      },
    },
    { upsert: true, new: true }
  );
}

async function fetchOrgLeads(orgId: string): Promise<(LeadRecord & { reopenReason?: string })[]> {
  try {
    const query = orgId === 'org_default' ? {} : { organizationId: orgId };
    const docs = await LeadModel.find(query).sort({ updatedAt: -1 }).lean();
    return docs.map(docToLeadRecord);
  } catch {
    return [];
  }
}

export async function registerLeadsPageRoutes(app: FastifyInstance) {
  // 1. List all 17 Leads Rules
  app.get('/api/v1/leads/rules', async () => {
    const rules = listLeadsPageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every((r) => r.isCompliant),
      rules,
    };
  });

  // 2. Fetch Leads with Filters (MongoDB-backed)
  app.get<{
    Querystring: {
      organizationId?: string;
      ownerStaffId?: string;
      stage?: string;
      source?: string;
      serviceType?: ServiceType;
      overdueFollowUpOnly?: string;
      inactiveFor3DaysOnly?: string;
    };
  }>('/api/v1/leads', async (req) => {
    const orgId = getOrgId(req);
    const { ownerStaffId, stage, source, serviceType, overdueFollowUpOnly, inactiveFor3DaysOnly } = req.query;

    const allLeads = await fetchOrgLeads(orgId);
    const filtered = filterLeads(allLeads, {
      ownerStaffId,
      stage,
      source,
      serviceType,
      overdueFollowUpOnly: overdueFollowUpOnly === 'true',
      inactiveFor3DaysOnly: inactiveFor3DaysOnly === 'true',
    });

    return {
      total: filtered.length,
      leads: filtered,
    };
  });

  // 3. Pipeline View: Stages, Grouped Leads, Column Totals
  app.get('/api/v1/leads/pipeline', async (req) => {
    const orgId = getOrgId(req);
    const allLeads = await fetchOrgLeads(orgId);
    const columnTotals = calculatePipelineColumnTotals(allLeads, PIPELINE_STAGES);

    const grouped: Record<string, LeadRecord[]> = {};
    for (const stg of PIPELINE_STAGES) {
      grouped[stg.key] = allLeads.filter((l) => l.stage === stg.key);
    }

    return {
      stages: PIPELINE_STAGES,
      columnTotals,
      grouped,
    };
  });

  // 4. Create New Lead with MongoDB Persistence
  app.post<{
    Body: {
      organizationId?: string;
      clientName: string;
      phone: string;
      email?: string;
      serviceType?: ServiceType;
      destination?: string;
      travelDatesRough?: string;
      travelStartDate?: string;
      travelEndDate?: string;
      travellersCount?: number;
      budgetNaira?: number;
      source: string;
      sourceNote?: string;
      ownerStaffId?: string;
      ownerStaffName?: string;
      branchId?: string;
      branchName?: string;
      notes?: string;
      linkedClientId?: string;
      nextFollowUpDate?: string;
    };
  }>('/api/v1/leads', async (req, reply) => {
    const orgId = getOrgId(req);
    const input = req.body;

    const validation = validateLeadInput(
      {
        clientName: input.clientName,
        phone: input.phone,
        serviceType: input.serviceType,
        destination: input.destination,
        source: input.source,
        sourceNote: input.sourceNote,
      },
      DEFAULT_SOURCES
    );

    if (!validation.valid) {
      return reply.status(400).send({ errors: validation.errors });
    }

    const newId = `LD-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const nowIso = new Date().toISOString();
    const budgetKobo = Math.round((input.budgetNaira || 0) * 100);
    const ownerName = input.ownerStaffName || 'Workspace Owner';
    const ownerId = input.ownerStaffId || 'usr_owner';

    const newLead: LeadRecord = {
      id: newId,
      organizationId: orgId,
      clientName: input.clientName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || undefined,
      serviceType: input.serviceType || 'flight',
      destination: input.destination?.trim() || 'Unspecified destination',
      travelDates: {
        type: input.travelStartDate ? 'exact' : 'rough',
        dateSummary:
          input.travelDatesRough ||
          (input.travelStartDate
            ? `${input.travelStartDate}${input.travelEndDate ? ` to ${input.travelEndDate}` : ''}`
            : 'Dates TBD'),
        startDate: input.travelStartDate,
        endDate: input.travelEndDate,
      },
      travellersCount: input.travellersCount || 1,
      budgetKobo,
      source: input.source,
      sourceNote: input.sourceNote?.trim() || undefined,
      ownerStaffId: ownerId,
      ownerStaffName: ownerName,
      branchId: input.branchId || 'br-hq',
      branchName: input.branchName || 'Head Office',
      stage: 'new',
      nextFollowUpDate: input.nextFollowUpDate || undefined,
      notes: input.notes?.trim() ? [input.notes.trim()] : [],
      linkedClientId: input.linkedClientId || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastActivityAt: nowIso,
      activityLogs: [
        {
          id: `ACT-${Date.now().toString(36)}`,
          leadId: newId,
          type: 'stage_change',
          description: `Lead created in stage "New" by ${ownerName}`,
          staffId: ownerId,
          staffName: ownerName,
          timestamp: nowIso,
        },
      ],
    };

    try {
      await persistLeadRecord(newLead);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to persist lead to database.' });
    }

    return { success: true, lead: newLead };
  });

  // 5. Pre-match Phone Check against BOTH Clients DB and Leads DB (Must-Have #2)
  app.post<{
    Body: { phone: string; organizationId?: string };
  }>('/api/v1/leads/pre-match', async (req) => {
    const orgId = getOrgId(req);
    const { phone } = req.body;
    const query = orgId === 'org_default' ? {} : { organizationId: orgId };

    let dbClients: Array<{ id: string; name: string; phone: string }> = [];
    try {
      const clientDocs = await ClientModel.find(query).lean();
      dbClients = clientDocs.map((c: any) => ({
        id: c.clientId || String(c._id),
        name: c.name || 'Existing Client',
        phone: c.phone || '',
      }));
    } catch {}

    const dbLeads = await fetchOrgLeads(orgId);
    const match = checkExistingClientOrLead(phone, dbClients, dbLeads);
    return match;
  });

  // 6. Transition Pipeline Stage (Won & Lost Governance + Drag-and-Drop persistence)
  app.post<{
    Params: { id: string };
    Body: {
      targetStage: string;
      staffId: string;
      staffName: string;
      linkedQuoteId?: string;
      linkedBookingId?: string;
      lostReason?: string;
    };
  }>('/api/v1/leads/:id/stage', async (req, reply) => {
    const { id } = req.params;
    const { targetStage, staffId, staffName, linkedQuoteId, linkedBookingId, lostReason } = req.body;

    const doc = await LeadModel.findOne({ leadId: id }).lean();
    if (!doc) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const lead = docToLeadRecord(doc);
    const result = validateStageTransition(lead, targetStage, {
      staffId: staffId || 'usr_owner',
      staffName: staffName || 'Workspace Owner',
      linkedQuoteId,
      linkedBookingId,
      lostReason,
    });

    if (!result.success || !result.updatedLead) {
      return reply.status(400).send({ error: result.error });
    }

    await persistLeadRecord(result.updatedLead);
    return { success: true, lead: result.updatedLead, activityLog: result.activityLog };
  });

  // 7. Objective Call / WhatsApp Action Logging
  app.post<{
    Params: { id: string };
    Body: {
      channel: 'call' | 'whatsapp';
      staffId: string;
      staffName: string;
    };
  }>('/api/v1/leads/:id/communication', async (req, reply) => {
    const { id } = req.params;
    const { channel, staffId, staffName } = req.body;

    const doc = await LeadModel.findOne({ leadId: id }).lean();
    if (!doc) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const lead = docToLeadRecord(doc);
    const result = logCommunicationAttempt(lead, channel, staffId, staffName);
    await persistLeadRecord(result.updatedLead);

    return {
      success: true,
      lead: result.updatedLead,
      log: result.log,
      promptNextFollowUp: result.promptNextFollowUp,
    };
  });

  // 8. Reassign Lead
  app.post<{
    Params: { id: string };
    Body: {
      newOwnerUserId: string;
      newOwnerName: string;
      staffName: string;
    };
  }>('/api/v1/leads/:id/reassign', async (req, reply) => {
    const { id } = req.params;
    const { newOwnerUserId, newOwnerName, staffName } = req.body;

    const doc = await LeadModel.findOne({ leadId: id }).lean();
    if (!doc) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const lead = docToLeadRecord(doc);
    const result = reassignLead(lead, { userId: newOwnerUserId, name: newOwnerName }, staffName);
    await persistLeadRecord(result.updatedLead);

    return { success: true, lead: result.updatedLead, notification: result.notification };
  });

  // 9. Convert Lead to Quote (checks real ClientModel)
  app.post<{
    Params: { id: string };
    Body: {
      staffId: string;
      staffName: string;
    };
  }>('/api/v1/leads/:id/convert-quote', async (req, reply) => {
    const { id } = req.params;
    const { staffId, staffName } = req.body;

    const doc = await LeadModel.findOne({ leadId: id }).lean();
    if (!doc) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const lead = docToLeadRecord(doc);
    let dbClients: Array<{ id: string; name: string; phone: string }> = [];
    try {
      const clientDocs = await ClientModel.find({ organizationId: lead.organizationId }).lean();
      dbClients = clientDocs.map((c: any) => ({
        id: c.clientId || String(c._id),
        name: c.name || 'Client',
        phone: c.phone || '',
      }));
    } catch {}

    const result = convertLeadToQuote(lead, dbClients, staffId, staffName);
    await persistLeadRecord(result.updatedLead);

    return {
      success: true,
      lead: result.updatedLead,
      quotePayload: result.quotePayload,
      clientCreated: result.clientCreated,
    };
  });

  // 10. Reopen Lost Lead with Mandatory Reason & Audit Trail (Must-Have #6)
  app.post<{
    Params: { id: string };
    Body: {
      requesterRole: string;
      staffId: string;
      staffName: string;
      reopenReason?: string;
    };
  }>('/api/v1/leads/:id/reopen', async (req, reply) => {
    const { id } = req.params;
    const { requesterRole, staffId, staffName, reopenReason } = req.body;

    if (!reopenReason || reopenReason.trim().length < 5) {
      return reply.status(400).send({
        error: 'A reopen reason (minimum 5 characters) is required to approve reopening a Lost lead.',
      });
    }

    const doc = await LeadModel.findOne({ leadId: id }).lean();
    if (!doc) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const lead = docToLeadRecord(doc);
    const result = reopenLostLead(lead, requesterRole, staffId, staffName);
    if (!result.success || !result.reopenedLead) {
      return reply.status(403).send({ error: result.error });
    }

    const trimmedReason = reopenReason.trim();
    const updatedWithReason = {
      ...result.reopenedLead,
      reopenReason: trimmedReason,
      notes: [
        `Reopened by ${staffName} (${requesterRole}): ${trimmedReason}`,
        ...result.reopenedLead.notes,
      ],
      activityLogs: [
        {
          id: `ACT-REOPEN-${Date.now().toString(36)}`,
          leadId: lead.id,
          type: 'reopened' as const,
          description: `Lost lead reopened by ${staffName}. Approval reason: "${trimmedReason}"`,
          staffId,
          staffName,
          timestamp: new Date().toISOString(),
        },
        ...result.reopenedLead.activityLogs.slice(1),
      ],
    };

    await persistLeadRecord(updatedWithReason);
    return { success: true, lead: updatedWithReason };
  });

  // 11. Add Note / Comment to Lead (Should-Have #3)
  app.post<{
    Params: { id: string };
    Body: {
      note: string;
      staffId: string;
      staffName: string;
    };
  }>('/api/v1/leads/:id/notes', async (req, reply) => {
    const { id } = req.params;
    const { note, staffId, staffName } = req.body;

    if (!note || !note.trim()) {
      return reply.status(400).send({ error: 'Note cannot be empty.' });
    }

    const doc = await LeadModel.findOne({ leadId: id }).lean();
    if (!doc) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const lead = docToLeadRecord(doc);
    const nowIso = new Date().toISOString();
    const formattedNote = `${note.trim()} — ${staffName}`;

    lead.notes = [formattedNote, ...(lead.notes || [])];
    lead.lastActivityAt = nowIso;
    lead.updatedAt = nowIso;
    lead.activityLogs = [
      {
        id: `ACT-NOTE-${Date.now().toString(36)}`,
        leadId: lead.id,
        type: 'note',
        description: `Note added by ${staffName}: "${note.trim()}"`,
        staffId: staffId || 'usr_owner',
        staffName: staffName || 'Workspace Owner',
        timestamp: nowIso,
      },
      ...(lead.activityLogs || []),
    ];

    await persistLeadRecord(lead);
    return { success: true, lead };
  });

  // 12. Bulk Actions (Reassign or Stage Move - Should-Have #2)
  app.post<{
    Body: {
      leadIds: string[];
      action: 'reassign' | 'move_stage';
      targetStage?: string;
      newOwnerUserId?: string;
      newOwnerName?: string;
      staffId: string;
      staffName: string;
    };
  }>('/api/v1/leads/bulk', async (req, reply) => {
    const { leadIds, action, targetStage, newOwnerUserId, newOwnerName, staffId, staffName } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return reply.status(400).send({ error: 'No leads selected for bulk action.' });
    }

    if (action === 'move_stage' && (!targetStage || ['won', 'lost'].includes(targetStage))) {
      return reply.status(400).send({
        error: 'Bulk stage move only supports open stages (New, Contacted, Quoted, Negotiating). Won/Lost require individual governance.',
      });
    }

    const docs = await LeadModel.find({ leadId: { $in: leadIds } }).lean();
    const updatedLeads: LeadRecord[] = [];

    for (const doc of docs) {
      const lead = docToLeadRecord(doc);
      if (action === 'reassign' && newOwnerUserId && newOwnerName) {
        const res = reassignLead(lead, { userId: newOwnerUserId, name: newOwnerName }, staffName);
        await persistLeadRecord(res.updatedLead);
        updatedLeads.push(res.updatedLead);
      } else if (action === 'move_stage' && targetStage) {
        const res = validateStageTransition(lead, targetStage, {
          staffId: staffId || 'usr_owner',
          staffName: staffName || 'Workspace Owner',
        });
        if (res.success && res.updatedLead) {
          await persistLeadRecord(res.updatedLead);
          updatedLeads.push(res.updatedLead);
        }
      }
    }

    return { success: true, updatedCount: updatedLeads.length, leads: updatedLeads };
  });

  // 13. Sources Analytics Performance Summary
  app.get('/api/v1/leads/sources-summary', async (req) => {
    const orgId = getOrgId(req);
    const allLeads = await fetchOrgLeads(orgId);
    const metrics = aggregateSourcesPerformance(allLeads);
    return {
      totalSources: metrics.length,
      metrics,
    };
  });

  // 14. Follow-ups Queues (Today, Overdue, Upcoming)
  app.get('/api/v1/leads/follow-ups', async (req) => {
    const orgId = getOrgId(req);
    const allLeads = await fetchOrgLeads(orgId);
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const endOfToday = new Date().setHours(23, 59, 59, 999);

    const overdue: LeadRecord[] = [];
    const today: LeadRecord[] = [];
    const upcoming: LeadRecord[] = [];

    for (const lead of allLeads) {
      if (!lead.nextFollowUpDate || lead.stage === 'won' || lead.stage === 'lost') continue;
      const time = new Date(lead.nextFollowUpDate).getTime();
      if (time < startOfToday) {
        overdue.push(lead);
      } else if (time <= endOfToday) {
        today.push(lead);
      } else {
        upcoming.push(lead);
      }
    }

    return { overdue, today, upcoming };
  });

  // 15. Snooze or Schedule Next Follow-up
  app.post<{
    Params: { id: string };
    Body: {
      nextFollowUpDate: string;
      note?: string;
      staffName: string;
    };
  }>('/api/v1/leads/:id/follow-up/schedule', async (req, reply) => {
    const { id } = req.params;
    const { nextFollowUpDate, note, staffName } = req.body;

    const doc = await LeadModel.findOne({ leadId: id }).lean();
    if (!doc) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const lead = docToLeadRecord(doc);
    const nowIso = new Date().toISOString();
    lead.nextFollowUpDate = nextFollowUpDate;
    lead.lastActivityAt = nowIso;
    lead.updatedAt = nowIso;
    if (note) {
      lead.notes = [`Follow-up outcome: ${note.trim()} (Updated by ${staffName})`, ...(lead.notes || [])];
    }

    await persistLeadRecord(lead);
    return { success: true, lead };
  });
}

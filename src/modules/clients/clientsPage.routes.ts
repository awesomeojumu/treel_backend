import { FastifyInstance } from 'fastify';
import {
  listClientsPageRules,
  validateClientInput,
  sanitizeClientForViewer,
  generateNextClientId,
  filterClientsByRBAC,
  searchAndFilterClients,
  detectDuplicates,
  mergeClients,
  reverseMerge,
  validateKYCDocument,
  logKYCAccess,
  addNote,
  editNote,
  canDeleteClient,
  archiveClient,
  canSendMarketingMessage,
  ClientRecord,
  KYCDocument,
  KYCAuditLog,
  MergeAuditLog,
  ClientType,
} from '@/core/clients/clientsPageRules';

// In-memory seed database for Clients
const INITIAL_CLIENTS: ClientRecord[] = [
  {
    id: 'CL-2026-0001',
    organizationId: 'org-lagos-01',
    fullName: 'Dr. Michael Okon',
    preferredName: 'Mike',
    phone: '+234 803 111 2222',
    isWhatsAppPhone: true,
    secondPhone: '0818 222 3333',
    email: 'michael.okon@totalenergies.com',
    address: 'Plot 14, Victoria Island, Lagos',
    dateOfBirth: '1978-08-22',
    gender: 'male',
    nationality: 'Nigerian',
    passportNumber: 'A12345678',
    passportExpiry: '2028-11-15',
    nextOfKinName: 'Mrs. Judith Okon',
    nextOfKinPhone: '0802 333 4444',
    clientType: 'corporate',
    corporateBillingName: 'TotalEnergies E&P Nigeria Ltd',
    corporateContacts: [
      {
        id: 'CON-01',
        name: 'Michael Okon',
        email: 'michael.okon@totalenergies.com',
        phone: '+234 803 111 2222',
        roleTitle: 'Procurement Director',
        isPrimary: true,
      },
      {
        id: 'CON-02',
        name: 'Blessing Udoh',
        email: 'blessing.udoh@totalenergies.com',
        phone: '+234 809 777 8888',
        roleTitle: 'Travel Coordinator',
        isPrimary: false,
      },
    ],
    source: 'Corporate Contract',
    ownerStaffId: 'usr_bisi',
    ownerStaffName: 'Bisi Adeyemi',
    branchId: 'br-vi',
    branchName: 'Victoria Island Head Office',
    notes: [
      {
        id: 'NOTE-01',
        clientId: 'CL-2026-0001',
        authorStaffId: 'usr_bisi',
        authorName: 'Bisi Adeyemi',
        content: 'Prefers window seats on British Airways long haul flights. Always request low-sodium meal.',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        editableUntil: new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString(),
      },
    ],
    documents: [
      {
        id: 'DOC-KYC-01',
        clientId: 'CL-2026-0001',
        title: 'Standard Nigerian Passport Data Page',
        category: 'passport',
        fileUrl: 'https://travelreel.app/docs/passport-okon.pdf',
        fileType: 'pdf',
        fileSizeMb: 1.8,
        expiryDate: '2028-11-15',
        version: 1,
        uploadedByStaffId: 'usr_bisi',
        uploadedByStaffName: 'Bisi Adeyemi',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
    ],
    marketingConsent: true,
    status: 'active',
    totalBookingsCount: 6,
    totalPaidKobo: 7_500_000_00,
    balanceKobo: 450_000_00, // Has outstanding balance
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    hasUpcomingTravel: true,
  },
  {
    id: 'CL-2026-0002',
    organizationId: 'org-lagos-01',
    fullName: 'Alhaji Ibrahim Abdullahi',
    preferredName: 'Alhaji Ibrahim',
    phone: '0803 123 4567',
    isWhatsAppPhone: true,
    email: 'ibrahim.abdullahi@kano.ng',
    address: '12 Bompai Road, Kano',
    dateOfBirth: '1965-03-10',
    gender: 'male',
    nationality: 'Nigerian',
    passportNumber: 'A00987654',
    passportExpiry: '2027-02-18', // Under 6 months from late 2026 travel
    nextOfKinName: 'Aminu Abdullahi',
    nextOfKinPhone: '0803 999 0000',
    clientType: 'family',
    source: 'Referral',
    ownerStaffId: 'usr_bisi',
    ownerStaffName: 'Bisi Adeyemi',
    branchId: 'br-ikeja',
    branchName: 'Ikeja Branch',
    notes: [
      {
        id: 'NOTE-02',
        clientId: 'CL-2026-0002',
        authorStaffId: 'usr_bisi',
        authorName: 'Bisi Adeyemi',
        content: 'Travels with family (wife and 3 children) every December for Umrah pilgrimage.',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        editableUntil: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
      },
    ],
    documents: [],
    marketingConsent: true,
    status: 'active',
    totalBookingsCount: 3,
    totalPaidKobo: 3_200_000_00,
    balanceKobo: 0,
    lastActivityAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    hasUpcomingTravel: true,
  },
  {
    id: 'CL-2026-0003',
    organizationId: 'org-lagos-01',
    fullName: 'Mrs. Folake Martins',
    phone: '0802 222 3333',
    isWhatsAppPhone: false,
    email: 'folake.martins@yahoo.com',
    address: '5 Admiralty Way, Lekki Phase 1, Lagos',
    dateOfBirth: '1984-11-05',
    gender: 'female',
    nationality: 'Nigerian',
    passportNumber: 'B88776655',
    passportExpiry: '2029-06-30',
    clientType: 'individual',
    source: 'Website Lead',
    ownerStaffId: 'usr_tunde',
    ownerStaffName: 'Tunde Bakare',
    branchId: 'br-ikeja',
    branchName: 'Ikeja Branch',
    notes: [],
    documents: [],
    marketingConsent: false, // Prohibits marketing
    status: 'active',
    totalBookingsCount: 1,
    totalPaidKobo: 950_000_00,
    balanceKobo: 0,
    lastActivityAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    hasUpcomingTravel: false,
  },
  // Potential duplicate record for Alhaji Ibrahim
  {
    id: 'CL-2026-0004',
    organizationId: 'org-lagos-01',
    fullName: 'Ibrahim Abdullahi',
    phone: '+234 803 123 4567', // Same normalized phone!
    isWhatsAppPhone: true,
    email: 'ibrahim.abdullahi@kano.ng', // Same email!
    passportNumber: 'A00987654', // Same passport!
    clientType: 'individual',
    source: 'WhatsApp Inbound',
    ownerStaffId: 'usr_tunde',
    ownerStaffName: 'Tunde Bakare',
    branchId: 'br-ikeja',
    branchName: 'Ikeja Branch',
    notes: [],
    documents: [],
    marketingConsent: true,
    status: 'active',
    totalBookingsCount: 0,
    totalPaidKobo: 0,
    balanceKobo: 0,
    lastActivityAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    hasUpcomingTravel: false,
  },
];

let inMemoryClients: ClientRecord[] = [...INITIAL_CLIENTS];
let inMemoryIgnoredDuplicates: Set<string> = new Set<string>();
let inMemoryMergeAuditLogs: MergeAuditLog[] = [];
let inMemoryKYCAuditLogs: KYCAuditLog[] = [];

export async function registerClientsPageRoutes(app: FastifyInstance) {
  // 1. List all 19 Page Rules
  app.get('/api/v1/clients/rules', async () => {
    const rules = listClientsPageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every((r) => r.isCompliant),
      rules,
    };
  });

  // 2. Fetch Clients List with Search, Filters, Columns & RBAC Scoping
  app.get<{
    Querystring: {
      search?: string;
      ownerStaffId?: string;
      branchId?: string;
      source?: string;
      clientType?: ClientType;
      hasOutstandingBalance?: string;
      hasUpcomingTravel?: string;
      viewerRoleKey?: string;
      viewerUserId?: string;
      viewerBranchId?: string;
    };
  }>('/api/v1/clients', async (req) => {
    const {
      search = '',
      ownerStaffId,
      branchId,
      source,
      clientType,
      hasOutstandingBalance,
      hasUpcomingTravel,
      viewerRoleKey = 'OWNER',
      viewerUserId = 'usr_adaeze',
      viewerBranchId = 'br-vi',
    } = req.query;

    const scoped = filterClientsByRBAC(inMemoryClients, {
      roleKey: viewerRoleKey,
      userId: viewerUserId,
      branchId: viewerBranchId,
    });

    const activeOnly = scoped.filter((c) => c.status === 'active');

    const filtered = searchAndFilterClients(activeOnly, search, {
      ownerStaffId,
      branchId,
      source,
      clientType,
      hasOutstandingBalance: hasOutstandingBalance === 'true',
      hasUpcomingTravel: hasUpcomingTravel === 'true',
    });

    const sanitized = filtered.map((c) => sanitizeClientForViewer(c, viewerRoleKey));

    return {
      total: sanitized.length,
      clients: sanitized,
    };
  });

  // 3. Create New Client
  app.post<{
    Body: {
      fullName: string;
      preferredName?: string;
      phone: string;
      isWhatsAppPhone?: boolean;
      secondPhone?: string;
      email?: string;
      address?: string;
      dateOfBirth?: string;
      gender?: 'male' | 'female' | 'other';
      nationality?: string;
      passportNumber?: string;
      passportExpiry?: string;
      nextOfKinName?: string;
      nextOfKinPhone?: string;
      clientType?: ClientType;
      corporateBillingName?: string;
      source?: string;
      ownerStaffId?: string;
      ownerStaffName?: string;
      branchId?: string;
      branchName?: string;
      marketingConsent?: boolean;
      notes?: string;
    };
  }>('/api/v1/clients', async (req, reply) => {
    const input = req.body;
    const validation = validateClientInput({
      fullName: input.fullName,
      phone: input.phone,
      passportExpiry: input.passportExpiry,
    });

    if (!validation.valid) {
      return reply.status(400).send({ errors: validation.errors });
    }

    const existingIds = inMemoryClients.map((c) => c.id);
    const newId = generateNextClientId(existingIds);
    const now = new Date().toISOString();

    const newClient: ClientRecord = {
      id: newId,
      organizationId: 'org-lagos-01',
      fullName: input.fullName.trim(),
      preferredName: input.preferredName?.trim(),
      phone: input.phone.trim(),
      isWhatsAppPhone: input.isWhatsAppPhone ?? true,
      secondPhone: input.secondPhone?.trim(),
      email: input.email?.trim(),
      address: input.address?.trim(),
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      nationality: input.nationality || 'Nigerian',
      passportNumber: input.passportNumber?.trim(),
      passportExpiry: input.passportExpiry,
      nextOfKinName: input.nextOfKinName?.trim(),
      nextOfKinPhone: input.nextOfKinPhone?.trim(),
      clientType: input.clientType || 'individual',
      corporateBillingName: input.corporateBillingName?.trim(),
      source: input.source || 'Direct Enquiry',
      ownerStaffId: input.ownerStaffId || 'usr_bisi',
      ownerStaffName: input.ownerStaffName || 'Bisi Adeyemi',
      branchId: input.branchId || 'br-vi',
      branchName: input.branchName || 'Victoria Island',
      notes: input.notes ? [addNote(newId, input.ownerStaffId || 'usr_bisi', input.ownerStaffName || 'Bisi Adeyemi', input.notes)] : [],
      documents: [],
      marketingConsent: input.marketingConsent ?? true,
      status: 'active',
      totalBookingsCount: 0,
      totalPaidKobo: 0,
      balanceKobo: 0,
      lastActivityAt: now,
      hasUpcomingTravel: false,
    };

    inMemoryClients.unshift(newClient);

    return {
      success: true,
      client: newClient,
      passportRisk: validation.passportRisk,
    };
  });

  // 4. Get Client Detail Profile (Sanitized with 5 Profile Tabs)
  app.get<{
    Params: { id: string };
    Querystring: { viewerRoleKey?: string };
  }>('/api/v1/clients/:id', async (req, reply) => {
    const { id } = req.params;
    const { viewerRoleKey = 'OWNER' } = req.query;

    const client = inMemoryClients.find((c) => c.id === id);
    if (!client) {
      return reply.status(404).send({ error: 'Client not found' });
    }

    const sanitized = sanitizeClientForViewer(client, viewerRoleKey);

    return {
      client: sanitized,
      tabs: {
        details: sanitized,
        kyc: sanitized.documents,
        notes: sanitized.notes,
        bookingsSummary: {
          totalBookingsCount: sanitized.totalBookingsCount,
          totalPaidKobo: sanitized.totalPaidKobo,
          balanceKobo: sanitized.balanceKobo,
        },
      },
    };
  });

  // 5. Detect Duplicates
  app.get('/api/v1/clients/duplicates', async () => {
    const dupes = detectDuplicates(inMemoryClients, inMemoryIgnoredDuplicates);
    return {
      totalDuplicates: dupes.length,
      pairs: dupes,
    };
  });

  // 6. Ignore Duplicate Pair ("Not a duplicate" remembered)
  app.post<{
    Body: { clientAId: string; clientBId: string };
  }>('/api/v1/clients/duplicates/ignore', async (req) => {
    const { clientAId, clientBId } = req.body;
    const pairKey = [clientAId, clientBId].sort().join('::');
    inMemoryIgnoredDuplicates.add(pairKey);
    return { success: true, rememberedKey: pairKey };
  });

  // 7. Merge Clients with 7-Day Rollback
  app.post<{
    Body: {
      survivingClientId: string;
      absorbedClientId: string;
      fieldOverrides?: Partial<ClientRecord>;
      staffId: string;
      staffName: string;
    };
  }>('/api/v1/clients/merge', async (req, reply) => {
    const { survivingClientId, absorbedClientId, fieldOverrides = {}, staffId, staffName } = req.body;

    const surviving = inMemoryClients.find((c) => c.id === survivingClientId);
    const absorbed = inMemoryClients.find((c) => c.id === absorbedClientId);

    if (!surviving || !absorbed) {
      return reply.status(404).send({ error: 'One or both client records not found' });
    }

    const { mergedClient, mergeAuditLog } = mergeClients(
      surviving,
      absorbed,
      fieldOverrides,
      staffId,
      staffName
    );

    // Update in-memory records: replace surviving, remove absorbed
    const sIndex = inMemoryClients.findIndex((c) => c.id === survivingClientId);
    inMemoryClients[sIndex] = mergedClient;
    inMemoryClients = inMemoryClients.filter((c) => c.id !== absorbedClientId);

    inMemoryMergeAuditLogs.unshift(mergeAuditLog);

    return {
      success: true,
      mergedClient,
      mergeAuditLog,
      reverseAvailableUntil: mergeAuditLog.reverseAvailableUntil,
    };
  });

  // 8. Reverse Merge (Owner-only, within 7 days)
  app.post<{
    Body: {
      mergeLogId: string;
      requesterRole: string;
    };
  }>('/api/v1/clients/merge/reverse', async (req, reply) => {
    const { mergeLogId, requesterRole } = req.body;
    const log = inMemoryMergeAuditLogs.find((l) => l.id === mergeLogId);

    if (!log) {
      return reply.status(404).send({ error: 'Merge audit log entry not found' });
    }

    const result = reverseMerge(log, requesterRole);
    if (!result.success || !result.restoredClient) {
      return reply.status(400).send({ error: result.error });
    }

    log.isReversed = true;
    inMemoryClients.push(result.restoredClient);

    return {
      success: true,
      restoredClient: result.restoredClient,
      message: `Merge successfully reversed. Client ${result.restoredClient.id} has been restored.`,
    };
  });

  // 9. Upload / Replace KYC Document
  app.post<{
    Params: { id: string };
    Body: {
      title: string;
      category: 'passport' | 'id_card' | 'photo' | 'visa_copy' | 'consent_form' | 'other';
      fileUrl: string;
      fileType: 'pdf' | 'jpg' | 'png';
      fileSizeMb: number;
      expiryDate?: string;
      staffId: string;
      staffName: string;
      replaceDocumentId?: string;
    };
  }>('/api/v1/clients/:id/documents', async (req, reply) => {
    const { id } = req.params;
    const input = req.body;

    const client = inMemoryClients.find((c) => c.id === id);
    if (!client) {
      return reply.status(404).send({ error: 'Client not found' });
    }

    const docValidation = validateKYCDocument({
      title: input.title,
      category: input.category,
      fileSizeMb: input.fileSizeMb,
      fileType: input.fileType,
    });

    if (!docValidation.valid) {
      return reply.status(400).send({ error: docValidation.error });
    }

    let version = 1;
    let previousVersionUrl: string | undefined;

    if (input.replaceDocumentId) {
      const existingDoc = client.documents.find((d) => d.id === input.replaceDocumentId);
      if (existingDoc) {
        version = existingDoc.version + 1;
        previousVersionUrl = existingDoc.fileUrl; // Old version kept
      }
    }

    const newDoc: KYCDocument = {
      id: `DOC-KYC-${Date.now().toString(36)}`,
      clientId: id,
      title: input.title,
      category: input.category,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      fileSizeMb: input.fileSizeMb,
      expiryDate: input.expiryDate,
      version,
      previousVersionUrl,
      uploadedByStaffId: input.staffId,
      uploadedByStaffName: input.staffName,
      createdAt: new Date().toISOString(),
    };

    client.documents.push(newDoc);
    return { success: true, document: newDoc };
  });

  // 10. Log View / Download of KYC Document
  app.post<{
    Body: {
      documentId: string;
      action: 'view' | 'download';
      staffId: string;
      staffName: string;
    };
  }>('/api/v1/clients/documents/audit', async (req) => {
    const { documentId, action, staffId, staffName } = req.body;
    const log = logKYCAccess(documentId, action, staffId, staffName);
    inMemoryKYCAuditLogs.push(log);
    return { success: true, log };
  });

  // 11. Add Note
  app.post<{
    Params: { id: string };
    Body: {
      content: string;
      authorStaffId: string;
      authorName: string;
    };
  }>('/api/v1/clients/:id/notes', async (req, reply) => {
    const { id } = req.params;
    const { content, authorStaffId, authorName } = req.body;

    const client = inMemoryClients.find((c) => c.id === id);
    if (!client) {
      return reply.status(404).send({ error: 'Client not found' });
    }
    if (!content?.trim()) {
      return reply.status(400).send({ error: 'Note content cannot be empty' });
    }

    const note = addNote(id, authorStaffId, authorName, content);
    client.notes.unshift(note);
    return { success: true, note };
  });

  // 12. Edit Note (15-Minute Edit Window Enforced)
  app.put<{
    Params: { id: string; noteId: string };
    Body: {
      content: string;
      editorStaffId: string;
    };
  }>('/api/v1/clients/:id/notes/:noteId', async (req, reply) => {
    const { id, noteId } = req.params;
    const { content, editorStaffId } = req.body;

    const client = inMemoryClients.find((c) => c.id === id);
    if (!client) {
      return reply.status(404).send({ error: 'Client not found' });
    }

    const note = client.notes.find((n) => n.id === noteId);
    if (!note) {
      return reply.status(404).send({ error: 'Note not found' });
    }

    const res = editNote(note, content, editorStaffId);
    if (!res.success || !res.updatedNote) {
      return reply.status(400).send({ error: res.error });
    }

    const noteIndex = client.notes.findIndex((n) => n.id === noteId);
    client.notes[noteIndex] = res.updatedNote;

    return { success: true, note: res.updatedNote };
  });

  // 13. Delete Client (Safe Deletion Guard)
  app.delete<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/api/v1/clients/:id', async (req, reply) => {
    const { id } = req.params;
    const { reason } = req.body || {};

    const client = inMemoryClients.find((c) => c.id === id);
    if (!client) {
      return reply.status(404).send({ error: 'Client not found' });
    }

    const check = canDeleteClient(client);
    if (!check.allowed) {
      return reply.status(400).send({ error: check.reason });
    }

    const archiveRes = archiveClient(client, reason || 'Client requested removal with 0 ledger activity');
    if (!archiveRes.success || !archiveRes.archivedClient) {
      return reply.status(400).send({ error: archiveRes.error });
    }

    // Replace with archived status
    const index = inMemoryClients.findIndex((c) => c.id === id);
    inMemoryClients[index] = archiveRes.archivedClient;

    return {
      success: true,
      message: `Client ${client.id} safely archived.`,
      archivedClient: archiveRes.archivedClient,
    };
  });

  // 14. Marketing Outreach Consent Check
  app.post<{
    Params: { id: string };
    Body: { channel: 'whatsapp' | 'sms' };
  }>('/api/v1/clients/:id/marketing-check', async (req, reply) => {
    const { id } = req.params;
    const { channel } = req.body;

    const client = inMemoryClients.find((c) => c.id === id);
    if (!client) {
      return reply.status(404).send({ error: 'Client not found' });
    }

    const check = canSendMarketingMessage(client, channel);
    if (!check.allowed) {
      return reply.status(403).send({ error: check.error });
    }

    return { success: true, marketingAllowed: true };
  });
}

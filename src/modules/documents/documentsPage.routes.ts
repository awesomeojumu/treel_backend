import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  DOCUMENTS_SPECIFICATION_RULES,
  validateDocumentUpload,
  logDocumentDownload,
  recordPolicyAcknowledgement,
  createNewDocumentVersion,
  validateAndInterpolateMergeFields,
  evaluateExpiringDocuments,
  DocumentRecord,
  DownloadLogEntry,
  PolicyAcknowledgement,
  DocumentTemplate,
} from '@/core/documents/documentsPageRules';

// In-Memory Seed Storage for Multi-Tenant Sandbox
let SEED_DOCUMENTS: DocumentRecord[] = [
  {
    id: 'DOC-2026-001',
    tenantId: 'tenant-skyline',
    title: 'Skyline Travels Staff Code of Conduct & Ethics 2026',
    category: 'policies',
    tags: ['hr', 'conduct', 'compliance', 'ndpa'],
    fileType: 'pdf',
    currentVersion: 2,
    versions: [
      {
        versionNumber: 2,
        fileUrl: 'https://cdn.travelreel.ng/skyline/docs/conduct_v2.pdf',
        fileSize: 1.4 * 1024 * 1024,
        uploadedBy: 'Chioma Adebayo (HR Lead)',
        uploadedAt: '2026-10-15T09:30:00Z',
        changeNotes: 'Updated whistleblowing channel and remote work security mandates.',
      },
      {
        versionNumber: 1,
        fileUrl: 'https://cdn.travelreel.ng/skyline/docs/conduct_v1.pdf',
        fileSize: 1.2 * 1024 * 1024,
        uploadedBy: 'Babatunde Lawal (MD)',
        uploadedAt: '2026-01-08T11:00:00Z',
        changeNotes: 'Initial policy adoption.',
      },
    ],
    visibilityRoles: ['all'],
    effectiveDate: '2026-10-20',
    policyAudience: {
      scope: 'all',
    },
  },
  {
    id: 'DOC-2026-002',
    tenantId: 'tenant-skyline',
    title: 'NCAA Air Travel Organizer Licence (ATOL) Renewal',
    category: 'contracts',
    tags: ['regulatory', 'ncaa', 'licence', 'aviation'],
    fileType: 'pdf',
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        fileUrl: 'https://cdn.travelreel.ng/skyline/docs/ncaa_licence_2026.pdf',
        fileSize: 3.2 * 1024 * 1024,
        uploadedBy: 'Farouk Danjuma (Operations)',
        uploadedAt: '2025-11-20T14:00:00Z',
        changeNotes: 'Official Nigerian Civil Aviation Authority certification.',
      },
    ],
    visibilityRoles: ['owner', 'manager'],
    expiryDate: '2026-11-20', // ~18 days from current date (30-day warning)
    isExpiringAlertable: true,
  },
  {
    id: 'DOC-2026-003',
    tenantId: 'tenant-skyline',
    title: 'IATA Consolidator Head Office Certificate',
    category: 'contracts',
    tags: ['iata', 'gds', 'ticketing', 'billing'],
    fileType: 'pdf',
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        fileUrl: 'https://cdn.travelreel.ng/skyline/docs/iata_cert_2026.pdf',
        fileSize: 2.1 * 1024 * 1024,
        uploadedBy: 'Farouk Danjuma (Operations)',
        uploadedAt: '2025-12-25T10:00:00Z',
        changeNotes: 'Annual IATA Head Office Accreditation.',
      },
    ],
    visibilityRoles: ['owner', 'manager', 'accountant'],
    expiryDate: '2026-12-25', // ~53 days from current date (60-day notice)
    isExpiringAlertable: true,
  },
  {
    id: 'DOC-2026-004',
    tenantId: 'tenant-skyline',
    title: 'Professional Indemnity Insurance Policy - Leadway Assurance',
    category: 'contracts',
    tags: ['insurance', 'leadway', 'liability', 'coverage'],
    fileType: 'pdf',
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        fileUrl: 'https://cdn.travelreel.ng/skyline/docs/leadway_indemnity_2026.pdf',
        fileSize: 4.8 * 1024 * 1024,
        uploadedBy: 'Chioma Adebayo (HR Lead)',
        uploadedAt: '2025-11-09T08:00:00Z',
        changeNotes: 'NGN 100M Professional Indemnity & Cyber Risk binder.',
      },
    ],
    visibilityRoles: ['owner', 'manager'],
    expiryDate: '2026-11-08', // ~6 days from current date (7-day critical alert)
    isExpiringAlertable: true,
  },
  {
    id: 'DOC-2026-005',
    tenantId: 'tenant-skyline',
    title: 'Corporate Travel Account Agreement Template',
    category: 'forms',
    tags: ['client', 'corporate', 'sla', 'onboarding'],
    fileType: 'word',
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        fileUrl: 'https://cdn.travelreel.ng/skyline/docs/corporate_travel_sla.docx',
        fileSize: 850 * 1024,
        uploadedBy: 'Amina Bello (Legal)',
        uploadedAt: '2026-05-12T16:00:00Z',
        changeNotes: 'Standard 30-day net credit agreement form.',
      },
    ],
    visibilityRoles: ['all'],
  },
  {
    id: 'DOC-2026-006',
    tenantId: 'tenant-skyline',
    title: 'Wakanow Consolidator B2B Commission Schedule Q4',
    category: 'supplier documents',
    tags: ['supplier', 'wakanow', 'commissions', 'fares'],
    fileType: 'excel',
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        fileUrl: 'https://cdn.travelreel.ng/skyline/docs/wakanow_commissions_q4.xlsx',
        fileSize: 1.1 * 1024 * 1024,
        uploadedBy: 'Farouk Danjuma (Operations)',
        uploadedAt: '2026-10-01T12:00:00Z',
        changeNotes: 'Q4 regional override commission rates.',
      },
    ],
    visibilityRoles: ['owner', 'manager', 'accountant'],
  },
];

let SEED_DOWNLOAD_LOGS: DownloadLogEntry[] = [
  {
    id: 'DWL-101',
    documentId: 'DOC-2026-001',
    documentTitle: 'Skyline Travels Staff Code of Conduct & Ethics 2026',
    versionNumber: 2,
    downloadedByStaffId: 'STF-02',
    downloadedByStaffName: 'Tunde Bakare',
    downloadedAt: '2026-10-22T14:15:00Z',
  },
];

let SEED_POLICY_ACKNOWLEDGEMENTS: PolicyAcknowledgement[] = [
  {
    id: 'ACK-201',
    policyId: 'DOC-2026-001',
    policyTitle: 'Skyline Travels Staff Code of Conduct & Ethics 2026',
    versionNumber: 2,
    staffId: 'STF-01',
    staffName: 'Chioma Adebayo',
    acknowledgedAt: '2026-10-21T09:00:00Z',
    isImmutable: true,
  },
];

let SEED_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'TPL-QUOTE',
    type: 'quote',
    name: 'Standard Client Travel Quote',
    subjectLine: 'Travel Quotation for {{destination}} - {{booking_reference}}',
    body: 'Dear {{client_name}},\n\nThank you for choosing {{agency_name}}. We are pleased to present your tailored itinerary for {{destination}}.\n\nTotal Package: {{currency}} {{amount}}\nValidity: Valid until {{due_date}}.\n\nAssigned Consultant: {{assigned_agent}}\nReference: {{booking_reference}}',
    defaultBody:
      'Dear {{client_name}},\n\nThank you for choosing {{agency_name}}. We are pleased to present your tailored itinerary for {{destination}}.\n\nTotal Package: {{currency}} {{amount}}\nValidity: Valid until {{due_date}}.\n\nAssigned Consultant: {{assigned_agent}}\nReference: {{booking_reference}}',
    supportedMergeFields: [
      'client_name',
      'destination',
      'agency_name',
      'currency',
      'amount',
      'due_date',
      'assigned_agent',
      'booking_reference',
    ],
    isCustomized: false,
  },
  {
    id: 'TPL-INVOICE',
    type: 'invoice',
    name: 'Commercial Invoice Blueprint',
    subjectLine: 'Tax Invoice: Booking {{booking_reference}}',
    body: 'TAX INVOICE\n\nBilled To: {{client_name}} ({{client_email}})\nBooking Reference: {{booking_reference}}\nDestination: {{destination}}\nTravel Date: {{travel_date}}\n\nAmount Due: {{currency}} {{amount}}\nPayment Due Date: {{due_date}}\n\nPlease credit our designated corporate accounts.\n{{agency_name}} Accounts Department',
    defaultBody:
      'TAX INVOICE\n\nBilled To: {{client_name}} ({{client_email}})\nBooking Reference: {{booking_reference}}\nDestination: {{destination}}\nTravel Date: {{travel_date}}\n\nAmount Due: {{currency}} {{amount}}\nPayment Due Date: {{due_date}}\n\nPlease credit our designated corporate accounts.\n{{agency_name}} Accounts Department',
    supportedMergeFields: [
      'client_name',
      'client_email',
      'booking_reference',
      'destination',
      'travel_date',
      'currency',
      'amount',
      'due_date',
      'agency_name',
    ],
    isCustomized: false,
  },
  {
    id: 'TPL-RECEIPT',
    type: 'receipt',
    name: 'Official Payment Receipt',
    subjectLine: 'Official Payment Receipt - {{booking_reference}}',
    body: 'OFFICIAL RECEIPT\n\nReceived with thanks from: {{client_name}}\nAmount: {{currency}} {{amount}}\nFor Booking Ref: {{booking_reference}}\nPayment Date: {{travel_date}}\n\nThank you for your business!\n{{agency_name}}',
    defaultBody:
      'OFFICIAL RECEIPT\n\nReceived with thanks from: {{client_name}}\nAmount: {{currency}} {{amount}}\nFor Booking Ref: {{booking_reference}}\nPayment Date: {{travel_date}}\n\nThank you for your business!\n{{agency_name}}',
    supportedMergeFields: [
      'client_name',
      'currency',
      'amount',
      'booking_reference',
      'travel_date',
      'agency_name',
    ],
    isCustomized: false,
  },
  {
    id: 'TPL-WHATSAPP',
    type: 'whatsapp',
    name: 'WhatsApp Instant Booking Confirmation',
    body: 'Hello {{client_name}}! ✈️ Your booking with {{agency_name}} has been confirmed (Ref: *{{booking_reference}}*). Destination: *{{destination}}*. Total Paid: {{currency}} {{amount}}. Please reach out to your agent {{assigned_agent}} if you need anything!',
    defaultBody:
      'Hello {{client_name}}! ✈️ Your booking with {{agency_name}} has been confirmed (Ref: *{{booking_reference}}*). Destination: *{{destination}}*. Total Paid: {{currency}} {{amount}}. Please reach out to your agent {{assigned_agent}} if you need anything!',
    supportedMergeFields: [
      'client_name',
      'agency_name',
      'booking_reference',
      'destination',
      'currency',
      'amount',
      'assigned_agent',
    ],
    isCustomized: false,
  },
  {
    id: 'TPL-EMAIL',
    type: 'email',
    name: 'Pre-Departure Flight E-Ticket Notification',
    subjectLine: 'E-Ticket & Travel Advisory: {{destination}} (Ref: {{booking_reference}})',
    body: 'Dear {{client_name}},\n\nYour flight tickets for {{destination}} have been successfully issued under reservation reference {{booking_reference}}.\n\nDeparture Date: {{travel_date}}\nManaging Consultant: {{assigned_agent}}\n\nPlease review the attached e-ticket PDF and ensure your international passport has at least 6 months validity.\n\nWarm regards,\n{{agency_name}} Team',
    defaultBody:
      'Dear {{client_name}},\n\nYour flight tickets for {{destination}} have been successfully issued under reservation reference {{booking_reference}}.\n\nDeparture Date: {{travel_date}}\nManaging Consultant: {{assigned_agent}}\n\nPlease review the attached e-ticket PDF and ensure your international passport has at least 6 months validity.\n\nWarm regards,\n{{agency_name}} Team',
    supportedMergeFields: [
      'client_name',
      'destination',
      'booking_reference',
      'travel_date',
      'assigned_agent',
      'agency_name',
    ],
    isCustomized: false,
  },
  {
    id: 'TPL-ITINERARY',
    type: 'tour_itinerary',
    name: 'Day-by-Day Tour Itinerary PDF Template',
    subjectLine: 'Bespoke Tour Itinerary: {{destination}}',
    body: 'EXCLUSIVE TRAVEL ITINERARY\n\nClient: {{client_name}}\nDestination: {{destination}}\nCommencement Date: {{travel_date}}\nReference: {{booking_reference}}\n\nDay 1: Arrival & VIP MMIA Airport Transfer\nDay 2: City Highlights & Cultural Experience\nDay 3: Leisure & Shopping\n\nHandled by: {{agency_name}} / {{assigned_agent}}',
    defaultBody:
      'EXCLUSIVE TRAVEL ITINERARY\n\nClient: {{client_name}}\nDestination: {{destination}}\nCommencement Date: {{travel_date}}\nReference: {{booking_reference}}\n\nDay 1: Arrival & VIP MMIA Airport Transfer\nDay 2: City Highlights & Cultural Experience\nDay 3: Leisure & Shopping\n\nHandled by: {{agency_name}} / {{assigned_agent}}',
    supportedMergeFields: [
      'client_name',
      'destination',
      'travel_date',
      'booking_reference',
      'agency_name',
      'assigned_agent',
    ],
    isCustomized: false,
  },
];

export async function registerDocumentsPageRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/documents/rules
   * Returns all 10 specification rules
   */
  app.get('/api/v1/documents/rules', async () => {
    return {
      success: true,
      rules: DOCUMENTS_SPECIFICATION_RULES,
      count: DOCUMENTS_SPECIFICATION_RULES.length,
    };
  });

  /**
   * GET /api/v1/documents
   * Returns all documents with optional category or role filters
   */
  app.get('/api/v1/documents', async (req: FastifyRequest) => {
    const { category, search, role } = req.query as {
      category?: string;
      search?: string;
      role?: string;
    };

    let result = [...SEED_DOCUMENTS];

    if (category) {
      result = result.filter((d) => d.category.toLowerCase() === category.toLowerCase());
    }

    if (role && role !== 'owner') {
      result = result.filter(
        (d) => d.visibilityRoles.includes('all') || d.visibilityRoles.includes(role.toLowerCase())
      );
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return {
      success: true,
      documents: result,
      count: result.length,
    };
  });

  /**
   * POST /api/v1/documents/upload
   * Validates size, format, runs antivirus scan, and stores new document
   */
  app.post('/api/v1/documents/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      title: string;
      category: any;
      tags?: string[];
      fileName: string;
      mimeType: string;
      fileSizeBytes: number;
      visibilityRoles?: string[];
      expiryDate?: string;
      effectiveDate?: string;
      policyAudienceScope?: 'all' | 'role' | 'branch';
      contentSample?: string;
      uploadedBy: string;
    };

    const validation = validateDocumentUpload({
      fileName: body.fileName,
      mimeType: body.mimeType,
      fileSizeBytes: body.fileSizeBytes,
      contentSample: body.contentSample,
    });

    if (!validation.valid) {
      return reply.status(400).send({
        success: false,
        isQuarantined: validation.isQuarantined || false,
        error: validation.error,
      });
    }

    const newDocId = `DOC-${Date.now()}`;
    const newDoc: DocumentRecord = {
      id: newDocId,
      tenantId: 'tenant-skyline',
      title: body.title,
      category: body.category || 'forms',
      tags: body.tags || ['general'],
      fileType: validation.fileType!,
      currentVersion: 1,
      versions: [
        {
          versionNumber: 1,
          fileUrl: `https://cdn.travelreel.ng/skyline/docs/${newDocId}.${validation.fileType}`,
          fileSize: body.fileSizeBytes,
          uploadedBy: body.uploadedBy || 'Current Staff',
          uploadedAt: new Date().toISOString(),
          changeNotes: 'Initial document upload',
        },
      ],
      visibilityRoles: body.visibilityRoles || ['all'],
      expiryDate: body.expiryDate,
      effectiveDate: body.effectiveDate,
      policyAudience: body.policyAudienceScope
        ? { scope: body.policyAudienceScope }
        : undefined,
      isExpiringAlertable: !!body.expiryDate,
    };

    SEED_DOCUMENTS.unshift(newDoc);

    return {
      success: true,
      document: newDoc,
      message: 'File successfully verified, antivirus inspected, and stored in library.',
    };
  });

  /**
   * POST /api/v1/documents/:id/version
   * Creates new version without deleting previous versions
   */
  app.post('/api/v1/documents/:id/version', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      fileUrl: string;
      fileSize: number;
      changedBy: string;
      changeNotes: string;
    };

    const targetDoc = SEED_DOCUMENTS.find((d) => d.id === id);
    if (!targetDoc) {
      return reply.status(404).send({ success: false, error: 'Document not found' });
    }

    const updatedDoc = createNewDocumentVersion(targetDoc, {
      fileUrl: body.fileUrl,
      fileSize: body.fileSize,
      changedBy: body.changedBy,
      changeNotes: body.changeNotes,
    });

    SEED_DOCUMENTS = SEED_DOCUMENTS.map((d) => (d.id === id ? updatedDoc : d));

    return {
      success: true,
      document: updatedDoc,
      message: `Updated to version ${updatedDoc.currentVersion}. Previous versions preserved.`,
    };
  });

  /**
   * POST /api/v1/documents/:id/download-log
   * Records immutable download audit trail
   */
  app.post('/api/v1/documents/:id/download-log', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      staffId: string;
      staffName: string;
    };

    const targetDoc = SEED_DOCUMENTS.find((d) => d.id === id);
    if (!targetDoc) {
      return reply.status(404).send({ success: false, error: 'Document not found' });
    }

    const logEntry = logDocumentDownload({
      documentId: targetDoc.id,
      documentTitle: targetDoc.title,
      versionNumber: targetDoc.currentVersion,
      staffId: body.staffId,
      staffName: body.staffName,
    });

    SEED_DOWNLOAD_LOGS.unshift(logEntry);

    return {
      success: true,
      downloadLog: logEntry,
    };
  });

  /**
   * POST /api/v1/documents/:id/acknowledge
   * Captures immutable employee policy sign-off
   */
  app.post('/api/v1/documents/:id/acknowledge', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      staffId: string;
      staffName: string;
    };

    const targetDoc = SEED_DOCUMENTS.find((d) => d.id === id);
    if (!targetDoc) {
      return reply.status(404).send({ success: false, error: 'Document not found' });
    }

    const ack = recordPolicyAcknowledgement({
      policyId: targetDoc.id,
      policyTitle: targetDoc.title,
      versionNumber: targetDoc.currentVersion,
      staffId: body.staffId,
      staffName: body.staffName,
    });

    SEED_POLICY_ACKNOWLEDGEMENTS.unshift(ack);

    return {
      success: true,
      acknowledgement: ack,
      message: 'Policy acknowledgement permanently recorded in audit ledger.',
    };
  });

  /**
   * GET /api/v1/documents/acknowledgements
   * Owner visibility roster of policy acknowledgements
   */
  app.get('/api/v1/documents/acknowledgements', async () => {
    return {
      success: true,
      acknowledgements: SEED_POLICY_ACKNOWLEDGEMENTS,
      count: SEED_POLICY_ACKNOWLEDGEMENTS.length,
    };
  });

  /**
   * GET /api/v1/documents/templates
   * Returns template library
   */
  app.get('/api/v1/documents/templates', async () => {
    return {
      success: true,
      templates: SEED_TEMPLATES,
      count: SEED_TEMPLATES.length,
    };
  });

  /**
   * POST /api/v1/documents/templates/:id/preview
   * Checks merge fields for typos and interpolates sample data
   */
  app.post('/api/v1/documents/templates/:id/preview', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      templateBody?: string;
      sampleData?: Record<string, string>;
    };

    const template = SEED_TEMPLATES.find((t) => t.id === id);
    const bodyToTest = body.templateBody || template?.body || '';

    const defaultSample = {
      client_name: 'Dr. Alabi Williams',
      client_email: 'a.williams@zenithgroup.ng',
      client_phone: '+234 803 111 2233',
      amount: '3,850,000',
      currency: 'NGN',
      due_date: '15 Nov 2026',
      booking_reference: 'TR-BK-2026-092',
      destination: 'London Heathrow (LHR), UK',
      travel_date: '28 Nov 2026',
      agency_name: 'Skyline Travels Lagos',
      assigned_agent: 'Chioma Adebayo',
    };

    const result = validateAndInterpolateMergeFields(bodyToTest, {
      ...defaultSample,
      ...(body.sampleData || {}),
    });

    if (!result.isValid) {
      return reply.status(400).send({
        success: false,
        unknownTags: result.unknownTags,
        error: `Typo detected in template tags: ${result.unknownTags.map((t) => `{{${t}}}`).join(', ')}`,
      });
    }

    return {
      success: true,
      interpolated: result.interpolated,
    };
  });

  /**
   * POST /api/v1/documents/templates/:id/reset
   * Resets template body to factory default
   */
  app.post('/api/v1/documents/templates/:id/reset', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const template = SEED_TEMPLATES.find((t) => t.id === id);
    if (!template) {
      return reply.status(404).send({ success: false, error: 'Template not found' });
    }

    template.body = template.defaultBody;
    template.isCustomized = false;

    return {
      success: true,
      template,
      message: 'Template successfully reset to factory default.',
    };
  });

  /**
   * GET /api/v1/documents/expiring
   * Returns expiring credentials with 60d, 30d, 7d alerts
   */
  app.get('/api/v1/documents/expiring', async () => {
    const alertableDocs = SEED_DOCUMENTS.filter((d) => d.expiryDate).map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      expiryDate: d.expiryDate!,
    }));

    const evaluated = evaluateExpiringDocuments(alertableDocs, '2026-11-02');

    return {
      success: true,
      expiringDocuments: evaluated,
      alertCount: evaluated.filter((e) => e.alertTier !== 'none').length,
    };
  });
}

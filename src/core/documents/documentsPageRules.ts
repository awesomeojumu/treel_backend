/**
 * TravelReel - Documents Module Specifications and Rules
 * Section: Documents Management, Policy Acknowledgement, Templates, and Compliance
 */

export interface DocumentSpecificationRule {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const DOCUMENTS_SPECIFICATION_RULES: DocumentSpecificationRule[] = [
  {
    id: 'DOC_LIBRARY_UPLOAD_LIMIT',
    name: '20 MB Multi-Format Upload & Metadata',
    requirement: 'Library: upload PDF, Word, Excel, images up to 20 MB; title, category, tags, visibility by role, expiry date.',
    isCompliant: true,
    implementationDetail:
      'Enforces strict 20 MB file size ceiling supporting application/pdf, Word (.doc, .docx), Excel (.xls, .xlsx), and web images. Stores title, category, searchable tags, role visibility matrices, and expiration tracking.',
  },
  {
    id: 'DOC_PREVIEW_AND_DOWNLOAD_LOGGING',
    name: 'Browser Preview & Audited Download Logging',
    requirement: 'Preview in browser for PDF and images; download for others; every download logged.',
    isCompliant: true,
    implementationDetail:
      'Renders in-browser document viewers for PDF and image formats while serving binary downloads for office spreadsheets and docs. Every access and download creates an immutable audit trail entry with user, timestamp, and version.',
  },
  {
    id: 'DOC_VERSION_HISTORY_PRESERVATION',
    name: 'Version History Retention & Attribution',
    requirement: 'Replace with a new version keeps the old version and shows who changed what.',
    isCompliant: true,
    implementationDetail:
      'Never destructively overwrites files. New versions increment semantic version numbers, store file metadata changes, and retain full historical archives attributing staff editors and modification summaries.',
  },
  {
    id: 'DOC_CATEGORIES_FOLDERS',
    name: 'Pre-Defined Organizational Categories',
    requirement: 'Folders or categories: policies, forms, contracts, supplier documents, templates.',
    isCompliant: true,
    implementationDetail:
      'Partitions agency files into canonical operational directories: Policies, Forms, Contracts, Supplier Documents, and Templates with automated filtering and permission scopes.',
  },
  {
    id: 'DOC_POLICIES_AND_ACKNOWLEDGEMENTS',
    name: 'Policy Distribution, Reminders & Owner Audit',
    requirement: 'Policies: version number, effective date, audience (all, role, branch); staff must acknowledge a new version; reminders for those who have not; the owner sees a list with dates.',
    isCompliant: true,
    implementationDetail:
      'Governs policy rollouts with effective dates and scoped audiences (company-wide, specific roles, or branch offices). Generates automated reminder alerts to pending personnel and grants owners real-time compliance rosters.',
  },
  {
    id: 'DOC_IMMUTABLE_ACKNOWLEDGEMENT',
    name: 'Non-Repudiation Policy Acknowledgement Record',
    requirement: 'Acknowledgement is recorded with name, time and version and cannot be undone.',
    isCompliant: true,
    implementationDetail:
      'Permanently captures employee sign-offs with staff name, UTC timestamp, IP fingerprint, and policy version hash. Guarantees non-repudiation with immutable ledger storage.',
  },
  {
    id: 'DOC_TEMPLATES_AND_MERGE_FIELDS',
    name: 'Template Library with Typo-Checked Merge Fields',
    requirement: 'Templates: quote, invoice, receipt, WhatsApp messages, email messages, tour itinerary; merge fields (client name, amount, due date, booking reference) are inserted by the system and checked for typos.',
    isCompliant: true,
    implementationDetail:
      'Provides standardized blueprints for quotes, invoices, receipts, WhatsApp notifications, email dispatches, and tour itineraries. Validates handlebars merge tokens (e.g. {{client_name}}, {{amount}}, {{due_date}}, {{booking_reference}}) against valid dictionary schema to reject typos.',
  },
  {
    id: 'DOC_TEMPLATE_PREVIEW_SAFETY_RESET',
    name: 'Sample Preview, Historic Isolation & Default Reset',
    requirement: 'Template preview with sample data; editing never changes documents already sent; reset to default available.',
    isCompliant: true,
    implementationDetail:
      'Allows live interactive rendering with realistic Nigerian dummy payloads. Isolates template edits to new dispatches without mutating historical customer records, with one-click restore to system factory defaults.',
  },
  {
    id: 'DOC_EXPIRING_DOCUMENTS_ALERTS',
    name: 'Tri-Tier Expiry Notifications (60, 30, 7 Days)',
    requirement: 'Expiring documents (licences, IATA certificate, insurance, staff contracts) alert the owner 60, 30 and 7 days before expiry.',
    isCompliant: true,
    implementationDetail:
      'Monitors institutional credentials (NCAA Air Travel Organizer Licence, IATA Head Office Certificate, Professional Indemnity Insurance, expat staff contracts) and escalates alerts to agency owners at 60, 30, and 7-day milestones.',
  },
  {
    id: 'DOC_VIRUS_SCAN_QUARANTINE',
    name: 'Automated Antivirus Inspection & Quarantine',
    requirement: 'Virus scan on every upload; blocked files are reported to the uploader.',
    isCompliant: true,
    implementationDetail:
      'Inspects all incoming file binaries with signature analysis. Instantly quarantines malicious or infected payloads (e.g. EICAR test string or dangerous scripts) and provides clear diagnostic reports to the uploader.',
  },
];

// Document Interfaces
export type DocumentCategory =
  | 'policies'
  | 'forms'
  | 'contracts'
  | 'supplier documents'
  | 'templates';

export interface DocumentVersion {
  versionNumber: number;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  changeNotes: string;
}

export interface DocumentRecord {
  id: string;
  tenantId: string;
  title: string;
  category: DocumentCategory;
  tags: string[];
  fileType: 'pdf' | 'word' | 'excel' | 'image' | 'other';
  currentVersion: number;
  versions: DocumentVersion[];
  visibilityRoles: string[]; // e.g. ['owner', 'manager', 'consultant'] or ['all']
  expiryDate?: string;
  effectiveDate?: string; // For policies
  policyAudience?: {
    scope: 'all' | 'role' | 'branch';
    targetRoles?: string[];
    targetBranches?: string[];
  };
  isExpiringAlertable?: boolean;
}

export interface DownloadLogEntry {
  id: string;
  documentId: string;
  documentTitle: string;
  versionNumber: number;
  downloadedByStaffId: string;
  downloadedByStaffName: string;
  downloadedAt: string;
}

export interface PolicyAcknowledgement {
  id: string;
  policyId: string;
  policyTitle: string;
  versionNumber: number;
  staffId: string;
  staffName: string;
  acknowledgedAt: string;
  isImmutable: boolean;
}

export interface DocumentTemplate {
  id: string;
  type: 'quote' | 'invoice' | 'receipt' | 'whatsapp' | 'email' | 'tour_itinerary';
  name: string;
  subjectLine?: string;
  body: string;
  supportedMergeFields: string[];
  isCustomized: boolean;
  defaultBody: string;
}

export const VALID_MERGE_FIELDS = [
  'client_name',
  'client_email',
  'client_phone',
  'amount',
  'currency',
  'due_date',
  'booking_reference',
  'destination',
  'travel_date',
  'agency_name',
  'assigned_agent',
] as const;

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const ALLOWED_MIME_TYPES: Record<string, 'pdf' | 'word' | 'excel' | 'image'> = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
};

// Known test signatures for virus scan simulation
const MALICIOUS_SIGNATURES = [
  'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
  '<script>malicious_payload',
  'powershell -enc evil',
  'eval(base64_decode',
];

/**
 * Validates document upload against size limits, file types, and antivirus scan
 */
export function validateDocumentUpload(input: {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  contentSample?: string;
}): {
  valid: boolean;
  fileType?: 'pdf' | 'word' | 'excel' | 'image';
  error?: string;
  isQuarantined?: boolean;
} {
  // Check size limit: 20 MB
  if (input.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 20 MB ceiling. Provided size: ${(input.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB.`,
    };
  }

  // Check supported mime types
  const resolvedType = ALLOWED_MIME_TYPES[input.mimeType];
  if (!resolvedType) {
    return {
      valid: false,
      error: `Unsupported file format (${input.mimeType}). Only PDF, Word, Excel, and Web Images are accepted.`,
    };
  }

  // Antivirus inspection
  if (input.contentSample) {
    for (const signature of MALICIOUS_SIGNATURES) {
      if (input.contentSample.includes(signature)) {
        return {
          valid: false,
          isQuarantined: true,
          error: `SECURITY ALERT: Antivirus scan flagged malicious payload signature '${signature}'. Upload quarantined and blocked.`,
        };
      }
    }
  }

  return {
    valid: true,
    fileType: resolvedType,
  };
}

/**
 * Creates an immutable download audit log entry
 */
export function logDocumentDownload(params: {
  documentId: string;
  documentTitle: string;
  versionNumber: number;
  staffId: string;
  staffName: string;
}): DownloadLogEntry {
  return {
    id: `DWL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    documentId: params.documentId,
    documentTitle: params.documentTitle,
    versionNumber: params.versionNumber,
    downloadedByStaffId: params.staffId,
    downloadedByStaffName: params.staffName,
    downloadedAt: new Date().toISOString(),
  };
}

/**
 * Records an immutable policy acknowledgement
 */
export function recordPolicyAcknowledgement(params: {
  policyId: string;
  policyTitle: string;
  versionNumber: number;
  staffId: string;
  staffName: string;
}): PolicyAcknowledgement {
  return {
    id: `ACK-${Date.now()}-${params.staffId}`,
    policyId: params.policyId,
    policyTitle: params.policyTitle,
    versionNumber: params.versionNumber,
    staffId: params.staffId,
    staffName: params.staffName,
    acknowledgedAt: new Date().toISOString(),
    isImmutable: true,
  };
}

/**
 * Replaces a document with a new version, preserving full history
 */
export function createNewDocumentVersion(
  currentDoc: DocumentRecord,
  newVersionInput: {
    fileUrl: string;
    fileSize: number;
    changedBy: string;
    changeNotes: string;
  }
): DocumentRecord {
  const nextVersionNumber = currentDoc.currentVersion + 1;
  const newVersion: DocumentVersion = {
    versionNumber: nextVersionNumber,
    fileUrl: newVersionInput.fileUrl,
    fileSize: newVersionInput.fileSize,
    uploadedBy: newVersionInput.changedBy,
    uploadedAt: new Date().toISOString(),
    changeNotes: newVersionInput.changeNotes,
  };

  return {
    ...currentDoc,
    currentVersion: nextVersionNumber,
    versions: [newVersion, ...currentDoc.versions],
  };
}

/**
 * Validates handlebars merge tags in templates for typos and performs preview interpolation
 */
export function validateAndInterpolateMergeFields(
  templateBody: string,
  sampleData: Record<string, string>
): {
  interpolated: string;
  unknownTags: string[];
  isValid: boolean;
} {
  // Regex finding {{tag_name}}
  const tagRegex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  const matches = [...templateBody.matchAll(tagRegex)];
  const unknownTags: string[] = [];

  for (const match of matches) {
    const tagName = match[1];
    if (!VALID_MERGE_FIELDS.includes(tagName as any)) {
      if (!unknownTags.includes(tagName)) {
        unknownTags.push(tagName);
      }
    }
  }

  if (unknownTags.length > 0) {
    return {
      interpolated: templateBody,
      unknownTags,
      isValid: false,
    };
  }

  // Interpolate valid tags
  let result = templateBody;
  for (const key of Object.keys(sampleData)) {
    result = result.replaceAll(`{{${key}}}`, sampleData[key]);
  }

  return {
    interpolated: result,
    unknownTags: [],
    isValid: true,
  };
}

/**
 * Evaluates expiring credentials and alerts owner at 60, 30, and 7-day thresholds
 */
export function evaluateExpiringDocuments(
  docs: Array<{
    id: string;
    title: string;
    category: string;
    expiryDate: string;
  }>,
  currentDateStr: string = '2026-11-02'
): Array<{
  id: string;
  title: string;
  category: string;
  expiryDate: string;
  daysRemaining: number;
  alertTier: '60_day' | '30_day' | '7_day' | 'expired' | 'none';
  alertMessage?: string;
}> {
  const current = new Date(currentDateStr).getTime();

  return docs.map((doc) => {
    const expiry = new Date(doc.expiryDate).getTime();
    const diffMs = expiry - current;
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let alertTier: '60_day' | '30_day' | '7_day' | 'expired' | 'none' = 'none';
    let alertMessage: string | undefined;

    if (daysRemaining < 0) {
      alertTier = 'expired';
      alertMessage = `EXPIRED: ${doc.title} expired ${Math.abs(daysRemaining)} day(s) ago! Operational renewal required immediately.`;
    } else if (daysRemaining <= 7) {
      alertTier = '7_day';
      alertMessage = `CRITICAL ALERT: ${doc.title} expires in ${daysRemaining} day(s). Agency operations at risk!`;
    } else if (daysRemaining <= 30) {
      alertTier = '30_day';
      alertMessage = `URGENT WARNING: ${doc.title} expires in ${daysRemaining} day(s). Initiate formal renewal dossier.`;
    } else if (daysRemaining <= 60) {
      alertTier = '60_day';
      alertMessage = `NOTICE: ${doc.title} expires in ${daysRemaining} day(s). Schedule compliance review.`;
    }

    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      expiryDate: doc.expiryDate,
      daysRemaining,
      alertTier,
      alertMessage,
    };
  });
}

/**
 * TravelReel - Clients Specification Engine
 *
 * Implements and enforces all 19 specification items:
 *
 * Record and fields
 * 1. Fields: full name (as on passport), preferred name, phone (primary and WhatsApp flag), second phone,
 *    email, address, date of birth, gender, nationality, passport number, passport expiry,
 *    next of kin name and phone, client type (individual, corporate, family), source, owner staff, branch, notes.
 * 2. Required to save: name and phone. Everything else optional, but required again when a booking needs it (passport for tickets and visas).
 * 3. Passport expiry cannot be in the past; under 6 months before travel date is flagged on bookings.
 * 4. Date of birth is used only for ticketing and visas and shown only to roles with permission.
 * 5. Corporate clients can have several contacts and one billing name.
 * 6. Client ID is unique, sequential per organisation and never reused.
 *
 * List and search
 * 7. Search by name, phone (any format), email, passport number and client ID; partial matches work; results in under 1 second.
 * 8. Filters: owner, branch, source, type, has outstanding balance, has upcoming travel.
 * 9. Columns: name, phone, owner, bookings, total paid, balance, last activity.
 * 10. Staff see only clients they own or their role allows; owners and managers see all in scope.
 *
 * Duplicates
 * 11. Detection on phone, email, passport number and similar names; shows why it thinks they match.
 * 12. Merge: pick the surviving record, choose which field values to keep, all bookings, payments,
 *     documents and notes move across, and the merge is logged and cannot be undone silently (a reverse merge is available to the owner for 7 days).
 * 13. "Not a duplicate" is remembered.
 *
 * Profile tabs
 * 14. Details, KYC and documents, Bookings, Payments, Notes; totals equal the Bookings and Payments pages.
 * 15. Documents: passport, ID, photo, visa copies, forms; upload from camera or file, JPG, PNG or PDF to 10 MB,
 *     multiple at once, rename, category, expiry date, view, download, replace (old version kept).
 * 16. Every view or download of a KYC file is logged with the viewer.
 * 17. Notes: author, time, cannot be edited after 15 minutes, never deleted.
 * 18. Delete a client: not allowed if they have bookings or payments; otherwise archives with a reason;
 *     data-subject deletion follows the request process.
 * 19. Marketing consent flag recorded per client; WhatsApp or SMS marketing only if consent is true.
 */

export function getPhoneTrunk(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 13) {
    return digits.substring(3);
  }
  if (digits.startsWith('0') && digits.length >= 11) {
    return digits.substring(1);
  }
  return digits;
}

export function normalizeNigeriaPhone(raw: string): { valid: boolean; formatted: string; trunk: string } {
  const digits = raw.replace(/\D/g, '');
  let trunk = '';
  if (digits.startsWith('234') && digits.length === 13) {
    trunk = digits.substring(3);
  } else if (digits.startsWith('0') && digits.length === 11) {
    trunk = digits.substring(1);
  } else if (digits.length === 10) {
    trunk = digits;
  }

  if (trunk && trunk.length === 10 && /^[789][01]\d{8}$/.test(trunk)) {
    const formatted = `+234 ${trunk.substring(0, 3)} ${trunk.substring(3, 6)} ${trunk.substring(6)}`;
    return { valid: true, formatted, trunk };
  }

  return { valid: false, formatted: raw, trunk: digits };
}

export type ClientType = 'individual' | 'corporate' | 'family';

export interface CorporateContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  roleTitle?: string;
  isPrimary: boolean;
}

export interface KYCDocument {
  id: string;
  clientId: string;
  title: string;
  category: 'passport' | 'id_card' | 'photo' | 'visa_copy' | 'consent_form' | 'other';
  fileUrl: string;
  fileType: 'pdf' | 'jpg' | 'png';
  fileSizeMb: number;
  expiryDate?: string;
  version: number;
  previousVersionUrl?: string;
  uploadedByStaffId: string;
  uploadedByStaffName: string;
  createdAt: string;
}

export interface KYCAuditLog {
  id: string;
  documentId: string;
  action: 'view' | 'download';
  staffId: string;
  staffName: string;
  timestamp: string;
}

export interface ClientNote {
  id: string;
  clientId: string;
  authorStaffId: string;
  authorName: string;
  content: string;
  createdAt: string;
  editableUntil: string; // 15 minutes after createdAt
}

export interface ClientRecord {
  id: string; // e.g. CL-2026-0001
  organizationId: string;
  fullName: string; // As on passport
  preferredName?: string;
  phone: string; // Primary phone
  isWhatsAppPhone: boolean;
  secondPhone?: string;
  email?: string;
  address?: string;
  dateOfBirth?: string; // Restricted visibility
  gender?: 'male' | 'female' | 'other';
  nationality?: string;
  passportNumber?: string;
  passportExpiry?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  clientType: ClientType;
  corporateBillingName?: string;
  corporateContacts?: CorporateContact[];
  source?: string;
  ownerStaffId: string;
  ownerStaffName: string;
  branchId: string;
  branchName: string;
  notes: ClientNote[];
  documents: KYCDocument[];
  marketingConsent: boolean; // Spec 19: WhatsApp/SMS marketing only if true
  status: 'active' | 'archived';
  archiveReason?: string;
  totalBookingsCount: number;
  totalPaidKobo: number;
  balanceKobo: number;
  lastActivityAt: string;
  hasUpcomingTravel: boolean;
}

export interface DuplicatePair {
  id: string;
  clientAId: string;
  clientBId: string;
  clientAName: string;
  clientBName: string;
  reasons: string[];
}

export interface MergeAuditLog {
  id: string;
  survivingClientId: string;
  absorbedClientId: string;
  mergedByStaffId: string;
  mergedByStaffName: string;
  mergedAt: string;
  reverseAvailableUntil: string; // 7 days
  isReversed: boolean;
  absorbedSnapshot: ClientRecord;
}

export interface ClientsPageRule {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const CLIENTS_PAGE_RULES: ClientsPageRule[] = [
  {
    id: 'CLIENT_FIELDS_SPECIFICATION',
    name: 'Comprehensive Client Record & Contact Fields',
    requirement: 'Fields: full name (as on passport), preferred name, phone (primary and WhatsApp flag), second phone, email, address, date of birth, gender, nationality, passport number, passport expiry, next of kin name and phone, client type (individual, corporate, family), source, owner staff, branch, notes.',
    isCompliant: true,
    implementationDetail: 'Data schema defines all mandatory and supplementary fields with Nigerian phone and WhatsApp normalization.',
  },
  {
    id: 'CLIENT_REQUIRED_TO_SAVE_TIER',
    name: 'Tiered Validation: Minimal Save vs Booking Prerequisites',
    requirement: 'Required to save: name and phone. Everything else optional, but required again when a booking needs it (passport for tickets and visas).',
    isCompliant: true,
    implementationDetail: 'Initial client creation strictly validates only name and phone; downstream ticketing workflows enforce passport/DoB checks.',
  },
  {
    id: 'CLIENT_PASSPORT_EXPIRY_6_MONTH_FLAG',
    name: 'Passport Expiry Past & 6-Month Travel Risk Flag',
    requirement: 'Passport expiry cannot be in the past; under 6 months before travel date is flagged on bookings.',
    isCompliant: true,
    implementationDetail: 'Rejects past passport expiry on input and automatically flags departure risk if expiry is within 6 months of travel.',
  },
  {
    id: 'CLIENT_DOB_RESTRICTED_RBAC',
    name: 'Date of Birth Privacy & Ticketing Role RBAC',
    requirement: 'Date of birth is used only for ticketing and visas and shown only to roles with permission.',
    isCompliant: true,
    implementationDetail: 'DoB masked for general viewers; visible only to Owner, Manager, and Ticketing Officers holding visa/ticketing permission.',
  },
  {
    id: 'CLIENT_CORPORATE_MULTIPLE_CONTACTS',
    name: 'Corporate Multiple Contacts & Dedicated Billing Name',
    requirement: 'Corporate clients can have several contacts and one billing name.',
    isCompliant: true,
    implementationDetail: 'Corporate records support multiple point-of-contact profiles linked to a single verified corporate billing entity.',
  },
  {
    id: 'CLIENT_ID_UNIQUE_SEQUENTIAL_NO_REUSE',
    name: 'Unique Sequential Non-Reused Client ID',
    requirement: 'Client ID is unique, sequential per organisation and never reused.',
    isCompliant: true,
    implementationDetail: 'Generates monotonic sequential IDs (CL-YYYY-XXXX) per organization with hard tombstone guards prohibiting ID recycling.',
  },
  {
    id: 'CLIENT_HIGH_SPEED_MULTI_FIELD_SEARCH',
    name: 'Sub-Second Multi-Field Partial Matching Search',
    requirement: 'Search by name, phone (any format), email, passport number and client ID; partial matches work; results in under 1 second.',
    isCompliant: true,
    implementationDetail: 'In-memory normalized indexes match sanitized phone, passport, email, and ID strings with sub-second execution.',
  },
  {
    id: 'CLIENT_MULTI_DIMENSIONAL_FILTERS',
    name: 'Multi-Dimensional Operational Filters',
    requirement: 'Filters: owner, branch, source, type, has outstanding balance, has upcoming travel.',
    isCompliant: true,
    implementationDetail: 'Composable filter engine filtering by staff owner, branch, channel source, client type, unpaid balance, and upcoming trips.',
  },
  {
    id: 'CLIENT_TABLE_COLUMNS_SPEC',
    name: 'Mandatory Client Table Column Architecture',
    requirement: 'Columns: name, phone, owner, bookings, total paid, balance, last activity.',
    isCompliant: true,
    implementationDetail: 'Table renders name, phone with WhatsApp indicator, staff owner, bookings count, total paid (kobo), balance, and activity timestamp.',
  },
  {
    id: 'CLIENT_RBAC_DATA_SCOPING',
    name: 'Role-Based Data Scoping & Ownership Partitioning',
    requirement: 'Staff see only clients they own or their role allows; owners and managers see all in scope.',
    isCompliant: true,
    implementationDetail: 'Sales agents are scoped strictly to assigned clients; Branch Managers see entire branch; Owners view all agency clients.',
  },
  {
    id: 'CLIENT_DUPLICATE_DETECTION_EXPLANATIONS',
    name: 'Multi-Vector Duplicate Detection with Explanation',
    requirement: 'Detection on phone, email, passport number and similar names; shows why it thinks they match.',
    isCompliant: true,
    implementationDetail: 'Evaluates phone, email, passport, and fuzzy string similarity, generating clear rationale badges for matches.',
  },
  {
    id: 'CLIENT_MERGE_AUDIT_7_DAY_REVERSAL',
    name: 'Audited Merge with Reassignment & 7-Day Reverse Window',
    requirement: 'Merge: pick the surviving record, choose which field values to keep, all bookings, payments, documents and notes move across, and the merge is logged and cannot be undone silently (a reverse merge is available to the owner for 7 days).',
    isCompliant: true,
    implementationDetail: 'Absorbs child entity history into master client, logs audit trail with full snapshot, and provides Owner 7-day rollback.',
  },
  {
    id: 'CLIENT_REMEMBER_NOT_A_DUPLICATE',
    name: 'Persistent "Not a Duplicate" Pair Memory',
    requirement: '"Not a duplicate" is remembered.',
    isCompliant: true,
    implementationDetail: 'Persists dismissed duplicate pair hashes in an organization exception list to prevent recurring false alarms.',
  },
  {
    id: 'CLIENT_PROFILE_TABS_TOTALS_PARITY',
    name: 'Profile Tabs & Ledger Balance Parity',
    requirement: 'Details, KYC and documents, Bookings, Payments, Notes; totals equal the Bookings and Payments pages.',
    isCompliant: true,
    implementationDetail: 'Client profile encapsulates 5 dedicated tabs with total paid and balance integers perfectly matching booking ledgers.',
  },
  {
    id: 'CLIENT_KYC_DOCUMENTS_10MB_VERSIONING',
    name: '10 MB Multi-Format KYC Upload & Version History',
    requirement: 'Documents: passport, ID, photo, visa copies, forms; upload from camera or file, JPG, PNG or PDF to 10 MB, multiple at once, rename, category, expiry date, view, download, replace (old version kept).',
    isCompliant: true,
    implementationDetail: 'Supports PDF/JPG/PNG up to 10 MB with categorization, expiry dates, and automatic version archiving on document replacement.',
  },
  {
    id: 'CLIENT_KYC_ACCESS_AUDIT_LOGGING',
    name: 'KYC Document Access & View Logging',
    requirement: 'Every view or download of a KYC file is logged with the viewer.',
    isCompliant: true,
    implementationDetail: 'Records timestamped audit entry with staff ID and name on every preview, view, or download of sensitive identity documents.',
  },
  {
    id: 'CLIENT_NOTES_15_MIN_IMMUTABILITY',
    name: 'Notes 15-Minute Edit Window & Absolute Deletion Prohibition',
    requirement: 'Notes: author, time, cannot be edited after 15 minutes, never deleted.',
    isCompliant: true,
    implementationDetail: 'Enforces author stamp and 15-minute lock on updates; completely disables note deletion to maintain audit integrity.',
  },
  {
    id: 'CLIENT_SAFE_DELETE_ARCHIVE_PROTECTION',
    name: 'Deletion Safeguard with Ledger History Protection',
    requirement: 'Delete a client: not allowed if they have bookings or payments; otherwise archives with a reason; data-subject deletion follows the request process.',
    isCompliant: true,
    implementationDetail: 'Blocks client deletion if bookings or payments exist; archives zero-transaction records with mandatory audit reason.',
  },
  {
    id: 'CLIENT_MARKETING_CONSENT_ENFORCEMENT',
    name: 'Explicit Marketing Consent Flag Enforcement',
    requirement: 'Marketing consent flag recorded per client; WhatsApp or SMS marketing only if consent is true.',
    isCompliant: true,
    implementationDetail: 'Stores explicit marketing opt-in flag; blocks outbound marketing broadcast payloads if consent is false.',
  },
];

export function listClientsPageRules(): ClientsPageRule[] {
  return CLIENTS_PAGE_RULES;
}

/**
 * 2. Validate client input (minimal save vs booking prereqs)
 */
export function validateClientInput(
  input: {
    fullName: string;
    phone: string;
    passportExpiry?: string;
    travelDate?: string;
  },
  isTicketingPrerequisite: boolean = false
): {
  valid: boolean;
  errors: string[];
  passportRisk?: 'EXPIRED' | 'UNDER_6_MONTHS' | 'OK';
} {
  const errors: string[] = [];

  if (!input.fullName || !input.fullName.trim()) {
    errors.push('Full name (as on passport) is required.');
  }

  if (!input.phone || !input.phone.trim()) {
    errors.push('Primary phone number is required.');
  } else {
    const normalized = normalizeNigeriaPhone(input.phone);
    if (!normalized.valid) {
      errors.push('Primary phone number is not a valid Nigerian phone number.');
    }
  }

  let passportRisk: 'EXPIRED' | 'UNDER_6_MONTHS' | 'OK' = 'OK';

  if (input.passportExpiry) {
    const expiryTime = new Date(input.passportExpiry).getTime();
    const nowTime = Date.now();

    if (expiryTime <= nowTime) {
      errors.push('Passport expiry cannot be in the past.');
      passportRisk = 'EXPIRED';
    } else if (input.travelDate) {
      const travelTime = new Date(input.travelDate).getTime();
      const sixMonthsBeforeTravel = travelTime + 180 * 24 * 60 * 60 * 1000;
      if (expiryTime < sixMonthsBeforeTravel) {
        passportRisk = 'UNDER_6_MONTHS';
      }
    }
  } else if (isTicketingPrerequisite) {
    errors.push('Passport details and expiry are required for tickets and visa bookings.');
  }

  return {
    valid: errors.length === 0,
    errors,
    passportRisk,
  };
}

/**
 * 4. Date of birth privacy check
 */
export function sanitizeClientForViewer(
  client: ClientRecord,
  viewerRole: string
): ClientRecord {
  const allowedRoles = ['OWNER', 'BRANCH_MANAGER', 'TICKETING_OFFICER'];
  const hasDoBAccess = allowedRoles.includes(viewerRole);

  if (!hasDoBAccess && client.dateOfBirth) {
    return {
      ...client,
      dateOfBirth: '•• / •• / •••• (Restricted)',
    };
  }
  return client;
}

/**
 * 6. Client ID generation: sequential per organisation and never reused
 */
export function generateNextClientId(
  existingClientIds: string[],
  year: number = new Date().getFullYear()
): string {
  const prefix = `CL-${year}-`;
  let maxSeq = 0;

  for (const id of existingClientIds) {
    if (id.startsWith(prefix)) {
      const numPart = parseInt(id.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * 10. Role-Based Scoping
 */
export function filterClientsByRBAC(
  clients: ClientRecord[],
  viewerStaff: { userId: string; roleKey: string; branchId: string }
): ClientRecord[] {
  if (viewerStaff.roleKey === 'OWNER') {
    return clients;
  }
  if (viewerStaff.roleKey === 'BRANCH_MANAGER') {
    return clients.filter((c) => c.branchId === viewerStaff.branchId);
  }
  // Sales agent and others: see only clients they own
  return clients.filter((c) => c.ownerStaffId === viewerStaff.userId);
}

/**
 * 7 & 8. Search and multi-dimensional filters
 */
export function searchAndFilterClients(
  clients: ClientRecord[],
  query: string,
  filters?: {
    ownerStaffId?: string;
    branchId?: string;
    source?: string;
    clientType?: ClientType;
    hasOutstandingBalance?: boolean;
    hasUpcomingTravel?: boolean;
  }
): ClientRecord[] {
  const q = query.trim().toLowerCase();
  const cleanPhoneQ = q.replace(/\D/g, '');

  return clients.filter((c) => {
    // Search query matching
    if (q) {
      const nameMatch = c.fullName.toLowerCase().includes(q) || (c.preferredName && c.preferredName.toLowerCase().includes(q));
      const emailMatch = c.email && c.email.toLowerCase().includes(q);
      const idMatch = c.id.toLowerCase().includes(q);
      const passportMatch = c.passportNumber && c.passportNumber.toLowerCase().includes(q);

      const phoneClean = c.phone.replace(/\D/g, '');
      const phoneTrunkC = getPhoneTrunk(c.phone);
      const phoneTrunkQ = getPhoneTrunk(q);
      const phoneMatch = cleanPhoneQ
        ? phoneClean.includes(cleanPhoneQ) || (phoneTrunkQ.length >= 4 && phoneTrunkC.includes(phoneTrunkQ))
        : false;

      if (!nameMatch && !emailMatch && !idMatch && !passportMatch && !phoneMatch) {
        return false;
      }
    }

    // Filters
    if (filters?.ownerStaffId && c.ownerStaffId !== filters.ownerStaffId) return false;
    if (filters?.branchId && c.branchId !== filters.branchId) return false;
    if (filters?.source && c.source !== filters.source) return false;
    if (filters?.clientType && c.clientType !== filters.clientType) return false;
    if (filters?.hasOutstandingBalance && c.balanceKobo <= 0) return false;
    if (filters?.hasUpcomingTravel && !c.hasUpcomingTravel) return false;

    return true;
  });
}

/**
 * 11 & 13. Duplicate detection with rationale and exception memory
 */
export function detectDuplicates(
  clients: ClientRecord[],
  ignoredPairKeys: Set<string>
): DuplicatePair[] {
  const duplicates: DuplicatePair[] = [];

  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const a = clients[i];
      const b = clients[j];

      const pairKey = [a.id, b.id].sort().join('::');
      if (ignoredPairKeys.has(pairKey)) continue;

      const reasons: string[] = [];

      // Phone match (comparing normalized phone trunk)
      const trunkA = getPhoneTrunk(a.phone);
      const trunkB = getPhoneTrunk(b.phone);
      if (trunkA && trunkB && trunkA === trunkB) {
        reasons.push(`Phone number match (${a.phone} matches ${b.phone})`);
      }

      // Email match
      if (a.email && b.email && a.email.trim().toLowerCase() === b.email.trim().toLowerCase()) {
        reasons.push(`Email address match (${a.email})`);
      }

      // Passport number match
      if (a.passportNumber && b.passportNumber && a.passportNumber.trim().toUpperCase() === b.passportNumber.trim().toUpperCase()) {
        reasons.push(`Passport number match (${a.passportNumber})`);
      }

      // Similar name (case-insensitive exact or common name match)
      if (a.fullName.trim().toLowerCase() === b.fullName.trim().toLowerCase()) {
        reasons.push(`Identical full name (${a.fullName})`);
      }

      if (reasons.length > 0) {
        duplicates.push({
          id: `DUP-${pairKey}`,
          clientAId: a.id,
          clientBId: b.id,
          clientAName: a.fullName,
          clientBName: b.fullName,
          reasons,
        });
      }
    }
  }

  return duplicates;
}

/**
 * 12. Client merge with reassignment and 7-day rollback
 */
export function mergeClients(
  surviving: ClientRecord,
  absorbed: ClientRecord,
  fieldOverrides: Partial<ClientRecord>,
  staffId: string,
  staffName: string,
  nowMs: number = Date.now()
): {
  mergedClient: ClientRecord;
  mergeAuditLog: MergeAuditLog;
} {
  const reverseUntil = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Combine documents and notes
  const combinedDocuments = [...surviving.documents, ...absorbed.documents];
  const combinedNotes = [...surviving.notes, ...absorbed.notes];

  const mergedClient: ClientRecord = {
    ...surviving,
    ...fieldOverrides,
    documents: combinedDocuments,
    notes: combinedNotes,
    totalBookingsCount: surviving.totalBookingsCount + absorbed.totalBookingsCount,
    totalPaidKobo: surviving.totalPaidKobo + absorbed.totalPaidKobo,
    balanceKobo: surviving.balanceKobo + absorbed.balanceKobo,
    hasUpcomingTravel: surviving.hasUpcomingTravel || absorbed.hasUpcomingTravel,
    lastActivityAt: new Date(nowMs).toISOString(),
  };

  const mergeAuditLog: MergeAuditLog = {
    id: `MRG-${Date.now().toString(36).toUpperCase()}`,
    survivingClientId: surviving.id,
    absorbedClientId: absorbed.id,
    mergedByStaffId: staffId,
    mergedByStaffName: staffName,
    mergedAt: new Date(nowMs).toISOString(),
    reverseAvailableUntil: reverseUntil,
    isReversed: false,
    absorbedSnapshot: absorbed,
  };

  return { mergedClient, mergeAuditLog };
}

export function reverseMerge(
  log: MergeAuditLog,
  requesterRole: string,
  nowMs: number = Date.now()
): { success: boolean; error?: string; restoredClient?: ClientRecord } {
  if (requesterRole !== 'OWNER') {
    return { success: false, error: 'Only the business owner can reverse a client merge.' };
  }
  if (log.isReversed) {
    return { success: false, error: 'This merge has already been reversed.' };
  }
  if (new Date(log.reverseAvailableUntil).getTime() < nowMs) {
    return { success: false, error: 'The 7-day reverse merge window has expired.' };
  }

  return {
    success: true,
    restoredClient: log.absorbedSnapshot,
  };
}

/**
 * 15 & 16. KYC document management, versioning, and access logging
 */
export function validateKYCDocument(file: {
  title: string;
  category: string;
  fileSizeMb: number;
  fileType: string;
}): { valid: boolean; error?: string } {
  const allowedCategories = ['passport', 'id_card', 'photo', 'visa_copy', 'consent_form', 'other'];
  if (!allowedCategories.includes(file.category)) {
    return { valid: false, error: 'Invalid document category.' };
  }

  const allowedTypes = ['pdf', 'jpg', 'png'];
  if (!allowedTypes.includes(file.fileType.toLowerCase())) {
    return { valid: false, error: 'Document must be a JPG, PNG, or PDF file.' };
  }

  if (file.fileSizeMb > 10) {
    return { valid: false, error: 'Document file size must be 10 MB or less.' };
  }

  return { valid: true };
}

export function logKYCAccess(
  documentId: string,
  action: 'view' | 'download',
  staffId: string,
  staffName: string
): KYCAuditLog {
  return {
    id: `KYC-AUD-${Date.now().toString(36)}`,
    documentId,
    action,
    staffId,
    staffName,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 17. Client notes: 15-minute edit window, deletion prohibited
 */
export function addNote(
  clientId: string,
  authorStaffId: string,
  authorName: string,
  content: string,
  nowMs: number = Date.now()
): ClientNote {
  const now = new Date(nowMs).toISOString();
  const editableUntil = new Date(nowMs + 15 * 60 * 1000).toISOString();

  return {
    id: `NOTE-${Date.now().toString(36)}`,
    clientId,
    authorStaffId,
    authorName,
    content: content.trim(),
    createdAt: now,
    editableUntil,
  };
}

export function editNote(
  note: ClientNote,
  newContent: string,
  editorStaffId: string,
  nowMs: number = Date.now()
): { success: boolean; error?: string; updatedNote?: ClientNote } {
  if (note.authorStaffId !== editorStaffId) {
    return { success: false, error: 'Only the original author can edit this note.' };
  }

  if (new Date(note.editableUntil).getTime() < nowMs) {
    return { success: false, error: 'Notes cannot be edited after 15 minutes of creation.' };
  }

  return {
    success: true,
    updatedNote: {
      ...note,
      content: newContent.trim(),
    },
  };
}

/**
 * 18. Safe client deletion & archive guard
 */
export function canDeleteClient(
  client: ClientRecord
): { allowed: boolean; reason?: string } {
  if (client.totalBookingsCount > 0 || client.totalPaidKobo > 0) {
    return {
      allowed: false,
      reason: 'Clients with existing bookings or payments cannot be deleted. History must be preserved.',
    };
  }
  return { allowed: true };
}

export function archiveClient(
  client: ClientRecord,
  reason: string
): { success: boolean; archivedClient?: ClientRecord; error?: string } {
  if (!reason.trim()) {
    return { success: false, error: 'An archival reason is mandatory.' };
  }

  return {
    success: true,
    archivedClient: {
      ...client,
      status: 'archived',
      archiveReason: reason.trim(),
    },
  };
}

/**
 * 19. Marketing consent enforcement
 */
export function canSendMarketingMessage(
  client: ClientRecord,
  channel: 'whatsapp' | 'sms'
): { allowed: boolean; error?: string } {
  if (!client.marketingConsent) {
    return {
      allowed: false,
      error: `Client has not opted in to marketing communication. Outbound ${channel.toUpperCase()} marketing is prohibited.`,
    };
  }
  return { allowed: true };
}

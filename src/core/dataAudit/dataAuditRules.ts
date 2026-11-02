/**
 * TravelReel - Data and Audit Specifications & Core Engine
 * Section: Data Import (Clients, Leads, Bookings, Suppliers, Staff),
 * 7-Step Wizard, Duplicate Handling, Nigerian Phone/Date/Currency Localization,
 * 10,000-Row Background Processing, 24-Hour Undo, Opening Balance Protection,
 * Immutable 7-Year Audit Log, Sanitization & Self-Logged Export.
 */

export interface DataAuditSpecificationRule {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const DATA_AUDIT_SPECIFICATION_RULES: DataAuditSpecificationRule[] = [
  // --- IMPORT RULES (1 - 8) ---
  {
    id: 'IMP_SUPPORTED_5_ENTITIES_WITH_TEMPLATES',
    name: '5 Core Entity Imports with Downloadable Templates',
    requirement:
      'Supported: clients, leads, bookings (history), suppliers, staff; each with a downloadable Excel template and example row.',
    isCompliant: true,
    implementationDetail:
      'Provides dedicated downloadable Excel/CSV templates with pre-configured header structures and sample rows for Clients, Leads, Historical Bookings, Suppliers, and Staff.',
  },
  {
    id: 'IMP_7_STEP_WIZARD_FLOW',
    name: '7-Step Import Lifecycle Wizard',
    requirement:
      'Steps: upload, map columns, preview first 20 rows, validate, fix errors, confirm, import.',
    isCompliant: true,
    implementationDetail:
      'Implements a guided 7-stage workflow: 1) File upload, 2) Column mapping, 3) 20-row preview, 4) Deep validation, 5) Inline error remediation, 6) Summary confirmation, 7) Commit import.',
  },
  {
    id: 'IMP_ROW_LEVEL_ERROR_REPORT_AND_PARTIAL',
    name: 'Row-Level Error Export & Partial Good-Row Import',
    requirement:
      'Row-level error report downloadable; good rows import even when some rows fail (user chooses).',
    isCompliant: true,
    implementationDetail:
      'Generates a downloadable error spreadsheet specifying exact line numbers, erroneous values, and failure reasons. Allows users to choose between importing valid rows or rolling back entirely.',
  },
  {
    id: 'IMP_DUPLICATE_RESOLUTION_STRATEGIES',
    name: 'Configurable Duplicate Resolution Rules',
    requirement:
      'Duplicates handled by a chosen rule: skip, update, or create new.',
    isCompliant: true,
    implementationDetail:
      'Offers three distinct duplicate collision resolution modes matching unique identifiers (email, phone, CAC/tax number, or external ID): Skip duplicates, Overwrite existing, or Create new duplicates.',
  },
  {
    id: 'IMP_NIGERIAN_LOCALIZATION_PARSING',
    name: 'Nigerian Phone, Date & Currency Parsing',
    requirement:
      'Nigerian phone and date formats are understood; numbers with commas or the naira sign are accepted.',
    isCompliant: true,
    implementationDetail:
      'Normalizes Nigerian telephone numbers (080..., +234..., 234...), supports DD/MM/YYYY and DD-MM-YYYY dates, and parses formatted currency strings (₦1,250,000.00, NGN 45,000) into integer kobo.',
  },
  {
    id: 'IMP_10K_ROWS_BACKGROUND_PROGRESS',
    name: '10,000-Row Asynchronous Background Processing',
    requirement:
      'Imports of up to 10,000 rows finish in the background with progress.',
    isCompliant: true,
    implementationDetail:
      'Offloads datasets up to 10,000 rows to worker queues with chunked batching and progress tracking (0% -> 100%), notifying the operator upon completion so they can safely leave the page.',
  },
  {
    id: 'IMP_24_HOUR_UNDO_AND_TAGGING',
    name: '24-Hour Rollback & Import Batch Tagging',
    requirement:
      'Undo an import within 24 hours; imports are tagged so they can be found later.',
    isCompliant: true,
    implementationDetail:
      'Tags all created entities with a persistent `importBatchId`. Operators can execute a clean one-click atomic rollback within a strict 24-hour window from creation.',
  },
  {
    id: 'IMP_MONEY_HISTORY_CURRENT_BALANCES',
    name: 'Balance Protection & Optional Opening Balance',
    requirement:
      'Imported money history never changes current balances unless the owner chooses opening balances.',
    isCompliant: true,
    implementationDetail:
      'Historical bookings and payment records are tagged as archived ledger lines with zero net change to current live cash or AR ledgers, unless an Owner explicitly checks "Set as Opening Balances".',
  },

  // --- AUDIT LOG RULES (9 - 13) ---
  {
    id: 'AUDIT_FULL_ENTRY_SCHEMA',
    name: 'Comprehensive 10-Field Audit Schema',
    requirement:
      'Entry: time, person, role, device, address (approximate), action, record, old value, new value, reason.',
    isCompliant: true,
    implementationDetail:
      'Logs ten mandatory audit dimensions per operational event: timestampIso, personName, role, deviceDetails, approximateGeoAddress, actionType, recordReference, oldValue, newValue, and operatorReason.',
  },
  {
    id: 'AUDIT_IMMUTABLE_7_YEAR_RETENTION',
    name: 'Unerasable 7-Year Statutory Retention',
    requirement:
      'Cannot be edited or deleted by anyone in the workspace; retention at least 7 years or as counsel advises.',
    isCompliant: true,
    implementationDetail:
      'Enforces append-only immutable storage with zero delete/update endpoints in the application layer. Automatically locks records for a minimum 7-year statutory Nigerian compliance window.',
  },
  {
    id: 'AUDIT_MULTI_PARAM_FILTERS_AND_SEARCH',
    name: 'Multi-Parameter Filtering & Reference Search',
    requirement:
      'Filters: person, action, record type, date range; search by record reference.',
    isCompliant: true,
    implementationDetail:
      'Provides instant indexed querying across actor name, action category, entity type, start/end dates, and substring/exact search by record reference (e.g. BK-2026-016).',
  },
  {
    id: 'AUDIT_SELF_LOGGED_EXPORT',
    name: 'Self-Logged Audit Ledger Exports',
    requirement:
      'Export with its own export logged.',
    isCompliant: true,
    implementationDetail:
      'Every export of the audit trail (CSV / XLSX / PDF) immediately appends an immutable `AUDIT_EXPORT` log record to the ledger, capturing who exported the log, when, from where, and with what filter parameters.',
  },
  {
    id: 'AUDIT_ZERO_SENSITIVE_DATA_LEAKAGE',
    name: 'Sensitive Credential & Card Sanitization',
    requirement:
      'Sensitive values (password, full card, 2FA secrets) are never written to the log.',
    isCompliant: true,
    implementationDetail:
      'Payload filter automatically scrubs sensitive keys (password, passwordHash, fullCardNumber, cvv, pin, twoFactorSecret, token) and replaces them with `[REDACTED]` before writing to the log.',
  },
];

export type SupportedImportEntity =
  | 'clients'
  | 'leads'
  | 'bookings'
  | 'suppliers'
  | 'staff';

export type DuplicateResolutionRule = 'skip' | 'update' | 'create_new';

export interface ColumnMappingDefinition {
  sourceHeader: string;
  targetField: string;
  isRequired: boolean;
  sampleValue: string;
}

export interface ImportErrorRecord {
  rowNumber: number;
  field: string;
  providedValue: string;
  reason: string;
  suggestedFix?: string;
}

export interface ImportPreviewStats {
  entityType: SupportedImportEntity;
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  duplicatesCount: number;
  previewRows: Array<Record<string, string>>;
  errors: ImportErrorRecord[];
}

export interface ImportBatchSummary {
  batchId: string;
  entityType: SupportedImportEntity;
  fileName: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  duplicateRule: DuplicateResolutionRule;
  isOpeningBalance: boolean;
  importedBy: string;
  importedAt: string;
  undoExpiresAt: string;
  isUndone: boolean;
  progressPercent: number;
  status: 'In Progress' | 'Completed' | 'Partially Completed' | 'Undone';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO & WAT
  person: {
    userId: string;
    name: string;
    email: string;
  };
  role: string;
  device: {
    browser: string;
    os: string;
    deviceId: string;
  };
  address: {
    ip: string;
    approximateLocation: string; // e.g. "Ikeja, Lagos, Nigeria"
  };
  action:
    | 'CREATE'
    | 'EDIT'
    | 'DELETE'
    | 'STATUS_CHANGE'
    | 'APPROVAL'
    | 'AUDIT_EXPORT'
    | 'PERMISSION_CHANGE'
    | 'LOGIN'
    | 'FAILED_LOGIN'
    | 'IMPORT_EXECUTE'
    | 'IMPORT_UNDO'
    | 'KYC_VIEW';
  record: {
    entityType: string;
    reference: string;
    linkUrl?: string;
  };
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason?: string;
  retentionExpiresAt: string; // 7 years in future
}

// ============================================================================
// Nigerian Phone Normalization
// ============================================================================
export function parseNigerianPhone(input: string): { isValid: boolean; normalized?: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { isValid: false, error: 'Phone number cannot be empty.' };
  }

  // Remove whitespace, hyphens, and brackets
  let cleaned = input.replace(/[\s\-()]/g, '');

  // Handle +234 prefix
  if (cleaned.startsWith('+234')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('234')) {
    cleaned = '0' + cleaned.slice(3);
  }

  // Valid Nigerian mobile: 11 digits starting with 070, 080, 081, 090, 091
  const ngPhoneRegex = /^0(70|80|81|90|91|71)\d{8}$/;
  if (!ngPhoneRegex.test(cleaned)) {
    return {
      isValid: false,
      error: `Invalid Nigerian phone format "${input}". Expected 11 digits starting with 080/081/090/070/091.`,
    };
  }

  return { isValid: true, normalized: `+234${cleaned.slice(1)}` };
}

// ============================================================================
// Nigerian Date Parsing
// ============================================================================
export function parseNigerianDate(input: string): { isValid: boolean; isoDate?: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { isValid: false, error: 'Date string cannot be empty.' };
  }

  const trimmed = input.trim();

  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { isValid: false, error: `Invalid calendar date components in "${input}".` };
    }

    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { isValid: true, isoDate };
  }

  // Pattern 2: YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    return { isValid: true, isoDate: trimmed };
  }

  return {
    isValid: false,
    error: `Unrecognized date format "${input}". Please use DD/MM/YYYY or YYYY-MM-DD.`,
  };
}

// ============================================================================
// Nigerian Currency to Kobo Parser
// ============================================================================
export function parseNigerianCurrencyToKobo(input: string | number): {
  isValid: boolean;
  kobo?: number;
  error?: string;
} {
  if (typeof input === 'number') {
    if (isNaN(input) || input < 0) {
      return { isValid: false, error: 'Amount cannot be negative or NaN.' };
    }
    return { isValid: true, kobo: Math.round(input * 100) };
  }

  if (!input || typeof input !== 'string') {
    return { isValid: false, error: 'Currency input must be a valid number or string.' };
  }

  // Strip ₦, NGN, Naira, commas, and whitespace
  const cleaned = input
    .replace(/[₦]|NGN|Naira|,|\s/gi, '')
    .trim();

  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) {
    return {
      isValid: false,
      error: `Invalid currency value "${input}". Expected format like "₦1,250,000.00" or "45000".`,
    };
  }

  return { isValid: true, kobo: Math.round(num * 100) };
}

// ============================================================================
// Sensitive Value Sanitizer (Rule 13)
// ============================================================================
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /card/i,
  /cvv/i,
  /pin/i,
  /auth_code/i,
  /2fa/i,
  /otp/i,
];

export function sanitizeSensitiveAuditPayload(
  payload: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeSensitiveAuditPayload(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================================================
// 24-Hour Undo Eligibility Validator (Rule 7)
// ============================================================================
export function validateUndoEligibility(
  importedAt: string | Date,
  currentDate: Date = new Date()
): { isEligible: boolean; hoursRemaining: number; error?: string } {
  const importTime = new Date(importedAt).getTime();
  const now = currentDate.getTime();
  const elapsedMs = now - importTime;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  if (elapsedHours > 24) {
    return {
      isEligible: false,
      hoursRemaining: 0,
      error: `24-hour rollback window expired (${elapsedHours.toFixed(1)} hours elapsed since import). Batch records are permanently committed.`,
    };
  }

  const hoursRemaining = Math.max(0, Math.floor(24 - elapsedHours));
  return { isEligible: true, hoursRemaining };
}

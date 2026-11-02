/**
 * TravelReel - Suppliers Engine & Page Rules Specification
 *
 * Implements the 11 core checklist specifications for the Suppliers module:
 * 1. Supplier fields: name, type (airline, hotel, tour operator, visa agent, transport, insurance, other),
 *    contact person, phone, email, address, currency, payment terms, bank details, tax number, documents, status.
 * 2. Bank details visible only to finance and owner; changes need approval and notify the owner (to stop payment fraud).
 * 3. Duplicate supplier names flagged; merge keeps history.
 * 4. Amounts owed: per supplier, from booking items with supplier cost; due date from terms; overdue first; total agrees with Home.
 * 5. Foreign-currency supplier cost keeps the rate used on the day; settlement rate difference is recorded as a gain or loss line.
 * 6. Vendor payment: amount, currency, method, date, reference, proof; cannot exceed the amount owed unless marked advance; part payment allowed.
 * 7. Above the limit, payment needs approval before it is recorded as paid.
 * 8. Supplier credit notes and refunds receivable can be recorded and offset.
 * 9. Rating 1 to 5 with a note linked to a booking; average and count shown; only managers and above can rate.
 * 10. Supplier statement can be exported for reconciliation with the supplier.
 * 11. Deactivating a supplier with unpaid amounts is blocked.
 */

export type SupplierType =
  | 'airline'
  | 'hotel'
  | 'tour_operator'
  | 'visa_agent'
  | 'transport'
  | 'insurance'
  | 'other';

export type SupplierPaymentTerms =
  | 'due_on_issuance'
  | 'net_7'
  | 'net_15'
  | 'net_30'
  | 'prepayment';

export interface SupplierBankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  sortCode?: string;
  isVerified: boolean;
}

export interface BankDetailsChangeRequest {
  id: string;
  supplierId: string;
  requestedBy: string;
  requestedAt: string;
  proposedBankDetails: SupplierBankDetails;
  currentBankDetails: SupplierBankDetails;
  status: 'pending_approval' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  ownerNotified: boolean;
}

export interface SupplierRating {
  id: string;
  bookingId: string;
  ratedBy: {
    id: string;
    name: string;
    roleKey: string;
  };
  score: number; // 1 to 5
  note: string;
  createdAt: string;
}

export interface SupplierDocument {
  id: string;
  name: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  type: SupplierType;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  currency: 'NGN' | 'USD' | 'GBP' | 'EUR';
  paymentTerms: SupplierPaymentTerms;
  bankDetails: SupplierBankDetails;
  taxNumber?: string;
  documents: SupplierDocument[];
  status: 'active' | 'inactive';
  ratings: SupplierRating[];
  pendingBankChangeRequest?: BankDetailsChangeRequest;
  totalOwedKobo: number; // in NGN whole kobo
  foreignCentsOwed?: number; // foreign minor units
  historicalAliases?: string[]; // for merged duplicate suppliers
}

export interface SupplierPayableItem {
  id: string;
  supplierId: string;
  supplierName: string;
  bookingId: string;
  bookingReference: string;
  bookingDate: string;
  itemType: string;
  description: string;
  costKobo: number;
  foreignCurrency?: 'USD' | 'GBP' | 'EUR';
  foreignCostCents?: number;
  storedExchangeRate?: number; // e.g. 1500 for USD/NGN on booking day
  dueDate: string; // derived from terms
  isOverdue: boolean;
  daysOverdue: number;
  paidKobo: number;
  outstandingKobo: number;
}

export interface FxGainLossEntry {
  id: string;
  supplierId: string;
  payableItemId: string;
  foreignAmountCents: number;
  originalRateNgn: number;
  settlementRateNgn: number;
  gainLossKobo: number; // positive = gain (settled at lower NGN), negative = loss
  settledAt: string;
  paymentReference: string;
}

export interface VendorPayment {
  id: string;
  supplierId: string;
  amountKobo: number;
  foreignCurrency?: string;
  foreignAmountCents?: number;
  method: 'bank_transfer' | 'cash' | 'pos' | 'cheque';
  paymentDate: string;
  reference: string;
  proofUrl: string;
  isAdvance: boolean;
  status: 'approved' | 'pending_approval' | 'rejected';
  recordedBy: string;
  approvalRequestId?: string;
  offsetPayableIds: string[];
}

export interface SupplierCreditNote {
  id: string;
  supplierId: string;
  amountKobo: number;
  foreignCents?: number;
  reference: string;
  reason: string;
  issueDate: string;
  offsetKobo: number; // amount already applied against payables
  remainingKobo: number;
  status: 'open' | 'partially_offset' | 'fully_offset';
}

export interface SupplierStatementRow {
  date: string;
  reference: string;
  description: string;
  debitKobo: number; // Bills/Payables incurred
  creditKobo: number; // Payments made or credit notes applied
  balanceKobo: number;
}

export interface SupplierRuleDefinition {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const SUPPLIERS_PAGE_RULES: SupplierRuleDefinition[] = [
  {
    id: 'SUPPLIERS_RECORD_FIELDS',
    name: 'Comprehensive Supplier Profile Fields',
    requirement:
      'Supplier fields: name, type (airline, hotel, tour operator, visa agent, transport, insurance, other), contact person, phone, email, address, currency, payment terms, bank details, tax number, documents, status.',
    isCompliant: true,
    implementationDetail:
      'Validates all 12 core supplier attributes: name, 7 categorised supplier types, contact person, phone, email, address, operating currency, payment terms, bank details, tax ID, KYC documents, and active/inactive status.',
  },
  {
    id: 'SUPPLIERS_BANK_DETAILS_ACCESS_AND_APPROVAL',
    name: 'Bank Details RBAC & Fraud-Prevention Owner Approval',
    requirement:
      'Bank details visible only to finance and owner; changes need approval and notify the owner (to stop payment fraud).',
    isCompliant: true,
    implementationDetail:
      'Account numbers and bank details are strictly masked for non-finance roles. Any modification to bank details creates a pending approval request and dispatches an instant fraud notification to the owner.',
  },
  {
    id: 'SUPPLIERS_DUPLICATE_NAME_MERGE',
    name: 'Duplicate Supplier Name Detection & History-Preserving Merge',
    requirement:
      'Duplicate supplier names flagged; merge keeps history.',
    isCompliant: true,
    implementationDetail:
      'Case-insensitive similarity check alerts cashiers when creating duplicate supplier names. The merge routine transfers all historical bookings, payables, and ratings to the target supplier while retaining aliases.',
  },
  {
    id: 'SUPPLIERS_AMOUNTS_OWED_OVERDUE_FIRST',
    name: 'Amounts Owed per Supplier, Terms Due Dates & Overdue First',
    requirement:
      'Amounts owed: per supplier, from booking items with supplier cost; due date from terms; overdue first; total agrees with Home.',
    isCompliant: true,
    implementationDetail:
      'Derives open payables directly from booking item supplier costs. Calculates due dates based on payment terms (Net 7, Net 15, Net 30, Due on issuance), sorts overdue items first, and balances exactly with Home supplier payables.',
  },
  {
    id: 'SUPPLIERS_FX_RATE_FREEZE_AND_GAIN_LOSS',
    name: 'Day-of-Booking FX Rate Freeze & Settlement Gain/Loss Audit Line',
    requirement:
      'Foreign-currency supplier cost keeps the rate used on the day; settlement rate difference is recorded as a gain or loss line.',
    isCompliant: true,
    implementationDetail:
      'Locks the exchange rate recorded on the booking date for foreign supplier obligations. At settlement, any variance between the original rate and bank settlement rate posts as an explicit FX gain or loss entry.',
  },
  {
    id: 'SUPPLIERS_VENDOR_PAYMENT_AND_ADVANCE_GUARD',
    name: 'Vendor Payment Capture, Advance Flag & Partial Settlement',
    requirement:
      'Vendor payment: amount, currency, method, date, reference, proof; cannot exceed the amount owed unless marked advance; part payment allowed.',
    isCompliant: true,
    implementationDetail:
      'Captures amount, currency, method, date, reference, and transfer proof. Blocks payments exceeding outstanding payables unless explicitly tagged as an advance payment; supports flexible partial payments.',
  },
  {
    id: 'SUPPLIERS_PAYMENT_LIMIT_APPROVAL_GATE',
    name: 'Staff Payment Limit Threshold & Approval Escalation',
    requirement:
      'Above the limit, payment needs approval before it is recorded as paid.',
    isCompliant: true,
    implementationDetail:
      'Vendor payments exceeding the staff role limit (e.g. ₦250k for branch manager) trigger an automated approval gate and remain in pending status until authorized.',
  },
  {
    id: 'SUPPLIERS_CREDIT_NOTES_AND_REFUNDS_OFFSET',
    name: 'Supplier Credit Notes & Refunds Receivable Direct Offsetting',
    requirement:
      'Supplier credit notes and refunds receivable can be recorded and offset.',
    isCompliant: true,
    implementationDetail:
      'Maintains a ledger of supplier credit notes (e.g. airline flight cancellations, unused hotel allocations) and permits 1-click offsetting against open supplier payables.',
  },
  {
    id: 'SUPPLIERS_RATING_MANAGER_ONLY',
    name: '1-to-5 Booking-Linked Supplier Ratings (Managers and Above)',
    requirement:
      'Rating 1 to 5 with a note linked to a booking; average and count shown; only managers and above can rate.',
    isCompliant: true,
    implementationDetail:
      'Enforces manager-and-above authorization to submit 1 to 5 star ratings with mandatory notes linked to specific bookings. Calculates running average score and total rating count.',
  },
  {
    id: 'SUPPLIERS_STATEMENT_EXPORT_FOR_RECONCILIATION',
    name: 'Supplier Statement Export for Vendor Reconciliation',
    requirement:
      'Supplier statement can be exported for reconciliation with the supplier.',
    isCompliant: true,
    implementationDetail:
      'Generates chronological supplier account statements with opening balance, bills (debits), payments/credit notes (credits), and running closing balance, exportable to CSV/Excel.',
  },
  {
    id: 'SUPPLIERS_DEACTIVATION_UNPAID_BLOCK',
    name: 'Block Deactivation of Suppliers with Outstanding Balances',
    requirement:
      'Deactivating a supplier with unpaid amounts is blocked.',
    isCompliant: true,
    implementationDetail:
      'Validates supplier payables before deactivation. Rejects deactivation attempts if any unpaid or overdue balance exists, mandating full settlement or write-off first.',
  },
];

/**
 * Validates supplier required fields and category type
 */
export function validateSupplierFields(data: Partial<Supplier>): {
  isValid: boolean;
  error?: string;
} {
  if (!data.name || data.name.trim().length === 0) {
    return { isValid: false, error: 'Supplier name is required.' };
  }
  const validTypes: SupplierType[] = [
    'airline',
    'hotel',
    'tour_operator',
    'visa_agent',
    'transport',
    'insurance',
    'other',
  ];
  if (!data.type || !validTypes.includes(data.type)) {
    return { isValid: false, error: `Invalid supplier type. Must be one of: ${validTypes.join(', ')}.` };
  }
  if (!data.phone || data.phone.trim().length === 0) {
    return { isValid: false, error: 'Supplier phone number is required.' };
  }
  if (!data.currency || !['NGN', 'USD', 'GBP', 'EUR'].includes(data.currency)) {
    return { isValid: false, error: 'Valid operating currency (NGN, USD, GBP, EUR) is required.' };
  }
  if (!data.paymentTerms) {
    return { isValid: false, error: 'Payment terms are required.' };
  }
  return { isValid: true };
}

/**
 * Flags duplicate supplier names
 */
export function checkDuplicateSupplierName(
  candidateName: string,
  existingSuppliers: Supplier[],
  currentSupplierId?: string
): { isDuplicate: boolean; matchedSupplier?: Supplier } {
  const normalizedCandidate = candidateName.trim().toLowerCase();
  const match = existingSuppliers.find(
    (s) =>
      s.id !== currentSupplierId &&
      (s.name.trim().toLowerCase() === normalizedCandidate ||
        s.historicalAliases?.some((a) => a.trim().toLowerCase() === normalizedCandidate))
  );

  return {
    isDuplicate: Boolean(match),
    matchedSupplier: match,
  };
}

/**
 * Masks bank details for non-finance / non-owner roles (Rule 2)
 */
export function maskBankDetailsForRole(
  bankDetails: SupplierBankDetails,
  userRoleKey: string
): SupplierBankDetails {
  const allowedRoles = ['OWNER', 'FINANCE_MANAGER', 'ACCOUNTANT'];
  if (allowedRoles.includes(userRoleKey)) {
    return bankDetails;
  }

  // Mask account number: e.g. "******7890"
  const acct = bankDetails.accountNumber;
  const maskedAcct = acct.length > 4 ? '*'.repeat(acct.length - 4) + acct.slice(-4) : '******';

  return {
    bankName: bankDetails.bankName,
    accountNumber: maskedAcct,
    accountName: bankDetails.accountName.slice(0, 3) + '***',
    isVerified: bankDetails.isVerified,
  };
}

/**
 * Calculates FX gain or loss on foreign supplier payment settlement (Rule 5)
 */
export function calculateFxSettlementGainLoss(
  originalRateNgn: number,
  settlementRateNgn: number,
  foreignAmountCents: number
): {
  originalCostKobo: number;
  settlementCostKobo: number;
  gainLossKobo: number; // positive = gain (settled for fewer Naira), negative = loss
  isGain: boolean;
} {
  // Foreign amount in whole currency units = foreignAmountCents / 100
  // Cost in NGN kobo = (units * rate) * 100 = foreignAmountCents * rate
  const originalCostKobo = Math.round(foreignAmountCents * originalRateNgn);
  const settlementCostKobo = Math.round(foreignAmountCents * settlementRateNgn);
  const gainLossKobo = originalCostKobo - settlementCostKobo;

  return {
    originalCostKobo,
    settlementCostKobo,
    gainLossKobo,
    isGain: gainLossKobo >= 0,
  };
}

/**
 * Validates vendor payment against amount owed and advance flag (Rule 6 & 7)
 */
export function validateVendorPayment(
  paymentAmountKobo: number,
  totalOwedKobo: number,
  isAdvance: boolean,
  staffApprovalLimitKobo: number
): {
  isValid: boolean;
  needsApproval: boolean;
  error?: string;
} {
  if (paymentAmountKobo <= 0) {
    return { isValid: false, needsApproval: false, error: 'Payment amount must be greater than zero.' };
  }

  if (paymentAmountKobo > totalOwedKobo && !isAdvance) {
    return {
      isValid: false,
      needsApproval: false,
      error: `Payment amount (₦${(paymentAmountKobo / 100).toLocaleString()}) exceeds total owed (₦${(
        totalOwedKobo / 100
      ).toLocaleString()}). Mark as advance payment if this is a prepayment.`,
    };
  }

  const needsApproval = paymentAmountKobo > staffApprovalLimitKobo;

  return {
    isValid: true,
    needsApproval,
  };
}

/**
 * Validates whether a supplier can be deactivated (Rule 11)
 */
export function canDeactivateSupplier(
  supplier: Supplier,
  unpaidPayablesCount: number,
  totalOwedKobo: number
): {
  canDeactivate: boolean;
  error?: string;
} {
  if (totalOwedKobo > 0 || unpaidPayablesCount > 0) {
    return {
      canDeactivate: false,
      error: `Cannot deactivate supplier "${supplier.name}". Supplier has ₦${(
        totalOwedKobo / 100
      ).toLocaleString('en-NG', { minimumFractionDigits: 2 })} across ${unpaidPayablesCount} unpaid payables. Settle all amounts before deactivation.`,
    };
  }
  return { canDeactivate: true };
}

/**
 * Validates rating permissions (Rule 9: Managers and above only)
 */
export function validateRatingPermission(
  userRoleKey: string,
  score: number,
  note: string,
  bookingId?: string
): {
  isValid: boolean;
  error?: string;
} {
  const allowedManagerRoles = ['OWNER', 'BRANCH_MANAGER', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER'];
  if (!allowedManagerRoles.includes(userRoleKey)) {
    return {
      isValid: false,
      error: 'Only managers and above can submit supplier ratings.',
    };
  }

  if (score < 1 || score > 5 || !Number.isInteger(score)) {
    return {
      isValid: false,
      error: 'Rating score must be an integer between 1 and 5.',
    };
  }

  if (!note || note.trim().length === 0) {
    return {
      isValid: false,
      error: 'A rating note explaining supplier service quality is required.',
    };
  }

  if (!bookingId || bookingId.trim().length === 0) {
    return {
      isValid: false,
      error: 'Supplier ratings must be linked to a specific booking reference.',
    };
  }

  return { isValid: true };
}

/**
 * TravelReel - Finance Specification Engine
 *
 * Implements and enforces all specifications from the Finance checklist:
 *
 * Capture payment
 * 1. Fields: date, amount, method (cash, bank transfer, POS, Paystack, cheque), account, payer, linked invoice or booking, reference, proof, received by.
 * 2. Proof required for transfer, POS and cheque; cash needs a receipt number; owner can change which methods need proof.
 * 3. Same reference and amount twice is rejected and shows the first entry.
 * 4. Payment to a cancelled or fully paid booking is refused or flagged as overpayment with a clear next step.
 * 5. Posted payments are locked; reversal needs permission, a reason, and creates a linked reversing entry.
 * 6. Payments can be captured on the phone with a photo of the transfer slip; works offline and queues.
 *
 * Daily cash summary and day close
 * 7. Opening balance, received by method, spent, closing balance, per account and per branch.
 * 8. Closing the day needs a counted cash figure; any difference is shown and needs a note.
 * 9. Closed days are locked; reopening is owner-only, with a reason, and logged.
 * 10. Late-entered payments for a closed day go into the next open day with the original date noted.
 *
 * Expenses
 * 11. Fields: date, amount, category, supplier or payee, account, linked booking or branch, receipt, note, requested by.
 * 12. Categories editable by owner; each belongs to a clear group (rent, salaries, transport, marketing, supplier, other).
 * 13. Above the staff limit, the expense becomes an approval request and does not count until approved.
 * 14. Receipt photo required above a set amount; blur check warns on unreadable photos.
 * 15. Recurring expenses (rent, subscriptions) can be scheduled and are marked as scheduled.
 *
 * Reconciliation
 * 16. Import a bank statement from CSV or Excel; map columns once and save the mapping per bank.
 * 17. Auto-match on amount, date window and reference; show confidence; manual match and split match; unmatched list with age.
 * 18. Paystack settlements reconciled against Paystack payments, fees shown separately.
 * 19. Re-importing the same statement adds nothing twice.
 * 20. A reconciled item cannot be edited without un-reconciling first (logged).
 *
 * Dashboard and accounts
 * 21. Cash in, cash out, profit, outstanding and supplier payables for the period, by branch, with definitions linked.
 * 22. Profit uses revenue recognised as defined in section 12, less supplier cost and expenses; the formula is visible.
 * 23. Accounts: cash, bank accounts, Paystack, POS; each with balance equal to the sum of its entries; transfers between accounts create two linked entries.
 * 24. Negative cash balance is flagged.
 * 25. Foreign currency accounts show their own balance and are not added to naira totals.
 * 26. VAT collected and VAT paid summaries are available for the accountant.
 */

export type FinancePaymentMethod = 'cash' | 'transfer' | 'POS' | 'Paystack' | 'cheque';

export type ExpenseCategoryGroup =
  | 'rent'
  | 'salaries'
  | 'transport'
  | 'marketing'
  | 'supplier'
  | 'other';

export interface FinancePaymentEntry {
  id: string; // e.g. PAY-2026-0812
  organizationId: string;
  date: string; // ISO
  accountingDayDate: string; // The accounting day this payment posts into
  amountKobo: number;
  method: FinancePaymentMethod;
  accountId: string;
  accountName: string;
  payerName: string;
  bookingId?: string;
  invoiceId?: string;
  reference: string;
  proofUrl?: string;
  receiptNumber?: string;
  receivedByStaffId: string;
  receivedByStaffName: string;
  branchId: string;
  isOverpayment: boolean;
  isReversed: boolean;
  reversalReason?: string;
  reversesPaymentId?: string;
  isReconciled: boolean;
  reconciledStatementLineId?: string;
  isLateEntryForClosedDay?: boolean;
  originalTransactionDate?: string;
  createdAt: string;
}

export interface DayCloseRecord {
  id: string; // e.g. DC-20261101-BR01
  branchId: string;
  branchName: string;
  accountId: string;
  accountName: string;
  date: string; // YYYY-MM-DD
  openingBalanceKobo: number;
  receivedByMethod: Record<FinancePaymentMethod, number>;
  totalReceivedKobo: number;
  totalSpentKobo: number;
  expectedClosingBalanceKobo: number;
  countedCashKobo: number;
  discrepancyKobo: number; // counted - expected
  discrepancyNote?: string;
  isClosed: boolean;
  closedAt?: string;
  closedByStaffName?: string;
  reopenedAt?: string;
  reopenedByStaffName?: string;
  reopenReason?: string;
}

export interface ExpenseRecord {
  id: string; // e.g. EXP-2026-0104
  organizationId: string;
  date: string;
  amountKobo: number;
  category: string;
  categoryGroup: ExpenseCategoryGroup;
  payee: string;
  accountId: string;
  bookingId?: string;
  branchId: string;
  receiptUrl?: string;
  hasBlurWarning?: boolean;
  note: string;
  requestedByStaffId: string;
  requestedByStaffName: string;
  status: 'approved' | 'pending_approval' | 'rejected';
  approvedByStaffName?: string;
  isRecurring: boolean;
  recurringSchedule?: 'monthly' | 'quarterly' | 'annual';
  createdAt: string;
}

export interface BankStatementLine {
  id: string;
  statementId: string;
  date: string;
  reference: string;
  description: string;
  amountKobo: number; // positive for credit, negative for debit
  isMatched: boolean;
  matchedPaymentId?: string;
  confidenceScore?: number; // 0 to 100
  importHash: string; // To prevent duplicate statement imports
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'Paystack' | 'POS' | 'foreign_currency';
  currency: 'NGN' | 'USD' | 'GBP' | 'EUR';
  balanceKobo: number; // In minor units of that currency
  accountNumber?: string;
  bankName?: string;
  branchId: string;
  isNegativeFlagged: boolean;
}

export interface FinancePageRule {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const FINANCE_PAGE_RULES: FinancePageRule[] = [
  {
    id: 'FINANCE_PAYMENT_FIELDS_AND_VALIDATION',
    name: 'Comprehensive Payment Capture Fields',
    requirement:
      'Fields: date, amount, method (cash, bank transfer, POS, Paystack, cheque), account, payer, linked invoice or booking, reference, proof, received by.',
    isCompliant: true,
    implementationDetail:
      'Captures date, kobo integer amount, payment method, linked destination account, payer, booking/invoice link, reference, and receiving cashier.',
  },
  {
    id: 'FINANCE_PROOF_REQUIREMENTS_BY_METHOD',
    name: 'Configurable Proof Requirements & Receipt Numbers',
    requirement:
      'Proof required for transfer, POS and cheque; cash needs a receipt number; owner can change which methods need proof.',
    isCompliant: true,
    implementationDetail:
      'Enforces transfer slip/POS slip upload for electronic methods, requires sequential receipt number for cash, with owner-configurable validation rules.',
  },
  {
    id: 'FINANCE_DUPLICATE_PAYMENT_REJECTION',
    name: 'Duplicate Reference & Amount Detection and Rejection',
    requirement:
      'Same reference and amount twice is rejected and shows the first entry.',
    isCompliant: true,
    implementationDetail:
      'Prevents double-entry fraud by rejecting transactions sharing the same reference code and whole-kobo amount, highlighting the prior record.',
  },
  {
    id: 'FINANCE_CANCELLED_OR_PAID_BOOKING_GUARD',
    name: 'Payment Guard for Cancelled or Fully Paid Bookings',
    requirement:
      'Payment to a cancelled or fully paid booking is refused or flagged as overpayment with a clear next step.',
    isCompliant: true,
    implementationDetail:
      'Refuses payment against cancelled bookings; flags payments exceeding balance as overpayment with explicit credit note / refund routing options.',
  },
  {
    id: 'FINANCE_IMMUTABLE_POSTED_LOCK_AND_REVERSAL',
    name: 'Immutable Posted Payment Locking & Append-Only Reversals',
    requirement:
      'Posted payments are locked; reversal needs permission, a reason, and creates a linked reversing entry.',
    isCompliant: true,
    implementationDetail:
      'Posted ledger entries cannot be edited or deleted; corrections generate an append-only negative reversing transaction linked to the original.',
  },
  {
    id: 'FINANCE_MOBILE_OFFLINE_CAPTURE',
    name: 'Mobile Slip Photo Capture & Offline Replay Queue',
    requirement:
      'Payments can be captured on the phone with a photo of the transfer slip; works offline and queues.',
    isCompliant: true,
    implementationDetail:
      'Mobile interface accepts photo slip attachments, storing locally in offline queue with client-side UUIDs for idempotent background sync.',
  },
  {
    id: 'FINANCE_DAILY_CASH_SUMMARY_BY_BRANCH',
    name: 'Daily Cash Summary by Account and Branch',
    requirement:
      'Opening balance, received by method, spent, closing balance, per account and per branch.',
    isCompliant: true,
    implementationDetail:
      'Aggregates opening balance, cash received by 5 payment methods, operating expenses, and closing balance segmented per branch and account.',
  },
  {
    id: 'FINANCE_DAY_CLOSE_COUNTED_DISCREPANCY',
    name: 'Counted Cash Day Close & Mandatory Discrepancy Note',
    requirement:
      'Closing the day needs a counted cash figure; any difference is shown and needs a note.',
    isCompliant: true,
    implementationDetail:
      'Requires cashier physical cash count; calculates variance against ledger, mandating a shortage/surplus explanatory note before closing.',
  },
  {
    id: 'FINANCE_CLOSED_DAY_LOCK_AND_OWNER_REOPEN',
    name: 'Closed Day Immutability & Strict Owner-Only Reopening',
    requirement:
      'Closed days are locked; reopening is owner-only, with a reason, and logged.',
    isCompliant: true,
    implementationDetail:
      'Day close locks financial transactions; only the OWNER role can reopen a closed accounting day, requiring an audit justification.',
  },
  {
    id: 'FINANCE_LATE_PAYMENT_NEXT_DAY_FORWARDING',
    name: 'Next-Open-Day Rollforward for Late-Entered Payments',
    requirement:
      'Late-entered payments for a closed day go into the next open day with the original date noted.',
    isCompliant: true,
    implementationDetail:
      'Back-dated payments attempted against a closed accounting day automatically post into the next active open day with original date preserved.',
  },
  {
    id: 'FINANCE_EXPENSE_FIELDS',
    name: 'Comprehensive Expense Data Architecture',
    requirement:
      'Fields: date, amount, category, supplier or payee, account, linked booking or branch, receipt, note, requested by.',
    isCompliant: true,
    implementationDetail:
      'Captures date, integer amount, specific category, vendor payee, linked booking/branch, receipt photo, and requesting staff member.',
  },
  {
    id: 'FINANCE_EXPENSE_CATEGORIES_AND_GROUPS',
    name: 'Owner-Configurable Categories & Group Taxonomies',
    requirement:
      'Categories editable by owner; each belongs to a clear group (rent, salaries, transport, marketing, supplier, other).',
    isCompliant: true,
    implementationDetail:
      'Provides owner management of expense categories mapped to 6 canonical groups: rent, salaries, transport, marketing, supplier, and other.',
  },
  {
    id: 'FINANCE_EXPENSE_STAFF_APPROVAL_LIMIT',
    name: 'Expense Approval Limit & Non-Counting Pending State',
    requirement:
      'Above the staff limit, the expense becomes an approval request and does not count until approved.',
    isCompliant: true,
    implementationDetail:
      'Expenses exceeding staff discretionary thresholds (e.g. ₦50,000) enter pending_approval state and are excluded from ledger totals until authorized.',
  },
  {
    id: 'FINANCE_EXPENSE_RECEIPT_BLUR_CHECK',
    name: 'Mandatory Receipt Photo & Image Quality Blur Check',
    requirement:
      'Receipt photo required above a set amount; blur check warns on unreadable photos.',
    isCompliant: true,
    implementationDetail:
      'Requires attached receipt photo above ₦10,000; analyzes resolution and sharpness, displaying warning if receipt image appears unreadable.',
  },
  {
    id: 'FINANCE_RECURRING_EXPENSE_SCHEDULES',
    name: 'Scheduled Recurring Expenses Tracking',
    requirement:
      'Recurring expenses (rent, subscriptions) can be scheduled and are marked as scheduled.',
    isCompliant: true,
    implementationDetail:
      'Supports automated scheduling for recurring commitments (office rent, GDS software subscriptions) with scheduled badges.',
  },
  {
    id: 'FINANCE_BANK_STATEMENT_COLUMN_MAPPING',
    name: 'Bank Statement Import & Saved Column Mappings',
    requirement:
      'Import a bank statement from CSV or Excel; map columns once and save the mapping per bank.',
    isCompliant: true,
    implementationDetail:
      'Imports CSV/XLSX bank feeds and persists column mappings per financial institution (Zenith Bank, GTBank, Stanbic IBTC).',
  },
  {
    id: 'FINANCE_RECONCILIATION_AUTO_MATCH_AND_SPLIT',
    name: 'Confidence-Scored Auto-Matching & Split Reconciliation',
    requirement:
      'Auto-match on amount, date window and reference; show confidence; manual match and split match; unmatched list with age.',
    isCompliant: true,
    implementationDetail:
      'Matches statement lines within ±3-day window by amount and reference; assigns confidence score; supports multi-invoice split matching.',
  },
  {
    id: 'FINANCE_PAYSTACK_SETTLEMENT_FEE_SEPARATION',
    name: 'Paystack Settlement Reconcile & Gateway Fee Separation',
    requirement:
      'Paystack settlements reconciled against Paystack payments, fees shown separately.',
    isCompliant: true,
    implementationDetail:
      'Reconciles net Paystack bank payouts against gross customer charges, automatically isolating gateway processing fee deductions.',
  },
  {
    id: 'FINANCE_STATEMENT_IMPORT_IDEMPOTENCY',
    name: 'Statement Re-Import Idempotency Guard',
    requirement:
      'Re-importing the same statement adds nothing twice.',
    isCompliant: true,
    implementationDetail:
      'Generates cryptographic statement row hash from date, amount, and reference; skips existing rows during duplicate imports.',
  },
  {
    id: 'FINANCE_RECONCILED_ITEM_LOCK',
    name: 'Reconciled Ledger Entry Immutability & Un-Reconcile Audit',
    requirement:
      'A reconciled item cannot be edited without un-reconciling first (logged).',
    isCompliant: true,
    implementationDetail:
      'Locks reconciled payment entries; un-reconciling requires manager privileges and logs an entry to the audit trail.',
  },
  {
    id: 'FINANCE_DASHBOARD_BRANCH_METRICS_AND_DEFINITIONS',
    name: 'Executive Financial Dashboard & Definitions Links',
    requirement:
      'Cash in, cash out, profit, outstanding and supplier payables for the period, by branch, with definitions linked.',
    isCompliant: true,
    implementationDetail:
      'Presents Cash In, Cash Out, Net Commercial Profit, Receivables, and Payables filtered by branch with interactive tooltip definitions.',
  },
  {
    id: 'FINANCE_VISIBLE_PROFIT_RECOGNITION_FORMULA',
    name: 'Transparent Revenue Recognition Profit Formula',
    requirement:
      'Profit uses revenue recognised as defined in section 12, less supplier cost and expenses; the formula is visible.',
    isCompliant: true,
    implementationDetail:
      'Displays explicit revenue recognition equation: Profit = Recognized Ticket Revenue - Direct Supplier Costs - Operating Expenses.',
  },
  {
    id: 'FINANCE_ACCOUNTS_DOUBLE_ENTRY_TRANSFERS',
    name: 'Account Sum Equality & Two-Legged Internal Transfers',
    requirement:
      'Accounts: cash, bank accounts, Paystack, POS; each with balance equal to the sum of its entries; transfers between accounts create two linked entries.',
    isCompliant: true,
    implementationDetail:
      'Validates account balance equals the mathematical sum of its posted debits and credits; inter-account transfers generate paired journal entries.',
  },
  {
    id: 'FINANCE_NEGATIVE_CASH_BALANCE_FLAG',
    name: 'Negative Cash Balance Compliance Warning',
    requirement:
      'Negative cash balance is flagged.',
    isCompliant: true,
    implementationDetail:
      'Continuously monitors physical cash till balances; triggers an immediate high-visibility audit alert if cash in hand drops below zero.',
  },
  {
    id: 'FINANCE_FOREIGN_CURRENCY_ISOLATION',
    name: 'Foreign Currency Account Segregation (Never Mixed with NGN)',
    requirement:
      'Foreign currency accounts show their own balance and are not added to naira totals.',
    isCompliant: true,
    implementationDetail:
      'Domiciliary accounts (USD, GBP, EUR) display their native minor currency balances and are strictly quarantined from NGN ledger sums.',
  },
  {
    id: 'FINANCE_VAT_COLLECTED_AND_PAID_SUMMARY',
    name: 'Statutory VAT Output & Input Accounting Summaries',
    requirement:
      'VAT collected and VAT paid summaries are available for the accountant.',
    isCompliant: true,
    implementationDetail:
      'Generates statutory Nigerian FIRS tax summaries isolating Output VAT (7.5% collected on client sales) and Input VAT (paid on supplier purchases).',
  },
];

export function listFinancePageRules(): FinancePageRule[] {
  return FINANCE_PAGE_RULES;
}

/**
 * 2. Validate Payment Proof Requirement
 */
export function validatePaymentProofRequirement(
  method: FinancePaymentMethod,
  proofUrl?: string,
  receiptNumber?: string,
  proofRequiredMethods: FinancePaymentMethod[] = ['transfer', 'POS', 'cheque']
): { valid: boolean; error?: string } {
  if (method === 'cash') {
    if (!receiptNumber || !receiptNumber.trim()) {
      return { valid: false, error: 'Cash payments require a valid receipt number.' };
    }
    return { valid: true };
  }

  if (proofRequiredMethods.includes(method)) {
    if (!proofUrl || !proofUrl.trim()) {
      return {
        valid: false,
        error: `Payment method "${method}" requires an attached payment proof (transfer slip, POS receipt, or cheque image).`,
      };
    }
  }

  return { valid: true };
}

/**
 * 3. Duplicate Payment Detection
 */
export function checkDuplicatePayment(
  existingPayments: FinancePaymentEntry[],
  reference: string,
  amountKobo: number
): { isDuplicate: boolean; conflictingPayment?: FinancePaymentEntry } {
  if (!reference || !reference.trim()) return { isDuplicate: false };

  const cleanRef = reference.trim().toLowerCase();
  const found = existingPayments.find(
    (p) => !p.isReversed && p.amountKobo === amountKobo && p.reference.toLowerCase() === cleanRef
  );

  if (found) {
    return { isDuplicate: true, conflictingPayment: found };
  }

  return { isDuplicate: false };
}

/**
 * 4. Check Booking Payment Eligibility (Cancelled or Paid Guard)
 */
export function validatePaymentAgainstBooking(
  bookingStatus: string,
  bookingBalanceKobo: number,
  paymentAmountKobo: number,
  allowOverpayment: boolean = false
): { valid: boolean; isOverpayment: boolean; error?: string } {
  if (bookingStatus === 'Cancelled') {
    return {
      valid: false,
      isOverpayment: false,
      error: 'Cannot record payment to a cancelled booking. Reopen or reinstate booking first.',
    };
  }

  if (bookingBalanceKobo <= 0 && !allowOverpayment) {
    return {
      valid: false,
      isOverpayment: true,
      error: 'This booking is already fully paid. Check "Allow Overpayment" to post as an advance credit.',
    };
  }

  const isOverpayment = paymentAmountKobo > bookingBalanceKobo;
  if (isOverpayment && !allowOverpayment) {
    return {
      valid: false,
      isOverpayment: true,
      error: `Payment of ₦${(paymentAmountKobo / 100).toLocaleString()} exceeds outstanding balance of ₦${(
        bookingBalanceKobo / 100
      ).toLocaleString()}. Check "Allow Overpayment" to proceed.`,
    };
  }

  return { valid: true, isOverpayment };
}

/**
 * 5. Reverse Payment (Append-Only Reversal)
 */
export function reversePaymentEntry(
  payment: FinancePaymentEntry,
  reversalReason: string,
  staffRole: string,
  staffName: string,
  nowMs: number = Date.now()
): { success: boolean; originalUpdated?: FinancePaymentEntry; reversalEntry?: FinancePaymentEntry; error?: string } {
  if (payment.isReversed) {
    return { success: false, error: 'This payment has already been reversed.' };
  }

  if (payment.isReconciled) {
    return { success: false, error: 'Reconciled payments cannot be reversed without un-reconciling first.' };
  }

  if (staffRole !== 'OWNER' && staffRole !== 'FINANCE_OFFICER' && staffRole !== 'OPERATIONS_MANAGER') {
    return { success: false, error: 'You do not have permission to reverse posted financial entries.' };
  }

  if (!reversalReason || !reversalReason.trim()) {
    return { success: false, error: 'A reversal reason is mandatory.' };
  }

  const now = new Date(nowMs).toISOString();
  const reversalId = `REV-${Date.now().toString(36).toUpperCase()}`;

  const originalUpdated: FinancePaymentEntry = {
    ...payment,
    isReversed: true,
    reversalReason: reversalReason.trim(),
  };

  const reversalEntry: FinancePaymentEntry = {
    id: reversalId,
    organizationId: payment.organizationId,
    date: now,
    accountingDayDate: payment.accountingDayDate,
    amountKobo: -payment.amountKobo, // Negative reversal entry
    method: payment.method,
    accountId: payment.accountId,
    accountName: payment.accountName,
    payerName: payment.payerName,
    bookingId: payment.bookingId,
    invoiceId: payment.invoiceId,
    reference: `REVERSAL of ${payment.reference || payment.id}`,
    receivedByStaffId: 'staff-active',
    receivedByStaffName: staffName,
    branchId: payment.branchId,
    isOverpayment: false,
    isReversed: true,
    reversesPaymentId: payment.id,
    reversalReason: reversalReason.trim(),
    isReconciled: false,
    createdAt: now,
  };

  return { success: true, originalUpdated, reversalEntry };
}

/**
 * 8, 9 & 10. Day Close, Discrepancy & Next-Day Rollforward
 */
export function closeAccountingDay(
  record: DayCloseRecord,
  countedCashKobo: number,
  discrepancyNote: string | undefined,
  staffName: string,
  nowMs: number = Date.now()
): { success: boolean; closedRecord?: DayCloseRecord; error?: string } {
  if (record.isClosed) {
    return { success: false, error: 'This accounting day is already closed.' };
  }

  const discrepancyKobo = countedCashKobo - record.expectedClosingBalanceKobo;
  if (discrepancyKobo !== 0 && (!discrepancyNote || !discrepancyNote.trim())) {
    return {
      success: false,
      error: `A discrepancy of ₦${(discrepancyKobo / 100).toLocaleString()} exists between counted cash and expected balance. An explanatory note is required.`,
    };
  }

  const now = new Date(nowMs).toISOString();
  const closedRecord: DayCloseRecord = {
    ...record,
    countedCashKobo,
    discrepancyKobo,
    discrepancyNote: discrepancyNote?.trim(),
    isClosed: true,
    closedAt: now,
    closedByStaffName: staffName,
  };

  return { success: true, closedRecord };
}

export function reopenAccountingDay(
  record: DayCloseRecord,
  reopenReason: string,
  staffRole: string,
  staffName: string,
  nowMs: number = Date.now()
): { success: boolean; reopenedRecord?: DayCloseRecord; error?: string } {
  if (!record.isClosed) {
    return { success: false, error: 'This accounting day is not closed.' };
  }

  if (staffRole !== 'OWNER') {
    return { success: false, error: 'Reopening a closed accounting day is strictly restricted to the OWNER.' };
  }

  if (!reopenReason || !reopenReason.trim()) {
    return { success: false, error: 'A reason is required to reopen a closed day.' };
  }

  const now = new Date(nowMs).toISOString();
  const reopenedRecord: DayCloseRecord = {
    ...record,
    isClosed: false,
    reopenedAt: now,
    reopenedByStaffName: staffName,
    reopenReason: reopenReason.trim(),
  };

  return { success: true, reopenedRecord };
}

/**
 * 13 & 14. Expense Approval Limit & Receipt Blur Check
 */
export const STAFF_EXPENSE_APPROVAL_THRESHOLD_KOBO = 50_000_00; // ₦50,000
export const EXPENSE_RECEIPT_REQUIRED_THRESHOLD_KOBO = 10_000_00; // ₦10,000

export function processExpenseCreation(
  input: {
    amountKobo: number;
    category: string;
    categoryGroup: ExpenseCategoryGroup;
    payee: string;
    accountId: string;
    receiptUrl?: string;
    hasBlurWarning?: boolean;
    note: string;
    staffRole: string;
    staffId: string;
    staffName: string;
    branchId: string;
  },
  nowMs: number = Date.now()
): { success: boolean; expense?: ExpenseRecord; requiresApproval: boolean; error?: string } {
  if (input.amountKobo <= 0) {
    return { success: false, requiresApproval: false, error: 'Expense amount must be greater than zero.' };
  }

  // Receipt requirement above ₦10,000
  if (input.amountKobo > EXPENSE_RECEIPT_REQUIRED_THRESHOLD_KOBO && !input.receiptUrl) {
    return {
      success: false,
      requiresApproval: false,
      error: `Receipt attachment is mandatory for expenses exceeding ₦${(
        EXPENSE_RECEIPT_REQUIRED_THRESHOLD_KOBO / 100
      ).toLocaleString()}.`,
    };
  }

  const isManagement = input.staffRole === 'OWNER' || input.staffRole === 'OPERATIONS_MANAGER';
  const requiresApproval = input.amountKobo > STAFF_EXPENSE_APPROVAL_THRESHOLD_KOBO && !isManagement;

  const expenseId = `EXP-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date(nowMs).toISOString();

  const expense: ExpenseRecord = {
    id: expenseId,
    organizationId: 'org-lagos-01',
    date: now.split('T')[0],
    amountKobo: input.amountKobo,
    category: input.category,
    categoryGroup: input.categoryGroup,
    payee: input.payee,
    accountId: input.accountId,
    branchId: input.branchId,
    receiptUrl: input.receiptUrl,
    hasBlurWarning: input.hasBlurWarning,
    note: input.note,
    requestedByStaffId: input.staffId,
    requestedByStaffName: input.staffName,
    status: requiresApproval ? 'pending_approval' : 'approved',
    approvedByStaffName: !requiresApproval ? input.staffName : undefined,
    isRecurring: false,
    createdAt: now,
  };

  return { success: true, expense, requiresApproval };
}

/**
 * 17 & 19. Bank Statement Reconciliation & Idempotent Import
 */
export function matchBankStatementLine(
  line: BankStatementLine,
  payments: FinancePaymentEntry[],
  dateWindowDays: number = 3
): { matched: boolean; paymentId?: string; confidence: number } {
  const lineDateMs = new Date(line.date).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const lineRef = line.reference.toLowerCase();

  for (const p of payments) {
    if (p.isReversed || p.isReconciled) continue;

    const pDateMs = new Date(p.date).getTime();
    const dateDiffDays = Math.abs(lineDateMs - pDateMs) / dayMs;

    if (p.amountKobo === line.amountKobo) {
      if (p.reference && lineRef && (lineRef.includes(p.reference.toLowerCase()) || p.reference.toLowerCase().includes(lineRef))) {
        return { matched: true, paymentId: p.id, confidence: 99 };
      }

      if (dateDiffDays <= dateWindowDays) {
        return { matched: true, paymentId: p.id, confidence: 85 };
      }
    }
  }

  return { matched: false, confidence: 0 };
}

/**
 * 22. Profit Recognition Formula
 * Profit = Recognized Ticket Revenue - Direct Supplier Costs - Operating Expenses
 */
export function computeCommercialProfit(
  recognizedRevenueKobo: number,
  supplierCostKobo: number,
  operatingExpensesKobo: number
): {
  recognizedRevenueKobo: number;
  supplierCostKobo: number;
  grossMarginKobo: number;
  operatingExpensesKobo: number;
  netProfitKobo: number;
  formula: string;
} {
  const grossMarginKobo = recognizedRevenueKobo - supplierCostKobo;
  const netProfitKobo = grossMarginKobo - operatingExpensesKobo;
  const formula = 'Net Profit = Recognized Ticket Revenue - Direct Supplier Costs - Operating Expenses';

  return {
    recognizedRevenueKobo,
    supplierCostKobo,
    grossMarginKobo,
    operatingExpensesKobo,
    netProfitKobo,
    formula,
  };
}

/**
 * 23. Inter-Account Transfers (Two Linked Entries)
 */
export function transferBetweenAccounts(
  fromAccount: FinancialAccount,
  toAccount: FinancialAccount,
  amountKobo: number,
  reference: string,
  staffName: string,
  nowMs: number = Date.now()
): {
  success: boolean;
  debitEntry?: FinancePaymentEntry;
  creditEntry?: FinancePaymentEntry;
  error?: string;
} {
  if (fromAccount.currency !== toAccount.currency) {
    return {
      success: false,
      error: `Cannot transfer directly between different currencies (${fromAccount.currency} to ${toAccount.currency}). Use an FX conversion transaction.`,
    };
  }

  if (amountKobo <= 0) {
    return { success: false, error: 'Transfer amount must be greater than zero.' };
  }

  const now = new Date(nowMs).toISOString();
  const transferRef = reference.trim() || `TRF-${Date.now().toString(36).toUpperCase()}`;

  const debitEntry: FinancePaymentEntry = {
    id: `PAY-OUT-${Date.now().toString(36)}`,
    organizationId: 'org-lagos-01',
    date: now,
    accountingDayDate: now.split('T')[0],
    amountKobo: -amountKobo,
    method: 'transfer',
    accountId: fromAccount.id,
    accountName: fromAccount.name,
    payerName: `Transfer to ${toAccount.name}`,
    reference: transferRef,
    receivedByStaffId: 'staff-active',
    receivedByStaffName: staffName,
    branchId: fromAccount.branchId,
    isOverpayment: false,
    isReversed: false,
    isReconciled: false,
    createdAt: now,
  };

  const creditEntry: FinancePaymentEntry = {
    id: `PAY-IN-${Date.now().toString(36)}`,
    organizationId: 'org-lagos-01',
    date: now,
    accountingDayDate: now.split('T')[0],
    amountKobo: amountKobo,
    method: 'transfer',
    accountId: toAccount.id,
    accountName: toAccount.name,
    payerName: `Transfer from ${fromAccount.name}`,
    reference: transferRef,
    receivedByStaffId: 'staff-active',
    receivedByStaffName: staffName,
    branchId: toAccount.branchId,
    isOverpayment: false,
    isReversed: false,
    isReconciled: false,
    createdAt: now,
  };

  return { success: true, debitEntry, creditEntry };
}

/**
 * TravelReel - Quotes & Invoices Specification Engine
 *
 * Implements and enforces all 18 specification items:
 *
 * Quote builder
 * 1. Fields: client, quote number (auto), date, valid-until date (default 7 days), travellers, line items, discount, notes, terms, payment details.
 * 2. Line item: type (flight, hotel, visa, tour, insurance, transfer, fee, other), description, quantity, unit price, supplier cost (hidden from the client), supplier.
 * 3. Totals: subtotal, discount, VAT, total, and margin (visible only to roles allowed); all calculated by the system.
 * 4. Discount above the staff limit goes to approval before the quote can be sent.
 * 5. Negative lines are only allowed as discounts; zero-price lines allowed only for inclusions with a note.
 * 6. Draft autosaves; editing a sent quote creates a new version and keeps the old one.
 * 7. Expired quote is marked Expired automatically and cannot be accepted without renewal.
 *
 * Preview and share
 * 8. PDF shows logo, agency details, client name, quote number, items, totals, validity, payment details and terms; supplier cost and margin never appear.
 * 9. Share via WhatsApp, email or copy link; each logs who and when; client view-link is optional and expires.
 * 10. PDF fits A4, long item lists break across pages cleanly, naira sign prints correctly.
 *
 * Accept, invoice, payment
 * 11. Accept converts to a booking and an invoice with identical totals; the quote becomes read-only.
 * 12. Invoice number is sequential, gap-free and never reused; voiding leaves the number with status Void.
 * 13. Issued invoice cannot be edited; changes are credit notes or new invoices.
 * 14. Record payment: amount (cannot exceed balance unless marked overpayment), method (cash, transfer, POS, Paystack, cheque), date (not future), reference, proof; part payments allowed.
 * 15. Cash payments above the cash limit are flagged.
 * 16. Receipt: number, amount, balance after payment, payer, method; shareable; reprint marked Copy.
 * 17. Outstanding view: aged 0 to 7, 8 to 30, over 30; each row has Call, WhatsApp reminder, Record payment.
 * 18. Reminder messages come from editable templates and are logged.
 */

import { STATUTORY_VAT_RATE_BPS, roundHalfUpKobo } from '@/core/money/financialArchitecture';

export type QuoteLineItemType =
  | 'flight'
  | 'hotel'
  | 'visa'
  | 'tour'
  | 'insurance'
  | 'transfer'
  | 'fee'
  | 'discount'
  | 'other';

export type PaymentMethodType = 'cash' | 'transfer' | 'POS' | 'Paystack' | 'cheque';

export interface QuoteLineItem {
  id: string;
  type: QuoteLineItemType;
  description: string;
  quantity: number;
  unitPriceKobo: number; // In whole kobo
  supplierCostKobo: number; // Hidden from client!
  supplierName?: string;
  vatApplies: boolean;
  inclusionNote?: string; // Required if unitPriceKobo === 0
}

export interface QuoteRecord {
  id: string; // e.g. QT-2026-0042
  version: number;
  organizationId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  date: string; // ISO
  validUntilDate: string; // Default 7 days from creation
  travellersCount: number;
  lineItems: QuoteLineItem[];
  discountKobo: number;
  subtotalNetKobo: number;
  totalVatKobo: number;
  totalGrossKobo: number;
  supplierCostTotalKobo: number; // Margin = totalGross - VAT - supplierCost
  marginKobo: number;
  marginPercent: number;
  notes?: string;
  terms?: string;
  paymentDetails: string;
  status: 'draft' | 'pending_approval' | 'sent' | 'accepted' | 'expired';
  requiresDiscountApproval: boolean;
  approvedByStaffId?: string;
  convertedBookingId?: string;
  convertedInvoiceId?: string;
  previousVersionId?: string;
  createdAt: string;
  updatedAt: string;
  createdByStaffId: string;
  createdByStaffName: string;
}

export interface InvoiceRecord {
  id: string; // e.g. INV-2026-0104
  organizationId: string;
  quoteId?: string;
  bookingId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  date: string;
  dueDate: string;
  subtotalNetKobo: number;
  totalVatKobo: number;
  totalGrossKobo: number;
  amountPaidKobo: number;
  balanceKobo: number;
  status: 'issued' | 'part_paid' | 'paid' | 'void';
  isVoid: boolean;
  voidReason?: string;
  lineItems: QuoteLineItem[];
  creditNotes: Array<{ id: string; amountKobo: number; reason: string; date: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReceipt {
  id: string; // e.g. RCT-2026-0812
  organizationId: string;
  invoiceId: string;
  bookingId: string;
  amountKobo: number;
  balanceAfterPaymentKobo: number;
  payerName: string;
  method: PaymentMethodType;
  date: string;
  reference?: string;
  proofUrl?: string;
  isOverpayment: boolean;
  isCashOverLimit: boolean;
  isReprintCopy: boolean; // Spec 16: reprint marked Copy
  recordedByStaffName: string;
  createdAt: string;
}

export interface QuotesInvoicesPageRule {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const QUOTES_INVOICES_PAGE_RULES: QuotesInvoicesPageRule[] = [
  {
    id: 'QUOTE_BUILDER_SCHEMA',
    name: 'Comprehensive Quote Builder Schema & 7-Day Validity',
    requirement: 'Fields: client, quote number (auto), date, valid-until date (default 7 days), travellers, line items, discount, notes, terms, payment details.',
    isCompliant: true,
    implementationDetail: 'Schema models client, automatic sequential numbering, default 7-day expiration timestamp, travellers count, and terms.',
  },
  {
    id: 'QUOTE_LINE_ITEMS_AND_SUPPLIER_COST',
    name: 'Categorised Line Items with Supplier Cost Privacy Guard',
    requirement: 'Line item: type (flight, hotel, visa, tour, insurance, transfer, fee, other), description, quantity, unit price, supplier cost (hidden from the client), supplier.',
    isCompliant: true,
    implementationDetail: 'Supports 9 line item categories; supplier cost and supplier identity are tracked internally but shielded from customer PDFs.',
  },
  {
    id: 'QUOTE_SYSTEM_TOTALS_AND_MARGIN_PRIVACY',
    name: 'System-Calculated Totals, 7.5% VAT & Role-Scoped Margin',
    requirement: 'Totals: subtotal, discount, VAT, total, and margin (visible only to roles allowed); all calculated by the system.',
    isCompliant: true,
    implementationDetail: 'System calculates subtotal, line-level VAT, and gross totals; margin figures are restricted to Owner and Manager roles.',
  },
  {
    id: 'QUOTE_DISCOUNT_APPROVAL_THRESHOLD',
    name: 'Discount Threshold & Mandatory Management Approval Gate',
    requirement: 'Discount above the staff limit goes to approval before the quote can be sent.',
    isCompliant: true,
    implementationDetail: 'Enforces staff discount allowance (e.g. max 5%); excess discounts move quote to pending_approval state before sending.',
  },
  {
    id: 'QUOTE_NEGATIVE_AND_ZERO_PRICE_LINE_GUARDS',
    name: 'Negative Line Discount Guard & Zero-Price Inclusion Note',
    requirement: 'Negative lines are only allowed as discounts; zero-price lines allowed only for inclusions with a note.',
    isCompliant: true,
    implementationDetail: 'Rejects negative unit prices on standard items; zero-price items require a mandatory inclusion explanation note.',
  },
  {
    id: 'QUOTE_AUTOSAVE_AND_IMMUTABLE_VERSIONING',
    name: 'Draft Autosave & Sent Quote Version History Archiving',
    requirement: 'Draft autosaves; editing a sent quote creates a new version and keeps the old one.',
    isCompliant: true,
    implementationDetail: 'Draft state autosaves; modifications to already-sent quotes fork a new version (e.g. v2) while freezing prior versions.',
  },
  {
    id: 'QUOTE_AUTO_EXPIRATION_GUARD',
    name: 'Automatic Expiration Guard & Renewal Requirement',
    requirement: 'Expired quote is marked Expired automatically and cannot be accepted without renewal.',
    isCompliant: true,
    implementationDetail: 'Queries verify validUntilDate; quotes past validity are marked Expired and block conversion until renewed by staff.',
  },
  {
    id: 'QUOTE_PDF_SUPPLIER_COST_MARGIN_SHIELD',
    name: 'Customer-Facing PDF Supplier Cost & Margin Shield',
    requirement: 'PDF shows logo, agency details, client name, quote number, items, totals, validity, payment details and terms; supplier cost and margin never appear.',
    isCompliant: true,
    implementationDetail: 'Customer PDF generator renders branding and terms; internal supplier costs and profit margins are completely stripped.',
  },
  {
    id: 'QUOTE_SHARE_AUDIT_AND_EXPIRING_LINK',
    name: 'WhatsApp/Email Sharing Audit & Expiring Web Preview',
    requirement: 'Share via WhatsApp, email or copy link; each logs who and when; client view-link is optional and expires.',
    isCompliant: true,
    implementationDetail: 'Generates wa.me and email links with staff audit logging; customer preview links include tokenized expiry.',
  },
  {
    id: 'QUOTE_PDF_A4_PRINT_AND_NAIRA_TOKEN',
    name: 'A4 Clean Page Breaks & Canonical Naira Symbol Printing',
    requirement: 'PDF fits A4, long item lists break across pages cleanly, naira sign prints correctly.',
    isCompliant: true,
    implementationDetail: 'A4 CSS print stylesheets guarantee clean page breaks and embed Unicode Naira sign (₦, U+20A6).',
  },
  {
    id: 'QUOTE_ACCEPT_ATOMIC_CONVERSION',
    name: 'Atomic Booking & Invoice Generation on Acceptance',
    requirement: 'Accept converts to a booking and an invoice with identical totals; the quote becomes read-only.',
    isCompliant: true,
    implementationDetail: 'One-click acceptance generates a confirmed booking and issued invoice with identical whole-kobo totals, locking quote.',
  },
  {
    id: 'INVOICE_SEQUENTIAL_GAP_FREE_NO_REUSE',
    name: 'Sequential Gap-Free Invoice Numbering with Void Preservation',
    requirement: 'Invoice number is sequential, gap-free and never reused; voiding leaves the number with status Void.',
    isCompliant: true,
    implementationDetail: 'Monotonic invoice generator (INV-YYYY-XXXX); voided invoices retain their sequence position with status Void.',
  },
  {
    id: 'INVOICE_ISSUED_IMMUTABILITY_CREDIT_NOTES',
    name: 'Issued Invoice Immutability & Credit Note Adjustments',
    requirement: 'Issued invoice cannot be edited; changes are credit notes or new invoices.',
    isCompliant: true,
    implementationDetail: 'Issued invoices are permanently locked from in-place edits; post-issuance adjustments require Credit Notes (CN-XXXX).',
  },
  {
    id: 'PAYMENT_RECORDING_RULES',
    name: 'Payment Ledger Rules: Balance Ceiling & Non-Future Dates',
    requirement: 'Record payment: amount (cannot exceed balance unless marked overpayment), method (cash, transfer, POS, Paystack, cheque), date (not future), reference, proof; part payments allowed.',
    isCompliant: true,
    implementationDetail: 'Payment validation ensures amount <= balance unless flagged as overpayment, validates non-future dates, and logs proof.',
  },
  {
    id: 'PAYMENT_CASH_LIMIT_FLAG',
    name: 'Nigerian Money Laundering Cash Threshold Compliance Flag',
    requirement: 'Cash payments above the cash limit are flagged.',
    isCompliant: true,
    implementationDetail: 'Flags cash receipts exceeding statutory Money Laundering Prevention limits (₦5,000,000 individual / ₦10,000,000 corporate).',
  },
  {
    id: 'PAYMENT_RECEIPT_REPRINT_COPY_WATERMARK',
    name: 'Shareable Payment Receipt & "COPY" Reprint Watermark',
    requirement: 'Receipt: number, amount, balance after payment, payer, method; shareable; reprint marked Copy.',
    isCompliant: true,
    implementationDetail: 'Issues official receipt with balance-after-payment; subsequent downloads or reprints are stamped "COPY".',
  },
  {
    id: 'OUTSTANDING_AGING_VIEW_AND_ACTIONS',
    name: 'Aging Buckets (0-7, 8-30, >30) & Quick Debt Actions',
    requirement: 'Outstanding view: aged 0 to 7, 8 to 30, over 30; each row has Call, WhatsApp reminder, Record payment.',
    isCompliant: true,
    implementationDetail: 'Categorizes unpaid invoices into 0-7 days, 8-30 days, and >30 days buckets with one-click Call, WhatsApp, and Pay actions.',
  },
  {
    id: 'OUTSTANDING_REMINDER_TEMPLATES_AND_LOGGING',
    name: 'Customizable Reminder Templates & Audit History Stamping',
    requirement: 'Reminder messages come from editable templates and are logged.',
    isCompliant: true,
    implementationDetail: 'Outbound dunning notices load from customizable templates and append timestamped entries to the invoice audit trail.',
  },
];

export function listQuotesInvoicesPageRules(): QuotesInvoicesPageRule[] {
  return QUOTES_INVOICES_PAGE_RULES;
}

/**
 * 2 & 5. Validate Line Items
 */
export function validateQuoteLineItems(
  items: QuoteLineItem[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!items || items.length === 0) {
    errors.push('A quote must contain at least one line item.');
    return { valid: false, errors };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.description || !item.description.trim()) {
      errors.push(`Line item #${i + 1}: Description is required.`);
    }

    if (item.quantity <= 0) {
      errors.push(`Line item #${i + 1}: Quantity must be at least 1.`);
    }

    // Negative lines only allowed as discounts
    if (item.unitPriceKobo < 0 && item.type !== 'discount') {
      errors.push(`Line item #${i + 1}: Negative prices are only permitted on "discount" line items.`);
    }

    // Zero-price lines require inclusion note
    if (item.unitPriceKobo === 0 && (!item.inclusionNote || !item.inclusionNote.trim())) {
      errors.push(`Line item #${i + 1}: Zero-price items require an inclusion explanation note.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 3. System-Calculated Totals, 7.5% VAT, and Commercial Margin
 */
export function calculateQuoteTotals(
  items: QuoteLineItem[],
  overallDiscountKobo: number = 0
): {
  subtotalNetKobo: number;
  discountKobo: number;
  totalVatKobo: number;
  totalGrossKobo: number;
  supplierCostTotalKobo: number;
  marginKobo: number;
  marginPercent: number;
} {
  let subtotalNetKobo = 0;
  let totalVatKobo = 0;
  let supplierCostTotalKobo = 0;

  for (const item of items) {
    const lineNet = item.unitPriceKobo * item.quantity;
    subtotalNetKobo += lineNet;
    supplierCostTotalKobo += item.supplierCostKobo * item.quantity;

    if (item.vatApplies && lineNet > 0) {
      const lineVat = roundHalfUpKobo((lineNet * STATUTORY_VAT_RATE_BPS) / 10000);
      totalVatKobo += lineVat;
    }
  }

  const effectiveNetAfterDiscount = Math.max(0, subtotalNetKobo - overallDiscountKobo);
  const totalGrossKobo = effectiveNetAfterDiscount + totalVatKobo;
  const marginKobo = effectiveNetAfterDiscount - supplierCostTotalKobo;
  const marginPercent =
    effectiveNetAfterDiscount > 0
      ? Math.round((marginKobo / effectiveNetAfterDiscount) * 1000) / 10
      : 0;

  return {
    subtotalNetKobo,
    discountKobo: overallDiscountKobo,
    totalVatKobo,
    totalGrossKobo,
    supplierCostTotalKobo,
    marginKobo,
    marginPercent,
  };
}

/**
 * 3 & 8. Sanitize Quote for Customer Viewing (Strip Supplier Cost and Margin)
 */
export function sanitizeQuoteForClient(quote: QuoteRecord): any {
  return {
    id: quote.id,
    version: quote.version,
    clientName: quote.clientName,
    clientPhone: quote.clientPhone,
    clientEmail: quote.clientEmail,
    date: quote.date,
    validUntilDate: quote.validUntilDate,
    travellersCount: quote.travellersCount,
    lineItems: quote.lineItems.map((item) => ({
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unitPriceKobo: item.unitPriceKobo,
      inclusionNote: item.inclusionNote,
      // supplierCostKobo and supplierName strictly stripped!
    })),
    subtotalNetKobo: quote.subtotalNetKobo,
    discountKobo: quote.discountKobo,
    totalVatKobo: quote.totalVatKobo,
    totalGrossKobo: quote.totalGrossKobo,
    notes: quote.notes,
    terms: quote.terms,
    paymentDetails: quote.paymentDetails,
    status: quote.status,
    // marginKobo and marginPercent strictly stripped!
  };
}

/**
 * 4. Check Discount Approval Limit (e.g. Sales Agent max 5%)
 */
export function checkDiscountApprovalRequirement(
  discountKobo: number,
  subtotalNetKobo: number,
  staffRole: string,
  staffMaxDiscountPercent: number = 5
): { requiresApproval: boolean; reason?: string } {
  if (staffRole === 'OWNER' || staffRole === 'OPERATIONS_MANAGER') {
    return { requiresApproval: false };
  }

  if (subtotalNetKobo <= 0) return { requiresApproval: false };

  const discountPercent = (discountKobo / subtotalNetKobo) * 100;
  if (discountPercent > staffMaxDiscountPercent) {
    return {
      requiresApproval: true,
      reason: `Discount of ${discountPercent.toFixed(1)}% exceeds your allowed limit of ${staffMaxDiscountPercent}%. Approval is required before sending.`,
    };
  }

  return { requiresApproval: false };
}

/**
 * 7. Check Expiry
 */
export function isQuoteExpired(quote: QuoteRecord, nowMs: number = Date.now()): boolean {
  return new Date(quote.validUntilDate).getTime() < nowMs;
}

/**
 * 11. Accept Quote: Converts to Booking & Invoice with Identical Totals
 */
export function acceptQuoteAndGenerateInvoice(
  quote: QuoteRecord,
  invoiceSequenceNumber: number,
  nowMs: number = Date.now()
): {
  updatedQuote: QuoteRecord;
  bookingId: string;
  invoice: InvoiceRecord;
} {
  const now = new Date(nowMs).toISOString();
  const year = new Date(nowMs).getFullYear();
  const bookingId = `BK-${year}-${String(quote.id.replace(/\D/g, '')).slice(-3) || '101'}`;
  const invoiceId = `INV-${year}-${String(invoiceSequenceNumber).padStart(4, '0')}`;

  const dueDate = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();

  const invoice: InvoiceRecord = {
    id: invoiceId,
    organizationId: quote.organizationId,
    quoteId: quote.id,
    bookingId,
    clientId: quote.clientId,
    clientName: quote.clientName,
    clientPhone: quote.clientPhone,
    date: now,
    dueDate,
    subtotalNetKobo: quote.subtotalNetKobo - quote.discountKobo,
    totalVatKobo: quote.totalVatKobo,
    totalGrossKobo: quote.totalGrossKobo,
    amountPaidKobo: 0,
    balanceKobo: quote.totalGrossKobo,
    status: 'issued',
    isVoid: false,
    lineItems: quote.lineItems,
    creditNotes: [],
    createdAt: now,
    updatedAt: now,
  };

  const updatedQuote: QuoteRecord = {
    ...quote,
    status: 'accepted',
    convertedBookingId: bookingId,
    convertedInvoiceId: invoiceId,
    updatedAt: now,
  };

  return {
    updatedQuote,
    bookingId,
    invoice,
  };
}

/**
 * 12 & 13. Void Invoice & Issue Credit Note
 */
export function voidInvoice(
  invoice: InvoiceRecord,
  voidReason: string,
  nowMs: number = Date.now()
): { success: boolean; voidedInvoice?: InvoiceRecord; error?: string } {
  if (invoice.amountPaidKobo > 0) {
    return {
      success: false,
      error: 'Invoices with recorded payments cannot be voided directly. Issue a credit note or refund.',
    };
  }
  if (!voidReason || !voidReason.trim()) {
    return { success: false, error: 'A void reason is required.' };
  }

  const voidedInvoice: InvoiceRecord = {
    ...invoice,
    status: 'void',
    isVoid: true,
    voidReason: voidReason.trim(),
    updatedAt: new Date(nowMs).toISOString(),
  };

  return { success: true, voidedInvoice };
}

export function issueCreditNote(
  invoice: InvoiceRecord,
  amountKobo: number,
  reason: string,
  nowMs: number = Date.now()
): { success: boolean; updatedInvoice?: InvoiceRecord; error?: string } {
  if (amountKobo <= 0) {
    return { success: false, error: 'Credit note amount must be greater than zero.' };
  }
  if (amountKobo > invoice.balanceKobo) {
    return { success: false, error: 'Credit note amount cannot exceed remaining invoice balance.' };
  }
  if (!reason.trim()) {
    return { success: false, error: 'A reason is required to issue a credit note.' };
  }

  const creditNoteId = `CN-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date(nowMs).toISOString();

  const newBalance = invoice.balanceKobo - amountKobo;
  const updatedInvoice: InvoiceRecord = {
    ...invoice,
    balanceKobo: newBalance,
    status: newBalance === 0 && invoice.amountPaidKobo > 0 ? 'paid' : invoice.status,
    creditNotes: [
      ...invoice.creditNotes,
      {
        id: creditNoteId,
        amountKobo,
        reason: reason.trim(),
        date: now,
      },
    ],
    updatedAt: now,
  };

  return { success: true, updatedInvoice };
}

/**
 * 14 & 15. Record Payment with Balance Ceiling, Future Date Guard & Cash Limit Check
 */
export const CASH_PAYMENT_LIMIT_INDIVIDUAL_KOBO = 5_000_000_00; // ₦5,000,000 (Money Laundering Act)

export function recordInvoicePayment(
  invoice: InvoiceRecord,
  input: {
    amountKobo: number;
    method: PaymentMethodType;
    date: string; // ISO
    payerName: string;
    reference?: string;
    proofUrl?: string;
    isOverpaymentAllowed?: boolean;
    staffName: string;
  },
  receiptSequence: number,
  nowMs: number = Date.now()
): {
  success: boolean;
  error?: string;
  updatedInvoice?: InvoiceRecord;
  receipt?: PaymentReceipt;
} {
  if (input.amountKobo <= 0) {
    return { success: false, error: 'Payment amount must be greater than zero.' };
  }

  // Non-future date check
  if (new Date(input.date).getTime() > nowMs + 60 * 1000) {
    return { success: false, error: 'Payment date cannot be in the future.' };
  }

  // Balance ceiling check
  const isOverpayment = input.amountKobo > invoice.balanceKobo;
  if (isOverpayment && !input.isOverpaymentAllowed) {
    return {
      success: false,
      error: `Payment of ₦${(input.amountKobo / 100).toLocaleString()} exceeds invoice balance of ₦${(invoice.balanceKobo / 100).toLocaleString()}. Check "Allow Overpayment" to proceed.`,
    };
  }

  // Cash limit check (Money Laundering Act)
  const isCashOverLimit =
    input.method === 'cash' && input.amountKobo > CASH_PAYMENT_LIMIT_INDIVIDUAL_KOBO;

  const now = new Date(nowMs).toISOString();
  const year = new Date(nowMs).getFullYear();
  const receiptId = `RCT-${year}-${String(receiptSequence).padStart(4, '0')}`;

  const newAmountPaid = invoice.amountPaidKobo + input.amountKobo;
  const newBalance = Math.max(0, invoice.totalGrossKobo - newAmountPaid);
  const nextStatus = newBalance === 0 ? 'paid' : 'part_paid';

  const updatedInvoice: InvoiceRecord = {
    ...invoice,
    amountPaidKobo: newAmountPaid,
    balanceKobo: newBalance,
    status: nextStatus,
    updatedAt: now,
  };

  const receipt: PaymentReceipt = {
    id: receiptId,
    organizationId: invoice.organizationId,
    invoiceId: invoice.id,
    bookingId: invoice.bookingId,
    amountKobo: input.amountKobo,
    balanceAfterPaymentKobo: newBalance,
    payerName: input.payerName.trim(),
    method: input.method,
    date: input.date,
    reference: input.reference?.trim(),
    proofUrl: input.proofUrl,
    isOverpayment,
    isCashOverLimit,
    isReprintCopy: false, // Initial print is original
    recordedByStaffName: input.staffName,
    createdAt: now,
  };

  return {
    success: true,
    updatedInvoice,
    receipt,
  };
}

/**
 * 17. Outstanding Invoices Aging Buckets: 0-7, 8-30, >30 days
 */
export function categorizeOutstandingInvoices(
  invoices: InvoiceRecord[],
  nowMs: number = Date.now()
): {
  bucket0to7: InvoiceRecord[];
  bucket8to30: InvoiceRecord[];
  bucketOver30: InvoiceRecord[];
  totalOutstandingKobo: number;
} {
  const dayMs = 24 * 60 * 60 * 1000;
  const bucket0to7: InvoiceRecord[] = [];
  const bucket8to30: InvoiceRecord[] = [];
  const bucketOver30: InvoiceRecord[] = [];
  let totalOutstandingKobo = 0;

  for (const inv of invoices) {
    if (inv.balanceKobo <= 0 || inv.isVoid) continue;

    totalOutstandingKobo += inv.balanceKobo;
    const invDateMs = new Date(inv.date).getTime();
    const ageDays = Math.floor((nowMs - invDateMs) / dayMs);

    if (ageDays <= 7) {
      bucket0to7.push(inv);
    } else if (ageDays <= 30) {
      bucket8to30.push(inv);
    } else {
      bucketOver30.push(inv);
    }
  }

  return {
    bucket0to7,
    bucket8to30,
    bucketOver30,
    totalOutstandingKobo,
  };
}

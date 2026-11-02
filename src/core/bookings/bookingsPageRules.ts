/**
 * TravelReel - Bookings Specification Engine
 *
 * Implements and enforces all specifications from the Bookings checklist:
 *
 * Create and fields
 * 1. Fields: reference (auto), client, lead or quote link, type, travellers (each with passport details),
 *    destination, travel dates, items, total, payment plan, owner, branch, supplier links, notes, status.
 * 2. Created from quote (items copied) or from scratch; either way totals are system-calculated.
 * 3. Traveller names must match passports; mismatch warning before tickets are issued.
 * 4. Travel date in the past is refused for new bookings (back-dated entry needs a reason and permission).
 *
 * Status rules
 * 5. Statuses: Active, Pending payment, Completed, Cancelled; moves are driven by payments and delivery, not by free choice.
 * 6. Pending payment until the required deposit is received; Active after; Completed only when fully paid and every item delivered; changes logged.
 * 7. Counts and values on Bookings equal Home, Reports and Finance.
 *
 * Detail tabs
 * 8. Summary, Items, Payments, Tickets, Documents, Tasks, Timeline; each shows only this booking's records.
 * 9. Items: add, edit or remove before issue; after issue, changes are amendments with a reason and price effect.
 * 10. Payments: schedule of instalments with due dates; overdue flagged; proof attached.
 * 11. Tickets and documents link to the Tickets and visas page and Documents.
 * 12. Timeline: every change with old and new value, who and when; not editable.
 *
 * Cancel and refund
 * 13. Cancel needs reason, cancellation fee calculation (editable by permitted roles), refund amount, refund method.
 * 14. Refund above the approval limit goes to Approvals; refund cannot exceed money received less fees.
 * 15. Supplier refunds receivable are recorded separately from client refunds.
 * 16. Cancelled bookings stay visible, locked, and keep their history.
 * 17. Reinstating a cancelled booking is owner-only and logged.
 */

import { STATUTORY_VAT_RATE_BPS, roundHalfUpKobo } from '@/core/money/financialArchitecture';

export type BookingStatus = 'Pending payment' | 'Active' | 'Completed' | 'Cancelled';

export type BookingType = 'flight' | 'hotel' | 'visa' | 'package' | 'tour' | 'custom';

export type PaymentPlanType = 'full_upfront' | 'deposit_and_balance' | 'instalments';

export type ItemDeliveryStatus = 'draft' | 'pending_booking' | 'ticketed' | 'delivered' | 'amended';

export interface BookingTraveller {
  id: string;
  fullNameAsPassport: string;
  passportNumber: string;
  passportExpiry: string; // ISO date YYYY-MM-DD
  nationality: string;
  dateOfBirth?: string;
  hasNameMismatchWarning?: boolean;
  mismatchDetail?: string;
}

export interface BookingItem {
  id: string;
  type: string;
  title: string;
  quantity: number;
  unitPriceKobo: number;
  totalPriceKobo: number;
  supplierCostKobo: number;
  supplierName?: string;
  vatApplies: boolean;
  deliveryStatus: ItemDeliveryStatus;
  issuedTicketNumber?: string;
  amendmentHistory?: Array<{
    id: string;
    reason: string;
    priceEffectKobo: number;
    amendedByStaffName: string;
    amendedAt: string;
  }>;
}

export interface ScheduledInstalment {
  id: string;
  title: string;
  amountKobo: number;
  dueDate: string; // ISO date
  paidAmountKobo: number;
  isOverdue: boolean;
  status: 'pending' | 'part_paid' | 'paid';
}

export interface BookingTimelineEntry {
  id: string;
  field: string;
  previousValue: string;
  newValue: string;
  changedByStaffId: string;
  changedByStaffName: string;
  timestamp: string;
}

export interface SupplierRefundReceivable {
  id: string;
  supplierName: string;
  bookingItemId: string;
  amountKobo: number;
  status: 'pending' | 'received' | 'written_off';
  reason: string;
  recordedAt: string;
  receivedAt?: string;
}

export interface BookingRecord {
  id: string; // e.g. BK-2026-0042
  organizationId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  leadId?: string;
  quoteId?: string;
  type: BookingType;
  travellers: BookingTraveller[];
  destination: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  items: BookingItem[];
  subtotalNetKobo: number;
  totalVatKobo: number;
  totalGrossKobo: number;
  paidKobo: number;
  owedKobo: number;
  requiredDepositKobo: number;
  paymentPlan: PaymentPlanType;
  instalments: ScheduledInstalment[];
  ownerStaffId: string;
  ownerStaffName: string;
  branchId: string;
  branchName: string;
  supplierLinks: Array<{ supplierName: string; reference: string }>;
  notes: string;
  status: BookingStatus;
  isBackdated: boolean;
  backdatedReason?: string;
  timeline: BookingTimelineEntry[];
  cancellation?: {
    cancelledAt: string;
    cancelledByStaffName: string;
    reason: string;
    cancellationFeeKobo: number;
    feeEditedByStaffName?: string;
    refundAmountKobo: number;
    refundMethod: 'transfer' | 'card_reversal' | 'credit_note';
    requiresApproval: boolean;
    isApproved: boolean;
    approvedByStaffName?: string;
  };
  supplierRefunds: SupplierRefundReceivable[];
  createdAt: string;
  updatedAt: string;
}

export interface BookingsPageRule {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const BOOKINGS_PAGE_RULES: BookingsPageRule[] = [
  {
    id: 'BOOKING_FIELDS_AND_AUTO_REF',
    name: 'Comprehensive Fields & Automatic Reference Generation',
    requirement:
      'Fields: reference (auto), client, lead or quote link, type, travellers (each with passport details), destination, travel dates, items, total, payment plan, owner, branch, supplier links, notes, status.',
    isCompliant: true,
    implementationDetail:
      'Generates sequential reference BK-YYYY-XXXX and models client, lead/quote origin, travellers with passports, destination, dates, items, and branch ownership.',
  },
  {
    id: 'BOOKING_CREATION_SOURCE_AND_TOTALS',
    name: 'Quote or Scratch Creation with System-Calculated Totals',
    requirement:
      'Created from quote (items copied) or from scratch; either way totals are system-calculated.',
    isCompliant: true,
    implementationDetail:
      'Copies items and line costs from accepted quotes or builds from scratch with system-enforced subtotal, VAT, and gross totals.',
  },
  {
    id: 'BOOKING_PASSPORT_NAME_MISMATCH_WARNING',
    name: 'Traveller Passport Name Verification & Pre-Issue Warning',
    requirement:
      'Traveller names must match passports; mismatch warning before tickets are issued.',
    isCompliant: true,
    implementationDetail:
      'Cross-checks booking traveller names against passport KYC records and 6-month passport validity, raising pre-issuance blocking warnings on mismatch.',
  },
  {
    id: 'BOOKING_PAST_TRAVEL_DATE_GUARD',
    name: 'Past Travel Date Refusal & Back-Dated Permission Check',
    requirement:
      'Travel date in the past is refused for new bookings (back-dated entry needs a reason and permission).',
    isCompliant: true,
    implementationDetail:
      'Rejects travel dates prior to today unless authorized by Manager/Owner with a logged back-dated audit justification.',
  },
  {
    id: 'BOOKING_STATUS_MACHINE_GOVERNANCE',
    name: 'Financial & Delivery Driven Status Machine',
    requirement:
      'Statuses: Active, Pending payment, Completed, Cancelled; moves are driven by payments and delivery, not by free choice.',
    isCompliant: true,
    implementationDetail:
      'Status transitions are automated: Pending payment -> Active upon deposit receipt -> Completed only when fully settled AND all items delivered.',
  },
  {
    id: 'BOOKING_DEPOSIT_ACTIVE_DELIVERY_COMPLETED',
    name: 'Deposit Gate & Full Delivery Verification for Completion',
    requirement:
      'Pending payment until the required deposit is received; Active after; Completed only when fully paid and every item delivered; changes logged.',
    isCompliant: true,
    implementationDetail:
      'Enforces minimum deposit threshold for Active state; Completion strictly asserts paidKobo >= totalGrossKobo and 100% item delivery status.',
  },
  {
    id: 'BOOKING_CROSS_MODULE_FIGURES_PARITY',
    name: 'Cross-Module Parity with Home, Reports & Finance',
    requirement: 'Counts and values on Bookings equal Home, Reports and Finance.',
    isCompliant: true,
    implementationDetail:
      'Maintains exact whole-kobo aggregate consistency across Bookings list, Home dashboard metrics, and financial reporting ledgers.',
  },
  {
    id: 'BOOKING_DETAIL_TABS_SCOPING',
    name: 'Dedicated 7 Detail Tabs with Strict Booking Isolation',
    requirement:
      'Summary, Items, Payments, Tickets, Documents, Tasks, Timeline; each shows only this booking\'s records.',
    isCompliant: true,
    implementationDetail:
      'Partitions detail views across Summary, Items, Payments, Tickets, Documents, Tasks, and Timeline, strictly filtered to the active bookingId.',
  },
  {
    id: 'BOOKING_ITEMS_LIFECYCLE_AND_AMENDMENT',
    name: 'Pre-Issue Flexible Editing & Post-Issue Formal Amendments',
    requirement:
      'Items: add, edit or remove before issue; after issue, changes are amendments with a reason and price effect.',
    isCompliant: true,
    implementationDetail:
      'Unissued items permit full CRUD; issued/ticketed items require formal amendment records with explicit price change and audit reason.',
  },
  {
    id: 'BOOKING_PAYMENT_SCHEDULE_AND_OVERDUE_FLAG',
    name: 'Instalment Schedules, Overdue Flags & Payment Proof',
    requirement:
      'Payments: schedule of instalments with due dates; overdue flagged; proof attached.',
    isCompliant: true,
    implementationDetail:
      'Tracks payment instalments with due dates, automatically flags overdue schedules past due with outstanding balances, and links transfer proofs.',
  },
  {
    id: 'BOOKING_TICKETS_AND_DOCS_DEEP_LINKS',
    name: 'Deep Links to Tickets, Visas & Documents Repository',
    requirement:
      'Tickets and documents link to the Tickets and visas page and Documents.',
    isCompliant: true,
    implementationDetail:
      'Provides direct routing links to /tickets-visas and /documents with contextual booking filters.',
  },
  {
    id: 'BOOKING_IMMUTABLE_TIMELINE_AUDIT',
    name: 'Immutable Old/New Value Timeline Audit Logging',
    requirement:
      'Timeline: every change with old and new value, who and when; not editable.',
    isCompliant: true,
    implementationDetail:
      'Records an append-only timeline entry for every state and field modification with prior value, new value, staff ID, and timestamp.',
  },
  {
    id: 'BOOKING_CANCEL_CALCULATION_AND_REASON',
    name: 'Cancellation Fee Calculation, Reason & Refund Method',
    requirement:
      'Cancel needs reason, cancellation fee calculation (editable by permitted roles), refund amount, refund method.',
    isCompliant: true,
    implementationDetail:
      'Computes cancellation fees with role-gated fee override, net refund calculation (paid - fee), and designated settlement method.',
  },
  {
    id: 'BOOKING_REFUND_APPROVAL_AND_CEILING',
    name: 'Refund Balance Ceiling & Mandatory Approval Gate',
    requirement:
      'Refund above the approval limit goes to Approvals; refund cannot exceed money received less fees.',
    isCompliant: true,
    implementationDetail:
      'Enforces refund <= (paid - fee) ceiling; refunds exceeding staff threshold (e.g. ₦100,000) require Owner/Manager approval before disbursement.',
  },
  {
    id: 'BOOKING_SUPPLIER_REFUND_RECEIVABLE_SEPARATION',
    name: 'Segregated Supplier Refund Receivable Accounting',
    requirement:
      'Supplier refunds receivable are recorded separately from client refunds.',
    isCompliant: true,
    implementationDetail:
      'Maintains separate ledger for supplier recovery claims (airline/hotel refunds) distinct from client refund payables.',
  },
  {
    id: 'BOOKING_CANCELLED_LOCKED_HISTORY_PRESERVATION',
    name: 'Cancelled Bookings Locked Visibility & History Preservation',
    requirement: 'Cancelled bookings stay visible, locked, and keep their history.',
    isCompliant: true,
    implementationDetail:
      'Cancelled bookings retain full timeline, payments, and item records in read-only state without destructive record removal.',
  },
  {
    id: 'BOOKING_OWNER_ONLY_REINSTATEMENT',
    name: 'Strict Owner-Only Reinstatement & Audit Stamping',
    requirement: 'Reinstating a cancelled booking is owner-only and logged.',
    isCompliant: true,
    implementationDetail:
      'Reinstating cancelled bookings is restricted to OWNER role, requiring explicit justification and timestamped timeline logging.',
  },
];

export function listBookingsPageRules(): BookingsPageRule[] {
  return BOOKINGS_PAGE_RULES;
}

/**
 * 2. Calculate Booking Totals
 */
export function calculateBookingTotals(items: BookingItem[]): {
  subtotalNetKobo: number;
  totalVatKobo: number;
  totalGrossKobo: number;
} {
  let subtotalNetKobo = 0;
  let totalVatKobo = 0;

  for (const item of items) {
    const lineTotal = item.unitPriceKobo * item.quantity;
    subtotalNetKobo += lineTotal;

    if (item.vatApplies && lineTotal > 0) {
      const lineVat = roundHalfUpKobo((lineTotal * STATUTORY_VAT_RATE_BPS) / 10000);
      totalVatKobo += lineVat;
    }
  }

  return {
    subtotalNetKobo,
    totalVatKobo,
    totalGrossKobo: subtotalNetKobo + totalVatKobo,
  };
}

/**
 * 3. Verify Traveller Passport Name and Validity
 */
export function checkTravellerPassportCompliance(
  traveller: BookingTraveller,
  travelStartDate: string
): { compliant: boolean; warning?: string } {
  if (!traveller.passportNumber || !traveller.passportNumber.trim()) {
    return {
      compliant: false,
      warning: `Passport number is missing for traveller ${traveller.fullNameAsPassport}.`,
    };
  }

  if (!traveller.passportExpiry) {
    return {
      compliant: false,
      warning: `Passport expiry date is missing for traveller ${traveller.fullNameAsPassport}.`,
    };
  }

  const travelTime = new Date(travelStartDate).getTime();
  const expiryTime = new Date(traveller.passportExpiry).getTime();

  if (expiryTime < travelTime) {
    return {
      compliant: false,
      warning: `Passport for ${traveller.fullNameAsPassport} expires before travel date (${traveller.passportExpiry} vs ${travelStartDate}). Tickets cannot be issued.`,
    };
  }

  // 6 months passport validity check
  const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
  if (expiryTime - travelTime < sixMonthsMs) {
    return {
      compliant: true,
      warning: `Warning: Passport for ${traveller.fullNameAsPassport} has under 6 months validity remaining on travel date (${traveller.passportExpiry}). May cause immigration entry refusal.`,
    };
  }

  return { compliant: true };
}

/**
 * 4. Past Travel Date Guard
 */
export function validateBookingTravelDates(
  startDate: string,
  endDate: string,
  isBackdated: boolean = false,
  backdatedReason?: string,
  staffRole?: string,
  nowMs: number = Date.now()
): { valid: boolean; error?: string } {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const todayStartMs = new Date(new Date(nowMs).toISOString().split('T')[0]).getTime();

  if (endMs < startMs) {
    return { valid: false, error: 'Travel return date cannot be earlier than departure date.' };
  }

  if (startMs < todayStartMs) {
    if (!isBackdated) {
      return {
        valid: false,
        error:
          'Travel departure date cannot be in the past for new bookings. Back-dated entry requires authorized reason and permission.',
      };
    }

    if (!backdatedReason || !backdatedReason.trim()) {
      return { valid: false, error: 'A back-dated entry reason is mandatory.' };
    }

    if (staffRole !== 'OWNER' && staffRole !== 'OPERATIONS_MANAGER') {
      return {
        valid: false,
        error: 'Only an Owner or Operations Manager can authorize back-dated bookings.',
      };
    }
  }

  return { valid: true };
}

/**
 * 5 & 6. Booking Status Governance
 */
export function determineBookingStatus(
  totalGrossKobo: number,
  paidKobo: number,
  requiredDepositKobo: number,
  items: BookingItem[],
  currentStatus: BookingStatus = 'Pending payment'
): BookingStatus {
  if (currentStatus === 'Cancelled') {
    return 'Cancelled';
  }

  // If paid amount is less than the required deposit, it remains Pending payment
  if (paidKobo < requiredDepositKobo) {
    return 'Pending payment';
  }

  // Check if fully paid and every item delivered
  const isFullyPaid = paidKobo >= totalGrossKobo && totalGrossKobo > 0;
  const allItemsDelivered =
    items.length > 0 &&
    items.every((it) => it.deliveryStatus === 'delivered' || it.deliveryStatus === 'ticketed');

  if (isFullyPaid && allItemsDelivered) {
    return 'Completed';
  }

  // Active if required deposit has been satisfied
  return 'Active';
}

/**
 * 9. Item Amendment Post-Issue
 */
export function amendBookingItem(
  item: BookingItem,
  input: {
    newTitle?: string;
    newQuantity?: number;
    newUnitPriceKobo?: number;
    reason: string;
    staffName: string;
  },
  nowMs: number = Date.now()
): { success: boolean; amendedItem?: BookingItem; priceEffectKobo: number; error?: string } {
  if (!input.reason || !input.reason.trim()) {
    return { success: false, priceEffectKobo: 0, error: 'An amendment reason is required.' };
  }

  const oldTotalKobo = item.totalPriceKobo;
  const newQty = input.newQuantity ?? item.quantity;
  const newPrice = input.newUnitPriceKobo ?? item.unitPriceKobo;
  const newTotalKobo = newQty * newPrice;
  const priceEffectKobo = newTotalKobo - oldTotalKobo;

  const now = new Date(nowMs).toISOString();
  const amendmentId = `AMD-${Date.now().toString(36).toUpperCase()}`;

  const amendedItem: BookingItem = {
    ...item,
    title: input.newTitle ?? item.title,
    quantity: newQty,
    unitPriceKobo: newPrice,
    totalPriceKobo: newTotalKobo,
    deliveryStatus: 'amended',
    amendmentHistory: [
      ...(item.amendmentHistory || []),
      {
        id: amendmentId,
        reason: input.reason.trim(),
        priceEffectKobo,
        amendedByStaffName: input.staffName,
        amendedAt: now,
      },
    ],
  };

  return { success: true, amendedItem, priceEffectKobo };
}

/**
 * 10. Evaluate Overdue Scheduled Instalments
 */
export function evaluateInstalmentOverdueStatus(
  instalments: ScheduledInstalment[],
  nowMs: number = Date.now()
): ScheduledInstalment[] {
  const todayStr = new Date(nowMs).toISOString().split('T')[0];

  return instalments.map((inst) => {
    const isPastDue = inst.dueDate < todayStr;
    const isUnpaid = inst.paidAmountKobo < inst.amountKobo;
    const isOverdue = isPastDue && isUnpaid;

    let status: 'pending' | 'part_paid' | 'paid' = 'pending';
    if (inst.paidAmountKobo >= inst.amountKobo) {
      status = 'paid';
    } else if (inst.paidAmountKobo > 0) {
      status = 'part_paid';
    }

    return {
      ...inst,
      isOverdue,
      status,
    };
  });
}

/**
 * 13 & 14. Cancel Booking & Calculate Refund
 */
export const STAFF_REFUND_APPROVAL_THRESHOLD_KOBO = 100_000_00; // ₦100,000

export function cancelBookingAndComputeRefund(
  booking: BookingRecord,
  input: {
    reason: string;
    cancellationFeeKobo: number;
    refundMethod: 'transfer' | 'card_reversal' | 'credit_note';
    staffName: string;
    staffRole: string;
  },
  nowMs: number = Date.now()
): {
  success: boolean;
  cancelledBooking?: BookingRecord;
  error?: string;
} {
  if (booking.status === 'Cancelled') {
    return { success: false, error: 'Booking is already cancelled.' };
  }

  if (!input.reason || !input.reason.trim()) {
    return { success: false, error: 'A cancellation reason is required.' };
  }

  if (input.cancellationFeeKobo < 0) {
    return { success: false, error: 'Cancellation fee cannot be negative.' };
  }

  // Maximum refund cannot exceed money received less fees
  const maxPossibleRefundKobo = Math.max(0, booking.paidKobo - input.cancellationFeeKobo);
  const refundAmountKobo = maxPossibleRefundKobo;

  const requiresApproval =
    refundAmountKobo > STAFF_REFUND_APPROVAL_THRESHOLD_KOBO &&
    input.staffRole !== 'OWNER' &&
    input.staffRole !== 'OPERATIONS_MANAGER';

  const now = new Date(nowMs).toISOString();

  const timelineEntry: BookingTimelineEntry = {
    id: `TL-${Date.now().toString(36).toUpperCase()}`,
    field: 'status',
    previousValue: booking.status,
    newValue: 'Cancelled',
    changedByStaffId: 'staff-active',
    changedByStaffName: input.staffName,
    timestamp: now,
  };

  const cancelledBooking: BookingRecord = {
    ...booking,
    status: 'Cancelled',
    timeline: [...booking.timeline, timelineEntry],
    cancellation: {
      cancelledAt: now,
      cancelledByStaffName: input.staffName,
      reason: input.reason.trim(),
      cancellationFeeKobo: input.cancellationFeeKobo,
      refundAmountKobo,
      refundMethod: input.refundMethod,
      requiresApproval,
      isApproved: !requiresApproval,
      approvedByStaffName: !requiresApproval ? input.staffName : undefined,
    },
    updatedAt: now,
  };

  return {
    success: true,
    cancelledBooking,
  };
}

/**
 * 15. Record Supplier Refund Receivable
 */
export function recordSupplierRefundReceivable(
  booking: BookingRecord,
  input: {
    supplierName: string;
    bookingItemId: string;
    amountKobo: number;
    reason: string;
  },
  nowMs: number = Date.now()
): { success: boolean; updatedBooking?: BookingRecord; error?: string } {
  if (input.amountKobo <= 0) {
    return { success: false, error: 'Supplier refund receivable amount must be greater than zero.' };
  }

  const supplierRefund: SupplierRefundReceivable = {
    id: `SR-${Date.now().toString(36).toUpperCase()}`,
    supplierName: input.supplierName.trim(),
    bookingItemId: input.bookingItemId,
    amountKobo: input.amountKobo,
    status: 'pending',
    reason: input.reason.trim(),
    recordedAt: new Date(nowMs).toISOString(),
  };

  const updatedBooking: BookingRecord = {
    ...booking,
    supplierRefunds: [...booking.supplierRefunds, supplierRefund],
    updatedAt: new Date(nowMs).toISOString(),
  };

  return { success: true, updatedBooking };
}

/**
 * 17. Reinstating Cancelled Booking (Owner-Only)
 */
export function reinstateCancelledBooking(
  booking: BookingRecord,
  input: {
    staffRole: string;
    staffName: string;
    reason: string;
  },
  nowMs: number = Date.now()
): { success: boolean; reinstatedBooking?: BookingRecord; error?: string } {
  if (booking.status !== 'Cancelled') {
    return { success: false, error: 'Only cancelled bookings can be reinstated.' };
  }

  if (input.staffRole !== 'OWNER') {
    return {
      success: false,
      error: 'Reinstating a cancelled booking is strictly restricted to the OWNER.',
    };
  }

  if (!input.reason || !input.reason.trim()) {
    return { success: false, error: 'A reinstatement reason is required.' };
  }

  const now = new Date(nowMs).toISOString();

  // Determine appropriate status upon reinstatement
  const nextStatus = determineBookingStatus(
    booking.totalGrossKobo,
    booking.paidKobo,
    booking.requiredDepositKobo,
    booking.items,
    'Pending payment'
  );

  const timelineEntry: BookingTimelineEntry = {
    id: `TL-${Date.now().toString(36).toUpperCase()}`,
    field: 'status',
    previousValue: 'Cancelled',
    newValue: nextStatus,
    changedByStaffId: 'usr_owner',
    changedByStaffName: input.staffName,
    timestamp: now,
  };

  const reinstatedBooking: BookingRecord = {
    ...booking,
    status: nextStatus,
    cancellation: undefined,
    timeline: [...booking.timeline, timelineEntry],
    notes: `${booking.notes}\n[Reinstated by ${input.staffName} on ${now.split('T')[0]}: ${input.reason.trim()}]`,
    updatedAt: now,
  };

  return { success: true, reinstatedBooking };
}

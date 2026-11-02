import { normalizePhoneForCountry } from '@/core/country-packs/packs';
import { WorkspaceUserPrincipal, assertAuthorizedForAction, assertWithinApprovalLimit } from '@/core/permissions/authorizer';

/**
 * Section 3: Workflow Rules across all 9 business areas:
 * 1. Bookings: Amendment, reschedule, cancellation policy, partial refund, lock on Completed, block cancel with active payments
 * 2. Clients: +234 normalization, duplicate warning (not block), household/group links, consent withdrawal, block delete if bookings exist
 * 3. Quotes: Versions, expiry check, discounts above a limit need approval
 * 4. Payments: Allocation across bookings, overpayment refusal, duplicate reference refusal, append-only reversal with reason
 * 5. Tickets: Issue, amend, reissue, void, refund
 * 6. Visas: Refusal, resubmission, deadline escalation (7, 3, 1 days)
 * 7. Groups: Seat allocation, waitlist when full, promote from waitlist, passenger change, cancellation
 * 8. Suppliers: Purchase order, supplier invoice, deposit prepayment clearing, payment schedule
 * 9. Staff: Onboarding invite (72h single-use) and same-day offboarding
 */

// ============================================================================
// 1. CLIENTS RULES (M2 & Section 3)
// ============================================================================
export interface ClientRecord {
  id: string;
  organizationId: string;
  name: string;
  phoneE164: string;
  email?: string;
  nationality?: string;
  tags: string[];
  householdOrGroupId?: string;
  consentGiven: boolean;
  consentWithdrawnAt?: Date;
  isDeleted: boolean;
}

export function createClientWithDuplicateCheck(params: {
  organizationId: string;
  id: string;
  name: string;
  rawPhone: string;
  existingClients: ClientRecord[];
  householdOrGroupId?: string;
  tags?: string[];
}): { client: ClientRecord; duplicateWarning: boolean; matchingClientIds: string[] } {
  const phoneE164 = normalizePhoneForCountry(params.rawPhone, 'NG');
  const matches = params.existingClients.filter(
    (c) =>
      c.organizationId === params.organizationId &&
      !c.isDeleted &&
      c.phoneE164 === phoneE164
  );

  const client: ClientRecord = {
    id: params.id,
    organizationId: params.organizationId,
    name: params.name.trim(),
    phoneE164,
    tags: params.tags ?? [],
    householdOrGroupId: params.householdOrGroupId,
    consentGiven: true,
    isDeleted: false,
  };

  return {
    client,
    // M2 rule: Duplicate is a warning, not a block, when the phone matches an existing client
    duplicateWarning: matches.length > 0,
    matchingClientIds: matches.map((m) => m.id),
  };
}

export function deleteClientRule(params: {
  actor: WorkspaceUserPrincipal;
  client: ClientRecord;
  linkedBookingsCount: number;
}): ClientRecord {
  assertAuthorizedForAction(params.actor, 'clients.delete');
  if (params.linkedBookingsCount > 0) {
    throw new Error(
      `CLIENT_HAS_BOOKINGS: Cannot delete client '${params.client.id}' because they have ${params.linkedBookingsCount} linked booking(s).`
    );
  }
  return {
    ...params.client,
    isDeleted: true,
  };
}

export function withdrawClientConsent(client: ClientRecord): ClientRecord {
  return {
    ...client,
    consentGiven: false,
    consentWithdrawnAt: new Date(),
  };
}

// ============================================================================
// 2. LEADS RULES (M3 & Section 3)
// ============================================================================
export type LeadSource = 'WHATSAPP' | 'INSTAGRAM' | 'CALL' | 'WALK_IN' | 'REFERRAL';
export type LeadStage = 'NEW' | 'CONTACTED' | 'QUOTED' | 'WON' | 'LOST';

export interface LeadRecord {
  id: string;
  organizationId: string;
  clientId: string;
  source: LeadSource;
  stage: LeadStage;
  ownerUserId: string;
  valueKobo: number;
  nextFollowUpAt: Date;
  lostReason?: string;
  convertedBookingId?: string;
  isReadOnly: boolean;
}

export function isLeadOverdue(lead: LeadRecord, now: Date = new Date()): boolean {
  if (lead.stage === 'WON' || lead.stage === 'LOST') {
    return false;
  }
  return lead.nextFollowUpAt.getTime() < now.getTime();
}

export function transitionLeadStage(params: {
  lead: LeadRecord;
  nextStage: LeadStage;
  lostReason?: string;
}): LeadRecord {
  if (params.lead.isReadOnly) {
    throw new Error('LEAD_READ_ONLY: A converted lead is read-only and cannot be modified.');
  }
  if (params.nextStage === 'LOST') {
    if (!params.lostReason || params.lostReason.trim().length < 3) {
      throw new Error('LOST_REASON_REQUIRED: Marking a lead Lost requires a written reason.');
    }
  }
  return {
    ...params.lead,
    stage: params.nextStage,
    lostReason: params.nextStage === 'LOST' ? params.lostReason?.trim() : undefined,
    isReadOnly: params.nextStage === 'WON' ? true : params.lead.isReadOnly,
  };
}

// ============================================================================
// 3. QUOTES RULES (W2 & Section 3)
// ============================================================================
export interface QuoteVersionRecord {
  quoteId: string;
  organizationId: string;
  leadId: string;
  version: number;
  subtotalKobo: number;
  discountKobo: number;
  totalKobo: number;
  validUntil: Date;
  status: 'DRAFT' | 'PENDING_DISCOUNT_APPROVAL' | 'SENT' | 'ACCEPTED' | 'EXPIRED';
  approvedByUserId?: string;
}

export function createOrVersionQuote(params: {
  quoteId: string;
  organizationId: string;
  leadId: string;
  previousVersion?: QuoteVersionRecord;
  subtotalKobo: number;
  discountKobo: number;
  maxUnapprovedDiscountBps: number; // e.g. 500 = 5% max discount without approval
  validUntil: Date;
}): QuoteVersionRecord {
  if (params.discountKobo < 0 || params.discountKobo > params.subtotalKobo) {
    throw new Error('INVALID_QUOTE_DISCOUNT: Discount must be between 0 and subtotal.');
  }

  const discountBps =
    params.subtotalKobo > 0
      ? Math.round((params.discountKobo / params.subtotalKobo) * 10_000)
      : 0;

  const needsApproval = discountBps > params.maxUnapprovedDiscountBps;

  return {
    quoteId: params.quoteId,
    organizationId: params.organizationId,
    leadId: params.leadId,
    version: (params.previousVersion?.version ?? 0) + 1,
    subtotalKobo: params.subtotalKobo,
    discountKobo: params.discountKobo,
    totalKobo: params.subtotalKobo - params.discountKobo,
    validUntil: params.validUntil,
    status: needsApproval ? 'PENDING_DISCOUNT_APPROVAL' : 'SENT',
  };
}

export function acceptQuoteRule(
  quote: QuoteVersionRecord,
  now: Date = new Date()
): QuoteVersionRecord {
  if (quote.status === 'PENDING_DISCOUNT_APPROVAL') {
    throw new Error('QUOTE_NEEDS_APPROVAL: Discount exceeds limit and must be approved first.');
  }
  if (quote.validUntil.getTime() < now.getTime()) {
    throw new Error('QUOTE_EXPIRED: Cannot accept an expired quote. Create a new version.');
  }
  return {
    ...quote,
    status: 'ACCEPTED',
  };
}

// ============================================================================
// 4. BOOKINGS & PAYMENTS RULES (M4, M5 & Section 3)
// ============================================================================
export type BookingItemType = 'FLIGHT' | 'HOTEL' | 'VISA' | 'PACKAGE' | 'OTHER';
export type BookingStatus = 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface BookingLineItem {
  id: string;
  type: BookingItemType;
  title: string;
  costKobo: number;
  priceKobo: number;
}

export interface BookingRecord {
  id: string;
  organizationId: string;
  clientId: string;
  leadId?: string;
  quoteId?: string;
  soldByUserId: string;
  branchId: string;
  status: BookingStatus;
  items: BookingLineItem[];
  totalPriceKobo: number;
  totalCostKobo: number;
  paidKobo: number;
  outstandingKobo: number;
  cancellationReason?: string;
  rescheduledDateIso?: string;
  amendmentCount: number;
}

export interface PaymentRecord {
  id: string;
  organizationId: string;
  bookingId: string;
  amountKobo: number;
  method: 'BANK_TRANSFER' | 'CASH' | 'POS';
  reference: string;
  senderName: string;
  proofFileUrl?: string;
  isReversed: boolean;
  reversalReason?: string;
  reversesPaymentId?: string;
  createdAt: Date;
}

export function createBookingRecord(params: {
  id: string;
  organizationId: string;
  clientId: string;
  soldByUserId: string;
  branchId: string;
  items: BookingLineItem[];
  leadId?: string;
  quoteId?: string;
  status?: BookingStatus;
}): BookingRecord {
  if (params.items.length === 0) {
    throw new Error('BOOKING_ITEMS_REQUIRED: A booking must have at least one item.');
  }
  const totalPriceKobo = params.items.reduce((sum, item) => sum + item.priceKobo, 0);
  const totalCostKobo = params.items.reduce((sum, item) => sum + item.costKobo, 0);

  return {
    id: params.id,
    organizationId: params.organizationId,
    clientId: params.clientId,
    leadId: params.leadId,
    quoteId: params.quoteId,
    soldByUserId: params.soldByUserId,
    branchId: params.branchId,
    status: params.status ?? 'CONFIRMED',
    items: structuredClone(params.items),
    totalPriceKobo,
    totalCostKobo,
    paidKobo: 0,
    outstandingKobo: totalPriceKobo,
    amendmentCount: 0,
  };
}

export function updateBookingItemPrice(params: {
  actor: WorkspaceUserPrincipal;
  booking: BookingRecord;
  itemId: string;
  newPriceKobo: number;
}): BookingRecord {
  if (params.booking.status === 'COMPLETED' && !params.actor.flags.has('roles.manage')) {
    throw new Error('BOOKING_LOCKED: Completed bookings are locked except to the Owner.');
  }

  const items = params.booking.items.map((item) =>
    item.id === params.itemId ? { ...item, priceKobo: params.newPriceKobo } : item
  );
  const totalPriceKobo = items.reduce((sum, item) => sum + item.priceKobo, 0);
  const outstandingKobo = Math.max(0, totalPriceKobo - params.booking.paidKobo);

  return {
    ...params.booking,
    items,
    totalPriceKobo,
    outstandingKobo,
    amendmentCount: params.booking.amendmentCount + 1,
  };
}

export function recordManualPaymentRule(params: {
  id: string;
  booking: BookingRecord;
  existingPayments: PaymentRecord[];
  amountKobo: number;
  method: 'BANK_TRANSFER' | 'CASH' | 'POS';
  reference: string;
  senderName: string;
  proofFileUrl?: string;
}): { updatedBooking: BookingRecord; payment: PaymentRecord } {
  if (params.amountKobo <= 0 || !Number.isInteger(params.amountKobo)) {
    throw new Error('INVALID_PAYMENT_AMOUNT: Payment amount must be a positive integer in kobo.');
  }

  // M5 rule: Overpayment above the balance is refused
  if (params.amountKobo > params.booking.outstandingKobo) {
    throw new Error(
      `OVERPAYMENT_REFUSED: Payment of ${params.amountKobo} kobo exceeds outstanding balance of ${params.booking.outstandingKobo} kobo.`
    );
  }

  // M5 rule: Duplicate reference on the same booking is refused
  const cleanRef = params.reference.trim().toUpperCase();
  const duplicate = params.existingPayments.find(
    (p) =>
      p.organizationId === params.booking.organizationId &&
      p.bookingId === params.booking.id &&
      p.reference.trim().toUpperCase() === cleanRef &&
      !p.isReversed
  );

  if (duplicate) {
    throw new Error(
      `DUPLICATE_PAYMENT_REFERENCE: Reference '${cleanRef}' is already recorded on booking '${params.booking.id}' (payment '${duplicate.id}').`
    );
  }

  const payment: PaymentRecord = {
    id: params.id,
    organizationId: params.booking.organizationId,
    bookingId: params.booking.id,
    amountKobo: params.amountKobo,
    method: params.method,
    reference: cleanRef,
    senderName: params.senderName.trim(),
    proofFileUrl: params.proofFileUrl,
    isReversed: false,
    createdAt: new Date(),
  };

  const nextPaid = params.booking.paidKobo + params.amountKobo;
  const nextOutstanding = params.booking.totalPriceKobo - nextPaid;

  const updatedBooking: BookingRecord = {
    ...params.booking,
    paidKobo: nextPaid,
    outstandingKobo: nextOutstanding,
  };

  return { updatedBooking, payment };
}

export function reversePaymentRule(params: {
  reversalPaymentId: string;
  booking: BookingRecord;
  originalPayment: PaymentRecord;
  reason: string;
}): {
  updatedBooking: BookingRecord;
  markedOriginal: PaymentRecord;
  reversalEntry: PaymentRecord;
} {
  if (!params.reason || params.reason.trim().length < 3) {
    throw new Error('REVERSAL_REASON_REQUIRED: Reversing a payment requires a written reason.');
  }
  if (params.originalPayment.isReversed) {
    throw new Error('ALREADY_REVERSED: Payment has already been reversed.');
  }

  const markedOriginal: PaymentRecord = {
    ...params.originalPayment,
    isReversed: true,
    reversalReason: params.reason.trim(),
  };

  const reversalEntry: PaymentRecord = {
    id: params.reversalPaymentId,
    organizationId: params.originalPayment.organizationId,
    bookingId: params.originalPayment.bookingId,
    amountKobo: -params.originalPayment.amountKobo,
    method: params.originalPayment.method,
    reference: `${params.originalPayment.reference}-REV`,
    senderName: params.originalPayment.senderName,
    isReversed: true,
    reversalReason: params.reason.trim(),
    reversesPaymentId: params.originalPayment.id,
    createdAt: new Date(),
  };

  const nextPaid = Math.max(0, params.booking.paidKobo - params.originalPayment.amountKobo);
  const updatedBooking: BookingRecord = {
    ...params.booking,
    paidKobo: nextPaid,
    outstandingKobo: params.booking.totalPriceKobo - nextPaid,
  };

  return { updatedBooking, markedOriginal, reversalEntry };
}

export function cancelBookingRule(params: {
  booking: BookingRecord;
  reason: string;
}): BookingRecord {
  // M4 rule: Cancelling a booking that has payments is refused until they are reversed
  if (params.booking.paidKobo > 0) {
    throw new Error(
      `BOOKING_HAS_ACTIVE_PAYMENTS: Cannot cancel booking '${params.booking.id}' while ${params.booking.paidKobo} kobo in unreversed payments remain.`
    );
  }
  if (!params.reason || params.reason.trim().length < 3) {
    throw new Error('CANCELLATION_REASON_REQUIRED: Cancelling a booking requires a written reason.');
  }
  return {
    ...params.booking,
    status: 'CANCELLED',
    cancellationReason: params.reason.trim(),
  };
}

// ============================================================================
// 5. TICKETS & VISAS RULES (Section 3)
// ============================================================================
export type TicketStatus = 'ISSUED' | 'AMENDED' | 'REISSUED' | 'VOIDED' | 'REFUNDED';

export interface TicketRecord {
  id: string;
  organizationId: string;
  bookingId: string;
  pnr: string;
  passengerName: string;
  status: TicketStatus;
  reason?: string;
}

export function transitionTicketStatus(params: {
  ticket: TicketRecord;
  nextStatus: TicketStatus;
  reason?: string;
}): TicketRecord {
  if (params.ticket.status === 'VOIDED' || params.ticket.status === 'REFUNDED') {
    throw new Error(`TICKET_FINAL_STATE: Ticket is already ${params.ticket.status} and cannot transition.`);
  }
  if (
    (params.nextStatus === 'VOIDED' || params.nextStatus === 'REFUNDED') &&
    (!params.reason || params.reason.trim().length < 3)
  ) {
    throw new Error(`TICKET_REASON_REQUIRED: Marking a ticket ${params.nextStatus} requires a reason.`);
  }
  return {
    ...params.ticket,
    status: params.nextStatus,
    reason: params.reason?.trim(),
  };
}

export interface VisaCaseRecord {
  id: string;
  organizationId: string;
  clientId: string;
  destinationCountry: string;
  stage: 'CHECKLIST' | 'SUBMITTED' | 'APPROVED' | 'REFUSED' | 'RESUBMITTED';
  submissionDeadline: Date;
  refusalReason?: string;
  attemptNumber: number;
}

export function getVisaDeadlineEscalationLevel(
  visaCase: VisaCaseRecord,
  now: Date = new Date()
): 'NONE' | '7_DAYS' | '3_DAYS' | '1_DAY' | 'OVERDUE' {
  if (visaCase.stage === 'APPROVED' || visaCase.stage === 'REFUSED') {
    return 'NONE';
  }
  const diffDays = Math.ceil(
    (visaCase.submissionDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return 'OVERDUE';
  if (diffDays <= 1) return '1_DAY';
  if (diffDays <= 3) return '3_DAYS';
  if (diffDays <= 7) return '7_DAYS';
  return 'NONE';
}

// ============================================================================
// 6. SPENDING CONTROL / IMPREST RULES (W5 & Section 3)
// ============================================================================
export interface ImprestRecord {
  id: string;
  organizationId: string;
  requesterUserId: string;
  amountKobo: number;
  purpose: string;
  stage: 'REQUESTED' | 'APPROVED' | 'CASH_PAID_OUT' | 'RETIRED' | 'REJECTED';
  approvedByUserId?: string;
  receiptTotalKobo?: number;
  unspentReturnedKobo?: number;
}

export function approveImprestWithinLimit(params: {
  approver: WorkspaceUserPrincipal;
  imprest: ImprestRecord;
}): ImprestRecord {
  assertWithinApprovalLimit(params.approver, params.imprest.amountKobo);
  return {
    ...params.imprest,
    stage: 'APPROVED',
    approvedByUserId: params.approver.userId,
  };
}

export function retireImprestWithReceipts(params: {
  imprest: ImprestRecord;
  receiptTotalKobo: number;
  unspentReturnedKobo: number;
}): ImprestRecord {
  if (params.imprest.stage !== 'CASH_PAID_OUT' && params.imprest.stage !== 'APPROVED') {
    throw new Error('IMPREST_NOT_DISBURSED: Imprest must be approved/paid out before retirement.');
  }
  if (params.receiptTotalKobo + params.unspentReturnedKobo !== params.imprest.amountKobo) {
    throw new Error(
      `IMPREST_RETIREMENT_MISMATCH: Receipts (${params.receiptTotalKobo}) + returned cash (${params.unspentReturnedKobo}) must equal imprest amount (${params.imprest.amountKobo}).`
    );
  }
  return {
    ...params.imprest,
    stage: 'RETIRED',
    receiptTotalKobo: params.receiptTotalKobo,
    unspentReturnedKobo: params.unspentReturnedKobo,
  };
}

// ============================================================================
// 7. GROUP DEPARTURES RULES (W7 & Section 3)
// ============================================================================
export interface GroupDepartureRecord {
  id: string;
  organizationId: string;
  title: string;
  capacitySeats: number;
  pricePerSeatKobo: number;
  supplierCostKobo: number;
  confirmedTravellers: { id: string; name: string; checkedIn: boolean; paidKobo: number }[];
  waitlistTravellers: { id: string; name: string }[];
}

export function allocateGroupSeatOrWaitlist(
  departure: GroupDepartureRecord,
  traveller: { id: string; name: string; initialPaymentKobo: number }
): { updated: GroupDepartureRecord; placement: 'CONFIRMED_SEAT' | 'WAITLISTED' } {
  const copy = structuredClone(departure);
  if (copy.confirmedTravellers.length < copy.capacitySeats) {
    copy.confirmedTravellers.push({
      id: traveller.id,
      name: traveller.name,
      checkedIn: false,
      paidKobo: traveller.initialPaymentKobo,
    });
    return { updated: copy, placement: 'CONFIRMED_SEAT' };
  }

  copy.waitlistTravellers.push({ id: traveller.id, name: traveller.name });
  return { updated: copy, placement: 'WAITLISTED' };
}

export function promoteFromGroupWaitlist(departure: GroupDepartureRecord): GroupDepartureRecord {
  const copy = structuredClone(departure);
  if (copy.confirmedTravellers.length >= copy.capacitySeats) {
    throw new Error('GROUP_AT_CAPACITY: No open seat available to promote from waitlist.');
  }
  const next = copy.waitlistTravellers.shift();
  if (!next) {
    throw new Error('WAITLIST_EMPTY: No travellers waiting on waitlist.');
  }
  copy.confirmedTravellers.push({
    id: next.id,
    name: next.name,
    checkedIn: false,
    paidKobo: 0,
  });
  return copy;
}

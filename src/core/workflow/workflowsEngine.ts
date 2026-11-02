import { WorkspaceUserPrincipal } from '@/core/permissions/authorizer';
import { IdempotentOperationLedger } from '@/core/offline/operationQueue';
import { AuthenticatedTenantTokenContext } from '@/core/tenancy/TenantContext';
import {
  calculateBookingProfitability,
  convertSupplierCostToKobo,
} from '@/core/workflow/agencyFlow';
import {
  BookingLineItem,
  BookingRecord,
  ClientRecord,
  GroupDepartureRecord,
  ImprestRecord,
  LeadRecord,
  PaymentRecord,
  QuoteVersionRecord,
  acceptQuoteRule,
  allocateGroupSeatOrWaitlist,
  approveImprestWithinLimit,
  createBookingRecord,
  createClientWithDuplicateCheck,
  createOrVersionQuote,
  recordManualPaymentRule,
  retireImprestWithReceipts,
} from '@/core/workflow/workflowRules';

export interface WorkflowDefinitionSpec {
  id: 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'W6' | 'W7' | 'W8';
  name: string;
  steps: string[];
  proves: string;
  phaseGate: string;
  gateDate: string;
}

export const BUSINESS_WORKFLOWS_CATALOG: WorkflowDefinitionSpec[] = [
  {
    id: 'W1',
    name: 'Sell and collect (MVP)',
    steps: [
      'Add client',
      'Log lead',
      'Convert to booking',
      'Record part-payment with proof',
      'Owner home shows collected, outstanding and the agent sale',
    ],
    proves: 'The MVP is usable',
    phaseGate: 'P0',
    gateDate: '30 Nov 2026',
  },
  {
    id: 'W2',
    name: 'Quote to receipt',
    steps: [
      'Lead',
      'Quote with versions',
      'Share PDF to WhatsApp',
      'Accept quote',
      'Booking',
      'Invoice',
      'Payment',
      'Receipt',
    ],
    proves: 'Selling end to end',
    phaseGate: 'P1',
    gateDate: '28 Feb 2027',
  },
  {
    id: 'W3',
    name: 'Self-serve start',
    steps: [
      'Owner signs up',
      'Picks template',
      'Pays on Paystack',
      'Invites staff',
      'Imports clients from Excel',
    ],
    proves: 'Self-serve works',
    phaseGate: 'P1',
    gateDate: '28 Feb 2027',
  },
  {
    id: 'W4',
    name: 'Offline sale',
    steps: [
      'Agent logs a lead and payment with no signal',
      'Phone reconnects',
      'Both sync once',
      'Owner sees them',
    ],
    proves: 'Offline is safe',
    phaseGate: 'P1',
    gateDate: '28 Feb 2027',
  },
  {
    id: 'W5',
    name: 'Spending control',
    steps: [
      'Staff raises imprest',
      'Owner approves on phone within limit',
      'Cash out',
      'Expense retired with receipts',
    ],
    proves: 'Owner approves without WhatsApp',
    phaseGate: 'P2',
    gateDate: '20 Jun 2027',
  },
  {
    id: 'W6',
    name: 'Money truth on a ticket',
    steps: [
      'Ticket bought through a consolidator in USD',
      'Supplier owed',
      'Client pays in naira',
      'Supplier paid',
      'Profit per booking shown in naira at the stored rate',
    ],
    proves: 'Profit is right',
    phaseGate: 'P2',
    gateDate: '20 Jun 2027',
  },
  {
    id: 'W7',
    name: 'Group departure',
    steps: [
      'Package and departure',
      'Group booking',
      'Instalments',
      'Manifest and rooming',
      'Group check-in',
      'Final payment',
      'Departure profit',
    ],
    proves: 'Group travel',
    phaseGate: 'P3',
    gateDate: '29 Aug 2027',
  },
  {
    id: 'W8',
    name: 'Unaided 1-hour onboarding',
    steps: [
      'New agency signs up',
      'Pays subscription',
      'Configures workspace and runs first sale in under 60 minutes with no help',
    ],
    proves: 'Full self-serve business readiness',
    phaseGate: 'P4',
    gateDate: '30 Oct 2027',
  },
];

/**
 * Executes Workflow W1 (Sell and collect - MVP Gate P0):
 * Add client -> log lead -> convert to booking -> record part-payment with proof -> owner home summary.
 */
export function executeWorkflowW1SellAndCollect(params: {
  organizationId: string;
  branchId: string;
  agentUserId: string;
  clientName: string;
  clientPhone: string;
  bookingItems: BookingLineItem[];
  partPaymentKobo: number;
  paymentReference: string;
  proofFileUrl: string;
}): {
  client: ClientRecord;
  lead: LeadRecord;
  booking: BookingRecord;
  payment: PaymentRecord;
  ownerHomeSummary: {
    bookingValueKobo: number;
    cashCollectedKobo: number;
    outstandingKobo: number;
    byStaff: { userId: string; bookingsCount: number; valueKobo: number; collectedKobo: number }[];
  };
} {
  // Step 1: Add client
  const { client } = createClientWithDuplicateCheck({
    organizationId: params.organizationId,
    id: 'cl_w1_001',
    name: params.clientName,
    rawPhone: params.clientPhone,
    existingClients: [],
  });

  // Step 2: Log lead
  const totalValueKobo = params.bookingItems.reduce((sum, i) => sum + i.priceKobo, 0);
  const lead: LeadRecord = {
    id: 'ld_w1_001',
    organizationId: params.organizationId,
    clientId: client.id,
    source: 'WHATSAPP',
    stage: 'WON',
    ownerUserId: params.agentUserId,
    valueKobo: totalValueKobo,
    nextFollowUpAt: new Date(Date.now() + 86_400_000),
    convertedBookingId: 'bk_w1_001',
    isReadOnly: true, // M3 rule: converting a Won lead makes the lead read-only
  };

  // Step 3: Convert to booking
  const initialBooking = createBookingRecord({
    id: 'bk_w1_001',
    organizationId: params.organizationId,
    clientId: client.id,
    leadId: lead.id,
    soldByUserId: params.agentUserId,
    branchId: params.branchId,
    items: params.bookingItems,
  });

  // Step 4: Record part-payment with proof
  const { updatedBooking, payment } = recordManualPaymentRule({
    id: 'pay_w1_001',
    booking: initialBooking,
    existingPayments: [],
    amountKobo: params.partPaymentKobo,
    method: 'BANK_TRANSFER',
    reference: params.paymentReference,
    senderName: params.clientName,
    proofFileUrl: params.proofFileUrl,
  });

  // Step 5: Owner home summary
  return {
    client,
    lead,
    booking: updatedBooking,
    payment,
    ownerHomeSummary: {
      bookingValueKobo: updatedBooking.totalPriceKobo,
      cashCollectedKobo: updatedBooking.paidKobo,
      outstandingKobo: updatedBooking.outstandingKobo,
      byStaff: [
        {
          userId: params.agentUserId,
          bookingsCount: 1,
          valueKobo: updatedBooking.totalPriceKobo,
          collectedKobo: updatedBooking.paidKobo,
        },
      ],
    },
  };
}

/**
 * Executes Workflow W2 (Quote to receipt - Gate P1):
 * Lead -> Quote v1 -> Quote v2 -> Share to WhatsApp -> Accept -> Booking -> Invoice -> Payment -> Receipt
 */
export function executeWorkflowW2QuoteToReceipt(params: {
  organizationId: string;
  branchId: string;
  agentUserId: string;
  clientId: string;
  leadId: string;
  v1SubtotalKobo: number;
  v2SubtotalKobo: number;
  v2DiscountKobo: number;
  supplierCostKobo: number;
  paymentReference: string;
}): {
  quoteV1: QuoteVersionRecord;
  quoteV2Accepted: QuoteVersionRecord;
  whatsappShareUrl: string;
  booking: BookingRecord;
  invoiceNumber: string;
  receiptNumber: string;
  payment: PaymentRecord;
} {
  const validUntil = new Date(Date.now() + 7 * 86_400_000);
  const quoteV1 = createOrVersionQuote({
    quoteId: 'qt_w2_001',
    organizationId: params.organizationId,
    leadId: params.leadId,
    subtotalKobo: params.v1SubtotalKobo,
    discountKobo: 0,
    maxUnapprovedDiscountBps: 500,
    validUntil,
  });

  const quoteV2 = createOrVersionQuote({
    quoteId: 'qt_w2_001',
    organizationId: params.organizationId,
    leadId: params.leadId,
    previousVersion: quoteV1,
    subtotalKobo: params.v2SubtotalKobo,
    discountKobo: params.v2DiscountKobo,
    maxUnapprovedDiscountBps: 500,
    validUntil,
  });

  const whatsappShareUrl = `https://wa.me/2348031234567?text=${encodeURIComponent(
    `Quote ${quoteV2.quoteId} v${quoteV2.version}`
  )}`;

  const quoteV2Accepted = acceptQuoteRule(quoteV2);

  const initialBooking = createBookingRecord({
    id: 'bk_w2_001',
    organizationId: params.organizationId,
    clientId: params.clientId,
    leadId: params.leadId,
    quoteId: quoteV2Accepted.quoteId,
    soldByUserId: params.agentUserId,
    branchId: params.branchId,
    items: [
      {
        id: 'item_w2_1',
        type: 'PACKAGE',
        title: 'Accepted Quote Package',
        costKobo: params.supplierCostKobo,
        priceKobo: quoteV2Accepted.totalKobo,
      },
    ],
  });

  const { updatedBooking, payment } = recordManualPaymentRule({
    id: 'pay_w2_001',
    booking: initialBooking,
    existingPayments: [],
    amountKobo: quoteV2Accepted.totalKobo,
    method: 'BANK_TRANSFER',
    reference: params.paymentReference,
    senderName: 'Client Transfer',
  });

  return {
    quoteV1,
    quoteV2Accepted,
    whatsappShareUrl,
    booking: updatedBooking,
    invoiceNumber: 'INV-2026-0001',
    receiptNumber: 'RCT-2026-0001',
    payment,
  };
}

/**
 * Executes Workflow W4 (Offline sale - Gate P1):
 * Agent logs a lead and payment offline -> phone reconnects -> both sync once (even if network retries).
 */
export async function executeWorkflowW4OfflineSaleSync(params: {
  ctx: AuthenticatedTenantTokenContext;
  ledger: IdempotentOperationLedger;
  leadOperationId: string;
  paymentOperationId: string;
  leadValueKobo: number;
  paymentAmountKobo: number;
}): Promise<{
  leadSyncedCount: number;
  paymentSyncedCount: number;
  leadReplayedOnRetry: boolean;
  paymentReplayedOnRetry: boolean;
}> {
  let leadSyncedCount = 0;
  let paymentSyncedCount = 0;

  const leadEnvelope = {
    operationId: params.leadOperationId,
    actionType: 'CREATE_LEAD' as const,
    deviceTimestampIso: new Date().toISOString(),
    payloadHash: `lead_${params.leadValueKobo}`,
  };

  const paymentEnvelope = {
    operationId: params.paymentOperationId,
    actionType: 'CAPTURE_PENDING_PAYMENT' as const,
    deviceTimestampIso: new Date().toISOString(),
    payloadHash: `pay_${params.paymentAmountKobo}`,
  };

  await params.ledger.executeOnce(params.ctx, leadEnvelope, () => {
    leadSyncedCount += 1;
    return { leadId: 'ld_offline_1', valueKobo: params.leadValueKobo };
  });

  await params.ledger.executeOnce(params.ctx, paymentEnvelope, () => {
    paymentSyncedCount += 1;
    return { paymentId: 'pay_offline_1', amountKobo: params.paymentAmountKobo };
  });

  // Simulate reconnect retry of the exact same offline queue
  const retryLead = await params.ledger.executeOnce(params.ctx, leadEnvelope, () => {
    leadSyncedCount += 1;
    return { leadId: 'ld_offline_dup', valueKobo: params.leadValueKobo };
  });

  const retryPayment = await params.ledger.executeOnce(params.ctx, paymentEnvelope, () => {
    paymentSyncedCount += 1;
    return { paymentId: 'pay_offline_dup', amountKobo: params.paymentAmountKobo };
  });

  return {
    leadSyncedCount,
    paymentSyncedCount,
    leadReplayedOnRetry: retryLead.replayed,
    paymentReplayedOnRetry: retryPayment.replayed,
  };
}

/**
 * Executes Workflow W5 (Spending control - Gate P2):
 * Staff raises imprest -> owner/manager approves within limit -> cash out -> retired with receipts.
 */
export function executeWorkflowW5SpendingControl(params: {
  organizationId: string;
  requesterUserId: string;
  approver: WorkspaceUserPrincipal;
  amountKobo: number;
  purpose: string;
  receiptTotalKobo: number;
  unspentReturnedKobo: number;
}): ImprestRecord {
  const initial: ImprestRecord = {
    id: 'imp_w5_001',
    organizationId: params.organizationId,
    requesterUserId: params.requesterUserId,
    amountKobo: params.amountKobo,
    purpose: params.purpose,
    stage: 'REQUESTED',
  };

  const approved = approveImprestWithinLimit({
    approver: params.approver,
    imprest: initial,
  });

  const paidOut: ImprestRecord = {
    ...approved,
    stage: 'CASH_PAID_OUT',
  };

  return retireImprestWithReceipts({
    imprest: paidOut,
    receiptTotalKobo: params.receiptTotalKobo,
    unspentReturnedKobo: params.unspentReturnedKobo,
  });
}

/**
 * Executes Workflow W6 (Money truth on a ticket - Gate P2):
 * Ticket bought through a consolidator in USD -> supplier owed -> client pays in naira ->
 * supplier paid (with FX difference if paid at a different rate) -> profit per booking shown in naira at the stored rate.
 */
export function executeWorkflowW6TicketMoneyTruth(params: {
  organizationId: string;
  branchId: string;
  soldByUserId: string;
  ticketCostUsdCents: number; // e.g. 124_000 ($1,240.00)
  bookedExchangeRateNgnPerUsd: number; // e.g. 1,500
  settledExchangeRateNgnPerUsd: number; // e.g. 1,550
  clientPriceKobo: number; // e.g. 2,450,000_00 (₦2,450,000.00)
}): {
  storedSupplierCostKobo: number;
  settledSupplierPaymentKobo: number;
  fxGainOrLossKobo: number; // negative = FX loss, positive = FX gain
  bookingProfitAtStoredRateKobo: number;
  netProfitAfterFxKobo: number;
} {
  const storedSupplierCostKobo = convertSupplierCostToKobo({
    amountMinorInCurrency: params.ticketCostUsdCents,
    currency: 'USD',
    exchangeRateToNgn: params.bookedExchangeRateNgnPerUsd,
  });

  const settledSupplierPaymentKobo = convertSupplierCostToKobo({
    amountMinorInCurrency: params.ticketCostUsdCents,
    currency: 'USD',
    exchangeRateToNgn: params.settledExchangeRateNgnPerUsd,
  });

  // Section 9 Rule 7: A different rate at payment posts the difference to FX gain or loss
  const fxGainOrLossKobo = storedSupplierCostKobo - settledSupplierPaymentKobo;

  const profitability = calculateBookingProfitability({
    bookingId: 'bk_w6_001',
    organizationId: params.organizationId,
    branchId: params.branchId,
    soldByUserId: params.soldByUserId,
    bookingValueMinor: params.clientPriceKobo,
    cashCollectedMinor: params.clientPriceKobo,
    supplierCostMinor: storedSupplierCostKobo,
  });

  return {
    storedSupplierCostKobo,
    settledSupplierPaymentKobo,
    fxGainOrLossKobo,
    bookingProfitAtStoredRateKobo: profitability.grossProfitMinor,
    netProfitAfterFxKobo: profitability.grossProfitMinor + fxGainOrLossKobo,
  };
}

/**
 * Executes Workflow W7 (Group departure - Gate P3):
 * Package and departure -> group bookings -> instalments -> manifest -> group check-in -> final payment -> departure profit.
 */
export function executeWorkflowW7GroupDeparture(params: {
  organizationId: string;
  title: string;
  capacitySeats: number;
  pricePerSeatKobo: number;
  totalSupplierCostKobo: number;
  travellers: { id: string; name: string; fullPaymentKobo: number }[];
}): {
  departure: GroupDepartureRecord;
  checkedInCount: number;
  waitlistedCount: number;
  totalRevenueKobo: number;
  departureProfitKobo: number;
} {
  let departure: GroupDepartureRecord = {
    id: 'dep_w7_001',
    organizationId: params.organizationId,
    title: params.title,
    capacitySeats: params.capacitySeats,
    pricePerSeatKobo: params.pricePerSeatKobo,
    supplierCostKobo: params.totalSupplierCostKobo,
    confirmedTravellers: [],
    waitlistTravellers: [],
  };

  for (const t of params.travellers) {
    const res = allocateGroupSeatOrWaitlist(departure, {
      id: t.id,
      name: t.name,
      initialPaymentKobo: t.fullPaymentKobo,
    });
    departure = res.updated;
  }

  // Perform departure day group check-in for all confirmed travellers
  departure.confirmedTravellers = departure.confirmedTravellers.map((ct) => ({
    ...ct,
    checkedIn: true,
  }));

  const totalRevenueKobo = departure.confirmedTravellers.reduce((s, c) => s + c.paidKobo, 0);
  const departureProfitKobo = totalRevenueKobo - departure.supplierCostKobo;

  return {
    departure,
    checkedInCount: departure.confirmedTravellers.filter((c) => c.checkedIn).length,
    waitlistedCount: departure.waitlistTravellers.length,
    totalRevenueKobo,
    departureProfitKobo,
  };
}

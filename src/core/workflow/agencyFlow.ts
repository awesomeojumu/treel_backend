import { CurrencyCode } from '@/core/country-packs/packs';

/**
 * Section 1 & Section 3: Scope, Principles, and the 7-Step Agency Flow
 *
 * In scope (end-to-end):
 * 1. An enquiry becomes a lead.
 * 2. The lead gets a quote.
 * 3. The accepted quote becomes a booking.
 * 4. Part-payments are recorded against the booking.
 * 5. Tickets, visas, suppliers and tasks are handled under it.
 * 6. Revenue and commission go to the staff member who sold it.
 * 7. The owner sees profit per booking, per staff member and per branch.
 *
 * Three Booking Entry Paths:
 * - Path A (P0 MVP / W1): Lead converts directly into a Booking (quoteId optional).
 * - Path B (P1 / W2): Lead -> Quote (with versions) -> Accepted -> Booking (both leadId & quoteId linked).
 * - Path C (Home Quick Add): Quick Add Sale creates a Booking directly (leadId & quoteId optional).
 */

export type BookingEntryOrigin = 'FROM_LEAD' | 'FROM_ACCEPTED_QUOTE' | 'QUICK_ADD_SALE';

export interface MultiCurrencyCostSpec {
  amountMinorInCurrency: number; // e.g. 124_000 cents = $1,240.00 USD
  currency: CurrencyCode; // 'NGN' | 'USD' | 'GBP' | 'EUR'
  exchangeRateToNgn: number; // 1.0 for NGN; e.g. 1500 for $1 = ₦1,500.00
}

/**
 * Converts a supplier cost in NGN, USD, GBP, or EUR into integer kobo at the stored rate (W6 & Section 9).
 */
export function convertSupplierCostToKobo(cost: MultiCurrencyCostSpec): number {
  if (!Number.isInteger(cost.amountMinorInCurrency) || cost.amountMinorInCurrency < 0) {
    throw new Error('Supplier cost amountMinorInCurrency must be a non-negative integer.');
  }
  if (cost.currency === 'NGN') {
    return cost.amountMinorInCurrency;
  }
  if (cost.exchangeRateToNgn <= 0) {
    throw new Error('A positive stored exchange rate is required for foreign currency costs.');
  }
  return Math.round(cost.amountMinorInCurrency * cost.exchangeRateToNgn);
}

export const IN_SCOPE_AGENCY_FLOW_STEPS = [
  {
    stepNumber: 1,
    key: 'ENQUIRY_TO_LEAD',
    title: 'An enquiry becomes a lead',
    module: 'leads',
  },
  {
    stepNumber: 2,
    key: 'LEAD_TO_QUOTE',
    title: 'The lead gets a quote',
    module: 'quotes',
  },
  {
    stepNumber: 3,
    key: 'QUOTE_TO_BOOKING',
    title: 'The accepted quote becomes a booking',
    module: 'bookings',
  },
  {
    stepNumber: 4,
    key: 'BOOKING_PART_PAYMENTS',
    title: 'Part-payments are recorded against the booking',
    module: 'payments',
  },
  {
    stepNumber: 5,
    key: 'FULFILMENT_UNDER_BOOKING',
    title: 'Tickets, visas, suppliers and tasks are handled under it',
    module: 'tickets',
  },
  {
    stepNumber: 6,
    key: 'STAFF_REVENUE_AND_COMMISSION',
    title: 'Revenue and commission go to the staff member who sold it',
    module: 'performance',
  },
  {
    stepNumber: 7,
    key: 'OWNER_PROFIT_VISIBILITY',
    title: 'The owner sees profit per booking, per staff member and per branch',
    module: 'ledger',
  },
] as const;

export const OUT_OF_SCOPE_CAPABILITIES = [
  'FARE_SEARCH',
  'AIRLINE_OR_GDS_BOOKING_ENGINE',
  'PAYROLL',
  'FULL_STATUTORY_ACCOUNTING',
  'STATUTORY_TAX_FILING',
  'PUBLIC_MARKETPLACE',
] as const;

export type OutOfScopeCapability = (typeof OUT_OF_SCOPE_CAPABILITIES)[number];

export interface BookingProfitBreakdown {
  bookingId: string;
  organizationId: string;
  branchId: string;
  soldByUserId: string;
  entryOrigin: BookingEntryOrigin;
  leadId?: string;
  quoteId?: string;
  bookingValueMinor: number;
  cashCollectedMinor: number;
  outstandingReceivableMinor: number;
  supplierCostMinor: number;
  refundsMinor: number;
  grossProfitMinor: number;
  commissionMinor: number;
  directExpensesMinor: number;
  netOperatingContributionMinor: number;
}

/**
 * Calculates the 8 canonical financial measures per booking (Section 1 Step 7 & Section 9)
 * in integer kobo so that revenue, commission, and profit per booking/staff/branch are exact.
 */
export function calculateBookingProfitability(input: {
  bookingId: string;
  organizationId: string;
  branchId: string;
  soldByUserId: string;
  entryOrigin?: BookingEntryOrigin;
  leadId?: string;
  quoteId?: string;
  bookingValueMinor: number;
  cashCollectedMinor: number;
  supplierCostMinor: number;
  refundsMinor?: number;
  commissionRateBps?: number;
  directExpensesMinor?: number;
}): BookingProfitBreakdown {
  const refundsMinor = input.refundsMinor ?? 0;
  const directExpensesMinor = input.directExpensesMinor ?? 0;
  const commissionRateBps = input.commissionRateBps ?? 0;

  const outstandingReceivableMinor = Math.max(
    0,
    input.bookingValueMinor - input.cashCollectedMinor - refundsMinor
  );

  // Gross profit = Recognised revenue (booking value) less supplier costs less refunds
  const grossProfitMinor = input.bookingValueMinor - input.supplierCostMinor - refundsMinor;

  // Commission accrues on cleared payment or recognised sale per workspace tier
  const commissionMinor = Math.round(
    (grossProfitMinor > 0 ? grossProfitMinor : 0) * (commissionRateBps / 10_000)
  );

  const netOperatingContributionMinor = grossProfitMinor - commissionMinor - directExpensesMinor;

  return {
    bookingId: input.bookingId,
    organizationId: input.organizationId,
    branchId: input.branchId,
    soldByUserId: input.soldByUserId,
    entryOrigin: input.entryOrigin ?? 'FROM_LEAD',
    leadId: input.leadId,
    quoteId: input.quoteId,
    bookingValueMinor: input.bookingValueMinor,
    cashCollectedMinor: input.cashCollectedMinor,
    outstandingReceivableMinor,
    supplierCostMinor: input.supplierCostMinor,
    refundsMinor,
    grossProfitMinor,
    commissionMinor,
    directExpensesMinor,
    netOperatingContributionMinor,
  };
}

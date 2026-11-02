import { PlanId, PLATFORM_PLANS } from '@/core/platform/layers';
import { MoneyAmount, formatMoney } from '@/core/money/kobo';

export const PLANEXI_VAT_REGISTRATION = 'VAT-PLANEXI-2026-NG';
export const NIGERIA_VAT_RATE_PERCENT = 7.5;

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'GRACE_PERIOD' // Days 1-7 after payment failure
  | 'READ_ONLY' // Days 8-29 after payment failure (can view/export, cannot write)
  | 'SUSPENDED'; // Day 30+ (full lock out)

export type DirectDebitMandateStatus = 'PENDING' | 'ACTIVE' | 'FAILED' | 'CANCELLED';

export interface SubscriptionInvoice {
  invoiceNumber: string;
  organizationId: string;
  planId: PlanId;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  amountNetKobo: number;
  vatRatePercent: number;
  amountVatKobo: number;
  amountGrossKobo: number;
  planexiVatNumber: string;
  formattedNet: string;
  formattedVat: string;
  formattedGross: string;
  issuedAt: string;
}

export interface DirectDebitMandate {
  mandateId: string;
  organizationId: string;
  bankCode: string;
  bankName: string;
  accountNumberMasked: string;
  status: DirectDebitMandateStatus;
  validationDebitRefunded: boolean; // ₦50 validation debit refunded
  activatedAt?: string;
  createdAt: string;
}

export interface WorkspaceSubscriptionState {
  organizationId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  failedPaymentStage?: 1 | 2 | 3 | 4;
  failedPaymentAt?: string;
  gracePeriodExpiresAt?: string;
  readOnlyStartsAt?: string;
  suspensionStartsAt?: string;
  mandate?: DirectDebitMandate;
  activeSeats: number;
  maxSeats: number;
}

// 24 Central Bank of Nigeria (CBN) licensed commercial banks supported by Paystack Direct Debit
export const SUPPORTED_NIGERIAN_DIRECT_DEBIT_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Parallex Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'SunTrust Bank' },
  { code: '102', name: 'Titan Trust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '302', name: 'Taj Bank' },
  { code: '303', name: 'Lotus Bank' },
];

export class SubscriptionBillingEngine {
  /**
   * Calculate invoice with 7.5% Nigerian VAT added at billing
   */
  public static calculateInvoice(
    organizationId: string,
    planId: PlanId,
    billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY'
  ): SubscriptionInvoice {
    const plan = PLATFORM_PLANS[planId];
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    const multiplier = billingCycle === 'ANNUAL' ? 12 : 1;
    const amountNetKobo = plan.monthlyPriceKobo * multiplier;
    // 7.5% VAT calculation in integer kobo
    const amountVatKobo = Math.round(amountNetKobo * (NIGERIA_VAT_RATE_PERCENT / 100));
    const amountGrossKobo = amountNetKobo + amountVatKobo;

    const netMoney: MoneyAmount = { amountMinor: amountNetKobo, currency: 'NGN' };
    const vatMoney: MoneyAmount = { amountMinor: amountVatKobo, currency: 'NGN' };
    const grossMoney: MoneyAmount = { amountMinor: amountGrossKobo, currency: 'NGN' };

    const invNum = `INV-PLX-${Date.now().toString().slice(-6)}`;

    return {
      invoiceNumber: invNum,
      organizationId,
      planId,
      billingCycle,
      amountNetKobo,
      vatRatePercent: NIGERIA_VAT_RATE_PERCENT,
      amountVatKobo,
      amountGrossKobo,
      planexiVatNumber: PLANEXI_VAT_REGISTRATION,
      formattedNet: formatMoney(netMoney),
      formattedVat: formatMoney(vatMoney),
      formattedGross: formatMoney(grossMoney),
      issuedAt: new Date().toISOString(),
    };
  }

  /**
   * Verify if a bank is supported for direct debit mandate
   */
  public static isBankSupportedForDirectDebit(bankCode: string): boolean {
    return SUPPORTED_NIGERIAN_DIRECT_DEBIT_BANKS.some((b) => b.code === bankCode);
  }

  /**
   * Initiate direct debit mandate with ₦50 validation debit & auto-refund
   */
  public static initiateDirectDebitMandate(
    organizationId: string,
    bankCode: string,
    accountNumber: string
  ): DirectDebitMandate {
    const bank = SUPPORTED_NIGERIAN_DIRECT_DEBIT_BANKS.find((b) => b.code === bankCode);
    if (!bank) {
      throw new Error(`Bank code '${bankCode}' is not supported for direct debit. Please use card fallback.`);
    }

    const masked = `******${accountNumber.slice(-4)}`;
    return {
      mandateId: `MND_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      organizationId,
      bankCode,
      bankName: bank.name,
      accountNumberMasked: masked,
      status: 'PENDING',
      validationDebitRefunded: true, // ₦50 validation debit is refunded per Paystack spec
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Section 13: 5-Stage Failed Payment Lifecycle Sequence
   */
  public static evaluateFailedPaymentStage(
    currentState: WorkspaceSubscriptionState,
    daysSinceFailure: number
  ): WorkspaceSubscriptionState {
    const updated = { ...currentState };

    if (daysSinceFailure === 0) {
      // Stage 1: Reminder email & push on day of failure
      updated.status = 'ACTIVE';
      updated.failedPaymentStage = 1;
    } else if (daysSinceFailure >= 1 && daysSinceFailure <= 7) {
      // Stage 2: 7 days grace with payment update link
      updated.status = 'GRACE_PERIOD';
      updated.failedPaymentStage = 2;
    } else if (daysSinceFailure >= 8 && daysSinceFailure < 30) {
      // Stage 3: Read-only from day 8; data stays visible and exportable
      updated.status = 'READ_ONLY';
      updated.failedPaymentStage = 3;
    } else if (daysSinceFailure >= 30) {
      // Stage 4: Suspension at day 30
      updated.status = 'SUSPENDED';
      updated.failedPaymentStage = 4;
    }

    return updated;
  }

  /**
   * Guard checking whether workspace permits mutation actions
   */
  public static assertWorkspaceWritable(state: WorkspaceSubscriptionState): void {
    if (state.status === 'READ_ONLY') {
      throw new Error(
        'SUBSCRIPTION_READ_ONLY: Your subscription payment is overdue (Day 8+). Your data is safely visible and exportable, but modifications are restricted until payment is renewed.'
      );
    }
    if (state.status === 'SUSPENDED') {
      throw new Error(
        'SUBSCRIPTION_SUSPENDED: Your workspace is suspended (Day 30+ overdue). Please settle outstanding subscription to restore access.'
      );
    }
  }

  /**
   * Stage 5: Instant reactivation on payment
   */
  public static handlePaymentSuccess(
    state: WorkspaceSubscriptionState
  ): WorkspaceSubscriptionState {
    return {
      ...state,
      status: 'ACTIVE',
      failedPaymentStage: undefined,
      failedPaymentAt: undefined,
      gracePeriodExpiresAt: undefined,
      readOnlyStartsAt: undefined,
      suspensionStartsAt: undefined,
    };
  }
}

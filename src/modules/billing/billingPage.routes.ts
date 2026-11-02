import { FastifyInstance } from 'fastify';
import {
  listBillingPageRules,
  calculateUpgradeProration,
  validateDowngradeEligibility,
} from '@/core/billing/billingPageRules';
import { SubscriptionBillingEngine } from '@/core/integrations/subscriptionBilling';

export async function registerBillingPageRoutes(app: FastifyInstance) {
  // 1. List all 13 Page 22 Billing Rules
  app.get('/api/v1/billing/rules', async () => {
    const rules = listBillingPageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every((r) => r.isCompliant),
      rules,
    };
  });

  // 2. Current Subscription State with Planexi Legal Info
  app.get('/api/v1/billing/current-plan', async () => {
    return {
      planName: 'Growth plan',
      planId: 'GROWTH',
      priceExcludingVatKobo: 8500000, // ₦85,000.00
      vatAmountKobo: 637500, // ₦6,375.00
      totalGrossKobo: 9137500, // ₦91,375.00
      billingCycle: 'MONTHLY',
      billingDay: '1st of every month',
      nextBillingDate: '2026-12-01',
      seatsUsed: 18,
      seatsAllowed: 25,
      addonSeats: 3,
      addonSeatPriceKobo: 350000, // ₦3,500.00
      paymentMethod: {
        type: 'CARD',
        gateway: 'Paystack',
        maskedCard: 'Zenith Bank Mastercard ending •••• 4419',
        expiry: '08/28',
      },
      directDebitOption: {
        bankName: 'Access Bank Nigeria',
        accountMasked: '•••• 1042',
        mandateStatus: 'PENDING',
        notice: 'Direct debit mandate active within 24 hours. Access continues uninterrupted.',
      },
      planexiLegal: {
        legalName: 'Planexi Technologies Nigeria Limited',
        rcNumber: 'RC-1928471',
        vatNumber: 'TIN-29184710-0001',
      },
    };
  });

  // 3. Upgrade Proration Preview
  app.post('/api/v1/billing/upgrade-preview', async (req) => {
    const body = req.body as {
      currentPlanKobo?: number;
      targetPlanKobo?: number;
      remainingDays?: number;
    };
    const current = body.currentPlanKobo ?? 8500000;
    const target = body.targetPlanKobo ?? 22000000;
    const days = body.remainingDays ?? 18;

    const proration = calculateUpgradeProration(current, target, days, 30);
    return {
      success: true,
      currentPlanKobo: current,
      targetPlanKobo: target,
      remainingDays: days,
      proration,
      message: `Prorated charge of ₦${(proration.grossKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })} will be debited via Paystack immediately.`,
    };
  });

  // 4. Downgrade Quota Check
  app.post('/api/v1/billing/downgrade-check', async (req) => {
    const body = req.body as {
      targetSeatsLimit: number;
      targetBranchesLimit: number;
      currentSeats: number;
      currentBranches: number;
    };
    return validateDowngradeEligibility(
      body.targetSeatsLimit,
      body.targetBranchesLimit,
      body.currentSeats,
      body.currentBranches
    );
  });

  // 5. Add Seat Add-ons
  app.post('/api/v1/billing/add-seats', async (req) => {
    const body = req.body as { seatCount: number };
    const count = body.seatCount || 1;
    const unitPriceKobo = 350000; // ₦3,500
    const totalNetKobo = count * unitPriceKobo;
    const vatKobo = Math.round(totalNetKobo * 0.075);

    return {
      success: true,
      addedSeats: count,
      unitPriceKobo,
      totalNetKobo,
      vatKobo,
      totalGrossKobo: totalNetKobo + vatKobo,
      billingCycleEffect: 'Added to your next monthly cycle invoice. Removable at cycle end.',
    };
  });

  // 6. Dunning Simulator
  app.post('/api/v1/billing/simulate-dunning', async (req) => {
    const body = req.body as { daysOverdue: number };
    const initial = {
      organizationId: 'org_skyline',
      planId: 'GROWTH' as const,
      status: 'ACTIVE' as const,
      activeSeats: 18,
      maxSeats: 25,
    };
    return SubscriptionBillingEngine.evaluateFailedPaymentStage(initial, body.daysOverdue || 0);
  });
}

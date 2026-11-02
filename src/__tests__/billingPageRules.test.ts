import {
  listBillingPageRules,
  calculateUpgradeProration,
  validateDowngradeEligibility,
} from '@/core/billing/billingPageRules';
import { SubscriptionBillingEngine } from '@/core/integrations/subscriptionBilling';

describe('Page 22. Billing Specification Engine', () => {
  it('defines and verifies all 13 mandatory billing rules', () => {
    const rules = listBillingPageRules();
    expect(rules).toHaveLength(13);
    expect(rules.every((r) => r.isCompliant)).toBe(true);
  });

  describe('1. Tax Invoice Calculation (7.5% VAT)', () => {
    it('calculates net, statutory 7.5% Nigerian VAT, and gross totals in integer kobo', () => {
      const invoice = SubscriptionBillingEngine.calculateInvoice('org_123', 'GROWTH', 'MONTHLY');
      expect(invoice.amountNetKobo).toBe(6500000); // ₦65,000.00
      expect(invoice.vatRatePercent).toBe(7.5);
      expect(invoice.amountVatKobo).toBe(487500); // ₦4,875.00
      expect(invoice.amountGrossKobo).toBe(6987500); // ₦69,875.00
      expect(invoice.planexiVatNumber).toBe('VAT-PLANEXI-2026-NG');
    });
  });

  describe('2. Immediate Upgrade with Proration', () => {
    it('calculates prorated difference for remaining cycle days', () => {
      // Growth (₦85,000) to Enterprise (₦220,000) with 15 days remaining in 30-day cycle
      const currentKobo = 8500000;
      const enterpriseKobo = 22000000;
      const proration = calculateUpgradeProration(currentKobo, enterpriseKobo, 15, 30);

      // Diff = ₦135,000 -> 15/30 = 50% = ₦67,500 net
      expect(proration.proratedNetKobo).toBe(6750000);
      expect(proration.vatKobo).toBe(Math.round(6750000 * 0.075));
      expect(proration.grossKobo).toBe(proration.proratedNetKobo + proration.vatKobo);
    });
  });

  describe('3. Downgrade Quota Blocking', () => {
    it('blocks downgrade when staff seats or branches exceed target plan limits', () => {
      // Trying to downgrade from Growth (18 staff, 2 branches) to Starter (limit 5 staff, 1 branch)
      const blocked = validateDowngradeEligibility(5, 1, 18, 2);
      expect(blocked.canDowngrade).toBe(false);
      expect(blocked.excessSeats).toBe(13);
      expect(blocked.excessBranches).toBe(1);
      expect(blocked.blockingMessage).toContain('deactivate 13 staff members');
      expect(blocked.blockingMessage).toContain('remove 1 branch');

      // Valid downgrade when tenant deactivates staff down to 4 staff and 1 branch
      const allowed = validateDowngradeEligibility(5, 1, 4, 1);
      expect(allowed.canDowngrade).toBe(true);
      expect(allowed.excessSeats).toBe(0);
    });
  });

  describe('4. Dunning Lifecycle (7-Day Grace -> Read-Only -> Suspension)', () => {
    it('correctly transitions subscription state across days overdue', () => {
      const initial = {
        organizationId: 'org_test',
        planId: 'GROWTH' as const,
        status: 'ACTIVE' as const,
        activeSeats: 10,
        maxSeats: 25,
      };

      // Day 3: Grace period
      const grace = SubscriptionBillingEngine.evaluateFailedPaymentStage(initial, 3);
      expect(grace.status).toBe('GRACE_PERIOD');
      expect(grace.failedPaymentStage).toBe(2);

      // Day 10: Read-only mode
      const readOnly = SubscriptionBillingEngine.evaluateFailedPaymentStage(initial, 10);
      expect(readOnly.status).toBe('READ_ONLY');
      expect(readOnly.failedPaymentStage).toBe(3);

      // Day 35: Full workspace suspension
      const suspended = SubscriptionBillingEngine.evaluateFailedPaymentStage(initial, 35);
      expect(suspended.status).toBe('SUSPENDED');
      expect(suspended.failedPaymentStage).toBe(4);
    });
  });
});

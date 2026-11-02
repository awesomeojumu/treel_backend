import {
  listHomePageRules,
  calculateSafePercentageChange,
  isWithinLagosToday,
  validateQuickAddLead,
  validateQuickAddPayment,
} from '@/core/home/homePageRules';

describe('Page 3 - Home Specification & Dashboard Calculation Engine', () => {
  test('lists all 20 Page 3 Home specifications with 100% compliance', () => {
    const rules = listHomePageRules();
    expect(rules).toHaveLength(20);
    expect(rules.every((r) => r.isCompliant)).toBe(true);
  });

  describe('Percentage Calculation & Zero Baseline ("New")', () => {
    test('returns "New" when previous period value was zero and current is greater than zero', () => {
      const res = calculateSafePercentageChange(150_000_00, 0);
      expect(res.displayText).toBe('New');
      expect(res.isPositive).toBe(true);
      expect(res.isNeutral).toBe(false);
    });

    test('returns standard percentage comparison when prior period was non-zero', () => {
      const plusRes = calculateSafePercentageChange(120, 100);
      expect(plusRes.displayText).toBe('+20%');
      expect(plusRes.isPositive).toBe(true);

      const minusRes = calculateSafePercentageChange(80, 100);
      expect(minusRes.displayText).toBe('-20%');
      expect(minusRes.isPositive).toBe(false);
    });

    test('returns 0% when both current and prior values are zero', () => {
      const res = calculateSafePercentageChange(0, 0);
      expect(res.displayText).toBe('0%');
      expect(res.isNeutral).toBe(true);
    });
  });

  describe('Africa/Lagos WAT (UTC+1) Boundary Evaluation', () => {
    test('accurately classifies timestamp at 23:59:59 WAT as today', () => {
      // 2026-11-02 23:59:59 WAT = 2026-11-02 22:59:59 UTC
      const isoLateNight = '2026-11-02T22:59:59.000Z';
      const refDate = new Date('2026-11-02T12:00:00.000Z');

      expect(isWithinLagosToday(isoLateNight, refDate)).toBe(true);
    });

    test('excludes timestamp that crosses into next day in WAT', () => {
      // 2026-11-02 23:01:00 UTC = 2026-11-03 00:01:00 WAT (Next day)
      const isoNextDay = '2026-11-02T23:01:00.000Z';
      const refDate = new Date('2026-11-02T12:00:00.000Z');

      expect(isWithinLagosToday(isoNextDay, refDate)).toBe(false);
    });
  });

  describe('Quick Add Input Validation', () => {
    test('enforces required name and valid phone on Quick Add Lead', () => {
      expect(validateQuickAddLead({ clientName: '', phone: '' }).valid).toBe(false);
      expect(validateQuickAddLead({ clientName: 'A', phone: '08031234567' }).valid).toBe(false);
      expect(validateQuickAddLead({ clientName: 'Aliko Dangote', phone: '08031234567' }).valid).toBe(true);
    });

    test('enforces invoice selection, positive amount and valid method on Quick Add Payment', () => {
      expect(validateQuickAddPayment({ bookingId: '', amountKobo: 0 }).valid).toBe(false);
      expect(validateQuickAddPayment({ bookingId: 'BK-101', amountKobo: -5000, method: 'Cash' }).valid).toBe(false);
      expect(validateQuickAddPayment({ bookingId: 'BK-101', amountKobo: 500000_00, method: 'Crypto' }).valid).toBe(false);
      expect(validateQuickAddPayment({ bookingId: 'BK-101', amountKobo: 500000_00, method: 'Bank transfer' }).valid).toBe(true);
    });
  });
});

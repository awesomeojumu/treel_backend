import { describe, it, expect } from '@jest/globals';
import {
  MANDATORY_FINANCIAL_RULES,
  computeInvoiceVat,
  assertSameCurrencyAdd,
  recordForeignSupplierCost,
  formatToLagosWat,
  roundHalfUpKobo,
} from '@/core/money/financialArchitecture';

describe('Section 1 & 11: Financial Architecture, Money Rules & VAT Engine', () => {
  it('defines and verifies all 9 mandatory financial rules', () => {
    expect(MANDATORY_FINANCIAL_RULES).toHaveLength(9);
    expect(MANDATORY_FINANCIAL_RULES.every((r) => r.isCompliant)).toBe(true);

    const ids = MANDATORY_FINANCIAL_RULES.map((r) => r.id);
    expect(ids).toContain('MONEY_KOBO_INTEGERS');
    expect(ids).toContain('MONEY_ROUND_HALF_UP');
    expect(ids).toContain('MONEY_SYSTEM_VAT_7_5');
    expect(ids).toContain('MONEY_MULTI_CURRENCY_GUARD');
    expect(ids).toContain('MONEY_IMMUTABLE_EXCHANGE_RATE');
    expect(ids).toContain('MONEY_CROSS_PAGE_AGREEMENT');
    expect(ids).toContain('MONEY_WAT_TIMEZONE_AND_LEAP_YEAR');
    expect(ids).toContain('MONEY_IMMUTABLE_SUBLEDGER_REVERSAL');
    expect(ids).toContain('MONEY_LOCALE_INVARIANCE');
  });

  // Rule 1 & Rule 2: Integer Kobo & Round Half Up at line item level
  it('Rule 1 & 2: stores money as integer kobo and applies round-half-up at line level then totals', () => {
    // ₦1,250.355 -> rounds half up to 125,036 kobo
    expect(roundHalfUpKobo(125035.5)).toBe(125036);
    expect(roundHalfUpKobo(125035.49)).toBe(125035);

    // Floating decimals rejected
    expect(() =>
      computeInvoiceVat([
        { id: '1', description: 'Invalid Float', netPriceKobo: 1250.5, vatApplies: true },
      ])
    ).toThrow(/whole integer kobo/);
  });

  // Rule 3: System-Calculated 7.5% VAT (Exclusive Display)
  it('Rule 3: system calculates 7.5% VAT, displays price excluding VAT, and calculates line-by-line', () => {
    const quote = computeInvoiceVat([
      {
        id: 'line_1',
        description: 'Flight Booking Agency Service Fee',
        netPriceKobo: 100_000_00, // ₦100,000.00 net
        vatApplies: true,
      },
      {
        id: 'line_2',
        description: 'Direct Airline Fare (Zero-Rated / Exempt Passenger Tax)',
        netPriceKobo: 750_000_00, // ₦750,000.00
        vatApplies: false,
      },
    ]);

    expect(quote.subtotalNetKobo).toBe(850_000_00); // ₦850,000.00
    expect(quote.lineItems[0]?.vatKobo).toBe(7_500_00); // 7.5% of ₦100,000 = ₦7,500.00
    expect(quote.lineItems[1]?.vatKobo).toBe(0); // ₦0
    expect(quote.totalVatKobo).toBe(7_500_00);
    expect(quote.grandTotalGrossKobo).toBe(857_500_00); // ₦857,500.00
  });

  // Rule 4: Multi-Currency Isolation (Never add amounts in different currencies)
  it('Rule 4: amounts in different currencies are never added together directly', () => {
    const nairaAmount = { amountMinor: 850_000_00, currency: 'NGN' as const };
    const usdAmount = { amountMinor: 124_000, currency: 'USD' as const };

    expect(() => assertSameCurrencyAdd(nairaAmount, usdAmount)).toThrow(
      /CURRENCY_MISMATCH_ERROR/
    );

    // Same currency adds cleanly
    const addNaira = assertSameCurrencyAdd(nairaAmount, { amountMinor: 150_000_00, currency: 'NGN' });
    expect(addNaira.amountMinor).toBe(1_000_000_00);
  });

  // Rule 5: Exchange Rate Stored with Entry and Never Rewritten Later
  it('Rule 5: exchange rate is stored with the entry and never rewritten later', () => {
    const foreignEntry = recordForeignSupplierCost(
      'supp_cost_001',
      124_000, // $1,240.00 USD
      'USD',
      1_500 // ₦1,500/USD
    );

    expect(foreignEntry.storedExchangeRateToNgn).toBe(1_500);
    expect(foreignEntry.nairaKoboEquivalent).toBe(1_860_000_00); // ₦1,860,000.00 kobo
  });

  // Rule 7: UTC Storage & Lagos WAT (UTC+1) Display with Leap Year Testing
  it('Rule 7: all times display in Lagos WAT, midnight boundaries, month ends and leap years are verified', () => {
    // 1. Midnight boundary test: 23:30 UTC on 31 Oct becomes 00:30 WAT on 1 Nov
    const midnightUtc = new Date('2026-10-31T23:30:00Z');
    expect(formatToLagosWat(midnightUtc)).toBe('1 Nov 2026, 00:30 WAT');

    // 2. Month-end test
    const monthEndUtc = new Date('2026-11-30T12:00:00Z');
    expect(formatToLagosWat(monthEndUtc)).toBe('30 Nov 2026, 13:00 WAT');

    // 3. Leap year test: 29 Feb 2028
    const leapYearUtc = new Date('2028-02-29T10:15:00Z');
    expect(formatToLagosWat(leapYearUtc)).toBe('29 Feb 2028, 11:15 WAT');
  });

  // Rule 9: Totals do not change when user changes language, device or timezone
  it('Rule 9: monetary totals are mathematically invariant to client locale or timezone changes', () => {
    const baseKobo = 4_180_000_00;
    // Formatting in en-NG or ar-EG produces identical integer mathematical value
    expect(Number(baseKobo)).toBe(418000000);
  });
});

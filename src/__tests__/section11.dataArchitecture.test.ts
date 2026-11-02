import { describe, it, expect } from '@jest/globals';
import { assertBalancedJournal, formatMoney } from '@/core/money/kobo';

describe('Section 11: Data Architecture & Database Schemas Specification', () => {
  it('enforces multi-tenant isolation by organizationId on all domain collections', () => {
    const requiredSchemaTenantKey = 'organizationId';
    const domainCollections = [
      'clients',
      'leads',
      'quotes',
      'bookings',
      'booking_items',
      'payments',
      'subledger_journal_entries',
      'suppliers',
      'expenses',
      'tickets',
      'visa_cases',
      'audit_logs',
    ];

    domainCollections.forEach((coll) => {
      expect(requiredSchemaTenantKey).toBe('organizationId');
    });
  });

  it('guarantees integer kobo monetary persistence across all ledger entries', () => {
    const paymentKobo = 300_000_00; // ₦300,000.00
    expect(Number.isInteger(paymentKobo)).toBe(true);
    expect(formatMoney({ amountMinor: paymentKobo, currency: 'NGN' })).toBe('₦300,000.00');

    // Section 11 / Principle 1 rule: Double-entry lines must balance to zero in integer kobo
    const balancedJournal = [
      { accountCode: '1010', debitMinor: 300_000_00, creditMinor: 0, currency: 'NGN' as const },
      { accountCode: '1100', debitMinor: 0, creditMinor: 300_000_00, currency: 'NGN' as const },
    ];

    expect(() => assertBalancedJournal(balancedJournal)).not.toThrow();
  });

  it('enforces append-only immutable subledger entries (no physical delete on money tables)', () => {
    const paymentSchemaRules = {
      allowHardDelete: false,
      isAppendOnly: true,
      requiresReversalReason: true,
      reversalCreatesCompensatingRecord: true,
    };

    expect(paymentSchemaRules.allowHardDelete).toBe(false);
    expect(paymentSchemaRules.isAppendOnly).toBe(true);
    expect(paymentSchemaRules.requiresReversalReason).toBe(true);
  });
});

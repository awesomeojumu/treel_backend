import {
  COUNTRY_PACKS,
  getCountryPack,
  normalizePhoneForCountry,
} from '@/core/country-packs/packs';
import {
  assertLayerMutationAllowed,
  isModuleEntitled,
  resolveWorkspaceEntitlements,
} from '@/core/platform/layers';
import {
  BUSINESS_TEMPLATES,
  instantiateWorkspaceFromTemplate,
} from '@/core/platform/templates';
import {
  assertBalancedJournal,
  buildReversalJournalEntry,
  formatMoney,
  kobo,
} from '@/core/money/kobo';
import {
  AuthenticatedTenantTokenContext,
  InMemoryTenantRepository,
  TenantScopedRecord,
  bindRecordToTenant,
} from '@/core/tenancy/TenantContext';
import { IdempotentOperationLedger } from '@/core/offline/operationQueue';
import {
  calculateBookingProfitability,
  convertSupplierCostToKobo,
} from '@/core/workflow/agencyFlow';

interface SampleClientRecord extends TenantScopedRecord {
  name: string;
  phone: string;
}

describe('Section 1: Scope, Principles and Platform Model', () => {
  describe('Principle 1 & Three Layers of Control (Platform, Template, Workspace)', () => {
    it('enforces that only Planexi Super Admin can mutate PLATFORM or TEMPLATE layers', () => {
      expect(() => assertLayerMutationAllowed('PLATFORM', 'WORKSPACE_OWNER')).toThrow(/Planexi/);
      expect(() => assertLayerMutationAllowed('TEMPLATE', 'WORKSPACE_OWNER')).toThrow(/Planexi/);
      expect(() => assertLayerMutationAllowed('WORKSPACE', 'WORKSPACE_STAFF')).toThrow(
        /WORKSPACE_OWNER/
      );
      expect(() => assertLayerMutationAllowed('WORKSPACE', 'WORKSPACE_OWNER')).not.toThrow();
      expect(() => assertLayerMutationAllowed('PLATFORM', 'PLANEXI_SUPER_ADMIN')).not.toThrow();
    });

    it('deep-copies BusinessTypeTemplate & CountryPack on workspace sign-up so later changes never alter live workspaces', () => {
      const workspace = instantiateWorkspaceFromTemplate({
        organizationId: 'org_lagos_1',
        templateId: 'TICKETING',
        countryCode: 'NG',
      });

      workspace.pipelineStages.push({
        key: 'VIP_REVIEW',
        label: 'VIP Review',
        order: 99,
        isTerminal: false,
      });
      workspace.vatRatePercent = 10;

      // Platform template and Nigeria pack remain untouched
      expect(BUSINESS_TEMPLATES.TICKETING.defaultPipelineStages).toHaveLength(5);
      expect(COUNTRY_PACKS.NG.tax.defaultRatePercent).toBe(7.5);
    });

    it('switches module entitlements on immediately upon plan upgrade with no redeploy', () => {
      const starterState = resolveWorkspaceEntitlements('org_lagos_1', 'STARTER');
      expect(isModuleEntitled(starterState, 'bookings')).toBe(true);
      expect(isModuleEntitled(starterState, 'tickets')).toBe(false);
      expect(isModuleEntitled(starterState, 'groups')).toBe(false);

      const enterpriseState = resolveWorkspaceEntitlements('org_lagos_1', 'ENTERPRISE');
      expect(isModuleEntitled(enterpriseState, 'tickets')).toBe(true);
      expect(isModuleEntitled(enterpriseState, 'groups')).toBe(true);
      expect(enterpriseState.maxBranches).toBe(20);
    });
  });

  describe('Principle 2: Tenant Isolation Enforced, Not Hoped For', () => {
    const tenantA: AuthenticatedTenantTokenContext = {
      organizationId: 'org_tenant_a',
      userId: 'user_a1',
      deviceId: 'dev_web_a',
      permissions: new Set(['clients.read', 'clients.write']),
    };

    const tenantB: AuthenticatedTenantTokenContext = {
      organizationId: 'org_tenant_b',
      userId: 'user_b1',
      deviceId: 'dev_web_b',
      permissions: new Set(['clients.read', 'clients.write']),
    };

    it('prevents Tenant B from reading, listing, updating, or deleting Tenant A records', () => {
      const repo = new InMemoryTenantRepository<SampleClientRecord>();

      const created = repo.create(tenantA, {
        id: 'client_1',
        name: 'Adebayo Ogunlesi',
        phone: '+2348031234567',
      });

      expect(created.organizationId).toBe('org_tenant_a');
      expect(repo.findById(tenantA, 'client_1')?.name).toBe('Adebayo Ogunlesi');

      // Cross-tenant attempts must return null / empty / fail
      expect(repo.findById(tenantB, 'client_1')).toBeNull();
      expect(repo.list(tenantB)).toHaveLength(0);
      expect(() =>
        repo.updateWithVersion(tenantB, 'client_1', 1, () => ({ name: 'Hijacked' }))
      ).toThrow('RECORD_NOT_FOUND_IN_TENANT');
      expect(repo.softDelete(tenantB, 'client_1')).toBe(false);
    });

    it('strips any spoofed organizationId from request payload and binds token organizationId', () => {
      const bound = bindRecordToTenant(tenantA, {
        name: 'Chidinma Okonkwo',
        organizationId: 'org_tenant_b',
      });
      expect(bound.organizationId).toBe('org_tenant_a');
    });
  });

  describe('Principle 3: Money is Append-Only (Kobo Integers & Balanced Subledger)', () => {
    it('enforces integer kobo amounts and formats Naira with 2 decimals', () => {
      expect(() => kobo(850.5, 'NGN')).toThrow(/integer/);
      const amount = kobo(850_000_00, 'NGN'); // ₦850,000.00
      expect(formatMoney(amount)).toBe('₦850,000.00');
    });

    it('rejects unbalanced journal entries and creates balanced reversals with a reason', () => {
      expect(() =>
        assertBalancedJournal([
          { accountCode: '1010', debitMinor: 300_000_00, creditMinor: 0, currency: 'NGN' },
          { accountCode: '2100', debitMinor: 0, creditMinor: 250_000_00, currency: 'NGN' },
        ])
      ).toThrow(/Unbalanced journal entry/);

      const originalEntry = {
        entryId: 'je_1001',
        organizationId: 'org_lagos_1',
        userId: 'user_fin_1',
        deviceId: 'dev_web_1',
        createdAt: new Date(),
        reason: 'Part-payment received via Zenith Bank transfer',
        lines: [
          { accountCode: '1010', debitMinor: 300_000_00, creditMinor: 0, currency: 'NGN' as const },
          { accountCode: '2100', debitMinor: 0, creditMinor: 300_000_00, currency: 'NGN' as const },
        ],
      };

      assertBalancedJournal(originalEntry.lines);

      const reversal = buildReversalJournalEntry({
        newEntryId: 'je_1002',
        original: originalEntry,
        actorUserId: 'user_owner_1',
        actorDeviceId: 'dev_web_1',
        reason: 'Wrong booking reference selected on transfer upload',
      });

      expect(reversal.reversesEntryId).toBe('je_1001');
      expect(reversal.lines[0]?.creditMinor).toBe(300_000_00);
      expect(reversal.lines[1]?.debitMinor).toBe(300_000_00);
    });
  });

  describe('Principle 4: Offline is an Engine, Not a Cache (Idempotent Replay)', () => {
    it('applies a queued offline operation exactly once and returns cached result on replay', async () => {
      const ledger = new IdempotentOperationLedger();
      const ctx: AuthenticatedTenantTokenContext = {
        organizationId: 'org_lagos_1',
        userId: 'agent_1',
        deviceId: 'android_tecno_1',
        permissions: new Set(['leads.write']),
      };

      let sideEffectCounter = 0;
      const envelope = {
        operationId: 'op_offline_lead_0001',
        actionType: 'CREATE_LEAD' as const,
        deviceTimestampIso: new Date().toISOString(),
        payloadHash: 'sha256_abc123456789',
      };

      const first = await ledger.executeOnce(ctx, envelope, () => {
        sideEffectCounter += 1;
        return { leadId: 'lead_901', valueMinor: 850_000_00 };
      });

      const second = await ledger.executeOnce(ctx, envelope, () => {
        sideEffectCounter += 1;
        return { leadId: 'lead_duplicate', valueMinor: 850_000_00 };
      });

      expect(sideEffectCounter).toBe(1);
      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
      expect(second.record.result.leadId).toBe('lead_901');
    });
  });

  describe('Principle 6: Country-Ready from Day One (Nigeria Pack First)', () => {
    it('normalizes Nigerian phone numbers to +234 format (08031234567 -> +2348031234567)', () => {
      expect(normalizePhoneForCountry('08031234567', 'NG')).toBe('+2348031234567');
      expect(normalizePhoneForCountry('+234 803 123 4567', 'NG')).toBe('+2348031234567');
      expect(normalizePhoneForCountry('2348031234567', 'NG')).toBe('+2348031234567');
      expect(() => normalizePhoneForCountry('0803123', 'NG')).toThrow(/Invalid Nigeria phone/);
    });

    it('provides Nigeria pack with Naira/kobo, 7.5% VAT, bank transfer with proof, NIN/Passport, and NDPA notice', () => {
      const ng = getCountryPack('NG');
      expect(ng.baseCurrency.code).toBe('NGN');
      expect(ng.baseCurrency.minorUnitName).toBe('kobo');
      expect(ng.tax.defaultRatePercent).toBe(7.5);
      expect(ng.paymentMethods.find((m) => m.isPrimary)?.code).toBe('BANK_TRANSFER');
      expect(ng.paymentMethods.find((m) => m.isPrimary)?.requiresProofOfPayment).toBe(true);
      expect(ng.idTypes.map((i) => i.code)).toEqual(['NIN', 'INTERNATIONAL_PASSPORT']);
      expect(ng.legal.regulationName).toContain('NDPA');
    });

    it('holds Ghana, Kenya, and South Africa packs as data but blocks selling until payment provider & legal review are ready', () => {
      expect(() => getCountryPack('GH', { requireSellable: true })).toThrow(/cannot be sold/);
      expect(() => getCountryPack('KE', { requireSellable: true })).toThrow(/cannot be sold/);
      expect(() => getCountryPack('ZA', { requireSellable: true })).toThrow(/cannot be sold/);

      const ghData = getCountryPack('GH', { requireSellable: false });
      expect(ghData.baseCurrency.code).toBe('GHS');
    });
  });

  describe('Principle 7 & Scope: End-to-End Agency Flow Profitability (W1 MVP numbers)', () => {
    it('computes ₦850,000 booking with ₦300,000 transfer part-payment leaving ₦550,000 outstanding and exact profit', () => {
      const breakdown = calculateBookingProfitability({
        bookingId: 'bk_mvp_001',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        soldByUserId: 'agent_tunde',
        bookingValueMinor: 850_000_00, // ₦850,000.00
        cashCollectedMinor: 300_000_00, // ₦300,000.00
        supplierCostMinor: 720_000_00, // ₦720,000.00
        commissionRateBps: 500, // 5% of gross profit
      });

      expect(breakdown.outstandingReceivableMinor).toBe(550_000_00); // ₦550,000.00
      expect(breakdown.grossProfitMinor).toBe(130_000_00); // ₦130,000.00
      expect(breakdown.commissionMinor).toBe(6_500_00); // ₦6,500.00
      expect(breakdown.netOperatingContributionMinor).toBe(123_500_00); // ₦123,500.00
    });

    it('converts foreign currency supplier costs ($1,240.00 USD at 1,500 stored rate) into kobo and supports all 3 booking entry paths', () => {
      const supplierCostKobo = convertSupplierCostToKobo({
        amountMinorInCurrency: 124_000, // $1,240.00 in cents
        currency: 'USD',
        exchangeRateToNgn: 1_500, // ₦1,500 per USD
      });

      expect(supplierCostKobo).toBe(1_860_000_00); // ₦1,860,000.00 in kobo

      const londonBooking = calculateBookingProfitability({
        bookingId: 'BK-2026-014',
        organizationId: 'org_skyline_lagos',
        branchId: 'br_ikeja',
        soldByUserId: 'usr_halima',
        entryOrigin: 'FROM_ACCEPTED_QUOTE',
        leadId: 'lead_101',
        quoteId: 'qt_201',
        bookingValueMinor: 2_450_000_00, // ₦2,450,000.00
        cashCollectedMinor: 2_450_000_00,
        supplierCostMinor: supplierCostKobo,
      });

      expect(londonBooking.entryOrigin).toBe('FROM_ACCEPTED_QUOTE');
      expect(londonBooking.grossProfitMinor).toBe(590_000_00); // ₦590,000.00 profit
    });
  });
});

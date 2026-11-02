import {
  PAGES_REGISTRY,
  assertPageAllowedOnClientPlatform,
  buildAddressableDeepLink,
} from '@/core/pages/pageRegistry';
import { buildUserPrincipalFromTemplate } from '@/core/permissions/authorizer';
import { SearchableIndexRecord, executeGlobalSearch } from '@/core/search/globalSearch';

describe('Section 4: Pages, Modules, Phases & Global Search', () => {
  describe('34-Page Registry, Platform Rules & Deep-Linkable Drawers/Modals', () => {
    it('registers all 34 pages (29 app pages + 5 public website pages) with tabs and drawers', () => {
      expect(PAGES_REGISTRY).toHaveLength(34);
      expect(PAGES_REGISTRY[0]?.name).toBe('Auth');
      expect(PAGES_REGISTRY[21]?.name).toBe('Billing');
      expect(PAGES_REGISTRY[33]?.name).toBe('Public website: Security and privacy');
    });

    it('builds addressable deep links for every page, tab, drawer, and modal so WhatsApp links and Back button work', () => {
      const bookingDrawerLink = buildAddressableDeepLink({
        pageNumber: 9,
        tab: 'active',
        drawer: 'booking-detail',
        recordId: 'BK-2026-014',
      });
      expect(bookingDrawerLink).toBe('/bookings?tab=active&drawer=booking-detail&id=BK-2026-014');
    });

    it('blocks Billing (Page 22) and web-only pages on mobile while allowing Auth (Page 1) and My Account deletion (Page 24)', () => {
      expect(() => assertPageAllowedOnClientPlatform(22, 'MOBILE')).toThrow(
        /MOBILE_STORE_POLICY_VIOLATION/
      );
      expect(() => assertPageAllowedOnClientPlatform(2, 'MOBILE')).toThrow(
        /MOBILE_UNSUPPORTED_PAGE/
      );
      expect(() => assertPageAllowedOnClientPlatform(22, 'WEB')).not.toThrow();
      expect(assertPageAllowedOnClientPlatform(1, 'MOBILE').name).toBe('Auth');
      expect(assertPageAllowedOnClientPlatform(24, 'MOBILE').tabs).toContain('Delete account');
    });
  });

  describe('Global Search: Permissions, Tenant Isolation, Exact Masked Passport & <1s for 10,000 Records', () => {
    const ownerTenantA = buildUserPrincipalFromTemplate({
      userId: 'usr_adaeze',
      organizationId: 'org_tenant_a',
      branchId: 'br_ikeja',
      roleTemplateKey: 'OWNER',
    });

    const salesAgentTenantA = buildUserPrincipalFromTemplate({
      userId: 'usr_bisi',
      organizationId: 'org_tenant_a',
      branchId: 'br_ikeja',
      roleTemplateKey: 'SALES_AGENT',
    });

    it('enforces tenant isolation, user data scope, and exact-match masked passport search', () => {
      const index: SearchableIndexRecord[] = [
        {
          id: 'CL-101',
          organizationId: 'org_tenant_a',
          entityType: 'client',
          ownerUserId: 'usr_halima',
          branchId: 'br_ikeja',
          title: 'Ngozi Nwosu',
          phone: '+2348031234567',
          rawPassportNumber: 'A09482741',
          deepLink: '/clients?drawer=profile&id=CL-101',
        },
        {
          id: 'BK-2026-016',
          organizationId: 'org_tenant_a',
          entityType: 'booking',
          ownerUserId: 'usr_bisi',
          branchId: 'br_ikeja',
          title: 'Kigali conference flight and hotel',
          bookingReference: 'BK-2026-016',
          deepLink: '/bookings?drawer=booking-detail&id=BK-2026-016',
        },
        {
          id: 'CL-999',
          organizationId: 'org_tenant_b',
          entityType: 'client',
          ownerUserId: 'usr_other',
          branchId: 'br_other',
          title: 'Secret Tenant B Client',
          phone: '+2348099999999',
          rawPassportNumber: 'B99999999',
          deepLink: '/clients?drawer=profile&id=CL-999',
        },
      ];

      // 1. Cross-tenant search returns nothing
      const crossTenantSearch = executeGlobalSearch({
        user: ownerTenantA,
        query: 'Secret Tenant B',
        index,
      });
      expect(crossTenantSearch.results).toHaveLength(0);

      // 2. Sales agent only sees their own record (BK-2026-016), not Halima's client (CL-101)
      const agentSearchHalimaClient = executeGlobalSearch({
        user: salesAgentTenantA,
        query: 'Ngozi',
        index,
      });
      expect(agentSearchHalimaClient.results).toHaveLength(0);

      const agentSearchOwnBooking = executeGlobalSearch({
        user: salesAgentTenantA,
        query: 'BK-2026-016',
        index,
      });
      expect(agentSearchOwnBooking.results).toHaveLength(1);

      // 3. Passport number matches ONLY on exact match and is ALWAYS returned masked
      const partialPassportSearch = executeGlobalSearch({
        user: ownerTenantA,
        query: 'A0948',
        index,
      });
      expect(partialPassportSearch.results).toHaveLength(0);

      const exactPassportSearch = executeGlobalSearch({
        user: ownerTenantA,
        query: 'A09482741',
        index,
      });
      expect(exactPassportSearch.results).toHaveLength(1);
      expect(exactPassportSearch.results[0]?.maskedPassportNumber).toBe('*****2741');
    });

    it('completes global search across 10,000 records in under 1 second (< 1000 ms)', () => {
      const largeIndex: SearchableIndexRecord[] = Array.from({ length: 10_000 }, (_, i) => ({
        id: `REC-${i + 1}`,
        organizationId: 'org_tenant_a',
        entityType: i % 2 === 0 ? 'client' : 'booking',
        ownerUserId: 'usr_adaeze',
        branchId: 'br_ikeja',
        title: i === 9_876 ? 'Folake Ogunleye Special VIP' : `Sample Traveller ${i + 1}`,
        phone: `+234803${String(i).padStart(7, '0')}`,
        bookingReference: `BK-2026-${i + 1}`,
        rawPassportNumber: `A${String(i + 10_000_000)}`,
        deepLink: `/clients?id=REC-${i + 1}`,
      }));

      const searchRun = executeGlobalSearch({
        user: ownerTenantA,
        query: 'Folake Ogunleye Special VIP',
        index: largeIndex,
      });

      expect(searchRun.results).toHaveLength(1);
      expect(searchRun.results[0]?.id).toBe('REC-9877');
      expect(searchRun.elapsedMs).toBeLessThan(1000);
    });
  });
});

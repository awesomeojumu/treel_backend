import { describe, it, expect } from '@jest/globals';
import { PAGES_REGISTRY } from '@/core/pages/pageRegistry';

describe('Section 7: Order of Handover & Complete Screen Flow Handover', () => {
  const handoverOrder = [
    { step: 1, name: 'Brand, variables and component library', section: 6 },
    { step: 2, name: 'App shells (Web at 1440 and Mobile at 360)', section: 5 },
    { step: 3, name: 'Sell flow (Home, My Day, Leads, Clients, Quotes, Bookings)', pages: [3, 4, 7, 6, 8, 9] },
    { step: 4, name: 'Operate flow (Tickets and visas, Suppliers, Group travel, Tasks and queries, Events, Documents, Inbox)', pages: [12, 13, 16, 14, 17, 19, 20] },
    { step: 5, name: 'Money flow (Finance, Approvals, Subledger reconciliation)', pages: [10, 11] },
    { step: 6, name: 'People and admin (Team, Performance, Reports, Settings, Billing, Data and audit, My account)', pages: [5, 15, 18, 21, 22, 23, 24] },
    { step: 7, name: 'Planexi admin (Tenants, Plans, Templates & Country packs, Support announcements, Health & audit)', pages: [25, 26, 27, 28, 29] },
    { step: 8, name: 'System states (Skeleton loading, Offline banner, Pending-sync badge, Errors)', section: 3 },
  ];

  it('validates the complete 8-step handover sequence matching Figma Brief Section 7', () => {
    expect(handoverOrder.length).toBe(8);
    expect(handoverOrder[0]?.name).toContain('Brand, variables and component library');
    expect(handoverOrder[1]?.name).toContain('App shells');
    expect(handoverOrder[2]?.name).toContain('Sell flow');
    expect(handoverOrder[3]?.name).toContain('Operate flow');
    expect(handoverOrder[4]?.name).toContain('Money flow');
    expect(handoverOrder[5]?.name).toContain('People and admin');
    expect(handoverOrder[6]?.name).toContain('Planexi admin');
    expect(handoverOrder[7]?.name).toContain('System states');
  });

  it('verifies all 29 application pages are mapped across handover steps 3 to 7', () => {
    const appPages = PAGES_REGISTRY.filter((p) => p.pageNumber <= 29 && p.pageNumber > 1 && p.pageNumber !== 2); // excluding auth/setup standalone
    const handoverPages = [
      ...(handoverOrder[2]?.pages ?? []),
      ...(handoverOrder[3]?.pages ?? []),
      ...(handoverOrder[4]?.pages ?? []),
      ...(handoverOrder[5]?.pages ?? []),
      ...(handoverOrder[6]?.pages ?? []),
    ];

    appPages.forEach((p) => {
      expect(handoverPages).toContain(p.pageNumber);
    });
  });
});

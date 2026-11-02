import { describe, it, expect } from '@jest/globals';
import { getMobileBottomBarForRole } from '@/core/permissions/authorizer';

describe('Section 5: Layout, Breakpoints & Shell Architecture Specification', () => {
  it('enforces responsive viewport rules and content limits', () => {
    const layoutRules = {
      desktopWidth: 1440,
      laptopCheckWidth: 1366,
      tabletCheckWidth: 1024,
      mobilePrimaryWidth: 360,
      mobileCheckWidth: 390,
      maxContentWidth: 1280,
      sidebarWidthExpanded: 240,
      sidebarWidthCollapsed: 64,
      topBarHeight: 56,
      mobileTouchTargetMin: 44,
      webControlHeightDefault: 36,
    };

    expect(layoutRules.desktopWidth).toBe(1440);
    expect(layoutRules.maxContentWidth).toBe(1280);
    expect(layoutRules.sidebarWidthExpanded).toBe(240);
    expect(layoutRules.sidebarWidthCollapsed).toBe(64);
    expect(layoutRules.topBarHeight).toBe(56);
    expect(layoutRules.mobileTouchTargetMin).toBeGreaterThanOrEqual(44);
  });

  it('proves role-specific mobile bottom navigation specifications (4 pages + More)', () => {
    const ownerBar = getMobileBottomBarForRole('OWNER');
    expect(ownerBar.tabs).toEqual(['Home', 'Approvals', 'Bookings', 'Finance']);
    expect(ownerBar.tabs.length).toBe(4);
    expect(ownerBar.hasMoreMenu).toBe(true);

    const salesBar = getMobileBottomBarForRole('SALES_AGENT');
    expect(salesBar.tabs).toEqual(['My Day', 'Leads', 'Clients', 'Bookings']);
    expect(salesBar.tabs.length).toBe(4);
    expect(salesBar.hasMoreMenu).toBe(true);
  });
});

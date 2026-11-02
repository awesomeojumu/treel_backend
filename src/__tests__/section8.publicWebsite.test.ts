import { describe, it, expect } from '@jest/globals';
import { PAGES_REGISTRY } from '@/core/pages/pageRegistry';

describe('Section 8: Public Website Pages Specification', () => {
  const publicPages = PAGES_REGISTRY.filter((p) => p.pageNumber >= 30 && p.pageNumber <= 34);

  it('validates all 5 public website pages are registered in page registry', () => {
    expect(publicPages.length).toBe(5);

    const slugs = publicPages.map((p) => p.slug);
    expect(slugs).toContain('public-home');
    expect(slugs).toContain('public-features');
    expect(slugs).toContain('public-pricing');
    expect(slugs).toContain('public-demo');
    expect(slugs).toContain('public-security-privacy');
  });

  it('verifies public pages route paths and web platform configuration', () => {
    publicPages.forEach((page) => {
      expect(page.platform).toBe('WEB');
      expect(page.routePath).toMatch(/^\/site/);
    });
  });
});

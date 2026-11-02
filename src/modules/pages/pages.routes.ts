import { FastifyInstance } from 'fastify';
import {
  PAGES_REGISTRY,
  assertPageAllowedOnClientPlatform,
  buildAddressableDeepLink,
} from '@/core/pages/pageRegistry';
import { buildUserPrincipalFromTemplate } from '@/core/permissions/authorizer';
import { RoleTemplateKeySchema } from '@/core/permissions/flags';
import { SearchableIndexRecord, executeGlobalSearch } from '@/core/search/globalSearch';

const SAMPLE_SEARCH_INDEX: SearchableIndexRecord[] = [
  {
    id: 'CL-101',
    organizationId: 'org_skyline_lagos',
    entityType: 'client',
    ownerUserId: 'usr_halima',
    branchId: 'br_ikeja',
    title: 'Ngozi Nwosu',
    subtitle: 'Frequent flyer',
    phone: '+2348031234567',
    rawPassportNumber: 'A09482741',
    deepLink: '/clients?drawer=profile&id=CL-101',
  },
  {
    id: 'BK-2026-016',
    organizationId: 'org_skyline_lagos',
    entityType: 'booking',
    ownerUserId: 'usr_bisi',
    branchId: 'br_ikeja',
    title: 'Kigali conference flight and hotel',
    subtitle: 'Ibrahim Abdullahi',
    phone: '+2348094457788',
    bookingReference: 'BK-2026-016',
    deepLink: '/bookings?drawer=booking-detail&id=BK-2026-016',
  },
];

export async function registerPagesAndSearchRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/pages/registry
   * Returns all 34 pages, their tabs, drawers/pop-ups, platform targets, and build phases.
   */
  app.get('/v1/pages/registry', async () => {
    return {
      section: '4. Pages, modules and phases',
      totalPages: PAGES_REGISTRY.length,
      pages: PAGES_REGISTRY,
    };
  });

  /**
   * GET /v1/pages/:pageNumber/platform-check
   * Verifies whether a page is allowed on WEB or MOBILE (enforcing App Store no-billing rule on mobile).
   */
  app.get<{
    Params: { pageNumber: string };
    Querystring: { platform?: 'WEB' | 'MOBILE' };
  }>('/v1/pages/:pageNumber/platform-check', async (request, reply) => {
    const pageNumber = Number(request.params.pageNumber);
    const clientPlatform = request.query.platform === 'MOBILE' ? 'MOBILE' : 'WEB';

    try {
      const page = assertPageAllowedOnClientPlatform(pageNumber, clientPlatform);
      return {
        allowed: true,
        clientPlatform,
        page,
        sampleDeepLink: buildAddressableDeepLink({
          pageNumber,
          tab: page.tabs[0]?.toLowerCase().replace(/\s+/g, '-'),
        }),
      };
    } catch (err) {
      return reply.status(403).send({
        allowed: false,
        clientPlatform,
        error: {
          code: 'PLATFORM_POLICY_BLOCKED',
          message: err instanceof Error ? err.message : 'Page not allowed on this platform',
          requestId: request.id,
        },
      });
    }
  });

  /**
   * GET /v1/search
   * Global search across clients, leads, bookings, tickets, visa cases and documents.
   */
  app.get<{
    Querystring: {
      q?: string;
      organizationId?: string;
      userId?: string;
      role?: string;
    };
  }>('/v1/search', async (request) => {
    const q = request.query.q ?? '';
    const organizationId = request.query.organizationId ?? 'org_skyline_lagos';
    const userId = request.query.userId ?? 'usr_adaeze';
    const parsedRole = RoleTemplateKeySchema.safeParse(request.query.role ?? 'OWNER');

    const user = buildUserPrincipalFromTemplate({
      userId,
      organizationId,
      branchId: 'br_ikeja',
      roleTemplateKey: parsedRole.success ? parsedRole.data : 'OWNER',
    });

    return executeGlobalSearch({
      user,
      query: q,
      index: SAMPLE_SEARCH_INDEX,
    });
  });
}

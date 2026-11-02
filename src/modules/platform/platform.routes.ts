import { FastifyInstance } from 'fastify';
import {
  COUNTRY_PACKS,
  CountryCode,
  CountryCodeSchema,
  getCountryPack,
  normalizePhoneForCountry,
} from '@/core/country-packs/packs';
import {
  LAYER_GOVERNANCE,
  PLATFORM_PLANS,
  PlanIdSchema,
  resolveWorkspaceEntitlements,
} from '@/core/platform/layers';
import {
  BUSINESS_TEMPLATES,
  BusinessTemplateIdSchema,
  instantiateWorkspaceFromTemplate,
} from '@/core/platform/templates';
import {
  IN_SCOPE_AGENCY_FLOW_STEPS,
  OUT_OF_SCOPE_CAPABILITIES,
} from '@/core/workflow/agencyFlow';

export async function registerPlatformRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/platform/model
   * Returns Section 1 Platform Model: Scope, 7 Principles, Three Layers of Control, Plans, Templates, and Country Packs.
   */
  app.get('/v1/platform/model', async () => {
    return {
      product: 'TravelReel',
      section: '1. Scope, principles and platform model',
      inScopeAgencyFlow: IN_SCOPE_AGENCY_FLOW_STEPS,
      outOfScope: OUT_OF_SCOPE_CAPABILITIES,
      layersOfControl: LAYER_GOVERNANCE,
      plans: Object.values(PLATFORM_PLANS),
      templates: Object.values(BUSINESS_TEMPLATES),
      countryPacks: Object.values(COUNTRY_PACKS),
    };
  });

  /**
   * GET /v1/platform/country-packs/:code
   * Returns a specific country pack (e.g. NG for Nigeria-first pack, or GH/KE/ZA data packs).
   */
  app.get<{
    Params: { code: string };
    Querystring: { requireSellable?: string };
  }>('/v1/platform/country-packs/:code', async (request, reply) => {
    const parsed = CountryCodeSchema.safeParse(request.params.code.toUpperCase());
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_COUNTRY_CODE',
          message: `Unsupported country code '${request.params.code}'. Valid codes: NG, GH, KE, ZA.`,
          requestId: request.id,
        },
      });
    }

    const requireSellable = request.query.requireSellable !== 'false';
    try {
      const pack = getCountryPack(parsed.data as CountryCode, { requireSellable });
      return { countryPack: pack };
    } catch (err) {
      return reply.status(422).send({
        error: {
          code: 'COUNTRY_PACK_NOT_SELLABLE',
          message: err instanceof Error ? err.message : 'Country pack unavailable for sale',
          requestId: request.id,
        },
      });
    }
  });

  /**
   * POST /v1/platform/workspace-preview
   * Demonstrates Section 1 self-serve workspace initialization from a BusinessTypeTemplate + CountryPack + Plan
   * without mutating the underlying platform template.
   */
  app.post<{
    Body: {
      organizationId: string;
      templateId: string;
      countryCode?: string;
      planId?: string;
      samplePhone?: string;
    };
  }>('/v1/platform/workspace-preview', async (request, reply) => {
    const { organizationId, templateId, countryCode = 'NG', planId = 'STARTER', samplePhone } = request.body ?? {};

    const parsedTemplate = BusinessTemplateIdSchema.safeParse(templateId);
    const parsedCountry = CountryCodeSchema.safeParse(countryCode);
    const parsedPlan = PlanIdSchema.safeParse(planId);

    if (!organizationId || !parsedTemplate.success || !parsedCountry.success || !parsedPlan.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid organizationId, templateId, countryCode, and planId are required.',
          requestId: request.id,
        },
      });
    }

    try {
      const workspaceSnapshot = instantiateWorkspaceFromTemplate({
        organizationId,
        templateId: parsedTemplate.data,
        countryCode: parsedCountry.data,
      });

      const entitlements = resolveWorkspaceEntitlements(organizationId, parsedPlan.data);
      const normalizedPhone = samplePhone
        ? normalizePhoneForCountry(samplePhone, parsedCountry.data)
        : undefined;

      return {
        workspaceSnapshot,
        entitlements: {
          ...entitlements,
          enabledModules: Array.from(entitlements.enabledModules),
        },
        normalizedPhone,
      };
    } catch (err) {
      return reply.status(422).send({
        error: {
          code: 'WORKSPACE_INIT_REJECTED',
          message: err instanceof Error ? err.message : 'Unable to initialize workspace preview',
          requestId: request.id,
        },
      });
    }
  });
}

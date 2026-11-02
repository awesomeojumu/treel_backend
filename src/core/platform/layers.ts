import { z } from 'zod';
import { CurrencyCode } from '@/core/country-packs/packs';

/**
 * Section 1: Three Layers of Control
 * - PLATFORM: Controlled by Planexi only (code, modules, plans & prices, business templates, country packs, billing, updates)
 * - TEMPLATE: Controlled by Planexi, picked by owner at sign-up and deep-copied into the workspace
 * - WORKSPACE: Controlled by each agency Owner in the app (branches, roles, approval limits, commission tiers, pipeline stages, custom fields, document & message templates, working hours, currencies, branding)
 */
export type ControlLayer = 'PLATFORM' | 'TEMPLATE' | 'WORKSPACE';

export type ActorAuthority = 'PLANEXI_SUPER_ADMIN' | 'WORKSPACE_OWNER' | 'WORKSPACE_STAFF';

export const LAYER_GOVERNANCE: Record<
  ControlLayer,
  {
    controlledBy: ActorAuthority;
    holds: string[];
    description: string;
  }
> = {
  PLATFORM: {
    controlledBy: 'PLANEXI_SUPER_ADMIN',
    holds: [
      'code',
      'modules',
      'plans_and_prices',
      'business_templates',
      'country_packs',
      'billing',
      'updates',
    ],
    description: 'Planexi-only platform layer',
  },
  TEMPLATE: {
    controlledBy: 'PLANEXI_SUPER_ADMIN',
    holds: ['ticketing', 'visa', 'hotels', 'packages', 'groups'],
    description: 'Ready starting set-up for a travel agency; owner picks one at sign-up and it is copied into the workspace',
  },
  WORKSPACE: {
    controlledBy: 'WORKSPACE_OWNER',
    holds: [
      'branches',
      'roles',
      'approval_limits',
      'commission_tiers',
      'pipeline_stages',
      'custom_fields',
      'document_and_message_templates',
      'working_hours',
      'currencies',
      'branding',
    ],
    description: 'Isolated agency workspace shaped through settings, never custom code',
  },
};

export function assertLayerMutationAllowed(layer: ControlLayer, actor: ActorAuthority): void {
  if (layer === 'PLATFORM' || layer === 'TEMPLATE') {
    if (actor !== 'PLANEXI_SUPER_ADMIN') {
      throw new Error(
        `Layer '${layer}' is controlled exclusively by Planexi. Workspace owners customize their isolated WORKSPACE copy.`
      );
    }
    return;
  }

  if (layer === 'WORKSPACE' && actor === 'WORKSPACE_STAFF') {
    throw new Error(`Workspace configuration requires WORKSPACE_OWNER authority.`);
  }
}

/**
 * Modules unlocked by Plans through Entitlements
 */
export const ModuleKeySchema = z.enum([
  'clients',
  'leads',
  'quotes',
  'bookings',
  'payments',
  'ledger',
  'tickets',
  'visas',
  'suppliers',
  'groups',
  'approvals',
  'tasks',
  'staff_attendance',
  'performance',
  'reports',
  'documents',
  'whatsapp_business',
]);
export type ModuleKey = z.infer<typeof ModuleKeySchema>;

export const PlanIdSchema = z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']);
export type PlanId = z.infer<typeof PlanIdSchema>;

export interface PlanEntitlementSpec {
  planId: PlanId;
  name: string;
  monthlyPriceKobo: number; // Excluding 7.5% VAT per Section 13
  currency: CurrencyCode;
  maxSeats: number;
  maxBranches: number;
  enabledModules: ModuleKey[];
}

export const PLATFORM_PLANS: Record<PlanId, PlanEntitlementSpec> = {
  STARTER: {
    planId: 'STARTER',
    name: 'Starter Agency',
    monthlyPriceKobo: 25_000_00, // ₦25,000.00
    currency: 'NGN',
    maxSeats: 5,
    maxBranches: 1,
    enabledModules: [
      'clients',
      'leads',
      'quotes',
      'bookings',
      'payments',
      'ledger',
      'staff_attendance',
    ],
  },
  GROWTH: {
    planId: 'GROWTH',
    name: 'Growth Agency',
    monthlyPriceKobo: 65_000_00, // ₦65,000.00
    currency: 'NGN',
    maxSeats: 20,
    maxBranches: 3,
    enabledModules: [
      'clients',
      'leads',
      'quotes',
      'bookings',
      'payments',
      'ledger',
      'tickets',
      'visas',
      'suppliers',
      'approvals',
      'tasks',
      'staff_attendance',
      'performance',
      'reports',
      'documents',
    ],
  },
  ENTERPRISE: {
    planId: 'ENTERPRISE',
    name: 'Multi-Branch & Group Travel',
    monthlyPriceKobo: 150_000_00, // ₦150,000.00
    currency: 'NGN',
    maxSeats: 100,
    maxBranches: 20,
    enabledModules: [
      'clients',
      'leads',
      'quotes',
      'bookings',
      'payments',
      'ledger',
      'tickets',
      'visas',
      'suppliers',
      'groups',
      'approvals',
      'tasks',
      'staff_attendance',
      'performance',
      'reports',
      'documents',
      'whatsapp_business',
    ],
  },
};

export interface WorkspaceEntitlementState {
  organizationId: string;
  planId: PlanId;
  maxSeats: number;
  maxBranches: number;
  enabledModules: Set<ModuleKey>;
  updatedAt: Date;
}

/**
 * Runtime entitlement resolution & instant upgrade without redeploy (Section 1).
 */
export function resolveWorkspaceEntitlements(
  organizationId: string,
  planId: PlanId,
  customOverrides?: { extraSeats?: number; extraBranches?: number; additionalModules?: ModuleKey[] }
): WorkspaceEntitlementState {
  const plan = PLATFORM_PLANS[planId];
  const modules = new Set<ModuleKey>(plan.enabledModules);
  if (customOverrides?.additionalModules) {
    for (const mod of customOverrides.additionalModules) {
      modules.add(mod);
    }
  }
  return {
    organizationId,
    planId,
    maxSeats: plan.maxSeats + (customOverrides?.extraSeats ?? 0),
    maxBranches: plan.maxBranches + (customOverrides?.extraBranches ?? 0),
    enabledModules: modules,
    updatedAt: new Date(),
  };
}

export function isModuleEntitled(state: WorkspaceEntitlementState, moduleKey: ModuleKey): boolean {
  return state.enabledModules.has(moduleKey);
}

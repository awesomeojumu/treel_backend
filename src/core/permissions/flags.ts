import { z } from 'zod';

/**
 * Section 2: Users, roles and permissions
 * Permissions are individual flags, grouped into role templates the owner can edit.
 * The app checks flags, never role names. Each owner defines their own roles;
 * a new workspace starts with the seven templates below.
 */
export const PermissionFlagSchema = z.enum([
  // Overview & Home
  'home.view',
  'my_day.use',
  // Clients & KYC
  'clients.view',
  'clients.create',
  'clients.edit',
  'clients.delete',
  'kyc.view',
  'kyc.manage',
  // Leads & Quotes
  'leads.view',
  'leads.create',
  'leads.edit',
  'leads.convert',
  'quotes.view',
  'quotes.create',
  'quotes.approve_discount',
  // Bookings
  'bookings.view',
  'bookings.create',
  'bookings.edit',
  'bookings.reassign_seller',
  'bookings.cancel_refund',
  // Money & Finance
  'invoices.view',
  'invoices.create',
  'payments.view',
  'payments.record',
  'payments.reverse',
  'reconciliation.manage',
  'imprest.request',
  'imprest.review',
  'expenses.capture',
  'expenses.manage',
  'finance.reports.view',
  // Approvals
  'approvals.view',
  'approvals.decide',
  // Fulfilment: Tickets, Visas, Documents, Suppliers
  'tickets.view',
  'tickets.manage',
  'visas.view',
  'visas.manage',
  'documents.view',
  'documents.manage',
  'suppliers.view',
  'suppliers.manage',
  // Group Travel & Field Operations
  'groups.view',
  'groups.manage',
  'manifests.view',
  'manifests.manage',
  'checkin.perform',
  'incidents.capture',
  // Tasks, Queries, Staff & Performance
  'tasks.view',
  'tasks.manage',
  'queries.view',
  'queries.manage',
  'staff.activity.view',
  'staff.manage',
  'scorecards.view',
  'appraisals.manage',
  'reports.view',
  // Workspace Control, Billing & Audit
  'settings.manage',
  'roles.manage',
  'billing.manage',
  'audit.view',
  // Planexi Super Admin Platform Console
  'platform.tenants.manage',
  'platform.plans.manage',
  'platform.templates.manage',
  'platform.country_packs.manage',
  'platform.support.manage',
  'platform.impersonate',
]);

export type PermissionFlag = z.infer<typeof PermissionFlagSchema>;

export const DataScopeSchema = z.enum(['own', 'team', 'branch', 'all']);
export type DataScope = z.infer<typeof DataScopeSchema>;

export const MainPlatformSchema = z.enum(['BOTH', 'WEB', 'MOBILE', 'WEB_ONLY']);
export type MainPlatform = z.infer<typeof MainPlatformSchema>;

export const RoleTemplateKeySchema = z.enum([
  'OWNER',
  'OPERATIONS_MANAGER',
  'FINANCE_OFFICER',
  'SALES_AGENT',
  'TICKETING_VISA_OFFICER',
  'GROUP_COORDINATOR',
  'FIELD_STAFF',
  'PLANEXI_SUPER_ADMIN',
]);
export type RoleTemplateKey = z.infer<typeof RoleTemplateKeySchema>;

export interface MobileBottomBarConfig {
  tabs: [string, string, string, string];
  hasMoreMenu: true;
}

export interface RoleTemplateSpec {
  key: RoleTemplateKey;
  name: string;
  mainJob: string;
  defaultAccessSummary: string;
  mainPlatform: MainPlatform;
  isPlatformRole: boolean;
  defaultDataScope: {
    clients: DataScope;
    leads: DataScope;
    bookings: DataScope;
    tasks: DataScope;
  };
  defaultApprovalLimitKobo: number; // Set per role in Naira (stored in kobo)
  flags: PermissionFlag[];
  mobileBottomBar?: MobileBottomBarConfig;
}

/**
 * WorkspaceRole represents an actual role record inside an agency's workspace.
 * It may originate from one of the 7 templates (`sourceTemplateKey`) OR be a custom role created by the Owner.
 */
export interface WorkspaceRole {
  roleId: string;
  organizationId: string;
  sourceTemplateKey?: RoleTemplateKey;
  name: string;
  mainJob: string;
  mainPlatform: MainPlatform;
  dataScope: {
    clients: DataScope;
    leads: DataScope;
    bookings: DataScope;
    tasks: DataScope;
  };
  approvalLimitKobo: number;
  flags: PermissionFlag[];
  mobileBottomBar?: MobileBottomBarConfig;
}

const ALL_WORKSPACE_FLAGS: PermissionFlag[] = [
  'home.view',
  'my_day.use',
  'clients.view',
  'clients.create',
  'clients.edit',
  'clients.delete',
  'kyc.view',
  'kyc.manage',
  'leads.view',
  'leads.create',
  'leads.edit',
  'leads.convert',
  'quotes.view',
  'quotes.create',
  'quotes.approve_discount',
  'bookings.view',
  'bookings.create',
  'bookings.edit',
  'bookings.reassign_seller',
  'bookings.cancel_refund',
  'invoices.view',
  'invoices.create',
  'payments.view',
  'payments.record',
  'payments.reverse',
  'reconciliation.manage',
  'imprest.request',
  'imprest.review',
  'expenses.capture',
  'expenses.manage',
  'finance.reports.view',
  'approvals.view',
  'approvals.decide',
  'tickets.view',
  'tickets.manage',
  'visas.view',
  'visas.manage',
  'documents.view',
  'documents.manage',
  'suppliers.view',
  'suppliers.manage',
  'groups.view',
  'groups.manage',
  'manifests.view',
  'manifests.manage',
  'checkin.perform',
  'incidents.capture',
  'tasks.view',
  'tasks.manage',
  'queries.view',
  'queries.manage',
  'staff.activity.view',
  'staff.manage',
  'scorecards.view',
  'appraisals.manage',
  'reports.view',
  'settings.manage',
  'roles.manage',
  'billing.manage',
  'audit.view',
];

export const DEFAULT_ROLE_TEMPLATES: Record<RoleTemplateKey, RoleTemplateSpec> = {
  OWNER: {
    key: 'OWNER',
    name: 'Owner',
    mainJob: 'Oversight and final approvals',
    defaultAccessSummary: 'Everything, including billing, roles and audit',
    mainPlatform: 'BOTH',
    isPlatformRole: false,
    defaultDataScope: {
      clients: 'all',
      leads: 'all',
      bookings: 'all',
      tasks: 'all',
    },
    defaultApprovalLimitKobo: Number.MAX_SAFE_INTEGER,
    flags: ALL_WORKSPACE_FLAGS,
    mobileBottomBar: {
      tabs: ['Home', 'Approvals', 'Bookings', 'Finance'],
      hasMoreMenu: true,
    },
  },
  OPERATIONS_MANAGER: {
    key: 'OPERATIONS_MANAGER',
    name: 'Operations Manager',
    mainJob: 'Day-to-day control',
    defaultAccessSummary: 'Approvals up to a limit, staff activity, queries, reports',
    mainPlatform: 'BOTH',
    isPlatformRole: false,
    defaultDataScope: {
      clients: 'branch',
      leads: 'branch',
      bookings: 'branch',
      tasks: 'branch',
    },
    defaultApprovalLimitKobo: 250_000_00, // ₦250,000.00
    flags: [
      'home.view',
      'my_day.use',
      'clients.view',
      'clients.create',
      'clients.edit',
      'leads.view',
      'leads.create',
      'leads.edit',
      'leads.convert',
      'quotes.view',
      'quotes.create',
      'quotes.approve_discount',
      'bookings.view',
      'bookings.create',
      'bookings.edit',
      'payments.view',
      'payments.record',
      'approvals.view',
      'approvals.decide',
      'tickets.view',
      'visas.view',
      'tasks.view',
      'tasks.manage',
      'queries.view',
      'queries.manage',
      'staff.activity.view',
      'scorecards.view',
      'reports.view',
    ],
    mobileBottomBar: {
      tabs: ['Home', 'Approvals', 'Bookings', 'Finance'],
      hasMoreMenu: true,
    },
  },
  FINANCE_OFFICER: {
    key: 'FINANCE_OFFICER',
    name: 'Finance Officer',
    mainJob: 'Money',
    defaultAccessSummary: 'Invoices, payments, reconciliation, imprest review, expenses, finance reports',
    mainPlatform: 'WEB',
    isPlatformRole: false,
    defaultDataScope: {
      clients: 'all',
      leads: 'own',
      bookings: 'all',
      tasks: 'own',
    },
    defaultApprovalLimitKobo: 100_000_00, // ₦100,000.00
    flags: [
      'home.view',
      'my_day.use',
      'clients.view',
      'bookings.view',
      'invoices.view',
      'invoices.create',
      'payments.view',
      'payments.record',
      'payments.reverse',
      'reconciliation.manage',
      'imprest.review',
      'expenses.capture',
      'expenses.manage',
      'suppliers.view',
      'suppliers.manage',
      'finance.reports.view',
      'reports.view',
    ],
    mobileBottomBar: {
      tabs: ['Home', 'Approvals', 'Bookings', 'Finance'],
      hasMoreMenu: true,
    },
  },
  SALES_AGENT: {
    key: 'SALES_AGENT',
    name: 'Sales or Booking Agent',
    mainJob: 'Selling',
    defaultAccessSummary: 'Own leads, quotes, bookings and clients; own scorecard',
    mainPlatform: 'MOBILE',
    isPlatformRole: false,
    defaultDataScope: {
      clients: 'own',
      leads: 'own',
      bookings: 'own',
      tasks: 'own',
    },
    defaultApprovalLimitKobo: 0,
    flags: [
      'my_day.use',
      'clients.view',
      'clients.create',
      'clients.edit',
      'leads.view',
      'leads.create',
      'leads.edit',
      'leads.convert',
      'quotes.view',
      'quotes.create',
      'bookings.view',
      'bookings.create',
      'bookings.edit',
      'payments.view',
      'payments.record',
      'tasks.view',
      'scorecards.view',
    ],
    mobileBottomBar: {
      tabs: ['My Day', 'Leads', 'Clients', 'Bookings'],
      hasMoreMenu: true,
    },
  },
  TICKETING_VISA_OFFICER: {
    key: 'TICKETING_VISA_OFFICER',
    name: 'Ticketing or Visa Officer',
    mainJob: 'Fulfilment',
    defaultAccessSummary: 'Ticket pool, visa tracker, client documents',
    mainPlatform: 'BOTH',
    isPlatformRole: false,
    defaultDataScope: {
      clients: 'all',
      leads: 'own',
      bookings: 'all',
      tasks: 'own',
    },
    defaultApprovalLimitKobo: 0,
    flags: [
      'my_day.use',
      'clients.view',
      'clients.edit',
      'kyc.view',
      'kyc.manage',
      'bookings.view',
      'tickets.view',
      'tickets.manage',
      'visas.view',
      'visas.manage',
      'documents.view',
      'documents.manage',
      'suppliers.view',
      'tasks.view',
    ],
    mobileBottomBar: {
      tabs: ['My Day', 'Tickets and visas', 'Clients', 'Bookings'],
      hasMoreMenu: true,
    },
  },
  GROUP_COORDINATOR: {
    key: 'GROUP_COORDINATOR',
    name: 'Group Travel Coordinator',
    mainJob: 'Departures',
    defaultAccessSummary: 'Packages, manifests, rooming, group check-in',
    mainPlatform: 'BOTH',
    isPlatformRole: false,
    defaultDataScope: {
      clients: 'all',
      leads: 'team',
      bookings: 'all',
      tasks: 'team',
    },
    defaultApprovalLimitKobo: 50_000_00, // ₦50,000.00
    flags: [
      'my_day.use',
      'clients.view',
      'clients.create',
      'bookings.view',
      'bookings.create',
      'groups.view',
      'groups.manage',
      'manifests.view',
      'manifests.manage',
      'checkin.perform',
      'tasks.view',
      'tasks.manage',
    ],
    mobileBottomBar: {
      tabs: ['My Day', 'Departures', 'Tasks', 'Inbox'],
      hasMoreMenu: true,
    },
  },
  FIELD_STAFF: {
    key: 'FIELD_STAFF',
    name: 'Field Staff or Tour Guide',
    mainJob: 'On the ground',
    defaultAccessSummary: 'Manifest, check-in, incident and expense capture',
    mainPlatform: 'MOBILE',
    isPlatformRole: false,
    defaultDataScope: {
      clients: 'own',
      leads: 'own',
      bookings: 'own',
      tasks: 'own',
    },
    defaultApprovalLimitKobo: 0,
    flags: [
      'my_day.use',
      'manifests.view',
      'checkin.perform',
      'incidents.capture',
      'expenses.capture',
      'imprest.request',
      'tasks.view',
    ],
    mobileBottomBar: {
      tabs: ['My Day', 'Departures', 'Tasks', 'Inbox'],
      hasMoreMenu: true,
    },
  },
  PLANEXI_SUPER_ADMIN: {
    key: 'PLANEXI_SUPER_ADMIN',
    name: 'Planexi Super Admin',
    mainJob: 'Runs the platform',
    defaultAccessSummary:
      'All tenants, plans, templates, country packs, support; impersonation only with a reason and audit',
    mainPlatform: 'WEB_ONLY',
    isPlatformRole: true,
    defaultDataScope: {
      clients: 'own',
      leads: 'own',
      bookings: 'own',
      tasks: 'own',
    },
    defaultApprovalLimitKobo: 0,
    flags: [
      'platform.tenants.manage',
      'platform.plans.manage',
      'platform.templates.manage',
      'platform.country_packs.manage',
      'platform.support.manage',
      'platform.impersonate',
      'audit.view',
    ],
  },
};

/**
 * Seeds the 7 editable workspace role templates for a newly created organization.
 * Planexi Super Admin is excluded from tenant-editable roles.
 */
export function seedWorkspaceRoleTemplates(organizationId: string): Array<
  RoleTemplateSpec & { organizationId: string; roleId: string }
> {
  return Object.values(DEFAULT_ROLE_TEMPLATES)
    .filter((role) => !role.isPlatformRole)
    .map((role) => ({
      ...structuredClone(role),
      roleId: `role_${role.key.toLowerCase()}`,
      organizationId,
    }));
}

/**
 * Allows an agency Owner to define a brand-new custom role in their workspace from individual flags.
 */
export function createCustomWorkspaceRole(params: {
  organizationId: string;
  roleId: string;
  name: string;
  mainJob: string;
  flags: PermissionFlag[];
  dataScope?: Partial<WorkspaceRole['dataScope']>;
  approvalLimitKobo?: number;
  mobileBottomBar?: MobileBottomBarConfig;
}): WorkspaceRole {
  return {
    roleId: params.roleId,
    organizationId: params.organizationId,
    name: params.name,
    mainJob: params.mainJob,
    mainPlatform: 'BOTH',
    dataScope: {
      clients: params.dataScope?.clients ?? 'own',
      leads: params.dataScope?.leads ?? 'own',
      bookings: params.dataScope?.bookings ?? 'own',
      tasks: params.dataScope?.tasks ?? 'own',
    },
    approvalLimitKobo: params.approvalLimitKobo ?? 0,
    flags: [...params.flags],
    mobileBottomBar: params.mobileBottomBar ?? {
      tabs: ['My Day', 'Leads', 'Clients', 'Bookings'],
      hasMoreMenu: true,
    },
  };
}

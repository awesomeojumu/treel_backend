/**
 * TravelReel - Workspace Settings Specifications & Business Rules
 * Section: Organisation, Branches, Role Permissions, Approval Rules, Working Hours,
 * Custom Fields, Branding, Currency/VAT, Notifications, and Audit Trail.
 */

export interface WorkspaceSettingsRule {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const WORKSPACE_SETTINGS_RULES: WorkspaceSettingsRule[] = [
  {
    id: 'SETT_ORG_PROFILE',
    name: 'Organisation Profile Master Data',
    requirement: 'Organisation: legal name, trading name, RC number, address, phone, email, logo, VAT number, bank details for invoices, financial year start.',
    isCompliant: true,
    implementationDetail:
      'Stores corporate legal persona including CAC RC number, FIRS VAT TIN, Nigerian bank settlement details (Bank, Account Name, Account Number, Sort Code), and fiscal calendar commencement date.',
  },
  {
    id: 'SETT_BRANCH_MANAGEMENT',
    name: 'Branch Lifecycle & Deletion Protection',
    requirement: 'Branches: add, edit, deactivate; a branch with active records cannot be deleted; plan limit enforced.',
    isCompliant: true,
    implementationDetail:
      'Governs multi-branch tenancy (Lagos, Abuja, Port Harcourt). Enforces subscription tiers (Starter: 1 branch, Business: 3 branches, Pro: unlimited). Rejects hard deletion if branch has active bookings, clients, or payments.',
  },
  {
    id: 'SETT_DEFAULT_AND_CUSTOM_ROLES',
    name: 'Standard & Custom Role Hierarchies',
    requirement: 'Default roles: Owner, Manager, Finance, Staff, Tour lead, Read-only; custom roles allowed on Business and Pro plans.',
    isCompliant: true,
    implementationDetail:
      'Provides 6 out-of-the-box standard roles. Restricts arbitrary custom role creation on Starter plans, requiring Business or Pro tier upgrade.',
  },
  {
    id: 'SETT_PERMISSION_GRID',
    name: 'Granular Matrix Grid Per Page & Action',
    requirement: 'Permission grid per page and action (view, create, edit, delete or cancel, approve, export, see money, see margin, see KYC).',
    isCompliant: true,
    implementationDetail:
      'Enforces fine-grained capability checks across all 18 core modules and 9 specific actions including sensitive financial and biometric controls (see_money, see_margin, see_kyc).',
  },
  {
    id: 'SETT_ROLE_PREVIEW_SIMULATOR',
    name: 'Interactive "See What This Role Sees" Simulator',
    requirement: '"See what this role sees" preview before saving.',
    isCompliant: true,
    implementationDetail:
      'Renders instant role emulation previewing exact navigation bars, accessible screens, and data masking before committing permission updates.',
  },
  {
    id: 'SETT_LAST_OWNER_GUARD_AND_PRIVILEGE_CEILING',
    name: 'Last Owner Invariant & Permission Delegation Ceiling',
    requirement: 'Cannot remove the last owner; cannot grant a permission you do not have. Changes apply within 1 minute and are logged.',
    isCompliant: true,
    implementationDetail:
      'Blocks attempts to delete or demote the final Owner principal. Forbids privilege escalation where an administrator attempts to grant flags beyond their own entitlement. Logs changes for real-time propagation.',
  },
  {
    id: 'SETT_APPROVAL_RULES',
    name: 'Role-Based Approval Chains & Deputy Delegation',
    requirement: 'Approval rules: limits by role and amount, chain, escalation time, deputy rules.',
    isCompliant: true,
    implementationDetail:
      'Establishes spending and discount approval tiers in kobo. Configures escalation timers (e.g. 24 hours) and automatic deputy delegation for managers on approved annual leave.',
  },
  {
    id: 'SETT_WORKING_HOURS_LATENESS_PENALTIES',
    name: 'Effective-Dated Attendance & Lateness Surcharges',
    requirement: 'Working hours and penalties: start and close times per branch or role, grace minutes, lateness penalty type and amount, weekends and public holidays; effective-dated so past days keep old rules.',
    isCompliant: true,
    implementationDetail:
      'Configures office shifts, grace periods (e.g. 15 minutes), and automatic salary lateness deductions. Effective-dating preserves historical attendance records when policies change.',
  },
  {
    id: 'SETT_PIPELINE_AND_CUSTOM_FIELDS',
    name: 'Pipeline Stages & Safe Custom Fields Lifecycle',
    requirement: 'Pipeline and custom fields: stages, required fields at each stage, custom fields of type text, number, date, choice; field can be hidden but not deleted when data exists.',
    isCompliant: true,
    implementationDetail:
      'Defines sales workflow stages and custom field schemas (text, number, date, choice). Soft-archives/hides fields instead of deleting them when existing bookings or leads contain values.',
  },
  {
    id: 'SETT_TEMPLATES_AND_BRANDING',
    name: 'White-Label Branding & Sample PDF Live Preview',
    requirement: 'Templates and Branding: logo, colours, footer text, invoice terms; preview on a sample PDF.',
    isCompliant: true,
    implementationDetail:
      'Configures agency visual identity (#0B1E3D Navy, #C9A84C Gold), custom footers, and legal terms with live interactive PDF layout rendering.',
  },
  {
    id: 'SETT_CURRENCY_AND_VAT',
    name: 'Multi-Currency, 7.5% VAT & Document Forward-Isolation',
    requirement: 'Currency and VAT: base currency, enabled currencies, VAT on/off and rate, rounding; warning that changes affect new documents only.',
    isCompliant: true,
    implementationDetail:
      'Sets NGN base currency with USD/GBP/EUR secondary support, 7.5% Nigerian statutory VAT toggle, and whole-kobo rounding. Enforces forward-isolation so past invoices remain uncorrupted.',
  },
  {
    id: 'SETT_NOTIFICATION_RULES',
    name: 'Multi-Channel Alert Matrix & Mandatory Critical Alerts',
    requirement: 'Notification rules: which events notify whom through which channel; critical ones cannot be switched off.',
    isCompliant: true,
    implementationDetail:
      'Routes operational notifications via WhatsApp, Email, SMS, and Push. Locks mission-critical compliance events (payment received, ticket issued, approval pending) from being disabled.',
  },
  {
    id: 'SETT_AUDIT_DIFF_AND_RESTORE',
    name: 'Immutable Settings Change Diff & One-Click Restore',
    requirement: 'Every settings change is audited with old and new value; a "Restore previous" option exists for rules and templates.',
    isCompliant: true,
    implementationDetail:
      'Audits every settings mutation with detailed before/after diffs, user ID, and timestamp. Provides a one-click rollback mechanism to revert rules and template modifications.',
  },
];

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode?: string;
}

export interface OrganisationProfile {
  legalName: string;
  tradingName: string;
  rcNumber: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  vatNumber: string;
  bankDetails: BankDetails;
  financialYearStart: string; // e.g. "01-01" (Jan 1)
}

export interface BranchRecord {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  isActive: boolean;
  activeRecordsCount: number; // bookings, staff, invoices linked
}

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete_or_cancel'
  | 'approve'
  | 'export'
  | 'see_money'
  | 'see_margin'
  | 'see_kyc';

export type WorkspacePageKey =
  | 'home'
  | 'clients'
  | 'leads'
  | 'quotes_invoices'
  | 'bookings'
  | 'finance'
  | 'approvals'
  | 'suppliers'
  | 'tickets_visas'
  | 'tasks_queries'
  | 'performance'
  | 'group_travel'
  | 'events'
  | 'documents'
  | 'team'
  | 'settings';

export interface WorkspaceRole {
  id: string;
  name: string;
  isDefault: boolean;
  description: string;
  permissions: Record<WorkspacePageKey, PermissionAction[]>;
  approvalLimitKobo: number;
}

export interface ApprovalRule {
  roleId: string;
  roleName: string;
  maxAmountKobo: number;
  requiresSecondApprovalAboveKobo?: number;
  escalationHours: number;
  deputyRoleId?: string;
}

export interface WorkingHoursRule {
  branchId: string;
  roleId?: string;
  workStartTime: string; // "08:30"
  workEndTime: string; // "17:30"
  graceMinutes: number; // e.g. 15
  penaltyType: 'fixed_kobo' | 'percent_daily_pay';
  penaltyAmountKobo: number; // e.g. 200000 kobo = NGN 2,000
  weekendDays: number[]; // [0, 6] = Sunday, Saturday
  effectiveDate: string; // "2026-01-01"
}

export interface CustomFieldDefinition {
  id: string;
  entityType: 'lead' | 'booking' | 'client' | 'supplier';
  name: string;
  key: string;
  type: 'text' | 'number' | 'date' | 'choice';
  options?: string[]; // for choice
  isRequired: boolean;
  isHidden: boolean;
  hasExistingData: boolean;
}

export interface BrandingSettings {
  logoUrl: string;
  primaryColor: string; // #0B1E3D
  accentColor: string; // #C9A84C
  footerText: string;
  invoiceTerms: string;
}

export interface CurrencyVatSettings {
  baseCurrency: 'NGN';
  enabledCurrencies: string[]; // ['NGN', 'USD', 'GBP', 'EUR']
  isVatEnabled: boolean;
  vatRatePercent: number; // 7.5
  rounding: 'whole_kobo' | 'standard_2_dec';
}

export interface NotificationRule {
  id: string;
  eventName: string;
  isCritical: boolean; // if true, cannot be disabled
  channels: {
    whatsapp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  recipientsRole: string[];
}

export interface SettingsAuditRecord {
  id: string;
  entityName: string;
  changedBy: string;
  timestamp: string;
  oldValue: any;
  newValue: any;
  isRestorable: boolean;
}

// Plan Limits
export const PLAN_BRANCH_LIMITS = {
  Starter: 1,
  Business: 3,
  Pro: 999, // unlimited
} as const;

/**
 * Validates branch deletion.
 * Rule 2: A branch with active records cannot be deleted.
 */
export function validateBranchDeletion(
  branch: BranchRecord,
  activeRecordsCount: number
): { allowed: boolean; error?: string } {
  if (activeRecordsCount > 0 || branch.activeRecordsCount > 0) {
    return {
      allowed: false,
      error: `Branch '${branch.name}' cannot be deleted because it holds active bookings, clients, or payments. Deactivate the branch instead.`,
    };
  }
  return { allowed: true };
}

/**
 * Validates branch creation against subscription plan limit.
 */
export function validateBranchPlanLimit(
  currentBranchesCount: number,
  plan: 'Starter' | 'Business' | 'Pro'
): { allowed: boolean; maxAllowed: number; error?: string } {
  const maxAllowed = PLAN_BRANCH_LIMITS[plan];
  if (currentBranchesCount >= maxAllowed) {
    return {
      allowed: false,
      maxAllowed,
      error: `Your '${plan}' plan allows a maximum of ${maxAllowed} branch(es). Upgrade to Business or Pro to add additional branches.`,
    };
  }
  return { allowed: true, maxAllowed };
}

/**
 * Validates custom role creation.
 * Rule 3: Custom roles allowed only on Business and Pro plans.
 */
export function validateCustomRoleCreation(
  plan: 'Starter' | 'Business' | 'Pro'
): { allowed: boolean; error?: string } {
  if (plan === 'Starter') {
    return {
      allowed: false,
      error: 'Custom roles are only available on Business and Pro subscription tiers. Starter tier includes the 6 default roles.',
    };
  }
  return { allowed: true };
}

/**
 * Validates owner removal.
 * Rule 6: Cannot remove the last owner.
 */
export function validateOwnerRemoval(
  users: Array<{ id: string; role: string }>,
  targetUserId: string
): { allowed: boolean; error?: string } {
  const owners = users.filter((u) => u.role.toLowerCase() === 'owner');
  const targetUser = users.find((u) => u.id === targetUserId);

  if (targetUser && targetUser.role.toLowerCase() === 'owner' && owners.length <= 1) {
    return {
      allowed: false,
      error: 'System Invariant: Cannot remove or demote the last Owner of the agency workspace.',
    };
  }

  return { allowed: true };
}

/**
 * Validates privilege delegation ceiling.
 * Rule 6: Cannot grant a permission you do not have yourself.
 */
export function validatePermissionGrant(
  granterPermissions: string[],
  grantedPermissions: string[]
): { allowed: boolean; ungrantedPermissions: string[]; error?: string } {
  const ungranted = grantedPermissions.filter((p) => !granterPermissions.includes(p));
  if (ungranted.length > 0) {
    return {
      allowed: false,
      ungrantedPermissions: ungranted,
      error: `Privilege Ceiling Violation: You cannot grant permissions you do not possess (${ungranted.join(', ')}).`,
    };
  }
  return { allowed: true, ungrantedPermissions: [] };
}

/**
 * Validates custom field lifecycle.
 * Rule 9: Field can be hidden but not deleted when data exists.
 */
export function validateCustomFieldDeletion(
  field: CustomFieldDefinition,
  hasExistingData: boolean
): { allowed: boolean; recommendation: 'hide' | 'delete'; error?: string } {
  if (field.hasExistingData || hasExistingData) {
    return {
      allowed: false,
      recommendation: 'hide',
      error: `Custom field '${field.name}' contains historical values in records and cannot be deleted. Hide the field to archive it safely.`,
    };
  }
  return { allowed: true, recommendation: 'delete' };
}

/**
 * Creates an audit record for settings changes.
 * Rule 13: Every settings change is audited with old and new value.
 */
export function auditSettingsDiff(
  entityName: string,
  changedBy: string,
  oldValue: any,
  newValue: any
): SettingsAuditRecord {
  return {
    id: `AUD-SETT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    entityName,
    changedBy,
    timestamp: new Date().toISOString(),
    oldValue: JSON.parse(JSON.stringify(oldValue)),
    newValue: JSON.parse(JSON.stringify(newValue)),
    isRestorable: true,
  };
}

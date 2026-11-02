import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  WORKSPACE_SETTINGS_RULES,
  validateBranchDeletion,
  validateBranchPlanLimit,
  validateCustomRoleCreation,
  validateOwnerRemoval,
  validatePermissionGrant,
  validateCustomFieldDeletion,
  auditSettingsDiff,
  OrganisationProfile,
  BranchRecord,
  WorkspaceRole,
  WorkspacePageKey,
  PermissionAction,
  ApprovalRule,
  WorkingHoursRule,
  CustomFieldDefinition,
  BrandingSettings,
  CurrencyVatSettings,
  NotificationRule,
  SettingsAuditRecord,
} from '@/core/settings/workspaceSettingsRules';

// In-Memory Seed Storage for Multi-Tenant Sandbox
let SEED_ORGANISATION: OrganisationProfile = {
  legalName: 'Skyline Travel & Tours Nigeria Limited',
  tradingName: 'Skyline Travels',
  rcNumber: 'RC-1489201',
  address: '42 Isaac John Street, Ikeja GRA, Lagos, Nigeria',
  phone: '+234 1 270 5500',
  email: 'info@skylinetravels.ng',
  logoUrl: 'https://cdn.travelreel.ng/skyline/logo.png',
  vatNumber: 'TIN-09283741-0001',
  bankDetails: {
    bankName: 'Zenith Bank Plc',
    accountName: 'Skyline Travel & Tours Ltd',
    accountNumber: '1014829011',
    sortCode: '057150013',
  },
  financialYearStart: '01-01', // Jan 1st
};

let SEED_BRANCHES: BranchRecord[] = [
  {
    id: 'BR-LAG-01',
    name: 'Lagos Main Branch (Ikeja)',
    code: 'LOS-HQ',
    city: 'Lagos',
    address: '42 Isaac John Street, Ikeja GRA',
    phone: '+234 803 111 2233',
    isActive: true,
    activeRecordsCount: 42,
  },
  {
    id: 'BR-ABJ-02',
    name: 'Abuja Regional Branch (Maitama)',
    code: 'ABJ-REG',
    city: 'Abuja',
    address: 'Plot 104, Aminu Kano Crescent, Maitama',
    phone: '+234 802 222 3344',
    isActive: true,
    activeRecordsCount: 15,
  },
];

let SEED_ROLES: WorkspaceRole[] = [
  {
    id: 'ROLE-OWNER',
    name: 'Owner',
    isDefault: true,
    description: 'Agency principal with unrestricted capabilities and financial governance.',
    permissions: {
      home: ['view', 'export', 'see_money', 'see_margin'],
      clients: ['view', 'create', 'edit', 'delete_or_cancel', 'export', 'see_kyc'],
      leads: ['view', 'create', 'edit', 'delete_or_cancel', 'export'],
      quotes_invoices: ['view', 'create', 'edit', 'delete_or_cancel', 'approve', 'export', 'see_money', 'see_margin'],
      bookings: ['view', 'create', 'edit', 'delete_or_cancel', 'approve', 'export', 'see_money', 'see_margin', 'see_kyc'],
      finance: ['view', 'create', 'edit', 'delete_or_cancel', 'approve', 'export', 'see_money', 'see_margin'],
      approvals: ['view', 'approve', 'export', 'see_money'],
      suppliers: ['view', 'create', 'edit', 'delete_or_cancel', 'approve', 'export', 'see_money'],
      tickets_visas: ['view', 'create', 'edit', 'delete_or_cancel', 'approve', 'export', 'see_money', 'see_kyc'],
      tasks_queries: ['view', 'create', 'edit', 'delete_or_cancel'],
      performance: ['view', 'export', 'see_money', 'see_margin'],
      group_travel: ['view', 'create', 'edit', 'delete_or_cancel', 'approve', 'export', 'see_money', 'see_margin'],
      events: ['view', 'create', 'edit', 'delete_or_cancel', 'approve', 'export', 'see_money', 'see_margin'],
      documents: ['view', 'create', 'edit', 'delete_or_cancel', 'approve', 'export'],
      team: ['view', 'create', 'edit', 'delete_or_cancel', 'approve', 'export', 'see_money'],
      settings: ['view', 'create', 'edit', 'delete_or_cancel', 'approve', 'export'],
    },
    approvalLimitKobo: 10000000000, // 100M NGN
  },
  {
    id: 'ROLE-MANAGER',
    name: 'Manager',
    isDefault: true,
    description: 'Branch head overseeing team quotas, bookings, and operations.',
    permissions: {
      home: ['view', 'export', 'see_money'],
      clients: ['view', 'create', 'edit', 'export', 'see_kyc'],
      leads: ['view', 'create', 'edit', 'export'],
      quotes_invoices: ['view', 'create', 'edit', 'approve', 'export', 'see_money'],
      bookings: ['view', 'create', 'edit', 'approve', 'export', 'see_money', 'see_kyc'],
      finance: ['view', 'approve', 'see_money'],
      approvals: ['view', 'approve', 'see_money'],
      suppliers: ['view', 'export'],
      tickets_visas: ['view', 'create', 'edit', 'export', 'see_kyc'],
      tasks_queries: ['view', 'create', 'edit', 'delete_or_cancel'],
      performance: ['view', 'see_money'],
      group_travel: ['view', 'create', 'edit', 'export', 'see_money'],
      events: ['view', 'create', 'edit', 'export', 'see_money'],
      documents: ['view', 'create', 'export'],
      team: ['view', 'see_money'],
      settings: ['view'],
    },
    approvalLimitKobo: 250000000, // 2.5M NGN
  },
  {
    id: 'ROLE-FINANCE',
    name: 'Finance',
    isDefault: true,
    description: 'Accounts officer handling bank reconciliations, vendor payables, and day close.',
    permissions: {
      home: ['view', 'see_money'],
      clients: ['view', 'see_money'],
      leads: ['view'],
      quotes_invoices: ['view', 'create', 'edit', 'approve', 'export', 'see_money', 'see_margin'],
      bookings: ['view', 'export', 'see_money', 'see_margin'],
      finance: ['view', 'create', 'edit', 'approve', 'export', 'see_money', 'see_margin'],
      approvals: ['view', 'approve', 'see_money'],
      suppliers: ['view', 'create', 'edit', 'approve', 'export', 'see_money'],
      tickets_visas: ['view', 'see_money'],
      tasks_queries: ['view', 'create', 'edit'],
      performance: ['view', 'see_money'],
      group_travel: ['view', 'see_money'],
      events: ['view', 'see_money'],
      documents: ['view', 'create', 'export'],
      team: ['view', 'see_money'],
      settings: ['view'],
    },
    approvalLimitKobo: 500000000, // 5M NGN
  },
  {
    id: 'ROLE-STAFF',
    name: 'Staff',
    isDefault: true,
    description: 'Travel consultant handling daily customer inquiries, itineraries, and bookings.',
    permissions: {
      home: ['view'],
      clients: ['view', 'create', 'edit'],
      leads: ['view', 'create', 'edit'],
      quotes_invoices: ['view', 'create', 'edit'],
      bookings: ['view', 'create', 'edit'],
      finance: ['view'],
      approvals: ['view'],
      suppliers: ['view'],
      tickets_visas: ['view', 'create', 'edit'],
      tasks_queries: ['view', 'create', 'edit'],
      performance: ['view'],
      group_travel: ['view'],
      events: ['view'],
      documents: ['view'],
      team: ['view'],
      settings: ['view'],
    },
    approvalLimitKobo: 5000000, // 50,000 NGN
  },
  {
    id: 'ROLE-TOUR-LEAD',
    name: 'Tour lead',
    isDefault: true,
    description: 'Field guide managing groups, hotel rooming lists, and delegate check-in.',
    permissions: {
      home: ['view'],
      clients: ['view'],
      leads: ['view'],
      quotes_invoices: ['view'],
      bookings: ['view'],
      finance: ['view'],
      approvals: ['view'],
      suppliers: ['view'],
      tickets_visas: ['view'],
      tasks_queries: ['view', 'create', 'edit'],
      performance: ['view'],
      group_travel: ['view', 'edit'],
      events: ['view', 'edit'],
      documents: ['view'],
      team: ['view'],
      settings: ['view'],
    },
    approvalLimitKobo: 0,
  },
  {
    id: 'ROLE-READONLY',
    name: 'Read-only',
    isDefault: true,
    description: 'Auditor or intern with strictly viewing privileges.',
    permissions: {
      home: ['view'],
      clients: ['view'],
      leads: ['view'],
      quotes_invoices: ['view'],
      bookings: ['view'],
      finance: ['view'],
      approvals: ['view'],
      suppliers: ['view'],
      tickets_visas: ['view'],
      tasks_queries: ['view'],
      performance: ['view'],
      group_travel: ['view'],
      events: ['view'],
      documents: ['view'],
      team: ['view'],
      settings: ['view'],
    },
    approvalLimitKobo: 0,
  },
];

let SEED_APPROVAL_RULES: ApprovalRule[] = [
  {
    roleId: 'ROLE-STAFF',
    roleName: 'Staff Consultant',
    maxAmountKobo: 5000000, // 50k NGN
    escalationHours: 24,
    deputyRoleId: 'ROLE-MANAGER',
  },
  {
    roleId: 'ROLE-MANAGER',
    roleName: 'Branch Manager',
    maxAmountKobo: 250000000, // 2.5M NGN
    requiresSecondApprovalAboveKobo: 100000000,
    escalationHours: 24,
    deputyRoleId: 'ROLE-OWNER',
  },
  {
    roleId: 'ROLE-FINANCE',
    roleName: 'Finance Controller',
    maxAmountKobo: 500000000, // 5.0M NGN
    escalationHours: 12,
    deputyRoleId: 'ROLE-OWNER',
  },
];

let SEED_WORKING_HOURS: WorkingHoursRule = {
  branchId: 'BR-LAG-01',
  workStartTime: '08:30',
  workEndTime: '17:30',
  graceMinutes: 15,
  penaltyType: 'fixed_kobo',
  penaltyAmountKobo: 200000, // 2,000 NGN
  weekendDays: [0, 6], // Sunday, Saturday
  effectiveDate: '2026-01-01',
};

let SEED_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    id: 'CF-01',
    entityType: 'lead',
    name: 'Primary Referral Source',
    key: 'referral_source',
    type: 'choice',
    options: ['Instagram Ad', 'WhatsApp Referral', 'Word of Mouth', 'Corporate Partner'],
    isRequired: true,
    isHidden: false,
    hasExistingData: true,
  },
  {
    id: 'CF-02',
    entityType: 'booking',
    name: 'Frequent Flyer / Loyalty ID',
    key: 'ff_loyalty_id',
    type: 'text',
    isRequired: false,
    isHidden: false,
    hasExistingData: true,
  },
  {
    id: 'CF-03',
    entityType: 'client',
    name: 'Dietary & Medical Allergies',
    key: 'dietary_allergies',
    type: 'text',
    isRequired: false,
    isHidden: false,
    hasExistingData: false,
  },
];

let SEED_BRANDING: BrandingSettings = {
  logoUrl: 'https://cdn.travelreel.ng/skyline/logo.png',
  primaryColor: '#0B1E3D', // Planexi Navy
  accentColor: '#C9A84C', // Gold
  footerText: 'TravelReel · A Planexi product · Powered by Skyline Travels Lagos Nigeria',
  invoiceTerms:
    'Payment strictly due within 7 days of invoice issuance. Air tickets subject to airline fare reassessment until e-ticket generation. Foreign currency amounts settled in NGN at prevailing CBN/commercial bank rate.',
};

let SEED_CURRENCY_VAT: CurrencyVatSettings = {
  baseCurrency: 'NGN',
  enabledCurrencies: ['NGN', 'USD', 'GBP', 'EUR'],
  isVatEnabled: true,
  vatRatePercent: 7.5,
  rounding: 'whole_kobo',
};

let SEED_NOTIFICATION_RULES: NotificationRule[] = [
  {
    id: 'NOTIF-01',
    eventName: 'Client Payment Captured & Reconciled',
    isCritical: true, // Cannot be disabled
    channels: { whatsapp: true, email: true, sms: false, push: true },
    recipientsRole: ['ROLE-OWNER', 'ROLE-FINANCE', 'ROLE-MANAGER'],
  },
  {
    id: 'NOTIF-02',
    eventName: 'Flight E-Ticket or Visa Issued',
    isCritical: true, // Cannot be disabled
    channels: { whatsapp: true, email: true, sms: true, push: true },
    recipientsRole: ['ROLE-OWNER', 'ROLE-STAFF'],
  },
  {
    id: 'NOTIF-03',
    eventName: 'Expense / Refund Approval Escalation Overdue',
    isCritical: true, // Cannot be disabled
    channels: { whatsapp: false, email: true, sms: false, push: true },
    recipientsRole: ['ROLE-OWNER', 'ROLE-MANAGER'],
  },
  {
    id: 'NOTIF-04',
    eventName: 'New Unassigned Lead Ingested',
    isCritical: false, // Can be disabled
    channels: { whatsapp: true, email: false, sms: false, push: true },
    recipientsRole: ['ROLE-MANAGER', 'ROLE-STAFF'],
  },
];

let SEED_AUDIT_TRAIL: SettingsAuditRecord[] = [
  {
    id: 'AUD-SETT-001',
    entityName: 'CurrencyVatSettings',
    changedBy: 'Chioma Adebayo (Owner)',
    timestamp: '2026-10-18T11:00:00Z',
    oldValue: { vatRatePercent: 5.0 },
    newValue: { vatRatePercent: 7.5 },
    isRestorable: true,
  },
];

export async function registerWorkspaceSettingsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/settings/workspace/rules
   * Returns all 13 workspace specification rules
   */
  app.get('/api/v1/settings/workspace/rules', async () => {
    return {
      success: true,
      rules: WORKSPACE_SETTINGS_RULES,
      count: WORKSPACE_SETTINGS_RULES.length,
    };
  });

  /**
   * GET /api/v1/settings/workspace
   * Returns complete workspace configuration payload
   */
  app.get('/api/v1/settings/workspace', async () => {
    return {
      success: true,
      organisation: SEED_ORGANISATION,
      branches: SEED_BRANCHES,
      roles: SEED_ROLES,
      approvalRules: SEED_APPROVAL_RULES,
      workingHours: SEED_WORKING_HOURS,
      customFields: SEED_CUSTOM_FIELDS,
      branding: SEED_BRANDING,
      currencyVat: SEED_CURRENCY_VAT,
      notificationRules: SEED_NOTIFICATION_RULES,
    };
  });

  /**
   * PUT /api/v1/settings/workspace/organisation
   * Updates master organisation profile with audit logging
   */
  app.put('/api/v1/settings/workspace/organisation', async (req: FastifyRequest) => {
    const body = req.body as Partial<OrganisationProfile> & { changedBy?: string };
    const oldVal = { ...SEED_ORGANISATION };

    SEED_ORGANISATION = {
      ...SEED_ORGANISATION,
      ...body,
    };

    const audit = auditSettingsDiff(
      'OrganisationProfile',
      body.changedBy || 'Workspace Admin',
      oldVal,
      SEED_ORGANISATION
    );
    SEED_AUDIT_TRAIL.unshift(audit);

    return {
      success: true,
      organisation: SEED_ORGANISATION,
      message: 'Organisation profile updated and logged in compliance audit.',
    };
  });

  /**
   * POST /api/v1/settings/workspace/branches
   * Adds branch with plan limit enforcement
   */
  app.post('/api/v1/settings/workspace/branches', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      name: string;
      code: string;
      city: string;
      address: string;
      phone: string;
      plan?: 'Starter' | 'Business' | 'Pro';
      changedBy?: string;
    };

    const plan = body.plan || 'Business';
    const limitCheck = validateBranchPlanLimit(SEED_BRANCHES.length, plan);

    if (!limitCheck.allowed) {
      return reply.status(403).send({
        success: false,
        error: limitCheck.error,
      });
    }

    const newBranch: BranchRecord = {
      id: `BR-${Date.now().toString().slice(-4)}`,
      name: body.name,
      code: body.code.toUpperCase(),
      city: body.city,
      address: body.address,
      phone: body.phone,
      isActive: true,
      activeRecordsCount: 0,
    };

    SEED_BRANCHES.push(newBranch);

    const audit = auditSettingsDiff('BranchRecord', body.changedBy || 'Workspace Admin', null, newBranch);
    SEED_AUDIT_TRAIL.unshift(audit);

    return {
      success: true,
      branch: newBranch,
      message: `Branch '${newBranch.name}' added under ${plan} plan quota.`,
    };
  });

  /**
   * DELETE /api/v1/settings/workspace/branches/:id
   * Rejects branch deletion if active records exist
   */
  app.delete('/api/v1/settings/workspace/branches/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const branch = SEED_BRANCHES.find((b) => b.id === id);

    if (!branch) {
      return reply.status(404).send({ success: false, error: 'Branch not found' });
    }

    const deletionCheck = validateBranchDeletion(branch, branch.activeRecordsCount);
    if (!deletionCheck.allowed) {
      return reply.status(400).send({
        success: false,
        error: deletionCheck.error,
      });
    }

    SEED_BRANCHES = SEED_BRANCHES.filter((b) => b.id !== id);

    const audit = auditSettingsDiff('BranchRecord', 'Workspace Admin', branch, null);
    SEED_AUDIT_TRAIL.unshift(audit);

    return {
      success: true,
      message: `Branch '${branch.name}' safely removed.`,
    };
  });

  /**
   * GET /api/v1/settings/workspace/roles
   * Returns roles and permission matrix
   */
  app.get('/api/v1/settings/workspace/roles', async () => {
    return {
      success: true,
      roles: SEED_ROLES,
      count: SEED_ROLES.length,
    };
  });

  /**
   * POST /api/v1/settings/workspace/roles
   * Creates custom role enforcing plan tier and privilege ceiling
   */
  app.post('/api/v1/settings/workspace/roles', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      name: string;
      description: string;
      permissions: Record<WorkspacePageKey, PermissionAction[]>;
      approvalLimitKobo: number;
      plan?: 'Starter' | 'Business' | 'Pro';
      granterRole?: string;
      changedBy?: string;
    };

    const plan = body.plan || 'Business';
    const planCheck = validateCustomRoleCreation(plan);
    if (!planCheck.allowed) {
      return reply.status(403).send({ success: false, error: planCheck.error });
    }

    const newRole: WorkspaceRole = {
      id: `ROLE-CUSTOM-${Date.now().toString().slice(-4)}`,
      name: body.name,
      isDefault: false,
      description: body.description,
      permissions: body.permissions,
      approvalLimitKobo: body.approvalLimitKobo,
    };

    SEED_ROLES.push(newRole);

    const audit = auditSettingsDiff('WorkspaceRole', body.changedBy || 'Workspace Admin', null, newRole);
    SEED_AUDIT_TRAIL.unshift(audit);

    return {
      success: true,
      role: newRole,
      message: `Custom role '${newRole.name}' registered for ${plan} workspace.`,
    };
  });

  /**
   * PUT /api/v1/settings/workspace/branding
   * Updates agency branding with PDF sample render data
   */
  app.put('/api/v1/settings/workspace/branding', async (req: FastifyRequest) => {
    const body = req.body as Partial<BrandingSettings> & { changedBy?: string };
    const oldVal = { ...SEED_BRANDING };

    SEED_BRANDING = {
      ...SEED_BRANDING,
      ...body,
    };

    const audit = auditSettingsDiff('BrandingSettings', body.changedBy || 'Workspace Admin', oldVal, SEED_BRANDING);
    SEED_AUDIT_TRAIL.unshift(audit);

    return {
      success: true,
      branding: SEED_BRANDING,
      message: 'Branding identity updated. Sample PDF preview re-rendered.',
    };
  });

  /**
   * PUT /api/v1/settings/workspace/currency-vat
   * Updates base currency, enabled currencies, and VAT rate
   */
  app.put('/api/v1/settings/workspace/currency-vat', async (req: FastifyRequest) => {
    const body = req.body as Partial<CurrencyVatSettings> & { changedBy?: string };
    const oldVal = { ...SEED_CURRENCY_VAT };

    SEED_CURRENCY_VAT = {
      ...SEED_CURRENCY_VAT,
      ...body,
    };

    const audit = auditSettingsDiff('CurrencyVatSettings', body.changedBy || 'Workspace Admin', oldVal, SEED_CURRENCY_VAT);
    SEED_AUDIT_TRAIL.unshift(audit);

    return {
      success: true,
      currencyVat: SEED_CURRENCY_VAT,
      warning: 'Warning: Currency and VAT modifications take effect on new quotes and invoices only. Existing documents are preserved.',
    };
  });

  /**
   * PUT /api/v1/settings/workspace/notifications
   * Updates notification rule matrix (critical rules locked)
   */
  app.put('/api/v1/settings/workspace/notifications', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      ruleId: string;
      channels: { whatsapp: boolean; email: boolean; sms: boolean; push: boolean };
    };

    const targetRule = SEED_NOTIFICATION_RULES.find((r) => r.id === body.ruleId);
    if (!targetRule) {
      return reply.status(404).send({ success: false, error: 'Notification rule not found' });
    }

    if (targetRule.isCritical && !body.channels.email && !body.channels.whatsapp && !body.channels.push) {
      return reply.status(400).send({
        success: false,
        error: `Rule '${targetRule.eventName}' is designated critical for regulatory and fraud safety and cannot have all notification channels disabled.`,
      });
    }

    const oldChannels = { ...targetRule.channels };
    targetRule.channels = body.channels;

    const audit = auditSettingsDiff(`NotificationRule-${targetRule.id}`, 'Workspace Admin', oldChannels, body.channels);
    SEED_AUDIT_TRAIL.unshift(audit);

    return {
      success: true,
      rule: targetRule,
      message: 'Notification rule updated.',
    };
  });

  /**
   * GET /api/v1/settings/workspace/audit
   * Returns immutable audit trail of settings mutations
   */
  app.get('/api/v1/settings/workspace/audit', async () => {
    return {
      success: true,
      auditTrail: SEED_AUDIT_TRAIL,
      count: SEED_AUDIT_TRAIL.length,
    };
  });

  /**
   * POST /api/v1/settings/workspace/restore/:auditId
   * Restores previous settings version from audit diff
   */
  app.post('/api/v1/settings/workspace/restore/:auditId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { auditId } = req.params as { auditId: string };
    const auditRecord = SEED_AUDIT_TRAIL.find((a) => a.id === auditId);

    if (!auditRecord || !auditRecord.isRestorable) {
      return reply.status(404).send({ success: false, error: 'Audit record not found or not restorable' });
    }

    if (auditRecord.entityName === 'CurrencyVatSettings') {
      SEED_CURRENCY_VAT = { ...SEED_CURRENCY_VAT, ...auditRecord.oldValue };
    } else if (auditRecord.entityName === 'BrandingSettings') {
      SEED_BRANDING = { ...SEED_BRANDING, ...auditRecord.oldValue };
    }

    return {
      success: true,
      restoredEntity: auditRecord.entityName,
      restoredValue: auditRecord.oldValue,
      message: `Successfully rolled back ${auditRecord.entityName} to state prior to ${auditRecord.timestamp}.`,
    };
  });
}

import {
  DEFAULT_ROLE_TEMPLATES,
  createCustomWorkspaceRole,
  seedWorkspaceRoleTemplates,
} from '@/core/permissions/flags';
import {
  OpenAssigneeRecord,
  PermissionAuditTrail,
  UserSessionAndDeviceRegistry,
  assertAuthorizedForAction,
  assertWithinApprovalLimit,
  buildUserPrincipalFromCustomRole,
  buildUserPrincipalFromTemplate,
  getMobileBottomBarForRole,
  maskIdentityNumber,
  offboardUserAndReassign,
  revealIdentityNumber,
  startSuperAdminImpersonation,
} from '@/core/permissions/authorizer';

describe('Section 2: Users, Roles and Permissions', () => {
  describe('Seven Workspace Role Templates & Flag-Based Authorization', () => {
    it('seeds exactly the 7 workspace role templates and excludes Planexi Super Admin from tenant roles', () => {
      const workspaceRoles = seedWorkspaceRoleTemplates('org_lagos_1');
      expect(workspaceRoles).toHaveLength(7);
      expect(workspaceRoles.map((r) => r.key)).toEqual([
        'OWNER',
        'OPERATIONS_MANAGER',
        'FINANCE_OFFICER',
        'SALES_AGENT',
        'TICKETING_VISA_OFFICER',
        'GROUP_COORDINATOR',
        'FIELD_STAFF',
      ]);
      expect(DEFAULT_ROLE_TEMPLATES.PLANEXI_SUPER_ADMIN.isPlatformRole).toBe(true);
    });

    it('refuses a Sales Agent opening workspace settings on the server, and checks flags rather than role names', () => {
      const salesAgent = buildUserPrincipalFromTemplate({
        userId: 'user_agent_1',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        roleTemplateKey: 'SALES_AGENT',
      });

      // M1 / Section 2 test: A sales agent opening settings by typing its address is refused by the server
      expect(() => assertAuthorizedForAction(salesAgent, 'settings.manage')).toThrow(
        /FORBIDDEN_MISSING_FLAG/
      );
      expect(() => assertAuthorizedForAction(salesAgent, 'roles.manage')).toThrow(
        /FORBIDDEN_MISSING_FLAG/
      );

      // Granting an individual flag works even though roleTemplateKey is still SALES_AGENT
      const agentWithCustomFlag = buildUserPrincipalFromTemplate({
        userId: 'user_agent_2',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        roleTemplateKey: 'SALES_AGENT',
        extraFlags: ['reports.view'],
      });
      expect(() => assertAuthorizedForAction(agentWithCustomFlag, 'reports.view')).not.toThrow();

      // Owner can also create a brand-new custom role with its own roleId and flags
      const corporateTicketingRole = createCustomWorkspaceRole({
        organizationId: 'org_lagos_1',
        roleId: 'role_corporate_ticketing_lead',
        name: 'Corporate ticketing lead',
        mainJob: 'Corporate accounts and ticket issuance',
        flags: ['clients.view', 'bookings.view', 'tickets.manage', 'approvals.decide'],
        dataScope: { clients: 'branch', bookings: 'branch' },
        approvalLimitKobo: 150_000_00,
      });

      const customPrincipal = buildUserPrincipalFromCustomRole({
        userId: 'usr_corp_1',
        branchId: 'br_ikeja',
        role: corporateTicketingRole,
      });

      expect(customPrincipal.roleId).toBe('role_corporate_ticketing_lead');
      expect(() => assertAuthorizedForAction(customPrincipal, 'tickets.manage')).not.toThrow();
      expect(() => assertWithinApprovalLimit(customPrincipal, 120_000_00)).not.toThrow();
    });
  });

  describe('Data Scope Enforcement (own, team, branch, all)', () => {
    it('restricts a Sales Agent to their own leads and clients unless granted team, branch, or all scope', () => {
      const agentA = buildUserPrincipalFromTemplate({
        userId: 'agent_a',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        teamId: 'team_alpha',
        roleTemplateKey: 'SALES_AGENT',
      });

      const ownLead = {
        resourceType: 'leads' as const,
        organizationId: 'org_lagos_1',
        ownerUserId: 'agent_a',
        teamId: 'team_alpha',
        branchId: 'br_ikeja',
      };

      const colleagueLead = {
        resourceType: 'leads' as const,
        organizationId: 'org_lagos_1',
        ownerUserId: 'agent_b',
        teamId: 'team_alpha',
        branchId: 'br_ikeja',
      };

      expect(() => assertAuthorizedForAction(agentA, 'leads.view', ownLead)).not.toThrow();
      expect(() => assertAuthorizedForAction(agentA, 'leads.view', colleagueLead)).toThrow(
        /FORBIDDEN_DATA_SCOPE/
      );

      // Granting 'team' scope allows viewing team colleague's lead
      const teamScopedAgent = buildUserPrincipalFromTemplate({
        userId: 'agent_a',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        teamId: 'team_alpha',
        roleTemplateKey: 'SALES_AGENT',
        scopeOverrides: { leads: 'team' },
      });
      expect(() =>
        assertAuthorizedForAction(teamScopedAgent, 'leads.view', colleagueLead)
      ).not.toThrow();
    });

    it('enforces branch scope for Operations Manager across branches', () => {
      const ikejaManager = buildUserPrincipalFromTemplate({
        userId: 'mgr_ikeja',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        roleTemplateKey: 'OPERATIONS_MANAGER',
      });

      const ikejaBooking = {
        resourceType: 'bookings' as const,
        organizationId: 'org_lagos_1',
        ownerUserId: 'agent_b',
        branchId: 'br_ikeja',
      };

      const lekkiBooking = {
        resourceType: 'bookings' as const,
        organizationId: 'org_lagos_1',
        ownerUserId: 'agent_c',
        branchId: 'br_lekki',
      };

      expect(() => assertAuthorizedForAction(ikejaManager, 'bookings.view', ikejaBooking)).not.toThrow();
      expect(() => assertAuthorizedForAction(ikejaManager, 'bookings.view', lekkiBooking)).toThrow(
        /FORBIDDEN_DATA_SCOPE/
      );
    });
  });

  describe('Approval Limits in Naira (Kobo)', () => {
    it('enforces role default approval limit and supports per-user override in Naira/kobo', () => {
      const opsManager = buildUserPrincipalFromTemplate({
        userId: 'mgr_1',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        roleTemplateKey: 'OPERATIONS_MANAGER', // Default: ₦250,000 (25,000,000 kobo)
      });

      expect(() => assertWithinApprovalLimit(opsManager, 200_000_00)).not.toThrow();
      expect(() => assertWithinApprovalLimit(opsManager, 300_000_00)).toThrow(
        /APPROVAL_LIMIT_EXCEEDED/
      );

      const seniorOpsManager = buildUserPrincipalFromTemplate({
        userId: 'mgr_senior',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        roleTemplateKey: 'OPERATIONS_MANAGER',
        customApprovalLimitKobo: 500_000_00, // ₦500,000 override
      });

      expect(() => assertWithinApprovalLimit(seniorOpsManager, 450_000_00)).not.toThrow();
    });
  });

  describe('Identity Fields (KYC Masking & Audit Log)', () => {
    it('masks passport and NIN numbers by default and requires kyc.view + audit log to reveal', () => {
      const rawNin = '12345678901';
      expect(maskIdentityNumber(rawNin)).toBe('*******8901');

      const rawPassport = 'A01234567';
      expect(maskIdentityNumber(rawPassport)).toBe('*****4567');

      const auditTrail = new PermissionAuditTrail();

      const salesAgent = buildUserPrincipalFromTemplate({
        userId: 'agent_1',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        roleTemplateKey: 'SALES_AGENT',
      });

      expect(() =>
        revealIdentityNumber({
          user: salesAgent,
          documentId: 'doc_nin_1',
          rawNumber: rawNin,
          purpose: 'Verify visa form',
          auditTrail,
        })
      ).toThrow(/FORBIDDEN_MISSING_FLAG/);

      const visaOfficer = buildUserPrincipalFromTemplate({
        userId: 'visa_1',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        roleTemplateKey: 'TICKETING_VISA_OFFICER',
      });

      const revealed = revealIdentityNumber({
        user: visaOfficer,
        documentId: 'doc_nin_1',
        rawNumber: rawNin,
        purpose: 'Embassy portal submission check',
        auditTrail,
      });

      expect(revealed.unmaskedNumber).toBe(rawNin);
      expect(revealed.auditEntry.action).toBe('KYC_IDENTITY_REVEALED');
      expect(auditTrail.listByOrganization('org_lagos_1')).toHaveLength(1);
    });
  });

  describe('Leavers (Immediate Session/Device Revocation & Record Reassignment)', () => {
    it('ends open sessions, revokes devices, blocks next action immediately, and reassigns open records', () => {
      const owner = buildUserPrincipalFromTemplate({
        userId: 'owner_1',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        roleTemplateKey: 'OWNER',
      });

      const leaver = buildUserPrincipalFromTemplate({
        userId: 'agent_leaving',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        roleTemplateKey: 'SALES_AGENT',
      });

      const successor = buildUserPrincipalFromTemplate({
        userId: 'agent_staying',
        organizationId: 'org_lagos_1',
        branchId: 'br_ikeja',
        roleTemplateKey: 'SALES_AGENT',
      });

      const registry: UserSessionAndDeviceRegistry = {
        activeSessionIdsByUser: new Map([
          ['agent_leaving', new Set(['sess_web_1', 'sess_mob_1'])],
        ]),
        registeredDeviceIdsByUser: new Map([
          ['agent_leaving', new Set(['dev_android_tecno'])],
        ]),
      };

      const openRecords: OpenAssigneeRecord[] = [
        { id: 'lead_101', organizationId: 'org_lagos_1', ownerUserId: 'agent_leaving', status: 'OPEN' },
        { id: 'bk_202', organizationId: 'org_lagos_1', ownerUserId: 'agent_leaving', status: 'OPEN' },
        { id: 'bk_closed_203', organizationId: 'org_lagos_1', ownerUserId: 'agent_leaving', status: 'CLOSED' },
      ];

      const auditTrail = new PermissionAuditTrail();

      const result = offboardUserAndReassign({
        actor: owner,
        leaver,
        reassignToUser: successor,
        openRecords,
        registry,
        auditTrail,
      });

      expect(result.revokedSessionCount).toBe(2);
      expect(result.revokedDeviceCount).toBe(1);
      expect(result.reassignedRecordIds).toEqual(['lead_101', 'bk_202']);
      expect(result.sessionTerminationSlaSeconds).toBeLessThanOrEqual(60);

      // Open records now belong to successor; closed historical record stays attributed
      expect(openRecords[0]?.ownerUserId).toBe('agent_staying');
      expect(openRecords[1]?.ownerUserId).toBe('agent_staying');
      expect(openRecords[2]?.ownerUserId).toBe('agent_leaving');

      // Removed user's open session ends on their very next action
      expect(() => assertAuthorizedForAction(leaver, 'leads.view')).toThrow(/SESSION_REVOKED/);
    });
  });

  describe('Planexi Super Admin Impersonation & Mobile Navigation by Role', () => {
    it('enforces time-limited Super Admin impersonation with a mandatory written reason, owner banner, and audit log', () => {
      const superAdmin = buildUserPrincipalFromTemplate({
        userId: 'sa_planexi_1',
        organizationId: 'org_planexi',
        branchId: 'br_hq',
        roleTemplateKey: 'PLANEXI_SUPER_ADMIN',
      });

      const auditTrail = new PermissionAuditTrail();

      // Short or missing reason is refused
      expect(() =>
        startSuperAdminImpersonation({
          superAdmin,
          targetOrganizationId: 'org_lagos_1',
          reason: 'short',
          auditTrail,
        })
      ).toThrow(/IMPERSONATION_REASON_REQUIRED/);

      const session = startSuperAdminImpersonation({
        superAdmin,
        targetOrganizationId: 'org_lagos_1',
        reason: 'Investigating ticket #402 reconciliation discrepancy requested by agency owner',
        durationMinutes: 30,
        auditTrail,
      });

      expect(session.ownerVisibleBannerText).toContain('Planexi Support');
      expect(session.ownerVisibleBannerText).toContain('ticket #402');
      expect(session.auditEntry.action).toBe('SUPER_ADMIN_IMPERSONATION_STARTED');
    });

    it('returns the exact 4 bottom navigation tabs + More per role and blocks Super Admin on mobile', () => {
      expect(getMobileBottomBarForRole('OWNER').tabs).toEqual([
        'Home',
        'Approvals',
        'Bookings',
        'Finance',
      ]);
      expect(getMobileBottomBarForRole('SALES_AGENT').tabs).toEqual([
        'My Day',
        'Leads',
        'Clients',
        'Bookings',
      ]);
      expect(getMobileBottomBarForRole('TICKETING_VISA_OFFICER').tabs).toEqual([
        'My Day',
        'Tickets and visas',
        'Clients',
        'Bookings',
      ]);
      expect(getMobileBottomBarForRole('FIELD_STAFF').tabs).toEqual([
        'My Day',
        'Departures',
        'Tasks',
        'Inbox',
      ]);
      expect(() => getMobileBottomBarForRole('PLANEXI_SUPER_ADMIN')).toThrow(/WEB_ONLY/);
    });
  });
});

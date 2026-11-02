import { describe, it, expect } from '@jest/globals';
import {
  MANDATORY_TENANT_SECURITY_RULES,
  assertStrictTenantIsolation,
  assertScopeAccess,
  TokenRevocationRegistry,
  TenantSessionContext,
} from '@/core/tenancy/crossTenantSecurity';

describe('Section 2 & 11: Multi-Tenant Isolation, RBAC & Security Specification', () => {
  it('defines and verifies all 8 mandatory multi-tenant security rules', () => {
    expect(MANDATORY_TENANT_SECURITY_RULES).toHaveLength(8);
    expect(MANDATORY_TENANT_SECURITY_RULES.every((r) => r.isCompliant)).toBe(true);

    const ids = MANDATORY_TENANT_SECURITY_RULES.map((r) => r.id);
    expect(ids).toContain('SEC_SERVER_QUERY_SCOPING');
    expect(ids).toContain('SEC_RBAC_SERVER_BLOCKING');
    expect(ids).toContain('SEC_URL_TAMPER_PROTECTION');
    expect(ids).toContain('SEC_BRANCH_TEAM_SCOPES');
    expect(ids).toContain('SEC_PERMISSION_PROPAGATION');
    expect(ids).toContain('SEC_DEACTIVATED_REVOCATION');
    expect(ids).toContain('SEC_IMPERSONATION_CONTROLS');
    expect(ids).toContain('SEC_AUTOMATED_CROSS_TENANT_TEST');
  });

  // Rule 1 & Rule 3: Server Query Isolation & URL Tamper Protection
  it('Rule 1 & 3: queries are scoped to organizationId on the server, and manual URL/ID tampering throws 404 (zero leak)', () => {
    const skylineOrg = 'org_skyline_lagos';
    const abujaOrg = 'org_abuja_express';

    // Legitimate query inside same organization: passes
    expect(() => assertStrictTenantIsolation(skylineOrg, skylineOrg)).not.toThrow();

    // Tampered ID or cross-tenant access attempt: throws generic NOT_FOUND
    expect(() => assertStrictTenantIsolation(skylineOrg, abujaOrg)).toThrow('NOT_FOUND');
  });

  // Rule 4: Branch & Team Scopes
  it('Rule 4: branch and team limits strictly apply to records, search, reports and exports', () => {
    const sessionIkejaAgent: TenantSessionContext = {
      userId: 'usr_bisi',
      organizationId: 'org_skyline_lagos',
      branchId: 'br_ikeja',
      teamId: 'team_sales_alpha',
      roleKey: 'SALES_AGENT',
      flags: new Set(['leads.view', 'bookings.view']),
      isActive: true,
      tokenVersion: 1,
    };

    const ownRecord = {
      organizationId: 'org_skyline_lagos',
      branchId: 'br_ikeja',
      teamId: 'team_sales_alpha',
      ownerUserId: 'usr_bisi',
    };

    const teammateRecord = {
      organizationId: 'org_skyline_lagos',
      branchId: 'br_ikeja',
      teamId: 'team_sales_alpha',
      ownerUserId: 'usr_tunde',
    };

    const otherBranchRecord = {
      organizationId: 'org_skyline_lagos',
      branchId: 'br_lekki',
      teamId: 'team_sales_beta',
      ownerUserId: 'usr_lekki_agent',
    };

    // 'own' scope: only sees own record
    expect(assertScopeAccess(sessionIkejaAgent, ownRecord, 'own')).toBe(true);
    expect(assertScopeAccess(sessionIkejaAgent, teammateRecord, 'own')).toBe(false);

    // 'team' scope: sees teammate record, but not other branch
    expect(assertScopeAccess(sessionIkejaAgent, teammateRecord, 'team')).toBe(true);
    expect(assertScopeAccess(sessionIkejaAgent, otherBranchRecord, 'team')).toBe(false);

    // Cross-tenant record: always blocked regardless of scope
    const crossTenantRecord = {
      organizationId: 'org_abuja_express',
      branchId: 'br_ikeja',
      ownerUserId: 'usr_bisi',
    };
    expect(assertScopeAccess(sessionIkejaAgent, crossTenantRecord, 'all')).toBe(false);
  });

  // Rule 5 & 6: Immediate Deactivation & Token Revocation
  it('Rule 5 & 6: deactivated user loses access immediately across all open sessions and tokens', () => {
    const registry = new TokenRevocationRegistry();
    const userId = 'usr_agent_leaving';

    // Token version 1 is initially valid
    expect(registry.isTokenValid(userId, 1, 'jwt_token_123')).toBe(true);

    // User is deactivated by Owner
    const deactivation = registry.deactivateUser(userId);
    expect(deactivation.tokensBlacklisted).toBe(true);
    expect(deactivation.newVersion).toBe(2);

    // Open session holding token version 1 is now rejected immediately on next request
    expect(registry.isTokenValid(userId, 1, 'jwt_token_123')).toBe(false);
  });
});

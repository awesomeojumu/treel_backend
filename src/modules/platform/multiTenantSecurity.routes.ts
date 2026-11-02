import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  MANDATORY_TENANT_SECURITY_RULES,
  assertStrictTenantIsolation,
  TokenRevocationRegistry,
} from '@/core/tenancy/crossTenantSecurity';

const revocationRegistry = new TokenRevocationRegistry();

export async function registerMultiTenantSecurityRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get all 8 Security Rules
  app.get('/api/v1/platform/tenant-security/rules', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      totalRules: MANDATORY_TENANT_SECURITY_RULES.length,
      allCompliant: MANDATORY_TENANT_SECURITY_RULES.every((r) => r.isCompliant),
      rules: MANDATORY_TENANT_SECURITY_RULES,
    });
  });

  // 2. Cross-Tenant Probe Simulator (URL / ID tampering test)
  app.post('/api/v1/platform/tenant-security/probe-record', async (req: FastifyRequest, reply: FastifyReply) => {
    const { sessionOrgId = 'org_skyline_lagos', requestedRecordId = 'BK-ABUJA-999' } = (req.body as any) || {};

    // Mock cross-tenant database records
    const recordsDatabase: Record<string, { organizationId: string; title: string }> = {
      'BK-SKYLINE-001': { organizationId: 'org_skyline_lagos', title: 'Skyline Lagos Flight' },
      'BK-ABUJA-999': { organizationId: 'org_abuja_express', title: 'Abuja Express VIP Client' },
    };

    const target = recordsDatabase[requestedRecordId];

    try {
      if (!target) throw new Error('NOT_FOUND');
      assertStrictTenantIsolation(sessionOrgId, target.organizationId);
      return reply.send({ success: true, record: target });
    } catch {
      // Zero data leakage: returns generic 404
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not found',
        message: 'The requested record could not be found.',
      });
    }
  });

  // 3. User Deactivation Simulator (Instant token invalidation)
  app.post('/api/v1/platform/tenant-security/deactivate-user', async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId = 'usr_agent_leaving' } = (req.body as any) || {};
    const result = revocationRegistry.deactivateUser(userId);
    return reply.send({
      success: true,
      userId,
      revokedAt: result.revokedAt,
      message: 'User deactivated. All open sessions, JWTs and device tokens revoked immediately on next request.',
    });
  });

  // 4. Planexi Support Impersonation Simulator (Visible banner + time limit + audit log)
  app.post('/api/v1/platform/tenant-security/impersonation', async (req: FastifyRequest, reply: FastifyReply) => {
    const { superAdminEmail = 'support@planexi.com', targetOrgId = 'org_skyline_lagos', reason = '' } =
      (req.body as any) || {};

    if (!reason || reason.trim().length < 10) {
      return reply.status(400).send({
        error: 'A detailed written customer support ticket reason is required for impersonation.',
      });
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
    return reply.send({
      success: true,
      impersonating: true,
      targetOrganizationId: targetOrgId,
      superAdmin: superAdminEmail,
      bannerText: `Planexi Support (${superAdminEmail}) is currently assisting your agency under ticket inquiry: "${reason.trim()}". Access expires in 30 minutes.`,
      expiresAt: expiresAt.toISOString(),
      auditLogged: true,
    });
  });
}

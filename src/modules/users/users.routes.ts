import { FastifyInstance } from 'fastify';
import {
  DEFAULT_ROLE_TEMPLATES,
  PermissionFlagSchema,
  RoleTemplateKeySchema,
  seedWorkspaceRoleTemplates,
} from '@/core/permissions/flags';
import {
  PermissionAuditTrail,
  assertAuthorizedForAction,
  buildUserPrincipalFromTemplate,
  getMobileBottomBarForRole,
  maskIdentityNumber,
  revealIdentityNumber,
  startSuperAdminImpersonation,
} from '@/core/permissions/authorizer';

const sharedAuditTrail = new PermissionAuditTrail();

export async function registerUsersAndPermissionsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/roles/templates
   * Returns the 7 default workspace role templates + Planexi Super Admin platform role.
   */
  app.get('/v1/roles/templates', async () => {
    return {
      section: '2. Users, roles and permissions',
      workspaceTemplates: seedWorkspaceRoleTemplates('org_template_preview'),
      platformRole: DEFAULT_ROLE_TEMPLATES.PLANEXI_SUPER_ADMIN,
    };
  });

  /**
   * GET /v1/roles/:roleKey/mobile-nav
   * Returns the 4 bottom bar tabs + More for the specified mobile-enabled role.
   */
  app.get<{ Params: { roleKey: string } }>('/v1/roles/:roleKey/mobile-nav', async (request, reply) => {
    const parsed = RoleTemplateKeySchema.safeParse(request.params.roleKey.toUpperCase());
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_ROLE_KEY',
          message: `Unknown role template '${request.params.roleKey}'.`,
          requestId: request.id,
        },
      });
    }

    try {
      const mobileBottomBar = getMobileBottomBarForRole(parsed.data);
      return { roleKey: parsed.data, mobileBottomBar };
    } catch (err) {
      return reply.status(422).send({
        error: {
          code: 'WEB_ONLY_ROLE',
          message: err instanceof Error ? err.message : 'Role is web only',
          requestId: request.id,
        },
      });
    }
  });

  /**
   * POST /v1/permissions/evaluate
   * Evaluates server-side flag and record-scope access for any role template and optional record.
   */
  app.post<{
    Body: {
      organizationId: string;
      userId: string;
      branchId: string;
      teamId?: string;
      roleTemplateKey: string;
      requiredFlag: string;
      resource?: {
        resourceType: 'clients' | 'leads' | 'bookings' | 'tasks';
        organizationId: string;
        ownerUserId: string;
        teamId?: string;
        branchId: string;
      };
    };
  }>('/v1/permissions/evaluate', async (request, reply) => {
    const body = request.body ?? ({} as Record<string, unknown>);
    const parsedRole = RoleTemplateKeySchema.safeParse(body.roleTemplateKey);
    const parsedFlag = PermissionFlagSchema.safeParse(body.requiredFlag);

    if (!body.organizationId || !body.userId || !parsedRole.success || !parsedFlag.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid organizationId, userId, roleTemplateKey, and requiredFlag are required.',
          requestId: request.id,
        },
      });
    }

    const principal = buildUserPrincipalFromTemplate({
      userId: body.userId,
      organizationId: body.organizationId,
      branchId: body.branchId || 'br_main',
      teamId: body.teamId,
      roleTemplateKey: parsedRole.data,
    });

    try {
      assertAuthorizedForAction(principal, parsedFlag.data, body.resource);
      return {
        allowed: true,
        checkedFlag: parsedFlag.data,
        effectiveDataScope: principal.dataScope,
      };
    } catch (err) {
      return reply.status(403).send({
        allowed: false,
        error: {
          code: 'FORBIDDEN',
          message: err instanceof Error ? err.message : 'Access denied',
          requestId: request.id,
        },
      });
    }
  });

  /**
   * POST /v1/kyc/reveal
   * Masks by default; reveals NIN or Passport number only if caller has 'kyc.view' flag and logs an audit entry.
   */
  app.post<{
    Body: {
      organizationId: string;
      userId: string;
      roleTemplateKey: string;
      documentId: string;
      rawNumber: string;
      purpose: string;
    };
  }>('/v1/kyc/reveal', async (request, reply) => {
    const body = request.body ?? ({} as Record<string, unknown>);
    const parsedRole = RoleTemplateKeySchema.safeParse(body.roleTemplateKey);
    if (!parsedRole.success || !body.organizationId || !body.userId || !body.rawNumber) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid organizationId, userId, roleTemplateKey, and rawNumber are required.',
          requestId: request.id,
        },
      });
    }

    const principal = buildUserPrincipalFromTemplate({
      userId: body.userId,
      organizationId: body.organizationId,
      branchId: 'br_main',
      roleTemplateKey: parsedRole.data,
    });

    try {
      const revealed = revealIdentityNumber({
        user: principal,
        documentId: body.documentId || 'doc_1',
        rawNumber: body.rawNumber,
        purpose: body.purpose,
        auditTrail: sharedAuditTrail,
      });
      return {
        maskedDefault: maskIdentityNumber(body.rawNumber),
        unmaskedNumber: revealed.unmaskedNumber,
        auditEntry: revealed.auditEntry,
      };
    } catch (err) {
      return reply.status(403).send({
        maskedDefault: maskIdentityNumber(body.rawNumber),
        error: {
          code: 'KYC_REVEAL_FORBIDDEN',
          message: err instanceof Error ? err.message : 'Cannot reveal KYC field',
          requestId: request.id,
        },
      });
    }
  });

  /**
   * POST /v1/platform/impersonate
   * Starts a time-limited Super Admin impersonation session with mandatory reason, owner banner, and audit entry.
   */
  app.post<{
    Body: {
      superAdminUserId: string;
      roleTemplateKey: string;
      targetOrganizationId: string;
      reason: string;
      durationMinutes?: number;
    };
  }>('/v1/platform/impersonate', async (request, reply) => {
    const body = request.body ?? ({} as Record<string, unknown>);
    const parsedRole = RoleTemplateKeySchema.safeParse(body.roleTemplateKey);
    if (!parsedRole.success || !body.superAdminUserId || !body.targetOrganizationId) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid superAdminUserId, roleTemplateKey, and targetOrganizationId are required.',
          requestId: request.id,
        },
      });
    }

    const principal = buildUserPrincipalFromTemplate({
      userId: body.superAdminUserId,
      organizationId: 'org_planexi_platform',
      branchId: 'br_platform',
      roleTemplateKey: parsedRole.data,
    });

    try {
      const session = startSuperAdminImpersonation({
        superAdmin: principal,
        targetOrganizationId: body.targetOrganizationId,
        reason: body.reason,
        durationMinutes: body.durationMinutes,
        auditTrail: sharedAuditTrail,
      });
      return { impersonationSession: session };
    } catch (err) {
      return reply.status(403).send({
        error: {
          code: 'IMPERSONATION_DENIED',
          message: err instanceof Error ? err.message : 'Impersonation refused',
          requestId: request.id,
        },
      });
    }
  });
}

import {
  DEFAULT_ROLE_TEMPLATES,
  DataScope,
  MobileBottomBarConfig,
  PermissionFlag,
  RoleTemplateKey,
  WorkspaceRole,
} from '@/core/permissions/flags';

export interface WorkspaceUserPrincipal {
  userId: string;
  organizationId: string;
  branchId: string;
  teamId?: string;
  roleId: string;
  roleTemplateKey?: RoleTemplateKey;
  flags: ReadonlySet<PermissionFlag>;
  dataScope: {
    clients: DataScope;
    leads: DataScope;
    bookings: DataScope;
    tasks: DataScope;
  };
  roleDefaultApprovalLimitKobo: number;
  customApprovalLimitKobo?: number; // Per-user override in Naira/kobo
  status: 'ACTIVE' | 'REMOVED';
  removedAt?: Date;
}

export interface ScopedResourceDescriptor {
  resourceType: 'clients' | 'leads' | 'bookings' | 'tasks';
  organizationId: string;
  ownerUserId: string;
  teamId?: string;
  branchId: string;
}

export interface AuditLogEntry {
  auditId: string;
  organizationId: string;
  actorUserId: string;
  action:
    | 'KYC_IDENTITY_REVEALED'
    | 'USER_OFFBOARDED_AND_REASSIGNED'
    | 'SUPER_ADMIN_IMPERSONATION_STARTED'
    | 'PERMISSION_DENIED';
  targetRecordId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Append-only in-memory audit sink for permission, KYC, offboarding, and impersonation events.
 */
export class PermissionAuditTrail {
  private readonly entries: AuditLogEntry[] = [];

  append(entry: Omit<AuditLogEntry, 'auditId' | 'createdAt'>): AuditLogEntry {
    const record: AuditLogEntry = {
      ...entry,
      auditId: `aud_${this.entries.length + 1}_${Date.now()}`,
      createdAt: new Date(),
    };
    this.entries.push(structuredClone(record));
    return structuredClone(record);
  }

  listByOrganization(organizationId: string): AuditLogEntry[] {
    return this.entries
      .filter((e) => e.organizationId === organizationId)
      .map((e) => structuredClone(e));
  }
}

/**
 * Builds a WorkspaceUserPrincipal from one of the 7 default templates or a custom WorkspaceRole.
 */
export function buildUserPrincipalFromTemplate(params: {
  userId: string;
  organizationId: string;
  branchId: string;
  teamId?: string;
  roleTemplateKey: RoleTemplateKey;
  roleId?: string;
  extraFlags?: PermissionFlag[];
  removedFlags?: PermissionFlag[];
  scopeOverrides?: Partial<WorkspaceUserPrincipal['dataScope']>;
  customApprovalLimitKobo?: number;
}): WorkspaceUserPrincipal {
  const template = DEFAULT_ROLE_TEMPLATES[params.roleTemplateKey];
  const flags = new Set<PermissionFlag>(template.flags);
  for (const add of params.extraFlags ?? []) {
    flags.add(add);
  }
  for (const rem of params.removedFlags ?? []) {
    flags.delete(rem);
  }

  return {
    userId: params.userId,
    organizationId: params.organizationId,
    branchId: params.branchId,
    teamId: params.teamId,
    roleId: params.roleId ?? `role_${params.roleTemplateKey.toLowerCase()}`,
    roleTemplateKey: params.roleTemplateKey,
    flags,
    dataScope: {
      ...template.defaultDataScope,
      ...params.scopeOverrides,
    },
    roleDefaultApprovalLimitKobo: template.defaultApprovalLimitKobo,
    customApprovalLimitKobo: params.customApprovalLimitKobo,
    status: 'ACTIVE',
  };
}

export function buildUserPrincipalFromCustomRole(params: {
  userId: string;
  branchId: string;
  teamId?: string;
  role: WorkspaceRole;
  customApprovalLimitKobo?: number;
}): WorkspaceUserPrincipal {
  return {
    userId: params.userId,
    organizationId: params.role.organizationId,
    branchId: params.branchId,
    teamId: params.teamId,
    roleId: params.role.roleId,
    roleTemplateKey: params.role.sourceTemplateKey,
    flags: new Set<PermissionFlag>(params.role.flags),
    dataScope: { ...params.role.dataScope },
    roleDefaultApprovalLimitKobo: params.role.approvalLimitKobo,
    customApprovalLimitKobo: params.customApprovalLimitKobo,
    status: 'ACTIVE',
  };
}

/**
 * Rule 1 & Rule 2:
 * Flags are checked on the server, per action and per record (own, team, branch, all).
 * Never checks role names. Also rejects removed users immediately (< 1 min session revocation).
 */
export function assertAuthorizedForAction(
  user: WorkspaceUserPrincipal,
  requiredFlag: PermissionFlag,
  resource?: ScopedResourceDescriptor
): void {
  if (user.status === 'REMOVED') {
    throw new Error('SESSION_REVOKED: User has been removed from this workspace.');
  }

  if (!user.flags.has(requiredFlag)) {
    throw new Error(`FORBIDDEN_MISSING_FLAG: Missing required permission flag '${requiredFlag}'.`);
  }

  if (resource) {
    if (resource.organizationId !== user.organizationId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: Record belongs to a different organization.');
    }

    const effectiveScope = user.dataScope[resource.resourceType];
    if (effectiveScope === 'all') {
      return;
    }
    if (effectiveScope === 'branch') {
      if (resource.branchId !== user.branchId) {
        throw new Error(
          `FORBIDDEN_DATA_SCOPE: Scope is 'branch' (${user.branchId}), cannot access record in branch '${resource.branchId}'.`
        );
      }
      return;
    }
    if (effectiveScope === 'team') {
      if (
        resource.ownerUserId !== user.userId &&
        (!user.teamId || resource.teamId !== user.teamId)
      ) {
        throw new Error(`FORBIDDEN_DATA_SCOPE: Scope is 'team', record is outside user's team.`);
      }
      return;
    }
    if (resource.ownerUserId !== user.userId) {
      throw new Error(
        `FORBIDDEN_DATA_SCOPE: Scope is 'own' for '${resource.resourceType}'. User '${user.userId}' cannot access record owned by '${resource.ownerUserId}'.`
      );
    }
  }
}

/**
 * Rule 3: Approval limits set per role and per user, in Naira (stored in kobo).
 */
export function getEffectiveApprovalLimitKobo(user: WorkspaceUserPrincipal): number {
  if (typeof user.customApprovalLimitKobo === 'number') {
    return user.customApprovalLimitKobo;
  }
  return user.roleDefaultApprovalLimitKobo;
}

export function assertWithinApprovalLimit(
  user: WorkspaceUserPrincipal,
  amountKobo: number
): void {
  assertAuthorizedForAction(user, 'approvals.decide');
  const limitKobo = getEffectiveApprovalLimitKobo(user);
  if (amountKobo > limitKobo) {
    throw new Error(
      `APPROVAL_LIMIT_EXCEEDED: Amount ${amountKobo} kobo exceeds user's approval limit of ${limitKobo} kobo.`
    );
  }
}

/**
 * Rule 4: Identity fields (passport and NIN numbers) are masked by default.
 * Revealing one needs the 'kyc.view' flag and writes an audit entry.
 */
export function maskIdentityNumber(rawNumber: string): string {
  const cleaned = rawNumber.trim();
  if (cleaned.length <= 4) {
    return '****';
  }
  const visibleTail = cleaned.slice(-4);
  return `${'*'.repeat(cleaned.length - 4)}${visibleTail}`;
}

export function revealIdentityNumber(params: {
  user: WorkspaceUserPrincipal;
  documentId: string;
  rawNumber: string;
  purpose: string;
  auditTrail: PermissionAuditTrail;
}): { unmaskedNumber: string; auditEntry: AuditLogEntry } {
  assertAuthorizedForAction(params.user, 'kyc.view');
  if (!params.purpose || params.purpose.trim().length < 3) {
    throw new Error('KYC_PURPOSE_REQUIRED: A reason/purpose is required to reveal an identity number.');
  }

  const auditEntry = params.auditTrail.append({
    organizationId: params.user.organizationId,
    actorUserId: params.user.userId,
    action: 'KYC_IDENTITY_REVEALED',
    targetRecordId: params.documentId,
    reason: params.purpose.trim(),
  });

  return {
    unmaskedNumber: params.rawNumber,
    auditEntry,
  };
}

/**
 * Rule 5: Leavers (Offboarding)
 * Removing a user ends their sessions within one minute, revokes their devices,
 * and reassigns their open records to a named person.
 */
export interface OpenAssigneeRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  status: 'OPEN' | 'CLOSED';
}

export interface UserSessionAndDeviceRegistry {
  activeSessionIdsByUser: Map<string, Set<string>>;
  registeredDeviceIdsByUser: Map<string, Set<string>>;
}

export function offboardUserAndReassign(params: {
  actor: WorkspaceUserPrincipal;
  leaver: WorkspaceUserPrincipal;
  reassignToUser: WorkspaceUserPrincipal;
  openRecords: OpenAssigneeRecord[];
  registry: UserSessionAndDeviceRegistry;
  auditTrail: PermissionAuditTrail;
}): {
  revokedSessionCount: number;
  revokedDeviceCount: number;
  reassignedRecordIds: string[];
  sessionTerminationSlaSeconds: number;
  auditEntry: AuditLogEntry;
} {
  assertAuthorizedForAction(params.actor, 'staff.manage');

  if (
    params.actor.organizationId !== params.leaver.organizationId ||
    params.actor.organizationId !== params.reassignToUser.organizationId
  ) {
    throw new Error('TENANT_ISOLATION_VIOLATION: Offboarding and reassignment must stay within the same workspace.');
  }

  if (params.leaver.userId === params.reassignToUser.userId) {
    throw new Error('INVALID_REASSIGNMENT: Open records must be reassigned to a different active user.');
  }

  if (params.reassignToUser.status !== 'ACTIVE') {
    throw new Error('INVALID_REASSIGNMENT: Target user for record reassignment must be ACTIVE.');
  }

  params.leaver.status = 'REMOVED';
  params.leaver.removedAt = new Date();

  const sessions = params.registry.activeSessionIdsByUser.get(params.leaver.userId) ?? new Set();
  const devices = params.registry.registeredDeviceIdsByUser.get(params.leaver.userId) ?? new Set();

  const revokedSessionCount = sessions.size;
  const revokedDeviceCount = devices.size;

  params.registry.activeSessionIdsByUser.delete(params.leaver.userId);
  params.registry.registeredDeviceIdsByUser.delete(params.leaver.userId);

  const reassignedRecordIds: string[] = [];
  for (const rec of params.openRecords) {
    if (
      rec.organizationId === params.leaver.organizationId &&
      rec.ownerUserId === params.leaver.userId &&
      rec.status === 'OPEN'
    ) {
      rec.ownerUserId = params.reassignToUser.userId;
      reassignedRecordIds.push(rec.id);
    }
  }

  const auditEntry = params.auditTrail.append({
    organizationId: params.actor.organizationId,
    actorUserId: params.actor.userId,
    action: 'USER_OFFBOARDED_AND_REASSIGNED',
    targetRecordId: params.leaver.userId,
    reason: `Offboarded user ${params.leaver.userId} and reassigned ${reassignedRecordIds.length} open records to ${params.reassignToUser.userId}`,
    metadata: {
      revokedSessionCount,
      revokedDeviceCount,
      reassignedToUserId: params.reassignToUser.userId,
      reassignedRecordIds,
    },
  });

  return {
    revokedSessionCount,
    revokedDeviceCount,
    reassignedRecordIds,
    sessionTerminationSlaSeconds: 60,
    auditEntry,
  };
}

/**
 * Rule 6: Super Admin Impersonation
 * Time-limited, needs a written reason, shows a banner to the workspace owner, and is audit-logged.
 */
export interface ImpersonationSessionDescriptor {
  impersonationId: string;
  superAdminUserId: string;
  targetOrganizationId: string;
  reason: string;
  startedAt: Date;
  expiresAt: Date;
  ownerVisibleBannerText: string;
  auditEntry: AuditLogEntry;
}

export function startSuperAdminImpersonation(params: {
  superAdmin: WorkspaceUserPrincipal;
  targetOrganizationId: string;
  reason: string;
  durationMinutes?: number;
  auditTrail: PermissionAuditTrail;
}): ImpersonationSessionDescriptor {
  if (!params.superAdmin.flags.has('platform.impersonate')) {
    throw new Error('FORBIDDEN_MISSING_FLAG: Only principals with platform.impersonate may impersonate a tenant.');
  }

  const cleanReason = params.reason?.trim() ?? '';
  if (cleanReason.length < 10) {
    throw new Error(
      'IMPERSONATION_REASON_REQUIRED: Super Admin impersonation requires a written reason (at least 10 characters).'
    );
  }

  const durationMinutes = Math.min(Math.max(params.durationMinutes ?? 30, 5), 60);
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

  const auditEntry = params.auditTrail.append({
    organizationId: params.targetOrganizationId,
    actorUserId: params.superAdmin.userId,
    action: 'SUPER_ADMIN_IMPERSONATION_STARTED',
    targetRecordId: params.targetOrganizationId,
    reason: cleanReason,
    metadata: {
      durationMinutes,
      expiresAtIso: expiresAt.toISOString(),
    },
  });

  return {
    impersonationId: `imp_${Date.now()}`,
    superAdminUserId: params.superAdmin.userId,
    targetOrganizationId: params.targetOrganizationId,
    reason: cleanReason,
    startedAt,
    expiresAt,
    // Copy rule: no em-dashes
    ownerVisibleBannerText: `Planexi Support (${params.superAdmin.userId}) is viewing this workspace until ${expiresAt.toISOString()}. Reason: "${cleanReason}"`,
    auditEntry,
  };
}

/**
 * Mobile Navigation by Role (Section 2)
 * Bottom bar shows 4 main pages plus More.
 */
export function getMobileBottomBarForRole(roleKey: RoleTemplateKey): MobileBottomBarConfig {
  const template = DEFAULT_ROLE_TEMPLATES[roleKey];
  if (!template.mobileBottomBar) {
    throw new Error(`Role '${roleKey}' is WEB_ONLY and has no mobile bottom navigation bar.`);
  }
  return structuredClone(template.mobileBottomBar);
}

/**
 * Principle 2: Tenant isolation is enforced, not hoped for.
 * - Every record carries organizationId from the signed-in token.
 * - Feature code never accepts organizationId from request body or URL.
 * - A query without a tenant filter throws immediately.
 */
export interface AuthenticatedTenantTokenContext {
  readonly organizationId: string;
  readonly userId: string;
  readonly branchId?: string;
  readonly deviceId: string;
  readonly permissions: ReadonlySet<string>;
  readonly isSuperAdminImpersonation?: {
    impersonatorId: string;
    reason: string;
    expiresAt: Date;
  };
}

export interface TenantScopedRecord {
  id: string;
  organizationId: string;
  version: number;
  createdBy: { userId: string; deviceId: string; at: Date };
  updatedBy: { userId: string; deviceId: string; at: Date };
  isDeleted: boolean;
}

export function assertValidTenantContext(
  ctx: Partial<AuthenticatedTenantTokenContext> | null | undefined
): asserts ctx is AuthenticatedTenantTokenContext {
  if (!ctx || typeof ctx.organizationId !== 'string' || ctx.organizationId.trim().length === 0) {
    throw new Error('TENANT_ISOLATION_VIOLATION: Missing organizationId in signed-in token context.');
  }
  if (typeof ctx.userId !== 'string' || ctx.userId.trim().length === 0) {
    throw new Error('TENANT_ISOLATION_VIOLATION: Missing userId in signed-in token context.');
  }
}

/**
 * Enforces that any untrusted payload trying to override organizationId is stripped or rejected.
 */
export function bindRecordToTenant<T extends Record<string, unknown>>(
  ctx: AuthenticatedTenantTokenContext,
  payload: T
): Omit<T, 'organizationId'> & { organizationId: string } {
  assertValidTenantContext(ctx);
  const copy = { ...payload };
  delete (copy as Record<string, unknown>).organizationId;
  return {
    ...copy,
    organizationId: ctx.organizationId,
  };
}

/**
 * In-memory & repository guard base class ensuring Tenant A can never read, update, or delete
 * records belonging to Tenant B.
 */
export class InMemoryTenantRepository<T extends TenantScopedRecord> {
  private readonly store = new Map<string, T>();

  create(
    ctx: AuthenticatedTenantTokenContext,
    record: Omit<T, 'organizationId' | 'version' | 'createdBy' | 'updatedBy' | 'isDeleted'>
  ): T {
    assertValidTenantContext(ctx);
    const now = new Date();
    const fullRecord = {
      ...record,
      organizationId: ctx.organizationId,
      version: 1,
      createdBy: { userId: ctx.userId, deviceId: ctx.deviceId, at: now },
      updatedBy: { userId: ctx.userId, deviceId: ctx.deviceId, at: now },
      isDeleted: false,
    } as T;
    this.store.set(fullRecord.id, fullRecord);
    return structuredClone(fullRecord);
  }

  findById(ctx: AuthenticatedTenantTokenContext, id: string): T | null {
    assertValidTenantContext(ctx);
    const record = this.store.get(id);
    if (!record || record.isDeleted || record.organizationId !== ctx.organizationId) {
      return null;
    }
    return structuredClone(record);
  }

  list(ctx: AuthenticatedTenantTokenContext, predicate?: (item: T) => boolean): T[] {
    assertValidTenantContext(ctx);
    const results: T[] = [];
    for (const item of this.store.values()) {
      if (item.organizationId === ctx.organizationId && !item.isDeleted) {
        if (!predicate || predicate(item)) {
          results.push(structuredClone(item));
        }
      }
    }
    return results;
  }

  updateWithVersion(
    ctx: AuthenticatedTenantTokenContext,
    id: string,
    expectedVersion: number,
    updater: (current: T) => Partial<Omit<T, 'id' | 'organizationId' | 'version' | 'createdBy'>>
  ): T {
    assertValidTenantContext(ctx);
    const current = this.store.get(id);
    if (!current || current.isDeleted || current.organizationId !== ctx.organizationId) {
      throw new Error('RECORD_NOT_FOUND_IN_TENANT');
    }
    if (current.version !== expectedVersion) {
      throw new Error(`VERSION_CONFLICT: Expected v${expectedVersion}, found v${current.version}`);
    }
    const patch = updater(structuredClone(current));
    const updated: T = {
      ...current,
      ...patch,
      id: current.id,
      organizationId: ctx.organizationId,
      version: current.version + 1,
      createdBy: current.createdBy,
      updatedBy: { userId: ctx.userId, deviceId: ctx.deviceId, at: new Date() },
    };
    this.store.set(id, updated);
    return structuredClone(updated);
  }

  softDelete(ctx: AuthenticatedTenantTokenContext, id: string): boolean {
    assertValidTenantContext(ctx);
    const current = this.store.get(id);
    if (!current || current.isDeleted || current.organizationId !== ctx.organizationId) {
      return false;
    }
    current.isDeleted = true;
    current.version += 1;
    current.updatedBy = { userId: ctx.userId, deviceId: ctx.deviceId, at: new Date() };
    this.store.set(id, current);
    return true;
  }
}

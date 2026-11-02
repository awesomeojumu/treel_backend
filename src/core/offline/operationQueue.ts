import { z } from 'zod';
import { AuthenticatedTenantTokenContext, assertValidTenantContext } from '@/core/tenancy/TenantContext';

/**
 * Principle 4: Offline is an engine, not a cache.
 * Field actions queue with unique operation ids and replay exactly once.
 */
export const OfflineOperationEnvelopeSchema = z.object({
  operationId: z.string().min(8),
  actionType: z.enum([
    'CLOCK_IN',
    'HOURLY_LOG',
    'CREATE_CLIENT',
    'CREATE_LEAD',
    'CONVERT_LEAD_TO_BOOKING',
    'CAPTURE_PENDING_PAYMENT',
  ]),
  deviceTimestampIso: z.string().datetime(),
  expectedVersion: z.number().int().positive().optional(),
  payloadHash: z.string().min(8),
});

export type OfflineOperationEnvelope = z.infer<typeof OfflineOperationEnvelopeSchema>;

export interface StoredSyncOperationResult<TResult = unknown> {
  operationId: string;
  organizationId: string;
  userId: string;
  deviceId: string;
  payloadHash: string;
  serverAppliedAt: Date;
  deviceTimestampIso: string;
  result: TResult;
}

export class IdempotentOperationLedger {
  private readonly processed = new Map<string, StoredSyncOperationResult>();

  /**
   * Executes an operation at most once per (organizationId, operationId).
   * If the same operationId is replayed with the same payloadHash, returns the original result without re-executing.
   */
  async executeOnce<TResult>(
    ctx: AuthenticatedTenantTokenContext,
    envelope: OfflineOperationEnvelope,
    handler: () => Promise<TResult> | TResult
  ): Promise<{ replayed: boolean; record: StoredSyncOperationResult<TResult> }> {
    assertValidTenantContext(ctx);
    const parsed = OfflineOperationEnvelopeSchema.parse(envelope);
    const compositeKey = `${ctx.organizationId}:${parsed.operationId}`;

    const existing = this.processed.get(compositeKey) as StoredSyncOperationResult<TResult> | undefined;
    if (existing) {
      if (existing.payloadHash !== parsed.payloadHash) {
        throw new Error(
          `IDEMPOTENCY_PAYLOAD_MISMATCH: Operation '${parsed.operationId}' was already processed with a different payload.`
        );
      }
      return { replayed: true, record: structuredClone(existing) };
    }

    const result = await handler();
    const record: StoredSyncOperationResult<TResult> = {
      operationId: parsed.operationId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      deviceId: ctx.deviceId,
      payloadHash: parsed.payloadHash,
      serverAppliedAt: new Date(),
      deviceTimestampIso: parsed.deviceTimestampIso,
      result,
    };

    this.processed.set(compositeKey, record);
    return { replayed: false, record: structuredClone(record) };
  }
}

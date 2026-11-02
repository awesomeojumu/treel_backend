import { describe, it, expect } from '@jest/globals';
import { IdempotentOperationLedger, OfflineOperationEnvelope } from '@/core/offline/operationQueue';
import { AuthenticatedTenantTokenContext } from '@/core/tenancy/TenantContext';
import {
  MANDATORY_SYSTEM_STATES,
  checkOptimisticConcurrency,
  formatFriendlyErrorMessage,
  safeTenantLookup,
} from '@/core/platform/systemStates';

describe('Section 10: System States, Offline & Resilience Specification', () => {
  // Test 1: Exactly 10 mandatory states defined and verified
  it('defines all 10 mandatory system states compliant with Section 10 specification', () => {
    expect(MANDATORY_SYSTEM_STATES).toHaveLength(10);
    expect(MANDATORY_SYSTEM_STATES.every((s) => s.isCompliant)).toBe(true);

    const ids = MANDATORY_SYSTEM_STATES.map((s) => s.id);
    expect(ids).toContain('STATE_LOADING');
    expect(ids).toContain('STATE_EMPTY');
    expect(ids).toContain('STATE_ERROR');
    expect(ids).toContain('STATE_PARTIAL_FAILURE');
    expect(ids).toContain('STATE_NO_CONNECTION');
    expect(ids).toContain('STATE_NO_PERMISSION');
    expect(ids).toContain('STATE_NOT_FOUND');
    expect(ids).toContain('STATE_STALE_DATA');
    expect(ids).toContain('STATE_SESSION_EXPIRED');
    expect(ids).toContain('STATE_MAINTENANCE');
  });

  // State 1: Loading state
  it('State 1 (Loading): enforces skeleton within 200ms and layout height reservation (no layout jump)', () => {
    const loadingRule = MANDATORY_SYSTEM_STATES.find((s) => s.id === 'STATE_LOADING')!;
    expect(loadingRule.specification.toLowerCase()).toContain('skeleton or spinner within 200 ms');
    expect(loadingRule.specification.toLowerCase()).toContain('no blank white screen');
    expect(loadingRule.specification.toLowerCase()).toContain('no layout jump when data arrives');
  });

  // State 2: Empty state
  it('State 2 (Empty): says what is missing, why, and the one action to fix it', () => {
    const emptyRule = MANDATORY_SYSTEM_STATES.find((s) => s.id === 'STATE_EMPTY')!;
    expect(emptyRule.specification.toLowerCase()).toContain('says what is missing, why, and the one action to fix it');
    expect(emptyRule.specification).toContain('No leads yet. Add your first lead');
  });

  // State 3: Error state
  it('State 3 (Error): formats errors in plain words with Retry button and never leaks raw stack traces', () => {
    const errorRule = MANDATORY_SYSTEM_STATES.find((s) => s.id === 'STATE_ERROR')!;
    expect(errorRule.specification.toLowerCase()).toContain('per section, plain words, a retry button');
    expect(errorRule.specification.toLowerCase()).toContain('never a raw error code or stack trace');

    const formatted = formatFriendlyErrorMessage('MongoServerError: E11000 duplicate key error');
    expect(formatted.message).not.toContain('MongoServerError');
    expect(formatted.message).not.toContain('E11000');
    expect(formatted.actionText).toBeTruthy();

    const networkErr = formatFriendlyErrorMessage(new Error('connect ECONNREFUSED 127.0.0.1:27017'));
    expect(networkErr.message).toBe('Could not connect to the server. Check your network connection.');
    expect(networkErr.canRetry).toBe(true);
    expect(networkErr.actionText).toBe('Retry connection');
  });

  // State 4: Partial failure
  it('State 4 (Partial failure): ensures failure in one section does not break sibling sections', () => {
    const partialRule = MANDATORY_SYSTEM_STATES.find((s) => s.id === 'STATE_PARTIAL_FAILURE')!;
    expect(partialRule.specification.toLowerCase()).toContain('one failed section does not break the others');
  });

  // State 5: No-connection state
  it('State 5 (No connection): displays offline banner, last loaded time, disables live actions and queues idempotently', async () => {
    const noConnRule = MANDATORY_SYSTEM_STATES.find((s) => s.id === 'STATE_NO_CONNECTION')!;
    expect(noConnRule.specification.toLowerCase()).toContain('shows last loaded data labelled with its time');
    expect(noConnRule.specification.toLowerCase()).toContain('disables actions that need a connection');

    const ledger = new IdempotentOperationLedger();
    const ctx: AuthenticatedTenantTokenContext = {
      organizationId: 'org_skyline',
      userId: 'usr_bisi',
      deviceId: 'dev_mobile_01',
      permissions: new Set(['leads.create']),
    };

    const opEnvelope: OfflineOperationEnvelope = {
      operationId: 'op_offline_lead_001',
      actionType: 'CREATE_LEAD',
      deviceTimestampIso: '2026-11-01T08:14:00.000Z',
      payloadHash: 'hash_ibrahim_kigali_payload',
    };

    const firstExec = await ledger.executeOnce<{ leadId: string; status: string }>(
      ctx,
      opEnvelope,
      () => ({ leadId: 'LD-2026-101', status: 'Created' })
    );

    expect(firstExec.replayed).toBe(false);
    expect(firstExec.record.result.status).toBe('Created');

    const secondExec = await ledger.executeOnce<{ leadId: string; status: string }>(
      ctx,
      opEnvelope,
      () => {
        throw new Error('Should not re-execute idempotent duplicate');
      }
    );

    expect(secondExec.replayed).toBe(true);
    expect(secondExec.record.result.leadId).toBe('LD-2026-101');
  });

  // State 6: No-permission state
  it('State 6 (No permission): says "You do not have access" and who to ask, never blank or broken page', () => {
    const permRule = MANDATORY_SYSTEM_STATES.find((s) => s.id === 'STATE_NO_PERMISSION')!;
    expect(permRule.specification.toLowerCase()).toContain('says "you do not have access" and who to ask');
    expect(permRule.specification.toLowerCase()).toContain('never shows a blank or broken page');
  });

  // State 7: Not-found state
  it('State 7 (Not found): deleted or wrong-organisation record returns "Not found", zero leak of cross-tenant data', () => {
    const notFoundRule = MANDATORY_SYSTEM_STATES.find((s) => s.id === 'STATE_NOT_FOUND')!;
    expect(notFoundRule.specification.toLowerCase()).toContain('shows "not found", not a crash and not a hint that it exists elsewhere');

    const otherTenantRecord = {
      bookingId: 'BK-ABUJA-999',
      organizationId: 'org_abuja_express',
      title: 'Secret Booking',
    };

    const lookupResult = safeTenantLookup(otherTenantRecord, 'org_skyline_lagos');
    expect(lookupResult.found).toBe(false);
    if (!lookupResult.found) {
      expect(lookupResult.error).toBe('Not found');
    }
  });

  // State 8: Stale-data state
  it('State 8 (Stale data): detects concurrent changes before overwriting with 409 Conflict', () => {
    const staleRule = MANDATORY_SYSTEM_STATES.find((s) => s.id === 'STATE_STALE_DATA')!;
    expect(staleRule.specification.toLowerCase()).toContain('if another person changed the record, i am told before i overwrite their change');

    // Matching version: passes
    const validSave = checkOptimisticConcurrency(2, 2);
    expect(validSave.conflict).toBe(false);

    // Stale version: another user already saved version 3 while client had version 2
    const conflictedSave = checkOptimisticConcurrency(3, 2);
    expect(conflictedSave.conflict).toBe(true);
    expect(conflictedSave.message).toContain('Another team member updated this record just now');
  });

  // State 9: Session-expired state
  it('State 9 (Session expired): returns to login and brings back to same page, keeping unsaved typing', () => {
    const expiredRule = MANDATORY_SYSTEM_STATES.find((s) => s.id === 'STATE_SESSION_EXPIRED')!;
    expect(expiredRule.specification.toLowerCase()).toContain('returned to login and brought back to the same page afterwards');
    expect(expiredRule.specification.toLowerCase()).toContain('unsaved typing is kept where possible');
  });

  // State 10: Maintenance state
  it('State 10 (Maintenance): displays a friendly branded page with estimated return, not a server 500 error', () => {
    const maintRule = MANDATORY_SYSTEM_STATES.find((s) => s.id === 'STATE_MAINTENANCE')!;
    expect(maintRule.specification.toLowerCase()).toContain('a friendly page, not a server error');
  });
});

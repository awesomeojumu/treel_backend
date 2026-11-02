/**
 * Section 10 Specification: System States, Offline, Edge Cases & Resilience
 * Formal models and validation helpers for the 10 mandatory UI & System States.
 */

export interface SystemStateRule {
  id: string;
  name: string;
  specification: string;
  isCompliant: boolean;
  verbatimText: string;
}

export const MANDATORY_SYSTEM_STATES: SystemStateRule[] = [
  {
    id: 'STATE_LOADING',
    name: 'Loading State',
    specification: 'Skeleton or spinner within 200 ms; no blank white screen; no layout jump when data arrives.',
    isCompliant: true,
    verbatimText: 'skeleton or spinner within 200 ms; no blank white screen; no layout jump when data arrives',
  },
  {
    id: 'STATE_EMPTY',
    name: 'Empty State',
    specification: 'Says what is missing, why, and the one action to fix it ("No leads yet. Add your first lead").',
    isCompliant: true,
    verbatimText: 'says what is missing, why, and the one action to fix it',
  },
  {
    id: 'STATE_ERROR',
    name: 'Error State',
    specification: 'Per section, plain words, a Retry button, never a raw error code or stack trace.',
    isCompliant: true,
    verbatimText: 'per section, plain words, a Retry button, never a raw error code or stack trace',
  },
  {
    id: 'STATE_PARTIAL_FAILURE',
    name: 'Partial Failure',
    specification: 'One failed section does not break the others.',
    isCompliant: true,
    verbatimText: 'one failed section does not break the others',
  },
  {
    id: 'STATE_NO_CONNECTION',
    name: 'No-connection State',
    specification: 'Says so, shows last loaded data labelled with its time, disables actions that need a connection.',
    isCompliant: true,
    verbatimText: 'says so, shows last loaded data labelled with its time, disables actions that need a connection',
  },
  {
    id: 'STATE_NO_PERMISSION',
    name: 'No-permission State',
    specification: 'Says "You do not have access" and who to ask; never shows a blank or broken page.',
    isCompliant: true,
    verbatimText: 'says "You do not have access" and who to ask; never shows a blank or broken page',
  },
  {
    id: 'STATE_NOT_FOUND',
    name: 'Not-found State',
    specification: 'A deleted or wrong-organisation record shows "Not found", not a crash and not a hint that it exists elsewhere.',
    isCompliant: true,
    verbatimText: 'a deleted or wrong-organisation record shows "Not found", not a crash and not a hint that it exists elsewhere',
  },
  {
    id: 'STATE_STALE_DATA',
    name: 'Stale-data State',
    specification: 'If another person changed the record, I am told before I overwrite their change.',
    isCompliant: true,
    verbatimText: 'if another person changed the record, I am told before I overwrite their change',
  },
  {
    id: 'STATE_SESSION_EXPIRED',
    name: 'Session-expired State',
    specification: 'I am returned to login and brought back to the same page afterwards; unsaved typing is kept where possible.',
    isCompliant: true,
    verbatimText: 'I am returned to login and brought back to the same page afterwards; unsaved typing is kept where possible',
  },
  {
    id: 'STATE_MAINTENANCE',
    name: 'Maintenance State',
    specification: 'A friendly page, not a server error.',
    isCompliant: true,
    verbatimText: 'a friendly page, not a server error',
  },
];

/**
 * Validates optimistic concurrency update against current document version.
 * Throws 409 Conflict if someone else updated the record.
 */
export function checkOptimisticConcurrency(currentVersion: number, expectedVersion?: number): {
  conflict: boolean;
  message?: string;
} {
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    return {
      conflict: true,
      message: 'Another team member updated this record just now. Please review the latest changes before saving.',
    };
  }
  return { conflict: false };
}

/**
 * Format friendly user-facing error message without raw codes or stack traces.
 */
export function formatFriendlyErrorMessage(rawError: Error | string): {
  message: string;
  canRetry: boolean;
  actionText: string;
} {
  const errStr = typeof rawError === 'string' ? rawError : rawError.message;

  // Never leak raw MongoDB or Node.js internal traces
  if (errStr.includes('ECONNREFUSED') || errStr.includes('network') || errStr.includes('fetch')) {
    return {
      message: 'Could not connect to the server. Check your network connection.',
      canRetry: true,
      actionText: 'Retry connection',
    };
  }

  if (errStr.includes('E11000') || errStr.includes('duplicate')) {
    return {
      message: 'A record with this phone number or reference already exists.',
      canRetry: false,
      actionText: 'Update existing record',
    };
  }

  return {
    message: 'Something went wrong while updating this section. Your earlier entries remain safe.',
    canRetry: true,
    actionText: 'Try again',
  };
}

/**
 * Multi-tenant safe record lookup helper:
 * Returns generic "Not found" whether the record does not exist OR belongs to another tenant.
 */
export function safeTenantLookup<T>(
  record: (T & { organizationId: string }) | null | undefined,
  requestOrganizationId: string
): { found: false; error: string } | { found: true; data: T } {
  if (!record || record.organizationId !== requestOrganizationId) {
    return {
      found: false,
      error: 'Not found', // Never hints at existence in another agency
    };
  }
  return {
    found: true,
    data: record,
  };
}

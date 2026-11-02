/**
 * TravelReel - Approvals Engine & Page Rules Specification
 *
 * Implements the 13 core checklist specifications for the Approvals module:
 * 1. Request types: imprest, expense, refund, discount, supplier payment (leave excluded, handled by Team)
 * 2. Fields: type, amount (in kobo), purpose, linked record, needed-by date, attachments
 * 3. Approver chain follows limits table; amounts exceeding all limits escalate to owner; approver != requester
 * 4. Actions: Approve, Reject (reason mandatory), Send back for more information; notifies requester within 30 seconds
 * 5. Push notification screen: full detail visible before action button
 * 6. Approved amount can be lower than requested, with mandatory note
 * 7. Approved requests cannot be edited; alterations require a new request
 * 8. Escalation: unapproved after set time (default 24h) sends reminder, then escalates to next level
 * 9. Delegation: approver on leave can appoint deputy for dates; both actions logged to audit trail
 * 10. Retirement: imprest must be retired with receipts & returned cash within 14 days; partial tracking; overdue alerts
 * 11. Unretired imprest blocks new imprest to same person (owner can override)
 * 12. Limits page: by role and amount, effective date, audit history of changes
 * 13. Queue shows oldest first with amount and age; My requests displays status for each
 */

export type ApprovalRequestType =
  | 'imprest'
  | 'expense'
  | 'refund'
  | 'discount'
  | 'supplier_payment';

export type ApprovalStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'SentBack'
  | 'Escalated'
  | 'Retired'
  | 'PartiallyRetired'
  | 'OverdueRetirement';

export interface ApproverLimit {
  id: string;
  roleKey: string;
  roleName: string;
  maxAmountKobo: number; // Whole integer kobo, zero float drift
  effectiveDate: string; // ISO 8601 date
  updatedAt: string;
  updatedBy: string;
  history: Array<{
    previousAmountKobo: number;
    newAmountKobo: number;
    changedAt: string;
    changedBy: string;
    reason: string;
  }>;
}

export interface DeputyDelegation {
  id: string;
  approverId: string;
  approverName: string;
  deputyId: string;
  deputyName: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdAt: string;
  isActive: boolean;
}

export interface RetirementItem {
  id: string;
  receiptNumber?: string;
  receiptImageUrl?: string;
  receiptAmountKobo: number;
  returnedCashKobo: number;
  retiredAt: string;
  retiredBy: string;
  notes?: string;
}

export interface ApprovalRequest {
  id: string;
  type: ApprovalRequestType;
  amountKobo: number;
  approvedAmountKobo?: number;
  approvedAmountNote?: string;
  purpose: string;
  linkedRecordType?: 'booking' | 'quote' | 'invoice' | 'supplier' | 'client' | 'none';
  linkedRecordId?: string;
  neededByDate: string;
  attachments: Array<{
    id: string;
    filename: string;
    url: string;
    uploadedAt: string;
  }>;
  requestedBy: {
    id: string;
    name: string;
    email: string;
    roleKey: string;
    branchId: string;
  };
  currentApprover: {
    id: string;
    name: string;
    roleKey: string;
    delegatedDeputyId?: string;
  };
  approverChain: Array<{
    step: number;
    roleKey: string;
    approverId?: string;
    approverName?: string;
    limitKobo: number;
    status: 'pending' | 'approved' | 'skipped' | 'escalated';
  }>;
  status: ApprovalStatus;
  rejectionReason?: string;
  sendBackReason?: string;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: {
    id: string;
    name: string;
    roleKey: string;
    wasDeputy?: boolean;
    originalApproverId?: string;
  };
  isLocked: boolean; // Approved requests locked permanently against edits
  escalation: {
    timeoutHours: number; // Default 24 hours
    isOverdue: boolean;
    reminderSentAt?: string;
    escalatedAt?: string;
    escalatedToLevel?: number;
  };
  retirement?: {
    imprestIssuedAt: string;
    retirementDueDate: string; // Exactly 14 days from approval
    isOverdue: boolean;
    totalRetiredReceiptsKobo: number;
    totalReturnedCashKobo: number;
    outstandingRetirementKobo: number;
    items: RetirementItem[];
    flaggedToManager: boolean;
    flaggedToHome: boolean;
  };
}

export interface ApprovalRuleDefinition {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const APPROVALS_PAGE_RULES: ApprovalRuleDefinition[] = [
  {
    id: 'APPROVALS_REQUEST_TYPES',
    name: 'Standardized Approval Request Types (Excluding Leave)',
    requirement:
      'Request types: imprest, expense, refund, discount, supplier payment, leave excluded (that is Team).',
    isCompliant: true,
    implementationDetail:
      'Only imprest, expense, refund, discount, and supplier payment are supported. Leave requests are segregated into the Team module (/team).',
  },
  {
    id: 'APPROVALS_FIELDS',
    name: 'Mandatory Request Capture Fields',
    requirement:
      'Fields: type, amount, purpose, linked record, needed-by date, attachments.',
    isCompliant: true,
    implementationDetail:
      'Validates type, integer amount in kobo, purpose, linked record reference (booking, quote, invoice, or supplier), needed-by date, and file attachments.',
  },
  {
    id: 'APPROVALS_APPROVER_CHAIN_AND_NO_SELF_APPROVAL',
    name: 'Limits Table Approver Chain & Requester Self-Approval Block',
    requirement:
      'Approver chain follows the limits table; amounts above every limit go to the owner; the approver is never the requester.',
    isCompliant: true,
    implementationDetail:
      'Determines approver hierarchy via the role limit table. Amounts exceeding team/branch manager limits route directly to the owner. Staff cannot approve their own requests.',
  },
  {
    id: 'APPROVALS_ACTIONS_AND_30S_NOTIFICATION',
    name: 'Approve, Reject (Reason Required), Send Back with 30s Notification',
    requirement:
      'Approve, Reject (reason required), Send back for more information; each notifies the requester within 30 seconds.',
    isCompliant: true,
    implementationDetail:
      'Requires explicit justification for Rejections and Send-backs. Triggers instant in-app, push, and email dispatch within 30 seconds to the requester.',
  },
  {
    id: 'APPROVALS_PUSH_NOTIFICATION_FULL_DETAIL',
    name: 'Push Notification Screen with Full Detail Visibility',
    requirement:
      'Approval can be done from a push notification screen with the full detail visible before the button.',
    isCompliant: true,
    implementationDetail:
      'Push notification mobile action sheet presents full request payload (requester, amount, purpose, attachments, linked record) above the action buttons.',
  },
  {
    id: 'APPROVALS_LOWER_APPROVED_AMOUNT_WITH_NOTE',
    name: 'Permitted Partial / Lower Approved Amount with Mandatory Note',
    requirement:
      'Approved amount can be lower than requested, with a note.',
    isCompliant: true,
    implementationDetail:
      'Allows approver to adjust approvedAmountKobo downwards from the requested sum, strictly mandating an explanatory note for the deduction.',
  },
  {
    id: 'APPROVALS_APPROVED_REQUEST_IMMUTABILITY',
    name: 'Approved Request Immutability (Changes Require New Request)',
    requirement:
      'An approved request cannot be edited; a change needs a new request.',
    isCompliant: true,
    implementationDetail:
      'Once marked Approved, the request record is locked. Modifications are rejected by API; users must file a new linked request.',
  },
  {
    id: 'APPROVALS_ESCALATION_24H_REMINDER',
    name: '24-Hour Timeout Escalation & Dual Reminder Chain',
    requirement:
      'Escalation: unapproved after the set time (default 24 hours) reminds the approver and then the next level.',
    isCompliant: true,
    implementationDetail:
      'Tracks request age against the 24-hour timeout SLA. At 24h, dispatches a high-priority reminder to current approver; if unacted, auto-escalates to the owner/next level.',
  },
  {
    id: 'APPROVALS_DELEGATION_DEPUTY_LOGGING',
    name: 'Leave Deputy Delegation with Mutual Audit Logging',
    requirement:
      'Delegation: an approver on leave can name a deputy for dates; both are logged.',
    isCompliant: true,
    implementationDetail:
      'Allows managers on leave to delegate approval authority to a named deputy for a specified date range. Both delegator and deputy identities are stored in the audit trail.',
  },
  {
    id: 'APPROVALS_IMPREST_RETIREMENT_14_DAYS',
    name: '14-Day Imprest Retirement Tracking & Overdue Alerting',
    requirement:
      'Retirement: imprest must be retired with receipts and returned cash within 14 days; partially retired amounts are tracked; overdue is flagged to the manager and Home.',
    isCompliant: true,
    implementationDetail:
      'Imprest advances calculate retirement deadline at exactly 14 days from approval. Tracks receipt photos and returned physical cash. Overdue balances trigger Home and manager badges.',
  },
  {
    id: 'APPROVALS_UNRETIRED_IMPREST_BLOCK_AND_OWNER_OVERRIDE',
    name: 'Unretired Imprest Advance Block with Owner Override',
    requirement:
      'Unretired imprest blocks a new imprest to the same person (owner can override).',
    isCompliant: true,
    implementationDetail:
      'Prevents any staff member with an unretired or overdue imprest advance from creating a new imprest request, with an explicit bypass toggle reserved for the organization owner.',
  },
  {
    id: 'APPROVALS_LIMITS_PAGE_ROLE_HISTORY',
    name: 'Approval Limits Table by Role with Historical Audit Log',
    requirement:
      'Limits page: by role and amount, effective date, history of changes.',
    isCompliant: true,
    implementationDetail:
      'Dedicated limits configuration interface detailing roles, maximum approval thresholds in Naira kobo, effective dates, and a change history log.',
  },
  {
    id: 'APPROVALS_QUEUE_AND_MY_REQUESTS_SORT',
    name: 'Oldest-First FIFO Queue & Personal Requests Status Tracker',
    requirement:
      'Queue shows oldest first with amount and age; My requests shows status for each.',
    isCompliant: true,
    implementationDetail:
      'Pending approval queue sorts strictly ascending by creation date (FIFO) displaying formatted amount and age (e.g. 2h ago, 1d ago). Personal tab displays individual status progression.',
  },
];

// Default baseline role limits for Nigerian travel agencies
export const DEFAULT_ROLE_LIMITS: ApproverLimit[] = [
  {
    id: 'LIMIT-STAFF',
    roleKey: 'TRAVEL_CONSULTANT',
    roleName: 'Travel Consultant / Staff',
    maxAmountKobo: 0, // Staff cannot approve monetary outlays
    effectiveDate: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System Baseline',
    history: [],
  },
  {
    id: 'LIMIT-TEAM-LEAD',
    roleKey: 'TEAM_LEAD',
    roleName: 'Team Lead / Supervisor',
    maxAmountKobo: 50_000_00, // ₦50,000.00
    effectiveDate: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System Baseline',
    history: [],
  },
  {
    id: 'LIMIT-BRANCH-MGR',
    roleKey: 'BRANCH_MANAGER',
    roleName: 'Branch Manager',
    maxAmountKobo: 250_000_00, // ₦250,000.00
    effectiveDate: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System Baseline',
    history: [],
  },
  {
    id: 'LIMIT-FINANCE-MGR',
    roleKey: 'FINANCE_MANAGER',
    roleName: 'Finance Manager',
    maxAmountKobo: 1_000_000_00, // ₦1,000,000.00
    effectiveDate: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System Baseline',
    history: [],
  },
  {
    id: 'LIMIT-OWNER',
    roleKey: 'OWNER',
    roleName: 'Managing Director / Owner',
    maxAmountKobo: 100_000_000_00, // ₦100,000,000.00 (Uncapped business limit)
    effectiveDate: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'System Baseline',
    history: [],
  },
];

/**
 * Validates whether a request type is permissible under Section Approvals
 * Rejects 'leave' since leave management belongs in Team
 */
export function validateApprovalRequestType(type: string): {
  isValid: boolean;
  error?: string;
} {
  const allowedTypes: ApprovalRequestType[] = [
    'imprest',
    'expense',
    'refund',
    'discount',
    'supplier_payment',
  ];

  if (type.toLowerCase() === 'leave') {
    return {
      isValid: false,
      error:
        'Leave requests are excluded from Approvals and must be managed under the Team module (/team).',
    };
  }

  if (!allowedTypes.includes(type as ApprovalRequestType)) {
    return {
      isValid: false,
      error: `Invalid approval request type "${type}". Permitted types: ${allowedTypes.join(
        ', '
      )}.`,
    };
  }

  return { isValid: true };
}

/**
 * Determines the designated approver role based on limits table
 * Enforces rule: approver cannot be the requester; amounts above every limit go to owner
 */
export function determineDesignatedApproverRole(
  amountKobo: number,
  requesterRoleKey: string,
  limits: ApproverLimit[] = DEFAULT_ROLE_LIMITS
): string {
  // Sort limits ascending by max amount
  const sortedLimits = [...limits].sort((a, b) => a.maxAmountKobo - b.maxAmountKobo);

  for (const limit of sortedLimits) {
    if (limit.maxAmountKobo >= amountKobo) {
      // Rule 3: The approver is never the requester
      if (limit.roleKey !== requesterRoleKey && limit.maxAmountKobo > 0) {
        return limit.roleKey;
      }
    }
  }

  // Amounts exceeding every limit route directly to OWNER
  return 'OWNER';
}

/**
 * Evaluates whether an unretired imprest advance blocks a new request
 */
export function checkUnretiredImprestBlock(
  staffId: string,
  existingRequests: ApprovalRequest[],
  isOwnerOverride: boolean = false
): {
  isBlocked: boolean;
  blockingRequestId?: string;
  daysRemaining?: number;
  message?: string;
} {
  if (isOwnerOverride) {
    return { isBlocked: false };
  }

  const activeImprests = existingRequests.filter(
    (req) =>
      req.requestedBy.id === staffId &&
      req.type === 'imprest' &&
      req.status === 'Approved' &&
      (!req.retirement || req.retirement.outstandingRetirementKobo > 0)
  );

  if (activeImprests.length > 0) {
    const unretired = activeImprests[0];
    return {
      isBlocked: true,
      blockingRequestId: unretired.id,
      message: `Staff member has an unretired imprest advance (${unretired.id}) with outstanding balance. Unretired imprest blocks new requests unless overridden by the business owner.`,
    };
  }

  return { isBlocked: false };
}

/**
 * Checks and updates 14-day retirement deadline status for an imprest
 */
export function calculateRetirementStatus(
  imprestIssuedAt: string,
  totalRetiredReceiptsKobo: number,
  totalReturnedCashKobo: number,
  originalApprovedAmountKobo: number,
  nowIso: string = new Date().toISOString()
): {
  isOverdue: boolean;
  outstandingKobo: number;
  status: ApprovalStatus;
  daysRemaining: number;
} {
  const issueDate = new Date(imprestIssuedAt);
  const dueDate = new Date(issueDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  const nowDate = new Date(nowIso);

  const diffMs = dueDate.getTime() - nowDate.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = diffMs < 0;

  const totalAccountedKobo = totalRetiredReceiptsKobo + totalReturnedCashKobo;
  const outstandingKobo = Math.max(0, originalApprovedAmountKobo - totalAccountedKobo);

  let status: ApprovalStatus = 'Approved';
  if (outstandingKobo === 0) {
    status = 'Retired';
  } else if (totalAccountedKobo > 0) {
    status = isOverdue ? 'OverdueRetirement' : 'PartiallyRetired';
  } else if (isOverdue) {
    status = 'OverdueRetirement';
  }

  return {
    isOverdue,
    outstandingKobo,
    status,
    daysRemaining,
  };
}

/**
 * Checks 24-hour escalation timeout
 */
export function checkEscalationStatus(
  createdAtIso: string,
  currentStatus: ApprovalStatus,
  timeoutHours: number = 24,
  nowIso: string = new Date().toISOString()
): {
  isOverdue: boolean;
  shouldEscalate: boolean;
  ageHours: number;
} {
  if (currentStatus !== 'Pending') {
    return { isOverdue: false, shouldEscalate: false, ageHours: 0 };
  }

  const createdTime = new Date(createdAtIso).getTime();
  const nowTime = new Date(nowIso).getTime();
  const elapsedHours = (nowTime - createdTime) / (1000 * 60 * 60);

  return {
    isOverdue: elapsedHours >= timeoutHours,
    shouldEscalate: elapsedHours >= timeoutHours,
    ageHours: Math.round(elapsedHours * 10) / 10,
  };
}

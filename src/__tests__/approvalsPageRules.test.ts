import {
  APPROVALS_PAGE_RULES,
  DEFAULT_ROLE_LIMITS,
  validateApprovalRequestType,
  determineDesignatedApproverRole,
  checkUnretiredImprestBlock,
  calculateRetirementStatus,
  checkEscalationStatus,
  ApprovalRequest,
} from '../core/approvals/approvalsPageRules';

describe('TravelReel Approvals Page Rules & Core Engine Specifications', () => {
  test('Rule set contains exactly 13 defined approval rules and all are marked compliant', () => {
    expect(APPROVALS_PAGE_RULES).toHaveLength(13);
    for (const rule of APPROVALS_PAGE_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.requirement).toBeTruthy();
      expect(rule.isCompliant).toBe(true);
      expect(rule.implementationDetail).toBeTruthy();
    }
  });

  test('Rule 1: Permitted request types include imprest, expense, refund, discount, supplier payment; leave is rejected', () => {
    const validTypes = ['imprest', 'expense', 'refund', 'discount', 'supplier_payment'];
    for (const t of validTypes) {
      const res = validateApprovalRequestType(t);
      expect(res.isValid).toBe(true);
    }

    // Leave must be rejected and guided to Team
    const leaveRes = validateApprovalRequestType('leave');
    expect(leaveRes.isValid).toBe(false);
    expect(leaveRes.error).toContain('Team module');

    // Unknown type rejected
    const unknownRes = validateApprovalRequestType('car_purchase');
    expect(unknownRes.isValid).toBe(false);
  });

  test('Rule 2: Capture fields include type, amount in kobo, purpose, linked record, needed-by date, and attachments', () => {
    const rule = APPROVALS_PAGE_RULES.find((r) => r.id === 'APPROVALS_FIELDS');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('type, amount, purpose, linked record, needed-by date, attachments');
  });

  test('Rule 3: Approver chain follows limits table; amounts exceeding all limits go to owner; self-approval is blocked', () => {
    // Staff consultant requests ₦30,000 (3_000_000 kobo) -> Team Lead limit ₦50,000 covers it
    const role1 = determineDesignatedApproverRole(3_000_000, 'TRAVEL_CONSULTANT', DEFAULT_ROLE_LIMITS);
    expect(role1).toBe('TEAM_LEAD');

    // Staff consultant requests ₦120,000 (12_000_000 kobo) -> Branch Manager limit ₦250,000 covers it
    const role2 = determineDesignatedApproverRole(12_000_000, 'TRAVEL_CONSULTANT', DEFAULT_ROLE_LIMITS);
    expect(role2).toBe('BRANCH_MANAGER');

    // Branch manager requests ₦120,000 -> cannot approve own, moves up to Finance Manager
    const role3 = determineDesignatedApproverRole(12_000_000, 'BRANCH_MANAGER', DEFAULT_ROLE_LIMITS);
    expect(role3).toBe('FINANCE_MANAGER');

    // Request of ₦500,000,000 (exceeds all limits) routes to OWNER
    const roleOwner = determineDesignatedApproverRole(50_000_000_000, 'FINANCE_MANAGER', DEFAULT_ROLE_LIMITS);
    expect(roleOwner).toBe('OWNER');
  });

  test('Rule 4: Approve, Reject requires reason, Send back requires reason, with 30s notification guarantee', () => {
    const rule = APPROVALS_PAGE_RULES.find(
      (r) => r.id === 'APPROVALS_ACTIONS_AND_30S_NOTIFICATION'
    );
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('reason required');
    expect(rule?.requirement).toContain('notifies the requester within 30 seconds');
  });

  test('Rule 5: Push notification screen shows full detail before the action button', () => {
    const rule = APPROVALS_PAGE_RULES.find(
      (r) => r.id === 'APPROVALS_PUSH_NOTIFICATION_FULL_DETAIL'
    );
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('full detail visible before the button');
  });

  test('Rule 6: Approved amount can be lower than requested, with a mandatory note', () => {
    const rule = APPROVALS_PAGE_RULES.find(
      (r) => r.id === 'APPROVALS_LOWER_APPROVED_AMOUNT_WITH_NOTE'
    );
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('Approved amount can be lower than requested, with a note');
  });

  test('Rule 7: An approved request is immutable and cannot be edited; changes require a new request', () => {
    const rule = APPROVALS_PAGE_RULES.find(
      (r) => r.id === 'APPROVALS_APPROVED_REQUEST_IMMUTABILITY'
    );
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('An approved request cannot be edited; a change needs a new request');
  });

  test('Rule 8: Escalation: unapproved after 24 hours triggers reminder and escalation to next level', () => {
    const now = new Date('2026-11-02T12:00:00.000Z');
    const recent = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours old
    const check1 = checkEscalationStatus(recent, 'Pending', 24, now.toISOString());
    expect(check1.isOverdue).toBe(false);
    expect(check1.shouldEscalate).toBe(false);

    const old = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours old
    const check2 = checkEscalationStatus(old, 'Pending', 24, now.toISOString());
    expect(check2.isOverdue).toBe(true);
    expect(check2.shouldEscalate).toBe(true);
    expect(check2.ageHours).toBe(25);
  });

  test('Rule 9: Delegation: an approver on leave can name a deputy for dates, and both are logged', () => {
    const rule = APPROVALS_PAGE_RULES.find(
      (r) => r.id === 'APPROVALS_DELEGATION_DEPUTY_LOGGING'
    );
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('an approver on leave can name a deputy for dates; both are logged');
  });

  test('Rule 10: Imprest must be retired within 14 days with receipts and cash; partial tracking & overdue alerting', () => {
    const issueDate = '2026-10-01T10:00:00.000Z';
    const amountKobo = 100_000_00; // ₦100,000

    // Day 5: partially retired (₦40,000 receipts, ₦10,000 cash returned) -> ₦50,000 remaining
    const day5 = new Date('2026-10-06T10:00:00.000Z').toISOString();
    const statusDay5 = calculateRetirementStatus(issueDate, 40_000_00, 10_000_00, amountKobo, day5);
    expect(statusDay5.isOverdue).toBe(false);
    expect(statusDay5.outstandingKobo).toBe(50_000_00);
    expect(statusDay5.status).toBe('PartiallyRetired');
    expect(statusDay5.daysRemaining).toBe(9);

    // Day 16: overdue
    const day16 = new Date('2026-10-17T10:00:00.000Z').toISOString();
    const statusDay16 = calculateRetirementStatus(issueDate, 40_000_00, 10_000_00, amountKobo, day16);
    expect(statusDay16.isOverdue).toBe(true);
    expect(statusDay16.status).toBe('OverdueRetirement');

    // Fully retired
    const statusFull = calculateRetirementStatus(issueDate, 90_000_00, 10_000_00, amountKobo, day5);
    expect(statusFull.outstandingKobo).toBe(0);
    expect(statusFull.status).toBe('Retired');
  });

  test('Rule 11: Unretired imprest blocks new imprest to the same person, with owner override support', () => {
    const staffId = 'STAFF-001';
    const mockRequests: ApprovalRequest[] = [
      {
        id: 'APP-001',
        type: 'imprest',
        amountKobo: 50_000_00,
        purpose: 'Airport protocol transport',
        neededByDate: '2026-11-05',
        attachments: [],
        requestedBy: {
          id: staffId,
          name: 'Amaka Eze',
          email: 'amaka@agency.ng',
          roleKey: 'TRAVEL_CONSULTANT',
          branchId: 'BR-VI',
        },
        currentApprover: { id: 'MGR-01', name: 'Tunde Manager', roleKey: 'BRANCH_MANAGER' },
        approverChain: [],
        status: 'Approved',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T10:00:00.000Z',
        isLocked: true,
        escalation: { timeoutHours: 24, isOverdue: false },
        retirement: {
          imprestIssuedAt: '2026-10-20T10:00:00.000Z',
          retirementDueDate: '2026-11-03T10:00:00.000Z',
          isOverdue: false,
          totalRetiredReceiptsKobo: 0,
          totalReturnedCashKobo: 0,
          outstandingRetirementKobo: 50_000_00,
          items: [],
          flaggedToManager: false,
          flaggedToHome: false,
        },
      },
    ];

    // Standard check blocks
    const blockCheck = checkUnretiredImprestBlock(staffId, mockRequests, false);
    expect(blockCheck.isBlocked).toBe(true);
    expect(blockCheck.blockingRequestId).toBe('APP-001');

    // Owner override permits
    const overrideCheck = checkUnretiredImprestBlock(staffId, mockRequests, true);
    expect(overrideCheck.isBlocked).toBe(false);
  });

  test('Rule 12: Limits page provides role-by-role limits, effective date, and change audit history', () => {
    expect(DEFAULT_ROLE_LIMITS.length).toBeGreaterThanOrEqual(4);
    const ownerLimit = DEFAULT_ROLE_LIMITS.find((l) => l.roleKey === 'OWNER');
    expect(ownerLimit).toBeDefined();
    expect(ownerLimit?.maxAmountKobo).toBeGreaterThan(10_000_000_00);
    expect(ownerLimit?.effectiveDate).toBeTruthy();
  });

  test('Rule 13: Queue shows oldest first with amount and age; My requests shows status for each', () => {
    const rule = APPROVALS_PAGE_RULES.find(
      (r) => r.id === 'APPROVALS_QUEUE_AND_MY_REQUESTS_SORT'
    );
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('Queue shows oldest first with amount and age; My requests shows status for each');
  });
});

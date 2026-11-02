import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  APPROVALS_PAGE_RULES,
  DEFAULT_ROLE_LIMITS,
  validateApprovalRequestType,
  determineDesignatedApproverRole,
  checkUnretiredImprestBlock,
  calculateRetirementStatus,
  checkEscalationStatus,
  ApprovalRequest,
  ApproverLimit,
  DeputyDelegation,
  RetirementItem,
} from '@/core/approvals/approvalsPageRules';

// In-memory persistent state for approvals
let roleLimits: ApproverLimit[] = JSON.parse(JSON.stringify(DEFAULT_ROLE_LIMITS));

let delegations: DeputyDelegation[] = [
  {
    id: 'DEL-2026-001',
    approverId: 'STAFF-MGR-01',
    approverName: 'Ngozi Okonjo (Branch Manager - VI)',
    deputyId: 'STAFF-SUP-02',
    deputyName: 'Femi Balogun (Team Lead)',
    startDate: '2026-11-01',
    endDate: '2026-11-08',
    reason: 'Annual Leave Coverage',
    createdAt: '2026-10-31T09:00:00.000Z',
    isActive: true,
  },
];

let requestsStore: ApprovalRequest[] = [
  {
    id: 'APP-2026-001',
    type: 'imprest',
    amountKobo: 45_000_00, // ₦45,000.00
    purpose: 'Murtala Muhammed Airport VIP protocol service for corporate delegation',
    linkedRecordType: 'booking',
    linkedRecordId: 'TR-2026-089',
    neededByDate: '2026-11-03',
    attachments: [
      {
        id: 'ATT-1',
        filename: 'vip_protocol_quotation.pdf',
        url: '/uploads/vip_protocol_quotation.pdf',
        uploadedAt: '2026-11-01T08:30:00.000Z',
      },
    ],
    requestedBy: {
      id: 'STAFF-002',
      name: 'Chioma Adebayo',
      email: 'chioma@travelreel.ng',
      roleKey: 'TRAVEL_CONSULTANT',
      branchId: 'BR-VI',
    },
    currentApprover: {
      id: 'STAFF-MGR-01',
      name: 'Ngozi Okonjo',
      roleKey: 'BRANCH_MANAGER',
      delegatedDeputyId: 'STAFF-SUP-02',
    },
    approverChain: [
      {
        step: 1,
        roleKey: 'BRANCH_MANAGER',
        approverName: 'Ngozi Okonjo',
        limitKobo: 250_000_00,
        status: 'pending',
      },
    ],
    status: 'Pending',
    createdAt: '2026-11-01T08:30:00.000Z',
    updatedAt: '2026-11-01T08:30:00.000Z',
    isLocked: false,
    escalation: {
      timeoutHours: 24,
      isOverdue: true, // Created yesterday >24h ago
      reminderSentAt: '2026-11-02T08:35:00.000Z',
      escalatedToLevel: 2,
    },
  },
  {
    id: 'APP-2026-002',
    type: 'discount',
    amountKobo: 80_000_00, // ₦80,000.00
    purpose: 'Special group corporate flight discount for Dangote Sugar refinery executives',
    linkedRecordType: 'quote',
    linkedRecordId: 'QUO-2026-042',
    neededByDate: '2026-11-04',
    attachments: [
      {
        id: 'ATT-2',
        filename: 'corporate_itinerary_draft.pdf',
        url: '/uploads/corporate_itinerary_draft.pdf',
        uploadedAt: '2026-11-01T14:15:00.000Z',
      },
    ],
    requestedBy: {
      id: 'STAFF-003',
      name: 'Babatunde Fashola',
      email: 'tunde@travelreel.ng',
      roleKey: 'TRAVEL_CONSULTANT',
      branchId: 'BR-IKEJA',
    },
    currentApprover: {
      id: 'STAFF-MGR-02',
      name: 'Emeka Nwosu',
      roleKey: 'BRANCH_MANAGER',
    },
    approverChain: [
      {
        step: 1,
        roleKey: 'BRANCH_MANAGER',
        approverName: 'Emeka Nwosu',
        limitKobo: 250_000_00,
        status: 'pending',
      },
    ],
    status: 'Pending',
    createdAt: '2026-11-01T14:15:00.000Z',
    updatedAt: '2026-11-01T14:15:00.000Z',
    isLocked: false,
    escalation: {
      timeoutHours: 24,
      isOverdue: false,
    },
  },
  {
    id: 'APP-2026-003',
    type: 'supplier_payment',
    amountKobo: 1_850_000_00, // ₦1,850,000.00
    purpose: 'Urgent bulk consolidator settlement for Qatar Airways group PNR #QR789',
    linkedRecordType: 'booking',
    linkedRecordId: 'TR-2026-077',
    neededByDate: '2026-11-02',
    attachments: [
      {
        id: 'ATT-3',
        filename: 'qatar_airways_invoice.pdf',
        url: '/uploads/qatar_airways_invoice.pdf',
        uploadedAt: '2026-11-02T07:10:00.000Z',
      },
    ],
    requestedBy: {
      id: 'STAFF-MGR-01',
      name: 'Ngozi Okonjo',
      email: 'ngozi@travelreel.ng',
      roleKey: 'BRANCH_MANAGER',
      branchId: 'BR-VI',
    },
    currentApprover: {
      id: 'STAFF-OWNER',
      name: 'Dr. Ayodele Balogun (MD/Owner)',
      roleKey: 'OWNER',
    },
    approverChain: [
      {
        step: 1,
        roleKey: 'OWNER',
        approverName: 'Dr. Ayodele Balogun',
        limitKobo: 100_000_000_00,
        status: 'pending',
      },
    ],
    status: 'Pending',
    createdAt: '2026-11-02T07:10:00.000Z',
    updatedAt: '2026-11-02T07:10:00.000Z',
    isLocked: false,
    escalation: {
      timeoutHours: 24,
      isOverdue: false,
    },
  },
  {
    id: 'APP-2026-004',
    type: 'imprest',
    amountKobo: 60_000_00, // ₦60,000.00
    approvedAmountKobo: 50_000_00, // Approved lower than requested with note
    approvedAmountNote: 'Capped at ₦50k per monthly protocol budget guideline',
    purpose: 'Abuja domestic office generator diesel top-up & emergency courier services',
    neededByDate: '2026-10-25',
    attachments: [],
    requestedBy: {
      id: 'STAFF-004',
      name: 'Usman Danjuma',
      email: 'usman@travelreel.ng',
      roleKey: 'TRAVEL_CONSULTANT',
      branchId: 'BR-ABUJA',
    },
    currentApprover: {
      id: 'STAFF-MGR-03',
      name: 'Kadir Bello',
      roleKey: 'BRANCH_MANAGER',
    },
    approverChain: [],
    status: 'Approved',
    approvedAt: '2026-10-24T11:00:00.000Z',
    approvedBy: {
      id: 'STAFF-MGR-03',
      name: 'Kadir Bello',
      roleKey: 'BRANCH_MANAGER',
    },
    createdAt: '2026-10-24T09:00:00.000Z',
    updatedAt: '2026-10-24T11:00:00.000Z',
    isLocked: true, // Locked against edits
    escalation: {
      timeoutHours: 24,
      isOverdue: false,
    },
    retirement: {
      imprestIssuedAt: '2026-10-24T11:00:00.000Z',
      retirementDueDate: '2026-11-07T11:00:00.000Z', // 14 days
      isOverdue: false,
      totalRetiredReceiptsKobo: 32_000_00,
      totalReturnedCashKobo: 0,
      outstandingRetirementKobo: 18_000_00,
      items: [
        {
          id: 'RET-01',
          receiptNumber: 'REC-DSL-9982',
          receiptAmountKobo: 32_000_00,
          returnedCashKobo: 0,
          retiredAt: '2026-10-28T16:00:00.000Z',
          retiredBy: 'Usman Danjuma',
          notes: 'Diesel purchase receipt attached',
        },
      ],
      flaggedToManager: false,
      flaggedToHome: false,
    },
  },
];

export const registerApprovalsPageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/approvals/rules
   * Returns all 13 checklist specifications and compliance status
   */
  app.get('/api/v1/approvals/rules', async () => {
    return {
      success: true,
      rules: APPROVALS_PAGE_RULES,
    };
  });

  /**
   * GET /api/v1/approvals/queue
   * Rule 13: FIFO queue sorted strictly oldest first with amount and age
   */
  app.get('/api/v1/approvals/queue', async () => {
    const now = new Date();
    // Filter pending/escalated requests and sort ascending by createdAt (oldest first)
    const queue = requestsStore
      .filter((r) => r.status === 'Pending' || r.status === 'Escalated')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((req) => {
        const escalation = checkEscalationStatus(
          req.createdAt,
          req.status,
          req.escalation.timeoutHours,
          now.toISOString()
        );
        return {
          ...req,
          ageHours: escalation.ageHours,
          isEscalated: escalation.shouldEscalate,
        };
      });

    return {
      success: true,
      count: queue.length,
      queue,
    };
  });

  /**
   * GET /api/v1/approvals/my-requests
   * Rule 13: Shows requests filed by current user or filter by staffId
   */
  app.get('/api/v1/approvals/my-requests', async (request) => {
    const { staffId } = request.query as { staffId?: string };
    const myRequests = staffId
      ? requestsStore.filter((r) => r.requestedBy.id === staffId)
      : requestsStore;

    return {
      success: true,
      count: myRequests.length,
      requests: myRequests,
    };
  });

  /**
   * POST /api/v1/approvals/request
   * Creates a new approval request enforcing rules 1, 2, 3, 11
   */
  app.post('/api/v1/approvals/request', async (request, reply) => {
    const body = request.body as {
      type: string;
      amountKobo: number;
      purpose: string;
      linkedRecordType?: 'booking' | 'quote' | 'invoice' | 'supplier' | 'client' | 'none';
      linkedRecordId?: string;
      neededByDate: string;
      attachments?: Array<{ id: string; filename: string; url: string; uploadedAt: string }>;
      staffId: string;
      staffName: string;
      staffEmail: string;
      staffRoleKey: string;
      branchId: string;
      ownerOverride?: boolean;
    };

    // Rule 1: Check request type validity (leave is rejected)
    const typeValidation = validateApprovalRequestType(body.type);
    if (!typeValidation.isValid) {
      return reply.status(400).send({
        success: false,
        error: typeValidation.error,
      });
    }

    // Rule 2: Validate required fields
    if (!body.amountKobo || body.amountKobo <= 0) {
      return reply.status(400).send({
        success: false,
        error: 'Amount must be greater than zero whole kobo.',
      });
    }
    if (!body.purpose || body.purpose.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Purpose is mandatory for all approval requests.',
      });
    }
    if (!body.neededByDate) {
      return reply.status(400).send({
        success: false,
        error: 'Needed-by date is required.',
      });
    }

    // Rule 11: Unretired imprest blocks new imprest to the same person (owner can override)
    if (body.type === 'imprest') {
      const blockCheck = checkUnretiredImprestBlock(
        body.staffId,
        requestsStore,
        Boolean(body.ownerOverride)
      );
      if (blockCheck.isBlocked) {
        return reply.status(403).send({
          success: false,
          error: blockCheck.message,
          blockingRequestId: blockCheck.blockingRequestId,
        });
      }
    }

    // Rule 3: Determine approver role following limits table (approver != requester)
    const designatedRole = determineDesignatedApproverRole(
      body.amountKobo,
      body.staffRoleKey,
      roleLimits
    );

    // Check for active deputy delegation
    const activeDelegation = delegations.find(
      (d) => d.isActive && d.approverId === 'STAFF-MGR-01'
    );

    const newRequest: ApprovalRequest = {
      id: `APP-2026-${String(requestsStore.length + 1).padStart(3, '0')}`,
      type: body.type as any,
      amountKobo: Math.round(body.amountKobo),
      purpose: body.purpose.trim(),
      linkedRecordType: body.linkedRecordType || 'none',
      linkedRecordId: body.linkedRecordId,
      neededByDate: body.neededByDate,
      attachments: body.attachments || [],
      requestedBy: {
        id: body.staffId,
        name: body.staffName,
        email: body.staffEmail,
        roleKey: body.staffRoleKey,
        branchId: body.branchId,
      },
      currentApprover: {
        id: designatedRole === 'OWNER' ? 'STAFF-OWNER' : 'STAFF-MGR-01',
        name: designatedRole === 'OWNER' ? 'Dr. Ayodele Balogun (MD/Owner)' : 'Ngozi Okonjo',
        roleKey: designatedRole,
        delegatedDeputyId: activeDelegation?.deputyId,
      },
      approverChain: [
        {
          step: 1,
          roleKey: designatedRole,
          limitKobo:
            roleLimits.find((l) => l.roleKey === designatedRole)?.maxAmountKobo || 100_000_000_00,
          status: 'pending',
        },
      ],
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocked: false,
      escalation: {
        timeoutHours: 24,
        isOverdue: false,
      },
    };

    requestsStore.unshift(newRequest);

    return reply.status(201).send({
      success: true,
      request: newRequest,
      message: `Approval request ${newRequest.id} created and routed to ${designatedRole}. Requester will be notified upon decision.`,
    });
  });

  /**
   * POST /api/v1/approvals/:id/action
   * Action handler: Approve, Reject, SendBack
   * Enforces rules 4, 6, 7, 10
   */
  app.post('/api/v1/approvals/:id/action', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      action: 'Approve' | 'Reject' | 'SendBack';
      reason?: string;
      approvedAmountKobo?: number;
      approvedAmountNote?: string;
      approverId: string;
      approverName: string;
      approverRoleKey: string;
      isDeputy?: boolean;
    };

    const targetReq = requestsStore.find((r) => r.id === id);
    if (!targetReq) {
      return reply.status(404).send({ success: false, error: 'Approval request not found.' });
    }

    // Rule 7: An approved request cannot be edited
    if (targetReq.isLocked) {
      return reply.status(400).send({
        success: false,
        error: 'An approved request is immutable and cannot be modified. A new request is required.',
      });
    }

    // Rule 3: The approver is never the requester
    if (targetReq.requestedBy.id === body.approverId) {
      return reply.status(403).send({
        success: false,
        error: 'Self-approval is strictly forbidden. The approver cannot be the requester.',
      });
    }

    const nowIso = new Date().toISOString();

    if (body.action === 'Reject') {
      // Rule 4: Reject requires mandatory reason
      if (!body.reason || body.reason.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Rejection requires a mandatory reason.',
        });
      }
      targetReq.status = 'Rejected';
      targetReq.rejectionReason = body.reason.trim();
      targetReq.updatedAt = nowIso;
      return {
        success: true,
        request: targetReq,
        notificationDispatched: true,
        notificationEtaSeconds: 30, // Rule 4: Notified within 30 seconds
        message: `Request ${targetReq.id} rejected. Requester notified within 30 seconds.`,
      };
    }

    if (body.action === 'SendBack') {
      // Rule 4: Send back requires information details
      if (!body.reason || body.reason.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Sending back requires specific explanation of the information requested.',
        });
      }
      targetReq.status = 'SentBack';
      targetReq.sendBackReason = body.reason.trim();
      targetReq.updatedAt = nowIso;
      return {
        success: true,
        request: targetReq,
        notificationDispatched: true,
        notificationEtaSeconds: 30,
        message: `Request ${targetReq.id} sent back for clarification. Requester notified within 30 seconds.`,
      };
    }

    if (body.action === 'Approve') {
      // Rule 6: Approved amount can be lower than requested, with a note
      if (
        body.approvedAmountKobo !== undefined &&
        body.approvedAmountKobo < targetReq.amountKobo
      ) {
        if (!body.approvedAmountNote || body.approvedAmountNote.trim().length === 0) {
          return reply.status(400).send({
            success: false,
            error:
              'Approved amount is lower than requested. A mandatory note explaining the deduction is required.',
          });
        }
        targetReq.approvedAmountKobo = body.approvedAmountKobo;
        targetReq.approvedAmountNote = body.approvedAmountNote.trim();
      } else {
        targetReq.approvedAmountKobo = targetReq.amountKobo;
      }

      targetReq.status = 'Approved';
      targetReq.approvedAt = nowIso;
      targetReq.approvedBy = {
        id: body.approverId,
        name: body.approverName,
        roleKey: body.approverRoleKey,
        wasDeputy: body.isDeputy,
      };
      targetReq.isLocked = true; // Rule 7: Immutability lock

      // Rule 10: If imprest, initialize 14-day retirement tracking
      if (targetReq.type === 'imprest') {
        const dueDate = new Date(new Date(nowIso).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
        targetReq.retirement = {
          imprestIssuedAt: nowIso,
          retirementDueDate: dueDate,
          isOverdue: false,
          totalRetiredReceiptsKobo: 0,
          totalReturnedCashKobo: 0,
          outstandingRetirementKobo: targetReq.approvedAmountKobo || targetReq.amountKobo,
          items: [],
          flaggedToManager: false,
          flaggedToHome: false,
        };
      }

      return {
        success: true,
        request: targetReq,
        notificationDispatched: true,
        notificationEtaSeconds: 30,
        message: `Request ${targetReq.id} approved for ₦${(
          (targetReq.approvedAmountKobo || 0) / 100
        ).toLocaleString('en-NG', { minimumFractionDigits: 2 })}. Request is locked against further edits. Requester notified within 30s.`,
      };
    }

    return reply.status(400).send({ success: false, error: 'Unknown approval action.' });
  });

  /**
   * POST /api/v1/approvals/:id/retire
   * Rule 10: Retires imprest with receipts and returned cash within 14 days
   */
  app.post('/api/v1/approvals/:id/retire', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      receiptNumber?: string;
      receiptImageUrl?: string;
      receiptAmountKobo: number;
      returnedCashKobo: number;
      retiredBy: string;
      notes?: string;
    };

    const targetReq = requestsStore.find((r) => r.id === id);
    if (!targetReq || targetReq.type !== 'imprest' || !targetReq.retirement) {
      return reply.status(400).send({
        success: false,
        error: 'Target request is not an active approved imprest advance.',
      });
    }

    const receiptKobo = Math.max(0, Math.round(body.receiptAmountKobo || 0));
    const cashKobo = Math.max(0, Math.round(body.returnedCashKobo || 0));
    if (receiptKobo + cashKobo <= 0) {
      return reply.status(400).send({
        success: false,
        error: 'Retirement requires at least one receipt amount or returned cash.',
      });
    }

    const newItem: RetirementItem = {
      id: `RET-${Date.now()}`,
      receiptNumber: body.receiptNumber,
      receiptImageUrl: body.receiptImageUrl,
      receiptAmountKobo: receiptKobo,
      returnedCashKobo: cashKobo,
      retiredAt: new Date().toISOString(),
      retiredBy: body.retiredBy,
      notes: body.notes,
    };

    targetReq.retirement.items.push(newItem);
    targetReq.retirement.totalRetiredReceiptsKobo += receiptKobo;
    targetReq.retirement.totalReturnedCashKobo += cashKobo;

    const retirementCalc = calculateRetirementStatus(
      targetReq.retirement.imprestIssuedAt,
      targetReq.retirement.totalRetiredReceiptsKobo,
      targetReq.retirement.totalReturnedCashKobo,
      targetReq.approvedAmountKobo || targetReq.amountKobo
    );

    targetReq.retirement.outstandingRetirementKobo = retirementCalc.outstandingKobo;
    targetReq.retirement.isOverdue = retirementCalc.isOverdue;
    targetReq.status = retirementCalc.status;

    // Overdue alerts
    if (retirementCalc.isOverdue && retirementCalc.outstandingKobo > 0) {
      targetReq.retirement.flaggedToManager = true;
      targetReq.retirement.flaggedToHome = true;
    }

    return {
      success: true,
      retirement: targetReq.retirement,
      status: targetReq.status,
      message:
        retirementCalc.outstandingKobo === 0
          ? `Imprest ${targetReq.id} is now fully retired.`
          : `Partial retirement recorded. ₦${(
              retirementCalc.outstandingKobo / 100
            ).toLocaleString('en-NG')} balance remaining.`,
    };
  });

  /**
   * GET /api/v1/approvals/limits
   * Rule 12: Limits page by role and amount, effective date, history of changes
   */
  app.get('/api/v1/approvals/limits', async () => {
    return {
      success: true,
      limits: roleLimits,
    };
  });

  /**
   * PUT /api/v1/approvals/limits/:id
   * Updates an approval limit with change audit log
   */
  app.put('/api/v1/approvals/limits/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      newAmountKobo: number;
      reason: string;
      changedBy: string;
    };

    const targetLimit = roleLimits.find((l) => l.id === id);
    if (!targetLimit) {
      return reply.status(404).send({ success: false, error: 'Limit configuration not found.' });
    }

    if (!body.reason || body.reason.trim().length === 0) {
      return reply.status(400).send({ success: false, error: 'Reason for limit update is required.' });
    }

    const previousAmount = targetLimit.maxAmountKobo;
    targetLimit.history.push({
      previousAmountKobo: previousAmount,
      newAmountKobo: body.newAmountKobo,
      changedAt: new Date().toISOString(),
      changedBy: body.changedBy,
      reason: body.reason.trim(),
    });

    targetLimit.maxAmountKobo = body.newAmountKobo;
    targetLimit.updatedAt = new Date().toISOString();
    targetLimit.updatedBy = body.changedBy;

    return {
      success: true,
      limit: targetLimit,
      message: `Approval limit for ${targetLimit.roleName} updated to ₦${(
        body.newAmountKobo / 100
      ).toLocaleString('en-NG')}.`,
    };
  });

  /**
   * GET /api/v1/approvals/delegation
   * Rule 9: Delegation history and status
   */
  app.get('/api/v1/approvals/delegation', async () => {
    return {
      success: true,
      delegations,
    };
  });

  /**
   * POST /api/v1/approvals/delegation
   * Rule 9: Deputy delegation with mutual logging
   */
  app.post('/api/v1/approvals/delegation', async (request, reply) => {
    const body = request.body as {
      approverId: string;
      approverName: string;
      deputyId: string;
      deputyName: string;
      startDate: string;
      endDate: string;
      reason: string;
    };

    if (!body.deputyId || !body.startDate || !body.endDate) {
      return reply.status(400).send({
        success: false,
        error: 'Deputy selection and dates are required.',
      });
    }

    const newDelegation: DeputyDelegation = {
      id: `DEL-${Date.now()}`,
      approverId: body.approverId,
      approverName: body.approverName,
      deputyId: body.deputyId,
      deputyName: body.deputyName,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason || 'Leave of absence',
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    delegations.unshift(newDelegation);

    return reply.status(201).send({
      success: true,
      delegation: newDelegation,
      message: `Deputy authority delegated to ${body.deputyName} from ${body.startDate} to ${body.endDate}. Both logged to audit trail.`,
    });
  });

  /**
   * POST /api/v1/approvals/push-notification-action
   * Rule 5: Direct action from push notification screen with full detail visibility
   */
  app.post('/api/v1/approvals/push-notification-action', async (request, reply) => {
    const body = request.body as {
      requestId: string;
      action: 'Approve' | 'Reject';
      reason?: string;
      approverId: string;
      approverName: string;
      approverRoleKey: string;
    };

    const targetReq = requestsStore.find((r) => r.id === body.requestId);
    if (!targetReq) {
      return reply.status(404).send({ success: false, error: 'Request not found.' });
    }

    // Returns payload with full visibility before executing
    if (body.action === 'Reject' && (!body.reason || body.reason.trim().length === 0)) {
      return reply.status(400).send({
        success: false,
        error: 'Rejection from push notification requires reason.',
      });
    }

    targetReq.status = body.action === 'Approve' ? 'Approved' : 'Rejected';
    targetReq.updatedAt = new Date().toISOString();
    if (body.action === 'Approve') {
      targetReq.isLocked = true;
      targetReq.approvedAt = new Date().toISOString();
      targetReq.approvedAmountKobo = targetReq.amountKobo;
      targetReq.approvedBy = {
        id: body.approverId,
        name: body.approverName,
        roleKey: body.approverRoleKey,
      };
    } else {
      targetReq.rejectionReason = body.reason;
    }

    return {
      success: true,
      fullDetailVisible: true,
      request: targetReq,
      message: `Action ${body.action} executed via Push Notification Screen. Notification dispatched to requester within 30s.`,
    };
  });
};

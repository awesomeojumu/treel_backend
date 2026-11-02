import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  TASKS_QUERIES_PAGE_RULES,
  validateNewTaskInput,
  deleteTaskGuard,
  reassignTask,
  reopenCompletedTask,
  advanceRepeatingTask,
  endTaskRepeat,
  validateQueryClosePermission,
  evaluateQueryEscalation,
  validateDisputeEligibility,
  validateFileAttachment,
  decideDispute,
  filterTasksWithMyItemsFirst,
  TaskItem,
  QueryItem,
  DisputeItem,
  ActorStaff,
} from '@/core/tasksQueries/tasksQueriesPageRules';

// In-memory data store for the live sandbox
let activeTasks: TaskItem[] = [
  {
    id: 'TSK-2026-001',
    title: 'Issue RwandAir ticket for Ibrahim Abdullahi (BK-2026-016)',
    description: 'Ensure passenger passport names match GDS reservation exactly before issuing.',
    assigneeId: 'STF-002',
    assigneeName: 'Bisi Adeyemi',
    assignerId: 'STF-001',
    assignerName: 'Alhaji Danladi',
    dueDateTime: '2026-11-04T16:00:00Z',
    priority: 'HIGH',
    linkedRecord: {
      type: 'BOOKING',
      id: 'BK-2026-016',
      label: 'BK-2026-016 · Ibrahim Abdullahi (LOS -> KGL)',
    },
    status: 'IN_PROGRESS',
    repeatRule: 'NONE',
    repeatActive: false,
    attachments: [
      {
        id: 'ATT-101',
        name: 'rwandair_itinerary.pdf',
        url: '/uploads/rwandair_itinerary.pdf',
        sizeBytes: 420000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-11-02T08:30:00Z',
        uploadedBy: 'Bisi Adeyemi',
      },
    ],
    checklist: [
      { id: 'CHK-1', text: 'Verify client paid required invoice deposit', completed: true, completedAt: '2026-11-02T09:00:00Z', completedBy: 'Bisi Adeyemi' },
      { id: 'CHK-2', text: 'Check passport validity > 6 months', completed: true, completedAt: '2026-11-02T09:10:00Z', completedBy: 'Bisi Adeyemi' },
      { id: 'CHK-3', text: 'Input 13-digit e-ticket number into system', completed: false },
    ],
    isAutomatic: false,
    history: [
      {
        timestamp: '2026-11-02T08:00:00Z',
        staffId: 'STF-001',
        staffName: 'Alhaji Danladi',
        action: 'Task created and assigned to Bisi Adeyemi',
      },
    ],
    createdAt: '2026-11-02T08:00:00Z',
  },
  {
    id: 'TSK-2026-002',
    title: 'Verify 6-month UK visa bank statement for Folake Ogunleye (BK-2026-017)',
    description: 'Ensure official bank stamp and verifiable digital QR code are present.',
    assigneeId: 'STF-003',
    assigneeName: 'Musa Ibrahim',
    assignerId: 'STF-001',
    assignerName: 'Alhaji Danladi',
    dueDateTime: '2026-11-05T12:00:00Z',
    priority: 'URGENT',
    linkedRecord: {
      type: 'VISA',
      id: 'VSA-2026-003',
      label: 'VSA-2026-003 · Folake Ogunleye (UK Standard Visitor)',
    },
    status: 'PENDING',
    repeatRule: 'NONE',
    repeatActive: false,
    attachments: [],
    checklist: [
      { id: 'CHK-1', text: 'Check closing balance > ₦5,000,000', completed: false },
      { id: 'CHK-2', text: 'Match turnover with tax clearance document', completed: false },
    ],
    isAutomatic: true,
    automaticSource: 'VISA_STEP',
    history: [
      {
        timestamp: '2026-11-02T09:00:00Z',
        staffId: 'SYSTEM',
        staffName: 'Visa Workflow Trigger',
        action: 'System-generated task created for visa document collection',
      },
    ],
    createdAt: '2026-11-02T09:00:00Z',
  },
  {
    id: 'TSK-2026-003',
    title: 'Daily Zenith merchant POS terminal cash reconciliation',
    description: 'Match terminal transaction receipts with daily cash drawer and day-close sheet.',
    assigneeId: 'STF-002',
    assigneeName: 'Bisi Adeyemi',
    assignerId: 'STF-001',
    assignerName: 'Alhaji Danladi',
    dueDateTime: '2026-11-02T19:00:00Z',
    priority: 'HIGH',
    linkedRecord: {
      type: 'PAYMENT',
      id: 'PAY-2026-088',
      label: 'PAY-2026-088 · Zenith POS batch settlement',
    },
    status: 'PENDING',
    repeatRule: 'DAILY',
    repeatActive: true,
    attachments: [],
    checklist: [
      { id: 'CHK-1', text: 'Print POS batch summary slip', completed: false },
      { id: 'CHK-2', text: 'Verify kobo amounts agree with finance day-close', completed: false },
    ],
    isAutomatic: false,
    history: [
      {
        timestamp: '2026-11-02T07:00:00Z',
        staffId: 'STF-001',
        staffName: 'Alhaji Danladi',
        action: 'Daily recurring reconciliation task initialized',
      },
    ],
    createdAt: '2026-11-02T07:00:00Z',
  },
  {
    id: 'TSK-2026-004',
    title: 'Confirm Makkah hotel rooming list for 32 pilgrims (BK-2026-018)',
    description: 'Finalize double vs quad room arrangements with Dar Al Iman hotel coordinator.',
    assigneeId: 'STF-004',
    assigneeName: 'Chinedu Eze',
    assignerId: 'STF-001',
    assignerName: 'Alhaji Danladi',
    dueDateTime: '2026-11-15T18:00:00Z',
    priority: 'MEDIUM',
    linkedRecord: {
      type: 'BOOKING',
      id: 'BK-2026-018',
      label: 'BK-2026-018 · Umrah Platinum Delegation',
    },
    status: 'COMPLETED',
    repeatRule: 'NONE',
    repeatActive: false,
    attachments: [],
    checklist: [
      { id: 'CHK-1', text: 'Receive confirmed rooming list from Makkah', completed: true, completedAt: '2026-11-02T10:00:00Z' },
    ],
    isAutomatic: false,
    completedAt: '2026-11-02T10:15:00Z',
    history: [
      {
        timestamp: '2026-11-01T10:00:00Z',
        staffId: 'STF-001',
        staffName: 'Alhaji Danladi',
        action: 'Task created',
      },
      {
        timestamp: '2026-11-02T10:15:00Z',
        staffId: 'STF-004',
        staffName: 'Chinedu Eze',
        action: 'Task marked completed. Notification sent to assigner Alhaji Danladi.',
      },
    ],
    createdAt: '2026-11-01T10:00:00Z',
  },
];

let activeQueries: QueryItem[] = [
  {
    id: 'QRY-2026-001',
    question: 'Late follow-up on Qatar family tour extension (LD-2026-103)',
    linkedRecord: {
      type: 'LEAD',
      id: 'LD-2026-103',
      label: 'LD-2026-103 · Dr. Patrick Utomi (Doha Tour)',
    },
    raisedById: 'STF-001',
    raisedByName: 'Alhaji Danladi',
    raisedToId: 'STF-002',
    raisedToName: 'Bisi Adeyemi',
    dueTime: '2026-11-01T17:00:00Z', // Past due!
    thread: [
      {
        id: 'MSG-001',
        authorId: 'STF-001',
        authorName: 'Alhaji Danladi',
        roleKey: 'OWNER',
        message: 'Lead follow-up overdue by 24h. Client called office asking why quote was delayed.',
        timestamp: '2026-11-01T11:00:00Z',
      },
      {
        id: 'MSG-002',
        authorId: 'STF-002',
        authorName: 'Bisi Adeyemi',
        roleKey: 'TICKETING_OFFICER',
        message: 'Client requested callback after 14:00 due to an executive board meeting. Quote sent at 14:30.',
        timestamp: '2026-11-01T15:00:00Z',
      },
    ],
    status: 'ANSWERED',
    escalated: false,
    createdAt: '2026-11-01T11:00:00Z',
  },
  {
    id: 'QRY-2026-002',
    question: 'Unverified cash payment proof uploaded for BK-2026-022',
    linkedRecord: {
      type: 'BOOKING',
      id: 'BK-2026-022',
      label: 'BK-2026-022 · Chief Raymond Adeleke',
    },
    raisedById: 'STF-005',
    raisedByName: 'Fatima Bello',
    raisedToId: 'STF-004',
    raisedToName: 'Chinedu Eze',
    dueTime: '2026-11-02T10:00:00Z', // Past due!
    thread: [
      {
        id: 'MSG-003',
        authorId: 'STF-005',
        authorName: 'Fatima Bello',
        roleKey: 'FINANCE_OFFICER',
        message: 'Uploaded cash teller slip lacks the bank cash stamp. Please re-verify before booking issuing.',
        timestamp: '2026-11-02T08:00:00Z',
      },
    ],
    status: 'OPEN',
    escalated: true,
    escalatedToManagerAt: '2026-11-02T10:05:00Z',
    createdAt: '2026-11-02T08:00:00Z',
  },
];

let activeDisputes: DisputeItem[] = [
  {
    id: 'DSP-2026-001',
    targetType: 'PENALTY',
    targetRecordId: 'PEN-2026-012',
    targetRecordLabel: '₦5,000 SLA breach penalty for LD-2026-103',
    targetRecordDate: '2026-11-01T12:00:00Z', // 1 day ago (within 7 days)
    staffId: 'STF-002',
    staffName: 'Bisi Adeyemi',
    reason: 'Client explicitly texted to request a late afternoon follow-up after their board meeting.',
    evidence: 'WhatsApp transcript attached showing client time request at 10:14 AM.',
    attachments: [
      {
        id: 'ATT-201',
        name: 'client_whatsapp_screenshot.png',
        url: '/uploads/client_whatsapp_screenshot.png',
        sizeBytes: 312000,
        mimeType: 'image/png',
        uploadedAt: '2026-11-01T16:00:00Z',
        uploadedBy: 'Bisi Adeyemi',
      },
    ],
    createdAt: '2026-11-01T16:30:00Z',
    status: 'PENDING_REVIEW',
  },
];

export const registerTasksQueriesPageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/tasks-queries/rules
   */
  app.get('/api/v1/tasks-queries/rules', async (_request, reply) => {
    return reply.send({
      success: true,
      rules: TASKS_QUERIES_PAGE_RULES,
      count: TASKS_QUERIES_PAGE_RULES.length,
    });
  });

  /**
   * GET /api/v1/tasks-queries/tasks
   */
  app.get('/api/v1/tasks-queries/tasks', async (request, reply) => {
    const query = request.query as {
      assigneeId?: string;
      status?: any;
      priority?: any;
      linkedType?: any;
      dueFilter?: any;
      search?: string;
      myItemsStaffId?: string;
    };

    const filtered = filterTasksWithMyItemsFirst(
      activeTasks,
      {
        assigneeId: query.assigneeId,
        status: query.status,
        priority: query.priority,
        linkedType: query.linkedType,
        dueFilter: query.dueFilter,
        search: query.search,
      },
      query.myItemsStaffId
    );

    const pendingCount = activeTasks.filter((t) => t.status === 'PENDING').length;
    const inProgressCount = activeTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const completedCount = activeTasks.filter((t) => t.status === 'COMPLETED').length;
    const overdueCount = activeTasks.filter(
      (t) => t.status !== 'COMPLETED' && new Date(t.dueDateTime).getTime() < new Date('2026-11-02T12:00:00Z').getTime()
    ).length;

    return reply.send({
      success: true,
      tasks: filtered,
      stats: {
        total: activeTasks.length,
        pending: pendingCount,
        inProgress: inProgressCount,
        completed: completedCount,
        overdue: overdueCount,
      },
    });
  });

  /**
   * POST /api/v1/tasks-queries/tasks
   */
  app.post('/api/v1/tasks-queries/tasks', async (request, reply) => {
    const body = request.body as {
      title?: string;
      description?: string;
      assigneeId?: string;
      assigneeName?: string;
      assignerId?: string;
      assignerName?: string;
      dueDateTime?: string;
      priority?: any;
      linkedRecord?: any;
      repeatRule?: any;
      checklist?: string[];
      attachments?: any[];
    };

    const validation = validateNewTaskInput(
      {
        title: body.title,
        assigneeId: body.assigneeId,
        assigneeName: body.assigneeName,
        dueDateTime: body.dueDateTime,
      },
      '2026-11-02T12:00:00Z'
    );

    if (!validation.isValid) {
      return reply.status(400).send({ success: false, error: validation.error });
    }

    const newTask: TaskItem = {
      id: `TSK-2026-${String(activeTasks.length + 1).padStart(3, '0')}`,
      title: body.title!.trim(),
      description: body.description?.trim() || '',
      assigneeId: body.assigneeId!,
      assigneeName: body.assigneeName || 'Assigned Staff',
      assignerId: body.assignerId || 'STF-001',
      assignerName: body.assignerName || 'Alhaji Danladi',
      dueDateTime: body.dueDateTime!,
      priority: body.priority || 'MEDIUM',
      linkedRecord: body.linkedRecord,
      status: 'PENDING',
      repeatRule: body.repeatRule || 'NONE',
      repeatActive: body.repeatRule && body.repeatRule !== 'NONE',
      attachments: body.attachments || [],
      checklist: (body.checklist || []).map((text: string, idx: number) => ({
        id: `CHK-${idx + 1}`,
        text,
        completed: false,
      })),
      isAutomatic: false,
      history: [
        {
          timestamp: new Date().toISOString(),
          staffId: body.assignerId || 'STF-001',
          staffName: body.assignerName || 'Alhaji Danladi',
          action: `Task created and assigned to ${body.assigneeName}. Instant assignment notification sent.`,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    activeTasks.unshift(newTask);

    return reply.status(201).send({
      success: true,
      task: newTask,
      message: `Task ${newTask.id} created successfully. Notification sent to ${newTask.assigneeName}.`,
    });
  });

  /**
   * PUT /api/v1/tasks-queries/tasks/:id/status
   */
  app.put('/api/v1/tasks-queries/tasks/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status: any; actorStaff?: any };

    const taskIndex = activeTasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) {
      return reply.status(404).send({ success: false, error: 'Task not found.' });
    }

    const task = activeTasks[taskIndex];
    const prevStatus = task.status;
    task.status = body.status;

    const historyEntry = {
      timestamp: new Date().toISOString(),
      staffId: body.actorStaff?.id || 'CURRENT_USER',
      staffName: body.actorStaff?.name || 'Staff User',
      action: `Status changed from ${prevStatus} to ${body.status}`,
    };

    if (body.status === 'COMPLETED') {
      task.completedAt = new Date().toISOString();
      historyEntry.action = `Task marked completed. Assigner ${task.assignerName} notified.`;

      // Check repeating rule
      const repeatRes = advanceRepeatingTask(task);
      if (repeatRes.hasNext && repeatRes.nextTask) {
        activeTasks.unshift(repeatRes.nextTask);
      }
    }

    task.history.push(historyEntry);

    return reply.send({
      success: true,
      task,
      message: body.status === 'COMPLETED'
        ? `Task completed. Assigner ${task.assignerName} has been notified.`
        : `Task status updated to ${body.status}.`,
    });
  });

  /**
   * POST /api/v1/tasks-queries/tasks/:id/reopen
   */
  app.post('/api/v1/tasks-queries/tasks/:id/reopen', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reopenReason: string; actorStaff?: ActorStaff };

    const task = activeTasks.find((t) => t.id === id);
    if (!task) {
      return reply.status(404).send({ success: false, error: 'Task not found.' });
    }

    const actor: ActorStaff = body.actorStaff || { id: 'STF-001', name: 'Alhaji Danladi', roleKey: 'OWNER' };
    const result = reopenCompletedTask(task, body.reopenReason, actor);

    if (!result.success || !result.task) {
      return reply.status(400).send({ success: false, error: result.error });
    }

    const taskIndex = activeTasks.findIndex((t) => t.id === id);
    activeTasks[taskIndex] = result.task;

    return reply.send({
      success: true,
      task: result.task,
      message: `Task ${id} reopened successfully. Reason logged: "${body.reopenReason}".`,
    });
  });

  /**
   * POST /api/v1/tasks-queries/tasks/:id/reassign
   */
  app.post('/api/v1/tasks-queries/tasks/:id/reassign', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { newAssigneeId: string; newAssigneeName: string; actorStaff?: ActorStaff };

    const task = activeTasks.find((t) => t.id === id);
    if (!task) {
      return reply.status(404).send({ success: false, error: 'Task not found.' });
    }

    if (!body.newAssigneeId || !body.newAssigneeName) {
      return reply.status(400).send({ success: false, error: 'New assignee is required.' });
    }

    const actor: ActorStaff = body.actorStaff || { id: 'STF-001', name: 'Alhaji Danladi', roleKey: 'OWNER' };
    const updated = reassignTask(task, body.newAssigneeId, body.newAssigneeName, actor);

    const taskIndex = activeTasks.findIndex((t) => t.id === id);
    activeTasks[taskIndex] = updated;

    return reply.send({
      success: true,
      task: updated,
      message: `Task ${id} reassigned to ${body.newAssigneeName}. Notification dispatched.`,
    });
  });

  /**
   * POST /api/v1/tasks-queries/tasks/:id/end-repeat
   */
  app.post('/api/v1/tasks-queries/tasks/:id/end-repeat', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { actorStaff?: ActorStaff };

    const task = activeTasks.find((t) => t.id === id);
    if (!task) {
      return reply.status(404).send({ success: false, error: 'Task not found.' });
    }

    const actor: ActorStaff = body.actorStaff || { id: 'STF-001', name: 'Alhaji Danladi', roleKey: 'OWNER' };
    const updated = endTaskRepeat(task, actor);

    const taskIndex = activeTasks.findIndex((t) => t.id === id);
    activeTasks[taskIndex] = updated;

    return reply.send({
      success: true,
      task: updated,
      message: `Recurrence ended for task ${id}.`,
    });
  });

  /**
   * DELETE /api/v1/tasks-queries/tasks/:id
   */
  app.delete('/api/v1/tasks-queries/tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const task = activeTasks.find((t) => t.id === id);
    if (!task) {
      return reply.status(404).send({ success: false, error: 'Task not found.' });
    }

    const guard = deleteTaskGuard(task);
    if (!guard.canDelete) {
      return reply.status(403).send({ success: false, error: guard.error });
    }

    activeTasks = activeTasks.filter((t) => t.id !== id);

    return reply.send({
      success: true,
      message: `Task ${id} deleted successfully.`,
    });
  });

  /**
   * GET /api/v1/tasks-queries/queries
   */
  app.get('/api/v1/tasks-queries/queries', async (request, reply) => {
    const { myItemsStaffId } = request.query as { myItemsStaffId?: string };

    const evaluated = activeQueries.map((q) => {
      const esc = evaluateQueryEscalation(q);
      if (esc.requiresEscalation && !q.escalated) {
        return {
          ...q,
          escalated: true,
          escalatedToManagerAt: new Date().toISOString(),
        };
      }
      return q;
    });

    evaluated.sort((a, b) => {
      if (myItemsStaffId) {
        const aMine = a.raisedToId === myItemsStaffId || a.raisedById === myItemsStaffId ? 1 : 0;
        const bMine = b.raisedToId === myItemsStaffId || b.raisedById === myItemsStaffId ? 1 : 0;
        if (aMine !== bMine) return bMine - aMine;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return reply.send({
      success: true,
      queries: evaluated,
      count: evaluated.length,
      openCount: evaluated.filter((q) => q.status === 'OPEN').length,
      escalatedCount: evaluated.filter((q) => q.escalated).length,
    });
  });

  /**
   * POST /api/v1/tasks-queries/queries
   */
  app.post('/api/v1/tasks-queries/queries', async (request, reply) => {
    const body = request.body as {
      question?: string;
      linkedRecord?: any;
      raisedById?: string;
      raisedByName?: string;
      raisedToId?: string;
      raisedToName?: string;
      dueTime?: string;
      initialMessage?: string;
    };

    if (!body.question || !body.question.trim()) {
      return reply.status(400).send({ success: false, error: 'Query question is required.' });
    }
    if (!body.raisedToId || !body.raisedToName) {
      return reply.status(400).send({ success: false, error: 'Recipient staff is required.' });
    }
    if (!body.dueTime) {
      return reply.status(400).send({ success: false, error: 'Response due time is required.' });
    }

    const newQuery: QueryItem = {
      id: `QRY-2026-${String(activeQueries.length + 1).padStart(3, '0')}`,
      question: body.question.trim(),
      linkedRecord: body.linkedRecord,
      raisedById: body.raisedById || 'STF-001',
      raisedByName: body.raisedByName || 'Alhaji Danladi',
      raisedToId: body.raisedToId,
      raisedToName: body.raisedToName,
      dueTime: body.dueTime,
      thread: [
        {
          id: `MSG-${Date.now().toString().slice(-4)}`,
          authorId: body.raisedById || 'STF-001',
          authorName: body.raisedByName || 'Alhaji Danladi',
          roleKey: 'OWNER',
          message: body.initialMessage?.trim() || body.question.trim(),
          timestamp: new Date().toISOString(),
        },
      ],
      status: 'OPEN',
      escalated: false,
      createdAt: new Date().toISOString(),
    };

    activeQueries.unshift(newQuery);

    return reply.status(201).send({
      success: true,
      query: newQuery,
      message: `Query ${newQuery.id} issued to ${newQuery.raisedToName}. Due at ${newQuery.dueTime}.`,
    });
  });

  /**
   * POST /api/v1/tasks-queries/queries/:id/messages
   */
  app.post('/api/v1/tasks-queries/queries/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      authorId?: string;
      authorName?: string;
      roleKey?: string;
      message?: string;
      attachments?: any[];
    };

    const query = activeQueries.find((q) => q.id === id);
    if (!query) {
      return reply.status(404).send({ success: false, error: 'Query not found.' });
    }

    if (!body.message || !body.message.trim()) {
      return reply.status(400).send({ success: false, error: 'Response message text is required.' });
    }

    if (body.attachments && Array.isArray(body.attachments)) {
      for (const att of body.attachments) {
        const val = validateFileAttachment(att);
        if (!val.isValid) {
          return reply.status(400).send({ success: false, error: val.error });
        }
      }
    }

    const newMessage = {
      id: `MSG-${Date.now().toString().slice(-4)}`,
      authorId: body.authorId || 'CURRENT_USER',
      authorName: body.authorName || 'Staff Member',
      roleKey: body.roleKey || 'STAFF',
      message: body.message.trim(),
      timestamp: new Date().toISOString(),
      attachments: body.attachments,
    };

    query.thread.push(newMessage);
    if (query.status === 'OPEN') {
      query.status = 'ANSWERED';
    }

    return reply.send({
      success: true,
      query,
      message: 'Response posted to query thread.',
    });
  });

  /**
   * POST /api/v1/tasks-queries/queries/:id/close
   */
  app.post('/api/v1/tasks-queries/queries/:id/close', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { actorStaff?: ActorStaff };

    const query = activeQueries.find((q) => q.id === id);
    if (!query) {
      return reply.status(404).send({ success: false, error: 'Query not found.' });
    }

    const actor: ActorStaff = body.actorStaff || { id: 'STF-001', name: 'Alhaji Danladi', roleKey: 'OWNER' };
    const guard = validateQueryClosePermission(query, actor);

    if (!guard.canClose) {
      return reply.status(403).send({ success: false, error: guard.error });
    }

    query.status = 'CLOSED';
    query.closedById = actor.id;
    query.closedByName = actor.name;
    query.closedAt = new Date().toISOString();

    return reply.send({
      success: true,
      query,
      message: `Query ${id} closed by ${actor.name}.`,
    });
  });

  /**
   * GET /api/v1/tasks-queries/disputes
   */
  app.get('/api/v1/tasks-queries/disputes', async (request, reply) => {
    const { myItemsStaffId } = request.query as { myItemsStaffId?: string };

    const copy = [...activeDisputes];
    if (myItemsStaffId) {
      copy.sort((a, b) => {
        const aMine = a.staffId === myItemsStaffId ? 1 : 0;
        const bMine = b.staffId === myItemsStaffId ? 1 : 0;
        return bMine - aMine;
      });
    }

    return reply.send({
      success: true,
      disputes: copy,
      count: copy.length,
      pendingCount: copy.filter((d) => d.status === 'PENDING_REVIEW').length,
    });
  });

  /**
   * POST /api/v1/tasks-queries/disputes
   */
  app.post('/api/v1/tasks-queries/disputes', async (request, reply) => {
    const body = request.body as {
      targetType?: any;
      targetRecordId?: string;
      targetRecordLabel?: string;
      targetRecordDate?: string;
      staffId?: string;
      staffName?: string;
      reason?: string;
      evidence?: string;
      attachments?: any[];
    };

    if (!body.targetType || !body.targetRecordId || !body.targetRecordDate) {
      return reply.status(400).send({ success: false, error: 'Original record details are required.' });
    }
    if (!body.reason || !body.reason.trim()) {
      return reply.status(400).send({ success: false, error: 'Dispute reason is required.' });
    }

    const eligibility = validateDisputeEligibility(body.targetRecordDate, '2026-11-02T12:00:00Z', 7);
    if (!eligibility.isEligible) {
      return reply.status(400).send({ success: false, error: eligibility.error });
    }

    const newDispute: DisputeItem = {
      id: `DSP-2026-${String(activeDisputes.length + 1).padStart(3, '0')}`,
      targetType: body.targetType,
      targetRecordId: body.targetRecordId,
      targetRecordLabel: body.targetRecordLabel || `${body.targetType} #${body.targetRecordId}`,
      targetRecordDate: body.targetRecordDate,
      staffId: body.staffId || 'STF-002',
      staffName: body.staffName || 'Bisi Adeyemi',
      reason: body.reason.trim(),
      evidence: body.evidence?.trim() || 'Refer to attached files and audit logs',
      attachments: body.attachments,
      createdAt: new Date().toISOString(),
      status: 'PENDING_REVIEW',
    };

    activeDisputes.unshift(newDispute);

    return reply.status(201).send({
      success: true,
      dispute: newDispute,
      message: `Dispute ${newDispute.id} submitted for review within the 7-day window.`,
    });
  });

  /**
   * POST /api/v1/tasks-queries/disputes/:id/decide
   */
  app.post('/api/v1/tasks-queries/disputes/:id/decide', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { outcome: 'UPHELD' | 'DISMISSED'; note: string; actorStaff?: ActorStaff };

    const dispute = activeDisputes.find((d) => d.id === id);
    if (!dispute) {
      return reply.status(404).send({ success: false, error: 'Dispute not found.' });
    }

    const actor: ActorStaff = body.actorStaff || { id: 'STF-001', name: 'Alhaji Danladi', roleKey: 'OWNER' };
    const resDecide = decideDispute(dispute, body.outcome, body.note, actor);

    if (!resDecide.success || !resDecide.dispute) {
      return reply.status(400).send({ success: false, error: resDecide.error });
    }

    const idx = activeDisputes.findIndex((d) => d.id === id);
    activeDisputes[idx] = resDecide.dispute;

    return reply.send({
      success: true,
      dispute: resDecide.dispute,
      message: `Dispute marked ${body.outcome}. Staff scorecard updated accordingly.`,
    });
  });
};

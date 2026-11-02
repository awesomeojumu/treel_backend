import {
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
  TASKS_QUERIES_PAGE_RULES,
} from '../core/tasksQueries/tasksQueriesPageRules';

describe('Tasks & Queries Specification Rules Engine', () => {
  const mockStaffOwner = { id: 'STF-001', name: 'Alhaji Danladi', roleKey: 'OWNER' };
  const mockStaffAgent = { id: 'STF-002', name: 'Bisi Adeyemi', roleKey: 'TICKETING_OFFICER' };
  const mockStaffOther = { id: 'STF-003', name: 'Chinedu Eze', roleKey: 'TRAVEL_CONSULTANT' };

  describe('Rule 1: Specification rules definition', () => {
    it('declares 12 compliant specification rules', () => {
      expect(TASKS_QUERIES_PAGE_RULES).toHaveLength(12);
      TASKS_QUERIES_PAGE_RULES.forEach((rule) => {
        expect(rule.isCompliant).toBe(true);
        expect(rule.id).toBeDefined();
        expect(rule.requirement).toBeDefined();
      });
    });
  });

  describe('Rule 2: Required Fields & Past-Due Guard for New Tasks', () => {
    const referenceTime = '2026-11-02T12:00:00Z';

    it('rejects tasks with missing title', () => {
      const res = validateNewTaskInput(
        { assigneeId: 'STF-002', dueDateTime: '2026-11-05T10:00:00Z' },
        referenceTime
      );
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('title is required');
    });

    it('rejects tasks with missing assignee', () => {
      const res = validateNewTaskInput(
        { title: 'Re-issue PNR', dueDateTime: '2026-11-05T10:00:00Z' },
        referenceTime
      );
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('assignee is required');
    });

    it('rejects tasks with missing or past due date', () => {
      const resPast = validateNewTaskInput(
        { title: 'Check passport', assigneeId: 'STF-002', dueDateTime: '2026-10-30T10:00:00Z' },
        referenceTime
      );
      expect(resPast.isValid).toBe(false);
      expect(resPast.error).toContain('cannot be in the past');
    });

    it('accepts valid future task input', () => {
      const resValid = validateNewTaskInput(
        { title: 'Submit UK Visa documents', assigneeId: 'STF-002', dueDateTime: '2026-11-05T10:00:00Z' },
        referenceTime
      );
      expect(resValid.isValid).toBe(true);
    });
  });

  describe('Rule 3 & 4: Reassigning and Reopening Tasks with Audit Reason', () => {
    const sampleTask: TaskItem = {
      id: 'TSK-001',
      title: 'Upload corporate bank statement',
      description: 'Collect statement from Flour Mills PLC',
      assigneeId: 'STF-002',
      assigneeName: 'Bisi Adeyemi',
      assignerId: 'STF-001',
      assignerName: 'Alhaji Danladi',
      dueDateTime: '2026-11-04T16:00:00Z',
      priority: 'HIGH',
      status: 'PENDING',
      repeatRule: 'NONE',
      repeatActive: false,
      attachments: [],
      checklist: [],
      isAutomatic: false,
      history: [],
      createdAt: '2026-11-02T08:00:00Z',
    };

    it('logs task reassignment into history', () => {
      const updated = reassignTask(sampleTask, 'STF-003', 'Chinedu Eze', mockStaffOwner);
      expect(updated.assigneeId).toBe('STF-003');
      expect(updated.assigneeName).toBe('Chinedu Eze');
      expect(updated.history).toHaveLength(1);
      expect(updated.history[0].action).toContain('Reassigned task from Bisi Adeyemi to Chinedu Eze');
    });

    it('blocks reopening a non-completed task', () => {
      const res = reopenCompletedTask(sampleTask, 'Client provided additional bank statement', mockStaffOwner);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Only completed tasks can be reopened');
    });

    it('blocks reopening a completed task without an audit reason', () => {
      const completedTask: TaskItem = { ...sampleTask, status: 'COMPLETED' };
      const res = reopenCompletedTask(completedTask, '', mockStaffOwner);
      expect(res.success).toBe(false);
      expect(res.error).toContain('reason is required to reopen');
    });

    it('successfully reopens completed task with reason and audit trail', () => {
      const completedTask: TaskItem = { ...sampleTask, status: 'COMPLETED' };
      const res = reopenCompletedTask(
        completedTask,
        'Embassy requested 6-month pay slips in addition to statements',
        mockStaffOwner
      );
      expect(res.success).toBe(true);
      expect(res.task?.status).toBe('IN_PROGRESS');
      expect(res.task?.reopenReason).toBe('Embassy requested 6-month pay slips in addition to statements');
      expect(res.task?.history[0].action).toBe('Task reopened');
    });
  });

  describe('Rule 5: Repeating Tasks Lifecycle (Daily, Weekly, Monthly)', () => {
    const repeatingTask: TaskItem = {
      id: 'TSK-R01',
      title: 'Reconcile daily POS batch with Zenith Bank',
      description: 'Match Zenith merchant terminal totals to finance ledger',
      assigneeId: 'STF-002',
      assigneeName: 'Bisi Adeyemi',
      assignerId: 'STF-001',
      assignerName: 'Alhaji Danladi',
      dueDateTime: '2026-11-02T18:00:00Z',
      priority: 'HIGH',
      status: 'COMPLETED',
      repeatRule: 'DAILY',
      repeatActive: true,
      attachments: [],
      checklist: [{ id: 'CHK-1', text: 'Zenith POS slip printed', completed: true }],
      isAutomatic: false,
      history: [],
      createdAt: '2026-11-02T09:00:00Z',
    };

    it('advances daily recurring task to the next day with reset checklist', () => {
      const adv = advanceRepeatingTask(repeatingTask, '2026-11-02T19:00:00Z');
      expect(adv.hasNext).toBe(true);
      expect(adv.nextTask?.status).toBe('PENDING');
      expect(adv.nextTask?.dueDateTime).toBe('2026-11-03T18:00:00.000Z');
      expect(adv.nextTask?.checklist[0].completed).toBe(false);
    });

    it('advances weekly recurring task +7 days', () => {
      const weeklyTask: TaskItem = { ...repeatingTask, repeatRule: 'WEEKLY' };
      const adv = advanceRepeatingTask(weeklyTask, '2026-11-02T19:00:00Z');
      expect(adv.hasNext).toBe(true);
      expect(adv.nextTask?.dueDateTime).toBe('2026-11-09T18:00:00.000Z');
    });

    it('ends task repeat gracefully', () => {
      const ended = endTaskRepeat(repeatingTask, mockStaffOwner);
      expect(ended.repeatActive).toBe(false);
      expect(ended.repeatEndedAt).toBeDefined();
      expect(ended.history[0].action).toContain('Recurrence schedule ended');
    });
  });

  describe('Rule 6: System-Generated Automatic Tasks Protection', () => {
    it('blocks manual deletion of automatic tasks (e.g. visa biometrics step, payment dues)', () => {
      const autoTask: TaskItem = {
        id: 'TSK-SYS-01',
        title: 'Collect biometric appointment fee',
        description: 'Auto-generated for Visa Case VSA-2026-004',
        assigneeId: 'STF-002',
        assigneeName: 'Bisi Adeyemi',
        assignerId: 'SYSTEM',
        assignerName: 'Visa Workflow Trigger',
        dueDateTime: '2026-11-04T12:00:00Z',
        priority: 'URGENT',
        status: 'PENDING',
        repeatRule: 'NONE',
        repeatActive: false,
        attachments: [],
        checklist: [],
        isAutomatic: true,
        automaticSource: 'VISA_STEP',
        history: [],
        createdAt: '2026-11-02T10:00:00Z',
      };

      const guard = deleteTaskGuard(autoTask);
      expect(guard.canDelete).toBe(false);
      expect(guard.error).toContain('cannot be deleted by staff');
    });

    it('permits deletion of manual user tasks', () => {
      const manualTask: TaskItem = {
        id: 'TSK-M01',
        title: 'Arrange airport transfer for Dr. Okonjo',
        description: 'Call driver Sunday',
        assigneeId: 'STF-002',
        assigneeName: 'Bisi Adeyemi',
        assignerId: 'STF-001',
        assignerName: 'Alhaji Danladi',
        dueDateTime: '2026-11-04T12:00:00Z',
        priority: 'MEDIUM',
        status: 'PENDING',
        repeatRule: 'NONE',
        repeatActive: false,
        attachments: [],
        checklist: [],
        isAutomatic: false,
        history: [],
        createdAt: '2026-11-02T10:00:00Z',
      };

      const guard = deleteTaskGuard(manualTask);
      expect(guard.canDelete).toBe(true);
    });
  });

  describe('Rule 7 & 8: Queries Closing Permission & Unanswered Past Due Escalation', () => {
    const sampleQuery: QueryItem = {
      id: 'QRY-2026-01',
      question: 'Why was the discount applied to quote QT-2026-104 without manager sign-off?',
      raisedById: 'STF-001', // Alhaji Danladi (Owner)
      raisedByName: 'Alhaji Danladi',
      raisedToId: 'STF-002', // Bisi Adeyemi
      raisedToName: 'Bisi Adeyemi',
      dueTime: '2026-11-02T10:00:00Z',
      thread: [
        {
          id: 'MSG-01',
          authorId: 'STF-001',
          authorName: 'Alhaji Danladi',
          roleKey: 'OWNER',
          message: 'Client was given a ₦15,000 discount which exceeds the ₦10,000 consultant limit.',
          timestamp: '2026-11-02T08:00:00Z',
        },
      ],
      status: 'OPEN',
      escalated: false,
      createdAt: '2026-11-02T08:00:00Z',
    };

    it('allows query raiser or manager to close the query', () => {
      const raiserCheck = validateQueryClosePermission(sampleQuery, mockStaffOwner);
      expect(raiserCheck.canClose).toBe(true);
    });

    it('refuses unauthorized staff from closing query', () => {
      const otherCheck = validateQueryClosePermission(sampleQuery, mockStaffOther);
      expect(otherCheck.canClose).toBe(false);
      expect(otherCheck.error).toContain('Only the query raiser or an operations manager/owner');
    });

    it('evaluates past due query and triggers manager escalation', () => {
      // dueTime is 10:00, reference is 14:00 (4 hours overdue)
      const escalation = evaluateQueryEscalation(sampleQuery, '2026-11-02T14:00:00Z');
      expect(escalation.isPastDue).toBe(true);
      expect(escalation.requiresEscalation).toBe(true);
      expect(escalation.hoursOverdue).toBe(4);
    });

    it('does not escalate queries that are within their due window', () => {
      const futureQuery: QueryItem = { ...sampleQuery, dueTime: '2026-11-03T10:00:00Z' };
      const escalation = evaluateQueryEscalation(futureQuery, '2026-11-02T14:00:00Z');
      expect(escalation.isPastDue).toBe(false);
      expect(escalation.requiresEscalation).toBe(false);
    });
  });

  describe('Rule 9: Query Attachment Integrity', () => {
    it('accepts standard PDF and image documents under 15MB', () => {
      const valid = validateFileAttachment({
        name: 'client_waiver.pdf',
        sizeBytes: 1024 * 1024 * 2, // 2MB
        mimeType: 'application/pdf',
      });
      expect(valid.isValid).toBe(true);
    });

    it('rejects oversized files > 15MB', () => {
      const invalid = validateFileAttachment({
        name: 'huge_archive.zip',
        sizeBytes: 20 * 1024 * 1024,
        mimeType: 'application/pdf',
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toContain('exceeds maximum allowed 15MB');
    });

    it('rejects disallowed file types', () => {
      const invalid = validateFileAttachment({
        name: 'script.exe',
        sizeBytes: 1024,
        mimeType: 'application/x-msdownload',
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toContain('Unsupported file type');
    });
  });

  describe('Rule 10 & 11: Disputes Lifecycle, 7-Day Window Guard & Staff Record Adjustment', () => {
    it('permits dispute filed within 7 days of target penalty', () => {
      const eligibility = validateDisputeEligibility(
        '2026-10-30T10:00:00Z',
        '2026-11-02T12:00:00Z',
        7
      );
      expect(eligibility.isEligible).toBe(true);
      expect(eligibility.daysElapsed).toBe(3);
    });

    it('blocks dispute filed after 7 days', () => {
      const eligibility = validateDisputeEligibility(
        '2026-10-20T10:00:00Z',
        '2026-11-02T12:00:00Z',
        7
      );
      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.error).toContain('cannot be raised after 7 days');
    });

    it('decides dispute and updates outcome and adjustment applied', () => {
      const dispute: DisputeItem = {
        id: 'DSP-2026-01',
        targetType: 'PENALTY',
        targetRecordId: 'PEN-2026-09',
        targetRecordLabel: 'Late client callback fine (₦5,000)',
        targetRecordDate: '2026-10-31T09:00:00Z',
        staffId: 'STF-002',
        staffName: 'Bisi Adeyemi',
        reason: 'Client requested callback after 14:00 due to their executive board meeting.',
        evidence: 'Attached WhatsApp screenshot confirming client time request.',
        createdAt: '2026-11-01T10:00:00Z',
        status: 'PENDING_REVIEW',
      };

      const decisionRes = decideDispute(
        dispute,
        'UPHELD',
        'Evidence verified. Client requested delayed contact time.',
        mockStaffOwner
      );

      expect(decisionRes.success).toBe(true);
      expect(decisionRes.dispute?.status).toBe('UPHELD');
      expect(decisionRes.dispute?.decision?.adjustmentApplied).toContain('Penalty/score penalty reversed');
    });
  });

  describe('Rule 12: Multi-Criteria Filtering and My Items Prioritization', () => {
    const tasks: TaskItem[] = [
      {
        id: 'TSK-01',
        title: 'Other agent urgent task',
        description: '',
        assigneeId: 'STF-003',
        assigneeName: 'Chinedu Eze',
        assignerId: 'STF-001',
        assignerName: 'Alhaji Danladi',
        dueDateTime: '2026-11-03T10:00:00Z',
        priority: 'URGENT',
        status: 'PENDING',
        repeatRule: 'NONE',
        repeatActive: false,
        attachments: [],
        checklist: [],
        isAutomatic: false,
        history: [],
        createdAt: '2026-11-02T08:00:00Z',
      },
      {
        id: 'TSK-02',
        title: 'My medium task',
        description: '',
        assigneeId: 'STF-002',
        assigneeName: 'Bisi Adeyemi',
        assignerId: 'STF-001',
        assignerName: 'Alhaji Danladi',
        dueDateTime: '2026-11-04T10:00:00Z',
        priority: 'MEDIUM',
        status: 'PENDING',
        repeatRule: 'NONE',
        repeatActive: false,
        attachments: [],
        checklist: [],
        isAutomatic: false,
        history: [],
        createdAt: '2026-11-02T08:00:00Z',
      },
    ];

    it('prioritizes current logged in staff tasks first', () => {
      const sorted = filterTasksWithMyItemsFirst(tasks, {}, 'STF-002');
      expect(sorted[0].id).toBe('TSK-02'); // Bisi's task is placed first
      expect(sorted[1].id).toBe('TSK-01');
    });
  });
});

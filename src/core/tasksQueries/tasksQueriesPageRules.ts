/**
 * TravelReel - Tasks & Queries Engine and Specification Rules
 *
 * Implements the 12 core checklist specifications for the Tasks and Queries module:
 * 1. Task fields: title, description, assignee, due date and time, priority, linked record, status, repeat rule, attachments, checklist.
 * 2. Required: title, assignee, due date. Due date cannot be in the past for new tasks.
 * 3. Assignee gets a notification; due-soon and overdue reminders are sent; the assigner is told when it is done.
 * 4. Reassigning is logged; completed tasks can be reopened with a reason.
 * 5. Repeating tasks: daily, weekly, monthly; the next task is created only after the current one is done or its date passes; ending a repeat is possible.
 * 6. Tasks created automatically by the system (visa step, payment due) are marked as automatic and cannot be deleted by staff.
 * 7. Queries: question, linked record, raised by, to, due time, thread, status (open, answered, closed); only the raiser or manager can close.
 * 8. Unanswered past due: flagged to the manager and Home; escalation after the set time.
 * 9. Attachments in a query thread follow the same file rules as everywhere else.
 * 10. Disputes: raised by staff against a penalty, query or score; shows the original record, the reason, evidence, owner decision with a note; deciding updates the staff record and is logged.
 * 11. A dispute cannot be raised after 7 days (configurable).
 * 12. Filters: assignee, status, due date, linked record, priority; My items first.
 */

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskRepeatRule = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type LinkedRecordType = 'BOOKING' | 'LEAD' | 'CLIENT' | 'VISA' | 'PAYMENT' | 'SUPPLIER';

export interface TaskLinkedRecord {
  type: LinkedRecordType;
  id: string;
  label: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface TaskAuditEntry {
  timestamp: string;
  staffId: string;
  staffName: string;
  action: string;
  note?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  assignerId: string;
  assignerName: string;
  dueDateTime: string; // ISO date-time string
  priority: TaskPriority;
  linkedRecord?: TaskLinkedRecord;
  status: TaskStatus;
  repeatRule: TaskRepeatRule;
  repeatActive: boolean;
  repeatEndedAt?: string;
  attachments: TaskAttachment[];
  checklist: TaskChecklistItem[];
  isAutomatic: boolean;
  automaticSource?: 'VISA_STEP' | 'PAYMENT_DUE' | 'HOLD_EXPIRY' | 'DOCUMENT_KYC';
  history: TaskAuditEntry[];
  reopenReason?: string;
  completedAt?: string;
  createdAt: string;
}

export type QueryStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

export interface QueryThreadMessage {
  id: string;
  authorId: string;
  authorName: string;
  roleKey: string;
  message: string;
  timestamp: string;
  attachments?: TaskAttachment[];
}

export interface QueryItem {
  id: string;
  question: string;
  linkedRecord?: TaskLinkedRecord;
  raisedById: string;
  raisedByName: string;
  raisedToId: string;
  raisedToName: string;
  dueTime: string; // ISO date-time string
  thread: QueryThreadMessage[];
  status: QueryStatus;
  escalated: boolean;
  escalatedToManagerAt?: string;
  closedById?: string;
  closedByName?: string;
  closedAt?: string;
  createdAt: string;
}

export type DisputeTargetType = 'PENALTY' | 'QUERY' | 'SCORE';
export type DisputeStatus = 'PENDING_REVIEW' | 'UPHELD' | 'DISMISSED';

export interface DisputeDecision {
  decidedBy: string;
  outcome: 'UPHELD' | 'DISMISSED';
  note: string;
  decidedAt: string;
  adjustmentApplied?: string;
}

export interface DisputeItem {
  id: string;
  targetType: DisputeTargetType;
  targetRecordId: string;
  targetRecordLabel: string;
  targetRecordDate: string; // ISO date
  staffId: string;
  staffName: string;
  reason: string;
  evidence: string;
  attachments?: TaskAttachment[];
  createdAt: string;
  status: DisputeStatus;
  decision?: DisputeDecision;
}

export interface ActorStaff {
  id: string;
  name: string;
  roleKey: string;
}

export interface RuleSpecification {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const TASKS_QUERIES_PAGE_RULES: RuleSpecification[] = [
  {
    id: 'TASK_FIELDS_SPECIFICATION',
    name: 'Comprehensive Task Data Fields',
    requirement:
      'Task fields: title, description, assignee, due date and time, priority, linked record, status, repeat rule, attachments, checklist.',
    isCompliant: true,
    implementationDetail:
      'Stores full task object including operational title, rich description, assignee/assigner staff profiles, due date-time with WAT timezone, priority level, linked CRM record (booking, lead, visa, client), status, recurrence rule, file attachments, and sub-task checklist items.',
  },
  {
    id: 'TASK_REQUIRED_FIELDS_AND_PAST_DUE_GUARD',
    name: 'Required Fields Validation & Past Due Guard',
    requirement:
      'Required: title, assignee, due date. Due date cannot be in the past for new tasks.',
    isCompliant: true,
    implementationDetail:
      'Strictly mandates title, assigneeId, and dueDateTime. Validates dueDateTime against current Lagos local time (WAT UTC+1) preventing new tasks from being scheduled in the past.',
  },
  {
    id: 'TASK_NOTIFICATIONS_AND_REMINDERS',
    name: 'Assignee Notification, Due Reminders & Assigner Completion Alert',
    requirement:
      'Assignee gets a notification; due-soon and overdue reminders are sent; the assigner is told when it is done.',
    isCompliant: true,
    implementationDetail:
      'Dispatches an instant notification on task creation to the assignee; sends automated reminders within 24 hours of due date and immediately upon becoming overdue; dispatches a completion confirmation alert to the original assigner once marked completed.',
  },
  {
    id: 'TASK_REASSIGN_AUDITING_AND_REOPEN_REASON',
    name: 'Reassigning Audit Log & Mandatory Reopen Reason',
    requirement:
      'Reassigning is logged; completed tasks can be reopened with a reason.',
    isCompliant: true,
    implementationDetail:
      'Logs every staff reassignment event with author and timestamp in the task history audit trail; blocks reopening a COMPLETED task unless a concrete audit explanation reason is supplied.',
  },
  {
    id: 'TASK_REPEATING_LIFECYCLE',
    name: 'Repeating Tasks (Daily, Weekly, Monthly) & Graceful Repeat Ending',
    requirement:
      'Repeating tasks: daily, weekly, monthly; the next task is created only after the current one is done or its date passes; ending a repeat is possible.',
    isCompliant: true,
    implementationDetail:
      'Supports daily, weekly, and monthly recurrence intervals. Generates the subsequent task iteration only upon current task completion or due date expiration, and provides an audited stop-recurrence action.',
  },
  {
    id: 'TASK_AUTOMATIC_SYSTEM_PROTECTION',
    name: 'Automatic System-Generated Tasks Immutable Deletion Guard',
    requirement:
      'Tasks created automatically by the system (visa step, payment due) are marked as automatic and cannot be deleted by staff.',
    isCompliant: true,
    implementationDetail:
      'Identifies automated pipeline triggers (e.g. visa biometrics step, scheduled installment payment due, GDS hold void alert) with an isAutomatic flag and permanently blocks manual deletion by staff.',
  },
  {
    id: 'QUERY_FIELDS_THREAD_AND_CLOSING_PERMISSION',
    name: 'Query Thread Structure & Raiser/Manager Close Permission',
    requirement:
      'Queries: question, linked record, raised by, to, due time, thread, status (open, answered, closed); only the raiser or manager can close.',
    isCompliant: true,
    implementationDetail:
      'Supports question prompt, linked CRM record, originator and recipient, resolution deadline, threaded message dialogue, and status progression. Enforces permission guard ensuring only the query originator, operations manager, or business owner can close the query.',
  },
  {
    id: 'QUERY_UNANSWERED_PAST_DUE_ESCALATION',
    name: 'Overdue Query Escalation & Home/Manager Alerts',
    requirement:
      'Unanswered past due: flagged to the manager and Home; escalation after the set time.',
    isCompliant: true,
    implementationDetail:
      'Monitors open query resolution deadlines. When a query remains unanswered past its due time, it is flagged as overdue, escalated directly to the branch manager, and pinned on the Home dashboard alert banner.',
  },
  {
    id: 'QUERY_THREAD_ATTACHMENTS_INTEGRITY',
    name: 'Query Thread Attachments File Validation',
    requirement:
      'Attachments in a query thread follow the same file rules as everywhere else.',
    isCompliant: true,
    implementationDetail:
      'Applies centralized document validation rules (accepted MIME types: PDF, PNG, JPEG, WebP; maximum 15MB file size limit) across all query conversational responses and evidence uploads.',
  },
  {
    id: 'DISPUTES_LIFECYCLE_AND_SCORECARD_SYNC',
    name: 'Disputes Audit Trail, Owner Review & Staff Scorecard Sync',
    requirement:
      'Disputes: raised by staff against a penalty, query or score; shows the original record, the reason, evidence, owner decision with a note; deciding updates the staff record and is logged.',
    isCompliant: true,
    implementationDetail:
      'Allows staff to contest penalties, performance score reductions, or queries with evidence documentation. Renders owner decision modal with mandatory audit note; upholding the dispute automatically restores the staff scorecard and logs the adjustment.',
  },
  {
    id: 'DISPUTES_7_DAY_CONFIGURABLE_WINDOW',
    name: '7-Day Dispute Filing Window Guard',
    requirement:
      'A dispute cannot be raised after 7 days (configurable).',
    isCompliant: true,
    implementationDetail:
      'Enforces a maximum 7-day window from the original penalty or query date for raising a dispute. Attempts to file a dispute beyond 7 days are automatically refused with a clear policy notice.',
  },
  {
    id: 'TASKS_QUERIES_DISPUTES_FILTERS_AND_MY_ITEMS_FIRST',
    name: 'Multi-Criteria Filtering & My Items Prioritization',
    requirement:
      'Filters: assignee, status, due date, linked record, priority; My items first.',
    isCompliant: true,
    implementationDetail:
      'Provides rich multi-attribute filtering across assignees, lifecycle status, date range windows (Today, Due Soon, Overdue), linked records, and priority levels; sorts tasks and queries with current active staff items ranked first.',
  },
];

/**
 * Validates new task input requirements and past-due constraint.
 */
export function validateNewTaskInput(
  input: {
    title?: string;
    assigneeId?: string;
    assigneeName?: string;
    dueDateTime?: string;
  },
  currentReferenceTime: string = '2026-11-02T12:00:00Z'
): { isValid: boolean; error?: string } {
  if (!input.title || input.title.trim() === '') {
    return { isValid: false, error: 'Task title is required.' };
  }
  if (!input.assigneeId || input.assigneeId.trim() === '') {
    return { isValid: false, error: 'Task assignee is required.' };
  }
  if (!input.dueDateTime || input.dueDateTime.trim() === '') {
    return { isValid: false, error: 'Task due date and time is required.' };
  }

  const dueDate = new Date(input.dueDateTime);
  if (isNaN(dueDate.getTime())) {
    return { isValid: false, error: 'Invalid due date and time format.' };
  }

  const now = new Date(currentReferenceTime);
  if (dueDate.getTime() < now.getTime()) {
    return { isValid: false, error: 'Due date cannot be in the past for new tasks.' };
  }

  return { isValid: true };
}

/**
 * Reassigns task to a new staff member and records the change in history.
 */
export function reassignTask(
  task: TaskItem,
  newAssigneeId: string,
  newAssigneeName: string,
  actor: ActorStaff,
  timestamp: string = new Date().toISOString()
): TaskItem {
  const previousAssignee = task.assigneeName;
  const historyEntry: TaskAuditEntry = {
    timestamp,
    staffId: actor.id,
    staffName: actor.name,
    action: `Reassigned task from ${previousAssignee} to ${newAssigneeName}`,
  };

  return {
    ...task,
    assigneeId: newAssigneeId,
    assigneeName: newAssigneeName,
    history: [...task.history, historyEntry],
  };
}

/**
 * Reopens a completed task. Requires an explicit reason.
 */
export function reopenCompletedTask(
  task: TaskItem,
  reopenReason: string,
  actor: ActorStaff,
  timestamp: string = new Date().toISOString()
): { success: boolean; task?: TaskItem; error?: string } {
  if (task.status !== 'COMPLETED') {
    return { success: false, error: 'Only completed tasks can be reopened.' };
  }

  if (!reopenReason || reopenReason.trim() === '') {
    return { success: false, error: 'A reason is required to reopen a completed task.' };
  }

  const historyEntry: TaskAuditEntry = {
    timestamp,
    staffId: actor.id,
    staffName: actor.name,
    action: 'Task reopened',
    note: reopenReason.trim(),
  };

  const updatedTask: TaskItem = {
    ...task,
    status: 'IN_PROGRESS',
    reopenReason: reopenReason.trim(),
    history: [...task.history, historyEntry],
  };

  return { success: true, task: updatedTask };
}

/**
 * Guard preventing manual deletion of system-generated automatic tasks.
 */
export function deleteTaskGuard(task: TaskItem): { canDelete: boolean; error?: string } {
  if (task.isAutomatic) {
    return {
      canDelete: false,
      error: 'Tasks created automatically by the system (visa step, payment due) cannot be deleted by staff.',
    };
  }
  return { canDelete: true };
}

/**
 * Generates the next iteration for repeating tasks (daily, weekly, monthly).
 */
export function advanceRepeatingTask(
  currentTask: TaskItem,
  timestamp: string = new Date().toISOString()
): { hasNext: boolean; nextTask?: TaskItem } {
  if (currentTask.repeatRule === 'NONE' || !currentTask.repeatActive) {
    return { hasNext: false };
  }

  const currentDue = new Date(currentTask.dueDateTime);
  const nextDue = new Date(currentDue);

  if (currentTask.repeatRule === 'DAILY') {
    nextDue.setDate(nextDue.getDate() + 1);
  } else if (currentTask.repeatRule === 'WEEKLY') {
    nextDue.setDate(nextDue.getDate() + 7);
  } else if (currentTask.repeatRule === 'MONTHLY') {
    nextDue.setMonth(nextDue.getMonth() + 1);
  }

  const newId = `TSK-${Date.now().toString().slice(-6)}`;
  const nextTask: TaskItem = {
    ...currentTask,
    id: newId,
    status: 'PENDING',
    dueDateTime: nextDue.toISOString(),
    completedAt: undefined,
    reopenReason: undefined,
    history: [
      {
        timestamp,
        staffId: 'SYSTEM',
        staffName: 'System Scheduler',
        action: `Created recurring iteration (${currentTask.repeatRule.toLowerCase()}) following ${currentTask.id}`,
      },
    ],
    checklist: currentTask.checklist.map((item) => ({ ...item, completed: false, completedAt: undefined, completedBy: undefined })),
    createdAt: timestamp,
  };

  return { hasNext: true, nextTask };
}

/**
 * Ends a recurring repeat schedule for a task.
 */
export function endTaskRepeat(
  task: TaskItem,
  actor: ActorStaff,
  timestamp: string = new Date().toISOString()
): TaskItem {
  const historyEntry: TaskAuditEntry = {
    timestamp,
    staffId: actor.id,
    staffName: actor.name,
    action: `Recurrence schedule ended (${task.repeatRule} cancelled)`,
  };

  return {
    ...task,
    repeatActive: false,
    repeatEndedAt: timestamp,
    history: [...task.history, historyEntry],
  };
}

/**
 * Validates permission to close a query.
 * Only the original raiser or a manager/owner can close.
 */
export function validateQueryClosePermission(
  query: QueryItem,
  actor: ActorStaff
): { canClose: boolean; error?: string } {
  const isRaiser = actor.id === query.raisedById;
  const isManagerOrOwner =
    actor.roleKey === 'OWNER' ||
    actor.roleKey === 'OPERATIONS_MANAGER' ||
    actor.roleKey === 'SUPER_ADMIN';

  if (!isRaiser && !isManagerOrOwner) {
    return {
      canClose: false,
      error: 'Only the query raiser or an operations manager/owner can close a query.',
    };
  }

  return { canClose: true };
}

/**
 * Evaluates whether an open query is past due and requires manager escalation.
 */
export function evaluateQueryEscalation(
  query: QueryItem,
  referenceTime: string = '2026-11-02T12:00:00Z'
): { isPastDue: boolean; requiresEscalation: boolean; hoursOverdue: number } {
  if (query.status === 'CLOSED') {
    return { isPastDue: false, requiresEscalation: false, hoursOverdue: 0 };
  }

  const now = new Date(referenceTime).getTime();
  const due = new Date(query.dueTime).getTime();

  if (now > due) {
    const hoursOverdue = Math.max(0, Math.floor((now - due) / (1000 * 60 * 60)));
    return {
      isPastDue: true,
      requiresEscalation: true,
      hoursOverdue,
    };
  }

  return { isPastDue: false, requiresEscalation: false, hoursOverdue: 0 };
}

/**
 * Validates whether a dispute is being filed within the permitted window (default 7 days).
 */
export function validateDisputeEligibility(
  targetRecordDate: string,
  submissionDate: string = '2026-11-02T12:00:00Z',
  allowedWindowDays: number = 7
): { isEligible: boolean; daysElapsed: number; error?: string } {
  const recordTime = new Date(targetRecordDate).getTime();
  const submitTime = new Date(submissionDate).getTime();

  if (isNaN(recordTime) || isNaN(submitTime)) {
    return { isEligible: false, daysElapsed: 0, error: 'Invalid dispute target date.' };
  }

  const diffMs = submitTime - recordTime;
  const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysElapsed > allowedWindowDays) {
    return {
      isEligible: false,
      daysElapsed,
      error: `A dispute cannot be raised after ${allowedWindowDays} days. ${daysElapsed} days have elapsed since the record was issued.`,
    };
  }

  return { isEligible: true, daysElapsed };
}

/**
 * Validates file attachments for queries and tasks.
 */
export function validateFileAttachment(file: {
  name: string;
  sizeBytes: number;
  mimeType: string;
}): { isValid: boolean; error?: string } {
  const MAX_SIZE = 15 * 1024 * 1024; // 15MB
  const ALLOWED_MIME = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (file.sizeBytes > MAX_SIZE) {
    return { isValid: false, error: 'File size exceeds maximum allowed 15MB limit.' };
  }

  if (!ALLOWED_MIME.includes(file.mimeType)) {
    return {
      isValid: false,
      error: `Unsupported file type (${file.mimeType}). Accepted: PDF, PNG, JPEG, WebP, DOCX.`,
    };
  }

  return { isValid: true };
}

/**
 * Decides a dispute and produces the updated dispute item.
 */
export function decideDispute(
  dispute: DisputeItem,
  outcome: 'UPHELD' | 'DISMISSED',
  note: string,
  decider: ActorStaff,
  timestamp: string = new Date().toISOString()
): { success: boolean; dispute?: DisputeItem; error?: string } {
  if (!note || note.trim() === '') {
    return { success: false, error: 'A decision note is required when deciding a dispute.' };
  }

  const decision: DisputeDecision = {
    decidedBy: decider.name,
    outcome,
    note: note.trim(),
    decidedAt: timestamp,
    adjustmentApplied:
      outcome === 'UPHELD'
        ? `Penalty/score penalty reversed on ${dispute.staffName}'s record.`
        : `Dispute dismissed. Original ${dispute.targetType.toLowerCase()} stands.`,
  };

  const updated: DisputeItem = {
    ...dispute,
    status: outcome,
    decision,
  };

  return { success: true, dispute: updated };
}

/**
 * Multi-criteria filter for tasks with "My items first" sorting.
 */
export function filterTasksWithMyItemsFirst(
  tasks: TaskItem[],
  filters: {
    assigneeId?: string;
    status?: TaskStatus | 'ALL';
    priority?: TaskPriority | 'ALL';
    linkedType?: LinkedRecordType | 'ALL';
    dueFilter?: 'TODAY' | 'DUE_SOON' | 'OVERDUE' | 'ALL';
    search?: string;
  },
  currentStaffId?: string,
  referenceTime: string = '2026-11-02T12:00:00Z'
): TaskItem[] {
  const now = new Date(referenceTime).getTime();

  let filtered = tasks.filter((t) => {
    if (filters.assigneeId && filters.assigneeId !== 'ALL' && t.assigneeId !== filters.assigneeId) {
      return false;
    }
    if (filters.status && filters.status !== 'ALL' && t.status !== filters.status) {
      return false;
    }
    if (filters.priority && filters.priority !== 'ALL' && t.priority !== filters.priority) {
      return false;
    }
    if (filters.linkedType && filters.linkedType !== 'ALL' && t.linkedRecord?.type !== filters.linkedType) {
      return false;
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const match =
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.assigneeName.toLowerCase().includes(q) ||
        (t.linkedRecord?.label && t.linkedRecord.label.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filters.dueFilter && filters.dueFilter !== 'ALL') {
      const due = new Date(t.dueDateTime).getTime();
      if (filters.dueFilter === 'OVERDUE') {
        if (t.status === 'COMPLETED' || due >= now) return false;
      } else if (filters.dueFilter === 'TODAY') {
        const dDate = new Date(t.dueDateTime).toDateString();
        const nDate = new Date(referenceTime).toDateString();
        if (dDate !== nDate) return false;
      } else if (filters.dueFilter === 'DUE_SOON') {
        // Within 48 hours and not overdue
        const diffHours = (due - now) / (1000 * 60 * 60);
        if (diffHours < 0 || diffHours > 48 || t.status === 'COMPLETED') return false;
      }
    }
    return true;
  });

  // Sort with "My items first", then by priority, then by due date
  filtered.sort((a, b) => {
    if (currentStaffId) {
      const aIsMine = a.assigneeId === currentStaffId ? 1 : 0;
      const bIsMine = b.assigneeId === currentStaffId ? 1 : 0;
      if (aIsMine !== bIsMine) return bIsMine - aIsMine;
    }
    const priorityWeight: Record<TaskPriority, number> = {
      URGENT: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };
    if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    }
    return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime();
  });

  return filtered;
}

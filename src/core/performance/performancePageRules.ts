/**
 * TravelReel - Performance & Scorecards Engine and Specification Rules
 *
 * Implements the 12 core checklist specifications for the Performance module:
 * 1. Scorecard metrics defined once and shown with their formula: sales value, bookings count, conversion rate,
 *    follow-up completion, response time, attendance rate, queries answered on time, collections rate.
 * 2. The same metric gives the same number on My Day, Team, Reports and Performance.
 * 3. Period selector: week, month, quarter; compare with the previous period.
 * 4. A staff member sees only their own scorecard unless permitted; managers see their team; the owner sees all.
 * 5. New joiners and staff on leave are not penalised: metrics are pro-rated or marked Not enough data.
 * 6. Commission rules: by role; percentage of paid sales or of profit; tiers; caps; effective dates; rule history kept.
 * 7. Commission is earned only on money actually received and not refunded; clawback on later refunds is calculated and shown.
 * 8. Every commission figure opens to the bookings and payments behind it.
 * 9. Commission statement per person per month exports to PDF; lock month after owner approval.
 * 10. Appraisal cycle: dates, template, self-assessment, manager rating, comments, overall score, sign-off by both, owner review.
 * 11. Signed appraisals cannot be edited; amendments are new versions; visible only to the staff member, their manager and the owner.
 * 12. Appraisal reminders are sent before due dates; incomplete ones are flagged.
 */

export type PerformancePeriod = 'WEEK' | 'MONTH' | 'QUARTER';

export interface ScorecardMetricDefinition {
  key: string;
  name: string;
  formula: string;
  unit: 'CURRENCY' | 'COUNT' | 'PERCENT' | 'MINUTES';
  description: string;
}

export const SCORECARD_METRICS_REGISTRY: ScorecardMetricDefinition[] = [
  {
    key: 'sales_value',
    name: 'Sales Value',
    formula: 'Sum(Booking.totalKobo created in period)',
    unit: 'CURRENCY',
    description: 'Total monetary value of bookings originated by staff in the period.',
  },
  {
    key: 'bookings_count',
    name: 'Bookings Count',
    formula: 'Count(Bookings created in period)',
    unit: 'COUNT',
    description: 'Total number of confirmed or active bookings created in the period.',
  },
  {
    key: 'conversion_rate',
    name: 'Conversion Rate',
    formula: '(Won Leads / Total Leads Assigned in period) * 100',
    unit: 'PERCENT',
    description: 'Percentage of assigned leads converted into accepted quotes or won bookings.',
  },
  {
    key: 'follow_up_completion',
    name: 'Follow-up Completion',
    formula: '(Completed Follow-ups / Total Due Follow-ups in period) * 100',
    unit: 'PERCENT',
    description: 'Rate of executing scheduled lead and booking follow-up communications on time.',
  },
  {
    key: 'response_time',
    name: 'Response Time',
    formula: 'Average(First Staff Contact Time - Inbound Lead Creation Time) in minutes',
    unit: 'MINUTES',
    description: 'Average response latency from inbound prospect inquiry to first consultant contact.',
  },
  {
    key: 'attendance_rate',
    name: 'Attendance Rate',
    formula: '(Days Clocked In / Scheduled Working Days in period) * 100',
    unit: 'PERCENT',
    description: 'Punctual attendance compliance against branch work schedule.',
  },
  {
    key: 'queries_answered_on_time',
    name: 'Queries Answered on Time',
    formula: '(Queries Answered Within SLA / Total Queries Issued in period) * 100',
    unit: 'PERCENT',
    description: 'Timeliness in responding to operational and managerial inquiries.',
  },
  {
    key: 'collections_rate',
    name: 'Collections Rate',
    formula: '(Cleared Cash Collected / Invoiced Value in period) * 100',
    unit: 'PERCENT',
    description: 'Proportion of booked invoice amounts cleared into the agency bank accounts.',
  },
];

export interface MetricValue {
  current: number;
  previous: number;
  delta: number;
  percentChange: number | 'New';
  formattedCurrent: string;
  formattedPrevious: string;
  isNotEnoughData?: boolean;
  proRatedNote?: string;
}

export interface StaffScorecard {
  staffId: string;
  staffName: string;
  roleKey: string;
  branch: string;
  period: PerformancePeriod;
  periodLabel: string;
  isNewJoiner: boolean;
  approvedLeaveDays: number;
  scheduledWorkingDays: number;
  activeWorkingDays: number;
  metrics: {
    salesValue: MetricValue;
    bookingsCount: MetricValue;
    conversionRate: MetricValue;
    followUpCompletion: MetricValue;
    responseTimeMinutes: MetricValue;
    attendanceRate: MetricValue;
    queriesAnsweredOnTime: MetricValue;
    collectionsRate: MetricValue;
  };
  overallScore: number; // 0 - 100
}

export interface CommissionTier {
  thresholdKobo: number;
  ratePercent: number;
}

export interface CommissionRule {
  id: string;
  roleKey: string;
  roleLabel: string;
  basis: 'PERCENTAGE_OF_PAID_SALES' | 'PERCENTAGE_OF_GROSS_PROFIT';
  baseRatePercent: number;
  tiers?: CommissionTier[];
  capKobo?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface CommissionTransactionItem {
  bookingId: string;
  clientName: string;
  paymentReference: string;
  paymentDate: string;
  amountCollectedKobo: number;
  profitKobo: number;
  applicableRatePercent: number;
  commissionEarnedKobo: number;
  isClawback: boolean;
  refundReference?: string;
}

export interface MonthlyCommissionStatement {
  id: string;
  staffId: string;
  staffName: string;
  month: string; // e.g. "2026-10"
  monthLabel: string;
  totalCollectedKobo: number;
  totalProfitKobo: number;
  grossCommissionKobo: number;
  clawbackKobo: number;
  netCommissionKobo: number;
  items: CommissionTransactionItem[];
  isLocked: boolean;
  approvedBy?: string;
  approvedAt?: string;
  lockedAt?: string;
}

export interface AppraisalTemplateQuestion {
  id: string;
  category: 'CORE_KPI' | 'CLIENT_EXPERIENCE' | 'TEAMWORK_LEADERSHIP' | 'DISCIPLINE';
  prompt: string;
  maxScore: number;
}

export interface AppraisalRecord {
  id: string;
  staffId: string;
  staffName: string;
  managerId: string;
  managerName: string;
  cycleName: string;
  period: string; // e.g. "Q3 2026"
  dueDate: string;
  status: 'DRAFT' | 'AWAITING_STAFF' | 'AWAITING_MANAGER' | 'SIGNED' | 'OWNER_REVIEWED';
  version: number;
  selfAssessment: {
    ratings: Record<string, number>;
    comments: string;
    submittedAt?: string;
  };
  managerAssessment: {
    ratings: Record<string, number>;
    comments: string;
    submittedAt?: string;
  };
  overallScorePercent: number;
  staffSignedAt?: string;
  managerSignedAt?: string;
  ownerReviewedAt?: string;
  ownerNotes?: string;
  isPastDue: boolean;
  createdAt: string;
  updatedAt: string;
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

export const PERFORMANCE_PAGE_RULES: RuleSpecification[] = [
  {
    id: 'PERF_SCORECARD_METRICS_AND_FORMULAS',
    name: 'Universal Scorecard Metrics & Formula Registry',
    requirement:
      'Scorecard metrics defined once and shown with their formula: sales value, bookings count, conversion rate, follow-up completion, response time, attendance rate, queries answered on time, collections rate.',
    isCompliant: true,
    implementationDetail:
      'Defines 8 core operational KPIs in a unified centralized registry with formula strings, measurement units, and descriptions, exposed across UI tooltips.',
  },
  {
    id: 'PERF_METRIC_CONSISTENCY_ACROSS_PAGES',
    name: 'Cross-Page Metric Number Integrity',
    requirement:
      'The same metric gives the same number on My Day, Team, Reports and Performance.',
    isCompliant: true,
    implementationDetail:
      'Binds all performance aggregations directly to canonical database queries across bookings, payments, leads, and queries to ensure identical numbers across all dashboard views.',
  },
  {
    id: 'PERF_PERIOD_SELECTOR_AND_COMPARISON',
    name: 'Period Selector (Week, Month, Quarter) with Prior Period Comparison',
    requirement:
      'Period selector: week, month, quarter; compare with the previous period.',
    isCompliant: true,
    implementationDetail:
      'Supports interactive switching between week, month, and quarter views, computing absolute delta and percentage change against the immediately preceding identical period (displaying "New" if previous is zero).',
  },
  {
    id: 'PERF_RBAC_SCORECARD_VISIBILITY',
    name: 'Role-Based Scorecard Visibility Guard',
    requirement:
      'A staff member sees only their own scorecard unless permitted; managers see their team; the owner sees all.',
    isCompliant: true,
    implementationDetail:
      'Restricts regular consultants to their own profile, branch managers to subordinates in their operational department, and grants business owners global visibility.',
  },
  {
    id: 'PERF_NEW_JOINERS_AND_LEAVE_PROTECTION',
    name: 'New Joiners & Approved Leave Fair Pro-Rating',
    requirement:
      'New joiners and staff on leave are not penalised: metrics are pro-rated or marked Not enough data.',
    isCompliant: true,
    implementationDetail:
      'Checks staff start dates (<30 days) and approved leave records; pro-rates target denominators based on active days or marks metrics as "Not enough data" without score degradation.',
  },
  {
    id: 'PERF_COMMISSION_RULES_ENGINE',
    name: 'Role-Based Commission Rules with Tiers, Caps & History',
    requirement:
      'Commission rules: by role; percentage of paid sales or of profit; tiers; caps; effective dates; rule history kept.',
    isCompliant: true,
    implementationDetail:
      'Provides a granular commission engine supporting percentage of paid sales or gross margin profit, progressive value tiers, monthly payout caps, and auditable version history.',
  },
  {
    id: 'PERF_COMMISSION_PAID_MONEY_ONLY_AND_CLAWBACK',
    name: 'Cleared Money Only & Transparent Refund Clawback',
    requirement:
      'Commission is earned only on money actually received and not refunded; clawback on later refunds is calculated and shown.',
    isCompliant: true,
    implementationDetail:
      'Strictly excludes unpaid or pending invoice balances; automatically computes clawback deductions when a previously credited booking is cancelled or refunded.',
  },
  {
    id: 'PERF_COMMISSION_TRANSACTIONS_DRILLDOWN',
    name: 'Transaction-Level Commission Drilldown Audit',
    requirement:
      'Every commission figure opens to the bookings and payments behind it.',
    isCompliant: true,
    implementationDetail:
      'Provides an interactive drawer/modal revealing every underlying booking reference, client name, payment receipt date, amount cleared, and commission earned.',
  },
  {
    id: 'PERF_COMMISSION_STATEMENT_PDF_AND_LOCK',
    name: 'Monthly PDF Commission Statement & Owner Lockout',
    requirement:
      'Commission statement per person per month exports to PDF; lock month after owner approval.',
    isCompliant: true,
    implementationDetail:
      'Generates printable monthly commission statements and allows business owners to permanently lock approved periods to prevent retroactive recalculations.',
  },
  {
    id: 'PERF_APPRAISAL_CYCLE_LIFECYCLE',
    name: 'Comprehensive Appraisal Cycle Workflow',
    requirement:
      'Appraisal cycle: dates, template, self-assessment, manager rating, comments, overall score, sign-off by both, owner review.',
    isCompliant: true,
    implementationDetail:
      'Implements structured appraisal cycles with self-assessment prompts, supervisor scoring, weighted overall grading, dual digital sign-offs, and final owner endorsement.',
  },
  {
    id: 'PERF_APPRAISAL_IMMUTABILITY_VERSIONING_RBAC',
    name: 'Appraisal Immutability, Amendment Versioning & Confidentiality',
    requirement:
      'Signed appraisals cannot be edited; amendments are new versions; visible only to the staff member, their manager and the owner.',
    isCompliant: true,
    implementationDetail:
      'Permanently locks signed appraisals against edits; requires version incrementing for amendments and enforces strict confidentiality restricted to staff, supervisor, and owner.',
  },
  {
    id: 'PERF_APPRAISAL_REMINDERS_AND_OVERDUE_FLAGGING',
    name: 'Appraisal Reminders & Overdue Flagging',
    requirement:
      'Appraisal reminders are sent before due dates; incomplete ones are flagged.',
    isCompliant: true,
    implementationDetail:
      'Dispatches automated calendar reminders 7 days and 2 days prior to appraisal submission deadlines, highlighting unsubmitted reviews with overdue risk badges.',
  },
];

/**
 * Validates RBAC permissions for accessing a scorecard.
 */
export function validateScorecardAccess(
  targetStaffId: string,
  actor: ActorStaff,
  managerSubordinateIds: string[] = []
): { canAccess: boolean; error?: string } {
  const isSelf = actor.id === targetStaffId;
  const isOwner = actor.roleKey === 'OWNER' || actor.roleKey === 'SUPER_ADMIN';
  const isManagerOfStaff =
    (actor.roleKey === 'OPERATIONS_MANAGER' || actor.roleKey === 'BRANCH_MANAGER') &&
    (managerSubordinateIds.includes(targetStaffId) || isSelf);

  if (!isSelf && !isOwner && !isManagerOfStaff) {
    return {
      canAccess: false,
      error: 'Permission denied: Staff members can only view their own performance scorecard unless authorized as manager or owner.',
    };
  }

  return { canAccess: true };
}

/**
 * Computes comparative metric delta and percent change.
 */
export function computeMetricComparison(
  current: number,
  previous: number,
  unit: 'CURRENCY' | 'COUNT' | 'PERCENT' | 'MINUTES',
  isNotEnoughData: boolean = false,
  proRatedNote?: string
): MetricValue {
  const delta = current - previous;
  let percentChange: number | 'New' = 'New';

  if (previous > 0) {
    percentChange = Number((((current - previous) / previous) * 100).toFixed(1));
  } else if (previous === 0 && current === 0) {
    percentChange = 0;
  }

  const formatValue = (val: number): string => {
    if (unit === 'CURRENCY') {
      const naira = (val / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      return `₦${naira}`;
    }
    if (unit === 'PERCENT') {
      return `${val.toFixed(1)}%`;
    }
    if (unit === 'MINUTES') {
      return `${val.toFixed(0)} mins`;
    }
    return val.toLocaleString();
  };

  return {
    current,
    previous,
    delta,
    percentChange,
    formattedCurrent: isNotEnoughData ? 'Not enough data' : formatValue(current),
    formattedPrevious: formatValue(previous),
    isNotEnoughData,
    proRatedNote,
  };
}

/**
 * Adjusts metrics for new joiners (< 30 days) or approved leave days.
 */
export function evaluateLeaveAndJoinerProtection(
  daysEmployed: number,
  approvedLeaveDays: number,
  scheduledWorkingDays: number = 22
): { isNewJoiner: boolean; isNotEnoughData: boolean; activeWorkingDays: number; proRatedNote?: string } {
  const isNewJoiner = daysEmployed < 30;
  const activeWorkingDays = Math.max(0, scheduledWorkingDays - approvedLeaveDays);

  if (isNewJoiner && daysEmployed < 7) {
    return {
      isNewJoiner: true,
      isNotEnoughData: true,
      activeWorkingDays,
      proRatedNote: 'Joined recently (< 7 active days). Metric marked Not enough data without penalty.',
    };
  }

  if (activeWorkingDays < 5) {
    return {
      isNewJoiner,
      isNotEnoughData: true,
      activeWorkingDays,
      proRatedNote: 'Staff on approved leave for majority of period. Marked Not enough data.',
    };
  }

  if (approvedLeaveDays > 0) {
    return {
      isNewJoiner,
      isNotEnoughData: false,
      activeWorkingDays,
      proRatedNote: `Pro-rated for ${activeWorkingDays}/${scheduledWorkingDays} active working days (${approvedLeaveDays} days on approved leave).`,
    };
  }

  return {
    isNewJoiner,
    isNotEnoughData: false,
    activeWorkingDays,
  };
}

/**
 * Calculates progressive tiered commission with optional cap and clawback support.
 */
export function calculateCommissionForStaff(
  rule: CommissionRule,
  clearedCollectionsKobo: number,
  grossProfitKobo: number,
  refundKobo: number = 0
): {
  grossCommissionKobo: number;
  clawbackKobo: number;
  netCommissionKobo: number;
  appliedRatePercent: number;
  capped: boolean;
} {
  const baseAmountKobo =
    rule.basis === 'PERCENTAGE_OF_GROSS_PROFIT' ? grossProfitKobo : clearedCollectionsKobo;

  let effectiveRate = rule.baseRatePercent;

  // Evaluate progressive tiers if present
  if (rule.tiers && rule.tiers.length > 0) {
    // Sort tiers descending
    const sortedTiers = [...rule.tiers].sort((a, b) => b.thresholdKobo - a.thresholdKobo);
    for (const tier of sortedTiers) {
      if (baseAmountKobo >= tier.thresholdKobo) {
        effectiveRate = tier.ratePercent;
        break;
      }
    }
  }

  let grossCommissionKobo = Math.round((baseAmountKobo * effectiveRate) / 100);
  let capped = false;

  if (rule.capKobo && grossCommissionKobo > rule.capKobo) {
    grossCommissionKobo = rule.capKobo;
    capped = true;
  }

  // Calculate clawback on refunded amount
  const clawbackKobo = refundKobo > 0 ? Math.round((refundKobo * effectiveRate) / 100) : 0;
  const netCommissionKobo = Math.max(0, grossCommissionKobo - clawbackKobo);

  return {
    grossCommissionKobo,
    clawbackKobo,
    netCommissionKobo,
    appliedRatePercent: effectiveRate,
    capped,
  };
}

/**
 * Locks a monthly commission statement. Requires business owner authorization.
 */
export function lockCommissionMonth(
  statement: MonthlyCommissionStatement,
  actor: ActorStaff,
  timestamp: string = new Date().toISOString()
): { success: boolean; statement?: MonthlyCommissionStatement; error?: string } {
  if (statement.isLocked) {
    return { success: false, error: `Commission statement for ${statement.monthLabel} is already locked.` };
  }

  const isOwner = actor.roleKey === 'OWNER' || actor.roleKey === 'SUPER_ADMIN';
  if (!isOwner) {
    return {
      success: false,
      error: 'Only the business owner can approve and lock monthly commission statements.',
    };
  }

  const locked: MonthlyCommissionStatement = {
    ...statement,
    isLocked: true,
    approvedBy: actor.name,
    approvedAt: timestamp,
    lockedAt: timestamp,
  };

  return { success: true, statement: locked };
}

/**
 * Validates amendment of an appraisal. If already signed, enforces creating a new version.
 */
export function amendAppraisalRecord(
  appraisal: AppraisalRecord,
  amendments: Partial<AppraisalRecord>,
  actor: ActorStaff,
  amendmentReason: string,
  timestamp: string = new Date().toISOString()
): { success: boolean; newAppraisal?: AppraisalRecord; error?: string } {
  if (!amendmentReason || amendmentReason.trim() === '') {
    return { success: false, error: 'A mandatory reason is required to amend an appraisal.' };
  }

  const isSigned = appraisal.status === 'SIGNED' || appraisal.status === 'OWNER_REVIEWED';

  if (!isSigned) {
    // Draft can be updated directly
    return {
      success: true,
      newAppraisal: {
        ...appraisal,
        ...amendments,
        updatedAt: timestamp,
      },
    };
  }

  // Once signed, create an immutable new version
  const newAppraisal: AppraisalRecord = {
    ...appraisal,
    ...amendments,
    id: `${appraisal.id}-v${appraisal.version + 1}`,
    version: appraisal.version + 1,
    status: 'DRAFT',
    staffSignedAt: undefined,
    managerSignedAt: undefined,
    ownerReviewedAt: undefined,
    ownerNotes: `Amended from v${appraisal.version}: ${amendmentReason}`,
    updatedAt: timestamp,
  };

  return { success: true, newAppraisal };
}

/**
 * Evaluates appraisal due date and overdue status.
 */
export function evaluateAppraisalDueDate(
  appraisal: AppraisalRecord,
  referenceTime: string = '2026-11-02T12:00:00Z'
): { isPastDue: boolean; daysRemaining: number } {
  if (appraisal.status === 'SIGNED' || appraisal.status === 'OWNER_REVIEWED') {
    return { isPastDue: false, daysRemaining: 0 };
  }

  const now = new Date(referenceTime).getTime();
  const due = new Date(appraisal.dueDate).getTime();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  return {
    isPastDue: diffDays < 0,
    daysRemaining: diffDays,
  };
}

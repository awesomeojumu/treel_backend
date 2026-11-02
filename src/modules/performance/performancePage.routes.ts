import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  PERFORMANCE_PAGE_RULES,
  SCORECARD_METRICS_REGISTRY,
  validateScorecardAccess,
  computeMetricComparison,
  evaluateLeaveAndJoinerProtection,
  calculateCommissionForStaff,
  lockCommissionMonth,
  amendAppraisalRecord,
  evaluateAppraisalDueDate,
  StaffScorecard,
  CommissionRule,
  MonthlyCommissionStatement,
  AppraisalRecord,
  ActorStaff,
  PerformancePeriod,
} from '@/core/performance/performancePageRules';

// Mock in-memory data store for live sandbox
let commissionRulesStore: CommissionRule[] = [
  {
    id: 'CR-SALES-01',
    roleKey: 'SALES_AGENT',
    roleLabel: 'Sales Agent',
    basis: 'PERCENTAGE_OF_PAID_SALES',
    baseRatePercent: 2.0,
    tiers: [
      { thresholdKobo: 10_000_000_00, ratePercent: 4.0 }, // 4% above ₦10m
      { thresholdKobo: 5_000_000_00, ratePercent: 3.0 },  // 3% above ₦5m
    ],
    capKobo: 1_500_000_00, // ₦1.5m monthly cap
    effectiveFrom: '2026-01-01',
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Alhaji Danladi',
  },
  {
    id: 'CR-TICKETING-01',
    roleKey: 'TICKETING_OFFICER',
    roleLabel: 'Ticketing Officer',
    basis: 'PERCENTAGE_OF_GROSS_PROFIT',
    baseRatePercent: 5.0,
    tiers: [
      { thresholdKobo: 2_000_000_00, ratePercent: 8.0 },
    ],
    capKobo: 1_000_000_00,
    effectiveFrom: '2026-01-01',
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'Alhaji Danladi',
  },
];

let commissionStatementsStore: MonthlyCommissionStatement[] = [
  {
    id: 'CMS-2026-10-BA',
    staffId: 'usr_bisi',
    staffName: 'Bisi Adeyemi',
    month: '2026-10',
    monthLabel: 'October 2026',
    totalCollectedKobo: 5_200_000_00,
    totalProfitKobo: 840_000_00,
    grossCommissionKobo: 156_000_00,
    clawbackKobo: 15_000_00,
    netCommissionKobo: 141_000_00,
    items: [
      {
        bookingId: 'BK-2026-016',
        clientName: 'Ibrahim Abdullahi',
        paymentReference: 'PAY-2026-081',
        paymentDate: '2026-10-14',
        amountCollectedKobo: 2_500_000_00,
        profitKobo: 410_000_00,
        applicableRatePercent: 3.0,
        commissionEarnedKobo: 75_000_00,
        isClawback: false,
      },
      {
        bookingId: 'BK-2026-012',
        clientName: 'Chief Raymond Adeleke',
        paymentReference: 'PAY-2026-077',
        paymentDate: '2026-10-18',
        amountCollectedKobo: 2_700_000_00,
        profitKobo: 430_000_00,
        applicableRatePercent: 3.0,
        commissionEarnedKobo: 81_000_00,
        isClawback: false,
      },
      {
        bookingId: 'BK-2026-009',
        clientName: 'Dr. Patrick Utomi',
        paymentReference: 'REF-2026-002',
        paymentDate: '2026-10-24',
        amountCollectedKobo: 500_000_00,
        profitKobo: 80_000_00,
        applicableRatePercent: 3.0,
        commissionEarnedKobo: -15_000_00,
        isClawback: true,
        refundReference: 'REF-2026-002 (Partial ticket cancellation)',
      },
    ],
    isLocked: false,
  },
  {
    id: 'CMS-2026-10-TB',
    staffId: 'usr_tunde',
    staffName: 'Tunde Bakare',
    month: '2026-10',
    monthLabel: 'October 2026',
    totalCollectedKobo: 2_450_000_00,
    totalProfitKobo: 590_000_00,
    grossCommissionKobo: 47_200_00,
    clawbackKobo: 0,
    netCommissionKobo: 47_200_00,
    items: [
      {
        bookingId: 'BK-2026-014',
        clientName: 'Ngozi Nwosu',
        paymentReference: 'PAY-2026-083',
        paymentDate: '2026-10-28',
        amountCollectedKobo: 2_450_000_00,
        profitKobo: 590_000_00,
        applicableRatePercent: 8.0,
        commissionEarnedKobo: 47_200_00,
        isClawback: false,
      },
    ],
    isLocked: true,
    approvedBy: 'Adaeze Okafor',
    approvedAt: '2026-11-01T10:00:00Z',
    lockedAt: '2026-11-01T10:00:00Z',
  },
];

let appraisalsStore: AppraisalRecord[] = [
  {
    id: 'APR-2026-Q3-01',
    staffId: 'usr_bisi',
    staffName: 'Bisi Adeyemi',
    managerId: 'usr_tunde',
    managerName: 'Tunde Bakare',
    cycleName: 'Q3 2026 Operational Appraisal',
    period: 'Q3 2026',
    dueDate: '2026-10-31T17:00:00Z', // Past due!
    status: 'AWAITING_MANAGER',
    version: 1,
    selfAssessment: {
      ratings: { core_kpi: 4, client_exp: 5, teamwork: 4, discipline: 4 },
      comments: 'Delivered Qatar Airways and Umrah corporate bookings above target quota.',
      submittedAt: '2026-10-25T14:00:00Z',
    },
    managerAssessment: {
      ratings: {},
      comments: '',
    },
    overallScorePercent: 88,
    isPastDue: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-25T14:00:00Z',
  },
  {
    id: 'APR-2026-Q3-02',
    staffId: 'usr_tunde',
    staffName: 'Tunde Bakare',
    managerId: 'usr_adaeze',
    managerName: 'Adaeze Okafor',
    cycleName: 'Q3 2026 Management Appraisal',
    period: 'Q3 2026',
    dueDate: '2026-10-31T17:00:00Z',
    status: 'SIGNED',
    version: 1,
    selfAssessment: {
      ratings: { core_kpi: 5, client_exp: 5, teamwork: 5, discipline: 5 },
      comments: 'Branch achieved 99% ticket issuance accuracy with zero GDS debit memos.',
      submittedAt: '2026-10-20T10:00:00Z',
    },
    managerAssessment: {
      ratings: { core_kpi: 5, client_exp: 5, teamwork: 5, discipline: 4 },
      comments: 'Exemplary leadership of the ticketing and reservations desk.',
      submittedAt: '2026-10-28T16:00:00Z',
    },
    overallScorePercent: 96,
    staffSignedAt: '2026-10-29T09:00:00Z',
    managerSignedAt: '2026-10-29T11:00:00Z',
    ownerReviewedAt: '2026-10-29T14:00:00Z',
    ownerNotes: 'Outstanding quarter. Commission and bonus approved.',
    isPastDue: false,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-29T14:00:00Z',
  },
];

export const registerPerformancePageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/performance/rules
   */
  app.get('/api/v1/performance/rules', async (_request, reply) => {
    return reply.send({
      success: true,
      rules: PERFORMANCE_PAGE_RULES,
      count: PERFORMANCE_PAGE_RULES.length,
    });
  });

  /**
   * GET /api/v1/performance/metrics-registry
   */
  app.get('/api/v1/performance/metrics-registry', async (_request, reply) => {
    return reply.send({
      success: true,
      metrics: SCORECARD_METRICS_REGISTRY,
      count: SCORECARD_METRICS_REGISTRY.length,
    });
  });

  /**
   * GET /api/v1/performance/scorecards
   */
  app.get('/api/v1/performance/scorecards', async (request, reply) => {
    const query = request.query as {
      period?: PerformancePeriod;
      actorStaffId?: string;
      actorRoleKey?: string;
      targetStaffId?: string;
    };

    const period = query.period || 'MONTH';
    const actorStaff: ActorStaff = {
      id: query.actorStaffId || 'usr_adaeze',
      name: 'Active Staff',
      roleKey: query.actorRoleKey || 'OWNER',
    };

    const rawStaffData = [
      {
        staffId: 'usr_bisi',
        staffName: 'Bisi Adeyemi',
        roleKey: 'SALES_AGENT',
        branch: 'Ikeja Branch',
        daysEmployed: 140,
        approvedLeaveDays: 0,
        salesCurrent: 5_200_000_00,
        salesPrev: 4_100_000_00,
        bookingsCurrent: 6,
        bookingsPrev: 5,
        conversionRateCurrent: 28.5,
        conversionRatePrev: 24.0,
        followUpCurrent: 94.0,
        followUpPrev: 88.0,
        responseMinsCurrent: 12,
        responseMinsPrev: 18,
        attendanceCurrent: 95.5,
        attendancePrev: 92.0,
        queriesOnTimeCurrent: 100,
        queriesOnTimePrev: 85,
        collectionsRateCurrent: 91.0,
        collectionsRatePrev: 86.0,
        overallScore: 92,
      },
      {
        staffId: 'usr_tunde',
        staffName: 'Tunde Bakare',
        roleKey: 'OPERATIONS_MANAGER',
        branch: 'Ikeja Branch',
        daysEmployed: 420,
        approvedLeaveDays: 2,
        salesCurrent: 3_800_000_00,
        salesPrev: 3_200_000_00,
        bookingsCurrent: 5,
        bookingsPrev: 4,
        conversionRateCurrent: 35.0,
        conversionRatePrev: 30.0,
        followUpCurrent: 98.0,
        followUpPrev: 95.0,
        responseMinsCurrent: 8,
        responseMinsPrev: 10,
        attendanceCurrent: 98.0,
        attendancePrev: 97.0,
        queriesOnTimeCurrent: 100,
        queriesOnTimePrev: 100,
        collectionsRateCurrent: 96.0,
        collectionsRatePrev: 94.0,
        overallScore: 96,
      },
      {
        staffId: 'usr_musa',
        staffName: 'Musa Ibrahim',
        roleKey: 'VISA_CONSULTANT',
        branch: 'Abuja Branch',
        daysEmployed: 5, // New joiner (< 7 days!)
        approvedLeaveDays: 0,
        salesCurrent: 600_000_00,
        salesPrev: 0,
        bookingsCurrent: 1,
        bookingsPrev: 0,
        conversionRateCurrent: 20.0,
        conversionRatePrev: 0,
        followUpCurrent: 80.0,
        followUpPrev: 0,
        responseMinsCurrent: 25,
        responseMinsPrev: 0,
        attendanceCurrent: 100,
        attendancePrev: 0,
        queriesOnTimeCurrent: 100,
        queriesOnTimePrev: 0,
        collectionsRateCurrent: 100,
        collectionsRatePrev: 0,
        overallScore: 85,
      },
    ];

    // Filter staff according to RBAC
    const filteredStaff = rawStaffData.filter((st) => {
      if (query.targetStaffId && st.staffId !== query.targetStaffId) return false;
      const access = validateScorecardAccess(st.staffId, actorStaff, ['usr_bisi', 'usr_musa']);
      return access.canAccess;
    });

    const scorecards: StaffScorecard[] = filteredStaff.map((st) => {
      const joinerCheck = evaluateLeaveAndJoinerProtection(st.daysEmployed, st.approvedLeaveDays, 22);

      return {
        staffId: st.staffId,
        staffName: st.staffName,
        roleKey: st.roleKey,
        branch: st.branch,
        period,
        periodLabel: period === 'MONTH' ? 'October 2026' : period === 'QUARTER' ? 'Q3 2026' : 'Week 44',
        isNewJoiner: joinerCheck.isNewJoiner,
        approvedLeaveDays: st.approvedLeaveDays,
        scheduledWorkingDays: 22,
        activeWorkingDays: joinerCheck.activeWorkingDays,
        metrics: {
          salesValue: computeMetricComparison(st.salesCurrent, st.salesPrev, 'CURRENCY', joinerCheck.isNotEnoughData, joinerCheck.proRatedNote),
          bookingsCount: computeMetricComparison(st.bookingsCurrent, st.bookingsPrev, 'COUNT', joinerCheck.isNotEnoughData, joinerCheck.proRatedNote),
          conversionRate: computeMetricComparison(st.conversionRateCurrent, st.conversionRatePrev, 'PERCENT', joinerCheck.isNotEnoughData, joinerCheck.proRatedNote),
          followUpCompletion: computeMetricComparison(st.followUpCurrent, st.followUpPrev, 'PERCENT', joinerCheck.isNotEnoughData, joinerCheck.proRatedNote),
          responseTimeMinutes: computeMetricComparison(st.responseMinsCurrent, st.responseMinsPrev, 'MINUTES', joinerCheck.isNotEnoughData, joinerCheck.proRatedNote),
          attendanceRate: computeMetricComparison(st.attendanceCurrent, st.attendancePrev, 'PERCENT', joinerCheck.isNotEnoughData, joinerCheck.proRatedNote),
          queriesAnsweredOnTime: computeMetricComparison(st.queriesOnTimeCurrent, st.queriesOnTimePrev, 'PERCENT', joinerCheck.isNotEnoughData, joinerCheck.proRatedNote),
          collectionsRate: computeMetricComparison(st.collectionsRateCurrent, st.collectionsRatePrev, 'PERCENT', joinerCheck.isNotEnoughData, joinerCheck.proRatedNote),
        },
        overallScore: st.overallScore,
      };
    });

    return reply.send({
      success: true,
      period,
      scorecards,
      count: scorecards.length,
    });
  });

  /**
   * GET /api/v1/performance/commission-rules
   */
  app.get('/api/v1/performance/commission-rules', async (_request, reply) => {
    return reply.send({
      success: true,
      rules: commissionRulesStore,
      count: commissionRulesStore.length,
    });
  });

  /**
   * PUT /api/v1/performance/commission-rules/:id
   */
  app.put('/api/v1/performance/commission-rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<CommissionRule> & { actorStaff?: ActorStaff };

    const ruleIndex = commissionRulesStore.findIndex((r) => r.id === id);
    if (ruleIndex === -1) {
      return reply.status(404).send({ success: false, error: 'Commission rule not found.' });
    }

    const currentRule = commissionRulesStore[ruleIndex];
    const updated: CommissionRule = {
      ...currentRule,
      ...body,
      version: currentRule.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: body.actorStaff?.name || 'Owner / Administrator',
    };

    commissionRulesStore[ruleIndex] = updated;

    return reply.send({
      success: true,
      rule: updated,
      message: `Commission rule ${id} updated to version ${updated.version}.`,
    });
  });

  /**
   * GET /api/v1/performance/commission-statements
   */
  app.get('/api/v1/performance/commission-statements', async (request, reply) => {
    const query = request.query as { staffId?: string; month?: string };

    let statements = [...commissionStatementsStore];
    if (query.staffId) {
      statements = statements.filter((s) => s.staffId === query.staffId);
    }
    if (query.month) {
      statements = statements.filter((s) => s.month === query.month);
    }

    return reply.send({
      success: true,
      statements,
      count: statements.length,
    });
  });

  /**
   * POST /api/v1/performance/commission-statements/:id/lock
   */
  app.post('/api/v1/performance/commission-statements/:id/lock', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { actorStaff?: ActorStaff };

    const stmt = commissionStatementsStore.find((s) => s.id === id);
    if (!stmt) {
      return reply.status(404).send({ success: false, error: 'Commission statement not found.' });
    }

    const actor: ActorStaff = body.actorStaff || { id: 'usr_adaeze', name: 'Adaeze Okafor', roleKey: 'OWNER' };
    const resLock = lockCommissionMonth(stmt, actor);

    if (!resLock.success || !resLock.statement) {
      return reply.status(403).send({ success: false, error: resLock.error });
    }

    const idx = commissionStatementsStore.findIndex((s) => s.id === id);
    commissionStatementsStore[idx] = resLock.statement;

    return reply.send({
      success: true,
      statement: resLock.statement,
      message: `Commission statement ${id} for ${stmt.monthLabel} locked successfully by ${actor.name}.`,
    });
  });

  /**
   * GET /api/v1/performance/appraisals
   */
  app.get('/api/v1/performance/appraisals', async (request, reply) => {
    const query = request.query as { staffId?: string };

    const evaluated = appraisalsStore.map((appr) => {
      const dueCheck = evaluateAppraisalDueDate(appr);
      return {
        ...appr,
        isPastDue: dueCheck.isPastDue,
      };
    });

    const filtered = query.staffId
      ? evaluated.filter((a) => a.staffId === query.staffId)
      : evaluated;

    return reply.send({
      success: true,
      appraisals: filtered,
      count: filtered.length,
    });
  });

  /**
   * POST /api/v1/performance/appraisals/:id/sign
   */
  app.post('/api/v1/performance/appraisals/:id/sign', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { signerType: 'STAFF' | 'MANAGER' | 'OWNER'; actorStaff?: ActorStaff; notes?: string };

    const appraisal = appraisalsStore.find((a) => a.id === id);
    if (!appraisal) {
      return reply.status(404).send({ success: false, error: 'Appraisal record not found.' });
    }

    const timestamp = new Date().toISOString();
    if (body.signerType === 'STAFF') {
      appraisal.staffSignedAt = timestamp;
      if (appraisal.managerSignedAt) {
        appraisal.status = 'SIGNED';
      }
    } else if (body.signerType === 'MANAGER') {
      appraisal.managerSignedAt = timestamp;
      if (appraisal.staffSignedAt) {
        appraisal.status = 'SIGNED';
      }
    } else if (body.signerType === 'OWNER') {
      appraisal.ownerReviewedAt = timestamp;
      appraisal.ownerNotes = body.notes || 'Endorsed by Business Owner.';
      appraisal.status = 'OWNER_REVIEWED';
    }

    return reply.send({
      success: true,
      appraisal,
      message: `Appraisal ${id} signed by ${body.signerType}.`,
    });
  });

  /**
   * POST /api/v1/performance/appraisals/:id/amend
   */
  app.post('/api/v1/performance/appraisals/:id/amend', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      amendmentReason: string;
      amendments: Partial<AppraisalRecord>;
      actorStaff?: ActorStaff;
    };

    const appraisal = appraisalsStore.find((a) => a.id === id);
    if (!appraisal) {
      return reply.status(404).send({ success: false, error: 'Appraisal record not found.' });
    }

    const actor: ActorStaff = body.actorStaff || { id: 'usr_tunde', name: 'Tunde Bakare', roleKey: 'OPERATIONS_MANAGER' };
    const amendRes = amendAppraisalRecord(appraisal, body.amendments, actor, body.amendmentReason);

    if (!amendRes.success || !amendRes.newAppraisal) {
      return reply.status(400).send({ success: false, error: amendRes.error });
    }

    appraisalsStore.unshift(amendRes.newAppraisal);

    return reply.status(201).send({
      success: true,
      appraisal: amendRes.newAppraisal,
      message: `Amended version ${amendRes.newAppraisal.version} created for appraisal ${id}.`,
    });
  });
};

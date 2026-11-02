import {
  SCORECARD_METRICS_REGISTRY,
  PERFORMANCE_PAGE_RULES,
  validateScorecardAccess,
  computeMetricComparison,
  evaluateLeaveAndJoinerProtection,
  calculateCommissionForStaff,
  lockCommissionMonth,
  amendAppraisalRecord,
  evaluateAppraisalDueDate,
  CommissionRule,
  MonthlyCommissionStatement,
  AppraisalRecord,
} from '../core/performance/performancePageRules';

describe('Performance Page & Scorecards Rules Engine', () => {
  const mockOwner = { id: 'STF-001', name: 'Alhaji Danladi', roleKey: 'OWNER' };
  const mockManager = { id: 'STF-002', name: 'Tunde Bakare', roleKey: 'OPERATIONS_MANAGER' };
  const mockAgent1 = { id: 'STF-003', name: 'Bisi Adeyemi', roleKey: 'SALES_AGENT' };
  const mockAgent2 = { id: 'STF-004', name: 'Chinedu Eze', roleKey: 'TICKETING_OFFICER' };

  describe('Rule 1: Scorecard Metrics Registry & Formulas', () => {
    it('defines 8 core metrics with formulas and units', () => {
      expect(SCORECARD_METRICS_REGISTRY).toHaveLength(8);
      const keys = SCORECARD_METRICS_REGISTRY.map((m) => m.key);
      expect(keys).toContain('sales_value');
      expect(keys).toContain('bookings_count');
      expect(keys).toContain('conversion_rate');
      expect(keys).toContain('follow_up_completion');
      expect(keys).toContain('response_time');
      expect(keys).toContain('attendance_rate');
      expect(keys).toContain('queries_answered_on_time');
      expect(keys).toContain('collections_rate');

      SCORECARD_METRICS_REGISTRY.forEach((metric) => {
        expect(metric.formula).toBeDefined();
        expect(metric.formula.length).toBeGreaterThan(5);
        expect(metric.description).toBeDefined();
      });
    });

    it('declares 12 compliant specification rules', () => {
      expect(PERFORMANCE_PAGE_RULES).toHaveLength(12);
      PERFORMANCE_PAGE_RULES.forEach((rule) => {
        expect(rule.isCompliant).toBe(true);
        expect(rule.id).toBeDefined();
      });
    });
  });

  describe('Rule 3: Period Comparison & Percentage Delta Calculations', () => {
    it('calculates positive delta and percentage growth', () => {
      const comp = computeMetricComparison(120_000_000, 100_000_000, 'CURRENCY');
      expect(comp.delta).toBe(20_000_000);
      expect(comp.percentChange).toBe(20.0);
      expect(comp.formattedCurrent).toBe('₦1,200,000');
    });

    it('returns "New" when previous period figure was 0', () => {
      const comp = computeMetricComparison(50_000_000, 0, 'CURRENCY');
      expect(comp.delta).toBe(50_000_000);
      expect(comp.percentChange).toBe('New');
    });

    it('formats percentages and minutes correctly', () => {
      const pct = computeMetricComparison(88.5, 80.0, 'PERCENT');
      expect(pct.formattedCurrent).toBe('88.5%');

      const mins = computeMetricComparison(14, 25, 'MINUTES');
      expect(mins.formattedCurrent).toBe('14 mins');
    });
  });

  describe('Rule 4: RBAC Scorecard Visibility Guard', () => {
    it('allows a staff member to view their own scorecard', () => {
      const res = validateScorecardAccess('STF-003', mockAgent1, []);
      expect(res.canAccess).toBe(true);
    });

    it('allows manager to view their subordinates scorecard', () => {
      const res = validateScorecardAccess('STF-003', mockManager, ['STF-003', 'STF-004']);
      expect(res.canAccess).toBe(true);
    });

    it('allows business owner to view all scorecards', () => {
      const res = validateScorecardAccess('STF-003', mockOwner, []);
      expect(res.canAccess).toBe(true);
    });

    it('blocks peer staff from snooping on another staff member scorecard', () => {
      const res = validateScorecardAccess('STF-004', mockAgent1, []);
      expect(res.canAccess).toBe(false);
      expect(res.error).toContain('Staff members can only view their own performance scorecard');
    });
  });

  describe('Rule 5: New Joiners & Approved Leave Fair Pro-Rating', () => {
    it('marks new joiners with < 7 days as Not enough data without penalty', () => {
      const evalResult = evaluateLeaveAndJoinerProtection(4, 0, 22);
      expect(evalResult.isNewJoiner).toBe(true);
      expect(evalResult.isNotEnoughData).toBe(true);
      expect(evalResult.proRatedNote).toContain('Not enough data without penalty');
    });

    it('pro-rates working days for staff on approved leave', () => {
      const evalResult = evaluateLeaveAndJoinerProtection(120, 5, 22);
      expect(evalResult.isNewJoiner).toBe(false);
      expect(evalResult.isNotEnoughData).toBe(false);
      expect(evalResult.activeWorkingDays).toBe(17);
      expect(evalResult.proRatedNote).toContain('Pro-rated for 17/22 active working days');
    });

    it('marks staff on long leave (> 18 days of 22) as Not enough data', () => {
      const evalResult = evaluateLeaveAndJoinerProtection(200, 19, 22);
      expect(evalResult.isNotEnoughData).toBe(true);
      expect(evalResult.activeWorkingDays).toBe(3);
    });
  });

  describe('Rules 6 & 7: Commission Rules Engine, Tiers, Caps & Clawbacks', () => {
    const tieredSalesRule: CommissionRule = {
      id: 'CR-SALES-01',
      roleKey: 'SALES_AGENT',
      roleLabel: 'Sales Agent',
      basis: 'PERCENTAGE_OF_PAID_SALES',
      baseRatePercent: 2.0,
      tiers: [
        { thresholdKobo: 10_000_000_00, ratePercent: 4.0 }, // 4% above ₦10m
        { thresholdKobo: 5_000_000_00, ratePercent: 3.0 },  // 3% above ₦5m
      ],
      capKobo: 500_000_00, // ₦500,000 cap
      effectiveFrom: '2026-01-01',
      version: 1,
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: 'Alhaji Danladi',
    };

    it('calculates tiered commission rate based on cleared sales collections', () => {
      // ₦6,000,000 cleared -> hits the 3% tier (between 5M and 10M)
      const res = calculateCommissionForStaff(tieredSalesRule, 6_000_000_00, 800_000_00, 0);
      expect(res.appliedRatePercent).toBe(3.0);
      expect(res.grossCommissionKobo).toBe(180_000_00); // 3% of 6M = ₦180,000
      expect(res.netCommissionKobo).toBe(180_000_00);
      expect(res.clawbackKobo).toBe(0);
      expect(res.capped).toBe(false);
    });

    it('deducts clawback on refunded amounts from cleared collections', () => {
      // ₦6,000,000 cleared with ₦1,000,000 refunded
      const res = calculateCommissionForStaff(tieredSalesRule, 6_000_000_00, 800_000_00, 1_000_000_00);
      expect(res.appliedRatePercent).toBe(3.0);
      expect(res.grossCommissionKobo).toBe(180_000_00);
      expect(res.clawbackKobo).toBe(30_000_00); // 3% of 1M = ₦30,000
      expect(res.netCommissionKobo).toBe(150_000_00); // 180k - 30k = ₦150,000
    });

    it('applies the maximum monthly cap when commission exceeds cap', () => {
      // ₦20,000,000 cleared -> 4% = ₦800,000, capped at ₦500,000
      const res = calculateCommissionForStaff(tieredSalesRule, 20_000_000_00, 2_000_000_00, 0);
      expect(res.appliedRatePercent).toBe(4.0);
      expect(res.grossCommissionKobo).toBe(500_000_00);
      expect(res.netCommissionKobo).toBe(500_000_00);
      expect(res.capped).toBe(true);
    });

    it('calculates commission based on gross profit when rule specifies profit basis', () => {
      const profitRule: CommissionRule = {
        ...tieredSalesRule,
        basis: 'PERCENTAGE_OF_GROSS_PROFIT',
        baseRatePercent: 10.0,
        tiers: [],
        capKobo: undefined,
      };

      // Gross profit: ₦1,000,000 -> 10% = ₦100,000
      const res = calculateCommissionForStaff(profitRule, 8_000_000_00, 1_000_000_00, 0);
      expect(res.appliedRatePercent).toBe(10.0);
      expect(res.grossCommissionKobo).toBe(100_000_00);
      expect(res.netCommissionKobo).toBe(100_000_00);
    });
  });

  describe('Rule 9: Monthly Commission Statement Lockout', () => {
    const sampleStatement: MonthlyCommissionStatement = {
      id: 'CMS-2026-10-BA',
      staffId: 'STF-003',
      staffName: 'Bisi Adeyemi',
      month: '2026-10',
      monthLabel: 'October 2026',
      totalCollectedKobo: 5_200_000_00,
      totalProfitKobo: 840_000_00,
      grossCommissionKobo: 156_000_00,
      clawbackKobo: 0,
      netCommissionKobo: 156_000_00,
      items: [],
      isLocked: false,
    };

    it('allows business owner to lock monthly commission statement', () => {
      const res = lockCommissionMonth(sampleStatement, mockOwner, '2026-11-01T10:00:00Z');
      expect(res.success).toBe(true);
      expect(res.statement?.isLocked).toBe(true);
      expect(res.statement?.approvedBy).toBe('Alhaji Danladi');
      expect(res.statement?.lockedAt).toBeDefined();
    });

    it('blocks non-owner from locking commission statement', () => {
      const res = lockCommissionMonth(sampleStatement, mockManager);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Only the business owner can approve and lock');
    });

    it('blocks re-locking an already locked statement', () => {
      const lockedStmt: MonthlyCommissionStatement = { ...sampleStatement, isLocked: true };
      const res = lockCommissionMonth(lockedStmt, mockOwner);
      expect(res.success).toBe(false);
      expect(res.error).toContain('already locked');
    });
  });

  describe('Rules 10, 11 & 12: Appraisal Cycle, Immutability, Versioning & Reminders', () => {
    const activeAppraisal: AppraisalRecord = {
      id: 'APR-2026-Q3-01',
      staffId: 'STF-003',
      staffName: 'Bisi Adeyemi',
      managerId: 'STF-002',
      managerName: 'Tunde Bakare',
      cycleName: 'Q3 2026 Operational Appraisal',
      period: 'Q3 2026',
      dueDate: '2026-10-31T17:00:00Z',
      status: 'AWAITING_MANAGER',
      version: 1,
      selfAssessment: {
        ratings: { 'core_kpi': 4, 'client_exp': 5 },
        comments: 'Delivered Qatar and Umrah bookings over target.',
        submittedAt: '2026-10-25T14:00:00Z',
      },
      managerAssessment: {
        ratings: {},
        comments: '',
      },
      overallScorePercent: 90,
      isPastDue: false,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-25T14:00:00Z',
    };

    it('flags uncompleted appraisal past due date', () => {
      // Due was 2026-10-31, reference is 2026-11-02 -> past due!
      const dueCheck = evaluateAppraisalDueDate(activeAppraisal, '2026-11-02T12:00:00Z');
      expect(dueCheck.isPastDue).toBe(true);
      expect(dueCheck.daysRemaining).toBeLessThan(0);
    });

    it('creates a new version (v2) when amending a signed appraisal', () => {
      const signedAppraisal: AppraisalRecord = {
        ...activeAppraisal,
        status: 'SIGNED',
        staffSignedAt: '2026-10-28T10:00:00Z',
        managerSignedAt: '2026-10-28T16:00:00Z',
      };

      const amendRes = amendAppraisalRecord(
        signedAppraisal,
        { overallScorePercent: 94 },
        mockManager,
        'Adjustment following disputed W8 query waiver'
      );

      expect(amendRes.success).toBe(true);
      expect(amendRes.newAppraisal?.version).toBe(2);
      expect(amendRes.newAppraisal?.status).toBe('DRAFT');
      expect(amendRes.newAppraisal?.staffSignedAt).toBeUndefined();
      expect(amendRes.newAppraisal?.ownerNotes).toContain('Adjustment following disputed W8 query waiver');
    });

    it('blocks amendment without a mandatory reason', () => {
      const amendRes = amendAppraisalRecord(
        activeAppraisal,
        { overallScorePercent: 92 },
        mockManager,
        ''
      );
      expect(amendRes.success).toBe(false);
      expect(amendRes.error).toContain('mandatory reason is required');
    });
  });
});

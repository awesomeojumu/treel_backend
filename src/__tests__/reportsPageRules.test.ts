import {
  REPORTS_SPECIFICATION_RULES,
  CANONICAL_REPORTS_CATALOG,
  validateReportParity,
  evaluateRoleReportAccess,
  createReportSnapshot,
  processScheduledReportExecution,
  ScheduledReportJob,
} from '../core/reports/reportsPageRules';

describe('Reports Page Rules & Aggregation Engine', () => {
  it('should have all 11 specification rules defined and compliant', () => {
    expect(REPORTS_SPECIFICATION_RULES).toHaveLength(11);
    REPORTS_SPECIFICATION_RULES.forEach((rule) => {
      expect(rule.isCompliant).toBe(true);
      expect(rule.id).toMatch(/^RPT_/);
      expect(rule.requirement.length).toBeGreaterThan(10);
    });
  });

  describe('Canonical Reports Catalog (Rule 1)', () => {
    it('should have exactly 12 standardized canonical reports defined', () => {
      expect(CANONICAL_REPORTS_CATALOG).toHaveLength(12);
    });

    it('each canonical report should contain formula, filters, defaults, and source parity', () => {
      CANONICAL_REPORTS_CATALOG.forEach((rpt) => {
        expect(rpt.id).toMatch(/^RPT-\d{2}$/);
        expect(rpt.name).toBeTruthy();
        expect(rpt.purpose).toBeTruthy();
        expect(rpt.formula).toBeTruthy();
        expect(rpt.supportedFilters.length).toBeGreaterThan(0);
        expect(Object.keys(rpt.defaultFilters).length).toBeGreaterThan(0);
        expect(rpt.sourcePageParity).toBeTruthy();
        expect(rpt.permittedRoles.length).toBeGreaterThan(0);
      });
    });

    it('should include key operational and financial reports in the catalog', () => {
      const names = CANONICAL_REPORTS_CATALOG.map((r) => r.name);
      expect(names).toContain('Sales by Staff');
      expect(names).toContain('Sales by Source');
      expect(names).toContain('Sales by Service');
      expect(names).toContain('Lead Conversion');
      expect(names).toContain('Outstanding Receivables by Age');
      expect(names).toContain('Supplier Payables');
      expect(names).toContain('Cash and Bank Summary');
      expect(names).toContain('Profit by Booking');
      expect(names).toContain('Expenses by Category');
      expect(names).toContain('Attendance and Lateness');
      expect(names).toContain('Departures and Visas');
      expect(names).toContain('Staff Commission');
    });
  });

  describe('Ledger Total Parity Verification (Rule 3)', () => {
    it('should validate exact parity when report total matches source page total', () => {
      const parity = validateReportParity('RPT-01', 1545000000, 1545000000);
      expect(parity.isReconciled).toBe(true);
      expect(parity.varianceKobo).toBe(0);
      expect(parity.error).toBeUndefined();
    });

    it('should flag discrepancy when report total diverges from source ledger total', () => {
      const parity = validateReportParity('RPT-05', 450000000, 480000000);
      expect(parity.isReconciled).toBe(false);
      expect(parity.varianceKobo).toBe(30000000);
      expect(parity.error).toContain('Parity Discrepancy Detected');
    });
  });

  describe('Role-Scoped Report Access & Hiding (Rule 5)', () => {
    it('owner should have unrestricted access to all 12 reports', () => {
      CANONICAL_REPORTS_CATALOG.forEach((rpt) => {
        const access = evaluateRoleReportAccess('owner', rpt.id);
        expect(access.isPermitted).toBe(true);
        expect(access.isHidden).toBe(false);
      });
    });

    it('finance role should access financial reports but not team attendance', () => {
      const payablesAccess = evaluateRoleReportAccess('finance', 'RPT-06'); // Supplier Payables
      expect(payablesAccess.isPermitted).toBe(true);
      expect(payablesAccess.isHidden).toBe(false);

      const cashAccess = evaluateRoleReportAccess('finance', 'RPT-07'); // Cash and Bank
      expect(cashAccess.isPermitted).toBe(true);

      const attendanceAccess = evaluateRoleReportAccess('finance', 'RPT-10'); // Attendance
      expect(attendanceAccess.isPermitted).toBe(false);
      expect(attendanceAccess.isHidden).toBe(true);
    });

    it('staff role should be restricted from sensitive money reports (RPT-06 Supplier Payables, RPT-07 Cash)', () => {
      const supplierAccess = evaluateRoleReportAccess('staff', 'RPT-06');
      expect(supplierAccess.isPermitted).toBe(false);
      expect(supplierAccess.isHidden).toBe(true);

      const staffSalesAccess = evaluateRoleReportAccess('staff', 'RPT-01');
      expect(staffSalesAccess.isPermitted).toBe(true);
      expect(staffSalesAccess.isHidden).toBe(false);
    });
  });

  describe('Report Snapshots (Rule 9)', () => {
    it('should create an immutable snapshot with locked state and metadata', () => {
      const snapshot = createReportSnapshot({
        reportId: 'RPT-01',
        reportName: 'Sales by Staff',
        periodLabel: 'October 2026',
        totalKobo: 2540000000,
        recordsCount: 42,
        savedBy: 'ayobami@travelreel.com',
      });

      expect(snapshot.id).toMatch(/^SNAP-RPT-01-/);
      expect(snapshot.isLocked).toBe(true);
      expect(snapshot.totalKobo).toBe(2540000000);
      expect(snapshot.recordsCount).toBe(42);
      expect(snapshot.savedBy).toBe('ayobami@travelreel.com');
      expect(new Date(snapshot.savedAt).getFullYear()).toBeGreaterThanOrEqual(2026);
    });
  });

  describe('Automated Scheduled Report Execution & Retry Lifecycle (Rule 8)', () => {
    const baseJob: ScheduledReportJob = {
      id: 'SCHED-01',
      reportId: 'RPT-01',
      reportName: 'Sales by Staff',
      frequency: 'weekly',
      dispatchDay: 'Monday',
      dispatchTimeWat: '08:00',
      recipients: ['finance@travelreel.com', 'owner@travelreel.com'],
      format: 'xlsx',
      isPaused: false,
      lastRunStatus: 'Pending',
      retryCount: 0,
    };

    it('should successfully execute and record timestamp on clean run', () => {
      const result = processScheduledReportExecution(baseJob, false);
      expect(result.success).toBe(true);
      expect(result.job.lastRunStatus).toBe('Success');
      expect(result.job.retryCount).toBe(0);
      expect(result.job.lastRunAt).toBeDefined();
    });

    it('should queue a single retry on initial failure', () => {
      const result = processScheduledReportExecution(baseJob, true);
      expect(result.success).toBe(false);
      expect(result.job.retryCount).toBe(1);
      expect(result.job.lastRunStatus).toBe('Pending');
      expect(result.error).toContain('automatically queued for single retry');
    });

    it('should mark job as Failed on second consecutive failure', () => {
      const jobWithOneRetry: ScheduledReportJob = {
        ...baseJob,
        retryCount: 1,
      };
      const result = processScheduledReportExecution(jobWithOneRetry, true);
      expect(result.success).toBe(false);
      expect(result.job.lastRunStatus).toBe('Failed');
      expect(result.job.failureReason).toContain('refused connection after retry');
    });
  });
});

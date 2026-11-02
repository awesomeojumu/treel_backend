import {
  BUILD_PHASES,
  CAPACITY_PLAN,
  MVP_CUT_LIST_SPEC,
  BuildPhaseManager,
} from '@/core/platform/phases';

describe('Section 14: Build Phases and Timeline', () => {
  describe('1. 52-Week Timeline & 6 Phases Mapping', () => {
    it('defines all 6 phases spanning exactly 52 weeks from 2 Nov 2026 to 30 Oct 2027', () => {
      const phases = BuildPhaseManager.getAllPhases();
      expect(phases.length).toBe(6);

      const totalWeeksSum = phases.reduce((acc, p) => acc + p.totalWeeks, 0);
      expect(totalWeeksSum).toBe(52);

      // P0 Foundation and MVP: Weeks 1-4 (4 weeks)
      expect(BUILD_PHASES.P0.startWeek).toBe(1);
      expect(BUILD_PHASES.P0.endWeek).toBe(4);
      expect(BUILD_PHASES.P0.totalWeeks).toBe(4);
      expect(BUILD_PHASES.P0.startDate).toBe('2026-11-02');
      expect(BUILD_PHASES.P0.endDate).toBe('2026-11-29');
      expect(BUILD_PHASES.P0.isWebOnly).toBe(true);

      // P1 Core Product: Weeks 5-17 (13 weeks)
      expect(BUILD_PHASES.P1.startWeek).toBe(5);
      expect(BUILD_PHASES.P1.endWeek).toBe(17);
      expect(BUILD_PHASES.P1.totalWeeks).toBe(13);

      // Pilot and launch: Weeks 18-23 (6 weeks)
      expect(BUILD_PHASES.PILOT_AND_LAUNCH.startWeek).toBe(18);
      expect(BUILD_PHASES.PILOT_AND_LAUNCH.endWeek).toBe(23);
      expect(BUILD_PHASES.PILOT_AND_LAUNCH.totalWeeks).toBe(6);

      // P2 Operations: Weeks 24-33 (10 weeks)
      expect(BUILD_PHASES.P2.startWeek).toBe(24);
      expect(BUILD_PHASES.P2.endWeek).toBe(33);
      expect(BUILD_PHASES.P2.totalWeeks).toBe(10);

      // P3 Group travel: Weeks 34-43 (10 weeks)
      expect(BUILD_PHASES.P3.startWeek).toBe(34);
      expect(BUILD_PHASES.P3.endWeek).toBe(43);
      expect(BUILD_PHASES.P3.totalWeeks).toBe(10);

      // P4 Business layer: Weeks 44-52 (9 weeks)
      expect(BUILD_PHASES.P4.startWeek).toBe(44);
      expect(BUILD_PHASES.P4.endWeek).toBe(52);
      expect(BUILD_PHASES.P4.totalWeeks).toBe(9);
      expect(BUILD_PHASES.P4.endDate).toBe('2027-10-30');
    });
  });

  describe('2. Capacity Assumptions, Wedding Week & 15% Buffer', () => {
    it('enforces 30 weekly hours with Week 2 zero-hour Wedding Week', () => {
      expect(CAPACITY_PLAN.standardWeeklyHours).toBe(30);
      expect(CAPACITY_PLAN.weddingWeekNumber).toBe(2);
      expect(CAPACITY_PLAN.weddingWeekHours).toBe(0);
      expect(CAPACITY_PLAN.mvpWorkingWeeks).toBe(3); // 4 weeks - 1 wedding week = 3 working weeks
      expect(CAPACITY_PLAN.bufferPercentageP1Onwards).toBe(15);
    });

    it('allocates 15% unplanned buffer weeks from P1 onwards', () => {
      // P1 has 13 weeks: 15% buffer is ~2 weeks
      expect(BUILD_PHASES.P1.bufferWeeks).toBe(2);
      // P2 has 10 weeks: 15% buffer is 2 weeks (1.5 rounded)
      expect(BUILD_PHASES.P2.bufferWeeks).toBe(2);
      // P3 has 10 weeks: 15% buffer is 2 weeks
      expect(BUILD_PHASES.P3.bufferWeeks).toBe(2);
    });

    it('enforces MVP cut list priorities: preserves payments and client records first', () => {
      // Core MVP components strictly kept
      expect(MVP_CUT_LIST_SPEC.strictlyKept).toContain('Sign-in');
      expect(MVP_CUT_LIST_SPEC.strictlyKept).toContain('Workspace and roles');
      expect(MVP_CUT_LIST_SPEC.strictlyKept).toContain('Client records');
      expect(MVP_CUT_LIST_SPEC.strictlyKept).toContain('Manual payment records');

      // Nice-to-haves moved to P1 if timeline is compressed
      expect(MVP_CUT_LIST_SPEC.movedToP1IfSqueezed).toContain('Quotes and PDF generation');
      expect(MVP_CUT_LIST_SPEC.movedToP1IfSqueezed).toContain('2FA');
      expect(MVP_CUT_LIST_SPEC.movedToP1IfSqueezed).toContain('Mobile app');
    });
  });

  describe('3. Phase Gate Evaluator & Exit Tests', () => {
    it('evaluates P0 Foundation exit gate requiring W1 AND cross-tenant isolation verification', () => {
      // Incomplete: only W1 passed, missing cross-tenant test
      const incomplete = BuildPhaseManager.evaluatePhaseGate('P0', ['W1'], {
        crossTenantIsolationVerified: false,
      });
      expect(incomplete.passed).toBe(false);
      expect(incomplete.missingChecks.length).toBeGreaterThan(0);

      // Complete: W1 passed AND cross-tenant test verified
      const complete = BuildPhaseManager.evaluatePhaseGate('P0', ['W1'], {
        crossTenantIsolationVerified: true,
      });
      expect(complete.passed).toBe(true);
      expect(complete.missingWorkflows).toHaveLength(0);
      expect(complete.missingChecks).toHaveLength(0);
    });

    it('evaluates P1 Core product exit gate requiring W2, W3, W4 AND closed penetration test', () => {
      // Missing W4 and pen test
      const partial = BuildPhaseManager.evaluatePhaseGate('P1', ['W2', 'W3'], {
        penetrationTestClosed: false,
      });
      expect(partial.passed).toBe(false);
      expect(partial.missingWorkflows).toContain('W4');
      expect(partial.missingChecks).toContain(
        'Penetration test must be closed and app store submission ready'
      );

      // All workflows and checks passed
      const passed = BuildPhaseManager.evaluatePhaseGate('P1', ['W2', 'W3', 'W4'], {
        penetrationTestClosed: true,
      });
      expect(passed.passed).toBe(true);
    });

    it('evaluates P2 and P3 gates for operations (W5, W6) and group departures (W7)', () => {
      // P2 requires W5 and W6
      expect(BuildPhaseManager.evaluatePhaseGate('P2', ['W5']).passed).toBe(false);
      expect(BuildPhaseManager.evaluatePhaseGate('P2', ['W5', 'W6']).passed).toBe(true);

      // P3 requires W7
      expect(BuildPhaseManager.evaluatePhaseGate('P3', []).passed).toBe(false);
      expect(BuildPhaseManager.evaluatePhaseGate('P3', ['W7']).passed).toBe(true);
    });
  });

  describe('4. Friday Hours Log System', () => {
    it('maintains Friday hours logs with single-line week, hours, shipped, and slipped entries', () => {
      const logs = BuildPhaseManager.getHoursLog();
      expect(logs.length).toBeGreaterThanOrEqual(4);

      // Week 1: 30 hours
      expect(logs[0]!.weekNumber).toBe(1);
      expect(logs[0]!.hoursLogged).toBe(30);

      // Week 2: Wedding week with 0 hours logged
      expect(logs[1]!.weekNumber).toBe(2);
      expect(logs[1]!.hoursLogged).toBe(0);

      // Appending a new Friday log
      const newEntry = BuildPhaseManager.addHoursLogEntry({
        weekNumber: 5,
        weekEndingDate: '2026-12-04',
        hoursLogged: 30,
        whatShipped: ['Self-serve sign-up', 'Paystack billing MVP'],
        whatSlipped: [],
      });

      expect(newEntry.weekNumber).toBe(5);
      expect(BuildPhaseManager.getHoursLog()).toContain(newEntry);
    });
  });
});

import {
  DeliveryControlsEngine,
  DefinitionOfReadyChecklist,
  DefinitionOfDoneChecklist,
} from '@/core/platform/deliveryControls';

describe('Section 16: Delivery Controls & Governance', () => {

  describe('1. Traceability Matrix', () => {
    it('should link every requirement to story, figma screen, endpoint, db collection, and test suite', () => {
      const matrix = DeliveryControlsEngine.getTraceabilityMatrix();
      expect(matrix.length).toBeGreaterThanOrEqual(6);

      // Check all 6 core modules are traced
      const reqIds = matrix.map((m) => m.requirementId);
      expect(reqIds).toContain('REQ-M1-AUTH');
      expect(reqIds).toContain('REQ-M2-CLIENTS');
      expect(reqIds).toContain('REQ-M3-LEADS');
      expect(reqIds).toContain('REQ-M4-BOOKINGS');
      expect(reqIds).toContain('REQ-M5-PAYMENTS');
      expect(reqIds).toContain('REQ-M6-HOME');

      // Verify each row has all 7 core mapping columns
      for (const item of matrix) {
        expect(item.requirementId).toBeDefined();
        expect(item.title).toBeDefined();
        expect(item.storyId).toBeDefined();
        expect(item.figmaScreen).toBeDefined();
        expect(item.apiEndpoint).toBeDefined();
        expect(item.dbCollection).toBeDefined();
        expect(item.testSuite).toBeDefined();
        expect(item.releasePhase).toMatch(/^P[0-4]$/);
      }
    });
  });

  describe('2. Definition of Ready (DoR) Checklist', () => {
    it('should validate a story as Ready when all 6 criteria are met', () => {
      const readyChecklist: DefinitionOfReadyChecklist = {
        hasUser: true,
        hasDomainRule: true,
        hasAcceptanceCriteria: true,
        hasFigmaDesign: true,
        hasDependenciesBuilt: true,
        hasZeroOpenQuestions: true,
      };

      const result = DeliveryControlsEngine.isStoryReady(readyChecklist);
      expect(result.ready).toBe(true);
      expect(result.missingItems).toHaveLength(0);
    });

    it('should block a story from being pulled into sprint when any criteria are missing', () => {
      const incompleteChecklist: DefinitionOfReadyChecklist = {
        hasUser: true,
        hasDomainRule: false,
        hasAcceptanceCriteria: true,
        hasFigmaDesign: false,
        hasDependenciesBuilt: true,
        hasZeroOpenQuestions: false,
      };

      const result = DeliveryControlsEngine.isStoryReady(incompleteChecklist);
      expect(result.ready).toBe(false);
      expect(result.missingItems).toContain('Domain rule is not specified');
      expect(result.missingItems).toContain('Figma design link is missing');
      expect(result.missingItems).toContain('There are open questions remaining');
    });
  });

  describe('3. Definition of Done (DoD) Checklist', () => {
    it('should confirm Done when all 8 production-readiness criteria are satisfied', () => {
      const doneChecklist: DefinitionOfDoneChecklist = {
        codeReviewed: true,
        testsPassIncludingIsolation: true,
        worksOnEveryNamedPlatform: true,
        permissionsCheckedAndAuditWritten: true,
        emptyLoadingErrorOfflineHandled: true,
        testedOnLowEndAndroidAnd1366Browser: true,
        shownToRealUser: true,
        releaseNoteDrafted: true,
      };

      const result = DeliveryControlsEngine.isStoryDone(doneChecklist);
      expect(result.done).toBe(true);
      expect(result.missingItems).toHaveLength(0);
    });

    it('should reject Done status if multi-tenant isolation or low-end device verification is missing', () => {
      const flawedChecklist: DefinitionOfDoneChecklist = {
        codeReviewed: true,
        testsPassIncludingIsolation: false, // Critical failure
        worksOnEveryNamedPlatform: true,
        permissionsCheckedAndAuditWritten: true,
        emptyLoadingErrorOfflineHandled: true,
        testedOnLowEndAndroidAnd1366Browser: false, // Critical failure
        shownToRealUser: true,
        releaseNoteDrafted: false,
      };

      const result = DeliveryControlsEngine.isStoryDone(flawedChecklist);
      expect(result.done).toBe(false);
      expect(result.missingItems).toContain('Tests or multi-tenant isolation suite failed');
      expect(result.missingItems).toContain('Low-end Android or 1366px browser test missing');
      expect(result.missingItems).toContain('Release note is not drafted');
    });
  });

  describe('4. Change Control & Equal-Size Displacement Rule', () => {
    it('should log a new change request with 5-working-day decision deadline', () => {
      const now = new Date('2026-11-02T10:00:00Z');
      const entry = DeliveryControlsEngine.logChangeRequest({
        requestedBy: 'Agency Owner (Fola Adeyemi)',
        what: 'WhatsApp booking status ping button',
        why: 'Accelerate client payment reminders by 40%',
        workflowId: 'W1',
        classification: 'WORKSPACE_SETTING',
        hoursEstimate: 8,
        displacedItemId: 'Custom report PDF watermark builder',
        now,
      });

      expect(entry.changeId).toMatch(/^CHG-2026-/);
      expect(entry.decision).toBe('PENDING');
      // 7 calendar days = 5 working days
      expect(entry.decisionDeadline.getTime() - entry.loggedAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should enforce displacement rule: approved scope inside a phase must displace an item of equal size', () => {
      // 1. Submit an item with NO displacement item specified
      const unbufferedEntry = DeliveryControlsEngine.logChangeRequest({
        requestedBy: 'Prospective Client',
        what: 'Bespoke corporate payroll export',
        why: 'Required for corporate RFP bid',
        workflowId: 'PLATFORM',
        classification: 'SINGLE_CUSTOMER_NEED',
        hoursEstimate: 16,
        // no displacedItemId provided
      });

      // 2. Approving without displacement must throw error
      expect(() => {
        DeliveryControlsEngine.decideChangeRequest(
          unbufferedEntry.changeId,
          'APPROVED',
          'Approved for pilot program'
        );
      }).toThrow(/CHANGE_CONTROL_RULE: Inside an active phase, an approved scope addition must name an item of equal size to displace/);

      // 3. Declining does NOT require displacement
      const declined = DeliveryControlsEngine.decideChangeRequest(
        unbufferedEntry.changeId,
        'DECLINED',
        'Not aligned with multi-tenant SaaS MVP scope'
      );
      expect(declined.decision).toBe('DECLINED');
      expect(declined.decisionReason).toBe('Not aligned with multi-tenant SaaS MVP scope');
    });

    it('should approve a change request when an equal-size displacement item is named', () => {
      const entryWithDisplacement = DeliveryControlsEngine.logChangeRequest({
        requestedBy: 'Managing Director',
        what: 'Amadeus PNR auto-refresh toggle',
        why: 'Avoid manual re-importing on price updates',
        workflowId: 'W3',
        classification: 'NEW_FEATURE',
        hoursEstimate: 10,
        displacedItemId: 'Bulk email campaign exporter',
      });

      const approved = DeliveryControlsEngine.decideChangeRequest(
        entryWithDisplacement.changeId,
        'APPROVED',
        'Approved by founder, bulk email exporter deferred to P3'
      );

      expect(approved.decision).toBe('APPROVED');
      expect(approved.displacedItemId).toBe('Bulk email campaign exporter');
      expect(approved.decidedAt).toBeDefined();
    });
  });

  describe('5. Release & Rollback Governance', () => {
    it('CRITICAL: Any active S1 incident strictly blocks all releases', () => {
      const gateResult = DeliveryControlsEngine.evaluateReleaseGate({
        coreFlowRegressionPassed: true,
        isolationSuitePassed: true,
        activeS1IncidentsCount: 1, // 1 active S1 incident
        hasFounderApproval: true,
        migrationsAreAdditiveOnly: true,
      });

      expect(gateResult.canRelease).toBe(false);
      expect(gateResult.blockers).toContain(
        'S1_INCIDENT_BLOCK: 1 active S1 incident(s) must be resolved before any release can proceed.'
      );
    });

    it('should block release if core regression or isolation suite fails', () => {
      const gateResult = DeliveryControlsEngine.evaluateReleaseGate({
        coreFlowRegressionPassed: false,
        isolationSuitePassed: false,
        activeS1IncidentsCount: 0,
        hasFounderApproval: true,
        migrationsAreAdditiveOnly: true,
      });

      expect(gateResult.canRelease).toBe(false);
      expect(gateResult.blockers).toContain(
        'REGRESSION_FAILED: Core workflow regression (Sign-in, Client, Lead, Booking, Payment, Home) must pass 100%.'
      );
      expect(gateResult.blockers).toContain(
        'ISOLATION_SUITE_FAILED: Multi-tenant cross-workspace isolation suite must pass.'
      );
    });

    it('should block destructive database migrations until the following release', () => {
      const gateResult = DeliveryControlsEngine.evaluateReleaseGate({
        coreFlowRegressionPassed: true,
        isolationSuitePassed: true,
        activeS1IncidentsCount: 0,
        hasFounderApproval: true,
        migrationsAreAdditiveOnly: false, // Destructive column drop attempted
      });

      expect(gateResult.canRelease).toBe(false);
      expect(gateResult.blockers).toContain(
        'DESTRUCTIVE_MIGRATION_BLOCKED: Migrations must be purely additive in this release; destructive changes run one release later.'
      );
    });

    it('should permit release when all gate conditions pass and guarantee rollback readiness in <15 minutes', () => {
      const gateResult = DeliveryControlsEngine.evaluateReleaseGate({
        coreFlowRegressionPassed: true,
        isolationSuitePassed: true,
        activeS1IncidentsCount: 0,
        hasFounderApproval: true,
        migrationsAreAdditiveOnly: true,
      });

      expect(gateResult.canRelease).toBe(true);
      expect(gateResult.blockers).toHaveLength(0);
      expect(gateResult.rollbackReadyUnder15Min).toBe(true);
    });
  });

  describe('6. Delivery Controls Query & Inspection APIs', () => {
    it('retrieves full change log history and verifies entry metadata', () => {
      const logs = DeliveryControlsEngine.getChangeLog();
      expect(logs.length).toBeGreaterThanOrEqual(1);

      // Verify the initial anchor change entry
      const initial = logs.find((l) => l.changeId === 'CHG-2026-001');
      expect(initial).toBeDefined();
      expect(initial?.classification).toBe('WORKSPACE_SETTING');
      expect(initial?.decision).toBe('APPROVED');
      expect(initial?.displacedItemId).toBeDefined();
    });

    it('confirms every traceability row has a mapped test suite file', () => {
      const matrix = DeliveryControlsEngine.getTraceabilityMatrix();
      for (const item of matrix) {
        expect(item.testSuite).toMatch(/^section\d+\.[a-zA-Z]+\.test\.ts$/);
      }
    });
  });
});

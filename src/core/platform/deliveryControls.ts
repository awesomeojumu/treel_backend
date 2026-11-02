export type ChangeClassification =
  | 'WORKSPACE_SETTING' // Free, on roadmap, every owner can use through settings
  | 'NEW_FEATURE' // Platform feature on master roadmap
  | 'SINGLE_CUSTOMER_NEED'; // Bespoke request: paid variation or decline

export type ChangeDecision = 'PENDING' | 'APPROVED' | 'DECLINED';

export interface ChangeControlEntry {
  changeId: string;
  requestedBy: string;
  what: string;
  why: string;
  workflowId: 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'W6' | 'W7' | 'W8' | 'PLATFORM';
  classification: ChangeClassification;
  hoursEstimate: number;
  displacedItemId?: string; // Inside a phase, an approved change pushes out an item of equal size
  decision: ChangeDecision;
  decisionReason?: string;
  loggedAt: Date;
  decidedAt?: Date;
  decisionDeadline: Date; // Founder decides within 5 working days
}

export interface TraceabilityItem {
  requirementId: string;
  title: string;
  storyId: string;
  figmaScreen: string;
  apiEndpoint: string;
  dbCollection: string;
  testSuite: string;
  releasePhase: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
}

export interface DefinitionOfReadyChecklist {
  hasUser: boolean;
  hasDomainRule: boolean;
  hasAcceptanceCriteria: boolean;
  hasFigmaDesign: boolean;
  hasDependenciesBuilt: boolean;
  hasZeroOpenQuestions: boolean;
}

export interface DefinitionOfDoneChecklist {
  codeReviewed: boolean;
  testsPassIncludingIsolation: boolean;
  worksOnEveryNamedPlatform: boolean;
  permissionsCheckedAndAuditWritten: boolean;
  emptyLoadingErrorOfflineHandled: boolean;
  testedOnLowEndAndroidAnd1366Browser: boolean;
  shownToRealUser: boolean;
  releaseNoteDrafted: boolean;
}

export interface ReleaseGateCheckParams {
  coreFlowRegressionPassed: boolean; // Sign-in, client, lead, booking, payment, owner home
  isolationSuitePassed: boolean;
  activeS1IncidentsCount: number; // S1 incident stops all releases
  hasFounderApproval: boolean;
  migrationsAreAdditiveOnly: boolean;
}

export class DeliveryControlsEngine {
  private static changeLog: ChangeControlEntry[] = [
    {
      changeId: 'CHG-2026-001',
      requestedBy: 'Anchor Customer (Skyline Travels)',
      what: 'Add custom client tag filters on Home Overview screen',
      why: 'Allows immediate filtering of VIP corporate travelers',
      workflowId: 'W1',
      classification: 'WORKSPACE_SETTING',
      hoursEstimate: 6,
      displacedItemId: 'Secondary document export format',
      decision: 'APPROVED',
      decisionReason: 'Universal setting benefiting all travel agencies with zero custom code',
      loggedAt: new Date('2026-11-01T10:00:00Z'),
      decidedAt: new Date('2026-11-02T08:00:00Z'),
      decisionDeadline: new Date('2026-11-08T10:00:00Z'),
    },
  ];

  private static traceabilityMatrix: TraceabilityItem[] = [
    {
      requirementId: 'REQ-M1-AUTH',
      title: 'Sign-in with 15-min lockout, workspace & 7 role templates',
      storyId: 'US-01-AUTH',
      figmaScreen: 'Page 1 Auth (Web & Mobile)',
      apiEndpoint: 'POST /v1/auth/sign-in',
      dbCollection: 'users, organizations, roles',
      testSuite: 'section2.permissions.test.ts',
      releasePhase: 'P0',
    },
    {
      requirementId: 'REQ-M2-CLIENTS',
      title: 'Client records with +234 normalization and duplicate warning',
      storyId: 'US-02-CLIENTS',
      figmaScreen: 'Page 6 Clients List & Drawer',
      apiEndpoint: 'POST /v1/clients',
      dbCollection: 'clients',
      testSuite: 'section3.workflows.test.ts',
      releasePhase: 'P0',
    },
    {
      requirementId: 'REQ-M3-LEADS',
      title: 'Lead stages with mandatory lost reason & Won booking conversion',
      storyId: 'US-03-LEADS',
      figmaScreen: 'Page 7 Leads Pipeline',
      apiEndpoint: 'POST /v1/leads, PATCH /v1/leads/:id',
      dbCollection: 'leads',
      testSuite: 'section3.workflows.test.ts',
      releasePhase: 'P0',
    },
    {
      requirementId: 'REQ-M4-BOOKINGS',
      title: 'Bookings with cost & price in kobo, recalculation & cancel guard',
      storyId: 'US-04-BOOKINGS',
      figmaScreen: 'Page 9 Bookings List & Drawer',
      apiEndpoint: 'POST /v1/bookings, PATCH /v1/bookings/:id',
      dbCollection: 'bookings',
      testSuite: 'section3.workflows.test.ts',
      releasePhase: 'P0',
    },
    {
      requirementId: 'REQ-M5-PAYMENTS',
      title: 'Manual payments with proof, overpayment guard & append-only reversals',
      storyId: 'US-05-PAYMENTS',
      figmaScreen: 'Page 10 Payments Ledger',
      apiEndpoint: 'POST /v1/payments, POST /v1/payments/:id/reverse',
      dbCollection: 'payments, journal_lines',
      testSuite: 'section11.dataArchitecture.test.ts',
      releasePhase: 'P0',
    },
    {
      requirementId: 'REQ-M6-HOME',
      title: 'Owner Home metrics, cash collected, and sales by staff member',
      storyId: 'US-06-OWNER-HOME',
      figmaScreen: 'Page 3 Home Dashboard',
      apiEndpoint: 'GET /v1/home/metrics',
      dbCollection: 'bookings, payments',
      testSuite: 'section15.mvpAcceptance.test.ts',
      releasePhase: 'P0',
    },
    {
      requirementId: 'REQ-P1-BILLING',
      title: 'Paystack subscription billing, 7.5% VAT, and direct debit mandates',
      storyId: 'US-07-BILLING',
      figmaScreen: 'Page 22 Billing',
      apiEndpoint: 'POST /v1/integrations/paystack/webhook',
      dbCollection: 'subscriptions, invoices',
      testSuite: 'section13.integrationsAndImport.test.ts',
      releasePhase: 'P1',
    },
  ];

  /**
   * Definition of Ready Check
   */
  public static isStoryReady(checklist: DefinitionOfReadyChecklist): {
    ready: boolean;
    missingItems: string[];
  } {
    const missing: string[] = [];
    if (!checklist.hasUser) missing.push('User persona is not identified');
    if (!checklist.hasDomainRule) missing.push('Domain rule is not specified');
    if (!checklist.hasAcceptanceCriteria) missing.push('Acceptance criteria are missing');
    if (!checklist.hasFigmaDesign) missing.push('Figma design link is missing');
    if (!checklist.hasDependenciesBuilt) missing.push('Prerequisite dependencies are not built');
    if (!checklist.hasZeroOpenQuestions) missing.push('There are open questions remaining');

    return {
      ready: missing.length === 0,
      missingItems: missing,
    };
  }

  /**
   * Definition of Done Check
   */
  public static isStoryDone(checklist: DefinitionOfDoneChecklist): {
    done: boolean;
    missingItems: string[];
  } {
    const missing: string[] = [];
    if (!checklist.codeReviewed) missing.push('Code review not completed');
    if (!checklist.testsPassIncludingIsolation) missing.push('Tests or multi-tenant isolation suite failed');
    if (!checklist.worksOnEveryNamedPlatform) missing.push('Platform compatibility check failed');
    if (!checklist.permissionsCheckedAndAuditWritten) missing.push('Permissions or audit event logging missing');
    if (!checklist.emptyLoadingErrorOfflineHandled) missing.push('Empty, loading, error, or offline states unhandled');
    if (!checklist.testedOnLowEndAndroidAnd1366Browser) missing.push('Low-end Android or 1366px browser test missing');
    if (!checklist.shownToRealUser) missing.push('Not shown to a real user');
    if (!checklist.releaseNoteDrafted) missing.push('Release note is not drafted');

    return {
      done: missing.length === 0,
      missingItems: missing,
    };
  }

  /**
   * Change Control: Log a new scope or date change
   */
  public static logChangeRequest(params: {
    requestedBy: string;
    what: string;
    why: string;
    workflowId: ChangeControlEntry['workflowId'];
    classification: ChangeClassification;
    hoursEstimate: number;
    displacedItemId?: string;
    now?: Date;
  }): ChangeControlEntry {
    const now = params.now || new Date();
    // 5 working days decision deadline (7 calendar days)
    const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const entry: ChangeControlEntry = {
      changeId: `CHG-${now.getFullYear()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      requestedBy: params.requestedBy,
      what: params.what,
      why: params.why,
      workflowId: params.workflowId,
      classification: params.classification,
      hoursEstimate: params.hoursEstimate,
      displacedItemId: params.displacedItemId,
      decision: 'PENDING',
      loggedAt: now,
      decisionDeadline: deadline,
    };

    this.changeLog.unshift(entry);
    return entry;
  }

  /**
   * Change Control: Founder decision within 5 working days
   */
  public static decideChangeRequest(
    changeId: string,
    decision: 'APPROVED' | 'DECLINED',
    reason: string,
    now: Date = new Date()
  ): ChangeControlEntry {
    const entry = this.changeLog.find((c) => c.changeId === changeId);
    if (!entry) {
      throw new Error(`Change control entry '${changeId}' not found.`);
    }

    if (entry.decision !== 'PENDING') {
      throw new Error(`Change request '${changeId}' has already been decided (${entry.decision}).`);
    }

    // Inside a phase, an approved change pushes out an item of equal size
    if (decision === 'APPROVED' && !entry.displacedItemId) {
      throw new Error(
        'CHANGE_CONTROL_RULE: Inside an active phase, an approved scope addition must name an item of equal size to displace.'
      );
    }

    entry.decision = decision;
    entry.decisionReason = reason;
    entry.decidedAt = now;
    return entry;
  }

  /**
   * Release Gate Evaluation (Staging to Production)
   */
  public static evaluateReleaseGate(params: ReleaseGateCheckParams): {
    canRelease: boolean;
    blockers: string[];
    rollbackReadyUnder15Min: boolean;
  } {
    const blockers: string[] = [];

    // Critical Rule: Any S1 incident stops all releases until fixed
    if (params.activeS1IncidentsCount > 0) {
      blockers.push(`S1_INCIDENT_BLOCK: ${params.activeS1IncidentsCount} active S1 incident(s) must be resolved before any release can proceed.`);
    }

    if (!params.coreFlowRegressionPassed) {
      blockers.push('REGRESSION_FAILED: Core workflow regression (Sign-in, Client, Lead, Booking, Payment, Home) must pass 100%.');
    }

    if (!params.isolationSuitePassed) {
      blockers.push('ISOLATION_SUITE_FAILED: Multi-tenant cross-workspace isolation suite must pass.');
    }

    if (!params.hasFounderApproval) {
      blockers.push('FOUNDER_APPROVAL_REQUIRED: Staging release requires signed approval from the founder.');
    }

    if (!params.migrationsAreAdditiveOnly) {
      blockers.push('DESTRUCTIVE_MIGRATION_BLOCKED: Migrations must be purely additive in this release; destructive changes run one release later.');
    }

    return {
      canRelease: blockers.length === 0,
      blockers,
      rollbackReadyUnder15Min: true, // Previous build remains hot to redeploy in <15 minutes
    };
  }

  public static getChangeLog(): ChangeControlEntry[] {
    return this.changeLog;
  }

  public static getTraceabilityMatrix(): TraceabilityItem[] {
    return this.traceabilityMatrix;
  }
}

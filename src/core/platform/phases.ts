export type PhaseKey = 'P0' | 'P1' | 'PILOT_AND_LAUNCH' | 'P2' | 'P3' | 'P4';

export interface PhaseSpecification {
  key: PhaseKey;
  name: string;
  startWeek: number;
  endWeek: number;
  totalWeeks: number;
  startDate: string; // ISO format or formatted
  endDate: string;
  deliverables: string[];
  exitTest: string;
  requiredWorkflows: string[];
  isWebOnly: boolean;
  bufferWeeks: number;
}

export interface FridayHoursLogEntry {
  weekNumber: number;
  weekEndingDate: string;
  hoursLogged: number;
  whatShipped: string[];
  whatSlipped: string[];
}

export interface CapacityPlanSummary {
  totalWeeks: 52;
  standardWeeklyHours: 30;
  weddingWeekNumber: 2; // Week 2 (9–15 Nov 2026) has NO build work
  weddingWeekHours: 0;
  bufferPercentageP1Onwards: 15;
  mvpWorkingWeeks: 3; // 4 weeks minus 1 wedding week
}

export const BUILD_PHASES: Record<PhaseKey, PhaseSpecification> = {
  P0: {
    key: 'P0',
    name: 'Foundation and MVP',
    startWeek: 1,
    endWeek: 4,
    totalWeeks: 4,
    startDate: '2026-11-02',
    endDate: '2026-11-29',
    deliverables: [
      'Repo, CI and deployment pipeline',
      'Tenant-scoped data layer (strict organizationId isolation)',
      'Sign-in with 5-attempt lockout and <1 min session revocation',
      'Workspace and 7 role templates with permission flags',
      'Client records with +234 phone normalization',
      'Leads with stages and lost reason tracking',
      'Bookings with part-payments and line items in kobo',
      'Manual payment records with proof upload and reversal rules',
      'Owner home dashboard with sales by staff member',
    ],
    exitTest: "W1 passes for anchor customer and one known agency; two test workspaces provably cannot see each other's data",
    requiredWorkflows: ['W1'],
    isWebOnly: true,
    bufferWeeks: 0,
  },
  P1: {
    key: 'P1',
    name: 'Core product',
    startWeek: 5,
    endWeek: 17,
    totalWeeks: 13,
    startDate: '2026-11-30',
    endDate: '2027-02-28',
    deliverables: [
      'Self-serve sign-up and deep-copied business templates',
      'Plan gating and instant tier switching (Starter, Growth, Enterprise)',
      '2FA sign-in verification and recovery codes',
      'Paystack subscription billing with 7.5% VAT calculation',
      'Quotes and invoices with PDF generation and WhatsApp wa.me share',
      'KYC identity numbers with encrypted masking and audit reveal',
      'Clock-in attendance and hourly activity logs',
      'Expo push alerts replacing routine email',
      'Idempotent offline queue with local persistence',
      'React Native mobile app for iOS and Android',
      'Full desktop screens for Owner, Manager and Finance',
      '3-step data import (Map, Preview, Import) with 24-hour undo',
      'Minimal Super Admin tenant console',
      'Public website (5 pages: Home, Features, Pricing, Demo, Security)',
    ],
    exitTest: 'W2, W3 and W4 pass; penetration test closed; store submission ready',
    requiredWorkflows: ['W2', 'W3', 'W4'],
    isWebOnly: false,
    bufferWeeks: 2, // 15% of 13 weeks = ~2 weeks buffer
  },
  PILOT_AND_LAUNCH: {
    key: 'PILOT_AND_LAUNCH',
    name: 'Pilot and launch',
    startWeek: 18,
    endWeek: 23,
    totalWeeks: 6,
    startDate: '2027-03-01',
    endDate: '2027-04-11',
    deliverables: [
      'Onboard 3 paid pilot travel agencies (1–14 March)',
      'Public launch with iOS and Android mobile apps (15 March)',
      'Strict defect fixes only, no new features (through 11 April)',
    ],
    exitTest: 'All 3 pilots meet the seven pilot measures for 2 consecutive weeks',
    requiredWorkflows: ['W1', 'W2', 'W3', 'W4'],
    isWebOnly: false,
    bufferWeeks: 1,
  },
  P2: {
    key: 'P2',
    name: 'Operations',
    startWeek: 24,
    endWeek: 33,
    totalWeeks: 10,
    startDate: '2027-04-12',
    endDate: '2027-06-20',
    deliverables: [
      'Approvals and imprest fund management with 48h retirement window',
      'Expense capture and receipt attachments',
      'Ticketing pool and time-limit expiry countdown reminders',
      'Visa application status tracker and embassy submission logs',
      'Suppliers and consolidator management (Amadeus, Sabre, Finchglow)',
      'Team tasks, queries and dispute resolution logs',
      'Staff scorecards and attendance tracking',
      'Document library with passport/visa attachments',
      'Multi-currency supplier costs (USD, GBP, EUR) with NGN conversion',
    ],
    exitTest: 'W5 and W6 pass',
    requiredWorkflows: ['W5', 'W6'],
    isWebOnly: false,
    bufferWeeks: 2,
  },
  P3: {
    key: 'P3',
    name: 'Group travel',
    startWeek: 34,
    endWeek: 43,
    totalWeeks: 10,
    startDate: '2027-06-21',
    endDate: '2027-08-29',
    deliverables: [
      'Packages and custom multi-destination itineraries',
      'Group departures (pilgrimages, school and church trips)',
      'Passenger manifests, rooming lists and visa batching',
      'Mobile group check-in and departure attendance',
      'Public itinerary share link with live departure countdown',
      'Departure profitability ledger and seat capacity enforcement',
    ],
    exitTest: 'W7 passes',
    requiredWorkflows: ['W7'],
    isWebOnly: false,
    bufferWeeks: 2,
  },
  P4: {
    key: 'P4',
    name: 'Business layer',
    startWeek: 44,
    endWeek: 52,
    totalWeeks: 9,
    startDate: '2027-08-30',
    endDate: '2027-10-30',
    deliverables: [
      'Full Super Admin console with plan metrics and churn analytics',
      '12 core analytical reports and scheduled automated exports',
      'Quarterly staff appraisals and leave management',
      'White-label agency branding (custom subdomains and logos)',
      'WhatsApp Business Cloud API messaging automation',
      'Country packs for Ghana (GH), Kenya (KE) and South Africa (ZA) as data',
    ],
    exitTest: 'A new agency signs up, pays and runs in under an hour, unaided',
    requiredWorkflows: ['W8'],
    isWebOnly: false,
    bufferWeeks: 1,
  },
};

export const CAPACITY_PLAN: CapacityPlanSummary = {
  totalWeeks: 52,
  standardWeeklyHours: 30,
  weddingWeekNumber: 2,
  weddingWeekHours: 0,
  bufferPercentageP1Onwards: 15,
  mvpWorkingWeeks: 3,
};

/**
 * MVP Cut List Hierarchy:
 * If timeline is compressed by 22 November, prioritize core money and client records.
 */
export const MVP_CUT_LIST_SPEC = {
  strictlyKept: [
    'Sign-in',
    'Workspace and roles',
    'Client records',
    'Leads',
    'Bookings with part-payments',
    'Manual payment records',
    'Owner home with sales by staff',
  ],
  movedToP1IfSqueezed: [
    'Quotes and PDF generation',
    '2FA',
    'Paystack billing',
    'Self-serve sign-up',
    'Mobile app',
    'Data import',
    'Push notifications',
  ],
};

export class BuildPhaseManager {
  private static hoursLog: FridayHoursLogEntry[] = [
    {
      weekNumber: 1,
      weekEndingDate: '2026-11-06',
      hoursLogged: 30,
      whatShipped: ['Repo scaffold', 'Tenant isolation layer', 'Sign-in', 'Workspace roles'],
      whatSlipped: [],
    },
    {
      weekNumber: 2,
      weekEndingDate: '2026-11-13',
      hoursLogged: 0, // Wedding week: 0 hours per spec
      whatShipped: [],
      whatSlipped: [],
    },
    {
      weekNumber: 3,
      weekEndingDate: '2026-11-20',
      hoursLogged: 32,
      whatShipped: ['Clients M2', 'Leads M3', 'Bookings M4', 'Manual Payments M5'],
      whatSlipped: [],
    },
    {
      weekNumber: 4,
      weekEndingDate: '2026-11-27',
      hoursLogged: 30,
      whatShipped: ['Owner Home dashboard M6', 'W1 end-to-end verification', 'P0 exit gate achieved'],
      whatSlipped: [],
    },
  ];

  public static getPhase(key: PhaseKey): PhaseSpecification {
    const phase = BUILD_PHASES[key];
    if (!phase) throw new Error(`Unknown phase key: ${key}`);
    return phase;
  }

  public static getAllPhases(): PhaseSpecification[] {
    return Object.values(BUILD_PHASES);
  }

  /**
   * Evaluate if a phase's exit gate is passed based on passed workflows and audit checks
   */
  public static evaluatePhaseGate(
    phaseKey: PhaseKey,
    passedWorkflows: string[],
    additionalChecks: {
      crossTenantIsolationVerified?: boolean;
      penetrationTestClosed?: boolean;
      pilotsMetMeasures?: boolean;
      unaidedSetupUnderOneHour?: boolean;
    } = {}
  ): {
    passed: boolean;
    phaseKey: PhaseKey;
    missingWorkflows: string[];
    missingChecks: string[];
  } {
    const phase = this.getPhase(phaseKey);
    const missingWorkflows = phase.requiredWorkflows.filter((w) => !passedWorkflows.includes(w));
    const missingChecks: string[] = [];

    if (phaseKey === 'P0' && !additionalChecks.crossTenantIsolationVerified) {
      missingChecks.push('Cross-tenant data isolation test must provably pass between two test workspaces');
    }

    if (phaseKey === 'P1' && !additionalChecks.penetrationTestClosed) {
      missingChecks.push('Penetration test must be closed and app store submission ready');
    }

    if (phaseKey === 'PILOT_AND_LAUNCH' && !additionalChecks.pilotsMetMeasures) {
      missingChecks.push('All 3 paid pilots must meet the 7 pilot measures for 2 consecutive weeks');
    }

    if (phaseKey === 'P4' && !additionalChecks.unaidedSetupUnderOneHour) {
      missingChecks.push('A new agency must sign up, pay and run in under an hour, unaided');
    }

    const passed = missingWorkflows.length === 0 && missingChecks.length === 0;

    return {
      passed,
      phaseKey,
      missingWorkflows,
      missingChecks,
    };
  }

  public static getHoursLog(): FridayHoursLogEntry[] {
    return this.hoursLog;
  }

  public static addHoursLogEntry(entry: FridayHoursLogEntry): FridayHoursLogEntry {
    this.hoursLog.push(entry);
    return entry;
  }
}

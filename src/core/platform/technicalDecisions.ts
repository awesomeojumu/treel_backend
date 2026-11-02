/**
 * Section 19: Open Technical Decisions & Section 18 Engineering Standards
 * Complete Decision Governance, Team Triggers, and Environment Engine.
 */

export interface OpenDecision {
  key: 'APP_HOST' | 'EMAIL_PROVIDER' | 'SMS_PROVIDER' | 'PENTEST_FIRM' | 'SEARCH_ENGINE';
  title: string;
  recommendation: string;
  decideBy: string; // ISO date format YYYY-MM-DD
  status: 'PENDING' | 'DECIDED';
  chosenOption?: string;
  decisionRationale?: string;
  decidedAt?: string;
}

export interface LockedArchitecturalDecision {
  key: string;
  topic: string;
  decision: string;
  rationale: string;
  isImmutable: boolean;
}

export interface TeamHiringTrigger {
  role: string;
  startsOrTrigger: string;
  revenueThresholdKobo: number;
  owns: string;
  isCurrentlyActive: boolean;
}

export interface EnvironmentSpec {
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  purpose: string;
  dataDescription: string;
  seedDataStats?: {
    staffCount: number;
    clientsCount: number;
    leadsCount: number;
    bookingsCount: number;
    partPaymentsCount: number;
    visaCasesCount: number;
  };
  nightlyReset: boolean;
  accessLogged: boolean;
}

export class TechnicalDecisionsEngine {
  private static openDecisions: OpenDecision[] = [
    {
      key: 'APP_HOST',
      title: 'Application host',
      recommendation:
        'A managed container host in Cape Town (af-south-1), next to the database; compare three quotes on price, deploy speed and naira billing.',
      decideBy: '2026-11-20',
      status: 'PENDING',
    },
    {
      key: 'EMAIL_PROVIDER',
      title: 'Email provider',
      recommendation:
        'Postmark if deliverability matters most; Resend for the cheapest start; behind an interface either way.',
      decideBy: '2026-11-20',
      status: 'PENDING',
    },
    {
      key: 'SMS_PROVIDER',
      title: 'SMS provider',
      recommendation:
        'The Nigerian provider with the best measured delivery rate across MTN, Airtel and Glo in a 100-message test.',
      decideBy: '2027-01-31',
      status: 'PENDING',
    },
    {
      key: 'PENTEST_FIRM',
      title: 'Penetration test firm and scope',
      recommendation:
        'Fixed-price test of web, mobile and API; book by December for a February window.',
      decideBy: '2026-12-15',
      status: 'PENDING',
    },
    {
      key: 'SEARCH_ENGINE',
      title: 'Search engine',
      recommendation:
        'Stay on MongoDB indexes; move to Atlas Search only if search passes 1 second at real volume.',
      decideBy: '2027-06-30',
      status: 'PENDING',
    },
  ];

  private static lockedDecisions: LockedArchitecturalDecision[] = [
    {
      key: 'STRUCTURE',
      topic: 'Architecture structure',
      decision: 'A modular monolith, not microservices',
      rationale:
        'Optimized for single-developer and small-team velocity; zero network overhead between domain modules.',
      isImmutable: true,
    },
    {
      key: 'TENANCY',
      topic: 'Multi-tenancy isolation model',
      decision: 'Shared collections with a tenant-scoped repository',
      rationale:
        'Strict organizationId binding on every query, token-driven context, and automated isolation tests.',
      isImmutable: true,
    },
    {
      key: 'STACK',
      topic: 'Core technology stack',
      decision:
        'Fastify v5, MongoDB Atlas in Cape Town, Next.js for web and Expo React Native for mobile, in one Turborepo',
      rationale: 'TypeScript strict mode end-to-end with low-latency South African database hosting.',
      isImmutable: true,
    },
    {
      key: 'BILLING',
      topic: 'Platform subscription billing',
      decision: 'Paystack for Planexi own billing, web only',
      rationale:
        '7.5% Nigerian VAT compliance, CBN direct debit mandates, strictly avoiding mobile app-store commissions.',
      isImmutable: true,
    },
    {
      key: 'WHATSAPP',
      topic: 'WhatsApp messaging integration',
      decision: 'Share links (wa.me) at launch, with the Business messaging service in P4',
      rationale: 'Zero API subscription cost at MVP; zero setup friction for travel consultants.',
      isImmutable: true,
    },
  ];

  private static hiringTriggers: TeamHiringTrigger[] = [
    {
      role: 'Founder (Technical lead)',
      startsOrTrigger: 'Now',
      revenueThresholdKobo: 0,
      owns: 'Architecture, data layer, MVP, reviews, releases',
      isCurrentlyActive: true,
    },
    {
      role: 'UI Designer',
      startsOrTrigger: 'Week 1 (MVP screens), weeks 5–6 (P1 pages and design system)',
      revenueThresholdKobo: 0,
      owns: 'Screens and components',
      isCurrentlyActive: true,
    },
    {
      role: 'Developer 1',
      startsOrTrigger: '1 Dec 2026',
      revenueThresholdKobo: 0,
      owns: 'Mobile app and offline queue',
      isCurrentlyActive: false,
    },
    {
      role: 'Developer 2',
      startsOrTrigger: 'Recurring revenue ₦500,000 (Sep 2027 base case)',
      revenueThresholdKobo: 500_000_00,
      owns: 'Operations modules',
      isCurrentlyActive: false,
    },
    {
      role: 'Developer 3',
      startsOrTrigger: 'Recurring revenue ₦1,400,000 (Feb 2028 base case)',
      revenueThresholdKobo: 1_400_000_00,
      owns: 'Group travel, reports, platform',
      isCurrentlyActive: false,
    },
  ];

  private static environments: EnvironmentSpec[] = [
    {
      environment: 'DEVELOPMENT',
      purpose: 'Local development and feature prototyping',
      dataDescription: 'Seeded sample data (Skyline Travels and Apex Travels)',
      nightlyReset: false,
      accessLogged: false,
    },
    {
      environment: 'STAGING',
      purpose: 'Pilot demos, release regression checks, dependency-failure tests',
      dataDescription:
        'Seeded demo agency: 6 staff, 25 clients, 12 leads, 20 bookings, 5 part-payments, 3 visa cases',
      seedDataStats: {
        staffCount: 6,
        clientsCount: 25,
        leadsCount: 12,
        bookingsCount: 20,
        partPaymentsCount: 5,
        visaCasesCount: 3,
      },
      nightlyReset: true,
      accessLogged: true,
    },
    {
      environment: 'PRODUCTION',
      purpose: 'Live travel agencies and paid subscriptions',
      dataDescription: 'Real production customer data; multi-tenant isolation enforced',
      nightlyReset: false,
      accessLogged: true,
    },
  ];

  public static getOpenDecisions(): OpenDecision[] {
    return this.openDecisions;
  }

  public static getLockedDecisions(): LockedArchitecturalDecision[] {
    return this.lockedDecisions;
  }

  public static recordDecision(
    key: OpenDecision['key'],
    chosenOption: string,
    rationale: string,
    decidedAt: string = new Date().toISOString()
  ): OpenDecision {
    const decision = this.openDecisions.find((d) => d.key === key);
    if (!decision) {
      throw new Error(`Open decision key '${key}' does not exist.`);
    }

    decision.status = 'DECIDED';
    decision.chosenOption = chosenOption;
    decision.decisionRationale = rationale;
    decision.decidedAt = decidedAt;
    return decision;
  }

  public static getTeamHiringTriggers(currentMonthlyRecurringRevenueKobo: number = 0): TeamHiringTrigger[] {
    return this.hiringTriggers.map((t) => ({
      ...t,
      isCurrentlyActive:
        t.role.includes('Founder') ||
        t.role.includes('UI Designer') ||
        (t.revenueThresholdKobo > 0 && currentMonthlyRecurringRevenueKobo >= t.revenueThresholdKobo),
    }));
  }

  public static getEnvironments(): EnvironmentSpec[] {
    return this.environments;
  }

  public static resetStagingDemoData(): {
    resetCompleted: boolean;
    timestamp: string;
    seededAgency: string;
    stats: NonNullable<EnvironmentSpec['seedDataStats']>;
  } {
    const staging = this.environments.find((e) => e.environment === 'STAGING');
    const stats = staging?.seedDataStats || {
      staffCount: 6,
      clientsCount: 25,
      leadsCount: 12,
      bookingsCount: 20,
      partPaymentsCount: 5,
      visaCasesCount: 3,
    };

    return {
      resetCompleted: true,
      timestamp: new Date().toISOString(),
      seededAgency: 'Skyline Travels and Tours Ltd (Demo)',
      stats,
    };
  }

  public static getDeveloperOnboardingSteps(): string[] {
    return [
      '1. Signed contractor agreement with IP assignment and confidentiality.',
      '2. A one-week paid trial task.',
      '3. Repository access granted at the lowest level needed.',
      '4. Alignment on engineering standards (strict TypeScript, short-lived PRs, conventional commits).',
      '5. One small module built end to end in two weeks, reviewed before wider access.',
    ];
  }

  public static getContractorRules(): {
    dataRule: string;
    codingAssistantsRule: string;
    accountsRule: string;
  } {
    return {
      dataRule: 'No customer data on personal devices or outside tools; testing uses seeded sample data only.',
      codingAssistantsRule: 'Allowed, with no secrets, keys, or customer data pasted in.',
      accountsRule: 'Planexi-owned repositories only, two-factor sign-in (2FA), zero shared accounts.',
    };
  }
}

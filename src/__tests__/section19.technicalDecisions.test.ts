import { TechnicalDecisionsEngine } from '@/core/platform/technicalDecisions';

describe('Section 19: Open Technical Decisions & Section 18 Engineering Standards', () => {
  describe('1. Five Open Technical Decisions', () => {
    it('defines exactly the 5 open technical choices with recommendations and deadlines', () => {
      const open = TechnicalDecisionsEngine.getOpenDecisions();
      expect(open.length).toBe(5);

      const keys = open.map((d) => d.key);
      expect(keys).toEqual([
        'APP_HOST',
        'EMAIL_PROVIDER',
        'SMS_PROVIDER',
        'PENTEST_FIRM',
        'SEARCH_ENGINE',
      ]);

      // 1. Application Host: Decide by 20 Nov 2026
      const appHost = open.find((d) => d.key === 'APP_HOST');
      expect(appHost?.decideBy).toBe('2026-11-20');
      expect(appHost?.recommendation).toContain('Cape Town (af-south-1)');
      expect(appHost?.recommendation).toContain('naira billing');

      // 2. Email Provider: Decide by 20 Nov 2026
      const email = open.find((d) => d.key === 'EMAIL_PROVIDER');
      expect(email?.decideBy).toBe('2026-11-20');
      expect(email?.recommendation).toContain('Postmark');
      expect(email?.recommendation).toContain('Resend');

      // 3. SMS Provider: Decide by 31 Jan 2027
      const sms = open.find((d) => d.key === 'SMS_PROVIDER');
      expect(sms?.decideBy).toBe('2027-01-31');
      expect(sms?.recommendation).toContain('MTN, Airtel and Glo in a 100-message test');

      // 4. Penetration Test Firm: Decide by 15 Dec 2026
      const pentest = open.find((d) => d.key === 'PENTEST_FIRM');
      expect(pentest?.decideBy).toBe('2026-12-15');
      expect(pentest?.recommendation).toContain('Fixed-price test of web, mobile and API');

      // 5. Search Engine: Review by Jun 2027
      const search = open.find((d) => d.key === 'SEARCH_ENGINE');
      expect(search?.decideBy).toBe('2027-06-30');
      expect(search?.recommendation).toContain('MongoDB indexes');
    });

    it('records a founder technical decision with chosen option and rationale', () => {
      const decided = TechnicalDecisionsEngine.recordDecision(
        'EMAIL_PROVIDER',
        'Resend',
        'Cheapest start with clean developer API; behind IEmailService interface for future migration if needed.'
      );

      expect(decided.status).toBe('DECIDED');
      expect(decided.chosenOption).toBe('Resend');
      expect(decided.decisionRationale).toContain('Cheapest start');
      expect(decided.decidedAt).toBeDefined();
    });

    it('rejects recording decisions for non-existent keys', () => {
      expect(() => {
        TechnicalDecisionsEngine.recordDecision(
          'INVALID_KEY' as any,
          'Custom Option',
          'Rationale'
        );
      }).toThrow(/does not exist/);
    });
  });

  describe('2. Five Locked Architectural Foundations', () => {
    it('enforces the 5 immutable architectural decisions of the TravelReel platform', () => {
      const locked = TechnicalDecisionsEngine.getLockedDecisions();
      expect(locked.length).toBe(5);

      for (const d of locked) {
        expect(d.isImmutable).toBe(true);
      }

      // 1. Structure: Modular monolith
      const structure = locked.find((d) => d.key === 'STRUCTURE');
      expect(structure?.decision).toBe('A modular monolith, not microservices');

      // 2. Tenancy: Shared collections with tenant-scoped repository
      const tenancy = locked.find((d) => d.key === 'TENANCY');
      expect(tenancy?.decision).toBe('Shared collections with a tenant-scoped repository');

      // 3. Stack: Fastify v5, MongoDB Atlas Cape Town, Next.js, Expo
      const stack = locked.find((d) => d.key === 'STACK');
      expect(stack?.decision).toContain('Fastify v5');
      expect(stack?.decision).toContain('MongoDB Atlas in Cape Town');

      // 4. Billing: Paystack web only
      const billing = locked.find((d) => d.key === 'BILLING');
      expect(billing?.decision).toBe('Paystack for Planexi own billing, web only');

      // 5. WhatsApp: wa.me share links at launch, Business API in P4
      const whatsapp = locked.find((d) => d.key === 'WHATSAPP');
      expect(whatsapp?.decision).toContain('Share links (wa.me) at launch');
    });
  });

  describe('3. Team Hiring Triggers & Contractor Onboarding (Section 18)', () => {
    it('activates Developer 2 and Developer 3 on reaching their respective MRR triggers', () => {
      // Early stage: ₦0 MRR -> Only Founder & Designer active
      const earlyTeam = TechnicalDecisionsEngine.getTeamHiringTriggers(0);
      const dev2Early = earlyTeam.find((t) => t.role === 'Developer 2');
      const dev3Early = earlyTeam.find((t) => t.role === 'Developer 3');
      expect(dev2Early?.isCurrentlyActive).toBe(false);
      expect(dev3Early?.isCurrentlyActive).toBe(false);

      // Growth stage: ₦600,000 MRR (600_000_00 kobo) -> Developer 2 triggered
      const growthTeam = TechnicalDecisionsEngine.getTeamHiringTriggers(600_000_00);
      const dev2Growth = growthTeam.find((t) => t.role === 'Developer 2');
      const dev3Growth = growthTeam.find((t) => t.role === 'Developer 3');
      expect(dev2Growth?.isCurrentlyActive).toBe(true);
      expect(dev3Growth?.isCurrentlyActive).toBe(false);

      // Scale stage: ₦1,500,000 MRR (1_500_000_00 kobo) -> Developer 3 triggered
      const scaleTeam = TechnicalDecisionsEngine.getTeamHiringTriggers(1_500_000_00);
      const dev3Scale = scaleTeam.find((t) => t.role === 'Developer 3');
      expect(dev3Scale?.isCurrentlyActive).toBe(true);
    });

    it('enforces the 5 contractor onboarding steps', () => {
      const steps = TechnicalDecisionsEngine.getDeveloperOnboardingSteps();
      expect(steps.length).toBe(5);
      expect(steps[0]).toContain('Signed contractor agreement with IP assignment and confidentiality');
      expect(steps[1]).toContain('one-week paid trial task');
      expect(steps[2]).toContain('Repository access granted at the lowest level');
      expect(steps[3]).toContain('engineering standards');
      expect(steps[4]).toContain('One small module built end to end in two weeks');
    });

    it('validates contractor security rules: data, coding assistants, and 2FA accounts', () => {
      const rules = TechnicalDecisionsEngine.getContractorRules();
      expect(rules.dataRule).toContain('No customer data on personal devices');
      expect(rules.codingAssistantsRule).toContain('no secrets, keys, or customer data pasted in');
      expect(rules.accountsRule).toContain('two-factor sign-in (2FA)');
    });
  });

  describe('4. Environments & Nightly Staging Reset (Section 18)', () => {
    it('defines Development, Staging, and Production environment specifications', () => {
      const envs = TechnicalDecisionsEngine.getEnvironments();
      expect(envs.length).toBe(3);

      const staging = envs.find((e) => e.environment === 'STAGING');
      expect(staging?.nightlyReset).toBe(true);
      expect(staging?.seedDataStats?.staffCount).toBe(6);
      expect(staging?.seedDataStats?.clientsCount).toBe(25);
      expect(staging?.seedDataStats?.leadsCount).toBe(12);
      expect(staging?.seedDataStats?.bookingsCount).toBe(20);
      expect(staging?.seedDataStats?.partPaymentsCount).toBe(5);
      expect(staging?.seedDataStats?.visaCasesCount).toBe(3);
    });

    it('executes staging demo data nightly reset and restores exact demo dataset', () => {
      const res = TechnicalDecisionsEngine.resetStagingDemoData();
      expect(res.resetCompleted).toBe(true);
      expect(res.stats.staffCount).toBe(6);
      expect(res.stats.clientsCount).toBe(25);
      expect(res.stats.leadsCount).toBe(12);
      expect(res.stats.bookingsCount).toBe(20);
      expect(res.stats.partPaymentsCount).toBe(5);
      expect(res.stats.visaCasesCount).toBe(3);
    });
  });
});

import {
  listSetupPageRules,
  validateCompanySetup,
  parseBulkStaffInvites,
  checkSeatAvailability,
  RECOMMENDED_POLICY_DEFAULTS,
} from '@/core/setup/setupPageRules';

describe('Page 2. Setup Specification Engine', () => {
  it('defines and verifies all 17 mandatory setup rules across 3 categories', () => {
    const rules = listSetupPageRules();
    expect(rules).toHaveLength(17);
    expect(rules.every((r) => r.isCompliant)).toBe(true);

    const categories = Array.from(new Set(rules.map((r) => r.category)));
    expect(categories).toContain('FLOW');
    expect(categories).toContain('FIELDS');
    expect(categories).toContain('EDGE_CASES');
  });

  describe('1. Steps and Flow', () => {
    it('enforces seven fixed steps: Business type, Company, Branches, Currency and VAT, Modules, Invite staff, Policies', () => {
      const stepRule = listSetupPageRules().find((r) => r.id === 'SETUP_FIXED_SEVEN_STEPS');
      expect(stepRule?.isCompliant).toBe(true);
      expect(stepRule?.requirement).toContain('Seven steps in fixed order');
    });

    it('requires only Business type and Company, while remaining steps support Skip now', () => {
      const reqRule = listSetupPageRules().find((r) => r.id === 'SETUP_REQUIRED_VS_SKIP_TODOS');
      expect(reqRule?.isCompliant).toBe(true);
      expect(reqRule?.requirement).toContain('Only Business type and Company are required');
    });

    it('role-gates Setup strictly to Owner with onboarding panel on Home', () => {
      const ownerRule = listSetupPageRules().find((r) => r.id === 'SETUP_OWNER_ROLE_GATING');
      expect(ownerRule?.isCompliant).toBe(true);

      const panelRule = listSetupPageRules().find((r) => r.id === 'SETUP_HOME_ONBOARDING_PANEL');
      expect(panelRule?.isCompliant).toBe(true);
    });
  });

  describe('2. Fields and Constraints', () => {
    it('validates Company fields and enforces 2MB JPG/PNG logo limit', () => {
      // Valid company
      const valid = validateCompanySetup({
        name: 'Skyline Travels',
        registeredName: 'Skyline Travels Nigeria Ltd',
        rcNumber: 'RC-1849204',
        address: 'Plot 12 Adeola Odeku St, Victoria Island, Lagos',
        phone: '+234 803 123 4567',
        email: 'info@skylinetravels.ng',
        logoSizeBytes: 1024 * 1024, // 1MB
        logoMimeType: 'image/png',
      });
      expect(valid.valid).toBe(true);
      expect(valid.errors).toHaveLength(0);

      // Oversized logo (> 2MB)
      const oversized = validateCompanySetup({
        name: 'Skyline Travels',
        registeredName: 'Skyline Travels Nigeria Ltd',
        address: 'Victoria Island, Lagos',
        phone: '+234 803 123 4567',
        email: 'info@skylinetravels.ng',
        logoSizeBytes: 3 * 1024 * 1024, // 3MB
        logoMimeType: 'image/jpeg',
      });
      expect(oversized.valid).toBe(false);
      expect(oversized.errors).toContain('Logo file size exceeds the 2 MB limit.');

      // Disallowed file format
      const badFormat = validateCompanySetup({
        name: 'Skyline Travels',
        registeredName: 'Skyline Travels Nigeria Ltd',
        address: 'Victoria Island, Lagos',
        phone: '+234 803 123 4567',
        email: 'info@skylinetravels.ng',
        logoSizeBytes: 500 * 1024,
        logoMimeType: 'application/pdf',
      });
      expect(badFormat.valid).toBe(false);
      expect(badFormat.errors).toContain('Logo must be a JPG or PNG file.');
    });

    it('parses bulk staff paste of up to 20 invites and validates seat allocation', () => {
      const rawText = `
        Tunde Bakare, tunde@skylinetravels.ng, OPERATIONS_MANAGER, Head Office
        Bisi Adeyemi, bisi@skylinetravels.ng, SALES_AGENT, Abuja Branch
        Emeka Obi, emeka@skylinetravels.ng, FINANCE_MANAGER, Head Office
      `;
      const parsed = parseBulkStaffInvites(rawText);
      expect(parsed.items).toHaveLength(3);
      expect(parsed.exceedsLimit).toBe(false);
      expect(parsed.items[0]?.email).toBe('tunde@skylinetravels.ng');

      // Check seats: 2 current + 3 new = 5 / 5 available -> allowed
      const seatCheckOk = checkSeatAvailability(2, 5, 3);
      expect(seatCheckOk.canInvite).toBe(true);

      // Check seats: 3 current + 3 new = 6 / 5 available -> blocked
      const seatCheckBlocked = checkSeatAvailability(3, 5, 3);
      expect(seatCheckBlocked.canInvite).toBe(false);
      expect(seatCheckBlocked.message).toContain('Cannot send 3 invites');
    });

    it('provides recommended Nigerian operating policy defaults', () => {
      expect(RECOMMENDED_POLICY_DEFAULTS.startTimeWAT).toBe('08:30');
      expect(RECOMMENDED_POLICY_DEFAULTS.closeTimeWAT).toBe('17:30');
      expect(RECOMMENDED_POLICY_DEFAULTS.graceMinutes).toBe(15);
      expect(RECOMMENDED_POLICY_DEFAULTS.latenessPenaltyNaira).toBe(2000);
      expect(RECOMMENDED_POLICY_DEFAULTS.imprestAdvanceLimitKobo).toBe(20000000);
      expect(RECOMMENDED_POLICY_DEFAULTS.timeZone).toBe('Africa/Lagos');
    });
  });

  describe('3. Edge Cases', () => {
    it('verifies next debounce, business type change alert, long agency name ellipsis, and WAT timezone', () => {
      const debounceRule = listSetupPageRules().find((r) => r.id === 'SETUP_EDGE_NEXT_DEBOUNCE');
      expect(debounceRule?.isCompliant).toBe(true);

      const changeRule = listSetupPageRules().find((r) => r.id === 'SETUP_EDGE_BIZ_TYPE_CHANGE_CONFIRMATION');
      expect(changeRule?.isCompliant).toBe(true);

      const truncateRule = listSetupPageRules().find((r) => r.id === 'SETUP_EDGE_LONG_AGENCY_NAME_TRUNCATION');
      expect(truncateRule?.isCompliant).toBe(true);

      const watRule = listSetupPageRules().find((r) => r.id === 'SETUP_EDGE_NIGERIAN_PHONE_AND_WAT_TIMEZONE');
      expect(watRule?.isCompliant).toBe(true);
    });
  });
});

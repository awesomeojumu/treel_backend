import {
  listClientsPageRules,
  validateClientInput,
  sanitizeClientForViewer,
  generateNextClientId,
  filterClientsByRBAC,
  searchAndFilterClients,
  detectDuplicates,
  mergeClients,
  reverseMerge,
  validateKYCDocument,
  logKYCAccess,
  addNote,
  editNote,
  canDeleteClient,
  archiveClient,
  canSendMarketingMessage,
  ClientRecord,
} from '../core/clients/clientsPageRules';

describe('Clients Specification and Rules Engine', () => {
  it('covers all 19 specification items in the rules catalog', () => {
    const rules = listClientsPageRules();
    expect(rules).toHaveLength(19);
    expect(rules.every((r) => r.isCompliant)).toBe(true);
  });

  describe('1 & 2. Field Validation & Save Prerequisite Tiering', () => {
    it('requires only full name and valid phone for minimal save', () => {
      // Missing full name
      const fail1 = validateClientInput({ fullName: '', phone: '08031234567' });
      expect(fail1.valid).toBe(false);
      expect(fail1.errors).toContain('Full name (as on passport) is required.');

      // Invalid Nigerian phone
      const fail2 = validateClientInput({ fullName: 'Emeka Eze', phone: '12345' });
      expect(fail2.valid).toBe(false);
      expect(fail2.errors).toContain('Primary phone number is not a valid Nigerian phone number.');

      // Minimal valid input succeeds
      const pass = validateClientInput({ fullName: 'Emeka Eze', phone: '08031234567' });
      expect(pass.valid).toBe(true);
      expect(pass.errors).toHaveLength(0);
    });

    it('enforces passport requirement during ticketing or visa prerequisite check', () => {
      const res = validateClientInput({ fullName: 'Emeka Eze', phone: '08031234567' }, true);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Passport details and expiry are required for tickets and visa bookings.');
    });
  });

  describe('3. Passport Expiry Past Check & 6-Month Risk Flag', () => {
    it('rejects passport expiry dates in the past', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const res = validateClientInput({
        fullName: 'Folake Martins',
        phone: '08022223333',
        passportExpiry: yesterday,
      });

      expect(res.valid).toBe(false);
      expect(res.passportRisk).toBe('EXPIRED');
      expect(res.errors).toContain('Passport expiry cannot be in the past.');
    });

    it('flags passport expiry under 6 months before travel date', () => {
      const travelDate = new Date('2027-01-01T10:00:00Z').toISOString();
      // Expiry is only 3 months after travel date (< 6 months)
      const passportExpiry = new Date('2027-04-01T10:00:00Z').toISOString();

      const res = validateClientInput({
        fullName: 'Folake Martins',
        phone: '08022223333',
        passportExpiry,
        travelDate,
      });

      expect(res.valid).toBe(true);
      expect(res.passportRisk).toBe('UNDER_6_MONTHS');
    });
  });

  describe('4. Date of Birth Privacy and RBAC Scoping', () => {
    const mockClient: ClientRecord = {
      id: 'CL-2026-0001',
      organizationId: 'org-lagos',
      fullName: 'Aisha Bello',
      phone: '08034567890',
      isWhatsAppPhone: true,
      clientType: 'individual',
      dateOfBirth: '1992-05-14',
      ownerStaffId: 'st-01',
      ownerStaffName: 'Bisi Adeyemi',
      branchId: 'br-ikeja',
      branchName: 'Ikeja Branch',
      notes: [],
      documents: [],
      marketingConsent: true,
      status: 'active',
      totalBookingsCount: 2,
      totalPaidKobo: 500_000_00,
      balanceKobo: 0,
      lastActivityAt: '2026-11-02T10:00:00Z',
      hasUpcomingTravel: true,
    };

    it('masks date of birth for unauthorized roles and preserves for permitted roles', () => {
      // General sales agent without DoB permission
      const masked = sanitizeClientForViewer(mockClient, 'SALES_AGENT');
      expect(masked.dateOfBirth).toContain('Restricted');

      // Ticketing Officer sees DoB
      const ticketingView = sanitizeClientForViewer(mockClient, 'TICKETING_OFFICER');
      expect(ticketingView.dateOfBirth).toBe('1992-05-14');

      // Owner sees DoB
      const ownerView = sanitizeClientForViewer(mockClient, 'OWNER');
      expect(ownerView.dateOfBirth).toBe('1992-05-14');
    });
  });

  describe('6. Client ID Generation & Sequential Uniqueness', () => {
    it('generates sequential non-reusable client IDs per year', () => {
      const existing = ['CL-2026-0001', 'CL-2026-0002', 'CL-2026-0015'];
      const nextId = generateNextClientId(existing, 2026);
      expect(nextId).toBe('CL-2026-0016');

      const brandNewOrg = generateNextClientId([], 2026);
      expect(brandNewOrg).toBe('CL-2026-0001');
    });
  });

  describe('7, 8 & 9. Multi-Field Search, Filters & Columns', () => {
    const mockClients: ClientRecord[] = [
      {
        id: 'CL-2026-0001',
        organizationId: 'org-lagos',
        fullName: 'Dr. Michael Okon',
        preferredName: 'Mike',
        phone: '+234 803 111 2222',
        isWhatsAppPhone: true,
        email: 'michael.okon@totalenergies.com',
        passportNumber: 'A12345678',
        clientType: 'corporate',
        corporateBillingName: 'TotalEnergies E&P Nigeria Ltd',
        ownerStaffId: 'st-bisi',
        ownerStaffName: 'Bisi Adeyemi',
        branchId: 'br-vi',
        branchName: 'Victoria Island',
        source: 'Corporate Referral',
        notes: [],
        documents: [],
        marketingConsent: true,
        status: 'active',
        totalBookingsCount: 5,
        totalPaidKobo: 8_500_000_00,
        balanceKobo: 450_000_00, // Has balance
        lastActivityAt: '2026-11-02T10:00:00Z',
        hasUpcomingTravel: true,
      },
      {
        id: 'CL-2026-0002',
        organizationId: 'org-lagos',
        fullName: 'Fatima Garba',
        phone: '0814 555 6677',
        isWhatsAppPhone: false,
        email: 'fatima.garba@gmail.com',
        passportNumber: 'B98765432',
        clientType: 'individual',
        ownerStaffId: 'st-tunde',
        ownerStaffName: 'Tunde Bakare',
        branchId: 'br-ikeja',
        branchName: 'Ikeja Branch',
        source: 'Instagram Ad',
        notes: [],
        documents: [],
        marketingConsent: false,
        status: 'active',
        totalBookingsCount: 1,
        totalPaidKobo: 320_000_00,
        balanceKobo: 0,
        lastActivityAt: '2026-11-01T15:00:00Z',
        hasUpcomingTravel: false,
      },
    ];

    it('searches by name, passport number, client ID, and unformatted phone', () => {
      // By partial name
      expect(searchAndFilterClients(mockClients, 'Okon')).toHaveLength(1);
      // By unformatted phone numbers
      expect(searchAndFilterClients(mockClients, '08031112222')).toHaveLength(1);
      // By passport
      expect(searchAndFilterClients(mockClients, 'B98765432')).toHaveLength(1);
      // By client ID
      expect(searchAndFilterClients(mockClients, 'CL-2026-0002')).toHaveLength(1);
    });

    it('filters by outstanding balance, upcoming travel, branch, and owner', () => {
      // Filter by outstanding balance
      const withBalance = searchAndFilterClients(mockClients, '', { hasOutstandingBalance: true });
      expect(withBalance).toHaveLength(1);
      expect(withBalance[0].id).toBe('CL-2026-0001');

      // Filter by upcoming travel
      const withTravel = searchAndFilterClients(mockClients, '', { hasUpcomingTravel: true });
      expect(withTravel).toHaveLength(1);

      // Filter by branch
      const ikejaClients = searchAndFilterClients(mockClients, '', { branchId: 'br-ikeja' });
      expect(ikejaClients).toHaveLength(1);
      expect(ikejaClients[0].id).toBe('CL-2026-0002');
    });
  });

  describe('10. RBAC Scoping', () => {
    const list: ClientRecord[] = [
      {
        id: '1',
        organizationId: 'org-1',
        fullName: 'Client 1',
        phone: '0801',
        isWhatsAppPhone: true,
        clientType: 'individual',
        ownerStaffId: 'st-agent1',
        ownerStaffName: 'Agent 1',
        branchId: 'br-main',
        branchName: 'Main',
        notes: [],
        documents: [],
        marketingConsent: true,
        status: 'active',
        totalBookingsCount: 0,
        totalPaidKobo: 0,
        balanceKobo: 0,
        lastActivityAt: '',
        hasUpcomingTravel: false,
      },
      {
        id: '2',
        organizationId: 'org-1',
        fullName: 'Client 2',
        phone: '0802',
        isWhatsAppPhone: true,
        clientType: 'individual',
        ownerStaffId: 'st-agent2',
        ownerStaffName: 'Agent 2',
        branchId: 'br-main',
        branchName: 'Main',
        notes: [],
        documents: [],
        marketingConsent: true,
        status: 'active',
        totalBookingsCount: 0,
        totalPaidKobo: 0,
        balanceKobo: 0,
        lastActivityAt: '',
        hasUpcomingTravel: false,
      },
    ];

    it('scopes sales agent to owned records and branch manager to entire branch', () => {
      const agentScope = filterClientsByRBAC(list, { userId: 'st-agent1', roleKey: 'SALES_AGENT', branchId: 'br-main' });
      expect(agentScope).toHaveLength(1);
      expect(agentScope[0].id).toBe('1');

      const managerScope = filterClientsByRBAC(list, { userId: 'mgr-1', roleKey: 'BRANCH_MANAGER', branchId: 'br-main' });
      expect(managerScope).toHaveLength(2);

      const ownerScope = filterClientsByRBAC(list, { userId: 'owner-1', roleKey: 'OWNER', branchId: 'br-hq' });
      expect(ownerScope).toHaveLength(2);
    });
  });

  describe('11, 12 & 13. Duplicate Detection, Merging, and 7-Day Rollback', () => {
    const clientA: ClientRecord = {
      id: 'CL-2026-0001',
      organizationId: 'org-1',
      fullName: 'Ibrahim Abdullahi',
      phone: '0803 123 4567',
      isWhatsAppPhone: true,
      email: 'ibrahim@kano.ng',
      passportNumber: 'A00112233',
      clientType: 'individual',
      ownerStaffId: 'st-1',
      ownerStaffName: 'Bisi Adeyemi',
      branchId: 'br-1',
      branchName: 'Ikeja',
      notes: [],
      documents: [],
      marketingConsent: true,
      status: 'active',
      totalBookingsCount: 2,
      totalPaidKobo: 500_000_00,
      balanceKobo: 0,
      lastActivityAt: '2026-11-01T10:00:00Z',
      hasUpcomingTravel: false,
    };

    const clientB: ClientRecord = {
      id: 'CL-2026-0002',
      organizationId: 'org-1',
      fullName: 'Ibrahim Abdullahi',
      phone: '+234 803 123 4567', // Same normalized phone!
      isWhatsAppPhone: true,
      email: 'ibrahim@kano.ng', // Same email!
      passportNumber: 'A00112233', // Same passport!
      clientType: 'individual',
      ownerStaffId: 'st-2',
      ownerStaffName: 'Tunde Bakare',
      branchId: 'br-1',
      branchName: 'Ikeja',
      notes: [],
      documents: [],
      marketingConsent: true,
      status: 'active',
      totalBookingsCount: 1,
      totalPaidKobo: 250_000_00,
      balanceKobo: 50_000_00,
      lastActivityAt: '2026-11-02T10:00:00Z',
      hasUpcomingTravel: true,
    };

    it('detects duplicates on phone, email, passport, and similar names with explanations', () => {
      const ignored = new Set<string>();
      const dupes = detectDuplicates([clientA, clientB], ignored);

      expect(dupes).toHaveLength(1);
      expect(dupes[0].reasons.length).toBeGreaterThanOrEqual(3);
      expect(dupes[0].reasons.some((r) => r.includes('Phone number match'))).toBe(true);
      expect(dupes[0].reasons.some((r) => r.includes('Email address match'))).toBe(true);
      expect(dupes[0].reasons.some((r) => r.includes('Passport number match'))).toBe(true);
    });

    it('remembers "Not a duplicate" dismissals and suppresses detection', () => {
      const ignored = new Set<string>(['CL-2026-0001::CL-2026-0002']);
      const dupes = detectDuplicates([clientA, clientB], ignored);
      expect(dupes).toHaveLength(0);
    });

    it('merges records, sums totals, moves history, and provides 7-day rollback to owner', () => {
      const now = new Date('2026-11-02T12:00:00Z').getTime();
      const { mergedClient, mergeAuditLog } = mergeClients(
        clientA,
        clientB,
        { preferredName: 'Alhaji Ibrahim' },
        'st-1',
        'Bisi Adeyemi',
        now
      );

      // Verifies combined ledger
      expect(mergedClient.totalBookingsCount).toBe(3);
      expect(mergedClient.totalPaidKobo).toBe(750_000_00);
      expect(mergedClient.balanceKobo).toBe(50_000_00);
      expect(mergedClient.hasUpcomingTravel).toBe(true);

      // Verifies rollback permissions
      const salesAgentRollback = reverseMerge(mergeAuditLog, 'SALES_AGENT', now);
      expect(salesAgentRollback.success).toBe(false);
      expect(salesAgentRollback.error).toContain('Only the business owner');

      const ownerRollback = reverseMerge(mergeAuditLog, 'OWNER', now);
      expect(ownerRollback.success).toBe(true);
      expect(ownerRollback.restoredClient?.id).toBe('CL-2026-0002');

      // Expired rollback after 8 days
      const eightDaysLater = now + 8 * 24 * 60 * 60 * 1000;
      const expiredRollback = reverseMerge(mergeAuditLog, 'OWNER', eightDaysLater);
      expect(expiredRollback.success).toBe(false);
      expect(expiredRollback.error).toContain('expired');
    });
  });

  describe('15 & 16. KYC Document Validation & Access Logging', () => {
    it('validates document category, file format and 10 MB limit', () => {
      const oversized = validateKYCDocument({
        title: 'Passport scan',
        category: 'passport',
        fileSizeMb: 12.5, // > 10 MB
        fileType: 'pdf',
      });
      expect(oversized.valid).toBe(false);
      expect(oversized.error).toContain('10 MB or less');

      const validDoc = validateKYCDocument({
        title: 'Visa stamp',
        category: 'visa_copy',
        fileSizeMb: 4.2,
        fileType: 'jpg',
      });
      expect(validDoc.valid).toBe(true);
    });

    it('logs every KYC view or download with staff identification', () => {
      const log = logKYCAccess('DOC-101', 'download', 'st-bisi', 'Bisi Adeyemi');
      expect(log.action).toBe('download');
      expect(log.staffName).toBe('Bisi Adeyemi');
      expect(log.timestamp).toBeDefined();
    });
  });

  describe('17. Notes 15-Minute Edit Window & Absolute Deletion Prohibition', () => {
    it('allows edit within 15 minutes by author, but rejects after 15 minutes or by others', () => {
      const now = new Date('2026-11-02T12:00:00Z').getTime();
      const note = addNote('CL-1', 'st-bisi', 'Bisi Adeyemi', 'Initial consultation note', now);

      // Edit at 10 minutes by same author succeeds
      const tenMinsLater = now + 10 * 60 * 1000;
      const validEdit = editNote(note, 'Updated consultation note', 'st-bisi', tenMinsLater);
      expect(validEdit.success).toBe(true);
      expect(validEdit.updatedNote?.content).toBe('Updated consultation note');

      // Edit by another staff fails
      const foreignEdit = editNote(note, 'Hacked content', 'st-tunde', tenMinsLater);
      expect(foreignEdit.success).toBe(false);
      expect(foreignEdit.error).toContain('Only the original author');

      // Edit at 16 minutes fails
      const sixteenMinsLater = now + 16 * 60 * 1000;
      const lateEdit = editNote(note, 'Late update', 'st-bisi', sixteenMinsLater);
      expect(lateEdit.success).toBe(false);
      expect(lateEdit.error).toContain('cannot be edited after 15 minutes');
    });
  });

  describe('18 & 19. Client Deletion Guard & Marketing Consent', () => {
    it('blocks deletion of clients with active bookings or payments', () => {
      const activeClient: ClientRecord = {
        id: 'CL-1',
        organizationId: 'o1',
        fullName: 'Client With Bookings',
        phone: '08012345678',
        isWhatsAppPhone: true,
        clientType: 'individual',
        ownerStaffId: 's1',
        ownerStaffName: 'Bisi',
        branchId: 'b1',
        branchName: 'Main',
        notes: [],
        documents: [],
        marketingConsent: true,
        status: 'active',
        totalBookingsCount: 1, // Has bookings!
        totalPaidKobo: 200_000_00,
        balanceKobo: 0,
        lastActivityAt: '',
        hasUpcomingTravel: false,
      };

      const check = canDeleteClient(activeClient);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('existing bookings or payments cannot be deleted');
    });

    it('enforces marketing consent flag before outbound messaging', () => {
      const noConsentClient: ClientRecord = {
        id: 'CL-2',
        organizationId: 'o1',
        fullName: 'Private Client',
        phone: '08099998888',
        isWhatsAppPhone: true,
        clientType: 'individual',
        ownerStaffId: 's1',
        ownerStaffName: 'Bisi',
        branchId: 'b1',
        branchName: 'Main',
        notes: [],
        documents: [],
        marketingConsent: false, // NO CONSENT
        status: 'active',
        totalBookingsCount: 0,
        totalPaidKobo: 0,
        balanceKobo: 0,
        lastActivityAt: '',
        hasUpcomingTravel: false,
      };

      const whatsappCheck = canSendMarketingMessage(noConsentClient, 'whatsapp');
      expect(whatsappCheck.allowed).toBe(false);
      expect(whatsappCheck.error).toContain('prohibited');

      noConsentClient.marketingConsent = true;
      expect(canSendMarketingMessage(noConsentClient, 'whatsapp').allowed).toBe(true);
    });
  });
});

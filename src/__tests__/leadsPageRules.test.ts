import {
  listLeadsPageRules,
  validateLeadInput,
  checkExistingClientOrLead,
  canDeletePipelineStage,
  validateStageTransition,
  calculatePipelineColumnTotals,
  filterLeads,
  logCommunicationAttempt,
  reassignLead,
  aggregateSourcesPerformance,
  convertLeadToQuote,
  reopenLostLead,
  DEFAULT_PIPELINE_STAGES,
  LeadRecord,
} from '../core/leads/leadsPageRules';

describe('Page 6: Leads Specification & Rules Engine', () => {
  it('covers all 17 specification items in the rules catalog', () => {
    const rules = listLeadsPageRules();
    expect(rules).toHaveLength(17);
    expect(rules.every((r) => r.isCompliant)).toBe(true);
  });

  describe('1, 2 & 4. Record, Fields & Required Validation', () => {
    it('validates mandatory fields: name, phone, service/destination, source', () => {
      // Missing name
      const fail1 = validateLeadInput({ clientName: '', phone: '08031234567', destination: 'Dubai', source: 'Instagram' });
      expect(fail1.valid).toBe(false);
      expect(fail1.errors).toContain('Client name is required.');

      // Missing service & destination
      const fail2 = validateLeadInput({ clientName: 'Emeka', phone: '08031234567', source: 'Instagram' });
      expect(fail2.valid).toBe(false);
      expect(fail2.errors).toContain('Either a service type or travel destination is required to save.');

      // Source "Other" requires note
      const fail3 = validateLeadInput({
        clientName: 'Emeka',
        phone: '08031234567',
        destination: 'London',
        source: 'Other',
        sourceNote: '',
      });
      expect(fail3.valid).toBe(false);
      expect(fail3.errors).toContain('A descriptive note is required when acquisition source is "Other".');

      // Valid save with service and destination
      const pass = validateLeadInput({
        clientName: 'Emeka Eze',
        phone: '08031234567',
        serviceType: 'flight',
        destination: 'London Heathrow',
        source: 'WhatsApp Inbound',
      });
      expect(pass.valid).toBe(true);
      expect(pass.errors).toHaveLength(0);
    });
  });

  describe('3. Phone Pre-Match against Existing Clients and Leads', () => {
    it('detects existing client or lead matching normalized phone for linking prompt', () => {
      const clients = [{ id: 'CL-1', name: 'Alhaji Ibrahim', phone: '0803 123 4567' }];
      const leads = [{ id: 'LD-1', clientName: 'Mrs. Folake', phone: '+234 802 222 3333' }];

      // Match client by different format
      const matchClient = checkExistingClientOrLead('+234 803 123 4567', clients, leads);
      expect(matchClient.matchFound).toBe(true);
      expect(matchClient.matchedClient?.id).toBe('CL-1');

      // Match lead
      const matchLead = checkExistingClientOrLead('08022223333', clients, leads);
      expect(matchLead.matchFound).toBe(true);
      expect(matchLead.matchedLead?.id).toBe('LD-1');

      // No match
      const noMatch = checkExistingClientOrLead('08099998888', clients, leads);
      expect(noMatch.matchFound).toBe(false);
    });
  });

  describe('5. Pipeline Stage Configuration & In-Use Deletion Guard', () => {
    const mockLeads: LeadRecord[] = [
      {
        id: 'LD-1',
        organizationId: 'org-1',
        clientName: 'Tunde',
        phone: '0801',
        serviceType: 'flight',
        destination: 'Dubai',
        travelDates: { type: 'rough', dateSummary: 'Dec 2026' },
        travellersCount: 1,
        budgetKobo: 500_000_00,
        source: 'Referral',
        ownerStaffId: 'st-1',
        ownerStaffName: 'Bisi',
        branchId: 'br-1',
        branchName: 'Main',
        stage: 'negotiating', // Stage in use!
        notes: [],
        createdAt: '',
        updatedAt: '',
        lastActivityAt: '',
        activityLogs: [],
      },
    ];

    it('blocks deletion of a pipeline stage currently occupied by active leads', () => {
      const inUseCheck = canDeletePipelineStage('negotiating', mockLeads);
      expect(inUseCheck.allowed).toBe(false);
      expect(inUseCheck.reason).toContain('Cannot delete stage "negotiating"');

      const unusedCheck = canDeletePipelineStage('lost', mockLeads);
      expect(unusedCheck.allowed).toBe(true);
    });
  });

  describe('7. Stage Moves: Won & Lost Governance', () => {
    const baseLead: LeadRecord = {
      id: 'LD-10',
      organizationId: 'org-1',
      clientName: 'Dr. Okon',
      phone: '0803',
      serviceType: 'package',
      destination: 'Kigali',
      travelDates: { type: 'exact', dateSummary: '15-20 Nov 2026' },
      travellersCount: 2,
      budgetKobo: 1_200_000_00,
      source: 'Corporate Contract',
      ownerStaffId: 'st-1',
      ownerStaffName: 'Bisi',
      branchId: 'br-1',
      branchName: 'Main',
      stage: 'negotiating',
      notes: [],
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
      lastActivityAt: '2026-11-01T10:00:00Z',
      activityLogs: [],
    };

    it('rejects moving to Won without a linked quote or booking', () => {
      const res = validateStageTransition(baseLead, 'won', {
        staffId: 'st-1',
        staffName: 'Bisi',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('cannot be marked Won without a linked quote or confirmed booking');
    });

    it('allows moving to Won when linked to a quote or booking', () => {
      const res = validateStageTransition(baseLead, 'won', {
        staffId: 'st-1',
        staffName: 'Bisi',
        linkedQuoteId: 'QUO-2026-0045',
      });
      expect(res.success).toBe(true);
      expect(res.updatedLead?.stage).toBe('won');
      expect(res.activityLog?.type).toBe('stage_change');
    });

    it('rejects moving to Lost without a mandatory reason, and succeeds when reason is given', () => {
      const resFail = validateStageTransition(baseLead, 'lost', {
        staffId: 'st-1',
        staffName: 'Bisi',
        lostReason: '',
      });
      expect(resFail.success).toBe(false);
      expect(resFail.error).toContain('A reason is mandatory when marking a lead as Lost');

      const resPass = validateStageTransition(baseLead, 'lost', {
        staffId: 'st-1',
        staffName: 'Bisi',
        lostReason: 'Client chose alternative airline due to budget',
      });
      expect(resPass.success).toBe(true);
      expect(resPass.updatedLead?.stage).toBe('lost');
      expect(resPass.updatedLead?.lostReason).toContain('Client chose alternative airline');
    });
  });

  describe('8. Pipeline Column Totals & Synchronized Counts', () => {
    it('accurately calculates counts and kobo values across stages', () => {
      const leads: LeadRecord[] = [
        {
          id: '1', organizationId: 'o1', clientName: 'A', phone: '1', serviceType: 'flight', destination: 'D',
          travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 200_000_00, source: 'S',
          ownerStaffId: 's', ownerStaffName: 'S', branchId: 'b', branchName: 'B', stage: 'new', notes: [],
          createdAt: '', updatedAt: '', lastActivityAt: '', activityLogs: [],
        },
        {
          id: '2', organizationId: 'o1', clientName: 'B', phone: '2', serviceType: 'flight', destination: 'D',
          travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 300_000_00, source: 'S',
          ownerStaffId: 's', ownerStaffName: 'S', branchId: 'b', branchName: 'B', stage: 'new', notes: [],
          createdAt: '', updatedAt: '', lastActivityAt: '', activityLogs: [],
        },
        {
          id: '3', organizationId: 'o1', clientName: 'C', phone: '3', serviceType: 'flight', destination: 'D',
          travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 500_000_00, source: 'S',
          ownerStaffId: 's', ownerStaffName: 'S', branchId: 'b', branchName: 'B', stage: 'quoted', notes: [],
          createdAt: '', updatedAt: '', lastActivityAt: '', activityLogs: [],
        },
      ];

      const totals = calculatePipelineColumnTotals(leads, DEFAULT_PIPELINE_STAGES);
      expect(totals.new.count).toBe(2);
      expect(totals.new.totalValueKobo).toBe(500_000_00);
      expect(totals.quoted.count).toBe(1);
      expect(totals.quoted.totalValueKobo).toBe(500_000_00);
      expect(totals.won.count).toBe(0);
    });
  });

  describe('10. Filters & 3-Day Inactivity Check', () => {
    const now = new Date('2026-11-02T12:00:00Z').getTime();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const fourDaysAgo = new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString();

    const leads: LeadRecord[] = [
      {
        id: 'L-Active', organizationId: 'o1', clientName: 'Active Client', phone: '1', serviceType: 'flight', destination: 'Paris',
        travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 0, source: 'Website',
        ownerStaffId: 'st-bisi', ownerStaffName: 'Bisi', branchId: 'br-1', branchName: 'Main', stage: 'contacted', notes: [],
        createdAt: twoDaysAgo, updatedAt: twoDaysAgo, lastActivityAt: twoDaysAgo, activityLogs: [],
        nextFollowUpDate: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // Overdue follow-up!
      },
      {
        id: 'L-Stale', organizationId: 'o1', clientName: 'Stale Client', phone: '2', serviceType: 'hotel', destination: 'Lagos',
        travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 0, source: 'Instagram',
        ownerStaffId: 'st-tunde', ownerStaffName: 'Tunde', branchId: 'br-1', branchName: 'Main', stage: 'new', notes: [],
        createdAt: fourDaysAgo, updatedAt: fourDaysAgo, lastActivityAt: fourDaysAgo, activityLogs: [], // >3 days inactive!
      },
    ];

    it('filters overdue follow-ups and stale leads with no activity for 3 days', () => {
      const overdueOnly = filterLeads(leads, { overdueFollowUpOnly: true }, now);
      expect(overdueOnly).toHaveLength(1);
      expect(overdueOnly[0].id).toBe('L-Active');

      const staleOnly = filterLeads(leads, { inactiveFor3DaysOnly: true }, now);
      expect(staleOnly).toHaveLength(1);
      expect(staleOnly[0].id).toBe('L-Stale');
    });
  });

  describe('12. Objective Communication Logging (Never "Spoke To")', () => {
    const lead: LeadRecord = {
      id: 'LD-1', organizationId: 'o1', clientName: 'Client', phone: '0803', serviceType: 'flight', destination: 'D',
      travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 0, source: 'S',
      ownerStaffId: 's', ownerStaffName: 'Bisi', branchId: 'b', branchName: 'B', stage: 'new', notes: [],
      createdAt: '', updatedAt: '', lastActivityAt: '', activityLogs: [],
    };

    it('logs "Called" or "WhatsApp opened" and never claims spoken to, while offering next follow-up date', () => {
      const callAttempt = logCommunicationAttempt(lead, 'call', 'st-bisi', 'Bisi Adeyemi');
      expect(callAttempt.log.description).toBe('Called client phone number');
      expect(callAttempt.log.description).not.toContain('spoke to');
      expect(callAttempt.promptNextFollowUp).toBe(true);

      const whatsappAttempt = logCommunicationAttempt(lead, 'whatsapp', 'st-bisi', 'Bisi Adeyemi');
      expect(whatsappAttempt.log.description).toBe('WhatsApp opened with client phone');
      expect(whatsappAttempt.log.description).not.toContain('spoke to');
      expect(whatsappAttempt.promptNextFollowUp).toBe(true);
    });
  });

  describe('13. Reassign Lead & Audit Stamping', () => {
    const lead: LeadRecord = {
      id: 'LD-1', organizationId: 'o1', clientName: 'Client', phone: '0803', serviceType: 'flight', destination: 'D',
      travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 0, source: 'S',
      ownerStaffId: 'st-bisi', ownerStaffName: 'Bisi Adeyemi', branchId: 'b', branchName: 'B', stage: 'new', notes: [],
      createdAt: '', updatedAt: '', lastActivityAt: '', activityLogs: [],
    };

    it('records old owner in history and produces notification payload for new owner', () => {
      const res = reassignLead(lead, { userId: 'st-tunde', name: 'Tunde Bakare' }, 'Manager Adaeze');
      expect(res.updatedLead.ownerStaffId).toBe('st-tunde');
      expect(res.updatedLead.ownerStaffName).toBe('Tunde Bakare');
      expect(res.updatedLead.activityLogs[0].description).toContain('Reassigned from Bisi Adeyemi to Tunde Bakare');
      expect(res.notification.recipientStaffId).toBe('st-tunde');
    });
  });

  describe('14. Sources Performance Analytics', () => {
    const leads: LeadRecord[] = [
      { id: '1', organizationId: 'o', clientName: 'A', phone: '1', serviceType: 'flight', destination: 'D', travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 1_000_000_00, source: 'WhatsApp Inbound', ownerStaffId: 's', ownerStaffName: 'S', branchId: 'b', branchName: 'B', stage: 'won', notes: [], createdAt: '', updatedAt: '', lastActivityAt: '', activityLogs: [] },
      { id: '2', organizationId: 'o', clientName: 'B', phone: '2', serviceType: 'flight', destination: 'D', travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 500_000_00, source: 'WhatsApp Inbound', ownerStaffId: 's', ownerStaffName: 'S', branchId: 'b', branchName: 'B', stage: 'lost', notes: [], createdAt: '', updatedAt: '', lastActivityAt: '', activityLogs: [] },
      { id: '3', organizationId: 'o', clientName: 'C', phone: '3', serviceType: 'flight', destination: 'D', travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 800_000_00, source: 'Referral', ownerStaffId: 's', ownerStaffName: 'S', branchId: 'b', branchName: 'B', stage: 'won', notes: [], createdAt: '', updatedAt: '', lastActivityAt: '', activityLogs: [] },
    ];

    it('computes volume, conversions, conversion rate, and revenue per source', () => {
      const metrics = aggregateSourcesPerformance(leads);
      const wa = metrics.find((m) => m.source === 'WhatsApp Inbound');
      expect(wa?.totalLeads).toBe(2);
      expect(wa?.conversions).toBe(1);
      expect(wa?.conversionRatePercent).toBe(50);
      expect(wa?.totalSalesValueKobo).toBe(1_000_000_00);

      const ref = metrics.find((m) => m.source === 'Referral');
      expect(ref?.totalLeads).toBe(1);
      expect(ref?.conversions).toBe(1);
      expect(ref?.conversionRatePercent).toBe(100);
      expect(ref?.totalSalesValueKobo).toBe(800_000_00);
    });
  });

  describe('15. Convert to Quote with Auto-Client Creation & Two-Way Link', () => {
    const lead: LeadRecord = {
      id: 'LD-99', organizationId: 'o', clientName: 'Chief Kunle', phone: '0803 777 8888', serviceType: 'visa', destination: 'Canada',
      travelDates: { type: 'rough', dateSummary: 'Summer 2027' }, travellersCount: 4, budgetKobo: 2_500_000_00, source: 'Referral',
      ownerStaffId: 'st-bisi', ownerStaffName: 'Bisi Adeyemi', branchId: 'br-1', branchName: 'Main', stage: 'contacted', notes: [],
      createdAt: '', updatedAt: '', lastActivityAt: '', activityLogs: [],
    };

    it('carries client, destination, travellers, provisions client if new, moves lead to Quoted, and links both ways', () => {
      const res = convertLeadToQuote(lead, [], 'st-bisi', 'Bisi Adeyemi');

      expect(res.updatedLead.stage).toBe('quoted');
      expect(res.updatedLead.linkedQuoteId).toBeDefined();
      expect(res.quotePayload.destination).toBe('Canada');
      expect(res.quotePayload.travellersCount).toBe(4);
      expect(res.clientCreated?.name).toBe('Chief Kunle');
    });
  });

  describe('16. Reopen Lost Lead Privilege', () => {
    const lostLead: LeadRecord = {
      id: 'LD-88', organizationId: 'o', clientName: 'Lost Client', phone: '0801', serviceType: 'flight', destination: 'D',
      travelDates: { type: 'rough', dateSummary: '' }, travellersCount: 1, budgetKobo: 0, source: 'S',
      ownerStaffId: 's', ownerStaffName: 'S', branchId: 'b', branchName: 'B', stage: 'lost', lostReason: 'High ticket fare', notes: [],
      createdAt: '', updatedAt: '', lastActivityAt: '', activityLogs: [],
    };

    it('allows Owner or Manager to reopen lost lead, and rejects Sales Agent', () => {
      const agentTry = reopenLostLead(lostLead, 'SALES_AGENT', 'st-agent', 'Sales Officer');
      expect(agentTry.success).toBe(false);
      expect(agentTry.error).toContain('Only the business owner or branch manager');

      const ownerTry = reopenLostLead(lostLead, 'OWNER', 'st-owner', 'Owner Adaeze');
      expect(ownerTry.success).toBe(true);
      expect(ownerTry.reopenedLead?.stage).toBe('contacted');
      expect(ownerTry.reopenedLead?.lostReason).toBeUndefined();
    });
  });
});

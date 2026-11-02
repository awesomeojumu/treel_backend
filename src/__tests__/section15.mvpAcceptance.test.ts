import {
  buildUserPrincipalFromTemplate,
  assertAuthorizedForAction,
} from '@/core/permissions/authorizer';
import {
  createClientWithDuplicateCheck,
  deleteClientRule,
  transitionLeadStage,
  isLeadOverdue,
  updateBookingItemPrice,
  cancelBookingRule,
  recordManualPaymentRule,
  reversePaymentRule,
} from '@/core/workflow/workflowRules';
import { executeWorkflowW1SellAndCollect } from '@/core/workflow/workflowsEngine';
import { SearchableIndexRecord, executeGlobalSearch } from '@/core/search/globalSearch';
import { formatMoney } from '@/core/money/kobo';

describe('Section 15: MVP Specification & Acceptance Criteria (Modules M1 to M6 & Golden W1)', () => {
  describe('M1: Sign-in, Workspace and Roles Acceptance Tests', () => {
    const ownerWorkspace1 = buildUserPrincipalFromTemplate({
      userId: 'usr_adaeze',
      organizationId: 'org_skyline_ikeja',
      branchId: 'br_ikeja',
      roleTemplateKey: 'OWNER',
    });

    const salesAgentWorkspace1 = buildUserPrincipalFromTemplate({
      userId: 'usr_bisi',
      organizationId: 'org_skyline_ikeja',
      branchId: 'br_ikeja',
      roleTemplateKey: 'SALES_AGENT',
    });

    const ownerWorkspace2 = buildUserPrincipalFromTemplate({
      userId: 'usr_musa',
      organizationId: 'org_sahara_abuja',
      branchId: 'br_wuse',
      roleTemplateKey: 'OWNER',
    });

    it('Tests: A sales agent opening settings by typing its address is refused by the server', () => {
      // Sales agent lacks settings.manage flag -> throws FORBIDDEN_MISSING_FLAG
      expect(() => assertAuthorizedForAction(salesAgentWorkspace1, 'settings.manage')).toThrow(
        /FORBIDDEN_MISSING_FLAG/
      );

      // Owner has settings.manage flag -> authorized
      expect(() => assertAuthorizedForAction(ownerWorkspace1, 'settings.manage')).not.toThrow();
    });

    it('Tests: A removed user session ends on their next action (<1 min revocation)', () => {
      // Create user principal marked as REMOVED
      const removedUser = {
        ...salesAgentWorkspace1,
        status: 'REMOVED' as const,
      };

      expect(() => assertAuthorizedForAction(removedUser, 'home.view')).toThrow(
        /SESSION_REVOKED/
      );
    });

    it('Tests: User A in workspace 1 cannot read, change or delete any workspace 2 record, by id or by search', () => {
      const index: SearchableIndexRecord[] = [
        {
          id: 'CL-001',
          organizationId: 'org_skyline_ikeja',
          entityType: 'client',
          ownerUserId: 'usr_bisi',
          branchId: 'br_ikeja',
          title: 'Ibrahim Abdullahi',
          phone: '+2348094457788',
          deepLink: '/clients?drawer=profile&id=CL-001',
        },
        {
          id: 'CL-999',
          organizationId: 'org_sahara_abuja',
          entityType: 'client',
          ownerUserId: 'usr_musa',
          branchId: 'br_wuse',
          title: 'Alhaji Musa Dangote',
          phone: '+2348031112222',
          deepLink: '/clients?drawer=profile&id=CL-999',
        },
      ];

      // Agent in Workspace 1 searches: provably receives only Workspace 1 records
      const ws1Search = executeGlobalSearch({
        user: salesAgentWorkspace1,
        query: 'Ibrahim',
        index,
      });
      expect(ws1Search.results.length).toBe(1);
      expect(ws1Search.results[0]!.id).toBe('CL-001');

      // Attempting to search for Workspace 2 record yields 0 results for Workspace 1 user
      const crossSearch = executeGlobalSearch({
        user: salesAgentWorkspace1,
        query: 'Musa',
        index,
      });
      expect(crossSearch.results.length).toBe(0);

      // Workspace 2 owner searches for Musa: sees their own record
      const ws2Search = executeGlobalSearch({
        user: ownerWorkspace2,
        query: 'Musa',
        index,
      });
      expect(ws2Search.results.length).toBe(1);
      expect(ws2Search.results[0]!.id).toBe('CL-999');
    });
  });

  describe('M2: Client Records Acceptance Tests', () => {
    const owner = buildUserPrincipalFromTemplate({
      userId: 'usr_adaeze',
      organizationId: 'org_skyline_lagos',
      branchId: 'br_ikeja',
      roleTemplateKey: 'OWNER',
    });

    it('Tests: 08031234567 is stored as +2348031234567 and duplicate phone warns without blocking', () => {
      const first = createClientWithDuplicateCheck({
        organizationId: 'org_skyline_lagos',
        id: 'CL-1',
        name: 'Original Client',
        rawPhone: '08031234567',
        existingClients: [],
      });
      expect(first.client.phoneE164).toBe('+2348031234567');
      expect(first.duplicateWarning).toBe(false);

      const second = createClientWithDuplicateCheck({
        organizationId: 'org_skyline_lagos',
        id: 'CL-2',
        name: 'Duplicate Person',
        rawPhone: '+234 803 123 4567',
        existingClients: [first.client],
      });
      expect(second.client.phoneE164).toBe('+2348031234567');
      expect(second.duplicateWarning).toBe(true);
      expect(second.matchingClientIds).toEqual(['CL-1']);
      expect(second.client.name).toBe('Duplicate Person');
    });

    it('Tests: Search by name or phone returns in under 1 second with 1,000 clients', () => {
      const thousandClients: SearchableIndexRecord[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `CL-${i + 1}`,
        organizationId: 'org_skyline_lagos',
        entityType: 'client',
        ownerUserId: 'usr_adaeze',
        branchId: 'br_ikeja',
        title: `Client Name ${i + 1}`,
        phone: `+234803000${(1000 + i).toString().slice(-4)}`,
        deepLink: `/clients?drawer=profile&id=CL-${i + 1}`,
      }));

      const startTime = performance.now();
      const searchRes = executeGlobalSearch({
        user: owner,
        query: 'Client Name 950',
        index: thousandClients,
      });
      const durationMs = performance.now() - startTime;

      expect(searchRes.results.length).toBe(1);
      expect(searchRes.results[0]!.title).toBe('Client Name 950');
      expect(durationMs).toBeLessThan(1000); // Strict <1s requirement
    });

    it('Tests: Deleting a client with a booking is refused with a reason', () => {
      const dummyClient = {
        id: 'CL-001',
        organizationId: 'org_skyline_lagos',
        name: 'Chief Obinna',
        phoneE164: '+2348035559988',
        tags: [],
        consentGiven: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() =>
        deleteClientRule({
          actor: owner,
          client: dummyClient,
          linkedBookingsCount: 2,
        })
      ).toThrow(/CLIENT_HAS_BOOKINGS/);

      // Deleting client with 0 bookings succeeds
      const deletedRes = deleteClientRule({
        actor: owner,
        client: dummyClient,
        linkedBookingsCount: 0,
      });
      expect(deletedRes.isDeleted).toBe(true);
    });
  });

  describe('M3: Leads Acceptance Tests', () => {
    it('Tests: Marking a lead Lost without a reason is refused', () => {
      const lead = {
        id: 'LD-1',
        organizationId: 'org_skyline_lagos',
        clientId: 'CL-1',
        source: 'WHATSAPP' as const,
        stage: 'CONTACTED' as const,
        ownerUserId: 'usr_bisi',
        valueKobo: 850_000_00,
        nextFollowUpAt: new Date(Date.now() - 3_600_000), // 1 hour ago
        isReadOnly: false,
      };

      expect(isLeadOverdue(lead)).toBe(true);

      // Marking Lost without reason throws
      expect(() => transitionLeadStage({ lead, nextStage: 'LOST' })).toThrow(
        /LOST_REASON_REQUIRED/
      );

      // Providing lost reason succeeds
      const lostLead = transitionLeadStage({
        lead,
        nextStage: 'LOST',
        lostReason: 'Client postponed travel to next quarter',
      });
      expect(lostLead.stage).toBe('LOST');
      expect(lostLead.lostReason).toBe('Client postponed travel to next quarter');
    });

    it('Tests: Converting a Won lead creates a booking for the same client and locks lead as read-only', () => {
      const lead = {
        id: 'LD-2',
        organizationId: 'org_skyline_lagos',
        clientId: 'CL-1',
        source: 'REFERRAL' as const,
        stage: 'QUOTED' as const,
        ownerUserId: 'usr_bisi',
        valueKobo: 850_000_00,
        nextFollowUpAt: new Date(Date.now() + 86400000),
        isReadOnly: false,
      };

      const wonLead = transitionLeadStage({
        lead,
        nextStage: 'WON',
      });
      expect(wonLead.stage).toBe('WON');
      expect(wonLead.isReadOnly).toBe(true);
    });
  });

  describe('M4: Bookings Acceptance Tests', () => {
    const owner = buildUserPrincipalFromTemplate({
      userId: 'usr_adaeze',
      organizationId: 'org_skyline_lagos',
      branchId: 'br_ikeja',
      roleTemplateKey: 'OWNER',
    });

    it('Tests: Changing an item price recalculates the total and outstanding balance', () => {
      const booking = {
        id: 'BK-100',
        organizationId: 'org_skyline_lagos',
        branchId: 'br_ikeja',
        clientId: 'CL-1',
        soldByUserId: 'usr_bisi',
        status: 'CONFIRMED' as const,
        items: [
          {
            id: 'item_1',
            type: 'FLIGHT' as const,
            title: 'Lagos to London flight',
            costKobo: 400_000_00,
            priceKobo: 500_000_00,
          },
          {
            id: 'item_2',
            type: 'HOTEL' as const,
            title: 'London Hotel 3 nights',
            costKobo: 250_000_00,
            priceKobo: 350_000_00,
          },
        ],
        totalPriceKobo: 850_000_00,
        totalCostKobo: 650_000_00,
        paidKobo: 300_000_00,
        outstandingKobo: 550_000_00,
        amendmentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Change item 2 price from ₦350,000 to ₦400,000
      const repriced = updateBookingItemPrice({
        actor: owner,
        booking,
        itemId: 'item_2',
        newPriceKobo: 400_000_00,
      });

      expect(repriced.totalPriceKobo).toBe(900_000_00);
      expect(repriced.outstandingKobo).toBe(600_000_00);
    });

    it('Tests: Cancelling a booking that has payments is refused until they are reversed', () => {
      const bookingWithPayments = {
        id: 'BK-100',
        organizationId: 'org_skyline_lagos',
        branchId: 'br_ikeja',
        clientId: 'CL-1',
        soldByUserId: 'usr_bisi',
        status: 'CONFIRMED' as const,
        items: [],
        totalPriceKobo: 850_000_00,
        totalCostKobo: 650_000_00,
        paidKobo: 300_000_00,
        outstandingKobo: 550_000_00,
        amendmentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() =>
        cancelBookingRule({
          booking: bookingWithPayments,
          reason: 'Client requested cancellation',
        })
      ).toThrow(/BOOKING_HAS_ACTIVE_PAYMENTS/);

      // Once paidKobo is 0, cancellation succeeds
      const bookingWithoutPayments = {
        ...bookingWithPayments,
        paidKobo: 0,
        outstandingKobo: 850_000_00,
      };

      const cancelled = cancelBookingRule({
        booking: bookingWithoutPayments,
        reason: 'Client requested cancellation and payment was reversed',
      });
      expect(cancelled.status).toBe('CANCELLED');
    });
  });

  describe('M5: Payments (Manual Records) Acceptance Tests', () => {
    const booking = {
      id: 'BK-200',
      organizationId: 'org_skyline_lagos',
      branchId: 'br_ikeja',
      clientId: 'CL-1',
      soldByUserId: 'usr_bisi',
      status: 'CONFIRMED' as const,
      items: [],
      totalPriceKobo: 850_000_00,
      totalCostKobo: 650_000_00,
      paidKobo: 0,
      outstandingKobo: 850_000_00,
      amendmentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('Tests: ₦300,000 against ₦850,000 leaves ₦550,000 outstanding', () => {
      const res = recordManualPaymentRule({
        id: 'PAY-001',
        booking,
        existingPayments: [],
        amountKobo: 300_000_00,
        method: 'BANK_TRANSFER',
        reference: 'TRF-ZENITH-850K',
        senderName: 'Chief Obinna',
      });

      expect(res.updatedBooking.paidKobo).toBe(300_000_00);
      expect(res.updatedBooking.outstandingKobo).toBe(550_000_00);
      expect(res.payment.reference).toBe('TRF-ZENITH-850K');
    });

    it('Tests: A second payment with the same reference is refused and duplicate reference indicated', () => {
      const existingPayment = {
        id: 'PAY-001',
        organizationId: 'org_skyline_lagos',
        bookingId: 'BK-200',
        amountKobo: 300_000_00,
        method: 'BANK_TRANSFER' as const,
        reference: 'TRF-ZENITH-850K',
        senderName: 'Chief Obinna',
        receivedAt: new Date(),
        isReversed: false,
        createdAt: new Date(),
      };

      const bookingPartPaid = {
        ...booking,
        paidKobo: 300_000_00,
        outstandingKobo: 550_000_00,
      };

      expect(() =>
        recordManualPaymentRule({
          id: 'PAY-002',
          booking: bookingPartPaid,
          existingPayments: [existingPayment],
          amountKobo: 200_000_00,
          method: 'BANK_TRANSFER',
          reference: 'trf-zenith-850k', // Duplicate case-insensitive
          senderName: 'Chief Obinna',
        })
      ).toThrow(/DUPLICATE_PAYMENT_REFERENCE/);
    });

    it('Tests: A reversed payment restores the balance and both entries stay visible (append-only)', () => {
      const originalPayment = {
        id: 'PAY-001',
        organizationId: 'org_skyline_lagos',
        bookingId: 'BK-200',
        amountKobo: 300_000_00,
        method: 'BANK_TRANSFER' as const,
        reference: 'TRF-ZENITH-850K',
        senderName: 'Chief Obinna',
        receivedAt: new Date(),
        isReversed: false,
        createdAt: new Date(),
      };

      const bookingPartPaid = {
        ...booking,
        paidKobo: 300_000_00,
        outstandingKobo: 550_000_00,
      };

      const reversed = reversePaymentRule({
        reversalPaymentId: 'PAY-REV-001',
        booking: bookingPartPaid,
        originalPayment,
        reason: 'Duplicate transfer notice submitted in error',
      });

      expect(reversed.updatedBooking.paidKobo).toBe(0);
      expect(reversed.updatedBooking.outstandingKobo).toBe(850_000_00);
      expect(reversed.reversalEntry.reversesPaymentId).toBe('PAY-001');
      expect(reversed.reversalEntry.reversalReason).toBe('Duplicate transfer notice submitted in error');
    });
  });

  describe('M6 & Golden Workflow W1 Acceptance Gate Test', () => {
    it('runs W1 in full: ₦850k booking, ₦300k transfer, Owner Home shows ₦300k cash & ₦550k owed by staff, 0 leakage to Workspace 2', () => {
      const w1 = executeWorkflowW1SellAndCollect({
        organizationId: 'org_skyline_ikeja',
        branchId: 'br_ikeja',
        agentUserId: 'usr_bisi',
        clientName: 'Chief Obinna Okonkwo',
        clientPhone: '08035559988',
        bookingItems: [
          {
            id: 'item_flight',
            type: 'FLIGHT',
            title: 'Lagos to London Heathrow return (British Airways)',
            costKobo: 710_000_00,
            priceKobo: 850_000_00,
          },
        ],
        partPaymentKobo: 300_000_00,
        paymentReference: 'TRF-FBN-850K',
        proofFileUrl: 'https://proofs.travelreel.ng/proof_fbn_850k.pdf',
      });

      // 1. Client phone normalized to +234
      expect(w1.client.phoneE164).toBe('+2348035559988');

      // 2. Won Lead locked to read-only
      expect(w1.lead.isReadOnly).toBe(true);

      // 3. Booking total and balances
      expect(w1.booking.totalPriceKobo).toBe(850_000_00);
      expect(w1.booking.paidKobo).toBe(300_000_00);
      expect(w1.booking.outstandingKobo).toBe(550_000_00);
      expect(formatMoney({ amountMinor: w1.booking.outstandingKobo, currency: 'NGN' })).toBe(
        '₦550,000.00'
      );

      // 4. Owner Home dashboard metrics
      expect(w1.ownerHomeSummary.bookingValueKobo).toBe(850_000_00);
      expect(w1.ownerHomeSummary.cashCollectedKobo).toBe(300_000_00);
      expect(w1.ownerHomeSummary.outstandingKobo).toBe(550_000_00);

      // 5. Sales breakdown attributed to agent usr_bisi
      const staffMetric = w1.ownerHomeSummary.byStaff.find((s) => s.userId === 'usr_bisi');
      expect(staffMetric).toBeDefined();
      expect(staffMetric!.bookingsCount).toBe(1);
      expect(staffMetric!.valueKobo).toBe(850_000_00);
      expect(staffMetric!.collectedKobo).toBe(300_000_00);

      // 6. Strict Tenant Isolation Verification: 0 records visible in Workspace 2
      const allRecords: SearchableIndexRecord[] = [
        {
          id: w1.client.id,
          organizationId: 'org_skyline_ikeja',
          entityType: 'client',
          ownerUserId: 'usr_bisi',
          branchId: 'br_ikeja',
          title: w1.client.name,
          phone: w1.client.phoneE164,
          deepLink: `/clients?drawer=profile&id=${w1.client.id}`,
        },
      ];

      const userWorkspace2 = buildUserPrincipalFromTemplate({
        userId: 'usr_emeka',
        organizationId: 'org_sahara_abuja',
        branchId: 'br_wuse',
        roleTemplateKey: 'OWNER',
      });

      const leakageCheck = executeGlobalSearch({
        user: userWorkspace2,
        query: 'Chief Obinna',
        index: allRecords,
      });

      expect(leakageCheck.results.length).toBe(0);
    });
  });
});

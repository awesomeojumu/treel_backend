import { buildUserPrincipalFromTemplate } from '@/core/permissions/authorizer';
import { IdempotentOperationLedger } from '@/core/offline/operationQueue';
import {
  acceptQuoteRule,
  cancelBookingRule,
  createClientWithDuplicateCheck,
  createOrVersionQuote,
  deleteClientRule,
  getVisaDeadlineEscalationLevel,
  isLeadOverdue,
  promoteFromGroupWaitlist,
  recordManualPaymentRule,
  reversePaymentRule,
  transitionLeadStage,
  transitionTicketStatus,
  updateBookingItemPrice,
} from '@/core/workflow/workflowRules';
import {
  executeWorkflowW1SellAndCollect,
  executeWorkflowW2QuoteToReceipt,
  executeWorkflowW4OfflineSaleSync,
  executeWorkflowW5SpendingControl,
  executeWorkflowW6TicketMoneyTruth,
  executeWorkflowW7GroupDeparture,
} from '@/core/workflow/workflowsEngine';

describe('Section 3: Business Workflows (W1 to W7) and Domain Workflow Rules', () => {
  describe('W1: Sell and collect (MVP Gate P0, 30 Nov 2026)', () => {
    it('runs W1 end-to-end: ₦850,000 booking, ₦300,000 transfer with proof, ₦550,000 outstanding, attributed to agent', () => {
      const w1 = executeWorkflowW1SellAndCollect({
        organizationId: 'org_skyline_lagos',
        branchId: 'br_ikeja',
        agentUserId: 'usr_bisi',
        clientName: 'Ibrahim Abdullahi',
        clientPhone: '08094457788',
        bookingItems: [
          {
            id: 'item_1',
            type: 'FLIGHT',
            title: 'Kigali conference flight and hotel',
            costKobo: 720_000_00,
            priceKobo: 850_000_00,
          },
        ],
        partPaymentKobo: 300_000_00,
        paymentReference: 'TRF-ZENITH-300K',
        proofFileUrl: 's3://org_skyline_lagos/proofs/zenith_300k.jpg',
      });

      expect(w1.client.phoneE164).toBe('+2348094457788');
      expect(w1.lead.isReadOnly).toBe(true);
      expect(w1.ownerHomeSummary.bookingValueKobo).toBe(850_000_00);
      expect(w1.ownerHomeSummary.cashCollectedKobo).toBe(300_000_00);
      expect(w1.ownerHomeSummary.outstandingKobo).toBe(550_000_00);
      expect(w1.ownerHomeSummary.byStaff[0]?.userId).toBe('usr_bisi');
    });
  });

  describe('W2: Quote to receipt (Gate P1, 28 Feb 2027) & Quote Rules', () => {
    it('versions quotes, shares to WhatsApp, converts accepted quote to booking, and enforces discount approval limits', () => {
      const w2 = executeWorkflowW2QuoteToReceipt({
        organizationId: 'org_skyline_lagos',
        branchId: 'br_ikeja',
        agentUserId: 'usr_halima',
        clientId: 'CL-101',
        leadId: 'LD-101',
        v1SubtotalKobo: 2_500_000_00,
        v2SubtotalKobo: 2_500_000_00,
        v2DiscountKobo: 50_000_00, // 2% discount (within 5% limit)
        supplierCostKobo: 1_860_000_00,
        paymentReference: 'TRF-GTB-2450K',
      });

      expect(w2.quoteV1.version).toBe(1);
      expect(w2.quoteV2Accepted.version).toBe(2);
      expect(w2.quoteV2Accepted.totalKobo).toBe(2_450_000_00);
      expect(w2.whatsappShareUrl).toContain('wa.me');
      expect(w2.booking.paidKobo).toBe(2_450_000_00);
      expect(w2.booking.outstandingKobo).toBe(0);

      // Discount above 5% limit requires approval before acceptance
      const highDiscountQuote = createOrVersionQuote({
        quoteId: 'qt_high_disc',
        organizationId: 'org_skyline_lagos',
        leadId: 'LD-102',
        subtotalKobo: 1_000_000_00,
        discountKobo: 150_000_00, // 15% discount > 5% maxUnapprovedDiscountBps
        maxUnapprovedDiscountBps: 500,
        validUntil: new Date(Date.now() + 86_400_000),
      });

      expect(highDiscountQuote.status).toBe('PENDING_DISCOUNT_APPROVAL');
      expect(() => acceptQuoteRule(highDiscountQuote)).toThrow(/QUOTE_NEEDS_APPROVAL/);
    });
  });

  describe('W4: Offline sale (Gate P1) — Idempotent Replay on Reconnect', () => {
    it('syncs offline lead and payment exactly once even when reconnect retries', async () => {
      const ledger = new IdempotentOperationLedger();
      const ctx = {
        organizationId: 'org_skyline_lagos',
        userId: 'usr_bisi',
        deviceId: 'android_low_end_1',
        permissions: new Set(['leads.create', 'payments.record']),
      };

      const res = await executeWorkflowW4OfflineSaleSync({
        ctx,
        ledger,
        leadOperationId: 'op_w4_lead_01',
        paymentOperationId: 'op_w4_pay_01',
        leadValueKobo: 850_000_00,
        paymentAmountKobo: 300_000_00,
      });

      expect(res.leadSyncedCount).toBe(1);
      expect(res.paymentSyncedCount).toBe(1);
      expect(res.leadReplayedOnRetry).toBe(true);
      expect(res.paymentReplayedOnRetry).toBe(true);
    });
  });

  describe('W5: Spending control (Gate P2, 20 Jun 2027)', () => {
    it('approves imprest within limit, disburses cash, and retires with balanced receipts + unspent cash', () => {
      const opsManager = buildUserPrincipalFromTemplate({
        userId: 'usr_tunde',
        organizationId: 'org_skyline_lagos',
        branchId: 'br_ikeja',
        roleTemplateKey: 'OPERATIONS_MANAGER', // ₦250,000 limit
      });

      const retired = executeWorkflowW5SpendingControl({
        organizationId: 'org_skyline_lagos',
        requesterUserId: 'usr_musa',
        approver: opsManager,
        amountKobo: 120_000_00, // ₦120,000
        purpose: 'Embassy courier and VFS logistics',
        receiptTotalKobo: 105_000_00,
        unspentReturnedKobo: 15_000_00,
      });

      expect(retired.stage).toBe('RETIRED');
      expect(retired.approvedByUserId).toBe('usr_tunde');
    });
  });

  describe('W6: Money truth on a ticket (Gate P2)', () => {
    it('computes profit in Naira at stored USD rate and records FX loss when supplier is paid at a higher rate', () => {
      const w6 = executeWorkflowW6TicketMoneyTruth({
        organizationId: 'org_skyline_lagos',
        branchId: 'br_ikeja',
        soldByUserId: 'usr_halima',
        ticketCostUsdCents: 124_000, // $1,240.00
        bookedExchangeRateNgnPerUsd: 1_500, // ₦1,860,000.00 stored cost
        settledExchangeRateNgnPerUsd: 1_550, // ₦1,922,000.00 paid cost
        clientPriceKobo: 2_450_000_00, // ₦2,450,000.00 client price
      });

      expect(w6.storedSupplierCostKobo).toBe(1_860_000_00);
      expect(w6.bookingProfitAtStoredRateKobo).toBe(590_000_00);
      expect(w6.fxGainOrLossKobo).toBe(-62_000_00); // ₦62,000.00 FX loss
      expect(w6.netProfitAfterFxKobo).toBe(528_000_00);
    });
  });

  describe('W7: Group departure (Gate P3, 29 Aug 2027)', () => {
    it('allocates seats up to capacity, waitlists overflow, checks in confirmed travellers, and computes departure profit', () => {
      const w7 = executeWorkflowW7GroupDeparture({
        organizationId: 'org_skyline_lagos',
        title: 'Umrah group mini-cohort',
        capacitySeats: 2,
        pricePerSeatKobo: 3_000_000_00,
        totalSupplierCostKobo: 4_500_000_00,
        travellers: [
          { id: 'tr_1', name: 'Pilgrim 1', fullPaymentKobo: 3_000_000_00 },
          { id: 'tr_2', name: 'Pilgrim 2', fullPaymentKobo: 3_000_000_00 },
          { id: 'tr_3', name: 'Pilgrim 3 (Overflow)', fullPaymentKobo: 3_000_000_00 },
        ],
      });

      expect(w7.checkedInCount).toBe(2);
      expect(w7.waitlistedCount).toBe(1);
      expect(w7.totalRevenueKobo).toBe(6_000_000_00);
      expect(w7.departureProfitKobo).toBe(1_500_000_00);

      // Free a seat and promote Pilgrim 3 from waitlist
      w7.departure.confirmedTravellers.pop();
      const promoted = promoteFromGroupWaitlist(w7.departure);
      expect(promoted.confirmedTravellers).toHaveLength(2);
      expect(promoted.waitlistTravellers).toHaveLength(0);
    });
  });

  describe('Domain Workflow Rules: Clients, Leads, Bookings, Payments, Tickets & Visas', () => {
    const owner = buildUserPrincipalFromTemplate({
      userId: 'usr_adaeze',
      organizationId: 'org_skyline_lagos',
      branchId: 'br_ikeja',
      roleTemplateKey: 'OWNER',
    });

    it('warns (does not block) on duplicate client phone and refuses deleting a client with bookings (M2)', () => {
      const first = createClientWithDuplicateCheck({
        organizationId: 'org_skyline_lagos',
        id: 'CL-1',
        name: 'Ngozi Nwosu',
        rawPhone: '08031234567',
        existingClients: [],
      });
      expect(first.duplicateWarning).toBe(false);

      const second = createClientWithDuplicateCheck({
        organizationId: 'org_skyline_lagos',
        id: 'CL-2',
        name: 'Ngozi Nwosu (Duplicate)',
        rawPhone: '+234 803 123 4567',
        existingClients: [first.client],
      });
      expect(second.duplicateWarning).toBe(true);
      expect(second.matchingClientIds).toEqual(['CL-1']);

      // Deleting a client with bookings is refused with a reason
      expect(() =>
        deleteClientRule({
          actor: owner,
          client: first.client,
          linkedBookingsCount: 2,
        })
      ).toThrow(/CLIENT_HAS_BOOKINGS/);
    });

    it('refuses marking a lead Lost without a reason and marks past follow-ups overdue (M3)', () => {
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
      expect(() => transitionLeadStage({ lead, nextStage: 'LOST' })).toThrow(
        /LOST_REASON_REQUIRED/
      );
      const lostLead = transitionLeadStage({
        lead,
        nextStage: 'LOST',
        lostReason: 'Client postponed travel to next quarter',
      });
      expect(lostLead.stage).toBe('LOST');
    });

    it('enforces M4 & M5 booking and payment rules: item price recalculation, overpayment refusal, duplicate reference refusal, and payment reversal before cancellation', () => {
      const w1 = executeWorkflowW1SellAndCollect({
        organizationId: 'org_skyline_lagos',
        branchId: 'br_ikeja',
        agentUserId: 'usr_bisi',
        clientName: 'Ibrahim Abdullahi',
        clientPhone: '08094457788',
        bookingItems: [
          {
            id: 'item_1',
            type: 'FLIGHT',
            title: 'Kigali flight',
            costKobo: 720_000_00,
            priceKobo: 850_000_00,
          },
        ],
        partPaymentKobo: 300_000_00,
        paymentReference: 'TRF-ZENITH-300K',
        proofFileUrl: 's3://proof.jpg',
      });

      // M4 test: Changing an item price recalculates the total and the outstanding balance
      const repriced = updateBookingItemPrice({
        actor: owner,
        booking: w1.booking,
        itemId: 'item_1',
        newPriceKobo: 900_000_00,
      });
      expect(repriced.totalPriceKobo).toBe(900_000_00);
      expect(repriced.outstandingKobo).toBe(600_000_00);

      // M5 test: Duplicate payment reference on the same booking is refused
      expect(() =>
        recordManualPaymentRule({
          id: 'pay_dup',
          booking: repriced,
          existingPayments: [w1.payment],
          amountKobo: 100_000_00,
          method: 'BANK_TRANSFER',
          reference: 'trf-zenith-300k',
          senderName: 'Ibrahim Abdullahi',
        })
      ).toThrow(/DUPLICATE_PAYMENT_REFERENCE/);

      // M5 test: Overpayment above the balance is refused
      expect(() =>
        recordManualPaymentRule({
          id: 'pay_over',
          booking: repriced,
          existingPayments: [w1.payment],
          amountKobo: 700_000_00,
          method: 'BANK_TRANSFER',
          reference: 'TRF-NEW-999',
          senderName: 'Ibrahim Abdullahi',
        })
      ).toThrow(/OVERPAYMENT_REFUSED/);

      // M4 test: Cancelling a booking that has payments is refused until they are reversed
      expect(() =>
        cancelBookingRule({
          booking: repriced,
          reason: 'Client cancelled trip',
        })
      ).toThrow(/BOOKING_HAS_ACTIVE_PAYMENTS/);

      // M5 test: Reversed payment restores the balance and both entries stay visible
      const reversed = reversePaymentRule({
        reversalPaymentId: 'pay_rev_1',
        booking: repriced,
        originalPayment: w1.payment,
        reason: 'Reversed to process full booking cancellation',
      });
      expect(reversed.updatedBooking.paidKobo).toBe(0);
      expect(reversed.updatedBooking.outstandingKobo).toBe(900_000_00);
      expect(reversed.reversalEntry.reversesPaymentId).toBe(w1.payment.id);

      // Now booking can be cancelled
      const cancelled = cancelBookingRule({
        booking: reversed.updatedBooking,
        reason: 'Client cancelled trip',
      });
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('enforces ticket terminal states and visa deadline escalation levels', () => {
      const ticket = {
        id: 'tkt_1',
        organizationId: 'org_skyline_lagos',
        bookingId: 'BK-2026-014',
        pnr: 'ABC123',
        passengerName: 'Ngozi Nwosu',
        status: 'ISSUED' as const,
      };

      expect(() => transitionTicketStatus({ ticket, nextStatus: 'VOIDED' })).toThrow(
        /TICKET_REASON_REQUIRED/
      );

      const voided = transitionTicketStatus({
        ticket,
        nextStatus: 'VOIDED',
        reason: 'Same-day void requested due to spelling correction',
      });
      expect(voided.status).toBe('VOIDED');
      expect(() => transitionTicketStatus({ ticket: voided, nextStatus: 'REISSUED' })).toThrow(
        /TICKET_FINAL_STATE/
      );

      const visaDueIn2Days = {
        id: 'vs_1',
        organizationId: 'org_skyline_lagos',
        clientId: 'CL-103',
        destinationCountry: 'United Kingdom',
        stage: 'CHECKLIST' as const,
        submissionDeadline: new Date(Date.now() + 2 * 86_400_000),
        attemptNumber: 1,
      };
      expect(getVisaDeadlineEscalationLevel(visaDueIn2Days)).toBe('3_DAYS');
    });
  });
});

import {
  EVENTS_PAGE_RULES,
  calculateEventProfit,
  validateGuestQrScan,
  checkRosterLeaveClashes,
  evaluateRunSheetLateTasks,
  evaluateOverbudgetExpenses,
  cancelOrPostponeImpactAudit,
  EventRecord,
  EventGuest,
  EventVendor,
  RosterItem,
  RunSheetItem,
  EventExpenseItem,
} from '../core/events/eventsPageRules';

describe('Events Operations Specification Rules Engine', () => {
  describe('Rule 1 & 2: Rules Registry & Workspace Tabs', () => {
    it('declares 11 compliant specification rules', () => {
      expect(EVENTS_PAGE_RULES).toHaveLength(11);
      EVENTS_PAGE_RULES.forEach((rule) => {
        expect(rule.isCompliant).toBe(true);
        expect(rule.id).toBeDefined();
        expect(rule.requirement).toBeDefined();
      });
    });
  });

  describe('Rule 4: QR Scan Check-In, Duplicate Rejection & Other-Event Refusal', () => {
    const guests: EventGuest[] = [
      {
        id: 'GST-01',
        eventId: 'EVT-2026-001',
        name: 'Dr. Patrick Utomi',
        email: 'patrick@utomi.com',
        phone: '+234 809 998 8776',
        rsvpStatus: 'CONFIRMED',
        plusOnesCount: 1,
        tableNumber: 'Table 4',
        qrCode: 'QR-EVT001-GST01',
        checkedIn: false,
      },
      {
        id: 'GST-02',
        eventId: 'EVT-2026-999', // Other event!
        name: 'Senator Alabi',
        email: 'alabi@senate.gov.ng',
        phone: '+234 803 111 2233',
        rsvpStatus: 'CONFIRMED',
        plusOnesCount: 0,
        qrCode: 'QR-EVT999-GST02',
        checkedIn: false,
      },
    ];

    it('marks in a valid guest scan on first attempt', () => {
      const res = validateGuestQrScan(guests, 'QR-EVT001-GST01', 'EVT-2026-001', 'Chinedu Eze', '2026-11-15T09:15:00Z');
      expect(res.success).toBe(true);
      expect(res.guest?.checkedIn).toBe(true);
      expect(res.guest?.checkedInByStaff).toBe('Chinedu Eze');
    });

    it('refuses duplicate scan with original timestamp shown', () => {
      const alreadyCheckedInGuests: EventGuest[] = [
        {
          ...guests[0],
          checkedIn: true,
          checkedInAt: '2026-11-15T09:15:00Z',
          checkedInByStaff: 'Chinedu Eze',
        },
      ];

      const res = validateGuestQrScan(alreadyCheckedInGuests, 'QR-EVT001-GST01', 'EVT-2026-001', 'Bisi Adeyemi');
      expect(res.success).toBe(false);
      expect(res.isDuplicate).toBe(true);
      expect(res.error).toContain('Duplicate check-in refused');
      expect(res.firstCheckInTime).toBe('2026-11-15T09:15:00Z');
    });

    it('refuses QR codes belonging to a different event', () => {
      const res = validateGuestQrScan(guests, 'QR-EVT999-GST02', 'EVT-2026-001');
      expect(res.success).toBe(false);
      expect(res.error).toContain('belongs to a different event');
    });

    it('refuses unrecognized or invalid QR codes', () => {
      const res = validateGuestQrScan(guests, 'UNKNOWN-BADGE-CODE', 'EVT-2026-001');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid QR code');
    });
  });

  describe('Rule 6: Run Sheet Scheduling & Late Task Flagging', () => {
    const tasks: RunSheetItem[] = [
      {
        id: 'RS-01',
        eventId: 'EVT-2026-001',
        time: '08:00',
        title: 'Hall setup & Audio-Visual soundcheck',
        ownerStaffName: 'Chinedu Eze',
        description: 'Verify wireless mics, stage projectors, and backup generator',
        status: 'COMPLETED',
        isLate: false,
      },
      {
        id: 'RS-02',
        eventId: 'EVT-2026-001',
        time: '09:00',
        title: 'Delegate badge registration open',
        ownerStaffName: 'Bisi Adeyemi',
        description: 'QR scanners active at registration desk',
        status: 'PENDING',
        isLate: false,
      },
      {
        id: 'RS-03',
        eventId: 'EVT-2026-001',
        time: '14:00',
        title: 'Keynote Address & Lunch Service',
        ownerStaffName: 'Tunde Bakare',
        description: 'VIP lunch banquet',
        status: 'PENDING',
        isLate: false,
      },
    ];

    it('flags uncompleted tasks past scheduled time as Late', () => {
      // Event date is 2026-11-15. Current reference time is 10:00 (past 09:00, but before 14:00)
      const evaluated = evaluateRunSheetLateTasks(tasks, '2026-11-15', '2026-11-15T10:00:00Z');

      expect(evaluated[0].isLate).toBe(false); // Completed
      expect(evaluated[1].isLate).toBe(true);  // Pending at 09:00 -> Late at 10:00!
      expect(evaluated[2].isLate).toBe(false); // Scheduled for 14:00 -> Not late yet
    });
  });

  describe('Rule 7: Staff Roster Leave Clash Guard', () => {
    const roster: RosterItem[] = [
      {
        id: 'RST-01',
        eventId: 'EVT-2026-001',
        staffId: 'STF-003',
        staffName: 'Bisi Adeyemi',
        role: 'Registration Lead',
        shiftStart: '07:30',
        shiftEnd: '14:00',
        hasLeaveClash: false,
      },
      {
        id: 'RST-02',
        eventId: 'EVT-2026-001',
        staffId: 'STF-004',
        staffName: 'Musa Ibrahim',
        role: 'VIP Usher',
        shiftStart: '08:00',
        shiftEnd: '16:00',
        hasLeaveClash: false,
      },
    ];

    it('flags roster shift clash when staff is on approved leave on event date', () => {
      const leaveRecords = [
        {
          staffId: 'STF-004',
          startDate: '2026-11-14',
          endDate: '2026-11-18',
          leaveType: 'Annual Leave',
        },
      ];

      const checked = checkRosterLeaveClashes(roster, leaveRecords, '2026-11-15');
      expect(checked[0].hasLeaveClash).toBe(false);
      expect(checked[1].hasLeaveClash).toBe(true);
      expect(checked[1].leaveClashReason).toContain('Musa Ibrahim is on approved Annual Leave');
    });
  });

  describe('Rules 8 & 9: Expenses Over-Budget Highlighting & Profit Formula', () => {
    it('calculates event profit as Income less Expenses and Vendor costs', () => {
      // Income: ₦18,500,000 (1_850_000_000 kobo)
      // Expenses: ₦2,200,000 (220_000_000 kobo)
      // Vendor costs: ₦11,500,000 (1_150_000_000 kobo)
      const profit = calculateEventProfit(1_850_000_000, 220_000_000, 1_150_000_000);

      expect(profit.profitKobo).toBe(480_000_000); // ₦4,800,000 net profit
      expect(profit.marginPercent).toBe(25.9);
    });

    it('highlights overbudget expense lines', () => {
      const expenses: EventExpenseItem[] = [
        {
          id: 'EXP-01',
          eventId: 'EVT-2026-001',
          category: 'Printing & Badges',
          description: 'Lanyard badges and delegate brochures',
          budgetKobo: 400_000_00,
          actualKobo: 380_000_00, // Under budget
          isOverBudget: false,
        },
        {
          id: 'EXP-02',
          eventId: 'EVT-2026-001',
          category: 'VIP Protocol Transit',
          description: 'Airport executive shuttle van',
          budgetKobo: 500_000_00,
          actualKobo: 750_000_00, // Over budget by ₦250,000!
          isOverBudget: false,
        },
      ];

      const res = evaluateOverbudgetExpenses(expenses);
      expect(res.overbudgetCount).toBe(1);
      expect(res.totalOverspendKobo).toBe(250_000_00);
      expect(res.expenses[0].isOverBudget).toBe(false);
      expect(res.expenses[1].isOverBudget).toBe(true);
    });
  });

  describe('Rule 11: Cancellation / Postponement Impact Audit', () => {
    const event: EventRecord = {
      id: 'EVT-2026-001',
      name: 'West Africa FinTech Summit 2026',
      type: 'CONFERENCE',
      dateTime: '2026-11-15T08:00:00Z',
      endDateTime: '2026-11-15T18:00:00Z',
      venue: 'Eko Convention Centre, Lagos',
      expectedGuests: 150,
      budgetKobo: 15_000_000_00,
      ownerStaffId: 'STF-001',
      ownerStaffName: 'Adaeze Okafor',
      status: 'CONFIRMED',
      client: {
        id: 'CLT-101',
        name: 'Sterling Bank PLC',
        phone: '+234 1 448 4400',
        email: 'events@sterling.ng',
      },
      createdAt: '2026-09-01T08:00:00Z',
    };

    const guests: EventGuest[] = [
      {
        id: 'G-1',
        eventId: 'EVT-2026-001',
        name: 'Guest 1',
        email: 'g1@test.com',
        phone: '123',
        rsvpStatus: 'CONFIRMED',
        plusOnesCount: 0,
        qrCode: 'QR1',
        checkedIn: false,
      },
      {
        id: 'G-2',
        eventId: 'EVT-2026-001',
        name: 'Guest 2',
        email: 'g2@test.com',
        phone: '456',
        rsvpStatus: 'INVITED',
        plusOnesCount: 0,
        qrCode: 'QR2',
        checkedIn: false,
      },
    ];

    const vendors: EventVendor[] = [
      {
        id: 'VND-01',
        eventId: 'EVT-2026-001',
        vendorName: 'Eko Hotels & Suites',
        contactPerson: 'Mr. Jude',
        phone: '+234 1 277 2700',
        service: 'Grand Ballroom & Catering',
        quoteKobo: 8_500_000_00,
        amountPaidKobo: 5_000_000_00,
        balanceKobo: 3_500_000_00,
      },
    ];

    it('calculates affected guests and vendor liabilities before cancellation', () => {
      const audit = cancelOrPostponeImpactAudit(event, guests, vendors);

      expect(audit.affectedGuestsCount).toBe(2);
      expect(audit.confirmedGuestsCount).toBe(1);
      expect(audit.affectedVendorsCount).toBe(1);
      expect(audit.totalVendorCommittedKobo).toBe(8_500_000_00);
      expect(audit.totalVendorPaidKobo).toBe(5_000_000_00);
      expect(audit.unsettledVendorBalanceKobo).toBe(3_500_000_00);
    });
  });
});

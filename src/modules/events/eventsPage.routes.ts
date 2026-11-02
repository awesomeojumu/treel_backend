import { FastifyInstance, FastifyPluginAsync } from 'fastify';
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
  RunSheetItem,
  RosterItem,
  EventExpenseItem,
  CalendarItem,
} from '@/core/events/eventsPageRules';

// Live in-memory store for events module
let eventsStore: EventRecord[] = [
  {
    id: 'EVT-2026-001',
    name: 'West Africa FinTech Summit & Gala 2026',
    type: 'CONFERENCE',
    dateTime: '2026-11-15T08:30:00+01:00',
    endDateTime: '2026-11-15T22:00:00+01:00',
    venue: 'Grand Ballroom, Eko Hotel & Suites, Victoria Island, Lagos',
    expectedGuests: 150,
    budgetKobo: 18_500_000_00,
    ownerStaffId: 'usr_tunde',
    ownerStaffName: 'Tunde Bakare',
    status: 'CONFIRMED',
    client: {
      id: 'CLT-101',
      name: 'Sterling Bank PLC',
      phone: '+234 1 448 4400',
      email: 'corporate.events@sterling.ng',
      companyName: 'Sterling Bank PLC',
    },
    createdAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'EVT-2026-002',
    name: 'Hajj 2027 Orientation & Pilgrim Seminar',
    type: 'SEMINAR',
    dateTime: '2026-12-02T09:00:00+01:00',
    endDateTime: '2026-12-02T16:00:00+01:00',
    venue: 'Abuja International Conference Centre (AICC), Abuja',
    expectedGuests: 120,
    budgetKobo: 6_200_000_00,
    ownerStaffId: 'usr_bisi',
    ownerStaffName: 'Bisi Adeyemi',
    status: 'PLANNING',
    client: {
      id: 'CLT-102',
      name: 'National Hajj Commission Delegation',
      phone: '+234 9 290 1234',
      email: 'pilgrim.welfare@hajjcommission.gov.ng',
    },
    createdAt: '2026-09-15T08:00:00Z',
  },
];

let guestsStore: EventGuest[] = [
  {
    id: 'GST-001',
    eventId: 'EVT-2026-001',
    name: 'Dr. Patrick Utomi',
    email: 'patrick@utomi.com',
    phone: '+234 809 998 8776',
    rsvpStatus: 'CONFIRMED',
    tableNumber: 'Table 1 (VIP Front)',
    plusOnesCount: 1,
    dietaryNotes: 'Diabetic, low sodium',
    qrCode: 'QR-EVT001-GST001',
    checkedIn: true,
    checkedInAt: '2026-11-15T08:15:00+01:00',
    checkedInByStaff: 'Chinedu Eze',
  },
  {
    id: 'GST-002',
    eventId: 'EVT-2026-001',
    name: 'Folake Ogunleye',
    email: 'folake@firstbank.ng',
    phone: '+234 802 444 8899',
    rsvpStatus: 'CONFIRMED',
    tableNumber: 'Table 2',
    plusOnesCount: 0,
    dietaryNotes: 'Halal / Vegetarian',
    qrCode: 'QR-EVT001-GST002',
    checkedIn: false,
  },
  {
    id: 'GST-003',
    eventId: 'EVT-2026-001',
    name: 'Chief Raymond Adeleke',
    email: 'raymond@adeleke-holdings.com',
    phone: '+234 803 555 1234',
    rsvpStatus: 'CONFIRMED',
    tableNumber: 'Table 1 (VIP Front)',
    plusOnesCount: 1,
    dietaryNotes: 'None',
    qrCode: 'QR-EVT001-GST003',
    checkedIn: false,
  },
];

let vendorsStore: EventVendor[] = [
  {
    id: 'VND-001',
    eventId: 'EVT-2026-001',
    vendorName: 'Eko Hotels Grand Ballroom & Banquet',
    contactPerson: 'Jude Okon',
    phone: '+234 1 277 2700',
    service: 'Hall Rental, 3-Course Banquet & Drinks',
    quoteKobo: 8_500_000_00,
    amountPaidKobo: 5_000_000_00,
    balanceKobo: 3_500_000_00,
    contractFileUrl: '/contracts/eko_ballroom_agreement.pdf',
  },
  {
    id: 'VND-002',
    eventId: 'EVT-2026-001',
    vendorName: 'Megasound Audio-Visual Productions',
    contactPerson: 'Emeka Nwosu',
    phone: '+234 803 888 1212',
    service: 'LED Screen Backdrop, Line Array Audio & Stage Lighting',
    quoteKobo: 3_000_000_00,
    amountPaidKobo: 2_000_000_00,
    balanceKobo: 1_000_000_00,
    contractFileUrl: '/contracts/megasound_stage_av.pdf',
  },
];

let runSheetStore: RunSheetItem[] = [
  {
    id: 'RS-001',
    eventId: 'EVT-2026-001',
    time: '07:30',
    title: 'AV Soundcheck & Stage LED Screen Calibration',
    ownerStaffName: 'Chinedu Eze',
    description: 'Verify roving mics, translation headsets, and presenter clickers',
    status: 'COMPLETED',
    isLate: false,
  },
  {
    id: 'RS-002',
    eventId: 'EVT-2026-001',
    time: '08:30',
    title: 'Delegate Registration & QR Badge Scanning Desk',
    ownerStaffName: 'Bisi Adeyemi',
    description: 'Fast-track QR scanning for pre-registered delegates at entrance',
    status: 'IN_PROGRESS',
    isLate: false,
  },
  {
    id: 'RS-003',
    eventId: 'EVT-2026-001',
    time: '10:00',
    title: 'Opening Keynote Address: Future of Banking in West Africa',
    ownerStaffName: 'Tunde Bakare',
    description: 'Escort Keynote Speaker Dr. Patrick Utomi to dais',
    status: 'PENDING',
    isLate: false,
  },
];

let rosterStore: RosterItem[] = [
  {
    id: 'RST-001',
    eventId: 'EVT-2026-001',
    staffId: 'usr_tunde',
    staffName: 'Tunde Bakare',
    role: 'Lead Event Director & VIP Liaison',
    shiftStart: '07:00',
    shiftEnd: '22:30',
    hasLeaveClash: false,
  },
  {
    id: 'RST-002',
    eventId: 'EVT-2026-001',
    staffId: 'usr_bisi',
    staffName: 'Bisi Adeyemi',
    role: 'Head of Registration & QR Check-in',
    shiftStart: '07:30',
    shiftEnd: '17:00',
    hasLeaveClash: false,
  },
  {
    id: 'RST-003',
    eventId: 'EVT-2026-001',
    staffId: 'usr_chinedu',
    staffName: 'Chinedu Eze',
    role: 'AV Technician & Floor Coordinator',
    shiftStart: '06:30',
    shiftEnd: '22:30',
    hasLeaveClash: false,
  },
];

let expensesStore: EventExpenseItem[] = [
  {
    id: 'EXP-001',
    eventId: 'EVT-2026-001',
    category: 'Printing & Badges',
    description: 'Custom RFID delegate lanyards and conference agenda booklets',
    budgetKobo: 600_000_00,
    actualKobo: 550_000_00,
    isOverBudget: false,
    linkedFinanceTransactionId: 'PAY-2026-092',
  },
  {
    id: 'EXP-002',
    eventId: 'EVT-2026-001',
    category: 'VIP Protocol Shuttle',
    description: 'Executive Mercedes Sprinter airport transfers for keynote speakers',
    budgetKobo: 500_000_00,
    actualKobo: 720_000_00, // Overbudget by ₦220,000!
    isOverBudget: true,
    linkedFinanceTransactionId: 'PAY-2026-095',
  },
];

export const registerEventsPageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/events/rules
   */
  app.get('/api/v1/events/rules', async (_request, reply) => {
    return reply.send({
      success: true,
      rules: EVENTS_PAGE_RULES,
      count: EVENTS_PAGE_RULES.length,
    });
  });

  /**
   * GET /api/v1/events
   */
  app.get('/api/v1/events', async (_request, reply) => {
    return reply.send({
      success: true,
      events: eventsStore,
      count: eventsStore.length,
    });
  });

  /**
   * POST /api/v1/events
   */
  app.post('/api/v1/events', async (request, reply) => {
    const body = request.body as Partial<EventRecord>;

    if (!body.name || !body.venue || !body.dateTime) {
      return reply.status(400).send({
        success: false,
        error: 'Event name, venue, and date/time are required.',
      });
    }

    const newEvent: EventRecord = {
      id: `EVT-2026-${String(eventsStore.length + 1).padStart(3, '0')}`,
      name: body.name.trim(),
      type: body.type || 'CONFERENCE',
      dateTime: body.dateTime,
      endDateTime: body.endDateTime || body.dateTime,
      venue: body.venue.trim(),
      expectedGuests: body.expectedGuests || 50,
      budgetKobo: body.budgetKobo || 5_000_000_00,
      ownerStaffId: body.ownerStaffId || 'usr_tunde',
      ownerStaffName: body.ownerStaffName || 'Tunde Bakare',
      status: 'PLANNING',
      client: body.client || {
        id: 'CLT-DEFAULT',
        name: 'Corporate Client',
        phone: '+234 800 000 0000',
        email: 'client@company.com',
      },
      createdAt: new Date().toISOString(),
    };

    eventsStore.unshift(newEvent);

    return reply.status(201).send({
      success: true,
      event: newEvent,
      message: `Event "${newEvent.name}" created successfully.`,
    });
  });

  /**
   * GET /api/v1/events/:id/workspace
   */
  app.get('/api/v1/events/:id/workspace', async (request, reply) => {
    const { id } = request.params as { id: string };

    const event = eventsStore.find((e) => e.id === id);
    if (!event) {
      return reply.status(404).send({ success: false, error: 'Event not found.' });
    }

    const eventGuests = guestsStore.filter((g) => g.eventId === id);
    const eventVendors = vendorsStore.filter((v) => v.eventId === id);
    const eventRunSheet = runSheetStore.filter((r) => r.eventId === id);
    const eventRoster = rosterStore.filter((r) => r.eventId === id);
    const eventExpenses = expensesStore.filter((e) => e.eventId === id);

    // Evaluate Run Sheet late tasks
    const evaluatedRunSheet = evaluateRunSheetLateTasks(eventRunSheet, event.dateTime.split('T')[0]);

    // Check roster leave clashes
    const checkedRoster = checkRosterLeaveClashes(eventRoster, [], event.dateTime.split('T')[0]);

    // Evaluate overbudget expenses
    const evaluatedExpenses = evaluateOverbudgetExpenses(eventExpenses);

    // Calculate Profit & Margin
    const totalVendorKobo = eventVendors.reduce((sum, v) => sum + v.quoteKobo, 0);
    const totalExpensesKobo = eventExpenses.reduce((sum, e) => sum + e.actualKobo, 0);
    const profit = calculateEventProfit(event.budgetKobo, totalExpensesKobo, totalVendorKobo);

    return reply.send({
      success: true,
      event,
      tabs: {
        overview: {
          event,
          confirmedGuestsCount: eventGuests.filter((g) => g.rsvpStatus === 'CONFIRMED').length,
          checkedInCount: eventGuests.filter((g) => g.checkedIn).length,
          totalVendorsQuoteKobo: totalVendorKobo,
        },
        guests: eventGuests,
        vendors: eventVendors,
        runSheet: evaluatedRunSheet,
        roster: checkedRoster,
        expenses: evaluatedExpenses.expenses,
        profit: {
          ...profit,
          eventId: id,
        },
        checkIn: {
          checkedInGuests: eventGuests.filter((g) => g.checkedIn),
          pendingGuests: eventGuests.filter((g) => !g.checkedIn),
        },
      },
    });
  });

  /**
   * POST /api/v1/events/:id/check-in
   */
  app.post('/api/v1/events/:id/check-in', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { qrCode, staffName } = request.body as { qrCode: string; staffName?: string };

    const scanResult = validateGuestQrScan(
      guestsStore,
      qrCode,
      id,
      staffName || 'Check-in Officer',
      new Date().toISOString()
    );

    if (!scanResult.success || !scanResult.guest) {
      return reply.status(409).send({
        success: false,
        error: scanResult.error,
        isDuplicate: scanResult.isDuplicate,
        firstCheckInTime: scanResult.firstCheckInTime,
      });
    }

    // Update in-memory guest record
    const idx = guestsStore.findIndex((g) => g.id === scanResult.guest!.id);
    guestsStore[idx] = scanResult.guest;

    return reply.send({
      success: true,
      guest: scanResult.guest,
      message: `Checked in: ${scanResult.guest.name} (${scanResult.guest.tableNumber || 'General Seating'}).`,
    });
  });

  /**
   * POST /api/v1/events/:id/cancel
   */
  app.post('/api/v1/events/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { action, postponedTo, reason } = request.body as {
      action: 'CANCEL' | 'POSTPONE';
      postponedTo?: string;
      reason: string;
    };

    const event = eventsStore.find((e) => e.id === id);
    if (!event) {
      return reply.status(404).send({ success: false, error: 'Event not found.' });
    }

    const audit = cancelOrPostponeImpactAudit(event, guestsStore, vendorsStore);

    if (action === 'POSTPONE') {
      event.status = 'POSTPONED';
      event.postponedTo = postponedTo;
    } else {
      event.status = 'CANCELLED';
      event.cancellationReason = reason;
    }

    return reply.send({
      success: true,
      event,
      impactAudit: audit,
      message: `Event ${id} ${action === 'POSTPONE' ? 'postponed' : 'cancelled'}. ${audit.confirmedGuestsCount} confirmed guests and ${audit.affectedVendorsCount} vendor contracts flagged for notification.`,
    });
  });

  /**
   * GET /api/v1/events/calendar
   */
  app.get('/api/v1/events/calendar', async (_request, reply) => {
    const items: CalendarItem[] = [
      {
        id: 'EVT-2026-001',
        type: 'EVENT',
        title: 'West Africa FinTech Summit & Gala',
        date: '2026-11-15',
        time: '08:30 WAT',
        color: '#0B1E3D', // Design Token: Brand Navy
        label: 'Event: Conference',
        venueOrRoute: 'Eko Hotel & Suites, Lagos',
      },
      {
        id: 'EVT-2026-002',
        type: 'EVENT',
        title: 'Hajj 2027 Orientation Seminar',
        date: '2026-12-02',
        time: '09:00 WAT',
        color: '#0B1E3D',
        label: 'Event: Seminar',
        venueOrRoute: 'AICC Abuja',
      },
      {
        id: 'DEP-2026-UMRAH',
        type: 'DEPARTURE',
        title: 'December Umrah Platinum Group (32 Pilgrims)',
        date: '2026-12-12',
        time: '06:30 WAT',
        color: '#C9A84C', // Design Token: Gold Accent
        label: 'Group Departure: Tour',
        venueOrRoute: 'LOS -> JED (EgyptAir MS876)',
      },
      {
        id: 'DEP-2026-QATAR',
        type: 'DEPARTURE',
        title: 'Qatar Doha Luxury Experience Group (22 Pax)',
        date: '2026-11-28',
        time: '11:00 WAT',
        color: '#C9A84C',
        label: 'Group Departure: Tour',
        venueOrRoute: 'LOS -> DOH (Qatar Airways QR1408)',
      },
    ];

    return reply.send({
      success: true,
      items,
      count: items.length,
    });
  });
};

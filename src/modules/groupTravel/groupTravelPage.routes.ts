import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  GROUP_TRAVEL_PAGE_RULES,
  computePackageMargin,
  copyPackageToNew,
  validateSeatAllocation,
  evaluateSeatHoldExpiry,
  evaluateCutoffMinimums,
  validateRoomClashAndCapacity,
  registerLegCheckIn,
  validateBulkTravellerImport,
  TourPackage,
  DepartureRecord,
  GroupBookingRecord,
  RoomAssignment,
  LegCheckIn,
  TourIncident,
  DepartureProfitability,
  ActorStaff,
} from '@/core/groupTravel/groupTravelPageRules';

// Live in-memory store for Group Travel sandbox
let packagesStore: TourPackage[] = [
  {
    id: 'PKG-UMRAH-01',
    name: 'December Umrah Platinum 2026 (14 Days)',
    destination: 'Makkah & Madinah, Saudi Arabia',
    durationDays: 14,
    durationNights: 13,
    itineraryByDay: [
      { dayNumber: 1, title: 'Departure from Lagos to Jeddah', description: 'Meet and assist at MMIA airport. Flight via EgyptAir to Jeddah.', mealsIncluded: ['Dinner'] },
      { dayNumber: 2, title: 'Arrival & Umrah in Makkah', description: 'Check-in to Dar Al Iman InterContinental. Perform Umrah rituals with scholar guidance.', mealsIncluded: ['Breakfast', 'Dinner'] },
      { dayNumber: 3, title: 'Makkah Ziyarah Historical Tour', description: 'Visit Jabal al-Noor (Cave of Hira), Mount Arafat, Mina, and Muzdalifah.', mealsIncluded: ['Breakfast'] },
      { dayNumber: 7, title: 'Haramain High-Speed Train to Madinah', description: 'Executive class high-speed rail transfer to Madinah Al-Munawwarah.', mealsIncluded: ['Breakfast', 'Lunch'] },
    ],
    inclusions: [
      'Return EgyptAir flight tickets (Lagos - Cairo - Jeddah / Madinah - Cairo - Lagos)',
      '7 Nights at Dar Al Iman InterContinental Makkah (Clock Tower view)',
      '6 Nights at Anwar Al Madinah Mövenpick',
      'Electronic Saudi Umrah tourist eVisa clearance',
      'Haramain high-speed train tickets in Business Class',
      'Full ground VIP air-conditioned protocol coach transit',
      'Daily open buffet breakfast and dinner',
    ],
    exclusions: ['Personal shopping & laundry', 'Luggage overweight charges', 'Optional private Ziyarah tours'],
    hotelDetails: 'Dar Al Iman Makkah (5-star, 0m to Haram) & Anwar Al Madinah Mövenpick (5-star)',
    flightDetails: 'EgyptAir MS876 (LOS -> CAI -> JED) & MS877 (MED -> CAI -> LOS)',
    pricePerPersonByRoom: {
      singleKobo: 4_200_000_00,
      doubleKobo: 3_080_000_00,
      tripleKobo: 2_750_000_00,
      quadKobo: 2_450_000_00,
    },
    childPriceKobo: 2_100_000_00,
    infantPriceKobo: 600_000_00,
    singleSupplementKobo: 1_120_000_00,
    costPerPersonKobo: 2_562_500_00,
    depositKobo: 1_000_000_00,
    paymentSchedule: [
      { milestoneName: 'Deposit on booking reservation', percentDue: 35, dueDateDaysBeforeDeparture: 60 },
      { milestoneName: 'Second installment (Tickets & Hotel)', percentDue: 35, dueDateDaysBeforeDeparture: 30 },
      { milestoneName: 'Final balance & Visa issuance', percentDue: 30, dueDateDaysBeforeDeparture: 14 },
    ],
    seatsCapacity: 32,
    cutoffDate: '2026-11-15',
    cancellationTerms: 'Non-refundable after visa issuance; 50% refund before 30 days of travel.',
    photoUrls: ['/packages/umrah_makkah.jpg', '/packages/madinah_prophet_mosque.jpg'],
    version: 1,
    createdAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'PKG-QATAR-01',
    name: 'Qatar Doha Luxury Experience & Desert Safari (7 Days)',
    destination: 'Doha, Qatar',
    durationDays: 7,
    durationNights: 6,
    itineraryByDay: [
      { dayNumber: 1, title: 'Arrival at Hamad International Airport', description: 'VIP limousine transfer to Ritz-Carlton Doha.', mealsIncluded: ['Dinner'] },
      { dayNumber: 2, title: 'Doha City Tour & Katara Cultural Village', description: 'Guided walking tour through Souq Waqif, National Museum of Qatar, and Katara.', mealsIncluded: ['Breakfast'] },
      { dayNumber: 3, title: 'Inland Sea 4x4 Desert Safari & Camel Ride', description: 'Dune bashing at Khor Al Adaid with traditional Bedouin camp BBQ.', mealsIncluded: ['Breakfast', 'Dinner'] },
    ],
    inclusions: [
      'Return Qatar Airways Direct Flights (LOS -> DOH -> LOS)',
      '6 Nights at The Ritz-Carlton Doha (Sea View Deluxe Room)',
      'Full Day 4x4 Desert Safari with Dune Bashing & Inland Sea Visit',
      'Daily Gourmet Breakfast at Lagoon Restaurant',
      'Complimentary Qatar Tourist Visa Assist',
    ],
    exclusions: ['Travel Insurance (available as premium ancillary)', 'Personal gratuities'],
    hotelDetails: 'The Ritz-Carlton Doha (5-Star Luxury Resort)',
    flightDetails: 'Qatar Airways QR1408 (LOS -> DOH) & QR1407 (DOH -> LOS)',
    pricePerPersonByRoom: {
      singleKobo: 2_850_000_00,
      doubleKobo: 2_150_000_00,
      tripleKobo: 1_950_000_00,
      quadKobo: 1_850_000_00,
    },
    childPriceKobo: 1_450_000_00,
    infantPriceKobo: 400_000_00,
    singleSupplementKobo: 700_000_00,
    costPerPersonKobo: 1_720_000_00,
    depositKobo: 800_000_00,
    paymentSchedule: [
      { milestoneName: 'Initial booking deposit', percentDue: 40, dueDateDaysBeforeDeparture: 45 },
      { milestoneName: 'Balance clearance', percentDue: 60, dueDateDaysBeforeDeparture: 14 },
    ],
    seatsCapacity: 24,
    cutoffDate: '2026-11-20',
    cancellationTerms: '70% refund before 30 days; 20% refund within 14 days.',
    photoUrls: ['/packages/doha_skyline.jpg'],
    version: 1,
    createdAt: '2026-09-10T08:00:00Z',
  },
];

let departuresStore: DepartureRecord[] = [
  {
    id: 'DEP-2026-088',
    packageId: 'PKG-UMRAH-01',
    packageName: 'December Umrah Platinum 2026',
    departureDate: '2026-12-12',
    returnDate: '2026-12-26',
    totalSeats: 32,
    seatsSold: 30,
    seatsHeld: 1,
    heldSeats: [
      {
        holdId: 'HLD-01',
        seatCount: 1,
        expiresAt: '2026-11-03T16:00:00Z',
        clientName: 'Senator Alabi',
        heldByStaffName: 'Bisi Adeyemi',
      },
    ],
    cutoffDate: '2026-11-15',
    minimumNumbers: 20,
    status: 'filling',
    groupLeader: {
      name: 'Pastor Samuel Adeyemi',
      phone: '+234 803 111 2233',
      email: 'leader@gracechurch.org',
    },
    tourLead: {
      staffId: 'usr_tunde',
      name: 'Tunde Bakare',
      phone: '+234 802 333 4455',
    },
  },
  {
    id: 'DEP-2026-092',
    packageId: 'PKG-QATAR-01',
    packageName: 'Qatar Doha Luxury Experience',
    departureDate: '2026-11-28',
    returnDate: '2026-12-05',
    totalSeats: 24,
    seatsSold: 22,
    seatsHeld: 2,
    heldSeats: [],
    cutoffDate: '2026-11-10',
    minimumNumbers: 15,
    status: 'full',
    groupLeader: {
      name: 'Dr. Patrick Utomi',
      phone: '+234 809 998 8776',
      email: 'patrick@utomi.com',
    },
    tourLead: {
      staffId: 'usr_bisi',
      name: 'Bisi Adeyemi',
      phone: '+234 803 999 0011',
    },
  },
];

let groupBookingsStore: GroupBookingRecord[] = [
  {
    id: 'BK-2026-018',
    departureId: 'DEP-2026-088',
    groupName: 'Grace Church Abuja Pilgrim Delegation',
    groupLeader: {
      name: 'Pastor Samuel Adeyemi',
      phone: '+234 803 111 2233',
      email: 'leader@gracechurch.org',
    },
    payers: [
      {
        id: 'PAYER-01',
        name: 'Grace Church Board of Trustees',
        phone: '+234 803 111 2233',
        email: 'finance@gracechurch.org',
        assignedTravellerIds: ['TRV-01', 'TRV-02', 'TRV-03', 'TRV-04'],
      },
    ],
    travellers: [
      {
        id: 'TRV-01',
        fullNameAsPassport: 'Ibrahim Abdullahi',
        passportNumber: 'A10982341',
        passportExpiry: '2028-09-15',
        dateOfBirth: '1982-04-12',
        gender: 'M',
        nationality: 'Nigerian',
        roomType: 'double',
        assignedRoomId: 'RM-101',
        seatNumber: '12A',
        emergencyContact: {
          name: 'Zainab Abdullahi',
          phone: '+234 803 555 1234',
          relationship: 'Spouse',
        },
        documentsStatus: 'VERIFIED',
        invoicedKobo: 3_080_000_00,
        paidKobo: 2_000_000_00,
        balanceKobo: 1_080_000_00,
        status: 'ACTIVE',
      },
      {
        id: 'TRV-02',
        fullNameAsPassport: 'Folake Ogunleye',
        passportNumber: 'A11983344',
        passportExpiry: '2029-01-20',
        dateOfBirth: '1988-06-18',
        gender: 'F',
        nationality: 'Nigerian',
        roomType: 'double',
        assignedRoomId: 'RM-101',
        seatNumber: '12B',
        emergencyContact: {
          name: 'Dele Ogunleye',
          phone: '+234 802 444 8899',
          relationship: 'Brother',
        },
        documentsStatus: 'VERIFIED',
        invoicedKobo: 3_080_000_00,
        paidKobo: 2_000_000_00,
        balanceKobo: 1_080_000_00,
        status: 'ACTIVE',
      },
    ],
    paymentMilestones: [
      { id: 'MS-01', payerId: 'PAYER-01', amountKobo: 34_500_000_00, dueDate: '2026-10-15', status: 'PAID' },
      { id: 'MS-02', payerId: 'PAYER-01', amountKobo: 34_500_000_00, dueDate: '2026-11-12', status: 'PENDING' },
      { id: 'MS-03', payerId: 'PAYER-01', amountKobo: 29_560_000_00, dueDate: '2026-11-28', status: 'PENDING' },
    ],
    totalInvoicedKobo: 98_560_000_00,
    totalPaidKobo: 64_000_000_00,
    totalBalanceKobo: 34_560_000_00,
  },
];

let roomsStore: RoomAssignment[] = [
  {
    roomId: 'RM-101',
    departureId: 'DEP-2026-088',
    roomNumber: 'Suite 402 (Makkah Clock Tower)',
    roomType: 'double',
    capacity: 2,
    occupantTravellerIds: ['TRV-01', 'TRV-02'],
    sharingPreferences: 'Twin beds requested',
    specialRequests: 'High floor, non-smoking, wheelchair accessible',
  },
  {
    roomId: 'RM-102',
    departureId: 'DEP-2026-088',
    roomNumber: 'Suite 404 (Makkah Clock Tower)',
    roomType: 'double',
    capacity: 2,
    occupantTravellerIds: [],
    sharingPreferences: 'King bed',
    specialRequests: 'Quiet wing',
  },
];

let checkInsStore: LegCheckIn[] = [
  {
    checkInId: 'CHK-001',
    departureId: 'DEP-2026-088',
    legType: 'airport',
    legName: 'Murtala Muhammed International Airport (LOS)',
    travellerId: 'TRV-01',
    travellerName: 'Ibrahim Abdullahi',
    timestamp: '2026-12-12T06:30:00Z',
    scannedByStaff: 'Tunde Bakare',
  },
];

let incidentsStore: TourIncident[] = [
  {
    id: 'INC-2026-01',
    departureId: 'DEP-2026-088',
    timestamp: '2026-12-14T11:30:00Z',
    type: 'LOST_PROPERTY',
    severity: 'MEDIUM',
    description: 'Pilgrim left carry-on bag on Haramain train coach 4. Security desk notified.',
    peopleInvolved: ['Ibrahim Abdullahi'],
    ownerNotified: false,
    reportedBy: 'Tunde Bakare',
  },
];

export const registerGroupTravelPageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/group-travel/rules
   */
  app.get('/api/v1/group-travel/rules', async (_request, reply) => {
    return reply.send({
      success: true,
      rules: GROUP_TRAVEL_PAGE_RULES,
      count: GROUP_TRAVEL_PAGE_RULES.length,
    });
  });

  /**
   * GET /api/v1/group-travel/packages
   */
  app.get('/api/v1/group-travel/packages', async (request, reply) => {
    const { roleKey } = request.query as { roleKey?: string };
    const canViewMargins = roleKey === 'OWNER' || roleKey === 'OPERATIONS_MANAGER' || roleKey === 'FINANCE_OFFICER';

    const enriched = packagesStore.map((pkg) => {
      const margin = computePackageMargin(
        pkg.pricePerPersonByRoom.doubleKobo,
        pkg.costPerPersonKobo,
        pkg.seatsCapacity
      );

      return {
        ...pkg,
        margins: canViewMargins
          ? {
              marginPerPersonKobo: margin.marginPerPersonKobo,
              marginPerPersonPercent: margin.marginPerPersonPercent,
              fullGroupProfitKobo: margin.fullGroupProfitKobo,
              fullGroupMarginPercent: margin.fullGroupMarginPercent,
            }
          : undefined,
      };
    });

    return reply.send({
      success: true,
      packages: enriched,
      count: enriched.length,
    });
  });

  /**
   * POST /api/v1/group-travel/packages/:id/copy
   */
  app.post('/api/v1/group-travel/packages/:id/copy', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { newName } = request.body as { newName: string };

    const original = packagesStore.find((p) => p.id === id);
    if (!original) {
      return reply.status(404).send({ success: false, error: 'Package not found.' });
    }

    if (!newName || !newName.trim()) {
      return reply.status(400).send({ success: false, error: 'New package name is required.' });
    }

    const cloned = copyPackageToNew(original, newName.trim());
    packagesStore.unshift(cloned);

    return reply.status(201).send({
      success: true,
      package: cloned,
      message: `Package "${original.name}" copied successfully to "${cloned.name}". Existing bookings remain isolated.`,
    });
  });

  /**
   * GET /api/v1/group-travel/departures
   */
  app.get('/api/v1/group-travel/departures', async (_request, reply) => {
    const enriched = departuresStore.map((dep) => {
      const holdEval = evaluateSeatHoldExpiry(dep.heldSeats);
      const pkg = packagesStore.find((p) => p.id === dep.packageId);
      const costPerPerson = pkg ? pkg.costPerPersonKobo : 2_500_000_00;
      const cutoffEval = evaluateCutoffMinimums(dep, costPerPerson);

      return {
        ...dep,
        seatsHeld: holdEval.activeHolds.reduce((sum, h) => sum + h.seatCount, 0),
        cutoffAlert: cutoffEval.isPastCutoff && cutoffEval.isBelowMinimum ? cutoffEval : undefined,
      };
    });

    return reply.send({
      success: true,
      departures: enriched,
      count: enriched.length,
    });
  });

  /**
   * POST /api/v1/group-travel/departures/:id/allocate-seats
   */
  app.post('/api/v1/group-travel/departures/:id/allocate-seats', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { requestedSeats, clientName, staffName } = request.body as {
      requestedSeats: number;
      clientName: string;
      staffName?: string;
    };

    const departure = departuresStore.find((d) => d.id === id);
    if (!departure) {
      return reply.status(404).send({ success: false, error: 'Departure not found.' });
    }

    const alloc = validateSeatAllocation(departure, requestedSeats || 1);
    if (!alloc.allowed) {
      return reply.status(409).send({
        success: false,
        error: alloc.error,
        remainingSeats: alloc.remainingSeats,
      });
    }

    departure.seatsSold += requestedSeats;
    if (departure.seatsSold >= departure.totalSeats) {
      departure.status = 'full';
    }

    return reply.send({
      success: true,
      departure,
      remainingSeats: alloc.remainingSeats,
      message: `${requestedSeats} seat(s) confirmed for ${clientName}. Seats remaining: ${alloc.remainingSeats}.`,
    });
  });

  /**
   * POST /api/v1/group-travel/departures/:id/cancel
   */
  app.post('/api/v1/group-travel/departures/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason, confirmedByOwner } = request.body as { reason: string; confirmedByOwner: boolean };

    const departure = departuresStore.find((d) => d.id === id);
    if (!departure) {
      return reply.status(404).send({ success: false, error: 'Departure not found.' });
    }

    if (!confirmedByOwner) {
      return reply.status(400).send({
        success: false,
        error: 'Multi-step safety guard: Cancelling a group departure requires explicit business owner confirmation.',
      });
    }

    const affectedBookings = groupBookingsStore.filter((b) => b.departureId === id);
    const affectedTravellers = affectedBookings.reduce((sum, b) => sum + b.travellers.length, 0);
    const totalRefundLiability = affectedBookings.reduce((sum, b) => sum + b.totalPaidKobo, 0);

    departure.status = 'cancelled';
    departure.cancellationSummary = {
      cancelledAt: new Date().toISOString(),
      reason: reason || 'Operational airline cancellation / Minimum numbers not met',
      affectedBookingsCount: affectedBookings.length,
      affectedTravellersCount: affectedTravellers,
      totalRefundKobo: totalRefundLiability,
    };

    return reply.send({
      success: true,
      departure,
      cancellationSummary: departure.cancellationSummary,
      message: `Departure ${id} cancelled. ${affectedBookings.length} bookings (${affectedTravellers} travellers) notified. Total refund liability: ₦${(
        totalRefundLiability / 100
      ).toLocaleString()}.`,
    });
  });

  /**
   * GET /api/v1/group-travel/group-bookings
   */
  app.get('/api/v1/group-travel/group-bookings', async (request, reply) => {
    const { departureId } = request.query as { departureId?: string };

    const list = departureId
      ? groupBookingsStore.filter((b) => b.departureId === departureId)
      : groupBookingsStore;

    return reply.send({
      success: true,
      bookings: list,
      count: list.length,
    });
  });

  /**
   * POST /api/v1/group-travel/group-bookings/:id/bulk-import
   */
  app.post('/api/v1/group-travel/group-bookings/:id/bulk-import', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rows } = request.body as { rows: any[] };

    const booking = groupBookingsStore.find((b) => b.id === id);
    if (!booking) {
      return reply.status(404).send({ success: false, error: 'Group booking not found.' });
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return reply.status(400).send({ success: false, error: 'Spreadsheet rows are required.' });
    }

    const validation = validateBulkTravellerImport(rows);

    return reply.send({
      success: validation.errorCount === 0,
      validCount: validation.validCount,
      errorCount: validation.errorCount,
      errors: validation.errors,
      message:
        validation.errorCount === 0
          ? `All ${validation.validCount} travellers verified successfully for manifest.`
          : `${validation.errorCount} row error(s) detected. Fix errors before importing.`,
    });
  });

  /**
   * GET /api/v1/group-travel/rooming-list
   */
  app.get('/api/v1/group-travel/rooming-list', async (request, reply) => {
    const { departureId } = request.query as { departureId?: string };

    const rooms = departureId
      ? roomsStore.filter((r) => r.departureId === departureId)
      : roomsStore;

    return reply.send({
      success: true,
      rooms,
      count: rooms.length,
    });
  });

  /**
   * POST /api/v1/group-travel/rooming-list/assign
   */
  app.post('/api/v1/group-travel/rooming-list/assign', async (request, reply) => {
    const { departureId, roomId, travellerId } = request.body as {
      departureId: string;
      roomId: string;
      travellerId: string;
    };

    const departureRooms = roomsStore.filter((r) => r.departureId === departureId);
    const clash = validateRoomClashAndCapacity(departureRooms, travellerId, roomId);

    if (!clash.isValid) {
      return reply.status(400).send({ success: false, error: clash.error });
    }

    const targetRoom = roomsStore.find((r) => r.roomId === roomId);
    if (!targetRoom) {
      return reply.status(404).send({ success: false, error: 'Room not found.' });
    }

    targetRoom.occupantTravellerIds.push(travellerId);

    return reply.send({
      success: true,
      room: targetRoom,
      message: `Traveller ${travellerId} assigned to ${targetRoom.roomNumber}.`,
    });
  });

  /**
   * POST /api/v1/group-travel/check-in
   */
  app.post('/api/v1/group-travel/check-in', async (request, reply) => {
    const { departureId, travellerId, travellerName, legType, legName, staffName } = request.body as {
      departureId: string;
      travellerId: string;
      travellerName: string;
      legType: 'airport' | 'hotel' | 'excursion';
      legName: string;
      staffName?: string;
    };

    const resCheckIn = registerLegCheckIn(
      checkInsStore,
      travellerId,
      travellerName,
      legType,
      legName,
      departureId,
      staffName || 'Tour Lead'
    );

    if (!resCheckIn.success || !resCheckIn.checkIn) {
      return reply.status(409).send({
        success: false,
        error: resCheckIn.error,
        originalCheckIn: resCheckIn.originalCheckIn,
      });
    }

    checkInsStore.push(resCheckIn.checkIn);

    return reply.status(201).send({
      success: true,
      checkIn: resCheckIn.checkIn,
      message: `Arrival verified for ${travellerName} at ${legName}.`,
    });
  });

  /**
   * GET /api/v1/group-travel/incidents
   */
  app.get('/api/v1/group-travel/incidents', async (request, reply) => {
    const { departureId } = request.query as { departureId?: string };

    const list = departureId
      ? incidentsStore.filter((i) => i.departureId === departureId)
      : incidentsStore;

    return reply.send({
      success: true,
      incidents: list,
      count: list.length,
    });
  });

  /**
   * POST /api/v1/group-travel/incidents
   */
  app.post('/api/v1/group-travel/incidents', async (request, reply) => {
    const { departureId, type, severity, description, peopleInvolved, photoUrl, reportedBy } =
      request.body as {
        departureId: string;
        type: any;
        severity: any;
        description: string;
        peopleInvolved: string[];
        photoUrl?: string;
        reportedBy?: string;
      };

    if (!description || !description.trim()) {
      return reply.status(400).send({ success: false, error: 'Incident description is required.' });
    }

    const isCriticalOrHigh = severity === 'CRITICAL' || severity === 'HIGH';

    const newIncident: TourIncident = {
      id: `INC-2026-${String(incidentsStore.length + 1).padStart(2, '0')}`,
      departureId,
      timestamp: new Date().toISOString(),
      type: type || 'OTHER',
      severity: severity || 'MEDIUM',
      description: description.trim(),
      peopleInvolved: peopleInvolved || [],
      photoUrl,
      ownerNotified: isCriticalOrHigh,
      reportedBy: reportedBy || 'Tour Lead',
    };

    incidentsStore.unshift(newIncident);

    return reply.status(201).send({
      success: true,
      incident: newIncident,
      message: isCriticalOrHigh
        ? `Incident ${newIncident.id} logged. Emergency push alert dispatched to Business Owner.`
        : `Incident ${newIncident.id} recorded in tour diary.`,
    });
  });

  /**
   * GET /api/v1/group-travel/profitability
   */
  app.get('/api/v1/group-travel/profitability', async (request, reply) => {
    const { departureId } = request.query as { departureId?: string };

    const profitabilityList: DepartureProfitability[] = [
      {
        departureId: 'DEP-2026-088',
        packageName: 'December Umrah Platinum 2026',
        travellersCount: 32,
        revenueReceivedKobo: 64_000_000_00,
        outstandingKobo: 34_560_000_00,
        supplierCostKobo: 82_000_000_00,
        operationalExpensesKobo: 1_200_000_00,
        netProfitKobo: 15_360_000_00,
        marginPercent: 15.6,
        perTravellerAverageProfitKobo: 480_000_00,
        forecastProfitKobo: 16_560_000_00,
        varianceKobo: -1_200_000_00, // Escort hotel upgrade variance
      },
      {
        departureId: 'DEP-2026-092',
        packageName: 'Qatar Doha Luxury Experience',
        travellersCount: 22,
        revenueReceivedKobo: 47_300_000_00,
        outstandingKobo: 0,
        supplierCostKobo: 37_840_000_00,
        operationalExpensesKobo: 950_000_00,
        netProfitKobo: 8_510_000_00,
        marginPercent: 18.0,
        perTravellerAverageProfitKobo: 386_818_18,
        forecastProfitKobo: 8_200_000_00,
        varianceKobo: 310_000_00,
      },
    ];

    const filtered = departureId
      ? profitabilityList.filter((p) => p.departureId === departureId)
      : profitabilityList;

    return reply.send({
      success: true,
      profitability: filtered,
      count: filtered.length,
    });
  });
};

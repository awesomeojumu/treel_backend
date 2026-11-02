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
let packagesStore: TourPackage[] = [];

let departuresStore: DepartureRecord[] = [];

let groupBookingsStore: GroupBookingRecord[] = [];

let roomsStore: RoomAssignment[] = [];

let checkInsStore: LegCheckIn[] = [];

let incidentsStore: TourIncident[] = [];

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

    const profitabilityList: DepartureProfitability[] = [];

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

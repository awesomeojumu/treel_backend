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
let eventsStore: EventRecord[] = [];

let guestsStore: EventGuest[] = [];

let vendorsStore: EventVendor[] = [];

let runSheetStore: RunSheetItem[] = [];

let rosterStore: RosterItem[] = [];

let expensesStore: EventExpenseItem[] = [];

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
    const items: CalendarItem[] = eventsStore.map((e) => ({
      id: e.id,
      type: 'EVENT',
      title: e.name,
      date: e.dateTime ? e.dateTime.split('T')[0] : '2026-11-02',
      time: '09:00 WAT',
      color: '#0B1E3D',
      label: 'Event',
      venueOrRoute: e.venue,
    }));

    return reply.send({
      success: true,
      items,
      count: items.length,
    });
  });
};

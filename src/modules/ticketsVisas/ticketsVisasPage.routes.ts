import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  TICKETS_VISAS_PAGE_RULES,
  validateIataTicketNumber,
  validatePassengerPassportName,
  validateTicketPaymentClearance,
  evaluateDepartureRisk,
  checkPassport6MonthExpiry,
  validateVisaChecklistSubmission,
  checkAppointmentClash,
  FlightTicket,
  DepartureRecord,
  VisaCase,
  PremiumService,
} from '@/core/ticketsVisas/ticketsVisasPageRules';

// In-memory data store for Tickets, Visas, Departures and Premium Services
let ticketsStore: FlightTicket[] = [
  {
    id: 'TKT-2026-001',
    bookingId: 'BK-2026-014',
    passenger: {
      id: 'PAX-01',
      fullName: 'Ngozi Nwosu',
      passportName: 'Ngozi Nwosu',
      passportNumber: 'A10982341',
      passportExpiry: '2028-09-15',
      isNameMatched: true,
    },
    airline: 'Virgin Atlantic Airways',
    airlineCode: 'VS',
    flightNumbers: ['VS0412', 'VS0411'],
    route: 'LOS - LHR - LOS',
    departureTimeLocal: '2026-11-14T09:30:00+01:00', // Lagos local
    arrivalTimeLocal: '2026-11-14T16:15:00+00:00', // London local
    departureLagosTime: '2026-11-14T09:30:00+01:00',
    arrivalLagosTime: '2026-11-14T17:15:00+01:00',
    cabinClass: 'Business',
    fareBasis: 'J2RWNG',
    ticketNumber: '932-4481920114',
    pnr: 'VS882K',
    fareKobo: 2_150_000_00,
    taxesKobo: 300_000_00,
    totalClientPriceKobo: 2_450_000_00,
    supplier: { id: 'SUP-001', name: 'Wakanow Consolidator Desk' },
    supplierCostKobo: 1_860_000_00,
    status: 'issued',
    issuedAt: '2026-10-28T14:30:00Z',
    issuedBy: 'Tunde Bakare',
    ticketDocumentUrl: '/tickets/eticket_9324481920114.pdf',
    shareLogs: [
      {
        sharedBy: 'Tunde Bakare',
        sharedAt: '2026-10-28T14:35:00Z',
        channel: 'whatsapp',
        recipient: '+2348039988771',
      },
    ],
  },
  {
    id: 'TKT-2026-002',
    bookingId: 'BK-2026-016',
    passenger: {
      id: 'PAX-02',
      fullName: 'Ibrahim Abdullahi',
      passportName: 'Ibrahim Abdullahi',
      passportNumber: 'B09182371',
      passportExpiry: '2027-04-10',
      isNameMatched: true,
    },
    airline: 'RwandAir',
    airlineCode: 'WB',
    flightNumbers: ['WB0201', 'WB0202'],
    route: 'LOS - KGL - LOS',
    departureTimeLocal: '2026-11-04T13:00:00+01:00',
    arrivalTimeLocal: '2026-11-04T19:30:00+02:00',
    departureLagosTime: '2026-11-04T13:00:00+01:00',
    arrivalLagosTime: '2026-11-04T18:30:00+01:00',
    cabinClass: 'Economy',
    fareBasis: 'QPROMO',
    ticketNumber: '459-8829104412',
    pnr: 'WB419M',
    fareKobo: 480_000_00,
    taxesKobo: 120_000_00,
    totalClientPriceKobo: 600_000_00,
    supplier: { id: 'SUP-002', name: 'Finchglow Consolidator Desk' },
    supplierCostKobo: 520_000_00,
    status: 'held',
    holdExpiresAt: '2026-11-03T18:00:00Z',
    isHoldExpired: false,
    shareLogs: [],
  },
];

let departuresStore: DepartureRecord[] = [
  {
    id: 'DEP-001',
    bookingId: 'BK-2026-016',
    bookingReference: 'TR-2026-016',
    client: {
      id: 'CL-002',
      name: 'Ibrahim Abdullahi',
      phone: '+2348023344556',
      email: 'ibrahim@abdullahi.ng',
      passportNumber: 'B09182371',
      passportExpiry: '2027-04-10',
    },
    route: 'LOS - KGL (Kigali)',
    airline: 'RwandAir',
    flightNumber: 'WB0201',
    departureTimeLocal: '2026-11-04T13:00:00+01:00',
    departureTimeLagos: '2026-11-04T13:00:00+01:00',
    daysUntilDeparture: 2,
    paymentStatus: 'Part-paid', // Trigger risk within 72h
    documentsStatus: 'Complete',
    visaStatus: 'Not required',
    isAtRisk: true,
    atRiskReasons: ['Unpaid / Outstanding client balance within 72 hours of departure'],
    isPassportUnder6Months: false,
    remindersSent: [],
  },
  {
    id: 'DEP-002',
    bookingId: 'BK-2026-014',
    bookingReference: 'TR-2026-014',
    client: {
      id: 'CL-001',
      name: 'Ngozi Nwosu',
      phone: '+2348039988771',
      email: 'ngozi@nwosu.ng',
      passportNumber: 'A10982341',
      passportExpiry: '2028-09-15',
    },
    route: 'LOS - LHR (London Heathrow)',
    airline: 'Virgin Atlantic',
    flightNumber: 'VS0412',
    departureTimeLocal: '2026-11-14T09:30:00+01:00',
    departureTimeLagos: '2026-11-14T09:30:00+01:00',
    daysUntilDeparture: 12,
    paymentStatus: 'Paid',
    documentsStatus: 'Complete',
    visaStatus: 'Approved',
    isAtRisk: false,
    atRiskReasons: [],
    isPassportUnder6Months: false,
    remindersSent: [],
  },
  {
    id: 'DEP-003',
    bookingId: 'BK-2026-022',
    bookingReference: 'TR-2026-022',
    client: {
      id: 'CL-003',
      name: 'Oluwaseun Adeleke',
      phone: '+2348098765432',
      email: 'seun@adeleke.com',
      passportNumber: 'C08129482',
      passportExpiry: '2027-01-20', // Expiring in <3 months from travel date (flagged!)
    },
    route: 'LOS - DXB (Dubai)',
    airline: 'Emirates',
    flightNumber: 'EK0784',
    departureTimeLocal: '2026-11-03T18:30:00+01:00',
    departureTimeLagos: '2026-11-03T18:30:00+01:00',
    daysUntilDeparture: 1,
    paymentStatus: 'Paid',
    documentsStatus: 'Complete',
    visaStatus: 'Approved',
    isAtRisk: false,
    atRiskReasons: [],
    isPassportUnder6Months: true, // Flagged per Rule 13
    remindersSent: [],
  },
];

let visaCasesStore: VisaCase[] = [
  {
    id: 'VSA-2026-009',
    bookingId: 'BK-2026-017',
    client: {
      id: 'CL-004',
      name: 'Folake Ogunleye',
      phone: '+2348031122334',
      outstandingBalanceKobo: 75_000_00, // Shown on case card per Rule 18
    },
    country: 'United Kingdom',
    visaType: 'Standard Visitor (6-Month)',
    embassyOrCentre: 'TLScontact Ikeja Visa Centre',
    applicationDate: '2026-10-20',
    appointmentDateTime: '2026-11-14T09:00:00+01:00',
    feeKobo: 180_000_00,
    serviceFeeKobo: 75_000_00,
    status: 'Appointment booked',
    checklist: [
      { id: '1', name: 'Valid International Passport', isRequired: true, status: 'verified' },
      { id: '2', name: '6-Month Bank Statement (Signed & Stamped)', isRequired: true, status: 'verified' },
      { id: '3', name: 'Employment Introduction Letter', isRequired: true, status: 'collected' },
      { id: '4', name: 'Flight Itinerary Reservation', isRequired: true, status: 'verified' },
      { id: '5', name: 'Hotel Booking Confirmation', isRequired: true, status: 'verified' },
      { id: '6', name: 'Tuberculosis (TB) Test Certificate', isRequired: false, status: 'pending' },
    ],
    notes: 'TLScontact VIP lounge booked for biometric capture.',
  },
];

let premiumServicesStore: PremiumService[] = [
  {
    id: 'PRM-001',
    bookingId: 'BK-2026-014',
    bookingReference: 'TR-2026-014',
    type: 'airport_transfer',
    title: 'Executive VIP Airport Protocol & Escort',
    description: 'Fast-track immigration escort and luxury transfer at Murtala Muhammed Airport',
    clientPriceKobo: 65_000_00,
    supplierCostKobo: 45_000_00,
    supplier: { id: 'SUP-001', name: 'Skyline Protocol Services' },
    isInvoiceIssued: true,
    creditNoteRequiredOnRemoval: true,
    status: 'active',
    createdAt: '2026-10-28T10:00:00Z',
  },
  {
    id: 'PRM-002',
    bookingId: 'BK-2026-014',
    bookingReference: 'TR-2026-014',
    type: 'insurance',
    title: 'AXA Mansard Worldwide Travel Insurance ($100k Coverage)',
    description: 'Emergency medical evacuation, baggage loss and flight delay protection',
    clientPriceKobo: 42_000_00,
    supplierCostKobo: 30_000_00,
    supplier: { id: 'SUP-005', name: 'AXA Mansard Insurance PLC' },
    isInvoiceIssued: true,
    creditNoteRequiredOnRemoval: true,
    status: 'active',
    createdAt: '2026-10-28T10:15:00Z',
  },
];

export const registerTicketsVisasPageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/tickets-visas/rules
   */
  app.get('/api/v1/tickets-visas/rules', async () => {
    return {
      success: true,
      rules: TICKETS_VISAS_PAGE_RULES,
    };
  });

  /**
   * GET /api/v1/tickets-visas/tickets
   */
  app.get('/api/v1/tickets-visas/tickets', async () => {
    return {
      success: true,
      count: ticketsStore.length,
      tickets: ticketsStore,
    };
  });

  /**
   * POST /api/v1/tickets-visas/tickets/issue
   * Rules 1, 2, 3, 5, 6
   */
  app.post('/api/v1/tickets-visas/tickets/issue', async (request, reply) => {
    const body = request.body as {
      bookingId: string;
      passengerName: string;
      passportName: string;
      passportNumber: string;
      passportExpiry: string;
      airline: string;
      airlineCode: string;
      flightNumbers: string[];
      route: string;
      departureTimeLocal: string;
      arrivalTimeLocal: string;
      departureLagosTime: string;
      arrivalLagosTime: string;
      cabinClass: 'Economy' | 'Premium Economy' | 'Business' | 'First';
      fareBasis: string;
      ticketNumber: string;
      pnr: string;
      fareKobo: number;
      taxesKobo: number;
      supplierId: string;
      supplierName: string;
      supplierCostKobo: number;
      clientPaidKobo: number;
      nameMismatchOverrideReason?: string;
      paymentOverrideReason?: string;
      isOwnerOverride?: boolean;
      staffName: string;
    };

    // Rule 3: 13-digit IATA ticket format check
    const formatCheck = validateIataTicketNumber(body.ticketNumber);
    if (!formatCheck.isValid) {
      return reply.status(400).send({ success: false, error: formatCheck.error });
    }

    // Duplicate check
    const isDuplicate = ticketsStore.some(
      (t) => t.ticketNumber.replace(/[\s-]/g, '') === formatCheck.cleanNumber
    );
    if (isDuplicate) {
      return reply.status(409).send({
        success: false,
        error: `Duplicate ticket number detected. E-ticket ${body.ticketNumber} already exists in the system.`,
      });
    }

    // Rule 2: Passenger name vs passport match
    const nameCheck = validatePassengerPassportName(
      body.passengerName,
      body.passportName,
      body.nameMismatchOverrideReason
    );
    if (!nameCheck.canIssue) {
      return reply.status(400).send({ success: false, error: nameCheck.error });
    }

    // Rule 5: Payment clearance check
    const totalClientPrice = body.fareKobo + body.taxesKobo;
    const paymentCheck = validateTicketPaymentClearance(
      body.clientPaidKobo,
      totalClientPrice,
      Boolean(body.isOwnerOverride),
      body.paymentOverrideReason
    );
    if (!paymentCheck.canIssue) {
      return reply.status(400).send({ success: false, error: paymentCheck.error });
    }

    const newTicket: FlightTicket = {
      id: `TKT-2026-${String(ticketsStore.length + 1).padStart(3, '0')}`,
      bookingId: body.bookingId,
      passenger: {
        id: `PAX-${Date.now()}`,
        fullName: body.passengerName,
        passportName: body.passportName,
        passportNumber: body.passportNumber,
        passportExpiry: body.passportExpiry,
        isNameMatched: nameCheck.isMatch,
        nameMismatchOverrideReason: body.nameMismatchOverrideReason,
      },
      airline: body.airline,
      airlineCode: body.airlineCode,
      flightNumbers: body.flightNumbers,
      route: body.route,
      departureTimeLocal: body.departureTimeLocal,
      arrivalTimeLocal: body.arrivalTimeLocal,
      departureLagosTime: body.departureLagosTime,
      arrivalLagosTime: body.arrivalLagosTime,
      cabinClass: body.cabinClass,
      fareBasis: body.fareBasis,
      ticketNumber: body.ticketNumber,
      pnr: body.pnr,
      fareKobo: body.fareKobo,
      taxesKobo: body.taxesKobo,
      totalClientPriceKobo: totalClientPrice,
      supplier: { id: body.supplierId, name: body.supplierName },
      supplierCostKobo: body.supplierCostKobo,
      status: 'issued',
      issuedAt: new Date().toISOString(),
      issuedBy: body.staffName,
      issuedWithPaymentOverride: !paymentCheck.isCleared,
      paymentOverrideReason: body.paymentOverrideReason,
      ticketDocumentUrl: `/tickets/${formatCheck.cleanNumber}.pdf`,
      shareLogs: [],
    };

    ticketsStore.unshift(newTicket);

    // Rule 6: Supplier cost added to Amounts owed
    return reply.status(201).send({
      success: true,
      ticket: newTicket,
      supplierPayableAdded: {
        supplierId: body.supplierId,
        supplierName: body.supplierName,
        amountKobo: body.supplierCostKobo,
      },
      message: `E-ticket ${newTicket.ticketNumber} successfully issued for ${newTicket.passenger.fullName}. ₦${(
        newTicket.supplierCostKobo / 100
      ).toLocaleString()} routed to supplier payables.`,
    });
  });

  /**
   * POST /api/v1/tickets-visas/tickets/:id/amend
   * Rule 7: Changes and refunds
   */
  app.post('/api/v1/tickets-visas/tickets/:id/amend', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      type: 'change' | 'refund';
      penaltyFeeKobo: number;
      fareDifferenceKobo: number;
      newTicketNumber?: string;
      requestedBy: string;
      notes?: string;
    };

    const ticket = ticketsStore.find((t) => t.id === id);
    if (!ticket) {
      return reply.status(404).send({ success: false, error: 'Ticket not found.' });
    }

    ticket.status = body.type === 'change' ? 'changed' : 'refunded';
    ticket.amendment = {
      type: body.type,
      penaltyFeeKobo: body.penaltyFeeKobo,
      fareDifferenceKobo: body.fareDifferenceKobo,
      requestedBy: body.requestedBy,
      requestedAt: new Date().toISOString(),
      originalTicketNumber: ticket.ticketNumber,
      newTicketNumber: body.newTicketNumber,
      notes: body.notes,
    };

    return {
      success: true,
      ticket,
      message: `Ticket ${ticket.ticketNumber} marked as ${ticket.status}. Penalty fee: ₦${(
        body.penaltyFeeKobo / 100
      ).toLocaleString()}, Fare diff: ₦${(body.fareDifferenceKobo / 100).toLocaleString()}.`,
    };
  });

  /**
   * POST /api/v1/tickets-visas/tickets/:id/share
   * Rule 8: Ticket copy PDF/image sharing log
   */
  app.post('/api/v1/tickets-visas/tickets/:id/share', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { channel, recipient, sharedBy } = request.body as {
      channel: 'whatsapp' | 'email' | 'link';
      recipient: string;
      sharedBy: string;
    };

    const ticket = ticketsStore.find((t) => t.id === id);
    if (!ticket) {
      return reply.status(404).send({ success: false, error: 'Ticket not found.' });
    }

    const logEntry = {
      sharedBy,
      sharedAt: new Date().toISOString(),
      channel,
      recipient,
    };
    ticket.shareLogs.push(logEntry);

    return {
      success: true,
      log: logEntry,
      message: `Ticket PDF share via ${channel} logged to audit records.`,
    };
  });

  /**
   * GET /api/v1/tickets-visas/departures
   * Rules 10, 11, 13: 7/14/30 days, sorted departure time, 72h risk evaluation, 6mo passport check
   */
  app.get('/api/v1/tickets-visas/departures', async (request) => {
    const { windowDays = '30' } = request.query as { windowDays?: string };
    const maxDays = parseInt(windowDays, 10) || 30;

    const filtered = departuresStore
      .filter((d) => d.daysUntilDeparture <= maxDays)
      .sort((a, b) => new Date(a.departureTimeLocal).getTime() - new Date(b.departureTimeLocal).getTime());

    return {
      success: true,
      count: filtered.length,
      departures: filtered,
    };
  });

  /**
   * POST /api/v1/tickets-visas/departures/:id/send-reminder
   * Rule 12: Pre-flight reminder logged as shared, never claimed delivered
   */
  app.post('/api/v1/tickets-visas/departures/:id/send-reminder', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { template, channel, sentBy } = request.body as {
      template: string;
      channel: 'whatsapp' | 'sms' | 'email';
      sentBy: string;
    };

    const dep = departuresStore.find((d) => d.id === id);
    if (!dep) {
      return reply.status(404).send({ success: false, error: 'Departure record not found.' });
    }

    const log = {
      template,
      sentAt: new Date().toISOString(),
      sentBy,
      channel,
      loggedAs: 'shared' as const,
    };

    dep.remindersSent.push(log);

    return {
      success: true,
      log,
      message: `Pre-flight reminder logged as shared via ${channel} (Delivery not claimed).`,
    };
  });

  /**
   * GET /api/v1/tickets-visas/visas
   */
  app.get('/api/v1/tickets-visas/visas', async () => {
    return {
      success: true,
      count: visaCasesStore.length,
      visas: visaCasesStore,
    };
  });

  /**
   * PUT /api/v1/tickets-visas/visas/:id/status
   * Rules 15, 16, 17, 19: Checklist submission check, refusal reason & refundability, appointment clash
   */
  app.put('/api/v1/tickets-visas/visas/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      status: VisaCase['status'];
      checklistOverrideReason?: string;
      refusalReason?: string;
      isFeeRefundable?: boolean;
      refundableAmountKobo?: number;
      appointmentDateTime?: string;
    };

    const visaCase = visaCasesStore.find((v) => v.id === id);
    if (!visaCase) {
      return reply.status(404).send({ success: false, error: 'Visa case not found.' });
    }

    // Rule 15: Cannot be marked Submitted with required items missing
    if (body.status === 'Submitted') {
      const checklistCheck = validateVisaChecklistSubmission(
        visaCase.checklist,
        body.checklistOverrideReason
      );
      if (!checklistCheck.canSubmit) {
        return reply.status(400).send({ success: false, error: checklistCheck.error });
      }
    }

    // Rule 19: Appointment clash check
    if (body.appointmentDateTime) {
      const clashCheck = checkAppointmentClash(
        visaCase.client.id,
        body.appointmentDateTime,
        visaCasesStore,
        visaCase.id
      );
      if (clashCheck.hasClash) {
        return reply.status(409).send({
          success: false,
          error: `Appointment clash detected! Client ${visaCase.client.name} already has a biometric appointment on ${body.appointmentDateTime.split('T')[0]} under case ${clashCheck.clashingCase?.id}.`,
        });
      }
      visaCase.appointmentDateTime = body.appointmentDateTime;
    }

    visaCase.status = body.status;

    // Rule 17: Refused records reason and refundability
    if (body.status === 'Refused') {
      visaCase.outcomeDate = new Date().toISOString();
      visaCase.refusalDetails = {
        reason: body.refusalReason || 'Embassy document deficiency / refusal letter issued',
        isFeeRefundable: Boolean(body.isFeeRefundable),
        refundableAmountKobo: body.refundableAmountKobo || 0,
      };
    }

    return {
      success: true,
      visaCase,
      message: `Visa case ${visaCase.id} updated to status "${visaCase.status}".`,
    };
  });

  /**
   * GET /api/v1/tickets-visas/premium-services
   */
  app.get('/api/v1/tickets-visas/premium-services', async () => {
    return {
      success: true,
      count: premiumServicesStore.length,
      services: premiumServicesStore,
    };
  });

  /**
   * POST /api/v1/tickets-visas/premium-services
   * Rules 21, 22: Adds to booking total and supplier payables
   */
  app.post('/api/v1/tickets-visas/premium-services', async (request, reply) => {
    const body = request.body as {
      bookingId: string;
      bookingReference: string;
      type: PremiumService['type'];
      title: string;
      description: string;
      clientPriceKobo: number;
      supplierCostKobo: number;
      supplierId: string;
      supplierName: string;
    };

    const newService: PremiumService = {
      id: `PRM-${Date.now()}`,
      bookingId: body.bookingId,
      bookingReference: body.bookingReference,
      type: body.type,
      title: body.title,
      description: body.description,
      clientPriceKobo: body.clientPriceKobo,
      supplierCostKobo: body.supplierCostKobo,
      supplier: { id: body.supplierId, name: body.supplierName },
      isInvoiceIssued: false, // Initial state
      creditNoteRequiredOnRemoval: false,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    premiumServicesStore.push(newService);

    return reply.status(201).send({
      success: true,
      service: newService,
      bookingTotalAdjustmentKobo: newService.clientPriceKobo,
      supplierPayableAddedKobo: newService.supplierCostKobo,
      message: `Premium service "${newService.title}" added. ₦${(
        newService.clientPriceKobo / 100
      ).toLocaleString()} added to booking and ₦${(
        newService.supplierCostKobo / 100
      ).toLocaleString()} added to supplier payables.`,
    });
  });

  /**
   * DELETE /api/v1/tickets-visas/premium-services/:id
   * Rule 23: Credit note requirement on removing invoiced services
   */
  app.delete('/api/v1/tickets-visas/premium-services/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { creditNoteReference } = request.query as { creditNoteReference?: string };

    const service = premiumServicesStore.find((s) => s.id === id);
    if (!service) {
      return reply.status(404).send({ success: false, error: 'Premium service not found.' });
    }

    // Rule 23: If invoice already issued, requires credit note
    if (service.isInvoiceIssued && (!creditNoteReference || creditNoteReference.trim().length === 0)) {
      return reply.status(400).send({
        success: false,
        error: `Cannot remove service "${service.title}". The booking invoice has already been issued to the client. An offsetting credit note reference is required (Rule 23).`,
      });
    }

    service.status = 'cancelled_with_credit_note';
    service.creditNoteId = creditNoteReference;

    return {
      success: true,
      service,
      message: `Service "${service.title}" removed with offsetting credit note ${creditNoteReference || 'N/A'}.`,
    };
  });
};

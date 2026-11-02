import { FastifyInstance } from 'fastify';
import {
  listBookingsPageRules,
  calculateBookingTotals,
  checkTravellerPassportCompliance,
  validateBookingTravelDates,
  determineBookingStatus,
  amendBookingItem,
  evaluateInstalmentOverdueStatus,
  cancelBookingAndComputeRefund,
  recordSupplierRefundReceivable,
  reinstateCancelledBooking,
  BookingRecord,
  BookingItem,
  BookingTraveller,
  PaymentPlanType,
  BookingStatus,
} from '@/core/bookings/bookingsPageRules';

// In-memory demo store for Bookings
const INITIAL_BOOKINGS: BookingRecord[] = [];

let bookingsDb = [...INITIAL_BOOKINGS];

export async function registerBookingsPageRoutes(app: FastifyInstance): Promise<void> {
  // 1. Rules Catalog
  app.get('/api/v1/bookings/rules', async () => {
    return {
      success: true,
      rules: listBookingsPageRules(),
    };
  });

  // 2. List Bookings with Financial Parity
  app.get<{
    Querystring: {
      status?: string;
      search?: string;
      branchId?: string;
      ownerStaffId?: string;
    };
  }>('/api/v1/bookings', async (req) => {
    const { status, search, branchId, ownerStaffId } = req.query;
    let list = [...bookingsDb];

    // Status filter
    if (status && status !== 'all') {
      list = list.filter((b) => b.status === status);
    }

    // Branch filter
    if (branchId && branchId !== 'all') {
      list = list.filter((b) => b.branchId === branchId);
    }

    // Owner staff filter
    if (ownerStaffId) {
      list = list.filter((b) => b.ownerStaffId === ownerStaffId);
    }

    // Search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          b.clientName.toLowerCase().includes(q) ||
          b.destination.toLowerCase().includes(q) ||
          b.travellers.some((t) => t.fullNameAsPassport.toLowerCase().includes(q))
      );
    }

    // Compute financial aggregates (Rule 7: parity with Home and Reports)
    const totalSalesKobo = list
      .filter((b) => b.status !== 'Cancelled')
      .reduce((s, b) => s + b.totalGrossKobo, 0);
    const totalCollectedKobo = list
      .filter((b) => b.status !== 'Cancelled')
      .reduce((s, b) => s + b.paidKobo, 0);
    const totalOutstandingKobo = list
      .filter((b) => b.status !== 'Cancelled')
      .reduce((s, b) => s + b.owedKobo, 0);

    return {
      success: true,
      count: list.length,
      aggregates: {
        totalSalesKobo,
        totalCollectedKobo,
        totalOutstandingKobo,
      },
      bookings: list,
    };
  });

  // 3. Get Single Booking with Detail Tabs Scoping (Rule 8)
  app.get<{ Params: { id: string } }>('/api/v1/bookings/:id', async (req, reply) => {
    const booking = bookingsDb.find((b) => b.id === req.params.id);
    if (!booking) {
      return reply.code(404).send({ success: false, error: 'Booking not found.' });
    }

    const updatedInstalments = evaluateInstalmentOverdueStatus(booking.instalments);

    return {
      success: true,
      booking: {
        ...booking,
        instalments: updatedInstalments,
      },
    };
  });

  // 4. Create Booking (From Quote or From Scratch)
  app.post<{
    Body: {
      clientId: string;
      clientName: string;
      clientPhone: string;
      clientEmail?: string;
      leadId?: string;
      quoteId?: string;
      type: string;
      travellers: BookingTraveller[];
      destination: string;
      startDate: string;
      endDate: string;
      items: BookingItem[];
      paymentPlan: PaymentPlanType;
      requiredDepositKobo?: number;
      ownerStaffId: string;
      ownerStaffName: string;
      staffRole?: string;
      branchId: string;
      branchName: string;
      notes?: string;
      isBackdated?: boolean;
      backdatedReason?: string;
    };
  }>('/api/v1/bookings', async (req, reply) => {
    const body = req.body;

    // Validate travel dates & past date guard (Rule 4)
    const dateValidation = validateBookingTravelDates(
      body.startDate,
      body.endDate,
      body.isBackdated,
      body.backdatedReason,
      body.staffRole
    );
    if (!dateValidation.valid) {
      return reply.code(400).send({ success: false, error: dateValidation.error });
    }

    // Verify passport compliance for travellers (Rule 3)
    const passportWarnings: string[] = [];
    for (const trv of body.travellers) {
      const pCheck = checkTravellerPassportCompliance(trv, body.startDate);
      if (!pCheck.compliant) {
        return reply.code(400).send({ success: false, error: pCheck.warning });
      }
      if (pCheck.warning) {
        passportWarnings.push(pCheck.warning);
      }
    }

    // Calculate system totals (Rule 2)
    const totals = calculateBookingTotals(body.items);

    const requiredDepositKobo =
      body.paymentPlan === 'full_upfront'
        ? totals.totalGrossKobo
        : body.requiredDepositKobo || Math.round(totals.totalGrossKobo * 0.3);

    const initialStatus = determineBookingStatus(
      totals.totalGrossKobo,
      0, // initial paid is 0
      requiredDepositKobo,
      body.items
    );

    const year = new Date().getFullYear();
    const nextSeq = bookingsDb.length + 43;
    const bookingId = `BK-${year}-${String(nextSeq).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const timelineEntry = {
      id: `tl-${Date.now().toString(36)}`,
      field: 'status',
      previousValue: 'None',
      newValue: initialStatus,
      changedByStaffId: body.ownerStaffId,
      changedByStaffName: body.ownerStaffName,
      timestamp: now,
    };

    const newBooking: BookingRecord = {
      id: bookingId,
      organizationId: 'org-lagos-01',
      clientId: body.clientId,
      clientName: body.clientName,
      clientPhone: body.clientPhone,
      clientEmail: body.clientEmail,
      leadId: body.leadId,
      quoteId: body.quoteId,
      type: (body.type as any) || 'package',
      travellers: body.travellers,
      destination: body.destination,
      startDate: body.startDate,
      endDate: body.endDate,
      items: body.items,
      subtotalNetKobo: totals.subtotalNetKobo,
      totalVatKobo: totals.totalVatKobo,
      totalGrossKobo: totals.totalGrossKobo,
      paidKobo: 0,
      owedKobo: totals.totalGrossKobo,
      requiredDepositKobo,
      paymentPlan: body.paymentPlan,
      instalments: [],
      ownerStaffId: body.ownerStaffId,
      ownerStaffName: body.ownerStaffName,
      branchId: body.branchId,
      branchName: body.branchName,
      supplierLinks: [],
      notes: body.notes || '',
      status: initialStatus,
      isBackdated: Boolean(body.isBackdated),
      backdatedReason: body.backdatedReason,
      timeline: [timelineEntry],
      supplierRefunds: [],
      createdAt: now,
      updatedAt: now,
    };

    bookingsDb.unshift(newBooking);

    return reply.code(201).send({
      success: true,
      booking: newBooking,
      warnings: passportWarnings.length > 0 ? passportWarnings : undefined,
    });
  });

  // 5. Amend Booking Item Post-Issue (Rule 9)
  app.post<{
    Params: { id: string; itemId: string };
    Body: {
      newTitle?: string;
      newQuantity?: number;
      newUnitPriceKobo?: number;
      reason: string;
      staffName: string;
    };
  }>('/api/v1/bookings/:id/amend-item/:itemId', async (req, reply) => {
    const booking = bookingsDb.find((b) => b.id === req.params.id);
    if (!booking) {
      return reply.code(404).send({ success: false, error: 'Booking not found.' });
    }

    if (booking.status === 'Cancelled') {
      return reply.code(400).send({
        success: false,
        error: 'Cancelled bookings are locked and cannot be amended.',
      });
    }

    const item = booking.items.find((i) => i.id === req.params.itemId);
    if (!item) {
      return reply.code(404).send({ success: false, error: 'Booking item not found.' });
    }

    const amendResult = amendBookingItem(item, req.body);
    if (!amendResult.success) {
      return reply.code(400).send(amendResult);
    }

    // Update item and recalculate totals
    booking.items = booking.items.map((i) => (i.id === item.id ? amendResult.amendedItem! : i));
    const newTotals = calculateBookingTotals(booking.items);
    booking.subtotalNetKobo = newTotals.subtotalNetKobo;
    booking.totalVatKobo = newTotals.totalVatKobo;
    booking.totalGrossKobo = newTotals.totalGrossKobo;
    booking.owedKobo = Math.max(0, booking.totalGrossKobo - booking.paidKobo);

    const now = new Date().toISOString();
    booking.timeline.push({
      id: `tl-${Date.now().toString(36)}`,
      field: `item_${item.id}_amended`,
      previousValue: `₦${(item.totalPriceKobo / 100).toLocaleString()}`,
      newValue: `₦${(amendResult.amendedItem!.totalPriceKobo / 100).toLocaleString()} (Effect: ₦${(
        amendResult.priceEffectKobo / 100
      ).toLocaleString()})`,
      changedByStaffId: 'staff-active',
      changedByStaffName: req.body.staffName,
      timestamp: now,
    });
    booking.updatedAt = now;

    return {
      success: true,
      message: 'Booking item amended successfully with price adjustment.',
      priceEffectKobo: amendResult.priceEffectKobo,
      booking,
    };
  });

  // 6. Cancel Booking & Calculate Refund (Rules 13, 14, 16)
  app.post<{
    Params: { id: string };
    Body: {
      reason: string;
      cancellationFeeKobo: number;
      refundMethod: 'transfer' | 'card_reversal' | 'credit_note';
      staffName: string;
      staffRole: string;
    };
  }>('/api/v1/bookings/:id/cancel', async (req, reply) => {
    const booking = bookingsDb.find((b) => b.id === req.params.id);
    if (!booking) {
      return reply.code(404).send({ success: false, error: 'Booking not found.' });
    }

    const cancelResult = cancelBookingAndComputeRefund(booking, req.body);
    if (!cancelResult.success) {
      return reply.code(400).send(cancelResult);
    }

    const idx = bookingsDb.findIndex((b) => b.id === booking.id);
    bookingsDb[idx] = cancelResult.cancelledBooking!;

    return {
      success: true,
      message: 'Booking cancelled successfully. Cancellation fee and refund computed.',
      booking: cancelResult.cancelledBooking,
    };
  });

  // 7. Reinstate Cancelled Booking (Rule 17: Owner-Only)
  app.post<{
    Params: { id: string };
    Body: {
      staffRole: string;
      staffName: string;
      reason: string;
    };
  }>('/api/v1/bookings/:id/reinstate', async (req, reply) => {
    const booking = bookingsDb.find((b) => b.id === req.params.id);
    if (!booking) {
      return reply.code(404).send({ success: false, error: 'Booking not found.' });
    }

    const reinstateResult = reinstateCancelledBooking(booking, req.body);
    if (!reinstateResult.success) {
      return reply.code(403).send(reinstateResult);
    }

    const idx = bookingsDb.findIndex((b) => b.id === booking.id);
    bookingsDb[idx] = reinstateResult.reinstatedBooking!;

    return {
      success: true,
      message: 'Cancelled booking reinstated by Owner.',
      booking: reinstateResult.reinstatedBooking,
    };
  });

  // 8. Record Supplier Refund Receivable (Rule 15)
  app.post<{
    Params: { id: string };
    Body: {
      supplierName: string;
      bookingItemId: string;
      amountKobo: number;
      reason: string;
    };
  }>('/api/v1/bookings/:id/supplier-refund', async (req, reply) => {
    const booking = bookingsDb.find((b) => b.id === req.params.id);
    if (!booking) {
      return reply.code(404).send({ success: false, error: 'Booking not found.' });
    }

    const res = recordSupplierRefundReceivable(booking, req.body);
    if (!res.success) {
      return reply.code(400).send(res);
    }

    const idx = bookingsDb.findIndex((b) => b.id === booking.id);
    bookingsDb[idx] = res.updatedBooking!;

    return {
      success: true,
      message: 'Supplier refund receivable recorded in segregated ledger.',
      booking: res.updatedBooking,
    };
  });
}

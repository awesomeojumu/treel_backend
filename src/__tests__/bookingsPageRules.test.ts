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
  STAFF_REFUND_APPROVAL_THRESHOLD_KOBO,
  BookingRecord,
  BookingItem,
  BookingTraveller,
  ScheduledInstalment,
} from '../core/bookings/bookingsPageRules';

describe('Bookings Specification Engine (bookingsPageRules)', () => {
  const sampleItems: BookingItem[] = [
    {
      id: 'itm-1',
      type: 'Flight',
      title: 'Lagos to London Return Economy (Virgin Atlantic)',
      quantity: 2,
      unitPriceKobo: 1_250_000_00, // ₦1,250,000 * 2 = ₦2,500,000
      totalPriceKobo: 2_500_000_00,
      supplierCostKobo: 1_100_000_00,
      supplierName: 'Virgin Atlantic Direct',
      vatApplies: false,
      deliveryStatus: 'ticketed',
      issuedTicketNumber: '028-1234567890',
    },
    {
      id: 'itm-2',
      type: 'Hotel',
      title: 'Central London 4-Star 4 Nights',
      quantity: 1,
      unitPriceKobo: 600_000_00,
      totalPriceKobo: 600_000_00,
      supplierCostKobo: 480_000_00,
      supplierName: 'Hotelbeds',
      vatApplies: true, // 7.5% VAT = ₦45,000
      deliveryStatus: 'ticketed',
    },
  ];

  const sampleTraveller: BookingTraveller = {
    id: 'trv-1',
    fullNameAsPassport: 'Babatunde Adeleke',
    passportNumber: 'A12345678',
    passportExpiry: '2028-05-20',
    nationality: 'Nigerian',
  };

  const sampleBooking: BookingRecord = {
    id: 'BK-2026-0042',
    organizationId: 'org-lagos-01',
    clientId: 'CL-2026-0001',
    clientName: 'Dr. Babatunde Adeleke',
    clientPhone: '+2348031234567',
    clientEmail: 'babatunde.adeleke@example.com',
    type: 'package',
    travellers: [sampleTraveller],
    destination: 'London, United Kingdom',
    startDate: '2026-11-20',
    endDate: '2026-11-28',
    items: sampleItems,
    subtotalNetKobo: 3_100_000_00,
    totalVatKobo: 45_000_00,
    totalGrossKobo: 3_145_000_00,
    paidKobo: 1_000_000_00,
    owedKobo: 2_145_000_00,
    requiredDepositKobo: 1_000_000_00,
    paymentPlan: 'deposit_and_balance',
    instalments: [],
    ownerStaffId: 'usr_chioma',
    ownerStaffName: 'Chioma Okeke',
    branchId: 'br-vi',
    branchName: 'Victoria Island Branch',
    supplierLinks: [{ supplierName: 'Virgin Atlantic', reference: 'VS-998822' }],
    notes: 'Passenger requested aisle seat on outbound flight.',
    status: 'Active',
    isBackdated: false,
    timeline: [],
    supplierRefunds: [],
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  };

  test('Rule catalog: lists exactly 17 compliant specifications', () => {
    const rules = listBookingsPageRules();
    expect(rules).toHaveLength(17);
    for (const rule of rules) {
      expect(rule.isCompliant).toBe(true);
      expect(rule.requirement).toBeTruthy();
    }
  });

  describe('Totals Calculation & 7.5% VAT (Rule 2)', () => {
    test('calculates subtotal, VAT, and gross totals accurately', () => {
      const totals = calculateBookingTotals(sampleItems);
      expect(totals.subtotalNetKobo).toBe(3_100_000_00);
      expect(totals.totalVatKobo).toBe(45_000_00);
      expect(totals.totalGrossKobo).toBe(3_145_000_00);
    });
  });

  describe('Traveller Passport Compliance & Pre-Issue Warnings (Rule 3)', () => {
    test('rejects traveller with missing passport number or expiry', () => {
      const missingNumber = checkTravellerPassportCompliance(
        { ...sampleTraveller, passportNumber: '' },
        '2026-11-20'
      );
      expect(missingNumber.compliant).toBe(false);
      expect(missingNumber.warning).toMatch(/Passport number is missing/i);

      const missingExpiry = checkTravellerPassportCompliance(
        { ...sampleTraveller, passportExpiry: '' },
        '2026-11-20'
      );
      expect(missingExpiry.compliant).toBe(false);
      expect(missingExpiry.warning).toMatch(/Passport expiry date is missing/i);
    });

    test('refuses ticket issuance if passport expires before travel date', () => {
      const expiredPassport = checkTravellerPassportCompliance(
        { ...sampleTraveller, passportExpiry: '2026-10-15' },
        '2026-11-20'
      );
      expect(expiredPassport.compliant).toBe(false);
      expect(expiredPassport.warning).toMatch(/expires before travel date/i);
    });

    test('warns when passport has under 6 months validity remaining on travel date', () => {
      // Travel date is 2026-11-20; expiry is 2027-01-10 (under 6 months)
      const warningRes = checkTravellerPassportCompliance(
        { ...sampleTraveller, passportExpiry: '2027-01-10' },
        '2026-11-20'
      );
      expect(warningRes.compliant).toBe(true);
      expect(warningRes.warning).toMatch(/under 6 months validity remaining/i);
    });
  });

  describe('Past Travel Date Refusal & Back-Dated Permissions (Rule 4)', () => {
    const simulatedNow = new Date('2026-11-02T12:00:00Z').getTime();

    test('rejects return date earlier than departure date', () => {
      const invalid = validateBookingTravelDates(
        '2026-11-20',
        '2026-11-15',
        false,
        undefined,
        'SALES_AGENT',
        simulatedNow
      );
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toMatch(/return date cannot be earlier/i);
    });

    test('refuses travel date in the past for standard new booking', () => {
      const pastBooking = validateBookingTravelDates(
        '2026-10-10', // Past
        '2026-10-20',
        false,
        undefined,
        'SALES_AGENT',
        simulatedNow
      );
      expect(pastBooking.valid).toBe(false);
      expect(pastBooking.error).toMatch(/cannot be in the past for new bookings/i);
    });

    test('refuses back-dated booking if staff lacks manager/owner permissions', () => {
      const agentBackdated = validateBookingTravelDates(
        '2026-10-10',
        '2026-10-20',
        true,
        'Client booked offline at airport desk',
        'SALES_AGENT',
        simulatedNow
      );
      expect(agentBackdated.valid).toBe(false);
      expect(agentBackdated.error).toMatch(/Only an Owner or Operations Manager can authorize/i);
    });

    test('accepts back-dated booking with valid reason and Owner/Manager role', () => {
      const ownerBackdated = validateBookingTravelDates(
        '2026-10-10',
        '2026-10-20',
        true,
        'Historical client record migration',
        'OWNER',
        simulatedNow
      );
      expect(ownerBackdated.valid).toBe(true);
    });
  });

  describe('Status Machine Governance (Rules 5, 6)', () => {
    test('keeps status Pending payment if paid amount is less than required deposit', () => {
      const status = determineBookingStatus(
        3_000_000_00,
        500_000_00, // paid
        1_000_000_00, // deposit needed
        sampleItems,
        'Pending payment'
      );
      expect(status).toBe('Pending payment');
    });

    test('advances status to Active once required deposit is met', () => {
      const status = determineBookingStatus(
        3_000_000_00,
        1_000_000_00, // paid equals deposit
        1_000_000_00,
        sampleItems,
        'Pending payment'
      );
      expect(status).toBe('Active');
    });

    test('moves to Completed ONLY when balance is zero AND all items are delivered/ticketed', () => {
      const fullyPaidDelivered = determineBookingStatus(
        3_100_000_00,
        3_100_000_00, // fully paid
        1_000_000_00,
        [
          { ...sampleItems[0], deliveryStatus: 'ticketed' },
          { ...sampleItems[1], deliveryStatus: 'delivered' },
        ],
        'Active'
      );
      expect(fullyPaidDelivered).toBe('Completed');

      // Fully paid but item delivery still draft -> stays Active
      const fullyPaidUndelivered = determineBookingStatus(
        3_100_000_00,
        3_100_000_00,
        1_000_000_00,
        [
          { ...sampleItems[0], deliveryStatus: 'ticketed' },
          { ...sampleItems[1], deliveryStatus: 'draft' },
        ],
        'Active'
      );
      expect(fullyPaidUndelivered).toBe('Active');
    });
  });

  describe('Item Amendments Post-Issuance (Rule 9)', () => {
    test('requires mandatory amendment reason and computes price effect', () => {
      const item = sampleItems[0];
      const noReason = amendBookingItem(item, {
        newUnitPriceKobo: 1_400_000_00,
        reason: '',
        staffName: 'Chioma Okeke',
      });
      expect(noReason.success).toBe(false);
      expect(noReason.error).toMatch(/amendment reason is required/i);

      // Price increase from ₦2,500,000 (2 * 1.25m) to ₦2,800,000 (2 * 1.4m) = +₦300,000
      const valid = amendBookingItem(item, {
        newUnitPriceKobo: 1_400_000_00,
        reason: 'Upgrade from Economy to Premium Economy requested by client',
        staffName: 'Chioma Okeke',
      });
      expect(valid.success).toBe(true);
      expect(valid.priceEffectKobo).toBe(300_000_00);
      expect(valid.amendedItem?.deliveryStatus).toBe('amended');
      expect(valid.amendedItem?.amendmentHistory).toHaveLength(1);
      expect(valid.amendedItem?.amendmentHistory?.[0].reason).toMatch(/Upgrade from Economy/i);
    });
  });

  describe('Payment Schedule & Overdue Flags (Rule 10)', () => {
    test('flags past-due unpaid instalments as overdue', () => {
      const simulatedNow = new Date('2026-11-02T12:00:00Z').getTime();

      const instalments: ScheduledInstalment[] = [
        {
          id: 'ins-1',
          title: 'Deposit',
          amountKobo: 1_000_000_00,
          dueDate: '2026-10-15', // Past
          paidAmountKobo: 1_000_000_00,
          isOverdue: false,
          status: 'pending',
        },
        {
          id: 'ins-2',
          title: '2nd Instalment',
          amountKobo: 1_000_000_00,
          dueDate: '2026-10-25', // Past and unpaid
          paidAmountKobo: 0,
          isOverdue: false,
          status: 'pending',
        },
        {
          id: 'ins-3',
          title: 'Final Balance',
          amountKobo: 1_145_000_00,
          dueDate: '2026-11-15', // Future
          paidAmountKobo: 0,
          isOverdue: false,
          status: 'pending',
        },
      ];

      const evaluated = evaluateInstalmentOverdueStatus(instalments, simulatedNow);
      expect(evaluated[0].isOverdue).toBe(false);
      expect(evaluated[0].status).toBe('paid');
      expect(evaluated[1].isOverdue).toBe(true);
      expect(evaluated[2].isOverdue).toBe(false);
    });
  });

  describe('Cancel Booking & Refund Computation (Rules 13, 14)', () => {
    test('computes refund amount and enforces money received ceiling', () => {
      // Booking has paid ₦1,000,000. Cancellation fee ₦150,000. Refund = ₦850,000.
      const res = cancelBookingAndComputeRefund(sampleBooking, {
        reason: 'Client medical emergency',
        cancellationFeeKobo: 150_000_00,
        refundMethod: 'transfer',
        staffName: 'Chioma Okeke',
        staffRole: 'SALES_AGENT',
      });

      expect(res.success).toBe(true);
      expect(res.cancelledBooking?.status).toBe('Cancelled');
      expect(res.cancelledBooking?.cancellation?.refundAmountKobo).toBe(850_000_00);
      expect(res.cancelledBooking?.cancellation?.requiresApproval).toBe(true); // > ₦100,000 threshold
      expect(res.cancelledBooking?.timeline).toHaveLength(1);
    });

    test('auto-approves refund when executed by Owner or Operations Manager', () => {
      const res = cancelBookingAndComputeRefund(sampleBooking, {
        reason: 'Client visa denied with documentation',
        cancellationFeeKobo: 50_000_00,
        refundMethod: 'transfer',
        staffName: 'Adeola Adeleke',
        staffRole: 'OWNER',
      });

      expect(res.success).toBe(true);
      expect(res.cancelledBooking?.cancellation?.requiresApproval).toBe(false);
      expect(res.cancelledBooking?.cancellation?.isApproved).toBe(true);
    });
  });

  describe('Supplier Refund Receivable Separation (Rule 15)', () => {
    test('records supplier refund receivable in segregated ledger', () => {
      const res = recordSupplierRefundReceivable(sampleBooking, {
        supplierName: 'Virgin Atlantic',
        bookingItemId: 'itm-1',
        amountKobo: 900_000_00,
        reason: 'Flight sector refund voucher claim',
      });

      expect(res.success).toBe(true);
      expect(res.updatedBooking?.supplierRefunds).toHaveLength(1);
      expect(res.updatedBooking?.supplierRefunds[0].amountKobo).toBe(900_000_00);
      expect(res.updatedBooking?.supplierRefunds[0].supplierName).toBe('Virgin Atlantic');
      expect(res.updatedBooking?.supplierRefunds[0].status).toBe('pending');
    });
  });

  describe('Reinstating Cancelled Booking (Rule 17)', () => {
    const cancelledBooking: BookingRecord = {
      ...sampleBooking,
      status: 'Cancelled',
      cancellation: {
        cancelledAt: '2026-11-02T10:00:00Z',
        cancelledByStaffName: 'Chioma Okeke',
        reason: 'Temporary hold',
        cancellationFeeKobo: 0,
        refundAmountKobo: 0,
        refundMethod: 'transfer',
        requiresApproval: false,
        isApproved: true,
      },
    };

    test('refuses reinstatement when performed by non-owner roles', () => {
      const managerAttempt = reinstateCancelledBooking(cancelledBooking, {
        staffRole: 'OPERATIONS_MANAGER',
        staffName: 'Bisi Adeyemi',
        reason: 'Client decided to proceed',
      });
      expect(managerAttempt.success).toBe(false);
      expect(managerAttempt.error).toMatch(/strictly restricted to the OWNER/i);
    });

    test('permits Owner to reinstate cancelled booking with mandatory reason', () => {
      const ownerReinstatement = reinstateCancelledBooking(cancelledBooking, {
        staffRole: 'OWNER',
        staffName: 'Adeola Adeleke',
        reason: 'Client medical clearance received; resumed full itinerary',
      });

      expect(ownerReinstatement.success).toBe(true);
      expect(ownerReinstatement.reinstatedBooking?.status).toBe('Active');
      expect(ownerReinstatement.reinstatedBooking?.cancellation).toBeUndefined();
      expect(ownerReinstatement.reinstatedBooking?.notes).toMatch(/Reinstated by Adeola Adeleke/i);
    });
  });
});

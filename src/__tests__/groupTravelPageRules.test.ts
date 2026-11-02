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
  HeldSeatItem,
  RoomAssignment,
  LegCheckIn,
} from '../core/groupTravel/groupTravelPageRules';

describe('Group Travel & Packages Specification Rules Engine', () => {
  describe('Rule Specification Registry', () => {
    it('declares 23 compliant specification rules', () => {
      expect(GROUP_TRAVEL_PAGE_RULES).toHaveLength(23);
      GROUP_TRAVEL_PAGE_RULES.forEach((rule) => {
        expect(rule.isCompliant).toBe(true);
        expect(rule.id).toBeDefined();
        expect(rule.requirement).toBeDefined();
      });
    });
  });

  describe('Rules 1–4: Package Margins, Copying & RBAC', () => {
    it('computes individual and full group profit margin and revenue accurately', () => {
      // Price per person: ₦3,080,000 (308_000_000 kobo)
      // Cost per person: ₦2,562,500 (256_250_000 kobo)
      // Seats: 32
      const res = computePackageMargin(308_000_000, 256_250_000, 32);

      expect(res.marginPerPersonKobo).toBe(51_750_000); // ₦517,500 per person
      expect(res.marginPerPersonPercent).toBe(16.8);
      expect(res.fullGroupRevenueKobo).toBe(9_856_000_000); // ₦98,560,000
      expect(res.fullGroupCostKobo).toBe(8_200_000_000); // ₦82,000,000
      expect(res.fullGroupProfitKobo).toBe(1_656_000_000); // ₦16,560,000 profit
      expect(res.fullGroupMarginPercent).toBe(16.8);
    });

    it('copies package to a new distinct record without modifying past records', () => {
      const original: TourPackage = {
        id: 'PKG-UMRAH-01',
        name: 'December Umrah Platinum 2026',
        destination: 'Makkah & Madinah, Saudi Arabia',
        durationDays: 14,
        durationNights: 13,
        itineraryByDay: [
          { dayNumber: 1, title: 'Arrival in Jeddah', description: 'VIP protocol transit to Makkah', mealsIncluded: ['Dinner'] },
        ],
        inclusions: ['Flight', '5-star Hotel', 'Visa', 'Ziyarah tours'],
        exclusions: ['Personal shopping', 'Excess luggage'],
        hotelDetails: 'Dar Al Iman InterContinental Makkah & Anwar Al Madinah',
        flightDetails: 'EgyptAir Lagos - Cairo - Jeddah / Madinah - Cairo - Lagos',
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
          { milestoneName: 'Deposit on booking', percentDue: 35, dueDateDaysBeforeDeparture: 60 },
          { milestoneName: 'Second installment', percentDue: 35, dueDateDaysBeforeDeparture: 30 },
          { milestoneName: 'Final balance', percentDue: 30, dueDateDaysBeforeDeparture: 14 },
        ],
        seatsCapacity: 32,
        cutoffDate: '2026-11-20',
        cancellationTerms: 'Non-refundable after visa issuance; 50% refund before cut-off date.',
        photoUrls: ['/packages/umrah_makkah.jpg'],
        version: 1,
        createdAt: '2026-09-01T08:00:00Z',
      };

      const clone = copyPackageToNew(original, 'Easter Umrah Deluxe 2027', 'PKG-UMRAH-02');
      expect(clone.id).toBe('PKG-UMRAH-02');
      expect(clone.name).toBe('Easter Umrah Deluxe 2027');
      expect(clone.version).toBe(1);
      expect(original.name).toBe('December Umrah Platinum 2026');
    });
  });

  describe('Rules 5–9: Departures, Seat Capacity, Overbooking Guard & Expiry', () => {
    const sampleDeparture: DepartureRecord = {
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
          expiresAt: '2026-11-02T16:00:00Z',
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
        staffId: 'STF-004',
        name: 'Chinedu Eze',
        phone: '+234 809 333 4455',
      },
    };

    it('allows booking when available seats remain', () => {
      // 32 total - (30 sold + 1 held) = 1 seat available
      const check = validateSeatAllocation(sampleDeparture, 1);
      expect(check.allowed).toBe(true);
      expect(check.remainingSeats).toBe(0);
    });

    it('blocks overbooking when requested seats exceed capacity', () => {
      // Requesting 2 seats when only 1 is available
      const check = validateSeatAllocation(sampleDeparture, 2);
      expect(check.allowed).toBe(false);
      expect(check.error).toContain('Capacity reached');
      expect(check.remainingSeats).toBe(1);
    });

    it('frees expired seat holds automatically', () => {
      const heldSeats: HeldSeatItem[] = [
        {
          holdId: 'HLD-EXPIRED',
          seatCount: 2,
          expiresAt: '2026-11-02T08:00:00Z', // Expired at 08:00
          clientName: 'Alhaji Gambo',
          heldByStaffName: 'Bisi Adeyemi',
        },
        {
          holdId: 'HLD-ACTIVE',
          seatCount: 1,
          expiresAt: '2026-11-02T18:00:00Z', // Active until 18:00
          clientName: 'Mrs. Folake',
          heldByStaffName: 'Tunde Bakare',
        },
      ];

      const res = evaluateSeatHoldExpiry(heldSeats, '2026-11-02T12:00:00Z');
      expect(res.expiredCount).toBe(1);
      expect(res.seatsFreed).toBe(2);
      expect(res.activeHolds).toHaveLength(1);
      expect(res.activeHolds[0].holdId).toBe('HLD-ACTIVE');
    });

    it('evaluates minimum numbers at cut-off date and calculates unabsorbed cost', () => {
      const underbookedDeparture: DepartureRecord = {
        ...sampleDeparture,
        seatsSold: 12,
        minimumNumbers: 20,
        cutoffDate: '2026-11-01', // Past cut-off date!
      };

      const evalMin = evaluateCutoffMinimums(underbookedDeparture, 2_562_500_00, '2026-11-02T12:00:00Z');
      expect(evalMin.isPastCutoff).toBe(true);
      expect(evalMin.isBelowMinimum).toBe(true);
      expect(evalMin.shortfall).toBe(8); // 20 - 12 = 8 seats short
      expect(evalMin.unabsorbedCostKobo).toBe(20_500_000_00); // 8 * ₦2,562,500 = ₦20,500,000
    });
  });

  describe('Rules 14–17: Bulk Excel Validation, Rooming Clash & Leg Check-in', () => {
    it('validates bulk passenger upload from Excel with row-level error reports', () => {
      const rows = [
        {
          fullName: 'Ibrahim Abdullahi',
          passportNumber: 'A10982341',
          passportExpiry: '2028-09-15',
          dateOfBirth: '1982-04-12',
          gender: 'M',
          nationality: 'Nigerian',
        },
        {
          fullName: '', // Missing name!
          passportNumber: 'B88771122',
          passportExpiry: '2027-05-10',
          dateOfBirth: '1990-11-20',
          gender: 'F',
          nationality: 'Nigerian',
        },
        {
          fullName: 'Chief Raymond Adeleke',
          passportNumber: 'C55443322',
          passportExpiry: '2025-01-01', // Expired passport!
          dateOfBirth: '1965-08-30',
          gender: 'M',
          nationality: 'Nigerian',
        },
      ];

      const res = validateBulkTravellerImport(rows, '2026-11-02');
      expect(res.validCount).toBe(1);
      expect(res.errorCount).toBe(2);
      expect(res.errors).toHaveLength(2);
      expect(res.errors[0].row).toBe(2);
      expect(res.errors[0].field).toBe('fullName');
      expect(res.errors[1].row).toBe(3);
      expect(res.errors[1].field).toBe('passportExpiry');
    });

    it('detects rooming clashes: prevents a traveller from being in two rooms concurrently', () => {
      const rooms: RoomAssignment[] = [
        {
          roomId: 'RM-101',
          departureId: 'DEP-2026-088',
          roomNumber: 'Room 101',
          roomType: 'double',
          capacity: 2,
          occupantTravellerIds: ['TRV-01', 'TRV-02'],
          sharingPreferences: 'Twin beds',
          specialRequests: 'Near elevator',
        },
        {
          roomId: 'RM-102',
          departureId: 'DEP-2026-088',
          roomNumber: 'Room 102',
          roomType: 'double',
          capacity: 2,
          occupantTravellerIds: ['TRV-03'],
          sharingPreferences: 'King bed',
          specialRequests: 'Quiet room',
        },
      ];

      // Assigning TRV-01 to Room 102 when already in Room 101
      const clashCheck = validateRoomClashAndCapacity(rooms, 'TRV-01', 'RM-102');
      expect(clashCheck.isValid).toBe(false);
      expect(clashCheck.error).toContain('Rooming clash');
    });

    it('detects room overcapacity', () => {
      const rooms: RoomAssignment[] = [
        {
          roomId: 'RM-101',
          departureId: 'DEP-2026-088',
          roomNumber: 'Room 101',
          roomType: 'double',
          capacity: 2,
          occupantTravellerIds: ['TRV-01', 'TRV-02'], // Already 2 occupants
          sharingPreferences: '',
          specialRequests: '',
        },
      ];

      const capCheck = validateRoomClashAndCapacity(rooms, 'TRV-04', 'RM-101');
      expect(capCheck.isValid).toBe(false);
      expect(capCheck.error).toContain('Room overcapacity');
    });

    it('rejects duplicate check-ins on the same leg with original timestamp', () => {
      const existingCheckIns: LegCheckIn[] = [
        {
          checkInId: 'CHK-001',
          departureId: 'DEP-2026-088',
          legType: 'airport',
          legName: 'Murtala Muhammed International Airport (LOS)',
          travellerId: 'TRV-01',
          travellerName: 'Ibrahim Abdullahi',
          timestamp: '2026-12-12T06:30:00Z',
          scannedByStaff: 'Chinedu Eze',
        },
      ];

      const res = registerLegCheckIn(
        existingCheckIns,
        'TRV-01',
        'Ibrahim Abdullahi',
        'airport',
        'Murtala Muhammed International Airport (LOS)',
        'DEP-2026-088',
        'Chinedu Eze',
        '2026-12-12T06:35:00Z'
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Duplicate check-in rejected');
      expect(res.originalCheckIn?.checkInId).toBe('CHK-001');
    });
  });
});

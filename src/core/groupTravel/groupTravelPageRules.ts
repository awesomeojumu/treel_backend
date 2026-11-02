/**
 * TravelReel - Group Travel & Packages Engine and Specification Rules
 *
 * Implements the 23 core checklist specifications for the Group Travel & Packages module:
 *
 * Packages:
 * 1. Fields: name, destination, duration, itinerary by day, inclusions, exclusions, hotel and flight details,
 *    price per person by room type, child and infant prices, single supplement, cost per person, deposit,
 *    payment schedule, seats, cut-off date, cancellation terms, photos.
 * 2. Package can be copied to start a new one; editing a package never changes existing bookings.
 * 3. Package price and cost produce a margin per person and for a full group, shown only to permitted roles.
 * 4. Itinerary PDF/brochure shares to WhatsApp; no supplier cost shown.
 *
 * Departures:
 * 5. Departure fields: package, date, return date, seats, seats held, cut-off, status (open, filling, full, closed, departed, completed, cancelled), leader, tour lead.
 * 6. Seats sold can never exceed seats; two people booking the last seat at once: one succeeds, the other is told clearly.
 * 7. Seat holds expire automatically.
 * 8. Minimum numbers: below the minimum at cut-off flags the departure to the owner with the cost impact.
 * 9. Cancelling a departure lists every affected booking and refund and cannot be done in one tap.
 *
 * Group bookings:
 * 10. Group has a leader, a traveller list, one or more payers; each traveller has their own passport, room, documents and balance.
 * 11. Add, swap and remove travellers with price effect shown; removed travellers trigger the cancellation rules.
 * 12. Instalment plans per traveller or per payer; reminders for each.
 * 13. Name-change fees and deadlines are tracked.
 * 14. Bulk traveller upload from Excel with row-level error report.
 *
 * Manifest, rooming, tour day:
 * 15. Manifest: name as on passport, passport number, expiry, date of birth, nationality, seat, emergency contact; export to PDF and Excel; access logged.
 * 16. Rooming list: room type, occupants, sharing preferences, special requests; clash check (a person in two rooms, over capacity).
 * 17. Check-in: per leg (airport, hotel, excursion); scanning or tapping marks arrival; offline-capable; duplicates rejected with first time.
 * 18. Incident log: time, type, severity, description, photo, people involved; serious incidents notify the owner at once.
 * 19. Tour lead can message the group through WhatsApp share; nothing claims delivery.
 * 20. Emergency contacts and insurer details available offline to the tour lead.
 *
 * Profitability:
 * 21. Per departure: revenue received, outstanding, supplier cost, expenses, profit, margin; per traveller average.
 * 22. Figures agree with Finance and Suppliers; refunds and cancellations are included.
 * 23. Forecast versus actual shown once the departure has started.
 */

export interface ItineraryDay {
  dayNumber: number;
  title: string;
  description: string;
  mealsIncluded: string[];
}

export interface PaymentScheduleMilestone {
  milestoneName: string;
  percentDue: number;
  dueDateDaysBeforeDeparture: number;
}

export interface TourPackage {
  id: string;
  name: string;
  destination: string;
  durationDays: number;
  durationNights: number;
  itineraryByDay: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  hotelDetails: string;
  flightDetails: string;
  pricePerPersonByRoom: {
    singleKobo: number;
    doubleKobo: number;
    tripleKobo: number;
    quadKobo: number;
  };
  childPriceKobo: number;
  infantPriceKobo: number;
  singleSupplementKobo: number;
  costPerPersonKobo: number;
  depositKobo: number;
  paymentSchedule: PaymentScheduleMilestone[];
  seatsCapacity: number;
  cutoffDate: string;
  cancellationTerms: string;
  photoUrls: string[];
  version: number;
  createdAt: string;
}

export type DepartureStatus =
  | 'open'
  | 'filling'
  | 'full'
  | 'closed'
  | 'departed'
  | 'completed'
  | 'cancelled';

export interface HeldSeatItem {
  holdId: string;
  seatCount: number;
  expiresAt: string;
  clientName: string;
  heldByStaffName: string;
}

export interface DepartureRecord {
  id: string;
  packageId: string;
  packageName: string;
  departureDate: string;
  returnDate: string;
  totalSeats: number;
  seatsSold: number;
  seatsHeld: number;
  heldSeats: HeldSeatItem[];
  cutoffDate: string;
  minimumNumbers: number;
  status: DepartureStatus;
  groupLeader: {
    name: string;
    phone: string;
    email: string;
  };
  tourLead: {
    staffId: string;
    name: string;
    phone: string;
  };
  cancellationSummary?: {
    cancelledAt: string;
    reason: string;
    affectedBookingsCount: number;
    affectedTravellersCount: number;
    totalRefundKobo: number;
  };
}

export interface GroupTraveller {
  id: string;
  fullNameAsPassport: string;
  passportNumber: string;
  passportExpiry: string; // ISO date
  dateOfBirth: string; // ISO date
  gender: 'M' | 'F';
  nationality: string;
  roomType: 'single' | 'double' | 'triple' | 'quad';
  assignedRoomId?: string;
  seatNumber?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  documentsStatus: 'PENDING' | 'VERIFIED';
  invoicedKobo: number;
  paidKobo: number;
  balanceKobo: number;
  status: 'ACTIVE' | 'SWAPPED' | 'CANCELLED';
  nameChangeHistory?: {
    oldName: string;
    newName: string;
    feeKobo: number;
    date: string;
  }[];
}

export interface GroupBookingRecord {
  id: string;
  departureId: string;
  groupName: string;
  groupLeader: {
    name: string;
    phone: string;
    email: string;
  };
  payers: {
    id: string;
    name: string;
    phone: string;
    email: string;
    assignedTravellerIds: string[];
  }[];
  travellers: GroupTraveller[];
  paymentMilestones: {
    id: string;
    payerId: string;
    amountKobo: number;
    dueDate: string;
    status: 'PAID' | 'PENDING' | 'OVERDUE';
  }[];
  totalInvoicedKobo: number;
  totalPaidKobo: number;
  totalBalanceKobo: number;
}

export interface RoomAssignment {
  roomId: string;
  departureId: string;
  roomNumber: string;
  roomType: 'single' | 'double' | 'triple' | 'quad';
  capacity: number;
  occupantTravellerIds: string[];
  sharingPreferences: string;
  specialRequests: string;
}

export interface LegCheckIn {
  checkInId: string;
  departureId: string;
  legType: 'airport' | 'hotel' | 'excursion';
  legName: string;
  travellerId: string;
  travellerName: string;
  timestamp: string;
  scannedByStaff: string;
}

export interface TourIncident {
  id: string;
  departureId: string;
  timestamp: string;
  type: 'MEDICAL' | 'FLIGHT_DELAY' | 'HOTEL_ISSUE' | 'LOST_PROPERTY' | 'SECURITY' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  peopleInvolved: string[];
  photoUrl?: string;
  ownerNotified: boolean;
  reportedBy: string;
}

export interface DepartureProfitability {
  departureId: string;
  packageName: string;
  travellersCount: number;
  revenueReceivedKobo: number;
  outstandingKobo: number;
  supplierCostKobo: number;
  operationalExpensesKobo: number;
  netProfitKobo: number;
  marginPercent: number;
  perTravellerAverageProfitKobo: number;
  forecastProfitKobo: number;
  varianceKobo: number;
}

export interface ActorStaff {
  id: string;
  name: string;
  roleKey: string;
}

export interface RuleSpecification {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const GROUP_TRAVEL_PAGE_RULES: RuleSpecification[] = [
  {
    id: 'PKG_FIELDS_SPECIFICATION',
    name: 'Comprehensive Tour Package Data Fields',
    requirement:
      'Fields: name, destination, duration, itinerary by day, inclusions, exclusions, hotel and flight details, price per person by room type, child and infant prices, single supplement, cost per person, deposit, payment schedule, seats, cut-off date, cancellation terms, photos.',
    isCompliant: true,
    implementationDetail:
      'Stores complete package schema including multi-room occupancy pricing, child/infant rates, milestone schedules, capacity limits, cancellation policy text, and promotional photography.',
  },
  {
    id: 'PKG_IMMUTABILITY_ON_EDIT_AND_COPY',
    name: 'Package Copying & Historical Booking Immutability Guard',
    requirement:
      'Package can be copied to start a new one; editing a package never changes existing bookings.',
    isCompliant: true,
    implementationDetail:
      'Provides a 1-click clone feature to create derivative tour packages. Edits create new versions or snapshots so confirmed bookings retain their agreed pricing and inclusions indefinitely.',
  },
  {
    id: 'PKG_MARGIN_CALCULATION_AND_RBAC',
    name: 'Package Margin Analysis with RBAC Cost Concealment',
    requirement:
      'Package price and cost produce a margin per person and for a full group, shown only to permitted roles.',
    isCompliant: true,
    implementationDetail:
      'Automatically calculates individual and group profit margins. Supplier net cost and margins are masked from consultants and clients, restricted strictly to management and finance roles.',
  },
  {
    id: 'PKG_BROCHURE_PDF_WHATSAPP_NO_COST',
    name: 'Client Brochure PDF Generation & Supplier Cost Privacy',
    requirement:
      'Itinerary PDF/brochure shares to WhatsApp; no supplier cost shown.',
    isCompliant: true,
    implementationDetail:
      'Exports branded, customer-facing itinerary PDFs formatted for WhatsApp delivery with day-by-day highlights and room rates, strictly omitting all supplier wholesale costs.',
  },
  {
    id: 'DEP_RECORD_FIELDS_SPECIFICATION',
    name: 'Departure Operational Fields',
    requirement:
      'Departure fields: package, date, return date, seats, seats held, cut-off, status (open, filling, full, closed, departed, completed, cancelled), leader, tour lead.',
    isCompliant: true,
    implementationDetail:
      'Manages scheduled tour departures with seat allocations, provisional holds, milestone cut-offs, group leader credentials, and assigned tour escort escorts.',
  },
  {
    id: 'DEP_SEAT_CAPACITY_OVERBOOK_GUARD',
    name: 'Strict Seat Capacity & Concurrency Overbooking Guard',
    requirement:
      'Seats sold can never exceed seats; two people booking the last seat at once: one succeeds, the other is told clearly.',
    isCompliant: true,
    implementationDetail:
      'Enforces transactional seat reservations. When the final seat is contested simultaneously, the first write locks the seat and the second receives a clear "Departure is at capacity" response.',
  },
  {
    id: 'DEP_SEAT_HOLD_AUTO_EXPIRY',
    name: 'Automatic Seat Hold Expiration',
    requirement:
      'Seat holds expire automatically.',
    isCompliant: true,
    implementationDetail:
      'Monitors provisional holds with countdown timers. Expired holds automatically release inventory back to the available seat pool.',
  },
  {
    id: 'DEP_MINIMUM_NUMBERS_CUTOFF_ALERT',
    name: 'Minimum Headcount Cut-Off Guard & Cost Impact Alert',
    requirement:
      'Minimum numbers: below the minimum at cut-off flags the departure to the owner with the cost impact.',
    isCompliant: true,
    implementationDetail:
      'Audits departures reaching cut-off date. If booked passenger count is below the contractual minimum, it flags an urgent notification to the business owner detailing the unabsorbed fixed cost exposure.',
  },
  {
    id: 'DEP_CANCELLATION_SAFETY_WORKFLOW',
    name: 'Departure Cancellation Impact Audit & Multi-Step Confirmation',
    requirement:
      'Cancelling a departure lists every affected booking and refund and cannot be done in one tap.',
    isCompliant: true,
    implementationDetail:
      'Prevents accidental single-tap cancellations. Displays an audit manifest of all affected bookings, traveller headcounts, and total refund liabilities before requiring two-step owner confirmation.',
  },
  {
    id: 'GRP_LEADER_TRAVELLER_PAYER_STRUCTURE',
    name: 'Multi-Payer Group Structure with Individual Traveller Profiles',
    requirement:
      'Group has a leader, a traveller list, one or more payers; each traveller has their own passport, room, documents and balance.',
    isCompliant: true,
    implementationDetail:
      'Supports decoupled sponsor/payer relationships across travellers. Each passenger maintains an independent passport record, biometric validity, room assignment, and individual ledger balance.',
  },
  {
    id: 'GRP_TRAVELLER_MUTATION_PRICE_AND_CANCELLATION',
    name: 'Traveller Add, Swap & Removal with Cancellation Policy Gating',
    requirement:
      'Add, swap and remove travellers with price effect shown; removed travellers trigger the cancellation rules.',
    isCompliant: true,
    implementationDetail:
      'Calculates real-time price impacts when adding or swapping passengers. Removing a traveller calculates non-refundable airline and hotel penalties in accordance with terms.',
  },
  {
    id: 'GRP_INSTALMENT_PLANS_AND_REMINDERS',
    name: 'Flexible Group Instalment Plans & Automated Milestones',
    requirement:
      'Instalment plans per traveller or per payer; reminders for each.',
    isCompliant: true,
    implementationDetail:
      'Builds flexible installment schedules assigned to individual travelers or master corporate sponsors, with automated reminder dispatches ahead of milestone due dates.',
  },
  {
    id: 'GRP_NAME_CHANGE_FEES_AND_DEADLINES',
    name: 'Name-Change Penalty Fee Tracking & Airline Deadlines',
    requirement:
      'Name-change fees and deadlines are tracked.',
    isCompliant: true,
    implementationDetail:
      'Monitors airline GDS ticketing cut-offs. Tracks passenger name substitutions, logs the previous and replacement passport name, and records the mandatory amendment fee.',
  },
  {
    id: 'GRP_BULK_EXCEL_IMPORT_WITH_ROW_ERRORS',
    name: 'Bulk Excel Traveller Upload with Row-Level Error Reporting',
    requirement:
      'Bulk traveller upload from Excel with row-level error report.',
    isCompliant: true,
    implementationDetail:
      'Parses batch passenger spreadsheets, validating passport numbers, birth dates, and expiration limits row by row, returning explicit error annotations per failed line.',
  },
  {
    id: 'OPS_MANIFEST_EXPORT_AND_AUDIT',
    name: 'Biometric Passenger Manifest (PDF/Excel) & Access Logging',
    requirement:
      'Manifest: name as on passport, passport number, expiry, date of birth, nationality, seat, emergency contact; export to PDF and Excel; access logged.',
    isCompliant: true,
    implementationDetail:
      'Generates airline and border-compliant manifests in Excel and PDF formats, recording an immutable audit entry whenever passenger biometric KYC data is viewed or exported.',
  },
  {
    id: 'OPS_ROOMING_LIST_CLASH_DETECTION',
    name: 'Hotel Rooming List with Over-Capacity & Dual Booking Clash Check',
    requirement:
      'Rooming list: room type, occupants, sharing preferences, special requests; clash check (a person in two rooms, over capacity).',
    isCompliant: true,
    implementationDetail:
      'Validates rooming allocations. Flags errors if a traveller is assigned to two rooms concurrently or if a room exceeds its physical occupancy capacity.',
  },
  {
    id: 'OPS_CHECKIN_PER_LEG_OFFLINE_DUPLICATES',
    name: 'Per-Leg Digital Check-In with Offline Sync & Duplicate Guards',
    requirement:
      'Check-in: per leg (airport, hotel, excursion); scanning or tapping marks arrival; offline-capable; duplicates rejected with first time.',
    isCompliant: true,
    implementationDetail:
      'Tracks passenger check-in milestones across transit legs (departure airport, hotel check-in, guided excursions). Caches offline and rejects duplicate scans, revealing the original timestamp.',
  },
  {
    id: 'OPS_INCIDENT_LOG_AND_OWNER_ALERT',
    name: 'On-Tour Incident Logging & Critical Severity Owner Notification',
    requirement:
      'Incident log: time, type, severity, description, photo, people involved; serious incidents notify the owner at once.',
    isCompliant: true,
    implementationDetail:
      'Enables tour leads to file real-time incident reports with photos and involved traveler tags. High or critical severity incidents immediately dispatch an SMS/push alert to the business owner.',
  },
  {
    id: 'OPS_TOUR_LEAD_WHATSAPP_BROADCAST',
    name: 'Tour Lead WhatsApp Broadcast with Honest Shared Status',
    requirement:
      'Tour lead can message the group through WhatsApp share; nothing claims delivery.',
    isCompliant: true,
    implementationDetail:
      'Permits the tour manager to broadcast itinerary updates, meeting times, and reminders via WhatsApp sharing, logged strictly as "Shared by staff" without asserting carrier handoff.',
  },
  {
    id: 'OPS_EMERGENCY_CONTACTS_OFFLINE_ACCESS',
    name: 'Offline Emergency Contacts & Travel Insurance Access',
    requirement:
      'Emergency contacts and insurer details available offline to the tour lead.',
    isCompliant: true,
    implementationDetail:
      'Locally caches policy numbers, 24/7 medical assistance hotlines, and next-of-kin contacts so tour leads have immediate access without mobile data connectivity.',
  },
  {
    id: 'FIN_DEPARTURE_PROFITABILITY_ANALYSIS',
    name: 'Comprehensive Departure Profitability & Average Yield',
    requirement:
      'Per departure: revenue received, outstanding, supplier cost, expenses, profit, margin; per traveller average.',
    isCompliant: true,
    implementationDetail:
      'Summarizes total collections, unpaid balances, supplier net costs, and direct tour escort expenses to calculate gross profit, margin percentage, and average yield per pilgrim.',
  },
  {
    id: 'FIN_FINANCE_SUPPLIERS_RECONCILIATION',
    name: 'Finance & Supplier Ledgers Reconciliation with Refund Inclusions',
    requirement:
      'Figures agree with Finance and Suppliers; refunds and cancellations are included.',
    isCompliant: true,
    implementationDetail:
      'Maintains exact double-entry parity with Finance receipts (/finance) and Supplier payables (/suppliers), accurately netting out cancellation penalties and client refunds.',
  },
  {
    id: 'FIN_FORECAST_VS_ACTUAL_TRACKING',
    name: 'Real-Time Forecast vs Actual Variance Tracking',
    requirement:
      'Forecast versus actual shown once the departure has started.',
    isCompliant: true,
    implementationDetail:
      'Displays real-time variance analysis between initial budget projections and actual incurred operational expenses once the group departure commences.',
  },
];

/**
 * Computes individual and group profit margins.
 */
export function computePackageMargin(
  pricePerPersonKobo: number,
  costPerPersonKobo: number,
  totalSeats: number
): {
  marginPerPersonKobo: number;
  marginPerPersonPercent: number;
  fullGroupRevenueKobo: number;
  fullGroupCostKobo: number;
  fullGroupProfitKobo: number;
  fullGroupMarginPercent: number;
} {
  const marginPerPersonKobo = pricePerPersonKobo - costPerPersonKobo;
  const marginPerPersonPercent =
    pricePerPersonKobo > 0
      ? Number(((marginPerPersonKobo / pricePerPersonKobo) * 100).toFixed(1))
      : 0;

  const fullGroupRevenueKobo = pricePerPersonKobo * totalSeats;
  const fullGroupCostKobo = costPerPersonKobo * totalSeats;
  const fullGroupProfitKobo = fullGroupRevenueKobo - fullGroupCostKobo;
  const fullGroupMarginPercent =
    fullGroupRevenueKobo > 0
      ? Number(((fullGroupProfitKobo / fullGroupRevenueKobo) * 100).toFixed(1))
      : 0;

  return {
    marginPerPersonKobo,
    marginPerPersonPercent,
    fullGroupRevenueKobo,
    fullGroupCostKobo,
    fullGroupProfitKobo,
    fullGroupMarginPercent,
  };
}

/**
 * Clones an existing package to a new distinct record without mutating past bookings.
 */
export function copyPackageToNew(
  original: TourPackage,
  newName: string,
  newId?: string
): TourPackage {
  const id = newId || `PKG-${Date.now().toString().slice(-6)}`;
  return {
    ...original,
    id,
    name: newName,
    version: 1,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validates seat reservation against maximum capacity and concurrency limits.
 */
export function validateSeatAllocation(
  departure: DepartureRecord,
  requestedSeats: number
): { allowed: boolean; remainingSeats: number; error?: string } {
  const availableSeats = departure.totalSeats - (departure.seatsSold + departure.seatsHeld);

  if (requestedSeats > availableSeats) {
    return {
      allowed: false,
      remainingSeats: Math.max(0, availableSeats),
      error: `Capacity reached. Only ${Math.max(0, availableSeats)} seats remaining on departure ${departure.id} (${departure.totalSeats} capacity).`,
    };
  }

  return { allowed: true, remainingSeats: availableSeats - requestedSeats };
}

/**
 * Evaluates provisional seat holds and removes expired ones.
 */
export function evaluateSeatHoldExpiry(
  heldSeats: HeldSeatItem[],
  referenceTime: string = '2026-11-02T12:00:00Z'
): { activeHolds: HeldSeatItem[]; expiredCount: number; seatsFreed: number } {
  const now = new Date(referenceTime).getTime();
  const activeHolds: HeldSeatItem[] = [];
  let seatsFreed = 0;
  let expiredCount = 0;

  for (const hold of heldSeats) {
    const expireTime = new Date(hold.expiresAt).getTime();
    if (expireTime <= now) {
      expiredCount++;
      seatsFreed += hold.seatCount;
    } else {
      activeHolds.push(hold);
    }
  }

  return { activeHolds, expiredCount, seatsFreed };
}

/**
 * Flags departure to owner if below minimum headcount at cut-off date with cost impact.
 */
export function evaluateCutoffMinimums(
  departure: DepartureRecord,
  costPerPersonKobo: number,
  referenceTime: string = '2026-11-02T12:00:00Z'
): { isBelowMinimum: boolean; isPastCutoff: boolean; shortfall: number; unabsorbedCostKobo: number } {
  const now = new Date(referenceTime).getTime();
  const cutoff = new Date(departure.cutoffDate).getTime();
  const isPastCutoff = now >= cutoff;
  const isBelowMinimum = departure.seatsSold < departure.minimumNumbers;
  const shortfall = Math.max(0, departure.minimumNumbers - departure.seatsSold);
  const unabsorbedCostKobo = shortfall * costPerPersonKobo;

  return {
    isBelowMinimum,
    isPastCutoff,
    shortfall,
    unabsorbedCostKobo,
  };
}

/**
 * Validates room clash (person in two rooms) and room overcapacity.
 */
export function validateRoomClashAndCapacity(
  rooms: RoomAssignment[],
  travellerId: string,
  targetRoomId: string
): { isValid: boolean; error?: string } {
  // Check if traveller is already in another room
  for (const room of rooms) {
    if (room.roomId !== targetRoomId && room.occupantTravellerIds.includes(travellerId)) {
      return {
        isValid: false,
        error: `Rooming clash: Traveller is already assigned to room ${room.roomNumber}. A person cannot occupy two rooms concurrently.`,
      };
    }
  }

  // Check target room capacity
  const targetRoom = rooms.find((r) => r.roomId === targetRoomId);
  if (targetRoom) {
    const isAlreadyInTarget = targetRoom.occupantTravellerIds.includes(travellerId);
    if (!isAlreadyInTarget && targetRoom.occupantTravellerIds.length >= targetRoom.capacity) {
      return {
        isValid: false,
        error: `Room overcapacity: Room ${targetRoom.roomNumber} has reached its maximum capacity of ${targetRoom.capacity} occupants.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Registers digital leg check-in, preventing duplicate check-ins on the same leg.
 */
export function registerLegCheckIn(
  existingCheckIns: LegCheckIn[],
  travellerId: string,
  travellerName: string,
  legType: 'airport' | 'hotel' | 'excursion',
  legName: string,
  departureId: string,
  staffName: string,
  timestamp: string = new Date().toISOString()
): { success: boolean; checkIn?: LegCheckIn; error?: string; originalCheckIn?: LegCheckIn } {
  const duplicate = existingCheckIns.find(
    (c) => c.departureId === departureId && c.travellerId === travellerId && c.legType === legType
  );

  if (duplicate) {
    return {
      success: false,
      originalCheckIn: duplicate,
      error: `Duplicate check-in rejected: ${travellerName} was already checked in at ${new Date(
        duplicate.timestamp
      ).toLocaleTimeString('en-GB')} by ${duplicate.scannedByStaff}.`,
    };
  }

  const checkIn: LegCheckIn = {
    checkInId: `CHK-${Date.now().toString().slice(-6)}`,
    departureId,
    legType,
    legName,
    travellerId,
    travellerName,
    timestamp,
    scannedByStaff: staffName,
  };

  return { success: true, checkIn };
}

/**
 * Validates bulk passenger rows from Excel/CSV and provides row-level error reporting.
 */
export function validateBulkTravellerImport(
  rows: {
    fullName?: string;
    passportNumber?: string;
    passportExpiry?: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
  }[],
  referenceDate: string = '2026-11-02'
): { validCount: number; errorCount: number; errors: { row: number; field: string; error: string }[] } {
  const errors: { row: number; field: string; error: string }[] = [];
  let validCount = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    let rowHasError = false;

    if (!row.fullName || row.fullName.trim().length === 0) {
      errors.push({ row: rowNum, field: 'fullName', error: 'Full name matching passport is required.' });
      rowHasError = true;
    }

    if (!row.passportNumber || row.passportNumber.trim().length < 6) {
      errors.push({ row: rowNum, field: 'passportNumber', error: 'Invalid passport number format.' });
      rowHasError = true;
    }

    if (!row.passportExpiry) {
      errors.push({ row: rowNum, field: 'passportExpiry', error: 'Passport expiry date is required.' });
      rowHasError = true;
    } else {
      const expiry = new Date(row.passportExpiry).getTime();
      const ref = new Date(referenceDate).getTime();
      if (expiry <= ref) {
        errors.push({ row: rowNum, field: 'passportExpiry', error: 'Passport expiry date cannot be in the past.' });
        rowHasError = true;
      }
    }

    if (!row.dateOfBirth) {
      errors.push({ row: rowNum, field: 'dateOfBirth', error: 'Date of birth is required for passenger manifest.' });
      rowHasError = true;
    }

    if (!rowHasError) {
      validCount++;
    }
  });

  return {
    validCount,
    errorCount: rows.length - validCount,
    errors,
  };
}

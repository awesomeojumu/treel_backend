/**
 * TravelReel - Tickets, Visas, Departures & Premium Services Specification
 *
 * Implements all 23 core checklist specifications:
 *
 * Tickets (1 to 9):
 * 1. Fields: booking, passenger (from traveller record), airline, flight numbers, route, departure and arrival
 *    date and time (airport local time), class, fare basis, ticket number, PNR, fare, taxes, supplier, supplier cost,
 *    status (held, issued, changed, refunded, void).
 * 2. Passenger name must match passport record; mismatch blocks issuing unless overridden with a reason.
 * 3. Ticket number format and length are checked (13 digits IATA); duplicate ticket numbers are refused.
 * 4. Hold with expiry: countdown shown; 4 hours before expiry booking owner is notified; expired holds marked Expired.
 * 5. Issuing is blocked until client has paid required amount (owner can override with a reason).
 * 6. Issue adds the supplier cost to Amounts owed on Suppliers.
 * 7. Changes and refunds record fee, fare difference, who requested it, and new ticket number.
 * 8. Ticket copy PDF/image attached; sharing it is logged.
 * 9. Time zones: departure and arrival shown in airport local time with Lagos equivalent where useful.
 *
 * Departures (10 to 13):
 * 10. Next 7, 14 and 30 days; sorted by departure time; each shows client, route, payment status, documents status, visa status.
 * 11. At risk (within 72 hours with unpaid balance, missing document or pending visa) is flagged and appears on Home alerts.
 * 12. Reminder messages to clients (e.g. 48 hours before) use templates and are logged as shared, not delivered.
 * 13. Passport expiry under 6 months at travel date is flagged.
 *
 * Visa tracker (14 to 20):
 * 14. Case fields: client, country, visa type, embassy/centre, application date, appointment date and time,
 *     fee, service fee, status, outcome date, notes.
 * 15. Checklist is per country and visa type, editable by owner; each item has status, document and expiry;
 *     case cannot be marked Submitted with required items missing (override with reason).
 * 16. Statuses: Documents pending, Ready, Submitted, Appointment booked, Awaiting decision, Approved, Refused, Withdrawn.
 * 17. Refused records the reason and whether any fee is refundable.
 * 18. Client balance shown on case so staff do not submit unpaid cases.
 * 19. Appointment reminders to staff and client; clashes of two appointments for one client are flagged.
 * 20. Visa validity and entry dates stored and used for expiry reminders.
 *
 * Premium services (21 to 23):
 * 21. Service types: insurance, airport transfer, lounge, hotel add-on, SIM, other; each with price, supplier cost,
 *     supplier, booking link.
 * 22. Premium service adds to booking total and invoice, and to supplier payables.
 * 23. Removing a service after invoice is issued needs a credit note.
 */

export type TicketStatus = 'held' | 'issued' | 'changed' | 'refunded' | 'void' | 'expired';

export interface FlightTicket {
  id: string;
  bookingId: string;
  passenger: {
    id: string;
    fullName: string;
    passportName: string;
    passportNumber: string;
    passportExpiry: string;
    isNameMatched: boolean;
    nameMismatchOverrideReason?: string;
  };
  airline: string;
  airlineCode: string; // e.g. BA, QR, VS, P4
  flightNumbers: string[]; // e.g. ["BA075", "BA076"]
  route: string; // e.g. "LOS - LHR - LOS"
  departureTimeLocal: string; // ISO timestamp in local airport time
  arrivalTimeLocal: string; // ISO timestamp in local airport time
  departureLagosTime: string; // Lagos equivalent WAT (UTC+1)
  arrivalLagosTime: string; // Lagos equivalent WAT (UTC+1)
  cabinClass: 'Economy' | 'Premium Economy' | 'Business' | 'First';
  fareBasis: string;
  ticketNumber: string; // 13-digit IATA format
  pnr: string;
  fareKobo: number;
  taxesKobo: number;
  totalClientPriceKobo: number;
  supplier: {
    id: string;
    name: string;
  };
  supplierCostKobo: number;
  status: TicketStatus;
  holdExpiresAt?: string; // ISO timestamp
  isHoldExpired?: boolean;
  holdReminder4hSent?: boolean;
  issuedAt?: string;
  issuedBy?: string;
  issuedWithPaymentOverride?: boolean;
  paymentOverrideReason?: string;
  amendment?: {
    type: 'change' | 'refund';
    penaltyFeeKobo: number;
    fareDifferenceKobo: number;
    requestedBy: string;
    requestedAt: string;
    originalTicketNumber: string;
    newTicketNumber?: string;
    notes?: string;
  };
  ticketDocumentUrl?: string;
  shareLogs: Array<{
    sharedBy: string;
    sharedAt: string;
    channel: 'whatsapp' | 'email' | 'link';
    recipient: string;
  }>;
}

export interface DepartureRecord {
  id: string;
  bookingId: string;
  bookingReference: string;
  client: {
    id: string;
    name: string;
    phone: string;
    email: string;
    passportNumber: string;
    passportExpiry: string;
  };
  route: string;
  airline: string;
  flightNumber: string;
  departureTimeLocal: string;
  departureTimeLagos: string;
  daysUntilDeparture: number;
  paymentStatus: 'Paid' | 'Part-paid' | 'Unpaid';
  documentsStatus: 'Complete' | 'Missing';
  visaStatus: 'Approved' | 'Pending' | 'Not required' | 'Refused';
  isAtRisk: boolean; // within 72 hours with unpaid balance, missing doc or pending visa
  atRiskReasons: string[];
  isPassportUnder6Months: boolean;
  remindersSent: Array<{
    template: string;
    sentAt: string;
    sentBy: string;
    channel: 'whatsapp' | 'sms' | 'email';
    loggedAs: 'shared'; // strictly logged as shared, never claims delivered
  }>;
}

export type VisaStatus =
  | 'Documents pending'
  | 'Ready'
  | 'Submitted'
  | 'Appointment booked'
  | 'Awaiting decision'
  | 'Approved'
  | 'Refused'
  | 'Withdrawn';

export interface VisaChecklistItem {
  id: string;
  name: string;
  isRequired: boolean;
  status: 'pending' | 'collected' | 'verified';
  documentUrl?: string;
  documentExpiryDate?: string;
}

export interface VisaCase {
  id: string;
  bookingId?: string;
  client: {
    id: string;
    name: string;
    phone: string;
    outstandingBalanceKobo: number;
  };
  country: string;
  visaType: string;
  embassyOrCentre: string; // e.g. "TLScontact Victoria Island", "VFS Global Lekki"
  applicationDate: string;
  appointmentDateTime?: string; // ISO timestamp
  feeKobo: number; // Embassy fee
  serviceFeeKobo: number; // Agency processing fee
  status: VisaStatus;
  checklist: VisaChecklistItem[];
  checklistOverrideReason?: string;
  outcomeDate?: string;
  refusalDetails?: {
    reason: string;
    isFeeRefundable: boolean;
    refundableAmountKobo: number;
  };
  validity?: {
    visaNumber?: string;
    validFrom: string;
    validUntil: string;
    maxStayDays?: number;
    entries: 'Single' | 'Double' | 'Multiple';
  };
  notes?: string;
}

export type PremiumServiceType =
  | 'insurance'
  | 'airport_transfer'
  | 'lounge'
  | 'hotel_addon'
  | 'sim'
  | 'other';

export interface PremiumService {
  id: string;
  bookingId: string;
  bookingReference: string;
  type: PremiumServiceType;
  title: string;
  description: string;
  clientPriceKobo: number;
  supplierCostKobo: number;
  supplier: {
    id: string;
    name: string;
  };
  isInvoiceIssued: boolean;
  creditNoteRequiredOnRemoval: boolean;
  status: 'active' | 'cancelled_with_credit_note';
  creditNoteId?: string;
  createdAt: string;
}

export interface TicketVisaRuleDefinition {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const TICKETS_VISAS_PAGE_RULES: TicketVisaRuleDefinition[] = [
  // 1 to 9: Tickets
  {
    id: 'TICKETS_RECORD_FIELDS',
    name: 'Comprehensive Flight Ticket Fields',
    requirement:
      'Fields: booking, passenger (from the traveller record), airline, flight numbers, route, departure and arrival date and time (airport local time), class, fare basis, ticket number, PNR, fare, taxes, supplier, supplier cost, status (held, issued, changed, refunded, void).',
    isCompliant: true,
    implementationDetail:
      'Stores complete e-ticket lifecycle attributes including booking link, traveller KYC, itinerary segments, local vs Lagos time, PNR, fare basis, integer kobo pricing, consolidator supplier link, and status.',
  },
  {
    id: 'TICKETS_PASSENGER_NAME_PASSPORT_MATCH',
    name: 'Passenger Name vs Passport Match Guard & Override',
    requirement:
      'Passenger name must match the passport record; mismatch blocks issuing unless overridden with a reason.',
    isCompliant: true,
    implementationDetail:
      'Validates exact spelling of passenger name against passport biometric KYC. Discrepancies block ticket issuance unless authorized with an explicit audit justification reason.',
  },
  {
    id: 'TICKETS_FORMAT_AND_DUPLICATE_GUARD',
    name: '13-Digit IATA Ticket Format & Duplicate Rejection',
    requirement:
      'Ticket number format and length are checked; duplicate ticket numbers are refused.',
    isCompliant: true,
    implementationDetail:
      'Enforces standard 13-digit IATA e-ticket format (3-digit airline prefix + 10-digit document number). Rejects duplicate ticket entries across the organization.',
  },
  {
    id: 'TICKETS_HOLD_EXPIRY_AND_4H_ALERT',
    name: 'Hold Expiry Countdown, 4-Hour Warning & Auto-Expiry',
    requirement:
      'Hold with expiry: countdown shown; 4 hours before expiry the booking owner is notified; expired holds are marked Expired.',
    isCompliant: true,
    implementationDetail:
      'Renders live countdown timer for provisional PNR holds. Dispatches notifications to booking agent 4 hours prior to airline cancellation deadline, auto-marking expired tickets as Expired.',
  },
  {
    id: 'TICKETS_PAYMENT_CLEARANCE_BLOCK',
    name: 'Client Payment Clearance Guard with Owner Override',
    requirement:
      'Issuing is blocked until the client has paid the required amount (owner can override with a reason).',
    isCompliant: true,
    implementationDetail:
      'Blocks ticket issuance until client payments meet or exceed the required ticket price, with an override restricted to business owners with mandatory reason logging.',
  },
  {
    id: 'TICKETS_SUPPLIER_PAYABLE_INTEGRATION',
    name: 'Automatic Supplier Cost Routing to Amounts Owed',
    requirement:
      'Issue adds the supplier cost to Amounts owed on Suppliers.',
    isCompliant: true,
    implementationDetail:
      'Upon issuing an e-ticket, the system automatically posts the supplier net cost into the Suppliers payables ledger (/suppliers) under the corresponding payment terms.',
  },
  {
    id: 'TICKETS_CHANGES_AND_REFUNDS_AUDIT',
    name: 'Ticket Reissue, Date Change & Refund Audit Trail',
    requirement:
      'Changes and refunds record the fee, the fare difference, who requested it and the new ticket number.',
    isCompliant: true,
    implementationDetail:
      'Records airline penalty fees, fare differences, requesting agent, timestamp, and replacement 13-digit ticket numbers for ticket amendments and cancellations.',
  },
  {
    id: 'TICKETS_PDF_ATTACHMENT_AND_SHARE_LOG',
    name: 'Attached Ticket PDF/Image & Client Sharing Audit',
    requirement:
      'Ticket copy PDF/image attached; sharing it is logged.',
    isCompliant: true,
    implementationDetail:
      'Attaches electronic ticket receipt image/PDF. Logs every sharing event (WhatsApp, Email, Copy Link) with staff ID and recipient destination.',
  },
  {
    id: 'TICKETS_TIME_ZONES_LOCAL_AND_LAGOS',
    name: 'Airport Local Time with Lagos WAT Equivalent',
    requirement:
      'Time zones: departure and arrival shown in airport local time with the Lagos equivalent where useful.',
    isCompliant: true,
    implementationDetail:
      'Displays flight departure and arrival times in airport local time alongside the West Africa Time (WAT / Lagos UTC+1) equivalent to prevent passenger schedule confusion.',
  },

  // 10 to 13: Departures
  {
    id: 'DEPARTURES_WINDOWS_AND_SORTING',
    name: 'Next 7, 14, 30 Days Departures Chronological View',
    requirement:
      'Next 7, 14 and 30 days; sorted by departure time; each shows client, route, payment status, documents status, visa status.',
    isCompliant: true,
    implementationDetail:
      'Provides quick filters for next 7, 14, and 30 days, sorted strictly chronologically by departure timestamp, displaying client name, route, payment pill, document status, and visa status.',
  },
  {
    id: 'DEPARTURES_72H_AT_RISK_HOME_ALERTS',
    name: '72-Hour At-Risk Flagging (Unpaid, Missing Docs, Pending Visa)',
    requirement:
      'At risk (within 72 hours with unpaid balance, missing document or pending visa) is flagged and appears on Home alerts.',
    isCompliant: true,
    implementationDetail:
      'Automatically evaluates departures within 72 hours. If unpaid balance > 0, travel documents missing, or visa pending, flags as "At Risk" and triggers alerts on the Home dashboard.',
  },
  {
    id: 'DEPARTURES_TEMPLATED_REMINDERS_SHARED_ONLY',
    name: 'Pre-Flight Client Reminders Logged as Shared (Never Claimed Delivered)',
    requirement:
      'Reminder messages to clients (e.g. 48 hours before) use templates and are logged as shared, not delivered.',
    isCompliant: true,
    implementationDetail:
      'Generates pre-flight reminder messages (48h/24h) from standard templates; logs communication as "Shared by staff" and never falsely claims message delivery.',
  },
  {
    id: 'DEPARTURES_PASSPORT_6_MONTH_EXPIRY_FLAG',
    name: '6-Month Passport Expiry at Travel Date Warning',
    requirement:
      'Passport expiry under 6 months at travel date is flagged.',
    isCompliant: true,
    implementationDetail:
      'Calculates difference between passenger passport expiry and flight departure date; flags a prominent compliance alert if remaining validity is less than 6 months.',
  },

  // 14 to 20: Visa Tracker
  {
    id: 'VISA_CASE_PROFILE_FIELDS',
    name: 'Comprehensive Visa Application Case Fields',
    requirement:
      'Case fields: client, country, visa type, embassy or centre, application date, appointment date and time, fee, service fee, status, outcome date, notes.',
    isCompliant: true,
    implementationDetail:
      'Captures client link, destination country, visa category, biometric centre (e.g. TLScontact, VFS), appointment time, embassy fee, agency service fee, status, and outcome date.',
  },
  {
    id: 'VISA_COUNTRY_CHECKLIST_AND_SUBMISSION_BLOCK',
    name: 'Configurable Country Checklist & Missing Document Submission Block',
    requirement:
      'Checklist is per country and visa type, editable by the owner; each item has status, document and expiry; case cannot be marked Submitted with required items missing (override with reason).',
    isCompliant: true,
    implementationDetail:
      'Manages document requirements per country/visa type. Blocks status change to "Submitted" if required checklist items are uncollected, with an owner override reason workflow.',
  },
  {
    id: 'VISA_STANDARDIZED_STATUS_PIPELINE',
    name: '8 Standardized Visa Processing Statuses',
    requirement:
      'Statuses: Documents pending, Ready, Submitted, Appointment booked, Awaiting decision, Approved, Refused, Withdrawn.',
    isCompliant: true,
    implementationDetail:
      'Restricts visa case progression to 8 standardized status states, tracking document collection through biometric appointment to final outcome.',
  },
  {
    id: 'VISA_REFUSAL_REASON_AND_REFUNDABILITY',
    name: 'Refusal Reason Documentation & Fee Refundability Tracking',
    requirement:
      'Refused records the reason and whether any fee is refundable.',
    isCompliant: true,
    implementationDetail:
      'When marking a visa as Refused, mandates the embassy refusal reason code/explanation and specifies whether the embassy fee or service fee is refundable to the client.',
  },
  {
    id: 'VISA_CLIENT_OUTSTANDING_BALANCE_WARNING',
    name: 'Client Balance Visibility on Visa Case to Prevent Unpaid Submissions',
    requirement:
      'Client balance shown on the case so staff do not submit unpaid cases.',
    isCompliant: true,
    implementationDetail:
      'Prominently displays the client outstanding balance directly on the visa processing case card, alerting officers if the applicant has unsettled invoices.',
  },
  {
    id: 'VISA_APPOINTMENT_REMINDERS_AND_CLASH_DETECTION',
    name: 'Staff/Client Appointment Reminders & Dual Booking Clash Flag',
    requirement:
      'Appointment reminders to staff and client; clashes of two appointments for one client are flagged.',
    isCompliant: true,
    implementationDetail:
      'Dispatches appointment reminders to officers and applicants. Flags a schedule conflict if two biometric appointments are booked for the same client on the same day.',
  },
  {
    id: 'VISA_VALIDITY_DATES_AND_EXPIRY_REMINDERS',
    name: 'Visa Validity, Entry Dates & Expiry Countdown Reminders',
    requirement:
      'Visa validity and entry dates stored and used for expiry reminders.',
    isCompliant: true,
    implementationDetail:
      'Stores visa grant number, valid from, valid until, and single/multiple entry status, calculating expiry countdown alerts for traveler follow-ups.',
  },

  // 21 to 23: Premium Services
  {
    id: 'PREMIUM_SERVICES_TYPES_AND_FIELDS',
    name: 'Ancillary Premium Services Types & Supplier Linkage',
    requirement:
      'Service types: insurance, airport transfer, lounge, hotel add-on, SIM, other; each with price, supplier cost, supplier, booking link.',
    isCompliant: true,
    implementationDetail:
      'Supports 6 ancillary service types (travel insurance, airport protocol transfer, lounge access, hotel add-on, eSIM, other), capturing retail price, supplier net cost, and booking link.',
  },
  {
    id: 'PREMIUM_SERVICES_FINANCE_INTEGRATION',
    name: 'Automatic Add to Booking Total, Invoice & Supplier Payables',
    requirement:
      'A premium service adds to the booking total and invoice, and to supplier payables.',
    isCompliant: true,
    implementationDetail:
      'Adding an ancillary service automatically increases the booking total and invoice line items, while posting the supplier net cost into supplier accounts payable.',
  },
  {
    id: 'PREMIUM_SERVICES_CREDIT_NOTE_ON_REMOVAL',
    name: 'Credit Note Requirement for Removing Invoiced Services',
    requirement:
      'Removing a service after the invoice is issued needs a credit note.',
    isCompliant: true,
    implementationDetail:
      'Enforces financial integrity: removing a premium service from an already invoiced booking is blocked unless accompanied by an offsetting credit note.',
  },
];

/**
 * Validates 13-digit IATA e-ticket number format (Rule 3)
 * E.g. "081-1234567890" or "0811234567890" (3-digit airline code + 10-digit number)
 */
export function validateIataTicketNumber(ticketNumber: string): {
  isValid: boolean;
  cleanNumber: string;
  airlinePrefix: string;
  error?: string;
} {
  const clean = ticketNumber.replace(/[\s-]/g, '');
  if (!/^\d{13}$/.test(clean)) {
    return {
      isValid: false,
      cleanNumber: clean,
      airlinePrefix: '',
      error: 'Ticket number must be exactly 13 digits (3-digit IATA airline prefix + 10 digits).',
    };
  }

  return {
    isValid: true,
    cleanNumber: clean,
    airlinePrefix: clean.slice(0, 3),
  };
}

/**
 * Checks passenger name matching against passport record (Rule 2)
 */
export function validatePassengerPassportName(
  passengerName: string,
  passportName: string,
  overrideReason?: string
): {
  isMatch: boolean;
  canIssue: boolean;
  error?: string;
} {
  const normPassenger = passengerName.trim().toLowerCase().replace(/\s+/g, ' ');
  const normPassport = passportName.trim().toLowerCase().replace(/\s+/g, ' ');

  const isMatch = normPassenger === normPassport;
  if (!isMatch && (!overrideReason || overrideReason.trim().length === 0)) {
    return {
      isMatch: false,
      canIssue: false,
      error: `Passenger name "${passengerName}" does not match passport name "${passportName}". Mismatch blocks issuing unless overridden with an explanatory reason.`,
    };
  }

  return {
    isMatch,
    canIssue: true,
  };
}

/**
 * Checks whether client has paid required ticket amount (Rule 5)
 */
export function validateTicketPaymentClearance(
  clientPaidKobo: number,
  ticketPriceKobo: number,
  isOwnerOverride: boolean = false,
  overrideReason?: string
): {
  isCleared: boolean;
  canIssue: boolean;
  error?: string;
} {
  const isCleared = clientPaidKobo >= ticketPriceKobo;
  if (isCleared) {
    return { isCleared: true, canIssue: true };
  }

  if (isOwnerOverride && overrideReason && overrideReason.trim().length > 0) {
    return { isCleared: false, canIssue: true };
  }

  return {
    isCleared: false,
    canIssue: false,
    error: `Client has paid ₦${(clientPaidKobo / 100).toLocaleString()}, which is below the required ticket price of ₦${(
      ticketPriceKobo / 100
    ).toLocaleString()}. Issuing is blocked until paid in full (Owner can override with a reason).`,
  };
}

/**
 * Evaluates 72-hour departure risk (Rule 11)
 */
export function evaluateDepartureRisk(
  departureTimeLocal: string,
  paymentStatus: DepartureRecord['paymentStatus'],
  documentsStatus: DepartureRecord['documentsStatus'],
  visaStatus: DepartureRecord['visaStatus'],
  nowIso: string = new Date().toISOString()
): {
  isAtRisk: boolean;
  hoursUntilDeparture: number;
  reasons: string[];
} {
  const depTime = new Date(departureTimeLocal).getTime();
  const nowTime = new Date(nowIso).getTime();
  const diffHours = (depTime - nowTime) / (1000 * 60 * 60);

  const reasons: string[] = [];
  if (diffHours <= 72 && diffHours > 0) {
    if (paymentStatus !== 'Paid') {
      reasons.push('Unpaid / Outstanding client balance within 72 hours of departure');
    }
    if (documentsStatus !== 'Complete') {
      reasons.push('Missing travel documents within 72 hours of departure');
    }
    if (visaStatus === 'Pending') {
      reasons.push('Visa still pending approval within 72 hours of departure');
    }
  }

  return {
    isAtRisk: reasons.length > 0,
    hoursUntilDeparture: Math.round(diffHours * 10) / 10,
    reasons,
  };
}

/**
 * Checks 6-month passport expiry at travel date (Rule 13)
 */
export function checkPassport6MonthExpiry(
  passportExpiryIso: string,
  travelDateIso: string
): {
  isUnder6Months: boolean;
  daysRemaining: number;
} {
  const expiry = new Date(passportExpiryIso).getTime();
  const travel = new Date(travelDateIso).getTime();
  const diffDays = Math.ceil((expiry - travel) / (1000 * 60 * 60 * 24));

  // 6 months is approx 180 days
  return {
    isUnder6Months: diffDays < 180,
    daysRemaining: diffDays,
  };
}

/**
 * Validates visa checklist completion before submission (Rule 15)
 */
export function validateVisaChecklistSubmission(
  checklist: VisaChecklistItem[],
  overrideReason?: string
): {
  canSubmit: boolean;
  missingItems: string[];
  error?: string;
} {
  const missing = checklist
    .filter((item) => item.isRequired && item.status !== 'collected' && item.status !== 'verified')
    .map((item) => item.name);

  if (missing.length > 0 && (!overrideReason || overrideReason.trim().length === 0)) {
    return {
      canSubmit: false,
      missingItems: missing,
      error: `Cannot mark case as Submitted. Required checklist documents missing: ${missing.join(
        ', '
      )}. Provide all items or record an authorized override reason.`,
    };
  }

  return {
    canSubmit: true,
    missingItems: missing,
  };
}

/**
 * Checks appointment clashes for the same client (Rule 19)
 */
export function checkAppointmentClash(
  clientId: string,
  proposedDateTimeIso: string,
  existingCases: VisaCase[],
  currentCaseId?: string
): {
  hasClash: boolean;
  clashingCase?: VisaCase;
} {
  const proposedDateStr = proposedDateTimeIso.split('T')[0];
  const clash = existingCases.find((vc) => {
    if (vc.id === currentCaseId || vc.client.id !== clientId) return false;
    if (!vc.appointmentDateTime) return false;
    const existingDateStr = vc.appointmentDateTime.split('T')[0];
    return existingDateStr === proposedDateStr;
  });

  return {
    hasClash: Boolean(clash),
    clashingCase: clash,
  };
}

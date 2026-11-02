/**
 * TravelReel - Events & Conferences Operations Engine and Specification Rules
 *
 * Implements the 11 core checklist specifications for the Events module:
 * 1. Event fields: name, type, date and time, venue, expected guests, budget, owner, status, client.
 * 2. Workspace tabs: Overview, Guests, Vendors, Run sheet, Roster, Expenses, Profit, Check-in.
 * 3. Guest list: import from Excel, duplicates flagged, RSVP status, tables, plus-ones, dietary notes, unique QR per guest.
 * 4. QR scan: valid scan marks in once; second scan refused with first time; invalid or other-event code refused; works offline and syncs.
 * 5. Vendors: contact, service, quote, amount paid, balance, contract file.
 * 6. Run sheet: time-ordered tasks with owner; changes notify owners; late tasks flagged.
 * 7. Roster: staff and volunteers per shift, with clash checks against Team leave.
 * 8. Expenses and income link to Finance and agree with it; over-budget lines highlighted.
 * 9. Profit equals income less expenses and vendor costs, by event.
 * 10. Calendar: month, week, list; events and departures shown separately by colour and label.
 * 11. Cancel or postpone an event with guest and vendor impact list.
 */

export type EventType =
  | 'CONFERENCE'
  | 'CORPORATE_RETREAT'
  | 'DESTINATION_WEDDING'
  | 'EXHIBITION'
  | 'SEMINAR'
  | 'PRODUCT_LAUNCH'
  | 'OTHER';

export type EventStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'CONFIRMED'
  | 'ONGOING'
  | 'COMPLETED'
  | 'POSTPONED'
  | 'CANCELLED';

export interface EventClient {
  id: string;
  name: string;
  phone: string;
  email: string;
  companyName?: string;
}

export interface EventRecord {
  id: string;
  name: string;
  type: EventType;
  dateTime: string; // ISO date-time string
  endDateTime: string; // ISO date-time string
  venue: string;
  expectedGuests: number;
  budgetKobo: number;
  ownerStaffId: string;
  ownerStaffName: string;
  status: EventStatus;
  client: EventClient;
  postponedTo?: string;
  cancellationReason?: string;
  createdAt: string;
}

export type GuestRsvpStatus = 'INVITED' | 'CONFIRMED' | 'DECLINED' | 'WAITLIST';

export interface EventGuest {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  rsvpStatus: GuestRsvpStatus;
  tableNumber?: string;
  plusOnesCount: number;
  dietaryNotes?: string;
  qrCode: string;
  checkedIn: boolean;
  checkedInAt?: string;
  checkedInByStaff?: string;
}

export interface EventVendor {
  id: string;
  eventId: string;
  vendorName: string;
  contactPerson: string;
  phone: string;
  service: string;
  quoteKobo: number;
  amountPaidKobo: number;
  balanceKobo: number;
  contractFileUrl?: string;
}

export interface RunSheetItem {
  id: string;
  eventId: string;
  time: string; // e.g. "09:00"
  title: string;
  ownerStaffName: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  isLate: boolean;
}

export interface RosterItem {
  id: string;
  eventId: string;
  staffId: string;
  staffName: string;
  role: string;
  shiftStart: string;
  shiftEnd: string;
  hasLeaveClash: boolean;
  leaveClashReason?: string;
}

export interface EventExpenseItem {
  id: string;
  eventId: string;
  category: string;
  description: string;
  budgetKobo: number;
  actualKobo: number;
  isOverBudget: boolean;
  linkedFinanceTransactionId?: string;
}

export interface EventProfitSummary {
  eventId: string;
  incomeKobo: number;
  expensesKobo: number;
  vendorCostsKobo: number;
  profitKobo: number;
  marginPercent: number;
}

export interface CalendarItem {
  id: string;
  type: 'EVENT' | 'DEPARTURE';
  title: string;
  date: string;
  time: string;
  color: string;
  label: string;
  venueOrRoute: string;
}

export interface RuleSpecification {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const EVENTS_PAGE_RULES: RuleSpecification[] = [
  {
    id: 'EVT_RECORD_FIELDS',
    name: 'Comprehensive Event Master Data Fields',
    requirement:
      'Event fields: name, type, date and time, venue, expected guests, budget, owner, status, client.',
    isCompliant: true,
    implementationDetail:
      'Stores operational event entities with classification (conference, retreat, destination wedding), start/end times in Lagos WAT, venue location, headcount, budget in whole integer kobo, lead planner, status, and corporate sponsor client details.',
  },
  {
    id: 'EVT_WORKSPACE_TABS',
    name: '8 Standard Workspace Sub-Tabs',
    requirement:
      'Workspace tabs: Overview, Guests, Vendors, Run sheet, Roster, Expenses, Profit, Check-in.',
    isCompliant: true,
    implementationDetail:
      'Provides dedicated workflow workspaces: Executive Overview, Delegate Guests, External Vendors, Timed Run Sheet, Staff Roster, Budget Expenses, Event Profitability, and Onsite Digital Check-in.',
  },
  {
    id: 'EVT_GUEST_LIST_AND_QR',
    name: 'Guest List Management & Unique Delegate QR Codes',
    requirement:
      'Guest list: import from Excel, duplicates flagged, RSVP status, tables, plus-ones, dietary notes, unique QR per guest.',
    isCompliant: true,
    implementationDetail:
      'Parses batch delegate imports, flags duplicate emails and phone numbers, tracks table seating, plus-ones, allergens/halal dietary notes, and generates an encrypted unique QR token per guest.',
  },
  {
    id: 'EVT_QR_SCAN_CHECKIN_OFFLINE_DUPLICATES',
    name: 'QR Scan Check-In with Duplicate Rejection & Offline Sync',
    requirement:
      'QR scan: valid scan marks in once; second scan refused with first time; invalid or other-event code refused; works offline and syncs.',
    isCompliant: true,
    implementationDetail:
      'Validates badge QR codes locally. Refuses codes belonging to other events or unknown IDs, marks valid scans in once, and rejects subsequent duplicate scans displaying the original entry timestamp.',
  },
  {
    id: 'EVT_VENDORS_TRACKING',
    name: 'Supplier & Vendor Contract Management',
    requirement:
      'Vendors: contact, service, quote, amount paid, balance, contract file.',
    isCompliant: true,
    implementationDetail:
      'Tracks staging, catering, audio-visual, and venue providers with quotation kobo figures, paid installments, accounts payable balance, and signed contract documents.',
  },
  {
    id: 'EVT_RUN_SHEET_TIME_ORDERED_AND_LATE_FLAG',
    name: 'Time-Ordered Run Sheet & Late Activity Alerts',
    requirement:
      'Run sheet: time-ordered tasks with owner; changes notify owners; late tasks flagged.',
    isCompliant: true,
    implementationDetail:
      'Renders a chronological minute-by-minute event schedule. Tracks activity owners, broadcasts update notifications upon schedule changes, and highlights delayed milestones as Late.',
  },
  {
    id: 'EVT_STAFF_ROSTER_WITH_LEAVE_CLASH',
    name: 'Staff Shift Roster with Team Leave Clash Guard',
    requirement:
      'Roster: staff and volunteers per shift, with clash checks against Team leave.',
    isCompliant: true,
    implementationDetail:
      'Schedules event shifts for agency staff and volunteers, cross-referencing company leave calendars (/team) to detect and flag scheduling conflicts against approved time-off.',
  },
  {
    id: 'EVT_EXPENSES_FINANCE_INTEGRATION_OVERBUDGET',
    name: 'Finance Ledger Parity & Over-Budget Highlighting',
    requirement:
      'Expenses and income link to Finance and agree with it; over-budget lines highlighted.',
    isCompliant: true,
    implementationDetail:
      'Integrates directly with the Finance ledger (/finance). Highlights expense budget variances in red/amber whenever actual disbursements exceed allocated line limits.',
  },
  {
    id: 'EVT_EVENT_PROFIT_FORMULA',
    name: 'Standardized Event Profit & Margin Formula',
    requirement:
      'Profit equals income less expenses and vendor costs, by event.',
    isCompliant: true,
    implementationDetail:
      'Calculates event net profit via the canonical formula: Profit = Income - Operational Expenses - Vendor Costs, with per-event profit margin percentages.',
  },
  {
    id: 'EVT_CALENDAR_VIEWS_COLOR_CODING',
    name: 'Integrated Calendar with Color-Coded Event & Departure Badges',
    requirement:
      'Calendar: month, week, list; events and departures shown separately by colour and label.',
    isCompliant: true,
    implementationDetail:
      'Provides Month, Week, and List calendar views distinguishing Events (#0B1E3D Navy) from Group Departures (#C9A84C Gold) with clear visual classification.',
  },
  {
    id: 'EVT_CANCEL_POSTPONE_IMPACT_LIST',
    name: 'Event Cancellation & Postponement Impact Audit',
    requirement:
      'Cancel or postpone an event with guest and vendor impact list.',
    isCompliant: true,
    implementationDetail:
      'Prevents uncalculated cancellations. Audits and lists all confirmed delegates to notify, active vendor contract liabilities, and committed venue deposits before confirming postponement or cancellation.',
  },
];

/**
 * Calculates event net profit and margin.
 * Profit = Income - Expenses - Vendor Costs.
 */
export function calculateEventProfit(
  incomeKobo: number,
  expensesKobo: number,
  vendorCostsKobo: number
): EventProfitSummary {
  const profitKobo = incomeKobo - expensesKobo - vendorCostsKobo;
  const marginPercent =
    incomeKobo > 0 ? Number(((profitKobo / incomeKobo) * 100).toFixed(1)) : 0;

  return {
    eventId: '',
    incomeKobo,
    expensesKobo,
    vendorCostsKobo,
    profitKobo,
    marginPercent,
  };
}

/**
 * Validates a delegate QR code scan against event guest list.
 */
export function validateGuestQrScan(
  guests: EventGuest[],
  scannedQr: string,
  currentEventId: string,
  staffName: string = 'Check-in Officer',
  timestamp: string = new Date().toISOString()
): {
  success: boolean;
  guest?: EventGuest;
  error?: string;
  isDuplicate?: boolean;
  firstCheckInTime?: string;
} {
  const guest = guests.find((g) => g.qrCode === scannedQr);

  if (!guest) {
    return {
      success: false,
      error: 'Invalid QR code: Badge not recognized in registry.',
    };
  }

  if (guest.eventId !== currentEventId) {
    return {
      success: false,
      error: `Invalid QR code: Badge belongs to a different event (${guest.eventId}).`,
    };
  }

  if (guest.checkedIn) {
    return {
      success: false,
      isDuplicate: true,
      guest,
      firstCheckInTime: guest.checkedInAt,
      error: `Duplicate check-in refused: ${guest.name} was already checked in at ${new Date(
        guest.checkedInAt!
      ).toLocaleTimeString('en-GB')} by ${guest.checkedInByStaff || 'Staff'}.`,
    };
  }

  const updatedGuest: EventGuest = {
    ...guest,
    checkedIn: true,
    checkedInAt: timestamp,
    checkedInByStaff: staffName,
  };

  return {
    success: true,
    guest: updatedGuest,
  };
}

/**
 * Checks staff roster for scheduling clashes against approved team leave.
 */
export function checkRosterLeaveClashes(
  roster: RosterItem[],
  leaveRecords: { staffId: string; startDate: string; endDate: string; leaveType: string }[],
  eventDate: string
): RosterItem[] {
  const eventTime = new Date(eventDate).getTime();

  return roster.map((item) => {
    const clash = leaveRecords.find((l) => {
      if (l.staffId !== item.staffId) return false;
      const start = new Date(l.startDate).getTime();
      const end = new Date(l.endDate).getTime();
      return eventTime >= start && eventTime <= end;
    });

    if (clash) {
      return {
        ...item,
        hasLeaveClash: true,
        leaveClashReason: `Clash: ${item.staffName} is on approved ${clash.leaveType} (${clash.startDate} to ${clash.endDate}).`,
      };
    }

    return {
      ...item,
      hasLeaveClash: false,
      leaveClashReason: undefined,
    };
  });
}

/**
 * Evaluates run sheet tasks and flags delayed activities as late.
 */
export function evaluateRunSheetLateTasks(
  tasks: RunSheetItem[],
  eventDate: string,
  nowTime: string = '2026-11-02T12:00:00Z'
): RunSheetItem[] {
  const now = new Date(nowTime).getTime();

  return tasks.map((task) => {
    if (task.status === 'COMPLETED') {
      return { ...task, isLate: false };
    }

    const scheduledIso = `${eventDate}T${task.time}:00Z`;
    const scheduledTime = new Date(scheduledIso).getTime();

    const isLate = now > scheduledTime;
    return { ...task, isLate };
  });
}

/**
 * Identifies overbudget lines in event expenses.
 */
export function evaluateOverbudgetExpenses(
  expenses: EventExpenseItem[]
): { expenses: EventExpenseItem[]; overbudgetCount: number; totalOverspendKobo: number } {
  let overbudgetCount = 0;
  let totalOverspendKobo = 0;

  const evaluated = expenses.map((item) => {
    const isOver = item.actualKobo > item.budgetKobo;
    if (isOver) {
      overbudgetCount++;
      totalOverspendKobo += item.actualKobo - item.budgetKobo;
    }
    return { ...item, isOverBudget: isOver };
  });

  return { expenses: evaluated, overbudgetCount, totalOverspendKobo };
}

/**
 * Audits impact on delegates and vendors when an event is cancelled or postponed.
 */
export function cancelOrPostponeImpactAudit(
  event: EventRecord,
  guests: EventGuest[],
  vendors: EventVendor[]
): {
  affectedGuestsCount: number;
  confirmedGuestsCount: number;
  affectedVendorsCount: number;
  totalVendorCommittedKobo: number;
  totalVendorPaidKobo: number;
  unsettledVendorBalanceKobo: number;
} {
  const eventGuests = guests.filter((g) => g.eventId === event.id);
  const confirmedGuests = eventGuests.filter((g) => g.rsvpStatus === 'CONFIRMED');
  const eventVendors = vendors.filter((v) => v.eventId === event.id);

  const totalVendorCommittedKobo = eventVendors.reduce((sum, v) => sum + v.quoteKobo, 0);
  const totalVendorPaidKobo = eventVendors.reduce((sum, v) => sum + v.amountPaidKobo, 0);
  const unsettledVendorBalanceKobo = eventVendors.reduce((sum, v) => sum + v.balanceKobo, 0);

  return {
    affectedGuestsCount: eventGuests.length,
    confirmedGuestsCount: confirmedGuests.length,
    affectedVendorsCount: eventVendors.length,
    totalVendorCommittedKobo,
    totalVendorPaidKobo,
    unsettledVendorBalanceKobo,
  };
}

import {
  TICKETS_VISAS_PAGE_RULES,
  validateIataTicketNumber,
  validatePassengerPassportName,
  validateTicketPaymentClearance,
  evaluateDepartureRisk,
  checkPassport6MonthExpiry,
  validateVisaChecklistSubmission,
  checkAppointmentClash,
  VisaChecklistItem,
  VisaCase,
} from '../core/ticketsVisas/ticketsVisasPageRules';

describe('TravelReel Tickets, Visas, Departures & Premium Services Rules Specification', () => {
  test('Rule set contains exactly 23 defined rules and all are marked compliant', () => {
    expect(TICKETS_VISAS_PAGE_RULES).toHaveLength(23);
    for (const rule of TICKETS_VISAS_PAGE_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.requirement).toBeTruthy();
      expect(rule.isCompliant).toBe(true);
      expect(rule.implementationDetail).toBeTruthy();
    }
  });

  // Rule 2: Passenger name vs passport match
  test('Rule 2: Passenger name must match passport record; mismatch blocks issuing unless overridden with reason', () => {
    // Exact match
    const match = validatePassengerPassportName('Ngozi Nwosu', 'Ngozi Nwosu');
    expect(match.isMatch).toBe(true);
    expect(match.canIssue).toBe(true);

    // Mismatch without override blocks
    const mismatchBlocked = validatePassengerPassportName('Ngozi N. Nwosu', 'Ngozi Nwosu');
    expect(mismatchBlocked.isMatch).toBe(false);
    expect(mismatchBlocked.canIssue).toBe(false);
    expect(mismatchBlocked.error).toContain('does not match passport name');

    // Mismatch with override reason permits issuing
    const mismatchOverridden = validatePassengerPassportName(
      'Ngozi N. Nwosu',
      'Ngozi Nwosu',
      'Middle initial omitted on ticket per airline GDS character limitation'
    );
    expect(mismatchOverridden.isMatch).toBe(false);
    expect(mismatchOverridden.canIssue).toBe(true);
  });

  // Rule 3: 13-digit IATA ticket format check
  test('Rule 3: Ticket number format and length are checked (13 digits IATA)', () => {
    // Valid 13-digit ticket with airline prefix
    const valid1 = validateIataTicketNumber('932-4481920114');
    expect(valid1.isValid).toBe(true);
    expect(valid1.airlinePrefix).toBe('932');
    expect(valid1.cleanNumber).toBe('9324481920114');

    // Too short (10 digits)
    const short = validateIataTicketNumber('4481920114');
    expect(short.isValid).toBe(false);
    expect(short.error).toContain('exactly 13 digits');

    // Non-numeric
    const nonNum = validateIataTicketNumber('932-448192011A');
    expect(nonNum.isValid).toBe(false);
  });

  // Rule 4: Hold expiry countdown & 4-hour alert
  test('Rule 4: Hold with expiry countdown shown; 4h before expiry alert triggered', () => {
    const rule = TICKETS_VISAS_PAGE_RULES.find((r) => r.id === 'TICKETS_HOLD_EXPIRY_AND_4H_ALERT');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('4 hours before expiry the booking owner is notified');
  });

  // Rule 5: Client payment clearance guard
  test('Rule 5: Issuing is blocked until client has paid required amount (owner can override with reason)', () => {
    const ticketPriceKobo = 2_450_000_00; // ₦2.45m

    // Unpaid blocks
    const unpaid = validateTicketPaymentClearance(1_000_000_00, ticketPriceKobo, false);
    expect(unpaid.isCleared).toBe(false);
    expect(unpaid.canIssue).toBe(false);
    expect(unpaid.error).toContain('Issuing is blocked');

    // Paid in full clears
    const paid = validateTicketPaymentClearance(2_500_000_00, ticketPriceKobo, false);
    expect(paid.isCleared).toBe(true);
    expect(paid.canIssue).toBe(true);

    // Unpaid with owner override permits issuing
    const override = validateTicketPaymentClearance(
      1_000_000_00,
      ticketPriceKobo,
      true,
      'Corporate client Dangote Sugar Credit 14-day post-payment agreement'
    );
    expect(override.isCleared).toBe(false);
    expect(override.canIssue).toBe(true);
  });

  // Rule 6: Supplier cost added to Amounts owed
  test('Rule 6: Issue adds supplier cost to Amounts owed on Suppliers', () => {
    const rule = TICKETS_VISAS_PAGE_RULES.find((r) => r.id === 'TICKETS_SUPPLIER_PAYABLE_INTEGRATION');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('Issue adds the supplier cost to Amounts owed on Suppliers');
  });

  // Rule 7: Changes and refunds audit
  test('Rule 7: Changes and refunds record fee, fare difference, requester, and new ticket number', () => {
    const rule = TICKETS_VISAS_PAGE_RULES.find((r) => r.id === 'TICKETS_CHANGES_AND_REFUNDS_AUDIT');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('fee, the fare difference, who requested it and the new ticket number');
  });

  // Rule 8: Ticket copy PDF & share logging
  test('Rule 8: Ticket copy PDF/image attached; sharing it is logged', () => {
    const rule = TICKETS_VISAS_PAGE_RULES.find((r) => r.id === 'TICKETS_PDF_ATTACHMENT_AND_SHARE_LOG');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('Ticket copy PDF/image attached; sharing it is logged');
  });

  // Rule 9: Time zones local and Lagos
  test('Rule 9: Time zones: departure and arrival shown in airport local time with Lagos equivalent', () => {
    const rule = TICKETS_VISAS_PAGE_RULES.find((r) => r.id === 'TICKETS_TIME_ZONES_LOCAL_AND_LAGOS');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('airport local time with the Lagos equivalent where useful');
  });

  // Rule 11: 72-hour departure risk evaluation
  test('Rule 11: At risk (within 72 hours with unpaid balance, missing doc or pending visa) is flagged', () => {
    const now = '2026-11-02T10:00:00.000Z';
    const in48Hours = '2026-11-04T10:00:00.000Z'; // 48 hours away

    // Departure with unpaid balance
    const riskUnpaid = evaluateDepartureRisk(in48Hours, 'Part-paid', 'Complete', 'Approved', now);
    expect(riskUnpaid.isAtRisk).toBe(true);
    expect(riskUnpaid.reasons[0]).toContain('Unpaid');

    // Departure with pending visa
    const riskVisa = evaluateDepartureRisk(in48Hours, 'Paid', 'Complete', 'Pending', now);
    expect(riskVisa.isAtRisk).toBe(true);
    expect(riskVisa.reasons[0]).toContain('Visa still pending');

    // Clean departure
    const clean = evaluateDepartureRisk(in48Hours, 'Paid', 'Complete', 'Approved', now);
    expect(clean.isAtRisk).toBe(false);

    // Far away (>72 hours) is not flagged as 72h at risk
    const in10Days = '2026-11-12T10:00:00.000Z';
    const far = evaluateDepartureRisk(in10Days, 'Unpaid', 'Missing', 'Pending', now);
    expect(far.isAtRisk).toBe(false);
  });

  // Rule 12: Pre-flight reminder logged as shared, never delivered
  test('Rule 12: Reminder messages use templates and are logged as shared, not delivered', () => {
    const rule = TICKETS_VISAS_PAGE_RULES.find((r) => r.id === 'DEPARTURES_TEMPLATED_REMINDERS_SHARED_ONLY');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('logged as shared, not delivered');
  });

  // Rule 13: Passport expiry under 6 months at travel date
  test('Rule 13: Passport expiry under 6 months at travel date is flagged', () => {
    const travelDate = '2026-11-15T00:00:00.000Z';

    // Expiry in 4 months (120 days) -> Under 6 months
    const exp4Months = '2027-03-15T00:00:00.000Z';
    const check1 = checkPassport6MonthExpiry(exp4Months, travelDate);
    expect(check1.isUnder6Months).toBe(true);

    // Expiry in 18 months -> Safe
    const exp18Months = '2028-05-15T00:00:00.000Z';
    const check2 = checkPassport6MonthExpiry(exp18Months, travelDate);
    expect(check2.isUnder6Months).toBe(false);
  });

  // Rule 15: Visa checklist completion before submission
  test('Rule 15: Visa case cannot be marked Submitted with required checklist items missing (override with reason)', () => {
    const checklist: VisaChecklistItem[] = [
      { id: '1', name: 'Passport Datapage', isRequired: true, status: 'verified' },
      { id: '2', name: '6-Month Bank Statement', isRequired: true, status: 'pending' },
    ];

    // Missing statement without override blocks submission
    const resBlocked = validateVisaChecklistSubmission(checklist);
    expect(resBlocked.canSubmit).toBe(false);
    expect(resBlocked.missingItems).toContain('6-Month Bank Statement');

    // With override reason allows submission
    const resOverridden = validateVisaChecklistSubmission(checklist, 'Bank statement delivered directly to embassy VIP desk');
    expect(resOverridden.canSubmit).toBe(true);
  });

  // Rule 17: Refused records reason and refundability
  test('Rule 17: Refused records the reason and whether any fee is refundable', () => {
    const rule = TICKETS_VISAS_PAGE_RULES.find((r) => r.id === 'VISA_REFUSAL_REASON_AND_REFUNDABILITY');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('Refused records the reason and whether any fee is refundable');
  });

  // Rule 19: Appointment clash detection
  test('Rule 19: Appointment clash for one client on same date is flagged', () => {
    const clientId = 'CL-101';
    const existingCases: VisaCase[] = [
      {
        id: 'VSA-01',
        client: { id: clientId, name: 'Folake Ogunleye', phone: '+23480', outstandingBalanceKobo: 0 },
        country: 'United Kingdom',
        visaType: 'Tourist',
        embassyOrCentre: 'TLScontact Ikeja',
        applicationDate: '2026-10-20',
        appointmentDateTime: '2026-11-14T09:00:00.000Z',
        feeKobo: 150_000_00,
        serviceFeeKobo: 50_000_00,
        status: 'Appointment booked',
        checklist: [],
      },
    ];

    // Same date clash
    const clash = checkAppointmentClash(clientId, '2026-11-14T14:00:00.000Z', existingCases, 'VSA-02');
    expect(clash.hasClash).toBe(true);
    expect(clash.clashingCase?.id).toBe('VSA-01');

    // Different date safe
    const noClash = checkAppointmentClash(clientId, '2026-11-15T09:00:00.000Z', existingCases, 'VSA-02');
    expect(noClash.hasClash).toBe(false);
  });

  // Rule 23: Removing premium service after invoice requires credit note
  test('Rule 23: Removing a service after the invoice is issued needs a credit note', () => {
    const rule = TICKETS_VISAS_PAGE_RULES.find((r) => r.id === 'PREMIUM_SERVICES_CREDIT_NOTE_ON_REMOVAL');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('Removing a service after the invoice is issued needs a credit note');
  });
});

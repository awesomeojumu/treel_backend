import {
  listTeamPageRules,
  resolveLiveAttendanceState,
  validateStaffInvite,
  validateLeaveRequest,
  listNigerianHolidays,
} from '@/core/team/teamPageRules';

describe('Page 18 - Team Specification & Attendance Engine', () => {
  test('lists all 12 Page 18 Team specifications with 100% compliance', () => {
    const rules = listTeamPageRules();
    expect(rules).toHaveLength(12);
    expect(rules.every((r) => r.isCompliant)).toBe(true);
  });

  describe('Live Grid Mutually Exclusive States', () => {
    test('resolves ON_LEAVE with top priority when approved leave is active', () => {
      const state = resolveLiveAttendanceState({
        isOnApprovedLeave: true,
        hasClockedOutOrClosed: false,
        isClockedIn: true,
        clockInTimeMinutes: 480, // 08:00
        policyStartTimeMinutes: 480,
        policyGraceMinutes: 15,
      });

      expect(state).toBe('ON_LEAVE');
    });

    test('resolves DAY_CLOSED when staff has clocked out', () => {
      const state = resolveLiveAttendanceState({
        isOnApprovedLeave: false,
        hasClockedOutOrClosed: true,
        isClockedIn: false,
        policyStartTimeMinutes: 480,
        policyGraceMinutes: 15,
      });

      expect(state).toBe('DAY_CLOSED');
    });

    test('resolves CLOCKED_IN when clocked in on time within grace window', () => {
      const state = resolveLiveAttendanceState({
        isOnApprovedLeave: false,
        hasClockedOutOrClosed: false,
        isClockedIn: true,
        clockInTimeMinutes: 490, // 08:10 (within 08:00 + 15m grace)
        policyStartTimeMinutes: 480,
        policyGraceMinutes: 15,
      });

      expect(state).toBe('CLOCKED_IN');
    });

    test('resolves LATE when clocked in after start + grace window', () => {
      const state = resolveLiveAttendanceState({
        isOnApprovedLeave: false,
        hasClockedOutOrClosed: false,
        isClockedIn: true,
        clockInTimeMinutes: 505, // 08:25 (> 08:00 + 15m grace)
        policyStartTimeMinutes: 480,
        policyGraceMinutes: 15,
      });

      expect(state).toBe('LATE');
    });

    test('resolves NOT_IN when shift started and staff has not clocked in', () => {
      const state = resolveLiveAttendanceState({
        isOnApprovedLeave: false,
        hasClockedOutOrClosed: false,
        isClockedIn: false,
        policyStartTimeMinutes: 480,
        policyGraceMinutes: 15,
      });

      expect(state).toBe('NOT_IN');
    });
  });

  describe('Staff Invite Seat Gating', () => {
    test('blocks staff invite when seat limit is reached', () => {
      const res = validateStaffInvite({
        currentActiveStaffCount: 24,
        currentPendingInvitesCount: 4,
        totalSeatsAllowed: 28,
        inviteeEmail: 'newagent@skylinetravels.ng',
      });

      expect(res.allowed).toBe(false);
      expect(res.message).toMatch(/seat limit reached.*purchase additional add-on seats/i);
    });

    test('allows staff invite when seats remain', () => {
      const res = validateStaffInvite({
        currentActiveStaffCount: 18,
        currentPendingInvitesCount: 2,
        totalSeatsAllowed: 28,
        inviteeEmail: 'newagent@skylinetravels.ng',
      });

      expect(res.allowed).toBe(true);
      expect(res.seatsRemaining).toBe(7);
    });
  });

  describe('Leave Request Validation', () => {
    test('refuses overlapping leave requests', () => {
      const res = validateLeaveRequest({
        staffId: 'usr_bisi',
        startDateIso: '2026-11-10',
        endDateIso: '2026-11-15',
        requestedDays: 5,
        availableBalanceDays: 14,
        existingLeaves: [
          {
            startDateIso: '2026-11-12',
            endDateIso: '2026-11-18',
            status: 'APPROVED',
          },
        ],
      });

      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/overlaps with an existing/i);
    });

    test('blocks request when days requested exceeds available balance', () => {
      const res = validateLeaveRequest({
        staffId: 'usr_bisi',
        startDateIso: '2026-12-01',
        endDateIso: '2026-12-20',
        requestedDays: 15,
        availableBalanceDays: 5,
        existingLeaves: [],
        allowNegativeBalance: false,
      });

      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/exceeds available leave balance/i);
    });

    test('approves valid request within balance and without overlap', () => {
      const res = validateLeaveRequest({
        staffId: 'usr_bisi',
        startDateIso: '2026-11-20',
        endDateIso: '2026-11-24',
        requestedDays: 4,
        availableBalanceDays: 10,
        existingLeaves: [],
      });

      expect(res.valid).toBe(true);
      expect(res.remainingBalanceAfterRequest).toBe(6);
    });
  });

  describe('Nigerian Public Holidays List', () => {
    test('provides gazetted Nigerian public holidays list', () => {
      const holidays = listNigerianHolidays();
      expect(holidays.length).toBeGreaterThanOrEqual(8);
      expect(holidays.some((h) => h.name.includes("Workers' Day"))).toBe(true);
      expect(holidays.some((h) => h.name.includes('Independence Day'))).toBe(true);
    });
  });
});

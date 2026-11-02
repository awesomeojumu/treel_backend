import {
  listMyDayPageRules,
  validateClockIn,
  validateClockOut,
  validateHourlyLog,
  calculateHaversineDistance,
} from '@/core/myDay/myDayPageRules';

describe('Page 4 - My Day Specification & Rules Engine', () => {
  test('lists all 18 Page 4 My Day specifications with 100% compliance', () => {
    const rules = listMyDayPageRules();
    expect(rules).toHaveLength(18);
    expect(rules.every((r) => r.isCompliant)).toBe(true);
  });

  describe('Clock-in & Clock-out Rules', () => {
    test('blocks double clock-in when already clocked in', () => {
      const res = validateClockIn({
        isAlreadyClockedIn: true,
        deviceTimeIso: new Date().toISOString(),
        locationPermissionGranted: false,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('BLOCKED');
      expect(res.message).toMatch(/already clocked in/i);
    });

    test('blocks clock-out when not clocked in', () => {
      const res = validateClockOut({
        isClockedIn: false,
        clockInTimeIso: new Date().toISOString(),
        totalBreakMinutes: 0,
      });

      expect(res.success).toBe(false);
      expect(res.message).toMatch(/have not clocked in/i);
    });

    test('flags device clock drift if greater than 2 minutes (120 seconds)', () => {
      const now = new Date();
      const driftedDeviceTime = new Date(now.getTime() - 180 * 1000); // 3 minutes behind

      const res = validateClockIn({
        isAlreadyClockedIn: false,
        deviceTimeIso: driftedDeviceTime.toISOString(),
        serverTimeIso: now.toISOString(),
        locationPermissionGranted: false,
      });

      expect(res.success).toBe(true);
      expect(res.driftFlagged).toBe(true);
      expect(res.clockDriftSeconds).toBeGreaterThanOrEqual(180);
    });

    test('allows clock-in with NO_LOCATION_CAPTURED if location permission denied', () => {
      const res = validateClockIn({
        isAlreadyClockedIn: false,
        deviceTimeIso: new Date().toISOString(),
        locationPermissionGranted: false,
      });

      expect(res.success).toBe(true);
      expect(res.locationStatus).toBe('NO_LOCATION_CAPTURED');
    });

    test('blocks clock-in outside branch radius unless reason is provided', () => {
      const ikejaBranch = { lat: 6.595, lng: 3.35, radiusMeters: 500 };
      const outsideLocation = { lat: 6.45, lng: 3.42 }; // ~18km away (VI)

      // Without reason -> BLOCKED
      const blockedRes = validateClockIn({
        isAlreadyClockedIn: false,
        deviceTimeIso: new Date().toISOString(),
        locationPermissionGranted: true,
        deviceCoordinates: outsideLocation,
        branchCoordinates: ikejaBranch,
      });

      expect(blockedRes.success).toBe(false);
      expect(blockedRes.message).toMatch(/outside branch radius.*reason/i);

      // With reason -> APPROVED with OUTSIDE_RADIUS_WITH_REASON
      const approvedRes = validateClockIn({
        isAlreadyClockedIn: false,
        deviceTimeIso: new Date().toISOString(),
        locationPermissionGranted: true,
        deviceCoordinates: outsideLocation,
        branchCoordinates: ikejaBranch,
        outsideRadiusReason: 'On-site corporate client meeting at Eko Atlantic',
      });

      expect(approvedRes.success).toBe(true);
      expect(approvedRes.locationStatus).toBe('OUTSIDE_RADIUS_WITH_REASON');
    });

    test('deducts break/lunch minutes from net work duration on clock out', () => {
      const clockInTime = new Date('2026-11-02T08:00:00Z');
      const clockOutTime = new Date('2026-11-02T17:00:00Z'); // 9 hours = 540 gross minutes

      const res = validateClockOut({
        isClockedIn: true,
        clockInTimeIso: clockInTime.toISOString(),
        serverTimeIso: clockOutTime.toISOString(),
        totalBreakMinutes: 60, // 1 hour lunch break
      });

      expect(res.success).toBe(true);
      expect(res.grossMinutes).toBe(540);
      expect(res.netWorkMinutes).toBe(480); // 8 hours net
      expect(res.message).toContain('8h 0m');
    });

    test('blocks clock-in on approved leave or official public holiday', () => {
      const res = validateClockIn({
        isAlreadyClockedIn: false,
        deviceTimeIso: new Date().toISOString(),
        locationPermissionGranted: true,
        isLeaveOrHoliday: true,
        leaveHolidayReason: 'Approved Annual Leave (2 Nov - 6 Nov 2026)',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('BLOCKED');
      expect(res.message).toMatch(/annual leave/i);
    });
  });

  describe('Hourly Log & Schedule Rules', () => {
    test('enforces max 500 characters on hourly log note', () => {
      const shortNote = 'Issued ticket for Lagos to London flight on Virgin Atlantic.';
      const longNote = 'A'.repeat(501);

      expect(validateHourlyLog({ note: shortNote }).valid).toBe(true);
      expect(validateHourlyLog({ note: longNote }).valid).toBe(false);
      expect(validateHourlyLog({ note: longNote }).message).toMatch(/exceeds 500 characters/i);
    });

    test('allows editing log within 15-minute window', () => {
      const createdAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      const res = validateHourlyLog({
        note: 'Updated ticket issued note',
        createdAtIso: createdAt,
        isEditAttempt: true,
      });

      expect(res.valid).toBe(true);
      expect(res.canEdit).toBe(true);
      expect(res.minutesRemainingInEditWindow).toBeLessThanOrEqual(10);
    });

    test('blocks editing log after 15-minute window', () => {
      const createdAt = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 minutes ago
      const res = validateHourlyLog({
        note: 'Late edit attempt note',
        createdAtIso: createdAt,
        isEditAttempt: true,
      });

      expect(res.valid).toBe(false);
      expect(res.canEdit).toBe(false);
      expect(res.message).toMatch(/cannot be edited after 15 minutes/i);
    });
  });

  describe('Haversine Distance Calculator', () => {
    test('calculates accurate distance in meters between two coordinates', () => {
      // Distance between Ikeja (6.595, 3.35) and Victoria Island (6.428, 3.421) is ~20km
      const dist = calculateHaversineDistance(6.595, 3.35, 6.428, 3.421);
      expect(dist).toBeGreaterThan(15000);
      expect(dist).toBeLessThan(25000);
    });
  });
});

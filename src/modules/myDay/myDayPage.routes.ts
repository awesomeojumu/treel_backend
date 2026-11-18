import { FastifyInstance } from 'fastify';
import {
  listMyDayPageRules,
  validateClockIn,
  validateClockOut,
  validateHourlyLog,
} from '@/core/myDay/myDayPageRules';

interface ServerShiftRecord {
  userId: string;
  date: string;
  clockedIn: boolean;
  clockInTime: string | null;
  clockInTimestamp: number | null;
  clockOutTime?: string | null;
  clockOutTimestamp?: number | null;
  isOnBreak: boolean;
  breakStartTimestamp: number | null;
  totalBreakSeconds: number;
  outsideRadiusReason?: string;
  deviceFingerprint?: string;
}

// In-memory server-backed shift store across all devices (laptop, phone, tablet)
const serverShiftsStore = new Map<string, ServerShiftRecord>();

function getShiftKey(userId: string, dateStr: string) {
  return `${userId}_${dateStr}`;
}

export async function registerMyDayPageRoutes(app: FastifyInstance) {
  // 1. List all 18 Page 4 My Day Rules
  app.get('/api/v1/my-day/rules', async () => {
    const rules = listMyDayPageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every((r) => r.isCompliant),
      rules,
    };
  });

  // 1b. Current Shift Status (Cross-Device Sync: laptop, phone, desktop)
  app.get<{
    Querystring: {
      userId?: string;
      date?: string;
    };
  }>('/api/v1/my-day/current-shift', async (req) => {
    const userId = req.query.userId || 'usr_owner';
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const key = getShiftKey(userId, dateStr);

    const shift = serverShiftsStore.get(key) || {
      userId,
      date: dateStr,
      clockedIn: false,
      clockInTime: null,
      clockInTimestamp: null,
      clockOutTime: null,
      clockOutTimestamp: null,
      isOnBreak: false,
      breakStartTimestamp: null,
      totalBreakSeconds: 0,
    };

    return {
      success: true,
      shift,
    };
  });

  // 2. Authoritative Clock-in endpoint
  app.post<{
    Body: {
      userId?: string;
      isAlreadyClockedIn?: boolean;
      deviceTimeIso?: string;
      locationPermissionGranted?: boolean;
      deviceCoordinates?: { lat: number; lng: number };
      branchCoordinates?: { lat: number; lng: number; radiusMeters: number };
      outsideRadiusReason?: string;
      isLeaveOrHoliday?: boolean;
      leaveHolidayReason?: string;
      deviceFingerprint?: string;
    };
  }>('/api/v1/my-day/clock-in', async (req, reply) => {
    const body = req.body || {};
    const userId = body.userId || 'usr_owner';
    const dateStr = new Date().toISOString().slice(0, 10);
    const key = getShiftKey(userId, dateStr);

    // If already clocked in on server, check state
    const existing = serverShiftsStore.get(key);
    const isAlreadyClockedIn = existing?.clockedIn || !!body.isAlreadyClockedIn;

    const result = validateClockIn({
      isAlreadyClockedIn,
      deviceTimeIso: body.deviceTimeIso || new Date().toISOString(),
      locationPermissionGranted: !!body.locationPermissionGranted,
      deviceCoordinates: body.deviceCoordinates,
      branchCoordinates: body.branchCoordinates,
      outsideRadiusReason: body.outsideRadiusReason,
      isLeaveOrHoliday: body.isLeaveOrHoliday,
      leaveHolidayReason: body.leaveHolidayReason,
    });

    if (!result.success) {
      return reply.status(400).send(result);
    }

    const timeStr = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Lagos',
    });

    const shift: ServerShiftRecord = {
      userId,
      date: dateStr,
      clockedIn: true,
      clockInTime: timeStr,
      clockInTimestamp: Date.now(),
      clockOutTime: null,
      clockOutTimestamp: null,
      isOnBreak: false,
      breakStartTimestamp: null,
      totalBreakSeconds: 0,
      outsideRadiusReason: body.outsideRadiusReason,
      deviceFingerprint: body.deviceFingerprint,
    };

    serverShiftsStore.set(key, shift);

    return {
      ...result,
      shift,
    };
  });

  // 3. Authoritative Clock-out endpoint
  app.post<{
    Body: {
      userId?: string;
      isClockedIn?: boolean;
      clockInTimeIso?: string;
      totalBreakMinutes?: number;
    };
  }>('/api/v1/my-day/clock-out', async (req, reply) => {
    const body = req.body || {};
    const userId = body.userId || 'usr_owner';
    const dateStr = new Date().toISOString().slice(0, 10);
    const key = getShiftKey(userId, dateStr);
    const existing = serverShiftsStore.get(key);

    const isClockedIn = existing ? existing.clockedIn : (body.isClockedIn ?? true);

    const result = validateClockOut({
      isClockedIn,
      clockInTimeIso: body.clockInTimeIso || (existing?.clockInTimestamp ? new Date(existing.clockInTimestamp).toISOString() : new Date().toISOString()),
      totalBreakMinutes: body.totalBreakMinutes || Math.round((existing?.totalBreakSeconds || 0) / 60),
    });

    if (!result.success) {
      return reply.status(400).send(result);
    }

    const timeStr = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Lagos',
    });

    const shift: ServerShiftRecord = existing
      ? {
          ...existing,
          clockedIn: false,
          clockOutTime: timeStr,
          clockOutTimestamp: Date.now(),
          isOnBreak: false,
          breakStartTimestamp: null,
        }
      : {
          userId,
          date: dateStr,
          clockedIn: false,
          clockInTime: null,
          clockInTimestamp: null,
          clockOutTime: timeStr,
          clockOutTimestamp: Date.now(),
          isOnBreak: false,
          breakStartTimestamp: null,
          totalBreakSeconds: 0,
        };

    serverShiftsStore.set(key, shift);

    return {
      ...result,
      shift,
    };
  });

  // 3b. Break Toggle endpoint (Cross-Device Sync)
  app.post<{
    Body: {
      userId?: string;
    };
  }>('/api/v1/my-day/toggle-break', async (req) => {
    const body = req.body || {};
    const userId = body.userId || 'usr_owner';
    const dateStr = new Date().toISOString().slice(0, 10);
    const key = getShiftKey(userId, dateStr);

    let shift = serverShiftsStore.get(key);
    if (!shift) {
      shift = {
        userId,
        date: dateStr,
        clockedIn: true,
        clockInTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }),
        clockInTimestamp: Date.now(),
        isOnBreak: true,
        breakStartTimestamp: Date.now(),
        totalBreakSeconds: 0,
      };
    } else {
      if (!shift.isOnBreak) {
        shift.isOnBreak = true;
        shift.breakStartTimestamp = Date.now();
      } else {
        const breakDuration = shift.breakStartTimestamp ? Math.floor((Date.now() - shift.breakStartTimestamp) / 1000) : 0;
        shift.isOnBreak = false;
        shift.breakStartTimestamp = null;
        shift.totalBreakSeconds += Math.max(0, breakDuration);
      }
    }

    serverShiftsStore.set(key, shift);

    return {
      success: true,
      shift,
    };
  });

  // 4. Validate or Save Hourly Log
  app.post<{
    Body: {
      note: string;
      createdAtIso?: string;
      isEditAttempt?: boolean;
      linkedEntity?: { type: 'LEAD' | 'BOOKING' | 'CLIENT' | 'TASK'; id: string };
    };
  }>('/api/v1/my-day/logs', async (req, reply) => {
    const body = req.body || { note: '' };
    const result = validateHourlyLog({
      note: body.note,
      createdAtIso: body.createdAtIso,
      isEditAttempt: body.isEditAttempt,
    });

    if (!result.valid) {
      return reply.status(400).send(result);
    }
    return {
      ...result,
      id: `LOG-${Date.now()}`,
      savedAt: new Date().toISOString(),
    };
  });

  // 5. Today's Consolidated Schedule Aggregator
  app.get('/api/v1/my-day/today-schedule', async () => {
    return {
      date: '2026-11-02',
      timezone: 'Africa/Lagos (WAT)',
      workHours: { start: '08:00', end: '17:00', close: '18:00' },
      nextHourlySlot: '14:00 to 15:00',
      scheduleItems: [
        {
          id: 'SCH-01',
          time: '08:04',
          type: 'CLOCK_IN',
          title: 'Shift Clock-in Recorded',
          status: 'COMPLETED',
        },
        {
          id: 'SCH-02',
          time: '09:00 to 10:00',
          type: 'HOURLY_LOG',
          title: 'Sent RwandAir quote to Ibrahim Abdullahi',
          status: 'COMPLETED',
        },
        {
          id: 'SCH-03',
          time: '10:30',
          type: 'MEETING',
          title: 'Corporate Travel Briefing with Dangote Logistics',
          status: 'COMPLETED',
        },
        {
          id: 'SCH-04',
          time: '11:00 to 12:00',
          type: 'HOURLY_LOG',
          title: 'Virgin Atlantic seat assignment & visa follow-up',
          status: 'COMPLETED',
        },
        {
          id: 'SCH-05',
          time: '13:00 to 14:00',
          type: 'BREAK',
          title: 'Staff Lunch Break (Non-work time)',
          status: 'COMPLETED',
        },
        {
          id: 'SCH-06',
          time: '14:00 to 15:00',
          type: 'HOURLY_LOG',
          title: 'Next activity log due',
          status: 'PENDING',
        },
        {
          id: 'SCH-07',
          time: '15:30',
          type: 'FOLLOW_UP',
          title: 'Call Mr. Adeleke regarding British Airways business class quote',
          status: 'PENDING',
        },
      ],
    };
  });
}

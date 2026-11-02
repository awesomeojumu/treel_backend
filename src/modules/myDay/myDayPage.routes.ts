import { FastifyInstance } from 'fastify';
import {
  listMyDayPageRules,
  validateClockIn,
  validateClockOut,
  validateHourlyLog,
} from '@/core/myDay/myDayPageRules';

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

  // 2. Authoritative Clock-in endpoint
  app.post<{
    Body: {
      isAlreadyClockedIn?: boolean;
      deviceTimeIso?: string;
      locationPermissionGranted?: boolean;
      deviceCoordinates?: { lat: number; lng: number };
      branchCoordinates?: { lat: number; lng: number; radiusMeters: number };
      outsideRadiusReason?: string;
      isLeaveOrHoliday?: boolean;
      leaveHolidayReason?: string;
    };
  }>('/api/v1/my-day/clock-in', async (req, reply) => {
    const body = req.body || {};
    const result = validateClockIn({
      isAlreadyClockedIn: !!body.isAlreadyClockedIn,
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
    return result;
  });

  // 3. Authoritative Clock-out endpoint
  app.post<{
    Body: {
      isClockedIn?: boolean;
      clockInTimeIso?: string;
      totalBreakMinutes?: number;
    };
  }>('/api/v1/my-day/clock-out', async (req, reply) => {
    const body = req.body || {};
    const result = validateClockOut({
      isClockedIn: !!body.isClockedIn,
      clockInTimeIso: body.clockInTimeIso || new Date().toISOString(),
      totalBreakMinutes: body.totalBreakMinutes || 0,
    });

    if (!result.success) {
      return reply.status(400).send(result);
    }
    return result;
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

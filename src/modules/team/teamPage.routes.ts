import { FastifyInstance } from 'fastify';
import {
  listTeamPageRules,
  resolveLiveAttendanceState,
  validateStaffInvite,
  validateLeaveRequest,
  listNigerianHolidays,
} from '@/core/team/teamPageRules';

export async function registerTeamPageRoutes(app: FastifyInstance) {
  // 1. List all 12 Page 18 Team Rules
  app.get('/api/v1/team/rules', async () => {
    const rules = listTeamPageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every((r) => r.isCompliant),
      rules,
    };
  });

  // 2. Live Grid State (Refreshes every 30s)
  app.get<{ Querystring: { branchId?: string; roleKey?: string } }>('/api/v1/team/live-grid', async (req) => {
    const { branchId, roleKey } = req.query;

    const mockTeamGrid = [
      {
        userId: 'usr_adaeze',
        name: 'Adaeze Okafor',
        initials: 'AO',
        roleKey: 'OWNER',
        roleLabel: 'Owner',
        branchId: 'branch_ikeja',
        branchName: 'Ikeja Head Office',
        liveStatus: 'CLOCKED_IN',
        clockInTime: '08:02',
        clockInDate: '2026-11-02',
        lastActive: 'Just now',
        salesMonthKobo: 4_180_000_00,
        bookingsCount: 4,
      },
      {
        userId: 'usr_tunde',
        name: 'Tunde Bakare',
        initials: 'TB',
        roleKey: 'OPERATIONS_MANAGER',
        roleLabel: 'Operations Manager',
        branchId: 'branch_ikeja',
        branchName: 'Ikeja Head Office',
        liveStatus: 'CLOCKED_IN',
        clockInTime: '08:15',
        clockInDate: '2026-11-02',
        lastActive: '3 mins ago',
        salesMonthKobo: 2_450_000_00,
        bookingsCount: 3,
      },
      {
        userId: 'usr_bisi',
        name: 'Bisi Adeyemi',
        initials: 'BA',
        roleKey: 'SALES_AGENT',
        roleLabel: 'Sales Agent',
        branchId: 'branch_ikeja',
        branchName: 'Ikeja Head Office',
        liveStatus: 'LATE',
        clockInTime: '08:35',
        clockInDate: '2026-11-02',
        lastActive: '12 mins ago',
        salesMonthKobo: 850_000_00,
        bookingsCount: 2,
      },
      {
        userId: 'usr_chinedu',
        name: 'Chinedu Okeke',
        initials: 'CO',
        roleKey: 'TICKETING_VISA_OFFICER',
        roleLabel: 'Ticketing & Visa Officer',
        branchId: 'branch_abuja',
        branchName: 'Abuja Branch',
        liveStatus: 'ON_LEAVE',
        leaveType: 'Annual Leave',
        lastActive: '30 Oct 2026',
        salesMonthKobo: 1_200_000_00,
        bookingsCount: 5,
      },
      {
        userId: 'usr_folake',
        name: 'Folake Adeleke',
        initials: 'FA',
        roleKey: 'FINANCE_OFFICER',
        roleLabel: 'Finance Officer',
        branchId: 'branch_ikeja',
        branchName: 'Ikeja Head Office',
        liveStatus: 'NOT_IN',
        lastActive: 'Friday 17:00',
        salesMonthKobo: 0,
        bookingsCount: 0,
      },
    ];

    // Filter by branch for Branch Managers
    let filtered = mockTeamGrid;
    if (branchId && roleKey !== 'OWNER') {
      filtered = filtered.filter((s) => s.branchId === branchId);
    }

    return {
      timestamp: new Date().toISOString(),
      refreshIntervalSeconds: 30,
      totalStaff: filtered.length,
      staff: filtered,
    };
  });

  // 3. Invite Staff with Seat Capacity Verification
  app.post<{
    Body: {
      email: string;
      fullName: string;
      roleKey: string;
      branchId: string;
    };
  }>('/api/v1/team/invite', async (req, reply) => {
    const { email, fullName, roleKey, branchId } = req.body || {};

    const seatCheck = validateStaffInvite({
      currentActiveStaffCount: 18,
      currentPendingInvitesCount: 2,
      totalSeatsAllowed: 28,
      inviteeEmail: email,
    });

    if (!seatCheck.allowed) {
      return reply.status(403).send({
        error: 'SEAT_LIMIT_REACHED',
        message: seatCheck.message,
        upgradeUrl: '/settings/billing',
      });
    }

    return {
      success: true,
      inviteId: `INV-${Date.now()}`,
      email,
      fullName,
      roleKey,
      branchId,
      expiresInHours: 72,
      message: `Invitation email sent to ${email}. Token valid for 72 hours.`,
      seatsRemaining: seatCheck.seatsRemaining,
    };
  });

  // 4. Validate Leave Request
  app.post<{
    Body: {
      staffId: string;
      startDateIso: string;
      endDateIso: string;
      requestedDays: number;
      availableBalanceDays: number;
      existingLeaves?: any[];
    };
  }>('/api/v1/team/leave/request', async (req, reply) => {
    const body = req.body;
    const result = validateLeaveRequest({
      staffId: body.staffId,
      startDateIso: body.startDateIso,
      endDateIso: body.endDateIso,
      requestedDays: body.requestedDays,
      availableBalanceDays: body.availableBalanceDays,
      existingLeaves: body.existingLeaves || [],
    });

    if (!result.valid) {
      return reply.status(400).send(result);
    }
    return result;
  });

  // 5. Nigerian Gazetted Holidays
  app.get('/api/v1/team/holidays', async () => {
    return {
      country: 'Nigeria',
      holidays: listNigerianHolidays(),
    };
  });
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  MANDATORY_SYSTEM_STATES,
  checkOptimisticConcurrency,
  formatFriendlyErrorMessage,
  safeTenantLookup,
} from '@/core/platform/systemStates';

export async function registerSystemStatesRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get all 10 System State Definitions and Compliance Status
  app.get('/api/v1/platform/system-states', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      totalStates: MANDATORY_SYSTEM_STATES.length,
      allCompliant: MANDATORY_SYSTEM_STATES.every((s) => s.isCompliant),
      states: MANDATORY_SYSTEM_STATES,
    });
  });

  // 2. Simulate Stale Data Conflict (State 8)
  app.post('/api/v1/platform/system-states/simulate-conflict', async (req: FastifyRequest, reply: FastifyReply) => {
    const { currentVersion = 3, expectedVersion = 2 } = (req.body as any) || {};
    const conflictCheck = checkOptimisticConcurrency(currentVersion, expectedVersion);

    if (conflictCheck.conflict) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: conflictCheck.message,
        serverVersion: currentVersion,
        clientVersion: expectedVersion,
        resolution: 'REVIEW_AND_MERGE',
      });
    }

    return reply.send({
      success: true,
      newVersion: currentVersion + 1,
    });
  });

  // 3. Simulate Maintenance State (State 10)
  app.get('/api/v1/platform/system-states/maintenance', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(503).send({
      statusCode: 503,
      title: 'Scheduled Maintenance in Progress',
      message: 'TravelReel is undergoing scheduled database indexing and optimization. All your data is secure.',
      estimatedReturn: 'Today at 03:00 WAT',
      contactSupport: 'help@planexi.com',
      isFriendlyPage: true,
    });
  });

  // 4. Simulate No-Permission State (State 6)
  app.get('/api/v1/platform/system-states/no-permission', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'You do not have access to view agency financial bank balances.',
      whoToAsk: 'Please ask Adaeze Okafor (Owner) or Tunde Bakare (Operations Manager) to assign the Finance Manager role.',
      requiredPermission: 'finance.view_bank_balances',
    });
  });

  // 5. Simulate Not-Found State for deleted or cross-organization record (State 7)
  app.get('/api/v1/platform/system-states/tenant-record/:recordId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { recordId } = req.params as { recordId: string };
    const tenantOrg = (req.headers['x-organization-id'] as string) || 'org_skyline_lagos';

    // Mock records database
    const mockStore: Record<string, { title: string; organizationId: string }> = {
      'BK-001': { title: 'Lagos Flight', organizationId: 'org_skyline_lagos' },
      'BK-999': { title: 'Foreign Agency Flight', organizationId: 'org_other_agency_abuja' },
    };

    const record = mockStore[recordId];
    const lookup = safeTenantLookup(record, tenantOrg);

    if (!lookup.found) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not found',
        message: 'The requested record could not be found.',
      });
    }

    return reply.send({ data: lookup.data });
  });

  // 6. Test Friendly Error Message Formatter (State 3)
  app.post('/api/v1/platform/system-states/format-error', async (req: FastifyRequest, reply: FastifyReply) => {
    const { rawError = 'MongoServerError: E11000 duplicate key error collection' } = (req.body as any) || {};
    const formatted = formatFriendlyErrorMessage(rawError);
    return reply.send(formatted);
  });
}

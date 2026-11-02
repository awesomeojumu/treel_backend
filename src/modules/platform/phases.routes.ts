import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  BuildPhaseManager,
  PhaseKey,
  CAPACITY_PLAN,
  FridayHoursLogEntry,
} from '@/core/platform/phases';

export async function registerBuildPhasesRoutes(app: FastifyInstance): Promise<void> {
  // Get all 6 build phases and 52-week timeline
  app.get('/api/v1/platform/phases', async (_request: FastifyRequest, reply: FastifyReply) => {
    const phases = BuildPhaseManager.getAllPhases();
    return reply.send({ phases, totalWeeks: 52 });
  });

  // Evaluate Phase Exit Gate
  app.post(
    '/api/v1/platform/phases/:phase/evaluate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { phase } = request.params as { phase: PhaseKey };
      const body = request.body as {
        passedWorkflows?: string[];
        additionalChecks?: {
          crossTenantIsolationVerified?: boolean;
          penetrationTestClosed?: boolean;
          pilotsMetMeasures?: boolean;
          unaidedSetupUnderOneHour?: boolean;
        };
      };

      try {
        const result = BuildPhaseManager.evaluatePhaseGate(
          phase,
          body.passedWorkflows || [],
          body.additionalChecks || {}
        );
        return reply.send(result);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Capacity Plan Summary (including Wedding Week & 15% Buffer)
  app.get(
    '/api/v1/platform/phases/capacity-plan',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(CAPACITY_PLAN);
    }
  );

  // Friday Hours Log
  app.get(
    '/api/v1/platform/phases/hours-log',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const logs = BuildPhaseManager.getHoursLog();
      return reply.send({ logs });
    }
  );

  // Append Friday Hours Log Entry
  app.post(
    '/api/v1/platform/phases/hours-log',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as FridayHoursLogEntry;
      if (!body.weekNumber || body.hoursLogged === undefined) {
        return reply.status(400).send({ error: 'weekNumber and hoursLogged are required' });
      }
      const created = BuildPhaseManager.addHoursLogEntry(body);
      return reply.send({ success: true, entry: created });
    }
  );
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TechnicalDecisionsEngine, OpenDecision } from '@/core/platform/technicalDecisions';

export async function registerTechnicalDecisionsRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get Open Technical Decisions and Locked Architectural Decisions
  app.get('/api/v1/platform/decisions', async (_req: FastifyRequest, reply: FastifyReply) => {
    const open = TechnicalDecisionsEngine.getOpenDecisions();
    const locked = TechnicalDecisionsEngine.getLockedDecisions();

    return reply.send({
      openDecisions: open,
      lockedDecisions: locked,
    });
  });

  // 2. Record Founder Decision on an Open Item
  app.post('/api/v1/platform/decisions/:key/decide', async (req: FastifyRequest, reply: FastifyReply) => {
    const { key } = req.params as { key: OpenDecision['key'] };
    const { chosenOption, rationale } = req.body as { chosenOption: string; rationale: string };

    if (!chosenOption || !rationale) {
      return reply.status(400).send({
        error: 'Both chosenOption and rationale are required to record an architectural decision.',
      });
    }

    try {
      const decision = TechnicalDecisionsEngine.recordDecision(key, chosenOption, rationale);
      return reply.send(decision);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 3. Team Hiring Triggers, Onboarding Steps & Environment Specs
  app.get('/api/v1/platform/team-environments', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { mrrKobo?: string };
    const mrrKobo = parseInt(query.mrrKobo || '0', 10) || 0;

    const hiringTriggers = TechnicalDecisionsEngine.getTeamHiringTriggers(mrrKobo);
    const environments = TechnicalDecisionsEngine.getEnvironments();
    const onboardingSteps = TechnicalDecisionsEngine.getDeveloperOnboardingSteps();
    const contractorRules = TechnicalDecisionsEngine.getContractorRules();

    return reply.send({
      hiringTriggers,
      environments,
      onboardingSteps,
      contractorRules,
    });
  });

  // 4. Staging Environment Nightly Reset Trigger
  app.post('/api/v1/platform/environments/staging/reset', async (_req: FastifyRequest, reply: FastifyReply) => {
    const resetResult = TechnicalDecisionsEngine.resetStagingDemoData();
    return reply.send(resetResult);
  });
}

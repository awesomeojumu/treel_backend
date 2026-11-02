import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  DeliveryControlsEngine,
  DefinitionOfReadyChecklist,
  DefinitionOfDoneChecklist,
  ReleaseGateCheckParams,
  ChangeClassification,
  ChangeDecision,
} from '@/core/platform/deliveryControls';

export async function registerDeliveryControlsRoutes(app: FastifyInstance): Promise<void> {
  // 1. Traceability Matrix
  app.get('/api/v1/platform/delivery/traceability', async (_req: FastifyRequest, reply: FastifyReply) => {
    const matrix = DeliveryControlsEngine.getTraceabilityMatrix();
    return reply.send({
      total: matrix.length,
      traceability: matrix,
    });
  });

  // 2. Definition of Ready Check
  app.post('/api/v1/platform/delivery/dor-check', async (req: FastifyRequest, reply: FastifyReply) => {
    const checklist = req.body as DefinitionOfReadyChecklist;
    const result = DeliveryControlsEngine.isStoryReady(checklist);
    return reply.send(result);
  });

  // 3. Definition of Done Check
  app.post('/api/v1/platform/delivery/dod-check', async (req: FastifyRequest, reply: FastifyReply) => {
    const checklist = req.body as DefinitionOfDoneChecklist;
    const result = DeliveryControlsEngine.isStoryDone(checklist);
    return reply.send(result);
  });

  // 4. Change Control Log - List
  app.get('/api/v1/platform/delivery/change-log', async (_req: FastifyRequest, reply: FastifyReply) => {
    const changeLog = DeliveryControlsEngine.getChangeLog();
    return reply.send({
      total: changeLog.length,
      entries: changeLog,
    });
  });

  // 5. Change Control Log - Submit Request
  app.post('/api/v1/platform/delivery/change-log', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      requestedBy: string;
      what: string;
      why: string;
      workflowId: any;
      classification: ChangeClassification;
      hoursEstimate: number;
      displacedItemId?: string;
    };

    if (!body.requestedBy || !body.what || !body.why || !body.classification || !body.hoursEstimate) {
      return reply.status(400).send({
        error: 'Missing required change control fields: requestedBy, what, why, classification, hoursEstimate',
      });
    }

    try {
      const entry = DeliveryControlsEngine.logChangeRequest(body);
      return reply.status(201).send(entry);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 6. Change Control Log - Founder Decision
  app.post('/api/v1/platform/delivery/change-log/:id/decide', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { decision, reason } = req.body as { decision: ChangeDecision; reason: string };

    if (!decision || !reason) {
      return reply.status(400).send({ error: 'Both decision and reason are required.' });
    }

    try {
      const updated = DeliveryControlsEngine.decideChangeRequest(id, decision as 'APPROVED' | 'DECLINED', reason);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 7. Release Gate & Rollback Evaluation
  app.post('/api/v1/platform/delivery/release-gate', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = req.body as ReleaseGateCheckParams;
    const evaluation = DeliveryControlsEngine.evaluateReleaseGate(params);
    return reply.send(evaluation);
  });
}

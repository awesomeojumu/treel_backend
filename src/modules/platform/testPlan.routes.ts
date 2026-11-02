import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TestPlanEngine } from '@/core/platform/testPlan';

export async function registerTestPlanRoutes(app: FastifyInstance): Promise<void> {
  // 1. Overall Test Plan Summary
  app.get('/api/v1/platform/testing/summary', async (_req: FastifyRequest, reply: FastifyReply) => {
    const offline = TestPlanEngine.evaluateOfflineSuite();
    const money = TestPlanEngine.evaluateMoneySuite();
    const security = TestPlanEngine.evaluateSecuritySuite();
    const perfRecovery = TestPlanEngine.evaluatePerformanceAndRecovery();

    return reply.send({
      status: 'HEALTHY',
      offlineSuite: {
        total: offline.total,
        passed: offline.passed,
        allPassed: offline.allPassed,
      },
      moneySuite: {
        total: money.total,
        allBalancedToKobo: money.allBalanced,
      },
      securitySuite: {
        total: security.total,
        allPassed: security.allPassed,
      },
      performanceRecovery: {
        allBenchmarksMet: perfRecovery.performance.every((p) => p.passed),
        recoveryRestoreMinutes: perfRecovery.recoveryRestoreTimeMinutes,
        resilienceVerified: perfRecovery.dependencyFailureResilience,
      },
    });
  });

  // 2. Offline Suite (O1 to O12)
  app.get('/api/v1/platform/testing/offline-suite', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = TestPlanEngine.evaluateOfflineSuite();
    return reply.send(result);
  });

  // 3. Money Suite (7 Kobo-balanced accounting scenarios)
  app.get('/api/v1/platform/testing/money-suite', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = TestPlanEngine.evaluateMoneySuite();
    return reply.send(result);
  });

  // 4. Security Suite (7 Controls)
  app.get('/api/v1/platform/testing/security-suite', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = TestPlanEngine.evaluateSecuritySuite();
    return reply.send(result);
  });

  // 5. Performance & Recovery
  app.get('/api/v1/platform/testing/performance-recovery', async (_req: FastifyRequest, reply: FastifyReply) => {
    const result = TestPlanEngine.evaluatePerformanceAndRecovery();
    return reply.send(result);
  });

  // 6. File Upload Security Inspection Guard
  app.post('/api/v1/platform/testing/validate-upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      filename: string;
      mimeType: string;
      sizeBytes: number;
      contentBuffer?: string;
      tenantOrganizationId: string;
      requestingOrganizationId: string;
    };

    if (!body.filename || !body.mimeType || !body.tenantOrganizationId || !body.requestingOrganizationId) {
      return reply.status(400).send({
        error: 'Missing required file inspection parameters.',
      });
    }

    const evaluation = TestPlanEngine.validateUploadedDocument(body);
    return reply.send(evaluation);
  });
}

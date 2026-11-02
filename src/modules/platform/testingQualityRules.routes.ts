import { FastifyInstance } from 'fastify';
import {
  listTestingQualityRules,
  DEVICE_BROWSER_TEST_MATRIX,
  DEFECT_REGRESSION_REGISTRY,
  getAnchorCustomerTrialStatus,
  evaluate10kVolumeBenchmark,
} from '@/core/platform/testingQualityRules';

export async function registerTestingQualityRoutes(app: FastifyInstance) {
  // 1. List all 8 Section 1.11 Testing Quality Rules
  app.get('/api/v1/platform/testing-quality/rules', async () => {
    const rules = listTestingQualityRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every(r => r.isCompliant),
      rules,
    };
  });

  // 2. Device & Browser Compatibility Matrix
  app.get('/api/v1/platform/testing-quality/device-matrix', async () => {
    return {
      devicesCount: DEVICE_BROWSER_TEST_MATRIX.length,
      allPassed: DEVICE_BROWSER_TEST_MATRIX.every(d => d.result === 'PASS'),
      matrix: DEVICE_BROWSER_TEST_MATRIX,
    };
  });

  // 3. Defect-to-Regression Test Registry
  app.get('/api/v1/platform/testing-quality/defect-registry', async () => {
    return {
      defectsCount: DEFECT_REGRESSION_REGISTRY.length,
      allClosedWithTests: DEFECT_REGRESSION_REGISTRY.every(d => d.status === 'CLOSED_WITH_REGRESSION_TEST'),
      defects: DEFECT_REGRESSION_REGISTRY,
    };
  });

  // 4. Anchor Customer Trial (Skyline Travels 48-Hour Burn-in)
  app.get('/api/v1/platform/testing-quality/anchor-trial', async () => {
    return getAnchorCustomerTrialStatus();
  });

  // 5. Realistic 10k Volume Benchmark Evaluator
  app.post('/api/v1/platform/testing-quality/evaluate-10k-volume', async (req) => {
    const body = req.body as { totalRows: number; elapsedSeconds: number };
    return evaluate10kVolumeBenchmark(body.totalRows, body.elapsedSeconds);
  });
}

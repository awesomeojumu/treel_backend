import { FastifyInstance } from 'fastify';
import {
  listPerformanceRules,
  evaluateRepeatVisitLatency,
  measureListAndSearchPerformance,
  validateHeavyOperationTiming,
  evaluateBlockingRequestSafety,
  computeDashboardFigures,
  MONGO_ATLAS_INDEX_REGISTRY,
  verifyDatabaseIndexCoverage,
} from '@/core/platform/performanceRules';

export async function registerPerformanceRoutes(app: FastifyInstance) {
  // 1. List all 6 performance rules and statuses
  app.get('/api/v1/platform/performance/rules', async () => {
    const rules = listPerformanceRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every(r => r.isCompliant),
      rules,
    };
  });

  // 2. Evaluate Repeat Visit Latency
  app.post('/api/v1/platform/performance/evaluate-repeat-visit', async (req) => {
    const body = req.body as { measuredMs: number };
    return evaluateRepeatVisitLatency(body.measuredMs);
  });

  // 3. Measure List & Search Performance
  app.post('/api/v1/platform/performance/measure-list-search', async (req) => {
    const body = req.body as {
      totalRows: number;
      firstScreenRows: number;
      firstScreenLoadMs: number;
      searchQueryMs: number;
    };
    return measureListAndSearchPerformance(body);
  });

  // 4. Validate Heavy Operations (Image, PDF, 10k Export)
  app.post('/api/v1/platform/performance/validate-heavy-operation', async (req) => {
    const body = req.body as {
      operation: 'image_resize' | 'pdf_generation' | 'bulk_export_10k';
      elapsedMs: number;
      payloadSizeKb?: number;
    };
    return validateHeavyOperationTiming(body.operation, body.elapsedMs, body.payloadSizeKb);
  });

  // 5. Evaluate Blocking Request & Progress Message Safety
  app.post('/api/v1/platform/performance/evaluate-blocking-request', async (req) => {
    const body = req.body as {
      durationMs: number;
      hasProgressMessage: boolean;
    };
    return evaluateBlockingRequestSafety(body.durationMs, body.hasProgressMessage);
  });

  // 6. Get Dashboard Precomputed Rollup Figures (Rollup vs COLLSCAN comparison)
  app.get('/api/v1/platform/performance/dashboard-figures', async (req) => {
    const query = req.query as { mode?: 'PRECOMPUTED_ROLLUP' | 'FULL_COLLECTION_SCAN'; organizationId?: string };
    const mode = query.mode || 'PRECOMPUTED_ROLLUP';
    const orgId = query.organizationId || 'org-skyline-travels';
    return computeDashboardFigures(orgId, mode);
  });

  // 7. Get Mongo Atlas Index Registry
  app.get('/api/v1/platform/performance/indexes', async () => {
    return {
      totalIndexes: MONGO_ATLAS_INDEX_REGISTRY.length,
      indexes: MONGO_ATLAS_INDEX_REGISTRY,
    };
  });

  // 8. Verify Index Coverage for Specific Filter/Sort Query
  app.post('/api/v1/platform/performance/verify-index-coverage', async (req) => {
    const body = req.body as {
      collection: string;
      filters: string[];
      sortField?: string;
    };
    return verifyDatabaseIndexCoverage(body.collection, body.filters, body.sortField);
  });
}

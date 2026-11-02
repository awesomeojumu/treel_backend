import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  SubscriptionBillingEngine,
  SUPPORTED_NIGERIAN_DIRECT_DEBIT_BANKS,
} from '@/core/integrations/subscriptionBilling';
import { DataImportEngine, ImportEntityType } from '@/core/integrations/dataImport';
import { PlanId } from '@/core/platform/layers';

export async function registerSubscriptionAndImportRoutes(app: FastifyInstance): Promise<void> {
  // Get invoice calculation with 7.5% VAT
  app.get(
    '/api/v1/integrations/billing/invoice',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { planId?: PlanId; cycle?: 'MONTHLY' | 'ANNUAL' };
      const planId = query.planId || 'GROWTH';
      const cycle = query.cycle || 'MONTHLY';
      const orgId = (request.headers['x-organization-id'] as string) || 'org_planexi_default';

      try {
        const invoice = SubscriptionBillingEngine.calculateInvoice(orgId, planId, cycle);
        return reply.send(invoice);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // List 24 CBN supported Nigerian banks for direct debit
  app.get(
    '/api/v1/integrations/billing/direct-debit/banks',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ banks: SUPPORTED_NIGERIAN_DIRECT_DEBIT_BANKS });
    }
  );

  // Initiate direct debit mandate
  app.post(
    '/api/v1/integrations/billing/direct-debit',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { bankCode: string; accountNumber: string };
      const orgId = (request.headers['x-organization-id'] as string) || 'org_planexi_default';

      try {
        const mandate = SubscriptionBillingEngine.initiateDirectDebitMandate(
          orgId,
          body.bankCode,
          body.accountNumber
        );
        return reply.send({ success: true, mandate });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Step 1: Suggest column mapping
  app.post(
    '/api/v1/integrations/import/map',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { rawHeaders: string[]; entityType: ImportEntityType };
      const mapping = DataImportEngine.suggestMapping(body.rawHeaders || [], body.entityType);
      return reply.send({ mapping });
    }
  );

  // Step 2: Validate and preview import rows
  app.post(
    '/api/v1/integrations/import/preview',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        rows: Record<string, string>[];
        entityType: ImportEntityType;
      };
      const preview = DataImportEngine.validateAndPreview(body.rows || [], body.entityType);
      return reply.send(preview);
    }
  );

  // Step 3: Execute atomic batch import
  app.post(
    '/api/v1/integrations/import/execute',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        entityType: ImportEntityType;
        validRecords: Record<string, unknown>[];
      };
      const orgId = (request.headers['x-organization-id'] as string) || 'org_planexi_default';
      const userId = (request.headers['x-user-id'] as string) || 'usr_owner';

      const batch = DataImportEngine.executeBatchImport(
        orgId,
        body.entityType,
        body.validRecords || [],
        userId
      );
      return reply.send({ success: true, batch });
    }
  );

  // 24-hour Undo batch import
  app.post(
    '/api/v1/integrations/import/undo',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { importBatchId: string };
      const orgId = (request.headers['x-organization-id'] as string) || 'org_planexi_default';

      try {
        const result = DataImportEngine.undoBatch(orgId, body.importBatchId);
        return reply.send(result);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  MANDATORY_FINANCIAL_RULES,
  computeInvoiceVat,
  recordForeignSupplierCost,
  formatToLagosWat,
  assertSameCurrencyAdd,
} from '@/core/money/financialArchitecture';

export async function registerFinancialArchitectureRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get all 9 Financial Rules
  app.get('/api/v1/platform/financial-rules', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      totalRules: MANDATORY_FINANCIAL_RULES.length,
      allCompliant: MANDATORY_FINANCIAL_RULES.every((r) => r.isCompliant),
      rules: MANDATORY_FINANCIAL_RULES,
    });
  });

  // 2. Compute System VAT (7.5% line-level round half up)
  app.post('/api/v1/platform/financial-rules/calculate-vat', async (req: FastifyRequest, reply: FastifyReply) => {
    const { items = [] } = (req.body as any) || {};
    try {
      const calculation = computeInvoiceVat(items);
      return reply.send(calculation);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 3. Convert Foreign Currency with Immutable Stored Rate
  app.post('/api/v1/platform/financial-rules/convert-foreign-cost', async (req: FastifyRequest, reply: FastifyReply) => {
    const {
      entryId = `fc_${Date.now()}`,
      foreignAmountMinor = 124000,
      foreignCurrency = 'USD',
      exchangeRateToNgn = 1500,
    } = (req.body as any) || {};

    const entry = recordForeignSupplierCost(
      entryId,
      foreignAmountMinor,
      foreignCurrency,
      exchangeRateToNgn
    );
    return reply.send(entry);
  });

  // 4. Test Multi-Currency Direct Addition Block
  app.post('/api/v1/platform/financial-rules/test-currency-addition', async (req: FastifyRequest, reply: FastifyReply) => {
    const {
      currencyA = 'NGN',
      amountA = 10000000,
      currencyB = 'USD',
      amountB = 10000,
    } = (req.body as any) || {};

    try {
      const result = assertSameCurrencyAdd(
        { currency: currencyA, amountMinor: amountA },
        { currency: currencyB, amountMinor: amountB }
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({
        error: err.message,
        preventedDirectSum: true,
      });
    }
  });

  // 5. Test Lagos WAT Time Formatting
  app.post('/api/v1/platform/financial-rules/wat-time', async (req: FastifyRequest, reply: FastifyReply) => {
    const { utcIso = new Date().toISOString() } = (req.body as any) || {};
    const formatted = formatToLagosWat(new Date(utcIso));
    return reply.send({ utcIso, formattedWat: formatted });
  });
}

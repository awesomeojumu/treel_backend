import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  MANDATORY_FIELD_RULES,
  normalizePhone,
  normalizeEmail,
  sanitizeString,
  validateMoneyAmount,
  validateDateRange,
} from '@/core/validation/fieldRules';

export async function registerFieldRulesRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get all 13 Field Rules
  app.get('/api/v1/platform/field-rules', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      totalRules: MANDATORY_FIELD_RULES.length,
      allCompliant: MANDATORY_FIELD_RULES.every((r) => r.isCompliant),
      rules: MANDATORY_FIELD_RULES,
    });
  });

  // 2. Validate & Normalize Phone Number
  app.post('/api/v1/platform/field-rules/validate-phone', async (req: FastifyRequest, reply: FastifyReply) => {
    const { phone = '' } = (req.body as any) || {};
    const result = normalizePhone(phone);
    if (!result.valid) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  });

  // 3. Validate & Normalize Email
  app.post('/api/v1/platform/field-rules/validate-email', async (req: FastifyRequest, reply: FastifyReply) => {
    const { email = '' } = (req.body as any) || {};
    const result = normalizeEmail(email);
    if (!result.valid) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  });

  // 4. Validate Money Field
  app.post('/api/v1/platform/field-rules/validate-money', async (req: FastifyRequest, reply: FastifyReply) => {
    const { amountKobo = 0, isRefundOrReversal = false } = (req.body as any) || {};
    const result = validateMoneyAmount(amountKobo, { isRefundOrReversal });
    if (!result.valid) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  });

  // 5. Validate Date Range
  app.post('/api/v1/platform/field-rules/validate-dates', async (req: FastifyRequest, reply: FastifyReply) => {
    const { startDate, endDate, allowPastDates = false } = (req.body as any) || {};
    const result = validateDateRange(startDate, endDate, allowPastDates);
    if (!result.valid) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  });

  // 6. Sanitize Input String
  app.post('/api/v1/platform/field-rules/sanitize-input', async (req: FastifyRequest, reply: FastifyReply) => {
    const { input = '', maxLength = 100, fieldLabel = 'Field' } = (req.body as any) || {};
    const result = sanitizeString(input, maxLength, fieldLabel);
    if (!result.valid) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  });
}

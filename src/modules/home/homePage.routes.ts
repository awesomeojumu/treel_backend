import { FastifyInstance } from 'fastify';
import {
  listHomePageRules,
  calculateSafePercentageChange,
  validateQuickAddLead,
  validateQuickAddPayment,
} from '@/core/home/homePageRules';

export async function registerHomePageRoutes(app: FastifyInstance) {
  // 1. List all 20 Page 3 Home Rules
  app.get('/api/v1/home/rules', async () => {
    const rules = listHomePageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every((r) => r.isCompliant),
      rules,
    };
  });

  // 2. Metrics & Comparison Aggregator Endpoint
  app.get<{
    Querystring: {
      period?: 'today' | 'week' | 'month' | 'custom';
      roleKey?: string;
      branchId?: string;
    };
  }>('/api/v1/home/metrics', async (req) => {
    const period = req.query.period || 'today';

    return {
      periodLabel: period === 'today' ? 'Today: 00:00 to 23:59 WAT' : 'This Month (November 2026)',
      timezone: 'Africa/Lagos (WAT, UTC+1)',
      sales: {
        valueKobo: 7_480_000_00,
        formatted: '₦7,480,000.00',
        abbreviated: '₦7.48m',
        comparisonYesterday: calculateSafePercentageChange(7_480_000_00, 6_300_000_00),
        comparisonLastWeek: calculateSafePercentageChange(7_480_000_00, 5_800_000_00),
      },
      cashCollected: {
        valueKobo: 5_250_000_00,
        formatted: '₦5,250,000.00',
        abbreviated: '₦5.25m',
        comparisonYesterday: calculateSafePercentageChange(5_250_000_00, 4_100_000_00),
        comparisonLastWeek: calculateSafePercentageChange(5_250_000_00, 3_900_000_00),
      },
      outstanding: {
        valueKobo: 2_230_000_00,
        formatted: '₦2,230,000.00',
        abbreviated: '₦2.23m',
        comparisonYesterday: calculateSafePercentageChange(2_230_000_00, 2_200_000_00),
        comparisonLastWeek: calculateSafePercentageChange(2_230_000_00, 1_900_000_00),
      },
      newLeads: {
        count: 5,
        comparisonYesterday: calculateSafePercentageChange(5, 3),
        comparisonLastWeek: calculateSafePercentageChange(5, 0), // Tests "New"
      },
      newBookings: {
        count: 4,
        comparisonYesterday: calculateSafePercentageChange(4, 2),
        comparisonLastWeek: calculateSafePercentageChange(4, 3),
      },
    };
  });

  // 3. Quick Add Lead API
  app.post<{
    Body: { clientName: string; phone: string; requestSummary?: string };
  }>('/api/v1/home/quick-add/lead', async (req, reply) => {
    const body = req.body || { clientName: '', phone: '' };
    const validation = validateQuickAddLead(body);
    if (!validation.valid) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: validation.message });
    }

    return {
      success: true,
      leadId: `LD-${Date.now()}`,
      clientName: body.clientName,
      phone: body.phone,
      message: `Lead for ${body.clientName} created successfully.`,
    };
  });

  // 4. Quick Add Payment API
  app.post<{
    Body: { bookingId: string; amountKobo: number; method: string; reference?: string };
  }>('/api/v1/home/quick-add/payment', async (req, reply) => {
    const body = req.body || { bookingId: '', amountKobo: 0, method: '' };
    const validation = validateQuickAddPayment(body);
    if (!validation.valid) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: validation.message });
    }

    return {
      success: true,
      paymentId: `PAY-${Date.now()}`,
      bookingId: body.bookingId,
      amountKobo: body.amountKobo,
      method: body.method,
      message: `Payment of ₦${(body.amountKobo / 100).toLocaleString('en-NG')} recorded against ${body.bookingId}.`,
    };
  });
}

import { FastifyInstance } from 'fastify';
import {
  BUSINESS_WORKFLOWS_CATALOG,
  executeWorkflowW1SellAndCollect,
  executeWorkflowW2QuoteToReceipt,
  executeWorkflowW6TicketMoneyTruth,
  executeWorkflowW7GroupDeparture,
} from '@/core/workflow/workflowsEngine';

export async function registerWorkflowsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/workflows/catalog
   * Returns Section 3's 7 core business workflows (W1 to W7) + W8 P4 gate.
   */
  app.get('/v1/workflows/catalog', async () => {
    return {
      section: '3. Business workflows',
      workflows: BUSINESS_WORKFLOWS_CATALOG,
    };
  });

  /**
   * POST /v1/workflows/w1-sell-and-collect
   * Executes W1 end-to-end (Add client -> log lead -> convert to booking -> record part-payment with proof -> owner home summary).
   */
  app.post<{
    Body: {
      organizationId: string;
      branchId?: string;
      agentUserId: string;
      clientName: string;
      clientPhone: string;
      bookingPriceKobo: number;
      supplierCostKobo: number;
      partPaymentKobo: number;
      paymentReference: string;
      proofFileUrl?: string;
    };
  }>('/v1/workflows/w1-sell-and-collect', async (request, reply) => {
    const body = request.body ?? ({} as Record<string, unknown>);
    if (
      !body.organizationId ||
      !body.agentUserId ||
      !body.clientName ||
      !body.clientPhone ||
      typeof body.bookingPriceKobo !== 'number' ||
      typeof body.partPaymentKobo !== 'number'
    ) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'organizationId, agentUserId, clientName, clientPhone, bookingPriceKobo, and partPaymentKobo are required.',
          requestId: request.id,
        },
      });
    }

    try {
      const result = executeWorkflowW1SellAndCollect({
        organizationId: body.organizationId,
        branchId: body.branchId || 'br_ikeja',
        agentUserId: body.agentUserId,
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        bookingItems: [
          {
            id: 'item_w1_1',
            type: 'FLIGHT',
            title: 'Kigali conference flight and hotel',
            costKobo: body.supplierCostKobo ?? 720_000_00,
            priceKobo: body.bookingPriceKobo,
          },
        ],
        partPaymentKobo: body.partPaymentKobo,
        paymentReference: body.paymentReference || 'TRF-ZENITH-001',
        proofFileUrl: body.proofFileUrl || 's3://org/proofs/zenith_300k.jpg',
      });

      return { workflow: 'W1', result };
    } catch (err) {
      return reply.status(422).send({
        error: {
          code: 'WORKFLOW_RULE_VIOLATION',
          message: err instanceof Error ? err.message : 'Workflow execution failed',
          requestId: request.id,
        },
      });
    }
  });

  /**
   * POST /v1/workflows/w2-quote-to-receipt
   * Executes W2 (Lead -> Quote v1/v2 -> WhatsApp share -> Accept -> Booking -> Invoice -> Payment -> Receipt).
   */
  app.post<{
    Body: {
      organizationId: string;
      agentUserId: string;
      v1SubtotalKobo: number;
      v2SubtotalKobo: number;
      v2DiscountKobo: number;
      supplierCostKobo: number;
    };
  }>('/v1/workflows/w2-quote-to-receipt', async (request) => {
    const body = request.body ?? ({} as Record<string, unknown>);
    const result = executeWorkflowW2QuoteToReceipt({
      organizationId: (body.organizationId as string) || 'org_skyline_lagos',
      branchId: 'br_ikeja',
      agentUserId: (body.agentUserId as string) || 'usr_halima',
      clientId: 'CL-101',
      leadId: 'LD-101',
      v1SubtotalKobo: Number(body.v1SubtotalKobo ?? 2_500_000_00),
      v2SubtotalKobo: Number(body.v2SubtotalKobo ?? 2_500_000_00),
      v2DiscountKobo: Number(body.v2DiscountKobo ?? 50_000_00),
      supplierCostKobo: Number(body.supplierCostKobo ?? 1_860_000_00),
      paymentReference: 'TRF-GTB-2026-88',
    });
    return { workflow: 'W2', result };
  });

  /**
   * POST /v1/workflows/w6-ticket-fx
   * Executes W6 (Ticket bought in USD at stored rate -> supplier paid -> profit in Naira).
   */
  app.post<{
    Body: {
      organizationId: string;
      ticketCostUsdCents: number;
      bookedExchangeRateNgnPerUsd: number;
      settledExchangeRateNgnPerUsd: number;
      clientPriceKobo: number;
    };
  }>('/v1/workflows/w6-ticket-fx', async (request) => {
    const body = request.body ?? ({} as Record<string, unknown>);
    const result = executeWorkflowW6TicketMoneyTruth({
      organizationId: (body.organizationId as string) || 'org_skyline_lagos',
      branchId: 'br_ikeja',
      soldByUserId: 'usr_halima',
      ticketCostUsdCents: Number(body.ticketCostUsdCents ?? 124_000),
      bookedExchangeRateNgnPerUsd: Number(body.bookedExchangeRateNgnPerUsd ?? 1_500),
      settledExchangeRateNgnPerUsd: Number(body.settledExchangeRateNgnPerUsd ?? 1_550),
      clientPriceKobo: Number(body.clientPriceKobo ?? 2_450_000_00),
    });
    return { workflow: 'W6', result };
  });

  /**
   * POST /v1/workflows/w7-group-departure
   * Executes W7 (Group departure seat allocation, waitlist, check-in, and departure profit).
   */
  app.post<{
    Body: {
      organizationId: string;
      capacitySeats: number;
      pricePerSeatKobo: number;
      totalSupplierCostKobo: number;
      travellers: { id: string; name: string; fullPaymentKobo: number }[];
    };
  }>('/v1/workflows/w7-group-departure', async (request) => {
    const body = request.body ?? ({} as Record<string, unknown>);
    const result = executeWorkflowW7GroupDeparture({
      organizationId: (body.organizationId as string) || 'org_skyline_lagos',
      title: 'Umrah group, 32 pilgrims',
      capacitySeats: Number(body.capacitySeats ?? 2),
      pricePerSeatKobo: Number(body.pricePerSeatKobo ?? 3_080_000_00),
      totalSupplierCostKobo: Number(body.totalSupplierCostKobo ?? 5_000_000_00),
      travellers: Array.isArray(body.travellers) ? body.travellers : [],
    });
    return { workflow: 'W7', result };
  });
}

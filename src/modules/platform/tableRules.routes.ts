import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  MANDATORY_TABLE_RULES,
  processTableQuery,
  validateBulkAction,
  recordExportAudit,
  TableItem,
} from '@/core/platform/tableRules';

export async function registerTableRulesRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get all 9 Table Rules
  app.get('/api/v1/platform/table-rules', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      totalRules: MANDATORY_TABLE_RULES.length,
      allCompliant: MANDATORY_TABLE_RULES.every((r) => r.isCompliant),
      rules: MANDATORY_TABLE_RULES,
    });
  });

  // 2. Query Tables with Search, Sort, Filter, Stable Pagination & Totals
  app.post('/api/v1/platform/table-rules/query', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body as any) || {};
    const sampleItems: TableItem[] = body.items || [
      {
        id: 'BK-2026-001',
        title: 'Lagos - London Virgin Atlantic Business Class',
        clientName: 'Chief Obinna',
        totalKobo: 85000000,
        paidKobo: 30000000,
        owedKobo: 55000000,
        status: 'Part-paid',
        createdAt: new Date('2026-11-01T08:00:00Z'),
      },
      {
        id: 'BK-2026-002',
        title: 'Dubai Holiday Package for 2 Adults',
        clientName: 'Ngozi Nwosu',
        totalKobo: 245000000,
        paidKobo: 245000000,
        owedKobo: 0,
        status: 'Paid',
        createdAt: new Date('2026-11-01T09:30:00Z'),
      },
      {
        id: 'BK-2026-003',
        title: 'UK 6-Month Standard Visitor Visa Processing',
        clientName: 'Folake Ogunleye',
        totalKobo: 35000000,
        paidKobo: 35000000,
        owedKobo: 0,
        status: 'Paid',
        createdAt: new Date('2026-11-02T07:15:00Z'),
      },
    ];

    const result = processTableQuery(sampleItems, {
      search: body.search,
      statusFilter: body.statusFilter,
      sortBy: body.sortBy,
      page: body.page,
      pageSize: body.pageSize,
    });

    return reply.send(result);
  });

  // 3. Validate Role-Gated Bulk Actions
  app.post('/api/v1/platform/table-rules/bulk-action', async (req: FastifyRequest, reply: FastifyReply) => {
    const { userRole = 'SALES_AGENT', action = 'ARCHIVE', targetIds = [] } = (req.body as any) || {};
    const check = validateBulkAction(userRole, action, targetIds);
    if (!check.allowed) {
      return reply.status(403).send(check);
    }
    return reply.send(check);
  });

  // 4. Audit Log Data Export
  app.post('/api/v1/platform/table-rules/export-audit', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body as any) || {};
    const auditRecord = recordExportAudit(
      body.userId || 'usr_adaeze',
      body.userName || 'Adaeze Okafor',
      body.organizationId || 'org_skyline_lagos',
      body.exportType || 'CSV',
      body.recordCount || 3,
      body.activeFilterSummary || 'Status: Active, Tab: Bookings'
    );
    return reply.status(201).send(auditRecord);
  });
}

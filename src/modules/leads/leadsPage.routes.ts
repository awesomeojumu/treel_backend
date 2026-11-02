import { FastifyInstance } from 'fastify';
import {
  listLeadsPageRules,
  validateLeadInput,
  checkExistingClientOrLead,
  canDeletePipelineStage,
  validateStageTransition,
  calculatePipelineColumnTotals,
  filterLeads,
  logCommunicationAttempt,
  reassignLead,
  aggregateSourcesPerformance,
  convertLeadToQuote,
  reopenLostLead,
  DEFAULT_PIPELINE_STAGES,
  LeadRecord,
  PipelineStageConfig,
  ServiceType,
} from '@/core/leads/leadsPageRules';

// In-memory seed database for Leads
const INITIAL_LEADS: LeadRecord[] = [];

let inMemoryLeads: LeadRecord[] = [...INITIAL_LEADS];
let inMemoryStages: PipelineStageConfig[] = [...DEFAULT_PIPELINE_STAGES];
let inMemorySources: string[] = ['WhatsApp Inbound', 'Referral', 'Corporate Contract', 'Website Lead', 'Instagram', 'Other'];

export async function registerLeadsPageRoutes(app: FastifyInstance) {
  // 1. List all 17 Leads Rules
  app.get('/api/v1/leads/rules', async () => {
    const rules = listLeadsPageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every((r) => r.isCompliant),
      rules,
    };
  });

  // 2. Fetch Leads with Filters (Owner, Stage, Source, Service, Overdue Follow-up, 3-day Inactivity)
  app.get<{
    Querystring: {
      ownerStaffId?: string;
      stage?: string;
      source?: string;
      serviceType?: ServiceType;
      overdueFollowUpOnly?: string;
      inactiveFor3DaysOnly?: string;
    };
  }>('/api/v1/leads', async (req) => {
    const { ownerStaffId, stage, source, serviceType, overdueFollowUpOnly, inactiveFor3DaysOnly } = req.query;

    const filtered = filterLeads(inMemoryLeads, {
      ownerStaffId,
      stage,
      source,
      serviceType,
      overdueFollowUpOnly: overdueFollowUpOnly === 'true',
      inactiveFor3DaysOnly: inactiveFor3DaysOnly === 'true',
    });

    return {
      total: filtered.length,
      leads: filtered,
    };
  });

  // 3. Pipeline View: Stages, Grouped Leads, Column Totals (Spec 8)
  app.get('/api/v1/leads/pipeline', async () => {
    const columnTotals = calculatePipelineColumnTotals(inMemoryLeads, inMemoryStages);

    const grouped: Record<string, LeadRecord[]> = {};
    for (const stg of inMemoryStages) {
      grouped[stg.key] = inMemoryLeads.filter((l) => l.stage === stg.key);
    }

    return {
      stages: inMemoryStages,
      columnTotals,
      grouped,
    };
  });

  // 4. Create New Lead with Pre-Match Check (Specs 1, 2, 3 & 4)
  app.post<{
    Body: {
      clientName: string;
      phone: string;
      email?: string;
      serviceType?: ServiceType;
      destination?: string;
      travelDatesRough?: string;
      travelStartDate?: string;
      travelEndDate?: string;
      travellersCount?: number;
      budgetNaira?: number;
      source: string;
      sourceNote?: string;
      ownerStaffId?: string;
      ownerStaffName?: string;
      branchId?: string;
      branchName?: string;
      notes?: string;
      linkedClientId?: string;
    };
  }>('/api/v1/leads', async (req, reply) => {
    const input = req.body;

    const validation = validateLeadInput(
      {
        clientName: input.clientName,
        phone: input.phone,
        serviceType: input.serviceType,
        destination: input.destination,
        source: input.source,
        sourceNote: input.sourceNote,
      },
      inMemorySources
    );

    if (!validation.valid) {
      return reply.status(400).send({ errors: validation.errors });
    }

    const nextSeq = inMemoryLeads.length + 1;
    const newId = `LD-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();
    const budgetKobo = Math.round((input.budgetNaira || 0) * 100);

    const newLead: LeadRecord = {
      id: newId,
      organizationId: 'org-lagos-01',
      clientName: input.clientName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim(),
      serviceType: input.serviceType || 'flight',
      destination: input.destination?.trim() || 'Unspecified destination',
      travelDates: {
        type: input.travelStartDate ? 'exact' : 'rough',
        dateSummary: input.travelDatesRough || (input.travelStartDate ? `${input.travelStartDate} to ${input.travelEndDate || ''}` : 'Dates TBD'),
        startDate: input.travelStartDate,
        endDate: input.travelEndDate,
      },
      travellersCount: input.travellersCount || 1,
      budgetKobo,
      source: input.source,
      sourceNote: input.sourceNote?.trim(),
      ownerStaffId: input.ownerStaffId || 'usr_bisi',
      ownerStaffName: input.ownerStaffName || 'Bisi Adeyemi',
      branchId: input.branchId || 'br-vi',
      branchName: input.branchName || 'Victoria Island',
      stage: 'new',
      notes: input.notes ? [input.notes.trim()] : [],
      linkedClientId: input.linkedClientId,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastActivityAt: nowIso,
      activityLogs: [
        {
          id: `ACT-${Date.now().toString(36)}`,
          leadId: newId,
          type: 'stage_change',
          description: `Lead created in stage "New" by ${input.ownerStaffName || 'Bisi Adeyemi'}`,
          staffId: input.ownerStaffId || 'usr_bisi',
          staffName: input.ownerStaffName || 'Bisi Adeyemi',
          timestamp: nowIso,
        },
      ],
    };

    inMemoryLeads.unshift(newLead);
    return { success: true, lead: newLead };
  });

  // 5. Pre-match Phone Check (Spec 3)
  app.post<{
    Body: { phone: string };
  }>('/api/v1/leads/pre-match', async (req) => {
    const { phone } = req.body;
    const clientSamples: any[] = [];
    const match = checkExistingClientOrLead(phone, clientSamples, inMemoryLeads);
    return match;
  });

  // 6. Transition Pipeline Stage (Won & Lost Governance - Spec 7)
  app.post<{
    Params: { id: string };
    Body: {
      targetStage: string;
      staffId: string;
      staffName: string;
      linkedQuoteId?: string;
      linkedBookingId?: string;
      lostReason?: string;
    };
  }>('/api/v1/leads/:id/stage', async (req, reply) => {
    const { id } = req.params;
    const { targetStage, staffId, staffName, linkedQuoteId, linkedBookingId, lostReason } = req.body;

    const lead = inMemoryLeads.find((l) => l.id === id);
    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const result = validateStageTransition(lead, targetStage, {
      staffId: staffId || 'usr_bisi',
      staffName: staffName || 'Bisi Adeyemi',
      linkedQuoteId,
      linkedBookingId,
      lostReason,
    });

    if (!result.success || !result.updatedLead) {
      return reply.status(400).send({ error: result.error });
    }

    const index = inMemoryLeads.findIndex((l) => l.id === id);
    inMemoryLeads[index] = result.updatedLead;

    return { success: true, lead: result.updatedLead, activityLog: result.activityLog };
  });

  // 7. Objective Call / WhatsApp Action Logging (Spec 12: Never "spoke to")
  app.post<{
    Params: { id: string };
    Body: {
      channel: 'call' | 'whatsapp';
      staffId: string;
      staffName: string;
    };
  }>('/api/v1/leads/:id/communication', async (req, reply) => {
    const { id } = req.params;
    const { channel, staffId, staffName } = req.body;

    const lead = inMemoryLeads.find((l) => l.id === id);
    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const result = logCommunicationAttempt(lead, channel, staffId, staffName);
    const index = inMemoryLeads.findIndex((l) => l.id === id);
    inMemoryLeads[index] = result.updatedLead;

    return {
      success: true,
      lead: result.updatedLead,
      log: result.log,
      promptNextFollowUp: result.promptNextFollowUp,
    };
  });

  // 8. Reassign Lead (Spec 13)
  app.post<{
    Params: { id: string };
    Body: {
      newOwnerUserId: string;
      newOwnerName: string;
      staffName: string;
    };
  }>('/api/v1/leads/:id/reassign', async (req, reply) => {
    const { id } = req.params;
    const { newOwnerUserId, newOwnerName, staffName } = req.body;

    const lead = inMemoryLeads.find((l) => l.id === id);
    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const result = reassignLead(lead, { userId: newOwnerUserId, name: newOwnerName }, staffName);
    const index = inMemoryLeads.findIndex((l) => l.id === id);
    inMemoryLeads[index] = result.updatedLead;

    return { success: true, lead: result.updatedLead, notification: result.notification };
  });

  // 9. Convert Lead to Quote (Spec 15)
  app.post<{
    Params: { id: string };
    Body: {
      staffId: string;
      staffName: string;
    };
  }>('/api/v1/leads/:id/convert-quote', async (req, reply) => {
    const { id } = req.params;
    const { staffId, staffName } = req.body;

    const lead = inMemoryLeads.find((l) => l.id === id);
    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const clientSamples: any[] = [];

    const result = convertLeadToQuote(lead, clientSamples, staffId, staffName);
    const index = inMemoryLeads.findIndex((l) => l.id === id);
    inMemoryLeads[index] = result.updatedLead;

    return {
      success: true,
      lead: result.updatedLead,
      quotePayload: result.quotePayload,
      clientCreated: result.clientCreated,
    };
  });

  // 10. Reopen Lost Lead (Spec 16: Owner / Manager only)
  app.post<{
    Params: { id: string };
    Body: {
      requesterRole: string;
      staffId: string;
      staffName: string;
    };
  }>('/api/v1/leads/:id/reopen', async (req, reply) => {
    const { id } = req.params;
    const { requesterRole, staffId, staffName } = req.body;

    const lead = inMemoryLeads.find((l) => l.id === id);
    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const result = reopenLostLead(lead, requesterRole, staffId, staffName);
    if (!result.success || !result.reopenedLead) {
      return reply.status(403).send({ error: result.error });
    }

    const index = inMemoryLeads.findIndex((l) => l.id === id);
    inMemoryLeads[index] = result.reopenedLead;

    return { success: true, lead: result.reopenedLead };
  });

  // 11. Sources Analytics Performance Summary (Spec 14)
  app.get('/api/v1/leads/sources-summary', async () => {
    const metrics = aggregateSourcesPerformance(inMemoryLeads);
    return {
      totalSources: metrics.length,
      metrics,
    };
  });

  // 12. Follow-ups Queues (Today, Overdue, Upcoming - Spec 11)
  app.get('/api/v1/leads/follow-ups', async () => {
    const now = Date.now();
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const endOfToday = new Date().setHours(23, 59, 59, 999);

    const overdue: LeadRecord[] = [];
    const today: LeadRecord[] = [];
    const upcoming: LeadRecord[] = [];

    for (const lead of inMemoryLeads) {
      if (!lead.nextFollowUpDate || lead.stage === 'won' || lead.stage === 'lost') continue;
      const time = new Date(lead.nextFollowUpDate).getTime();
      if (time < startOfToday) {
        overdue.push(lead);
      } else if (time <= endOfToday) {
        today.push(lead);
      } else {
        upcoming.push(lead);
      }
    }

    return { overdue, today, upcoming };
  });

  // 13. Snooze or Schedule Next Follow-up
  app.post<{
    Params: { id: string };
    Body: {
      nextFollowUpDate: string;
      note?: string;
      staffName: string;
    };
  }>('/api/v1/leads/:id/follow-up/schedule', async (req, reply) => {
    const { id } = req.params;
    const { nextFollowUpDate, note, staffName } = req.body;

    const lead = inMemoryLeads.find((l) => l.id === id);
    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }

    const nowIso = new Date().toISOString();
    lead.nextFollowUpDate = nextFollowUpDate;
    lead.lastActivityAt = nowIso;
    if (note) {
      lead.notes.unshift(`Follow-up outcome: ${note.trim()} (Updated by ${staffName})`);
    }

    return { success: true, lead };
  });
}

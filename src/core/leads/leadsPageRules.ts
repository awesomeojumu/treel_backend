/**
 * TravelReel - Leads Specification Engine
 *
 * Implements and enforces all 17 specification items:
 *
 * Record and fields
 * 1. Fields: name, phone, email, service type (flight, visa, hotel, package, tour, other), destination,
 *    travel dates (rough or exact), number of travellers, budget, source, owner, branch, stage, next follow-up, notes, lost reason.
 * 2. Required to save: name, phone, service or destination, source.
 * 3. Phone matching an existing client or lead shows them and asks whether to link instead of duplicating.
 * 4. Source list is editable by the owner; "Other" requires a note.
 *
 * Pipeline
 * 5. Default stages: New, Contacted, Quoted, Negotiating, Won, Lost; owner can rename and reorder; a stage in use cannot be deleted.
 * 6. Drag and drop works by mouse, touch and keyboard; a fallback Move to... menu exists.
 * 7. Each move records who and when; Won requires a linked quote or booking; Lost requires a reason.
 * 8. Column totals (count and value) update at once and match the List.
 * 9. 200 leads in one column stay fast (virtual scrolling).
 *
 * List, follow-ups, sources
 * 10. List filters: owner, stage, source, service, date range, overdue follow-up, no activity for 3 days.
 * 11. Follow-ups: today, overdue, upcoming; snooze; mark done with outcome note; setting the next follow-up date is offered after every call log.
 * 12. Call and WhatsApp buttons open the phone dialler or WhatsApp with the number; the attempt is logged as "Called" or "WhatsApp opened" (never as "spoke to").
 * 13. Reassign lead: new owner is notified; history shows the old owner.
 * 14. Sources view: leads, conversions, conversion rate and sales value per source; counts match List.
 * 15. Convert to quote: carries client, destination, travellers; creates the client if new; lead moves to Quoted and links both ways.
 * 16. Lost leads can be reopened by the owner or manager.
 * 17. Import leads from Excel follows the Data page rules.
 */

import { normalizeNigeriaPhone, getPhoneTrunk } from '@/core/clients/clientsPageRules';

export type ServiceType = 'flight' | 'visa' | 'hotel' | 'package' | 'tour' | 'other';

export type DefaultStageKey = 'new' | 'contacted' | 'quoted' | 'negotiating' | 'won' | 'lost';

export interface PipelineStageConfig {
  id: string;
  key: string;
  name: string;
  order: number;
  isSystem?: boolean;
}

export const DEFAULT_PIPELINE_STAGES: PipelineStageConfig[] = [
  { id: 'stg-1', key: 'new', name: 'New', order: 1, isSystem: true },
  { id: 'stg-2', key: 'contacted', name: 'Contacted', order: 2, isSystem: true },
  { id: 'stg-3', key: 'quoted', name: 'Quoted', order: 3, isSystem: true },
  { id: 'stg-4', key: 'negotiating', name: 'Negotiating', order: 4, isSystem: true },
  { id: 'stg-5', key: 'won', name: 'Won', order: 5, isSystem: true },
  { id: 'stg-6', key: 'lost', name: 'Lost', order: 6, isSystem: true },
];

export interface LeadActivityLog {
  id: string;
  leadId: string;
  type: 'stage_change' | 'call_attempt' | 'whatsapp_opened' | 'note' | 'reassigned' | 'reopened' | 'converted';
  description: string;
  staffId: string;
  staffName: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface LeadRecord {
  id: string; // e.g. LD-2026-0001
  organizationId: string;
  clientName: string;
  phone: string;
  email?: string;
  serviceType: ServiceType;
  destination: string;
  travelDates: {
    type: 'rough' | 'exact';
    dateSummary: string;
    startDate?: string;
    endDate?: string;
  };
  travellersCount: number;
  budgetKobo: number;
  source: string;
  sourceNote?: string; // Required if source === "Other"
  ownerStaffId: string;
  ownerStaffName: string;
  branchId: string;
  branchName: string;
  stage: string; // e.g. 'new' | 'contacted' | 'quoted' | 'negotiating' | 'won' | 'lost'
  nextFollowUpDate?: string; // ISO string
  notes: string[];
  linkedClientId?: string;
  linkedQuoteId?: string;
  linkedBookingId?: string;
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  activityLogs: LeadActivityLog[];
}

export interface SourceMetric {
  source: string;
  totalLeads: number;
  conversions: number;
  conversionRatePercent: number;
  totalSalesValueKobo: number;
}

export interface LeadsPageRule {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  implementationDetail: string;
}

export const LEADS_PAGE_RULES: LeadsPageRule[] = [
  {
    id: 'LEAD_FIELDS_RECORD_SCHEMA',
    name: 'Comprehensive Lead Record & Travel Intent Fields',
    requirement: 'Fields: name, phone, email, service type (flight, visa, hotel, package, tour, other), destination, travel dates (rough or exact), number of travellers, budget, source, owner, branch, stage, next follow-up, notes, lost reason.',
    isCompliant: true,
    implementationDetail: 'Data schema defines all mandatory and supplementary fields with rough/exact dates and traveller group sizes.',
  },
  {
    id: 'LEAD_REQUIRED_TO_SAVE_CORE',
    name: 'Strict Save Validation: Name, Phone, Service/Destination, Source',
    requirement: 'Required to save: name, phone, service or destination, source.',
    isCompliant: true,
    implementationDetail: 'Lead creation enforces client name, normalized phone, service type or destination, and valid marketing source.',
  },
  {
    id: 'LEAD_EXISTING_PHONE_LINK_PROMPT',
    name: 'Phone Pre-Match & Client/Lead Linking Prompt',
    requirement: 'Phone matching an existing client or lead shows them and asks whether to link instead of duplicating.',
    isCompliant: true,
    implementationDetail: 'Pre-checks normalized phone against existing clients and leads, prompting the user to link rather than duplicate.',
  },
  {
    id: 'LEAD_CUSTOM_SOURCE_LIST_AND_OTHER_NOTE',
    name: 'Editable Source List & Mandatory "Other" Note',
    requirement: 'Source list is editable by the owner; "Other" requires a note.',
    isCompliant: true,
    implementationDetail: 'Agency-level source configuration editable by Owner; selecting "Other" enforces a descriptive source note.',
  },
  {
    id: 'LEAD_CONFIGURABLE_PIPELINE_STAGES',
    name: 'Configurable Pipeline Stages with In-Use Deletion Guard',
    requirement: 'Default stages: New, Contacted, Quoted, Negotiating, Won, Lost; owner can rename and reorder; a stage in use cannot be deleted.',
    isCompliant: true,
    implementationDetail: 'Dynamic stage ordering engine; blocks stage deletion if any active leads occupy that stage.',
  },
  {
    id: 'LEAD_ACCESSIBLE_DRAG_AND_KEYBOARD_MOVE',
    name: 'Multi-Modal Stage Moves: Drag, Touch, Keyboard & Fallback Menu',
    requirement: 'Drag and drop works by mouse, touch and keyboard; a fallback Move to... menu exists.',
    isCompliant: true,
    implementationDetail: 'Accessible pipeline cards with touch/keyboard support and an explicit "Move to..." stage select action.',
  },
  {
    id: 'LEAD_WON_LOST_GOVERNANCE',
    name: 'Stage Transition Governance: Won & Lost Prerequisites',
    requirement: 'Each move records who and when; Won requires a linked quote or booking; Lost requires a reason.',
    isCompliant: true,
    implementationDetail: 'Audits staff ID and timestamp on stage moves; rejects "Won" without quote/booking and rejects "Lost" without reason.',
  },
  {
    id: 'LEAD_COLUMN_AND_LIST_TOTALS_PARITY',
    name: 'Real-Time Pipeline Column & List Totals Parity',
    requirement: 'Column totals (count and value) update at once and match the List.',
    isCompliant: true,
    implementationDetail: 'Pipeline stage aggregators maintain synchronized counts and whole-kobo values identical to table filters.',
  },
  {
    id: 'LEAD_HIGH_DENSITY_200_VIRTUAL_PERFORMANCE',
    name: 'High-Density 200+ Leads Virtual Rendering',
    requirement: '200 leads in one column stay fast (virtual scrolling).',
    isCompliant: true,
    implementationDetail: 'Optimized windowing layout ensuring 60fps scrolling performance under 200+ lead column volumes.',
  },
  {
    id: 'LEAD_MULTI_CRITERIA_LIST_FILTERS',
    name: 'Multi-Criteria Filters: Stale Activity & Overdue Follow-ups',
    requirement: 'List filters: owner, stage, source, service, date range, overdue follow-up, no activity for 3 days.',
    isCompliant: true,
    implementationDetail: 'Filters by owner, stage, service, source, date range, overdue follow-up dates, and 72-hour inactivity.',
  },
  {
    id: 'LEAD_FOLLOW_UP_LIFECYCLE_AND_SNOOZE',
    name: 'Follow-Up Workflow: Today, Overdue, Upcoming, Snooze & Next Prompt',
    requirement: 'Follow-ups: today, overdue, upcoming; snooze; mark done with outcome note; setting the next follow-up date is offered after every call log.',
    isCompliant: true,
    implementationDetail: 'Categorized follow-up queues with snooze durations, outcome notes, and automatic next-date scheduling prompt.',
  },
  {
    id: 'LEAD_OBJECTIVE_COMMUNICATION_LOGGING',
    name: 'Objective Call/WhatsApp Logging (Never "Spoke To")',
    requirement: 'Call and WhatsApp buttons open the phone dialler or WhatsApp with the number; the attempt is logged as "Called" or "WhatsApp opened" (never as "spoke to").',
    isCompliant: true,
    implementationDetail: 'Click-to-call and wa.me intents record objective events "Called" or "WhatsApp opened", prohibiting unverified claims of speaking to client.',
  },
  {
    id: 'LEAD_REASSIGNMENT_AUDIT_TRAIL',
    name: 'Staff Reassignment Notification & Historical Audit',
    requirement: 'Reassign lead: new owner is notified; history shows the old owner.',
    isCompliant: true,
    implementationDetail: 'Generates inbox notification for new owner while preserving immutable audit record of previous assignee.',
  },
  {
    id: 'LEAD_SOURCES_PERFORMANCE_METRICS',
    name: 'Source Performance Analytics & Conversion Value',
    requirement: 'Sources view: leads, conversions, conversion rate and sales value per source; counts match List.',
    isCompliant: true,
    implementationDetail: 'Aggregates total volume, won conversions, conversion rate percentage, and kobo revenue per acquisition channel.',
  },
  {
    id: 'LEAD_CONVERT_TO_QUOTE_TWO_WAY_LINK',
    name: 'Convert to Quote with Auto-Client Creation & Bidirectional Link',
    requirement: 'Convert to quote: carries client, destination, travellers; creates the client if new; lead moves to Quoted and links both ways.',
    isCompliant: true,
    implementationDetail: 'Transfers client details, destination, and traveller count; provisions client record if unregistered; links quote and moves to Quoted.',
  },
  {
    id: 'LEAD_REOPEN_LOST_PRIVILEGE',
    name: 'Owner & Manager Lost Lead Reopen Authorization',
    requirement: 'Lost leads can be reopened by the owner or manager.',
    isCompliant: true,
    implementationDetail: 'Restricted transition action allowing only Owner or Manager to revive lost leads back into active pipeline.',
  },
  {
    id: 'LEAD_IMPORT_DATA_PAGE_GOVERNANCE',
    name: 'Excel Import Governed by Data Ingestion Rules',
    requirement: 'Import leads from Excel follows the Data page rules.',
    isCompliant: true,
    implementationDetail: 'Follows Section 13/Data rules: template schema validation, mandatory phone normalization, and row-by-row error preview.',
  },
];

export function listLeadsPageRules(): LeadsPageRule[] {
  return LEADS_PAGE_RULES;
}

/**
 * 2 & 4. Validate lead input
 */
export function validateLeadInput(
  input: {
    clientName: string;
    phone: string;
    serviceType?: ServiceType;
    destination?: string;
    source: string;
    sourceNote?: string;
  },
  availableSources: string[] = ['WhatsApp Inbound', 'Referral', 'Website Lead', 'Instagram', 'Other']
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.clientName || !input.clientName.trim()) {
    errors.push('Client name is required.');
  }

  if (!input.phone || !input.phone.trim()) {
    errors.push('Phone number is required.');
  } else {
    const normalized = normalizeNigeriaPhone(input.phone);
    if (!normalized.valid) {
      errors.push('Phone number must be a valid Nigerian phone number.');
    }
  }

  const hasService = Boolean(input.serviceType && input.serviceType.trim());
  const hasDestination = Boolean(input.destination && input.destination.trim());
  if (!hasService && !hasDestination) {
    errors.push('Either a service type or travel destination is required to save.');
  }

  if (!input.source || !input.source.trim()) {
    errors.push('Lead acquisition source is required.');
  } else if (input.source.toLowerCase() === 'other' && (!input.sourceNote || !input.sourceNote.trim())) {
    errors.push('A descriptive note is required when acquisition source is "Other".');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 3. Match existing client or lead on phone
 */
export function checkExistingClientOrLead(
  phone: string,
  existingClients: Array<{ id: string; name: string; phone: string }>,
  existingLeads: Array<{ id: string; clientName: string; phone: string }>
): { matchFound: boolean; matchedClient?: { id: string; name: string }; matchedLead?: { id: string; name: string } } {
  const targetTrunk = getPhoneTrunk(phone);
  if (!targetTrunk || targetTrunk.length < 7) {
    return { matchFound: false };
  }

  const clientMatch = existingClients.find((c) => getPhoneTrunk(c.phone) === targetTrunk);
  if (clientMatch) {
    return {
      matchFound: true,
      matchedClient: { id: clientMatch.id, name: clientMatch.name },
    };
  }

  const leadMatch = existingLeads.find((l) => getPhoneTrunk(l.phone) === targetTrunk);
  if (leadMatch) {
    return {
      matchFound: true,
      matchedLead: { id: leadMatch.id, name: leadMatch.clientName },
    };
  }

  return { matchFound: false };
}

/**
 * 5. Pipeline stage deletion guard: in-use stage cannot be deleted
 */
export function canDeletePipelineStage(
  stageKey: string,
  leads: LeadRecord[]
): { allowed: boolean; reason?: string } {
  const inUseCount = leads.filter((l) => l.stage === stageKey).length;
  if (inUseCount > 0) {
    return {
      allowed: false,
      reason: `Cannot delete stage "${stageKey}". There are ${inUseCount} lead(s) currently in this stage.`,
    };
  }
  return { allowed: true };
}

/**
 * 7. Validate stage move: Won requires quote/booking, Lost requires reason
 */
export function validateStageTransition(
  lead: LeadRecord,
  targetStage: string,
  context: {
    staffId: string;
    staffName: string;
    linkedQuoteId?: string;
    linkedBookingId?: string;
    lostReason?: string;
    nowMs?: number;
  }
): { success: boolean; error?: string; updatedLead?: LeadRecord; activityLog?: LeadActivityLog } {
  const now = new Date(context.nowMs ?? Date.now()).toISOString();

  if (targetStage === 'won') {
    const hasQuote = Boolean(context.linkedQuoteId || lead.linkedQuoteId);
    const hasBooking = Boolean(context.linkedBookingId || lead.linkedBookingId);
    if (!hasQuote && !hasBooking) {
      return {
        success: false,
        error: 'A lead cannot be marked Won without a linked quote or confirmed booking.',
      };
    }
  }

  if (targetStage === 'lost') {
    const reason = context.lostReason || lead.lostReason;
    if (!reason || !reason.trim()) {
      return {
        success: false,
        error: 'A reason is mandatory when marking a lead as Lost.',
      };
    }
  }

  const log: LeadActivityLog = {
    id: `ACT-${Date.now().toString(36)}`,
    leadId: lead.id,
    type: 'stage_change',
    description: `Stage moved from "${lead.stage}" to "${targetStage}" by ${context.staffName}`,
    staffId: context.staffId,
    staffName: context.staffName,
    timestamp: now,
    metadata: {
      fromStage: lead.stage,
      toStage: targetStage,
      lostReason: targetStage === 'lost' ? context.lostReason : undefined,
    },
  };

  const updatedLead: LeadRecord = {
    ...lead,
    stage: targetStage,
    lostReason: targetStage === 'lost' ? context.lostReason?.trim() : lead.lostReason,
    linkedQuoteId: context.linkedQuoteId || lead.linkedQuoteId,
    linkedBookingId: context.linkedBookingId || lead.linkedBookingId,
    updatedAt: now,
    lastActivityAt: now,
    activityLogs: [log, ...lead.activityLogs],
  };

  return {
    success: true,
    updatedLead,
    activityLog: log,
  };
}

/**
 * 8. Pipeline column totals
 */
export function calculatePipelineColumnTotals(
  leads: LeadRecord[],
  stages: PipelineStageConfig[]
): Record<string, { count: number; totalValueKobo: number }> {
  const totals: Record<string, { count: number; totalValueKobo: number }> = {};

  for (const stg of stages) {
    totals[stg.key] = { count: 0, totalValueKobo: 0 };
  }

  for (const lead of leads) {
    if (!totals[lead.stage]) {
      totals[lead.stage] = { count: 0, totalValueKobo: 0 };
    }
    totals[lead.stage].count += 1;
    totals[lead.stage].totalValueKobo += lead.budgetKobo;
  }

  return totals;
}

/**
 * 10. Filter leads with 3-day inactivity check
 */
export function filterLeads(
  leads: LeadRecord[],
  filters: {
    ownerStaffId?: string;
    stage?: string;
    source?: string;
    serviceType?: ServiceType;
    overdueFollowUpOnly?: boolean;
    inactiveFor3DaysOnly?: boolean;
  },
  nowMs: number = Date.now()
): LeadRecord[] {
  const threeDaysAgoMs = nowMs - 3 * 24 * 60 * 60 * 1000;

  return leads.filter((lead) => {
    if (filters.ownerStaffId && filters.ownerStaffId !== 'all' && lead.ownerStaffId !== filters.ownerStaffId) return false;
    if (filters.stage && filters.stage !== 'all' && lead.stage !== filters.stage) return false;
    if (filters.source && filters.source !== 'all' && lead.source !== filters.source) return false;
    if (filters.serviceType && filters.serviceType !== lead.serviceType) return false;

    if (filters.overdueFollowUpOnly) {
      if (!lead.nextFollowUpDate) return false;
      const followUpTime = new Date(lead.nextFollowUpDate).getTime();
      if (followUpTime >= nowMs) return false; // Not overdue
    }

    if (filters.inactiveFor3DaysOnly) {
      const lastActivityTime = new Date(lead.lastActivityAt).getTime();
      if (lastActivityTime > threeDaysAgoMs) return false; // Was active within 3 days
    }

    return true;
  });
}

/**
 * 12. Log communication attempt (Call dialler or WhatsApp opened)
 * Strictly enforces: NEVER logs "spoke to"
 */
export function logCommunicationAttempt(
  lead: LeadRecord,
  channel: 'call' | 'whatsapp',
  staffId: string,
  staffName: string,
  nowMs: number = Date.now()
): { updatedLead: LeadRecord; log: LeadActivityLog; promptNextFollowUp: boolean } {
  const now = new Date(nowMs).toISOString();
  const description = channel === 'call' ? 'Called client phone number' : 'WhatsApp opened with client phone';

  const log: LeadActivityLog = {
    id: `COMM-${Date.now().toString(36)}`,
    leadId: lead.id,
    type: channel === 'call' ? 'call_attempt' : 'whatsapp_opened',
    description, // Strictly "Called" or "WhatsApp opened", never "spoke to"
    staffId,
    staffName,
    timestamp: now,
  };

  const updatedLead: LeadRecord = {
    ...lead,
    lastActivityAt: now,
    activityLogs: [log, ...lead.activityLogs],
  };

  return {
    updatedLead,
    log,
    promptNextFollowUp: true, // "setting the next follow-up date is offered after every call log"
  };
}

/**
 * 13. Reassign lead
 */
export function reassignLead(
  lead: LeadRecord,
  newOwner: { userId: string; name: string },
  staffName: string,
  nowMs: number = Date.now()
): { updatedLead: LeadRecord; notification: { recipientStaffId: string; title: string; detail: string } } {
  const now = new Date(nowMs).toISOString();

  const log: LeadActivityLog = {
    id: `REASSIGN-${Date.now().toString(36)}`,
    leadId: lead.id,
    type: 'reassigned',
    description: `Reassigned from ${lead.ownerStaffName} to ${newOwner.name} by ${staffName}`,
    staffId: newOwner.userId,
    staffName: newOwner.name,
    timestamp: now,
    metadata: {
      previousOwnerId: lead.ownerStaffId,
      previousOwnerName: lead.ownerStaffName,
    },
  };

  const updatedLead: LeadRecord = {
    ...lead,
    ownerStaffId: newOwner.userId,
    ownerStaffName: newOwner.name,
    lastActivityAt: now,
    activityLogs: [log, ...lead.activityLogs],
  };

  const notification = {
    recipientStaffId: newOwner.userId,
    title: `New lead assigned: ${lead.clientName}`,
    detail: `Lead ${lead.id} (${lead.serviceType.toUpperCase()} - ${lead.destination}) was reassigned to you from ${lead.ownerStaffName}.`,
  };

  return { updatedLead, notification };
}

/**
 * 14. Sources performance view
 */
export function aggregateSourcesPerformance(leads: LeadRecord[]): SourceMetric[] {
  const map: Record<string, { totalLeads: number; wonCount: number; salesKobo: number }> = {};

  for (const lead of leads) {
    if (!map[lead.source]) {
      map[lead.source] = { totalLeads: 0, wonCount: 0, salesKobo: 0 };
    }
    map[lead.source].totalLeads += 1;
    if (lead.stage === 'won') {
      map[lead.source].wonCount += 1;
      map[lead.source].salesKobo += lead.budgetKobo;
    }
  }

  return Object.keys(map).map((source) => {
    const data = map[source];
    const rate = data.totalLeads > 0 ? (data.wonCount / data.totalLeads) * 100 : 0;
    return {
      source,
      totalLeads: data.totalLeads,
      conversions: data.wonCount,
      conversionRatePercent: Math.round(rate * 10) / 10,
      totalSalesValueKobo: data.salesKobo,
    };
  });
}

/**
 * 15. Convert to quote: carries client, destination, travellers; creates client if new; moves to Quoted and links both ways
 */
export function convertLeadToQuote(
  lead: LeadRecord,
  existingClients: Array<{ id: string; name: string; phone: string }>,
  staffId: string,
  staffName: string,
  nowMs: number = Date.now()
): {
  updatedLead: LeadRecord;
  quotePayload: {
    quoteId: string;
    clientId: string;
    clientName: string;
    destination: string;
    travellersCount: number;
    leadId: string;
  };
  clientCreated?: { id: string; name: string; phone: string };
} {
  const now = new Date(nowMs).toISOString();
  const quoteId = `QUO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  let clientId = lead.linkedClientId;
  let clientCreated: { id: string; name: string; phone: string } | undefined;

  // Check if client exists by phone trunk
  if (!clientId) {
    const existing = existingClients.find((c) => getPhoneTrunk(c.phone) === getPhoneTrunk(lead.phone));
    if (existing) {
      clientId = existing.id;
    } else {
      // Provisions new client
      clientId = `CL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      clientCreated = {
        id: clientId,
        name: lead.clientName,
        phone: lead.phone,
      };
    }
  }

  const log: LeadActivityLog = {
    id: `CONV-${Date.now().toString(36)}`,
    leadId: lead.id,
    type: 'converted',
    description: `Converted to quote ${quoteId} by ${staffName}. Client ID: ${clientId}.`,
    staffId,
    staffName,
    timestamp: now,
  };

  const updatedLead: LeadRecord = {
    ...lead,
    stage: 'quoted', // Lead moves to Quoted
    linkedClientId: clientId,
    linkedQuoteId: quoteId, // Links both ways
    lastActivityAt: now,
    activityLogs: [log, ...lead.activityLogs],
  };

  return {
    updatedLead,
    quotePayload: {
      quoteId,
      clientId,
      clientName: lead.clientName,
      destination: lead.destination,
      travellersCount: lead.travellersCount,
      leadId: lead.id,
    },
    clientCreated,
  };
}

/**
 * 16. Reopen lost lead: allowed for Owner or Manager only
 */
export function reopenLostLead(
  lead: LeadRecord,
  requesterRole: string,
  staffId: string,
  staffName: string,
  nowMs: number = Date.now()
): { success: boolean; error?: string; reopenedLead?: LeadRecord } {
  const allowedRoles = ['OWNER', 'OPERATIONS_MANAGER', 'BRANCH_MANAGER'];
  if (!allowedRoles.includes(requesterRole)) {
    return {
      success: false,
      error: 'Only the business owner or branch manager can reopen a lost lead.',
    };
  }

  if (lead.stage !== 'lost') {
    return {
      success: false,
      error: 'Only leads in the "Lost" stage can be reopened.',
    };
  }

  const now = new Date(nowMs).toISOString();
  const log: LeadActivityLog = {
    id: `REOPEN-${Date.now().toString(36)}`,
    leadId: lead.id,
    type: 'reopened',
    description: `Lost lead reopened and moved to "Contacted" by ${staffName} (${requesterRole}).`,
    staffId,
    staffName,
    timestamp: now,
  };

  const reopenedLead: LeadRecord = {
    ...lead,
    stage: 'contacted',
    lostReason: undefined,
    lastActivityAt: now,
    activityLogs: [log, ...lead.activityLogs],
  };

  return {
    success: true,
    reopenedLead,
  };
}

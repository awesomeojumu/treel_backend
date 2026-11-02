import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  MANDATORY_AUDIT_NOTIFICATION_RULES,
  ComprehensiveAuditLedger,
  buildRecordTimeline,
  createTargetedNotification,
  canToggleNotificationChannel,
  evaluateMessageDeliveryStatus,
} from '@/core/audit/auditAndNotifications';

const auditLedger = new ComprehensiveAuditLedger();

// Seed initial audit events
auditLedger.record({
  organizationId: 'org_skyline_lagos',
  action: 'LOGIN',
  entityType: 'SESSION',
  entityId: 'sess_adaeze_01',
  person: { userId: 'usr_adaeze', name: 'Adaeze Okafor', roleKey: 'OWNER' },
  device: { deviceId: 'dev_chrome_win', ipAddress: '102.89.44.12', userAgent: 'Chrome 130 on Windows' },
  oldValue: null,
  newValue: { sessionStatus: 'AUTHENTICATED', role: 'OWNER' },
  summary: 'Adaeze Okafor signed in successfully via Argon2 credentials',
});

auditLedger.record({
  organizationId: 'org_skyline_lagos',
  action: 'CREATE',
  entityType: 'BOOKING',
  entityId: 'BK-2026-001',
  person: { userId: 'usr_bisi', name: 'Bisi Adeyemi', roleKey: 'SALES_AGENT' },
  device: { deviceId: 'dev_mobile_tecno', ipAddress: '102.89.44.14', userAgent: 'Mobile Android Tecno' },
  oldValue: null,
  newValue: { title: 'Lagos - London Virgin Atlantic Business Class', totalKobo: 85000000 },
  summary: 'Bisi Adeyemi created booking BK-2026-001 for Chief Obinna',
});

export async function registerAuditAndNotificationsRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get all 6 Rules
  app.get('/api/v1/platform/audit-notifications/rules', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      totalRules: MANDATORY_AUDIT_NOTIFICATION_RULES.length,
      allCompliant: MANDATORY_AUDIT_NOTIFICATION_RULES.every((r) => r.isCompliant),
      rules: MANDATORY_AUDIT_NOTIFICATION_RULES,
    });
  });

  // 2. Query Audit Log with Person, Device, Old & New Values
  app.get('/api/v1/platform/audit-notifications/audit-log', async (req: FastifyRequest, reply: FastifyReply) => {
    const orgId = (req.headers['x-organization-id'] as string) || 'org_skyline_lagos';
    const entries = auditLedger.listByOrganization(orgId);
    return reply.send({ total: entries.length, entries });
  });

  // 3. Record New Audit Event
  app.post('/api/v1/platform/audit-notifications/audit-log', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body as any) || {};
    const recorded = auditLedger.record({
      organizationId: body.organizationId || 'org_skyline_lagos',
      action: body.action || 'STATUS_CHANGE',
      entityType: body.entityType || 'BOOKING',
      entityId: body.entityId || 'BK-2026-001',
      person: body.person || { userId: 'usr_tunde', name: 'Tunde Bakare', roleKey: 'OPERATIONS_MANAGER' },
      device: body.device || { deviceId: 'dev_web_mac', ipAddress: '102.89.44.16', userAgent: 'Safari on macOS' },
      oldValue: body.oldValue || { status: 'Part-paid' },
      newValue: body.newValue || { status: 'Paid' },
      summary: body.summary || 'Booking status changed to Paid upon payment confirmation',
    });
    return reply.status(201).send(recorded);
  });

  // 4. Query Record Immutable Timeline
  app.get('/api/v1/platform/audit-notifications/timeline/:recordId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { recordId } = req.params as { recordId: string };
    const timeline = buildRecordTimeline(recordId, [
      {
        eventId: 'evt_1',
        recordId,
        actorName: 'Bisi Adeyemi',
        actorRole: 'Sales agent',
        title: 'Quote Sent to Client',
        description: 'Virgin Atlantic Upper Class quoted at ₦850,000 via WhatsApp share',
        timestampIso: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        eventId: 'evt_2',
        recordId,
        actorName: 'Chief Obinna',
        actorRole: 'Client',
        title: 'Quote Accepted',
        description: 'Client accepted quote terms and requested deposit account details',
        timestampIso: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        eventId: 'evt_3',
        recordId,
        actorName: 'Adaeze Okafor',
        actorRole: 'Owner',
        title: 'Deposit Payment Confirmed',
        description: 'Direct Bank Transfer of ₦300,000.00 confirmed and matched (PAY-2026-001)',
        timestampIso: new Date(Date.now() - 600000).toISOString(),
      },
    ]);
    return reply.send({ recordId, totalEvents: timeline.length, timeline });
  });

  // 5. Dispatch Targeted Notification with Lock Screen Privacy
  app.post('/api/v1/platform/audit-notifications/notify', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body as any) || {};
    const notification = createTargetedNotification({
      targetUserId: body.targetUserId || 'usr_bisi',
      category: body.category || 'NORMAL_LEAD',
      title: body.title || 'New Lead Assigned',
      entityTitle: body.entityTitle || 'Dubai Package Inquiry for Ojo Family',
      sensitiveAmountKobo: body.sensitiveAmountKobo || 418000000,
      passportNumber: body.passportNumber || 'A09482741',
      deepLink: body.deepLink || '/leads?id=LD-2026-103',
      maskAmountsOnLockScreen: body.maskAmountsOnLockScreen ?? true,
    });
    return reply.status(201).send(notification);
  });

  // 6. Test Channel Toggle Guard
  app.post('/api/v1/platform/audit-notifications/channel-toggle', async (req: FastifyRequest, reply: FastifyReply) => {
    const { channel = 'CRITICAL_SECURITY' } = (req.body as any) || {};
    const check = canToggleNotificationChannel(channel);
    if (!check.canDisable) {
      return reply.status(403).send(check);
    }
    return reply.send(check);
  });

  // 7. Test Message Delivery Status (Shared vs Delivered)
  app.post('/api/v1/platform/audit-notifications/delivery-status', async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerWebhookConfirmed = false, providerReadReceiptReceived = false } = (req.body as any) || {};
    const status = evaluateMessageDeliveryStatus(providerWebhookConfirmed, providerReadReceiptReceived);
    return reply.send({ status });
  });
}

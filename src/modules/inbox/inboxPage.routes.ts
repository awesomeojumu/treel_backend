import { FastifyInstance } from 'fastify';
import {
  listInboxPageRules,
  groupNotificationsByDay,
  calculateUnreadCount,
  sanitizeNotificationForAccess,
  determineDeliveryChannels,
  partitionArchive,
  searchArchivedNotifications,
  createSharedDocumentLink,
  validateSharedLinkAccess,
  createSupportTicket,
  addSupportTicketReply,
  updateSupportTicketStatus,
  getTenantSupportTickets,
  NotificationItem,
  SupportTicket,
  SharedDocumentLink,
  ALL_11_NOTIFICATION_TYPES,
} from '@/core/inbox/inboxPageRules';

// In-memory mock store for demo and tests
const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

let inMemoryNotifications = [...INITIAL_NOTIFICATIONS];
let inMemorySharedLinks: SharedDocumentLink[] = [];
let inMemorySupportTickets: SupportTicket[] = [
  {
    id: 'TKT-2026-0814',
    organizationId: 'org-lagos-01',
    staffId: 'st-bisi',
    staffName: 'Bisi Adeyemi',
    subject: 'Paystack webhook reconciliation latency',
    description: 'Payments completed via bank transfer take up to 4 minutes to reflect on customer invoices.',
    screenshotUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',
    status: 'open',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    replies: [
      {
        id: 'REP-01',
        authorName: 'Planexi Care System',
        authorRole: 'Support Bot',
        isSupportStaff: true,
        message: 'Your ticket has been logged with Planexi Support. A customer specialist will respond shortly.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'REP-02',
        authorName: 'Emeka Nwosu',
        authorRole: 'Platform Specialist',
        isSupportStaff: true,
        message: 'We investigated your webhook logs. NIBSS settlement webhooks during peak banking hours were queued. We added a fallback polling worker.',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

export async function registerInboxPageRoutes(app: FastifyInstance) {
  // 1. List all 11 Inbox Rules
  app.get('/api/v1/inbox/rules', async () => {
    const rules = listInboxPageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every((r) => r.isCompliant),
      rules,
    };
  });

  // 2. Fetch Notifications List with Day-Grouping, Unread Count & Retention
  app.get<{
    Querystring: {
      organizationId?: string;
      search?: string;
      tab?: 'active' | 'archived';
    };
  }>('/api/v1/inbox/notifications', async (req) => {
    const orgId = req.query.organizationId || 'org-lagos-01';
    const search = req.query.search?.trim().toLowerCase() || '';
    const tab = req.query.tab || 'active';

    const orgFiltered = inMemoryNotifications.filter((n) => n.organizationId === orgId);
    const sanitized = orgFiltered.map(sanitizeNotificationForAccess);
    const { active, archived } = partitionArchive(sanitized);

    const targetList = tab === 'archived' ? archived : active;
    const filtered = search
      ? targetList.filter(
          (n) =>
            n.title.toLowerCase().includes(search) ||
            n.detail.toLowerCase().includes(search) ||
            n.type.toLowerCase().includes(search)
        )
      : targetList;

    const grouped = groupNotificationsByDay(filtered);
    const unreadCount = calculateUnreadCount(active);

    return {
      unreadCount,
      activeCount: active.length,
      archivedCount: archived.length,
      grouped,
      allNotifications: filtered,
    };
  });

  // 3. Mark Single Notification as Read
  app.post<{
    Body: { id: string };
  }>('/api/v1/inbox/notifications/mark-read', async (req, reply) => {
    const { id } = req.body || {};
    const item = inMemoryNotifications.find((n) => n.id === id);
    if (!item) {
      return reply.status(404).send({ error: 'Notification not found' });
    }
    item.isRead = true;
    const orgFiltered = inMemoryNotifications.filter((n) => n.organizationId === item.organizationId);
    const unreadCount = calculateUnreadCount(orgFiltered);
    return { success: true, updatedId: id, unreadCount };
  });

  // 4. Mark All Notifications as Read
  app.post<{
    Body: { organizationId?: string };
  }>('/api/v1/inbox/notifications/mark-all-read', async (req) => {
    const orgId = req.body?.organizationId || 'org-lagos-01';
    inMemoryNotifications.forEach((n) => {
      if (n.organizationId === orgId) {
        n.isRead = true;
      }
    });
    return { success: true, unreadCount: 0 };
  });

  // 5. WhatsApp Document Sharing with Expiration, Revocation & Audit Log
  app.post<{
    Body: {
      documentId: string;
      documentTitle: string;
      organizationId: string;
      sharedByStaffId: string;
      sharedByStaffName: string;
      expiresInDays?: number;
    };
  }>('/api/v1/inbox/share-whatsapp', async (req, reply) => {
    const { documentId, documentTitle, organizationId, sharedByStaffId, sharedByStaffName, expiresInDays } = req.body;
    if (!documentId || !documentTitle) {
      return reply.status(400).send({ error: 'documentId and documentTitle are required' });
    }

    const { link, auditLog } = createSharedDocumentLink({
      documentId,
      documentTitle,
      organizationId: organizationId || 'org-lagos-01',
      sharedByStaffId: sharedByStaffId || 'st-bisi',
      sharedByStaffName: sharedByStaffName || 'Bisi Adeyemi',
      expiresInDays: expiresInDays || 7,
    });

    inMemorySharedLinks.push(link);

    return {
      success: true,
      link,
      auditLog,
      message: 'Share link generated. Note: Delivery confirmation is off-platform and never claimed.',
    };
  });

  // 6. Revoke Shared Link
  app.post<{
    Body: { linkId: string };
  }>('/api/v1/inbox/revoke-shared-link', async (req, reply) => {
    const { linkId } = req.body;
    const link = inMemorySharedLinks.find((l) => l.id === linkId);
    if (!link) {
      return reply.status(404).send({ error: 'Shared link not found' });
    }
    link.isRevoked = true;
    return { success: true, revokedId: linkId };
  });

  // 7. Get Support Tickets (Strictly Tenant Isolated)
  app.get<{
    Querystring: { organizationId?: string };
  }>('/api/v1/inbox/support/tickets', async (req) => {
    const orgId = req.query.organizationId || 'org-lagos-01';
    const tenantTickets = getTenantSupportTickets(inMemorySupportTickets, orgId);
    return {
      tickets: tenantTickets,
      organizationId: orgId,
    };
  });

  // 8. Create Support Ticket (Validates subject, description, 2MB screenshot, generates reference)
  app.post<{
    Body: {
      organizationId?: string;
      staffId?: string;
      staffName?: string;
      subject: string;
      description: string;
      screenshotUrl?: string;
      screenshotSizeMb?: number;
    };
  }>('/api/v1/inbox/support/tickets', async (req, reply) => {
    const { organizationId, staffId, staffName, subject, description, screenshotUrl, screenshotSizeMb } = req.body;
    const result = createSupportTicket({
      organizationId: organizationId || 'org-lagos-01',
      staffId: staffId || 'st-bisi',
      staffName: staffName || 'Bisi Adeyemi',
      subject: subject || '',
      description: description || '',
      screenshotUrl,
      screenshotSizeMb,
    });

    if (!result.success || !result.ticket) {
      return reply.status(400).send({ error: result.error });
    }

    inMemorySupportTickets.unshift(result.ticket);
    return { success: true, ticket: result.ticket };
  });

  // 9. Add Reply to Support Ticket
  app.post<{
    Params: { id: string };
    Body: {
      authorName: string;
      authorRole: string;
      message: string;
    };
  }>('/api/v1/inbox/support/tickets/:id/reply', async (req, reply) => {
    const { id } = req.params;
    const { authorName, authorRole, message } = req.body;
    const ticket = inMemorySupportTickets.find((t) => t.id === id);
    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }
    if (!message?.trim()) {
      return reply.status(400).send({ error: 'Message cannot be empty' });
    }

    const updated = addSupportTicketReply(ticket, {
      authorName: authorName || 'Bisi Adeyemi',
      authorRole: authorRole || 'Travel Consultant',
      isSupportStaff: false,
      message,
    });

    const index = inMemorySupportTickets.findIndex((t) => t.id === id);
    inMemorySupportTickets[index] = updated;

    return { success: true, ticket: updated };
  });

  // 10. Update Support Ticket Status (Close / Reopen)
  app.post<{
    Params: { id: string };
    Body: {
      status: 'open' | 'pending' | 'resolved' | 'closed';
    };
  }>('/api/v1/inbox/support/tickets/:id/status', async (req, reply) => {
    const { id } = req.params;
    const { status } = req.body;
    const ticket = inMemorySupportTickets.find((t) => t.id === id);
    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    const updated = updateSupportTicketStatus(ticket, status);
    const index = inMemorySupportTickets.findIndex((t) => t.id === id);
    inMemorySupportTickets[index] = updated;

    return { success: true, ticket: updated };
  });
}

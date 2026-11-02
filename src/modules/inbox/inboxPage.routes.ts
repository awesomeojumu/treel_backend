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
const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'NTF-01',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'payment_received',
    title: 'Payment received: ₦300,000.00 on BK-2026-016',
    detail: 'Ibrahim Abdullahi transferred ₦300,000.00 via Paystack. Recorded by Bisi Adeyemi.',
    isRead: false,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
    recordType: 'payment',
    recordId: 'PAY-892',
    recordAccessible: true,
  },
  {
    id: 'NTF-02',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'assigned_task',
    title: 'New lead assigned: Kigali conference enquiry',
    detail: 'Inbound enquiry from WhatsApp assigned to Bisi Adeyemi. Requires follow-up by 4:00 PM.',
    isRead: false,
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 mins ago
    recordType: 'lead',
    recordId: 'LD-441',
    recordAccessible: true,
  },
  {
    id: 'NTF-03',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'departure_at_risk',
    title: 'Departure at risk: Emirates flight EK784',
    detail: 'Lagos to Dubai flight departing in 18 hours has 1 unissued boarding pass for Mrs. Folake Martins.',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    recordType: 'booking',
    recordId: 'BK-2026-019',
    recordAccessible: true,
  },
  {
    id: 'NTF-04',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'lead_followup_due',
    title: 'Lead follow-up due: TotalEnergies Q1 corporate travel',
    detail: 'Scheduled follow-up with Procurement Director Michael Okon is overdue by 30 minutes.',
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    recordType: 'lead',
    recordId: 'LD-439',
    recordAccessible: true,
  },
  {
    id: 'NTF-05',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'query',
    title: 'Client query: Visa processing delay for Schengen tourist',
    detail: 'Dr. Chinedu Obi submitted query regarding France biometric appointment date.',
    isRead: true,
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), // Yesterday
    recordType: 'booking',
    recordId: 'BK-2026-004',
    recordAccessible: true,
  },
  {
    id: 'NTF-06',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'leave_decision',
    title: 'Leave request approved: Casual leave (3 days)',
    detail: 'Branch Manager approved your casual leave from 18 Nov to 20 Nov 2026.',
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    recordType: 'leave',
    recordId: 'LV-881',
    recordAccessible: true,
  },
  {
    id: 'NTF-07',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'security_alert',
    title: 'Security alert: New login detected from Chrome Windows (Ikeja)',
    detail: 'Successful password authentication from IP 102.89.34.12. Critical security event.',
    isRead: false,
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    recordType: 'system',
    recordAccessible: true,
  },
  {
    id: 'NTF-08',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'payment_failed',
    title: 'Payment failed: Paystack direct debit retry scheduled',
    detail: 'Card charge of ₦85,000 for client ticket issuance was declined by issuer bank (Insufficient funds).',
    isRead: false,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    recordType: 'payment',
    recordId: 'PAY-875',
    recordAccessible: true,
  },
  {
    id: 'NTF-09',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'approval_waiting',
    title: 'Approval waiting: ₦1,400,000 ticket refund request',
    detail: 'Awaiting Managing Director signoff for British Airways business class cancellation.',
    isRead: true,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    recordType: 'booking',
    recordId: 'BK-2026-002',
    recordAccessible: true,
  },
  {
    id: 'NTF-10',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'approval_result',
    title: 'Approval result: Credit facility limit extended to ₦10,000,000',
    detail: 'Finance committee approved credit facility limit increase for Shell Nigeria staff travel.',
    isRead: true,
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    recordType: 'system',
    recordAccessible: true,
  },
  {
    id: 'NTF-11',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'announcement',
    title: 'Announcement: December festive schedule & IATA rate update',
    detail: 'Head Office bulletin regarding holiday flight ticketing schedules and exchange rate updates.',
    isRead: true,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    recordType: 'system',
    recordAccessible: true,
  },
  // Inaccessible record test
  {
    id: 'NTF-12',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'assigned_task',
    title: 'Secret Board Flight Itinerary',
    detail: 'VIP Private jet charter manifest for Executive Directors',
    isRead: true,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    recordType: 'booking',
    recordId: 'BK-TOP-SECRET',
    recordAccessible: false, // Access revoked!
  },
  // 90+ days archived notification
  {
    id: 'NTF-13-ARCHIVED',
    organizationId: 'org-lagos-01',
    recipientStaffId: 'st-bisi',
    type: 'payment_received',
    title: 'Archived: ₦2,500,000 Summer Tour Group Payment',
    detail: 'Zenith Bank wire transfer confirmed for Canada summer tour group.',
    isRead: true,
    createdAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString(), // 95 days ago
    recordType: 'payment',
    recordId: 'PAY-SUMMER-01',
    recordAccessible: true,
  },
];

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

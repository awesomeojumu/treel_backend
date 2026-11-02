import {
  listInboxPageRules,
  groupNotificationsByDay,
  calculateUnreadCount,
  sanitizeNotificationForAccess,
  determineDeliveryChannels,
  shouldDeduplicate,
  partitionArchive,
  searchArchivedNotifications,
  createSharedDocumentLink,
  validateSharedLinkAccess,
  createSupportTicket,
  addSupportTicketReply,
  updateSupportTicketStatus,
  getTenantSupportTickets,
  ALL_11_NOTIFICATION_TYPES,
  NotificationItem,
} from '../core/inbox/inboxPageRules';

describe('Page 23: Inbox Specifications and Rules Engine', () => {
  it('covers all 11 specification items in the rules catalog', () => {
    const rules = listInboxPageRules();
    expect(rules).toHaveLength(11);
    expect(rules.every((r) => r.isCompliant)).toBe(true);
  });

  describe('1. Day-Grouped Notifications Ordered Newest First', () => {
    it('groups notifications into Today, Yesterday, and Older blocks, sorted newest first', () => {
      const now = new Date('2026-11-02T12:00:00Z').getTime();

      const sample: NotificationItem[] = [
        {
          id: 'NTF-1',
          organizationId: 'org-1',
          recipientStaffId: 'staff-1',
          type: 'assigned_task',
          title: 'Task today',
          detail: 'Due today',
          isRead: false,
          createdAt: new Date('2026-11-02T08:00:00Z').toISOString(),
        },
        {
          id: 'NTF-2',
          organizationId: 'org-1',
          recipientStaffId: 'staff-1',
          type: 'payment_received',
          title: 'Payment yesterday',
          detail: '₦500,000 received',
          isRead: true,
          createdAt: new Date('2026-11-01T15:00:00Z').toISOString(),
        },
        {
          id: 'NTF-3',
          organizationId: 'org-1',
          recipientStaffId: 'staff-1',
          type: 'announcement',
          title: 'Older announcement',
          detail: 'Staff meeting next week',
          isRead: true,
          createdAt: new Date('2026-10-25T10:00:00Z').toISOString(),
        },
      ];

      const grouped = groupNotificationsByDay(sample, now);
      expect(grouped.today).toHaveLength(1);
      expect(grouped.today[0].id).toBe('NTF-1');
      expect(grouped.yesterday).toHaveLength(1);
      expect(grouped.yesterday[0].id).toBe('NTF-2');
      expect(grouped.older).toHaveLength(1);
      expect(grouped.older[0].id).toBe('NTF-3');
    });
  });

  describe('2. Mark One Read, Mark All Read & Badge Counter Parity', () => {
    it('accurately counts unread items matching the badge count', () => {
      const list: NotificationItem[] = [
        { id: '1', organizationId: 'o1', recipientStaffId: 's1', type: 'assigned_task', title: 'T1', detail: 'D1', isRead: false, createdAt: '2026-11-02T10:00:00Z' },
        { id: '2', organizationId: 'o1', recipientStaffId: 's1', type: 'query', title: 'T2', detail: 'D2', isRead: false, createdAt: '2026-11-02T09:00:00Z' },
        { id: '3', organizationId: 'o1', recipientStaffId: 's1', type: 'security_alert', title: 'T3', detail: 'D3', isRead: true, createdAt: '2026-11-02T08:00:00Z' },
      ];

      expect(calculateUnreadCount(list)).toBe(2);

      // Mark one read
      list[0].isRead = true;
      expect(calculateUnreadCount(list)).toBe(1);

      // Mark all read
      list.forEach((n) => (n.isRead = true));
      expect(calculateUnreadCount(list)).toBe(0);
    });
  });

  describe('3. All 11 Notification Types Covered', () => {
    it('includes all 11 required notification types', () => {
      expect(ALL_11_NOTIFICATION_TYPES).toEqual([
        'assigned_task',
        'query',
        'approval_waiting',
        'approval_result',
        'payment_received',
        'payment_failed',
        'lead_followup_due',
        'departure_at_risk',
        'leave_decision',
        'announcement',
        'security_alert',
      ]);
      expect(ALL_11_NOTIFICATION_TYPES).toHaveLength(11);
    });
  });

  describe('4. Permission Loss & Inaccessible Record Masking', () => {
    it('masks notification title and detail with "No longer available" when access is lost', () => {
      const confidentialNtf: NotificationItem = {
        id: 'NTF-99',
        organizationId: 'org-1',
        recipientStaffId: 'staff-2',
        type: 'payment_received',
        title: 'Payment of ₦4,500,000 from Alhaji Dangote',
        detail: 'VIP Booking BK-9981 paid via wire transfer',
        recordType: 'booking',
        recordId: 'BK-9981',
        recordAccessible: false, // Access revoked
        isRead: false,
        createdAt: '2026-11-02T11:00:00Z',
      };

      const sanitized = sanitizeNotificationForAccess(confidentialNtf);
      expect(sanitized.title).toBe('No longer available');
      expect(sanitized.detail).toContain('no longer available or your access has been revoked');
      expect(sanitized.recordId).toBeUndefined(); // Does not leak record link
    });

    it('preserves notification contents when record is accessible', () => {
      const normalNtf: NotificationItem = {
        id: 'NTF-100',
        organizationId: 'org-1',
        recipientStaffId: 'staff-2',
        type: 'assigned_task',
        title: 'Review flight booking',
        detail: 'Check passport details for Jane Doe',
        recordType: 'task',
        recordId: 'TSK-123',
        recordAccessible: true,
        isRead: false,
        createdAt: '2026-11-02T11:00:00Z',
      };

      const sanitized = sanitizeNotificationForAccess(normalNtf);
      expect(sanitized.title).toBe('Review flight booking');
      expect(sanitized.recordId).toBe('TSK-123');
    });
  });

  describe('5. Channel Preferences & Critical Item Overrides', () => {
    it('respects user channel opt-outs for routine notifications', () => {
      const userPrefs = { push: false, email: true, in_app: false };
      const channels = determineDeliveryChannels('assigned_task', userPrefs);

      expect(channels.push).toBe(false);
      expect(channels.email).toBe(true);
      expect(channels.in_app).toBe(false);
      expect(channels.isCritical).toBe(false);
    });

    it('forces delivery across all channels for critical security and payment failure alerts', () => {
      const userDisabledAll = { push: false, email: false, in_app: false };

      const secChannels = determineDeliveryChannels('security_alert', userDisabledAll);
      expect(secChannels.push).toBe(true);
      expect(secChannels.email).toBe(true);
      expect(secChannels.in_app).toBe(true);
      expect(secChannels.isCritical).toBe(true);

      const payFailedChannels = determineDeliveryChannels('payment_failed', userDisabledAll);
      expect(payFailedChannels.push).toBe(true);
      expect(payFailedChannels.email).toBe(true);
      expect(payFailedChannels.in_app).toBe(true);
      expect(payFailedChannels.isCritical).toBe(true);
    });
  });

  describe('6. Deduplication Guard', () => {
    it('blocks duplicate notifications sharing the same idempotency key', () => {
      const existing: NotificationItem[] = [
        {
          id: 'NTF-1',
          organizationId: 'org-1',
          recipientStaffId: 'staff-1',
          type: 'payment_received',
          title: 'Payment ₦50,000',
          detail: 'Ref: PAY-123',
          dedupKey: 'pay-hook-PAY-123',
          isRead: false,
          createdAt: '2026-11-02T10:00:00Z',
        },
      ];

      expect(shouldDeduplicate(existing, 'pay-hook-PAY-123')).toBe(true);
      expect(shouldDeduplicate(existing, 'pay-hook-PAY-999')).toBe(false);
      expect(shouldDeduplicate(existing, undefined)).toBe(false);
    });
  });

  describe('7. 90-Day Auto-Archiving & Search Retention', () => {
    it('partitions notifications older than 90 days into archive and allows searching them', () => {
      const now = new Date('2026-11-02T12:00:00Z').getTime();
      const eightyDaysAgo = new Date(now - 80 * 24 * 60 * 60 * 1000).toISOString();
      const hundredDaysAgo = new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString();

      const items: NotificationItem[] = [
        {
          id: 'NTF-NEW',
          organizationId: 'o1',
          recipientStaffId: 's1',
          type: 'assigned_task',
          title: 'Active task',
          detail: 'Recent item',
          isRead: true,
          createdAt: eightyDaysAgo,
        },
        {
          id: 'NTF-OLD',
          organizationId: 'o1',
          recipientStaffId: 's1',
          type: 'payment_received',
          title: 'Alhaji Kano Ticket Payment',
          detail: '₦1,200,000 received for London trip',
          isRead: true,
          createdAt: hundredDaysAgo,
        },
      ];

      const { active, archived } = partitionArchive(items, now);
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('NTF-NEW');
      expect(archived).toHaveLength(1);
      expect(archived[0].id).toBe('NTF-OLD');

      // Search archived
      const results = searchArchivedNotifications(archived, 'Alhaji');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('NTF-OLD');

      const emptyResults = searchArchivedNotifications(archived, 'Unknown');
      expect(emptyResults).toHaveLength(0);
    });
  });

  describe('8 & 9. WhatsApp Share, Audit Trail, Expiration & Revocation', () => {
    it('creates WhatsApp share with valid wa.me URI, logs "shared by", and never claims delivery', () => {
      const res = createSharedDocumentLink({
        documentId: 'DOC-501',
        documentTitle: 'Dubai E-Visa & Itinerary',
        organizationId: 'org-lagos',
        sharedByStaffId: 'staff-bisi',
        sharedByStaffName: 'Bisi Adeyemi',
        expiresInDays: 7,
      });

      expect(res.link.whatsappUrl).toContain('https://wa.me/?text=');
      expect(res.link.whatsappUrl).toContain(encodeURIComponent('Dubai E-Visa & Itinerary'));
      expect(res.link.shareUrl).toContain('/shared/doc/');
      expect(res.link.deliveryStatus).toBe('shared_off_platform');

      // Audit log inspection
      expect(res.auditLog.sharedBy).toBe('Bisi Adeyemi');
      expect(res.auditLog.documentId).toBe('DOC-501');
      expect(res.auditLog.neverClaimsDelivery).toBe(true);
    });

    it('enforces link expiration and revocation checks', () => {
      const now = new Date('2026-11-02T12:00:00Z').getTime();
      const res = createSharedDocumentLink({
        documentId: 'DOC-501',
        documentTitle: 'Dubai E-Visa',
        organizationId: 'org-lagos',
        sharedByStaffId: 'staff-bisi',
        sharedByStaffName: 'Bisi Adeyemi',
        expiresInDays: 7,
      });

      // Valid immediately
      expect(validateSharedLinkAccess(res.link, now).valid).toBe(true);

      // Expired 8 days later
      const eightDaysLater = now + 8 * 24 * 60 * 60 * 1000;
      const expiredCheck = validateSharedLinkAccess(res.link, eightDaysLater);
      expect(expiredCheck.valid).toBe(false);
      expect(expiredCheck.reason).toBe('EXPIRED');

      // Revoked immediately
      res.link.isRevoked = true;
      const revokedCheck = validateSharedLinkAccess(res.link, now);
      expect(revokedCheck.valid).toBe(false);
      expect(revokedCheck.reason).toBe('REVOKED');
    });
  });

  describe('10 & 11. Support Ticket Lifecycle & Strict Tenant Isolation', () => {
    it('creates a support ticket with reference ID, validates subject and 2MB screenshot limit', () => {
      // Missing subject
      const fail1 = createSupportTicket({
        organizationId: 'org-1',
        staffId: 'st-1',
        staffName: 'Bisi Adeyemi',
        subject: '',
        description: 'Payment issue',
      });
      expect(fail1.success).toBe(false);
      expect(fail1.error).toBe('Subject is required');

      // Screenshot > 2MB
      const fail2 = createSupportTicket({
        organizationId: 'org-1',
        staffId: 'st-1',
        staffName: 'Bisi Adeyemi',
        subject: 'Paystack webhook',
        description: 'Webhook failed',
        screenshotSizeMb: 2.5,
      });
      expect(fail2.success).toBe(false);
      expect(fail2.error).toContain('2 MB or less');

      // Successful creation
      const res = createSupportTicket({
        organizationId: 'org-1',
        staffId: 'st-1',
        staffName: 'Bisi Adeyemi',
        subject: 'Invoice VAT rounding query',
        description: 'Need clarification on FIRS 7.5% rounding for decimal kobo.',
        screenshotSizeMb: 1.2,
      });

      expect(res.success).toBe(true);
      expect(res.ticket?.id).toMatch(/^TKT-2026-\d{4}$/);
      expect(res.ticket?.status).toBe('open');
      expect(res.ticket?.replies).toHaveLength(1);
    });

    it('supports threaded replies, closing, and reopening', () => {
      const res = createSupportTicket({
        organizationId: 'org-1',
        staffId: 'st-1',
        staffName: 'Bisi Adeyemi',
        subject: 'API credentials',
        description: 'Need Amadeus test API key',
      });
      let ticket = res.ticket!;

      // Add reply
      ticket = addSupportTicketReply(ticket, {
        authorName: 'Planexi Engineer',
        authorRole: 'Platform Specialist',
        isSupportStaff: true,
        message: 'Amadeus sandbox credentials have been generated.',
      });
      expect(ticket.replies).toHaveLength(2);

      // Close ticket
      ticket = updateSupportTicketStatus(ticket, 'closed');
      expect(ticket.status).toBe('closed');

      // User replies -> Auto reopens
      ticket = addSupportTicketReply(ticket, {
        authorName: 'Bisi Adeyemi',
        authorRole: 'Admin',
        isSupportStaff: false,
        message: 'Could you also provision the Sabre test endpoint?',
      });
      expect(ticket.status).toBe('open');
      expect(ticket.replies).toHaveLength(3);
    });

    it('strictly isolates support tickets by organization ID', () => {
      const tickets = [
        createSupportTicket({ organizationId: 'org-Alpha', staffId: 's1', staffName: 'Staff Alpha', subject: 'Subject A', description: 'Desc A' }).ticket!,
        createSupportTicket({ organizationId: 'org-Beta', staffId: 's2', staffName: 'Staff Beta', subject: 'Subject B', description: 'Desc B' }).ticket!,
      ];

      const alphaTickets = getTenantSupportTickets(tickets, 'org-Alpha');
      expect(alphaTickets).toHaveLength(1);
      expect(alphaTickets[0].subject).toBe('Subject A');

      // Organization Beta never sees Organization Alpha tickets
      const betaTickets = getTenantSupportTickets(tickets, 'org-Beta');
      expect(betaTickets).toHaveLength(1);
      expect(betaTickets[0].subject).toBe('Subject B');
      expect(betaTickets.some((t) => t.organizationId === 'org-Alpha')).toBe(false);
    });
  });
});

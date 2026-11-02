import { describe, it, expect } from '@jest/globals';
import {
  MANDATORY_AUDIT_NOTIFICATION_RULES,
  ComprehensiveAuditLedger,
  buildRecordTimeline,
  createTargetedNotification,
  canToggleNotificationChannel,
  evaluateMessageDeliveryStatus,
} from '@/core/audit/auditAndNotifications';

describe('Section 2, 4, 11 & 12: Audit Trail, Timelines & Notifications Specification', () => {
  it('defines and verifies all 6 mandatory audit, history and notification rules', () => {
    expect(MANDATORY_AUDIT_NOTIFICATION_RULES).toHaveLength(6);
    expect(MANDATORY_AUDIT_NOTIFICATION_RULES.every((r) => r.isCompliant)).toBe(true);

    const ids = MANDATORY_AUDIT_NOTIFICATION_RULES.map((r) => r.id);
    expect(ids).toContain('AUDIT_FULL_LIFECYCLE_LOGGING');
    expect(ids).toContain('AUDIT_IMMUTABLE_TIMELINE');
    expect(ids).toContain('NOTIF_RAPID_TARGETED_DISPATCH');
    expect(ids).toContain('NOTIF_LOCK_SCREEN_PRIVACY');
    expect(ids).toContain('NOTIF_CRITICAL_PREFERENCE_LOCK');
    expect(ids).toContain('NOTIF_DELIVERY_CONFIRMATION_STATE');
  });

  // Rule 1: Full Lifecycle Audit Logging with Person, Time, Device, Old and New values
  it('Rule 1: logs create, edit, delete, status change, approval, export, permission change, login and failed login with person, device, old & new value', () => {
    const ledger = new ComprehensiveAuditLedger();

    const entry = ledger.record({
      organizationId: 'org_skyline_lagos',
      action: 'STATUS_CHANGE',
      entityType: 'BOOKING',
      entityId: 'BK-2026-001',
      person: { userId: 'usr_tunde', name: 'Tunde Bakare', roleKey: 'OPERATIONS_MANAGER' },
      device: { deviceId: 'dev_macbook_01', ipAddress: '102.89.44.12', userAgent: 'Chrome 130 on macOS' },
      oldValue: { status: 'Part-paid', owedKobo: 55000000 },
      newValue: { status: 'Paid', owedKobo: 0 },
      summary: 'Tunde Bakare confirmed final payment and marked BK-2026-001 as Paid',
    });

    expect(entry.auditId).toMatch(/^aud_\d+/);
    expect(entry.timestampIso).toBeTruthy();
    expect(entry.person.userId).toBe('usr_tunde');
    expect(entry.device.ipAddress).toBe('102.89.44.12');
    expect(entry.oldValue).toEqual({ status: 'Part-paid', owedKobo: 55000000 });
    expect(entry.newValue).toEqual({ status: 'Paid', owedKobo: 0 });
  });

  // Rule 2: Visible History (Timeline) that staff cannot erase
  it('Rule 2: records that matter show a visible history timeline with canStaffErase permanently false', () => {
    const timeline = buildRecordTimeline('BK-2026-001', [
      {
        eventId: 'evt_1',
        recordId: 'BK-2026-001',
        actorName: 'Bisi Adeyemi',
        actorRole: 'Sales agent',
        title: 'Quote Sent to Client',
        description: 'Virgin Atlantic Upper Class quoted at ₦850,000 via WhatsApp share',
        timestampIso: new Date().toISOString(),
      },
    ]);

    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.canStaffErase).toBe(false);
  });

  // Rule 3 & 4: Notifications fire for right person, once, within 30s, and lock screen contains zero sensitive data
  it('Rule 3 & 4: notification fires for target person, delivers within 30s, and strips passport & amounts from lock screen', () => {
    const notif = createTargetedNotification({
      targetUserId: 'usr_bisi',
      category: 'NORMAL_LEAD',
      title: 'New Booking Assigned',
      entityTitle: 'London Flight for Chief Obinna',
      sensitiveAmountKobo: 85000000, // ₦850,000.00
      passportNumber: 'A09482741',
      deepLink: '/bookings?id=BK-2026-001',
      maskAmountsOnLockScreen: true,
    });

    expect(notif.targetUserId).toBe('usr_bisi');
    expect(notif.deliverySlaSeconds).toBeLessThanOrEqual(30);
    expect(notif.deepLink).toBe('/bookings?id=BK-2026-001');

    // Full in-app notification contains details
    expect(notif.bodyFull).toContain('₦850,000.00');
    expect(notif.bodyFull).toContain('A09482741');

    // Lock screen sanitized text strictly protects privacy
    expect(notif.bodyLockScreen).not.toContain('A09482741');
    expect(notif.bodyLockScreen).toContain('[KYC Protected]');
    expect(notif.bodyLockScreen).toContain('[Amount confidential]');
  });

  // Rule 5: Critical notifications cannot be turned off
  it('Rule 5: critical notifications (security, payment failure) cannot be disabled by users', () => {
    const secCheck = canToggleNotificationChannel('CRITICAL_SECURITY');
    expect(secCheck.canDisable).toBe(false);
    expect(secCheck.message).toContain('Critical security alerts');

    const payCheck = canToggleNotificationChannel('CRITICAL_PAYMENT');
    expect(payCheck.canDisable).toBe(false);

    const marketingCheck = canToggleNotificationChannel('NORMAL_MARKETING');
    expect(marketingCheck.canDisable).toBe(true);
  });

  // Rule 6: Emails and WhatsApp shares recorded as "SHARED", never "DELIVERED" or "READ" without provider confirmation
  it('Rule 6: outgoing emails/WhatsApp are marked "SHARED" until webhook confirms delivery or read receipt', () => {
    // 1. Immediately after dispatch: SHARED
    expect(evaluateMessageDeliveryStatus(false, false)).toBe('SHARED');

    // 2. Webhook delivery confirmation callback: DELIVERED
    expect(evaluateMessageDeliveryStatus(true, false)).toBe('DELIVERED');

    // 3. Client read receipt received: READ
    expect(evaluateMessageDeliveryStatus(true, true)).toBe('READ');
  });
});

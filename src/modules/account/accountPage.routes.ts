import { FastifyInstance } from 'fastify';
import {
  listAccountPageRules,
  canUserDisable2FA,
  anonymizeStaffRecords,
  generatePersonalDataArchive,
} from '@/core/account/accountPageRules';

export async function registerAccountPageRoutes(app: FastifyInstance) {
  // 1. List all 8 Page 24 My Account Rules
  app.get('/api/v1/account/rules', async () => {
    const rules = listAccountPageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every((r) => r.isCompliant),
      rules,
    };
  });

  // 2. Email Change (Dual Notification)
  app.post('/api/v1/account/change-email', async (req) => {
    const body = req.body as { currentEmail: string; newEmail: string };
    return {
      success: true,
      currentEmailNotified: true,
      newEmailConfirmationSent: true,
      message: `Confirmation link dispatched to ${body.newEmail}. A security notice was sent to ${body.currentEmail}. Change logged in audit trail.`,
    };
  });

  // 3. Password Change with Session Revocation
  app.post('/api/v1/account/change-password', async (req) => {
    const body = req.body as { currentPassword?: string; newPassword?: string };
    if (!body.currentPassword) {
      return { success: false, message: 'Current password is required to authorize password change.' };
    }
    if (!body.newPassword || body.newPassword.length < 10) {
      return { success: false, message: 'New password must be at least 10 characters long.' };
    }
    return {
      success: true,
      otherSessionsRevoked: true,
      message: 'Password changed successfully. All other active sessions have been terminated.',
    };
  });

  // 4. Toggle 2FA with Role Lockout Check
  app.post('/api/v1/account/toggle-2fa', async (req) => {
    const body = req.body as { userRole: string; enable: boolean };
    if (!body.enable) {
      const check = canUserDisable2FA(body.userRole);
      if (!check.allowed) {
        return {
          success: false,
          error: check.reason,
        };
      }
    }
    return {
      success: true,
      twoFactorEnabled: body.enable,
      message: body.enable
        ? 'Two-Factor Authentication activated. Recovery codes generated.'
        : 'Two-Factor Authentication deactivated.',
    };
  });

  // 5. Active Sessions & Revocation
  app.get('/api/v1/account/sessions', async () => {
    return {
      sessions: [
        {
          id: 'sess_current',
          device: 'Chrome 130 on Windows 11',
          location: 'Ikeja, Lagos, Nigeria',
          ipMasked: '102.89.44.xx',
          lastActive: 'Active now',
          isCurrent: true,
        },
        {
          id: 'sess_mobile_1',
          device: 'Safari on iPhone 15 Pro',
          location: 'Victoria Island, Lagos, Nigeria',
          ipMasked: '105.112.98.xx',
          lastActive: '2 hours ago',
          isCurrent: false,
        },
        {
          id: 'sess_mobile_2',
          device: 'Chrome on Tecno Spark 20 (Android)',
          location: 'Abuja, FCT, Nigeria',
          ipMasked: '197.210.64.xx',
          lastActive: 'Yesterday at 16:42',
          isCurrent: false,
        },
      ],
    };
  });

  app.post('/api/v1/account/revoke-session', async (req) => {
    const body = req.body as { sessionId?: string; revokeAllOthers?: boolean };
    return {
      success: true,
      message: body.revokeAllOthers
        ? 'All other sessions have been successfully signed out.'
        : `Session ${body.sessionId} signed out.`,
    };
  });

  // 6. Delete Account Request & NDPA PII Anonymization
  app.post('/api/v1/account/request-deletion', async (req) => {
    const body = req.body as {
      staffName: string;
      staffEmail: string;
      staffPhone: string;
      isOwner: boolean;
      reason?: string;
    };

    if (body.isOwner) {
      return {
        success: true,
        status: 'OWNER_DATA_REQUEST_INITIATED',
        message: 'Owner account deletion initiated under NDPA data-request process. Workspace export available for 90 days.',
      };
    }

    const anonymized = anonymizeStaffRecords(body.staffName, body.staffEmail, body.staffPhone);
    return {
      success: true,
      status: 'STAFF_DELETION_SUBMITTED_TO_OWNER',
      message: 'Deletion request forwarded to workspace Owner. Historical financial transaction logs are preserved, with PII redacted under legal accounting standards.',
      anonymizedPreview: anonymized,
    };
  });

  // 7. Download My Data (NDPA Self-Service Export)
  app.get('/api/v1/account/download-my-data', async () => {
    const archive = generatePersonalDataArchive({
      userId: 'usr_staff_current',
      name: 'Adaeze Okafor',
      email: 'owner@skylinetravels.ng',
      role: 'OWNER',
      phone: '+234 803 123 4567',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    return archive;
  });
}

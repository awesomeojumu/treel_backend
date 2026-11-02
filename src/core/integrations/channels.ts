import { normalizePhoneForCountry } from '@/core/country-packs/packs';

export interface EmailMessage {
  to: string;
  subject: string;
  htmlContent: string;
  category: 'INVITE' | 'RECEIPT' | 'BILLING' | 'ALERT';
}

export interface ExpoPushNotification {
  toToken: string; // ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

export interface ChannelDeliveryResult {
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
  success: boolean;
  messageId: string;
  recipient: string;
  provider: string;
  fallbackUsed?: boolean;
}

export class TransactionalEmailService {
  /**
   * Dispatch transactional email (mockable adapter)
   */
  public static async send(message: EmailMessage): Promise<ChannelDeliveryResult> {
    const messageId = `EML_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      channel: 'EMAIL',
      success: true,
      messageId,
      recipient: message.to,
      provider: 'Planexi-Transactional-Mailer',
    };
  }

  public static formatInviteEmail(agencyName: string, inviteUrl: string): EmailMessage {
    return {
      to: '',
      subject: `You have been invited to join ${agencyName} on TravelReel`,
      category: 'INVITE',
      htmlContent: `<p>Hello,</p><p>You have been invited to join <strong>${agencyName}</strong> on TravelReel.</p><p><a href="${inviteUrl}">Accept your invitation</a> (Valid for 72 hours).</p>`,
    };
  }
}

export class ExpoPushService {
  /**
   * Validate Expo Push Token format
   */
  public static isValidToken(token: string): boolean {
    return /^ExponentPushToken\[[a-zA-Z0-9_\-]+\]$/.test(token) || /^ExpoPushToken\[[a-zA-Z0-9_\-]+\]$/.test(token);
  }

  /**
   * Send push notification to mobile staff
   */
  public static async send(notification: ExpoPushNotification): Promise<ChannelDeliveryResult> {
    if (!this.isValidToken(notification.toToken)) {
      return {
        channel: 'PUSH',
        success: false,
        messageId: '',
        recipient: notification.toToken,
        provider: 'ExpoPush',
      };
    }

    const messageId = `PUSH_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      channel: 'PUSH',
      success: true,
      messageId,
      recipient: notification.toToken,
      provider: 'ExpoPush',
    };
  }
}

export class MultiProviderSMSWithFallback {
  private primaryApiKey: string;
  private fallbackApiKey: string;

  constructor(primaryApiKey: string, fallbackApiKey = '') {
    this.primaryApiKey = primaryApiKey;
    this.fallbackApiKey = fallbackApiKey;
  }

  /**
   * Send SMS with automated fallback from Termii to Africa's Talking
   */
  public async sendSMS(
    to: string,
    message: string,
    simulatePrimaryFailure = false
  ): Promise<ChannelDeliveryResult> {
    const cleanPhone = normalizePhoneForCountry(to, 'NG').replace(/^\+/, '');

    // Attempt primary provider (Termii)
    if (!simulatePrimaryFailure && this.primaryApiKey) {
      return {
        channel: 'SMS',
        success: true,
        messageId: `TRM_${Date.now()}`,
        recipient: cleanPhone,
        provider: 'Termii (Nigeria DND)',
        fallbackUsed: false,
      };
    }

    // Fallback to secondary provider (Africa's Talking)
    return {
      channel: 'SMS',
      success: true,
      messageId: `AFT_${Date.now()}`,
      recipient: cleanPhone,
      provider: "Africa's Talking (Fallback)",
      fallbackUsed: true,
    };
  }
}

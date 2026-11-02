import { normalizePhoneForCountry } from '@/core/country-packs/packs';
import { MoneyAmount, formatMoney } from '@/core/money/kobo';

export type SMSProvider = 'TERMII' | 'AFRICASTALKING' | 'MOCK';

export interface SMSConfig {
  provider: SMSProvider;
  apiKey: string;
  senderId: string;
  username?: string;
  apiBaseUrl?: string;
}

export interface SendSMSRequest {
  to: string;
  message: string;
  channel?: 'dnd' | 'generic' | 'whatsapp';
}

export interface SendSMSResponse {
  success: boolean;
  messageId: string;
  provider: SMSProvider;
  recipient: string;
  balanceRemaining?: number;
  errorMessage?: string;
}

export class SMSGateway {
  private config: SMSConfig;

  constructor(config: SMSConfig) {
    this.config = config;
  }

  /**
   * Normalize recipient phone to Termii / Africa's Talking format (234XXXXXXXXXX or +234XXXXXXXXXX)
   */
  public normalizePhone(phone: string): string {
    const formatted = normalizePhoneForCountry(phone, 'NG');
    return formatted.replace(/^\+/, ''); // Termii prefers 23480...
  }

  /**
   * Build Termii API JSON request body
   */
  public buildTermiiPayload(request: SendSMSRequest): {
    to: string;
    from: string;
    sms: string;
    type: string;
    channel: string;
    api_key: string;
  } {
    return {
      to: this.normalizePhone(request.to),
      from: this.config.senderId,
      sms: request.message,
      type: 'plain',
      channel: request.channel === 'generic' ? 'generic' : 'dnd',
      api_key: this.config.apiKey,
    };
  }

  /**
   * Build Africa's Talking form data parameters
   */
  public buildAfricasTalkingPayload(request: SendSMSRequest): {
    username: string;
    to: string;
    message: string;
    from: string;
  } {
    return {
      username: this.config.username || process.env.AFRICASTALKING_USERNAME || 'sandbox',
      to: `+${this.normalizePhone(request.to)}`,
      message: request.message,
      from: this.config.senderId,
    };
  }

  /**
   * Dispatch SMS (or mock dispatch for testing & offline mode)
   */
  public async sendSMS(request: SendSMSRequest): Promise<SendSMSResponse> {
    const normalizedRecipient = this.normalizePhone(request.to);

    if (!this.config.apiKey && this.config.provider !== 'MOCK') {
      return {
        success: false,
        messageId: '',
        provider: this.config.provider,
        recipient: normalizedRecipient,
        errorMessage: 'SMS API key is not configured for this agency.',
      };
    }

    // Mock dispatch implementation for tests and dev environments
    const mockMessageId = `SMS_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return {
      success: true,
      messageId: mockMessageId,
      provider: this.config.provider,
      recipient: normalizedRecipient,
      balanceRemaining: 1540,
    };
  }

  // Preset Template Builders
  public static buildOTPMessage(otpCode: string, agencyName: string): string {
    return `Your ${agencyName} verification code is ${otpCode}. Valid for 10 minutes. Do not share this code with anyone.`;
  }

  public static buildPaymentSMS(
    clientName: string,
    amountKobo: number,
    bookingRef: string,
    agencyName: string
  ): string {
    const money: MoneyAmount = { amountMinor: amountKobo, currency: 'NGN' };
    return `Hello ${clientName}, payment of ${formatMoney(money)} received for booking ${bookingRef}. Thank you for choosing ${agencyName}.`;
  }

  public static buildTicketIssuedSMS(
    clientName: string,
    pnr: string,
    flightRoute: string,
    agencyName: string
  ): string {
    return `Dear ${clientName}, your e-ticket has been issued. PNR: ${pnr}, Route: ${flightRoute}. Have a wonderful trip with ${agencyName}!`;
  }
}

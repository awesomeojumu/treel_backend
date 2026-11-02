import crypto from 'crypto';
import { MoneyAmount, formatMoney } from '@/core/money/kobo';

export interface PaystackWebhookPayload {
  event: string;
  data: {
    id: number;
    domain: 'test' | 'live';
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number; // In integer kobo
    message?: string;
    gateway_response?: string;
    paid_at?: string;
    created_at: string;
    channel: 'card' | 'bank' | 'ussd' | 'qr' | 'mobile_money' | 'bank_transfer';
    currency: 'NGN' | 'USD' | 'GHS' | 'KES';
    ip_address?: string;
    metadata?: {
      organizationId?: string;
      bookingId?: string;
      quoteId?: string;
      clientId?: string;
      clientName?: string;
      staffId?: string;
      [key: string]: unknown;
    };
    customer: {
      id: number;
      first_name?: string;
      last_name?: string;
      email: string;
      customer_code: string;
      phone?: string;
    };
    authorization?: {
      authorization_code: string;
      bin?: string;
      last4?: string;
      exp_month?: string;
      exp_year?: string;
      channel?: string;
      card_type?: string;
      bank?: string;
      country_code?: string;
      brand?: string;
      reusable?: boolean;
    };
    plan?: {
      id: number;
      name: string;
      plan_code: string;
      description?: string;
      amount: number;
      interval: 'monthly' | 'annually';
    };
  };
}

export interface PaystackInitializeOptions {
  email: string;
  amountKobo: number;
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  channels?: Array<'card' | 'bank' | 'ussd' | 'qr' | 'mobile_money' | 'bank_transfer'>;
}

export interface PaystackInitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export class PaystackIntegration {
  private secretKey: string;
  private publicKey: string;

  constructor(secretKey: string, publicKey = '') {
    this.secretKey = secretKey;
    this.publicKey = publicKey;
  }

  /**
   * Cryptographically verify the Paystack webhook HMAC-SHA512 signature
   * Paystack signs with HMAC-SHA512 using the agency or platform secret key.
   */
  public verifyWebhookSignature(payloadString: string, signatureHeader: string): boolean {
    if (!signatureHeader || !this.secretKey) {
      return false;
    }
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payloadString, 'utf-8')
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (hash.length !== signatureHeader.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signatureHeader));
  }

  /**
   * Format payment initialization payload
   */
  public buildInitializationPayload(options: PaystackInitializeOptions): {
    email: string;
    amount: number;
    reference: string;
    callback_url?: string;
    metadata: Record<string, unknown>;
    channels?: string[];
  } {
    if (options.amountKobo <= 0 || !Number.isInteger(options.amountKobo)) {
      throw new Error(`Amount must be a positive integer in kobo. Received: ${options.amountKobo}`);
    }

    const reference = options.reference || `TR_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return {
      email: options.email.trim().toLowerCase(),
      amount: options.amountKobo,
      reference,
      ...(options.callbackUrl ? { callback_url: options.callbackUrl } : {}),
      metadata: options.metadata || {},
      ...(options.channels ? { channels: options.channels } : {}),
    };
  }

  /**
   * Process a verified webhook event idempotently
   */
  public processWebhookEvent(
    eventPayload: PaystackWebhookPayload,
    processedReferences: Set<string>
  ): {
    status: 'PROCESSED' | 'DUPLICATE_IGNORED' | 'UNHANDLED_EVENT';
    reference: string;
    amountKobo?: number;
    formattedAmount?: string;
    channel?: string;
    organizationId?: string;
    bookingId?: string;
  } {
    const { event, data } = eventPayload;
    const ref = data.reference;

    if (processedReferences.has(ref)) {
      return {
        status: 'DUPLICATE_IGNORED',
        reference: ref,
      };
    }

    if (event === 'charge.success') {
      const money: MoneyAmount = { amountMinor: data.amount, currency: 'NGN' };
      processedReferences.add(ref);

      return {
        status: 'PROCESSED',
        reference: ref,
        amountKobo: data.amount,
        formattedAmount: formatMoney(money),
        channel: data.channel,
        organizationId: data.metadata?.organizationId,
        bookingId: data.metadata?.bookingId,
      };
    }

    if (event === 'subscription.create' || event === 'invoice.payment_failed') {
      processedReferences.add(ref);
      return {
        status: 'PROCESSED',
        reference: ref,
        organizationId: data.metadata?.organizationId,
      };
    }

    return {
      status: 'UNHANDLED_EVENT',
      reference: ref,
    };
  }
}

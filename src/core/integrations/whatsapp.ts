import { MoneyAmount, formatMoney } from '@/core/money/kobo';
import { normalizePhoneForCountry } from '@/core/country-packs/packs';

export interface WhatsAppReceiptParams {
  clientName: string;
  clientPhone: string;
  receiptNumber: string;
  amountKobo: number;
  paymentMethod: string;
  bookingReference: string;
  agencyName: string;
  outstandingBalanceKobo?: number;
}

export interface WhatsAppQuoteParams {
  clientName: string;
  clientPhone: string;
  quoteNumber: string;
  destination: string;
  totalKobo: number;
  validUntil: string;
  agencyName: string;
  viewLink?: string;
}

export interface WhatsAppItineraryParams {
  clientName: string;
  clientPhone: string;
  bookingReference: string;
  pnr: string;
  passengerNames: string[];
  flightSummary: string;
  ticketTimeLimit?: string;
  agencyName: string;
}

export class WhatsAppIntegration {
  /**
   * Normalizes Nigerian phone numbers for WhatsApp wa.me links
   * Format: 2348012345678 (no leading +, no spaces, no hyphens)
   */
  public static cleanPhoneForWhatsApp(phone: string): string {
    const normalized = normalizePhoneForCountry(phone, 'NG');
    return normalized.replace(/^\+/, '');
  }

  /**
   * Generate an instant wa.me deep link
   */
  public static buildWaMeLink(phone: string, text: string): string {
    const cleanPhone = this.cleanPhoneForWhatsApp(phone);
    const encoded = encodeURIComponent(text);
    return `https://wa.me/${cleanPhone}?text=${encoded}`;
  }

  /**
   * Compose receipt message in strict sentence case with tabular Naira amounts
   */
  public static formatReceiptMessage(params: WhatsAppReceiptParams): string {
    const paymentAmount: MoneyAmount = { amountMinor: params.amountKobo, currency: 'NGN' };
    const balanceAmount: MoneyAmount = {
      amountMinor: params.outstandingBalanceKobo ?? 0,
      currency: 'NGN',
    };

    const lines = [
      `*Payment receipt from ${params.agencyName}*`,
      ``,
      `Hello ${params.clientName},`,
      `We have received your payment. Here are your transaction details:`,
      ``,
      `• *Receipt number:* ${params.receiptNumber}`,
      `• *Booking reference:* ${params.bookingReference}`,
      `• *Amount received:* ${formatMoney(paymentAmount)}`,
      `• *Payment method:* ${params.paymentMethod}`,
    ];

    if ((params.outstandingBalanceKobo ?? 0) > 0) {
      lines.push(`• *Remaining balance:* ${formatMoney(balanceAmount)}`);
    } else {
      lines.push(`• *Payment status:* Fully paid`);
    }

    lines.push(``);
    lines.push(`Thank you for booking with ${params.agencyName}.`);
    return lines.join('\n');
  }

  /**
   * Compose quote message
   */
  public static formatQuoteMessage(params: WhatsAppQuoteParams): string {
    const total: MoneyAmount = { amountMinor: params.totalKobo, currency: 'NGN' };

    const lines = [
      `*Travel quote from ${params.agencyName}*`,
      ``,
      `Hello ${params.clientName},`,
      `Here is the quotation for your trip to *${params.destination}*:`,
      ``,
      `• *Quote number:* ${params.quoteNumber}`,
      `• *Total amount:* ${formatMoney(total)}`,
      `• *Valid until:* ${params.validUntil}`,
    ];

    if (params.viewLink) {
      lines.push(``);
      lines.push(`View your full quote breakdown online: ${params.viewLink}`);
    }

    lines.push(``);
    lines.push(`Please let us know if you would like to proceed with this booking.`);
    return lines.join('\n');
  }

  /**
   * Compose flight itinerary & PNR notification
   */
  public static formatItineraryMessage(params: WhatsAppItineraryParams): string {
    const lines = [
      `*Flight booking confirmed (${params.agencyName})*`,
      ``,
      `Hello ${params.clientName},`,
      `Your flight booking has been confirmed with the following details:`,
      ``,
      `• *Booking reference:* ${params.bookingReference}`,
      `• *Airline PNR:* *${params.pnr}*`,
      `• *Passengers:* ${params.passengerNames.join(', ')}`,
      `• *Flight route:* ${params.flightSummary}`,
    ];

    if (params.ticketTimeLimit) {
      lines.push(`• *Ticket time limit:* ${params.ticketTimeLimit}`);
      lines.push(`_Please note: Tickets must be issued before the time limit to avoid cancellation by the airline._`);
    }

    lines.push(``);
    lines.push(`Safe travels with ${params.agencyName}!`);
    return lines.join('\n');
  }

  /**
   * Build WhatsApp Cloud API interactive/template JSON payload
   */
  public static buildCloudApiPayload(phone: string, messageBody: string): {
    messaging_product: string;
    recipient_type: string;
    to: string;
    type: string;
    text: { body: string };
  } {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.cleanPhoneForWhatsApp(phone),
      type: 'text',
      text: {
        body: messageBody,
      },
    };
  }
}

import crypto from 'crypto';
import { PaystackIntegration, PaystackWebhookPayload } from '@/core/integrations/paystack';
import { WhatsAppIntegration } from '@/core/integrations/whatsapp';
import { GDSParser } from '@/core/integrations/gds';
import { SMSGateway } from '@/core/integrations/sms';
import { globalIntegrationsManager } from '@/core/integrations/integrationsManager';

describe('Section 12: Third-Party Integrations (Paystack, WhatsApp, GDS & SMS)', () => {
  describe('1. Paystack Integration', () => {
    const secretKey = 'sk_test_mock_secret_key_12345';
    const paystack = new PaystackIntegration(secretKey, 'pk_test_public_key');

    it('verifies HMAC-SHA512 webhook signature accurately', () => {
      const rawPayload = JSON.stringify({
        event: 'charge.success',
        data: { reference: 'TR_PAY_1001', amount: 25000000 },
      });

      const validSignature = crypto
        .createHmac('sha512', secretKey)
        .update(rawPayload, 'utf-8')
        .digest('hex');

      expect(paystack.verifyWebhookSignature(rawPayload, validSignature)).toBe(true);
      expect(paystack.verifyWebhookSignature(rawPayload, 'invalid_signature_hash')).toBe(false);
      expect(paystack.verifyWebhookSignature(rawPayload, '')).toBe(false);
    });

    it('processes charge.success event idempotently and formats kobo money', () => {
      const ledgerRefs = new Set<string>();

      const payload: PaystackWebhookPayload = {
        event: 'charge.success',
        data: {
          id: 991,
          domain: 'test',
          status: 'success',
          reference: 'TR_REF_4421',
          amount: 35000000, // ₦350,000.00
          channel: 'bank_transfer',
          currency: 'NGN',
          created_at: new Date().toISOString(),
          customer: {
            id: 12,
            email: 'client@example.ng',
            customer_code: 'CUS_123',
          },
          metadata: {
            organizationId: 'org_planexi_default',
            bookingId: 'BK_9001',
          },
        },
      };

      // First run: should process
      const res1 = paystack.processWebhookEvent(payload, ledgerRefs);
      expect(res1.status).toBe('PROCESSED');
      expect(res1.amountKobo).toBe(35000000);
      expect(res1.formattedAmount).toBe('₦350,000.00');
      expect(ledgerRefs.has('TR_REF_4421')).toBe(true);

      // Second run with same reference: must be deduplicated
      const res2 = paystack.processWebhookEvent(payload, ledgerRefs);
      expect(res2.status).toBe('DUPLICATE_IGNORED');
    });

    it('builds payment initialization payload with integer kobo verification', () => {
      const init = paystack.buildInitializationPayload({
        email: 'traveler@lagos.com',
        amountKobo: 12500000, // ₦125,000.00
        callbackUrl: 'https://app.travelreel.ng/callback',
      });

      expect(init.amount).toBe(12500000);
      expect(init.email).toBe('traveler@lagos.com');
      expect(init.reference).toMatch(/^TR_/);
      expect(init.callback_url).toBe('https://app.travelreel.ng/callback');

      // Invalid kobo decimals or negative amount should throw
      expect(() =>
        paystack.buildInitializationPayload({
          email: 'test@ng.com',
          amountKobo: 50.75, // Not integer
        })
      ).toThrow();
    });
  });

  describe('2. WhatsApp Business API & wa.me Sharing', () => {
    it('normalizes Nigerian phone numbers for wa.me links', () => {
      expect(WhatsAppIntegration.cleanPhoneForWhatsApp('0803 123 4567')).toBe('2348031234567');
      expect(WhatsAppIntegration.cleanPhoneForWhatsApp('+234 812 345 6789')).toBe('2348123456789');
      expect(WhatsAppIntegration.cleanPhoneForWhatsApp('09099887766')).toBe('2349099887766');
    });

    it('generates wa.me deep link with receipt details in Naira', () => {
      const receiptMessage = WhatsAppIntegration.formatReceiptMessage({
        clientName: 'Babatunde Adebayo',
        clientPhone: '08023456789',
        receiptNumber: 'REC-2026-091',
        amountKobo: 45000000, // ₦450,000.00
        paymentMethod: 'Bank transfer',
        bookingReference: 'BK-LOS-LHR-004',
        agencyName: 'Skylink Travels Lagos',
        outstandingBalanceKobo: 0,
      });

      expect(receiptMessage).toContain('*Receipt number:* REC-2026-091');
      expect(receiptMessage).toContain('*Amount received:* ₦450,000.00');
      expect(receiptMessage).toContain('*Payment status:* Fully paid');

      const waLink = WhatsAppIntegration.buildWaMeLink('08023456789', receiptMessage);
      expect(waLink).toMatch(/^https:\/\/wa\.me\/2348023456789\?text=/);
      expect(waLink).toContain(encodeURIComponent('₦450,000.00'));
    });

    it('formats quote and flight itinerary messages', () => {
      const quoteMsg = WhatsAppIntegration.formatQuoteMessage({
        clientName: 'Chioma Okeke',
        clientPhone: '08139998877',
        quoteNumber: 'QT-2026-012',
        destination: 'Dubai (DXB)',
        totalKobo: 125000000,
        validUntil: '15 Nov 2026',
        agencyName: 'TravelReel Prestige',
        viewLink: 'https://app.travelreel.ng/quotes/QT-2026-012',
      });
      expect(quoteMsg).toContain('Dubai (DXB)');
      expect(quoteMsg).toContain('₦1,250,000.00');

      const itineraryMsg = WhatsAppIntegration.formatItineraryMessage({
        clientName: 'Chioma Okeke',
        clientPhone: '08139998877',
        bookingReference: 'BK-DXB-902',
        pnr: 'EK78AB',
        passengerNames: ['Chioma Okeke', 'Emeka Okeke'],
        flightSummary: 'LOS -> DXB on Emirates EK 784',
        ticketTimeLimit: '12 Nov 2026 18:00',
        agencyName: 'TravelReel Prestige',
      });
      expect(itineraryMsg).toContain('*EK78AB*');
      expect(itineraryMsg).toContain('*Ticket time limit:* 12 Nov 2026 18:00');
    });

    it('builds WhatsApp Cloud API JSON payload', () => {
      const payload = WhatsAppIntegration.buildCloudApiPayload('0803 123 4567', 'Test message');
      expect(payload.messaging_product).toBe('whatsapp');
      expect(payload.to).toBe('2348031234567');
      expect(payload.text.body).toBe('Test message');
    });
  });

  describe('3. GDS & Consolidator Ticketing Parser', () => {
    it('parses Amadeus raw PNR text with passengers, segments, and TTL', () => {
      const rawAmadeus = `
--- RLR ---
RP/LOS1A0987/LOS1A0987   AA/SU  10NOV26/1430Z   AMAD99
1.ADEBAYO/KUNLE MR  2.CHUKWU/NGOZI MRS
1  BA 074 Y 15NOV LOSLHR HK2  2255 0515+1
2  BA 075 Y 25NOV LHRLOS HK2  1145 1805
TK TL12NOV/LOS
FA PAX 125-4567890123
FA PAX 125-4567890124
      `.trim();

      const parsed = GDSParser.parse(rawAmadeus);
      expect(parsed.system).toBe('AMADEUS');
      expect(parsed.pnr).toBe('AMAD99');
      expect(parsed.passengers.length).toBe(2);
      expect(parsed.passengers[0]!.lastName).toBe('ADEBAYO');
      expect(parsed.passengers[0]!.firstName).toBe('KUNLE');
      expect(parsed.passengers[0]!.title).toBe('MR');
      expect(parsed.passengers[0]!.eTicketNumber).toBe('125-4567890123');

      expect(parsed.segments.length).toBe(2);
      expect(parsed.segments[0]!.airlineCode).toBe('BA');
      expect(parsed.segments[0]!.flightNumber).toBe('074');
      expect(parsed.segments[0]!.origin).toBe('LOS');
      expect(parsed.segments[0]!.destination).toBe('LHR');

      expect(parsed.ticketTimeLimit).toContain('12NOV 23:59');
    });

    it('parses Sabre raw PNR text correctly', () => {
      const rawSabre = `
SABRE RECORD LOCATOR: SABR88
1.1JOHNSON/OLUMIDE MR
1 ET 900 K 18NOV LOSADD HK1  1340 2050 /E
7TAW14NOV/
      `.trim();

      const parsed = GDSParser.parse(rawSabre);
      expect(parsed.system).toBe('SABRE');
      expect(parsed.pnr).toBe('SABR88');
      expect(parsed.passengers.length).toBe(1);
      expect(parsed.passengers[0]!.lastName).toBe('JOHNSON');
      expect(parsed.segments[0]!.airlineCode).toBe('ET');
      expect(parsed.segments[0]!.flightNumber).toBe('900');
    });

    it('flags urgent TTL when time limit contains urgent indicator', () => {
      const rawUrgent = `
RP/LOS1A0987/LOS1A0987   AA/SU   URG999
1.WILLIAMS/TUNDE MR
1  QR 1408 Y 05NOV LOSDOH HK1 1830 0540+1
TK TL04NOV/LOS URGENT
      `.trim();

      const parsed = GDSParser.parse(rawUrgent);
      expect(parsed.isUrgentTTL).toBe(true);
      expect(parsed.ttlRemainingHours).toBe(12);
    });
  });

  describe('4. SMS Gateway (Termii & Africa\'s Talking)', () => {
    const gateway = new SMSGateway({
      provider: 'TERMII',
      apiKey: 'test_termii_api_key',
      senderId: 'TravelReel',
    });

    it('builds Termii payload conforming to Nigerian DND requirements', () => {
      const payload = gateway.buildTermiiPayload({
        to: '0802 333 4444',
        message: 'Your verification code is 884102',
        channel: 'dnd',
      });

      expect(payload.to).toBe('2348023334444');
      expect(payload.from).toBe('TravelReel');
      expect(payload.channel).toBe('dnd');
      expect(payload.api_key).toBe('test_termii_api_key');
    });

    it('dispatches SMS mock transaction successfully', async () => {
      const result = await gateway.sendSMS({
        to: '+234 901 222 3333',
        message: 'Flight booking confirmed!',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^SMS_/);
      expect(result.recipient).toBe('2349012223333');
    });

    it('builds preset Nigerian SMS templates', () => {
      const otpMsg = SMSGateway.buildOTPMessage('482910', 'Skylink Travel');
      expect(otpMsg).toBe('Your Skylink Travel verification code is 482910. Valid for 10 minutes. Do not share this code with anyone.');

      const paymentSms = SMSGateway.buildPaymentSMS('Femi', 15000000, 'BK-882', 'TravelReel');
      expect(paymentSms).toContain('₦150,000.00');
    });
  });

  describe('5. Workspace Integrations Manager & Security Masking', () => {
    it('returns masked sensitive keys for workspace settings', () => {
      const orgId = 'org_agency_ikeja';
      globalIntegrationsManager.updateConfig(orgId, {
        paystack: {
          enabled: true,
          publicKey: 'pk_live_abcdef1234567890',
          secretKey: 'sk_live_supersecretkey999',
          webhookSecret: 'whsec_99999',
          liveMode: true,
        },
        sms: {
          enabled: true,
          provider: 'TERMII',
          apiKey: 'termii_key_12345',
          senderId: 'FLYSAFE',
        },
      });

      const masked = globalIntegrationsManager.getMaskedConfig(orgId) as any;
      expect(masked.paystack.enabled).toBe(true);
      expect(masked.paystack.publicKey).toBe('pk_l••••7890');
      expect(masked.paystack.hasSecretKey).toBe(true);
      expect(masked.sms.senderId).toBe('FLYSAFE');
      expect(masked.sms.hasApiKey).toBe(true);
    });

    it('records and returns webhook delivery audit log', () => {
      const log = globalIntegrationsManager.logWebhook({
        provider: 'PAYSTACK',
        event: 'charge.success',
        reference: 'REF_TEST_007',
        status: 'SUCCESS',
        detail: 'Credited ₦250,000.00 to booking BK-10',
      });

      expect(log.id).toMatch(/^whl_/);
      expect(log.status).toBe('SUCCESS');
      const allLogs = globalIntegrationsManager.getWebhookLogs();
      expect(allLogs[0]!.reference).toBe('REF_TEST_007');
    });
  });
});

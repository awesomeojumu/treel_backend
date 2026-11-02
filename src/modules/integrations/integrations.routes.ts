import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { globalIntegrationsManager } from '@/core/integrations/integrationsManager';
import { WhatsAppIntegration } from '@/core/integrations/whatsapp';
import { GDSParser } from '@/core/integrations/gds';

export async function registerIntegrationsRoutes(app: FastifyInstance): Promise<void> {
  // Paystack Webhook Handler
  app.post(
    '/api/v1/integrations/paystack/webhook',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = (request.headers['x-paystack-signature'] as string) || '';
      const rawBody = JSON.stringify(request.body);
      const organizationId =
        (request.headers['x-organization-id'] as string) || 'org_planexi_default';

      const paystack = globalIntegrationsManager.getPaystack(organizationId);

      // Verify HMAC-SHA512
      const isValid = paystack.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        globalIntegrationsManager.logWebhook({
          provider: 'PAYSTACK',
          event: (request.body as { event?: string })?.event || 'unknown',
          reference: (request.body as { data?: { reference?: string } })?.data?.reference || 'none',
          status: 'FAILED',
          detail: 'Invalid HMAC-SHA512 signature',
        });
        return reply.status(400).send({ error: 'Invalid Paystack webhook signature' });
      }

      const payload = request.body as any;
      const result = paystack.processWebhookEvent(
        payload,
        globalIntegrationsManager.getProcessedReferences()
      );

      globalIntegrationsManager.logWebhook({
        provider: 'PAYSTACK',
        event: payload.event,
        reference: result.reference,
        status: result.status === 'PROCESSED' ? 'SUCCESS' : 'IGNORED',
        detail: `Status: ${result.status}, Amount: ${result.formattedAmount || 'N/A'}`,
      });

      return reply.status(200).send({ received: true, ...result });
    }
  );

  // Paystack Initialize Payment
  app.post(
    '/api/v1/integrations/paystack/initialize',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        email: string;
        amountKobo: number;
        reference?: string;
        callbackUrl?: string;
        organizationId?: string;
      };
      const orgId = body.organizationId || 'org_planexi_default';
      const paystack = globalIntegrationsManager.getPaystack(orgId);

      try {
        const payload = paystack.buildInitializationPayload({
          email: body.email,
          amountKobo: body.amountKobo,
          reference: body.reference,
          callbackUrl: body.callbackUrl,
          metadata: { organizationId: orgId },
        });

        return reply.send({
          success: true,
          authorizationUrl: `https://checkout.paystack.com/${payload.reference}`,
          accessCode: `acc_${payload.reference.toLowerCase()}`,
          reference: payload.reference,
        });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // WhatsApp Deep-link Generator
  app.post(
    '/api/v1/integrations/whatsapp/deep-link',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        type: 'receipt' | 'quote' | 'itinerary' | 'custom';
        phone: string;
        data: any;
      };

      let message = '';
      if (body.type === 'receipt') {
        message = WhatsAppIntegration.formatReceiptMessage(body.data);
      } else if (body.type === 'quote') {
        message = WhatsAppIntegration.formatQuoteMessage(body.data);
      } else if (body.type === 'itinerary') {
        message = WhatsAppIntegration.formatItineraryMessage(body.data);
      } else {
        message = body.data.message || '';
      }

      const waMeUrl = WhatsAppIntegration.buildWaMeLink(body.phone, message);
      return reply.send({
        success: true,
        phone: WhatsAppIntegration.cleanPhoneForWhatsApp(body.phone),
        message,
        waMeUrl,
      });
    }
  );

  // GDS PNR Parser
  app.post(
    '/api/v1/integrations/gds/parse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { rawPnr: string };
      if (!body.rawPnr || typeof body.rawPnr !== 'string') {
        return reply.status(400).send({ error: 'rawPnr text is required' });
      }

      const parsed = GDSParser.parse(body.rawPnr);
      return reply.send({
        success: true,
        booking: parsed,
      });
    }
  );

  // SMS Dispatch
  app.post(
    '/api/v1/integrations/sms/send',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        to: string;
        message: string;
        channel?: 'dnd' | 'generic' | 'whatsapp';
        organizationId?: string;
      };
      const orgId = body.organizationId || 'org_planexi_default';
      const gateway = globalIntegrationsManager.getSMSGateway(orgId);

      const result = await gateway.sendSMS({
        to: body.to,
        message: body.message,
        channel: body.channel,
      });

      globalIntegrationsManager.logWebhook({
        provider: 'SMS',
        event: 'sms.dispatch',
        reference: result.messageId,
        status: result.success ? 'SUCCESS' : 'FAILED',
        detail: `To: ${result.recipient}, Provider: ${result.provider}`,
      });

      return reply.send(result);
    }
  );

  // Integrations Settings (Masked)
  app.get(
    '/api/v1/integrations/settings',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = (request.headers['x-organization-id'] as string) || 'org_planexi_default';
      const masked = globalIntegrationsManager.getMaskedConfig(orgId);
      return reply.send(masked);
    }
  );

  // Update Integrations Settings
  app.patch(
    '/api/v1/integrations/settings',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = (request.headers['x-organization-id'] as string) || 'org_planexi_default';
      const body = request.body as any;
      const updated = globalIntegrationsManager.updateConfig(orgId, body);
      return reply.send({
        success: true,
        config: globalIntegrationsManager.getMaskedConfig(orgId),
      });
    }
  );

  // Webhook Event Logs
  app.get(
    '/api/v1/integrations/webhooks',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const logs = globalIntegrationsManager.getWebhookLogs();
      return reply.send({ logs });
    }
  );
}

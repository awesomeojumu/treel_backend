import { PaystackIntegration } from './paystack';
import { WhatsAppIntegration } from './whatsapp';
import { GDSParser, ParsedGDSBooking } from './gds';
import { SMSGateway, SMSConfig } from './sms';

export interface WorkspaceIntegrationsConfig {
  organizationId: string;
  paystack: {
    enabled: boolean;
    publicKey: string;
    secretKey: string;
    webhookSecret: string;
    liveMode: boolean;
  };
  whatsapp: {
    enabled: boolean;
    phoneNumberId?: string;
    accessToken?: string;
    defaultSenderName: string;
  };
  gds: {
    enabled: boolean;
    primarySystem: 'AMADEUS' | 'SABRE' | 'CONSOLIDATOR';
    consolidatorName?: 'FINCHGLOW' | 'WAKANOW' | 'TRAVELSTART' | 'OTHER';
    officeId?: string;
  };
  sms: {
    enabled: boolean;
    provider: 'TERMII' | 'AFRICASTALKING' | 'MOCK';
    apiKey: string;
    senderId: string;
  };
}

export interface WebhookLogEntry {
  id: string;
  timestamp: string;
  provider: 'PAYSTACK' | 'WHATSAPP' | 'GDS' | 'SMS';
  event: string;
  reference: string;
  status: 'SUCCESS' | 'FAILED' | 'IGNORED';
  detail: string;
}

export class IntegrationsManager {
  private configs: Map<string, WorkspaceIntegrationsConfig> = new Map();
  private webhookLogs: WebhookLogEntry[] = [];
  private processedReferences: Set<string> = new Set();

  constructor() {
    // Seed default workspace configuration
    this.configs.set('org_planexi_default', {
      organizationId: 'org_planexi_default',
      paystack: {
        enabled: true,
        publicKey: 'pk_test_sample1234567890',
        secretKey: 'sk_test_sample9876543210',
        webhookSecret: 'whsec_travelreel_test_secret',
        liveMode: false,
      },
      whatsapp: {
        enabled: true,
        defaultSenderName: 'TravelReel Agency',
      },
      gds: {
        enabled: true,
        primarySystem: 'AMADEUS',
        consolidatorName: 'FINCHGLOW',
        officeId: 'LOS1A0987',
      },
      sms: {
        enabled: true,
        provider: 'TERMII',
        apiKey: 'mock_termii_api_key_12345',
        senderId: 'TravelReel',
      },
    });
  }

  public getConfig(organizationId: string): WorkspaceIntegrationsConfig {
    const existing = this.configs.get(organizationId);
    if (existing) return existing;

    const defaultConfig: WorkspaceIntegrationsConfig = {
      organizationId,
      paystack: {
        enabled: false,
        publicKey: '',
        secretKey: '',
        webhookSecret: '',
        liveMode: false,
      },
      whatsapp: {
        enabled: true,
        defaultSenderName: 'Travel Agency',
      },
      gds: {
        enabled: true,
        primarySystem: 'AMADEUS',
        consolidatorName: 'FINCHGLOW',
      },
      sms: {
        enabled: false,
        provider: 'TERMII',
        apiKey: '',
        senderId: 'TRAVELREEL',
      },
    };
    this.configs.set(organizationId, defaultConfig);
    return defaultConfig;
  }

  public updateConfig(
    organizationId: string,
    updates: Partial<WorkspaceIntegrationsConfig>
  ): WorkspaceIntegrationsConfig {
    const current = this.getConfig(organizationId);
    const updated = {
      ...current,
      ...updates,
      organizationId,
    };
    this.configs.set(organizationId, updated);
    return updated;
  }

  public getMaskedConfig(organizationId: string): Record<string, unknown> {
    const cfg = this.getConfig(organizationId);
    const maskKey = (key: string) =>
      key && key.length > 8 ? `${key.substring(0, 4)}••••${key.substring(key.length - 4)}` : '••••';

    return {
      organizationId: cfg.organizationId,
      paystack: {
        enabled: cfg.paystack.enabled,
        publicKey: maskKey(cfg.paystack.publicKey),
        hasSecretKey: Boolean(cfg.paystack.secretKey),
        liveMode: cfg.paystack.liveMode,
      },
      whatsapp: {
        enabled: cfg.whatsapp.enabled,
        defaultSenderName: cfg.whatsapp.defaultSenderName,
        hasAccessToken: Boolean(cfg.whatsapp.accessToken),
      },
      gds: {
        enabled: cfg.gds.enabled,
        primarySystem: cfg.gds.primarySystem,
        consolidatorName: cfg.gds.consolidatorName,
        officeId: cfg.gds.officeId,
      },
      sms: {
        enabled: cfg.sms.enabled,
        provider: cfg.sms.provider,
        hasApiKey: Boolean(cfg.sms.apiKey),
        senderId: cfg.sms.senderId,
      },
    };
  }

  public logWebhook(entry: Omit<WebhookLogEntry, 'id' | 'timestamp'>): WebhookLogEntry {
    const log: WebhookLogEntry = {
      ...entry,
      id: `whl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.webhookLogs.unshift(log);
    if (this.webhookLogs.length > 100) {
      this.webhookLogs.pop();
    }
    return log;
  }

  public getWebhookLogs(): WebhookLogEntry[] {
    return this.webhookLogs;
  }

  public getPaystack(organizationId: string): PaystackIntegration {
    const cfg = this.getConfig(organizationId);
    return new PaystackIntegration(cfg.paystack.secretKey, cfg.paystack.publicKey);
  }

  public getSMSGateway(organizationId: string): SMSGateway {
    const cfg = this.getConfig(organizationId);
    return new SMSGateway({
      provider: cfg.sms.provider,
      apiKey: cfg.sms.apiKey,
      senderId: cfg.sms.senderId,
    });
  }

  public getProcessedReferences(): Set<string> {
    return this.processedReferences;
  }
}

export const globalIntegrationsManager = new IntegrationsManager();

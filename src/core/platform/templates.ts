import { z } from 'zod';
import { CountryCode, CurrencyCode, getCountryPack } from '@/core/country-packs/packs';
import { ModuleKey } from '@/core/platform/layers';

export const BusinessTemplateIdSchema = z.enum([
  'TICKETING',
  'VISA',
  'HOTELS',
  'PACKAGES',
  'GROUPS',
]);
export type BusinessTemplateId = z.infer<typeof BusinessTemplateIdSchema>;

export interface PipelineStageConfig {
  key: string;
  label: string;
  order: number;
  isTerminal: boolean;
  requiresLostReason?: boolean;
}

export interface CustomFieldDefinitionConfig {
  key: string;
  label: string;
  entity: 'CLIENT' | 'LEAD' | 'BOOKING' | 'VISA_CASE';
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN';
  options?: string[];
  required: boolean;
}

export interface CommissionTierConfig {
  roleKey: string;
  minRevenueMinor: number;
  rateBps: number; // Basis points: 500 = 5.00%
}

export interface BusinessTypeTemplate {
  templateId: BusinessTemplateId;
  version: number;
  name: string;
  description: string;
  defaultModules: ModuleKey[];
  defaultPipelineStages: PipelineStageConfig[];
  defaultCustomFields: CustomFieldDefinitionConfig[];
  defaultBookingItemTypes: ('FLIGHT' | 'HOTEL' | 'VISA' | 'PACKAGE' | 'OTHER')[];
  defaultCommissionTiers: CommissionTierConfig[];
  defaultDocumentTemplates: {
    quoteFooter: string;
    invoiceTerms: string;
    receiptNote: string;
    whatsappShareText: string;
  };
}

const DEFAULT_LEAD_PIPELINE: PipelineStageConfig[] = [
  { key: 'NEW', label: 'New', order: 1, isTerminal: false },
  { key: 'CONTACTED', label: 'Contacted', order: 2, isTerminal: false },
  { key: 'QUOTED', label: 'Quoted', order: 3, isTerminal: false },
  { key: 'WON', label: 'Won', order: 4, isTerminal: true },
  { key: 'LOST', label: 'Lost', order: 5, isTerminal: true, requiresLostReason: true },
];

export const BUSINESS_TEMPLATES: Record<BusinessTemplateId, BusinessTypeTemplate> = {
  TICKETING: {
    templateId: 'TICKETING',
    version: 1,
    name: 'Flight & Ticketing Agency',
    description: 'High-volume flight ticketing, consolidator tracking, PNR management, and part-payments.',
    defaultModules: ['clients', 'leads', 'quotes', 'bookings', 'payments', 'ledger', 'tickets', 'suppliers'],
    defaultPipelineStages: DEFAULT_LEAD_PIPELINE,
    defaultCustomFields: [
      {
        key: 'preferred_airline',
        label: 'Preferred Airline',
        entity: 'LEAD',
        fieldType: 'TEXT',
        required: false,
      },
      {
        key: 'cabin_class',
        label: 'Cabin Class',
        entity: 'BOOKING',
        fieldType: 'SELECT',
        options: ['Economy', 'Premium Economy', 'Business', 'First'],
        required: false,
      },
    ],
    defaultBookingItemTypes: ['FLIGHT', 'OTHER'],
    defaultCommissionTiers: [{ roleKey: 'SALES_AGENT', minRevenueMinor: 0, rateBps: 300 }],
    defaultDocumentTemplates: {
      quoteFooter: 'Fares are subject to airline availability until ticketed.',
      invoiceTerms: 'Tickets are non-refundable unless airline fare rules permit.',
      receiptNote: 'Thank you for flying with us.',
      whatsappShareText: 'Hello {{clientName}}, here is your flight quote ({{reference}}) from {{agencyName}}.',
    },
  },
  VISA: {
    templateId: 'VISA',
    version: 1,
    name: 'Visa Advisory & Processing Agency',
    description: 'Visa consultation, document checklists, embassy appointment deadlines, and KYC tracking.',
    defaultModules: ['clients', 'leads', 'quotes', 'bookings', 'payments', 'ledger', 'visas', 'documents'],
    defaultPipelineStages: DEFAULT_LEAD_PIPELINE,
    defaultCustomFields: [
      {
        key: 'destination_country',
        label: 'Destination Country',
        entity: 'LEAD',
        fieldType: 'TEXT',
        required: true,
      },
      {
        key: 'visa_category',
        label: 'Visa Category',
        entity: 'VISA_CASE',
        fieldType: 'SELECT',
        options: ['Tourist', 'Study', 'Business', 'Work', 'Medical', 'Transit'],
        required: true,
      },
    ],
    defaultBookingItemTypes: ['VISA', 'FLIGHT', 'OTHER'],
    defaultCommissionTiers: [{ roleKey: 'SALES_AGENT', minRevenueMinor: 0, rateBps: 500 }],
    defaultDocumentTemplates: {
      quoteFooter: 'Embassy visa fees and service charges are non-refundable once submitted.',
      invoiceTerms: 'Visa issuance is at the sole discretion of the issuing Embassy/High Commission.',
      receiptNote: 'Payment received towards visa advisory and processing.',
      whatsappShareText: 'Hello {{clientName}}, your visa application summary ({{reference}}) from {{agencyName}} is ready.',
    },
  },
  HOTELS: {
    templateId: 'HOTELS',
    version: 1,
    name: 'Hotels & Corporate Stays Agency',
    description: 'Hotel reservations, corporate accommodation, transfers, and supplier vouchers.',
    defaultModules: ['clients', 'leads', 'quotes', 'bookings', 'payments', 'ledger', 'suppliers'],
    defaultPipelineStages: DEFAULT_LEAD_PIPELINE,
    defaultCustomFields: [
      {
        key: 'check_in_date',
        label: 'Check-In Date',
        entity: 'BOOKING',
        fieldType: 'DATE',
        required: true,
      },
      {
        key: 'board_basis',
        label: 'Board Basis',
        entity: 'BOOKING',
        fieldType: 'SELECT',
        options: ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board', 'All Inclusive'],
        required: false,
      },
    ],
    defaultBookingItemTypes: ['HOTEL', 'OTHER'],
    defaultCommissionTiers: [{ roleKey: 'SALES_AGENT', minRevenueMinor: 0, rateBps: 400 }],
    defaultDocumentTemplates: {
      quoteFooter: 'Hotel rates and room categories are subject to availability at confirmation.',
      invoiceTerms: 'Cancellation policies follow the hotel check-in terms stated on your voucher.',
      receiptNote: 'Payment received for accommodation booking.',
      whatsappShareText: 'Hello {{clientName}}, here is your hotel reservation details ({{reference}}) from {{agencyName}}.',
    },
  },
  PACKAGES: {
    templateId: 'PACKAGES',
    version: 1,
    name: 'Holiday Packages & Tours Agency',
    description: 'Bundled flights, hotels, visas, and tours for families, honeymoons, and leisure travellers.',
    defaultModules: ['clients', 'leads', 'quotes', 'bookings', 'payments', 'ledger', 'tickets', 'visas', 'suppliers'],
    defaultPipelineStages: DEFAULT_LEAD_PIPELINE,
    defaultCustomFields: [
      {
        key: 'traveller_count',
        label: 'Number of Travellers',
        entity: 'LEAD',
        fieldType: 'NUMBER',
        required: false,
      },
    ],
    defaultBookingItemTypes: ['PACKAGE', 'FLIGHT', 'HOTEL', 'VISA', 'OTHER'],
    defaultCommissionTiers: [{ roleKey: 'SALES_AGENT', minRevenueMinor: 0, rateBps: 500 }],
    defaultDocumentTemplates: {
      quoteFooter: 'Package pricing includes listed inclusions only. Deposit locks in land arrangements.',
      invoiceTerms: 'Part-payments accepted according to your agreed instalment schedule.',
      receiptNote: 'Thank you for your package payment.',
      whatsappShareText: 'Hello {{clientName}}, view your travel package quote ({{reference}}) from {{agencyName}}.',
    },
  },
  GROUPS: {
    templateId: 'GROUPS',
    version: 1,
    name: 'Group Travel, Pilgrimages & Excursions',
    description: 'Scheduled departures, Hajj/Umrah/Jerusalem pilgrimages, school & church trips, manifests, and rooming lists.',
    defaultModules: [
      'clients',
      'leads',
      'quotes',
      'bookings',
      'payments',
      'ledger',
      'tickets',
      'visas',
      'suppliers',
      'groups',
    ],
    defaultPipelineStages: DEFAULT_LEAD_PIPELINE,
    defaultCustomFields: [
      {
        key: 'group_sponsor',
        label: 'Group / Church / School Name',
        entity: 'BOOKING',
        fieldType: 'TEXT',
        required: false,
      },
      {
        key: 'room_sharing_preference',
        label: 'Room Sharing Preference',
        entity: 'BOOKING',
        fieldType: 'SELECT',
        options: ['Single', 'Twin Share', 'Triple Share', 'Quad Share'],
        required: false,
      },
    ],
    defaultBookingItemTypes: ['PACKAGE', 'FLIGHT', 'HOTEL', 'VISA', 'OTHER'],
    defaultCommissionTiers: [{ roleKey: 'SALES_AGENT', minRevenueMinor: 0, rateBps: 400 }],
    defaultDocumentTemplates: {
      quoteFooter: 'Seats on group departures are confirmed upon receipt of the initial deposit.',
      invoiceTerms: 'Final balance is due prior to manifest lock and departure check-in.',
      receiptNote: 'Instalment recorded towards group departure.',
      whatsappShareText: 'Hello {{clientName}}, here is your group departure update ({{reference}}) from {{agencyName}}.',
    },
  },
};

export interface WorkspaceSnapshotFromTemplate {
  organizationId: string;
  sourceTemplateId: BusinessTemplateId;
  sourceTemplateVersion: number;
  sourceCountryCode: CountryCode;
  baseCurrency: CurrencyCode;
  supportedForeignCurrencies: CurrencyCode[];
  vatRatePercent: number;
  timeZone: string;
  pipelineStages: PipelineStageConfig[];
  customFields: CustomFieldDefinitionConfig[];
  commissionTiers: CommissionTierConfig[];
  documentTemplates: BusinessTypeTemplate['defaultDocumentTemplates'];
  workingHours: {
    days: ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT')[];
    startTime: string;
    endTime: string;
  };
  copiedAt: Date;
}

/**
 * Section 1 & Section 6:
 * BusinessTypeTemplate and CountryPack are platform-owned and copied into a workspace at sign-up,
 * so a later template change never silently alters a live workspace.
 */
export function instantiateWorkspaceFromTemplate(params: {
  organizationId: string;
  templateId: BusinessTemplateId;
  countryCode?: CountryCode;
}): WorkspaceSnapshotFromTemplate {
  const countryPack = getCountryPack(params.countryCode ?? 'NG', { requireSellable: true });
  const template = structuredClone(BUSINESS_TEMPLATES[params.templateId]);

  return {
    organizationId: params.organizationId,
    sourceTemplateId: template.templateId,
    sourceTemplateVersion: template.version,
    sourceCountryCode: countryPack.code,
    baseCurrency: countryPack.baseCurrency.code,
    supportedForeignCurrencies: [...countryPack.supportedForeignCurrencies],
    vatRatePercent: countryPack.tax.defaultRatePercent,
    timeZone: countryPack.timeZone,
    pipelineStages: structuredClone(template.defaultPipelineStages),
    customFields: structuredClone(template.defaultCustomFields),
    commissionTiers: structuredClone(template.defaultCommissionTiers),
    documentTemplates: structuredClone(template.defaultDocumentTemplates),
    workingHours: {
      days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      startTime: '08:00',
      endTime: '17:00',
    },
    copiedAt: new Date(),
  };
}

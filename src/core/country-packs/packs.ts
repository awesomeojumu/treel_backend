import { z } from 'zod';

export const CountryCodeSchema = z.enum(['NG', 'GH', 'KE', 'ZA']);
export type CountryCode = z.infer<typeof CountryCodeSchema>;

export const CurrencyCodeSchema = z.enum(['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP', 'EUR']);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

export interface IdDocumentTypeSpec {
  code: string;
  label: string;
  pattern?: string;
  maskedByDefault: boolean;
  requiresKycViewFlag: boolean;
}

export interface PaymentMethodSpec {
  code: 'BANK_TRANSFER' | 'CASH' | 'POS' | 'MOBILE_MONEY' | 'EFT';
  label: string;
  isPrimary: boolean;
  requiresProofOfPayment: boolean;
}

export interface PublicHolidaySpec {
  name: string;
  monthDay?: string; // MM-DD for fixed holidays
  isMovable: boolean;
}

export interface LegalNoticeSpec {
  authority: string;
  regulationName: string;
  consentText: string;
  crossBorderTransferNotice: string;
  maxRetentionMonthsAfterCaseClose: number;
}

export interface CountryPack {
  code: CountryCode;
  name: string;
  timeZone: string;
  baseCurrency: {
    code: CurrencyCode;
    symbol: string;
    majorUnitName: string;
    minorUnitName: string;
    minorUnitScale: number; // 100 for Naira/kobo
  };
  supportedForeignCurrencies: CurrencyCode[];
  tax: {
    name: string;
    defaultRatePercent: number; // e.g. 7.5 for Nigeria VAT
    ownerConfigurable: boolean;
  };
  phone: {
    dialingCode: string; // e.g. '+234'
    nationalPrefix: string; // e.g. '0'
    nsnLengths: number[]; // National Significant Number lengths
    exampleLocal: string;
    exampleE164: string;
  };
  paymentMethods: PaymentMethodSpec[];
  idTypes: IdDocumentTypeSpec[];
  publicHolidays: PublicHolidaySpec[];
  legal: LegalNoticeSpec;
  commercialReadiness: {
    paymentProviderReady: boolean;
    legalReviewApproved: boolean;
    availableForSale: boolean;
    targetLaunchDate: string;
  };
}

export const COUNTRY_PACKS: Record<CountryCode, CountryPack> = {
  NG: {
    code: 'NG',
    name: 'Nigeria',
    timeZone: 'Africa/Lagos',
    baseCurrency: {
      code: 'NGN',
      symbol: '₦',
      majorUnitName: 'Naira',
      minorUnitName: 'kobo',
      minorUnitScale: 100,
    },
    supportedForeignCurrencies: ['USD', 'GBP', 'EUR'],
    tax: {
      name: 'VAT',
      defaultRatePercent: 7.5,
      ownerConfigurable: true,
    },
    phone: {
      dialingCode: '+234',
      nationalPrefix: '0',
      nsnLengths: [10],
      exampleLocal: '08031234567',
      exampleE164: '+2348031234567',
    },
    paymentMethods: [
      {
        code: 'BANK_TRANSFER',
        label: 'Bank Transfer (with Proof of Payment)',
        isPrimary: true,
        requiresProofOfPayment: true,
      },
      {
        code: 'POS',
        label: 'POS Terminal',
        isPrimary: false,
        requiresProofOfPayment: false,
      },
      {
        code: 'CASH',
        label: 'Cash',
        isPrimary: false,
        requiresProofOfPayment: false,
      },
    ],
    idTypes: [
      {
        code: 'NIN',
        label: 'National Identification Number (NIN)',
        pattern: '^\\d{11}$',
        maskedByDefault: true,
        requiresKycViewFlag: true,
      },
      {
        code: 'INTERNATIONAL_PASSPORT',
        label: 'International Passport',
        pattern: '^[A-Z]{1,2}\\d{7,8}$',
        maskedByDefault: true,
        requiresKycViewFlag: true,
      },
    ],
    publicHolidays: [
      { name: "New Year's Day", monthDay: '01-01', isMovable: false },
      { name: 'Good Friday', isMovable: true },
      { name: 'Easter Monday', isMovable: true },
      { name: 'Eid el-Fitr', isMovable: true },
      { name: "Workers' Day", monthDay: '05-01', isMovable: false },
      { name: 'Democracy Day', monthDay: '06-12', isMovable: false },
      { name: 'Eid el-Kabir', isMovable: true },
      { name: 'Eid el-Maulud', isMovable: true },
      { name: 'Independence Day', monthDay: '10-01', isMovable: false },
      { name: 'Christmas Day', monthDay: '12-25', isMovable: false },
      { name: 'Boxing Day', monthDay: '12-26', isMovable: false },
    ],
    legal: {
      authority: 'Nigeria Data Protection Commission (NDPC)',
      regulationName: 'Nigeria Data Protection Act (NDPA) 2023',
      consentText:
        'Your personal and identity data (NIN, International Passport, contact details) are collected by this travel agency as Data Controller and processed via TravelReel (Planexi) strictly for travel booking, ticketing, and visa processing under the Nigeria Data Protection Act (NDPA) 2023.',
      crossBorderTransferNotice:
        'Application data is encrypted at rest and hosted in AWS Cape Town (af-south-1) under standard data processing safeguards.',
      maxRetentionMonthsAfterCaseClose: 24,
    },
    commercialReadiness: {
      paymentProviderReady: true,
      legalReviewApproved: true,
      availableForSale: true,
      targetLaunchDate: '2026-11-30',
    },
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    timeZone: 'Africa/Accra',
    baseCurrency: {
      code: 'GHS',
      symbol: 'GH₵',
      majorUnitName: 'Cedi',
      minorUnitName: 'pesewa',
      minorUnitScale: 100,
    },
    supportedForeignCurrencies: ['USD', 'GBP', 'EUR'],
    tax: {
      name: 'VAT',
      defaultRatePercent: 15.0,
      ownerConfigurable: true,
    },
    phone: {
      dialingCode: '+233',
      nationalPrefix: '0',
      nsnLengths: [9],
      exampleLocal: '0241234567',
      exampleE164: '+233241234567',
    },
    paymentMethods: [
      {
        code: 'MOBILE_MONEY',
        label: 'Mobile Money (MoMo)',
        isPrimary: true,
        requiresProofOfPayment: true,
      },
      {
        code: 'BANK_TRANSFER',
        label: 'Bank Transfer',
        isPrimary: false,
        requiresProofOfPayment: true,
      },
      {
        code: 'CASH',
        label: 'Cash',
        isPrimary: false,
        requiresProofOfPayment: false,
      },
    ],
    idTypes: [
      {
        code: 'GHANA_CARD',
        label: 'Ghana Card (National ID)',
        maskedByDefault: true,
        requiresKycViewFlag: true,
      },
      {
        code: 'INTERNATIONAL_PASSPORT',
        label: 'International Passport',
        maskedByDefault: true,
        requiresKycViewFlag: true,
      },
    ],
    publicHolidays: [
      { name: "New Year's Day", monthDay: '01-01', isMovable: false },
      { name: 'Independence Day', monthDay: '03-06', isMovable: false },
      { name: "Workers' Day", monthDay: '05-01', isMovable: false },
      { name: 'Founders Day', monthDay: '08-04', isMovable: false },
      { name: 'Christmas Day', monthDay: '12-25', isMovable: false },
    ],
    legal: {
      authority: 'Data Protection Commission (Ghana)',
      regulationName: 'Data Protection Act, 2012 (Act 843)',
      consentText:
        'Personal and travel document details are collected with your consent for booking and visa processing under Act 843.',
      crossBorderTransferNotice: 'Hosted in Cape Town (af-south-1) with encrypted storage.',
      maxRetentionMonthsAfterCaseClose: 24,
    },
    commercialReadiness: {
      paymentProviderReady: false,
      legalReviewApproved: false,
      availableForSale: false,
      targetLaunchDate: '2027-10-30',
    },
  },
  KE: {
    code: 'KE',
    name: 'Kenya',
    timeZone: 'Africa/Nairobi',
    baseCurrency: {
      code: 'KES',
      symbol: 'KSh',
      majorUnitName: 'Shilling',
      minorUnitName: 'cent',
      minorUnitScale: 100,
    },
    supportedForeignCurrencies: ['USD', 'GBP', 'EUR'],
    tax: {
      name: 'VAT',
      defaultRatePercent: 16.0,
      ownerConfigurable: true,
    },
    phone: {
      dialingCode: '+254',
      nationalPrefix: '0',
      nsnLengths: [9],
      exampleLocal: '0712345678',
      exampleE164: '+254712345678',
    },
    paymentMethods: [
      {
        code: 'MOBILE_MONEY',
        label: 'M-Pesa',
        isPrimary: true,
        requiresProofOfPayment: true,
      },
      {
        code: 'BANK_TRANSFER',
        label: 'Bank Transfer',
        isPrimary: false,
        requiresProofOfPayment: true,
      },
    ],
    idTypes: [
      {
        code: 'KENYA_NATIONAL_ID',
        label: 'National ID Card',
        maskedByDefault: true,
        requiresKycViewFlag: true,
      },
      {
        code: 'INTERNATIONAL_PASSPORT',
        label: 'International Passport',
        maskedByDefault: true,
        requiresKycViewFlag: true,
      },
    ],
    publicHolidays: [
      { name: "New Year's Day", monthDay: '01-01', isMovable: false },
      { name: 'Labour Day', monthDay: '05-01', isMovable: false },
      { name: 'Madaraka Day', monthDay: '06-01', isMovable: false },
      { name: 'Jamhuri Day', monthDay: '12-12', isMovable: false },
      { name: 'Christmas Day', monthDay: '12-25', isMovable: false },
    ],
    legal: {
      authority: 'Office of the Data Protection Commissioner (ODPC)',
      regulationName: 'Kenya Data Protection Act, 2019',
      consentText:
        'Personal and travel document details are collected with your consent for booking and visa processing under the Data Protection Act, 2019.',
      crossBorderTransferNotice: 'Hosted in Cape Town (af-south-1) with encrypted storage.',
      maxRetentionMonthsAfterCaseClose: 24,
    },
    commercialReadiness: {
      paymentProviderReady: false,
      legalReviewApproved: false,
      availableForSale: false,
      targetLaunchDate: '2027-10-30',
    },
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    timeZone: 'Africa/Johannesburg',
    baseCurrency: {
      code: 'ZAR',
      symbol: 'R',
      majorUnitName: 'Rand',
      minorUnitName: 'cent',
      minorUnitScale: 100,
    },
    supportedForeignCurrencies: ['USD', 'GBP', 'EUR'],
    tax: {
      name: 'VAT',
      defaultRatePercent: 15.0,
      ownerConfigurable: true,
    },
    phone: {
      dialingCode: '+27',
      nationalPrefix: '0',
      nsnLengths: [9],
      exampleLocal: '0821234567',
      exampleE164: '+27821234567',
    },
    paymentMethods: [
      {
        code: 'EFT',
        label: 'Instant EFT / Bank Transfer',
        isPrimary: true,
        requiresProofOfPayment: true,
      },
      {
        code: 'POS',
        label: 'Card Machine',
        isPrimary: false,
        requiresProofOfPayment: false,
      },
    ],
    idTypes: [
      {
        code: 'SA_ID',
        label: 'South African ID Number',
        maskedByDefault: true,
        requiresKycViewFlag: true,
      },
      {
        code: 'INTERNATIONAL_PASSPORT',
        label: 'International Passport',
        maskedByDefault: true,
        requiresKycViewFlag: true,
      },
    ],
    publicHolidays: [
      { name: "New Year's Day", monthDay: '01-01', isMovable: false },
      { name: 'Human Rights Day', monthDay: '03-21', isMovable: false },
      { name: 'Freedom Day', monthDay: '04-27', isMovable: false },
      { name: "Workers' Day", monthDay: '05-01', isMovable: false },
      { name: 'Heritage Day', monthDay: '09-24', isMovable: false },
      { name: 'Christmas Day', monthDay: '12-25', isMovable: false },
    ],
    legal: {
      authority: 'Information Regulator (South Africa)',
      regulationName: 'Protection of Personal Information Act (POPIA)',
      consentText:
        'Personal and travel document details are collected with your consent for booking and visa processing under POPIA.',
      crossBorderTransferNotice: 'Hosted in Cape Town (af-south-1) within South Africa.',
      maxRetentionMonthsAfterCaseClose: 24,
    },
    commercialReadiness: {
      paymentProviderReady: false,
      legalReviewApproved: false,
      availableForSale: false,
      targetLaunchDate: '2027-10-30',
    },
  },
};

/**
 * Retrieves a country pack by code.
 * If requireSellable is true (default for new agency sign-ups), enforces that both
 * local payment provider and legal review are in place (Section 1).
 */
export function getCountryPack(
  code: CountryCode,
  options: { requireSellable?: boolean } = { requireSellable: true }
): CountryPack {
  const pack = COUNTRY_PACKS[code];
  if (!pack) {
    throw new Error(`Unsupported country pack: ${code}`);
  }
  if (
    options.requireSellable &&
    (!pack.commercialReadiness.paymentProviderReady ||
      !pack.commercialReadiness.legalReviewApproved ||
      !pack.commercialReadiness.availableForSale)
  ) {
    throw new Error(
      `Country pack '${code}' (${pack.name}) is loaded as data only and cannot be sold until a local payment provider and legal review are in place.`
    );
  }
  // Return a deep clone so workspace copies never mutate the platform pack
  return structuredClone(pack);
}

/**
 * Normalizes a phone number into E.164 format according to the CountryPack rules.
 * Example (NG): "08031234567" -> "+2348031234567"
 */
export function normalizePhoneForCountry(rawPhone: string, countryCode: CountryCode = 'NG'): string {
  const pack = COUNTRY_PACKS[countryCode];
  const stripped = rawPhone.replace(/[\s\-().]/g, '');
  const digitsOnly = stripped.startsWith('+') ? `+${stripped.slice(1).replace(/\D/g, '')}` : stripped.replace(/\D/g, '');

  const dialDigits = pack.phone.dialingCode.replace('+', '');

  let nsn = '';
  if (digitsOnly.startsWith(pack.phone.dialingCode)) {
    nsn = digitsOnly.slice(pack.phone.dialingCode.length);
  } else if (digitsOnly.startsWith(dialDigits)) {
    nsn = digitsOnly.slice(dialDigits.length);
  } else if (digitsOnly.startsWith(pack.phone.nationalPrefix)) {
    nsn = digitsOnly.slice(pack.phone.nationalPrefix.length);
  } else {
    nsn = digitsOnly;
  }

  // Handle cases like +23408031234567 where leading 0 was kept after dialing code
  if (nsn.startsWith(pack.phone.nationalPrefix) && pack.phone.nsnLengths.includes(nsn.length - 1)) {
    nsn = nsn.slice(1);
  }

  if (!/^\d+$/.test(nsn) || !pack.phone.nsnLengths.includes(nsn.length)) {
    throw new Error(
      `Invalid ${pack.name} phone number '${rawPhone}'. Expected format like ${pack.phone.exampleLocal} or ${pack.phone.exampleE164}.`
    );
  }

  return `${pack.phone.dialingCode}${nsn}`;
}

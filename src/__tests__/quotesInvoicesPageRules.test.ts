import {
  listQuotesInvoicesPageRules,
  validateQuoteLineItems,
  calculateQuoteTotals,
  sanitizeQuoteForClient,
  checkDiscountApprovalRequirement,
  isQuoteExpired,
  acceptQuoteAndGenerateInvoice,
  voidInvoice,
  issueCreditNote,
  recordInvoicePayment,
  categorizeOutstandingInvoices,
  CASH_PAYMENT_LIMIT_INDIVIDUAL_KOBO,
  QuoteRecord,
  InvoiceRecord,
  QuoteLineItem,
} from '../core/quotes/quotesInvoicesPageRules';

describe('Quotes & Invoices Specification Engine (quotesInvoicesPageRules)', () => {
  const sampleLineItems: QuoteLineItem[] = [
    {
      id: 'li-1',
      type: 'flight',
      description: 'Lagos to London Return Economy (Virgin Atlantic)',
      quantity: 2,
      unitPriceKobo: 1_250_000_00, // ₦1,250,000 * 2 = ₦2,500,000
      supplierCostKobo: 1_100_000_00, // ₦1,100,000 * 2 = ₦2,200,000
      supplierName: 'Virgin Atlantic Direct',
      vatApplies: false, // International passenger flights VAT zero-rated
    },
    {
      id: 'li-2',
      type: 'hotel',
      description: '4 Nights Central London 4-Star Hotel',
      quantity: 1,
      unitPriceKobo: 600_000_00, // ₦600,000
      supplierCostKobo: 480_000_00,
      supplierName: 'Hotelbeds',
      vatApplies: true, // 7.5% = ₦45,000
    },
    {
      id: 'li-3',
      type: 'transfer',
      description: 'Airport Executive Pickup & Dropoff',
      quantity: 1,
      unitPriceKobo: 0,
      supplierCostKobo: 50_000_00,
      supplierName: 'London Chauffeur Co',
      vatApplies: false,
      inclusionNote: 'Complimentary VIP arrival package included',
    },
  ];

  const sampleQuote: QuoteRecord = {
    id: 'QT-2026-0042',
    version: 1,
    organizationId: 'org-lagos-travels',
    clientId: 'cl-001',
    clientName: 'Dr. Babatunde Adeleke',
    clientPhone: '+2348031234567',
    clientEmail: 'babatunde.adeleke@example.com',
    date: '2026-11-01T10:00:00Z',
    validUntilDate: '2026-11-08T10:00:00Z', // 7 days later
    travellersCount: 2,
    lineItems: sampleLineItems,
    discountKobo: 50_000_00, // ₦50,000
    subtotalNetKobo: 3_100_000_00, // 2.5m + 600k = 3.1m
    totalVatKobo: 45_000_00, // 7.5% of 600k
    totalGrossKobo: 3_095_000_00, // (3.1m - 50k) + 45k
    supplierCostTotalKobo: 2_730_000_00, // 2.2m + 480k + 50k
    marginKobo: 320_000_00, // 3.05m net - 2.73m supplier cost
    marginPercent: 10.5,
    notes: 'Please verify passport names match international travel tickets exactly.',
    terms: 'Tickets are non-refundable once ticketed. Hotel cancellation policy applies 48 hours prior.',
    paymentDetails: 'Zenith Bank - Planexi Travel Ltd - 1012345678',
    status: 'draft',
    requiresDiscountApproval: false,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    createdByStaffId: 'staff-01',
    createdByStaffName: 'Chioma Okeke',
  };

  test('Rule catalog: lists exactly 18 compliant specifications', () => {
    const rules = listQuotesInvoicesPageRules();
    expect(rules).toHaveLength(18);
    for (const rule of rules) {
      expect(rule.isCompliant).toBe(true);
      expect(rule.requirement).toBeTruthy();
    }
  });

  describe('Quote Builder: Line Item Validation (Rules 2, 5)', () => {
    test('rejects empty line items list', () => {
      const res = validateQuoteLineItems([]);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toMatch(/at least one line item/i);
    });

    test('rejects missing description or invalid quantity', () => {
      const res = validateQuoteLineItems([
        {
          id: '1',
          type: 'flight',
          description: '',
          quantity: 0,
          unitPriceKobo: 100_000_00,
          supplierCostKobo: 80_000_00,
          vatApplies: false,
        },
      ]);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Line item #1: Description is required.');
      expect(res.errors).toContain('Line item #1: Quantity must be at least 1.');
    });

    test('rejects negative unit price unless item type is discount', () => {
      const invalid = validateQuoteLineItems([
        {
          id: '1',
          type: 'hotel',
          description: 'Special Rebate',
          quantity: 1,
          unitPriceKobo: -50_000_00,
          supplierCostKobo: 0,
          vatApplies: false,
        },
      ]);
      expect(invalid.valid).toBe(false);
      expect(invalid.errors[0]).toMatch(/Negative prices are only permitted on "discount"/i);

      const validDiscount = validateQuoteLineItems([
        {
          id: '2',
          type: 'discount',
          description: 'Early Bird Promotional Concession',
          quantity: 1,
          unitPriceKobo: -50_000_00,
          supplierCostKobo: 0,
          vatApplies: false,
        },
      ]);
      expect(validDiscount.valid).toBe(true);
    });

    test('requires inclusion explanation note for zero-price items', () => {
      const missingNote = validateQuoteLineItems([
        {
          id: '1',
          type: 'transfer',
          description: 'Airport Transfer',
          quantity: 1,
          unitPriceKobo: 0,
          supplierCostKobo: 10_000_00,
          vatApplies: false,
        },
      ]);
      expect(missingNote.valid).toBe(false);
      expect(missingNote.errors[0]).toMatch(/inclusion explanation note/i);

      const withNote = validateQuoteLineItems([
        {
          id: '1',
          type: 'transfer',
          description: 'Airport Transfer',
          quantity: 1,
          unitPriceKobo: 0,
          supplierCostKobo: 10_000_00,
          vatApplies: false,
          inclusionNote: 'Complimentary VIP Meet & Greet included',
        },
      ]);
      expect(withNote.valid).toBe(true);
    });
  });

  describe('Totals Calculation & 7.5% Statutory VAT (Rule 3)', () => {
    test('correctly calculates subtotal, 7.5% statutory VAT, and gross totals', () => {
      const totals = calculateQuoteTotals(sampleLineItems, 50_000_00);
      expect(totals.subtotalNetKobo).toBe(3_100_000_00);
      expect(totals.discountKobo).toBe(50_000_00);
      expect(totals.totalVatKobo).toBe(45_000_00); // 7.5% of 600,000
      expect(totals.totalGrossKobo).toBe(3_095_000_00);
      expect(totals.supplierCostTotalKobo).toBe(2_730_000_00);
      expect(totals.marginKobo).toBe(320_000_00); // 3,050,000 net after discount - 2,730,000 supplier cost
      expect(totals.marginPercent).toBe(10.5);
    });
  });

  describe('Customer PDF Sanitization (Rule 8)', () => {
    test('strictly strips internal supplier cost and commercial margin from customer view', () => {
      const clientView = sanitizeQuoteForClient(sampleQuote);
      expect(clientView.id).toBe('QT-2026-0042');
      expect(clientView.clientName).toBe('Dr. Babatunde Adeleke');
      expect(clientView.totalGrossKobo).toBe(3_095_000_00);

      // Verify privacy strip on line items
      for (const line of clientView.lineItems) {
        expect(line.supplierCostKobo).toBeUndefined();
        expect(line.supplierName).toBeUndefined();
      }

      // Verify privacy strip on commercial margin
      expect(clientView.supplierCostTotalKobo).toBeUndefined();
      expect(clientView.marginKobo).toBeUndefined();
      expect(clientView.marginPercent).toBeUndefined();
    });
  });

  describe('Discount Approval Gate (Rule 4)', () => {
    test('allows Owner and Operations Manager to apply any discount without approval', () => {
      const ownerCheck = checkDiscountApprovalRequirement(1_000_000_00, 3_000_000_00, 'OWNER');
      expect(ownerCheck.requiresApproval).toBe(false);

      const mgrCheck = checkDiscountApprovalRequirement(
        1_000_000_00,
        3_000_000_00,
        'OPERATIONS_MANAGER'
      );
      expect(mgrCheck.requiresApproval).toBe(false);
    });

    test('flags discount above staff threshold (5%) for approval', () => {
      // ₦100,000 discount on ₦1,000,000 net = 10% (> 5%)
      const agentHighDiscount = checkDiscountApprovalRequirement(
        100_000_00,
        1_000_000_00,
        'SALES_AGENT',
        5
      );
      expect(agentHighDiscount.requiresApproval).toBe(true);
      expect(agentHighDiscount.reason).toMatch(/Discount of 10.0% exceeds your allowed limit of 5%/i);

      // ₦40,000 discount on ₦1,000,000 net = 4% (<= 5%)
      const agentWithinLimit = checkDiscountApprovalRequirement(
        40_000_00,
        1_000_000_00,
        'SALES_AGENT',
        5
      );
      expect(agentWithinLimit.requiresApproval).toBe(false);
    });
  });

  describe('Validity and Expiration (Rule 7)', () => {
    test('evaluates expired quote accurately against simulated clock', () => {
      const validQuote = { ...sampleQuote, validUntilDate: '2026-11-08T10:00:00Z' };
      const nowBefore = new Date('2026-11-05T12:00:00Z').getTime();
      const nowAfter = new Date('2026-11-09T12:00:00Z').getTime();

      expect(isQuoteExpired(validQuote, nowBefore)).toBe(false);
      expect(isQuoteExpired(validQuote, nowAfter)).toBe(true);
    });
  });

  describe('Accept Quote Conversion (Rule 11)', () => {
    test('converts quote to booking and invoice with identical totals and locks quote', () => {
      const conversion = acceptQuoteAndGenerateInvoice(sampleQuote, 104, new Date('2026-11-02T12:00:00Z').getTime());

      expect(conversion.updatedQuote.status).toBe('accepted');
      expect(conversion.updatedQuote.convertedBookingId).toBe('BK-2026-042');
      expect(conversion.updatedQuote.convertedInvoiceId).toBe('INV-2026-0104');

      expect(conversion.invoice.id).toBe('INV-2026-0104');
      expect(conversion.invoice.quoteId).toBe(sampleQuote.id);
      expect(conversion.invoice.bookingId).toBe('BK-2026-042');
      expect(conversion.invoice.totalGrossKobo).toBe(sampleQuote.totalGrossKobo);
      expect(conversion.invoice.balanceKobo).toBe(sampleQuote.totalGrossKobo);
      expect(conversion.invoice.status).toBe('issued');
    });
  });

  describe('Invoice Voiding & Credit Notes (Rules 12, 13)', () => {
    const issuedInvoice: InvoiceRecord = {
      id: 'INV-2026-0104',
      organizationId: 'org-lagos-travels',
      quoteId: 'QT-2026-0042',
      bookingId: 'BK-2026-042',
      clientId: 'cl-001',
      clientName: 'Dr. Babatunde Adeleke',
      clientPhone: '+2348031234567',
      date: '2026-11-02T12:00:00Z',
      dueDate: '2026-11-09T12:00:00Z',
      subtotalNetKobo: 3_050_000_00,
      totalVatKobo: 45_000_00,
      totalGrossKobo: 3_095_000_00,
      amountPaidKobo: 0,
      balanceKobo: 3_095_000_00,
      status: 'issued',
      isVoid: false,
      lineItems: sampleLineItems,
      creditNotes: [],
      createdAt: '2026-11-02T12:00:00Z',
      updatedAt: '2026-11-02T12:00:00Z',
    };

    test('voids unpaid invoice with mandatory audit reason', () => {
      const voidResult = voidInvoice(issuedInvoice, 'Client cancelled reservation prior to flight ticketing');
      expect(voidResult.success).toBe(true);
      expect(voidResult.voidedInvoice?.isVoid).toBe(true);
      expect(voidResult.voidedInvoice?.status).toBe('void');
      expect(voidResult.voidedInvoice?.voidReason).toBe(
        'Client cancelled reservation prior to flight ticketing'
      );
    });

    test('refuses to void invoice with recorded payments', () => {
      const partPaidInvoice: InvoiceRecord = {
        ...issuedInvoice,
        amountPaidKobo: 1_000_000_00,
        balanceKobo: 2_095_000_00,
        status: 'part_paid',
      };
      const voidAttempt = voidInvoice(partPaidInvoice, 'Accidental booking');
      expect(voidAttempt.success).toBe(false);
      expect(voidAttempt.error).toMatch(/Invoices with recorded payments cannot be voided directly/i);
    });

    test('issues valid credit note and adjusts invoice balance', () => {
      const creditRes = issueCreditNote(
        issuedInvoice,
        95_000_00, // ₦95,000 credit
        'Airline concession adjustment'
      );
      expect(creditRes.success).toBe(true);
      expect(creditRes.updatedInvoice?.balanceKobo).toBe(3_000_000_00);
      expect(creditRes.updatedInvoice?.creditNotes).toHaveLength(1);
      expect(creditRes.updatedInvoice?.creditNotes[0].amountKobo).toBe(95_000_00);
    });

    test('rejects credit note amount exceeding remaining balance', () => {
      const overCredit = issueCreditNote(
        issuedInvoice,
        5_000_000_00,
        'Exorbitant credit beyond balance'
      );
      expect(overCredit.success).toBe(false);
      expect(overCredit.error).toMatch(/cannot exceed remaining invoice balance/i);
    });
  });

  describe('Payment Recording, Balance Ceiling & Money Laundering Limit (Rules 14, 15, 16)', () => {
    const testInvoice: InvoiceRecord = {
      id: 'INV-2026-0200',
      organizationId: 'org-lagos-travels',
      bookingId: 'BK-2026-050',
      clientId: 'cl-002',
      clientName: 'Chief Emeka Okafor',
      clientPhone: '+2348029876543',
      date: '2026-11-01T09:00:00Z',
      dueDate: '2026-11-08T09:00:00Z',
      subtotalNetKobo: 6_000_000_00,
      totalVatKobo: 0,
      totalGrossKobo: 6_000_000_00,
      amountPaidKobo: 0,
      balanceKobo: 6_000_000_00,
      status: 'issued',
      isVoid: false,
      lineItems: [],
      creditNotes: [],
      createdAt: '2026-11-01T09:00:00Z',
      updatedAt: '2026-11-01T09:00:00Z',
    };

    test('records valid part payment and updates balance and status to part_paid', () => {
      const now = new Date('2026-11-02T12:00:00Z').getTime();
      const res = recordInvoicePayment(
        testInvoice,
        {
          amountKobo: 2_000_000_00,
          method: 'transfer',
          date: '2026-11-02T11:30:00Z',
          payerName: 'Emeka Okafor',
          reference: 'NIP-20261102-123498',
          staffName: 'Chioma Okeke',
        },
        812,
        now
      );

      expect(res.success).toBe(true);
      expect(res.updatedInvoice?.amountPaidKobo).toBe(2_000_000_00);
      expect(res.updatedInvoice?.balanceKobo).toBe(4_000_000_00);
      expect(res.updatedInvoice?.status).toBe('part_paid');
      expect(res.receipt?.id).toBe('RCT-2026-0812');
      expect(res.receipt?.balanceAfterPaymentKobo).toBe(4_000_000_00);
      expect(res.receipt?.isReprintCopy).toBe(false);
      expect(res.receipt?.isCashOverLimit).toBe(false);
    });

    test('rejects payment with future date', () => {
      const now = new Date('2026-11-02T12:00:00Z').getTime();
      const res = recordInvoicePayment(
        testInvoice,
        {
          amountKobo: 500_000_00,
          method: 'POS',
          date: '2026-11-05T12:00:00Z', // 3 days in future
          payerName: 'Emeka Okafor',
          staffName: 'Chioma Okeke',
        },
        813,
        now
      );
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Payment date cannot be in the future/i);
    });

    test('rejects overpayment when isOverpaymentAllowed is false', () => {
      const now = new Date('2026-11-02T12:00:00Z').getTime();
      const res = recordInvoicePayment(
        testInvoice,
        {
          amountKobo: 7_000_000_00, // Balance is 6,000,000
          method: 'transfer',
          date: '2026-11-02T10:00:00Z',
          payerName: 'Emeka Okafor',
          staffName: 'Chioma Okeke',
          isOverpaymentAllowed: false,
        },
        814,
        now
      );
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/exceeds invoice balance/i);
    });

    test('flags cash payments exceeding ₦5,000,000 under Nigerian Money Laundering Act', () => {
      const now = new Date('2026-11-02T12:00:00Z').getTime();
      const res = recordInvoicePayment(
        testInvoice,
        {
          amountKobo: 5_500_000_00, // ₦5.5m in cash (> ₦5.0m limit)
          method: 'cash',
          date: '2026-11-02T10:00:00Z',
          payerName: 'Emeka Okafor',
          staffName: 'Chioma Okeke',
        },
        815,
        now
      );
      expect(res.success).toBe(true);
      expect(res.receipt?.isCashOverLimit).toBe(true);
      expect(CASH_PAYMENT_LIMIT_INDIVIDUAL_KOBO).toBe(500_000_000); // ₦5,000,000 in kobo
    });
  });

  describe('Outstanding Aging Buckets (Rule 17)', () => {
    test('categorizes unpaid invoices into 0-7, 8-30, and >30 day buckets', () => {
      const baseMs = new Date('2026-11-02T12:00:00Z').getTime();
      const dayMs = 24 * 60 * 60 * 1000;

      const invoices: InvoiceRecord[] = [
        {
          id: 'INV-1',
          organizationId: 'org-1',
          bookingId: 'BK-1',
          clientId: 'cl-1',
          clientName: 'Alice',
          clientPhone: '0801',
          date: new Date(baseMs - 3 * dayMs).toISOString(), // 3 days old (0-7)
          dueDate: new Date(baseMs + 4 * dayMs).toISOString(),
          subtotalNetKobo: 100_000_00,
          totalVatKobo: 0,
          totalGrossKobo: 100_000_00,
          amountPaidKobo: 0,
          balanceKobo: 100_000_00,
          status: 'issued',
          isVoid: false,
          lineItems: [],
          creditNotes: [],
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'INV-2',
          organizationId: 'org-1',
          bookingId: 'BK-2',
          clientId: 'cl-2',
          clientName: 'Bob',
          clientPhone: '0802',
          date: new Date(baseMs - 14 * dayMs).toISOString(), // 14 days old (8-30)
          dueDate: new Date(baseMs - 7 * dayMs).toISOString(),
          subtotalNetKobo: 250_000_00,
          totalVatKobo: 0,
          totalGrossKobo: 250_000_00,
          amountPaidKobo: 50_000_00,
          balanceKobo: 200_000_00,
          status: 'part_paid',
          isVoid: false,
          lineItems: [],
          creditNotes: [],
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'INV-3',
          organizationId: 'org-1',
          bookingId: 'BK-3',
          clientId: 'cl-3',
          clientName: 'Charlie',
          clientPhone: '0803',
          date: new Date(baseMs - 45 * dayMs).toISOString(), // 45 days old (>30)
          dueDate: new Date(baseMs - 38 * dayMs).toISOString(),
          subtotalNetKobo: 500_000_00,
          totalVatKobo: 0,
          totalGrossKobo: 500_000_00,
          amountPaidKobo: 0,
          balanceKobo: 500_000_00,
          status: 'issued',
          isVoid: false,
          lineItems: [],
          creditNotes: [],
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'INV-4', // Fully paid - should not appear in buckets
          organizationId: 'org-1',
          bookingId: 'BK-4',
          clientId: 'cl-4',
          clientName: 'David',
          clientPhone: '0804',
          date: new Date(baseMs - 10 * dayMs).toISOString(),
          dueDate: new Date(baseMs - 3 * dayMs).toISOString(),
          subtotalNetKobo: 300_000_00,
          totalVatKobo: 0,
          totalGrossKobo: 300_000_00,
          amountPaidKobo: 300_000_00,
          balanceKobo: 0,
          status: 'paid',
          isVoid: false,
          lineItems: [],
          creditNotes: [],
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'INV-5', // Voided - should not appear
          organizationId: 'org-1',
          bookingId: 'BK-5',
          clientId: 'cl-5',
          clientName: 'Eve',
          clientPhone: '0805',
          date: new Date(baseMs - 5 * dayMs).toISOString(),
          dueDate: new Date(baseMs + 2 * dayMs).toISOString(),
          subtotalNetKobo: 400_000_00,
          totalVatKobo: 0,
          totalGrossKobo: 400_000_00,
          amountPaidKobo: 0,
          balanceKobo: 400_000_00,
          status: 'void',
          isVoid: true,
          lineItems: [],
          creditNotes: [],
          createdAt: '',
          updatedAt: '',
        },
      ];

      const aging = categorizeOutstandingInvoices(invoices, baseMs);
      expect(aging.bucket0to7.map((i) => i.id)).toEqual(['INV-1']);
      expect(aging.bucket8to30.map((i) => i.id)).toEqual(['INV-2']);
      expect(aging.bucketOver30.map((i) => i.id)).toEqual(['INV-3']);
      expect(aging.totalOutstandingKobo).toBe(800_000_00); // 100k + 200k + 500k
    });
  });
});

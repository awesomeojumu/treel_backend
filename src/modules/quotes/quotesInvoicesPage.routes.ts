import { FastifyInstance } from 'fastify';
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
  QuoteRecord,
  InvoiceRecord,
  PaymentReceipt,
  QuoteLineItem,
  PaymentMethodType,
} from '@/core/quotes/quotesInvoicesPageRules';

// In-memory persistent demo store for Quotes & Invoices
let nextInvoiceSeq = 105;
let nextReceiptSeq = 816;

const INITIAL_QUOTES: QuoteRecord[] = [
  {
    id: 'QT-2026-0042',
    version: 1,
    organizationId: 'org-lagos-01',
    clientId: 'CL-2026-0001',
    clientName: 'Dr. Babatunde Adeleke',
    clientPhone: '+2348031234567',
    clientEmail: 'babatunde.adeleke@example.com',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    validUntilDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days left
    travellersCount: 2,
    lineItems: [
      {
        id: 'li-1',
        type: 'flight',
        description: 'Lagos to London Return Economy (Virgin Atlantic)',
        quantity: 2,
        unitPriceKobo: 1_250_000_00,
        supplierCostKobo: 1_100_000_00,
        supplierName: 'Virgin Atlantic Direct',
        vatApplies: false,
      },
      {
        id: 'li-2',
        type: 'hotel',
        description: '4 Nights Central London 4-Star Hotel',
        quantity: 1,
        unitPriceKobo: 600_000_00,
        supplierCostKobo: 480_000_00,
        supplierName: 'Hotelbeds',
        vatApplies: true,
      },
      {
        id: 'li-3',
        type: 'transfer',
        description: 'Heathrow Airport Executive Chauffeur',
        quantity: 1,
        unitPriceKobo: 0,
        supplierCostKobo: 45_000_00,
        supplierName: 'London Chauffeurs Ltd',
        vatApplies: false,
        inclusionNote: 'Complimentary VIP Meet & Greet included',
      },
    ],
    discountKobo: 50_000_00,
    subtotalNetKobo: 3_100_000_00,
    totalVatKobo: 45_000_00,
    totalGrossKobo: 3_095_000_00,
    supplierCostTotalKobo: 2_725_000_00,
    marginKobo: 325_000_00,
    marginPercent: 10.7,
    notes: 'Passenger names must correspond with valid international passports.',
    terms: 'Tickets are non-refundable once issued. Hotel cancellation permitted up to 48 hours prior.',
    paymentDetails: 'Planexi Travels Ltd - Zenith Bank - 1012345678',
    status: 'sent',
    requiresDiscountApproval: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdByStaffId: 'usr_chioma',
    createdByStaffName: 'Chioma Okeke',
  },
  {
    id: 'QT-2026-0043',
    version: 1,
    organizationId: 'org-lagos-01',
    clientId: 'CL-2026-0002',
    clientName: 'Alhaji Ibrahim Abdullahi',
    clientPhone: '0803 123 4567',
    clientEmail: 'ibrahim.abdullahi@kano.ng',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    validUntilDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // Expired
    travellersCount: 5,
    lineItems: [
      {
        id: 'li-4',
        type: 'flight',
        description: 'Kano to Jeddah Group Return Flights',
        quantity: 5,
        unitPriceKobo: 950_000_00,
        supplierCostKobo: 870_000_00,
        supplierName: 'Saudia Direct',
        vatApplies: false,
      },
    ],
    discountKobo: 0,
    subtotalNetKobo: 4_750_000_00,
    totalVatKobo: 0,
    totalGrossKobo: 4_750_000_00,
    supplierCostTotalKobo: 4_350_000_00,
    marginKobo: 400_000_00,
    marginPercent: 8.4,
    notes: 'Group Umrah package including ground support.',
    terms: 'Valid for 7 days from issue date. Subject to seat availability.',
    paymentDetails: 'Planexi Travels Ltd - Stanbic IBTC - 0023456789',
    status: 'expired',
    requiresDiscountApproval: false,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    createdByStaffId: 'usr_bisi',
    createdByStaffName: 'Bisi Adeyemi',
  },
];

const INITIAL_INVOICES: InvoiceRecord[] = [
  {
    id: 'INV-2026-0101',
    organizationId: 'org-lagos-01',
    quoteId: 'QT-2026-0038',
    bookingId: 'BK-2026-038',
    clientId: 'CL-2026-0003',
    clientName: 'Folake Adeleke',
    clientPhone: '+2348052233445',
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days old (0-7 days bucket)
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    subtotalNetKobo: 1_850_000_00,
    totalVatKobo: 37_500_00,
    totalGrossKobo: 1_887_500_00,
    amountPaidKobo: 0,
    balanceKobo: 1_887_500_00,
    status: 'issued',
    isVoid: false,
    lineItems: [
      {
        id: 'li-5',
        type: 'flight',
        description: 'Lagos to Nairobi Business Class Return',
        quantity: 1,
        unitPriceKobo: 1_350_000_00,
        supplierCostKobo: 1_200_000_00,
        supplierName: 'Kenya Airways',
        vatApplies: false,
      },
      {
        id: 'li-6',
        type: 'hotel',
        description: 'Nairobi Serena Hotel 3 Nights',
        quantity: 1,
        unitPriceKobo: 500_000_00,
        supplierCostKobo: 400_000_00,
        supplierName: 'Serena Hotels',
        vatApplies: true,
      },
    ],
    creditNotes: [],
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'INV-2026-0102',
    organizationId: 'org-lagos-01',
    bookingId: 'BK-2026-030',
    clientId: 'CL-2026-0004',
    clientName: 'Michael Okon (TotalEnergies)',
    clientPhone: '+234 803 111 2222',
    date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), // 18 days old (8-30 days bucket)
    dueDate: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    subtotalNetKobo: 3_800_000_00,
    totalVatKobo: 0,
    totalGrossKobo: 3_800_000_00,
    amountPaidKobo: 1_500_000_00,
    balanceKobo: 2_300_000_00,
    status: 'part_paid',
    isVoid: false,
    lineItems: [],
    creditNotes: [],
    createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'INV-2026-0103',
    organizationId: 'org-lagos-01',
    bookingId: 'BK-2026-021',
    clientId: 'CL-2026-0005',
    clientName: 'Chief Emeka Okafor',
    clientPhone: '+2348029876543',
    date: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(), // 38 days old (>30 days bucket)
    dueDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    subtotalNetKobo: 2_200_000_00,
    totalVatKobo: 0,
    totalGrossKobo: 2_200_000_00,
    amountPaidKobo: 0,
    balanceKobo: 2_200_000_00,
    status: 'issued',
    isVoid: false,
    lineItems: [],
    creditNotes: [],
    createdAt: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_RECEIPTS: PaymentReceipt[] = [
  {
    id: 'RCT-2026-0815',
    organizationId: 'org-lagos-01',
    invoiceId: 'INV-2026-0102',
    bookingId: 'BK-2026-030',
    amountKobo: 1_500_000_00,
    balanceAfterPaymentKobo: 2_300_000_00,
    payerName: 'Michael Okon',
    method: 'transfer',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    reference: 'NIP-20261023-998822',
    isOverpayment: false,
    isCashOverLimit: false,
    isReprintCopy: false,
    recordedByStaffName: 'Chioma Okeke',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

let quotesDb = [...INITIAL_QUOTES];
let invoicesDb = [...INITIAL_INVOICES];
let receiptsDb = [...INITIAL_RECEIPTS];
const shareAuditLogs: Array<{
  id: string;
  quoteId: string;
  channel: 'whatsapp' | 'email' | 'link';
  recipient: string;
  sharedByStaffName: string;
  sharedAt: string;
}> = [];

const reminderAuditLogs: Array<{
  id: string;
  invoiceId: string;
  channel: 'whatsapp' | 'call' | 'email';
  templateUsed: string;
  recipientPhone: string;
  sentByStaffName: string;
  sentAt: string;
}> = [];

export async function registerQuotesInvoicesPageRoutes(app: FastifyInstance): Promise<void> {
  // 1. Rules Catalog
  app.get('/api/v1/quotes/rules', async () => {
    return {
      success: true,
      rules: listQuotesInvoicesPageRules(),
    };
  });

  // 2. List Quotes
  app.get<{
    Querystring: {
      search?: string;
      status?: string;
      userRole?: string;
    };
  }>('/api/v1/quotes', async (req) => {
    const { search, status, userRole = 'SALES_AGENT' } = req.query;
    const isCommercialRole =
      userRole === 'OWNER' || userRole === 'OPERATIONS_MANAGER' || userRole === 'FINANCE_OFFICER';

    let filtered = quotesDb.map((q) => {
      // Automatic expiration check
      if (q.status !== 'accepted' && isQuoteExpired(q)) {
        return { ...q, status: 'expired' as const };
      }
      return q;
    });

    if (status && status !== 'all') {
      filtered = filtered.filter((q) => q.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.id.toLowerCase().includes(q) ||
          item.clientName.toLowerCase().includes(q) ||
          item.clientPhone.includes(q)
      );
    }

    // Role-based margin restriction
    const results = filtered.map((quote) => {
      if (!isCommercialRole) {
        // Strip supplier costs and margin for non-permitted roles
        const sanitized = { ...quote };
        delete (sanitized as any).supplierCostTotalKobo;
        delete (sanitized as any).marginKobo;
        delete (sanitized as any).marginPercent;
        sanitized.lineItems = sanitized.lineItems.map((li) => {
          const itemCopy = { ...li };
          delete (itemCopy as any).supplierCostKobo;
          delete (itemCopy as any).supplierName;
          return itemCopy;
        });
        return sanitized;
      }
      return quote;
    });

    return {
      success: true,
      count: results.length,
      quotes: results,
    };
  });

  // 3. Create Quote (Draft)
  app.post<{
    Body: {
      clientId: string;
      clientName: string;
      clientPhone: string;
      clientEmail?: string;
      validityDays?: number;
      travellersCount: number;
      lineItems: QuoteLineItem[];
      discountKobo?: number;
      notes?: string;
      terms?: string;
      paymentDetails?: string;
      staffId: string;
      staffName: string;
      staffRole?: string;
    };
  }>('/api/v1/quotes', async (req, reply) => {
    const body = req.body;

    const validation = validateQuoteLineItems(body.lineItems);
    if (!validation.valid) {
      return reply.code(400).send({
        success: false,
        error: validation.errors.join(' '),
      });
    }

    const totals = calculateQuoteTotals(body.lineItems, body.discountKobo || 0);

    const approvalCheck = checkDiscountApprovalRequirement(
      totals.discountKobo,
      totals.subtotalNetKobo,
      body.staffRole || 'SALES_AGENT'
    );

    const now = new Date();
    const validityDays = body.validityDays || 7;
    const validUntil = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString();

    const quoteId = `QT-${now.getFullYear()}-${String(quotesDb.length + 42).padStart(4, '0')}`;

    const newQuote: QuoteRecord = {
      id: quoteId,
      version: 1,
      organizationId: 'org-lagos-01',
      clientId: body.clientId,
      clientName: body.clientName,
      clientPhone: body.clientPhone,
      clientEmail: body.clientEmail,
      date: now.toISOString(),
      validUntilDate: validUntil,
      travellersCount: body.travellersCount || 1,
      lineItems: body.lineItems,
      discountKobo: totals.discountKobo,
      subtotalNetKobo: totals.subtotalNetKobo,
      totalVatKobo: totals.totalVatKobo,
      totalGrossKobo: totals.totalGrossKobo,
      supplierCostTotalKobo: totals.supplierCostTotalKobo,
      marginKobo: totals.marginKobo,
      marginPercent: totals.marginPercent,
      notes: body.notes,
      terms:
        body.terms ||
        'Standard booking terms apply. Quotes valid for 7 days unless specified otherwise.',
      paymentDetails:
        body.paymentDetails || 'Planexi Travels Ltd - Zenith Bank - 1012345678',
      status: approvalCheck.requiresApproval ? 'pending_approval' : 'draft',
      requiresDiscountApproval: approvalCheck.requiresApproval,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdByStaffId: body.staffId,
      createdByStaffName: body.staffName,
    };

    quotesDb.unshift(newQuote);

    return reply.code(201).send({
      success: true,
      quote: newQuote,
      requiresApproval: approvalCheck.requiresApproval,
      approvalReason: approvalCheck.reason,
    });
  });

  // 4. Update Quote (Autosave draft or fork version if sent)
  app.put<{
    Params: { id: string };
    Body: {
      lineItems?: QuoteLineItem[];
      discountKobo?: number;
      travellersCount?: number;
      notes?: string;
      terms?: string;
      staffId: string;
      staffName: string;
      staffRole?: string;
    };
  }>('/api/v1/quotes/:id', async (req, reply) => {
    const existing = quotesDb.find((q) => q.id === req.params.id);
    if (!existing) {
      return reply.code(404).send({ success: false, error: 'Quote not found.' });
    }

    if (existing.status === 'accepted') {
      return reply.code(400).send({
        success: false,
        error: 'Accepted quotes are locked and cannot be modified.',
      });
    }

    const lineItems = req.body.lineItems || existing.lineItems;
    const discountKobo = req.body.discountKobo ?? existing.discountKobo;
    const totals = calculateQuoteTotals(lineItems, discountKobo);

    const now = new Date().toISOString();

    // Spec 6: Editing a sent quote creates a new version and keeps the old one!
    if (existing.status === 'sent') {
      const newVersionId = `${existing.id}-V${existing.version + 1}`;
      const forkedQuote: QuoteRecord = {
        ...existing,
        id: newVersionId,
        version: existing.version + 1,
        previousVersionId: existing.id,
        lineItems,
        discountKobo: totals.discountKobo,
        subtotalNetKobo: totals.subtotalNetKobo,
        totalVatKobo: totals.totalVatKobo,
        totalGrossKobo: totals.totalGrossKobo,
        supplierCostTotalKobo: totals.supplierCostTotalKobo,
        marginKobo: totals.marginKobo,
        marginPercent: totals.marginPercent,
        notes: req.body.notes ?? existing.notes,
        terms: req.body.terms ?? existing.terms,
        status: 'draft',
        updatedAt: now,
      };

      quotesDb.unshift(forkedQuote);
      return {
        success: true,
        isNewVersion: true,
        quote: forkedQuote,
      };
    }

    // Draft autosave in place
    existing.lineItems = lineItems;
    existing.discountKobo = totals.discountKobo;
    existing.subtotalNetKobo = totals.subtotalNetKobo;
    existing.totalVatKobo = totals.totalVatKobo;
    existing.totalGrossKobo = totals.totalGrossKobo;
    existing.supplierCostTotalKobo = totals.supplierCostTotalKobo;
    existing.marginKobo = totals.marginKobo;
    existing.marginPercent = totals.marginPercent;
    if (req.body.notes !== undefined) existing.notes = req.body.notes;
    if (req.body.terms !== undefined) existing.terms = req.body.terms;
    if (req.body.travellersCount !== undefined)
      existing.travellersCount = req.body.travellersCount;
    existing.updatedAt = now;

    return {
      success: true,
      isNewVersion: false,
      quote: existing,
    };
  });

  // 5. Send Quote
  app.post<{
    Params: { id: string };
    Body: { staffRole?: string };
  }>('/api/v1/quotes/:id/send', async (req, reply) => {
    const existing = quotesDb.find((q) => q.id === req.params.id);
    if (!existing) {
      return reply.code(404).send({ success: false, error: 'Quote not found.' });
    }

    if (isQuoteExpired(existing)) {
      existing.status = 'expired';
      return reply.code(400).send({
        success: false,
        error: 'This quote has expired and cannot be sent without renewal.',
      });
    }

    if (existing.requiresDiscountApproval) {
      return reply.code(400).send({
        success: false,
        error: 'Quote discount exceeds staff allowance and requires manager approval before sending.',
      });
    }

    existing.status = 'sent';
    existing.updatedAt = new Date().toISOString();

    return {
      success: true,
      message: 'Quote marked as sent to customer.',
      quote: existing,
    };
  });

  // 6. Client Sanitized View for Customer PDF & Web Link
  app.get<{ Params: { id: string } }>('/api/v1/quotes/:id/client-view', async (req, reply) => {
    const existing = quotesDb.find((q) => q.id === req.params.id);
    if (!existing) {
      return reply.code(404).send({ success: false, error: 'Quote not found.' });
    }

    const sanitized = sanitizeQuoteForClient(existing);
    return {
      success: true,
      quote: sanitized,
      agencyDetails: {
        name: 'Planexi Travels Ltd',
        rcNumber: 'RC 1892341',
        tin: 'TIN 24892301-0001',
        phone: '+234 1 234 5678',
        email: 'reservations@planexitravels.ng',
        address: '14B Admiralty Way, Lekki Phase 1, Lagos, Nigeria',
      },
    };
  });

  // 7. Share Quote via WhatsApp/Email & Log
  app.post<{
    Params: { id: string };
    Body: {
      channel: 'whatsapp' | 'email' | 'link';
      recipient: string;
      staffName: string;
    };
  }>('/api/v1/quotes/:id/share', async (req, reply) => {
    const existing = quotesDb.find((q) => q.id === req.params.id);
    if (!existing) {
      return reply.code(404).send({ success: false, error: 'Quote not found.' });
    }

    const logId = `SHR-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();
    shareAuditLogs.push({
      id: logId,
      quoteId: existing.id,
      channel: req.body.channel,
      recipient: req.body.recipient,
      sharedByStaffName: req.body.staffName,
      sharedAt: now,
    });

    const shareUrl = `https://travelreel.app/q/${existing.id}?exp=${Date.now() + 7 * 24 * 60 * 60 * 1000}`;
    const nairaAmount = (existing.totalGrossKobo / 100).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
    });

    let messageText = '';
    if (req.body.channel === 'whatsapp') {
      messageText = `Hello ${existing.clientName}, here is your travel quote ${existing.id} from Planexi Travels for ₦${nairaAmount}. View quote details: ${shareUrl}`;
    }

    return {
      success: true,
      logId,
      shareUrl,
      messageText,
      channel: req.body.channel,
      loggedAt: now,
    };
  });

  // 8. Accept Quote: Converts to Booking & Sequential Invoice
  app.post<{ Params: { id: string } }>('/api/v1/quotes/:id/accept', async (req, reply) => {
    const existing = quotesDb.find((q) => q.id === req.params.id);
    if (!existing) {
      return reply.code(404).send({ success: false, error: 'Quote not found.' });
    }

    if (existing.status === 'accepted') {
      return reply.code(400).send({
        success: false,
        error: 'This quote has already been accepted.',
      });
    }

    if (isQuoteExpired(existing)) {
      existing.status = 'expired';
      return reply.code(400).send({
        success: false,
        error: 'Cannot accept an expired quote. Please renew quote validity first.',
      });
    }

    const conversion = acceptQuoteAndGenerateInvoice(existing, nextInvoiceSeq++);
    // Update local store
    const quoteIdx = quotesDb.findIndex((q) => q.id === existing.id);
    quotesDb[quoteIdx] = conversion.updatedQuote;
    invoicesDb.unshift(conversion.invoice);

    return {
      success: true,
      message: 'Quote converted to booking and issued invoice successfully.',
      quote: conversion.updatedQuote,
      bookingId: conversion.bookingId,
      invoice: conversion.invoice,
    };
  });

  // 9. List Invoices
  app.get<{
    Querystring: {
      search?: string;
      status?: string;
    };
  }>('/api/v1/invoices', async (req) => {
    const { search, status } = req.query;
    let list = [...invoicesDb];

    if (status && status !== 'all') {
      list = list.filter((i) => i.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.clientName.toLowerCase().includes(q) ||
          i.bookingId.toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      count: list.length,
      invoices: list,
    };
  });

  // 10. Void Invoice
  app.post<{
    Params: { id: string };
    Body: { reason: string };
  }>('/api/v1/invoices/:id/void', async (req, reply) => {
    const invoice = invoicesDb.find((i) => i.id === req.params.id);
    if (!invoice) {
      return reply.code(404).send({ success: false, error: 'Invoice not found.' });
    }

    const result = voidInvoice(invoice, req.body.reason);
    if (!result.success) {
      return reply.code(400).send(result);
    }

    const idx = invoicesDb.findIndex((i) => i.id === invoice.id);
    invoicesDb[idx] = result.voidedInvoice!;

    return {
      success: true,
      message: 'Invoice voided successfully. Sequence number preserved with Void status.',
      invoice: result.voidedInvoice,
    };
  });

  // 11. Issue Credit Note
  app.post<{
    Params: { id: string };
    Body: { amountKobo: number; reason: string };
  }>('/api/v1/invoices/:id/credit-note', async (req, reply) => {
    const invoice = invoicesDb.find((i) => i.id === req.params.id);
    if (!invoice) {
      return reply.code(404).send({ success: false, error: 'Invoice not found.' });
    }

    const result = issueCreditNote(invoice, req.body.amountKobo, req.body.reason);
    if (!result.success) {
      return reply.code(400).send(result);
    }

    const idx = invoicesDb.findIndex((i) => i.id === invoice.id);
    invoicesDb[idx] = result.updatedInvoice!;

    return {
      success: true,
      message: 'Credit note issued and deducted from invoice balance.',
      invoice: result.updatedInvoice,
    };
  });

  // 12. Record Payment
  app.post<{
    Params: { id: string };
    Body: {
      amountKobo: number;
      method: PaymentMethodType;
      date: string;
      payerName: string;
      reference?: string;
      proofUrl?: string;
      isOverpaymentAllowed?: boolean;
      staffName: string;
    };
  }>('/api/v1/invoices/:id/payments', async (req, reply) => {
    const invoice = invoicesDb.find((i) => i.id === req.params.id);
    if (!invoice) {
      return reply.code(404).send({ success: false, error: 'Invoice not found.' });
    }

    if (invoice.isVoid) {
      return reply.code(400).send({
        success: false,
        error: 'Cannot record payment against a voided invoice.',
      });
    }

    const result = recordInvoicePayment(
      invoice,
      req.body,
      nextReceiptSeq++
    );

    if (!result.success) {
      return reply.code(400).send(result);
    }

    const idx = invoicesDb.findIndex((i) => i.id === invoice.id);
    invoicesDb[idx] = result.updatedInvoice!;
    receiptsDb.unshift(result.receipt!);

    return {
      success: true,
      message: 'Payment recorded successfully.',
      invoice: result.updatedInvoice,
      receipt: result.receipt,
    };
  });

  // 13. Outstanding Aging Buckets
  app.get('/api/v1/invoices/outstanding', async () => {
    const aging = categorizeOutstandingInvoices(invoicesDb);
    return {
      success: true,
      ...aging,
    };
  });

  // 14. Send Reminder / Log Dunning Notice
  app.post<{
    Params: { id: string };
    Body: {
      channel: 'whatsapp' | 'call' | 'email';
      templateType: 'friendly' | 'firm' | 'final_notice';
      customMessage?: string;
      staffName: string;
    };
  }>('/api/v1/invoices/:id/remind', async (req, reply) => {
    const invoice = invoicesDb.find((i) => i.id === req.params.id);
    if (!invoice) {
      return reply.code(404).send({ success: false, error: 'Invoice not found.' });
    }

    const nairaBal = (invoice.balanceKobo / 100).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
    });

    let message = req.body.customMessage;
    if (!message) {
      if (req.body.templateType === 'friendly') {
        message = `Good day ${invoice.clientName}, this is a gentle reminder from Planexi Travels regarding invoice ${invoice.id} with an outstanding balance of ₦${nairaBal}. Please let us know if you need any assistance with settlement.`;
      } else if (req.body.templateType === 'firm') {
        message = `Dear ${invoice.clientName}, please be informed that invoice ${invoice.id} (Balance: ₦${nairaBal}) is overdue. We kindly request prompt settlement to keep your travel reservations active.`;
      } else {
        message = `FINAL NOTICE: ${invoice.clientName}, urgent payment of ₦${nairaBal} for invoice ${invoice.id} is required today to prevent cancellation of booked itinerary.`;
      }
    }

    const logId = `REM-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();
    reminderAuditLogs.push({
      id: logId,
      invoiceId: invoice.id,
      channel: req.body.channel,
      templateUsed: req.body.templateType,
      recipientPhone: invoice.clientPhone,
      sentByStaffName: req.body.staffName,
      sentAt: now,
    });

    return {
      success: true,
      logId,
      message,
      channel: req.body.channel,
      sentAt: now,
    };
  });
}

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

const INITIAL_QUOTES: QuoteRecord[] = [];

const INITIAL_INVOICES: InvoiceRecord[] = [];

const INITIAL_RECEIPTS: PaymentReceipt[] = [];

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
        body.paymentDetails || 'Main Settlement Account',
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
        email: 'reservations@agency.ng',
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

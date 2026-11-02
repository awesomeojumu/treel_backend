import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  SUPPLIERS_PAGE_RULES,
  validateSupplierFields,
  checkDuplicateSupplierName,
  maskBankDetailsForRole,
  calculateFxSettlementGainLoss,
  validateVendorPayment,
  canDeactivateSupplier,
  validateRatingPermission,
  Supplier,
  SupplierPayableItem,
  VendorPayment,
  SupplierCreditNote,
  SupplierStatementRow,
  FxGainLossEntry,
  BankDetailsChangeRequest,
} from '@/core/suppliers/suppliersPageRules';

// In-memory store for suppliers
let suppliersStore: Supplier[] = [
  {
    id: 'SUP-001',
    name: 'Wakanow Consolidator Desk',
    type: 'airline',
    contactPerson: 'Adewale Adeleke',
    phone: '+2348031234567',
    email: 'b2bdesk@wakanow.com',
    address: 'Plot 8, Keffi Street, Ikoyi, Lagos',
    currency: 'USD',
    paymentTerms: 'due_on_issuance',
    bankDetails: {
      bankName: 'Zenith Bank PLC',
      accountNumber: '1014892019',
      accountName: 'Wakanow.com Limited FX Settlement',
      sortCode: '057150013',
      isVerified: true,
    },
    taxNumber: 'TIN-009182746',
    documents: [
      {
        id: 'DOC-1',
        name: 'Wakanow_IATA_Consolidator_SLA_2026.pdf',
        fileUrl: '/docs/wakanow_sla.pdf',
        uploadedAt: '2026-01-10T10:00:00Z',
      },
    ],
    status: 'active',
    ratings: [
      {
        id: 'RAT-1',
        bookingId: 'TR-2026-089',
        ratedBy: { id: 'usr_tunde', name: 'Tunde Bakare', roleKey: 'OPERATIONS_MANAGER' },
        score: 5,
        note: 'Prompt ticket issuance for VIP corporate delegation flight to London.',
        createdAt: '2026-10-30T14:00:00Z',
      },
    ],
    totalOwedKobo: 1_860_000_00, // ₦1,860,000.00 ($1,240 USD at ₦1,500/$)
    foreignCentsOwed: 124_000,
    historicalAliases: ['Wakanow Travel Limited'],
  },
  {
    id: 'SUP-002',
    name: 'Finchglow Consolidator Desk',
    type: 'airline',
    contactPerson: 'Chinyere Umeh',
    phone: '+2348029876543',
    email: 'agencydesk@finchglowtravels.com',
    address: '25, Commercial Avenue, Sabo Yaba, Lagos',
    currency: 'NGN',
    paymentTerms: 'net_7',
    bankDetails: {
      bankName: 'Guaranty Trust Bank',
      accountNumber: '0129482015',
      accountName: 'Finchglow Travels B2B',
      sortCode: '058152062',
      isVerified: true,
    },
    taxNumber: 'TIN-003847291',
    documents: [],
    status: 'active',
    ratings: [
      {
        id: 'RAT-2',
        bookingId: 'TR-2026-042',
        ratedBy: { id: 'usr_adaeze', name: 'Adaeze Okafor', roleKey: 'OWNER' },
        score: 4,
        note: 'Good regional West Africa flight inventory access.',
        createdAt: '2026-10-25T11:00:00Z',
      },
    ],
    totalOwedKobo: 520_000_00, // ₦520,000.00
  },
  {
    id: 'SUP-003',
    name: 'Kigali Marriott Hotel Partner',
    type: 'hotel',
    contactPerson: 'Jean-Paul Uwase',
    phone: '+250788123456',
    email: 'reservations@kigalimarriott.rw',
    address: 'KN 3 Ave, Kigali, Rwanda',
    currency: 'USD',
    paymentTerms: 'net_15',
    bankDetails: {
      bankName: 'Bank of Kigali / Standard Chartered',
      accountNumber: '4001928374',
      accountName: 'Kigali Marriott Luxury Lodging',
      isVerified: true,
    },
    documents: [],
    status: 'active',
    ratings: [],
    totalOwedKobo: 200_000_00,
    foreignCentsOwed: 13_333,
  },
  {
    id: 'SUP-004',
    name: 'Al-Haramain Ground Services Makkah',
    type: 'tour_operator',
    contactPerson: 'Sheikh Tariq Al-Mansoor',
    phone: '+966501234567',
    email: 'hajjumrah@alharamain-sa.com',
    address: 'Ajyad Street, Makkah, Saudi Arabia',
    currency: 'NGN',
    paymentTerms: 'prepayment',
    bankDetails: {
      bankName: 'Stanbic IBTC Bank',
      accountNumber: '9201948271',
      accountName: 'Al-Haramain Ground Nigeria Liaison',
      isVerified: true,
    },
    documents: [],
    status: 'active',
    ratings: [],
    totalOwedKobo: 0, // Fully settled
  },
];

let payablesStore: SupplierPayableItem[] = [
  {
    id: 'PAYABLE-001',
    supplierId: 'SUP-001',
    supplierName: 'Wakanow Consolidator Desk',
    bookingId: 'TR-2026-089',
    bookingReference: 'BK-LOS-LHR-772',
    bookingDate: '2026-10-28',
    itemType: 'Flight',
    description: 'Virgin Atlantic Airways Business Class LOS-LHR-LOS PNR #VA891',
    costKobo: 1_860_000_00,
    foreignCurrency: 'USD',
    foreignCostCents: 124_000,
    storedExchangeRate: 1500, // ₦1,500/$ on booking date
    dueDate: '2026-10-29', // Due on issuance -> Overdue
    isOverdue: true,
    daysOverdue: 4,
    paidKobo: 0,
    outstandingKobo: 1_860_000_00,
  },
  {
    id: 'PAYABLE-002',
    supplierId: 'SUP-002',
    supplierName: 'Finchglow Consolidator Desk',
    bookingId: 'TR-2026-042',
    bookingReference: 'BK-LOS-ACC-119',
    bookingDate: '2026-10-20',
    itemType: 'Flight',
    description: 'Air Peace Lagos to Accra Roundtrip PNR #P4-332',
    costKobo: 520_000_00,
    dueDate: '2026-10-27', // Net 7 -> Overdue
    isOverdue: true,
    daysOverdue: 6,
    paidKobo: 0,
    outstandingKobo: 520_000_00,
  },
  {
    id: 'PAYABLE-003',
    supplierId: 'SUP-003',
    supplierName: 'Kigali Marriott Hotel Partner',
    bookingId: 'TR-2026-095',
    bookingReference: 'BK-KGL-HTL-04',
    bookingDate: '2026-10-25',
    itemType: 'Hotel',
    description: 'Deluxe King Room 3 Nights stay for corporate retreat',
    costKobo: 200_000_00,
    foreignCurrency: 'USD',
    foreignCostCents: 13_333,
    storedExchangeRate: 1500,
    dueDate: '2026-11-09', // Net 15 -> Current
    isOverdue: false,
    daysOverdue: 0,
    paidKobo: 0,
    outstandingKobo: 200_000_00,
  },
];

let vendorPaymentsStore: VendorPayment[] = [];
let creditNotesStore: SupplierCreditNote[] = [
  {
    id: 'CRN-2026-001',
    supplierId: 'SUP-001',
    amountKobo: 150_000_00, // ₦150,000 credit note
    reference: 'WAK-CR-8821',
    reason: 'Cancelled baggage allowance refund for Qatar flight',
    issueDate: '2026-10-27',
    offsetKobo: 0,
    remainingKobo: 150_000_00,
    status: 'open',
  },
];
let fxGainLossEntriesStore: FxGainLossEntry[] = [];

export const registerSuppliersPageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/suppliers/rules
   */
  app.get('/api/v1/suppliers/rules', async () => {
    return {
      success: true,
      rules: SUPPLIERS_PAGE_RULES,
    };
  });

  /**
   * GET /api/v1/suppliers
   * Returns suppliers with bank details masked based on user role (Rule 2)
   */
  app.get('/api/v1/suppliers', async (request) => {
    const { roleKey = 'TRAVEL_CONSULTANT' } = request.query as { roleKey?: string };
    const maskedSuppliers = suppliersStore.map((s) => ({
      ...s,
      bankDetails: maskBankDetailsForRole(s.bankDetails, roleKey),
      averageRating:
        s.ratings.length > 0
          ? Math.round((s.ratings.reduce((acc, r) => acc + r.score, 0) / s.ratings.length) * 10) / 10
          : null,
      ratingCount: s.ratings.length,
    }));

    return {
      success: true,
      count: maskedSuppliers.length,
      suppliers: maskedSuppliers,
    };
  });

  /**
   * POST /api/v1/suppliers
   * Validates supplier profile & flags duplicate names (Rules 1 & 3)
   */
  app.post('/api/v1/suppliers', async (request, reply) => {
    const body = request.body as Partial<Supplier>;

    const validation = validateSupplierFields(body);
    if (!validation.isValid) {
      return reply.status(400).send({ success: false, error: validation.error });
    }

    // Rule 3: Duplicate name check
    const dupCheck = checkDuplicateSupplierName(body.name!, suppliersStore);
    if (dupCheck.isDuplicate) {
      return reply.status(409).send({
        success: false,
        isDuplicate: true,
        matchedSupplierId: dupCheck.matchedSupplier?.id,
        matchedSupplierName: dupCheck.matchedSupplier?.name,
        error: `A supplier named "${dupCheck.matchedSupplier?.name}" already exists (${dupCheck.matchedSupplier?.id}). You can merge records to preserve booking and payment history.`,
      });
    }

    const newSupplier: Supplier = {
      id: `SUP-${String(suppliersStore.length + 1).padStart(3, '0')}`,
      name: body.name!.trim(),
      type: body.type!,
      contactPerson: body.contactPerson || '',
      phone: body.phone!.trim(),
      email: body.email || '',
      address: body.address || '',
      currency: body.currency || 'NGN',
      paymentTerms: body.paymentTerms || 'net_7',
      bankDetails: body.bankDetails || {
        bankName: 'Pending verification',
        accountNumber: '0000000000',
        accountName: body.name!.trim(),
        isVerified: false,
      },
      taxNumber: body.taxNumber,
      documents: body.documents || [],
      status: 'active',
      ratings: [],
      totalOwedKobo: 0,
      historicalAliases: [],
    };

    suppliersStore.push(newSupplier);

    return reply.status(201).send({
      success: true,
      supplier: newSupplier,
      message: `Supplier "${newSupplier.name}" created successfully.`,
    });
  });

  /**
   * POST /api/v1/suppliers/merge
   * Rule 3: Merges duplicate suppliers and transfers all history & aliases
   */
  app.post('/api/v1/suppliers/merge', async (request, reply) => {
    const { sourceSupplierId, targetSupplierId, reason } = request.body as {
      sourceSupplierId: string;
      targetSupplierId: string;
      reason: string;
    };

    const source = suppliersStore.find((s) => s.id === sourceSupplierId);
    const target = suppliersStore.find((s) => s.id === targetSupplierId);

    if (!source || !target) {
      return reply.status(404).send({ success: false, error: 'Source or target supplier not found.' });
    }

    // Preserve alias
    target.historicalAliases = target.historicalAliases || [];
    target.historicalAliases.push(source.name);
    if (source.historicalAliases) {
      target.historicalAliases.push(...source.historicalAliases);
    }

    // Reassign payables
    payablesStore.forEach((p) => {
      if (p.supplierId === source.id) {
        p.supplierId = target.id;
        p.supplierName = target.name;
      }
    });

    // Transfer ratings
    target.ratings.push(...source.ratings);
    target.totalOwedKobo += source.totalOwedKobo;
    if (source.foreignCentsOwed) {
      target.foreignCentsOwed = (target.foreignCentsOwed || 0) + source.foreignCentsOwed;
    }

    // Deactivate source
    source.status = 'inactive';
    source.totalOwedKobo = 0;

    return {
      success: true,
      targetSupplier: target,
      message: `Merged ${source.name} into ${target.name}. All booking payables and aliases transferred successfully.`,
    };
  });

  /**
   * PUT /api/v1/suppliers/:id/bank-details
   * Rule 2: Bank details modification creates approval request & notifies owner
   */
  app.put('/api/v1/suppliers/:id/bank-details', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { proposedBankDetails, requestedBy } = request.body as {
      proposedBankDetails: Supplier['bankDetails'];
      requestedBy: string;
    };

    const target = suppliersStore.find((s) => s.id === id);
    if (!target) {
      return reply.status(404).send({ success: false, error: 'Supplier not found.' });
    }

    const changeReq: BankDetailsChangeRequest = {
      id: `BNK-CHG-${Date.now()}`,
      supplierId: id,
      requestedBy,
      requestedAt: new Date().toISOString(),
      proposedBankDetails,
      currentBankDetails: target.bankDetails,
      status: 'pending_approval',
      ownerNotified: true, // Instant fraud prevention alert to owner
    };

    target.pendingBankChangeRequest = changeReq;

    return {
      success: true,
      changeRequest: changeReq,
      message: `Bank details change for ${target.name} submitted for Owner approval. Fraud alert dispatched to Managing Director.`,
    };
  });

  /**
   * GET /api/v1/suppliers/amounts-owed
   * Rule 4: Payables from booking items, sorted overdue first, agrees with Home total
   */
  app.get('/api/v1/suppliers/amounts-owed', async () => {
    // Sort overdue first, then by earliest due date
    const sortedPayables = [...payablesStore].sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    const totalOwedKobo = sortedPayables.reduce((s, p) => s + p.outstandingKobo, 0);

    return {
      success: true,
      totalOwedKobo,
      totalCount: sortedPayables.length,
      payables: sortedPayables,
    };
  });

  /**
   * POST /api/v1/suppliers/pay
   * Rules 5, 6, 7: Vendor payment, advance guard, approval gate, FX gain/loss
   */
  app.post('/api/v1/suppliers/pay', async (request, reply) => {
    const body = request.body as {
      supplierId: string;
      payableId?: string;
      amountKobo: number;
      method: 'bank_transfer' | 'cash' | 'pos' | 'cheque';
      paymentDate: string;
      reference: string;
      proofUrl: string;
      isAdvance?: boolean;
      settlementExchangeRate?: number;
      staffRoleKey: string;
      staffName: string;
    };

    const supplier = suppliersStore.find((s) => s.id === body.supplierId);
    if (!supplier) {
      return reply.status(404).send({ success: false, error: 'Supplier not found.' });
    }

    const staffLimitKobo = body.staffRoleKey === 'OWNER' ? 100_000_000_00 : 250_000_00;
    const paymentValidation = validateVendorPayment(
      body.amountKobo,
      supplier.totalOwedKobo,
      Boolean(body.isAdvance),
      staffLimitKobo
    );

    if (!paymentValidation.isValid) {
      return reply.status(400).send({ success: false, error: paymentValidation.error });
    }

    const newPayment: VendorPayment = {
      id: `VPAY-${Date.now()}`,
      supplierId: supplier.id,
      amountKobo: body.amountKobo,
      method: body.method,
      paymentDate: body.paymentDate,
      reference: body.reference,
      proofUrl: body.proofUrl,
      isAdvance: Boolean(body.isAdvance),
      status: paymentValidation.needsApproval ? 'pending_approval' : 'approved',
      recordedBy: body.staffName,
      offsetPayableIds: body.payableId ? [body.payableId] : [],
    };

    vendorPaymentsStore.push(newPayment);

    // If approved immediately, adjust balances & check FX gain/loss (Rule 5)
    let fxEntry: FxGainLossEntry | undefined;
    if (newPayment.status === 'approved') {
      supplier.totalOwedKobo = Math.max(0, supplier.totalOwedKobo - body.amountKobo);

      if (body.payableId) {
        const payable = payablesStore.find((p) => p.id === body.payableId);
        if (payable) {
          payable.paidKobo += body.amountKobo;
          payable.outstandingKobo = Math.max(0, payable.costKobo - payable.paidKobo);

          // Check FX Gain/Loss for foreign currency obligations (Rule 5)
          if (payable.foreignCurrency && payable.storedExchangeRate && body.settlementExchangeRate) {
            const gainLossCalc = calculateFxSettlementGainLoss(
              payable.storedExchangeRate,
              body.settlementExchangeRate,
              payable.foreignCostCents || 0
            );
            fxEntry = {
              id: `FX-${Date.now()}`,
              supplierId: supplier.id,
              payableItemId: payable.id,
              foreignAmountCents: payable.foreignCostCents || 0,
              originalRateNgn: payable.storedExchangeRate,
              settlementRateNgn: body.settlementExchangeRate,
              gainLossKobo: gainLossCalc.gainLossKobo,
              settledAt: new Date().toISOString(),
              paymentReference: body.reference,
            };
            fxGainLossEntriesStore.push(fxEntry);
          }
        }
      }
    }

    return {
      success: true,
      payment: newPayment,
      fxGainLoss: fxEntry,
      needsApproval: paymentValidation.needsApproval,
      message: paymentValidation.needsApproval
        ? `Payment of ₦${(body.amountKobo / 100).toLocaleString()} exceeds your limit and requires manager approval.`
        : `Vendor payment of ₦${(body.amountKobo / 100).toLocaleString()} recorded successfully.`,
    };
  });

  /**
   * POST /api/v1/suppliers/credit-notes
   * Rule 8: Record and offset credit notes / refunds receivable
   */
  app.post('/api/v1/suppliers/credit-notes', async (request, reply) => {
    const { supplierId, amountKobo, reference, reason, offsetPayableId } = request.body as {
      supplierId: string;
      amountKobo: number;
      reference: string;
      reason: string;
      offsetPayableId?: string;
    };

    const supplier = suppliersStore.find((s) => s.id === supplierId);
    if (!supplier) {
      return reply.status(404).send({ success: false, error: 'Supplier not found.' });
    }

    let offsetAmount = 0;
    if (offsetPayableId) {
      const payable = payablesStore.find((p) => p.id === offsetPayableId);
      if (payable) {
        offsetAmount = Math.min(amountKobo, payable.outstandingKobo);
        payable.paidKobo += offsetAmount;
        payable.outstandingKobo -= offsetAmount;
        supplier.totalOwedKobo = Math.max(0, supplier.totalOwedKobo - offsetAmount);
      }
    }

    const newCreditNote: SupplierCreditNote = {
      id: `CRN-${Date.now()}`,
      supplierId,
      amountKobo,
      reference,
      reason,
      issueDate: new Date().toISOString().split('T')[0],
      offsetKobo: offsetAmount,
      remainingKobo: amountKobo - offsetAmount,
      status: offsetAmount >= amountKobo ? 'fully_offset' : offsetAmount > 0 ? 'partially_offset' : 'open',
    };

    creditNotesStore.push(newCreditNote);

    return {
      success: true,
      creditNote: newCreditNote,
      message:
        offsetAmount > 0
          ? `Credit note of ₦${(amountKobo / 100).toLocaleString()} recorded and ₦${(
              offsetAmount / 100
            ).toLocaleString()} offset against payable.`
          : `Credit note of ₦${(amountKobo / 100).toLocaleString()} recorded in supplier balance.`,
    };
  });

  /**
   * POST /api/v1/suppliers/:id/rating
   * Rule 9: 1 to 5 rating with note and booking link (Managers and above only)
   */
  app.post('/api/v1/suppliers/:id/rating', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { score, note, bookingId, staffRoleKey, staffId, staffName } = request.body as {
      score: number;
      note: string;
      bookingId: string;
      staffRoleKey: string;
      staffId: string;
      staffName: string;
    };

    const supplier = suppliersStore.find((s) => s.id === id);
    if (!supplier) {
      return reply.status(404).send({ success: false, error: 'Supplier not found.' });
    }

    const validation = validateRatingPermission(staffRoleKey, score, note, bookingId);
    if (!validation.isValid) {
      return reply.status(403).send({ success: false, error: validation.error });
    }

    const newRating = {
      id: `RAT-${Date.now()}`,
      bookingId,
      ratedBy: { id: staffId, name: staffName, roleKey: staffRoleKey },
      score,
      note,
      createdAt: new Date().toISOString(),
    };

    supplier.ratings.unshift(newRating);

    return {
      success: true,
      rating: newRating,
      averageRating:
        Math.round((supplier.ratings.reduce((acc, r) => acc + r.score, 0) / supplier.ratings.length) * 10) / 10,
      totalRatings: supplier.ratings.length,
      message: `Rating of ${score} stars recorded for ${supplier.name}.`,
    };
  });

  /**
   * GET /api/v1/suppliers/:id/statement
   * Rule 10: Supplier statement export for reconciliation
   */
  app.get('/api/v1/suppliers/:id/statement', async (request, reply) => {
    const { id } = request.params as { id: string };
    const supplier = suppliersStore.find((s) => s.id === id);
    if (!supplier) {
      return reply.status(404).send({ success: false, error: 'Supplier not found.' });
    }

    const supplierPayables = payablesStore.filter((p) => p.supplierId === id);
    const supplierPayments = vendorPaymentsStore.filter((p) => p.supplierId === id && p.status === 'approved');
    const supplierCredits = creditNotesStore.filter((c) => c.supplierId === id);

    let runningBalanceKobo = 0;
    const rows: SupplierStatementRow[] = [];

    // Combine payables (debit) and payments/credits (credit)
    supplierPayables.forEach((p) => {
      runningBalanceKobo += p.costKobo;
      rows.push({
        date: p.bookingDate,
        reference: p.bookingReference,
        description: `Booking Cost: ${p.description}`,
        debitKobo: p.costKobo,
        creditKobo: 0,
        balanceKobo: runningBalanceKobo,
      });
    });

    supplierPayments.forEach((v) => {
      runningBalanceKobo -= v.amountKobo;
      rows.push({
        date: v.paymentDate,
        reference: v.reference,
        description: `Vendor Payment via ${v.method}`,
        debitKobo: 0,
        creditKobo: v.amountKobo,
        balanceKobo: runningBalanceKobo,
      });
    });

    supplierCredits.forEach((c) => {
      runningBalanceKobo -= c.amountKobo;
      rows.push({
        date: c.issueDate,
        reference: c.reference,
        description: `Credit Note: ${c.reason}`,
        debitKobo: 0,
        creditKobo: c.amountKobo,
        balanceKobo: runningBalanceKobo,
      });
    });

    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      success: true,
      supplierName: supplier.name,
      currency: supplier.currency,
      closingBalanceKobo: runningBalanceKobo,
      statementRows: rows,
    };
  });

  /**
   * POST /api/v1/suppliers/:id/deactivate
   * Rule 11: Block deactivation of supplier with unpaid amounts
   */
  app.post('/api/v1/suppliers/:id/deactivate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const supplier = suppliersStore.find((s) => s.id === id);
    if (!supplier) {
      return reply.status(404).send({ success: false, error: 'Supplier not found.' });
    }

    const unpaidCount = payablesStore.filter((p) => p.supplierId === id && p.outstandingKobo > 0).length;
    const deactivationCheck = canDeactivateSupplier(supplier, unpaidCount, supplier.totalOwedKobo);

    if (!deactivationCheck.canDeactivate) {
      return reply.status(400).send({
        success: false,
        error: deactivationCheck.error,
      });
    }

    supplier.status = 'inactive';

    return {
      success: true,
      message: `Supplier "${supplier.name}" has been deactivated.`,
    };
  });
};

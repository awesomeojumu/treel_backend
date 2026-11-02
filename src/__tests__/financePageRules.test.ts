import {
  listFinancePageRules,
  validatePaymentProofRequirement,
  checkDuplicatePayment,
  validatePaymentAgainstBooking,
  reversePaymentEntry,
  closeAccountingDay,
  reopenAccountingDay,
  processExpenseCreation,
  matchBankStatementLine,
  computeCommercialProfit,
  transferBetweenAccounts,
  FinancePaymentEntry,
  DayCloseRecord,
  FinancialAccount,
  BankStatementLine,
} from '../core/finance/financePageRules';

describe('Finance Specification Engine (financePageRules)', () => {
  const samplePayment: FinancePaymentEntry = {
    id: 'PAY-2026-0812',
    organizationId: 'org-lagos-01',
    date: '2026-11-01T10:00:00Z',
    accountingDayDate: '2026-11-01',
    amountKobo: 1_500_000_00, // ₦1,500,000
    method: 'transfer',
    accountId: 'acc-zenith-01',
    accountName: 'Zenith Bank Operations (1012345678)',
    payerName: 'Dr. Babatunde Adeleke',
    bookingId: 'BK-2026-0042',
    reference: 'NIP-20261101-998811',
    proofUrl: 'https://cdn.travelreel.ng/proofs/nip-998811.pdf',
    receivedByStaffId: 'usr_chioma',
    receivedByStaffName: 'Chioma Okeke',
    branchId: 'br-vi',
    isOverpayment: false,
    isReversed: false,
    isReconciled: false,
    createdAt: '2026-11-01T10:00:00Z',
  };

  test('Rule catalog: lists exactly 26 compliant specifications', () => {
    const rules = listFinancePageRules();
    expect(rules).toHaveLength(26);
    for (const rule of rules) {
      expect(rule.isCompliant).toBe(true);
      expect(rule.requirement).toBeTruthy();
    }
  });

  describe('Payment Proof Requirements (Rule 2)', () => {
    test('requires proof for bank transfer, POS, and cheque', () => {
      const transferNoProof = validatePaymentProofRequirement('transfer', '');
      expect(transferNoProof.valid).toBe(false);
      expect(transferNoProof.error).toMatch(/requires an attached payment proof/i);

      const transferWithProof = validatePaymentProofRequirement(
        'transfer',
        'https://cdn.travelreel.ng/proof.pdf'
      );
      expect(transferWithProof.valid).toBe(true);
    });

    test('requires receipt number for cash payments', () => {
      const cashNoReceipt = validatePaymentProofRequirement('cash', undefined, '');
      expect(cashNoReceipt.valid).toBe(false);
      expect(cashNoReceipt.error).toMatch(/Cash payments require a valid receipt number/i);

      const cashWithReceipt = validatePaymentProofRequirement(
        'cash',
        undefined,
        'RCT-2026-0199'
      );
      expect(cashWithReceipt.valid).toBe(true);
    });
  });

  describe('Duplicate Reference & Amount Detection (Rule 3)', () => {
    test('rejects payment with duplicate reference and amount', () => {
      const check = checkDuplicatePayment(
        [samplePayment],
        'NIP-20261101-998811',
        1_500_000_00
      );
      expect(check.isDuplicate).toBe(true);
      expect(check.conflictingPayment?.id).toBe(samplePayment.id);
    });

    test('permits same reference if amount is different', () => {
      const check = checkDuplicatePayment(
        [samplePayment],
        'NIP-20261101-998811',
        500_000_00 // Different amount
      );
      expect(check.isDuplicate).toBe(false);
    });
  });

  describe('Payment Guard for Cancelled or Paid Bookings (Rule 4)', () => {
    test('refuses payment against cancelled booking', () => {
      const res = validatePaymentAgainstBooking('Cancelled', 1_000_000_00, 500_000_00);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Cannot record payment to a cancelled booking/i);
    });

    test('refuses payment exceeding balance unless allowOverpayment is true', () => {
      const balanceKobo = 1_000_000_00;
      const attemptKobo = 1_200_000_00;

      const refused = validatePaymentAgainstBooking('Active', balanceKobo, attemptKobo, false);
      expect(refused.valid).toBe(false);
      expect(refused.error).toMatch(/exceeds outstanding balance/i);

      const permitted = validatePaymentAgainstBooking('Active', balanceKobo, attemptKobo, true);
      expect(permitted.valid).toBe(true);
      expect(permitted.isOverpayment).toBe(true);
    });
  });

  describe('Immutable Reversal Entry (Rule 5)', () => {
    test('refuses reversal if payment is already reconciled', () => {
      const reconciled = { ...samplePayment, isReconciled: true };
      const res = reversePaymentEntry(
        reconciled,
        'Accidental entry',
        'FINANCE_OFFICER',
        'Emeka Finance'
      );
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Reconciled payments cannot be reversed/i);
    });

    test('refuses reversal if staff lacks finance/management permissions', () => {
      const res = reversePaymentEntry(
        samplePayment,
        'Client refund request',
        'SALES_AGENT',
        'Tunde Agent'
      );
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/do not have permission/i);
    });

    test('creates paired negative reversing entry upon valid reversal', () => {
      const res = reversePaymentEntry(
        samplePayment,
        'Duplicate bank transfer slip entered in error',
        'FINANCE_OFFICER',
        'Bisi Finance'
      );
      expect(res.success).toBe(true);
      expect(res.originalUpdated?.isReversed).toBe(true);
      expect(res.reversalEntry?.amountKobo).toBe(-samplePayment.amountKobo);
      expect(res.reversalEntry?.reversesPaymentId).toBe(samplePayment.id);
    });
  });

  describe('Day Close Discrepancy & Owner Reopen (Rules 8, 9)', () => {
    const sampleDayClose: DayCloseRecord = {
      id: 'DC-20261101-BR01',
      branchId: 'br-vi',
      branchName: 'Victoria Island Head Office',
      accountId: 'acc-cash-vi',
      accountName: 'VI Cash Till',
      date: '2026-11-01',
      openingBalanceKobo: 200_000_00,
      receivedByMethod: {
        cash: 300_000_00,
        transfer: 1_500_000_00,
        POS: 200_000_00,
        Paystack: 0,
        cheque: 0,
      },
      totalReceivedKobo: 2_000_000_00,
      totalSpentKobo: 50_000_00,
      expectedClosingBalanceKobo: 450_000_00, // 200k + 300k cash - 50k cash spent = 450k
      countedCashKobo: 0,
      discrepancyKobo: 0,
      isClosed: false,
    };

    test('requires mandatory discrepancy note when counted cash differs from expected', () => {
      // Shortage of ₦10,000 (counted 440k vs expected 450k) without note
      const noNote = closeAccountingDay(sampleDayClose, 440_000_00, '', 'Chioma Cashier');
      expect(noNote.success).toBe(false);
      expect(noNote.error).toMatch(/explanatory note is required/i);

      // With explanatory note
      const withNote = closeAccountingDay(
        sampleDayClose,
        440_000_00,
        '₦10,000 cash shortage under investigation',
        'Chioma Cashier'
      );
      expect(withNote.success).toBe(true);
      expect(withNote.closedRecord?.isClosed).toBe(true);
      expect(withNote.closedRecord?.discrepancyKobo).toBe(-10_000_00);
    });

    test('restricts reopening a closed day strictly to OWNER', () => {
      const closed = { ...sampleDayClose, isClosed: true };
      const managerAttempt = reopenAccountingDay(
        closed,
        'Audit adjustment',
        'OPERATIONS_MANAGER',
        'Bisi Manager'
      );
      expect(managerAttempt.success).toBe(false);
      expect(managerAttempt.error).toMatch(/strictly restricted to the OWNER/i);

      const ownerReopen = reopenAccountingDay(
        closed,
        'Auditor adjustments for bank charges',
        'OWNER',
        'Adeola Adeleke'
      );
      expect(ownerReopen.success).toBe(true);
      expect(ownerReopen.reopenedRecord?.isClosed).toBe(false);
    });
  });

  describe('Expense Approvals & Receipt Blur Warning (Rules 13, 14)', () => {
    test('requires receipt upload for expenses above ₦10,000', () => {
      const res = processExpenseCreation({
        amountKobo: 25_000_00, // ₦25,000
        category: 'Office Consumables',
        categoryGroup: 'other',
        payee: 'Shoprite Lekki',
        accountId: 'acc-cash-vi',
        note: 'Printer paper and refreshments',
        staffRole: 'SALES_AGENT',
        staffId: 'usr_tunde',
        staffName: 'Tunde Agent',
        branchId: 'br-vi',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Receipt attachment is mandatory/i);
    });

    test('flags expense above ₦50,000 for standard staff as pending_approval', () => {
      const res = processExpenseCreation({
        amountKobo: 80_000_00, // ₦80,000 (> ₦50,000)
        category: 'Client Airport Transport',
        categoryGroup: 'transport',
        payee: 'Uber Nigeria',
        accountId: 'acc-cash-vi',
        receiptUrl: 'https://cdn.travelreel.ng/receipt.jpg',
        note: 'Executive airport transfer for corporate group',
        staffRole: 'SALES_AGENT',
        staffId: 'usr_tunde',
        staffName: 'Tunde Agent',
        branchId: 'br-vi',
      });
      expect(res.success).toBe(true);
      expect(res.requiresApproval).toBe(true);
      expect(res.expense?.status).toBe('pending_approval');
    });

    test('auto-approves expense when requested by Owner or Operations Manager', () => {
      const res = processExpenseCreation({
        amountKobo: 120_000_00,
        category: 'Office Internet',
        categoryGroup: 'other',
        payee: 'Starlink Nigeria',
        accountId: 'acc-zenith-01',
        receiptUrl: 'https://cdn.travelreel.ng/starlink.jpg',
        note: 'Monthly high-speed branch internet subscription',
        staffRole: 'OWNER',
        staffId: 'usr_owner',
        staffName: 'Adeola Adeleke',
        branchId: 'br-vi',
      });
      expect(res.success).toBe(true);
      expect(res.requiresApproval).toBe(false);
      expect(res.expense?.status).toBe('approved');
    });
  });

  describe('Reconciliation Auto-Match (Rule 17)', () => {
    test('matches statement line with 99% confidence on exact amount and reference', () => {
      const statementLine: BankStatementLine = {
        id: 'stmt-01',
        statementId: 'zenith-nov',
        date: '2026-11-01',
        reference: 'NIP-20261101-998811',
        description: 'NIP INWARD TRANSFER BABATUNDE ADELEKE',
        amountKobo: 1_500_000_00,
        isMatched: false,
        importHash: 'hash-01',
      };

      const match = matchBankStatementLine(statementLine, [samplePayment]);
      expect(match.matched).toBe(true);
      expect(match.paymentId).toBe(samplePayment.id);
      expect(match.confidence).toBe(99);
    });

    test('matches statement line with 85% confidence on amount and date window', () => {
      const statementLine: BankStatementLine = {
        id: 'stmt-02',
        statementId: 'zenith-nov',
        date: '2026-11-02', // 1 day later
        reference: 'TRF/BNK/UNKNOWN_REF',
        description: 'MOBILE APP TRANSFER',
        amountKobo: 1_500_000_00,
        isMatched: false,
        importHash: 'hash-02',
      };

      const match = matchBankStatementLine(statementLine, [samplePayment]);
      expect(match.matched).toBe(true);
      expect(match.confidence).toBe(85);
    });
  });

  describe('Profit Recognition Formula (Rule 22)', () => {
    test('computes commercial net profit transparently with visible equation', () => {
      const profit = computeCommercialProfit(
        10_000_000_00, // ₦10m recognized ticket revenue
        8_200_000_00, // ₦8.2m direct airline/hotel costs
        500_000_00 // ₦500k operating expenses
      );

      expect(profit.grossMarginKobo).toBe(1_800_000_00);
      expect(profit.netProfitKobo).toBe(1_300_000_00);
      expect(profit.formula).toContain('Recognized Ticket Revenue - Direct Supplier Costs - Operating Expenses');
    });
  });

  describe('Inter-Account Internal Transfers (Rule 23)', () => {
    const zenithNgn: FinancialAccount = {
      id: 'acc-zenith',
      name: 'Zenith Bank NGN',
      type: 'bank',
      currency: 'NGN',
      balanceKobo: 5_000_000_00,
      branchId: 'br-vi',
      isNegativeFlagged: false,
    };

    const cashTillNgn: FinancialAccount = {
      id: 'acc-cash',
      name: 'Cash Till NGN',
      type: 'cash',
      currency: 'NGN',
      balanceKobo: 200_000_00,
      branchId: 'br-vi',
      isNegativeFlagged: false,
    };

    const domiciliaryUsd: FinancialAccount = {
      id: 'acc-dom-usd',
      name: 'USD Domiciliary Account',
      type: 'foreign_currency',
      currency: 'USD',
      balanceKobo: 15_000_00, // $15,000.00
      branchId: 'br-vi',
      isNegativeFlagged: false,
    };

    test('creates paired debit and credit entries for same-currency transfer', () => {
      const res = transferBetweenAccounts(
        zenithNgn,
        cashTillNgn,
        250_000_00, // ₦250,000 cash till replenishment
        'TRF-CASH-REPLENISH',
        'Chioma Cashier'
      );

      expect(res.success).toBe(true);
      expect(res.debitEntry?.amountKobo).toBe(-250_000_00);
      expect(res.creditEntry?.amountKobo).toBe(250_000_00);
      expect(res.debitEntry?.reference).toBe(res.creditEntry?.reference);
    });

    test('refuses direct transfer between different currencies (USD to NGN)', () => {
      const res = transferBetweenAccounts(
        domiciliaryUsd,
        zenithNgn,
        1_000_00,
        'FX-DIRECT-FAIL',
        'Chioma Cashier'
      );

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Cannot transfer directly between different currencies/i);
    });
  });
});

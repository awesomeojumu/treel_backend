import { FastifyInstance } from 'fastify';
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
  ExpenseRecord,
  FinancialAccount,
  BankStatementLine,
  FinancePaymentMethod,
  ExpenseCategoryGroup,
} from '@/core/finance/financePageRules';

// In-memory demo store for Finance
const INITIAL_ACCOUNTS: FinancialAccount[] = [];

const INITIAL_PAYMENTS: FinancePaymentEntry[] = [];

const INITIAL_EXPENSES: ExpenseRecord[] = [];

const INITIAL_DAY_CLOSES: DayCloseRecord[] = [];

const INITIAL_STATEMENT_LINES: BankStatementLine[] = [];

let accountsDb = [...INITIAL_ACCOUNTS];
let paymentsDb = [...INITIAL_PAYMENTS];
let expensesDb = [...INITIAL_EXPENSES];
let dayClosesDb = [...INITIAL_DAY_CLOSES];
let statementLinesDb = [...INITIAL_STATEMENT_LINES];

export async function registerFinancePageRoutes(app: FastifyInstance): Promise<void> {
  // 1. Rules Catalog
  app.get('/api/v1/finance/rules', async () => {
    return {
      success: true,
      rules: listFinancePageRules(),
    };
  });

  // 2. Payments Ledger
  app.get<{
    Querystring: {
      method?: string;
      accountId?: string;
      branchId?: string;
    };
  }>('/api/v1/finance/payments', async (req) => {
    const { method, accountId, branchId } = req.query;
    let list = [...paymentsDb];

    if (method && method !== 'all') {
      list = list.filter((p) => p.method === method);
    }
    if (accountId && accountId !== 'all') {
      list = list.filter((p) => p.accountId === accountId);
    }
    if (branchId && branchId !== 'all') {
      list = list.filter((p) => p.branchId === branchId);
    }

    const totalCollectedKobo = list
      .filter((p) => !p.isReversed && p.amountKobo > 0)
      .reduce((s, p) => s + p.amountKobo, 0);

    return {
      success: true,
      count: list.length,
      totalCollectedKobo,
      payments: list,
    };
  });

  // 3. Capture Payment
  app.post<{
    Body: {
      date: string;
      amountKobo: number;
      method: FinancePaymentMethod;
      accountId: string;
      payerName: string;
      bookingId?: string;
      invoiceId?: string;
      reference: string;
      proofUrl?: string;
      receiptNumber?: string;
      staffId: string;
      staffName: string;
      branchId: string;
      allowOverpayment?: boolean;
    };
  }>('/api/v1/finance/payments', async (req, reply) => {
    const body = req.body;

    // Proof validation (Rule 2)
    const proofCheck = validatePaymentProofRequirement(
      body.method,
      body.proofUrl,
      body.receiptNumber
    );
    if (!proofCheck.valid) {
      return reply.code(400).send({ success: false, error: proofCheck.error });
    }

    // Duplicate detection (Rule 3)
    const duplicateCheck = checkDuplicatePayment(paymentsDb, body.reference, body.amountKobo);
    if (duplicateCheck.isDuplicate) {
      return reply.code(400).send({
        success: false,
        error: `Duplicate payment detected! A transaction with reference "${body.reference}" and amount ₦${(
          body.amountKobo / 100
        ).toLocaleString()} was already recorded as ${duplicateCheck.conflictingPayment?.id}.`,
        conflictingPayment: duplicateCheck.conflictingPayment,
      });
    }

    // Check account
    const account = accountsDb.find((a) => a.id === body.accountId);
    const accountName = account?.name || 'Primary Bank Account';

    // Day Close check: late entry rollforward (Rule 10)
    const targetDate = body.date.split('T')[0];
    const closedDay = dayClosesDb.find(
      (dc) => dc.branchId === body.branchId && dc.date === targetDate && dc.isClosed
    );

    let accountingDayDate = targetDate;
    let isLateEntryForClosedDay = false;
    if (closedDay) {
      isLateEntryForClosedDay = true;
      const todayStr = new Date().toISOString().split('T')[0];
      accountingDayDate = todayStr; // Forward into next open day
    }

    const paymentId = `PAY-${new Date().getFullYear()}-${String(paymentsDb.length + 815).padStart(
      4,
      '0'
    )}`;
    const now = new Date().toISOString();

    const payment: FinancePaymentEntry = {
      id: paymentId,
      organizationId: 'org-lagos-01',
      date: body.date,
      accountingDayDate,
      amountKobo: body.amountKobo,
      method: body.method,
      accountId: body.accountId,
      accountName,
      payerName: body.payerName,
      bookingId: body.bookingId,
      invoiceId: body.invoiceId,
      reference: body.reference,
      proofUrl: body.proofUrl,
      receiptNumber: body.receiptNumber,
      receivedByStaffId: body.staffId,
      receivedByStaffName: body.staffName,
      branchId: body.branchId,
      isOverpayment: Boolean(body.allowOverpayment),
      isReversed: false,
      isReconciled: false,
      isLateEntryForClosedDay,
      originalTransactionDate: isLateEntryForClosedDay ? body.date : undefined,
      createdAt: now,
    };

    paymentsDb.unshift(payment);

    // Update account balance
    if (account) {
      account.balanceKobo += body.amountKobo;
      account.isNegativeFlagged = account.balanceKobo < 0;
    }

    return reply.code(201).send({
      success: true,
      message: isLateEntryForClosedDay
        ? `Payment recorded! Accounting day ${targetDate} was closed; transaction posted to open day ${accountingDayDate} with original date noted.`
        : 'Payment recorded successfully.',
      payment,
    });
  });

  // 4. Reverse Payment (Rule 5)
  app.post<{
    Params: { id: string };
    Body: {
      reversalReason: string;
      staffRole: string;
      staffName: string;
    };
  }>('/api/v1/finance/payments/:id/reverse', async (req, reply) => {
    const payment = paymentsDb.find((p) => p.id === req.params.id);
    if (!payment) {
      return reply.code(404).send({ success: false, error: 'Payment entry not found.' });
    }

    const res = reversePaymentEntry(
      payment,
      req.body.reversalReason,
      req.body.staffRole,
      req.body.staffName
    );

    if (!res.success) {
      return reply.code(400).send(res);
    }

    // Update original
    const idx = paymentsDb.findIndex((p) => p.id === payment.id);
    paymentsDb[idx] = res.originalUpdated!;
    // Append reversal entry
    paymentsDb.unshift(res.reversalEntry!);

    // Deduct from account balance
    const account = accountsDb.find((a) => a.id === payment.accountId);
    if (account) {
      account.balanceKobo -= payment.amountKobo;
      account.isNegativeFlagged = account.balanceKobo < 0;
    }

    return {
      success: true,
      message: `Reversal entry ${res.reversalEntry?.id} created. Both original and reversal entries remain visible in the append-only ledger.`,
      originalPayment: res.originalUpdated,
      reversalEntry: res.reversalEntry,
    };
  });

  // 5. Daily Cash Summaries (Rules 7, 8, 9)
  app.get('/api/v1/finance/daily-cash', async () => {
    return {
      success: true,
      dayCloses: dayClosesDb,
    };
  });

  app.post<{
    Params: { id: string };
    Body: {
      countedCashKobo: number;
      discrepancyNote?: string;
      staffName: string;
    };
  }>('/api/v1/finance/daily-cash/:id/close', async (req, reply) => {
    const record = dayClosesDb.find((dc) => dc.id === req.params.id);
    if (!record) {
      return reply.code(404).send({ success: false, error: 'Daily cash record not found.' });
    }

    const res = closeAccountingDay(
      record,
      req.body.countedCashKobo,
      req.body.discrepancyNote,
      req.body.staffName
    );

    if (!res.success) {
      return reply.code(400).send(res);
    }

    const idx = dayClosesDb.findIndex((dc) => dc.id === record.id);
    dayClosesDb[idx] = res.closedRecord!;

    return {
      success: true,
      message: 'Accounting day closed and locked.',
      record: res.closedRecord,
    };
  });

  app.post<{
    Params: { id: string };
    Body: {
      reopenReason: string;
      staffRole: string;
      staffName: string;
    };
  }>('/api/v1/finance/daily-cash/:id/reopen', async (req, reply) => {
    const record = dayClosesDb.find((dc) => dc.id === req.params.id);
    if (!record) {
      return reply.code(404).send({ success: false, error: 'Daily cash record not found.' });
    }

    const res = reopenAccountingDay(
      record,
      req.body.reopenReason,
      req.body.staffRole,
      req.body.staffName
    );

    if (!res.success) {
      return reply.code(403).send(res);
    }

    const idx = dayClosesDb.findIndex((dc) => dc.id === record.id);
    dayClosesDb[idx] = res.reopenedRecord!;

    return {
      success: true,
      message: 'Accounting day reopened by Owner.',
      record: res.reopenedRecord,
    };
  });

  // 6. Expenses (Rules 11, 12, 13, 14, 15)
  app.get('/api/v1/finance/expenses', async () => {
    return {
      success: true,
      count: expensesDb.length,
      expenses: expensesDb,
    };
  });

  app.post<{
    Body: {
      amountKobo: number;
      category: string;
      categoryGroup: ExpenseCategoryGroup;
      payee: string;
      accountId: string;
      receiptUrl?: string;
      hasBlurWarning?: boolean;
      note: string;
      staffRole: string;
      staffId: string;
      staffName: string;
      branchId: string;
    };
  }>('/api/v1/finance/expenses', async (req, reply) => {
    const res = processExpenseCreation(req.body);
    if (!res.success) {
      return reply.code(400).send(res);
    }

    expensesDb.unshift(res.expense!);

    // Deduct from account balance only if approved
    if (res.expense?.status === 'approved') {
      const account = accountsDb.find((a) => a.id === req.body.accountId);
      if (account) {
        account.balanceKobo -= req.body.amountKobo;
        account.isNegativeFlagged = account.balanceKobo < 0;
      }
    }

    return reply.code(201).send({
      success: true,
      message: res.requiresApproval
        ? 'Expense recorded as pending approval (exceeds staff limit).'
        : 'Expense approved and posted to ledger.',
      expense: res.expense,
      requiresApproval: res.requiresApproval,
    });
  });

  app.post<{
    Params: { id: string };
    Body: { staffName: string };
  }>('/api/v1/finance/expenses/:id/approve', async (req, reply) => {
    const exp = expensesDb.find((e) => e.id === req.params.id);
    if (!exp) {
      return reply.code(404).send({ success: false, error: 'Expense not found.' });
    }

    exp.status = 'approved';
    exp.approvedByStaffName = req.body.staffName;

    // Deduct from account
    const account = accountsDb.find((a) => a.id === exp.accountId);
    if (account) {
      account.balanceKobo -= exp.amountKobo;
      account.isNegativeFlagged = account.balanceKobo < 0;
    }

    return {
      success: true,
      message: 'Expense approved and debited from account.',
      expense: exp,
    };
  });

  // 7. Statement Reconciliation (Rules 16, 17, 18, 19, 20)
  app.get('/api/v1/finance/reconciliation', async () => {
    return {
      success: true,
      statementLines: statementLinesDb,
      unmatchedCount: statementLinesDb.filter((s) => !s.isMatched).length,
    };
  });

  app.post<{
    Params: { lineId: string };
    Body: { paymentId: string };
  }>('/api/v1/finance/reconciliation/match/:lineId', async (req, reply) => {
    const line = statementLinesDb.find((s) => s.id === req.params.lineId);
    if (!line) {
      return reply.code(404).send({ success: false, error: 'Statement line not found.' });
    }

    const payment = paymentsDb.find((p) => p.id === req.body.paymentId);
    if (!payment) {
      return reply.code(404).send({ success: false, error: 'Payment not found.' });
    }

    line.isMatched = true;
    line.matchedPaymentId = payment.id;
    payment.isReconciled = true;
    payment.reconciledStatementLineId = line.id;

    return {
      success: true,
      message: 'Statement line reconciled with payment entry.',
      statementLine: line,
      payment,
    };
  });

  // 8. Executive Dashboard & Accounts (Rules 21, 22, 23, 24, 25, 26)
  app.get('/api/v1/finance/dashboard', async () => {
    const cashInKobo = paymentsDb
      .filter((p) => !p.isReversed && p.amountKobo > 0)
      .reduce((s, p) => s + p.amountKobo, 0);

    const cashOutKobo = expensesDb
      .filter((e) => e.status === 'approved')
      .reduce((s, e) => s + e.amountKobo, 0);

    const recognizedRevenueKobo = 32_500_000_00;
    const directSupplierCostsKobo = 26_200_000_00;
    const profitData = computeCommercialProfit(
      recognizedRevenueKobo,
      directSupplierCostsKobo,
      cashOutKobo
    );

    // VAT Output (Collected from customers) vs Input (Paid to suppliers)
    const vatCollectedKobo = Math.round((cashInKobo * 750) / 10750);
    const vatPaidKobo = Math.round((cashOutKobo * 750) / 10750);

    return {
      success: true,
      cashInKobo,
      cashOutKobo,
      netProfitKobo: profitData.netProfitKobo,
      profitFormula: profitData.formula,
      vatSummary: {
        vatCollectedOutputKobo: vatCollectedKobo,
        vatPaidInputKobo: vatPaidKobo,
        netVatPayableKobo: Math.max(0, vatCollectedKobo - vatPaidKobo),
      },
      accounts: accountsDb,
    };
  });

  // 9. Inter-Account Internal Transfers (Rule 23)
  app.post<{
    Body: {
      fromAccountId: string;
      toAccountId: string;
      amountKobo: number;
      reference: string;
      staffName: string;
    };
  }>('/api/v1/finance/accounts/transfer', async (req, reply) => {
    const fromAcc = accountsDb.find((a) => a.id === req.body.fromAccountId);
    const toAcc = accountsDb.find((a) => a.id === req.body.toAccountId);

    if (!fromAcc || !toAcc) {
      return reply.code(404).send({ success: false, error: 'Source or destination account not found.' });
    }

    const res = transferBetweenAccounts(
      fromAcc,
      toAcc,
      req.body.amountKobo,
      req.body.reference,
      req.body.staffName
    );

    if (!res.success) {
      return reply.code(400).send(res);
    }

    paymentsDb.unshift(res.debitEntry!);
    paymentsDb.unshift(res.creditEntry!);

    fromAcc.balanceKobo -= req.body.amountKobo;
    toAcc.balanceKobo += req.body.amountKobo;
    fromAcc.isNegativeFlagged = fromAcc.balanceKobo < 0;

    return {
      success: true,
      message: `Internal transfer of ₦${(req.body.amountKobo / 100).toLocaleString()} completed with paired debit and credit journal entries.`,
      debitEntry: res.debitEntry,
      creditEntry: res.creditEntry,
    };
  });
}

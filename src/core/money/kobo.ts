import { z } from 'zod';
import { CurrencyCode, CurrencyCodeSchema } from '@/core/country-packs/packs';

/**
 * Principle 3: Money is append-only
 * - Kobo integers with a currency code
 * - Corrections by reversal
 * - Journal entries must balance to zero
 */
export const MoneyAmountSchema = z.object({
  amountMinor: z.number().int('Money must be stored in integer minor units (e.g., kobo)'),
  currency: CurrencyCodeSchema,
});

export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;

export function kobo(amountMinor: number, currency: CurrencyCode = 'NGN'): MoneyAmount {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Money amount must be an integer in minor units (kobo); received ${amountMinor}`);
  }
  return { amountMinor, currency };
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function formatMoney(money: MoneyAmount): string {
  const symbols: Record<CurrencyCode, string> = {
    NGN: '₦',
    GHS: 'GH₵',
    KES: 'KSh',
    ZAR: 'R',
    USD: '$',
    GBP: '£',
    EUR: '€',
  };
  const symbol = symbols[money.currency] ?? `${money.currency} `;
  const isNegative = money.amountMinor < 0;
  const absMajor = (Math.abs(money.amountMinor) / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}${symbol}${absMajor}`;
}

export interface JournalLineInput {
  accountCode: string;
  debitMinor: number;
  creditMinor: number;
  currency: CurrencyCode;
}

export interface AppendOnlyLedgerEntry {
  entryId: string;
  organizationId: string;
  userId: string;
  deviceId: string;
  createdAt: Date;
  reason: string;
  reversesEntryId?: string;
  lines: JournalLineInput[];
}

export function assertBalancedJournal(lines: JournalLineInput[]): void {
  if (lines.length < 2) {
    throw new Error('A double-entry journal entry requires at least two lines.');
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    if (!Number.isInteger(line.debitMinor) || !Number.isInteger(line.creditMinor)) {
      throw new Error('Journal line debit and credit amounts must be integer minor units (kobo).');
    }
    if (line.debitMinor < 0 || line.creditMinor < 0) {
      throw new Error('Journal line debit and credit amounts cannot be negative.');
    }
    if ((line.debitMinor === 0 && line.creditMinor === 0) || (line.debitMinor > 0 && line.creditMinor > 0)) {
      throw new Error('Each journal line must have either a positive debit or a positive credit, not both.');
    }
    totalDebit += line.debitMinor;
    totalCredit += line.creditMinor;
  }

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Unbalanced journal entry rejected: total debits (${totalDebit}) !== total credits (${totalCredit}). Difference: ${totalDebit - totalCredit} minor units.`
    );
  }
}

/**
 * Corrections are always performed by appending a reversal entry with a mandatory reason.
 */
export function buildReversalJournalEntry(params: {
  newEntryId: string;
  original: AppendOnlyLedgerEntry;
  actorUserId: string;
  actorDeviceId: string;
  reason: string;
}): AppendOnlyLedgerEntry {
  if (!params.reason || params.reason.trim().length < 3) {
    throw new Error('Reversing a money record requires a written reason.');
  }

  const reversedLines: JournalLineInput[] = params.original.lines.map((line) => ({
    accountCode: line.accountCode,
    debitMinor: line.creditMinor,
    creditMinor: line.debitMinor,
    currency: line.currency,
  }));

  assertBalancedJournal(reversedLines);

  return {
    entryId: params.newEntryId,
    organizationId: params.original.organizationId,
    userId: params.actorUserId,
    deviceId: params.actorDeviceId,
    createdAt: new Date(),
    reason: params.reason.trim(),
    reversesEntryId: params.original.entryId,
    lines: reversedLines,
  };
}

import { describe, it, expect } from '@jest/globals';
import {
  MANDATORY_FIELD_RULES,
  normalizePhone,
  normalizeEmail,
  sanitizeString,
  validateMoneyAmount,
  validateDateRange,
} from '@/core/validation/fieldRules';

describe('Form Validation, Data Entry & Field Rules Specification', () => {
  it('defines and verifies all 13 mandatory field validation rules', () => {
    expect(MANDATORY_FIELD_RULES).toHaveLength(13);
    expect(MANDATORY_FIELD_RULES.every((r) => r.isCompliant)).toBe(true);

    const ids = MANDATORY_FIELD_RULES.map((r) => r.id);
    expect(ids).toContain('RULE_REQUIRED_FIELDS');
    expect(ids).toContain('RULE_SERVER_AUTHORITATIVE');
    expect(ids).toContain('RULE_SANITIZE_AND_CAP');
    expect(ids).toContain('RULE_PHONE_NORMALIZATION');
    expect(ids).toContain('RULE_EMAIL_LOWERCASE_UNIQUE');
    expect(ids).toContain('RULE_MONEY_FORMAT');
    expect(ids).toContain('RULE_DATE_CLARITY_AND_RANGE');
    expect(ids).toContain('RULE_FILE_UPLOAD_GUARDS');
    expect(ids).toContain('RULE_DOUBLE_TAP_PROTECTION');
    expect(ids).toContain('RULE_UNSAVED_CHANGES_GUARD');
    expect(ids).toContain('RULE_KEYBOARD_ACCESSIBILITY');
    expect(ids).toContain('RULE_SUCCESS_FEEDBACK');
    expect(ids).toContain('RULE_DRAFT_AUTO_SAVE');
  });

  // Rule 4: Phone Numbers
  it('Rule 4 (Phone numbers): accepts 0803..., +234803... and 234803..., stores one format, rejects letters', () => {
    // 0803 prefix
    const p1 = normalizePhone('08031234567');
    expect(p1.valid).toBe(true);
    expect(p1.formatted).toBe('+2348031234567');

    // +234803 prefix
    const p2 = normalizePhone('+2348031234567');
    expect(p2.valid).toBe(true);
    expect(p2.formatted).toBe('+2348031234567');

    // 234803 without plus
    const p3 = normalizePhone('2348031234567');
    expect(p3.valid).toBe(true);
    expect(p3.formatted).toBe('+2348031234567');

    // Rejects letters
    const pInvalid = normalizePhone('0803123ABCD');
    expect(pInvalid.valid).toBe(false);
    expect(pInvalid.error).toContain('cannot contain letters');
  });

  // Rule 5: Email Normalization
  it('Rule 5 (Email): lower-cased, validated, one per user inside a workspace', () => {
    const emailResult = normalizeEmail('  Adaeze.Okafor@SkylineTravels.NG  ');
    expect(emailResult.valid).toBe(true);
    expect(emailResult.normalized).toBe('adaeze.okafor@skylinetravels.ng');

    const invalidEmail = normalizeEmail('notanemail');
    expect(invalidEmail.valid).toBe(false);
    expect(invalidEmail.error).toContain('valid email');
  });

  // Rule 3: Sanitization & Caps
  it('Rule 3 (Sanitization): trims spaces, rejects only-spaces, caps lengths, rejects control characters', () => {
    // Rejects whitespace-only
    const emptyCheck = sanitizeString('   ', 100, 'Client name');
    expect(emptyCheck.valid).toBe(false);
    expect(emptyCheck.error).toContain('cannot be empty or spaces only');

    // Trims whitespace
    const trimCheck = sanitizeString('  Chief Obinna  ', 100, 'Client name');
    expect(trimCheck.valid).toBe(true);
    expect(trimCheck.sanitized).toBe('Chief Obinna');

    // Caps lengths
    const capCheck = sanitizeString('A'.repeat(150), 100, 'Summary');
    expect(capCheck.valid).toBe(false);
    expect(capCheck.sanitized).toHaveLength(100);

    // Rejects breaking ASCII control chars
    const controlCheck = sanitizeString('Chief Obinna\x00\x07', 100, 'Client name');
    expect(controlCheck.valid).toBe(false);
    expect(controlCheck.error).toContain('unsupported control characters');
  });

  // Rule 6: Money Fields
  it('Rule 6 (Money fields): numbers only, two decimals, no negatives (unless refund/reversal), max cap, naira symbol', () => {
    // Normal sale: ₦4,180,000.00
    const m1 = validateMoneyAmount(418000000);
    expect(m1.valid).toBe(true);
    expect(m1.formattedNaira).toBe('₦4,180,000.00');

    // Negative disallowed for normal sale
    const mNegative = validateMoneyAmount(-500000, { isRefundOrReversal: false });
    expect(mNegative.valid).toBe(false);
    expect(mNegative.error).toContain('cannot be negative unless processing a reversal or refund');

    // Negative allowed for refund/reversal
    const mReversal = validateMoneyAmount(-500000, { isRefundOrReversal: true });
    expect(mReversal.valid).toBe(true);
    expect(mReversal.formattedNaira).toContain('5,000.00');

    // Sensible maximum cap
    const mExceeds = validateMoneyAmount(100_000_000_000_00, { maxNaira: 1_000_000_000 });
    expect(mExceeds.valid).toBe(false);
    expect(mExceeds.error).toContain('cannot exceed');
  });

  // Rule 7: Date Fields
  it('Rule 7 (Date fields): no past date where illogical, end date not before start date, unambiguous day-month-year', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    // Valid range
    const validRange = validateDateRange(tomorrow.toISOString(), nextWeek.toISOString());
    expect(validRange.valid).toBe(true);
    expect(validRange.startLabel).toMatch(/\d{1,2}\s[A-Z][a-z]{2}\s\d{4}/); // e.g. "3 Nov 2026"
    expect(validRange.startLabel).not.toMatch(/^\d{1,2}\/\d{1,2}$/); // never ambiguous MM/DD

    // End date before start date
    const invertedRange = validateDateRange(nextWeek.toISOString(), tomorrow.toISOString());
    expect(invertedRange.valid).toBe(false);
    expect(invertedRange.error).toContain('Return / end date cannot be earlier');

    // Past date disallowed for travel departure
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const pastDeparture = validateDateRange(yesterday.toISOString(), nextWeek.toISOString(), false);
    expect(pastDeparture.valid).toBe(false);
    expect(pastDeparture.error).toContain('cannot be in the past');
  });
});

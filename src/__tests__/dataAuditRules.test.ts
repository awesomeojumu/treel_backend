import {
  DATA_AUDIT_SPECIFICATION_RULES,
  parseNigerianPhone,
  parseNigerianDate,
  parseNigerianCurrencyToKobo,
  sanitizeSensitiveAuditPayload,
  validateUndoEligibility,
} from '../core/dataAudit/dataAuditRules';

describe('Data and Audit Rules & Engine (Import & Audit Log)', () => {
  it('should have all 13 specification rules defined and compliant', () => {
    expect(DATA_AUDIT_SPECIFICATION_RULES).toHaveLength(13);
    DATA_AUDIT_SPECIFICATION_RULES.forEach((rule) => {
      expect(rule.isCompliant).toBe(true);
      expect(rule.id).toMatch(/^(IMP_|AUDIT_)/);
      expect(rule.requirement.length).toBeGreaterThan(10);
    });
  });

  describe('Nigerian Phone Number Normalization (Rule 5)', () => {
    it('should format standard 11-digit local Nigerian mobile numbers', () => {
      const res = parseNigerianPhone('08031234567');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('+2348031234567');
    });

    it('should handle spaced and hyphenated Nigerian numbers', () => {
      const res = parseNigerianPhone('0803 123 4567');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('+2348031234567');
    });

    it('should handle numbers with +234 and 234 country prefixes', () => {
      const res1 = parseNigerianPhone('+2348031234567');
      expect(res1.isValid).toBe(true);
      expect(res1.normalized).toBe('+2348031234567');

      const res2 = parseNigerianPhone('2348031234567');
      expect(res2.isValid).toBe(true);
      expect(res2.normalized).toBe('+2348031234567');
    });

    it('should reject invalid non-Nigerian or malformed phone numbers', () => {
      const res = parseNigerianPhone('012345');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Expected 11 digits');
    });
  });

  describe('Nigerian Date Parsing (Rule 5)', () => {
    it('should parse DD/MM/YYYY Nigerian date strings', () => {
      const res = parseNigerianDate('25/11/2026');
      expect(res.isValid).toBe(true);
      expect(res.isoDate).toBe('2026-11-25');
    });

    it('should parse DD-MM-YYYY format', () => {
      const res = parseNigerianDate('05-08-2026');
      expect(res.isValid).toBe(true);
      expect(res.isoDate).toBe('2026-08-05');
    });

    it('should accept ISO YYYY-MM-DD directly', () => {
      const res = parseNigerianDate('2026-12-31');
      expect(res.isValid).toBe(true);
      expect(res.isoDate).toBe('2026-12-31');
    });

    it('should reject invalid calendar dates', () => {
      const res = parseNigerianDate('99/99/2026');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid calendar date components');
    });
  });

  describe('Nigerian Currency to Integer Kobo Parser (Rule 5)', () => {
    it('should parse formatted strings with Naira symbol and commas', () => {
      const res = parseNigerianCurrencyToKobo('₦1,250,000.00');
      expect(res.isValid).toBe(true);
      expect(res.kobo).toBe(125000000);
    });

    it('should parse strings with NGN prefix', () => {
      const res = parseNigerianCurrencyToKobo('NGN 45,000');
      expect(res.isValid).toBe(true);
      expect(res.kobo).toBe(4500000);
    });

    it('should parse raw numbers with commas', () => {
      const res = parseNigerianCurrencyToKobo('500,000');
      expect(res.isValid).toBe(true);
      expect(res.kobo).toBe(50000000);
    });

    it('should parse plain numbers in Naira into kobo', () => {
      const res = parseNigerianCurrencyToKobo(2500);
      expect(res.isValid).toBe(true);
      expect(res.kobo).toBe(250000);
    });

    it('should reject non-numeric text', () => {
      const res = parseNigerianCurrencyToKobo('Free-Ticket');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid currency value');
    });
  });

  describe('Sensitive Credential & Card Sanitization (Rule 13)', () => {
    it('should redact passwords, full card numbers, cvv, and 2FA secrets from audit logs', () => {
      const sensitivePayload = {
        name: 'Chidinma Okafor',
        email: 'chidinma@travelreel.com',
        password: 'SuperSecretPassword123!',
        fullCardNumber: '5399831092837482',
        cvv: '821',
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
        amountKobo: 45000000,
      };

      const sanitized = sanitizeSensitiveAuditPayload(sensitivePayload);

      expect(sanitized).toBeDefined();
      expect(sanitized?.name).toBe('Chidinma Okafor');
      expect(sanitized?.email).toBe('chidinma@travelreel.com');
      expect(sanitized?.amountKobo).toBe(45000000);

      // Redacted keys
      expect(sanitized?.password).toBe('[REDACTED]');
      expect(sanitized?.fullCardNumber).toBe('[REDACTED]');
      expect(sanitized?.cvv).toBe('[REDACTED]');
      expect(sanitized?.twoFactorSecret).toBe('[REDACTED]');
    });
  });

  describe('24-Hour Import Undo Window (Rule 7)', () => {
    it('should permit rollback within 24 hours', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const res = validateUndoEligibility(twoHoursAgo);
      expect(res.isEligible).toBe(true);
      expect(res.hoursRemaining).toBe(22);
    });

    it('should reject rollback attempts past 24 hours', () => {
      const twentySixHoursAgo = new Date(Date.now() - 26 * 60 * 60 * 1000);
      const res = validateUndoEligibility(twentySixHoursAgo);
      expect(res.isEligible).toBe(false);
      expect(res.hoursRemaining).toBe(0);
      expect(res.error).toContain('24-hour rollback window expired');
    });
  });
});

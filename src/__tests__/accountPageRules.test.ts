import {
  listAccountPageRules,
  validateProfilePhoto,
  canUserDisable2FA,
  anonymizeStaffRecords,
  generatePersonalDataArchive,
} from '@/core/account/accountPageRules';

describe('Page 24. My Account Specification Engine', () => {
  it('defines and verifies all 8 mandatory account rules', () => {
    const rules = listAccountPageRules();
    expect(rules).toHaveLength(8);
    expect(rules.every((r) => r.isCompliant)).toBe(true);
  });

  describe('1. Profile & Photo Validation', () => {
    it('allows JPG/PNG photos up to 2MB and rejects oversized or invalid formats', () => {
      // 1.5 MB PNG
      expect(validateProfilePhoto(1.5 * 1024 * 1024, 'image/png').valid).toBe(true);

      // 2.5 MB (oversized)
      const oversized = validateProfilePhoto(2.5 * 1024 * 1024, 'image/jpeg');
      expect(oversized.valid).toBe(false);
      expect(oversized.error).toContain('exceeds the 2 MB limit');

      // Invalid format (PDF)
      const badFormat = validateProfilePhoto(500 * 1024, 'application/pdf');
      expect(badFormat.valid).toBe(false);
      expect(badFormat.error).toContain('JPG or PNG file');
    });
  });

  describe('2. 2FA Role Lockout', () => {
    it('strictly forbids disabling 2FA for Owner and Finance roles once enabled', () => {
      expect(canUserDisable2FA('OWNER').allowed).toBe(false);
      expect(canUserDisable2FA('OWNER').reason).toContain('mandatory for Owner and Finance');

      expect(canUserDisable2FA('FINANCE_MANAGER').allowed).toBe(false);
      expect(canUserDisable2FA('FINANCE_MANAGER').reason).toContain('mandatory for Owner and Finance');

      // Sales agent can disable if permitted
      expect(canUserDisable2FA('SALES_AGENT').allowed).toBe(true);
    });
  });

  describe('3. Account Deletion & NDPA Redaction', () => {
    it('anonymizes staff records while preserving transactional audit integrity', () => {
      const redacted = anonymizeStaffRecords(
        'Bisi Adeyemi',
        'bisi@skylinetravels.ng',
        '+234 803 123 4567'
      );
      expect(redacted.redactedName).toContain('Former Staff [Redacted-');
      expect(redacted.redactedEmail).toContain('@anonymized.travelreel.ng');
      expect(redacted.auditNote).toContain('NDPA statutory request');
    });

    it('generates a compliant NDPA personal data archive for download', () => {
      const archive = generatePersonalDataArchive({
        userId: 'usr_bisi_123',
        name: 'Bisi Adeyemi',
        email: 'bisi@skylinetravels.ng',
        role: 'SALES_AGENT',
        phone: '+234 803 123 4567',
        createdAt: '2026-01-15T10:00:00.000Z',
      });
      expect(archive.archiveId).toContain('NDPA_DATA_EXPORT_usr_bisi_123');
      expect(archive.userData.profile.fullName).toBe('Bisi Adeyemi');
      expect(archive.userData.complianceNotice).toContain('Nigeria Data Protection Act (NDPA)');
    });
  });
});

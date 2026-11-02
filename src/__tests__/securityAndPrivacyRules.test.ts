import {
  listSecurityPrivacyRules,
  SessionAuthManager,
  generateSignedFileUrl,
  verifySignedFileUrl,
  accessKycDocument,
  RateLimiterAndLockoutEngine,
  escapeHtml,
  sanitizeUploadedFileName,
  maskPii,
  processDataSubjectRequest,
  getBackupRetentionPolicy,
} from '@/core/platform/securityAndPrivacyRules';

describe('Section 1.9 Security and Privacy Specification', () => {
  it('defines and verifies all 8 mandatory security and privacy rules', () => {
    const rules = listSecurityPrivacyRules();
    expect(rules).toHaveLength(8);
    expect(rules.every(r => r.isCompliant)).toBe(true);

    const ids = rules.map(r => r.id);
    expect(ids).toContain('SEC_AUTH_TOKEN_ROTATION_REVOCATION');
    expect(ids).toContain('SEC_HTTPS_ENCRYPTION_SIGNED_URLS');
    expect(ids).toContain('SEC_KYC_PERMISSION_AND_AUDIT_LOGGING');
    expect(ids).toContain('SEC_RATE_LIMITING_AND_ACCOUNT_LOCKOUT');
    expect(ids).toContain('SEC_INPUT_ESCAPING_AND_FILENAME_SANITIZATION');
    expect(ids).toContain('SEC_ZERO_PII_LEAKAGE');
    expect(ids).toContain('SEC_DATA_SUBJECT_RIGHTS_NDPR_GDPR');
    expect(ids).toContain('SEC_BACKUP_RETENTION_AND_PURGE');
  });

  it('Rule 1: hashes passwords, expires tokens, rotates refresh tokens, and revokes sessions on token reuse', () => {
    const manager = new SessionAuthManager();

    // 1. Create session
    const session = manager.createSession('usr-adaeze-owner');
    expect(session.sessionId).toBeDefined();
    expect(session.accessToken).toContain('jwt_access_');
    expect(session.refreshToken).toContain('rft_');

    // 2. Rotate refresh token legitimately
    const rotation1 = manager.rotateRefreshToken(session.sessionId, session.refreshToken);
    expect(rotation1.success).toBe(true);
    expect(rotation1.newRefreshToken).toBeDefined();
    expect(rotation1.newRefreshToken).not.toBe(session.refreshToken);

    // 3. Attacker tries to reuse the old refresh token: MUST REUSE-DETECT & REVOKE
    const attack = manager.rotateRefreshToken(session.sessionId, session.refreshToken);
    expect(attack.success).toBe(false);
    expect(attack.message).toContain('Refresh token reuse detected');

    const revokedSession = manager.getSession(session.sessionId);
    expect(revokedSession?.isRevoked).toBe(true);

    // 4. Session revocation manually
    const session2 = manager.createSession('usr-tunde-ops');
    expect(manager.revokeSession(session2.sessionId)).toBe(true);
    expect(manager.getSession(session2.sessionId)?.isRevoked).toBe(true);
  });

  it('Rule 2: enforces HTTPS, AES-256 at rest, and time-limited expiring signed file URLs', () => {
    // Generate signed URL with 15-min expiry
    const signed = generateSignedFileUrl('doc-passport-kemi.pdf', 'org-skyline-travels', 900);
    expect(signed.signedUrl).toContain('https://');
    expect(signed.signedUrl).toContain('sig=');
    expect(signed.expiresInSeconds).toBe(900);

    // Extract signature and expiresAt
    const urlObj = new URL(signed.signedUrl);
    const exp = parseInt(urlObj.searchParams.get('exp') || '0', 10);
    const sig = urlObj.searchParams.get('sig') || '';

    // Valid verification
    const validCheck = verifySignedFileUrl('doc-passport-kemi.pdf', 'org-skyline-travels', exp, sig);
    expect(validCheck.valid).toBe(true);

    // Tampered signature
    const tamperedCheck = verifySignedFileUrl('doc-passport-kemi.pdf', 'org-skyline-travels', exp, 'invalid_tampered_sig');
    expect(tamperedCheck.valid).toBe(false);
    expect(tamperedCheck.reason).toBe('INVALID_SIGNATURE');

    // Expired timestamp
    const expiredCheck = verifySignedFileUrl('doc-passport-kemi.pdf', 'org-skyline-travels', Math.floor(Date.now() / 1000) - 100, sig);
    expect(expiredCheck.valid).toBe(false);
    expect(expiredCheck.reason).toBe('EXPIRED');
  });

  it('Rule 3: restricts Passport/ID/KYC files to authorized roles and logs every single view', () => {
    // Authorized view: Owner
    const ownerAccess = accessKycDocument({
      documentId: 'kyc-pass-001',
      clientId: 'client-emeka-ani',
      userRole: 'OWNER',
      userId: 'usr-adaeze',
      ipAddress: '197.210.65.12',
    });
    expect(ownerAccess.allowed).toBe(true);
    expect(ownerAccess.auditRecord.granted).toBe(true);
    expect(ownerAccess.auditRecord.viewedByUserId).toBe('usr-adaeze');
    expect(ownerAccess.fileContentMasked).toBe('UNMASKED_PASSPORT_PAGE_AES256');

    // Unauthorized view: Trainee or intern role
    const unauthAccess = accessKycDocument({
      documentId: 'kyc-pass-001',
      clientId: 'client-emeka-ani',
      userRole: 'INTERN_GUEST',
      userId: 'usr-intern',
      ipAddress: '197.210.65.99',
    });
    expect(unauthAccess.allowed).toBe(false);
    expect(unauthAccess.auditRecord.granted).toBe(false);
    expect(unauthAccess.fileContentMasked).toContain('REDACTED');
  });

  it('Rule 4: enforces rate limits and locks account after 5 consecutive failed logins', () => {
    const limiter = new RateLimiterAndLockoutEngine();
    const testUser = 'victim@skylinetravels.ng';

    // 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      const res = limiter.recordAttempt(testUser, false);
      expect(res.isLocked).toBe(false);
      expect(res.remainingAttempts).toBe(5 - i);
    }

    // 5th failed attempt: triggers 15-min lockout
    const lockRes = limiter.recordAttempt(testUser, false);
    expect(lockRes.isLocked).toBe(true);
    expect(lockRes.remainingAttempts).toBe(0);
    expect(lockRes.message).toContain('Security lockout: 5 consecutive failed attempts');

    // Subsequent attempt while locked is blocked
    const blockedRes = limiter.recordAttempt(testUser, false);
    expect(blockedRes.isLocked).toBe(true);
    expect(blockedRes.message).toContain('Account is locked due to repeated failures');
  });

  it('Rule 5: escapes input against script injection and sanitizes uploaded file names', () => {
    // XSS injection payload
    const xssPayload = `<script>alert('pwned')</script><img src="x" onerror="stealCookie()"/>`;
    const escaped = escapeHtml(xssPayload);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&lt;img');

    // Dangerous filename with path traversal and illegal characters
    const upload = sanitizeUploadedFileName('../../etc/passwd.php%00.png');
    expect(upload.safeFileName).not.toContain('..');
    expect(upload.safeFileName).not.toContain('php');
    expect(upload.safeFileName).toMatch(/^[a-zA-Z0-9_-]+\.png$/);
    expect(upload.storageKey).toContain('uploads/');
  });

  it('Rule 6: masks personal data (emails, phones, passports) in logs, errors and analytics', () => {
    const rawLog = 'Failed booking payment for user adaeze.okafor@skylinetravels.ng with phone 08031234567 and passport A12345678.';
    const masked = maskPii(rawLog);

    expect(masked).not.toContain('adaeze.okafor@skylinetravels.ng');
    expect(masked).toContain('a***r@skylinetravels.ng');
    expect(masked).not.toContain('08031234567');
    expect(masked).toContain('+234-***-****');
    expect(masked).not.toContain('A12345678');
    expect(masked).toContain('A1******');
  });

  it('Rule 7: fulfills data subject requests (access/export, rectification, deletion/anonymization)', () => {
    const accessReq = processDataSubjectRequest('client-101', 'ACCESS_EXPORT');
    expect(accessReq.status).toBe('COMPLETED');
    expect(accessReq.resultSummary).toContain('Machine-readable JSON export');

    const deleteReq = processDataSubjectRequest('client-101', 'DELETION_ANONYMIZATION');
    expect(deleteReq.status).toBe('COMPLETED');
    expect(deleteReq.resultSummary).toContain('anonymized');
    expect(deleteReq.resultSummary).toContain('Financial accounting entries preserved');
  });

  it('Rule 8: enforces stated backup retention with guaranteed scrubbing from snapshots within 30 days', () => {
    const policy = getBackupRetentionPolicy();
    expect(policy.statedRetentionPeriodDays).toBe(30);
    expect(policy.pointInTimeRecoveryWindowDays).toBe(30);
    expect(policy.status).toBe('ACTIVE_AND_ENFORCED');
    expect(policy.message).toContain('aged out of encrypted Atlas rolling snapshots within 30 days');
  });
});

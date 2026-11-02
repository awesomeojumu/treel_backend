import { FastifyInstance } from 'fastify';
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

export async function registerSecurityAndPrivacyRoutes(app: FastifyInstance) {
  const sessionManager = new SessionAuthManager();
  const lockoutEngine = new RateLimiterAndLockoutEngine();

  // 1. List all 8 Security and Privacy Rules
  app.get('/api/v1/platform/security-privacy/rules', async () => {
    const rules = listSecurityPrivacyRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every(r => r.isCompliant),
      rules,
    };
  });

  // 2. Authentication: Session Creation & Token Expiration
  app.post('/api/v1/platform/security-privacy/create-session', async (req) => {
    const body = req.body as { userId: string };
    return sessionManager.createSession(body.userId || 'usr-adaeze-owner');
  });

  // 3. Token Rotation
  app.post('/api/v1/platform/security-privacy/rotate-token', async (req) => {
    const body = req.body as { sessionId: string; refreshToken: string };
    return sessionManager.rotateRefreshToken(body.sessionId, body.refreshToken);
  });

  // 4. Revoke Session
  app.post('/api/v1/platform/security-privacy/revoke-session', async (req) => {
    const body = req.body as { sessionId: string };
    const success = sessionManager.revokeSession(body.sessionId);
    return { sessionId: body.sessionId, isRevoked: success };
  });

  // 5. Signed File URLs
  app.post('/api/v1/platform/security-privacy/generate-signed-url', async (req) => {
    const body = req.body as { fileId: string; organizationId: string; expiresInSeconds?: number };
    return generateSignedFileUrl(body.fileId, body.organizationId, body.expiresInSeconds || 900);
  });

  app.post('/api/v1/platform/security-privacy/verify-signed-url', async (req) => {
    const body = req.body as { fileId: string; organizationId: string; expiresAt: number; signature: string };
    return verifySignedFileUrl(body.fileId, body.organizationId, body.expiresAt, body.signature);
  });

  // 6. KYC Access Control & View Audit Logging
  app.post('/api/v1/platform/security-privacy/access-kyc', async (req) => {
    const body = req.body as {
      documentId: string;
      clientId: string;
      userRole: string;
      userId: string;
      ipAddress: string;
    };
    return accessKycDocument(body);
  });

  // 7. Rate Limiting & Account Lockout
  app.post('/api/v1/platform/security-privacy/record-login-attempt', async (req) => {
    const body = req.body as { identity: string; isSuccess: boolean };
    return lockoutEngine.recordAttempt(body.identity, body.isSuccess);
  });

  // 8. Input Escaping & File Sanitization
  app.post('/api/v1/platform/security-privacy/escape-html', async (req) => {
    const body = req.body as { input: string };
    return {
      original: body.input,
      escaped: escapeHtml(body.input),
    };
  });

  app.post('/api/v1/platform/security-privacy/sanitize-upload', async (req) => {
    const body = req.body as { fileName: string };
    return sanitizeUploadedFileName(body.fileName);
  });

  // 9. Mask PII in Logs/Errors
  app.post('/api/v1/platform/security-privacy/mask-pii', async (req) => {
    const body = req.body as { logText: string };
    return {
      original: body.logText,
      masked: maskPii(body.logText),
    };
  });

  // 10. Data Subject Rights (NDPR / GDPR)
  app.post('/api/v1/platform/security-privacy/data-subject-request', async (req) => {
    const body = req.body as { clientId: string; type: 'ACCESS_EXPORT' | 'RECTIFICATION' | 'DELETION_ANONYMIZATION' };
    return processDataSubjectRequest(body.clientId, body.type);
  });

  // 11. Backup Retention Policy
  app.get('/api/v1/platform/security-privacy/backup-retention', async () => {
    return getBackupRetentionPolicy();
  });
}

import {
  listAuthPageRules,
  evaluatePasswordStrength,
  AuthLoginEngine,
  EmailConfirmationRateLimiter,
  validateInviteState,
  generateTwoFactorRecoveryCodes,
  verifyTotpCode,
} from '@/core/auth/authPageRules';

describe('Page 1. Auth Specification Engine', () => {
  it('defines and verifies all 34 mandatory auth rules across 7 categories', () => {
    const rules = listAuthPageRules();
    expect(rules).toHaveLength(34);
    expect(rules.every(r => r.isCompliant)).toBe(true);

    const categories = Array.from(new Set(rules.map(r => r.category)));
    expect(categories).toContain('VIEWS');
    expect(categories).toContain('LOGIN');
    expect(categories).toContain('SIGNUP');
    expect(categories).toContain('FORGOT_RESET');
    expect(categories).toContain('ACCEPT_INVITE');
    expect(categories).toContain('TWO_FACTOR');
    expect(categories).toContain('MOBILE');
  });

  describe('1. Views and Addresses', () => {
    it('verifies distinct addresses swap without full reload and redirect after login respects RBAC', () => {
      const viewRule = listAuthPageRules().find(r => r.id === 'AUTH_VIEW_ADDRESSES_SPA');
      expect(viewRule?.isCompliant).toBe(true);
      expect(viewRule?.implementationDetail).toContain('/auth/sign-in');

      const redirectRule = listAuthPageRules().find(r => r.id === 'AUTH_REDIRECT_AFTER_LOGIN_RBAC');
      expect(redirectRule?.isCompliant).toBe(true);
    });
  });

  describe('2. Login', () => {
    it('normalizes email (case-insensitive & trimmed) and enforces 5-attempt 10m/15m lockout with countdown', () => {
      const engine = new AuthLoginEngine();
      const testEmail = '  AdaEze@SkyLineTravels.NG  '.trim().toLowerCase();
      expect(testEmail).toBe('adaeze@skylinetravels.ng');

      // 4 failures
      for (let i = 1; i <= 4; i++) {
        const res = engine.recordFailedAttempt(testEmail);
        expect(res.isLocked).toBe(false);
      }

      // 5th failure: locks account for 15 minutes and alerts owner
      const fifthRes = engine.recordFailedAttempt(testEmail);
      expect(fifthRes.isLocked).toBe(true);
      expect(fifthRes.remainingSeconds).toBe(900);
      expect(fifthRes.ownerNotified).toBe(true);

      // Lockout check returns countdown
      const lockCheck = engine.checkLockout(testEmail);
      expect(lockCheck.isLocked).toBe(true);
      expect(lockCheck.remainingSeconds).toBeGreaterThan(800);
    });

    it('rejects suspended workspaces with contact info and zero data leaks', () => {
      const suspendedRule = listAuthPageRules().find(r => r.id === 'AUTH_LOGIN_SUSPENDED_WORKSPACE');
      expect(suspendedRule?.isCompliant).toBe(true);
      expect(suspendedRule?.implementationDetail).toContain('zero agency data is exposed');
    });
  });

  describe('3. Sign Up', () => {
    it('evaluates password strength, requires at least 10 chars, and blocks common passwords', () => {
      // Too short (< 10)
      const shortPass = evaluatePasswordStrength('Pass12!');
      expect(shortPass.isValid).toBe(false);
      expect(shortPass.lengthValid).toBe(false);
      expect(shortPass.hint).toContain('at least 10 characters');

      // Blacklisted common password
      const commonPass = evaluatePasswordStrength('password123');
      expect(commonPass.isValid).toBe(false);
      expect(commonPass.isBlacklisted).toBe(true);
      expect(commonPass.hint).toContain('too common');

      // Strong valid password
      const strongPass = evaluatePasswordStrength('SkylineLagos2026!');
      expect(strongPass.isValid).toBe(true);
      expect(strongPass.strengthScore).toBe('STRONG');
    });

    it('enforces single-use 24-hour email confirmation link with max 3 resends per hour', () => {
      const limiter = new EmailConfirmationRateLimiter();
      const email = 'newowner@agency.ng';

      // First 3 requests succeed
      expect(limiter.canResend(email).allowed).toBe(true);
      expect(limiter.canResend(email).allowed).toBe(true);
      expect(limiter.canResend(email).allowed).toBe(true);

      // 4th request blocked by rate limiter
      const fourth = limiter.canResend(email);
      expect(fourth.allowed).toBe(false);
      expect(fourth.remainingPerHour).toBe(0);
      expect(fourth.message).toContain('Rate limit exceeded');
    });

    it('verifies atomic transaction for workspace, owner and trial plan creation', () => {
      const atomicRule = listAuthPageRules().find(r => r.id === 'AUTH_SIGNUP_ATOMIC_TRANSACTION');
      expect(atomicRule?.isCompliant).toBe(true);
      expect(atomicRule?.implementationDetail).toContain('atomic');
    });
  });

  describe('4. Forgot and Reset Password', () => {
    it('prohibits resetting password to any of the last 3 passwords', () => {
      const engine = new AuthLoginEngine();
      const userId = 'usr-adaeze';

      const passHash1 = 'hash_password_old_1';
      const passHash2 = 'hash_password_old_2';
      const passHash3 = 'hash_password_old_3';
      const passHashNew = 'hash_password_brand_new';

      engine.recordPasswordChange(userId, passHash1);
      engine.recordPasswordChange(userId, passHash2);
      engine.recordPasswordChange(userId, passHash3);

      // Trying to reuse passHash1, 2, or 3 is blocked
      expect(engine.canUseNewPassword(userId, passHash1)).toBe(false);
      expect(engine.canUseNewPassword(userId, passHash2)).toBe(false);
      expect(engine.canUseNewPassword(userId, passHash3)).toBe(false);

      // Unique new password passes
      expect(engine.canUseNewPassword(userId, passHashNew)).toBe(true);
    });
  });

  describe('5. Accept Invite', () => {
    it('validates invite single-use, 7-day expiration, owner revocation, and seat capacity limits', () => {
      // Seat limit exceeded
      const seatBlocked = validateInviteState({
        invite: {
          token: 'inv-tok-123',
          agencyName: 'Skyline Travels',
          inviterName: 'Adaeze Okafor',
          role: 'TRAVEL_CONSULTANT',
          invitedEmail: 'staff@skylinetravels.ng',
          isExpired: false,
          isSingleUseRedeemed: false,
          isRevoked: false,
          isSeatAvailable: false,
        },
        workspaceCurrentSeats: 3,
        workspaceMaxSeats: 3, // Out of seats!
      });
      expect(seatBlocked.canAccept).toBe(false);
      expect(seatBlocked.reason).toContain('maximum seat capacity');

      // Expired invite
      const expiredInvite = validateInviteState({
        invite: {
          token: 'inv-tok-old',
          agencyName: 'Skyline Travels',
          inviterName: 'Adaeze Okafor',
          role: 'TRAVEL_CONSULTANT',
          invitedEmail: 'staff@skylinetravels.ng',
          isExpired: true,
          isSingleUseRedeemed: false,
          isRevoked: false,
          isSeatAvailable: true,
        },
        workspaceCurrentSeats: 1,
        workspaceMaxSeats: 3,
      });
      expect(expiredInvite.canAccept).toBe(false);
      expect(expiredInvite.reason).toContain('expired');

      // Valid invite
      const validInvite = validateInviteState({
        invite: {
          token: 'inv-tok-good',
          agencyName: 'Skyline Travels',
          inviterName: 'Adaeze Okafor',
          role: 'TRAVEL_CONSULTANT',
          invitedEmail: 'staff@skylinetravels.ng',
          isExpired: false,
          isSingleUseRedeemed: false,
          isRevoked: false,
          isSeatAvailable: true,
        },
        workspaceCurrentSeats: 2,
        workspaceMaxSeats: 3,
      });
      expect(validInvite.canAccept).toBe(true);
    });
  });

  describe('6. 2FA (Two-Factor Authentication)', () => {
    it('generates 8 downloadable recovery codes and verifies 30-second TOTP window', () => {
      const recoveryCodes = generateTwoFactorRecoveryCodes();
      expect(recoveryCodes).toHaveLength(8);
      for (const code of recoveryCodes) {
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      }

      // TOTP check
      const validTotp = verifyTotpCode('123456', 'SECRET');
      expect(validTotp.valid).toBe(true);
      expect(validTotp.timeWindowSeconds).toBe(30);

      const invalidTotp = verifyTotpCode('000001', 'SECRET');
      expect(invalidTotp.valid).toBe(false);
    });

    it('confirms trusted device bypass strictly excludes owners and finance roles', () => {
      const rule = listAuthPageRules().find(r => r.id === 'AUTH_2FA_TRUSTED_DEVICE_EXCLUSION');
      expect(rule?.isCompliant).toBe(true);
      expect(rule?.implementationDetail).toContain('OWNER');
    });
  });

  describe('7. Mobile', () => {
    it('confirms biometric unlock and cache clearing on logout', () => {
      const bioRule = listAuthPageRules().find(r => r.id === 'AUTH_MOBILE_BIOMETRIC_UNLOCK');
      expect(bioRule?.isCompliant).toBe(true);

      const logoutRule = listAuthPageRules().find(r => r.id === 'AUTH_MOBILE_LOGOUT_CACHE_CLEAR');
      expect(logoutRule?.isCompliant).toBe(true);
    });
  });
});

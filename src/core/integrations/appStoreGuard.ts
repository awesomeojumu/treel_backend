export type ClientPlatform = 'WEB' | 'MOBILE';

export class AppStoreComplianceGuard {
  /**
   * Section 13: Store rules built in:
   * 1. No plan, price or payment prompt anywhere in the mobile app (Apple Guideline 3.1.1).
   * 2. Sign-in only to an existing workspace on mobile (no public workspace creation / registration).
   * 3. In-app account deletion must be supported on mobile.
   */
  public static assertRouteAllowed(
    platform: ClientPlatform,
    path: string,
    method = 'GET'
  ): void {
    if (platform !== 'MOBILE') {
      return;
    }

    const cleanPath = path.toLowerCase();

    // Rule 1: No billing / plan upgrade prompts on mobile
    if (
      cleanPath.includes('/billing') ||
      cleanPath.includes('/subscribe') ||
      cleanPath.includes('/plans') ||
      cleanPath.includes('/upgrade')
    ) {
      throw new Error(
        'MOBILE_STORE_POLICY_VIOLATION: Subscription billing and plan upgrades are strictly web-only per Apple App Store and Google Play business services guidelines.'
      );
    }

    // Rule 2: Sign-in only on mobile (no workspace setup / sign up)
    if (
      cleanPath.includes('/auth/sign-up') ||
      cleanPath.includes('/setup')
    ) {
      throw new Error(
        'MOBILE_STORE_POLICY_VIOLATION: New workspace creation must be completed on desktop web. Mobile app is reserved for staff signing in to an existing agency.'
      );
    }
  }

  /**
   * Rule 3: Account deletion is compliant and allowed on mobile
   */
  public static isAccountDeletionAllowedOnMobile(): boolean {
    return true; // Apple requires in-app account deletion capability
  }
}

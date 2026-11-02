import {
  SubscriptionBillingEngine,
  WorkspaceSubscriptionState,
  PLANEXI_VAT_REGISTRATION,
  SUPPORTED_NIGERIAN_DIRECT_DEBIT_BANKS,
} from '@/core/integrations/subscriptionBilling';
import {
  TransactionalEmailService,
  ExpoPushService,
  MultiProviderSMSWithFallback,
} from '@/core/integrations/channels';
import { DataImportEngine } from '@/core/integrations/dataImport';
import { AppStoreComplianceGuard } from '@/core/integrations/appStoreGuard';

describe('Section 13: Integrations & Delivery Mechanisms', () => {
  describe('1. Paystack Subscription Billing & 7.5% VAT', () => {
    it('calculates subscription invoice with 7.5% VAT added and Planexi VAT ID', () => {
      // Growth plan is ₦65,000.00 / month (6,500,000 kobo)
      const invoice = SubscriptionBillingEngine.calculateInvoice(
        'org_skyline_lagos',
        'GROWTH',
        'MONTHLY'
      );

      expect(invoice.amountNetKobo).toBe(6500000);
      expect(invoice.vatRatePercent).toBe(7.5);
      // 7.5% of 65,000 is 4,875 (487,500 kobo)
      expect(invoice.amountVatKobo).toBe(487500);
      expect(invoice.amountGrossKobo).toBe(6987500);
      expect(invoice.formattedNet).toBe('₦65,000.00');
      expect(invoice.formattedVat).toBe('₦4,875.00');
      expect(invoice.formattedGross).toBe('₦69,875.00');
      expect(invoice.planexiVatNumber).toBe(PLANEXI_VAT_REGISTRATION);
      expect(invoice.planexiVatNumber).toBe('VAT-PLANEXI-2026-NG');
    });

    it('verifies 24 Nigerian direct-debit banks and enforces card fallback for unsupported banks', () => {
      expect(SUPPORTED_NIGERIAN_DIRECT_DEBIT_BANKS.length).toBe(24);

      // Zenith Bank code 057
      expect(SubscriptionBillingEngine.isBankSupportedForDirectDebit('057')).toBe(true);
      // GTBank code 058
      expect(SubscriptionBillingEngine.isBankSupportedForDirectDebit('058')).toBe(true);

      const mandate = SubscriptionBillingEngine.initiateDirectDebitMandate(
        'org_skyline_lagos',
        '057',
        '1002938475'
      );
      expect(mandate.status).toBe('PENDING');
      expect(mandate.bankName).toBe('Zenith Bank');
      expect(mandate.accountNumberMasked).toBe('******8475');
      expect(mandate.validationDebitRefunded).toBe(true); // ₦50 validation refunded

      // Unsupported foreign or invalid bank code throws card fallback error
      expect(() =>
        SubscriptionBillingEngine.initiateDirectDebitMandate(
          'org_skyline_lagos',
          '999',
          '9999999999'
        )
      ).toThrow(/Please use card fallback/);
    });
  });

  describe('2. Failed Payment 5-Stage Lifecycle Sequence', () => {
    const initialState: WorkspaceSubscriptionState = {
      organizationId: 'org_skyline_lagos',
      planId: 'GROWTH',
      status: 'ACTIVE',
      activeSeats: 6,
      maxSeats: 20,
    };

    it('manages lifecycle across Day 0 reminder, Day 1-7 grace, Day 8 read-only, and Day 30 suspension', () => {
      // Day 0: Reminder email & push
      const stage1 = SubscriptionBillingEngine.evaluateFailedPaymentStage(initialState, 0);
      expect(stage1.status).toBe('ACTIVE');
      expect(stage1.failedPaymentStage).toBe(1);
      expect(() => SubscriptionBillingEngine.assertWorkspaceWritable(stage1)).not.toThrow();

      // Day 3 (within 7-day grace period): Status is GRACE_PERIOD, still writable
      const stage2 = SubscriptionBillingEngine.evaluateFailedPaymentStage(initialState, 3);
      expect(stage2.status).toBe('GRACE_PERIOD');
      expect(stage2.failedPaymentStage).toBe(2);
      expect(() => SubscriptionBillingEngine.assertWorkspaceWritable(stage2)).not.toThrow();

      // Day 8: Read-only begins; data visible & exportable, but mutations blocked
      const stage3 = SubscriptionBillingEngine.evaluateFailedPaymentStage(initialState, 8);
      expect(stage3.status).toBe('READ_ONLY');
      expect(stage3.failedPaymentStage).toBe(3);
      expect(() => SubscriptionBillingEngine.assertWorkspaceWritable(stage3)).toThrow(
        /SUBSCRIPTION_READ_ONLY/
      );

      // Day 30: Workspace suspended
      const stage4 = SubscriptionBillingEngine.evaluateFailedPaymentStage(initialState, 30);
      expect(stage4.status).toBe('SUSPENDED');
      expect(stage4.failedPaymentStage).toBe(4);
      expect(() => SubscriptionBillingEngine.assertWorkspaceWritable(stage4)).toThrow(
        /SUBSCRIPTION_SUSPENDED/
      );

      // Instant reactivation on payment
      const reactivated = SubscriptionBillingEngine.handlePaymentSuccess(stage4);
      expect(reactivated.status).toBe('ACTIVE');
      expect(reactivated.failedPaymentStage).toBeUndefined();
      expect(() => SubscriptionBillingEngine.assertWorkspaceWritable(reactivated)).not.toThrow();
    });
  });

  describe('3. Communication Channels (Email, Push, SMS Fallback)', () => {
    it('formats 72-hour invite email and dispatches transactional mail', async () => {
      const invite = TransactionalEmailService.formatInviteEmail(
        'Skylink Travels',
        'https://app.travelreel.ng/auth/accept?token=inv_99'
      );
      invite.to = 'agent@skylink.ng';

      expect(invite.subject).toContain('Skylink Travels');
      expect(invite.htmlContent).toContain('Valid for 72 hours');

      const result = await TransactionalEmailService.send(invite);
      expect(result.success).toBe(true);
      expect(result.channel).toBe('EMAIL');
    });

    it('validates Expo Push tokens and dispatches notifications', async () => {
      expect(ExpoPushService.isValidToken('ExponentPushToken[Abc123_xyz-99]')).toBe(true);
      expect(ExpoPushService.isValidToken('invalid_token_format')).toBe(false);

      const pushRes = await ExpoPushService.send({
        toToken: 'ExponentPushToken[Abc123_xyz-99]',
        title: 'New lead assigned',
        body: 'Alhaji Musa has requested a Dubai quote.',
      });
      expect(pushRes.success).toBe(true);
      expect(pushRes.channel).toBe('PUSH');
    });

    it('falls back from Termii to Africa\'s Talking automatically when primary fails', async () => {
      const sms = new MultiProviderSMSWithFallback('mock_termii_key', 'mock_africastalking_key');

      // Primary provider succeeds
      const resPrimary = await sms.sendSMS('0803 123 4567', 'Booking confirmed', false);
      expect(resPrimary.provider).toContain('Termii');
      expect(resPrimary.fallbackUsed).toBe(false);

      // Fallback triggers when primary fails
      const resFallback = await sms.sendSMS('0803 123 4567', 'Booking confirmed', true);
      expect(resFallback.provider).toContain("Africa's Talking");
      expect(resFallback.fallbackUsed).toBe(true);
    });
  });

  describe('4. Data Import Engine (3-Step Wizard with 24-Hour Undo)', () => {
    it('Step 1: Suggests canonical column mappings from raw user spreadsheets', () => {
      const rawHeaders = ['Full Name', 'Mobile Number', 'Email Address', 'Intl Passport'];
      const mapping = DataImportEngine.suggestMapping(rawHeaders, 'clients');

      expect(mapping.find((m) => m.rawHeader === 'Full Name')?.targetField).toBe('name');
      expect(mapping.find((m) => m.rawHeader === 'Mobile Number')?.targetField).toBe('phone');
      expect(mapping.find((m) => m.rawHeader === 'Email Address')?.targetField).toBe('email');
      expect(mapping.find((m) => m.rawHeader === 'Intl Passport')?.targetField).toBe('passportNumber');
    });

    it('Step 2: Validates data, normalizes phones, and flags duplicates prior to database write', () => {
      const existingInDb = new Set(['+2348011112222']);

      const rows = [
        { name: 'Kunle Adebayo', phone: '0802 345 6789', email: 'kunle@lagos.ng' },
        { name: 'Duplicate Client', phone: '0801 111 2222', email: 'dup@lagos.ng' }, // In DB
        { name: 'Missing Phone', phone: '', email: 'no_phone@test.ng' }, // Invalid
        { name: 'Invalid Phone Number', phone: '12345', email: 'bad_phone@test.ng' }, // Bad phone
      ];

      const preview = DataImportEngine.validateAndPreview(rows, 'clients', existingInDb);
      expect(preview.totalRows).toBe(4);
      expect(preview.validRowCount).toBe(1);
      expect(preview.invalidRowCount).toBe(3);
      expect(preview.duplicatesCount).toBe(1);
      expect(preview.validRecords[0]!.name).toBe('Kunle Adebayo');
      expect(preview.validRecords[0]!.phone).toBe('+2348023456789');
    });

    it('Step 3: Atomically imports batch and allows undo within 24 hours, rejecting expired undos', () => {
      const orgId = 'org_lagos_agency';
      const importTime = new Date('2026-11-01T10:00:00.000Z');

      const batch = DataImportEngine.executeBatchImport(
        orgId,
        'clients',
        [{ name: 'Amaka Eze', phone: '+2348039998877' }],
        'usr_owner',
        importTime
      );

      expect(batch.importBatchId).toMatch(/^IMP_/);
      expect(batch.status).toBe('ACTIVE');

      // Attempt undo at 12 hours (within 24-hour window) -> succeeds
      const requestedAt12Hours = new Date('2026-11-01T22:00:00.000Z');
      const undoRes = DataImportEngine.undoBatch(orgId, batch.importBatchId, requestedAt12Hours);
      expect(undoRes.undone).toBe(true);
      expect(undoRes.recordCount).toBe(1);

      // Create a second batch to test expiration
      const batch2 = DataImportEngine.executeBatchImport(
        orgId,
        'clients',
        [{ name: 'Femi Otedola', phone: '+2348050001111' }],
        'usr_owner',
        importTime
      );

      // Attempt undo at 25 hours (after 24-hour window) -> must throw
      const requestedAt25Hours = new Date('2026-11-02T11:05:00.000Z');
      expect(() =>
        DataImportEngine.undoBatch(orgId, batch2.importBatchId, requestedAt25Hours)
      ).toThrow(/IMPORT_UNDO_EXPIRED_WINDOW/);
    });
  });

  describe('5. App Store Readiness & Policy Rules', () => {
    it('blocks billing and plan prompts on mobile while allowing desktop web', () => {
      // Desktop web is fully allowed
      expect(() =>
        AppStoreComplianceGuard.assertRouteAllowed('WEB', '/settings/billing')
      ).not.toThrow();

      // Mobile app store policy rule: No billing / plan upgrade prompts
      expect(() =>
        AppStoreComplianceGuard.assertRouteAllowed('MOBILE', '/settings/billing')
      ).toThrow(/MOBILE_STORE_POLICY_VIOLATION/);

      expect(() =>
        AppStoreComplianceGuard.assertRouteAllowed('MOBILE', '/plans/upgrade')
      ).toThrow(/MOBILE_STORE_POLICY_VIOLATION/);
    });

    it('blocks workspace sign-up on mobile (sign-in only) and requires in-app account deletion', () => {
      // Sign-up is blocked on mobile
      expect(() =>
        AppStoreComplianceGuard.assertRouteAllowed('MOBILE', '/auth/sign-up')
      ).toThrow(/MOBILE_STORE_POLICY_VIOLATION/);

      // Account deletion is compliant on mobile
      expect(AppStoreComplianceGuard.isAccountDeletionAllowedOnMobile()).toBe(true);
    });
  });
});

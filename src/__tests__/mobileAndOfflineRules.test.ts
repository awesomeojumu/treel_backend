import {
  listMobileOfflineRules,
  validateViewportLayout,
  validateTapTarget,
  calculateKeyboardLayout,
  getKeypadConfigForField,
  OfflineQueueEngine,
  verifyDraftPersistence,
  evaluatePushPermissionState,
  getPageRefreshConfiguration,
  evaluateRouteMobileCompatibility,
} from '@/core/platform/mobileAndOfflineRules';

describe('Section 10 & Mobile Specification: Mobile, Responsive & Offline-First Rules', () => {
  it('defines and verifies all 10 mandatory mobile and offline rules', () => {
    const rules = listMobileOfflineRules();
    expect(rules).toHaveLength(10);
    expect(rules.every(r => r.isCompliant)).toBe(true);

    const ids = rules.map(r => r.id);
    expect(ids).toContain('MOBILE_LAYOUT_360_TO_DESKTOP');
    expect(ids).toContain('MOBILE_ONE_HANDED_AND_TAP_TARGETS');
    expect(ids).toContain('MOBILE_KEYBOARD_SCROLL_PADDING');
    expect(ids).toContain('MOBILE_KEYPAD_SPECIALIZATION');
    expect(ids).toContain('OFFLINE_FIFO_QUEUE_DEDUPLICATION');
    expect(ids).toContain('OFFLINE_CONFLICT_MONEY_PROTECTION');
    expect(ids).toContain('PERSISTENCE_LIFECYCLE_PROTECTION');
    expect(ids).toContain('PUSH_DENIED_FALLBACK_INBOX');
    expect(ids).toContain('PULL_TO_REFRESH_AND_LIVE_REFRESH');
    expect(ids).toContain('WEB_ONLY_GRACEFUL_HANDOFF');
  });

  it('Rule 1: validates responsive web layouts from 360 px wide to 4K desktop with zero horizontal scroll or button cutoff', () => {
    // 360px mobile viewport (small phone)
    const mobileCheck = validateViewportLayout({
      viewportWidth: 360,
      contentWidth: 360,
      hasHorizontalScrollbar: false,
      buttonClippingDetected: false,
    });
    expect(mobileCheck.valid).toBe(true);

    // 1440px desktop viewport
    const desktopCheck = validateViewportLayout({
      viewportWidth: 1440,
      contentWidth: 1200,
      hasHorizontalScrollbar: false,
      buttonClippingDetected: false,
    });
    expect(desktopCheck.valid).toBe(true);

    // Failing case: sideways scroll detected
    const invalidScroll = validateViewportLayout({
      viewportWidth: 360,
      contentWidth: 420,
      hasHorizontalScrollbar: true,
      buttonClippingDetected: false,
    });
    expect(invalidScroll.valid).toBe(false);
    expect(invalidScroll.statusMessage).toContain('sideways scroll detected');

    // Failing case: button cutoff detected
    const invalidButton = validateViewportLayout({
      viewportWidth: 360,
      contentWidth: 360,
      hasHorizontalScrollbar: false,
      buttonClippingDetected: true,
    });
    expect(invalidButton.valid).toBe(false);
    expect(invalidButton.statusMessage).toContain('button cutoff detected');
  });

  it('Rule 2: enforces one-handed reach with >= 44 px tap targets and primary actions in thumb zone', () => {
    // Compliant 44px button in thumb zone
    const validBtn = validateTapTarget({
      targetId: 'btn-save-booking',
      widthPx: 120,
      heightPx: 48,
      isInThumbZone: true,
      isPrimaryAction: true,
    });
    expect(validBtn.isCompliant).toBe(true);
    expect(validBtn.meetsMinDimensions).toBe(true);

    // Non-compliant: tap target too small (e.g. 24x24 icon button)
    const smallBtn = validateTapTarget({
      targetId: 'btn-small-icon',
      widthPx: 32,
      heightPx: 32,
      isInThumbZone: true,
      isPrimaryAction: false,
    });
    expect(smallBtn.isCompliant).toBe(false);
    expect(smallBtn.meetsMinDimensions).toBe(false);

    // Non-compliant: primary action placed in top unreachable zone on mobile
    const unreachableAction = validateTapTarget({
      targetId: 'btn-header-submit',
      widthPx: 100,
      heightPx: 44,
      isInThumbZone: false,
      isPrimaryAction: true,
    });
    expect(unreachableAction.isCompliant).toBe(false);
  });

  it('Rule 3: handles virtual keyboard without obscuring the active field or the Save button', () => {
    // 667px device, 300px keyboard, active input at Y: 420px (height 44px)
    const kb = calculateKeyboardLayout({
      viewportHeight: 667,
      keyboardHeight: 300,
      activeInputTop: 420,
      activeInputHeight: 44,
      saveButtonPinnedBottom: true,
    });

    expect(kb.visibleViewportHeight).toBe(367);
    expect(kb.isInputObscured).toBe(true);
    expect(kb.scrollOffsetNeeded).toBeGreaterThan(0);
    expect(kb.saveButtonVisible).toBe(true);
  });

  it('Rule 4: configures specialized keypads (number, email, phone dial pad, decimal money)', () => {
    const numCfg = getKeypadConfigForField('nin', 'number');
    expect(numCfg.inputMode).toBe('numeric');
    expect(numCfg.expectedKeypad).toBe('NUMBER_KEYPAD');
    expect(numCfg.pattern).toBe('[0-9]*');

    const moneyCfg = getKeypadConfigForField('fareAmount', 'money');
    expect(moneyCfg.inputMode).toBe('decimal');
    expect(moneyCfg.expectedKeypad).toBe('DECIMAL_KEYPAD');

    const emailCfg = getKeypadConfigForField('email', 'email');
    expect(emailCfg.inputMode).toBe('email');
    expect(emailCfg.htmlType).toBe('email');
    expect(emailCfg.expectedKeypad).toBe('EMAIL_KEYPAD');

    const phoneCfg = getKeypadConfigForField('phone', 'phone');
    expect(phoneCfg.inputMode).toBe('tel');
    expect(phoneCfg.htmlType).toBe('tel');
    expect(phoneCfg.expectedKeypad).toBe('DIAL_PAD');
  });

  it('Rule 5 & 6: queues offline actions with "Waiting to send", preserves chronological FIFO order, deduplicates, and refuses to silently overwrite money entries', () => {
    const engine = new OfflineQueueEngine();

    // Enqueue 3 offline actions
    engine.enqueue({
      actionId: 'act-001',
      sequenceNumber: 1,
      idempotencyKey: 'idemp-lead-create',
      entityType: 'LEAD',
      entityId: 'lead-101',
      baseVersion: 1,
      payload: { name: 'Chukwuma Obi' },
      isMoneyEntry: false,
    });

    engine.enqueue({
      actionId: 'act-002',
      sequenceNumber: 2,
      idempotencyKey: 'idemp-payment-record',
      entityType: 'PAYMENT',
      entityId: 'pay-202',
      baseVersion: 1,
      payload: { amountKobo: 50000000 },
      isMoneyEntry: true, // Financial entry
    });

    engine.enqueue({
      actionId: 'act-003',
      sequenceNumber: 3,
      idempotencyKey: 'idemp-note-add',
      entityType: 'LEAD_NOTE',
      entityId: 'lead-101',
      baseVersion: 1,
      payload: { note: 'Client requested business class' },
      isMoneyEntry: false,
    });

    const pending = engine.getPendingQueue();
    expect(pending).toHaveLength(3);
    expect(pending[0].status).toBe('WAITING_TO_SEND');
    expect(pending[0].sequenceNumber).toBe(1);

    // Mock server state where payment pay-202 was updated concurrently on Atlas
    const serverStateLookup = (entityId: string) => {
      if (entityId === 'pay-202') {
        return { version: 2, lastUpdatedBy: 'owner@skylinetravels.ng', currentValue: { amountKobo: 45000000 } };
      }
      return { version: 1, lastUpdatedBy: 'system', currentValue: {} };
    };

    const syncRun1 = engine.processReconnectQueue(serverStateLookup);

    // Rule 5: items processed
    expect(syncRun1.processedCount).toBe(3);

    // Rule 6: act-002 is a money entry with concurrent version jump: MUST NEVER BE SILENTLY OVERWRITTEN
    const moneyResult = syncRun1.results.find(r => r.actionId === 'act-002');
    expect(moneyResult?.status).toBe('CONFLICT_MONEY_REJECTED');
    expect(moneyResult?.message).toContain('CRITICAL FINANCIAL SAFETY');
    expect(moneyResult?.message).toContain('Silent overwrite is prohibited');

    // Rule 5: Re-running sync with same idempotency key for act-001 deduplicates
    engine.enqueue({
      actionId: 'act-001-retry',
      sequenceNumber: 4,
      idempotencyKey: 'idemp-lead-create', // Same idempotency key
      entityType: 'LEAD',
      entityId: 'lead-101',
      baseVersion: 1,
      payload: { name: 'Chukwuma Obi' },
      isMoneyEntry: false,
    });

    const syncRun2 = engine.processReconnectQueue(serverStateLookup);
    const dedupResult = syncRun2.results.find(r => r.actionId === 'act-001-retry');
    expect(dedupResult?.status).toBe('DEDUPLICATED');
  });

  it('Rule 7: verifies draft persistence across screen rotation, 1 hour backgrounding, and low battery mode', () => {
    const draftStatus = verifyDraftPersistence({
      draftKey: 'booking_draft_bk_901',
      backgroundedMinutes: 65,
      lowBatteryMode: true,
      orientationChanged: true,
      persistedData: {
        passengerName: 'Amina Bello',
        route: 'LOS-LHR',
        fareKobo: 245000000,
      },
    });

    expect(draftStatus.isDataRetained).toBe(true);
    expect(draftStatus.backgroundedMinutes).toBe(65);
    expect(draftStatus.lowBatteryMode).toBe(true);
    expect(draftStatus.orientationChanged).toBe(true);
  });

  it('Rule 8: push permission denied still leaves the notification Inbox 100% operational', () => {
    const deniedState = evaluatePushPermissionState('denied');
    expect(deniedState.isPushActive).toBe(false);
    expect(deniedState.isInboxActive).toBe(true);
    expect(deniedState.syncStrategy).toBe('IN_APP_REST_AND_SSE_POLLING');
    expect(deniedState.userNotice).toContain('Inbox');

    const grantedState = evaluatePushPermissionState('granted');
    expect(grantedState.isPushActive).toBe(true);
    expect(grantedState.isInboxActive).toBe(true);
  });

  it('Rule 9: pull to refresh supported on lists; automatic refresh configured for live operational pages', () => {
    const listStrategy = getPageRefreshConfiguration('list');
    expect(listStrategy.pullToRefreshSupported).toBe(true);
    expect(listStrategy.autoRefreshIntervalSeconds).toBe(0);

    const liveStrategy = getPageRefreshConfiguration('live_operational');
    expect(liveStrategy.pullToRefreshSupported).toBe(true);
    expect(liveStrategy.autoRefreshIntervalSeconds).toBe(15);
    expect(liveStrategy.liveChannel).toBe('SSE_REALTIME_STREAM');

    const staticStrategy = getPageRefreshConfiguration('static_report');
    expect(staticStrategy.pullToRefreshSupported).toBe(false);
  });

  it('Rule 10: web-only pages show a clear message on mobile viewports (< 768px) and offer to continue on web', () => {
    const mobileAccess = evaluateRouteMobileCompatibility('/reports/annual-financial-audit-matrix', 375);
    expect(mobileAccess.allowedOnMobile).toBe(false);
    expect(mobileAccess.isWebOnly).toBe(true);
    expect(mobileAccess.headline).toBe('Desktop-optimized tool');
    expect(mobileAccess.message).toContain('requires a wide display');
    expect(mobileAccess.actions.map(a => a.actionType)).toContain('COPY_LINK');

    // Desktop viewport (1280px) allows access cleanly
    const desktopAccess = evaluateRouteMobileCompatibility('/reports/annual-financial-audit-matrix', 1280);
    expect(desktopAccess.allowedOnMobile).toBe(true);

    // Normal responsive page on mobile is allowed
    const normalMobileAccess = evaluateRouteMobileCompatibility('/bookings', 375);
    expect(normalMobileAccess.allowedOnMobile).toBe(true);
  });
});

import { FastifyInstance } from 'fastify';
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

export async function registerMobileAndOfflineRoutes(app: FastifyInstance) {
  // Shared in-memory queue engine for testing & demonstration
  const queueEngine = new OfflineQueueEngine();

  // 1. List all 10 Mobile and Offline Rules
  app.get('/api/v1/platform/mobile-offline/rules', async () => {
    const rules = listMobileOfflineRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every(r => r.isCompliant),
      rules,
    };
  });

  // 2. Validate Responsive Viewport Layout (360px to 4K)
  app.post('/api/v1/platform/mobile-offline/validate-layout', async (req) => {
    const body = req.body as {
      viewportWidth: number;
      contentWidth: number;
      hasHorizontalScrollbar: boolean;
      buttonClippingDetected: boolean;
    };
    return validateViewportLayout(body);
  });

  // 3. Validate Tap Target & Thumb Zone Reach
  app.post('/api/v1/platform/mobile-offline/validate-tap-target', async (req) => {
    const body = req.body as {
      targetId: string;
      widthPx: number;
      heightPx: number;
      isInThumbZone: boolean;
      isPrimaryAction: boolean;
    };
    return validateTapTarget(body);
  });

  // 4. Calculate Virtual Keyboard Accommodation
  app.post('/api/v1/platform/mobile-offline/calculate-keyboard', async (req) => {
    const body = req.body as {
      viewportHeight: number;
      keyboardHeight: number;
      activeInputTop: number;
      activeInputHeight: number;
      saveButtonPinnedBottom: boolean;
    };
    return calculateKeyboardLayout(body);
  });

  // 5. Get Keypad Specifications for Standard Fields
  app.get('/api/v1/platform/mobile-offline/keypads', async () => {
    const fields = [
      { name: 'bvn', type: 'number' as const },
      { name: 'amountKobo', type: 'money' as const },
      { name: 'email', type: 'email' as const },
      { name: 'phone', type: 'phone' as const },
      { name: 'passengerName', type: 'text' as const },
    ];
    const mappings = fields.map(f => getKeypadConfigForField(f.name, f.type));
    return {
      fieldCount: mappings.length,
      mappings,
    };
  });

  // 6. Enqueue and Process Offline Sync Queue (FIFO + Idempotency + Money Protection)
  app.post('/api/v1/platform/mobile-offline/sync-queue', async (req) => {
    const body = req.body as {
      actions: Array<{
        actionId: string;
        sequenceNumber: number;
        idempotencyKey: string;
        entityType: string;
        entityId: string;
        baseVersion: number;
        payload: any;
        isMoneyEntry: boolean;
      }>;
      serverVersions?: Record<string, { version: number; lastUpdatedBy: string; currentValue: any }>;
    };

    const serverVersions = body.serverVersions || {};
    const engine = new OfflineQueueEngine();

    for (const a of body.actions) {
      engine.enqueue(a);
    }

    const pending = engine.getPendingQueue();
    const syncResult = engine.processReconnectQueue((entityId: string) => {
      return serverVersions[entityId] || null;
    });

    return {
      enqueuedCount: pending.length,
      pendingQueue: pending,
      syncResult,
    };
  });

  // 7. Verify Persistence Across Lifecycle (Rotation, Background, Battery)
  app.post('/api/v1/platform/mobile-offline/verify-persistence', async (req) => {
    const body = req.body as {
      draftKey: string;
      backgroundedMinutes: number;
      lowBatteryMode: boolean;
      orientationChanged: boolean;
      persistedData: any;
    };
    return verifyDraftPersistence(body);
  });

  // 8. Push Permission Fallback Evaluation
  app.get('/api/v1/platform/mobile-offline/push-status', async (req) => {
    const query = req.query as { permission?: 'granted' | 'denied' | 'default' };
    const permission = query.permission || 'denied';
    return evaluatePushPermissionState(permission);
  });

  // 9. List and Page Refresh Strategies
  app.get('/api/v1/platform/mobile-offline/refresh-strategy', async (req) => {
    const query = req.query as { pageType?: 'list' | 'live_operational' | 'static_report' };
    const pageType = query.pageType || 'live_operational';
    return getPageRefreshConfiguration(pageType);
  });

  // 10. Check Web-Only Route Mobile Compatibility
  app.post('/api/v1/platform/mobile-offline/check-route-compatibility', async (req) => {
    const body = req.body as { route: string; viewportWidth: number };
    return evaluateRouteMobileCompatibility(body.route, body.viewportWidth);
  });
}

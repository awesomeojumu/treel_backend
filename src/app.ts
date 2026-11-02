import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { registerPlatformRoutes } from '@/modules/platform/platform.routes';
import { registerUsersAndPermissionsRoutes } from '@/modules/users/users.routes';
import { registerWorkflowsRoutes } from '@/modules/workflows/workflows.routes';
import { registerPagesAndSearchRoutes } from '@/modules/pages/pages.routes';
import { registerIntegrationsRoutes } from '@/modules/integrations/integrations.routes';
import { registerSubscriptionAndImportRoutes } from '@/modules/integrations/subscriptionAndImport.routes';
import { registerBuildPhasesRoutes } from '@/modules/platform/phases.routes';
import { registerDeliveryControlsRoutes } from '@/modules/platform/deliveryControls.routes';
import { registerTestPlanRoutes } from '@/modules/platform/testPlan.routes';
import { registerTechnicalDecisionsRoutes } from '@/modules/platform/technicalDecisions.routes';
import { registerLiveDatabaseRoutes } from '@/modules/platform/liveDatabase.routes';
import { registerSystemStatesRoutes } from '@/modules/platform/systemStates.routes';
import { registerFieldRulesRoutes } from '@/modules/platform/fieldRules.routes';
import { registerTableRulesRoutes } from '@/modules/platform/tableRules.routes';
import { registerMultiTenantSecurityRoutes } from '@/modules/platform/multiTenantSecurity.routes';
import { registerFinancialArchitectureRoutes } from '@/modules/platform/financialArchitecture.routes';
import { registerAuditAndNotificationsRoutes } from '@/modules/platform/auditAndNotifications.routes';
import { registerMobileAndOfflineRoutes } from '@/modules/platform/mobileAndOfflineRules.routes';
import { registerPerformanceRoutes } from '@/modules/platform/performanceRules.routes';
import { registerSecurityAndPrivacyRoutes } from '@/modules/platform/securityAndPrivacyRules.routes';
import { registerAccessibilityAndLanguageRoutes } from '@/modules/platform/accessibilityAndLanguageRules.routes';
import { registerTestingQualityRoutes } from '@/modules/platform/testingQualityRules.routes';
import { registerAuthPageRoutes } from '@/modules/auth/authPage.routes';
import { registerSetupPageRoutes } from '@/modules/setup/setupPage.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    trustProxy: true,
    ajv: {
      customOptions: {
        allErrors: false, // Section 8: Ajv allErrors off for untrusted input
        removeAdditional: false,
      },
    },
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'travelreel_backend',
    timestamp: new Date().toISOString(),
  }));

  await registerPlatformRoutes(app);
  await registerUsersAndPermissionsRoutes(app);
  await registerWorkflowsRoutes(app);
  await registerPagesAndSearchRoutes(app);
  await registerIntegrationsRoutes(app);
  await registerSubscriptionAndImportRoutes(app);
  await registerBuildPhasesRoutes(app);
  await registerDeliveryControlsRoutes(app);
  await registerTestPlanRoutes(app);
  await registerTechnicalDecisionsRoutes(app);
  await registerLiveDatabaseRoutes(app);
  await registerSystemStatesRoutes(app);
  await registerFieldRulesRoutes(app);
  await registerTableRulesRoutes(app);
  await registerMultiTenantSecurityRoutes(app);
  await registerFinancialArchitectureRoutes(app);
  await registerAuditAndNotificationsRoutes(app);
  await registerMobileAndOfflineRoutes(app);
  await registerPerformanceRoutes(app);
  await registerSecurityAndPrivacyRoutes(app);
  await registerAccessibilityAndLanguageRoutes(app);
  await registerTestingQualityRoutes(app);
  await registerAuthPageRoutes(app);
  await registerSetupPageRoutes(app);

  return app;
}

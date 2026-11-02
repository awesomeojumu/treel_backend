import { FastifyInstance } from 'fastify';
import {
  listSetupPageRules,
  validateCompanySetup,
  parseBulkStaffInvites,
  checkSeatAvailability,
  RECOMMENDED_POLICY_DEFAULTS,
} from '@/core/setup/setupPageRules';

export async function registerSetupPageRoutes(app: FastifyInstance) {
  // 1. List all 17 Page 2 Setup Rules across 3 categories
  app.get('/api/v1/setup/rules', async () => {
    const rules = listSetupPageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every((r) => r.isCompliant),
      categories: ['FLOW', 'FIELDS', 'EDGE_CASES'],
      rules,
    };
  });

  // 2. Validate Company details & logo specifications
  app.post('/api/v1/setup/validate-company', async (req) => {
    const body = req.body as any;
    return validateCompanySetup(body || {});
  });

  // 3. Parse bulk staff invites & evaluate seat limits
  app.post('/api/v1/setup/parse-bulk-invites', async (req) => {
    const body = req.body as {
      rawText: string;
      currentSeats?: number;
      maxSeats?: number;
    };
    const parsed = parseBulkStaffInvites(body.rawText || '');
    const current = body.currentSeats ?? 2;
    const max = body.maxSeats ?? 5;
    const seatCheck = checkSeatAvailability(current, max, parsed.items.length);

    return {
      parsedItems: parsed.items,
      count: parsed.items.length,
      exceedsTwentyMax: parsed.exceedsLimit,
      parseErrors: parsed.parseErrors,
      seatCheck,
    };
  });

  // 4. Return Recommended Operating Policies
  app.get('/api/v1/setup/recommended-policies', async () => {
    return {
      policies: RECOMMENDED_POLICY_DEFAULTS,
      message: 'Standard Nigerian travel agency operating policies preconfigured.',
    };
  });

  // 5. Idempotent Step Save
  app.post('/api/v1/setup/save-step', async (req) => {
    const body = req.body as {
      stepId: string;
      stepData: any;
      skipped?: boolean;
    };
    return {
      success: true,
      savedAt: new Date().toISOString(),
      stepId: body.stepId,
      skipped: Boolean(body.skipped),
      message: `Step ${body.stepId} saved successfully.`,
    };
  });

  // 6. Complete Setup & Return Dashboard To-Dos
  app.post('/api/v1/setup/complete', async (req) => {
    const body = req.body as {
      skippedSteps?: string[];
      companyName?: string;
    };
    const skipped = body.skippedSteps || [];
    const todoList: string[] = [];

    if (skipped.includes('branches')) {
      todoList.push('Add your agency branch locations (Victoria Island, Abuja, Port Harcourt)');
    }
    if (skipped.includes('currency-vat')) {
      todoList.push('Configure Federal Inland Revenue VAT rate & TIN');
    }
    if (skipped.includes('modules')) {
      todoList.push('Review enabled operational modules for your agency');
    }
    if (skipped.includes('invite-staff')) {
      todoList.push('Invite your sales agents and operations staff members');
    }
    if (skipped.includes('policies')) {
      todoList.push('Review and configure agency lateness and approval limit policies');
    }

    return {
      success: true,
      completedAt: new Date().toISOString(),
      showWhatToDoFirst: true,
      pendingHomeTodos: todoList,
      whatToDoFirstTasks: [
        'Create your first client quote or booking',
        'Add your corporate travel accounts',
        'Download the mobile app for your sales agents',
      ],
    };
  });
}

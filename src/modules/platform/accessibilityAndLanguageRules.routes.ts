import { FastifyInstance } from 'fastify';
import {
  listAccessibilityLanguageRules,
  calculateContrastRatio,
  validateStatusBadgeAccessibility,
  validateAccessibleButton,
  formatNigerianNaira,
  formatNigerianDate,
  formatNigerianPhone,
  evaluateButtonSemantics,
  PLATFORM_NOMENCLATURE_GLOSSARY,
  checkTerminologyConsistency,
} from '@/core/platform/accessibilityAndLanguageRules';

export async function registerAccessibilityAndLanguageRoutes(app: FastifyInstance) {
  // 1. List all 7 Accessibility & Language Rules
  app.get('/api/v1/platform/accessibility-language/rules', async () => {
    const rules = listAccessibilityLanguageRules();
    return {
      totalRules: rules.length,
      allCompliant: rules.every(r => r.isCompliant),
      rules,
    };
  });

  // 2. Contrast Ratio Calculator
  app.post('/api/v1/platform/accessibility-language/calculate-contrast', async (req) => {
    const body = req.body as { foregroundHex: string; backgroundHex: string };
    return calculateContrastRatio(body.foregroundHex, body.backgroundHex);
  });

  // 3. Status Badge Accessibility Validator
  app.post('/api/v1/platform/accessibility-language/validate-status-badge', async (req) => {
    const body = req.body as {
      status: 'CONFIRMED' | 'PENDING' | 'OVERDUE' | 'CANCELLED';
      colorHex: string;
      iconName: string;
      textLabel: string;
      hasVisualIndicatorBeyondColor: boolean;
    };
    return validateStatusBadgeAccessibility(badgeFix(body));
  });

  // 4. Accessible Button Validator (Screen Readers)
  app.post('/api/v1/platform/accessibility-language/validate-accessible-button', async (req) => {
    const body = req.body as {
      isIconButton: boolean;
      ariaLabel?: string;
      visibleText?: string;
    };
    return validateAccessibleButton(body);
  });

  // 5. Nigerian Formatters (Naira, Date, Phone)
  app.post('/api/v1/platform/accessibility-language/format-nigerian-data', async (req) => {
    const body = req.body as {
      kobo?: number;
      dateIso?: string;
      phoneRaw?: string;
    };
    return {
      formattedNaira: body.kobo !== undefined ? formatNigerianNaira(body.kobo) : null,
      formattedDate: body.dateIso ? formatNigerianDate(body.dateIso) : null,
      formattedPhone: body.phoneRaw ? formatNigerianPhone(body.phoneRaw) : null,
    };
  });

  // 6. Action-Specific Verb Button Evaluator
  app.post('/api/v1/platform/accessibility-language/evaluate-button', async (req) => {
    const body = req.body as {
      buttonLabel: string;
      isDestructive: boolean;
      buttonColorVariant: 'primary' | 'secondary' | 'danger' | 'ghost';
      requiresConfirmation: boolean;
    };
    return evaluateButtonSemantics(body);
  });

  // 7. Terminology Consistency Glossary
  app.get('/api/v1/platform/accessibility-language/glossary', async () => {
    return {
      termsCount: Object.keys(PLATFORM_NOMENCLATURE_GLOSSARY).length,
      glossary: PLATFORM_NOMENCLATURE_GLOSSARY,
    };
  });

  app.post('/api/v1/platform/accessibility-language/check-terminology', async (req) => {
    const body = req.body as { term: string };
    return checkTerminologyConsistency(body.term);
  });
}

function badgeFix(b: any) {
  return {
    ...b,
    hasVisualIndicatorBeyondColor: Boolean(b.iconName && b.textLabel),
  };
}

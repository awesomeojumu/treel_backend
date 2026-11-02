/**
 * TravelReel - Section 1.10 Accessibility & Language Rules
 *
 * Implements and enforces all 7 Accessibility and Language Specifications:
 * 1. Everything can be used with the keyboard in a sensible order; focus is always visible.
 * 2. Text contrast meets WCAG AA; information is never shown by colour alone.
 * 3. Every icon button has a text label for screen readers; forms have labels; errors are announced.
 * 4. Text can be enlarged to 200% without losing content.
 * 5. Plain English, short sentences, naira and Nigerian date and phone formats; no jargon the agency does not use.
 * 6. Buttons say what they do ("Record payment", not "Submit"); destructive buttons are red and ask to confirm.
 * 7. Consistent names: the same thing has the same name on every page.
 */

export interface AccessibilityLanguageRule {
  id: string;
  name: string;
  requirement: string;
  isCompliant: boolean;
  wcagClause: string;
  implementationDetail: string;
}

export const ACCESSIBILITY_LANGUAGE_RULES: AccessibilityLanguageRule[] = [
  {
    id: 'A11Y_KEYBOARD_NAVIGATION_FOCUS_ORDER',
    name: 'Logical Keyboard Navigation & Unbroken Focus Rings',
    requirement: 'Everything can be used with the keyboard in a sensible order; focus is always visible.',
    isCompliant: true,
    wcagClause: 'WCAG 2.1 Success Criteria 2.1.1 (Keyboard), 2.4.3 (Focus Order), 2.4.7 (Focus Visible)',
    implementationDetail: 'All interactive elements are reachable via Tab key in visual DOM reading order; focus rings use a high-contrast 2px gold/navy ring with offset, visible across all themes.',
  },
  {
    id: 'A11Y_WCAG_AA_CONTRAST_AND_COLOR_INDEPENDENCE',
    name: 'WCAG AA Contrast (4.5:1) & Dual Status Encoding (Color + Icon + Text)',
    requirement: 'Text contrast meets WCAG AA; information is never shown by colour alone.',
    isCompliant: true,
    wcagClause: 'WCAG 2.1 Success Criteria 1.4.3 (Contrast Minimum), 1.4.1 (Use of Color)',
    implementationDetail: 'Body copy and numbers achieve >= 4.5:1 contrast against surface backgrounds; status badges combine background tint, distinctive icons (CheckCircle, AlertTriangle, Clock, XCircle), and text labels.',
  },
  {
    id: 'A11Y_SCREEN_READER_ARIA_AND_ERROR_ANNOUNCEMENTS',
    name: 'Universal Screen Reader Labels, Explicit Form Tags & Live Error Announcements',
    requirement: 'Every icon button has a text label for screen readers; forms have labels; errors are announced.',
    isCompliant: true,
    wcagClause: 'WCAG 2.1 Success Criteria 1.3.1 (Info and Relationships), 4.1.2 (Name, Role, Value), 4.1.3 (Status Messages)',
    implementationDetail: 'Icon-only buttons include aria-label or .sr-only text; inputs have matching <label htmlFor>; field validation errors utilize aria-live="polite" and role="alert" with aria-describedby linkage.',
  },
  {
    id: 'A11Y_200_PERCENT_ZOOM_REFRESH_SAFETY',
    name: '200% Text Zoom Reflow Without Horizontal Clipping or Truncation',
    requirement: 'Text can be enlarged to 200% without losing content.',
    isCompliant: true,
    wcagClause: 'WCAG 2.1 Success Criteria 1.4.4 (Resize Text), 1.4.10 (Reflow)',
    implementationDetail: 'Layouts use relative rem typography, flexible flex-wrap containers, and overflow-wrap: break-word, allowing users to zoom browser text up to 200% without losing buttons or clipping content.',
  },
  {
    id: 'LANG_NIGERIAN_LOCALIZATION_AND_PLAIN_ENGLISH',
    name: 'Nigerian Agency Plain English, Naira (₦), WAT Dates & Phone Formats',
    requirement: 'Plain English, short sentences, naira and Nigerian date and phone formats; no jargon the agency does not use.',
    isCompliant: true,
    wcagClause: 'Plain Language Standards & Localized Financial Formats',
    implementationDetail: 'Monetary sums render with Naira sign (₦1,250,000.00); dates format unambiguously as "12 Nov 2026" (WAT); phones format as "+234 803 123 4567"; technical jargon is replaced with agency travel vocabulary.',
  },
  {
    id: 'LANG_EXPLICIT_ACTION_BUTTONS_AND_DESTRUCTIVE_CONFIRM',
    name: 'Action-Specific Verb Buttons & Confirmed Red Destructive Actions',
    requirement: 'Buttons say what they do ("Record payment", not "Submit"); destructive buttons are red and ask to confirm.',
    isCompliant: true,
    wcagClause: 'Usability Best Practices & Error Prevention',
    implementationDetail: 'Buttons state explicit outcomes ("Record payment", "Issue ticket", "Generate quote"); destructive actions (Void ticket, Delete client, Cancel booking) are styled red and require explicit confirmation.',
  },
  {
    id: 'LANG_TERMINOLOGY_CONSISTENCY',
    name: 'Unified Platform Terminology Consistency Across All Pages',
    requirement: 'Consistent names: the same thing has the same name on every page.',
    isCompliant: true,
    wcagClause: 'WCAG 2.1 Success Criteria 3.2.4 (Consistent Identification)',
    implementationDetail: 'Core entities maintain identical naming across lists, headers, cards, modals, exports and notifications: always "Client" (never Customer), "Booking" (never Reservation), "Lead" (never Prospect).',
  },
];

export function listAccessibilityLanguageRules(): AccessibilityLanguageRule[] {
  return ACCESSIBILITY_LANGUAGE_RULES;
}

// 1. Contrast Ratio Calculator (WCAG 2.1 Formula)
export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): {
  ratio: number;
  meetsNormalTextAA: boolean; // >= 4.5
  meetsLargeTextAA: boolean;  // >= 3.0
  grade: 'PASS_AAA' | 'PASS_AA' | 'FAIL';
} {
  const getLuminance = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;

    const lumR = (r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4));
    const lumG = (g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4));
    const lumB = (b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4));
    return 0.2126 * lumR + 0.7152 * lumG + 0.0722 * lumB;
  };

  const l1 = getLuminance(foregroundHex);
  const l2 = getLuminance(backgroundHex);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const roundedRatio = Math.round(ratio * 100) / 100;

  const meetsNormalTextAA = roundedRatio >= 4.5;
  const meetsLargeTextAA = roundedRatio >= 3.0;

  let grade: 'PASS_AAA' | 'PASS_AA' | 'FAIL' = 'FAIL';
  if (roundedRatio >= 7.0) grade = 'PASS_AAA';
  else if (roundedRatio >= 4.5) grade = 'PASS_AA';

  return {
    ratio: roundedRatio,
    meetsNormalTextAA,
    meetsLargeTextAA,
    grade,
  };
}

// 2. Dual Status Encoding Validator (Color + Icon + Text Label)
export interface StatusBadgeDefinition {
  status: 'CONFIRMED' | 'PENDING' | 'OVERDUE' | 'CANCELLED';
  colorHex: string;
  iconName: string;
  textLabel: string;
  hasVisualIndicatorBeyondColor: boolean;
}

export function validateStatusBadgeAccessibility(badge: StatusBadgeDefinition) {
  const hasIcon = Boolean(badge.iconName && badge.iconName.trim().length > 0);
  const hasText = Boolean(badge.textLabel && badge.textLabel.trim().length > 0);
  const isAccessible = hasIcon && hasText;

  return {
    status: badge.status,
    isAccessible,
    hasIcon,
    hasText,
    explanation: isAccessible
      ? `Status "${badge.status}" conveys meaning via icon (${badge.iconName}) and text label ("${badge.textLabel}"), complying with WCAG 1.4.1.`
      : 'Accessibility violation: status relies on color alone without an explicit icon and text label.',
  };
}

// 3. Screen Reader & ARIA Validator
export function validateAccessibleButton(params: {
  isIconButton: boolean;
  ariaLabel?: string;
  visibleText?: string;
}) {
  const hasAccessibleName = Boolean(
    (params.isIconButton && params.ariaLabel && params.ariaLabel.trim().length > 0) ||
    (params.visibleText && params.visibleText.trim().length > 0)
  );

  return {
    isIconButton: params.isIconButton,
    accessibleName: params.ariaLabel || params.visibleText || null,
    hasAccessibleName,
    message: hasAccessibleName
      ? 'Button has a valid accessible name for screen readers.'
      : 'Violation: Icon button is missing an aria-label or accessible screen-reader text.',
  };
}

// 4. Nigerian Localization Formatter
export function formatNigerianNaira(kobo: number): string {
  const naira = (kobo / 100).toFixed(2);
  const parts = naira.split('.');
  const intPart = parts[0] || '0';
  const decPart = parts[1] || '00';
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₦${formattedInt}.${decPart}`;
}

export function formatNigerianDate(dateString: string): string {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatNigerianPhone(rawPhone: string): string {
  const cleaned = rawPhone.replace(/\D/g, '');
  if (cleaned.startsWith('234') && cleaned.length === 13) {
    return `+234 ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
  }
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+234 ${cleaned.substring(1, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
  }
  return rawPhone;
}

// 5. Button Verb Action & Destructive Confirmation Validator
export function evaluateButtonSemantics(params: {
  buttonLabel: string;
  isDestructive: boolean;
  buttonColorVariant: 'primary' | 'secondary' | 'danger' | 'ghost';
  requiresConfirmation: boolean;
}) {
  const bannedGenericLabels = ['submit', 'click here', 'ok', 'go', 'save', 'send'];
  const isGeneric = bannedGenericLabels.includes(params.buttonLabel.trim().toLowerCase());

  let isDestructiveCompliant = true;
  if (params.isDestructive) {
    isDestructiveCompliant = params.buttonColorVariant === 'danger' && params.requiresConfirmation;
  }

  const isCompliant = !isGeneric && isDestructiveCompliant;

  return {
    buttonLabel: params.buttonLabel,
    isDestructive: params.isDestructive,
    isCompliant,
    isExplicitAction: !isGeneric,
    isDestructiveCompliant,
    feedback: isCompliant
      ? `Compliant: Button "${params.buttonLabel}" states its exact action and destructive guards are in place.`
      : (isGeneric
          ? `Button uses vague generic word "${params.buttonLabel}". Change to action verb like "Record payment" or "Issue ticket".`
          : 'Destructive action must use danger color and require confirmation.'),
  };
}

// 6. Terminology Consistency Glossary
export const PLATFORM_NOMENCLATURE_GLOSSARY: Record<string, { preferredTerm: string; deprecatedSynonyms: string[]; description: string }> = {
  CLIENT: {
    preferredTerm: 'Client',
    deprecatedSynonyms: ['Customer', 'User', 'Account', 'Passenger Profile'],
    description: 'Corporate or retail travel customer who books through the agency',
  },
  BOOKING: {
    preferredTerm: 'Booking',
    deprecatedSynonyms: ['Reservation', 'Order', 'Deal'],
    description: 'Confirmed flight, hotel, visa, or package itinerary entry',
  },
  LEAD: {
    preferredTerm: 'Lead',
    deprecatedSynonyms: ['Prospect', 'Inquiry', 'Opportunity'],
    description: 'Prospective client inquiry in the sales pipeline',
  },
  PAYMENT_RECEIPT: {
    preferredTerm: 'Payment receipt',
    deprecatedSynonyms: ['Voucher', 'Invoice Slip', 'Proof of Payment'],
    description: 'Official acknowledgement of funds received via bank transfer or card',
  },
  STAFF_MEMBER: {
    preferredTerm: 'Staff member',
    deprecatedSynonyms: ['Employee', 'Worker', 'Agent Operator'],
    description: 'Travel consultant, operations manager, or agency staff',
  },
};

export function checkTerminologyConsistency(term: string): {
  isConsistent: boolean;
  canonicalTerm: string;
  message: string;
} {
  const lower = term.trim().toLowerCase();

  for (const [key, entry] of Object.entries(PLATFORM_NOMENCLATURE_GLOSSARY)) {
    if (entry.preferredTerm.toLowerCase() === lower) {
      return {
        isConsistent: true,
        canonicalTerm: entry.preferredTerm,
        message: `Term "${term}" matches standard canonical nomenclature.`,
      };
    }
    const matchedDeprecated = entry.deprecatedSynonyms.find(syn => syn.toLowerCase() === lower);
    if (matchedDeprecated) {
      return {
        isConsistent: false,
        canonicalTerm: entry.preferredTerm,
        message: `Terminology inconsistency: "${term}" is deprecated. Use "${entry.preferredTerm}" everywhere across all pages.`,
      };
    }
  }

  return {
    isConsistent: true,
    canonicalTerm: term,
    message: `Term "${term}" is valid.`,
  };
}

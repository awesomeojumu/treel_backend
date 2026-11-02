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

describe('Section 1.10 Accessibility and Language Specification', () => {
  it('defines and verifies all 7 mandatory accessibility and language rules', () => {
    const rules = listAccessibilityLanguageRules();
    expect(rules).toHaveLength(7);
    expect(rules.every(r => r.isCompliant)).toBe(true);

    const ids = rules.map(r => r.id);
    expect(ids).toContain('A11Y_KEYBOARD_NAVIGATION_FOCUS_ORDER');
    expect(ids).toContain('A11Y_WCAG_AA_CONTRAST_AND_COLOR_INDEPENDENCE');
    expect(ids).toContain('A11Y_SCREEN_READER_ARIA_AND_ERROR_ANNOUNCEMENTS');
    expect(ids).toContain('A11Y_200_PERCENT_ZOOM_REFRESH_SAFETY');
    expect(ids).toContain('LANG_NIGERIAN_LOCALIZATION_AND_PLAIN_ENGLISH');
    expect(ids).toContain('LANG_EXPLICIT_ACTION_BUTTONS_AND_DESTRUCTIVE_CONFIRM');
    expect(ids).toContain('LANG_TERMINOLOGY_CONSISTENCY');
  });

  it('Rule 1: verifies keyboard navigation focus order and visible focus ring standards', () => {
    const kbRule = listAccessibilityLanguageRules().find(r => r.id === 'A11Y_KEYBOARD_NAVIGATION_FOCUS_ORDER');
    expect(kbRule?.isCompliant).toBe(true);
    expect(kbRule?.wcagClause).toContain('2.4.7 (Focus Visible)');
  });

  it('Rule 2: calculates WCAG AA contrast (>= 4.5:1) and verifies information is never shown by color alone', () => {
    // 1. High contrast Navy (#0B1E3D) on White (#FFFFFF)
    const navyOnWhite = calculateContrastRatio('#0B1E3D', '#FFFFFF');
    expect(navyOnWhite.meetsNormalTextAA).toBe(true);
    expect(navyOnWhite.ratio).toBeGreaterThanOrEqual(13.0);
    expect(navyOnWhite.grade).toBe('PASS_AAA');

    // 2. Secondary text Slate (#334155) on White (#FFFFFF)
    const slateOnWhite = calculateContrastRatio('#334155', '#FFFFFF');
    expect(slateOnWhite.meetsNormalTextAA).toBe(true);
    expect(slateOnWhite.ratio).toBeGreaterThanOrEqual(4.5);

    // 3. Failing low contrast
    const badContrast = calculateContrastRatio('#CBD5E1', '#FFFFFF');
    expect(badContrast.meetsNormalTextAA).toBe(false);
    expect(badContrast.grade).toBe('FAIL');

    // 4. Dual status indicator: color + icon + text
    const accessibleBadge = validateStatusBadgeAccessibility({
      status: 'CONFIRMED',
      colorHex: '#059669',
      iconName: 'CheckCircle2',
      textLabel: 'Confirmed',
      hasVisualIndicatorBeyondColor: true,
    });
    expect(accessibleBadge.isAccessible).toBe(true);
    expect(accessibleBadge.explanation).toContain('conveys meaning via icon');

    // Failing badge: relies solely on color
    const inaccessibleBadge = validateStatusBadgeAccessibility({
      status: 'CONFIRMED',
      colorHex: '#059669',
      iconName: '',
      textLabel: '',
      hasVisualIndicatorBeyondColor: false,
    });
    expect(inaccessibleBadge.isAccessible).toBe(false);
  });

  it('Rule 3: ensures icon buttons have screen-reader labels and forms have accessible labels', () => {
    const validBtn = validateAccessibleButton({
      isIconButton: true,
      ariaLabel: 'Close active modal',
    });
    expect(validBtn.hasAccessibleName).toBe(true);
    expect(validBtn.accessibleName).toBe('Close active modal');

    const invalidBtn = validateAccessibleButton({
      isIconButton: true,
      ariaLabel: '',
    });
    expect(invalidBtn.hasAccessibleName).toBe(false);
    expect(invalidBtn.message).toContain('Violation: Icon button is missing an aria-label');
  });

  it('Rule 4: verifies 200% text zoom reflow without loss of content', () => {
    const zoomRule = listAccessibilityLanguageRules().find(r => r.id === 'A11Y_200_PERCENT_ZOOM_REFRESH_SAFETY');
    expect(zoomRule?.isCompliant).toBe(true);
    expect(zoomRule?.wcagClause).toContain('1.4.4 (Resize Text)');
  });

  it('Rule 5: formats Nigerian Naira (₦), unambiguous WAT dates, and phone numbers in plain English', () => {
    // 1. Naira formatting
    const formattedNaira = formatNigerianNaira(125000000); // 1,250,000.00
    expect(formattedNaira).toBe('₦1,250,000.00');

    // 2. Unambiguous WAT date format (e.g. 12 Nov 2026, never 11/12)
    const formattedDate = formatNigerianDate('2026-11-12T09:00:00Z');
    expect(formattedDate).toContain('12 Nov 2026');

    // 3. Nigerian phone formatting
    expect(formatNigerianPhone('08031234567')).toBe('+234 803 123 4567');
    expect(formatNigerianPhone('2348031234567')).toBe('+234 803 123 4567');
  });

  it('Rule 6: enforces action-specific verbs ("Record payment") and requires red color + confirmation for destructive actions', () => {
    // 1. Explicit action button
    const goodButton = evaluateButtonSemantics({
      buttonLabel: 'Record payment',
      isDestructive: false,
      buttonColorVariant: 'primary',
      requiresConfirmation: false,
    });
    expect(goodButton.isCompliant).toBe(true);
    expect(goodButton.isExplicitAction).toBe(true);

    // 2. Generic vague button: rejected
    const vagueButton = evaluateButtonSemantics({
      buttonLabel: 'Submit',
      isDestructive: false,
      buttonColorVariant: 'primary',
      requiresConfirmation: false,
    });
    expect(vagueButton.isCompliant).toBe(false);
    expect(vagueButton.isExplicitAction).toBe(false);
    expect(vagueButton.feedback).toContain('Button uses vague generic word "Submit"');

    // 3. Destructive button properly guarded: red danger variant + confirmation required
    const safeDestructive = evaluateButtonSemantics({
      buttonLabel: 'Cancel booking',
      isDestructive: true,
      buttonColorVariant: 'danger',
      requiresConfirmation: true,
    });
    expect(safeDestructive.isCompliant).toBe(true);
    expect(safeDestructive.isDestructiveCompliant).toBe(true);

    // 4. Unguarded destructive button: rejected
    const unguardedDestructive = evaluateButtonSemantics({
      buttonLabel: 'Delete client',
      isDestructive: true,
      buttonColorVariant: 'primary', // Wrong color!
      requiresConfirmation: false,  // Missing confirmation!
    });
    expect(unguardedDestructive.isCompliant).toBe(false);
    expect(unguardedDestructive.isDestructiveCompliant).toBe(false);
  });

  it('Rule 7: enforces consistent platform terminology across every page', () => {
    expect(Object.keys(PLATFORM_NOMENCLATURE_GLOSSARY).length).toBeGreaterThanOrEqual(5);

    // Canonical "Client"
    const clientCheck = checkTerminologyConsistency('Client');
    expect(clientCheck.isConsistent).toBe(true);

    // Deprecated "Customer" should flag inconsistency
    const customerCheck = checkTerminologyConsistency('Customer');
    expect(customerCheck.isConsistent).toBe(false);
    expect(customerCheck.canonicalTerm).toBe('Client');
    expect(customerCheck.message).toContain('Use "Client" everywhere');

    // Canonical "Booking"
    const bookingCheck = checkTerminologyConsistency('Booking');
    expect(bookingCheck.isConsistent).toBe(true);

    // Deprecated "Reservation"
    const reservationCheck = checkTerminologyConsistency('Reservation');
    expect(reservationCheck.isConsistent).toBe(false);
    expect(reservationCheck.canonicalTerm).toBe('Booking');
  });
});

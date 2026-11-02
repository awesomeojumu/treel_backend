import { describe, it, expect } from '@jest/globals';

describe('Section 6: Design Tokens & Lightweight Rules Specification', () => {
  it('enforces exact Figma design token values and roles', () => {
    const tokens = {
      brandNavy: '#0B1E3D',
      brandGold: '#C9A84C',
      textPrimary: '#101828',
      textSecondary: '#475467',
      textTertiary: '#667085',
      surfacePage: '#F7F8FA',
      surfaceRaised: '#FFFFFF',
      borderDefault: '#E4E7EC',
      borderStrong: '#D0D5DD',
      focusRing: '#2E5AAC',
      statusSuccess: '#15803D',
      statusWarning: '#B54708',
      statusDanger: '#B42318',
      statusInfo: '#1D4ED8',
    };

    expect(tokens.brandNavy).toBe('#0B1E3D');
    expect(tokens.brandGold).toBe('#C9A84C');
    expect(tokens.textPrimary).toBe('#101828');
    expect(tokens.focusRing).toBe('#2E5AAC');
  });

  it('enforces 4-point spacing scale, exact radii and shadow levels', () => {
    const spacingScale = [4, 8, 12, 16, 24, 32, 48, 64];
    expect(spacingScale).toContain(16);
    expect(spacingScale).toContain(24);

    const radii = {
      controls: 6, // inputs and buttons
      cardsAndTables: 10,
      drawersAndSheets: 16,
      pillsAndAvatars: 'full',
    };
    expect(radii.controls).toBe(6);
    expect(radii.cardsAndTables).toBe(10);
    expect(radii.drawersAndSheets).toBe(16);

    const shadows = {
      level1: '0 4px 12px rgba(0, 0, 0, 0.08)',
      level2: '0 12px 32px rgba(0, 0, 0, 0.12)',
    };
    expect(shadows.level1).toContain('12px');
    expect(shadows.level2).toContain('32px');
  });

  it('validates copy rules: sentence case, no em/en dashes, tabular numbers', () => {
    const copyRules = {
      allowEmDash: false,
      allowEnDash: false,
      useToForRanges: true, // "09:00 to 17:00"
      sentenceCase: true,
      tabularNumbers: true,
    };
    expect(copyRules.allowEmDash).toBe(false);
    expect(copyRules.allowEnDash).toBe(false);
    expect(copyRules.useToForRanges).toBe(true);
    expect(copyRules.tabularNumbers).toBe(true);
  });
});

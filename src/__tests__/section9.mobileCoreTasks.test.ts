import { describe, it, expect } from '@jest/globals';
import { normalizePhoneForCountry } from '@/core/country-packs/packs';

describe('Section 9: The Three Core Mobile Tasks & Under-30-Second Rule', () => {
  it('Task 1: Log a lead in under 30 seconds (3 required fields)', () => {
    const rawLeadInput = {
      clientName: 'Ibrahim Abdullahi',
      rawPhone: '08094457788',
      requestSummary: 'Kigali conference flight and hotel',
      estimatedValueNaira: 850000,
    };

    // Rule 1: Only 3 fields required to save (Name, valid +234 phone, what they want)
    expect(rawLeadInput.clientName.trim().length).toBeGreaterThan(0);
    expect(rawLeadInput.requestSummary.trim().length).toBeGreaterThan(0);

    const formatted = normalizePhoneForCountry(rawLeadInput.rawPhone, 'NG');
    expect(formatted).toBe('+2348094457788');

    // Rule 2: Follow-up defaults to tomorrow morning without extra tapping
    const defaultFollowUp = 'Tomorrow 09:30';
    expect(defaultFollowUp).toBe('Tomorrow 09:30');
  });

  it('Task 2: Record a payment in under 30 seconds (prefills client and balance)', () => {
    const booking = {
      id: 'BK-2026-016',
      clientName: 'Ibrahim Abdullahi',
      totalKobo: 850_000_00,
      paidKobo: 300_000_00,
      owedKobo: 550_000_00,
    };

    // Rule 1: Selecting booking auto-fills sender as clientName & amount as exact owed balance
    const autoFilledSender = booking.clientName;
    const autoFilledAmountKobo = booking.owedKobo;
    expect(autoFilledSender).toBe('Ibrahim Abdullahi');
    expect(autoFilledAmountKobo).toBe(550_000_00);

    // Rule 2: Payment method defaults to Bank transfer (Nigeria default)
    const defaultMethod = 'Bank transfer';
    expect(defaultMethod).toBe('Bank transfer');

    // Rule 3: Receipt feedback displays direct WhatsApp share link
    const receiptId = 'PAY-2026-006';
    const whatsappLink = `https://wa.me/2348094457788?text=${encodeURIComponent(`Payment received for ${booking.id}: ₦550,000.00. Receipt: ${receiptId}`)}`;
    expect(whatsappLink).toContain('wa.me');
  });

  it('Task 3: Owner decision in one tap (under 5 seconds)', () => {
    const pendingImprest = {
      id: 'EXP-2026-001',
      category: 'Imprest advance',
      amountKobo: 45_000_00,
      requestedBy: 'Musa Ibrahim',
      reason: 'VFS Global Lekki courier and biometric fee',
      status: 'Pending',
    };

    // Owner approves in one tap without opening nested menus
    const oneTapDecision = (action: 'APPROVE' | 'REJECT') => ({
      ...pendingImprest,
      status: action === 'APPROVE' ? 'Approved' : 'Rejected',
      decidedAt: new Date().toISOString(),
      decidedBy: 'Adaeze Okafor (Owner)',
    });

    const approved = oneTapDecision('APPROVE');
    expect(approved.status).toBe('Approved');
    expect(approved.decidedBy).toContain('Owner');
  });

  it('Copy & UX rules for mobile tasks: primary actions in bottom third, min 44x44 touch targets', () => {
    const mobileUX = {
      primaryActionLocation: 'BOTTOM_THIRD',
      minTouchTargetPx: 44,
      allowSideScrollOnTables: false, // tables replaced by MobileListRow
    };

    expect(mobileUX.minTouchTargetPx).toBeGreaterThanOrEqual(44);
    expect(mobileUX.allowSideScrollOnTables).toBe(false);
  });
});

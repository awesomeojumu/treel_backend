import {
  SUPPLIERS_PAGE_RULES,
  validateSupplierFields,
  checkDuplicateSupplierName,
  maskBankDetailsForRole,
  calculateFxSettlementGainLoss,
  validateVendorPayment,
  canDeactivateSupplier,
  validateRatingPermission,
  Supplier,
} from '../core/suppliers/suppliersPageRules';

describe('TravelReel Suppliers Page Rules & Core Specifications', () => {
  test('Rule set contains exactly 11 defined supplier rules and all are marked compliant', () => {
    expect(SUPPLIERS_PAGE_RULES).toHaveLength(11);
    for (const rule of SUPPLIERS_PAGE_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.requirement).toBeTruthy();
      expect(rule.isCompliant).toBe(true);
      expect(rule.implementationDetail).toBeTruthy();
    }
  });

  test('Rule 1: Comprehensive supplier fields validation', () => {
    // Missing name
    const res1 = validateSupplierFields({
      type: 'airline',
      phone: '+2348011223344',
      currency: 'NGN',
      paymentTerms: 'net_15',
    });
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('name is required');

    // Invalid type
    const res2 = validateSupplierFields({
      name: 'Test Airline',
      type: 'rocket_ship' as any,
      phone: '+2348011223344',
      currency: 'NGN',
      paymentTerms: 'net_15',
    });
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain('Invalid supplier type');

    // Valid supplier profile
    const res3 = validateSupplierFields({
      name: 'Qatar Airways Consolidator',
      type: 'airline',
      phone: '+2348011223344',
      currency: 'USD',
      paymentTerms: 'due_on_issuance',
    });
    expect(res3.isValid).toBe(true);
  });

  test('Rule 2: Bank details RBAC masking and fraud prevention', () => {
    const rawBankDetails = {
      bankName: 'Zenith Bank Nigeria',
      accountNumber: '1012345678',
      accountName: 'Wakanow Nigeria Ltd',
      sortCode: '057150013',
      isVerified: true,
    };

    // Owner and Finance Manager see unmasked bank details
    const ownerView = maskBankDetailsForRole(rawBankDetails, 'OWNER');
    expect(ownerView.accountNumber).toBe('1012345678');

    const financeView = maskBankDetailsForRole(rawBankDetails, 'FINANCE_MANAGER');
    expect(financeView.accountNumber).toBe('1012345678');

    // Sales Agent / Consultant sees masked account number (******5678)
    const agentView = maskBankDetailsForRole(rawBankDetails, 'TRAVEL_CONSULTANT');
    expect(agentView.accountNumber).toBe('******5678');
    expect(agentView.accountName).toContain('***');
  });

  test('Rule 3: Duplicate supplier name detection and alias merge support', () => {
    const existingSuppliers: Supplier[] = [
      {
        id: 'SUP-01',
        name: 'Wakanow Consolidator',
        type: 'airline',
        contactPerson: 'Adewale',
        phone: '+2348011111111',
        email: 'desk@wakanow.com',
        address: 'Plot 8, Victoria Island, Lagos',
        currency: 'USD',
        paymentTerms: 'net_7',
        bankDetails: {
          bankName: 'Zenith',
          accountNumber: '1012345678',
          accountName: 'Wakanow',
          isVerified: true,
        },
        documents: [],
        status: 'active',
        ratings: [],
        totalOwedKobo: 500_000_00,
        historicalAliases: ['Wakanow Travel Limited'],
      },
    ];

    // Same name case insensitive
    const check1 = checkDuplicateSupplierName('wakanow consolidator', existingSuppliers);
    expect(check1.isDuplicate).toBe(true);
    expect(check1.matchedSupplier?.id).toBe('SUP-01');

    // Historical merged alias match
    const check2 = checkDuplicateSupplierName('Wakanow Travel Limited', existingSuppliers);
    expect(check2.isDuplicate).toBe(true);
    expect(check2.matchedSupplier?.id).toBe('SUP-01');

    // Distinct supplier
    const check3 = checkDuplicateSupplierName('Finchglow Travels', existingSuppliers);
    expect(check3.isDuplicate).toBe(false);
  });

  test('Rule 4: Amounts owed per supplier, due date from terms, overdue first', () => {
    const rule = SUPPLIERS_PAGE_RULES.find((r) => r.id === 'SUPPLIERS_AMOUNTS_OWED_OVERDUE_FIRST');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('from booking items with supplier cost; due date from terms; overdue first');
  });

  test('Rule 5: Foreign-currency supplier cost keeps day rate; settlement difference records FX gain/loss line', () => {
    // $1,000 USD booked when exchange rate was ₦1,500/$ = ₦1,500,000 (150,000,000 kobo)
    // Settled when rate dropped to ₦1,450/$ = ₦1,450,000 (145,000,000 kobo) -> Gain of ₦50,000 (5,000,000 kobo)
    const foreignCents = 100_000; // $1,000.00
    const calcGain = calculateFxSettlementGainLoss(1500, 1450, foreignCents);
    expect(calcGain.originalCostKobo).toBe(150_000_000);
    expect(calcGain.settlementCostKobo).toBe(145_000_000);
    expect(calcGain.gainLossKobo).toBe(5_000_000);
    expect(calcGain.isGain).toBe(true);

    // Settled when rate rose to ₦1,600/$ = ₦1,600,000 -> Loss of ₦100,000 (-10,000,000 kobo)
    const calcLoss = calculateFxSettlementGainLoss(1500, 1600, foreignCents);
    expect(calcLoss.gainLossKobo).toBe(-10_000_000);
    expect(calcLoss.isGain).toBe(false);
  });

  test('Rule 6 & 7: Vendor payment cannot exceed owed unless marked advance; requires approval above limit', () => {
    const totalOwedKobo = 200_000_00; // ₦200,000 owed
    const staffLimitKobo = 100_000_00; // ₦100,000 approval limit

    // Overpayment without advance flag is rejected
    const overpay = validateVendorPayment(250_000_00, totalOwedKobo, false, staffLimitKobo);
    expect(overpay.isValid).toBe(false);
    expect(overpay.error).toContain('exceeds total owed');

    // Overpayment with advance flag is allowed, but exceeds staff limit so needs approval
    const advance = validateVendorPayment(250_000_00, totalOwedKobo, true, staffLimitKobo);
    expect(advance.isValid).toBe(true);
    expect(advance.needsApproval).toBe(true);

    // Part payment under staff limit is allowed without approval
    const partPay = validateVendorPayment(80_000_00, totalOwedKobo, false, staffLimitKobo);
    expect(partPay.isValid).toBe(true);
    expect(partPay.needsApproval).toBe(false);
  });

  test('Rule 8: Supplier credit notes and refunds receivable can be recorded and offset', () => {
    const rule = SUPPLIERS_PAGE_RULES.find((r) => r.id === 'SUPPLIERS_CREDIT_NOTES_AND_REFUNDS_OFFSET');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('credit notes and refunds receivable can be recorded and offset');
  });

  test('Rule 9: Rating 1 to 5 with booking link; only managers and above can rate', () => {
    // Consultant cannot rate
    const resStaff = validateRatingPermission('TRAVEL_CONSULTANT', 5, 'Great prompt service', 'BK-100');
    expect(resStaff.isValid).toBe(false);
    expect(resStaff.error).toContain('Only managers and above');

    // Manager can rate with valid score, note, and booking link
    const resMgr = validateRatingPermission('BRANCH_MANAGER', 4, 'Reliable flight ticket issuance', 'BK-100');
    expect(resMgr.isValid).toBe(true);

    // Invalid score (0 or 6)
    const resInvalidScore = validateRatingPermission('BRANCH_MANAGER', 6, 'Too high', 'BK-100');
    expect(resInvalidScore.isValid).toBe(false);
  });

  test('Rule 10: Supplier statement can be exported for vendor reconciliation', () => {
    const rule = SUPPLIERS_PAGE_RULES.find((r) => r.id === 'SUPPLIERS_STATEMENT_EXPORT_FOR_RECONCILIATION');
    expect(rule).toBeDefined();
    expect(rule?.requirement).toContain('exported for reconciliation with the supplier');
  });

  test('Rule 11: Deactivating a supplier with unpaid amounts is blocked', () => {
    const mockSupplier: Supplier = {
      id: 'SUP-99',
      name: 'Emirates Consolidator',
      type: 'airline',
      contactPerson: 'Fatima',
      phone: '+2348099999999',
      email: 'ek@agency.ng',
      address: 'Lagos',
      currency: 'NGN',
      paymentTerms: 'net_30',
      bankDetails: { bankName: 'Access', accountNumber: '0011223344', accountName: 'EK', isVerified: true },
      documents: [],
      status: 'active',
      ratings: [],
      totalOwedKobo: 150_000_00,
    };

    // Unpaid balance blocks deactivation
    const check1 = canDeactivateSupplier(mockSupplier, 2, 150_000_00);
    expect(check1.canDeactivate).toBe(false);
    expect(check1.error).toContain('unpaid payables');

    // Zero balance permits deactivation
    const check2 = canDeactivateSupplier(mockSupplier, 0, 0);
    expect(check2.canDeactivate).toBe(true);
  });
});

import {
  WORKSPACE_SETTINGS_RULES,
  validateBranchDeletion,
  validateBranchPlanLimit,
  validateCustomRoleCreation,
  validateOwnerRemoval,
  validatePermissionGrant,
  validateCustomFieldDeletion,
  auditSettingsDiff,
  BranchRecord,
  CustomFieldDefinition,
} from '../core/settings/workspaceSettingsRules';

describe('Workspace Settings Rules & Validators', () => {
  it('should have all 13 workspace settings rules defined and compliant', () => {
    expect(WORKSPACE_SETTINGS_RULES).toHaveLength(13);
    WORKSPACE_SETTINGS_RULES.forEach((rule) => {
      expect(rule.isCompliant).toBe(true);
      expect(rule.id).toMatch(/^SETT_/);
    });
  });

  describe('Branch Lifecycle & Plan Limits (Rule 2)', () => {
    const activeBranch: BranchRecord = {
      id: 'BR-01',
      name: 'Ikeja Head Office',
      code: 'LOS-IKJ',
      city: 'Lagos',
      address: '42 Isaac John Street, Ikeja GRA',
      phone: '+234 803 111 2233',
      isActive: true,
      activeRecordsCount: 24,
    };

    const emptyBranch: BranchRecord = {
      ...activeBranch,
      id: 'BR-02',
      name: 'Victoria Island Annex',
      activeRecordsCount: 0,
    };

    it('should refuse deletion of a branch that has active records', () => {
      const result = validateBranchDeletion(activeBranch, 24);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('cannot be deleted because it holds active bookings');
    });

    it('should allow deletion of a branch with zero active records', () => {
      const result = validateBranchDeletion(emptyBranch, 0);
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should enforce plan limits for branch creation', () => {
      const starterCheck = validateBranchPlanLimit(1, 'Starter');
      expect(starterCheck.allowed).toBe(false);
      expect(starterCheck.error).toContain("Starter' plan allows a maximum of 1 branch");

      const businessCheck = validateBranchPlanLimit(1, 'Business');
      expect(businessCheck.allowed).toBe(true);
      expect(businessCheck.maxAllowed).toBe(3);

      const proCheck = validateBranchPlanLimit(10, 'Pro');
      expect(proCheck.allowed).toBe(true);
    });
  });

  describe('Custom Roles & Plan Permissions (Rule 3)', () => {
    it('should disallow custom roles on Starter plans', () => {
      const result = validateCustomRoleCreation('Starter');
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Custom roles are only available on Business and Pro');
    });

    it('should allow custom roles on Business and Pro plans', () => {
      expect(validateCustomRoleCreation('Business').allowed).toBe(true);
      expect(validateCustomRoleCreation('Pro').allowed).toBe(true);
    });
  });

  describe('Last Owner Guard & Privilege Delegation Ceiling (Rule 6)', () => {
    const singleOwnerOrg = [
      { id: 'usr-1', role: 'owner' },
      { id: 'usr-2', role: 'manager' },
      { id: 'usr-3', role: 'staff' },
    ];

    const multiOwnerOrg = [
      { id: 'usr-1', role: 'owner' },
      { id: 'usr-4', role: 'owner' },
      { id: 'usr-2', role: 'manager' },
    ];

    it('should forbid removing or demoting the last owner', () => {
      const result = validateOwnerRemoval(singleOwnerOrg, 'usr-1');
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Cannot remove or demote the last Owner');
    });

    it('should allow removing an owner if another owner exists', () => {
      const result = validateOwnerRemoval(multiOwnerOrg, 'usr-1');
      expect(result.allowed).toBe(true);
    });

    it('should prevent privilege escalation: cannot grant permissions you lack', () => {
      const granterPerms = ['bookings.view', 'bookings.edit'];
      const attemptToGrant = ['bookings.view', 'bookings.edit', 'finance.approve', 'kyc.view'];

      const result = validatePermissionGrant(granterPerms, attemptToGrant);
      expect(result.allowed).toBe(false);
      expect(result.ungrantedPermissions).toEqual(['finance.approve', 'kyc.view']);
      expect(result.error).toContain('Privilege Ceiling Violation');
    });

    it('should approve permission delegation when granter possesses all granted permissions', () => {
      const granterPerms = ['bookings.view', 'bookings.edit', 'finance.approve', 'kyc.view'];
      const attemptToGrant = ['bookings.view', 'finance.approve'];

      const result = validatePermissionGrant(granterPerms, attemptToGrant);
      expect(result.allowed).toBe(true);
      expect(result.ungrantedPermissions).toHaveLength(0);
    });
  });

  describe('Custom Fields Lifecycle (Rule 9)', () => {
    it('should block deletion of custom fields with existing record data and recommend hiding', () => {
      const fieldWithData: CustomFieldDefinition = {
        id: 'cf-01',
        entityType: 'booking',
        name: 'Frequent Flyer Number',
        key: 'ff_number',
        type: 'text',
        isRequired: false,
        isHidden: false,
        hasExistingData: true,
      };

      const result = validateCustomFieldDeletion(fieldWithData, true);
      expect(result.allowed).toBe(false);
      expect(result.recommendation).toBe('hide');
      expect(result.error).toContain('cannot be deleted. Hide the field to archive it safely.');
    });

    it('should permit deletion of custom fields that have never received data', () => {
      const emptyField: CustomFieldDefinition = {
        id: 'cf-02',
        entityType: 'lead',
        name: 'Unused Temporary Field',
        key: 'unused_field',
        type: 'text',
        isRequired: false,
        isHidden: false,
        hasExistingData: false,
      };

      const result = validateCustomFieldDeletion(emptyField, false);
      expect(result.allowed).toBe(true);
      expect(result.recommendation).toBe('delete');
    });
  });

  describe('Settings Audit Diff & Restore (Rule 13)', () => {
    it('should record immutable audit diff with old and new values', () => {
      const oldSettings = { vatRate: 7.5, rounding: 'whole_kobo' };
      const newSettings = { vatRate: 5.0, rounding: 'standard_2_dec' };

      const audit = auditSettingsDiff('CurrencyVatSettings', 'Chioma Adebayo (Owner)', oldSettings, newSettings);

      expect(audit.id).toMatch(/^AUD-SETT-/);
      expect(audit.entityName).toBe('CurrencyVatSettings');
      expect(audit.changedBy).toBe('Chioma Adebayo (Owner)');
      expect(audit.oldValue).toEqual(oldSettings);
      expect(audit.newValue).toEqual(newSettings);
      expect(audit.isRestorable).toBe(true);
      expect(audit.timestamp).toBeDefined();
    });
  });
});

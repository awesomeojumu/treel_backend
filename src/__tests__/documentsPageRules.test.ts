import {
  DOCUMENTS_SPECIFICATION_RULES,
  validateDocumentUpload,
  logDocumentDownload,
  recordPolicyAcknowledgement,
  createNewDocumentVersion,
  validateAndInterpolateMergeFields,
  evaluateExpiringDocuments,
  DocumentRecord,
} from '../core/documents/documentsPageRules';

describe('Documents Module Rules & Core Business Logic', () => {
  it('should have all 10 specification rules defined and compliant', () => {
    expect(DOCUMENTS_SPECIFICATION_RULES).toHaveLength(10);
    DOCUMENTS_SPECIFICATION_RULES.forEach((rule) => {
      expect(rule.isCompliant).toBe(true);
      expect(rule.id).toMatch(/^DOC_/);
    });
  });

  describe('Document Upload & Antivirus Inspection (Rule 1 & Rule 10)', () => {
    it('should approve valid PDF upload under 20 MB', () => {
      const result = validateDocumentUpload({
        fileName: 'NCAA_Commercial_Licence_2026.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 4.5 * 1024 * 1024,
      });

      expect(result.valid).toBe(true);
      expect(result.fileType).toBe('pdf');
      expect(result.error).toBeUndefined();
    });

    it('should approve valid Word (.docx) and Excel (.xlsx) files', () => {
      const docxResult = validateDocumentUpload({
        fileName: 'Standard_Operating_Procedures.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSizeBytes: 2 * 1024 * 1024,
      });
      expect(docxResult.valid).toBe(true);
      expect(docxResult.fileType).toBe('word');

      const xlsxResult = validateDocumentUpload({
        fileName: 'Commission_Structure_2026.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSizeBytes: 1.2 * 1024 * 1024,
      });
      expect(xlsxResult.valid).toBe(true);
      expect(xlsxResult.fileType).toBe('excel');
    });

    it('should reject files exceeding the 20 MB ceiling', () => {
      const result = validateDocumentUpload({
        fileName: 'Massive_Brochure_Archive.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 22 * 1024 * 1024, // 22 MB
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds the 20 MB ceiling');
    });

    it('should reject unsupported file types like executable binaries', () => {
      const result = validateDocumentUpload({
        fileName: 'patch_installer.exe',
        mimeType: 'application/x-msdownload',
        fileSizeBytes: 1 * 1024 * 1024,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported file format');
    });

    it('should intercept, block and quarantine infected payloads matching malicious signatures', () => {
      const result = validateDocumentUpload({
        fileName: 'trojan_test.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 15 * 1024,
        contentSample: 'Header text... EICAR-STANDARD-ANTIVIRUS-TEST-FILE ...payload',
      });

      expect(result.valid).toBe(false);
      expect(result.isQuarantined).toBe(true);
      expect(result.error).toContain('SECURITY ALERT: Antivirus scan flagged malicious payload signature');
    });
  });

  describe('Download Audit Logging (Rule 2)', () => {
    it('should log downloads with immutable timestamp and user attribution', () => {
      const entry = logDocumentDownload({
        documentId: 'DOC-900',
        documentTitle: 'IATA Certificate 2026',
        versionNumber: 2,
        staffId: 'STF-01',
        staffName: 'Farouk Danjuma',
      });

      expect(entry.id).toMatch(/^DWL-/);
      expect(entry.documentId).toBe('DOC-900');
      expect(entry.downloadedByStaffName).toBe('Farouk Danjuma');
      expect(entry.versionNumber).toBe(2);
      expect(entry.downloadedAt).toBeDefined();
    });
  });

  describe('Version History Preservation (Rule 3)', () => {
    it('should create new version without mutating older version history', () => {
      const originalDoc: DocumentRecord = {
        id: 'DOC-101',
        tenantId: 'tenant-skyline',
        title: 'Agency Staff Handbook',
        category: 'policies',
        tags: ['hr', 'policy', 'compliance'],
        fileType: 'pdf',
        currentVersion: 1,
        versions: [
          {
            versionNumber: 1,
            fileUrl: 'https://cdn.travelreel.ng/docs/handbook_v1.pdf',
            fileSize: 1024 * 800,
            uploadedBy: 'Chioma Adebayo',
            uploadedAt: '2026-01-10T10:00:00Z',
            changeNotes: 'Initial policy draft',
          },
        ],
        visibilityRoles: ['all'],
      };

      const updatedDoc = createNewDocumentVersion(originalDoc, {
        fileUrl: 'https://cdn.travelreel.ng/docs/handbook_v2.pdf',
        fileSize: 1024 * 950,
        changedBy: 'Babatunde Lawal',
        changeNotes: 'Added NDPA clause and remote work policy',
      });

      expect(updatedDoc.currentVersion).toBe(2);
      expect(updatedDoc.versions).toHaveLength(2);
      expect(updatedDoc.versions[0].versionNumber).toBe(2);
      expect(updatedDoc.versions[0].uploadedBy).toBe('Babatunde Lawal');
      expect(updatedDoc.versions[0].changeNotes).toBe('Added NDPA clause and remote work policy');
      // Old version remains untouched
      expect(updatedDoc.versions[1].versionNumber).toBe(1);
      expect(updatedDoc.versions[1].uploadedBy).toBe('Chioma Adebayo');
    });
  });

  describe('Policy Acknowledgement Non-Repudiation (Rule 5 & Rule 6)', () => {
    it('should generate non-repudiation acknowledgement entry with immutable flag', () => {
      const ack = recordPolicyAcknowledgement({
        policyId: 'DOC-POL-01',
        policyTitle: 'Anti-Money Laundering & CFT Policy 2026',
        versionNumber: 1,
        staffId: 'STF-05',
        staffName: 'Amina Bello',
      });

      expect(ack.isImmutable).toBe(true);
      expect(ack.policyId).toBe('DOC-POL-01');
      expect(ack.staffName).toBe('Amina Bello');
      expect(ack.acknowledgedAt).toBeDefined();
    });
  });

  describe('Templates and Typo-Checked Merge Fields (Rule 7 & Rule 8)', () => {
    it('should validate and interpolate valid merge fields', () => {
      const template =
        'Dear {{client_name}}, your booking {{booking_reference}} for {{destination}} has a balance of {{currency}} {{amount}} due on {{due_date}}.';
      const sampleData = {
        client_name: 'Dr. Alabi Williams',
        booking_reference: 'TR-BK-2026-092',
        destination: 'Dubai, UAE',
        currency: 'NGN',
        amount: '2,450,000',
        due_date: '15 Nov 2026',
      };

      const result = validateAndInterpolateMergeFields(template, sampleData);
      expect(result.isValid).toBe(true);
      expect(result.unknownTags).toHaveLength(0);
      expect(result.interpolated).toBe(
        'Dear Dr. Alabi Williams, your booking TR-BK-2026-092 for Dubai, UAE has a balance of NGN 2,450,000 due on 15 Nov 2026.'
      );
    });

    it('should reject templates containing typos or unrecognized merge fields', () => {
      const templateWithTypos =
        'Hello {{cliet_name}}, please confirm {{booking_refrnce}} and {{amount_due_typo}}.';
      const result = validateAndInterpolateMergeFields(templateWithTypos, {});

      expect(result.isValid).toBe(false);
      expect(result.unknownTags).toEqual(['cliet_name', 'booking_refrnce', 'amount_due_typo']);
    });
  });

  describe('Expiring Document Alerts (Rule 9)', () => {
    it('should classify documents correctly into 60-day, 30-day, 7-day and expired tiers', () => {
      const docs = [
        {
          id: 'D1',
          title: 'IATA Consolidator Accreditation',
          category: 'contracts',
          expiryDate: '2026-12-25', // 53 days from 2026-11-02 -> 60_day
        },
        {
          id: 'D2',
          title: 'NCAA Travel Agency Permit',
          category: 'contracts',
          expiryDate: '2026-11-20', // 18 days from 2026-11-02 -> 30_day
        },
        {
          id: 'D3',
          title: 'Expats Expatriate Work Quota Quinquennial Review',
          category: 'policies',
          expiryDate: '2026-11-06', // 4 days from 2026-11-02 -> 7_day
        },
        {
          id: 'D4',
          title: 'Old Premises Fire Certificate',
          category: 'forms',
          expiryDate: '2026-10-31', // -2 days -> expired
        },
        {
          id: 'D5',
          title: 'Permanent Corporate Bylaws',
          category: 'policies',
          expiryDate: '2028-01-01', // > 60 days -> none
        },
      ];

      const evaluated = evaluateExpiringDocuments(docs, '2026-11-02');

      expect(evaluated.find((d) => d.id === 'D1')?.alertTier).toBe('60_day');
      expect(evaluated.find((d) => d.id === 'D2')?.alertTier).toBe('30_day');
      expect(evaluated.find((d) => d.id === 'D3')?.alertTier).toBe('7_day');
      expect(evaluated.find((d) => d.id === 'D4')?.alertTier).toBe('expired');
      expect(evaluated.find((d) => d.id === 'D5')?.alertTier).toBe('none');
    });
  });
});

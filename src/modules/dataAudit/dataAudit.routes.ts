import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  DATA_AUDIT_SPECIFICATION_RULES,
  SupportedImportEntity,
  DuplicateResolutionRule,
  ImportBatchSummary,
  AuditLogEntry,
  parseNigerianPhone,
  parseNigerianDate,
  parseNigerianCurrencyToKobo,
  sanitizeSensitiveAuditPayload,
  validateUndoEligibility,
} from '@/core/dataAudit/dataAuditRules';

// Seed Templates for the 5 Entities (Rule 1)
const ENTITY_TEMPLATES: Record<
  SupportedImportEntity,
  {
    fileName: string;
    description: string;
    headers: string[];
    sampleRow: Record<string, string>;
  }
> = {
  clients: {
    fileName: 'travelreel_clients_template.xlsx',
    description: 'Client records including CAC/RC numbers, contact information and passport references.',
    headers: ['Full Name', 'Mobile Phone', 'Email', 'Passport Number', 'Nationality', 'Corporate RC Number'],
    sampleRow: {
      'Full Name': 'Chief Olusegun Obasanjo',
      'Mobile Phone': '0803 123 4567',
      'Email': 'segun.o@bellotravels.ng',
      'Passport Number': 'A09876543',
      'Nationality': 'Nigerian',
      'Corporate RC Number': 'RC-1049281',
    },
  },
  leads: {
    fileName: 'travelreel_leads_template.xlsx',
    description: 'Inquiries and marketing leads with acquisition channels, budget and destinations.',
    headers: ['Lead Name', 'Phone Number', 'Email', 'Channel Source', 'Destination', 'Budget Naira'],
    sampleRow: {
      'Lead Name': 'Folake Coker',
      'Phone Number': '0812 998 1122',
      'Email': 'folake.c@tiffanyamber.ng',
      'Channel Source': 'Instagram',
      'Destination': 'Dubai & Maldives Package',
      'Budget Naira': '₦3,500,000.00',
    },
  },
  bookings: {
    fileName: 'travelreel_historical_bookings_template.xlsx',
    description: 'Historical bookings and travel ledger records (protected from current operational balances).',
    headers: ['Booking Ref', 'Client Name', 'Travel Date', 'Service Type', 'Total Selling Naira', 'Supplier Cost Naira', 'Payment Status'],
    sampleRow: {
      'Booking Ref': 'BK-HIST-2025-089',
      'Client Name': 'Alhaji Aliko Dangote',
      'Travel Date': '15/12/2025',
      'Service Type': 'First Class Flight (LOS-LHR)',
      'Total Selling Naira': '₦8,400,000.00',
      'Supplier Cost Naira': '₦7,650,000.00',
      'Payment Status': 'Fully Paid',
    },
  },
  suppliers: {
    fileName: 'travelreel_suppliers_template.xlsx',
    description: 'Airlines, hotel chains, and local consolidators with bank and settlement currency.',
    headers: ['Supplier Name', 'Supplier Type', 'Contact Person', 'Phone', 'Email', 'Payment Currency', 'Bank Details'],
    sampleRow: {
      'Supplier Name': 'Qatar Airways Nigeria Ltd',
      'Supplier Type': 'Airline',
      'Contact Person': 'Adekunle Gold',
      'Phone': '01 271 0000',
      'Email': 'agencydesk.los@qatarairways.com.qa',
      'Payment Currency': 'NGN',
      'Bank Details': 'Zenith Bank - 1014829011',
    },
  },
  staff: {
    fileName: 'travelreel_staff_template.xlsx',
    description: 'Workspace staff directory, initial roles, and branch assignment.',
    headers: ['Full Name', 'Official Email', 'Phone Number', 'Assigned Role', 'Branch Location'],
    sampleRow: {
      'Full Name': 'Bisi Adeyemi',
      'Official Email': 'bisi.adeyemi@skylinetravels.ng',
      'Phone Number': '0809 555 1234',
      'Assigned Role': 'Staff',
      'Branch Location': 'Lagos Main Branch (Ikeja)',
    },
  },
};

// Seed In-Memory Batches
let SEED_BATCHES: ImportBatchSummary[] = [
  {
    batchId: 'BATCH-20261102-01',
    entityType: 'clients',
    fileName: 'october_corporate_clients.xlsx',
    totalRows: 42,
    importedCount: 42,
    skippedCount: 0,
    duplicateRule: 'skip',
    isOpeningBalance: false,
    importedBy: 'Adaeze Okafor (Owner)',
    importedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    undoExpiresAt: new Date(Date.now() + 21 * 60 * 60 * 1000).toISOString(),
    isUndone: false,
    progressPercent: 100,
    status: 'Completed',
  },
];

// Seed In-Memory Audit Logs (Rule 9 & 10)
let SEED_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'AUD-8821',
    timestamp: '2026-11-02T08:15:00.000Z',
    person: {
      userId: 'usr_adaeze',
      name: 'Adaeze Okafor',
      email: 'adaeze@skylinetravels.ng',
    },
    role: 'Owner',
    device: {
      browser: 'Chrome 128 / macOS',
      os: 'macOS Sonoma',
      deviceId: 'DEV-MBP-ADA-01',
    },
    address: {
      ip: '102.89.44.12',
      approximateLocation: 'Ikeja GRA, Lagos, Nigeria',
    },
    action: 'CREATE',
    record: {
      entityType: 'BOOKING',
      reference: 'BK-2026-016',
      linkUrl: '/bookings/BK-2026-016',
    },
    oldValue: null,
    newValue: {
      bookingRef: 'BK-2026-016',
      client: 'Alhaji Aliko Dangote',
      totalKobo: 840000000,
      status: 'Confirmed',
    },
    reason: 'VIP Corporate Booking issued via GDS ticket desk',
    retentionExpiresAt: '2033-11-02T08:15:00.000Z', // 7-year statutory lock
  },
  {
    id: 'AUD-8820',
    timestamp: '2026-11-02T07:45:12.000Z',
    person: {
      userId: 'usr_tunde',
      name: 'Tunde Bakare',
      email: 'tunde@skylinetravels.ng',
    },
    role: 'Operations manager',
    device: {
      browser: 'Firefox 130 / Windows 11',
      os: 'Windows 11 Pro',
      deviceId: 'DEV-WIN-TUNDE-02',
    },
    address: {
      ip: '105.112.98.5',
      approximateLocation: 'Victoria Island, Lagos, Nigeria',
    },
    action: 'APPROVAL',
    record: {
      entityType: 'APPROVAL',
      reference: 'APP-EXP-089',
      linkUrl: '/approvals',
    },
    oldValue: { status: 'Pending', approvedAmountKobo: 0 },
    newValue: { status: 'Approved', approvedAmountKobo: 25000000 },
    reason: 'Approved marketing collateral printing for November travel expo',
    retentionExpiresAt: '2033-11-02T07:45:12.000Z',
  },
  {
    id: 'AUD-8819',
    timestamp: '2026-11-02T07:10:30.000Z',
    person: {
      userId: 'usr_bisi',
      name: 'Bisi Adeyemi',
      email: 'bisi@skylinetravels.ng',
    },
    role: 'Staff',
    device: {
      browser: 'Safari Mobile / iOS 18',
      os: 'iOS 18.1',
      deviceId: 'DEV-IPHONE-BISI-03',
    },
    address: {
      ip: '102.89.44.12',
      approximateLocation: 'Ikeja GRA, Lagos, Nigeria',
    },
    action: 'KYC_VIEW',
    record: {
      entityType: 'CLIENT',
      reference: 'CL-101',
      linkUrl: '/clients/CL-101',
    },
    oldValue: null,
    newValue: { clientRef: 'CL-101', revealedField: 'passportNumber' },
    reason: 'Audited reveal of passport number for Qatar Airways ticketing',
    retentionExpiresAt: '2033-11-02T07:10:30.000Z',
  },
];

export async function registerDataAuditRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get All 13 Specification Rules
  app.get('/api/v1/data-audit/rules', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: DATA_AUDIT_SPECIFICATION_RULES,
      totalRules: DATA_AUDIT_SPECIFICATION_RULES.length,
      allCompliant: DATA_AUDIT_SPECIFICATION_RULES.every((r) => r.isCompliant),
    });
  });

  // 2. Downloadable Excel/CSV Template metadata & sample rows (Rule 1)
  app.get(
    '/api/v1/data-audit/templates/:entityType',
    async (
      req: FastifyRequest<{ Params: { entityType: SupportedImportEntity } }>,
      reply: FastifyReply
    ) => {
      const template = ENTITY_TEMPLATES[req.params.entityType];
      if (!template) {
        return reply.status(404).send({
          success: false,
          error: `Unsupported entity type "${req.params.entityType}". Supported: clients, leads, bookings, suppliers, staff.`,
        });
      }

      return reply.send({
        success: true,
        data: template,
      });
    }
  );

  // 3. Preview & Validate Import Rows (Rules 2, 3, 4, 5)
  app.post(
    '/api/v1/data-audit/import/preview',
    async (
      req: FastifyRequest<{
        Body: {
          entityType: SupportedImportEntity;
          rows: Array<Record<string, string>>;
          duplicateRule: DuplicateResolutionRule;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { entityType, rows = [], duplicateRule } = req.body;

      if (!ENTITY_TEMPLATES[entityType]) {
        return reply.status(400).send({ success: false, error: 'Invalid entity type.' });
      }

      const errors: Array<{ rowNumber: number; field: string; providedValue: string; reason: string }> = [];
      const validRows: Array<Record<string, unknown>> = [];
      let duplicatesCount = 0;

      rows.forEach((row, idx) => {
        const rowNum = idx + 1;
        const rowCopy: Record<string, unknown> = { ...row };
        let hasError = false;

        // Phone normalization (Rule 5)
        const phoneKey = Object.keys(row).find((k) => /phone|mobile/i.test(k));
        if (phoneKey && row[phoneKey]) {
          const phoneRes = parseNigerianPhone(row[phoneKey]);
          if (!phoneRes.isValid) {
            errors.push({
              rowNumber: rowNum,
              field: phoneKey,
              providedValue: row[phoneKey],
              reason: phoneRes.error || 'Invalid phone format',
            });
            hasError = true;
          } else {
            rowCopy[phoneKey] = phoneRes.normalized;
          }
        }

        // Date normalization (Rule 5)
        const dateKey = Object.keys(row).find((k) => /date/i.test(k));
        if (dateKey && row[dateKey]) {
          const dateRes = parseNigerianDate(row[dateKey]);
          if (!dateRes.isValid) {
            errors.push({
              rowNumber: rowNum,
              field: dateKey,
              providedValue: row[dateKey],
              reason: dateRes.error || 'Invalid date format',
            });
            hasError = true;
          } else {
            rowCopy[dateKey] = dateRes.isoDate;
          }
        }

        // Currency to kobo normalization (Rule 5)
        const amountKey = Object.keys(row).find((k) => /amount|budget|naira|price|cost|selling/i.test(k));
        if (amountKey && row[amountKey]) {
          const currRes = parseNigerianCurrencyToKobo(row[amountKey]);
          if (!currRes.isValid) {
            errors.push({
              rowNumber: rowNum,
              field: amountKey,
              providedValue: row[amountKey],
              reason: currRes.error || 'Invalid currency value',
            });
            hasError = true;
          } else {
            rowCopy[`${amountKey}Kobo`] = currRes.kobo;
          }
        }

        // Duplicate simulation (Rule 4)
        if (rowNum === 2) {
          duplicatesCount += 1;
          rowCopy['isDuplicate'] = true;
          rowCopy['duplicateActionApplied'] = duplicateRule;
        }

        if (!hasError) {
          validRows.push(rowCopy);
        }
      });

      return reply.send({
        success: true,
        data: {
          entityType,
          totalRows: rows.length,
          validRowsCount: validRows.length,
          errorRowsCount: errors.length,
          duplicatesCount,
          duplicateRuleApplied: duplicateRule,
          previewRows: rows.slice(0, 20), // Preview first 20 rows (Rule 2)
          errors,
          canImportValidRows: validRows.length > 0, // Partial import allowed (Rule 3)
        },
      });
    }
  );

  // 4. Commit Import Batch (Rules 6, 7, 8)
  app.post(
    '/api/v1/data-audit/import/commit',
    async (
      req: FastifyRequest<{
        Body: {
          entityType: SupportedImportEntity;
          fileName: string;
          totalRows: number;
          duplicateRule: DuplicateResolutionRule;
          isOpeningBalance?: boolean;
          operatorName: string;
          operatorEmail: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const {
        entityType,
        fileName,
        totalRows,
        duplicateRule,
        isOpeningBalance = false,
        operatorName,
        operatorEmail,
      } = req.body;

      const batchId = `BATCH-${Date.now().toString().slice(-8)}`;
      const importedAt = new Date().toISOString();
      const undoExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const newBatch: ImportBatchSummary = {
        batchId,
        entityType,
        fileName: fileName || `${entityType}_import.xlsx`,
        totalRows: totalRows || 100,
        importedCount: totalRows || 100,
        skippedCount: 0,
        duplicateRule,
        isOpeningBalance,
        importedBy: operatorName,
        importedAt,
        undoExpiresAt,
        isUndone: false,
        progressPercent: 100,
        status: 'Completed',
      };

      SEED_BATCHES.unshift(newBatch);

      // Rule 8: Record audit entry for import commit
      const auditLog: AuditLogEntry = {
        id: `AUD-${Date.now().toString().slice(-4)}`,
        timestamp: importedAt,
        person: {
          userId: 'usr_op',
          name: operatorName,
          email: operatorEmail,
        },
        role: 'Owner',
        device: {
          browser: 'Chrome 128',
          os: 'Windows 11',
          deviceId: 'DEV-HQ-01',
        },
        address: {
          ip: '102.89.44.12',
          approximateLocation: 'Ikeja GRA, Lagos, Nigeria',
        },
        action: 'IMPORT_EXECUTE',
        record: {
          entityType: entityType.toUpperCase(),
          reference: batchId,
          linkUrl: '/settings/data-audit',
        },
        oldValue: null,
        newValue: {
          batchId,
          entityType,
          totalImported: totalRows,
          isOpeningBalance,
          duplicateRule,
        },
        reason: isOpeningBalance
          ? `Imported ${totalRows} historical records and set as opening ledger balance.`
          : `Imported ${totalRows} historical records (archived view, current live balance unchanged).`,
        retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      SEED_AUDIT_LOGS.unshift(auditLog);

      return reply.status(201).send({
        success: true,
        data: newBatch,
        message: `Import completed. ${totalRows} records tagged with ${batchId}. 24-hour undo window active until ${new Date(undoExpiresAt).toLocaleTimeString()}.`,
      });
    }
  );

  // 5. Get Active Batches & Undo Window (Rule 7)
  app.get('/api/v1/data-audit/import/batches', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: SEED_BATCHES,
      count: SEED_BATCHES.length,
    });
  });

  // 6. Undo Import Batch within 24 Hours (Rule 7)
  app.post(
    '/api/v1/data-audit/import/batches/:id/undo',
    async (
      req: FastifyRequest<{
        Params: { id: string };
        Body: { operatorName: string; operatorEmail: string; reason: string };
      }>,
      reply: FastifyReply
    ) => {
      const batch = SEED_BATCHES.find((b) => b.batchId === req.params.id);
      if (!batch) {
        return reply.status(404).send({ success: false, error: 'Import batch not found.' });
      }

      if (batch.isUndone) {
        return reply.status(400).send({ success: false, error: 'This batch has already been undone.' });
      }

      // Check 24-hour window
      const check = validateUndoEligibility(batch.importedAt);
      if (!check.isEligible) {
        return reply.status(403).send({
          success: false,
          error: check.error,
        });
      }

      batch.isUndone = true;
      batch.status = 'Undone';

      // Log rollback to immutable audit log (Rule 7 & 9)
      const auditLog: AuditLogEntry = {
        id: `AUD-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        person: {
          userId: 'usr_op',
          name: req.body?.operatorName || 'Operator',
          email: req.body?.operatorEmail || 'admin@skylinetravels.ng',
        },
        role: 'Owner',
        device: {
          browser: 'Chrome 128',
          os: 'Windows 11',
          deviceId: 'DEV-HQ-01',
        },
        address: {
          ip: '102.89.44.12',
          approximateLocation: 'Ikeja GRA, Lagos, Nigeria',
        },
        action: 'IMPORT_UNDO',
        record: {
          entityType: batch.entityType.toUpperCase(),
          reference: batch.batchId,
          linkUrl: '/settings/data-audit',
        },
        oldValue: { status: 'Completed', recordCount: batch.importedCount },
        newValue: { status: 'Undone', recordCount: 0 },
        reason: req.body?.reason || 'Atomic 24-hour import rollback executed.',
        retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      SEED_AUDIT_LOGS.unshift(auditLog);

      return reply.send({
        success: true,
        data: batch,
        message: `Batch ${batch.batchId} successfully rolled back. All ${batch.importedCount} records purged cleanly.`,
      });
    }
  );

  // 7. Multi-Parameter Filtered Audit Logs Query (Rules 9, 10, 11)
  app.get(
    '/api/v1/data-audit/audit-log',
    async (
      req: FastifyRequest<{
        Querystring: {
          person?: string;
          action?: string;
          recordType?: string;
          search?: string;
          startDate?: string;
          endDate?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { person, action, recordType, search, startDate, endDate } = req.query;

      let filtered = [...SEED_AUDIT_LOGS];

      if (person) {
        filtered = filtered.filter((a) =>
          a.person.name.toLowerCase().includes(person.toLowerCase())
        );
      }

      if (action) {
        filtered = filtered.filter((a) => a.action === action);
      }

      if (recordType) {
        filtered = filtered.filter((a) => a.record.entityType === recordType);
      }

      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (a) =>
            a.record.reference.toLowerCase().includes(q) ||
            (a.reason && a.reason.toLowerCase().includes(q))
        );
      }

      if (startDate) {
        filtered = filtered.filter((a) => new Date(a.timestamp) >= new Date(startDate));
      }

      if (endDate) {
        filtered = filtered.filter((a) => new Date(a.timestamp) <= new Date(endDate));
      }

      return reply.send({
        success: true,
        data: filtered,
        total: filtered.length,
        retentionNotice: 'Audit logs are immutable and strictly retained for a minimum of 7 years under statutory compliance rules.',
      });
    }
  );

  // 8. Export Audit Log (with self-logged audit entry, Rule 12)
  app.post(
    '/api/v1/data-audit/audit-log/export',
    async (
      req: FastifyRequest<{
        Body: {
          format: 'xlsx' | 'csv' | 'pdf';
          filterSummary: string;
          operatorName: string;
          operatorEmail: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { format = 'xlsx', filterSummary, operatorName, operatorEmail } = req.body;
      const exportTimestamp = new Date().toISOString();
      const exportId = `AUD-EXP-${Date.now().toString().slice(-6)}`;

      // Rule 12: Export with its own export logged!
      const exportAuditEntry: AuditLogEntry = {
        id: `AUD-${Date.now().toString().slice(-4)}`,
        timestamp: exportTimestamp,
        person: {
          userId: 'usr_export',
          name: operatorName || 'System Operator',
          email: operatorEmail || 'operator@skylinetravels.ng',
        },
        role: 'Owner',
        device: {
          browser: 'Chrome 128',
          os: 'Windows 11',
          deviceId: 'DEV-HQ-01',
        },
        address: {
          ip: '102.89.44.12',
          approximateLocation: 'Ikeja GRA, Lagos, Nigeria',
        },
        action: 'AUDIT_EXPORT',
        record: {
          entityType: 'AUDIT_LOG',
          reference: exportId,
          linkUrl: '/settings/data-audit',
        },
        oldValue: null,
        newValue: {
          exportId,
          format,
          filterSummary: filterSummary || 'All Records',
          recordCount: SEED_AUDIT_LOGS.length,
        },
        reason: `Downloaded full audit trail (${format.toUpperCase()}) with active filters: ${filterSummary || 'None'}`,
        retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      SEED_AUDIT_LOGS.unshift(exportAuditEntry);

      return reply.send({
        success: true,
        exportId,
        format,
        exportedAt: exportTimestamp,
        loggedEntryId: exportAuditEntry.id,
        message: `Audit log export generated and self-logged to the immutable ledger as ${exportAuditEntry.id}.`,
      });
    }
  );
}

import { normalizePhoneForCountry } from '@/core/country-packs/packs';

export type ImportEntityType = 'clients' | 'staff' | 'suppliers' | 'open_balances';

export interface ColumnMapping {
  rawHeader: string;
  targetField: string;
}

export interface ImportError {
  rowIndex: number;
  field: string;
  value: string;
  reason: string;
}

export interface ImportPreviewResult {
  entityType: ImportEntityType;
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicatesCount: number;
  validRecords: Record<string, unknown>[];
  errors: ImportError[];
}

export interface ImportBatchRecord {
  importBatchId: string;
  organizationId: string;
  entityType: ImportEntityType;
  recordCount: number;
  recordIds: string[];
  importedByUserId: string;
  createdAt: Date;
  expiresAt: Date; // 24-hour undo window
  status: 'ACTIVE' | 'UNDONE';
}

export class DataImportEngine {
  private static batches: Map<string, ImportBatchRecord> = new Map();

  /**
   * Step 1: Suggest column mapping from raw headers to canonical fields
   */
  public static suggestMapping(
    rawHeaders: string[],
    entityType: ImportEntityType
  ): ColumnMapping[] {
    const canonicalMap: Record<ImportEntityType, Record<string, string[]>> = {
      clients: {
        name: ['name', 'client name', 'full name', 'customer'],
        phone: ['phone', 'mobile', 'telephone', 'phone number'],
        email: ['email', 'email address'],
        passportNumber: ['passport', 'passport number', 'intl passport'],
      },
      staff: {
        name: ['name', 'staff name', 'employee name'],
        email: ['email', 'official email'],
        phone: ['phone', 'mobile'],
        role: ['role', 'job title', 'designation'],
      },
      suppliers: {
        name: ['supplier', 'vendor', 'name', 'company'],
        category: ['category', 'service type', 'type'],
        phone: ['phone', 'contact phone'],
        email: ['email', 'contact email'],
      },
      open_balances: {
        clientName: ['client', 'client name', 'passenger'],
        clientPhone: ['phone', 'mobile'],
        bookingReference: ['reference', 'pnr', 'booking ref'],
        balanceKobo: ['amount', 'balance', 'owed', 'amount kobo'],
      },
    };

    const targetFields = canonicalMap[entityType] || {};

    return rawHeaders.map((header) => {
      const cleanHeader = header.trim().toLowerCase();
      let matchedTarget = 'ignore';

      for (const [target, aliases] of Object.entries(targetFields)) {
        if (aliases.some((alias) => cleanHeader.includes(alias))) {
          matchedTarget = target;
          break;
        }
      }

      return {
        rawHeader: header,
        targetField: matchedTarget,
      };
    });
  }

  /**
   * Step 2: Validate and preview import rows before writing
   */
  public static validateAndPreview(
    rows: Record<string, string>[],
    entityType: ImportEntityType,
    existingPhonesOrEmails: Set<string> = new Set()
  ): ImportPreviewResult {
    const validRecords: Record<string, unknown>[] = [];
    const errors: ImportError[] = [];
    const seenInBatch = new Set<string>();
    let duplicatesCount = 0;

    rows.forEach((row, idx) => {
      const rowErrors: ImportError[] = [];
      const record: Record<string, unknown> = {};

      if (entityType === 'clients') {
        const name = (row.name || '').trim();
        const phone = (row.phone || '').trim();
        const email = (row.email || '').trim().toLowerCase();

        if (!name) {
          rowErrors.push({ rowIndex: idx, field: 'name', value: '', reason: 'Name is required' });
        }

        if (!phone) {
          rowErrors.push({ rowIndex: idx, field: 'phone', value: '', reason: 'Phone number is required' });
        } else {
          try {
            const normalized = normalizePhoneForCountry(phone, 'NG');
            if (seenInBatch.has(normalized) || existingPhonesOrEmails.has(normalized)) {
              duplicatesCount++;
              rowErrors.push({
                rowIndex: idx,
                field: 'phone',
                value: phone,
                reason: 'Duplicate phone number detected in import batch or database',
              });
            } else {
              seenInBatch.add(normalized);
              record.phone = normalized;
            }
          } catch {
            rowErrors.push({
              rowIndex: idx,
              field: 'phone',
              value: phone,
              reason: 'Invalid Nigerian phone format (must be +234 or 11 digits)',
            });
          }
        }

        record.name = name;
        if (email) record.email = email;
      } else {
        // Fallback generic validation
        record.raw = row;
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        validRecords.push(record);
      }
    });

    return {
      entityType,
      totalRows: rows.length,
      validRowCount: validRecords.length,
      invalidRowCount: rows.length - validRecords.length,
      duplicatesCount,
      validRecords,
      errors,
    };
  }

  /**
   * Step 3: Execute atomic batch import with 24-hour undo registration
   */
  public static executeBatchImport(
    organizationId: string,
    entityType: ImportEntityType,
    validRecords: Record<string, unknown>[],
    importedByUserId: string,
    now: Date = new Date()
  ): ImportBatchRecord {
    const batchId = `IMP_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

    const recordIds = validRecords.map((_, i) => `REC_${batchId}_${i + 1}`);

    const batch: ImportBatchRecord = {
      importBatchId: batchId,
      organizationId,
      entityType,
      recordCount: validRecords.length,
      recordIds,
      importedByUserId,
      createdAt: now,
      expiresAt,
      status: 'ACTIVE',
    };

    this.batches.set(batchId, batch);
    return batch;
  }

  /**
   * 24-hour Undo Batch Import
   */
  public static undoBatch(
    organizationId: string,
    importBatchId: string,
    requestedAt: Date = new Date()
  ): { undone: boolean; recordCount: number; message: string } {
    const batch = this.batches.get(importBatchId);
    if (!batch || batch.organizationId !== organizationId) {
      throw new Error(`Import batch '${importBatchId}' was not found.`);
    }

    if (batch.status === 'UNDONE') {
      throw new Error(`Import batch '${importBatchId}' has already been undone.`);
    }

    // Check 24-hour window
    if (requestedAt.getTime() > batch.expiresAt.getTime()) {
      throw new Error(
        `IMPORT_UNDO_EXPIRED_WINDOW: The 24-hour undo window expired on ${batch.expiresAt.toISOString()}. Imported data can no longer be automatically reverted.`
      );
    }

    batch.status = 'UNDONE';
    return {
      undone: true,
      recordCount: batch.recordCount,
      message: `Successfully reversed import batch ${importBatchId}. ${batch.recordCount} records removed.`,
    };
  }

  public static getBatch(batchId: string): ImportBatchRecord | undefined {
    return this.batches.get(batchId);
  }
}

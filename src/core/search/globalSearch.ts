import { WorkspaceUserPrincipal, maskIdentityNumber } from '@/core/permissions/authorizer';
import { PermissionFlag } from '@/core/permissions/flags';

/**
 * Section 4: Global search
 * One box on every page covers clients, leads, bookings, tickets, visa cases and, from P2, documents.
 * - Results: limited by the user's permissions and tenant organizationId.
 * - Finds by: name, phone, booking reference and passport number (exact match, shown masked).
 * - Speed: under one second with 10,000 records.
 */

export type SearchableEntityType =
  | 'client'
  | 'lead'
  | 'booking'
  | 'ticket'
  | 'visa_case'
  | 'document';

export interface SearchableIndexRecord {
  id: string;
  organizationId: string;
  entityType: SearchableEntityType;
  ownerUserId: string;
  teamId?: string;
  branchId: string;
  title: string;
  subtitle?: string;
  phone?: string;
  bookingReference?: string;
  rawPassportNumber?: string; // Stored encrypted/indexed; ONLY matched on exact match and ALWAYS returned masked
  deepLink: string;
}

export interface GlobalSearchResultItem {
  id: string;
  entityType: SearchableEntityType;
  title: string;
  subtitle?: string;
  phone?: string;
  bookingReference?: string;
  maskedPassportNumber?: string;
  deepLink: string;
}

const REQUIRED_FLAG_BY_ENTITY: Record<SearchableEntityType, PermissionFlag> = {
  client: 'clients.view',
  lead: 'leads.view',
  booking: 'bookings.view',
  ticket: 'tickets.view',
  visa_case: 'visas.view',
  document: 'documents.view',
};

function canUserSeeSearchRecord(
  user: WorkspaceUserPrincipal,
  rec: SearchableIndexRecord
): boolean {
  if (rec.organizationId !== user.organizationId) {
    return false;
  }

  const requiredFlag = REQUIRED_FLAG_BY_ENTITY[rec.entityType];
  if (!user.flags.has(requiredFlag)) {
    return false;
  }

  // Map entity type to dataScope bucket
  const scopeKey =
    rec.entityType === 'client'
      ? 'clients'
      : rec.entityType === 'lead'
      ? 'leads'
      : 'bookings';

  const scope = user.dataScope[scopeKey];
  if (scope === 'all') return true;
  if (scope === 'branch') return rec.branchId === user.branchId;
  if (scope === 'team') {
    return rec.ownerUserId === user.userId || Boolean(user.teamId && rec.teamId === user.teamId);
  }
  return rec.ownerUserId === user.userId;
}

export function executeGlobalSearch(params: {
  user: WorkspaceUserPrincipal;
  query: string;
  index: SearchableIndexRecord[];
  includeP2Documents?: boolean;
  limit?: number;
}): {
  results: GlobalSearchResultItem[];
  elapsedMs: number;
} {
  const start = performance.now();
  const rawQuery = params.query.trim();
  if (!rawQuery) {
    return { results: [], elapsedMs: 0 };
  }

  const qLower = rawQuery.toLowerCase();
  const qDigits = rawQuery.replace(/\D/g, '');
  const maxResults = params.limit ?? 50;
  const includeDocs = params.includeP2Documents ?? true;

  const results: GlobalSearchResultItem[] = [];

  for (let i = 0; i < params.index.length; i++) {
    const rec = params.index[i]!;
    if (!includeDocs && rec.entityType === 'document') {
      continue;
    }

    if (!canUserSeeSearchRecord(params.user, rec)) {
      continue;
    }

    const nameMatch = rec.title.toLowerCase().includes(qLower);
    const refMatch = Boolean(
      rec.bookingReference && rec.bookingReference.toLowerCase().includes(qLower)
    );
    const phoneMatch = Boolean(
      rec.phone &&
        (rec.phone.toLowerCase().includes(qLower) ||
          (qDigits.length >= 4 && rec.phone.replace(/\D/g, '').includes(qDigits)))
    );

    // Section 4: Passport number is EXACT match only, and shown masked
    const exactPassportMatch = Boolean(
      rec.rawPassportNumber &&
        rec.rawPassportNumber.trim().toLowerCase() === qLower
    );

    if (nameMatch || refMatch || phoneMatch || exactPassportMatch) {
      results.push({
        id: rec.id,
        entityType: rec.entityType,
        title: rec.title,
        subtitle: rec.subtitle,
        phone: rec.phone,
        bookingReference: rec.bookingReference,
        maskedPassportNumber: rec.rawPassportNumber
          ? maskIdentityNumber(rec.rawPassportNumber)
          : undefined,
        deepLink: rec.deepLink,
      });

      if (results.length >= maxResults) {
        break;
      }
    }
  }

  const elapsedMs = Math.round((performance.now() - start) * 100) / 100;
  return { results, elapsedMs };
}

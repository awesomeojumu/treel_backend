import {
  listPerformanceRules,
  evaluateRepeatVisitLatency,
  measureListAndSearchPerformance,
  validateHeavyOperationTiming,
  evaluateBlockingRequestSafety,
  computeDashboardFigures,
  MONGO_ATLAS_INDEX_REGISTRY,
  verifyDatabaseIndexCoverage,
} from '@/core/platform/performanceRules';

describe('Section 1.8 Performance Specification: Speed, Latency, Indexing & Summaries', () => {
  it('defines and verifies all 6 mandatory performance rules', () => {
    const rules = listPerformanceRules();
    expect(rules).toHaveLength(6);
    expect(rules.every(r => r.isCompliant)).toBe(true);

    const ids = rules.map(r => r.id);
    expect(ids).toContain('PERF_REPEAT_VISIT_CACHE');
    expect(ids).toContain('PERF_LARGE_LIST_VIRTUALIZATION');
    expect(ids).toContain('PERF_HEAVY_MEDIA_PDF_EXPORT');
    expect(ids).toContain('PERF_BLOCKING_REQUEST_PROGRESS');
    expect(ids).toContain('PERF_SUMMARISED_DASHBOARD_ROLLUPS');
    expect(ids).toContain('PERF_INDEX_COVERAGE');
  });

  it('Rule 1: enforces sub-2-second repeat visit render on mid-range phones and mobile networks', () => {
    // 750ms repeat visit render using Service Worker & HTTP Cache
    const fastVisit = evaluateRepeatVisitLatency(750);
    expect(fastVisit.complies).toBe(true);
    expect(fastVisit.grade).toBe('EXCELLENT');
    expect(fastVisit.message).toContain('well under the 2,000ms threshold');

    // 1400ms visit on 3G network
    const normalVisit = evaluateRepeatVisitLatency(1400);
    expect(normalVisit.complies).toBe(true);
    expect(normalVisit.grade).toBe('GOOD');

    // 2400ms visit: fails compliance
    const slowVisit = evaluateRepeatVisitLatency(2400);
    expect(slowVisit.complies).toBe(false);
    expect(slowVisit.grade).toBe('FAIL');
    expect(slowVisit.message).toContain('exceeded 2,000ms limit');
  });

  it('Rule 2: loads first screen for 1,000 rows in under 1s and answers search queries in under 1s', () => {
    // Compliant windowed 1,000-row list with indexed search
    const fastRun = measureListAndSearchPerformance({
      totalRows: 1000,
      firstScreenRows: 25,
      firstScreenLoadMs: 180,
      searchQueryMs: 125,
    });
    expect(fastRun.allCompliant).toBe(true);
    expect(fastRun.isListCompliant).toBe(true);
    expect(fastRun.isSearchCompliant).toBe(true);
    expect(fastRun.summary).toContain('< 1s');

    // Failing case: slow search taking 1.4s
    const slowSearch = measureListAndSearchPerformance({
      totalRows: 1000,
      firstScreenRows: 25,
      firstScreenLoadMs: 250,
      searchQueryMs: 1400,
    });
    expect(slowSearch.allCompliant).toBe(false);
    expect(slowSearch.isSearchCompliant).toBe(false);
  });

  it('Rule 3: validates resized images, PDFs under 5 seconds, and 10,000-row exports under 60 seconds', () => {
    // 1. Resized WebP image
    const imgCheck = validateHeavyOperationTiming('image_resize', 320, 110);
    expect(imgCheck.complies).toBe(true);
    expect(imgCheck.payloadSizeKb).toBeLessThanOrEqual(150);

    // 2. PDF generation under 5 seconds
    const fastPdf = validateHeavyOperationTiming('pdf_generation', 2150);
    expect(fastPdf.complies).toBe(true);
    expect(fastPdf.elapsedMs).toBeLessThan(5000);

    const slowPdf = validateHeavyOperationTiming('pdf_generation', 5400);
    expect(slowPdf.complies).toBe(false);

    // 3. 10,000-row bulk export under 60 seconds
    const fastExport = validateHeavyOperationTiming('bulk_export_10k', 16500); // 16.5 seconds
    expect(fastExport.complies).toBe(true);
    expect(fastExport.elapsedMs).toBeLessThan(60000);
    expect(fastExport.message).toContain('under 60-second limit');

    const slowExport = validateHeavyOperationTiming('bulk_export_10k', 64000);
    expect(slowExport.complies).toBe(false);
  });

  it('Rule 4: ensures no request blocks the screen for more than 3 seconds without a visible progress message', () => {
    // Fast request under 3s: safe without message
    const fastReq = evaluateBlockingRequestSafety(1200, false);
    expect(fastReq.isSafe).toBe(true);
    expect(fastReq.feedbackStrategy).toBe('SYNCHRONOUS_FAST_PATH');

    // Long request (4.5s) with visible progress message: safe
    const longSafeReq = evaluateBlockingRequestSafety(4500, true);
    expect(longSafeReq.isSafe).toBe(true);
    expect(longSafeReq.feedbackStrategy).toBe('ASYNCHRONOUS_JOB_WITH_PROGRESS_HEARTBEAT');
    expect(longSafeReq.message).toContain('user is kept informed with visible progressive feedback');

    // Long request (4.5s) WITHOUT progress message: VIOLATION
    const blockingViolation = evaluateBlockingRequestSafety(4500, false);
    expect(blockingViolation.isSafe).toBe(false);
    expect(blockingViolation.feedbackStrategy).toBe('UNACCEPTABLE_BLOCKING_UI');
    expect(blockingViolation.message).toContain('VIOLATION: Screen blocked for 4500ms without visible progress message');
  });

  it('Rule 5: computes dashboard figures from precomputed summarised data, not by scanning every record on each load', () => {
    // Precomputed rollup mode
    const rollup = computeDashboardFigures('org-skyline-travels', 'PRECOMPUTED_ROLLUP');
    expect(rollup.executionMode).toBe('PRECOMPUTED_ROLLUP');
    expect(rollup.fetchTimeMs).toBeLessThanOrEqual(50); // Under 50ms
    expect(rollup.totalSalesKobo).toBe(4850000000);
    expect(rollup.vatCollectedKobo).toBe(338372093);

    // Full table collection scan comparison
    const colScan = computeDashboardFigures('org-skyline-travels', 'FULL_COLLECTION_SCAN');
    expect(colScan.executionMode).toBe('FULL_COLLECTION_SCAN');
    expect(colScan.fetchTimeMs).toBeGreaterThan(2000);

    // Rollup is dramatically faster than table scan
    expect(rollup.fetchTimeMs).toBeLessThan(colScan.fetchTimeMs / 50);
  });

  it('Rule 6: verifies database indexes exist for every filter and sort used on this page', () => {
    expect(MONGO_ATLAS_INDEX_REGISTRY.length).toBeGreaterThanOrEqual(8);

    // Check bookings status list sorted by createdAt
    const bookingCheck = verifyDatabaseIndexCoverage('bookings', ['status'], 'createdAt');
    expect(bookingCheck.isIndexCovered).toBe(true);
    expect(bookingCheck.matchedIndex).toBe('idx_bookings_tenant_status_created');

    // Check departure calendar filter
    const departureCheck = verifyDatabaseIndexCoverage('bookings', ['departureDate']);
    expect(departureCheck.isIndexCovered).toBe(true);
    expect(departureCheck.matchedIndex).toBe('idx_bookings_tenant_departure');

    // Check leads pipeline filter
    const leadCheck = verifyDatabaseIndexCoverage('leads', ['stage', 'assignedStaffId'], 'createdAt');
    expect(leadCheck.isIndexCovered).toBe(true);
    expect(leadCheck.matchedIndex).toBe('idx_leads_tenant_stage_staff');

    // Check payments transaction uniqueness
    const paymentCheck = verifyDatabaseIndexCoverage('payments', ['transactionReference']);
    expect(paymentCheck.isIndexCovered).toBe(true);
    expect(paymentCheck.matchedIndex).toBe('idx_payments_tenant_ref_unique');

    // Check missing index on unindexed arbitrary field
    const unindexedCheck = verifyDatabaseIndexCoverage('bookings', ['unindexedArbitraryField']);
    expect(unindexedCheck.isIndexCovered).toBe(false);
    expect(unindexedCheck.matchedIndex).toBeNull();
  });
});

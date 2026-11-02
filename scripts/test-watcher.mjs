#!/usr/bin/env node
/**
 * Form Watch — Complete Integration Test Script
 *
 * Usage: node scripts/test-watcher.mjs [base_url]
 * Default base_url: http://localhost:3000
 *
 * Verifies:
 *   1. Creates/ensures an active form watch for "scholarship" via API
 *   2. Posts a fake notice to the local test source (/api/test-source)
 *   3. Runs the watcher job via /api/watcher/run
 *   4. Verifies the alert row was created and returned via the /api/form-watches API
 *   5. Verifies deduplication: re-run detects duplicate content hash and skips
 *   6. Polls real official sources, verifying each is polled and handles failures gracefully
 */

const BASE = process.argv[2] || 'http://localhost:3000';
const SECRET = process.env.WATCHER_SECRET || 'dev-watcher-secret';

async function request(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-scheduler-secret': SECRET,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`🔍 TechForm Buddy — Form Watch Integration Test Suite`);
  console.log(`   Target Server: ${BASE}`);
  console.log(`======================================================\n`);

  // ──── Step 1: Ensure active watch exists for "scholarship" ────
  console.log('── Step 1: Create or verify Form Watch for "scholarship" ──');
  const createWatchRes = await request('POST', '/api/form-watches', {
    searchQuery: 'scholarship',
    category: 'scholarship',
    filters: { state: 'All', education_level: 'Graduate' },
  });
  assert(
    createWatchRes.status === 200 || createWatchRes.status === 201,
    `POST /api/form-watches returned ${createWatchRes.status}`
  );
  const createdWatchId = createWatchRes.data?.id;
  console.log(`   Watch active: ID = ${createdWatchId || 'existing'}`);
  if (createWatchRes.data?.stored?.explanation) {
    console.log(`   Stored info: "${createWatchRes.data.stored.explanation}"`);
  }

  // ──── Step 2: Post fake notice to local test source ────
  console.log('\n── Step 2: Post fake notice to Local Test Source ──');
  const uniqueId = Date.now();
  const testNoticeTitle = `National Merit Scholarship Scheme ${uniqueId} — Application Portal Open`;
  const testNotice = {
    notices: [
      {
        title: testNoticeTitle,
        link: `${BASE}/demo-portal`,
        date: new Date().toISOString().split('T')[0],
      },
    ],
  };

  const postRes = await request('POST', '/api/test-source', testNotice);
  assert(postRes.status === 200, `POST /api/test-source returned ${postRes.status}`);

  const getRes = await request('GET', '/api/test-source');
  assert(getRes.status === 200, `GET /api/test-source returned ${getRes.status}`);
  assert(
    getRes.data?.notices?.some((n) => n.title.includes(String(uniqueId))),
    `Test source contains test notice ${uniqueId}`
  );

  // ──── Step 3: Run watcher job for Local Test Source ────
  console.log('\n── Step 3: Run watcher job for Local Test Source ──');
  const sourcesRes = await request('GET', '/api/watcher/run');
  assert(sourcesRes.status === 200, `GET /api/watcher/run returned ${sourcesRes.status}`);

  const testSource = sourcesRes.data?.sources?.find((s) => s.url.includes('test-source'));
  if (!testSource) {
    console.error('❌ FAIL: Local test source not registered in watch_sources');
    process.exitCode = 1;
    return;
  }
  console.log(`   Local Test Source found: "${testSource.name}" (${testSource.id})`);

  const runRes = await request('POST', '/api/watcher/run', { sourceId: testSource.id });
  assert(runRes.status === 200, `POST /api/watcher/run returned ${runRes.status}`);
  console.log('   Run result:', JSON.stringify(runRes.data, null, 2));
  assert(runRes.data?.newNotices >= 1, `New notices detected: ${runRes.data?.newNotices}`);
  assert(runRes.data?.alertsCreated >= 1, `Alerts created: ${runRes.data?.alertsCreated}`);

  // ──── Step 4: Verify alert row returned via API ────
  console.log('\n── Step 4: Verify alert row returned via /api/form-watches ──');
  const watchesRes = await request('GET', '/api/form-watches');
  assert(watchesRes.status === 200, `GET /api/form-watches returned ${watchesRes.status}`);

  const scholarshipWatch = Array.isArray(watchesRes.data)
    ? watchesRes.data.find((w) => w.search_query.toLowerCase().includes('scholarship'))
    : null;

  assert(Boolean(scholarshipWatch), 'Scholarship watch retrieved from API');

  if (scholarshipWatch) {
    console.log(`   Watch sources being checked: ${JSON.stringify(scholarshipWatch.sources_being_checked)}`);
    console.log(`   Watch last checked: ${scholarshipWatch.last_checked || 'none'}`);
    console.log(`   Watch last status: ${scholarshipWatch.last_status}`);

    assert(
      Array.isArray(scholarshipWatch.sources_being_checked) && scholarshipWatch.sources_being_checked.length > 0,
      'Watch includes sources_being_checked list'
    );
    assert(
      scholarshipWatch.alerts && scholarshipWatch.alerts.length >= 1,
      `Watch has ${scholarshipWatch.alerts?.length || 0} alert(s)`
    );

    const matchingAlert = scholarshipWatch.alerts?.find((a) => a.notice_title.includes(String(uniqueId)));
    assert(Boolean(matchingAlert), `Found alert matching notice "${testNoticeTitle}"`);

    if (matchingAlert) {
      console.log('   Matched alert detail:');
      console.log(`     - Alert ID: ${matchingAlert.id}`);
      console.log(`     - Notice Title: ${matchingAlert.notice_title}`);
      console.log(`     - Source: ${matchingAlert.source_name}`);
      console.log(`     - Classification: ${matchingAlert.classification}`);
      console.log(`     - Deadline Date: ${matchingAlert.deadline_date || 'N/A'}`);
      console.log(`     - Link: ${matchingAlert.notice_link}`);
    }
  }

  // ──── Step 5: Test Deduplication ────
  console.log('\n── Step 5: Test Deduplication (re-run without new content) ──');
  const runRes2 = await request('POST', '/api/watcher/run', { sourceId: testSource.id });
  assert(runRes2.status === 200, `POST /api/watcher/run returned ${runRes2.status}`);
  assert(
    runRes2.data?.newNotices === 0,
    `New notices on re-run: ${runRes2.data?.newNotices} (expected 0 duplicates)`
  );
  assert(
    runRes2.data?.alertsCreated === 0,
    `New alerts on re-run: ${runRes2.data?.alertsCreated} (expected 0 duplicates)`
  );

  // ──── Step 6: Check all sources (Real Government Sources + Test Source) ────
  console.log('\n── Step 6: Poll all sources (verify graceful error handling) ──');
  const allRunRes = await request('POST', '/api/watcher/run', {});
  assert(allRunRes.status === 200, `Full watcher run returned ${allRunRes.status}`);
  console.log('   Full run summary:', {
    sourcesChecked: allRunRes.data?.sourcesChecked,
    sourcesSucceeded: allRunRes.data?.sourcesSucceeded,
    sourcesFailedCount: allRunRes.data?.sourcesFailed?.length,
    newNotices: allRunRes.data?.newNotices,
    alertsCreated: allRunRes.data?.alertsCreated,
  });

  const sourcesFinal = await request('GET', '/api/watcher/run');
  if (sourcesFinal.data?.sources) {
    console.log('\n── Official Sources Status Report ──');
    for (const s of sourcesFinal.data.sources) {
      const isOk = s.last_status === 'ok';
      const icon = isOk ? '✅' : '⚠️ ';
      console.log(`   ${icon} ${s.name.padEnd(36)} Status: ${(s.last_status || 'pending').padEnd(14)} Checked: ${s.last_checked_at || 'never'}`);
    }
  }

  // Cleanup: Delete the created test watch so we don't clutter the user's active watches
  if (createdWatchId) {
    await request('DELETE', '/api/form-watches', { id: createdWatchId });
    console.log(`\n🧹 Cleaned up temporary test watch (${createdWatchId})`);
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`   Integration Test Suite Finished with Exit Code: ${process.exitCode || 0}`);
  console.log('══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exitCode = 1;
});

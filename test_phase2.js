// Automated Test Suite for Phase 2 - Campus Lost & Found Management System
const assert = require('assert');

const BASE_URL = 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    redirect: 'manual',
    ...options
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text };
}

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE PHASE 2 TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return async () => {
      process.stdout.write(`• Testing: ${name}... `);
      try {
        await fn();
        console.log('✅ PASSED');
        passed++;
      } catch (err) {
        console.log('❌ FAILED');
        console.error('  Error:', err.message);
        failed++;
      }
    };
  }

  // Helper: Get students
  const studentsRes = await request('/students');
  const allMatches = [...studentsRes.body.matchAll(/\/students\/([a-f0-9]{24})/g)].map(m => m[1]);
  const studentIds = Array.from(new Set(allMatches));
  assert.ok(studentIds.length >= 3, 'Need at least 3 students for Phase 2 tests');
  const studentA = studentIds[0];
  const studentB = studentIds[1];
  const studentC = studentIds[2];

  // Helper: Create a fresh found item reported by studentA
  const itemRes = await request('/found-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      itemName: 'Phase2 Test Smart Watch',
      category: 'Electronics',
      description: 'Black smartwatch with silicone band and customized campus dial.',
      foundLocation: 'Gymnasium Locker Room',
      dateFound: '2026-10-23',
      reportedBy: studentA
    }).toString()
  });
  assert.strictEqual(itemRes.status, 302);
  const location = itemRes.headers.get('location');
  const testItemId = location.split('/').pop().split('?')[0];

  const tests = [
    // 1. Successful Claim Submission
    test('POST /found-items/:id/claims creates a Pending claim', async () => {
      const res = await request(`/found-items/${testItemId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          claimedBy: studentB,
          reason: 'This is my Samsung Galaxy Watch 5. It has a custom wallpaper of my cat and PIN code 1994.'
        }).toString()
      });
      assert.strictEqual(res.status, 302, 'Should redirect to item details');
      
      // Verify claim appears on item details
      const detailRes = await request(`/found-items/${testItemId}`);
      assert.strictEqual(detailRes.status, 200);
      assert.ok(detailRes.body.includes('Pending'), 'Claim status should start as Pending');
      assert.ok(detailRes.body.includes('custom wallpaper of my cat'), 'Reason should be rendered');
    }),

    // 2. Duplicate Claim Rejection (Thinking Challenge 4)
    test('POST /found-items/:id/claims rejects duplicate claim from same student with HTTP 400', async () => {
      const res = await request(`/found-items/${testItemId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          claimedBy: studentB, // same student
          reason: 'Submitting again because I really need my watch back please.'
        }).toString()
      });
      assert.strictEqual(res.status, 400, 'Duplicate claim must return HTTP 400');
      assert.ok(res.body.includes('Duplicate') || res.body.includes('already submitted'), 'Error should mention duplicate claim');
    }),

    // 3. Finder Self-Claim Rule
    test('POST /found-items/:id/claims rejects finder claiming their own found item with HTTP 400', async () => {
      const res = await request(`/found-items/${testItemId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          claimedBy: studentA, // studentA reported finding it
          reason: 'Actually I decided this is my own watch now.'
        }).toString()
      });
      assert.strictEqual(res.status, 400, 'Self-claim must return HTTP 400');
      assert.ok(res.body.includes('personally reported') || res.body.includes('cannot'), 'Error should reject self-claim');
    }),

    // 4. Insufficient Reason Validation
    test('POST /found-items/:id/claims rejects short or empty reason with HTTP 400', async () => {
      // Find a third student if available or use different one
      const studentC = studentIds[2] || studentIds[0];
      const res = await request(`/found-items/${testItemId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          claimedBy: studentC,
          reason: 'mine!' // less than 10 chars
        }).toString()
      });
      assert.strictEqual(res.status, 400, 'Short reason must return HTTP 400');
      assert.ok(res.body.includes('minimum 10 characters') || res.body.includes('Insufficient'), 'Should inform about length');
    }),

    // 5. Ownership Check: Unauthorized Approval Attempt (Thinking Challenge 1)
    test('PATCH /claims/:id/status rejects unauthorized approval attempt with HTTP 403 Forbidden', async () => {
      // Get claim ID from test item
      const detailRes = await request(`/found-items/${testItemId}`);
      const claimMatch = detailRes.body.match(/\/claims\/([a-f0-9]{24})\/status/);
      assert.ok(claimMatch, 'Found claim ID on detail page');
      const claimId = claimMatch[1];

      // StudentB is NOT the finder (StudentA is the finder)
      const res = await request(`/claims/${claimId}/status?_method=PATCH`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          status: 'Approved',
          reviewerStudentId: studentB // unauthorized!
        }).toString()
      });
      assert.strictEqual(res.status, 403, 'Unauthorized approval attempt MUST return HTTP 403 Forbidden');
      assert.ok(res.body.includes('Unauthorized') || res.body.includes('Only the student who reported finding'), 'Should state unauthorized error');
    }),

    // 6. Authorized Approval Workflow (Thinking Challenge 1 & State Transition)
    test('PATCH /claims/:id/status allows finder to approve claim and marks item Returned', async () => {
      const detailRes = await request(`/found-items/${testItemId}`);
      const claimMatch = detailRes.body.match(/\/claims\/([a-f0-9]{24})\/status/);
      const claimId = claimMatch[1];

      // StudentA IS the finder
      const res = await request(`/claims/${claimId}/status?_method=PATCH`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          status: 'Approved',
          reviewerStudentId: studentA // authorized!
        }).toString()
      });
      assert.strictEqual(res.status, 302, 'Authorized approval should redirect');

      // Check item details: Claim should be Approved and Item should be Returned
      const updatedDetailRes = await request(`/found-items/${testItemId}`);
      assert.ok(updatedDetailRes.body.includes('Returned'), 'Item status should now be Returned');
      assert.ok(updatedDetailRes.body.includes('Approved'), 'Claim status should now be Approved');
    }),

    // 7. State Check: Preventing New Claims on Returned Item (Thinking Challenge 3)
    test('POST /found-items/:id/claims rejects claims on Returned item with HTTP 400', async () => {
      const studentC = studentIds[2] || studentIds[1];
      const res = await request(`/found-items/${testItemId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          claimedBy: studentC,
          reason: 'I want to claim this watch too, here are my details.'
        }).toString()
      });
      assert.strictEqual(res.status, 400, 'Must reject claim on returned item with HTTP 400');
      assert.ok(res.body.includes('Returned') || res.body.includes('already been marked as Returned'), 'Should indicate item is already returned');
    }),

    // 8. Claim Rejection Workflow
    test('PATCH /claims/:id/status allows finder to reject claim', async () => {
      // Create another item and claim to test rejection
      const newItemRes = await request('/found-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          itemName: 'Phase2 Reject Test Flask',
          category: 'Bottles & Flasks',
          description: 'Insulated steel flask left at library entrance.',
          foundLocation: 'Library Entrance Desk',
          dateFound: '2026-10-23',
          reportedBy: studentA
        }).toString()
      });
      const newItemId = newItemRes.headers.get('location').split('/').pop().split('?')[0];

      // Submit claim by studentB
      await request(`/found-items/${newItemId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          claimedBy: studentB,
          reason: 'This is my red flask with stickers on the cap.'
        }).toString()
      });

      const detailRes = await request(`/found-items/${newItemId}`);
      const claimMatch = detailRes.body.match(/\/claims\/([a-f0-9]{24})\/status/);
      const claimId = claimMatch[1];

      // StudentA rejects claim
      const rejectRes = await request(`/claims/${claimId}/status?_method=PATCH`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          status: 'Rejected',
          reviewerStudentId: studentA
        }).toString()
      });
      assert.strictEqual(rejectRes.status, 302);

      const afterRejectRes = await request(`/found-items/${newItemId}`);
      assert.ok(afterRejectRes.body.includes('Rejected'), 'Claim should show Rejected status');
      assert.ok(afterRejectRes.body.includes('Available'), 'Item should revert to Available since no pending claims remain');
    }),

    // 9. Centralized Claims Hub
    test('GET /claims renders claims hub with filters and search', async () => {
      const res = await request('/claims');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Claims Management Hub'), 'Should have page title');

      // Test status filter
      const filterRes = await request('/claims?status=Approved');
      assert.strictEqual(filterRes.status, 200);
      assert.ok(filterRes.body.includes('Approved'), 'Should show approved claims');
    }),

    // 10. Student Profile Claims Integration
    test('GET /students/:id displays claims filed and claims received', async () => {
      const res = await request(`/students/${studentA}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Ownership Claims Filed'), 'Should render claims filed section');
      assert.ok(res.body.includes('Claims Received as Finder'), 'Should render claims received section');
    })
  ];

  for (const t of tests) {
    await t();
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runPhase2Tests().catch(err => {
  console.error('Fatal Phase 2 test runner error:', err);
  process.exit(1);
});

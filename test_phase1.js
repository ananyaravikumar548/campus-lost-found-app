// Automated Test Suite for Phase 1 - Campus Lost & Found Management System
const assert = require('assert');

const BASE_URL = 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    redirect: 'manual', // do not auto-follow redirects so we can inspect 302/303
    ...options
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text };
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE PHASE 1 TEST SUITE');
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

  const tests = [
    // 1. Home Dashboard
    test('GET / renders dashboard with stats and recent items', async () => {
      const res = await request('/');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Campus'), 'Body should contain brand name');
      assert.ok(res.body.includes('Lost Items Reported'), 'Body should render stats');
      assert.ok(res.body.includes('Recent Lost Items'), 'Body should render recent lost items');
      assert.ok(res.body.includes('Recent Found Items'), 'Body should render recent found items');
    }),

    // 2. Student Directory
    test('GET /students lists seeded students dynamically', async () => {
      const res = await request('/students');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Ananya Sharma'), 'Should display Ananya Sharma');
      assert.ok(res.body.includes('Rohan Verma'), 'Should display Rohan Verma');
      assert.ok(res.body.includes('Student Directory'), 'Should have page title');
    }),

    // 3. Create Student
    test('POST /students creates a student profile and redirects', async () => {
      const uniqueEmail = `test.student.${Date.now()}@campus.edu`;
      const res = await request('/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          fullName: 'Vikram Malhotra',
          email: uniqueEmail,
          department: 'Civil Engineering',
          contactNumber: '+91 9988776655'
        }).toString()
      });
      assert.strictEqual(res.status, 302, 'Should redirect after creation');
      const location = res.headers.get('location');
      assert.ok(location.includes('/students/'), 'Redirect location should point to /students/:id');
    }),

    // 4. Duplicate Email Validation
    test('POST /students rejects duplicate student email with 400', async () => {
      const res = await request('/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          fullName: 'Duplicate Ananya',
          email: 'ananya.sharma@campus.edu', // Already seeded
          department: 'Computer Science',
          contactNumber: '+91 9988112233'
        }).toString()
      });
      assert.strictEqual(res.status, 400, 'Duplicate email must return HTTP 400');
      assert.ok(res.body.includes('already exists'), 'Error message should indicate duplicate email');
    }),

    // 5. Invalid Student Form Validation
    test('POST /students rejects missing or empty fields with 400', async () => {
      const res = await request('/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          fullName: '   ', // whitespace only
          email: 'invalid-email',
          department: '',
          contactNumber: ''
        }).toString()
      });
      assert.strictEqual(res.status, 400, 'Empty fields must return HTTP 400');
    }),

    // 6. Dynamic Student Profile
    test('GET /students/:id displays student details and dynamic item lists', async () => {
      // First get a student ID from /students page
      const listRes = await request('/students');
      const match = listRes.body.match(/\/students\/([a-f0-9]{24})/);
      assert.ok(match, 'Found at least one student ObjectId');
      const studentId = match[1];

      const res = await request(`/students/${studentId}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes(studentId), 'Should display the MongoDB ObjectId');
      assert.ok(res.body.includes('College Email'), 'Should display profile info');
    }),

    // 7. Invalid Student ID handling
    test('GET /students/:id with invalid MongoDB ID returns 400 Bad Request', async () => {
      const res = await request('/students/not-a-valid-object-id-123');
      assert.strictEqual(res.status, 400, 'Invalid ObjectId must return HTTP 400');
      assert.ok(res.body.includes('Invalid Student ID') || res.body.includes('400'), 'Should show error page');
    }),

    // 8. Missing Student handling
    test('GET /students/:id with non-existent ObjectId returns 404 Not Found', async () => {
      const res = await request('/students/507f1f77bcf86cd799439011');
      assert.strictEqual(res.status, 404, 'Non-existent ID must return HTTP 404');
      assert.ok(res.body.includes('Student Not Found') || res.body.includes('404'), 'Should show not found page');
    }),

    // 9. List Lost Items & Search
    test('GET /lost-items lists reports and supports query filtering', async () => {
      const res = await request('/lost-items');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Lost Items'), 'Page title present');

      // Test search filter
      const searchRes = await request('/lost-items?search=Hydro');
      assert.strictEqual(searchRes.status, 200);
      assert.ok(searchRes.body.includes('Hydro Flask'), 'Filtered search should contain Hydro Flask');

      // Test category filter
      const catRes = await request('/lost-items?category=Documents%20%26%20IDs');
      assert.strictEqual(catRes.status, 200);
      assert.ok(
        catRes.body.includes('Documents &amp; IDs') || catRes.body.includes('Documents & IDs'),
        'Category filter should match'
      );
    }),

    // 10. Create Lost Item Report
    test('POST /lost-items validates relationship and saves report', async () => {
      // Get student ID
      const listRes = await request('/students');
      const match = listRes.body.match(/\/students\/([a-f0-9]{24})/);
      const studentId = match[1];

      const res = await request('/lost-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          itemName: 'Sony WH-1000XM4 Headphones',
          category: 'Electronics',
          description: 'Midnight blue over-ear noise cancelling headphones in black travel case.',
          lastSeenLocation: 'Campus Amphitheatre Steps',
          dateLost: '2026-10-21',
          reportedBy: studentId
        }).toString()
      });
      assert.strictEqual(res.status, 302, 'Should redirect to details upon creation');
      const location = res.headers.get('location');
      assert.ok(location.includes('/lost-items/'), 'Should redirect to /lost-items/:id');
    }),

    // 11. Reject Lost Item with Non-existent Student
    test('POST /lost-items rejects non-existent student record with 400', async () => {
      const res = await request('/lost-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          itemName: 'Orphan Lost Item',
          category: 'Other',
          description: 'This item has no valid student owner record.',
          lastSeenLocation: 'Anywhere',
          reportedBy: '507f1f77bcf86cd799439011' // valid ObjectId format but does not exist
        }).toString()
      });
      assert.strictEqual(res.status, 400, 'Must reject missing student reference with HTTP 400');
    }),

    // 12. Dynamic Lost Item Details
    test('GET /lost-items/:id displays details with populated reportedBy student', async () => {
      const listRes = await request('/lost-items');
      const match = listRes.body.match(/\/lost-items\/([a-f0-9]{24})/);
      assert.ok(match, 'Found lost item ID');
      const itemId = match[1];

      const res = await request(`/lost-items/${itemId}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Reported By'), 'Should show reporter section');
      assert.ok(res.body.includes('/students/'), 'Should link to reporter student profile');
    }),

    // 13. Update Lost Item Status
    test('PATCH /lost-items/:id/status updates status', async () => {
      const listRes = await request('/lost-items');
      const match = listRes.body.match(/\/lost-items\/([a-f0-9]{24})/);
      const itemId = match[1];

      const res = await request(`/lost-items/${itemId}/status?_method=PATCH`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ status: 'Recovered' }).toString()
      });
      assert.strictEqual(res.status, 302);

      // Verify update in details
      const detailRes = await request(`/lost-items/${itemId}`);
      assert.ok(detailRes.body.includes('Recovered'), 'Detail page should show updated status');
    }),

    // 14. List Found Items & Search
    test('GET /found-items lists reports dynamically and handles filters', async () => {
      const res = await request('/found-items');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Found Items'), 'Page title present');

      // Test search
      const searchRes = await request('/found-items?search=Earbuds');
      assert.strictEqual(searchRes.status, 200);
      assert.ok(searchRes.body.includes('Earbuds'), 'Search should return earbuds');
    }),

    // 15. Create Found Item Report
    test('POST /found-items validates and links found item to finder student', async () => {
      const listRes = await request('/students');
      const match = listRes.body.match(/\/students\/([a-f0-9]{24})/);
      const studentId = match[1];

      const res = await request('/found-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          itemName: 'Black Umbrella (Auto Open)',
          category: 'Other',
          description: 'Compact folding black umbrella with wooden curved handle left in bus stop.',
          foundLocation: 'Campus North Gate Bus Shelter',
          dateFound: '2026-10-22',
          reportedBy: studentId
        }).toString()
      });
      assert.strictEqual(res.status, 302);
      const location = res.headers.get('location');
      assert.ok(location.includes('/found-items/'), 'Redirect to found item details');
    }),

    // 16. Dynamic Found Item Details
    test('GET /found-items/:id displays details and finder profile link', async () => {
      const listRes = await request('/found-items');
      const match = listRes.body.match(/\/found-items\/([a-f0-9]{24})/);
      assert.ok(match, 'Found found item ID');
      const itemId = match[1];

      const res = await request(`/found-items/${itemId}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Discovered By'), 'Should show finder card');
      assert.ok(res.body.includes('/students/'), 'Should link to student profile');
    }),

    // 17. Update Found Item Status
    test('PATCH /found-items/:id/status updates status to Returned', async () => {
      const listRes = await request('/found-items');
      const match = listRes.body.match(/\/found-items\/([a-f0-9]{24})/);
      const itemId = match[1];

      const res = await request(`/found-items/${itemId}/status?_method=PATCH`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ status: 'Returned' }).toString()
      });
      assert.strictEqual(res.status, 302);

      const detailRes = await request(`/found-items/${itemId}`);
      assert.ok(detailRes.body.includes('Returned'), 'Detail page should show status Returned');
    }),

    // 18. 404 Route Handling
    test('GET unhandled route returns 404 with custom error page', async () => {
      const res = await request('/some-random-route-that-does-not-exist');
      assert.strictEqual(res.status, 404);
      assert.ok(res.body.includes('404'), 'Should render 404 page');
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

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

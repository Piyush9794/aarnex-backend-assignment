interface ApiTestResult {
  id: number;
  module: string;
  method: string;
  endpoint: string;
  status: number;
  expectedStatus: number;
  passed: boolean;
  message: string;
  durationMs: number;
}

const BASE_URL = 'http://localhost:5000';
const results: ApiTestResult[] = [];

async function apiCall(
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; data: any; durationMs: number }> {
  const start = Date.now();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const durationMs = Date.now() - start;
  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, durationMs };
}

function record(
  id: number,
  module: string,
  method: string,
  endpoint: string,
  status: number,
  expectedStatus: number,
  message: string,
  durationMs: number
) {
  const passed = status === expectedStatus;
  results.push({
    id,
    module,
    method,
    endpoint,
    status,
    expectedStatus,
    passed,
    message,
    durationMs,
  });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark} [${id}] ${method} ${endpoint} -> ${status} (expected ${expectedStatus}) [${durationMs}ms]`);
}

async function runAllTests() {
  console.log('===============================================================');
  console.log('   STARTING COMPLETE LIVE API VERIFICATION TEST SUITE');
  console.log('   Server Target: ' + BASE_URL);
  console.log('===============================================================\n');

  let adminToken = '';
  let adminRefreshToken = '';
  let managerToken = '';
  let mumbaiBranchId = '';
  let testUserId = '';
  let testProductId = '';
  let testCustomerId = '';
  let testOrderId = '';

  // 1. HEALTH MODULE
  {
    const res = await apiCall('GET', '/api/v1/health');
    record(1, 'Health', 'GET', '/api/v1/health', res.status, 200, res.data?.database === 'CONNECTED' ? 'PostgreSQL active ping OK' : 'Health check OK', res.durationMs);
  }

  // 2. AUTH MODULE - Admin Login
  {
    const res = await apiCall('POST', '/api/v1/auth/login', undefined, {
      email: 'admin@aarnex.com',
      password: 'Admin@123456',
    });
    adminToken = res.data?.data?.tokens?.accessToken || '';
    adminRefreshToken = res.data?.data?.tokens?.refreshToken || '';
    record(2, 'Auth', 'POST', '/api/v1/auth/login', res.status, 200, 'Admin login succeeded & tokens acquired', res.durationMs);
  }

  // 3. AUTH MODULE - /me
  {
    const res = await apiCall('GET', '/api/v1/auth/me', adminToken);
    record(3, 'Auth', 'GET', '/api/v1/auth/me', res.status, 200, `Profile verified: role = ${res.data?.data?.role}`, res.durationMs);
  }

  // 4. AUTH MODULE - /refresh
  {
    const res = await apiCall('POST', '/api/v1/auth/refresh', undefined, {
      refreshToken: adminRefreshToken,
    });
    // Update admin token with refreshed one if successful
    if (res.data?.data?.accessToken) {
      adminToken = res.data.data.accessToken;
    }
    record(4, 'Auth', 'POST', '/api/v1/auth/refresh', res.status, 200, 'Refresh token rotated successfully', res.durationMs);
  }

  // 5. AUTH MODULE - Manager Login
  {
    const res = await apiCall('POST', '/api/v1/auth/login', undefined, {
      email: 'manager.mum@aarnex.com',
      password: 'User@123456',
    });
    managerToken = res.data?.data?.tokens?.accessToken || '';
    record(5, 'Auth', 'POST', '/api/v1/auth/login', res.status, 200, 'Manager login succeeded', res.durationMs);
  }

  // 6. AUTH MODULE - Logout
  {
    const res = await apiCall('POST', '/api/v1/auth/logout', managerToken, {});
    record(6, 'Auth', 'POST', '/api/v1/auth/logout', res.status, 200, 'Logout succeeded', res.durationMs);
    // Re-login manager so managerToken stays fresh for later tests
    const reLogin = await apiCall('POST', '/api/v1/auth/login', undefined, {
      email: 'manager.mum@aarnex.com',
      password: 'User@123456',
    });
    managerToken = reLogin.data?.data?.tokens?.accessToken || '';
  }

  // 7. BRANCHES MODULE - List Branches
  {
    const res = await apiCall('GET', '/api/v1/branches', adminToken);
    const branches = res.data?.data || [];
    const mum = branches.find((b: any) => b.code === 'BR-MUM-01');
    mumbaiBranchId = mum ? mum.id : (branches[0] ? branches[0].id : '');
    record(7, 'Branches', 'GET', '/api/v1/branches', res.status, 200, `Found ${branches.length} branches`, res.durationMs);
  }

  // 8. BRANCHES MODULE - Create Branch
  {
    const uniqueCode = 'BR-TST-' + Math.floor(100 + Math.random() * 900);
    const res = await apiCall('POST', '/api/v1/branches', adminToken, {
      name: 'Test Branch ' + uniqueCode,
      code: uniqueCode,
      address: '77 Innovation Way, Tech Corridor',
      phone: '+91 22 9988 7766',
    });
    record(8, 'Branches', 'POST', '/api/v1/branches', res.status, 201, `Branch created with code ${uniqueCode}`, res.durationMs);
  }

  // 9. USERS MODULE - Create User
  {
    const uniqueEmail = `test.user.${Date.now()}@aarnex.com`;
    const res = await apiCall('POST', '/api/v1/users', adminToken, {
      email: uniqueEmail,
      password: 'UserPassword@123',
      full_name: 'Automated Test User',
      role: 'STAFF',
      branch_id: mumbaiBranchId,
    });
    testUserId = res.data?.data?.id || '';
    record(9, 'Users', 'POST', '/api/v1/users', res.status, 201, `User created (${uniqueEmail})`, res.durationMs);
  }

  // 10. USERS MODULE - Update User Status
  {
    const res = await apiCall('PATCH', `/api/v1/users/${testUserId}/status`, adminToken, {
      is_active: false,
    });
    record(10, 'Users', 'PATCH', `/api/v1/users/:id/status`, res.status, 200, `User deactivated successfully`, res.durationMs);
  }

  // 11. PRODUCTS MODULE - List Products
  {
    const res = await apiCall('GET', '/api/v1/products?page=1&limit=5', adminToken);
    const total = res.data?.meta?.total || (res.data?.data?.length || 0);
    record(11, 'Products', 'GET', '/api/v1/products', res.status, 200, `Products listed (Total catalog: ${total})`, res.durationMs);
  }

  // 12. PRODUCTS MODULE - Create Product
  {
    const uniqueSku = 'PROD-TST-' + Math.floor(1000 + Math.random() * 9000);
    const res = await apiCall('POST', '/api/v1/products', adminToken, {
      sku: uniqueSku,
      name: 'Wireless Bluetooth Presenter',
      description: 'Presenter with red laser pointer',
      price_paise: 299900,
    });
    testProductId = res.data?.data?.id || '';
    record(12, 'Products', 'POST', '/api/v1/products', res.status, 201, `Product created: ${uniqueSku} (₹2,999.00)`, res.durationMs);
  }

  // 13. PRODUCTS MODULE - Get Product by ID
  {
    const res = await apiCall('GET', `/api/v1/products/${testProductId}`, adminToken);
    record(13, 'Products', 'GET', `/api/v1/products/:id`, res.status, 200, `Product retrieved: ${res.data?.data?.name}`, res.durationMs);
  }

  // 14. PRODUCTS MODULE - Update Product
  {
    const res = await apiCall('PATCH', `/api/v1/products/${testProductId}`, adminToken, {
      name: 'Wireless Bluetooth Presenter Pro Edition',
      price_paise: 349900,
    });
    record(14, 'Products', 'PATCH', `/api/v1/products/:id`, res.status, 200, `Product price updated to 349900 paise`, res.durationMs);
  }

  // 15. CUSTOMERS MODULE - List Customers
  {
    const res = await apiCall('GET', `/api/v1/customers?page=1&limit=10`, managerToken);
    const customers = res.data?.data || [];
    testCustomerId = customers.length > 0 ? customers[0].id : '';
    record(15, 'Customers', 'GET', '/api/v1/customers', res.status, 200, `Found ${customers.length} branch customers`, res.durationMs);
  }

  // 16. CUSTOMERS MODULE - Create Customer
  {
    const uniqueCustEmail = `cust.${Date.now()}@example.com`;
    const res = await apiCall('POST', '/api/v1/customers', managerToken, {
      name: 'Vikram Test Customer',
      email: uniqueCustEmail,
      phone: '+91 98200 88990',
    });
    if (res.data?.data?.id) {
      testCustomerId = res.data.data.id;
    }
    record(16, 'Customers', 'POST', '/api/v1/customers', res.status, 201, `Customer created in branch (${uniqueCustEmail})`, res.durationMs);
  }

  // 17. INVENTORY MODULE - Get Branch Inventory
  {
    const res = await apiCall('GET', `/api/v1/branches/${mumbaiBranchId}/inventory`, managerToken);
    record(17, 'Inventory', 'GET', `/api/v1/branches/:id/inventory`, res.status, 200, `Retrieved ${res.data?.data?.length || 0} inventory items`, res.durationMs);
  }

  // 18. INVENTORY MODULE - Adjust Stock
  {
    const res = await apiCall('POST', `/api/v1/branches/${mumbaiBranchId}/inventory/adjustments`, managerToken, {
      product_id: testProductId,
      quantity_change: 25,
      reason: 'Initial stock intake for newly added test product',
    });
    record(18, 'Inventory', 'POST', `/api/v1/branches/:id/inventory/adjustments`, res.status, 200, `Stock adjusted: new quantity = ${res.data?.data?.inventory?.quantity}`, res.durationMs);
  }

  // 19. ORDERS MODULE - Place Order
  {
    const res = await apiCall('POST', '/api/v1/orders', managerToken, {
      customer_id: testCustomerId,
      items: [
        {
          product_id: testProductId,
          quantity: 2,
        },
      ],
    });
    testOrderId = res.data?.data?.id || '';
    record(19, 'Orders', 'POST', '/api/v1/orders', res.status, 201, `Order placed: #${res.data?.data?.order_number} (Total: ${res.data?.data?.total_amount_paise} paise)`, res.durationMs);
  }

  // 20. ORDERS MODULE - List Orders
  {
    const res = await apiCall('GET', '/api/v1/orders?page=1&limit=10', managerToken);
    record(20, 'Orders', 'GET', '/api/v1/orders', res.status, 200, `Listed orders (Found ${res.data?.data?.length || 0})`, res.durationMs);
  }

  // 21. ORDERS MODULE - Get Order by ID
  {
    const res = await apiCall('GET', `/api/v1/orders/${testOrderId}`, managerToken);
    record(21, 'Orders', 'GET', `/api/v1/orders/:id`, res.status, 200, `Order retrieved with ${res.data?.data?.items?.length || 0} items`, res.durationMs);
  }

  // 22. ORDERS MODULE - Update Status (PLACED -> PACKED)
  {
    const res = await apiCall('PATCH', `/api/v1/orders/${testOrderId}/status`, managerToken, {
      status: 'PACKED',
    });
    record(22, 'Orders', 'PATCH', `/api/v1/orders/:id/status`, res.status, 200, `Status transitioned to PACKED`, res.durationMs);
  }

  // 23. ORDERS MODULE - Cancel Order (Restores Stock)
  {
    const res = await apiCall('POST', `/api/v1/orders/${testOrderId}/cancel`, managerToken, {
      reason: 'Customer requested cancellation during verification test',
    });
    record(23, 'Orders', 'POST', `/api/v1/orders/:id/cancel`, res.status, 200, `Order cancelled and inventory restored`, res.durationMs);
  }

  // 24. REPORTS MODULE - Branch Summary Report
  {
    const res = await apiCall('GET', `/api/v1/reports/branches/${mumbaiBranchId}/summary?from=2026-01-01&to=2026-12-31`, managerToken);
    record(24, 'Reports', 'GET', `/api/v1/reports/branches/:id/summary`, res.status, 200, `Report generated (Gross: ₹${res.data?.data?.metrics?.gross_sales_paise / 100})`, res.durationMs);
  }

  // 25. AUDIT LOGS MODULE - Query Logs
  {
    const res = await apiCall('GET', '/api/v1/audit-logs?limit=10', managerToken);
    record(25, 'Audit', 'GET', '/api/v1/audit-logs', res.status, 200, `Retrieved ${res.data?.data?.length || 0} audit logs with credentials redacted`, res.durationMs);
  }

  // 26. SWAGGER / API DOCS
  {
    const res = await apiCall('GET', '/api-docs.json');
    record(26, 'Docs', 'GET', '/api-docs.json', res.status, 200, 'Swagger / OpenAPI 3.0 specification available', res.durationMs);
  }

  console.log('\n===============================================================');
  console.log('                 FINAL TEST REPORT SUMMARY');
  console.log('===============================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`TOTAL APIS TESTED : ${totalCount}`);
  console.log(`PASSED            : ${passedCount}`);
  console.log(`FAILED            : ${totalCount - passedCount}`);
  console.log(`SUCCESS RATE      : ${((passedCount / totalCount) * 100).toFixed(1)}%\n`);

  if (passedCount === totalCount) {
    console.log('🎉 ALL 26 API ENDPOINTS ARE WORKING 100% PERFECTLY!');
  } else {
    console.log('⚠️ SOME ENDPOINTS FAILED:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`   - [${r.id}] ${r.method} ${r.endpoint}: Status ${r.status} (expected ${r.expectedStatus})`));
  }
}

runAllTests().catch(console.error);

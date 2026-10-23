import request from 'supertest';
import app from '../../src/app';
import { AppDataSource, initializeDatabase } from '../../src/config/database';
import { Branch } from '../../src/models/Branch';
import { Product } from '../../src/models/Product';
import { Customer } from '../../src/models/Customer';
import { Inventory } from '../../src/models/Inventory';
import { Order, OrderStatus } from '../../src/models/Order';

describe('Aarnex Tech — 10 Mandatory Acceptance Tests (Real PostgreSQL)', () => {
  let adminToken: string;
  let mumManagerToken: string;
  let mumStaffToken: string;
  let blrManagerToken: string;
  let blrStaffToken: string;

  let mumBranch: Branch;
  let blrBranch: Branch;
  let testProduct: Product;
  let mumCustomer: Customer;
  let blrCustomer: Customer;

  beforeAll(async () => {
    await initializeDatabase();

    const branchRepo = AppDataSource.getRepository(Branch);
    const productRepo = AppDataSource.getRepository(Product);
    const customerRepo = AppDataSource.getRepository(Customer);

    mumBranch = (await branchRepo.findOneOrFail({ where: { code: 'BR-MUM-01' } }));
    blrBranch = (await branchRepo.findOneOrFail({ where: { code: 'BR-BLR-01' } }));
    testProduct = (await productRepo.findOneOrFail({ where: { sku: 'PROD-KB-001' } }));
    mumCustomer = (await customerRepo.findOneOrFail({ where: { email: 'aarav.mum@example.com' } }));
    blrCustomer = (await customerRepo.findOneOrFail({ where: { email: 'rohan.blr@example.com' } }));

    // Authenticate test users to acquire JWT tokens
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@aarnex.com', password: 'Admin@123456' });
    adminToken = adminRes.body.data.tokens.accessToken;

    const mumMgrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager.mum@aarnex.com', password: 'User@123456' });
    mumManagerToken = mumMgrRes.body.data.tokens.accessToken;

    const mumStaffRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'staff.mum@aarnex.com', password: 'User@123456' });
    mumStaffToken = mumStaffRes.body.data.tokens.accessToken;

    const blrMgrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager.blr@aarnex.com', password: 'User@123456' });
    blrManagerToken = blrMgrRes.body.data.tokens.accessToken;

    const blrStaffRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'staff.blr@aarnex.com', password: 'User@123456' });
    blrStaffToken = blrStaffRes.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  // TEST 1
  it('1. Protected endpoint without token returns 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHENTICATED');

    const ordersRes = await request(app).get('/api/v1/orders');
    expect(ordersRes.status).toBe(401);
    expect(ordersRes.body.success).toBe(false);
  });

  // TEST 2
  it('2. Branch A staff cannot access Branch B data', async () => {
    // Mumbai staff attempting to read Bangalore inventory
    const invRes = await request(app)
      .get(`/api/v1/branches/${blrBranch.id}/inventory`)
      .set('Authorization', `Bearer ${mumStaffToken}`);

    expect(invRes.status).toBe(403);
    expect(invRes.body.success).toBe(false);
    expect(invRes.body.code).toBe('FORBIDDEN');

    // Mumbai staff attempting to read Bangalore customers
    const custRes = await request(app)
      .get(`/api/v1/customers?branch_id=${blrBranch.id}`)
      .set('Authorization', `Bearer ${mumStaffToken}`);

    expect(custRes.status).toBe(403);
    expect(custRes.body.success).toBe(false);
  });

  // TEST 3
  it('3. Incorrect password is rejected and sensitive fields are absent from responses', async () => {
    const wrongRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@aarnex.com', password: 'InvalidPasswordXYZ' });

    expect(wrongRes.status).toBe(401);
    expect(wrongRes.body.success).toBe(false);
    expect(wrongRes.body.code).toBe('INVALID_CREDENTIALS');

    // Successful login: ensure password_hash and secrets are absent
    const successRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@aarnex.com', password: 'Admin@123456' });

    expect(successRes.status).toBe(200);
    expect(successRes.body.data.user).toBeDefined();
    expect(successRes.body.data.user.password_hash).toBeUndefined();
    expect(successRes.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(successRes.body)).not.toContain('password_hash');
  });

  // TEST 4
  it('4. Database product price overrides a submitted client price', async () => {
    // Official DB price of PROD-KB-001 is 499900 paise (₹4,999.00)
    // Client attempts to pass a forged price of 100 paise (₹1.00)
    const forgedPayload = {
      customer_id: mumCustomer.id,
      items: [
        {
          product_id: testProduct.id,
          quantity: 1,
          unit_price_paise: 100, // Forged client price
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${mumStaffToken}`)
      .send(forgedPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const createdOrder = res.body.data;
    expect(createdOrder.total_amount_paise).toBe(testProduct.price_paise); // 499900, not 100
    expect(createdOrder.items[0].unit_price_paise).toBe(testProduct.price_paise);
  });

  // TEST 5
  it('5. Insufficient stock causes a complete transaction rollback', async () => {
    const invRepo = AppDataSource.getRepository(Inventory);
    const orderRepo = AppDataSource.getRepository(Order);

    const initialInv = await invRepo.findOneOrFail({
      where: { branch_id: mumBranch.id, product_id: testProduct.id },
    });
    const initialOrdersCount = await orderRepo.count();

    const excessivePayload = {
      customer_id: mumCustomer.id,
      items: [
        {
          product_id: testProduct.id,
          quantity: initialInv.quantity + 99999, // Exceeds available stock
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${mumStaffToken}`)
      .send(excessivePayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');

    // Verify atomic rollback: inventory and orders count remain unchanged
    const afterInv = await invRepo.findOneOrFail({
      where: { branch_id: mumBranch.id, product_id: testProduct.id },
    });
    const afterOrdersCount = await orderRepo.count();

    expect(afterInv.quantity).toBe(initialInv.quantity);
    expect(afterOrdersCount).toBe(initialOrdersCount);
  });

  // TEST 6
  it('6. Two concurrent orders for the last unit result in exactly one successful order', async () => {
    const productRepo = AppDataSource.getRepository(Product);
    const invRepo = AppDataSource.getRepository(Inventory);

    // Create an isolated test product with SKU PROD-RACE-001 with exactly 1 unit in Mumbai
    const raceProduct = await productRepo.save(
      productRepo.create({
        sku: `PROD-RACE-${Date.now()}`,
        name: 'Limited Race Edition Item',
        price_paise: 100000,
        is_active: true,
      })
    );

    await invRepo.save(
      invRepo.create({
        branch_id: mumBranch.id,
        product_id: raceProduct.id,
        quantity: 1, // Only 1 unit available!
      })
    );

    // Dispatch two concurrent order requests simultaneously for the same 1 unit
    const orderPayload = {
      customer_id: mumCustomer.id,
      items: [{ product_id: raceProduct.id, quantity: 1 }],
    };

    const [orderRes1, orderRes2] = await Promise.all([
      request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${mumStaffToken}`)
        .send(orderPayload),
      request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${mumManagerToken}`)
        .send(orderPayload),
    ]);

    const statuses = [orderRes1.status, orderRes2.status];
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    // Verify remaining inventory is exactly 0 and never became negative
    const finalInv = await invRepo.findOneOrFail({
      where: { branch_id: mumBranch.id, product_id: raceProduct.id },
    });
    expect(finalInv.quantity).toBe(0);
  });

  // TEST 7
  it('7. Cancellation restores stock exactly once, including retries and concurrent requests', async () => {
    const invRepo = AppDataSource.getRepository(Inventory);

    // Initial stock
    const invBefore = await invRepo.findOneOrFail({
      where: { branch_id: mumBranch.id, product_id: testProduct.id },
    });

    // Place order for 2 units
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${mumStaffToken}`)
      .send({
        customer_id: mumCustomer.id,
        items: [{ product_id: testProduct.id, quantity: 2 }],
      });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;

    const invAfterOrder = await invRepo.findOneOrFail({
      where: { branch_id: mumBranch.id, product_id: testProduct.id },
    });
    expect(invAfterOrder.quantity).toBe(invBefore.quantity - 2);

    // Concurrent cancellation requests
    const [cancelRes1, cancelRes2] = await Promise.all([
      request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${mumManagerToken}`)
        .send({ reason: 'Customer cancelled' }),
      request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${mumManagerToken}`)
        .send({ reason: 'Duplicate cancel request' }),
    ]);

    const cancelStatuses = [cancelRes1.status, cancelRes2.status];
    expect(cancelStatuses).toContain(200);
    expect(cancelStatuses).toContain(409);

    // Stock must be restored by exactly 2 units (not 4)
    const invAfterCancel = await invRepo.findOneOrFail({
      where: { branch_id: mumBranch.id, product_id: testProduct.id },
    });
    expect(invAfterCancel.quantity).toBe(invBefore.quantity);

    // Subsequent retry must also be rejected
    const retryRes = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${mumManagerToken}`)
      .send({ reason: 'Third cancel attempt' });
    expect(retryRes.status).toBe(409);
    expect(retryRes.body.code).toBe('ALREADY_CANCELLED');
  });

  // TEST 8
  it('8. Invalid order status transitions are rejected', async () => {
    // Place a new order: status is PLACED
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${mumStaffToken}`)
      .send({
        customer_id: mumCustomer.id,
        items: [{ product_id: testProduct.id, quantity: 1 }],
      });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;

    // Attempt illegal transition: PLACED -> DELIVERED (skipping PACKED and DISPATCHED)
    const illegalJump = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${mumManagerToken}`)
      .send({ status: 'DELIVERED' });
    expect(illegalJump.status).toBe(409);
    expect(illegalJump.body.code).toBe('INVALID_STATUS_TRANSITION');

    // Valid transition: PLACED -> PACKED
    const step1 = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${mumManagerToken}`)
      .send({ status: 'PACKED' });
    expect(step1.status).toBe(200);
    expect(step1.body.data.status).toBe('PACKED');

    // Valid transition: PACKED -> DISPATCHED
    const step2 = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${mumManagerToken}`)
      .send({ status: 'DISPATCHED' });
    expect(step2.status).toBe(200);
    expect(step2.body.data.status).toBe('DISPATCHED');

    // Attempt cancellation after DISPATCHED: must be rejected!
    const cancelAfterDispatch = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${mumManagerToken}`)
      .send({ reason: 'Too late cancellation' });
    expect(cancelAfterDispatch.status).toBe(409);
    expect(cancelAfterDispatch.body.code).toBe('CANNOT_CANCEL_DISPATCHED_ORDER');

    // Valid transition: DISPATCHED -> DELIVERED
    const step3 = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${mumManagerToken}`)
      .send({ status: 'DELIVERED' });
    expect(step3.status).toBe(200);
    expect(step3.body.data.status).toBe('DELIVERED');

    // Attempt transition backward: DELIVERED -> PACKED
    const stepBackward = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${mumManagerToken}`)
      .send({ status: 'PACKED' });
    expect(stepBackward.status).toBe(409);
  });

  // TEST 9
  it("9. A branch manager cannot adjust another branch's stock", async () => {
    // Mumbai Manager attempts to adjust Bangalore stock
    const res = await request(app)
      .post(`/api/v1/branches/${blrBranch.id}/inventory/adjustments`)
      .set('Authorization', `Bearer ${mumManagerToken}`)
      .send({
        product_id: testProduct.id,
        quantity_change: 10,
        reason: 'Illegal cross-branch adjustment',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('FORBIDDEN');

    // Staff member attempts to adjust own branch stock: must be rejected
    const staffRes = await request(app)
      .post(`/api/v1/branches/${mumBranch.id}/inventory/adjustments`)
      .set('Authorization', `Bearer ${mumStaffToken}`)
      .send({
        product_id: testProduct.id,
        quantity_change: 5,
        reason: 'Staff adjustment attempt',
      });

    expect(staffRes.status).toBe(403);
  });

  // TEST 10
  it('10. Date-range reports match persisted orders', async () => {
    // Fetch summary report for Mumbai branch for 2026
    const res = await request(app)
      .get(`/api/v1/reports/branches/${mumBranch.id}/summary?from=2026-01-01&to=2026-12-31`)
      .set('Authorization', `Bearer ${mumManagerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const report = res.body.data;
    expect(report.branch_id).toBe(mumBranch.id);
    expect(report.branch_code).toBe(mumBranch.code);
    expect(report.period.from).toBe('2026-01-01');
    expect(report.period.to).toBe('2026-12-31');

    // Verify financial metrics are present and computed from actual persisted orders
    expect(report.metrics.total_orders_placed).toBeGreaterThan(0);
    expect(report.metrics.gross_sales_paise).toBeGreaterThan(0);
    expect(report.metrics.net_sales_paise).toBeGreaterThanOrEqual(0);
    expect(report.metrics.net_sales_formatted_inr).toBeDefined();
    expect(report.status_breakdown).toBeDefined();

    // Verify branch isolation: Mumbai manager cannot request Bangalore report
    const crossBranchReport = await request(app)
      .get(`/api/v1/reports/branches/${blrBranch.id}/summary?from=2026-01-01&to=2026-12-31`)
      .set('Authorization', `Bearer ${mumManagerToken}`);

    expect(crossBranchReport.status).toBe(403);
  });
});

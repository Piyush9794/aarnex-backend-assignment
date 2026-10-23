import { AppDataSource, initializeDatabase } from '../../config/database';
import { User, UserRole } from '../../models/User';
import { Branch } from '../../models/Branch';
import { Product } from '../../models/Product';
import { Customer } from '../../models/Customer';
import { Inventory } from '../../models/Inventory';
import { StockMovement, StockMovementReason } from '../../models/StockMovement';
import { hashPassword } from '../../utils/password';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export async function runSeed(): Promise<void> {
  const dataSource = await initializeDatabase();
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    logger.info('Starting deterministic database seeding...');

    const userRepo = queryRunner.manager.getRepository(User);
    const branchRepo = queryRunner.manager.getRepository(Branch);
    const productRepo = queryRunner.manager.getRepository(Product);
    const customerRepo = queryRunner.manager.getRepository(Customer);
    const inventoryRepo = queryRunner.manager.getRepository(Inventory);
    const movementRepo = queryRunner.manager.getRepository(StockMovement);

    // 1. Seed Branches
    const branchesData = [
      {
        name: 'Mumbai Central',
        code: 'BR-MUM-01',
        address: '101 Nariman Point, Mumbai, Maharashtra 400021',
        phone: '+91 22 2200 1111',
      },
      {
        name: 'Bangalore Tech Park',
        code: 'BR-BLR-01',
        address: '404 Outer Ring Road, Bellandur, Bangalore, Karnataka 560103',
        phone: '+91 80 4400 2222',
      },
    ];

    const seededBranches: Record<string, Branch> = {};
    for (const b of branchesData) {
      let branch = await branchRepo.findOne({ where: { code: b.code } });
      if (!branch) {
        branch = branchRepo.create(b);
        branch = await branchRepo.save(branch);
        logger.info(`Seeded branch: ${branch.name} (${branch.code})`);
      }
      seededBranches[b.code] = branch;
    }

    // 2. Seed Users
    const adminPasswordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
    const userPasswordHash = await hashPassword(env.SEED_DEFAULT_USER_PASSWORD);

    const usersData = [
      {
        email: env.SEED_ADMIN_EMAIL,
        password_hash: adminPasswordHash,
        full_name: 'System Administrator',
        role: UserRole.SUPER_ADMIN,
        branch_id: null,
      },
      {
        email: 'manager.mum@aarnex.com',
        password_hash: userPasswordHash,
        full_name: 'Mumbai Branch Manager',
        role: UserRole.BRANCH_MANAGER,
        branch_id: seededBranches['BR-MUM-01'].id,
      },
      {
        email: 'staff.mum@aarnex.com',
        password_hash: userPasswordHash,
        full_name: 'Mumbai Staff Member',
        role: UserRole.STAFF,
        branch_id: seededBranches['BR-MUM-01'].id,
      },
      {
        email: 'manager.blr@aarnex.com',
        password_hash: userPasswordHash,
        full_name: 'Bangalore Branch Manager',
        role: UserRole.BRANCH_MANAGER,
        branch_id: seededBranches['BR-BLR-01'].id,
      },
      {
        email: 'staff.blr@aarnex.com',
        password_hash: userPasswordHash,
        full_name: 'Bangalore Staff Member',
        role: UserRole.STAFF,
        branch_id: seededBranches['BR-BLR-01'].id,
      },
    ];

    const seededUsers: Record<string, User> = {};
    for (const u of usersData) {
      let user = await userRepo.findOne({ where: { email: u.email } });
      if (!user) {
        user = userRepo.create(u);
        user = await userRepo.save(user);
        logger.info(`Seeded user: ${user.email} (${user.role})`);
      }
      seededUsers[u.email] = user;
    }

    // 3. Seed Products (Prices in paise: ₹1 = 100 paise)
    const productsData = [
      {
        sku: 'PROD-KB-001',
        name: 'Mechanical Keyboard RGB',
        description: 'Tenkeyless mechanical gaming keyboard with hot-swappable switches',
        price_paise: 499900, // ₹4,999.00
      },
      {
        sku: 'PROD-MS-002',
        name: 'Ergonomic Wireless Mouse',
        description: 'Rechargeable 2.4GHz ergonomic wireless mouse with silent clicks',
        price_paise: 249900, // ₹2,499.00
      },
      {
        sku: 'PROD-DK-003',
        name: 'USB-C Multiport Dock',
        description: '10-in-1 Dual 4K HDMI, Gigabit Ethernet, 100W PD charging station',
        price_paise: 799900, // ₹7,999.00
      },
      {
        sku: 'PROD-ST-004',
        name: 'Aluminum Laptop Stand',
        description: 'Ergonomic foldable aluminum riser for laptops up to 17 inches',
        price_paise: 149900, // ₹1,499.00
      },
      {
        sku: 'PROD-WC-005',
        name: 'Ultra HD 4K Webcam',
        description: '4K webcam with dual noise-canceling stereo microphones',
        price_paise: 699900, // ₹6,999.00
      },
    ];

    const seededProducts: Record<string, Product> = {};
    for (const p of productsData) {
      let product = await productRepo.findOne({ where: { sku: p.sku } });
      if (!product) {
        product = productRepo.create(p);
        product = await productRepo.save(product);
        logger.info(`Seeded product: ${product.name} (SKU: ${product.sku})`);
      }
      seededProducts[p.sku] = product;
    }

    // 4. Seed Branch Customers
    const customersData = [
      {
        branch_id: seededBranches['BR-MUM-01'].id,
        name: 'Aarav Sharma',
        email: 'aarav.mum@example.com',
        phone: '+91 98200 11223',
      },
      {
        branch_id: seededBranches['BR-MUM-01'].id,
        name: 'Priya Patel',
        email: 'priya.patel@example.com',
        phone: '+91 98200 33445',
      },
      {
        branch_id: seededBranches['BR-BLR-01'].id,
        name: 'Rohan Iyer',
        email: 'rohan.blr@example.com',
        phone: '+91 98450 55667',
      },
      {
        branch_id: seededBranches['BR-BLR-01'].id,
        name: 'Neha Reddy',
        email: 'neha.reddy@example.com',
        phone: '+91 98450 77889',
      },
    ];

    for (const c of customersData) {
      let customer = await customerRepo.findOne({
        where: { branch_id: c.branch_id, email: c.email },
      });
      if (!customer) {
        customer = customerRepo.create(c);
        customer = await customerRepo.save(customer);
        logger.info(`Seeded customer: ${customer.name} (${customer.email})`);
      }
    }

    // 5. Seed Inventory & Initial Stock Movements
    const adminUser = seededUsers[env.SEED_ADMIN_EMAIL];
    for (const branch of Object.values(seededBranches)) {
      for (const product of Object.values(seededProducts)) {
        let inv = await inventoryRepo.findOne({
          where: { branch_id: branch.id, product_id: product.id },
        });

        if (!inv) {
          const initialQty = 50;
          inv = inventoryRepo.create({
            branch_id: branch.id,
            product_id: product.id,
            quantity: initialQty,
          });
          inv = await inventoryRepo.save(inv);

          // Record initial stock movement
          const movement = movementRepo.create({
            branch_id: branch.id,
            product_id: product.id,
            quantity_change: initialQty,
            balance_after: initialQty,
            reason: StockMovementReason.ADJUSTMENT,
            reference_id: 'SEED_INITIAL_STOCK',
            actor_id: adminUser?.id || null,
          });
          await movementRepo.save(movement);

          logger.info(
            `Seeded inventory: Branch ${branch.code} - Product ${product.sku} (Qty: ${initialQty})`
          );
        }
      }
    }

    await queryRunner.commitTransaction();
    logger.info('Deterministic database seeding completed successfully.');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    logger.error({ error }, 'Error occurred during database seeding. Transaction rolled back.');
    throw error;
  } finally {
    await queryRunner.release();
  }
}

// Execute standalone if called directly
if (require.main === module) {
  runSeed()
    .then(async () => {
      logger.info('Seed script finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Seed script failed.');
      process.exit(1);
    });
}

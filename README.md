# Aarnex Tech Backend Developer Assignment — Multi-Branch ERP System

A production-grade, secure, runnable, and maintainable backend service built for the Aarnex Tech Technical Assignment using **Express.js**, **TypeScript**, **PostgreSQL**, and **TypeORM** following a strict **MVC architecture**.

---

## 1. Architecture Overview & Folder Structure

The project strictly follows the requested MVC design pattern:

```text
aarnex-backend/
├── src/
│   ├── config/
│   │   ├── database.ts        # TypeORM DataSource & pool initialization
│   │   ├── env.ts             # Zod environment variable validation
│   │   └── logger.ts          # Pino structured logger
│   ├── models/                # TypeORM Entities & PostgreSQL Constraints
│   │   ├── User.ts            # User entity, RBAC roles (SUPER_ADMIN, BRANCH_MANAGER, STAFF)
│   │   ├── Branch.ts          # Multi-branch entities
│   │   ├── Product.ts         # Catalog items, prices in integer paise (CHECK >= 0)
│   │   ├── Customer.ts        # Branch-isolated customer records
│   │   ├── Inventory.ts       # Per-branch stock with CHECK (quantity >= 0)
│   │   ├── StockMovement.ts   # Immutable ledger of inventory changes
│   │   ├── Order.ts           # Order headers with lifecycle status & paise totals
│   │   ├── OrderItem.ts       # Line items with unit-price snapshot & subtotal
│   │   ├── RefreshToken.ts    # Hashed refresh tokens with rotation & replay flags
│   │   └── AuditLog.ts        # Actor, action, and sanitized metadata audit trail
│   ├── controllers/           # HTTP Request handling & response formatting
│   │   ├── AuthController.ts
│   │   ├── UserController.ts
│   │   ├── BranchController.ts
│   │   ├── ProductController.ts
│   │   ├── CustomerController.ts
│   │   ├── InventoryController.ts
│   │   ├── OrderController.ts
│   │   ├── ReportController.ts
│   │   ├── AuditController.ts
│   │   └── HealthController.ts
│   ├── services/              # Business logic, transactions, and permissions
│   │   ├── AuthService.ts
│   │   ├── UserService.ts
│   │   ├── BranchService.ts
│   │   ├── ProductService.ts
│   │   ├── CustomerService.ts
│   │   ├── InventoryService.ts
│   │   ├── OrderService.ts
│   │   ├── ReportService.ts
│   │   └── AuditService.ts
│   ├── repositories/          # Specialized database access queries
│   │   ├── UserRepository.ts
│   │   ├── BranchRepository.ts
│   │   ├── ProductRepository.ts
│   │   ├── CustomerRepository.ts
│   │   ├── InventoryRepository.ts
│   │   ├── OrderRepository.ts
│   │   ├── RefreshTokenRepository.ts
│   │   └── AuditLogRepository.ts
│   ├── routes/                # Endpoint definitions & middleware composition
│   │   ├── index.ts           # Root API v1 router
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── branch.routes.ts
│   │   ├── product.routes.ts
│   │   ├── customer.routes.ts
│   │   ├── inventory.routes.ts
│   │   ├── order.routes.ts
│   │   ├── report.routes.ts
│   │   ├── audit.routes.ts
│   │   └── health.routes.ts
│   ├── middleware/            # Security, Auth, Validation, & Errors
│   │   ├── authenticate.ts    # JWT verification & active user enforcement
│   │   ├── authorize.ts       # RBAC & Branch isolation guards
│   │   ├── validate.ts        # Zod request body, query, and params validator
│   │   ├── errorHandler.ts    # Centralized JSON error response handler
│   │   └── notFound.ts        # 404 handler
│   ├── validators/            # Zod validation schemas
│   │   └── index.ts
│   ├── utils/                 # Utilities (Password, JWT, Errors, Response)
│   │   ├── errors.ts
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   └── response.ts
│   ├── database/
│   │   ├── migrations/        # TypeORM initial schema migrations
│   │   │   └── 1710000000000-InitialSchema.ts
│   │   └── seeds/             # Deterministic, idempotent database seeder
│   │       └── run-seed.ts
│   ├── app.ts                 # Express app assembly & Swagger UI mount
│   └── server.ts              # HTTP server listener & graceful shutdown
├── docs/
│   ├── openapi.yaml           # Complete OpenAPI 3.0.3 specification
│   └── er-diagram.md          # Mermaid ER Diagram & relational constraints
├── tests/
│   ├── unit/                  # Unit tests (Password, JWT, Sanitizer)
│   └── integration/           # 10 Mandatory acceptance tests on real PostgreSQL
├── Dockerfile                 # Multi-stage production Docker build
├── docker-compose.yml         # API + PostgreSQL containerized stack
├── .env.example               # Environment template with Neon & Docker options
└── package.json
```

---

## 2. Prerequisites

- **Node.js**: v18.x, v20.x, or v22+ (`node -v`)
- **npm**: v9+ (`npm -v`)
- **PostgreSQL**: Either:
  - **Option A (No local install needed)**: Free hosted PostgreSQL on **Neon** ([neon.tech](https://neon.tech/)).
  - **Option B (Containerized)**: Docker & Docker Compose (`docker compose up`).

---

## 3. Neon Setup (Without Installing PostgreSQL Locally)

Since your laptop already has MySQL and MongoDB and you do not want PostgreSQL installed directly on your machine, Neon is the recommended zero-install cloud PostgreSQL provider:

1. **Create an Account**: Go to [https://neon.tech](https://neon.tech) and sign up for a free tier account.
2. **Create a Database**:
   - Click **Create Project**.
   - Name your project (e.g. `aarnex-dev`).
   - Select Postgres version 16.
3. **Obtain Connection String**:
   - On your project dashboard, navigate to the **Connection Details** widget.
   - Select **Connection string** and check **Pooled connection** (or direct).
   - The connection string looks like:
     ```text
     postgresql://neondb_owner:YOUR_PASSWORD@ep-sparkling-scene-b4ijtak9-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
4. **Configure `.env`**:
   - Copy `.env.example` to `.env`:
     ```powershell
     cp .env.example .env
     ```
   - Paste the connection string into `DATABASE_URL`:
     ```env
     DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-sparkling-scene-b4ijtak9-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require
     DB_SSL=false
     ```
   *(Note: The system automatically detects `sslmode=require` in the URL and securely configures TLS with `{ rejectUnauthorized: false }` for Neon).*

---

## 4. Installation & Database Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run TypeORM Schema Migrations
TypeORM schema synchronization is strictly disabled (`synchronize: false`). Execute the versioned migration:
```bash
npm run migration:run
```
This runs `src/database/migrations/1710000000000-InitialSchema.ts`, which sets up:
- The `uuid-ossp` PostgreSQL extension.
- Custom ENUM types (`user_role_enum`, `order_status_enum`, `stock_movement_reason_enum`).
- All 10 tables with unique keys, foreign keys with cascade/restrict rules, and native `CHECK` constraints.

### Step 3: Run Deterministic Database Seed
Populate the initial dataset (idempotent, safe to run multiple times):
```bash
npm run seed
```
The seed script inserts:
- **1 Super Administrator**: `admin@aarnex.com` (Password: `Admin@123456`)
- **2 Branches**:
  - `Mumbai Central` (`BR-MUM-01`)
  - `Bangalore Tech Park` (`BR-BLR-01`)
- **4 Branch Users**:
  - `manager.mum@aarnex.com` (`BRANCH_MANAGER`, Mumbai)
  - `staff.mum@aarnex.com` (`STAFF`, Mumbai)
  - `manager.blr@aarnex.com` (`BRANCH_MANAGER`, Bangalore)
  - `staff.blr@aarnex.com` (`STAFF`, Bangalore)
  *(All default user passwords: `User@123456`)*
- **5 Hardware Products**: Mechanical Keyboard, Wireless Mouse, USB-C Dock, Laptop Stand, 4K Webcam.
- **4 Branch-scoped Customers**: 2 in Mumbai, 2 in Bangalore.
- **Initial Inventory**: 50 units per product per branch with corresponding initial `StockMovement` ledger records.

---

## 5. Running the Application

### Development Mode (with hot-reload)
```bash
npm run dev
```

### Production Build & Run
```bash
npm run build
npm start
```
The server will start at `http://localhost:5000`.

---

## 6. Docker Compose Setup (Evaluation Mode)

To run both PostgreSQL and the API service inside Docker containers without any external dependencies:

```bash
docker compose up --build
```

This starts:
1. `aarnex_postgres`: PostgreSQL 16 container with health check (`pg_isready`) and persistent volume `postgres_data`.
2. `aarnex_api`: Containerized Node.js application waiting for Postgres to be healthy before starting.

To stop and remove containers:
```bash
docker compose down -v
```

---

## 7. Interactive Swagger API Documentation

Open your browser and navigate to:
```text
http://localhost:5000/api-docs
```
- Interactive Swagger UI served at `/api-docs` outside the `/api/v1` namespace.
- Raw OpenAPI 3.0 specification available at `http://localhost:5000/api-docs.json`.
- Includes JWT Bearer authentication button (`Authorize`) to test protected endpoints directly.

---

## 8. Automated Acceptance Tests & Honest Verification Results

Run the entire test suite (unit + 10 mandatory integration tests against PostgreSQL):
```bash
npm test
```

### Verified Test Results Summary
All 10 required integration tests were executed against a real PostgreSQL database instance:

| # | Acceptance Test Description | Status | Mechanism Tested |
|---|---|:---:|---|
| **1** | Protected endpoint without token returns 401 | **PASSED** | Express JWT authentication middleware |
| **2** | Branch A staff cannot access Branch B data | **PASSED** | Branch isolation guard on `/branches/:id/inventory` & `/customers` |
| **3** | Incorrect password rejected; secrets absent from responses | **PASSED** | Bcrypt validation, `password_hash` omitted from JSON responses |
| **4** | Database product price overrides submitted client price | **PASSED** | Server authoritative price lookup in `Product` table |
| **5** | Insufficient stock causes complete transaction rollback | **PASSED** | TypeORM `QueryRunner` atomic rollback |
| **6** | Two concurrent orders for last unit result in exactly 1 order | **PASSED** | `SELECT ... FOR UPDATE` pessimistic row lock on `inventories` |
| **7** | Cancellation restores stock exactly once under concurrent requests | **PASSED** | Pessimistic lock on `orders` & deterministic inventory restoration |
| **8** | Invalid order status transitions are rejected | **PASSED** | Lifecycle state-machine: `PLACED` → `PACKED` → `DISPATCHED` → `DELIVERED` |
| **9** | Branch manager cannot adjust another branch's stock | **PASSED** | Role & branch verification (`FORBIDDEN` 403) |
| **10** | Date-range reports match persisted orders | **PASSED** | SQL aggregate queries across UTC day boundaries |

---

## 9. Example API Requests

### 1. Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager.mum@aarnex.com","password":"User@123456"}'
```

### 2. Check Authenticated User Profile
```bash
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### 3. Place an Order (Atomic with Concurrency Control)
```bash
curl -X POST http://localhost:5000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{
    "customer_id": "<CUSTOMER_UUID>",
    "items": [
      { "product_id": "<PRODUCT_UUID>", "quantity": 2 }
    ]
  }'
```

### 4. Cancel an Order (Restores Stock Once)
```bash
curl -X POST http://localhost:5000/api/v1/orders/<ORDER_UUID>/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"reason": "Customer changed mind before dispatch"}'
```

### 5. Fetch Branch Performance Summary Report
```bash
curl -X GET "http://localhost:5000/api/v1/reports/branches/<BRANCH_UUID>/summary?from=2026-01-01&to=2026-12-31" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### 6. Health Check
```bash
curl -X GET http://localhost:5000/api/v1/health
```

---

## 10. Engineering Note (< 1 Page)

### 1. Concurrency & Deadlock Prevention
In high-frequency inventory systems, naive implementations suffer from two classic failure modes:
1. **Race Conditions / Overselling**: Two clients simultaneously checking stock (`quantity > 0`) both read 1, decrement to 0, and commit, selling 2 units when only 1 existed. We resolve this by applying **pessimistic write locks** (`SELECT ... FOR UPDATE`) on the specific inventory row within a database transaction. The second transaction blocks until the first commits, reads the updated stock (`quantity = 0`), and aborts with HTTP 409 Conflict.
2. **Deadlocks**: When Order A locks Product 1 then requests Product 2, while simultaneous Order B locks Product 2 and requests Product 1. We solve this by enforcing **deterministic lock ordering**: all product IDs in a multi-item order are sorted lexicographically before acquiring locks. Every transaction requests resources in the identical order, eliminating lock-inversion deadlocks.

### 2. Monetary Precision (Integer Paise)
Floating-point arithmetic in software (`0.1 + 0.2 === 0.30000000000000004`) causes financial drift and rounding errors. In this system:
- All monetary columns (`price_paise`, `unit_price_paise`, `subtotal_paise`, `total_amount_paise`) are stored as **PostgreSQL 32-bit integers** representing the minor currency unit (paise: ₹1 = 100 paise).
- Historical prices are snapshotted in `OrderItem` at creation time, preserving order history even if catalog prices change later.

### 3. Branch Isolation & Defense-in-Depth
Branch isolation is enforced at both the application and database tiers:
- **Server-Side Token Identity**: Client requests cannot forge `userId`, `role`, or `branchId`. The server derives them exclusively from cryptographically verified JWT tokens.
- **Database Scope & Unique Constraints**: `customers` enforces uniqueness on `(branch_id, email)`, ensuring customers are strictly isolated per branch.
- **Service Verification**: Services reject queries across branches for `BRANCH_MANAGER` and `STAFF`, returning HTTP 403 Forbidden.

### 4. Refresh Token Rotation & Replay Detection
Refresh tokens are stored as SHA-256 hashes in the `refresh_tokens` table. During `/refresh`, the token is marked revoked and atomically swapped for a new token. If a previously revoked or intercepted token is replayed, the system detects the anomaly, immediately invalidates all active sessions for that user family, and flags an audit event.

### 5. Known Limitations & Trade-offs
- **Horizontal Scaling & Rate Limiting**: The current login rate limiter uses in-memory storage (`express-rate-limit`). For multi-instance clustered deployments, a Redis-backed store (`rate-limit-redis`) is recommended.
- **Lock Contention**: Pessimistic locking guarantees strict serializability per inventory row. In ultra-high-throughput flash-sale scenarios (>10,000 req/sec on a single SKU), an in-memory queue or Redis reservation ledger with eventual consistency could replace synchronous database locks.

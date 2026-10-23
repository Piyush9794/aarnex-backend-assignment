# Aarnex Tech Entity-Relationship (ER) Diagram

The following diagram illustrates the relational database model implemented in PostgreSQL via TypeORM entities, including primary keys, foreign keys, cardinality, uniqueness constraints, and checks.

```mermaid
erDiagram
    BRANCHES ||--o{ USERS : "has"
    BRANCHES ||--o{ CUSTOMERS : "serves"
    BRANCHES ||--o{ INVENTORIES : "stocks"
    BRANCHES ||--o{ ORDERS : "fulfills"
    BRANCHES ||--o{ STOCK_MOVEMENTS : "tracks"

    USERS ||--o{ REFRESH_TOKENS : "issues"
    USERS ||--o{ ORDERS : "creates"
    USERS ||--o{ STOCK_MOVEMENTS : "authorizes"
    USERS ||--o{ AUDIT_LOGS : "acts_in"

    CUSTOMERS ||--o{ ORDERS : "places"

    PRODUCTS ||--o{ INVENTORIES : "stocked_as"
    PRODUCTS ||--o{ ORDER_ITEMS : "ordered_in"
    PRODUCTS ||--o{ STOCK_MOVEMENTS : "moved"

    ORDERS ||--|{ ORDER_ITEMS : "contains"

    BRANCHES {
        uuid id PK
        varchar name UK "Unique branch name"
        varchar code UK "Unique branch code e.g. BR-MUM-01"
        text address
        varchar phone
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    USERS {
        uuid id PK
        varchar email UK "Unique email"
        varchar password_hash "Bcrypt hash, hidden by default"
        varchar full_name
        user_role_enum role "SUPER_ADMIN, BRANCH_MANAGER, STAFF"
        uuid branch_id FK "Nullable for SUPER_ADMIN"
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    PRODUCTS {
        uuid id PK
        varchar sku UK "Unique SKU e.g. PROD-KB-001"
        varchar name
        text description
        integer price_paise "CHECK >= 0, integer paise"
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    CUSTOMERS {
        uuid id PK
        uuid branch_id FK "Branch isolation scope"
        varchar name
        varchar email "Unique per branch (branch_id, email)"
        varchar phone
        timestamptz created_at
        timestamptz updated_at
    }

    INVENTORIES {
        uuid id PK
        uuid branch_id FK
        uuid product_id FK
        integer quantity "CHECK >= 0, Unique (branch_id, product_id)"
        timestamptz created_at
        timestamptz updated_at
    }

    STOCK_MOVEMENTS {
        uuid id PK
        uuid branch_id FK
        uuid product_id FK
        integer quantity_change "Signed change"
        integer balance_after
        stock_movement_reason_enum reason "ADJUSTMENT, ORDER_PLACED, ORDER_CANCELLED"
        varchar reference_id
        uuid actor_id FK
        timestamptz created_at
    }

    ORDERS {
        uuid id PK
        varchar order_number UK "Unique e.g. ORD-1710000000-1234"
        uuid branch_id FK
        uuid customer_id FK
        order_status_enum status "PLACED, PACKED, DISPATCHED, DELIVERED, CANCELLED"
        integer total_amount_paise "CHECK >= 0"
        uuid created_by_id FK
        timestamptz cancelled_at
        text cancellation_reason
        timestamptz created_at
        timestamptz updated_at
    }

    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        integer quantity "CHECK > 0"
        integer unit_price_paise "Historical snapshot, CHECK >= 0"
        integer subtotal_paise "CHECK >= 0"
        timestamptz created_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token_hash "SHA-256 hash"
        boolean is_revoked "Replay protection flag"
        uuid replaced_by_token_id "Rotation linkage"
        timestamptz expires_at
        timestamptz created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid actor_id FK
        varchar actor_email
        varchar action
        varchar entity_type
        varchar entity_id
        uuid branch_id
        jsonb metadata "Sanitized - no credentials"
        varchar ip_address
        timestamptz created_at
    }
```

### Key Architectural Constraints
1. **Branch Scoping & Isolation**:
   - `customers` table maintains a compound unique index on `(branch_id, email)`.
   - `inventories` table enforces uniqueness on `(branch_id, product_id)`.
2. **PostgreSQL Integrity Checks**:
   - Monetary values stored strictly as integer paise (`price_paise`, `total_amount_paise`, `unit_price_paise`, `subtotal_paise`) with check constraint `>= 0`.
   - Inventory quantity protected at the database engine level with check constraint `quantity >= 0`.
3. **Pessimistic Concurrency**:
   - Inventory reservation uses `SELECT ... FOR UPDATE` with deterministic lock ordering (sorted `product_id`s) to prevent overselling and eliminate deadlocks.

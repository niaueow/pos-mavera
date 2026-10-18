# POS Mavera — Specification Audit & Implementation Plan

**Document Version:** 1.0.0  
**Status:** Approved Technical Architecture & Implementation Baseline  
**Target System:** POS Mavera (Web-Based Food Ordering & Order Tracking System for Ayam Geprek Mavera)  
**Authors:** Senior Software Architect, Technical Lead, QA Engineer  
**Related Documents:** [PRD.md], [TECHNICAL_DECISIONS.md], [AGENTS.md], [docs/API.md]

---

## 1. Executive Summary

POS Mavera is designed as an operational web-based ordering, payment, and order-tracking solution for Ayam Geprek Mavera. The system's primary operational goal is enabling seamless guest ordering (dine-in with table selection 1–10 and takeaway) without account registration, integrating real-time online payments via Midtrans Snap, ensuring verified server-to-server payment reconciliation, providing secure order status tracking via unguessable cryptographic tracking tokens, and establishing an authenticated internal order progression workflow for kitchen/counter operators.

### Key Audit Findings
1. **Architectural Alignment:** The core high-level architectural decisions across [PRD.md] and [TECHNICAL_DECISIONS.md] are sound and mutually compatible: a clean monorepo separating React/Vite/Tailwind (`/client`) and Node.js/Express/TypeScript/Prisma (`/server`), with PostgreSQL persistence, Vercel frontend hosting, and Render backend hosting.
2. **Current Repository State:** The codebase is at a clean-slate scaffolding stage. Directory trees exist for `/client` and `/server`, but no application code, package configurations, or dependencies have been installed yet. Files such as `server/prisma/schema.prisma`, `server/prisma/seed.ts`, and `server/src/app.ts` are 0-byte placeholders.
3. **Specification Inconsistencies & Critical Gaps Identified:**
   - **Route Naming Contradiction:** [PRD.md] specifies plural `/menus`, whereas [docs/API.md] uses singular `/menu` for public endpoints and plural `/admin/menus` for admin endpoints.
   - **File Naming Defect:** The existing API specification is named `docs/APImd` (missing the dot extension `.md`).
   - **Internal Operator Role in Phase 1:** [PRD.md] restricts `Admin.role` to `ADMIN` / `OWNER` and relegates `/auth/login` to Phase 2, yet requires an authenticated internal operator status update mechanism in Phase 1. [docs/API.md] introduces a `STAFF` role and places `/auth/login` in Phase 1.
   - **Table Number Data Type:** [PRD.md] specifies `tableNumber: String? (1..10)`, whereas [docs/APImd] models `table_number` as an integer (`Int`).
   - **Prisma BigInt JSON Serialization:** [PRD.md] specifies `BigInt` primary keys across multiple tables. In Node.js/Express, native JavaScript `BigInt` causes `TypeError: Do not know how to serialize a BigInt` during `JSON.stringify()`. An architectural mitigation is required.
   - **Spice Level Applicability:** [PRD.md] mandates spice levels 0–5, but items such as beverages and rice do not have spice. A menu flag `hasSpiceLevel` is necessary to prevent validation errors on non-spicy items.
   - **Midtrans Webhook Gross Amount Signature String:** Midtrans computes signatures using `SHA512(order_id + status_code + gross_amount + ServerKey)`. In Midtrans notifications, `gross_amount` can be sent with decimal formatting (e.g. `"36000.00"`). Re-formatting or converting to integer before verification will break signature verification.
4. **Implementation Readiness:** The project is ready to commence implementation starting with **Phase 0 (Technical Foundation & Contract Finalization)**, followed sequentially by **Phase 1 (Operational Customer MVP)** and **Phase 2 (Admin & Owner Dashboard)**. No application implementation code has been written prior to this plan.

---

## 2. Repository Assessment

A comprehensive filesystem and Git audit of `pos-mavera` reveals the following structure:

```text
pos-mavera/
├── .env                              # 0 bytes (empty placeholder)
├── .gitignore                        # Tracks .env, node_modules, dist
├── AGENTS.md                         # Project governance and agent rules (1.7 KB)
├── README.md                         # 0 bytes (empty placeholder)
├── docs/
│   ├── APImd                         # API specification draft (37.9 KB, note missing dot)
│   ├── PRD.md                        # Approved PRD baseline (32.7 KB)
│   └── TECHNICAL_DECISIONS.md        # Binding architectural decisions (11.7 KB)
├── client/
│   └── src/                          # Empty subdirectories: components, hooks, layouts, lib, pages, services, types
└── server/
    ├── prisma/
    │   ├── migrations/               # Directory present, 0 migrations
    │   ├── schema.prisma             # 0 bytes (empty placeholder)
    │   └── seed.ts                   # 0 bytes (empty placeholder)
    └── src/
        ├── app.ts                    # 0 bytes (empty placeholder)
        └── [config, controllers, middlewares, routes, services, utils, validators]/ # Empty subdirectories
```

### Git Repository Status
- **Current branch:** `master`
- **Commit history:** Zero commits (`No commits yet`)
- **Working tree:** All files currently untracked

### Assessment Summary
The repository represents a pristine scaffold without legacy code or technical debt. However, foundational configuration files (`package.json`, `tsconfig.json`, build scripts, lockfiles, linting, testing harnesses) are completely absent. Phase 0 must establish these foundations cleanly before domain logic is implemented.

---

## 3. Specification Audit

### A. Consistency and Contradictions

| # | Topic | Conflict / Ambiguity | Source Documents | Impact | Resolved Architecture Baseline |
|---|---|---|---|---|---|
| 1 | **Public Menu Endpoint** | `GET /menus` vs `GET /menu` | PRD §8.1 vs APImd §5.1, §6.1, §15.11 | Frontend/backend routing mismatch | Standardize on RESTful plural: `GET /api/v1/menus` and `GET /api/v1/menus/:id`. |
| 2 | **API Spec Filename** | Filesystem vs PRD §3.3 & TECHNICAL_DECISIONS §16 | Tooling, markdown renderers, and link breakage | Rename file to standard `docs/API.md`. |
| 3 | **Payment Attempt Endpoint** | `POST /orders/:orderCode/payment` vs `POST /orders/:order_code/payment-attempts` | PRD §8.2 vs APImd §5.1, §8.1 | Endpoint contract ambiguity | Use `POST /api/v1/orders/:orderCode/payment-attempts` to explicitly model multiple attempts per order. |
| 4 | **Table Number Data Type** | `String?` vs integer `Int` | PRD §5.2 vs APImd §4.1, §7.1 | Database schema & validation mismatch | Use `Int` (`@db.SmallInt`) in PostgreSQL/Prisma. Validated strictly as integer `1 <= tableNumber <= 10`. Takeaway orders must pass `null`. |
| 5 | **Internal Operator Authentication** | Login endpoint relegated to Phase 2 in PRD, but Phase 1 requires authenticated operator updates | PRD §8.4, §8.5 vs APImd §5.1, §9.1 | Phase 1 operator cannot authenticate | Move `POST /api/v1/auth/login` and `GET /api/v1/auth/me` to Phase 1. Define internal roles: `STAFF`, `ADMIN`, `OWNER`. |
| 6 | **Monetary Representation** | `Decimal(10,2)` vs integer IDR | PRD §5.1–5.4 vs APImd §3.1, §4.4 | Currency precision & Prisma Decimal serialization complexity | Indonesian Rupiah has no fractional subunits in POS operations. Store as `Int` (or `BigInt` for enterprise scale). In PostgreSQL, standard `Int` supports up to IDR 2,147,483,647 (IDR 2.14B per order), which is more than sufficient. Alternatively, store as `Decimal(12,0)`. Baseline: Use `Int` for simplicity and zero floating-point risk, or `Decimal(12,0)` mapped cleanly in DTOs. |
| 7 | **Primary Key Data Types** | `BigInt` for IDs vs Node.js JSON serialization | PRD §5 vs Prisma / Express defaults | `JSON.stringify` throws `TypeError: Do not know how to serialize a BigInt` | Use standard `Int` (autoincrement) for `Menu.id`, `Order.id`, `OrderItem.id`, `PaymentAttempt.id`, `OrderStatusLog.id`, and `User.id`, OR configure a global Express BigInt JSON serializer. Recommended: Use `Int` for IDs since table row counts for a single restaurant will never exceed 2.1 billion rows. |
| 8 | **Spice Level Scope** | Mandatory spice level 1–5 vs non-spicy items (drinks, plain rice) | PRD §6.2 vs APImd §7.1 | Order validation fails when ordering drinks | Add `hasSpiceLevel: Boolean` (default `false`) to `Menu`. Backend validates `spiceLevel` between 0 and 5 only if `hasSpiceLevel` is true; otherwise `spiceLevel` must be `null`. |
| 9 | **Customer Contact Fields** | PRD marks `customerPhone` as strictly required; APImd marks it open decision | PRD §5.2, §6.4 vs APImd §7.1 | Checkout form validation | Baseline: Require `customerName` and `customerPhone` (validated with Indonesian mobile regex: `^(\+62|62|0)8[1-9][0-9]{7,11}$`). |

---

### B. Architecture and Database Evaluation

1. **Monorepo Appropriateness:** The monorepo structure (`/client` and `/server`) is lightweight, appropriate, and avoids unnecessary tooling overhead (such as complex Nx or Turborepo configurations) while maintaining strict package boundaries.
2. **PostgreSQL & Prisma Data Model:**
   - The relational model correctly captures 1-to-many relationships: `Order` → `OrderItem`, `Order` → `PaymentAttempt`, `Order` → `OrderStatusLog`.
   - **Historical Snapshots:** `OrderItem` correctly stores `menuName` and `unitPrice` snapshots, isolating past orders from future menu edits or soft deletions.
   - **Soft Delete Pattern:** `Menu` utilizes `isDeleted: Boolean` and `isAvailable: Boolean`.
   - **Missing Indexes Identified:** Required composite indexes must be added to the schema:
     - `Order(orderStatus, createdAt)` for operator and admin order boards.
     - `Order(orderCode)` (unique) and `Order(trackingTokenHash)`.
     - `PaymentAttempt(gatewayOrderId)` (unique) and `PaymentAttempt(orderId, status)`.
     - `OrderStatusLog(orderId, createdAt)`.
3. **Transaction Boundaries & Concurrency Risks:**
   - **Order Creation:** Must wrap `Order` insertion, `OrderItem` bulk insertion, and initial `OrderStatusLog` (`PENDING_PAYMENT`) in an atomic `prisma.$transaction`.
   - **Webhook Processing Race Condition:** Concurrent or duplicate webhook events could attempt to advance an order status twice. Must use database-level checks: execute an atomic conditional update where `orderStatus` is transitioned to `RECEIVED` if and only if current status is `PENDING_PAYMENT`.
   - **Operator Status Updates:** Must ensure state transitions follow strict single-step progression (`RECEIVED` → `PREPARING` → `READY` → `COMPLETED`) via optimistic locking or conditional database updates.

---

### C. Payment and Security Evaluation

1. **Midtrans Snap Integration:**
   - Client Key is safely exposed to the frontend via `VITE_MIDTRANS_CLIENT_KEY`.
   - Server Key (`MIDTRANS_SERVER_KEY`) resides exclusively on the backend.
   - Frontends invoke `POST /api/v1/orders/:orderCode/payment-attempts` to receive a `snap_token` and `redirect_url`.
2. **Webhook Verification & Idempotency:**
   - Signature formula: `SHA512(order_id + status_code + gross_amount + ServerKey)`.
   - **Security Rule:** Reject any notification where signature does not match with `403 Forbidden`.
   - **Idempotency Rule:** If a notification with identical `transaction_status` arrives for an already processed attempt, return `200 OK` immediately without creating duplicate status history logs.
   - **Stale Notification Protection:** A delayed `expire` or `deny` notification must NEVER overwrite an order that has already reached `PAID` or an advanced fulfillment state (`RECEIVED`, `PREPARING`, etc.).
3. **Guest Order Tracking Security:**
   - Order code (e.g. `MVR-8K2P7X`) is a public identifier, NOT an access secret.
   - A cryptographic tracking token (32 bytes, hex-encoded = 64 characters) is generated upon order creation.
   - The raw token is returned **once** to the client and must be stored in browser `localStorage`.
   - The backend stores only `SHA256(tracking_token)`.
   - Tracking endpoints (`GET /api/v1/orders/:orderCode`) require header `X-Order-Tracking-Token`.
   - Invalid or missing tokens return `404 Not Found` (anti-enumeration measure).
4. **Price Tampering Prevention:**
   - Frontend submits only `menuId`, `quantity`, `spiceLevel`, `notes`.
   - Backend queries current database prices, validates availability, and computes subtotals and totals authoritatively. Client-submitted prices or totals are rejected or ignored.

---

### D. Business Rules and Operational Workflow

1. **Guest Checkout:** Completely registration-free.
2. **Table Numbers:** Validated strictly between `1` and `10` for `DINE_IN`. Rejected if present for `TAKEAWAY`.
3. **Spice Levels:** Validated strictly between `0` and `5` if `hasSpiceLevel` is true.
4. **Payment Expiration:** Target 15 minutes, passed to Midtrans via `custom_expiry: { expiry_duration: 15, unit: "minute" }`.
5. **No Automatic Time-Based Progression:** Order fulfillment status advances strictly via authorized human operator intervention.
6. **No In-App Cancellation / Refund:** Initial scope excludes customer cancellations. Any refund gateway event is logged internally for manual owner reconciliation.

---

### E. Testing and Deployment Strategy

1. **Testing Framework:** Vitest (backend unit/services), Supertest (API integration with isolated PostgreSQL test container or test schema), Playwright (end-to-end customer journey in Vite dev/preview).
2. **Hosting Pipeline:**
   - **Frontend:** Vercel SPA deployment with rewrite rule `/* -> /index.html`.
   - **Backend:** Render Web Service (Node.js/Express) with build command `npm run build` and start command `npm run start`.
   - **Database:** Render Managed PostgreSQL. Production migrations run via `npx prisma migrate deploy` in Render pre-deploy command or release script. Destructive seed commands are prohibited in production.

---

## 4. Confirmed Technical Decisions

Based on [PRD.md](file:///c:/Users/ASUS/OneDrive/Documents/Projects/pos-mavera/docs/PRD.md) and [TECHNICAL_DECISIONS.md](file:///c:/Users/ASUS/OneDrive/Documents/Projects/pos-mavera/docs/TECHNICAL_DECISIONS.md), the following technical decisions are binding:

1. **Repository Layout:** Monorepo with `/client` (frontend) and `/server` (backend).
2. **Frontend Stack:** React 18+, Vite, TypeScript, Tailwind CSS, React Router v6+, TanStack Query v5+, Axios, Lucide React, React Hook Form, Zod.
3. **Backend Stack:** Node.js 20 LTS, Express.js, TypeScript, Prisma ORM, Zod validation, bcryptjs, jsonwebtoken, cors, helmet, morgan.
4. **Database:** PostgreSQL 15+, accessed exclusively through Prisma ORM with version-controlled migrations.
5. **API Format:** RESTful JSON API at `/api/v1` using standard success (`{ success: true, message, data }`) and error (`{ success: false, error: { code, message, details } }`) envelopes.
6. **Separation of Statuses:**
   - `OrderStatus`: `PENDING_PAYMENT`, `RECEIVED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`.
   - `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`.
7. **Payment Provider:** Midtrans Snap with verified server-to-server notifications and SHA-512 signature verification.
8. **Guest Order Tracking Security:** Order code + SHA-256 hashed tracking token via `X-Order-Tracking-Token` request header.
9. **Staff Authentication:** Internal JWT access tokens for authenticated operations (`STAFF`, `ADMIN`, `OWNER` roles).
10. **Hosting Targets:** Vercel (frontend) and Render (backend + PostgreSQL).

---

## 5. Open Questions and Assumptions

| # | Topic | Question / Ambiguity | Default Working Assumption | Stakeholder Action |
|---|---|---|---|---|
| Q-01 | **Spice Level Labels** | What are the exact customer-facing names for levels 0–5? | Level 0: Tidak Pedas, Level 1: Sedang, Level 2: Pedas Sedang, Level 3: Pedas, Level 4: Pedas Banget, Level 5: Extra Pedas. | Owner to confirm wording. |
| Q-02 | **Customer Phone Requirement** | Is phone number mandatory or optional? | Mandatory. Used for customer identification during pickup/serving. | Owner to confirm. |
| Q-03 | **Phase 1 Staff Account Setup** | How are kitchen operator accounts created? | Provisioned via a secure Prisma seed script (`server/prisma/seed.ts`) reading credentials from environment variables (`INITIAL_STAFF_EMAIL`, `INITIAL_STAFF_PASSWORD`). | Owner to validate setup workflow. |
| Q-04 | **Midtrans Expiry Support** | Does merchant account support Snap `custom_expiry` 15 mins? | Yes, pass `custom_expiry: { expiry_duration: 15, unit: "minute" }` in Snap transaction payload. | Merchant dashboard check. |
| Q-05 | **Unfulfillable Paid Orders** | How to handle an order that is paid but kitchen runs out of ingredients? | Marked internally as `CANCELLED` by Admin; refund handled manually by Owner outside the app. Order status log records reason. | Owner operational confirmation. |
| Q-06 | **Route Naming Agreement** | Finalize `/menus` vs `/menu`. | Adopt standard REST plural `/menus` across all public and admin endpoints. | Approved baseline in this plan. |

---

## 6. Target Architecture

### System Architecture Diagram

```mermaid
graph TD
    subgraph Client ["Client (Vercel) - React + Vite + Tailwind"]
        UI_Guest["Customer UI (/menus, /checkout, /payment, /orders/:code)"]
        UI_Staff["Staff Status UI (/internal/orders)"]
        UI_Admin["Phase 2 Admin Dashboard (/admin/*)"]
    end

    subgraph Midtrans ["Midtrans Payment Gateway"]
        SnapModal["Snap Payment Popup / Redirect"]
        WebhookSender["Server-to-Server Webhook"]
    end

    subgraph Backend ["Backend (Render Web Service) - Express + TypeScript"]
        Router["Express Router (/api/v1)"]
        AuthMiddleware["Auth & Role Middleware"]
        TrackingMiddleware["Tracking Token Validator"]
        ZodValidator["Zod Request Validation"]
        
        subgraph Services ["Application Services"]
            MenuService["Menu Service"]
            OrderService["Order Service (Price Calc, Token Gen)"]
            PaymentService["Payment Service (Snap API, Reconciliation)"]
            StatusService["Status Transition Service (Audit Log)"]
        end
        
        PrismaClient["Prisma ORM Client"]
    end

    subgraph Database ["PostgreSQL (Render Managed DB)"]
        DB_Menu[("Menu Items")]
        DB_Order[("Orders")]
        DB_Item[("Order Items")]
        DB_Payment[("Payment Attempts")]
        DB_Log[("Order Status Logs")]
        DB_User[("Users / Staff / Admin")]
    end

    UI_Guest -->|"HTTP /api/v1 (Public & Tracking)"| Router
    UI_Staff -->|"HTTP /api/v1 (Bearer JWT)"| Router
    UI_Admin -->|"HTTP /api/v1 (Bearer JWT)"| Router
    
    UI_Guest -.->|"Opens Snap Modal"| SnapModal
    PaymentService -->|"Creates Transaction"| SnapModal
    WebhookSender -->|"POST /payments/midtrans/notification"| Router

    Router --> ZodValidator
    Router --> AuthMiddleware
    Router --> TrackingMiddleware
    
    ZodValidator --> Services
    Services --> PrismaClient
    PrismaClient --> Database
```

### Component Boundaries
- **Client Package (`/client`):** Completely decoupled from server runtime and database. Interacts with backend purely via HTTPS REST APIs using TanStack Query and Axios.
- **Server Package (`/server`):** Houses all business logic, authoritative pricing, state transition machines, Midtrans integrations, and database access.
- **Database Layer:** Managed PostgreSQL database with schema enforced via Prisma migrations, unique constraints, and foreign keys.

---

## 7. Database Implementation Plan

### Prisma Schema (`server/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum OrderType {
  DINE_IN
  TAKEAWAY
}

enum OrderStatus {
  PENDING_PAYMENT
  RECEIVED
  PREPARING
  READY
  COMPLETED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  EXPIRED
  CANCELLED
}

enum UserRole {
  STAFF
  ADMIN
  OWNER
}

model Menu {
  id            Int         @id @default(autoincrement())
  name          String      @db.VarChar(100)
  price         Int         // Monetary amount in whole IDR
  category      String      @db.VarChar(50)
  description   String?     @db.Text
  imageUrl      String?     @map("image_url") @db.VarChar(255)
  isAvailable   Boolean     @default(true) @map("is_available")
  hasSpiceLevel Boolean     @default(false) @map("has_spice_level")
  isDeleted     Boolean     @default(false) @map("is_deleted")
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  orderItems    OrderItem[]

  @@index([isDeleted, isAvailable])
  @@index([category])
  @@map("menus")
}

model Order {
  id                Int             @id @default(autoincrement())
  orderCode         String          @unique @map("order_code") @db.VarChar(32)
  trackingTokenHash String          @map("tracking_token_hash") @db.VarChar(64)
  customerName      String          @map("customer_name") @db.VarChar(100)
  customerPhone     String          @map("customer_phone") @db.VarChar(20)
  orderType         OrderType       @map("order_type")
  tableNumber       Int?            @map("table_number") @db.SmallInt
  totalAmount       Int             @map("total_amount") // Whole IDR
  orderStatus       OrderStatus     @default(PENDING_PAYMENT) @map("order_status")
  paymentStatus     PaymentStatus   @default(PENDING) @map("payment_status")
  notes             String?         @db.VarChar(255)
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")

  items             OrderItem[]
  paymentAttempts   PaymentAttempt[]
  statusLogs        OrderStatusLog[]

  @@index([orderStatus, createdAt])
  @@index([paymentStatus])
  @@index([trackingTokenHash])
  @@map("orders")
}

model OrderItem {
  id         Int      @id @default(autoincrement())
  orderId    Int      @map("order_id")
  menuId     Int?     @map("menu_id")
  menuName   String   @map("menu_name") @db.VarChar(100)
  unitPrice  Int      @map("unit_price") // Snapshot in whole IDR
  quantity   Int      @db.SmallInt
  spiceLevel Int?     @map("spice_level") @db.SmallInt
  notes      String?  @db.VarChar(150)
  subtotal   Int      // unitPrice * quantity in whole IDR
  createdAt  DateTime @default(now()) @map("created_at")

  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  menu       Menu?    @relation(fields: [menuId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@map("order_items")
}

model PaymentAttempt {
  id                       Int           @id @default(autoincrement())
  orderId                  Int           @map("order_id")
  gatewayOrderId           String        @unique @map("gateway_order_id") @db.VarChar(64)
  snapToken                String?       @map("snap_token") @db.VarChar(255)
  snapRedirectUrl          String?       @map("snap_redirect_url") @db.VarChar(255)
  transactionId            String?       @map("transaction_id") @db.VarChar(64)
  paymentType              String?       @map("payment_type") @db.VarChar(50)
  grossAmount              Int           @map("gross_amount") // Whole IDR
  status                   PaymentStatus @default(PENDING)
  gatewayTransactionStatus String?       @map("gateway_transaction_status") @db.VarChar(50)
  gatewayFraudStatus       String?       @map("gateway_fraud_status") @db.VarChar(50)
  expiresAt                DateTime      @map("expires_at")
  paidAt                   DateTime?     @map("paid_at")
  createdAt                DateTime      @default(now()) @map("created_at")
  updatedAt                DateTime      @updatedAt @map("updated_at")

  order                    Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, status])
  @@map("payment_attempts")
}

model OrderStatusLog {
  id             Int          @id @default(autoincrement())
  orderId        Int          @map("order_id")
  previousStatus OrderStatus? @map("previous_status")
  newStatus      OrderStatus  @map("new_status")
  changedBy      String       @map("changed_by") @db.VarChar(50) // 'SYSTEM', 'CUSTOMER', or User email
  reason         String?      @db.VarChar(255)
  createdAt      DateTime     @default(now()) @map("created_at")

  order          Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, createdAt])
  @@map("order_status_logs")
}

model User {
  id           Int      @id @default(autoincrement())
  name         String   @db.VarChar(100)
  email        String   @unique @db.VarChar(100)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  role         UserRole @default(STAFF)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@index([email])
  @@map("users")
}
```

### Migration and Seeding Sequence
1. **Migration `0001_initial_schema`:** Creates all tables, enums, foreign keys, and indexes.
2. **Seed Script (`server/prisma/seed.ts`):**
   - Populates initial menu catalog for Ayam Geprek Mavera (Ayam Geprek original, keju, sambal matah, iced tea, rice).
   - Generates initial operational accounts: Staff (`staff@mavera.local`) and Admin (`admin@mavera.local`) with securely hashed passwords using `bcryptjs`.

---

## 8. API Implementation Plan

All application endpoints are prefixed with `/api/v1`.

### Phase 1 Endpoints (Operational MVP)

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/menus` | Public | List available, non-deleted menu items (supports `?search=` and `?category=`). |
| `GET` | `/menus/:id` | Public | Get single menu item details. |
| `POST` | `/orders` | Public (Rate-limited) | Create guest order. Authoritative price calculation; returns `orderCode` and `trackingToken`. |
| `GET` | `/orders/:orderCode` | `X-Order-Tracking-Token` | Track order status, items, timestamps, and safe details. |
| `POST` | `/orders/:orderCode/payment-attempts` | `X-Order-Tracking-Token` | Create or reuse eligible Midtrans Snap transaction attempt. |
| `GET` | `/orders/:orderCode/payment-status` | `X-Order-Tracking-Token` | Read order payment status. |
| `POST` | `/payments/midtrans/notification` | Midtrans Signature | Webhook for payment status updates and reconciliation. |
| `POST` | `/auth/login` | Public (Rate-limited) | Internal staff/admin authentication; returns JWT. |
| `GET` | `/auth/me` | Bearer JWT | Returns authenticated staff/admin identity. |
| `GET` | `/internal/orders` | Bearer JWT (`STAFF`, `ADMIN`) | List active orders awaiting preparation or completion. |
| `PATCH` | `/internal/orders/:id/status` | Bearer JWT (`STAFF`, `ADMIN`) | Advance order status (`RECEIVED` → `PREPARING` → `READY` → `COMPLETED`). |

### Phase 2 Endpoints (Admin & Owner)

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/admin/menus` | Bearer JWT (`ADMIN`, `OWNER`) | List all menu items including unavailable and soft-deleted. |
| `POST` | `/admin/menus` | Bearer JWT (`ADMIN`, `OWNER`) | Create new menu item. |
| `PATCH` | `/admin/menus/:id` | Bearer JWT (`ADMIN`, `OWNER`) | Update menu details (name, price, availability, spice support). |
| `DELETE` | `/admin/menus/:id` | Bearer JWT (`ADMIN`, `OWNER`) | Soft-delete menu item. |
| `GET` | `/admin/orders` | Bearer JWT (`ADMIN`, `OWNER`) | Comprehensive active order board with advanced filtering. |
| `GET` | `/admin/orders/history` | Bearer JWT (`ADMIN`, `OWNER`) | Paginated completed order history. |
| `GET` | `/admin/orders/:id` | Bearer JWT (`ADMIN`, `OWNER`) | Full audit details of an order, payment attempts, and logs. |
| `GET` | `/owner/reports/summary` | Bearer JWT (`OWNER`) | Summary metrics (gross sales, order counts, averages). |
| `GET` | `/owner/reports/transactions`| Bearer JWT (`OWNER`) | Detailed financial transaction list with date filters. |

---

## 9. Security and Payment Plan

### Midtrans Snap Flow & Signature Verification
1. **Transaction Initialization:**
   - Order code: `MVR-XXXXXX`.
   - Gateway order ID: `MVR-XXXXXX-A{attemptNumber}`.
   - Parameter payload to Midtrans:
     ```json
     {
       "transaction_details": {
         "order_id": "MVR-8K2P7X-A1",
         "gross_amount": 36000
       },
       "item_details": [...],
       "customer_details": {
         "first_name": "Budi",
         "phone": "081234567890"
       },
       "expiry": {
         "unit": "minute",
         "duration": 15
       }
     }
     ```
2. **Webhook Verification Algorithm:**
   ```typescript
   const expectedSignature = crypto
     .createHash('sha512')
     .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`)
     .digest('hex');

   if (notification.signature_key !== expectedSignature) {
     throw new ForbiddenException('Invalid Midtrans signature');
   }
   ```
   > [!IMPORTANT]
   > Do NOT alter `notification.gross_amount` (e.g. converting `"36000.00"` to `36000`) before hashing; use the exact string delivered in the notification body.

3. **Status Mapping Matrix:**
   - `settlement` → `PAID`
   - `capture` + fraud_status `accept` → `PAID`
   - `capture` + fraud_status `challenge` → `PENDING`
   - `pending` → `PENDING`
   - `deny` / `cancel` → `FAILED`
   - `expire` → `EXPIRED`
4. **Order Fulfillment Transition on Settlement:**
   - When payment transitions to `PAID`, if order is `PENDING_PAYMENT`, atomically transition order status to `RECEIVED` and insert `OrderStatusLog(previousStatus: PENDING_PAYMENT, newStatus: RECEIVED, changedBy: 'SYSTEM')`.

### Guest Tracking Capability Security
- **Token Generation:** `crypto.randomBytes(32).toString('hex')` (256-bit entropy).
- **Token Hashing:** `crypto.createHash('sha256').update(rawToken).digest('hex')`.
- **Validation Header:** `X-Order-Tracking-Token`.
- **Storage:** Frontend persists `rawToken` in `localStorage` under `pos_mavera_tracking_{orderCode}`.
- **Protection:** Neither URL query parameters nor order codes alone authorize tracking data access.

---

## 10. Phased Implementation Backlog

### Phase 0: Specification and Technical Foundation

#### Task T0-01: Documentation & Specification Alignment
- **Phase & Priority:** Phase 0 | P0 (Must Have)
- **Dependencies:** None
- **Deliverables:** `docs/API.md`, updated references.
- **Acceptance Criteria:** `API.md`; route contradictions resolved to `/menus` and `/orders/:orderCode/payment-attempts`.
- **Required Tests:** Markdown link validity check.
- **Blockers:** None.

#### Task T0-02: Monorepo & Server Package Initialization
- **Phase & Priority:** Phase 0 | P0 (Must Have)
- **Dependencies:** T0-01
- **Deliverables:** `/package.json` (root scripts), `server/package.json`, `server/tsconfig.json`, `server/.env.example`.
- **Acceptance Criteria:** Server builds with `npm run build` using TypeScript compiler; clean directory structure; strict tsconfig.
- **Required Tests:** `npm run build` succeeds on server.
- **Blockers:** None.

#### Task T0-03: Client Package Initialization
- **Phase & Priority:** Phase 0 | P0 (Must Have)
- **Dependencies:** T0-01
- **Deliverables:** `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/tailwind.config.js`, `client/index.html`, `client/src/main.tsx`.
- **Acceptance Criteria:** React + Vite app boots and renders with Tailwind styling; dev server runs via `npm run dev`.
- **Required Tests:** Client build passes `npm run build`.
- **Blockers:** None.

#### Task T0-04: Database Schema Definition & Prisma Migration
- **Phase & Priority:** Phase 0 | P0 (Must Have)
- **Dependencies:** T0-02
- **Deliverables:** `server/prisma/schema.prisma`, initial migration files in `server/prisma/migrations/`.
- **Acceptance Criteria:** Schema matches the validated design in Section 7; `npx prisma migrate dev` creates tables and indexes in PostgreSQL.
- **Required Tests:** `npx prisma validate` passes; migration applies cleanly.
- **Blockers:** Local/Render PostgreSQL database URL.

#### Task T0-05: Database Seed & Initial User Provisioning
- **Phase & Priority:** Phase 0 | P0 (Must Have)
- **Dependencies:** T0-04
- **Deliverables:** `server/prisma/seed.ts`.
- **Acceptance Criteria:** Seed script creates Ayam Geprek menu items (with `hasSpiceLevel` set appropriately) and default `STAFF` and `ADMIN` users with bcrypt-hashed passwords.
- **Required Tests:** `npx prisma db seed` executes idempotently.
- **Blockers:** None.

#### Task T0-06: Server Architecture Scaffold & Core Middlewares
- **Phase & Priority:** Phase 0 | P0 (Must Have)
- **Dependencies:** T0-04
- **Deliverables:** `server/src/app.ts`, `server/src/config/env.ts`, `server/src/middlewares/errorHandler.ts`, `server/src/middlewares/auth.ts`, `server/src/utils/response.ts`.
- **Acceptance Criteria:** Express app boots; parses JSON; validates environment variables on startup; catches unhandled errors and returns standardized error envelopes; CORS configured.
- **Required Tests:** Unit tests for response formatter and error middleware.
- **Blockers:** None.

---

### Phase 1: Operational Customer MVP

#### Task T1-01: Menu Service & Public API
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T0-06
- **Deliverables:** `server/src/services/menu.service.ts`, `server/src/controllers/menu.controller.ts`, `server/src/routes/menu.routes.ts`.
- **Acceptance Criteria:** `GET /api/v1/menus` returns available, non-deleted items; supports search query `?search=`; `GET /api/v1/menus/:id` returns single item.
- **Required Tests:** Supertest integration tests for menu listing, search filtering, and 404 for deleted items.
- **Blockers:** None.

#### Task T1-02: Public Menu & Item Selection UI
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T0-03, T1-01
- **Deliverables:** `client/src/pages/MenuPage.tsx`, `client/src/components/MenuItemCard.tsx`, `client/src/components/ItemModal.tsx`, `client/src/hooks/useCart.ts`.
- **Acceptance Criteria:** Responsive mobile-first menu grid; real-time search; modal to select quantity (1..99), spice level (0..5 for spicy items), and notes; cart state preserved in local storage.
- **Required Tests:** Component tests for spice selector visibility based on `hasSpiceLevel`.
- **Blockers:** None.

#### Task T1-03: Order Service & Authoritative Creation API
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T1-01
- **Deliverables:** `server/src/validators/order.validator.ts`, `server/src/services/order.service.ts`, `server/src/controllers/order.controller.ts`, `server/src/routes/order.routes.ts`.
- **Acceptance Criteria:** `POST /api/v1/orders` validates payload with Zod; enforces table 1..10 for DINE_IN; recalculates all totals server-side; generates order code and tracking token; persists records and initial log in a single transaction; returns `orderCode` and `trackingToken`.
- **Required Tests:** Integration tests verifying rejection of price tampering, invalid tables, and empty carts.
- **Blockers:** None.

#### Task T1-04: Cart & Checkout UI
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T1-02, T1-03
- **Deliverables:** `client/src/pages/CheckoutPage.tsx`, `client/src/components/TableSelector.tsx`.
- **Acceptance Criteria:** Cart review; quantity adjustments; toggle between Dine-In (table 1..10 picker) and Takeaway; customer name and phone inputs; submits order to backend and stores returned `trackingToken` in `localStorage`; redirects to payment page.
- **Required Tests:** Form validation tests for table selection and customer details.
- **Blockers:** None.

#### Task T1-05: Midtrans Payment Attempt Service & API
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T1-03
- **Deliverables:** `server/src/services/payment.service.ts`, `server/src/controllers/payment.controller.ts`, `server/src/routes/payment.routes.ts`.
- **Acceptance Criteria:** `POST /api/v1/orders/:orderCode/payment-attempts` verifies tracking token; ensures order is eligible and unpaid; creates Midtrans Snap transaction with 15-minute expiry; persists `PaymentAttempt` with unique `gatewayOrderId`; returns Snap token.
- **Required Tests:** Integration test mocking Midtrans API; checks error on paid orders.
- **Blockers:** Midtrans sandbox credentials.

#### Task T1-06: Customer Payment UI
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T1-04, T1-05
- **Deliverables:** `client/src/pages/PaymentPage.tsx`, Snap script loader.
- **Acceptance Criteria:** Renders order summary and payment status; loads Snap popup via `window.snap.pay`; handles `onSuccess`, `onPending`, `onError`, `onClose`; polls safe payment status; automatically routes to order tracking upon completion.
- **Required Tests:** Unit tests for Snap callback handling and error fallback.
- **Blockers:** None.

#### Task T1-07: Midtrans Webhook Processing & Payment Reconciliation
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T1-05
- **Deliverables:** `server/src/services/webhook.service.ts`, notification route handler.
- **Acceptance Criteria:** `POST /api/v1/payments/midtrans/notification` verifies SHA-512 signature; processes idempotently; maps statuses (`settlement` -> `PAID`); transitions order to `RECEIVED`; writes status audit log transactionally.
- **Required Tests:** Test suite covering valid settlement, invalid signature (403), duplicate notifications, and out-of-order delivery.
- **Blockers:** None.

#### Task T1-08: Order Tracking Service & API
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T1-03
- **Deliverables:** `server/src/middlewares/tracking.ts`, order tracking controller.
- **Acceptance Criteria:** `GET /api/v1/orders/:orderCode` enforces `X-Order-Tracking-Token`; returns customer-safe data (items, statuses, timestamps); masks phone and internal IDs; returns 404 if token is invalid.
- **Required Tests:** Security tests verifying access denial when token is omitted or tampered.
- **Blockers:** None.

#### Task T1-09: Customer Order Tracking UI
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T1-08
- **Deliverables:** `client/src/pages/OrderTrackingPage.tsx`, `client/src/components/StatusTimeline.tsx`.
- **Acceptance Criteria:** Clean status progression bar (`PENDING_PAYMENT` -> `RECEIVED` -> `PREPARING` -> `READY` -> `COMPLETED`); polls status every 10–15s while active; stops polling upon completion; pulls token from `localStorage`.
- **Required Tests:** Visual state testing for all 5 fulfillment states.
- **Blockers:** None.

#### Task T1-10: Staff Authentication & Internal API
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T0-06
- **Deliverables:** `server/src/services/auth.service.ts`, `server/src/controllers/auth.controller.ts`, `server/src/routes/auth.routes.ts`, `server/src/routes/internal.routes.ts`.
- **Acceptance Criteria:** `POST /api/v1/auth/login` validates credentials with bcrypt; issues JWT; `PATCH /api/v1/internal/orders/:id/status` enforces valid single-step transition; records actor in audit log; rejects unpaid order progression.
- **Required Tests:** Integration tests for login, invalid token rejection, invalid status jumps, and audit log verification.
- **Blockers:** None.

#### Task T1-11: Minimal Operational Staff UI
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T1-10
- **Deliverables:** `client/src/pages/StaffLoginPage.tsx`, `client/src/pages/StaffOrdersPage.tsx`.
- **Acceptance Criteria:** Protected route; shows list of paid active orders (`RECEIVED`, `PREPARING`, `READY`); provides single-click action buttons to advance status; updates in real-time or via polling.
- **Required Tests:** Authentication state and route protection tests.
- **Blockers:** None.

#### Task T1-12: Phase 1 End-to-End Testing & Verification
- **Phase & Priority:** Phase 1 | P0 (Must Have)
- **Dependencies:** T1-01 through T1-11
- **Deliverables:** `playwright.config.ts`, `e2e/guest-journey.spec.ts`.
- **Acceptance Criteria:** Automated test executes full customer journey: browse menu -> add to cart -> checkout dine-in table 4 -> create order -> mock payment settlement -> staff marks preparing -> staff marks ready -> customer tracking verifies status updates.
- **Required Tests:** Playwright full journey pass.
- **Blockers:** None.

---

### Phase 2: Admin and Owner Dashboard

#### Task T2-01: Role-Based Access Control & Admin Auth Expansion
- **Phase & Priority:** Phase 2 | P1 (High)
- **Dependencies:** T1-10
- **Deliverables:** Role guard middleware (`requireRole('ADMIN', 'OWNER')`), token refresh/logout if required.
- **Acceptance Criteria:** Strict role enforcement on `/api/v1/admin/*` and `/api/v1/owner/*`.
- **Required Tests:** Permission boundary tests for `STAFF` attempting to access admin endpoints.
- **Blockers:** Phase 1 stability.

#### Task T2-02: Admin Menu Management API
- **Phase & Priority:** Phase 2 | P1 (High)
- **Dependencies:** T2-01
- **Deliverables:** `server/src/controllers/adminMenu.controller.ts`, `server/src/routes/admin.routes.ts`.
- **Acceptance Criteria:** CRUD operations on menu items; toggle availability; soft-delete preserving historical order item references.
- **Required Tests:** Soft deletion tests verifying old order items still retain menu snapshot data.
- **Blockers:** None.

#### Task T2-03: Admin Menu Management UI
- **Phase & Priority:** Phase 2 | P1 (High)
- **Dependencies:** T2-02
- **Deliverables:** `client/src/pages/admin/AdminMenuPage.tsx`, `client/src/components/MenuFormModal.tsx`.
- **Acceptance Criteria:** Data table with availability toggles, edit modal, creation form, and soft-delete confirmation.
- **Required Tests:** UI tests for menu item creation and validation errors.
- **Blockers:** None.

#### Task T2-04: Admin Active Order Board & Order Detail
- **Phase & Priority:** Phase 2 | P1 (High)
- **Dependencies:** T2-01
- **Deliverables:** `client/src/pages/admin/AdminOrdersPage.tsx`, `client/src/components/OrderDetailModal.tsx`.
- **Acceptance Criteria:** Kanban or column-based active order board; filter by order type and status; full view of customer info, item notes, payment attempts, and status change audit log.
- **Required Tests:** Status transition action tests from admin board.
- **Blockers:** None.

#### Task T2-05: Admin Order History & Search
- **Phase & Priority:** Phase 2 | P1 (High)
- **Dependencies:** T2-04
- **Deliverables:** `client/src/pages/admin/AdminHistoryPage.tsx`, `server/src/controllers/adminOrderHistory.controller.ts`.
- **Acceptance Criteria:** Paginated table of completed and cancelled orders with date range filter (`from`, `to`), search by order code or phone.
- **Required Tests:** Pagination and query filter integration tests.
- **Blockers:** None.

#### Task T2-06: Owner Financial Summary API & Reports
- **Phase & Priority:** Phase 2 | P1 (High)
- **Dependencies:** T2-01
- **Deliverables:** `server/src/services/report.service.ts`, `server/src/controllers/owner.controller.ts`.
- **Acceptance Criteria:** `GET /api/v1/owner/reports/summary` computes total revenue, total orders, average order value, and top-selling items over a date range.
- **Required Tests:** Financial aggregation accuracy unit tests.
- **Blockers:** Confirmation of owner KPI definitions.

#### Task T2-07: Owner Dashboard UI
- **Phase & Priority:** Phase 2 | P1 (High)
- **Dependencies:** T2-06
- **Deliverables:** `client/src/pages/owner/OwnerDashboardPage.tsx`, summary cards, revenue charts.
- **Acceptance Criteria:** Executive dashboard showing gross revenue, transaction counts, dine-in vs takeaway ratio, and date-range filtering.
- **Required Tests:** Chart and summary component rendering tests.
- **Blockers:** None.

#### Task T2-08: Phase 2 Regression & Release Testing
- **Phase & Priority:** Phase 2 | P1 (High)
- **Dependencies:** T2-01 through T2-07
- **Deliverables:** Full end-to-end regression test suite.
- **Acceptance Criteria:** All Phase 1 and Phase 2 test suites pass; build checks succeed; zero security vulnerabilities reported by `npm audit`.
- **Required Tests:** Full regression execution.
- **Blockers:** None.

---

## 11. Testing Strategy

### Test Pyramid

```text
       / \
      / E2E \       Playwright (Full Customer & Staff Journeys)
     /-------\
    /  Integ  \     Supertest + Isolated PostgreSQL Test DB (API Contracts, Webhooks)
   /-----------\
  /    Unit     \   Vitest (Calculations, State Machines, Signature Validation, Zod)
 /---------------\
```

### 1. Unit Tests (Vitest)
- **Price Calculation:** Subtotal calculation (`unitPrice * quantity`), order total sum, handling zero or negative quantities.
- **Validation Logic:** Dine-in table bounds (`1 <= tableNumber <= 10`), takeaway table nullification, spice level validation (0..5 conditional on `hasSpiceLevel`).
- **State Machine Transitions:** Verify allowed transitions (`PENDING_PAYMENT` -> `RECEIVED` -> `PREPARING` -> `READY` -> `COMPLETED`) and rejection of invalid skips (e.g. `PENDING_PAYMENT` -> `PREPARING`).
- **Signature Verification:** SHA-512 generation and comparison using test Midtrans parameters.

### 2. Integration Tests (Supertest)
- **Order Creation API:** Verify server-authoritative pricing (ignoring client-sent totals); verify database persistence and unique order code generation.
- **Tracking Access Security:** Verify `GET /orders/:orderCode` returns 404/403 when `X-Order-Tracking-Token` is missing or invalid.
- **Payment Webhook:** Test valid settlement updates order to `RECEIVED`; test duplicate webhook idempotency; test invalid signature rejection (403).
- **Staff Operations:** Test authenticated status updates with JWT; test 401 for unauthenticated requests; test 409 when attempting to advance an unpaid order.

### 3. End-to-End Tests (Playwright)
- **Dine-In Journey:** Customer opens menu -> adds 2 Ayam Geprek (spice 3) -> enters cart -> selects Table 3 -> fills name/phone -> creates order -> triggers sandbox payment -> observes order status change to `RECEIVED` -> staff advances order to `READY` -> tracking page reflects `READY`.
- **Takeaway Journey:** Customer selects takeaway -> verifies no table number is required -> completes payment flow.

---

## 12. Deployment Plan

### Target Infrastructure Architecture

| Service | Provider | Configuration |
|---|---|---|
| **Frontend Web App** | Vercel | Framework: Vite; Build command: `npm run build`; Output directory: `dist`. SPA redirect rewrite in `vercel.json`. |
| **Backend API Service** | Render | Environment: Node; Build command: `npm install && npm run build`; Start command: `npm run start`. Pre-deploy command: `npx prisma migrate deploy`. |
| **Database** | Render Managed PostgreSQL | PostgreSQL 15+, SSL required, connection pool enabled. |
| **Payment Gateway** | Midtrans Sandbox / Production | Notification URL: `https://<backend-render-domain>/api/v1/payments/midtrans/notification`. |

### Environment Variables Matrix

#### Backend (`server/.env`)
- `NODE_ENV`: `production` | `development` | `test`
- `PORT`: `5000`
- `DATABASE_URL`: `postgresql://user:password@host:5432/pos_mavera?sslmode=require`
- `JWT_SECRET`: High-entropy 64-char secret string
- `JWT_EXPIRES_IN`: `8h`
- `FRONTEND_URL`: `https://pos-mavera.vercel.app` (or `http://localhost:5173` for dev)
- `MIDTRANS_SERVER_KEY`: Midtrans Server Key
- `MIDTRANS_CLIENT_KEY`: Midtrans Public Client Key
- `MIDTRANS_IS_PRODUCTION`: `false` (Sandbox) / `true` (Production)
- `INITIAL_STAFF_EMAIL`: Seed operational user email
- `INITIAL_STAFF_PASSWORD`: Seed operational user password

#### Frontend (`client/.env`)
- `VITE_API_BASE_URL`: `https://<backend-domain>/api/v1`
- `VITE_MIDTRANS_CLIENT_KEY`: Midtrans Public Client Key
- `VITE_MIDTRANS_SNAP_URL`: `https://app.sandbox.midtrans.com/snap/snap.js` (or production URL)

---

## 13. Dependencies and Blockers

### External Dependencies
1. **Midtrans Merchant Sandbox Account:** Required for `MIDTRANS_SERVER_KEY` and `MIDTRANS_CLIENT_KEY` to verify payment attempt creation and server webhook delivery.
2. **PostgreSQL Database Instance:** Required for applying migrations and running integration tests.
3. **Owner Confirmation:** Validation of spice level naming, confirmation of operational cancellation SOP, and staff credential handoff.

### Current Blockers
- **None for Phase 0.** Foundational setup, configuration, package initialization, and schema creation can begin immediately upon plan approval.

---

## 14. Definition of Done

A task is complete only when:
1. **Acceptance Criteria Satisfied:** All functional and security requirements in the task specification are demonstrably met.
2. **Automated Tests Executed:** Unit and integration tests for the task are written and executed with passing results reported.
3. **Type & Lint Checks Pass:** TypeScript compiler (`tsc --noEmit`) and linter pass with zero errors.
4. **Security & Input Validation:** All API inputs are validated using Zod; secrets are never logged or returned in responses.
5. **No Regressions:** Existing tests continue to pass.
6. **Documentation Updated:** Changes or contract adjustments are documented in `docs/API.md` and related references.

---

## 15. Recommended Next Steps

Upon review and stakeholder approval of this audit and implementation plan, the technical lead must execute the following initial tasks in sequence:

1. **Fix Documentation Naming Defect:** standardize the public menu route to `/menus`.
2. **Execute Task T0-02 & T0-03:** Initialize the root monorepo scripts, `server/package.json`, and `client/package.json` with stable dependencies and TypeScript configurations.
3. **Execute Task T0-04:** Write the complete `server/prisma/schema.prisma` and generate the initial database migration.
4. **Execute Task T0-05 & T0-06:** Establish seed data and the Express core application pipeline.

> [!IMPORTANT]
> In accordance with project governance rules, application feature development remains paused until this plan is reviewed and approved.

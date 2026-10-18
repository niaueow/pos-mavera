# Product Requirements Document (PRD)

## POS Mavera --- Web-Based Food Ordering & Order Tracking System

**Repository:** `pos-mavera`\
**Document status:** Approved implementation baseline, subject to owner
validation of operational assumptions\
**Product type:** Web application\
**Architecture:** Monorepo (`/client` and `/server`)\
**Deployment:** Vercel (frontend), Render (backend and PostgreSQL)\
**Database:** PostgreSQL\
**ORM:** Prisma ORM\
**Delivery model:** Two phases; operational customer MVP first

------------------------------------------------------------------------

# 1. Product Overview

## 1.1 Background

POS Mavera is a web-based food ordering and order-tracking application
for Ayam Geprek Mavera. Customers can browse and search the menu, select
items, check their cart, pay through Midtrans, and track the order
without creating an account.

## 1.2 Product Goals

1.  Enable guest ordering without customer registration.
2.  Support dine-in and takeaway.
3.  Provide menu search, cart review, online payment, and order
    tracking.
4.  Show trustworthy order states from payment confirmation through
    completion.
5.  Reduce reliance on manual WhatsApp communication for order updates.
6.  Establish a maintainable architecture for the later Admin and Owner
    dashboard.

## 1.3 Users

-   **Guest/customer:** browses menus, creates an order, pays, and
    tracks their own order.
-   **Internal operator:** in Phase 1, uses a restricted, authenticated
    mechanism to advance order status.
-   **Admin/cashier:** in Phase 2, manages menus and orders.
-   **Owner:** in Phase 2, accesses Admin capabilities and transaction
    summary reports.

## 1.4 Success Criteria

Phase 1 succeeds when customers can complete the full journey; the
backend recalculates prices; Midtrans payment notifications are verified
and reconciled; tracking is access-controlled; status transitions are
valid; and the end-to-end journey passes tests in the deployed
environment.

------------------------------------------------------------------------

# 2. Scope and Phases

## 2.1 Phase 1 --- Customer/Guest MVP (P0)

Phase 1 is an **operational MVP for real orders**, not a simulated demo.

  -----------------------------------------------------------------------
  ID                      Feature                 Requirements
  ----------------------- ----------------------- -----------------------
  P1-01                   View menu               Display available
                                                  food/drink items,
                                                  prices, categories, and
                                                  optional
                                                  descriptions/images.

  P1-02                   Search menu             Search menu by name;
                                                  show empty, loading,
                                                  and error states.

  P1-03                   Select menu             Select quantity, spice
                                                  level from 0--5, and
                                                  optional item notes.

  P1-04                   Cart                    Review items, update
                                                  quantity, remove items,
                                                  and view totals.

  P1-05                   Guest checkout          Collect name, phone,
                                                  order type, and table
                                                  number for dine-in.

  P1-06                   Payment                 Create a Midtrans Snap
                                                  payment attempt.

  P1-07                   Payment result          Display pending,
                                                  successful, failed, and
                                                  expired payment states.

  P1-08                   Order tracking          Track order with order
                                                  code and secure
                                                  tracking capability.

  P1-09                   Order ready             Clearly display when an
                                                  operator marks an order
                                                  ready.

  P1-10                   Order completed         Display completion when
                                                  an operator marks the
                                                  order completed.

  P1-11                   Minimal internal status Provide an
                          workflow                authenticated,
                                                  restricted way for an
                                                  operator to update
                                                  order status; no full
                                                  Admin dashboard.

  P1-12                   Responsive UI           Support mobile-first
                                                  and desktop browser
                                                  layouts.
  -----------------------------------------------------------------------

### Phase 1 exclusions

-   Customer accounts or registration.
-   Full Admin/Owner dashboards.
-   Menu CRUD UI and owner reports.
-   Quantity-based inventory management.
-   Loyalty, coupons, rewards, delivery management, and advanced
    analytics.
-   Automated WhatsApp/push notifications.
-   In-app refund workflow.
-   Automatic status progression based on elapsed time.

## 2.2 Phase 2 --- Admin and Owner (P1, after Phase 1 is stable)

**Admin/cashier** - Login/logout and role-based access control. - Menu
CRUD and availability toggle. - View active orders and order details. -
Advance order status using the same backend business rules as Phase 1. -
View completed order history and status logs.

**Owner** - Admin capabilities. - Transaction and order summary
dashboard. - Basic date-range reports.

## 2.3 Milestones

1.  Technical foundation, schema, migrations, and API contract.
2.  Menu browsing, search, selection, and cart.
3.  Checkout, order creation, and tracking access.
4.  Midtrans payment integration and webhook reconciliation.
5.  Authenticated internal status update workflow.
6.  Phase 1 QA and deployment.
7.  Phase 2 Admin dashboard.
8.  Owner reports and final QA.

Phase 2 must reuse Phase 1 services, APIs, state-transition rules, and
database models wherever possible.

------------------------------------------------------------------------

# 3. Technical Architecture

## 3.1 Stack

**Frontend (`/client`)** - React, Vite, TypeScript, Tailwind CSS. -
React Router. - TanStack Query. - Axios or equivalent centralized HTTP
client. - Lucide Icons. - React Hook Form and Zod where useful.

**Backend (`/server`)** - Node.js, TypeScript, Express.js. - REST API. -
Prisma ORM. - PostgreSQL. - Zod or equivalent request validation. -
Authenticated internal operations; bcrypt and role-based admin
authentication for Phase 2. - Midtrans Snap SDK. - Structured
application logging.

**Testing** - Vitest for unit tests. - Supertest for API integration
tests. - Playwright for end-to-end tests. - Separate test database from
development and production.

Use compatible stable dependency versions and commit package lockfiles.

## 3.2 Architecture Rules

1.  Frontend never connects directly to PostgreSQL.
2.  Backend owns business rules and all authoritative calculations.
3.  Prisma is the only ORM; schema changes use Prisma migrations.
4.  Controllers remain thin; domain logic belongs in services.
5.  Payment gateway logic is isolated in a payment service.
6.  Validation, authentication, authorization, and error handling are
    reusable.
7.  `/client` and `/server` remain separate packages in one monorepo.
8.  Do not implement a full Admin dashboard in Phase 1.
9.  The Phase 1 status workflow and Phase 2 dashboard must call the same
    status-transition service/API.
10. No production status may change automatically just because a timer
    elapsed.

## 3.3 Suggested Repository Structure

``` text
pos-mavera/
├── client/
│   ├── src/{components,pages,layouts,services,hooks,types,lib}/
│   ├── public/
│   └── package.json
├── server/
│   ├── src/{controllers,services,routes,middlewares,validators,config,utils}/
│   ├── prisma/{schema.prisma,migrations,seed.ts}
│   ├── tests/
│   └── package.json
├── docs/
│   ├── PRD.md
│   ├── TECHNICAL_DECISIONS.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── API.md
├── .env.example
├── .gitignore
├── AGENTS.md
├── package.json
└── README.md
```

------------------------------------------------------------------------

# 4. Roles and Access

  -----------------------------------------------------------------------
  Role                    Phase                   Permissions
  ----------------------- ----------------------- -----------------------
  Guest/customer          Phase 1                 Browse/search menus,
                                                  create orders, pay,
                                                  track own order.

  Internal operator       Phase 1                 Authenticated status
                                                  updates only, through a
                                                  restricted workflow.

  Admin                   Phase 2                 Menu management, order
                                                  management, history.

  Owner                   Phase 2                 Admin permissions and
                                                  reports.
  -----------------------------------------------------------------------

Guests do not register. An order code alone is not sufficient
authorization to access an order. Tracking must require a high-entropy,
order-scoped tracking capability. Store only a hash of the tracking
token. Customer-facing APIs return only necessary fields.

Phase 1 must not expose an unauthenticated status-update endpoint. The
operator workflow must be protected with an authenticated internal
identity or an equivalently secure provisioned credential. No public
admin registration is allowed.

------------------------------------------------------------------------

# 5. Database Design

Use PostgreSQL through Prisma. Store monetary values as
`Decimal`/`NUMERIC`, never floating-point values. Use consistent naming
conventions and explicit Prisma mappings if database column names use
snake_case.

## 5.1 `Menu`

-   `id`: Int, primary key, auto-increment.
-   `name`: String, required, max 100.
-   `price`: Decimal(10,2), required, non-negative.
-   `category`: String, required, max 50.
-   `description`: String?, optional.
-   `imageUrl`: String?, optional.
-   `isAvailable`: Boolean, default true.
-   `isDeleted`: Boolean, default false.
-   `createdAt`, `updatedAt`: timestamps.

Only available, non-deleted menu items can be ordered. Track
availability only; do not implement quantity-based stock. Soft-deleted
menu items must not disappear from historical order snapshots.

## 5.2 `Order`

-   `id`: BigInt, primary key, auto-increment.
-   `orderCode`: String, unique, required.
-   `trackingTokenHash`: String, required; never store raw tracking
    token.
-   `customerName`: String, required.
-   `customerPhone`: String, required.
-   `orderType`: enum `DINE_IN` / `TAKEAWAY`.
-   `tableNumber`: String?, required for dine-in; must be one of
    `1`--`10`.
-   `totalAmount`: Decimal(10,2), required, non-negative.
-   `orderStatus`: enum, default `PENDING_PAYMENT`.
-   `paymentStatus`: enum, default `PENDING`.
-   `createdAt`, `updatedAt`: timestamps.

Order statuses: `PENDING_PAYMENT`, `RECEIVED`, `PREPARING`, `READY`,
`COMPLETED`, `CANCELLED`.

Payment statuses: `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`.
Keep payment status separate from fulfillment status.

## 5.3 `OrderItem`

-   `id`: BigInt, primary key.
-   `orderId`: BigInt, foreign key to Order.
-   `menuId`: Int?, optional reference to Menu.
-   `menuName`: String, name snapshot.
-   `unitPrice`: Decimal(10,2), price snapshot.
-   `quantity`: positive integer.
-   `spiceLevel`: integer 0--5 where applicable.
-   `notes`: String?, optional and length-limited.
-   `subtotal`: Decimal(10,2), calculated by backend.

Every order must contain at least one item. Backend calculates
`subtotal = unitPrice × quantity` and derives the order total from
persisted item data. Historical snapshots must remain valid if a menu
entry is changed or soft-deleted.

## 5.4 `PaymentAttempt`

One order may have multiple payment attempts. - `id`: BigInt, primary
key. - `orderId`: BigInt, foreign key to Order. - `gatewayOrderId`:
String, unique. - `snapToken`: String?, optional. - `transactionId`:
String?, optional gateway transaction identifier. - `paymentMethod`:
String?, optional. - `grossAmount`: Decimal(10,2), required. - `status`:
normalized payment status. - `gatewayTransactionStatus`: String?, raw
provider status. - `gatewayFraudStatus`: String?, optional. -
`expiresAt`: DateTime. - `paidAt`: DateTime?, optional. - `createdAt`,
`updatedAt`: timestamps.

Each attempt has a unique gateway order ID. Create a new attempt only
after the prior attempt is terminal and its gateway state has been
reconciled. Do not create duplicate active attempts. Prevent further
attempts after a payment is confirmed successful. Handle unexpected
refund-related notifications safely and log/reconcile them; do not
silently overwrite payment or order state.

## 5.5 `OrderStatusLog`

-   `id`: BigInt, primary key.
-   `orderId`: BigInt, foreign key to Order.
-   `previousStatus`: String?, optional.
-   `newStatus`: String, required.
-   `changedBy`: internal actor identifier or `SYSTEM`.
-   `reason`: String?, optional.
-   `createdAt`: timestamp.

Order status changes and logs must be committed transactionally. Prefer
a relational actor reference when practical.

## 5.6 `Admin`

Used for Phase 2 and the authenticated Phase 1 operator workflow. -
`id`: BigInt, primary key. - `name`: String, required. - `email`:
String, unique. - `passwordHash`: String, required. - `role`: enum
`ADMIN` / `OWNER`. - `isActive`: Boolean, default true. - `createdAt`,
`updatedAt`: timestamps.

Provision initial credentials securely; never create public admin
registration.

## 5.7 Relationships and Indexes

-   Order → OrderItem: one-to-many.
-   Order → PaymentAttempt: one-to-many.
-   Order → OrderStatusLog: one-to-many.
-   Menu → OrderItem: one-to-many, with historical snapshots retained.
-   Unique index: `Order.orderCode`.
-   Unique index: `PaymentAttempt.gatewayOrderId`.
-   Index order creation date, order status/payment status, order items
    by order ID, payment attempts by order ID, and status logs by order
    ID/date.
-   Deletion rules must preserve order, payment, and audit history.

------------------------------------------------------------------------

# 6. Customer Journey and Rules

## 6.1 View and Search Menu

Route: `/` - Display available items, prices, categories, and optional
description/image. - Search by menu name, case-insensitively, trimming
surrounding whitespace. - Show loading, error, and no-results states. -
Only available and non-deleted items are public. - Cart remains intact
when search changes.

## 6.2 Select Menu

-   Customer selects quantity, spice level 0--5 where applicable, and
    optional notes.
-   Quantity must be a positive integer within a configured limit.
-   Notes must be length-limited.
-   Backend validates spice levels and menu availability.
-   If an item becomes unavailable before checkout, reject it and ask
    the customer to review the cart.

## 6.3 Cart

Route: `/checkout` - Review, update, and remove items. - Display item
subtotals and total. - Browser storage may preserve the cart for
convenience but is never authoritative. - Backend recalculates all
prices from the database during order creation.

## 6.4 Guest Checkout

Required: customer name, phone, order type, at least one item; table
number for dine-in.

QR/table rules: - Use one shared QR code. - Customer manually selects a
table number from `1` through `10` for dine-in. - Validate the table
number on the backend; reject values outside that range. - Takeaway
orders do not require a table number.

Backend: 1. Validate request. 2. Check menu availability. 3. Load
authoritative prices. 4. Calculate subtotals and total. 5. Generate a
unique order code and high-entropy tracking token. 6. Persist order,
items, and initial status log transactionally. 7. Return the order code
and tracking capability securely.

Reject empty carts, invalid quantities, and client-supplied prices.
Support idempotency for order creation where appropriate.

## 6.5 Payment

Route: `/payment/:orderCode`; provider: Midtrans Snap. - Create payment
attempts through the backend. - Use the public Client Key in the
frontend; never expose Server Key. - Support payment methods enabled for
Mavera's Midtrans account. - Target payment expiration: 15 minutes,
subject to provider support/configuration. - Display pending, paid,
failed, and expired states. - A browser redirect/callback never
independently marks an order as paid. - Confirm payment via verified
provider notification and status inquiry where needed.

## 6.6 Payment Expiration and Retry

-   Store `expiresAt` for each attempt.
-   Do not allow payment creation for a paid or closed order.
-   Do not create concurrent uncontrolled attempts.
-   Retry only after the prior attempt is terminal and provider state
    has been reconciled.
-   Expired or failed payment does not permit preparation.
-   Local time passing does not by itself prove that the provider
    transaction has expired.

## 6.7 Order Tracking

Route: `/orders/:orderCode` - Require order-scoped tracking capability
in addition to order code. - Show order code, items, order type,
fulfillment status, payment status, and relevant timestamps. - Poll
approximately every 10--15 seconds while active. - Stop/reduce polling
after completion. - Do not expose unnecessary personal data or internal
fields. - Do not log raw tracking tokens.

## 6.8 Ready and Completed

-   `READY` is shown only after an authorized operator changes the
    status.
-   `COMPLETED` is shown only after an authorized operator confirms
    completion.
-   Do not automatically transition real orders based on elapsed time.
-   Push notifications and WhatsApp notifications are out of scope.

------------------------------------------------------------------------

# 7. State Machines

## 7.1 Order Fulfillment

`PENDING_PAYMENT → RECEIVED → PREPARING → READY → COMPLETED`

`CANCELLED` is a separate terminal state with explicit transition rules.

Rules: - Only confirmed paid orders may enter `RECEIVED`. - Only
authorized internal operators may advance fulfillment status. - Enforce
valid transitions on the backend; reject skipped/invalid transitions. -
Customers cannot change status. - Do not automatically mark an order
complete. - No customer-facing post-payment cancellation or refund
workflow in the MVP.

## 7.2 Payment

Normalized statuses: `PENDING`, `PAID`, `FAILED`, `EXPIRED`,
`CANCELLED`.

Rules: - Map provider-specific statuses and fraud outcomes to normalized
statuses. - Verify notification signature, gateway order ID, and
amount. - Process notifications idempotently. - Reconcile
ambiguous/out-of-order notifications. - A stale failure notification
must not overwrite a confirmed successful payment. - Update
payment/order state transactionally.

------------------------------------------------------------------------

# 8. REST API

Base path: `/api/v1`. Use a consistent JSON success/error response
structure. Production errors must not expose stack traces, secrets, or
internal database details.

## 8.1 Public menu

`GET /menus` - Returns available, non-deleted menu items. - Optional
query parameters: `search`, `category`. - Return public fields only.

## 8.2 Orders

`POST /orders` - Creates a guest order from customer details, order
type, optional table number, and menu IDs/quantities/options. - Backend
calculates all prices. - Returns HTTP 201, order code, order
summary/payment status, and a secure tracking capability.

`GET /orders/:orderCode` - Requires valid tracking capability. - Returns
only the customer's order tracking information.

`POST /orders/:orderCode/payment` - Requires order-scoped access. -
Verifies order eligibility and persisted total. - Reuses an eligible
pending attempt or creates a new unique attempt. - Prevents payment
attempts for paid/closed orders. - Returns Snap token and expiration.

## 8.3 Midtrans notification

`POST /payments/notification` 1. Validate payload. 2. Verify the
documented Midtrans signature. 3. Find the attempt by gateway order ID.
4. Verify amount and relevant transaction/fraud status. 5. Map provider
status to application status. 6. Update payment/order records
transactionally. 7. Log status changes and handle duplicates
idempotently. 8. Reject invalid signatures and never mark
unknown/mismatched transactions paid.

Implement Midtrans's documented signature formula and status rules; do
not assume all `capture` notifications are final without considering
fraud status.

## 8.4 Phase 1 internal status endpoint

`PATCH /internal/orders/:id/status` - Authenticated internal operator
required. - Validate permitted state transition. - Require payment
confirmation before fulfillment. - Update order and insert status log
transactionally. - Record actor and timestamp. - No public
unauthenticated status-update route. - The UI may be a minimal internal
page; it is not a full Admin dashboard.

## 8.5 Phase 2 APIs

Authentication: - `POST /auth/login` - `GET /auth/me` -
`POST /auth/logout` if required by the chosen session/token design.

Menu management: - `GET /admin/menus` - `POST /admin/menus` -
`PUT /admin/menus/:id` - `PATCH /admin/menus/:id/availability` -
`DELETE /admin/menus/:id`

Order management: - `GET /admin/orders` - `GET /admin/orders/:id` -
`PATCH /admin/orders/:id/status` - `GET /admin/orders/history`

Owner reports: - `GET /owner/reports/summary` -
`GET /owner/reports/transactions`

Enforce role authorization on every protected endpoint.

------------------------------------------------------------------------

# 9. Frontend Routes

## Phase 1

-   `/` --- menu catalog/search.
-   `/checkout` --- cart and guest checkout.
-   `/payment/:orderCode` --- Midtrans Snap payment.
-   `/orders/:orderCode` --- tracking and progress.

Provide loading, empty, unavailable-item, validation, payment-pending,
payment-failure/expiry, ready, completed, and invalid-tracking states.
Use mobile-first responsive design.

## Phase 2

-   `/admin/login`
-   `/admin/orders`
-   `/admin/menus`
-   `/admin/history`
-   `/owner/reports`

The Phase 1 operator mechanism is restricted and minimal; it does not
replace the full Phase 2 dashboard.

------------------------------------------------------------------------

# 10. Security Requirements

1.  Validate all inputs.
2.  Use Prisma safely; avoid unsafe raw SQL.
3.  Enforce authorization on the backend.
4.  Never trust client-supplied prices, totals, payment statuses, or
    roles.
5.  Keep JWT and Midtrans Server Keys server-side.
6.  Hash passwords and provision credentials securely.
7.  Rate-limit sensitive endpoints.
8.  Restrict CORS to approved frontend origins.
9.  Use HTTPS in production.
10. Protect tracking capabilities from logs and third-party leakage.
11. Return only necessary fields from public APIs.
12. Verify Midtrans notifications and amounts.
13. Handle duplicate and out-of-order notifications.
14. Commit lockfiles; never commit `.env` or production credentials.
15. Use structured logs without secrets.
16. Use database transactions when multiple records must remain
    consistent.
17. Apply request-size limits and secure HTTP headers.
18. Test unauthorized status updates, cross-order tracking access, price
    tampering, invalid signatures, and duplicate notifications.

------------------------------------------------------------------------

# 11. Environment Variables

## Backend `.env.example`

``` env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
JWT_SECRET=REPLACE_WITH_SECURE_RANDOM_SECRET
FRONTEND_URL=http://localhost:5173
MIDTRANS_SERVER_KEY=REPLACE_WITH_SANDBOX_SERVER_KEY
MIDTRANS_CLIENT_KEY=REPLACE_WITH_SANDBOX_CLIENT_KEY
MIDTRANS_IS_PRODUCTION=false
```

## Frontend `.env.example`

``` env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_MIDTRANS_CLIENT_KEY=REPLACE_WITH_SANDBOX_CLIENT_KEY
```

`VITE_` variables are public in browser bundles. Never put server
secrets there. Validate required environment variables at startup. Use
separate development, test, and production configuration.

------------------------------------------------------------------------

# 12. Deployment

## Vercel

-   Deploy `/client`.
-   Configure production API base URL and public Midtrans Client Key.
-   Ensure client-side routes work after refresh.
-   Separate preview and production environment variables.

## Render

-   Deploy the Express backend from `/server` or via monorepo-aware
    configuration.
-   Configure secrets through Render.
-   Add health checks and structured logs.
-   Run migrations through a controlled release process.
-   Do not run destructive seeds on production startup.

## Render PostgreSQL

-   Use a compatible PostgreSQL database.
-   Separate development/test/production databases.
-   Configure connection and SSL settings appropriately.
-   Plan backups and recovery.
-   Never expose database credentials to the frontend.

Before release, verify CORS, HTTPS, webhook reachability, sandbox
payment flow, migrations, tracking authorization, operator status
updates, and backup/recovery. Do not assume hosting pricing/free-tier
limits will remain unchanged.

------------------------------------------------------------------------

# 13. Testing and QA

## Unit tests

-   Totals and monetary calculations.
-   Quantity, table-number, and spice-level validation.
-   Menu availability.
-   Order state transitions.
-   Payment status mapping and expiry eligibility.
-   Webhook signature verification.

## Integration tests

-   Menu retrieval.
-   Order creation/persistence.
-   Price-tampering and empty-cart rejection.
-   Payment-attempt creation and retry.
-   Duplicate/invalid webhook handling.
-   Payment/order state consistency.
-   Tracking authorization.
-   Internal status-update authorization.

## End-to-end tests

1.  Dine-in: browse → search → select → cart → choose table 1--10 →
    checkout → sandbox payment → received → preparing → ready →
    completed.
2.  Takeaway: browse → select → checkout → sandbox payment → tracking →
    completed.
3.  Failed/expired payment: order remains unpaid; preparation is
    blocked; retry is permitted only after reconciliation.
4.  Security: unauthorized status update, invalid tracking capability,
    price tampering, invalid webhook, and duplicate webhook.

## Definition of Done

-   Acceptance criteria pass.
-   Relevant tests are executed and results reported.
-   Build/lint pass where configured.
-   Error handling and validation are present.
-   Documentation is updated.
-   No unresolved critical security defect remains.
-   The agent does not claim unexecuted tests or deployments succeeded.

------------------------------------------------------------------------

# 14. Assumptions and Owner Validation

  ------------------------------------------------------------------------
  ID                      Assumption              Default
  ----------------------- ----------------------- ------------------------
  A-01                    Table numbers           Exactly 1--10 for
                                                  dine-in; validate
                                                  server-side.

  A-02                    Spice level             Integer scale 0--5,
                                                  where applicable. Owner
                                                  should confirm the
                                                  meaning of each level.

  A-03                    Payment expiration      15 minutes, subject to
                                                  Midtrans
                                                  support/configuration.

  A-04                    Stock                   Availability toggle
                                                  only; no quantity-based
                                                  stock.

  A-05                    Fulfillment             Only verified paid
                                                  orders enter
                                                  preparation.

  A-06                    Status updates          Authenticated internal
                                                  operator in Phase 1;
                                                  full Admin dashboard in
                                                  Phase 2.

  A-07                    Notifications           In-app tracking only.

  A-08                    Cancellation/refund     No in-app post-payment
                                                  cancellation/refund
                                                  workflow; owner handles
                                                  exceptional cases
                                                  manually.

  A-09                    Payment methods         Methods enabled for
                                                  Mavera's Midtrans
                                                  account.

  A-10                    Tracking                High-entropy
                                                  order-scoped tracking
                                                  capability in addition
                                                  to order code.
  ------------------------------------------------------------------------

Owner should confirm table availability, spice-level labels, who
operates the Phase 1 status workflow, and how exceptional
paid-but-unfulfillable orders are handled. These assumptions must not be
presented as verified existing business policies.

------------------------------------------------------------------------

# 15. Coding Agent Instructions

Treat this PRD as the product baseline.

1.  Read `PRD.md` and `AGENTS.md` before implementation.
2.  Start with a specification audit and planning; do not build the
    entire app in one step.
3.  Maintain `TECHNICAL_DECISIONS.md`, `IMPLEMENTATION_PLAN.md`, and
    `API.md`.
4.  Do not silently invent business requirements or change the scope.
5.  Use Prisma migrations.
6.  Implement and test backend rules before relying on the frontend.
7.  Report actual changed files, commands, test results, and unresolved
    issues.
8.  Do not deploy to production or modify production data without
    explicit authorization.

**First task:** audit this PRD, create/update the technical decisions,
implementation plan, API contract, and test strategy. Do not implement
application features until the plan is reviewed.

**Phase 1 exit criteria:** complete real customer journey from menu
discovery to completion; verified payment reconciliation; protected
tracking; authenticated operational status updates; and passing relevant
tests.

**Phase 2 exit criteria:** tested Admin/Owner dashboards, role
permissions, menu/order management, history, and owner reports.

**End of PRD**

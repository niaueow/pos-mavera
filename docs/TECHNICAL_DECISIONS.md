# Technical Decisions --- POS Mavera

**Status:** Approved baseline\
**Related document:** `docs/PRD.md`\
**Purpose:** Record binding technical decisions so coding agents
implement the system consistently. Product requirements are defined in
the PRD; unresolved business assumptions remain subject to owner
validation.

------------------------------------------------------------------------

## 1. Architecture

**Decision** - Use a monorepo with `/client` and `/server`. - Frontend:
React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, and
a centralized HTTP client. - Backend: Node.js, TypeScript, Express.js,
and REST APIs. - Database access: Prisma ORM only. - Database:
PostgreSQL. - Deployment: frontend on Vercel; backend and PostgreSQL on
Render.

**Rationale** This keeps frontend and backend concerns separate while
allowing shared planning and version control. PostgreSQL with a managed
Render database reduces the operational work of self-hosting MySQL on
Render.

**Constraints** - The browser must never connect directly to the
database. - Do not add another ORM or switch databases without
documenting the reason and obtaining approval. - Use stable, mutually
compatible dependency versions and commit lockfiles.

## 2. Monorepo and Package Boundaries

-   `/client` owns UI, routing, browser state, and API calls.
-   `/server` owns validation, authorization, business rules,
    persistence, payment integration, and API responses.
-   Controllers should remain thin; business logic belongs in service
    modules.
-   Payment-provider code must be isolated behind a payment service.
-   Shared contracts may be placed in a shared package only if this is
    justified and does not couple frontend code to server internals.

## 3. API Conventions

-   Base path: `/api/v1`.
-   Use JSON for request and response bodies.
-   Use a consistent success/error envelope.
-   Validate all external inputs on the server.
-   Return appropriate HTTP status codes.
-   Do not return stack traces, SQL details, secrets, or unnecessary
    personal information.
-   Public endpoints expose only fields required by the customer UI.
-   Document endpoint schemas and authorization in `docs/API.md`.

## 4. Database and Prisma

-   Use PostgreSQL and Prisma ORM.
-   Manage schema changes with version-controlled Prisma migrations.
-   Use `Decimal`/`NUMERIC` for money; never use JavaScript
    floating-point values as the authoritative money representation.
-   Use database transactions when order creation, payment updates, or
    status updates affect multiple rows.
-   Preserve order/payment/audit history. Menu deletion should be soft
    deletion.
-   Use unique constraints for order codes and gateway order IDs.
-   Keep development, test, and production databases separate.
-   Production deployment must apply migrations through a controlled
    release process; do not run destructive seeds on startup.

## 5. Order and Payment Models

-   Keep fulfillment status separate from payment status.
-   One order may have multiple `PaymentAttempt` records.
-   Every payment attempt has a unique gateway order ID.
-   Do not create a second active payment attempt while an earlier
    attempt is unresolved.
-   Retry only after the previous attempt is terminal and gateway state
    has been reconciled.
-   A confirmed successful payment prevents further payment attempts for
    that order.
-   Do not accept prices, subtotals, totals, payment status, or role
    claims from the browser as authoritative.
-   Backend recalculates all item and order totals using current
    database prices at order creation.
-   Order items retain snapshots of menu names and unit prices.

## 6. Order Status State Machine

Allowed normal flow:

`PENDING_PAYMENT → RECEIVED → PREPARING → READY → COMPLETED`

`CANCELLED` is a separate terminal state, with narrowly defined
permitted transitions.

Rules: - A verified successful payment is required before `RECEIVED`. -
Fulfillment transitions must be validated in a backend service. - Only
an authenticated internal operator/admin can advance fulfillment
status. - Customer-facing APIs cannot mutate order status. - Every
transition writes an audit log with previous status, new status, actor,
and timestamp in the same database transaction. - Real order statuses
must never advance merely because a timer elapsed. - The Phase 1
operator workflow and Phase 2 Admin dashboard must reuse the same
backend status-transition service and API contract.

## 7. Phase Strategy

### Phase 1 --- Operational customer MVP

Includes menu browsing/search, item selection, cart, guest checkout,
Midtrans payment, protected order tracking, and a minimal authenticated
internal status-update workflow.

Phase 1 is for real orders. It is not a simulated demo. There is no full
Admin dashboard, menu CRUD interface, or Owner reporting in this phase.

### Phase 2 --- Admin and Owner

Adds the full login/dashboard, menu management, active order board,
order history, and Owner reports. Reuse Phase 1 domain services and APIs
rather than duplicating business rules.

## 8. Guest Tracking Security

-   Order code is an identifier, not an authorization secret.
-   Issue a high-entropy, unguessable, order-scoped tracking token.
-   Store only a cryptographic hash of the tracking token.
-   Deliver the token securely and avoid exposing it in logs, analytics,
    referrers, or third-party requests.
-   Tracking APIs must return only necessary order data.
-   Requests without valid order-scoped access must not reveal whether
    another customer's order exists.

## 9. Internal Authentication

-   Phase 1 status updates require an authenticated internal operator
    identity or an equivalently secure provisioned credential.
-   Never expose a public unauthenticated status-update endpoint.
-   Phase 2 uses role-based access control for `ADMIN` and `OWNER`.
-   No public admin registration.
-   Passwords must be securely hashed; secrets must be generated and
    stored outside source control.
-   Use rate limiting for login and other sensitive endpoints.
-   JWT/session handling must follow a documented, secure design; do not
    put server secrets in frontend environment variables.

## 10. Midtrans Integration

-   Use Midtrans Snap.
-   The Client Key may be exposed to frontend code; the Server Key must
    remain server-side.
-   Create payment attempts on the backend using persisted order
    amounts.
-   Verify notification signatures using Midtrans's documented
    algorithm.
-   Match the gateway order ID and amount to the stored attempt.
-   Map provider transaction and fraud statuses to normalized internal
    statuses.
-   Do not treat browser redirects or callbacks as proof of payment.
-   Handle duplicate, delayed, and out-of-order notifications
    idempotently.
-   Reconcile ambiguous results before retrying.
-   Do not let a stale failure notification overwrite a confirmed
    successful payment.
-   Payment expiration target is 15 minutes, subject to supported
    provider configuration.
-   No in-app refund workflow in Phase 1 or Phase 2. The owner handles
    exceptional refunds manually. Unexpected refund-related gateway
    events must still be safely logged and reconciled; they must not be
    silently ignored or cause incorrect state transitions.

## 11. Business Validation

-   Dine-in table numbers are integers 1--10 and are validated
    server-side.
-   Takeaway orders do not require a table number.
-   Spice level is an integer from 0--5 where applicable and is
    validated server-side.
-   The owner should confirm the human-readable meaning of each spice
    level.
-   Menu availability is boolean only; no quantity-based inventory is
    included.
-   Payment methods are those enabled on Mavera's Midtrans merchant
    account.
-   No customer-facing post-payment cancellation.
-   No automatic production order status progression.

## 12. Polling and UI State

-   Customer order tracking polls the backend approximately every 10--15
    seconds while the order is active.
-   Polling reads current state; it must not change state.
-   Reduce/stop frequent polling when the order is completed.
-   TanStack Query should manage server-state caching and polling where
    appropriate.
-   UI must distinguish payment status from fulfillment status.
-   Provide loading, empty, error, unavailable, pending payment,
    failed/expired payment, ready, completed, and invalid tracking
    states.

## 13. Testing Requirements

Required layers: - Unit tests for totals, validation, status
transitions, payment mapping, and expiry/retry eligibility. - API
integration tests for order creation, payment attempts, webhook
processing, tracking access, and status-update authorization. -
Playwright end-to-end tests for dine-in, takeaway, payment
success/failure, and order completion. - Security tests for price
tampering, unauthorized status updates, tracking access control, invalid
webhook signatures, and duplicate notifications.

A test must not be reported as passed unless it was actually executed.
Keep test data and databases isolated from production.

## 14. Secrets and Environment Configuration

-   Keep real `.env` files out of version control.
-   Commit `.env.example` with placeholders only.
-   Vite `VITE_` variables are public; only public keys/configuration
    belong there.
-   Store database credentials, JWT secrets, and Midtrans Server Key in
    backend/hosting secrets.
-   Validate required environment variables at startup.
-   Separate sandbox and production credentials.

## 15. Deployment

-   Vercel hosts the frontend.
-   Render hosts the Express backend and PostgreSQL database.
-   Configure explicit production CORS origins and HTTPS.
-   Configure Midtrans notification URL to the deployed backend.
-   Use health checks and structured logs.
-   Apply migrations deliberately; avoid destructive seed commands in
    production.
-   Verify backups and recovery approach.
-   Confirm current hosting plan limits and pricing at deployment time;
    do not assume free-tier availability.

## 16. Coding Agent Working Protocol

Before coding: 1. Read `PRD.md`, this document, and `AGENTS.md`. 2.
Audit contradictions and list unresolved assumptions. 3. Produce
`IMPLEMENTATION_PLAN.md` and `API.md`. 4. Propose schema and migration
plan. 5. Wait for approval if a change affects scope, security,
architecture, or business behavior.

During coding: - Implement one phase/task at a time. - Follow the state
machines and authorization rules. - Avoid unnecessary dependencies and
unapproved architecture changes. - Add tests with each feature.

After coding: - Report changed files, commands run, actual test/build
results, and known limitations. - Do not claim deployment or payment
success unless verified. - Never deploy or modify production data
without explicit authorization.

------------------------------------------------------------------------

## 17. Owner Validation Still Required

-   Confirm the meaning/labels of spice levels 0--5.
-   Confirm who will operate the minimal internal status workflow during
    Phase 1.
-   Confirm operational handling when a paid order cannot be fulfilled.
-   Confirm the enabled Midtrans payment methods and actual
    payment-expiration configuration.

These are business/operational validations, not reasons to leave core
technical architecture ambiguous.

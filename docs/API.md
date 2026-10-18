# API Documentation — POS Mavera

**Status:** Draft for specification review  
**Version:** 1.0  
**Purpose:** Define the REST API contract for the POS Mavera web application.

> **Source and alignment note:** This document is based on the uploaded *Dokumentasi API Integration* and aligned with the current POS Mavera project decisions: PostgreSQL + Prisma, React + Vite frontend, Express + TypeScript backend, frontend deployment on Vercel, backend/database deployment on Render, dine-in and takeaway, table numbers 1–10, spice levels 0–5, real Midtrans payments, secure guest tracking, and a minimal authenticated internal order-status workflow in Phase 1. Where requirements remain unconfirmed, they are marked as **Open decision** rather than silently assumed.

---

## 1. Purpose and Scope

The API connects the POS Mavera frontend, backend, PostgreSQL database, and Midtrans payment gateway.

### 1.1 Phase 1 — Operational Customer MVP

- Public menu listing, details, and search.
- Guest checkout without customer account registration.
- Dine-in and takeaway orders.
- Manual table selection for dine-in; table numbers 1–10.
- Spice level selection from 0–5 where applicable.
- Server-side price calculation.
- Midtrans Snap payment creation and payment-status reconciliation.
- Secure guest order tracking.
- Minimal authenticated internal API for staff to update real order statuses.
- Order-status history.

### 1.2 Phase 2 — Admin and Owner Dashboard

- Admin authentication and dashboard.
- Menu management and availability.
- Active order management and order history.
- Owner transaction summaries and reports.
- Reuse of the same backend order-status transition rules established in Phase 1.

### 1.3 Out of Scope

- Customer accounts and account-based order history.
- Customer-facing cancellation workflow.
- In-app refund workflow.
- Multiple outlets or branches.
- Promotions, discounts, loyalty programs, and native mobile applications.

Refunds, if required for an exceptional case, are handled manually by the owner outside the application. Any payment-gateway refund event received by the backend must be logged and reconciled safely; it must not silently create an in-app refund workflow.

---

## 2. Architecture

| Component | Technology | Responsibility |
|---|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, Axios | Customer ordering UI and Phase 2 admin/owner UI |
| Backend | Node.js, Express, TypeScript | REST API, business rules, authentication, payment integration |
| ORM | Prisma | Database access, schema, and migrations |
| Database | PostgreSQL | Menu, orders, order items, payment attempts, status history, and admin/staff identities |
| Payment gateway | Midtrans Snap | Customer payment UI and payment notifications |
| Frontend hosting | Vercel | Serves the web application |
| Backend/database hosting | Render | Hosts the API and PostgreSQL database |

The frontend communicates with the backend over HTTPS using JSON. The backend is the authority for prices, payment status, order state transitions, and authorization. The browser must never connect directly to PostgreSQL or receive server secrets.

### 2.1 Base URL

Production base URL:

`https://<backend-domain>/api/v1`

Local development example:

`http://localhost:<API_PORT>/api/v1`

The final domain and API port must be defined by deployment configuration.

### 2.2 Route Groups

- `/auth/*` — authentication endpoints.
- `/menus*` — public menu endpoints.
- `/orders*` — customer order creation and tracking.
- `/payments/*` — payment-related endpoints and Midtrans webhook.
- `/internal/*` — Phase 1 authenticated staff operations.
- `/admin/*` — Phase 2 admin operations.
- `/owner/*` — Phase 2 owner reporting.

Use `/api/v1` as the version prefix for all application endpoints. The Midtrans notification endpoint is also hosted under the backend API, but its authentication is based on verified gateway notification data rather than a browser bearer token.

---

## 3. API Conventions

### 3.1 Request and Response Format

- Request and response bodies use JSON encoded as UTF-8 unless the endpoint explicitly documents otherwise.
- Requests that contain a body use `Content-Type: application/json`.
- All timestamps use ISO 8601 with timezone information, preferably UTC in storage and ISO 8601 in responses.
- Money is represented as integer Indonesian rupiah (IDR); no floating-point arithmetic is permitted for monetary calculations.
- API field names use `snake_case`.
- Enum values use the exact uppercase values defined in this document.
- Do not return secrets, password hashes, raw gateway credentials, or internal stack traces.

### 3.2 Standard Success Envelope

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {}
}
```

### 3.3 Standard Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid",
    "details": [
      {
        "field": "items",
        "message": "At least one item is required"
      }
    ]
  }
}
```

`details` may be omitted when there are no field-level details. Error messages must not disclose secrets or internal implementation details.

### 3.4 HTTP Status Codes

| Status | Meaning | Typical use |
|---|---|---|
| `200` | OK | Successful read or update |
| `201` | Created | Resource created |
| `400` | Bad Request | Malformed request |
| `401` | Unauthorized | Missing, invalid, or expired authentication |
| `403` | Forbidden | Authenticated identity lacks permission, or gateway signature is invalid |
| `404` | Not Found | Resource not found or intentionally concealed |
| `409` | Conflict | Invalid state transition, duplicate/conflicting operation, or order already paid |
| `422` | Unprocessable Entity | Input fails business validation |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |
| `502` | Bad Gateway | Gateway integration failure where a safe response cannot be produced |
| `503` | Service Unavailable | Temporary service/database unavailability |

### 3.5 Pagination

List endpoints that may return many records use:

- `page`: one-based page number, default `1`.
- `limit`: page size, with a server-enforced maximum.
- Response metadata: `page`, `limit`, `total_items`, `total_pages`.

Example:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total_items": 0,
    "total_pages": 0
  }
}
```

---

## 4. Domain Models and State

### 4.1 Order Type

| Value | Meaning |
|---|---|
| `DINE_IN` | Customer eats at the outlet |
| `TAKEAWAY` | Customer takes the order away |

For `DINE_IN`, `table_number` is required and must be an integer from `1` to `10`. For `TAKEAWAY`, `table_number` must be `null` or omitted.

### 4.2 Order Status

| Value | Meaning | Who/what may set it |
|---|---|---|
| `PENDING_PAYMENT` | Order created; payment not verified as successful | Backend on order creation |
| `RECEIVED` | Payment verified and order accepted | Backend after verified Midtrans notification/reconciliation |
| `PREPARING` | Staff is preparing the order | Authenticated staff/admin |
| `READY` | Order is ready for pickup/serving | Authenticated staff/admin |
| `COMPLETED` | Order has been handed over/fulfilled | Authenticated staff/admin |
| `CANCELLED` | Terminal state reserved for explicitly authorized system handling | Not available as a customer action; exact operational policy requires confirmation |

Allowed normal transitions:

`PENDING_PAYMENT → RECEIVED → PREPARING → READY → COMPLETED`

Rules:

- A customer or browser cannot set order status.
- Staff cannot move an unpaid order into fulfillment.
- Normal staff transitions advance one step at a time.
- Every transition must be validated by the backend and recorded in order-status history.
- Status must never advance automatically because a timer elapsed.
- `CANCELLED` is not exposed as a customer cancellation feature. Its permitted use and payment-expiration interaction must be confirmed before implementation.

### 4.3 Payment Status

| Value | Meaning |
|---|---|
| `PENDING` | Payment attempt created; final result not yet confirmed |
| `PAID` | Gateway result verified as successful |
| `FAILED` | Payment denied or cancelled |
| `EXPIRED` | Payment attempt expired |
| `REFUND_PENDING` | Optional internal reconciliation marker if a refund event is received; does not create a user-facing refund flow |
| `REFUNDED` | Gateway/owner reconciliation confirms a refund occurred |

The application must keep `payment_status` separate from `order_status`. A payment event must not blindly overwrite a later fulfillment status. Exact handling of late successful payments after an order has been marked expired or otherwise closed must be explicitly designed and tested.

### 4.4 Monetary Values

- Prices and totals are calculated on the backend from the current database price.
- The client must not submit an authoritative unit price, discount, or total.
- Use PostgreSQL integer or `NUMERIC` columns suitable for IDR; select one consistent representation in the Prisma schema.
- Store a snapshot of menu name and unit price on each order item so historical orders remain accurate if a menu is later edited or soft-deleted.

---

## 5. Endpoint Summary

All application endpoints below are relative to `/api/v1`.

### 5.1 Phase 1

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/menu` | Public | List available menus and support search |
| `GET` | `/menu/:menu_id` | Public | Get menu details |
| `POST` | `/orders` | Public, rate-limited | Create a guest order |
| `GET` | `/orders/:order_code` | Valid tracking token required | Read order status and safe order details |
| `POST` | `/orders/:order_code/payment-attempts` | Valid order tracking capability required | Create/reuse an eligible payment attempt |
| `GET` | `/orders/:order_code/payment-status` | Valid tracking token required | Read safe payment status |
| `POST` | `/payments/midtrans/notification` | Midtrans signature verification | Receive payment notifications |
| `POST` | `/auth/login` | Public, rate-limited | Authenticate internal staff/admin |
| `GET` | `/auth/me` | Authenticated staff/admin | Get current identity |
| `PATCH` | `/internal/orders/:order_id/status` | Authenticated and authorized staff/admin | Advance order status |

### 5.2 Phase 2

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/admin/auth/login` | Public, rate-limited | Admin login if separated from shared `/auth` flow |
| `GET` | `/admin/menus` | Admin | List all menus, including unavailable items |
| `POST` | `/admin/menus` | Admin | Create menu |
| `PATCH` | `/admin/menus/:menu_id` | Admin | Update menu fields |
| `DELETE` | `/admin/menus/:menu_id` | Admin | Soft-delete menu |
| `GET` | `/admin/orders` | Admin | List active/working orders |
| `GET` | `/admin/orders/history` | Admin | List completed order history |
| `GET` | `/admin/orders/:order_id` | Admin | Get order detail |
| `PATCH` | `/admin/orders/:order_id/status` | Admin | Update order status using the shared transition service |
| `GET` | `/owner/reports` | Owner | Read owner summaries and reports |

**Route note:** Register fixed routes such as `/admin/orders/history` before parameterized routes such as `/admin/orders/:order_id`, or use a router configuration that guarantees the fixed route is matched correctly.

The Phase 2 endpoints are documented as planned endpoints; they are not required to be implemented in Phase 1.

---

## 6. Public Menu API

### 6.1 `GET /menu`

Returns available, non-deleted menu items.

Query parameters:

| Parameter | Type | Required | Meaning |
|---|---|---|---|
| `q` | string | No | Search by menu name/description |
| `page` | integer | No | Page number if pagination is implemented |
| `limit` | integer | No | Page size if pagination is implemented |

Example response:

```json
{
  "success": true,
  "data": [
    {
      "id": "menu_123",
      "name": "Ayam Geprek",
      "description": "Ayam geprek dengan nasi",
      "price": 18000,
      "photo_url": "https://example.invalid/menu/ayam-geprek.jpg",
      "available": true
    }
  ]
}
```

The URL above is illustrative only. Real menu image URLs must come from configured storage or persisted menu data.

### 6.2 `GET /menu/:menu_id`

Returns the details of one available, non-deleted menu item.

- `200`: menu returned.
- `404`: menu does not exist, is unavailable, or is not publicly viewable.

Example:

```json
{
  "success": true,
  "data": {
    "id": "menu_123",
    "name": "Ayam Geprek",
    "description": "Ayam geprek dengan nasi",
    "price": 18000,
    "photo_url": null,
    "available": true
  }
}
```

---

## 7. Guest Order API

### 7.1 `POST /orders`

Creates a guest order. The backend validates all menu IDs, availability, quantities, order type, table number, and spice levels, then calculates the total from database prices.

Example request:

```json
{
  "customer": {
    "name": "Budi",
    "phone_number": "081234567890"
  },
  "order_type": "DINE_IN",
  "table_number": 3,
  "items": [
    {
      "menu_id": "menu_123",
      "quantity": 2,
      "spice_level": 3,
      "notes": "Sambal dipisah"
    }
  ],
  "notes": "Pesanan untuk satu meja"
}
```

For takeaway:

```json
{
  "customer": {
    "name": "Budi",
    "phone_number": "081234567890"
  },
  "order_type": "TAKEAWAY",
  "items": [
    {
      "menu_id": "menu_123",
      "quantity": 1,
      "spice_level": 2
    }
  ]
}
```

Validation rules:

- `customer.name` is required if customer details are part of the approved checkout flow.
- `customer.phone_number` is required only if confirmed as a business requirement.
- `order_type` must be `DINE_IN` or `TAKEAWAY`.
- For `DINE_IN`, `table_number` must be an integer from `1` through `10`.
- For `TAKEAWAY`, `table_number` must be omitted or `null`.
- `items` must contain at least one item.
- Each `quantity` must be a positive integer.
- `spice_level` must be an integer from `0` through `5` where the menu supports spice selection.
- A menu item must exist and be available at the time the order is created.
- The backend calculates all prices and totals.
- Reject invalid requests with `422 VALIDATION_ERROR`.
- Use an idempotency mechanism to avoid duplicate orders if the client retries after a timeout. The chosen mechanism (for example, an `Idempotency-Key` header) must be finalized before implementation.

Example response (`201 Created`):

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order_id": "order_abc123",
    "order_code": "MVR-8K2P7X",
    "order_type": "DINE_IN",
    "table_number": 3,
    "items": [
      {
        "menu_id": "menu_123",
        "name": "Ayam Geprek",
        "unit_price": 18000,
        "quantity": 2,
        "spice_level": 3,
        "subtotal": 36000
      }
    ],
    "total": 36000,
    "order_status": "PENDING_PAYMENT",
    "payment_status": "PENDING",
    "tracking_token": "<issued-once-secret>"
  }
}
```

`tracking_token` is a high-entropy secret capability for accessing this order. Return it only when creating the order or through another explicitly approved secure delivery method. Store only a cryptographic hash of the token. Never log it, put it in analytics URLs, or expose it to unrelated users. The order code is an identifier, not authorization by itself.

**Open decision:** Confirm whether name and phone number are required at checkout, and whether the tracking token is delivered only in the initial response or also through another channel.

### 7.2 Guest Order Tracking Authorization

The customer tracking endpoints require a tracking token in a dedicated header:

`X-Order-Tracking-Token: <tracking-token>`

Do not put the token in a query string because URLs may be captured in browser history, proxy logs, analytics, or referrer data.

The backend must:
- Verify the token against the stored token hash for the requested order.
- Return only that order's safe customer-facing data.
- Return a generic `404` or `403` for invalid access, according to the agreed anti-enumeration policy.
- Apply rate limiting.
- Never treat the order code alone as proof of authorization.

### 7.3 `GET /orders/:order_code`

Returns the current status and customer-visible order details when a valid tracking token is provided.

Example response:

```json
{
  "success": true,
  "data": {
    "order_code": "MVR-8K2P7X",
    "order_type": "DINE_IN",
    "table_number": 3,
    "order_status": "PREPARING",
    "payment_status": "PAID",
    "items": [
      {
        "name": "Ayam Geprek",
        "quantity": 2,
        "spice_level": 3,
        "unit_price": 18000,
        "subtotal": 36000
      }
    ],
    "total": 36000,
    "status_history": [
      {
        "status": "RECEIVED",
        "changed_at": "2026-10-18T05:00:00Z"
      },
      {
        "status": "PREPARING",
        "changed_at": "2026-10-18T05:03:00Z"
      }
    ]
  }
}
```

Customer tracking may poll every 10–15 seconds. Polling reads status only; it must never advance or mutate order status.

### 7.4 `GET /orders/:order_code/payment-status`

Requires the same tracking token. Returns only safe status fields.

Example:

```json
{
  "success": true,
  "data": {
    "order_code": "MVR-8K2P7X",
    "payment_status": "PENDING",
    "order_status": "PENDING_PAYMENT"
  }
}
```

This endpoint is informational. The browser response or a redirect from Midtrans is not authoritative proof of payment. The backend must use verified gateway notification data and, where required, server-side reconciliation.

---

## 8. Payment API — Midtrans Snap

### 8.1 `POST /orders/:order_code/payment-attempts`

Creates a Midtrans Snap transaction for an eligible unpaid order, or returns an existing valid pending attempt if safe to reuse.

Authorization: valid order tracking token via `X-Order-Tracking-Token`.

Rules:

- The order must exist and be eligible for payment.
- The backend retrieves the amount and items from the database.
- The backend generates a unique `gateway_order_id` for every payment attempt. For example, use the order code plus a unique attempt suffix.
- The backend must prevent multiple concurrent active payment attempts for the same order unless the previous attempt is conclusively failed or expired.
- Target payment expiry is 15 minutes, subject to the capabilities/configuration of the merchant's Midtrans account.
- Never expose `MIDTRANS_SERVER_KEY` to the frontend.
- Store payment attempts separately, including unique gateway order ID, Snap token if needed, status, timestamps, and gateway references.
- Handle timeouts safely: a failed API call does not prove that Midtrans failed to create the transaction. Reconcile before creating a duplicate attempt.

Example response (`201 Created` for a newly created attempt, or `200 OK` for a safely reused attempt):

```json
{
  "success": true,
  "data": {
    "payment_attempt_id": "payment_attempt_123",
    "gateway_order_id": "MVR-8K2P7X-A1",
    "payment_status": "PENDING",
    "snap_token": "<midtrans-snap-token>",
    "redirect_url": "https://app.sandbox.midtrans.com/snap/v2/vtweb/<token>",
    "expires_at": "2026-10-18T05:15:00Z"
  }
}
```

The values above are illustrative. Use the exact response fields returned by the backend implementation.

Potential errors:

- `404 NOT_FOUND`: order not found or tracking capability invalid.
- `409 ORDER_ALREADY_PAID`: order already paid.
- `409 PAYMENT_ATTEMPT_IN_PROGRESS`: an active payment attempt already exists and cannot be safely reused.
- `422 VALIDATION_ERROR`: order is not eligible for payment.
- `502 PAYMENT_GATEWAY_ERROR`: gateway operation failed or could not be confirmed.

### 8.2 `POST /payments/midtrans/notification`

Receives server-to-server notifications from Midtrans. This endpoint is not authenticated using a user JWT. It must verify the notification according to the current official Midtrans documentation and the configured merchant environment.

Processing requirements:

1. Validate the payload and required fields.
2. Verify `signature_key` using the documented Midtrans signature-validation procedure and the configured server key.
3. Find the payment attempt by its unique `gateway_order_id`.
4. Verify the notification amount and transaction reference match the stored attempt.
5. Apply a safe, explicit mapping from Midtrans transaction status to internal payment status.
6. Process the payment attempt and related order changes transactionally.
7. Make processing idempotent so duplicate notifications cannot create duplicate transitions or status-history records.
8. Handle delayed and out-of-order notifications without regressing a final state incorrectly.
9. Do not log secrets or sensitive payment data.
10. Return an appropriate successful HTTP response after the notification is safely accepted and processed. If temporary internal failure prevents processing, use a retry-compatible failure response as appropriate.

Illustrative payload:

```json
{
  "transaction_status": "settlement",
  "order_id": "MVR-8K2P7X-A1",
  "status_code": "200",
  "gross_amount": "36000.00",
  "signature_key": "<signature>"
}
```

Do not assume the illustrative payload is a complete Midtrans schema. Verify required fields and signature rules against the current official Midtrans documentation during implementation.

### 8.3 Midtrans Status Mapping

| Midtrans result | Internal payment status | Order behavior |
|---|---|---|
| `settlement` | `PAID` | Transition `PENDING_PAYMENT` to `RECEIVED` if the payment is valid for the order |
| `capture` with accepted fraud status | `PAID` | Transition `PENDING_PAYMENT` to `RECEIVED` if valid |
| `pending` | `PENDING` | Keep order awaiting payment |
| `deny` | `FAILED` | Keep order unfulfilled; a new attempt may be allowed after safe reconciliation |
| `cancel` | `FAILED` | Keep order unfulfilled; reconcile before retry |
| `expire` | `EXPIRED` | Keep order unfulfilled; a new attempt may be allowed after safe reconciliation |
| Refund-related gateway event | Reconcile and record | Do not create an in-app refund workflow; do not silently rewrite fulfillment history |

A payment marked `PAID` must be based on a verified server-to-server notification or trusted server-side reconciliation, never on a frontend redirect alone.

### 8.4 Payment Expiry

The desired payment expiration is 15 minutes, subject to Midtrans configuration and account support. Record the actual expiry information returned or configured for the attempt.

An expiry timestamp by itself must not be treated as definitive proof that the gateway transaction expired. Reconcile the gateway state before allowing a replacement attempt when the result is uncertain.

### 8.5 Environment Variables

Backend secrets must be configured in Render environment settings (or a local ignored `.env` file for development).

| Variable | Purpose | Exposure |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Backend only |
| `DIRECT_URL` | Direct PostgreSQL connection for migration tooling if required by the chosen Render/Prisma setup | Backend/tooling only |
| `MIDTRANS_SERVER_KEY` | Server-side Midtrans API and notification validation | Backend only |
| `MIDTRANS_CLIENT_KEY` | Public key used by the client-side Snap integration where required | Public only if explicitly intended |
| `MIDTRANS_IS_PRODUCTION` | Selects sandbox or production behavior | Backend configuration |
| `JWT_SECRET` | Signs internal user access tokens | Backend only |
| `JWT_EXPIRES_IN` | Access-token lifetime | Backend configuration |
| `FRONTEND_ORIGIN` | Allowed frontend origin for CORS | Backend configuration |
| `PORT` | API listening port, if required by the hosting environment | Backend configuration |

Never prefix server secrets with `VITE_`, since Vite variables prefixed with `VITE_` are exposed to frontend code. Do not commit `.env` files or real credentials.

---

## 9. Authentication and Internal Operations

### 9.1 `POST /auth/login`

Phase 1 requires a secure, authenticated mechanism for authorized staff to update real order statuses. A complete admin dashboard is not required in Phase 1, but the API cannot be publicly writable.

Request:

```json
{
  "email": "staff@example.com",
  "password": "<password>"
}
```

Example response:

```json
{
  "success": true,
  "data": {
    "access_token": "<signed-access-token>",
    "token_type": "Bearer",
    "expires_in": 28800,
    "user": {
      "id": "user_123",
      "name": "Mavera Staff",
      "role": "STAFF"
    }
  }
}
```

Use a generic error message for invalid credentials. Apply login rate limiting. Passwords must be stored as secure password hashes, never plaintext.

### 9.2 `GET /auth/me`

Header:

`Authorization: Bearer <access-token>`

Returns the authenticated user's ID, name, and role. It must not return password hashes or secrets.

### 9.3 `PATCH /internal/orders/:order_id/status`

This endpoint is required in Phase 1. It is protected by staff/admin authentication and authorization.

Request:

```json
{
  "status": "PREPARING"
}
```

Allowed staff-driven transitions:

- `RECEIVED` → `PREPARING`
- `PREPARING` → `READY`
- `READY` → `COMPLETED`

The backend must reject:

- Updates by unauthenticated users.
- Updates by a role that is not authorized for the operation.
- Transitions that skip a stage.
- Fulfillment updates for unpaid orders.
- Transitions from terminal states.
- Duplicate requests that would produce duplicate history entries.

Successful response:

```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "order_id": "order_abc123",
    "order_status": "PREPARING",
    "updated_at": "2026-10-18T05:03:00Z"
  }
}
```

The transition logic must live in a reusable backend service. Phase 2 admin endpoints must call the same service rather than implement separate transition rules.

**Open decision:** Confirm how Phase 1 staff identities are provisioned and whether the roles are `STAFF` and `ADMIN`, or whether a single restricted staff role is sufficient.

---

## 10. Phase 2 — Admin and Owner Endpoints

These endpoints are planned for Phase 2 and are not blockers for the Phase 1 customer MVP except where shared backend services are required.

### 10.1 Menu Management

#### `GET /admin/menus`

Returns all menus, including unavailable items. Requires admin authorization.

#### `POST /admin/menus`

Example request:

```json
{
  "name": "Ayam Geprek",
  "description": "Ayam geprek dengan nasi",
  "price": 18000,
  "photo_url": null,
  "available": true
}
```

The backend validates the name, price, and availability. Price must be a valid non-negative or positive integer according to the approved pricing rule.

#### `PATCH /admin/menus/:menu_id`

Updates only the provided fields. Validate every field and reject unknown or invalid fields.

#### `DELETE /admin/menus/:menu_id`

Performs a soft delete. Historical order-item snapshots must remain readable. If a menu is referenced by historical orders, do not physically delete the historical record.

### 10.2 Order Management

#### `GET /admin/orders`

Optional query parameters:

- `status`
- `from`
- `to`
- `page`
- `limit`

By default, return paid orders that have not reached `COMPLETED`, subject to the final agreed operational filter.

#### `GET /admin/orders/history`

Returns completed order history. Optional query parameters: `from`, `to`, `page`, and `limit`.

#### `GET /admin/orders/:order_id`

Returns an authorized internal view of the order, including customer details, item snapshots, payment attempts, and status history.

#### `PATCH /admin/orders/:order_id/status`

Uses the same validation and transition service as `PATCH /internal/orders/:order_id/status`. Do not duplicate state-transition logic.

### 10.3 Owner Reports

#### `GET /owner/reports`

This is a planned Phase 2 endpoint. Query parameters and metrics must be finalized with the owner before implementation. Do not invent financial KPIs or report definitions without confirmation.

---

## 11. Data Integrity and Persistence Requirements

The exact schema is defined in the Prisma schema and database design, but the API requires the following concepts:

- Menu.
- Order.
- Order item with historical name and price snapshot.
- Customer/guest details if confirmed as required by checkout.
- Payment attempt, with a unique gateway order ID.
- Internal user/staff identity.
- Order status history.
- Secure order tracking token hash or equivalent secure capability record.
- Idempotency record for order creation/payment creation where selected.

Required integrity properties:

- Unique order code.
- Unique gateway order ID for every payment attempt.
- Valid foreign-key relationships.
- Database transaction around payment-state updates and corresponding order-status/history changes.
- Concurrency control so two simultaneous requests cannot create conflicting payment attempts or advance the same order twice.
- Status-history records identify the actor or system event responsible for each change.
- Soft deletion or equivalent preservation of menu records referenced by historical orders.

---

## 12. Error Codes

| Error code | HTTP status | Meaning |
|---|---:|---|
| `VALIDATION_ERROR` | 422 | Request fields fail validation |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication/tracking capability |
| `FORBIDDEN` | 403 | Identity lacks permission or Midtrans signature is invalid |
| `NOT_FOUND` | 404 | Resource not found or access intentionally concealed |
| `INVALID_STATUS_TRANSITION` | 409 | Requested order transition is not allowed |
| `ORDER_ALREADY_PAID` | 409 | A new payment attempt is not allowed because payment is confirmed |
| `PAYMENT_ATTEMPT_IN_PROGRESS` | 409 | An unresolved payment attempt already exists |
| `IDEMPOTENCY_CONFLICT` | 409 | An idempotency key was reused with a different request |
| `PAYMENT_GATEWAY_ERROR` | 502 | Gateway request failed or could not be confirmed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected internal error |

---

## 13. Security Requirements

- Require HTTPS in deployed environments.
- Validate all input on the backend.
- Calculate totals and verify menu availability on the server.
- Use Prisma's parameterized query behavior; do not construct unsafe raw SQL from user input.
- Configure CORS to allow only approved frontend origins.
- Keep all server secrets in backend environment configuration.
- Rate-limit login, order creation, tracking, and payment-attempt endpoints.
- Do not expose internal stack traces or database details in API responses.
- Validate Midtrans notification signatures and reconcile payment amounts and gateway order IDs.
- Make webhook processing idempotent and safe under concurrency.
- Use a high-entropy tracking token; store its hash, avoid logging it, and never authorize tracking based on the order code alone.
- Protect internal status endpoints with authentication and authorization.
- Do not trust frontend payment status, order totals, or requested status transitions.
- Avoid logging customer phone numbers, tracking tokens, access tokens, or payment secrets unless there is an explicitly approved, privacy-conscious operational need.

---

## 14. API Integration Test Plan

| ID | Scenario | Endpoint | Expected result |
|---|---|---|---|
| API-01 | Fetch public menu | `GET /menu` | `200`; only available, non-deleted menus |
| API-02 | Fetch menu details | `GET /menu/:menu_id` | `200` for available menu |
| API-03 | Create valid dine-in order | `POST /orders` | `201`; valid table number and server-calculated total |
| API-04 | Create valid takeaway order | `POST /orders` | `201`; no table number |
| API-05 | Submit table number outside 1–10 | `POST /orders` | `422`; no order created |
| API-06 | Submit spice level outside 1–5 | `POST /orders` | `422`; no order created |
| API-07 | Submit quantity zero or unavailable menu | `POST /orders` | `422`; no order created |
| API-08 | Manipulate price/total in client request | `POST /orders` | Client-supplied price ignored or rejected; server total is authoritative |
| API-09 | Retry order creation with same idempotency key | `POST /orders` | No duplicate order |
| API-10 | Create payment attempt for eligible order | `POST /orders/:order_code/payment-attempts` | Valid Snap token/URL and unique gateway order ID |
| API-11 | Create concurrent payment attempts | Payment-attempt endpoint | No conflicting active attempts |
| API-12 | Verified successful Midtrans notification | `POST /payments/midtrans/notification` | Payment `PAID`; order transitions to `RECEIVED` once |
| API-13 | Invalid Midtrans signature | Webhook endpoint | `403`; no state mutation |
| API-14 | Duplicate Midtrans notification | Webhook endpoint | Idempotent; no duplicate history entry |
| API-15 | Notification amount/order ID mismatch | Webhook endpoint | Rejected or quarantined safely; no fulfillment authorization |
| API-16 | Track order with valid token | `GET /orders/:order_code` | `200`; only customer-safe data |
| API-17 | Track order with order code only | `GET /orders/:order_code` | Access denied; no order disclosure |
| API-18 | Update status without authentication | Internal status endpoint | `401` |
| API-19 | Skip a status transition | Internal status endpoint | `409`; state unchanged |
| API-20 | Update an unpaid order to `PREPARING` | Internal status endpoint | `409`; state unchanged |
| API-21 | Valid staff transition | Internal status endpoint | `200`; history recorded once |
| API-22 | Repeated status update request | Internal status endpoint | No duplicate transition/history |
| API-23 | Login with invalid credentials | `POST /auth/login` | `401`; generic error |
| API-24 | Menu soft deletion | Phase 2 delete endpoint | Menu no longer available publicly; historical order remains intact |

Tests involving Midtrans must use sandbox credentials and a controlled test environment. Do not claim a live payment or webhook test passed unless it was actually executed.

---

## 15. Open Decisions Before Implementation

The following points must be checked against `PRD.md`, `TECHNICAL_DECISIONS.md`, owner decisions, and the implementation plan:

1. **Customer fields:** Confirm whether customer name and phone number are required.
2. **Tracking-token delivery:** Confirm whether the token is returned only in the initial order-creation response or also delivered through another approved channel.
3. **Internal identity provisioning:** Decide how Phase 1 staff credentials are created and managed.
4. **Roles:** Confirm whether Phase 1 needs a `STAFF` role, an `ADMIN` role, or both.
5. **Payment expiration:** Confirm the exact implementation supported by the configured Midtrans merchant account; 15 minutes is the target.
6. **Late successful payment:** Define the recovery procedure if a payment succeeds after the application believes the attempt has expired.
7. **Payment-attempt retry policy:** Define when an existing attempt may be reused versus when a new attempt may be created.
8. **Order cancellation state:** Confirm whether `CANCELLED` is needed internally and which system/operator actions may set it. It must not imply a customer cancellation feature.
9. **Owner reports:** Define report metrics and filters before Phase 2 implementation.
10. **Idempotency mechanism:** Finalize the header/storage design for order and payment-attempt creation.
11. **Route naming:** This document uses singular `/menu`; if the repository or agreed API convention uses plural `/menus`, settle on one convention before implementation and apply it consistently.
12. **Database monetary type:** Confirm one consistent PostgreSQL/Prisma representation for IDR amounts.

---

## 16. Definition of Done for the API Contract

The API contract is ready for implementation when:

- Every Phase 1 customer journey has an endpoint or is explicitly frontend-only.
- Request/response shapes, validation rules, and error behavior are defined.
- Order and payment statuses are separate and transition rules are explicit.
- Tracking access does not rely on the order code alone.
- Staff order-status updates are authenticated and authorized.
- Payment-attempt creation and webhook handling specify idempotency and concurrency requirements.
- Midtrans integration is designed around verified server-side results.
- Phase 2 endpoints are clearly marked as future scope.
- Open decisions that block safe implementation have been resolved or explicitly approved as assumptions.
- The contract has been reviewed against the PRD, technical decisions, and implementation plan.

---

## 17. References

- `docs/PRD.md`
- `docs/TECHNICAL_DECISIONS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- Official Midtrans Snap and payment-notification documentation, to be checked against the current version during implementation.

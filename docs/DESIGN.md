# POS Mavera --- Design System & UI/UX Specification

**Status:** Implementation guide for Phase 1 and Phase 2\
**Design direction:** Warm, confident, food-first, practical,
mobile-first\
**Brand colors provided:** `#E8BA00` (primary), `#FFF8DB` (subtle)\
**Typography preference:** "Jakarta Plus", interpreted here as **Plus
Jakarta Sans**; verify the exact font asset/package before
implementation.\
**Default radius:** `12px`\
**Theme:** Light mode only

> `PRD.md` remains the source of truth for product scope and behavior.
> `docs/API.md` defines API contracts. `TECHNICAL_DECISIONS.md` and
> `IMPLEMENTATION_PLAN.md` define technical constraints. If this
> document conflicts with an approved product, API, or security
> requirement, follow the approved requirement and update this document.

------------------------------------------------------------------------

## 1. Design principles

1.  **Food comes first.** Make menu names, prices, available food
    photography, spice choices, and add-to-cart actions easy to scan.
2.  **Fast ordering.** Minimize steps and unnecessary decisions between
    browsing and checkout.
3.  **Trustworthy payment and status.** Payment status and fulfillment
    status are separate. Never show payment success until the backend
    reports a verified/reconciled state.
4.  **Mobile-first, desktop-capable.** Customer flows must work on
    narrow mobile screens; staff/admin screens should work well on
    tablet and desktop.
5.  **Consistent operations.** Tracking, staff, and admin screens use
    the same order labels and backend-defined transitions.
6.  **Accessible by default.** Use semantic controls, visible focus,
    readable contrast, persistent labels, and actionable error messages.
7.  **No invented brand assets.** Do not invent an official logo,
    mascot, tagline, menu photography, or other brand assets. If no logo
    is supplied, use a text-only "Mavera" wordmark as a temporary
    placeholder.

## 2. Visual direction

Use a warm, appetizing visual language around Mavera's supplied yellow.
It should feel energetic and approachable without looking childish or
overly decorative.

-   Primary brand: `#E8BA00`
-   Subtle brand surface: `#FFF8DB`
-   Primary text: charcoal `#242424`
-   Default page background: white `#FFFFFF`
-   Default radius: `12px`
-   Typeface: Plus Jakarta Sans, with
    `ui-sans-serif, system-ui, sans-serif` fallback.
-   Light mode only for the current scope.
-   Avoid large decorative gradients, excessive shadows, too many
    rounded containers, tiny gray text, unnecessary animation, and
    generic dashboard-card grids.
-   Use dark text on the yellow brand color. Do not use white text on
    yellow for important actions unless contrast testing proves it is
    accessible.

## 3. Design tokens

Centralize tokens in CSS variables or the existing Tailwind theme. Do
not scatter raw hex values across components.

### 3.1 Color tokens

  --------------------------------------------------------------------------
  Token                      Value                   Intended use
  -------------------------- ----------------------- -----------------------
  `--color-brand`            `#E8BA00`               Primary actions,
                                                     selected indicators,
                                                     small brand accents

  `--color-brand-subtle`     `#FFF8DB`               Soft highlighted
                                                     surfaces, selected
                                                     categories, callouts

  `--color-ink`              `#242424`               Primary text and
                                                     high-emphasis icons

  `--color-text-secondary`   `#646464`               Supporting text and
                                                     metadata; verify
                                                     contrast

  `--color-page`             `#FFFFFF`               Main page background

  `--color-surface`          `#FFFFFF`               Forms, dialogs, menus

  `--color-surface-muted`    `#F7F6F2`               Secondary sections and
                                                     grouped surfaces

  `--color-border`           `#E6E3DA`               Dividers, input
                                                     borders, outlines

  `--color-success`          `#18794E`               Successful
                                                     payment/completion text
                                                     and icons

  `--color-success-subtle`   `#E8F5EC`               Successful-state
                                                     background

  `--color-warning`          `#8A5A00`               Pending or
                                                     attention-needed text
                                                     and icons

  `--color-warning-subtle`   `#FFF3D6`               Pending-state
                                                     background

  `--color-danger`           `#B42318`               Errors, failed
                                                     payments, destructive
                                                     actions

  `--color-danger-subtle`    `#FDECEA`               Error-state background

  `--color-info`             `#175CD3`               Informational text and
                                                     icons

  `--color-info-subtle`      `#EFF6FF`               Informational-state
                                                     background

  `--color-disabled`         `#B8B5AC`               Disabled control
                                                     surfaces
  --------------------------------------------------------------------------

Semantic colors are proposed design tokens, not confirmed official
Mavera brand colors. Check contrast in the implementation and adjust
when necessary.

### 3.2 Typography

  -------------------------------------------------------------------------
  Role                  Suggested size               Weight Usage
  --------------- -------------------- -------------------- ---------------
  Display / hero              32--40px             700--800 Main
                                                            menu/landing
                                                            headline; use
                                                            sparingly

  Page title                  24--32px                  700 Main page
                                                            heading

  Section heading             20--24px             600--700 Categories,
                                                            checkout
                                                            sections,
                                                            dashboard
                                                            sections

  Menu/order                  16--18px             600--700 Item and order
  title                                                     titles

  Body                        14--16px             400--500 Main content
                                                            and
                                                            instructions

  Supporting text             12--14px             400--500 Metadata; keep
                                                            legible

  Button/input                14--16px                  600 Actions and
                                                            controls

  Price                       16--20px                  700 Menu price and
                                                            order total
  -------------------------------------------------------------------------

Use a consistent heading hierarchy. Avoid long blocks in all caps. Use
tabular numerals for prices, quantities, order codes, and timestamps
where supported.

### 3.3 Spacing and shape

Use a 4px base spacing scale.

  Token          Value Typical use
  ------------ ------- ----------------------------
  `space-1`        4px Icon/text gap
  `space-2`        8px Tight internal spacing
  `space-3`       12px Compact field/list spacing
  `space-4`       16px Default component gap
  `space-5`       20px Group spacing
  `space-6`       24px Section spacing
  `space-8`       32px Large section spacing
  `space-10`      40px Page section separation
  `space-12`      48px Large layout separation

-   Default radius: `12px`.
-   Small control radius: `8px`.
-   Large dialog/sheet radius: `16px`.
-   Reserve pill shapes for compact badges, chips, and segmented
    controls.
-   Prefer alignment and spacing over nested card-on-card layouts.
-   Use subtle borders and restrained shadows.

### 3.4 Motion

-   Use short transitions (about 120--200ms) for hover, focus,
    disclosure, and small state changes.
-   Avoid animation that delays checkout or implies a payment outcome.
-   Respect `prefers-reduced-motion`.
-   Never communicate payment or order status through animation alone.

## 4. Shared component rules

### 4.1 Buttons

Provide primary, secondary, tertiary/ghost, and destructive variants.

-   **Primary:** brand yellow with dark text.
-   **Secondary:** white/muted surface, visible border, dark text.
-   **Tertiary:** transparent with clear hover/focus styling.
-   **Destructive:** danger styling and explicit wording.
-   Include hover, focus-visible, pressed, disabled, and loading states.
-   Prevent duplicate submission while a request is in progress.
-   Prefer clear labels such as "Tambah ke keranjang", "Lanjut ke
    pembayaran", and "Simpan perubahan".

### 4.2 Form controls

-   Every input has a persistent visible label; placeholder is not a
    label.
-   Show field-level validation next to the relevant field.
-   Preserve valid values after submission errors.
-   Format Indonesian phone numbers sensibly; validate them on the
    server too.
-   Show loading/disabled states while saving.
-   Associate error and helper text with their inputs.
-   Do not rely on color alone to communicate errors.

### 4.3 Cards, rows, and panels

Use cards when content needs grouping. Menu items, orders, and report
summaries can use cards or structured rows depending on screen width and
density. Do not put every section in its own bordered card.

### 4.4 Badges and status

Status labels must include text, not color alone. Use semantic tokens
consistently. The UI must display backend state and must not invent
transitions.

### 4.5 Dialogs and sheets

-   Use dialogs for focused confirmations and compact details.
-   On mobile, consider a bottom sheet for cart details or item
    customization.
-   Keep the primary action visible without excessive scrolling.
-   Closing a dialog must not silently discard important input.
-   Dialogs must support keyboard navigation and focus management.

### 4.6 Icons and imagery

-   Use one consistent icon family and stroke weight.
-   Prefer menu images supplied by Mavera. If no image is available, use
    an intentional neutral placeholder, not a broken image or invented
    product photo.
-   Provide appropriate alternative text for informative images.
-   Do not present stock imagery as actual Mavera menu items.

## 5. Responsive behavior

Mobile-first. Suggested breakpoints, unless the existing Tailwind config
defines otherwise: - Mobile: below `640px` - Tablet: `640px`--`1023px` -
Desktop: `1024px` and above

### Customer experience

-   **Mobile:** single-column content; sticky bottom cart/checkout
    action where useful; full-width primary buttons; no horizontal
    scrolling.
-   **Tablet:** two-column menu grid where appropriate; checkout may use
    a main column and compact summary.
-   **Desktop:** wider menu grid and constrained checkout layout; keep
    order summary visible when useful.
-   Ensure the mobile keyboard does not obscure checkout fields or
    payment actions.
-   Aim for interactive targets of at least 44×44 CSS pixels where
    practical.
-   Use responsive order rows/cards on mobile instead of forcing a wide
    table.

### Internal staff experience

-   Optimize for tablet and desktop at the counter/kitchen.
-   Make order status and next allowed action easy to scan.
-   Keep touch targets practical for quick use.
-   On narrow screens, prioritize essential order information and move
    secondary metadata into a detail view.

## 6. Customer-facing screens --- Phase 1

Phase 1 is an operational MVP for real orders, not a mockup. UI states
must reflect server responses and verified payment state.

### 6.1 Menu browsing

Include: - Brand/page heading and clear menu title. - Search by menu
name. - Categories and available menu items. - Item name, price, and
description/image only when data is available. - Availability state for
unavailable items. - Quantity/customization entry points. - Cart summary
and a clear way to continue.

Required states: - **Loading:** skeletons or progress indicator that
preserves layout. - **No search results:** explain no item matches and
offer clear-search action. - **Empty menu:** explain the menu is
currently unavailable; do not invent products. - **Error:** concise
explanation and retry action. - **Unavailable item:** cannot be added to
a new order.

### 6.2 Item customization

-   Show quantity controls and optional notes.
-   Show spice level 0--5 only when the item supports it
    (`hasSpiceLevel` or equivalent backend field).
-   Explain the scale in Indonesian; confirm exact wording with the
    owner. Do not invent claims about chili quantity.
-   Do not show spice selection for beverages, rice, or other items that
    do not support it.
-   Show selected options in the cart.

### 6.3 Cart

-   Show item name, selected spice level where applicable, notes,
    quantity, subtotal, and update/remove controls.
-   Allow quantity changes and item removal.
-   Show subtotal/total clearly.
-   Frontend totals are estimates for display; the server recalculates
    authoritative prices and totals at order creation.
-   Never trust client-submitted prices or totals.
-   Empty cart state should link directly back to the menu.

### 6.4 Guest checkout

Checkout does not require customer registration.

Collect: - Customer name. - Phone number. - Order type: dine-in or
takeaway. - Table number for dine-in only; valid numbers are 1--10. -
Order items, quantities, supported spice level, and optional notes.

Rules: - Hide/disable table selection for takeaway and do not submit a
table number for takeaway. - Mark required fields and show inline
validation. - Provide a final order summary before submitting. - Prevent
duplicate order creation during repeated clicks or slow requests. -
After successful order creation, preserve the order code and secure
tracking capability required for the customer journey. - Never expose
raw tracking tokens in visible UI, URLs, logs, analytics, or error
messages.

### 6.5 Payment initiation

-   Explain that the customer continues to Midtrans Snap to complete
    payment.
-   Show order code and amount before starting payment.
-   Prevent repeated payment initiation while a request is in progress.
-   The backend's verified/reconciled state is authoritative; a frontend
    callback alone cannot confirm payment.
-   If initiation fails, show a retry action where allowed and preserve
    order context.
-   Never expose the Midtrans Server Key to the client.

### 6.6 Payment result

Design explicit states: - **Pending:** payment is not yet confirmed;
explain that status may take a moment to update. - **Successful/paid:**
show success only after the backend reports verified payment. -
**Failed/denied:** explain payment did not complete and provide the
permitted next step. - **Expired:** explain the session expired and show
the supported next step based on API behavior. - **Unknown/temporarily
unavailable:** explain the result cannot currently be confirmed and
offer refresh/retry; do not falsely report success or failure.

Use status text and an icon alongside color. Do not mark an order paid
based on a timer or browser return URL.

### 6.7 Order tracking

-   Show order code, order type, item summary, payment status,
    fulfillment status, and timestamps when available.
-   Distinguish payment status from fulfillment status.
-   Use a simple progress/timeline for fulfillment, based on actual
    backend state: `RECEIVED → PREPARING → READY → COMPLETED`, while
    handling `PENDING_PAYMENT` appropriately.
-   Clearly display when an operator marks the order ready or completed.
-   Provide refresh/retry and useful error states.
-   Order code is a public identifier, not an authorization secret.
    Tracking requests must use the secure tracking capability defined in
    the API contract, including `X-Order-Tracking-Token` where
    specified.
-   Follow the agreed storage contract for the raw token: store it in
    browser `localStorage` under the specified order-specific key, send
    it only in the expected header, and never log it.
-   Do not add customer cancellation or in-app refund actions in Phase
    1.

### 6.8 Minimal internal status workflow

Phase 1 includes a restricted authenticated mechanism for an operator to
update status, but not a full Admin dashboard.

-   Require authentication and authorization.
-   Show a practical list of relevant active orders.
-   Make order code, items, order type/table, and current status easy to
    identify.
-   Present only allowed next actions according to backend transition
    rules.
-   Confirm actions when needed to avoid operational confusion.
-   Show success/error feedback and prevent duplicate submissions.
-   Never advance fulfillment status automatically based on elapsed
    time.
-   Reuse the same backend business rules that Phase 2 will use.

## 7. Internal application --- Phase 2

Phase 2 begins after Phase 1 is stable. Extend the existing workflows
rather than replacing them.

### 7.1 Authentication and roles

-   Provide login/logout for internal users.
-   Follow the agreed roles `STAFF`, `ADMIN`, and `OWNER` where
    applicable to the final authorization model.
-   Navigation and visible actions should reflect permissions, but
    frontend route guards are not a security boundary; the backend must
    enforce authorization.
-   Do not expose internal registration unless explicitly approved.
-   Never display passwords, JWT secrets, payment credentials, or
    sensitive configuration.

### 7.2 Admin/cashier workspace

Include: - Active order list and order details. - Status changes using
the same backend transition rules as Phase 1. - Menu CRUD and
availability toggle. - Completed order history and status logs.

Menu forms should use fields that exist in the data model, such as name,
description, price, category, image reference if supported,
availability, and spice-level applicability. Do not invent unsupported
fields; confirm schema and API contracts before implementation.

For destructive actions, require explicit confirmation. If an item has
order history, follow backend rules for deactivation/deletion rather
than assuming hard deletion is safe.

### 7.3 Owner workspace and reports

Include: - Concise order and transaction summaries. - Basic date-range
reports. - Empty, loading, error, and no-data states. - Clear
definitions for metrics based on available backend data.

Do not invent predictive analytics, stock management, loyalty, coupons,
delivery management, automated messaging, or other features outside the
agreed scope.

### 7.4 Dashboard layout

-   Use clear navigation with active-page indication.
-   Keep frequent operational tasks easy to reach.
-   Use a small number of meaningful summary metrics, not a wall of
    cards.
-   Use tables for dense desktop order/history data and stacked
    rows/detail screens on mobile.
-   Make filters, sorting, and pagination clear when implemented.
-   Never show fake metrics as live production data. Development
    fixtures must be clearly marked and excluded from production.

## 8. Order and payment status design

Payment state and fulfillment state are separate and must not share one
ambiguous badge.

### Payment state

Use the exact states returned/derived by the backend contract. Common
presentation categories include pending, paid/successful, failed/denied,
and expired. Unexpected refund/gateway events should be reconciled
internally; Phase 1 has no in-app refund workflow.

### Fulfillment state

The normal progression is:
`PENDING_PAYMENT → RECEIVED → PREPARING → READY → COMPLETED`

-   Display the backend's actual state.
-   Do not present transitions that the backend rejects.
-   Do not advance states automatically with a timer.
-   The backend owns payment reconciliation; delayed failure/expiry
    notifications must not visually overwrite an authoritative
    paid/advanced state.
-   Use Bahasa Indonesia labels for customers while retaining stable
    backend enum values internally.

Suggested UI labels (confirm wording with the owner): -
`PENDING_PAYMENT`: Menunggu pembayaran - `RECEIVED`: Pesanan diterima -
`PREPARING`: Sedang disiapkan - `READY`: Pesanan siap - `COMPLETED`:
Pesanan selesai

Suggested payment labels: - Pending: Menunggu pembayaran - Paid:
Pembayaran berhasil - Failed/denied: Pembayaran gagal - Expired:
Pembayaran kedaluwarsa

These are proposed labels, not changes to backend enum values.

## 9. Indonesian language and content style

Use Bahasa Indonesia by default for customer-facing UI unless the
product owner specifies otherwise.

-   Keep labels short and concrete.
-   Use consistent terms: "Keranjang", "Kode pesanan", "Status
    pembayaran", and "Status pesanan". Choose a consistent
    Indonesian/English treatment for "checkout" and apply it throughout.
-   Format prices as Indonesian Rupiah, e.g. `Rp25.000`, using
    locale-aware formatting.
-   Format dates/times consistently when timestamps are available.
-   Explain what happened and what the user can do next; never show
    stack traces or internal technical details.
-   Do not promise exact preparation time, delivery time, or service
    guarantees unless confirmed by the owner.

## 10. Accessibility checklist

-   [ ] Keyboard navigation works for all workflows.
-   [ ] Focus indicators are visible.
-   [ ] Text and controls have sufficient contrast.
-   [ ] Inputs have visible labels and associated error messages.
-   [ ] Buttons have meaningful accessible names.
-   [ ] Status is communicated by text/icon as well as color.
-   [ ] Images have appropriate alt text.
-   [ ] Touch targets are practical on mobile.
-   [ ] Loading states avoid confusing layout jumps.
-   [ ] Reduced-motion preferences are respected.
-   [ ] Dialogs manage focus and can be closed accessibly.
-   [ ] Responsive layouts do not require horizontal page scrolling.
-   [ ] Important errors and payment states are announced accessibly
    where appropriate.

## 11. Required states for data-driven screens

For every screen that loads or mutates server data, implement relevant
states: - Initial/loading. - Success/normal. - Empty/no results. -
Validation error. - Network/server error with retry where appropriate. -
Unauthorized/forbidden where applicable. - Disabled/unavailable item or
action. - In-progress submission that prevents duplicate actions.

Do not ship screens that only work with happy-path mock data.

## 12. Instructions for Codex

1.  Read `PRD.md`, `TECHNICAL_DECISIONS.md`, `docs/API.md`, and
    `IMPLEMENTATION_PLAN.md` before implementing UI.
2.  Treat this document as the design source of truth without overriding
    API contracts, server-side validation, payment reconciliation,
    authorization, or security rules.
3.  Inspect the existing repository and dependencies before adding
    packages or changing configuration.
4.  Reuse existing design tokens/components; do not create duplicate
    button/input/modal systems.
5.  Centralize colors, typography, spacing, radius, and shadows in
    theme/CSS variables.
6.  Build reusable components for buttons, inputs, status badges,
    loading, empty/error states, and confirmation dialogs.
7.  Use agreed API contracts. If an endpoint is not ready, isolate
    temporary fixtures and clearly mark them development-only; do not
    silently ship mocks to production.
8.  Keep customer and internal layouts distinct where their goals differ
    while sharing typography, colors, controls, and status components.
9.  Implement responsiveness and accessibility alongside each screen,
    not only at the end.
10. After each milestone, run available lint, typecheck,
    unit/integration tests, and relevant end-to-end tests. Report
    commands run and gaps.
11. Do not add features outside approved phases simply because they are
    common in POS software.
12. If product/API behavior is missing, document the ambiguity and ask
    or label a proposed assumption rather than inventing a definitive
    requirement.

## 13. Definition of done

A screen/component is complete when: - It follows this design system. -
It works at relevant mobile, tablet, and desktop widths. - Loading,
empty, error, and disabled states are handled where relevant. -
Validation and error recovery are understandable. - Accessibility basics
are satisfied. - It uses the API contract and does not trust
client-submitted totals or payment state. - It does not expose secrets
or tracking tokens. - It passes applicable checks/tests and manual
verification. - It introduces no out-of-scope features or fake
production data.

## 14. Decisions requiring confirmation

These are not treated as confirmed brand/product facts: - Official logo
and brand assets. - Official menu photography. - Exact wording for spice
levels 0--5. - Final Bahasa Indonesia terminology for "checkout". -
Specific dashboard filters/report metrics beyond the PRD. - Exact font
delivery method (local font files, approved package, or hosted font). -
Any official brand colors beyond `#E8BA00` and `#FFF8DB`.

Until confirmed, use proposals conservatively and do not invent official
assets or operational promises.

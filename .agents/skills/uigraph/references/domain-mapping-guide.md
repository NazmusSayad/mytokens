# Domain Mapping Guide

This guide maps common system domains to the UIGraph artifacts you should propose.

Do not generate these artifacts automatically. Use this guide to suggest artifact categories and content during the planning phase, then wait for the user to approve the final plan with `Generate Artifacts Now`.

## General Methodology

1. Identify the core entities and flows the user describes.
2. Propose database tables or collections for entities when supported by project evidence or user input.
3. Propose API endpoints or existing API specs for flows.
4. Propose architecture diagrams for important states, sequences, and backend flows.
5. Propose test cases for critical paths.
6. Propose maps, frames, and focal points for UI areas or logical groups.
7. Propose links from focal points to relevant APIs, test packs, diagrams, and docs.

## Domain: Authentication

### Database
- `users` table/collection
- `sessions` table/collection
- `refresh_tokens` table/collection

### API Endpoints (OpenAPI)
- `POST /auth/register` — `operationId: registerUser`
- `POST /auth/login` — `operationId: loginUser`
- `POST /auth/refresh` — `operationId: refreshToken`
- `POST /auth/logout` — `operationId: logoutUser`
- `POST /auth/forgot-password` — `operationId: forgotPassword`
- `POST /auth/reset-password` — `operationId: resetPassword`

### Architecture Diagram (Mermaid)
Use `stateDiagram-v2` covering:
- `Unauthenticated` → `LoginPending` → `Authenticated` → `SessionActive`
- Branches for `MFARequired`, `AccountLocked`, `TokenRefresh`

### Test Packs
- **Smoke pack**
  - API: Register returns 201
  - API: Login returns 200
  - Manual: Verify MFA flow

### Maps
- **Map**: Auth Flow
  - **Frame**: Login Page
    - Focal point: Register Button → `component_api-contract` (registerUser)
    - Focal point: Login Form → `component_test-case-suite` (Auth Smoke)
    - Focal point: Forgot Password Link → `component_api-contract` (forgotPassword)
  - **Frame**: Dashboard
    - Focal point: User Menu → `component_api-contract` (logoutUser)

## Domain: E-Commerce

### Database
- `products`, `categories`, `product_images`
- `users`, `addresses`
- `cart_items`
- `orders`, `order_items`
- `coupons`, `reviews`

### API Endpoints
- `GET /products` — list products
- `GET /products/{id}` — get product
- `POST /cart/items` — add to cart
- `POST /checkout` — place order
- `GET /orders` — list orders
- `GET /orders/{orderId}` — get order

### Architecture Diagram
Use `flowchart` or `stateDiagram-v2` covering:
- Browse → Cart → Checkout → Order Confirmation
- Payment success/failure branches

### Test Packs
- **Smoke pack**
  - API: List products returns 200
  - API: Add to cart returns 200
  - API: Checkout returns 201
- **Regression pack**
  - API: Apply coupon reduces total
  - Manual: Complete guest checkout flow

### Maps
- **Map**: Storefront
  - **Frame**: Product Listing
    - Focal point: Product Card → `component_api-contract` (listProducts)
    - Focal point: Filter Sidebar → `component_api-contract` (listProducts)
  - **Frame**: Product Detail
    - Focal point: Add to Cart → `component_api-contract` (addCartItem)
    - Focal point: Reviews Section → `component_test-case-suite` (E2E Regression)
  - **Frame**: Checkout
    - Focal point: Place Order → `component_api-contract` (placeOrder)
    - Focal point: Payment Form → `component_backend-flow-diagram` (Checkout Flow)

## Domain: Payments

### Database
- `payment_methods`
- `transactions`
- `refunds`

### API Endpoints
- `POST /payments` — create payment
- `GET /payments/{id}` — get payment status
- `POST /payments/{id}/capture` — capture authorized payment
- `POST /payments/{id}/refund` — refund payment
- `POST /webhooks` — register webhook

### Architecture Diagram
Use `sequenceDiagram` covering:
- Merchant → Payment Gateway → Processor → Bank → Callback

### Test Packs
- **Smoke pack**
  - API: Create payment returns 201
  - API: Capture payment returns 200
- **Regression pack**
  - API: Refund returns 200
  - Manual: Verify webhook delivery

### Maps
- **Map**: Payment Console
  - **Frame**: Transaction List
    - Focal point: Create Payment → `component_api-contract` (createPayment)
  - **Frame**: Transaction Detail
    - Focal point: Capture Button → `component_api-contract` (capturePayment)
    - Focal point: Refund Button → `component_test-case-suite` (Payments Regression)

## Domain: CRM

### Database
- `customers`, `contacts`, `companies`
- `deals`, `activities`, `notes`

### API Endpoints
- `GET /customers` — list customers
- `POST /customers` — create customer
- `GET /deals` — list deals
- `POST /deals` — create deal
- `POST /activities` — log activity

### Maps
- **Map**: CRM Dashboard
  - **Frame**: Customer List
    - Focal point: Add Customer → `component_api-contract` (createCustomer)
  - **Frame**: Deal Pipeline
    - Focal point: Deal Card → `component_api-contract` (updateDeal)
    - Focal point: Activity Log → `component_test-case-suite` (CRM Smoke)

## Domain: Analytics

### Database
- `events`, `event_properties`
- `dashboards`, `reports`

### API Endpoints
- `POST /events` — ingest event
- `GET /dashboards` — list dashboards
- `GET /reports/{id}` — get report

### Architecture Diagram
Use `flowchart` covering:
- Ingestion → Validation → Enrichment → Storage → Query → Dashboard

### Maps
- **Map**: Analytics Platform
  - **Frame**: Dashboard
    - Focal point: Event Stream → `component_backend-flow-diagram` (Ingestion Flow)
    - Focal point: Report Widget → `component_api-contract` (getReport)

## Domain: Messaging / Chat

### Database
- `conversations`, `messages`, `participants`

### API Endpoints
- `POST /conversations` — create conversation
- `POST /messages` — send message
- `GET /conversations/{id}/messages` — get messages
- `POST /conversations/{id}/participants` — add participant

### Architecture Diagram
Use `sequenceDiagram` covering:
- Client → API → Message Queue → Notification Service → Push Gateway

### Maps
- **Map**: Chat App
  - **Frame**: Conversation List
    - Focal point: New Chat → `component_api-contract` (createConversation)
  - **Frame**: Chat Room
    - Focal point: Send Button → `component_api-contract` (sendMessage)
    - Focal point: Attachment → `component_test-case-suite` (Messaging Smoke)

## Anti-Patterns to Avoid

1. **Generic artifact names** — Do not use names like `api-1`, `test-1`, `diagram-1`. Use domain-specific names like `auth-api`, `login-flow`, `checkout-smoke`.
2. **Orphan focal points** — Every focal point should have at least one component linking it to a real entity.
3. **Mismatched operationIds** — The `operationId` in a test case or component must exactly match an `operationId` in the OpenAPI spec.
4. **Missing file paths** — Every `path` in `.uigraph.yaml` must reference a file that exists.
5. **Empty test packs** — A test pack with no test cases is valid but useless.

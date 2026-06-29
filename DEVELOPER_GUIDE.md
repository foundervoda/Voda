# Voda Developer Guide

This guide covers everything a new developer needs to understand, run, and extend the Voda platform. Read it top to bottom on your first day.

---

## Table of Contents

1. [What Voda Is](#1-what-voda-is)
2. [Repository Layout](#2-repository-layout)
3. [Running the Stack Locally](#3-running-the-stack-locally)
4. [Architecture Overview](#4-architecture-overview)
5. [Database Schema](#5-database-schema)
6. [Order Lifecycle](#6-order-lifecycle)
7. [Try & Buy System](#7-try--buy-system)
8. [Authentication & Roles](#8-authentication--roles)
9. [Backend Routes Reference](#9-backend-routes-reference)
10. [Real-Time Events (Socket.IO)](#10-real-time-events-socketio)
11. [Mobile App Structure](#11-mobile-app-structure)
12. [Web Dashboard (Store Staff & Admin)](#12-web-dashboard-store-staff--admin)
13. [Kiosk App](#13-kiosk-app)
14. [Store Onboarding Flow](#14-store-onboarding-flow)
15. [Subscription Tiers](#15-subscription-tiers)
16. [Test Accounts](#16-test-accounts)
17. [Environment Variables](#17-environment-variables)
18. [Common Dev Tasks](#18-common-dev-tasks)
19. [Brand & UI Conventions](#19-brand--ui-conventions)
20. [Known Gotchas](#20-known-gotchas)

---

## 1. What Voda Is

Voda is an on-demand fashion delivery platform for a mall. Customers browse products from in-mall stores, place orders, and receive them at the mall's central hub or at their doorstep. The differentiator is **Try & Buy (T&B)**: customers can try items at the door and return what they don't want before the rider leaves.

**Five actors in the system:**

| Actor | Platform | What they do |
|-------|----------|-------------|
| **Customer** | Mobile app | Browse, order, track, try & buy |
| **Runner** | Mobile app | Picks up orders from stores, hands to rider |
| **Rider** | Mobile app | Delivers from hub to customer's door |
| **Store Staff** | Web dashboard | Manage inventory, view orders, T&B settings |
| **Admin** | Web dashboard | Manage stores, approve onboarding, oversee everything |

There is also a **Kiosk** (web app) at the mall's return counter that scans items coming back from T&B returns.

---

## 2. Repository Layout

```
Voda_Codebase/
├── backend/          Node.js / Express API + Socket.IO
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src/
│       ├── index.js          Entry point
│       ├── lib/
│       │   ├── prisma.js     Shared Prisma client (singleton)
│       │   └── orderHelper.js  Fee calculation, enrichment
│       ├── middleware/
│       │   ├── auth.js       requireAuth, requireRole
│       │   └── errorHandler.js asyncHandler, global error handler
│       ├── routes/           One file per actor/domain
│       │   ├── auth.js
│       │   ├── orders.js     Customer order actions
│       │   ├── products.js   Public product catalog
│       │   ├── store.js      Store staff endpoints
│       │   ├── runner.js
│       │   ├── rider.js
│       │   ├── admin.js
│       │   ├── tnb.js        T&B request management
│       │   ├── kiosk.js
│       │   ├── onboard.js    Store invite / onboarding
│       │   └── dev.js        Dev-only helpers (not in production)
│       └── sockets/
│           └── index.js      Socket.IO event registration
│
├── mobile/           Expo (React Native) v56 — customer, runner, rider
│   └── src/
│       ├── api/              axios client, SocketContext
│       ├── navigation/       Role-based navigators
│       ├── screens/
│       │   ├── customer/
│       │   ├── rider/
│       │   └── runner/
│       ├── store/            Zustand stores
│       └── utils/
│
├── web/              Vite + React + Tailwind — store staff & admin
│   └── src/
│       ├── api/              axios wrappers per domain
│       ├── screens/
│       │   ├── AdminPanel.jsx
│       │   ├── OrdersBoard.jsx
│       │   ├── StockView.jsx
│       │   ├── OnboardingPage.jsx
│       │   ├── KioskScreen.jsx
│       │   └── LoginScreen.jsx
│       └── App.jsx           Routing (onboard token detection, role gates)
│
└── kiosk/            Vite + React — return counter scanning station
    └── src/
        ├── App.jsx
        └── screens/VerifyScreen.jsx
```

---

## 3. Running the Stack Locally

### Prerequisites

- Node.js 18+
- PostgreSQL (or a Supabase project)
- Expo CLI (`npm i -g expo-cli`)
- An iOS simulator or Android emulator (or the Expo Go app)

### Backend

```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET
npm install
npx prisma db push        # sync schema to DB (no migrations needed in dev)
node prisma/seed.js       # seed test stores, products, users
npm run dev               # nodemon on port 3001
```

The backend serves:
- REST API at `http://localhost:3001/api`
- Socket.IO at `http://localhost:3001`

### Web Dashboard

```bash
cd web
npm install
# VITE_API_URL=http://localhost:3001 is the only env var needed
npm run dev               # Vite dev server on port 5173
```

> **Important:** `VITE_API_URL` must NOT have a trailing slash, and API calls must append `/api` manually. The env var points to the root of the server.

### Kiosk

```bash
cd kiosk
npm install
npm run dev               # Vite on port 5174 (or next free port)
```

### Mobile App

```bash
cd mobile
npm install
# Edit src/api/client.js: set BASE_URL to your machine's LAN IP
# e.g. http://192.168.1.42:3001/api  (not localhost — device can't reach it)
npx expo start
```

Scan the QR code with Expo Go, or press `i` for iOS simulator / `a` for Android emulator.

---

## 4. Architecture Overview

```
┌─────────────┐     REST + Socket.IO      ┌──────────────────────┐
│  Mobile App │ ◄────────────────────────► │                      │
│  (Expo RN)  │                            │   Express Backend    │
└─────────────┘                            │   :3001              │
                                           │                      │
┌─────────────┐     REST + Socket.IO      │   Prisma 7 + pg      │
│ Web Dashboard◄────────────────────────► │   (Supabase PG)      │
│  (Vite+React)│                           │                      │
└─────────────┘                            └──────────────────────┘
                                                     │
┌─────────────┐     REST                            │
│   Kiosk     │ ◄──────────────────────────────────┘
│  (Vite+React)│
└─────────────┘
```

**Key architectural decisions:**

- **Single backend** serves all clients (mobile, web, kiosk).
- **Socket.IO rooms** are the primary real-time mechanism. Key rooms: `order:{id}`, `user:{userId}`, `store:{storeId}`, `runners`.
- **Prisma 7** uses the `@prisma/adapter-pg` driver adapter. Do NOT use `new PrismaClient()` directly in scripts — always `require('dotenv/config')` first, then `require('./src/lib/prisma')`.
- **JWT** is used for session tokens. The secret is `JWT_SECRET` in `.env`.
- **No migrations** — the project uses `prisma db push`. Schema changes are applied directly to the DB.

---

## 5. Database Schema

### Core Models

#### User
```
id, email (nullable, unique), phone, role (CUSTOMER|RUNNER|RIDER|STORE_STAFF|ADMIN),
otp, otpExpiry, storeId (FK → Store), loginCode (for magic link / admin login)
```
The `email` field doubles as the **subscription tier signal**: if it contains `"gold"` → Gold tier; `"platinum"` → Platinum tier.

#### Store
```
id, name, location, phone, email, category, logoUrl, pinCode,
inviteToken (32-char hex, unique), inviteExpiry,
status (INVITED|PENDING|ACTIVE|REJECTED),
tbOverride (String: "NONE"|"ENABLED"|"DISABLED"),
tnbOverride (Boolean, legacy — prefer tbOverride)
```

#### Product
```
id, name, price (Decimal), images (String[]), category, trending, active,
storeId (FK), tbEligible (nullable Boolean), tbRequest (String)
```
T&B eligibility resolution (in priority order):
1. `store.tbOverride === "ENABLED"` → eligible
2. `store.tbOverride === "DISABLED"` → not eligible
3. `product.tbEligible !== null` → use product flag
4. Category default: `Sneakers` and `Apparel` are eligible by default

#### Variant
```
id, size (always "UK X" format for shoes — e.g. "UK 8"), color, stock, productId
```

#### Order
```
id, status (OrderStatus enum), deliveryAddr, etaMinutes, tryTimerEnd,
customerId, runnerId, riderId, deliveryOtp, kioskVerified
```
`deliveryAddr` encodes the T&B flag: if it contains `" | Try & Buy"`, the order is a T&B order.
`deliveryOtp` is reused throughout the order lifecycle:
- ARRIVED: customer shows OTP to rider → rider enters to start T&B
- TRY_BUY_IN_PROGRESS: customer generates keepOtp or returnOtp → stored here → rider enters to close

#### OrderItem
```
id, orderId, productId, variantId, quantity, isReturned, returnReason, returnComment
```

### Enums

**OrderStatus** (full lifecycle):
```
PENDING → RUNNER_ASSIGNED → COLLECTED → HANDED_TO_RIDER →
OUT_FOR_DELIVERY → ARRIVED → TRY_BUY_IN_PROGRESS →
  ├── DELIVERED          (kept)
  └── RETURNING → WITH_RUNNER → RETURNED → REFUNDED
```

**Role:** `CUSTOMER | RUNNER | RIDER | STORE_STAFF | ADMIN`

**StoreStatus:** `INVITED | PENDING | ACTIVE | REJECTED`

---

## 6. Order Lifecycle

### Standard Delivery

```
Customer places order (PENDING)
  → Runner accepts (RUNNER_ASSIGNED)
  → Runner collects from store (COLLECTED)
  → Runner meets rider at kiosk (HANDED_TO_RIDER)
    [kiosk scans items to verify, sets kioskVerified=true]
  → Rider picks up (OUT_FOR_DELIVERY)
  → Rider arrives (ARRIVED)
    [customer shows delivery OTP → rider enters it]
  → DELIVERED
```

### Try & Buy Delivery

Same as above up to ARRIVED, then:

```
  → Rider enters delivery OTP → TRY_BUY_IN_PROGRESS
    [5-min server timer starts (tryTimerEnd = now + 5min)]
    [Customer sees 1-min countdown (DISPLAY_OFFSET_MS = 4min subtracted)]

  Customer taps "Keep All Items"
    → Backend generates keepOtp, sets tryTimerEnd = epoch
    → Customer shows keepOtp to rider
    → Rider enters keepOtp → DELIVERED

  Customer taps "Return Selected Items"
    → Backend generates returnOtp, marks items isReturned=true
    → Customer shows returnOtp to rider
    → Rider enters returnOtp → RETURNING
    → Runner assigned to collect return (WITH_RUNNER)
    → RETURNED → REFUNDED
```

**Special case — all items ineligible:** If the order has no T&B-eligible items, `confirm-tb-keeps` immediately sets status to DELIVERED (no OTP required). The customer is navigated home on button press.

### Timer mechanics
The server stores `tryTimerEnd = now + 5 minutes`. The client subtracts `DISPLAY_OFFSET_MS = 4 * 60 * 1000` to show a 1-minute countdown. Both the customer (`TryBuyScreen`) and rider (`RiderTnbTimerScreen`, `RiderDeliveryScreen`) derive their countdown from the same `tryTimerEnd` field — they stay in sync automatically.

---

## 7. Try & Buy System

### Eligibility

By default, **Sneakers** and **Apparel** are T&B eligible. **Boots** and other categories are not. This can be overridden at the store level (`tbOverride`) or per-product (`tbEligible`). The resolution function lives in `backend/src/lib/orderHelper.js` (`getProductEligibility`) and `web/src/screens/StockView.jsx` (`resolveEffective`).

### OTP Handoff Chain

Every T&B outcome requires a face-to-face OTP exchange between customer and rider. No order closes without it.

| Outcome | Who generates OTP | Endpoint | Who enters OTP | Endpoint |
|---------|-------------------|----------|----------------|----------|
| Keep | Customer (button tap) | `POST /orders/:id/confirm-tb-keeps` | Rider | `POST /rider/orders/:id/confirm-keep-otp` |
| Return | Customer (button tap) | `POST /orders/:id/request-return` | Rider | `POST /rider/orders/:id/initiate-return` |
| Ineligible-only order | — (auto-deliver) | `POST /orders/:id/confirm-tb-keeps` | — | — |

### Rider UX

The rider screens (`RiderDeliveryScreen`, `RiderTnbTimerScreen`) show **no action buttons** while the timer is running or after it expires. The OTP entry panel appears automatically when the customer makes a decision, triggered by the `order_update` socket event. The detection logic:

```js
if (
  updated.status === "TRY_BUY_IN_PROGRESS" &&
  new Date(updated.tryTimerEnd).getTime() <= 1000
) {
  const hasReturns = updated.items.some(i => i.isReturned);
  setPendingOtpMode(hasReturns ? "return" : "keep");
}
```

---

## 8. Authentication & Roles

### Customer (Mobile)

1. Enter phone number → `POST /api/auth/request-otp`
2. Backend generates a 6-digit OTP, stores it with a TTL, logs it in the terminal as `[OTP] <phone> → <code>`, and returns it in `devOtp` (dev only — remove for production)
3. Enter OTP → `POST /api/auth/verify-otp` → returns JWT
4. JWT stored in `expo-secure-store` (native) or `localStorage` (web)

New accounts are created automatically on first `request-otp` if the phone number is not found.

### Staff/Admin (Web)

Magic link login: admin generates a `loginCode` for a staff account. Staff visits `?code=LOGINCODE` URL. The web app calls `POST /api/auth/verify-code` which exchanges the code for a JWT.

There is also a bypass code for testing: `VODA123` or `PASSWORD123` (dev only).

### Auth Middleware

```js
// Attach to any protected route
requireAuth          // verifies JWT, populates req.user
requireRole("RIDER") // gates by role; accepts multiple: requireRole("RUNNER", "RIDER")
```

The `req.user` object is the full User row from the DB including `storeId` and `role`.

---

## 9. Backend Routes Reference

All routes are prefixed with `/api`.

### Auth (`/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/request-otp` | — | Send OTP to phone number |
| POST | `/verify-otp` | — | Verify OTP, return JWT |
| POST | `/verify-code` | — | Magic link / bypass code login |
| GET | `/me` | ✓ | Get current user |

### Orders (`/orders`) — Customer
| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create order |
| GET | `/:id` | Get order details |
| POST | `/:id/confirm-tb-keeps` | Lock in keeps; generates keepOtp (or auto-delivers if all items ineligible) |
| POST | `/:id/request-return` | Initiate return; generates returnOtp |

### Products (`/products`) — Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List products (supports `?storeId`, `?category` filters) |
| PUT | `/stock` | Bulk update stock (store staff) |

### Store (`/store`) — Store Staff
| Method | Path | Description |
|--------|------|-------------|
| GET | `/products/tb` | T&B eligibility view for this store |
| POST | `/products/:id/tb-request` | Submit T&B change request |
| GET | `/activity` | Order activity stats (sold today/week, reserved, most returned) |
| PATCH | `/products/:id` | Edit product (name, price, category, images) |
| PATCH | `/products/:id/active` | Toggle product active status |

### Runner (`/runner`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/orders` | Available orders to accept |
| POST | `/orders/:id/accept` | Accept an order |
| POST | `/orders/:id/collect` | Mark collected from store |
| POST | `/orders/:id/hand-to-rider` | Hand to rider at kiosk (OTP verified) |
| POST | `/orders/return/:id/accept` | Accept a return job |
| POST | `/orders/return/:id/complete` | Complete return dropoff |

### Rider (`/rider`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/orders` | Orders assigned to this rider |
| POST | `/orders/:id/arrive` | Mark arrived |
| POST | `/orders/:id/verify-otp` | Verify delivery OTP → starts T&B timer if applicable |
| POST | `/orders/:id/confirm-keep-otp` | Rider enters customer's keep OTP → DELIVERED |
| POST | `/orders/:id/initiate-return` | Rider enters customer's return OTP → RETURNING |
| POST | `/orders/:id/confirm-runner-handoff` | Rider enters runner's OTP at kiosk → WITH_RUNNER |

### Admin (`/admin`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stores` | All stores with status |
| POST | `/stores` | Create store + generate invite link |
| POST | `/stores/:id/approve` | Approve PENDING store → ACTIVE |
| POST | `/stores/:id/reject` | Reject store |
| POST | `/stores/:id/regenerate-invite` | Re-generate invite token |
| GET | `/tnb-requests` | All pending T&B requests |
| POST | `/tnb-requests/:id/resolve` | Approve or reject a T&B request |

### Onboard (`/onboard`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/:token/validate` | Validate invite token, return store info |
| POST | `/:token/complete` | Complete store setup (name, PIN, inventory) → PENDING |

### Kiosk (`/kiosk`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/verify` | Scan items at return kiosk; emits `kiosk_mismatch` if wrong item |

---

## 10. Real-Time Events (Socket.IO)

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `authenticate` | JWT string | Identify the socket; joins `user:{userId}` room |
| `join_order_room` | orderId | Join `order:{id}` room for order-specific updates |
| `join_store_room` | storeId | Join `store:{id}` room for store updates |
| `rider_location` | `{orderId, lat, lng}` | Rider broadcasts GPS position; relayed to order room |

### Server → Client

| Event | Room | Payload | Description |
|-------|------|---------|-------------|
| `order_update` | `order:{id}` | `{ order }` | Any status change; all parties in the room receive it |
| `order_update` | `user:{customerId}` | `{ order }` | Duplicate for customer's personal room |
| `tnb_timer_start` | `order:{id}` | `{orderId, tnbDisplayEnd}` | T&B timer started after delivery OTP verified |
| `new_order` | `runners` | `{ order }` | New order available for runners to accept |
| `refund_initiated` | `user:{customerId}` | `{ orderId }` | Return accepted, refund in progress |
| `kiosk_mismatch` | `store:{storeId}` | `{shortId, expected, scanned, mode}` | Wrong item scanned at kiosk |

### Authentication flow for sockets

```js
// Client connects, then authenticates
socket.connect();
socket.emit("authenticate", jwtToken);
// Server joins socket to user:{userId} room and logs the connection
```

---

## 11. Mobile App Structure

### Navigation

Role-based routing is handled in `RootNavigator.js`:
- No user → `AuthNavigator` (Login/Register)
- `CUSTOMER` → `CustomerTabs` (bottom tabs) + stack screens
- `RUNNER` or `RIDER` → `RunnerNavigator` (shares the same navigator; role determines which dashboard is shown)

### State Management (Zustand)

| Store | File | What it holds |
|-------|------|---------------|
| `useAuthStore` | `store/useAuthStore.js` | Current user, token, login/logout actions |
| `useOrderStore` | `store/useOrderStore.js` | Active order state |
| `useBrowsingStore` | `store/useBrowsingStore.js` | Cart, browsing state |
| `useSizingStore` | `store/useSizingStore.js` | Customer's size preferences (used for return suggestions) |

### API Client

`src/api/client.js` — axios instance with:
- Base URL: `http://localhost:3001/api` (hardcoded; update to LAN IP for device testing)
- Auth interceptor: attaches Bearer token from SecureStore/localStorage automatically
- 401 interceptor: clears token and calls `useAuthStore.logout()`

Token is stored in `expo-secure-store` on native and `localStorage` on web.

### Socket

`src/api/SocketContext.js` provides `useSocket()` hook. One socket per app session, shared via React Context. The socket connects and authenticates automatically when `SocketProvider` mounts (wraps the logged-in app shell).

### Customer Screens

| Screen | What it does |
|--------|-------------|
| `HomeScreen` | Product feed, store browse |
| `ProductDetailScreen` | Product images, variants, add to cart |
| `CartScreen` | Cart review, T&B toggle per item |
| `CheckoutScreen` | Address, payment confirmation |
| `TrackOrderScreen` | Live order tracking with rider GPS map |
| `TryBuyScreen` | T&B portal: item selection, OTP display |
| `OrderHistoryScreen` | Past orders |
| `VodaGoldScreen` | Subscription tier info |
| `ChatbotScreen` | Support chatbot |

### Rider Screens

| Screen | What it does |
|--------|-------------|
| `RiderDashboard` | Available + active orders |
| `RiderDeliveryScreen` | Full delivery flow: arrival, OTP, T&B wait, OTP entry |
| `RiderTnbTimerScreen` | Dedicated T&B wait screen (alternate entry point) |
| `RiderArrivedScreen` | Mark arrived + enter delivery OTP |
| `RiderReturnScreen` | Enter runner OTP to hand back returned items |
| `RiderHistoryScreen` | Completed deliveries |

### Runner Screens

| Screen | What it does |
|--------|-------------|
| `RunnerDashboard` | Available orders to accept |
| `AcceptOrderScreen` | Accept and start collection |
| `CollectionScreen` | Mark collected from store |
| `HandoverScreen` | Hand to rider at kiosk |
| `RunnerReturnScreen` | Handle return pickup from rider |
| `RunnerHistoryScreen` | Completed runs |

---

## 12. Web Dashboard (Store Staff & Admin)

Entry point: `web/src/App.jsx`

**Routing logic:**
1. If URL path matches `/onboard/{32-char-hex}` → render `OnboardingPage`
2. Otherwise → render `MainApp`
3. In `MainApp`: no token → `LoginScreen`; token → role check
   - `ADMIN` → `AdminPanel`
   - `STORE_STAFF` → tabbed dashboard (Orders / Stock / Try & Buy)

### Store Staff Tabs

| Tab | Component | Description |
|-----|-----------|-------------|
| Orders | `OrdersBoard` | Live order board, status tracking |
| Stock | `StockView` | Full inventory management |
| Try & Buy | `StoreTbTab` (in OrdersBoard) | T&B eligibility per product, request changes |

### StockView Features

- **5 metric cards**: Total products, Out of stock (red if >0), Low stock (red if >threshold), T&B eligible (X/total), Inactive
- **Alerts panel**: Collapsible, configurable low-stock threshold, lists affected products by name and size
- **Filters**: Search (name/SKU/category), category, status (all/active/inactive), T&B eligibility, stock level
- **Variant chips**: Clickable colored chips per size (red=0, yellow=low, green=ok); click to inline-edit stock
- **Product rows**: One row per product (not per variant) with bulk select checkbox
- **Bulk actions**: Enable T&B, Disable T&B, Set stock, Export CSV
- **Edit modal**: Edit name, price, category, image URLs
- **Activity panel**: Sold today/week, reserved, most-returned products with reason breakdown

### AdminPanel Tabs

| Tab | Description |
|-----|-------------|
| Stores | Create stores, manage invite links, approve/reject pending stores, re-invite rejected stores |
| T&B Requests | Review store-submitted requests to change product T&B eligibility |
| Orders | System-wide order overview |

### API Layer

`web/src/api/` has one file per domain:
- `client.js` — axios instance; token from `localStorage` key `"voda_store_token"`
- `auth.js` — login, getMe, logout
- `orders.js` — order list, status updates
- `products.js` — fetch products, bulk stock update, toggle active, update product
- `store.js` — create store, approve/reject, regenerate invite, store activity
- `admin.js` — admin-specific endpoints
- `tnb.js` — T&B request management
- `socket.js` — Socket.IO client for web

---

## 13. Kiosk App

The kiosk (`kiosk/`) is a simple Vite + React app intended to run on a touch screen at the mall's return counter. Staff scan or enter item identifiers as returns come back from riders.

**Flow:**
1. Enter order ID or scan item
2. `POST /api/kiosk/verify` — validates item matches expected return
3. Success: shows green confirmation
4. Mismatch: emits `kiosk_mismatch` socket event to the store's web dashboard

Login uses the same magic link / bypass code system as the web dashboard.

---

## 14. Store Onboarding Flow

Stores go through a lifecycle: `INVITED → PENDING → ACTIVE` (or `REJECTED`).

### Full flow

1. **Admin creates store**: `POST /api/admin/stores` — creates a Store record with `status: INVITED` and generates a 32-char hex `inviteToken` (valid for 7 days). Returns an invite URL: `{webAppUrl}/onboard/{token}`.

2. **Admin shares link**: Copy button or WhatsApp share from the AdminPanel Stores tab.

3. **Store manager opens link**: `web/src/App.jsx` detects the `/onboard/{token}` path and renders `OnboardingPage`.

4. **Validation**: `GET /api/onboard/:token/validate` — checks token exists and hasn't expired. Returns store name/location for display.

5. **Manager fills form**: Business name, PIN code, contact info, initial inventory.

6. **Submit**: `POST /api/onboard/:token/complete` — updates store to `status: PENDING`, stores PIN.

7. **Admin approves**: `POST /api/admin/stores/:id/approve` — sets `status: ACTIVE`, creates a STORE_STAFF user account with a login code.

8. **Store staff logs in**: Uses the login code from the approval email/message.

---

## 15. Subscription Tiers

Tiers are determined purely from the user's email address in `enrichOrderWithFees` (`backend/src/lib/orderHelper.js`):

```js
const isGold     = email.toLowerCase().includes("gold");
const isPlatinum = email.toLowerCase().includes("platinum");
```

| Tier | Delivery Fee | T&B Fee |
|------|-------------|---------|
| Standard | ₹150 | ₹99 (if eligible items) |
| Gold | FREE | FREE |
| Platinum | FREE | FREE |

The enriched order object includes `isGold`, `isPlatinum`, `isSubscriber`, `deliveryFee`, `tryAndBuyFee`, and `totalAmount`. These are computed on every fetch — no DB column for tier.

---

## 16. Test Accounts

### Mobile (phone-number login)

| Role | Phone | Notes |
|------|-------|-------|
| Customer (Standard) | `0000000000` | email: customer_standard@voda.test |
| Customer (Gold) | `1111111111` | email: customer_gold@voda.test, free delivery + T&B |
| Customer (Platinum) | `9999999999` | email: customer_platinum@voda.test, free delivery + T&B |
| Runner | `+10000000002` | |
| Rider | `+10000000003` | |

**Getting the OTP in dev:** After entering a phone number and tapping "Send OTP", look in the **backend terminal** for:
```
[OTP] 9999999999 → 482913
```
The OTP is also returned in the `devOtp` field of the API response (remove before production).

### Web Dashboard (magic link / bypass)

| Role | Code | Notes |
|------|------|-------|
| Admin | `VODA123` or `PASSWORD123` | Dev bypass codes |
| Store Staff | `+10000000004` phone (mobile) or loginCode set by admin | |

---

## 17. Environment Variables

### Backend (`.env`)

```env
DATABASE_URL=postgresql://...     # Supabase or local PG connection string
JWT_SECRET=your-secret-here       # Arbitrary long random string
PORT=3001                         # Optional, defaults to 3001
NODE_ENV=development              # Set to "production" to disable dev routes
```

### Web (`web/.env` or Vite env)

```env
VITE_API_URL=http://localhost:3001   # No trailing slash — routes append /api manually
```

### Mobile (`mobile/.env` or `app.json` extra)

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001   # Must be LAN IP for device testing
```

The mobile `client.js` currently has `BASE_URL` hardcoded — update it for device testing.

---

## 18. Common Dev Tasks

### Add a new route

1. Create or open the relevant route file in `backend/src/routes/`
2. Use `asyncHandler` to avoid try/catch boilerplate:
   ```js
   const { asyncHandler } = require("../middleware/errorHandler");
   router.post("/path", requireAuth, requireRole("CUSTOMER"), asyncHandler(async (req, res) => {
     // throw freely — errorHandler catches it
   }));
   ```
3. Return the standard envelope: `res.json({ data: { ... }, error: null })`
4. Register the router in `backend/src/index.js` if it's a new file

### Change the DB schema

```bash
# Edit backend/prisma/schema.prisma
npx prisma db push            # Apply to DB
npx prisma generate           # Regenerate client
# Restart the backend
```

For destructive changes (removing columns, changing types):
```bash
npx prisma db push --accept-data-loss
```

### Run a one-off DB query in dev

```js
// script.js
require('dotenv/config');             // MUST be before requiring prisma
const prisma = require('./src/lib/prisma');

prisma.user.findMany({ where: { role: 'CUSTOMER' } })
  .then(console.log)
  .then(() => process.exit(0));
```
```bash
node script.js
```

### Add a product variant to seed

Edit `backend/prisma/seed.js`, add to the relevant product's `variants` array, then:
```bash
node prisma/seed.js
```

### Re-seed the DB

```bash
cd backend
node prisma/seed.js
```

The seed uses upsert patterns — safe to run multiple times.

### Reset test data

```bash
npx prisma db push --force-reset   # Drops and recreates all tables
node prisma/seed.js                 # Re-seed
```

---

## 19. Brand & UI Conventions

### Colors

| Name | Hex | Usage |
|------|-----|-------|
| Cream | `#fdf9ea` | App background |
| Navy | `#012a62` | Primary text, buttons, headers |
| Yellow | `#fdde59` | Accent, CTAs, badges |

These are the **only three colors** used for brand surfaces. Other colors (red for errors, orange for returns, green for success) are used sparingly for semantic meaning only.

### Mobile StyleSheet convention

```js
const S = "#012a62";   // Navy — used as a shorthand throughout screens
const Y = "#fdde59";   // Yellow
```

Almost every mobile screen defines `S` and `Y` at the bottom.

### Web (Tailwind)

The web dashboard uses Tailwind with custom colors configured as:
```js
// tailwind.config.js (web)
navy: "#012a62"
yellow: "#fdde59"
cream: "#fdf9ea"
```

Use `text-navy`, `bg-yellow`, `bg-cream` etc.

### OTP Card style (mobile)

The standard OTP display (shown when customer generates a keep or return code) uses:
- Background: navy (`#012a62`)
- Badge: yellow (keep) or orange (`#ff7043`, return)
- OTP digits: large white text, letter-spacing 8
- Cancel link: muted below the card

---

## 20. Known Gotchas

### Prisma driver adapter

Prisma 7 on this project requires the `@prisma/adapter-pg` driver adapter (Supabase uses PostgreSQL). If you create a `new PrismaClient()` without options it will fail with an initialization error. Always use the shared singleton:
```js
const prisma = require('./src/lib/prisma');
```

In standalone scripts, always load env first:
```js
require('dotenv/config');
const prisma = require('./src/lib/prisma');
```

### `tbOverride` vs `tnbOverride`

The Store model has both:
- `tbOverride` (String: `"NONE"` | `"ENABLED"` | `"DISABLED"`) — the **live field** used by all eligibility logic
- `tnbOverride` (Boolean, nullable) — a legacy field from an earlier schema iteration

Always use `tbOverride`. When querying products with their store, make sure `tbOverride` is in the `select` clause:
```js
store: { select: { id: true, tbOverride: true } }
```
Selecting only `tnbOverride` (easy mistake) will silently break T&B eligibility resolution.

### Mobile API base URL

`mobile/src/api/client.js` has `BASE_URL` hardcoded to `http://localhost:3001/api`. This works in the iOS simulator but not on a physical device. For device testing, replace `localhost` with your machine's LAN IP (find it with `ifconfig | grep 192`).

### Web `VITE_API_URL`

The env var is the server root (`http://localhost:3001`), not the API root. All API modules in `web/src/api/` manually append `/api`. Do not put a trailing `/api` in the env var.

### Socket rooms — order vs user

Most socket events are emitted to both `order:{id}` (for everyone watching the order) and `user:{customerId}` (for the customer's personal room). If you add a new route that changes order status, make sure to emit to both:
```js
io.to(`order:${order.id}`).emit("order_update", { order: enriched });
io.to(`user:${order.customerId}`).emit("order_update", { order: enriched });
```

### Size format

All shoe variant sizes must be stored as `"UK X"` (e.g. `"UK 8"`, `"UK 10"`). Apparel sizes are bare (`"S"`, `"M"`, `"L"`). A normalization pass was run in June 2026 to fix legacy variants that stored just `"8"` without the `"UK "` prefix.

### `deliveryOtp` lifecycle

This single field is reused for three different OTPs across an order's life:
1. **Delivery OTP**: Customer shows to rider at the door. Cleared when rider enters it.
2. **Keep OTP**: Generated by `confirm-tb-keeps`. Rider enters via `confirm-keep-otp`.
3. **Return OTP**: Generated by `request-return`. Rider enters via `initiate-return`. After `initiate-return`, it's immediately overwritten with a new runner-rider handoff OTP.

Never rely on `deliveryOtp` being stable across status transitions.

### `enrichOrderWithFees`

Call this on every order before returning it to clients. It computes delivery fee, T&B fee, total, tier flags, and `tryTimerRemainingMs`. It spreads `...order` so all DB fields are preserved:
```js
const enriched = enrichOrderWithFees(order, order.customer?.email);
res.json({ data: { order: enriched }, error: null });
```

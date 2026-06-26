# Voda Developer Documentation: Full Project Implementation

This document serves as the comprehensive technical guide and reference for all Voda system features, database changes, socket architectures, and UI/UX flows implemented in this workspace.

---

## 1. Project Architecture Overview

Voda is a premium multi-store mall logistics platform consisting of three primary components:
1. **Backend API & Real-time Server**: Built with Node.js, Express, Socket.io, and Prisma. Database operations are hosted on Supabase (PostgreSQL).
2. **Customer App (Mobile)**: React Native (Expo) customer client featuring mall directories, product catalogs, subscription matrices, maps, chatbot help, and checkout workflows.
3. **Staff & Admin Dashboard (Web)**: React-based dashboard for store managers (inventory, approvals, order alerts) and super admins.

```
Voda-Project/
├── backend/
│   ├── prisma/             # Schema definition & seed scripts
│   └── src/
│       ├── routes/         # REST API routes (auth, orders, runner, etc.)
│       └── sockets/        # Socket.io connection handlers
├── mobile/
│   └── src/
│       ├── screens/        # customer app views (HomeScreen, Chatbot, etc.)
│       ├── store/          # Zustand global state (cart, auth, browsing)
│       └── navigation/     # Customer bottom tab & stack navigators
└── web/                    # Admin & store staff dashboard
```

---

## 2. Membership Subscription Matrix

The platform supports three distinct membership levels, mapped dynamically from customer emails:
1. **Free Standard**: Default account.
2. **Voda Gold**: Subscribed via emails containing `gold` (e.g. `customer_gold@voda.test`).
3. **Voda Platinum**: Subscribed via emails containing `platinum` (e.g. `customer_platinum@voda.test`).

| Feature | Free Standard | Voda Gold | Voda Platinum |
| :--- | :--- | :--- | :--- |
| **Delivery Fee** | ₹150 | ₹0 (FREE) | ₹0 (FREE - Priority) |
| **Try & Buy Option Fee** | ₹99 | ₹0 (FREE) | ₹0 (FREE) |
| **Try & Buy Trial Timer** | 10 Minutes | 15 Minutes | 20 Minutes |
| **Store Limit Per Order** | Max 1 store | Max 3 stores | Max 5 stores |
| **GPS Zone Access** | Locked to local zone | 1 zone switch per month | Unlimited multi-zone access |
| **Try & Buy Auto-Opt-In** | Manual checkbox toggle | Automatic (on eligible items) | Automatic (on eligible items) |

---

## 3. Try & Buy Lifecycle Flow

Try & Buy allows standard or subscription customers to try on Sneakers and Apparel at their door for a designated timer, and keep/return items dynamically before finalizing their payment.

```
[Place Order] 
   └── [Rider Arrives] 
          └── [Rider enters Customer OTP]
                 └── [Try Timer Starts (10/15/20 mins)]
                        └── [Customer selects keeps/returns]
                               └── [Rider enters Runner OTP] -> [Refund Triggered]
```

### 3.1 Synced Active Timers & Handover OTPs
* **Rider Arrival**: When a rider updates the order status to `ARRIVED`, the server generates a 6-digit OTP code in the database.
* **Customer Verification**: The customer's mobile app displays this code. The rider enters the OTP to verify collection and start the trial.
* **Ticking Trial Timer**: Verification triggers the server to set a `tryTimerEnd` value (current time + tier duration). The ticking remaining time is synchronized via Socket.io to the customer's portal and the rider's active panel.
* **Keeps & Return Submissions**: The customer uses [TryBuyScreen.js](file:///Users/ayaanatalwar/Desktop/Voda-Project/Voda/mobile/src/screens/customer/TryBuyScreen.js) to lock in keeps. Upon collection, the rider inputs a runner-supplied OTP to trigger immediate refunds.

---

## 4. GPS Zone Locking & Store Limits

Stores and items are dynamically constrained on the client and validated on the backend to enforce subscription boundaries.

### 4.1 Mock GPS Active Zone Toggle
HomeScreen features a location simulator banner allowing developers to toggle between "Zone A" and "Zone B" to test locking behaviors.
* **Zone Configuration**: Stores are mapped to zones (e.g., `Zara Luxe Hub` belongs to Zone B; all others belong to Zone A).
* **Zone Locks**:
  * **Free**: Blocked from out-of-zone stores. Out-of-zone cards show `"Outside Active Zone"` and tapping prompts upgrades.
  * **Gold**: Shows warning `"Zone switch used: resets in 12 days"` if the monthly switch is used.
  * **Platinum**: All zones are visible and fully unlocked.

### 4.2 Store Limits per Order
Store cards are dynamically locked and display `"Store Limit Reached"` (or `"5 stores in order"` for Platinum) if unique stores in the cart hit the tier limit.
* **Platinum Dialog Bypass**: Platinum users who click a locked store see a simple limit warning alert **without** upgrade action buttons.

### 4.3 Backend Order Verification
In `POST /api/orders`, the server verifies the cart stores and zones list against the user's tier. Multi-store checkouts are restricted on Free/Gold tiers if they cross zone boundaries:
```javascript
// Enforces zone consistency for Free and Gold
if (currentTier !== "Platinum" && uniqueZones.length > 1) {
  return res.status(400).json({
    error: { message: "Multi-zone ordering is only available on the Platinum plan." }
  });
}
```

---

## 5. Socket Notification Architecture for Multi-Store Orders

When Checkouts contain items from multiple stores (allowed up to 3 stores for Gold and 5 for Platinum), dashboard notifications are split to alert all relevant store staff.

### 5.1 Multi-Store Event Broadcasting
* **New Order Alerts**: When a multi-store order is placed, the server maps all distinct store IDs and emits new order alerts to each socket room:
  ```javascript
  storeIds.forEach(sid => io.to(`store:${sid}`).emit("new_order", { order: enriched }));
  ```
* **Order Status updates**: When order states change (e.g., runner assigns or collects returns), socket signals are dispatched to all participating stores:
  ```javascript
  const storeIds = [...new Set(existing.items.map(i => i.product?.storeId).filter(Boolean))];
  storeIds.forEach(sid => io.to(`store:${sid}`).emit("order_update", { order }));
  ```

---

## 6. Chatbot & Recommendation Redirections

VodaBot is an assistant interface implemented in [ChatbotScreen.js](file:///Users/ayaanatalwar/Desktop/Voda-Project/Voda/mobile/src/screens/customer/ChatbotScreen.js).

### 6.1 End of Conversation Recommended Strip
Upon tapping **"No, finish"** to close the chat, the bot triggers a `"You might also like"` recommended product strip, formatted as an assistant chat bubble.
* **Return Query Filtering**: If the chat topic was a return, recommendations filter by the returned product category.
* **Browsing History Filtering**: For general queries, recommendations check the user's recently browsed category, logged to `useBrowsingStore` as the user navigates product pages.
* **Size Profile Filtering**: If the user has calculated their size during the session, recommendations filter to prioritize active stock availability matching their size (e.g., `"UK 8"` matching variant size `"8"`).

### 6.2 Dismissal & Navigation Delay
Tapping a product card dismisses the chatbot and routes to the detail view. To avoid mobile navigation transitions clipping when the chatbot sheet closes, a 300ms delay is used:
```javascript
onPress={() => {
  if (onClose) onClose();
  if (navigation) {
    setTimeout(() => {
      navigation.navigate("ProductDetail", { productId: prod.id });
    }, 300);
  }
}}
```

---

## 7. Returns Workflow & Reasons Analytics

* **Predefined Return Reasons**: Customers submit returns using a predefined list of 10 reasons (e.g., incorrect sizing, damaged, low quality) and add comments.
* **Aggregation Dashboard Endpoint**: Aggregates returned item details by product, store, and reasons via `/api/admin/return-analytics` to feed store statistics maps on the admin panel.

---

## 8. Admin Magic Link Login

Provides super admins with passwordless login capabilities.
* **Link Generation**: `/api/auth/magic-link` generates a URL on-screen (e.g. `http://localhost:5173/login?token=XYZ`).
* **Auto-Login Hydration**: The React web app detects the token query parameter on mount, saves it to `localStorage` (as `voda_store_token`), and replaces browser history state to strip the token from the URL cleanly.

---

## 9. Navigation & Layout Restructure

* **Customer Tab Navigation**: Restructured bottom tabs to display **Home** (Mall directory/GPS simulations), **Browse** (Responsive search screen with category filters), **Membership** (Voda Gold/Platinum matrices), and **Profile** (Account settings).
* **Recent Order & History Segregation**: The Profile screen only displays the customer's single most recent completed order. Clicking "View All Orders" routes to a dedicated `OrderHistoryScreen` stack containing collapsable list history.

---

## 10. Database Schema Migrations

The Postgres schema leverages Prisma for migrations:
* Optional `email` and `password` columns are enabled on the `User` model to accommodate phone/OTP customer logins.
* All persistent user size columns (`sizeSneakers`, `sizeApparel`, `fitApparel`) have been reverted and deleted from the database.
* To apply changes directly, use the database session pooler (port 5432) to avoid prepared statement limits:
  ```bash
  DATABASE_URL="postgresql://...aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres" npx prisma db push --accept-data-loss
  ```

---

## 11. Running Integration Tests

Two E2E Node.js scripts verify system configurations:
1. **Chatbot API Flow**: `/brain/.../scratch/test_chatbot_flow.js` verifies login, order history retrieval, and semantic search.
2. **Order Constraints E2E Flow**: `/brain/.../scratch/test_all_flows.js` verifies Free, Gold, and Platinum checkout rules and pricing calculations.

To execute the test suite:
```bash
cd Voda/backend
node /Users/ayaanatalwar/.gemini/antigravity-ide/brain/02a63e63-b709-4616-8732-91d1930eb435/scratch/test_all_flows.js
```

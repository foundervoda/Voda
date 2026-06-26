const { Router } = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { enrichOrderWithFees, getProductEligibility } = require("../lib/orderHelper");

const router = Router();

// GET /api/orders — List orders (filtered by storeId for staff, or customerId for customer)
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { storeId } = req.query;
    const { from, to } = req.query;

    const where = {};
    if (storeId) {
      where.items = { some: { product: { storeId } } };
    }

    // If logged-in user is a CUSTOMER, restrict to their own orders
    if (req.user.role === "CUSTOMER") {
      where.customerId = req.user.id;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { include: { store: true } }, variant: true } },
        customer: { select: { id: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      // no take limit when date-filtering (export); default cap of 100 for board view
      ...(from || to ? {} : { take: 100 }),
    });

    const enrichedOrders = orders.map(order => enrichOrderWithFees(order, order.customer?.email));
    res.json({ data: { orders: enrichedOrders }, error: null });
  })
);

// POST /api/orders — Customer places an order from their cart
router.post(
  "/",
  requireAuth,
  requireRole("CUSTOMER"),
  asyncHandler(async (req, res) => {
    const { deliveryAddr, etaMinutes, items } = req.body;

    if (!deliveryAddr || !items || items.length === 0) {
      return res.status(400).json({
        data: null,
        error: { message: "deliveryAddr and items are required", code: "VALIDATION_ERROR" },
      });
    }

    // Resolve all variants to get their storeId via their product
    const variantIds = items.map((i) => i.variantId);
    const variants = await prisma.variant.findMany({
      where: { id: { in: variantIds } },
      include: { product: { include: { store: true } } },
    });

    if (variants.length !== items.length) {
      return res.status(400).json({
        data: null,
        error: { message: "One or more variants not found", code: "VALIDATION_ERROR" },
      });
    }

    // Determine user tier
    const isGold = req.user.email.toLowerCase().includes("gold");
    const isPlatinum = req.user.email.toLowerCase().includes("platinum");
    const currentTier = isPlatinum ? "Platinum" : isGold ? "Gold" : "Free";
    const maxAllowedStores = currentTier === "Platinum" ? 5 : currentTier === "Gold" ? 3 : 1;

    // Get unique store IDs and names
    const storeIds = [...new Set(variants.map((v) => v.product.storeId))];
    const storeNames = [...new Set(variants.map((v) => v.product.store.name))];
    const getStoreZone = (name) => (name === "Zara Luxe Hub" ? "Zone B" : "Zone A");
    const uniqueZones = [...new Set(storeNames.map(getStoreZone))];

    // Validate store limit per order
    if (storeIds.length > maxAllowedStores) {
      return res.status(400).json({
        data: null,
        error: { 
          message: `Your current ${currentTier} plan allows ordering from a maximum of ${maxAllowedStores} store${maxAllowedStores > 1 ? "s" : ""} per order. Upgrade to access more stores!`, 
          code: "VALIDATION_ERROR" 
        },
      });
    }

    // Validate zone access
    if (currentTier !== "Platinum" && uniqueZones.length > 1) {
      return res.status(400).json({
        data: null,
        error: {
          message: `Multi-zone ordering is only available on the Platinum plan. All items in your order must belong to the same zone.`,
          code: "VALIDATION_ERROR"
        }
      });
    }

    // Revalidate Try & Buy eligibility on the server
    const hasEligible = variants.some((v) => getProductEligibility(v.product, v.product.store));

    if (req.body.isTryAndBuy && !hasEligible) {
      return res.status(400).json({
        data: null,
        error: { message: "Try & Buy option is not available for the items in your cart", code: "VALIDATION_ERROR" },
      });
    }

    // Determine if we should activate Try & Buy
    const shouldHaveTryAndBuy = (isGold || isPlatinum) ? hasEligible : (!!req.body.isTryAndBuy && hasEligible);

    // Clean address of any user-submitted suffix and append if active
    const cleanAddr = deliveryAddr.split(" | Try & Buy")[0].trim();
    const finalAddr = shouldHaveTryAndBuy ? `${cleanAddr} | Try & Buy` : cleanAddr;

    const order = await prisma.order.create({
      data: {
        deliveryAddr: finalAddr,
        etaMinutes: etaMinutes ?? 30,
        customerId: req.user.id,
        items: {
          create: items.map((i) => ({
            quantity: i.quantity ?? 1,
            productId: i.productId,
            variantId: i.variantId,
          })),
        },
      },
      include: {
        items: { include: { product: { include: { store: true } }, variant: true } },
      },
    });

    const enriched = enrichOrderWithFees(order, req.user.email);

    // Emit new_order to the store dashboard, runners pool, and the customer
    const io = req.app.get("io");
    storeIds.forEach((sid) => {
      io.to(`store:${sid}`).emit("new_order", { order: enriched });
    });
    io.to("runners").emit("new_order", { order: enriched });
    io.to(`user:${req.user.id}`).emit("new_order", { order: enriched });

    res.status(201).json({ data: { order: enriched }, error: null });
  })
);

// GET /api/orders/:id — Anyone involved in the order can fetch it
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: { include: { store: true } }, variant: true } },
        customer: { select: { id: true, email: true, phone: true } },
        runner:  { select: { id: true, email: true, phone: true } },
        rider:   { select: { id: true, email: true, phone: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }

    const enriched = enrichOrderWithFees(order, order.customer?.email);
    res.json({ data: { order: enriched }, error: null });
  })
);

// PUT /api/orders/:id/status — Update order status (store, runner, rider, or customer)
router.put(
  "/:id/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ data: null, error: { message: "status is required", code: "VALIDATION_ERROR" } });
    }

    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { 
        items: { include: { product: { include: { store: true } }, variant: true } },
        customer: { select: { email: true } }
      },
    });

    const enriched = enrichOrderWithFees(order, order.customer?.email);

    // Notify everyone in the order room of the status change
    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order: enriched });

    res.json({ data: { order: enriched }, error: null });
  })
);

// POST /api/orders/:id/confirm-tb-keeps — Customer locks in keeps & returns
router.post(
  "/:id/confirm-tb-keeps",
  requireAuth,
  requireRole("CUSTOMER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    
    // Customer confirmed keeps — mark as fully delivered and stop the timer
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: "DELIVERED",
        tryTimerEnd: new Date(0),
      },
      include: {
        items: { include: { product: { include: { store: true } }, variant: true } },
        customer: { select: { email: true } }
      }
    });

    const enriched = enrichOrderWithFees(order, order.customer?.email);

    // Notify everyone
    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order: enriched });

    res.json({ data: { order: enriched }, error: null });
  })
);

// POST /api/orders/:id/request-return — Customer requests T&B return: generates OTP for rider handoff
router.post(
  "/:id/request-return",
  requireAuth,
  requireRole("CUSTOMER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.status !== "TRY_BUY_IN_PROGRESS") {
      return res.status(409).json({ data: null, error: { message: "Order is not in Try & Buy progress state", code: "CONFLICT" } });
    }

    const { selections, returnReason, returnComment } = req.body;

    if (selections) {
      for (const [variantId, choice] of Object.entries(selections)) {
        const isReturned = choice === "RETURN";
        await prisma.orderItem.updateMany({
          where: { orderId: req.params.id, variantId },
          data: {
            isReturned,
            returnReason: isReturned ? returnReason : null,
            returnComment: isReturned ? returnComment : null,
          },
        });
      }
    }

    // Generate customer→rider return OTP; status stays TRY_BUY_IN_PROGRESS until rider verifies
    const returnOtp = String(Math.floor(100000 + Math.random() * 900000));
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { deliveryOtp: returnOtp, tryTimerEnd: new Date(0) },
      include: {
        items: { include: { product: { include: { store: true } }, variant: true } },
        customer: { select: { email: true } },
      },
    });

    const enriched = enrichOrderWithFees(order, order.customer?.email);

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order: enriched });

    res.json({ data: { order: enriched, returnOtp }, error: null });
  })
);

module.exports = router;

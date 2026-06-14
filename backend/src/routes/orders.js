const { Router } = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");

const router = Router();

// GET /api/orders?storeId=X — List orders for a store dashboard (STORE_STAFF)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { storeId } = req.query;

    const { from, to } = req.query;
    const where = storeId
      ? { items: { some: { product: { storeId } } } }
      : {};

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true, variant: true } },
        customer: { select: { id: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      // no take limit when date-filtering (export); default cap of 100 for board view
      ...(from || to ? {} : { take: 100 }),
    });

    res.json({ data: { orders }, error: null });
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
      include: { product: { select: { storeId: true } } },
    });

    if (variants.length !== items.length) {
      return res.status(400).json({
        data: null,
        error: { message: "One or more variants not found", code: "VALIDATION_ERROR" },
      });
    }

    // All items must belong to the same store (single-store order)
    const storeIds = [...new Set(variants.map((v) => v.product.storeId))];
    if (storeIds.length > 1) {
      return res.status(400).json({
        data: null,
        error: { message: "All items must be from the same store", code: "VALIDATION_ERROR" },
      });
    }
    const storeId = storeIds[0];

    const order = await prisma.order.create({
      data: {
        deliveryAddr,
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
        items: { include: { product: true, variant: true } },
      },
    });

    // Emit new_order to the store dashboard and to all connected runners
    const io = req.app.get("io");
    io.to(`store:${storeId}`).emit("new_order", { order });
    io.to("runners").emit("new_order", { order });

    res.status(201).json({ data: { order }, error: null });
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
        items: { include: { product: true, variant: true } },
        customer: { select: { id: true, email: true, phone: true } },
        runner:  { select: { id: true, email: true, phone: true } },
        rider:   { select: { id: true, email: true, phone: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }

    res.json({ data: { order }, error: null });
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
      include: { items: { include: { product: true, variant: true } } },
    });

    // Notify everyone in the order room of the status change
    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });

    res.json({ data: { order }, error: null });
  })
);

module.exports = router;

const { Router } = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { enrichOrderWithFees } = require("../lib/orderHelper");

const router = Router();

const ORDER_INCLUDE = {
  items: { include: { product: { include: { store: true } }, variant: true } },
  customer: { select: { id: true, email: true, phone: true } },
  runner: { select: { id: true, email: true } },
};

// GET /api/rider/orders — Fetch orders in HANDED_TO_RIDER status available to claim (unclaimed)
router.get(
  "/orders",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { status: "HANDED_TO_RIDER", riderId: null },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    const enriched = orders.map((o) => enrichOrderWithFees(o, o.customer?.email));
    res.json({ data: { orders: enriched }, error: null });
  })
);

// GET /api/rider/orders/mine — Fetch active rider orders (OUT_FOR_DELIVERY, ARRIVED, or active Try & Buy DELIVERED)
router.get(
  "/orders/mine",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: {
        riderId: req.user.id,
        OR: [
          { status: { in: ["OUT_FOR_DELIVERY", "ARRIVED", "RETURNING"] } },
          {
            status: "DELIVERED",
            tryTimerEnd: { gte: new Date() },
          },
        ],
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    const enriched = orders.map((o) => enrichOrderWithFees(o, o.customer?.email));
    res.json({ data: { orders: enriched }, error: null });
  })
);

// GET /api/rider/orders/history — Fetch completed deliveries / history
router.get(
  "/orders/history",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: {
        riderId: req.user.id,
        status: { in: ["RETURNED", "REFUNDED", "DELIVERED"] },
        NOT: {
          status: "DELIVERED",
          tryTimerEnd: { gte: new Date() }, // Exclude active Try & Buy from history
        }
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const enriched = orders.map((o) => enrichOrderWithFees(o, o.customer?.email));
    res.json({ data: { orders: enriched }, error: null });
  })
);

// Helper for accepting/claiming an order
const handleAssign = asyncHandler(async (req, res) => {
  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
  }
  if (existing.status !== "HANDED_TO_RIDER") {
    return res.status(409).json({ data: null, error: { message: "Order is not available for delivery", code: "CONFLICT" } });
  }
  if (existing.riderId && existing.riderId !== req.user.id) {
    return res.status(409).json({ data: null, error: { message: "Order already claimed by another rider", code: "CONFLICT" } });
  }

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: "OUT_FOR_DELIVERY", riderId: req.user.id },
    include: ORDER_INCLUDE,
  });

  const enriched = enrichOrderWithFees(order, order.customer?.email);

  const io = req.app.get("io");
  io.to(`order:${order.id}`).emit("order_update", { order: enriched });
  io.to("runners").emit("order_update", { order: enriched });

  res.json({ data: { order: enriched }, error: null });
});

router.post("/orders/:id/accept", requireAuth, requireRole("RIDER"), handleAssign);
router.post("/orders/:id/assign", requireAuth, requireRole("RIDER"), handleAssign);

// POST /api/rider/orders/:id/arrive — Mark order as ARRIVED and generate OTP (if T&B)
router.post(
  "/orders/:id/arrive",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.riderId !== req.user.id) {
      return res.status(403).json({ data: null, error: { message: "Not your order", code: "FORBIDDEN" } });
    }
    if (existing.status !== "OUT_FOR_DELIVERY") {
      return res.status(409).json({ data: null, error: { message: "Order cannot be marked arrived from its current status", code: "CONFLICT" } });
    }

    const isTryBuy = existing.deliveryAddr.includes(" | Try & Buy");
    const otp = isTryBuy ? String(Math.floor(100000 + Math.random() * 900000)) : null;

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "ARRIVED", deliveryOtp: otp },
      include: ORDER_INCLUDE,
    });

    const enriched = enrichOrderWithFees(order, order.customer?.email);

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order: enriched });

    res.json({ data: { order: enriched, otp }, error: null });
  })
);

// POST /api/rider/orders/:id/verify-otp — validates OTP → DELIVERED + starts T&B timer
router.post(
  "/orders/:id/verify-otp",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.riderId !== req.user.id) {
      return res.status(403).json({ data: null, error: { message: "Not your order", code: "FORBIDDEN" } });
    }
    if (existing.status !== "ARRIVED") {
      return res.status(409).json({ data: null, error: { message: "Order is not in ARRIVED state", code: "CONFLICT" } });
    }

    const isTryBuy = existing.deliveryAddr.includes(" | Try & Buy");
    if (isTryBuy) {
      if (!otp || existing.deliveryOtp !== String(otp).trim()) {
        return res.status(400).json({ data: null, error: { message: "Incorrect OTP code", code: "INVALID_OTP" } });
      }
    }

    // 30 seconds for testing — change to 10 * 60 * 1000 for production
    const TNB_DURATION_MS = 30 * 1000;
    const tryTimerEnd = isTryBuy ? new Date(Date.now() + TNB_DURATION_MS) : null;

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "DELIVERED", deliveryOtp: null, tryTimerEnd },
      include: ORDER_INCLUDE,
    });

    const enriched = enrichOrderWithFees(order, order.customer?.email);

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order: enriched });
    if (isTryBuy) {
      io.to(`order:${order.id}`).emit("tnb_timer_start", {
        orderId: order.id,
        tryTimerEnd: tryTimerEnd.toISOString(),
      });
    }

    res.json({ data: { order: enriched }, error: null });
  })
);

// POST /api/rider/orders/:id/initiate-return — DELIVERED → RETURNING
router.post(
  "/orders/:id/initiate-return",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.riderId !== req.user.id) {
      return res.status(403).json({ data: null, error: { message: "Not your order", code: "FORBIDDEN" } });
    }
    if (existing.status !== "DELIVERED") {
      return res.status(409).json({ data: null, error: { message: "Order cannot be returned from its current status", code: "CONFLICT" } });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "RETURNING" },
      include: ORDER_INCLUDE,
    });

    const enriched = enrichOrderWithFees(order, order.customer?.email);

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order: enriched });
    res.json({ data: { order: enriched }, error: null });
  })
);

// POST /api/rider/orders/:id/complete-return — RETURNING → RETURNED
router.post(
  "/orders/:id/complete-return",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.riderId !== req.user.id) {
      return res.status(403).json({ data: null, error: { message: "Not your order", code: "FORBIDDEN" } });
    }
    if (existing.status !== "RETURNING") {
      return res.status(409).json({ data: null, error: { message: "Order is not being returned", code: "CONFLICT" } });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "RETURNED" },
      include: ORDER_INCLUDE,
    });

    const enriched = enrichOrderWithFees(order, order.customer?.email);

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order: enriched });
    res.json({ data: { order: enriched }, error: null });
  })
);

module.exports = router;

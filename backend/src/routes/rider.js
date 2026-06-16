const { Router } = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");

const router = Router();

const ORDER_INCLUDE = {
  items: { include: { product: true, variant: true } },
  customer: { select: { id: true, email: true, phone: true } },
  runner: { select: { id: true, email: true } },
};

// GET /api/rider/orders — HANDED_TO_RIDER orders with no rider yet
router.get(
  "/orders",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { status: "HANDED_TO_RIDER" },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    res.json({ data: { orders }, error: null });
  })
);

// GET /api/rider/orders/mine — rider's active in-flight orders
router.get(
  "/orders/mine",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: {
        riderId: req.user.id,
        status: { in: ["OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED", "RETURNING"] },
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: { orders }, error: null });
  })
);

// GET /api/rider/orders/history
router.get(
  "/orders/history",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: {
        riderId: req.user.id,
        status: { in: ["RETURNED", "REFUNDED"] },
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: { orders }, error: null });
  })
);

// POST /api/rider/orders/:id/accept — HANDED_TO_RIDER → OUT_FOR_DELIVERY
router.post(
  "/orders/:id/accept",
  requireAuth,
  requireRole("RIDER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.status !== "HANDED_TO_RIDER") {
      return res.status(409).json({ data: null, error: { message: "Order is not ready for pickup", code: "CONFLICT" } });
    }
    if (existing.riderId && existing.riderId !== req.user.id) {
      return res.status(409).json({ data: null, error: { message: "Order already claimed by another rider", code: "CONFLICT" } });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "OUT_FOR_DELIVERY", riderId: req.user.id },
      include: ORDER_INCLUDE,
    });

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });
    res.json({ data: { order }, error: null });
  })
);

// POST /api/rider/orders/:id/arrive — OUT_FOR_DELIVERY → ARRIVED, generate delivery OTP
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

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "ARRIVED", deliveryOtp: otp },
      include: ORDER_INCLUDE,
    });

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });

    // OTP returned to rider; in production it would be displayed on the customer app instead
    res.json({ data: { order, otp }, error: null });
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
    if (!existing.deliveryOtp || existing.deliveryOtp !== String(otp)) {
      return res.status(400).json({ data: null, error: { message: "Incorrect OTP", code: "INVALID_OTP" } });
    }

    // 20 seconds for testing — change to 10 * 60 * 1000 for production
    const TNB_DURATION_MS = 20 * 1000;
    const tryTimerEnd = new Date(Date.now() + TNB_DURATION_MS);

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "DELIVERED", deliveryOtp: null, tryTimerEnd },
      include: ORDER_INCLUDE,
    });

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });
    io.to(`order:${order.id}`).emit("tnb_timer_start", {
      orderId: order.id,
      tryTimerEnd: tryTimerEnd.toISOString(),
    });

    res.json({ data: { order }, error: null });
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

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });
    res.json({ data: { order }, error: null });
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

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });
    res.json({ data: { order }, error: null });
  })
);

module.exports = router;

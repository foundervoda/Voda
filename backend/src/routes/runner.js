const { Router } = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");

const router = Router();

const genOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const ORDER_INCLUDE = {
  items: { include: { product: true, variant: true } },
  customer: { select: { id: true, email: true, phone: true } },
};

// GET /api/runner/orders — PENDING orders to claim + RETURNING orders needing return to store
router.get(
  "/orders",
  requireAuth,
  requireRole("RUNNER"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { status: { in: ["PENDING", "RETURNING"] } },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: { orders }, error: null });
  })
);

// GET /api/runner/orders/mine — runner's active in-progress orders
router.get(
  "/orders/mine",
  requireAuth,
  requireRole("RUNNER"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: {
        runnerId: req.user.id,
        status: { in: ["RUNNER_ASSIGNED", "COLLECTED"] },
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: { orders }, error: null });
  })
);

// GET /api/runner/orders/history — runner's completed orders
router.get(
  "/orders/history",
  requireAuth,
  requireRole("RUNNER"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: {
        runnerId: req.user.id,
        status: {
          in: ["HANDED_TO_RIDER", "OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED", "RETURNING", "RETURNED", "REFUNDED"],
        },
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: { orders }, error: null });
  })
);

// POST /api/runner/orders/:id/assign — PENDING → RUNNER_ASSIGNED + store→runner OTP
router.post(
  "/orders/:id/assign",
  requireAuth,
  requireRole("RUNNER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } },
    });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.status !== "PENDING") {
      return res.status(409).json({ data: null, error: { message: "Order is no longer available", code: "CONFLICT" } });
    }

    const otp = genOtp();
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "RUNNER_ASSIGNED", runnerId: req.user.id, deliveryOtp: otp },
      include: ORDER_INCLUDE,
    });

    const storeIds = [...new Set(existing.items.map(item => item.product?.storeId).filter(Boolean))];
    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });
    storeIds.forEach(sid => io.to(`store:${sid}`).emit("order_update", { order }));

    res.json({ data: { order }, error: null });
  })
);

// POST /api/runner/orders/:id/collect — verify store→runner OTP → COLLECTED + generate runner→rider OTP
router.post(
  "/orders/:id/collect",
  requireAuth,
  requireRole("RUNNER"),
  asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.runnerId !== req.user.id) {
      return res.status(403).json({ data: null, error: { message: "Not your order", code: "FORBIDDEN" } });
    }
    if (existing.status !== "RUNNER_ASSIGNED") {
      return res.status(409).json({ data: null, error: { message: "Order cannot be collected from its current status", code: "CONFLICT" } });
    }
    if (!otp || existing.deliveryOtp !== String(otp).trim()) {
      return res.status(400).json({ data: null, error: { message: "Incorrect store OTP", code: "INVALID_OTP" } });
    }

    const nextOtp = genOtp(); // runner→rider OTP
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "COLLECTED", deliveryOtp: nextOtp },
      include: ORDER_INCLUDE,
    });

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });

    res.json({ data: { order }, error: null });
  })
);

// POST /api/runner/orders/:id/handover — COLLECTED → HANDED_TO_RIDER
router.post(
  "/orders/:id/handover",
  requireAuth,
  requireRole("RUNNER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.runnerId !== req.user.id) {
      return res.status(403).json({ data: null, error: { message: "Not your order", code: "FORBIDDEN" } });
    }
    if (existing.status !== "COLLECTED") {
      return res.status(409).json({ data: null, error: { message: "Order cannot be handed over from its current status", code: "CONFLICT" } });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "HANDED_TO_RIDER" },
      include: ORDER_INCLUDE,
    });

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });

    res.json({ data: { order }, error: null });
  })
);

// POST /api/runner/orders/:id/accept-return — verify rider→runner OTP, generate runner→store OTP
router.post(
  "/orders/:id/accept-return",
  requireAuth,
  requireRole("RUNNER"),
  asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } },
    });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.status !== "RETURNING") {
      return res.status(409).json({ data: null, error: { message: "Order is not awaiting return", code: "CONFLICT" } });
    }
    if (!otp || existing.deliveryOtp !== String(otp).trim()) {
      return res.status(400).json({ data: null, error: { message: "Incorrect rider OTP", code: "INVALID_OTP" } });
    }

    const storeOtp = genOtp(); // runner→store OTP
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { deliveryOtp: storeOtp },
      include: ORDER_INCLUDE,
    });

    const storeIds = [...new Set(existing.items.map(item => item.product?.storeId).filter(Boolean))];
    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });
    storeIds.forEach(sid => io.to(`store:${sid}`).emit("order_update", { order }));

    res.json({ data: { order }, error: null });
  })
);

// POST /api/runner/orders/:id/complete-return — verify runner→store OTP → RETURNED
router.post(
  "/orders/:id/complete-return",
  requireAuth,
  requireRole("RUNNER"),
  asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } },
    });
    if (!existing) {
      return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
    }
    if (existing.status !== "RETURNING") {
      return res.status(409).json({ data: null, error: { message: "Order is not awaiting return", code: "CONFLICT" } });
    }
    if (!otp || existing.deliveryOtp !== String(otp).trim()) {
      return res.status(400).json({ data: null, error: { message: "Incorrect store OTP", code: "INVALID_OTP" } });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "RETURNED", deliveryOtp: null },
      include: ORDER_INCLUDE,
    });

    const storeIds = [...new Set(existing.items.map(item => item.product?.storeId).filter(Boolean))];
    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order_update", { order });
    storeIds.forEach(sid => io.to(`store:${sid}`).emit("order_update", { order }));

    res.json({ data: { order }, error: null });
  })
);

module.exports = router;

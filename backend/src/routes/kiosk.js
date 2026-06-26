const { Router } = require("express");
const prisma = require("../lib/prisma");
const { asyncHandler } = require("../middleware/errorHandler");

const router = Router();

const ORDER_INCLUDE = {
  items: {
    include: {
      product: {
        include: { variants: { select: { id: true, size: true, color: true } }, store: true },
      },
      variant: { select: { id: true, size: true, color: true } },
    },
  },
};

// collection → RUNNER_ASSIGNED, return → WITH_RUNNER
const KIOSK_MODE = {
  RUNNER_ASSIGNED: "collection",
  WITH_RUNNER:     "return",
};

function scanCode(variantId) {
  return variantId.replace(/-/g, "").toUpperCase().slice(0, 8);
}

// GET /api/kiosk/orders/:id — no auth, accepts full UUID or short 6-char ID
router.get(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const raw = req.params.id.trim();
    let order = null;

    if (raw.length <= 8 && !raw.includes("-")) {
      const suffix = raw.toLowerCase();
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id FROM "Order" WHERE LOWER(id) LIKE $1 LIMIT 2`,
        `%${suffix}`
      );
      if (rows.length === 0) return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });
      if (rows.length > 1) return res.status(400).json({ data: null, error: { message: "Short ID is ambiguous — use the full Order ID", code: "AMBIGUOUS_ID" } });
      order = await prisma.order.findUnique({ where: { id: rows[0].id }, include: ORDER_INCLUDE });
    } else {
      order = await prisma.order.findUnique({ where: { id: raw }, include: ORDER_INCLUDE });
    }

    if (!order) return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });

    const mode = KIOSK_MODE[order.status];
    if (!mode) {
      return res.status(400).json({
        data: null,
        error: { message: `Order cannot be processed at kiosk. Current status: ${order.status}`, code: "INVALID_STATUS" },
      });
    }

    const safeOrder = {
      id: order.id,
      shortId: order.id.slice(-6).toUpperCase(),
      status: order.status,
      mode,
      deliveryAddr: order.deliveryAddr,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          name: item.product.name,
          image: item.product.images?.[0] ?? null,
          allVariants: item.product.variants.map((v) => ({
            id: v.id,
            size: v.size,
            color: v.color,
            scanCode: scanCode(v.id),
          })),
        },
        variant: {
          id: item.variant.id,
          size: item.variant.size,
          color: item.variant.color,
          scanCode: scanCode(item.variant.id),
        },
      })),
    };

    res.json({ data: { order: safeOrder }, error: null });
  })
);

// POST /api/kiosk/orders/:id/complete — called after all items verified
// collection: sets kioskVerified = true (runner calls /collect on mobile)
// return: WITH_RUNNER → REFUNDED, emit to customer + store
router.post(
  "/orders/:id/complete",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: { include: { store: true } } } } },
    });
    if (!order) return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });

    const mode = KIOSK_MODE[order.status];
    if (!mode) return res.status(400).json({ data: null, error: { message: "Order not in a kiosk stage", code: "INVALID_STATUS" } });

    const io = req.app.get("io");
    const storeId = order.items[0]?.product?.storeId;

    if (mode === "collection") {
      await prisma.order.update({ where: { id: order.id }, data: { kioskVerified: true } });
      res.json({ data: { ok: true }, error: null });
    } else {
      // Return complete: items logged to store, refund finalised
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED", kioskVerified: true },
        include: { items: { include: { product: true, variant: true } }, customer: { select: { id: true, email: true, phone: true } } },
      });
      io.to(`order:${order.id}`).emit("order_update", { order: updated });
      io.to(`user:${order.customerId}`).emit("order_update", { order: updated });
      io.to(`user:${order.customerId}`).emit("refund_complete", { orderId: order.id });
      if (storeId) io.to(`store:${storeId}`).emit("order_update", { order: updated });
      res.json({ data: { ok: true }, error: null });
    }
  })
);

// POST /api/kiosk/orders/:id/mismatch — broadcast alert to store dashboard + runner
router.post(
  "/orders/:id/mismatch",
  asyncHandler(async (req, res) => {
    const { expected, scanned } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: { include: { store: true } } } } },
    });
    if (!order) return res.status(404).json({ data: null, error: { message: "Order not found", code: "NOT_FOUND" } });

    const storeId = order.items[0]?.product?.storeId;
    const payload = {
      orderId: order.id,
      shortId: order.id.slice(-6).toUpperCase(),
      mode: KIOSK_MODE[order.status] ?? "unknown",
      expected,
      scanned,
    };

    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("kiosk_mismatch", payload);
    if (storeId) io.to(`store:${storeId}`).emit("kiosk_mismatch", payload);

    res.json({ data: { ok: true }, error: null });
  })
);

module.exports = router;

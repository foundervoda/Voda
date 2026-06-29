const { Router } = require("express");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const inviteUrl = (token) => `${FRONTEND_URL}/onboard/${token}`;

const router = Router();
const guard = [requireAuth, requireRole("ADMIN")];

// GET /api/admin/overview — platform-wide counts and status breakdown
router.get(
  "/overview",
  ...guard,
  asyncHandler(async (req, res) => {
    const [totalOrders, totalCustomers, totalStores, byStatus] = await Promise.all([
      prisma.order.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.store.count(),
      prisma.order.groupBy({ by: ["status"], _count: { id: true } }),
    ]);

    const statusCounts = Object.fromEntries(byStatus.map((r) => [r.status, r._count.id]));

    res.json({ data: { totalOrders, totalCustomers, totalStores, statusCounts }, error: null });
  })
);

// GET /api/admin/orders?storeId=&customerId=&status= — all orders, filterable
router.get(
  "/orders",
  ...guard,
  asyncHandler(async (req, res) => {
    const { storeId, customerId, status, from, to } = req.query;

    const where = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (storeId) where.items = { some: { product: { storeId } } };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: { include: { store: { select: { id: true, name: true } } } },
            variant: true,
          },
        },
        customer: { select: { id: true, email: true, phone: true } },
        runner: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ data: { orders }, error: null });
  })
);

// GET /api/admin/customers — all customers with order count
router.get(
  "/customers",
  ...guard,
  asyncHandler(async (req, res) => {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: {
        id: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: { select: { customerOrders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: { customers }, error: null });
  })
);

// GET /api/admin/stores — all stores with product + order counts
router.get(
  "/stores",
  ...guard,
  asyncHandler(async (req, res) => {
    const stores = await prisma.store.findMany({
      include: { _count: { select: { products: true, staff: true } } },
      orderBy: { name: "asc" },
    });

    const storesWithOrderCounts = await Promise.all(
      stores.map(async (s) => ({
        ...s,
        orderCount: await prisma.order.count({
          where: { items: { some: { product: { storeId: s.id } } } },
        }),
        inviteUrl: s.inviteToken ? inviteUrl(s.inviteToken) : null,
      }))
    );

    res.json({ data: { stores: storesWithOrderCounts }, error: null });
  })
);

// POST /api/admin/stores — create store skeleton + generate invite link
router.post(
  "/stores",
  ...guard,
  asyncHandler(async (req, res) => {
    const { name, location, pinCode } = req.body;
    if (!name || !location || !pinCode) {
      return res.status(400).json({ data: null, error: { message: "name, location and pinCode are required", code: "VALIDATION_ERROR" } });
    }
    const token = crypto.randomBytes(16).toString("hex");
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const store = await prisma.store.create({
      data: { name, location, pinCode, inviteToken: token, inviteExpiry: expiry, status: "INVITED" },
    });
    res.json({ data: { store, inviteUrl: inviteUrl(token) }, error: null });
  })
);

// POST /api/admin/stores/:id/regenerate-invite — new token, reset to INVITED
router.post(
  "/stores/:id/regenerate-invite",
  ...guard,
  asyncHandler(async (req, res) => {
    const token = crypto.randomBytes(16).toString("hex");
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const store = await prisma.store.update({
      where: { id: req.params.id },
      data: { inviteToken: token, inviteExpiry: expiry, status: "INVITED" },
    });
    res.json({ data: { store, inviteUrl: inviteUrl(token) }, error: null });
  })
);

// PATCH /api/admin/stores/:id/approve — PENDING → ACTIVE
router.patch(
  "/stores/:id/approve",
  ...guard,
  asyncHandler(async (req, res) => {
    const store = await prisma.store.update({ where: { id: req.params.id }, data: { status: "ACTIVE" } });
    console.log(`[STORE APPROVED] ${store.name} (${store.id}) is now live`);
    res.json({ data: { store }, error: null });
  })
);

// PATCH /api/admin/stores/:id/reject — PENDING → REJECTED
router.patch(
  "/stores/:id/reject",
  ...guard,
  asyncHandler(async (req, res) => {
    const store = await prisma.store.update({ where: { id: req.params.id }, data: { status: "REJECTED" } });
    res.json({ data: { store }, error: null });
  })
);

// GET /api/admin/tb/products — List all products with eligibility details
router.get(
  "/tb/products",
  ...guard,
  asyncHandler(async (req, res) => {
    const raw = await prisma.product.findMany({
      include: {
        store: { select: { id: true, name: true, tbOverride: true } }
      },
      orderBy: { name: "asc" }
    });

    // Deduplicate by name+store — prefer rows with explicit tbRequest or tbEligible
    const seen = new Map();
    for (const p of raw) {
      const key = `${p.name}|${p.storeId}`;
      const existing = seen.get(key);
      if (!existing || (p.tbRequest && p.tbRequest !== "NONE") || p.tbEligible !== null) {
        seen.set(key, p);
      }
    }

    res.json({ data: { products: [...seen.values()] }, error: null });
  })
);

// POST /api/admin/tb/product/:id — Toggle product eligibility
router.post(
  "/tb/product/:id",
  ...guard,
  asyncHandler(async (req, res) => {
    const { tbEligible } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { tbEligible },
      include: { store: true }
    });
    res.json({ data: { product }, error: null });
  })
);

// POST /api/admin/tb/store/:id — Set store-level override
router.post(
  "/tb/store/:id",
  ...guard,
  asyncHandler(async (req, res) => {
    const { tbOverride } = req.body; // NONE, ENABLED, DISABLED
    const store = await prisma.store.update({
      where: { id: req.params.id },
      data: { tbOverride }
    });
    res.json({ data: { store }, error: null });
  })
);

// POST /api/admin/tb/bulk-category — Bulk toggle category
router.post(
  "/tb/bulk-category",
  ...guard,
  asyncHandler(async (req, res) => {
    const { category, eligible } = req.body;
    await prisma.product.updateMany({
      where: { category },
      data: { tbEligible: eligible }
    });
    res.json({ data: { success: true }, error: null });
  })
);

// POST /api/admin/tb/request/:id/approve — Approve manager change request
router.post(
  "/tb/request/:id/approve",
  ...guard,
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: { message: "Product not found" } });

    let targetEligibility = null;
    if (existing.tbRequest === "PENDING_ELIGIBLE") targetEligibility = true;
    if (existing.tbRequest === "PENDING_INELIGIBLE") targetEligibility = false;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        tbEligible: targetEligibility !== null ? targetEligibility : existing.tbEligible,
        tbRequest: null
      },
      include: { store: true }
    });
    res.json({ data: { product }, error: null });
  })
);

// POST /api/admin/tb/request/:id/deny — Deny manager change request
router.post(
  "/tb/request/:id/deny",
  ...guard,
  asyncHandler(async (req, res) => {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { tbRequest: null },
      include: { store: true }
    });
    res.json({ data: { product }, error: null });
  })
);

// GET /api/admin/return-analytics — super admin analytics for return patterns
router.get(
  "/return-analytics",
  ...guard,
  asyncHandler(async (req, res) => {
    const returnedItems = await prisma.orderItem.findMany({
      where: { isReturned: true },
      include: {
        product: { include: { store: { select: { name: true } } } },
      },
    });

    // Aggregate by reason, product name, and store name
    const analytics = {};
    for (const item of returnedItems) {
      const reason = item.returnReason || "Unknown Reason";
      const productName = item.product?.name || "Unknown Product";
      const storeName = item.product?.store?.name || "Unknown Store";

      const key = `${reason}|${productName}|${storeName}`;
      if (!analytics[key]) {
        analytics[key] = {
          reason,
          productName,
          storeName,
          count: 0,
        };
      }
      analytics[key].count += item.quantity;
    }

    res.json({ data: { analytics: Object.values(analytics) }, error: null });
  })
);

// GET /api/admin/inventory — all products with variants/stock, category, T&B
router.get(
  "/inventory",
  ...guard,
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      include: {
        store: { select: { id: true, name: true, tbOverride: true } },
        variants: { select: { id: true, size: true, color: true, stock: true } },
      },
      orderBy: [{ store: { name: "asc" } }, { name: "asc" }],
    });

    const rows = products.map((p) => ({
      id: p.id,
      sku: p.id.replace(/-/g, "").toUpperCase().slice(0, 10),
      name: p.name,
      category: p.category,
      store: p.store.name,
      storeId: p.storeId,
      price: Number(p.price),
      totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
      variantCount: p.variants.length,
      variants: p.variants,
      tbEligible: p.tbEligible,
      tbOverride: p.store.tbOverride,
    }));

    res.json({ data: { inventory: rows }, error: null });
  })
);

// POST /api/admin/partners — create a runner or rider
router.post(
  "/partners",
  ...guard,
  asyncHandler(async (req, res) => {
    const { name, phone, loginCode, role } = req.body;
    if (!phone || !loginCode || !role) {
      return res.status(400).json({ data: null, error: { message: "phone, loginCode, and role are required", code: "VALIDATION_ERROR" } });
    }
    if (!["RUNNER", "RIDER"].includes(role)) {
      return res.status(400).json({ data: null, error: { message: "role must be RUNNER or RIDER", code: "VALIDATION_ERROR" } });
    }
    const codePattern = role === "RUNNER" ? /^R\d{3}$/ : /^D\d{3}$/;
    if (!codePattern.test(loginCode.toUpperCase())) {
      return res.status(400).json({
        data: null,
        error: { message: `${role === "RUNNER" ? "Runner" : "Rider"} code must be ${role === "RUNNER" ? "R" : "D"} followed by 3 digits`, code: "VALIDATION_ERROR" },
      });
    }
    const existing = await prisma.user.findUnique({ where: { loginCode: loginCode.toUpperCase() } });
    if (existing) {
      return res.status(409).json({ data: null, error: { message: "That ID code is already taken", code: "CODE_TAKEN" } });
    }
    const user = await prisma.user.create({
      data: {
        phone: phone.trim(),
        loginCode: loginCode.toUpperCase(),
        role,
        email: name?.trim() ? `${loginCode.toLowerCase()}@partner.voda` : null,
      },
      select: { id: true, email: true, phone: true, loginCode: true, role: true, createdAt: true },
    });
    res.status(201).json({ data: { user }, error: null });
  })
);

// GET /api/admin/runners — all runners with loginCode, last active
router.get(
  "/runners",
  ...guard,
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { role: "RUNNER" },
      select: {
        id: true, email: true, phone: true, loginCode: true, createdAt: true,
        runnerOrders: {
          select: { createdAt: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const runners = users.map((u) => ({
      ...u,
      lastActive: u.runnerOrders[0]?.createdAt ?? null,
      totalOrders: undefined,
      runnerOrders: undefined,
    }));
    res.json({ data: { runners }, error: null });
  })
);

// GET /api/admin/riders — all delivery partners with loginCode, last active
router.get(
  "/riders",
  ...guard,
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { role: "RIDER" },
      select: {
        id: true, email: true, phone: true, loginCode: true, createdAt: true,
        riderOrders: {
          select: { createdAt: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const riders = users.map((u) => ({
      ...u,
      lastActive: u.riderOrders[0]?.createdAt ?? null,
      riderOrders: undefined,
    }));
    res.json({ data: { riders }, error: null });
  })
);

// GET /api/admin/runners/:id/orders — order history for a runner
router.get(
  "/runners/:id/orders",
  ...guard,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { runnerId: req.params.id },
      include: {
        items: { include: { product: { select: { name: true, store: { select: { name: true } } } } } },
        customer: { select: { phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ data: { orders }, error: null });
  })
);

// GET /api/admin/riders/:id/orders — order history for a rider
router.get(
  "/riders/:id/orders",
  ...guard,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { riderId: req.params.id },
      include: {
        items: { include: { product: { select: { name: true, store: { select: { name: true } } } } } },
        customer: { select: { phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ data: { orders }, error: null });
  })
);

module.exports = router;

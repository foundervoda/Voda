const { Router } = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");

const router = Router();

// POST /api/tnb/requests — store staff submits a T&B eligibility change request
router.post(
  "/requests",
  requireAuth,
  requireRole("STORE_STAFF"),
  asyncHandler(async (req, res) => {
    const { productId, requestedEligible, note } = req.body;

    if (!productId || requestedEligible === undefined) {
      return res.status(400).json({
        data: null,
        error: { message: "productId and requestedEligible are required", code: "VALIDATION_ERROR" },
      });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.storeId !== req.user.storeId) {
      return res.status(403).json({
        data: null,
        error: { message: "Product not found in your store", code: "FORBIDDEN" },
      });
    }

    const existing = await prisma.tnbRequest.findFirst({
      where: { productId, status: "PENDING" },
    });
    if (existing) {
      return res.status(409).json({
        data: null,
        error: { message: "A pending request already exists for this product", code: "CONFLICT" },
      });
    }

    const request = await prisma.tnbRequest.create({
      data: {
        productId,
        requestedEligible: Boolean(requestedEligible),
        note: note || null,
        requestedById: req.user.id,
      },
      include: { product: { select: { id: true, name: true } } },
    });

    res.status(201).json({ data: { request }, error: null });
  })
);

// GET /api/tnb/requests?status=PENDING — admin views requests
router.get(
  "/requests",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { status } = req.query;

    const requests = await prisma.tnbRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        product: {
          select: { id: true, name: true, tryAndBuyEligible: true, store: { select: { id: true, name: true } } },
        },
        requestedBy: { select: { id: true, email: true } },
        resolvedBy:  { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: { requests }, error: null });
  })
);

// PUT /api/tnb/requests/:id/resolve — admin approves or rejects
router.put(
  "/requests/:id/resolve",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { decision } = req.body;

    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return res.status(400).json({
        data: null,
        error: { message: "decision must be APPROVED or REJECTED", code: "VALIDATION_ERROR" },
      });
    }

    const tnbReq = await prisma.tnbRequest.findUnique({ where: { id: req.params.id } });
    if (!tnbReq) {
      return res.status(404).json({ data: null, error: { message: "Request not found", code: "NOT_FOUND" } });
    }
    if (tnbReq.status !== "PENDING") {
      return res.status(409).json({ data: null, error: { message: "Request already resolved", code: "CONFLICT" } });
    }

    const request = await prisma.$transaction(async (tx) => {
      const updated = await tx.tnbRequest.update({
        where: { id: req.params.id },
        data: { status: decision, resolvedById: req.user.id, resolvedAt: new Date() },
        include: {
          product: { select: { id: true, name: true, tryAndBuyEligible: true } },
        },
      });
      if (decision === "APPROVED") {
        await tx.product.update({
          where: { id: tnbReq.productId },
          data: { tryAndBuyEligible: tnbReq.requestedEligible },
        });
      }
      return updated;
    });

    res.json({ data: { request }, error: null });
  })
);

// ── Admin direct-control routes ───────────────────────────────────────────────

// GET /api/tnb/products — all products with T&B flags + store override context
router.get(
  "/products",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      select: {
        id: true, name: true, category: true, tryAndBuyEligible: true,
        store: { select: { id: true, name: true, tnbOverride: true } },
      },
      orderBy: [{ store: { name: "asc" } }, { category: "asc" }, { name: "asc" }],
    });
    res.json({ data: { products }, error: null });
  })
);

// PUT /api/tnb/products/:id — admin directly toggles a product's T&B flag
router.put(
  "/products/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { eligible } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { tryAndBuyEligible: Boolean(eligible) },
      select: { id: true, name: true, tryAndBuyEligible: true },
    });
    res.json({ data: { product }, error: null });
  })
);

// GET /api/tnb/categories — all categories with defaults + product stats
router.get(
  "/categories",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const [defaults, allProducts] = await Promise.all([
      prisma.tnbCategoryDefault.findMany(),
      prisma.product.findMany({ select: { category: true, tryAndBuyEligible: true } }),
    ]);

    const statsMap = {};
    for (const p of allProducts) {
      if (!statsMap[p.category]) statsMap[p.category] = { total: 0, eligibleCount: 0 };
      statsMap[p.category].total++;
      if (p.tryAndBuyEligible) statsMap[p.category].eligibleCount++;
    }

    const defaultMap = Object.fromEntries(defaults.map((d) => [d.category, d.eligible]));

    const categories = Object.entries(statsMap)
      .map(([category, stats]) => ({
        category,
        defaultEligible: defaultMap[category] ?? null,
        ...stats,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));

    res.json({ data: { categories }, error: null });
  })
);

// PUT /api/tnb/categories/:name — set category default + bulk-update all products in it
router.put(
  "/categories/:name",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const category = decodeURIComponent(req.params.name);
    const { eligible } = req.body;
    const flag = Boolean(eligible);

    await prisma.$transaction([
      prisma.tnbCategoryDefault.upsert({
        where: { category },
        create: { category, eligible: flag },
        update: { eligible: flag },
      }),
      prisma.product.updateMany({ where: { category }, data: { tryAndBuyEligible: flag } }),
    ]);

    res.json({ data: { category, eligible: flag }, error: null });
  })
);

// GET /api/tnb/stores — stores with tnbOverride + T&B product stats
router.get(
  "/stores",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const [stores, products] = await Promise.all([
      prisma.store.findMany({ select: { id: true, name: true, location: true, tnbOverride: true } }),
      prisma.product.findMany({ select: { storeId: true, tryAndBuyEligible: true } }),
    ]);

    const statsMap = {};
    for (const p of products) {
      if (!statsMap[p.storeId]) statsMap[p.storeId] = { total: 0, eligibleCount: 0 };
      statsMap[p.storeId].total++;
      if (p.tryAndBuyEligible) statsMap[p.storeId].eligibleCount++;
    }

    const result = stores.map((s) => ({
      ...s,
      totalProducts:    statsMap[s.id]?.total        ?? 0,
      eligibleProducts: statsMap[s.id]?.eligibleCount ?? 0,
    }));

    res.json({ data: { stores: result }, error: null });
  })
);

// PUT /api/tnb/stores/:id — set store-level T&B override
router.put(
  "/stores/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { override } = req.body; // true | false | null
    const store = await prisma.store.update({
      where: { id: req.params.id },
      data: { tnbOverride: override == null ? null : Boolean(override) },
      select: { id: true, name: true, tnbOverride: true },
    });
    res.json({ data: { store }, error: null });
  })
);

module.exports = router;

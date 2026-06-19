const { Router } = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");

const router = Router();
const guard = [requireAuth, requireRole("STORE_STAFF")];

const CATEGORY_DEFAULTS = { Sneakers: true, Apparel: true };

function resolveEffective(store, product) {
  if (store.tbOverride === "ENABLED")  return { effective: true,  reason: "Store Override: Enabled" };
  if (store.tbOverride === "DISABLED") return { effective: false, reason: "Store Override: Disabled" };
  if (product.tbEligible !== null && product.tbEligible !== undefined)
    return { effective: product.tbEligible, reason: "Product Flag" };
  const cat = CATEGORY_DEFAULTS[product.category] ?? false;
  return { effective: cat, reason: "Category Default" };
}

// GET /api/store/products/tb
router.get(
  "/products/tb",
  ...guard,
  asyncHandler(async (req, res) => {
    const { storeId } = req.user;
    if (!storeId) return res.status(400).json({ error: { message: "No store linked to this account" } });

    const [store, products] = await Promise.all([
      prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, tbOverride: true },
      }),
      prisma.product.findMany({
        where: { storeId },
        select: { id: true, name: true, category: true, tbEligible: true, tbRequest: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const enriched = products.map((p) => ({
      ...p,
      ...resolveEffective(store, p),
    }));

    res.json({ data: { products: enriched, store }, error: null });
  })
);

// POST /api/store/products/:id/tb-request
router.post(
  "/products/:id/tb-request",
  ...guard,
  asyncHandler(async (req, res) => {
    const { storeId } = req.user;
    const { requestType } = req.body; // "PENDING_ELIGIBLE" | "PENDING_INELIGIBLE" | null (cancel)

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, storeId },
    });
    if (!product) return res.status(404).json({ error: { message: "Product not found" } });

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { tbRequest: requestType ?? null },
      select: { id: true, name: true, category: true, tbEligible: true, tbRequest: true },
    });

    res.json({ data: { product: updated }, error: null });
  })
);

module.exports = router;

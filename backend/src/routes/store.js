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

    // Deduplicate by name — prefer rows with an explicit tbRequest or tbEligible set
    const seen = new Map();
    for (const p of products) {
      const existing = seen.get(p.name);
      if (!existing || (p.tbRequest && p.tbRequest !== "NONE") || p.tbEligible !== null) {
        seen.set(p.name, p);
      }
    }

    const enriched = [...seen.values()].map((p) => ({
      ...p,
      ...resolveEffective(store, p),
    }));

    res.json({ data: { products: enriched, store }, error: null });
  })
);

// POST /api/store/products/:id/tb-request
// Applies the request to ALL products with the same name in the store (handles duplicates)
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

    // Update all products with the same name in this store
    await prisma.product.updateMany({
      where: { name: product.name, storeId },
      data: { tbRequest: requestType ?? null },
    });

    const updated = await prisma.product.findFirst({
      where: { id: req.params.id },
      select: { id: true, name: true, category: true, tbEligible: true, tbRequest: true },
    });

    res.json({ data: { product: updated }, error: null });
  })
);

module.exports = router;

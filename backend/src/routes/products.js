const { Router } = require("express");
const prisma = require("../lib/prisma");
const { asyncHandler } = require("../middleware/errorHandler");

const router = Router();

// GET /api/products — list with optional filters: ?trending=true&category=X&storeId=X&q=X
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { trending, category, storeId, q } = req.query;

    const where = {
      ...(trending === "true" && { trending: true }),
      ...(category && { category }),
      ...(storeId && { storeId }),
      ...(q && {
        name: { contains: q, mode: "insensitive" },
      }),
    };

    const products = await prisma.product.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, location: true } },
        variants: true,
      },
      orderBy: [{ trending: "desc" }],
    });

    res.json({ data: { products }, error: null });
  })
);

// GET /api/products/:id — single product with variants and store info
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        store: { select: { id: true, name: true, location: true } },
        variants: true,
      },
    });

    if (!product) {
      return res.status(404).json({ data: null, error: { message: "Product not found", code: "NOT_FOUND" } });
    }

    res.json({ data: { product }, error: null });
  })
);

// PUT /api/products/stock — bulk update variant stock levels
// Body: { updates: [{ variantId, stock }] }
router.put(
  "/stock",
  asyncHandler(async (req, res) => {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ data: null, error: { message: "updates array is required", code: "VALIDATION_ERROR" } });
    }

    const results = await Promise.all(
      updates.map(({ variantId, stock }) =>
        prisma.variant.update({
          where: { id: variantId },
          data: { stock: Math.max(0, parseInt(stock, 10) || 0) },
        })
      )
    );

    res.json({ data: { updated: results.length }, error: null });
  })
);

module.exports = router;

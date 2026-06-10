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
      orderBy: [{ trending: "desc" }, { createdAt: "desc" }],
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

module.exports = router;

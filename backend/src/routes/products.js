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
        store: { select: { id: true, name: true, location: true, tnbOverride: true } },
        variants: true,
        ...(storeId && {
          tnbRequests: {
            where: { status: "PENDING" },
            select: { id: true, requestedEligible: true },
          },
        }),
      },
      orderBy: [{ trending: "desc" }],
    });

    res.json({ data: { products }, error: null });
  })
);

// GET /api/products/stores — list all stores in the mall
router.get(
  "/stores",
  asyncHandler(async (req, res) => {
    const stores = await prisma.store.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ data: { stores }, error: null });
  })
);

// GET /api/products/:id — single product with variants and store info
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        store: { select: { id: true, name: true, location: true, tnbOverride: true } },
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

// POST /api/products/recommend — AI-driven semantic recommendation
// Body: { query: "I want comfortable running shoes" }
router.post(
  "/recommend",
  asyncHandler(async (req, res) => {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ data: null, error: { message: "query is required", code: "VALIDATION_ERROR" } });
    }

    const products = await prisma.product.findMany({
      include: {
        store: { select: { id: true, name: true, location: true } },
      }
    });

    // Semantic Vector Similarity Matching in Memory
    const VOCAB = [
      "sneaker", "shoe", "runner", "footwear", "walk", "court", "trail", "grip", "apex", "nova", "classic", "low", "white", "pro", "run",
      "boot", "hike", "blazer",
      "apparel", "clothing", "wear", "shirt", "trench", "coat", "jacket", "hoodie", "pullover", "pants", "chinos", "shorts", "tee", "t-shirt", "knit", "sweater", "suit", "blazer", "linen", "silk", "cotton", "wool", "cashmere", "premium", "luxe", "active", "training", "compression", "track", "windbreaker", "sport", "comfort", "casual", "smart", "warm", "athletic"
    ];

    const getVector = (text) => {
      const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
      const vec = new Array(VOCAB.length).fill(0);
      words.forEach(w => {
        let word = w;
        if (word === "shoes" || word === "sneakers") word = "sneaker";
        if (word === "boots") word = "boot";
        if (word === "clothes") word = "apparel";
        if (word === "jackets") word = "jacket";
        if (word === "shirts") word = "shirt";

        const idx = VOCAB.indexOf(word);
        if (idx !== -1) {
          vec[idx] += 1;
        }
      });

      const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
      if (magnitude === 0) return vec;
      return vec.map(val => val / magnitude);
    };

    const queryVec = getVector(query);

    const scored = products.map(product => {
      const productText = `${product.name} ${product.category} ${product.store?.name || ""}`;
      const prodVec = getVector(productText);

      let similarity = 0;
      for (let i = 0; i < VOCAB.length; i++) {
        similarity += queryVec[i] * prodVec[i];
      }

      return { product, similarity };
    });

    scored.sort((a, b) => b.similarity - a.similarity);

    const matches = scored.filter(s => s.similarity > 0);
    const results = (matches.length > 0 ? matches : scored).slice(0, 3).map(s => s.product);

    res.json({ data: { products: results }, error: null });
  })
);

// POST /api/products/:id/request-tb — Store manager requests Try & Buy status change
router.post(
  "/:id/request-tb",
  asyncHandler(async (req, res) => {
    const { tbRequest } = req.body; // PENDING_ELIGIBLE, PENDING_INELIGIBLE, NONE
    if (!["PENDING_ELIGIBLE", "PENDING_INELIGIBLE", "NONE"].includes(tbRequest)) {
      return res.status(400).json({ error: { message: "Invalid tbRequest value" } });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { tbRequest },
      include: { store: true }
    });

    res.json({ data: { product }, error: null });
  })
);

module.exports = router;

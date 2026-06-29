const { Router } = require("express");
const prisma = require("../lib/prisma");
const { asyncHandler } = require("../middleware/errorHandler");

const router = Router();

function tokenValid(store) {
  if (!store.inviteToken) return false;
  if (store.status !== "INVITED") return false;
  if (store.inviteExpiry && new Date() > store.inviteExpiry) return false;
  return true;
}

// GET /api/onboard/:token — validate token, return public store info
router.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { inviteToken: req.params.token } });
    if (!store || !tokenValid(store)) {
      return res.status(404).json({ data: null, error: { message: "Invite link is invalid or has expired", code: "INVALID_TOKEN" } });
    }
    res.json({ data: { store: { id: store.id, name: store.name, location: store.location, inviteExpiry: store.inviteExpiry } }, error: null });
  })
);

// POST /api/onboard/:token/verify-pin — confirm the admin-set PIN matches
router.post(
  "/:token/verify-pin",
  asyncHandler(async (req, res) => {
    const { pinCode } = req.body;
    const store = await prisma.store.findUnique({ where: { inviteToken: req.params.token } });
    if (!store || !tokenValid(store)) {
      return res.status(404).json({ data: null, error: { message: "Invite link is invalid or has expired", code: "INVALID_TOKEN" } });
    }
    if (!pinCode || pinCode.trim() !== store.pinCode) {
      return res.status(401).json({ data: null, error: { message: "Incorrect PIN code", code: "INVALID_PIN" } });
    }
    res.json({ data: { ok: true }, error: null });
  })
);

// POST /api/onboard/:token/complete — submit store details + inventory
router.post(
  "/:token/complete",
  asyncHandler(async (req, res) => {
    const { pinCode, name, location, phone, email, category, logoUrl, products = [] } = req.body;
    const store = await prisma.store.findUnique({ where: { inviteToken: req.params.token } });
    if (!store || !tokenValid(store)) {
      return res.status(404).json({ data: null, error: { message: "Invite link is invalid or has expired", code: "INVALID_TOKEN" } });
    }
    if (!pinCode || pinCode.trim() !== store.pinCode) {
      return res.status(401).json({ data: null, error: { message: "Incorrect PIN code", code: "INVALID_PIN" } });
    }
    if (!name || !location || !phone) {
      return res.status(400).json({ data: null, error: { message: "name, location and phone are required", code: "VALIDATION_ERROR" } });
    }

    // Update store details, set PENDING, burn invite token (single-use)
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        name: name.trim(),
        location: location.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        category: category?.trim() || null,
        logoUrl: logoUrl?.trim() || null,
        status: "PENDING",
        inviteToken: null,
        inviteExpiry: null,
      },
    });

    // Create products + variants
    for (const p of products) {
      if (!p.name || !p.price) continue;
      const sizes = (p.sizes || []).filter(Boolean);
      const created = await prisma.product.create({
        data: {
          name: p.name.trim(),
          price: parseFloat(p.price),
          category: p.category || category || "Other",
          images: [],
          tbEligible: p.tbEligible ?? null,
          storeId: updated.id,
        },
      });
      if (sizes.length > 0) {
        await prisma.variant.createMany({
          data: sizes.map((s) => ({ productId: created.id, size: s, stock: 10 })),
        });
      } else {
        await prisma.variant.create({ data: { productId: created.id, size: "One Size", stock: 10 } });
      }
    }

    console.log(`[ONBOARD SUBMITTED] ${updated.name} — awaiting admin approval`);
    res.json({ data: { ok: true, storeName: updated.name }, error: null });
  })
);

module.exports = router;

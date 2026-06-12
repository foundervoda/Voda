const { Router } = require("express");

const router = Router();

// POST /api/dev/fake-order?storeId=X
// Emits a fake new_order to a store's socket room for UI testing.
// Only registered when NODE_ENV !== "production".
router.post("/fake-order", (req, res) => {
  const storeId = req.query.storeId || "dev-store-id";
  const io = req.app.get("io");

  const body = req.body || {};
  const fakeOrder = {
    id: `test-${Date.now()}`,
    status: "PENDING",
    deliveryAddr: body.deliveryAddr || "Gate 3, Upper Level — near the food court",
    etaMinutes: 30,
    createdAt: new Date().toISOString(),
    customer: {
      id: "cust-001",
      email: "testcustomer@voda.app",
      phone: "+254 712 345 678",
    },
    items: body.items || [
      {
        id: `item-${Date.now()}-1`,
        quantity: 2,
        product: { id: "prod-001", name: "Air Max 90" },
        variant: { id: "var-001", size: "UK 9", color: "Black/White" },
      },
      {
        id: `item-${Date.now()}-2`,
        quantity: 1,
        product: { id: "prod-002", name: "Classic Hoodie" },
        variant: { id: "var-002", size: "M", color: "Navy" },
      },
    ],
  };

  io.to(`store:${storeId}`).emit("new_order", { order: fakeOrder });

  res.json({ data: { emittedTo: `store:${storeId}`, order: fakeOrder }, error: null });
});

module.exports = router;

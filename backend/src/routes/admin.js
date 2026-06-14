const { Router } = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");

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
      }))
    );

    res.json({ data: { stores: storesWithOrderCounts }, error: null });
  })
);

module.exports = router;

const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

// Room strategy (Handbook §11):
//   user:{userId}   — personal room, e.g. rider_location_update
//   store:{storeId} — store staff room, e.g. new_order
//   order:{orderId} — order-specific updates, e.g. order_update, try_timer_start
const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    // Client sends its JWT once connected; server joins the user's personal room
    // and auto-joins the store room for STORE_STAFF so new_order arrives immediately
    socket.on("authenticate", async (token) => {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.join(`user:${payload.sub}`);

        if (payload.role === "STORE_STAFF") {
          const user = await prisma.user.findUnique({ where: { id: payload.sub } });
          if (user?.storeId) socket.join(`store:${user.storeId}`);
        }

        if (payload.role === "RUNNER") {
          socket.join("runners");
          // Rejoin active order rooms so order_update events arrive after reconnect
          const activeOrders = await prisma.order.findMany({
            where: { runnerId: payload.sub, status: { in: ["RUNNER_ASSIGNED", "COLLECTED"] } },
            select: { id: true },
          });
          for (const o of activeOrders) socket.join(`order:${o.id}`);
        }

        if (payload.role === "RIDER") {
          const activeOrders = await prisma.order.findMany({
            where: {
              riderId: payload.sub,
              status: { in: ["OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED", "RETURNING"] },
            },
            select: { id: true },
          });
          for (const o of activeOrders) socket.join(`order:${o.id}`);
        }
      } catch (err) {
        socket.emit("auth_error", { message: "Invalid token" });
      }
    });

    socket.on("join_store_room", (storeId) => socket.join(`store:${storeId}`));
    socket.on("join_order_room", (orderId) => socket.join(`order:${orderId}`));

    // Rider relays GPS; server forwards to the order room (customer + rider are both in it)
    socket.on("rider_location", ({ orderId, lat, lng }) => {
      io.to(`order:${orderId}`).emit("rider_location_update", { lat, lng });
    });

    socket.on("disconnect", () => {});
  });
};

module.exports = { registerSocketHandlers };

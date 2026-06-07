const jwt = require("jsonwebtoken");

// Room strategy (Handbook §11):
//   user:{userId}   — personal room, e.g. rider_location_update
//   store:{storeId} — store staff room, e.g. new_order
//   order:{orderId} — order-specific updates, e.g. order_update, try_timer_start
const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    // Client authenticates by sending its JWT once connected
    socket.on("authenticate", (token) => {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.join(`user:${payload.sub}`);
      } catch (err) {
        socket.emit("auth_error", { message: "Invalid token" });
      }
    });

    socket.on("join_store_room", (storeId) => socket.join(`store:${storeId}`));
    socket.on("join_order_room", (orderId) => socket.join(`order:${orderId}`));

    // Rider relays its GPS position; server forwards it to the customer's room
    socket.on("rider_location", ({ orderId, lat, lng }) => {
      io.to(`order:${orderId}`).emit("rider_location_update", { lat, lng });
    });

    socket.on("disconnect", () => {});
  });
};

module.exports = { registerSocketHandlers };

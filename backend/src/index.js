require("dotenv/config");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const orderRoutes = require("./routes/orders");
const productRoutes = require("./routes/products");
const runnerRoutes = require("./routes/runner");
const riderRoutes  = require("./routes/rider");
const adminRoutes  = require("./routes/admin");
const tnbRoutes    = require("./routes/tnb");
const storeRoutes  = require("./routes/store");
const kioskRoutes   = require("./routes/kiosk");
const onboardRoutes = require("./routes/onboard");
const { errorHandler } = require("./middleware/errorHandler");
const { registerSocketHandlers } = require("./sockets");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Make the socket server reachable from route handlers via req.app.get("io")
app.set("io", io);

app.get("/health", (req, res) => res.json({ data: { status: "ok" }, error: null }));

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/store", storeRoutes);

if (process.env.NODE_ENV !== "production") {
  const devRoutes = require("./routes/dev");
  app.use("/api/dev", devRoutes);
}
app.use("/api/runner", runnerRoutes);
app.use("/api/rider",  riderRoutes);
app.use("/api/admin",  adminRoutes);
app.use("/api/tnb",    tnbRoutes);
app.use("/api/kiosk",   kioskRoutes);
app.use("/api/onboard", onboardRoutes);

app.use(errorHandler);

registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;
// API server listening on port (rebase merge complete)
server.listen(PORT, () => console.log(`API server listening on port ${PORT}`));


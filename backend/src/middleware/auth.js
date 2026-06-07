const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

// Decodes the Bearer token, loads the user, and attaches it to req.user
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ data: null, error: { message: "Missing token", code: "UNAUTHENTICATED" } });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      return res.status(401).json({ data: null, error: { message: "User not found", code: "UNAUTHENTICATED" } });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ data: null, error: { message: "Invalid or expired token", code: "UNAUTHENTICATED" } });
  }
};

// Restricts a route to one or more roles, e.g. requireRole("STORE_STAFF")
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ data: null, error: { message: "Forbidden", code: "FORBIDDEN" } });
  }
  next();
};

module.exports = { requireAuth, requireRole };

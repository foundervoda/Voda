const { Router } = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireAuth } = require("../middleware/auth");

const router = Router();

const SALT_ROUNDS = 10;

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

const toPublicUser = ({ id, email, phone, role, storeId, createdAt }) => ({ id, email, phone, role, storeId, createdAt });

// POST /api/auth/register — Body: email, password, phone, role
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, phone, role, storeId } = req.body;

    if (!email || !password || !phone || !role) {
      return res.status(400).json({ data: null, error: { message: "email, password, phone and role are required", code: "VALIDATION_ERROR" } });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ data: null, error: { message: "Email already registered", code: "EMAIL_TAKEN" } });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, phone, role, password: password_hash, ...(storeId && { storeId }) },
    });

    res.status(201).json({ data: { user: toPublicUser(user), token: signToken(user) }, error: null });
  })
);

// POST /api/auth/login — Body: email, password
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user && (await bcrypt.compare(password, user.password));

    if (!valid) {
      return res.status(401).json({ data: null, error: { message: "Invalid email or password", code: "INVALID_CREDENTIALS" } });
    }

    res.json({ data: { user: toPublicUser(user), token: signToken(user) }, error: null });
  })
);

// GET /api/auth/me — returns the current user from the token
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: { user: toPublicUser(req.user) }, error: null });
  })
);

// PUT /api/auth/me — updates the current user's profile details
router.put(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { email, phone, password } = req.body;

    if (email && email !== req.user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ data: null, error: { message: "Email already taken", code: "EMAIL_TAKEN" } });
      }
    }

    const dataToUpdate = {};
    if (email) dataToUpdate.email = email;
    if (phone) dataToUpdate.phone = phone;
    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: dataToUpdate,
    });

    res.json({ data: { user: toPublicUser(updatedUser) }, error: null });
  })
);

module.exports = router;

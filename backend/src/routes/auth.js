const { Router } = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireAuth } = require("../middleware/auth");

const router = Router();
const SALT_ROUNDS = 10;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

const toPublicUser = ({ id, email, phone, role, storeId, createdAt }) =>
  ({ id, email, phone, role, storeId, createdAt });

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/login — email + password (store staff / legacy)
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user && user.password && (await bcrypt.compare(password, user.password));
    if (!valid) {
      return res.status(401).json({ data: null, error: { message: "Invalid email or password", code: "INVALID_CREDENTIALS" } });
    }
    res.json({ data: { user: toPublicUser(user), token: signToken(user) }, error: null });
  })
);

// POST /api/auth/login-code — runner/rider code (R491 / D823)
router.post(
  "/login-code",
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ data: null, error: { message: "code is required", code: "VALIDATION_ERROR" } });

    const user = await prisma.user.findUnique({ where: { loginCode: code.toUpperCase().trim() } });
    if (!user) {
      return res.status(401).json({ data: null, error: { message: "Invalid code", code: "INVALID_CODE" } });
    }
    res.json({ data: { user: toPublicUser(user), token: signToken(user) }, error: null });
  })
);

// POST /api/auth/request-otp — customer phone login; creates account if new
router.post(
  "/request-otp",
  asyncHandler(async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ data: null, error: { message: "phone is required", code: "VALIDATION_ERROR" } });

    const normalised = phone.trim();
    let user = await prisma.user.findFirst({ where: { phone: normalised, role: "CUSTOMER" } });

    const otp = genOtp();
    const otpExpiry = new Date(Date.now() + OTP_TTL_MS);

    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { otp, otpExpiry } });
    } else {
      // Auto-create customer account on first login
      user = await prisma.user.create({
        data: {
          phone: normalised,
          role: "CUSTOMER",
          otp,
          otpExpiry,
        },
      });
    }

    // In production: send SMS here. For dev: log + return in response.
    console.log(`[OTP] ${normalised} → ${otp}`);

    res.json({ data: { sent: true, devOtp: otp }, error: null });
  })
);

// POST /api/auth/verify-otp — customer submits OTP
router.post(
  "/verify-otp",
  asyncHandler(async (req, res) => {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ data: null, error: { message: "phone and otp are required", code: "VALIDATION_ERROR" } });
    }

    const user = await prisma.user.findFirst({ where: { phone: phone.trim(), role: "CUSTOMER" } });
    if (!user || !user.otp || !user.otpExpiry) {
      return res.status(401).json({ data: null, error: { message: "Request a new OTP first", code: "NO_OTP" } });
    }
    if (new Date() > user.otpExpiry) {
      return res.status(401).json({ data: null, error: { message: "OTP expired — request a new one", code: "OTP_EXPIRED" } });
    }
    if (user.otp !== String(otp).trim()) {
      return res.status(401).json({ data: null, error: { message: "Incorrect code", code: "INVALID_OTP" } });
    }

    await prisma.user.update({ where: { id: user.id }, data: { otp: null, otpExpiry: null } });
    res.json({ data: { user: toPublicUser(user), token: signToken(user) }, error: null });
  })
);

// POST /api/auth/register — legacy / admin creation
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, phone, role, storeId } = req.body;
    if (!phone || !role) {
      return res.status(400).json({ data: null, error: { message: "phone and role are required", code: "VALIDATION_ERROR" } });
    }
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ data: null, error: { message: "Email already registered", code: "EMAIL_TAKEN" } });
    }
    const password_hash = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;
    const user = await prisma.user.create({
      data: { email: email || null, phone, role, password: password_hash, ...(storeId && { storeId }) },
    });
    res.status(201).json({ data: { user: toPublicUser(user), token: signToken(user) }, error: null });
  })
);

// GET /api/auth/me
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = toPublicUser(req.user);
    if (user.storeId) {
      const store = await prisma.store.findUnique({ where: { id: user.storeId }, select: { name: true } });
      user.storeName = store?.name ?? null;
    }
    res.json({ data: { user }, error: null });
  })
);

// PUT /api/auth/me
router.put(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { email, phone, password } = req.body;
    if (email && email !== req.user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ data: null, error: { message: "Email already taken", code: "EMAIL_TAKEN" } });
    }
    const dataToUpdate = {};
    if (email) dataToUpdate.email = email;
    if (phone) dataToUpdate.phone = phone;
    if (password) dataToUpdate.password = await bcrypt.hash(password, SALT_ROUNDS);
    const updatedUser = await prisma.user.update({ where: { id: req.user.id }, data: dataToUpdate });
    res.json({ data: { user: toPublicUser(updatedUser) }, error: null });
  })
);

module.exports = router;

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { validateLoginPayload, validateUserPayload } from "../utils/validation.js";

const router = express.Router();

function getEffectiveRoles(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return user.roles.filter(Boolean);
  }

  if (typeof user?.role === "string" && user.role.trim()) {
    return [user.role.trim()];
  }

  return [];
}

router.post("/login", async (req, res) => {
  const validation = validateLoginPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const { phone, password } = validation.value;

  try {
    const result = await query(
      "SELECT id, name, phone, role, roles, password, session_version FROM users WHERE phone = $1 LIMIT 1",
      [phone]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const sessionResult = await query(
      `UPDATE users
          SET session_version = COALESCE(session_version, 0) + 1
        WHERE id = $1
    RETURNING session_version`,
      [user.id]
    );
    const sessionVersion = Number(sessionResult.rows[0]?.session_version || 0);

    const roles = getEffectiveRoles(user);
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        roles,
        session_version: sessionVersion,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        roles,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

router.post("/seed-admin", async (req, res) => {
  const validation = validateUserPayload(
    { ...req.body, role: req.body.role || "admin" },
    { requirePassword: true }
  );

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const { name, phone, password, role, roles } = validation.value;

  try {
    const userCount = await query("SELECT COUNT(*)::int AS total_users FROM users");

    if (userCount.rows[0]?.total_users > 0) {
      return res.status(403).json({ message: "Bootstrap admin creation is no longer available" });
    }

    const existing = await query("SELECT id FROM users WHERE phone = $1 LIMIT 1", [phone]);

    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "User already exists for this phone" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      "INSERT INTO users (name, phone, role, roles, password) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, phone, role, roles",
      [name, phone, role, roles, hashedPassword]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create admin", error: error.message });
  }
});

export default router;

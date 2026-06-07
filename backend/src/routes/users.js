import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validateUserPayload } from "../utils/validation.js";

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

router.get("/", requireRole("admin", "owner", "manager", "operations", "accounts"), async (_req, res) => {
  try {
    const result = await query(
      "SELECT id, name, phone, role, roles FROM users ORDER BY id DESC"
    );

    return res.json(
      result.rows.map((user) => ({
        ...user,
        roles: getEffectiveRoles(user),
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch users", error: error.message });
  }
});

router.post("/", requireRole("admin"), async (req, res) => {
  const validation = validateUserPayload(req.body, { requirePassword: true });

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const { name, phone, password, role, roles } = validation.value;

  try {
    const existing = await query("SELECT id FROM users WHERE phone = $1 LIMIT 1", [phone]);

    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "User already exists for this phone" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (name, phone, role, roles, password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, phone, role, roles`,
      [name, phone, role, roles, hashedPassword]
    );

    return res.status(201).json({
      ...result.rows[0],
      roles: getEffectiveRoles(result.rows[0]),
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to create user", error: error.message });
  }
});

router.put("/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const validation = validateUserPayload(req.body, { requirePassword: false });

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const { name, phone, role, roles, password } = validation.value;

  try {
    const existing = await query(
      "SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1",
      [phone, id]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "Another user already uses this phone number" });
    }

    let result;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      result = await query(
        `UPDATE users
         SET name = $1, phone = $2, role = $3, roles = $4, password = $5
         WHERE id = $6
         RETURNING id, name, phone, role, roles`,
        [name, phone, role, roles, hashedPassword, id]
      );
    } else {
      result = await query(
        `UPDATE users
         SET name = $1, phone = $2, role = $3, roles = $4
         WHERE id = $5
         RETURNING id, name, phone, role, roles`,
        [name, phone, role, roles, id]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      ...result.rows[0],
      roles: getEffectiveRoles(result.rows[0]),
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to update user", error: error.message });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  if (Number(id) === req.user.id) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  try {
    const result = await query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete user", error: error.message });
  }
});

export default router;

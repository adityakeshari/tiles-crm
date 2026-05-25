import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
const DEFAULT_LIST_LIMIT = 200;
const MAX_LIST_LIMIT = 500;

function parseLimit(value, fallback = DEFAULT_LIST_LIMIT) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIST_LIMIT);
}

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPhoneValid(phone) {
  return /^[0-9+\-\s]{7,15}$/.test(phone);
}

function validateSupplierPayload(payload = {}) {
  const name = normalize(payload.name);
  const mobile = normalize(payload.mobile);
  const alt_mobile = normalize(payload.alt_mobile);
  const city = normalize(payload.city);
  const gstin = normalize(payload.gstin);
  const address = normalize(payload.address);
  const category = normalize(payload.category) || "general";
  const status = normalize(payload.status) || "active";
  const remarks = normalize(payload.remarks);

  if (!name) {
    return { ok: false, message: "Supplier name is required" };
  }
  if (!mobile) {
    return { ok: false, message: "Supplier mobile is required" };
  }
  if (!isPhoneValid(mobile)) {
    return { ok: false, message: "Supplier mobile must be 7 to 15 characters" };
  }
  if (alt_mobile && !isPhoneValid(alt_mobile)) {
    return { ok: false, message: "Alternate mobile must be 7 to 15 characters" };
  }
  if (!["active", "inactive"].includes(status)) {
    return { ok: false, message: "Supplier status is invalid" };
  }
  if (gstin && gstin.length > 20) {
    return { ok: false, message: "GSTIN is too long" };
  }

  return {
    ok: true,
    value: { name, mobile, alt_mobile, city, gstin, address, category, status, remarks },
  };
}

// GET /api/suppliers — list (default: active only; ?status=all returns all)
router.get(
  "/",
  requireRole(
    "admin",
    "manager",
    "accounts",
    "operations",
    "operator",
    "reports",
    "inventory"
  ),
  async (req, res) => {
    const limit = parseLimit(req.query.limit);
    const status = normalize(req.query.status);
    const search = normalize(req.query.search);

    const params = [];
    const conds = [];

    if (status === "active" || status === "inactive") {
      params.push(status);
      conds.push(`status = $${params.length}`);
    } else if (!status) {
      conds.push(`status = 'active'`);
    }

    if (search) {
      params.push(`%${search}%`);
      conds.push(
        `(name ILIKE $${params.length} OR mobile ILIKE $${params.length} OR city ILIKE $${params.length})`
      );
    }

    params.push(limit);
    const limitIdx = params.length;
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    try {
      const result = await query(
        `SELECT *
           FROM suppliers
           ${where}
           ORDER BY name ASC, id ASC
           LIMIT $${limitIdx}`,
        params
      );
      return res.json(result.rows);
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Unable to fetch suppliers", error: error.message });
    }
  }
);

router.post(
  "/",
  requireRole("admin", "manager", "accounts", "operations", "operator"),
  async (req, res) => {
    const validation = validateSupplierPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }
    const s = validation.value;

    try {
      const result = await query(
        `INSERT INTO suppliers (
            name, mobile, alt_mobile, city, gstin, address,
            category, status, remarks, created_by, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
          RETURNING *`,
        [
          s.name,
          s.mobile,
          s.alt_mobile,
          s.city,
          s.gstin,
          s.address,
          s.category,
          s.status,
          s.remarks,
          req.user.id,
        ]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error && error.code === "23505") {
        return res
          .status(409)
          .json({ message: "Supplier with same name + mobile already exists" });
      }
      return res
        .status(500)
        .json({ message: "Unable to create supplier", error: error.message });
    }
  }
);

router.put(
  "/:id",
  requireRole("admin", "manager", "accounts", "operations", "operator"),
  async (req, res) => {
    const { id } = req.params;
    const validation = validateSupplierPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }
    const s = validation.value;

    try {
      const result = await query(
        `UPDATE suppliers
            SET name = $1,
                mobile = $2,
                alt_mobile = $3,
                city = $4,
                gstin = $5,
                address = $6,
                category = $7,
                status = $8,
                remarks = $9,
                updated_by = $10,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $11
          RETURNING *`,
        [
          s.name,
          s.mobile,
          s.alt_mobile,
          s.city,
          s.gstin,
          s.address,
          s.category,
          s.status,
          s.remarks,
          req.user.id,
          id,
        ]
      );

      if (!result.rowCount) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      return res.json(result.rows[0]);
    } catch (error) {
      if (error && error.code === "23505") {
        return res
          .status(409)
          .json({ message: "Supplier with same name + mobile already exists" });
      }
      return res
        .status(500)
        .json({ message: "Unable to update supplier", error: error.message });
    }
  }
);

export default router;

import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validatePurchasePayload } from "../utils/validation.js";

const router = express.Router();
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 300;

function parseListLimit(value, fallback = DEFAULT_LIST_LIMIT) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIST_LIMIT);
}

function parseOffset(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

// Read endpoints accessible to staff who legitimately need showroom-level visibility.
router.get(
  "/",
  requireRole("admin", "manager", "accounts", "operations", "operator", "reports"),
  async (req, res) => {
    const limit = parseListLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const from = typeof req.query.from === "string" ? req.query.from.trim() : "";
    const to = typeof req.query.to === "string" ? req.query.to.trim() : "";
    const paymentStatus =
      typeof req.query.payment_status === "string" ? req.query.payment_status.trim() : "";

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(p.supplier_name ILIKE $${params.length} OR p.invoice_number ILIKE $${params.length} OR p.item_name ILIKE $${params.length})`
      );
    }

    if (from && !Number.isNaN(new Date(from).getTime())) {
      params.push(from);
      conditions.push(`p.purchase_date >= $${params.length}::date`);
    }

    if (to && !Number.isNaN(new Date(to).getTime())) {
      params.push(to);
      conditions.push(`p.purchase_date <= $${params.length}::date`);
    }

    if (["pending", "partial", "paid"].includes(paymentStatus)) {
      params.push(paymentStatus);
      conditions.push(`p.payment_status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      params.push(limit);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const [rowsResult, summaryResult] = await Promise.all([
        query(
          `SELECT p.*, u.name AS created_by_name
             FROM purchases p
             LEFT JOIN users u ON u.id = p.created_by
             ${where}
            ORDER BY p.purchase_date DESC, p.id DESC
            LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
          params
        ),
        query(
          `SELECT
              COUNT(*)::int AS total_count,
              COALESCE(SUM(total_amount), 0)::numeric AS total_amount,
              COALESCE(SUM(amount), 0)::numeric AS net_amount,
              COALESCE(SUM(gst_amount), 0)::numeric AS gst_amount,
              COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END), 0)::numeric AS pending_amount,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0)::numeric AS paid_amount
            FROM purchases p
            ${where}`,
          params.slice(0, params.length - 2)
        ),
      ]);

      return res.json({
        purchases: rowsResult.rows,
        summary: summaryResult.rows[0] || {
          total_count: 0,
          total_amount: 0,
          net_amount: 0,
          gst_amount: 0,
          pending_amount: 0,
          paid_amount: 0,
        },
        pagination: { limit, offset, returned: rowsResult.rowCount },
      });
    } catch (error) {
      return res.status(500).json({ message: "Unable to fetch purchases", error: error.message });
    }
  }
);

router.post(
  "/",
  requireRole("admin", "manager", "accounts", "operations", "operator"),
  async (req, res) => {
    const validation = validatePurchasePayload(req.body);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const purchase = validation.value;

    try {
      const result = await query(
        `INSERT INTO purchases (
            supplier_name, supplier_phone, invoice_number, purchase_date,
            business_unit, category, item_name, quantity, unit,
            amount, gst_amount, total_amount, payment_status, remarks,
            created_by, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
          RETURNING *`,
        [
          purchase.supplier_name,
          purchase.supplier_phone,
          purchase.invoice_number,
          purchase.purchase_date,
          purchase.business_unit,
          purchase.category,
          purchase.item_name,
          purchase.quantity,
          purchase.unit,
          purchase.amount,
          purchase.gst_amount,
          purchase.total_amount,
          purchase.payment_status,
          purchase.remarks,
          req.user.id,
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error && error.code === "23505") {
        return res.status(409).json({
          message: "Duplicate purchase entry: same supplier and invoice number already exist",
        });
      }
      return res.status(500).json({ message: "Unable to create purchase", error: error.message });
    }
  }
);

router.put(
  "/:id",
  requireRole("admin", "manager", "accounts", "operations", "operator"),
  async (req, res) => {
    const { id } = req.params;
    const validation = validatePurchasePayload(req.body);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const purchase = validation.value;

    try {
      const result = await query(
        `UPDATE purchases
            SET supplier_name = $1,
                supplier_phone = $2,
                invoice_number = $3,
                purchase_date = $4,
                business_unit = $5,
                category = $6,
                item_name = $7,
                quantity = $8,
                unit = $9,
                amount = $10,
                gst_amount = $11,
                total_amount = $12,
                payment_status = $13,
                remarks = $14,
                updated_by = $15,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $16
          RETURNING *`,
        [
          purchase.supplier_name,
          purchase.supplier_phone,
          purchase.invoice_number,
          purchase.purchase_date,
          purchase.business_unit,
          purchase.category,
          purchase.item_name,
          purchase.quantity,
          purchase.unit,
          purchase.amount,
          purchase.gst_amount,
          purchase.total_amount,
          purchase.payment_status,
          purchase.remarks,
          req.user.id,
          id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Purchase not found" });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      if (error && error.code === "23505") {
        return res.status(409).json({
          message: "Duplicate purchase entry: same supplier and invoice number already exist",
        });
      }
      return res.status(500).json({ message: "Unable to update purchase", error: error.message });
    }
  }
);

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query("DELETE FROM purchases WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete purchase", error: error.message });
  }
});

export default router;

import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validateDealerPayload } from "../utils/validation.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const result = await query(
      `SELECT *
       FROM dealers
       ORDER BY
         CASE category WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END,
         monthly_purchase DESC,
         name ASC`
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch dealers", error: error.message });
  }
});

router.post("/", requireRole("admin", "manager"), async (req, res) => {
  const validation = validateDealerPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const dealer = validation.value;

  try {
    const result = await query(
      `INSERT INTO dealers (
         name, area, phone, monthly_purchase, credit_limit,
         outstanding_payment, commission_percent, category
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        dealer.name,
        dealer.area,
        dealer.phone,
        dealer.monthly_purchase,
        dealer.credit_limit,
        dealer.outstanding_payment,
        dealer.commission_percent,
        dealer.category,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create dealer", error: error.message });
  }
});

router.put("/:id", requireRole("admin", "manager"), async (req, res) => {
  const { id } = req.params;
  const validation = validateDealerPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const dealer = validation.value;

  try {
    const result = await query(
      `UPDATE dealers
       SET
         name = $1,
         area = $2,
         phone = $3,
         monthly_purchase = $4,
         credit_limit = $5,
         outstanding_payment = $6,
         commission_percent = $7,
         category = $8
       WHERE id = $9
       RETURNING *`,
      [
        dealer.name,
        dealer.area,
        dealer.phone,
        dealer.monthly_purchase,
        dealer.credit_limit,
        dealer.outstanding_payment,
        dealer.commission_percent,
        dealer.category,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Dealer not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update dealer", error: error.message });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query("DELETE FROM dealers WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Dealer not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete dealer", error: error.message });
  }
});

export default router;

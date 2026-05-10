import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validateProductPayload } from "../utils/validation.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const [productsResult, summaryResult] = await Promise.all([
      query(
        `SELECT *
         FROM products
         ORDER BY
           CASE status WHEN 'fast_moving' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
           name ASC`
      ),
      query(
        `SELECT
           COUNT(*)::int AS total_products,
           COUNT(*) FILTER (WHERE status = 'fast_moving')::int AS fast_moving_count,
           COUNT(*) FILTER (WHERE status = 'dead_stock')::int AS dead_stock_count,
           COALESCE(SUM(stock_sqft), 0)::int AS total_stock_sqft
         FROM products`
      ),
    ]);

    return res.json({
      products: productsResult.rows,
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch inventory", error: error.message });
  }
});

router.post("/", requireRole("admin", "manager"), async (req, res) => {
  const validation = validateProductPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const product = validation.value;

  try {
    const result = await query(
      `INSERT INTO products (
         name, design_code, business_unit, category, tile_size, finish, stock_sqft, price_per_sqft, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        product.name,
        product.design_code,
        product.business_unit,
        product.category,
        product.tile_size,
        product.finish,
        product.stock_sqft,
        product.price_per_sqft,
        product.status,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create product", error: error.message });
  }
});

router.put("/:id", requireRole("admin", "manager"), async (req, res) => {
  const { id } = req.params;
  const validation = validateProductPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const product = validation.value;

  try {
    const result = await query(
      `UPDATE products
       SET
        name = $1,
        design_code = $2,
        business_unit = $3,
        category = $4,
        tile_size = $5,
        finish = $6,
        stock_sqft = $7,
        price_per_sqft = $8,
        status = $9
       WHERE id = $10
       RETURNING *`,
      [
        product.name,
        product.design_code,
        product.business_unit,
        product.category,
        product.tile_size,
        product.finish,
        product.stock_sqft,
        product.price_per_sqft,
        product.status,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update product", error: error.message });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query("DELETE FROM products WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete product", error: error.message });
  }
});

export default router;

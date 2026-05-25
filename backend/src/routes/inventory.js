import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validateProductPayload } from "../utils/validation.js";

const router = express.Router();
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 300;

function normalizeDuplicateMatchValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function findSimilarProduct(product, excludeId = null) {
  const params = [
    normalizeDuplicateMatchValue(product.name),
    normalizeDuplicateMatchValue(product.company_name),
    normalizeDuplicateMatchValue(product.product_size || product.tile_size),
    normalizeDuplicateMatchValue(product.finish),
  ];

  let sql = `SELECT *
    FROM products
    WHERE LOWER(TRIM(COALESCE(name, ''))) = $1
      AND LOWER(TRIM(COALESCE(company_name, ''))) = $2
      AND LOWER(TRIM(COALESCE(NULLIF(product_size, ''), NULLIF(tile_size, ''), ''))) = $3
      AND LOWER(TRIM(COALESCE(finish, ''))) = $4`;

  if (excludeId != null) {
    sql += " AND id <> $5";
    params.push(excludeId);
  }

  sql += " ORDER BY id ASC LIMIT 1";
  const result = await query(sql, params);
  return result.rows[0] || null;
}

function parseListLimit(value, fallback = DEFAULT_LIST_LIMIT) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIST_LIMIT);
}

router.get("/", async (req, res) => {
  const limit = parseListLimit(req.query.limit);

  try {
    const [productsResult, summaryResult] = await Promise.all([
      query(
        `SELECT *
         FROM products
         ORDER BY
           CASE status WHEN 'fast_moving' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
           name ASC
         LIMIT $1`,
        [limit]
      ),
      query(
        `SELECT
           COUNT(*)::int AS total_products,
           COUNT(*) FILTER (WHERE status = 'fast_moving')::int AS fast_moving_count,
           COUNT(*) FILTER (WHERE status = 'dead_stock')::int AS dead_stock_count,
           COALESCE(SUM(stock_sqft), 0)::int AS total_stock_sqft,
           COUNT(*) FILTER (WHERE company_name = '')::int AS missing_company_count,
           COUNT(*) FILTER (WHERE COALESCE(product_size, '') = '' AND COALESCE(tile_size, '') = '')::int AS missing_size_count,
           COUNT(*) FILTER (WHERE COALESCE(weight_per_box, 0) <= 0 AND COALESCE(weight_per_unit, 0) <= 0)::int AS missing_weight_count,
           COUNT(*) FILTER (
             WHERE COALESCE(purchase_rate, 0) <= 0
               OR COALESCE(landed_cost_per_unit, 0) <= 0
               OR COALESCE(minimum_allowed_rate, 0) <= 0
               OR COALESCE(suggested_selling_rate, 0) <= 0
           )::int AS missing_pricing_count,
           COUNT(*) FILTER (
             WHERE COALESCE(pieces_per_box, 0) <= 0
               OR COALESCE(sqft_per_box, 0) <= 0
           )::int AS missing_packaging_count
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
    const similarProduct = await findSimilarProduct(product);

    if (similarProduct) {
      return res.status(409).json({
        message: "Similar product already exists.",
        existing_product: similarProduct,
      });
    }

    const result = await query(
      `INSERT INTO products (
         name, company_name, design_code, business_unit, category, unit, tile_size, product_size, finish,
         pieces_per_box, sqft_per_box, weight_per_box, weight_per_unit, stock_sqft,
         purchase_rate, price_per_sqft, predefined_rate, today_selling_rate, daily_up_limit_percent, daily_down_limit_percent,
         last_purchase_rate, landed_cost_per_unit, minimum_allowed_rate, suggested_selling_rate,
         operator_discount_cap, manager_discount_cap, owner_discount_cap,
         safety_margin_percent, growth_margin_percent, quotation_validity_days, pricing_lock, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
       RETURNING *`,
      [
        product.name,
        product.company_name,
        product.design_code,
        product.business_unit,
        product.category,
        product.unit,
        product.tile_size,
        product.product_size,
        product.finish,
        product.pieces_per_box,
        product.sqft_per_box,
        product.weight_per_box,
        product.weight_per_unit,
        product.stock_sqft,
        product.purchase_rate,
        product.price_per_sqft,
        product.predefined_rate,
        product.today_selling_rate,
        product.daily_up_limit_percent,
        product.daily_down_limit_percent,
        product.last_purchase_rate,
        product.landed_cost_per_unit,
        product.minimum_allowed_rate,
        product.suggested_selling_rate,
        product.operator_discount_cap,
        product.manager_discount_cap,
        product.owner_discount_cap,
        product.safety_margin_percent,
        product.growth_margin_percent,
        product.quotation_validity_days,
        product.pricing_lock,
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
    const similarProduct = await findSimilarProduct(product, Number(id));

    if (similarProduct) {
      return res.status(409).json({
        message: "Similar product already exists.",
        existing_product: similarProduct,
      });
    }

    const result = await query(
      `UPDATE products
       SET
        name = $1,
        company_name = $2,
        design_code = $3,
        business_unit = $4,
        category = $5,
        unit = $6,
        tile_size = $7,
        product_size = $8,
        finish = $9,
        pieces_per_box = $10,
        sqft_per_box = $11,
        weight_per_box = $12,
        weight_per_unit = $13,
        stock_sqft = $14,
        purchase_rate = $15,
        price_per_sqft = $16,
        predefined_rate = $17,
        today_selling_rate = $18,
        daily_up_limit_percent = $19,
        daily_down_limit_percent = $20,
        last_purchase_rate = $21,
        landed_cost_per_unit = $22,
        minimum_allowed_rate = $23,
        suggested_selling_rate = $24,
        operator_discount_cap = $25,
        manager_discount_cap = $26,
        owner_discount_cap = $27,
        safety_margin_percent = $28,
        growth_margin_percent = $29,
        quotation_validity_days = $30,
        pricing_lock = $31,
        status = $32
       WHERE id = $33
       RETURNING *`,
      [
        product.name,
        product.company_name,
        product.design_code,
        product.business_unit,
        product.category,
        product.unit,
        product.tile_size,
        product.product_size,
        product.finish,
        product.pieces_per_box,
        product.sqft_per_box,
        product.weight_per_box,
        product.weight_per_unit,
        product.stock_sqft,
        product.purchase_rate,
        product.price_per_sqft,
        product.predefined_rate,
        product.today_selling_rate,
        product.daily_up_limit_percent,
        product.daily_down_limit_percent,
        product.last_purchase_rate,
        product.landed_cost_per_unit,
        product.minimum_allowed_rate,
        product.suggested_selling_rate,
        product.operator_discount_cap,
        product.manager_discount_cap,
        product.owner_discount_cap,
        product.safety_margin_percent,
        product.growth_margin_percent,
        product.quotation_validity_days,
        product.pricing_lock,
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

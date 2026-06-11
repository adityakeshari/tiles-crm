import express from "express";
import { query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { validateProductPayload } from "../utils/validation.js";

const router = express.Router();
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 300;

// Validates ":id" route params before they reach SQL. Non-numeric ids
// (e.g. "/inventory/undefined" from a stale frontend state) previously hit
// Postgres as NaN and surfaced as 500s; they are client errors, not server errors.
function parseProductId(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(value).trim()) {
    return null;
  }
  return parsed;
}

function normalizeDuplicateMatchValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function findSimilarProduct(product, excludeId = null) {
  // Stronger duplicate signature: name + company + size + finish + design_code.
  // Design code is added as a tie-breaker: if either side has a design_code,
  // they must match. If both are blank, the rule is skipped so legacy rows
  // without codes can still surface as duplicates.
  const params = [
    normalizeDuplicateMatchValue(product.name),
    normalizeDuplicateMatchValue(product.company_name),
    normalizeDuplicateMatchValue(product.product_size || product.tile_size),
    normalizeDuplicateMatchValue(product.finish),
    normalizeDuplicateMatchValue(product.design_code),
  ];

  let sql = `SELECT *
    FROM products
    WHERE LOWER(TRIM(COALESCE(name, ''))) = $1
      AND LOWER(TRIM(COALESCE(company_name, ''))) = $2
      AND LOWER(TRIM(COALESCE(NULLIF(product_size, ''), NULLIF(tile_size, ''), ''))) = $3
      AND LOWER(TRIM(COALESCE(finish, ''))) = $4
      AND (
        $5 = ''
        OR LOWER(TRIM(COALESCE(design_code, ''))) = ''
        OR LOWER(TRIM(COALESCE(design_code, ''))) = $5
      )`;

  if (excludeId != null) {
    sql += " AND id <> $6";
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

async function getLegacyProductColumnFlags() {
  const result = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'products'
       AND column_name IN ('company', 'brand', 'manufacturer', 'code', 'design', 'item_code', 'size', 'surface', 'type')`
  );

  const columnNames = new Set(result.rows.map((row) => row.column_name));
  return {
    hasCompanyColumn: columnNames.has("company"),
    hasBrandColumn: columnNames.has("brand"),
    hasManufacturerColumn: columnNames.has("manufacturer"),
    hasCodeColumn: columnNames.has("code"),
    hasDesignColumn: columnNames.has("design"),
    hasItemCodeColumn: columnNames.has("item_code"),
    hasSizeColumn: columnNames.has("size"),
    hasSurfaceColumn: columnNames.has("surface"),
    hasTypeColumn: columnNames.has("type"),
  };
}

function buildLegacyColumnExpression(alias, columnName, enabled) {
  return enabled ? `NULLIF(${alias}.${columnName}, '')` : "NULL";
}

// Detects schema pieces the inventory list depends on that arrived in recent
// migrations (035 purchase_item_batches, 041 low_stock_threshold). If a
// deployment's database is behind on migrations, the list degrades gracefully
// instead of returning 500 for the whole inventory module.
async function getInventorySchemaFlags() {
  const [thresholdResult, batchesResult] = await Promise.all([
    query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'products'
         AND column_name = 'low_stock_threshold'`
    ),
    query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'purchase_item_batches'`
    ),
  ]);

  return {
    hasLowStockThresholdColumn: thresholdResult.rows.length > 0,
    hasPurchaseItemBatchesTable: batchesResult.rows.length > 0,
  };
}

function buildStockBoxesExpression(alias) {
  return `CASE
    WHEN COALESCE(${alias}.sqft_per_box, 0) > 0
      THEN ROUND((COALESCE(${alias}.stock_sqft, 0)::numeric / NULLIF(${alias}.sqft_per_box, 0)), 2)
    ELSE COALESCE(${alias}.stock_sqft, 0)::numeric
  END`;
}

function buildLowStockExpression(alias, hasLowStockThresholdColumn = true) {
  const stockBoxesExpression = buildStockBoxesExpression(alias);
  const thresholdExpression = hasLowStockThresholdColumn
    ? `GREATEST(COALESCE(${alias}.low_stock_threshold, 10), 0)`
    : "10";
  return `CASE
    WHEN COALESCE(${alias}.stock_sqft, 0) <= 0 THEN TRUE
    WHEN (${stockBoxesExpression}) <= ${thresholdExpression} THEN TRUE
    ELSE FALSE
  END`;
}

router.get("/options", async (_req, res) => {
  try {
    const {
      hasCompanyColumn,
      hasBrandColumn,
      hasManufacturerColumn,
      hasSizeColumn,
      hasSurfaceColumn,
      hasTypeColumn,
    } = await getLegacyProductColumnFlags();

    const legacyCompanyExpression = buildLegacyColumnExpression("p", "company", hasCompanyColumn);
    const legacyBrandExpression = buildLegacyColumnExpression("p", "brand", hasBrandColumn);
    const legacyManufacturerExpression = buildLegacyColumnExpression("p", "manufacturer", hasManufacturerColumn);
    const legacySizeExpression = buildLegacyColumnExpression("p", "size", hasSizeColumn);
    const legacySurfaceExpression = buildLegacyColumnExpression("p", "surface", hasSurfaceColumn);
    const legacyTypeExpression = buildLegacyColumnExpression("p", "type", hasTypeColumn);

    const [companiesResult, sizesResult, finishesResult] = await Promise.all([
      query(
        `SELECT option_value
         FROM (
           SELECT DISTINCT COALESCE(NULLIF(p.company_name, ''), ${legacyCompanyExpression}, ${legacyBrandExpression}, ${legacyManufacturerExpression}) AS option_value
           FROM products p
         ) option_source
         WHERE COALESCE(option_value, '') <> ''
         ORDER BY option_value ASC
         LIMIT 500`
      ),
      query(
        `SELECT option_value
         FROM (
           SELECT DISTINCT COALESCE(NULLIF(p.product_size, ''), NULLIF(p.tile_size, ''), ${legacySizeExpression}) AS option_value
           FROM products p
         ) option_source
         WHERE COALESCE(option_value, '') <> ''
         ORDER BY option_value ASC
         LIMIT 500`
      ),
      query(
        `SELECT option_value
         FROM (
           SELECT DISTINCT COALESCE(NULLIF(p.finish, ''), ${legacySurfaceExpression}, ${legacyTypeExpression}) AS option_value
           FROM products p
         ) option_source
         WHERE COALESCE(option_value, '') <> ''
         ORDER BY option_value ASC
         LIMIT 500`
      ),
    ]);

    return res.json({
      companies: companiesResult.rows.map((row) => row.option_value).filter(Boolean),
      sizes: sizesResult.rows.map((row) => row.option_value).filter(Boolean),
      finishes: finishesResult.rows.map((row) => row.option_value).filter(Boolean),
    });
  } catch (error) {
    console.error("[inventory] GET /options failed:", error);
    return res.status(500).json({ message: "Unable to fetch inventory options", error: error.message });
  }
});

router.get("/", async (req, res) => {
  const limit = parseListLimit(req.query.limit);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  try {
    const [
      {
        hasCompanyColumn,
        hasBrandColumn,
        hasManufacturerColumn,
        hasCodeColumn,
        hasDesignColumn,
        hasItemCodeColumn,
        hasSizeColumn,
        hasSurfaceColumn,
        hasTypeColumn,
      },
      { hasLowStockThresholdColumn, hasPurchaseItemBatchesTable },
    ] = await Promise.all([getLegacyProductColumnFlags(), getInventorySchemaFlags()]);
    const legacyCompanyExpression = buildLegacyColumnExpression("p", "company", hasCompanyColumn);
    const legacyBrandExpression = buildLegacyColumnExpression("p", "brand", hasBrandColumn);
    const legacyManufacturerExpression = buildLegacyColumnExpression("p", "manufacturer", hasManufacturerColumn);
    const legacyCodeExpression = buildLegacyColumnExpression("p", "code", hasCodeColumn);
    const legacyDesignExpression = buildLegacyColumnExpression("p", "design", hasDesignColumn);
    const legacyItemCodeExpression = buildLegacyColumnExpression("p", "item_code", hasItemCodeColumn);
    const legacySizeExpression = buildLegacyColumnExpression("p", "size", hasSizeColumn);
    const legacySurfaceExpression = buildLegacyColumnExpression("p", "surface", hasSurfaceColumn);
    const legacyTypeExpression = buildLegacyColumnExpression("p", "type", hasTypeColumn);
    const stockBoxesExpression = buildStockBoxesExpression("p");
    const lowStockExpression = buildLowStockExpression("p", hasLowStockThresholdColumn);
    const lowStockThresholdSelect = hasLowStockThresholdColumn
      ? "COALESCE(p.low_stock_threshold, 10)::int"
      : "10::int";
    const latestBatchJoin = hasPurchaseItemBatchesTable
      ? `LEFT JOIN LATERAL (
             SELECT pb.batch_no
             FROM purchases purchase_rows
             JOIN purchase_item_batches pb ON pb.purchase_id = purchase_rows.id
             WHERE purchase_rows.product_id = p.id
               AND COALESCE(pb.batch_no, '') <> ''
             ORDER BY COALESCE(purchase_rows.delivery_date, purchase_rows.purchase_date) DESC, purchase_rows.id DESC
             LIMIT 1
           ) latest_purchase ON TRUE`
      : "";
    const latestBatchSelect = hasPurchaseItemBatchesTable ? "latest_purchase.batch_no" : "NULL";
    const summaryLegacyCompanyExpression = hasCompanyColumn ? "NULLIF(company, '')" : "NULL";
    const summaryLegacyBrandExpression = hasBrandColumn ? "NULLIF(brand, '')" : "NULL";
    const summaryLegacyManufacturerExpression = hasManufacturerColumn ? "NULLIF(manufacturer, '')" : "NULL";
    const searchClause = search
      ? `WHERE (
           name ILIKE $2
           OR company_name ILIKE $2
           OR product_size ILIKE $2
           OR tile_size ILIKE $2
           OR design_code ILIKE $2
           OR finish ILIKE $2
           OR COALESCE(category, '') ILIKE $2
         )`
      : "";
    const productsParams = search ? [limit, `%${search}%`] : [limit];

    const [productsResult, summaryResult] = await Promise.all([
      // Product list is the critical payload; the summary references newer
      // pricing/packaging columns, so its failure is logged but non-fatal.
      query(
        `SELECT *
         FROM (
           SELECT
             p.*,
             COALESCE(NULLIF(p.company_name, ''), ${legacyCompanyExpression}, ${legacyBrandExpression}, ${legacyManufacturerExpression}, 'Company missing') AS company_name,
             ${legacyCompanyExpression} AS legacy_company,
             COALESCE(NULLIF(p.product_size, ''), NULLIF(p.tile_size, ''), ${legacySizeExpression}, 'Size missing') AS product_size,
             COALESCE(NULLIF(p.tile_size, ''), NULLIF(p.product_size, ''), ${legacySizeExpression}, '') AS tile_size,
             COALESCE(NULLIF(p.design_code, ''), ${legacyCodeExpression}, ${legacyDesignExpression}, ${legacyItemCodeExpression}, '') AS design_code,
             ${legacyCodeExpression} AS legacy_code,
             COALESCE(NULLIF(p.finish, ''), ${legacySurfaceExpression}, ${legacyTypeExpression}, '') AS finish,
             ${lowStockThresholdSelect} AS low_stock_threshold,
             ${stockBoxesExpression} AS stock_boxes,
             ${lowStockExpression} AS is_low_stock,
             ${latestBatchSelect} AS latest_batch_no
           FROM products p
           ${latestBatchJoin}
         ) inventory_products
         ${searchClause}
         ORDER BY
           CASE status WHEN 'fast_moving' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
           name ASC
         LIMIT $1`,
        productsParams
      ),
      query(
        `SELECT
           COUNT(*)::int AS total_products,
           COUNT(*) FILTER (WHERE status = 'fast_moving')::int AS fast_moving_count,
           COUNT(*) FILTER (WHERE status = 'dead_stock')::int AS dead_stock_count,
           COUNT(*) FILTER (WHERE ${lowStockExpression})::int AS low_stock_count,
           COALESCE(SUM(stock_sqft), 0)::int AS total_stock_sqft,
           COUNT(*) FILTER (WHERE COALESCE(NULLIF(company_name, ''), ${summaryLegacyCompanyExpression}, ${summaryLegacyBrandExpression}, ${summaryLegacyManufacturerExpression}) IS NULL)::int AS missing_company_count,
           COUNT(*) FILTER (WHERE COALESCE(NULLIF(product_size, ''), NULLIF(tile_size, ''), ${hasSizeColumn ? "NULLIF(size, '')" : "NULL"}) IS NULL)::int AS missing_size_count,
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
      ).catch((summaryError) => {
        console.error("[inventory] summary query failed (non-fatal):", summaryError);
        return { rows: [null] };
      }),
    ]);

    return res.json({
      products: productsResult.rows,
      summary: summaryResult.rows[0] || null,
    });
  } catch (error) {
    // Logged so process managers (pm2) capture the real failure; previously the
    // error only existed in the HTTP response body and the server log stayed empty.
    console.error("[inventory] GET / failed:", error);
    return res.status(500).json({ message: "Unable to fetch inventory", error: error.message });
  }
});

// Admin-only debug endpoint to investigate "Already exists" reports
// where the product is not visible in the regular paginated list.
router.get("/debug", requireRole("admin", "manager"), async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (!search) {
    return res.status(400).json({ message: "search query is required" });
  }
  try {
    const result = await query(
      `SELECT id, name, company_name, product_size, tile_size, finish,
              design_code, stock_sqft, status, created_at
         FROM products
        WHERE name ILIKE $1
           OR company_name ILIKE $1
           OR product_size ILIKE $1
           OR tile_size ILIKE $1
           OR design_code ILIKE $1
           OR finish ILIKE $1
        ORDER BY id ASC
        LIMIT 200`,
      [`%${search}%`]
    );
    return res.json({
      total_matches: result.rowCount,
      matches: result.rows,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Unable to run inventory debug search", error: error.message });
  }
});

router.post("/", requireRole("admin", "manager", "accounts", "operations", "operator"), async (req, res) => {
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
         pieces_per_box, sqft_per_box, weight_per_box, weight_per_unit, stock_sqft, low_stock_threshold,
         purchase_rate, price_per_sqft, predefined_rate, today_selling_rate, daily_up_limit_percent, daily_down_limit_percent,
         last_purchase_rate, landed_cost_per_unit, minimum_allowed_rate, suggested_selling_rate,
         operator_discount_cap, manager_discount_cap, owner_discount_cap,
         safety_margin_percent, growth_margin_percent, quotation_validity_days, pricing_lock, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
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
        product.low_stock_threshold,
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
    console.error("[inventory] POST / failed:", error);
    return res.status(500).json({ message: "Unable to create product", error: error.message });
  }
});

router.put("/:id", requireRole("admin", "manager"), async (req, res) => {
  const id = parseProductId(req.params.id);

  if (id === null) {
    return res.status(400).json({ message: "Product id is invalid" });
  }

  const validation = validateProductPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const product = validation.value;

  try {
    const similarProduct = await findSimilarProduct(product, id);

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
        low_stock_threshold = $15,
        purchase_rate = $16,
        price_per_sqft = $17,
        predefined_rate = $18,
        today_selling_rate = $19,
        daily_up_limit_percent = $20,
        daily_down_limit_percent = $21,
        last_purchase_rate = $22,
        landed_cost_per_unit = $23,
        minimum_allowed_rate = $24,
        suggested_selling_rate = $25,
        operator_discount_cap = $26,
        manager_discount_cap = $27,
        owner_discount_cap = $28,
        safety_margin_percent = $29,
        growth_margin_percent = $30,
        quotation_validity_days = $31,
        pricing_lock = $32,
        status = $33
       WHERE id = $34
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
        product.low_stock_threshold,
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
    console.error("[inventory] PUT /:id failed:", error);
    return res.status(500).json({ message: "Unable to update product", error: error.message });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const id = parseProductId(req.params.id);

  if (id === null) {
    return res.status(400).json({ message: "Product id is invalid" });
  }

  try {
    const result = await query("DELETE FROM products WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("[inventory] DELETE /:id failed:", error);
    return res.status(500).json({ message: "Unable to delete product", error: error.message });
  }
});

export default router;


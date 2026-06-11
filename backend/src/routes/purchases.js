import express from "express";
import { pool, query } from "../db.js";
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

function roundRate(value) {
  return Number(Number(value || 0).toFixed(2));
}

function createProductMatchError(itemName, businessUnit, productIds) {
  const error = new Error(
    `Multiple products match "${itemName}" for business unit "${businessUnit}". Please fix product mapping before continuing.`
  );
  error.code = "PRODUCT_MATCH_AMBIGUOUS";
  error.meta = { itemName, businessUnit, productIds };
  return error;
}

function buildPurchaseDuplicateMessage() {
  return "Duplicate purchase item merged: same supplier, invoice, product, batch, rate, and GST were combined into one row.";
}

function buildPurchaseInvoiceGroups(rows) {
  const grouped = new Map();

  (rows || []).forEach((row) => {
    const key = `${row.supplier_id || "unknown"}::${row.invoice_number || ""}::${String(row.purchase_date || "").slice(0, 10)}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        group_key: key,
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        supplier_phone: row.supplier_phone,
        invoice_number: row.invoice_number,
        purchase_date: row.purchase_date,
        payment_status: row.payment_status || "pending",
        total_quantity: 0,
        total_taxable_amount: 0,
        gst_total: 0,
        grand_total: 0,
        item_count: 0,
        item_names: [],
        items: [],
      });
    }

    const group = grouped.get(key);
    group.total_quantity += Number(row.quantity || 0);
    group.total_taxable_amount += Number(row.amount || 0);
    group.gst_total += Number(row.gst_amount || 0);
    group.grand_total += Number(row.total_amount || 0);
    group.item_count += 1;
    if (row.item_name) {
      group.item_names.push(row.item_name);
    }
    group.items.push(row);
  });

  return [...grouped.values()].map((group) => ({
    ...group,
    item_names: [...new Set(group.item_names)].filter(Boolean),
    item_summary: `${group.item_count} item${group.item_count === 1 ? "" : "s"} - ${[...new Set(group.item_names)].filter(Boolean).slice(0, 2).join(", ")}`,
  }));
}

function getPurchaseUnitRate(purchase) {
  const quantity = Number(purchase?.quantity || 0);
  const amount = Number(purchase?.amount || 0);
  if (quantity > 0) {
    return roundRate(amount / quantity);
  }
  return roundRate(amount);
}

function classifyRateDifference(currentRate, averageRate) {
  const current = Number(currentRate || 0);
  const average = Number(averageRate || 0);

  if (!(current > 0) || !(average > 0)) {
    return {
      difference_amount: 0,
      difference_percentage: 0,
      status: "normal",
      approval_required: false,
    };
  }

  const differenceAmount = roundRate(current - average);
  const differencePercentage = roundRate((differenceAmount / average) * 100);

  if (differencePercentage > 8) {
    return {
      difference_amount: differenceAmount,
      difference_percentage: differencePercentage,
      status: "approval_required",
      approval_required: true,
    };
  }

  if (differencePercentage > 3) {
    return {
      difference_amount: differenceAmount,
      difference_percentage: differencePercentage,
      status: "review",
      approval_required: false,
    };
  }

  return {
    difference_amount: differenceAmount,
    difference_percentage: differencePercentage,
    status: "normal",
    approval_required: false,
  };
}

function buildTrend(lastFiveRates) {
  if (!Array.isArray(lastFiveRates) || lastFiveRates.length < 2) {
    return "stable";
  }

  const chronological = [...lastFiveRates].reverse();
  const start = Number(chronological[0]?.rate || 0);
  const end = Number(chronological[chronological.length - 1]?.rate || 0);

  if (!(start > 0) || !(end > 0)) {
    return "stable";
  }

  const deltaPercent = ((end - start) / start) * 100;

  if (deltaPercent >= 2) {
    return "rising";
  }

  if (deltaPercent <= -2) {
    return "falling";
  }

  return "stable";
}

async function resolveInventoryProduct(client, purchase) {
  const itemName = typeof purchase.item_name === "string" ? purchase.item_name.trim() : "";

  if (!itemName) {
    return null;
  }
  const businessUnit = purchase.business_unit || "tiles";
  const productResult = await client.query(
    `SELECT id, business_unit
     FROM products
     WHERE LOWER(name) = LOWER($1)
       AND business_unit IN ($2, 'both')
     ORDER BY
       CASE
         WHEN business_unit = $2 THEN 0
         WHEN business_unit = 'both' THEN 1
         ELSE 2
       END,
       id ASC`,
    [itemName, businessUnit]
  );

  if (!productResult.rowCount) {
    return null;
  }

  const exactMatches = productResult.rows.filter((row) => row.business_unit === businessUnit);
  if (exactMatches.length > 1) {
    process.stderr.write(
      `[purchase-inventory-match] ambiguous exact match for ${itemName} (${businessUnit}) -> ${exactMatches.map((row) => row.id).join(",")}\n`
    );
    throw createProductMatchError(itemName, businessUnit, exactMatches.map((row) => row.id));
  }

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const fallbackMatches = productResult.rows.filter((row) => row.business_unit === "both");
  if (fallbackMatches.length > 1) {
    process.stderr.write(
      `[purchase-inventory-match] ambiguous fallback match for ${itemName} (${businessUnit}) -> ${fallbackMatches.map((row) => row.id).join(",")}\n`
    );
    throw createProductMatchError(itemName, businessUnit, fallbackMatches.map((row) => row.id));
  }

  return fallbackMatches[0] || null;
}

async function syncPurchaseInventory(client, purchase, direction) {
  const quantity = Math.round(Number(purchase.quantity || 0));
  if (!quantity) {
    return;
  }

  const product = await resolveInventoryProduct(client, purchase);
  if (!product) {
    return;
  }

  await client.query(
    `UPDATE products
     SET stock_sqft = GREATEST(COALESCE(stock_sqft, 0) + $1, 0)
     WHERE id = $2`,
    [direction * quantity, product.id]
  );
}

// Read endpoints accessible to staff who legitimately need showroom-level visibility.
router.get(
  "/by-truck",
  requireRole("admin", "manager", "accounts", "operations", "operator", "reports", "inventory"),
  async (req, res) => {
    const truckNumber = typeof req.query.truck_number === "string" ? req.query.truck_number.trim() : "";
    const deliveryDate = typeof req.query.delivery_date === "string" ? req.query.delivery_date.trim() : "";

    if (!truckNumber || !deliveryDate || Number.isNaN(new Date(deliveryDate).getTime())) {
      return res.status(400).json({ message: "truck_number and delivery_date are required" });
    }

    try {
      const result = await query(
        `SELECT
            p.id,
            p.supplier_id,
            p.product_id,
            p.supplier_name,
            p.supplier_phone,
            p.invoice_number,
            p.purchase_date,
            p.delivery_date,
            p.truck_number,
            pb.batch_no,
            p.business_unit,
            p.category,
            p.item_name,
            p.quantity,
            p.unit,
            p.amount,
            p.gst_amount,
            p.total_amount,
            pr.company_name,
            pr.product_size,
            pr.pieces_per_box,
            pr.sqft_per_box,
            pr.weight_per_box,
            pr.weight_per_unit,
            pr.last_purchase_rate
         FROM purchases p
         LEFT JOIN purchase_item_batches pb ON pb.purchase_id = p.id
         LEFT JOIN products pr ON pr.id = p.product_id
         WHERE LOWER(TRIM(p.truck_number)) = LOWER(TRIM($1))
           AND p.delivery_date = $2::date
         ORDER BY p.supplier_name ASC, p.invoice_number ASC, p.id ASC`,
        [truckNumber, deliveryDate]
      );

      const groupedMap = new Map();
      result.rows.forEach((row) => {
        const groupKey = `${row.supplier_id || "unknown"}::${row.invoice_number || ""}`;
        if (!groupedMap.has(groupKey)) {
          groupedMap.set(groupKey, {
            supplier_id: row.supplier_id,
            supplier_name: row.supplier_name,
            supplier_phone: row.supplier_phone,
            invoice_number: row.invoice_number,
            purchase_date: row.purchase_date,
            delivery_date: row.delivery_date,
            truck_number: row.truck_number,
            total_amount: 0,
            items: [],
          });
        }
        const group = groupedMap.get(groupKey);
        group.total_amount += Number(row.total_amount || 0);
        group.items.push(row);
      });

      return res.json({
        truck_number: truckNumber,
        delivery_date: deliveryDate,
        bills: [...groupedMap.values()],
      });
    } catch (error) {
      return res.status(500).json({ message: "Unable to fetch linked purchase bills", error: error.message });
    }
  }
);

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
        `(p.supplier_name ILIKE $${params.length} OR p.invoice_number ILIKE $${params.length} OR p.item_name ILIKE $${params.length} OR COALESCE(pb.batch_no, '') ILIKE $${params.length})`
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
          `SELECT p.*, pb.batch_no, u.name AS created_by_name
             FROM purchases p
             LEFT JOIN purchase_item_batches pb ON pb.purchase_id = p.id
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
            LEFT JOIN purchase_item_batches pb ON pb.purchase_id = p.id
            ${where}`,
          params.slice(0, params.length - 2)
        ),
      ]);

      const invoiceGroups = buildPurchaseInvoiceGroups(rowsResult.rows);

      return res.json({
        purchases: rowsResult.rows,
        invoices: invoiceGroups,
        summary: summaryResult.rows[0] || {
          total_count: 0,
          total_amount: 0,
          net_amount: 0,
          gst_amount: 0,
          pending_amount: 0,
          paid_amount: 0,
        },
        pagination: { limit, offset, returned: rowsResult.rowCount, invoice_count: invoiceGroups.length },
      });
    } catch (error) {
      return res.status(500).json({ message: "Unable to fetch purchases", error: error.message });
    }
  }
);

router.get(
  "/product-intelligence/:productId",
  requireRole("admin", "manager", "accounts", "operations", "operator", "reports", "inventory"),
  async (req, res) => {
    const productId = Number.parseInt(req.params.productId, 10);
    const currentRate = Number(req.query.current_rate ?? 0);

    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ message: "Product id is invalid" });
    }

    try {
      const productResult = await query(
        `SELECT id, name, business_unit, category, unit
         FROM products
         WHERE id = $1
         LIMIT 1`,
        [productId]
      );

      if (!productResult.rowCount) {
        return res.status(404).json({ message: "Product not found" });
      }

      const product = productResult.rows[0];
      const productName = typeof product.name === "string" ? product.name.trim() : "";
      const businessUnit = product.business_unit || "tiles";

      const [purchaseEntryResult, costingResult] = await Promise.all([
        query(
          `SELECT
             p.purchase_date AS activity_date,
             p.supplier_name,
             p.item_name,
             p.quantity::numeric AS quantity,
             CASE
               WHEN COALESCE(p.quantity, 0) > 0 THEN ROUND((COALESCE(p.amount, 0) / NULLIF(p.quantity, 0))::numeric, 2)
               ELSE 0
             END AS rate,
             'purchase_entry' AS source
           FROM purchases p
           WHERE LOWER(TRIM(p.item_name)) = LOWER(TRIM($1))
             AND (p.business_unit = $2 OR p.business_unit = 'both' OR $2 = 'both')
             AND COALESCE(p.quantity, 0) > 0
           ORDER BY p.purchase_date DESC, p.id DESC
           LIMIT 50`,
          [productName, businessUnit]
        ),
        query(
          `SELECT
             COALESCE(l.arrival_date, l.created_at::date) AS activity_date,
             s.supplier_name,
             i.item_name,
             COALESCE(i.net_usable_quantity, i.quantity, 0)::numeric AS quantity,
             ROUND(COALESCE(i.basic_purchase_rate, 0)::numeric, 2) AS rate,
             'purchase_costing' AS source
           FROM purchase_lot_items i
           JOIN purchase_lot_suppliers s ON s.id = i.supplier_id
           JOIN purchase_lots l ON l.id = i.lot_id
           WHERE (i.product_id = $1 OR LOWER(TRIM(i.item_name)) = LOWER(TRIM($2)))
             AND l.status <> 'cancelled'
             AND COALESCE(i.basic_purchase_rate, 0) > 0
           ORDER BY COALESCE(l.arrival_date, l.created_at::date) DESC, i.id DESC
           LIMIT 50`,
          [productId, productName]
        ),
      ]);

      const history = [...purchaseEntryResult.rows, ...costingResult.rows]
        .map((row) => ({
          purchase_date: row.activity_date,
          supplier_name: row.supplier_name || "",
          item_name: row.item_name || productName,
          quantity: Number(row.quantity || 0),
          rate: roundRate(row.rate),
          source: row.source,
        }))
        .filter((row) => row.rate > 0)
        .sort((left, right) => {
          const leftTime = new Date(left.purchase_date || 0).getTime();
          const rightTime = new Date(right.purchase_date || 0).getTime();
          return rightTime - leftTime;
        });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const recentWindow = history.filter((row) => {
        const time = new Date(row.purchase_date || 0).getTime();
        return Number.isFinite(time) && time >= cutoffDate.getTime();
      });

      const averageWindow = recentWindow.length ? recentWindow : history;
      const average30DayRate = averageWindow.length
        ? roundRate(
            averageWindow.reduce((sum, row) => sum + Number(row.rate || 0), 0) / averageWindow.length
          )
        : 0;
      const minRate = averageWindow.length
        ? roundRate(Math.min(...averageWindow.map((row) => Number(row.rate || 0))))
        : 0;
      const maxRate = averageWindow.length
        ? roundRate(Math.max(...averageWindow.map((row) => Number(row.rate || 0))))
        : 0;

      const supplierMap = new Map();
      history.forEach((row) => {
        const supplierName = row.supplier_name || "Unknown supplier";
        if (!supplierMap.has(supplierName)) {
          supplierMap.set(supplierName, {
            supplier_name: supplierName,
            last_rate: row.rate,
            last_purchase_date: row.purchase_date,
            quantity: row.quantity,
          });
        }
      });

      const supplierComparison = [...supplierMap.values()].sort((left, right) => {
        if (left.last_rate !== right.last_rate) {
          return left.last_rate - right.last_rate;
        }

        return new Date(right.last_purchase_date || 0).getTime() - new Date(left.last_purchase_date || 0).getTime();
      });

      const lastFiveRates = history.slice(0, 5).map((row) => ({
        rate: row.rate,
        supplier_name: row.supplier_name,
        purchase_date: row.purchase_date,
        quantity: row.quantity,
        source: row.source,
      }));
      const difference = classifyRateDifference(currentRate, average30DayRate);

      return res.json({
        product_id: product.id,
        product_name: product.name,
        last_purchase_rate: history[0]?.rate || 0,
        avg_30_day_rate: average30DayRate,
        min_rate: minRate,
        max_rate: maxRate,
        last_supplier: history[0]?.supplier_name || "",
        best_supplier_rate: supplierComparison[0]?.last_rate || 0,
        recommended_supplier: supplierComparison[0]?.supplier_name || "",
        supplier_comparison: supplierComparison,
        last_5_rates: lastFiveRates,
        trend: buildTrend(lastFiveRates),
        current_rate: Number.isFinite(currentRate) ? roundRate(currentRate) : 0,
        difference_amount: difference.difference_amount,
        difference_percentage: difference.difference_percentage,
        status: difference.status,
        approval_required: difference.approval_required,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Unable to fetch product purchase intelligence",
        error: error.message,
      });
    }
  }
);

async function loadSupplierForPurchase(client, supplierId) {
  const result = await client.query(
    `SELECT id, name, mobile, status FROM suppliers WHERE id = $1 LIMIT 1`,
    [supplierId]
  );
  if (!result.rowCount) {
    const error = new Error("Registered supplier not found");
    error.code = "SUPPLIER_NOT_FOUND";
    throw error;
  }
  if (result.rows[0].status !== "active") {
    const error = new Error("Selected supplier is inactive");
    error.code = "SUPPLIER_INACTIVE";
    throw error;
  }
  return result.rows[0];
}

async function loadProductForPurchase(client, productId) {
  const result = await client.query(
    `SELECT id, name, business_unit, category, unit FROM products WHERE id = $1 LIMIT 1`,
    [productId]
  );
  if (!result.rowCount) {
    const error = new Error("Inventory product not found");
    error.code = "PRODUCT_NOT_FOUND";
    throw error;
  }
  return result.rows[0];
}

function mapPurchaseFieldErrorToResponse(error) {
  if (!error || !error.code) return null;
  if (error.code === "SUPPLIER_NOT_FOUND" || error.code === "SUPPLIER_INACTIVE") {
    return { status: 400, message: error.message };
  }
  if (error.code === "PRODUCT_NOT_FOUND") {
    return { status: 400, message: error.message };
  }
  return null;
}

async function syncPurchaseItemBatch(client, purchaseId, batchNo) {
  const normalizedBatch = typeof batchNo === "string" ? batchNo.trim() : "";
  if (!normalizedBatch) {
    await client.query("DELETE FROM purchase_item_batches WHERE purchase_id = $1", [purchaseId]);
    return;
  }

  await client.query(
    `INSERT INTO purchase_item_batches (purchase_id, batch_no)
     VALUES ($1, $2)
     ON CONFLICT (purchase_id)
     DO UPDATE SET batch_no = EXCLUDED.batch_no, updated_at = CURRENT_TIMESTAMP`,
    [purchaseId, normalizedBatch]
  );
}

async function findMergeablePurchaseRow(client, purchase) {
  const normalizedBatch = typeof purchase.batch_no === "string" ? purchase.batch_no.trim() : "";
  const targetRate = getPurchaseUnitRate(purchase);
  const targetGst = roundRate(purchase.gst_amount);
  const result = await client.query(
    `SELECT p.*, pb.batch_no
     FROM purchases p
     LEFT JOIN purchase_item_batches pb ON pb.purchase_id = p.id
     WHERE p.supplier_id = $1
       AND p.product_id = $2
       AND LOWER(COALESCE(p.invoice_number, '')) = LOWER(COALESCE($3, ''))
       AND p.purchase_date = $4::date
     ORDER BY p.id DESC`,
    [purchase.supplier_id, purchase.product_id, purchase.invoice_number || "", purchase.purchase_date]
  );

  return (
    result.rows.find((row) => {
      const existingBatch = typeof row.batch_no === "string" ? row.batch_no.trim() : "";
      const existingRate = getPurchaseUnitRate(row);
      const existingGst = roundRate(row.gst_amount);
      return existingBatch === normalizedBatch && existingRate === targetRate && existingGst === targetGst;
    }) || null
  );
}

router.post(
  "/",
  requireRole("admin", "manager", "accounts", "operations", "operator"),
  async (req, res) => {
    const validation = validatePurchasePayload(req.body);

    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const purchase = validation.value;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Resolve master records (validation already ensured ids are present).
      const supplier = await loadSupplierForPurchase(client, purchase.supplier_id);
      const product = await loadProductForPurchase(client, purchase.product_id);

      const supplierName = supplier.name;
      const supplierPhone = purchase.supplier_phone || supplier.mobile || "";
      const itemName = product.name;
      const category = purchase.category || product.category || "tiles";
      const unit = purchase.unit || product.unit || "pcs";
      const mergeablePurchase = await findMergeablePurchaseRow(client, {
        ...purchase,
        category,
        unit,
      });

      const result = mergeablePurchase
        ? await client.query(
            `UPDATE purchases
             SET quantity = COALESCE(quantity, 0) + $1,
                 amount = COALESCE(amount, 0) + $2,
                 gst_amount = COALESCE(gst_amount, 0) + $3,
                 total_amount = COALESCE(total_amount, 0) + $4,
                 supplier_name = $5,
                 supplier_phone = $6,
                 truck_number = COALESCE(NULLIF($7, ''), truck_number),
                 delivery_date = COALESCE($8, delivery_date),
                 payment_status = $9,
                 remarks = CASE
                   WHEN COALESCE($10, '') = '' THEN remarks
                   WHEN COALESCE(remarks, '') = '' THEN $10
                   ELSE remarks
                 END,
                 updated_by = $11,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $12
             RETURNING *`,
            [
              purchase.quantity,
              purchase.amount,
              purchase.gst_amount,
              purchase.total_amount,
              supplierName,
              supplierPhone,
              purchase.truck_number || "",
              purchase.delivery_date || null,
              purchase.payment_status,
              purchase.remarks,
              req.user.id,
              mergeablePurchase.id,
            ]
          )
        : await client.query(
            `INSERT INTO purchases (
                supplier_id, product_id,
                supplier_name, supplier_phone, invoice_number, purchase_date,
                truck_number, delivery_date,
                business_unit, category, item_name, quantity, unit,
                amount, gst_amount, total_amount, payment_status, remarks,
                created_by, updated_by
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19)
              RETURNING *`,
            [
              purchase.supplier_id,
              purchase.product_id,
              supplierName,
              supplierPhone,
              purchase.invoice_number,
              purchase.purchase_date,
              purchase.truck_number,
              purchase.delivery_date,
              purchase.business_unit,
              category,
              itemName,
              purchase.quantity,
              unit,
              purchase.amount,
              purchase.gst_amount,
              purchase.total_amount,
              purchase.payment_status,
              purchase.remarks,
              req.user.id,
            ]
          );

      await syncPurchaseItemBatch(client, result.rows[0].id, purchase.batch_no);

      await syncPurchaseInventory(
        client,
        mergeablePurchase ? { ...result.rows[0], quantity: purchase.quantity } : result.rows[0],
        1
      );
      await client.query("COMMIT");

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      const mapped = mapPurchaseFieldErrorToResponse(error);
      if (mapped) {
        return res.status(mapped.status).json({ message: mapped.message });
      }
      if (error && error.code === "23505") {
        return res.status(409).json({
          message: buildPurchaseDuplicateMessage(),
        });
      }
      if (error && error.code === "PRODUCT_MATCH_AMBIGUOUS") {
        return res.status(409).json({ message: error.message });
      }
      return res.status(500).json({ message: "Unable to create purchase", error: error.message });
    } finally {
      client.release();
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

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const existingResult = await client.query("SELECT * FROM purchases WHERE id = $1 LIMIT 1", [id]);

      if (!existingResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Purchase not found" });
      }

      await syncPurchaseInventory(client, existingResult.rows[0], -1);

      const supplier = await loadSupplierForPurchase(client, purchase.supplier_id);
      const product = await loadProductForPurchase(client, purchase.product_id);
      const supplierName = supplier.name;
      const supplierPhone = purchase.supplier_phone || supplier.mobile || "";
      const itemName = product.name;
      const category = purchase.category || product.category || "tiles";
      const unit = purchase.unit || product.unit || "pcs";

      const result = await client.query(
        `UPDATE purchases
            SET supplier_id = $1,
                product_id = $2,
                supplier_name = $3,
                supplier_phone = $4,
                invoice_number = $5,
                purchase_date = $6,
                truck_number = $7,
                delivery_date = $8,
                business_unit = $9,
                category = $10,
                item_name = $11,
                quantity = $12,
                unit = $13,
                amount = $14,
                gst_amount = $15,
                total_amount = $16,
                payment_status = $17,
                remarks = $18,
                updated_by = $19,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $20
          RETURNING *`,
        [
          purchase.supplier_id,
          purchase.product_id,
          supplierName,
          supplierPhone,
          purchase.invoice_number,
          purchase.purchase_date,
          purchase.truck_number,
          purchase.delivery_date,
          purchase.business_unit,
          category,
          itemName,
          purchase.quantity,
          unit,
          purchase.amount,
          purchase.gst_amount,
          purchase.total_amount,
          purchase.payment_status,
          purchase.remarks,
          req.user.id,
          id,
        ]
      );

      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Purchase not found" });
      }

      await syncPurchaseItemBatch(client, result.rows[0].id, purchase.batch_no);
      await syncPurchaseInventory(client, result.rows[0], 1);
      await client.query("COMMIT");
      return res.json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      if (error && error.code === "23505") {
        return res.status(409).json({
          message: buildPurchaseDuplicateMessage(),
        });
      }
      if (error && error.code === "PRODUCT_MATCH_AMBIGUOUS") {
        return res.status(409).json({ message: error.message });
      }
      const mapped = mapPurchaseFieldErrorToResponse(error);
      if (mapped) {
        return res.status(mapped.status).json({ message: mapped.message });
      }
      return res.status(500).json({ message: "Unable to update purchase", error: error.message });
    } finally {
      client.release();
    }
  }
);

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM purchases WHERE id = $1 LIMIT 1", [id]);
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Purchase not found" });
    }
    await syncPurchaseInventory(client, existing.rows[0], -1);
    await client.query("DELETE FROM purchases WHERE id = $1", [id]);
    await client.query("COMMIT");
    return res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Unable to delete purchase", error: error.message });
  } finally {
    client.release();
  }
});

export default router;

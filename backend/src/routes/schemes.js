import express from "express";
import { pool, query } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import {
  computeAdhesiveVerificationStatus,
  validateAdhesiveTokenApprovalPayload,
  validateMasonPayload,
  validateAdhesiveTokenPayload,
  validateAdhesiveTokenStatusPayload,
} from "../utils/validation.js";
import { getOrSetCache, invalidateCachePrefix } from "../utils/ttlCache.js";

const router = express.Router();
const DEFAULT_CLAIMS_LIMIT = 100;
const DEFAULT_MASONS_LIMIT = 120;
const MAX_LIST_LIMIT = 300;
const DASHBOARD_TTL_MS = 3000;

function parseListLimit(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_LIST_LIMIT);
}

const masonSelectClause = `
  SELECT
    id,
    name,
    mobile,
    area,
    current_address,
    current_address_city,
    permanent_address,
    permanent_address_city,
    working_areas,
    working_distance_upto_km,
    status,
    registered_at,
    created_by
  FROM masons
`;

async function logAdhesiveClaimActivity(db, claimId, action, note, userId) {
  const run = typeof db === "function" ? db : db.query.bind(db);
  await run(
    `INSERT INTO adhesive_token_claim_activity_logs (claim_id, action, note, created_by)
     VALUES ($1, $2, $3, $4)`,
    [claimId, action, note || "", userId]
  );
}

async function logMasonActivity(db, masonId, claimId, action, note, userId) {
  const run = typeof db === "function" ? db : db.query.bind(db);
  await run(
    `INSERT INTO mason_activity_logs (mason_id, claim_id, action, note, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [masonId, claimId || null, action, note || "", userId]
  );
}

async function getMasonById(db, masonId) {
  const run = typeof db === "function" ? db : db.query.bind(db);
  const result = await run(
    `${masonSelectClause}
     WHERE id = $1
     LIMIT 1`,
    [masonId]
  );

  return result.rows[0] || null;
}

async function listMasons(db, limit = DEFAULT_MASONS_LIMIT) {
  const run = typeof db === "function" ? db : db.query.bind(db);
  const result = await run(
    `${masonSelectClause}
     ORDER BY name ASC, id ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

async function getProjectVerificationContext(db, projectId) {
  const run = typeof db === "function" ? db : db.query.bind(db);
  const result = await run(
    `SELECT
       p.id,
       p.project_name,
       p.project_code,
       l.name AS lead_name,
       l.phone AS lead_phone
     FROM projects p
     JOIN leads l ON l.id = p.lead_id
     WHERE p.id = $1
     LIMIT 1`,
    [projectId]
  );

  return result.rows[0] || null;
}

function buildVerificationStatus(claim, projectContext) {
  return computeAdhesiveVerificationStatus({
    invoice_number: claim.invoice_number,
    customer_name: claim.customer_name,
    expected_customer_name: projectContext?.lead_name || "",
    sold_bag_quantity: claim.sold_bag_quantity,
    claimed_bag_quantity: claim.claimed_bag_quantity,
  });
}

async function loadClaimDetail(db, claimId) {
  const run = typeof db === "function" ? db : db.query.bind(db);
  const [claimResult, itemsResult, activityResult] = await Promise.all([
    run(
      `SELECT
         c.*,
         m.name AS mason_name,
         m.mobile AS mason_mobile,
         m.area AS mason_area,
         m.status AS mason_status,
         p.project_name,
         p.project_code,
         l.name AS project_customer_name,
         l.phone AS project_customer_phone,
         creator.name AS created_by_user_name,
         verifier.name AS verified_by_user_name,
         approver.name AS approved_by_user_name,
         rejecter.name AS rejected_by_user_name,
         payer.name AS paid_by_user_name
       FROM adhesive_token_claims c
       LEFT JOIN masons m ON m.id = c.mason_id
       LEFT JOIN projects p ON p.id = c.project_id
       LEFT JOIN leads l ON l.id = p.lead_id
       LEFT JOIN users creator ON creator.id = c.created_by
       LEFT JOIN users verifier ON verifier.id = c.verified_by
       LEFT JOIN users approver ON approver.id = c.approved_by
       LEFT JOIN users rejecter ON rejecter.id = c.rejected_by
       LEFT JOIN users payer ON payer.id = c.paid_by
       WHERE c.id = $1
       LIMIT 1`,
      [claimId]
    ),
    run(
      `SELECT *
       FROM adhesive_token_items
       WHERE claim_id = $1
       ORDER BY id ASC`,
      [claimId]
    ),
    run(
      `SELECT
         a.*,
         u.name AS action_by_user_name,
         a.note AS details
       FROM adhesive_token_claim_activity_logs a
       LEFT JOIN users u ON u.id = a.created_by
       WHERE a.claim_id = $1
       ORDER BY a.created_at DESC, a.id DESC`,
      [claimId]
    ),
  ]);

  if (claimResult.rowCount === 0) {
    return null;
  }

  return {
    ...(claimResult.rows[0] || {}),
    items: itemsResult.rows,
    activities: activityResult.rows,
  };
}

router.get("/", async (req, res) => {
  const claimsLimit = parseListLimit(req.query.limit, DEFAULT_CLAIMS_LIMIT);
  const masonLimit = parseListLimit(req.query.mason_limit, DEFAULT_MASONS_LIMIT);

  try {
    const data = await getOrSetCache(`schemes:dashboard:${claimsLimit}:${masonLimit}`, DASHBOARD_TTL_MS, async () => {
      const [claimsResult, summaryResult, reportsResult, activityResult] = await Promise.all([
      query(
        `SELECT
           c.*,
           m.name AS mason_name,
           m.mobile AS mason_mobile,
           m.area AS mason_area,
           m.status AS mason_status,
           p.project_name,
           p.project_code,
           l.name AS project_customer_name,
           l.phone AS project_customer_phone,
           creator.name AS created_by_user_name,
           verifier.name AS verified_by_user_name,
           approver.name AS approved_by_user_name,
           rejecter.name AS rejected_by_user_name,
           payer.name AS paid_by_user_name,
           COUNT(i.id)::int AS items_count
         FROM adhesive_token_claims c
         LEFT JOIN masons m ON m.id = c.mason_id
         LEFT JOIN projects p ON p.id = c.project_id
         LEFT JOIN leads l ON l.id = p.lead_id
         LEFT JOIN users creator ON creator.id = c.created_by
         LEFT JOIN users verifier ON verifier.id = c.verified_by
         LEFT JOIN users approver ON approver.id = c.approved_by
         LEFT JOIN users rejecter ON rejecter.id = c.rejected_by
         LEFT JOIN users payer ON payer.id = c.paid_by
         LEFT JOIN adhesive_token_items i ON i.claim_id = c.id
         GROUP BY c.id, m.name, m.mobile, m.area, m.status, p.project_name, p.project_code, l.name, l.phone, creator.name, verifier.name, approver.name, rejecter.name, payer.name
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT $1`,
        [claimsLimit]
      ),
      query(
        `SELECT
           COUNT(*)::int AS total_claims,
           COUNT(*) FILTER (WHERE c.status = 'pending')::int AS pending_claims,
           COUNT(*) FILTER (WHERE c.status = 'paid')::int AS paid_claims,
           COUNT(*) FILTER (WHERE c.status = 'rejected')::int AS rejected_claims,
           COUNT(*) FILTER (WHERE c.verification_status = 'mismatch')::int AS mismatch_claims,
           COUNT(*) FILTER (WHERE c.verification_status = 'rejected')::int AS verification_rejected_claims,
           COUNT(*) FILTER (WHERE c.verification_status = 'approved' AND c.status = 'pending')::int AS pending_approved_claims,
           COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.verification_status = 'approved' AND c.status = 'pending'), 0)::int AS pending_token_payout,
           COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.status = 'paid'), 0)::int AS paid_token_payout
         FROM adhesive_token_claims c`
      ),
      query(
        `SELECT json_build_object(
           'mason_wise', COALESCE((
             SELECT json_agg(row_to_json(x))
             FROM (
               SELECT
                 c.mason_id,
                 m.name AS mason_name,
                 m.mobile AS mason_mobile,
                 m.area AS mason_area,
                 m.status AS mason_status,
                 COUNT(*)::int AS entries_count,
                 COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.verification_status = 'approved' AND c.status = 'pending'), 0)::int AS pending_amount,
                 COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.status = 'paid'), 0)::int AS paid_amount,
                 COALESCE(SUM(c.total_token_amount), 0)::int AS total_amount
               FROM adhesive_token_claims c
               JOIN masons m ON m.id = c.mason_id
               GROUP BY c.mason_id, m.name, m.mobile, m.area, m.status
               ORDER BY total_amount DESC, mason_name ASC
             ) x
           ), '[]'::json),
           'company_wise', COALESCE((
             SELECT json_agg(row_to_json(x))
             FROM (
               SELECT
                 c.adhesive_company,
                 COUNT(*)::int AS entries_count,
                 COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.verification_status = 'approved' AND c.status = 'pending'), 0)::int AS pending_amount,
                 COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.status = 'paid'), 0)::int AS paid_amount,
                 COALESCE(SUM(c.total_token_amount), 0)::int AS total_amount
               FROM adhesive_token_claims c
               GROUP BY c.adhesive_company
               ORDER BY total_amount DESC, c.adhesive_company ASC
             ) x
           ), '[]'::json),
           'site_wise', COALESCE((
             SELECT json_agg(row_to_json(x))
             FROM (
               SELECT
                 c.site_name,
                 COUNT(*)::int AS entries_count,
                 COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.verification_status = 'approved' AND c.status = 'pending'), 0)::int AS pending_amount,
                 COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.status = 'paid'), 0)::int AS paid_amount,
                 COALESCE(SUM(c.total_token_amount), 0)::int AS total_amount
               FROM adhesive_token_claims c
               GROUP BY c.site_name
               ORDER BY total_amount DESC, c.site_name ASC
             ) x
           ), '[]'::json),
           'monthly_payout', COALESCE((
             SELECT json_agg(row_to_json(x))
             FROM (
               SELECT
                 TO_CHAR(DATE_TRUNC('month', COALESCE(c.payment_date::timestamp, c.created_at)), 'YYYY-MM') AS payout_month,
                 COUNT(*)::int AS entries_count,
                 COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.status = 'paid'), 0)::int AS paid_amount,
                 COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.verification_status = 'approved' AND c.status = 'pending'), 0)::int AS pending_amount
               FROM adhesive_token_claims c
               GROUP BY DATE_TRUNC('month', COALESCE(c.payment_date::timestamp, c.created_at))
               ORDER BY DATE_TRUNC('month', COALESCE(c.payment_date::timestamp, c.created_at)) DESC
             ) x
           ), '[]'::json),
           'mismatch_rejected_claims', COALESCE((
             SELECT json_agg(row_to_json(x))
             FROM (
               SELECT
                 c.id,
                 c.site_name,
                 c.invoice_number,
                 m.name AS mason_name,
                 c.adhesive_company,
                 c.claimed_bag_quantity,
                 c.sold_bag_quantity,
                 c.verification_status,
                 c.status,
                 c.total_token_amount,
                 c.created_at
               FROM adhesive_token_claims c
               JOIN masons m ON m.id = c.mason_id
               WHERE c.verification_status IN ('mismatch', 'rejected') OR c.status = 'rejected'
               ORDER BY c.created_at DESC, c.id DESC
             ) x
           ), '[]'::json)
         ) AS reports`
      ),
      query(
        `SELECT
           a.*,
           c.site_name,
           c.invoice_number,
           m.name AS mason_name,
           c.adhesive_company,
           u.name AS action_by_user_name,
           a.note AS details
         FROM adhesive_token_claim_activity_logs a
         JOIN adhesive_token_claims c ON c.id = a.claim_id
         LEFT JOIN masons m ON m.id = c.mason_id
         LEFT JOIN users u ON u.id = a.created_by
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT 40`
      ),
      ]);

      return {
        tokens: claimsResult.rows,
        summary: summaryResult.rows[0],
        reports: reportsResult.rows[0]?.reports || {},
        activities: activityResult.rows,
        masons: await listMasons(query, masonLimit),
        masonActivities: (
          await query(
          `SELECT
             l.*,
             m.name AS mason_name,
             m.mobile AS mason_mobile,
             u.name AS user_name
           FROM mason_activity_logs l
           LEFT JOIN masons m ON m.id = l.mason_id
           LEFT JOIN users u ON u.id = l.created_by
           ORDER BY l.created_at DESC, l.id DESC
          LIMIT 40`
          )
        ).rows,
      };
    });

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch adhesive token dashboard", error: error.message });
  }
});

router.get("/masons", async (req, res) => {
  const limit = parseListLimit(req.query.limit, DEFAULT_MASONS_LIMIT);
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const params = [];
  const conds = [];

  if (status === "active" || status === "inactive") {
    params.push(status);
    conds.push(`status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conds.push(
      `(name ILIKE $${params.length} OR mobile ILIKE $${params.length} OR alt_mobile ILIKE $${params.length} OR current_address_city ILIKE $${params.length})`
    );
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  params.push(limit);
  const limitIdx = params.length;

  try {
    const result = await query(
      `${masonSelectClause}
       ${where}
       ORDER BY name ASC, id ASC
       LIMIT $${limitIdx}`,
      params
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch registered masons", error: error.message });
  }
});

router.post("/masons", requireRole("admin", "manager"), async (req, res) => {
  const validation = validateMasonPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const mason = validation.value;

  try {
    const existing = await query(
      `${masonSelectClause}
       WHERE mobile = $1
       LIMIT 1`,
      [mason.mobile]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({
        message: "Mason already registered",
        mason: existing.rows[0],
      });
    }

    const result = await query(
      `INSERT INTO masons (
         name, mobile, alt_mobile, area, current_address, current_address_city,
         permanent_address, permanent_address_city, working_areas,
         working_distance_upto_km, status, remarks, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13)
       RETURNING *`,
      [
        mason.name,
        mason.mobile,
        mason.alt_mobile,
        mason.area,
        mason.current_address,
        mason.current_address_city,
        mason.permanent_address,
        mason.permanent_address_city,
        JSON.stringify(mason.working_areas),
        mason.working_distance_upto_km,
        mason.status,
        mason.remarks,
        req.user.id,
      ]
    );

    const created = result.rows[0];
    await logMasonActivity(
      query,
      created.id,
      null,
      "mason_registered",
      `Registered mason ${created.name} for ${created.current_address_city} with working areas ${mason.working_areas.join(", ")} and ${mason.working_distance_upto_km} KM distance`,
      req.user.id
    );
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ message: "Unable to register mason", error: error.message });
  } finally {
    invalidateCachePrefix("schemes:");
  }
});

router.put("/masons/:id", requireRole("admin", "manager"), async (req, res) => {
  const { id } = req.params;
  const validation = validateMasonPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const mason = validation.value;

  try {
    const currentResult = await query(
      `SELECT *
       FROM masons
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    const current = currentResult.rows[0];

    if (!current) {
      return res.status(404).json({ message: "Mason not found" });
    }

    const existing = await query(
      `${masonSelectClause}
       WHERE mobile = $1
         AND id <> $2
       LIMIT 1`,
      [mason.mobile, id]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({
        message: "Mason already registered",
        mason: existing.rows[0],
      });
    }

    const result = await query(
      `UPDATE masons
       SET name = $1,
           mobile = $2,
           alt_mobile = $3,
           area = $4,
           current_address = $5,
           current_address_city = $6,
           permanent_address = $7,
           permanent_address_city = $8,
           working_areas = $9::jsonb,
           working_distance_upto_km = $10,
           status = $11,
           remarks = $12,
           updated_by = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $14
       RETURNING *`,
      [
        mason.name,
        mason.mobile,
        mason.alt_mobile,
        mason.area,
        mason.current_address,
        mason.current_address_city,
        mason.permanent_address,
        mason.permanent_address_city,
        JSON.stringify(mason.working_areas),
        mason.working_distance_upto_km,
        mason.status,
        mason.remarks,
        req.user.id,
        id,
      ]
    );

    const currentWorkingAreas = Array.isArray(current.working_areas) ? current.working_areas : [];
    const workProfileChanged =
      current.current_address !== mason.current_address ||
      current.current_address_city !== mason.current_address_city ||
      current.permanent_address !== mason.permanent_address ||
      current.permanent_address_city !== mason.permanent_address_city ||
      JSON.stringify(currentWorkingAreas) !== JSON.stringify(mason.working_areas) ||
      Number(current.working_distance_upto_km || 0) !== Number(mason.working_distance_upto_km || 0);

    if (current.status !== mason.status) {
      await logMasonActivity(
        query,
        Number(id),
        null,
        mason.status === "active" ? "mason_activated" : "mason_inactivated",
        mason.status === "active" ? `Activated mason ${mason.name}` : `Inactivated mason ${mason.name}`,
        req.user.id
      );
    }

    if (workProfileChanged) {
      await logMasonActivity(
        query,
        Number(id),
        null,
        "mason_work_profile_updated",
        `Updated mason working areas to ${mason.working_areas.join(", ")} and distance to ${mason.working_distance_upto_km} KM`,
        req.user.id
      );
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update mason", error: error.message });
  } finally {
    invalidateCachePrefix("schemes:");
  }
});

router.post("/claims", requireRole("admin", "manager", "operations", "sales"), async (req, res) => {
  const validation = validateAdhesiveTokenPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const claim = validation.value;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const mason = await getMasonById(client, claim.mason_id);
    if (!mason) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Registered mason selection is required" });
    }

    if (mason.status !== "active") {
      await logMasonActivity(client, mason.id, null, "blocked_inactive_mason", "Token redemption blocked for inactive mason", req.user.id);
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Mason is not active for token redemption." });
    }

    const projectContext = claim.project_id
      ? await getProjectVerificationContext(client, claim.project_id)
      : null;
    if (claim.project_id && !projectContext) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Project not found" });
    }

    const verification_status = buildVerificationStatus(claim, projectContext);

    // Soft duplicate-claim guard: a non-rejected claim with the same mason + invoice + sale date
    // is treated as a duplicate. This complements the partial unique index from migration 024,
    // and gives a clear error message even if the index could not be created due to legacy data.
    if (claim.invoice_number) {
      const duplicate = await client.query(
        `SELECT id FROM adhesive_token_claims
          WHERE mason_id = $1
            AND LOWER(invoice_number) = LOWER($2)
            AND COALESCE(sale_date::text, '') = COALESCE($3::text, '')
            AND status <> 'rejected'
          LIMIT 1`,
        [claim.mason_id, claim.invoice_number, claim.sale_date]
      );
      if (duplicate.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "Duplicate token claim for this mason, invoice and sale date",
          existing_claim_id: duplicate.rows[0].id,
        });
      }
    }

    // Also populate the legacy mason_name / mason_mobile columns from the
    // resolved mason master row so historical reports (and any prod DBs
    // still running the original NOT NULL constraint from migration 014)
    // remain consistent. Migration 031 makes those columns NULLABLE so the
    // INSERT is also safe on updated databases.
    const masonName = mason?.name || "";
    const masonMobile = mason?.mobile || "";

    const claimResult = await client.query(
      `INSERT INTO adhesive_token_claims (
         site_name, project_id, invoice_number, sale_date, customer_name,
         mason_id, mason_name, mason_mobile,
         adhesive_company, adhesive_type,
         sold_bag_quantity, claimed_bag_quantity, total_token_amount,
         status, verification_status, payment_date, remarks, token_photo_url,
         created_by, verified_by, verified_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, NULL, $15, $16, $17, NULL, NULL)
       RETURNING *`,
      [
        claim.site_name,
        claim.project_id,
        claim.invoice_number,
        claim.sale_date,
        claim.customer_name,
        claim.mason_id,
        masonName,
        masonMobile,
        claim.adhesive_company,
        claim.adhesive_type,
        claim.sold_bag_quantity,
        claim.claimed_bag_quantity,
        claim.total_token_amount,
        verification_status,
        claim.remarks,
        claim.token_photo_url,
        req.user.id,
      ]
    );

    const createdClaim = claimResult.rows[0];

    for (const item of claim.items) {
      await client.query(
        `INSERT INTO adhesive_token_items (claim_id, token_value, quantity, line_total)
         VALUES ($1, $2, $3, $4)`,
        [createdClaim.id, item.token_value, item.quantity, item.line_total]
      );
    }

    await logAdhesiveClaimActivity(
      client,
      createdClaim.id,
      "claim_created",
      claim.remarks || `Created adhesive token claim for invoice ${claim.invoice_number}`,
      req.user.id
    );

    await logMasonActivity(
      client,
      mason.id,
      createdClaim.id,
      "token_claim_created",
      `Created adhesive token claim for invoice ${claim.invoice_number}`,
      req.user.id
    );

    await client.query("COMMIT");

    const detail = await loadClaimDetail(query, createdClaim.id);
    return res.status(201).json(detail);
  } catch (error) {
    await client.query("ROLLBACK");
    // Log the full error to PM2 stderr so the next 500 (if any) is debuggable.
    process.stderr.write(
      `[adhesive-claim-insert] code=${error?.code || ""} detail=${error?.detail || ""} message=${error?.message || ""}\n`
    );
    if (error && error.code === "23505") {
      return res.status(409).json({
        message: "Duplicate token claim for this mason, invoice and sale date",
      });
    }
    // 23502 = NOT NULL violation, 23503 = FK violation, 23514 = CHECK constraint
    if (error && (error.code === "23502" || error.code === "23503" || error.code === "23514")) {
      return res.status(400).json({
        message: `Adhesive claim payload invalid: ${error.message}`,
        column: error.column || null,
        constraint: error.constraint || null,
      });
    }
    return res.status(500).json({ message: "Unable to create adhesive token claim", error: error.message });
  } finally {
    invalidateCachePrefix("schemes:");
    client.release();
  }
});

router.get("/claims/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const detail = await loadClaimDetail(query, id);

    if (!detail) {
      return res.status(404).json({ message: "Adhesive token claim not found" });
    }

    return res.json({
      token: detail,
      activities: detail.activities || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch adhesive token claim", error: error.message });
  }
});

router.put("/claims/:id", requireRole("admin", "manager", "operations", "sales"), async (req, res) => {
  const { id } = req.params;
  const validation = validateAdhesiveTokenPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const claim = validation.value;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      "SELECT * FROM adhesive_token_claims WHERE id = $1 LIMIT 1",
      [id]
    );
    const current = currentResult.rows[0];

    if (!current) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Adhesive token claim not found" });
    }

    if (current.status !== "pending" || current.verification_status === "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Only non-approved pending claims can be edited" });
    }

    const mason = await getMasonById(client, claim.mason_id);
    if (!mason) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Registered mason selection is required" });
    }

    if (mason.status !== "active") {
      await logMasonActivity(client, mason.id, current.id, "blocked_inactive_mason", "Token redemption blocked for inactive mason", req.user.id);
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Mason is not active for token redemption." });
    }

    const projectContext = claim.project_id
      ? await getProjectVerificationContext(client, claim.project_id)
      : null;
    if (claim.project_id && !projectContext) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Project not found" });
    }

    const verification_status = buildVerificationStatus(claim, projectContext);
    const nextRemarks = [current.remarks, claim.remarks].filter(Boolean).join("\n").trim();

    await client.query(
      `UPDATE adhesive_token_claims
       SET site_name = $1,
           project_id = $2,
           invoice_number = $3,
           sale_date = $4,
           customer_name = $5,
           mason_id = $6,
           adhesive_company = $7,
           adhesive_type = $8,
           sold_bag_quantity = $9,
           claimed_bag_quantity = $10,
           total_token_amount = $11,
           verification_status = $12,
           remarks = $13,
           token_photo_url = $14,
           verified_by = NULL,
           verified_at = NULL,
           payment_date = NULL
       WHERE id = $15`,
      [
        claim.site_name,
        claim.project_id,
        claim.invoice_number,
        claim.sale_date,
        claim.customer_name,
        claim.mason_id,
        claim.adhesive_company,
        claim.adhesive_type,
        claim.sold_bag_quantity,
        claim.claimed_bag_quantity,
        claim.total_token_amount,
        verification_status,
        nextRemarks,
        claim.token_photo_url,
        id,
      ]
    );

    await client.query("DELETE FROM adhesive_token_items WHERE claim_id = $1", [id]);

    for (const item of claim.items) {
      await client.query(
        `INSERT INTO adhesive_token_items (claim_id, token_value, quantity, line_total)
         VALUES ($1, $2, $3, $4)`,
        [id, item.token_value, item.quantity, item.line_total]
      );
    }

    await logAdhesiveClaimActivity(
      client,
      current.id,
      "claim_updated",
      claim.remarks || `Updated adhesive token claim for invoice ${claim.invoice_number}`,
      req.user.id
    );

    await logMasonActivity(
      client,
      mason.id,
      current.id,
      "token_claim_created",
      `Updated adhesive token claim for invoice ${claim.invoice_number}`,
      req.user.id
    );

    await client.query("COMMIT");

    const detail = await loadClaimDetail(query, id);
    return res.json(detail);
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Unable to update adhesive token claim", error: error.message });
  } finally {
    invalidateCachePrefix("schemes:");
    client.release();
  }
});

router.put("/claims/:id/verify", requireRole("admin", "manager", "operations", "sales"), async (req, res) => {
  const { id } = req.params;

  try {
    const currentResult = await query(
      `SELECT *
       FROM adhesive_token_claims
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    const current = currentResult.rows[0];

    if (!current) {
      return res.status(404).json({ message: "Adhesive token claim not found" });
    }

    if (current.status !== "pending") {
      return res.status(400).json({ message: "Only pending claims can be verified" });
    }

    const mason = await getMasonById(query, current.mason_id);
    if (!mason) {
      return res.status(400).json({ message: "Registered mason selection is required" });
    }

    if (mason.status !== "active") {
      await logMasonActivity(query, mason.id, current.id, "blocked_inactive_mason", "Token verification blocked for inactive mason", req.user.id);
      return res.status(400).json({ message: "Mason is not active for token redemption." });
    }

    const projectContext = current.project_id ? await getProjectVerificationContext(query, current.project_id) : null;
    const verification_status = buildVerificationStatus(current, projectContext);
    const verificationNote =
      verification_status === "matched"
        ? `Invoice ${current.invoice_number} matched against linked project`
        : verification_status === "mismatch"
          ? `Invoice ${current.invoice_number} has a quantity or customer mismatch`
          : `Invoice ${current.invoice_number} remains unverified without linked project/customer context`;

    await query(
      `UPDATE adhesive_token_claims
       SET verification_status = $1,
           verified_by = $2,
           verified_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [verification_status, req.user.id, id]
    );

    await logAdhesiveClaimActivity(query, id, "invoice_verified", verificationNote, req.user.id);

    const detail = await loadClaimDetail(query, id);
    return res.json(detail);
  } catch (error) {
    return res.status(500).json({ message: "Unable to verify adhesive token claim", error: error.message });
  } finally {
    invalidateCachePrefix("schemes:");
  }
});

router.put("/claims/:id/approval", requireRole("admin", "manager"), async (req, res) => {
  const { id } = req.params;
  const validation = validateAdhesiveTokenApprovalPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const update = validation.value;

  try {
    const currentResult = await query(
      "SELECT * FROM adhesive_token_claims WHERE id = $1 LIMIT 1",
      [id]
    );
    const current = currentResult.rows[0];

    if (!current) {
      return res.status(404).json({ message: "Adhesive token claim not found" });
    }

    if (current.status !== "pending") {
      return res.status(400).json({ message: "Only pending claims can be updated" });
    }

    const nextStatus = update.verification_status === "rejected" ? "rejected" : current.status;
    const nextRemarks = [current.remarks, update.remarks].filter(Boolean).join("\n");

    await query(
      `UPDATE adhesive_token_claims
       SET verification_status = $1,
           status = $2,
           remarks = $3,
           approved_by = CASE WHEN $1 = 'approved' THEN $4 ELSE approved_by END,
           approved_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
           rejected_by = CASE WHEN $1 = 'rejected' THEN $4 ELSE rejected_by END,
           rejected_at = CASE WHEN $1 = 'rejected' THEN CURRENT_TIMESTAMP ELSE rejected_at END
       WHERE id = $5`,
      [update.verification_status, nextStatus, nextRemarks, req.user.id, id]
    );

    await logAdhesiveClaimActivity(
      query,
      id,
      update.verification_status === "approved" ? "claim_approved" : "claim_rejected",
      update.remarks || `Claim ${update.verification_status}`,
      req.user.id
    );

    const detail = await loadClaimDetail(query, id);
    return res.json(detail);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update claim approval", error: error.message });
  } finally {
    invalidateCachePrefix("schemes:");
  }
});

router.put("/claims/:id/reopen", requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const remarks = String(req.body?.remarks || "").trim();

  try {
    const currentResult = await query(
      "SELECT * FROM adhesive_token_claims WHERE id = $1 LIMIT 1",
      [id]
    );
    const current = currentResult.rows[0];

    if (!current) {
      return res.status(404).json({ message: "Adhesive token claim not found" });
    }

    if (current.status === "paid") {
      return res.status(400).json({ message: "Paid adhesive token claims are locked" });
    }

    if (current.verification_status !== "approved") {
      return res.status(400).json({ message: "Only approved claims can be reopened" });
    }

    const nextRemarks = [current.remarks, remarks].filter(Boolean).join("\n");

    await query(
      `UPDATE adhesive_token_claims
       SET verification_status = 'unverified',
           remarks = $1,
           verified_by = NULL,
           verified_at = NULL,
           approved_by = NULL,
           approved_at = NULL,
           rejected_by = NULL,
           rejected_at = NULL
       WHERE id = $2`,
      [nextRemarks, id]
    );

    await logAdhesiveClaimActivity(
      query,
      id,
      "reopened",
      remarks || "Reopened claim for correction",
      req.user.id
    );

    const detail = await loadClaimDetail(query, id);
    return res.json(detail);
  } catch (error) {
    return res.status(500).json({ message: "Unable to reopen adhesive token claim", error: error.message });
  } finally {
    invalidateCachePrefix("schemes:");
  }
});

router.put("/claims/:id/payment", requireRole("admin", "manager", "accounts"), async (req, res) => {
  const { id } = req.params;
  const validation = validateAdhesiveTokenStatusPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const update = validation.value;

  try {
    const currentResult = await query(
      "SELECT * FROM adhesive_token_claims WHERE id = $1 LIMIT 1",
      [id]
    );
    const current = currentResult.rows[0];

    if (!current) {
      return res.status(404).json({ message: "Adhesive token claim not found" });
    }

    if (!current.invoice_number) {
      return res.status(400).json({ message: "Invoice number is required before payment" });
    }

    const mason = await getMasonById(query, current.mason_id);
    if (!mason) {
      return res.status(400).json({ message: "Registered mason selection is required" });
    }

    if (mason.status !== "active") {
      await logMasonActivity(query, mason.id, current.id, "blocked_inactive_mason", "Token payment blocked for inactive mason", req.user.id);
      return res.status(400).json({ message: "Mason is not active for token redemption." });
    }

    if (current.verification_status !== "approved") {
      return res.status(400).json({ message: "Only approved token claims can be marked paid" });
    }

    if (current.status !== "pending") {
      return res.status(400).json({ message: "Only pending token claims can be marked paid" });
    }

    const nextRemarks = [current.remarks, update.remarks].filter(Boolean).join("\n");

    await query(
      `UPDATE adhesive_token_claims
       SET status = 'paid',
           payment_date = $1,
           paid_by = $2,
           paid_at = CURRENT_TIMESTAMP,
           remarks = $3
       WHERE id = $4`,
      [update.payment_date, req.user.id, nextRemarks, id]
    );

    await logAdhesiveClaimActivity(
      query,
      id,
      "payout_paid",
      update.remarks || `Marked claim as paid on ${update.payment_date}`,
      req.user.id
    );

    const detail = await loadClaimDetail(query, id);
    return res.json(detail);
  } catch (error) {
    return res.status(500).json({ message: "Unable to mark claim as paid", error: error.message });
  } finally {
    invalidateCachePrefix("schemes:");
  }
});

router.delete("/claims/:id", requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const currentResult = await query(
      "SELECT * FROM adhesive_token_claims WHERE id = $1 LIMIT 1",
      [id]
    );
    const current = currentResult.rows[0];

    if (!current) {
      return res.status(404).json({ message: "Adhesive token claim not found" });
    }

    if (current.status === "paid") {
      return res.status(400).json({ message: "Paid adhesive token claims are locked" });
    }

    await query("DELETE FROM adhesive_token_claims WHERE id = $1", [id]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Unable to delete adhesive token claim", error: error.message });
  } finally {
    invalidateCachePrefix("schemes:");
  }
});

export default router;

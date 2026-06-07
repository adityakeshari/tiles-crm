import express from "express";
import { query } from "../db.js";
import { requireInternalApiKey } from "../middleware/internal-auth.js";
import { getOrSetCache } from "../utils/ttlCache.js";

const router = express.Router();
const TIMEZONE = "Asia/Kolkata";
const CACHE_TTL_MS = Number(process.env.OWNER_SUMMARY_CACHE_TTL_MS || 30_000);

function formatKolkataTimestamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+05:30`;
}

function formatKolkataDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toNumber(value) {
  return Number(Number(value || 0).toFixed(2));
}

function clampPercentage(value) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Number(Math.max(0, Math.min(100, value)).toFixed(1));
}

function buildEnvelope(data) {
  return {
    success: true,
    generatedAt: formatKolkataTimestamp(),
    timezone: TIMEZONE,
    asOfDate: formatKolkataDate(),
    data,
  };
}

router.get("/", requireInternalApiKey, async (_req, res) => {
  try {
    const payload = await getOrSetCache("owner-summary:v1", CACHE_TTL_MS, async () => {
      const result = await query(`
        WITH context AS (
          SELECT
            timezone('${TIMEZONE}', now()) AS now_ist,
            timezone('${TIMEZONE}', now())::date AS today_ist,
            date_trunc('month', timezone('${TIMEZONE}', now()))::date AS month_start_ist,
            (timezone('${TIMEZONE}', now())::date - INTERVAL '1 day')::date AS yesterday_ist
        ),
        sales_today AS (
          SELECT COALESCE(SUM(q.final_amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM quotations q
            CROSS JOIN context c
           WHERE (q.created_at AT TIME ZONE '${TIMEZONE}')::date = c.today_ist
        ),
        sales_yesterday AS (
          SELECT COALESCE(SUM(q.final_amount), 0)::numeric AS amount
            FROM quotations q
            CROSS JOIN context c
           WHERE (q.created_at AT TIME ZONE '${TIMEZONE}')::date = c.yesterday_ist
        ),
        sales_month AS (
          SELECT COALESCE(SUM(q.final_amount), 0)::numeric AS amount,
                 COUNT(*)::int AS count
            FROM quotations q
            CROSS JOIN context c
           WHERE (q.created_at AT TIME ZONE '${TIMEZONE}')::date >= c.month_start_ist
             AND (q.created_at AT TIME ZONE '${TIMEZONE}')::date <= c.today_ist
        ),
        collection_today AS (
          SELECT COALESCE(SUM(p.amount), 0)::numeric AS amount
            FROM payments p
            CROSS JOIN context c
           WHERE (p.created_at AT TIME ZONE '${TIMEZONE}')::date = c.today_ist
        ),
        collection_month AS (
          SELECT COALESCE(SUM(p.amount), 0)::numeric AS amount
            FROM payments p
            CROSS JOIN context c
           WHERE (p.created_at AT TIME ZONE '${TIMEZONE}')::date >= c.month_start_ist
             AND (p.created_at AT TIME ZONE '${TIMEZONE}')::date <= c.today_ist
        ),
        outstanding AS (
          -- Canonical outstanding formula:
          -- approved invoice grand total - approved invoice payments received.
          -- remaining_amount is treated as the current source of truth until
          -- credit notes / adjustments exist as separate modeled entities.
          SELECT
            COALESCE(SUM(remaining_amount), 0)::numeric AS customer_outstanding
          FROM invoices
          WHERE status = 'approved'
        ),
        dealer_outstanding AS (
          SELECT COALESCE(SUM(outstanding_payment), 0)::numeric AS dealer_outstanding
            FROM dealers
        ),
        walkins_today AS (
          SELECT COUNT(*)::int AS count
            FROM leads l
            CROSS JOIN context c
           WHERE (l.created_at AT TIME ZONE '${TIMEZONE}')::date = c.today_ist
        ),
        followups AS (
          SELECT
            COUNT(*) FILTER (WHERE f.status = 'pending')::int AS pending_count,
            COUNT(*) FILTER (
              WHERE f.status <> 'completed'
                AND f.followup_date IS NOT NULL
                AND (f.followup_date AT TIME ZONE '${TIMEZONE}') < c.now_ist
            )::int AS overdue_count,
            COUNT(*) FILTER (
              WHERE f.status <> 'completed'
                AND f.followup_date IS NOT NULL
                AND (f.followup_date AT TIME ZONE '${TIMEZONE}')::date = c.today_ist
            )::int AS today_count
          FROM followups f
          CROSS JOIN context c
        ),
        operations_tasks AS (
          SELECT
            COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress', 'delayed'))::int AS open_count,
            COUNT(*) FILTER (WHERE status = 'delayed')::int AS delayed_count
          FROM operations_tasks
        ),
        token_summary AS (
          SELECT
            COUNT(*) FILTER (WHERE c.status = 'pending')::int AS pending_claims,
            COUNT(*) FILTER (WHERE c.status = 'paid')::int AS paid_claims,
            COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.verification_status = 'approved' AND c.status = 'pending'), 0)::numeric AS pending_payout,
            COALESCE(SUM(c.total_token_amount) FILTER (WHERE c.status = 'paid' AND c.payment_date >= ctx.month_start_ist), 0)::numeric AS paid_payout_month
          FROM adhesive_token_claims c
          CROSS JOIN context ctx
        ),
        mason_activity_today AS (
          SELECT COUNT(*)::int AS count
            FROM mason_activity_logs l
            CROSS JOIN context c
           WHERE (l.created_at AT TIME ZONE '${TIMEZONE}')::date = c.today_ist
        ),
        projects AS (
          SELECT
            COUNT(*) FILTER (WHERE p.status = 'active')::int AS active_count,
            COUNT(*) FILTER (WHERE p.status = 'completed')::int AS completed_count,
            COALESCE(SUM(ds.pending_dispatch_items), 0)::int AS pending_dispatch_items,
            COALESCE(SUM(pjs.plumbing_jobs_pending), 0)::int AS pending_plumbing_jobs
          FROM projects p
          LEFT JOIN (
            SELECT project_id, COUNT(*) FILTER (WHERE status <> 'delivered')::int AS pending_dispatch_items
            FROM dispatches
            GROUP BY project_id
          ) ds ON ds.project_id = p.id
          LEFT JOIN (
            SELECT lead_id, COUNT(*) FILTER (WHERE status <> 'completed')::int AS plumbing_jobs_pending
            FROM plumbing_jobs
            GROUP BY lead_id
          ) pjs ON pjs.lead_id = p.lead_id
        )
        SELECT
          st.amount AS sales_today_value,
          st.count AS sales_today_count,
          sy.amount AS sales_yesterday_value,
          sm.amount AS sales_month_value,
          sm.count AS sales_month_count,
          ct.amount AS collection_today_value,
          cm.amount AS collection_month_value,
          o.customer_outstanding,
          d.dealer_outstanding,
          w.count AS walkins_today_count,
          f.pending_count,
          f.overdue_count,
          f.today_count,
          ot.open_count,
          ot.delayed_count,
          ts.pending_claims,
          ts.paid_claims,
          ts.pending_payout,
          ts.paid_payout_month,
          ma.count AS mason_activity_today_count,
          p.active_count,
          p.completed_count,
          p.pending_dispatch_items,
          p.pending_plumbing_jobs
        FROM sales_today st
        CROSS JOIN sales_yesterday sy
        CROSS JOIN sales_month sm
        CROSS JOIN collection_today ct
        CROSS JOIN collection_month cm
        CROSS JOIN outstanding o
        CROSS JOIN dealer_outstanding d
        CROSS JOIN walkins_today w
        CROSS JOIN followups f
        CROSS JOIN operations_tasks ot
        CROSS JOIN token_summary ts
        CROSS JOIN mason_activity_today ma
        CROSS JOIN projects p
      `);

      const row = result.rows[0] || {};
      const salesTodayValue = toNumber(row.sales_today_value);
      const collectionTodayValue = toNumber(row.collection_today_value);
      const pendingCount = Number(row.pending_count || 0);
      const overdueCount = Number(row.overdue_count || 0);
      const openCount = Number(row.open_count || 0);
      const delayedCount = Number(row.delayed_count || 0);
      const salesYesterdayValue = toNumber(row.sales_yesterday_value);

      const collectionEfficiencyPercent = salesTodayValue > 0 ? clampPercentage((collectionTodayValue / salesTodayValue) * 100) : null;
      const followupDisciplinePercent =
        pendingCount + overdueCount > 0 ? clampPercentage((1 - overdueCount / Math.max(pendingCount + overdueCount, 1)) * 100) : null;
      const taskClosurePercent =
        openCount > 0 ? clampPercentage((1 - delayedCount / Math.max(openCount, 1)) * 100) : null;
      const salesTrendPercent =
        salesYesterdayValue > 0 ? clampPercentage(((salesTodayValue - salesYesterdayValue) / salesYesterdayValue) * 100) : null;

      return buildEnvelope({
        business: {
          code: "AIBA_TILES",
          name: "AIBA Tiles",
        },
        sales: {
          todayValue: salesTodayValue,
          todayCount: Number(row.sales_today_count || 0),
          monthValue: toNumber(row.sales_month_value),
          monthCount: Number(row.sales_month_count || 0),
        },
        collection: {
          todayValue: collectionTodayValue,
          monthValue: toNumber(row.collection_month_value),
        },
        outstanding: {
          customerOutstanding: toNumber(row.customer_outstanding),
          dealerOutstanding: toNumber(row.dealer_outstanding),
          totalOutstanding: toNumber(toNumber(row.customer_outstanding) + toNumber(row.dealer_outstanding)),
        },
        walkIns: {
          todayCount: Number(row.walkins_today_count || 0),
        },
        followups: {
          pendingCount,
          overdueCount,
          todayCount: Number(row.today_count || 0),
        },
        tasks: {
          openCount,
          delayedCount,
          showroomTaskCount: openCount,
        },
        tokenMasonActivity: {
          pendingClaims: Number(row.pending_claims || 0),
          paidClaims: Number(row.paid_claims || 0),
          pendingPayout: toNumber(row.pending_payout),
          paidPayoutMonth: toNumber(row.paid_payout_month),
          masonActivityCountToday: Number(row.mason_activity_today_count || 0),
        },
        projects: {
          activeCount: Number(row.active_count || 0),
          completedCount: Number(row.completed_count || 0),
          pendingDispatchItems: Number(row.pending_dispatch_items || 0),
          pendingPlumbingJobs: Number(row.pending_plumbing_jobs || 0),
        },
        healthInputs: {
          salesTrendPercent,
          collectionEfficiencyPercent,
          followupDisciplinePercent,
          taskClosurePercent,
        },
      });
    });

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({
      success: false,
      generatedAt: formatKolkataTimestamp(),
      timezone: TIMEZONE,
      error: {
        code: "OWNER_SUMMARY_UNAVAILABLE",
        message: error.message || "Unable to load CRM owner summary",
      },
    });
  }
});

export default router;

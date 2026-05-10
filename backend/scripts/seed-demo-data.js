import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool } from "../src/db.js";

dotenv.config();

async function upsertUser(client, { name, phone, role, password }) {
  const existing = await client.query("SELECT id FROM users WHERE phone = $1 LIMIT 1", [phone]);
  const hashedPassword = await bcrypt.hash(password, 10);

  if (existing.rowCount > 0) {
    await client.query(
      `UPDATE users
       SET name = $1, role = $2, password = $3
       WHERE id = $4`,
      [name, role, hashedPassword, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const result = await client.query(
    `INSERT INTO users (name, phone, role, password)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, phone, role, hashedPassword]
  );

  return result.rows[0].id;
}

async function main() {
  const client = await pool.connect();

  try {
    const existingLeads = await client.query("SELECT COUNT(*)::int AS count FROM leads");
    if (existingLeads.rows[0]?.count > 0) {
      console.log("Seed skipped: leads already exist in this database.");
      return;
    }

    await client.query("BEGIN");

    const adminId = await upsertUser(client, {
      name: "Launch Admin",
      phone: "9999999999",
      role: "admin",
      password: "Admin@123",
    });
    const salesId = await upsertUser(client, {
      name: "Showroom Sales",
      phone: "9999999998",
      role: "sales",
      password: "Sales@123",
    });
    const opsId = await upsertUser(client, {
      name: "Operations Lead",
      phone: "9999999997",
      role: "operations",
      password: "Ops@12345",
    });
    const accountsId = await upsertUser(client, {
      name: "Accounts Desk",
      phone: "9999999996",
      role: "accounts",
      password: "Accounts@123",
    });

    const leadRows = [];
    for (const lead of [
      {
        name: "Rahul Sharma",
        phone: "9876500001",
        location: "Ujjain",
        department: "sales",
        business_unit: "tiles",
        customer_type: "retail_customer",
        requirement_category: "bathroom",
        requirement: "Premium bathroom wall and floor tiles for 2 bathrooms.",
        budget: 85000,
        timeline: "one_month",
        lead_source: "walk_in",
        status: "converted",
        lost_reason: "",
        assigned_to: salesId,
      },
      {
        name: "Agarwal Builders",
        phone: "9876500002",
        location: "Indore",
        department: "operations",
        business_unit: "both",
        customer_type: "builder",
        requirement_category: "full_house",
        requirement: "Tiles and plumbing package for duplex project.",
        budget: 420000,
        timeline: "three_months",
        lead_source: "reference",
        status: "converted",
        lost_reason: "",
        assigned_to: opsId,
      },
      {
        name: "Mehta Residence",
        phone: "9876500003",
        location: "Dewas",
        department: "sales",
        business_unit: "plumbing",
        customer_type: "retail_customer",
        requirement_category: "plumbing",
        requirement: "Kitchen and bathroom plumbing refit.",
        budget: 110000,
        timeline: "urgent",
        lead_source: "online",
        status: "interested",
        lost_reason: "",
        assigned_to: salesId,
      },
      {
        name: "Khandelwal Contractor",
        phone: "9876500004",
        location: "Ratlam",
        department: "sales",
        business_unit: "tiles",
        customer_type: "contractor",
        requirement_category: "flooring",
        requirement: "2x2 vitrified flooring for apartment lobby.",
        budget: 175000,
        timeline: "one_month",
        lead_source: "dealer",
        status: "quotation_given",
        lost_reason: "",
        assigned_to: salesId,
      },
    ]) {
      const result = await client.query(
        `INSERT INTO leads (
           name, phone, location, department, business_unit, customer_type, requirement_category,
           requirement, budget, timeline, lead_source, status, lost_reason, assigned_to
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          lead.name,
          lead.phone,
          lead.location,
          lead.department,
          lead.business_unit,
          lead.customer_type,
          lead.requirement_category,
          lead.requirement,
          lead.budget,
          lead.timeline,
          lead.lead_source,
          lead.status,
          lead.lost_reason,
          lead.assigned_to,
        ]
      );
      leadRows.push(result.rows[0]);
    }

    const [leadOne, leadTwo, leadThree, leadFour] = leadRows;

    await client.query(
      `INSERT INTO followups (lead_id, followup_type, note, followup_date, status)
       VALUES
       ($1, 'call', 'Customer asked for updated tile samples.', CURRENT_TIMESTAMP + INTERVAL '1 day', 'pending'),
       ($2, 'visit', 'Site visit planned for duplex measurement.', CURRENT_TIMESTAMP + INTERVAL '2 day', 'pending'),
       ($3, 'whatsapp', 'Sent plumbing package rates.', CURRENT_TIMESTAMP - INTERVAL '1 day', 'overdue')`,
      [leadOne.id, leadTwo.id, leadThree.id]
    );

    await client.query(
      `INSERT INTO payments (lead_id, amount, payment_type, due_date, note)
       VALUES
       ($1, 25000, 'advance', CURRENT_TIMESTAMP + INTERVAL '7 day', 'Booking advance received'),
       ($2, 120000, 'partial', CURRENT_TIMESTAMP + INTERVAL '10 day', 'Stage payment received')`,
      [leadOne.id, leadTwo.id]
    );

    const quotationOne = await client.query(
      `INSERT INTO quotations (lead_id, subtotal, discount, transport_cost, final_amount, status)
       VALUES ($1, 92000, 7000, 2000, 87000, 'approved')
       RETURNING id`,
      [leadOne.id]
    );
    await client.query(
      `INSERT INTO quotation_items (quotation_id, product_name, tile_size, quantity_sqft, unit_price, amount)
       VALUES
       ($1, 'Aston Beige Tile', '600x600', 120, 650, 78000),
       ($1, 'Bathroom Accent Tile', '300x600', 20, 700, 14000)`,
      [quotationOne.rows[0].id]
    );

    const quotationTwo = await client.query(
      `INSERT INTO quotations (lead_id, subtotal, discount, transport_cost, final_amount, status)
       VALUES ($1, 240000, 10000, 5000, 235000, 'shared')
       RETURNING id`,
      [leadTwo.id]
    );
    await client.query(
      `INSERT INTO quotation_items (quotation_id, product_name, tile_size, quantity_sqft, unit_price, amount)
       VALUES
       ($1, 'Grande Living Tile', '800x800', 220, 850, 187000),
       ($1, 'Stair Riser Tile', '300x1200', 40, 1200, 48000)`,
      [quotationTwo.rows[0].id]
    );

    await client.query(
      `INSERT INTO operations_tasks (lead_id, task_type, title, note, scheduled_for, status, assigned_to)
       VALUES
       ($1, 'measurement', 'Bathroom tile measurement', 'Confirm final area before dispatch.', CURRENT_TIMESTAMP + INTERVAL '2 day', 'pending', $2),
       ($3, 'site_visit', 'Plumbing inspection', 'Check current pipeline and fittings.', CURRENT_TIMESTAMP + INTERVAL '1 day', 'in_progress', $2)`,
      [leadOne.id, opsId, leadThree.id]
    );

    const plumberResult = await client.query(
      `INSERT INTO plumbers (name, phone, area)
       VALUES ('Ramesh Plumber', '9876500010', 'Indore')
       RETURNING id`
    );
    const plumberId = plumberResult.rows[0].id;

    const plumbingJobResult = await client.query(
      `INSERT INTO plumbing_jobs (lead_id, plumber_id, work_type, status, service_charge, scheduled_for, note)
       VALUES ($1, $2, 'pipeline', 'ongoing', 35000, CURRENT_TIMESTAMP + INTERVAL '1 day', 'Kitchen and utility pipeline line-up.')
       RETURNING id`,
      [leadTwo.id, plumberId]
    );
    await client.query(
      `INSERT INTO plumbing_materials (job_id, item_name, quantity, unit, price)
       VALUES
       ($1, 'CPVC Pipe', 30, 'meter', 140),
       ($1, 'Elbow Fitting', 12, 'pcs', 45)`,
      [plumbingJobResult.rows[0].id]
    );

    const projectOne = await client.query(
      `INSERT INTO projects (lead_id, project_code, project_name, status, start_date, expected_delivery_date, owner_note, created_by)
       VALUES ($1, 'PRJ-DEMO-001', 'Rahul Bathroom Upgrade', 'active', CURRENT_DATE, CURRENT_DATE + 14, 'High-visibility showroom conversion.', $2)
       RETURNING id`,
      [leadOne.id, adminId]
    );
    const projectTwo = await client.query(
      `INSERT INTO projects (lead_id, project_code, project_name, status, start_date, expected_delivery_date, owner_note, created_by)
       VALUES ($1, 'PRJ-DEMO-002', 'Agarwal Duplex Package', 'active', CURRENT_DATE, CURRENT_DATE + 30, 'Tiles + plumbing bundled project.', $2)
       RETURNING id`,
      [leadTwo.id, adminId]
    );

    await client.query(
      `INSERT INTO dispatches (project_id, item_name, quantity, vehicle_number, driver_name, dispatch_date, status, note)
       VALUES
       ($1, 'Aston Beige Tile', 120, 'MP09-AA-1122', 'Mahesh', CURRENT_TIMESTAMP + INTERVAL '3 day', 'pending', 'Awaiting final measurement'),
       ($2, 'Grande Living Tile', 220, 'MP09-BB-3344', 'Ravi', CURRENT_TIMESTAMP + INTERVAL '4 day', 'dispatched', 'First lot already loaded')`,
      [projectOne.rows[0].id, projectTwo.rows[0].id]
    );

    const schemeResult = await client.query(
      `INSERT INTO token_schemes (name, business_unit, token_value, min_redemption_tokens, description, is_active, created_by)
       VALUES ('Mason Launch Scheme', 'both', 500, 1, 'Demo launch rewards for masons.', TRUE, $1)
       RETURNING id`,
      [adminId]
    );
    await client.query(
      `INSERT INTO scheme_tokens (
         scheme_id, lead_id, redeemed_lead_id, issued_to_name, issued_to_phone, recipient_type, token_code,
         token_count, token_value, status, note, issued_by, redeemed_by, redeemed_at
       )
       VALUES ($1, $2, $2, 'Mukesh Mason', '9876500020', 'mason', 'TS-DEMO-001', 2, 500, 'redeemed', 'Settled against project labour', $3, $3, CURRENT_TIMESTAMP)`,
      [schemeResult.rows[0].id, leadTwo.id, adminId]
    );

    await client.query(
      `INSERT INTO expenses (category, expense_date, amount, note, created_by)
       VALUES
       ('rent', CURRENT_DATE, 25000, 'Monthly showroom rent', $1),
       ('transport', CURRENT_DATE, 8000, 'Dispatch and site visit fuel', $2),
       ('salary', CURRENT_DATE, 42000, 'Monthly support payroll', $3)`,
      [adminId, opsId, accountsId]
    );

    await client.query(
      `INSERT INTO complaints (
         lead_id, customer_name, phone, location, business_unit, category, priority, status,
         title, description, due_date, assigned_to, created_by
       )
       VALUES ($1, 'Mehta Residence', '9876500003', 'Dewas', 'plumbing', 'pressure_issue', 'high', 'assigned',
       'Kitchen pressure drop', 'Customer reported low water pressure after fitting change.', CURRENT_TIMESTAMP + INTERVAL '1 day', $2, $3)`,
      [leadThree.id, opsId, adminId]
    );

    await client.query("COMMIT");
    console.log("Demo data seeded successfully.");
    console.log("Demo admin: 9999999999 / Admin@123");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { query, pool } from "../src/db.js";

dotenv.config();

function getArg(flag) {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.split("=").slice(1).join("=") : "";
}

async function main() {
  const name = getArg("--name") || process.env.ADMIN_NAME || "";
  const phone = getArg("--phone") || process.env.ADMIN_PHONE || "";
  const password = getArg("--password") || process.env.ADMIN_PASSWORD || "";

  if (!name || !phone || !password) {
    console.error("Usage: node scripts/create-admin.js --name=Owner --phone=9999999999 --password=StrongPass123");
    process.exitCode = 1;
    return;
  }

  const existing = await query("SELECT id FROM users WHERE phone = $1 LIMIT 1", [phone]);

  if (existing.rowCount > 0) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await query(
      `UPDATE users
       SET name = $1, role = 'admin', password = $2
       WHERE phone = $3`,
      [name, hashedPassword, phone]
    );
    console.log(`Updated existing admin user for ${phone}`);
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO users (name, phone, role, password)
       VALUES ($1, $2, 'admin', $3)`,
      [name, phone, hashedPassword]
    );
    console.log(`Created admin user for ${phone}`);
  }
}

main()
  .catch((error) => {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

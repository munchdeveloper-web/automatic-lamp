import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Run `neon env pull` first.");
  process.exit(1);
}

const days = Number(process.env.LOCATION_RETENTION_DAYS ?? 30);
if (!Number.isInteger(days) || days < 1) {
  console.error("LOCATION_RETENTION_DAYS must be an integer >= 1.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const [row] = await sql`select prune_user_locations(${days}) as deleted_rows`;
console.log(`Pruned ${row.deleted_rows} user_locations row(s) older than ${days} days.`);

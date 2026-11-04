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

const JOB_NAME = "munch-prune-user-locations";
const SCHEDULE = "15 3 * * *"; // daily at 03:15 UTC
const COMMAND = `select public.prune_user_locations(${days});`;

const sql = neon(process.env.DATABASE_URL);

try {
  await sql`create extension if not exists pg_cron`;
} catch (error) {
  console.error("Could not enable pg_cron:", error.message);
  console.error("This project needs cron.database_name set on the compute endpoint.");
  console.error("Use `npm run db:prune` from an external scheduler as a fallback.");
  process.exit(1);
}

const [existing] = await sql`
  select jobid, schedule, command from cron.job where jobname = ${JOB_NAME}
`;

if (existing) {
  if (existing.schedule !== SCHEDULE || existing.command !== COMMAND) {
    console.error(`Job ${existing.jobid} exists with a different schedule.`);
    console.error("This database role cannot alter pg_cron jobs; unschedule it in the Neon SQL editor, then rerun db:retention.");
    process.exit(1);
  }
  console.log(`Retention job ${existing.jobid} already configured.`);
} else {
  await sql.query("select cron.schedule($1, $2, $3)", [JOB_NAME, SCHEDULE, COMMAND]);
}

const [job] = await sql`
  select jobid, jobname, schedule, command, active, username, database
  from cron.job
  where jobname = ${JOB_NAME}
`;

console.log(`Retention job ${job.jobid} ready on ${job.database}: ${job.schedule} UTC`);
console.log(`  ${job.command}`);
console.log(`  retention window: ${days} days`);

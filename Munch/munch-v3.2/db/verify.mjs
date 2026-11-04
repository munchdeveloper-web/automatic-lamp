import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Run `neon env pull` first.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const tables = await sql.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`);
console.log("tables:", tables.map((row) => row.table_name).join(", "));

const indexes = await sql.query(`
  select tablename, count(*)::int as count
  from pg_indexes
  where schemaname = 'public'
    and tablename in ('profiles', 'restaurants', 'saved_cravings', 'bookings', 'waitlists', 'user_locations')
  group by tablename
  order by tablename
`);
for (const row of indexes) console.log(`indexes ${row.tablename}: ${row.count}`);

const [counts] = await sql.query(`
  select
    (select count(*)::int from restaurants) as restaurants,
    (select count(*)::int from profiles) as profiles,
    (select count(*)::int from saved_cravings) as saved,
    (select count(*)::int from bookings) as bookings,
    (select count(*)::int from waitlists) as waitlists,
    (select count(*)::int from user_locations) as locations
`);
console.log("rows:", JSON.stringify(counts));

const areas = await sql.query(`
  select area_label, count(*)::int as places,
         count(rating)::int as rated,
         count(hours)::int as with_hours
  from restaurants
  group by area_label
  order by places desc
`);
for (const row of areas) {
  console.log(`  ${row.area_label}: ${row.places} places · ${row.rated} rated · ${row.with_hours} with hours`);
}

const [sample] = await sql.query(`
  select name, cuisine, rating, address,
         round(lat::numeric, 5) as lat, round(lng::numeric, 5) as lng,
         jsonb_array_length(hours -> 'friday') as friday_windows
  from restaurants
  where area_id = 'hayes-valley'
  order by rating desc nulls last
  limit 1
`);
console.log("sample:", JSON.stringify(sample));

const constraints = await sql.query(`
  select conrelid::regclass::text as table_name, conname, contype
  from pg_constraint
  where connamespace = 'public'::regnamespace
    and conrelid::regclass::text in ('profiles', 'restaurants', 'saved_cravings', 'bookings', 'waitlists')
  order by table_name, conname
`);
console.log("constraints:", constraints.length);

const [integrity] = await sql.query(`
  select count(*)::int as orphaned
  from restaurants r
  where r.lat is null or r.lng is null or r.name = ''
`);
console.log("integrity issues:", integrity.orphaned);

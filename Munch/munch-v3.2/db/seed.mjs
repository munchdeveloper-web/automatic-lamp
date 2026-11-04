import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Run `neon env pull` first.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const data = JSON.parse(
  await readFile(new URL("../src/data/places.json", import.meta.url), "utf8"),
);

const rows = data.areas.flatMap((area) =>
  area.restaurants.map((place) => ({
    id: place.id,
    slug: place.slug ?? null,
    area_id: area.id,
    area_label: area.label,
    city: area.city,
    name: place.name,
    cuisine: place.cuisine,
    categories: place.categories ?? [],
    rating: place.rating ?? null,
    review_count: place.reviews ?? null,
    price_level: place.priceLevel ?? null,
    address: place.address ?? "",
    neighborhood: place.neighborhood ?? null,
    lat: place.lat,
    lng: place.lng,
    phone: place.phone ?? null,
    website: place.website ?? null,
    maps_url: place.mapsUrl ?? null,
    hours: place.hours ?? null,
    timezone: place.tz ?? "America/Los_Angeles",
    source: "bundled",
  })),
);

const inserted = await sql.query(
  `insert into restaurants (
     id, slug, area_id, area_label, city, name, cuisine, categories,
     rating, review_count, price_level, address, neighborhood, lat, lng,
     phone, website, maps_url, hours, timezone, source
   )
   select
     x.id, x.slug, x.area_id, x.area_label, x.city, x.name, x.cuisine, x.categories,
     x.rating, x.review_count, x.price_level, x.address, x.neighborhood, x.lat, x.lng,
     x.phone, x.website, x.maps_url, x.hours, x.timezone, x.source
   from jsonb_to_recordset($1::jsonb) as x(
     id text, slug text, area_id text, area_label text, city text, name text,
     cuisine text, categories text[], rating numeric, review_count integer,
     price_level text, address text, neighborhood text,
     lat double precision, lng double precision,
     phone text, website text, maps_url text, hours jsonb,
     timezone text, source text
   )
   on conflict (id) do update set
     slug = excluded.slug,
     area_id = excluded.area_id,
     area_label = excluded.area_label,
     city = excluded.city,
     name = excluded.name,
     cuisine = excluded.cuisine,
     categories = excluded.categories,
     rating = excluded.rating,
     review_count = excluded.review_count,
     price_level = excluded.price_level,
     address = excluded.address,
     neighborhood = excluded.neighborhood,
     lat = excluded.lat,
     lng = excluded.lng,
     phone = excluded.phone,
     website = excluded.website,
     maps_url = excluded.maps_url,
     hours = excluded.hours,
     timezone = excluded.timezone,
     updated_at = now()
   where restaurants.source = 'bundled'
   returning id`,
  [JSON.stringify(rows)],
);

const [{ count }] = await sql.query("select count(*)::int as count from restaurants");
const byArea = await sql.query(
  "select area_label, count(*)::int as places from restaurants group by area_label order by places desc",
);

console.log(`Seeded ${inserted.length} bundled rows (catalogue now ${count}).`);
for (const area of byArea) console.log(`  ${area.area_label}: ${area.places}`);

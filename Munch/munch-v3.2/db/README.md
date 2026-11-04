# Munch database

Initial schema for the Neon project (production branch).

## Tables

| Table | Purpose |
| --- | --- |
| `profiles` | Diner identity used to scope saved places, bookings and waitlists. |
| `restaurants` | Venue catalogue: bundled places + live OpenStreetMap venues, exact lat/lng, hours, categories. |
| `saved_cravings` | One shortlist row per diner/venue, with `next` / `been` state. |
| `bookings` | Reservations with party size, date/time and status (`pending`, `confirmed`, `cancelled`). |
| `waitlists` | Queue entries; one active (`waiting`) entry per diner/venue. |
| `user_locations` | Append-only opt-in location history: lat/lng, accuracy (m), label, source, timestamps. |

Indexes cover area/cuisine/rating/lat-lng lookups, GIN category filtering, profile timelines,
restaurant booking lookups, active reservations and live queues. `user_locations` has recent
lookup indexes on `(profile_id, updated_at desc)` and `(profile_id, recorded_at desc)`;
`profiles.last_location` holds the latest snapshot. Foreign keys cascade for diner
data and protect restaurants that have bookings.

## Location retention

Location history is kept for **30 days** by default:

- `prune_user_locations(retention_days)` deletes rows older than the window and clears a stale
  `profiles.last_location` snapshot. It returns the number of history rows removed.
- `user_locations_updated_at_idx` supports the cleanup scan.
- `pg_cron` job `munch-prune-user-locations` runs `prune_user_locations(30)` daily at **03:15 UTC**
  against `neondb`.
- Change the window with `LOCATION_RETENTION_DAYS=14 npm run db:retention` (or pass a different
  number to the SQL function). A changed job needs to be unscheduled and recreated by an owner.

`pg_cron` requires `cron.database_name = neondb` on the compute endpoint; it is set for this
project. Jobs run while the compute is active, so on a scale-to-zero branch pruning may happen
on the next active period rather than at the exact minute. `npm run db:prune` is the fallback
for an external scheduler.

## Commands

```bash
npm run db:setup      # idempotent DDL
npm run db:seed       # upsert the 100 bundled places
npm run db:verify     # counts, indexes, constraints, sample row
npm run db:retention  # create/enable the daily pg_cron cleanup job
npm run db:prune      # run the cleanup now (or from an external scheduler)
```

Both scripts read `DATABASE_URL` from `.env.local` (pulled with `neon env pull`) and never print
credentials.

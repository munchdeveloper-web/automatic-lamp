# Identity and location — Clerk + Neon

This is the implemented version of the Clerk plan: real identities, a server-resolved internal
profile key, a saved area that is not a location, and account deletion.

## 1. Identity mapping

```text
Clerk session JWT
  └─ sub = user_2abc…
       └─ profiles.clerk_user_id (unique, nullable for the demo seed)
            └─ profiles.id (internal key used by every FK)
```

`profiles.clerk_user_id` is an external mapping, not a primary key. Diner data keeps its internal
key, so changing identity providers only rewrites the mapping.

The seeded `alex-rivera` profile has `clerk_user_id = NULL` and is never returned to a real user.

## 2. First request

1. The browser gets a short-lived Clerk token (`useAuth().getToken()`).
2. `POST /v1/location` or `GET /v1/session` sends `Authorization: Bearer <token>`.
3. The API calls `verifyToken` from `@clerk/backend` (signature + issuer + optional
   `authorizedParties`).
4. `resolve_profile(sub, name, email)` upserts the profile and returns the internal id.
5. The SQL function does the write atomically.

No webhook is required: the first authenticated request creates the profile.

## 3. Schema (migration `0004`)

```sql
alter table profiles add column clerk_user_id text;
alter table profiles add column email text;
alter table profiles add column last_area_id text;
alter table profiles add column last_area_source text
  check (last_area_source in ('gps','manual','default'));
alter table profiles add column last_area_updated_at timestamptz;

create unique index profiles_clerk_user_id_key on profiles (clerk_user_id);
```

Functions:

| Function | Purpose |
| --- | --- |
| `resolve_profile(clerk_id, name, email)` | upsert by Clerk id, return `profiles` |
| `save_user_location(profile, lat, lng, …)` | history row + `last_location` + optional area |
| `save_user_area(profile, area_id, source)` | area preference only, no history |
| `clear_user_location_history(profile)` | privacy action |
| `delete_user_profile(profile)` | cascade delete |
| `prune_user_locations(days)` | unchanged 30-day policy; clears stale `last_location` only |

`last_area_*` deliberately survives pruning: a neighbourhood preference is not a GPS fix.

## 4. What counts as a location update

| Source | History row | `last_location` | `last_area_*` |
| --- | --- | --- | --- |
| GPS fix (`source: "gps"`) | yes | yes | yes, when `area_id` supplied |
| Map-centre search (`source: "search"`) | yes (`source='map'`) | yes | only via `/v1/area` |
| Manual area pick | **no** | no | yes |
| Default area | no | no | `source='default'` |

The app currently posts GPS fixes only from `locate()` when the user lands inside a bundled area.
A continuous `watchPosition` should throttle to >25 m movement or >2 minutes.

## 5. Hydration

1. Clerk initialises; the splash waits for `isLoaded` with a 7 s ceiling.
2. The data provider is keyed by Clerk user id, so signing in/out discards prior state.
3. Scoped `localStorage` (`munch:<clerk_user_id>:…`) paints immediately.
4. With `VITE_MUNCH_API_URL` set, `GET /v1/session` then applies server values over the cache:
   - `last_area` first (deck/map opens in the right neighbourhood);
   - if there is no saved area, the diner lands on a **default world city**;
   - `last_location` is **not** restored on sign-in (v3.2 requirement). It stays in
     `user_locations` for history only; a fresh GPS fix is used only when the diner
     explicitly taps “Use my precise location”.
5. On API failure the scoped cache stays authoritative (offline-first).

World cities (`london`, `paris`, `new-york`, …) are first-class areas. Paris ships with a
real OSM snapshot so the first authenticated paint is instant, then refreshes live in the
background. The splash and first paint never wait on Overpass.

## 6. Security boundaries

- Verify signature and issuer on every request; never trust decoded claims.
- Never accept `profile_id` from the browser.
- Validate lat/lng, accuracy, area id, label length and source server-side **and** in SQL.
- Rate limit per Clerk user + IP (in-memory best effort; use Upstash/Neon in production).
- CORS allows the exact `APP_ORIGIN`; preflight permits `Authorization`.
- Never log tokens or raw location payloads.
- `CLERK_SECRET_KEY` and `DATABASE_URL` are server-only; only the publishable key is inlined.

## 7. Account deletion

`DELETE /v1/account` requires `{ "confirm": "DELETE" }`:

1. `delete_user_profile` removes the profile and cascades to cravings, bookings, waitlists and
   location history.
2. `clerkClient.users.deleteUser(sub)` removes the identity.
3. If Clerk fails, the response reports `warning` — data is gone and cannot be reattached.

The UI requires typing `DELETE` and keeps the safe action prominent.

## 8. Migration from anonymous local data

The v3 browser data (`munch:saved:v5`, `munch:area:v2`, …) is **not** merged automatically.
New accounts start clean; guests keep their own scoped demo data. A one-time import would need
explicit confirmation because it moves data from an anonymous browser into an account.

## 9. Setup checklist

- [ ] Create your own Clerk application.
- [ ] Add `VITE_CLERK_PUBLISHABLE_KEY` to the Vite environment.
- [ ] Deploy `server/munch-api.ts` with `DATABASE_URL`, `CLERK_SECRET_KEY`, `APP_ORIGIN`.
- [ ] Run `db/migrations/0004_clerk_identity.sql` on the target branch.
- [ ] Set `VITE_MUNCH_API_URL` and verify `GET /v1/session` with a real token.
- [ ] Confirm the plan supports the chosen function runtime (Neon Functions availability is the
      one piece that must be verified in the Neon dashboard).

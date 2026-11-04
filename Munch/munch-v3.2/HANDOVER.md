# Handover checklist

Everything below is created in **your own** accounts. Nothing of the previous owner's (keys,
project IDs, database, Clerk app, Resend domain) is included or needed.

## 0. Try it first (no accounts)
```bash
npm install && npm run dev
```
With no `.env.local` the app runs a labelled **demo identity**: data stays in the browser.

## 1. Accounts to create
| Service | Why | Notes |
| --- | --- | --- |
| **Clerk** | sign-up, sign-in, emailed six-digit code | copy publishable (`pk_…`) and secret (`sk_…`) keys |
| **Neon** (or any Postgres) | profiles, saved area, bookings | copy `DATABASE_URL` |
| **Resend** | invite emails | verify a sending domain, create an API key |
| **Host** | serves the site over HTTPS and runs `server/munch-api.ts` | Neon Functions, Vercel or Cloudflare Workers |

## 2. Configure
```bash
cp .env.example .env.local     # then fill in your values; never commit this file
npm run db:setup               # applies db/migrations/*.sql (including 0004)
npm run build                  # dist/index.html + PWA files from public/
```
Set `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_MUNCH_API_URL` at build time. Set `DATABASE_URL`,
`CLERK_SECRET_KEY`, `APP_ORIGIN`, `APP_URL`, `RESEND_API_KEY`, `RESEND_FROM` on the API host.
Secret keys must never use the `VITE_` prefix.

## 3. Verify before launch
1. Open the site over HTTPS, create an account, receive the email code, finish onboarding.
2. `GET /v1/session` with that session token returns `{ profile, last_area, last_location }`.
3. Share → invite by email delivers one test message.
4. Install it (address-bar icon, or Share → Add to Home Screen on iPhone).
5. Delete the test account from Profile and confirm the row is gone.

## 4. Third-party terms to review (not legal advice)
- **OpenStreetMap** data (venues) must stay credited — the map's attribution control does this.
  Live data can lag Google; each venue links to Google for verification.
- **Carto basemap tiles** — the free style is intended for light use; check their terms or switch
  to a paid or self-hosted tile provider before commercial launch.
- **Unsplash** photos are hot-linked by cuisine. Review their API guidelines or replace with your
  own photography.
- **Clerk / Resend / Neon** — your plan limits and terms apply.
- **Privacy**: the app handles email and approximate location. Publish a privacy policy; account
  deletion and 30-day location pruning (`npm run db:retention`) already exist.
- **Logo**: the ramen illustration (`public/icons/logo-source.png`) — confirm you hold the rights
  to transfer it.

## 5. Real restaurant photos (optional)
Out of the box, cards show clearly-labelled **"Sample photo"** imagery (Unsplash stock chosen by
cuisine). Photos resolve in this order:

1. **OpenStreetMap photo** — if a mapper tagged `image` or `wikimedia_commons` on the venue (free, sparse).
   Shown with an OpenStreetMap credit.
2. **Provider photo** — if you enable it (below). Shown with the photographer credit and "Google".
3. **Sample photo** — fallback, labelled as such.

To enable provider photos (Google Places API (New)):
1. In Google Cloud, enable *Places API (New)*, create an API key restricted to that API, and set a
   **budget alert and quota**. Photo lookups are billed per call.
2. Set `GOOGLE_PLACES_API_KEY` (and optionally `PHOTO_DAILY_CAP`) on the API host.
3. Rebuild the site with `VITE_MUNCH_REAL_PHOTOS=1` and `VITE_MUNCH_API_URL` set.
4. Photos load only for **signed-in** users via `GET /v1/photo`; the key never reaches the browser.

Terms: Google restricts long-term storage of photos and requires the photographer credit, so the API
keeps results in memory for an hour only and the UI shows the credit. Review Google's current terms.
Other options a developer can add behind the same `/v1/photo` route: Foursquare photos, or the
restaurant's own website image (with permission).

# munch. v3.3 — map-first, paper-cutout, real identity

A single-page React app for finding a table: swipe the deck, see the same spots on a precise
OpenStreetMap map, save cravings, book, and keep your area across devices.

v3.1 added the product layer: a noodle-bowl splash, a paper auth popup, skeletons, wide-screen
composition, and Clerk-backed accounts with deletion. v3.2 tightens it: a two-step onboarding,
world-city defaults, a verification-code step, sharing and Resend invites, Google reservation
links, equal deck controls and a cleaner header.

> **Buying or inheriting this project?** Start with [`HANDOVER.md`](HANDOVER.md). No account,
> key or project ID of the previous owner ships in this package.

## Install it (PWA)

munch. is an installable app. Serve the build over **HTTPS** and browsers offer *Install* /
*Add to Home Screen*: Chrome and Edge show an install icon in the address bar, Android shows an
install prompt, and on iPhone use Share → *Add to Home Screen*. It opens full-screen with the ramen
logo, caches its shell for offline launch, and never caches API calls, sign-in or map data.
Files: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*` (logo source:
`public/icons/logo-source.png`).

## Run it

```bash
npm install
npm run dev
```

Production build (single self-contained HTML, no server required):

```bash
npm run build   # dist/index.html
```

### Zero-config demo mode

With no `.env.local`, the app runs a clearly-labelled **demo identity**:

- sign up / sign in with any email + an 8-character password (nothing is sent anywhere)
- accounts and their data live only in this browser
- the auth card says “Demo identity — no Clerk key configured”

That is for review, never for production. Add the keys below to switch to verified accounts.

## Identity (Clerk)

```bash
# .env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…
VITE_MUNCH_API_URL=https://your-munch-api.example.com
```

`main.tsx` installs `<ClerkProvider>` only when a publishable key is present. The auth layer
(`src/auth/`) exposes one interface for Clerk and the demo backend, so the rest of the app never
imports an auth SDK.

- `profiles.clerk_user_id` maps the external Clerk `sub` to the internal `profiles.id`.
- The browser never sends `profile_id`; the API resolves it from a verified bearer token.
- Sign-out remounts the data provider, so one diner's cached area can never flash for another.
- Delete account (Profile → Account) removes the Munch profile, its rows, and the Clerk identity.
- The API also exposes `DELETE /v1/location` for “clear my location history”.

Full schema and request flow: [`docs/IDENTITY-AND-LOCATION.md`](docs/IDENTITY-AND-LOCATION.md).

## The Munch API

`server/munch-api.ts` is a framework-free Web `fetch` handler for Neon Functions, Vercel Edge,
Cloudflare Workers or Deno.

```bash
# server-side only
DATABASE_URL=postgresql://…
CLERK_SECRET_KEY=sk_test_…
APP_ORIGIN=https://app.example.com
```

Routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/v1/session` | profile + last location + last area |
| `POST` | `/v1/location` | GPS fix → history row + `last_location` |
| `DELETE` | `/v1/location` | clear location history |
| `POST` | `/v1/area` | manual area preference (no history) |
| `DELETE` | `/v1/account` | delete profile + Clerk identity |

See [`server/README.md`](server/README.md) for deploy notes and the CORS contract.

## What is in here

- `src/components/SplashScreen.tsx` — noodle-bowl splash, paper board, honest indeterminate state.
- `src/components/AuthDialog.tsx` — sign-in/sign-up popup; Clerk form or demo form.
- `src/components/TacoCollage.tsx` — twelve hand-placed taco cut-outs behind the auth popup.
- `src/components/Skeletons.tsx` — deck, list, page and map skeletons sharing the paper palette.
- `src/components/Onboarding.tsx` — neighbourhood → taste, reusing the auth paper visuals.
- `src/components/Profile.tsx` — real identity, account panel, typed-confirmation deletion.
- `src/components/MapPanel.tsx` — pins, GPS accuracy, foot routing, live OSM search, filters.
- `src/components/Discover.tsx` / `SwipeDeck.tsx` — gesture deck synced to the map.
- `src/store.tsx` — state, identity-scoped persistence, API hydration, geolocation.
- `src/v31.css` — v3.1 layer loaded after `index.css`; wide-screen rules and new components.
- `docs/DESIGN-NOTES.md` — the design and motion rules this build follows, with sources.

The v3 paper system (tokens, torn shapes, tape, stickers, grain) is unchanged; v3.1 only extends it.

## v3.2 changes

- Two-step onboarding after sign-up: world neighbourhood, then taste and dining style.
- Default place is Paris with a real OSM snapshot; 20 world cities in the picker, all live-refreshed.
- Verification-code step in the local demo (Clerk sends its own email code in production).
- Share sheet with WhatsApp / X / native share and Resend email invites.
- Google reservation and “verify details” links on every place.
- Equal deck controls, brighter Tasty/Nope stamps, fixed header action cluster and one search clear button.
- Tab entrance animation, tab-button spring, and motion across sheets and cards.

## Data & accuracy

- Bundled venues: the original 100-place Bay Area dataset with exact coordinates and hours.
- Live venues elsewhere: OpenStreetMap/Overpass (three mirrors) with a Nominatim fallback.
- Walking directions: OSRM foot profile, drawn with `MapRoute`.
- GPS uses `enableHighAccuracy`; the map shows the accuracy radius.
- Basemap: CARTO Voyager (OpenStreetMap data). Attribution stays visible.

## Neon database

This repo is linked to the Neon project **Munch.dev** in the **Munch** organization.

- Project: your own Neon project — branch `production`
- Local env: `.env.local` (never committed)
- Migrations: `db/migrations/0002…0004`

```bash
npm run db:setup
npm run db:seed
npm run db:verify
npm run db:retention   # daily 03:15 UTC prune
npm run db:prune
```

Apply `db/migrations/0004_clerk_identity.sql` before pointing the API at the database.
`user_locations` is still pruned after 30 days; `last_area_*` is a preference and survives.

## Design principles applied

The build follows rules distilled from three public design references (read, not installed —
custom skill installation is gated on this account):

- **Evidence over taste** — every interactive control has a name, a visible focus ring, and a
  keyboard path; reduced-motion disables every decorative animation.
- **Motion explains, never decorates** — one easing family (`--ease-out`/`--ease-spring`), short
  durations, transform/opacity only. Skeletons use a background-position shimmer, not layout.
- **One point of view** — the paper cut-out language is consistent: die-cut edges, layered
  shadows, tape, torn paper, hand-drawn type. No generic card-and-gradient fallback.
- **Bigger screens get more room, not smaller pictures** — the place sheet becomes a two-panel
  popup at ≥1120 px, the deck grows to 620 px at ≥2100 px, and the shell widens to 2120 px.

See [`docs/DESIGN-NOTES.md`](docs/DESIGN-NOTES.md) for the full checklist and source links.

## Notes

- Restaurant photos use licence-friendly Unsplash images selected by cuisine; a paper monogram
  appears if an image cannot load.
- Saved places, bookings, votes, alerts and waitlists use scoped `localStorage` keys, so guests
  and signed-in diners never share a cache.

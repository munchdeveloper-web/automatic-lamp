# Munch API

`munch-api.ts` exports a Web-standard `fetch(request, env)` handler. It runs unchanged on Neon
Functions, Vercel Edge Functions, Cloudflare Workers and Deno Deploy.

## Environment

| Name | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | server only | pooled Neon connection string |
| `CLERK_SECRET_KEY` | server only | never `VITE_`-prefixed |
| `APP_ORIGIN` | server only | exact browser origin, e.g. `https://munch.app` |
| `CLERK_AUTHORIZED_PARTIES` | server only | optional comma-separated allowlist |
| `RESEND_API_KEY` | server only | enables `/v1/invite` |
| `RESEND_FROM` | server only | verified sender, e.g. `munch. <hello@munch.app>` |
| `APP_URL` | server only | public app URL used in invite emails |

## CORS contract

- Allowed origin is echoed only when it matches `APP_ORIGIN` / `CLERK_AUTHORIZED_PARTIES`.
- Preflight: `OPTIONS` → `204`, allows `GET,POST,DELETE,OPTIONS` and `Authorization, Content-Type`.
- Responses are `Cache-Control: no-store`.

## Payloads

### `POST /v1/location`

```json
{
  "lat": 37.7765,
  "lng": -122.4241,
  "accuracy_m": 18,
  "label": "Hayes Valley",
  "area_id": "hayes-valley",
  "source": "gps"
}
```

Rejects non-numeric/out-of-range coordinates, accuracy outside `0…100000`, area ids that do not
match `^[a-z0-9][a-z0-9-]{0,63}$`, and sources other than `gps`/`search`.

### `POST /v1/area`

```json
{ "area_id": "hayes-valley", "source": "manual" }
```

Writes `last_area_*` only. It never creates a `user_locations` row.

### `POST /v1/invite`

```json
{
  "to": "friend@example.com",
  "placeName": "Nightbird",
  "shareUrl": "https://app.example.com/#discover",
  "fromName": "Sam",
  "message": "I thought of you for Nightbird."
}
```

Sends one transactional email through Resend. Requires `RESEND_API_KEY` and a verified
`RESEND_FROM` domain; rate-limited to 6 invites per user per minute.

### `DELETE /v1/account`

```json
{ "confirm": "DELETE" }
```

Deletes the profile (cascading) and then the Clerk identity. If Clerk removal fails the response
is still `200` with a `warning` field — the data is already gone.

## Local development

Any runtime that accepts a Web `fetch` handler works:

```ts
import api from "./server/munch-api";
export default { fetch: api.fetch };
```

Then point `VITE_MUNCH_API_URL` at that origin (no trailing slash).

## Limitations

- Rate limiting is an in-memory map. On multi-instance/serverless deployments, replace it with a
  shared store (Upstash Redis, Neon, or the platform's WAF).
- `resolve_profile` uses the token's `name`/`email` claims when present; it does not fetch the
  Clerk user on every request.
- `user_locations` keeps the original `gps|map|manual|ip` constraint; the API maps `search` to
  `map` for history while storing `search` in the JSON snapshot.

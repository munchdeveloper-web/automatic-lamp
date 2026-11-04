/**
 * munch. identity + location API — Web-standard fetch handler.
 *
 * Deploy targets: Neon Functions, Vercel Edge, Cloudflare Workers, Deno.
 * It is deliberately framework-free: `export default { fetch }`.
 *
 * Security boundaries
 *   • The Clerk session token is the ONLY identity input. No profile_id is
 *     ever accepted from the browser.
 *   • Issuer + signature are verified with @clerk/backend on every request.
 *   • CLERK_SECRET_KEY and DATABASE_URL never reach the client.
 *   • Inputs are validated here AND constrained in SQL.
 *   • Tokens and raw payloads are never logged.
 */

import { createClerkClient, verifyToken } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";

type Env = {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
  APP_ORIGIN?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  APP_URL?: string;
  /** Optional: real restaurant photos via Google Places (New). Billed per call. */
  GOOGLE_PLACES_API_KEY?: string;
  /** Hard ceiling on photo lookups per server instance per day. Default 300. */
  PHOTO_DAILY_CAP?: string;
};

type Claims = { sub: string; name?: string; email?: string };

const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(origin ? corsHeaders(origin) : {}),
    },
  });

function allowedOrigins(env: Env): string[] {
  return [env.APP_ORIGIN, env.CLERK_AUTHORIZED_PARTIES]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/* ---- best-effort rate limit (replace with Upstash/Neon for multi-region) -- */
const buckets = new Map<string, { count: number; reset: number }>();
function rateLimit(key: string, limit = 40, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

async function authenticate(request: Request, env: Env): Promise<Claims | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const payload = await verifyToken(match[1], {
      secretKey: env.CLERK_SECRET_KEY,
      ...(env.CLERK_AUTHORIZED_PARTIES
        ? { authorizedParties: env.CLERK_AUTHORIZED_PARTIES.split(",").map((v) => v.trim()) }
        : {}),
    });
    if (!payload?.sub) return null;
    return {
      sub: payload.sub,
      name: typeof (payload as Record<string, unknown>).name === "string"
        ? ((payload as Record<string, unknown>).name as string)
        : undefined,
      email: typeof (payload as Record<string, unknown>).email === "string"
        ? ((payload as Record<string, unknown>).email as string)
        : undefined,
    };
  } catch {
    // Never log the token or the verifier error detail.
    return null;
  }
}

function validCoord(lat: unknown, lng: unknown) {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

const AREA_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/* ---- real venue photos (optional, Google Places New) ------------------------
 * Two billed calls per uncached venue: Text Search (finds the place) and the
 * photo media call. Results are held in memory only for a short time; Google's
 * terms restrict long-term storage of photos, so nothing is written to the DB.
 * The key stays on the server. Callers must be signed in (see handler). */
type PhotoResult = { url: string | null; credit: string | null };
const photoCache = new Map<string, { at: number; value: PhotoResult }>();
const PHOTO_TTL_MS = 60 * 60 * 1000;
let photoDay = "";
let photoCalls = 0;

function underPhotoCap(env: Env) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== photoDay) {
    photoDay = today;
    photoCalls = 0;
  }
  const cap = Math.max(0, Number(env.PHOTO_DAILY_CAP ?? 300) || 0);
  if (photoCalls >= cap) return false;
  photoCalls += 1;
  return true;
}

async function lookupGooglePhoto(
  env: Env,
  name: string,
  lat: number,
  lng: number,
  width: number,
): Promise<PhotoResult> {
  const key = env.GOOGLE_PLACES_API_KEY as string;
  const search = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
    },
    body: JSON.stringify({
      textQuery: name,
      maxResultCount: 1,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 150 } },
    }),
  });
  if (!search.ok) return { url: null, credit: null };
  const found = (await search.json()) as {
    places?: { photos?: { name?: string; authorAttributions?: { displayName?: string }[] }[] }[];
  };
  const photo = found.places?.[0]?.photos?.[0];
  if (!photo?.name) return { url: null, credit: null };

  const media = await fetch(
    `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=${width}&skipHttpRedirect=true&key=${encodeURIComponent(key)}`,
  );
  if (!media.ok) return { url: null, credit: null };
  const body = (await media.json()) as { photoUri?: string };
  return {
    url: body.photoUri ?? null,
    credit: photo.authorAttributions?.[0]?.displayName ?? null,
  };
}


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origins = allowedOrigins(env);
    const requestOrigin = request.headers.get("origin") ?? "";
    const origin = origins.includes(requestOrigin) ? requestOrigin : origins[0] ?? null;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: origin ? corsHeaders(origin) : {} });
    }

    if (!env.DATABASE_URL || !env.CLERK_SECRET_KEY) {
      return json({ error: "API is not configured" }, 503, origin);
    }

    const claims = await authenticate(request, env);
    if (!claims) return json({ error: "Unauthorized" }, 401, origin);

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit(`${claims.sub}:${clientIp}`)) {
      return json({ error: "Too many requests" }, 429, origin);
    }

    /* ---- GET /v1/photo?name&lat&lng&w — real venue photo, if configured --- */
    if (request.method === "GET" && url.pathname === "/v1/photo") {
      if (!env.GOOGLE_PLACES_API_KEY) return json({ error: "Photo provider not configured" }, 501, origin);
      const name = (url.searchParams.get("name") ?? "").trim().slice(0, 120);
      const lat = Number(url.searchParams.get("lat"));
      const lng = Number(url.searchParams.get("lng"));
      const width = Math.min(1200, Math.max(120, Math.round(Number(url.searchParams.get("w")) || 800)));
      if (!name || !validCoord(lat, lng)) return json({ error: "Invalid photo request" }, 400, origin);
      if (!rateLimit(`photo:${claims.sub}`, 60)) return json({ error: "Too many photo requests" }, 429, origin);

      const cacheKey = `${name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}|${width}`;
      const hit = photoCache.get(cacheKey);
      if (hit && Date.now() - hit.at < PHOTO_TTL_MS) return json(hit.value, 200, origin);
      if (!underPhotoCap(env)) return json({ url: null, credit: null, capped: true }, 200, origin);
      try {
        const value = await lookupGooglePhoto(env, name, lat, lng, width);
        photoCache.set(cacheKey, { at: Date.now(), value });
        return json(value, 200, origin);
      } catch {
        return json({ url: null, credit: null }, 200, origin);
      }
    }

    const sql = neon(env.DATABASE_URL);

    // Resolve (or create) the internal profile key from the verified subject.
    const profileRows = await sql`
      select * from resolve_profile(${claims.sub}, ${claims.name ?? "Diner"}, ${claims.email ?? null})
    `;
    const profile = profileRows[0] as Record<string, unknown> | undefined;
    if (!profile) return json({ error: "Profile unavailable" }, 500, origin);
    const profileId = String(profile.id);

    /* ---- GET /v1/session ------------------------------------------------ */
    if (request.method === "GET" && url.pathname === "/v1/session") {
      const snapshot = (profile.last_location ?? null) as Record<string, unknown> | null;
      return json(
        {
          profile: {
            id: profileId,
            display_name: profile.display_name ?? null,
            email: profile.email ?? null,
            last_area_id: profile.last_area_id ?? null,
            last_area_source: profile.last_area_source ?? null,
            last_area_updated_at: profile.last_area_updated_at ?? null,
          },
          last_location: snapshot
            ? {
                lat: snapshot.lat,
                lng: snapshot.lng,
                accuracy_m: snapshot.accuracy_m ?? null,
                label: snapshot.label ?? null,
                area_id: snapshot.area_id ?? null,
                source: snapshot.source ?? "gps",
                captured_at: snapshot.captured_at ?? null,
              }
            : null,
          last_area: profile.last_area_id
            ? { id: profile.last_area_id, source: profile.last_area_source ?? "manual" }
            : null,
        },
        200,
        origin,
      );
    }

    /* ---- POST /v1/location — GPS fix only ------------------------------- */
    if (request.method === "POST" && url.pathname === "/v1/location") {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return json({ error: "Invalid JSON" }, 400, origin);

      const { lat, lng } = body;
      if (!validCoord(lat, lng)) return json({ error: "lat/lng out of range" }, 400, origin);

      const source = body.source === "search" ? "search" : "gps";
      const areaId = typeof body.area_id === "string" && AREA_RE.test(body.area_id) ? body.area_id : null;
      const accuracy =
        typeof body.accuracy_m === "number" && body.accuracy_m >= 0 && body.accuracy_m <= 100000
          ? body.accuracy_m
          : null;
      const label = typeof body.label === "string" ? body.label.slice(0, 120) : null;

      const rows = await sql`
        select save_user_location(
          ${profileId},
          ${lat as number},
          ${lng as number},
          ${accuracy},
          ${label},
          ${areaId},
          ${source}
        ) as snap
      `;
      return json((rows[0] as { snap: unknown }).snap, 200, origin);
    }

    /* ---- DELETE /v1/location — clear history ---------------------------- */
    if (request.method === "DELETE" && url.pathname === "/v1/location") {
      const rows = await sql`select clear_user_location_history(${profileId}) as removed`;
      return json({ ok: true, removed: (rows[0] as { removed: number }).removed }, 200, origin);
    }

    /* ---- POST /v1/area — preference, never history ---------------------- */
    if (request.method === "POST" && url.pathname === "/v1/area") {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.area_id !== "string" || !AREA_RE.test(body.area_id)) {
        return json({ error: "invalid area_id" }, 400, origin);
      }
      const source = body.source === "gps" || body.source === "default" ? body.source : "manual";
      const rows = await sql`select save_user_area(${profileId}, ${body.area_id}, ${source}) as area`;
      return json((rows[0] as { area: unknown }).area, 200, origin);
    }

    /* ---- POST /v1/invite — transactional email through Resend ---------- */
    if (request.method === "POST" && url.pathname === "/v1/invite") {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const to = typeof body?.to === "string" ? body.to.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to) || to.length > 254) {
        return json({ error: "invalid recipient email" }, 400, origin);
      }
      if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
        return json({ error: "Email is not configured" }, 503, origin);
      }
      if (!rateLimit(`invite:${claims.sub}`, 6, 60_000)) {
        return json({ error: "Too many invites. Try again in a minute." }, 429, origin);
      }

      const placeName =
        typeof body?.placeName === "string" ? body.placeName.slice(0, 120) : "somewhere good";
      const fromName = typeof body?.fromName === "string" ? body.fromName.slice(0, 80) : "A friend";
      const shareUrl =
        typeof body?.shareUrl === "string" && /^https?:\/\//.test(body.shareUrl)
          ? body.shareUrl.slice(0, 400)
          : env.APP_URL ?? "https://munch.app";
      const note = typeof body?.message === "string" ? body.message.slice(0, 300) : "";

      const safe = (value: string) =>
        value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);

      const html = `<!doctype html><html><body style="margin:0;background:#eadfc8;font-family:Nunito,Arial,sans-serif;color:#2d2216">
        <div style="max-width:520px;margin:32px auto;background:#fffdf5;border:1.5px solid #c9b895;border-radius:22px;padding:32px">
          <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#4f6d47;font-weight:800;margin:0 0 8px">munch. invitation</p>
          <h1 style="font-size:30px;line-height:1.1;margin:0 0 12px">${safe(fromName)} wants to eat at ${safe(placeName)}.</h1>
          <p style="font-size:15px;line-height:1.6;color:#6e5f4c;margin:0 0 18px">
            ${note ? `${safe(note)}<br/><br/>` : ""}Open munch. to see the place, save a craving, and find your own table.
          </p>
          <a href="${safe(shareUrl)}" style="display:inline-block;background:#ae3a22;color:#fff7e6;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px">Open munch.</a>
          <p style="font-size:11px;color:#8a7a62;margin:24px 0 0">You received this because someone invited you. No account was created.</p>
        </div>
      </body></html>`;

      const resend = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          to: [to],
          subject: `${fromName} invited you to ${placeName} on munch.`,
          html,
        }),
      });

      if (!resend.ok) {
        return json({ error: "The email provider rejected the invite." }, 502, origin);
      }
      const sent = (await resend.json().catch(() => ({}))) as { id?: string };
      return json({ ok: true, id: sent.id }, 200, origin);
    }

    /* ---- DELETE /v1/account -------------------------------------------- */
    if (request.method === "DELETE" && url.pathname === "/v1/account") {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (body?.confirm !== "DELETE") {
        return json({ error: "Confirmation required" }, 400, origin);
      }

      const rows = await sql`select delete_user_profile(${profileId}) as deleted`;
      const deleted = Boolean((rows[0] as { deleted: boolean }).deleted);

      // Remove the identity too, so the account cannot sign back into an
      // empty profile. DB first: a Clerk failure leaves no orphaned data.
      try {
        await createClerkClient({ secretKey: env.CLERK_SECRET_KEY }).users.deleteUser(claims.sub);
      } catch {
        return json(
          { ok: deleted, deleted_profile: deleted, warning: "Profile deleted; Clerk identity removal failed." },
          200,
          origin,
        );
      }

      return json({ ok: true, deleted_profile: deleted }, 200, origin);
    }

    return json({ error: "Not found" }, 404, origin);
  },
};

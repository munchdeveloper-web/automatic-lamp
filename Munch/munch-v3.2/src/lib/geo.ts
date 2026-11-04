import type { Place } from "@/lib/types";
import { parseOpeningHours } from "@/lib/hours";

export function haversineMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function miles(value: number): string {
  return value < 9.95 ? value.toFixed(1) : String(Math.round(value));
}

export function distanceLabel(value: number, precise = false): string {
  if (value < 0.05) return precise ? "Here" : "Nearby";
  return `${miles(value)} mi`;
}

export function radiusLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function nearestArea<T extends { center: { lat: number; lng: number } }>(
  point: { lat: number; lng: number },
  areas: T[],
): { area: T; distance: number } {
  return areas
    .map((area) => ({ area, distance: haversineMi(point, area.center) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

/* ------------------------------------------------------------------ *
 * Routing — OSRM foot profile, real street geometry, no API key.
 * ------------------------------------------------------------------ */
export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<{ coordinates: [number, number][]; meters: number; minutes: number } | null> {
  const url =
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`;
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;
    return {
      coordinates: route.geometry.coordinates as [number, number][],
      meters: route.distance,
      minutes: Math.max(1, Math.round(route.duration / 60)),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Live places — Overpass, which is the accurate open database behind
 * OpenStreetMap. We ask for named food venues only, with a centre for
 * ways and relations, then keep the coordinates the map will draw.
 * ------------------------------------------------------------------ */
type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const FOOD_AMENITIES = "restaurant|cafe|fast_food|bar|pub|food_court|ice_cream";

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Free, real photos: only when mappers added an `image` URL or a Wikimedia Commons file. */
function osmPhoto(tags: Record<string, string>): string | undefined {
  const image = tags.image || tags["contact:image"];
  if (image && /^https:\/\//i.test(image)) return image;
  const commons = tags.wikimedia_commons;
  if (commons && /^File:/i.test(commons)) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons.replace(/^File:/i, ""))}?width=1200`;
  }
  return undefined;
}

export function osmToPlace(element: OverpassElement, anchor: { lat: number; lng: number }): Place | null {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  const name = tags.name;
  if (!name || lat === undefined || lng === undefined) return null;

  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const address = street || tags["addr:full"] || tags["addr:place"] || "";
  const cuisine = tags.cuisine ? titleCase(tags.cuisine.split(";")[0]) : titleCase(tags.amenity || "Restaurant");

  return {
    id: `osm:${element.type}:${element.id}`,
    area: "live",
    name,
    cuisine,
    categories: [cuisine, ...(tags.amenity ? [titleCase(tags.amenity)] : [])].filter(
      (value, index, list) => list.indexOf(value) === index,
    ),
    rating: null,
    reviews: null,
    priceLevel: null,
    address,
    neighborhood: tags["addr:suburb"] || "",
    lat,
    lng,
    phone: tags.phone || tags["contact:phone"] || null,
    website: tags.website || tags["contact:website"] || null,
    hours: parseOpeningHours(tags.opening_hours || ""),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    photo: osmPhoto(tags),
    photoKind: osmPhoto(tags) ? "osm" : undefined,
    source: "osm",
    osmType: element.type,
    cuisineSource: tags.cuisine,
  };
}

const OVERPASS_MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function overpassRequest(query: string, timeoutMs = 9000): Promise<OverpassElement[]> {
  const controllers: AbortController[] = [];
  const attempts = OVERPASS_MIRRORS.map((endpoint) => {
    const controller = new AbortController();
    controllers.push(controller);
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
      signal: controller.signal,
    })
      .then(async (response) => {
        window.clearTimeout(timer);
        if (!response.ok) throw new Error(`Overpass ${response.status}`);
        const data = await response.json();
        controllers.forEach((item) => item.abort());
        return data.elements as OverpassElement[];
      })
      .catch((error) => {
        window.clearTimeout(timer);
        throw error;
      });
  });
  return Promise.any(attempts);
}

/* Nominatim is the same OpenStreetMap database through a different door. Used
   only when every Overpass mirror is down, so live discovery still returns
   real venues instead of an apology. */
async function nominatimNearby(
  anchor: { lat: number; lng: number },
  radiusMi: number,
  signal?: AbortSignal,
) {
  const latDelta = radiusMi / 69;
  const lngDelta = radiusMi / (69 * Math.max(0.2, Math.cos((anchor.lat * Math.PI) / 180)));
  const viewbox = [
    anchor.lng - lngDelta,
    anchor.lat + latDelta,
    anchor.lng + lngDelta,
    anchor.lat - latDelta,
  ].join(",");
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=50&bounded=1&addressdetails=1` +
    `&extratags=1&namedetails=1&viewbox=${viewbox}&q=restaurant`;
  const response = await fetch(url, { signal, headers: { "Accept-Language": "en" } });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const rows = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    namedetails?: { name?: string };
    extratags?: Record<string, string>;
    address?: Record<string, string>;
  }>;
  return rows
    .filter((row) => row.namedetails?.name || row.extratags?.name)
    .map((row) => {
      const tags = row.extratags || {};
      const name = row.namedetails?.name || tags.name || row.display_name.split(",")[0];
      return osmToPlace(
        {
          type: "node",
          id: Number(String(row.display_name).length * 7919 + Math.round(Number(row.lat) * 1e5)),
          lat: Number(row.lat),
          lon: Number(row.lon),
          tags: {
            name,
            amenity: tags.amenity || "restaurant",
            cuisine: tags.cuisine || "",
            "addr:street": row.address?.road || "",
            "addr:housenumber": row.address?.house_number || "",
            "addr:suburb": row.address?.suburb || row.address?.neighbourhood || "",
            opening_hours: tags.opening_hours || "",
            phone: tags.phone || "",
            website: tags.website || "",
          },
        },
        anchor,
      );
    })
    .filter((place): place is Place => Boolean(place));
}

export async function fetchNearbyOsm(
  anchor: { lat: number; lng: number },
  radiusMi: number,
  signal?: AbortSignal,
): Promise<Place[]> {
  const meters = Math.round(radiusMi * 1609.34);
  const query = `[out:json][timeout:20];
(
  node["amenity"~"${FOOD_AMENITIES}"]["name"](around:${meters},${anchor.lat},${anchor.lng});
  way["amenity"~"${FOOD_AMENITIES}"]["name"](around:${meters},${anchor.lat},${anchor.lng});
);
out center tags 120;`;

  let elements: OverpassElement[] = [];
  try {
    elements = await overpassRequest(query);
  } catch {
    elements = [];
  }

  let places = elements
    .map((element) => osmToPlace(element, anchor))
    .filter((place): place is Place => Boolean(place));

  if (!places.length) {
    try {
      places = await nominatimNearby(anchor, radiusMi, signal);
    } catch {
      throw new Error("OpenStreetMap lookup failed");
    }
  }

  const seen = new Set<string>();
  return places
    .filter((place) => {
      const key = `${place.name.toLowerCase()}|${place.lat.toFixed(4)}|${place.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => haversineMi(anchor, a) - haversineMi(anchor, b));
}

export async function searchOsmName(
  query: string,
  anchor: { lat: number; lng: number },
  radiusMi = 3,
  signal?: AbortSignal,
): Promise<Place[]> {
  const meters = Math.round(radiusMi * 1609.34);
  const escaped = query.replace(/["\\]/g, "").slice(0, 60);
  const body = `[out:json][timeout:25];
(
  node["amenity"~"${FOOD_AMENITIES}"]["name"~"${escaped}",i](around:${meters},${anchor.lat},${anchor.lng});
  way["amenity"~"${FOOD_AMENITIES}"]["name"~"${escaped}",i](around:${meters},${anchor.lat},${anchor.lng});
);
out center tags 40;`;
  const elements = await overpassRequest(body);
  return elements
    .map((element) => osmToPlace(element, anchor))
    .filter((place): place is Place => Boolean(place));
}

export async function reverseGeocode(point: { lat: number; lng: number }, signal?: AbortSignal) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&lat=${point.lat}&lon=${point.lng}`;
    const response = await fetch(url, { signal, headers: { "Accept-Language": "en" } });
    if (!response.ok) return null;
    const data = await response.json();
    const address = data.address || {};
    const name =
      address.neighbourhood || address.suburb || address.quarter || address.city_district || address.city || "";
    return {
      name: name || data.name || "Near you",
      city: address.city || address.town || address.village || address.county || "",
    };
  } catch {
    return null;
  }
}

export function formatPhone(phone?: string | null): string {
  if (!phone) return "";
  const national = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return phone;
}

export function websiteLabel(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

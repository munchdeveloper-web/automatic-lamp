import raw from "@/data/places.json";
import worldRaw from "@/data/world-places.json";
import type { Area, Place } from "@/lib/types";

type RawPlace = Omit<Place, "source"> & { photo?: string };

const areas = raw.areas as unknown as (Omit<Area, "restaurants"> & {
  restaurants: RawPlace[];
})[];

/* The original app pointed at downloaded Google photos. Those assets are not
   shipped with this build, so each place borrows a licence-friendly Unsplash
   photo from its cuisine family — deterministic, so a place never changes face
   between visits. */
const PHOTOS: Record<string, string[]> = {
  italian: [
    "photo-1513104890138-7c749659a591",
    "photo-1574071318508-1cdbab80d002",
    "photo-1473093295043-cdd812d0e601",
    "photo-1551183053-bf91a1d81141",
  ],
  mexican: [
    "photo-1551504734-5ee1c4a1479b",
    "photo-1565299585323-38d6b0865b47",
    "photo-1552332386-f8dd00dc2f85",
  ],
  asian: [
    "photo-1569718212165-3a8278d5f624",
    "photo-1552611052-33e04de081de",
    "photo-1512058564366-18510be2db19",
    "photo-1547592180-85f173990554",
  ],
  sushi: ["photo-1579584425555-c3ce17fd4351", "photo-1553621042-f6e147245754"],
  burger: ["photo-1568901346375-23c9450c58cd", "photo-1550547660-d9450f859349", "photo-1571091718767-18b5b1457add"],
  brunch: ["photo-1504754524776-8f4f37790ca0", "photo-1533089860892-a7c6f0a88666", "photo-1567620905732-2d1ec7ab7445"],
  cafe: ["photo-1541544741938-0af808871cc0", "photo-1495474472287-4d71bcdd2085", "photo-1551024506-0bccd828d307"],
  french: ["photo-1414235077428-338989a2e8c0", "photo-1559847844-5315695dadae", "photo-1559339352-11d035aa65de"],
  seafood: ["photo-1559737558-2f5a35f4523b", "photo-1553163147-622ab57be1c7"],
  bbq: ["photo-1544025162-d76694265947", "photo-1529193591184-b1d58069ecdd"],
  mediterranean: ["photo-1540189549336-e6e99c3679fe", "photo-1512621776951-a57141f2eefd", "photo-1505253716362-afaea1d3d1af"],
  indian: ["photo-1585937421612-70a008356fbe", "photo-1466978913421-dad2ebd01d17"],
  korean: ["photo-1498654896293-37aacf113fd9", "photo-1546069901-ba9599a7e63c"],
  bar: ["photo-1514933651103-005eec06c04b", "photo-1533777324565-a040eb52facd", "photo-1528605248644-14dd04022da1"],
  fine: ["photo-1559847844-5315695dadae", "photo-1414235077428-338989a2e8c0", "photo-1559339352-11d035aa65de"],
  bowl: ["photo-1546069901-ba9599a7e63c", "photo-1512621776951-a57141f2eefd", "photo-1481931098730-318b6f776db0"],
  default: ["photo-1504674900247-0877df9cc836", "photo-1555939594-58d7cb561ad1", "photo-1528605248644-14dd04022da1"],
};

function familyFor(place: RawPlace): string {
  const text = `${place.cuisine} ${(place.categories || []).join(" ")}`.toLowerCase();
  if (/pizza|italian|pasta|californian|new american/.test(text)) return "italian";
  if (/mexican|taco|burrito/.test(text)) return "mexican";
  if (/sushi|japanese/.test(text)) return "sushi";
  if (/ramen|vietnamese|thai|chinese|burmese|asian|nepalese|filipino|dumpling/.test(text)) return "asian";
  if (/hamburger|burger|hot dog|fast food|sandwich/.test(text)) return "burger";
  if (/breakfast|brunch|bakery/.test(text)) return "brunch";
  if (/cafe|coffee|dessert/.test(text)) return "cafe";
  if (/french|european/.test(text)) return "french";
  if (/seafood|oyster|fish/.test(text)) return "seafood";
  if (/barbecue|bbq|steak|bar & grill|sports bar/.test(text)) return "bbq";
  if (/mediterranean|greek|eritrean|lebanese|hummus/.test(text)) return "mediterranean";
  if (/indian/.test(text)) return "indian";
  if (/korean/.test(text)) return "korean";
  if (/bar|brewery|pub|live music/.test(text)) return "bar";
  if (/fine dining/.test(text)) return "fine";
  return "default";
}

export function photoFor(place: Place, width = 1200): string {
  const family = familyFor(place);
  const list = PHOTOS[family] || PHOTOS.default;
  let hash = 0;
  for (let i = 0; i < place.name.length; i += 1) hash = (hash * 31 + place.name.charCodeAt(i)) % 9973;
  const photo = place.photo as string | undefined;
  const id = photo?.startsWith("http") ? null : list[hash % list.length];
  return id
    ? `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=72`
    : (photo as string);
}

const LOCAL_AREAS: Area[] = areas.map((area) => ({
  ...area,
  restaurants: area.restaurants.map((place) => ({
    ...place,
    source: "bundled" as const,
    tz: "America/Los_Angeles",
    hours: place.hours as Place["hours"],
  })),
}));

/* --------------------------------------------------------------------------
   Default places around the world. These carry no bundled venues: selecting
   one runs a live OpenStreetMap search around its centre, so the catalogue is
   never a stale US-only copy. `live` lets the UI label them honestly.
   -------------------------------------------------------------------------- */
const WORLD_CENTRES: Array<{ id: string; label: string; city: string; lat: number; lng: number }> = [
  { id: "london", label: "London", city: "United Kingdom", lat: 51.5074, lng: -0.1278 },
  { id: "new-york", label: "New York", city: "United States", lat: 40.7128, lng: -74.006 },
  { id: "paris", label: "Paris", city: "France", lat: 48.8566, lng: 2.3522 },
  { id: "tokyo", label: "Tokyo", city: "Japan", lat: 35.6762, lng: 139.6503 },
  { id: "barcelona", label: "Barcelona", city: "Spain", lat: 41.3874, lng: 2.1686 },
  { id: "mexico-city", label: "Mexico City", city: "Mexico", lat: 19.4326, lng: -99.1332 },
  { id: "toronto", label: "Toronto", city: "Canada", lat: 43.6532, lng: -79.3832 },
  { id: "berlin", label: "Berlin", city: "Germany", lat: 52.52, lng: 13.405 },
  { id: "sydney", label: "Sydney", city: "Australia", lat: -33.8688, lng: 151.2093 },
  { id: "singapore", label: "Singapore", city: "Singapore", lat: 1.3521, lng: 103.8198 },
  { id: "dubai", label: "Dubai", city: "United Arab Emirates", lat: 25.2048, lng: 55.2708 },
  { id: "sao-paulo", label: "São Paulo", city: "Brazil", lat: -23.5505, lng: -46.6333 },
  { id: "cape-town", label: "Cape Town", city: "South Africa", lat: -33.9249, lng: 18.4241 },
  { id: "mumbai", label: "Mumbai", city: "India", lat: 19.076, lng: 72.8777 },
  { id: "seoul", label: "Seoul", city: "South Korea", lat: 37.5665, lng: 126.978 },
  { id: "bangkok", label: "Bangkok", city: "Thailand", lat: 13.7563, lng: 100.5018 },
  { id: "rome", label: "Rome", city: "Italy", lat: 41.9028, lng: 12.4964 },
  { id: "amsterdam", label: "Amsterdam", city: "Netherlands", lat: 52.3676, lng: 4.9041 },
  { id: "lisbon", label: "Lisbon", city: "Portugal", lat: 38.7223, lng: -9.1393 },
  { id: "istanbul", label: "Istanbul", city: "Türkiye", lat: 41.0082, lng: 28.9784 },
];

/* A small, real OpenStreetMap snapshot keeps the first world-city paint
   instant and offline; selecting the city refreshes it live in the background. */
const WORLD_STARTERS = worldRaw as unknown as Record<string, Place[]>;

export const WORLD_AREAS: Area[] = WORLD_CENTRES.map((city) => ({
  id: city.id,
  label: city.label,
  city: city.city,
  center: { lat: city.lat, lng: city.lng },
  restaurants: (WORLD_STARTERS[city.id] ?? []).map((place) => ({
    ...place,
    source: "osm" as const,
    hours: place.hours ?? null,
  })),
  live: true,
}));

export const AREAS: Area[] = [...LOCAL_AREAS, ...WORLD_AREAS];
export const LOCAL_AREA_IDS = new Set(LOCAL_AREAS.map((area) => area.id));

export const ALL_PLACES: Place[] = AREAS.flatMap((area) => area.restaurants);

export const DEFAULT_AREA = "paris";

export function isLiveArea(area: Area) {
  return area.live === true || area.restaurants.length === 0;
}

/** Stable per-identity default so a diner returns to the same world city. */
export function defaultAreaFor(seed: string): string {
  if (!seed) return DEFAULT_AREA;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const ready = WORLD_AREAS.filter((area) => area.restaurants.length > 0);
  const pool = ready.length ? ready : WORLD_AREAS;
  return pool[Math.abs(hash) % pool.length].id;
}

export function areaById(id: string): Area {
  return AREAS.find((area) => area.id === id) || LOCAL_AREAS[0];
}

export function placeById(id: string, extra: Place[] = []): Place | null {
  return ALL_PLACES.find((p) => p.id === id) || extra.find((p) => p.id === id) || null;
}

export const CUISINE_GROUPS = [
  "All",
  "Italian",
  "Mexican",
  "Asian",
  "Sushi",
  "Burgers",
  "Brunch",
  "Cafe",
  "Seafood",
  "Mediterranean",
  "Indian",
  "Korean",
  "Bar",
];

export function cuisineGroup(place: Place): string {
  const f = familyFor(place as RawPlace);
  const map: Record<string, string> = {

    italian: "Italian",
    mexican: "Mexican",
    asian: "Asian",
    sushi: "Sushi",
    burger: "Burgers",
    brunch: "Brunch",
    cafe: "Cafe",
    french: "French",
    seafood: "Seafood",
    bbq: "BBQ",
    mediterranean: "Mediterranean",
    indian: "Indian",
    korean: "Korean",
    bar: "Bar",
    fine: "Fine dining",
    bowl: "Bowls",
    default: "Other",
  };
  return map[f] || "Other";
}

export const CUISINES = Array.from(
  new Set(ALL_PLACES.map((place) => place.cuisine).filter(Boolean)),
).sort((a, b) => a.localeCompare(b));

export type HoursMap = Record<string, [number, number][]>;

export type Place = {
  id: string;
  slug?: string;
  area: string;
  name: string;
  cuisine: string;
  categories: string[];
  rating: number | null;
  reviews: number | null;
  priceLevel: string | null;
  address: string;
  neighborhood?: string;
  lat: number;
  lng: number;
  phone?: string | null;
  website?: string | null;
  placeId?: string;
  mapsUrl?: string;
  hours: HoursMap | null;
  photo?: string;
  /** Where `photo` came from. Absent means the app shows a clearly-labelled sample photo. */
  photoKind?: "osm" | "provider";
  photoCredit?: string;
  tz?: string;
  source?: "bundled" | "osm";
  osmType?: string;
  cuisineSource?: string;
};

export type Area = {
  id: string;
  label: string;
  city: string;
  center: { lat: number; lng: number };
  restaurants: Place[];
  /** True for a world centre whose venues come from live OSM, not the bundle. */
  live?: boolean;
};

export type SavedState = "next" | "been";
export type SavedEntry = { id: string; state: SavedState; savedAt: number };

export type Booking = {
  id: string;
  placeId: string;
  name: string;
  address: string;
  date: string; // ISO yyyy-mm-dd
  time: string; // HH:mm
  party: number;
  status: "confirmed" | "pending";
  createdAt: number;
};

export type InboxKind = "waitlist" | "alerts";
export type InboxItem = {
  id: string;
  kind: InboxKind;
  title: string;
  text: string;
  time: string;
  unread: boolean;
  icon: "clock" | "check" | "trend" | "heart" | "calendar";
};

export type ScopeMode = "bundled" | "live" | "loading" | "empty";

export type RouteInfo = {
  placeId: string;
  coordinates: [number, number][];
  minutes: number;
  meters: number;
  profile: "foot" | "car";
};

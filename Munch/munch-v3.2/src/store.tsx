import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AREAS,
  DEFAULT_AREA,
  areaById,
  placeById,
  cuisineGroup,
  defaultAreaFor,
} from "@/lib/places";
import { distanceLabel, fetchNearbyOsm, fetchRoute, haversineMi, nearestArea, reverseGeocode } from "@/lib/geo";
import { useAuth } from "@/auth/auth-context";
import { HAS_API } from "@/lib/authConfig";
import { fetchSession, saveArea, saveLocation } from "@/lib/munchApi";
import { openState } from "@/lib/hours";
import type {
  Area,
  Booking,
  InboxItem,
  Place,
  RouteInfo,
  SavedEntry,
  SavedState,
  ScopeMode,
} from "@/lib/types";

export type Screen = "discover" | "cravings" | "bookings" | "profile" | "inbox";

export type Filters = {
  openNow: boolean;
  cuisine: string;
  maxMiles: number | null;
  /** Keep franchises and casual spots in the deck (the default). */
  includeChains: boolean;
};

export type Toast = {
  id: number;
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
} | null;

type UserPos = { lat: number; lng: number; accuracy: number };

type Ctx = {
  screen: Screen;
  setScreen: (screen: Screen) => void;

  /** True while the signed-in profile and saved area are being restored. */
  hydrating: boolean;
  /** Identity scope used for every scoped localStorage key. */
  identityScope: string;

  area: Area;
  areaId: string;
  areaSource: "gps" | "manual" | "default";
  mode: ScopeMode;
  liveLabel: { name: string; city: string };
  liveRadius: number;
  userPos: UserPos | null;
  liveCenter: { lat: number; lng: number } | null;
  locating: boolean;
  searchNotice: string | null;
  setSearchNotice: (value: string | null) => void;
  chooseArea: (id: string) => void;
  browseWorldArea: (id: string) => Promise<void>;
  locate: (radiusOverride?: number) => Promise<{ ok: boolean; message: string }>;
  searchAreaAt: (point: { lat: number; lng: number }, radius: number) => Promise<{ ok: boolean; message: string }>;
  setLiveRadius: (value: number) => void;

  places: Place[];
  visiblePlaces: Place[];
  allKnown: Place[];
  filters: Filters;
  setFilters: (filters: Filters) => void;
  distanceTo: (place: Place) => number;
  distanceText: (place: Place) => string;

  saved: SavedEntry[];
  savedPlaces: Place[];
  isSaved: (id: string) => boolean;
  savePlace: (place: Place, state?: SavedState) => void;
  unsavePlace: (id: string) => void;
  setSavedState: (id: string, state: SavedState) => void;

  bookings: Booking[];
  addBooking: (place: Place, date: string, time: string, party: number) => void;
  cancelBooking: (id: string) => void;
  confirmBooking: (id: string) => void;

  inbox: InboxItem[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;

  waitlist: { place: string; placeId: string; position: number; total: number; party: number; minutes: number } | null;
  leaveWaitlist: () => void;
  joinWaitlist: (place: Place, party?: number) => void;

  alertsEnabled: boolean;
  setAlertsEnabled: (value: boolean) => void;

  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  detailId: string | null;
  detailPlace: Place | null;
  openDetail: (place: Place) => void;
  closeDetail: () => void;

  route: RouteInfo | null;
  routing: boolean;
  routeError: string | null;
  showRoute: (place: Place) => Promise<void>;
  clearRoute: () => void;

  focus: { center: [number, number]; zoom: number; key: number } | null;
  flyToPlace: (place: Place, zoom?: number) => void;

  toast: Toast;
  notify: (message: string, undo?: { label?: string; action: () => void }) => void;
  dismissToast: () => void;

  recentVotes: { yes: number; no: number };
  recordVote: (vote: "yes" | "no") => void;
  searchExtras: Place[];
  addSearchExtras: (places: Place[]) => void;
};

const AppContext = createContext<Ctx | null>(null);

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "null");
    return raw === null ? fallback : (raw as T);
  } catch {
    return fallback;
  }
};
const writeJSON = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
};

const SEED_SAVED: SavedEntry[] = [
  { id: "hayes-valley:a-mano", state: "next", savedAt: Date.now() - 86400000 * 5 },
  { id: "hayes-valley:souvla", state: "next", savedAt: Date.now() - 86400000 * 4 },
  { id: "hayes-valley:dragoneats", state: "next", savedAt: Date.now() - 86400000 * 2 },
  { id: "hayes-valley:chez-maman-west", state: "been", savedAt: Date.now() - 86400000 * 12 },
];

function isoDay(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

const SEED_BOOKINGS: Booking[] = [
  {
    id: "seed-nightbird",
    placeId: "hayes-valley:nightbird",
    name: "Nightbird",
    address: "330 Gough St",
    date: isoDay(0),
    time: "19:30",
    party: 2,
    status: "confirmed",
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: "seed-rich-table",
    placeId: "hayes-valley:rich-table",
    name: "Rich Table",
    address: "199 Gough St",
    date: isoDay(3),
    time: "20:00",
    party: 4,
    status: "pending",
    createdAt: Date.now() - 86400000 * 2,
  },
];

const SEED_INBOX: InboxItem[] = [
  {
    id: "inbox-1",
    kind: "alerts",
    title: "Your table is in 2 hours",
    text: "Nightbird, 7:30 PM for 2. Leave now and you'll beat the rush.",
    time: "1h",
    unread: true,
    icon: "clock",
  },
  {
    id: "inbox-2",
    kind: "alerts",
    title: "Table confirmed",
    text: "Nightbird tonight at 7:30 PM for 2. Directions are saved to the booking.",
    time: "2h",
    unread: true,
    icon: "check",
  },
  {
    id: "inbox-3",
    kind: "waitlist",
    title: "You moved up the waitlist",
    text: "Papito Hayes bumped you from #5 to #3. Roughly 12 minutes out.",
    time: "3h",
    unread: true,
    icon: "trend",
  },
  {
    id: "inbox-4",
    kind: "alerts",
    title: "Three friends craved this",
    text: "Jo, Mia and Andres saved Nightbird after your vote.",
    time: "Yesterday",
    unread: false,
    icon: "heart",
  },
];

export const LIVE_RADII = [0.5, 1, 3, 6];

/** Franchises and casual chains are part of the default deck, never hidden by rating. */
const CHAIN_RE =
  /^(mcdonald|kfc|subway|starbucks|burger king|domino|pizza hut|taco bell|wendy|dunkin|greggs|nando|pret|five guys|shake shack|chipotle|popeyes|papa john|pizza express|leon|itsu|wagamama|sushi daily|döner|doner|kebab house|chicken cottage|jollibee|dairy queen|sonic|arby|jack in the box|carl's jr|in-n-out|whataburger|culver|panera|panda express|papa murphy|little caesars|tim hortons|a&w|mos burger|yoshinoya|sukiya|lotteria|mixue|haidilao)/i;

function isChain(place: Place) {
  return CHAIN_RE.test(place.name.trim());
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, getToken } = useAuth();
  const identityScope = user?.id ?? "guest";
  const isGuest = !user;
  const scoped = useCallback(
    (key: string) => `munch:${identityScope}:${key}`,
    [identityScope],
  );

  const [screen, setScreenState] = useState<Screen>(() => {
    const hash = window.location.hash.replace("#", "");
    return (["discover", "cravings", "bookings", "profile", "inbox"] as Screen[]).includes(hash as Screen)
      ? (hash as Screen)
      : "discover";
  });

  const [areaId, setAreaId] = useState(() => (isGuest ? DEFAULT_AREA : defaultAreaFor(identityScope)));
  const [areaSource, setAreaSource] = useState<"gps" | "manual" | "default">("default");
  const [mode, setMode] = useState<ScopeMode>("bundled");
  const [livePlaces, setLivePlaces] = useState<Place[]>([]);
  const [searchExtras, setSearchExtras] = useState<Place[]>([]);
  const [liveLabel, setLiveLabel] = useState({ name: "Near you", city: "" });
  const [liveRadius, setLiveRadiusState] = useState(1);
  const [userPos, setUserPos] = useState<UserPos | null>(null);
  const [liveCenter, setLiveCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  const [customPlaces, setCustomPlaces] = useState<Record<string, Place>>(() =>
    readJSON(scoped("custom:v3"), {}),
  );
  const [saved, setSaved] = useState<SavedEntry[]>(() => {
    const stored = readJSON<SavedEntry[] | null>(scoped("saved:v5"), null);
    if (!Array.isArray(stored)) return isGuest ? SEED_SAVED : [];
    return stored.filter((entry) => Boolean(entry?.id));
  });
  const [bookings, setBookings] = useState<Booking[]>(() =>
    readJSON<Booking[]>(scoped("bookings:v3"), isGuest ? SEED_BOOKINGS : []),
  );
  const [inbox, setInbox] = useState<InboxItem[]>(() =>
    readJSON<InboxItem[]>(scoped("inbox:v2"), isGuest ? SEED_INBOX : []),
  );
  const [waitlist, setWaitlist] = useState<Ctx["waitlist"]>(() =>
    readJSON(
      scoped("waitlist:v2"),
      isGuest
        ? {
            place: "Papito Hayes",
            placeId: "hayes-valley:papito-hayes",
            position: 3,
            total: 9,
            party: 2,
            minutes: 12,
          }
        : null,
    ),
  );
  const [alertsEnabled, setAlertsEnabledState] = useState(() =>
    readJSON(scoped("alerts:v1"), true),
  );
  const [hydrating, setHydrating] = useState(Boolean(HAS_API && user));
  const areaIdRef = useRef("");
  useEffect(() => {
    areaIdRef.current = areaId;
  }, [areaId]);
  const [filters, setFiltersState] = useState<Filters>({
    openNow: false,
    cuisine: "All",
    maxMiles: null,
    includeChains: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [focus, setFocus] = useState<Ctx["focus"]>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [recentVotes, setRecentVotes] = useState({ yes: 0, no: 0 });
  const toastTimer = useRef<number | null>(null);

  const area = areaById(areaId);
  const allKnown = useMemo(() => {
    const list = [...Object.values(customPlaces), ...livePlaces, ...searchExtras];
    return list;
  }, [customPlaces, livePlaces, searchExtras]);

  const places = mode === "bundled" ? area.restaurants : livePlaces;

  const anchor = userPos || liveCenter || area.center;
  const distanceTo = useCallback(
    (place: Place) => haversineMi(userPos || liveCenter || area.center || { lat: 0, lng: 0 }, place),
    [userPos, liveCenter, area],
  );

  const visiblePlaces = useMemo(() => {
    const group = filters.cuisine;
    return places.filter((place) => {
      if (group && group !== "All" && cuisineGroup(place) !== group) return false;
      if (filters.maxMiles != null && haversineMi(anchor, place) > filters.maxMiles) return false;
      if (filters.openNow && !openState(place).open) return false;
      if (!filters.includeChains && isChain(place)) return false;
      return true;
    });
  }, [places, filters, anchor]);

  /* ---- persistence (every key is scoped to the signed-in identity) ---- */
  useEffect(() => writeJSON(scoped("saved:v5"), saved), [saved, scoped]);
  useEffect(() => writeJSON(scoped("custom:v3"), customPlaces), [customPlaces, scoped]);
  useEffect(() => writeJSON(scoped("bookings:v3"), bookings), [bookings, scoped]);
  useEffect(() => writeJSON(scoped("inbox:v2"), inbox), [inbox, scoped]);
  useEffect(() => writeJSON(scoped("waitlist:v2"), waitlist), [waitlist, scoped]);
  useEffect(() => writeJSON(scoped("alerts:v1"), alertsEnabled), [alertsEnabled, scoped]);

  useEffect(() => {
    document.title = `munch. — ${screen.charAt(0).toUpperCase() + screen.slice(1)}`;
  }, [screen]);

  const setScreen = useCallback((next: Screen) => {
    setScreenState(next);
    if (window.location.hash !== `#${next}`) {
      try {
        history.pushState(null, "", `#${next}`);
      } catch {
        window.location.hash = next;
      }
    }
    document.querySelector(".screen-scroll")?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => {
      const hash = window.location.hash.replace("#", "") as Screen;
      if (["discover", "cravings", "bookings", "profile", "inbox"].includes(hash)) {
        setScreenState(hash);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const notify = useCallback(
    (message: string, undo?: { label?: string; action: () => void }) => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      const id = Date.now();
      setToast({ id, message, undoLabel: undo?.label ?? "Undo", onUndo: undo?.action });
      if (!undo) {
        toastTimer.current = window.setTimeout(() => setToast(null), 4200);
      }
    },
    [],
  );
  const dismissToast = useCallback(() => setToast(null), []);

  const getPlace = useCallback(
    (id: string) => placeById(id, allKnown),
    [allKnown],
  );

  const detailPlace = detailId ? getPlace(detailId) : null;

  const savedPlaces = useMemo(
    () =>
      saved
        .map((entry) => ({ entry, place: getPlace(entry.id) }))
        .filter((item): item is { entry: SavedEntry; place: Place } => Boolean(item.place))
        .sort((a, b) => b.entry.savedAt - a.entry.savedAt)
        .map((item) => item.place),
    [saved, getPlace],
  );

  const savePlace = useCallback(
    (place: Place, state: SavedState = "next") => {
      setSaved((current) => {
        if (current.some((entry) => entry.id === place.id)) return current;
        return [...current, { id: place.id, state, savedAt: Date.now() }];
      });
      if (place.source === "osm") {
        setCustomPlaces((current) => ({ ...current, [place.id]: place }));
      }
    },
    [],
  );

  const unsavePlace = useCallback((id: string) => {
    setSaved((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const setSavedState = useCallback((id: string, state: SavedState) => {
    setSaved((current) => current.map((entry) => (entry.id === id ? { ...entry, state } : entry)));
  }, []);

  const isSaved = useCallback((id: string) => saved.some((entry) => entry.id === id), [saved]);

  const addBooking = useCallback(
    (place: Place, date: string, time: string, party: number) => {
      setBookings((current) => [
        ...current,
        {
          id: `booking-${Date.now()}`,
          placeId: place.id,
          name: place.name,
          address: place.address,
          date,
          time,
          party,
          status: "pending" as const,
          createdAt: Date.now(),
        },
      ]);
      if (place.source === "osm") {
        setCustomPlaces((current) => ({ ...current, [place.id]: place }));
      }
    },
    [],
  );

  const cancelBooking = useCallback(
    (id: string) => {
      const booking = bookings.find((item) => item.id === id);
      if (!booking) return;
      setBookings((current) => current.filter((item) => item.id !== id));
      notify(`Reservation at ${booking.name} cancelled`, {
        label: "Undo",
        action: () => setBookings((current) => [...current, booking]),
      });
    },
    [bookings, notify],
  );

  const confirmBooking = useCallback(
    (id: string) => {
      setBookings((current) =>
        current.map((item) => (item.id === id ? { ...item, status: "confirmed" } : item)),
      );
      notify("Table confirmed — we'll remind you an hour before");
    },
    [notify],
  );

  const markRead = useCallback((id: string) => {
    setInbox((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)));
  }, []);
  const markAllRead = useCallback(() => {
    setInbox((current) => current.map((item) => ({ ...item, unread: false })));
  }, []);

  const leaveWaitlist = useCallback(() => {
    const previous = waitlist;
    setWaitlist(null);
    notify("You left the Papito Hayes waitlist", {
      label: "Undo",
      action: () => setWaitlist(previous),
    });
  }, [waitlist, notify]);

  const joinWaitlist = useCallback(
    (place: Place, party = 2) => {
      setWaitlist({
        place: place.name,
        placeId: place.id,
        position: Math.max(1, Math.round(Math.random() * 4) + 1),
        total: Math.max(6, Math.round(Math.random() * 8) + 6),
        party,
        minutes: 10 + Math.round(Math.random() * 20),
      });
      notify(`Waitlisted at ${place.name} — we'll ping you`);
    },
    [notify],
  );

  const setAlertsEnabled = useCallback((value: boolean) => {
    setAlertsEnabledState(value);
  }, []);

  const openDetail = useCallback((place: Place) => setDetailId(place.id), []);
  const closeDetail = useCallback(() => setDetailId(null), []);

  const flyToPlace = useCallback((place: Place, zoom = 16) => {
    setSelectedId(place.id);
    setFocus({ center: [place.lng, place.lat], zoom, key: Date.now() });
  }, []);

  const showRoute = useCallback(
    async (place: Place) => {
      setRouting(true);
      setRouteError(null);
      setDetailId(null);
      setScreen("discover");
      const origin = userPos || area.center;
      const result = await fetchRoute(origin, place);
      setRouting(false);
      if (!result) {
        setRouteError("The walking route service did not answer. Showing the place instead.");
        flyToPlace(place);
        return;
      }
      setRoute({ placeId: place.id, ...result, profile: "foot" });
      setSelectedId(place.id);
      setScreen("discover");
    },
    [userPos, area, flyToPlace, setScreen],
  );

  const clearRoute = useCallback(() => setRoute(null), []);

  const setFilters = useCallback((next: Filters) => {
    setFiltersState(next);
    setSelectedId(null);
  }, []);

  const setLiveRadius = useCallback((value: number) => {
    setLiveRadiusState(value);
  }, []);

  const browseWorldArea = useCallback(
    async (id: string) => {
      const target = areaById(id);
      const hasStarter = target.restaurants.length > 0;
      setAreaId(id);
      setAreaSource("manual");
      setMode(hasStarter ? "bundled" : "loading");
      if (!hasStarter) setLivePlaces([]);
      setLiveCenter({ lat: target.center.lat, lng: target.center.lng });
      setLiveLabel({ name: target.label, city: target.city });
      setSelectedId(null);
      setScreen("discover");
      setFocus({ center: [target.center.lng, target.center.lat], zoom: 13.2, key: Date.now() });
      const radius = Math.max(liveRadius, 3);
      try {
        const results = await fetchNearbyOsm(target.center, radius);
        if (areaIdRef.current !== id) return;
        setLivePlaces(results);
        setLiveRadiusState(radius);
        setMode(results.length ? "live" : hasStarter ? "bundled" : "empty");
        setSearchNotice(
          results.length
            ? `${results.length} live places around ${target.label}`
            : `No live venues found around ${target.label}. Try another city or use GPS.`,
        );
      } catch {
        if (areaIdRef.current !== id) return;
        if (!hasStarter) {
          setLivePlaces([]);
          setMode("empty");
        }
        setSearchNotice(`Live data is unavailable for ${target.label} right now. Showing the saved snapshot.`);
      } finally {
        /* browse is not a GPS request, so the locate state is untouched */
      }
    },
    [liveRadius, setScreen],
  );

  const chooseArea = useCallback(
    (id: string) => {
      const next = areaById(id);
      setAreaId(id);
      setAreaSource("manual");
      setLivePlaces([]);
      setSelectedId(null);
      setScreen("discover");
      setFocus({ center: [next.center.lng, next.center.lat], zoom: 14.4, key: Date.now() });
      if (next.live) {
        void browseWorldArea(id);
      } else {
        setMode("bundled");
        setLiveCenter(null);
      }
      void (async () => {
        if (!HAS_API || !user) return;
        try {
          const token = await getToken();
          if (token) await saveArea(token, { area_id: id, source: "manual", label: next.label, city: next.city });
        } catch {
          /* the scoped local cache still holds the choice */
        }
      })();
    },
    [setScreen, user, getToken, browseWorldArea],
  );

  const searchAreaAt = useCallback(
    async (point: { lat: number; lng: number }, radius: number) => {
      setLocating(true);
      setMode("loading");
      setAreaSource("manual");
      setLiveCenter({ lat: point.lat, lng: point.lng });
      const label = await reverseGeocode(point);
      if (label) setLiveLabel(label);
      try {
        const results = await fetchNearbyOsm(point, radius);
        setLivePlaces(results);
        setLiveRadiusState(radius);
        setMode(results.length ? "live" : "empty");
        setLocating(false);
        return {
          ok: results.length > 0,
          message: results.length
            ? `${results.length} places within ${radius} mi of this map view`
            : `No places within ${radius} mi of this view`,
        };
      } catch {
        setLivePlaces([]);
        setMode("empty");
        setLocating(false);
        return {
          ok: false,
          message: "The OpenStreetMap search is busy right now. Try again in a moment.",
        };
      }
    },
    [],
  );

  const locate = useCallback(async (radiusOverride?: number) => {
    if (!("geolocation" in navigator)) {
      return { ok: false, message: "This browser cannot share a location." };
    }
    setLocating(true);
    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
      );
    });
    if (!position) {
      setLocating(false);
      return { ok: false, message: "Location permission was declined or timed out." };
    }

    const point = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy || 0,
    };
    setUserPos(point);
    setLiveCenter({ lat: point.lat, lng: point.lng });

    const near = nearestArea(point, AREAS);
    const label = await reverseGeocode(point);
    if (label) setLiveLabel(label);

    if (near.distance <= 12) {
      setAreaId(near.area.id);
      setAreaSource("gps");
      setMode("bundled");
      setLivePlaces([]);
      setFocus({ center: [point.lng, point.lat], zoom: 15.2, key: Date.now() });
      setLocating(false);
      void (async () => {
        if (!HAS_API || !user) return;
        try {
          const token = await getToken();
          if (token) {
            await saveLocation(token, {
              lat: point.lat,
              lng: point.lng,
              accuracy_m: Math.round(point.accuracy),
              area_id: near.area.id,
              label: near.area.label,
              source: "gps",
            });
          }
        } catch {
          /* offline: local cache remains authoritative */
        }
      })();
      return {
        ok: true,
        message: `Centred on ${near.area.label} · ±${Math.round(point.accuracy)} m`,
      };
    }

    setLocating(true);
    setMode("loading");
    setAreaSource("gps");
    const startRadius = radiusOverride ?? liveRadius;
    let failed = false;
    for (const radius of [startRadius, ...LIVE_RADII.filter((value) => value > startRadius)]) {
      try {
        const results = await fetchNearbyOsm(point, radius);
        if (results.length) {
          setLivePlaces(results);
          setLiveRadiusState(radius);
          setMode("live");
          setFocus({ center: [point.lng, point.lat], zoom: radius <= 1 ? 15.6 : 14.2, key: Date.now() });
          setLocating(false);
          return {
            ok: true,
            message: `${results.length} live places within ${radius} mi`,
          };
        }
      } catch {
        failed = true;
        break;
      }
    }

    setLivePlaces([]);
    setMode("empty");
    setLocating(false);
    return {
      ok: false,
      message: failed
        ? "The OpenStreetMap search is busy right now. Try again in a moment."
        : "OpenStreetMap had no restaurants in range. Try a wider radius.",
    };
  }, [liveRadius, user, getToken]);

  /* ---- area hydration: local cache first, then the verified server copy ---- */
  useEffect(() => {
    const stored = readJSON<{ id: string; source: "gps" | "manual" } | null>(scoped("area:v1"), null);
    if (stored && AREAS.some((item) => item.id === stored.id)) {
      setAreaId(stored.id);
      setAreaSource(stored.source === "manual" ? "manual" : "gps");
    }

    if (!HAS_API || !user) {
      setHydrating(false);
      return;
    }

    let cancelled = false;
    const finish = () => {
      if (!cancelled) setHydrating(false);
    };
    // A slow API must never hold the interface hostage.
    const ceiling = window.setTimeout(finish, 4500);

    (async () => {
      try {
        const token = await getToken();
        if (!token) return finish();
        const snapshot = await fetchSession(token);
        if (cancelled) return;

        const serverArea = snapshot.last_area?.id;
        const profileArea = snapshot.profile?.last_area_id ?? null;
        if (serverArea && AREAS.some((item) => item.id === serverArea)) {
          setAreaId(serverArea);
          setAreaSource(snapshot.last_area?.source === "manual" ? "manual" : "gps");
        } else if (profileArea && AREAS.some((item) => item.id === profileArea)) {
          setAreaId(profileArea);
        }

        // Requirement: a returning diner lands on a default area, never on a
        // restored GPS fix. `last_location` stays server-side for history.
        if (!serverArea && !profileArea) {
          const fallback = defaultAreaFor(user?.id ?? "guest");
          setAreaId(fallback);
          setAreaSource("default");
        }
        if (snapshot.profile?.display_name) {
          writeJSON(scoped("profile:v1"), {
            name: snapshot.profile.display_name,
            email: snapshot.profile.email,
          });
        }
      } catch {
        /* offline: the scoped local cache is already applied */
      } finally {
        window.clearTimeout(ceiling);
        finish();
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(ceiling);
    };
    // Identity is fixed for the lifetime of this provider instance (it is
    // keyed by user id in App), so this intentionally runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    writeJSON(scoped("area:v1"), { id: areaId, source: areaSource });
  }, [areaId, areaSource, scoped]);

  /* A live world area has no bundled venues; fetch them once it is selected. */
  useEffect(() => {
    if (!hydrating && area.live && mode === "bundled") {
      void browseWorldArea(area.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.id]);

  const distanceText = useCallback(
    (place: Place) => distanceLabel(distanceTo(place), Boolean(userPos)),
    [distanceTo, userPos],
  );

  const recordVote = useCallback((vote: "yes" | "no") => {
    setRecentVotes((current) => ({ ...current, [vote]: current[vote] + 1 }));
  }, []);

  const value: Ctx = {
    screen,
    setScreen,
    hydrating,
    identityScope,
    area,
    areaId,
    areaSource,
    mode,
    liveLabel,
    liveRadius,
    userPos,
    liveCenter,
    locating,
    searchNotice,
    setSearchNotice,
    chooseArea,
    browseWorldArea,
    locate,
    searchAreaAt,
    setLiveRadius,
    places,
    visiblePlaces,
    allKnown,
    filters,
    setFilters,
    distanceTo,
    distanceText,
    saved,
    savedPlaces,
    isSaved,
    savePlace,
    unsavePlace,
    setSavedState,
    bookings,
    addBooking,
    cancelBooking,
    confirmBooking,
    inbox,
    unread: inbox.filter((item) => item.unread).length,
    markRead,
    markAllRead,
    waitlist,
    leaveWaitlist,
    joinWaitlist,
    alertsEnabled,
    setAlertsEnabled,
    selectedId,
    setSelectedId,
    detailId,
    detailPlace,
    openDetail,
    closeDetail,
    route,
    routing,
    routeError,
    showRoute,
    clearRoute,
    focus,
    flyToPlace,
    toast,
    notify,
    dismissToast,
    recentVotes,
    recordVote,
    searchExtras,
    addSearchExtras: setSearchExtras,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}

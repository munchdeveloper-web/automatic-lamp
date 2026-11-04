import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Box,
  ChevronRight,
  Flame,
  Layers,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  Star,
  Crosshair,
  X,
} from "lucide-react";
import {
  Map,
  MarkerContent,
  MarkerTooltip,
  MapControls,
  MapGeoJSON,
  MapMarker,
  MapRoute,
  useMap,
  type MapRef,
} from "@/components/ui/map";
import { useApp } from "@/store";
import { openState } from "@/lib/hours";
import { formatPhone, miles, radiusLabel, searchOsmName } from "@/lib/geo";
import { PlacePhoto } from "@/components/PlacePhoto";
import { FilterSheet } from "@/components/FilterSheet";
import type { Place } from "@/lib/types";
import { cuisineGroup } from "@/lib/places";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const CUISINE_TONE: Record<string, string> = {
  Italian: "#ae3a22",
  Mexican: "#e9a820",
  Asian: "#254434",
  Sushi: "#7a9b6d",
  Burgers: "#c25a2e",
  Brunch: "#d99d72",
  Cafe: "#a98a5c",
  French: "#7a5c8f",
  Seafood: "#3f7285",
  BBQ: "#8f4a2a",
  Mediterranean: "#6d8a5c",
  Indian: "#b46b2e",
  Korean: "#a83a2b",
  Bar: "#5d4a6b",
  "Fine dining": "#223a2c",
  Bowls: "#6f8a4a",
  Other: "#8e7d5e",
};

const PAPER_COLORS = {
  route: "#ae3a22",
  routeCasing: "#fff8e6",
  user: "#2d6cdf",
};

function circleGeoJSON(lat: number, lng: number, meters: number) {
  const points: [number, number][] = [];
  const steps = 64;
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (i / steps) * Math.PI * 2;
    const distance = meters;
    const earth = 6378137;
    const lat1 = (lat * Math.PI) / 180;
    const lng1 = (lng * Math.PI) / 180;
    const angular = distance / earth;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
      );
    points.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Polygon" as const, coordinates: [points] },
      },
    ],
  };
}

function MapScale() {
  const { map, mapLib, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !mapLib || !isLoaded) return;
    const control = new mapLib.ScaleControl({ maxWidth: 90, unit: "imperial" });
    map.addControl(control, "bottom-left");
    return () => {
      try {
        map.removeControl(control);
      } catch {
        /* map already gone */
      }
    };
  }, [map, mapLib, isLoaded]);
  return null;
}

function MapClickAway({ onClear }: { onClear: () => void }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const handler = (event: { originalEvent?: Event }) => {
      const target = event.originalEvent?.target as HTMLElement | null;
      /* MapLibre's click fires for taps that start on a marker too; never let
         that same tap close the card it just opened. */
      if (target?.closest(".maplibregl-marker, .map-card")) return;
      onClear();
    };
    map.on("click", handler as never);
    return () => {
      map.off("click", handler as never);
    };
  }, [map, onClear]);
  return null;
}

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="map-stage" style={{ display: "grid", placeItems: "center", padding: 24 }}>
          <div className="empty">
            <div className="empty__art" aria-hidden="true">
              <span className="empty__disc" />
              <span className="empty__icon">
                <MapPin />
              </span>
            </div>
            <h2 className="empty__title" style={{ fontSize: 22 }}>
              This browser cannot draw the map
            </h2>
            <p className="empty__text">
              MapLibre needs WebGL. Everything else — the deck, saved places and bookings — still works.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function MapPanel({ onExitMap, onlySaved = false }: { onExitMap: () => void; onlySaved?: boolean }) {
  const {
    userPos,
    area,
    mode,
    liveLabel,
    liveRadius,
    visiblePlaces,
    savedPlaces,
    isSaved,
    selectedId,
    setSelectedId,
    openDetail,
    savePlace,
    unsavePlace,
    distanceText,
    showRoute,
    route,
    routing,
    routeError,
    clearRoute,
    focus,
    flyToPlace,
    locate,
    searchAreaAt,
    notify,
    filters,
    setFilters,
    searchExtras,
    addSearchExtras,
    allKnown,
    setSearchNotice,
    locating,
    mode: scopeMode,
  } = useApp();

  const [map, setMap] = useState<MapRef | null>(null);
  const [query, setQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [tilted, setTilted] = useState(false);
  const [canHover] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(hover: hover) and (pointer: fine)").matches : true,
  );
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initialCenter = useMemo<[number, number]>(() => {
    const point = userPos || area.center;
    return [point.lng, point.lat];
  }, []); // first paint only

  const shownPlaces = onlySaved ? savedPlaces : visiblePlaces;

  const selected = useMemo(
    () => shownPlaces.find((place) => place.id === selectedId) || null,
    [shownPlaces, selectedId],
  );

  /* A focused place / area is the only thing that moves the camera, so the
     reader's own pan is never yanked back. */
  useEffect(() => {
    if (!focus || !map) return;
    map.flyTo({
      center: focus.center,
      zoom: focus.zoom,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900,
      essential: true,
    });
  }, [focus, map]);

  const fitRoute = useCallback(() => {
    if (!route || !map) return;
    const coords = route.coordinates;
    if (!coords.length) return;
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    coords.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: {
          top: 110,
          bottom: 170,
          left: 50,
          right: 50,
        },
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800,
      },
    );
  }, [route, map]);

  useEffect(() => {
    fitRoute();
  }, [fitRoute]);

  /* Opening Cravings should frame the saved pins, not the old neighbourhood
     centre. Only once per mount so unsaving never yanks the camera. */
  const framedSaved = useRef(false);
  useEffect(() => {
    if (!onlySaved || !map || !savedPlaces.length || framedSaved.current) return;
    framedSaved.current = true;
    const lngs = savedPlaces.map((place) => place.lng);
    const lats = savedPlaces.map((place) => place.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: { top: 120, bottom: 170, left: 70, right: 70 },
        maxZoom: 16,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700,
      },
    );
  }, [onlySaved, map, savedPlaces]);

  const localResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return shownPlaces
      .filter((place) =>
        `${place.name} ${place.cuisine} ${place.address} ${place.neighborhood} ${place.categories.join(" ")}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 6);
  }, [query, shownPlaces]);

  const nearbyResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchExtras
      .filter((place) => `${place.name} ${place.cuisine}`.toLowerCase().includes(q))
      .slice(0, 4);
  }, [query, searchExtras]);

  const handleSearchArea = async () => {
    if (!query.trim() || !map) return;
    setSearchBusy(true);
    const center = map.getCenter();
    try {
      const results = await searchOsmName(query.trim(), { lat: center.lat, lng: center.lng }, 3);
      addSearchExtras(results);
      setSearchNotice(
        results.length
          ? `${results.length} OpenStreetMap matches near the map centre`
          : "No OpenStreetMap matches in this view",
      );
    } catch {
      setSearchNotice("The live OpenStreetMap search did not answer. Try again in a moment.");
    } finally {
      setSearchBusy(false);
    }
  };

  const chooseResult = (place: Place) => {
    setQuery("");
    flyToPlace(place, 16.6);
    openDetail(place);
  };

  const toggleTilt = () => {
    if (!map) return;
    const next = !tilted;
    map.easeTo({ pitch: next ? 46 : 0, duration: 500 });
    setTilted(next);
  };

  const markerTone = (place: Place) => {
    const group = cuisineGroup(place);
    if (group !== "Other") return CUISINE_TONE[group] || CUISINE_TONE.Other;
    let hash = 0;
    for (let i = 0; i < place.name.length; i += 1) hash = (hash * 31 + place.name.charCodeAt(i)) % 997;
    return ["#ae3a22", "#7a9b6d", "#e9a820", "#3f7285", "#b46b2e", "#5d4a6b"][hash % 6];
  };

  const placeNameFor = (id: string) =>
    allKnown.find((place) => place.id === id)?.name ||
    savedPlaces.find((place) => place.id === id)?.name ||
    "your pick";

  const accuracy = userPos?.accuracy ? Math.max(12, Math.round(userPos.accuracy)) : 0;
  const badge = onlySaved
    ? `${savedPlaces.length} saved pin${savedPlaces.length === 1 ? "" : "s"} · cravings`
    : mode === "live"
      ? `Live OpenStreetMap · ${radiusLabel(liveRadius)} mi`
      : mode === "loading"
        ? `Finding live venues around ${area.label}…`
      : mode === "empty"
        ? `No live pins · GPS ±${accuracy} m`
        : userPos
          ? `GPS ±${accuracy} m · ${area.label}`
          : `${area.label} · bundled dataset`;

  return (
    <div className="mapview">
      <div className="mapview__bar">
        <button type="button" className="btn btn--cream btn--sm" onClick={onExitMap}>
          <ArrowLeft size={15} /> Back to the deck
        </button>
        <span className="section-head__meta">
          {area.label} · {shownPlaces.length} {onlySaved ? "saved pins" : "pins"}
        </span>
      </div>

      <MapBoundary>
        <div className="map-stage">
          <Map
            ref={setMap}
            theme="light"
            styles={{ light: MAP_STYLE }}
            center={initialCenter}
            zoom={15}
            minZoom={8}
            maxZoom={19}
            maxPitch={60}
            dragRotate
            touchZoomRotate
            attributionControl={{ compact: true }}
          >
            <MapScale />
            <MapClickAway onClear={() => setSelectedId(null)} />

            {userPos && (
              <>
                <MapGeoJSON
                  id="accuracy-circle"
                  data={circleGeoJSON(userPos.lat, userPos.lng, Math.max(15, Math.min(userPos.accuracy, 300)))}
                  fillPaint={{ "fill-color": PAPER_COLORS.user, "fill-opacity": 0.09 }}
                  linePaint={{ "line-color": PAPER_COLORS.user, "line-width": 1, "line-opacity": 0.5 }}
                />
                <MapMarker longitude={userPos.lng} latitude={userPos.lat}>
                  <MarkerContent>
                    <div
                      className="map-user"
                      role="img"
                      aria-label={`Your position, accurate to about ${accuracy} metres`}
                    />
                  </MarkerContent>
                </MapMarker>
              </>
            )}

            {route && route.coordinates.length > 1 && (
              <MapRoute
                id="walking-route"
                coordinates={route.coordinates}
                color={PAPER_COLORS.routeCasing}
                width={9}
                opacity={0.9}
                active
                activeColor={PAPER_COLORS.route}
                activeWidth={5}
                activeDashArray={[1.4, 1.1]}
              />
            )}

            {shownPlaces.slice(0, 160).map((place) => (
              <MapMarker
                key={place.id}
                longitude={place.lng}
                latitude={place.lat}
                onClick={() => setSelectedId(place.id)}
              >
                <MarkerContent>
                  <button
                    type="button"
                    className={`map-marker${selectedId === place.id ? " is-selected" : ""}${isSaved(place.id) ? " is-saved" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedId(place.id);
                    }}
                    onTouchEnd={(event) => {
                      event.stopPropagation();
                      setSelectedId(place.id);
                    }}
                    aria-label={`${place.name}, ${place.cuisine}, ${distanceText(place)} — show the map card`}
                  >
                    <span
                      className="map-marker__dot"
                      aria-hidden="true"
                      style={{ background: markerTone(place) }}
                    />
                    {isSaved(place.id) && (
                      <span className="map-marker__flame" aria-hidden="true">
                        <Flame fill="currentColor" />
                      </span>
                    )}
                  </button>
                </MarkerContent>
                {canHover && <MarkerTooltip>{place.name}</MarkerTooltip>}
              </MapMarker>
            ))}

            <MapControls
              className="munch-controls"
              position="bottom-right"
              showZoom
              showCompass
              showLocate
              showFullscreen
              onLocate={async () => {
                const result = await locate();
                notify(result.message);
              }}
            />
          </Map>

          <div className="map-overlay-top">
            <div className="map-search">
              <div className="map-search__field">
                <Search />
                <input
                  ref={searchRef}
                  type="text"
                  inputMode="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={onlySaved ? "Search your saved pins" : "Search this neighbourhood"}
                  aria-label="Search restaurants on the map"
                  autoComplete="off"
                />
                {query ? (
                  <button type="button" onClick={() => setQuery("")} aria-label="Clear search" style={{ minHeight: 32 }}>
                    <X size={15} />
                  </button>
                ) : (
                  <kbd>/</kbd>
                )}
              </div>

              {query.trim() && (
                <div className="map-search__results">
                  {[...localResults, ...nearbyResults].map((place) => (
                    <button
                      type="button"
                      className="search-hit"
                      key={place.id}
                      onClick={() => chooseResult(place)}
                    >
                      <PlacePhoto place={place} width={120} className="search-hit__thumb" />
                      <span className="search-hit__body">
                        <span className="search-hit__name">{place.name}</span>
                        <span className="search-hit__meta">
                          {place.cuisine} · {place.address || "Address not listed"}
                        </span>
                      </span>
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  ))}
                  {localResults.length === 0 && nearbyResults.length === 0 && (
                    <p className="search-hit__meta" style={{ padding: "8px 10px 4px" }}>
                      No matches in the current dataset.
                    </p>
                  )}
                  <button
                    type="button"
                    className="search-hit"
                    onClick={() => void handleSearchArea()}
                    disabled={searchBusy}
                  >
                    <span className="search-hit__thumb" style={{ display: "grid", placeItems: "center", background: "#f1e5cc" }}>
                      <Layers size={17} />
                    </span>
                    <span className="search-hit__body">
                      <span className="search-hit__name">
                        {searchBusy ? "Asking OpenStreetMap…" : `Search “${query.trim()}” around this map`}                      </span>
                      <span className="search-hit__meta">Live OpenStreetMap · within 3 miles of the view</span>
                    </span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className={`map-btn${filters.openNow || filters.cuisine !== "All" ? " is-on" : ""}`}
              onClick={() => setFilterOpen(true)}
              aria-label="Filter map pins"
            >
              <SlidersHorizontal />
              <span className="map-btn__label">Filters</span>
            </button>
            <button
              type="button"
              className="map-btn map-btn--icon"
              aria-label="Search this map area for restaurants"
              onClick={async () => {
                if (!map) return;
                const center = map.getCenter();
                const result = await searchAreaAt({ lat: center.lat, lng: center.lng }, liveRadius);
                notify(result.message);
                setSearchNotice(result.message);
              }}
              disabled={locating}
            >
              <Crosshair />
            </button>
            <button
              type="button"
              className="map-btn map-btn--icon map-btn--tilt"
              onClick={toggleTilt}
              aria-label="Tilt the map"
            >
              <Box />
            </button>
            <button
              type="button"
              className="map-btn map-btn--icon map-btn--locate"
              aria-label="Recentre on my location"
              onClick={async () => {
                const result = await locate();
                notify(result.message);
              }}
              disabled={locating}
            >
              <LocateFixed />
            </button>
          </div>

          <span className="map-badge">
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: mode === "live" ? "var(--tomato)" : "var(--sage-deep)",
              }}
            />
            {badge}
          </span>

          {route && (
            <div className="route-banner" role="status">
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.14)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Navigation size={16} />
              </span>
              <span className="route-banner__body">
                <span className="route-banner__title">
                  {route.minutes} min walk · {(route.meters / 1609.34).toFixed(route.meters > 1609 ? 1 : 2)} mi
                </span>
                <span className="route-banner__meta">
                  Foot routing via OpenStreetMap to {placeNameFor(route.placeId)}
                </span>
              </span>
              <button type="button" onClick={clearRoute} aria-label="Clear route">
                <X />
              </button>
            </div>
          )}

          {routeError && (
            <span className="map-badge" style={{ top: 118, background: "#f6e0d7", borderColor: "#e3b7a5" }}>
              <MapPin /> {routeError}
            </span>
          )}

          {selected ? (
            <div className="map-card">
              <button
                type="button"
                className="map-card__close"
                onClick={() => setSelectedId(null)}
                aria-label="Close place card"
              >
                <X />
              </button>
              <PlacePhoto place={selected} width={240} className="map-card__photo" />
              <div className="map-card__body">
                <span className="eyebrow eyebrow--tomato" style={{ fontSize: 10 }}>
                  {selected.cuisine} · {distanceText(selected)}
                </span>
                <h2 className="map-card__title">{selected.name}</h2>
                <span className="map-card__meta">
                  {selected.rating ? (
                    <>
                      <Star size={11} fill="currentColor" style={{ color: "var(--mustard-deep)", display: "inline", verticalAlign: -1 }} />{" "}
                      {selected.rating.toFixed(1)} ·{" "}
                    </>
                  ) : null}
                  {openState(selected).open ? "Open now" : openState(selected).label}
                </span>
                <span className="map-card__meta">
                  {selected.address || selected.neighborhood || cuisineGroup(selected)}
                  {formatPhone(selected.phone) ? ` · ${formatPhone(selected.phone)}` : ""}
                </span>
                <div className="map-card__actions">
                  <button type="button" className="btn btn--primary" onClick={() => openDetail(selected)}>
                    Details
                  </button>
                  <button
                    type="button"
                    className="btn btn--cream"
                    onClick={() => {
                      if (isSaved(selected.id)) unsavePlace(selected.id);
                      else {
                        savePlace(selected);
                        notify(`${selected.name} saved to cravings`);
                      }
                    }}
                  >
                    <Flame size={14} fill={isSaved(selected.id) ? "currentColor" : "none"} />
                    {isSaved(selected.id) ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => void showRoute(selected)}
                    disabled={routing}
                  >
                    <Navigation size={14} /> {routing ? "Routing…" : "Walk"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <span className={`map-hint${route ? " map-hint--raised" : ""}`}>
              <MapPin />
              {scopeMode === "empty"
                ? "No pins in range — open the area picker to widen the search"
                : "Tap a pin for its paper card · pinch or scroll to zoom"}
            </span>
          )}
        </div>
      </MapBoundary>

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}

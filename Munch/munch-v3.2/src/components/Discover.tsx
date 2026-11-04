import { useEffect, useRef, useState } from "react";
import { Compass, LayoutGrid, Map, SlidersHorizontal } from "lucide-react";
import { useApp } from "@/store";
import { SwipeDeck } from "@/components/SwipeDeck";
import { FilterSheet } from "@/components/FilterSheet";
import { DeckSkeleton } from "@/components/Skeletons";
import type { Place } from "@/lib/types";
import { radiusLabel } from "@/lib/geo";

type Props = {
  view: "stack" | "map";
  onViewChange: (view: "stack" | "map") => void;
  onOpenAreas: () => void;
};

export function Discover({ view, onViewChange, onOpenAreas }: Props) {
  const {
    area,
    mode,
    liveLabel,
    liveRadius,
    places,
    visiblePlaces,
    filters,
    saved,
    savePlace,
    unsavePlace,
    isSaved,
    notify,
    recordVote,
    setFilters,
    userPos,
    locating,
    hydrating,
    locate,
    setSearchNotice,
  } = useApp();

  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ index: number; id: string; added: boolean }[]>([]);
  const [boons, setBoons] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const key = `${area.id}|${mode}|${filters.cuisine}|${filters.openNow}|${filters.maxMiles}|${liveRadius}`;
  const lastKey = useRef(key);

  const deckPlaces = visiblePlaces;

  useEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key;
      setIndex(0);
      setHistory([]);
    }
  }, [key]);

  useEffect(() => {
    if (deckPlaces.length && index >= deckPlaces.length) setIndex(0);
  }, [deckPlaces.length, index]);

  const place: Place | undefined = deckPlaces.length
    ? deckPlaces[((index % deckPlaces.length) + deckPlaces.length) % deckPlaces.length]
    : undefined;

  const decide = (vote: "yes" | "no", chosen: Place) => {
    const added = vote === "yes" && !isSaved(chosen.id);
    if (vote === "yes") savePlace(chosen);
    recordVote(vote);
    setHistory((current) => [...current, { index, id: chosen.id, added }]);
    setIndex((current) => (deckPlaces.length ? (current + 1) % deckPlaces.length : 0));
    if (vote === "yes") {
      notify(`${chosen.name} added to your cravings`, {
        label: "Undo",
        action: () => {
          if (added) unsavePlace(chosen.id);
          setIndex(index);
          setHistory((current) => current.slice(0, -1));
        },
      });
    }
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    if (last.added) unsavePlace(last.id);
    setHistory((current) => current.slice(0, -1));
    setIndex(last.index);
    notify("Last vote undone");
  };

  const boost = (chosen: Place) => {
    if (boons <= 0) return;
    setBoons((current) => current - 1);
    savePlace(chosen);
    notify(`Super-bite! ${chosen.name} is at the top of your cravings`);
  };

  const scopeName = mode === "bundled" ? area.label : liveLabel.name || "Near you";
  const scopeCity = mode === "bundled" ? area.city : liveLabel.city || liveLabel.name || "Around you";
  const activeFilters =
    (filters.openNow ? 1 : 0) + (filters.cuisine !== "All" ? 1 : 0) + (filters.maxMiles != null ? 1 : 0);

  return (
    <div className="discover-panel">
      <div className="discover-head">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">{mode === "live" ? "Live map · OpenStreetMap" : "Pick tonight's table"}</p>
          <h1 className="title title--sm">What's for dinner?</h1>
        </div>
        <div className="discover-head__right">
          <button
            type="button"
            className="iconbtn"
            onClick={() => setFilterOpen(true)}
            aria-label={`Filters${activeFilters ? `, ${activeFilters} active` : ""}`}
          >
            <SlidersHorizontal />
            {activeFilters > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 18,
                  height: 18,
                  borderRadius: 99,
                  background: "var(--tomato)",
                  color: "var(--cream)",
                  fontSize: 10,
                  fontWeight: 900,
                  display: "grid",
                  placeItems: "center",
                  border: "2px solid var(--cream-2)",
                }}
              >
                {activeFilters}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="segmented view-switch" role="group" aria-label="Choose a view">
        <button
          type="button"
          className="segmented__item"
          aria-pressed={view === "stack"}
          onClick={() => onViewChange("stack")}
        >
          <LayoutGrid size={15} /> Stack
        </button>
        <button
          type="button"
          className="segmented__item"
          aria-pressed={view === "map"}
          onClick={() => onViewChange("map")}
        >
          <Map size={15} /> Map
        </button>
      </div>

      <div className="scope-line">
        <span
          className={`scope-dot${mode === "loading" || locating ? " is-busy" : userPos ? "" : " is-approx"}`}
          aria-hidden="true"
        />
        <span>
          {mode === "loading"
            ? "Looking around you…"
            : mode === "live"
              ? `${places.length} live spots within ${radiusLabel(liveRadius)} mi`
              : mode === "empty"
                ? "Nothing in range yet"
                : `${scopeName} · ${places.length} spots`}
        </span>
        <button type="button" className="scope-line__link" onClick={onOpenAreas}>
          {scopeCity}
        </button>
      </div>

      {mode === "loading" || hydrating ? (
        <DeckSkeleton />
      ) : !place ? (
        <div className="deck-wrap">
          <div className="skeleton-card" style={{ justifyContent: "center", padding: 24, textAlign: "center" }}>
            <div className="empty__art" aria-hidden="true" style={{ margin: "0 auto" }}>
              <span className="empty__disc" />
              <span className="empty__icon">
                <Compass />
              </span>
            </div>
            <p className="empty__title" style={{ fontSize: 24 }}>
              {mode === "empty" ? `Nothing within ${radiusLabel(liveRadius)} mi` : "No spots match those filters"}
            </p>
            <p className="empty__text" style={{ margin: "6px auto 14px" }}>
              {mode === "empty"
                ? "Widen the search or switch to one of the covered neighbourhoods."
                : "Loosen a filter, or explore a different area of the map."}
            </p>
            <div className="empty__actions">
              {mode === "empty" && (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={async () => {
                    const result = await locate(Math.min(6, liveRadius * 2));
                    setSearchNotice(result.message);
                  }}
                >
                  Search wider
                </button>
              )}
              {(filters.openNow || filters.cuisine !== "All" || filters.maxMiles != null) && (
                <button
                  type="button"
                  className="btn btn--cream btn--sm"
                  onClick={() => setFilters({ openNow: false, cuisine: "All", maxMiles: null, includeChains: true })}
                >
                  Clear filters
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenAreas}>
                Choose an area
              </button>
            </div>
          </div>
        </div>
      ) : (
        <SwipeDeck
          place={place}
          onDecide={decide}
          onUndo={undo}
          canUndo={history.length > 0}
          boons={boons}
          onBoost={boost}
        />
      )}

      {saved.length > 0 && (
        <div className="discover-footer">
          <p className="section-head__meta">
            {saved.length} saved · {(index % Math.max(deckPlaces.length, 1)) + 1} of {deckPlaces.length} in
            this deck
          </p>
          <button type="button" className="section-head__link" onClick={() => onViewChange("map")}>
            See them on the map
          </button>
        </div>
      )}

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}

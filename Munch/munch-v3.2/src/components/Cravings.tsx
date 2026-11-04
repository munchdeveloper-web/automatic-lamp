import { useMemo, useState } from "react";
import { Bookmark, Flame, Map, MapPin, Sparkles, Star, Utensils } from "lucide-react";
import { useApp } from "@/store";
import { PlacePhoto } from "@/components/PlacePhoto";
import { openState } from "@/lib/hours";
import { cuisineGroup } from "@/lib/places";
import type { Place, SavedState } from "@/lib/types";

type Filter = "all" | "next" | "been";

const COLLECTIONS: { id: string; label: string; test: (place: Place) => boolean }[] = [
  {
    id: "date",
    label: "Date night",
    test: (place) => /french|fine dining|italian|japanese|sushi|steak/i.test(`${place.cuisine} ${place.categories.join(" ")}`),
  },
  {
    id: "cheap",
    label: "Cheap eats",
    test: (place) => /hot dog|sandwich|fast food|pizza|taco|mexican|burger|cafe/i.test(`${place.cuisine} ${place.categories.join(" ")}`),
  },
  {
    id: "brunch",
    label: "Brunch",
    test: (place) => /breakfast|brunch|cafe|bakery/i.test(`${place.cuisine} ${place.categories.join(" ")}`),
  },
  {
    id: "late",
    label: "Late night",
    test: (place) => /bar|pub|korean|ramen|brewery|live music/i.test(`${place.cuisine} ${place.categories.join(" ")}`),
  },
];

export function Cravings({ onShowOnMap }: { onShowOnMap: (place: Place) => void }) {
  const {
    savedPlaces,
    saved,
    unsavePlace,
    openDetail,
    setScreen,
    distanceText,
    notify,
    setSavedState,
    savePlace,
  } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collection, setCollection] = useState<string | null>(null);

  const stateOf = (id: string): SavedState => saved.find((entry) => entry.id === id)?.state ?? "next";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = collection ? COLLECTIONS.find((item) => item.id === collection) : null;
    return savedPlaces.filter((place) => {
      if (styleFilter(place)) return false;
      if (active && !active.test(place)) return false;
      if (!q) return true;
      return `${place.name} ${place.cuisine} ${place.address} ${place.neighborhood} ${place.categories.join(" ")}`
        .toLowerCase()
        .includes(q);
    });

    function styleFilter(place: Place) {
      if (filter === "all") return false;
      const state = stateOf(place.id);
      return filter === "next" ? state !== "next" : state !== "been";
    }
  }, [savedPlaces, query, filter, collection, saved]);

  const counts = useMemo(() => {
    const next = savedPlaces.filter((place) => stateOf(place.id) === "next").length;
    return { all: savedPlaces.length, next, been: savedPlaces.length - next };
  }, [savedPlaces, saved]);

  const pickRandom = () => {
    if (!savedPlaces.length) return;
    const place = savedPlaces[Math.floor(Math.random() * savedPlaces.length)];
    openDetail(place);
    notify(`Tonight: ${place.name}. Trust the paper.`);
  };

  return (
    <div className="cravings-panel">
      <div className="page__head">
        <div>
          <p className="eyebrow">Your shortlist</p>
          <h1 className="title">Cravings</h1>
          <p className="sub">
            {counts.all} saved place{counts.all === 1 ? "" : "s"} · {counts.next} still to try
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="iconbtn"
            aria-label="Show saved places on the map"
            onClick={() => {
              if (savedPlaces[0]) onShowOnMap(savedPlaces[0]);
              else notify("Save a place first and it lands on the map");
            }}
          >
            <Map />
          </button>
        </div>
      </div>

      <div className="searchbar">
        <Sparkles size={17} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your cravings"
          aria-label="Search your cravings"
          autoComplete="off"
        />
      </div>

      <div className="segmented" role="group" aria-label="Filter cravings">
        {[
          { id: "all" as const, label: "All", count: counts.all },
          { id: "next" as const, label: "Try next", count: counts.next },
          { id: "been" as const, label: "Been there", count: counts.been },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className="segmented__item"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label} <span className="segmented__count">{item.count}</span>
          </button>
        ))}
      </div>

      <div className="section-head" style={{ marginBottom: 8 }}>
        <h2>Collections</h2>
        {collection && (
          <button type="button" className="section-head__link" onClick={() => setCollection(null)}>
            Clear
          </button>
        )}
      </div>
      <div className="chips" role="group" aria-label="Collections">
        {COLLECTIONS.map((item) => {
          const count = savedPlaces.filter(item.test).length;
          return (
            <button
              key={item.id}
              type="button"
              className="chip"
              aria-pressed={collection === item.id}
              onClick={() => setCollection(collection === item.id ? null : item.id)}
            >
              {item.label} <span className="chip__count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="section-head" style={{ marginTop: 18 }}>
        <h2>Saved places</h2>
        <span className="section-head__meta">Newest first</span>
      </div>

      {!savedPlaces.length ? (
        <div className="empty">
          <div className="empty__art" aria-hidden="true">
            <span className="empty__disc" />
            <span className="empty__icon">
              <Bookmark />
            </span>
          </div>
          <h2 className="empty__title">Nothing saved yet</h2>
          <p className="empty__text">
            Swipe right on a place you love and it lands here — with the reason you saved it.
          </p>
          <div className="empty__actions">
            <button type="button" className="btn btn--primary" onClick={() => setScreen("discover")}>
              Start swiping
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setScreen("inbox")}>
              Browse a waitlist
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="sheet-note" style={{ padding: "18px 4px" }}>
          Nothing matches that filter yet. Try “All” or clear the collection.
        </p>
      ) : (
        <div className="card-grid">
          {filtered.map((place) => {
            const status = openState(place);
            const state = stateOf(place.id);
            return (
              <article key={place.id} className={`saved-card${state === "been" ? " saved-card--been" : ""}`}>
                <div className="saved-card__media">
                  <PlacePhoto place={place} width={800} />
                  <button
                    type="button"
                    className="saved-card__hit"
                    onClick={() => openDetail(place)}
                    aria-label={`Open details for ${place.name}`}
                  />
                  <span className={`pill ${status.open ? "pill--status-open" : "pill--status-closed"}`}>
                    {status.open ? "Open now" : status.label.split("·")[0]}
                  </span>
                  <button
                    type="button"
                    className="save-btn"
                    aria-label={`Remove ${place.name} from cravings`}
                    aria-pressed="true"
                    onClick={() => {
                      unsavePlace(place.id);
                      notify(`${place.name} removed from cravings`, {
                        label: "Undo",
                        action: () => savePlace(place, state),
                      });
                    }}
                  >
                    <Flame fill="currentColor" />
                  </button>
                </div>
                <div className="saved-card__body">
                  <button type="button" onClick={() => openDetail(place)} style={{ textAlign: "left" }}>
                    <span className="saved-card__title">{place.name}</span>
                  </button>
                  <div className="saved-card__meta">
                    {place.rating && (
                      <strong>
                        <Star size={12} fill="currentColor" /> {place.rating.toFixed(1)}
                      </strong>
                    )}
                    <span>{place.cuisine}</span>
                    <span>·</span>
                    <span>{distanceText(place)}</span>
                  </div>
                  <div className="saved-card__meta">
                    <span>
                      <MapPin size={12} /> {place.address || place.neighborhood || cuisineGroup(place)}
                    </span>
                  </div>
                  <div className="saved-card__note">
                    <button
                      type="button"
                      className="chip"
                      style={{ minHeight: 30, padding: "0 9px", fontSize: 11 }}
                      aria-pressed={state === "been"}
                      onClick={() => {
                        setSavedState(place.id, state === "been" ? "next" : "been");
                        notify(
                          state === "been"
                            ? `${place.name} moved back to “Try next”`
                            : `${place.name} marked as visited`,
                        );
                      }}
                    >
                      <Utensils size={12} /> {state === "been" ? "Been there" : "Mark visited"}
                    </button>
                    <button
                      type="button"
                      className="chip"
                      style={{ minHeight: 30, padding: "0 9px", fontSize: 11 }}
                      onClick={() => onShowOnMap(place)}
                    >
                      <Map size={12} /> Map
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="cravings-footnote">
        <Sparkles />
        <span>
          Saved places stay in this browser. Distances are measured from your GPS fix when one
          is active, not from the neighbourhood centre.
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" className="btn btn--dark" onClick={pickRandom} disabled={!savedPlaces.length}>
          <Sparkles size={16} /> Pick something for me
        </button>
        {savedPlaces.length > 0 && (
          <button type="button" className="btn btn--ghost" onClick={() => onShowOnMap(savedPlaces[0])}>
            <Map /> Map of cravings
          </button>
        )}
      </div>
    </div>
  );
}

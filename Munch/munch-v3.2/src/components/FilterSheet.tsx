import { useId } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useApp } from "@/store";
import { CUISINE_GROUPS } from "@/lib/places";
import { PaperDialog } from "@/components/PaperDialog";

const DISTANCES = [
  { label: "Any distance", value: null },
  { label: "0.5 mi", value: 0.5 },
  { label: "1 mi", value: 1 },
  { label: "3 mi", value: 3 },
  { label: "6 mi", value: 6 },
];

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { filters, setFilters, visiblePlaces, places } = useApp();
  const titleId = useId();

  return (
    <PaperDialog open={open} onClose={onClose} className="dialog--sheet" labelledBy={titleId}>
      <div style={{ padding: "22px 22px 20px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
          <span className="locate-row__icon" style={{ background: "var(--mustard)", color: "var(--ink)" }}>
            <SlidersHorizontal size={18} />
          </span>
          <div>
            <p className="eyebrow">Only the good stuff</p>
            <h2 id={titleId} className="title title--sm" style={{ marginTop: 2 }}>
              Filters
            </h2>
          </div>
        </div>
        <p className="sheet-note">
          {visiblePlaces.length} of {places.length} spots match. Filters apply to the deck and the map pins
          together.
        </p>

        <div className="filter-block">
          <span className="filter-block__label">Open right now</span>
          <button
            type="button"
            className="chip"
            aria-pressed={filters.openNow}
            onClick={() => setFilters({ ...filters, openNow: !filters.openNow })}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: filters.openNow ? "#c7e3b6" : "var(--sage-deep)",
              }}
            />
            {filters.openNow ? "Showing open spots only" : "Show only open spots"}
          </button>
        </div>

        <div className="filter-block">
          <span className="filter-block__label">Kitchen</span>
          <div className="chips" style={{ flexWrap: "wrap", overflow: "visible" }}>
            {CUISINE_GROUPS.filter((group) =>
              ["All", "Italian", "Mexican", "Asian", "Sushi", "Burgers", "Brunch", "Cafe", "Seafood", "Bar"].includes(
                group,
              ),
            ).map((group) => (
              <button
                key={group}
                type="button"
                className="chip"
                aria-pressed={filters.cuisine === group}
                onClick={() => setFilters({ ...filters, cuisine: group })}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-block">
          <span className="filter-block__label">Where to draw the line</span>
          <button
            type="button"
            className="chip"
            aria-pressed={filters.includeChains}
            onClick={() => setFilters({ ...filters, includeChains: !filters.includeChains })}
          >
            {filters.includeChains
              ? "Every spot · chains and casual included"
              : "Independent spots only"}
          </button>
          <p className="sheet-note" style={{ marginTop: 6 }}>
            Every rating is welcome. Turn this off to hide familiar franchise names.
          </p>
        </div>

        <div className="filter-block">
          <span className="filter-block__label">Distance</span>
          <div className="chips" style={{ flexWrap: "wrap", overflow: "visible" }}>
            {DISTANCES.map((distance) => (
              <button
                key={String(distance.value)}
                type="button"
                className="chip"
                aria-pressed={filters.maxMiles === distance.value}
                onClick={() => setFilters({ ...filters, maxMiles: distance.value })}
              >
                {distance.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dialog__actions" style={{ marginTop: 22 }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setFilters({ openNow: false, cuisine: "All", maxMiles: null, includeChains: true })}
          >
            <X size={15} /> Reset
          </button>
          <button type="button" className="btn btn--primary" style={{ marginLeft: "auto" }} onClick={onClose}>
            Show {visiblePlaces.length} spots
          </button>
        </div>
      </div>
    </PaperDialog>
  );
}

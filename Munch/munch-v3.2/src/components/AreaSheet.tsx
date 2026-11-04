import { Crosshair, LocateFixed } from "lucide-react";
import { useApp } from "@/store";
import { AREAS, isLiveArea } from "@/lib/places";
import { radiusLabel } from "@/lib/geo";
import { PaperDialog } from "@/components/PaperDialog";
import { LIVE_RADII } from "@/store";

export function AreaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    areaId,
    mode,
    userPos,
    liveRadius,
    locate,
    locating,
    setLiveRadius,
    chooseArea,
    notify,
    setSearchNotice,
    searchNotice,
  } = useApp();

  const runLocate = async () => {
    const result = await locate();
    setSearchNotice(result.message);
    notify(result.message);
    if (result.ok) onClose();
  };

  const changeRadius = async (value: number) => {
    setLiveRadius(value);
    if (mode === "live" || mode === "empty") {
      const result = await locate(value);
      setSearchNotice(result.message);
    }
  };

  const world = AREAS.filter(isLiveArea);

  return (
    <PaperDialog open={open} onClose={onClose} className="dialog--sheet" labelledBy="area-title">
      <div className="area-sheet">
        <p className="eyebrow">Location</p>
        <h2 id="area-title" className="title title--sm" style={{ marginTop: 3 }}>
          Where to eat
        </h2>

        <button type="button" className="locate-row" onClick={runLocate} disabled={locating} aria-busy={locating}>
          <span className="locate-row__icon">
            {locating ? <Crosshair className="spin" /> : <LocateFixed />}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="locate-row__title">{locating ? "Finding you…" : "Use my precise location"}</span>
            <span className="locate-row__sub">
              {userPos
                ? `GPS ±${Math.round(userPos.accuracy)} m · ${mode === "live" ? `live within ${radiusLabel(liveRadius)} mi` : "bundled area"}`
                : "High-accuracy GPS, then the nearest restaurants"}
            </span>
          </span>
          <span aria-hidden="true">→</span>
        </button>

        {(mode === "live" || mode === "empty") && (
          <div className="filter-block">
            <span className="filter-block__label">Live search radius</span>
            <div className="radius-chips">
              {LIVE_RADII.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  aria-pressed={liveRadius === value}
                  onClick={() => void changeRadius(value)}
                >
                  {radiusLabel(value)} mi
                </button>
              ))}
            </div>
            <p className="sheet-note">
              Wider radii pull more OpenStreetMap venues, but every pin is still an exact, mapped location.
            </p>
          </div>
        )}

        <div className="filter-block">
          <span className="filter-block__label">Start somewhere in the world</span>
          <div className="world-grid">
            {world.map((area) => (
              <button
                key={area.id}
                type="button"
                className="world-chip"
                aria-pressed={areaId === area.id}
                onClick={() => {
                  chooseArea(area.id);
                  onClose();
                }}
              >
                <span className="world-chip__name">{area.label}</span>
                <span className="world-chip__meta">{area.city}</span>
              </button>
            ))}
          </div>
          <p className="sheet-note">
            These run on live OpenStreetMap data around each city centre. OpenStreetMap is crowd-sourced and
            can lag behind Google, so always check the venue’s own page before travelling.
          </p>
        </div>

        {searchNotice && (
          <p className="sheet-note" role="status" style={{ color: "var(--tomato-ink)", fontWeight: 800 }}>
            {searchNotice}
          </p>
        )}
      </div>
    </PaperDialog>
  );
}

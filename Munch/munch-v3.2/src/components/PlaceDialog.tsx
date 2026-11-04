import { useMemo, useState } from "react";
import {
  CalendarPlus,
  Clock,
  ExternalLink,
  Flame,
  Globe2,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Star,
  Users,
} from "lucide-react";
import { useApp } from "@/store";
import { openState, fmtTime } from "@/lib/hours";
import { formatPhone, websiteLabel, radiusLabel } from "@/lib/geo";
import { PaperDialog } from "@/components/PaperDialog";
import { PlacePhoto } from "@/components/PlacePhoto";
import { ShareDialog } from "@/components/ShareDialog";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMES = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];

export function PlaceDialog({ onShowOnMap }: { onShowOnMap: (place: NonNullable<ReturnType<typeof useApp>["detailPlace"]>) => void }) {
  const {
    detailPlace: place,
    closeDetail,
    isSaved,
    savePlace,
    unsavePlace,
    distanceText,
    distanceTo,
    showRoute,
    userPos,
    bookings,
    addBooking,
    notify,
    joinWaitlist,
    mode,
    liveRadius,
    area,
  } = useApp();

  const [reserve, setReserve] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("19:30");
  const [party, setParty] = useState(2);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const status = place ? openState(place) : null;
  const saved = place ? isSaved(place.id) : false;
  const today = useMemo(() => new Date().getDay(), []);
  const lastBooking = place
    ? bookings.find((booking) => booking.placeId === place.id && true)
    : null;

  const exact = place ? `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}` : "";
  const googleTable = place
    ? `https://www.google.com/search?q=${encodeURIComponent(
        `${place.name} ${place.address || place.neighborhood || ""} reserve a table`,
      )}`
    : "#";

  return (
    <>
    <PaperDialog open={Boolean(place)} onClose={closeDetail} labelledBy="place-title">
      {place && (
        <>
          <div className="dialog__photo">
            <PlacePhoto place={place} width={1400} loading="eager" badge />
            <span className="sticker">
              {mode === "live" ? `Live OSM · ${radiusLabel(liveRadius)} mi` : `${distanceText(place)} away`}
            </span>
          </div>

          <div className="dialog__body">
            <div className="dialog__head">
              <div style={{ minWidth: 0 }}>
                <p className="eyebrow eyebrow--tomato">{place.cuisine}</p>
                <h2 id="place-title" className="dialog__name">
                  {place.name}
                </h2>
                <div className="dialog__meta">
                  {place.rating && (
                    <span>
                      <Star size={13} fill="currentColor" style={{ color: "var(--mustard-deep)" }} />
                      <strong>{place.rating.toFixed(1)}</strong>
                      {place.reviews ? ` (${place.reviews.toLocaleString("en-US")})` : ""}
                    </span>
                  )}
                  {place.priceLevel && <span>{place.priceLevel}</span>}
                  <span>
                    <MapPin size={13} /> {place.address || place.neighborhood || "San Francisco"}
                  </span>
                  {status && (
                    <span
                      className={`pill ${status.open ? "pill--status-open" : "pill--status-closed"}`}
                      style={{ padding: "2px 8px" }}
                    >
                      {status.label}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="save-btn"
                style={{ width: 46, height: 46, flexShrink: 0 }}
                aria-pressed={saved}
                aria-label={saved ? `Remove ${place.name} from cravings` : `Save ${place.name} to cravings`}
                onClick={() => {
                  if (saved) unsavePlace(place.id);
                  else savePlace(place);
                }}
              >
                <Flame fill={saved ? "currentColor" : "none"} />
              </button>
            </div>

            <div className="dialog__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  void showRoute(place);
                  onShowOnMap(place);
                }}
              >
                <Navigation /> Walking route
              </button>
              <button type="button" className="btn btn--cream" onClick={() => setReserve((value) => !value)}>
                <CalendarPlus /> {reserve ? "Hide booking" : "Reserve a table"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  joinWaitlist(place, party);
                  closeDetail();
                }}
              >
                <Clock /> Waitlist
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setShareOpen(true)}>
                <Share2 /> Share
              </button>
              {place.phone && (
                <a
                  className="btn btn--ghost"
                  href={`tel:${place.phone.replace(/[^\d+]/g, "")}`}
                  aria-label={`Call ${place.name} at ${formatPhone(place.phone)}`}
                >
                  <Phone /> Call
                </a>
              )}
              {place.website && (
                <a className="btn btn--ghost" href={place.website} target="_blank" rel="noreferrer">
                  <ExternalLink /> {websiteLabel(place.website)}
                </a>
              )}
            </div>

            {reserve && (
              <div className="dialog__section">
                <h3>Book {place.name}</h3>
                <a className="reserve-google" href={googleTable} target="_blank" rel="noreferrer">
                  <span className="reserve-google__icon" aria-hidden="true">
                    G
                  </span>
                  <span>
                    <strong>Reserve on Google</strong>
                    <small>Opens Google results with the venue’s booking links.</small>
                  </span>
                  <ExternalLink aria-hidden="true" />
                </a>
                <p className="sheet-note reserve-note">
                  Prefer to keep it here? Request a table below and we’ll track it for you.
                </p>
                <form
                  className="reserve-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addBooking(place, date, time, party);
                    closeDetail();
                    notify(`Table requested at ${place.name} · ${time} for ${party}`);
                  }}
                >
                  <div className="field">
                    <label htmlFor="res-date">Date</label>
                    <input
                      id="res-date"
                      type="date"
                      value={date}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="res-time">Time</label>
                    <select id="res-time" value={time} onChange={(event) => setTime(event.target.value)}>
                      {TIMES.map((slot) => (
                        <option key={slot} value={slot}>
                          {fmtTime(
                            Number(slot.split(":")[0]) * 60 + Number(slot.split(":")[1]),
                          )}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ minWidth: 130 }}>
                    <label id="party-label">Party</label>
                    <div className="stepper" role="group" aria-labelledby="party-label">
                      <button type="button" onClick={() => setParty((value) => Math.max(1, value - 1))} aria-label="One fewer guest">
                        −
                      </button>
                      <span aria-live="polite">
                        <Users size={13} style={{ display: "inline", marginRight: 3, verticalAlign: -2 }} />
                        {party}
                      </span>
                      <button type="button" onClick={() => setParty((value) => Math.min(10, value + 1))} aria-label="One more guest">
                        +
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="btn btn--primary">
                    Request table
                  </button>
                </form>
                {lastBooking && (
                  <p className="sheet-note">
                    You already have a {lastBooking.status} booking here on {lastBooking.date} at {lastBooking.time}.
                  </p>
                )}
              </div>
            )}

            <div className="dialog__facts">
              <div className="fact">
                <span className="fact__label">Exact coordinates</span>
                <span className="fact__value" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {exact}
                </span>
              </div>
              <div className="fact">
                <span className="fact__label">Distance</span>
                <span className="fact__value">
                  {distanceText(place)}
                  {userPos
                    ? ` · ${distanceTo(place) < 9.95 ? distanceTo(place).toFixed(1) : Math.round(distanceTo(place))} mi from your GPS fix`
                    : ` from ${area.label}`}
                </span>
              </div>
              <div className="fact">
                <span className="fact__label">Phone</span>
                <span className="fact__value">{formatPhone(place.phone) || "Not listed"}</span>
              </div>
              <div className="fact">
                <span className="fact__label">Source</span>
                <span className="fact__value" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Globe2 size={13} /> {place.source === "osm" ? "OpenStreetMap live" : "Google Maps (bundled)"}
                </span>
              </div>
            </div>

            <div className="dialog__section">
              <h3>Hours</h3>
              {place.hours ? (
                <div className="hours-grid">
                  {DAYS.map((day, index) => {
                    const windows = place.hours?.[day] || [];
                    return (
                      <div key={day} className={`hours-row${index === today ? " is-today" : ""}`}>
                        <span>{DAY_LABEL[index]}</span>
                        <span>
                          {windows.length
                            ? windows
                                .map(([open, close]) => `${fmtTime(open)} – ${fmtTime(close)}`)
                                .join(" · ")
                            : "Closed"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="sheet-note" style={{ marginTop: 0 }}>
                  Hours are not listed for this venue. Calling ahead is the reliable move.
                </p>
              )}
            </div>

            <div className="dialog__section" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn--cream btn--sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(exact);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? "Coordinates copied" : "Copy coordinates"}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  closeDetail();
                  onShowOnMap(place);
                }}
              >
                <MapPin /> Centre on map
              </button>
              <a
                className="btn btn--ghost btn--sm"
                href={
                  place.mapsUrl ??
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${place.name} ${place.address || place.neighborhood || ""}`,
                  )}`
                }
                target="_blank"
                rel="noreferrer"
              >
                Open in Google Maps
              </a>
              <a
                className="btn btn--ghost btn--sm"
                href={`https://www.google.com/search?q=${encodeURIComponent(
                  `${place.name} ${place.address || place.neighborhood || ""} opening hours`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Verify details on Google
              </a>
            </div>
          </div>
        </>
      )}
    </PaperDialog>
    <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} place={place} />
    </>
  );
}

import { useMemo, useState } from "react";
import { CalendarX2, Clock, MapPin, MessageSquare, Navigation, Plus, Users } from "lucide-react";
import { useApp } from "@/store";
import { placeById } from "@/lib/places";
import { PaperDialog } from "@/components/PaperDialog";
import { PlacePhoto } from "@/components/PlacePhoto";
import { fmtTime } from "@/lib/hours";
import type { Place } from "@/lib/types";

function formatDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: date.toLocaleDateString("en-US", { month: "short" }),
    label: date.toLocaleDateString("en-US", { weekday: "long" }),
    isToday: new Date().toDateString() === date.toDateString(),
  };
}

function relativeDay(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Tonight";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function Bookings({ onShowOnMap }: { onShowOnMap: (place: Place) => void }) {
  const {
    bookings,
    cancelBooking,
    confirmBooking,
    openDetail,
    showRoute,
    waitlist,
    setScreen,
    allKnown,
    savedPlaces,
    area,
  } = useApp();
  const [pickerOpen, setPickerOpen] = useState(false);

  const upcoming = useMemo(
    () =>
      [...bookings].sort(
        (a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime(),
      ),
    [bookings],
  );

  const pastPlaces = [area.restaurants[4], area.restaurants[1], area.restaurants[7]].filter(Boolean);
  const candidates = [...savedPlaces, ...area.restaurants.filter((place) => !savedPlaces.some((saved) => saved.id === place.id))].slice(
    0,
    8,
  );

  return (
    <div>
      <div className="page__head">
        <div>
          <p className="eyebrow">Your table</p>
          <h1 className="title">Bookings</h1>
          <p className="sub">
            {upcoming.length} upcoming reservation{upcoming.length === 1 ? "" : "s"}
            {waitlist ? ` · #${waitlist.position} at ${waitlist.place}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="iconbtn iconbtn--dark"
          aria-label="Add a booking"
          onClick={() => setPickerOpen(true)}
        >
          <Plus />
        </button>
      </div>

      {upcoming.length === 0 ? (
        <div className="empty">
          <div className="empty__art" aria-hidden="true">
            <span className="empty__disc" />
            <span className="empty__icon">
              <CalendarX2 />
            </span>
            <span className="sticker sticker--tomato" style={{ position: "absolute", bottom: 0, right: -10 }}>
              No tables
            </span>
          </div>
          <h2 className="empty__title">No tables booked</h2>
          <p className="empty__text">
            Confirm a spot you craved and the reservation, directions and reminders all live here.
          </p>
          <div className="empty__actions">
            <button type="button" className="btn btn--primary" onClick={() => setScreen("discover")}>
              Find a table
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setScreen("inbox")}>
              See your waitlists
            </button>
          </div>
          <p className="empty__hint">Tables near {area.label} open around 5pm</p>
        </div>
      ) : (
        upcoming.map((booking, index) => {
          const place = placeById(booking.placeId, allKnown);
          const date = formatDate(booking.date);
          const hero = index === 0;
          return (
            <article key={booking.id} className={`booking-card${hero ? " booking-card--hero" : ""}`}>
              <div className="booking-card__top">
                <div className="date-tile">
                  <span className="date-tile__day">{date.day}</span>
                  <span className="date-tile__month">{date.month}</span>
                </div>
                <div className="booking-card__head">
                  <span className={`badge ${booking.status === "confirmed" ? "pill--sage" : "pill--mustard"} pill`}>
                    {booking.status === "confirmed" ? "Confirmed" : "Pending"}
                  </span>
                  <h2 className="booking-card__name">{booking.name}</h2>
                  <p className="booking-card__meta">
                    {relativeDay(booking.date)} · {fmtTime(Number(booking.time.split(":")[0]) * 60 + Number(booking.time.split(":")[1]))} · Table for{" "}
                    {booking.party}
                  </p>
                </div>
                {place && <PlacePhoto place={place} width={240} className="booking-card__thumb" />}
              </div>
              <div className="booking-card__actions">
                <button
                  type="button"
                  className={`btn ${hero ? "btn--cream" : "btn--primary"}`}
                  disabled={!place}
                  onClick={() => {
                    if (!place) return;
                    void showRoute(place);
                    onShowOnMap(place);
                  }}
                >
                  <Navigation /> Directions
                </button>
                <button type="button" className={`btn ${hero ? "btn--ghost" : "btn--cream"}`} onClick={() => place && openDetail(place)}>
                  Manage
                </button>
                {booking.status === "pending" && (
                  <button type="button" className="btn btn--ghost" onClick={() => confirmBooking(booking.id)}>
                    Confirm
                  </button>
                )}
                <button type="button" className="btn btn--ghost" onClick={() => setScreen("inbox")}>
                  <MessageSquare /> Message
                </button>
              </div>
              <div className="booking-card__foot">
                <span style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12, opacity: 0.75 }}>
                  <MapPin size={13} /> {booking.address || place?.address || area.label}
                </span>
                <button type="button" className="link-quiet" onClick={() => cancelBooking(booking.id)}>
                  Cancel reservation
                </button>
              </div>
            </article>
          );
        })
      )}

      <div className="section-head">
        <h2>Past visits</h2>
        <span className="section-head__meta">Your last three</span>
      </div>
      <div className="card card--pad">
        {pastPlaces.map((place, index) => (
          <div className="past-row" key={place.id}>
            <PlacePhoto place={place} width={180} className="past-row__thumb" />
            <div className="past-row__body">
              <p className="past-row__name">{place.name}</p>
              <p className="past-row__meta">
                {index === 0 ? "Sun 12 Oct" : index === 1 ? "Wed 8 Oct" : "Fri 26 Sep"} · Table for{" "}
                {index + 2}
              </p>
            </div>
            <button type="button" className="link-quiet" onClick={() => openDetail(place)}>
              Leave a note
            </button>
          </div>
        ))}
      </div>

      {waitlist ? (
        <div className="waitlist-paper">
          <span className="waitlist-paper__icon">
            <Clock size={19} />
          </span>
          <span className="waitlist-paper__body">
            <span className="waitlist-paper__title">On the list at {waitlist.place}</span>
            <span className="waitlist-paper__text">
              #{waitlist.position} of {waitlist.total} · about {waitlist.minutes} min · party of {waitlist.party}
            </span>
          </span>
          <button type="button" className="btn btn--cream btn--sm" onClick={() => setScreen("inbox")}>
            View
          </button>
        </div>
      ) : (
        <div className="waitlist-paper">
          <span className="waitlist-paper__icon">
            <Clock size={19} />
          </span>
          <span className="waitlist-paper__body">
            <span className="waitlist-paper__title">Fully booked?</span>
            <span className="waitlist-paper__text">Join a waitlist and we'll ping you when a table frees up.</span>
          </span>
          <button type="button" className="btn btn--cream btn--sm" onClick={() => setPickerOpen(true)}>
            Join
          </button>
        </div>
      )}

      <PaperDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        className="dialog--sheet"
        labelledBy="pick-title"
      >
        <div style={{ padding: "22px 22px 20px" }}>
          <p className="eyebrow">New reservation</p>
          <h2 id="pick-title" className="title title--sm" style={{ marginTop: 3 }}>
            Pick a place to book
          </h2>
          <p className="sheet-note">Saved places first, then everything in {area.label}.</p>
          <div className="area-list" style={{ marginTop: 12 }}>
            {candidates.map((place) => (
              <button
                key={place.id}
                type="button"
                className="area-row"
                onClick={() => {
                  setPickerOpen(false);
                  openDetail(place);
                }}
              >
                <PlacePhoto place={place} width={120} className="past-row__thumb" />
                <span className="area-row__body">
                  <span className="area-row__name">{place.name}</span>
                  <span className="area-row__meta">
                    {place.cuisine} · {place.address}
                  </span>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <p className="sheet-note" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Users size={14} /> Reservations are a prototype: they are stored in this browser.
          </p>
        </div>
      </PaperDialog>
    </div>
  );
}

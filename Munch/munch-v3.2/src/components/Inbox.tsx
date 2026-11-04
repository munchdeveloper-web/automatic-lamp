import { useState } from "react";
import { ArrowLeft, BarChart3, CalendarCheck, Check, Clock, Heart } from "lucide-react";
import { useApp } from "@/store";
import type { InboxKind } from "@/lib/types";

const ICONS = {
  clock: Clock,
  check: Check,
  trend: BarChart3,
  heart: Heart,
  calendar: CalendarCheck,
};

const TONES: Record<string, string> = {
  clock: "inbox-item__icon--tomato",
  check: "inbox-item__icon--mustard",
  trend: "inbox-item__icon--sage",
  heart: "",
  calendar: "inbox-item__icon--mustard",
};

export function Inbox() {
  const { inbox, unread, markRead, markAllRead, setScreen, waitlist, leaveWaitlist, notify } = useApp();
  const [filter, setFilter] = useState<"all" | InboxKind>("all");

  const visible = inbox.filter((item) => filter === "all" || item.kind === filter);
  const counts = {
    all: inbox.length,
    waitlist: inbox.filter((item) => item.kind === "waitlist").length,
    alerts: inbox.filter((item) => item.kind === "alerts").length,
  };

  return (
    <div>
      <div className="inbox-head">
        <button
          type="button"
          className="iconbtn"
          onClick={() => setScreen("discover")}
          aria-label="Back to Discover"
        >
          <ArrowLeft />
        </button>
        <div className="inbox-head__body">
          <p className="eyebrow">{unread} unread</p>
          <h1 className="inbox-head__title">Inbox</h1>
        </div>
        <button
          type="button"
          className="mark-read"
          onClick={() => {
            markAllRead();
            notify("Everything marked as read");
          }}
        >
          Mark all read
        </button>
      </div>
      <p className="sub" style={{ marginTop: 4 }}>
        Waitlist updates and table alerts
      </p>

      <div className="chips" role="group" aria-label="Filter inbox" style={{ marginTop: 12 }}>
        {[
          { id: "all" as const, label: "All" },
          { id: "waitlist" as const, label: "Waitlist" },
          { id: "alerts" as const, label: "Alerts" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label} <span className="chip__count">{counts[item.id]}</span>
          </button>
        ))}
      </div>

      {waitlist && (filter === "all" || filter === "waitlist") && (
        <article className="wait-card">
          <div className="wait-card__top">
            <div>
              <span className="sticker">Waitlisted</span>
              <h2 className="wait-card__name">{waitlist.place}</h2>
              <p className="wait-card__meta">
                Today · Party of {waitlist.party} · {waitlist.place.includes("Papito") ? "Mexican · 0.2 mi" : "Nearby"}
              </p>
            </div>
            <div className="wait-card__pos">
              <span className="wait-card__num">{waitlist.position}</span>
              <span className="wait-card__of">of {waitlist.total}</span>
            </div>
          </div>
          <div
            className="wait-card__track"
            role="img"
            aria-label={`You are ${waitlist.position}${waitlist.position === 3 ? "rd" : "th"} in a queue of ${waitlist.total}`}
          >
            <span
              className="wait-card__fill"
              style={{ width: `${Math.max(12, 100 - (waitlist.position / waitlist.total) * 100)}%` }}
            />
          </div>
          <div className="wait-card__foot">
            <span className="wait-card__note">
              About {waitlist.minutes} min · {waitlist.position <= 3 ? "near the front" : "hanging tight"}
            </span>
            <button type="button" className="btn btn--cream btn--sm" onClick={leaveWaitlist}>
              Leave
            </button>
          </div>
        </article>
      )}

      <div className="section-head">
        <h2>Recent</h2>
        <span className="section-head__meta">Today</span>
      </div>

      {visible.length > 0 ? (
        <ul className="card inbox-list">
          {visible.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li className={`inbox-item${item.unread ? " is-unread" : ""}`} key={item.id}>
                <button
                  type="button"
                  className="inbox-item__btn"
                  onClick={() => {
                    markRead(item.id);
                    if (item.icon === "trend" && waitlist) setScreen("bookings");
                  }}
                >
                  <span className="inbox-item__row">
                    <span className={`inbox-item__icon ${TONES[item.icon] || ""}`} aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="inbox-item__body">
                      <span className="inbox-item__top">
                        <span className="inbox-item__title">{item.title}</span>
                        <span className="inbox-item__time">{item.time}</span>
                      </span>
                      <span className="inbox-item__text">{item.text}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="inbox-empty">
          <p className="empty__title" style={{ fontSize: 20 }}>
            Nothing in this filter
          </p>
          <p className="sheet-note">Try “All” to see everything.</p>
        </div>
      )}

      <p className="sheet-note" style={{ marginTop: 18 }}>
        Alerts and waitlist positions are prototype data held in this browser.
      </p>
    </div>
  );
}

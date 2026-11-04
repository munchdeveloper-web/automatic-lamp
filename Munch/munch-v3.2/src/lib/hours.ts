import type { HoursMap, Place } from "@/lib/types";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatters = new Map<string, Intl.DateTimeFormat>();

function clock(tz: string) {
  let formatter = formatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    formatters.set(tz, formatter);
  }
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  const day = Math.max(0, DAYS.indexOf(String(get("weekday")).toLowerCase()));
  return { day, mins: (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10) };
}

export const fmtTime = (mins: number) => {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
};

type Span = { start: number; end: number; closesAt: number };

function weekSpans(hours: HoursMap): Span[] {
  const spans: Span[] = [];
  for (let day = 0; day < 7; day += 1) {
    for (const [open, close] of hours[DAYS[day]] || []) {
      const duration = close > open ? close - open : close + 1440 - open;
      const start = day * 1440 + open;
      spans.push({ start, end: start + duration, closesAt: close });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

export type OpenState = { open: boolean; label: string; known: boolean };

export function openState(place: Place): OpenState {
  if (!place.hours) return { open: false, label: "Hours unavailable", known: false };

  const tz = place.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  let day = 0;
  let mins = 0;
  try {
    const now = clock(tz);
    day = now.day;
    mins = now.mins;
  } catch {
    const d = new Date();
    day = d.getDay();
    mins = d.getHours() * 60 + d.getMinutes();
  }

  const now = day * 1440 + mins;
  const spans = weekSpans(place.hours);

  for (const span of spans) {
    for (const shift of [-10080, 0, 10080]) {
      if (now >= span.start + shift && now < span.end + shift) {
        return { open: true, label: `Open now · till ${fmtTime(span.closesAt)}`, known: true };
      }
    }
  }

  const next = spans.find((span) => span.start > now);
  if (next) {
    const dayLabel = DAY_LABEL[Math.floor(next.start / 1440) % 7];
    const sameDay = Math.floor(next.start / 1440) === day;
    return {
      open: false,
      known: true,
      label: `Closed · opens ${sameDay ? "" : dayLabel + " "}${fmtTime(next.start % 1440)}`,
    };
  }
  return { open: false, label: "Closed", known: true };
}

/* ---- OSM opening_hours (the subset Overpass actually returns) ---- */
const DAY_TOKENS: Record<string, number> = { mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6, su: 0 };

function parseDays(text: string): number[] {
  const days = new Set<number>();
  text.split(",").forEach((chunk) => {
    const range = /^([a-z]{2})\s*-\s*([a-z]{2})$/i.exec(chunk.trim());
    const single = /^([a-z]{2})$/i.exec(chunk.trim());
    if (range) {
      const from = DAY_TOKENS[range[1].toLowerCase()];
      const to = DAY_TOKENS[range[2].toLowerCase()];
      if (from === undefined || to === undefined) return;
      let cursor = from;
      for (let i = 0; i < 8; i += 1) {
        days.add(cursor);
        if (cursor === to) break;
        cursor = (cursor + 1) % 7;
      }
    } else if (single) {
      const day = DAY_TOKENS[single[1].toLowerCase()];
      if (day !== undefined) days.add(day);
    }
  });
  return [...days];
}

function toMinutes(part: string): number {
  const [h, m] = part.split(":").map(Number);
  return (h % 24) * 60 + (m || 0);
}

/** Turn an OSM opening_hours string into the weekly shape the rest of the app
    understands. Returns null instead of inventing hours we cannot parse. */
export function parseOpeningHours(spec: string): HoursMap | null {
  if (!spec) return null;
  const cleaned = spec.replace(/\s+/g, " ").trim();
  if (/24\/7/.test(cleaned)) {
    const all: HoursMap = {};
    DAYS.forEach((day) => (all[day] = [[0, 1440]]));
    return all;
  }
  const hours: HoursMap = {};
  let matched = false;

  for (const rule of cleaned.split(";")) {
    const [dayPart, timePart] = rule.split(/\s+(?=\d)/);
    if (!timePart) continue;
    const days = parseDays(dayPart);
    if (!days.length) continue;
    const windows: [number, number][] = [];
    for (const time of timePart.split(",")) {
      const range = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(time.trim());
      if (!range) continue;
      const open = toMinutes(range[1]);
      const close = toMinutes(range[2]);
      if (open === close) continue;
      windows.push([open, close]);
    }
    if (!windows.length) continue;
    matched = true;
    days.forEach((day) => {
      hours[DAYS[day]] = windows;
    });
  }
  return matched ? hours : null;
}

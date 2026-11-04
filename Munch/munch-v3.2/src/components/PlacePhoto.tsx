import { useState } from "react";
import { photoFor } from "@/lib/places";
import type { Place } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRealPhoto } from "@/lib/useRealPhoto";

const TONES = [
  "linear-gradient(135deg, #e9a820, #f2c4a0)",
  "linear-gradient(135deg, #7a9b6d, #d9c49c)",
  "linear-gradient(135deg, #f2c4a0, #ae3a22)",
  "linear-gradient(135deg, #254434, #7a9b6d)",
];

/** Image with a paper monogram fallback, so a failed network photo still looks designed. */
export function PlacePhoto({
  place,
  width = 1200,
  className,
  alt,
  loading = "lazy",
  badge = false,
}: {
  place: Place;
  width?: number;
  className?: string;
  alt?: string;
  loading?: "lazy" | "eager";
  /** Show a small label: real-photo credit, or "Sample photo" when stock imagery stands in. */
  badge?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const real = useRealPhoto(place, width);
  const realUrl = real?.url ?? (place.photo?.startsWith("http") ? place.photo : null);
  const credit = real?.credit ? `Photo: ${real.credit} · Google` : place.photoKind === "osm" ? "Photo: OpenStreetMap contributor" : null;
  let tone = 0;
  for (let i = 0; i < place.name.length; i += 1) tone = (tone + place.name.charCodeAt(i)) % TONES.length;

  if (failed) {
    return (
      <div
        className={cn("photo-fallback", className)}
        aria-hidden="true"
        style={{
          background: TONES[tone],
          display: "grid",
          placeItems: "center",
          color: "#fffdf5",
          fontFamily: "var(--font-head)",
          fontSize: 42,
          fontWeight: 800,
          textShadow: "0 2px 10px rgba(0,0,0,.25)",
        }}
      >
        {place.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <>
      <img
        src={realUrl ?? photoFor(place, width)}
        alt={alt ?? `${place.name} — ${place.cuisine}`}
        className={className}
        loading={loading}
        decoding="async"
        onError={() => setFailed(true)}
        draggable={false}
      />
      {badge && <span className="photo-badge">{realUrl ? credit ?? "Photo" : "Sample photo"}</span>}
    </>
  );
}

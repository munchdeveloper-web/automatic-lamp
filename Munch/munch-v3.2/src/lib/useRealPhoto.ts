import { useEffect, useState } from "react";
import { useAuth } from "@/auth/auth-context";
import { HAS_API } from "@/lib/authConfig";
import { fetchVenuePhoto, type VenuePhoto } from "@/lib/munchApi";
import type { Place } from "@/lib/types";

/** Real photos are opt-in at build time: set VITE_MUNCH_REAL_PHOTOS=1 and deploy the API with a photo key. */
export const REAL_PHOTOS = HAS_API && String(import.meta.env.VITE_MUNCH_REAL_PHOTOS ?? "") === "1";

const memory = new Map<string, VenuePhoto | null>();
const inflight = new Map<string, Promise<VenuePhoto | null>>();

/**
 * Resolves a real photo for a venue that has none yet.
 * Order of truth: OSM image tags (already on `place.photo`) → provider via /v1/photo → sample photo.
 * Returns null while loading, when disabled, signed out, or when the provider has no photo.
 */
export function useRealPhoto(place: Place, width: number): VenuePhoto | null {
  const { getToken, user } = useAuth();
  const [photo, setPhoto] = useState<VenuePhoto | null>(() => memory.get(place.id) ?? null);

  useEffect(() => {
    if (!REAL_PHOTOS || !user || place.photo?.startsWith("http")) return;
    const cached = memory.get(place.id);
    if (cached !== undefined) {
      setPhoto(cached);
      return;
    }
    let live = true;
    let job = inflight.get(place.id);
    if (!job) {
      job = (async () => {
        const token = await getToken();
        if (!token) return null;
        const result = await fetchVenuePhoto(token, { name: place.name, lat: place.lat, lng: place.lng, width });
        return result.url ? result : null;
      })()
        .catch(() => null)
        .then((result) => {
          memory.set(place.id, result);
          inflight.delete(place.id);
          return result;
        });
      inflight.set(place.id, job);
    }
    job.then((result) => {
      if (live) setPhoto(result);
    });
    return () => {
      live = false;
    };
  }, [place.id, place.name, place.lat, place.lng, place.photo, user, getToken, width]);

  return photo;
}

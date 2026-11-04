import { API_URL } from "@/lib/authConfig";
import type { Area } from "@/lib/types";

/**
 * Thin client for the Munch Neon Function / edge API.
 *
 * The browser never sends a profile id. It sends the provider bearer token and
 * the server resolves profiles.id from the verified subject claim.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<T> {
  if (!API_URL) throw new ApiError("No Munch API configured", 0);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (!response.ok) {
      throw new ApiError(body.error || body.message || `Request failed (${response.status})`, response.status);
    }
    return body as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export type ServerProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
  last_area_id: string | null;
  last_area_source: "gps" | "manual" | "default" | null;
  last_area_updated_at: string | null;
};

export type LastLocation = {
  lat: number;
  lng: number;
  accuracy_m: number | null;
  label: string | null;
  area_id: string | null;
  source: "gps" | "search";
  captured_at: string;
};

export type SessionSnapshot = {
  profile: ServerProfile | null;
  last_location: LastLocation | null;
  last_area: { id: string; source: "gps" | "manual" | "default" } | null;
};

export async function fetchSession(token: string): Promise<SessionSnapshot> {
  return request<SessionSnapshot>("/v1/session", token, { method: "GET" });
}

export async function saveLocation(
  token: string,
  input: {
    lat: number;
    lng: number;
    accuracy_m?: number;
    label?: string;
    area_id?: string;
    source: "gps" | "search";
  },
): Promise<LastLocation> {
  return request<LastLocation>("/v1/location", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function saveArea(
  token: string,
  input: { area_id: string; source: "gps" | "manual" | "default"; label?: string; city?: string },
): Promise<{ id: string; source: string }> {
  return request<{ id: string; source: string }>("/v1/area", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function clearLocationHistory(
  token: string,
): Promise<{ ok: boolean; removed: number }> {
  return request<{ ok: boolean; removed: number }>("/v1/location", token, { method: "DELETE" });
}

export async function sendInvite(
  token: string,
  input: { to: string; placeName?: string; shareUrl?: string; fromName?: string; message?: string },
): Promise<{ ok: boolean; id?: string }> {
  return request<{ ok: boolean; id?: string }>("/v1/invite", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteRemoteAccount(
  token: string,
): Promise<{ ok: boolean; deleted_profile: boolean }> {
  return request<{ ok: boolean; deleted_profile: boolean }>("/v1/account", token, {
    method: "DELETE",
    body: JSON.stringify({ confirm: "DELETE" }),
  });
}

export function areaFallback(area: Area) {
  return { id: area.id, source: "manual" as const };
}

export type VenuePhoto = { url: string | null; credit: string | null };

export async function fetchVenuePhoto(
  token: string,
  input: { name: string; lat: number; lng: number; width?: number },
): Promise<VenuePhoto> {
  const query = new URLSearchParams({
    name: input.name,
    lat: String(input.lat),
    lng: String(input.lng),
    w: String(input.width ?? 800),
  });
  return request<VenuePhoto>(`/v1/photo?${query.toString()}`, token, { method: "GET" }, 6000);
}

/** Configuration that must be decided at build time. */

export const CLERK_PUBLISHABLE_KEY = String(
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "",
).trim();

/** Only a publishable key may ever reach the browser. */
export const HAS_CLERK = /^pk_(test|live)_/.test(CLERK_PUBLISHABLE_KEY);

export const API_URL = String(import.meta.env.VITE_MUNCH_API_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

export const HAS_API = API_URL.length > 0;

/** Shown in Profile → Account so the identity mode is never a mystery. */
export const IDENTITY_MODE: "clerk" | "local" = HAS_CLERK ? "clerk" : "local";

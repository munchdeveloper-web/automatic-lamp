import { createContext, useContext } from "react";

/**
 * One identity interface for two backends:
 *
 *   clerk  — production, verified by Clerk; tokens are short-lived JWTs.
 *   local  — zero-config demo mode used when VITE_CLERK_PUBLISHABLE_KEY is absent.
 *
 * The rest of the app never talks to either SDK directly, so the data layer
 * keeps one shape and the internal profile key never leaves the server.
 */
export type AuthUser = {
  /** External identity id: Clerk `user_…` or a local demo id. Never a DB key. */
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt?: number;
};

export type AuthDialogMode = "signin" | "signup" | null;

export type AuthContextValue = {
  backend: "clerk" | "local";
  /** False until the provider has restored (or rejected) a session. */
  ready: boolean;
  user: AuthUser | null;
  /** Short-lived bearer token for the Munch API. Null in local mode. */
  getToken: () => Promise<string | null>;
  authDialog: AuthDialogMode;
  openAuth: (mode: Exclude<AuthDialogMode, null>) => void;
  closeAuth: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ ok: boolean; message: string }>;
  /** Local demo backend only; Clerk renders its own <SignIn/>/<SignUp/>. */
  authenticate?: (
    mode: "signin" | "signup",
    input: { name?: string; email: string; password: string },
  ) => Promise<{ ok: boolean; message: string }>;
  /** True when the splash can hand over to the shell. */
  booted: boolean;
  error: string | null;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export const AUTH_TIMEOUT_MS = 9000;

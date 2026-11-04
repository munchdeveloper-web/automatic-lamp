import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth as useClerkAuth, useUser } from "@clerk/react";
import {
  AuthContext,
  type AuthDialogMode,
  type AuthContextValue,
  type AuthUser,
} from "@/auth/auth-context";
import { HAS_API } from "@/lib/authConfig";
import { deleteRemoteAccount } from "@/lib/munchApi";

/**
 * Clerk-backed identity. Mounted only under <ClerkProvider>, which main.tsx
 * installs when a publishable key is present.
 */
export function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useClerkAuth();
  const { user } = useUser();

  const [authDialog, setAuthDialog] = useState<AuthDialogMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  // A hard ceiling so a slow/blocked Clerk script can never trap the splash.
  useEffect(() => {
    if (!isLoaded) {
      const timer = window.setTimeout(() => setBooted(true), 7000);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setBooted(true), 320);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  useEffect(() => {
    if (isSignedIn) setAuthDialog(null);
  }, [isSignedIn]);

  const mapped = useMemo<AuthUser | null>(() => {
    if (!user) return null;
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      "";
    return {
      id: user.id,
      name:
        user.fullName ||
        user.firstName ||
        user.username ||
        email.split("@")[0] ||
        "Diner",
      email,
      avatarUrl: user.imageUrl ?? null,
    };
  }, [user]);

  const openAuth = useCallback((mode: Exclude<AuthDialogMode, null>) => {
    setError(null);
    setAuthDialog(mode);
  }, []);
  const closeAuth = useCallback(() => setAuthDialog(null), []);

  const signOut = useCallback(async () => {
    try {
      await clerkSignOut();
    } catch {
      /* already signed out */
    }
    setAuthDialog(null);
  }, [clerkSignOut]);

  const deleteAccount = useCallback(async () => {
    if (!user) return { ok: false, message: "You are already signed out." };
    try {
      if (HAS_API) {
        const token = await getToken();
        if (!token) return { ok: false, message: "Your session expired. Sign in again, then retry." };
        await deleteRemoteAccount(token);
      } else {
        // Clerk allows client-side deletion; a recent sign-in may be required.
        await user.delete();
      }
      try {
        await clerkSignOut();
      } catch {
        /* deletion already revoked the session */
      }
      return {
        ok: true,
        message: "Your account and its saved data were deleted.",
      };
    } catch (cause) {
      const message =
        cause instanceof Error && /reverif|recent/i.test(cause.message)
          ? "For safety, Clerk needs a fresh sign-in before deletion. Sign out, sign in again, then delete."
          : "Clerk could not delete the account. Try again, or remove it from the Clerk dashboard.";
      setError(message);
      return { ok: false, message };
    }
  }, [user, getToken, clerkSignOut]);

  const token = useCallback(async () => {
    try {
      return (await getToken()) ?? null;
    } catch {
      return null;
    }
  }, [getToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      backend: "clerk",
      ready: isLoaded,
      user: mapped,
      getToken: token,
      authDialog,
      openAuth,
      closeAuth,
      signOut,
      deleteAccount,
      booted,
      error,
    }),
    [isLoaded, mapped, token, authDialog, openAuth, closeAuth, signOut, deleteAccount, booted, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

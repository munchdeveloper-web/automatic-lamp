import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AuthContext,
  type AuthDialogMode,
  type AuthUser,
  type AuthContextValue,
} from "@/auth/auth-context";

const ACCOUNTS_KEY = "munch:demo:accounts:v1";
const SESSION_KEY = "munch:demo:session:v1";

type LocalAccount = AuthUser & { createdAt: number };

function readAccounts(): LocalAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: LocalAccount[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* storage blocked */
  }
}

function idFor(email: string) {
  // Stable, non-secret local id. Never used as a server profile key.
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) hash = (hash * 31 + email.charCodeAt(i)) | 0;
  return `local_${Math.abs(hash).toString(36)}`;
}

function clearScopedData(userId: string) {
  try {
    const prefix = `munch:${userId}:`;
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage blocked */
  }
}

/**
 * Demo identity used when no Clerk publishable key is configured.
 * It exists so the product can be reviewed end-to-end offline. It is not
 * security: the password is never stored and never checked beyond length.
 */
export function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<LocalAccount[]>(() => readAccounts());
  const [userId, setUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(false);
  const [authDialog, setAuthDialog] = useState<AuthDialogMode>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 260);
    return () => window.clearTimeout(timer);
  }, []);

  const user = useMemo(
    () => accounts.find((account) => account.id === userId) ?? null,
    [accounts, userId],
  );

  const openAuth = useCallback((mode: Exclude<AuthDialogMode, null>) => {
    setError(null);
    setAuthDialog(mode);
  }, []);
  const closeAuth = useCallback(() => setAuthDialog(null), []);

  const authenticate = useCallback<NonNullable<AuthContextValue["authenticate"]>>(
    async (mode, input) => {
      const email = input.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return { ok: false, message: "Enter a valid email address." };
      }
      if (input.password.length < 8) {
        return { ok: false, message: "Use at least 8 characters." };
      }
      const existing = accounts.find((account) => account.email === email);
      if (mode === "signup" && existing) {
        return { ok: false, message: "That email already has an account. Sign in instead." };
      }
      if (mode === "signin" && !existing) {
        return { ok: false, message: "No demo account for that email yet. Create one first." };
      }

      const name = (input.name || "").trim();
      if (mode === "signup" && name.length < 2) {
        return { ok: false, message: "Tell us what to call you." };
      }

      const account: LocalAccount =
        existing ??
        ({
          id: idFor(email),
          name,
          email,
          avatarUrl: null,
          createdAt: Date.now(),
        } satisfies LocalAccount);

      if (!existing) {
        const next = [...accounts, account];
        setAccounts(next);
        writeAccounts(next);
      }
      try {
        localStorage.setItem(SESSION_KEY, account.id);
      } catch {
        /* storage blocked */
      }
      setUserId(account.id);
      setAuthDialog(null);
      return {
        ok: true,
        message: mode === "signup" ? `Welcome to munch., ${account.name}` : `Welcome back, ${account.name}`,
      };
    },
    [accounts],
  );

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage blocked */
    }
    setUserId(null);
    setAuthDialog(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!user) return { ok: false, message: "You are already signed out." };
    clearScopedData(user.id);
    const next = accounts.filter((account) => account.id !== user.id);
    setAccounts(next);
    writeAccounts(next);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage blocked */
    }
    setUserId(null);
    return { ok: true, message: "Demo account and its saved data were deleted." };
  }, [accounts, user]);

  const getToken = useCallback(async () => null, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      backend: "local",
      ready,
      user,
      getToken,
      authDialog,
      openAuth,
      closeAuth,
      signOut,
      deleteAccount,
      authenticate,
      booted: ready,
      error,
    }),
    [ready, user, getToken, authDialog, openAuth, closeAuth, signOut, deleteAccount, authenticate, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import type { ReactNode } from "react";
import { LocalAuthProvider } from "@/auth/LocalAuthProvider";
import { ClerkAuthProvider } from "@/auth/ClerkAuthProvider";
import { HAS_CLERK } from "@/lib/authConfig";

/**
 * Picks the identity backend once. Clerk's provider is already wrapping the
 * tree in main.tsx when a publishable key exists; otherwise the local demo
 * provider keeps the product reviewable with no environment at all.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!HAS_CLERK) return <LocalAuthProvider>{children}</LocalAuthProvider>;
  return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
}

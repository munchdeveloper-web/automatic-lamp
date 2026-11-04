import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import "./index.css";
import "./v31.css";
import "./v32.css";
import App from "./App";
import { AuthProvider } from "@/auth/AuthProvider";
import { CLERK_PUBLISHABLE_KEY, HAS_CLERK } from "@/lib/authConfig";

const tree = (
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);

createRoot(document.getElementById("root")!).render(
  HAS_CLERK ? (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#ae3a22",
          colorForeground: "#2d2216",
          colorBackground: "#fffdf5",
          colorInput: "#fff8e6",
          colorInputForeground: "#2d2216",
          colorNeutral: "#2d2216",
          fontFamily: "Nunito, ui-sans-serif, system-ui, sans-serif",
          borderRadius: "14px",
        },
      }}
    >
      {tree}
    </ClerkProvider>
  ) : (
    tree
  ),
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline shell is a progressive enhancement; the app works without it */
    });
  });
}

import { useEffect, useRef, useState } from "react";
import { SignIn, SignUp } from "@clerk/react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, LockKeyhole, X } from "lucide-react";
import { useAuth } from "@/auth/auth-context";
import { HAS_CLERK } from "@/lib/authConfig";
import { PaperDialog } from "@/components/PaperDialog";
import { TacoCollage } from "@/components/TacoCollage";

const CLERK_APPEARANCE = {
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
  elements: {
    card: { boxShadow: "none", border: "none", backgroundColor: "transparent", padding: "0" },
    cardBox: { boxShadow: "none", border: "none", backgroundColor: "transparent" },
    header: { display: "none" },
    headerTitle: { display: "none" },
    headerSubtitle: { display: "none" },
    footer: { display: "none" },
    footerAction: { display: "none" },
  },
} as const;

type Step = "form" | "code";

/**
 * Sign in / sign up inside the paper world.
 *
 * Clerk mode uses Clerk's own verified flow, including its email-code step.
 * Without a publishable key, the local demo adds an explicit six-digit step so
 * the verification pattern is visible end to end; the code is shown on a paper
 * slip because there is no mail provider in demo mode.
 */
export function AuthDialog() {
  const { authDialog, openAuth, closeAuth, authenticate, backend } = useAuth();
  const open = authDialog !== null;
  const mode = authDialog ?? "signin";

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDone(null);
    setBusy(false);
    setStep("form");
    setEnteredCode("");
    setDemoCode("");
    const timer = window.setTimeout(() => emailRef.current?.focus(), 260);
    return () => window.clearTimeout(timer);
  }, [open, mode]);

  useEffect(() => {
    if (step === "code") {
      const timer = window.setTimeout(() => codeRef.current?.focus(), 220);
      return () => window.clearTimeout(timer);
    }
  }, [step]);

  const makeCode = () => String(Math.floor(100000 + Math.random() * 900000));

  const beginVerification = (event: React.FormEvent) => {
    event.preventDefault();
    if (!authenticate) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (mode === "signup" && name.trim().length < 2) {
      setError("Tell us what to call you.");
      return;
    }
    setError(null);
    setDemoCode(makeCode());
    setEnteredCode("");
    setStep("code");
  };

  const confirmCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!authenticate) return;
    if (enteredCode.trim() !== demoCode) {
      setError("That code doesn’t match. Check the six digits and try again.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await authenticate(mode, { name, email, password });
    setBusy(false);
    if (!result.ok) {
      setError(typeof result.message === "string" ? result.message : "Something went wrong. Try again.");
      return;
    }
    setDone(result.message);
    setPassword("");
    setEnteredCode("");
    window.setTimeout(closeAuth, 460);
  };

  const redirect = typeof window === "undefined" ? "/" : `${window.location.origin}/#discover`;

  return (
    <PaperDialog
      open={open}
      onClose={closeAuth}
      className="auth-dialog"
      labelledBy="auth-title"
      closeLabel="Close sign in"
      showClose={false}
    >
      <div className="auth-scene">
        <TacoCollage className="auth-scene__collage" />

        <section className="auth-scene__intro">
          <p className="auth-scene__kicker">
            <span className="auth-scene__pin" aria-hidden="true" />
            munch. members
          </p>
          <h2 className="auth-scene__title" id="auth-title">
            Pull up
            <br />
            a chair.
          </h2>
          <p className="auth-scene__lede">
            Save the places you crave, keep your tables in one place, and let your neighbourhood
            decide what’s for dinner.
          </p>
          <ul className="auth-scene__list">
            <li>
              <Check aria-hidden="true" /> Cravings synced to your account
            </li>
            <li>
              <Check aria-hidden="true" /> Bookings, waitlists and alerts
            </li>
            <li>
              <Check aria-hidden="true" /> Your area remembered, on every device
            </li>
          </ul>
        </section>

        <div className="auth-card" role="region" aria-label={mode === "signin" ? "Sign in" : "Create account"}>
          <button type="button" className="auth-card__close" onClick={closeAuth} aria-label="Close">
            <X aria-hidden="true" />
          </button>

          {step === "form" ? (
            <>
              <div className="auth-tabs" role="tablist" aria-label="Account">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signin"}
                  aria-controls="auth-panel"
                  className="auth-tab"
                  onClick={() => openAuth("signin")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signup"}
                  aria-controls="auth-panel"
                  className="auth-tab"
                  onClick={() => openAuth("signup")}
                >
                  Create account
                </button>
              </div>

              <div className="auth-card__body" id="auth-panel" role="tabpanel">
                <div className="auth-card__head">
                  <h3 className="auth-card__title">
                    {mode === "signin" ? "Welcome back" : "Make it yours"}
                  </h3>
                  <p className="auth-card__sub">
                    {mode === "signin"
                      ? "Your cravings are right where you left them."
                      : "One account, every table you save."}
                  </p>
                </div>

                {done ? (
                  <p className="auth-done" role="status">
                    <Check aria-hidden="true" /> {done}
                  </p>
                ) : HAS_CLERK ? (
                  <div className="auth-card__clerk">
                    {mode === "signin" ? (
                      <SignIn
                        routing="hash"
                        fallbackRedirectUrl={redirect}
                        signUpFallbackRedirectUrl={redirect}
                        appearance={CLERK_APPEARANCE}
                      />
                    ) : (
                      <SignUp
                        routing="hash"
                        fallbackRedirectUrl={redirect}
                        signInFallbackRedirectUrl={redirect}
                        appearance={CLERK_APPEARANCE}
                      />
                    )}
                    <p className="auth-clerk-hint">
                      Clerk emails a six-digit code. Passwords need 15+ characters.
                    </p>
                  </div>
                ) : (
                  <form className="auth-form" onSubmit={beginVerification} noValidate>
                    {mode === "signup" && (
                      <label className="auth-field">
                        <span>Your name</span>
                        <input
                          type="text"
                          name="name"
                          autoComplete="name"
                          placeholder="Sam Lee"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          required
                        />
                      </label>
                    )}
                    <label className="auth-field">
                      <span>Email</span>
                      <input
                        ref={emailRef}
                        type="email"
                        name="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </label>
                    <label className="auth-field">
                      <span>Password</span>
                      <span className="auth-field__wrap">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          autoComplete={mode === "signin" ? "current-password" : "new-password"}
                          placeholder="At least 8 characters"
                          minLength={8}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="auth-field__eye"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                        </button>
                      </span>
                    </label>

                    {error && (
                      <p className="auth-error" role="alert">
                        {error}
                      </p>
                    )}

                    <button type="submit" className="btn btn--primary btn--block auth-submit">
                      {mode === "signin" ? "Continue" : "Create my account"}
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </form>
                )}

                <div className="auth-card__foot">
                  <p className="auth-mode-note">
                    <LockKeyhole aria-hidden="true" />
                    {backend === "clerk"
                      ? "Secured by Clerk. We never see your password."
                      : "Demo identity — no Clerk key configured, so accounts stay on this device."}
                  </p>
                  <button type="button" className="auth-guest" onClick={closeAuth}>
                    Browse as a guest
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="auth-card__body">
              <div className="auth-card__head">
                <h3 className="auth-card__title">Check your inbox</h3>
                <p className="auth-card__sub">
                  We sent a six-digit code to <strong>{email.trim()}</strong>.
                </p>
              </div>

              <form className="auth-form" onSubmit={confirmCode}>
                <label className="auth-field">
                  <span>Verification code</span>
                  <input
                    ref={codeRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={enteredCode}
                    onChange={(event) => setEnteredCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="auth-code-input"
                    required
                  />
                </label>

                <p className="auth-demo-slip">
                  <span>Demo mode</span> No mail provider is configured, so your code is <strong>{demoCode}</strong>.
                </p>

                {error && (
                  <p className="auth-error" role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" className="btn btn--primary btn--block" disabled={busy || enteredCode.length !== 6}>
                  {busy ? (
                    <>
                      <Loader2 className="spin" aria-hidden="true" /> Verifying…
                    </>
                  ) : (
                    "Verify and continue"
                  )}
                </button>

                <div className="auth-code-actions">
                  <button
                    type="button"
                    className="auth-guest"
                    onClick={() => {
                      setDemoCode(makeCode());
                      setEnteredCode("");
                      setError(null);
                    }}
                  >
                    Send a new code
                  </button>
                  <button type="button" className="auth-guest" onClick={() => setStep("form")}>
                    <ArrowLeft aria-hidden="true" /> Use a different email
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <p className="auth-scene__stamp" aria-hidden="true">
          cut · fold · eat
        </p>
      </div>
    </PaperDialog>
  );
}

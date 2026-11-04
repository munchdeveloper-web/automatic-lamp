import { useState } from "react";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Leaf,
  Loader2,
  LogOut,
  MapPin,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useApp } from "@/store";
import { useAuth } from "@/auth/auth-context";
import { HAS_API } from "@/lib/authConfig";
import { clearLocationHistory } from "@/lib/munchApi";
import { PaperDialog } from "@/components/PaperDialog";
import { ShareDialog } from "@/components/ShareDialog";

const TASTE = [
  { label: "Umami", value: 88, className: "" },
  { label: "Spice", value: 74, className: "meter__fill--tomato" },
  { label: "Sweet", value: 52, className: "" },
  { label: "Pickled", value: 36, className: "meter__fill--sage" },
];

const BADGES = [
  { icon: "★", label: "Super-biter", sub: "50 boosts", tone: "" },
  { icon: "☾", label: "Night owl", sub: "10 late tables", tone: "badge-tile__icon--sage" },
  { icon: "✳", label: "Pasta pro", sub: "8 Italian spots", tone: "badge-tile__icon--blush" },
];

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function Profile() {
  const {
    saved,
    bookings,
    recentVotes,
    alertsEnabled,
    setAlertsEnabled,
    notify,
    setScreen,
    area,
  } = useApp();
  const { user, backend, openAuth, signOut, deleteAccount, getToken } = useAuth();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [clearArm, setClearArm] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const rows = [
    {
      icon: <Leaf />,
      label: "Dietary preferences",
      value: "2 set",
      action: () => notify("Dietary preferences are a prototype in this build"),
    },
    {
      icon: <MapPin />,
      label: "Saved addresses",
      value: "",
      action: () => notify("Saved addresses are a prototype in this build"),
    },
    {
      icon: <CreditCard />,
      label: "Payment methods",
      value: "Visa ·· 4412",
      action: () => notify("Payments are a prototype in this build"),
    },
    {
      icon: <UserPlus />,
      label: "Invite friends",
      value: "",
      action: () => setShareOpen(true),
    },
  ];

  const confirmDelete = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteAccount();
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.message);
      return;
    }
    setDeleteOpen(false);
    setConfirmText("");
    notify(result.message);
  };

  return (
    <div className="profile-page">
      <div className="profile-head">
        {user?.avatarUrl ? (
          <img className="avatar avatar--img" src={user.avatarUrl} alt="" width={64} height={64} />
        ) : (
          <div className="avatar" aria-hidden="true">
            {user ? initialsOf(user.name) || "M" : "G"}
          </div>
        )}
        <div className="profile-head__body">
          <h1 className="profile-head__name">{user?.name ?? "Guest diner"}</h1>
          <p className="profile-head__handle">
            {user?.email ?? "Not signed in"} · {area.label}
          </p>
        </div>
        {user ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => notify("Profile editing is a prototype in this build")}
          >
            Edit
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => openAuth("signup")}>
            Create account
          </button>
        )}
      </div>

      {!user && (
        <section className="account-callout" aria-labelledby="guest-title">
          <div>
            <h2 id="guest-title">Browsing as a guest</h2>
            <p>Cravings and bookings stay on this device. Sign in to keep them on every table.</p>
          </div>
          <div className="account-callout__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={() => openAuth("signin")}>
              Sign in
            </button>
            <button type="button" className="btn btn--cream btn--sm" onClick={() => openAuth("signup")}>
              Sign up
            </button>
          </div>
        </section>
      )}

      <div className="card stats-card">
        <div className="stat">
          <span className="stat__value">42</span>
          <span className="stat__label">Spots</span>
        </div>
        <div className="stat">
          <span className="stat__value">{saved.length}</span>
          <span className="stat__label">Cravings</span>
        </div>
        <div className="stat">
          <span className="stat__value">{bookings.length}</span>
          <span className="stat__label">Tables</span>
        </div>
        <div className="stat">
          <span className="stat__value">{12 + recentVotes.yes}</span>
          <span className="stat__label">Votes</span>
        </div>
      </div>

      <div className="profile-columns">
        <section className="card taste-card" aria-labelledby="taste-title">
          <div className="section-head" style={{ margin: "0 0 4px" }}>
            <h2 id="taste-title">Your taste</h2>
            <span className="section-head__meta">From 42 votes</span>
          </div>
          {TASTE.map((taste) => (
            <div className="meter" key={taste.label}>
              <div className="meter__row">
                <span>{taste.label}</span>
                <span>{taste.value}%</span>
              </div>
              <div className="meter__track">
                <span className={`meter__fill ${taste.className}`} style={{ width: `${taste.value}%` }} />
              </div>
            </div>
          ))}
        </section>

        <section aria-labelledby="badges-title">
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2 id="badges-title">Badges</h2>
            <span className="section-head__meta">3 of 9</span>
          </div>
          <div className="badge-grid">
            {BADGES.map((badge) => (
              <div className="badge-tile" key={badge.label}>
                <span className={`badge-tile__icon ${badge.tone}`} aria-hidden="true">
                  {badge.icon}
                </span>
                <p className="badge-tile__label">{badge.label}</p>
                <p className="badge-tile__sub">{badge.sub}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="section-head">
        <h2>Bookings & alerts</h2>
        <button type="button" className="section-head__link" onClick={() => setScreen("bookings")}>
          {bookings.length} active
        </button>
      </div>

      <div className="card settings-card">
        <div className="set-row">
          <span className="set-row__icon">
            <Bell />
          </span>
          <span className="set-row__label" id="notif-label">
            Table alerts
          </span>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={alertsEnabled}
            aria-labelledby="notif-label"
            onClick={() => {
              setAlertsEnabled(!alertsEnabled);
              notify(alertsEnabled ? "Table alerts turned off" : "Table alerts turned on");
            }}
          />
        </div>

        {rows.map((row) => (
          <button type="button" className="set-row" key={row.label} onClick={row.action}>
            <span className="set-row__icon">{row.icon}</span>
            <span className="set-row__label">{row.label}</span>
            {row.value && <span className="set-row__value">{row.value}</span>}
            <ChevronRight className="chev" />
          </button>
        ))}
      </div>

      <div className="section-head">
        <h2>Account</h2>
        <span className={`pill ${backend === "clerk" ? "pill--sage" : "pill--mustard"}`}>
          {backend === "clerk" ? "Clerk" : "Demo identity"}
        </span>
      </div>

      <div className="card account-card">
        <div className="account-card__identity">
          <span className="set-row__icon">
            <ShieldCheck />
          </span>
          <div>
            <p className="account-card__name">{user?.name ?? "Guest diner"}</p>
            <p className="account-card__email">
              {user?.email ?? "No email on this device"}
            </p>
          </div>
        </div>

        <p className="account-card__note">
          {backend === "clerk"
            ? "Your identity is verified by Clerk. munch. stores an internal profile key, never your Clerk id."
            : "No Clerk publishable key is configured, so identities live only in this browser. Add VITE_CLERK_PUBLISHABLE_KEY to switch to real accounts."}
        </p>

        <div className="account-card__actions">
          {user ? (
            <button
              type="button"
              className="btn btn--cream btn--sm"
              onClick={async () => {
                await signOut();
                notify("Signed out — see you at dinner");
              }}
            >
              <LogOut aria-hidden="true" /> Sign out
            </button>
          ) : (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => openAuth("signup")}>
              Create an account
            </button>
          )}

          {user && HAS_API && (
            <button
              type="button"
              className="btn btn--cream btn--sm"
              disabled={clearing}
              onClick={async () => {
                if (!clearArm) {
                  setClearArm(true);
                  return;
                }
                setClearing(true);
                try {
                  const token = await getToken();
                  if (!token) throw new Error("no token");
                  const result = await clearLocationHistory(token);
                  notify(`Location history cleared (${result.removed} saved fix${result.removed === 1 ? "" : "es"})`);
                } catch {
                  notify("Could not clear location history. Try again.");
                } finally {
                  setClearing(false);
                  setClearArm(false);
                }
              }}
            >
              {clearing ? "Clearing…" : clearArm ? "Tap again to clear history" : "Clear location history"}
            </button>
          )}

          {user && (
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => {
                setDeleteError(null);
                setConfirmText("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 aria-hidden="true" /> Delete account
            </button>
          )}
        </div>

        {user && (
          <p className="account-card__meta">
            {HAS_API
              ? "Deletion removes your Munch profile, saved places, bookings, waitlists and location history."
              : "Deletion removes this account and every saved key on this device."}
          </p>
        )}
      </div>

      <p className="profile-foot">munch. v3.2 · find your flavor · maps by OpenStreetMap</p>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />

      <PaperDialog
        open={deleteOpen}
        onClose={() => (deleting ? null : setDeleteOpen(false))}
        className="dialog--sheet delete-dialog"
        labelledBy="delete-title"
      >
        <div className="delete-dialog__body">
          <span className="delete-dialog__icon" aria-hidden="true">
            <Trash2 />
          </span>
          <h2 id="delete-title">Delete your account?</h2>
          <p>
            This removes <strong>{user?.email}</strong>, your cravings, bookings, waitlists and
            saved area. It cannot be undone.
          </p>
          <label className="auth-field">
            <span>
              Type <strong>DELETE</strong> to confirm
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="DELETE"
            />
          </label>
          {deleteError && (
            <p className="auth-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="delete-dialog__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Keep my account
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={confirmText !== "DELETE" || deleting}
              onClick={confirmDelete}
            >
              {deleting ? (
                <>
                  <Loader2 className="spin" aria-hidden="true" /> Deleting…
                </>
              ) : (
                "Delete permanently"
              )}
            </button>
          </div>
        </div>
      </PaperDialog>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Bookmark,
  CalendarDays,
  ChevronDown,
  Compass,
  LogIn,
  MapPin,
  User,
  X,
} from "lucide-react";
import { AppProvider, useApp } from "@/store";
import { useAuth } from "@/auth/auth-context";
import { AuthDialog } from "@/components/AuthDialog";
import { SplashScreen } from "@/components/SplashScreen";
import { PageSkeleton } from "@/components/Skeletons";
import { Discover } from "@/components/Discover";
import { Cravings } from "@/components/Cravings";
import { Bookings } from "@/components/Bookings";
import { Profile } from "@/components/Profile";
import { Inbox } from "@/components/Inbox";
import { MapPanel } from "@/components/MapPanel";
import { AreaSheet } from "@/components/AreaSheet";
import { PlaceDialog } from "@/components/PlaceDialog";
import { Onboarding } from "@/components/Onboarding";
import logoMark from "@/assets/logo-mark.webp";
import { cn } from "@/lib/utils";
import type { Place } from "@/lib/types";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener("change", onChange);
    onChange();
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

const NAV = [
  { id: "discover" as const, label: "Discover", icon: Compass },
  { id: "cravings" as const, label: "Cravings", icon: Bookmark },
  { id: "bookings" as const, label: "Bookings", icon: CalendarDays },
  { id: "profile" as const, label: "Profile", icon: User },
  { id: "inbox" as const, label: "Inbox", icon: Bell },
];

function Toast() {
  const { toast, dismissToast } = useApp();
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast__text">{toast.message}</span>
      {toast.onUndo && (
        <button
          type="button"
          className="toast__undo"
          onClick={() => {
            toast.onUndo?.();
            dismissToast();
          }}
        >
          {toast.undoLabel}
        </button>
      )}
      <button type="button" className="toast__close" onClick={dismissToast} aria-label="Dismiss notification">
        <X />
      </button>
    </div>
  );
}

/** Avatar / sign-in chip. It is the only header control that changes with auth. */
function AccountButton() {
  const { user, openAuth } = useAuth();
  const { setScreen } = useApp();

  if (!user) {
    return (
      <button
        type="button"
        className="account-chip account-chip--guest account-chip--avatar"
        onClick={() => openAuth("signin")}
        aria-label="Sign in"
        title="Sign in"
      >
        <LogIn aria-hidden="true" />
      </button>
    );
  }

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <button
      type="button"
      className="account-chip account-chip--avatar"
      onClick={() => setScreen("profile")}
      aria-label={`Account: ${user.name}. Open profile`}
      title={`${user.name} · ${user.email}`}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" width={30} height={30} />
      ) : (
        <span className="account-chip__initials" aria-hidden="true">
          {initials || "M"}
        </span>
      )}
    </button>
  );
}

/** The only place that knows about desktop-vs-mobile layout. */
function Shell() {
  const {
    screen,
    setScreen,
    unread,
    bookings,
    area,
    mode,
    liveLabel,
    flyToPlace,
    searchNotice,
    hydrating,
  } = useApp();
  const { user } = useAuth();

  const isMobile = useMediaQuery("(max-width: 900px)");
  const shellRef = useRef<HTMLElement>(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [mobileMap, setMobileMap] = useState(false);
  const [discoverView, setDiscoverView] = useState<"stack" | "map">("stack");

  const hasMap = screen === "discover" || screen === "cravings";
  const showMobileMap = isMobile && hasMap && mobileMap && screen === "discover";

  useEffect(() => {
    if (!hasMap || screen !== "discover") setMobileMap(false);
  }, [screen, hasMap]);

  /* Tabs get a short, directional entrance without remounting the panel
     (remounting would reset the swipe deck and the map camera). */
  useEffect(() => {
    const target = shellRef.current?.querySelector<HTMLElement>(".page, .panel");
    if (!target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    target.animate(
      [
        { opacity: 0, transform: "translateY(10px) scale(0.995)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
  }, [screen]);

  const showOnMap = (place: Place | null) => {
    setScreen("discover");
    setDiscoverView("map");
    if (isMobile) setMobileMap(true);
    if (place) flyToPlace(place, 16.4);
  };

  const changeView = (view: "stack" | "map") => {
    setDiscoverView(view);
    if (isMobile) setMobileMap(view === "map");
  };

  const renderPanel = () => {
    if (screen === "discover") {
      if (isMobile && mobileMap) return null;
      return (
        <div className="panel">
          <Discover view={discoverView} onViewChange={changeView} onOpenAreas={() => setAreaOpen(true)} />
        </div>
      );
    }
    if (screen === "cravings") {
      return (
        <div className="panel">
          <div className="panel__scroll">
            {hydrating ? <PageSkeleton rows={4} /> : <Cravings onShowOnMap={(place) => showOnMap(place)} />}
          </div>
        </div>
      );
    }
    return (
      <div className={cn("page", screen === "bookings" && "")}>
        <div className="page__scroll">
          {hydrating ? (
            <PageSkeleton rows={screen === "inbox" ? 5 : 3} />
          ) : (
            <>
              {screen === "bookings" && <Bookings onShowOnMap={(place) => showOnMap(place)} />}
              {screen === "profile" && <Profile />}
              {screen === "inbox" && <Inbox />}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="topbar">
        <a
          className="brand"
          href="#discover"
          onClick={(event) => {
            event.preventDefault();
            setScreen("discover");
          }}
          aria-label="munch — go to Discover"
        >
          <img className="brand__mark" src={logoMark} alt="" width={40} height={40} />
          <span className="brand__logo">munch.</span>
          <span className="brand__tag">find your flavor</span>
        </a>

        <nav className="nav" aria-label="Primary">
          {NAV.filter((item) => item.id !== "inbox").map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className="nav__tab"
                aria-current={screen === item.id ? "page" : undefined}
                onClick={() => setScreen(item.id)}
              >
                <Icon aria-hidden="true" />
                {item.label}
                {item.id === "bookings" && bookings.length > 0 && (
                  <span className="nav__badge" aria-label={`${bookings.length} upcoming`}>
                    {bookings.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="topbar__actions">
          <button
            type="button"
            className="area-btn"
            onClick={() => setAreaOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Change area — currently ${mode !== "bundled" ? liveLabel.name || "near you" : `${area.label}, ${area.city}`}`}
          >
            <span className="area-btn__pin" aria-hidden="true">
              <MapPin />
            </span>
            <span className="area-btn__text">
              <span className="area-btn__eyebrow">Near</span>
              <span className="area-btn__city">
                {mode !== "bundled" ? liveLabel.name || "Near you" : area.label}
              </span>
            </span>
            <ChevronDown className="area-btn__chev" aria-hidden="true" />
          </button>

          <div className="topbar__cluster">
            <button
              type="button"
              className="iconbtn topbar__icon"
              onClick={() => setScreen("inbox")}
              aria-label={`Inbox, ${unread} unread`}
            >
              <Bell />
              {unread > 0 && (
                <span className="iconbtn__badge" aria-hidden="true">
                  {unread}
                </span>
              )}
            </button>

            <AccountButton />
          </div>
        </div>
      </header>

      <main ref={shellRef} className={cn("shell", hasMap ? "shell--map" : "shell--solo")}>
        {hydrating && !hasMap ? (
          <div className="page">
            <div className="page__scroll">
              <PageSkeleton rows={4} />
            </div>
          </div>
        ) : (
          renderPanel()
        )}

        {hasMap && !isMobile && <MapPanel onlySaved={screen === "cravings"} onExitMap={() => changeView("stack")} />}
        {hasMap && isMobile && showMobileMap && (
          <div className="panel panel--map">
            <MapPanel onExitMap={() => changeView("stack")} />
          </div>
        )}
      </main>

      <nav className="mobile-nav" aria-label="Primary">
        <div className="mobile-nav__inner">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className="mobile-tab"
                aria-current={screen === item.id ? "page" : undefined}
                onClick={() => {
                  setScreen(item.id);
                  if (item.id !== "discover") setMobileMap(false);
                }}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
                {item.id === "inbox" && unread > 0 && (
                  <span className="mobile-tab__badge" aria-hidden="true">
                    {unread}
                  </span>
                )}
                {item.id === "profile" && !user && (
                  <span className="mobile-tab__badge mobile-tab__badge--dot" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <AreaSheet open={areaOpen} onClose={() => setAreaOpen(false)} />
      <PlaceDialog onShowOnMap={(place) => showOnMap(place)} />
      <Toast />

      <p className="sr-only" role="status" aria-live="polite">
        {searchNotice}
      </p>
    </div>
  );
}

/** Auth dialog lives outside the data provider: it must survive a scope change. */
function AuthLayer({ enabled }: { enabled: boolean }) {
  const { user, openAuth, backend } = useAuth();

  useEffect(() => {
    if (!enabled || user) return;
    let prompted = false;
    try {
      prompted = sessionStorage.getItem("munch:auth:prompted") === "1";
    } catch {
      prompted = false;
    }
    if (prompted) return;
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem("munch:auth:prompted", "1");
      } catch {
        /* storage blocked */
      }
      openAuth("signin");
    }, 520);
    return () => window.clearTimeout(timer);
  }, [enabled, user, openAuth, backend]);

  return <AuthDialog />;
}

function Boot() {
  const { booted } = useAuth();
  const [splashGone, setSplashGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!booted) return;
    const elapsed = Date.now() - mountedAt.current;
    const wait = Math.max(0, 1050 - elapsed);
    const startExit = window.setTimeout(() => setLeaving(true), wait);
    const remove = window.setTimeout(() => setSplashGone(true), wait + 620);
    return () => {
      window.clearTimeout(startExit);
      window.clearTimeout(remove);
    };
  }, [booted]);

  return (
    <>
      {!splashGone && (
        <SplashScreen leaving={leaving} status={booted ? "Setting the table" : "Warming the kitchen"} />
      )}
      <div className={splashGone ? "boot-ready" : "boot-hidden"} aria-hidden={!splashGone}>
        <AppShellGate ready={splashGone} />
      </div>
      <AuthLayer enabled={splashGone} />
    </>
  );
}

/** Keeps the data provider mounted under the splash, so first paint is already warm. */
function AppShellGate({ ready }: { ready: boolean }) {
  const { user } = useAuth();
  return (
    <AppProvider key={user?.id ?? "guest"}>
      <Shell />
      <Onboarding enabled={ready} />
    </AppProvider>
  );
}

export default function App() {
  return <Boot />;
}

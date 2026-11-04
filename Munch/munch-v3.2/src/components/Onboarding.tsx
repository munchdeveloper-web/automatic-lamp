import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useAuth } from "@/auth/auth-context";
import { useApp } from "@/store";
import { AREAS, CUISINE_GROUPS, isLiveArea } from "@/lib/places";
import { PaperDialog } from "@/components/PaperDialog";
import { TacoCollage } from "@/components/TacoCollage";

const STYLE_OPTIONS = [
  {
    id: "everyday",
    label: "Everyday & chains",
    sub: "Franchises, casual counters, late-night fixes",
    chains: true,
  },
  {
    id: "mixed",
    label: "A bit of everything",
    sub: "Neighbourhood joints and the odd treat",
    chains: true,
  },
  {
    id: "occasion",
    label: "Special occasions",
    sub: "Independent kitchens worth the detour",
    chains: false,
  },
];

export function Onboarding({ enabled = true }: { enabled?: boolean }) {
  const { user } = useAuth();
  const { areaId, chooseArea, setFilters, notify } = useApp();

  const storageKey = user ? `munch:${user.id}:onboarded:v1` : "";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [city, setCity] = useState(areaId);
  const [tastes, setTastes] = useState<string[]>([]);
  const [style, setStyle] = useState("mixed");

  useEffect(() => {
    if (!user || !enabled) return;
    let done = false;
    try {
      done = localStorage.getItem(storageKey) === "1";
    } catch {
      done = false;
    }
    if (done) return;
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [user, storageKey, enabled]);

  const world = useMemo(() => AREAS.filter(isLiveArea), []);

  if (!user) return null;

  const finish = (skip = false) => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* storage blocked */
    }
    setOpen(false);
    if (skip) return;
    chooseArea(city);
    const picks = tastes.filter((taste) => taste !== "All");
    setFilters({
      openNow: false,
      cuisine: picks[0] ?? "All",
      maxMiles: null,
      includeChains: STYLE_OPTIONS.find((option) => option.id === style)?.chains ?? true,
    });
    try {
      localStorage.setItem(
        `munch:${user.id}:taste:v1`,
        JSON.stringify({ cuisines: picks, style, areaId: city, updatedAt: Date.now() }),
      );
    } catch {
      /* storage blocked */
    }
    const label = AREAS.find((area) => area.id === city)?.label ?? "your area";
    notify(`You're set for ${label}. We'll lead with ${picks[0] ?? "every kitchen"}.`);
  };

  const toggleTaste = (taste: string) => {
    setTastes((current) =>
      current.includes(taste) ? current.filter((item) => item !== taste) : [...current, taste],
    );
  };

  return (
    <PaperDialog
      open={open}
      onClose={() => finish(true)}
      className="auth-dialog onboarding-dialog"
      labelledBy="onboarding-title"
      closeLabel="Skip onboarding"
    >
      <div className="auth-scene onboarding-scene">
        <TacoCollage className="auth-scene__collage" />

        <section className="auth-scene__intro">
          <p className="auth-scene__kicker">
            <span className="auth-scene__pin" aria-hidden="true" />
            Step {step} of 2 · {user.name.split(" ")[0]}
          </p>
          <h2 className="auth-scene__title" id="onboarding-title">
            {step === 1 ? (
              <>
                Where’s
                <br />
                dinner?
              </>
            ) : (
              <>
                What do
                <br />
                you crave?
              </>
            )}
          </h2>
          <p className="auth-scene__lede">
            {step === 1
              ? "Pick a starting city. You can always change it from the area button."
              : "Choose a few kitchens and how you like to eat out. We’ll shape the first deck around it."}
          </p>
          <div className="onboarding-steps" aria-hidden="true">
            <span className={step >= 1 ? "is-done" : ""} />
            <span className={step >= 2 ? "is-done" : ""} />
          </div>
        </section>

        <div className="auth-card onboarding-card">
          {step === 1 ? (
            <div className="auth-card__body">
              <div className="auth-card__head">
                <h3 className="auth-card__title">Choose a neighbourhood</h3>
                <p className="auth-card__sub">World cities run on live OpenStreetMap data.</p>
              </div>

              <div className="world-grid world-grid--onboarding">
                {world.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    className="world-chip"
                    aria-pressed={city === area.id}
                    onClick={() => setCity(area.id)}
                  >
                    <span className="world-chip__name">{area.label}</span>
                    <span className="world-chip__meta">{area.city}</span>
                  </button>
                ))}
              </div>

              <div className="onboarding-actions">
                <button type="button" className="auth-guest" onClick={() => finish(true)}>
                  Skip for now
                </button>
                <button type="button" className="btn btn--primary" onClick={() => setStep(2)}>
                  Next <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-card__body">
              <div className="auth-card__head">
                <h3 className="auth-card__title">Set your taste</h3>
                <p className="auth-card__sub">Pick as many as you like.</p>
              </div>

              <p className="onboarding-label">Kitchens</p>
              <div className="onboarding-tastes">
                {CUISINE_GROUPS.filter((group) => group !== "All").map((group) => (
                  <button
                    key={group}
                    type="button"
                    className="chip"
                    aria-pressed={tastes.includes(group)}
                    onClick={() => toggleTaste(group)}
                  >
                    {tastes.includes(group) && <Check size={12} aria-hidden="true" />}
                    {group}
                  </button>
                ))}
              </div>

              <p className="onboarding-label">How you eat out</p>
              <div className="onboarding-styles">
                {STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="onboarding-style"
                    aria-pressed={style === option.id}
                    onClick={() => setStyle(option.id)}
                  >
                    <span className="onboarding-style__label">{option.label}</span>
                    <span className="onboarding-style__sub">{option.sub}</span>
                  </button>
                ))}
              </div>

              <div className="onboarding-actions">
                <button type="button" className="auth-guest" onClick={() => setStep(1)}>
                  <ArrowLeft aria-hidden="true" /> Back
                </button>
                <button type="button" className="btn btn--primary" onClick={() => finish(false)}>
                  <Sparkles aria-hidden="true" /> Start eating
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="auth-scene__stamp" aria-hidden="true">
          your table, your rules
        </p>
      </div>
    </PaperDialog>
  );
}

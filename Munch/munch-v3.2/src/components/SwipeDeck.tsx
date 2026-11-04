import { useCallback, useEffect, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { Flame, MapPin, Phone, RotateCcw, Sparkles, Star, ThumbsDown, ThumbsUp, Wand2 } from "lucide-react";
import { useApp } from "@/store";
import type { Place } from "@/lib/types";
import { openState } from "@/lib/hours";
import { formatPhone } from "@/lib/geo";
import { PlacePhoto } from "@/components/PlacePhoto";

type Props = {
  place: Place;
  onDecide: (vote: "yes" | "no", place: Place) => void;
  onUndo: () => void;
  canUndo: boolean;
  boons: number;
  onBoost: (place: Place) => void;
};

export function SwipeDeck({ place, onDecide, onUndo, canUndo, boons, onBoost }: Props) {
  const { isSaved, savePlace, unsavePlace, distanceText, openDetail } = useApp();
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-8, 0, 8]);
  // Show the verdict early: the stamp is feedback, not a reward for dragging far.
  const yesOpacity = useTransform(x, [12, 78], [0, 1]);
  const noOpacity = useTransform(x, [-78, -12], [1, 0]);
  const [leaving, setLeaving] = useState(false);
  const saved = isSaved(place.id);
  const status = openState(place);
  const rating = place.rating ? place.rating.toFixed(1) : null;
  const reviews = place.reviews ? place.reviews.toLocaleString("en-US") : null;
  const phone = formatPhone(place.phone) || "";
  const chips = (place.categories.length ? place.categories : [place.cuisine]).slice(0, 3);

  useEffect(() => {
    x.set(0);
  }, [place.id, x]);

  const decide = useCallback(
    async (vote: "yes" | "no") => {
      if (leaving) return;
      setLeaving(true);
      const distance = vote === "yes" ? 720 : -720;
      if (!reduced) {
        await animate(x, distance, {
          duration: 0.26,
          ease: [0.23, 1, 0.32, 1],
        }).finished;
      }
      onDecide(vote, place);
      x.set(0);
      setLeaving(false);
    },
    [leaving, reduced, x, onDecide, place],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void decide("no");
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        void decide("yes");
      }
      if (event.key.toLowerCase() === "z") onUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, onUndo]);

  return (
    <>
      <div className="deck-wrap">
        <span className="deck-sheet" aria-hidden="true" />
        <span className="deck-sheet deck-sheet--blush" aria-hidden="true" />
        <span className="deck-sheet deck-sheet--sage" aria-hidden="true" />
        <motion.article
          className="deck-card"
          style={{ x, rotate }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.72}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            const fast = Math.abs(info.velocity.x) > 620;
            if (info.offset.x > 120 || (fast && info.velocity.x > 0)) void decide("yes");
            else if (info.offset.x < -120 || (fast && info.velocity.x < 0)) void decide("no");
          }}
          onTap={() => openDetail(place)}
          aria-label={`${place.name}, ${place.cuisine}${rating ? `, ${rating} stars` : ""}. Swipe right to save, left to pass.`}
          role="group"
        >
          <div className="deck-card__media">
            <PlacePhoto place={place} className="deck-card__image" loading="eager" />
            <div className="deck-card__scrim" aria-hidden="true" />
            <div className="deck-card__top">
              <span className="pill pill--plain">
                <MapPin /> {distanceText(place)}
              </span>
              <span className="pill pill--plain">{place.cuisine}</span>
              {rating && (
                <span className="pill pill--plain deck-card__rating">
                  <Star fill="currentColor" style={{ color: "var(--mustard-deep)" }} /> {rating}
                  <span style={{ opacity: 0.6, fontWeight: 700 }}>({reviews})</span>
                </span>
              )}
            </div>

            <motion.span className="stamp stamp--yes" style={{ opacity: reduced ? 1 : yesOpacity }} aria-hidden="true">
              Tasty!
            </motion.span>
            <motion.span className="stamp stamp--no" style={{ opacity: reduced ? 1 : noOpacity }} aria-hidden="true">
              Nope
            </motion.span>

            <div className="deck-card__bottom">
              <div style={{ minWidth: 0 }}>
                <span className={`deck-card__status${status.open ? "" : " is-closed"}`}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: status.open ? "#a8d493" : "#f2b19c",
                      display: "inline-block",
                    }}
                  />
                  {status.label}
                </span>
                <h2 className="deck-card__name">{place.name}</h2>
              </div>
              <button
                type="button"
                className="save-btn"
                aria-pressed={saved}
                aria-label={`${saved ? "Remove" : "Save"} ${place.name} ${saved ? "from" : "to"} your cravings`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  if (saved) unsavePlace(place.id);
                  else savePlace(place);
                }}
              >
                <Flame fill={saved ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          <div className="deck-card__body">
            <div className="deck-card__tags">
              {chips.map((chip) => (
                <span className="tag" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
            <div className="deck-card__meta">
              <span>
                <MapPin /> {place.address || place.neighborhood || "San Francisco"}
              </span>
              {phone && (
                <span>
                  <Phone /> {phone}
                </span>
              )}
            </div>
            <button
              type="button"
              className="deck-card__details"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                openDetail(place);
              }}
            >
              Peek at the menu, hours & map
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </motion.article>
      </div>

      <div className="vote-row" aria-label="Vote on this restaurant">
        <button
          type="button"
          className="roundbtn roundbtn--no"
          onClick={() => void decide("no")}
          disabled={leaving}
          aria-label="Pass on this restaurant"
          title="Pass (←)"
        >
          <ThumbsDown />
        </button>
        <button
          type="button"
          className="roundbtn roundbtn--undo"
          onClick={onUndo}
          disabled={!canUndo || leaving}
          aria-label="Undo last vote"
          title="Undo (Z)"
        >
          <RotateCcw />
        </button>
        <button
          type="button"
          className="roundbtn roundbtn--boost"
          onClick={() => onBoost(place)}
          disabled={boons <= 0 || leaving}
          aria-label="Use a super-bite on this restaurant"
          title="Super-bite"
        >
          <Sparkles />
        </button>
        <button
          type="button"
          className="roundbtn roundbtn--yes"
          onClick={() => void decide("yes")}
          disabled={leaving}
          aria-label="Say yes to this restaurant"
          title="Yes (→)"
        >
          <ThumbsUp />
        </button>
      </div>
      <p className="vote-note">
        <Wand2 size={13} aria-hidden="true" /> {boons} super-bite{boons === 1 ? "" : "s"} left
        <span className="vote-key">← pass</span>
        <span className="vote-key">→ save</span>
        <span className="vote-key">z undo</span>
      </p>
    </>
  );
}

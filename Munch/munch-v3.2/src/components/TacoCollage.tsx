import noodles from "@/assets/noodles.webp";

/**
 * Noodle cut-outs, scattered like paper scraps on the teal cutting board.
 * Every piece is a variation of the one splash illustration: the whole bowl
 * (mirrored, tinted, resized) or a cropped scrap of it (egg, naruto, nori,
 * chopsticks). Positions are hand-placed so the composition is stable between
 * renders and stays readable behind the auth card.
 *
 * Kept under the legacy name so Auth and Onboarding need no changes.
 */
type Crop = { x: number; y: number; zoom: number; shape: "circle" | "scrap" | "strip" };

const CROPS: Record<string, Crop> = {
  egg: { x: 29, y: 56, zoom: 3.4, shape: "circle" },
  naruto: { x: 49, y: 62, zoom: 4.2, shape: "circle" },
  nori: { x: 27, y: 33, zoom: 3.2, shape: "scrap" },
  sticks: { x: 75, y: 24, zoom: 2.6, shape: "strip" },
  noodles: { x: 52, y: 47, zoom: 3.6, shape: "scrap" },
};

type Piece = {
  x: number;
  y: number;
  s: number;
  r: number;
  o: number;
  h: number;
  sat: number;
  flip?: boolean;
  crop?: keyof typeof CROPS;
};

const PIECES: Piece[] = [
  { x: 8, y: 16, s: 176, r: -18, o: 0.5, h: -8, sat: 1.05 },
  { x: 27, y: 7, s: 84, r: 14, o: 0.4, h: 0, sat: 1, crop: "egg" },
  { x: 47, y: 11, s: 66, r: -8, o: 0.3, h: 12, sat: 1.1, crop: "naruto" },
  { x: 72, y: 9, s: 142, r: 22, o: 0.42, h: 10, sat: 0.95, flip: true },
  { x: 92, y: 21, s: 80, r: -16, o: 0.36, h: 0, sat: 1, crop: "nori" },
  { x: 4, y: 54, s: 74, r: 10, o: 0.32, h: 0, sat: 1, crop: "sticks" },
  { x: 18, y: 85, s: 150, r: 16, o: 0.44, h: 18, sat: 1, flip: true },
  { x: 42, y: 94, s: 78, r: -12, o: 0.34, h: 0, sat: 1.05, crop: "noodles" },
  { x: 63, y: 88, s: 118, r: 8, o: 0.36, h: -12, sat: 0.92 },
  { x: 86, y: 75, s: 160, r: -24, o: 0.46, h: -6, sat: 1.05, flip: true },
  { x: 97, y: 50, s: 70, r: 22, o: 0.3, h: 0, sat: 1, crop: "egg" },
  { x: 34, y: 43, s: 54, r: -30, o: 0.2, h: 6, sat: 1.15, crop: "naruto" },
];

function shapePath(shape: Crop["shape"]) {
  if (shape === "circle") return "circle(46% at 50% 50%)";
  if (shape === "strip") return "polygon(6% 14%, 94% 4%, 98% 90%, 4% 96%)";
  return "polygon(4% 10%, 52% 2%, 97% 12%, 92% 58%, 98% 94%, 44% 98%, 6% 88%, 1% 46%)";
}

export function TacoCollage({ className = "" }: { className?: string }) {
  return (
    <div className={`taco-collage ${className}`.trim()} aria-hidden="true">
      {PIECES.map((piece, index) => {
        const crop = piece.crop ? CROPS[piece.crop] : null;
        return (
          <span
            className="taco-collage__piece"
            key={index}
            style={{
              left: `${piece.x}%`,
              top: `${piece.y}%`,
              width: piece.s,
              height: piece.s,
              opacity: piece.o,
              transform: `translate(-50%, -50%) rotate(${piece.r}deg)`,
              filter: `hue-rotate(${piece.h}deg) saturate(${piece.sat}) drop-shadow(0 10px 12px rgba(20, 32, 36, 0.35))`,
              animationDelay: `${index * 180}ms`,
            }}
          >
            {crop ? (
              <span className="taco-collage__scrap" style={{ clipPath: shapePath(crop.shape) }}>
                <img
                  src={noodles}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={620}
                  height={620}
                  style={{
                    width: `${crop.zoom * 100}%`,
                    left: `${50 - crop.x * crop.zoom}%`,
                    top: `${50 - crop.y * crop.zoom}%`,
                  }}
                />
              </span>
            ) : (
              <img
                src={noodles}
                alt=""
                loading="lazy"
                decoding="async"
                width={620}
                height={620}
                style={piece.flip ? { transform: "scaleX(-1)" } : undefined}
              />
            )}
          </span>
        );
      })}
      <span className="taco-collage__vignette" />
    </div>
  );
}

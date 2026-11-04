import type { CSSProperties } from "react";

/**
 * Paper skeletons. Shapes match the real components closely enough that the
 * swap does not shift layout, and shimmer only animates a background gradient
 * (transform-free, cheap on low-end phones, disabled by reduced-motion).
 */
export function SkeletonBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <span className={`sk-block ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function SkeletonLine({
  width = "100%",
  height = 12,
  className = "",
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) {
  return (
    <span
      className={`sk-line ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function DeckSkeleton() {
  return (
    <div className="deck-wrap" aria-busy="true">
      <div className="skeleton-card skeleton-card--deck" role="status">
        <span className="sr-only">Finding restaurants near you</span>
        <div className="sk-media">
          <span className="sk-sticker" />
        </div>
        <div className="sk-deck-body">
          <SkeletonLine width="34%" height={9} />
          <SkeletonLine width="68%" height={26} className="sk-line--title" />
          <SkeletonLine width="52%" height={11} />
          <div className="sk-chip-row">
            <SkeletonBlock className="sk-chip" />
            <SkeletonBlock className="sk-chip" />
            <SkeletonBlock className="sk-chip sk-chip--wide" />
          </div>
        </div>
      </div>
      <div className="sk-deck-actions" aria-hidden="true">
        <SkeletonBlock className="sk-round" />
        <SkeletonBlock className="sk-round sk-round--lg" />
        <SkeletonBlock className="sk-round" />
      </div>
    </div>
  );
}

export function ListSkeleton({
  rows = 4,
  media = true,
}: {
  rows?: number;
  media?: boolean;
}) {
  return (
    <div className="sk-list" aria-busy="true" role="status">
      <span className="sr-only">Loading your list</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div className="sk-row" key={index} style={{ animationDelay: `${index * 90}ms` }}>
          {media && <SkeletonBlock className="sk-row__media" />}
          <div className="sk-row__body">
            <SkeletonLine width={`${58 + ((index * 11) % 28)}%`} height={14} />
            <SkeletonLine width={`${34 + ((index * 7) % 26)}%`} height={10} />
            <SkeletonLine width="26%" height={9} />
          </div>
          <SkeletonBlock className="sk-row__pill" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="sk-page" aria-busy="true" role="status">
      <span className="sr-only">Loading</span>
      <div className="sk-page__head">
        <SkeletonLine width={140} height={10} />
        <SkeletonLine width={260} height={34} className="sk-line--title" />
        <SkeletonLine width={200} height={11} />
      </div>
      <div className="sk-stat-row">
        <SkeletonBlock className="sk-stat" />
        <SkeletonBlock className="sk-stat" />
        <SkeletonBlock className="sk-stat" />
      </div>
      <ListSkeleton rows={rows} />
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="sk-map" aria-busy="true" role="status">
      <span className="sr-only">Loading the map</span>
      <div className="sk-map__grid" aria-hidden="true" />
      <span className="sk-map__pin" style={{ left: "28%", top: "34%" }} aria-hidden="true" />
      <span className="sk-map__pin" style={{ left: "63%", top: "26%" }} aria-hidden="true" />
      <span className="sk-map__pin" style={{ left: "48%", top: "62%" }} aria-hidden="true" />
      <div className="sk-map__bar">
        <SkeletonLine width={120} height={10} />
        <SkeletonLine width={70} height={10} />
      </div>
    </div>
  );
}

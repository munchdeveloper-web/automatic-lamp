import noodles from "@/assets/noodles-splash.webp";

type Props = {
  /** True once identity + first paint are ready; plays the exit transition. */
  leaving: boolean;
  status?: string;
};

/**
 * Splash — just the noodles on paper. No plate, no arcs, no steam: the
 * illustration is already the whole idea. A hairline at the bottom edge is the
 * only chrome, and it never pretends to know a percentage.
 */
export function SplashScreen({ leaving, status = "Setting the table" }: Props) {
  return (
    <div className={`splash-min${leaving ? " splash-min--leaving" : ""}`} role="status" aria-live="polite">
      <img className="splash-min__bowl" src={noodles} alt="" width={1024} height={1024} />
      <span className="splash-min__line" aria-hidden="true">
        <span />
      </span>
      <p className="sr-only">{status}</p>
    </div>
  );
}

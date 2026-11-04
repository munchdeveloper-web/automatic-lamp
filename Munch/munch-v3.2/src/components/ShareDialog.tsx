import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Loader2, Mail, MessageCircle, Send, Share2, X } from "lucide-react";
import { useAuth } from "@/auth/auth-context";
import { HAS_API } from "@/lib/authConfig";
import { sendInvite } from "@/lib/munchApi";
import { PaperDialog } from "@/components/PaperDialog";
import type { Place } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  place?: Place | null;
};

/**
 * Share sheet. Native share first, then the networks people actually use.
 * Email invites go through the Munch API → Resend when configured; otherwise
 * the button opens the device's mail app with the same message.
 */
export function ShareDialog({ open, onClose, place }: Props) {
  const { user, getToken, backend } = useAuth();
  const [copied, setCopied] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://munch.app";
    const base = `${window.location.origin}${window.location.pathname}`;
    return place ? `${base}#discover` : base;
  }, [place]);

  const title = place ? `${place.name} on munch.` : "Join me on munch.";
  const text = place
    ? `I saved ${place.name}${place.neighborhood ? ` in ${place.neighborhood}` : ""} on munch. — want to go?`
    : "Find your flavor with me on munch. — restaurants, cravings and tables.";

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setStatus(null);
      setBusy(false);
    }
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatus({ tone: "error", text: "Your browser blocked the clipboard. Select the link and copy it." });
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) {
      void copy();
      return;
    }
    try {
      await navigator.share({ title, text, url: shareUrl });
      setStatus({ tone: "ok", text: "Shared." });
    } catch {
      /* dismissed */
    }
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = to.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setStatus({ tone: "error", text: "Enter a valid email address." });
      return;
    }

    const fallback = () => {
      const subject = encodeURIComponent(title);
      const body = encodeURIComponent(`${text}\n\n${shareUrl}`);
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      setStatus({ tone: "ok", text: "Your mail app is opening with the invite." });
    };

    if (!HAS_API || !user || backend !== "clerk") {
      fallback();
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("no token");
      await sendInvite(token, {
        to: email,
        placeName: place?.name ?? "munch.",
        shareUrl,
        fromName: user.name,
        message: place ? `I thought of you for ${place.name}.` : "",
      });
      setTo("");
      setStatus({ tone: "ok", text: `Invite sent to ${email}.` });
    } catch {
      fallback();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PaperDialog open={open} onClose={onClose} className="dialog--sheet share-dialog" labelledBy="share-title">
      <div className="share-sheet">
        <button type="button" className="auth-card__close" onClick={onClose} aria-label="Close share">
          <X aria-hidden="true" />
        </button>

        <p className="eyebrow">Pass it on</p>
        <h2 id="share-title" className="title title--sm">
          Share {place ? place.name : "munch."}
        </h2>
        <p className="sheet-note">
          Invite a friend to the table — the link opens munch. on their phone.
        </p>

        <div className="share-link">
          <Link2 aria-hidden="true" />
          <input readOnly value={`${text} ${shareUrl}`} aria-label="Share link" onFocus={(event) => event.target.select()} />
          <button type="button" className="btn btn--cream btn--sm" onClick={copy}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="share-grid">
          <button type="button" className="share-tile" onClick={nativeShare}>
            <span className="share-tile__icon">
              <Share2 aria-hidden="true" />
            </span>
            More
          </button>
          <a
            className="share-tile"
            href={`https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="share-tile__icon share-tile__icon--sage">
              <MessageCircle aria-hidden="true" />
            </span>
            WhatsApp
          </a>
          <a
            className="share-tile"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="share-tile__icon share-tile__icon--ink">
              <Send aria-hidden="true" />
            </span>
            X
          </a>
          <button type="button" className="share-tile" onClick={() => document.getElementById("share-email")?.focus()}>
            <span className="share-tile__icon share-tile__icon--blush">
              <Mail aria-hidden="true" />
            </span>
            Email
          </button>
        </div>

        <form className="share-email" onSubmit={invite}>
          <label className="auth-field">
            <span>Send an email invite</span>
            <span className="share-email__row">
              <input
                id="share-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="friend@example.com"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
              />
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? <Loader2 className="spin" aria-hidden="true" /> : "Invite"}
              </button>
            </span>
          </label>
          <p className="share-email__note">
            {HAS_API && backend === "clerk"
              ? "Delivered by Resend from the munch. kitchen."
              : "Opens your mail app — no email provider is configured in this build."}
          </p>
        </form>

        {status && (
          <p className={`share-status${status.tone === "error" ? " is-error" : ""}`} role="status">
            {status.text}
          </p>
        )}
      </div>
    </PaperDialog>
  );
}

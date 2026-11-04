import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
  closeLabel?: string;
  showClose?: boolean;
};

/** Native <dialog> for real focus trapping + inert background, dressed as paper. */
export function PaperDialog({
  open,
  onClose,
  children,
  className,
  labelledBy,
  closeLabel = "Close",
  showClose = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      restore.current = document.activeElement as HTMLElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      restore.current?.focus?.();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={cn("dialog", className)}>
        {showClose && (
          <button type="button" className="dialog__close" onClick={onClose} aria-label={closeLabel}>
            <X />
          </button>
        )}
        {children}
        </div>
      )}
    </dialog>
  );
}

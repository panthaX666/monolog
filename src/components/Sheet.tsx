import { useEffect, type ReactNode } from 'react';

/** Bottom sheet with a dimmed backdrop. Tapping the backdrop or pressing Escape closes it. */
export function Sheet({
  onClose,
  children,
  tall = false,
  dim = true,
  label,
}: {
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
  dim?: boolean;
  label: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className={`backdrop ${dim ? '' : 'backdrop-light'}`} onClick={onClose} />
      <div className={`sheet ${tall ? 'sheet-tall' : ''}`} role="dialog" aria-label={label} aria-modal="true">
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

/** Centered dialog card. */
export function Dialog({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="pop" role="dialog" aria-label={label} aria-modal="true">
        {children}
      </div>
    </>
  );
}

export function Snackbar({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="snack" role="status">
      <span>{text}</span>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}

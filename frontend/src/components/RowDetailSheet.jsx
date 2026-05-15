import { useEffect } from 'react';
import * as I from './Icons';

export function RowDetailSheetField({ label, children }) {
  if (children === null || children === undefined || children === '' || children === false) {
    return null;
  }
  return (
    <div className="row-detail-sheet__field">
      <div className="row-detail-sheet__label">{label}</div>
      <div className="row-detail-sheet__value">{children}</div>
    </div>
  );
}

function RowDetailSheet({ open, onClose, title, subtitle, footer, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  return (
    <div
      className={`row-detail-sheet ${open ? 'is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
    >
      <header className="row-detail-sheet__header">
        <button
          type="button"
          className="btn btn-icon btn-ghost"
          onClick={onClose}
          aria-label="Voltar"
        >
          <I.Close size={16} />
        </button>
        <div className="row-detail-sheet__title">
          {title}
          {subtitle && (
            <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)', marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </header>

      <div className="row-detail-sheet__body">{children}</div>

      {footer && <div className="row-detail-sheet__footer">{footer}</div>}
    </div>
  );
}

export default RowDetailSheet;

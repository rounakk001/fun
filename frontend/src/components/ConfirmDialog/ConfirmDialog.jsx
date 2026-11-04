import { useEffect } from 'react';
import './ConfirmDialog.css';

/**
 * ConfirmDialog — a reusable, in-app confirmation modal.
 *
 * Props:
 *   title       {string}   — dialog heading
 *   message     {string}   — body copy
 *   confirmText {string}   — text for the destructive / primary action button (default: "Confirm")
 *   cancelText  {string}   — text for the cancel button (default: "Cancel")
 *   onConfirm   {function} — called when the user clicks the confirm button
 *   onCancel    {function} — called when the user clicks Cancel or the backdrop
 *   isLoading   {boolean}  — when true, disables buttons and shows loading state
 *   variant     {string}   — 'danger' (default) | 'warning' | 'info'
 */
function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  variant = 'danger',
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  // Prevent background scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="confirm-dialog-backdrop"
      onClick={onCancel}
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Stop clicks inside the card from bubbling to the backdrop */}
      <div
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className={`confirm-dialog__icon confirm-dialog__icon--${variant}`} aria-hidden="true">
          {variant === 'danger' && (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          )}
          {variant === 'warning' && (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
          {variant === 'info' && (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        {/* Text */}
        <h2 id="confirm-dialog-title" className="confirm-dialog__title">{title}</h2>
        {message && <p className="confirm-dialog__message">{message}</p>}

        {/* Actions */}
        <div className="confirm-dialog__actions">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isLoading}
            id="confirm-dialog-cancel"
          >
            {cancelText}
          </button>
          <button
            className={`btn confirm-dialog__confirm-btn confirm-dialog__confirm-btn--${variant}`}
            onClick={onConfirm}
            disabled={isLoading}
            id="confirm-dialog-confirm"
          >
            {isLoading ? (
              <span className="confirm-dialog__spinner" aria-hidden="true" />
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;

import { useState, useRef, useEffect } from 'react';
import { moveVideoToPremium } from '../../api/video.api';
import { useAuth } from '../../context/AuthContext';
import './MoveToPremiumModal.css';

function MoveToPremiumModal({ isOpen, onClose, video, onSuccess }) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !video) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the VIP Vault passcode.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await moveVideoToPremium(video._id, code.trim());
      const updatedVideo = res.data.data;

      if (user?._id) {
        sessionStorage.setItem(`yeonix_premium_unlocked_${user._id}`, 'true');
      }

      onSuccess?.(updatedVideo);
      onClose();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to move video to VIP Vault. Please verify the passcode.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mv-modal-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div
        className="mv-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mv-modal-title"
      >
        <div className="mv-modal-header">
          <div className="mv-modal-title-row">
            <span className="mv-modal-crown">👑</span>
            <h2 id="mv-modal-title" className="mv-modal-title">
              Move to VIP Vault
            </h2>
          </div>
          <button
            type="button"
            className="mv-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mv-modal-body">
          {/* Video Preview Card */}
          <div className="mv-video-preview">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="mv-video-thumb"
            />
            <div className="mv-video-details">
              <p className="mv-video-title">{video.title}</p>
              <span className="mv-video-status">Currently Public</span>
            </div>
          </div>

          <p className="mv-modal-notice">
            Moving this video to the <strong>VIP Vault</strong> will remove it from the public feed. Only authenticated VIP members with the vault passcode can watch it.
          </p>

          {/* Passcode Security Field */}
          <div className="mv-input-group">
            <label htmlFor="mv-passcode-input" className="mv-input-label">
              VIP Vault Passcode <span className="mv-required">*</span>
            </label>
            <div className="mv-input-wrapper">
              <input
                id="mv-passcode-input"
                ref={inputRef}
                type={showCode ? 'text' : 'password'}
                className={`mv-input ${error ? 'mv-input--error' : ''}`}
                placeholder="Enter VIP passcode to confirm"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSubmitting}
                autoComplete="off"
              />
              <button
                type="button"
                className="mv-toggle-pwd"
                onClick={() => setShowCode((p) => !p)}
                tabIndex={-1}
                aria-label={showCode ? 'Hide passcode' : 'Show passcode'}
              >
                {showCode ? '🙈' : '👁️'}
              </button>
            </div>
            <span className="mv-input-hint">
              Strict security check: enter the VIP passcode to verify ownership.
            </span>
          </div>

          {error && (
            <div className="mv-error-banner" role="alert">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="mv-modal-actions">
            <button
              type="button"
              className="mv-btn mv-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="mv-btn mv-btn-primary"
              disabled={isSubmitting || !code.trim()}
            >
              {isSubmitting ? (
                <>
                  <span className="mv-spinner" />
                  Moving to Vault…
                </>
              ) : (
                'Lock in VIP Vault 👑'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MoveToPremiumModal;

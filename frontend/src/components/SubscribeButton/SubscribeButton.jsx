import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toggleSubscription } from '../../api/channel.api';
import './SubscribeButton.css';

/**
 * SubscribeButton — real, working subscribe/unsubscribe toggle.
 *
 * Props:
 *   channelId    {string}  — MongoDB _id of the channel to subscribe to
 *   initialValue {boolean} — initial isSubscribed state from the channel profile fetch
 *   onToggle     {function(isSubscribed: boolean)} — optional callback after successful toggle
 *
 * Behaviour:
 *   - Logged-out user clicks → redirect to /login
 *   - Logged-in user clicks → POST /subscriptions/c/:channelId, update label from response
 *   - Disabled + spinner during in-flight request (prevents double-clicks)
 */
function SubscribeButton({ channelId, initialValue = false, onToggle }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isSubscribed, setIsSubscribed] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);

  // Sync internal state when initialValue prop changes.
  // useState(initialValue) only reads the prop at mount time, so when the
  // parent resolves the real isSubscribed value asynchronously (e.g. after
  // a channel-profile fetch completes), the button would otherwise stay
  // stuck on the stale initial false value without this effect.
  useEffect(() => {
    console.log("DEBUG initialValue prop changed to:", initialValue)
    setIsSubscribed(initialValue);
  }, [initialValue]);

  const handleClick = useCallback(async () => {
    // Unauthenticated → redirect to login
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    try {
      const res = await toggleSubscription(channelId);
      const newState = res.data.data.isSubscribed;
      setIsSubscribed(newState);
      onToggle?.(newState);
    } catch {
      // On error, keep existing state — backend is source of truth
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isLoading, channelId, navigate, onToggle]);

  return (
    <button
      className={`subscribe-btn${isSubscribed ? ' subscribe-btn--subscribed' : ''}`}
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isSubscribed ? 'Unsubscribe from channel' : 'Subscribe to channel'}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <span className="subscribe-btn__spinner" aria-hidden="true" />
      ) : isSubscribed ? (
        'Subscribed'
      ) : (
        'Subscribe'
      )}
    </button>
  );
}

export default SubscribeButton;

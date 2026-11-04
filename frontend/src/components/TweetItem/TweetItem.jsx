import { useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import { toggleTweetLike, deleteTweet, updateTweet } from '../../api/tweet.api';
import './TweetItem.css';

function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return `${interval} years ago`;
  if (interval === 1) return `1 year ago`;
  
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return `${interval} months ago`;
  if (interval === 1) return `1 month ago`;
  
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return `${interval} days ago`;
  if (interval === 1) return `1 day ago`;
  
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return `${interval} hours ago`;
  if (interval === 1) return `1 hour ago`;
  
  interval = Math.floor(seconds / 60);
  if (interval > 1) return `${interval} minutes ago`;
  if (interval === 1) return `1 minute ago`;
  
  return `just now`;
}

function ownerInitials(owner) {
  if (!owner) return '?';
  const name = owner.fullName || owner.username || '?';
  return name.charAt(0).toUpperCase();
}

function TweetItem({ tweet, isOwner, isAuthenticated, onDelete }) {
  const [isLiked, setIsLiked] = useState(tweet.isLiked || false);
  const [likesCount, setLikesCount] = useState(tweet.likesCount || 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(tweet.content);
  const [content, setContent] = useState(tweet.content);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggleLike = async () => {
    if (!isAuthenticated) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount((prev) => prev + (!wasLiked ? 1 : -1));
    try {
      await toggleTweetLike(tweet._id);
    } catch (err) {
      console.error('Failed to toggle like', err);
      setIsLiked(wasLiked);
      setLikesCount((prev) => prev + (wasLiked ? 1 : -1));
    }
  };

  const handleUpdate = async () => {
    if (!editContent.trim() || editContent === content) {
      setIsEditing(false);
      return;
    }
    setIsUpdating(true);
    try {
      await updateTweet(tweet._id, editContent);
      setContent(editContent);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update tweet', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteTweet(tweet._id);
      onDelete(tweet._id);
    } catch (err) {
      console.error('Failed to delete tweet', err);
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          title="Delete post?"
          message="This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          isLoading={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      <div className={`tweet-item ${isDeleting ? 'tweet-item--deleting' : ''}`}>
        <Link to={`/channel/${tweet.owner?.username}`} className="tweet-avatar">
          {tweet.owner?.avatar ? (
            <img src={tweet.owner.avatar} alt={tweet.owner.username} />
          ) : (
            <span>{ownerInitials(tweet.owner)}</span>
          )}
        </Link>
        <div className="tweet-body">
          <div className="tweet-header">
            <Link to={`/channel/${tweet.owner?.username}`} className="tweet-name">
              {tweet.owner?.fullName || tweet.owner?.username}
            </Link>
            <span className="tweet-time">{timeAgo(tweet.createdAt)}</span>
            {tweet.updatedAt !== tweet.createdAt && <span className="tweet-edited">(edited)</span>}
          </div>

          {isEditing ? (
            <div className="tweet-edit-form">
              <textarea
                className="form-input"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="tweet-edit-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setIsEditing(false); setEditContent(content); }}
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleUpdate}
                  disabled={isUpdating || !editContent.trim()}
                >
                  {isUpdating ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <p className="tweet-text">{content}</p>
          )}

          <div className="tweet-actions">
            <button
              className={`tweet-action-btn ${isLiked ? 'active' : ''}`}
              onClick={handleToggleLike}
              aria-label={isLiked ? "Unlike post" : "Like post"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
              </svg>
              <span className="tweet-like-count">{likesCount > 0 ? likesCount : ''}</span>
            </button>

            {isOwner && !isEditing && (
              <div className="tweet-owner-actions">
                <button className="tweet-action-btn" onClick={() => setIsEditing(true)}>Edit</button>
                <button className="tweet-action-btn tweet-delete-btn" onClick={() => setShowConfirm(true)}>Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default TweetItem;

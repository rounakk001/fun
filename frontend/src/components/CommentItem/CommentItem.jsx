import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { updateComment, deleteComment } from '../../api/comment.api';
import { toggleCommentLike } from '../../api/like.api';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import './CommentItem.css';

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

function CommentItem({ comment, videoOwnerId, onDelete }) {
  const { user: currentUser, isAuthenticated } = useAuth();
  
  const [isLiked, setIsLiked] = useState(comment.isLiked || false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [content, setContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isOwner = isAuthenticated && currentUser?._id === comment.owner?._id;
  const isVideoOwner = isAuthenticated && currentUser?._id === videoOwnerId;

  const handleToggleLike = async () => {
    if (!isAuthenticated) return;
    
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => prev + (wasLiked ? -1 : 1));
    
    try {
      await toggleCommentLike(comment._id);
    } catch (err) {
      // revert on error
      setIsLiked(wasLiked);
      setLikesCount(prev => prev + (wasLiked ? 1 : -1));
    }
  };

  const handleUpdate = async () => {
    if (!editContent.trim() || editContent === content) {
      setIsEditing(false);
      return;
    }
    
    setIsUpdating(true);
    try {
      await updateComment(comment._id, editContent);
      setContent(editContent);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update comment', err);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleDeleteRequest = () => {
    setShowConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteComment(comment._id);
      onDelete(comment._id);
    } catch (err) {
      console.error('Failed to delete comment', err);
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowConfirm(false);
  };

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          title="Delete comment?"
          message="This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          isLoading={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
      <div className={`comment-item ${isDeleting ? 'comment-item--deleting' : ''}`}>
      <Link to={`/channel/${comment.owner?.username}`} className="comment-avatar">
        {comment.owner?.avatar ? (
          <img src={comment.owner.avatar} alt={comment.owner.username} />
        ) : (
          <span>{ownerInitials(comment.owner)}</span>
        )}
      </Link>
      
      <div className="comment-body">
        <div className="comment-header">
          <Link to={`/channel/${comment.owner?.username}`} className="comment-author">
            @{comment.owner?.username}
          </Link>
          <span className="comment-time">{timeAgo(comment.createdAt)}</span>
        </div>
        
        {isEditing ? (
          <div className="comment-edit-box">
            <textarea 
              value={editContent} 
              onChange={e => setEditContent(e.target.value)}
              className="comment-edit-input"
              rows={2}
              autoFocus
            />
            <div className="comment-edit-actions">
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
          <p className="comment-text">{content}</p>
        )}
        
        <div className="comment-actions">
          <button 
            className={`comment-action-btn ${isLiked ? 'active' : ''}`} 
            onClick={handleToggleLike}
            aria-label={isLiked ? "Unlike comment" : "Like comment"}
            title={isLiked ? "Unlike" : "Like"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
            <span className="comment-like-count">{likesCount > 0 ? likesCount : ''}</span>
          </button>
          
          {(isOwner || isVideoOwner) && !isEditing && (
            <div className="comment-owner-actions">
              {isOwner && (
                <button 
                  className="comment-action-btn" 
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              )}
              <button 
                  className="comment-action-btn comment-delete-btn" 
                  onClick={handleDeleteRequest}
                >
                  Delete
                </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

export default CommentItem;

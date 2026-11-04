import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getVideoComments, addComment } from '../../api/comment.api';
import CommentItem from '../CommentItem/CommentItem';
import './CommentSection.css';
import { Link } from 'react-router-dom';

function CommentSection({ videoId, videoOwnerId }) {
  const { isAuthenticated, user: currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  
  // Guard against StrictMode double-fetch
  const fetchedVideoRef = useRef(null);

  const loadComments = useCallback(async (pageNum) => {
    setIsLoading(true);
    try {
      const res = await getVideoComments(videoId, { page: pageNum, limit: 10 });
      const data = res.data.data;
      
      if (pageNum === 1) {
        setComments(data.docs);
      } else {
        setComments(prev => [...prev, ...data.docs]);
      }
      
      setHasNextPage(data.hasNextPage);
    } catch (err) {
      console.error('Failed to load comments', err);
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    // If video changes, reset and fetch
    if (fetchedVideoRef.current !== videoId) {
      fetchedVideoRef.current = videoId;
      setComments([]);
      setPage(1);
      setHasNextPage(false);
      loadComments(1);
    }
  }, [videoId, loadComments]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadComments(nextPage);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !isAuthenticated) return;
    
    setIsSubmitting(true);
    try {
      const res = await addComment(videoId, newCommentText);
      const newComment = res.data.data;
      // Prepend the new comment locally
      setComments(prev => [newComment, ...prev]);
      setNewCommentText('');
    } catch (err) {
      console.error('Failed to add comment', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId) => {
    setComments(prev => prev.filter(c => c._id !== commentId));
  };

  return (
    <section className="watch-comments" aria-label="Comments section">
      <h2 className="watch-comments__heading">Comments</h2>
      
      {/* Input */}
      {isAuthenticated ? (
        <form className="watch-comment-form" onSubmit={handleAddComment}>
          <div className="watch-comment-form__avatar" aria-hidden="true">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="You" />
            ) : (
              <span>{currentUser?.fullName?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || '?'}</span>
            )}
          </div>
          <div className="watch-comment-form__input-wrap">
            <input
              type="text"
              className="watch-comment-input"
              placeholder="Add a comment..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              aria-label="Add a comment"
            />
            {newCommentText.trim() && (
              <div className="watch-comment-submit-wrap">
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Posting...' : 'Comment'}
                </button>
              </div>
            )}
          </div>
        </form>
      ) : (
        <div className="watch-comment-login-prompt">
          <Link to="/login" className="btn btn-secondary">Sign in to comment</Link>
        </div>
      )}

      {/* List */}
      <div className="watch-comments__list" aria-live="polite">
        {comments.map((comment) => (
          <CommentItem 
            key={comment._id} 
            comment={comment} 
            videoOwnerId={videoOwnerId}
            onDelete={handleDeleteComment} 
          />
        ))}
        
        {isLoading && <div className="watch-comments-loading">Loading comments...</div>}
        
        {!isLoading && comments.length === 0 && (
          <div className="watch-comments-empty">
            No comments yet. Be the first!
          </div>
        )}
        
        {!isLoading && hasNextPage && (
          <button 
            className="watch-comments-load-more" 
            onClick={handleLoadMore}
          >
            Load more
          </button>
        )}
      </div>
    </section>
  );
}

export default CommentSection;

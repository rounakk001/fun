import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import VideoGrid from '../../components/VideoGrid/VideoGrid';
import SubscribeButton from '../../components/SubscribeButton/SubscribeButton';
import { useAuth } from '../../context/AuthContext';
import { getChannelProfile } from '../../api/channel.api';
import { getVideos } from '../../api/video.api';
import { getUserPlaylists, createPlaylist } from '../../api/playlist.api';
import { getUserTweets, createTweet } from '../../api/tweet.api';
import PlaylistCard from '../../components/PlaylistCard/PlaylistCard';
import TweetItem from '../../components/TweetItem/TweetItem';
import PlaylistFormModal from '../../components/PlaylistFormModal/PlaylistFormModal';
import './Channel.css';

/* ── Helpers ──────────────────────────────────────────────────── */

function formatCount(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function ownerInitials(fullName, username) {
  const name = fullName || username || '';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

/* ── Channel page ─────────────────────────────────────────────── */

function Channel() {
  const { username } = useParams();
  const { user: currentUser, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);

  // ── Channel profile ────────────────────────────────────────────
  const [channel, setChannel] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [is404, setIs404] = useState(false);
  const [profileError, setProfileError] = useState(null);

  // ── Tab state ──────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'videos'); // 'videos' | 'playlists' | 'community'

  // Sync tab if URL changes (e.g. from sidebar link)
  useEffect(() => {
    const tab = searchParams.get('tab') || 'videos';
    setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // ── Channel videos (paginated) ─────────────────────────────────
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const LIMIT = 12;

  // ── Playlists ──────────────────────────────────────────────────
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  // ── Community (Tweets) ─────────────────────────────────────────
  const [tweets, setTweets] = useState([]);
  const [tweetsLoading, setTweetsLoading] = useState(false);
  const [newTweetContent, setNewTweetContent] = useState('');
  const [isPostingTweet, setIsPostingTweet] = useState(false);

  // ── Fetch channel profile ──────────────────────────────────────
  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    setProfileLoading(true);
    setChannel(null);
    setIs404(false);
    setProfileError(null);
    setVideos([]);
    setCurrentPage(1);

    getChannelProfile(username)
      .then((res) => {
        if (cancelled) return;
        setChannel(res.data.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err.response?.status;
        if (status === 404) setIs404(true);
        else setProfileError('Failed to load channel. Please try again.');
      })
      .finally(() => { if (!cancelled) setProfileLoading(false); });

    return () => { cancelled = true; };
  }, [username]);

  // ── Fetch channel videos once we have the channel's _id ───────
  useEffect(() => {
    if (!channel?._id) return;
    let cancelled = false;

    setVideosLoading(true);
    setVideos([]);
    setCurrentPage(1);

    getVideos({ page: 1, limit: LIMIT, userId: channel._id, sortBy: 'createdAt', sortType: 'desc' })
      .then((res) => {
        if (cancelled) return;
        const { docs, hasNextPage: hnp } = res.data.data;
        setVideos(docs);
        setHasNextPage(hnp);
        setCurrentPage(1);
      })
      .catch(() => { if (!cancelled) setVideos([]); })
      .finally(() => { if (!cancelled) setVideosLoading(false); });

    return () => { cancelled = true; };
  }, [channel?._id]);

  // ── Load more ──────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (!channel?._id || isLoadingMore) return;
    const nextPage = currentPage + 1;
    setIsLoadingMore(true);

    getVideos({ page: nextPage, limit: LIMIT, userId: channel._id, sortBy: 'createdAt', sortType: 'desc' })
      .then((res) => {
        const { docs, hasNextPage: hnp } = res.data.data;
        setVideos((prev) => [...prev, ...docs]);
        setHasNextPage(hnp);
        setCurrentPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMore(false));
  }, [channel?._id, currentPage, isLoadingMore]);

  // ── Derived: is this the logged-in user's own channel? ─────────
  const isOwnChannel =
    isAuthenticated &&
    currentUser?.username &&
    currentUser.username.toLowerCase() === username?.toLowerCase();

  // ── Subscriber count update after toggle ───────────────────────
  const handleSubscribeToggle = useCallback((isNowSubscribed) => {
    setChannel((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        isSubscribed: isNowSubscribed,
        subscribersCount: prev.subscribersCount + (isNowSubscribed ? 1 : -1),
      };
    });
  }, []);

  // ── Fetch Playlists ────────────────────────────────────────────
  useEffect(() => {
    if (!channel || activeTab !== 'playlists') return;
    
    setPlaylistsLoading(true);
    getUserPlaylists(channel._id)
      .then((res) => {
        setPlaylists(res.data.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setPlaylistsLoading(false));
  }, [channel, activeTab]);

  // ── Fetch Tweets ───────────────────────────────────────────────
  useEffect(() => {
    if (!channel || activeTab !== 'community') return;

    setTweetsLoading(true);
    getUserTweets(channel._id)
      .then((res) => {
        setTweets(res.data.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setTweetsLoading(false));
  }, [channel, activeTab]);

  // ── Actions ────────────────────────────────────────────────────

  const handleCreatePlaylist = async (data) => {
    setIsCreatingPlaylist(true);
    try {
      const res = await createPlaylist(data);
      setPlaylists((prev) => [res.data.data, ...prev]);
      setShowPlaylistForm(false);
    } catch (err) {
      console.error('Failed to create playlist', err);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const handlePostTweet = async (e) => {
    e.preventDefault();
    if (!newTweetContent.trim()) return;
    
    setIsPostingTweet(true);
    try {
      const res = await createTweet(newTweetContent);
      setTweets((prev) => [res.data.data, ...prev]);
      setNewTweetContent('');
    } catch (err) {
      console.error('Failed to post tweet', err);
    } finally {
      setIsPostingTweet(false);
    }
  };

  const handleDeleteTweet = (tweetId) => {
    setTweets((prev) => prev.filter((t) => t._id !== tweetId));
  };

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="channel-root">
      <Header onMenuToggle={() => setSidebarOpen((p) => !p)} />

      <div className={`channel-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="channel-main" id="main-content">

          {/* ── Loading ────────────────────────────────────────── */}
          {profileLoading && <ChannelSkeleton />}

          {/* ── 404 ───────────────────────────────────────────── */}
          {!profileLoading && is404 && (
            <div className="channel-error-state">
              <span className="channel-error-state__icon" aria-hidden="true">👤</span>
              <h1 className="channel-error-state__title">Channel not found</h1>
              <p className="channel-error-state__text">
                @{username} doesn't exist or may have been removed.
              </p>
              <Link to="/home" className="btn btn-primary">Go to Home</Link>
            </div>
          )}

          {/* ── General error ─────────────────────────────────── */}
          {!profileLoading && profileError && (
            <div className="channel-error-state">
              <span className="channel-error-state__icon" aria-hidden="true">⚠️</span>
              <h1 className="channel-error-state__title">Something went wrong</h1>
              <p className="channel-error-state__text">{profileError}</p>
              <Link to="/home" className="btn btn-primary">Go to Home</Link>
            </div>
          )}

          {/* ── Channel profile ────────────────────────────────── */}
          {!profileLoading && channel && (
            <div className="channel-page-container">
              {/* ── Cover image ─────────────────────────────── */}
              <div className="channel-cover">
                {channel.coverImage ? (
                  <img
                    src={channel.coverImage}
                    alt={`${channel.fullName}'s cover`}
                    className="channel-cover__img"
                  />
                ) : (
                  <div className="channel-cover__fallback" aria-hidden="true" />
                )}
              </div>

              {/* ── Profile row ─────────────────────────────── */}
              <div className="channel-profile">
                <div className="channel-profile__inner">
                  {/* Avatar */}
                  <div className="channel-avatar" aria-hidden="true">
                    {channel.avatar ? (
                      <img
                        src={channel.avatar}
                        alt={channel.fullName || channel.username}
                        className="channel-avatar__img"
                      />
                    ) : (
                      <span className="channel-avatar__initials">
                        {ownerInitials(channel.fullName, channel.username)}
                      </span>
                    )}
                  </div>

                  {/* Info + actions */}
                  <div className="channel-info">
                    <h1 className="channel-info__name">
                      {channel.fullName || channel.username}
                    </h1>
                    <p className="channel-info__username">@{channel.username}</p>
                    <p className="channel-info__stats">
                      <span>{formatCount(channel.subscribersCount)} subscriber{channel.subscribersCount !== 1 ? 's' : ''}</span>
                      <span className="channel-info__dot" aria-hidden="true">·</span>
                      <span>{formatCount(channel.channelsSubscribedToCount)} subscribed</span>
                    </p>

                    {/* Subscribe / Edit Profile button */}
                    <div className="channel-info__actions">
                      {isOwnChannel ? (
                        <button
                          id="channel-edit-profile-btn"
                          className="btn btn-secondary channel-edit-btn"
                          title="Edit profile (coming soon)"
                          onClick={() => {}}
                        >
                          Edit Profile
                        </button>
                      ) : (
                        <SubscribeButton
                          channelId={channel._id}
                          initialValue={channel.isSubscribed}
                          onToggle={handleSubscribeToggle}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Tabs ────────────────────────────────────────────────────── */}
              <div className="channel-tabs">
                <button
                  className={`channel-tab ${activeTab === 'videos' ? 'channel-tab--active' : ''}`}
                  onClick={() => handleTabChange('videos')}
                >
                  Videos
                </button>
                <button
                  className={`channel-tab ${activeTab === 'playlists' ? 'channel-tab--active' : ''}`}
                  onClick={() => handleTabChange('playlists')}
                >
                  Playlists
                </button>
                <button
                  className={`channel-tab ${activeTab === 'community' ? 'channel-tab--active' : ''}`}
                  onClick={() => handleTabChange('community')}
                >
                  Community
                </button>
              </div>

              {/* ── Tab Content ───────────────────────────────────────────── */}
              <div className="channel-tab-content">
                {/* Videos Tab */}
                {activeTab === 'videos' && (
                  <section className="channel-videos" aria-label={`${channel.fullName || channel.username}'s videos`}>
                    <VideoGrid
                      videos={videos}
                      isLoading={videosLoading}
                      isLoadingMore={isLoadingMore}
                      hasNextPage={hasNextPage}
                      onLoadMore={handleLoadMore}
                      emptyMessage="This channel hasn't uploaded any videos yet."
                    />
                  </section>
                )}

                {/* Playlists Tab */}
                {activeTab === 'playlists' && (
                  <section className="channel-playlists" aria-label={`${channel.fullName || channel.username}'s playlists`}>
                    {isOwnChannel && (
                      <div className="channel-playlists__actions">
                        <button className="btn btn-primary" onClick={() => setShowPlaylistForm(true)}>
                          + New Playlist
                        </button>
                      </div>
                    )}
                    
                    {playlistsLoading ? (
                      <div className="channel-loading">Loading playlists...</div>
                    ) : playlists.length > 0 ? (
                      <div className="channel-playlists__grid">
                        {playlists.map((playlist) => (
                          <PlaylistCard key={playlist._id} playlist={playlist} isOwner={isOwnChannel} />
                        ))}
                      </div>
                    ) : (
                      <div className="channel-empty">This channel doesn't have any playlists yet.</div>
                    )}
                  </section>
                )}

                {/* Community Tab */}
                {activeTab === 'community' && (
                  <section className="channel-community" aria-label={`${channel.fullName || channel.username}'s community posts`}>
                    {isOwnChannel && (
                      <form className="channel-tweet-form" onSubmit={handlePostTweet}>
                        <textarea
                          className="form-input"
                          placeholder="What's on your mind?"
                          value={newTweetContent}
                          onChange={(e) => setNewTweetContent(e.target.value)}
                          rows={3}
                        />
                        <div className="channel-tweet-form__actions">
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isPostingTweet || !newTweetContent.trim()}
                          >
                            {isPostingTweet ? 'Posting...' : 'Post'}
                          </button>
                        </div>
                      </form>
                    )}

                    {tweetsLoading ? (
                      <div className="channel-loading">Loading posts...</div>
                    ) : tweets.length > 0 ? (
                      <div className="channel-community__list">
                        {tweets.map((tweet) => (
                          <TweetItem
                            key={tweet._id}
                            tweet={tweet}
                            isOwner={isOwnChannel}
                            isAuthenticated={isAuthenticated}
                            onDelete={handleDeleteTweet}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="channel-empty">No community posts yet.</div>
                    )}
                  </section>
                )}
              </div>

              {/* Modals */}
              <PlaylistFormModal
                isOpen={showPlaylistForm}
                onClose={() => setShowPlaylistForm(false)}
                onSubmit={handleCreatePlaylist}
                isLoading={isCreatingPlaylist}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────── */

function ChannelSkeleton() {
  return (
    <div className="channel-skeleton channel-page-container">
      <div className="channel-skeleton__cover skeleton-shimmer" />
      <div className="channel-skeleton__profile">
        <div className="channel-skeleton__avatar skeleton-shimmer" />
        <div className="channel-skeleton__info">
          <div className="channel-skeleton__name skeleton-shimmer" />
          <div className="channel-skeleton__sub skeleton-shimmer" />
          <div className="channel-skeleton__stats skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default Channel;

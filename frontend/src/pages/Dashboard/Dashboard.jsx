import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import StatCard from '../../components/StatCard/StatCard';
import { getDashboardStats, getDashboardVideos, togglePublishStatus } from '../../api/dashboard.api';
import EditVideoModal from './EditVideoModal';
import MoveToPremiumModal from '../../components/MoveToPremiumModal/MoveToPremiumModal';
import './Dashboard.css';

// SVG Icons for Stats
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
);
const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
);

function formatCount(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [stats, setStats] = useState(null);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingMap, setTogglingMap] = useState({});
  const [editingVideo, setEditingVideo] = useState(null);
  const [movingVideo, setMovingVideo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    
    Promise.all([
      getDashboardStats(),
      getDashboardVideos()
    ])
    .then(([statsRes, videosRes]) => {
      if (cancelled) return;
      setStats(statsRes.data.data);
      setVideos(videosRes.data.data);
    })
    .catch(err => {
      console.error('Failed to load dashboard data', err);
    })
    .finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const handleTogglePublish = async (videoId) => {
    setTogglingMap(prev => ({ ...prev, [videoId]: true }));
    try {
      const res = await togglePublishStatus(videoId);
      setVideos(prev => 
        prev.map(v => v._id === videoId ? { ...v, isPublished: res.data.data.isPublished } : v)
      );
    } catch (err) {
      console.error('Failed to toggle publish status', err);
    } finally {
      setTogglingMap(prev => ({ ...prev, [videoId]: false }));
    }
  };

  return (
    <div className="dashboard-root">
      <Header onMenuToggle={() => setSidebarOpen((p) => !p)} />

      <div className={`dashboard-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="dashboard-main" id="main-content">
          <div className="dashboard-header">
            <h1 className="dashboard-title">Creator Dashboard</h1>
          </div>

          {isLoading ? (
            <div className="dashboard-loading">Loading dashboard...</div>
          ) : (
            <>
              {/* Stats Row */}
              <div className="dashboard-stats-grid">
                <StatCard label="Total Views" value={formatCount(stats?.totalViews || 0)} icon={<EyeIcon />} />
                <StatCard label="Total Subscribers" value={formatCount(stats?.totalSubscribers || 0)} icon={<UsersIcon />} />
                <StatCard label="Total Likes" value={formatCount(stats?.totalLikes || 0)} icon={<HeartIcon />} />
                <StatCard label="Total Videos" value={formatCount(stats?.totalVideos || 0)} icon={<VideoIcon />} />
              </div>

              {/* Videos Table */}
              <section className="dashboard-videos-section">
                <h2 className="dashboard-section-title">Your Videos</h2>
                
                {videos.length === 0 ? (
                  <div className="dashboard-empty">
                    <p>You haven't uploaded any videos yet.</p>
                    <Link to="/upload" className="btn btn-primary mt-4">Upload Video</Link>
                  </div>
                ) : (
                  <div className="dashboard-table-container">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Video</th>
                          <th>Visibility</th>
                          <th>Date</th>
                          <th>Views</th>
                          <th>Likes</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {videos.map(video => (
                          <tr key={video._id}>
                            <td>
                              <Link to={`/watch/${video._id}`} className="dashboard-table-video" style={{ textDecoration: 'none', color: 'inherit' }}>
                                <img src={video.thumbnail} alt="" className="dashboard-table-thumb" />
                                <span className="dashboard-table-vtitle">
                                  {video.isPremium && (
                                    <span style={{ color: '#d4af37', marginRight: '6px', fontSize: '0.72rem', fontWeight: '700', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', padding: '1px 6px', borderRadius: '4px', letterSpacing: '0.06em' }} title="Vault Video">
                                      VAULT
                                    </span>
                                  )}
                                  {video.isShort && (
                                    <span style={{ color: '#ff4444', marginRight: '6px', fontWeight: 'bold' }} title="Short Video">
                                      ▶ Short
                                    </span>
                                  )}
                                  {video.title}
                                </span>
                              </Link>
                            </td>
                            <td>
                              <span className={`dashboard-badge ${video.isPublished ? 'dashboard-badge--public' : 'dashboard-badge--private'}`}>
                                {video.isPublished ? 'Public' : 'Private'}
                              </span>
                            </td>
                            <td>{formatDate(video.createdAt)}</td>
                            <td>{formatCount(video.views)}</td>
                            <td>{formatCount(video.likesCount)}</td>
                            <td>
                              <div className="dashboard-table-actions">
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleTogglePublish(video._id)}
                                  disabled={togglingMap[video._id]}
                                >
                                  {video.isPublished ? 'Unpublish' : 'Publish'}
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setEditingVideo(video)}
                                >
                                  Edit
                                </button>
                                {!video.isPremium ? (
                                  <button
                                    className="btn btn-sm"
                                    style={{
                                      background: 'rgba(245, 197, 24, 0.15)',
                                      border: '1px solid rgba(245, 197, 24, 0.5)',
                                      color: '#f5c518',
                                      fontWeight: '600'
                                    }}
                                    onClick={() => setMovingVideo(video)}
                                    title="Move this video to the VIP Vault"
                                  >
                                    Move to Vault
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '0.74rem',
                                      fontWeight: '700',
                                      color: '#f5c518',
                                      padding: '3px 7px',
                                      borderRadius: '4px',
                                      background: 'rgba(245, 197, 24, 0.1)',
                                      border: '1px solid rgba(245, 197, 24, 0.3)',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title="This video is inside the VIP Vault"
                                  >
                                    In Vault
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {movingVideo && (
        <MoveToPremiumModal
          isOpen={Boolean(movingVideo)}
          video={movingVideo}
          onClose={() => setMovingVideo(null)}
          onSuccess={(updatedVideo) => {
            setVideos((prev) =>
              prev.map((v) => (v._id === updatedVideo._id ? { ...v, isPremium: true } : v))
            );
            setMovingVideo(null);
          }}
        />
      )}

      {editingVideo && (
        <EditVideoModal
          video={editingVideo}
          onClose={() => setEditingVideo(null)}
          onSuccess={(updatedVideo) => {
            setVideos((prev) => prev.map((v) => (v._id === updatedVideo._id ? updatedVideo : v)));
            setEditingVideo(null);
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;

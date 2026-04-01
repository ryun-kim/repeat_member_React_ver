import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { path: '/calendar', label: '캘린더', icon: '📅' },
    { path: '/members', label: '멤버', icon: '👥' },
    { path: '/ranking', label: '랭킹', icon: '🏆' },
    { path: '/teams', label: '팀분배', icon: '👨‍👩‍👧‍👦' },
    { path: '/match', label: '경기결과', icon: '🏀' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="app-header">
        <div className="header-content">
          <h1>🏀 Team Repeat</h1>
          <div className="header-actions">
            {profile && (
              <button className="profile-btn" onClick={() => navigate('/my-page')}>
                <span className="profile-avatar">{profile.nickname?.[0]}</span>
                <span className="nickname">{profile.nickname}</span>
              </button>
            )}
            {profile?.role === 'admin' && (
              <button className="admin-btn" onClick={() => navigate('/admin')} title="관리자 패널">⚙️</button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {tabs.map((tab) => (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`nav-btn ${location.pathname === tab.path ? 'active' : ''}`}
            title={tab.label}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

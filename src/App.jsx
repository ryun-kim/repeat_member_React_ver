import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CalendarPage from './pages/CalendarPage';
import MemberPage from './pages/MemberPage';
import RankingPage from './pages/RankingPage';
import TeamPage from './pages/TeamPage';
import MatchPage from './pages/MatchPage';
import MyPage from './pages/MyPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function AppContent() {
  const { user, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading && !timedOut) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>로딩중...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {user ? (
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/calendar" replace />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/members" element={<MemberPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/teams" element={<TeamPage />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="/my-page" element={<MyPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

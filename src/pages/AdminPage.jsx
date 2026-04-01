import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './AdminPage.css';

export default function AdminPage() {
  const { profile: myProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = myProfile?.role === 'admin';

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    if (!isAdmin) { navigate('/calendar'); return; }
    loadProfiles();
  }, [isAdmin]);

  const loadProfiles = async () => {
    const { data } = await supabase.from('profiles').select().order('nickname');
    setProfiles(data ?? []);
    setLoading(false);
  };

  const setLoaderFor = (id, val) =>
    setActionLoading((prev) => ({ ...prev, [id]: val }));

  // 역할 전환
  const handleToggleRole = async (p) => {
    const newRole = p.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`${p.nickname}님을 ${newRole === 'admin' ? '관리자' : '일반 사용자'}로 변경할까요?`)) return;
    setLoaderFor(p.id + '_role', true);
    await supabase.from('profiles').update({ role: newRole }).eq('id', p.id);
    await loadProfiles();
    setLoaderFor(p.id + '_role', false);
  };

  // 비밀번호 초기화 (000000)
  const handleResetPassword = async (p) => {
    if (!window.confirm(`${p.nickname}님의 비밀번호를 000000으로 초기화할까요?`)) return;
    setLoaderFor(p.id + '_pw', true);
    const { error } = await supabase.auth.admin.updateUserById(p.id, { password: '000000' });
    if (error) {
      // admin API 사용 불가 시 안내
      alert('비밀번호 초기화는 Supabase 대시보드에서 직접 처리해 주세요.\n(서비스 롤 키가 필요합니다)');
    } else {
      alert(`${p.nickname}님의 비밀번호가 000000으로 초기화되었습니다`);
    }
    setLoaderFor(p.id + '_pw', false);
  };

  // 회원 삭제
  const handleDelete = async (p) => {
    if (!window.confirm(`${p.nickname}님을 정말 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setLoaderFor(p.id + '_del', true);
    // profiles 삭제 (cascade로 auth도 삭제되는 경우)
    const { error } = await supabase.from('profiles').delete().eq('id', p.id);
    if (error) {
      alert('삭제 중 오류가 발생했습니다. Supabase 대시보드에서 직접 처리해 주세요.');
    } else {
      await loadProfiles();
    }
    setLoaderFor(p.id + '_del', false);
  };

  if (!isAdmin) return null;
  if (loading) return <div className="admin-loading">로딩중...</div>;

  const displayEmail = (email) => email?.replace('@repeat.app', '') ?? '';

  return (
    <div className="admin-page">
      <div className="admin-header-card">
        <div className="admin-header-title">⚙️ 관리자 패널</div>
        <div className="admin-header-sub">회원 권한 및 계정을 관리합니다</div>
      </div>

      {/* 회원 목록 */}
      <div className="admin-section">
        <div className="admin-section-title">회원 관리 ({profiles.length}명)</div>
        <div className="member-list">
          {profiles.map((p) => {
            const isMe = p.id === myProfile.id;
            const isAdminUser = p.role === 'admin';
            return (
              <div key={p.id} className="member-item">
                <div className="member-item-left">
                  <div
                    className="member-avatar"
                    style={{ background: isAdminUser ? '#1565c020' : '#f5f5f5', color: isAdminUser ? '#1565c0' : '#555' }}
                  >
                    {p.nickname[0]}
                  </div>
                  <div className="member-item-info">
                    <div className="member-item-name">
                      {p.nickname}
                      {isMe && <span className="me-badge">나</span>}
                    </div>
                    <div className="member-item-email">{displayEmail(p.email)}</div>
                  </div>
                  <span className={`member-role-badge ${isAdminUser ? 'admin' : 'user'}`}>
                    {isAdminUser ? '관리자' : '일반'}
                  </span>
                </div>

                {!isMe && (
                  <div className="member-item-actions">
                    {/* 역할 전환 */}
                    <button
                      className={`action-btn role-btn ${isAdminUser ? 'demote' : 'promote'}`}
                      onClick={() => handleToggleRole(p)}
                      disabled={actionLoading[p.id + '_role']}
                    >
                      {actionLoading[p.id + '_role'] ? '...' : isAdminUser ? '일반으로' : '관리자로'}
                    </button>

                    {/* 비밀번호 초기화 */}
                    <button
                      className="action-btn pw-btn"
                      onClick={() => handleResetPassword(p)}
                      disabled={actionLoading[p.id + '_pw']}
                      title="비밀번호를 000000으로 초기화"
                    >
                      {actionLoading[p.id + '_pw'] ? '...' : '🔑'}
                    </button>

                    {/* 삭제 */}
                    <button
                      className="action-btn del-btn"
                      onClick={() => handleDelete(p)}
                      disabled={actionLoading[p.id + '_del']}
                      title="회원 삭제"
                    >
                      {actionLoading[p.id + '_del'] ? '...' : '🗑️'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

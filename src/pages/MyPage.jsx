import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './MyPage.css';

export default function MyPage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';

  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState('');

  const [showPwForm, setShowPwForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  const displayEmail = profile?.email?.replace('@repeat.app', '') ?? '';

  const handleNicknameEdit = () => {
    setNewNickname(profile.nickname);
    setNicknameError('');
    setEditingNickname(true);
  };

  const handleNicknameSave = async () => {
    if (newNickname.trim().length < 2) {
      setNicknameError('닉네임은 2자 이상이어야 합니다');
      return;
    }
    setNicknameSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: newNickname.trim() })
      .eq('id', profile.id);
    if (error) {
      setNicknameError('저장 중 오류가 발생했습니다');
    } else {
      await refreshProfile();
      setEditingNickname(false);
    }
    setNicknameSaving(false);
  };

  const handlePwSave = async () => {
    if (pwForm.next.length < 6) {
      setPwError('비밀번호는 6자 이상이어야 합니다');
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('새 비밀번호가 일치하지 않습니다');
      return;
    }
    setPwSaving(true);
    setPwError('');

    // 현재 비밀번호 확인
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: pwForm.current,
    });
    if (signInError) {
      setPwError('현재 비밀번호가 올바르지 않습니다');
      setPwSaving(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    if (error) {
      setPwError('비밀번호 변경 중 오류가 발생했습니다');
    } else {
      setShowPwForm(false);
      setPwForm({ current: '', next: '', confirm: '' });
      alert('비밀번호가 변경되었습니다');
    }
    setPwSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (!profile) return null;

  return (
    <div className="my-page">
      {/* 프로필 카드 */}
      <div className="profile-card">
        <div className="profile-big-avatar">
          {profile.nickname[0]}
        </div>
        <div className="profile-info">
          <div className="profile-nickname">{profile.nickname}</div>
          <div className="profile-email">{displayEmail}</div>
          <span className={`role-badge ${isAdmin ? 'admin' : 'user'}`}>
            {isAdmin ? '관리자' : '일반'}
          </span>
        </div>
      </div>

      {/* 계정 설정 */}
      <div className="settings-card">
        <div className="settings-title">계정 설정</div>

        {/* 닉네임 변경 */}
        <div className="settings-row" onClick={!editingNickname ? handleNicknameEdit : undefined}>
          <div className="settings-row-left">
            <span className="settings-icon">✏️</span>
            <span className="settings-label">닉네임 변경</span>
          </div>
          {!editingNickname && <span className="settings-arrow">›</span>}
        </div>

        {editingNickname && (
          <div className="inline-edit">
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="새 닉네임 (2자 이상)"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleNicknameSave()}
            />
            {nicknameError && <div className="edit-error">{nicknameError}</div>}
            <div className="inline-edit-btns">
              <button onClick={() => setEditingNickname(false)} className="edit-cancel-btn">취소</button>
              <button onClick={handleNicknameSave} disabled={nicknameSaving} className="edit-save-btn">
                {nicknameSaving ? '저장중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        <div className="settings-divider" />

        {/* 비밀번호 변경 */}
        <div className="settings-row" onClick={!showPwForm ? () => { setShowPwForm(true); setPwError(''); } : undefined}>
          <div className="settings-row-left">
            <span className="settings-icon">🔑</span>
            <span className="settings-label">비밀번호 변경</span>
          </div>
          {!showPwForm && <span className="settings-arrow">›</span>}
        </div>

        {showPwForm && (
          <div className="inline-edit">
            <input
              type="password"
              placeholder="현재 비밀번호"
              value={pwForm.current}
              onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
            />
            <input
              type="password"
              placeholder="새 비밀번호 (6자 이상)"
              value={pwForm.next}
              onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
            />
            <input
              type="password"
              placeholder="새 비밀번호 확인"
              value={pwForm.confirm}
              onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handlePwSave()}
            />
            {pwError && <div className="edit-error">{pwError}</div>}
            <div className="inline-edit-btns">
              <button onClick={() => setShowPwForm(false)} className="edit-cancel-btn">취소</button>
              <button onClick={handlePwSave} disabled={pwSaving} className="edit-save-btn">
                {pwSaving ? '변경중...' : '변경'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 관리자 패널 바로가기 */}
      {isAdmin && (
        <div className="settings-card">
          <div className="settings-title">관리자</div>
          <div className="settings-row" onClick={() => navigate('/admin')}>
            <div className="settings-row-left">
              <span className="settings-icon">⚙️</span>
              <span className="settings-label">관리자 패널</span>
            </div>
            <span className="settings-arrow">›</span>
          </div>
        </div>
      )}

      {/* 로그아웃 */}
      <button className="logout-btn-main" onClick={handleSignOut}>로그아웃</button>
    </div>
  );
}

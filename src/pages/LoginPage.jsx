import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [nickname, setNickname] = useState('');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const err = await signIn(username, password);
    if (err) {
      setError(err.message);
    } else {
      navigate('/calendar');
    }
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const err = await signUp(username, nickname, password);
    if (err) {
      setError(err.message);
    } else {
      setUsername('');
      setPassword('');
      setNickname('');
      setIsSignUp(false);
      setError('가입되었습니다. 로그인해주세요.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🏀 Team Repeat</h1>
        <p className="subtitle">팀 관리 시스템</p>

        {error && <div className={`message ${error.includes('가입') ? 'success' : 'error'}`}>{error}</div>}

        <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
          <div className="form-group">
            <label>아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디 입력"
              required
            />
          </div>

          {isSignUp && (
            <div className="form-group">
              <label>닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임 입력"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? '진행중...' : isSignUp ? '가입' : '로그인'}
          </button>
        </form>

        <button onClick={() => setIsSignUp(!isSignUp)} className="toggle-btn">
          {isSignUp ? '로그인 하기' : '회원가입'}
        </button>
      </div>
    </div>
  );
}

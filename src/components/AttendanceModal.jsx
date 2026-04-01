import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './AttendanceModal.css';

const STATUS_CONFIG = {
  참석:   { emoji: 'O', color: '#1976d2', bg: 'rgba(25,118,210,0.1)',  label: '참석' },
  미정:   { emoji: '?', color: '#f57c00', bg: 'rgba(245,124,0,0.1)',   label: '미정' },
  불참석: { emoji: 'X', color: '#d32f2f', bg: 'rgba(211,47,47,0.1)',   label: '불참' },
};
const STATUSES = ['참석', '미정', '불참석'];

export default function AttendanceModal({ event, isAdmin, onClose }) {
  const { user, profile } = useAuth();
  const [statusMap, setStatusMap] = useState({});   // profileId → status
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const isPast = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(event.date + 'T00:00:00') < today;
  })();

  const load = useCallback(async () => {
    const [{ data: attendances }, { data: allProfiles }] = await Promise.all([
      supabase.from('attendance').select().eq('event_id', event.id),
      supabase.from('profiles').select().order('created_at'),
    ]);
    const map = {};
    (attendances ?? []).forEach((a) => { map[a.profile_id] = a.status; });
    setStatusMap(map);
    setProfiles(allProfiles ?? []);
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const vote = async (profileId, nextStatus) => {
    const prev = statusMap[profileId];
    // 낙관적 업데이트
    setStatusMap((m) => ({ ...m, [profileId]: nextStatus }));
    const { error } = await supabase
      .from('attendance')
      .upsert({ event_id: event.id, profile_id: profileId, status: nextStatus },
               { onConflict: 'event_id,profile_id' });
    if (error) {
      // 롤백
      setStatusMap((m) => ({ ...m, [profileId]: prev }));
    }
  };

  // 요약 카운트
  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = Object.values(statusMap).filter((v) => v === s).length;
    return acc;
  }, {});

  // 정렬: 내가 맨 위, 그 다음 참석→미정→불참
  const sortedProfiles = [...profiles].sort((a, b) => {
    if (a.id === user?.id) return -1;
    if (b.id === user?.id) return 1;
    const order = { 참석: 0, 미정: 1, 불참석: 2 };
    return (order[statusMap[a.id]] ?? 1) - (order[statusMap[b.id]] ?? 1);
  });

  const formatEventDate = (dateStr) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    });

  return (
    <div className="att-overlay" onClick={onClose}>
      <div className="att-sheet" onClick={(e) => e.stopPropagation()}>
        {/* 핸들 */}
        <div className="att-handle" />

        {/* 헤더 */}
        <div className="att-header">
          <h2>{event.title}</h2>
          <p>{formatEventDate(event.date)}</p>
        </div>

        {loading ? (
          <div className="att-loading">로딩중...</div>
        ) : (
          <>
            {/* 요약 */}
            <div className="att-summary">
              {STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s];
                return (
                  <div key={s} className="summary-item">
                    <div className="summary-circle" style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.emoji}
                    </div>
                    <span className="summary-count" style={{ color: cfg.color }}>{counts[s]}명</span>
                    <span className="summary-label">{cfg.label}</span>
                  </div>
                );
              })}
              <div className="summary-divider" />
              <div className="summary-item">
                <div className="summary-total">{profiles.length}</div>
                <span className="summary-label">전체</span>
              </div>
            </div>

            {/* 내 투표 카드 (미래 일정이고 로그인 상태일 때) */}
            {!isPast && user && profile && (
              <div
                className="my-vote-card"
                style={{
                  borderColor: STATUS_CONFIG[statusMap[user.id] ?? '미정']?.color + '66',
                  background: STATUS_CONFIG[statusMap[user.id] ?? '미정']?.bg,
                }}
              >
                <div className="my-vote-info">
                  <div className="avatar" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                    {profile.nickname?.[0]}
                  </div>
                  <div>
                    <div className="my-vote-name">
                      {profile.nickname}
                      <span className="me-badge">나</span>
                    </div>
                    <div className="my-vote-hint">내 참석 여부를 선택하세요</div>
                  </div>
                </div>
                <div className="vote-btns">
                  {STATUSES.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const selected = (statusMap[user.id] ?? '미정') === s;
                    return (
                      <button
                        key={s}
                        className={`vote-btn ${selected ? 'selected' : ''}`}
                        style={selected ? { borderColor: cfg.color, color: cfg.color, background: cfg.bg } : {}}
                        onClick={() => vote(user.id, s)}
                      >
                        {cfg.emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 멤버 목록 */}
            <div className="att-list">
              {sortedProfiles.map((p) => {
                const status = statusMap[p.id] ?? '미정';
                const cfg = STATUS_CONFIG[status];
                const isMe = p.id === user?.id;
                const canVote = isAdmin && !isMe && !isPast;

                return (
                  <div
                    key={p.id}
                    className="att-row"
                    style={{
                      borderColor: isMe ? 'rgba(21,101,192,0.3)' : cfg.color + '26',
                      background: isMe ? 'rgba(21,101,192,0.03)' : 'white',
                    }}
                  >
                    <div
                      className="att-avatar"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.emoji}
                    </div>
                    <span className="att-name">
                      {p.nickname}
                      {isMe && <span className="me-badge">나</span>}
                    </span>

                    {canVote ? (
                      <div className="vote-btns small">
                        {STATUSES.map((s) => {
                          const c = STATUS_CONFIG[s];
                          const sel = status === s;
                          return (
                            <button
                              key={s}
                              className={`vote-btn small ${sel ? 'selected' : ''}`}
                              style={sel ? { borderColor: c.color, color: c.color, background: c.bg } : {}}
                              onClick={() => vote(p.id, s)}
                            >
                              {c.emoji}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span
                        className="status-badge"
                        style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + '4d' }}
                      >
                        {cfg.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button className="att-close" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}

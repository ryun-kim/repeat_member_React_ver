import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './MatchPage.css';

const TEAM_NAMES = ['그린', '화이트', '레드', '오렌지'];
const TEAM_KEYS = ['team_a', 'team_b', 'team_c', 'team_d'];
const TEAM_COLORS = {
  그린: '#2e7d32', 화이트: '#546e7a', 레드: '#d32f2f', 오렌지: '#f57c00',
};

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', weekday: 'short',
  });
}

function makeEmptyGame() {
  return { score_a: '', score_b: '', score_c: '', score_d: '', series_winner: '' };
}

function autoWinner(game, teamMode) {
  const scores = TEAM_NAMES.slice(0, teamMode).map((name, i) => ({
    name,
    val: parseInt(game[`score_${'abcd'[i]}`] ?? '') || 0,
  }));
  const max = Math.max(...scores.map((s) => s.val));
  if (max === 0) return '';
  const winners = scores.filter((s) => s.val === max);
  return winners.length === 1 ? winners[0].name : '';
}

export default function MatchPage() {
  const { profile: myProfile } = useAuth();
  const isAdmin = myProfile?.role === 'admin';

  const [events, setEvents] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [profileMap, setProfileMap] = useState({});
  const [teamConfig, setTeamConfig] = useState(null);
  const [games, setGames] = useState([makeEmptyGame()]);
  const [matchResultId, setMatchResultId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 기본 데이터 로드
  useEffect(() => {
    (async () => {
      const [{ data: evList }, { data: pList }] = await Promise.all([
        supabase.from('events').select().order('date', { ascending: false }),
        supabase.from('profiles').select('id, nickname, position, detail_position'),
      ]);

      const pm = {};
      (pList ?? []).forEach((p) => { pm[p.id] = p; });
      setProfileMap(pm);

      const evs = evList ?? [];
      setEvents(evs);

      const yearSet = [...new Set(evs.map((e) => e.date?.slice(0, 4)).filter(Boolean))].sort((a, b) => b - a);
      setYears(yearSet);

      const thisYear = new Date().getFullYear().toString();
      const initYear = yearSet.includes(thisYear) ? thisYear : yearSet[0] ?? thisYear;
      setSelectedYear(initYear);

      const yearEvs = evs.filter((e) => e.date?.startsWith(initYear));
      if (yearEvs.length) setSelectedEvent(yearEvs[0]);

      setLoading(false);
    })();
  }, []);

  const loadEventData = useCallback(async (event) => {
    if (!event) {
      setTeamConfig(null);
      setGames([makeEmptyGame()]);
      setMatchResultId(null);
      return;
    }

    const [{ data: tc }, { data: mr }] = await Promise.all([
      supabase.from('team_configurations').select().eq('event_id', event.id).maybeSingle(),
      supabase.from('match_results').select().eq('event_id', event.id).maybeSingle(),
    ]);

    setTeamConfig(tc ?? null);

    if (mr) {
      setMatchResultId(mr.id);
      const { data: gr } = await supabase
        .from('game_results')
        .select()
        .eq('match_result_id', mr.id)
        .order('game_number', { ascending: true });

      if (gr && gr.length > 0) {
        setGames(gr.map((g) => ({
          score_a: g.score_a ?? '',
          score_b: g.score_b ?? '',
          score_c: g.score_c ?? '',
          score_d: g.score_d ?? '',
          series_winner: g.series_winner ?? '',
        })));
      } else {
        setGames([makeEmptyGame()]);
      }
    } else {
      setMatchResultId(null);
      setGames([makeEmptyGame()]);
    }
  }, []);

  useEffect(() => {
    loadEventData(selectedEvent);
  }, [selectedEvent, loadEventData]);

  const teamMode = teamConfig?.team_mode ?? 2;
  const activeTeams = TEAM_NAMES.slice(0, teamMode);
  const filteredEvents = events.filter((e) => e.date?.startsWith(selectedYear ?? ''));

  const handleYearChange = (y) => {
    setSelectedYear(y);
    const yearEvs = events.filter((e) => e.date?.startsWith(y));
    setSelectedEvent(yearEvs[0] ?? null);
  };

  const updateGame = (idx, field, val) => {
    setGames((prev) => {
      const next = [...prev];
      const updated = { ...next[idx], [field]: val };
      if (field.startsWith('score_')) {
        const auto = autoWinner(updated, teamMode);
        updated.series_winner = auto || updated.series_winner;
      }
      next[idx] = updated;
      return next;
    });
  };

  const addGame = () => setGames((prev) => [...prev, makeEmptyGame()]);
  const removeGame = (idx) => setGames((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!selectedEvent || !teamConfig) return;
    setSaving(true);
    try {
      // 1. match_results upsert
      let mrId = matchResultId;
      if (!mrId) {
        const { data: mr } = await supabase
          .from('match_results')
          .insert({ event_id: selectedEvent.id })
          .select()
          .single();
        mrId = mr.id;
        setMatchResultId(mrId);
      }

      // 2. game_results 교체
      await supabase.from('game_results').delete().eq('match_result_id', mrId);
      const gameRows = games.map((g, i) => ({
        match_result_id: mrId,
        game_number: i + 1,
        score_a: parseInt(g.score_a) || 0,
        score_b: parseInt(g.score_b) || 0,
        score_c: parseInt(g.score_c) || 0,
        score_d: parseInt(g.score_d) || 0,
        series_winner: g.series_winner || null,
      }));
      await supabase.from('game_results').insert(gameRows);

      // 3. member_records 업데이트
      const matchDate = selectedEvent.date;
      const allIds = TEAM_KEYS.flatMap((k) => teamConfig[k] ?? []).filter((id) => !!profileMap[id]);
      if (allIds.length > 0) {
        await supabase.from('member_records').delete().eq('match_date', matchDate).in('profile_id', allIds);
      }

      const records = [];
      games.forEach((g) => {
        if (!g.series_winner) return;
        const winnerIdx = TEAM_NAMES.indexOf(g.series_winner);
        activeTeams.forEach((name, ti) => {
          const ids = (teamConfig[TEAM_KEYS[ti]] ?? []).filter((id) => !!profileMap[id]);
          const result = ti === winnerIdx ? '승' : '패';
          ids.forEach((pid) => records.push({ profile_id: pid, match_date: matchDate, result }));
        });
      });
      if (records.length > 0) {
        await supabase.from('member_records').insert(records);
      }

      alert('저장되었습니다');
    } catch (e) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="match-loading">로딩중...</div>;

  return (
    <div className="match-page">
      {/* 연도 필터 */}
      <div className="year-chips">
        {years.map((y) => (
          <button
            key={y}
            className={`year-chip ${selectedYear === y ? 'active' : ''}`}
            onClick={() => handleYearChange(y)}
          >{y}년</button>
        ))}
      </div>

      {/* 일정 선택 */}
      <div className="match-controls">
        <select
          className="event-select"
          value={selectedEvent?.id ?? ''}
          onChange={(e) => {
            const ev = events.find((ev) => ev.id === e.target.value);
            setSelectedEvent(ev ?? null);
          }}
        >
          {filteredEvents.length === 0 && <option value="">일정 없음</option>}
          {filteredEvents.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}  {formatDate(e.date)}
            </option>
          ))}
        </select>
      </div>

      {!selectedEvent ? (
        <div className="match-empty">일정을 선택해 주세요</div>
      ) : !teamConfig ? (
        <div className="match-empty">팀 구성이 없습니다. 팀분배 페이지에서 먼저 팀을 구성해 주세요.</div>
      ) : (
        <>
          {/* 팀 구성 요약 */}
          <div className="team-summary-card">
            <div className="team-summary-title">팀 구성</div>
            <div className="team-summary-grid">
              {activeTeams.map((name, i) => {
                const ids = teamConfig[TEAM_KEYS[i]] ?? [];
                const color = TEAM_COLORS[name];
                return (
                  <div key={name} className="team-summary-col">
                    <div className="team-summary-header" style={{ background: color }}>
                      {name}팀 ({ids.length}명)
                    </div>
                    <div className="team-summary-members">
                      {ids.map((id) => {
                        const p = profileMap[id];
                        return p ? <span key={id} className="summary-name">{p.nickname}</span> : null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 게임 결과 목록 */}
          <div className="games-section">
            <div className="games-section-title">게임 결과</div>
            {games.map((game, idx) => (
              <GameCard
                key={idx}
                idx={idx}
                game={game}
                teamMode={teamMode}
                activeTeams={activeTeams}
                isAdmin={isAdmin}
                onUpdate={(field, val) => updateGame(idx, field, val)}
                onRemove={games.length > 1 ? () => removeGame(idx) : null}
              />
            ))}
          </div>

          {/* 하단 버튼 (관리자) */}
          {isAdmin && (
            <div className="match-footer">
              <button className="add-game-btn" onClick={addGame}>+ 게임 추가</button>
              <button className="save-match-btn" onClick={handleSave} disabled={saving}>
                {saving ? '저장중...' : '💾 저장'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 게임 카드 ────────────────────────────────────────────────
function GameCard({ idx, game, teamMode, activeTeams, isAdmin, onUpdate, onRemove }) {
  const scoreKeys = ['score_a', 'score_b', 'score_c', 'score_d'];

  return (
    <div className="game-card">
      <div className="game-card-header">
        <span className="game-number">Game {idx + 1}</span>
        {isAdmin && onRemove && (
          <button className="game-remove-btn" onClick={onRemove}>삭제</button>
        )}
      </div>

      <div className="score-row">
        {activeTeams.map((name, i) => {
          const color = TEAM_COLORS[name];
          const sk = scoreKeys[i];
          const isWinner = game.series_winner === name;
          return (
            <div key={name} className={`score-col ${isWinner ? 'winner' : ''}`}>
              <div className="score-team-label" style={{ color }}>
                {name}
                {isWinner && <span className="winner-crown"> 👑</span>}
              </div>
              {isAdmin ? (
                <input
                  type="number"
                  className="score-input"
                  style={{ borderColor: isWinner ? color : '#ddd' }}
                  value={game[sk]}
                  onChange={(e) => onUpdate(sk, e.target.value)}
                  placeholder="0"
                  min="0"
                />
              ) : (
                <div className="score-display" style={{ color: isWinner ? color : '#555', fontWeight: isWinner ? 'bold' : 'normal' }}>
                  {game[sk] !== '' ? game[sk] : '-'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 승자 선택 (관리자) */}
      {isAdmin && (
        <div className="winner-row">
          <span className="winner-label">승자</span>
          <div className="winner-chips">
            {activeTeams.map((name) => {
              const color = TEAM_COLORS[name];
              const selected = game.series_winner === name;
              return (
                <button
                  key={name}
                  className={`winner-chip ${selected ? 'selected' : ''}`}
                  style={selected
                    ? { background: color, borderColor: color, color: 'white' }
                    : { borderColor: color, color }}
                  onClick={() => onUpdate('series_winner', selected ? '' : name)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 승자 표시 (일반) */}
      {!isAdmin && game.series_winner && (
        <div className="winner-badge" style={{ background: TEAM_COLORS[game.series_winner] + '20', color: TEAM_COLORS[game.series_winner] }}>
          👑 {game.series_winner}팀 승리
        </div>
      )}
    </div>
  );
}

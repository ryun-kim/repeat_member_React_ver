import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './TeamPage.css';

// ─── 팀 색상 ──────────────────────────────────────────────────
const TEAM_COLORS = {
  그린:   '#2e7d32',
  화이트: '#546e7a',
  레드:   '#d32f2f',
  오렌지: '#f57c00',
};

const TEAM_NAMES = ['그린', '화이트', '레드', '오렌지'];

// ─── 포지션 색상 ──────────────────────────────────────────────
const DETAIL_POS_COLOR = {
  '포인트 가드': '#2e7d32', '슈팅 가드': '#f9a825',
  '스몰 포워드': '#1565c0', '파워 포워드': '#6a1b9a', '센터': '#c62828',
};
const DETAIL_POS_ABBR = {
  '포인트 가드': 'PG', '슈팅 가드': 'SG',
  '스몰 포워드': 'SF', '파워 포워드': 'PF', '센터': 'C',
};
const POS_COLOR = { '가드': '#1565c0', '포워드': '#2e7d32', '센터': '#6a1b9a' };

function posInfo(p) {
  const color = p.detail_position
    ? DETAIL_POS_COLOR[p.detail_position] ?? '#999'
    : POS_COLOR[p.position] ?? null;
  const label = p.detail_position
    ? DETAIL_POS_ABBR[p.detail_position] ?? p.detail_position
    : p.position ?? null;
  return { color, label };
}

// ─── 자동분배 알고리즘 (Flutter autoDivide 동일) ──────────────
function autoDivide(attendingProfiles, guests, teamMode) {
  const teams = Array.from({ length: teamMode }, () => []);
  const posCounts = {
    가드: Array(teamMode).fill(0),
    포워드: Array(teamMode).fill(0),
    센터: Array(teamMode).fill(0),
    기타: Array(teamMode).fill(0),
  };
  const epauletteCounts = Array(teamMode).fill(0);
  let startTeam = Math.floor(Math.random() * teamMode);

  function posKey(position) {
    return ['가드', '포워드', '센터'].includes(position) ? position : '기타';
  }

  function assignOne(id, position) {
    const pk = posKey(position);
    let best = startTeam;
    for (let i = 0; i < teamMode; i++) {
      const idx = (startTeam + i) % teamMode;
      const bestPos = posCounts[pk][best];
      const candPos = posCounts[pk][idx];
      if (candPos < bestPos || (candPos === bestPos && teams[idx].length < teams[best].length)) {
        best = idx;
      }
    }
    teams[best].push(id);
    posCounts[pk][best]++;
    startTeam = (best + 1) % teamMode;
  }

  function assignEpauletteOne(id, position) {
    const pk = posKey(position);
    let best = startTeam;
    for (let i = 0; i < teamMode; i++) {
      const idx = (startTeam + i) % teamMode;
      const bestEp = epauletteCounts[best];
      const candEp = epauletteCounts[idx];
      if (candEp < bestEp) {
        best = idx;
      } else if (candEp === bestEp) {
        const bestPos = posCounts[pk][best];
        const candPos = posCounts[pk][idx];
        if (candPos < bestPos || (candPos === bestPos && teams[idx].length < teams[best].length)) {
          best = idx;
        }
      }
    }
    teams[best].push(id);
    posCounts[pk][best]++;
    epauletteCounts[best]++;
    startTeam = (best + 1) % teamMode;
  }

  // 1단계: 견장 회원 먼저
  const epaulette = attendingProfiles.filter((p) => p.has_epaulette);
  epaulette.sort(() => Math.random() - 0.5);
  epaulette.forEach((p) => assignEpauletteOne(p.id, p.position));

  // 2단계: 나머지 + 게스트
  const normal = [
    ...attendingProfiles.filter((p) => !p.has_epaulette).map((p) => ({ id: p.id, position: p.position })),
    ...guests.map((g) => ({ id: g.id, position: g.position })),
  ];

  const groups = {
    가드:   normal.filter((p) => p.position === '가드').sort(() => Math.random() - 0.5),
    포워드: normal.filter((p) => p.position === '포워드').sort(() => Math.random() - 0.5),
    센터:   normal.filter((p) => p.position === '센터').sort(() => Math.random() - 0.5),
    기타:   normal.filter((p) => !['가드','포워드','센터'].includes(p.position)).sort(() => Math.random() - 0.5),
  };

  const maxRounds = Math.max(...Object.values(groups).map((g) => g.length), 0);
  for (let round = 0; round < maxRounds; round++) {
    for (const [pk, group] of Object.entries(groups)) {
      if (round >= group.length) continue;
      assignOne(group[round].id, pk === '기타' ? null : pk);
    }
  }

  return {
    team_a: teams[0],
    team_b: teams[1],
    team_c: teamMode >= 3 ? teams[2] : [],
    team_d: teamMode >= 4 ? teams[3] : [],
  };
}

// ─── 능력치 점수 계산 ─────────────────────────────────────────
function teamScores(ids, abilityMap) {
  let attackSum = 0, defenseSum = 0, count = 0;
  ids.forEach((id) => {
    const a = abilityMap[id];
    if (!a) return;
    attackSum += a.under_basket + a.mid_range + a.three_point + a.passing + a.speed;
    defenseSum += a.lateral_defense + a.vertical_defense + a.stamina;
    count++;
  });
  if (count === 0) return null;
  return { attack: attackSum / count / 5, defense: defenseSum / count / 3 };
}

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function TeamPage() {
  const { profile: myProfile } = useAuth();
  const isAdmin = myProfile?.role === 'admin';

  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [profileMap, setProfileMap] = useState({});
  const [abilityMap, setAbilityMap] = useState({});
  const [attending, setAttending] = useState([]);
  const [config, setConfig] = useState(null);     // { id, team_mode, team_a, team_b, team_c, team_d, guests }
  const [teamMode, setTeamMode] = useState(2);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);

  // 기본 데이터 로드
  useEffect(() => {
    (async () => {
      const [{ data: evList }, { data: pList }, { data: aList }] = await Promise.all([
        supabase.from('events').select().order('date', { ascending: false }),
        supabase.from('profiles').select(),
        supabase.from('member_abilities').select(),
      ]);
      setEvents(evList ?? []);
      const pm = {};
      (pList ?? []).forEach((p) => { pm[p.id] = p; });
      setProfileMap(pm);
      const am = {};
      (aList ?? []).forEach((a) => { am[a.profile_id] = a; });
      setAbilityMap(am);

      // 가장 최근 일정 자동 선택
      if (evList?.length) {
        const recent = [...evList].sort((a, b) => b.date.localeCompare(a.date))[0];
        setSelectedEvent(recent);
      }
      setLoading(false);
    })();
  }, []);

  // 일정 변경 시 출석 + 팀 구성 로드
  const loadEventData = useCallback(async (event) => {
    if (!event) return;
    const [{ data: attList }, { data: teamData }] = await Promise.all([
      supabase.from('attendance').select('profile_id').eq('event_id', event.id).eq('status', '참석'),
      supabase.from('team_configurations').select().eq('event_id', event.id).maybeSingle(),
    ]);

    const attendingIds = (attList ?? []).map((a) => a.profile_id);
    setAttending(attendingIds);

    if (teamData) {
      setConfig(teamData);
      setTeamMode(teamData.team_mode);
    } else {
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    loadEventData(selectedEvent);
  }, [selectedEvent, loadEventData]);

  const handleEventChange = (e) => {
    const ev = events.find((ev) => ev.id === e.target.value);
    setSelectedEvent(ev ?? null);
  };

  const handleAutoDivide = () => {
    const attendingProfiles = attending.map((id) => profileMap[id]).filter(Boolean);
    const guests = config?.guests ?? [];
    const result = autoDivide(attendingProfiles, guests, teamMode);
    setConfig((prev) => ({
      id: prev?.id ?? '',
      event_id: selectedEvent.id,
      team_mode: teamMode,
      guests: prev?.guests ?? [],
      ...result,
    }));
  };

  const handleTeamModeChange = (n) => {
    setTeamMode(n);
    if (config) {
      const attendingProfiles = attending.map((id) => profileMap[id]).filter(Boolean);
      const guests = config.guests ?? [];
      const result = autoDivide(attendingProfiles, guests, n);
      setConfig((prev) => ({ ...prev, team_mode: n, ...result }));
    }
  };

  const handleSave = async () => {
    if (!config || !selectedEvent) return;
    setSaving(true);
    const data = {
      event_id: selectedEvent.id,
      team_mode: teamMode,
      team_a: config.team_a ?? [],
      team_b: config.team_b ?? [],
      team_c: config.team_c ?? [],
      team_d: config.team_d ?? [],
      guests: config.guests ?? [],
    };
    if (config.id) {
      await supabase.from('team_configurations').upsert({ id: config.id, ...data }, { onConflict: 'event_id' });
    } else {
      const { data: saved } = await supabase.from('team_configurations').insert(data).select().single();
      if (saved) setConfig(saved);
    }
    setSaving(false);
    alert('저장되었습니다');
  };

  const handleAddGuest = () => {
    if (!guestName.trim()) return;
    const guest = { id: `guest_${Date.now()}`, name: guestName.trim(), position: null };
    setConfig((prev) => ({ ...prev, guests: [...(prev?.guests ?? []), guest] }));
    setGuestName('');
    setShowGuestInput(false);
  };

  const handleRemoveGuest = (guestId) => {
    setConfig((prev) => ({
      ...prev,
      team_a: (prev.team_a ?? []).filter((id) => id !== guestId),
      team_b: (prev.team_b ?? []).filter((id) => id !== guestId),
      team_c: (prev.team_c ?? []).filter((id) => id !== guestId),
      team_d: (prev.team_d ?? []).filter((id) => id !== guestId),
      guests: (prev.guests ?? []).filter((g) => g.id !== guestId),
    }));
  };

  const activeTeams = TEAM_NAMES.slice(0, teamMode);
  const teamKeys = ['team_a', 'team_b', 'team_c', 'team_d'];
  const guestMap = Object.fromEntries((config?.guests ?? []).map((g) => [g.id, g]));

  const formatDate = (dateStr) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });

  if (loading) return <div className="team-loading">로딩중...</div>;

  return (
    <div className="team-page">
      {/* 일정 선택 */}
      <div className="team-controls">
        <select className="event-select" value={selectedEvent?.id ?? ''} onChange={handleEventChange}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}  {formatDate(e.date)}
            </option>
          ))}
        </select>

        {/* 팀 수 + 참석 인원 */}
        <div className="mode-row">
          <div className="mode-btns">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                className={`mode-btn ${teamMode === n ? 'active' : ''}`}
                onClick={() => handleTeamModeChange(n)}
              >{n}팀</button>
            ))}
          </div>
          <div className="attend-count">
            참석 {attending.length}명
            {(config?.guests?.length ?? 0) > 0 && ` +게스트 ${config.guests.length}명`}
          </div>
          {isAdmin && config && (
            <button className="guest-btn" onClick={() => setShowGuestInput((v) => !v)}>
              + 게스트
            </button>
          )}
        </div>

        {/* 게스트 추가 입력 */}
        {showGuestInput && (
          <div className="guest-input-row">
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="게스트 이름"
              onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
              autoFocus
            />
            <button onClick={handleAddGuest} className="save-btn-sm">추가</button>
            <button onClick={() => setShowGuestInput(false)} className="cancel-btn-sm">취소</button>
          </div>
        )}
      </div>

      {/* 팀 분배 영역 */}
      {!config ? (
        <div className="team-empty">
          {selectedEvent
            ? isAdmin
              ? <p>자동분배 버튼을 눌러 팀을 나눠보세요</p>
              : <p>아직 팀이 구성되지 않았습니다</p>
            : <p>일정을 선택해 주세요</p>}
        </div>
      ) : (
        <div className={`team-grid cols-${teamMode <= 2 ? teamMode : 2}`}>
          {activeTeams.map((name, i) => {
            const ids = config[teamKeys[i]] ?? [];
            const profiles = ids.map((id) => profileMap[id]).filter(Boolean);
            const guests = ids.map((id) => guestMap[id]).filter(Boolean);
            const scores = teamScores(ids.filter((id) => profileMap[id]), abilityMap);
            const color = TEAM_COLORS[name];

            return (
              <TeamColumn
                key={name}
                name={name}
                color={color}
                profiles={profiles}
                guests={guests}
                scores={scores}
                isAdmin={isAdmin}
                onRemoveGuest={handleRemoveGuest}
              />
            );
          })}
        </div>
      )}

      {/* 하단 버튼 (관리자) */}
      {isAdmin && selectedEvent && (
        <div className="team-footer">
          <button className="divide-btn" onClick={handleAutoDivide}>
            🔀 자동분배
          </button>
          <button className="save-btn-main" onClick={handleSave} disabled={!config || saving}>
            {saving ? '저장중...' : '💾 저장'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 팀 컬럼 ──────────────────────────────────────────────────
function TeamColumn({ name, color, profiles, guests, scores, isAdmin, onRemoveGuest }) {
  return (
    <div className="team-col" style={{ borderColor: color + '66' }}>
      {/* 헤더 */}
      <div className="team-col-header" style={{ background: color }}>
        <div className="team-col-title">{name}팀 ({profiles.length + guests.length}명)</div>
        {scores && (
          <div className="team-col-scores">
            공격 {scores.attack.toFixed(1)} · 수비 {scores.defense.toFixed(1)}
          </div>
        )}
      </div>

      {/* 멤버 */}
      <div className="team-col-members">
        {profiles.map((p) => <MemberChip key={p.id} profile={p} teamColor={color} />)}
        {guests.map((g) => (
          <GuestChip
            key={g.id}
            guest={g}
            teamColor={color}
            isAdmin={isAdmin}
            onRemove={() => onRemoveGuest(g.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 멤버 칩 ──────────────────────────────────────────────────
function MemberChip({ profile: p, teamColor }) {
  const { color, label } = posInfo(p);
  return (
    <div className="member-chip" style={{ background: teamColor + '14' }}>
      {p.has_epaulette && <span className="chip-epaulette">🎖</span>}
      <span className="chip-name">{p.nickname}</span>
      {label && (
        <span className="chip-pos" style={{ background: color }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ─── 게스트 칩 ────────────────────────────────────────────────
function GuestChip({ guest, teamColor, isAdmin, onRemove }) {
  return (
    <div className="member-chip guest-chip">
      <span className="chip-name">{guest.name}</span>
      <span className="chip-pos" style={{ background: '#f9a825' }}>G</span>
      {isAdmin && (
        <button className="chip-remove" onClick={onRemove} title="게스트 제거">×</button>
      )}
    </div>
  );
}

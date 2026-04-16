import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AbilityEditModal from '../components/AbilityEditModal';
import EpauletteModal from '../components/EpauletteModal';
import './MemberPage.css';

// ─── 포지션 색상 ──────────────────────────────────────────────
const DETAIL_POS_COLOR = {
  '포인트 가드': '#2e7d32',
  '슈팅 가드':  '#f9a825',
  '스몰 포워드': '#1565c0',
  '파워 포워드': '#6a1b9a',
  '센터':       '#c62828',
};
const DETAIL_POS_ABBR = {
  '포인트 가드': 'PG', '슈팅 가드': 'SG',
  '스몰 포워드': 'SF', '파워 포워드': 'PF', '센터': 'C',
};
const POS_COLOR = { '가드': '#1565c0', '포워드': '#2e7d32', '센터': '#6a1b9a' };

function posColor(p) {
  return p.detail_position
    ? DETAIL_POS_COLOR[p.detail_position] ?? '#999'
    : POS_COLOR[p.position] ?? '#999';
}
function posLabel(p) {
  return p.detail_position
    ? DETAIL_POS_ABBR[p.detail_position] ?? p.detail_position
    : p.position ?? null;
}

// ─── 통계 계산 (Flutter MemberStats.fromRecords 동일) ─────────
function calcStats(records) {
  if (!records.length) return { wins: 0, losses: 0, winRate: 0, winningSeries: 0, recentGames: [] };

  const sorted = [...records].sort((a, b) => {
    const d = b.match_date.localeCompare(a.match_date);
    return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
  });

  const wins = sorted.filter((r) => r.result === '승').length;
  const losses = sorted.length - wins;
  const winRate = sorted.length === 0 ? 0 : (wins / sorted.length) * 100;

  // 날짜별 그룹핑
  const byDay = {};
  sorted.forEach((r) => {
    const key = r.match_date.slice(0, 10);
    if (!byDay[key]) byDay[key] = [0, 0];
    if (r.result === '승') byDay[key][0]++;
    else byDay[key][1]++;
  });
  const dayKeys = Object.keys(byDay).sort((a, b) => b.localeCompare(a));

  // 연속 위닝시리즈
  let series = 0;
  for (const key of dayKeys) {
    const [w, l] = byDay[key];
    if (w > l) series++;
    else break;
  }

  // 최근 5일
  const recentGames = dayKeys.slice(0, 5).map((key) => {
    const [w, l] = byDay[key];
    if (w > l) return '승';
    if (l > w) return '패';
    return '무';
  });

  return { wins, losses, winRate, winningSeries: series, recentGames };
}

// ─── 출석률 계산 ──────────────────────────────────────────────
function calcAttendRate(attendances, totalEvents) {
  if (totalEvents === 0) return 0;
  const attended = attendances.filter((a) => a.status === '참석').length;
  return (attended / totalEvents) * 100;
}

const SORT_OPTIONS = [
  { key: 'name',     label: '이름순' },
  { key: 'winRate',  label: '승률순' },
  { key: 'wins',     label: '승수순' },
  { key: 'losses',   label: '패수순' },
  { key: 'series',   label: '연승순' },
  { key: 'attend',   label: '출석순' },
];

export default function MemberPage() {
  const { user, profile: myProfile } = useAuth();
  const isAdmin = myProfile?.role === 'admin';

  const [profiles, setProfiles] = useState([]);
  const [records, setRecords] = useState({});       // profileId → records[]
  const [abilities, setAbilities] = useState({});   // profileId → ability
  const [attendMap, setAttendMap] = useState({});   // profileId → attendances[]
  const [totalEvents, setTotalEvents] = useState(0);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sortKey, setSortKey] = useState('name');
  const [loading, setLoading] = useState(true);

  const [abilityModal, setAbilityModal] = useState(null);   // profile
  const [epauletteModal, setEpauletteModal] = useState(null); // profile

  // 전체 데이터 로드
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [
        { data: pList },
        { data: rList },
        { data: aList },
        { data: attList },
        { data: evList },
      ] = await Promise.all([
        supabase.from('profiles').select().order('created_at'),
        supabase.from('members_record').select(),
        supabase.from('member_abilities').select(),
        supabase.from('attendance').select('profile_id, status, event_id'),
        supabase.from('events').select('id, date'),
      ]);

      setProfiles(pList ?? []);

      // 연도 목록 추출
      const yearSet = new Set((rList ?? []).map((r) => r.match_date?.slice(0, 4)).filter(Boolean).map(Number));
      (evList ?? []).forEach((e) => yearSet.add(new Date(e.date + 'T00:00:00').getFullYear()));
      const sortedYears = [...yearSet].sort((a, b) => b - a);
      setYears(sortedYears);

      // records: profileId → []
      const recMap = {};
      (rList ?? []).forEach((r) => {
        if (!recMap[r.profile_id]) recMap[r.profile_id] = [];
        recMap[r.profile_id].push(r);
      });
      setRecords(recMap);

      // abilities: profileId → obj
      const abilMap = {};
      (aList ?? []).forEach((a) => { abilMap[a.profile_id] = a; });
      setAbilities(abilMap);

      // attendance: profileId → []
      const attMap = {};
      (attList ?? []).forEach((a) => {
        if (!attMap[a.profile_id]) attMap[a.profile_id] = [];
        attMap[a.profile_id].push(a);
      });
      setAttendMap(attMap);

      // 총 이벤트 수
      setTotalEvents((evList ?? []).length);

      setLoading(false);
    })();
  }, []);

  // 시즌 필터 적용 통계
  const summaries = useMemo(() => {
    return profiles.map((p) => {
      const allRec = records[p.id] ?? [];
      const filtered = selectedYear === null
        ? allRec
        : allRec.filter((r) => r.match_date?.startsWith(String(selectedYear)));

      const stats = calcStats(filtered);

      // 출석률
      const myAtt = attendMap[p.id] ?? [];
      const attRate = calcAttendRate(myAtt, totalEvents);

      return { profile: p, stats, attRate, ability: abilities[p.id] ?? null };
    });
  }, [profiles, records, abilities, attendMap, totalEvents, selectedYear]);

  // 정렬
  const sorted = useMemo(() => {
    const arr = [...summaries];
    switch (sortKey) {
      case 'name':    arr.sort((a, b) => a.profile.nickname.localeCompare(b.profile.nickname)); break;
      case 'winRate': arr.sort((a, b) => b.stats.winRate - a.stats.winRate); break;
      case 'wins':    arr.sort((a, b) => b.stats.wins - a.stats.wins); break;
      case 'losses':  arr.sort((a, b) => b.stats.losses - a.stats.losses); break;
      case 'series':  arr.sort((a, b) => b.stats.winningSeries - a.stats.winningSeries); break;
      case 'attend':  arr.sort((a, b) => b.attRate - a.attRate); break;
    }
    return arr;
  }, [summaries, sortKey]);

  const handleEpauletteSaved = async () => {
    const { data } = await supabase.from('profiles').select().order('created_at');
    setProfiles(data ?? []);
    setEpauletteModal(null);
  };

  const handleAbilitySaved = async () => {
    const { data } = await supabase.from('member_abilities').select();
    const abilMap = {};
    (data ?? []).forEach((a) => { abilMap[a.profile_id] = a; });
    setAbilities(abilMap);
    setAbilityModal(null);
  };

  if (loading) return <div className="center-loading">로딩중...</div>;

  return (
    <div className="member-page">
      {/* 시즌 필터 */}
      <div className="season-bar">
        <span className="bar-title">시즌</span>
        <div className="chip-row">
          <button
            className={`chip ${selectedYear === null ? 'active' : ''}`}
            onClick={() => setSelectedYear(null)}
          >전체</button>
          {years.map((y) => (
            <button
              key={y}
              className={`chip ${selectedYear === y ? 'active' : ''}`}
              onClick={() => setSelectedYear(y)}
            >{y}년</button>
          ))}
        </div>
      </div>

      {/* 정렬 */}
      <div className="sort-bar">
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.key}
            className={`chip ${sortKey === s.key ? 'active' : ''}`}
            onClick={() => setSortKey(s.key)}
          >{s.label}</button>
        ))}
      </div>

      {/* 멤버 카드 목록 */}
      <div className="member-list">
        {sorted.map(({ profile: p, stats, attRate, ability }) => {
          const isMe = p.id === user?.id;
          const pc = posColor(p);
          const pl = posLabel(p);

          return (
            <div key={p.id} className="member-card">
              {/* 상단 헤더 */}
              <div className="card-top">
                <div className="avatar" style={{ background: pc + '26', color: pc }}>
                  {p.nickname[0]}
                </div>
                <div className="name-row">
                  <span className="nickname">{p.nickname}</span>
                  {isMe && <span className="badge me">나</span>}
                  {pl && (
                    <span className="badge pos" style={{ background: pc }}>
                      {pl}
                    </span>
                  )}
                </div>
                <div className="card-actions">
                  {/* 견장 아이콘 - 견장 있거나 관리자면 표시 */}
                  {(p.has_epaulette || isAdmin) && (
                    <button
                      className="icon-btn"
                      onClick={() => isAdmin && setEpauletteModal(p)}
                      style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                      title="견장"
                    >
                      <span style={{ color: p.has_epaulette ? '#ffb300' : '#ccc', fontSize: 20 }}>
                        🎖
                      </span>
                    </button>
                  )}
                  {/* 능력치 편집 (관리자 또는 본인) */}
                  {(isAdmin || isMe) && (
                    <button
                      className="icon-btn"
                      onClick={() => setAbilityModal({ profile: p, ability })}
                      title="능력치 편집"
                    >🏀</button>
                  )}
                </div>
              </div>

              <div className="card-divider" />

              {/* 통계 */}
              <div className="stats-row">
                <StatItem label="승률" value={`${stats.winRate.toFixed(1)}%`} color="#1976d2" />
                <StatItem label="승" value={stats.wins} color="#1976d2" />
                <StatItem label="패" value={stats.losses} color="#d32f2f" />
                <StatItem label="위닝" value={stats.winningSeries} color="#1565c0" />
                <StatItem label="출석" value={`${attRate.toFixed(0)}%`} color="#00796b" />
              </div>

              {/* 최근 5경기 */}
              {stats.recentGames.length > 0 && (
                <div className="recent-row">
                  <span className="recent-label">최근</span>
                  {stats.recentGames.map((g, i) => (
                    <span
                      key={i}
                      className="recent-circle"
                      style={{
                        background: g === '승' ? '#1976d2' : g === '패' ? '#d32f2f' : '#9e9e9e',
                      }}
                    >{g}</span>
                  ))}
                </div>
              )}

              {/* 능력치 배지 */}
              {ability && (
                <div className="ability-row">
                  {[
                    ['골밑', ability.under_basket],
                    ['미들', ability.mid_range],
                    ['3점', ability.three_point],
                    ['가로', ability.lateral_defense],
                    ['세로', ability.vertical_defense],
                    ['패스', ability.passing],
                    ['속도', ability.speed],
                    ['체력', ability.stamina],
                  ].map(([label, val]) => (
                    <AbilityBadge key={label} label={label} value={val} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 능력치 편집 모달 */}
      {abilityModal && (
        <AbilityEditModal
          profile={abilityModal.profile}
          ability={abilityModal.ability}
          onClose={() => setAbilityModal(null)}
          onSaved={handleAbilitySaved}
        />
      )}

      {/* 견장 모달 */}
      {epauletteModal && (
        <EpauletteModal
          profile={epauletteModal}
          onClose={() => setEpauletteModal(null)}
          onSaved={handleEpauletteSaved}
        />
      )}
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div className="stat-item">
      <span className="stat-value" style={{ color }}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function AbilityBadge({ label, value }) {
  const color = value >= 8 ? '#2e7d32' : value >= 5 ? '#1565c0' : '#c62828';
  return (
    <span className="ability-badge">
      <span className="ability-label">{label}</span>
      <span className="ability-value" style={{ color }}>{value}</span>
    </span>
  );
}

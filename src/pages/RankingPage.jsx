import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import './RankingPage.css';

// ─── 통계 계산 (MemberPage와 동일) ───────────────────────────
function calcStats(records) {
  if (!records.length) return { wins: 0, losses: 0, winRate: 0, winningSeries: 0 };

  const sorted = [...records].sort((a, b) => {
    const d = b.match_date.localeCompare(a.match_date);
    return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
  });

  const wins = sorted.filter((r) => r.result === '승').length;
  const losses = sorted.length - wins;
  const winRate = sorted.length === 0 ? 0 : (wins / sorted.length) * 100;

  const byDay = {};
  sorted.forEach((r) => {
    const key = r.match_date.slice(0, 10);
    if (!byDay[key]) byDay[key] = [0, 0];
    if (r.result === '승') byDay[key][0]++;
    else byDay[key][1]++;
  });
  const dayKeys = Object.keys(byDay).sort((a, b) => b.localeCompare(a));

  let series = 0;
  for (const key of dayKeys) {
    const [w, l] = byDay[key];
    if (w > l) series++;
    else break;
  }

  return { wins, losses, winRate, winningSeries: series };
}

function calcAttendRate(attendances, totalEvents) {
  if (totalEvents === 0) return 0;
  const attended = attendances.filter((a) => a.status === '참석').length;
  return (attended / totalEvents) * 100;
}

// ─── 메달 설정 ────────────────────────────────────────────────
const MEDALS = [
  { emoji: '🥇', color: '#FFD700', bg: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.4)' },
  { emoji: '🥈', color: '#9E9E9E', bg: 'rgba(158,158,158,0.06)', border: 'rgba(158,158,158,0.3)' },
  { emoji: '🥉', color: '#CD7F32', bg: 'rgba(205,127,50,0.06)', border: 'rgba(205,127,50,0.3)' },
];

const RANKING_SECTIONS = [
  {
    key: 'wins',
    title: '승리 랭킹',
    subtitle: '총 승리 수',
    icon: '🏆',
    iconBg: 'rgba(255,179,0,0.12)',
    iconColor: '#f9a825',
    getValue: (s) => s.stats.wins,
    formatValue: (v) => `${v}승`,
  },
  {
    key: 'series',
    title: '위닝시리즈 랭킹',
    subtitle: '현재 연속 위닝',
    icon: '🔥',
    iconBg: 'rgba(230,74,25,0.12)',
    iconColor: '#e64a19',
    getValue: (s) => s.stats.winningSeries,
    formatValue: (v) => `${v}연승`,
  },
  {
    key: 'winRate',
    title: '승률 랭킹',
    subtitle: '총 경기 대비 승률',
    icon: '📈',
    iconBg: 'rgba(25,118,210,0.12)',
    iconColor: '#1976d2',
    getValue: (s) => s.stats.winRate,
    formatValue: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'attend',
    title: '출석률 랭킹',
    subtitle: '전체 일정 출석률',
    icon: '📅',
    iconBg: 'rgba(0,121,107,0.12)',
    iconColor: '#00796b',
    getValue: (s) => s.attRate,
    formatValue: (v) => `${v.toFixed(1)}%`,
  },
];

export default function RankingPage() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { data: profiles },
        { data: records },
        { data: attendances },
        { data: events },
      ] = await Promise.all([
        supabase.from('profiles').select('id, nickname, position, detail_position'),
        supabase.from('member_records').select(),
        supabase.from('attendance').select('profile_id, status'),
        supabase.from('events').select('id'),
      ]);

      const totalEvents = (events ?? []).length;

      const recMap = {};
      (records ?? []).forEach((r) => {
        if (!recMap[r.profile_id]) recMap[r.profile_id] = [];
        recMap[r.profile_id].push(r);
      });

      const attMap = {};
      (attendances ?? []).forEach((a) => {
        if (!attMap[a.profile_id]) attMap[a.profile_id] = [];
        attMap[a.profile_id].push(a);
      });

      const data = (profiles ?? []).map((p) => ({
        profile: p,
        stats: calcStats(recMap[p.id] ?? []),
        attRate: calcAttendRate(attMap[p.id] ?? [], totalEvents),
      }));

      setSummaries(data);
      setLoading(false);
    })();
  }, []);

  const top3 = (getValue) =>
    [...summaries]
      .sort((a, b) => getValue(b) - getValue(a))
      .slice(0, 3);

  if (loading) return <div className="rank-loading">로딩중...</div>;

  return (
    <div className="ranking-page">
      {RANKING_SECTIONS.map((section) => {
        const entries = top3(section.getValue);
        return (
          <div key={section.key} className="rank-card">
            {/* 섹션 헤더 */}
            <div className="rank-header">
              <div className="rank-icon" style={{ background: section.iconBg }}>
                <span style={{ fontSize: 22 }}>{section.icon}</span>
              </div>
              <div>
                <div className="rank-title">{section.title}</div>
                <div className="rank-subtitle">{section.subtitle}</div>
              </div>
            </div>

            {/* TOP 3 */}
            <div className="rank-entries">
              {entries.length === 0 ? (
                <div className="rank-empty">데이터 없음</div>
              ) : (
                entries.map((entry, i) => {
                  const medal = MEDALS[i];
                  const value = section.getValue(entry);
                  return (
                    <RankRow
                      key={entry.profile.id}
                      rank={i + 1}
                      medal={medal}
                      profile={entry.profile}
                      value={section.formatValue(value)}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 랭킹 행 ─────────────────────────────────────────────────
const DETAIL_POS_COLOR = {
  '포인트 가드': '#2e7d32', '슈팅 가드': '#f9a825',
  '스몰 포워드': '#1565c0', '파워 포워드': '#6a1b9a', '센터': '#c62828',
};
const POS_COLOR = { '가드': '#1565c0', '포워드': '#2e7d32', '센터': '#6a1b9a' };

function posColor(p) {
  return p.detail_position
    ? DETAIL_POS_COLOR[p.detail_position] ?? '#999'
    : POS_COLOR[p.position] ?? '#999';
}

function RankRow({ rank, medal, profile, value }) {
  const pc = posColor(profile);
  const isFirst = rank === 1;

  return (
    <div
      className={`rank-row ${isFirst ? 'first' : ''}`}
      style={{
        background: medal.bg,
        border: isFirst ? `1px solid ${medal.border}` : '1px solid transparent',
      }}
    >
      {/* 메달 */}
      <div className="rank-medal" style={{ fontSize: isFirst ? 24 : 20 }}>
        {medal.emoji}
      </div>

      {/* 아바타 */}
      <div
        className="rank-avatar"
        style={{ background: pc + '26', color: pc }}
      >
        {profile.nickname[0]}
      </div>

      {/* 닉네임 */}
      <span className={`rank-name ${isFirst ? 'bold' : ''}`}>
        {profile.nickname}
      </span>

      {/* 값 */}
      <span
        className="rank-value"
        style={{ background: medal.bg, color: medal.color, border: `1px solid ${medal.border}` }}
      >
        {value}
      </span>
    </div>
  );
}

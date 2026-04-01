import { useState, useEffect, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AttendanceModal from '../components/AttendanceModal';
import './CalendarPage.css';

export default function CalendarPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // 전체 일정 로드
  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select()
      .order('date');
    if (!error) setEvents(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEvents();

    // Supabase Realtime 구독
    const channel = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadEvents)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [loadEvents]);

  // 날짜별 일정 모음
  const eventsOnDate = (date) => {
    const key = toDateKey(date);
    return events.filter((e) => e.date === key);
  };

  // 선택된 날짜의 일정
  const selectedEvents = eventsOnDate(selectedDate);

  // 달력에 마커 표시
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const dayEvents = eventsOnDate(date);
    if (dayEvents.length === 0) return null;
    return (
      <div className="tile-dots">
        {dayEvents.slice(0, 3).map((e) => (
          <span
            key={e.id}
            className="tile-dot"
            style={{ background: e.color ?? '#1565c0' }}
          />
        ))}
      </div>
    );
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('일정을 삭제할까요?')) return;
    await supabase.from('events').delete().eq('id', eventId);
    loadEvents();
  };

  if (loading) return <div className="center-loading">로딩중...</div>;

  return (
    <div className="calendar-page">
      {/* 달력 */}
      <div className="calendar-wrapper">
        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
          locale="ko-KR"
          tileContent={tileContent}
          formatDay={(_, date) => date.getDate()}
        />
      </div>

      {/* 선택 날짜 헤더 */}
      <div className="date-header">
        <span className="date-label">{formatDate(selectedDate)}</span>
        {isAdmin && (
          <button className="add-btn" onClick={() => setShowAddModal(true)}>
            + 일정 추가
          </button>
        )}
      </div>

      {/* 일정 목록 */}
      <div className="event-list">
        {selectedEvents.length === 0 ? (
          <div className="empty-state">
            <span>📋</span>
            <p>일정이 없습니다</p>
          </div>
        ) : (
          selectedEvents.map((event) => (
            <div
              key={event.id}
              className="event-card"
              onClick={() => setSelectedEvent(event)}
            >
              <div
                className="event-color-bar"
                style={{ background: event.color ?? '#1565c0' }}
              />
              <div className="event-info">
                <span className="event-title">{event.title}</span>
                <span className="event-date">{formatDate(new Date(event.date + 'T00:00:00'))}</span>
              </div>
              {isAdmin && (
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(event.id);
                  }}
                >
                  🗑
                </button>
              )}
              <span className="event-arrow">›</span>
            </div>
          ))
        )}
      </div>

      {/* 일정 추가 모달 */}
      {showAddModal && (
        <AddEventModal
          initialDate={selectedDate}
          onClose={() => setShowAddModal(false)}
          onSaved={loadEvents}
        />
      )}

      {/* 출석 모달 */}
      {selectedEvent && (
        <AttendanceModal
          event={selectedEvent}
          isAdmin={isAdmin}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

// ─── 일정 추가 모달 ────────────────────────────────────────────
function AddEventModal({ initialDate, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toDateKey(initialDate));
  const [color, setColor] = useState('#1565C0');
  const [saving, setSaving] = useState(false);

  const colors = [
    { hex: '#1565C0', label: '파랑' },
    { hex: '#E53935', label: '빨강' },
    { hex: '#43A047', label: '초록' },
    { hex: '#FB8C00', label: '주황' },
    { hex: '#8E24AA', label: '보라' },
    { hex: '#00897B', label: '청록' },
  ];

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await supabase.from('events').insert({ title: title.trim(), date, color });
    onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>일정 추가</h3>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="일정 제목"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>색상</label>
            <div className="color-picker">
              {colors.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`color-dot ${color === c.hex ? 'selected' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>취소</button>
            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? '저장중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 유틸 ─────────────────────────────────────────────────────
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(date) {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

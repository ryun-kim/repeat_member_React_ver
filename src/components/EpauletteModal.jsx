import { useState } from 'react';
import { supabase } from '../lib/supabase';
import './AbilityEditModal.css';

export default function EpauletteModal({ profile, onClose, onSaved }) {
  const [hasEpaulette, setHasEpaulette] = useState(profile.has_epaulette ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ has_epaulette: hasEpaulette }).eq('id', profile.id);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ability-modal" onClick={(e) => e.stopPropagation()}>
        <h3>🎖 {profile.nickname} 견장</h3>

        <div style={{
          background: 'rgba(255,179,0,0.08)',
          border: '1px solid rgba(255,179,0,0.3)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 20,
          fontSize: 13,
          color: '#b8860b',
          lineHeight: 1.5,
        }}>
          견장 회원은 팀 자동분배 시 각 팀에 균등하게 배정됩니다.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 24 }}>
          <input
            type="checkbox"
            checked={hasEpaulette}
            onChange={(e) => setHasEpaulette(e.target.checked)}
            style={{ width: 20, height: 20, accentColor: '#ffb300', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            견장 {hasEpaulette ? '보유 중 🎖' : '없음'}
          </span>
        </label>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose} disabled={saving}>취소</button>
          <button
            className="save-btn"
            style={{ background: '#f9a825' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '저장중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

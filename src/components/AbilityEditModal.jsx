import { useState } from 'react';
import { supabase } from '../lib/supabase';
import './AbilityEditModal.css';

const ABILITY_FIELDS = [
  { key: 'under_basket', label: '골밑슛' },
  { key: 'mid_range',    label: '미들슛' },
  { key: 'three_point',  label: '3점슛' },
  { key: 'lateral_defense',   label: '가로수비' },
  { key: 'vertical_defense',  label: '세로수비' },
  { key: 'passing', label: '패스' },
  { key: 'speed',   label: '스피드' },
  { key: 'stamina', label: '체력' },
];

export default function AbilityEditModal({ profile, ability, onClose, onSaved }) {
  const [values, setValues] = useState(
    ABILITY_FIELDS.reduce((acc, f) => {
      acc[f.key] = ability?.[f.key] ?? 5;
      return acc;
    }, {})
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('member_abilities').upsert({
      profile_id: profile.id,
      ...values,
    });
    onSaved();
  };

  const valueColor = (v) => v >= 8 ? '#2e7d32' : v >= 5 ? '#1565c0' : '#c62828';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ability-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{profile.nickname} 능력치</h3>
        <div className="ability-fields">
          {ABILITY_FIELDS.map(({ key, label }) => (
            <div key={key} className="ability-row">
              <span className="ability-label">{label}</span>
              <input
                type="range"
                min={1}
                max={10}
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))}
                className="ability-slider"
              />
              <span className="ability-num" style={{ color: valueColor(values[key]) }}>
                {values[key]}
              </span>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose} disabled={saving}>취소</button>
          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? '저장중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

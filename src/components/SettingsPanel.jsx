// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState } from 'react';
import { saveSettings, DEFAULT_SETTINGS } from '../utils/storage';

const OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, backdropFilter: 'blur(4px)',
};

const ROW = { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 };
const LABEL_S = { fontSize: 13, color: 'var(--t1)', fontWeight: 500, minWidth: 130 };

function NumInput({ value, onChange, max, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
        <input type="number" min={0} max={max} value={value}
          onChange={e => onChange(Math.min(max, Math.max(0, Number(e.target.value))))}
          style={{
            width: 80, background: 'var(--bg3)', border: '1px solid var(--bd1)',
            borderRadius: 8, padding: '7px 10px', color: 'var(--t0)',
            fontSize: 14, fontFamily: 'inherit', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = color}
          onBlur={e => e.target.style.borderColor = 'var(--bd1)'}
        />
        <span style={{ fontSize: 12, color: 'var(--t2)' }}>/ {max}점 ({pct}%)</span>
      </div>
      <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export default function SettingsPanel({ settings, onClose, onSave }) {
  const [s, setS] = useState({ ...settings });

  const set = (key, val) => setS(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    saveSettings(s);
    onSave(s);
    onClose();
  };

  const handleReset = () => setS({ ...DEFAULT_SETTINGS, theme: s.theme });

  return (
    <div style={OVERLAY} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 20,
        padding: 32, width: 520, maxWidth: '95vw', boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t0)' }}>목표 점수 설정</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 3 }}>차트에 목표선으로 표시됩니다</div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg3)', border: 'none', borderRadius: 8,
            width: 32, height: 32, color: 'var(--t1)', fontSize: 18,
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Japanese targets */}
        <div style={{ marginBottom: 24, padding: 20, background: 'var(--bg3)', borderRadius: 14, border: '1px solid var(--bd0)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)', marginBottom: 16 }}>🇯🇵 일본어 목표</div>
          <div style={ROW}>
            <span style={LABEL_S}>독해 목표</span>
            <NumInput value={s.targetReading} onChange={v => { set('targetReading', v); set('targetJapanese', v + s.targetListening); }} max={200} color="var(--purple)" />
          </div>
          <div style={ROW}>
            <span style={LABEL_S}>청해 목표</span>
            <NumInput value={s.targetListening} onChange={v => { set('targetListening', v); set('targetJapanese', s.targetReading + v); }} max={200} color="var(--pink)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 0', borderTop: '1px solid var(--bd0)', marginTop: 4 }}>
            <span style={{ ...LABEL_S, color: 'var(--t0)', fontWeight: 700 }}>합계 목표</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>
              {s.targetReading + s.targetListening}
              <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 400 }}> / 400</span>
            </span>
          </div>
        </div>

        {/* Comprehensive target */}
        <div style={{ marginBottom: 24, padding: 20, background: 'var(--bg3)', borderRadius: 14, border: '1px solid var(--bd0)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', marginBottom: 16 }}>📚 종합과목 목표</div>
          <div style={ROW}>
            <span style={LABEL_S}>종합과목 목표</span>
            <NumInput value={s.targetComprehensive} onChange={v => set('targetComprehensive', v)} max={200} color="var(--green)" />
          </div>
        </div>

        {/* Alert threshold */}
        <div style={{ marginBottom: 28, padding: 20, background: 'var(--bg3)', borderRadius: 14, border: '1px solid var(--bd0)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--yellow)', marginBottom: 16 }}>⚠️ 오답 누적 경고 기준</div>
          <div style={ROW}>
            <span style={LABEL_S}>경고 발생 횟수</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {[2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => set('alertThreshold', n)} style={{
                  width: 44, height: 36, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
                  background: s.alertThreshold === n ? 'var(--yellow)' : 'var(--bg2)',
                  color: s.alertThreshold === n ? '#000' : 'var(--t1)',
                  border: `1px solid ${s.alertThreshold === n ? 'var(--yellow)' : 'var(--bd1)'}`,
                }}>{n}</button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'var(--t2)' }}>회 이상 틀리면 경고</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={handleReset} style={{
            background: 'transparent', color: 'var(--t2)', border: '1px solid var(--bd1)',
            borderRadius: 10, padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>초기화</button>
          <button onClick={onClose} style={{
            background: 'transparent', color: 'var(--t1)', border: '1px solid var(--bd1)',
            borderRadius: 10, padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={handleSave} style={{
            background: 'linear-gradient(135deg, var(--blue), var(--purple))',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(79,142,247,0.35)',
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}

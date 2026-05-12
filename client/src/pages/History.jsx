import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

const TIERS = [
  { name: 'Bronze',   color: '#cd7f32', width: 750,  start: 1000  },
  { name: 'Silver',   color: '#a8b2c0', width: 750,  start: 4000  },
  { name: 'Gold',     color: '#ffd700', width: 500,  start: 7000  },
  { name: 'Platinum', color: '#00e5ff', width: 1000, start: 9000  },
  { name: 'Diamond',  color: '#4169e1', width: 1250, start: 13000 },
  { name: 'Masters',  color: '#9b59b6', width: null, start: 18000 },
];
const DIV_NAMES = ['IV', 'III', 'II', 'I'];

function getRankLabel(rp) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i];
    if (rp >= t.start) {
      if (t.name === 'Masters') return { label: 'Masters', color: t.color };
      const divIdx = Math.min(Math.floor((rp - t.start) / t.width), 3);
      return { label: `${t.name} ${DIV_NAMES[divIdx]}`, color: t.color };
    }
  }
  return { label: 'Unranked', color: '#333' };
}

const S = {
  page: { maxWidth: 820, margin: '0 auto', padding: '24px 16px 48px' },
  tag: { fontSize: '11px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 },
  card: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' },
  row: { padding: '18px 24px', borderBottom: '1px solid #0f0f20', display: 'flex', alignItems: 'center', gap: '20px' },
};

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHistory()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: '#333', letterSpacing: '2px' }}>LOADING...</span>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={{ ...S.tag, marginBottom: '12px' }}>Split History</div>

      {history.length === 0 && (
        <div style={{ ...S.card }}>
          <div style={{ padding: '32px', textAlign: 'center', color: '#333', fontFamily: 'Rajdhani, sans-serif' }}>
            No completed splits yet. Your first split will appear here once it ends.
          </div>
        </div>
      )}

      {history.map(h => {
        const finalRank = h.final_rp != null ? getRankLabel(h.final_rp) : null;
        const peakRank = h.peak_rp != null ? getRankLabel(h.peak_rp) : null;
        return (
          <div key={h.id} style={S.card}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '14px', fontWeight: 700, letterSpacing: '1px', color: '#e0e0e0' }}>
                {h.split_label}
              </span>
              <span style={{ ...S.tag }}>
                {new Date(h.archived_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {[
                { label: 'Final RP', value: h.final_rp?.toLocaleString() ?? '—', color: finalRank?.color },
                { label: 'Final Rank', value: finalRank?.label ?? '—', color: finalRank?.color },
                { label: 'Peak RP', value: h.peak_rp?.toLocaleString() ?? '—', color: peakRank?.color },
                { label: 'Sessions', value: h.session_count ?? '—', color: null },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: '16px 24px', borderRight: '1px solid #0f0f20', minWidth: '120px' }}>
                  <div style={{ ...S.tag, marginBottom: '6px' }}>{label}</div>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '18px', fontWeight: 700, color: color || '#e0e0e0' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

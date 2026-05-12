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
      const divIdx = Math.min(Math.floor((rp - t.start) / t.width), t.divs - 1 || 3);
      return { label: `${t.name} ${DIV_NAMES[divIdx]}`, color: t.color };
    }
  }
  return { label: 'Unranked', color: '#333' };
}

const S = {
  page: { maxWidth: 820, margin: '0 auto', padding: '24px 16px 48px' },
  tag: { fontSize: '11px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 },
  card: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '12px', overflow: 'hidden' },
  header: { padding: '16px 24px', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', gap: '16px' },
  row: { display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #0f0f20', gap: '16px' },
  rank: { fontFamily: 'Orbitron, sans-serif', fontSize: '13px', fontWeight: 700, width: '24px', color: '#333', textAlign: 'right', flexShrink: 0 },
  username: { fontFamily: 'Rajdhani, sans-serif', fontSize: '16px', fontWeight: 600, flex: 1, letterSpacing: '0.5px' },
  rp: { fontFamily: 'Orbitron, sans-serif', fontSize: '16px', fontWeight: 700 },
  badge: { fontFamily: 'Rajdhani, sans-serif', fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' },
};

const PLACE_COLORS = ['#ffd700', '#a8b2c0', '#cd7f32'];

export default function Leaderboard() {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLeaderboard()
      .then(setBoard)
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
      <div style={{ ...S.tag, marginBottom: '12px' }}>Leaderboard</div>
      <div style={S.card}>
        <div style={S.header}>
          <span style={{ ...S.tag, width: '24px', textAlign: 'right' }}>#</span>
          <span style={{ ...S.tag, flex: 1 }}>Player</span>
          <span style={{ ...S.tag, width: '80px', textAlign: 'right' }}>RP</span>
          <span style={{ ...S.tag, width: '90px', textAlign: 'right' }}>Rank</span>
          <span style={{ ...S.tag, width: '70px', textAlign: 'right' }}>Sessions</span>
        </div>

        {board.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#333', fontFamily: 'Rajdhani, sans-serif' }}>
            No players yet.
          </div>
        )}

        {board.map((player, i) => {
          const { label, color } = getRankLabel(player.currentRP);
          return (
            <div key={player.id} style={{ ...S.row, background: i === 0 ? 'rgba(255,215,0,0.03)' : 'transparent' }}>
              <div style={{ ...S.rank, color: PLACE_COLORS[i] || '#333' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </div>
              <div style={{ ...S.username, color: player.is_admin ? '#e91e63' : '#e0e0e0' }}>
                {player.username}
                {player.is_admin ? <span style={{ ...S.badge, color: '#e91e63', marginLeft: '8px', fontSize: '10px' }}>admin</span> : null}
              </div>
              <div style={{ ...S.rp, color, width: '80px', textAlign: 'right' }}>
                {player.currentRP.toLocaleString()}
              </div>
              <div style={{ width: '90px', textAlign: 'right', fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', color, letterSpacing: '0.5px' }}>
                {label}
              </div>
              <div style={{ width: '70px', textAlign: 'right', fontFamily: 'Orbitron, sans-serif', fontSize: '12px', color: '#555' }}>
                {player.sessionCount}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

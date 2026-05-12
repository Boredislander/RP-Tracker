import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const STARTING_RP = 1250;

const TIERS = [
  { name: 'Bronze',   color: '#cd7f32', divs: 4, width: 750,  start: 1000  },
  { name: 'Silver',   color: '#a8b2c0', divs: 4, width: 750,  start: 4000  },
  { name: 'Gold',     color: '#ffd700', divs: 4, width: 500,  start: 7000  },
  { name: 'Platinum', color: '#00e5ff', divs: 4, width: 1000, start: 9000  },
  { name: 'Diamond',  color: '#4169e1', divs: 4, width: 1250, start: 13000 },
  { name: 'Masters',  color: '#9b59b6', divs: 1, width: null, start: 18000 },
];

const GOALS = [
  { label: 'Silver IV',   rp: 4000  },
  { label: 'Gold IV',     rp: 7000  },
  { label: 'Platinum IV', rp: 9000  },
  { label: 'Diamond IV',  rp: 13000 },
  { label: 'Masters',     rp: 18000 },
];

const DIV_NAMES = ['IV', 'III', 'II', 'I'];

function getRankInfo(rp) {
  for (let t = TIERS.length - 1; t >= 0; t--) {
    const tier = TIERS[t];
    if (rp >= tier.start) {
      if (tier.name === 'Masters') {
        return { tier, div: '', label: 'Masters', color: tier.color, floorRP: tier.start, ceilRP: null, progress: null };
      }
      const offset = rp - tier.start;
      const divIdx = Math.min(Math.floor(offset / tier.width), tier.divs - 1);
      const divFloor = tier.start + divIdx * tier.width;
      const divCeil = divFloor + tier.width;
      return {
        tier, div: DIV_NAMES[divIdx],
        label: `${tier.name} ${DIV_NAMES[divIdx]}`,
        color: tier.color, floorRP: divFloor, ceilRP: divCeil,
        progress: Math.min(100, Math.max(0, ((rp - divFloor) / tier.width) * 100)),
      };
    }
  }
  return { tier: TIERS[0], div: 'IV', label: 'Bronze IV', color: TIERS[0].color, floorRP: 1000, ceilRP: 1750, progress: 0 };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const css = {
  page: { maxWidth: 820, margin: '0 auto', padding: '24px 16px 48px' },
  tag: { fontSize: '11px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 },
  heroCard: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '12px', padding: '24px', marginBottom: '16px' },
  heroRp: { fontFamily: 'Orbitron, sans-serif', fontSize: '56px', fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' },
  heroLabel: { fontSize: '11px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, marginBottom: '6px' },
  heroRankBadge: { fontFamily: 'Orbitron, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '1px' },
  barTrack: { height: '6px', background: '#1a1a2e', borderRadius: '3px', overflow: 'hidden', marginTop: '8px' },
  barFill: (pct, color) => ({ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.4s ease' }),
  goalSelect: { background: '#080810', border: '1px solid #1a1a2e', borderRadius: '6px', color: '#e0e0e0', fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', letterSpacing: '1px', padding: '5px 10px', cursor: 'pointer', outline: 'none' },
  paceGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' },
  paceCard: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '10px', padding: '16px 14px' },
  paceValue: { fontFamily: 'Orbitron, sans-serif', fontSize: '22px', fontWeight: 700, lineHeight: 1, marginBottom: '6px' },
  paceLabel: { fontSize: '10px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 },
  historyCard: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' },
  historyHeader: { padding: '14px 20px', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' },
  sessionRow: { display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: '1px solid #0f0f20' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' },
  modal: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '420px', position: 'relative' },
  modalClose: { position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#555', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' },
  modalTitle: { fontFamily: 'Orbitron, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '1px', marginBottom: '8px' },
  modalDesc: { fontFamily: 'Rajdhani, sans-serif', fontSize: '14px', color: '#888', lineHeight: 1.6, marginBottom: '24px' },
  modalInput: { width: '100%', background: '#080810', border: '1px solid #1a1a2e', borderRadius: '6px', padding: '12px 16px', color: '#e0e0e0', fontFamily: 'Orbitron, sans-serif', fontSize: '18px', textAlign: 'center', outline: 'none', marginBottom: '16px' },
  modalBtn: { width: '100%', padding: '12px', background: '#e91e63', border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Orbitron, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '2px', cursor: 'pointer' },
  modalBtnGhost: { width: '100%', padding: '12px', background: 'none', border: '1px solid #1a1a2e', borderRadius: '6px', color: '#888', fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', letterSpacing: '2px', cursor: 'pointer', marginTop: '8px' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isToday(iso) {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function groupSessionsByDay(sessions) {
  const groups = {};
  for (const s of sessions) {
    const key = new Date(s.timestamp).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return Object.entries(groups).map(([key, list]) => ({ key, date: new Date(list[0].timestamp), list }));
}

function daysLeft(splitEnd) {
  return Math.max(0, Math.ceil((new Date(splitEnd) - new Date()) / 86400000));
}

function avgRpPerDay(sessions) {
  if (!sessions.length) return 0;
  const byDay = {};
  for (const s of sessions) {
    const key = new Date(s.timestamp).toDateString();
    byDay[key] = (byDay[key] || 0) + s.rp;
  }
  const vals = Object.values(byDay);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function timeSince(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ── Link Account Modal ────────────────────────────────────────────────────────

function LinkModal({ onClose, onLinked }) {
  const [platform, setPlatform] = useState('origin');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!username.trim()) { setErr('Enter your Apex username'); return; }
    setLoading(true);
    try {
      const res = await api.linkAccount(platform, username.trim());
      onLinked({ platform, username: username.trim(), last_sync_at: new Date().toISOString(), last_known_rp: res.trnRP });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={css.overlay}>
      <div style={css.modal}>
        <button style={css.modalClose} onClick={onClose}>✕</button>
        <div style={css.modalTitle}>Link Apex Account</div>
        <p style={css.modalDesc}>
          Enter your Apex username. The tracker will automatically detect RP changes every minute.
        </p>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ ...css.tag, marginBottom: '8px' }}>Platform</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['origin', 'psn', 'xbl'].map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', fontWeight: 600,
                  letterSpacing: '1px', textTransform: 'uppercase', border: 'none',
                  background: platform === p ? '#e91e63' : '#080810',
                  color: platform === p ? '#fff' : '#555',
                  outline: platform === p ? 'none' : '1px solid #1a1a2e',
                }}
              >
                {p === 'origin' ? 'PC' : p === 'psn' ? 'PS' : 'Xbox'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...css.tag, marginBottom: '6px' }}>
          {platform === 'origin' ? 'EA / Origin Username' : platform === 'psn' ? 'PSN ID' : 'Xbox Gamertag'}
        </div>
        <input
          style={css.modalInput}
          type="text"
          placeholder="Your username"
          value={username}
          onChange={e => { setUsername(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoFocus
        />
        {err && <p style={{ color: '#e91e63', fontSize: '13px', marginBottom: '12px', fontFamily: 'Rajdhani, sans-serif' }}>{err}</p>}
        <button style={{ ...css.modalBtn, opacity: loading ? 0.6 : 1 }} onClick={submit} disabled={loading}>
          {loading ? 'Connecting...' : 'Link Account'}
        </button>
        <button style={css.modalBtnGhost} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Tracker({ onAdminChange }) {
  const [sessions, setSessions] = useState([]);
  const [splitStartRP, setSplitStartRP] = useState(null);
  const [activeGoal, setActiveGoal] = useState('');
  const [split, setSplit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [expandedDays, setExpandedDays] = useState({});
  const [error, setError] = useState('');
  const [trnLinked, setTrnLinked] = useState(null);
  const [trnEnabled, setTrnEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [syncTick, setSyncTick] = useState(0); // bump to force refresh

  const readyToSave = useRef(false);
  const debounceTimer = useRef(null);

  // ── Derived RP — always computed, never state ─────────────────────────────
  const baseRP = splitStartRP ?? STARTING_RP;
  const currentRP = sessions.reduce((sum, s) => sum + s.rp, baseRP);
  const rank = getRankInfo(currentRP);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [me, sessionList] = await Promise.all([api.getMe(), api.getSessions()]);
        setSplit(me.split);
        setSplitStartRP(me.prefs.split_start_rp);
        setActiveGoal(me.prefs.goal ?? '');
        setSessions(sessionList);
        setTrnEnabled(Boolean(me.trnEnabled));
        setReady(Boolean(me.ready));
        if (onAdminChange) onAdminChange(Boolean(me.user.is_admin));
        if (me.prefs.trn_username) {
          setTrnLinked({
            platform: me.prefs.trn_platform,
            username: me.prefs.trn_username,
            last_sync_at: me.prefs.last_sync_at,
            last_known_rp: me.prefs.last_known_rp,
          });
        }
      } catch (e) {
        if (e.message === 'Unauthorized' || e.message === 'Invalid token') {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
        setError(e.message);
      } finally {
        setLoading(false);
        setTimeout(() => { readyToSave.current = true; }, 200);
      }
    }
    load();
  }, []);

  // ── Client-side refresh every 30s to pick up auto-logged sessions ─────────
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(async () => {
      if (document.hidden) return;
      try {
        const [me, sessionList] = await Promise.all([api.getMe(), api.getSessions()]);
        setSessions(sessionList);
        setSplitStartRP(me.prefs.split_start_rp);
        setReady(Boolean(me.ready));
        if (me.prefs.trn_username) {
          setTrnLinked(prev => ({
            ...prev,
            last_sync_at: me.prefs.last_sync_at,
            last_known_rp: me.prefs.last_known_rp,
          }));
        }
      } catch {
        // silent — don't surface refresh errors to the user
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Debounced goal save ───────────────────────────────────────────────────
  useEffect(() => {
    if (!readyToSave.current) return;
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      api.savePrefs({ goal: activeGoal || null }).catch(() => {});
    }, 600);
    return () => clearTimeout(debounceTimer.current);
  }, [activeGoal]);

  // ── Unlink ────────────────────────────────────────────────────────────────
  async function unlinkTRN() {
    try {
      await api.unlinkAccount();
      setTrnLinked(null);
      setReady(false);
    } catch (e) {
      setError(e.message);
    }
  }

  // ── Pacing ────────────────────────────────────────────────────────────────
  const goal = GOALS.find(g => g.label === activeGoal);
  const splitEnd = split?.end;
  const dLeft = splitEnd ? daysLeft(splitEnd) : null;
  const rpNeeded = goal ? Math.max(0, goal.rp - currentRP) : null;
  const rpPerDay = dLeft && rpNeeded !== null && dLeft > 0 ? Math.ceil(rpNeeded / dLeft) : null;
  const rpPerWeek = rpPerDay !== null ? rpPerDay * 7 : null;

  const avg = avgRpPerDay(sessions);
  const estimatedDays = avg > 0 && rpNeeded ? Math.ceil(rpNeeded / avg) : null;
  const estimatedDate = estimatedDays != null ? new Date(Date.now() + estimatedDays * 86400000) : null;
  const splitEndDate = splitEnd ? new Date(splitEnd) : null;
  const behindPace = estimatedDate && splitEndDate && estimatedDate > splitEndDate;
  const dailyDeficit = rpPerDay !== null && avg > 0 ? Math.max(0, rpPerDay - avg) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: '#333', letterSpacing: '2px' }}>LOADING...</span>
    </div>
  );

  // Not linked — show onboarding prompt
  if (trnEnabled && !trnLinked) return (
    <div style={{ ...css.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '15px', fontWeight: 700, color: '#e0e0e0', letterSpacing: '1px', marginBottom: '12px' }}>
        Link your Apex account
      </div>
      <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '15px', color: '#555', maxWidth: '320px', lineHeight: 1.6, marginBottom: '28px' }}>
        Connect to Tracker.gg and your RP will be tracked automatically after every match.
      </p>
      <button
        style={{ ...css.modalBtn, width: 'auto', padding: '12px 32px' }}
        onClick={() => setShowLinkModal(true)}
      >
        Link Account
      </button>
      {showLinkModal && (
        <LinkModal
          onClose={() => setShowLinkModal(false)}
          onLinked={info => { setTrnLinked(info); setReady(false); setShowLinkModal(false); }}
        />
      )}
    </div>
  );

  // Linked but baseline not yet set (waiting for first poller tick)
  if (trnLinked && !ready) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #1a1a2e', borderTopColor: '#4caf50', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: '#555', letterSpacing: '2px' }}>SYNCING...</div>
      <p style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', color: '#333', marginTop: '8px' }}>
        First sync in progress — usually under 1 minute
      </p>
    </div>
  );

  const dayGroups = groupSessionsByDay(sessions);

  return (
    <div style={css.page}>
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(233,30,99,0.1)', border: '1px solid rgba(233,30,99,0.3)', borderRadius: '8px', color: '#e91e63', fontFamily: 'Rajdhani, sans-serif', fontSize: '14px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* ── Hero + Goal Card ── */}
      <div style={css.heroCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={css.heroLabel}>Current RP</div>
            <div style={{ ...css.heroRp, color: rank.color }}>{currentRP.toLocaleString()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <span style={{ ...css.heroRankBadge, color: rank.color }}>{rank.label}</span>
              {rank.progress !== null && (
                <span style={{ ...css.tag, fontSize: '11px' }}>
                  {rank.floorRP.toLocaleString()} → {rank.ceilRP?.toLocaleString()}
                </span>
              )}
            </div>
            {rank.progress !== null && (
              <div style={css.barTrack}>
                <div style={css.barFill(rank.progress, rank.color)} />
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ ...css.tag, marginBottom: '6px' }}>Goal</div>
            <select
              style={css.goalSelect}
              value={activeGoal}
              onChange={e => setActiveGoal(e.target.value)}
            >
              <option value="">— None —</option>
              {GOALS.map(g => (
                <option key={g.label} value={g.label}>{g.label}</option>
              ))}
            </select>
          </div>
        </div>

        {goal && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={css.tag}>Progress to {goal.label}</span>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '12px', color: '#888' }}>
                {currentRP.toLocaleString()} / {goal.rp.toLocaleString()}
              </span>
            </div>
            <div style={css.barTrack}>
              <div style={css.barFill(Math.min(100, (currentRP / goal.rp) * 100), getRankInfo(goal.rp).color)} />
            </div>
            {estimatedDate && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ ...css.tag, color: behindPace ? '#e91e63' : '#555' }}>
                  {behindPace ? '⚠ ' : ''}Est. {estimatedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {behindPace && splitEndDate ? ` · Split ends ${formatDate(splitEnd)}` : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Pacing Grid ── */}
      {split && (
        <div>
          <div style={{ ...css.tag, marginBottom: '10px' }}>{split.label} Pacing</div>
          <div style={css.paceGrid}>
            <div style={css.paceCard}>
              <div style={{ ...css.paceValue, color: dLeft === 0 ? '#e91e63' : '#e0e0e0' }}>{dLeft ?? '—'}</div>
              <div style={css.paceLabel}>Days Left</div>
            </div>
            <div style={css.paceCard}>
              <div style={{ ...css.paceValue, color: rpPerWeek ? '#e0e0e0' : '#333' }}>
                {rpPerWeek != null ? (rpPerWeek > 0 ? `+${rpPerWeek}` : '0') : '—'}
              </div>
              <div style={css.paceLabel}>RP / Week</div>
            </div>
            <div style={css.paceCard}>
              <div style={{ ...css.paceValue, color: rpPerDay ? '#e0e0e0' : '#333' }}>
                {rpPerDay != null ? (rpPerDay > 0 ? `+${rpPerDay}` : '0') : '—'}
              </div>
              <div style={css.paceLabel}>RP / Day</div>
            </div>
            <div style={{ ...css.paceCard, borderColor: dailyDeficit ? 'rgba(233,30,99,0.3)' : '#1a1a2e' }}>
              <div style={{ ...css.paceValue, color: dailyDeficit ? '#e91e63' : '#333' }}>
                {dailyDeficit != null ? (dailyDeficit > 0 ? `+${dailyDeficit}` : '✓') : '—'}
              </div>
              <div style={css.paceLabel}>Catch-Up</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Auto-Sync Status ── */}
      {trnLinked && (
        <div style={{ background: '#0d0d1a', border: '1px solid rgba(76,175,80,0.25)', borderRadius: '10px', padding: '12px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4caf50', flexShrink: 0, boxShadow: '0 0 5px #4caf50' }} />
          <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '14px', fontWeight: 600, flex: 1 }}>
            <span style={{ color: '#e0e0e0' }}>{trnLinked.username}</span>
            <span style={{ color: '#4caf50', marginLeft: '8px', fontSize: '11px', letterSpacing: '1px' }}>· auto</span>
            {trnLinked.last_sync_at && (
              <span style={{ color: '#444', marginLeft: '8px', fontSize: '11px' }}>
                · {timeSince(trnLinked.last_sync_at)}
              </span>
            )}
          </span>
          <button
            style={{ background: 'none', border: 'none', color: '#2a2a4a', fontFamily: 'Rajdhani, sans-serif', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', padding: '4px 6px' }}
            onClick={unlinkTRN}
          >
            Unlink
          </button>
        </div>
      )}

      {/* ── Session History (read-only) ── */}
      <div style={css.historyCard}>
        <div style={css.historyHeader} onClick={() => setHistoryOpen(o => !o)}>
          <span style={css.tag}>Session History ({sessions.length})</span>
          <span style={{ color: '#444', fontSize: '14px' }}>{historyOpen ? '▲' : '▼'}</span>
        </div>

        {historyOpen && (
          <div>
            {dayGroups.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#333', fontFamily: 'Rajdhani, sans-serif', fontSize: '14px' }}>
                No sessions this split yet — RP changes will appear here automatically.
              </div>
            )}

            {dayGroups.map(({ key, date, list }) => {
              const today = isToday(list[0].timestamp);
              const daySum = list.reduce((s, x) => s + x.rp, 0);
              const expanded = today || expandedDays[key];

              return (
                <div key={key}>
                  <div
                    style={{ padding: '9px 20px', background: '#0a0a15', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: today ? 'default' : 'pointer', userSelect: 'none' }}
                    onClick={() => !today && setExpandedDays(p => ({ ...p, [key]: !p[key] }))}
                  >
                    <span style={{ ...css.tag, color: today ? '#888' : '#555' }}>
                      {today ? 'Today' : formatDate(date)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: daySum >= 0 ? '#4caf50' : '#e91e63' }}>
                        {daySum >= 0 ? '+' : ''}{daySum}
                      </span>
                      {!today && <span style={{ color: '#333', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>}
                    </div>
                  </div>

                  {expanded && list.map(s => (
                    <div key={s.id} style={css.sessionRow}>
                      <span style={{ ...css.tag, width: '70px' }}>{formatTime(s.timestamp)}</span>
                      <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '15px', flex: 1, color: s.rp >= 0 ? '#4caf50' : '#e91e63' }}>
                        {s.rp >= 0 ? '+' : ''}{s.rp}
                      </span>
                      <span style={{ ...css.tag, fontSize: '10px', color: '#2a2a4a' }}>
                        {s.auto_logged ? 'auto' : 'manual'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showLinkModal && (
        <LinkModal
          onClose={() => setShowLinkModal(false)}
          onLinked={info => { setTrnLinked(info); setReady(false); setShowLinkModal(false); }}
        />
      )}
    </div>
  );
}

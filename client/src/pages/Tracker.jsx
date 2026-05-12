import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const STARTING_RP = 1250;

// Tier boundaries: Bronze IV (1000-1749) contains STARTING_RP=1250
// Platinum IV starts at 9000, so 9810 lands in Platinum IV
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
      const progress = ((rp - divFloor) / tier.width) * 100;
      return {
        tier,
        div: DIV_NAMES[divIdx],
        label: `${tier.name} ${DIV_NAMES[divIdx]}`,
        color: tier.color,
        floorRP: divFloor,
        ceilRP: divCeil,
        progress: Math.min(100, Math.max(0, progress)),
      };
    }
  }
  return { tier: TIERS[0], div: 'IV', label: 'Bronze IV', color: TIERS[0].color, floorRP: 1000, ceilRP: 1750, progress: 0 };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const css = {
  page: { maxWidth: 820, margin: '0 auto', padding: '24px 16px 48px' },
  tag: { fontSize: '11px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 },

  // Hero card
  heroCard: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '12px', padding: '24px', marginBottom: '16px', position: 'relative' },
  heroRp: { fontFamily: 'Orbitron, sans-serif', fontSize: '56px', fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' },
  heroLabel: { fontSize: '11px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, marginBottom: '6px' },
  heroRankBadge: { fontFamily: 'Orbitron, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '1px' },

  // Progress bar
  barTrack: { height: '6px', background: '#1a1a2e', borderRadius: '3px', overflow: 'hidden', marginTop: '8px' },
  barFill: (pct, color) => ({ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.4s ease' }),

  // Goal section
  goalRow: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' },
  goalSelect: {
    background: '#080810', border: '1px solid #1a1a2e', borderRadius: '6px',
    color: '#e0e0e0', fontFamily: 'Rajdhani, sans-serif', fontSize: '13px',
    letterSpacing: '1px', padding: '5px 10px', cursor: 'pointer', outline: 'none',
  },

  // Pace grid
  paceGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' },
  paceCard: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '10px', padding: '16px 14px' },
  paceValue: { fontFamily: 'Orbitron, sans-serif', fontSize: '22px', fontWeight: 700, lineHeight: 1, marginBottom: '6px' },
  paceLabel: { fontSize: '10px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 },

  // Session form
  formCard: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '10px', padding: '20px', marginBottom: '16px' },
  rpInput: {
    width: '130px', background: '#080810', border: '1px solid #1a1a2e', borderRadius: '6px',
    padding: '10px 14px', color: '#e0e0e0', fontFamily: 'Orbitron, sans-serif',
    fontSize: '20px', outline: 'none', textAlign: 'center',
  },
  addBtn: {
    padding: '10px 24px', background: '#e91e63', border: 'none', borderRadius: '6px',
    color: '#fff', fontFamily: 'Orbitron, sans-serif', fontSize: '13px', fontWeight: 700,
    letterSpacing: '1px', cursor: 'pointer', transition: 'opacity 0.15s',
  },

  // Session history
  historyCard: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' },
  historyHeader: { padding: '14px 20px', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' },
  sessionRow: { display: 'flex', alignItems: 'center', padding: '11px 20px', borderBottom: '1px solid #0f0f20' },

  // Modals
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' },
  modal: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '420px', position: 'relative' },
  modalClose: { position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#555', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' },
  modalTitle: { fontFamily: 'Orbitron, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '1px', marginBottom: '8px' },
  modalDesc: { fontFamily: 'Rajdhani, sans-serif', fontSize: '14px', color: '#888', lineHeight: 1.6, marginBottom: '24px' },
  modalInput: {
    width: '100%', background: '#080810', border: '1px solid #1a1a2e', borderRadius: '6px',
    padding: '12px 16px', color: '#e0e0e0', fontFamily: 'Orbitron, sans-serif',
    fontSize: '22px', textAlign: 'center', outline: 'none', marginBottom: '16px',
  },
  modalBtn: { width: '100%', padding: '12px', background: '#e91e63', border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Orbitron, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '2px', cursor: 'pointer' },
  modalBtnGhost: { width: '100%', padding: '12px', background: 'none', border: '1px solid #1a1a2e', borderRadius: '6px', color: '#888', fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', letterSpacing: '2px', cursor: 'pointer', marginTop: '8px' },
};

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '6px', cursor: 'default' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ fontSize: '11px', color: '#444', lineHeight: 1 }}>ⓘ</span>
      {show && (
        <span style={{
          position: 'absolute', left: '50%', bottom: 'calc(100% + 6px)', transform: 'translateX(-50%)',
          background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: '6px',
          padding: '6px 10px', color: '#aaa', fontSize: '12px', whiteSpace: 'nowrap',
          fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.5px', zIndex: 10, pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isToday(iso) {
  const d = new Date(iso);
  const n = new Date();
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
  const ms = new Date(splitEnd) - new Date();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function avgRpPerDay(sessions) {
  if (!sessions.length) return 0;
  const byDay = {};
  for (const s of sessions) {
    const key = new Date(s.timestamp).toDateString();
    byDay[key] = (byDay[key] || 0) + s.rp;
  }
  const days = Object.values(byDay);
  return days.reduce((a, b) => a + b, 0) / days.length;
}

// ── Setup Modal ───────────────────────────────────────────────────────────────

function SetupModal({ splitLabel, onCommit }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');

  function commit() {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) { setErr('Enter a valid RP value'); return; }
    onCommit(n);
  }

  return (
    <div style={css.overlay}>
      <div style={css.modal}>
        <div style={{ ...css.tag, marginBottom: '6px' }}>{splitLabel}</div>
        <div style={css.modalTitle}>What's your current in-game RP?</div>
        <p style={css.modalDesc}>
          Enter the RP shown on your Apex rank screen right now. This anchors the tracker to your actual rank.
        </p>
        <input
          style={css.modalInput}
          type="number"
          placeholder="e.g. 9810"
          value={val}
          onChange={e => { setVal(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && commit()}
          autoFocus
        />
        {err && <p style={{ color: '#e91e63', fontSize: '13px', marginBottom: '12px', fontFamily: 'Rajdhani, sans-serif' }}>{err}</p>}
        <button style={css.modalBtn} onClick={commit}>Set Baseline</button>
      </div>
    </div>
  );
}

// ── Reset Modal ───────────────────────────────────────────────────────────────

function ResetModal({ onClose, onCommit }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');

  function commit() {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) { setErr('Enter a valid RP value'); return; }
    onCommit(n);
  }

  return (
    <div style={css.overlay}>
      <div style={css.modal}>
        <button style={css.modalClose} onClick={onClose}>✕</button>
        <div style={css.modalTitle}>Reset Baseline</div>
        <p style={css.modalDesc}>
          Enter your actual in-game RP to re-anchor the tracker. Use this to correct drift after a browser
          cache issue or manual override.
          <Tooltip text="split_start_rp = entered RP − session sum" />
        </p>
        <input
          style={css.modalInput}
          type="number"
          placeholder="Current in-game RP"
          value={val}
          onChange={e => { setVal(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && commit()}
          autoFocus
        />
        {err && <p style={{ color: '#e91e63', fontSize: '13px', marginBottom: '12px', fontFamily: 'Rajdhani, sans-serif' }}>{err}</p>}
        <button style={css.modalBtn} onClick={commit}>Confirm Reset</button>
        <button style={css.modalBtnGhost} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
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
          Connect your Tracker.gg profile. The server will poll every 5 minutes and auto-log RP changes.
        </p>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ ...css.tag, marginBottom: '6px' }}>Platform</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['origin', 'psn', 'xbl'].map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', fontWeight: 600,
                  letterSpacing: '1px', textTransform: 'uppercase',
                  background: platform === p ? '#e91e63' : '#080810',
                  border: `1px solid ${platform === p ? '#e91e63' : '#1a1a2e'}`,
                  color: platform === p ? '#fff' : '#555',
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
          style={{ ...css.modalInput, fontSize: '18px', marginBottom: '16px' }}
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
  const [overrideRP, setOverrideRP] = useState(null);
  const [splitStartRP, setSplitStartRP] = useState(null);
  const [activeGoal, setActiveGoal] = useState('');
  const [split, setSplit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rpInput, setRpInput] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [expandedDays, setExpandedDays] = useState({});
  const [error, setError] = useState('');
  const [trnLinked, setTrnLinked] = useState(null); // { platform, username, last_sync_at, last_known_rp }
  const [trnEnabled, setTrnEnabled] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const readyToSave = useRef(false);
  const debounceTimer = useRef(null);

  // ── Derived RP — never useState, always computed ──────────────────────────
  const baseRP = splitStartRP ?? STARTING_RP;
  const derivedRP = sessions.reduce((sum, s) => sum + s.rp, baseRP);
  const currentRP = overrideRP ?? derivedRP;
  const rank = getRankInfo(currentRP);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [me, sessionList] = await Promise.all([api.getMe(), api.getSessions()]);
        setSplit(me.split);
        setSplitStartRP(me.prefs.split_start_rp);
        setOverrideRP(me.prefs.override_rp ?? null);
        setActiveGoal(me.prefs.goal ?? '');
        setSessions(sessionList);
        if (onAdminChange) onAdminChange(Boolean(me.user.is_admin));
        if (me.needsSetup) setShowSetup(true);
        setTrnEnabled(Boolean(me.trnEnabled));
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
        }
        setError(e.message);
      } finally {
        setLoading(false);
        setTimeout(() => { readyToSave.current = true; }, 200);
      }
    }
    load();
  }, []);

  // ── Debounced prefs save ──────────────────────────────────────────────────
  useEffect(() => {
    if (!readyToSave.current) return;
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      api.savePrefs({ goal: activeGoal || null, override_rp: overrideRP }).catch(() => {});
    }, 600);
    return () => clearTimeout(debounceTimer.current);
  }, [activeGoal, overrideRP]);

  // ── Setup commit ──────────────────────────────────────────────────────────
  async function commitSetup(currentInGameRP) {
    try {
      const res = await api.submitSetup(currentInGameRP);
      setSplitStartRP(res.split_start_rp);
      setOverrideRP(null);
      setShowSetup(false);
    } catch (e) {
      setError(e.message);
    }
  }

  // ── Session actions ───────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const rp = parseInt(rpInput, 10);
    if (isNaN(rp)) return;
    try {
      const newSession = await api.addSession(rp);
      setSessions(prev => [newSession, ...prev]);
      setOverrideRP(null);
      setRpInput('');
    } catch (e) {
      setError(e.message);
    }
  }

  const removeSession = useCallback(async (id) => {
    try {
      await api.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // ── Reset baseline ────────────────────────────────────────────────────────
  async function commitReset(currentInGameRP) {
    try {
      const res = await api.submitSetup(currentInGameRP);
      setSplitStartRP(res.split_start_rp);
      setOverrideRP(null);
      setShowReset(false);
    } catch (e) {
      setError(e.message);
    }
  }

  // ── TRN sync ──────────────────────────────────────────────────────────────
  async function syncNow() {
    setSyncing(true);
    try {
      const result = await api.syncNow();
      if (result.logged) {
        const freshSessions = await api.getSessions();
        setSessions(freshSessions);
        setOverrideRP(null);
      }
      setTrnLinked(prev => ({ ...prev, last_sync_at: new Date().toISOString(), last_known_rp: result.trnRP }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function unlinkTRN() {
    try {
      await api.unlinkAccount();
      setTrnLinked(null);
    } catch (e) {
      setError(e.message);
    }
  }

  // ── Pacing calculations ───────────────────────────────────────────────────
  const goal = GOALS.find(g => g.label === activeGoal);
  const splitEnd = split?.end;
  const dLeft = splitEnd ? daysLeft(splitEnd) : null;
  const rpGained = sessions.reduce((sum, s) => sum + s.rp, 0);
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
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: '#333', letterSpacing: '2px' }}>LOADING...</span>
      </div>
    );
  }

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
          {/* Left: RP + rank */}
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
              <button
                style={{ marginLeft: 'auto', background: 'none', border: '1px solid #1a1a2e', borderRadius: '5px', color: '#555', fontFamily: 'Rajdhani, sans-serif', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '4px 10px', cursor: 'pointer' }}
                onClick={() => setShowReset(true)}
              >
                EDIT <Tooltip text="Re-anchor to your actual in-game RP" />
              </button>
            </div>
            {rank.progress !== null && (
              <div style={css.barTrack}>
                <div style={css.barFill(rank.progress, rank.color)} />
              </div>
            )}
          </div>

          {/* Right: Goal selector */}
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

        {/* Goal progress bar */}
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
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
      {trnEnabled && (
        <div style={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '10px', padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {trnLinked ? (
            <>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4caf50', flexShrink: 0, boxShadow: '0 0 6px #4caf50' }} />
              <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '14px', fontWeight: 600, color: '#888', flex: 1, minWidth: '120px' }}>
                Auto-sync: <span style={{ color: '#e0e0e0' }}>{trnLinked.username}</span>
                {trnLinked.last_sync_at && (
                  <span style={{ color: '#555', marginLeft: '10px', fontSize: '12px' }}>
                    · {formatTime(trnLinked.last_sync_at)}
                  </span>
                )}
              </span>
              <button
                style={{ background: 'none', border: '1px solid #1a1a2e', borderRadius: '5px', color: '#888', fontFamily: 'Rajdhani, sans-serif', fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '4px 12px', cursor: syncing ? 'default' : 'pointer', opacity: syncing ? 0.5 : 1 }}
                onClick={syncNow}
                disabled={syncing}
              >
                {syncing ? '...' : 'Sync Now'}
              </button>
              <button
                style={{ background: 'none', border: 'none', color: '#333', fontFamily: 'Rajdhani, sans-serif', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', padding: '4px 8px' }}
                onClick={unlinkTRN}
              >
                Unlink
              </button>
            </>
          ) : (
            <>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#333', flexShrink: 0 }} />
              <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '14px', color: '#555', flex: 1 }}>Auto-sync not linked</span>
              <button
                style={{ background: '#e91e63', border: 'none', borderRadius: '5px', color: '#fff', fontFamily: 'Rajdhani, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '6px 16px', cursor: 'pointer' }}
                onClick={() => setShowLinkModal(true)}
              >
                Link Account
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Session Form ── */}
      <div style={css.formCard}>
        <div style={{ ...css.tag, marginBottom: '12px' }}>Log Session</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={css.rpInput}
            type="number"
            placeholder="+/− RP"
            value={rpInput}
            onChange={e => setRpInput(e.target.value)}
          />
          <button style={css.addBtn} type="submit">ADD</button>
          {rpInput !== '' && !isNaN(parseInt(rpInput)) && (
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: '#555' }}>
              → {(currentRP + parseInt(rpInput)).toLocaleString()} RP
            </span>
          )}
        </form>
      </div>

      {/* ── Session History ── */}
      <div style={css.historyCard}>
        <div style={css.historyHeader} onClick={() => setHistoryOpen(o => !o)}>
          <span style={css.tag}>Session History ({sessions.length})</span>
          <span style={{ color: '#444', fontSize: '14px' }}>{historyOpen ? '▲' : '▼'}</span>
        </div>

        {historyOpen && (
          <div>
            {dayGroups.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#333', fontFamily: 'Rajdhani, sans-serif', fontSize: '14px' }}>
                No sessions this split yet.
              </div>
            )}

            {dayGroups.map(({ key, date, list }) => {
              const today = isToday(list[0].timestamp);
              const daySum = list.reduce((s, x) => s + x.rp, 0);
              const expanded = today || expandedDays[key];

              return (
                <div key={key}>
                  {/* Day header */}
                  <div
                    style={{
                      padding: '9px 20px',
                      background: '#0a0a15',
                      borderBottom: '1px solid #1a1a2e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: today ? 'default' : 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => !today && setExpandedDays(p => ({ ...p, [key]: !p[key] }))}
                  >
                    <span style={{ ...css.tag, color: today ? '#888' : '#555' }}>
                      {today ? 'Today' : formatDate(date)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: daySum >= 0 ? '#4caf50' : '#e91e63' }}>
                        {daySum >= 0 ? '+' : ''}{daySum}
                      </span>
                      {!today && (
                        <span style={{ color: '#333', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </div>

                  {/* Session rows */}
                  {expanded && list.map(s => (
                    <div key={s.id} style={css.sessionRow}>
                      <span style={{ ...css.tag, width: '70px' }}>{formatTime(s.timestamp)}</span>
                      <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '15px', flex: 1, color: s.rp >= 0 ? '#4caf50' : '#e91e63' }}>
                        {s.rp >= 0 ? '+' : ''}{s.rp}
                      </span>
                      {today && (
                        <button
                          onClick={() => removeSession(s.id)}
                          style={{ background: 'none', border: 'none', color: '#2a2a4a', fontSize: '16px', cursor: 'pointer', padding: '2px 6px', lineHeight: 1, borderRadius: '4px', transition: 'color 0.15s' }}
                          onMouseEnter={e => e.target.style.color = '#e91e63'}
                          onMouseLeave={e => e.target.style.color = '#2a2a4a'}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showSetup && split && (
        <SetupModal splitLabel={split.label} onCommit={commitSetup} />
      )}
      {showReset && (
        <ResetModal onClose={() => setShowReset(false)} onCommit={commitReset} />
      )}
      {showLinkModal && (
        <LinkModal
          onClose={() => setShowLinkModal(false)}
          onLinked={info => { setTrnLinked(info); setShowLinkModal(false); }}
        />
      )}
    </div>
  );
}

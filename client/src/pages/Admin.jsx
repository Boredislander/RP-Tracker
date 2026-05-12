import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

const S = {
  page: { maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px' },
  tag: { fontSize: '11px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600 },
  card: { background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' },
  header: { padding: '14px 20px', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', gap: '16px' },
  row: { display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #0f0f20', gap: '12px', flexWrap: 'wrap' },
  btn: (variant = 'ghost') => ({
    background: variant === 'danger' ? 'rgba(233,30,99,0.15)' : variant === 'primary' ? '#e91e63' : 'none',
    border: `1px solid ${variant === 'danger' ? 'rgba(233,30,99,0.4)' : variant === 'primary' ? '#e91e63' : '#1a1a2e'}`,
    borderRadius: '5px',
    color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#e91e63' : '#888',
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: '12px',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    padding: '4px 10px',
    cursor: 'pointer',
  }),
  input: { background: '#080810', border: '1px solid #1a1a2e', borderRadius: '5px', color: '#e0e0e0', fontFamily: 'Orbitron, sans-serif', fontSize: '14px', padding: '4px 10px', width: '100px', outline: 'none' },
};

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rpOverrides, setRpOverrides] = useState({});
  const [error, setError] = useState('');

  async function load() {
    try {
      const [u, s] = await Promise.all([api.admin.getUsers(), api.admin.getSessions()]);
      setUsers(u);
      setSessions(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function deleteUser(id) {
    if (!confirm('Delete this user and all their data?')) return;
    try {
      await api.admin.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (e) { setError(e.message); }
  }

  async function toggleAdmin(user) {
    try {
      await api.admin.toggleAdmin(user.id, user.is_admin ? 0 : 1);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: u.is_admin ? 0 : 1 } : u));
    } catch (e) { setError(e.message); }
  }

  async function setSplitStart(userId) {
    const val = parseInt(rpOverrides[userId], 10);
    if (isNaN(val)) return;
    try {
      await api.admin.setPrefs(userId, { split_start_rp: val });
      setRpOverrides(p => ({ ...p, [userId]: '' }));
      load();
    } catch (e) { setError(e.message); }
  }

  async function deleteSession(id) {
    try {
      await api.admin.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (e) { setError(e.message); }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: '#333', letterSpacing: '2px' }}>LOADING...</span>
    </div>
  );

  return (
    <div style={S.page}>
      {error && (
        <div style={{ padding: '10px 16px', background: 'rgba(233,30,99,0.1)', border: '1px solid rgba(233,30,99,0.3)', borderRadius: '8px', color: '#e91e63', fontFamily: 'Rajdhani, sans-serif', fontSize: '14px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Users */}
      <div style={{ ...S.tag, marginBottom: '10px' }}>Users</div>
      <div style={S.card}>
        <div style={S.header}>
          <span style={{ ...S.tag, flex: 1 }}>Username</span>
          <span style={{ ...S.tag, width: '80px' }}>Current RP</span>
          <span style={{ ...S.tag, width: '80px' }}>Sessions</span>
          <span style={{ ...S.tag, width: '100px' }}>split_start_rp</span>
          <span style={{ ...S.tag, width: '120px' }}>Set Baseline</span>
          <span style={{ ...S.tag, width: '120px' }}>Actions</span>
        </div>
        {users.map(u => (
          <div key={u.id} style={S.row}>
            <span style={{ flex: 1, fontFamily: 'Rajdhani, sans-serif', fontSize: '15px', fontWeight: 600, color: u.is_admin ? '#e91e63' : '#e0e0e0' }}>
              {u.username}
              {u.is_admin ? <span style={{ marginLeft: '6px', fontSize: '10px', color: '#e91e63', letterSpacing: '1px' }}>ADMIN</span> : null}
            </span>
            <span style={{ width: '80px', fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: '#888' }}>
              {u.currentRP?.toLocaleString() ?? '—'}
            </span>
            <span style={{ width: '80px', fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: '#555' }}>
              {u.sessionCount ?? 0}
            </span>
            <span style={{ width: '80px', fontFamily: 'Orbitron, sans-serif', fontSize: '12px', color: '#555' }}>
              {u.prefs?.split_start_rp ?? 'null'}
            </span>
            <span style={{ display: 'flex', gap: '6px', width: '160px', alignItems: 'center' }}>
              <input
                style={S.input}
                type="number"
                placeholder="RP"
                value={rpOverrides[u.id] || ''}
                onChange={e => setRpOverrides(p => ({ ...p, [u.id]: e.target.value }))}
              />
              <button style={S.btn('primary')} onClick={() => setSplitStart(u.id)}>Set</button>
            </span>
            <span style={{ display: 'flex', gap: '6px' }}>
              <button style={S.btn()} onClick={() => toggleAdmin(u)}>
                {u.is_admin ? 'Demote' : 'Promote'}
              </button>
              <button style={S.btn('danger')} onClick={() => deleteUser(u.id)}>Del</button>
            </span>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      <div style={{ ...S.tag, marginBottom: '10px' }}>Recent Sessions (current split)</div>
      <div style={S.card}>
        <div style={S.header}>
          <span style={{ ...S.tag, width: '100px' }}>User</span>
          <span style={{ ...S.tag, flex: 1 }}>Time</span>
          <span style={{ ...S.tag, width: '60px' }}>RP</span>
          <span style={{ ...S.tag, width: '60px' }}>Action</span>
        </div>
        {sessions.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#333', fontFamily: 'Rajdhani, sans-serif' }}>No sessions.</div>
        )}
        {sessions.slice(0, 50).map(s => (
          <div key={s.id} style={S.row}>
            <span style={{ width: '100px', fontFamily: 'Rajdhani, sans-serif', fontSize: '14px', fontWeight: 600, color: '#888' }}>{s.username}</span>
            <span style={{ flex: 1, fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', color: '#555' }}>
              {new Date(s.timestamp).toLocaleString()}
            </span>
            <span style={{ width: '60px', fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: s.rp >= 0 ? '#4caf50' : '#e91e63' }}>
              {s.rp >= 0 ? '+' : ''}{s.rp}
            </span>
            <button style={S.btn('danger')} onClick={() => deleteSession(s.id)}>Del</button>
          </div>
        ))}
      </div>
    </div>
  );
}

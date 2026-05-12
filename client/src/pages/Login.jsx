import React, { useState } from 'react';
import { api } from '../api.js';

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#080810',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: '#0d0d1a',
    border: '1px solid #1a1a2e',
    borderRadius: '12px',
    padding: '40px',
  },
  logo: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '22px',
    fontWeight: 900,
    color: '#e91e63',
    letterSpacing: '3px',
    textAlign: 'center',
    marginBottom: '8px',
  },
  sub: {
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: '13px',
    letterSpacing: '2px',
    color: '#444',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: '36px',
  },
  tabs: {
    display: 'flex',
    marginBottom: '28px',
    borderBottom: '1px solid #1a1a2e',
  },
  tab: {
    flex: 1,
    background: 'none',
    border: 'none',
    padding: '10px',
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    cursor: 'pointer',
    color: '#444',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
    transition: 'color 0.15s, border-color 0.15s',
  },
  activeTab: {
    color: '#e0e0e0',
    borderBottomColor: '#e91e63',
  },
  field: { marginBottom: '16px' },
  label: {
    display: 'block',
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: '12px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: '#555',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    background: '#080810',
    border: '1px solid #1a1a2e',
    borderRadius: '6px',
    padding: '10px 14px',
    color: '#e0e0e0',
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  btn: {
    width: '100%',
    marginTop: '8px',
    padding: '12px',
    background: '#e91e63',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '2px',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  error: {
    marginTop: '12px',
    padding: '10px 14px',
    background: 'rgba(233,30,99,0.1)',
    border: '1px solid rgba(233,30,99,0.3)',
    borderRadius: '6px',
    color: '#e91e63',
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: '14px',
  },
};

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn = mode === 'login' ? api.login : api.register;
      const { token } = await fn(username, password);
      localStorage.setItem('token', token);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>APEX RP</div>
        <div style={S.sub}>Ranked Tracker</div>

        <div style={S.tabs}>
          {['login', 'register'].map(m => (
            <button
              key={m}
              style={{ ...S.tab, ...(mode === m ? S.activeTab : {}) }}
              onClick={() => { setMode(m); setError(''); }}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          <div style={S.field}>
            <label style={S.label}>Username</label>
            <input
              style={S.input}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div style={S.field}>
            <label style={S.label}>Password</label>
            <input
              type="password"
              style={S.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
          {error && <div style={S.error}>{error}</div>}
        </form>
      </div>
    </div>
  );
}

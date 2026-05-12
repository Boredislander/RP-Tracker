import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Tracker from './pages/Tracker.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import History from './pages/History.jsx';
import Admin from './pages/Admin.jsx';

const NAV_STYLES = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0 24px',
    height: '52px',
    background: '#0a0a18',
    borderBottom: '1px solid #1a1a2e',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '14px',
    fontWeight: 700,
    color: '#e91e63',
    letterSpacing: '2px',
    marginRight: '24px',
    textDecoration: 'none',
  },
  link: {
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: '#666',
    textDecoration: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    transition: 'color 0.15s, background 0.15s',
  },
  activeLink: {
    color: '#e0e0e0',
    background: '#1a1a2e',
  },
  logout: {
    marginLeft: 'auto',
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: '#444',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '4px',
    transition: 'color 0.15s',
  },
};

function NavBar({ isAdmin }) {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <nav style={NAV_STYLES.nav}>
      <NavLink to="/tracker" style={NAV_STYLES.brand}>APEX RP</NavLink>
      {[
        { to: '/tracker', label: 'Tracker' },
        { to: '/leaderboard', label: 'Leaderboard' },
        { to: '/history', label: 'History' },
        ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
      ].map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            ...NAV_STYLES.link,
            ...(isActive ? NAV_STYLES.activeLink : {}),
          })}
        >
          {label}
        </NavLink>
      ))}
      <button style={NAV_STYLES.logout} onClick={logout}>
        Log out
      </button>
    </nav>
  );
}

// AppRoutes is extracted as a stable component to prevent remounts on parent re-render
function AppRoutes() {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const isLoggedIn = Boolean(localStorage.getItem('token'));

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={() => window.location.reload()} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <NavBar isAdmin={isAdmin} />
      <Routes>
        <Route path="/tracker" element={<Tracker onAdminChange={setIsAdmin} />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/tracker" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

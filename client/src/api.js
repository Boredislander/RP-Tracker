const BASE = '/api';

function token() {
  return localStorage.getItem('token');
}

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    ...extra,
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  register: (username, password) =>
    request('POST', '/register', { username, password }),

  login: (username, password) =>
    request('POST', '/login', { username, password }),

  getMe: () => request('GET', '/me'),

  getSessions: () => request('GET', '/sessions'),

  addSession: (rp) => request('POST', '/sessions', { rp }),

  deleteSession: (id) => request('DELETE', `/sessions/${id}`),

  savePrefs: (prefs) => request('POST', '/prefs', prefs),

  submitSetup: (current_rp) => request('POST', '/setup', { current_rp }),

  linkAccount: (platform, username) => request('POST', '/link', { platform, username }),
  unlinkAccount: () => request('DELETE', '/link'),
  syncNow: () => request('POST', '/sync'),
  startPolling: () => request('POST', '/polling/start'),
  stopPolling: () => request('POST', '/polling/stop'),

  getLeaderboard: () => request('GET', '/leaderboard'),

  getHistory: () => request('GET', '/history'),

  admin: {
    getUsers: () => request('GET', '/admin/users'),
    deleteUser: (id) => request('DELETE', `/admin/users/${id}`),
    toggleAdmin: (id, is_admin) => request('PATCH', `/admin/users/${id}`, { is_admin }),
    getSessions: () => request('GET', '/admin/sessions'),
    deleteSession: (id) => request('DELETE', `/admin/sessions/${id}`),
    setPrefs: (userId, prefs) => request('PATCH', `/admin/prefs/${userId}`, prefs),
  },
};

const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
const { sign, middleware, adminOnly } = require('./auth');
const { startPoller, pollUser, fetchPlayerRP, startPollingForUser, stopPollingForUser, isPollingActive } = require('./poller');

const app = express();
app.use(express.json());

const STARTING_RP = 1250;

const SPLITS = [
  { label: 'S28 Split 1', start: '2026-02-10T18:00:00Z', end: '2026-03-23T17:59:00Z' },
  { label: 'S28 Split 2', start: '2026-03-23T18:00:00Z', end: '2026-05-05T17:59:00Z' },
  { label: 'S29 Split 1', start: '2026-05-05T18:00:00Z', end: '2026-08-11T17:59:00Z' },
  { label: 'S29 Split 2', start: '2026-08-11T18:00:00Z', end: '2026-11-03T17:59:00Z' },
];

function getCurrentSplit() {
  const now = new Date();
  return (
    SPLITS.find(s => now >= new Date(s.start) && now <= new Date(s.end)) ||
    SPLITS[SPLITS.length - 1]
  );
}

function getUserSessions(userId, splitStart) {
  return db
    .prepare('SELECT * FROM sessions WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp DESC')
    .all(userId, splitStart);
}

function deriveRP(prefs, sessions) {
  const baseRP = prefs?.split_start_rp ?? STARTING_RP;
  const derivedRP = sessions.reduce((sum, s) => sum + s.rp, baseRP);
  return prefs?.override_rp ?? derivedRP;
}

function ensurePrefs(userId) {
  db.prepare('INSERT OR IGNORE INTO prefs (user_id) VALUES (?)').run(userId);
  return db.prepare('SELECT * FROM prefs WHERE user_id = ?').get(userId);
}

function archiveSplitIfNeeded(userId, currentSplitLabel) {
  const prefs = db.prepare('SELECT * FROM prefs WHERE user_id = ?').get(userId);
  if (!prefs || !prefs.last_split || prefs.last_split === currentSplitLabel) return;

  const oldSplit = SPLITS.find(s => s.label === prefs.last_split);
  if (!oldSplit) return;

  const sessions = db
    .prepare('SELECT * FROM sessions WHERE user_id = ? AND timestamp >= ?')
    .all(userId, oldSplit.start);

  const sessionCount = sessions.length;
  const baseRP = prefs.split_start_rp ?? STARTING_RP;
  const rpValues = sessions.reduce(
    (acc, s) => {
      acc.total += s.rp;
      acc.running += s.rp;
      if (acc.running > acc.peak) acc.peak = acc.running;
      return acc;
    },
    { total: 0, running: baseRP, peak: baseRP }
  );

  const existing = db
    .prepare('SELECT id FROM split_history WHERE user_id = ? AND split_label = ?')
    .get(userId, prefs.last_split);

  if (!existing) {
    db.prepare(
      'INSERT INTO split_history (user_id, split_label, final_rp, peak_rp, session_count) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, prefs.last_split, baseRP + rpValues.total, rpValues.peak, sessionCount);
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username taken' });

  const hash = await bcrypt.hash(password, 10);
  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  const isAdmin = userCount === 0 ? 1 : 0;

  const result = db.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)').run(username, hash, isAdmin);
  const user = { id: result.lastInsertRowid, username, is_admin: isAdmin };
  db.prepare('INSERT OR IGNORE INTO prefs (user_id) VALUES (?)').run(user.id);

  res.json({ token: sign({ id: user.id, username, is_admin: isAdmin }), user });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  ensurePrefs(user.id);
  res.json({ token: sign({ id: user.id, username: user.username, is_admin: user.is_admin }), user: { id: user.id, username: user.username, is_admin: user.is_admin } });
});

// ── Me ────────────────────────────────────────────────────────────────────────

app.get('/api/me', middleware, (req, res) => {
  const split = getCurrentSplit();
  archiveSplitIfNeeded(req.user.id, split.label);

  const prefs = ensurePrefs(req.user.id);
  const sessions = getUserSessions(req.user.id, split.start);
  const currentRP = deriveRP(prefs, sessions);

  const needsSetup = prefs.split_start_rp == null || prefs.last_split !== split.label;

  if (!needsSetup && prefs.last_split !== split.label) {
    db.prepare('UPDATE prefs SET last_split = ? WHERE user_id = ?').run(split.label, req.user.id);
  }

  res.json({
    user: { id: req.user.id, username: req.user.username, is_admin: req.user.is_admin },
    prefs: {
      goal: prefs.goal,
      override_rp: prefs.override_rp,
      split_start_rp: prefs.split_start_rp,
      last_split: prefs.last_split,
      trn_platform: prefs.trn_platform ?? null,
      trn_username: prefs.trn_username ?? null,
      last_known_rp: prefs.last_known_rp ?? null,
      last_sync_at: prefs.last_sync_at ?? null,
    },
    trnEnabled: Boolean(process.env.TRN_API_KEY),
    pollingActive: isPollingActive(req.user.id),
    split,
    splits: SPLITS,
    currentRP,
    needsSetup,
  });
});

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', middleware, (req, res) => {
  const split = getCurrentSplit();
  const sessions = getUserSessions(req.user.id, split.start);
  res.json(sessions);
});

app.post('/api/sessions', middleware, (req, res) => {
  const { rp } = req.body;
  if (typeof rp !== 'number' || !Number.isInteger(rp)) {
    return res.status(400).json({ error: 'rp must be an integer' });
  }
  if (rp < -9999 || rp > 9999) {
    return res.status(400).json({ error: 'rp out of range' });
  }

  const result = db.prepare('INSERT INTO sessions (user_id, rp) VALUES (?, ?)').run(req.user.id, rp);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
  res.json(session);
});

app.delete('/api/sessions/:id', middleware, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  if (session.user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Prefs ─────────────────────────────────────────────────────────────────────

app.post('/api/prefs', middleware, (req, res) => {
  const { goal, override_rp } = req.body;
  ensurePrefs(req.user.id);

  if (goal !== undefined) {
    db.prepare('UPDATE prefs SET goal = ? WHERE user_id = ?').run(goal, req.user.id);
  }
  if (override_rp !== undefined) {
    db.prepare('UPDATE prefs SET override_rp = ? WHERE user_id = ?').run(override_rp, req.user.id);
  }

  res.json({ ok: true });
});

app.post('/api/setup', middleware, (req, res) => {
  const { current_rp } = req.body;
  if (typeof current_rp !== 'number' || !Number.isInteger(current_rp) || current_rp < 0) {
    return res.status(400).json({ error: 'current_rp must be a non-negative integer' });
  }

  const split = getCurrentSplit();
  const sessions = getUserSessions(req.user.id, split.start);
  const sessionSum = sessions.reduce((sum, s) => sum + s.rp, 0);
  const split_start_rp = current_rp - sessionSum;

  db.prepare('UPDATE prefs SET split_start_rp = ?, last_split = ?, override_rp = NULL WHERE user_id = ?')
    .run(split_start_rp, split.label, req.user.id);

  res.json({ ok: true, split_start_rp });
});

// ── Leaderboard ──────────────────────────────────────────────────────────────

app.get('/api/leaderboard', middleware, (req, res) => {
  const split = getCurrentSplit();
  const users = db.prepare('SELECT id, username, is_admin FROM users').all();

  const board = users.map(user => {
    const prefs = db.prepare('SELECT * FROM prefs WHERE user_id = ?').get(user.id);
    const sessions = getUserSessions(user.id, split.start);
    const currentRP = deriveRP(prefs, sessions);
    const sessionCount = sessions.length;
    const rpGained = sessions.reduce((sum, s) => sum + s.rp, 0);
    return { ...user, currentRP, sessionCount, rpGained };
  });

  board.sort((a, b) => b.currentRP - a.currentRP);
  res.json(board);
});

// ── History ───────────────────────────────────────────────────────────────────

app.get('/api/history', middleware, (req, res) => {
  const history = db
    .prepare('SELECT * FROM split_history WHERE user_id = ? ORDER BY archived_at DESC')
    .all(req.user.id);
  res.json(history);
});

// ── Admin ─────────────────────────────────────────────────────────────────────

app.get('/api/admin/users', middleware, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id, username, is_admin FROM users ORDER BY id').all();
  const split = getCurrentSplit();
  const result = users.map(user => {
    const prefs = db.prepare('SELECT * FROM prefs WHERE user_id = ?').get(user.id);
    const sessions = getUserSessions(user.id, split.start);
    const currentRP = deriveRP(prefs, sessions);
    return { ...user, currentRP, prefs, sessionCount: sessions.length };
  });
  res.json(result);
});

app.delete('/api/admin/users/:id', middleware, adminOnly, (req, res) => {
  const uid = parseInt(req.params.id);
  if (uid === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(uid);
  res.json({ ok: true });
});

app.get('/api/admin/sessions', middleware, adminOnly, (req, res) => {
  const split = getCurrentSplit();
  const sessions = db
    .prepare(`
      SELECT s.*, u.username
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.timestamp >= ?
      ORDER BY s.timestamp DESC
    `)
    .all(split.start);
  res.json(sessions);
});

app.patch('/api/admin/users/:id', middleware, adminOnly, (req, res) => {
  const uid = parseInt(req.params.id);
  const { is_admin } = req.body;
  if (typeof is_admin === 'number') {
    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin, uid);
  }
  res.json({ ok: true });
});

app.delete('/api/admin/sessions/:id', middleware, adminOnly, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.patch('/api/admin/prefs/:userId', middleware, adminOnly, (req, res) => {
  const uid = parseInt(req.params.userId);
  const { split_start_rp } = req.body;
  db.prepare('INSERT OR IGNORE INTO prefs (user_id) VALUES (?)').run(uid);
  if (typeof split_start_rp === 'number') {
    db.prepare('UPDATE prefs SET split_start_rp = ? WHERE user_id = ?').run(split_start_rp, uid);
  }
  res.json({ ok: true });
});

// ── TRN Auto-Sync ─────────────────────────────────────────────────────────────

// Link (or update) TRN account. Fetches current RP to seed last_known_rp.
app.post('/api/link', middleware, async (req, res) => {
  const { platform, username } = req.body;
  if (!platform || !username) return res.status(400).json({ error: 'platform and username required' });
  if (!['origin', 'xbl', 'psn'].includes(platform)) {
    return res.status(400).json({ error: 'platform must be origin, xbl, or psn' });
  }
  if (!process.env.TRN_API_KEY) {
    return res.status(503).json({ error: 'TRN API key not configured on server' });
  }

  try {
    const trnRP = await fetchPlayerRP(platform, username);
    if (trnRP == null) return res.status(422).json({ error: 'Could not read ranked RP from TRN profile' });

    ensurePrefs(req.user.id);
    db.prepare(
      'UPDATE prefs SET trn_platform = ?, trn_username = ?, last_known_rp = ?, last_sync_at = ? WHERE user_id = ?'
    ).run(platform, username, trnRP, new Date().toISOString(), req.user.id);

    res.json({ ok: true, trnRP });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Unlink TRN account.
app.delete('/api/link', middleware, (req, res) => {
  db.prepare(
    'UPDATE prefs SET trn_platform = NULL, trn_username = NULL, last_known_rp = NULL, last_sync_at = NULL WHERE user_id = ?'
  ).run(req.user.id);
  res.json({ ok: true });
});

// Start/stop per-user polling.
app.post('/api/polling/start', middleware, (req, res) => {
  const prefs = db.prepare('SELECT trn_username FROM prefs WHERE user_id = ?').get(req.user.id);
  if (!prefs?.trn_username) return res.status(400).json({ error: 'No TRN account linked' });
  if (!process.env.TRN_API_KEY) return res.status(503).json({ error: 'TRN API key not configured' });
  startPollingForUser(req.user.id);
  res.json({ ok: true, pollingActive: true });
});

app.post('/api/polling/stop', middleware, (req, res) => {
  stopPollingForUser(req.user.id);
  res.json({ ok: true, pollingActive: false });
});

// Manual sync — polls TRN immediately for the current user.
app.post('/api/sync', middleware, async (req, res) => {
  if (!process.env.TRN_API_KEY) {
    return res.status(503).json({ error: 'TRN API key not configured on server' });
  }
  try {
    const result = await pollUser(req.user.id);
    if (!result) return res.status(400).json({ error: 'No TRN account linked' });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── Static ────────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Apex Tracker running on :${PORT}`);
  startPoller();
});

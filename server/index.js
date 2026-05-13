const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
const { sign, middleware, adminOnly } = require('./auth');
const { startPoller, pollUser, fetchPlayerRP } = require('./poller');
const { STARTING_RP, SPLITS, getCurrentSplit, getUserSessions, deriveRP, archiveSplit } = require('./splits');

const app = express();
app.use(express.json());

function ensurePrefs(userId) {
  db.prepare('INSERT OR IGNORE INTO prefs (user_id) VALUES (?)').run(userId);
  return db.prepare('SELECT * FROM prefs WHERE user_id = ?').get(userId);
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
  res.json({
    token: sign({ id: user.id, username: user.username, is_admin: user.is_admin }),
    user: { id: user.id, username: user.username, is_admin: user.is_admin },
  });
});

// ── Me ────────────────────────────────────────────────────────────────────────

app.get('/api/me', middleware, (req, res) => {
  const split = getCurrentSplit();
  const prefs = ensurePrefs(req.user.id);

  // Archive old split if needed (in case poller hasn't run yet)
  if (prefs.last_split && prefs.last_split !== split.label) {
    const old = SPLITS.find(s => s.label === prefs.last_split);
    if (old) archiveSplit(req.user.id, prefs.last_split, old.start);
  }

  const sessions = getUserSessions(req.user.id, split.start);
  const currentRP = deriveRP(prefs, sessions);
  const linked = Boolean(prefs.trn_username);
  const ready = Boolean(prefs.split_start_rp && prefs.last_split === split.label);

  res.json({
    user: { id: req.user.id, username: req.user.username, is_admin: req.user.is_admin },
    prefs: {
      goal: prefs.goal,
      split_start_rp: prefs.split_start_rp,
      last_split: prefs.last_split,
      trn_platform: prefs.trn_platform ?? null,
      trn_username: prefs.trn_username ?? null,
      last_known_rp: prefs.last_known_rp ?? null,
      last_sync_at: prefs.last_sync_at ?? null,
      polling_active: Boolean(prefs.polling_active),
    },
    split,
    splits: SPLITS,
    currentRP,
    trnEnabled: Boolean(process.env.TRN_API_KEY),
    linked,
    ready,
  });
});

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', middleware, (req, res) => {
  const split = getCurrentSplit();
  res.json(getUserSessions(req.user.id, split.start));
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

// ── Prefs (goal only) ─────────────────────────────────────────────────────────

app.post('/api/prefs', middleware, (req, res) => {
  const { goal } = req.body;
  ensurePrefs(req.user.id);
  if (goal !== undefined) {
    db.prepare('UPDATE prefs SET goal = ? WHERE user_id = ?').run(goal || null, req.user.id);
  }
  res.json({ ok: true });
});

// ── TRN Link ──────────────────────────────────────────────────────────────────

// Link account: fetch TRN RP immediately and anchor the baseline.
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

    const split = getCurrentSplit();
    ensurePrefs(req.user.id);
    const sessions = getUserSessions(req.user.id, split.start);
    const sessionSum = sessions.reduce((s, x) => s + x.rp, 0);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE prefs
      SET trn_platform = ?, trn_username = ?, last_known_rp = ?, last_sync_at = ?,
          split_start_rp = ?, last_split = ?
      WHERE user_id = ?
    `).run(platform, username, trnRP, now, trnRP - sessionSum, split.label, req.user.id);

    res.json({ ok: true, trnRP });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── Polling Control ───────────────────────────────────────────────────────────

app.post('/api/polling/start', middleware, (req, res) => {
  ensurePrefs(req.user.id);
  db.prepare('UPDATE prefs SET polling_active = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true, polling_active: true });
});

app.post('/api/polling/stop', middleware, (req, res) => {
  ensurePrefs(req.user.id);
  db.prepare('UPDATE prefs SET polling_active = 0 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true, polling_active: false });
});

app.delete('/api/link', middleware, (req, res) => {
  db.prepare(`
    UPDATE prefs
    SET trn_platform = NULL, trn_username = NULL,
        last_known_rp = NULL, last_sync_at = NULL
    WHERE user_id = ?
  `).run(req.user.id);
  res.json({ ok: true });
});

// ── Leaderboard ──────────────────────────────────────────────────────────────

app.get('/api/leaderboard', middleware, (req, res) => {
  const split = getCurrentSplit();
  const users = db.prepare('SELECT id, username, is_admin FROM users').all();

  const board = users.map(user => {
    const prefs = db.prepare('SELECT * FROM prefs WHERE user_id = ?').get(user.id);
    const sessions = getUserSessions(user.id, split.start);
    const currentRP = deriveRP(prefs, sessions);
    return { ...user, currentRP, sessionCount: sessions.length, rpGained: sessions.reduce((s, x) => s + x.rp, 0) };
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
  const split = getCurrentSplit();
  const users = db.prepare('SELECT id, username, is_admin FROM users ORDER BY id').all();
  const result = users.map(user => {
    const prefs = db.prepare('SELECT * FROM prefs WHERE user_id = ?').get(user.id);
    const sessions = getUserSessions(user.id, split.start);
    return { ...user, currentRP: deriveRP(prefs, sessions), prefs, sessionCount: sessions.length };
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
  const sessions = db.prepare(`
    SELECT s.*, u.username
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.timestamp >= ?
    ORDER BY s.timestamp DESC
  `).all(split.start);
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

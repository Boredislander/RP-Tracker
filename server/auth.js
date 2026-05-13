const crypto = require('crypto');
const db = require('./db');

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(payload) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  db.prepare('INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, payload.id, expiresAt);
  return token;
}

function middleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Unauthorized' });
  const token = header.replace(/^Bearer\s+/, '');
  const now = new Date().toISOString();
  const row = db.prepare('SELECT user_id FROM tokens WHERE token = ? AND expires_at > ?').get(token, now);
  if (!row) return res.status(401).json({ error: 'Invalid token' });
  const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(row.user_id);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

function adminOnly(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Forbidden' });
  next();
}

module.exports = { sign, middleware, adminOnly };

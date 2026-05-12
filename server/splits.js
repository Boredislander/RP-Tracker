const db = require('./db');

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
  return sessions.reduce((sum, s) => sum + s.rp, baseRP);
}

function archiveSplit(userId, splitLabel, splitStart) {
  const existing = db
    .prepare('SELECT id FROM split_history WHERE user_id = ? AND split_label = ?')
    .get(userId, splitLabel);
  if (existing) return;

  const prefs = db.prepare('SELECT * FROM prefs WHERE user_id = ?').get(userId);
  const sessions = getUserSessions(userId, splitStart);
  const baseRP = prefs?.split_start_rp ?? STARTING_RP;

  let running = baseRP;
  let peak = baseRP;
  for (const s of [...sessions].reverse()) {
    running += s.rp;
    if (running > peak) peak = running;
  }

  db.prepare(
    'INSERT INTO split_history (user_id, split_label, final_rp, peak_rp, session_count) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, splitLabel, running, peak, sessions.length);
}

module.exports = { STARTING_RP, SPLITS, getCurrentSplit, getUserSessions, deriveRP, archiveSplit };

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/apex.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rp INTEGER NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS prefs (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    goal TEXT,
    override_rp INTEGER,
    last_split TEXT,
    split_start_rp INTEGER
  );

  CREATE TABLE IF NOT EXISTS split_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    split_label TEXT NOT NULL,
    final_rp INTEGER,
    peak_rp INTEGER,
    session_count INTEGER,
    archived_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`);

// Migrate: add TRN auto-sync columns if they don't exist yet
for (const col of [
  'trn_platform TEXT',
  'trn_username TEXT',
  'last_known_rp INTEGER',
  'last_sync_at TEXT',
]) {
  try {
    db.prepare(`ALTER TABLE prefs ADD COLUMN ${col}`).run();
  } catch {
    // Column already exists — safe to ignore
  }
}

// Migrate: add auto_logged flag to sessions
try {
  db.prepare('ALTER TABLE sessions ADD COLUMN auto_logged INTEGER NOT NULL DEFAULT 0').run();
} catch {
  // Already exists
}

// Migrate: add polling_active flag to prefs
try {
  db.prepare('ALTER TABLE prefs ADD COLUMN polling_active INTEGER NOT NULL DEFAULT 0').run();
} catch {
  // Already exists
}

module.exports = db;

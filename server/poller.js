const db = require('./db');

const TRN_BASE = 'https://public-api.tracker.gg/v2/apex/standard';
const POLL_INTERVAL_MS = 60 * 1000; // 1 minute
const MIN_DELTA = 1;

// In-memory set of user IDs currently being polled.
// Resets to empty on server restart — users re-enable from the UI.
const activeUsers = new Set();

function startPollingForUser(userId) {
  activeUsers.add(userId);
  console.log(`[poller] started for user ${userId} (${activeUsers.size} active)`);
}

function stopPollingForUser(userId) {
  activeUsers.delete(userId);
  console.log(`[poller] stopped for user ${userId} (${activeUsers.size} active)`);
}

function isPollingActive(userId) {
  return activeUsers.has(userId);
}

async function trnFetch(path) {
  const apiKey = process.env.TRN_API_KEY;
  if (!apiKey) throw new Error('TRN_API_KEY not configured');

  const res = await fetch(`${TRN_BASE}${path}`, {
    headers: { 'TRN-Api-Key': apiKey },
  });

  if (res.status === 429) throw new Error('TRN rate limited');
  if (!res.ok) throw new Error(`TRN HTTP ${res.status}`);
  return res.json();
}

function extractRankedRP(data) {
  const segments = data?.data?.segments ?? [];

  const overview = segments.find(s => s.type === 'overview');
  const fromOverview = overview?.stats?.rankScore?.value;
  if (typeof fromOverview === 'number') return Math.round(fromOverview);

  const season = segments.find(s => s.type === 'season' && s.attributes?.isActive);
  const fromSeason = season?.stats?.rankScore?.value;
  if (typeof fromSeason === 'number') return Math.round(fromSeason);

  return null;
}

async function fetchPlayerRP(platform, username) {
  const data = await trnFetch(
    `/profile/${encodeURIComponent(platform)}/${encodeURIComponent(username)}`
  );
  return extractRankedRP(data);
}

// Poll one user. Returns { trnRP, delta, logged } or throws.
async function pollUser(userId) {
  const prefs = db.prepare('SELECT * FROM prefs WHERE user_id = ?').get(userId);
  if (!prefs?.trn_platform || !prefs?.trn_username) return null;

  const trnRP = await fetchPlayerRP(prefs.trn_platform, prefs.trn_username);
  if (trnRP == null) return null;

  const now = new Date().toISOString();
  let delta = 0;
  let logged = false;

  if (prefs.last_known_rp != null) {
    delta = trnRP - prefs.last_known_rp;
    if (Math.abs(delta) >= MIN_DELTA) {
      db.prepare(
        'INSERT INTO sessions (user_id, rp, auto_logged) VALUES (?, ?, 1)'
      ).run(userId, delta);
      db.prepare('UPDATE prefs SET override_rp = NULL WHERE user_id = ?').run(userId);
      logged = true;
    }
  }

  db.prepare(
    'UPDATE prefs SET last_known_rp = ?, last_sync_at = ? WHERE user_id = ?'
  ).run(trnRP, now, userId);

  return { trnRP, delta, logged };
}

// Every minute: poll only the users in activeUsers.
async function tick() {
  if (activeUsers.size === 0) return;

  for (const userId of activeUsers) {
    try {
      await pollUser(userId);
    } catch (e) {
      console.error(`[poller] user ${userId}: ${e.message}`);
    }
    // 2s gap between users to be polite to TRN
    if (activeUsers.size > 1) await new Promise(r => setTimeout(r, 2000));
  }
}

function startPoller() {
  if (!process.env.TRN_API_KEY) {
    console.log('[poller] TRN_API_KEY not set — auto-sync disabled');
    return;
  }
  console.log('[poller] Ready (1min interval, polling off until user enables)');
  setInterval(tick, POLL_INTERVAL_MS);
}

module.exports = { startPoller, pollUser, fetchPlayerRP, startPollingForUser, stopPollingForUser, isPollingActive };

const db = require('./db');
const { getCurrentSplit, getUserSessions, archiveSplit, STARTING_RP } = require('./splits');

const TRN_BASE = 'https://public-api.tracker.gg/v2/apex/standard';
const POLL_INTERVAL_MS = 60 * 1000; // 1 minute
const MIN_DELTA = 1;

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

// Poll one user. Handles split transitions and first-time setup automatically.
async function pollUser(userId) {
  const prefs = db.prepare('SELECT * FROM prefs WHERE user_id = ?').get(userId);
  if (!prefs?.trn_platform || !prefs?.trn_username) return null;

  const split = getCurrentSplit();
  const trnRP = await fetchPlayerRP(prefs.trn_platform, prefs.trn_username);
  if (trnRP == null) return null;

  const now = new Date().toISOString();

  // ── Split transition: archive old split, reset baseline ───────────────────
  if (prefs.last_split && prefs.last_split !== split.label) {
    const oldSplit = require('./splits').SPLITS.find(s => s.label === prefs.last_split);
    if (oldSplit) archiveSplit(userId, prefs.last_split, oldSplit.start);
    // Reset so the new-split baseline gets set below
    db.prepare('UPDATE prefs SET split_start_rp = NULL WHERE user_id = ?').run(userId);
    // Re-read prefs after reset
    const fresh = db.prepare('SELECT split_start_rp FROM prefs WHERE user_id = ?').get(userId);
    prefs.split_start_rp = fresh.split_start_rp;
  }

  // ── First sync or new split: anchor baseline to TRN's current RP ─────────
  if (prefs.split_start_rp == null) {
    const sessions = getUserSessions(userId, split.start);
    const sessionSum = sessions.reduce((s, x) => s + x.rp, 0);
    db.prepare(
      'UPDATE prefs SET split_start_rp = ?, last_split = ?, last_known_rp = ?, last_sync_at = ? WHERE user_id = ?'
    ).run(trnRP - sessionSum, split.label, trnRP, now, userId);
    console.log(`[poller] user ${userId}: baseline set to ${trnRP - sessionSum} (trnRP=${trnRP})`);
    return { trnRP, delta: 0, logged: false };
  }

  // ── Normal poll: diff and log ─────────────────────────────────────────────
  let delta = 0;
  let logged = false;

  if (prefs.last_known_rp != null) {
    delta = trnRP - prefs.last_known_rp;
    if (Math.abs(delta) >= MIN_DELTA) {
      db.prepare(
        'INSERT INTO sessions (user_id, rp, auto_logged) VALUES (?, ?, 1)'
      ).run(userId, delta);
      logged = true;
      console.log(`[poller] user ${userId}: +${delta} RP logged`);
    }
  }

  db.prepare(
    'UPDATE prefs SET last_known_rp = ?, last_sync_at = ?, last_split = ? WHERE user_id = ?'
  ).run(trnRP, now, split.label, userId);

  return { trnRP, delta, logged };
}

// Poll every linked user with polling enabled, every minute.
async function tick() {
  const linked = db
    .prepare("SELECT user_id FROM prefs WHERE trn_username IS NOT NULL AND trn_username != '' AND polling_active = 1")
    .all();

  for (const { user_id } of linked) {
    try {
      await pollUser(user_id);
    } catch (e) {
      console.error(`[poller] user ${user_id}: ${e.message}`);
    }
    if (linked.length > 1) await new Promise(r => setTimeout(r, 2000));
  }
}

function startPoller() {
  if (!process.env.TRN_API_KEY) {
    console.log('[poller] TRN_API_KEY not set — auto-sync disabled');
    return;
  }
  console.log('[poller] Started (1min interval, polling users with polling_active=1)');
  setInterval(tick, POLL_INTERVAL_MS);
}

module.exports = { startPoller, pollUser, fetchPlayerRP };

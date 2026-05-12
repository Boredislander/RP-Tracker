const db = require('./db');

const TRN_BASE = 'https://public-api.tracker.gg/v2/apex/standard';
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_DELTA = 1; // ignore sub-1 RP noise

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

// Extract current ranked RP from a TRN profile response.
// TRN returns an "overview" segment with a rankScore stat.
function extractRankedRP(data) {
  const segments = data?.data?.segments ?? [];

  // Try the overview segment first
  const overview = segments.find(s => s.type === 'overview');
  const fromOverview = overview?.stats?.rankScore?.value;
  if (typeof fromOverview === 'number') return Math.round(fromOverview);

  // Fall back to the active season segment
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

// Poll one user. Returns { rp, delta, logged } or throws.
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
      // Auto-sync is the source of truth — clear any manual override
      db.prepare('UPDATE prefs SET override_rp = NULL WHERE user_id = ?').run(userId);
      logged = true;
    }
  }

  db.prepare(
    'UPDATE prefs SET last_known_rp = ?, last_sync_at = ? WHERE user_id = ?'
  ).run(trnRP, now, userId);

  return { trnRP, delta, logged };
}

// Poll all users that have TRN linked, staggering requests by 2s each.
async function pollAll() {
  const linked = db
    .prepare("SELECT user_id FROM prefs WHERE trn_username IS NOT NULL AND trn_username != ''")
    .all();

  for (const { user_id } of linked) {
    try {
      await pollUser(user_id);
    } catch (e) {
      console.error(`[poller] user ${user_id}: ${e.message}`);
    }
    // Space out requests to respect rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
}

function startPoller() {
  if (!process.env.TRN_API_KEY) {
    console.log('[poller] TRN_API_KEY not set — auto-sync disabled');
    return;
  }
  console.log(`[poller] Auto-sync every ${POLL_INTERVAL_MS / 60000}m`);
  pollAll();
  setInterval(pollAll, POLL_INTERVAL_MS);
}

module.exports = { startPoller, pollUser, fetchPlayerRP };

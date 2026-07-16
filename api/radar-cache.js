// api/radar-cache.js — Cache partagé Radar dans Supabase
// GET  ?key=xxx          → lire le cache
// POST { key, data }     → écrire le cache (TTL 3h)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var SUPABASE_URL = process.env.SUPABASE_URL;
  var SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Variables Supabase manquantes' });
  }

  // ── LIRE LE CACHE ─────────────────────────────────────────────────
  if (req.method === 'GET') {
    var key = req.query.key;
    if (!key) return res.status(400).json({ error: 'Paramètre key manquant' });

    try {
      var now = new Date().toISOString();
      var url = SUPABASE_URL + '/rest/v1/radar_cache'
        + '?cache_key=eq.' + encodeURIComponent(key)
        + '&expires_at=gt.' + encodeURIComponent(now)
        + '&select=data,created_at'
        + '&limit=1';

      var r = await fetch(url, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY
        }
      });

      var rows = await r.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(404).json({ found: false });
      }

      return res.status(200).json({
        found: true,
        data: rows[0].data,
        created_at: rows[0].created_at
      });

    } catch(err) {
      console.error('[radar-cache GET]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── ÉCRIRE LE CACHE ───────────────────────────────────────────────
  if (req.method === 'POST') {
    var { key, data, ttlHours } = req.body;
    if (!key || !data) return res.status(400).json({ error: 'key et data requis' });

    var hours = ttlHours || 3;
    var expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

    try {
      // Upsert (insert ou update si la clé existe déjà)
      var r = await fetch(SUPABASE_URL + '/rest/v1/radar_cache', {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          cache_key: key,
          data: data,
          created_at: new Date().toISOString(),
          expires_at: expiresAt
        })
      });

      if (!r.ok) {
        var err = await r.text();
        console.error('[radar-cache POST]', err);
        return res.status(500).json({ error: err });
      }

      // Nettoyer les entrées expirées (maintenance légère)
      fetch(SUPABASE_URL + '/rest/v1/radar_cache?expires_at=lt.' + encodeURIComponent(new Date().toISOString()), {
        method: 'DELETE',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
      }).catch(function(){});

      return res.status(200).json({ success: true, expires_at: expiresAt });

    } catch(err) {
      console.error('[radar-cache POST]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).end();
}

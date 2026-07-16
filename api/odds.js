// api/odds.js — Proxy The Odds API
// Sécurise la clé côté serveur et résout le CORS

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var API_KEY = process.env.ODDS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Clé ODDS_API_KEY manquante' });

  var sport = req.query.sport || 'soccer_epl';
  var regions = req.query.regions || 'eu,uk';
  var markets = req.query.markets || 'h2h';
  var eventId = req.query.eventId || null;

  var url;
  if (eventId) {
    url = 'https://api.the-odds-api.com/v4/sports/' + sport + '/events/' + eventId + '/odds'
      + '?apiKey=' + API_KEY
      + '&regions=' + regions
      + '&markets=' + markets
      + '&oddsFormat=decimal';
  } else {
    url = 'https://api.the-odds-api.com/v4/sports/' + sport + '/odds'
      + '?apiKey=' + API_KEY
      + '&regions=' + regions
      + '&markets=' + markets
      + '&oddsFormat=decimal';
  }

  try {
    var r = await fetch(url);
    var data = await r.json();

    // Transmettre les headers de quota restants
    var remaining = r.headers.get('x-requests-remaining');
    var used = r.headers.get('x-requests-used');
    if (remaining) res.setHeader('x-requests-remaining', remaining);
    if (used) res.setHeader('x-requests-used', used);

    return res.status(r.status).json(data);
  } catch(err) {
    console.error('[odds proxy]', err.message);
    return res.status(502).json({ error: err.message });
  }
}

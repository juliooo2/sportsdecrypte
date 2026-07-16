// Vercel Serverless Function — Proxy RapidAPI Tennis (ATP WTA ITF)
// Sécurise la clé RapidAPI côté serveur et résout le CORS

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var RAPIDAPI_KEY = process.env.RAPIDAPI_TENNIS_KEY;
  if (!RAPIDAPI_KEY) {
    return res.status(500).json({ error: 'Clé RapidAPI manquante (RAPIDAPI_TENNIS_KEY)' });
  }

  var endpoint = req.query.endpoint;
  if (!endpoint) {
    return res.status(400).json({ error: 'Paramètre "endpoint" manquant' });
  }

  // Endpoints autorisés (sécurité)
  var allowed = [
    'getPlayerFixtures',
    'getPlayerMatchFilters',
    'getH2HFixtures',
    'getDateFixtures',
    'getDateRangeFixtures',
    'getPlayerRanking',
    'ranking/live'
  ];

  // Endpoint ranking/live est un cas spécial avec chemin différent
  var url;
  if (endpoint === 'ranking/live') {
    url = 'https://tennis-api-atp-wta-itf.p.rapidapi.com/tennis/v2/ranking/live';
    if (params.toString()) url += '?' + params.toString();
  } else {
    url = 'https://tennis-api-atp-wta-itf.p.rapidapi.com/tennis/v2/' + endpoint;
    if (params.toString()) url += '?' + params.toString();
  }
  if (allowed.indexOf(endpoint) === -1) {
    return res.status(400).json({ error: 'Endpoint non autorisé' });
  }

  // Construire les query params (transmettre tout sauf "endpoint")
  var params = new URLSearchParams();
  Object.keys(req.query).forEach(function(k) {
    if (k !== 'endpoint') params.append(k, req.query[k]);
  });

  try {
    var response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'tennis-api-atp-wta-itf.p.rapidapi.com'
      }
    });

    var data = await response.json();
    return res.status(response.status).json(data);

  } catch (err) {
    console.error('[tennis-data proxy] Erreur:', err.message);
    return res.status(502).json({ error: 'Erreur RapidAPI Tennis: ' + err.message });
  }
}

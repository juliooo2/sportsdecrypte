// Vercel Serverless Function — Proxy Football-Data.org
// Résout le problème CORS : le navigateur ne parle qu'à ce fichier,
// et ce fichier parle à Football-Data côté serveur (pas de CORS).

export default async function handler(req, res) {
  // CORS headers — autorise ton site Vercel + Netlify (pour tests)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Réponse preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Récupérer le chemin de l'endpoint depuis le paramètre "path"
  // Exemple : /api/football-data?path=/competitions/PL/teams
  var path = req.query.path;
  if (!path) {
    return res.status(400).json({ error: 'Paramètre "path" manquant' });
  }

  // Clé API stockée en variable d'environnement Vercel (jamais dans le code)
  var apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API non configurée (variable FOOTBALL_DATA_API_KEY manquante)' });
  }

  // Construire l'URL Football-Data
  var baseUrl = 'https://api.football-data.org/v4';
  var url = baseUrl + path;

  try {
    var response = await fetch(url, {
      headers: {
        'X-Auth-Token': apiKey
      }
    });

    var data = await response.json();

    // Transmettre le status HTTP exact de Football-Data
    return res.status(response.status).json(data);

  } catch (err) {
    console.error('[football-data proxy] Erreur:', err.message);
    return res.status(502).json({ error: 'Erreur lors de l\'appel à Football-Data: ' + err.message });
  }
}

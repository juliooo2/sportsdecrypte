// Vercel Serverless Function — Proxy Anthropic Claude API
// Résout le problème CORS et sécurise la clé API Anthropic côté serveur

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Réponse preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Seulement les requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Clé API Anthropic stockée en variable d'environnement Vercel
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Clé API Anthropic non configurée (variable ANTHROPIC_API_KEY manquante)'
    });
  }

  try {
    // Transmettre le body tel quel à l'API Anthropic
    var body = req.body;

    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    var data = await response.json();

    // Transmettre le status HTTP exact d'Anthropic
    return res.status(response.status).json(data);

  } catch (err) {
    console.error('[claude proxy] Erreur:', err.message);
    return res.status(502).json({
      error: 'Erreur lors de l\'appel à Claude: ' + err.message
    });
  }
}

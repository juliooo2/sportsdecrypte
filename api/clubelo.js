// Vercel Serverless Function — Proxy ClubElo.com
// ClubElo est une API publique et gratuite mais sans header CORS
// Ce proxy résout le problème CORS côté serveur

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  var club = req.query.club;
  if (!club) {
    return res.status(400).json({ error: 'Paramètre "club" manquant' });
  }

  try {
    var url = 'http://api.clubelo.com/' + encodeURIComponent(club);
    var response = await fetch(url, {
      headers: { 'Accept': 'text/plain' }
    });

    var text = await response.text();

    // Retourner le CSV brut avec le bon Content-Type
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(text);

  } catch (err) {
    console.error('[clubelo proxy] Erreur:', err.message);
    return res.status(502).json({ error: 'Erreur ClubElo: ' + err.message });
  }
}

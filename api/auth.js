// Vercel Serverless Function — Auth Supabase (sans dépendance npm)
// Appels directs à l'API REST Supabase via fetch — comme groq.js et football-data.js

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var SUPABASE_URL = process.env.SUPABASE_URL;
  var SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Variables Supabase manquantes' });
  }

  var action = req.query.action;

  // ── INSCRIPTION ─────────────────────────────────────────────────
  if (action === 'signup') {
    if (req.method !== 'POST') return res.status(405).end();
    var { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    var r = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY
      },
      body: JSON.stringify({
        email: email,
        password: password,
        email_confirm: true
      })
    });

    var data = await r.json();
    if (!r.ok) {
      var msg = data.message || data.error || 'Erreur inscription';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        msg = 'Cet email est déjà utilisé.';
      }
      return res.status(400).json({ error: msg });
    }

    return res.status(200).json({ success: true, userId: data.id });
  }

  // ── CONNEXION ───────────────────────────────────────────────────
  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).end();
    var { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    var r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY
      },
      body: JSON.stringify({ email: email, password: password })
    });

    var data = await r.json();
    if (!r.ok) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    var token  = data.access_token;
    var userId = data.user.id;

    // Récupérer le profil (statut PRO)
    var profileRes = await fetch(
      SUPABASE_URL + '/rest/v1/profiles?id=eq.' + userId + '&select=is_pro,pro_since',
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY
        }
      }
    );
    var profiles = await profileRes.json();
    var profile  = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : {};

    return res.status(200).json({
      success:  true,
      token:    token,
      userId:   userId,
      email:    data.user.email,
      isPro:    profile.is_pro || false,
      proSince: profile.pro_since || null
    });
  }

  // ── VÉRIFICATION TOKEN ──────────────────────────────────────────
  if (action === 'verify') {
    var authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
    var token = authHeader.replace('Bearer ', '');

    var r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + token
      }
    });

    if (!r.ok) return res.status(401).json({ error: 'Token invalide ou expiré' });
    var user = await r.json();

    var profileRes = await fetch(
      SUPABASE_URL + '/rest/v1/profiles?id=eq.' + user.id + '&select=is_pro,pro_since',
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY
        }
      }
    );
    var profiles = await profileRes.json();
    var profile  = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : {};

    return res.status(200).json({
      success:  true,
      userId:   user.id,
      email:    user.email,
      isPro:    profile.is_pro || false,
      proSince: profile.pro_since || null
    });
  }

  // ── MOT DE PASSE OUBLIÉ ─────────────────────────────────────────
  if (action === 'reset-password') {
    if (req.method !== 'POST') return res.status(405).end();
    var { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    await fetch(SUPABASE_URL + '/auth/v1/recover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY
      },
      body: JSON.stringify({
        email: email,
        redirect_to: 'https://sportsdecrypte.vercel.app/auth.html'
      })
    });

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Action inconnue : ' + action });
}

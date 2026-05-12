// Vercel Serverless Function — Création session Stripe Checkout
// Appelé par upgrade.html quand l'utilisateur clique sur "Passer PRO"

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  var STRIPE_SECRET   = process.env.STRIPE_SECRET_KEY;
  var SUPABASE_URL    = process.env.SUPABASE_URL;
  var SERVICE_KEY     = process.env.SUPABASE_SERVICE_KEY;

  if (!STRIPE_SECRET) {
    return res.status(500).json({ error: 'Clé Stripe manquante' });
  }

  // ── Vérifier le token utilisateur ───────────────────────────────
  var authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Non connecté' });
  var token = authHeader.replace('Bearer ', '');

  var userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + token }
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Token invalide' });
  var user = await userRes.json();

  var { priceId, email, plan } = req.body;
  if (!priceId) return res.status(400).json({ error: 'Prix manquant' });

  try {
    // ── Créer la session Stripe Checkout ──────────────────────────
    var checkoutBody = new URLSearchParams({
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'customer_email': email || user.email,
      'client_reference_id': user.id,
      'success_url': 'https://sportsdecrypte.vercel.app/success.html?session_id={CHECKOUT_SESSION_ID}',
      'cancel_url': 'https://sportsdecrypte.vercel.app/upgrade.html',
      'metadata[userId]': user.id,
      'metadata[plan]': plan || 'standard',
      'allow_promotion_codes': 'true',
      'billing_address_collection': 'auto',
    });

    var stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(STRIPE_SECRET + ':').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: checkoutBody.toString()
    });

    var session = await stripeRes.json();

    if (!stripeRes.ok) {
      return res.status(400).json({ error: session.error?.message || 'Erreur Stripe' });
    }

    return res.status(200).json({ sessionId: session.id });

  } catch(err) {
    console.error('[create-checkout] Erreur:', err.message);
    return res.status(502).json({ error: 'Erreur serveur: ' + err.message });
  }
}

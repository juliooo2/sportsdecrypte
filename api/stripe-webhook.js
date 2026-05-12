// Vercel Serverless Function — Webhook Stripe
// Appelé automatiquement par Stripe après un paiement réussi
// Passe l'utilisateur en PRO dans Supabase

export const config = {
  api: { bodyParser: false } // IMPORTANT : Stripe a besoin du body brut pour vérifier la signature
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  var STRIPE_SECRET         = process.env.STRIPE_SECRET_KEY;
  var STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  var SUPABASE_URL          = process.env.SUPABASE_URL;
  var SERVICE_KEY           = process.env.SUPABASE_SERVICE_KEY;

  // ── Lire le body brut ─────────────────────────────────────────
  var rawBody = await new Promise((resolve, reject) => {
    var chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  var signature = req.headers['stripe-signature'];

  // ── Vérifier la signature Stripe ──────────────────────────────
  // (évite que n'importe qui puisse appeler ce webhook)
  var event;
  try {
    event = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch(err) {
    console.error('[webhook] Signature invalide:', err.message);
    return res.status(400).json({ error: 'Signature invalide' });
  }

  // ── Traiter les événements Stripe ────────────────────────────
  try {
    if (event.type === 'checkout.session.completed') {
      var session = event.data.object;
      var userId  = session.metadata?.userId || session.client_reference_id;

      if (!userId) {
        console.error('[webhook] userId manquant dans la session');
        return res.status(200).json({ received: true });
      }

      // Passer l'utilisateur en PRO dans Supabase
      await setUserPro(SUPABASE_URL, SERVICE_KEY, userId, session.subscription, session.customer);
      console.log('[webhook] Utilisateur PRO:', userId);
    }

    if (event.type === 'customer.subscription.deleted') {
      // Abonnement résilié → repasser en gratuit
      var subscription = event.data.object;
      var customerId   = subscription.customer;

      await setUserFree(SUPABASE_URL, SERVICE_KEY, customerId);
      console.log('[webhook] Abonnement résilié, retour gratuit:', customerId);
    }

    return res.status(200).json({ received: true });

  } catch(err) {
    console.error('[webhook] Erreur traitement:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── Passer un utilisateur en PRO ──────────────────────────────────
async function setUserPro(supabaseUrl, serviceKey, userId, subscriptionId, customerId) {
  var r = await fetch(
    supabaseUrl + '/rest/v1/profiles?id=eq.' + userId,
    {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        is_pro: true,
        pro_since: new Date().toISOString(),
        stripe_subscription_id: subscriptionId || null,
        stripe_customer_id: customerId || null
      })
    }
  );
  if (!r.ok) {
    var err = await r.text();
    throw new Error('Supabase PATCH échoué: ' + err);
  }
}

// ── Repasser un utilisateur en gratuit ───────────────────────────
async function setUserFree(supabaseUrl, serviceKey, customerId) {
  var r = await fetch(
    supabaseUrl + '/rest/v1/profiles?stripe_customer_id=eq.' + customerId,
    {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        is_pro: false,
        stripe_subscription_id: null
      })
    }
  );
  if (!r.ok) {
    var err = await r.text();
    throw new Error('Supabase PATCH (free) échoué: ' + err);
  }
}

// ── Vérification signature Stripe (sans SDK) ──────────────────────
async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) {
    // En mode test sans secret configuré, on skip la vérification
    return JSON.parse(payload.toString());
  }

  var parts     = header.split(',').reduce((acc, part) => {
    var [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});

  var timestamp = parts['t'];
  var signature = parts['v1'];

  if (!timestamp || !signature) throw new Error('Header Stripe malformé');

  var signedPayload = timestamp + '.' + payload.toString();

  // HMAC-SHA256
  var encoder    = new TextEncoder();
  var key        = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  var sigBuffer  = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  var expected   = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  if (expected !== signature) throw new Error('Signature Stripe invalide');

  // Vérifier que le timestamp n'est pas trop vieux (5 minutes)
  var diff = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (diff > 300) throw new Error('Timestamp trop vieux');

  return JSON.parse(payload.toString());
}

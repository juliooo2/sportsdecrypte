// api/push.js — Gestion des notifications Web Push
// Endpoints : subscribe, unsubscribe, send

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  var VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
  var VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  var VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@sportsdecrypte.fr';
  var SUPABASE_URL  = process.env.SUPABASE_URL;
  var SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;

  var action = req.body.action;

  // ── SAUVEGARDER UNE SUBSCRIPTION ──────────────────────────────────
  if (action === 'subscribe') {
    var { subscription, userId } = req.body;
    if (!subscription || !userId) return res.status(400).json({ error: 'Données manquantes' });

    try {
      // Sauvegarder dans Supabase table push_subscriptions
      var r = await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions', {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          created_at: new Date().toISOString()
        })
      });
      if (!r.ok) {
        var err = await r.text();
        console.error('[push subscribe] Supabase error:', err);
        // Continuer même si Supabase échoue (stockage local suffisant)
      }
      return res.status(200).json({ success: true });
    } catch(e) {
      console.error('[push subscribe]', e.message);
      return res.status(200).json({ success: true }); // Ne pas bloquer l'utilisateur
    }
  }

  // ── ENVOYER UNE NOTIFICATION ───────────────────────────────────────
  if (action === 'send') {
    var { subscription, payload } = req.body;
    if (!subscription || !payload) return res.status(400).json({ error: 'Données manquantes' });

    try {
      var result = await sendWebPush(subscription, payload, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT);
      return res.status(200).json({ success: true });
    } catch(e) {
      console.error('[push send]', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── ENVOYER À TOUS LES ABONNÉS ────────────────────────────────────
  if (action === 'broadcast') {
    var { payload } = req.body;
    if (!payload) return res.status(400).json({ error: 'Payload manquant' });

    try {
      // Récupérer toutes les subscriptions depuis Supabase
      var r = await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?select=*', {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY
        }
      });
      var subs = await r.json();
      if (!Array.isArray(subs)) return res.status(200).json({ sent: 0 });

      var sent = 0;
      for (var sub of subs) {
        try {
          await sendWebPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT
          );
          sent++;
        } catch(e) {
          // Subscription expirée → la supprimer
          if (e.status === 410) {
            await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint), {
              method: 'DELETE',
              headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY }
            });
          }
        }
      }
      return res.status(200).json({ success: true, sent });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Action inconnue' });
}

// ── Envoi Web Push sans SDK ────────────────────────────────────────────
async function sendWebPush(subscription, payload, vapidPublic, vapidPrivate, vapidSubject) {
  var endpoint = subscription.endpoint;
  var payloadStr = JSON.stringify(payload);

  // Générer le token JWT VAPID
  var token = await generateVapidJWT(endpoint, vapidPublic, vapidPrivate, vapidSubject);

  // Chiffrer le payload avec ECDH + AES-GCM
  var encrypted = await encryptPayload(payloadStr, subscription.keys.p256dh, subscription.keys.auth);

  var headers = {
    'Authorization': 'vapid t=' + token + ', k=' + vapidPublic,
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    'TTL': '86400'
  };

  var r = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: encrypted
  });

  if (!r.ok && r.status !== 201) {
    var err = { status: r.status, message: 'Push failed: ' + r.status };
    throw err;
  }
  return true;
}

// ── Générer JWT VAPID ──────────────────────────────────────────────────
async function generateVapidJWT(endpoint, publicKey, privateKey, subject) {
  var url = new URL(endpoint);
  var audience = url.origin;
  var exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  var header = base64urlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  var payload = base64urlEncode(JSON.stringify({ aud: audience, exp, sub: subject }));
  var sigInput = header + '.' + payload;

  // Importer la clé privée
  var privKeyBytes = base64urlDecode(privateKey);
  var keyData = buildPKCS8(privKeyBytes);
  var cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  var sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(sigInput)
  );

  return sigInput + '.' + base64urlEncode(new Uint8Array(sig));
}

// ── Chiffrement AES-128-GCM ────────────────────────────────────────────
async function encryptPayload(payload, p256dhBase64, authBase64) {
  var encoder = new TextEncoder();
  var payloadBytes = encoder.encode(payload);

  // Décoder les clés du client
  var clientPublicKey = base64urlDecode(p256dhBase64);
  var authSecret = base64urlDecode(authBase64);

  // Générer une paire de clés éphémères
  var serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveKey', 'deriveBits']
  );

  // Importer la clé publique du client
  var clientKey = await crypto.subtle.importKey(
    'raw', clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );

  // Dériver le secret partagé
  var sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    serverKeyPair.privateKey, 256
  );

  // Exporter la clé publique du serveur
  var serverPublicKey = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);

  // Générer le sel
  var salt = crypto.getRandomValues(new Uint8Array(16));

  // Dériver la clé de chiffrement via HKDF
  var ikm = await hkdf(
    new Uint8Array(sharedSecret),
    authSecret,
    buildInfo('auth', new Uint8Array(0), new Uint8Array(0)),
    32
  );

  var contentEncryptionKey = await hkdf(
    ikm, salt,
    buildInfo('aesgcm', new Uint8Array(serverPublicKey), clientPublicKey),
    16
  );

  var nonce = await hkdf(ikm, salt, buildInfo('nonce', new Uint8Array(serverPublicKey), clientPublicKey), 12);

  // Chiffrer
  var key = await crypto.subtle.importKey('raw', contentEncryptionKey, 'AES-GCM', false, ['encrypt']);
  var paddedPayload = new Uint8Array([0, 0, ...payloadBytes]); // 2 bytes de padding
  var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, paddedPayload);

  // Construire le header aes128gcm
  var serverPubBytes = new Uint8Array(serverPublicKey);
  var header = new Uint8Array(21 + serverPubBytes.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false); // rs = 4096
  header[20] = serverPubBytes.length;
  header.set(serverPubBytes, 21);

  // Combiner header + encrypted
  var result = new Uint8Array(header.length + encrypted.byteLength);
  result.set(header, 0);
  result.set(new Uint8Array(encrypted), header.length);
  return result;
}

function buildInfo(type, serverKey, clientKey) {
  var enc = new TextEncoder();
  var typeBytes = enc.encode('Content-Encoding: ' + type + '\0');
  var info = new Uint8Array(typeBytes.length + 1 + 2 + serverKey.length + 2 + clientKey.length);
  var offset = 0;
  info.set(typeBytes, offset); offset += typeBytes.length;
  info[offset++] = 0x41; // 'A'
  new DataView(info.buffer).setUint16(offset, serverKey.length, false); offset += 2;
  info.set(serverKey, offset); offset += serverKey.length;
  new DataView(info.buffer).setUint16(offset, clientKey.length, false); offset += 2;
  info.set(clientKey, offset);
  return info;
}

async function hkdf(ikm, salt, info, length) {
  var saltKey = await crypto.subtle.importKey('raw', salt, 'HKDF', false, ['deriveKey', 'deriveBits']);
  // Extract
  var prk = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), ikm);
  // Expand
  var prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var prev = new Uint8Array(0);
  var output = new Uint8Array(0);
  var counter = 1;
  while (output.length < length) {
    var input = new Uint8Array(prev.length + info.length + 1);
    input.set(prev, 0); input.set(info, prev.length); input[prev.length + info.length] = counter++;
    var t = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, input));
    var combined = new Uint8Array(output.length + t.length);
    combined.set(output, 0); combined.set(t, output.length);
    output = combined;
    prev = t;
  }
  return output.slice(0, length);
}

function buildPKCS8(privKeyBytes) {
  var prefix = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20
  ]);
  var result = new Uint8Array(prefix.length + privKeyBytes.length);
  result.set(prefix, 0); result.set(privKeyBytes, prefix.length);
  return result.buffer;
}

function base64urlEncode(data) {
  var bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  var binary = '';
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  var s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  var binary = atob(s);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

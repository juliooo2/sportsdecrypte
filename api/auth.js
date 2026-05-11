// Vercel Serverless Function — Auth Supabase
// Gère : inscription, connexion, déconnexion, statut PRO

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ─── INSCRIPTION ───────────────────────────────────────────────
  if (action === 'signup') {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true // pas besoin de confirmer l'email pour l'instant
    });

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true, userId: data.user.id });
  }

  // ─── CONNEXION ─────────────────────────────────────────────────
  if (action === 'login') {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    // Récupérer le profil pour savoir s'il est PRO
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_pro, pro_since')
      .eq('id', data.user.id)
      .single();

    return res.status(200).json({
      success: true,
      token: data.session.access_token,
      userId: data.user.id,
      email: data.user.email,
      isPro: profile?.is_pro || false,
      proSince: profile?.pro_since || null
    });
  }

  // ─── VÉRIFICATION TOKEN (statut PRO) ───────────────────────────
  if (action === 'verify') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token manquant' });

    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Token invalide ou expiré' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_pro, pro_since')
      .eq('id', user.id)
      .single();

    return res.status(200).json({
      success: true,
      userId: user.id,
      email: user.email,
      isPro: profile?.is_pro || false,
      proSince: profile?.pro_since || null
    });
  }

  // ─── MOT DE PASSE OUBLIÉ ───────────────────────────────────────
  if (action === 'reset-password') {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://sportsdecrypte.vercel.app/auth.html?action=update-password'
    });

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Action inconnue' });
}

// sd-auth.js — Gestion auth & statut PRO partagé entre toutes les pages
// À inclure en premier script dans index.html, predict.html, Radar.html

(function () {

  // ── Clés localStorage utilisées par le système auth ──────────────
  var TOKEN_KEY   = 'sd_auth_token';
  var EMAIL_KEY   = 'sd_auth_email';
  var USERID_KEY  = 'sd_auth_userid';
  var IS_PRO_KEY  = 'sd_is_pro';
  var LAST_VERIFY = 'sd_auth_last_verify';

  // ── Exposer les infos globalement ─────────────────────────────────
  window.SD_TOKEN   = localStorage.getItem(TOKEN_KEY)  || null;
  window.SD_EMAIL   = localStorage.getItem(EMAIL_KEY)  || null;
  window.SD_USERID  = localStorage.getItem(USERID_KEY) || null;
  window.SD_IS_PRO  = localStorage.getItem(IS_PRO_KEY) === '1';

  // ── Si pas de token → rediriger vers auth.html ────────────────────
  if (!window.SD_TOKEN) {
    window.location.href = '/auth.html';
    return; // stopper l'exécution du reste de la page
  }

  // ── Vérifier le token toutes les 30 minutes maximum ───────────────
  // (évite un appel API à chaque chargement de page)
  var lastVerify = parseInt(localStorage.getItem(LAST_VERIFY) || '0');
  var now        = Date.now();
  var THIRTY_MIN = 30 * 60 * 1000;

  if (now - lastVerify > THIRTY_MIN) {
    fetch('/api/auth?action=verify', {
      headers: { 'Authorization': 'Bearer ' + window.SD_TOKEN }
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.success) {
        // Token expiré ou invalide → déconnexion
        SD_logout(true);
        return;
      }
      // Mettre à jour le statut PRO (peut avoir changé depuis la dernière connexion)
      var isPro = data.isPro ? '1' : '0';
      localStorage.setItem(IS_PRO_KEY,  isPro);
      localStorage.setItem(LAST_VERIFY, now.toString());
      window.SD_IS_PRO = data.isPro;

      // Mettre à jour l'UI PRO si la page est déjà chargée
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        SD_updateProUI();
      } else {
        document.addEventListener('DOMContentLoaded', SD_updateProUI);
      }
    })
    .catch(function () {
      // Erreur réseau → on garde le statut en cache, pas de déconnexion
      console.warn('[sd-auth] Vérification token échouée (réseau). Statut PRO en cache utilisé.');
    });
  }

  // ── Déconnexion ───────────────────────────────────────────────────
  window.SD_logout = function (silent) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(USERID_KEY);
    localStorage.removeItem(IS_PRO_KEY);
    localStorage.removeItem(LAST_VERIFY);
    window.SD_TOKEN  = null;
    window.SD_EMAIL  = null;
    window.SD_USERID = null;
    window.SD_IS_PRO = false;
    if (!silent) {
      window.location.href = '/auth.html';
    } else {
      window.location.href = '/auth.html';
    }
  };

  // ── Vérifier si une feature est accessible ────────────────────────
  // Usage dans le code : if (!SD_canUse('predict_sports')) { SD_showPaywall('...'); return; }
  var PRO_FEATURES = [
    'predict_sports',      // Tennis, Basket, Hockey, MMA, Rugby dans Predict
    'predict_unlimited',   // Plus de 3 analyses Predict/semaine
    'radar',               // Page Radar complète
    'casino_session',      // Session casino
    'multi_bankroll',      // Plusieurs comptes bankroll
    'export_data',         // Export CSV/JSON
    'history_unlimited',   // Historique > 3 mois
    'simulator',           // Simulateur de paris
    'strategy_compare',    // Comparateur de stratégies
    'value_bet_unlimited', // Plus de 3 Value Bets/semaine
    'ia_coach_full',       // Tous les modes IA Coach sauf conversation libre
    'ia_coach_messages',   // Plus de 3 messages IA/semaine
    'period_compare',      // Comparateur deux périodes
    'benchmark',           // Benchmark vs moyenne
    'tipster_profile',     // Profil tipster public
    'objectives_unlimited' // Plus d'1 objectif
  ];

  window.SD_canUse = function (feature) {
    if (window.SD_IS_PRO) return true;
    return PRO_FEATURES.indexOf(feature) === -1;
  };

  // ── Afficher le paywall ───────────────────────────────────────────
  // Appelé quand une feature PRO est touchée par un utilisateur gratuit
  window.SD_showPaywall = function (featureLabel) {
    // Supprimer un éventuel paywall déjà ouvert
    var existing = document.getElementById('sd-paywall-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'sd-paywall-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(5,5,13,0.92)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:20px', 'backdrop-filter:blur(6px)'
    ].join(';');

    overlay.innerHTML = [
      '<div style="background:#111120;border:1px solid rgba(245,200,66,0.2);border-radius:24px;',
      'padding:32px 24px;max-width:340px;width:100%;text-align:center;',
      'box-shadow:0 8px 40px rgba(245,200,66,0.1);">',

        '<div style="font-size:36px;margin-bottom:12px;">💎</div>',

        '<div style="font-family:\'Bebas Neue\',cursive;font-size:26px;letter-spacing:3px;',
        'background:linear-gradient(90deg,#ff6b35,#ffd700);',
        '-webkit-background-clip:text;-webkit-text-fill-color:transparent;',
        'background-clip:text;margin-bottom:8px;">FONCTIONNALITÉ PRO</div>',

        '<div style="font-size:13px;color:rgba(240,240,255,0.6);margin-bottom:4px;">',
        featureLabel || 'Cette fonctionnalité', '</div>',
        '<div style="font-size:12px;color:rgba(240,240,255,0.35);margin-bottom:24px;">',
        'est réservée aux abonnés PRO.</div>',

        '<div style="background:rgba(245,200,66,0.06);border:1px solid rgba(245,200,66,0.12);',
        'border-radius:12px;padding:16px;margin-bottom:24px;text-align:left;">',
          '<div style="font-size:9px;letter-spacing:2px;color:#f5c842;font-weight:700;',
          'margin-bottom:10px;">✦ AVEC PRO</div>',
          '<div style="font-size:12px;color:rgba(240,240,255,0.6);line-height:1.8;">',
          '🔮 Predict tous sports illimité<br>',
          '📡 Radar en temps réel<br>',
          '🤖 IA Coach 5 modes complets<br>',
          '📊 Stats avancées & export<br>',
          '🏦 Multi-bankroll illimité',
          '</div>',
        '</div>',

        '<div style="font-family:\'Bebas Neue\',cursive;font-size:28px;',
        'color:#ffd700;margin-bottom:4px;">9,99€ / mois</div>',
        '<div style="font-size:11px;color:rgba(240,240,255,0.35);margin-bottom:20px;">',
        'ou 79€/an · Résiliable à tout moment</div>',

        '<button onclick="window.location.href=\'/upgrade.html\'" style="',
        'width:100%;padding:16px;border-radius:14px;border:none;',
        'background:linear-gradient(135deg,#ff6b35,#ffd700);',
        'color:#000;font-family:\'Syne\',sans-serif;font-size:13px;',
        'font-weight:800;letter-spacing:2px;text-transform:uppercase;',
        'cursor:pointer;margin-bottom:12px;">',
        'Passer PRO →</button>',

        '<button onclick="document.getElementById(\'sd-paywall-overlay\').remove()" style="',
        'width:100%;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,0.07);',
        'background:transparent;color:rgba(240,240,255,0.4);',
        'font-family:\'Syne\',sans-serif;font-size:12px;cursor:pointer;">',
        'Pas maintenant</button>',

      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    // Fermer en cliquant en dehors
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
  };

  // ── Mettre à jour l'UI selon le statut PRO ────────────────────────
  // Ajoute un badge PRO dans la nav si l'utilisateur est PRO
  // et affiche l'email de connexion
  window.SD_updateProUI = function () {
    // Badge PRO dans le header (si l'élément existe)
    var proElements = document.querySelectorAll('.sd-pro-badge');
    proElements.forEach(function (el) {
      el.style.display = window.SD_IS_PRO ? 'inline-block' : 'none';
    });

    // Afficher l'email connecté (si l'élément existe)
    var emailEls = document.querySelectorAll('.sd-user-email');
    emailEls.forEach(function (el) {
      el.textContent = window.SD_EMAIL || '';
    });
  };

  // Appliquer l'UI dès que le DOM est prêt
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    SD_updateProUI();
  } else {
    document.addEventListener('DOMContentLoaded', SD_updateProUI);
  }

})();

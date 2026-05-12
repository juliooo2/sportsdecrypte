// sd-gates.js — Gatekeeping PRO avec aperçus floutés
// À inclure après sd-auth.js dans index.html, predict.html et Radar.html

(function () {
  // ── Attendre que le DOM soit prêt ─────────────────────────────────
  function ready(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // ── Compteurs hebdomadaires (reset le lundi) ──────────────────────
  function getWeekKey() {
    var d = new Date();
    var day = d.getDay() || 7;
    var monday = new Date(d);
    monday.setDate(d.getDate() - day + 1);
    return monday.toISOString().slice(0, 10);
  }

  function getCount(key) {
    var data = JSON.parse(localStorage.getItem('sd_gate_counts') || '{}');
    var weekKey = getWeekKey();
    if (data._week !== weekKey) return 0;
    return data[key] || 0;
  }

  function incCount(key) {
    var data = JSON.parse(localStorage.getItem('sd_gate_counts') || '{}');
    var weekKey = getWeekKey();
    if (data._week !== weekKey) { data = { _week: weekKey }; }
    data[key] = (data[key] || 0) + 1;
    localStorage.setItem('sd_gate_counts', JSON.stringify(data));
    return data[key];
  }

  // ── Overlay flouté générique ──────────────────────────────────────
  function blurOverlay(label, description) {
    return [
      '<div style="position:relative;overflow:hidden;border-radius:16px;margin-top:12px;">',
        // Contenu flouté (faux aperçu)
        '<div style="filter:blur(5px);pointer-events:none;padding:16px;background:var(--bg3);border:1px solid rgba(255,255,255,0.06);border-radius:16px;">',
          '<div style="height:16px;background:rgba(255,255,255,0.06);border-radius:8px;margin-bottom:10px;width:70%"></div>',
          '<div style="height:12px;background:rgba(255,255,255,0.04);border-radius:6px;margin-bottom:8px;width:90%"></div>',
          '<div style="height:12px;background:rgba(255,255,255,0.04);border-radius:6px;margin-bottom:8px;width:60%"></div>',
          '<div style="display:flex;gap:8px;margin-top:12px;">',
            '<div style="height:36px;flex:1;background:rgba(245,200,66,0.12);border-radius:10px;"></div>',
            '<div style="height:36px;flex:1;background:rgba(255,107,53,0.08);border-radius:10px;"></div>',
          '</div>',
        '</div>',
        // Overlay de verrouillage
        '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,5,13,0.75);border-radius:16px;backdrop-filter:blur(2px);">',
          '<div style="font-size:28px;margin-bottom:8px;">💎</div>',
          '<div style="font-family:\'Bebas Neue\',cursive;font-size:18px;letter-spacing:3px;background:linear-gradient(90deg,#ff6b35,#ffd700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:6px;">' + label + '</div>',
          '<div style="font-size:11px;color:rgba(240,240,255,0.5);text-align:center;padding:0 20px;margin-bottom:14px;line-height:1.5;">' + description + '</div>',
          '<button onclick="window.location.href=\'/upgrade.html\'" style="background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;border:none;border-radius:12px;padding:10px 20px;font-family:\'Syne\',sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;cursor:pointer;">',
            'Passer PRO →',
          '</button>',
        '</div>',
      '</div>'
    ].join('');
  }

  // ── Détecter la page courante ─────────────────────────────────────
  var page = window.location.pathname;
  var isIndex   = page.includes('index') || page === '/' || page.endsWith('/');
  var isPredict = page.includes('predict');
  var isRadar   = page.includes('Radar') || page.includes('radar');

  // ════════════════════════════════════════════════════════════════
  // INDEX.HTML — Gatekeeping
  // ════════════════════════════════════════════════════════════════
  if (isIndex) {
    ready(function () {
      if (window.SD_IS_PRO) return; // PRO = accès total

      // ── 1. Session Casino ──────────────────────────────────────
      var casinoBtn = document.getElementById('type-casino-btn');
      if (casinoBtn) {
        casinoBtn.addEventListener('click', function (e) {
          e.stopImmediatePropagation();
          SD_showPaywall('Session Casino — suivi de vos gains et pertes casino');
        }, true);

        // Ajouter un badge 🔒
        casinoBtn.style.position = 'relative';
        var lock = document.createElement('div');
        lock.style.cssText = 'position:absolute;top:4px;right:4px;font-size:10px;';
        lock.textContent = '🔒';
        casinoBtn.appendChild(lock);
      }

      // ── 2. Multi-bankroll ──────────────────────────────────────
      var origAddAccount = window.addAccount;
      if (origAddAccount) {
        window.addAccount = function () {
          var accounts = JSON.parse(localStorage.getItem('sd_accounts') || '[]');
          if (accounts.length >= 1) {
            SD_showPaywall('Multi-bankroll — gérez plusieurs comptes de mise');
            return;
          }
          origAddAccount.apply(this, arguments);
        };
      }

      // ── 3. Export CSV / JSON ───────────────────────────────────
      var origExportCSV = window.exportCSV;
      if (origExportCSV) {
        window.exportCSV = function () {
          if (!window.SD_IS_PRO) { SD_showPaywall('Export CSV — téléchargez tout votre historique'); return; }
          origExportCSV.apply(this, arguments);
        };
      }
      var origExportBackup = window.exportBackup;
      if (origExportBackup) {
        window.exportBackup = function () {
          if (!window.SD_IS_PRO) { SD_showPaywall('Export JSON — sauvegarde complète de vos données'); return; }
          origExportBackup.apply(this, arguments);
        };
      }

      // ── 4. Profil Tipster ──────────────────────────────────────
      var origTipster = window.shareTipsterProfile;
      if (origTipster) {
        window.shareTipsterProfile = function () {
          if (!window.SD_IS_PRO) { SD_showPaywall('Profil Tipster Public — partagez vos performances'); return; }
          origTipster.apply(this, arguments);
        };
      }

      // ── 5. Objectifs — limité à 1 ─────────────────────────────
      var origAddGoal = window.addGoal;
      if (origAddGoal) {
        window.addGoal = function () {
          var goals = (window.state && window.state.goals) ? window.state.goals.filter(function(g){ return !g.completed; }) : [];
          if (goals.length >= 1) {
            SD_showPaywall('Objectifs illimités — créez autant d\'objectifs que vous voulez');
            return;
          }
          origAddGoal.apply(this, arguments);
        };
      }

      // ── 6. IA Coach — modes PRO + limite conversation libre ────
      var origSelectAIMode = window.selectAIMode;
      if (origSelectAIMode) {
        window.selectAIMode = function (mode, el) {
          var proModes = ['coach', 'postmatch', 'suggestions'];
          if (proModes.indexOf(mode) !== -1) {
            SD_showPaywall('IA Coach ' + mode + ' — analyses personnalisées par l\'IA');
            return;
          }
          origSelectAIMode.apply(this, arguments);
        };
      }

      // Limite conversation libre : 3 messages/semaine
      var origSendCoachIA = window.sendCoachIA;
      if (origSendCoachIA) {
        window.sendCoachIA = async function () {
          var mode = window.state && window.state.coachMode;
          if (mode === 'chat' || !mode) {
            var count = getCount('coach_messages');
            if (count >= 3) {
              SD_showPaywall('IA Coach illimité — plus de 3 messages par semaine');
              return;
            }
            incCount('coach_messages');
          }
          return origSendCoachIA.apply(this, arguments);
        };
      }

      // ── 7. Benchmark & Comparateur stratégies — aperçu flouté ─
      var origNavTo = window.navTo;
      if (origNavTo) {
        window.navTo = function (id, el) {
          if (id === 'screen-benchmark') {
            var screen = document.getElementById('screen-benchmark');
            if (screen && !screen.dataset.gated) {
              screen.dataset.gated = '1';
              var inner = screen.innerHTML;
              screen.innerHTML = inner + blurOverlay(
                'BENCHMARK PRO',
                'Comparez vos performances avec la moyenne des parieurs et identifiez vos axes d\'amélioration.'
              );
            }
          }
          if (id === 'screen-strat-compare') {
            var screen2 = document.getElementById('screen-strat-compare');
            if (screen2 && !screen2.dataset.gated) {
              screen2.dataset.gated = '1';
              screen2.innerHTML = screen2.innerHTML + blurOverlay(
                'COMPARATEUR PRO',
                'Comparez vos différentes stratégies de paris et trouvez celle qui performe le mieux.'
              );
            }
          }
          origNavTo.apply(this, arguments);
        };
      }

      // ── 8. Historique — limiter à 3 mois ──────────────────────
      // (on ajoute un badge sur le filtre "tout" pour signaler la limite)
      ready(function() {
        var allChip = document.querySelector('[data-period="all"]');
        if (allChip && !window.SD_IS_PRO) {
          allChip.style.position = 'relative';
          var badge = document.createElement('span');
          badge.style.cssText = 'font-size:8px;margin-left:4px;opacity:0.5;';
          badge.textContent = '(3 mois)';
          allChip.appendChild(badge);
        }
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  // PREDICT.HTML — Gatekeeping
  // ════════════════════════════════════════════════════════════════
  if (isPredict) {
    ready(function () {
      if (window.SD_IS_PRO) return;

      var PRO_SPORTS = ['tennis', 'basket', 'hockey', 'mma', 'rugby', 'tendances', 'live', 'precision'];

      var origSetSport = window.setSport;
      if (origSetSport) {
        window.setSport = function (sport) {
          if (PRO_SPORTS.indexOf(sport) !== -1) {
            // Afficher un aperçu flouté dans la zone de contenu
            var contentZone = document.querySelector('.content.active') || document.querySelector('#content-football');
            if (contentZone) {
              // Remettre le sport football actif visuellement
              document.querySelectorAll('.sport-tab').forEach(function(t){ t.classList.remove('active'); });
              var footballTab = document.getElementById('tab-football');
              if (footballTab) footballTab.classList.add('active');

              // Injecter l'aperçu flouté
              var sportEmojis = { tennis:'🎾', basket:'🏀', hockey:'🏒', mma:'🥊', rugby:'🏉', tendances:'🔥', live:'🔴', precision:'🎯' };
              var emoji = sportEmojis[sport] || '🔒';
              var sportLabel = sport.charAt(0).toUpperCase() + sport.slice(1);

              var existing = document.getElementById('sd-predict-blur');
              if (existing) existing.remove();

              var blurEl = document.createElement('div');
              blurEl.id = 'sd-predict-blur';
              blurEl.innerHTML = [
                '<div style="padding:20px 16px;">',
                  '<div style="text-align:center;padding:32px 20px;background:var(--bg3,#111120);border:1px solid rgba(255,255,255,0.06);border-radius:20px;position:relative;overflow:hidden;">',
                    // Fond flouté simulé
                    '<div style="filter:blur(6px);opacity:0.4;pointer-events:none;margin-bottom:-80px;">',
                      '<div style="height:20px;background:rgba(245,200,66,0.15);border-radius:8px;margin-bottom:10px;"></div>',
                      '<div style="height:14px;background:rgba(255,255,255,0.06);border-radius:6px;margin-bottom:8px;width:80%"></div>',
                      '<div style="height:14px;background:rgba(255,255,255,0.04);border-radius:6px;margin-bottom:8px;"></div>',
                      '<div style="display:flex;gap:8px;margin-top:12px;">',
                        '<div style="height:44px;flex:1;background:rgba(245,200,66,0.1);border-radius:12px;"></div>',
                        '<div style="height:44px;flex:1;background:rgba(255,107,53,0.06);border-radius:12px;"></div>',
                        '<div style="height:44px;flex:1;background:rgba(0,212,170,0.06);border-radius:12px;"></div>',
                      '</div>',
                    '</div>',
                    // Overlay
                    '<div style="position:relative;z-index:2;">',
                      '<div style="font-size:36px;margin-bottom:12px;">' + emoji + '</div>',
                      '<div style="font-family:\'Bebas Neue\',cursive;font-size:22px;letter-spacing:3px;background:linear-gradient(90deg,#ff6b35,#ffd700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px;">PREDICT ' + sportLabel.toUpperCase() + '</div>',
                      '<div style="font-size:12px;color:rgba(240,240,255,0.5);margin-bottom:20px;line-height:1.6;">Analyses ' + sportLabel + ' disponibles avec le plan PRO.<br>Modèles spécifiques, stats avancées et recommandations IA.</div>',
                      '<button onclick="window.location.href=\'/upgrade.html\'" style="background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;border:none;border-radius:14px;padding:14px 28px;font-family:\'Syne\',sans-serif;font-size:12px;font-weight:800;letter-spacing:2px;cursor:pointer;">',
                        'DÉBLOQUER PREDICT ' + sportLabel.toUpperCase() + ' →',
                      '</button>',
                    '</div>',
                  '</div>',
                '</div>'
              ].join('');

              // Insérer avant le premier .content
              var firstContent = document.querySelector('.content');
              if (firstContent && firstContent.parentNode) {
                firstContent.parentNode.insertBefore(blurEl, firstContent);
              }
            }
            return; // Ne pas appeler origSetSport
          }

          // Supprimer l'aperçu si on revient au foot
          var existing2 = document.getElementById('sd-predict-blur');
          if (existing2) existing2.remove();

          origSetSport.apply(this, arguments);
        };
      }

      // Limite Football : 3 analyses/semaine
      // On intercepte le bouton d'analyse principal
      ready(function() {
        // Chercher le bouton "Analyser" dans le contenu football
        document.addEventListener('click', function(e) {
          var btn = e.target.closest('button');
          if (!btn) return;
          var txt = btn.textContent || '';
          if (txt.includes('ANALYSER') || txt.includes('PREDICT') || txt.includes('CALCULER')) {
            if (!window.SD_IS_PRO) {
              var count = getCount('predict_football');
              if (count >= 3) {
                e.stopImmediatePropagation();
                e.preventDefault();
                SD_showPaywall('Predict illimité — plus de 3 analyses par semaine');
                return;
              }
              incCount('predict_football');
            }
          }
        }, true);
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  // RADAR.HTML — Aperçu flouté après les 3 premiers matchs
  // ════════════════════════════════════════════════════════════════
  if (isRadar) {
    ready(function () {
      if (window.SD_IS_PRO) return;

      // Intercepter renderMatches pour flouter après le 3ème match
      var origRenderMatches = window.renderMatches;
      if (origRenderMatches) {
        window.renderMatches = function () {
          origRenderMatches.apply(this, arguments);

          // Attendre que le DOM soit mis à jour
          setTimeout(function () {
            var content = document.getElementById('content');
            if (!content) return;

            var matches = content.querySelectorAll('.match');
            if (matches.length <= 3) return; // Moins de 3 matchs, pas besoin de flouter

            // Flouter tous les matchs après le 3ème
            matches.forEach(function (m, i) {
              if (i >= 3 && !m.dataset.blurred) {
                m.dataset.blurred = '1';
                m.style.position = 'relative';
                m.style.filter = 'blur(4px)';
                m.style.pointerEvents = 'none';
                m.style.userSelect = 'none';
              }
            });

            // Ajouter un seul overlay PRO après le 3ème match si pas encore présent
            if (!document.getElementById('sd-radar-overlay')) {
              var overlay = document.createElement('div');
              overlay.id = 'sd-radar-overlay';
              overlay.style.cssText = [
                'position:sticky', 'bottom:80px', 'left:0', 'right:0',
                'margin:0 16px 16px', 'z-index:100',
                'background:rgba(5,5,13,0.95)',
                'border:1px solid rgba(245,200,66,0.25)',
                'border-radius:20px',
                'padding:24px 20px',
                'text-align:center',
                'backdrop-filter:blur(8px)',
                'box-shadow:0 -8px 32px rgba(245,200,66,0.1)'
              ].join(';');

              var visibleCount = 3;
              var totalCount = matches.length;

              overlay.innerHTML = [
                '<div style="font-size:28px;margin-bottom:8px;">📡</div>',
                '<div style="font-family:\'Bebas Neue\',cursive;font-size:22px;letter-spacing:3px;background:linear-gradient(90deg,#ff6b35,#ffd700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:6px;">',
                  (totalCount - visibleCount) + ' MATCHS SUPPLÉMENTAIRES',
                '</div>',
                '<div style="font-size:12px;color:rgba(240,240,255,0.5);margin-bottom:16px;line-height:1.5;">',
                  'Tu vois <strong style="color:rgba(240,240,255,0.8);">' + visibleCount + ' matchs</strong> sur <strong style="color:rgba(240,240,255,0.8);">' + totalCount + '</strong>.<br>',
                  'Passe PRO pour voir toutes les opportunités en temps réel.',
                '</div>',
                '<button onclick="window.location.href=\'/upgrade.html\'" style="',
                  'background:linear-gradient(135deg,#ff6b35,#ffd700);color:#000;border:none;',
                  'border-radius:14px;padding:14px 28px;',
                  'font-family:\'Syne\',sans-serif;font-size:12px;font-weight:800;',
                  'letter-spacing:2px;text-transform:uppercase;cursor:pointer;width:100%;',
                '">',
                  'VOIR TOUS LES VALUE BETS →',
                '</button>'
              ].join('');

              // Insérer après le 3ème match
              var thirdMatch = matches[2];
              if (thirdMatch && thirdMatch.parentNode) {
                thirdMatch.parentNode.insertBefore(overlay, thirdMatch.nextSibling);
              }
            }
          }, 100);
        };
      }
    });
  }

})();

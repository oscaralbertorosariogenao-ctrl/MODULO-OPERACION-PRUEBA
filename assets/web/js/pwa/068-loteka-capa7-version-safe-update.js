
(function(){
  'use strict';

  /*
    LOTEKA / Grupo Ortiz · CAPA 7
    Detector seguro de versión para index.html.

    Regla clave:
    - Este HTML tiene una versión interna.
    - version.json se sube de último.
    - Si version.json tiene una versión diferente, se muestra "Nueva versión disponible".
    - Nunca recarga solo. El usuario decide cuándo actualizar.
  */

  var LOTEKA_HTML_VERSION = String(document.querySelector('meta[name="grupo-ortiz-build"]')?.content || '').trim();
  var VERSION_URL = '/version.json';
  var DISMISSED_KEY = 'loteka_update_dismissed_session_version';
  var APPLIED_KEY = 'loteka_update_applied_version';
  var CHECK_INTERVAL_MS = 120000;
  var CHECK_DELAY_MS = 2200;
  var isChecking = false;
  var bannerId = 'lotekaSafeUpdateBanner';
  var pendingInfo = null;

  function isLocalDev(){
    var h = (location.hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || location.protocol === 'file:';
  }

  function safeText(value){
    return String(value == null ? '' : value).replace(/[<>&"']/g, function(ch){
      return ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#039;'})[ch];
    });
  }

  function ensureStyles(){
    if(document.getElementById('lotekaSafeUpdateStyles')) return;

    var style = document.createElement('style');
    style.id = 'lotekaSafeUpdateStyles';
    style.textContent = [
      '#'+bannerId+'{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:12px;max-width:min(650px,calc(100vw - 28px));padding:14px 15px;border-radius:18px;background:linear-gradient(135deg,rgba(7,29,50,.98),rgba(8,74,110,.98));border:1px solid rgba(125,211,252,.38);box-shadow:0 24px 70px rgba(0,0,0,.42);color:#eaf6ff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '#'+bannerId+' .ltk-safe-dot{width:11px;height:11px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 6px rgba(34,197,94,.14);flex:0 0 auto}',
      '#'+bannerId+' .ltk-safe-copy{min-width:0;line-height:1.25}',
      '#'+bannerId+' .ltk-safe-title{font-weight:950;font-size:14px;letter-spacing:.01em}',
      '#'+bannerId+' .ltk-safe-sub{font-size:12px;color:#b8d7ee;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#'+bannerId+' .ltk-safe-actions{display:flex;align-items:center;gap:8px;margin-left:auto;flex:0 0 auto}',
      '#'+bannerId+' button{border:0;border-radius:12px;padding:9px 12px;font-weight:900;cursor:pointer;font-family:inherit}',
      '#'+bannerId+' .ltk-safe-update{background:#67e8f9;color:#06233d}',
      '#'+bannerId+' .ltk-safe-close{background:rgba(255,255,255,.10);color:#eaf6ff}',
      '@media(max-width:640px){#'+bannerId+'{left:12px;right:12px;bottom:14px;transform:none;align-items:flex-start;flex-wrap:wrap}#'+bannerId+' .ltk-safe-actions{width:100%;margin-left:0;justify-content:flex-end}#'+bannerId+' .ltk-safe-sub{white-space:normal}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function showBanner(info){
    if(document.getElementById(bannerId)) return;
    if(!document.body) return;

    pendingInfo = info || {};
    var pendingVersion = String(pendingInfo.version || 'nueva');
    var title = pendingInfo.name || 'Hay una actualización nueva del sistema.';

    try{
      if(sessionStorage.getItem(DISMISSED_KEY) === pendingVersion) return;
    }catch(e){}

    ensureStyles();

    var div = document.createElement('div');
    div.id = bannerId;
    div.setAttribute('role', 'status');
    div.innerHTML = ''+
      '<span class="ltk-safe-dot" aria-hidden="true"></span>'+
      '<div class="ltk-safe-copy">'+
        '<div class="ltk-safe-title">Nueva versión disponible</div>'+
        '<div class="ltk-safe-sub">'+safeText(title)+' · Versión: '+safeText(pendingVersion)+'</div>'+
      '</div>'+
      '<div class="ltk-safe-actions">'+
        '<button type="button" class="ltk-safe-update">Actualizar ahora</button>'+
        '<button type="button" class="ltk-safe-close" title="Ocultar por ahora">Luego</button>'+
      '</div>';

    document.body.appendChild(div);

    div.querySelector('.ltk-safe-close').addEventListener('click', function(){
      try{ sessionStorage.setItem(DISMISSED_KEY, pendingVersion); }catch(e){}
      div.remove();
    });

    div.querySelector('.ltk-safe-update').addEventListener('click', activateNewVersion);
  }

  async function clearLotekaCaches(){
    try{
      if(!('caches' in window)) return;
      var keys = await caches.keys();
      await Promise.all(
        keys
          .filter(function(key){ return /^loteka-/i.test(key); })
          .map(function(key){ return caches.delete(key); })
      );
    }catch(e){
      console.warn('[LOTEKA] No se pudo limpiar cache antes de actualizar:', e);
    }
  }

  async function activateNewVersion(){
    var acceptedVersion = String((pendingInfo && pendingInfo.version) || '');
    var banner = document.getElementById(bannerId);

    // La misma versión aceptada no debe volver a anunciarse después de recargar.
    try{
      if(acceptedVersion) localStorage.setItem(APPLIED_KEY, acceptedVersion);
      if(acceptedVersion) sessionStorage.setItem(DISMISSED_KEY, acceptedVersion);
    }catch(e){}

    if(banner){
      var button = banner.querySelector('.ltk-safe-update');
      if(button){
        button.disabled = true;
        button.textContent = 'Actualizando…';
      }
    }

    await clearLotekaCaches();

    try{
      if('serviceWorker' in navigator){
        var reg = await navigator.serviceWorker.getRegistration('/');
        if(reg){
          await reg.update();

          if(reg.waiting){
            var refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', function(){
              if(refreshing) return;
              refreshing = true;
              window.location.reload();
            });

            reg.waiting.postMessage({ type:'LOTEKA_ACTIVATE_NEW_VERSION' });
            setTimeout(function(){ window.location.reload(); }, 1200);
            return;
          }
        }
      }
    }catch(e){
      console.warn('[LOTEKA] No se pudo activar Service Worker nuevo:', e);
    }

    window.location.reload();
  }

  async function readVersion(){
    var res = await fetch(VERSION_URL + '?t=' + Date.now(), {
      cache:'no-store',
      credentials:'same-origin',
      headers:{ 'Cache-Control':'no-cache' }
    });

    if(!res.ok) throw new Error('version.json no disponible');
    return res.json();
  }

  async function checkVersion(){
    if(isChecking || document.hidden) return;
    isChecking = true;

    try{
      var info = await readVersion();
      if(!info || !info.version) return;

      var serverVersion = String(info.version);
      var appliedVersion = '';
      try{ appliedVersion = String(localStorage.getItem(APPLIED_KEY) || ''); }catch(e){}

      // Si el usuario ya pulsó Actualizar ahora para esta versión exacta,
      // no volver a mostrar el mismo aviso. Una versión futura sí aparecerá.
      if(serverVersion && appliedVersion === serverVersion){
        var oldBanner = document.getElementById(bannerId);
        if(oldBanner) oldBanner.remove();
        console.log('[LOTEKA] Versión ya aceptada por el usuario:', serverVersion);
        return;
      }

      if(serverVersion && serverVersion !== LOTEKA_HTML_VERSION){
        console.log('[LOTEKA] Nueva versión disponible:', serverVersion, 'HTML actual:', LOTEKA_HTML_VERSION);
        showBanner(info);
      }else{
        console.log('[LOTEKA] Versión actualizada:', LOTEKA_HTML_VERSION);
      }
    }catch(e){
      // Silencioso: si Vercel está en transición, no tumbamos la pantalla.
      console.warn('[LOTEKA] No se pudo verificar version.json:', e && e.message ? e.message : e);
    }finally{
      isChecking = false;
    }
  }

  function registerSafeServiceWorker(){
    if(isLocalDev()) return;
    if(!('serviceWorker' in navigator)) return;

    window.addEventListener('load', function(){
      navigator.serviceWorker.register('/service-worker.js', { scope:'/' })
        .then(function(reg){
          try{ reg.update(); }catch(e){}

          if(reg.waiting){
            setTimeout(checkVersion, 600);
          }

          reg.addEventListener('updatefound', function(){
            var worker = reg.installing;
            if(!worker) return;

            worker.addEventListener('statechange', function(){
              if(worker.state === 'installed' && navigator.serviceWorker.controller){
                setTimeout(checkVersion, 600);
              }
            });
          });
        })
        .catch(function(err){ console.warn('[LOTEKA] No se pudo registrar el Service Worker seguro:', err); });
    });
  }

  function boot(){
    registerSafeServiceWorker();

    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){ setTimeout(checkVersion, CHECK_DELAY_MS); });
    }else{
      setTimeout(checkVersion, CHECK_DELAY_MS);
    }

    window.addEventListener('load', function(){ setTimeout(checkVersion, CHECK_DELAY_MS); });
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) setTimeout(checkVersion, 800); });
    setInterval(checkVersion, CHECK_INTERVAL_MS);
  }

  window.lotekaCheckVersionNow = checkVersion;
  window.lotekaShowUpdateBannerTest = function(){
    showBanner({ version:'TEST-MANUAL', name:'Prueba manual del aviso de actualización' });
  };

  boot();
})();


(function(){
  'use strict';
  if(window.__lotekaNotifV168Installed) return;
  window.__lotekaNotifV168Installed = true;
  var state = { client:null, ready:false, items:[], filter:'todas', moduleFilter:'todas', statusFilter:'todas', panelOpen:false, channels:[], subscribed:false, creatingKeys:new Set(), lastToastIds:new Set(), processedEventKeys:new Set(), soundEnabled:localStorage.getItem('loteka_notif_sound_enabled')==='true', soundUnlocked:false, soundAudio:null, lastSoundAt:0, bootedAt:Date.now(), realtimeReadyAt:0, initialLoaded:false };

  function qs(s){ return document.querySelector(s); }
  function qsa(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>'"]/g,function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]; }); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function nowISO(){ return new Date().toISOString(); }
  function isUuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||'')); }
  function titleCaseName(v){ return clean(v).split(/\s+/).map(function(p){ return p ? p.charAt(0).toUpperCase()+p.slice(1).toLowerCase() : ''; }).join(' '); }
  function shortUserName(v){
    v = clean(v || userName());
    if(!v || v === 'Usuario') return 'Usuario';
    if(v.indexOf('@') >= 0) v = v.split('@')[0].replace(/[._-]+/g,' ');
    v = v.replace(/\s+/g,' ').trim();
    var parts = v.split(' ').filter(Boolean);
    if(!parts.length) return 'Usuario';
    var first = titleCaseName(parts[0]);
    var second = parts.length > 1 ? titleCaseName(parts[1]).charAt(0)+'.' : '';
    return (first + (second ? ' '+second : '')).trim();
  }
  function userName(){
    try{
      var st = window.lotekaAuthState || {};
      return (st.perfil && (st.perfil.nombre_completo || st.perfil.nombre || st.perfil.email)) || (st.user && st.user.email) || clean((qs('.loteka-topbar-user-name')||{}).textContent) || 'Usuario';
    }catch(e){ return 'Usuario'; }
  }
  function userId(){ try{ var st = window.lotekaAuthState || {}; return st.user && isUuid(st.user.id) ? st.user.id : null; }catch(e){ return null; } }
  function moduloIcon(modulo,tipo){
    modulo = clean(modulo).toUpperCase(); tipo = clean(tipo).toUpperCase();
    if(modulo.indexOf('AGENCIA') >= 0) return 'fa-store';
    if(modulo.indexOf('TALLER') >= 0) return 'fa-screwdriver-wrench';
    if(modulo.indexOf('INVENTARIO') >= 0) return 'fa-boxes-stacked';
    if(modulo.indexOf('OPERACION') >= 0) return 'fa-list-check';
    if(modulo.indexOf('RRHH') >= 0) return 'fa-id-card';
    if(tipo.indexOf('TRANSFER') >= 0) return 'fa-right-left';
    if(tipo.indexOf('ENTRADA') >= 0) return 'fa-inbox';
    return 'fa-bell';
  }
  function timeAgo(value){
    var d = value ? new Date(value) : new Date(); var ms = Date.now() - d.getTime(); if(!isFinite(ms)) return '';
    var s = Math.max(1, Math.floor(ms/1000)); if(s < 60) return 'hace unos segundos';
    var m = Math.floor(s/60); if(m < 60) return 'hace '+m+' min';
    var h = Math.floor(m/60); if(h < 24) return 'hace '+h+' h';
    var dd = Math.floor(h/24); if(dd < 7) return 'hace '+dd+' d';
    return d.toLocaleDateString('es-DO');
  }
  function formatDate(value){ try{ return new Date(value).toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }

  function ensureDOM(){
    if(!qs('#ltkNotifBell')){
      var btn = document.createElement('button');
      btn.type = 'button'; btn.id = 'ltkNotifBell'; btn.className = 'ltk-notif-bell'; btn.title = 'Centro de notificaciones';
      btn.innerHTML = '<i class="fas fa-bell"></i><span id="ltkNotifBadge" class="ltk-notif-badge">0</span>';
      var logout = qs('#ltkTopbarLogout'); var user = qs('.loteka-topbar-user');
      if(logout && logout.parentNode) logout.parentNode.insertBefore(btn, logout); else if(user) user.appendChild(btn); else document.body.appendChild(btn);
      btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); togglePanel(); });
    }
    if(!qs('#ltkNotifPanel')){
      var panel = document.createElement('aside'); panel.id = 'ltkNotifPanel'; panel.className = 'ltk-notif-panel';
      panel.innerHTML = '<div class="ltk-notif-head"><div><h3><i class="fas fa-bell"></i> Centro de notificaciones</h3><p>Movimientos importantes del sistema LOTEKA.</p></div><button type="button" class="ltk-notif-close" id="ltkNotifClose"><i class="fas fa-xmark"></i></button></div>'+ 
      '<div class="ltk-notif-toolbar"><div class="ltk-notif-toolbar-top"><div class="ltk-notif-tabs-group">'+
      '<button class="ltk-notif-tab active" data-module="todas">Todas</button><button class="ltk-notif-tab" data-module="agencias">Agencias</button><button class="ltk-notif-tab" data-module="inventario">Inventario</button><button class="ltk-notif-tab" data-module="taller">Taller</button><button class="ltk-notif-tab" data-module="operaciones">Operaciones</button><button class="ltk-notif-tab" data-module="rrhh">RRHH</button></div>'+ 
      '<div class="ltk-notif-actions"><button id="ltkNotifSoundBtn" class="ltk-notif-mini-btn" type="button"><i class="fas fa-volume-xmark"></i> Activar sonido</button><button id="ltkNotifSoundTestBtn" class="ltk-notif-mini-btn" type="button"><i class="fas fa-play"></i> Probar</button><button id="ltkNotifBrowserBtn" class="ltk-notif-mini-btn" type="button"><i class="fas fa-desktop"></i> Permiso</button><button id="ltkNotifMarkAll" class="ltk-notif-mini-btn" type="button"><i class="fas fa-check-double"></i> Leer</button></div></div>'+ 
      '<div class="ltk-notif-filter-row"><span class="ltk-notif-filter-label">Vista</span><button class="ltk-notif-tab active" data-status="todas">Todas</button><button class="ltk-notif-tab" data-status="hoy">Hoy</button><button class="ltk-notif-tab" data-status="pendientes">Pendientes</button><button class="ltk-notif-tab" data-status="leidas">Leídas</button><button class="ltk-notif-tab" data-status="importantes">Importantes</button></div></div>'+ 
      '<div id="ltkNotifList" class="ltk-notif-list"><div class="ltk-notif-empty">Cargando notificaciones...</div></div><div class="ltk-notif-panel-foot">Haz clic en una notificación para consultar el detalle del movimiento o agencia.</div>';
      document.body.appendChild(panel);
      qs('#ltkNotifClose').addEventListener('click', closePanel); qs('#ltkNotifMarkAll').addEventListener('click', markAllRead); qs('#ltkNotifBrowserBtn').addEventListener('click', requestBrowserPermission); qs('#ltkNotifSoundBtn').addEventListener('click', toggleNotificationSound); var testSoundBtn=qs('#ltkNotifSoundTestBtn'); if(testSoundBtn) testSoundBtn.addEventListener('click', function(){ state.soundEnabled=true; localStorage.setItem('loteka_notif_sound_enabled','true'); updateSoundButton(); playNotificationSound(true); }); updateSoundButton();
      qsa('.ltk-notif-tab[data-module]').forEach(function(tab){ tab.addEventListener('click', function(){ state.moduleFilter = tab.dataset.module || 'todas'; qsa('.ltk-notif-tab[data-module]').forEach(function(t){ t.classList.toggle('active', t === tab); }); renderPanel(); }); });
      qsa('.ltk-notif-tab[data-status]').forEach(function(tab){ tab.addEventListener('click', function(){ state.statusFilter = tab.dataset.status || 'todas'; qsa('.ltk-notif-tab[data-status]').forEach(function(t){ t.classList.toggle('active', t === tab); }); renderPanel(); }); });
      document.addEventListener('click', function(ev){ if(!state.panelOpen) return; var p=qs('#ltkNotifPanel'), b=qs('#ltkNotifBell'); if(p && !p.contains(ev.target) && b && !b.contains(ev.target)) closePanel(); });
    }
    if(!qs('#ltkToastStack')){ var stack = document.createElement('div'); stack.id = 'ltkToastStack'; stack.className = 'ltk-toast-stack'; document.body.appendChild(stack); }
    if(!qs('#ltkNotifDetailModal')){
      var modal = document.createElement('div'); modal.id = 'ltkNotifDetailModal'; modal.className = 'ltk-notif-detail-modal';
      modal.innerHTML = '<div class="ltk-notif-detail-card"><div class="ltk-notif-detail-head"><div><h3 id="ltkNotifDetailTitle"><i class="fas fa-eye"></i> Consulta</h3><p id="ltkNotifDetailSub">Detalle del movimiento</p></div><button type="button" class="ltk-notif-detail-close" id="ltkNotifDetailClose"><i class="fas fa-xmark"></i></button></div><div id="ltkNotifDetailBody" class="ltk-notif-detail-body"></div><div class="ltk-notif-detail-actions"><button class="ltk-notif-detail-btn" id="ltkNotifDetailClose2">Cerrar</button><button class="ltk-notif-detail-btn primary" id="ltkNotifDetailGo">Abrir módulo</button></div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function(ev){ if(ev.target === modal) closeDetail(); });
      qs('#ltkNotifDetailClose').addEventListener('click', closeDetail); qs('#ltkNotifDetailClose2').addEventListener('click', closeDetail);
      qs('#ltkNotifDetailGo').addEventListener('click', function(){ openReferenceModule(modal._notif || null, modal._detail || null); });
    }
  }
  function normNotifText(v){ return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function isOwnNotification(n){
    try{
      if(!n) return false;
      // Taller V2: las notificaciones de Taller deben permanecer visibles para auditoría,
      // aunque el usuario actual haya ejecutado la recepción/transferencia.
      var modKeep = clean(n.modulo || n.module || '').toUpperCase();
      if(modKeep.indexOf('TALLER') >= 0) return false;
      var uid = userId();
      var nid = clean(n.usuario_id || n.user_id || n.creado_por || n.created_by || n.autor_id || '');
      if(uid && nid && String(uid) === String(nid)) return true;

      var currentShort = normNotifText(shortUserName(userName()));
      var notifShort = normNotifText(shortUserName(n.usuario_nombre || n.usuario || n.creado_por_nombre || n.autor_nombre || ''));
      if(currentShort && notifShort && currentShort !== 'usuario' && currentShort === notifShort) return true;

      var currentRaw = normNotifText(userName());
      var notifRaw = normNotifText(n.usuario_nombre || n.usuario || n.creado_por_nombre || n.autor_nombre || '');
      if(currentRaw && notifRaw && currentRaw !== 'usuario' && (currentRaw === notifRaw || currentRaw.indexOf(notifRaw) >= 0 || notifRaw.indexOf(currentRaw) >= 0)) return true;
    }catch(e){}
    return false;
  }
  function isNoiseNotification(n){
    var body = normNotifText([n&&n.titulo,n&&n.mensaje,n&&n.tipo,n&&n.referencia_tipo].map(clean).join(' '));
    return body.indexOf('equipo serializado registrado') >= 0 ||
           body.indexOf('serializado registrado') >= 0 ||
           body.indexOf('cambio de estado de equipo') >= 0 ||
           body.indexOf('equipo movido de ubicacion') >= 0;
  }
  function entryNotificationKey(n){
    var body = [n&&n.titulo,n&&n.mensaje,n&&n.tipo,n&&n.referencia_codigo].map(clean).join(' ');
    var lower = normNotifText(body);
    if(lower.indexOf('entrada de inventario') < 0 && lower.indexOf('entrada_inventario') < 0) return '';
    var m = body.match(/\bEN[-_\s]*\d{3,}\b/i);
    if(!m) m = body.match(/Entrada\s+de\s+inventario\s+([A-Z0-9_-]+)/i);
    var ref = m ? clean(m[1] || m[0]).replace(/\s+/g,'').toUpperCase().replace(/^ENTRADADEINVENTARIO/i,'') : '';
    return ref ? ('entrada:' + ref) : '';
  }
  function notificationFingerprint(n){
    if(!n) return '';
    var entry = entryNotificationKey(n);
    if(entry) return entry;
    var ref = clean(n.referencia_id || n.referencia_codigo || '');
    var tipo = clean(n.tipo || '').toUpperCase();
    var modulo = clean(n.modulo || '').toUpperCase();
    var refTipo = clean(n.referencia_tipo || '').toLowerCase();
    if(ref && tipo && modulo) return ['ref',modulo,tipo,refTipo,ref].join(':');
    var msg = normNotifText(clean(n.titulo)+'|'+clean(n.mensaje));
    if(msg) return ['txt',modulo,tipo,msg.slice(0,180)].join(':');
    return clean(n.id || '');
  }
  function rememberEventKey(key, ttl){
    if(!key) return false;
    if(state.processedEventKeys.has(key)) return true;
    state.processedEventKeys.add(key);
    setTimeout(function(){ try{ state.processedEventKeys.delete(key); }catch(e){} }, ttl || 90000);
    return false;
  }
  function isRecentRealtimeNotification(n){
    try{
      if(!state.initialLoaded) return false;
      var t = n && n.creado_en ? new Date(n.creado_en).getTime() : Date.now();
      if(!isFinite(t)) return false;
      return t >= (state.bootedAt - 15000);
    }catch(e){ return false; }
  }
  function dedupeNotificationItems(items){
    var seen = Object.create(null);
    return (items || []).filter(function(n){
      if(isNoiseNotification(n)) return false;
      var k = notificationFingerprint(n);
      if(k){ if(seen[k]) return false; seen[k] = true; }
      return true;
    });
  }
  function setBadge(){ var count = dedupeNotificationItems(state.items).filter(function(n){ return !isOwnNotification(n) && !n.leida; }).length; var badge=qs('#ltkNotifBadge'), bell=qs('#ltkNotifBell'); if(badge){ badge.textContent=count>99?'99+':String(count); badge.classList.toggle('is-visible', count>0); } if(bell) bell.classList.toggle('is-hot', count>0); }
  function isToday(value){
    if(!value) return false;
    var d = new Date(value), now = new Date();
    if(!isFinite(d.getTime())) return false;
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
  }
  function moduleMatches(n, f){
    var m=clean(n.modulo).toLowerCase();
    if(f==='agencias') return m.indexOf('agencia')>=0;
    if(f==='inventario') return m.indexOf('inventario')>=0;
    if(f==='taller') return m.indexOf('taller')>=0;
    if(f==='operaciones') return m.indexOf('operacion')>=0 || m.indexOf('operaciones')>=0;
    if(f==='rrhh') return m.indexOf('rrhh')>=0 || m.indexOf('recursos')>=0 || m.indexOf('humano')>=0;
    return true;
  }
  function statusMatches(n, f){
    var imp = clean(n.importancia).toLowerCase();
    if(f==='hoy') return isToday(n.creado_en);
    if(f==='pendientes') return !n.leida;
    if(f==='leidas') return !!n.leida;
    if(f==='importantes') return imp==='critica' || imp==='alta';
    return true;
  }
  function filteredItems(){
    var mf=state.moduleFilter||state.filter||'todas';
    var sf=state.statusFilter||'todas';
    return dedupeNotificationItems(state.items).filter(function(n){ return !isOwnNotification(n) && moduleMatches(n,mf) && statusMatches(n,sf); });
  }
  function readableModule(m){ m=clean(m).toUpperCase(); if(m==='AGENCIAS') return 'Agencias'; if(m==='INVENTARIO') return 'Inventario'; if(m==='TALLER') return 'Taller'; if(m==='OPERACIONES') return 'Operaciones'; if(m==='RRHH') return 'RRHH'; return m || 'Sistema'; }
  function prettyNotifMessage(n){
    var msg = clean(n && n.mensaje);
    var title = clean(n && n.titulo).toLowerCase();
    if(title.indexOf('asignación') >= 0 || title.indexOf('asignacion') >= 0){
      msg = msg.replace(/\s+\|\s+/g, '\n');
      msg = msg.replace(/\s+·\s+(Ag\.\s*\d+)/g, '\n$1');
    }
    return msg;
  }
  function notifActorName(n){
    try{
      var direct = clean(n && (n.reportado_por_nombre || n.creado_por_nombre || n.usuario_creador_nombre || n.actor_nombre || n.autor_nombre || n.creador_nombre));
      if(direct) return direct;
      var code = clean(n && (n.referencia_codigo || n.codigo));
      if(!code){
        var raw = clean([(n&&n.titulo),(n&&n.mensaje)].join(' '));
        var m = raw.match(/OP[-\s]?\d{3,}/i);
        if(m) code = m[0].replace(/\s+/g,'-').toUpperCase();
      }
      if(code && typeof loadOperations === 'function'){
        var ops = loadOperations() || [];
        var op = ops.find(function(o){ return clean(o && (o.code || o.codigo || o.id)) === code || clean(o && o.id) === code; });
        if(op){
          var rep = clean(op.reportado_por_nombre || op.creado_por_nombre || op.usuario_creador_nombre || op.created_by_name || op.created_by || op.reported_by || op.encargado_nombre || op.encargado);
          if(rep) return rep;
        }
      }
      var fallback = clean(n && n.usuario_nombre);
      if(!fallback || /^sistema/i.test(fallback)) return 'Sistema';
      return fallback;
    }catch(e){ return clean(n && n.usuario_nombre) || 'Sistema'; }
  }
  function renderPanel(){
    ensureDOM(); setBadge(); var list=qs('#ltkNotifList'); if(!list) return; var items=filteredItems();
    if(!items.length){ list.innerHTML='<div class="ltk-notif-empty"><i class="fas fa-folder-open"></i><br>No hay notificaciones para este filtro.</div>'; return; }
    list.innerHTML = items.map(function(n){
      var imp=n.importancia||'normal'; var user=shortUserName(notifActorName(n)); var ref=clean(n.referencia_codigo||'');
      return '<article class="ltk-notif-item '+(!n.leida?'unread':'')+'" data-id="'+esc(n.id)+'">'+
        '<div class="ltk-notif-icon '+esc(imp)+'"><i class="fas '+esc(moduloIcon(n.modulo,n.tipo))+'"></i></div>'+ 
        '<div><div class="ltk-notif-title-row"><div class="ltk-notif-title">'+esc(n.titulo||'Notificación')+'</div><span class="ltk-notif-module">'+esc(readableModule(n.modulo))+'</span></div>'+ 
        '<div class="ltk-notif-message">'+esc(prettyNotifMessage(n))+'</div>'+ 
        '<div class="ltk-notif-refline">'+(ref?'<span class="ltk-notif-refchip"><i class="fas fa-hashtag"></i>'+esc(ref)+'</span>':'')+'<span class="ltk-notif-refchip"><i class="fas fa-user"></i>'+esc(user)+'</span><span class="ltk-notif-refchip"><i class="fas fa-clock"></i>'+esc(timeAgo(n.creado_en))+'</span><span class="ltk-notif-query-hint"><i class="fas fa-eye"></i> Consultar</span></div></div></article>';
    }).join('');
    qsa('.ltk-notif-item').forEach(function(card){ card.addEventListener('click', function(){ var id=card.dataset.id; markRead(id); openNotificationById(id); }); });
  }
  function togglePanel(){ state.panelOpen ? closePanel() : openPanel(); }
  function openPanel(){ ensureDOM(); state.panelOpen=true; var p=qs('#ltkNotifPanel'); if(p) p.classList.add('is-open'); loadNotifications(); }
  function closePanel(){ state.panelOpen=false; var p=qs('#ltkNotifPanel'); if(p) p.classList.remove('is-open'); }

  function updateSoundButton(){
    var btn=qs('#ltkNotifSoundBtn');
    if(!btn) return;
    btn.classList.toggle('active', !!state.soundEnabled);
    btn.innerHTML = state.soundEnabled
      ? '<i class="fas fa-volume-high"></i> Sonido activo'
      : '<i class="fas fa-volume-xmark"></i> Activar sonido';
  }
  function ensureSoundAudio(){
    if(state.soundAudio) return state.soundAudio;
    try{
      var srcs = ['sounds/whatsapp.mp3','./sounds/whatsapp.mp3','/sounds/whatsapp.mp3'];
      var audio = new Audio(srcs[0]);
      audio.preload = 'auto';
      audio.volume = 1.0;
      audio.setAttribute('playsinline','');
      audio.addEventListener('error', function(){
        try{
          var current = srcs.indexOf(audio.getAttribute('src') || audio.src.replace(location.origin+'/',''));
          var next = srcs[current + 1];
          if(next){ audio.src = next; audio.load(); }
        }catch(e){}
      });
      state.soundAudio = audio;
      return audio;
    }catch(e){ return null; }
  }
  function playFallbackBeep(){
    try{
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      var ctx = window.lotekaNotifAudioCtx || new Ctx();
      window.lotekaNotifAudioCtx = ctx;
      if(ctx.state === 'suspended') ctx.resume();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.30);
    }catch(e){}
  }
  async function unlockNotificationSound(){
    try{
      var audio = ensureSoundAudio();
      if(audio){
        audio.muted = true;
        audio.currentTime = 0;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      }
      state.soundUnlocked = true;
    }catch(e){
      // Chrome/Edge pueden bloquear el desbloqueo silencioso; el botón Probar lo fuerza con interacción directa.
    }
  }
  async function playNotificationSound(force){
    try{
      if(!force && !state.soundEnabled) return;
      var now = Date.now();
      if(!force && now - state.lastSoundAt < 700) return;
      state.lastSoundAt = now;
      var audio = ensureSoundAudio();
      if(audio){
        try{ audio.pause(); audio.currentTime = 0; audio.volume = 1.0; }catch(e){}
        try{
          await audio.play();
          state.soundUnlocked = true;
          return;
        }catch(playErr){
          if(force){
            console.warn('[Notificaciones] No se pudo reproducir sounds/whatsapp.mp3. Se usa beep de respaldo:', playErr);
          }
          playFallbackBeep();
          return;
        }
      }
      playFallbackBeep();
    }catch(error){
      if(force){ console.warn('[Notificaciones] Sonido bloqueado o no disponible:', error); }
      playFallbackBeep();
    }
  }
  async function toggleNotificationSound(){
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem('loteka_notif_sound_enabled', state.soundEnabled ? 'true' : 'false');
    updateSoundButton();
    if(state.soundEnabled){
      await unlockNotificationSound();
      await playNotificationSound(true);
      showToast({id:'sound-test-'+Date.now(),modulo:'SISTEMA',tipo:'SONIDO',titulo:'Sonido activado',mensaje:'Las alertas de LOTEKA usarán sonido. Si el mp3 no carga, sonará una alerta de respaldo.',usuario_nombre:userName(),creado_en:nowISO()}, false);
    }else{
      showToast({id:'sound-off-'+Date.now(),modulo:'SISTEMA',tipo:'SONIDO',titulo:'Sonido silenciado',mensaje:'Las notificaciones seguirán llegando sin sonido.',usuario_nombre:userName(),creado_en:nowISO()}, false);
    }
  }
  ['click','keydown','touchstart'].forEach(function(ev){
    document.addEventListener(ev, function once(){
      document.removeEventListener(ev, once, true);
      if(state.soundEnabled) unlockNotificationSound();
    }, true);
  });

  function showToast(n, play){ ensureDOM(); if(!n || !n.id) return; if(isOwnNotification(n)) return; if(isNoiseNotification(n)) return; var ek=notificationFingerprint(n) || clean(n.id); if(ek && state.lastToastIds.has(ek)) return; if(state.lastToastIds.has(n.id)) return; state.lastToastIds.add(n.id); if(ek) state.lastToastIds.add(ek); setTimeout(function(){ state.lastToastIds.delete(n.id); if(ek) state.lastToastIds.delete(ek); }, 30000); var stack=qs('#ltkToastStack'); if(!stack) return; var toast=document.createElement('div'); toast.className='ltk-toast'; toast.dataset.id=n.id; toast.innerHTML='<div class="ltk-toast-icon"><i class="fas '+esc(moduloIcon(n.modulo,n.tipo))+'"></i></div><div><div class="ltk-toast-title">'+esc(n.titulo||'Nueva notificación')+'</div><div class="ltk-toast-msg">'+esc(n.mensaje||'')+'</div><div class="ltk-toast-meta">'+esc(readableModule(n.modulo))+' · '+esc(shortUserName(notifActorName(n)))+' · '+esc(timeAgo(n.creado_en))+'</div></div><button type="button" class="ltk-toast-close"><i class="fas fa-xmark"></i></button>'; stack.prepend(toast); toast.addEventListener('click', function(ev){ if(ev.target.closest('.ltk-toast-close')) return; markRead(n.id); openNotification(n); }); toast.querySelector('.ltk-toast-close').addEventListener('click', function(ev){ ev.stopPropagation(); hideToast(toast); }); setTimeout(function(){ hideToast(toast); },7200); if(play !== false){ playNotificationSound(false); notifyBrowser(n); } }
  function hideToast(toast){ if(!toast || toast.classList.contains('hide')) return; toast.classList.add('hide'); setTimeout(function(){ try{toast.remove();}catch(e){} },260); }
  function requestBrowserPermission(){ if(!('Notification' in window)){ alert('Este navegador no soporta notificaciones nativas.'); return; } Notification.requestPermission().then(function(p){ alert(p==='granted'?'Notificaciones del navegador activadas.':'Permiso de notificación no concedido.'); }); }
  function notifyBrowser(n){ try{ if(!('Notification' in window)) return; if(Notification.permission!=='granted') return; var isBackground = document.hidden || !document.hasFocus(); if(!isBackground) return; var notif=new Notification('LOTEKA · '+(n.titulo||'Nueva notificación'),{body:(n.mensaje||''),icon:'icon-192.svg',tag:n.id||undefined,renotify:true,requireInteraction:false}); notif.onclick=function(){ try{window.focus();}catch(e){} openNotification(n); markRead(n.id); notif.close(); }; }catch(e){} }

  async function loadNotifications(){ if(!state.client) return; try{ var resp=await state.client.from('notificaciones').select('*').order('creado_en',{ascending:false}).limit(100); if(resp.error) throw resp.error; state.items=(Array.isArray(resp.data)?resp.data:[]).map(function(n){ try{ var a=notifActorName(n); if(a && a!=='Sistema' && /^sistema\b/i.test(clean(n.usuario_nombre||''))) n.usuario_nombre=a; }catch(e){} return n; }).filter(function(n){ return !isOwnNotification(n); }); renderPanel(); }catch(err){ console.warn('[Notificaciones] No se pudo cargar:',err&&err.message?err.message:err); var list=qs('#ltkNotifList'); if(list) list.innerHTML='<div class="ltk-notif-empty">No se pudieron cargar las notificaciones. Revisa Supabase/RLS.</div>'; } }
  async function markRead(id){ if(!id || !state.client) return; var item=state.items.find(function(n){return String(n.id)===String(id);}); if(item) item.leida=true; renderPanel(); try{ await state.client.from('notificaciones').update({leida:true,visto_en_panel:true}).eq('id',id); }catch(e){} }
  async function markAllRead(){ if(!state.client) return; var ids=dedupeNotificationItems(state.items).filter(function(n){ return !isOwnNotification(n) && !n.leida && n.id; }).map(function(n){ return n.id; }); state.items.forEach(function(n){ if(ids.indexOf(n.id)>=0) n.leida=true; }); renderPanel(); try{ if(ids.length) await state.client.from('notificaciones').update({leida:true,visto_en_panel:true}).in('id',ids); }catch(e){} }
  async function createNotification(payload, showNow){ if(!state.client||!payload) return null; var data={modulo:clean(payload.modulo||'SISTEMA').toUpperCase(),tipo:clean(payload.tipo||'EVENTO').toUpperCase(),titulo:clean(payload.titulo||'Movimiento registrado'),mensaje:clean(payload.mensaje||'Se registró un movimiento importante en el sistema.'),importancia:clean(payload.importancia||'normal').toLowerCase(),referencia_tipo:clean(payload.referencia_tipo||payload.ref_tipo||'')||null,referencia_id:isUuid(payload.referencia_id)?payload.referencia_id:null,referencia_codigo:clean(payload.referencia_codigo||payload.codigo||'')||null,usuario_id:isUuid(payload.usuario_id)?payload.usuario_id:userId(),usuario_nombre:shortUserName(payload.usuario_nombre||userName()),leida:false,visto_en_panel:false,creado_en:payload.creado_en||nowISO()}; if(['baja','normal','alta','critica'].indexOf(data.importancia)<0) data.importancia='normal'; var eventKey=notificationFingerprint(data); if(rememberEventKey('create:'+eventKey, 12000)) return null; try{ var resp=await state.client.from('notificaciones').insert(data).select('*').single(); if(resp.error) throw resp.error; if(showNow!==false&&resp.data) addNotification(resp.data,true); return resp.data; }catch(err){ console.warn('[Notificaciones] No se pudo crear:',err&&err.message?err.message:err,data); return null; } }
  async function createNotificationOnce(payload){ if(!payload||!state.client) return null; var key=[payload.modulo,payload.tipo,payload.referencia_tipo,payload.referencia_id,payload.referencia_codigo].map(clean).join('|'); if(state.creatingKeys.has(key)) return null; state.creatingKeys.add(key); setTimeout(function(){state.creatingKeys.delete(key);},6000); try{ if(payload.referencia_tipo&&payload.referencia_id&&isUuid(payload.referencia_id)){ var check=await state.client.from('notificaciones').select('id').eq('referencia_tipo',payload.referencia_tipo).eq('referencia_id',payload.referencia_id).eq('tipo',clean(payload.tipo||'').toUpperCase()).limit(1); if(!check.error&&check.data&&check.data.length) return null; } }catch(e){} return createNotification(payload,false); }
  function addNotification(n, toast){
    if(!n||!n.id) return;
    if(isOwnNotification(n)) return;
    if(isNoiseNotification(n)) return;
    n.usuario_nombre=shortUserName(n.usuario_nombre||'Sistema');
    var fp = notificationFingerprint(n);
    var idx = state.items.findIndex(function(x){ return String(x.id)===String(n.id) || (fp && notificationFingerprint(x)===fp); });
    var exists = idx >= 0;
    if(exists){
      state.items[idx] = Object.assign({}, state.items[idx], n);
      setBadge();
      if(state.panelOpen) renderPanel();
      return;
    }
    state.items.unshift(n);
    state.items=dedupeNotificationItems(state.items).slice(0,80);
    setBadge();
    if(state.panelOpen) renderPanel();
    if(toast && isRecentRealtimeNotification(n)) showToast(n, true);
  }

  async function openNotificationById(id){ var n=state.items.find(function(x){return String(x.id)===String(id);}); if(n && !isOwnNotification(n)) return openNotification(n); if(!state.client) return; try{ var r=await state.client.from('notificaciones').select('*').eq('id',id).single(); if(!r.error && r.data && !isOwnNotification(r.data)) openNotification(r.data); }catch(e){} }
  async function openNotification(n){
    ensureDOM();
    if(!n) return;
    var modal=qs('#ltkNotifDetailModal');
    if(!modal) return;
    window.__lotekaCurrentNotification = n;
    modal._notif=n;
    modal._detail=null;
    var refTipo = clean(n.referencia_tipo || n.reference_type || n.tipo_referencia).toLowerCase();
    var modName = clean(n.modulo || n.module).toUpperCase();
    var tipoName = clean(n.tipo || n.type).toUpperCase();
    var titleText = clean(n.titulo || n.title).toLowerCase();
    var msgText = clean(n.mensaje || n.message || n.descripcion).toLowerCase();
    var isAnnNotif = refTipo === 'anuncio' || refTipo === 'anuncios' || modName === 'COMUNICACION' || modName === 'COMUNICACIÓN' || modName === 'ANUNCIOS' || tipoName.indexOf('ANUNCIO') >= 0 || titleText.indexOf('anuncio') >= 0 || msgText.indexOf('anuncio') >= 0;
    qs('#ltkNotifDetailTitle').innerHTML='<i class="fas '+esc(isAnnNotif ? 'fa-bullhorn' : moduloIcon(n.modulo,n.tipo))+'"></i> '+esc(n.titulo||'Consulta');
    qs('#ltkNotifDetailSub').textContent=(isAnnNotif ? 'Anuncios' : readableModule(n.modulo))+' · '+formatDate(n.creado_en);
    qs('#ltkNotifDetailBody').innerHTML='<div class="ltk-notif-empty"><i class="fas fa-circle-notch fa-spin"></i><br>Consultando detalle...</div>';
    modal.classList.add('is-open');
    if(isAnnNotif){
      renderDetail(n,null);
      var go=qs('#ltkNotifDetailGo');
      if(go){
        go.innerHTML='<i class="fas fa-bullhorn"></i> Abrir Anuncios';
        go.title='Abrir el módulo de Anuncios';
        go.dataset.lotekaAnuncioGo='1';
      }
      return;
    }
    var detail=await fetchReferenceDetail(n);
    modal._detail=detail;
    renderDetail(n,detail);
  }
  function closeDetail(){ var m=qs('#ltkNotifDetailModal'); if(m) m.classList.remove('is-open'); }
  async function fetchReferenceDetail(n){ if(!state.client || !n) return null; var tipo=clean(n.referencia_tipo).toLowerCase(); var id=n.referencia_id; try{
      if(tipo==='agencias' && id){ var a=await state.client.from('agencias').select('*').eq('id',id).single(); var ag=a.data||null; var gr=null; if(ag){ var gid=ag.grupo_id||ag.grupo||ag.group_id; if(isUuid(gid)){ try{ var g=await state.client.from('grupos').select('*').eq('id',gid).single(); gr=g.data||null; }catch(e){} } } return {tipo:tipo, agencia:ag, grupo:gr}; }
      if(tipo==='movimientos_inventario' && id){ var m=await state.client.from('movimientos_inventario').select('*').eq('id',id).single(); var mov=m.data||null; var prod=null, ser=null; if(mov){ if(mov.producto_id){ try{ var p=await state.client.from('productos').select('*').eq('id',mov.producto_id).single(); prod=p.data||null; }catch(e){} } if(mov.serial_id){ try{ var s=await state.client.from('equipos_seriales').select('*').eq('id',mov.serial_id).single(); ser=s.data||null; }catch(e){} } } return {tipo:tipo, movimiento:mov, producto:prod, serial:ser}; }      if(tipo==='operaciones' && id){ var o=await state.client.from('operaciones').select('*').eq('id',id).single(); return {tipo:tipo, operacion:o.data||null}; }
      if(tipo==='equipos_seriales' && id){ var e=await state.client.from('equipos_seriales').select('*').eq('id',id).single(); return {tipo:tipo, equipo:e.data||null}; }
      if(tipo==='productos' && id){ var pr=await state.client.from('productos').select('*').eq('id',id).single(); return {tipo:tipo, producto:pr.data||null}; }
    }catch(err){ return {error:err&&err.message?err.message:String(err)}; }
    return null;
  }
  function field(k,v,full){ return '<div class="ltk-notif-detail-item '+(full?'full':'')+'"><span class="k">'+esc(k)+'</span><span class="v">'+esc(v||'-')+'</span></div>'; }
  function agenciaNumero(a){ var n=clean(a && (a.numero||a.codigo||a.no_agencia||a.agencia||'')); if(/^\d{1,4}$/.test(n)) return n.padStart(4,'0'); return n || '-'; }
  function grupoTexto(a,g){ if(g){ return clean(g.nombre||g.codigo||g.numero||g.grupo||g.id); } return clean(a && (a.grupo_nombre||a.grupo_codigo||a.grupo||a.grupo_id||'')) || '-'; }
  function renderDetail(n,d){ var body=qs('#ltkNotifDetailBody'); if(!body) return; if(!d){ body.innerHTML=detailBase(n)+'<div class="ltk-notif-detail-grid">'+field('Mensaje',n.mensaje,true)+field('Usuario',shortUserName(n.usuario_nombre||'Sistema'))+field('Fecha',formatDate(n.creado_en))+field('Referencia',n.referencia_codigo||'-')+'</div>'; return; } if(d.error){ body.innerHTML=detailBase(n)+'<div class="ltk-notif-detail-grid">'+field('Aviso','No se pudo consultar el detalle: '+d.error,true)+'</div>'; return; }
    if(d.agencia){ var a=d.agencia; body.innerHTML=detailBase(n)+'<div class="ltk-notif-detail-grid">'+field('Agencia','#'+agenciaNumero(a))+field('Grupo',grupoTexto(a,d.grupo))+field('Nombre',a.nombre||('Agencia '+agenciaNumero(a)))+field('Estado',a.estado||a.estado_operativo||'-')+field('Tipo',a.tipo||a.tipo_agencia||'-')+field('Encargado',a.encargado||a.responsable||'-')+field('Ubicación',[a.provincia,a.municipio,a.sector].filter(Boolean).join(' · ')||'-',true)+field('Usuario',shortUserName(n.usuario_nombre||'Sistema'))+field('Fecha',formatDate(n.creado_en))+'</div>'; return; }
    if(d.movimiento){ var m=d.movimiento, prod=d.producto, ser=d.serial; body.innerHTML=detailBase(n)+'<div class="ltk-notif-detail-grid">'+field('Movimiento',m.tipo_movimiento||n.tipo)+field('Motivo',m.motivo||'-')+field('Origen',m.origen_nombre||m.origen_tipo||'-')+field('Destino',m.destino_nombre||m.destino_tipo||'-')+field('Producto',(prod&&prod.nombre)||m.producto_nombre||m.producto_id||'-')+field('Serial',(ser&&ser.serial)||m.serial||m.referencia||'-')+field('Cantidad',m.cantidad||'1')+field('Usuario',shortUserName(m.usuario_nombre||n.usuario_nombre||'Sistema'))+field('Fecha',formatDate(m.creado_en||n.creado_en))+field('Observación',m.observaciones||n.mensaje||'-',true)+'</div>'; return; }    if(d.operacion){ var o=d.operacion; body.innerHTML=detailBase(n)+'<div class="ltk-notif-detail-grid">'+field('Operación',o.codigo||o.titulo||n.referencia_codigo||'-')+field('Estado',o.estado||'-')+field('Prioridad',o.prioridad||'-')+field('Agencia',o.agencia||o.agencia_nombre||'-')+field('Responsable',shortUserName(o.tecnico||o.responsable||o.usuario_nombre||n.usuario_nombre||'Sistema'))+field('Descripción',o.descripcion||o.titulo||'-',true)+field('Fecha',formatDate(o.actualizado_en||o.creado_en||n.creado_en))+'</div>'; return; }
    if(d.equipo){ var e=d.equipo; body.innerHTML=detailBase(n)+'<div class="ltk-notif-detail-grid">'+field('Serial',e.serial||n.referencia_codigo||'-')+field('Estado',e.estado||'-')+field('Condición',e.condicion||'-')+field('Ubicación',e.ubicacion_tipo||'-')+field('Fecha',formatDate(e.actualizado_en||e.creado_en||n.creado_en))+'</div>'; return; }
    if(d.producto){ var p=d.producto; body.innerHTML=detailBase(n)+'<div class="ltk-notif-detail-grid">'+field('Producto',p.nombre||n.referencia_codigo||'-')+field('Código',p.codigo||'-')+field('Categoría',p.categoria||'-')+field('Tipo',p.tipo_producto||'-')+field('Serializado',p.requiere_serial===false?'No':'Sí')+'</div>'; return; }
    body.innerHTML=detailBase(n)+'<div class="ltk-notif-detail-grid">'+field('Mensaje',n.mensaje,true)+field('Usuario',shortUserName(n.usuario_nombre||'Sistema'))+'</div>';
  }
  function detailBase(n){ return '<section class="ltk-notif-detail-hero"><div class="ltk-notif-detail-hero-icon"><i class="fas '+esc(moduloIcon(n.modulo,n.tipo))+'"></i></div><div><h4>'+esc(n.titulo||'Notificación')+'</h4><p>'+esc(n.mensaje||'')+'</p></div></section>'; }
  function openReferenceModule(n,d){
    closeDetail(); if(!n) return; var ref=clean(n.referencia_tipo).toLowerCase();
    try{
      if(ref==='anuncio' || ref==='anuncios'){
        if(typeof window.lotekaOpenAnuncios==='function') window.lotekaOpenAnuncios();
        else if(typeof cambiarVista==='function') cambiarVista('anuncios');
        var annId=clean(n.referencia_codigo||n.referencia_id||'');
        if(annId && typeof window.lotekaAnunciosSelect==='function') setTimeout(function(){ try{ window.lotekaAnunciosSelect(annId,false); }catch(e){} },350);
        return;
      }
      if(ref==='agencias'){ if(typeof cambiarVista==='function') cambiarVista('agencias'); return; }
      if(ref==='movimientos_inventario'){ if(typeof cambiarVista==='function') cambiarVista('inventario'); return; }      if(ref==='operaciones'){ if(typeof cambiarVista==='function') cambiarVista('operaciones'); return; }
    }catch(e){ console.warn('[Notificaciones] No se pudo abrir referencia:', e); }
  }

  function subscribeRealtime(){ if(!state.client||state.subscribed) return; state.subscribed=true; try{ if(window.__lotekaNotifRealtimeChannel){ state.channels=[window.__lotekaNotifRealtimeChannel]; state.realtimeReadyAt=Date.now(); return; } var ch=state.client.channel('loteka-notificaciones-v168-single').on('postgres_changes',{event:'INSERT',schema:'public',table:'notificaciones'},function(payload){ var n=payload && payload.new; if(!n) return; var key='rt:'+notificationFingerprint(n)+':'+clean(n.id); if(rememberEventKey(key, 90000)) return; addNotification(n,true); }).subscribe(function(status){ if(status==='SUBSCRIBED') state.realtimeReadyAt=Date.now(); }); window.__lotekaNotifRealtimeChannel=ch; state.channels.push(ch); }catch(e){ console.warn('[Notificaciones] Realtime no disponible:',e); } }
  function bootWhenReady(){ ensureDOM(); if(window.__lotekaNotifBootTimer) return; var tries=0; window.__lotekaNotifBootTimer=setInterval(function(){ tries++; if(window.lotekaSupabase){ clearInterval(window.__lotekaNotifBootTimer); window.__lotekaNotifBootTimer=null; state.client=window.lotekaSupabase; window.crearNotificacionLoteka=createNotification; window.lotekaCrearNotificacion=createNotification; window.lotekaMostrarToastNotificacion=showToast; window.lotekaAbrirNotificacion=openNotification; window.lotekaActivarSonidoNotificaciones=toggleNotificationSound; window.lotekaProbarSonidoNotificaciones=function(){ return playNotificationSound(true); }; loadNotifications().then(function(){ subscribeRealtime(); }); }else if(tries>80){ clearInterval(window.__lotekaNotifBootTimer); window.__lotekaNotifBootTimer=null; console.warn('[Notificaciones] Supabase no disponible todavía.'); } },250); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bootWhenReady); else bootWhenReady();
})();

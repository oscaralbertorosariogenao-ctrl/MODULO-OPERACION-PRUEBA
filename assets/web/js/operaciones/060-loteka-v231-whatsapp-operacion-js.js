
(function(){
  'use strict';
  if(window.__lotekaOperacionWhatsappV231) return;
  window.__lotekaOperacionWhatsappV231 = true;

  var profileCache = null;
  var profilePromise = null;

  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function plain(v){ return String(v == null ? '' : v).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
  function norm(v){ return plain(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function onlyDigits(v){ return String(v || '').replace(/\D/g,''); }
  function phoneRD(v){ var n=onlyDigits(v); if(n.length===10 && /^(809|829|849)/.test(n)) n='1'+n; return /^1(809|829|849)\d{7}$/.test(n) ? n : ''; }
  function phonePretty(v){ var n=phoneRD(v)||onlyDigits(v); if(n.length===11 && n[0]==='1') return '+1 '+n.slice(1,4)+' '+n.slice(4,7)+' '+n.slice(7); return v || ''; }
  function toast(t,m,type){ try{ if(window.lotekaToast) return window.lotekaToast(t,m,type||'info'); }catch(e){} try{ if(window.showToastNotification) return window.showToastNotification(t,m,type||'info'); }catch(e){} alert(t+(m?'\n'+m:'')); }
  function supa(){ return window.lotekaSupabase || window.supabaseClient || (window.supabase && window.__supabaseClient) || null; }

  async function loadProfiles(){
    if(profileCache) return profileCache;
    if(profilePromise) return profilePromise;
    profilePromise = (async function(){
      var c = supa();
      if(!c || !c.from) return [];
      var res = await c.from('perfiles').select('id,nombre_completo,nombre,correo,email,telefono,telefono_whatsapp,usuario_login,departamento,grupo_asignado,activo,roles(nombre),puestos(nombre)').limit(1000);
      if(res.error){
        var fallback = await c.from('perfiles').select('*').limit(1000);
        if(fallback.error) throw fallback.error;
        profileCache = fallback.data || [];
      }else profileCache = res.data || [];
      return profileCache;
    })();
    return profilePromise;
  }

  function opList(){ try{ return typeof loadOperations === 'function' ? loadOperations() : []; }catch(e){ return []; } }
  function getOp(id){
    var list = opList();
    var raw = list.find(function(o){ return String(o.id)===String(id) || String(o.code||o.codigo||'')===String(id); });
    if(!raw) return null;
    try{ return typeof enrichOperationWithAgencyContext === 'function' ? enrichOperationWithAgencyContext(raw) : raw; }catch(e){ return raw; }
  }
  function getReporter(op){
    try{ if(typeof getOperationReporter === 'function') return getOperationReporter(op); }catch(e){}
    return op.reporter || op.created_by || op.nombre_encargado || op.encargado || op.creado_por || op.createdBy || 'Encargado';
  }
  function getGroup(op){ return String(op.grupo || op.group || op.grupo_real || '').trim(); }
  function getAgency(op){ try{ if(typeof getOperationLocation === 'function') return getOperationLocation(op); }catch(e){} return op.agency || op.agencia || op.agency_number || '-'; }
  function getCode(op){ return op.code || op.codigo || op.id || 'Operación'; }
  function getTitle(op){ return op.title || op.titulo || op.categoria || op.type || 'Reporte'; }
  function getDesc(op){ return op.description || op.descripcion || ''; }
  function profileName(p){ return p.nombre_completo || p.nombre || p.usuario_login || p.correo || p.email || 'Encargado'; }
  function profileRoleText(p){ return [p.rol, p.role, p.departamento, p.roles && p.roles.nombre, p.puestos && p.puestos.nombre].filter(Boolean).join(' '); }
  function profilePhone(p){ return phoneRD(p.telefono_whatsapp || p.telefono || p.phone || p.celular || p.whatsapp); }

  async function resolveContact(op){
    var direct = phoneRD(op.encargado_telefono || op.telefono_encargado || op.whatsapp_encargado || op.reportante_telefono || op.telefono_reportante || op.telefono || op.phone);
    var reporter = getReporter(op);
    var group = getGroup(op);
    var profiles = [];
    try{ profiles = await loadProfiles(); }catch(e){ profiles = []; }
    var reporterN = norm(reporter);
    var exact = profiles.find(function(p){
      var names = [p.nombre_completo,p.nombre,p.usuario_login,p.correo,p.email].map(norm).filter(Boolean);
      return names.indexOf(reporterN) >= 0;
    });
    var partial = !exact && reporterN ? profiles.find(function(p){
      var txt = norm([p.nombre_completo,p.nombre,p.usuario_login,p.correo,p.email].join(' '));
      return txt && (txt.indexOf(reporterN)>=0 || reporterN.indexOf(txt)>=0);
    }) : null;
    var byGroup = (!exact && !partial && group) ? profiles.find(function(p){
      return phoneRD(p.telefono_whatsapp || p.telefono) && String(p.grupo_asignado||'').trim() === String(group).trim() && /encargad/i.test(profileRoleText(p));
    }) : null;
    var p = exact || partial || byGroup || null;
    var phone = direct || (p ? profilePhone(p) : '');
    return { name: p ? profileName(p) : reporter, phone: phone, pretty: phonePretty(phone), profile: p };
  }

  function buildMessage(op, contact, type){
    var code = getCode(op), agency = getAgency(op), group = getGroup(op) || 'No registrado', title = getTitle(op), desc = getDesc(op) || 'Sin descripción registrada';
    var name = contact && contact.name ? contact.name : 'Encargado';
    if(type === 'evidencia'){
      return 'Hola '+name+', necesito que me envíes una foto y un video corto de la avería reportada para validar antes de asignar técnico.\n\n*Operación:* '+code+'\n*Agencia:* '+agency+'\n*Grupo:* '+group+'\n*Avería:* '+title+'\n\nFavor enviarme la foto y el video donde se vea claramente el problema.';
    }
    if(type === 'solucion'){
      return 'Hola '+name+', estoy revisando este reporte. Antes de asignar técnico, intenta estos pasos rápidos:\n\n*Operación:* '+code+'\n*Agencia:* '+agency+'\n*Avería:* '+title+'\n\n1. Verifica energía y conexiones.\n2. Reinicia el equipo afectado.\n3. Confirma si el problema continúa.\n4. Si aparece un error, envíame foto y video.\n\nAvísame el resultado para continuar el seguimiento.';
    }
    return 'Hola '+name+', estoy revisando este reporte.\n\n*Operación:* '+code+'\n*Agencia:* '+agency+'\n*Grupo:* '+group+'\n*Avería:* '+title+'\n*Descripción:* '+desc+'\n\n¿Puedes confirmarme si la avería continúa antes de asignar técnico?';
  }

  function openWhatsApp(phone, msg){
    phone = phoneRD(phone);
    if(!phone){ toast('WhatsApp no disponible','Este usuario no tiene teléfono válido registrado. Corrígelo en Catálogos → Usuarios.','warning'); return; }
    var text = encodeURIComponent(msg || '');
    var appUrl = 'whatsapp://send?phone='+phone+'&text='+text;
    var webUrl = 'https://web.whatsapp.com/send?phone='+phone+'&text='+text;
    var leftPage = false;
    function mark(){ leftPage = true; }
    window.addEventListener('blur', mark, {once:true});
    document.addEventListener('visibilitychange', mark, {once:true});
    try{ window.location.href = appUrl; }catch(e){}
    setTimeout(function(){ if(!leftPage) window.open(webUrl, '_blank', 'noopener,noreferrer'); }, 1200);
    toast('WhatsApp preparado','Mensaje listo para enviar al encargado.','success');
  }

  function callPhone(phone){ phone = phoneRD(phone); if(!phone){ toast('Llamada no disponible','El encargado no tiene teléfono válido registrado.','warning'); return; } window.location.href='tel:+'+phone; }


  function waCloseActorName(){
    try{
      return String((window.lotekaAuthState && window.lotekaAuthState.perfil && window.lotekaAuthState.perfil.nombre_completo) ||
        (window.lotekaAuthState && window.lotekaAuthState.profile && window.lotekaAuthState.profile.nombre_completo) ||
        (document.querySelector('.loteka-topbar-user-name') && document.querySelector('.loteka-topbar-user-name').textContent) ||
        (typeof getCurrentUserEmail === 'function' ? getCurrentUserEmail() : '') ||
        'Operaciones').trim();
    }catch(e){ return 'Operaciones'; }
  }

  function showWhatsAppCloseModal(op, contact){
    return new Promise(function(resolve){
      var old = document.getElementById('goWaCloseModal');
      if(old) old.remove();
      var code = getCode(op), agency = getAgency(op), group = getGroup(op) || 'No registrado', title = getTitle(op);
      var name = (contact && contact.name) || 'Encargado';
      var pretty = (contact && contact.pretty) || phonePretty(contact && contact.phone) || 'Teléfono registrado';
      var overlay = document.createElement('div');
      overlay.id = 'goWaCloseModal';
      overlay.className = 'go-wa-close-overlay';
      overlay.innerHTML = ''+
        '<div class="go-wa-close-card" role="dialog" aria-modal="true" aria-labelledby="goWaCloseTitle">'+
          '<div class="go-wa-close-head">'+
            '<div><h3 id="goWaCloseTitle">Cerrar por soporte WhatsApp</h3><p>Registra la solución aplicada y cierra la operación sin exigir evidencia física.</p></div>'+
            '<button type="button" class="go-wa-close-x" data-close="1">×</button>'+
          '</div>'+
          '<div class="go-wa-close-body">'+
            '<div class="go-wa-close-summary">'+
              '<div class="go-wa-close-mini"><span>Operación</span><b>'+esc(code)+'</b></div>'+
              '<div class="go-wa-close-mini"><span>Agencia / Grupo</span><b>'+esc(agency)+' · '+esc(group)+'</b></div>'+
              '<div class="go-wa-close-mini"><span>Encargado</span><b>'+esc(name)+'<br>'+esc(pretty)+'</b></div>'+
            '</div>'+
            '<div class="go-wa-close-mini"><span>Avería</span><b>'+esc(title)+'</b></div>'+
            '<div class="go-wa-close-field"><label>Motivo del cierre</label><select id="goWaCloseReason">'+
              '<option value="Falla resuelta con orientación por WhatsApp">Falla resuelta con orientación por WhatsApp</option>'+
              '<option value="Error de uso corregido remotamente">Error de uso corregido remotamente</option>'+
              '<option value="Equipo reiniciado correctamente">Equipo reiniciado correctamente</option>'+
              '<option value="Conexión / energía / cableado verificado">Conexión / energía / cableado verificado</option>'+
              '<option value="Reporte duplicado o no procedía técnico">Reporte duplicado o no procedía técnico</option>'+
              '<option value="Otro">Otro</option>'+
            '</select></div>'+
            '<div class="go-wa-close-field"><label>Comentario obligatorio</label><textarea id="goWaCloseComment" placeholder="Ej.: Se orientó al encargado por WhatsApp. El equipo fue reiniciado y la avería quedó resuelta sin enviar técnico."></textarea></div>'+
            '<div class="go-wa-close-error" id="goWaCloseError">Debes escribir un comentario claro antes de cerrar la operación.</div>'+
            '<div class="go-wa-close-note"><b>Historial:</b> el cierre quedará registrado como soporte vía WhatsApp, con usuario, fecha, encargado, motivo y comentario. También se enviará la actualización a Supabase.</div>'+
          '</div>'+
          '<div class="go-wa-close-foot">'+
            '<button type="button" class="go-wa-close-cancel" data-close="1">Cancelar</button>'+
            '<button type="button" class="go-wa-close-save" data-save="1"><i class="fas fa-check-circle"></i> Cerrar operación</button>'+
          '</div>'+
        '</div>';
      document.body.appendChild(overlay);
      var textarea = overlay.querySelector('#goWaCloseComment');
      var error = overlay.querySelector('#goWaCloseError');
      setTimeout(function(){ try{ textarea.focus(); }catch(e){} }, 80);
      function done(value){ overlay.remove(); resolve(value); }
      overlay.addEventListener('click', function(ev){
        if(ev.target === overlay || ev.target.closest('[data-close]')) return done(null);
        if(ev.target.closest('[data-save]')){
          var comment = String(textarea.value || '').trim();
          if(!comment){ if(error) error.classList.add('show'); textarea.focus(); return; }
          var reason = String((overlay.querySelector('#goWaCloseReason') || {}).value || 'Falla resuelta con orientación por WhatsApp').trim();
          done({ comment: comment, reason: reason });
        }
      });
      textarea.addEventListener('input', function(){ if(error) error.classList.remove('show'); });
      overlay.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') done(null); });
    });
  }


  async function notifyWhatsAppClosure(op, contact, reason, comment, actor){
    try{
      var code = getCode(op) || op.code || op.codigo || op.id || '';
      var agency = op.agency || op.agencia || op.agencia_numero || op.agencyNumber || '-';
      var grupo = op.grupo || op.group || op.grupo_real || '';
      var title = op.title || op.titulo || op.averia || op.tipo || 'Operación';
      var msg = String(code || 'Operación') + ' · Agencia ' + String(agency || '-') + (grupo ? ' · Grupo ' + String(grupo) : '') + ' cerrada por soporte WhatsApp. Motivo: ' + String(reason || 'No especificado') + '.';
      var payload = {
        modulo: 'OPERACIONES',
        tipo: 'CIERRE_WHATSAPP',
        titulo: 'Cierre por WhatsApp',
        mensaje: msg,
        importancia: 'alta',
        referencia_tipo: 'operaciones',
        referencia_codigo: String(code || ''),
        usuario_nombre: actor || waCloseActorName()
      };
      if(window.lotekaCrearNotificacion){
        await window.lotekaCrearNotificacion(payload, false);
        return true;
      }
      var c = window.lotekaSupabase || window.supabaseClient || null;
      if(!c) return false;
      var data = {
        modulo: payload.modulo,
        tipo: payload.tipo,
        titulo: payload.titulo,
        mensaje: payload.mensaje,
        importancia: payload.importancia,
        referencia_tipo: payload.referencia_tipo,
        referencia_codigo: payload.referencia_codigo || null,
        usuario_nombre: payload.usuario_nombre,
        leida: false,
        visto_en_panel: false,
        creado_en: new Date().toISOString()
      };
      try{
        var st = window.lotekaAuthState || {};
        if(st.user && st.user.id) data.usuario_id = st.user.id;
      }catch(e){}
      var r = await c.from('notificaciones').insert(data).select('id').single();
      if(r && r.error) throw r.error;
      return true;
    }catch(e){
      console.warn('[WhatsApp cierre] No se pudo crear notificación:', e && e.message ? e.message : e);
      return false;
    }
  }

  async function closeWithoutEvidence(id){
    var op = getOp(id); if(!op) return;
    var contact = await resolveContact(op);
    if(!contact.phone){ toast('No se puede cerrar por WhatsApp','Primero registra el teléfono del encargado en Catálogos → Usuarios.','warning'); return; }

    var result = await showWhatsAppCloseModal(op, contact);
    if(!result) return;

    var ops = opList();
    var idx = ops.findIndex(function(o){ return String(o.id)===String(op.id) || String(o.code||o.codigo||'')===String(getCode(op)); });
    if(idx < 0){ toast('No se encontró la operación','Actualiza el listado e intenta de nuevo.','warning'); return; }

    var now = new Date().toISOString();
    var actor = waCloseActorName();
    var prev = ops[idx].status || ops[idx].estado || 'Pendiente';
    var cleanComment = String(result.comment || '').trim();
    var reason = String(result.reason || 'Falla resuelta con orientación por WhatsApp').trim();
    var closeDetail = {
      tipo: 'cierre_whatsapp',
      canal: 'WhatsApp',
      motivo: reason,
      comentario: cleanComment,
      encargado_nombre: contact.name || '',
      encargado_telefono: phonePretty(contact.phone),
      usuario_cierre: actor,
      fecha_cierre: now,
      evidencia_requerida: false
    };

    ops[idx].status = 'Completado';
    ops[idx].estado = 'Completado';
    ops[idx].completedAt = now;
    ops[idx].closedAt = now;
    ops[idx].updatedAt = now;
    ops[idx].cierre_sin_evidencia = true;
    ops[idx].cierre_whatsapp = true;
    ops[idx].cierre_motivo_whatsapp = reason;
    ops[idx].comentario_cierre_whatsapp = cleanComment;
    ops[idx].cierre_whatsapp_detalle = closeDetail;

    var entry = null;
    var detailText = 'Cierre por soporte WhatsApp. Motivo: '+reason+'. Comentario: '+cleanComment+'. Encargado: '+(contact.name||'Encargado')+' ('+phonePretty(contact.phone)+'). Evidencia requerida: No aplica.';
    try{
      if(typeof createHistoryEntry === 'function'){
        entry = createHistoryEntry({
          action:'Cierre por WhatsApp',
          detail: detailText,
          user: actor,
          prevStatus: prev,
          newStatus:'Completado'
        });
      }
    }catch(e){}
    if(!entry) entry = { action:'Cierre por WhatsApp', detail:detailText, user:actor, prevStatus:prev, newStatus:'Completado', timestamp:now };
    entry.tipo = 'cierre_whatsapp';
    entry.canal = 'WhatsApp';
    entry.motivo = reason;
    entry.comentario = cleanComment;
    entry.encargado_nombre = contact.name || '';
    entry.encargado_telefono = phonePretty(contact.phone);
    entry.evidencia_requerida = false;
    entry.fecha = entry.fecha || now;
    entry.timestamp = entry.timestamp || now;

    ops[idx].history = Array.isArray(ops[idx].history) ? ops[idx].history : [];
    ops[idx].history.push(entry);

    try{ if(typeof saveOperations === 'function') saveOperations(ops); }catch(e){}

    var synced = null;
    try{
      if(typeof syncOperationToBackendCero === 'function') synced = await syncOperationToBackendCero(ops[idx]);
    }catch(e){ console.warn('[WhatsApp cierre] No se pudo sincronizar con Supabase:', e); }

    try{ if(typeof renderOperations === 'function') renderOperations(); }catch(e){}
    try{ if(typeof renderDashboard === 'function') renderDashboard(); }catch(e){}
    var notified = await notifyWhatsAppClosure(ops[idx], contact, reason, cleanComment, actor);

    try{ if(typeof renderNotificationsPanel === 'function') renderNotificationsPanel(); }catch(e){}
    try{ if(typeof renderNotifications === 'function') renderNotifications(); }catch(e){}
    try{ if(typeof window.showDetail === 'function') setTimeout(function(){ window.showDetail(ops[idx].id); }, 250); }catch(e){}

    if(synced){
      toast('Operación cerrada','Cierre por WhatsApp guardado en historial y sincronizado con Supabase'+(notified ? ', con notificación registrada.' : '.').toString(),'success');
    }else {
      toast('Operación cerrada','Cierre registrado localmente. Si Supabase no confirmó, pulsa Actualizar para verificar sincronización.','warning');
    }
  }


  function getCloseDetail(op){
    var d = op.cierre_whatsapp_detalle || {};
    return {
      motivo: d.motivo || op.cierre_motivo_whatsapp || '',
      comentario: d.comentario || op.comentario_cierre_whatsapp || '',
      encargado: d.encargado_nombre || op.encargado_nombre || getReporter(op) || '',
      telefono: d.encargado_telefono || op.encargado_telefono || op.telefono_encargado || '',
      usuario: d.usuario_cierre || op.closedBy || op.completedBy || '',
      fecha: d.fecha_cierre || op.closedAt || op.completedAt || op.updatedAt || '',
      evidencia: d.evidencia_requerida === false ? 'No aplica' : 'No requerida'
    };
  }
  function formatCloseDate(v){
    try{ return v ? new Date(v).toLocaleString('es-DO', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-'; }catch(e){ return v || '-'; }
  }
  function closeSummaryHtml(op){
    if(!(op && (op.cierre_whatsapp || op.cierre_sin_evidencia || op.cierre_whatsapp_detalle))) return '';
    var d = getCloseDetail(op);
    return '<div class="go-detail-panel go-wa-close-summary-panel" id="goWaCloseSummaryPanel">'+
      '<div class="go-wa-close-summary-top"><h4><i class="fab fa-whatsapp"></i> Cierre por soporte WhatsApp</h4><span class="go-wa-close-summary-badge"><i class="fas fa-check-circle"></i> Resuelto remoto</span></div>'+
      '<div class="go-wa-close-summary-grid">'+
        '<div class="go-wa-close-summary-item"><span>Motivo</span><b>'+esc(d.motivo || 'No especificado')+'</b></div>'+
        '<div class="go-wa-close-summary-item"><span>Encargado</span><b>'+esc(d.encargado || '-')+'</b></div>'+
        '<div class="go-wa-close-summary-item"><span>Teléfono</span><b>'+esc(d.telefono || '-')+'</b></div>'+
        '<div class="go-wa-close-summary-item"><span>Fecha de cierre</span><b>'+esc(formatCloseDate(d.fecha))+'</b></div>'+
        '<div class="go-wa-close-summary-item"><span>Usuario que cerró</span><b>'+esc(d.usuario || 'Operaciones')+'</b></div>'+
        '<div class="go-wa-close-summary-item"><span>Evidencia</span><b>'+esc(d.evidencia || 'No aplica')+'</b></div>'+
        '<div class="go-wa-close-summary-item"><span>Canal</span><b>WhatsApp</b></div>'+
        '<div class="go-wa-close-summary-item"><span>Estado</span><b>Completado</b></div>'+
      '</div>'+
      '<div class="go-wa-close-comment"><span>Comentario registrado</span><p>'+esc(d.comentario || 'Sin comentario registrado.')+'</p></div>'+
    '</div>';
  }
  function injectCloseSummary(op){
    var content = document.getElementById('detailContent'); if(!content || content.querySelector('#goWaCloseSummaryPanel')) return;
    var html = closeSummaryHtml(op); if(!html) return;
    var body = content.querySelector('.go-detail-body');
    var wa = content.querySelector('#goWhatsappOperationPanel');
    if(wa) wa.insertAdjacentHTML('afterend', html);
    else if(body) body.insertAdjacentHTML('afterbegin', html);
    else content.insertAdjacentHTML('afterbegin', html);
  }
  function dedupeWhatsappPanels(){
    var content = document.getElementById('detailContent');
    if(!content) return null;
    var panels = Array.prototype.slice.call(content.querySelectorAll('#goWhatsappOperationPanel, .go-whatsapp-panel'));
    if(panels.length > 1){
      panels.slice(1).forEach(function(p){ try{ p.remove(); }catch(e){} });
    }
    return panels[0] || null;
  }
  async function injectPanel(id){
    var content = document.getElementById('detailContent');
    if(!content) return;
    if(dedupeWhatsappPanels()) return;
    if(content.dataset.waPanelInjecting === '1') return;
    content.dataset.waPanelInjecting = '1';
    var op = getOp(id); if(!op){ content.dataset.waPanelInjecting = ''; return; }
    var contact = await resolveContact(op);
    if(dedupeWhatsappPanels()){ content.dataset.waPanelInjecting = ''; return; }
    var isDone = String(op.status || op.estado || '').toLowerCase().includes('complet');
    var html = '<div class="go-detail-panel go-whatsapp-panel" id="goWhatsappOperationPanel" style="grid-column:1/-1">'+
      '<h4><i class="fab fa-whatsapp"></i> Comunicación con encargado</h4>'+
      (contact.phone ?
        '<div class="go-wa-toggle-wrap">'+
          '<button type="button" class="go-wa-toggle-btn" data-wa-toggle="panel"><i class="fab fa-whatsapp"></i> WhatsApp encargado <i class="fas fa-chevron-down caret"></i></button>'+
          '<div class="go-wa-collapse">'+
            '<div class="go-wa-head"><div class="go-wa-person"><strong>'+esc(contact.name || 'Encargado')+'</strong><span>'+esc(contact.pretty)+'</span></div><div class="go-wa-status"><i class="fas fa-circle-check"></i> Disponible</div></div>'+
            '<div class="go-wa-actions">'+
              '<button type="button" class="go-wa-btn primary" data-wa-action="confirmar"><i class="fab fa-whatsapp"></i> Confirmar avería</button>'+
              '<button type="button" class="go-wa-btn" data-wa-action="evidencia"><i class="fas fa-camera"></i> Pedir foto y video</button>'+
              '<button type="button" class="go-wa-btn warning" data-wa-action="solucion"><i class="fas fa-bolt"></i> Solución rápida</button>'+
              '<button type="button" class="go-wa-btn" data-wa-action="llamar"><i class="fas fa-phone"></i> Llamar</button>'+
              (!isDone ? '<button type="button" class="go-wa-btn closecase" data-wa-action="cerrar"><i class="fas fa-check-circle"></i> Cerrar sin evidencia (WhatsApp)</button>' : '')+
            '</div><div class="go-wa-help"><b>Uso recomendado:</b> confirma averías simples por WhatsApp antes de asignar técnico. Si se resuelve remoto, cierra el caso con comentario obligatorio.</div>'+
          '</div>'+
        '</div>'
        : '<div class="go-wa-no-phone"><strong>WhatsApp no disponible</strong>El encargado no tiene teléfono registrado. Corrígelo en Catálogos → Usuarios.</div>')+
      '</div>';
    var body = content.querySelector('.go-detail-body');
    if(body) body.insertAdjacentHTML('afterbegin', html); else content.insertAdjacentHTML('afterbegin', html);
    content.dataset.waPanelInjecting = '';
    dedupeWhatsappPanels();
    injectCloseSummary(op);
    var panel = content.querySelector('#goWhatsappOperationPanel'); if(!panel) return;
    panel.addEventListener('click', function(ev){
      var toggle = ev.target.closest('[data-wa-toggle]');
      if(toggle){
        panel.classList.toggle('expanded');
        return;
      }
      var btn = ev.target.closest('[data-wa-action]'); if(!btn) return;
      var action = btn.getAttribute('data-wa-action');
      if(action === 'llamar') return callPhone(contact.phone);
      if(action === 'cerrar') return closeWithoutEvidence(id);
      openWhatsApp(contact.phone, buildMessage(op, contact, action));
    });
  }

  function installWrapper(){
    if(typeof window.showDetail !== 'function' || window.showDetail.__waV231) return;
    var previous = window.showDetail;
    var wrapped = function(id){ var r = previous.apply(this, arguments); setTimeout(function(){ injectPanel(id); }, 120); return r; };
    wrapped.__waV231 = true;
    window.showDetail = wrapped;
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installWrapper); else installWrapper();
  setTimeout(installWrapper, 800);
})();

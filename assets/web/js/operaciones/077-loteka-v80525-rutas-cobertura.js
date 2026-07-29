(function(global){
  'use strict';

  if(global.GOOperationalRoutes && global.GOOperationalRoutes.version){ return; }

  var VERSION = '805.25.1';
  var state = {
    comparison: null,
    routes: [],
    profiles: [],
    initialized: false,
    loadingRoutes: false,
    map: null,
    mapMarkers: []
  };

  function qs(selector, root){ return (root || document).querySelector(selector); }
  function qsa(selector, root){ return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function uuid(value){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value)); }
  function padAgency(value){
    var digits = text(value).replace(/\D/g,'');
    if(!digits) return '';
    return digits.length < 4 ? digits.padStart(4,'0') : digits;
  }
  function agencyKey(value){
    var digits = text(value).replace(/\D/g,'');
    if(!digits) return '';
    return String(Number(digits));
  }
  function groupLabel(group){ return text(group && (group.nombre || group.codigo || group.numero)) || 'Grupo'; }
  function groupCode(group){
    var raw = text(group && (group.codigo || group.numero || group.nombre));
    var digits = raw.replace(/\D/g,'');
    return digits ? 'G-' + digits.padStart(2,'0') : raw;
  }
  function agencyGroupName(agency){ return text(agency && (agency.grupo || agency.grupo_nombre || agency.group_name)); }
  function agencyGroupId(agency){ return text(agency && (agency.grupoId || agency.grupo_id || agency.group_id)); }
  function agencyId(agency){
    var candidates = agency ? [agency.supabaseId, agency.id_supabase, agency.agencia_id, agency.id] : [];
    for(var i=0;i<candidates.length;i++){ if(uuid(candidates[i])) return text(candidates[i]); }
    return null;
  }
  function groupId(group){
    var candidates = group ? [group.supabaseId, group.id_supabase, group.grupo_id, group.id] : [];
    for(var i=0;i<candidates.length;i++){ if(uuid(candidates[i])) return text(candidates[i]); }
    return null;
  }
  function formatDate(value){
    if(!value) return '-';
    try{
      var d = String(value).length <= 10 ? new Date(value + 'T00:00:00') : new Date(value);
      return new Intl.DateTimeFormat('es-DO',{day:'2-digit',month:'short',year:'numeric'}).format(d);
    }catch(_e){ return text(value); }
  }
  function nowISO(){ return new Date().toISOString().slice(0,10); }
  function runtime(){ return global.GOApp && global.GOApp.__phase2aRuntime ? global.GOApp : null; }
  function client(){
    var rt = runtime();
    if(rt){
      try{ var c = rt.supabase.getClient(); if(c && typeof c.rpc === 'function') return c; }catch(_e){}
    }
    var candidates = [global.lotekaSupabase, global.supabaseClient, global.__supabaseClient];
    for(var i=0;i<candidates.length;i++){
      if(candidates[i] && typeof candidates[i].rpc === 'function') return candidates[i];
    }
    return null;
  }
  function permissions(){
    var rt = runtime();
    var list = rt ? rt.state.get('permissions') : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  }
  function profileText(){
    var rt = runtime();
    var p = rt ? (rt.state.get('perfil') || {}) : {};
    return [p.rol_nombre,p.rol,p.puesto_nombre,p.puesto,p.nombre_completo,p.correo].join(' ').toLowerCase();
  }
  function canView(){
    var p = permissions();
    var label = profileText();
    return p.has('ver_rutas_operativas') || p.has('gestionar_rutas_operativas') || /administrador|auxiliar de operaciones|gerente de operaciones/.test(label);
  }
  function canManage(){
    var p = permissions();
    var label = profileText();
    return p.has('gestionar_rutas_operativas') || /administrador|auxiliar de operaciones|gerente de operaciones/.test(label);
  }
  function notify(message, type){
    try{
      if(typeof global.showToast === 'function'){ global.showToast(message, type || 'info'); return; }
      if(typeof global.lotekaToast === 'function'){ global.lotekaToast(message, type || 'info'); return; }
    }catch(_e){}
    if(type === 'error') console.error('[Rutas]', message); else console.log('[Rutas]', message);
  }
  function friendlyError(error){
    var rt = runtime();
    if(rt) return rt.errors.friendly(error);
    return text(error && error.message ? error.message : error || 'No se pudo completar la acción.');
  }
  function handleError(error, action){
    var rt = runtime();
    if(rt) rt.errors.capture(error,{module:'rutas-operativas',action:action || 'acción'});
    notify(friendlyError(error),'error');
  }

  function injectStyles(){
    if(document.getElementById('go-routes-style')) return;
    var style = document.createElement('style');
    style.id = 'go-routes-style';
    style.textContent = `
      #vista-ops-rutas{padding:0 0 28px;}
      .gor-shell{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0b2e4f;}
      .gor-hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:28px;border:1px solid #d7e6f2;border-radius:22px;background:linear-gradient(135deg,#f9fdff 0%,#eef8ff 55%,#f7fbff 100%);box-shadow:0 18px 45px rgba(11,46,79,.08);margin-bottom:18px;}
      .gor-eyebrow{font-size:11px;font-weight:1000;letter-spacing:.14em;text-transform:uppercase;color:#0499ca;margin-bottom:7px;}
      .gor-hero h2{margin:0;font-size:28px;line-height:1.1;color:#092d4c;}
      .gor-hero p{margin:9px 0 0;color:#607990;max-width:720px;font-size:14px;line-height:1.55;}
      .gor-hero-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end;}
      .gor-btn{border:1px solid #c9dcea;background:#fff;color:#07588f;border-radius:12px;padding:10px 14px;font-weight:900;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:.18s ease;text-decoration:none;}
      .gor-btn:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(11,86,139,.12);}
      .gor-btn.primary{background:linear-gradient(135deg,#0879bd,#05a7d6);color:#fff;border-color:transparent;}
      .gor-btn.danger{color:#b42318;border-color:#f0c6c3;background:#fff8f7;}
      .gor-btn.small{padding:7px 10px;border-radius:10px;font-size:12px;}
      .gor-tabs{display:flex;gap:8px;padding:5px;background:#edf5fa;border:1px solid #d7e6f2;border-radius:14px;width:max-content;max-width:100%;margin-bottom:16px;}
      .gor-tab{border:0;background:transparent;border-radius:10px;padding:9px 14px;font-weight:900;color:#577289;cursor:pointer;}
      .gor-tab.active{background:#fff;color:#075d94;box-shadow:0 5px 16px rgba(10,74,118,.1);}
      .gor-panel{display:none;}.gor-panel.active{display:block;}
      .gor-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);gap:16px;align-items:start;}
      .gor-card{background:#fff;border:1px solid #d7e6f2;border-radius:18px;padding:18px;box-shadow:0 12px 28px rgba(16,67,104,.055);}
      .gor-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:15px;}
      .gor-card h3{margin:0;color:#0b3659;font-size:17px;}.gor-card p.hint{margin:5px 0 0;color:#7890a4;font-size:12px;line-height:1.45;}
      .gor-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      .gor-field{display:flex;flex-direction:column;gap:6px;}.gor-field.full{grid-column:1/-1;}
      .gor-field label{font-size:12px;font-weight:900;color:#34556f;}
      .gor-input,.gor-select,.gor-textarea{width:100%;box-sizing:border-box;border:1px solid #c8dceb;border-radius:12px;background:#fbfdff;color:#153a57;padding:11px 12px;font:inherit;outline:none;}
      .gor-input:focus,.gor-select:focus,.gor-textarea:focus{border-color:#12a6d2;box-shadow:0 0 0 3px rgba(18,166,210,.12);background:#fff;}
      .gor-textarea{min-height:255px;resize:vertical;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;}
      .gor-helper-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
      .gor-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:14px;}
      .gor-kpi{border:1px solid #dae7f0;background:#f9fcfe;border-radius:14px;padding:12px;min-height:76px;}
      .gor-kpi strong{display:block;font-size:24px;color:#0b5c91;line-height:1;}.gor-kpi span{display:block;color:#70889b;font-size:11px;font-weight:800;margin-top:6px;}
      .gor-kpi.ok{background:#f0fbf6;border-color:#bfe9d2}.gor-kpi.ok strong{color:#087b47}
      .gor-kpi.warn{background:#fffaf0;border-color:#f5dfad}.gor-kpi.warn strong{color:#9a6100}
      .gor-kpi.bad{background:#fff5f4;border-color:#f3cfca}.gor-kpi.bad strong{color:#b42318}
      .gor-result-sections{display:grid;gap:10px;}
      .gor-result{border:1px solid #dce8f0;border-radius:14px;overflow:hidden;background:#fff;}
      .gor-result summary{list-style:none;cursor:pointer;padding:12px 14px;font-weight:950;color:#244d6b;display:flex;justify-content:space-between;gap:12px;background:#f8fbfd;}
      .gor-result summary::-webkit-details-marker{display:none}.gor-result .body{padding:12px 14px;border-top:1px solid #e6eef4;}
      .gor-chips{display:flex;gap:7px;flex-wrap:wrap;max-height:190px;overflow:auto;}
      .gor-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #d5e4ee;border-radius:999px;padding:6px 9px;background:#f8fbfd;font-size:12px;font-weight:900;color:#244e6d;}
      .gor-chip.ok{border-color:#bde4cf;background:#effaf4;color:#087847}.gor-chip.warn{border-color:#f1d79c;background:#fff8e8;color:#8b5900}.gor-chip.bad{border-color:#edc6c2;background:#fff4f3;color:#a82a21}
      .gor-empty{padding:24px;text-align:center;color:#8398a9;border:1px dashed #c9dbe7;border-radius:14px;background:#fbfdff;}
      .gor-save-box{margin-top:16px;border-top:1px solid #e0ebf2;padding-top:16px;}
      .gor-route-list{display:grid;gap:12px;}
      .gor-route-card{border:1px solid #d8e6ef;background:#fff;border-radius:17px;padding:16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;box-shadow:0 9px 22px rgba(10,65,101,.05);}
      .gor-route-code{font-size:11px;font-weight:1000;color:#0697c7;letter-spacing:.08em;text-transform:uppercase;}.gor-route-card h4{margin:4px 0 7px;font-size:16px;color:#113b5a;}
      .gor-route-meta{display:flex;gap:7px;flex-wrap:wrap;color:#6d8497;font-size:12px}.gor-route-meta span{background:#f2f7fa;border-radius:999px;padding:5px 8px;}
      .gor-route-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end;}
      .gor-badge{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:1000;letter-spacing:.05em;background:#e9f5fb;color:#0875a8;}
      .gor-badge.completada{background:#e9f8ef;color:#087847}.gor-badge.cancelada,.gor-badge.archivada{background:#f1f3f5;color:#667684}.gor-badge.en_proceso{background:#fff4dc;color:#8d5c00}
      .gor-table-wrap{overflow:auto;border:1px solid #dce8f0;border-radius:14px}.gor-table{width:100%;border-collapse:collapse;min-width:650px}.gor-table th{background:#f2f8fb;color:#34566f;font-size:11px;text-align:left;padding:10px}.gor-table td{border-top:1px solid #e5edf3;padding:10px;font-size:12px;color:#34546c}.gor-table tr:hover td{background:#fbfdff}
      .gor-modal{position:fixed;inset:0;z-index:100090;background:rgba(5,24,42,.67);display:none;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(4px)}.gor-modal.open{display:flex}.gor-modal-card{width:min(1050px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 28px 80px rgba(0,0,0,.3)}.gor-modal-head{position:sticky;top:0;z-index:3;background:#fff;border-bottom:1px solid #e0eaf1;padding:16px 18px;display:flex;justify-content:space-between;align-items:center}.gor-modal-body{padding:18px}.gor-map{height:480px;border-radius:15px;border:1px solid #d5e4ee;overflow:hidden;background:#edf4f8}.gor-modal-close{width:38px;height:38px;border:1px solid #d6e4ed;border-radius:50%;background:#f8fbfd;color:#315873;font-size:18px;cursor:pointer}
      .gor-loading{opacity:.62;pointer-events:none}.gor-spin{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:gorSpin .7s linear infinite}@keyframes gorSpin{to{transform:rotate(360deg)}}
      @media(max-width:980px){.gor-grid{grid-template-columns:1fr}.gor-hero{flex-direction:column}.gor-hero-actions{justify-content:flex-start}.gor-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}}
      @media(max-width:620px){.gor-hero{padding:20px}.gor-hero h2{font-size:23px}.gor-form-grid{grid-template-columns:1fr}.gor-field.full{grid-column:auto}.gor-kpis{grid-template-columns:1fr 1fr}.gor-route-card{grid-template-columns:1fr}.gor-route-actions{justify-content:flex-start}.gor-tabs{width:100%}.gor-tab{flex:1;padding:9px 7px}.gor-card{padding:14px}.gor-map{height:380px}}
    `;
    document.head.appendChild(style);
  }

  function buildView(){
    if(document.getElementById('vista-ops-rutas')) return;
    var anchor = document.getElementById('vista-ops-historial') || document.getElementById('vista-ops-operaciones');
    if(!anchor || !anchor.parentNode) return;
    var view = document.createElement('div');
    view.id = 'vista-ops-rutas';
    view.className = 'hidden';
    view.innerHTML = `
      <div class="ops-scope gor-shell">
        <div class="gor-hero">
          <div>
            <div class="gor-eyebrow">Operaciones · Control territorial</div>
            <h2>Rutas y cobertura</h2>
            <p>Compara listas copiadas desde Excel o WhatsApp contra las agencias reales de un grupo. Detecta faltantes, sobrantes, duplicadas y códigos inválidos antes de guardar una ruta oficial.</p>
          </div>
          <div class="gor-hero-actions">
            <button class="gor-btn" id="gorRefreshDataBtn" type="button"><i class="fas fa-rotate"></i> Actualizar datos</button>
            <button class="gor-btn primary" id="gorNewComparisonBtn" type="button"><i class="fas fa-plus"></i> Nueva comparación</button>
          </div>
        </div>
        <div class="gor-tabs" role="tablist">
          <button class="gor-tab active" data-gor-tab="compare" type="button"><i class="fas fa-code-compare"></i> Comparar lista</button>
          <button class="gor-tab" data-gor-tab="saved" type="button"><i class="fas fa-route"></i> Rutas guardadas</button>
        </div>
        <section class="gor-panel active" data-gor-panel="compare">
          <div class="gor-grid">
            <div class="gor-card">
              <div class="gor-card-head"><div><h3>Lista de agencias</h3><p class="hint">Acepta números, líneas de Excel y formatos como “AG 0435 G-44”.</p></div></div>
              <div class="gor-form-grid">
                <div class="gor-field"><label for="gorGroupSelect">Grupo a comprobar</label><select class="gor-select" id="gorGroupSelect"><option value="">Selecciona un grupo</option></select></div>
                <div class="gor-field"><label for="gorRouteDate">Fecha de la ruta</label><input class="gor-input" id="gorRouteDate" type="date"></div>
                <div class="gor-field full"><label for="gorSourceText">Pega aquí la lista</label><textarea class="gor-textarea" id="gorSourceText" placeholder="Ejemplo:\n421\n423\nAG 425 G-44\n445, 656, 1044"></textarea></div>
              </div>
              <div class="gor-helper-row">
                <button class="gor-btn primary" id="gorCompareBtn" type="button"><i class="fas fa-code-compare"></i> Comparar ahora</button>
                <button class="gor-btn" id="gorOfficialListBtn" type="button"><i class="fas fa-list-check"></i> Usar lista oficial del grupo</button>
                <button class="gor-btn" id="gorClearBtn" type="button"><i class="fas fa-eraser"></i> Limpiar</button>
              </div>
              <div class="gor-save-box" id="gorSaveBox" hidden>
                <div class="gor-card-head"><div><h3>Guardar como ruta oficial</h3><p class="hint">Solo las agencias válidas del grupo formarán parte de la ruta.</p></div></div>
                <div class="gor-form-grid">
                  <div class="gor-field"><label for="gorRouteName">Nombre de la ruta</label><input class="gor-input" id="gorRouteName" placeholder="Ruta Grupo 44 · Semana 1"></div>
                  <div class="gor-field"><label for="gorAssigneeSelect">Asignar a</label><select class="gor-select" id="gorAssigneeSelect"><option value="">Sin asignar</option></select></div>
                  <div class="gor-field full"><label for="gorRouteNotes">Notas internas</label><input class="gor-input" id="gorRouteNotes" placeholder="Objetivo, prioridad o instrucciones..."></div>
                </div>
                <div class="gor-helper-row">
                  <button class="gor-btn primary" id="gorSaveRouteBtn" type="button"><i class="fas fa-floppy-disk"></i> Guardar ruta</button>
                  <button class="gor-btn" id="gorExportBtn" type="button"><i class="fas fa-file-csv"></i> Exportar comparación</button>
                  <button class="gor-btn" id="gorMapCurrentBtn" type="button"><i class="fas fa-map-location-dot"></i> Ver ruta en mapa</button>
                </div>
              </div>
            </div>
            <div class="gor-card">
              <div class="gor-card-head"><div><h3>Resultado de cobertura</h3><p class="hint" id="gorResultHint">Selecciona un grupo y compara una lista.</p></div></div>
              <div id="gorComparisonOutput"><div class="gor-empty"><i class="fas fa-code-compare" style="font-size:26px;margin-bottom:9px"></i><br>Los resultados aparecerán aquí.</div></div>
            </div>
          </div>
        </section>
        <section class="gor-panel" data-gor-panel="saved">
          <div class="gor-card">
            <div class="gor-card-head"><div><h3>Rutas guardadas</h3><p class="hint">Consulta las rutas oficiales, su asignación y cobertura.</p></div><button class="gor-btn small" id="gorReloadRoutesBtn" type="button"><i class="fas fa-rotate"></i> Recargar</button></div>
            <div class="gor-route-list" id="gorRouteList"><div class="gor-empty">Abre esta pestaña para consultar rutas.</div></div>
          </div>
        </section>
      </div>
      <div class="gor-modal" id="gorDetailModal" aria-hidden="true"><div class="gor-modal-card"><div class="gor-modal-head"><strong id="gorDetailTitle">Detalle de ruta</strong><button class="gor-modal-close" data-gor-close="gorDetailModal" type="button">×</button></div><div class="gor-modal-body" id="gorDetailBody"></div></div></div>
      <div class="gor-modal" id="gorMapModal" aria-hidden="true"><div class="gor-modal-card"><div class="gor-modal-head"><strong id="gorMapTitle">Mapa de ruta</strong><button class="gor-modal-close" data-gor-close="gorMapModal" type="button">×</button></div><div class="gor-modal-body"><div class="gor-map" id="gorMapCanvas"></div><div id="gorMapFallback" style="margin-top:12px"></div></div></div></div>
    `;
    anchor.parentNode.insertBefore(view, anchor.nextSibling);
  }

  function buildNav(){
    if(document.getElementById('navRoutesCoverage')) return;
    var menu = document.querySelector('.sidebar-group[data-section="operaciones"] .sidebar-group-menu');
    if(!menu) return;
    var ref = document.getElementById('navHistory');
    var link = document.createElement('a');
    link.className = 'sidebar-link ops-subitem';
    link.id = 'navRoutesCoverage';
    link.href = 'javascript:void(0)';
    link.innerHTML = '<i class="fas fa-route"></i><span>Rutas y cobertura</span>';
    link.addEventListener('click', function(ev){ ev.preventDefault(); global.GOOperationalRoutes.open(link); });
    if(ref && ref.parentNode === menu) menu.insertBefore(link, ref);
    else menu.appendChild(link);
    refreshPermissionVisibility();
  }

  function refreshPermissionVisibility(){
    var nav = document.getElementById('navRoutesCoverage');
    if(nav) nav.style.display = canView() ? '' : 'none';
  }

  function wrapNavigation(){
    if(global.__gorNavigationWrapped) return;
    global.__gorNavigationWrapped = true;
    var original = global.cambiarVista;
    if(typeof original === 'function'){
      global.cambiarVista = function(vista, el){
        if(vista !== 'ops-rutas'){
          var routesView = document.getElementById('vista-ops-rutas');
          if(routesView) routesView.classList.add('hidden');
        }
        return original.apply(this, arguments);
      };
      try{ cambiarVista = global.cambiarVista; }catch(_e){}
    }
  }

  function bindEvents(){
    if(state.initialized) return;
    state.initialized = true;
    qsa('[data-gor-tab]').forEach(function(btn){ btn.addEventListener('click', function(){ switchTab(btn.dataset.gorTab); }); });
    qs('#gorCompareBtn')?.addEventListener('click', compareFromForm);
    qs('#gorOfficialListBtn')?.addEventListener('click', fillOfficialList);
    qs('#gorClearBtn')?.addEventListener('click', resetComparison);
    qs('#gorNewComparisonBtn')?.addEventListener('click', function(){ switchTab('compare'); resetComparison(); });
    qs('#gorRefreshDataBtn')?.addEventListener('click', refreshAllData);
    qs('#gorSaveRouteBtn')?.addEventListener('click', saveRoute);
    qs('#gorExportBtn')?.addEventListener('click', exportComparisonCSV);
    qs('#gorMapCurrentBtn')?.addEventListener('click', function(){ if(state.comparison) openMap(state.comparison.correctAgencies, 'Vista previa de la ruta'); });
    qs('#gorReloadRoutesBtn')?.addEventListener('click', function(){ loadRoutes(true); });
    qs('#gorGroupSelect')?.addEventListener('change', function(){ suggestRouteName(); });
    qsa('[data-gor-close]').forEach(function(btn){ btn.addEventListener('click', function(){ closeModal(btn.dataset.gorClose); }); });
    qsa('.gor-modal').forEach(function(modal){ modal.addEventListener('click', function(ev){ if(ev.target === modal) closeModal(modal.id); }); });
  }

  function groups(){
    var list = Array.isArray(global.grupos) ? global.grupos : [];
    return list.filter(function(g){ return groupId(g) && !/desactivadas|cerradas/i.test(groupLabel(g)); });
  }
  function agencies(){ return Array.isArray(global.agencias) ? global.agencias : []; }
  function selectedGroup(){
    var id = text(qs('#gorGroupSelect')?.value);
    return groups().find(function(g){ return groupId(g) === id; }) || null;
  }
  function agencyBelongsToGroup(agency, group){
    var gid = groupId(group);
    var agid = agencyGroupId(agency);
    if(gid && agid) return gid === agid;
    return agencyGroupName(agency).toLowerCase() === groupLabel(group).toLowerCase();
  }
  function agenciesForGroup(group){
    if(!group) return [];
    return agencies().filter(function(a){ return agencyBelongsToGroup(a, group); }).sort(function(a,b){ return Number(agencyKey(a.numero||a.codigo)) - Number(agencyKey(b.numero||b.codigo)); });
  }
  function agencyMap(){
    var map = new Map();
    agencies().forEach(function(a){
      var key = agencyKey(a.numero || a.codigo || a.agencia);
      if(key && !map.has(key)) map.set(key,a);
    });
    return map;
  }

  function populateGroups(){
    var select = qs('#gorGroupSelect'); if(!select) return;
    var current = select.value;
    var list = groups().sort(function(a,b){ return groupLabel(a).localeCompare(groupLabel(b),'es',{numeric:true}); });
    select.innerHTML = '<option value="">Selecciona un grupo</option>' + list.map(function(g){ return '<option value="'+esc(groupId(g))+'">'+esc(groupCode(g)+' · '+groupLabel(g))+' ('+agenciesForGroup(g).length+' agencias)</option>'; }).join('');
    if(list.some(function(g){ return groupId(g) === current; })) select.value = current;
  }

  async function populateProfiles(force){
    var select = qs('#gorAssigneeSelect'); if(!select) return;
    try{
      var c = client(); if(!c) throw new Error('Supabase no está disponible.');
      var rt = runtime();
      var loader = async function(){
        var res = await c.from('perfiles').select('id,nombre_completo,correo,activo,roles(nombre),puestos(nombre)').eq('activo',true).order('nombre_completo',{ascending:true}).limit(1000);
        if(res.error){
          res = await c.from('perfiles').select('id,nombre_completo,correo,activo').eq('activo',true).order('nombre_completo',{ascending:true}).limit(1000);
        }
        if(res.error) throw res.error;
        return res.data || [];
      };
      state.profiles = rt ? await rt.data.fetch('rutas:perfiles',loader,{ttl:60000,force:!!force}) : await loader();
      select.innerHTML = '<option value="">Sin asignar</option>' + state.profiles.map(function(p){
        var role = p.roles && p.roles.nombre ? p.roles.nombre : '';
        var job = p.puestos && p.puestos.nombre ? p.puestos.nombre : '';
        var secondary = [role,job].filter(Boolean).join(' · ');
        return '<option value="'+esc(p.id)+'">'+esc(p.nombre_completo || p.correo || p.id)+(secondary?' — '+esc(secondary):'')+'</option>';
      }).join('');
    }catch(error){
      console.warn('[Rutas] No se pudo cargar responsables:',error);
      select.innerHTML = '<option value="">Sin asignar</option>';
    }
  }

  function parseAgencyTokens(source){
    var input = text(source);
    if(!input) return [];
    var tokens = [];
    input.split(/\r?\n/).forEach(function(rawLine, lineIndex){
      var line = text(rawLine);
      if(!line) return;
      var clean = line.replace(/\bG\s*[-:]?\s*\d{1,4}\b/ig,' ');
      var matches = [];
      var agencyMatch;
      var agencyRegex = /\bAG(?:ENCIA)?\s*[:#-]?\s*(\d{1,6})\b/ig;
      while((agencyMatch = agencyRegex.exec(clean))) matches.push(agencyMatch[1]);
      if(!matches.length){
        var generic = clean.match(/\b\d{1,6}\b/g) || [];
        matches = generic;
      }
      matches.forEach(function(raw){
        var key = agencyKey(raw);
        if(key) tokens.push({ raw:raw, key:key, display:padAgency(raw), line:lineIndex+1, sourceLine:line });
      });
    });
    return tokens;
  }

  function makeComparison(group, source){
    var tokens = parseAgencyTokens(source);
    var allMap = agencyMap();
    var official = agenciesForGroup(group);
    var officialKeys = new Set(official.map(function(a){ return agencyKey(a.numero || a.codigo); }));
    var seen = new Map();
    var items = [];
    var correctAgencies = [];
    var correctKeys = new Set();
    var duplicates = [];
    var otherGroup = [];
    var notFound = [];

    tokens.forEach(function(token,index){
      var count = (seen.get(token.key) || 0) + 1;
      seen.set(token.key,count);
      var agency = allMap.get(token.key) || null;
      var classification;
      if(count > 1){ classification = 'DUPLICADA'; duplicates.push(token); }
      else if(!agency){ classification = 'NO_EXISTE'; notFound.push(token); }
      else if(!officialKeys.has(token.key)){ classification = 'OTRO_GRUPO'; otherGroup.push({token:token,agency:agency}); }
      else{
        classification = 'COINCIDE';
        correctKeys.add(token.key);
        correctAgencies.push(agency);
      }
      items.push({
        numero_agencia:token.display,
        orden:index+1,
        clasificacion:classification,
        agencia_id:agencyId(agency),
        grupo_detectado_id:agency ? agencyGroupId(agency) || null : null,
        metadata:{linea:token.line,texto_original:token.sourceLine,grupo_detectado:agency ? agencyGroupName(agency) : ''}
      });
    });

    var missing = official.filter(function(a){ return !correctKeys.has(agencyKey(a.numero || a.codigo)); });
    return {
      group:group,
      source:source,
      tokens:tokens,
      items:items,
      correctAgencies:correctAgencies,
      duplicates:duplicates,
      otherGroup:otherGroup,
      notFound:notFound,
      missing:missing,
      official:official,
      counts:{
        pasted:tokens.length,
        unique:seen.size,
        correct:correctAgencies.length,
        missing:missing.length,
        otherGroup:otherGroup.length,
        notFound:notFound.length,
        duplicates:duplicates.length,
        official:official.length
      }
    };
  }

  function compareFromForm(){
    var group = selectedGroup();
    var source = qs('#gorSourceText')?.value || '';
    if(!group){ notify('Selecciona primero el grupo que deseas comprobar.','error'); qs('#gorGroupSelect')?.focus(); return; }
    var tokens = parseAgencyTokens(source);
    if(!tokens.length){ notify('Pega o escribe al menos un número de agencia.','error'); qs('#gorSourceText')?.focus(); return; }
    state.comparison = makeComparison(group,source);
    renderComparison();
    suggestRouteName();
    qs('#gorSaveBox').hidden = false;
  }

  function resultDetails(title,items,kind,open){
    var content = items.length ? items.map(function(item){
      var n = item && item.token ? item.token.display : padAgency(item && (item.numero || item.codigo || item.display || item));
      var extra = item && item.agency ? ' · '+agencyGroupName(item.agency) : '';
      return '<span class="gor-chip '+kind+'">AG '+esc(n)+esc(extra)+'</span>';
    }).join('') : '<span style="color:#8094a4;font-size:12px">Sin registros.</span>';
    return '<details class="gor-result" '+(open?'open':'')+'><summary><span>'+esc(title)+'</span><strong>'+items.length+'</strong></summary><div class="body"><div class="gor-chips">'+content+'</div></div></details>';
  }

  function renderComparison(){
    var c = state.comparison; var out = qs('#gorComparisonOutput'); if(!out || !c) return;
    qs('#gorResultHint').textContent = groupCode(c.group)+' · '+groupLabel(c.group)+' · '+c.counts.official+' agencias oficiales';
    out.innerHTML = `
      <div class="gor-kpis">
        <div class="gor-kpi"><strong>${c.counts.pasted}</strong><span>Registros pegados</span></div>
        <div class="gor-kpi ok"><strong>${c.counts.correct}</strong><span>Coinciden</span></div>
        <div class="gor-kpi warn"><strong>${c.counts.missing}</strong><span>Faltan en tu lista</span></div>
        <div class="gor-kpi bad"><strong>${c.counts.otherGroup}</strong><span>De otro grupo</span></div>
        <div class="gor-kpi bad"><strong>${c.counts.notFound}</strong><span>No existen</span></div>
        <div class="gor-kpi warn"><strong>${c.counts.duplicates}</strong><span>Duplicadas</span></div>
      </div>
      <div class="gor-result-sections">
        ${resultDetails('Correctas del grupo',c.correctAgencies,'ok',true)}
        ${resultDetails('Faltantes en la lista',c.missing,'warn',c.missing.length>0)}
        ${resultDetails('Pertenecen a otro grupo',c.otherGroup,'bad',c.otherGroup.length>0)}
        ${resultDetails('Códigos no encontrados',c.notFound,'bad',c.notFound.length>0)}
        ${resultDetails('Entradas duplicadas',c.duplicates,'warn',c.duplicates.length>0)}
      </div>
      ${c.missing.length ? '<div class="gor-helper-row"><button type="button" class="gor-btn small" id="gorAddMissingBtn"><i class="fas fa-plus"></i> Agregar faltantes a la lista</button><button type="button" class="gor-btn small" id="gorCopyMissingBtn"><i class="fas fa-copy"></i> Copiar faltantes</button></div>' : ''}
    `;
    qs('#gorAddMissingBtn')?.addEventListener('click',function(){
      var textarea = qs('#gorSourceText');
      if(!textarea) return;
      var extra = c.missing.map(function(a){ return padAgency(a.numero || a.codigo); }).join('\n');
      textarea.value = text(textarea.value) + (text(textarea.value)?'\n':'') + extra;
      compareFromForm();
    });
    qs('#gorCopyMissingBtn')?.addEventListener('click',function(){ copyText(c.missing.map(function(a){ return padAgency(a.numero || a.codigo); }).join('\n')); });
  }

  function fillOfficialList(){
    var group = selectedGroup();
    if(!group){ notify('Selecciona un grupo para cargar su lista oficial.','error'); return; }
    qs('#gorSourceText').value = agenciesForGroup(group).map(function(a){ return padAgency(a.numero || a.codigo); }).join('\n');
    compareFromForm();
  }

  function resetComparison(){
    state.comparison = null;
    var source = qs('#gorSourceText'); if(source) source.value = '';
    var name = qs('#gorRouteName'); if(name) name.value = '';
    var notes = qs('#gorRouteNotes'); if(notes) notes.value = '';
    var out = qs('#gorComparisonOutput'); if(out) out.innerHTML = '<div class="gor-empty"><i class="fas fa-code-compare" style="font-size:26px;margin-bottom:9px"></i><br>Los resultados aparecerán aquí.</div>';
    var hint = qs('#gorResultHint'); if(hint) hint.textContent = 'Selecciona un grupo y compara una lista.';
    var save = qs('#gorSaveBox'); if(save) save.hidden = true;
  }

  function suggestRouteName(){
    var group = selectedGroup(); var input = qs('#gorRouteName');
    if(!group || !input || text(input.value)) return;
    var date = qs('#gorRouteDate')?.value || nowISO();
    input.value = 'Ruta '+groupCode(group)+' · '+formatDate(date);
  }

  function switchTab(name){
    qsa('[data-gor-tab]').forEach(function(b){ b.classList.toggle('active',b.dataset.gorTab===name); });
    qsa('[data-gor-panel]').forEach(function(p){ p.classList.toggle('active',p.dataset.gorPanel===name); });
    if(name === 'saved') loadRoutes(false);
  }

  function copyText(value){
    var v = text(value); if(!v) return;
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(v).then(function(){ notify('Lista copiada.','success'); }).catch(function(){ fallbackCopy(v); }); }
    else fallbackCopy(v);
  }
  function fallbackCopy(value){
    var ta=document.createElement('textarea');ta.value=value;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();notify('Lista copiada.','success');
  }

  function comparisonSummary(c){
    return {
      counts:c.counts,
      correctas:c.correctAgencies.map(function(a){ return padAgency(a.numero||a.codigo); }),
      faltantes:c.missing.map(function(a){ return padAgency(a.numero||a.codigo); }),
      otro_grupo:c.otherGroup.map(function(x){ return {numero:x.token.display,grupo:agencyGroupName(x.agency)}; }),
      no_existen:c.notFound.map(function(x){ return x.display; }),
      duplicadas:c.duplicates.map(function(x){ return x.display; })
    };
  }

  async function saveRoute(){
    if(!canManage()){ notify('Tu perfil puede consultar rutas, pero no guardarlas.','error'); return; }
    var c = state.comparison;
    if(!c){ notify('Primero realiza una comparación.','error'); return; }
    if(!c.correctAgencies.length){ notify('No hay agencias válidas para guardar como ruta.','error'); return; }
    var name = text(qs('#gorRouteName')?.value);
    if(!name){ notify('Escribe un nombre para la ruta.','error'); qs('#gorRouteName')?.focus(); return; }
    var sb = client(); if(!sb){ notify('Supabase no está disponible.','error'); return; }
    var btn = qs('#gorSaveRouteBtn'); setButtonLoading(btn,true,'Guardando...');
    try{
      var response = await sb.rpc('rpc_rutas_operativas_guardar',{
        p_nombre:name,
        p_grupo_id:groupId(c.group),
        p_fecha:qs('#gorRouteDate')?.value || nowISO(),
        p_asignado_a:text(qs('#gorAssigneeSelect')?.value) || null,
        p_notas:text(qs('#gorRouteNotes')?.value) || null,
        p_fuente:c.source,
        p_resumen:comparisonSummary(c),
        p_items:c.items
      });
      if(response.error) throw response.error;
      var rt=runtime(); if(rt) rt.data.invalidate('rutas:');
      notify('Ruta guardada correctamente.','success');
      await loadRoutes(true);
      switchTab('saved');
    }catch(error){ handleError(error,'guardar ruta'); }
    finally{ setButtonLoading(btn,false); }
  }

  async function loadRoutes(force){
    if(state.loadingRoutes) return;
    var list = qs('#gorRouteList'); if(!list) return;
    state.loadingRoutes = true;
    list.innerHTML = '<div class="gor-empty"><span class="gor-spin" style="display:inline-block"></span><br>Cargando rutas...</div>';
    try{
      var sb=client(); if(!sb) throw new Error('Supabase no está disponible.');
      var loader=async function(){ var res=await sb.rpc('rpc_rutas_operativas_listar',{p_limite:200}); if(res.error) throw res.error; return Array.isArray(res.data)?res.data:[]; };
      var rt=runtime();
      state.routes = rt ? await rt.data.fetch('rutas:listado',loader,{ttl:30000,force:!!force}) : await loader();
      renderRoutes();
    }catch(error){
      var msg=friendlyError(error);
      list.innerHTML='<div class="gor-empty"><strong>No se pudieron cargar las rutas.</strong><br><span style="font-size:12px">'+esc(msg)+'</span></div>';
      console.warn('[Rutas]',error);
    }finally{ state.loadingRoutes=false; }
  }

  function renderRoutes(){
    var list=qs('#gorRouteList'); if(!list) return;
    if(!state.routes.length){ list.innerHTML='<div class="gor-empty">Todavía no hay rutas guardadas.</div>'; return; }
    list.innerHTML=state.routes.map(function(r){
      var status=text(r.estado||'PENDIENTE').toLowerCase();
      var counts=r.resumen&&r.resumen.counts?r.resumen.counts:{};
      return `<article class="gor-route-card">
        <div><div class="gor-route-code">${esc(r.codigo||'RUTA')}</div><h4>${esc(r.nombre||'Ruta operativa')}</h4><div class="gor-route-meta"><span><i class="fas fa-users"></i> ${esc(r.grupo_nombre||r.grupo_codigo||'-')}</span><span><i class="fas fa-calendar"></i> ${esc(formatDate(r.fecha))}</span><span><i class="fas fa-location-dot"></i> ${Number(counts.correct||r.total_agencias||0)} agencias</span><span><i class="fas fa-user"></i> ${esc(r.asignado_nombre||'Sin asignar')}</span></div></div>
        <div class="gor-route-actions"><span class="gor-badge ${esc(status)}">${esc(text(r.estado||'PENDIENTE').replace(/_/g,' '))}</span><button class="gor-btn small" type="button" data-gor-detail="${esc(r.id)}"><i class="fas fa-eye"></i> Ver</button><button class="gor-btn small" type="button" data-gor-reuse="${esc(r.id)}"><i class="fas fa-copy"></i> Reutilizar</button></div>
      </article>`;
    }).join('');
    qsa('[data-gor-detail]',list).forEach(function(btn){ btn.addEventListener('click',function(){ openRouteDetail(btn.dataset.gorDetail); }); });
    qsa('[data-gor-reuse]',list).forEach(function(btn){ btn.addEventListener('click',function(){ reuseRoute(btn.dataset.gorReuse); }); });
  }

  async function routeDetail(id){
    var sb=client(); if(!sb) throw new Error('Supabase no está disponible.');
    var loader=async function(){ var res=await sb.rpc('rpc_rutas_operativas_detalle',{p_ruta_id:id}); if(res.error) throw res.error; return res.data||{}; };
    var rt=runtime(); return rt ? rt.data.fetch('rutas:detalle:'+id,loader,{ttl:30000}) : loader();
  }

  async function openRouteDetail(id){
    openModal('gorDetailModal');
    qs('#gorDetailTitle').textContent='Detalle de ruta';
    qs('#gorDetailBody').innerHTML='<div class="gor-empty"><span class="gor-spin" style="display:inline-block"></span><br>Cargando detalle...</div>';
    try{
      var data=await routeDetail(id); var r=data.ruta||{}; var items=Array.isArray(data.items)?data.items:[];
      var valid=items.filter(function(i){return i.clasificacion==='COINCIDE';});
      qs('#gorDetailTitle').textContent=(r.codigo||'Ruta')+' · '+(r.nombre||'');
      qs('#gorDetailBody').innerHTML=`
        <div class="gor-kpis"><div class="gor-kpi ok"><strong>${valid.length}</strong><span>Agencias de la ruta</span></div><div class="gor-kpi"><strong>${items.length}</strong><span>Registros analizados</span></div><div class="gor-kpi warn"><strong>${Number(r.resumen?.counts?.missing||0)}</strong><span>Faltantes al guardar</span></div></div>
        <div class="gor-helper-row" style="margin-bottom:14px"><button class="gor-btn primary" id="gorDetailMapBtn" type="button"><i class="fas fa-map-location-dot"></i> Ver en mapa</button><button class="gor-btn" id="gorDetailReuseBtn" type="button"><i class="fas fa-copy"></i> Cargar en comparador</button></div>
        <div class="gor-table-wrap"><table class="gor-table"><thead><tr><th>#</th><th>Agencia</th><th>Clasificación</th><th>Estado de visita</th></tr></thead><tbody>${items.map(function(i){return '<tr><td>'+Number(i.orden||0)+'</td><td><strong>AG '+esc(padAgency(i.numero_agencia))+'</strong></td><td>'+esc(i.clasificacion||'-')+'</td><td>'+esc((i.estado_visita||'PENDIENTE').replace(/_/g,' '))+'</td></tr>';}).join('')}</tbody></table></div>`;
      qs('#gorDetailReuseBtn')?.addEventListener('click',function(){ closeModal('gorDetailModal'); applyRouteToComparator(data); });
      qs('#gorDetailMapBtn')?.addEventListener('click',function(){
        var mapBy=agencyMap(); var ags=valid.map(function(i){return mapBy.get(agencyKey(i.numero_agencia));}).filter(Boolean); openMap(ags,(r.codigo||'Ruta')+' · '+(r.nombre||''));
      });
    }catch(error){ qs('#gorDetailBody').innerHTML='<div class="gor-empty">'+esc(friendlyError(error))+'</div>'; }
  }

  async function reuseRoute(id){
    try{ var data=await routeDetail(id); applyRouteToComparator(data); }
    catch(error){ handleError(error,'reutilizar ruta'); }
  }
  function applyRouteToComparator(data){
    var r=data.ruta||{}; var items=Array.isArray(data.items)?data.items:[];
    switchTab('compare');
    var groupSelect=qs('#gorGroupSelect'); if(groupSelect) groupSelect.value=r.grupo_id||'';
    qs('#gorSourceText').value=text(r.fuente_original)||items.filter(function(i){return i.clasificacion==='COINCIDE';}).map(function(i){return padAgency(i.numero_agencia);}).join('\n');
    qs('#gorRouteDate').value=nowISO();
    qs('#gorRouteName').value='Copia de '+text(r.nombre||r.codigo||'ruta');
    compareFromForm();
    window.scrollTo({top:document.getElementById('vista-ops-rutas').offsetTop||0,behavior:'smooth'});
  }

  function exportComparisonCSV(){
    var c=state.comparison;if(!c){notify('Primero realiza una comparación.','error');return;}
    var rows=[['Numero','Clasificacion','Grupo detectado','Linea original']];
    c.items.forEach(function(i){rows.push([i.numero_agencia,i.clasificacion,i.metadata?.grupo_detectado||'',i.metadata?.texto_original||'']);});
    c.missing.forEach(function(a){rows.push([padAgency(a.numero||a.codigo),'FALTA_EN_LISTA',groupLabel(c.group),'']);});
    var csv='\uFEFF'+rows.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(',');}).join('\r\n');
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='comparacion-'+groupCode(c.group).replace(/[^a-z0-9]/gi,'-')+'-'+nowISO()+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }

  function setButtonLoading(btn,on,label){
    if(!btn)return;
    if(on){btn.dataset.originalHtml=btn.innerHTML;btn.innerHTML='<span class="gor-spin"></span> '+esc(label||'Procesando...');btn.disabled=true;}
    else{btn.innerHTML=btn.dataset.originalHtml||btn.innerHTML;btn.disabled=false;}
  }

  function openModal(id){var m=document.getElementById(id);if(m){m.classList.add('open');m.setAttribute('aria-hidden','false');}}
  function closeModal(id){var m=document.getElementById(id);if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}if(id==='gorMapModal'&&state.map){try{state.map.remove();}catch(_e){}state.map=null;state.mapMarkers=[];}}

  function openMap(routeAgencies,title){
    var list=(routeAgencies||[]).filter(Boolean);openModal('gorMapModal');qs('#gorMapTitle').textContent=title||'Mapa de ruta';var fallback=qs('#gorMapFallback');fallback.innerHTML='';
    var coords=list.map(function(a){var lat=Number(a.latitud),lng=Number(a.longitud);return Number.isFinite(lat)&&Number.isFinite(lng)?{a:a,lat:lat,lng:lng}:null;}).filter(Boolean);
    if(!global.maplibregl||!coords.length){
      qs('#gorMapCanvas').innerHTML='<div class="gor-empty" style="margin:20px">No hay coordenadas suficientes para dibujar el mapa.</div>';
      fallback.innerHTML='<div class="gor-chips">'+list.map(function(a){return '<span class="gor-chip">AG '+esc(padAgency(a.numero||a.codigo))+'</span>';}).join('')+'</div>';return;
    }
    try{
      if(state.map)state.map.remove();
      state.map=new global.maplibregl.Map({container:'gorMapCanvas',style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap'}},layers:[{id:'osm',type:'raster',source:'osm'}]},center:[coords[0].lng,coords[0].lat],zoom:11});
      state.map.addControl(new global.maplibregl.NavigationControl(),'top-right');
      var bounds=new global.maplibregl.LngLatBounds();
      coords.forEach(function(x,index){
        var el=document.createElement('div');el.style.cssText='width:30px;height:30px;border-radius:50%;background:#0689c4;color:white;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:1000';el.textContent=String(index+1);
        var popup=new global.maplibregl.Popup({offset:20}).setHTML('<strong>AG '+esc(padAgency(x.a.numero||x.a.codigo))+'</strong><br>'+esc(x.a.nombre||'Agencia')+'<br>'+esc(agencyGroupName(x.a)));
        new global.maplibregl.Marker({element:el}).setLngLat([x.lng,x.lat]).setPopup(popup).addTo(state.map);bounds.extend([x.lng,x.lat]);
      });
      state.map.on('load',function(){state.map.resize();if(coords.length>1)state.map.fitBounds(bounds,{padding:55,maxZoom:15});});
      fallback.innerHTML='<div style="color:#6e8495;font-size:12px;margin-top:8px">'+coords.length+' de '+list.length+' agencias tienen coordenadas disponibles.</div>';
    }catch(error){fallback.innerHTML='<div class="gor-empty">No se pudo abrir el mapa: '+esc(friendlyError(error))+'</div>';}
  }

  async function refreshAllData(){
    var btn=qs('#gorRefreshDataBtn');setButtonLoading(btn,true,'Actualizando...');
    try{
      if(typeof global.lotekaReloadAgenciasGruposSupabase==='function')await global.lotekaReloadAgenciasGruposSupabase();
      populateGroups();await populateProfiles(true);var rt=runtime();if(rt)rt.data.invalidate('rutas:');await loadRoutes(true);notify('Datos actualizados.','success');
    }catch(error){handleError(error,'actualizar datos');}finally{setButtonLoading(btn,false);}
  }

  async function open(nav){
    if(!canView()){notify('No tienes permiso para consultar Rutas y cobertura.','error');return;}
    if(typeof global.cambiarVista==='function')global.cambiarVista('ops-rutas',nav||document.getElementById('navRoutesCoverage'));
    else{qsa('[id^="vista-"]').forEach(function(v){v.classList.add('hidden');});document.getElementById('vista-ops-rutas')?.classList.remove('hidden');}
    try{if(typeof global.setSidebarSectionOpen==='function')global.setSidebarSectionOpen('operaciones',true);}catch(_e){}
    populateGroups();populateProfiles(false);if(!qs('#gorRouteDate').value)qs('#gorRouteDate').value=nowISO();
  }

  function init(){
    injectStyles();buildView();buildNav();wrapNavigation();bindEvents();populateGroups();if(qs('#gorRouteDate'))qs('#gorRouteDate').value=nowISO();refreshPermissionVisibility();
    var rt=runtime();
    if(rt){rt.modules.register('operaciones-rutas',{version:VERSION,refresh:refreshAllData,open:open});rt.events.on('auth:ready',function(){refreshPermissionVisibility();populateGroups();});rt.events.on('state:permissions',refreshPermissionVisibility);}
  }

  global.GOOperationalRoutes={version:VERSION,init:init,open:open,compare:compareFromForm,refresh:refreshAllData,parseList:parseAgencyTokens,compareData:makeComparison,diagnostics:function(){return{version:VERSION,comparison:state.comparison?state.comparison.counts:null,routes:state.routes.length,profiles:state.profiles.length,canView:canView(),canManage:canManage()};}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);

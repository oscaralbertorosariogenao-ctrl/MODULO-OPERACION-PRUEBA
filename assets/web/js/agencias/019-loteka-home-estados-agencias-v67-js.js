
(function(){
  if(window.__lotekaHomeEstadosV67) return;
  window.__lotekaHomeEstadosV67 = true;

  function esc(v){
    try{ if(typeof homeSafe === 'function') return homeSafe(v); }catch(e){}
    try{ if(typeof escapeHtml === 'function') return escapeHtml(v); }catch(e){}
    return String(v ?? '').replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]; });
  }
  function list(){
    try{ if(Array.isArray(window.agencias)) return window.agencias; }catch(e){}
    try{ if(Array.isArray(agencias)) return agencias; }catch(e){}
    return [];
  }
  function normStatus(v){
    let value = v;
    try{
      if(typeof normalizarEstadoAgencia === 'function'){
        value = normalizarEstadoAgencia(v);
      }
    }catch(e){}
    const clean = String(value || 'ACTIVA')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toUpperCase().trim();

    // Soporta tanto los estados viejos del sistema: ACTIVA / DESACTIVADA/CERRADA
    // como los estados normalizados del mapa MapLibre: activa / en_proceso / remodelacion / cerrada.
    if(clean.includes('PROCESO') || clean === 'EN_PROCESO') return 'EN PROCESO';
    if(clean.includes('REMODEL')) return 'REMODELACIÓN';
    if(clean.includes('CERR') || clean.includes('DESACT') || clean.includes('INACT')) return 'DESACTIVADA/CERRADA';
    if(clean.includes('ACTIVA') || clean.includes('ACTIVO') || clean.includes('ABIERTA') || clean.includes('SERVICIO') || clean.includes('OPERANDO') || clean === '') return 'ACTIVA';
    return 'ACTIVA';
  }
  function statusOf(a){
    let raw = a?.detalle?.estadoOperativo || a?.estadoOperativo || a?.estado || a?.status || a?.estado_agencia || 'ACTIVA';
    try{
      if(typeof getAgencyEstadoOperativo === 'function'){
        raw = getAgencyEstadoOperativo(a);
      }
    }catch(e){}
    return normStatus(raw);
  }
  function statusClass(s){
    s = normStatus(s);
    if(s === 'EN PROCESO') return 'process';
    if(s === 'REMODELACIÓN') return 'remodel';
    if(s === 'DESACTIVADA/CERRADA') return 'closed';
    return 'active';
  }
  function statusLabel(s){
    s = normStatus(s);
    if(s === 'DESACTIVADA/CERRADA') return 'Cerrada';
    if(s === 'EN PROCESO') return 'En proceso';
    if(s === 'REMODELACIÓN') return 'En remodelación';
    return 'Activa';
  }
  function agencyLabel(a){
    try{ if(typeof homeAgencyLabel === 'function') return homeAgencyLabel(a); }catch(e){}
    try{ if(typeof formatAgencyOptionLabel === 'function') return formatAgencyOptionLabel(a); }catch(e){}
    const n = String(a?.numero ?? '').padStart(4,'0');
    return a?.nombre || ('Agencia ' + n);
  }
  function groupName(a){
    try{ if(typeof homeGroupName === 'function') return homeGroupName(a); }catch(e){}
    try{ if(typeof getAgencyRealGroup === 'function') return getAgencyRealGroup(a); }catch(e){}
    return a?.grupoReal || a?.detalle?.grupoReal || a?.grupo || 'Grupo 00';
  }
  function creationLabel(a){
    try{ if(typeof homeCreationDateLabel === 'function') return homeCreationDateLabel(a); }catch(e){}
    const raw = a?.fechaCreacion || a?.fecha_creacion || a?.createdAt || a?.fecha || a?.created_at;
    const d = raw ? new Date(raw) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'}) : 'Sin fecha';
  }
  function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
  function counts(){
    const rows = list();
    return {
      activa: rows.filter(a => statusOf(a) === 'ACTIVA').length,
      proceso: rows.filter(a => statusOf(a) === 'EN PROCESO').length,
      remodel: rows.filter(a => statusOf(a) === 'REMODELACIÓN').length,
      cerrada: rows.filter(a => statusOf(a) === 'DESACTIVADA/CERRADA').length,
      total: rows.length
    };
  }
  function ensureStatusPanel(){
    if(document.getElementById('homeStatusFiltersV67')) return;
    const typePanel = document.getElementById('homeTypeFiltersV57');
    const kpis = document.querySelector('.home-agency-kpis');
    if(!kpis) return;
    const section = document.createElement('section');
    section.id = 'homeStatusFiltersV67';
    section.className = 'home-status-filter-panel-v67';
    section.innerHTML = `
      <div class="home-status-filter-head-v67">
        <div>
          <h3><i class="fas fa-signal"></i> Estados operativos</h3>
          <p>Seguimiento directo de agencias en creación o remodelación.</p>
        </div>
        <button type="button" class="home-status-filter-total-v67" onclick="homeOpenAgencyPanel('total')"><i class="fas fa-layer-group"></i> Ver todas</button>
      </div>
      <div class="home-status-filter-grid-v67">
        <button type="button" class="home-status-card-v67 process" onclick="homeOpenAgencyPanel('en_proceso')">
          <i class="home-status-icon-v67 fas fa-person-digging"></i>
          <span>En proceso</span>
          <div><strong id="homeAgenciasEnProcesoV67">0</strong><small>creación / apertura</small></div>
          <b><i class="fas fa-arrow-right"></i></b>
        </button>
        <button type="button" class="home-status-card-v67 remodel" onclick="homeOpenAgencyPanel('remodelacion')">
          <i class="home-status-icon-v67 fas fa-paint-roller"></i>
          <span>En remodelación</span>
          <div><strong id="homeAgenciasRemodelacionV67">0</strong><small>mejoras en curso</small></div>
          <b><i class="fas fa-arrow-right"></i></b>
        </button>
      </div>`;
    if(typePanel) typePanel.insertAdjacentElement('afterend', section);
    else kpis.insertAdjacentElement('afterend', section);
  }
  function renderLatest(){
    const tbody = document.getElementById('homeUltimasAgencias');
    if(!tbody) return;
    const rows = list().slice().sort(function(a,b){
      function time(x){
        const raw = x?.fechaCreacion || x?.fecha_creacion || x?.createdAt || x?.fecha || x?.created_at;
        const d = raw ? new Date(raw) : null;
        return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
      }
      return time(b)-time(a) || Number(b?.numero||0)-Number(a?.numero||0);
    }).slice(0,6);
    tbody.innerHTML = rows.length ? rows.map(function(a){
      const s = statusOf(a);
      return `<tr>
        <td><strong>${esc(agencyLabel(a))}</strong></td>
        <td>${esc(groupName(a))}</td>
        <td><span class="home-state-pill ${statusClass(s)}">${esc(statusLabel(s))}</span></td>
        <td>${esc(creationLabel(a))}</td>
        <td><button class="home-row-action" onclick="homeOpenAgencyFromHome('${esc(a?.numero)}')"><i class="fas fa-eye"></i> Ver</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="5">No hay agencias registradas.</td></tr>';
  }
  function renderStatusPanel(){
    ensureStatusPanel();
    const c = counts();
    try{ console.log('HOME estados corregidos:', c); }catch(e){}
    setText('homeAgenciasActivas', c.activa);
    setText('homeAgenciasCerradas', c.cerrada);
    setText('homeAgenciasTotal', c.total);
    setText('homeAgenciasEnProcesoV67', c.proceso);
    setText('homeAgenciasRemodelacionV67', c.remodel);
    const preview = document.getElementById('homeMapPreviewCount');
    if(preview) preview.textContent = `${c.activa} agencias activas · ${c.proceso} en proceso · ${c.remodel} en remodelación`;
    renderLatest();
  }

  const oldOpenPanel = window.homeOpenAgencyPanel;
  window.homeOpenAgencyPanel = function(type){
    if(type !== 'en_proceso' && type !== 'remodelacion'){
      if(typeof oldOpenPanel === 'function') oldOpenPanel.apply(this, arguments);
      renderStatusPanel();
      return;
    }
    const wanted = type === 'en_proceso' ? 'EN PROCESO' : 'REMODELACIÓN';
    const title = type === 'en_proceso' ? 'Agencias en proceso' : 'Agencias en remodelación';
    const subText = type === 'en_proceso'
      ? 'Agencias que están en proceso de creación antes de operar normalmente.'
      : 'Agencias que están siendo remodeladas o mejoradas.';
    const panel = document.getElementById('homeAgencyPanel');
    const titleEl = document.getElementById('homeAgencyPanelTitle');
    const sub = document.getElementById('homeAgencyPanelSub');
    const head = document.getElementById('homeAgencyPanelHead');
    const body = document.getElementById('homeAgencyPanelBody');
    if(!panel || !head || !body) return;
    if(titleEl) titleEl.textContent = title;
    if(sub) sub.textContent = subText;
    const rows = list().filter(a => statusOf(a) === wanted);
    head.innerHTML = '<tr><th>Agencia</th><th>Grupo</th><th>Estado</th><th>Creación</th><th>Encargado</th><th>Acción</th></tr>';
    body.innerHTML = rows.length ? rows.map(function(a){
      const s = statusOf(a);
      return `<tr>
        <td><strong>${esc(agencyLabel(a))}</strong></td>
        <td>${esc(groupName(a))}</td>
        <td><span class="home-state-pill ${statusClass(s)}">${esc(statusLabel(s))}</span></td>
        <td>${esc(creationLabel(a))}</td>
        <td>${esc(a?.encargado || a?.detalle?.encargado || 'Sin encargado')}</td>
        <td><button class="home-row-action" onclick="homeOpenAgencyFromHome('${esc(a?.numero || '')}')">Abrir</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="6">No hay agencias registradas con este estado.</td></tr>';
    panel.classList.remove('hidden');
    try{ panel.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
    renderStatusPanel();
  };

  const oldRender = window.homeRenderDashboard;
  window.homeRenderDashboard = function(){
    if(typeof oldRender === 'function') oldRender.apply(this, arguments);
    renderStatusPanel();
  };

  const oldGuardar = window.guardarAgencia;
  if(typeof oldGuardar === 'function' && !window.__guardarAgenciaEstadosV67){
    window.__guardarAgenciaEstadosV67 = true;
    window.guardarAgencia = function(){
      const r = oldGuardar.apply(this, arguments);
      setTimeout(function(){
        try{ renderStatusPanel(); }catch(e){}
        try{ if(typeof lotekaSoftRefresh === 'function') lotekaSoftRefresh('agencias'); }catch(e){}
      },80);
      return r;
    };
  }

  function boot(){ try{ renderStatusPanel(); }catch(e){ console.warn('Estados agencias HOME v67', e); } }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot,140); });
  else setTimeout(boot,80);
  window.addEventListener('load', function(){ setTimeout(boot,300); setTimeout(boot,1100); });
})();

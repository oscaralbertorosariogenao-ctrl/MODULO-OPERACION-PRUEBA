
(function(){
  'use strict';
  const TYPE_FILTERS_V57 = [
    {key:'agencia_normal', label:'Agencias normales', short:'Agencias', icon:'fa-store', cls:'normal'},
    {key:'pasante', label:'Agencias pasantes', short:'Pasantes', icon:'fa-person-walking-arrow-right', cls:'pasante'},
    {key:'punto_pago', label:'Puntos de pago', short:'Puntos', icon:'fa-money-bill-transfer', cls:'punto'},
    {key:'centro_pago', label:'Centros de pago', short:'Centros', icon:'fa-sack-dollar', cls:'centro'},
    {key:'supermercado', label:'En supermercados', short:'Supermercados', icon:'fa-cart-shopping', cls:'super'},
    {key:'socio', label:'Socios', short:'Socios', icon:'fa-star', cls:'aprezio'}
  ];
  function agencies(){
    try{ if(Array.isArray(window.agencias)) return window.agencias; }catch(e){}
    try{ if(typeof agencias !== 'undefined' && Array.isArray(agencias)) return agencias; }catch(e){}
    return [];
  }
  function esc(v){
    try{ if(typeof escapeHtml === 'function') return escapeHtml(v); }catch(e){}
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function pad(num){ return String(num || '').padStart(4,'0'); }
  function tipoAgencia(a){
    try{ if(typeof getAgencyTipoAgencia === 'function') return getAgencyTipoAgencia(a); }catch(e){}
    try{ if(typeof normalizarTipoAgencia === 'function') return normalizarTipoAgencia(a?.detalle?.tipoAgencia || a?.tipoAgencia || 'Agencia'); }catch(e){}
    return a?.detalle?.tipoAgencia || a?.tipoAgencia || 'Agencia';
  }
  function typeKey(a){
    try{
      if(typeof normalizarTipoAgenciaMapa === 'function'){
        return normalizarTipoAgenciaMapa(
          (typeof agencyMapTipoRaw === 'function' ? agencyMapTipoRaw(a) : null) ||
          a?.tipo || a?.tipo_agencia || a?.categoria ||
          a?.detalle?.tipoAgencia || a?.tipoAgencia ||
          tipoAgencia(a) || 'Agencia'
        );
      }
    }catch(e){}

    const t = String(tipoAgencia(a) || '').toLowerCase().trim();
    if(t.includes('pasante')) return 'pasante';
    if(t.includes('socio')) return 'socio';
    if(t.includes('punto')) return 'punto_pago';
    if(t.includes('centro')) return 'centro_pago';
    if(t.includes('super') || t.includes('mercado')) return 'supermercado';
    return 'agencia_normal';
  }
  function status(a){
    try{ if(typeof getAgencyEstadoOperativo === 'function') return getAgencyEstadoOperativo(a); }catch(e){}
    return a?.estadoOperativo || a?.detalle?.estadoOperativo || 'ACTIVA';
  }
  function isClosed(a){
    const s = String(status(a)||'').toUpperCase();
    return s.includes('CERRADA') || s.includes('DESACTIVADA');
  }
  function groupName(a){
    try{ if(typeof getAgencyRealGroup === 'function') return getAgencyRealGroup(a); }catch(e){}
    return a?.grupoReal || a?.detalle?.grupoReal || a?.grupo || 'Grupo 00';
  }
  function agencyLabel(a){
    try{ if(typeof formatAgencyOptionLabel === 'function') return formatAgencyOptionLabel(a); }catch(e){}
    return a?.nombre || `Agencia ${pad(a?.numero)}`;
  }
  function creationDateLabel(a){
    try{ if(typeof homeCreationDateLabel === 'function') return homeCreationDateLabel(a); }catch(e){}
    const raw = a?.fechaCreacion || a?.fecha_creacion || a?.createdAt || a?.fecha || a?.created_at;
    const d = raw ? new Date(raw) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'}) : 'Sin fecha';
  }
  function ensurePanel(){
    if(document.getElementById('homeTypeFiltersV57')) return;
    const kpis = document.querySelector('.home-agency-kpis');
    if(!kpis) return;
    const section = document.createElement('section');
    section.id = 'homeTypeFiltersV57';
    section.className = 'home-type-filter-panel-v57';
    section.innerHTML = `
      <div class="home-type-filter-head-v57">
        <div>
          <h3><i class="fas fa-filter-circle-dollar"></i> Filtros por tipo de agencia</h3>
          <p>Consulta rápida alimentada por el campo <strong>Tipo de agencia</strong> de cada registro.</p>
        </div>
        <button type="button" class="home-type-filter-total-v57" onclick="homeOpenAgencyPanel('total')"><i class="fas fa-layer-group"></i> Ver todas</button>
      </div>
      <div class="home-type-filter-grid-v57" id="homeTypeGridV57"></div>
    `;
    kpis.insertAdjacentElement('afterend', section);
  }
  function renderTypeFilters(){
    ensurePanel();
    const grid = document.getElementById('homeTypeGridV57');
    if(!grid) return;
    const list = agencies();
    const counts = Object.fromEntries(TYPE_FILTERS_V57.map(t => [t.key, 0]));
    list.forEach(a => { const k = typeKey(a); counts[k] = (counts[k] || 0) + 1; });
    grid.innerHTML = TYPE_FILTERS_V57.map(t => `
      <button type="button" class="home-type-card-v57 ${t.cls}" onclick="homeOpenAgencyTypePanelV57('${t.key}')">
        <i class="fas ${t.icon}"></i>
        <span>${esc(t.label)}</span>
        <strong id="homeTypeCount_${t.key}">${counts[t.key] || 0}</strong>
        <small>${(counts[t.key] || 0) === 1 ? 'agencia registrada' : 'agencias registradas'}</small>
      </button>
    `).join('');
  }
  window.homeOpenAgencyTypePanelV57 = function(key){
    const info = TYPE_FILTERS_V57.find(t => t.key === key) || TYPE_FILTERS_V57[0];
    const panel = document.getElementById('homeAgencyPanel');
    const title = document.getElementById('homeAgencyPanelTitle');
    const sub = document.getElementById('homeAgencyPanelSub');
    const head = document.getElementById('homeAgencyPanelHead');
    const body = document.getElementById('homeAgencyPanelBody');
    if(!panel || !head || !body) return;
    const rows = agencies().filter(a => typeKey(a) === key);
    if(title) title.textContent = info.label;
    if(sub) sub.textContent = `Listado filtrado por tipo de agencia: ${info.label}.`;
    head.innerHTML = '<tr><th>Agencia</th><th>Tipo</th><th>Grupo</th><th>Estado</th><th>Creación</th><th>Encargado</th><th>Acción</th></tr>';
    body.innerHTML = rows.length ? rows.map(a => {
      const closed = isClosed(a);
      const stateClass = closed ? 'closed' : 'active';
      return `<tr>
        <td><strong>${esc(agencyLabel(a))}</strong></td>
        <td>${esc(tipoAgencia(a))}</td>
        <td>${esc(groupName(a))}</td>
        <td><span class="home-state-pill ${stateClass}">${closed ? 'Cerrada' : 'Activa'}</span></td>
        <td>${esc(creationDateLabel(a))}</td>
        <td>${esc(a?.encargado || a?.detalle?.encargado || 'Sin encargado')}</td>
        <td><button class="home-row-action" onclick="homeOpenAgencyFromHome('${esc(a?.numero || a?.id || '')}')"><i class="fas fa-eye"></i> Abrir</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="7">No hay agencias registradas con este tipo.</td></tr>';
    panel.classList.remove('hidden');
    try{ panel.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
  };
  const oldHomeRender = window.homeRenderDashboard;
  window.homeRenderDashboard = function(){
    if(typeof oldHomeRender === 'function') oldHomeRender.apply(this, arguments);
    renderTypeFilters();
  };
  function boot(){
    renderTypeFilters();
    try{ if(typeof window.homeRenderDashboard === 'function') window.homeRenderDashboard(); }catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', function(){ setTimeout(boot, 250); setTimeout(boot, 1000); });
})();

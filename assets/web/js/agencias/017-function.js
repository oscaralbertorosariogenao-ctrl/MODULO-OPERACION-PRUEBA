
(function(){
  const HOME_CURRENT_YEAR = new Date().getFullYear();
  function homePadAgency(num){ return String(num || '').padStart(4,'0'); }
  function homeAgencyStatus(agencia){
    try{ if(typeof getAgencyEstadoOperativo === 'function') return getAgencyEstadoOperativo(agencia); }catch(e){}
    return agencia?.estadoOperativo || agencia?.detalle?.estadoOperativo || 'ACTIVA';
  }
  function homeIsClosed(agencia){
    const estado = String(homeAgencyStatus(agencia) || '').toUpperCase();
    return estado.includes('CERRADA') || estado.includes('DESACTIVADA') || estado === 'CERRADA';
  }
  function homeCreationDate(agencia){
    const raw = agencia?.fechaCreacion || agencia?.fecha_creacion || agencia?.createdAt || agencia?.fecha || agencia?.created_at;
    const parsed = raw ? new Date(raw) : null;
    if(parsed && !Number.isNaN(parsed.getTime())) return parsed;
    return null;
  }
  function homeCreationDateLabel(agencia){
    const d = homeCreationDate(agencia);
    if(!d) return 'Sin fecha';
    return d.toLocaleDateString('es-DO', { day:'2-digit', month:'2-digit', year:'numeric' });
  }
  function homeSafe(text){
    try{ if(typeof escapeHtml === 'function') return escapeHtml(text); }catch(e){}
    return String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }
  function homeGroupName(agencia){
    try{ if(typeof getAgencyRealGroup === 'function') return getAgencyRealGroup(agencia); }catch(e){}
    return agencia?.grupoReal || agencia?.detalle?.grupoReal || agencia?.grupo || 'Grupo 00';
  }
  function homeAgencyLabel(agencia){
    try{ if(typeof formatAgencyOptionLabel === 'function') return formatAgencyOptionLabel(agencia); }catch(e){}
    return agencia?.nombre || `Agencia ${homePadAgency(agencia?.numero)}`;
  }
  function homeAgencyRows(type){
    const list = Array.isArray(window.agencias) ? window.agencias : (typeof agencias !== 'undefined' ? agencias : []);
    if(type === 'activas') return list.filter(a => !homeIsClosed(a));
    if(type === 'cerradas') return list.filter(homeIsClosed);
    if(type === 'anio') return list.filter(a => { const d = homeCreationDate(a); return d && d.getFullYear() === HOME_CURRENT_YEAR; });
    return list.slice();
  }
  window.homeRenderDashboard = function(){
    const list = Array.isArray(window.agencias) ? window.agencias : (typeof agencias !== 'undefined' ? agencias : []);
    const groupList = Array.isArray(window.grupos) ? window.grupos : (typeof grupos !== 'undefined' ? grupos : []);
    const canonical = window.LotekaCatalog && typeof window.LotekaCatalog.stats === 'function'
      ? window.LotekaCatalog.stats(list, groupList)
      : null;
    const active = canonical ? canonical.activeAgencyRows : list.filter(a => !homeIsClosed(a));
    const closed = list.filter(a => canonical ? !window.LotekaCatalog.isAgencyActive(a) : homeIsClosed(a));
    const currentYear = list.filter(a => { const d = homeCreationDate(a); return d && d.getFullYear() === HOME_CURRENT_YEAR; });
    const groupsActive = canonical ? canonical.operationalGroups : groupList.filter(g => !String(g.nombre || '').toUpperCase().includes('CERRADAS')).length;

    const setText = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value; };
    setText('homeAgenciasActivas', active.length);
    setText('homeAgenciasAnio', currentYear.length);
    setText('homeAgenciasAnioLabel', `nuevas en ${HOME_CURRENT_YEAR}`);
    setText('homeAgenciasTotal', list.length);
    setText('homeAgenciasCerradas', closed.length);
    setText('homeGruposActivos', groupsActive);
    setText('homeMapPreviewCount', `${active.length} agencias activas`);

    const latestTbody = document.getElementById('homeUltimasAgencias');
    if(latestTbody){
      const latest = list.slice().sort((a,b) => {
        const da = homeCreationDate(a)?.getTime() || 0;
        const db = homeCreationDate(b)?.getTime() || 0;
        return db - da || Number(b.numero || 0) - Number(a.numero || 0);
      }).slice(0,6);
      latestTbody.innerHTML = latest.length ? latest.map(a => {
        const closed = homeIsClosed(a);
        return `<tr>
          <td><strong>${homeSafe(homeAgencyLabel(a))}</strong></td>
          <td>${homeSafe(homeGroupName(a))}</td>
          <td><span class="home-state-pill ${closed ? 'closed' : 'active'}">${closed ? 'Cerrada' : 'Activa'}</span></td>
          <td>${homeSafe(homeCreationDateLabel(a))}</td>
          <td><button class="home-row-action" onclick="homeOpenAgencyFromHome('${homeSafe(a.numero)}')"><i class="fas fa-eye"></i> Ver</button></td>
        </tr>`;
      }).join('') : `<tr><td colspan="5">No hay agencias registradas.</td></tr>`;
    }

    const groupBox = document.getElementById('homeResumenGrupos');
    if(groupBox){
      const groupNames = [...new Set(list.map(homeGroupName).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), 'es', {numeric:true}));
      groupBox.innerHTML = groupNames.slice(0,8).map(name => {
        const items = list.filter(a => homeGroupName(a) === name);
        const c = items.filter(homeIsClosed).length;
        const a = items.length - c;
        return `<button type="button" class="home-group-row" onclick="homeOpenGroupPanel('${homeSafe(name)}')">
          <span><strong>${homeSafe(name)}</strong><br>${a} activas · ${c} cerradas</span><b>${items.length}</b>
        </button>`;
      }).join('') || '<div class="home-group-row"><span>Sin grupos registrados</span><b>0</b></div>';
    }
  };

  window.homeToggleAgencyMap = function(show){
    const panel = document.getElementById('homeAgencyMapPanel');
    if(!panel) return;
    panel.classList.toggle('hidden', !show);
    if(show){
      setTimeout(() => {
        try{ if(typeof agencyMapRefresh === 'function') agencyMapRefresh(agencias); }catch(e){ console.warn(e); }
        try{ panel.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
      }, 120);
    }
  };

  window.homeCloseAgencyPanel = function(){
    const panel = document.getElementById('homeAgencyPanel');
    if(panel) panel.classList.add('hidden');
  };

  window.homeOpenAgencyPanel = function(type){
    const panel = document.getElementById('homeAgencyPanel');
    const title = document.getElementById('homeAgencyPanelTitle');
    const sub = document.getElementById('homeAgencyPanelSub');
    const head = document.getElementById('homeAgencyPanelHead');
    const body = document.getElementById('homeAgencyPanelBody');
    if(!panel || !head || !body) return;
    const labels = {
      activas:['Agencias activas','Agencias operativas actualmente.'],
      cerradas:['Agencias cerradas','Agencias preservadas en histórico, pero fuera de operación.'],
      anio:[`Agencias creadas en ${HOME_CURRENT_YEAR}`,'Registros con fecha de creación del año actual.'],
      total:['Total de agencias registradas','Incluye agencias activas y cerradas.'],
      grupos:['Grupos activos','Resumen operativo por grupo.']
    };
    if(title) title.textContent = labels[type]?.[0] || 'Consulta de agencias';
    if(sub) sub.textContent = labels[type]?.[1] || 'Detalle filtrado del sistema.';
    if(type === 'grupos'){
      const list = Array.isArray(window.agencias) ? window.agencias : (typeof agencias !== 'undefined' ? agencias : []);
      const groupNames = [...new Set(list.map(homeGroupName).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b),'es',{numeric:true}));
      head.innerHTML = '<tr><th>Grupo</th><th>Activas</th><th>Cerradas</th><th>Total</th><th>Acción</th></tr>';
      body.innerHTML = groupNames.map(g => {
        const rows = list.filter(a => homeGroupName(a) === g);
        const closed = rows.filter(homeIsClosed).length;
        const active = rows.length - closed;
        return `<tr><td><strong>${homeSafe(g)}</strong></td><td>${active}</td><td>${closed}</td><td>${rows.length}</td><td><button class="home-row-action" onclick="homeOpenGroupPanel('${homeSafe(g)}')">Consultar</button></td></tr>`;
      }).join('') || '<tr><td colspan="5">No hay grupos para mostrar.</td></tr>';
    } else {
      const rows = homeAgencyRows(type);
      head.innerHTML = '<tr><th>Agencia</th><th>Grupo</th><th>Estado</th><th>Creación</th><th>Encargado</th><th>Acción</th></tr>';
      body.innerHTML = rows.slice(0,150).map(a => {
        const closed = homeIsClosed(a);
        return `<tr><td><strong>${homeSafe(homeAgencyLabel(a))}</strong></td><td>${homeSafe(homeGroupName(a))}</td><td><span class="home-state-pill ${closed ? 'closed' : 'active'}">${closed ? 'Cerrada' : 'Activa'}</span></td><td>${homeSafe(homeCreationDateLabel(a))}</td><td>${homeSafe(a.encargado || 'Sin encargado')}</td><td><button class="home-row-action" onclick="homeOpenAgencyFromHome('${homeSafe(a.numero)}')">Abrir</button></td></tr>`;
      }).join('') || '<tr><td colspan="6">No hay agencias para este filtro.</td></tr>';
    }
    panel.classList.remove('hidden');
    try{ panel.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
  };

  window.homeOpenGroupPanel = function(groupName){
    homeOpenAgencyPanel('total');
    const title = document.getElementById('homeAgencyPanelTitle');
    const sub = document.getElementById('homeAgencyPanelSub');
    const head = document.getElementById('homeAgencyPanelHead');
    const body = document.getElementById('homeAgencyPanelBody');
    const list = (Array.isArray(window.agencias) ? window.agencias : (typeof agencias !== 'undefined' ? agencias : [])).filter(a => homeGroupName(a) === groupName);
    if(title) title.textContent = `Agencias de ${groupName}`;
    if(sub) sub.textContent = 'Detalle operativo del grupo seleccionado.';
    if(head) head.innerHTML = '<tr><th>Agencia</th><th>Estado</th><th>Creación</th><th>Encargado</th><th>Ubicación</th><th>Acción</th></tr>';
    if(body) body.innerHTML = list.map(a => {
      const closed = homeIsClosed(a);
      return `<tr><td><strong>${homeSafe(homeAgencyLabel(a))}</strong></td><td><span class="home-state-pill ${closed ? 'closed' : 'active'}">${closed ? 'Cerrada' : 'Activa'}</span></td><td>${homeSafe(homeCreationDateLabel(a))}</td><td>${homeSafe(a.encargado || 'Sin encargado')}</td><td>${homeSafe(a.direccion || '-')}</td><td><button class="home-row-action" onclick="homeOpenAgencyFromHome('${homeSafe(a.numero)}')">Abrir</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">No hay agencias en este grupo.</td></tr>';
  };

  window.homeOpenAgencyFromHome = function(numero){
    try{
      cambiarVista('agencias', document.querySelector('[onclick*=\'agencias\']'));
      setTimeout(() => {
        const input = document.getElementById('agencySearchInput');
        if(input){ input.value = String(numero || ''); if(typeof renderAgencias === 'function') renderAgencias(); }
      }, 80);
    }catch(e){ console.warn(e); }
  };

  const originalCambiarVista = window.cambiarVista;
  if(typeof originalCambiarVista === 'function' && !window.__homeDashboardCambiarVistaWrapped){
    window.__homeDashboardCambiarVistaWrapped = true;
    window.cambiarVista = function(vista, el){
      originalCambiarVista.call(this, vista, el);
      if(vista === 'home'){
        setTimeout(() => {
          try{ homeRenderDashboard(); }catch(e){ console.warn('homeRenderDashboard', e); }
          const panel = document.getElementById('homeAgencyMapPanel');
          if(panel && !panel.classList.contains('hidden')){
            try{ if(typeof agencyMapRefresh === 'function') agencyMapRefresh(agencias); }catch(e){}
          }
        }, 60);
      }
    };
  }

  const originalGuardarAgencia = window.guardarAgencia;
  if(typeof originalGuardarAgencia === 'function' && !window.__homeDashboardGuardarAgenciaWrapped){
    window.__homeDashboardGuardarAgenciaWrapped = true;
    window.guardarAgencia = function(){
      const before = Array.isArray(window.agencias) ? window.agencias.length : (typeof agencias !== 'undefined' ? agencias.length : 0);
      originalGuardarAgencia.apply(this, arguments);
      try{
        const list = Array.isArray(window.agencias) ? window.agencias : (typeof agencias !== 'undefined' ? agencias : []);
        if(list.length > before){
          const last = list[list.length - 1];
          if(last && !last.fechaCreacion && !last.fecha_creacion && !last.createdAt){
            last.fechaCreacion = new Date().toISOString();
            last.createdAt = last.fechaCreacion;
          }
        }
        homeRenderDashboard();
        if(typeof lotekaSoftRefresh === 'function') lotekaSoftRefresh('agencias');
      }catch(e){ console.warn(e); }
    };
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(() => { try{ homeRenderDashboard(); }catch(e){} }, 120));
  setTimeout(() => { try{ homeRenderDashboard(); }catch(e){} }, 300);
})();


(function(){
  'use strict';
  const SUPABASE_URL = 'https://tnymrjxdhzdmpcbilftj.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueW1yanhkaHpkbXBjYmlsZnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjEwOTksImV4cCI6MjA5MzgzNzA5OX0.YXG9juChbJUUdsdy01Qkoh9X0-MijewD5aQbKnG9Itk';

  const state = {
    client: null,
    session: null,
    user: null,
    perfil: null,
    permissions: new Set(),
    permissionsLoaded: false
  };

  function goRuntime(){ return window.GOApp && window.GOApp.__phase2aRuntime ? window.GOApp : null; }
  function goFetch(key, loader, options){
    const runtime = goRuntime();
    return runtime ? runtime.data.fetch(key, loader, options || {}) : Promise.resolve().then(loader);
  }
  function goInvalidate(prefix){
    const runtime = goRuntime();
    if(runtime) runtime.data.invalidate(prefix || '');
  }
  function syncGoAuthState(){
    const runtime = goRuntime();
    if(!runtime) return;
    runtime.supabase.setClient(state.client);
    runtime.state.patch({
      session: state.session,
      user: state.user,
      perfil: state.perfil,
      permissions: Array.from(state.permissions || [])
    });
  }

  function qs(selector){ return document.querySelector(selector); }
  function setText(selector, value){ const el = qs(selector); if(el) el.textContent = value || ''; }
  function showError(message){
    const box = qs('#ltkAuthError');
    if(!box) return;
    box.textContent = message || 'No se pudo iniciar sesión.';
    box.classList.add('is-visible');
  }
  function clearError(){
    const box = qs('#ltkAuthError');
    if(!box) return;
    box.textContent = '';
    box.classList.remove('is-visible');
  }
  function setLocked(locked){
    document.documentElement.classList.remove('ltk-auth-preboot');
    document.body.classList.remove('ltk-auth-booting');
    document.body.classList.toggle('ltk-auth-locked', !!locked);
    const screen = qs('#ltkAuthScreen');
    if(screen) screen.setAttribute('aria-hidden', locked ? 'false' : 'true');
  }
  function normalizeRoleName(perfil){
    return perfil && perfil.puestos && perfil.puestos.nombre ? perfil.puestos.nombre : 'Usuario del sistema';
  }
  function normalizeSystemRole(perfil){
    return perfil && perfil.roles && perfil.roles.nombre ? perfil.roles.nombre : 'Sin rol';
  }
  function normalizeUserName(perfil, user){
    return (perfil && perfil.nombre_completo) || (user && user.email) || 'Usuario';
  }
  function renderTopbarUser(){
    const userName = normalizeUserName(state.perfil, state.user);
    const puesto = normalizeRoleName(state.perfil);
    setText('.loteka-topbar-user-name', userName);
    const roleEl = qs('.loteka-topbar-user-role');
    if(roleEl) roleEl.innerHTML = '<i class="fas fa-briefcase"></i> ' + puesto;
    const box = qs('.loteka-topbar-user');
    if(box) box.title = userName + ' · ' + puesto + ' · Rol: ' + normalizeSystemRole(state.perfil);
  }
  function buildLogin(){
    if(qs('#ltkAuthScreen')) return;
    const wrap = document.createElement('div');
    wrap.id = 'ltkAuthScreen';
    wrap.className = 'ltk-auth-screen';
    wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML = `
      <main class="ltk-auth-shell" role="dialog" aria-modal="true" aria-label="Inicio de sesión Grupo Ortiz">
        <section class="ltk-auth-visual" aria-hidden="true">
          <div class="ltk-auth-kicker"><i class="fas fa-shield-halved"></i> Acceso interno Grupo Ortiz</div>
          <div class="ltk-auth-copy">
            <h1>Sistema de Gestión Interna y Externa</h1>
            <p>Plataforma interna para controlar agencias, inventario, taller, reportes y recursos humanos bajo la gestión de Grupo Ortiz.</p>
          </div>
          <div class="ltk-auth-metrics">
            <div class="ltk-auth-metric"><strong>GO</strong><span>Grupo Ortiz</span></div>
            <div class="ltk-auth-metric"><strong>24/7</strong><span>Control disponible</span></div>
            <div class="ltk-auth-metric"><strong>360°</strong><span>Visión operacional</span></div>
          </div>
        </section>
        <section class="ltk-auth-panel">
          <div class="ltk-auth-card">
            <div class="ltk-auth-logo go-auth-brand-mark" aria-label="Grupo Ortiz"><span>GO</span><small>Grupo Ortiz</small></div>
            <div class="ltk-auth-head">
              <h2>INICIAR SESIÓN</h2>
              <p>Accede con tu usuario autorizado para continuar al sistema empresarial.</p>
            </div>
            <form id="ltkAuthForm" class="ltk-auth-form">
              <div class="ltk-auth-field">
                <label for="ltkAuthEmail">Correo electrónico</label>
                <div class="ltk-auth-input-wrap">
                  <input id="ltkAuthEmail" type="email" autocomplete="username" placeholder="correo@grupoortiz.com.do" required>
                  <i class="fas fa-envelope"></i>
                </div>
              </div>
              <div class="ltk-auth-field">
                <label for="ltkAuthPassword">Contraseña</label>
                <div class="ltk-auth-input-wrap">
                  <input id="ltkAuthPassword" type="password" autocomplete="current-password" placeholder="Escribe tu contraseña" required>
                  <button class="ltk-auth-password-toggle" type="button" aria-label="Mostrar contraseña"><i class="fas fa-eye"></i></button>
                </div>
              </div>
              <div id="ltkAuthError" class="ltk-auth-error"></div>
              <button id="ltkAuthSubmit" class="ltk-auth-submit" type="submit">Entrar al sistema</button>
            </form>
            <div class="ltk-auth-secure-row"><i class="fas fa-lock"></i> Acceso seguro</div>
            <div class="ltk-auth-foot">Grupo Ortiz · Plataforma interna</div>
          </div>
        </section>
      </main>`;
    document.body.appendChild(wrap);
    const form = qs('#ltkAuthForm');
    if(form) form.addEventListener('submit', handleLogin);
    const toggle = qs('.ltk-auth-password-toggle');
    const pass = qs('#ltkAuthPassword');
    if(toggle && pass) toggle.addEventListener('click', function(){
      const isHidden = pass.type === 'password';
      pass.type = isHidden ? 'text' : 'password';
      toggle.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
      toggle.innerHTML = isHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
      pass.focus();
    });
  }
  async function loadPerfil(user, force){
    if(!user || !state.client) return null;
    return goFetch('auth:perfil:' + user.id, async function(){
      const { data, error } = await state.client
        .from('perfiles')
        .select('id,nombre_completo,correo,telefono,departamento,activo,rol_id,puesto_id,roles(nombre),puestos(nombre)')
        .eq('id', user.id)
        .maybeSingle();
      if(error){ throw error; }
      if(!data || data.activo === false){ throw new Error('Tu perfil no está activo o no fue encontrado.'); }
      return data;
    }, { ttl: 120000, force: !!force });
  }
  async function loadPermissions(force){
    state.permissions = new Set();
    state.permissionsLoaded = false;
    if(!state.client || !state.perfil || !state.perfil.rol_id) return state.permissions;
    const codes = await goFetch('auth:permisos:' + state.perfil.rol_id, async function(){
      const { data, error } = await state.client
        .from('roles_permisos')
        .select('permisos(codigo)')
        .eq('rol_id', state.perfil.rol_id);
      if(error) throw error;
      return (data || []).map(function(row){
        return row && row.permisos && row.permisos.codigo;
      }).filter(Boolean);
    }, { ttl: 120000, force: !!force });
    (codes || []).forEach(function(codigo){ state.permissions.add(codigo); });
    if(normalizeSystemRole(state.perfil) === 'Administrador') state.permissions.add('*');
    state.permissionsLoaded = true;
    syncGoAuthState();
    return state.permissions;
  }
  function hasPermission(permission){
    if(!permission) return true;
    if(state.permissions && state.permissions.has('*')) return true;
    if(Array.isArray(permission)) return permission.some(hasPermission);
    return !!(state.permissions && state.permissions.has(permission));
  }
  function requiredPermissionForView(view){
    const map = {
      'home':'ver_home',
      'agencias':'ver_agencias',
      'grupos':'ver_grupos',
      'productos':'ver_modulo_inventario',
      'almacenes':'ver_modulo_inventario',
      'entrada':'ver_modulo_inventario',
      'transferencia':'ver_modulo_inventario',
      'control-despachos':'ver_modulo_inventario',
      'taller-v2':'ver_taller',
      'dashboard-rrhh':'ver_rrhh',
      'solicitudes':'gestionar_solicitudes',
      'operadoras':'gestionar_empleadas',
      'historial-rrhh':'ver_historial_rrhh'
    };
    return map[view] || null;
  }
  function requiredPermissionForOpsView(view){
    const map = {
      'dashboard':'ver_operaciones',
      'operations':'ver_operaciones',
      'levantamientos':'ver_operaciones',
      'history':'ver_operaciones',
      'reports':'ver_reportes',
      'reportsAgency':'ver_reportes',
      'reportsOwner':'ver_reportes',
      'reportsSpecific':'ver_reportes',
      'users':'ver_catalogos',
      'suppliers':'ver_catalogos',
      'works':'gestionar_catalogos',
      'issues':'gestionar_catalogos'
    };
    return map[view] || null;
  }
  function showAccessDenied(message){
    let toast = qs('#ltkAccessDeniedToast');
    if(!toast){
      toast = document.createElement('div');
      toast.id = 'ltkAccessDeniedToast';
      toast.className = 'ltk-access-denied-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message || 'No tienes permisos para abrir esta sección.';
    toast.classList.add('is-visible');
    clearTimeout(showAccessDenied._t);
    showAccessDenied._t = setTimeout(function(){ toast.classList.remove('is-visible'); }, 3200);
  }
  function setVisibleByPermission(selector, permission){
    document.querySelectorAll(selector).forEach(function(el){
      const allowed = hasPermission(permission);
      el.classList.toggle('ltk-permission-hidden', !allowed);
      el.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    });
  }
  function setVisibleByOnclickNeedle(needle, permission){
    document.querySelectorAll('[onclick]').forEach(function(el){
      const action = el.getAttribute('onclick') || '';
      if(action.indexOf(needle) === -1) return;
      const allowed = hasPermission(permission);
      el.classList.toggle('ltk-permission-hidden', !allowed);
      el.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    });
  }
  function applyPermissionsToUI(){
    window.lotekaHasPermission = hasPermission;
    document.body.classList.toggle('ltk-can-edit-agency-tech', hasPermission('editar_ficha_tecnica_agencia'));
    setVisibleByPermission('#navHome','ver_home');
    setVisibleByPermission('.sidebar-group[data-section="consultas"]',['ver_agencias','ver_grupos']);
    setVisibleByPermission('.sidebar-group[data-section="inventario"]','ver_modulo_inventario');
    setVisibleByPermission('.sidebar-group[data-section="operaciones"]','ver_operaciones');
    setVisibleByPermission('.sidebar-group[data-section="rrhh"]','ver_rrhh');
    setVisibleByPermission('.sidebar-group[data-section="reportes"]','ver_reportes');
    setVisibleByPermission('.sidebar-group[data-section="catalogos"]','ver_catalogos');
    setVisibleByOnclickNeedle("cambiarVista('home'", 'ver_home');
    setVisibleByOnclickNeedle("cambiarVista('agencias'", 'ver_agencias');
    setVisibleByOnclickNeedle("cambiarVista('grupos'", 'ver_grupos');
    setVisibleByOnclickNeedle("cambiarVista('productos'", 'ver_modulo_inventario');
    setVisibleByOnclickNeedle("cambiarVista('almacenes'", 'ver_modulo_inventario');
    setVisibleByOnclickNeedle("cambiarVista('entrada'", 'ver_modulo_inventario');
    setVisibleByOnclickNeedle("cambiarVista('transferencia'", 'ver_modulo_inventario');
    setVisibleByOnclickNeedle("cambiarVista('control-despachos'", 'ver_modulo_inventario');
    setVisibleByPermission('.sidebar-group[data-section="taller-v2"]','ver_taller');
    setVisibleByOnclickNeedle("cambiarVista('dashboard-rrhh'", 'ver_rrhh');
    setVisibleByOnclickNeedle("cambiarVista('solicitudes'", 'gestionar_solicitudes');
    setVisibleByOnclickNeedle("cambiarVista('operadoras'", 'gestionar_empleadas');
    setVisibleByOnclickNeedle("cambiarVista('historial-rrhh'", 'ver_historial_rrhh');
  }
  function installPermissionGuards(){
    if(window.__lotekaPermissionGuardsInstalled) return;
    window.__lotekaPermissionGuardsInstalled = true;
    const originalCambiarVista = window.cambiarVista;
    if(typeof originalCambiarVista === 'function'){
      window.cambiarVista = function(view, el){
        const permission = requiredPermissionForView(view);
        if(!hasPermission(permission)){
          showAccessDenied('No tienes permiso para abrir esta vista.');
          return false;
        }
        return originalCambiarVista.apply(this, arguments);
      };
    }
    const originalAbrirVistaOperaciones = window.abrirVistaOperaciones;
    if(typeof originalAbrirVistaOperaciones === 'function'){
      window.abrirVistaOperaciones = function(view){
        const permission = requiredPermissionForOpsView(view);
        if(!hasPermission(permission)){
          showAccessDenied('No tienes permiso para abrir este módulo.');
          return false;
        }
        return originalAbrirVistaOperaciones.apply(this, arguments);
      };
    }
  }
  async function audit(modulo, accion, entidad, entidadId, descripcion, antes, despues){
    try{
      if(!state.client || !state.user) return;
      await state.client.from('auditoria').insert({
        usuario_id: state.user.id,
        usuario_nombre: normalizeUserName(state.perfil, state.user),
        modulo: modulo || 'Sistema',
        accion: accion || 'ACCION',
        entidad: entidad || null,
        entidad_id: entidadId == null ? null : String(entidadId),
        descripcion: descripcion || null,
        antes: antes || null,
        despues: despues || null
      });
    }catch(err){ console.warn('Auditoría no registrada:', err && err.message ? err.message : err); }
  }

  function supabaseAgencyPad(numero){
    const raw = String(numero == null ? '' : numero).trim();
    const digits = raw.replace(/\D/g,'');
    if(!digits) return raw;
    return digits.padStart(4,'0');
  }
  function supabaseGroupCode(codigo){
    const raw = String(codigo == null ? '' : codigo).trim();
    if(!raw) return '';
    if(raw.toUpperCase().includes('CERRADA') || raw.toUpperCase().includes('DESACT')) return '00';
    const digits = raw.replace(/\D/g,'');
    return digits ? digits.padStart(2,'0') : raw;
  }
  function supabaseGroupName(grupo){
    const rawName = String(grupo && grupo.nombre ? grupo.nombre : '').trim();
    if(rawName){
      if(rawName.toUpperCase().includes('CERRADA') || rawName.toUpperCase().includes('DESACT')) return 'DESACTIVADAS/CERRADAS';
      if(/^Grupo\s+/i.test(rawName)) return rawName.replace(/Grupo\s+(\d+)$/i, function(_, n){ return 'Grupo ' + String(n).padStart(2,'0'); });
      if(/^G-?\d+/i.test(rawName)) return 'Grupo ' + supabaseGroupCode(rawName);
      return rawName;
    }
    const code = supabaseGroupCode(grupo && grupo.codigo);
    if(code === '00') return 'DESACTIVADAS/CERRADAS';
    return code ? 'Grupo ' + code : 'Sin grupo';
  }
  function supabaseLocalAgencyType(tipo){
    const raw = String(tipo || '').trim();
    const clean = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(clean.includes('centro')) return 'Centro de Pago';
    if(clean.includes('punto')) return 'Punto de Pago';
    if(clean.includes('super')) return 'Agencia en Supermercado';
    if(clean.includes('socio')) return 'Socio';
    if(clean.includes('pasante')) return 'Pasante';
    return 'Agencia';
  }
  function supabaseLocalAgencyStatus(estado){
    const raw = String(estado || '').trim();
    const clean = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(clean.includes('proceso')) return 'EN PROCESO';
    if(clean.includes('remodel')) return 'REMODELACIÓN';
    if(clean.includes('cerr') || clean.includes('desact') || clean.includes('inact')) return 'DESACTIVADA/CERRADA';
    return 'ACTIVA';
  }
  function supabaseNumberOrNull(value){
    if(value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  // V805.28: reglas canónicas compartidas para que todas las vistas usen la misma verdad.
  function lotekaCatalogText(value){
    return String(value == null ? '' : value).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  function lotekaCatalogAgencyActive(agency){
    if(!agency) return false;
    if(agency.activo === false) return false;
    const status = lotekaCatalogText(agency.estadoOperativo || agency.estado_operativo || agency.estado || (agency.detalle && agency.detalle.estadoOperativo));
    return !/(CERR|DESACT|INACT)/.test(status);
  }
  function lotekaCatalogGroupOperational(group){
    if(!group) return false;
    const code = supabaseGroupCode(group.codigo || group.numero || group.nombre);
    const name = lotekaCatalogText(group.nombre || group.codigo);
    return code !== '00' && !/(CERR|DESACT|INACT)/.test(name);
  }
  function lotekaCatalogStats(agencyList, groupList){
    const allAgencies = Array.isArray(agencyList) ? agencyList : [];
    const allGroups = Array.isArray(groupList) ? groupList : [];
    const activeAgencies = allAgencies.filter(lotekaCatalogAgencyActive);
    const activeGroupKeys = new Set(activeAgencies.map(function(a){
      return String(a.grupoId || a.grupo_id || a.grupo || '').trim();
    }).filter(Boolean));
    const operationalGroups = allGroups.filter(function(g){
      if(!lotekaCatalogGroupOperational(g)) return false;
      const keys = [g.supabaseId, g.id, g.nombre, g.codigo, g.numero].map(function(v){ return String(v || '').trim(); }).filter(Boolean);
      return keys.some(function(k){ return activeGroupKeys.has(k); }) || (Array.isArray(g.agencias) && g.agencias.length > 0);
    });
    return {
      totalAgencies: allAgencies.length,
      activeAgencies: activeAgencies.length,
      closedAgencies: allAgencies.length - activeAgencies.length,
      operationalGroups: operationalGroups.length,
      activeAgencyRows: activeAgencies,
      operationalGroupRows: operationalGroups
    };
  }
  window.LotekaCatalog = Object.assign(window.LotekaCatalog || {}, {
    isAgencyActive: lotekaCatalogAgencyActive,
    isGroupOperational: lotekaCatalogGroupOperational,
    stats: lotekaCatalogStats
  });
  function supabaseRebuildUIAfterAgencias(){
    // V805.27: pintar primero solo lo visible y posponer trabajos pesados.
    const immediate = [
      'syncClosedAgenciesGroup',
      'actualizarDashboardHome',
      'homeUpdateAgencyDashboard',
      'homeRenderDashboard'
    ];
    immediate.forEach(function(fn){
      try{ if(typeof window[fn] === 'function') window[fn](); }
      catch(err){ console.warn('Refresh inmediato post Supabase:', fn, err && err.message ? err.message : err); }
    });

    const deferred = function(){
      const calls = [
        'lotekaPopulateAgencyAdminFilters',
        'renderAgencias',
        'renderGrupos',
        'homeRenderAgencyPanel',
        'llenarSelectsTransferencia',
        'populateOperationAgencyOptions',
        'populateEditOperationAgencyOptions'
      ];
      calls.forEach(function(fn){
        try{ if(typeof window[fn] === 'function') window[fn](); }
        catch(err){ console.warn('Refresh diferido post Supabase:', fn, err && err.message ? err.message : err); }
      });
      try{
        const mapPanel = document.getElementById('homeAgencyMapPanel');
        const mapVisible = mapPanel && !mapPanel.classList.contains('hidden') && mapPanel.offsetParent !== null;
        if(mapVisible && typeof window.agencyMapRefresh === 'function'){
          window.agencyMapRefresh(typeof agencias !== 'undefined' ? agencias : window.agencias);
        }
      }catch(err){ console.warn('Refresh diferido del mapa:', err && err.message ? err.message : err); }
    };
    if(typeof window.requestIdleCallback === 'function') window.requestIdleCallback(deferred, { timeout: 1200 });
    else setTimeout(deferred, 80);
  }

  const AGENCIAS_CACHE_KEY = 'loteka.catalogo.agencias-grupos.v80527';
  const AGENCIAS_CACHE_TTL = 6 * 60 * 60 * 1000;
  function readPersistentAgenciasCache(){
    try{
      const parsed = JSON.parse(localStorage.getItem(AGENCIAS_CACHE_KEY) || 'null');
      if(!parsed || !Array.isArray(parsed.agencias) || !Array.isArray(parsed.grupos)) return null;
      if(!parsed.savedAt || (Date.now() - Number(parsed.savedAt)) > AGENCIAS_CACHE_TTL) return null;
      return parsed;
    }catch(_e){ return null; }
  }
  function writePersistentAgenciasCache(agencyRows, groupRows){
    try{
      localStorage.setItem(AGENCIAS_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        agencias: agencyRows,
        grupos: groupRows
      }));
    }catch(_e){}
  }
  function applyPersistentAgenciasCache(cached){
    if(!cached) return false;
    agencias = cached.agencias;
    grupos = cached.grupos;
    window.agencias = agencias;
    window.grupos = grupos;
    window.lotekaAgenciasSource = 'supabase-cache';
    window.lotekaGruposSource = 'supabase-cache';
    supabaseRebuildUIAfterAgencias();
    return true;
  }
  async function fetchSupabaseAllRows(tableName, selectColumns, options){
    options = options || {};
    const pageSize = options.pageSize || 1000;
    const orderColumn = options.orderColumn || 'id';
    const ascending = options.ascending !== false;
    let from = 0;
    let all = [];
    while(true){
      const to = from + pageSize - 1;
      const resp = await state.client
        .from(tableName)
        .select(selectColumns)
        .order(orderColumn, { ascending: ascending })
        .range(from, to);
      if(resp.error) throw resp.error;
      const chunk = Array.isArray(resp.data) ? resp.data : [];
      all = all.concat(chunk);
      if(chunk.length < pageSize) break;
      from += pageSize;
      if(from > 50000) break;
    }
    return all;
  }

  async function loadSupabaseAgenciasGrupos(force){
    if(!state.client) return false;

    // V805.27: usar el último catálogo real de Supabase inmediatamente.
    // La actualización remota ocurre en segundo plano y solo repinta si termina correctamente.
    if(!force){
      const cached = readPersistentAgenciasCache();
      if(cached && applyPersistentAgenciasCache(cached)){
        setTimeout(function(){
          loadSupabaseAgenciasGrupos(true).catch(function(err){
            console.warn('[LOTEKA] Actualización silenciosa de agencias:', err && err.message ? err.message : err);
          });
        }, 120);
        return true;
      }
    }
    try{
      const localAgencias = (typeof agencias !== 'undefined' && Array.isArray(agencias)) ? agencias : (Array.isArray(window.agencias) ? window.agencias : []);
      const localGrupos = (typeof grupos !== 'undefined' && Array.isArray(grupos)) ? grupos : (Array.isArray(window.grupos) ? window.grupos : []);
      const localByNumero = new Map(localAgencias.map(function(a){ return [Number(a && a.numero), a]; }));
      const localGroupByName = new Map(localGrupos.map(function(g){ return [String(g && g.nombre || '').trim(), g]; }));

      // Supabase/PostgREST normalmente devuelve máximo 1000 filas por solicitud.
      // Por eso aquí se pagina de 1000 en 1000 para traer TODAS las agencias.
      const rawCatalog = await goFetch('catalogo:agencias-grupos:raw', async function(){
        const rows = await Promise.all([
          fetchSupabaseAllRows('grupos', 'id,codigo,nombre,encargado,telefono,correo,color', { orderColumn: 'codigo', pageSize: 1000 }),
          fetchSupabaseAllRows('agencias', 'id,numero,nombre,grupo_id,tipo,estado,latitud,longitud,direccion,sector,municipio,provincia,telefono,correo,observaciones,fecha_creacion,activo,estado_operativo,grupos(id,codigo,nombre,encargado,telefono,correo,color)', { orderColumn: 'numero', pageSize: 1000 })
        ]);
        return { remoteGroups: rows[0] || [], remoteAgencies: rows[1] || [] };
      }, { ttl: 120000, force: !!force });
      const remoteGroups = rawCatalog.remoteGroups || [];
      const remoteAgencies = rawCatalog.remoteAgencies || [];

      console.log('[LOTEKA] Grupos cargados desde Supabase:', remoteGroups.length, 'Agencias cargadas:', remoteAgencies.length);

      if(!remoteGroups.length && !remoteAgencies.length) return false;

      const groupById = new Map();
      remoteGroups.forEach(function(g){ if(g && g.id) groupById.set(g.id, g); });

      const agenciesByGroupName = new Map();
      const remoteAgencyList = remoteAgencies.map(function(row){
        const numeroTexto = supabaseAgencyPad(row.numero);
        const numeroValor = Number(numeroTexto) || row.numero;
        const local = localByNumero.get(Number(numeroValor)) || {};
        const grupoRow = row.grupos || groupById.get(row.grupo_id) || null;
        const grupoNombre = supabaseGroupName(grupoRow || { codigo: row.grupo_codigo, nombre: row.grupo_nombre });
        const tipoLocal = supabaseLocalAgencyType(row.tipo || local.tipoAgencia || (local.detalle && local.detalle.tipoAgencia));
        const estadoLocal = supabaseLocalAgencyStatus(row.estado || local.estadoOperativo || (local.detalle && local.detalle.estadoOperativo));
        const lat = supabaseNumberOrNull(row.latitud);
        const lng = supabaseNumberOrNull(row.longitud);
        if(!agenciesByGroupName.has(grupoNombre)) agenciesByGroupName.set(grupoNombre, []);
        agenciesByGroupName.get(grupoNombre).push(Number(numeroValor));
        return {
          ...local,
          supabaseId: row.id,
          grupoId: row.grupo_id || (grupoRow && grupoRow.id) || null,
          numero: numeroValor,
          numeroTexto: numeroTexto,
          nombre: row.nombre || local.nombre || ('Agencia ' + numeroTexto),
          grupo: grupoNombre,
          encargado: (grupoRow && grupoRow.encargado) || local.encargado || '',
          direccion: row.direccion || local.direccion || ('Agencia ' + numeroTexto),
          sector: row.sector || local.sector || '',
          municipio: row.municipio || local.municipio || '',
          provincia: row.provincia || local.provincia || '',
          telefono: row.telefono || local.telefono || '',
          correo: row.correo || local.correo || '',
          observaciones: row.observaciones || local.observaciones || '',
          latitud: lat !== null ? lat : local.latitud,
          longitud: lng !== null ? lng : local.longitud,
          tipoAgencia: tipoLocal,
          tipo: tipoLocal,
          estadoOperativo: estadoLocal,
          estado: estadoLocal,
          activo: row.activo !== false && !/(CERR|DESACT|INACT)/.test(lotekaCatalogText(row.estado_operativo || row.estado)),
          estadoSupabase: row.estado || '',
          estadoOperativoSupabase: row.estado_operativo || '',
          fechaCreacion: row.fecha_creacion || local.fechaCreacion || local.fecha_creacion || '',
          detalle: {
            ...(local.detalle || {}),
            tipoAgencia: tipoLocal,
            estadoOperativo: estadoLocal,
            direccion: row.direccion || (local.detalle && local.detalle.direccion) || local.direccion || '',
            sector: row.sector || (local.detalle && local.detalle.sector) || local.sector || '',
            municipio: row.municipio || (local.detalle && local.detalle.municipio) || local.municipio || '',
            provincia: row.provincia || (local.detalle && local.detalle.provincia) || local.provincia || '',
            telefono: row.telefono || (local.detalle && local.detalle.telefono) || local.telefono || '',
            correo: row.correo || (local.detalle && local.detalle.correo) || local.correo || '',
            observaciones: row.observaciones || (local.detalle && local.detalle.observaciones) || local.observaciones || '',
            fechaCreacion: row.fecha_creacion || (local.detalle && local.detalle.fechaCreacion) || local.fechaCreacion || ''
          }
        };
      });

      const remoteGroupList = remoteGroups.map(function(row){
        const nombre = supabaseGroupName(row);
        const local = localGroupByName.get(nombre) || {};
        return {
          ...local,
          supabaseId: row.id,
          numero: supabaseGroupCode(row.codigo),
          codigo: supabaseGroupCode(row.codigo),
          nombre: nombre,
          color: row.color || local.color || '#0ea5c6',
          encargado: row.encargado || local.encargado || '',
          flota: row.telefono || local.flota || '',
          telefono: row.telefono || local.telefono || local.flota || '',
          extension: local.extension || '',
          correo: row.correo || local.correo || '',
          custodia: Array.isArray(local.custodia) ? local.custodia : [],
          agencias: (agenciesByGroupName.get(nombre) || []).slice().sort(function(a,b){ return Number(a)-Number(b); })
        };
      });

      remoteAgencyList.sort(function(a,b){ return Number(a.numero) - Number(b.numero); });
      remoteGroupList.sort(function(a,b){
        if(String(a.nombre) === 'DESACTIVADAS/CERRADAS') return 1;
        if(String(b.nombre) === 'DESACTIVADAS/CERRADAS') return -1;
        return String(a.numero || '').localeCompare(String(b.numero || ''), 'es', { numeric: true });
      });

      agencias = remoteAgencyList;
      grupos = remoteGroupList;
      window.agencias = agencias;
      window.grupos = grupos;
      window.lotekaAgenciasSource = 'supabase';
      window.lotekaGruposSource = 'supabase';
      window.lotekaCatalogSnapshot = lotekaCatalogStats(remoteAgencyList, remoteGroupList);
      writePersistentAgenciasCache(remoteAgencyList, remoteGroupList);
      supabaseRebuildUIAfterAgencias();
      return true;
    }catch(err){
      console.warn('No se pudieron cargar agencias/grupos desde Supabase. Se mantiene respaldo local:', err && err.message ? err.message : err);
      window.lotekaAgenciasSource = 'local-fallback';
      return false;
    }
  }
  window.lotekaReloadAgenciasGruposSupabase = function(){ return loadSupabaseAgenciasGrupos(true); };
  async function unlockWithSession(session){
    state.session = session;
    state.user = session && session.user ? session.user : null;
    if(!state.user){ setLocked(true); return; }
    state.perfil = await loadPerfil(state.user);
    await loadPermissions();
    await loadSupabaseAgenciasGrupos();
    syncGoAuthState();
    const runtime = goRuntime();
    if(runtime) runtime.events.emit('auth:ready', { user:state.user, perfil:state.perfil, permissions:Array.from(state.permissions || []) });
    renderTopbarUser();
    applyPermissionsToUI();
    installPermissionGuards();
    setLocked(false);
    setTimeout(function(){
      try{
        if(typeof window.lotekaRestoreActiveView === 'function') window.lotekaRestoreActiveView('auth');
        else if(typeof cambiarVista === 'function'){
          window.__lotekaAllowProgrammaticHome = true;
          cambiarVista('home', document.getElementById('navHome'));
          window.__lotekaAllowProgrammaticHome = false;
        }
      }catch(e){}
    }, 80);
  }
  async function handleLogin(event){
    event.preventDefault();
    clearError();
    const email = (qs('#ltkAuthEmail') && qs('#ltkAuthEmail').value || '').trim();
    const password = qs('#ltkAuthPassword') && qs('#ltkAuthPassword').value || '';
    const btn = qs('#ltkAuthSubmit');
    if(btn){ btn.disabled = true; btn.textContent = 'Verificando...'; }
    try{
      const { data, error } = await state.client.auth.signInWithPassword({ email, password });
      if(error) throw error;
      await unlockWithSession(data.session);
      await audit('Sistema', 'LOGIN', 'perfiles', state.user.id, 'Inicio de sesión correcto', null, { correo: state.user.email });
    }catch(err){
      setLocked(true);
      showError(err && err.message ? err.message : 'Correo o contraseña incorrectos.');
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = 'Entrar al sistema'; }
    }
  }
  async function handleLogout(){
    try{ await audit('Sistema', 'LOGOUT', 'perfiles', state.user && state.user.id, 'Cierre de sesión', null, null); }catch(e){}
    try{ await state.client.auth.signOut(); }catch(e){}
    state.session = null; state.user = null; state.perfil = null; state.permissions = new Set();
    goInvalidate('auth:');
    const runtime = goRuntime();
    if(runtime){ runtime.state.resetSession(); runtime.events.emit('auth:signed-out', {}); }
    setLocked(true);
    clearError();
  }
  async function bootAuth(){
    buildLogin();
    if(!window.supabase || !window.supabase.createClient){
      setLocked(true);
      showError('No se pudo cargar Supabase. Revisa la conexión a internet.');
      return;
    }
    state.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.lotekaSupabase = state.client;
    const runtime = goRuntime();
    if(runtime) runtime.supabase.setClient(state.client);
    window.lotekaAuthState = state;
    window.lotekaAudit = audit;
    window.lotekaHasPermission = hasPermission;
    window.lotekaApplyPermissionsToUI = applyPermissionsToUI;
    const logoutBtn = qs('#ltkTopbarLogout');
    if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    setLocked(true);
    try{
      const { data, error } = await state.client.auth.getSession();
      if(error) throw error;
      if(data && data.session){ await unlockWithSession(data.session); }
      else{ setLocked(true); }
    }catch(err){
      setLocked(true);
      showError(err && err.message ? err.message : 'No se pudo validar la sesión.');
    }
    state.client.auth.onAuthStateChange(function(event, session){
      if(event === 'SIGNED_OUT'){ setLocked(true); return; }
      if(session && event !== 'INITIAL_SESSION') unlockWithSession(session).catch(function(err){ setLocked(true); showError(err.message); });
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAuth); else bootAuth();
})();

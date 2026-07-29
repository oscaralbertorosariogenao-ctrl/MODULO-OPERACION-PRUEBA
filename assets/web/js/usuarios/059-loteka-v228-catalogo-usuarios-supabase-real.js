
(function(){
  'use strict';
  if(window.__lotekaUsersCatalogV228Installed) return;
  window.__lotekaUsersCatalogV228Installed = true;

  var state = { users: [], roles: [], puestos: [], loading: false, currentId: null };

  function qs(s, root){ return (root || document).querySelector(s); }
  function qsa(s, root){ return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function client(){ return window.lotekaSupabase || window.supabaseClient || null; }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toast(title, text, type){
    try{
      if(typeof window.showToastNotification === 'function') return window.showToastNotification(title || 'Usuarios', text || '', type || 'info');
      if(typeof window.notify === 'function') return window.notify((title ? title + ': ' : '') + (text || ''), type || 'info');
    }catch(e){}
    if(text) alert((title ? title + '\n' : '') + text);
  }
  function normalizePhoneRD(value){
    var raw = String(value || '').replace(/\D/g,'');
    if(raw.length === 10 && /^(809|829|849)/.test(raw)) raw = '1' + raw;
    if(raw.length === 11 && /^1(809|829|849)[0-9]{7}$/.test(raw)) return raw;
    return '';
  }
  function prettyPhone(value){
    var n = normalizePhoneRD(value) || String(value || '').replace(/\D/g,'');
    if(n.length === 11 && n[0] === '1') return n.slice(1,4) + '-' + n.slice(4,7) + '-' + n.slice(7);
    if(n.length === 10) return n.slice(0,3) + '-' + n.slice(3,6) + '-' + n.slice(6);
    return String(value || '');
  }
  function getRoleName(u){
    return String((u && u.roles && u.roles.nombre) || u.rol_nombre || u.rol || u.role || '').trim();
  }
  function getPuestoName(u){
    return String((u && u.puestos && u.puestos.nombre) || u.puesto_nombre || u.puesto || '').trim();
  }
  function isEncargadoName(name){ return /encargad/i.test(String(name || '')); }
  function isEncargadoUser(u){ return isEncargadoName(getRoleName(u)) || isEncargadoName(getPuestoName(u)) || isEncargadoName(u && u.departamento); }
  function slugify(value){
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,'').trim();
  }
  function currentSearch(){ return (qs('#userSearch') && qs('#userSearch').value || '').toLowerCase().trim(); }
  function userText(u){ return [u.nombre_completo,u.correo,u.email,u.usuario_login,getRoleName(u),getPuestoName(u),u.departamento,u.telefono,u.telefono_whatsapp,u.grupo_asignado,u.agencia_asignada].join(' ').toLowerCase(); }

  async function loadCatalogData(){
    var c = client();
    if(!c) throw new Error('Supabase no está disponible en esta página.');
    state.loading = true;
    renderTableMessage('Cargando usuarios reales...');

    var usersPromise = c.from('perfiles')
      .select('id,nombre_completo,correo,email,telefono,telefono_whatsapp,usuario_login,departamento,activo,rol_id,puesto_id,grupo_asignado,agencia_asignada,creado_desde_catalogo,fecha_actualizacion,roles(nombre),puestos(nombre)')
      .order('nombre_completo', {ascending:true})
      .limit(1000);
    var rolesPromise = c.from('roles').select('id,nombre').order('nombre', {ascending:true}).limit(100);
    var puestosPromise = c.from('puestos').select('id,nombre').order('nombre', {ascending:true}).limit(200);

    var results = await Promise.allSettled([usersPromise, rolesPromise, puestosPromise]);
    var usersRes = results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason };
    var rolesRes = results[1].status === 'fulfilled' ? results[1].value : { data: [], error: results[1].reason };
    var puestosRes = results[2].status === 'fulfilled' ? results[2].value : { data: [], error: results[2].reason };

    if(usersRes.error){
      // Fallback por si Supabase no permite relaciones en el select.
      var fallback = await c.from('perfiles')
        .select('*')
        .order('nombre_completo', {ascending:true})
        .limit(1000);
      if(fallback.error) throw fallback.error;
      state.users = fallback.data || [];
    }else{
      state.users = usersRes.data || [];
    }
    state.roles = rolesRes && !rolesRes.error ? (rolesRes.data || []) : [];
    state.puestos = puestosRes && !puestosRes.error ? (puestosRes.data || []) : [];
    state.loading = false;
    renderUsersCatalogSupabase();
    updateAssigneesFromProfiles();
    return state.users;
  }

  function renderTableMessage(msg){
    var tbody = qs('#usersCatalogTableBody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="8" style="padding:18px;text-align:center;color:var(--muted);font-weight:900">'+esc(msg)+'</td></tr>';
  }

  function ensureUsersUI(){
    var view = qs('#usersView'); if(!view) return;
    var title = qs('#usersView .catalog-topbar h2'); if(title) title.textContent = 'Administración de Usuarios';
    var p = qs('#usersView .catalog-topbar p'); if(p) p.textContent = 'Administra usuarios, teléfonos, roles, grupos y estado desde el sistema.';
    var btn = qs('#addUserBtn');
    if(btn){ btn.textContent = '+ Nuevo usuario'; btn.classList.add('btn-primary'); }
    var actions = qs('#usersView .catalog-actions');
    if(actions && !qs('#usersCatalogRefreshBtn')){
      var wrap = document.createElement('div');
      wrap.style.display = 'flex'; wrap.style.gap = '8px'; wrap.style.flexWrap = 'wrap';
      wrap.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" id="usersCatalogRefreshBtn"><i class="fas fa-rotate"></i> Actualizar</button>'+
        '<button type="button" class="btn btn-secondary btn-sm" id="usersCatalogOnlyMissingPhoneBtn">Encargados sin teléfono</button>';
      actions.insertBefore(wrap, actions.firstChild);
    }
    var input = qs('#userSearch'); if(input) input.placeholder = 'Buscar por nombre, correo, rol, teléfono, grupo o agencia';
    var thead = qs('#usersView table thead');
    if(thead){ thead.innerHTML = '<tr><th>#</th><th>Usuario</th><th>Rol / Puesto</th><th>Teléfono</th><th>Grupo asignado</th><th>Estado</th><th>Origen</th><th>Acciones</th></tr>'; }
    ensureModal();
    installCleanEvents();
  }

  function installCleanEvents(){
    var btn = qs('#addUserBtn');
    if(btn && !btn.dataset.v228Clean){
      var clone = btn.cloneNode(true); btn.parentNode.replaceChild(clone, btn); btn = clone;
      btn.dataset.v228Clean = '1';
      btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); openUserModal(null); });
    }
    var search = qs('#userSearch');
    if(search && !search.dataset.v228Clean){
      var sclone = search.cloneNode(true); search.parentNode.replaceChild(sclone, search); search = sclone;
      search.dataset.v228Clean = '1';
      search.addEventListener('input', function(){ renderUsersCatalogSupabase(); });
    }
    var refresh = qs('#usersCatalogRefreshBtn');
    if(refresh && !refresh.dataset.v228Clean){
      refresh.dataset.v228Clean='1';
      refresh.addEventListener('click', function(){ loadCatalogData().catch(handleError); });
    }
    var missing = qs('#usersCatalogOnlyMissingPhoneBtn');
    if(missing && !missing.dataset.v228Clean){
      missing.dataset.v228Clean='1';
      missing.addEventListener('click', function(){
        var input = qs('#userSearch');
        if(input){ input.value = input.value === 'faltatelefono' ? '' : 'faltatelefono'; renderUsersCatalogSupabase(); }
      });
    }
  }

  function renderUsersCatalogSupabase(){
    ensureUsersUI();
    var tbody = qs('#usersCatalogTableBody'); if(!tbody) return;
    var q = currentSearch();
    var list = (state.users || []).filter(function(u){
      if(q === 'faltatelefono') return isEncargadoUser(u) && !normalizePhoneRD(u.telefono_whatsapp || u.telefono);
      return !q || userText(u).indexOf(q) !== -1;
    });
    if(!list.length){ renderTableMessage('No hay usuarios que coincidan.'); return; }
    tbody.innerHTML = list.map(function(u, i){
      var id = String(u.id || '');
      var name = u.nombre_completo || u.nombre || u.correo || u.email || 'Usuario sin nombre';
      var email = u.correo || u.email || '';
      var role = getRoleName(u) || 'Sin rol';
      var puesto = getPuestoName(u) || u.departamento || '';
      var phoneClean = normalizePhoneRD(u.telefono_whatsapp || u.telefono);
      var phoneShown = phoneClean ? prettyPhone(phoneClean) : '<span class="ltk-user-warn">Falta teléfono</span>';
      var encargadoMissing = isEncargadoUser(u) && !phoneClean;
      var status = u.activo === false ? '<span class="ltk-user-pill off">Inactivo</span>' : '<span class="ltk-user-pill on">Activo</span>';
      var source = u.creado_desde_catalogo ? 'Catálogo' : 'Sistema';
      return '<tr class="'+(encargadoMissing?'ltk-user-row-warning':'')+'">'+
        '<td>'+esc(i+1)+'</td>'+
        '<td><strong>'+esc(name)+'</strong><div class="ltk-user-sub">'+esc(email || 'Sin correo')+'</div><div class="ltk-user-sub">@'+esc(u.usuario_login || slugify(name))+'</div></td>'+
        '<td><strong>'+esc(role)+'</strong><div class="ltk-user-sub">'+esc(puesto || 'Sin puesto')+'</div></td>'+
        '<td>'+phoneShown+(encargadoMissing?'<div class="ltk-user-required">Obligatorio para encargado</div>':'')+'</td>'+
        '<td><strong>'+esc(u.grupo_asignado || '-')+'</strong></td>'+
        '<td>'+status+'</td>'+
        '<td>'+esc(source)+'</td>'+
        '<td><div class="actions"><button class="btn btn-secondary btn-sm" onclick="lotekaOpenUserCatalogModal(\''+esc(id)+'\')">Editar</button><button class="btn '+(u.activo===false?'btn-good':'btn-danger')+' btn-sm" onclick="lotekaToggleUserActive(\''+esc(id)+'\')">'+(u.activo===false?'Activar':'Desactivar')+'</button></div></td>'+
        '</tr>';
    }).join('');
  }

  function ensureModal(){
    if(qs('#lotekaUserCatalogModal')) return;
    var css = document.createElement('style');
    css.id='loteka-v228-users-css';
    css.textContent = '.ltk-user-pill{display:inline-flex;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;border:1px solid rgba(148,163,184,.25)}.ltk-user-pill.on{background:#e7f9f2;color:#166534;border-color:#b8e8d1}.ltk-user-pill.off{background:#fff1f2;color:#be123c;border-color:#fecdd3}.ltk-user-sub{margin-top:4px;font-size:12px;color:#6d8498;font-weight:700}.ltk-user-warn{color:#b91c1c;font-weight:900}.ltk-user-required{margin-top:5px;font-size:11px;color:#b45309;font-weight:900}.ltk-user-row-warning{outline:1px solid rgba(251,191,36,.22)}.ltk-user-modal{position:fixed;inset:0;z-index:10040;background:rgba(7,23,39,.56);backdrop-filter:blur(5px);display:none;align-items:center;justify-content:center;padding:22px}.ltk-user-modal.open{display:flex}.ltk-user-dialog{width:min(930px,96vw);max-height:92vh;overflow:auto;border:1px solid #d8e6f1;border-radius:28px;background:linear-gradient(180deg,#ffffff 0%,#f4f9fc 100%);box-shadow:0 32px 80px rgba(4,25,44,.28);color:#16364f}.ltk-user-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:22px 24px;border-bottom:1px solid #deebf4;background:linear-gradient(135deg,#072f4f 0%,#0d86be 100%);color:#fff}.ltk-user-head h3{margin:0;font-size:32px;line-height:1.05;font-weight:900;letter-spacing:-.03em}.ltk-user-head .ltk-user-sub{margin-top:7px;color:rgba(255,255,255,.88);font-size:14px;font-weight:600}.ltk-user-body{padding:22px 24px;background:transparent}.ltk-user-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.ltk-user-field{display:grid;gap:8px;padding:14px 14px 12px;border:1px solid #deebf4;border-radius:18px;background:#ffffff;box-shadow:0 8px 24px rgba(13,76,112,.06)}.ltk-user-field label{font-size:12px;font-weight:900;color:#315b79;text-transform:uppercase;letter-spacing:.04em}.ltk-user-field input,.ltk-user-field select{width:100%;min-height:52px;border:1px solid #cfe1ee;border-radius:14px;background:#f9fcff;color:#123b5a;padding:13px 14px;outline:none;font-size:15px;font-weight:800;box-shadow:inset 0 1px 0 rgba(255,255,255,.85)}.ltk-user-field input::placeholder{color:#7a91a5;font-weight:700;opacity:1}.ltk-user-field input:focus,.ltk-user-field select:focus{border-color:#1aa1d3;box-shadow:0 0 0 4px rgba(26,161,211,.12)}.ltk-user-field select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,#47708c 50%),linear-gradient(135deg,#47708c 50%,transparent 50%);background-position:calc(100% - 18px) calc(50% - 3px),calc(100% - 12px) calc(50% - 3px);background-size:6px 6px,6px 6px;background-repeat:no-repeat;padding-right:36px}.ltk-user-field option{background:#fff;color:#16364f}.ltk-user-note{margin-top:18px;padding:14px 16px;border-radius:16px;border:1px solid #d6e8f2;background:#f7fbfe;color:#537289;font-size:13px;line-height:1.55;font-weight:700}.ltk-user-note b{color:#0b5f87}.ltk-user-foot{display:flex;justify-content:flex-end;gap:12px;padding:18px 24px;border-top:1px solid #deebf4;position:sticky;bottom:0;background:rgba(255,255,255,.96);backdrop-filter:blur(4px)}.ltk-user-foot .btn{min-width:168px;border-radius:14px;font-weight:900;padding:13px 18px;box-shadow:none}.ltk-user-foot .btn.btn-secondary{background:#eef5f9;border:1px solid #d3e4ee;color:#355874}.ltk-user-foot .btn.btn-primary{background:linear-gradient(90deg,#1a4f7d 0%,#18a7d8 100%);border:none;color:#fff;box-shadow:0 14px 28px rgba(24,167,216,.22)}.ltk-user-close{border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(255,255,255,.12);color:#fff;width:40px;height:40px;font-size:22px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}.ltk-user-close:hover{background:rgba(255,255,255,.2)}@media(max-width:720px){.ltk-user-head h3{font-size:26px}.ltk-user-grid{grid-template-columns:1fr}.ltk-user-foot{flex-direction:column}.ltk-user-foot .btn{width:100%;min-width:0}.ltk-user-dialog{width:min(96vw,96vw)}}';
    document.head.appendChild(css);
    document.body.insertAdjacentHTML('beforeend', '<div id="lotekaUserCatalogModal" class="ltk-user-modal"><div class="ltk-user-dialog"><div class="ltk-user-head"><div><h3 id="lotekaUserModalTitle">Nuevo usuario</h3><p class="ltk-user-sub">Actualiza la información del usuario. Los cambios se guardan automáticamente.</p></div><button type="button" class="ltk-user-close" onclick="lotekaCloseUserCatalogModal()">×</button></div><div class="ltk-user-body"><div class="ltk-user-grid"><div class="ltk-user-field"><label>Nombre completo</label><input id="uCatName" placeholder="Ej.: Hilario Pérez"></div><div class="ltk-user-field"><label>Correo</label><input id="uCatEmail" placeholder="correo@grupoortiz.com.do"></div><div class="ltk-user-field"><label>Usuario/login interno</label><input id="uCatLogin" placeholder="hilario13"></div><div class="ltk-user-field"><label>Teléfono RD</label><input id="uCatPhone" placeholder="809-000-0000"></div><div class="ltk-user-field"><label>Rol</label><select id="uCatRole"></select></div><div class="ltk-user-field"><label>Puesto</label><select id="uCatPuesto"></select></div><div class="ltk-user-field"><label>Departamento</label><input id="uCatDepartamento" placeholder="Operaciones"></div><div class="ltk-user-field"><label>Grupo asignado</label><input id="uCatGrupo" placeholder="13"></div><div class="ltk-user-field"><label>Estado</label><select id="uCatActivo"><option value="true">Activo</option><option value="false">Inactivo</option></select></div></div><div class="ltk-user-note">Regla: si el rol o puesto es Encargado, el teléfono es obligatorio y se utilizará para abrir WhatsApp sin pedir número manual.</div></div><div class="ltk-user-foot"><button type="button" class="btn btn-secondary" onclick="lotekaCloseUserCatalogModal()">Cancelar</button><button type="button" class="btn btn-primary" onclick="lotekaSaveUserCatalogModal()">Guardar cambios</button></div></div></div>');
  }

  function fillSelects(user){
    var roleSel = qs('#uCatRole'), puestoSel = qs('#uCatPuesto');
    if(roleSel){
      var roleOptions = '<option value="">Sin rol</option>' + state.roles.map(function(r){ return '<option value="'+esc(r.id)+'">'+esc(r.nombre)+'</option>'; }).join('');
      roleSel.innerHTML = roleOptions;
      roleSel.value = user && user.rol_id ? String(user.rol_id) : '';
    }
    if(puestoSel){
      var puestoOptions = '<option value="">Sin puesto</option>' + state.puestos.map(function(p){ return '<option value="'+esc(p.id)+'">'+esc(p.nombre)+'</option>'; }).join('');
      puestoSel.innerHTML = puestoOptions;
      puestoSel.value = user && user.puesto_id ? String(user.puesto_id) : '';
    }
  }

  function selectedRoleName(){ var sel=qs('#uCatRole'); return sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : ''; }
  function selectedPuestoName(){ var sel=qs('#uCatPuesto'); return sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : ''; }

  function openUserModal(id){
    ensureModal();
    state.currentId = id || null;
    var user = id ? (state.users || []).find(function(u){ return String(u.id) === String(id); }) : null;
    qs('#lotekaUserModalTitle').textContent = user ? 'Editar usuario' : 'Nuevo usuario';
    fillSelects(user);
    qs('#uCatName').value = user ? (user.nombre_completo || user.nombre || '') : '';
    qs('#uCatEmail').value = user ? (user.correo || user.email || '') : '';
    qs('#uCatLogin').value = user ? (user.usuario_login || slugify(user.nombre_completo || user.correo || '')) : '';
    qs('#uCatPhone').value = user ? prettyPhone(user.telefono_whatsapp || user.telefono || '') : '';
    qs('#uCatDepartamento').value = user ? (user.departamento || '') : '';
    qs('#uCatGrupo').value = user ? (user.grupo_asignado || '') : '';
    qs('#uCatActivo').value = user && user.activo === false ? 'false' : 'true';
    qs('#lotekaUserCatalogModal').classList.add('open');
  }

  function closeUserModal(){ var m=qs('#lotekaUserCatalogModal'); if(m) m.classList.remove('open'); state.currentId = null; }

  async function saveUserModal(){
    var c = client(); if(!c) return toast('Supabase no disponible','No pude guardar el usuario porque Supabase no está inicializado.','error');
    var name = String(qs('#uCatName').value || '').trim();
    var correo = String(qs('#uCatEmail').value || '').trim();
    var login = String(qs('#uCatLogin').value || '').trim() || slugify(name || correo);
    var phoneInput = String(qs('#uCatPhone').value || '').trim();
    var phoneWhats = normalizePhoneRD(phoneInput);
    var roleId = qs('#uCatRole').value || null;
    var puestoId = qs('#uCatPuesto').value || null;
    var departamento = String(qs('#uCatDepartamento').value || '').trim();
    var grupo = String(qs('#uCatGrupo').value || '').trim();
    var activo = qs('#uCatActivo').value !== 'false';
    var roleName = selectedRoleName();
    var puestoName = selectedPuestoName();
    if(!name) return toast('Falta nombre','El nombre completo es obligatorio.','warning');
    if(!correo) return toast('Falta correo','El correo es obligatorio.','warning');
    if(phoneInput && !phoneWhats) return toast('Teléfono inválido','Usa un número RD válido 809/829/849. Ej.: 809-000-0000.','warning');
    if((isEncargadoName(roleName) || isEncargadoName(puestoName) || isEncargadoName(departamento)) && !phoneWhats){
      return toast('Teléfono obligatorio','Todo encargado debe tener teléfono WhatsApp registrado.','warning');
    }
    var payload = {
      nombre_completo: name,
      correo: correo,
      telefono: phoneWhats ? prettyPhone(phoneWhats) : '',
      telefono_whatsapp: phoneWhats || '',
      usuario_login: login,
      departamento: departamento,
      grupo_asignado: grupo,
      activo: activo,
      creado_desde_catalogo: true
    };
    if(roleId) payload.rol_id = roleId;
    if(puestoId) payload.puesto_id = puestoId;
    try{
      var res;
      if(state.currentId){ res = await c.from('perfiles').update(payload).eq('id', state.currentId).select().maybeSingle(); }
      else{ res = await c.from('perfiles').insert(payload).select().maybeSingle(); }
      if(res.error) throw res.error;
      closeUserModal();
      await loadCatalogData();
      toast('Usuario guardado','Los datos se guardaron correctamente.','success');
    }catch(e){ handleError(e); }
  }

  async function toggleActive(id){
    var c=client(); if(!c) return;
    var u=(state.users||[]).find(function(x){return String(x.id)===String(id);});
    if(!u) return;
    var next = u.activo === false;
    if(!confirm((next?'Activar':'Desactivar')+' usuario: '+(u.nombre_completo||u.correo||'usuario')+'?')) return;
    try{
      var r=await c.from('perfiles').update({activo:next}).eq('id',id);
      if(r.error) throw r.error;
      await loadCatalogData();
      toast('Estado actualizado', next ? 'Usuario activado.' : 'Usuario desactivado.','success');
    }catch(e){ handleError(e); }
  }

  function updateAssigneesFromProfiles(){
    try{
      var converted = (state.users || [])
        .filter(function(u){ return u.activo !== false; })
        .map(function(u){
          var name = u.nombre_completo || u.nombre || u.correo || 'Usuario';
          return { name:name, username:u.usuario_login || slugify(name), area:getPuestoName(u) || getRoleName(u) || u.departamento || '', phone:prettyPhone(u.telefono_whatsapp || u.telefono || '') };
        });
      if(converted.length){
        window.USERS = converted;
        try { if(typeof USERS !== 'undefined') USERS = converted; } catch(e){}
        if(typeof window.refreshOpenTypeSelectors === 'function') window.refreshOpenTypeSelectors();
      }
    }catch(e){ console.warn('[Usuarios v228] No se pudo refrescar asignables:', e); }
  }

  function handleError(e){
    console.error('[Usuarios v228]', e);
    toast('Error en usuarios', (e && e.message) ? e.message : String(e || 'Error desconocido'), 'error');
    renderTableMessage('No pude cargar/guardar usuarios. Revisa permisos RLS o columnas de perfiles.');
  }

  window.lotekaLoadUsersCatalogSupabase = function(){ ensureUsersUI(); return loadCatalogData().catch(handleError); };
  window.renderUsersCatalogV214 = function(){ ensureUsersUI(); return loadCatalogData().catch(handleError); };
  window.lotekaOpenUserCatalogModal = openUserModal;
  window.lotekaCloseUserCatalogModal = closeUserModal;
  window.lotekaSaveUserCatalogModal = saveUserModal;
  window.lotekaToggleUserActive = toggleActive;

  function boot(){
    ensureUsersUI();
    var usersView = qs('#usersView');
    if(usersView && !usersView.classList.contains('hidden')) loadCatalogData().catch(handleError);
    var nav = qs('#navUsers');
    if(nav && !nav.dataset.v228UsersNav){
      nav.dataset.v228UsersNav='1';
      nav.addEventListener('click', function(){ setTimeout(function(){ loadCatalogData().catch(handleError); }, 150); }, true);
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

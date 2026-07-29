
(function(){
  'use strict';
  if(window.__lotekaAccessManagerV308) return;
  window.__lotekaAccessManagerV308 = true;

  var state = {
    catalog:null,
    selectedRoleId:null,
    newRole:false,
    loading:false,
    installed:false
  };

  function qs(s,root){ return (root||document).querySelector(s); }
  function qsa(s,root){ return Array.prototype.slice.call((root||document).querySelectorAll(s)); }
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function client(){ return window.lotekaSupabase || window.supabaseClient || null; }
  function authState(){ return window.lotekaAuthState || {}; }
  function roleName(){ var p=authState().perfil||authState().profile||{}; return String((p.roles&&p.roles.nombre)||p.rol||''); }
  function isAdmin(){ return /administrador|admin/i.test(roleName()); }
  function has(code){
    if(isAdmin()) return true;
    try{ return typeof window.lotekaHasPermission==='function' && window.lotekaHasPermission(code); }catch(e){ return false; }
  }
  function canViewUsers(){ return has('ver_usuarios') || has('gestionar_usuarios') || has('administrar_roles_permisos') || has('ver_catalogos'); }
  function canManageUsers(){ return has('gestionar_usuarios'); }
  function canManageAccess(){ return has('administrar_roles_permisos'); }
  function toast(title,text,type){
    try{ if(typeof window.showToastNotification==='function') return window.showToastNotification(title||'Accesos',text||'',type||'info'); }catch(e){}
    try{ if(typeof window.notify==='function') return window.notify((title?title+': ':'')+(text||''),type||'info'); }catch(e){}
    if(text) alert((title?title+'\n':'')+text);
  }
  function deny(text){ toast('Acceso restringido',text||'No tienes permiso para administrar perfiles y permisos.','warning'); }
  function friendly(error){
    var msg=String(error&&error.message?error.message:error||'Error desconocido');
    if(/rpc_admin_catalogo_accesos|function.*does not exist|PGRST202/i.test(msg)) return 'Primero ejecuta los SQL de permisos y alcance por grupo en Supabase.';
    if(/permission|permiso|42501|row-level|policy/i.test(msg)) return 'Tu usuario no tiene autorización para administrar perfiles y permisos.';
    return msg;
  }
  function formatCode(code){ return String(code||'').replace(/_/g,' ').replace(/\b\w/g,function(m){return m.toUpperCase();}); }
  function normalizeCatalog(raw){
    if(typeof raw==='string'){ try{ raw=JSON.parse(raw); }catch(e){ raw={}; } }
    raw=raw||{};
    var roles=Array.isArray(raw.roles)?raw.roles:[];
    var permisos=Array.isArray(raw.permisos)?raw.permisos:[];
    var puestos=Array.isArray(raw.puestos)?raw.puestos:[];
    var grupos=Array.isArray(raw.grupos)?raw.grupos:[];
    var usuarios=Array.isArray(raw.usuarios)?raw.usuarios:[];
    roles=roles.map(function(r){
      var codes=Array.isArray(r.permisos)?r.permisos:[];
      return Object.assign({},r,{id:String(r.id||''),permisos:codes.map(String),usuarios_asignados:Number(r.usuarios_asignados||0)});
    });
    permisos=permisos.map(function(p){return Object.assign({},p,{id:String(p.id||''),codigo:String(p.codigo||''),nombre:p.nombre||formatCode(p.codigo),categoria:p.categoria||'Otros',orden:Number(p.orden||0)});});
    puestos=puestos.map(function(p){return Object.assign({},p,{id:String(p.id||''),usuarios_asignados:Number(p.usuarios_asignados||0)});});
    grupos=grupos.map(function(g){return Object.assign({},g,{id:String(g.id||''),codigo:String(g.codigo||''),nombre:g.nombre||('Grupo '+String(g.codigo||''))});});
    usuarios=usuarios.map(function(u){
      var groupIds=Array.isArray(u.grupo_ids)?u.grupo_ids.map(String):[];
      return Object.assign({},u,{id:String(u.id||''),rol_id:u.rol_id?String(u.rol_id):'',puesto_id:u.puesto_id?String(u.puesto_id):'',acceso_todos_grupos:u.acceso_todos_grupos!==false,grupo_ids:groupIds});
    });
    return {roles:roles,permisos:permisos,puestos:puestos,grupos:grupos,usuarios:usuarios};
  }

  async function loadCatalog(force){
    if(state.loading) return;
    if(state.catalog && !force){ renderAll(); return; }
    if(!canManageAccess()){ deny(); return; }
    var c=client(); if(!c){ toast('Supabase no disponible','No se encontró el cliente de Supabase.','error'); return; }
    state.loading=true;
    renderLoading();
    try{
      var response=await c.rpc('rpc_admin_catalogo_accesos');
      if(response.error) throw response.error;
      state.catalog=normalizeCatalog(response.data);
      if(!state.selectedRoleId && state.catalog.roles.length) state.selectedRoleId=String(state.catalog.roles[0].id);
      if(state.selectedRoleId && !state.catalog.roles.some(function(r){return String(r.id)===String(state.selectedRoleId);})) state.selectedRoleId=state.catalog.roles.length?String(state.catalog.roles[0].id):null;
      renderAll();
    }catch(error){
      console.error('[Accesos v307]',error);
      renderError(friendly(error));
      toast('No se pudo cargar',friendly(error),'error');
    }finally{ state.loading=false; }
  }

  function ensureUI(){
    var view=qs('#usersView'); if(!view) return false;
    if(!qs('#ltkUsersAccessTabs')){
      var tabs=document.createElement('div');
      tabs.id='ltkUsersAccessTabs'; tabs.className='ltk-access-tabs';
      tabs.innerHTML='<button type="button" class="ltk-access-tab active" data-access-tab="users"><i class="fas fa-users"></i> Usuarios</button>'+ 
        '<button type="button" class="ltk-access-tab" data-access-tab="permissions"><i class="fas fa-user-shield"></i> Perfiles y permisos</button>';
      var top=qs('.catalog-topbar',view); if(top) top.insertAdjacentElement('afterend',tabs); else view.insertBefore(tabs,view.firstChild);
      var listPanel=qs(':scope > .panel',view) || qs('.panel',view);
      if(listPanel){ listPanel.id='ltkUsersListPanel'; listPanel.classList.add('ltk-access-panel'); listPanel.dataset.accessPanel='users'; }
      var access=document.createElement('div');
      access.id='ltkUsersPermissionsPanel'; access.className='ltk-access-panel'; access.dataset.accessPanel='permissions'; access.hidden=true;
      access.innerHTML='<div class="ltk-access-shell"><aside class="ltk-access-sidebar"><div class="ltk-access-side-head"><h3>Perfiles de acceso</h3><p>Cada perfil reúne los permisos que recibirán sus usuarios.</p><div class="ltk-access-side-actions"><button class="ltk-access-new" id="ltkAccessNewRole" type="button"><i class="fas fa-plus"></i> Nuevo perfil</button><button class="ltk-access-positions" id="ltkAccessPositions" type="button"><i class="fas fa-briefcase"></i> Puestos</button></div><input class="ltk-access-search" id="ltkAccessRoleSearch" placeholder="Buscar perfil..."></div><div class="ltk-access-role-list" id="ltkAccessRoleList"></div></aside><section class="ltk-access-editor" id="ltkAccessEditor"><div class="ltk-access-loading">Selecciona un perfil de acceso.</div></section></div>';
      view.appendChild(access);
      installEvents();
    }
    updateAccessTabVisibility();
    return true;
  }

  function updateAccessTabVisibility(){
    var permissionsTab=qs('[data-access-tab="permissions"]');
    if(permissionsTab) permissionsTab.hidden=!canManageAccess();
  }

  function installEvents(){
    var tabs=qs('#ltkUsersAccessTabs');
    if(tabs && !tabs.dataset.bound){
      tabs.dataset.bound='1';
      tabs.addEventListener('click',function(e){ var b=e.target.closest('[data-access-tab]'); if(b) switchTab(b.dataset.accessTab); });
    }
    var panel=qs('#ltkUsersPermissionsPanel');
    if(panel && !panel.dataset.bound){
      panel.dataset.bound='1';
      panel.addEventListener('click',function(e){
        var roleBtn=e.target.closest('[data-role-id]');
        if(roleBtn){ state.newRole=false; state.selectedRoleId=roleBtn.dataset.roleId; renderAll(); return; }
        if(e.target.closest('#ltkAccessNewRole')){ startNewRole(); return; }
        if(e.target.closest('#ltkAccessPositions')){ openPositionsModal(); return; }
        var groupBtn=e.target.closest('[data-toggle-category]');
        if(groupBtn){ toggleCategory(groupBtn.dataset.toggleCategory); return; }
        if(e.target.closest('#ltkPermAll')){ qsa('#ltkAccessEditor input[data-permission]').forEach(function(x){x.checked=true;}); updateSelectedCounter(); return; }
        if(e.target.closest('#ltkPermNone')){ qsa('#ltkAccessEditor input[data-permission]').forEach(function(x){x.checked=false;}); updateSelectedCounter(); return; }
        if(e.target.closest('#ltkAccessSaveRole')){ saveRole(); return; }
        if(e.target.closest('#ltkAccessDeleteRole')){ deleteRole(); return; }
        if(e.target.closest('#ltkAccessCancelNew')){ state.newRole=false; state.selectedRoleId=state.catalog&&state.catalog.roles[0]?String(state.catalog.roles[0].id):null; renderAll(); return; }
        if(e.target.closest('#ltkAccessAssignUser')){ assignRoleToUser(); return; }
      });
      panel.addEventListener('input',function(e){
        if(e.target.id==='ltkAccessRoleSearch'){ renderRoleList(); }
        if(e.target.matches('input[data-permission]')) updateSelectedCounter();
      });
      panel.addEventListener('change',function(e){
        if(e.target.id==='ltkAccessAssignUserSelect') syncAssignmentDetails();
        if(e.target.id==='ltkAccessScopeSelect') syncScopeControls();
      });
    }
  }

  function switchTab(tab){
    ensureUI();
    if(tab==='permissions'&&!canManageAccess()){ deny(); return; }
    qsa('#ltkUsersAccessTabs [data-access-tab]').forEach(function(b){b.classList.toggle('active',b.dataset.accessTab===tab);});
    qsa('#usersView [data-access-panel]').forEach(function(p){p.hidden=p.dataset.accessPanel!==tab;});
    if(tab==='permissions') loadCatalog(false);
    else if(typeof window.lotekaLoadUsersCatalogSupabase==='function') window.lotekaLoadUsersCatalogSupabase();
  }

  function renderLoading(){ var list=qs('#ltkAccessRoleList'),editor=qs('#ltkAccessEditor'); if(list)list.innerHTML='<div class="ltk-access-loading"><i class="fas fa-spinner fa-spin"></i> Cargando perfiles...</div>'; if(editor)editor.innerHTML='<div class="ltk-access-loading"><i class="fas fa-spinner fa-spin"></i> Cargando matriz...</div>'; }
  function renderError(message){ var editor=qs('#ltkAccessEditor'); if(editor)editor.innerHTML='<div class="ltk-access-empty"><div><i class="fas fa-triangle-exclamation"></i><h3>No se pudo abrir el administrador</h3><p>'+esc(message)+'</p></div></div>'; }
  function renderAll(){ if(!state.catalog)return; renderRoleList(); renderEditor(); setTimeout(syncScopeControls,0); }
  function renderRoleList(){
    var box=qs('#ltkAccessRoleList'); if(!box||!state.catalog)return;
    var q=String(qs('#ltkAccessRoleSearch')&&qs('#ltkAccessRoleSearch').value||'').toLowerCase().trim();
    var roles=state.catalog.roles.filter(function(r){return !q||String(r.nombre||'').toLowerCase().includes(q)||String(r.descripcion||'').toLowerCase().includes(q);});
    box.innerHTML=roles.length?roles.map(function(r){
      var active=!state.newRole&&String(r.id)===String(state.selectedRoleId);
      return '<button type="button" class="ltk-access-role '+(active?'active':'')+'" data-role-id="'+esc(r.id)+'"><div class="ltk-access-role-top"><strong>'+esc(r.nombre||'Sin nombre')+'</strong><span class="ltk-access-role-count">'+esc(r.usuarios_asignados||0)+' usuario(s)</span></div><small>'+esc(r.descripcion||'Sin descripción')+'</small>'+(r.es_sistema?'<span class="ltk-access-role-system">Perfil del sistema</span>':'')+'</button>';
    }).join(''):'<div class="ltk-access-loading">No hay perfiles que coincidan.</div>';
  }
  function selectedRole(){ if(state.newRole)return {id:null,nombre:'',descripcion:'',permisos:[],usuarios_asignados:0,es_sistema:false}; return state.catalog&&state.catalog.roles.find(function(r){return String(r.id)===String(state.selectedRoleId);}); }
  function groupedPermissions(){
    var groups={};
    (state.catalog&&state.catalog.permisos||[]).filter(function(p){return p.activo!==false;}).sort(function(a,b){return String(a.categoria).localeCompare(String(b.categoria),'es')||(a.orden-b.orden);}).forEach(function(p){var cat=p.categoria||'Otros';if(!groups[cat])groups[cat]=[];groups[cat].push(p);});
    return groups;
  }
  function renderEditor(){
    var editor=qs('#ltkAccessEditor'); if(!editor||!state.catalog)return;
    var role=selectedRole();
    if(!role){editor.innerHTML='<div class="ltk-access-empty"><div><i class="fas fa-user-shield"></i><h3>Selecciona un perfil</h3><p>Abre un perfil de acceso para consultar o modificar su matriz de permisos.</p></div></div>';return;}
    var isProtected=/^administrador$/i.test(String(role.nombre||'').trim());
    var selected=new Set((role.permisos||[]).map(String));
    var groups=groupedPermissions();
    var groupHtml=Object.keys(groups).map(function(cat){
      var items=groups[cat];
      return '<section class="ltk-perm-group"><div class="ltk-perm-group-head"><strong>'+esc(cat)+'</strong><button type="button" data-toggle-category="'+esc(cat)+'">Marcar grupo</button></div><div class="ltk-perm-list">'+items.map(function(p){
        return '<label class="ltk-perm-item"><input type="checkbox" data-permission="'+esc(p.codigo)+'" '+(selected.has(p.codigo)||isProtected?'checked':'')+' '+(isProtected?'disabled':'')+'><span><b>'+esc(p.nombre||formatCode(p.codigo))+'</b><small>'+esc(p.descripcion||'')+'</small><span class="ltk-perm-code">'+esc(p.codigo)+'</span></span></label>';
      }).join('')+'</div></section>';
    }).join('');
    var users=(state.catalog.usuarios||[]).filter(function(u){return u.activo!==false;});
    var positions=state.catalog.puestos||[];
    var scopeGroups=state.catalog.grupos||[];
    var userOptions='<option value="">Selecciona un usuario</option>'+users.map(function(u){return '<option value="'+esc(u.id)+'">'+esc(u.nombre||u.correo||'Usuario')+'</option>';}).join('');
    var positionOptions='<option value="">Sin puesto laboral</option>'+positions.map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.nombre)+'</option>';}).join('');
    var groupOptions=scopeGroups.map(function(g){var label=(g.codigo?('G-'+String(g.codigo).padStart(2,'0')+' · '):'')+(g.nombre||'Grupo');return '<option value="'+esc(g.id)+'">'+esc(label)+'</option>';}).join('');
    editor.innerHTML='<div class="ltk-access-editor-head"><div><h3>'+(state.newRole?'Nuevo perfil de acceso':esc(role.nombre))+'</h3><p>Define exactamente qué puede consultar o modificar este perfil.</p></div><span class="ltk-access-editor-badge">'+(isProtected?'Protegido':'Configurable')+'</span></div><div class="ltk-access-editor-body">'+
      '<div class="ltk-access-form-grid"><div class="ltk-access-field"><label>Nombre del perfil</label><input id="ltkAccessRoleName" value="'+esc(role.nombre||'')+'" placeholder="Ej.: Auxiliar de Operaciones" '+(isProtected?'readonly':'')+'></div><div class="ltk-access-field"><label>Descripción</label><input id="ltkAccessRoleDescription" value="'+esc(role.descripcion||'')+'" placeholder="Describe para quién se utilizará"></div></div>'+
      '<div class="ltk-access-summary"><div class="ltk-access-stat"><span>Permisos seleccionados</span><b id="ltkAccessSelectedCount">'+esc(isProtected?state.catalog.permisos.length:selected.size)+'</b></div><div class="ltk-access-stat"><span>Permisos disponibles</span><b>'+esc(state.catalog.permisos.length)+'</b></div><div class="ltk-access-stat"><span>Usuarios asignados</span><b>'+esc(role.usuarios_asignados||0)+'</b></div></div>'+
      (isProtected?'<div class="ltk-access-readonly-note"><i class="fas fa-shield-halved"></i> El perfil Administrador conserva todos los permisos para evitar que el sistema quede sin administración.</div>':'')+
      '<div class="ltk-perm-toolbar"><div><h4>Matriz de permisos</h4><p>Marca únicamente las acciones necesarias para este perfil.</p></div><div class="ltk-perm-actions"><button type="button" id="ltkPermAll" '+(isProtected?'disabled':'')+'>Marcar todos</button><button type="button" id="ltkPermNone" '+(isProtected?'disabled':'')+'>Desmarcar</button></div></div><div class="ltk-perm-groups">'+groupHtml+'</div>'+
      (!state.newRole?'<div class="ltk-access-assign"><h4>Asignar perfil, puesto y alcance</h4><p>Selecciona qué puede hacer el usuario y sobre cuáles grupos puede trabajar.</p><div class="ltk-access-assign-grid"><div class="ltk-access-scope-field"><label>Usuario</label><select id="ltkAccessAssignUserSelect">'+userOptions+'</select></div><div class="ltk-access-scope-field"><label>Puesto laboral</label><select id="ltkAccessAssignPositionSelect">'+positionOptions+'</select></div></div><div class="ltk-access-scope-row"><div class="ltk-access-scope-field"><label>Alcance de información</label><select id="ltkAccessScopeSelect"><option value="all">Todos los grupos</option><option value="assigned">Solo grupos asignados</option></select><div class="ltk-access-scope-help" id="ltkAccessScopeHelp">Todos los grupos: el usuario podrá consultar agencias y operaciones de cualquier grupo.</div></div><div class="ltk-access-scope-field" id="ltkAccessGroupsWrap"><label>Grupos asignados</label><select id="ltkAccessGroupsSelect" multiple>'+groupOptions+'</select><div class="ltk-access-scope-help">Usa Ctrl/Cmd para seleccionar varios grupos. Para un encargado normal, selecciona únicamente su grupo.</div></div></div><button type="button" id="ltkAccessAssignUser" style="width:100%;margin-top:10px">Guardar asignación y alcance</button></div>':'')+
      '</div><div class="ltk-access-editor-foot"><div class="left">'+(state.newRole?'<button type="button" class="ltk-access-btn secondary" id="ltkAccessCancelNew">Cancelar</button>':(!isProtected?'<button type="button" class="ltk-access-btn danger" id="ltkAccessDeleteRole">Eliminar perfil</button>':''))+'</div><div class="right"><button type="button" class="ltk-access-btn primary" id="ltkAccessSaveRole"><i class="fas fa-floppy-disk"></i> Guardar perfil y permisos</button></div></div>';
  }

  function updateSelectedCounter(){ var el=qs('#ltkAccessSelectedCount'); if(el) el.textContent=String(qsa('#ltkAccessEditor input[data-permission]:checked').length); }
  function toggleCategory(category){
    var inputs=qsa('#ltkAccessEditor input[data-permission]').filter(function(input){var p=state.catalog.permisos.find(function(x){return x.codigo===input.dataset.permission;});return p&&p.categoria===category&&!input.disabled;});
    var shouldCheck=inputs.some(function(x){return !x.checked;});inputs.forEach(function(x){x.checked=shouldCheck;});updateSelectedCounter();
  }
  function startNewRole(){ if(!canManageAccess()){deny();return;} state.newRole=true;state.selectedRoleId=null;renderAll();setTimeout(function(){var n=qs('#ltkAccessRoleName');if(n)n.focus();},40); }

  async function saveRole(){
    if(!canManageAccess()){deny();return;}
    var role=selectedRole();if(!role)return;
    var name=String(qs('#ltkAccessRoleName')&&qs('#ltkAccessRoleName').value||'').trim();
    var description=String(qs('#ltkAccessRoleDescription')&&qs('#ltkAccessRoleDescription').value||'').trim();
    var codes=qsa('#ltkAccessEditor input[data-permission]:checked').map(function(x){return x.dataset.permission;});
    if(!name){toast('Falta el nombre','Escribe el nombre del perfil de acceso.','warning');return;}
    var btn=qs('#ltkAccessSaveRole');if(btn){btn.disabled=true;btn.textContent='Guardando...';}
    try{
      var res=await client().rpc('rpc_admin_guardar_rol',{p_rol_id:state.newRole?null:role.id,p_nombre:name,p_descripcion:description,p_permiso_codigos:codes});
      if(res.error)throw res.error;
      state.newRole=false;state.selectedRoleId=String(res.data&&res.data.rol_id||role.id||'');state.catalog=null;
      await loadCatalog(true);
      if(typeof window.lotekaLoadUsersCatalogSupabase==='function') window.lotekaLoadUsersCatalogSupabase();
      toast('Perfil guardado','La matriz de permisos fue actualizada correctamente.','success');
    }catch(error){toast('No se pudo guardar',friendly(error),'error');}
    finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-floppy-disk"></i> Guardar perfil y permisos';}}
  }
  async function deleteRole(){
    if(!canManageAccess()){deny();return;}var role=selectedRole();if(!role||!role.id)return;
    if(!confirm('¿Eliminar el perfil de acceso "'+role.nombre+'"? Solo puede eliminarse si no tiene usuarios asignados.'))return;
    try{var res=await client().rpc('rpc_admin_eliminar_rol',{p_rol_id:role.id});if(res.error)throw res.error;state.selectedRoleId=null;state.catalog=null;await loadCatalog(true);if(typeof window.lotekaLoadUsersCatalogSupabase==='function')window.lotekaLoadUsersCatalogSupabase();toast('Perfil eliminado','El perfil fue eliminado correctamente.','success');}catch(error){toast('No se pudo eliminar',friendly(error),'error');}
  }
  function syncScopeControls(){
    var scope=String(qs('#ltkAccessScopeSelect')&&qs('#ltkAccessScopeSelect').value||'all');
    var wrap=qs('#ltkAccessGroupsWrap');
    var groups=qs('#ltkAccessGroupsSelect');
    var help=qs('#ltkAccessScopeHelp');
    var role=selectedRole();
    var profileForcesAll=!!(role&&Array.isArray(role.permisos)&&role.permisos.indexOf('ver_todas_agencias')!==-1)||/^administrador$/i.test(String(role&&role.nombre||'').trim());
    var restricted=scope==='assigned'&&!profileForcesAll;
    if(wrap)wrap.classList.toggle('ltk-access-groups-disabled',!restricted);
    if(groups)groups.disabled=!restricted;
    if(help){
      help.classList.toggle('warning',profileForcesAll);
      help.textContent=profileForcesAll?'Este perfil tiene “Ver agencias de todos los grupos”; el alcance será completo aunque selecciones grupos específicos.':(restricted?'Solo grupos asignados: el usuario verá únicamente las agencias y operaciones de los grupos seleccionados.':'Todos los grupos: el usuario podrá consultar agencias y operaciones de cualquier grupo.');
    }
  }
  function syncAssignmentDetails(){
    var uid=String(qs('#ltkAccessAssignUserSelect')&&qs('#ltkAccessAssignUserSelect').value||'');
    var user=state.catalog&&state.catalog.usuarios.find(function(u){return String(u.id)===uid;});
    var position=qs('#ltkAccessAssignPositionSelect');if(position)position.value=user&&user.puesto_id?String(user.puesto_id):'';
    var scope=qs('#ltkAccessScopeSelect');if(scope)scope.value=user&&user.acceso_todos_grupos===false?'assigned':'all';
    var selectedIds=new Set(user&&Array.isArray(user.grupo_ids)?user.grupo_ids.map(String):[]);
    qsa('#ltkAccessGroupsSelect option').forEach(function(option){option.selected=selectedIds.has(String(option.value));});
    syncScopeControls();
  }
  async function assignRoleToUser(){
    if(!canManageAccess()){deny();return;}var role=selectedRole();if(!role||!role.id)return;
    var userId=String(qs('#ltkAccessAssignUserSelect')&&qs('#ltkAccessAssignUserSelect').value||'');
    var positionId=String(qs('#ltkAccessAssignPositionSelect')&&qs('#ltkAccessAssignPositionSelect').value||'')||null;
    var scope=String(qs('#ltkAccessScopeSelect')&&qs('#ltkAccessScopeSelect').value||'all');
    var groupIds=qsa('#ltkAccessGroupsSelect option:checked').map(function(option){return String(option.value);}).filter(Boolean);
    var profileForcesAll=Array.isArray(role.permisos)&&role.permisos.indexOf('ver_todas_agencias')!==-1||/^administrador$/i.test(String(role.nombre||'').trim());
    var allGroups=scope!=='assigned'||profileForcesAll;
    if(!userId){toast('Selecciona un usuario','Elige a quién deseas asignar este perfil.','warning');return;}
    if(!allGroups&&!groupIds.length){toast('Selecciona un grupo','Para limitar al usuario debes elegir al menos un grupo.','warning');return;}
    var currentUserId=String((authState().user&&authState().user.id)||'');
    if(currentUserId && currentUserId===userId && !/^administrador$/i.test(String(role.nombre||'').trim())){
      toast('Protección del administrador','No puedes quitarte tu propio perfil Administrador desde esta pantalla. Asigna primero otro administrador.','warning');
      return;
    }
    var btn=qs('#ltkAccessAssignUser');if(btn){btn.disabled=true;btn.textContent='Guardando alcance...';}
    try{
      var res=await client().rpc('rpc_admin_asignar_acceso_y_alcance_usuario',{p_usuario_id:userId,p_rol_id:role.id,p_puesto_id:positionId,p_acceso_todos_grupos:allGroups,p_grupo_ids:groupIds});if(res.error)throw res.error;
      state.catalog=null;await loadCatalog(true);if(typeof window.lotekaLoadUsersCatalogSupabase==='function')window.lotekaLoadUsersCatalogSupabase();toast('Acceso y alcance guardados',allGroups?'El usuario puede trabajar con todos los grupos.':'El usuario quedó limitado a '+groupIds.length+' grupo(s).','success');
    }catch(error){toast('No se pudo asignar',friendly(error),'error');}
    finally{if(btn){btn.disabled=false;btn.textContent='Guardar asignación y alcance';}}
  }

  function ensurePositionsModal(){
    if(qs('#ltkPositionsModal'))return;
    document.body.insertAdjacentHTML('beforeend','<div class="ltk-position-modal" id="ltkPositionsModal"><div class="ltk-position-card"><div class="ltk-position-head"><div><h3>Puestos laborales</h3><p>Los puestos describen el cargo. Los permisos se administran por perfil de acceso.</p></div><button type="button" id="ltkPositionsClose">×</button></div><div class="ltk-position-body"><div class="ltk-position-form"><input id="ltkPositionName" placeholder="Nombre del puesto"><input id="ltkPositionDescription" placeholder="Descripción opcional"><button type="button" id="ltkPositionSave">Crear puesto</button></div><div class="ltk-position-list" id="ltkPositionList"></div></div></div></div>');
    qs('#ltkPositionsClose').addEventListener('click',closePositionsModal);qs('#ltkPositionsModal').addEventListener('click',function(e){if(e.target.id==='ltkPositionsModal')closePositionsModal();});qs('#ltkPositionSave').addEventListener('click',function(){savePosition(null);});qs('#ltkPositionList').addEventListener('click',function(e){var edit=e.target.closest('[data-position-edit]'),del=e.target.closest('[data-position-delete]');if(edit)editPosition(edit.dataset.positionEdit);if(del)deletePosition(del.dataset.positionDelete);});
  }
  function renderPositions(){
    var list=qs('#ltkPositionList');if(!list||!state.catalog)return;
    list.innerHTML=(state.catalog.puestos||[]).map(function(p){return '<div class="ltk-position-row"><div><b>'+esc(p.nombre)+'</b><small>'+esc(p.descripcion||'Sin descripción')+' · '+esc(p.usuarios_asignados||0)+' usuario(s)</small></div><div class="ltk-position-row-actions"><button type="button" data-position-edit="'+esc(p.id)+'">Editar</button><button type="button" class="danger" data-position-delete="'+esc(p.id)+'">Eliminar</button></div></div>';}).join('')||'<div class="ltk-access-loading">No hay puestos registrados.</div>';
  }
  function openPositionsModal(){if(!canManageAccess()){deny();return;}ensurePositionsModal();renderPositions();qs('#ltkPositionsModal').classList.add('open');}
  function closePositionsModal(){var m=qs('#ltkPositionsModal');if(m)m.classList.remove('open');}
  async function savePosition(id,name,description){
    name=name==null?String(qs('#ltkPositionName').value||'').trim():String(name||'').trim();description=description==null?String(qs('#ltkPositionDescription').value||'').trim():String(description||'').trim();if(!name){toast('Falta el nombre','Escribe el nombre del puesto laboral.','warning');return;}
    try{var res=await client().rpc('rpc_admin_guardar_puesto',{p_puesto_id:id||null,p_nombre:name,p_descripcion:description});if(res.error)throw res.error;state.catalog=null;await loadCatalog(true);renderPositions();if(qs('#ltkPositionName'))qs('#ltkPositionName').value='';if(qs('#ltkPositionDescription'))qs('#ltkPositionDescription').value='';if(typeof window.lotekaLoadUsersCatalogSupabase==='function')window.lotekaLoadUsersCatalogSupabase();toast('Puesto guardado','El puesto laboral fue actualizado.','success');}catch(error){toast('No se pudo guardar',friendly(error),'error');}
  }
  function editPosition(id){var p=state.catalog&&state.catalog.puestos.find(function(x){return String(x.id)===String(id);});if(!p)return;var name=prompt('Nombre del puesto laboral:',p.nombre||'');if(name===null)return;var description=prompt('Descripción del puesto:',p.descripcion||'');if(description===null)return;savePosition(p.id,name,description);}
  async function deletePosition(id){var p=state.catalog&&state.catalog.puestos.find(function(x){return String(x.id)===String(id);});if(!p)return;if(!confirm('¿Eliminar el puesto "'+p.nombre+'"? Solo puede eliminarse si no tiene usuarios asignados.'))return;try{var res=await client().rpc('rpc_admin_eliminar_puesto',{p_puesto_id:p.id});if(res.error)throw res.error;state.catalog=null;await loadCatalog(true);renderPositions();if(typeof window.lotekaLoadUsersCatalogSupabase==='function')window.lotekaLoadUsersCatalogSupabase();toast('Puesto eliminado','El puesto laboral fue eliminado.','success');}catch(error){toast('No se pudo eliminar',friendly(error),'error');}}

  function boot(){
    if(!ensureUI()) return;
    updateAccessTabVisibility();
    var nav=qs('#navUsers');
    if(nav&&!nav.dataset.accessV307){
      nav.dataset.accessV307='1';
      nav.addEventListener('click',function(){
        setTimeout(function(){ ensureUI(); updateAccessTabVisibility(); },180);
      },true);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('load',function(){ setTimeout(function(){ ensureUI(); updateAccessTabVisibility(); },500); },{once:true});
  window.lotekaOpenAccessManager=function(){switchTab('permissions');};
  console.info('[LOTEKA] Parche 03B-1 · Perfiles, permisos y alcance por grupo instalado.');
})();

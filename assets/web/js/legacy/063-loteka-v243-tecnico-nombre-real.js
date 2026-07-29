
(function(){
  var profileCache=null, profilePromise=null;
  function clean(v){ return String(v||'').trim(); }
  function slug(v){ try{return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();}catch(e){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();} }
  function supa(){ return window.lotekaSupabase || window.supabaseClient || (window.supabase && window.__supabaseClient) || null; }
  function relName(p,k){ try{ var v=p&&p[k]; if(!v) return ''; if(Array.isArray(v)) return clean((v[0]&&v[0].nombre)||''); return clean(v.nombre||''); }catch(e){ return ''; } }
  function roleTxt(p){ return [p&&p.rol,p&&p.role,p&&p.departamento,relName(p,'roles'),relName(p,'puestos')].filter(Boolean).join(' '); }
  function isTech(p){ var t=roleTxt(p).toLowerCase(); var u=slug((p&&p.usuario_login)||''); var n=slug((p&&p.nombre_completo)||''); return t.indexOf('tecn')>=0 || u.indexOf('tecnico')>=0 || n.indexOf('tecnico')>=0; }
  function isEnc(p){ var t=roleTxt(p).toLowerCase(); return t.indexOf('encarg')>=0; }
  function profileName(p){ return clean((p&&p.nombre_completo)||(p&&p.nombre)||(p&&p.usuario_login)||(p&&p.correo)||(p&&p.email)||'Usuario'); }
  function aliases(p){ return [p&&p.nombre_completo,p&&p.nombre,p&&p.usuario_login,p&&p.usuario,p&&p.username,p&&p.correo,p&&p.email].map(clean).filter(Boolean); }
  function findProfile(value){ var raw=clean(value); if(!raw || !profileCache) return null; var s=slug(raw); return profileCache.find(function(p){ return aliases(p).some(function(a){ return slug(a)===s; }); }) || null; }
  async function loadProfiles(){
    if(profileCache) return profileCache;
    if(profilePromise) return profilePromise;
    profilePromise=(async function(){
      var c=supa(); if(!c || !c.from) return [];
      var r=await c.from('perfiles').select('id,nombre_completo,nombre,correo,email,usuario_login,telefono,telefono_whatsapp,departamento,activo,roles(nombre),puestos(nombre)').limit(1000);
      if(r.error){ var f=await c.from('perfiles').select('*').limit(1000); if(f.error) throw f.error; profileCache=f.data||[]; }
      else profileCache=r.data||[];
      return profileCache;
    })();
    return profilePromise;
  }
  function syncUsersFromProfiles(){
    try{
      if(!profileCache || !profileCache.length) return;
      var converted=profileCache.filter(function(p){ return p.activo!==false; }).map(function(p){
        return {name:profileName(p), username:clean(p.usuario_login)||slug(profileName(p)), area:relName(p,'puestos')||relName(p,'roles')||clean(p.departamento), phone:clean(p.telefono_whatsapp||p.telefono)};
      });
      if(converted.length){
        window.USERS=converted;
        try{ USERS=converted; }catch(e){}
        try{ localStorage.setItem('operations_catalog_users', JSON.stringify(converted)); }catch(e){}
      }
      if(typeof populateAdvancedReportDropdowns==='function') populateAdvancedReportDropdowns();
      ['operationTechnician','editOperationTechnician'].forEach(function(id){
        var el=document.getElementById(id); if(!el) return;
        var typeId=id==='editOperationTechnician'?'editOperationType':'operationType';
        var type=(document.getElementById(typeId)||{}).value || 'Avería';
        try{ if(typeof renderAssigneeOptions==='function') renderAssigneeOptions(id,type,el.value||''); }catch(e){}
      });
    }catch(e){ console.warn('[v243 nombres técnicos]', e); }
  }
  var originalDisplay=null;
  function installDisplayPatch(){
    try{
      if(typeof window.getAssigneeDisplayName==='function') return;
    }catch(e){}
    try{
      if(typeof getAssigneeDisplayName==='function' && !getAssigneeDisplayName.__v243){
        originalDisplay=getAssigneeDisplayName;
        getAssigneeDisplayName=function(value,type){
          var p=findProfile(value);
          if(p) return profileName(p);
          return originalDisplay(value,type);
        };
        getAssigneeDisplayName.__v243=true;
      }
    }catch(e){}
  }
  async function boot(){
    try{ await loadProfiles(); syncUsersFromProfiles(); installDisplayPatch(); if(typeof renderOperations==='function') renderOperations(); }catch(e){ console.warn('[v243 perfiles]', e&&e.message?e.message:e); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  var tries=0; var timer=setInterval(function(){ tries++; installDisplayPatch(); syncUsersFromProfiles(); if(tries>8) clearInterval(timer); },1200);
})();

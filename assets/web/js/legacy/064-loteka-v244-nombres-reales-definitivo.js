
(function(){
  var profileCache = [];
  var loaded = false;
  var loading = null;

  function txt(v){ return String(v == null ? '' : v).trim(); }
  function slug(v){
    try{
      return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();
    }catch(e){ return txt(v).toLowerCase().replace(/[^a-z0-9]+/g,'').trim(); }
  }
  function supa(){
    return window.lotekaSupabase || window.supabaseClient || window.sb || window.supabase || null;
  }
  function relName(p,k){
    try{ var v=p && p[k]; if(!v) return ''; if(Array.isArray(v)) return txt(v[0] && v[0].nombre); return txt(v.nombre); }catch(e){ return ''; }
  }
  function profileName(p){
    return txt((p && p.nombre_completo) || (p && p.nombre) || (p && p.display_name) || (p && p.correo) || (p && p.email) || (p && p.usuario_login) || 'Usuario');
  }
  function profileRole(p){
    return [p&&p.rol,p&&p.role,p&&p.departamento,relName(p,'roles'),relName(p,'puestos')].map(txt).filter(Boolean).join(' ');
  }
  function isActive(p){ return !p || p.activo !== false; }
  function aliases(p){
    return [
      p&&p.id,
      p&&p.nombre_completo,
      p&&p.nombre,
      p&&p.display_name,
      p&&p.usuario_login,
      p&&p.usuario,
      p&&p.username,
      p&&p.correo,
      p&&p.email
    ].map(txt).filter(Boolean);
  }
  function looksDemo(v){
    var s=slug(v);
    return /^(tecnico|tecnico1|tecnico2|encargado|encargado1|encargado2)$/.test(s) || /^tecnico[0-9]+$/.test(s) || /^encargado[0-9]+$/.test(s);
  }
  function findProfile(value){
    var raw=txt(value); if(!raw || !profileCache.length) return null;
    var s=slug(raw);
    var direct = profileCache.find(function(p){
      if(!isActive(p)) return false;
      return aliases(p).some(function(a){ return slug(a) === s; });
    });
    if(direct) return direct;

    // Puente definitivo para demos viejos: "Técnico 1" => usuario_login "tecnico1", etc.
    var compact = s.replace(/^(tecnico|encargado)0+/, '$1');
    direct = profileCache.find(function(p){
      if(!isActive(p)) return false;
      var a = aliases(p).map(slug);
      return a.indexOf(compact) >= 0;
    });
    if(direct) return direct;

    // Si queda un alias viejo sin match exacto, busca por rol y número, pero sin inventar si hay muchos.
    var m = compact.match(/^(tecnico|encargado)(\d+)$/);
    if(m){
      var roleWord=m[1], num=m[2];
      var candidates=profileCache.filter(function(p){
        if(!isActive(p)) return false;
        var role=slug(profileRole(p));
        var ali=aliases(p).map(slug).join(' ');
        return role.indexOf(roleWord)>=0 || ali.indexOf(roleWord)>=0;
      });
      var exact=candidates.find(function(p){ return aliases(p).map(slug).some(function(a){ return a===roleWord+num; }); });
      if(exact) return exact;
      if(candidates.length===1) return candidates[0];
    }
    return null;
  }
  function resolveName(value, type){
    var raw=txt(value);
    if(!raw || raw.toLowerCase()==='sin asignar') return 'Sin asignar';
    var p=findProfile(raw);
    if(p) return profileName(p);
    // Si todavía es un demo, no lo mostramos como nombre final.
    if(looksDemo(raw)) return 'Usuario no identificado';
    return raw;
  }
  async function loadProfiles(){
    if(loaded) return profileCache;
    if(loading) return loading;
    loading=(async function(){
      try{
        var c=supa();
        if(c && c.from){
          var r=await c.from('perfiles').select('id,nombre_completo,nombre,display_name,correo,email,usuario_login,usuario,username,telefono,telefono_whatsapp,departamento,rol,role,activo,roles(nombre),puestos(nombre)').limit(2000);
          if(r && r.error){
            var f=await c.from('perfiles').select('*').limit(2000);
            if(!f.error) profileCache=f.data||[];
          }else if(r){ profileCache=r.data||[]; }
        }
      }catch(e){ console.warn('[v244 nombres reales] No pude cargar perfiles:', e && e.message ? e.message : e); }
      loaded=true;
      return profileCache;
    })();
    return loading;
  }
  function patchGlobals(){
    try{
      window.lotekaResolveRealUserName = resolveName;
      var prevAssignee = window.getAssigneeDisplayName || (typeof getAssigneeDisplayName === 'function' ? getAssigneeDisplayName : null);
      var patched=function(value,type){
        var real=resolveName(value,type);
        if(real && real !== 'Usuario no identificado') return real;
        if(prevAssignee){
          var old=prevAssignee(value,type);
          var fixed=resolveName(old,type);
          if(fixed && fixed !== 'Usuario no identificado') return fixed;
        }
        return real || 'Sin asignar';
      };
      patched.__v244=true;
      window.getAssigneeDisplayName = patched;
      try{ getAssigneeDisplayName = patched; }catch(e){}
    }catch(e){ console.warn('[v244 nombres reales] patchGlobals:', e); }
  }
  function updateUsersCatalogRuntime(){
    try{
      if(!profileCache.length) return;
      var converted=profileCache.filter(isActive).map(function(p){
        return {
          name: profileName(p),
          username: txt(p.usuario_login || p.usuario || p.username) || slug(profileName(p)),
          area: relName(p,'puestos') || relName(p,'roles') || txt(p.departamento || p.rol || p.role),
          phone: txt(p.telefono_whatsapp || p.telefono)
        };
      });
      if(converted.length){
        window.USERS = converted;
        try{ USERS = converted; }catch(e){}
      }
    }catch(e){}
  }
  function patchSelects(){
    try{
      document.querySelectorAll('select option').forEach(function(opt){
        var p=findProfile(opt.value) || findProfile(opt.textContent);
        if(p) opt.textContent = profileName(p);
      });
    }catch(e){}
  }
  function replaceTextNodes(root){
    try{
      root = root || document.body;
      var walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode:function(node){
          var parent=node.parentElement;
          if(!parent) return NodeFilter.FILTER_REJECT;
          var tag=(parent.tagName||'').toLowerCase();
          if(['script','style','textarea','input'].indexOf(tag)>=0) return NodeFilter.FILTER_REJECT;
          var v=node.nodeValue || '';
          return /(T[eé]cnico\s*1|T[eé]cnico\s*2|tecnico1|tecnico2|Encargado\s*1|encargado1)/i.test(v) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function(n){
        var v=n.nodeValue;
        [['Técnico 1','tecnico1'],['Tecnico 1','tecnico1'],['tecnico1','tecnico1'],['Técnico 2','tecnico2'],['Tecnico 2','tecnico2'],['tecnico2','tecnico2'],['Encargado 1','encargado1'],['encargado1','encargado1']].forEach(function(pair){
          var real=resolveName(pair[1]);
          if(real && real !== 'Usuario no identificado'){
            v=v.replace(new RegExp(pair[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'), real);
          }
        });
        n.nodeValue=v;
      });
    }catch(e){}
  }
  function cleanVisibleNames(){ patchSelects(); replaceTextNodes(document.body); }
  function wrapRenderers(){
    ['renderOperations','renderDashboard','showDetail','renderReports','renderOwnerReports','renderAgencyReports'].forEach(function(name){
      try{
        var fn=window[name] || (typeof globalThis[name] === 'function' ? globalThis[name] : null);
        if(!fn || fn.__v244Names) return;
        var wrapped=function(){
          var res=fn.apply(this, arguments);
          setTimeout(cleanVisibleNames, 60);
          setTimeout(cleanVisibleNames, 250);
          return res;
        };
        wrapped.__v244Names=true;
        window[name]=wrapped;
        try{ globalThis[name]=wrapped; }catch(e){}
      }catch(e){}
    });
  }
  async function boot(){
    await loadProfiles();
    updateUsersCatalogRuntime();
    patchGlobals();
    wrapRenderers();
    cleanVisibleNames();
    try{ if(typeof renderOperations==='function') renderOperations(); }catch(e){}
    try{ if(typeof renderDashboard==='function') renderDashboard(); }catch(e){}
    setTimeout(cleanVisibleNames, 600);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  var n=0, timer=setInterval(function(){ n++; patchGlobals(); wrapRenderers(); cleanVisibleNames(); if(n>12) clearInterval(timer); }, 900);
})();

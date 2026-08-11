(function(){
  'use strict';
  if(window.__lotekaNoAutoHomeV246) return;
  window.__lotekaNoAutoHomeV246 = true;

  var KEY = 'loteka_current_ops_route_v246';
  var LEGACY = ['loteka_current_ops_route_v236','loteka_current_ops_route_v234','loteka_active_view_v234','loteka_last_active_view'];
  var MANUAL_HOME_UNTIL = 0;
  var LAST_ROUTE = '';
  var ROUTES = ['dashboard','operations','levantamientos','history','reports','reportsAgency','reportsOwner','reportsSpecific','users','suppliers','works','issues','inventory','almacenes','agencias','rrhh','announcements','anuncios'];

  function set(k,v){try{sessionStorage.setItem(k,v);}catch(e){}}
  function get(k){try{return sessionStorage.getItem(k)||'';}catch(e){return '';}}
  function clear(k){try{sessionStorage.removeItem(k);}catch(e){}}
  function isVisible(id){
    var n=document.getElementById(id);
    if(!n || n.classList.contains('hidden') || n.closest('.hidden')) return false;
    try{
      var style=window.getComputedStyle(n);
      if(style.display==='none' || style.visibility==='hidden') return false;
    }catch(e){}
    return true;
  }
  function currentRoute(){
    // El Levantamientos actual usa vista-ops-levantamientos, no levantamientosView.
    // Se evalúa antes que contenedores legacy para evitar guardar "operations".
    if(isVisible('vista-ops-levantamientos')) return 'levantamientos';
    if(isVisible('levantamientosView')) return 'levantamientos';
    if(isVisible('operationsView')) return 'operations';
    if(isVisible('historyView')) return 'history';
    if(isVisible('reportsView')) return 'reports';
    if(isVisible('reportsAgencyView')) return 'reportsAgency';
    if(isVisible('reportsOwnerView')) return 'reportsOwner';
    if(isVisible('reportsSpecificView')) return 'reportsSpecific';
    if(isVisible('usersView')) return 'users';
    if(isVisible('suppliersView')) return 'suppliers';
    if(isVisible('worksView')) return 'works';
    if(isVisible('issuesView')) return 'issues';
    if(isVisible('dashboardView')) return 'dashboard';
    return '';
  }
  function save(route){
    if(!route || ROUTES.indexOf(route)<0) return;
    LAST_ROUTE = route;
    set(KEY, route);
    LEGACY.forEach(function(k){try{sessionStorage.removeItem(k);localStorage.removeItem(k);}catch(e){}});
  }
  function last(){return LAST_ROUTE || get(KEY) || '';}
  function clearSessionRoute(){ LAST_ROUTE=''; clear(KEY); }
  function isHomeClickTarget(el){
    if(!el || !el.closest) return false;
    if(el.closest('#navHome,.sidebar-home-link')) return true;
    var btn=el.closest('button,a'); if(!btn) return false;
    var txt=String(btn.textContent||'').trim().toLowerCase();
    var oc=String(btn.getAttribute('onclick')||'').toLowerCase();
    return txt==='inicio' || txt==='home' || (oc.indexOf('dashboard')>=0 && (txt.indexOf('inicio')>=0 || txt.indexOf('home')>=0));
  }
  function markManualHome(){MANUAL_HOME_UNTIL=Date.now()+1800;}
  function manualHome(){return Date.now()<MANUAL_HOME_UNTIL;}

  function openRoute(route){
    if(!route || route==='dashboard' || ROUTES.indexOf(route)<0) return false;
    try{
      if(route==='levantamientos' && window.GOLevantamientosGrupos && typeof window.GOLevantamientosGrupos.open==='function'){
        window.GOLevantamientosGrupos.open(document.getElementById('navLevantamientos'));
      } else if(typeof window.showView==='function') window.showView(route);
      else if(typeof window.lotekaOpsDashGo==='function') window.lotekaOpsDashGo(route);
      else if(typeof window.cambiarVista==='function') window.cambiarVista(route,null);
      return true;
    }catch(e){console.warn('[LOTEKA] Ruta no restaurada:',route,e);return false;}
  }
  function patch(name){
    var fn=window[name];
    if(typeof fn!=='function' || fn.__noAutoHomeV246) return;
    var wrapped=function(){
      var target=arguments && arguments.length ? String(arguments[0]||'') : '';
      var cur=currentRoute() || last();
      var isHome = target==='home' || target==='dashboard';
      if(isHome && !manualHome() && cur && cur!=='dashboard') return false;
      var r=fn.apply(this,arguments);
      setTimeout(function(){save(currentRoute() || target || cur);},90);
      return r;
    };
    wrapped.__noAutoHomeV246=true;
    window[name]=wrapped;
    try{ if(name==='showView') showView=wrapped; }catch(e){}
    try{ if(name==='cambiarVista') cambiarVista=wrapped; }catch(e){}
    try{ if(name==='abrirVistaOperaciones') abrirVistaOperaciones=wrapped; }catch(e){}
  }
  function bind(){
    ['showView','cambiarVista','abrirVistaOperaciones','lotekaOpsDashGo'].forEach(patch);
    var cur=currentRoute(); if(cur) save(cur);
  }
  function installSessionCleanup(){
    try{
      if(window.GOApp && window.GOApp.__phase2aRuntime && window.GOApp.events){
        window.GOApp.events.on('auth:signed-out', clearSessionRoute);
      }
    }catch(e){}
  }
  document.addEventListener('pointerdown',function(ev){if(isHomeClickTarget(ev.target)) markManualHome();},true);
  document.addEventListener('click',function(ev){
    if(isHomeClickTarget(ev.target)) markManualHome();
    setTimeout(function(){var cur=currentRoute(); if(cur) save(cur);},120);
  },true);
  document.addEventListener('visibilitychange',function(){
    // Guardar sí; navegar/restaurar no.
    var cur=currentRoute(); if(cur) save(cur);
    if(!document.hidden) setTimeout(bind,120);
  });
  window.addEventListener('focus',function(){setTimeout(bind,120);});
  window.addEventListener('pageshow',function(){setTimeout(bind,120);});
  installSessionCleanup();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
  setTimeout(bind,600);setTimeout(bind,1500);
})();

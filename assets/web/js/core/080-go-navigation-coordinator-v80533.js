(function(global){
  'use strict';

  var VERSION='805.33.0';
  if(global.GONavigationCoordinator && global.GONavigationCoordinator.version===VERSION) return;

  var CUSTOM={
    'ops-rutas':{viewId:'vista-ops-rutas',navId:'navRoutesCoverage',open:function(nav){
      if(global.GOOperationalRoutes&&typeof global.GOOperationalRoutes.open==='function') return global.GOOperationalRoutes.open(nav);
      return showOnly('vista-ops-rutas',nav);
    }},
    'ops-control-tecnico':{viewId:'vista-ops-control-tecnico',navId:'navControlTecnico',open:function(nav){
      if(global.GOControlTecnico&&typeof global.GOControlTecnico.open==='function') return global.GOControlTecnico.open(nav);
      return showOnly('vista-ops-control-tecnico',nav);
    }},
    'ops-mantenimiento':{viewId:'vista-ops-mantenimiento',navId:'navPreventiveMaintenance',open:function(nav){
      if(global.GOMantenimientoPreventivo&&typeof global.GOMantenimientoPreventivo.open==='function') return global.GOMantenimientoPreventivo.open(nav);
      return showOnly('vista-ops-mantenimiento',nav);
    }}
  };

  function allViews(){return Array.prototype.slice.call(document.querySelectorAll('[id^="vista-"]'));}
  function hideView(node){
    if(!node) return;
    node.classList.add('hidden');
    node.setAttribute('aria-hidden','true');
    node.style.setProperty('display','none','important');
  }
  function showViewNode(node){
    if(!node) return false;
    node.classList.remove('hidden');
    node.setAttribute('aria-hidden','false');
    node.style.setProperty('display','block','important');
    return true;
  }
  function clearActive(){document.querySelectorAll('.sidebar-link').forEach(function(link){link.classList.remove('active');});}
  function activate(nav){
    clearActive();
    if(nav&&nav.classList) nav.classList.add('active');
    try{if(typeof global.setSidebarSectionOpen==='function')global.setSidebarSectionOpen('operaciones',true);}catch(_e){}
  }
  function showOnly(viewId,nav){
    allViews().forEach(function(v){if(v.id!==viewId)hideView(v);});
    var target=document.getElementById(viewId);
    showViewNode(target);
    activate(nav);
    try{global.scrollTo({top:0,behavior:'smooth'});}catch(_e){try{global.scrollTo(0,0);}catch(__e){}}
    return !!target;
  }
  function hideCustomExcept(viewName){
    Object.keys(CUSTOM).forEach(function(key){
      if(key!==viewName) hideView(document.getElementById(CUSTOM[key].viewId));
    });
  }
  function openCustom(name,nav){
    var cfg=CUSTOM[name];
    if(!cfg) return false;
    // Oculta primero TODAS las vistas. Esto evita superposición incluso si el módulo
    // tiene un display:inline !important heredado de un hotfix anterior.
    allViews().forEach(hideView);
    var link=nav||document.getElementById(cfg.navId);
    var result;
    try{result=cfg.open(link);}catch(error){console.error('[Navigation Coordinator] No se pudo abrir '+name,error);}
    showOnly(cfg.viewId,link);
    return result===undefined?true:result;
  }

  function installCambiarVistaWrapper(){
    var current=global.cambiarVista;
    if(typeof current!=='function'||current.__goNavCoordinator) return;
    function wrapped(vista,el){
      var name=String(vista||'');
      if(CUSTOM[name]) return openCustom(name,el);
      hideCustomExcept(name);
      // Fuerza exclusividad antes y después del navegador legado.
      allViews().forEach(hideView);
      var result=current.apply(this,arguments);
      var target=document.getElementById('vista-'+name);
      if(target){showOnly(target.id,el);}
      return result;
    }
    wrapped.__goNavCoordinator=true;
    wrapped.__goNavPrevious=current;
    global.cambiarVista=wrapped;
    try{cambiarVista=wrapped;}catch(_e){}
  }

  function installOperationsWrapper(){
    var current=global.abrirVistaOperaciones;
    if(typeof current!=='function'||current.__goNavCoordinator) return;
    function wrapped(nombreVista,vistaWrapper,el){
      var alias=String(vistaWrapper||nombreVista||'');
      if(CUSTOM[alias]) return openCustom(alias,el);
      hideCustomExcept('');
      allViews().forEach(hideView);
      var result=current.apply(this,arguments);
      var id=alias.indexOf('vista-')===0?alias:'vista-'+alias;
      var target=document.getElementById(id);
      if(target){showOnly(id,el);}
      return result;
    }
    wrapped.__goNavCoordinator=true;
    wrapped.__goNavPrevious=current;
    global.abrirVistaOperaciones=wrapped;
    try{abrirVistaOperaciones=wrapped;}catch(_e){}
  }

  function findNavTarget(target){
    if(!target||!target.closest) return null;
    return target.closest('#navRoutesCoverage,#navControlTecnico,#navPreventiveMaintenance');
  }
  function handleSidebarClick(event){
    var nav=findNavTarget(event.target);
    if(!nav) return;
    var name=nav.id==='navRoutesCoverage'?'ops-rutas':nav.id==='navControlTecnico'?'ops-control-tecnico':'ops-mantenimiento';
    event.preventDefault();
    event.stopPropagation();
    if(event.stopImmediatePropagation)event.stopImmediatePropagation();
    openCustom(name,nav);
  }

  function ensureExclusiveVisibleView(){
    var visible=allViews().filter(function(v){
      var style=global.getComputedStyle?global.getComputedStyle(v):null;
      return !v.classList.contains('hidden')&&(!style||style.display!=='none');
    });
    if(visible.length<=1) return;
    // Conserva la vista cuyo enlace está activo; si no existe, conserva la última visible.
    var active=document.querySelector('.sidebar-link.active');
    var preferred=null;
    if(active){
      if(active.id==='navRoutesCoverage')preferred=document.getElementById('vista-ops-rutas');
      else if(active.id==='navControlTecnico')preferred=document.getElementById('vista-ops-control-tecnico');
      else if(active.id==='navPreventiveMaintenance')preferred=document.getElementById('vista-ops-mantenimiento');
    }
    preferred=preferred||visible[visible.length-1];
    visible.forEach(function(v){if(v!==preferred)hideView(v);});
    showViewNode(preferred);
  }

  function install(){
    installCambiarVistaWrapper();
    installOperationsWrapper();
    document.removeEventListener('click',handleSidebarClick,true);
    document.addEventListener('click',handleSidebarClick,true);
    setTimeout(ensureExclusiveVisibleView,0);
  }

  global.GONavigationCoordinator={
    version:VERSION,
    install:install,
    open:openCustom,
    showOnly:showOnly,
    diagnostics:function(){
      return {
        version:VERSION,
        views:allViews().map(function(v){return{id:v.id,hidden:v.classList.contains('hidden'),display:(global.getComputedStyle?global.getComputedStyle(v).display:'')};}),
        cambiarVistaWrapped:!!(global.cambiarVista&&global.cambiarVista.__goNavCoordinator),
        abrirVistaOperacionesWrapped:!!(global.abrirVistaOperaciones&&global.abrirVistaOperaciones.__goNavCoordinator)
      };
    }
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  // Algunos scripts antiguos reemplazan las funciones después de DOMContentLoaded.
  // Reinstalamos de forma limitada, sin temporizador permanente.
  setTimeout(install,250);
  setTimeout(install,900);
  setTimeout(install,1800);
})(window);

(function(global){
'use strict';

if(global.GONavigationCoordinator && global.GONavigationCoordinator.version === '805.33B') return;

var VERSION = '805.33B';
var current = null;

var viewMap = {
  navOperations: 'vista-ops-operaciones',
  navLevantamientos: 'vista-ops-levantamientos',
  navPreventiveMaintenance: 'vista-ops-mantenimiento',
  navControlTecnico: 'vista-ops-control-tecnico',
  navRoutesCoverage: 'vista-ops-rutas',
  navHistory: 'vista-ops-historial',
  navRendimientoOperativo: 'vista-ops-rendimiento'
};

var customModules = {
  navPreventiveMaintenance: function(link){
    if(global.GOMantenimientoPreventivo && typeof global.GOMantenimientoPreventivo.open === 'function') {
      global.GOMantenimientoPreventivo.open(link);
      return true;
    }
    return false;
  },
  navControlTecnico: function(link){
    if(global.GOControlTecnico && typeof global.GOControlTecnico.open === 'function') {
      global.GOControlTecnico.open(link);
      return true;
    }
    return false;
  },
  navRoutesCoverage: function(link){
    if(global.GOOperationalRoutes && typeof global.GOOperationalRoutes.open === 'function') {
      global.GOOperationalRoutes.open(link);
      return true;
    }
    return false;
  }
};

function views(){
  return Array.prototype.slice.call(document.querySelectorAll('[id^="vista-"]'));
}

function links(){
  return Array.prototype.slice.call(document.querySelectorAll('.sidebar-link'));
}

function isHidden(node){
  return !node || node.classList.contains('hidden') || global.getComputedStyle(node).display === 'none';
}

function hide(node){
  if(!node) return;
  if(!node.classList.contains('hidden')) node.classList.add('hidden');
  node.setAttribute('aria-hidden','true');
  if(node.style.getPropertyValue('display') !== 'none' || node.style.getPropertyPriority('display') !== 'important') {
    node.style.setProperty('display','none','important');
  }
}

function reveal(node){
  if(!node) return false;
  node.classList.remove('hidden');
  node.setAttribute('aria-hidden','false');
  node.style.setProperty('display','block','important');
  return true;
}

function markActive(link){
  links().forEach(function(item){ item.classList.remove('active'); });
  if(link) link.classList.add('active');
}

function show(viewId,link){
  var target = document.getElementById(viewId);
  if(!target) return false;

  views().forEach(function(view){
    if(view !== target) hide(view);
  });
  reveal(target);
  markActive(link || null);
  current = viewId;

  try {
    if(/^vista-ops-/.test(viewId) && typeof global.setSidebarSectionOpen === 'function') {
      global.setSidebarSectionOpen('operaciones',true);
    }
  } catch(_error) {}

  /* Una verificación única; no usa MutationObserver ni ciclos permanentes. */
  global.setTimeout(function(){
    views().forEach(function(view){
      if(view !== target) hide(view);
    });
    reveal(target);
  },60);

  return true;
}

function handleCapture(event){
  var link = event.target && event.target.closest ? event.target.closest('.sidebar-link') : null;
  if(!link || !customModules[link.id]) return;

  /* Evita que varios parches antiguos procesen el mismo clic. */
  event.preventDefault();
  event.stopImmediatePropagation();

  try {
    if(!customModules[link.id](link)) {
      show(viewMap[link.id],link);
    }
  } catch(error) {
    console.error('[Navegación] Error abriendo '+link.id,error);
    show(viewMap[link.id],link);
  }
}

function handleBubble(event){
  var link = event.target && event.target.closest ? event.target.closest('.sidebar-link') : null;
  if(!link || !viewMap[link.id] || customModules[link.id]) return;

  /* Permite que el módulo antiguo cargue sus datos y luego normaliza la vista. */
  global.setTimeout(function(){ show(viewMap[link.id],link); },0);
  global.setTimeout(function(){ show(viewMap[link.id],link); },90);
}

function init(){
  document.addEventListener('click',handleCapture,true);
  document.addEventListener('click',handleBubble,false);
}

global.GONavigationCoordinator = {
  version: VERSION,
  show: show,
  hideAll: function(){ views().forEach(hide); current=null; },
  current: function(){ return current; },
  diagnostics: function(){
    return {
      version: VERSION,
      current: current,
      visible: views().filter(function(view){ return !isHidden(view); }).map(function(view){ return view.id; }),
      coordinatorScript: document.querySelector('script[src*="080-go-navigation-coordinator"]')?.getAttribute('src') || null
    };
  }
};

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})(window);

(function(global){
'use strict';
if(global.GONavigationCoordinator&&global.GONavigationCoordinator.version==='805.33A')return;
var VERSION='805.33A';
var viewMap={
  navOperations:'vista-ops-operaciones',
  navLevantamientos:'vista-ops-levantamientos',
  navPreventiveMaintenance:'vista-ops-mantenimiento',
  navControlTecnico:'vista-ops-control-tecnico',
  navRoutesCoverage:'vista-ops-rutas',
  navHistory:'vista-ops-historial',
  navRendimientoOperativo:'vista-ops-rendimiento'
};
var current=null,guard=false;
function allViews(){return Array.prototype.slice.call(document.querySelectorAll('[id^="vista-"]'));}
function allLinks(){return Array.prototype.slice.call(document.querySelectorAll('.sidebar-link'));}
function hide(node){if(!node)return;node.classList.add('hidden');node.setAttribute('aria-hidden','true');node.style.setProperty('display','none','important');}
function reveal(node){if(!node)return false;node.classList.remove('hidden');node.setAttribute('aria-hidden','false');node.style.setProperty('display','block','important');return true;}
function show(viewId,link){
  var target=document.getElementById(viewId);if(!target)return false;
  guard=true;allViews().forEach(hide);reveal(target);allLinks().forEach(function(x){x.classList.remove('active')});if(link)link.classList.add('active');
  current=viewId;
  try{if(/^vista-ops-/.test(viewId)&&typeof global.setSidebarSectionOpen==='function')global.setSidebarSectionOpen('operaciones',true);}catch(_e){}
  setTimeout(function(){allViews().forEach(function(v){if(v!==target)hide(v)});reveal(target);guard=false;},0);
  setTimeout(function(){allViews().forEach(function(v){if(v!==target)hide(v)});reveal(target);},80);
  return true;
}
function viewForLink(link){return link&&viewMap[link.id]||null;}
function bindLinks(){Object.keys(viewMap).forEach(function(id){var link=document.getElementById(id);if(!link||link.dataset.goNavBound==='1')return;link.dataset.goNavBound='1';link.addEventListener('click',function(){var v=viewMap[id];setTimeout(function(){show(v,link)},0);setTimeout(function(){show(v,link)},120);},true);});}
function watch(){
  var observer=new MutationObserver(function(){if(guard||!current)return;var target=document.getElementById(current);if(!target)return;allViews().forEach(function(v){if(v!==target&&(getComputedStyle(v).display!=='none'||!v.classList.contains('hidden')))hide(v)});if(getComputedStyle(target).display==='none'||target.classList.contains('hidden'))reveal(target);bindLinks();});
  observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class','style'],childList:true});
}
function wrapLegacy(){
  var original=global.abrirVistaOperaciones;
  if(typeof original==='function'&&!original.__goNavWrapped){var wrapped=function(tipo,vista,el){var out=original.apply(this,arguments);var id='vista-'+String(vista||'').replace(/^vista-/,'');setTimeout(function(){show(id,el)},0);return out};wrapped.__goNavWrapped=true;global.abrirVistaOperaciones=wrapped;try{abrirVistaOperaciones=wrapped}catch(_e){}}
  var oldChange=global.cambiarVista;
  if(typeof oldChange==='function'&&!oldChange.__goNavWrapped){var change=function(vista,el){var out=oldChange.apply(this,arguments);var id='vista-'+String(vista||'').replace(/^vista-/,'');if(document.getElementById(id))setTimeout(function(){show(id,el)},0);return out};change.__goNavWrapped=true;global.cambiarVista=change;try{cambiarVista=change}catch(_e){}}
}
function init(){bindLinks();wrapLegacy();watch();setTimeout(bindLinks,500);}
global.GONavigationCoordinator={version:VERSION,show:show,hideAll:function(){allViews().forEach(hide);current=null},current:function(){return current},diagnostics:function(){return{version:VERSION,current:current,visible:allViews().filter(function(v){return getComputedStyle(v).display!=='none'&&!v.classList.contains('hidden')}).map(function(v){return v.id})}}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);

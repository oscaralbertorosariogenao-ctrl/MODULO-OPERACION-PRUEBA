
(function(){
  'use strict';

  function byId(id){ return document.getElementById(id); }
  function safe(fn){ try{ return fn && fn(); }catch(err){ console.warn('[LOTEKA v162 Operaciones]', err); } }

  var OPS_MAP = {
    dashboard:      { wrapperId:'vista-ops-dashboard',      innerId:'dashboardView',      navId:'navDashboard',       render:['renderDashboard'] },
    operations:     { wrapperId:'vista-ops-operaciones',    innerId:'operationsView',     navId:'navOperations',      render:['renderOperations'] },
    levantamientos: { wrapperId:'vista-ops-levantamientos', innerId:'levantamientosView', navId:'navLevantamientos',  render:['levRender'] },
    history:        { wrapperId:'vista-ops-historial',      innerId:'historyView',        navId:'navHistory',         render:['renderHistory'] }
  };

  var OPS_WRAPPER_BY_ALIAS = {
    'ops-dashboard':'dashboard',
    'dashboard':'dashboard',
    'ops-operaciones':'operations',
    'operations':'operations',
    'ops-levantamientos':'levantamientos',
    'levantamientos':'levantamientos',
    'ops-historial':'history',
    'history':'history'
  };

  function findKey(viewName, wrapper){
    var raw = String(viewName || '').trim();
    var wrap = String(wrapper || '').trim();
    return OPS_WRAPPER_BY_ALIAS[raw] || OPS_WRAPPER_BY_ALIAS[wrap] || 'dashboard';
  }

  function hideMainViews(){
    document.querySelectorAll('[id^="vista-"]').forEach(function(node){
      if(node && node.classList) node.classList.add('hidden');
    });
  }

  function hideOpsInnerViews(){
    [
      'dashboardView','operationsView','levantamientosView','historyView',
      'reportsView','reportsAgencyView','reportsOwnerView','reportsSpecificView',
      'usersView','suppliersView','worksView','issuesView'
    ].forEach(function(id){
      var node = byId(id);
      if(node && node.classList) node.classList.add('hidden');
    });
  }

  function openOnlyOperationsGroup(){
    document.querySelectorAll('.sidebar-group').forEach(function(group){
      if(group && group.classList) group.classList.toggle('is-open', group.dataset && group.dataset.section === 'operaciones');
    });
  }

  function setActive(navId){
    document.querySelectorAll('.sidebar-link').forEach(function(link){
      if(link && link.classList) link.classList.remove('active');
    });
    var nav = byId(navId);
    if(nav && nav.classList) nav.classList.add('active');
  }

  function renderFor(cfg){
    (cfg.render || []).forEach(function(name){
      safe(function(){ if(name && typeof window[name] === 'function') window[name](); });
    });
  }

  function openOps(key){
    key = OPS_MAP[key] ? key : 'dashboard';
    var cfg = OPS_MAP[key];

    hideMainViews();
    hideOpsInnerViews();

    var wrapper = byId(cfg.wrapperId);
    var inner = byId(cfg.innerId);

    if(wrapper && wrapper.classList) wrapper.classList.remove('hidden');
    if(inner && inner.classList) inner.classList.remove('hidden');

    openOnlyOperationsGroup();
    setActive(cfg.navId);

    renderFor(cfg);
    setTimeout(function(){ renderFor(cfg); }, 90);
    setTimeout(function(){ renderFor(cfg); }, 350);

    safe(function(){ window.scrollTo({ top:0, behavior:'smooth' }); });
    return false;
  }

  window.lotekaAbrirOperacionesV162 = openOps;

  var originalAbrirVistaOperaciones = window.abrirVistaOperaciones;
  window.abrirVistaOperaciones = function(nombreVista, vistaWrapper, el){
    var key = findKey(nombreVista, vistaWrapper);
    var isOps = !!OPS_WRAPPER_BY_ALIAS[String(nombreVista || '').trim()] || !!OPS_WRAPPER_BY_ALIAS[String(vistaWrapper || '').trim()];
    if(isOps){
      return openOps(key);
    }
    if(typeof originalAbrirVistaOperaciones === 'function'){
      return originalAbrirVistaOperaciones.apply(this, arguments);
    }
    return false;
  };
  try{ abrirVistaOperaciones = window.abrirVistaOperaciones; }catch(e){}

  function bindOperationsClicks(){
    var btn = document.querySelector('.sidebar-group[data-section="operaciones"] .sidebar-group-btn');
    if(btn){
      btn.onclick = function(ev){
        if(ev){ ev.preventDefault(); ev.stopPropagation(); }
        var group = document.querySelector('.sidebar-group[data-section="operaciones"]');
        var isOpen = group && group.classList && group.classList.contains('is-open');
        document.querySelectorAll('.sidebar-group').forEach(function(g){
          if(g && g.classList) g.classList.remove('is-open');
        });
        if(group && group.classList && !isOpen) group.classList.add('is-open');
        return false;
      };
    }

    [
      ['navDashboard','dashboard'],
      ['navOperations','operations'],
      ['navLevantamientos','levantamientos'],
      ['navHistory','history']
    ].forEach(function(pair){
      var node = byId(pair[0]);
      if(!node) return;
      node.onclick = function(ev){
        if(ev){ ev.preventDefault(); ev.stopPropagation(); }
        return openOps(pair[1]);
      };
    });
  }

  document.addEventListener('click', function(ev){
    var node = ev.target && ev.target.closest ? ev.target.closest('#navDashboard,#navOperations,#navLevantamientos,#navHistory') : null;
    if(!node) return;
    ev.preventDefault();
    ev.stopPropagation();
    if(node.id === 'navOperations') return openOps('operations');
    if(node.id === 'navLevantamientos') return openOps('levantamientos');
    if(node.id === 'navHistory') return openOps('history');
    return openOps('dashboard');
  }, true);

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindOperationsClicks);
  else bindOperationsClicks();
  window.addEventListener('load', function(){ setTimeout(bindOperationsClicks, 250); setTimeout(bindOperationsClicks, 1000); });
})();

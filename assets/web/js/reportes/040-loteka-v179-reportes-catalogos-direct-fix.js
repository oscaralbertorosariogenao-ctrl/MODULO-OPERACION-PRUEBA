
(function(){
  'use strict';

  var OPS_INNER_VIEWS = [
    'dashboardView','operationsView','levantamientosView','historyView',
    'reportsView','reportsAgencyView','reportsOwnerView','reportsSpecificView',
    'usersView','suppliersView','worksView','issuesView'
  ];

  var ROUTES = {
    navReports:         { section:'reportes',  wrapper:'vista-ops-reportes',             inner:'reportsView',         render:function(){ if(typeof window.renderReports === 'function') window.renderReports(); } },
    navReportsAgency:   { section:'reportes',  wrapper:'vista-ops-reportes-agencia',     inner:'reportsAgencyView',   render:function(){ if(typeof window.renderAgencyReports === 'function') window.renderAgencyReports(); } },
    navReportsOwner:    { section:'reportes',  wrapper:'vista-ops-reportes-responsable', inner:'reportsOwnerView',    render:function(){ if(typeof window.renderOwnerReports === 'function') window.renderOwnerReports(); } },
    navReportsSpecific: { section:'reportes',  wrapper:'vista-ops-reportes-tipos',       inner:'reportsSpecificView', render:function(){ if(typeof window.renderSpecificReports === 'function') window.renderSpecificReports(); } },
    navUsers:           { section:'catalogos', wrapper:'vista-ops-usuarios',             inner:'usersView',           render:function(){ if(typeof window.renderGenericTable === 'function') window.renderGenericTable('users', (document.getElementById('userSearch')||{}).value || ''); } },
    navSuppliers:       { section:'catalogos', wrapper:'vista-ops-suplidores',           inner:'suppliersView',       render:function(){ if(typeof window.renderGenericTable === 'function') window.renderGenericTable('suppliers', (document.getElementById('supplierSearch')||{}).value || ''); } },
    navWorks:           { section:'catalogos', wrapper:'vista-ops-trabajos',             inner:'worksView',           render:function(){ if(typeof window.renderGenericTable === 'function') window.renderGenericTable('work', (document.getElementById('workSearch')||{}).value || ''); } },
    navIssues:          { section:'catalogos', wrapper:'vista-ops-averias',              inner:'issuesView',          render:function(){ if(typeof window.renderGenericTable === 'function') window.renderGenericTable('issue', (document.getElementById('issueSearch')||{}).value || ''); } }
  };

  function hideAllWrappers(){
    document.querySelectorAll('[id^="vista-"]').forEach(function(node){
      node.classList.add('hidden');
    });
  }

  function hideOpsInnerViews(){
    OPS_INNER_VIEWS.forEach(function(id){
      var node = document.getElementById(id);
      if(node) node.classList.add('hidden');
    });
  }

  function setSectionOpen(sectionName){
    document.querySelectorAll('.sidebar-group').forEach(function(group){
      if(group.dataset && group.dataset.section === sectionName) group.classList.add('is-open');
      else group.classList.remove('is-open');
    });
  }

  function setActiveLink(navId){
    document.querySelectorAll('.sidebar-link').forEach(function(link){ link.classList.remove('active'); });
    var nav = document.getElementById(navId);
    if(nav) nav.classList.add('active');
  }

  function openDirect(navId){
    var route = ROUTES[navId];
    if(!route) return false;
    try{
      hideAllWrappers();
      hideOpsInnerViews();

      var wrapper = document.getElementById(route.wrapper);
      var inner = document.getElementById(route.inner);

      if(wrapper) wrapper.classList.remove('hidden');
      if(inner) inner.classList.remove('hidden');

      setActiveLink(navId);
      setSectionOpen(route.section);

      setTimeout(function(){
        try{ route.render && route.render(); }
        catch(renderError){ console.warn('[LOTEKA v179] Error renderizando ' + navId + ':', renderError); }
      }, 20);
    }catch(error){
      console.error('[LOTEKA v179] No se pudo abrir ' + navId + ':', error);
      alert('No se pudo abrir esta vista. Revisa la consola para más detalles.');
    }
    return false;
  }

  function bindReportesCatalogos(){
    Object.keys(ROUTES).forEach(function(navId){
      var node = document.getElementById(navId);
      if(!node || node.dataset.lotekaV179Bound === '1') return;
      node.dataset.lotekaV179Bound = '1';
      node.setAttribute('href','javascript:void(0)');
      node.onclick = function(event){
        if(event){ event.preventDefault(); event.stopPropagation(); }
        return openDirect(navId);
      };
    });
  }

  window.lotekaAbrirReporteCatalogoDirecto = openDirect;
  document.addEventListener('DOMContentLoaded', function(){
    bindReportesCatalogos();
    setTimeout(bindReportesCatalogos, 300);
    setTimeout(bindReportesCatalogos, 1200);
  });
  window.addEventListener('load', function(){ setTimeout(bindReportesCatalogos, 300); });
})();

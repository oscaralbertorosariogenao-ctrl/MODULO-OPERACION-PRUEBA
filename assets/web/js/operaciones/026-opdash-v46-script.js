
(function(){
  function go(viewName, wrapperId, navId){
    try{
      var el = navId ? document.getElementById(navId) : null;
      if(typeof abrirVistaOperaciones === 'function') abrirVistaOperaciones(viewName, wrapperId || ('ops-' + viewName), el);
      else if(typeof showView === 'function') showView(viewName);
      setTimeout(function(){ try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){ window.scrollTo(0,0); } },40);
    }catch(e){ console.warn('lotekaOpsDashGo',e); }
  }
  window.lotekaOpsDashGo=function(target){
    var map={
      operations:['operations','ops-operaciones','navOperations'],
      history:['history','ops-historial','navHistory'],
      reports:['reports','ops-reportes','navReports'],
      reportsAgency:['reportsAgency','ops-reportes-agencia','navReportsAgency'],
      reportsOwner:['reportsOwner','ops-reportes-responsable','navReportsOwner'],
      reportsSpecific:['reportsSpecific','ops-reportes-tipos','navReportsSpecific']
    };
    var item=map[target] || map.operations;
    go(item[0],item[1],item[2]);
  };
  window.lotekaOpsDashFilter=function(kind){
    go('operations','ops-operaciones','navOperations');
    setTimeout(function(){
      try{
        var type=document.getElementById('filterType');
        var status=document.getElementById('filterStatus');
        var agency=document.getElementById('filterAgency');
        var tech=document.getElementById('filterTech');
        if(type) type.value='';
        if(status) status.value='';
        if(agency) agency.value='';
        if(tech) tech.value='';
        if(status){
          if(kind==='process') status.value='En proceso';
          if(kind==='done') status.value='Completado';
          if(kind==='open') status.value='Pendiente';
        }
        if(kind==='reported'){
          if(status) status.value='Reportado';
        }
        if(typeof renderOperations==='function') renderOperations();
      }catch(e){ console.warn('lotekaOpsDashFilter',e); }
    },120);
  };
})();

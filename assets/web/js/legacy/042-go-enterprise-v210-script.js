
(function(){
  function $(id){return document.getElementById(id);}
  function skeletonRows(cols, rows){
    rows = rows || 5; cols = cols || 5;
    var html = '';
    for(var r=0;r<rows;r++){
      html += '<tr class="go-skeleton-table-v210">';
      for(var c=0;c<cols;c++) html += '<td><span class="go-skeleton-cell-v210"></span></td>';
      html += '</tr>';
    }
    return html;
  }
  window.lotekaShowDashboardSkeletonV210 = function(){
    ['dashboardStatusBars','dashboardTypeBars','dashboardTopAgencies','dashboardTopTechs','dashboardTopSuppliers','dashboardAlerts'].forEach(function(id){
      var el=$(id); if(el && !el.children.length) el.innerHTML='<div class="go-skeleton-list-v210"><span></span><span></span><span></span></div>';
    });
    var critical=$('dashboardCriticalTable'); if(critical && !critical.children.length) critical.innerHTML=skeletonRows(5,3);
    var activity=$('dashboardActivityTimeline'); if(activity && !activity.children.length) activity.innerHTML='<div class="go-skeleton-list-v210"><span></span><span></span><span></span></div>';
  };
  window.lotekaShowOperationsSkeletonV210 = function(){
    var tbody=$('operationsTableBody'); if(tbody && !tbody.children.length) tbody.innerHTML=skeletonRows(9,5);
  };
  function boot(){
    try{ window.lotekaShowDashboardSkeletonV210(); window.lotekaShowOperationsSkeletonV210(); }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

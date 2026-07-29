
(function(){
  'use strict';
  function fixOperationsToggle(){
    var group = document.querySelector('.sidebar-group[data-section="operaciones"]');
    var btn = group ? group.querySelector('.sidebar-group-btn') : null;
    if(!group || !btn || btn.__lotekaV169OpsToggle) return;
    btn.__lotekaV169OpsToggle = true;
    btn.onclick = function(ev){
      if(ev){ ev.preventDefault(); ev.stopPropagation(); }
      var wasOpen = group.classList.contains('is-open');
      document.querySelectorAll('.sidebar-group').forEach(function(g){
        if(g && g.classList) g.classList.remove('is-open');
      });
      if(!wasOpen) group.classList.add('is-open');
      return false;
    };
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fixOperationsToggle);
  else fixOperationsToggle();
  window.addEventListener('load', function(){ setTimeout(fixOperationsToggle, 200); setTimeout(fixOperationsToggle, 900); });
})();

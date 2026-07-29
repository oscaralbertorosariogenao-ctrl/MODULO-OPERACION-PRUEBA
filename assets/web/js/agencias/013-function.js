
(function(){
  function bootHomeMap(){
    try{
      var savedView = '';
      try { savedView = sessionStorage.getItem('loteka-active-view-v1') || localStorage.getItem('loteka-active-view-v1') || ''; } catch(e){}
      if(!savedView || savedView === 'home'){
        if(typeof cambiarVista === 'function'){
          window.__lotekaAllowProgrammaticHome = true;
          cambiarVista('home', document.getElementById('navHome'));
          window.__lotekaAllowProgrammaticHome = false;
        }
        const home=document.getElementById('navHome');
        if(home){ document.querySelectorAll('.sidebar-link').forEach(a=>a.classList.remove('active')); home.classList.add('active'); }
      }
      setTimeout(function(){
        try{
          if(typeof agencyMapRefresh === 'function') agencyMapRefresh(typeof agencias !== 'undefined' ? agencias : (window.agencias || []));
          if(window.agencyMap && typeof window.agencyMap.invalidateSize === 'function') window.agencyMap.invalidateSize(true);
          if(typeof agencyMapFitAll === 'function') agencyMapFitAll();
        }catch(e){ console.warn('Home map boot:', e); }
      }, 450);
    }catch(e){ console.warn('Home init:', e); }
  }
  window.consultarAgenciaDesdeMapa=function(numero){
    try{
      const idx=(typeof agencias !== 'undefined' ? agencias : (window.agencias||[])).findIndex(a=>String(a.numero||a.codigo||a.agencia||'').padStart(4,'0')===String(numero).padStart(4,'0') || String(a.numero||a.codigo||a.agencia||'')===String(numero));
      if(idx>=0 && typeof window.verDetalleAgencia==='function'){
        cambiarVista('agencias', document.querySelector('[onclick*="cambiarVista(\'agencias\'"]'));
        setTimeout(()=>window.verDetalleAgencia(idx),120);
      }
    }catch(e){ console.warn('Consultar agencia desde mapa:', e); }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bootHomeMap); else bootHomeMap();
})();


(function(){
  const BUILD = '2026-05-08-v59-grupo01-agencias-tipos-v1';

  function safeInvalidateMap(){
    try { if (window.agenciasMapInstance && typeof window.agenciasMapInstance.invalidateSize === 'function') window.agenciasMapInstance.invalidateSize(true); } catch(e){}
    try { if (typeof agenciasMapInstance !== 'undefined' && agenciasMapInstance && typeof agenciasMapInstance.invalidateSize === 'function') agenciasMapInstance.invalidateSize(true); } catch(e){}
    try { if (typeof ensureAgencyMap === 'function') { const m = ensureAgencyMap(); if(m && typeof m.invalidateSize === 'function') m.invalidateSize(true); } } catch(e){}
  }

  function goHome(linkEl){
    try {
      const nav = linkEl || document.getElementById('navHome') || document.querySelector('.sidebar-home-link');
      if (typeof cambiarVista === 'function') cambiarVista('home', nav);
      setTimeout(safeInvalidateMap, 120);
      setTimeout(safeInvalidateMap, 450);
    } catch(e){}
  }

  function setupBrandRefresh(){
    const brand = document.querySelector('.brand-wrap');
    if(!brand || brand.dataset.ltkRefreshReady === '1') return;
    brand.dataset.ltkRefreshReady = '1';
    brand.setAttribute('title','Recargar y volver a HOME');
    brand.addEventListener('click', function(ev){
      ev.preventDefault();
      try { sessionStorage.setItem('loteka-force-home','1'); } catch(e){}
      const url = new URL(window.location.href);
      url.searchParams.set('_ltk', Date.now().toString());
      window.location.replace(url.toString());
    });
  }

  function setupSidebarToggle(){
    if(document.getElementById('ltkSidebarFloatingToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'ltkSidebarFloatingToggle';
    btn.type = 'button';
    btn.title = 'Esconder / abrir menú';
    btn.innerHTML = '<i class="fas fa-bars"></i>';
    document.body.appendChild(btn);
    const saved = localStorage.getItem('loteka-sidebar-collapsed');
    if(saved === '1') document.body.classList.add('ltk-sidebar-collapsed');
    function sync(){
      const collapsed = document.body.classList.contains('ltk-sidebar-collapsed');
      btn.innerHTML = collapsed ? '<i class="fas fa-angles-right"></i>' : '<i class="fas fa-bars"></i>';
      btn.title = collapsed ? 'Abrir menú' : 'Esconder menú';
      setTimeout(safeInvalidateMap, 80);
      setTimeout(safeInvalidateMap, 280);
    }
    btn.addEventListener('click', function(){
      document.body.classList.toggle('ltk-sidebar-collapsed');
      localStorage.setItem('loteka-sidebar-collapsed', document.body.classList.contains('ltk-sidebar-collapsed') ? '1' : '0');
      sync();
    });
    sync();
  }

  async function setupAutoCache(){
    try {
      const previous = localStorage.getItem('loteka-build-version');
      if(previous && previous !== BUILD && window.caches){
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => /loteka|pwa|cache/i.test(k)).map(k => caches.delete(k)));
      }
      localStorage.setItem('loteka-build-version', BUILD);
    } catch(e){}
    try {
      if('serviceWorker' in navigator){
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(reg => { try { reg.update(); } catch(e){} });
        });
      }
    } catch(e){}
  }

  function ensureGruposMenu(){
    const consultas = document.querySelector('.sidebar-group[data-section="consultas"] .sidebar-group-menu');
    if(consultas && !consultas.querySelector('[onclick*="grupos"]')){
      const a = document.createElement('a');
      a.className = 'sidebar-link';
      a.setAttribute('onclick', "cambiarVista('grupos', this)");
      a.innerHTML = '<i class="fas fa-users"></i><span>Grupos</span>';
      consultas.appendChild(a);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    setupBrandRefresh();
    setupSidebarToggle();
    setupAutoCache();
    ensureGruposMenu();
    try {
      if(sessionStorage.getItem('loteka-force-home') === '1'){
        sessionStorage.removeItem('loteka-force-home');
        setTimeout(() => goHome(), 120);
      }
    } catch(e){}
  });

  window.addEventListener('load', function(){
    setupBrandRefresh();
    setupSidebarToggle();
    ensureGruposMenu();
    setTimeout(safeInvalidateMap, 250);
  });
})();

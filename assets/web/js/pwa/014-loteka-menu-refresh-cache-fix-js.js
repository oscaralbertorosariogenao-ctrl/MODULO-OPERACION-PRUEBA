
(function(){
  const BUILD = String(document.querySelector('meta[name="grupo-ortiz-build"]')?.content || '').trim();

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
    brand.setAttribute('title','Recargar y volver a Inicio');
    brand.setAttribute('role','button');
    brand.setAttribute('tabindex','0');
    const activate = function(ev){
      if(ev && ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      if(ev) ev.preventDefault();
      try { sessionStorage.setItem('loteka-force-home','1'); } catch(e){}
      const url = new URL(window.location.href);
      url.searchParams.set('_ltk', Date.now().toString());
      window.location.replace(url.toString());
    };
    brand.addEventListener('click', activate);
    brand.addEventListener('keydown', activate);
  }

  function setupSidebarToggle(){
    let btn = document.getElementById('ltkSidebarFloatingToggle');
    const sidebar = document.querySelector('.sidebar');
    if(sidebar && !sidebar.id) sidebar.id='goMainSidebar';
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'ltkSidebarFloatingToggle';
      btn.type = 'button';
      btn.setAttribute('aria-controls', sidebar?.id || 'goMainSidebar');
      document.body.appendChild(btn);
    }
    let backdrop = document.getElementById('ltkSidebarBackdrop');
    if(!backdrop){
      backdrop = document.createElement('div');
      backdrop.id = 'ltkSidebarBackdrop';
      backdrop.setAttribute('aria-hidden','true');
      document.body.appendChild(backdrop);
    }
    const saved = localStorage.getItem('loteka-sidebar-collapsed');
    if(saved === '1') document.body.classList.add('ltk-sidebar-collapsed');

    function sync(){
      const collapsed = document.body.classList.contains('ltk-sidebar-collapsed');
      btn.innerHTML = collapsed ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-xmark"></i>';
      btn.title = collapsed ? 'Abrir menú' : 'Cerrar menú';
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      backdrop.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
      setTimeout(safeInvalidateMap, 80);
      setTimeout(safeInvalidateMap, 280);
    }
    window.ltkSyncSidebarShell = sync;

    if(btn.dataset.goShellReady !== '1'){
      btn.dataset.goShellReady='1';
      btn.addEventListener('click', function(){
        document.body.classList.toggle('ltk-sidebar-collapsed');
        localStorage.setItem('loteka-sidebar-collapsed', document.body.classList.contains('ltk-sidebar-collapsed') ? '1' : '0');
        sync();
      });
    }
    if(backdrop.dataset.goShellReady !== '1'){
      backdrop.dataset.goShellReady='1';
      backdrop.addEventListener('click', function(){
        document.body.classList.add('ltk-sidebar-collapsed');
        localStorage.setItem('loteka-sidebar-collapsed','1');
        sync();
        btn.focus();
      });
    }
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
      a.setAttribute('role','button');
      a.setAttribute('tabindex','0');
      a.setAttribute('onclick', "cambiarVista('grupos', this)");
      a.innerHTML = '<i class="fas fa-users"></i><span>Grupos</span>';
      consultas.appendChild(a);
    }
  }

  function setupEscape(){
    if(document.documentElement.dataset.goShellEscapeReady === '1') return;
    document.documentElement.dataset.goShellEscapeReady='1';
    document.addEventListener('keydown', function(event){
      if(event.key !== 'Escape') return;
      if(!window.matchMedia || !window.matchMedia('(max-width: 900px)').matches) return;
      if(document.body.classList.contains('ltk-sidebar-collapsed')) return;
      document.body.classList.add('ltk-sidebar-collapsed');
      localStorage.setItem('loteka-sidebar-collapsed','1');
      if(typeof window.ltkSyncSidebarShell === 'function') window.ltkSyncSidebarShell();
      document.getElementById('ltkSidebarFloatingToggle')?.focus();
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    setupBrandRefresh();
    setupSidebarToggle();
    setupAutoCache();
    ensureGruposMenu();
    setupEscape();
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
    setupEscape();
    setTimeout(safeInvalidateMap, 250);
  });
})();

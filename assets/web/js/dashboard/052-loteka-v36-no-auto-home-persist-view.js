(function(){
  'use strict';
  const VIEW_KEY = 'loteka-active-view-v1';
  const OPS_KEY = 'loteka-active-ops-view-v1';

  function safeSet(key, value){
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch(e){}
  }
  function safeGet(key){
    let raw = null;
    try { raw = sessionStorage.getItem(key); } catch(e){}
    if(!raw) return null;
    try { return JSON.parse(raw); } catch(e){ return raw; }
  }
  function safeRemove(key){ try { sessionStorage.removeItem(key); } catch(e){} }
  function clearSavedView(){ safeRemove(VIEW_KEY); safeRemove(OPS_KEY); }
  function trustedUserClick(){
    try { return !!(window.event && window.event.isTrusted); } catch(e){ return false; }
  }
  function findNavByVista(vista){
    if(vista === 'home') return document.getElementById('navHome');
    const target1 = "cambiarVista('" + vista + "'";
    const target2 = 'cambiarVista("' + vista + '"';
    return Array.from(document.querySelectorAll('[onclick]')).find(function(el){
      const action = el.getAttribute('onclick') || '';
      return action.indexOf(target1) !== -1 || action.indexOf(target2) !== -1;
    }) || null;
  }
  function persistNormalView(vista){
    if(!vista) return;
    safeSet(VIEW_KEY, { type:'normal', vista:String(vista), ts:Date.now() });
  }
  function persistOpsView(nombreVista, vistaWrapper, el){
    const wrapper = String(vistaWrapper || '').trim();
    const view = String(nombreVista || '').trim();
    if(!wrapper && !view) return;
    const payload = { type:'ops', vista:view, wrapper:wrapper, navId: el && el.id ? el.id : '', ts:Date.now() };
    safeSet(VIEW_KEY, payload);
    safeSet(OPS_KEY, payload);
  }
  function restoreSavedView(reason){
    const saved = safeGet(VIEW_KEY);
    if(!saved || (!saved.vista && !saved.wrapper)) return false;

    if(saved.type === 'ops'){
      const nav = saved.navId ? document.getElementById(saved.navId) : null;
      if(typeof window.abrirVistaOperaciones === 'function'){
        window.__lotekaRestoringView = true;
        try { window.abrirVistaOperaciones(saved.vista || '', saved.wrapper || '', nav); }
        finally { window.__lotekaRestoringView = false; }
        return true;
      }
      return false;
    }

    const vista = String(saved.vista || 'home');
    const nav = findNavByVista(vista);
    if(typeof window.cambiarVista === 'function'){
      window.__lotekaRestoringView = true;
      try { window.cambiarVista(vista, nav); }
      finally { window.__lotekaRestoringView = false; }
      return true;
    }
    return false;
  }

  window.lotekaRestoreActiveView = restoreSavedView;
  window.lotekaClearActiveView = clearSavedView;

  function installNoAutoHomeGuard(){
    if(window.__lotekaNoAutoHomeGuardInstalled) return;
    window.__lotekaNoAutoHomeGuardInstalled = true;

    const originalCambiarVista = window.cambiarVista;
    if(typeof originalCambiarVista === 'function'){
      window.cambiarVista = function(vista, el){
        const target = String(vista || '');
        const saved = safeGet(VIEW_KEY);
        const userClick = trustedUserClick();
        const allowHome = userClick || window.__lotekaAllowProgrammaticHome || window.__lotekaRestoringView || !saved || saved.vista === 'home';

        if(target === 'home' && !allowHome){
          return false;
        }

        const result = originalCambiarVista.apply(this, arguments);
        if(target) persistNormalView(target);
        return result;
      };
      try { cambiarVista = window.cambiarVista; } catch(e){}
    }

    const originalAbrirVistaOperaciones = window.abrirVistaOperaciones;
    if(typeof originalAbrirVistaOperaciones === 'function'){
      window.abrirVistaOperaciones = function(nombreVista, vistaWrapper, el){
        const result = originalAbrirVistaOperaciones.apply(this, arguments);
        persistOpsView(nombreVista, vistaWrapper, el);
        return result;
      };
      try { abrirVistaOperaciones = window.abrirVistaOperaciones; } catch(e){}
    }
  }

  function installSessionCleanup(){
    try {
      if(window.GOApp && window.GOApp.__phase2aRuntime && window.GOApp.events){
        window.GOApp.events.on('auth:signed-out', clearSavedView);
      }
    } catch(e){}
  }

  function bootRestore(){
    installNoAutoHomeGuard();
    installSessionCleanup();
    // Solo se restaura al arrancar/recargar esta misma pestaña. Volver desde
    // otra pestaña del navegador nunca debe provocar navegación automática.
    setTimeout(function(){ restoreSavedView('dom-ready'); }, 120);
    setTimeout(function(){ restoreSavedView('dom-ready-late'); }, 700);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootRestore);
  else bootRestore();

  // pageshow/visibilitychange ya no ejecutan restoreSavedView. El navegador
  // conserva la vista actual y los módulos pueden refrescar datos sin navegar.
})();

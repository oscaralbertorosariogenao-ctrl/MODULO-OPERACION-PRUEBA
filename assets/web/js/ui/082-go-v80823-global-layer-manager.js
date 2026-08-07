(function(global){
  'use strict';

  const VERSION='v808.23';
  const STYLE_ID='go-v80823-global-layer-style';
  const ROOT_VAR='--go-fixed-header-offset';
  let resizeObserver=null;
  let headObserver=null;
  let scheduled=false;

  function topbar(){ return document.querySelector('.loteka-global-topbar'); }

  function measureOffset(){
    const bar=topbar();
    if(!bar) return window.matchMedia('(max-width:900px)').matches ? 58 : 62;
    const rect=bar.getBoundingClientRect();
    // rect.bottom is safer than CSS height if fonts, zoom or responsive rules change.
    return Math.max(0,Math.ceil(rect.bottom));
  }

  function applyOffset(){
    const value=measureOffset();
    document.documentElement.style.setProperty(ROOT_VAR,`${value}px`);
    document.documentElement.dataset.goHeaderOffset=String(value);
  }

  function css(){
    return `
:root{--go-fixed-header-offset:62px;--go-layer-gap:12px}

/* v808.23 · Ninguna capa operacional puede empezar debajo de la barra global. */
html body .modal,
html body .ops-modal-backdrop,
html body .ops-media-lightbox,
html body .opx-modal,
html body .lev-modal,
html body .hrx-modal,
html body .dispatch-modal,
html body .empconsulta-modal,
html body .loteka-report-modal,
html body .ltk-auto-overlay,
html body .ltk-notif-detail-modal,
html body .ltk-pass-overlay,
html body .go-confirm-backdrop,
html body .ltk-ann-popup,
html body .go-wa-close-overlay,
html body .rend-sheet-backdrop-v300,
html body .taller-v2-modal-backdrop,
html body #taller-v2-sub-nueva.active,
html body .ltk-v603-backdrop,
html body .ltk-position-modal,
html body .v808-backdrop{
  top:var(--go-fixed-header-offset)!important;
  bottom:0!important;
  height:auto!important;
  max-height:calc(100dvh - var(--go-fixed-header-offset))!important;
  box-sizing:border-box!important;
}

/* Los backdrops deben poder desplazarse; así el encabezado y los botones nunca quedan inaccesibles. */
html body .modal,
html body .ops-modal-backdrop,
html body .ops-media-lightbox,
html body .opx-modal,
html body .lev-modal,
html body .hrx-modal,
html body .dispatch-modal,
html body .empconsulta-modal,
html body .loteka-report-modal,
html body .ltk-auto-overlay,
html body .ltk-notif-detail-modal,
html body .ltk-pass-overlay,
html body .go-confirm-backdrop,
html body .ltk-ann-popup,
html body .go-wa-close-overlay,
html body .rend-sheet-backdrop-v300,
html body .taller-v2-modal-backdrop,
html body #taller-v2-sub-nueva.active,
html body .ltk-v603-backdrop,
html body .ltk-position-modal,
html body .v808-backdrop{
  overflow:auto!important;
  overscroll-behavior:contain!important;
}

/* Altura máxima de los contenedores más usados dentro del viewport restante. */
html body .ops-modal,
html body .opx-dialog,
html body .lev-modal-dialog,
html body .hrx-dialog,
html body .dispatch-modal-card,
html body .empconsulta-card,
html body .loteka-report-card,
html body .ltk-notif-detail-card,
html body .go-confirm-card,
html body .ltk-ann-dialog,
html body .go-wa-close-card,
html body .rend-sheet-v300,
html body .taller-v2-modal,
html body .ltk-v603-card,
html body .ltk-position-card,
html body .v808-modal{
  max-height:calc(100dvh - var(--go-fixed-header-offset) - 24px)!important;
  box-sizing:border-box!important;
}

/* Centro de notificaciones: panel y detalle siempre debajo del header real. */
html body .ltk-notif-panel{
  top:calc(var(--go-fixed-header-offset) + 8px)!important;
  max-height:calc(100dvh - var(--go-fixed-header-offset) - 16px)!important;
  height:auto!important;
}
html body .ltk-notif-detail-modal{
  inset:var(--go-fixed-header-offset) 0 0!important;
  align-items:flex-start!important;
}
html body .ltk-notif-detail-card{
  margin:0 auto!important;
}

/* Todos los avisos superiores usan el mismo offset en vez de números dispersos. */
html body .go-toast-wrap,
html body .ops-toast-wrap{
  top:calc(var(--go-fixed-header-offset) + 14px)!important;
}
html body .ltk-ann-toast,
html body .loteka-refresh-toast-v43,
html body .ltk-access-denied-toast{
  top:calc(var(--go-fixed-header-offset) + 12px)!important;
}

/* El detalle de Operaciones queda completamente contenido debajo de la barra. */
html body #detailModalBackdrop{
  top:var(--go-fixed-header-offset)!important;
  bottom:0!important;
  height:auto!important;
  align-items:flex-start!important;
  overflow:auto!important;
  padding-top:12px!important;
  padding-bottom:12px!important;
}
html body #detailModalBackdrop .ops-modal{
  max-height:calc(100dvh - var(--go-fixed-header-offset) - 24px)!important;
  margin:0 auto!important;
}

@media(max-width:700px){
  :root{--go-layer-gap:8px}
  html body .go-toast-wrap,
  html body .ops-toast-wrap{top:calc(var(--go-fixed-header-offset) + 8px)!important;left:10px!important;right:10px!important;width:auto!important;max-width:none!important}
  html body .ltk-ann-toast,
  html body .loteka-refresh-toast-v43,
  html body .ltk-access-denied-toast{top:calc(var(--go-fixed-header-offset) + 8px)!important}
  html body .ltk-notif-panel{top:calc(var(--go-fixed-header-offset) + 6px)!important;max-height:calc(100dvh - var(--go-fixed-header-offset) - 12px)!important}
  html body #detailModalBackdrop{padding:8px!important;padding-top:8px!important}
  html body #detailModalBackdrop .ops-modal{max-height:calc(100dvh - var(--go-fixed-header-offset) - 16px)!important;width:100%!important}
}
`;
  }

  function installStyle(){
    let style=document.getElementById(STYLE_ID);
    if(!style){
      style=document.createElement('style');
      style.id=STYLE_ID;
      style.dataset.version=VERSION;
      style.textContent=css();
      document.head.appendChild(style);
    }else if(style.textContent!==css()){
      style.textContent=css();
    }
    // Keep the global layer policy last so old modules that inject legacy offsets cannot win.
    if(document.head.lastElementChild!==style) document.head.appendChild(style);
  }

  function schedule(){
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(function(){
      scheduled=false;
      installStyle();
      applyOffset();
    });
  }

  function boot(){
    installStyle();
    applyOffset();
    const bar=topbar();
    if(bar && 'ResizeObserver' in global){
      resizeObserver=new ResizeObserver(schedule);
      resizeObserver.observe(bar);
    }
    global.addEventListener('resize',schedule,{passive:true});
    global.addEventListener('orientationchange',schedule,{passive:true});

    // Some legacy modules append <style> tags later. Re-place our policy last after that happens.
    headObserver=new MutationObserver(function(mutations){
      if(mutations.some(m=>[...m.addedNodes].some(node=>node.nodeType===1 && (node.tagName==='STYLE'||node.tagName==='LINK')))){
        setTimeout(schedule,0);
      }
    });
    headObserver.observe(document.head,{childList:true});
    console.info(`[Grupo Ortiz] Gestor global de capas ${VERSION} activo. Offset: ${measureOffset()}px`);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})(window);

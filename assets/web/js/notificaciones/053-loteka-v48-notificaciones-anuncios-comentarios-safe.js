
(function(){
  'use strict';
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function isAnnouncementNotif(n){
    if(!n) return false;
    var ref = clean(n.referencia_tipo || n.reference_type || n.tipo_referencia).toLowerCase();
    var mod = clean(n.modulo || n.module).toUpperCase();
    var tipo = clean(n.tipo || n.type).toUpperCase();
    var titulo = clean(n.titulo || n.title).toLowerCase();
    var msg = clean(n.mensaje || n.message || n.descripcion).toLowerCase();
    return ref === 'anuncio' || ref === 'anuncios' ||
           mod === 'COMUNICACION' || mod === 'COMUNICACIÓN' || mod === 'ANUNCIOS' ||
           tipo.indexOf('ANUNCIO') >= 0 || tipo.indexOf('COMENTARIO_ANUNCIO') >= 0 ||
           titulo.indexOf('anuncio') >= 0 || msg.indexOf('anuncio') >= 0;
  }
  function openAnnouncementsFromNotification(n){
    try{
      if(typeof window.lotekaOpenAnuncios === 'function') window.lotekaOpenAnuncios();
      else if(typeof window.cambiarVista === 'function') window.cambiarVista('anuncios');
      else {
        var topBtn = document.querySelector('#navAnunciosTop, [data-view="anuncios"], #topAnunciosBtn, #btnAnuncios, .topbar button[onclick*="anuncios"]');
        if(topBtn) topBtn.click();
      }
      var id = clean(n && (n.referencia_codigo || n.referencia_id || n.reference_id || n.anuncio_id));
      if(id && typeof window.lotekaAnunciosSelect === 'function'){
        setTimeout(function(){ try{ window.lotekaAnunciosSelect(id, false); }catch(e){} }, 450);
      }
    }catch(e){ console.warn('No se pudo abrir Anuncios desde la notificación:', e); }
  }
  function refreshButton(){
    var modal = document.getElementById('ltkNotifDetailModal') || document.querySelector('.ltk-notif-detail-modal, .notification-detail-modal');
    var btn = document.getElementById('ltkNotifDetailGo') || (modal && modal.querySelector('[data-action="go"], .ltk-notif-go, .btn-primary:last-child'));
    if(!modal || !btn) return;
    var n = modal._notif || window.__lotekaCurrentNotification || null;
    if(isAnnouncementNotif(n)){
      if(btn.dataset.lotekaAnuncioGo !== '1') btn.dataset.lotekaAnuncioGo = '1';
      if(btn.textContent.trim() !== 'Abrir Anuncios') btn.innerHTML = '<i class="fas fa-bullhorn"></i> Abrir Anuncios';
      if(btn.title !== 'Abrir el módulo de Anuncios') btn.title = 'Abrir el módulo de Anuncios';
    }else if(btn.dataset.lotekaAnuncioGo === '1'){
      btn.innerHTML = '<i class="fas fa-arrow-right"></i> Abrir módulo';
      btn.title = 'Abrir módulo relacionado';
      delete btn.dataset.lotekaAnuncioGo;
    }
  }
  function patch(){
    var modal = document.getElementById('ltkNotifDetailModal') || document.querySelector('.ltk-notif-detail-modal, .notification-detail-modal');
    var btn = document.getElementById('ltkNotifDetailGo') || (modal && modal.querySelector('[data-action="go"], .ltk-notif-go, .btn-primary:last-child'));
    if(!modal || !btn){ return; }
    if(!btn.__lotekaV48AnunciosFix){
      btn.__lotekaV48AnunciosFix = true;
      btn.addEventListener('click', function(ev){
        var n = modal._notif || window.__lotekaCurrentNotification || null;
        if(!isAnnouncementNotif(n)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        modal.classList.remove('is-open','show','active');
        modal.style.display = '';
        openAnnouncementsFromNotification(n);
        return false;
      }, true);
    }
    if(!modal.__lotekaV48Observer){
      var timer = null;
      var obs = new MutationObserver(function(){
        clearTimeout(timer);
        timer = setTimeout(refreshButton, 60);
      });
      obs.observe(modal, { attributes:true, childList:true, subtree:false, attributeFilter:['class','style'] });
      modal.__lotekaV48Observer = obs;
    }
    refreshButton();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patch);
  else patch();
  window.addEventListener('load', function(){ setTimeout(patch, 250); setTimeout(patch, 900); setTimeout(patch, 1800); });
  document.addEventListener('click', function(){ setTimeout(patch, 100); }, true);
})();

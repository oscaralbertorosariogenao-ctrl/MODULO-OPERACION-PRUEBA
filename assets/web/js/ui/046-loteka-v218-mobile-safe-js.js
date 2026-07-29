
(function(){
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 900px)').matches; }
  function boot(){
    try{
      if(!isMobile()) return;
      var firstKey = 'loteka-mobile-sidebar-initialized-v218';
      if(!localStorage.getItem(firstKey)){
        document.body.classList.add('ltk-sidebar-collapsed');
        localStorage.setItem('loteka-sidebar-collapsed','1');
        localStorage.setItem(firstKey,'1');
      }
    }catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

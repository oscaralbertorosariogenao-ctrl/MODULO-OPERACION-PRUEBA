
(function(){
  function forceLightMode(){
    try{ localStorage.setItem('goEnterpriseTheme', 'light'); }catch(e){}
    if(document.body){ document.body.classList.remove('go-dark-mode', 'dark-mode'); }
    var btn = document.getElementById('goThemeToggle');
    if(btn){
      btn.style.display = 'none';
      btn.setAttribute('aria-hidden', 'true');
      btn.setAttribute('disabled', 'disabled');
      btn.onclick = null;
    }
    try{ document.querySelector('meta[name="theme-color"]').setAttribute('content', '#0ea5c6'); }catch(e){}
  }
  window.toggleGoDarkMode = function(){
    forceLightMode();
    if(typeof notify === 'function'){
      notify('Modo oscuro desactivado temporalmente.', 'info');
    }
  };
  document.addEventListener('DOMContentLoaded', forceLightMode);
  if(document.readyState !== 'loading') forceLightMode();
})();

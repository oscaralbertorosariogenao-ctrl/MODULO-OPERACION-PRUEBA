
(function(){
  try{
    var h = location.hostname;
    var isDev = h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:';
    if(!isDev) return;
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations().then(function(regs){ regs.forEach(function(r){ try{ r.unregister(); }catch(e){} }); });
    }
    if(window.caches && caches.keys){
      caches.keys().then(function(keys){ keys.forEach(function(k){ try{ caches.delete(k); }catch(e){} }); });
    }
  }catch(e){}
})();

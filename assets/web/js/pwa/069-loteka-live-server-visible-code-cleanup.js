
(function(){
  'use strict';
  function clean(){
    try{
      var walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      var bad=[]; var n;
      while((n=walker.nextNode())){
        var t=(n.nodeValue||'').trim();
        if(t && (t.indexOf('downloadBlob(filename, html')!==-1 || t.indexOf('view?.prepend(brand)')!==-1 || t.indexOf('injectExportDock(')!==-1)){ bad.push(n); }
      }
      bad.forEach(function(node){ try{ node.parentNode && node.parentNode.removeChild(node); }catch(e){} });
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', clean); else clean();
})();


(function(){
  'use strict';
  function el(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function getSerialChoice(){
    var s = el('entradaSerializado');
    return s ? norm(s.value) : 'no';
  }
  function enforceNoSerialMode(){
    var s = el('entradaSerializado');
    var input = el('entradaSerialInput');
    var sec = el('serialSectionEntrada');
    if(!s) return;
    s.disabled = false;
    if(getSerialChoice() !== 'si'){
      try{ window.serialesTemporalesEntrada = []; serialesTemporalesEntrada = []; }catch(e){}
      if(input){ input.value=''; input.disabled=true; input.placeholder='No requiere seriales'; }
      if(sec){ sec.classList.add('serial-hidden'); sec.style.display='none'; }
      try{ if(typeof window.renderSerialesEntrada === 'function') window.renderSerialesEntrada(); }catch(e){}
    }else{
      if(input){ input.disabled=false; input.placeholder='Escribe un serial'; }
      if(sec){ sec.classList.remove('serial-hidden'); sec.style.display=''; }
    }
  }
  var oldChange = window.lotekaEntradaProductoSeleccionadoV147 || window.lotekaEntradaProductoSeleccionadoV93 || window.lotekaEntradaProductoSeleccionadoV92;
  window.lotekaEntradaProductoSeleccionadoV147 = function(){
    try{ if(typeof oldChange === 'function') oldChange(); }catch(e){}
    var s = el('entradaSerializado');
    if(s){ s.disabled = false; }
    enforceNoSerialMode();
  };
  window.actualizarCampoSerialesEntradaV149 = enforceNoSerialMode;
  document.addEventListener('change', function(ev){
    if(ev.target && ev.target.id === 'entradaSerializado') enforceNoSerialMode();
  }, true);
  document.addEventListener('input', function(ev){
    if(ev.target && ev.target.id === 'entradaSerializado') enforceNoSerialMode();
  }, true);
  setTimeout(enforceNoSerialMode, 300);
  setTimeout(enforceNoSerialMode, 1000);
})();

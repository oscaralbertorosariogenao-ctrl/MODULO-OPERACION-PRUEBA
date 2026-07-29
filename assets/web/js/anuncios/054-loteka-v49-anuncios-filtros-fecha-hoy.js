
(function(){
  'use strict';
  var FILTER_KEY='loteka-anuncios-filter-v49';
  var MONTHS={
    ene:1,enero:1,jan:1,january:1,
    feb:2,febrero:2,february:2,
    mar:3,marzo:3,march:3,
    abr:4,abril:4,apr:4,april:4,
    may:5,mayo:5,
    jun:6,junio:6,june:6,
    jul:7,julio:7,july:7,
    ago:8,agosto:8,aug:8,august:8,
    sep:9,sept:9,septiembre:9,september:9,
    oct:10,octubre:10,october:10,
    nov:11,noviembre:11,november:11,
    dic:12,diciembre:12,dec:12,december:12
  };
  function qs(s,r){return (r||document).querySelector(s);} function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function pad(n){return String(n).padStart(2,'0');}
  function todayKey(){var d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function niceKey(k){if(!k) return 'Todos los anuncios'; var p=k.split('-'); if(p.length!==3) return k; return p[2]+'/'+p[1]+'/'+p[0];}
  function readFilter(){try{return JSON.parse(localStorage.getItem(FILTER_KEY)||'{}')||{};}catch(e){return {};}}
  function saveFilter(f){try{localStorage.setItem(FILTER_KEY,JSON.stringify(f||{}));}catch(e){}}
  function dateKeyFromText(txt){
    txt=String(txt||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    var m=txt.match(/(\d{1,2})\s*(?:de\s*)?(ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|oct|octubre|nov|noviembre|dic|diciembre|jan|january|apr|april|aug|august|dec|december)\s*(?:de\s*)?(\d{4})/i);
    if(m){var mon=MONTHS[m[2]]||0; if(mon) return m[3]+'-'+pad(mon)+'-'+pad(parseInt(m[1],10));}
    m=txt.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if(m) return m[3]+'-'+pad(parseInt(m[2],10))+'-'+pad(parseInt(m[1],10));
    m=txt.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if(m) return m[1]+'-'+pad(parseInt(m[2],10))+'-'+pad(parseInt(m[3],10));
    return '';
  }
  function cardDateKey(card){
    if(!card) return '';
    if(card.dataset.annDateKey) return card.dataset.annDateKey;
    var key=dateKeyFromText(card.innerText||card.textContent||'');
    if(key) card.dataset.annDateKey=key;
    return key;
  }
  function ensureFilters(){
    var inbox=qs('.ltk-ann-inbox'); if(!inbox || qs('#annV49Filterbar',inbox)) return;
    var head=qs('.ltk-ann-panel-head',inbox); if(!head) return;
    var html='<div id="annV49Filterbar" class="ltk-ann-v49-filterbar">'
      +'<div id="annV49TodayCard" class="ltk-ann-v49-today-card" title="Filtrar anuncios de hoy" onclick="lotekaAnunciosFilterToday()"><strong>HOY</strong><span>Anuncios de hoy</span><small><b id="annV49TodayCount">0</b> comunicado(s)</small></div>'
      +'<div class="ltk-ann-v49-tools">'
        +'<div class="ltk-ann-v49-tools-head"><div class="ltk-ann-v49-tools-title"><i class="fas fa-filter"></i> Filtrar anuncios</div><div id="annV49ActiveLabel" class="ltk-ann-v49-active-label"><i class="fas fa-layer-group"></i> Todos los anuncios</div></div>'
        +'<div class="ltk-ann-v49-controls">'
          +'<input id="annV49DateInput" class="ltk-ann-v49-date" type="date" aria-label="Filtrar por fecha">'
          +'<button type="button" class="ltk-ann-v49-btn primary" onclick="lotekaAnunciosApplyDateFilter()"><i class="fas fa-calendar-check"></i> Filtrar fecha</button>'
          +'<button type="button" class="ltk-ann-v49-btn" onclick="lotekaAnunciosFilterToday()"><i class="fas fa-sun"></i> Hoy</button>'
          +'<button type="button" class="ltk-ann-v49-btn" onclick="lotekaAnunciosClearFilter()"><i class="fas fa-rotate-left"></i> Todos</button>'
        +'</div>'
      +'</div>'
    +'</div><div id="annV49Empty" class="ltk-ann-v49-empty"><i class="fas fa-calendar-xmark"></i> No hay anuncios para la fecha seleccionada.</div>';
    head.insertAdjacentHTML('afterend',html);
    var input=qs('#annV49DateInput');
    if(input){input.addEventListener('change',function(){ window.lotekaAnunciosApplyDateFilter(); });}
  }
  function updateCounters(){
    var cards=qsa('#annList .ltk-ann-card');
    var tk=todayKey(), c=0;
    cards.forEach(function(card){ if(cardDateKey(card)===tk) c++; });
    var el=qs('#annV49TodayCount'); if(el) el.textContent=String(c);
  }
  function applyFilter(f){
    ensureFilters();
    f=f||readFilter();
    var mode=f.mode||'all';
    var key= mode==='today' ? todayKey() : (mode==='date' ? (f.date||'') : '');
    var cards=qsa('#annList .ltk-ann-card');
    var visible=0;
    cards.forEach(function(card){
      var ck=cardDateKey(card);
      var hide= key ? ck!==key : false;
      card.classList.toggle('ltk-ann-v49-hidden', !!hide);
      if(!hide) visible++;
    });
    var label=qs('#annV49ActiveLabel');
    if(label){
      if(mode==='today') label.innerHTML='<i class="fas fa-sun"></i> Mostrando: Hoy';
      else if(mode==='date' && key) label.innerHTML='<i class="fas fa-calendar-day"></i> Mostrando: '+niceKey(key);
      else label.innerHTML='<i class="fas fa-layer-group"></i> Todos los anuncios';
    }
    var input=qs('#annV49DateInput'); if(input && key && mode==='date') input.value=key;
    var empty=qs('#annV49Empty'); if(empty) empty.classList.toggle('is-visible', !!key && cards.length>0 && visible===0);
    updateCounters();
  }
  window.lotekaAnunciosApplyDateFilter=function(){var input=qs('#annV49DateInput'); var date=input&&input.value?input.value:''; if(!date){window.lotekaAnunciosClearFilter();return;} var f={mode:'date',date:date}; saveFilter(f); applyFilter(f);};
  window.lotekaAnunciosFilterToday=function(){var f={mode:'today',date:todayKey()}; var input=qs('#annV49DateInput'); if(input) input.value=todayKey(); saveFilter(f); applyFilter(f);};
  window.lotekaAnunciosClearFilter=function(){var f={mode:'all'}; var input=qs('#annV49DateInput'); if(input) input.value=''; saveFilter(f); applyFilter(f);};
  function boot(){ensureFilters(); applyFilter(readFilter());}
  var oldOpen=window.lotekaOpenAnuncios;
  if(typeof oldOpen==='function' && !oldOpen.__v49FilterWrapped){
    var wrapped=function(){var r=oldOpen.apply(this,arguments); setTimeout(boot,80); setTimeout(boot,500); return r;};
    wrapped.__v49FilterWrapped=true; window.lotekaOpenAnuncios=wrapped;
  }
  var oldRefresh=window.lotekaAnunciosRefresh;
  if(typeof oldRefresh==='function' && !oldRefresh.__v49FilterWrapped){
    var wrappedR=function(){var r=oldRefresh.apply(this,arguments); setTimeout(boot,250); setTimeout(boot,900); return r;};
    wrappedR.__v49FilterWrapped=true; window.lotekaAnunciosRefresh=wrappedR;
  }
  var obsTimer=null;
  var obs=new MutationObserver(function(muts){
    var hit=false;
    muts.forEach(function(m){ if((m.target&&m.target.id==='annList') || qs('#annList')) hit=true; });
    if(hit){clearTimeout(obsTimer); obsTimer=setTimeout(boot,90);}
  });
  function startObs(){try{obs.observe(document.body,{childList:true,subtree:true});}catch(e){}}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){startObs(); setTimeout(boot,300);});
  else {startObs(); setTimeout(boot,300);}
  window.addEventListener('load',function(){setTimeout(boot,700); setTimeout(boot,1600);});
})();

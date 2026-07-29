
(function(){
  'use strict';
  if(window.__lotekaV17CsvMovimientosInstalled) return;
  window.__lotekaV17CsvMovimientosInstalled = true;

  function txt(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return txt(v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];}); }
  function norm(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function upper(v){ return txt(v).toUpperCase(); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function client(){ return window.lotekaSupabase || window.supabaseClient || null; }
  function getGlobalArray(name){ try{ if(Array.isArray(window[name])) return window[name]; }catch(e){} try{ if(typeof window[name] !== 'undefined' && Array.isArray(eval(name))) return eval(name); }catch(e){} return []; }
  function setGlobalArray(name,value){ window[name] = arr(value); try{ eval(name + '=window["' + name + '"];'); }catch(e){} }

  function getProductos(){ return getGlobalArray('productos'); }
  function productName(p){ return txt(p && (p.nombre || p.producto || p.descripcion || p.codigo)) || 'Producto'; }
  function productId(p){ return txt(p && (p.supabaseId || p.id || p.producto_id || p.productoId)); }
  function productCode(p){ return txt(p && (p.codigo || p.sku || p.cod)); }
  function productKey(p){ return norm([productId(p), productCode(p), productName(p), p && p.marca, p && p.modelo, p && p.categoria].join('|')); }
  function findProduct(value){
    var raw = txt(value); if(!raw) return null;
    var n = norm(raw); var list = getProductos();
    return list.find(function(p){ return productId(p) && productId(p) === raw; }) ||
      list.find(function(p){ return productCode(p) && norm(productCode(p)) === n; }) ||
      list.find(function(p){ return norm(productName(p)) === n; }) ||
      list.find(function(p){ var k=productKey(p); return k && (k.indexOf(n) >= 0 || n.indexOf(k) >= 0); }) || null;
  }

  function getEntryItems(){
    var options = [window.__lotekaV100Items, window.entradaActualItems, window.itemsEntradaActual];
    try{ options.push(entradaActualItems); }catch(e){}
    try{ options.push(itemsEntradaActual); }catch(e){}
    for(var i=0;i<options.length;i++){ if(Array.isArray(options[i]) && options[i].length) return options[i].slice(); }
    return [];
  }
  function setEntryItems(list){
    var items = arr(list);
    window.__lotekaV100Items = items;
    window.entradaActualItems = items;
    window.itemsEntradaActual = items;
    try{ entradaActualItems = items; }catch(e){}
    try{ itemsEntradaActual = items; }catch(e){}
  }
  function renderEntryItems(){
    var body = document.getElementById('entradaItemsBody');
    var table = document.getElementById('entradaItemsTabla');
    var empty = document.getElementById('entradaItemsVacio');
    if(!body) return;
    var list = getEntryItems();
    body.innerHTML = list.map(function(it,i){
      var ser = String(it.serializado || '').toLowerCase() === 'si' || it.serializado === true;
      var serialText = ser ? arr(it.seriales).join(', ') : '-';
      return '<tr><td>'+esc(it.producto || it.nombre || it.codigo)+'</td><td><strong>'+esc(it.cantidad || 0)+'</strong></td><td>'+(ser?'Sí':'No')+'</td><td>'+esc(serialText)+'</td><td><button class="entry-remove-btn" type="button" data-v100-remove="'+i+'"><i class="fas fa-trash"></i></button></td></tr>';
    }).join('');
    if(table) table.style.display = list.length ? 'table' : 'none';
    if(empty) empty.style.display = list.length ? 'none' : 'block';
  }

  function parseCsv(text){
    var rows = []; var row = []; var cell = ''; var quote = false;
    text = String(text || '').replace(/^\uFEFF/, '');
    for(var i=0;i<text.length;i++){
      var ch = text[i], next = text[i+1];
      if(ch === '"'){
        if(quote && next === '"'){ cell += '"'; i++; }
        else quote = !quote;
      }else if(ch === ',' && !quote){ row.push(cell); cell = ''; }
      else if((ch === '\n' || ch === '\r') && !quote){
        if(ch === '\r' && next === '\n') i++;
        row.push(cell); cell = '';
        if(row.some(function(v){ return txt(v); })) rows.push(row);
        row = [];
      }else cell += ch;
    }
    row.push(cell);
    if(row.some(function(v){ return txt(v); })) rows.push(row);
    return rows;
  }
  function splitSeriales(value){ return txt(value).split(/[;|,\n]+/).map(upper).filter(Boolean); }
  function csvToItems(text){
    var rows = parseCsv(text);
    if(!rows.length) return {items:[], errors:['El archivo está vacío.']};
    var headers = rows[0].map(norm);
    var hasHeader = headers.some(function(h){ return ['producto','codigo','nombre','cantidad','serial','seriales','serializado','observacion'].indexOf(h) >= 0; });
    var data = hasHeader ? rows.slice(1) : rows;
    function col(row,names){
      if(hasHeader){ for(var i=0;i<names.length;i++){ var idx = headers.indexOf(names[i]); if(idx >= 0) return txt(row[idx]); } return ''; }
      var map = {producto:0,codigo:0,nombre:0,cantidad:1,seriales:2,serial:2,serializado:3,observacion:4,nota:4,comentario:4};
      return txt(row[map[names[0]]] || '');
    }
    var items = [], errors = [];
    data.forEach(function(row,idx){
      var line = idx + (hasHeader ? 2 : 1);
      var prodValue = col(row,['producto','codigo','nombre']);
      var prod = findProduct(prodValue);
      if(!prod){ errors.push('Línea '+line+': producto no existe en el catálogo ('+prodValue+').'); return; }
      var seriales = splitSeriales(col(row,['seriales','serial']));
      var qty = Number(col(row,['cantidad','cant','unidades']) || 0);
      if(!qty || qty < 0) qty = seriales.length || 1;
      var serialFlag = norm(col(row,['serializado','requiere_serial','serializa']));
      var serializado = (seriales.length || ['si','sí','yes','true','1'].indexOf(serialFlag) >= 0) ? 'si' : 'no';
      if(serializado === 'si' && seriales.length && seriales.length !== qty) qty = seriales.length;
      items.push({
        producto: productName(prod), productoId: productId(prod), codigo: productCode(prod),
        marca: txt(prod.marca), modelo: txt(prod.modelo), categoria: txt(prod.categoria),
        cantidad: qty, serializado: serializado, seriales: serializado === 'si' ? seriales : [],
        observacion: col(row,['observacion','nota','comentario'])
      });
    });
    return {items:items, errors:errors};
  }

  window.lotekaDescargarPlantillaEntradaCSV = function(){
    var csv = 'producto,cantidad,seriales,serializado,observacion\nCamara,1,CAM-001,si,Entrada de prueba\nBateria,2,,no,Entrada masiva\nImpresora,2,IMP01;IMP02,si,Seriales separados por punto y coma\n';
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plantilla_entrada_inventario.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 500);
  };

  function ensureCsvPanel(){
    var modal = document.getElementById('modalEntrada');
    if(!modal || modal.querySelector('#lotekaCsvEntradaInput')) return;
    var builder = modal.querySelector('.entry-builder-card');
    if(!builder) return;
    var panel = document.createElement('div');
    panel.className = 'loteka-csv-entry-panel';
    panel.innerHTML = '<div><b><i class="fas fa-file-csv"></i> Entrada masiva por CSV</b><small>Importa varios productos y seriales sin agregarlos uno por uno.</small><div class="loteka-csv-help">Columnas aceptadas: <code>producto</code> o <code>codigo</code>, <code>cantidad</code>, <code>seriales</code>, <code>serializado</code>, <code>observacion</code>. Varios seriales: <code>IMP01;IMP02</code>.</div></div><div><div class="loteka-csv-actions"><button type="button" class="loteka-csv-btn" id="lotekaCsvPlantillaBtn"><i class="fas fa-download"></i> Plantilla</button><button type="button" class="loteka-csv-btn primary" id="lotekaCsvImportBtn"><i class="fas fa-upload"></i> Importar CSV</button><input id="lotekaCsvEntradaInput" type="file" accept=".csv,text/csv" style="display:none"></div><div id="lotekaCsvEntradaStatus" class="loteka-csv-status"></div></div>';
    builder.parentNode.insertBefore(panel, builder);
    var input = panel.querySelector('#lotekaCsvEntradaInput');
    var status = panel.querySelector('#lotekaCsvEntradaStatus');
    panel.querySelector('#lotekaCsvPlantillaBtn').addEventListener('click', function(){ window.lotekaDescargarPlantillaEntradaCSV(); });
    panel.querySelector('#lotekaCsvImportBtn').addEventListener('click', function(){ input.click(); });
    input.addEventListener('change', function(){
      var file = this.files && this.files[0]; if(!file) return;
      var reader = new FileReader();
      reader.onload = function(ev){
        var result = csvToItems(ev.target.result || '');
        if(result.errors.length) alert('Revisa el CSV:\n- ' + result.errors.join('\n- '));
        if(!result.items.length){ if(status) status.textContent = 'No se importó ningún producto.'; return; }
        var next = getEntryItems().concat(result.items);
        setEntryItems(next);
        renderEntryItems();
        if(status) status.textContent = result.items.length + ' producto(s) importado(s).';
      };
      reader.readAsText(file, 'utf-8');
      this.value = '';
    });
  }

  var originalAbrirEntrada = window.abrirEntrada;
  if(typeof originalAbrirEntrada === 'function'){
    window.abrirEntrada = function(){ var res = originalAbrirEntrada.apply(this, arguments); setTimeout(ensureCsvPanel, 120); return res; };
    try{ abrirEntrada = window.abrirEntrada; }catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(ensureCsvPanel, 300); });
  else setTimeout(ensureCsvPanel, 300);



})();


(function(){
  'use strict';
  if(window.__lotekaV153EntradasAgrupadasRealesFix) return;
  window.__lotekaV153EntradasAgrupadasRealesFix = true;

  var cache = {rows:[], last:0, loading:false, page:1, per:10};
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return clean(v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];}); }
  function low(v){ return clean(v).toLowerCase(); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function sb(){ return window.lotekaSupabase || window.supabaseClient || null; }
  function dateObj(v){ var d = v ? new Date(v) : new Date(); return isNaN(d.getTime()) ? new Date() : d; }
  function ymd(v){ return dateObj(v).toISOString().slice(0,10); }
  function hm(v){ try{return dateObj(v).toLocaleString('es-DO',{hour:'2-digit',minute:'2-digit'});}catch(e){return '';} }
  function dt(v){ try{return dateObj(v).toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return clean(v);} }
  function uuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(v)); }
  function nkey(v){ return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' '); }
  function refFromMovement(m){
    var text = [m && m.motivo, m && m.observaciones].map(clean).join(' ');
    var matches = text.match(/\bEN[-\s]*[0-9A-Za-z]+(?:[-\s]*[0-9A-Za-z]+)?\b/ig) || [];
    if(matches.length){ return matches[0].replace(/\s+/g,'-').toUpperCase(); }
    return '';
  }
  function bucket10(v){ return Math.floor(dateObj(v).getTime() / 600000); }
  function productMeta(id, prodMap){
    var p = prodMap[clean(id)] || {};
    return {nombre:clean(p.nombre || p.name || p.codigo || 'Producto'), codigo:clean(p.codigo||''), marca:clean(p.marca||'-'), modelo:clean(p.modelo||'-'), categoria:clean(p.categoria||'Inventario')};
  }
  function serialText(id, serialMap){ var s = serialMap[clean(id)] || {}; return clean(s.serial || s.codigo || ''); }
  async function loadMaps(client, movimientos){
    var pids = Array.from(new Set(movimientos.map(function(m){return clean(m.producto_id);}).filter(uuid)));
    var sids = Array.from(new Set(movimientos.map(function(m){return clean(m.serial_id);}).filter(uuid)));
    var prodMap={}, serialMap={};
    try{ if(pids.length){ var pr=await client.from('productos').select('*').in('id',pids); if(!pr.error) arr(pr.data).forEach(function(p){prodMap[clean(p.id)]=p;}); } }catch(e){}
    try{ if(sids.length){ var sr=await client.from('equipos_seriales').select('*').in('id',sids); if(!sr.error) arr(sr.data).forEach(function(s){serialMap[clean(s.id)]=s;}); } }catch(e){}
    return {prodMap:prodMap,serialMap:serialMap};
  }
  function buildEntries(movimientos, prodMap, serialMap){
    var ordered = arr(movimientos).slice().sort(function(a,b){ return dateObj(a.creado_en)-dateObj(b.creado_en); });
    var groups = [];
    ordered.forEach(function(m){
      var ref = refFromMovement(m);
      var created = m.creado_en || new Date().toISOString();
      var softKey = [ref || 'SIN-REFERENCIA', ymd(created), bucket10(created), clean(m.destino_id||m.destino_nombre), clean(m.origen_nombre||m.origen_tipo), clean(m.usuario_nombre)].join('|');
      var g = groups.find(function(x){ return x._softKey === softKey; });
      if(!g){
        g = {_softKey:softKey, referenciaOriginal: ref || '', codigo:'', almacen:clean(m.destino_nombre||'Almacén'), almacenId:clean(m.destino_id||''), suplidor:clean(m.origen_nombre||'Suplidor General'), usuario:clean(m.usuario_nombre||'Usuario'), fechaISO:ymd(created), fechaHora:dt(created), hora:hm(created), estado:'Registrada', observacion:clean(m.observaciones||''), unidades:0, serializado:'no', items:[], _itemsMap:new Map(), _created:created};
        groups.push(g);
      }
      var meta = productMeta(m.producto_id, prodMap);
      var serial = serialText(m.serial_id, serialMap);
      var qty = Number(m.cantidad||0) || (serial ? 1 : 0) || 1;
      var itemKey = clean(m.producto_id || meta.nombre);
      if(serial) itemKey += '|' + serial;
      if(!g._itemsMap.has(itemKey)){
        var it = {producto:meta.nombre,codigo:meta.codigo,marca:meta.marca,modelo:meta.modelo,categoria:meta.categoria,cantidad:0,serializado:serial?'si':'no',seriales:[]};
        g._itemsMap.set(itemKey,it); g.items.push(it);
      }
      var it2 = g._itemsMap.get(itemKey);
      it2.cantidad += qty;
      if(serial && it2.seriales.indexOf(serial)<0) it2.seriales.push(serial);
      if(serial){ g.serializado='si'; }
      g.unidades += qty;
      if(m.destino_nombre) g.almacen = clean(m.destino_nombre);
      if(m.origen_nombre) g.suplidor = clean(m.origen_nombre);
      if(m.usuario_nombre) g.usuario = clean(m.usuario_nombre);
      if(m.observaciones && !g.observacion) g.observacion = clean(m.observaciones);
    });
    var perYear = {};
    groups.sort(function(a,b){ return dateObj(a._created)-dateObj(b._created); }).forEach(function(g){
      var year = String(dateObj(g._created).getFullYear());
      perYear[year] = (perYear[year]||0)+1;
      g.codigo = 'EN-' + year + '-' + perYear[year];
      g.codigoSistema = g.referenciaOriginal || g.codigo;
      g.items.forEach(function(i){ if(i.serializado === 'si' && i.seriales.length){ i.cantidad = i.seriales.length; } });
      g.items.sort(function(a,b){ return clean(a.producto).localeCompare(clean(b.producto),'es'); });
      g.productosResumen = g.items.map(function(i){ return (i.cantidad||0)+' x '+i.producto+(i.codigo?' · '+i.codigo:''); }).join(' / ');
      g.producto = g.items.length === 1 ? g.productosResumen : (g.items.length + ' productos registrados');
      delete g._itemsMap; delete g._softKey;
    });
    return groups.sort(function(a,b){ return dateObj(b._created)-dateObj(a._created); });
  }
  function setEntradas(rows){ window.entradasInventario = rows; try{ entradasInventario = rows; }catch(e){} }
  function getEntradas(){ try{ if(Array.isArray(entradasInventario)) return entradasInventario; }catch(e){} return Array.isArray(window.entradasInventario)?window.entradasInventario:[]; }
  function updateDash(rows){
    var today = new Date().toISOString().slice(0,10);
    var hoy = rows.filter(function(r){return r.fechaISO === today;});
    var units = hoy.reduce(function(s,r){return s + (Number(r.unidades)||0);},0);
    var t=document.getElementById('dashTotalEntradas'), h=document.getElementById('dashEntradasHoy'), u=document.getElementById('dashUnidadesEntradasHoy');
    if(t) t.textContent = rows.length;
    if(h) h.textContent = hoy.length;
    if(u) u.textContent = units;
  }
  function fillSelect(id, values, label){
    var el=document.getElementById(id); if(!el) return;
    var cur=el.value||''; var unique=Array.from(new Set(values.map(clean).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'es');});
    el.innerHTML='<option value="">'+esc(label||'Todos')+'</option>'+unique.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');
    if(cur && unique.indexOf(cur)>=0) el.value=cur;
  }
  function refreshFilters(rows){
    fillSelect('filtroEntradaAlmacen', rows.map(function(r){return r.almacen;}), 'Todos');
    fillSelect('filtroEntradaProducto', [].concat.apply([], rows.map(function(r){return arr(r.items).map(function(i){return i.producto;});})), 'Todos');
    fillSelect('filtroEntradaSuplidor', rows.map(function(r){return r.suplidor;}), 'Todos');
    fillSelect('filtroEntradaUsuario', rows.map(function(r){return r.usuario;}), 'Todos');
  }
  function filtered(){
    var rows=getEntradas();
    var almacen=low(document.getElementById('filtroEntradaAlmacen')&&document.getElementById('filtroEntradaAlmacen').value);
    var producto=low(document.getElementById('filtroEntradaProducto')&&document.getElementById('filtroEntradaProducto').value);
    var desde=clean(document.getElementById('filtroEntradaDesde')&&document.getElementById('filtroEntradaDesde').value);
    var hasta=clean(document.getElementById('filtroEntradaHasta')&&document.getElementById('filtroEntradaHasta').value);
    var suplidor=low(document.getElementById('filtroEntradaSuplidor')&&document.getElementById('filtroEntradaSuplidor').value);
    var serializado=low((document.getElementById('filtroEntradaSerializado')&&document.getElementById('filtroEntradaSerializado').value)||'todos');
    var usuario=low(document.getElementById('filtroEntradaUsuario')&&document.getElementById('filtroEntradaUsuario').value);
    var buscar=low(document.getElementById('buscarEntrada')&&document.getElementById('buscarEntrada').value);
    return rows.filter(function(r){
      var txt=low([r.codigo,r.codigoSistema,r.almacen,r.suplidor,r.usuario,r.productosResumen,r.observacion].join(' '));
      if(almacen && low(r.almacen).indexOf(almacen)<0) return false;
      if(producto && low(r.productosResumen).indexOf(producto)<0) return false;
      if(suplidor && low(r.suplidor).indexOf(suplidor)<0) return false;
      if(usuario && low(r.usuario).indexOf(usuario)<0) return false;
      if(serializado && serializado !== 'todos' && low(r.serializado) !== serializado) return false;
      if(desde && r.fechaISO < desde) return false;
      if(hasta && r.fechaISO > hasta) return false;
      if(buscar && txt.indexOf(buscar)<0) return false;
      return true;
    });
  }
  function entradaPagerHost(){
    var tbody=document.getElementById('tabla-entradas'); if(!tbody) return null;
    var table=tbody.closest('table'); if(!table) return null;
    var host=document.getElementById('tabla-entradas-pager');
    if(!host){ host=document.createElement('div'); host.id='tabla-entradas-pager'; host.className='ltk-entry-pager'; table.parentNode.insertBefore(host, table.nextSibling); }
    return host;
  }
  function renderEntradaPager(total){
    var host=entradaPagerHost(); if(!host) return;
    var per=Number(cache.per)||10;
    var pages=Math.max(1, Math.ceil(total/per));
    cache.page=Math.min(Math.max(1, Number(cache.page)||1), pages);
    if(total<=per){ host.innerHTML=''; return; }
    var html='';
    html+='<button type="button" '+(cache.page<=1?'disabled':'')+' onclick="lotekaEntradaGoPage(1)">&laquo;</button>';
    html+='<button type="button" '+(cache.page<=1?'disabled':'')+' onclick="lotekaEntradaGoPage('+(cache.page-1)+')">&lsaquo;</button>';
    var start=Math.max(1, cache.page-2), end=Math.min(pages, start+4); start=Math.max(1,end-4);
    for(var i=start;i<=end;i++){ html+='<button type="button" class="'+(i===cache.page?'active':'')+'" onclick="lotekaEntradaGoPage('+i+')">'+i+'</button>'; }
    html+='<button type="button" '+(cache.page>=pages?'disabled':'')+' onclick="lotekaEntradaGoPage('+(cache.page+1)+')">&rsaquo;</button>';
    html+='<button type="button" '+(cache.page>=pages?'disabled':'')+' onclick="lotekaEntradaGoPage('+pages+')">&raquo;</button>';
    html+='<select onchange="lotekaEntradaPageSize(this.value)"><option value="10" '+(per===10?'selected':'')+'>10</option><option value="25" '+(per===25?'selected':'')+'>25</option><option value="50" '+(per===50?'selected':'')+'>50</option></select>';
    host.innerHTML=html;
  }
  function renderOnly(){
    var tbody=document.getElementById('tabla-entradas'); if(!tbody) return;
    var rows=filtered();
    if(!rows.length){ tbody.innerHTML='<tr><td colspan="8" class="entry-empty">No hay entradas que coincidan con los filtros seleccionados.</td></tr>'; renderEntradaPager(0); updateDash(getEntradas()); return; }
    var per=Number(cache.per)||10;
    var pages=Math.max(1, Math.ceil(rows.length/per));
    cache.page=Math.min(Math.max(1, Number(cache.page)||1), pages);
    var start=(cache.page-1)*per;
    var visibleRows=rows.slice(start,start+per);
    tbody.innerHTML=visibleRows.map(function(r){
      var sub = r.items.length === 1 ? r.productosResumen : r.productosResumen;
      return '<tr>'+ 
        '<td><span class="ltk-entry-code"><i class="fas fa-box-open"></i>'+esc(r.codigo)+'</span><div class="small-muted">'+esc(r.codigoSistema||'')+'</div></td>'+ 
        '<td>'+esc(r.almacen)+'</td>'+ 
        '<td><div class="ltk-entry-product-cell"><strong>'+esc(r.producto)+'</strong><small title="'+esc(sub)+'">'+esc(sub)+'</small></div></td>'+ 
        '<td><strong>'+esc(r.unidades)+'</strong></td>'+ 
        '<td><div class="ltk-entry-date-chip"><strong>'+esc(r.fechaISO)+'</strong><span>'+esc(r.hora||'')+'</span></div></td>'+ 
        '<td>'+esc(r.usuario)+'</td>'+ 
        '<td><span class="status-badge">'+esc(r.estado||'Registrada')+'</span></td>'+ 
        '<td class="actions"><button type="button" class="btn-secondary" style="padding:8px 12px;border-radius:12px" onclick="verDetalleEntrada(\''+esc(r.codigo)+'\')"><i class="fas fa-eye"></i> Consultar</button></td>'+ 
      '</tr>';
    }).join('');
    renderEntradaPager(rows.length);
    updateDash(getEntradas());
  }
  async function loadEntradas(force){
    var client=sb();
    if(!client){ renderOnly(); return getEntradas(); }
    var now=Date.now();
    if(cache.loading) return getEntradas();
    if(!force && cache.rows.length && (now-cache.last)<8000){ renderOnly(); return cache.rows; }
    cache.loading=true;
    var tbody=document.getElementById('tabla-entradas');
    if(tbody && !cache.rows.length) tbody.innerHTML='<tr><td colspan="8" class="entry-empty"><i class="fas fa-spinner fa-spin"></i> Cargando entradas reales...</td></tr>';
    try{
      var res=await client.from('movimientos_inventario').select('*').ilike('tipo_movimiento','Entrada').order('creado_en',{ascending:false}).limit(5000);
      if(res.error) throw res.error;
      var movs=arr(res.data);
      var maps=await loadMaps(client,movs);
      var rows=buildEntries(movs,maps.prodMap,maps.serialMap);
      cache.rows=rows; cache.last=Date.now(); setEntradas(rows); refreshFilters(rows); renderOnly(); return rows;
    }catch(e){ console.error('[LOTEKA v153] Error cargando entradas:',e); if(tbody) tbody.innerHTML='<tr><td colspan="8" class="entry-empty">No se pudo cargar Entradas: '+esc(e.message||e)+'</td></tr>'; return getEntradas(); }
    finally{ cache.loading=false; }
  }
  window.lotekaCargarHistorialEntradas = function(force){ return loadEntradas(force !== false); };
  window.renderEntradas = function(){ return loadEntradas(false); };
  window.aplicarFiltrosEntrada = function(){ cache.page=1; return renderOnly(); };
  window.limpiarFiltrosEntrada = function(){
    ['filtroEntradaAlmacen','filtroEntradaProducto','filtroEntradaDesde','filtroEntradaHasta','filtroEntradaSuplidor','filtroEntradaUsuario','buscarEntrada'].forEach(function(id){var e=document.getElementById(id); if(e)e.value='';});
    var s=document.getElementById('filtroEntradaSerializado'); if(s) s.value='todos';
    cache.page=1;
    renderOnly();
  };
  window.lotekaEntradaGoPage=function(p){ cache.page=Number(p)||1; renderOnly(); };
  window.lotekaEntradaPageSize=function(v){ cache.per=Number(v)||10; cache.page=1; renderOnly(); };
  window.verDetalleEntrada = function(codigo){
    var r=getEntradas().find(function(x){return String(x.codigo)===String(codigo);});
    if(!r){ alert('No se encontró el detalle de esta entrada. Actualiza e intenta de nuevo.'); return; }
    var title=document.getElementById('detalleEntradaTitulo'), cod=document.getElementById('detalleEntradaCodigo'), meta=document.getElementById('detalleEntradaMeta'), res=document.getElementById('detalleEntradaResumen'), body=document.getElementById('detalleEntradaItemsBody');
    if(title) title.textContent='Detalle de Entrada de Inventario';
    if(cod) cod.innerHTML='<span class="ltk-entry-code"><i class="fas fa-box-open"></i>'+esc(r.codigo)+'</span>';
    if(meta) meta.textContent=(r.almacen||'Almacén')+' · '+(r.fechaHora||r.fechaISO)+' · '+(r.usuario||'Usuario');
    if(res) res.innerHTML='<div class="ltk-entry-detail-head"><div class="ltk-entry-detail-card"><h4>'+esc(r.almacen)+'</h4><p>Entrada registrada con '+esc(r.items.length)+' producto(s) y '+esc(r.unidades)+' unidad(es). Código de sistema: '+esc(r.codigoSistema||'N/D')+'.</p></div><div class="ltk-entry-mini-grid"><div class="ltk-entry-mini"><b>Suplidor</b><span>'+esc(r.suplidor||'N/D')+'</span></div><div class="ltk-entry-mini"><b>Fecha</b><span>'+esc(r.fechaHora||r.fechaISO)+'</span></div><div class="ltk-entry-mini"><b>Serializado</b><span>'+esc(r.serializado==='si'?'Sí':'No')+'</span></div><div class="ltk-entry-mini"><b>Estado</b><span>'+esc(r.estado||'Registrada')+'</span></div></div></div><div class="ltk-entry-detail-card"><h4>Observación</h4><p>'+esc(r.observacion||'Sin observación registrada.')+'</p></div>';
    if(body) body.innerHTML=arr(r.items).map(function(i){ return '<tr><td>'+esc(i.producto)+'</td><td>'+esc(i.marca||'-')+'</td><td>'+esc(i.modelo||'-')+'</td><td>'+esc(i.categoria||'-')+'</td><td><strong>'+esc(i.cantidad)+'</strong></td><td>'+esc(i.serializado==='si'?'Serializado':'No serializado')+'</td><td>'+esc(i.seriales&&i.seriales.length?i.seriales.join(', '):'No aplica')+'</td></tr>'; }).join('') || '<tr><td colspan="7">Sin productos registrados.</td></tr>';
    var modal=document.getElementById('modalDetalleEntrada'); if(modal) modal.style.display='flex';
  };
  var oldCambiarVista = window.cambiarVista;
  if(typeof oldCambiarVista === 'function' && !oldCambiarVista.__entradaV153){
    var wrapped=function(vista, el){ var r=oldCambiarVista.apply(this,arguments); if(String(vista)==='entrada') setTimeout(function(){ loadEntradas(true); },120); return r; };
    wrapped.__entradaV153=true; window.cambiarVista=wrapped; try{ cambiarVista=wrapped; }catch(e){}
  }
  window.addEventListener('load', function(){ setTimeout(function(){ if(document.getElementById('tabla-entradas')) loadEntradas(true); },1300); });
})();

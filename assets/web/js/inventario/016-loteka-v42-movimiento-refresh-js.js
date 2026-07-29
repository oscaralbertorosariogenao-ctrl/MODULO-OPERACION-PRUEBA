
(function(){
  'use strict';
  var TAG = 'LOTEKA v42 movimiento real';
  function arr(v){ return Array.isArray(v) ? v : []; }
  function txt(v){ return String(v == null ? '' : v); }
  function esc(v){ return txt(v).replace(/[&<>\"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]; }); }
  function key(v){ return txt(v).replace(/\s+/g,'').toUpperCase().trim(); }
  function norm(v){ try { return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); } catch(e){ return txt(v).toLowerCase().trim(); } }
  function today(){ try { return new Date().toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'}); } catch(e){ return new Date().toISOString().slice(0,10); } }
  function nowObj(){
    try { if(typeof obtenerFechaHoraActual === 'function') return obtenerFechaHoraActual(); } catch(e){}
    var d = new Date();
    var dd = String(d.getDate()).padStart(2,'0'), mm = String(d.getMonth()+1).padStart(2,'0'), yy = d.getFullYear();
    var hh = String(d.getHours()).padStart(2,'0'), mi = String(d.getMinutes()).padStart(2,'0');
    return {fecha:dd+'-'+mm+'-'+yy,hora:hh+':'+mi,fechaHora:dd+'/'+mm+'/'+yy+', '+hh+':'+mi,fechaISO:yy+'-'+mm+'-'+dd};
  }
  function userName(){ try { return usuarioMovimientoFijo || 'Sistema'; } catch(e){ return 'Sistema'; } }
  function getAgencias(){ try { if(typeof agencias !== 'undefined' && Array.isArray(agencias)) return agencias; } catch(e){} if(!Array.isArray(window.agencias)) window.agencias = []; return window.agencias; }
  function getAlmacenes(){ try { if(typeof almacenes !== 'undefined' && Array.isArray(almacenes)) return almacenes; } catch(e){} if(!Array.isArray(window.almacenes)) window.almacenes = []; return window.almacenes; }
  function getProductos(){ try { if(typeof productos !== 'undefined' && Array.isArray(productos)) return productos; } catch(e){} if(!Array.isArray(window.productos)) window.productos = []; return window.productos; }
  function getTransfers(){ try { if(typeof transferenciasInventario !== 'undefined' && Array.isArray(transferenciasInventario)) return transferenciasInventario; } catch(e){} if(!Array.isArray(window.transferenciasInventario)) window.transferenciasInventario = []; return window.transferenciasInventario; }
  function agencyName(ag){ return (ag && (ag.nombre || ag.sucursal)) || ('Agencia ' + txt(ag && ag.numero || ag && ag.id || '').padStart(4,'0')); }
  function productImage(item){
    try { if(typeof obtenerImagenProducto === 'function') return obtenerImagenProducto(item.producto || item.nombre, item.marca, item.modelo); } catch(e){}
    var p = getProductos().find(function(x){ return norm(x.nombre || x.producto) === norm(item.producto || item.nombre); });
    return item.imagen || item.foto || (p && p.imagen) || 'https://cdn-icons-png.flaticon.com/512/1829/1829586.png';
  }
  function categoriaDesdeInventario(categoria, producto){
    try { if(typeof obtenerCategoriaAgenciaDesdeInventario === 'function') return obtenerCategoriaAgenciaDesdeInventario(categoria, producto); } catch(e){}
    var c = norm(categoria), p = norm(producto);
    if(c.indexOf('cam') >= 0 || p.indexOf('cam') >= 0) return 'camara';
    if(c.indexOf('router') >= 0 || p.indexOf('router') >= 0) return 'routers';
    if(c.indexOf('elect') >= 0 || p.indexOf('ups') >= 0 || p.indexOf('inversor') >= 0 || p.indexOf('bater') >= 0) return 'electricos';
    if(c.indexOf('adicional') >= 0) return 'adicional';
    return 'equipos';
  }
  function serialesInv(inv){
    var s = [];
    if(inv && inv.serial) s.push(inv.serial);
    if(inv && Array.isArray(inv.seriales)) s = s.concat(inv.seriales);
    if(inv && Array.isArray(inv.series)) s = s.concat(inv.series);
    return Array.from(new Set(s.map(txt).filter(Boolean)));
  }
  function findSerialInWarehouses(serial){
    var k = key(serial); if(!k) return null;
    var alms = getAlmacenes();
    for(var ai=0; ai<alms.length; ai++){
      var invs = arr(alms[ai].inventario);
      for(var ii=0; ii<invs.length; ii++){
        var real = serialesInv(invs[ii]).find(function(s){ return key(s) === k; });
        if(real) return {almacen:alms[ai], almacenIndex:ai, inventario:invs[ii], inventarioIndex:ii, serial:real};
      }
    }
    return null;
  }
  function removeSerialFromWarehouse(found){
    if(!found || !found.inventario) return;
    var inv = found.inventario, k = key(found.serial);
    if(Array.isArray(inv.seriales)) inv.seriales = inv.seriales.filter(function(s){ return key(s) !== k; });
    if(Array.isArray(inv.series)) inv.series = inv.series.filter(function(s){ return key(s) !== k; });
    if(key(inv.serial) === k) inv.serial = '';
    var qty = serialesInv(inv).length;
    if((inv.tipo || '').toLowerCase().indexOf('serial') >= 0 || qty >= 0) inv.cantidad = qty;
    if(found.almacen && Array.isArray(found.almacen.inventario) && qty === 0 && Number(inv.cantidad || 0) <= 0){
      // Mantener la fila del producto, pero sin seriales, evita romper catálogos y deja trazabilidad del producto.
      inv.cantidad = 0;
    }
  }
  function addSerialToWarehouse(almacen, item){
    if(!almacen) return null;
    if(!Array.isArray(almacen.inventario)) almacen.inventario = [];
    var k = key(item.serial);
    var inv = almacen.inventario.find(function(x){ return norm(x.producto || x.nombre) === norm(item.producto || item.nombre) && norm(x.marca) === norm(item.marca) && norm(x.modelo) === norm(item.modelo); });
    if(!inv){
      inv = {producto:item.producto || item.nombre || 'Equipo', nombre:item.producto || item.nombre || 'Equipo', marca:item.marca || '', modelo:item.modelo || '', categoria:item.categoria || 'equipos', cantidad:0, tipo:'Serializado', seriales:[], series:[]};
      almacen.inventario.push(inv);
    }
    inv.tipo = 'Serializado';
    if(!Array.isArray(inv.seriales)) inv.seriales = [];
    if(k && !inv.seriales.some(function(s){ return key(s) === k; })) inv.seriales.push(item.serial);
    inv.series = inv.seriales.slice();
    inv.serial = inv.seriales.length === 1 ? inv.seriales[0] : '';
    inv.cantidad = serialesInv(inv).length;
    return inv;
  }
  function removeSerialFromAllAgencies(serial, itemId){
    var k = key(serial);
    getAgencias().forEach(function(ag){
      if(!Array.isArray(ag.equipos)) ag.equipos = [];
      ag.equipos = ag.equipos.filter(function(eq){
        if(k && key(eq.serial) === k) return false;
        if(itemId && String(eq.id) === String(itemId)) return false;
        return true;
      });
    });
    try {
      if(Array.isArray(window.agenciaPendienteSeriales)) window.agenciaPendienteSeriales = window.agenciaPendienteSeriales.filter(function(eq){ return !(k && key(eq.serial) === k); });
      if(typeof agenciaPendienteSeriales !== 'undefined') agenciaPendienteSeriales = window.agenciaPendienteSeriales || [];
    } catch(e){}
  }
  function syncAgenciesAgainstWarehouses(){
    var warehouseSerials = new Set();
    getAlmacenes().forEach(function(alm){ arr(alm.inventario).forEach(function(inv){ serialesInv(inv).forEach(function(s){ warehouseSerials.add(key(s)); }); }); });
    getAgencias().forEach(function(ag){
      if(!Array.isArray(ag.equipos)) ag.equipos = [];
      ag.equipos = ag.equipos.filter(function(eq){ return !eq.serial || !warehouseSerials.has(key(eq.serial)); });
    });
  }
  function ensureTransferRecord(data){
    var trs = getTransfers();
    if(data.codigo && trs.some(function(t){ return t.codigo === data.codigo; })) return;
    trs.unshift(data);
  }
  function setAgencyCounters(ag){
    try {
      if(typeof agencySetText === 'function'){
        agencySetText('detalleAgenciaEquipos', arr(ag.equipos).length);
        agencySetText('detalleAgenciaSeriales', arr(ag.equipos).filter(function(x){ return !!x.serial; }).length);
        agencySetText('detalleAgenciaCamaras', arr(ag.equipos).filter(function(x){ return x.categoria === 'camara'; }).length);
        agencySetText('detalleAgenciaRouters', arr(ag.equipos).filter(function(x){ return x.categoria === 'routers'; }).length);
      }
    } catch(e){}
  }
  function renderAgencyInventory(){
    syncAgenciesAgainstWarehouses();
    var idx = (typeof agenciaDetalleActualIndex !== 'undefined') ? agenciaDetalleActualIndex : window.agenciaDetalleActualIndex;
    if(idx === null || idx === undefined) return;
    var ag = getAgencias()[Number(idx)]; if(!ag) return;
    if(!Array.isArray(ag.equipos)) ag.equipos = [];
    var tbody = document.getElementById('detalleAgenciaInventarioBody'); if(!tbody) return;
    var table = tbody.closest('table');
    var head = table && table.querySelector('thead tr');
    if(head) head.innerHTML = '<th>#</th><th>Producto</th><th>Imagen</th><th>Marca</th><th>Modelo</th><th>Serial / estado</th><th>Instalación</th><th>Acción</th>';
    var cat = window.agenciaTabActual || (typeof agenciaTabActual !== 'undefined' ? agenciaTabActual : 'equipos');
    var pending = arr(window.agenciaPendienteSeriales || (typeof agenciaPendienteSeriales !== 'undefined' ? agenciaPendienteSeriales : [])).filter(function(item){ return txt(item.categoria || 'equipos') === txt(cat); });
    var items = arr(ag.equipos).filter(function(item){ return txt(item.categoria || 'equipos') === txt(cat); }).concat(pending);
    if(!items.length){
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#789;font-style:italic;font-weight:800;padding:26px">No hay equipos registrados en esta categoría.</td></tr>';
      setAgencyCounters(ag);
      return;
    }
    tbody.innerHTML = items.map(function(item, i){
      var estado = item.pending ? 'Pendiente de guardar' : 'Instalado en agencia';
      var chipClass = item.pending ? 'pending' : 'installed';
      var action = item.pending ? '<i class="fas fa-clock" title="Pendiente de guardar"></i>' : '<i class="fas fa-right-left" title="Transferir / mover a almacén" onclick="abrirMiniTransferenciaAgencia(\'' + esc(item.id) + '\')"></i>';
      var historial = item.serial ? ' <i class="fas fa-route" title="Historial por serial" onclick="lotekaAbrirHistorialAgenciaSerial(\'' + esc(item.serial) + '\')"></i>' : '';
      return '<tr><td>' + esc(i+1) + '</td>' +
        '<td><b>' + esc(item.producto || 'Equipo') + '</b><div style="font-size:11px;color:#6e8397;font-weight:800;margin-top:4px">Inventario / Almacenes</div></td>' +
        '<td><img class="agency-item-thumb" src="' + esc(item.imagen || productImage(item)) + '" alt="' + esc(item.producto || 'Equipo') + '"></td>' +
        '<td>' + esc(item.marca || '-') + '</td>' +
        '<td>' + esc(item.modelo || '-') + '</td>' +
        '<td><span class="serial-chip">' + esc(item.serial || 'Sin serial') + '</span><div style="margin-top:6px"><span class="agency-inv-chip ' + chipClass + '">' + esc(estado) + '</span></div>' + (item.pending ? '<div style="margin-top:6px;font-size:11px;color:#6b7d8d">Desde ' + esc(item.almacenNombre || 'almacén') + '</div>' : '') + '</td>' +
        '<td>' + esc(item.fechaInstalacion || today()) + '</td>' +
        '<td class="actions">' + action + historial + '</td></tr>';
    }).join('');
    setAgencyCounters(ag);
  }
  function injectNote(){
    var body = document.querySelector('[data-section="ficha"] .agency-form-card-body');
    if(!body || body.querySelector('.agency-v42-note')) return;
    var note = document.createElement('div');
    note.className = 'agency-v42-note';
    note.innerHTML = '<i class="fas fa-right-left"></i><div>Movimiento real conectado a inventario<small>Si un equipo sale de una agencia, desaparece de esta ficha y queda únicamente en el almacén destino. Cada cambio actualiza las vistas internas al instante.</small></div>';
    var toolbar = body.querySelector('.agency-toolbar');
    if(toolbar) body.insertBefore(note, toolbar); else body.prepend(note);
  }
  function agregarSerialRapido(){
    var idx = (typeof agenciaDetalleActualIndex !== 'undefined') ? agenciaDetalleActualIndex : window.agenciaDetalleActualIndex;
    if(idx === null || idx === undefined) return;
    var input = document.getElementById('buscarSerialAgencia');
    var serial = txt(input && input.value).trim();
    if(!serial){ alert('Escribe o pega un serial.'); return; }
    var ag = getAgencias()[Number(idx)]; if(!ag) return;
    if(!Array.isArray(ag.equipos)) ag.equipos = [];
    if(arr(ag.equipos).some(function(eq){ return key(eq.serial) === key(serial); }) || arr(window.agenciaPendienteSeriales || []).some(function(eq){ return key(eq.serial) === key(serial); })){
      alert('Ese serial ya existe o ya fue agregado a esta agencia.'); return;
    }
    var found = findSerialInWarehouses(serial);
    if(!found){ alert('No se encontró ese serial en ningún almacén.'); return; }
    var inv = found.inventario;
    var item = {
      id:'tmp-' + Date.now() + '-' + Math.random().toString(16).slice(2,7),
      categoria:categoriaDesdeInventario(inv.categoria, inv.producto || inv.nombre),
      producto:inv.producto || inv.nombre || 'Equipo',
      imagen:inv.imagen || productImage(inv),
      marca:inv.marca || '', modelo:inv.modelo || '', serial:found.serial,
      fechaInstalacion:today(), pending:true,
      almacenIndex:found.almacenIndex, almacenNombre:found.almacen.nombre || 'Almacén', inventarioIndex:found.inventarioIndex,
      origenInventario:found.almacen.nombre || 'Almacén'
    };
    if(!Array.isArray(window.agenciaPendienteSeriales)) window.agenciaPendienteSeriales = [];
    window.agenciaPendienteSeriales.push(item);
    try { agenciaPendienteSeriales = window.agenciaPendienteSeriales; } catch(e){}
    if(input) input.value = '';
    window.agenciaTabActual = item.categoria;
    try { agenciaTabActual = item.categoria; } catch(e){}
    if(typeof activarTabAgencia === 'function') activarTabAgencia(item.categoria); else renderAgencyInventory();
  }
  function guardarDetalleAgencia(){
    var original = window.__lotekaGuardarDetalleOriginalV42 || window.guardarDetalleAgenciaCompleta || (typeof guardarDetalleAgenciaCompleta === 'function' ? guardarDetalleAgenciaCompleta : null);
    if(!window.__lotekaGuardarDetalleOriginalV42 && typeof original === 'function') window.__lotekaGuardarDetalleOriginalV42 = original;
    var idx = (typeof agenciaDetalleActualIndex !== 'undefined') ? agenciaDetalleActualIndex : window.agenciaDetalleActualIndex;
    var ag = getAgencias()[Number(idx)];
    var pending = arr(window.agenciaPendienteSeriales || (typeof agenciaPendienteSeriales !== 'undefined' ? agenciaPendienteSeriales : [])).map(function(x){ return Object.assign({}, x); });
    var result;
    if(typeof window.__lotekaGuardarDetalleOriginalV42 === 'function') result = window.__lotekaGuardarDetalleOriginalV42.apply(this, arguments);
    if(ag && pending.length){
      if(!Array.isArray(ag.equipos)) ag.equipos = [];
      var t = nowObj();
      pending.forEach(function(item){
        var found = findSerialInWarehouses(item.serial);
        if(found) removeSerialFromWarehouse(found);
        var exists = ag.equipos.some(function(eq){ return key(eq.serial) === key(item.serial); });
        if(!exists){
          var clean = Object.assign({}, item, {pending:false, estadoInventario:'Instalado en agencia', ubicacionActual:agencyName(ag)});
          ag.equipos.push(clean);
        }
        var ref = 'INST-AG-' + txt(ag.numero || ag.id || '0000').padStart(4,'0') + '-' + String(Date.now()).slice(-5);
        ensureTransferRecord({codigo:ref, origen:item.almacenNombre || 'Almacén', destino:agencyName(ag), producto:item.producto || 'Equipo', productosResumen:(item.producto || 'Equipo') + ' [' + (item.serial || 'Sin serial') + ']', unidades:1, fecha:t.fecha, hora:t.hora, fechaHora:t.fechaHora, fechaISO:t.fechaISO, usuario:userName(), estado:'Completada', serializado:item.serial?'si':'no', observacion:'Instalación desde inventario hacia agencia.', items:[{producto:item.producto, marca:item.marca, modelo:item.modelo, categoria:item.categoria, cantidad:1, serializado:item.serial?'si':'no', seriales:item.serial?[item.serial]:[]}]});
      });
      window.agenciaPendienteSeriales = [];
      try { agenciaPendienteSeriales = []; } catch(e){}
    }
    lotekaRefreshAfterMutation('guardar agencia');
    return result;
  }
  function abrirMiniTransferencia(itemId){
    var idx = (typeof agenciaDetalleActualIndex !== 'undefined') ? agenciaDetalleActualIndex : window.agenciaDetalleActualIndex;
    var ag = getAgencias()[Number(idx)]; if(!ag) return;
    var item = arr(ag.equipos).find(function(eq){ return String(eq.id) === String(itemId); });
    if(!item){ alert('No se encontró el equipo seleccionado.'); return; }
    try { agenciaTransferItemId = item.id; } catch(e){}
    window.agenciaTransferItemId = item.id;
    try { if(typeof llenarMiniTransferenciaAlmacenes === 'function') llenarMiniTransferenciaAlmacenes(); } catch(e){}
    var p = document.getElementById('miniTransferProducto'); if(p) p.value = (item.producto || 'Equipo') + ' - ' + (item.marca || '-') + ' - ' + (item.modelo || '-');
    var s = document.getElementById('miniTransferSerial'); if(s) s.value = item.serial || '';
    var a = document.getElementById('miniTransferAlmacen'); if(a) a.value = '';
    var c = document.getElementById('miniTransferComentario'); if(c) c.value = '';
    var modal = document.getElementById('modalMiniTransferenciaAgencia'); if(modal) modal.style.display = 'flex';
  }
  function confirmarMiniTransferencia(){
    var idx = (typeof agenciaDetalleActualIndex !== 'undefined') ? agenciaDetalleActualIndex : window.agenciaDetalleActualIndex;
    var moveId = (typeof agenciaTransferItemId !== 'undefined') ? agenciaTransferItemId : window.agenciaTransferItemId;
    var ag = getAgencias()[Number(idx)]; if(!ag || !moveId) return;
    if(!Array.isArray(ag.equipos)) ag.equipos = [];
    var select = document.getElementById('miniTransferAlmacen');
    var almacenIndex = Number(select && select.value);
    if(select && select.value === ''){ alert('Selecciona el almacén destino.'); return; }
    var almacen = getAlmacenes()[almacenIndex];
    if(!almacen){ alert('No se encontró el almacén destino.'); return; }
    var itemIndex = ag.equipos.findIndex(function(eq){ return String(eq.id) === String(moveId); });
    if(itemIndex < 0){ alert('No se encontró el equipo en esta agencia.'); return; }
    if(!confirm('¿Estás seguro de mover este equipo fuera de la agencia?')) return;
    var item = ag.equipos[itemIndex];
    var comentario = txt(document.getElementById('miniTransferComentario') && document.getElementById('miniTransferComentario').value).trim();
    var t = nowObj();
    var ref = 'TR-AG-' + String(Date.now()).slice(-6);
    addSerialToWarehouse(almacen, item);
    removeSerialFromAllAgencies(item.serial, item.id);
    try { registrarMovimientoAlmacen(almacenIndex, 'Transferencia desde agencia', ref, comentario || ((item.producto || 'Equipo') + ' serial ' + (item.serial || '-') + ' recibido desde ' + agencyName(ag)), userName(), t, ref); } catch(e){}
    ensureTransferRecord({codigo:ref, origen:agencyName(ag), destino:almacen.nombre || 'Almacén', producto:item.producto || 'Equipo', productosResumen:(item.producto || 'Equipo') + ' [' + (item.serial || 'Sin serial') + ']', unidades:1, fecha:t.fecha, hora:t.hora, fechaHora:t.fechaHora, fechaISO:t.fechaISO, usuario:userName(), estado:'Completada', serializado:item.serial?'si':'no', observacion:comentario || 'Movimiento real desde agencia hacia almacén. El equipo sale de la ficha de la agencia.', items:[{producto:item.producto, marca:item.marca, modelo:item.modelo, categoria:item.categoria, cantidad:1, serializado:item.serial?'si':'no', seriales:item.serial?[item.serial]:[]}]});
    try { cerrarMiniTransferenciaAgencia(); } catch(e){ var modal = document.getElementById('modalMiniTransferenciaAgencia'); if(modal) modal.style.display = 'none'; }
    lotekaRefreshAfterMutation('mover equipo agencia');
    alert('Equipo movido correctamente hacia ' + (almacen.nombre || 'almacén destino') + '. Ya no aparece instalado en la agencia.');
  }
  function lotekaRefreshAfterMutation(context){
    try { syncAgenciesAgainstWarehouses(); } catch(e){ console.warn(TAG, 'sync', e); }
    var calls = ['renderAlmacenes','llenarSelectsTransferencia','renderTransferencias','renderEntradas','renderProductos','renderAgencias'];
    calls.forEach(function(name){ try { if(typeof window[name] === 'function') window[name](); else if(typeof eval(name) === 'function') eval(name)(); } catch(e){} });
    try { renderAgencyInventory(); } catch(e){}
    try { injectNote(); } catch(e){}
    try { if(typeof showToast === 'function') showToast('Actualizado: ' + (context || 'cambio aplicado')); } catch(e){}
  }
  function wrapAfter(name){
    var fn = window[name] || (function(){ try { return eval(name); } catch(e){ return null; } })();
    if(typeof fn !== 'function' || fn.__lotekaV42Wrapped) return;
    var wrapped = function(){ var r = fn.apply(this, arguments); setTimeout(function(){ lotekaRefreshAfterMutation(name); }, 60); return r; };
    wrapped.__lotekaV42Wrapped = true;
    window[name] = wrapped;
    try { eval(name + ' = window[name]'); } catch(e){}
  }
  function patchMenuAndActions(){
    window.renderDetalleAgenciaInventario = renderAgencyInventory;
    window.agregarSerialRapidoAgencia = agregarSerialRapido;
    window.abrirMiniTransferenciaAgencia = abrirMiniTransferencia;
    window.confirmarMiniTransferenciaAgencia = confirmarMiniTransferencia;
    window.guardarDetalleAgenciaCompleta = guardarDetalleAgencia;
    window.guardarCambiosAgencia = guardarDetalleAgencia;
    try { renderDetalleAgenciaInventario = renderAgencyInventory; agregarSerialRapidoAgencia = agregarSerialRapido; abrirMiniTransferenciaAgencia = abrirMiniTransferencia; confirmarMiniTransferenciaAgencia = confirmarMiniTransferencia; guardarDetalleAgenciaCompleta = guardarDetalleAgencia; guardarCambiosAgencia = guardarDetalleAgencia; } catch(e){}
    var oldVer = window.verDetalleAgencia || (typeof verDetalleAgencia === 'function' ? verDetalleAgencia : null);
    if(typeof oldVer === 'function' && !oldVer.__lotekaV42Wrapped){
      var wrappedVer = function(){ var r = oldVer.apply(this, arguments); setTimeout(function(){ syncAgenciesAgainstWarehouses(); injectNote(); renderAgencyInventory(); }, 100); return r; };
      wrappedVer.__lotekaV42Wrapped = true;
      window.verDetalleAgencia = wrappedVer;
      try { verDetalleAgencia = wrappedVer; } catch(e){}
    }
    ['registrarEntradaInventario','confirmarTransferenciaInventario','guardarProducto','guardarAlmacen','crearEntradaInventario','crearTransferenciaInventario'].forEach(wrapAfter);
  }
  function boot(){
    patchMenuAndActions();
    syncAgenciesAgainstWarehouses();
    injectNote();
    renderAgencyInventory();
    setTimeout(function(){ lotekaRefreshAfterMutation('inicio'); }, 250);
  }
  window.lotekaRefreshAfterMutation = lotekaRefreshAfterMutation;
  window.lotekaSyncAgenciasInventarioV42 = boot;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', function(){ setTimeout(boot, 500); setTimeout(function(){ lotekaRefreshAfterMutation('carga'); }, 1200); });
})();

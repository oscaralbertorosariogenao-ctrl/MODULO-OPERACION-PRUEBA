
(function(){
  'use strict';
  if(window.__lotekaV93EntradaStockRealFixInstalled) return;
  window.__lotekaV93EntradaStockRealFixInstalled = true;

  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function upper(v){ return clean(v).toUpperCase(); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function sb(){ return window.lotekaSupabase || null; }
  function userId(){ return window.lotekaAuthState && window.lotekaAuthState.user ? window.lotekaAuthState.user.id : null; }
  function userName(){ return window.lotekaAuthState && window.lotekaAuthState.profile ? window.lotekaAuthState.profile.nombre_completo : 'Usuario'; }
  function escapeHtml(v){ return clean(v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];}); }
  function getProductos(){ try{ return Array.isArray(productos) ? productos : []; }catch(e){ return Array.isArray(window.productos) ? window.productos : []; } }
  function setProductos(list){ window.productos = list || []; try{ productos = window.productos; }catch(e){} }
  function getAlmacenes(){ try{ return Array.isArray(almacenes) ? almacenes : []; }catch(e){ return Array.isArray(window.almacenes) ? window.almacenes : []; } }
  function setAlmacenes(list){ window.almacenes = list || []; try{ almacenes = window.almacenes; }catch(e){} }
  function getItemsEntrada(){ try{ return Array.isArray(entradaActualItems) ? entradaActualItems : []; }catch(e){ return Array.isArray(window.entradaActualItems) ? window.entradaActualItems : []; } }
  function setItemsEntrada(list){ window.entradaActualItems = list || []; try{ entradaActualItems = window.entradaActualItems; }catch(e){} }
  function getSerialesTemp(){ try{ return Array.isArray(serialesTemporalesEntrada) ? serialesTemporalesEntrada : []; }catch(e){ return Array.isArray(window.serialesTemporalesEntrada) ? window.serialesTemporalesEntrada : []; } }
  function setSerialesTemp(list){ window.serialesTemporalesEntrada = list || []; try{ serialesTemporalesEntrada = window.serialesTemporalesEntrada; }catch(e){} }
  function setEntradas(list){ window.entradasInventario = list || []; try{ entradasInventario = window.entradasInventario; }catch(e){} }
  function productById(id){ return getProductos().find(function(p){ return p && String(p.supabaseId) === String(id); }) || null; }
  function almacenById(id){ return getAlmacenes().find(function(a){ return a && String(a.supabaseId) === String(id); }) || null; }
  function isTaller(almacen){ return almacen && (norm(almacen.codigo) === 'alm-taller' || norm(almacen.nombre).indexOf('taller') >= 0); }
  function requiereSerial(producto){
    if(!producto) return true;
    if(producto.requiereSerial === false) return false;
    var txt = norm([producto.codigo, producto.nombre, producto.categoria].join(' '));
    if(txt.indexOf('pieza') >= 0 || txt.indexOf('parte') >= 0 || txt.indexOf('consumible') >= 0 || txt.indexOf('suministro') >= 0) return false;
    return true;
  }
  function localDateParts(iso){
    var d = iso ? new Date(iso) : new Date();
    if(isNaN(d.getTime())) d = new Date();
    return {
      fecha: d.toLocaleDateString('es-DO'),
      hora: d.toLocaleTimeString('es-DO', {hour:'2-digit', minute:'2-digit'}),
      fechaHora: d.toLocaleString('es-DO'),
      fechaISO: d.toISOString().slice(0,10)
    };
  }
  function dateInputToISO(value){
    if(!value) return new Date().toISOString();
    var d = new Date(value);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  function entradaRefFromMovimiento(m){
    var text = clean((m && (m.motivo || m.observaciones)) || '');
    var found = text.match(/Entrada de inventario\s+([^\s]+)/i);
    return found ? found[1] : ('EN-' + String(m && m.id ? m.id : Date.now()).slice(0,8));
  }
  async function audit(modulo, accion, entidad, entidadId, descripcion, antes, despues){
    try{ if(typeof window.lotekaAudit === 'function') await window.lotekaAudit(modulo, accion, entidad, entidadId, descripcion, antes || null, despues || null); }catch(e){}
  }

  function llenarOpcionesModalEntradaV93(){
    var selectAlmacen = document.getElementById('entradaAlmacen');
    var selectProducto = document.getElementById('entradaProducto');
    var selectSuplidor = document.getElementById('entradaSuplidor');
    var almacenesList = getAlmacenes().filter(function(a){ return a && a.activo !== false && a.supabaseId && clean(a.nombre); });
    var productosList = getProductos().filter(function(p){ return p && p.activo !== false && p.supabaseId && clean(p.nombre); });
    if(selectAlmacen){
      selectAlmacen.innerHTML = '<option value="">Selecciona</option>' + almacenesList.map(function(a){
        var label = a.codigo ? (a.codigo + ' · ' + a.nombre) : a.nombre;
        return '<option value="'+escapeHtml(a.supabaseId)+'">'+escapeHtml(label)+'</option>';
      }).join('');
    }
    if(selectProducto){
      selectProducto.setAttribute('onchange','lotekaEntradaProductoSeleccionadoV93()');
      selectProducto.innerHTML = '<option value="">Selecciona un producto creado</option>' + productosList.map(function(p){
        var label = (p.codigo ? p.codigo + ' · ' : '') + p.nombre + (p.categoria ? ' · ' + p.categoria : '') + ' · ' + (requiereSerial(p) ? 'Serializado' : 'No serializado');
        return '<option value="'+escapeHtml(p.supabaseId)+'">'+escapeHtml(label)+'</option>';
      }).join('');
      if(!productosList.length) selectProducto.innerHTML += '<option disabled>No hay productos activos en Productos</option>';
    }
    if(selectSuplidor){
      var sup = [];
      try{ sup = Array.isArray(suplidoresBase) ? suplidoresBase : []; }catch(e){ sup = []; }
      if(!sup.length) sup = ['Suplidor General'];
      selectSuplidor.innerHTML = '<option value="">Selecciona</option>' + sup.map(function(s){ return '<option value="'+escapeHtml(s)+'">'+escapeHtml(s)+'</option>'; }).join('');
    }
  }

  window.lotekaEntradaProductoSeleccionadoV93 = function(){
    var select = document.getElementById('entradaProducto');
    var serialSelect = document.getElementById('entradaSerializado');
    var prod = select && select.value ? productById(select.value) : null;
    if(prod && serialSelect){
      serialSelect.value = requiereSerial(prod) ? 'si' : 'no';
      serialSelect.dataset.autoProducto = prod.supabaseId || '';
      serialSelect.disabled = false;
    }
    try{ actualizarCampoSerialesEntrada(); }catch(e){}
  };

  async function abrirEntradaV93(){
    try{ if(typeof window.lotekaReloadInventarioTallerSupabase === 'function') await window.lotekaReloadInventarioTallerSupabase(); }catch(e){}
    llenarOpcionesModalEntradaV93();
    setItemsEntrada([]);
    setSerialesTemp([]);
    var setVal = function(id, value){ var el = document.getElementById(id); if(el) el.value = value; };
    setVal('entradaAlmacen','');
    setVal('entradaProducto','');
    setVal('entradaUnidades','');
    setVal('entradaSerializado','no');
    setVal('entradaSuplidor','Suplidor General');
    setVal('entradaUsuario', userName());
    if(typeof obtenerFechaHoraLocalValue === 'function') setVal('entradaFechaRecepcion', obtenerFechaHoraLocalValue());
    else setVal('entradaFechaRecepcion', new Date().toISOString().slice(0,16));
    if(typeof obtenerReferenciaEntrada === 'function') setVal('entradaReferencia', obtenerReferenciaEntrada());
    else setVal('entradaReferencia','EN-'+Date.now());
    setVal('entradaObservacion','');
    setVal('entradaSerialInput','');
    try{ actualizarCampoSerialesEntrada(); }catch(e){}
    try{ renderSerialesEntrada(); }catch(e){}
    try{ renderItemsEntradaActual(); }catch(e){}
    var modal = document.getElementById('modalEntrada');
    if(modal) modal.style.display = 'flex';
  }

  function agregarProductoEntradaV93(){
    var productoId = document.getElementById('entradaProducto') ? document.getElementById('entradaProducto').value : '';
    var unidades = Number(document.getElementById('entradaUnidades') ? document.getElementById('entradaUnidades').value || 0 : 0);
    var serializado = document.getElementById('entradaSerializado') ? document.getElementById('entradaSerializado').value : 'no';
    var producto = productById(productoId);
    if(!producto){ alert('Selecciona un producto creado en Productos.'); return; }
    if(unidades <= 0){ alert('Ingresa una cantidad válida.'); return; }
    if(serializado === 'si'){
      var seriales = getSerialesTemp().map(upper).filter(Boolean);
      var unique = Array.from(new Set(seriales));
      if(unique.length !== seriales.length){ alert('Hay seriales repetidos en esta entrada.'); return; }
      if(unique.length !== unidades){ alert('La cantidad de seriales debe ser igual a la cantidad indicada.'); return; }
    }
    var items = getItemsEntrada();
    items.push({
      producto: producto.nombre,
      productoId: producto.supabaseId,
      codigo: producto.codigo || '',
      marca: producto.marca || '',
      modelo: producto.modelo || '',
      categoria: producto.categoria || 'Inventario',
      cantidad: unidades,
      serializado: serializado,
      seriales: serializado === 'si' ? getSerialesTemp().map(upper).filter(Boolean) : []
    });
    setItemsEntrada(items);
    var setVal=function(id,value){var el=document.getElementById(id); if(el) el.value=value;};
    setVal('entradaProducto',''); setVal('entradaUnidades',''); setVal('entradaSerializado','no'); setVal('entradaSerialInput','');
    setSerialesTemp([]);
    try{ actualizarCampoSerialesEntrada(); }catch(e){}
    try{ renderSerialesEntrada(); }catch(e){}
    try{ renderItemsEntradaActual(); }catch(e){}
  }

  function reconstruirInventarioDesdeSupabase(){
    var almacenesList = getAlmacenes();
    var productosList = getProductos();
    var prodMap = new Map(productosList.map(function(p){ return [String(p.supabaseId), p]; }));
    var almacenMap = new Map(almacenesList.map(function(a){ return [String(a.supabaseId), a]; }));
    almacenesList.forEach(function(a){ if(a){ a.inventario = []; a.movimientos = []; } });

    arr(window.lotekaEquiposSerialesSupabase).forEach(function(row){
      if(!row || row.activo === false || row.ubicacion_tipo !== 'ALMACEN' || !row.almacen_id) return;
      var almacen = almacenMap.get(String(row.almacen_id));
      if(!almacen) return;
      var prod = prodMap.get(String(row.producto_id)) || {nombre:'Equipo sin producto', marca:'', modelo:'', categoria:'Equipos'};
      var item = almacen.inventario.find(function(x){ return x.productoId === row.producto_id && x.tipo === 'Serializado'; });
      if(!item){
        item = {productoId:row.producto_id, producto:prod.nombre, marca:prod.marca||'', modelo:prod.modelo||'', categoria:prod.categoria||'Equipos', tipo:'Serializado', cantidad:0, seriales:[]};
        almacen.inventario.push(item);
      }
      item.cantidad += 1;
      item.seriales.push(row.serial);
    });

    var stock = new Map();
    arr(window.lotekaMovimientosInventarioSupabase).forEach(function(m){
      if(!m) return;
      almacenesList.forEach(function(a){
        if(!a || !a.supabaseId) return;
        if(m.destino_tipo === 'ALMACEN' && String(m.destino_id) === String(a.supabaseId)){
          a.movimientos.push({fechaHora: m.creado_en ? new Date(m.creado_en).toLocaleString('es-DO') : '', fecha: m.creado_en ? new Date(m.creado_en).toLocaleDateString('es-DO') : '', tipo:m.tipo_movimiento||'', descripcion:m.motivo||m.observaciones||''});
        }
        if(m.origen_tipo === 'ALMACEN' && String(m.origen_id) === String(a.supabaseId)){
          a.movimientos.push({fechaHora: m.creado_en ? new Date(m.creado_en).toLocaleString('es-DO') : '', fecha: m.creado_en ? new Date(m.creado_en).toLocaleDateString('es-DO') : '', tipo:m.tipo_movimiento||'', descripcion:m.motivo||m.observaciones||''});
        }
      });
      if(m.serial_id) return;
      var productId = m.producto_id || m.product_id;
      var qty = Number(m.cantidad || 0) || 0;
      if(!productId || !qty) return;
      if(m.destino_tipo === 'ALMACEN' && m.destino_id){
        var keyIn = String(m.destino_id)+'|'+String(productId);
        stock.set(keyIn, (stock.get(keyIn)||0) + qty);
      }
      if(m.origen_tipo === 'ALMACEN' && m.origen_id){
        var keyOut = String(m.origen_id)+'|'+String(productId);
        stock.set(keyOut, (stock.get(keyOut)||0) - qty);
      }
    });

    stock.forEach(function(qty, key){
      if(qty <= 0) return;
      var parts = key.split('|');
      var almacen = almacenMap.get(parts[0]);
      var prod = prodMap.get(parts[1]) || {nombre:'Producto sin nombre', marca:'', modelo:'', categoria:'Inventario'};
      if(!almacen) return;
      almacen.inventario.push({productoId:parts[1], producto:prod.nombre, marca:prod.marca||'', modelo:prod.modelo||'', categoria:prod.categoria||'Inventario', tipo:'No serializado', cantidad:qty, seriales:[]});
    });

    reconstruirEntradasDesdeMovimientos();
    try{ if(typeof renderAlmacenes === 'function') renderAlmacenes(); }catch(e){}
    try{ if(typeof renderEntradas === 'function') renderEntradas(); }catch(e){}
    try{ if(typeof llenarFiltrosEntrada === 'function') llenarFiltrosEntrada(); }catch(e){}
  }

  function reconstruirEntradasDesdeMovimientos(){
    var movs = arr(window.lotekaMovimientosInventarioSupabase).filter(function(m){ return m && m.tipo_movimiento === 'Entrada'; });
    var grupos = new Map();
    movs.forEach(function(m){
      var ref = entradaRefFromMovimiento(m);
      var key = ref + '|' + clean(m.destino_id || m.destino_nombre);
      if(!grupos.has(key)) grupos.set(key, {ref:ref, almacen:m.destino_nombre || 'Almacén', fecha:m.creado_en, usuario:m.usuario_nombre || userName(), suplidor:m.origen_nombre || 'Suplidor General', serializado:'no', unidades:0, items:[]});
      var g = grupos.get(key);
      var prod = productById(m.producto_id || m.product_id) || {nombre:'Producto sin nombre', marca:'', modelo:'', categoria:'Inventario'};
      var serializado = m.serial_id ? 'si' : 'no';
      var qty = Number(m.cantidad || 0) || 0;
      g.unidades += qty;
      if(serializado === 'si') g.serializado = 'si';
      var existing = g.items.find(function(i){ return i.productoId === (m.producto_id || m.product_id) && i.serializado === serializado; });
      if(!existing){
        existing = {producto:prod.nombre, productoId:m.producto_id || m.product_id, marca:prod.marca||'', modelo:prod.modelo||'', categoria:prod.categoria||'', cantidad:0, serializado:serializado, seriales:[]};
        g.items.push(existing);
      }
      existing.cantidad += qty;
    });
    var list = Array.from(grupos.values()).map(function(g){
      var d = localDateParts(g.fecha);
      var resumen = g.items.map(function(i){ return i.producto + ' (' + i.cantidad + ')'; }).join(', ');
      return {codigo:g.ref, almacen:g.almacen, producto:g.items.length === 1 ? g.items[0].producto : (g.items[0] ? g.items[0].producto + ' (+'+(g.items.length-1)+')' : 'Entrada'), productosResumen:resumen, unidades:g.unidades, fecha:d.fecha, hora:d.hora, fechaHora:d.fechaHora, fechaVista:d.fechaHora, fechaISO:d.fechaISO, usuario:g.usuario, estado:'Recibido', suplidor:g.suplidor, serializado:g.serializado, observacion:'', items:g.items};
    }).sort(function(a,b){ return String(b.fechaHora).localeCompare(String(a.fechaHora)); });
    setEntradas(list);
  }

  async function recargarInventarioReal(){
    if(typeof window.lotekaReloadInventarioTallerSupabase === 'function'){
      try{ await window.lotekaReloadInventarioTallerSupabase.__v93_original ? await window.lotekaReloadInventarioTallerSupabase.__v93_original() : await window.lotekaReloadInventarioTallerSupabase(); }catch(e){ console.warn('Reload v93:', e); }
    }
    reconstruirInventarioDesdeSupabase();
  }

  async function guardarEntradaV93(){
    var client = sb();
    if(!client){ alert('No hay conexión con Supabase.'); return; }
    var almacenId = document.getElementById('entradaAlmacen') ? document.getElementById('entradaAlmacen').value : '';
    var almacen = almacenById(almacenId);
    var referencia = document.getElementById('entradaReferencia') ? clean(document.getElementById('entradaReferencia').value) : ('EN-'+Date.now());
    var observacion = document.getElementById('entradaObservacion') ? clean(document.getElementById('entradaObservacion').value) : '';
    var suplidor = document.getElementById('entradaSuplidor') ? clean(document.getElementById('entradaSuplidor').value) || 'Suplidor General' : 'Suplidor General';
    var fechaValor = document.getElementById('entradaFechaRecepcion') ? document.getElementById('entradaFechaRecepcion').value : '';
    var items = getItemsEntrada();
    if(!almacen){ alert('Selecciona un almacén válido.'); return; }
    if(!items.length){ alert('Agrega por lo menos un producto a la entrada.'); return; }
    if(!confirm('¿Guardar esta entrada de inventario?')) return;
    var btn = document.querySelector('#modalEntrada button[onclick*="guardarEntrada"]');
    var oldHtml = btn ? btn.innerHTML : '';
    if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; }
    try{
      var before = [], after = [];
      for(var i=0; i<items.length; i++){
        var item = items[i];
        var productId = item.productoId;
        var prod = productById(productId) || {nombre:item.producto};
        if(item.serializado === 'si'){
          var seriales = arr(item.seriales).map(upper).filter(Boolean);
          if(seriales.length !== Number(item.cantidad || 0)) throw new Error('La cantidad y los seriales no coinciden para '+item.producto+'.');
          for(var s=0; s<seriales.length; s++){
            var serial = seriales[s];
            var old = await client.from('equipos_seriales').select('*').eq('serial', serial).maybeSingle();
            if(old.error && old.error.code !== 'PGRST116') throw old.error;
            before.push(old.data || null);
            var payload = {serial:serial, producto_id:productId, estado:isTaller(almacen)?'Listo':'Disponible', condicion:'Bueno', ubicacion_tipo:'ALMACEN', almacen_id:almacen.supabaseId, agencia_id:null, grupo_id:null, responsable:null, observaciones:observacion || ('Entrada '+referencia), activo:true, actualizado_por:userId()};
            if(!old.data) payload.creado_por = userId();
            var up = await client.from('equipos_seriales').upsert(payload,{onConflict:'serial'}).select('*').single();
            if(up.error) throw up.error;
            after.push(up.data);
            var mv = {tipo_movimiento:'Entrada', serial_id:up.data.id, producto_id:productId, origen_tipo:'SUPLIDOR', origen_id:null, origen_nombre:suplidor, destino_tipo:'ALMACEN', destino_id:almacen.supabaseId, destino_nombre:almacen.nombre, cantidad:1, motivo:'Entrada de inventario '+referencia, observaciones:observacion, creado_por:userId(), usuario_nombre:userName(), creado_en:dateInputToISO(fechaValor)};
            var ins = await client.from('movimientos_inventario').insert(mv).select('*').single();
            if(ins.error) throw ins.error;
          }
        }else{
          var qty = Number(item.cantidad || 0) || 1;
          var mvNo = {tipo_movimiento:'Entrada', serial_id:null, producto_id:productId, origen_tipo:'SUPLIDOR', origen_id:null, origen_nombre:suplidor, destino_tipo:'ALMACEN', destino_id:almacen.supabaseId, destino_nombre:almacen.nombre, cantidad:qty, motivo:'Entrada de inventario '+referencia, observaciones:observacion, creado_por:userId(), usuario_nombre:userName(), creado_en:dateInputToISO(fechaValor)};
          var insNo = await client.from('movimientos_inventario').insert(mvNo).select('*').single();
          if(insNo.error) throw insNo.error;
          after.push(insNo.data);
        }
      }
      await audit('Inventario','ENTRADA_INVENTARIO','movimientos_inventario',referencia,'Entrada hacia '+almacen.nombre,before,after);
      await recargarInventarioReal();
      try{ if(typeof cerrarEntrada === 'function') cerrarEntrada(); }catch(e){}
      alert('Entrada guardada correctamente.');
    }catch(err){
      console.error('Entrada v93:', err);
      alert('No se pudo guardar la entrada: '+(err && err.message ? err.message : err));
    }finally{
      if(btn){ btn.disabled = false; btn.innerHTML = oldHtml || 'Guardar entrada'; }
    }
  }

  function instalarV93(){
    window.llenarOpcionesModalEntrada = llenarOpcionesModalEntradaV93;
    window.abrirEntrada = abrirEntradaV93;
    window.agregarProductoEntrada = agregarProductoEntradaV93;
    window.guardarEntrada = guardarEntradaV93;
    try{ llenarOpcionesModalEntrada = llenarOpcionesModalEntradaV93; abrirEntrada = abrirEntradaV93; agregarProductoEntrada = agregarProductoEntradaV93; guardarEntrada = guardarEntradaV93; }catch(e){}
    if(typeof window.lotekaReloadInventarioTallerSupabase === 'function' && !window.lotekaReloadInventarioTallerSupabase.__v93_original){
      var original = window.lotekaReloadInventarioTallerSupabase;
      var wrapped = async function(){ var r = await original.apply(this, arguments); reconstruirInventarioDesdeSupabase(); return r; };
      wrapped.__v93_original = original;
      window.lotekaReloadInventarioTallerSupabase = wrapped;
    }
    setTimeout(function(){ recargarInventarioReal(); }, 500);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalarV93); else instalarV93();
  window.addEventListener('load', function(){ setTimeout(instalarV93, 600); setTimeout(function(){ recargarInventarioReal(); }, 1500); });
})();
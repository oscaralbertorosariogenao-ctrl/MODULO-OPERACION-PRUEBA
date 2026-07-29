
(function(){
  'use strict';
  if(window.__lotekaV92EntradaProductosFixInstalled) return;
  window.__lotekaV92EntradaProductosFixInstalled = true;

  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function upper(v){ return clean(v).toUpperCase(); }
  function sb(){ return window.lotekaSupabase || null; }
  function userId(){ return window.lotekaAuthState && window.lotekaAuthState.user ? window.lotekaAuthState.user.id : null; }
  function userName(){ return window.lotekaAuthState && window.lotekaAuthState.profile ? window.lotekaAuthState.profile.nombre_completo : 'Usuario'; }
  function authUser(){ return window.lotekaAuthState && window.lotekaAuthState.user ? window.lotekaAuthState.user : null; }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function escapeHtml(v){ return clean(v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];}); }
  function getProductos(){ try{ return Array.isArray(productos) ? productos : []; }catch(e){ return Array.isArray(window.productos) ? window.productos : []; } }
  function setProductos(list){ window.productos = list || []; try{ productos = window.productos; }catch(e){} }
  function getAlmacenes(){ try{ return Array.isArray(almacenes) ? almacenes : []; }catch(e){ return Array.isArray(window.almacenes) ? window.almacenes : []; } }
  function getItemsEntrada(){ try{ return Array.isArray(entradaActualItems) ? entradaActualItems : []; }catch(e){ return Array.isArray(window.entradaActualItems) ? window.entradaActualItems : []; } }
  function setItemsEntrada(list){ window.entradaActualItems = list || []; try{ entradaActualItems = window.entradaActualItems; }catch(e){} }
  function setSerialesTemp(list){ window.serialesTemporalesEntrada = list || []; try{ serialesTemporalesEntrada = window.serialesTemporalesEntrada; }catch(e){} }
  function getSerialesTemp(){ try{ return Array.isArray(serialesTemporalesEntrada) ? serialesTemporalesEntrada : []; }catch(e){ return Array.isArray(window.serialesTemporalesEntrada) ? window.serialesTemporalesEntrada : []; } }
  function slug(value, fallback){
    var text = clean(value || fallback || 'ITEM').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    return text || String(fallback || 'ITEM').toUpperCase();
  }
  function inferRequiresSerial(product){
    var text = norm([product && product.nombre, product && product.categoria, product && product.codigo].join(' '));
    if(text.indexOf('pieza') >= 0 || text.indexOf('piezas') >= 0 || text.indexOf('parte') >= 0 || text.indexOf('partes') >= 0 || text.indexOf('consumible') >= 0 || text.indexOf('suministro') >= 0) return false;
    return product && product.requiereSerial === false ? false : true;
  }
  function defaultImage(category){
    var cat = norm(category);
    if(cat.indexOf('pieza') >= 0 || cat.indexOf('parte') >= 0) return 'https://cdn-icons-png.flaticon.com/512/4149/4149674.png';
    if(cat.indexOf('red') >= 0 || cat.indexOf('router') >= 0) return 'https://cdn-icons-png.flaticon.com/512/1041/1041372.png';
    if(cat.indexOf('seguridad') >= 0 || cat.indexOf('cam') >= 0) return 'https://cdn-icons-png.flaticon.com/512/685/685655.png';
    if(cat.indexOf('energia') >= 0 || cat.indexOf('energ') >= 0) return 'https://cdn-icons-png.flaticon.com/512/3063/3063821.png';
    return 'https://cdn-icons-png.flaticon.com/512/1041/1041880.png';
  }
  function safeJsonParse(value){ try{return value && typeof value === 'string' ? JSON.parse(value) : null;}catch(e){return null;} }
  function productMeta(row){ var parsed = safeJsonParse(row && row.descripcion); return parsed && parsed.__loteka_meta === true ? parsed : {}; }
  function localProductFromRow(row){
    row = row || {};
    var meta = productMeta(row || {});
    var tipoProducto = String(row.tipo_producto || meta.tipo_producto || meta.tipoProducto || '').trim().toUpperCase();

    if(tipoProducto !== 'PIEZA' && tipoProducto !== 'EQUIPO'){
      var textoTipo = String([
        row.categoria || meta.categoria,
        row.nombre,
        row.codigo,
        meta.modelo,
        meta.marca
      ].filter(Boolean).join(' ')).toLowerCase();

      tipoProducto = (
        textoTipo.indexOf('pieza') >= 0 ||
        textoTipo.indexOf('parte') >= 0 ||
        textoTipo.indexOf('repuesto') >= 0 ||
        textoTipo.indexOf('fuente') >= 0 ||
        textoTipo.indexOf('board') >= 0 ||
        textoTipo.indexOf('motor') >= 0 ||
        textoTipo.indexOf('rodillo') >= 0 ||
        textoTipo.indexOf('cuchilla') >= 0 ||
        textoTipo.indexOf('carcaza') >= 0 ||
        textoTipo.indexOf('engranaje') >= 0
      ) ? 'PIEZA' : 'EQUIPO';
    }

    return {
      supabaseId: row.id,
      codigo: row.codigo || '',
      nombre: row.nombre || '',
      marca: meta.marca || '',
      modelo: meta.modelo || '',
      precio: meta.precio || '',
      categoria: row.categoria || meta.categoria || (tipoProducto === 'PIEZA' ? 'Piezas técnicas' : 'Equipos'),
      tipo_producto: tipoProducto,
      tipoProducto: tipoProducto,
      imagen: meta.imagen || defaultImage(row.categoria || meta.categoria),
      requiereSerial: row.requiere_serial !== false,
      requiere_serial: row.requiere_serial !== false,
      activo: row.activo !== false
    };
  }
  function productByName(nombre, marca, modelo){
    var n=norm(nombre), ma=norm(marca), mo=norm(modelo);
    return getProductos().find(function(p){return norm(p.nombre)===n && (!ma || norm(p.marca)===ma) && (!mo || norm(p.modelo)===mo);}) ||
           getProductos().find(function(p){return norm(p.nombre)===n;}) || null;
  }
  function productByIdMap(){ var m = new Map(); getProductos().forEach(function(p){ if(p && p.supabaseId) m.set(p.supabaseId, p); }); return m; }
  function dateInputToISO(value){
    if(!value) return new Date().toISOString();
    var d = new Date(value);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  async function audit(modulo, accion, entidad, entidadId, descripcion, antes, despues){
    try{ if(typeof window.lotekaAudit === 'function') await window.lotekaAudit(modulo, accion, entidad, entidadId, descripcion, antes || null, despues || null); }catch(e){}
  }

  async function reloadInventario(){
    if(typeof window.lotekaReloadInventarioTallerSupabase === 'function'){
      var r = await window.lotekaReloadInventarioTallerSupabase.__v92_original ? await window.lotekaReloadInventarioTallerSupabase.__v92_original() : await window.lotekaReloadInventarioTallerSupabase();
      rebuildNonSerializedStock();
      return r;
    }
    return false;
  }

  function rebuildNonSerializedStock(){
    var movimientos = arr(window.lotekaMovimientosInventarioSupabase);
    var almacenesList = getAlmacenes();
    if(!almacenesList.length || !movimientos.length) return;
    var products = productByIdMap();
    almacenesList.forEach(function(almacen){
      if(!almacen || !almacen.supabaseId) return;
      var stock = new Map();
      movimientos.forEach(function(m){
        if(!m || m.serial_id || !m.product_id && !m.producto_id) return;
        var productId = m.producto_id || m.product_id;
        var qty = Number(m.cantidad || 0) || 0;
        if(!productId || !qty) return;
        var delta = 0;
        if(m.destino_tipo === 'ALMACEN' && String(m.destino_id) === String(almacen.supabaseId)) delta += qty;
        if(m.origen_tipo === 'ALMACEN' && String(m.origen_id) === String(almacen.supabaseId)) delta -= qty;
        if(delta) stock.set(productId, (stock.get(productId) || 0) + delta);
      });
      stock.forEach(function(qty, productId){
        if(qty <= 0) return;
        var prod = products.get(productId) || {nombre:'Producto sin nombre', marca:'', modelo:'', categoria:'Inventario'};
        var existing = arr(almacen.inventario).find(function(i){ return i.productoId === productId && i.tipo === 'No serializado'; });
        if(existing){ existing.cantidad = qty; return; }
        if(!Array.isArray(almacen.inventario)) almacen.inventario = [];
        almacen.inventario.push({
          productoId: productId,
          producto: prod.nombre,
          marca: prod.marca || '',
          modelo: prod.modelo || '',
          categoria: prod.categoria || 'Inventario',
          tipo: 'No serializado',
          cantidad: qty,
          seriales: []
        });
      });
    });
    try{ if(typeof renderAlmacenes === 'function') renderAlmacenes(); }catch(e){}
  }

  if(typeof window.lotekaReloadInventarioTallerSupabase === 'function' && !window.lotekaReloadInventarioTallerSupabase.__v92_original){
    var originalReload = window.lotekaReloadInventarioTallerSupabase;
    var wrappedReload = async function(){ var r = await originalReload.apply(this, arguments); rebuildNonSerializedStock(); return r; };
    wrappedReload.__v92_original = originalReload;
    window.lotekaReloadInventarioTallerSupabase = wrappedReload;
  }

  async function ensureProductosCargados(){
    var client = sb();
    if(client){
      try{
        var resp = await client.from('productos').select('*').eq('activo', true).order('nombre', {ascending:true});
        if(!resp.error){ setProductos((resp.data || []).map(localProductFromRow)); }
      }catch(e){}
    }
    return getProductos().filter(function(p){ return p && p.activo !== false && clean(p.nombre); });
  }

  function llenarOpcionesModalEntradaV92(){
    var selectAlmacen = document.getElementById('entradaAlmacen');
    var selectProducto = document.getElementById('entradaProducto');
    var selectSuplidor = document.getElementById('entradaSuplidor');
    var almacenesList = getAlmacenes().filter(function(a){ return a && a.activo !== false && clean(a.nombre); });
    var productosList = getProductos().filter(function(p){ return p && p.activo !== false && clean(p.nombre); });
    if(selectAlmacen){
      selectAlmacen.innerHTML = '<option value="">Selecciona</option>' + almacenesList.map(function(a, i){ return '<option value="'+i+'">'+escapeHtml(a.codigo ? (a.codigo+' · '+a.nombre) : a.nombre)+'</option>'; }).join('');
    }
    if(selectProducto){
      selectProducto.setAttribute('onchange','lotekaEntradaProductoSeleccionadoV92()');
      selectProducto.innerHTML = '<option value="">Selecciona un producto creado</option>' + productosList.map(function(p, i){
        var serialText = inferRequiresSerial(p) ? 'Serializado' : 'No serializado';
        var label = p.codigo ? (p.codigo+' · '+p.nombre) : p.nombre;
        if(p.categoria) label += ' · '+p.categoria;
        label += ' · '+serialText;
        return '<option value="'+i+'" data-id="'+escapeHtml(p.supabaseId || '')+'">'+escapeHtml(label)+'</option>';
      }).join('');
      if(!productosList.length){
        selectProducto.innerHTML += '<option disabled>No hay productos creados en Productos</option>';
      }
    }
    if(selectSuplidor){
      var suplidores = Array.isArray(window.suplidoresBase) ? window.suplidoresBase : (typeof suplidoresBase !== 'undefined' ? suplidoresBase : ['Suplidor General']);
      selectSuplidor.innerHTML = '<option value="">Selecciona</option>' + suplidores.map(function(s){ return '<option value="'+escapeHtml(s)+'">'+escapeHtml(s)+'</option>'; }).join('');
    }
  }

  window.lotekaEntradaProductoSeleccionadoV92 = function(){
    var select = document.getElementById('entradaProducto');
    var serialSelect = document.getElementById('entradaSerializado');
    var idx = select ? select.value : '';
    var prod = idx === '' ? null : getProductos()[Number(idx)];
    if(prod && serialSelect){
      serialSelect.value = inferRequiresSerial(prod) ? 'si' : 'no';
      serialSelect.dataset.autoProducto = prod.supabaseId || prod.nombre || '';
    }
    try{ actualizarCampoSerialesEntrada(); }catch(e){}
  };

  async function abrirEntradaV92(){
    await ensureProductosCargados();
    try{ if(typeof window.lotekaReloadInventarioTallerSupabase === 'function') await window.lotekaReloadInventarioTallerSupabase(); }catch(e){}
    llenarOpcionesModalEntradaV92();
    setItemsEntrada([]);
    setSerialesTemp([]);
    var setVal = function(id, value){ var el = document.getElementById(id); if(el) el.value = value; };
    setVal('entradaAlmacen','');
    setVal('entradaProducto','');
    setVal('entradaUnidades','');
    setVal('entradaSerializado','no');
    setVal('entradaSuplidor','Suplidor General');
    setVal('entradaUsuario', (typeof usuarioMovimientoFijo !== 'undefined' ? usuarioMovimientoFijo : userName()));
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

  function agregarProductoEntradaV92(){
    var productoIndex = document.getElementById('entradaProducto') ? document.getElementById('entradaProducto').value : '';
    var unidades = Number(document.getElementById('entradaUnidades') ? document.getElementById('entradaUnidades').value || 0 : 0);
    var serializado = document.getElementById('entradaSerializado') ? document.getElementById('entradaSerializado').value : 'no';
    if(productoIndex === ''){ alert('Selecciona un producto'); return; }
    if(unidades <= 0){ alert('Ingresa una cantidad válida'); return; }
    var producto = getProductos()[Number(productoIndex)];
    if(!producto){ alert('Producto inválido. Abre nuevamente la entrada para recargar productos.'); return; }
    if(!producto.supabaseId){ alert('Ese producto no está conectado a Supabase. Créalo o edítalo en Productos y vuelve a intentar.'); return; }
    if(serializado === 'si'){
      var seriales = getSerialesTemp();
      if(seriales.length !== unidades){ alert('La cantidad de seriales debe ser igual a la cantidad indicada'); return; }
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
      seriales: serializado === 'si' ? [].concat(getSerialesTemp()) : []
    });
    setItemsEntrada(items);
    var setVal=function(id,value){var el=document.getElementById(id);if(el)el.value=value;};
    setVal('entradaProducto',''); setVal('entradaUnidades',''); setVal('entradaSerializado','no'); setVal('entradaSerialInput','');
    setSerialesTemp([]);
    try{ actualizarCampoSerialesEntrada(); }catch(e){}
    try{ renderSerialesEntrada(); }catch(e){}
    try{ renderItemsEntradaActual(); }catch(e){}
  }

  async function saveEntradaSupabaseV92(){
    var client = sb();
    if(!client){ alert('No hay conexión con Supabase.'); return; }
    var almacenIndex = document.getElementById('entradaAlmacen') ? document.getElementById('entradaAlmacen').value : '';
    var almacen = almacenIndex === '' ? null : getAlmacenes()[Number(almacenIndex)];
    var referencia = document.getElementById('entradaReferencia') ? document.getElementById('entradaReferencia').value : ('EN-'+Date.now());
    var observacion = document.getElementById('entradaObservacion') ? document.getElementById('entradaObservacion').value.trim() : '';
    var suplidor = document.getElementById('entradaSuplidor') ? document.getElementById('entradaSuplidor').value.trim() : 'Suplidor General';
    var fechaValor = document.getElementById('entradaFechaRecepcion') ? document.getElementById('entradaFechaRecepcion').value : '';
    var items = getItemsEntrada();
    if(!almacen || !almacen.supabaseId){ alert('Selecciona un almacén válido conectado a Supabase.'); return; }
    if(!items.length){ alert('Agrega por lo menos un producto a la entrada.'); return; }
    var invalid = items.find(function(i){ return !i.productoId; });
    if(invalid){ alert('Hay un producto sin conexión a Supabase: '+invalid.producto); return; }
    if(!confirm('¿Guardar esta entrada de inventario en Supabase?')) return;
    try{
      var before = [], after = [];
      for(var ii=0; ii<items.length; ii++){
        var item = items[ii];
        var prod = productByName(item.producto, item.marca, item.modelo) || {supabaseId:item.productoId, nombre:item.producto};
        if(item.serializado === 'si'){
          for(var ss=0; ss<arr(item.seriales).length; ss++){
            var serial = upper(item.seriales[ss]); if(!serial) continue;
            var old = await client.from('equipos_seriales').select('*').eq('serial', serial).maybeSingle();
            if(old.error && old.error.code !== 'PGRST116') throw old.error;
            before.push(old.data || null);
            var payload = {
              serial: serial,
              producto_id: item.productoId || prod.supabaseId,
              estado: (norm(almacen.codigo)==='alm-taller' || norm(almacen.nombre).indexOf('taller')>-1) ? 'Listo' : 'Disponible',
              condicion: 'Bueno',
              ubicacion_tipo: 'ALMACEN',
              almacen_id: almacen.supabaseId,
              agencia_id: null,
              grupo_id: null,
              responsable: null,
              observaciones: observacion || ('Entrada '+referencia),
              activo: true,
              actualizado_por: userId()
            };
            if(!old.data) payload.creado_por = userId();
            var up = await client.from('equipos_seriales').upsert(payload, {onConflict:'serial'}).select('*').single();
            if(up.error) throw up.error;
            after.push(up.data);
            var mv = {
              tipo_movimiento:'Entrada', serial_id:up.data.id, producto_id:item.productoId || prod.supabaseId,
              origen_tipo:'SUPLIDOR', origen_id:null, origen_nombre:suplidor,
              destino_tipo:'ALMACEN', destino_id:almacen.supabaseId, destino_nombre:almacen.nombre,
              cantidad:1, motivo:'Entrada de inventario '+referencia, observaciones:observacion,
              creado_por:userId(), usuario_nombre:userName(), creado_en:dateInputToISO(fechaValor)
            };
            var ins = await client.from('movimientos_inventario').insert(mv); if(ins.error) throw ins.error;
          }
        }else{
          var mvNoSerial = {
            tipo_movimiento:'Entrada', serial_id:null, producto_id:item.productoId || prod.supabaseId,
            origen_tipo:'SUPLIDOR', origen_id:null, origen_nombre:suplidor,
            destino_tipo:'ALMACEN', destino_id:almacen.supabaseId, destino_nombre:almacen.nombre,
            cantidad:Number(item.cantidad || 0) || 1, motivo:'Entrada de inventario '+referencia, observaciones:observacion,
            creado_por:userId(), usuario_nombre:userName(), creado_en:dateInputToISO(fechaValor)
          };
          var insNoSerial = await client.from('movimientos_inventario').insert(mvNoSerial).select('*').single();
          if(insNoSerial.error) throw insNoSerial.error;
          after.push(insNoSerial.data);
        }
      }
      await audit('Inventario','ENTRADA_INVENTARIO','movimientos_inventario',referencia,'Entrada hacia '+almacen.nombre,before,after);
      await reloadInventario();
      try{ if(typeof cerrarEntrada === 'function') cerrarEntrada(); }catch(e){}
      alert('Entrada guardada correctamente en Supabase.');
    }catch(err){
      console.error('Entrada v92:', err);
      alert('No se pudo guardar la entrada: ' + (err && err.message ? err.message : err));
    }
  }
function lotekaGetTipoProductoForm(){
  const el = document.getElementById('tipoProducto');
  const valor = el ? String(el.value || '').trim().toUpperCase() : 'EQUIPO';
  return valor === 'PIEZA' ? 'PIEZA' : 'EQUIPO';
}

function lotekaTipoProductoDesdeDato(item){
  const raw = String(
    (item && (item.tipo_producto || item.tipoProducto || item.tipoProductoLoteka)) || ''
  ).trim().toUpperCase();

  if(raw === 'PIEZA' || raw === 'EQUIPO') return raw;

  const texto = String([
    item && item.categoria,
    item && item.nombre,
    item && item.producto,
    item && item.codigo
  ].filter(Boolean).join(' ')).toLowerCase();

  if(
    texto.includes('pieza') ||
    texto.includes('parte') ||
    texto.includes('repuesto') ||
    texto.includes('insumo') ||
    texto.includes('material') ||
    texto.includes('consumible') ||
    texto.includes('fuente') ||
    texto.includes('board') ||
    texto.includes('motor') ||
    texto.includes('rodillo') ||
    texto.includes('cuchilla') ||
    texto.includes('carcaza') ||
    texto.includes('engranaje')
  ){
    return 'PIEZA';
  }

  return 'EQUIPO';
}

function lotekaRequiereSerialPorTipo(tipoProducto){
  return String(tipoProducto || '').toUpperCase() !== 'PIEZA';
}
  
 function productPayloadFromFormV92(existing){
  var nombre = clean(document.getElementById('nombre') && document.getElementById('nombre').value);
  var marca = clean(document.getElementById('marca') && document.getElementById('marca').value);
  var modelo = clean(document.getElementById('modelo') && document.getElementById('modelo').value);
  var precio = clean(document.getElementById('precio') && document.getElementById('precio').value);
  var tipoProducto = lotekaGetTipoProductoForm();
  var categoria = clean(document.getElementById('categoria') && document.getElementById('categoria').value);

  if(!categoria){
    categoria = tipoProducto === 'PIEZA' ? 'Piezas técnicas' : 'Equipos';
  }

  var img = typeof imagen !== 'undefined' ? imagen : '';
  var requiere = lotekaRequiereSerialPorTipo(tipoProducto);

  var meta = {
    __loteka_meta:true,
    marca:marca,
    modelo:modelo,
    precio:precio,
    imagen:img,
    categoria:categoria,
    tipo_producto:tipoProducto
  };

  return {
    codigo:(existing && existing.codigo) || slug(nombre),
    nombre:nombre,
    categoria:categoria,
    tipo_producto:tipoProducto,
    descripcion:JSON.stringify(meta),
    requiere_serial:requiere,
    activo:true,
    actualizado_por:userId(),
    creado_por: existing && existing.supabaseId ? existing.creado_por : userId()
  };
}

  async function guardarProductoSupabaseV92(){
    var nombre = clean(document.getElementById('nombre') && document.getElementById('nombre').value);
    if(!nombre){ alert('Pon nombre'); return; }
    var client = sb();
    if(!client){ alert('No hay conexión con Supabase.'); return; }
    var currentIndex = typeof editIndex !== 'undefined' ? editIndex : null;
    var existing = currentIndex !== null ? getProductos()[currentIndex] : null;
    var before = existing ? JSON.parse(JSON.stringify(existing)) : null;
    var payload = productPayloadFromFormV92(existing);
    try{
      var resp;
      if(existing && existing.supabaseId) resp = await client.from('productos').update(payload).eq('id', existing.supabaseId).select('*').single();
      else resp = await client.from('productos').insert(payload).select('*').single();
      if(resp.error) throw resp.error;
      await audit('Inventario', existing && existing.supabaseId ? 'EDITAR_PRODUCTO' : 'CREAR_PRODUCTO', 'productos', resp.data.id, 'Producto actualizado: '+resp.data.nombre, before, resp.data);
      await ensureProductosCargados();
      try{ if(typeof renderProductos === 'function') renderProductos(); }catch(e){}
      try{ if(typeof cerrarProducto === 'function') cerrarProducto(); }catch(e){}
      try{ if(typeof limpiarProducto === 'function') limpiarProducto(); }catch(e){}
      alert('Producto guardado correctamente.');
    }catch(err){ console.error('Producto v92:', err); alert('No se pudo guardar el producto: '+(err && err.message ? err.message : err)); }
  }

  function install(){
    window.llenarOpcionesModalEntrada = llenarOpcionesModalEntradaV92;
    window.abrirEntrada = abrirEntradaV92;
    window.agregarProductoEntrada = agregarProductoEntradaV92;
    window.guardarEntrada = saveEntradaSupabaseV92;
    window.guardarProducto = guardarProductoSupabaseV92;
    try{ llenarOpcionesModalEntrada = llenarOpcionesModalEntradaV92; abrirEntrada = abrirEntradaV92; agregarProductoEntrada = agregarProductoEntradaV92; guardarEntrada = saveEntradaSupabaseV92; guardarProducto = guardarProductoSupabaseV92; }catch(e){}
    ensureProductosCargados().then(function(){ rebuildNonSerializedStock(); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', function(){ setTimeout(install, 400); setTimeout(install, 1400); });
})();
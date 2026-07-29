
(function(){
  'use strict';
  if(window.__lotekaV95StockNoResetInstalled) return;
  window.__lotekaV95StockNoResetInstalled = true;

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function sb(){ return window.lotekaSupabase || null; }
  function getLocal(name){
    try{ if(name === 'almacenes' && Array.isArray(almacenes)) return almacenes; }catch(e){}
    try{ if(name === 'productos' && Array.isArray(productos)) return productos; }catch(e){}
    return Array.isArray(window[name]) ? window[name] : [];
  }
  function setLocal(name, value){
    window[name] = Array.isArray(value) ? value : [];
    try{ if(name === 'almacenes') almacenes = window[name]; }catch(e){}
    try{ if(name === 'productos') productos = window[name]; }catch(e){}
    try{ if(name === 'entradasInventario') entradasInventario = window[name]; }catch(e){}
  }
  function productMeta(row){
    try{ var m = typeof row.descripcion === 'string' ? JSON.parse(row.descripcion) : null; return m && m.__loteka_meta === true ? m : {}; }catch(e){ return {}; }
  }
  function almacenMeta(row){
    try{ var m = typeof row.descripcion === 'string' ? JSON.parse(row.descripcion) : null; return m && m.__loteka_almacen_meta === true ? m : {}; }catch(e){ return {}; }
  }
  function mapProducto(row){
    var m = productMeta(row || {});
    return {
      supabaseId: row.id,
      codigo: row.codigo || '',
      nombre: row.nombre || '',
      marca: m.marca || '',
      modelo: m.modelo || '',
      precio: m.precio || '',
      categoria: row.categoria || m.categoria || 'Inventario',
      imagen: m.imagen || '',
      requiereSerial: row.requiere_serial !== false,
      activo: row.activo !== false
    };
  }
  function mapAlmacen(row){
    var m = almacenMeta(row || {});
    return {
      supabaseId: row.id,
      codigo: row.codigo || '',
      nombre: row.nombre || '',
      tipo: row.tipo || 'Principal',
      ubicacion: m.ubicacion || '',
      descripcion: m.descripcion || (row.descripcion && !m.__loteka_almacen_meta ? row.descripcion : ''),
      stats: { productos:0, unidades:0, ultimo:'Sin movimientos' },
      inventario: [],
      movimientos: [],
      activo: row.activo !== false
    };
  }
  function productoNombre(p){ return clean(p && (p.nombre || p.producto)) || 'Producto sin nombre'; }
  function entradaRef(m){
    var s = clean(m && m.motivo);
    var match = s.match(/Entrada de inventario\s+(.+)$/i);
    if(match) return clean(match[1]);
    return 'ENT-' + String((m && m.creado_en) || Date.now()).replace(/[^0-9]/g,'').slice(0,12);
  }
  function formatDateTime(v){
    if(!v) return '';
    var d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('es-DO');
  }
  function formatDate(v){
    if(!v) return '';
    var d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-DO');
  }
  function sameId(a,b){ return clean(a) && clean(b) && clean(a) === clean(b); }

  function reconstruirEntradasReales(){
    var productos = getLocal('productos');
    var prodMap = new Map(productos.map(function(p){ return [String(p.supabaseId), p]; }));
    var groups = new Map();
    arr(window.lotekaMovimientosInventarioSupabase).filter(function(m){ return m && m.tipo_movimiento === 'Entrada'; }).forEach(function(m){
      var ref = entradaRef(m);
      var key = ref + '|' + clean(m.destino_id || m.destino_nombre);
      if(!groups.has(key)){
        groups.set(key, {
          ref: ref,
          almacen: m.destino_nombre || 'Almacén',
          fecha: m.creado_en,
          usuario: m.usuario_nombre || 'Usuario',
          suplidor: m.origen_nombre || 'Suplidor General',
          unidades: 0,
          serializado: 'no',
          items: []
        });
      }
      var g = groups.get(key);
      var p = prodMap.get(String(m.producto_id)) || { nombre:'Producto sin nombre', marca:'', modelo:'', categoria:'Inventario' };
      var qty = Number(m.cantidad || 0) || 0;
      g.unidades += qty;
      var serializado = m.serial_id ? 'si' : 'no';
      if(serializado === 'si') g.serializado = 'si';
      var ex = g.items.find(function(i){ return i.productoId === m.producto_id && i.serializado === serializado; });
      if(!ex){
        ex = { producto: productoNombre(p), productoId:m.producto_id, marca:p.marca||'', modelo:p.modelo||'', categoria:p.categoria||'', cantidad:0, serializado:serializado, seriales:[] };
        g.items.push(ex);
      }
      ex.cantidad += qty;
    });
    var list = Array.from(groups.values()).map(function(g){
      var d = g.fecha ? new Date(g.fecha) : new Date();
      var fecha = isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-DO');
      var hora = isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-DO',{hour:'2-digit',minute:'2-digit'});
      return {
        codigo:g.ref,
        almacen:g.almacen,
        producto:g.items.length === 1 ? g.items[0].producto : (g.items[0] ? g.items[0].producto + ' (+' + (g.items.length-1) + ')' : 'Entrada'),
        productosResumen:g.items.map(function(i){ return i.producto + ' (' + i.cantidad + ')'; }).join(', '),
        unidades:g.unidades,
        fecha:fecha,
        hora:hora,
        fechaHora:formatDateTime(g.fecha),
        fechaVista:formatDateTime(g.fecha),
        fechaISO:g.fecha ? String(g.fecha).slice(0,10) : '',
        usuario:g.usuario,
        estado:'Recibido',
        suplidor:g.suplidor,
        serializado:g.serializado,
        observacion:'',
        items:g.items
      };
    }).sort(function(a,b){ return String(b.fechaHora).localeCompare(String(a.fechaHora)); });
    setLocal('entradasInventario', list);
  }

  function reconstruirStockReal(){
    var almacenes = getLocal('almacenes');
    var productos = getLocal('productos');
    if(!almacenes.length) return false;
    var prodMap = new Map(productos.map(function(p){ return [String(p.supabaseId), p]; }));
    var almMap = new Map(almacenes.map(function(a){ return [String(a.supabaseId), a]; }));

    almacenes.forEach(function(a){
      a.inventario = [];
      a.movimientos = [];
      a.stats = { productos:0, unidades:0, ultimo:'Sin movimientos' };
    });

    arr(window.lotekaEquiposSerialesSupabase).forEach(function(row){
      if(!row || row.activo === false || row.ubicacion_tipo !== 'ALMACEN' || !row.almacen_id) return;
      var a = almMap.get(String(row.almacen_id));
      if(!a) return;
      var p = prodMap.get(String(row.producto_id)) || { nombre:'Equipo sin producto', marca:'', modelo:'', categoria:'Equipos' };
      var item = a.inventario.find(function(x){ return x.productoId === row.producto_id && x.tipo === 'Serializado'; });
      if(!item){
        item = { productoId:row.producto_id, producto:productoNombre(p), marca:p.marca||'', modelo:p.modelo||'', categoria:p.categoria||'Equipos', tipo:'Serializado', cantidad:0, serializado:'si', seriales:[], imagen:p.imagen||'' };
        a.inventario.push(item);
      }
      item.cantidad += 1;
      if(row.serial) item.seriales.push(row.serial);
    });

    var stockNoSerial = new Map();
    arr(window.lotekaMovimientosInventarioSupabase).forEach(function(m){
      if(!m) return;
      almacenes.forEach(function(a){
        if(!a || !a.supabaseId) return;
        if((m.destino_tipo === 'ALMACEN' && sameId(m.destino_id, a.supabaseId)) || (m.origen_tipo === 'ALMACEN' && sameId(m.origen_id, a.supabaseId))){
          a.movimientos.push({
            fechaHora: formatDateTime(m.creado_en),
            fecha: formatDate(m.creado_en),
            tipo: m.tipo_movimiento || '',
            referencia: entradaRef(m),
            usuario: m.usuario_nombre || '',
            detalle: m.motivo || m.observaciones || ''
          });
        }
      });
      if(m.serial_id) return;
      var pid = m.producto_id;
      var qty = Number(m.cantidad || 0) || 0;
      if(!pid || !qty) return;
      if(m.destino_tipo === 'ALMACEN' && m.destino_id){
        var k1 = String(m.destino_id) + '|' + String(pid);
        stockNoSerial.set(k1, (stockNoSerial.get(k1) || 0) + qty);
      }
      if(m.origen_tipo === 'ALMACEN' && m.origen_id){
        var k2 = String(m.origen_id) + '|' + String(pid);
        stockNoSerial.set(k2, (stockNoSerial.get(k2) || 0) - qty);
      }
    });

    stockNoSerial.forEach(function(qty, key){
      if(qty <= 0) return;
      var parts = key.split('|');
      var a = almMap.get(parts[0]);
      var p = prodMap.get(parts[1]) || { nombre:'Producto sin nombre', marca:'', modelo:'', categoria:'Inventario' };
      if(!a) return;
      a.inventario.push({ productoId:parts[1], producto:productoNombre(p), marca:p.marca||'', modelo:p.modelo||'', categoria:p.categoria||'Inventario', tipo:'No serializado', cantidad:qty, serializado:'no', seriales:[], imagen:p.imagen||'' });
    });

    almacenes.forEach(function(a){
      var total = a.inventario.reduce(function(s,i){ return s + (Number(i.cantidad) || 0); }, 0);
      var last = a.movimientos.length ? a.movimientos.slice().sort(function(x,y){ return String(x.fechaHora).localeCompare(String(y.fechaHora)); }).pop() : null;
      a.stats = { productos:a.inventario.length, unidades:total, ultimo:last ? (last.fechaHora || last.fecha || 'Sin movimientos') : 'Sin movimientos' };
    });
    reconstruirEntradasReales();
    setLocal('almacenes', almacenes);
    return true;
  }

  async function cargarTodoInventarioReal(){
    var client = sb();
    if(!client) return false;
    try{
      var pr = await client.from('productos').select('*').eq('activo', true).order('nombre', {ascending:true});
      if(pr.error) throw pr.error;
      var al = await client.from('almacenes').select('*').eq('activo', true).order('nombre', {ascending:true});
      if(al.error) throw al.error;
      var sr = await client.from('equipos_seriales').select('*').order('creado_en', {ascending:false});
      if(sr.error) throw sr.error;
      var mv = await client.from('movimientos_inventario').select('*').order('creado_en', {ascending:false}).limit(3000);
      if(mv.error) throw mv.error;

      setLocal('productos', arr(pr.data).map(mapProducto));
      setLocal('almacenes', arr(al.data).map(mapAlmacen));
      window.lotekaEquiposSerialesSupabase = sr.data || [];
      window.lotekaMovimientosInventarioSupabase = mv.data || [];
      window.lotekaInventarioSource = 'supabase-v95';
      reconstruirStockReal();
      pintarVistasInventario();
      return true;
    }catch(err){
      console.warn('Inventario v95 no pudo cargar Supabase:', err && err.message ? err.message : err);
      reconstruirStockReal();
      pintarVistasInventario();
      return false;
    }
  }

  function pintarVistasInventario(){
    try{ if(typeof window.__lotekaV95BaseRenderAlmacenes === 'function') window.__lotekaV95BaseRenderAlmacenes(); else if(typeof window.renderAlmacenes === 'function' && !window.__lotekaV95Rendering) window.renderAlmacenes(); }catch(e){}
    try{ if(typeof renderEntradas === 'function') renderEntradas(); }catch(e){}
    try{ if(typeof llenarFiltrosEntrada === 'function') llenarFiltrosEntrada(); }catch(e){}
    try{ if(typeof window.lotekaInvTecnicoSetTipo === 'function') window.lotekaInvTecnicoSetTipo(window.__lotekaInvTecnicoTipoActual || 'equipos'); }catch(e){}
  }

  function instalarRenderSeguro(){
    if(!window.__lotekaV95BaseRenderAlmacenes && typeof window.renderAlmacenes === 'function') window.__lotekaV95BaseRenderAlmacenes = window.renderAlmacenes;
    if(!window.__lotekaV95BaseRenderEntradas && typeof window.renderEntradas === 'function') window.__lotekaV95BaseRenderEntradas = window.renderEntradas;

    if(typeof window.__lotekaV95BaseRenderAlmacenes === 'function'){
      window.renderAlmacenes = function(){
        if(window.__lotekaV95Rendering) return window.__lotekaV95BaseRenderAlmacenes.apply(this, arguments);
        window.__lotekaV95Rendering = true;
        try{ reconstruirStockReal(); return window.__lotekaV95BaseRenderAlmacenes.apply(this, arguments); }
        finally{ window.__lotekaV95Rendering = false; }
      };
      try{ renderAlmacenes = window.renderAlmacenes; }catch(e){}
    }
  }

  var oldReload = window.lotekaReloadInventarioTallerSupabase;
  window.lotekaReloadInventarioTallerSupabase = async function(){
    var ok = await cargarTodoInventarioReal();
    return ok;
  };
  window.lotekaReconstruirStockInventarioReal = reconstruirStockReal;
  window.lotekaCargarInventarioRealV95 = cargarTodoInventarioReal;

  function boot(){
    instalarRenderSeguro();
    reconstruirStockReal();
    setTimeout(function(){ instalarRenderSeguro(); cargarTodoInventarioReal(); }, 300);
    setTimeout(function(){ instalarRenderSeguro(); cargarTodoInventarioReal(); }, 1600);
    setTimeout(function(){ instalarRenderSeguro(); reconstruirStockReal(); pintarVistasInventario(); }, 3600);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', function(){ setTimeout(boot, 600); setTimeout(boot, 2400); });
})();
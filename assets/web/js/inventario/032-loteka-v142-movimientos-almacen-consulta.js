
(function(){
  'use strict';

  const cache = {loaded:false, movimientos:[], productos:[], seriales:[], almacenes:[], agencias:[], grupos:[]};
  const oldVerDetalleAlmacen = window.verDetalleAlmacen || (typeof verDetalleAlmacen === 'function' ? verDetalleAlmacen : null);
  const oldVerDetalleTransferencia = window.verDetalleTransferencia || (typeof verDetalleTransferencia === 'function' ? verDetalleTransferencia : null);

  function sb(){ return window.lotekaSupabase || null; }
  function txt(v){ return String(v ?? '').trim(); }
  function esc(v){ return txt(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function norm(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(); }
  function same(a,b){ return txt(a) && txt(b) && txt(a) === txt(b); }
  function code(m){ return m && m.id ? ('MOV-' + String(m.id).slice(0,8).toUpperCase()) : 'MOV-SIN-ID'; }
  function dateTime(v){ try{ const d=new Date(v); if(!isNaN(d.getTime())) return d.toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(e){} return txt(v) || '-'; }

  async function load(force){
    const client = sb();
    if(!client) return cache;
    if(cache.loaded && !force) return cache;
    try{
      const [mv, pr, sr, al, ag, gr] = await Promise.all([
        client.from('movimientos_inventario').select('*').order('creado_en',{ascending:false}).limit(5000),
        client.from('productos').select('*').limit(30000),
        client.from('equipos_seriales').select('*').limit(30000),
        client.from('almacenes').select('*').limit(3000),
        client.from('agencias').select('*').limit(50000),
        client.from('grupos').select('*').limit(5000)
      ]);
      if(mv.error) throw mv.error;
      cache.movimientos = Array.isArray(mv.data) ? mv.data : [];
      cache.productos = pr.error ? [] : (pr.data || []);
      cache.seriales = sr.error ? [] : (sr.data || []);
      cache.almacenes = al.error ? [] : (al.data || []);
      cache.agencias = ag.error ? [] : (ag.data || []);
      cache.grupos = gr.error ? [] : (gr.data || []);
      cache.loaded = true;
    }catch(err){
      console.error('[LOTEKA v142] No se pudieron cargar movimientos de almacén:', err);
      cache.loaded = true;
    }
    return cache;
  }

  function productoById(id){ return cache.productos.find(p => same(p.id,id)) || null; }
  function serialById(id){ return cache.seriales.find(s => same(s.id,id)) || null; }
  function locationName(tipo,id,nombre){
    if(txt(nombre)) return txt(nombre);
    const t = norm(tipo);
    if(t === 'ALMACEN'){
      const a = cache.almacenes.find(x => same(x.id,id));
      return a ? (a.nombre || a.codigo || 'Almacén') : 'Almacén no especificado';
    }
    if(t === 'AGENCIA'){
      const a = cache.agencias.find(x => same(x.id,id));
      if(a){
        const n = a.numero || a.codigo || a.no_agencia || a.nombre || '';
        return txt(a.nombre) || (n ? 'Agencia ' + String(n).padStart(4,'0') : 'Agencia');
      }
      return 'Agencia no especificada';
    }
    if(t === 'GRUPO'){
      const g = cache.grupos.find(x => same(x.id,id));
      return g ? (g.nombre || g.codigo || 'Grupo') : 'Grupo no especificado';
    }
    return txt(tipo) || 'No especificado';
  }

  function productoInfo(m){
    const p = productoById(m && m.producto_id) || {};
    const s = serialById(m && m.serial_id) || {};
    return {
      nombre: p.nombre || p.codigo || s.producto_nombre || s.serial || 'Producto no especificado',
      marca: p.marca || '',
      modelo: p.modelo || '',
      categoria: p.categoria || 'Inventario',
      serial: s.serial || '',
      serializado: m && m.serial_id ? 'Sí' : 'No'
    };
  }

  function isMovementForAlmacen(m, almacen){
    if(!m || !almacen) return false;
    const id = almacen.supabaseId || almacen.id;
    const nombre = almacen.nombre || almacen.codigo || '';
    return (norm(m.origen_tipo)==='ALMACEN' && (same(m.origen_id,id) || (txt(m.origen_nombre) && norm(m.origen_nombre)===norm(nombre)))) ||
           (norm(m.destino_tipo)==='ALMACEN' && (same(m.destino_id,id) || (txt(m.destino_nombre) && norm(m.destino_nombre)===norm(nombre))));
  }

  function renderMovimientoRows(almacenIndex){
    const body = document.getElementById('detalleMovimientosBody');
    if(!body) return;
    const list = (Array.isArray(window.almacenes) ? window.almacenes : (typeof almacenes !== 'undefined' ? almacenes : []));
    const almacen = list && list[almacenIndex];
    if(!almacen) return;
    const rows = cache.movimientos.filter(m => isMovementForAlmacen(m, almacen));
    if(!rows.length){
      body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#8a8a8a;font-style:italic;font-weight:700;padding:24px">Este almacén no tiene movimientos registrados en Supabase.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(m => {
      const p = productoInfo(m);
      const origen = locationName(m.origen_tipo,m.origen_id,m.origen_nombre);
      const destino = locationName(m.destino_tipo,m.destino_id,m.destino_nombre);
      const ingresoSalida = (norm(m.destino_tipo)==='ALMACEN' && same(m.destino_id, almacen.supabaseId || almacen.id)) ? 'Entrada al almacén' : 'Salida del almacén';
      return `<tr>
        <td>${esc(dateTime(m.creado_en))}</td>
        <td><span class="loteka-alm-mov-type-v142"><i class="fas fa-right-left"></i> ${esc(m.tipo_movimiento || 'Movimiento')}</span><span class="loteka-alm-mov-ref-v142">${esc(ingresoSalida)}</span></td>
        <td>${esc(code(m))}</td>
        <td>${esc(m.usuario_nombre || 'Usuario')}</td>
        <td><span class="loteka-alm-mov-detail-v142">${esc(origen)} → ${esc(destino)}<small>${esc(p.nombre)}${p.serial ? ' · Serial: ' + esc(p.serial) : ''} · Cantidad: ${esc(m.cantidad || 1)}</small></span></td>
        <td class="actions"><i class="fas fa-eye" title="Consultar movimiento" onclick="lotekaVerDetalleMovimientoAlmacenV142('${esc(m.id || code(m))}')"></i></td>
      </tr>`;
    }).join('');
  }

  async function refreshAlmacenMovimientos(almacenIndex){
    await load(true);
    renderMovimientoRows(almacenIndex);
  }

  async function openMovementDetail(idOrCode){
    await load(false);
    let m = cache.movimientos.find(x => same(x.id,idOrCode) || code(x) === String(idOrCode));
    if(!m){
      const maybe = String(idOrCode || '').replace(/^MOV-/i,'').toUpperCase();
      m = cache.movimientos.find(x => String(x.id || '').toUpperCase().startsWith(maybe));
    }
    if(!m){
      alert('No se encontró el detalle de este movimiento en Supabase. Actualiza la vista e intenta de nuevo.');
      return;
    }
    const p = productoInfo(m);
    const origen = locationName(m.origen_tipo,m.origen_id,m.origen_nombre);
    const destino = locationName(m.destino_tipo,m.destino_id,m.destino_nombre);
    const title = document.getElementById('detalleTransferenciaTitulo');
    const cod = document.getElementById('detalleTransferenciaCodigo');
    const meta = document.getElementById('detalleTransferenciaMeta');
    const resumen = document.getElementById('detalleTransferenciaResumen');
    const tbody = document.getElementById('detalleTransferenciaItemsBody');
    if(title) title.innerText = 'Detalle de Movimiento de Inventario';
    if(cod) cod.innerText = code(m);
    if(meta) meta.innerText = `${origen} → ${destino} · ${dateTime(m.creado_en)} · ${m.usuario_nombre || 'Usuario'}`;
    if(resumen){
      resumen.innerHTML = `<div class="loteka-detail-grid-v142">
        <div><small>Tipo</small>${esc(m.tipo_movimiento || 'Movimiento')}</div>
        <div><small>Motivo</small>${esc(m.motivo || 'Sin motivo')}</div>
        <div><small>Origen</small>${esc(origen)}</div>
        <div><small>Destino</small>${esc(destino)}</div>
        <div><small>Usuario</small>${esc(m.usuario_nombre || 'Usuario')}</div>
        <div><small>Fecha y hora</small>${esc(dateTime(m.creado_en))}</div>
        <div><small>Cantidad</small>${esc(m.cantidad || 1)}</div>
        <div><small>Serial</small>${esc(p.serial || 'No aplica')}</div>
      </div><div class="loteka-detail-note-v142"><b>Observación:</b><br>${esc(m.observaciones || 'Sin observación registrada.')}</div>`;
    }
    if(tbody){
      tbody.innerHTML = `<tr>
        <td>${esc(p.nombre)}</td>
        <td>${esc(p.marca)}</td>
        <td>${esc(p.modelo)}</td>
        <td>${esc(p.categoria)}</td>
        <td>${esc(m.cantidad || 1)}</td>
        <td>${esc(p.serializado === 'Sí' ? 'Serializado' : 'No serializado')}</td>
        <td>${esc(p.serial || 'No aplica')}</td>
      </tr>`;
    }
    const modal = document.getElementById('modalDetalleTransferencia');
    if(modal) modal.style.display = 'flex';
  }

  window.lotekaVerDetalleMovimientoAlmacenV142 = openMovementDetail;
  window.lotekaRefrescarMovimientosAlmacenV142 = refreshAlmacenMovimientos;

  if(oldVerDetalleAlmacen && !oldVerDetalleAlmacen.__v142){
    const wrapped = function(i){
      const out = oldVerDetalleAlmacen.apply(this, arguments);
      setTimeout(function(){ refreshAlmacenMovimientos(Number(i)); }, 220);
      return out;
    };
    wrapped.__v142 = true;
    window.verDetalleAlmacen = wrapped;
    try{ verDetalleAlmacen = wrapped; }catch(e){}
  }

  window.verDetalleTransferencia = async function(codigo){
    await load(false);
    const c = String(codigo || '');
    if(/^MOV-/i.test(c) || cache.movimientos.some(m => same(m.id,c) || code(m) === c)){
      return openMovementDetail(c);
    }
    try{
      if(Array.isArray(window.transferenciasInventario)){
        const item = window.transferenciasInventario.find(x => String(x.codigo) === c || String(x.id) === c);
        if(item && item.raw && item.raw.id) return openMovementDetail(item.raw.id);
      }
    }catch(e){}
    if(oldVerDetalleTransferencia && oldVerDetalleTransferencia !== window.verDetalleTransferencia){
      return oldVerDetalleTransferencia.apply(this, arguments);
    }
    return openMovementDetail(c);
  };
  try{ verDetalleTransferencia = window.verDetalleTransferencia; }catch(e){}

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ load(false); }, 1200); });
})();

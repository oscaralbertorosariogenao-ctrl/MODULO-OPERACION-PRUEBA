
(function(){
  'use strict';
  if(window.__lotekaV221AlmacenesMovimientosInstalled) return;
  window.__lotekaV221AlmacenesMovimientosInstalled = true;

  function txt(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function esc(v){ return txt(v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];}); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function same(a,b){ return txt(a) && txt(b) && txt(a) === txt(b); }
  function getAlmacenes(){ try{ return Array.isArray(almacenes) ? almacenes : []; }catch(e){ return Array.isArray(window.almacenes) ? window.almacenes : []; } }
  function setAlmacenes(list){ window.almacenes = list || []; try{ almacenes = window.almacenes; }catch(e){} }
  function getMovsSupabase(){ return arr(window.lotekaMovimientosInventarioSupabase); }

  function parseDateValue(value){
    var raw = txt(value);
    if(!raw) return 0;
    var d = new Date(raw);
    if(!isNaN(d.getTime())) return d.getTime();
    var m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s*,?\s*(\d{1,2}):(\d{2})(?:\s*(a\.\s*m\.|p\.\s*m\.|AM|PM))?)?/i);
    if(m){
      var day = Number(m[1]), mon = Number(m[2]) - 1, year = Number(m[3]);
      var hh = Number(m[4] || 0), mm = Number(m[5] || 0), ap = norm(m[6] || '');
      if(ap.indexOf('p') >= 0 && hh < 12) hh += 12;
      if(ap.indexOf('a') >= 0 && hh === 12) hh = 0;
      d = new Date(year, mon, day, hh, mm, 0);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
  }

  function movementTime(m){
    return parseDateValue(m.creado_en || m.fechaISO || m.fechaHora || m.fechaVista || ((m.fecha || '') + ' ' + (m.hora || '')).trim());
  }

  function formatDate(value){
    var time = parseDateValue(value);
    if(!time) return txt(value) || 'Sin fecha';
    return new Date(time).toLocaleString('es-DO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function isSameDay(ts, dateObj){
    if(!ts) return false;
    var d = new Date(ts);
    return d.getFullYear() === dateObj.getFullYear() && d.getMonth() === dateObj.getMonth() && d.getDate() === dateObj.getDate();
  }

  function almacenMatchesMovimiento(almacen, mov){
    if(!almacen || !mov) return false;
    var aid = txt(almacen.supabaseId || almacen.id || almacen.almacen_id);
    var nombre = norm(almacen.nombre);
    if(aid && (same(mov.origen_id, aid) || same(mov.destino_id, aid) || same(mov.almacen_id, aid))) return true;
    var origen = norm(mov.origen_nombre || mov.origen || '');
    var destino = norm(mov.destino_nombre || mov.destino || mov.almacen || '');
    return !!(nombre && (origen === nombre || destino === nombre));
  }

  function movimientoContexto(almacen, mov){
    var tipoRaw = txt(mov.tipo_movimiento || mov.tipo || mov.movimiento || 'Movimiento');
    var tipoNorm = norm(tipoRaw);
    var aid = txt(almacen && (almacen.supabaseId || almacen.id || almacen.almacen_id));
    var esDestino = (aid && same(mov.destino_id, aid)) || (norm(mov.destino_nombre || mov.destino || mov.almacen) === norm(almacen && almacen.nombre));
    var esOrigen = (aid && same(mov.origen_id, aid)) || (norm(mov.origen_nombre || mov.origen) === norm(almacen && almacen.nombre));
    var clase = 'transferencia';
    var etiqueta = 'Movimiento';
    var icon = 'fa-right-left';

    if(tipoNorm.indexOf('despacho') >= 0){ clase = 'salida'; etiqueta = 'Despacho'; icon = 'fa-truck-ramp-box'; }
    else if(tipoNorm.indexOf('entrada') >= 0){ clase = 'entrada'; etiqueta = tipoNorm.indexOf('transferencia') >= 0 ? 'Transferencia recibida' : 'Entrada'; icon = tipoNorm.indexOf('transferencia') >= 0 ? 'fa-right-left' : 'fa-arrow-down'; }
    else if(tipoNorm.indexOf('salida') >= 0){ clase = 'salida'; etiqueta = tipoNorm.indexOf('transferencia') >= 0 ? 'Transferencia enviada' : 'Salida'; icon = tipoNorm.indexOf('transferencia') >= 0 ? 'fa-right-left' : 'fa-arrow-up-right-from-square'; }
    else if(tipoNorm.indexOf('transfer') >= 0){
      clase = 'transferencia'; icon = 'fa-right-left';
      etiqueta = esDestino ? 'Transferencia recibida' : esOrigen ? 'Transferencia enviada' : 'Transferencia';
    }else if(norm(mov.destino_tipo) === 'almacen' && esDestino){ clase = 'entrada'; etiqueta = 'Entrada'; icon = 'fa-arrow-down'; }
    else if(norm(mov.origen_tipo) === 'almacen' && esOrigen){ clase = 'salida'; etiqueta = 'Salida'; icon = 'fa-arrow-up-right-from-square'; }

    var origenNombre = txt(mov.origen_nombre || mov.origen || '');
    var destinoNombre = txt(mov.destino_nombre || mov.destino || '');
    var ref = txt(mov.referencia || mov.codigo || mov.id || '');
    var detalle = txt(mov.detalle || mov.motivo || mov.observaciones || '');
    if(!detalle){
      if(etiqueta.indexOf('recibida') >= 0 && origenNombre) detalle = 'Desde ' + origenNombre;
      else if(etiqueta.indexOf('enviada') >= 0 && destinoNombre) detalle = 'Hacia ' + destinoNombre;
      else if(clase === 'entrada' && origenNombre) detalle = 'Desde ' + origenNombre;
      else if(clase === 'salida' && destinoNombre) detalle = 'Hacia ' + destinoNombre;
    }
    return { clase:clase, etiqueta:etiqueta, icon:icon, detalle:detalle || 'Movimiento registrado', referencia:ref };
  }

  function movimientosDelAlmacen(almacen){
    var supa = getMovsSupabase();
    var fuente = supa.length ? supa.filter(function(m){ return almacenMatchesMovimiento(almacen, m); }) : arr(almacen && almacen.movimientos);
    return fuente.slice().sort(function(a,b){ return movementTime(b) - movementTime(a); });
  }

  function ultimoMovimientoAlmacen(almacen){
    var mov = movimientosDelAlmacen(almacen)[0] || null;
    if(!mov) return null;
    var ctx = movimientoContexto(almacen, mov);
    return {
      raw: mov,
      ts: movementTime(mov),
      fecha: formatDate(mov.creado_en || mov.fechaHora || mov.fechaVista || ((mov.fecha || '') + ' ' + (mov.hora || '')).trim()),
      clase: ctx.clase,
      etiqueta: ctx.etiqueta,
      icon: ctx.icon,
      detalle: ctx.detalle,
      referencia: ctx.referencia
    };
  }

  function renderUltimoMovimiento(almacen){
    var last = ultimoMovimientoAlmacen(almacen);
    if(!last){
      return '<div class="go-alm-last"><span class="go-alm-last-icon sin"><i class="fas fa-clock"></i></span><div class="go-alm-last-info"><span class="go-alm-chip sin"><i class="fas fa-minus-circle"></i> Sin movimientos</span><b>Sin movimientos registrados</b><small>Este almacén todavía no tiene entrada, salida o transferencia registrada.</small></div></div>';
    }
    return '<div class="go-alm-last"><span class="go-alm-last-icon '+esc(last.clase)+'"><i class="fas '+esc(last.icon)+'"></i></span><div class="go-alm-last-info"><span class="go-alm-chip '+esc(last.clase)+'"><i class="fas '+esc(last.icon)+'"></i> '+esc(last.etiqueta)+'</span><b>'+esc(last.fecha)+'</b><small>'+esc(last.detalle)+'</small>'+(last.referencia ? '<em>Ref: '+esc(String(last.referencia).slice(0,18))+'</em>' : '')+'</div></div>';
  }

  window.lotekaAlmacenUltimoMovimientoReal = ultimoMovimientoAlmacen;
  window.lotekaAlmacenMovimientosReales = movimientosDelAlmacen;

  function actualizarDashboardAlmacenesV221(){
    var list = getAlmacenes().filter(function(a){
      var codigo = txt(a && a.codigo).toUpperCase();
      var nombre = txt(a && a.nombre).toUpperCase();
      return a && a.activo !== false && codigo !== 'ALM-TEST' && nombre !== 'ALM-TEST';
    });
    var totalAlmacenes = list.length;
    var totalProductosEnAlmacenes = list.reduce(function(acc, almacen){
      return acc + arr(almacen.inventario).reduce(function(sub, item){ return sub + (Number(item.cantidad) || 0); }, 0);
    }, 0);
    var hoy = new Date();
    var movimientosHoy = list.reduce(function(acc, almacen){
      return acc + movimientosDelAlmacen(almacen).filter(function(m){ return isSameDay(movementTime(m), hoy); }).length;
    }, 0);
    var a = document.getElementById('dashTotalAlmacenes');
    var p = document.getElementById('dashProductosAlmacenes');
    var m = document.getElementById('dashMovimientosHoy');
    if(a) a.innerText = totalAlmacenes;
    if(p) p.innerText = totalProductosEnAlmacenes;
    if(m) m.innerText = movimientosHoy;
  }

  window.actualizarDashboardAlmacenes = actualizarDashboardAlmacenesV221;
  try{ actualizarDashboardAlmacenes = actualizarDashboardAlmacenesV221; }catch(e){}

  function renderAlmacenesV221(){
    try{ if(typeof window.lotekaReconstruirStockInventarioReal === 'function' && !window.__lotekaV221Rendering){ window.__lotekaV221Rendering = true; window.lotekaReconstruirStockInventarioReal(); window.__lotekaV221Rendering = false; } }catch(e){ window.__lotekaV221Rendering = false; }
    var tbody = document.getElementById('tabla-almacenes');
    if(!tbody) return;
    tbody.innerHTML = '';
    var list = getAlmacenes();
    list.forEach(function(a, i){
      var codigoAlmacen = txt(a && a.codigo).toUpperCase();
      var nombreAlmacen = txt(a && a.nombre).toUpperCase();
      if(!a || a.activo === false || codigoAlmacen === 'ALM-TEST' || nombreAlmacen === 'ALM-TEST') return;
      var totalProductos = arr(a.inventario).length;
      var totalUnidades = arr(a.inventario).reduce(function(sum, item){ return sum + (Number(item.cantidad) || 0); }, 0);
      var tipo = txt(a.tipo || a.descripcion || 'Físico') || 'Físico';
      var last = ultimoMovimientoAlmacen(a);
      a.stats = { productos: totalProductos, unidades: totalUnidades, ultimo: last ? (last.etiqueta + ' · ' + last.fecha + (last.detalle ? ' · ' + last.detalle : '')) : 'Sin movimientos' };
      var icon = norm(tipo).indexOf('taller') >= 0 ? 'fa-screwdriver-wrench' : norm(tipo).indexOf('tecnico') >= 0 ? 'fa-user-gear' : 'fa-warehouse';
      tbody.innerHTML += '<tr>'+
        '<td><div class="go-alm-namebox"><span class="go-alm-avatar"><i class="fas '+icon+'"></i></span><div><b>'+esc(a.nombre || 'Almacén')+'</b><small>'+esc(a.ubicacion || 'Ubicación no definida')+'</small></div></div></td>'+
        '<td><span class="go-alm-type"><i class="fas '+icon+'"></i> '+esc(tipo)+'</span></td>'+
        '<td><span class="go-alm-count">'+esc(totalProductos)+'</span></td>'+
        '<td><span class="go-alm-count">'+esc(totalUnidades)+'</span></td>'+
        '<td>'+renderUltimoMovimiento(a)+'</td>'+
        '<td class="actions"><i class="fas fa-eye" title="Ver almacén" onclick="verDetalleAlmacen('+i+')"></i><i class="fas fa-edit" title="Editar almacén" onclick="editarAlmacen('+i+')"></i></td>'+
      '</tr>';
    });
    actualizarDashboardAlmacenesV221();
  }

  window.renderAlmacenes = renderAlmacenesV221;
  try{ renderAlmacenes = renderAlmacenesV221; }catch(e){}

  function refreshIfNeeded(){
    try{ renderAlmacenesV221(); }catch(e){ console.warn('Almacenes v221:', e); }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshIfNeeded);
  else setTimeout(refreshIfNeeded, 80);
})();




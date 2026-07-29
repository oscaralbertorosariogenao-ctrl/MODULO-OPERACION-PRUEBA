
(function(){
  'use strict';
  if(window.__lotekaV147EntradaPiezasDiagnosticoFix) return;
  window.__lotekaV147EntradaPiezasDiagnosticoFix = true;

  function txt(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function upper(v){ return txt(v).toUpperCase(); }
  function esc(v){ return txt(v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function uuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txt(v)); }
  function sb(){ return window.lotekaSupabase || window.supabaseClient || null; }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function nowISO(){ return new Date().toISOString(); }
  function currentUserId(){
    const candidates = [
      window.lotekaAuthState && window.lotekaAuthState.user && window.lotekaAuthState.user.id,
      window.lotekaCurrentUser && window.lotekaCurrentUser.id,
      window.lotekaAuthUser && window.lotekaAuthUser.id
    ];
    for(const id of candidates){ if(uuid(id)) return id; }
    return null;
  }
  function currentUserName(){
    return txt(
      (window.lotekaAuthState && window.lotekaAuthState.profile && (window.lotekaAuthState.profile.nombre_completo || window.lotekaAuthState.profile.email)) ||
      (window.lotekaUserProfile && window.lotekaUserProfile.nombre_completo) ||
      (window.lotekaCurrentProfile && window.lotekaCurrentProfile.nombre_completo) ||
      (window.lotekaCurrentUser && window.lotekaCurrentUser.email) ||
      (window.lotekaAuthUser && window.lotekaAuthUser.email) ||
      localStorage.getItem('loteka_user_name') ||
      'Usuario'
    );
  }
  function getLocal(name){
    try{ if(Array.isArray(window[name])) return window[name]; }catch(e){}
    try{ if(typeof window[name] !== 'undefined' && Array.isArray(eval(name))) return eval(name); }catch(e){}
    return [];
  }
  function setLocal(name, value){
    window[name] = arr(value);
    try{ eval(name + '=window["' + name + '"];'); }catch(e){}
  }
  function productoId(p){ return txt(p && (p.supabaseId || p.id || p.producto_id)); }
  function almacenId(a){ return txt(a && (a.supabaseId || a.id || a.almacen_id)); }
  function isPiezaProducto(p){
    if(!p) return false;
    const raw = upper(p.tipo_producto || p.tipoProducto || p.tipoProductoLoteka || '');
    const t = norm([p.categoria, p.nombre, p.codigo, p.descripcion, p.modelo, p.marca].filter(Boolean).join(' '));
    const byText = /pieza|piezas|parte|partes|repuesto|consumible|suministro|rodillo|quemadora|cuchilla|carcaza|engranaje|fuente|board|motor|cabezal|correa|sensor|cable|adaptador|bateria|batería/.test(t);
    if(raw === 'PIEZA') return true;
    // Prioridad a la categoría/nombre: hay productos viejos guardados como EQUIPO pero realmente son piezas.
    if(byText) return true;
    return false;
  }
  function requiereSerialReal(p){
    if(!p) return false;
    if(isPiezaProducto(p)) return false;
    if(typeof p.requiere_serial === 'boolean') return p.requiere_serial;
    if(typeof p.requiereSerial === 'boolean') return p.requiereSerial;
    return true;
  }
  window.lotekaEsPiezaProductoV147 = isPiezaProducto;
  window.lotekaRequiereSerialRealV147 = requiereSerialReal;

  function normalizeProduct(p){
    if(!p) return null;
    let meta = {};
    try{ if(typeof p.descripcion === 'string' && p.descripcion.trim().startsWith('{')) meta = JSON.parse(p.descripcion); }catch(e){}
    return {
      id: p.id || p.supabaseId,
      supabaseId: p.supabaseId || p.id,
      codigo: p.codigo || '',
      nombre: p.nombre || p.producto || p.codigo || 'Producto',
      categoria: p.categoria || meta.categoria || '',
      marca: p.marca || meta.marca || '',
      modelo: p.modelo || meta.modelo || '',
      tipo_producto: p.tipo_producto || meta.tipo_producto || p.tipoProducto || '',
      requiere_serial: (typeof p.requiere_serial === 'boolean') ? p.requiere_serial : p.requiereSerial,
      activo: p.activo !== false
    };
  }
  function normalizeAlmacen(a){
    if(!a) return null;
    return { id:a.id || a.supabaseId, supabaseId:a.supabaseId || a.id, codigo:a.codigo || '', nombre:a.nombre || a.codigo || 'Almacén', tipo:a.tipo || '', activo:a.activo !== false };
  }
  async function loadProductosAlmacenes(){
    const client = sb();
    if(!client) return;
    try{
      const [pr, al] = await Promise.all([
        client.from('productos').select('*').eq('activo', true).order('nombre', {ascending:true}),
        client.from('almacenes').select('*').eq('activo', true).order('nombre', {ascending:true})
      ]);
      if(!pr.error && pr.data){ setLocal('productos', pr.data.map(normalizeProduct).filter(Boolean)); }
      if(!al.error && al.data){ setLocal('almacenes', al.data.map(normalizeAlmacen).filter(Boolean)); }
    }catch(e){ console.warn('[v147] No se pudo recargar productos/almacenes:', e); }
  }
  function productos(){ return getLocal('productos').map(normalizeProduct).filter(Boolean); }
  function almacenes(){ return getLocal('almacenes').map(normalizeAlmacen).filter(Boolean); }
  function findProduct(value){
    const v = txt(value);
    const n = norm(v);
    return productos().find(p => txt(p.supabaseId) === v || txt(p.id) === v || norm(p.codigo) === n || norm(p.nombre) === n || n.includes(norm(p.codigo)) || n.includes(norm(p.nombre))) || null;
  }
  function findAlmacen(value){
    const v = txt(value);
    const n = norm(v);
    return almacenes().find(a => txt(a.supabaseId) === v || txt(a.id) === v || norm(a.codigo) === n || norm(a.nombre) === n || n.includes(norm(a.codigo)) || n.includes(norm(a.nombre))) || null;
  }
  function selectedText(id){ const el = document.getElementById(id); if(!el) return ''; return el.tagName === 'SELECT' ? txt(el.options[el.selectedIndex] && el.options[el.selectedIndex].textContent) : txt(el.value || el.textContent); }
  function selectedValue(id){ const el = document.getElementById(id); return el ? txt(el.value) : ''; }
  function tempSeriales(){
    let vals = [];
    vals = vals.concat(arr(window.serialesTemporalesEntrada));
    try{ vals = vals.concat(arr(serialesTemporalesEntrada)); }catch(e){}
    document.querySelectorAll('#serialesEntradaBody tr').forEach(tr => {
      const td = tr.querySelectorAll('td')[1];
      if(td) vals.push(td.textContent);
    });
    return Array.from(new Set(vals.map(upper).filter(Boolean)));
  }
  function clearTemp(){
    window.serialesTemporalesEntrada = [];
    try{ serialesTemporalesEntrada = []; }catch(e){}
    const input = document.getElementById('entradaSerialInput'); if(input) input.value = '';
    try{ if(typeof window.renderSerialesEntrada === 'function') window.renderSerialesEntrada(); }catch(e){}
  }
  function getEntryItems(){ return arr(window.__lotekaV147EntradaItems); }
  function setEntryItems(list){
    window.__lotekaV147EntradaItems = arr(list);
    window.entradaActualItems = window.__lotekaV147EntradaItems;
    window.itemsEntradaActual = window.__lotekaV147EntradaItems;
    try{ entradaActualItems = window.__lotekaV147EntradaItems; }catch(e){}
    try{ itemsEntradaActual = window.__lotekaV147EntradaItems; }catch(e){}
  }
  function renderEntryItems(){
    const body = document.getElementById('entradaItemsBody');
    const table = document.getElementById('entradaItemsTabla');
    const empty = document.getElementById('entradaItemsVacio');
    if(!body) return;
    const list = getEntryItems();
    body.innerHTML = list.map((it, i) => `<tr>
      <td>${esc(it.producto || it.nombre)}</td>
      <td><strong>${esc(it.cantidad)}</strong></td>
      <td>${it.serializado === 'si' ? 'Sí' : 'No'}</td>
      <td>${it.serializado === 'si' ? esc(arr(it.seriales).join(', ')) : '-'}</td>
      <td><button class="entry-remove-btn" type="button" onclick="lotekaV147EliminarProductoEntrada(${i})"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('');
    if(table) table.style.display = list.length ? 'table' : 'none';
    if(empty) empty.style.display = list.length ? 'none' : 'block';
  }
  window.lotekaV147EliminarProductoEntrada = function(i){ const list = getEntryItems(); list.splice(i, 1); setEntryItems(list); renderEntryItems(); };
  function refreshSerialField(){
    const pid = selectedValue('entradaProducto');
    const prod = findProduct(pid) || findProduct(selectedText('entradaProducto'));
    const serialSel = document.getElementById('entradaSerializado');
    const serialBox = document.getElementById('entradaSerialBox') || document.querySelector('.entry-serial-box');
    if(serialSel && prod){
      serialSel.value = requiereSerialReal(prod) ? 'si' : 'no';
      serialSel.disabled = false;
    }
    if(serialBox && prod){ serialBox.style.display = requiereSerialReal(prod) ? '' : 'none'; }
    try{ if(typeof window.actualizarCampoSerialesEntrada === 'function') window.actualizarCampoSerialesEntrada(); }catch(e){}
  }
  window.lotekaEntradaProductoSeleccionadoV93 = refreshSerialField;
  window.lotekaEntradaProductoSeleccionadoV147 = refreshSerialField;

  function fillEntrySelects(){
    const selP = document.getElementById('entradaProducto');
    const selA = document.getElementById('entradaAlmacen');
    if(selA){
      const current = txt(selA.value || selectedText('entradaAlmacen'));
      const list = almacenes().filter(a => a.activo !== false && uuid(a.supabaseId));
      selA.innerHTML = '<option value="">Selecciona</option>' + list.map(a => `<option value="${esc(a.supabaseId)}">${esc((a.codigo ? a.codigo + ' · ' : '') + a.nombre)}</option>`).join('');
      const keep = list.find(a => txt(a.supabaseId) === current || norm(a.codigo) === norm(current) || norm(a.nombre) === norm(current));
      if(keep) selA.value = keep.supabaseId;
    }
    if(selP){
      const current = txt(selP.value || selectedText('entradaProducto'));
      const list = productos().filter(p => p.activo !== false && uuid(p.supabaseId));
      selP.setAttribute('onchange', 'lotekaEntradaProductoSeleccionadoV147()');
      selP.innerHTML = '<option value="">Selecciona un producto creado</option>' + list.map(p => {
        const tipo = isPiezaProducto(p) ? 'Pieza · No serializado' : (requiereSerialReal(p) ? 'Equipo · Serializado' : 'Equipo · No serializado');
        return `<option value="${esc(p.supabaseId)}">${esc((p.codigo ? p.codigo + ' · ' : '') + p.nombre + (p.categoria ? ' · ' + p.categoria : '') + ' · ' + tipo)}</option>`;
      }).join('');
      const keep = list.find(p => txt(p.supabaseId) === current || norm(p.codigo) === norm(current) || norm(p.nombre) === norm(current));
      if(keep) selP.value = keep.supabaseId;
    }
  }

  window.abrirEntrada = async function(){
    await loadProductosAlmacenes();
    fillEntrySelects();
    setEntryItems([]);
    clearTemp();
    ['entradaUnidades','entradaObservacion','entradaSerialInput'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const ss = document.getElementById('entradaSerializado'); if(ss) ss.value = 'no';
    const fecha = document.getElementById('entradaFechaRecepcion'); if(fecha && !fecha.value) fecha.value = new Date().toISOString().slice(0,16);
    const ref = document.getElementById('entradaReferencia'); if(ref && !ref.value) ref.value = 'EN-' + Date.now();
    const usuario = document.getElementById('entradaUsuario'); if(usuario) usuario.value = currentUserName();
    const sup = document.getElementById('entradaSuplidor'); if(sup && !sup.value) sup.value = 'Suplidor General';
    renderEntryItems();
    try{ if(typeof window.actualizarCampoSerialesEntrada === 'function') window.actualizarCampoSerialesEntrada(); }catch(e){}
    try{ if(typeof window.renderSerialesEntrada === 'function') window.renderSerialesEntrada(); }catch(e){}
    const modal = document.getElementById('modalEntrada'); if(modal) modal.style.display = 'flex';
  };

  window.agregarProductoEntrada = async function(){
    await loadProductosAlmacenes();
    const pid = selectedValue('entradaProducto');
    const prod = findProduct(pid) || findProduct(selectedText('entradaProducto'));
    const qty = Number(selectedValue('entradaUnidades') || 0);
    if(!prod || !uuid(prod.supabaseId)) return alert('Selecciona un producto real creado en Productos.');
    if(qty <= 0) return alert('Ingresa una cantidad válida.');
    // LOTEKA v148: la validación respeta la selección visible del usuario.
    // Si el campo ¿Producto serializado? está en NO, no se exigen seriales.
    let serializado = norm(selectedValue('entradaSerializado')) === 'si' ? 'si' : 'no';
    let seriales = [];
    if(serializado === 'si'){
      seriales = tempSeriales();
      if(seriales.length !== qty) return alert('La cantidad de seriales debe ser igual a la cantidad indicada.');
    }
    const list = getEntryItems().slice();
    list.push({ producto:prod.nombre, productoId:prod.supabaseId, codigo:prod.codigo, categoria:prod.categoria, cantidad:qty, serializado, seriales });
    setEntryItems(list);
    ['entradaProducto','entradaUnidades'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const ss = document.getElementById('entradaSerializado'); if(ss) ss.value = 'no';
    clearTemp();
    renderEntryItems();
  };

  window.guardarEntrada = async function(){
    const client = sb();
    if(!client) return alert('No hay conexión con Supabase.');
    await loadProductosAlmacenes();
    const almacen = findAlmacen(selectedValue('entradaAlmacen')) || findAlmacen(selectedText('entradaAlmacen'));
    const items = getEntryItems();
    if(!almacen || !uuid(almacen.supabaseId)) return alert('Selecciona un almacén válido.');
    if(!items.length) return alert('Agrega por lo menos un producto a la entrada.');
    if(!confirm('¿Guardar esta entrada de inventario?')) return;
    const uid = currentUserId();
    const usuario = currentUserName();
    const suplidor = txt(selectedText('entradaSuplidor') || selectedValue('entradaSuplidor') || 'Suplidor General');
    const obs = txt(document.getElementById('entradaObservacion') && document.getElementById('entradaObservacion').value);
    const fechaVal = txt(document.getElementById('entradaFechaRecepcion') && document.getElementById('entradaFechaRecepcion').value);
    const creadoEn = fechaVal ? new Date(fechaVal).toISOString() : nowISO();
    const ref = txt(document.getElementById('entradaReferencia') && document.getElementById('entradaReferencia').value) || ('EN-' + Date.now());
    const btn = document.querySelector('#modalEntrada button[onclick*="guardarEntrada"]');
    const old = btn ? btn.innerHTML : '';
    if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; }
    try{
      for(const item of items){
        const prod = findProduct(item.productId) || findProduct(item.producto) || findProduct(item.codigo);
        if(!prod || !uuid(prod.supabaseId)) throw new Error('Producto inválido: ' + (item.producto || item.codigo || 'sin nombre'));
        // LOTEKA v148: se guarda según cómo fue agregado el item a la entrada.
        // Un item agregado como No serializado no debe pedir ni crear seriales.
        const needsSerial = String(item.serializado || '').toLowerCase() === 'si';
        if(needsSerial){
          const seriales = arr(item.seriales).map(upper).filter(Boolean);
          if(!seriales.length) throw new Error('El producto ' + prod.nombre + ' requiere serial.');
          for(const serial of seriales){
            const payloadSerial = {
              serial, producto_id: prod.supabaseId,
              estado: upper(almacen.codigo) === 'ALM-TALLER' ? 'Listo' : 'Disponible',
              condicion:'Bueno', ubicacion_tipo:'ALMACEN', almacen_id:almacen.supabaseId, agencia_id:null, grupo_id:null,
              responsable:null, observaciones: obs || ('Entrada ' + ref), activo:true
            };
            if(uid) payloadSerial.actualizado_por = uid;
            const up = await client.from('equipos_seriales').upsert(payloadSerial, {onConflict:'serial'}).select('id,serial').single();
            if(up.error) throw new Error('No se pudo guardar serial ' + serial + ': ' + (up.error.message || JSON.stringify(up.error)));
            const mv = { tipo_movimiento:'Entrada', serial_id:up.data.id, producto_id:prod.supabaseId, origen_tipo:'SUPLIDOR', origen_id:null, origen_nombre:suplidor, destino_tipo:'ALMACEN', destino_id:almacen.supabaseId, destino_nombre:almacen.nombre, cantidad:1, motivo:'Entrada de inventario ' + ref, observaciones:obs, usuario_nombre:usuario, creado_en:creadoEn };
            if(uid) mv.creado_por = uid;
            const ins = await client.from('movimientos_inventario').insert(mv).select('id').single();
            if(ins.error) throw new Error('No se pudo registrar movimiento del serial ' + serial + ': ' + (ins.error.message || JSON.stringify(ins.error)));
          }
        }else{
          const qty = Number(item.cantidad || 0) || 0;
          if(qty <= 0) throw new Error('Cantidad inválida para ' + prod.nombre);
          const mv = { tipo_movimiento:'Entrada', serial_id:null, producto_id:prod.supabaseId, origen_tipo:'SUPLIDOR', origen_id:null, origen_nombre:suplidor, destino_tipo:'ALMACEN', destino_id:almacen.supabaseId, destino_nombre:almacen.nombre, cantidad:qty, motivo:'Entrada de inventario ' + ref, observaciones:obs, usuario_nombre:usuario, creado_en:creadoEn };
          if(uid) mv.creado_por = uid;
          const ins = await client.from('movimientos_inventario').insert(mv).select('id').single();
          if(ins.error) throw new Error('No se pudo registrar entrada de ' + prod.nombre + ': ' + (ins.error.message || JSON.stringify(ins.error)));
        }
      }
      setEntryItems([]); renderEntryItems();
      try{ if(typeof window.cerrarEntrada === 'function') window.cerrarEntrada(); else { const m=document.getElementById('modalEntrada'); if(m)m.style.display='none'; } }catch(e){}
      try{ if(typeof window.lotekaReloadInventarioTallerSupabase === 'function') await window.lotekaReloadInventarioTallerSupabase(); }catch(e){}
      try{ if(typeof window.renderAlmacenes === 'function') window.renderAlmacenes(); }catch(e){}
      alert('Entrada guardada correctamente.');
    }catch(e){
      console.error('[Entrada v147] Error:', e);
      alert('No se pudo guardar la entrada: ' + (e.message || e));
    }finally{
      if(btn){ btn.disabled = false; btn.innerHTML = old || 'Guardar entrada'; }
    }
  };
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ loadProductosAlmacenes().then(fillEntrySelects).catch(()=>{}); }, 600); });
  window.addEventListener('load', function(){ setTimeout(function(){ loadProductosAlmacenes().then(fillEntrySelects).catch(()=>{}); }, 900); });
})();
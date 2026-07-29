
(function(){
  'use strict';
  const BUILD='v180-salidas-codigo-sali-detalle-profesional';
  const state={almacenes:[],productos:[],seriales:[],movs:[],items:[],loaded:false};
  const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
  function txt(v){return String(v??'').trim();}
  function norm(v){return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
  function sb(){return window.lotekaSupabase || window.supabaseClient || null;}
  function nowInput(){const d=new Date(); const z=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;}
  function fmt(dt){try{return new Date(dt).toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return dt||'-';}}
  function todayKey(d=new Date()){return d.toISOString().slice(0,10);}  
  function userName(){return txt(window.lotekaUsuarioNombre || window.usuarioMovimientoFijo || document.querySelector('.loteka-topbar-user-name')?.textContent || 'Usuario');}
  function userId(){let v=txt(window.lotekaUsuarioId || window.currentUserId || ''); return uuidRe.test(v)?v:null;}
  function pName(p){return txt(p?.nombre || p?.codigo || 'Producto');}
  function aName(a){return txt(a?.nombre || a?.codigo || 'Almacén');}
  function byId(arr,id){return (arr||[]).find(x=>String(x.id)===String(id));}
  function isPieza(p){const blob=norm([p?.tipo_producto,p?.tipoProducto,p?.categoria,p?.nombre,p?.codigo,p?.descripcion].join(' ')); return blob.includes('PIEZA')||blob.includes('PARTE')||blob.includes('REPUESTO')||blob.includes('RODILLO')||blob.includes('CUCHILLA')||blob.includes('ENGRANAJE')||blob.includes('QUEMADORA')||blob.includes('CARCAZA')||blob.includes('FUENTE')||blob.includes('BOARD')||blob.includes('MOTOR');}
  function prodSerializado(p){ if(!p) return false; if(isPieza(p)) return false; if(p.requiere_serial===false) return false; if(p.requiere_serial===true) return true; const blob=norm([p.tipo,p.tipo_producto,p.categoria,p.nombre,p.codigo].join(' ')); if(blob.includes('NO SERIAL')) return false; if(blob.includes('SERIAL')) return true; return true; }
  async function load(){
    const c=sb(); if(!c) throw new Error('Supabase no está disponible.');
    const [al,pr,sr,mv]=await Promise.all([
      c.from('almacenes').select('*').eq('activo',true).order('nombre',{ascending:true}),
      c.from('productos').select('*').eq('activo',true).order('nombre',{ascending:true}),
      c.from('equipos_seriales').select('*').eq('activo',true).order('actualizado_en',{ascending:false}),
      c.from('movimientos_inventario').select('*').order('creado_en',{ascending:false}).limit(1500)
    ]);
    if(al.error) throw al.error; if(pr.error) throw pr.error; if(sr.error) throw sr.error; if(mv.error) throw mv.error;
    state.almacenes=al.data||[]; state.productos=pr.data||[]; state.seriales=sr.data||[]; state.movs=mv.data||[]; state.loaded=true;
    fillFilters(); fillModalOptions(); render();
  }
  function stockNoSerial(almacenId, productoId){
    let qty=0;
    (state.movs||[]).forEach(m=>{
      if(m.serial_id) return;
      if(String(m.producto_id)!==String(productoId)) return;
      const q=Number(m.cantidad||0)||0;
      if(norm(m.destino_tipo)==='ALMACEN' && String(m.destino_id)===String(almacenId)) qty+=q;
      if(norm(m.origen_tipo)==='ALMACEN' && String(m.origen_id)===String(almacenId)) qty-=q;
    });
    return Math.max(0,qty);
  }
  function serialesEnAlmacen(almacenId, productoId){
    return (state.seriales||[]).filter(s=>norm(s.ubicacion_tipo)==='ALMACEN' && String(s.almacen_id)===String(almacenId) && (!productoId || String(s.producto_id)===String(productoId)));
  }
  function productoDisponibleEnAlmacen(almacenId,p){
    if(prodSerializado(p)) return serialesEnAlmacen(almacenId,p.id).length;
    return stockNoSerial(almacenId,p.id);
  }
  function fillFilters(){
    const alm=document.getElementById('filtroSalidaAlmacen'); const prod=document.getElementById('filtroSalidaProducto'); const user=document.getElementById('filtroSalidaUsuario');
    if(alm) alm.innerHTML='<option value="">Todos</option>'+state.almacenes.map(a=>`<option value="${esc(a.id)}">${esc(aName(a))}</option>`).join('');
    if(prod) prod.innerHTML='<option value="">Todos</option>'+state.productos.map(p=>`<option value="${esc(p.id)}">${esc(pName(p))}</option>`).join('');
    if(user){const users=[...new Set(salidaRows().map(m=>txt(m.usuario_nombre)).filter(Boolean))]; user.innerHTML='<option value="">Todos</option>'+users.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join('');}
  }
  function fillModalOptions(){
    const alm=document.getElementById('salidaOrigenAlmacen'); const prod=document.getElementById('salidaProducto');
    if(alm) alm.innerHTML='<option value="">Selecciona almacén origen</option>'+state.almacenes.map(a=>`<option value="${esc(a.id)}">${esc(a.codigo||'')} · ${esc(aName(a))}</option>`).join('');
    if(prod) prod.innerHTML='<option value="">Selecciona producto</option>'+state.productos.map(p=>`<option value="${esc(p.id)}">${esc(p.codigo||'')} · ${esc(pName(p))}${prodSerializado(p)?' · Serializado':' · No serializado'}</option>`).join('');
    updateSerialSelect();
  }
  function esMovimientoSalida(m){
    const tm=norm(m && m.tipo_movimiento);
    const blob=norm([m&&m.motivo,m&&m.destino_tipo,m&&m.destino_nombre,m&&m.observaciones].join(' '));
    if(blob.includes('TRANSFERENCIA TALLER') || blob.includes('RECEPCION TALLER') || blob.includes('ALM-TALLER HACIA') || blob.includes('ALMACEN TALLER HACIA')) return false;
    return tm==='SALIDA' || (tm==='DESPACHO' && (blob.includes('SALIDA POR CONSUMO INTERNO') || blob.includes('CONSUMO_INTERNO') || blob.includes('CONSUMO INTERNO') || blob.includes('FUERA_DEL_SISTEMA') || blob.includes('FUERA DEL SISTEMA') || blob.includes('BAJA / SALIDA') || blob.includes('BAJA')));
  }
  function salidaCodigoMap(){
    const map={};
    const rows=(state.movs||[])
      .filter(esMovimientoSalida)
      .slice()
      .sort((a,b)=>String(a.creado_en||'').localeCompare(String(b.creado_en||'')) || String(a.id||'').localeCompare(String(b.id||'')));
    const counters={};
    rows.forEach(m=>{
      const y=(String(m.creado_en||'').slice(0,4) || String(new Date().getFullYear()));
      counters[y]=(counters[y]||0)+1;
      if(m.id) map[String(m.id)]=`SALI-${y}-${counters[y]}`;
    });
    return map;
  }
  function salidaCodigo(m){
    if(!m) return 'SALI';
    if(m.referencia_codigo && /^SALI-/i.test(String(m.referencia_codigo))) return String(m.referencia_codigo).toUpperCase();
    const map=salidaCodigoMap();
    if(m.id && map[String(m.id)]) return map[String(m.id)];
    const y=(String(m.creado_en||'').slice(0,4) || String(new Date().getFullYear()));
    return `SALI-${y}`;
  }
  function salidaDetalleObservacion(m,p,s){
    const raw=txt(m?.observaciones||'');
    const c=raw.match(/Comentario:\s*(.*)\.?$/i);
    const comentario=c ? txt(c[1].replace(/\.$/,'')) : raw;
    if(comentario && !/^\[/.test(comentario)) return comentario;
    return `${cleanMotivo(m)} de ${pName(p)}${s?' · Serial '+s:''}.`;
  }
  function salidaRows(){return (state.movs||[]).filter(esMovimientoSalida);}
  function filteredRows(){
    let rows=salidaRows();
    const a=txt(document.getElementById('filtroSalidaAlmacen')?.value); const p=txt(document.getElementById('filtroSalidaProducto')?.value); const t=txt(document.getElementById('filtroSalidaTipo')?.value); const u=txt(document.getElementById('filtroSalidaUsuario')?.value); const d1=txt(document.getElementById('filtroSalidaDesde')?.value); const d2=txt(document.getElementById('filtroSalidaHasta')?.value); const q=norm(document.getElementById('buscarSalida')?.value);
    if(a) rows=rows.filter(m=>String(m.origen_id)===String(a)||String(m.destino_id)===String(a));
    if(p) rows=rows.filter(m=>String(m.producto_id)===String(p));
    if(t) rows=rows.filter(m=>norm(m.motivo||m.observaciones).includes(norm(t))||norm(m.destino_nombre).includes(norm(t)));
    if(u) rows=rows.filter(m=>txt(m.usuario_nombre)===u);
    if(d1) rows=rows.filter(m=>String(m.creado_en||'').slice(0,10)>=d1);
    if(d2) rows=rows.filter(m=>String(m.creado_en||'').slice(0,10)<=d2);
    if(q) rows=rows.filter(m=>norm([m.motivo,m.observaciones,m.origen_nombre,m.destino_nombre,m.usuario_nombre,m.referencia_codigo,m.id].join(' ')).includes(q) || (m.serial_id && norm(serialNombre(m.serial_id)).includes(q)) || (m.producto_id && norm(pName(byId(state.productos,m.producto_id))).includes(q)) );
    return rows;
  }
  function serialNombre(id){const s=byId(state.seriales,id); return s?txt(s.serial):'';}
  function render(){
    const body=document.getElementById('salidaTableBody'); const empty=document.getElementById('salidaEmpty'); if(!body) return;
    const rows=filteredRows(); const all=salidaRows(); const today=todayKey();
    const todayRows=all.filter(m=>String(m.creado_en||'').slice(0,10)===today);
    const units=todayRows.reduce((s,m)=>s+(Number(m.cantidad)||0),0);
    const set=(id,v)=>{const el=document.getElementById(id); if(el) el.textContent=v;};
    set('dashTotalSalidas',all.length); set('dashSalidasHoy',todayRows.length); set('dashUnidadesSalidasHoy',units);
    body.innerHTML='';
    if(!rows.length){ if(empty) empty.style.display='block'; return; } if(empty) empty.style.display='none';
    rows.forEach(m=>{
      const p=byId(state.productos,m.producto_id); const s=m.serial_id?serialNombre(m.serial_id):'';
      body.innerHTML += `<tr>
        <td><span class="salida-chip"><i class="fas fa-arrow-up-right-from-square"></i> ${esc(salidaCodigo(m))}</span><span class="salida-muted">Código de salida</span></td>
        <td>${esc(m.origen_nombre || 'Almacén')}<span class="salida-muted">Origen</span></td>
        <td>${esc(pName(p))}${s?`<span class="salida-muted">Serial: ${esc(s)}</span>`:''}</td>
        <td>${esc(m.cantidad || 1)}</td>
        <td>${esc(cleanMotivo(m))}</td>
        <td>${esc(m.usuario_nombre || 'Usuario')}</td>
        <td>${esc(fmt(m.creado_en))}</td>
        <td><button class="salida-btn soft" onclick="lotekaVerDetalleSalida('${esc(m.id)}')"><i class="fas fa-eye"></i> Consultar</button></td>
      </tr>`;
    });
  }
  function cleanMotivo(m){return txt(m.motivo||m.destino_nombre||'Salida de inventario').replace(/^Salida de inventario\s*-\s*/i,'');}
  function salidaTipoKey(v){const n=norm(v); if(n.includes('CONSUMO')) return 'CONSUMO_INTERNO'; if(n.includes('BAJA')||n.includes('FUERA')||n.includes('DAN')||n.includes('PERD')) return 'BAJA_SISTEMA'; if(n.includes('AJUSTE')) return 'AJUSTE_AUTORIZADO'; if(n.includes('OPERATIVA')) return 'SALIDA_OPERATIVA'; return 'SALIDA_INVENTARIO';}
  function salidaEsConsumoInterno(v){return salidaTipoKey(v)==='CONSUMO_INTERNO';}
  function salidaEsBajaSistema(v){return salidaTipoKey(v)==='BAJA_SISTEMA';}
  async function insertarMovimientoSalida(c,payload){
    // La tabla real movimientos_inventario NO tiene columna 'tipo'.
    // Usa 'tipo_movimiento' + motivo/observaciones para clasificar la salida.
    const cleanPayload=Object.assign({}, payload);
    delete cleanPayload.tipo;
    delete cleanPayload.tipo_salida;
    return await c.from('movimientos_inventario').insert(cleanPayload).select('id').single();
  }
  async function crearNotificacionSalida(c, opts){
    try{
      if(!c || !opts) return null;
      const firstId = opts.movimiento_id || null;
      const cantidad = Number(opts.cantidad || 0) || 0;
      const tipo = txt(opts.tipo || 'Salida de inventario');
      const resumen = txt(opts.resumen || 'productos');
      const almacen = txt(opts.almacen || 'almacén');
      const data = {
        modulo:'INVENTARIO',
        tipo:'SALIDA_INVENTARIO',
        titulo: salidaEsConsumoInterno(tipo) ? 'Salida por consumo interno registrada' : 'Salida de inventario registrada',
        mensaje: `${tipo}: ${cantidad} unidad(es) retirada(s) desde ${almacen}. ${resumen}.`,
        importancia: salidaEsBajaSistema(tipo) ? 'alta' : 'normal',
        referencia_tipo:'movimientos_inventario',
        referencia_id: uuidRe.test(String(firstId||'')) ? firstId : null,
        referencia_codigo: firstId ? ('SALI-' + String(new Date().getFullYear())) : null,
        usuario_id:null,
        usuario_nombre:'Inventario',
        leida:false,
        visto_en_panel:false,
        creado_en:new Date().toISOString()
      };
      const r = await c.from('notificaciones').insert(data).select('*').single();
      if(r.error) throw r.error;
      try{
        if(r.data && typeof window.lotekaMostrarToastNotificacion==='function') window.lotekaMostrarToastNotificacion(r.data, true);
        else if(typeof window.lotekaToast==='function') window.lotekaToast(data.titulo,data.mensaje,'success');
      }catch(_e){}
      return r.data || null;
    }catch(e){
      console.warn('[Salida Inventario] No se pudo crear notificación:', e && e.message ? e.message : e);
      return null;
    }
  }
  function openModal(){ state.items=[]; const f=['salidaOrigenAlmacen','salidaTipo','salidaComentario','salidaProducto','salidaCantidad','salidaSerial']; f.forEach(id=>{const el=document.getElementById(id); if(el) el.value='';}); const fecha=document.getElementById('salidaFecha'); if(fecha) fecha.value=nowInput(); const usuario=document.getElementById('salidaUsuario'); if(usuario) usuario.value=userName(); renderItems(); fillModalOptions(); const m=document.getElementById('modalSalidaInventario'); if(m) m.style.display='flex'; }
  function closeModal(){const m=document.getElementById('modalSalidaInventario'); if(m) m.style.display='none';}
  function serialLabel(serial){return `${txt(serial?.serial)} · ${txt(serial?.estado||'Disponible')}`;}
  function resolveSerialFromInput(almId,pid,value){
    const v=txt(value); if(!v) return null;
    const nv=norm(v);
    const list=serialesEnAlmacen(almId,pid);
    return list.find(s=>String(s.id)===v || norm(s.serial)===nv || norm(serialLabel(s))===nv || norm(`${s.serial} ${s.estado||''}`).includes(nv)) || null;
  }
  function updateSerialSelect(){
    const serialInput=document.getElementById('salidaSerial');
    const serialList=document.getElementById('salidaSerialDatalist');
    const almId=txt(document.getElementById('salidaOrigenAlmacen')?.value);
    const pid=txt(document.getElementById('salidaProducto')?.value);
    const qty=document.getElementById('salidaCantidad');
    if(!serialInput) return;
    serialInput.value='';
    serialInput.disabled=true;
    serialInput.placeholder='No aplica';
    if(serialList) serialList.innerHTML='';
    const p=byId(state.productos,pid);
    if(!p||!almId){return;}
    if(prodSerializado(p)){
      const list=serialesEnAlmacen(almId,pid);
      serialInput.disabled=false;
      serialInput.placeholder=list.length ? 'Escribe o selecciona serial' : 'No hay seriales disponibles';
      if(serialList) serialList.innerHTML=list.map(s=>`<option value="${esc(s.serial)}" label="${esc(s.estado||'Disponible')}"></option>`).join('');
      if(qty) qty.value='1';
      if(qty) qty.disabled=true;
    }else{
      if(qty) qty.disabled=false;
      const st=stockNoSerial(almId,pid);
      serialInput.placeholder=`No serializado · stock ${st}`;
    }
  }
  function addItem(){
    const almId=txt(document.getElementById('salidaOrigenAlmacen')?.value);
    const pid=txt(document.getElementById('salidaProducto')?.value);
    const serialText=txt(document.getElementById('salidaSerial')?.value);
    const cantidad=Number(document.getElementById('salidaCantidad')?.value||0)||0;
    if(!almId) return alert('Selecciona el almacén origen.');
    if(!pid) return alert('Selecciona un producto.');
    if(cantidad<=0) return alert('Ingresa una cantidad válida.');
    const p=byId(state.productos,pid);
    const serializado=prodSerializado(p);
    let serial=null;
    if(serializado){
      serial=resolveSerialFromInput(almId,pid,serialText);
      if(!serial) return alert('Este producto es serializado. Escribe o selecciona un serial real disponible en el almacén origen.');
      if(state.items.some(i=>String(i.serial_id)===String(serial.id))) return alert('Ese serial ya fue agregado a esta salida.');
    }
    if(!serializado){
      const st=stockNoSerial(almId,pid);
      const ya=state.items.filter(i=>!i.serial_id && String(i.producto_id)===String(pid)).reduce((s,i)=>s+Number(i.cantidad||0),0);
      if(ya+cantidad>st) return alert('La cantidad supera el stock disponible en el almacén. Stock disponible: '+st);
    }
    state.items.push({producto_id:pid, producto_nombre:pName(p), cantidad:serializado?1:cantidad, serial_id:serial?serial.id:null, serial:serial?serial.serial:'', serializado});
    const prod=document.getElementById('salidaProducto'); const ser=document.getElementById('salidaSerial'); const qty=document.getElementById('salidaCantidad');
    if(prod) prod.value=''; if(ser) ser.value=''; if(qty){qty.value='1'; qty.disabled=false;} updateSerialSelect(); renderItems();
  }
  function renderItems(){
    const box=document.getElementById('salidaItemsBox'); if(!box) return;
    if(!state.items.length){box.innerHTML='<div class="salida-empty" style="margin:0">Todavía no has agregado productos a esta salida.</div>'; return;}
    box.innerHTML=`<table><thead><tr><th>Producto</th><th>Cantidad</th><th>Serial</th><th>Acción</th></tr></thead><tbody>${state.items.map((i,idx)=>`<tr><td>${esc(i.producto_nombre)}</td><td>${esc(i.cantidad)}</td><td>${i.serial?esc(i.serial):'No aplica'}</td><td><button class="salida-btn soft" onclick="lotekaEliminarItemSalida(${idx})"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody></table>`;
  }
  function removeItem(i){state.items.splice(i,1); renderItems();}
  async function save(){
    const c=sb(); if(!c) return alert('Supabase no está disponible.');
    const almId=txt(document.getElementById('salidaOrigenAlmacen')?.value);
    const tipo=txt(document.getElementById('salidaTipo')?.value);
    const comentario=txt(document.getElementById('salidaComentario')?.value);
    const fecha=txt(document.getElementById('salidaFecha')?.value);
    if(!almId) return alert('Selecciona el almacén origen.');
    if(!tipo) return alert('Selecciona el tipo de salida.');
    if(!fecha) return alert('Selecciona fecha y hora.');
    if(!state.items.length) return alert('Agrega por lo menos un producto a la salida.');
    if(salidaEsConsumoInterno(tipo) && state.items.some(i=>i.serializado||i.serial_id)){
      return alert('Consumo interno solo aplica para consumibles/piezas sin serial. Para equipos serializados usa Baja / salida del sistema u otro tipo autorizado.');
    }
    if(salidaEsBajaSistema(tipo) && state.items.some(i=>!i.serializado&&!i.serial_id)){
      return alert('Baja / salida del sistema aplica principalmente a equipos serializados. Para consumibles usa Consumo interno.');
    }
    const msgConfirm = salidaEsConsumoInterno(tipo)
      ? 'Esta salida descontará consumibles del almacén como Salida por consumo interno. ¿Deseas continuar?'
      : 'Esta salida retirará definitivamente los productos seleccionados según el tipo elegido. ¿Deseas continuar?';
    const confirmar=confirm(msgConfirm);
    if(!confirmar) return;
    const alm=byId(state.almacenes,almId); const usuario=userName(); const uid=userId();
    try{
      const salidaMovimientoIds=[];
      const salidaResumenProductos=[];
      let salidaUnidades=0;
      for(const item of state.items){
        salidaUnidades += Number(item.cantidad || 0) || 0;
        salidaResumenProductos.push(item.producto_nombre + (item.serial ? ' · ' + item.serial : ' x' + item.cantidad));
        const payload={
          tipo_movimiento:'Despacho',
          serial_id:item.serial_id||null,
          producto_id:item.producto_id,
          origen_tipo:'ALMACEN',
          origen_id:String(almId),
          origen_nombre:aName(alm),
          destino_tipo:salidaEsConsumoInterno(tipo)?'CONSUMO_INTERNO':'FUERA_DEL_SISTEMA',
          destino_id:null,
          destino_nombre:salidaEsConsumoInterno(tipo)?'Salida por consumo interno':`Salida definitiva - ${tipo}`,
          cantidad:item.cantidad,
          motivo:(salidaEsConsumoInterno(tipo)?'Salida por consumo interno':'Salida de inventario - '+tipo),
          observaciones:`${comentario||'Sin observación'}${comentario?' · ':''}${item.producto_nombre}${item.serial?` · Serial: ${item.serial}`:''} · ${tipo} · Registrado por ${usuario}.`,
          usuario_nombre:usuario,
          creado_en:new Date(fecha).toISOString()
        };
        if(uid) payload.creado_por=uid;
        const ins=await insertarMovimientoSalida(c,payload);
        if(ins.error) throw ins.error;
        if(ins.data && ins.data.id) salidaMovimientoIds.push(ins.data.id);
        if(item.serial_id && salidaEsBajaSistema(tipo)){
          const esDanado=norm(tipo).includes('DAN');
          const up={
            activo:false,
            estado:esDanado?'Dañado':'Baja',
            condicion:esDanado?'Dañado':'Para baja',
            observaciones:`Salida definitiva del sistema: ${tipo}. ${comentario||''}`,
            actualizado_en:new Date().toISOString()
          };
          if(uid) up.actualizado_por=uid;
          const ur=await c.from('equipos_seriales').update(up).eq('id',item.serial_id);
          if(ur.error) throw ur.error;
        }
      }
      await crearNotificacionSalida(c,{tipo:tipo, movimiento_id:salidaMovimientoIds[0]||null, cantidad:salidaUnidades, almacen:aName(alm), resumen:salidaResumenProductos.slice(0,4).join(', ')+(salidaResumenProductos.length>4?'...':'')});
      alert(salidaEsConsumoInterno(tipo)?'Salida por consumo interno guardada correctamente.':'Salida de inventario guardada correctamente.');
      closeModal(); await load();
      if(typeof window.cargarTodoInventarioReal==='function') try{await window.cargarTodoInventarioReal();}catch(e){}
    }catch(e){ console.error('[Salida Inventario] Error:',e); alert('No se pudo guardar la salida: '+(e.message||JSON.stringify(e))); }
  }

  function detail(id){
    const m=state.movs.find(x=>String(x.id)===String(id)); if(!m) return alert('No se encontró el detalle de esta salida.');
    const p=byId(state.productos,m.producto_id); const s=m.serial_id?serialNombre(m.serial_id):'';
    const codigo=salidaCodigo(m);
    const tipo=cleanMotivo(m);
    const observacion=salidaDetalleObservacion(m,p,s);
    const html=`<div class="modal salida-modal" id="modalDetalleSalidaTmp" style="display:flex"><div class="modal-content salida-detail-pro"><div style="display:flex;justify-content:flex-end;margin-bottom:8px"><span class="close" onclick="document.getElementById('modalDetalleSalidaTmp').remove()">&times;</span></div><div class="salida-detail-hero"><div><h3>Detalle de salida de inventario</h3><div class="salida-detail-code"><i class="fas fa-hashtag"></i> ${esc(codigo)}</div></div><div class="salida-detail-status"><i class="fas fa-arrow-up-right-from-square"></i> ${esc(tipo)}</div></div><div class="salida-detail-summary"><div class="salida-detail-mainbox"><span>Producto retirado</span><strong>${esc(pName(p))}</strong><small>${s?`Serial: ${esc(s)}`:'Producto sin serial / cantidad'}</small></div><div class="salida-detail-mainbox"><span>Cantidad</span><strong>${esc(m.cantidad||1)}</strong><small>${esc(fmt(m.creado_en))}</small></div><div class="salida-detail-mainbox"><span>Origen</span><strong>${esc(m.origen_nombre||'Almacén')}</strong><small>${esc(m.origen_tipo||'ALMACEN')}</small></div><div class="salida-detail-mainbox"><span>Destino / uso</span><strong>${esc(m.destino_nombre||'Salida de inventario')}</strong><small>${esc(m.destino_tipo||'Destino no especificado')}</small></div><div class="salida-detail-mainbox"><span>Usuario responsable</span><strong>${esc(m.usuario_nombre||'Usuario')}</strong><small>Registrado en el sistema</small></div><div class="salida-detail-mainbox"><span>Referencia técnica</span><strong>${esc(codigo)}</strong><small>ID interno: ${esc((m.id||'').slice(0,8).toUpperCase())}</small></div><div class="salida-detail-note"><span>Observación</span>${esc(observacion||'Sin observación')}</div></div><div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="salida-btn primary" onclick="document.getElementById('modalDetalleSalidaTmp').remove()">Cerrar</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
  }
  function buildView(){return `<section id="vista-salida" class="content hidden"><div class="salida-shell"><div class="salida-head"><div><h2>Salidas de Inventario</h2><p>Registra salidas reales desde almacenes: consumo interno, bajas y ajustes. Cada salida genera movimiento en Supabase y queda lista para Taller V2.</p></div><button class="salida-btn primary" onclick="lotekaAbrirSalidaInventario()"><i class="fas fa-arrow-up-right-from-square"></i> Crear Salida de Inventario</button></div><div class="salida-kpis"><div class="salida-kpi"><span>Total de salidas</span><strong id="dashTotalSalidas">0</strong></div><div class="salida-kpi"><span>Salidas de hoy</span><strong id="dashSalidasHoy">0</strong></div><div class="salida-kpi"><span>Unidades retiradas hoy</span><strong id="dashUnidadesSalidasHoy">0</strong></div></div><div class="salida-card"><div class="salida-card-head"><div><h3>Historial de salidas</h3><p>Consulta salidas registradas desde movimientos_inventario.</p></div><button class="salida-btn soft" onclick="lotekaCargarSalidasInventario()"><i class="fas fa-rotate"></i> Actualizar</button></div><div class="salida-filters"><div class="salida-field"><label>Almacén</label><select id="filtroSalidaAlmacen" onchange="lotekaRenderSalidasInventario()"></select></div><div class="salida-field"><label>Producto</label><select id="filtroSalidaProducto" onchange="lotekaRenderSalidasInventario()"></select></div><div class="salida-field"><label>Tipo</label><select id="filtroSalidaTipo" onchange="lotekaRenderSalidasInventario()"><option value="">Todos</option><option>Consumo interno</option><option>Baja / salida del sistema</option><option>Ajuste autorizado</option><option>Salida operativa</option><option>Otro</option></select></div><div class="salida-field"><label>Usuario</label><select id="filtroSalidaUsuario" onchange="lotekaRenderSalidasInventario()"></select></div><div class="salida-field"><label>Desde</label><input id="filtroSalidaDesde" type="date" onchange="lotekaRenderSalidasInventario()"></div><div class="salida-field"><label>Hasta</label><input id="filtroSalidaHasta" type="date" onchange="lotekaRenderSalidasInventario()"></div><div class="salida-field" style="grid-column:span 2"><label>Buscar</label><input id="buscarSalida" placeholder="Producto, serial, comentario, usuario..." oninput="lotekaRenderSalidasInventario()"></div></div><div id="salidaEmpty" class="salida-empty">No hay salidas que coincidan con los filtros seleccionados.</div><div class="salida-table-wrap"><table class="salida-table"><thead><tr><th>Código</th><th>Origen</th><th>Producto</th><th>Cantidad</th><th>Tipo</th><th>Usuario</th><th>Fecha</th><th>Acción</th></tr></thead><tbody id="salidaTableBody"></tbody></table></div></div></div></section>`;}
  function buildModal(){return `<div class="modal salida-modal" id="modalSalidaInventario"><div class="modal-content"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3>Crear Salida de Inventario</h3><span class="close" onclick="lotekaCerrarSalidaInventario()">&times;</span></div><div class="salida-warning"><i class="fas fa-triangle-exclamation"></i><div><b>Salida controlada de inventario.</b><br>Usa <b>Consumo interno</b> solo para consumibles sin serial. Usa <b>Baja / salida del sistema</b> para equipos serializados dañados, no reparables o que saldrán definitivamente del inventario activo.</div></div><div class="salida-modal-grid"><div class="salida-field"><label>Almacén origen</label><select id="salidaOrigenAlmacen" onchange="lotekaSalidaUpdateSerialSelect()"></select></div><div class="salida-field"><label>Tipo de salida</label><select id="salidaTipo"><option value="">Selecciona tipo</option><option>Consumo interno</option><option>Baja / salida del sistema</option><option>Ajuste autorizado</option><option>Salida operativa</option><option>Otro</option></select></div><div class="salida-field"><label>Fecha y hora</label><input id="salidaFecha" type="datetime-local"></div><div class="salida-field"><label>Usuario</label><input id="salidaUsuario" readonly></div><div class="salida-field full"><label>Comentario / justificación</label><textarea id="salidaComentario" rows="3" placeholder="Motivo, autorización, condición, detalle de salida..."></textarea></div></div><div class="salida-add-box"><h4 style="margin:0 0 10px;color:#0b3554">Agregar producto a la salida</h4><div class="salida-add-grid"><div class="salida-field"><label>Producto</label><select id="salidaProducto" onchange="lotekaSalidaUpdateSerialSelect()"></select></div><div class="salida-field"><label>Cantidad</label><input id="salidaCantidad" type="number" min="1" value="1"></div><div class="salida-field"><label>Serial</label><input id="salidaSerial" list="salidaSerialDatalist" placeholder="Escribe o selecciona serial" autocomplete="off"><datalist id="salidaSerialDatalist"></datalist></div><button class="salida-btn dark" type="button" onclick="lotekaAgregarItemSalida()"><i class="fas fa-plus"></i> Agregar</button></div><div id="salidaItemsBox" class="salida-items"></div></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button class="salida-btn gray" onclick="lotekaCerrarSalidaInventario()">Cancelar</button><button class="salida-btn primary" onclick="lotekaGuardarSalidaInventario()">Guardar salida</button></div></div></div>`;}
  function inject(){
    if(!document.getElementById('vista-salida')){
      const ref=document.getElementById('vista-transferencia')||document.querySelector('.content');
      if(ref) ref.insertAdjacentHTML('afterend',buildView());
    }
    if(!document.getElementById('modalSalidaInventario')) document.body.insertAdjacentHTML('beforeend',buildModal());
    const invGroup=[...document.querySelectorAll('.sidebar-group')].find(g=>/INVENTARIO/i.test(g.textContent||''));
    if(invGroup && !document.getElementById('navSalidaInventario')){
      const link=`<a id="navSalidaInventario" class="sidebar-link" onclick="cambiarVista('salida', this)"><i class="fas fa-arrow-up-right-from-square"></i><span>Salida</span></a>`;
      const t=[...invGroup.querySelectorAll('.sidebar-link')].find(a=>/Transferencias/i.test(a.textContent||''));
      if(t) t.insertAdjacentHTML('afterend',link); else invGroup.insertAdjacentHTML('beforeend',link);
    }
    patchNavigation();
  }
  function patchNavigation(){
    if(window.cambiarVista && !window.cambiarVista.__salidaV176){
      const old=window.cambiarVista;
      window.cambiarVista=function(vista,el){
        const salida=document.getElementById('vista-salida');
        if(salida) salida.classList.add('hidden');
        const r=old.apply(this,arguments);
        if(vista==='salida'){
          document.querySelectorAll('.content, .view').forEach(n=>{ if(n.id && n.id!=='vista-salida' && /^vista-/.test(n.id)) n.classList.add('hidden'); });
          const s=document.getElementById('vista-salida'); if(s) s.classList.remove('hidden');
          if(typeof window.activateSidebarLink==='function') try{window.activateSidebarLink(el,vista);}catch(e){}
          load().catch(e=>{console.error('[Salida Inventario] No cargó:',e); const empty=document.getElementById('salidaEmpty'); if(empty){empty.style.display='block'; empty.textContent='No se pudieron cargar las salidas: '+(e.message||e);} });
        }
        return r;
      };
      window.cambiarVista.__salidaV176=true;
    }
  }
  window.lotekaCargarSalidasInventario=load;
  window.lotekaRenderSalidasInventario=render;
  window.lotekaAbrirSalidaInventario=openModal;
  window.lotekaCerrarSalidaInventario=closeModal;
  window.lotekaSalidaUpdateSerialSelect=updateSerialSelect;
  window.lotekaAgregarItemSalida=addItem;
  window.lotekaEliminarItemSalida=removeItem;
  window.lotekaGuardarSalidaInventario=save;
  window.lotekaVerDetalleSalida=detail;
  document.addEventListener('DOMContentLoaded',function(){setTimeout(inject,250);setTimeout(inject,1000);});
  window.addEventListener('load',function(){setTimeout(inject,500);});
})();

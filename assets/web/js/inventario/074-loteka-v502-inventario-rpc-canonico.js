
(function(){
  'use strict';
  if(window.__lotekaInventoryRpcV502) return;
  window.__lotekaInventoryRpcV502 = true;

  const VERSION = 'v502-inventario-rpc';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const state = {
    productos:[], almacenes:[], agencias:[], grupos:[], seriales:[], movimientos:[],
    entradaItems:[], transferenciaItems:[], transferenciaSeriales:[], salidaItems:[],
    productoEditId:null, almacenEditId:null, loadedAt:0, loading:null
  };

  function sb(){ return window.lotekaSupabase || null; }
  function txt(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(); }
  function esc(v){ return txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function uuid(v){ return UUID_RE.test(txt(v)); }
  function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
  function upper(v){ return txt(v).toUpperCase(); }
  function byId(list,id){ return arr(list).find(row=>txt(row && row.id)===txt(id)) || null; }
  function nowInput(){ const d=new Date(),z=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; }
  function toIso(v){ const d=v?new Date(v):new Date(); return Number.isNaN(d.getTime())?new Date().toISOString():d.toISOString(); }
  function currentUserName(){
    return txt(window.lotekaUsuarioNombre || window.usuarioMovimientoFijo || window.lotekaAuthState?.perfil?.nombre_completo || window.lotekaAuthState?.perfil?.nombre || document.querySelector('.loteka-topbar-user-name')?.textContent || 'Usuario');
  }
  function toast(title,message,type){
    try{ if(typeof window.lotekaToast==='function') return window.lotekaToast(title,message,type||'info',5200); }catch(_e){}
    try{ if(typeof window.toast==='function') return window.toast(message,type||'info'); }catch(_e){}
  }
  function friendlyError(error,step){
    const code=txt(error && (error.code || error.status));
    const raw=txt(error && (error.message || error.details || error.hint || error));
    if(code==='PGRST202' || /Could not find the function|schema cache/i.test(raw)) return `Falta instalar la migración INVENTARIO_RPC_V500.sql. Paso: ${step}.`;
    if(code==='42501' || /permission denied|permiso/i.test(raw)) return `No tienes permiso para completar esta operación. ${raw}`;
    if(code==='23505') return `Registro duplicado. ${raw}`;
    if(code==='23514') return `La operación viola una validación de inventario. ${raw}`;
    return `${step}: ${raw || 'Error desconocido.'}`;
  }
  async function rpc(name,args,step){
    const client=sb();
    if(!client) throw new Error('Supabase no está disponible.');
    const result=await client.rpc(name,args||{});
    if(result.error){ result.error.step=step; throw result.error; }
    return result.data;
  }
  async function query(table,build){
    const client=sb(); if(!client) return [];
    let q=client.from(table).select('*');
    if(typeof build==='function') q=build(q);
    const res=await q;
    if(res.error) throw res.error;
    return res.data||[];
  }
  async function load(force){
    if(state.loading) return state.loading;
    if(!force && state.loadedAt && Date.now()-state.loadedAt<12000) return state;
    state.loading=(async()=>{
      const results=await Promise.all([
        query('productos',q=>q.eq('activo',true).order('nombre',{ascending:true}).limit(5000)),
        query('almacenes',q=>q.eq('activo',true).order('nombre',{ascending:true}).limit(1000)),
        query('agencias',q=>q.eq('activo',true).order('numero',{ascending:true}).limit(4000)),
        query('grupos',q=>q.eq('activo',true).order('nombre',{ascending:true}).limit(1500)),
        query('equipos_seriales',q=>q.order('actualizado_en',{ascending:false}).limit(20000)),
        query('movimientos_inventario',q=>q.order('creado_en',{ascending:false}).limit(10000))
      ]);
      [state.productos,state.almacenes,state.agencias,state.grupos,state.seriales,state.movimientos]=results;
      state.loadedAt=Date.now();
      window.lotekaEquiposSerialesSupabase=state.seriales.slice();
      window.lotekaMovimientosInventarioSupabase=state.movimientos.slice();
      return state;
    })().finally(()=>{state.loading=null;});
    return state.loading;
  }
  async function reloadAll(){
    state.loadedAt=0;
    await load(true);
    try{ if(typeof window.lotekaCargarTodoInventarioReal==='function') await window.lotekaCargarTodoInventarioReal(); }catch(e){ console.warn('[Inventario RPC] Recarga legacy omitida:',e); }
    try{ if(typeof window.lotekaDespachosReload==='function') await window.lotekaDespachosReload(); }catch(_e){}
    try{ if(typeof window.lotekaRefrescarTransferenciasReales==='function') await window.lotekaRefrescarTransferenciasReales(); }catch(_e){}
    try{ if(typeof window.lotekaCargarEntradasReales==='function') await window.lotekaCargarEntradasReales(true); }catch(_e){}
    try{ if(typeof window.lotekaCargarSalidasInventario==='function') await window.lotekaCargarSalidasInventario(); }catch(_e){}
    try{ if(typeof window.renderProductos==='function') window.renderProductos(); }catch(_e){}
    try{ if(typeof window.renderAlmacenes==='function') window.renderAlmacenes(); }catch(_e){}
    setTimeout(decorateWarehouseScreen,80);
  }

  function productLabel(p){ return [p?.codigo,p?.nombre,p?.categoria].map(txt).filter(Boolean).join(' · ') || 'Producto'; }
  function warehouseLabel(a){ return [a?.codigo,a?.nombre].map(txt).filter(Boolean).join(' · ') || 'Almacén'; }
  function agencyLabel(a){ return `Agencia ${txt(a?.numero || a?.codigo || a?.nombre || a?.id)}`; }
  function groupLabel(g){ return [g?.codigo,g?.nombre].map(txt).filter(Boolean).join(' · ') || 'Grupo'; }
  function requiresSerial(p){ return !!(p && p.requiere_serial !== false); }
  function validAvailableSerial(s){
    if(!s || s.activo===false || s.despacho_actual_id) return false;
    return !['BAJA','DAÑADO','DANADO'].includes(norm(s.estado));
  }
  function entitySerials(type,id,pid){
    const t=norm(type);
    return state.seriales.filter(s=>{
      if(!validAvailableSerial(s) || txt(s.producto_id)!==txt(pid) || norm(s.ubicacion_tipo)!==t) return false;
      if(t==='ALMACEN') return txt(s.almacen_id)===txt(id);
      if(t==='AGENCIA') return txt(s.agencia_id)===txt(id);
      if(t==='GRUPO') return txt(s.grupo_id)===txt(id);
      return false;
    });
  }
  function nonSerialStock(type,id,pid){
    const t=norm(type); let stock=0;
    state.movimientos.forEach(m=>{
      if(m.serial_id || txt(m.producto_id)!==txt(pid)) return;
      if(norm(m.destino_tipo)===t && txt(m.destino_id)===txt(id)) stock+=num(m.cantidad);
      if(norm(m.origen_tipo)===t && txt(m.origen_id)===txt(id)) stock-=num(m.cantidad);
    });
    return Math.max(0,stock);
  }
  function stockFor(type,id,p){ return requiresSerial(p)?entitySerials(type,id,p.id).length:nonSerialStock(type,id,p.id); }

  // ----------------------------------------------------------------------
  // PRODUCTOS
  // ----------------------------------------------------------------------
  function slugCode(value,prefix){
    let s=norm(value).replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,34);
    if(!s) s=String(Date.now()).slice(-8);
    return `${prefix||'PRD'}-${s}`;
  }
  async function saveProduct(){
    const name=txt(document.getElementById('nombre')?.value);
    if(!name) return alert('Escribe el nombre del producto.');
    await load(true);
    let existing=null;
    try{ if(typeof editIndex!=='undefined' && editIndex!==null) existing=(window.productos||[])[editIndex]||null; }catch(_e){}
    const id=txt(existing?.supabaseId || existing?.id || state.productoEditId) || null;
    const category=txt(document.getElementById('categoria')?.value) || 'Equipos';
    const type=txt(document.getElementById('tipoProducto')?.value) || (category==='Insumos / Materiales'?'PIEZA':'EQUIPO');
    const meta={__loteka_meta:true,marca:txt(document.getElementById('marca')?.value),modelo:txt(document.getElementById('modelo')?.value),precio:txt(document.getElementById('precio')?.value),imagen:typeof imagen!=='undefined'?imagen:'',categoria:category,tipo_producto:type};
    const button=document.querySelector('#modalProducto button[onclick*="guardarProducto"],#modalProducto button[data-inv-product-save]');
    const old=button?.innerHTML;
    try{
      if(button){button.disabled=true;button.innerHTML='<i class="fas fa-spinner fa-spin"></i> Guardando...';}
      await rpc('rpc_inventario_guardar_producto',{
        p_producto_id:id||null,
        p_codigo:txt(existing?.codigo)||slugCode(name,'PRD'),
        p_nombre:name,p_categoria:category,p_descripcion:JSON.stringify(meta),
        p_requiere_serial:type!=='PIEZA',p_tipo_producto:type,p_activo:true
      },'GUARDAR_PRODUCTO');
      await reloadAll();
      try{ if(typeof window.cerrarProducto==='function') window.cerrarProducto(); }catch(_e){}
      toast('Producto guardado',`${name} quedó registrado en Supabase.`,'success');
    }catch(error){ const msg=friendlyError(error,'GUARDAR_PRODUCTO'); console.error('[Inventario RPC Producto]',error); alert(msg); }
    finally{ if(button){button.disabled=false;button.innerHTML=old||'Guardar';} }
  }

  // ----------------------------------------------------------------------
  // ALMACENES
  // ----------------------------------------------------------------------
  function openWarehouse(){
    state.almacenEditId=null;
    try{ editAlmacenIndex=null; }catch(_e){}
    document.getElementById('tituloModalAlmacen').textContent='Crear Almacén';
    ['nombreAlmacen','ubicacionAlmacen','descripcionAlmacen'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    const modal=document.getElementById('modalAlmacen'); if(modal) modal.style.display='flex';
  }
  function editWarehouse(index){
    const a=(window.almacenes||[])[Number(index)] || state.almacenes[Number(index)];
    if(!a) return alert('No se encontró el almacén.');
    state.almacenEditId=txt(a.supabaseId||a.id);
    try{ editAlmacenIndex=Number(index); }catch(_e){}
    document.getElementById('nombreAlmacen').value=txt(a.nombre);
    document.getElementById('ubicacionAlmacen').value=txt(a.ubicacion);
    let desc=txt(a.descripcion); try{const m=JSON.parse(desc);if(m.__loteka_almacen_meta)desc=txt(m.descripcion);}catch(_e){}
    document.getElementById('descripcionAlmacen').value=desc;
    document.getElementById('tituloModalAlmacen').textContent='Editar Almacén';
    const modal=document.getElementById('modalAlmacen'); if(modal) modal.style.display='flex';
  }
  async function saveWarehouse(){
    const name=txt(document.getElementById('nombreAlmacen')?.value);
    if(!name) return alert('Escribe el nombre del almacén.');
    await load(true);
    let existing=state.almacenes.find(a=>txt(a.id)===txt(state.almacenEditId))||null;
    const location=txt(document.getElementById('ubicacionAlmacen')?.value);
    const description=txt(document.getElementById('descripcionAlmacen')?.value);
    const type=txt(existing?.tipo)||(/taller/i.test(name)?'Taller':'Principal');
    const metadata=JSON.stringify({__loteka_almacen_meta:true,ubicacion:location,descripcion:description});
    const button=document.querySelector('#modalAlmacen button[onclick*="guardarAlmacen"],#modalAlmacen button[data-inv-warehouse-save]');
    const old=button?.innerHTML;
    try{
      if(button){button.disabled=true;button.innerHTML='<i class="fas fa-spinner fa-spin"></i> Guardando...';}
      await rpc('rpc_inventario_guardar_almacen',{
        p_almacen_id:existing?.id||null,p_codigo:txt(existing?.codigo)||slugCode(name,'ALM'),
        p_nombre:name,p_tipo:type,p_descripcion:metadata,p_activo:true
      },'GUARDAR_ALMACEN');
      await reloadAll();
      try{ if(typeof window.cerrarAlmacen==='function') window.cerrarAlmacen(); }catch(_e){}
      toast('Almacén guardado',`${name} quedó registrado en Supabase.`,'success');
    }catch(error){const msg=friendlyError(error,'GUARDAR_ALMACEN');console.error('[Inventario RPC Almacén]',error);alert(msg);}
    finally{if(button){button.disabled=false;button.innerHTML=old||'Guardar';}}
  }
  function decorateWarehouseScreen(){
    const view=document.getElementById('vista-almacenes'); if(!view) return;
    const header=view.querySelector(':scope > .header');
    if(header && !document.getElementById('invRpcCreateWarehouseBtn')){
      const btn=document.createElement('button'); btn.id='invRpcCreateWarehouseBtn'; btn.className='btn'; btn.type='button'; btn.innerHTML='<i class="fas fa-plus"></i> Crear Almacén'; btn.onclick=openWarehouse; header.appendChild(btn);
    }
    document.querySelectorAll('#tabla-almacenes tr').forEach((tr,index)=>{
      const cell=tr.querySelector('td:last-child'); if(!cell || cell.querySelector('[data-inv-edit-warehouse]')) return;
      const icon=document.createElement('i'); icon.className='fas fa-pen'; icon.title='Editar almacén'; icon.dataset.invEditWarehouse=String(index); icon.onclick=()=>editWarehouse(index); cell.appendChild(icon);
    });
  }

  // ----------------------------------------------------------------------
  // ENTRADAS
  // ----------------------------------------------------------------------
  function entryTempSerials(){
    let values=[]; try{values=values.concat(arr(window.serialesTemporalesEntrada));}catch(_e){}
    try{values=values.concat(arr(serialesTemporalesEntrada));}catch(_e){}
    document.querySelectorAll('#serialesEntradaBody tr').forEach(tr=>{const td=tr.querySelectorAll('td')[1];if(td)values.push(td.textContent);});
    return Array.from(new Set(values.map(upper).filter(Boolean)));
  }
  function clearEntrySerials(){
    window.serialesTemporalesEntrada=[]; try{serialesTemporalesEntrada=[];}catch(_e){}
    const input=document.getElementById('entradaSerialInput');if(input)input.value='';
    try{if(typeof window.renderSerialesEntrada==='function')window.renderSerialesEntrada();}catch(_e){}
  }
  function renderEntryItems(){
    const body=document.getElementById('entradaItemsBody'),table=document.getElementById('entradaItemsTabla'),empty=document.getElementById('entradaItemsVacio');if(!body)return;
    body.innerHTML=state.entradaItems.map((it,index)=>`<tr><td>${esc(it.nombre)}</td><td><strong>${esc(it.cantidad)}</strong></td><td>${it.serializado?'Sí':'No'}</td><td>${it.serializado?esc(it.seriales.join(', ')):'-'}</td><td><button class="entry-remove-btn" type="button" onclick="lotekaInvRpcEliminarEntradaItem(${index})"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    if(table)table.style.display=state.entradaItems.length?'table':'none';if(empty)empty.style.display=state.entradaItems.length?'none':'block';
  }
  function productFromEntrySelect(){
    const select=document.getElementById('entradaProducto');
    if(!select) return null;
    const option=select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0] : null;
    const candidates=[
      txt(select.value),
      txt(option && option.dataset && option.dataset.productId),
      txt(option && option.dataset && option.dataset.supabaseId),
      txt(option && option.dataset && option.dataset.productCode)
    ].filter(Boolean);

    for(const candidate of candidates){
      const exact=state.productos.find(row=>[
        row && row.id,row && row.supabaseId,row && row.producto_id,row && row.codigo
      ].some(value=>txt(value)===candidate));
      if(exact) return exact;
    }

    const selectedText=txt(option && option.textContent);
    const segments=selectedText.split('·').map(txt).filter(Boolean);
    const normalizedSegments=segments.map(norm);
    let matches=state.productos.filter(row=>{
      const code=norm(row && row.codigo), name=norm(row && row.nombre);
      return (code && normalizedSegments.includes(code)) || (name && normalizedSegments.includes(name));
    });
    if(matches.length===1) return matches[0];

    // Compatibilidad con selectores legacy que trabajan con window.productos/supabaseId.
    const legacy=arr(window.productos).find(row=>{
      return candidates.some(candidate=>[
        row && row.id,row && row.supabaseId,row && row.producto_id,row && row.codigo
      ].some(value=>txt(value)===candidate)) ||
      normalizedSegments.includes(norm(row && row.codigo)) ||
      normalizedSegments.includes(norm(row && row.nombre));
    });
    if(legacy){
      const legacyId=txt(legacy.supabaseId || legacy.id || legacy.producto_id);
      const legacyCode=norm(legacy.codigo), legacyName=norm(legacy.nombre);
      const real=state.productos.find(row=>
        (legacyId && [row && row.id,row && row.supabaseId,row && row.producto_id].some(value=>txt(value)===legacyId)) ||
        (legacyCode && norm(row && row.codigo)===legacyCode) ||
        (legacyName && norm(row && row.nombre)===legacyName)
      );
      if(real) return real;
    }
    return null;
  }
  function warehouseFromEntrySelect(){
    const select=document.getElementById('entradaAlmacen');
    if(!select) return null;
    const option=select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0] : null;
    const candidates=[
      txt(select.value),
      txt(option && option.dataset && option.dataset.warehouseId),
      txt(option && option.dataset && option.dataset.supabaseId),
      txt(option && option.dataset && option.dataset.warehouseCode)
    ].filter(Boolean);
    for(const candidate of candidates){
      const exact=state.almacenes.find(row=>[
        row && row.id,row && row.supabaseId,row && row.almacen_id,row && row.codigo
      ].some(value=>txt(value)===candidate));
      if(exact) return exact;
    }
    const selectedText=txt(option && option.textContent);
    const segments=selectedText.split('·').map(txt).filter(Boolean).map(norm);
    const matches=state.almacenes.filter(row=>{
      const code=norm(row && row.codigo), name=norm(row && row.nombre);
      return (code && segments.includes(code)) || (name && segments.includes(name));
    });
    if(matches.length===1) return matches[0];
    const legacy=arr(window.almacenes).find(row=>{
      return candidates.some(candidate=>[
        row && row.id,row && row.supabaseId,row && row.almacen_id,row && row.codigo
      ].some(value=>txt(value)===candidate)) ||
      segments.includes(norm(row && row.codigo)) ||
      segments.includes(norm(row && row.nombre));
    });
    if(legacy){
      const legacyId=txt(legacy.supabaseId || legacy.id || legacy.almacen_id);
      const legacyCode=norm(legacy.codigo),legacyName=norm(legacy.nombre);
      return state.almacenes.find(row=>
        (legacyId && [row && row.id,row && row.supabaseId,row && row.almacen_id].some(value=>txt(value)===legacyId)) ||
        (legacyCode && norm(row && row.codigo)===legacyCode) ||
        (legacyName && norm(row && row.nombre)===legacyName)
      ) || null;
    }
    return null;
  }
  function fillEntrySelects(){
    const a=document.getElementById('entradaAlmacen'),p=document.getElementById('entradaProducto');
    const currentWarehouse=warehouseFromEntrySelect();
    const currentProduct=productFromEntrySelect();
    if(a){
      a.innerHTML='<option value="">Selecciona almacén</option>'+state.almacenes.map(x=>`<option value="${esc(x.id)}" data-warehouse-id="${esc(x.id)}" data-supabase-id="${esc(x.id)}" data-warehouse-code="${esc(x.codigo)}">${esc(warehouseLabel(x))}</option>`).join('');
      if(currentWarehouse && uuid(currentWarehouse.id)) a.value=currentWarehouse.id;
    }
    if(p){
      p.innerHTML='<option value="">Selecciona un producto creado</option>'+state.productos.map(x=>`<option value="${esc(x.id)}" data-product-id="${esc(x.id)}" data-supabase-id="${esc(x.id)}" data-product-code="${esc(x.codigo)}">${esc(productLabel(x))} · ${requiresSerial(x)?'Serializado':'No serializado'}</option>`).join('');
      p.onchange=entryProductChange;
      if(currentProduct && uuid(currentProduct.id)) p.value=currentProduct.id;
    }
  }
  function entryProductChange(){
    const p=productFromEntrySelect(); const s=document.getElementById('entradaSerializado');
    if(s){s.value=p&&requiresSerial(p)?'si':'no';s.disabled=true;}
    try{if(typeof window.actualizarCampoSerialesEntrada==='function')window.actualizarCampoSerialesEntrada();}catch(_e){}
  }
  async function openEntry(){
    try{await load(true);fillEntrySelects();state.entradaItems=[];renderEntryItems();clearEntrySerials();
      const date=document.getElementById('entradaFechaRecepcion');if(date)date.value=nowInput();
      const ref=document.getElementById('entradaReferencia');if(ref)ref.value='EN-'+Date.now();
      const user=document.getElementById('entradaUsuario');if(user)user.value=currentUserName();
      const sup=document.getElementById('entradaSuplidor');if(sup&&!sup.value)sup.value='Suplidor General';
      ['entradaObservacion','entradaUnidades'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
      patchEntryButtons();const modal=document.getElementById('modalEntrada');if(modal)modal.style.display='flex';
    }catch(error){alert(friendlyError(error,'CARGAR_ENTRADA'));}
  }
  async function resolveEntryProduct(){
    let product=productFromEntrySelect();
    if(product && uuid(product.id)) return product;
    await load(true);
    product=productFromEntrySelect();
    if(product && uuid(product.id)){
      const select=document.getElementById('entradaProducto');
      if(select) select.value=product.id;
      return product;
    }
    return null;
  }
  async function resolveEntryWarehouse(){
    let warehouse=warehouseFromEntrySelect();
    if(warehouse && uuid(warehouse.id)) return warehouse;
    await load(true);
    warehouse=warehouseFromEntrySelect();
    if(warehouse && uuid(warehouse.id)){
      const select=document.getElementById('entradaAlmacen');
      if(select) select.value=warehouse.id;
      return warehouse;
    }
    return null;
  }
  async function addEntryItem(){
    try{
      const p=await resolveEntryProduct();
      const quantity=Math.floor(num(document.getElementById('entradaUnidades')?.value));
      if(!p){
        console.warn('[Inventario RPC Entrada] No se pudo resolver el producto seleccionado.',{
          value:document.getElementById('entradaProducto')?.value,
          text:document.getElementById('entradaProducto')?.selectedOptions?.[0]?.textContent,
          productosCargados:state.productos.length
        });
        return alert('Selecciona un producto válido creado en Productos.');
      }
      if(quantity<=0)return alert('Ingresa una cantidad válida.');
      if(state.entradaItems.some(x=>txt(x.producto_id)===txt(p.id)))return alert('Este producto ya fue agregado. Ajusta la cantidad en una sola fila.');
      const serialized=requiresSerial(p),serials=serialized?entryTempSerials():[];
      if(serialized&&serials.length!==quantity)return alert(`Debes agregar ${quantity} serial(es) para ${p.nombre}.`);
      state.entradaItems.push({producto_id:p.id,nombre:p.nombre,cantidad:quantity,serializado:serialized,seriales:serials.slice()});
      renderEntryItems();
      clearEntrySerials();
      const product=document.getElementById('entradaProducto'),qty=document.getElementById('entradaUnidades');
      if(product)product.value='';
      if(qty)qty.value='';
      entryProductChange();
      toast('Producto agregado',`${p.nombre} fue añadido a la entrada.`,'success');
      return true;
    }catch(error){
      console.error('[Inventario RPC Entrada] No se pudo añadir el producto:',error);
      alert(friendlyError(error,'AÑADIR_PRODUCTO_ENTRADA'));
      return false;
    }
  }
  async function saveEntry(){
    const warehouse=await resolveEntryWarehouse();
    if(!warehouse || !uuid(warehouse.id))return alert('Selecciona un almacén válido.');
    const warehouseId=warehouse.id;
    const warehouseSelect=document.getElementById('entradaAlmacen');if(warehouseSelect)warehouseSelect.value=warehouseId;
    if(!state.entradaItems.length)return alert('Agrega por lo menos un producto.');
    if(!confirm('¿Registrar esta entrada de inventario en Supabase?'))return;
    const button=document.querySelector('#modalEntrada [data-inv-entry-save]');const old=button?.innerHTML;
    try{if(button){button.disabled=true;button.innerHTML='<i class="fas fa-spinner fa-spin"></i> Registrando...';}
      const data=await rpc('rpc_inventario_registrar_entrada',{
        p_almacen_id:warehouseId,p_suplidor:txt(document.getElementById('entradaSuplidor')?.selectedOptions?.[0]?.textContent||document.getElementById('entradaSuplidor')?.value)||'Suplidor General',
        p_observaciones:txt(document.getElementById('entradaObservacion')?.value)||null,
        p_referencia:txt(document.getElementById('entradaReferencia')?.value)||('EN-'+Date.now()),
        p_fecha:toIso(document.getElementById('entradaFechaRecepcion')?.value),
        p_items:state.entradaItems.map(i=>({producto_id:i.producto_id,cantidad:i.cantidad,seriales:i.seriales}))
      },'REGISTRAR_ENTRADA');
      state.entradaItems=[];renderEntryItems();try{if(typeof window.cerrarEntrada==='function')window.cerrarEntrada();}catch(_e){}
      await reloadAll();toast('Entrada registrada',`Referencia ${data?.referencia||'guardada'} creada correctamente.`,'success');
    }catch(error){const msg=friendlyError(error,'REGISTRAR_ENTRADA');console.error('[Inventario RPC Entrada]',error);alert(msg);}
    finally{if(button){button.disabled=false;button.innerHTML=old||'Registrar entrada';}}
  }
  function patchEntryButtons(){
    const modal=document.getElementById('modalEntrada');if(!modal)return;
    const add=Array.from(modal.querySelectorAll('button')).find(b=>/agregar producto|añadir a entrada|añadir producto/i.test(b.textContent||''));
    if(add){
      add.type='button';
      add.textContent='Añadir producto';
      add.removeAttribute('onclick');
      add.dataset.invEntryAdd='1';
      add.onclick=async function(event){
        if(event){event.preventDefault();event.stopPropagation();}
        if(add.disabled)return false;
        const old=add.innerHTML;
        try{add.disabled=true;add.innerHTML='<i class="fas fa-spinner fa-spin"></i> Añadiendo...';await addEntryItem();}
        finally{add.disabled=false;add.innerHTML=old&&!/Añadiendo/i.test(old)?old:'Añadir producto';}
        return false;
      };
    }
    const save=Array.from(modal.querySelectorAll('button')).find(b=>/guardar entrada|registrar entrada/i.test(b.textContent||''));
    if(save){
      save.type='button';
      save.innerHTML='<i class="fas fa-check"></i> Registrar entrada';
      save.removeAttribute('onclick');
      save.dataset.invEntrySave='1';
      save.onclick=async function(event){
        if(event){event.preventDefault();event.stopPropagation();}
        await saveEntry();
        return false;
      };
    }
  }

  // ----------------------------------------------------------------------
  // TRANSFERENCIAS
  // ----------------------------------------------------------------------
  function entityList(type){const t=norm(type);if(t==='ALMACEN')return state.almacenes;if(t==='AGENCIA')return state.agencias;return state.grupos;}
  function entityLabel(type,row){const t=norm(type);if(t==='ALMACEN')return warehouseLabel(row);if(t==='AGENCIA')return agencyLabel(row);return groupLabel(row);}
  function fillTransferEntities(){
    const ot=norm(document.getElementById('transferenciaTipoOrigen')?.value||'ALMACEN'),dt=norm(document.getElementById('transferenciaTipoDestino')?.value||'ALMACEN');
    const o=document.getElementById('transferenciaOrigen'),d=document.getElementById('transferenciaDestino');
    if(o)o.innerHTML='<option value="">Selecciona origen</option>'+entityList(ot).map(x=>`<option value="${esc(x.id)}">${esc(entityLabel(ot,x))}</option>`).join('');
    if(d)d.innerHTML='<option value="">Selecciona destino</option>'+entityList(dt).map(x=>`<option value="${esc(x.id)}">${esc(entityLabel(dt,x))}</option>`).join('');
    const lo=document.getElementById('labelTransferenciaOrigen'),ld=document.getElementById('labelTransferenciaDestino');if(lo)lo.textContent=ot.charAt(0)+ot.slice(1).toLowerCase()+' origen';if(ld)ld.textContent=dt.charAt(0)+dt.slice(1).toLowerCase()+' destino';
    fillTransferProducts();
  }
  function fillTransferProducts(){
    const type=norm(document.getElementById('transferenciaTipoOrigen')?.value||'ALMACEN'),id=txt(document.getElementById('transferenciaOrigen')?.value),select=document.getElementById('transferenciaProducto');if(!select)return;
    if(!id){select.innerHTML='<option value="">Selecciona primero el origen</option>';select.disabled=true;return;}
    const available=state.productos.map(p=>({p,stock:stockFor(type,id,p)})).filter(x=>x.stock>0);
    select.disabled=false;select.innerHTML='<option value="">Selecciona producto disponible</option>'+available.map(x=>`<option value="${esc(x.p.id)}">${esc(productLabel(x.p))} · ${requiresSerial(x.p)?'Serializados':'Stock'}: ${esc(x.stock)}</option>`).join('');
    select.setAttribute('onchange','lotekaInvRpcTransferProductoCambio()');
  }
  function transferProductChange(){
    const p=byId(state.productos,document.getElementById('transferenciaProducto')?.value),s=document.getElementById('transferenciaSerializado'),qty=document.getElementById('transferenciaUnidades');
    if(s){s.value=p&&requiresSerial(p)?'si':'no';s.disabled=true;}if(qty)qty.value='';state.transferenciaSeriales=[];renderTransferSerials();
    try{if(typeof window.actualizarCampoSerialesTransferencia==='function')window.actualizarCampoSerialesTransferencia();}catch(_e){}
    const input=document.getElementById('transferenciaSerialInput');if(input){const old=document.getElementById('invRpcTransferSerialList');if(old)old.remove();const dl=document.createElement('datalist');dl.id='invRpcTransferSerialList';document.body.appendChild(dl);input.setAttribute('list',dl.id);const type=norm(document.getElementById('transferenciaTipoOrigen')?.value),id=txt(document.getElementById('transferenciaOrigen')?.value);dl.innerHTML=p&&requiresSerial(p)?entitySerials(type,id,p.id).map(x=>`<option value="${esc(x.serial)}"></option>`).join(''):'';}
  }
  function addTransferSerial(){const input=document.getElementById('transferenciaSerialInput'),value=upper(input?.value);if(!value)return alert('Escribe o selecciona un serial.');if(state.transferenciaSeriales.includes(value))return alert('Ese serial ya fue agregado.');const p=byId(state.productos,document.getElementById('transferenciaProducto')?.value),type=norm(document.getElementById('transferenciaTipoOrigen')?.value),id=txt(document.getElementById('transferenciaOrigen')?.value);if(!p||!entitySerials(type,id,p.id).some(x=>upper(x.serial)===value))return alert('El serial no está disponible en el origen seleccionado.');state.transferenciaSeriales.push(value);if(input)input.value='';renderTransferSerials();}
  function renderTransferSerials(){const body=document.getElementById('serialesTransferenciaBody'),table=document.getElementById('tablaSerialesTransferencia'),empty=document.getElementById('serialesVaciosTransferencia');if(!body)return;body.innerHTML=state.transferenciaSeriales.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s)}</td><td><button class="entry-remove-btn" onclick="lotekaInvRpcEliminarSerialTransferencia(${i})" type="button"><i class="fas fa-trash"></i></button></td></tr>`).join('');if(table)table.style.display=state.transferenciaSeriales.length?'table':'none';if(empty)empty.style.display=state.transferenciaSeriales.length?'none':'block';}
  function renderTransferItems(){const body=document.getElementById('transferenciaItemsBody'),table=document.getElementById('transferenciaItemsTabla'),empty=document.getElementById('transferenciaItemsVacio');if(!body)return;body.innerHTML=state.transferenciaItems.map((i,idx)=>`<tr><td>${esc(i.nombre)}</td><td><strong>${esc(i.cantidad)}</strong></td><td>${i.serializado?'Sí':'No'}</td><td>${i.serializado?esc(i.seriales.join(', ')):'-'}</td><td><button class="entry-remove-btn" onclick="lotekaInvRpcEliminarTransferItem(${idx})" type="button"><i class="fas fa-trash"></i></button></td></tr>`).join('');if(table)table.style.display=state.transferenciaItems.length?'table':'none';if(empty)empty.style.display=state.transferenciaItems.length?'none':'block';}
  function addTransferItem(){const type=norm(document.getElementById('transferenciaTipoOrigen')?.value),id=txt(document.getElementById('transferenciaOrigen')?.value),p=byId(state.productos,document.getElementById('transferenciaProducto')?.value),q=Math.floor(num(document.getElementById('transferenciaUnidades')?.value));if(!id)return alert('Selecciona el origen.');if(!p)return alert('Selecciona un producto disponible.');if(q<=0)return alert('Ingresa una cantidad válida.');if(state.transferenciaItems.some(x=>x.producto_id===p.id))return alert('Este producto ya fue agregado.');const stock=stockFor(type,id,p);if(q>stock)return alert(`Stock insuficiente. Disponible: ${stock}.`);const serials=requiresSerial(p)?state.transferenciaSeriales.slice():[];if(requiresSerial(p)&&serials.length!==q)return alert(`Agrega exactamente ${q} serial(es).`);state.transferenciaItems.push({producto_id:p.id,nombre:p.nombre,cantidad:q,serializado:requiresSerial(p),seriales:serials});state.transferenciaSeriales=[];renderTransferSerials();renderTransferItems();const ps=document.getElementById('transferenciaProducto'),qt=document.getElementById('transferenciaUnidades');if(ps)ps.value='';if(qt)qt.value='';transferProductChange();}
  async function openTransfer(){try{await load(true);state.transferenciaItems=[];state.transferenciaSeriales=[];fillTransferEntities();renderTransferItems();renderTransferSerials();const date=document.getElementById('transferenciaFecha');if(date)date.value=nowInput();const ref=document.getElementById('transferenciaReferencia');if(ref)ref.value='TR-'+Date.now();const user=document.getElementById('transferenciaUsuario');if(user)user.value=currentUserName();const modal=document.getElementById('modalTransferencia');if(modal)modal.style.display='flex';patchTransferButtons();}catch(error){alert(friendlyError(error,'CARGAR_TRANSFERENCIA'));}}
  async function saveTransfer(){const ot=norm(document.getElementById('transferenciaTipoOrigen')?.value),dt=norm(document.getElementById('transferenciaTipoDestino')?.value),oi=txt(document.getElementById('transferenciaOrigen')?.value),di=txt(document.getElementById('transferenciaDestino')?.value);if(!uuid(oi)||!uuid(di))return alert('Selecciona origen y destino válidos.');if(ot===dt&&oi===di)return alert('Origen y destino no pueden ser iguales.');if(!state.transferenciaItems.length)return alert('Agrega por lo menos un producto.');if(!confirm('¿Registrar esta transferencia en Supabase?'))return;const button=document.querySelector('#modalTransferencia [data-inv-transfer-save]');const old=button?.innerHTML;try{if(button){button.disabled=true;button.innerHTML='<i class="fas fa-spinner fa-spin"></i> Registrando...';}const data=await rpc('rpc_inventario_transferir',{p_origen_tipo:ot,p_origen_id:oi,p_destino_tipo:dt,p_destino_id:di,p_referencia:txt(document.getElementById('transferenciaReferencia')?.value)||('TR-'+Date.now()),p_observaciones:txt(document.getElementById('transferenciaObservacion')?.value)||null,p_fecha:toIso(document.getElementById('transferenciaFecha')?.value),p_items:state.transferenciaItems.map(i=>({producto_id:i.producto_id,cantidad:i.cantidad,seriales:i.seriales}))},'REGISTRAR_TRANSFERENCIA');state.transferenciaItems=[];try{if(typeof window.cerrarTransferencia==='function')window.cerrarTransferencia();}catch(_e){}await reloadAll();toast('Transferencia registrada',`Referencia ${data?.referencia||'guardada'} completada.`,'success');}catch(error){const msg=friendlyError(error,'REGISTRAR_TRANSFERENCIA');console.error('[Inventario RPC Transferencia]',error);alert(msg);}finally{if(button){button.disabled=false;button.innerHTML=old||'Registrar transferencia';}}}
  function patchTransferButtons(){const modal=document.getElementById('modalTransferencia');if(!modal)return;const add=Array.from(modal.querySelectorAll('button')).find(b=>/agregar producto/i.test(b.textContent||''));if(add){add.textContent='Añadir a transferencia';add.setAttribute('onclick','lotekaInvRpcAgregarTransferItem()');}const serial=Array.from(modal.querySelectorAll('button')).find(b=>/agregar serial/i.test(b.textContent||''));if(serial)serial.setAttribute('onclick','lotekaInvRpcAgregarSerialTransferencia()');const save=Array.from(modal.querySelectorAll('button')).find(b=>/guardar transferencia|registrar transferencia/i.test(b.textContent||''));if(save){save.innerHTML='<i class="fas fa-right-left"></i> Registrar transferencia';save.setAttribute('onclick','lotekaInvRpcGuardarTransferencia()');save.dataset.invTransferSave='1';}}

  // ----------------------------------------------------------------------
  // SALIDAS
  // ----------------------------------------------------------------------
  function fillOutputSelects(){const a=document.getElementById('salidaOrigenAlmacen'),p=document.getElementById('salidaProducto');if(a)a.innerHTML='<option value="">Selecciona almacén</option>'+state.almacenes.map(x=>`<option value="${esc(x.id)}">${esc(warehouseLabel(x))}</option>`).join('');if(p)p.innerHTML='<option value="">Selecciona primero el almacén</option>';}
  function outputProductOptions(){const aid=txt(document.getElementById('salidaOrigenAlmacen')?.value),p=document.getElementById('salidaProducto');if(!p)return;if(!aid){p.innerHTML='<option value="">Selecciona primero el almacén</option>';p.disabled=true;return;}const list=state.productos.map(x=>({p:x,stock:stockFor('ALMACEN',aid,x)})).filter(x=>x.stock>0);p.disabled=false;p.innerHTML='<option value="">Selecciona producto disponible</option>'+list.map(x=>`<option value="${esc(x.p.id)}">${esc(productLabel(x.p))} · Disponible: ${esc(x.stock)}</option>`).join('');outputSerialOptions();}
  function outputSerialOptions(){const aid=txt(document.getElementById('salidaOrigenAlmacen')?.value),p=byId(state.productos,document.getElementById('salidaProducto')?.value),input=document.getElementById('salidaSerial'),dl=document.getElementById('salidaSerialDatalist'),qty=document.getElementById('salidaCantidad');if(!input)return;input.value='';if(!p||!requiresSerial(p)){input.disabled=true;input.placeholder=p?`No serializado · stock ${stockFor('ALMACEN',aid,p)}`:'No aplica';if(dl)dl.innerHTML='';if(qty)qty.disabled=false;return;}const list=entitySerials('ALMACEN',aid,p.id);input.disabled=false;input.placeholder=list.length?'Escribe o selecciona serial':'No hay seriales disponibles';if(dl)dl.innerHTML=list.map(s=>`<option value="${esc(s.serial)}"></option>`).join('');if(qty){qty.value='1';qty.disabled=true;}}
  function renderOutputItems(){const box=document.getElementById('salidaItemsBox');if(!box)return;if(!state.salidaItems.length){box.innerHTML='<div class="salida-empty" style="margin:0">Todavía no has agregado productos a esta salida.</div>';return;}box.innerHTML=`<table><thead><tr><th>Producto</th><th>Cantidad</th><th>Serial</th><th>Acción</th></tr></thead><tbody>${state.salidaItems.map((i,idx)=>`<tr><td>${esc(i.nombre)}</td><td>${esc(i.cantidad)}</td><td>${esc(i.serial||'No aplica')}</td><td><button class="salida-btn soft" onclick="lotekaInvRpcEliminarSalidaItem(${idx})"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody></table>`;}
  function addOutputItem(){const aid=txt(document.getElementById('salidaOrigenAlmacen')?.value),p=byId(state.productos,document.getElementById('salidaProducto')?.value),q=Math.floor(num(document.getElementById('salidaCantidad')?.value));if(!aid)return alert('Selecciona el almacén origen.');if(!p)return alert('Selecciona un producto.');if(q<=0)return alert('Ingresa una cantidad válida.');if(requiresSerial(p)){const code=upper(document.getElementById('salidaSerial')?.value),row=entitySerials('ALMACEN',aid,p.id).find(s=>upper(s.serial)===code);if(!row)return alert('Selecciona un serial disponible en el almacén.');if(state.salidaItems.some(i=>i.serial===code))return alert('Ese serial ya fue agregado.');state.salidaItems.push({producto_id:p.id,nombre:p.nombre,cantidad:1,serial:code,serializado:true});}else{const used=state.salidaItems.filter(i=>i.producto_id===p.id&&!i.serializado).reduce((s,i)=>s+i.cantidad,0),stock=stockFor('ALMACEN',aid,p);if(used+q>stock)return alert(`Stock insuficiente. Disponible: ${stock}.`);if(state.salidaItems.some(i=>i.producto_id===p.id&&!i.serializado))return alert('Ese producto ya fue agregado.');state.salidaItems.push({producto_id:p.id,nombre:p.nombre,cantidad:q,serial:'',serializado:false});}renderOutputItems();const ps=document.getElementById('salidaProducto');if(ps)ps.value='';const qty=document.getElementById('salidaCantidad');if(qty){qty.value='1';qty.disabled=false;}outputSerialOptions();}
  async function openOutput(){try{await load(true);state.salidaItems=[];fillOutputSelects();renderOutputItems();const date=document.getElementById('salidaFecha');if(date)date.value=nowInput();const user=document.getElementById('salidaUsuario');if(user)user.value=currentUserName();const modal=document.getElementById('modalSalidaInventario');if(modal)modal.style.display='flex';}catch(error){alert(friendlyError(error,'CARGAR_SALIDA'));}}
  async function saveOutput(){const aid=txt(document.getElementById('salidaOrigenAlmacen')?.value),type=txt(document.getElementById('salidaTipo')?.value),date=txt(document.getElementById('salidaFecha')?.value);if(!uuid(aid))return alert('Selecciona un almacén válido.');if(!type)return alert('Selecciona el tipo de salida.');if(!date)return alert('Selecciona fecha y hora.');if(!state.salidaItems.length)return alert('Agrega por lo menos un producto.');if(!confirm('¿Registrar esta salida de inventario en Supabase?'))return;const button=Array.from(document.querySelectorAll('#modalSalidaInventario button')).find(b=>/guardar salida|registrar salida/i.test(b.textContent||''));const old=button?.innerHTML;try{if(button){button.disabled=true;button.innerHTML='<i class="fas fa-spinner fa-spin"></i> Registrando...';}const data=await rpc('rpc_inventario_registrar_salida',{p_almacen_id:aid,p_tipo:type,p_observaciones:txt(document.getElementById('salidaComentario')?.value)||null,p_referencia:'SALI-'+Date.now(),p_fecha:toIso(date),p_items:state.salidaItems.map(i=>({producto_id:i.producto_id,cantidad:i.cantidad,serial:i.serial||null,seriales:i.serial?[i.serial]:[]}))},'REGISTRAR_SALIDA');state.salidaItems=[];try{if(typeof window.lotekaCerrarSalidaInventario==='function')window.lotekaCerrarSalidaInventario();}catch(_e){}await reloadAll();toast('Salida registrada',`Referencia ${data?.referencia||'guardada'} completada.`,'success');}catch(error){const msg=friendlyError(error,'REGISTRAR_SALIDA');console.error('[Inventario RPC Salida]',error);alert(msg);}finally{if(button){button.disabled=false;button.innerHTML=old||'Guardar salida';}}}

  // ----------------------------------------------------------------------
  // PUBLICACIÓN Y ARRANQUE
  // ----------------------------------------------------------------------
  window.guardarProducto=saveProduct;
  window.abrirAlmacen=openWarehouse;window.editarAlmacen=editWarehouse;window.guardarAlmacen=saveWarehouse;
  window.abrirEntrada=openEntry;window.llenarOpcionesModalEntrada=fillEntrySelects;window.lotekaInvRpcEntradaProductoCambio=entryProductChange;window.lotekaInvRpcAgregarEntradaItem=function(){return addEntryItem();};window.lotekaInvRpcGuardarEntrada=function(){return saveEntry();};window.lotekaInvRpcEliminarEntradaItem=function(i){state.entradaItems.splice(Number(i),1);renderEntryItems();};window.agregarProductoEntrada=function(){return addEntryItem();};window.guardarEntrada=function(){return saveEntry();};
  window.abrirTransferencia=openTransfer;window.actualizarSelectoresTransferencia=fillTransferEntities;window.actualizarProductosTransferenciaSegunOrigen=fillTransferProducts;window.lotekaInvRpcTransferProductoCambio=transferProductChange;window.lotekaInvRpcAgregarSerialTransferencia=addTransferSerial;window.lotekaInvRpcEliminarSerialTransferencia=function(i){state.transferenciaSeriales.splice(Number(i),1);renderTransferSerials();};window.lotekaInvRpcAgregarTransferItem=addTransferItem;window.lotekaInvRpcEliminarTransferItem=function(i){state.transferenciaItems.splice(Number(i),1);renderTransferItems();};window.lotekaInvRpcGuardarTransferencia=saveTransfer;window.guardarTransferencia=saveTransfer;window.agregarProductoTransferencia=addTransferItem;window.agregarSerialTransferencia=addTransferSerial;
  window.lotekaAbrirSalidaInventario=openOutput;window.lotekaSalidaUpdateSerialSelect=function(){const active=document.activeElement;if(active&&active.id==='salidaProducto')outputSerialOptions();else outputProductOptions();};window.lotekaAgregarItemSalida=addOutputItem;window.lotekaEliminarItemSalida=function(i){state.salidaItems.splice(Number(i),1);renderOutputItems();};window.lotekaGuardarSalidaInventario=saveOutput;
  try{guardarProducto=saveProduct;abrirAlmacen=openWarehouse;editarAlmacen=editWarehouse;guardarAlmacen=saveWarehouse;abrirEntrada=openEntry;llenarOpcionesModalEntrada=fillEntrySelects;agregarProductoEntrada=addEntryItem;guardarEntrada=saveEntry;abrirTransferencia=openTransfer;guardarTransferencia=saveTransfer;agregarProductoTransferencia=addTransferItem;agregarSerialTransferencia=addTransferSerial;}catch(_e){}

  const previousRenderWarehouses=window.renderAlmacenes;
  if(typeof previousRenderWarehouses==='function'&&!previousRenderWarehouses.__invRpcV500){
    const wrapped=function(){const result=previousRenderWarehouses.apply(this,arguments);setTimeout(decorateWarehouseScreen,0);return result;};wrapped.__invRpcV500=true;window.renderAlmacenes=wrapped;try{renderAlmacenes=wrapped;}catch(_e){}
  }

  function boot(){
    patchEntryButtons();patchTransferButtons();decorateWarehouseScreen();
    const productBtn=document.querySelector('#modalProducto button[onclick*="guardarProducto"]');if(productBtn)productBtn.dataset.invProductSave='1';
    const warehouseBtn=document.querySelector('#modalAlmacen button');if(warehouseBtn)warehouseBtn.dataset.invWarehouseSave='1';
    setTimeout(()=>load(true).then(()=>{decorateWarehouseScreen();}).catch(e=>console.warn('[Inventario RPC] Carga inicial:',e)),900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.addEventListener('load',()=>setTimeout(boot,500));
  console.info('[LOTEKA]',VERSION,'instalado.');
})();


(function(){
  'use strict';
  if(window.__lotekaEntregaDirectaV603) return;
  window.__lotekaEntregaDirectaV603=true;

  const VERSION='v603';
  const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const state={loadedAt:0,loading:null,grupos:[],agencias:[],perfiles:[],productos:[],equipos:[],inventarioGrupo:[],inventarioAgencia:[],despachos:[],currentGroupId:null,currentAgencyId:null};

  const txt=v=>String(v==null?'':v).trim();
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const uuid=v=>UUID_RE.test(txt(v));
  const arr=v=>Array.isArray(v)?v:[];
  const mapBy=(list,key='id')=>new Map(arr(list).map(row=>[txt(row&&row[key]),row]).filter(x=>x[0]));
  const sb=()=>window.lotekaSupabase||null;
  const fmt=value=>{if(!value)return '-';const d=new Date(value);return Number.isNaN(d.getTime())?txt(value):d.toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
  function toast(title,message,type='info'){
    try{if(typeof window.lotekaToast==='function')return window.lotekaToast(title,message,type,5200);}catch(_e){}
    try{if(typeof window.toast==='function')return window.toast(message||title,type);}catch(_e){}
    console[type==='error'?'error':'log']('[LOTEKA '+VERSION+']',title,message);
  }
  function friendly(error){const code=txt(error&&error.code),message=txt(error&&error.message)||'No se pudo completar la operación.';return message+(code?' ['+code+']':'');}
  async function rpc(name,args){const c=sb();if(!c)throw new Error('Supabase no está disponible.');const res=await c.rpc(name,args||{});if(res.error)throw res.error;return res.data;}
  async function query(table,configure){const c=sb();if(!c)throw new Error('Supabase no está disponible.');let q=c.from(table).select('*');if(configure)q=configure(q);const res=await q;if(res.error)throw res.error;return arr(res.data);}

  // --------------------------------------------------------------------------
  // MODAL INTERNO PROFESIONAL
  // --------------------------------------------------------------------------
  function ensureModal(){
    let back=document.getElementById('ltkV603Backdrop');
    if(back)return back;
    back=document.createElement('div');back.id='ltkV603Backdrop';back.className='ltk-v603-backdrop';back.setAttribute('aria-hidden','true');
    back.innerHTML='<div class="ltk-v603-modal" role="dialog" aria-modal="true"><div class="ltk-v603-head"><div><h3 id="ltkV603Title">Grupo Ortiz</h3><p id="ltkV603Subtitle"></p></div><button class="ltk-v603-close" data-v603-close type="button"><i class="fas fa-xmark"></i></button></div><div class="ltk-v603-body"><div id="ltkV603Alert" class="ltk-v603-alert"></div><div id="ltkV603Content"></div></div><div id="ltkV603Footer" class="ltk-v603-footer"></div></div>';
    document.body.appendChild(back);
    back.addEventListener('click',e=>{if(e.target===back&&!back.dataset.busy)closeModal();});
    back.addEventListener('click',e=>{if(e.target.closest('[data-v603-close]')&&!back.dataset.busy)closeModal();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&back.classList.contains('show')&&!back.dataset.busy){e.preventDefault();closeModal();}},true);
    return back;
  }
  function openModal(title,subtitle,content,footer){const back=ensureModal();document.getElementById('ltkV603Title').textContent=title||'Grupo Ortiz';document.getElementById('ltkV603Subtitle').textContent=subtitle||'';document.getElementById('ltkV603Content').innerHTML=content||'';document.getElementById('ltkV603Footer').innerHTML=footer||'';showModalAlert('');back.classList.add('show');back.setAttribute('aria-hidden','false');document.body.classList.add('ltk-v603-modal-open');}
  function closeModal(){const back=ensureModal();if(back.dataset.busy)return;back.classList.remove('show');back.setAttribute('aria-hidden','true');document.body.classList.remove('ltk-v603-modal-open');document.getElementById('ltkV603Content').innerHTML='';document.getElementById('ltkV603Footer').innerHTML='';}
  function showModalAlert(message,type='error'){const el=document.getElementById('ltkV603Alert');if(!el)return;el.textContent=message||'';el.className='ltk-v603-alert'+(message?' show '+type:'');}
  function setModalBusy(button,busy,label){const back=ensureModal();back.dataset.busy=busy?'1':'';back.querySelectorAll('button').forEach(b=>{b.disabled=busy;});if(button){if(busy){button.dataset.old=button.innerHTML;button.innerHTML='<i class="fas fa-spinner fa-spin"></i> '+esc(label||'Procesando...');}else if(button.dataset.old){button.innerHTML=button.dataset.old;delete button.dataset.old;}}}

  // --------------------------------------------------------------------------
  // SALIDA + ENTREGA DIRECTA
  // --------------------------------------------------------------------------
  async function loadDispatchDetail(id){
    const c=sb();if(!c)throw new Error('Supabase no está disponible.');
    const d=await c.from('despachos').select('*').eq('id',id).single();if(d.error)throw d.error;
    const itemsRes=await c.from('despacho_items').select('*').eq('despacho_id',id).order('creado_en');if(itemsRes.error)throw itemsRes.error;
    const items=arr(itemsRes.data),itemIds=items.map(x=>x.id);
    let serialRows=[];if(itemIds.length){const sr=await c.from('despacho_seriales').select('*').in('despacho_item_id',itemIds).order('creado_en');if(sr.error)throw sr.error;serialRows=arr(sr.data);}
    const productIds=[...new Set(items.map(x=>x.producto_id).filter(Boolean))];
    const serialIds=[...new Set(serialRows.map(x=>x.serial_id).filter(Boolean))];
    const promises=[];
    promises.push(productIds.length?c.from('productos').select('*').in('id',productIds):Promise.resolve({data:[],error:null}));
    promises.push(serialIds.length?c.from('equipos_seriales').select('*').in('id',serialIds):Promise.resolve({data:[],error:null}));
    promises.push(c.from('almacenes').select('*').eq('id',d.data.almacen_origen_id).maybeSingle());
    if(d.data.tipo_destino==='AGENCIA')promises.push(c.from('agencias').select('*').eq('id',d.data.agencia_destino_id).maybeSingle());
    else promises.push(c.from('grupos').select('*').eq('id',d.data.grupo_destino_id).maybeSingle());
    const [pr,eq,wh,dest]=await Promise.all(promises);for(const r of [pr,eq,wh,dest])if(r.error)throw r.error;
    return {dispatch:d.data,items,serialRows,products:arr(pr.data),equipment:arr(eq.data),warehouse:wh.data,destination:dest.data};
  }
  function directDestinationLabel(detail){const d=detail.dispatch,x=detail.destination||{};if(d.tipo_destino==='AGENCIA')return 'Agencia '+txt(x.numero||x.nombre||d.agencia_destino_id);if(d.tipo_destino==='ENCARGADO')return txt(d.responsable_destino_nombre||'Encargado')+' · '+txt(x.nombre||x.codigo||'Grupo');return txt(x.nombre||x.codigo||d.grupo_destino_id);}
  async function openDirectExit(id){
    openModal('Confirmar salida y entrega final','Cargando el despacho...','<div class="ltk-v603-group-loading"><i class="fas fa-spinner fa-spin"></i> Consultando inventario preparado...</div>','');
    try{
      const detail=await loadDispatchDetail(id),d=detail.dispatch,pm=mapBy(detail.products),em=mapBy(detail.equipment),serialByItem=new Map();
      detail.serialRows.forEach(row=>{const key=txt(row.despacho_item_id);if(!serialByItem.has(key))serialByItem.set(key,[]);serialByItem.get(key).push(row);});
      const rows=detail.items.map(item=>{const p=pm.get(txt(item.producto_id))||{},serials=arr(serialByItem.get(txt(item.id))).filter(s=>txt(s.estado)==='RESERVADO').map(s=>txt((em.get(txt(s.serial_id))||{}).serial)).filter(Boolean);return '<tr><td><b>'+esc(p.nombre||p.codigo||item.producto_id)+'</b><br><small>'+esc(p.categoria||'Inventario')+'</small></td><td>'+esc(item.cantidad_preparada)+'</td><td>'+(serials.length?serials.map(s=>'<span class="ltk-v603-stock-badge"><i class="fas fa-barcode"></i>'+esc(s)+'</span>').join(' '):'<span class="small-muted">No serializado</span>')+'</td></tr>';}).join('');
      const body='<div class="ltk-v603-grid"><div class="ltk-v603-meta"><span>Código</span><b>'+esc(d.codigo)+'</b></div><div class="ltk-v603-meta"><span>Estado actual</span><b>'+esc(d.estado)+'</b></div><div class="ltk-v603-meta"><span>Almacén de origen</span><b>'+esc([detail.warehouse&&detail.warehouse.codigo,detail.warehouse&&detail.warehouse.nombre].filter(Boolean).join(' · '))+'</b></div><div class="ltk-v603-meta"><span>Destino final</span><b>'+esc(directDestinationLabel(detail))+'</b></div></div><div class="ltk-v603-section"><h4>Productos preparados</h4><div class="ltk-v603-section-body"><div style="overflow:auto"><table class="ltk-v603-table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Seriales</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></div><form id="ltkV603ExitForm" data-dispatch-id="'+esc(id)+'" style="margin-top:16px"><div class="ltk-v603-field"><label>Observación final de salida</label><textarea id="ltkV603ExitObservation" placeholder="Detalle de entrega, documento, persona que recibe o cualquier observación relevante.">Salida y entrega final confirmadas desde Control de Despachos.</textarea></div></form><div class="ltk-v603-section"><div class="ltk-v603-section-body"><b><i class="fas fa-shield-halved"></i> Operación transaccional</b><p style="margin:7px 0 0;color:#6f879a;font-weight:750">Al confirmar, el inventario sale del almacén y queda registrado inmediatamente en la agencia, grupo o custodia del encargado. No quedará en tránsito ni requerirá recepción manual.</p></div></div>';
      const footer='<button class="ltk-v603-btn secondary" data-v603-close type="button">Cancelar</button><button class="ltk-v603-btn primary" id="ltkV603ConfirmExit" type="button"><i class="fas fa-truck-fast"></i> Confirmar salida</button>';
      openModal('Confirmar salida','Entrega directa · '+txt(d.codigo),body,footer);
      document.getElementById('ltkV603ConfirmExit').onclick=async function(){
        const button=this,obs=txt(document.getElementById('ltkV603ExitObservation').value);
        setModalBusy(button,true,'Finalizando...');showModalAlert('');
        try{
          await rpc('rpc_confirmar_salida_entrega_directa',{p_despacho_id:id,p_observaciones:obs||null});
          ensureModal().dataset.busy='';closeModal();
          toast('Despacho finalizado','La salida fue confirmada y el inventario quedó registrado en su destino final.','success');
          await refreshEverything(true);
          try{if(typeof window.lotekaDespachosOpenTab==='function')window.lotekaDespachosOpenTab('historial');}catch(_e){}
        }catch(error){showModalAlert(friendly(error),'error');toast('No se pudo finalizar',friendly(error),'error');}
        finally{setModalBusy(button,false);}
      };
    }catch(error){openModal('No se pudo abrir la salida','Revisa el despacho.','<div class="ltk-v603-alert show error">'+esc(friendly(error))+'</div>','<button class="ltk-v603-btn secondary" data-v603-close type="button">Cerrar</button>');}
  }

  window.lotekaOpenDirectExitV603 = openDirectExit;

  // --------------------------------------------------------------------------
  // INCIDENCIA ADMINISTRATIVA
  // --------------------------------------------------------------------------
  async function openNewIncident(){
    try{
      const dispatches=await query('despachos',q=>q.neq('estado','CANCELADO').order('creado_en',{ascending:false}).limit(1000));
      const options=dispatches.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.codigo+' · '+d.estado+' · '+d.tipo_destino)+'</option>').join('');
      const body='<form id="ltkV603IncidentForm"><div class="ltk-v603-grid"><div class="ltk-v603-field" style="grid-column:1/-1"><label>Despacho</label><select id="ltkV603IncidentDispatch" required><option value="">Selecciona despacho</option>'+options+'</select></div><div class="ltk-v603-field"><label>Tipo</label><select id="ltkV603IncidentType"><option>FALTANTE</option><option>DAÑADO</option><option>SERIAL_INCORRECTO</option><option>CANTIDAD_INCORRECTA</option><option>PRODUCTO_INCORRECTO</option><option>OTRO</option></select></div><div class="ltk-v603-field" style="grid-column:1/-1"><label>Descripción</label><textarea id="ltkV603IncidentDescription" required placeholder="Describe claramente lo ocurrido."></textarea></div></div></form>';
      openModal('Nueva incidencia administrativa','No requiere recepción parcial.',body,'<button class="ltk-v603-btn secondary" data-v603-close type="button">Cancelar</button><button class="ltk-v603-btn warning" id="ltkV603SaveIncident" type="button"><i class="fas fa-triangle-exclamation"></i> Registrar incidencia</button>');
      document.getElementById('ltkV603SaveIncident').onclick=async function(){const button=this,id=txt(document.getElementById('ltkV603IncidentDispatch').value),type=txt(document.getElementById('ltkV603IncidentType').value),description=txt(document.getElementById('ltkV603IncidentDescription').value);if(!id||!description){showModalAlert('Selecciona el despacho y describe la incidencia.');return;}setModalBusy(button,true,'Registrando...');try{await rpc('rpc_registrar_incidencia_despacho',{p_despacho_id:id,p_tipo:type,p_descripcion:description,p_despacho_item_id:null,p_serial_id:null});ensureModal().dataset.busy='';closeModal();toast('Incidencia registrada','Quedó abierta para seguimiento administrativo.','success');await refreshEverything(true);try{window.lotekaDespachosOpenTab('incidencias');}catch(_e){}}catch(error){showModalAlert(friendly(error));}finally{setModalBusy(button,false);}};
    }catch(error){toast('Incidencias',friendly(error),'error');}
  }
  function injectIncidentButton(){const content=document.getElementById('dspxContent');if(!content)return;const head=Array.from(content.querySelectorAll('.dispatch-panel-head')).find(h=>norm(h.querySelector('h3')&&h.querySelector('h3').textContent)==='INCIDENCIAS');if(!head||head.querySelector('[data-v603-new-incident]'))return;const b=document.createElement('button');b.className='dspx-btn warning';b.type='button';b.dataset.v603NewIncident='1';b.innerHTML='<i class="fas fa-plus"></i> Nueva incidencia';b.onclick=openNewIncident;head.appendChild(b);}

  // --------------------------------------------------------------------------
  // DATOS CANÓNICOS DE AGENCIAS, GRUPOS Y CUSTODIA
  // --------------------------------------------------------------------------
  async function loadDestinationData(force){
    if(!force&&state.loadedAt&&Date.now()-state.loadedAt<12000)return state;
    if(state.loading)return state.loading;
    state.loading=(async()=>{
      const [gr,ag,pf,pr,eq,ig,ia,ds]=await Promise.all([
        query('grupos',q=>q.eq('activo',true).order('nombre').limit(2000)),
        query('agencias',q=>q.eq('activo',true).order('numero').limit(5000)),
        query('perfiles',q=>q.eq('activo',true).limit(5000)),
        query('productos',q=>q.eq('activo',true).order('nombre').limit(10000)),
        query('equipos_seriales',q=>q.eq('activo',true).limit(20000)),
        query('inventario_grupo',q=>q.order('creado_en',{ascending:false}).limit(20000)),
        query('inventario_agencia',q=>q.order('creado_en',{ascending:false}).limit(30000)),
        query('despachos',q=>q.order('creado_en',{ascending:false}).limit(3000))
      ]);
      Object.assign(state,{grupos:gr,agencias:ag,perfiles:pf,productos:pr,equipos:eq,inventarioGrupo:ig,inventarioAgencia:ia,despachos:ds,loadedAt:Date.now()});
      return state;
    })();
    try{return await state.loading;}finally{state.loading=null;}
  }
  function activeInventory(row){return ['ACTIVO','INSTALADO'].includes(norm(row&&row.estado));}
  function profileName(id){const p=mapBy(state.perfiles).get(txt(id));return p?txt(p.nombre_completo||p.nombre||p.correo||p.email):'';}
  function productInfo(id){return mapBy(state.productos).get(txt(id))||{};}
  function groupInfo(id){return mapBy(state.grupos).get(txt(id))||{};}
  function dispatchCode(id){const d=mapBy(state.despachos).get(txt(id));return d?txt(d.codigo):'';}
  function groupLabel(g){const code=txt(g&&g.codigo).replace(/\D/g,'').padStart(2,'0');return txt(g&&g.nombre)||('Grupo '+code);}
  function localGroupIndex(g){const list=arr(window.grupos);return list.findIndex(x=>[x&&x.id,x&&x.supabaseId,x&&x.grupo_id].some(v=>txt(v)===txt(g.id))||norm(x&&x.codigo)===norm(g.codigo)||norm(x&&x.nombre)===norm(g.nombre));}

  async function renderGroups(force){
    const tbody=document.getElementById('tabla-grupos');if(!tbody)return;
    tbody.innerHTML='<tr><td colspan="7" class="ltk-v603-group-loading"><i class="fas fa-spinner fa-spin"></i> Cargando inventario real de grupos...</td></tr>';
    try{
      await loadDestinationData(force);
      const q=norm(document.getElementById('groupSearchInput')&&document.getElementById('groupSearchInput').value),manager=norm(document.getElementById('groupManagerFilter')&&document.getElementById('groupManagerFilter').value);
      const managerSelect=document.getElementById('groupManagerFilter');if(managerSelect){const old=managerSelect.value,names=[...new Set(state.grupos.map(g=>txt(g.encargado||profileName(g.encargado_id))).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));managerSelect.innerHTML='<option value="">Todos</option>'+names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');if(names.includes(old))managerSelect.value=old;}
      const rowsData=state.grupos.map(g=>{
        const agencies=state.agencias.filter(a=>txt(a.grupo_id)===txt(g.id));
        const inv=state.inventarioGrupo.filter(r=>txt(r.grupo_id)===txt(g.id)&&activeInventory(r));
        const equipment=state.equipos.filter(r=>txt(r.ubicacion_tipo)==='GRUPO'&&txt(r.grupo_id)===txt(g.id)&&r.activo!==false);
        const custody=inv.filter(r=>r.encargado_id).reduce((s,r)=>s+num(r.cantidad),0);
        const serials=new Set(equipment.map(r=>txt(r.id)).filter(Boolean)).size;
        const managerName=txt(g.encargado||profileName(g.encargado_id)||'-');
        const search=norm([g.codigo,g.nombre,managerName,...agencies.map(a=>a.numero)].join(' '));
        return {g,agencies,custody,serials,managerName,search};
      }).filter(x=>(!q||x.search.includes(q))&&(!manager||norm(x.managerName)===manager));
      const htmlRows=rowsData.map(x=>'<tr><td><span class="group-color-dot-v82" style="background:'+esc(x.g.color||'#f0c243')+'"></span></td><td><span class="group-name-chip"><i class="fas fa-layer-group"></i>'+esc(groupLabel(x.g))+'</span></td><td><span class="group-manager-name">'+esc(x.managerName)+'</span></td><td><span class="group-metric-pill">'+x.agencies.length+'</span></td><td><span class="group-metric-pill group-custody-pill">'+x.custody+'</span></td><td><span class="group-metric-pill group-serial-pill">'+x.serials+'</span></td><td><div class="group-admin-actions-cell"><button class="group-action-btn" type="button" onclick="lotekaGroupInventoryV603.open(\''+esc(x.g.id)+'\')" title="Consultar"><i class="fas fa-eye"></i></button><button class="group-action-btn" type="button" onclick="lotekaGroupInventoryV603.edit(\''+esc(x.g.id)+'\')" title="Editar"><i class="fas fa-pen"></i></button></div></td></tr>');
      if(typeof window.lotekaRenderPaginatedRows==='function')window.lotekaRenderPaginatedRows('tabla-grupos',htmlRows,{colspan:7,emptyMessage:'No hay grupos registrados con esos filtros.',defaultPageSize:10});else tbody.innerHTML=htmlRows.join('')||'<tr><td colspan="7" class="group-empty">No hay grupos.</td></tr>';
      const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v);};set('dashTotalGrupos',state.grupos.length);set('dashAgenciasGrupos',state.agencias.length);set('dashCustodiaGrupos',rowsData.reduce((s,x)=>s+x.custody,0));
    }catch(error){tbody.innerHTML='<tr><td colspan="7" class="group-empty">No se pudo cargar el inventario de grupos: '+esc(friendly(error))+'</td></tr>';}
  }

  async function openGroup(id){
    await loadDestinationData(true);const g=groupInfo(id);if(!g)return toast('Grupos','No se encontró el grupo.','error');state.currentGroupId=g.id;
    const agencies=state.agencias.filter(a=>txt(a.grupo_id)===txt(g.id));
    const inv=state.inventarioGrupo.filter(r=>txt(r.grupo_id)===txt(g.id)&&activeInventory(r));
    const equipment=state.equipos.filter(r=>txt(r.ubicacion_tipo)==='GRUPO'&&txt(r.grupo_id)===txt(g.id)&&r.activo!==false);
    const eqMap=mapBy(equipment),represented=new Set(inv.map(r=>txt(r.serial_id)).filter(Boolean));
    const rows=inv.map(r=>({inventory:r,equipment:eqMap.get(txt(r.serial_id))||null,product:productInfo(r.producto_id)}));
    equipment.filter(e=>!represented.has(txt(e.id))).forEach(e=>rows.push({inventory:{grupo_id:g.id,producto_id:e.producto_id,serial_id:e.id,cantidad:1,estado:'ACTIVO',encargado_nombre:e.responsable,fecha_recepcion:e.actualizado_en,observaciones:e.observaciones},equipment:e,product:productInfo(e.producto_id)}));
    const manager=txt(g.encargado||profileName(g.encargado_id)||'-'),custody=rows.filter(x=>x.inventory.encargado_id||txt(x.inventory.encargado_nombre)||txt(x.equipment&&x.equipment.responsable)).reduce((s,x)=>s+num(x.inventory.cantidad||1),0),serialCount=new Set(equipment.map(e=>txt(e.id))).size;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v);};set('detalleGrupoTitulo','Detalle de grupo');set('detalleGrupoNombre',groupLabel(g));set('detalleGrupoEncargado',manager);set('detalleGrupoFlota','-');set('detalleGrupoExtension','-');set('detalleGrupoCorreo',g.correo||'-');set('detalleGrupoAgencias',agencies.length);set('detalleGrupoCustodia',custody);set('detalleGrupoSeriales',serialCount);const color=document.getElementById('detalleGrupoColor');if(color)color.style.background=g.color||'#f0c243';
    const agencyBox=document.getElementById('detalleGrupoAgenciasList');if(agencyBox)agencyBox.innerHTML=agencies.length?agencies.map(a=>'<span class="group-agency-chip"><i class="fas fa-store"></i><b>'+esc(String(a.numero||'').padStart(4,'0'))+'</b><small>'+esc(groupLabel(g))+'</small></span>').join(''):'<div class="group-empty">Este grupo no tiene agencias asignadas.</div>';
    const body=document.getElementById('detalleGrupoCustodiaBody');if(body){const head=body.closest('table')&&body.closest('table').querySelector('thead tr');if(head)head.innerHTML='<th>Producto</th><th>Serial / cantidad</th><th>Custodio</th><th>Estado</th><th>Despacho</th><th>Fecha</th>';body.innerHTML=rows.length?rows.map(x=>'<tr><td><b>'+esc(x.product.nombre||x.product.codigo||x.inventory.producto_id)+'</b><br><small>'+esc(x.product.categoria||'Inventario')+'</small></td><td>'+esc(x.equipment&&x.equipment.serial?x.equipment.serial:'Cantidad: '+num(x.inventory.cantidad))+'</td><td>'+esc(x.inventory.encargado_nombre||profileName(x.inventory.encargado_id)||x.equipment&&x.equipment.responsable||'Inventario del grupo')+'</td><td>'+esc(x.inventory.estado||x.equipment&&x.equipment.estado||'ACTIVO')+'</td><td>'+esc(dispatchCode(x.inventory.despacho_id)||'-')+'</td><td>'+esc(fmt(x.inventory.fecha_recepcion||x.inventory.creado_en||x.equipment&&x.equipment.actualizado_en))+'</td></tr>').join(''):'<tr><td colspan="6" class="group-empty">No hay inventario real para este grupo.</td></tr>';}
    const modal=document.getElementById('modalDetalleGrupo');if(modal)modal.style.display='flex';
  }
  function editGroup(id){const g=groupInfo(id),idx=g?localGroupIndex(g):-1;if(idx>=0&&typeof window.editarGrupo==='function')window.editarGrupo(idx);else toast('Editar grupo','No se encontró la copia local compatible para editar este grupo.','warning');}
  async function assignSerialGroup(){const input=document.getElementById('grupoSerialRapido'),serial=txt(input&&input.value);if(!state.currentGroupId)return toast('Grupo','Abre primero el detalle de un grupo.','warning');if(!serial)return toast('Serial','Escribe o escanea un serial.','warning');try{await rpc('rpc_inventario_asignar_serial_destino',{p_serial:serial,p_destino_tipo:'GRUPO',p_destino_id:state.currentGroupId,p_encargado_id:null,p_observaciones:'Asignado administrativamente desde Inventario de Grupo.'});if(input)input.value='';toast('Inventario de grupo','El serial fue movido correctamente al grupo.','success');await loadDestinationData(true);await renderGroups(true);await openGroup(state.currentGroupId);}catch(error){toast('No se pudo asignar',friendly(error),'error');}}

  // --------------------------------------------------------------------------
  // FICHA TÉCNICA DE AGENCIA
  // --------------------------------------------------------------------------
  function agencyNumberFromDom(){const candidates=['detalleAgenciaGoCodigo','detalleAgenciaNumero','agencyFieldNumero','detalleAgenciaNombre'];for(const id of candidates){const el=document.getElementById(id),m=txt(el&&(el.value!==undefined?el.value:el.textContent)).match(/\d+/);if(m)return String(Number(m[0]));}return '';}
  async function resolveCurrentAgency(){await loadDestinationData(false);let idx=-1;try{idx=Number(window.agenciaDetalleActualIndex);}catch(_e){}const local=arr(window.agencias)[idx]||{};for(const v of [local.supabaseId,local.id_supabase,local.agencia_id,local.id])if(uuid(v)){const a=state.agencias.find(x=>txt(x.id)===txt(v));if(a)return a;}const wanted=agencyNumberFromDom()||String(Number(txt(local.numero||local.codigo).replace(/\D/g,''))||'');return state.agencias.find(a=>String(Number(txt(a.numero).replace(/\D/g,''))||'')===wanted)||null;}
  function agencyCategory(product){const t=norm([product.categoria,product.tipo_producto,product.nombre,product.codigo].join(' '));if(t.includes('CAMARA'))return 'camara';if(t.includes('ROUTER')||t.includes('WIFI')||t.includes('RED'))return 'routers';if(t.includes('ELECT')||t.includes('BATER')||t.includes('UPS')||t.includes('FUENTE'))return 'electricos';if(t.includes('ADICIONAL'))return 'adicional';return 'equipos';}
  async function renderAgency(force){
    const body=document.getElementById('detalleAgenciaInventarioBody');if(!body)return;body.innerHTML='<tr><td colspan="8" class="ltk-v603-group-loading"><i class="fas fa-spinner fa-spin"></i> Cargando ficha técnica real...</td></tr>';
    try{
      await loadDestinationData(force);const agency=await resolveCurrentAgency();if(!agency)throw new Error('No se pudo identificar la agencia abierta.');state.currentAgencyId=agency.id;
      const equipment=state.equipos.filter(e=>txt(e.ubicacion_tipo)==='AGENCIA'&&txt(e.agencia_id)===txt(agency.id)&&e.activo!==false),activeInv=state.inventarioAgencia.filter(r=>txt(r.agencia_id)===txt(agency.id)&&norm(r.estado)==='ACTIVO'),eqMap=mapBy(equipment),latestBySerial=new Map();activeInv.filter(r=>r.serial_id).forEach(r=>{if(!latestBySerial.has(txt(r.serial_id)))latestBySerial.set(txt(r.serial_id),r);});
      const records=equipment.map(e=>({product:productInfo(e.producto_id),equipment:e,inventory:latestBySerial.get(txt(e.id))||null,quantity:1}));
      const nonSerial=new Map();activeInv.filter(r=>!r.serial_id).forEach(r=>{const k=txt(r.producto_id);if(!nonSerial.has(k))nonSerial.set(k,{product:productInfo(k),equipment:null,inventory:r,quantity:0});nonSerial.get(k).quantity+=num(r.cantidad);});records.push(...nonSerial.values());
      const current=window.agenciaTabActual||'equipos',shown=records.filter(r=>agencyCategory(r.product)===current),head=body.closest('table')&&body.closest('table').querySelector('thead tr');if(head)head.innerHTML='<th>#</th><th>Producto</th><th>Tipo</th><th>Categoría</th><th>Serial / cantidad</th><th>Estado</th><th>Despacho</th><th>Fecha</th>';
      body.innerHTML=shown.length?shown.map((r,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(r.product.nombre||r.product.codigo||'Producto')+'</b></td><td>'+esc(r.equipment?'Serializado':'No serializado')+'</td><td>'+esc(r.product.categoria||r.product.tipo_producto||'Inventario')+'</td><td><b>'+esc(r.equipment?r.equipment.serial:'Cantidad: '+r.quantity)+'</b></td><td>'+esc(r.equipment?r.equipment.estado:r.inventory&&r.inventory.estado||'ACTIVO')+'</td><td>'+esc(dispatchCode(r.inventory&&r.inventory.despacho_id)||'-')+'</td><td>'+esc(fmt(r.inventory&&r.inventory.fecha_recepcion||r.inventory&&r.inventory.creado_en||r.equipment&&r.equipment.actualizado_en))+'</td></tr>').join(''):'<tr><td colspan="8" style="text-align:center;color:#8aa0af;font-weight:850;padding:24px">No hay inventario en esta categoría para la agencia.</td></tr>';
      const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v);};set('detalleAgenciaEquipos',records.reduce((s,r)=>s+num(r.quantity),0));set('detalleAgenciaSeriales',equipment.length);set('detalleAgenciaCamaras',records.filter(r=>agencyCategory(r.product)==='camara').reduce((s,r)=>s+num(r.quantity),0));set('detalleAgenciaRouters',records.filter(r=>agencyCategory(r.product)==='routers').reduce((s,r)=>s+num(r.quantity),0));
      const banner=document.getElementById('agencyFichaSyncBannerV141');if(banner)banner.innerHTML='<i class="fas fa-database"></i><div><strong>Ficha técnica conectada al inventario real</strong><span>Agencia '+esc(agency.numero)+' · seriales desde equipos_seriales y cantidades desde inventario_agencia.</span></div>';
    }catch(error){body.innerHTML='<tr><td colspan="8" style="text-align:center;color:#b42318;font-weight:900;padding:24px">'+esc(friendly(error))+'</td></tr>';}
  }
  async function assignSerialAgency(){if(typeof window.lotekaHasPermission==='function'&&!window.lotekaHasPermission('editar_ficha_tecnica_agencia'))return toast('Ficha técnica','Tu perfil puede consultar la ficha técnica, pero no modificarla.','warning');const input=document.getElementById('buscarSerialAgencia'),serial=txt(input&&input.value);if(!serial)return toast('Serial','Escribe o escanea un serial.','warning');try{const agency=await resolveCurrentAgency();if(!agency)throw new Error('No se pudo identificar la agencia.');await rpc('rpc_inventario_asignar_serial_destino',{p_serial:serial,p_destino_tipo:'AGENCIA',p_destino_id:agency.id,p_encargado_id:null,p_observaciones:'Asignado administrativamente desde la ficha técnica de la agencia.'});if(input)input.value='';toast('Ficha técnica','El serial fue asignado correctamente a la agencia.','success');await loadDestinationData(true);await renderAgency(true);await renderGroups(true);}catch(error){toast('No se pudo asignar',friendly(error),'error');}}
  function changeAgencyTab(cat,button){window.agenciaTabActual=cat;document.querySelectorAll('.agency-tab').forEach(b=>b.classList.remove('active'));if(button)button.classList.add('active');renderAgency(false);}

  // --------------------------------------------------------------------------
  // REFRESCO GENERAL Y CONEXIONES CON EL MONOLITO
  // --------------------------------------------------------------------------
  async function refreshEverything(force){
    state.loadedAt=0;
    try{if(typeof window.lotekaRenderControlDespachos==='function')await window.lotekaRenderControlDespachos();}catch(_e){}
    try{await loadDestinationData(force);}catch(_e){}
    try{await renderGroups(false);}catch(_e){}
    try{await renderAgency(false);}catch(_e){}
    try{if(typeof window.renderAlmacenes==='function')window.renderAlmacenes();}catch(_e){}
    try{if(typeof window.renderTransferencias==='function')window.renderTransferencias();}catch(_e){}
  }

  function installDispatchInterceptors(){
    const root=document.getElementById('dspxModule');if(!root||root.__v603Intercept)return;root.__v603Intercept=true;
    root.addEventListener('click',event=>{const button=event.target.closest('[data-action="confirm-exit"]');if(!button)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openDirectExit(txt(button.dataset.id));},true);
    const content=document.getElementById('dspxContent');if(content){const observer=new MutationObserver(()=>injectIncidentButton());observer.observe(content,{childList:true,subtree:true});injectIncidentButton();}
  }
  function normalizeDispatchUi(){
    document.querySelectorAll('#dspxModule [data-dspx-tab="recepcion"],#dspxModule [data-action="open-partial"],#dspxModule [data-action="receive-complete"]').forEach(el=>el.remove());
    const received=document.getElementById('dspxKpiReceived');if(received&&received.parentElement){const label=received.parentElement.querySelector('span');if(label)label.textContent='Finalizados';received.parentElement.dataset.dspxTab='historial';}
    const transit=document.getElementById('dspxKpiTransit');if(transit&&transit.parentElement)transit.parentElement.remove();
  }

  window.lotekaGroupInventoryV603={open:openGroup,edit:editGroup,refresh:()=>renderGroups(true)};
  window.renderGrupos=function(){return renderGroups(false);};
  window.verDetalleGrupo=function(id){if(typeof id==='number'){const local=arr(window.grupos)[id];const real=state.grupos.find(g=>[local&&local.id,local&&local.supabaseId,local&&local.grupo_id].some(v=>txt(v)===txt(g.id))||norm(local&&local.codigo)===norm(g.codigo)||norm(local&&local.nombre)===norm(g.nombre));return real?openGroup(real.id):renderGroups(true);}return openGroup(id);};
  window.agregarSerialRapidoGrupo=assignSerialGroup;
  window.renderDetalleAgenciaInventario=function(){return renderAgency(false);};
  window.lotekaRenderAgenciaInventarioRealV141=function(){return renderAgency(false);};
  window.agregarSerialRapidoAgencia=assignSerialAgency;
  window.lotekaAgregarSerialAgenciaRealV141=assignSerialAgency;
  window.cambiarTabAgencia=changeAgencyTab;
  window.lotekaRefreshDestinationInventoriesV603=refreshEverything;
  try{renderGrupos=window.renderGrupos;verDetalleGrupo=window.verDetalleGrupo;agregarSerialRapidoGrupo=assignSerialGroup;renderDetalleAgenciaInventario=window.renderDetalleAgenciaInventario;agregarSerialRapidoAgencia=assignSerialAgency;cambiarTabAgencia=changeAgencyTab;}catch(_e){}

  const previousAgencyOpen=window.verDetalleAgencia;
  if(typeof previousAgencyOpen==='function'&&!previousAgencyOpen.__v603){const wrapped=function(){const result=previousAgencyOpen.apply(this,arguments);setTimeout(()=>renderAgency(true),1100);setTimeout(()=>renderAgency(false),1800);return result;};wrapped.__v603=true;window.verDetalleAgencia=wrapped;try{verDetalleAgencia=wrapped;}catch(_e){}}

  function boot(){normalizeDispatchUi();installDispatchInterceptors();loadDestinationData(true).then(()=>{renderGroups(false);if(document.getElementById('detalleAgenciaInventarioBody'))renderAgency(false);}).catch(error=>console.warn('[LOTEKA '+VERSION+']',error));setTimeout(()=>{normalizeDispatchUi();installDispatchInterceptors();},1200);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.addEventListener('load',()=>setTimeout(boot,600));
  console.info('[LOTEKA]',VERSION,'Entrega directa e inventarios de destino instalados.');
})();


(function(){
  'use strict';

  const state = {
    almacenes: [],
    agencias: [],
    grupos: [],
    productos: [],
    seriales: [],
    catalogsLoaded: false,
    currentAgency: null,
    currentLocal: null
  };

  function sb(){ return window.lotekaSupabase || null; }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
  function txt(v){ return String(v ?? '').trim(); }
  function norm(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' '); }
  function digits(v){ return txt(v).replace(/\D+/g,''); }
  function pad4(v){ const d=digits(v); return d ? d.padStart(4,'0') : ''; }
  function noPad(v){ const d=digits(v); return d ? String(Number(d)) : ''; }
  function uuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '')); }
  function nowIso(){ return new Date().toISOString(); }
  function getUserId(){
    const candidates = [window.currentUserId, window.userIdActual, window.usuarioActualId, window.lotekaAuthState && window.lotekaAuthState.user && window.lotekaAuthState.user.id];
    for(const c of candidates){ if(uuid(c)) return String(c); }
    return null;
  }
  function getUserName(){
    return txt(window.currentUserEmail || window.usuarioActualEmail || window.usuarioActualNombre || window.usuarioNombre ||
      ((document.querySelector('.user-chip, .user-name, #currentUserName') || {}).textContent)) || 'Usuario';
  }
  function getAgenciasLocal(){ try{ if(Array.isArray(agencias)) return agencias; }catch(e){} return Array.isArray(window.agencias) ? window.agencias : []; }
  function currentIndex(){
    try{ if(typeof agenciaDetalleActualIndex !== 'undefined' && agenciaDetalleActualIndex !== null) return Number(agenciaDetalleActualIndex); }catch(e){}
    try{ if(window.agenciaDetalleActualIndex !== undefined && window.agenciaDetalleActualIndex !== null) return Number(window.agenciaDetalleActualIndex); }catch(e){}
    return -1;
  }
  function domText(id){ const el=document.getElementById(id); return txt(el && (el.value !== undefined ? el.value : el.textContent)); }
  function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=String(v); }

  function getLocalAgency(){
    const idx=currentIndex();
    const list=getAgenciasLocal();
    const local=(Number.isInteger(idx) && idx>=0 && list[idx]) ? list[idx] : {};
    return Object.assign({}, local || {}, {
      __localIndex: idx,
      __domTitle: domText('detalleAgenciaNombre'),
      __domGo: domText('detalleAgenciaGoCodigo'),
      __domLtk: domText('detalleAgenciaLtkCodigo'),
      __domGrupo: domText('detalleAgenciaGrupoCodigo'),
      __fieldNumero: domText('agencyFieldNumero'),
      __fieldGo: domText('agencyFieldGo'),
      __fieldLtk: domText('agencyFieldLtk'),
      __fieldGrupo: domText('agencyFieldGrupo'),
      __fieldDireccion: domText('agencyFieldDireccion'),
      __fieldEncargado: domText('agencyFieldEncargado')
    });
  }

  function localNumber(local){
    const candidates = [
      local && local.numero,
      local && local.codigo,
      local && local.no_agencia,
      local && local.id_agencia,
      local && local.agencia,
      local && local.__fieldNumero,
      local && local.__domGo,
      local && local.__fieldGo,
      local && local.__domLtk,
      local && local.__fieldLtk,
      local && local.nombre,
      local && local.__domTitle
    ];
    for(const c of candidates){ const p=pad4(c); if(p) return p; }
    return '';
  }
  function groupCode(v){ const d=digits(v); return d ? d.padStart(2,'0') : '00'; }
  function agencyName(rowOrLocal){
    const n = rowOrLocal && (rowOrLocal.numero || rowOrLocal.codigo || rowOrLocal.no_agencia || rowOrLocal.__fieldNumero || localNumber(rowOrLocal));
    const name = rowOrLocal && (rowOrLocal.nombre || rowOrLocal.nombre_agencia || rowOrLocal.__domTitle);
    if(name && norm(name).includes('AGENCIA')) return txt(name);
    if(n) return 'Agencia ' + pad4(n);
    return txt(name) || 'Agencia';
  }

  async function ensureCatalogs(force){
    const client=sb();
    if(!client) throw new Error('Supabase no está disponible.');
    if(state.catalogsLoaded && !force) return;
    const [al, ag, gr, pr] = await Promise.all([
      client.from('almacenes').select('*').limit(2000),
      client.from('agencias').select('*').limit(30000),
      client.from('grupos').select('*').limit(3000),
      client.from('productos').select('*').limit(30000)
    ]);
    if(al.error) console.warn('[Agencias v141] almacenes', al.error); else state.almacenes=al.data||[];
    if(ag.error) console.warn('[Agencias v141] agencias', ag.error); else state.agencias=ag.data||[];
    if(gr.error) console.warn('[Agencias v141] grupos', gr.error); else state.grupos=gr.data||[];
    if(pr.error) console.warn('[Agencias v141] productos', pr.error); else state.productos=pr.data||[];
    state.catalogsLoaded=true;
  }

  function setLocalAgencyId(id){
    try{
      const idx=currentIndex(); const list=getAgenciasLocal();
      if(Number.isInteger(idx) && idx>=0 && list[idx]){
        list[idx].supabaseId=id; list[idx].id_supabase=id; list[idx].agencia_id=id;
      }
    }catch(e){}
  }

  function matchAgency(local){
    const direct=[local && local.supabaseId, local && local.id_supabase, local && local.agencia_id].filter(uuid);
    for(const id of direct){ const f=state.agencias.find(a=>String(a.id)===String(id)); if(f) return f; }
    const n = localNumber(local);
    if(n){
      const candidates = new Set([n, String(Number(n)), n.padStart(4,'0')]);
      for(const row of state.agencias){
        const rowNums = [row.numero,row.codigo,row.no_agencia,row.id_agencia,row.agencia,row.nombre,row.nombre_agencia].map(x=>pad4(x)).filter(Boolean);
        if(rowNums.some(x=>candidates.has(x) || candidates.has(String(Number(x))))) return row;
      }
    }
    const wanted = norm(local && (local.__domTitle || local.nombre || local.nombre_agencia));
    if(wanted){
      for(const row of state.agencias){
        const hay = norm([row.numero,row.codigo,row.nombre,row.nombre_agencia,row.direccion].filter(Boolean).join(' '));
        if(hay && (hay === wanted || hay.includes(wanted) || wanted.includes(hay))) return row;
      }
    }
    return null;
  }

  async function ensureGroupForAgency(local){
    const client=sb();
    const raw = (local && (local.__fieldGrupo || local.__domGrupo || local.grupo || local.grupo_codigo || local.grupoNombre)) || 'Grupo 00';
    const codigo=groupCode(raw);
    let found = state.grupos.find(g => String(g.codigo || '').padStart(2,'0') === codigo || norm(g.nombre).includes('GRUPO '+codigo));
    if(found) return found;
    const q = await client.from('grupos').select('*').or(`codigo.eq.${codigo},nombre.ilike.%${codigo}%`).limit(1).maybeSingle();
    if(!q.error && q.data){ state.grupos.push(q.data); return q.data; }
    const payload = {codigo, nombre: codigo === '00' ? 'DESACTIVADAS/CERRADAS' : ('Grupo '+codigo), encargado: txt(local && (local.encargado || local.__fieldEncargado)) || null, activo:true};
    const uid=getUserId(); if(uid){ payload.creado_por=uid; payload.actualizado_por=uid; }
    const ins = await client.from('grupos').insert(payload).select('*').single();
    if(ins.error){ console.warn('[Agencias v141] No se pudo crear grupo, se continuará sin grupo_id', ins.error); return null; }
    state.grupos.push(ins.data); return ins.data;
  }

  async function resolveOrCreateAgency(){
    await ensureCatalogs(false);
    const local=getLocalAgency();
    let real=matchAgency(local);
    if(real){ setLocalAgencyId(real.id); state.currentAgency=real; state.currentLocal=local; return real; }

    const numero=localNumber(local);
    if(!numero) throw new Error('No se pudo detectar el número de esta agencia para vincularla a Supabase.');
    const client=sb();
    const grupo=await ensureGroupForAgency(local);
    const uid=getUserId();
    const payload={
      numero: numero,
      nombre: 'Agencia ' + numero,
      tipo: 'Agencia normal',
      estado: 'Activa',
      direccion: txt(local.__fieldDireccion || local.direccion || local.__domTitle) || ('Agencia ' + numero),
      latitud: Number(local.lat || local.latitud) || null,
      longitud: Number(local.lng || local.longitud) || null,
      activo: true
    };
    if(grupo && grupo.id) payload.grupo_id=grupo.id;
    if(uid){ payload.creado_por=uid; payload.actualizado_por=uid; }
    const ins=await client.from('agencias').insert(payload).select('*').single();
    if(ins.error) throw ins.error;
    state.agencias.push(ins.data); setLocalAgencyId(ins.data.id); state.currentAgency=ins.data; state.currentLocal=local; return ins.data;
  }

  function productoInfo(row){
    const p = row && (row.productos || row.producto || row.__producto || {});
    const found = row && row.producto_id ? state.productos.find(x => String(x.id)===String(row.producto_id)) : null;
    return found || p || {};
  }
  function productName(row){ const p=productoInfo(row); return p.nombre || p.codigo || row.producto_nombre || row.producto || 'Producto sin nombre'; }
  function productCat(row){ const p=productoInfo(row); return p.categoria || row.categoria || 'Equipos'; }
  function productMarca(row){ const p=productoInfo(row); return p.marca || row.marca || ''; }
  function productModelo(row){ const p=productoInfo(row); return p.modelo || row.modelo || ''; }
  function categoria(row){
    const t=norm([productCat(row), productName(row), productMarca(row), productModelo(row)].join(' '));
    if(t.includes('CAMARA') || t.includes('CAM')) return 'camara';
    if(t.includes('ROUTER') || t.includes('WIFI') || t.includes('RED')) return 'routers';
    if(t.includes('UPS') || t.includes('ELECT') || t.includes('BATER') || t.includes('FUENTE')) return 'electricos';
    if(t.includes('ADICIONAL')) return 'adicional';
    return 'equipos';
  }

  async function attachProducts(rows){
    await ensureCatalogs(false);
    return (rows||[]).map(r=>{
      if(!r.productos && r.producto_id){ r.__producto = state.productos.find(p=>String(p.id)===String(r.producto_id)) || null; }
      return r;
    });
  }

  async function loadAgencySerials(agencyId){
    const client=sb();
    const res=await client.from('equipos_seriales').select('*').eq('ubicacion_tipo','AGENCIA').eq('agencia_id',agencyId).eq('activo',true).order('actualizado_en',{ascending:false});
    if(res.error) throw res.error;
    return attachProducts(res.data || []);
  }

  function updateCounters(rows){
    const all=Array.isArray(rows)?rows:[];
    setText('detalleAgenciaEquipos', all.length);
    setText('detalleAgenciaSeriales', all.filter(r=>txt(r.serial)).length);
    setText('detalleAgenciaCamaras', all.filter(r=>categoria(r)==='camara').length);
    setText('detalleAgenciaRouters', all.filter(r=>categoria(r)==='routers').length);
  }

  function renderRows(rows){
    const body=document.getElementById('detalleAgenciaInventarioBody');
    if(!body) return;
    const cat = window.agenciaTabActual || (typeof agenciaTabActual !== 'undefined' ? agenciaTabActual : 'equipos') || 'equipos';
    const data=(rows||[]).filter(r=>categoria(r)===cat);
    const table=body.closest('table');
    const head=table && table.querySelector('thead tr');
    if(head) head.innerHTML='<th>#</th><th>Producto</th><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Serial / Estado</th><th>Ubicación</th><th>Acción</th>';
    if(!data.length){
      body.innerHTML='<tr><td colspan="8" style="text-align:center;color:#8aa0af;font-weight:800;padding:24px">No hay equipos registrados en esta categoría para esta agencia.</td></tr>';
      return;
    }
    body.innerHTML=data.map((r,i)=>`
      <tr>
        <td>${i+1}</td>
        <td><strong>${esc(productName(r))}</strong><br><small>Producto real · ${esc(productCat(r))}</small></td>
        <td><span class="agency-tech-icon"><i class="fas fa-warehouse"></i></span></td>
        <td>${esc(productMarca(r) || '-')}</td>
        <td>${esc(productModelo(r) || '-')}</td>
        <td><strong>${esc(r.serial || '-')}</strong><br><small>${esc(r.estado || '')} · ${esc(r.condicion || '')}</small></td>
        <td><strong>AGENCIA</strong><br><small>${esc(agencyName(state.currentAgency || {}))}</small></td>
        <td class="actions"><i class="fas fa-eye" title="Consultar equipo" onclick="alert('Serial: ${esc(r.serial || '-')}\\nProducto: ${esc(productName(r))}\\nEstado: ${esc(r.estado || '')}\\nCondición: ${esc(r.condicion || '')}\\nUbicación: Agencia')"></i></td>
      </tr>`).join('');
  }

  async function renderAgencyInventory(){
    const body=document.getElementById('detalleAgenciaInventarioBody');
    if(!body) return;
    body.innerHTML='<tr><td colspan="8" style="text-align:center;color:#8aa0af;font-weight:800;padding:18px">Sincronizando ficha técnica con Supabase...</td></tr>';
    try{
      const ag=await resolveOrCreateAgency();
      const rows=await loadAgencySerials(ag.id);
      state.seriales=rows;
      try{
        const idx=currentIndex(); const list=getAgenciasLocal();
        if(Number.isInteger(idx) && idx>=0 && list[idx]){
          list[idx].supabaseId=ag.id; list[idx].agencia_id=ag.id;
          list[idx].equipos=rows.map(r=>({id:r.id, producto:productName(r), categoria:categoria(r), marca:productMarca(r), modelo:productModelo(r), serial:r.serial, fechaInstalacion:(r.actualizado_en||r.creado_en||'').slice(0,10), producto_id:r.producto_id, supabaseSerialId:r.id}));
        }
      }catch(e){}
      updateCounters(rows); renderRows(rows);
      addSyncBanner(true, ag);
    }catch(err){
      console.error('[Agencias v141] Error sincronizando ficha técnica:', err);
      body.innerHTML='<tr><td colspan="8" style="text-align:center;color:#b45309;background:#fff7ed;font-weight:900;padding:24px">No se pudo sincronizar esta agencia con Supabase: '+esc(err.message || err)+'</td></tr>';
    }
  }

  function addSyncBanner(ok, ag){
    const card=document.querySelector('[data-section="ficha"] .agency-form-card-body');
    if(!card) return;
    let b=document.getElementById('agencyFichaSyncBannerV141');
    if(!b){
      b=document.createElement('div'); b.id='agencyFichaSyncBannerV141';
      card.insertBefore(b, card.firstChild);
    }
    b.className='agency-ficha-sync-banner-v141';
    b.innerHTML = ok
      ? `<i class="fas fa-database"></i><div><strong>Ficha técnica sincronizada como inventario de agencia</strong><span>Esta agencia funciona como ubicación real: equipos_seriales.ubicacion_tipo = AGENCIA · agencia_id = ${esc((ag&&ag.id)||'')}</span></div>`
      : `<i class="fas fa-triangle-exclamation"></i><div><strong>Ficha no sincronizada</strong><span>Guarda o vincula esta agencia con Supabase para usarla como ubicación de inventario.</span></div>`;
  }

  async function findSerial(serial){
    const client=sb(); const s=txt(serial);
    let res=await client.from('equipos_seriales').select('*').eq('serial',s).limit(1).maybeSingle();
    if(res.error && res.error.code !== 'PGRST116') throw res.error;
    if(res.data) return res.data;
    res=await client.from('equipos_seriales').select('*').ilike('serial',s).limit(1).maybeSingle();
    if(res.error && res.error.code !== 'PGRST116') throw res.error;
    return res.data || null;
  }

  function origen(row){
    const tipo=norm(row && row.ubicacion_tipo);
    if(tipo==='AGENCIA'){
      const a=state.agencias.find(x=>String(x.id)===String(row.agencia_id));
      return {tipo:'AGENCIA', id:row.agencia_id||null, nombre:a?agencyName(a):'Agencia anterior'};
    }
    if(tipo==='ALMACEN'){
      const a=state.almacenes.find(x=>String(x.id)===String(row.almacen_id));
      return {tipo:'ALMACEN', id:row.almacen_id||null, nombre:a?(a.nombre||a.codigo||'Almacén'):'Almacén anterior'};
    }
    if(tipo==='GRUPO'){
      const g=state.grupos.find(x=>String(x.id)===String(row.grupo_id));
      return {tipo:'GRUPO', id:row.grupo_id||null, nombre:g?(g.nombre||g.codigo||'Grupo'):'Grupo anterior'};
    }
    return {tipo:'ORIGEN', id:null, nombre:'Ubicación anterior no especificada'};
  }

  async function addSerialToAgency(){
    const client=sb(); if(!client) return alert('Supabase no está disponible.');
    const input=document.getElementById('buscarSerialAgencia'); const serial=txt(input && input.value);
    if(!serial) return alert('Escribe o escanea un serial.');
    try{
      const ag=await resolveOrCreateAgency();
      const row=await findSerial(serial);
      if(!row) return alert('Ese serial no existe en equipos_seriales. Primero debe registrarse como equipo real.');
      if(!row.producto_id) return alert('Ese serial existe, pero no tiene producto_id. Vincúlalo a un producto real antes de asignarlo a una agencia.');
      await ensureCatalogs(false);
      const org=origen(row); const uid=getUserId(); const usuario=getUserName(); const destino=agencyName(ag);
      if(norm(row.ubicacion_tipo)==='AGENCIA' && String(row.agencia_id)===String(ag.id)){
        if(input) input.value=''; await renderAgencyInventory(); return alert('Ese serial ya está asignado a esta agencia.');
      }
      const up={ubicacion_tipo:'AGENCIA', agencia_id:ag.id, almacen_id:null, grupo_id:null, estado:'En uso', condicion:['Nuevo','Bueno','Regular','Dañado','Reparado','Para baja'].includes(txt(row.condicion))?txt(row.condicion):'Bueno', responsable:destino, activo:true, observaciones:`[Ficha técnica agencia] Asignado a ${destino}. Origen: ${org.nombre}. Usuario: ${usuario}.`};
      if(uid) up.actualizado_por=uid;
      const upd=await client.from('equipos_seriales').update(up).eq('id',row.id).select('id,serial,ubicacion_tipo,agencia_id').single();
      if(upd.error) throw upd.error;
      const mv={tipo_movimiento:'Transferencia', serial_id:row.id, producto_id:row.producto_id, origen_tipo:org.tipo, origen_id:org.id?String(org.id):null, origen_nombre:org.nombre, destino_tipo:'AGENCIA', destino_id:String(ag.id), destino_nombre:destino, cantidad:1, motivo:'Asignación / instalación en agencia', observaciones:`[Ficha Técnica] Serial ${serial} asignado a ${destino}. Origen: ${org.nombre}. Usuario: ${usuario}.`, usuario_nombre:usuario, creado_en:nowIso()};
      if(uid) mv.creado_por=uid;
      const ins=await client.from('movimientos_inventario').insert(mv).select('id').single();
      if(ins.error) throw ins.error;
      if(input) input.value=''; await renderAgencyInventory();
      try{ if(typeof window.renderTransferencias === 'function') await window.renderTransferencias(); }catch(e){}
      alert('Equipo guardado correctamente en la ficha técnica como inventario real de agencia.');
    }catch(err){ console.error('[Agencias v141] No se pudo guardar equipo en agencia:', err); alert('No se pudo guardar el equipo en la agencia: '+(err.message || JSON.stringify(err))); }
  }

  function changeTab(cat, btn){
    try{ window.agenciaTabActual=cat; }catch(e){}
    try{ agenciaTabActual=cat; }catch(e){}
    document.querySelectorAll('.agency-tab').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderAgencyInventory();
  }

  function wire(){
    const input=document.getElementById('buscarSerialAgencia');
    if(input && !input.__v141){ input.__v141=true; input.onkeydown=function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); addSerialToAgency(); } }; }
    const btn=input && input.closest('.agency-quick') && input.closest('.agency-quick').querySelector('button');
    if(btn && !btn.__v141){ btn.__v141=true; btn.onclick=function(ev){ ev.preventDefault(); addSerialToAgency(); }; }
  }

  const oldVer = window.verDetalleAgencia || (typeof verDetalleAgencia === 'function' ? verDetalleAgencia : null);
  if(oldVer && !oldVer.__v141){
    const wrapped=function(i){
      try{ window.agenciaDetalleActualIndex=Number(i); }catch(e){}
      const out=oldVer.apply(this, arguments);
      setTimeout(function(){ wire(); renderAgencyInventory(); }, 250);
      setTimeout(function(){ wire(); renderAgencyInventory(); }, 900);
      return out;
    };
    wrapped.__v141=true; window.verDetalleAgencia=wrapped; try{ verDetalleAgencia=wrapped; }catch(e){}
  }

  window.renderDetalleAgenciaInventario=renderAgencyInventory;
  window.agregarSerialRapidoAgencia=addSerialToAgency;
  window.cambiarTabAgencia=changeTab;
  window.lotekaRenderAgenciaInventarioRealV141=renderAgencyInventory;
  window.lotekaAgregarSerialAgenciaRealV141=addSerialToAgency;
  try{ renderDetalleAgenciaInventario=renderAgencyInventory; agregarSerialRapidoAgencia=addSerialToAgency; cambiarTabAgencia=changeTab; }catch(e){}

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ wire(); if(document.getElementById('detalleAgenciaInventarioBody')) renderAgencyInventory(); }, 1200); });
})();

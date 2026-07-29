
(function(){
  'use strict';
  if(window.__lotekaTallerV2TransferenciasNotifFinalFix) return;
  window.__lotekaTallerV2TransferenciasNotifFinalFix = true;

  var cache = { movimientos:null, productos:null, seriales:null, loadedAt:0, rows:[] };

  function sb(){ return window.lotekaSupabase || window.supabaseClient || null; }
  function txt(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(); }
  function low(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function esc(v){ return txt(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function idOf(o){ return o && (o.id || o.uuid || o.key || ''); }
  function nowYear(){ return new Date().getFullYear(); }
  function parseDate(v){ var d=v?new Date(v):new Date(); return isFinite(d.getTime())?d:new Date(); }
  function isoDate(v){ var d=parseDate(v); return d.toISOString().slice(0,10); }
  function datePretty(v){ try{return parseDate(v).toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return txt(v);} }
  function fechaCorta(v){ try{return parseDate(v).toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return txt(v);} }

  function productName(id){
    var p=(cache.productos||[]).find(function(x){ return String(idOf(x))===String(id); });
    return p ? txt(p.nombre || p.name || p.producto || p.descripcion || 'Producto') : txt(id || 'Producto');
  }
  function productMeta(id){
    var p=(cache.productos||[]).find(function(x){ return String(idOf(x))===String(id); }) || {};
    return {nombre:txt(p.nombre || p.name || p.producto || p.descripcion || 'Producto'), marca:txt(p.marca || ''), modelo:txt(p.modelo || ''), categoria:txt(p.categoria || p.tipo_producto || p.clasificacion_operativa || '')};
  }
  function serialCode(id){
    var s=(cache.seriales||[]).find(function(x){ return String(idOf(x))===String(id); });
    return s ? txt(s.serial || s.codigo_serial || s.codigo || s.serie || id) : txt(id || 'No aplica');
  }
  function movBlob(m){ return norm([m.tipo_movimiento,m.motivo,m.observaciones,m.origen_tipo,m.origen_nombre,m.destino_tipo,m.destino_nombre].join(' ')); }
  function extractCode(m){
    var raw=[m.motivo,m.observaciones,m.destino_nombre,m.origen_nombre].map(txt).join(' ');
    var match = raw.match(/\b(?:RT|TR|TRANS|TALLER|MOV|SALI)[-_ ]?\d{4}[-_ ]?\d+\b/i);
    if(match) return match[0].replace(/\s+/g,'-').toUpperCase();
    if(m.referencia_codigo) return txt(m.referencia_codigo).toUpperCase();
    return '';
  }
  function isSalidaSistema(m){
    var b=movBlob(m);
    return b.indexOf('CONSUMO INTERNO')>=0 || b.indexOf('BAJA')>=0 || b.indexOf('SALIDA DEL SISTEMA')>=0 || b.indexOf('FUERA DEL SISTEMA')>=0;
  }
  function isTransferMovement(m){
    if(!m) return false;
    var b=movBlob(m);
    if(isSalidaSistema(m)) return false;
    if(b.indexOf('TRANSFERENCIA')>=0 || b.indexOf('RECEPCION TALLER')>=0 || b.indexOf('RECEPCION DE TALLER')>=0 || b.indexOf('ALM-TALLER')>=0) return true;
    // Movimiento entre ubicaciones/almacenes sin ser baja ni consumo interno.
    var dst=norm(m.destino_tipo), org=norm(m.origen_tipo);
    if(dst.indexOf('ALMACEN')>=0 && (org.indexOf('ALMACEN')>=0 || org.indexOf('AGENCIA')>=0 || org.indexOf('GRUPO')>=0 || org.indexOf('TECNICO')>=0)) return true;
    return false;
  }
  function itemFromMovement(m){
    var meta=productMeta(m.producto_id);
    return {producto:meta.nombre, marca:meta.marca, modelo:meta.modelo, categoria:meta.categoria, cantidad:Number(m.cantidad||1), serializado:m.serial_id?'si':'no', seriales:m.serial_id?[serialCode(m.serial_id)]:[], raw:m};
  }
  function codeForMovementGroup(m, index){
    var c=extractCode(m);
    if(c) return c;
    var y=String(parseDate(m.creado_en).getFullYear() || nowYear());
    return 'TR-'+y+'-'+String(index+1);
  }
  function buildTransferRows(){
    var groups={}; var movements=(cache.movimientos||[]).filter(isTransferMovement);
    movements.forEach(function(m,idx){
      var code=codeForMovementGroup(m, idx);
      if(!groups[code]){
        groups[code]={codigo:code, origen:txt(m.origen_nombre||m.origen_tipo||'Sin origen'), destino:txt(m.destino_nombre||m.destino_tipo||'Sin destino'), producto:'', productosResumen:'', unidades:0, fecha:fechaCorta(m.creado_en), fechaISO:isoDate(m.creado_en), fechaHora:datePretty(m.creado_en), usuario:txt(m.usuario_nombre||'Sistema'), estado:'Completada', observacion:txt(m.observaciones||m.motivo||''), items:[], raw:m, serializado:m.serial_id?'si':'no', tipoTransferencia: extractCode(m).indexOf('RT-')===0 || movBlob(m).indexOf('RECEPCION')>=0 ? 'Recepción Taller / Transferencia' : 'Transferencia de inventario' };
      }
      var item=itemFromMovement(m); groups[code].items.push(item); groups[code].unidades += Number(m.cantidad||1);
      if(!groups[code].raw || String(m.creado_en||'') < String(groups[code].raw.creado_en||'')) groups[code].raw=m;
    });
    var rows=Object.keys(groups).map(function(k){
      var r=groups[k]; var first=r.items[0]||{};
      r.producto = r.items.length===1 ? (first.producto||'Producto') : ((first.producto||'Producto')+' (+'+(r.items.length-1)+')');
      r.productosResumen = r.items.map(function(i){ return i.producto + (i.seriales&&i.seriales.length ? ' ['+i.seriales.join(', ')+']' : ' x'+i.cantidad); }).join(', ');
      r.serializado = r.items.some(function(i){return i.serializado==='si';}) ? 'si' : 'no';
      return r;
    });
    // Agrega transferencias locales legacy que no estén en movimientos.
    try{
      if(Array.isArray(window.transferenciasInventario)){
        window.transferenciasInventario.forEach(function(t){
          if(!t || !t.codigo) return;
          if(rows.some(function(r){return String(r.codigo)===String(t.codigo);})) return;
          rows.push(t);
        });
      }
    }catch(e){}
    rows.sort(function(a,b){ return String(b.fechaISO||b.fecha||'').localeCompare(String(a.fechaISO||a.fecha||'')); });
    cache.rows=rows;
    return rows;
  }
  async function loadTransferData(force){
    var c=sb();
    if(!c) return buildTransferRows();
    if(!force && cache.movimientos && Date.now()-cache.loadedAt < 25000) return buildTransferRows();
    try{
      var q1=await c.from('movimientos_inventario').select('*').order('creado_en',{ascending:false}).limit(2500);
      cache.movimientos = q1.error ? [] : (q1.data||[]);
    }catch(e){ cache.movimientos=cache.movimientos||[]; }
    try{ var q2=await c.from('productos').select('*').limit(2500); cache.productos=q2.error?[]:(q2.data||[]); }catch(e){ cache.productos=cache.productos||[]; }
    try{ var q3=await c.from('equipos_seriales').select('*').limit(2500); cache.seriales=q3.error?[]:(q3.data||[]); }catch(e){ cache.seriales=cache.seriales||[]; }
    cache.loadedAt=Date.now();
    return buildTransferRows();
  }
  function updateTransferSelects(rows){
    function fill(id, values){
      var el=document.getElementById(id); if(!el) return;
      var current=el.value;
      var label=id.indexOf('Producto')>=0?'Todos':'Todos';
      el.innerHTML='<option value="">'+label+'</option>'+Array.from(new Set(values.filter(Boolean))).sort().map(function(v){ return '<option value="'+esc(v)+'">'+esc(v)+'</option>'; }).join('');
      if(current) el.value=current;
    }
    fill('filtroTransferenciaOrigen', rows.map(function(r){return r.origen;}));
    fill('filtroTransferenciaDestino', rows.map(function(r){return r.destino;}));
    fill('filtroTransferenciaProducto', rows.map(function(r){return (r.items&&r.items[0]&&r.items[0].producto)||r.producto;}));
    fill('filtroTransferenciaUsuario', rows.map(function(r){return r.usuario;}));
  }
  function filteredTransferRows(rows){
    var fOri=low(document.getElementById('filtroTransferenciaOrigen')&&document.getElementById('filtroTransferenciaOrigen').value);
    var fDes=low(document.getElementById('filtroTransferenciaDestino')&&document.getElementById('filtroTransferenciaDestino').value);
    var fProd=low(document.getElementById('filtroTransferenciaProducto')&&document.getElementById('filtroTransferenciaProducto').value);
    var fDesde=txt(document.getElementById('filtroTransferenciaDesde')&&document.getElementById('filtroTransferenciaDesde').value);
    var fHasta=txt(document.getElementById('filtroTransferenciaHasta')&&document.getElementById('filtroTransferenciaHasta').value);
    var fSer=low((document.getElementById('filtroTransferenciaSerializado')&&document.getElementById('filtroTransferenciaSerializado').value)||'todos');
    var fUser=low(document.getElementById('filtroTransferenciaUsuario')&&document.getElementById('filtroTransferenciaUsuario').value);
    var q=low(document.getElementById('buscarTransferencia')&&document.getElementById('buscarTransferencia').value);
    return rows.filter(function(r){
      var hay=low([r.codigo,r.origen,r.destino,r.producto,r.productosResumen,r.usuario,r.estado,r.observacion,r.tipoTransferencia].join(' '));
      var date=r.fechaISO || '';
      return (!fOri||low(r.origen).indexOf(fOri)>=0) && (!fDes||low(r.destino).indexOf(fDes)>=0) && (!fProd||low(r.productosResumen||r.producto).indexOf(fProd)>=0) && (!fUser||low(r.usuario).indexOf(fUser)>=0) && (fSer==='todos'||!fSer||low(r.serializado)===fSer) && (!fDesde||date>=fDesde) && (!fHasta||date<=fHasta) && (!q||hay.indexOf(q)>=0);
    });
  }
  function updateDashboard(rows){
    var today=new Date().toISOString().slice(0,10);
    var hoy=rows.filter(function(r){return (r.fechaISO||'')===today;});
    var total=document.getElementById('dashTotalTransferencias'), dh=document.getElementById('dashTransferenciasHoy'), uni=document.getElementById('dashUnidadesTransferidasHoy');
    if(total) total.textContent=String(rows.length);
    if(dh) dh.textContent=String(hoy.length);
    if(uni) uni.textContent=String(hoy.reduce(function(s,r){return s+Number(r.unidades||0);},0));
  }
  async function renderTransferenciasFinal(force){
    var tbody=document.getElementById('tabla-transferencias'); if(!tbody) return;
    tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:#60788d;font-weight:900;padding:24px">Cargando transferencias reales...</td></tr>';
    var rows=await loadTransferData(force===true);
    updateTransferSelects(rows);
    updateDashboard(rows);
    var data=filteredTransferRows(rows);
    if(!data.length){ tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:#7c8fa0;font-style:italic;font-weight:900;padding:26px">No hay transferencias que coincidan con los filtros seleccionados.</td></tr>'; return; }
    tbody.innerHTML=data.map(function(r){
      var isRT=String(r.codigo||'').indexOf('RT-')===0 || low(r.tipoTransferencia).indexOf('recepcion')>=0;
      return '<tr>'+
        '<td><strong>'+esc(r.codigo)+'</strong><div class="small-muted">'+esc(isRT?'Recepción / transferencia Taller':'Transferencia')+'</div></td>'+
        '<td>'+esc(r.origen||'Sin origen')+'</td>'+
        '<td>'+esc(r.destino||'Sin destino')+'</td>'+
        '<td title="'+esc(r.productosResumen||r.producto)+'">'+esc(r.producto||'Productos varios')+'</td>'+
        '<td><strong>'+esc(r.unidades||1)+'</strong></td>'+
        '<td>'+esc(r.fechaHora||r.fecha||'')+'</td>'+
        '<td>'+esc(r.usuario||'Sistema')+'</td>'+
        '<td><span class="status-badge success">'+esc(r.estado||'Completada')+'</span></td>'+
        '<td class="actions"><button type="button" class="btn-secondary" style="padding:8px 12px;border-radius:12px" onclick="verDetalleTransferencia(\''+esc(r.codigo)+'\')"><i class="fas fa-eye"></i> Consultar</button></td>'+
      '</tr>';
    }).join('');
  }
  window.renderTransferencias = function(){ return renderTransferenciasFinal(false); };
  window.aplicarFiltrosTransferencia = function(){ return renderTransferenciasFinal(false); };
  window.limpiarFiltrosTransferencia = function(){
    ['filtroTransferenciaOrigen','filtroTransferenciaDestino','filtroTransferenciaProducto','filtroTransferenciaDesde','filtroTransferenciaHasta','filtroTransferenciaUsuario','buscarTransferencia'].forEach(function(id){var el=document.getElementById(id); if(el) el.value='';});
    var ser=document.getElementById('filtroTransferenciaSerializado'); if(ser) ser.value='todos';
    return renderTransferenciasFinal(false);
  };
  window.verDetalleTransferencia = async function(codigo){
    var rows = cache.rows && cache.rows.length ? cache.rows : await loadTransferData(false);
    var r = rows.find(function(x){return String(x.codigo)===String(codigo);});
    if(!r){ alert('No se encontró esta transferencia. Actualiza e intenta de nuevo.'); return; }
    var title=document.getElementById('detalleTransferenciaTitulo'), cod=document.getElementById('detalleTransferenciaCodigo'), meta=document.getElementById('detalleTransferenciaMeta'), resumen=document.getElementById('detalleTransferenciaResumen'), body=document.getElementById('detalleTransferenciaItemsBody');
    if(title) title.innerText='Detalle de Transferencia';
    if(cod) cod.innerText=r.codigo;
    if(meta) meta.innerText=(r.origen||'Sin origen')+' → '+(r.destino||'Sin destino')+' · '+(r.fechaHora||r.fecha||'')+' · '+(r.usuario||'Sistema');
    if(resumen) resumen.innerHTML='<div class="detail-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0"><div><b>Tipo</b><br>'+esc(r.tipoTransferencia||'Transferencia')+'</div><div><b>Estado</b><br>'+esc(r.estado||'Completada')+'</div><div><b>Unidades</b><br>'+esc(r.unidades||1)+'</div><div><b>Serializado</b><br>'+esc(r.serializado==='si'?'Sí':'No')+'</div></div><div style="margin-top:10px"><b>Observación</b><br>'+esc(r.observacion||'Sin observación registrada.')+'</div>';
    if(body) body.innerHTML=(r.items||[]).map(function(i){return '<tr><td>'+esc(i.producto)+'</td><td>'+esc(i.marca||'')+'</td><td>'+esc(i.modelo||'')+'</td><td>'+esc(i.categoria||'')+'</td><td>'+esc(i.cantidad||1)+'</td><td>'+esc(i.serializado==='si'?'Serializado':'No serializado')+'</td><td>'+esc(i.seriales&&i.seriales.length?i.seriales.join(', '):'No aplica')+'</td></tr>';}).join('') || '<tr><td colspan="7">Sin líneas registradas.</td></tr>';
    var modal=document.getElementById('modalDetalleTransferencia'); if(modal) modal.style.display='flex';
  };
  window.lotekaRefrescarTransferenciasReales = function(){ return renderTransferenciasFinal(true); };
  window.actualizarDashboardTransferencias = function(){ updateDashboard(cache.rows||[]); };
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ renderTransferenciasFinal(true); }, 1200); });
})();


(function(){
  'use strict';
  if(window.__lotekaV44GuardarRefresh) return;
  window.__lotekaV44GuardarRefresh = true;

  function arr(v){ return Array.isArray(v) ? v : []; }
  function txt(v){ return String(v == null ? '' : v); }
  function key(v){ return txt(v).replace(/\s+/g,'').toUpperCase().trim(); }
  function low(v){ return txt(v).toLowerCase().trim(); }
  function g(id){ return document.getElementById(id); }
  function value(id, fallback){ var el=g(id); return el ? el.value : (fallback == null ? '' : fallback); }
  function setText(id,val){ var el=g(id); if(el) el.textContent = val; }
  function getAgencias(){ try{ if(typeof agencias !== 'undefined' && Array.isArray(agencias)) return agencias; }catch(e){} if(!Array.isArray(window.agencias)) window.agencias=[]; return window.agencias; }
  function getAlmacenes(){ try{ if(typeof almacenes !== 'undefined' && Array.isArray(almacenes)) return almacenes; }catch(e){} if(!Array.isArray(window.almacenes)) window.almacenes=[]; return window.almacenes; }
  function getTransferencias(){ try{ if(typeof transferenciasInventario !== 'undefined' && Array.isArray(transferenciasInventario)) return transferenciasInventario; }catch(e){} if(!Array.isArray(window.transferenciasInventario)) window.transferenciasInventario=[]; return window.transferenciasInventario; }
  function getPending(){ try{ if(typeof agenciaPendienteSeriales !== 'undefined' && Array.isArray(agenciaPendienteSeriales)) return agenciaPendienteSeriales; }catch(e){} if(!Array.isArray(window.agenciaPendienteSeriales)) window.agenciaPendienteSeriales=[]; return window.agenciaPendienteSeriales; }
  function clearPending(){ try{ if(typeof agenciaPendienteSeriales !== 'undefined') agenciaPendienteSeriales = []; }catch(e){} window.agenciaPendienteSeriales = []; }
  function currentAgencyIndex(){ try{ if(typeof agenciaDetalleActualIndex !== 'undefined') return agenciaDetalleActualIndex; }catch(e){} return window.agenciaDetalleActualIndex; }
  function setCurrentAgencyIndex(v){ try{ if(typeof agenciaDetalleActualIndex !== 'undefined') agenciaDetalleActualIndex = v; }catch(e){} window.agenciaDetalleActualIndex = v; }
  function user(){ try{ return usuarioMovimientoFijo || 'Oscar Rosario'; }catch(e){ return 'Oscar Rosario'; } }
  function now(){
    try{ if(typeof obtenerFechaHoraActual === 'function') return obtenerFechaHoraActual(); }catch(e){}
    var d=new Date(), dd=String(d.getDate()).padStart(2,'0'), mm=String(d.getMonth()+1).padStart(2,'0'), yy=d.getFullYear(), hh=String(d.getHours()).padStart(2,'0'), mi=String(d.getMinutes()).padStart(2,'0');
    return {fecha:dd+'-'+mm+'-'+yy,hora:hh+':'+mi,fechaHora:dd+'/'+mm+'/'+yy+', '+hh+':'+mi,fechaISO:yy+'-'+mm+'-'+dd};
  }
  function fechaISO(t){ if(t && t.fechaISO) return t.fechaISO; var f=(t&&t.fecha)||''; var p=String(f).split('-'); return p.length===3 ? (p[2]+'-'+p[1]+'-'+p[0]) : new Date().toISOString().slice(0,10); }
  function fechaHoy(){ try{ if(typeof obtenerFechaHoy==='function') return obtenerFechaHoy(); }catch(e){} return new Date().toLocaleDateString('es-DO'); }
  function normalizeGeo(v){ try{ if(typeof normalizarNumeroGeografico === 'function') return normalizarNumeroGeografico(v); }catch(e){} var n=Number(String(v||'').replace(',','.')); return Number.isFinite(n) ? n : ''; }
  function normalizeEstado(v){ try{ if(typeof normalizarEstadoAgencia === 'function') return normalizarEstadoAgencia(v); }catch(e){} return v || 'ACTIVA'; }
  function normalizeTipo(v){ try{ if(typeof normalizarTipoAgencia === 'function') return normalizarTipoAgencia(v); }catch(e){} return v || 'Agencia'; }
  function ensureDefaults(ag){ try{ if(typeof ensureAgencyDetailDefaults === 'function') ensureAgencyDetailDefaults(ag); }catch(e){} if(!ag.detalle) ag.detalle={}; if(!Array.isArray(ag.equipos)) ag.equipos=[]; return ag; }
  function agenciaNombre(ag){ return ag && (ag.nombre || ('Agencia '+String(ag.numero||'').padStart(4,'0'))) || 'Agencia'; }
  function seriales(inv){ var s=[]; if(inv&&inv.serial) s.push(inv.serial); if(inv&&Array.isArray(inv.seriales)) s=s.concat(inv.seriales); if(inv&&Array.isArray(inv.series)) s=s.concat(inv.series); return Array.from(new Set(s.map(txt).filter(Boolean))); }
  function removeSerialFromInventory(inv, serial){
    if(!inv) return 0;
    var k=key(serial);
    if(Array.isArray(inv.seriales)) inv.seriales = inv.seriales.filter(function(x){ return key(x)!==k; });
    if(Array.isArray(inv.series)) inv.series = inv.series.filter(function(x){ return key(x)!==k; });
    if(key(inv.serial)===k) inv.serial='';
    var left = seriales(inv);
    if(left.length){ inv.cantidad = left.length; }
    else { inv.cantidad = Math.max(0, Number(inv.cantidad||0)-1); }
    return Number(inv.cantidad||0);
  }
  function addSerialToWarehouse(almacen, item, referencia){
    if(!almacen) return;
    if(!Array.isArray(almacen.inventario)) almacen.inventario=[];
    var serialKey=key(item.serial);
    var found=almacen.inventario.find(function(inv){
      return low(inv.producto||inv.nombre)===low(item.producto||item.nombre) && low(inv.marca)===low(item.marca) && low(inv.modelo)===low(item.modelo);
    });
    if(!found){
      found={producto:item.producto||item.nombre||'Equipo',marca:item.marca||'',modelo:item.modelo||'',categoria:item.categoria||'equipos',cantidad:0,tipo:'Serializado',seriales:[],referencia:referencia,transferencia:referencia};
      almacen.inventario.push(found);
    }
    if(!Array.isArray(found.seriales)) found.seriales=[];
    if(item.serial && !found.seriales.some(function(s){return key(s)===serialKey;})) found.seriales.push(item.serial);
    found.tipo='Serializado'; found.cantidad=seriales(found).length || Number(found.cantidad||0) || 1; found.transferencia=referencia;
  }
  function toast(msg){
    var box=document.getElementById('lotekaRefreshToastV43');
    if(!box){ box=document.createElement('div'); box.id='lotekaRefreshToastV43'; box.className='loteka-refresh-toast-v43'; document.body.appendChild(box); }
    box.textContent=msg || 'Sistema actualizado'; box.classList.add('show');
    clearTimeout(window.__lotekaV43ToastTimer); window.__lotekaV43ToastTimer=setTimeout(function(){box.classList.remove('show');},1600);
  }

  function refreshInternal(context, silent){
    var btn=document.getElementById('lotekaGlobalRefreshBtnV43');
    if(btn) btn.classList.add('loading');
    var calls=['renderAgencias','renderGrupos','renderAlmacenes','renderProductos','llenarSelectsTransferencia','renderTransferencias','renderEntradas','agencyMapRefresh'];
    calls.forEach(function(fn){ try{ if(typeof window[fn]==='function') window[fn](); }catch(e){ console.warn('Refresh '+fn,e); } });
    try{ if(currentAgencyIndex() !== null && currentAgencyIndex() !== undefined && typeof renderDetalleAgenciaInventario === 'function') renderDetalleAgenciaInventario(); }catch(e){}
    setTimeout(function(){ if(btn) btn.classList.remove('loading'); if(!silent) toast('Actualizado: '+(context||'sistema')); },180);
    return true;
  }

  function installRefreshButton(){ try{ var oldBtn=document.getElementById('lotekaGlobalRefreshBtnV43'); if(oldBtn) oldBtn.remove(); }catch(e){} return false; }

  function guardarDetalleAgenciaSeguro(){
    var idx=currentAgencyIndex();
    var agenciasArr=getAgencias();
    if(idx===null || idx===undefined || !agenciasArr[idx]){ alert('No hay una agencia abierta para guardar.'); return false; }
    var agencia=ensureDefaults(agenciasArr[idx]);
    var oldNumero=Number(agencia.numero||0);
    var numero=Number(value('agencyFieldNumero',agencia.numero)||agencia.numero||0);
    if(numero) agencia.numero=numero;
    agencia.nombre='Agencia '+String(agencia.numero||'').padStart(4,'0');
    var grupoSolicitado=txt(value('agencyFieldGrupo',agencia.grupo||'')).trim() || agencia.grupo || agencia.grupoReal || 'Grupo 00';
    agencia.grupo=grupoSolicitado;
    agencia.encargado=txt(value('agencyFieldEncargado',agencia.encargado||'')).trim() || agencia.encargado || '';
    agencia.direccion=txt(value('agencyFieldDireccion',agencia.direccion||'')).trim();
    agencia.latitud=normalizeGeo(value('agencyFieldLatitud',agencia.latitud||''));
    agencia.longitud=normalizeGeo(value('agencyFieldLongitud',agencia.longitud||''));
    agencia.detalle.go=txt(value('agencyFieldGo',agencia.detalle.go||'')).trim();
    agencia.detalle.ltk=txt(value('agencyFieldLtk',agencia.detalle.ltk||'')).trim();
    agencia.detalle.telefono=txt(value('agencyFieldTelefono',agencia.detalle.telefono||'')).trim();
    agencia.detalle.horario=txt(value('agencyFieldHorario',agencia.detalle.horario||'')).trim();
    agencia.detalle.estadoOperativo=normalizeEstado(value('agencyFieldEstadoOperativo',agencia.detalle.estadoOperativo||agencia.estadoOperativo||'ACTIVA'));
    agencia.estadoOperativo=agencia.detalle.estadoOperativo;
    agencia.detalle.grupoReal=grupoSolicitado;
    agencia.grupoReal=grupoSolicitado;
    try{ if(typeof applyAgencyClosedStatusRule === 'function') applyAgencyClosedStatusRule(agencia, grupoSolicitado); }catch(e){}
    try{ if(typeof syncClosedAgenciesGroup === 'function') syncClosedAgenciesGroup(); }catch(e){}
    agencia.detalle.tipoAgencia=normalizeTipo(value('agencyFieldTipoAgencia',agencia.detalle.tipoAgencia||'Agencia'));
    agencia.detalle.observacion=txt(value('agencyFieldObservacion',agencia.detalle.observacion||'')).trim();
    agencia.detalle.estructura={toldo:value('agencyStructToldo','Buen Estado'),techo:value('agencyStructTecho','Buen Estado'),pintura:value('agencyStructPintura','Buen Estado'),piso:value('agencyStructPiso','Buen Estado'),puerta:value('agencyStructPuerta','Buen Estado'),counter:value('agencyStructCounter','Buen Estado'),cliente:value('agencyStructCliente','Buen Estado'),empleada:value('agencyStructEmpleada','Buen Estado'),comentario:txt(value('agencyStructComentario','')).trim()};
    agencia.detalle.legal={propietario:txt(value('agencyLegalPropietario','')).trim(),documento:txt(value('agencyLegalDocumento','')).trim(),telefono:txt(value('agencyLegalTelefono','')).trim(),estado:value('agencyLegalEstado','Al día'),inicio:value('agencyLegalInicio',''),vencimiento:value('agencyLegalVencimiento',''),observacion:txt(value('agencyLegalObservacion','')).trim()};
    agencia.detalle.permisos={inventario:value('agencyPermInventario','Sí'),serializados:value('agencyPermSerializados','Sí'),soporte:value('agencyPermSoporte','Sí'),acceso:value('agencyPermAcceso','Activo'),movimientos:value('agencyPermMovimientos','Habilitado'),especial:value('agencyPermEspecial','Ninguno')};
    agencia.detalle.parametros={tecnico:txt(value('agencyParamTecnico','')).trim(),supervisor:txt(value('agencyParamSupervisor','')).trim(),prioridad:value('agencyParamPrioridad','Media'),canal:value('agencyParamCanal','Operaciones'),ruta:txt(value('agencyParamRuta','')).trim(),horarioRuta:txt(value('agencyParamHorario','')).trim(),ultimaVisita:value('agencyParamUltimaVisita',''),proximaRevision:value('agencyParamProximaRevision',''),nota:txt(value('agencyParamNota','')).trim()};

    var pendientes=getPending().slice();
    if(pendientes.length){
      var t=now();
      var seq; try{ seq=secuenciaTransferencia; secuenciaTransferencia += 1; }catch(e){ seq=Date.now()%1000000; }
      var referencia='TR-AG-'+String(seq).padStart(6,'0');
      pendientes.forEach(function(item){
        var almacen=getAlmacenes()[Number(item.almacenIndex)];
        var inv=almacen && arr(almacen.inventario)[Number(item.inventarioIndex)];
        if(almacen && inv) removeSerialFromInventory(inv,item.serial);
        if(almacen && inv && Number(inv.cantidad||0)<=0){ var pos=almacen.inventario.indexOf(inv); if(pos>=0) almacen.inventario.splice(pos,1); }
        if(false && !agencia.equipos.some(function(eq){ return key(eq.serial)===key(item.serial); })){
          agencia.equipos.push({id:txt(item.id||('ag-'+Date.now()+'-'+Math.random().toString(16).slice(2,7))).replace(/^tmp-/,'eq-'),categoria:item0.categoria||'equipos',producto:item.producto||'Equipo',imagen:item.imagen||'',marca:item.marca||'',modelo:item.modelo||'',serial:item.serial||'',fechaInstalacion:item.fechaInstalacion||fechaHoy(),origenInventario:item.almacenNombre||'',transferencia:referencia,estado:'Instalado en agencia'});
        }
        try{ if(typeof registrarMovimientoAlmacen === 'function' && almacen){ registrarMovimientoAlmacen(Number(item.almacenIndex),'Transferencia a agencia',referencia,(item.producto||'Equipo')+' serial '+(item.serial||'')+' enviado a '+agenciaNombre(agencia),user(),t,referencia); } }catch(e){}
      });
      var origenes=Array.from(new Set(pendientes.map(function(i){return i.almacenNombre||'Almacén';})));
      getTransferencias().unshift({codigo:referencia,origen:origenes.length===1?origenes[0]:'Múltiples almacenes',destino:agenciaNombre(agencia),producto:pendientes.length===1?pendientes[0].producto:(pendientes[0].producto+' (+'+(pendientes.length-1)+')'),productosResumen:pendientes.map(function(i){return (i.producto||'Equipo')+' ['+(i.serial||'Sin serial')+']';}).join(', '),unidades:pendientes.length,fecha:t.fecha,hora:t.hora,fechaHora:t.fechaHora,fechaISO:fechaISO(t),usuario:user(),estado:'Completada',serializado:'si',observacion:'Transferencia rápida a '+agenciaNombre(agencia),items:pendientes.map(function(i){return {producto:i.producto,marca:i.marca,modelo:i.modelo,categoria:i.categoria,cantidad:1,serializado:'si',seriales:i.serial?[i.serial]:[]};})});
      clearPending();
    }
    agenciasArr.sort(function(a,b){return Number(a.numero||0)-Number(b.numero||0);});
    var newIndex=agenciasArr.findIndex(function(a){return Number(a.numero)===Number(agencia.numero);});
    if(newIndex<0) newIndex=agenciasArr.findIndex(function(a){return Number(a.numero)===oldNumero;});
    if(newIndex>=0) setCurrentAgencyIndex(newIndex);
    refreshInternal('guardar agencia', true);
    if(newIndex>=0 && typeof verDetalleAgencia === 'function') setTimeout(function(){ verDetalleAgencia(newIndex); refreshInternal('guardar agencia', true); toast('Agencia guardada y actualizada'); },80);
    else toast('Agencia guardada y actualizada');
    return true;
  }

  var oldMini = window.confirmarMiniTransferenciaAgencia;
  window.confirmarMiniTransferenciaAgencia = function(){
    var r;
    try{ r = typeof oldMini === 'function' ? oldMini.apply(this,arguments) : undefined; }
    finally{ setTimeout(function(){ refreshInternal('mover equipo', true); toast('Movimiento aplicado y actualizado'); },140); }
    return r;
  };

  window.guardarDetalleAgenciaCompleta = guardarDetalleAgenciaSeguro;
  window.guardarCambiosAgencia = guardarDetalleAgenciaSeguro;
  try{ guardarDetalleAgenciaCompleta = guardarDetalleAgenciaSeguro; guardarCambiosAgencia = guardarDetalleAgenciaSeguro; }catch(e){}
  window.lotekaRefreshAfterMutation = refreshInternal;
  window.lotekaForceRefresh = function(){ return refreshInternal('manual'); };

  ['guardarProducto','guardarAlmacen','guardarEntrada','guardarTransferencia'].forEach(function(name){
    var fn=window[name];
    if(typeof fn==='function' && !fn.__lotekaV43Refresh){
      var wrapped=function(){ var r=fn.apply(this,arguments); setTimeout(function(){ refreshInternal(name, true); },160); return r; };
      wrapped.__lotekaV43Refresh=true; window[name]=wrapped;
      try{ eval(name+' = window["'+name+'"]'); }catch(e){}
    }
  });

  function boot(){
    try{ var oldBtn=document.getElementById('lotekaGlobalRefreshBtnV43'); if(oldBtn) oldBtn.remove(); }catch(e){}
    setTimeout(function(){ refreshInternal('inicio', true); },300);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',function(){ setTimeout(boot,600); });
})();

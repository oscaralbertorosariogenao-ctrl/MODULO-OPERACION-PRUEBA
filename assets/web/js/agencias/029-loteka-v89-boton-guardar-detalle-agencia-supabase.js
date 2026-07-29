
(function(){
  'use strict';
  if(window.__lotekaV89GuardarDetalleAgenciaFix) return;
  window.__lotekaV89GuardarDetalleAgenciaFix = true;

  function el(id){ return document.getElementById(id); }
  function txt(v){ return String(v == null ? '' : v).trim(); }
  function clone(v){ try{ return JSON.parse(JSON.stringify(v || null)); }catch(e){ return null; } }
  function currentUserId(){ return window.lotekaAuthState && window.lotekaAuthState.user ? window.lotekaAuthState.user.id : null; }
  function client(){ return window.lotekaSupabase || null; }
  function getAgencias(){ try{ if(Array.isArray(agencias)) return agencias; }catch(e){} return Array.isArray(window.agencias) ? window.agencias : []; }
  function currentIndex(){ try{ if(typeof agenciaDetalleActualIndex !== 'undefined') return agenciaDetalleActualIndex; }catch(e){} return window.agenciaDetalleActualIndex; }
  function setCurrentIndex(v){ try{ if(typeof agenciaDetalleActualIndex !== 'undefined') agenciaDetalleActualIndex = v; }catch(e){} window.agenciaDetalleActualIndex = v; }
  function padAgency(v){ var d = txt(v).replace(/\D/g,''); return d ? d.padStart(4,'0') : txt(v); }
  function groupCode(v){ var raw = txt(v); if(!raw) return '00'; var clean = raw.toUpperCase(); if(clean.includes('CERRADA') || clean.includes('DESACT')) return '00'; var d = raw.replace(/\D/g,''); return d ? d.padStart(2,'0') : raw; }
  function groupName(code){ var c = groupCode(code); return c === '00' ? 'DESACTIVADAS/CERRADAS' : ('Grupo ' + c); }
  function numberOrNull(v){ var t = txt(v).replace(',','.'); if(!t) return null; var n = Number(t); return Number.isFinite(n) ? n : null; }
  function dateOrNull(v){ var t = txt(v); if(!t) return null; if(/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; var m = t.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/); return m ? (m[3]+'-'+m[2]+'-'+m[1]) : null; }
  function dbEstado(v){
    var c = txt(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(c.includes('proceso')) return 'En proceso';
    if(c.includes('remodel')) return 'En remodelación';
    if(c.includes('cerr') || c.includes('desact') || c.includes('inact')) return 'Cerrada';
    return 'Activa';
  }
  function dbTipo(v){
    var c = txt(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(c.includes('centro')) return 'Centro de Pago';
    if(c.includes('punto')) return 'Punto de Pago';
    if(c.includes('super')) return 'Agencia en Supermercado';
    return 'Agencia normal';
  }
  function localEstadoFromDb(v){
    var e = dbEstado(v);
    if(e === 'En proceso') return 'EN PROCESO';
    if(e === 'En remodelación') return 'REMODELACIÓN';
    if(e === 'Cerrada') return 'CERRADA';
    return 'ACTIVA';
  }
  function localTipoFromDb(v){
    var t = dbTipo(v);
    if(t === 'Centro de Pago') return 'Centro de Pago';
    if(t === 'Punto de Pago') return 'Punto de Pago';
    if(t === 'Agencia en Supermercado') return 'Agencia en Supermercado';
    return 'Agencia';
  }
  function firstSaveButton(){
    var modal = el('modalDetalleAgencia');
    if(!modal) return null;
    var buttons = Array.from(modal.querySelectorAll('button'));
    return buttons.find(function(b){ return /guardar/i.test(b.textContent || '') && !/cerrar/i.test(b.textContent || ''); }) || null;
  }
  function setButtonLoading(btn, loading){
    if(!btn) return;
    if(loading){
      btn.dataset.v89OriginalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
      btn.classList.add('is-saving');
    }else{
      btn.disabled = false;
      btn.innerHTML = btn.dataset.v89OriginalHtml || '<i class="fas fa-floppy-disk"></i> Guardar cambios';
      btn.classList.remove('is-saving');
    }
  }
  function collectPayload(){
    var numero = padAgency((el('agencyFieldNumero') || {}).value);
    var grupoTexto = txt((el('agencyFieldGrupo') || {}).value) || 'Grupo 00';
    var codigoGrupo = groupCode(grupoTexto);
    var estadoDb = dbEstado((el('agencyFieldEstadoOperativo') || {}).value);
    var tipoDb = dbTipo((el('agencyFieldTipoAgencia') || {}).value);
    return {
      numero: numero,
      grupo_codigo: codigoGrupo,
      grupo_nombre: groupName(codigoGrupo),
      encargado: txt((el('agencyFieldEncargado') || {}).value),
      agencia: {
        numero: numero,
        nombre: 'Agencia ' + numero,
        tipo: tipoDb,
        estado: estadoDb,
        latitud: numberOrNull((el('agencyFieldLatitud') || {}).value),
        longitud: numberOrNull((el('agencyFieldLongitud') || {}).value),
        direccion: txt((el('agencyFieldDireccion') || {}).value) || ('Agencia ' + numero),
        telefono: txt((el('agencyFieldTelefono') || {}).value) || null,
        observaciones: txt((el('agencyFieldObservacion') || {}).value) || null,
        fecha_creacion: dateOrNull((el('agencyFieldFechaCreacion') || {}).value),
        activo: true,
        actualizado_por: currentUserId()
      }
    };
  }
  async function ensureGroup(payload){
    var sb = client();
    var found = await sb.from('grupos').select('*').eq('codigo', payload.grupo_codigo).maybeSingle();
    if(found.error && found.error.code !== 'PGRST116') throw found.error;
    var groupPayload = {
      codigo: payload.grupo_codigo,
      nombre: payload.grupo_nombre,
      encargado: payload.encargado || null,
      activo: true,
      actualizado_por: currentUserId()
    };
    if(!found.data) groupPayload.creado_por = currentUserId();
    if(found.data){
      var up = await sb.from('grupos').update(groupPayload).eq('id', found.data.id).select('*').single();
      if(up.error) throw up.error;
      return up.data;
    }
    var ins = await sb.from('grupos').insert(groupPayload).select('*').single();
    if(ins.error) throw ins.error;
    return ins.data;
  }
  async function updateSupabaseAgency(payload, beforeLocal){
    var sb = client();
    if(!sb) throw new Error('No hay conexión activa con Supabase.');
    if(!payload.numero) throw new Error('No se encontró el número de agencia.');
    var g = await ensureGroup(payload);
    payload.agencia.grupo_id = g.id;
    var byNumber = await sb.from('agencias').select('*').eq('numero', payload.numero).maybeSingle();
    if(byNumber.error && byNumber.error.code !== 'PGRST116') throw byNumber.error;
    var existing = byNumber.data || null;
    if(!existing) payload.agencia.creado_por = currentUserId();
    var saved;
    if(existing){
      var res = await sb.from('agencias').update(payload.agencia).eq('id', existing.id).select('*').single();
      if(res.error) throw res.error;
      saved = res.data;
    }else{
      var ins = await sb.from('agencias').insert(payload.agencia).select('*').single();
      if(ins.error) throw ins.error;
      saved = ins.data;
    }
    try{
      if(typeof window.lotekaAudit === 'function'){
        await window.lotekaAudit('Gestión de agencias','EDITAR_AGENCIA','agencias', saved.id || payload.numero, 'Agencia actualizada desde consulta/edición: ' + payload.numero, existing || beforeLocal || null, saved);
      }
    }catch(e){ console.warn('Auditoría v89 no registrada:', e && e.message ? e.message : e); }
    return saved;
  }
  function syncLocalAgency(saved, groupRow){
    var list = getAgencias();
    var idx = list.findIndex(function(a){ return padAgency(a.numero) === padAgency(saved.numero); });
    if(idx < 0) return -1;
    var a = list[idx];
    a.supabaseId = saved.id;
    a.grupoId = saved.grupo_id;
    a.numeroTexto = padAgency(saved.numero);
    a.numero = Number(saved.numero) || saved.numero;
    a.nombre = saved.nombre || ('Agencia ' + padAgency(saved.numero));
    a.grupo = groupRow && groupRow.nombre ? groupRow.nombre : a.grupo;
    a.encargado = groupRow && groupRow.encargado ? groupRow.encargado : a.encargado;
    a.direccion = saved.direccion || a.direccion;
    a.latitud = saved.latitud != null ? Number(saved.latitud) : a.latitud;
    a.longitud = saved.longitud != null ? Number(saved.longitud) : a.longitud;
    a.telefono = saved.telefono || a.telefono || '';
    a.observaciones = saved.observaciones || a.observaciones || '';
    a.estadoOperativo = localEstadoFromDb(saved.estado);
    a.estado = a.estadoOperativo;
    a.tipoAgencia = localTipoFromDb(saved.tipo);
    a.tipo = a.tipoAgencia;
    a.fechaCreacion = saved.fecha_creacion || a.fechaCreacion || '';
    a.detalle = a.detalle || {};
    a.detalle.estadoOperativo = a.estadoOperativo;
    a.detalle.tipoAgencia = a.tipoAgencia;
    a.detalle.telefono = a.telefono;
    a.detalle.observacion = a.observaciones;
    a.detalle.fechaCreacion = a.fechaCreacion;
    setCurrentIndex(idx);
    return idx;
  }
  async function guardarDetalleAgenciaV89(){
    var btn = firstSaveButton();
    var idx = currentIndex();
    var list = getAgencias();
    if(idx === null || idx === undefined || !list[idx]){ alert('No hay una agencia abierta para guardar.'); return false; }
    var beforeLocal = clone(list[idx]);
    var payload = collectPayload();
    setButtonLoading(btn, true);
    try{
      var saved = await updateSupabaseAgency(payload, beforeLocal);
      var groupRow = null;
      try{
        var g = await client().from('grupos').select('*').eq('id', saved.grupo_id).maybeSingle();
        groupRow = g.data || null;
      }catch(e){}
      syncLocalAgency(saved, groupRow);

      if(typeof window.lotekaReloadAgenciasGruposSupabase === 'function'){
        await window.lotekaReloadAgenciasGruposSupabase();
      }
      var refreshed = getAgencias().findIndex(function(a){ return padAgency(a.numero) === padAgency(payload.numero); });
      if(refreshed >= 0){
        setCurrentIndex(refreshed);
        if(typeof window.verDetalleAgencia === 'function') setTimeout(function(){ window.verDetalleAgencia(refreshed); }, 60);
      }
      if(typeof window.lotekaRefreshAfterMutation === 'function'){
        try{ window.lotekaRefreshAfterMutation('guardar agencia', true); }catch(e){}
      }
      if(typeof window.renderAgencias === 'function') window.renderAgencias();
      if(typeof window.renderGrupos === 'function') window.renderGrupos();
      alert('Cambios guardados correctamente.');
      return true;
    }catch(err){
      console.error('Error guardando detalle de agencia:', err);
      alert('No se pudo guardar la agencia: ' + (err && err.message ? err.message : err));
      return false;
    }finally{
      setButtonLoading(btn, false);
    }
  }
  function install(){
    window.guardarDetalleAgenciaCompleta = guardarDetalleAgenciaV89;
    window.guardarCambiosAgencia = guardarDetalleAgenciaV89;
    try{ guardarDetalleAgenciaCompleta = guardarDetalleAgenciaV89; guardarCambiosAgencia = guardarDetalleAgenciaV89; }catch(e){}
    var btn = firstSaveButton();
    if(btn){
      btn.type = 'button';
      btn.onclick = guardarDetalleAgenciaV89;
      btn.classList.add('loteka-save-detail-v89');
      btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar cambios';
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', function(){ setTimeout(install, 300); });
})();

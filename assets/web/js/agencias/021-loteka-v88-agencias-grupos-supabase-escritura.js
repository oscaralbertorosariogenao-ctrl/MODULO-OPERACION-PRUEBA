
(function(){
  'use strict';

  function qs(id){ return document.getElementById(id); }
  function cleanText(value){ return String(value == null ? '' : value).trim(); }
  function padAgency(numero){
    const digits = cleanText(numero).replace(/\D/g,'');
    return digits ? digits.padStart(4,'0') : cleanText(numero);
  }
  function groupCode(value){
    const raw = cleanText(value);
    if(!raw) return '00';
    const upper = raw.toUpperCase();
    if(upper.includes('CERRADA') || upper.includes('DESACT')) return '00';
    const digits = raw.replace(/\D/g,'');
    return digits ? digits.padStart(2,'0') : raw;
  }
  function groupNameFromCode(code){
    const normalized = groupCode(code);
    if(normalized === '00') return 'DESACTIVADAS/CERRADAS';
    return 'Grupo ' + normalized;
  }
  function dbAgencyType(localType){
    const raw = cleanText(localType);
    const clean = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(clean.includes('centro')) return 'Centro de Pago';
    if(clean.includes('punto')) return 'Punto de Pago';
    if(clean.includes('super')) return 'Agencia en Supermercado';
    if(clean.includes('socio')) return 'Socio';
    if(clean.includes('pasante')) return 'Pasante';
    return 'Agencia normal';
  }
  function dbAgencyStatus(localStatus){
    const raw = cleanText(localStatus);
    const clean = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(clean.includes('proceso')) return 'En proceso';
    if(clean.includes('remodel')) return 'En remodelación';
    if(clean.includes('cerr') || clean.includes('desact') || clean.includes('inact')) return 'Cerrada';
    return 'Activa';
  }
  function dbNumberOrNull(value){
    const txt = cleanText(value).replace(',', '.');
    if(!txt) return null;
    const n = Number(txt);
    return Number.isFinite(n) ? n : null;
  }
  function currentUserId(){
    return window.lotekaAuthState && window.lotekaAuthState.user ? window.lotekaAuthState.user.id : null;
  }
  function supabaseClient(){ return window.lotekaSupabase || null; }
  function hasPerm(code){
    try{ return !code || typeof window.lotekaHasPermission !== 'function' || window.lotekaHasPermission(code); }
    catch(e){ return true; }
  }
  function clone(obj){
    try{ return JSON.parse(JSON.stringify(obj || null)); }catch(e){ return null; }
  }
  async function audit(modulo, accion, entidad, entidadId, descripcion, antes, despues){
    try{
      if(typeof window.lotekaAudit === 'function'){
        await window.lotekaAudit(modulo, accion, entidad, entidadId, descripcion, antes || null, despues || null);
      }
    }catch(e){ console.warn('Auditoría v88 no registrada:', e && e.message ? e.message : e); }
  }
  async function reloadAgenciasGrupos(){
    try{
      if(typeof window.lotekaReloadAgenciasGruposSupabase === 'function'){
        await window.lotekaReloadAgenciasGruposSupabase();
      }else{
        if(typeof renderAgencias === 'function') renderAgencias();
        if(typeof renderGrupos === 'function') renderGrupos();
      }
      ['actualizarDashboardHome','homeUpdateAgencyDashboard','homeRenderAgencyPanel','llenarSelectsTransferencia'].forEach(function(fn){
        try{ if(typeof window[fn] === 'function') window[fn](); }catch(e){}
      });
    }catch(e){ console.warn('No se pudo refrescar agencias/grupos:', e && e.message ? e.message : e); }
  }
  async function ensureGroupInSupabase(client, groupValue, encargado, color, telefono, correo){
    const codigo = groupCode(groupValue);
    const nombre = groupNameFromCode(codigo);
    const userId = currentUserId();
    const localGroup = (Array.isArray(window.grupos) ? window.grupos : []).find(function(g){
      return groupCode(g.codigo || g.numero || g.nombre) === codigo || cleanText(g.nombre) === nombre;
    }) || {};

    let existing = null;
    const byCode = await client.from('grupos').select('*').eq('codigo', codigo).maybeSingle();
    if(byCode.error && byCode.error.code !== 'PGRST116') throw byCode.error;
    existing = byCode.data || null;

    const payload = {
      codigo: codigo,
      nombre: nombre,
      encargado: cleanText(encargado) || cleanText(localGroup.encargado) || null,
      telefono: cleanText(telefono) || cleanText(localGroup.telefono || localGroup.flota) || null,
      correo: cleanText(correo) || cleanText(localGroup.correo) || null,
      color: cleanText(color) || cleanText(localGroup.color) || '#0ea5c6',
      activo: true,
      actualizado_por: userId
    };
    if(!existing) payload.creado_por = userId;

    if(existing){
      const res = await client.from('grupos').update(payload).eq('id', existing.id).select('*').single();
      if(res.error) throw res.error;
      return res.data;
    }
    const res = await client.from('grupos').insert(payload).select('*').single();
    if(res.error) throw res.error;
    return res.data;
  }

  window.guardarAgencia = async function guardarAgenciaSupabaseV88(){
    const client = supabaseClient();
    if(!client){ alert('No hay conexión activa con Supabase. Inicia sesión nuevamente.'); return; }

    const isEdit = typeof editAgenciaIndex !== 'undefined' && editAgenciaIndex !== null;
    if(!hasPerm(isEdit ? 'editar_agencia' : 'crear_agencia')){
      alert('No tienes permiso para ' + (isEdit ? 'editar' : 'crear') + ' agencias.');
      return;
    }

    const numeroInput = cleanText(qs('agenciaNumero') && qs('agenciaNumero').value);
    const numero = padAgency(numeroInput);
    const grupoValue = cleanText(qs('agenciaGrupo') && qs('agenciaGrupo').value) || 'Grupo 00';
    const encargado = cleanText(qs('agenciaEncargado') && qs('agenciaEncargado').value) || 'Sin encargado';
    const tipoLocal = qs('agenciaTipoAgencia') ? qs('agenciaTipoAgencia').value : 'Agencia';
    const estadoLocal = qs('agenciaEstadoOperativo') ? qs('agenciaEstadoOperativo').value : 'ACTIVA';
    const latitud = dbNumberOrNull(qs('agenciaLatitud') && qs('agenciaLatitud').value);
    const longitud = dbNumberOrNull(qs('agenciaLongitud') && qs('agenciaLongitud').value);
    const direccion = cleanText(qs('agenciaDireccion') && qs('agenciaDireccion').value) || ('Agencia ' + numero);
    const userId = currentUserId();
    const before = isEdit && Array.isArray(window.agencias) ? clone(window.agencias[editAgenciaIndex]) : null;

    if(!numero){ alert('Escribe el número de la agencia'); return; }

    const saveBtn = document.querySelector('#modalAgencia .btn:not(.btn-secondary)');
    const originalText = saveBtn ? saveBtn.innerHTML : '';
    try{
      if(saveBtn){ saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; }

      const grupoRow = await ensureGroupInSupabase(client, grupoValue, encargado, null, null, null);
      const existingResp = await client.from('agencias').select('*').eq('numero', numero).maybeSingle();
      if(existingResp.error && existingResp.error.code !== 'PGRST116') throw existingResp.error;
      const existing = existingResp.data || null;
      if(existing && !isEdit && Array.isArray(window.agencias) && window.agencias.some(a => padAgency(a.numero) === numero)){
        // Permitimos sincronizar si ya estaba en Supabase; no duplicamos porque se actualiza el mismo número.
      }

      const payload = {
        numero: numero,
        nombre: 'Agencia ' + numero,
        grupo_id: grupoRow.id,
        tipo: dbAgencyType(tipoLocal),
        estado: dbAgencyStatus(estadoLocal),
        latitud: latitud,
        longitud: longitud,
        direccion: direccion,
        actualizado_por: userId,
        activo: true
      };
      if(!existing) payload.creado_por = userId;

      let saved;
      if(existing){
        const res = await client.from('agencias').update(payload).eq('id', existing.id).select('*').single();
        if(res.error) throw res.error;
        saved = res.data;
      }else{
        const res = await client.from('agencias').insert(payload).select('*').single();
        if(res.error) throw res.error;
        saved = res.data;
      }

      await audit('Gestión de agencias', existing ? 'EDITAR_AGENCIA' : 'CREAR_AGENCIA', 'agencias', saved.id || numero, (existing ? 'Agencia actualizada: ' : 'Agencia creada: ') + numero, before || existing, saved);
      if(typeof cerrarModalAgencia === 'function') cerrarModalAgencia();
      await reloadAgenciasGrupos();
      alert(existing ? 'Agencia actualizada correctamente.' : 'Agencia creada correctamente.');
    }catch(error){
      console.error('Error guardando agencia en Supabase:', error);
      alert('No se pudo guardar la agencia en Supabase: ' + (error && error.message ? error.message : error));
    }finally{
      if(saveBtn){ saveBtn.disabled = false; saveBtn.innerHTML = originalText || 'Guardar Agencia'; }
    }
  };

  window.guardarGrupo = async function guardarGrupoSupabaseV88(){
    const client = supabaseClient();
    if(!client){ alert('No hay conexión activa con Supabase. Inicia sesión nuevamente.'); return; }

    const isEdit = typeof editGrupoIndex !== 'undefined' && editGrupoIndex !== null;
    if(!hasPerm(isEdit ? 'editar_grupo' : 'crear_grupo')){
      alert('No tienes permiso para ' + (isEdit ? 'editar' : 'crear') + ' grupos.');
      return;
    }

    const numeroRaw = cleanText(qs('grupoNumero') && qs('grupoNumero').value);
    const codigo = groupCode(numeroRaw);
    const nombre = groupNameFromCode(codigo);
    const encargado = cleanText(qs('grupoEncargado') && qs('grupoEncargado').value);
    const color = cleanText(qs('grupoColor') && qs('grupoColor').value) || '#f0c243';
    const flota = cleanText(qs('grupoFlota') && qs('grupoFlota').value);
    const extension = cleanText(qs('grupoExtension') && qs('grupoExtension').value);
    const correo = cleanText(qs('grupoCorreo') && qs('grupoCorreo').value);
    const agenciasSeleccionadas = Array.from(document.querySelectorAll('.grupo-agencia-check:checked')).map(el => padAgency(el.value));
    const userId = currentUserId();
    const before = isEdit && Array.isArray(window.grupos) ? clone(window.grupos[editGrupoIndex]) : null;

    if(!codigo){ alert('Escribe el número del grupo'); return; }
    if(!encargado){ alert('Escribe el encargado del grupo'); return; }

    const saveBtn = document.querySelector('#modalGrupo .btn:not(.btn-secondary)');
    const originalText = saveBtn ? saveBtn.innerHTML : '';
    try{
      if(saveBtn){ saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; }

      const existingResp = await client.from('grupos').select('*').eq('codigo', codigo).maybeSingle();
      if(existingResp.error && existingResp.error.code !== 'PGRST116') throw existingResp.error;
      const existing = existingResp.data || null;
      const payload = {
        codigo: codigo,
        nombre: nombre,
        encargado: encargado,
        telefono: flota || null,
        correo: correo || null,
        color: color,
        activo: true,
        actualizado_por: userId
      };
      if(!existing) payload.creado_por = userId;

      let saved;
      if(existing){
        const res = await client.from('grupos').update(payload).eq('id', existing.id).select('*').single();
        if(res.error) throw res.error;
        saved = res.data;
      }else{
        const res = await client.from('grupos').insert(payload).select('*').single();
        if(res.error) throw res.error;
        saved = res.data;
      }

      if(agenciasSeleccionadas.length){
        const upd = await client.from('agencias').update({ grupo_id: saved.id, actualizado_por: userId }).in('numero', agenciasSeleccionadas);
        if(upd.error) throw upd.error;
      }

      await audit('Gestión de agencias', existing ? 'EDITAR_GRUPO' : 'CREAR_GRUPO', 'grupos', saved.id || codigo, (existing ? 'Grupo actualizado: ' : 'Grupo creado: ') + nombre, before || existing, { ...saved, extension: extension, agencias: agenciasSeleccionadas });
      if(typeof cerrarModalGrupo === 'function') cerrarModalGrupo();
      await reloadAgenciasGrupos();
      alert(existing ? 'Grupo actualizado correctamente.' : 'Grupo creado correctamente.');
    }catch(error){
      console.error('Error guardando grupo en Supabase:', error);
      alert('No se pudo guardar el grupo en Supabase: ' + (error && error.message ? error.message : error));
    }finally{
      if(saveBtn){ saveBtn.disabled = false; saveBtn.innerHTML = originalText || 'Guardar Grupo'; }
    }
  };

  async function confirmDeleteEntity(title, message, keyword){
    const ok = window.confirm(title + '\n\n' + message + '\n\nEsta acción conserva el historial y desactiva el registro en Supabase.');
    if(!ok) return false;
    const typed = window.prompt('Para confirmar, escribe: ' + keyword);
    return cleanText(typed).toUpperCase() === keyword;
  }

  window.eliminarAgencia = async function eliminarAgenciaSupabaseV80529(index){
    const client = supabaseClient();
    if(!client){ alert('No hay conexión activa con Supabase.'); return; }
    if(!hasPerm('eliminar_agencia')){ alert('No tienes permiso para eliminar agencias.'); return; }
    const local = Array.isArray(window.agencias) ? window.agencias[index] : null;
    if(!local){ alert('No se encontró la agencia seleccionada.'); return; }
    const numero = padAgency(local.numero);
    const confirmed = await confirmDeleteEntity('Eliminar agencia ' + numero, 'La agencia dejará de aparecer como activa en Home, Grupos, Mapa, Rutas y app móvil.', 'ELIMINAR');
    if(!confirmed){ alert('Eliminación cancelada.'); return; }
    try{
      const res = await client.rpc('rpc_agencias_eliminar_seguro', { p_numero: numero, p_motivo: 'Eliminada desde Gestión de Agencias' });
      if(res.error) throw res.error;
      await audit('Gestión de agencias','ELIMINAR_AGENCIA','agencias',numero,'Agencia desactivada desde el sistema',local,res.data);
      await reloadAgenciasGrupos();
      alert('Agencia ' + numero + ' eliminada de la operación activa. El historial fue conservado.');
    }catch(error){
      console.error('Error eliminando agencia:', error);
      alert('No se pudo eliminar la agencia: ' + (error && error.message ? error.message : error));
    }
  };

  window.eliminarGrupo = async function eliminarGrupoSupabaseV80529(index){
    const client = supabaseClient();
    if(!client){ alert('No hay conexión activa con Supabase.'); return; }
    if(!hasPerm('eliminar_grupo')){ alert('No tienes permiso para eliminar grupos.'); return; }
    const local = Array.isArray(window.grupos) ? window.grupos[index] : null;
    if(!local){ alert('No se encontró el grupo seleccionado.'); return; }
    const codigo = groupCode(local.codigo || local.numero || local.nombre);
    if(codigo === '00'){ alert('El Grupo 00 es un grupo de sistema y no puede eliminarse.'); return; }
    const count = Array.isArray(local.agencias) ? local.agencias.length : 0;
    const confirmed = await confirmDeleteEntity('Eliminar ' + groupNameFromCode(codigo), 'Sus ' + count + ' agencia(s) activas serán movidas al Grupo 00 hasta que las reasignes.', 'ELIMINAR');
    if(!confirmed){ alert('Eliminación cancelada.'); return; }
    try{
      const res = await client.rpc('rpc_grupos_eliminar_seguro', { p_codigo: codigo, p_motivo: 'Eliminado desde Gestión de Grupos' });
      if(res.error) throw res.error;
      await audit('Gestión de agencias','ELIMINAR_GRUPO','grupos',codigo,'Grupo desactivado desde el sistema',local,res.data);
      await reloadAgenciasGrupos();
      alert(groupNameFromCode(codigo) + ' eliminado. Sus agencias fueron movidas al Grupo 00 y el historial fue conservado.');
    }catch(error){
      console.error('Error eliminando grupo:', error);
      alert('No se pudo eliminar el grupo: ' + (error && error.message ? error.message : error));
    }
  };

})();

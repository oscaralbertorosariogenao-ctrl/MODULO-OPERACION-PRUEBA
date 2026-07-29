
(function(){
  'use strict';

  var cache = [];
  var loading = false;
  var lastSource = '';

  function el(id){ return document.getElementById(id); }
  function txt(v){ return String(v == null ? '' : v).trim(); }
  function noAccents(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function norm(v){ return noAccents(v).toUpperCase().replace(/\s+/g,' ').trim(); }
  function escapeHtml(v){ return txt(v).replace(/[&<>"]/g,function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }); }

  function cleanRepeatedGrupo(value){
    var s = txt(value);
    if(!s) return '';
    s = s.replace(/\bgrupo\b\s*[-:]?\s*/ig,'Grupo ');
    s = s.replace(/(?:Grupo\s+){2,}/ig,'Grupo ');
    s = s.replace(/\s+/g,' ').trim();
    return s;
  }

  function groupNumberFrom(value){
    var raw = txt(value);
    if(!raw) return '';
    var upper = norm(raw);
    if(upper.indexOf('CERRADA') >= 0 || upper.indexOf('DESACT') >= 0) return '00';

    var m = raw.match(/(?:^|\b)(?:G|GRUPO)\s*[-#:]?\s*(\d{1,3})(?:\b|$)/i);
    if(m) return m[1].padStart(2,'0');

    if(/^\d{1,3}$/.test(raw)) return raw.padStart(2,'0');

    return '';
  }

  function encargFrom(g){
    return txt(g && (
      g.encargado_nombre ||
      g.nombre_encargado ||
      g.encargado ||
      g.responsable_nombre ||
      g.responsable ||
      g.usuario_nombre ||
      g.supervisor ||
      ''
    ));
  }

  function rawGroupName(g){
    return txt(g && (g.nombre || g.grupo_nombre || g.grupo || g.codigo || g.numero || g.name || ''));
  }

  function cleanGroupNameFromRow(g){
    var code = groupNumberFrom(g && (g.codigo || g.numero || g.grupo_codigo || g.nombre || g.grupo || g.grupo_nombre));
    if(code === '00') return 'DESACTIVADAS/CERRADAS';
    if(code) return 'Grupo ' + code;

    var name = cleanRepeatedGrupo(rawGroupName(g));
    if(!name) return '';

    var upper = norm(name);
    if(upper.indexOf('CERRADA') >= 0 || upper.indexOf('DESACT') >= 0) return 'DESACTIVADAS/CERRADAS';

    if(/^GRUPO\s+/i.test(name)) return name;
    return 'Grupo ' + name;
  }

  function groupKey(g){
    var code = groupNumberFrom(g && (g.codigo || g.numero || g.grupo_codigo || g.nombre || g.grupo || g.grupo_nombre));
    if(code) return 'CODE:' + code;
    return 'NAME:' + norm(cleanGroupNameFromRow(g));
  }

  function normalizeRow(g, source){
    if(!g) return null;
    var nombre = cleanGroupNameFromRow(g);
    if(!nombre) return null;

    // Evita basura vacía o etiquetas demasiado rotas. Si realmente existe en Supabase, se mostrará limpio.
    nombre = cleanRepeatedGrupo(nombre);

    var code = groupNumberFrom(g.codigo || g.numero || g.grupo_codigo || nombre);
    var encargado = encargFrom(g);
    return Object.assign({}, g, {
      _source: source || '',
      _key: groupKey(g),
      codigo: code || txt(g.codigo || g.numero || g.grupo_codigo || ''),
      nombre: nombre,
      encargado: encargado,
      supabaseId: g.supabaseId || g.id || null
    });
  }

  function uniqueGroups(rows, source){
    var map = new Map();
    (rows || []).forEach(function(row){
      var g = normalizeRow(row, source);
      if(!g || !g._key) return;
      var prev = map.get(g._key);
      if(!prev){ map.set(g._key, g); return; }
      // Prioriza Supabase, encargado lleno y nombre más corto/limpio.
      var merged = Object.assign({}, prev, g);
      if(prev._source === 'supabase' && g._source !== 'supabase') merged = Object.assign({}, g, prev);
      if(encargFrom(prev) && !encargFrom(g)) merged.encargado = encargFrom(prev);
      if(g.nombre.length > prev.nombre.length && prev.nombre) merged.nombre = prev.nombre;
      map.set(g._key, normalizeRow(merged, merged._source || source));
    });
    return Array.from(map.values()).sort(function(a,b){
      var ca = groupNumberFrom(a.codigo || a.nombre), cb = groupNumberFrom(b.codigo || b.nombre);
      if(/^\d+$/.test(ca) && /^\d+$/.test(cb)) return Number(ca) - Number(cb);
      return txt(a.nombre).localeCompare(txt(b.nombre),'es');
    });
  }

  function localGroups(){
    var rows = [];
    try{
      if(Array.isArray(window.grupos)) rows = rows.concat(window.grupos);
      if(Array.isArray(window.ownerGroups)) rows = rows.concat(window.ownerGroups);
    }catch(e){}
    return rows;
  }

  async function fetchSupabaseGroups(){
    try{
      var client = window.lotekaSupabase || window.supabaseClient || null;
      if(!client || !client.from) return [];
      var query = client.from('grupos').select('*');
      // No todos los proyectos tienen activo; por eso no dependemos solo de eq('activo', true).
      var res = await query.order('codigo', { ascending:true });
      if(res && res.error){
        console.warn('[Agencias] No se pudieron cargar grupos desde Supabase:', res.error.message || res.error);
        return [];
      }
      return ((res && res.data) || []).filter(function(g){ return g && g.activo !== false; });
    }catch(e){
      console.warn('[Agencias] Error consultando grupos:', e && e.message ? e.message : e);
      return [];
    }
  }

  function optionLabel(g){
    var encargado = encargFrom(g);
    return encargado ? ('Encargado: ' + encargado) : 'Sin encargado asignado';
  }

  function renderDatalist(){
    var dl = el('agenciaGrupoDatalist');
    if(!dl) return;
    dl.innerHTML = cache.map(function(g){
      return '<option value="' + escapeHtml(g.nombre) + '" label="' + escapeHtml(optionLabel(g)) + '"></option>';
    }).join('');
  }

  async function populate(force){
    if(loading) return cache;
    if(cache.length && !force){ renderDatalist(); return cache; }
    loading = true;
    try{
      var db = await fetchSupabaseGroups();
      if(db.length){
        cache = uniqueGroups(db, 'supabase');
        lastSource = 'supabase';
      }else{
        cache = uniqueGroups(localGroups(), 'local');
        lastSource = 'local';
      }
      renderDatalist();
      return cache;
    }finally{
      loading = false;
    }
  }

  function findGroup(value){
    var raw = txt(value);
    if(!raw) return null;
    var code = groupNumberFrom(raw);
    var n = norm(cleanRepeatedGrupo(raw));
    return cache.find(function(g){
      var gCode = groupNumberFrom(g.codigo || g.nombre);
      return (code && gCode === code) || norm(g.nombre) === n || norm(optionLabel(g)) === n;
    }) || null;
  }

  async function autoEncargado(strict){
    await populate(false);
    var groupInput = el('agenciaGrupo');
    var encargadoInput = el('agenciaEncargado');
    var help = el('agenciaGrupoHelp');
    if(!groupInput || !encargadoInput) return null;

    var g = findGroup(groupInput.value);
    if(g){
      groupInput.value = g.nombre;
      encargadoInput.value = encargFrom(g) || 'Sin encargado asignado';
      if(help){
        help.textContent = 'Grupo validado desde ' + (lastSource === 'supabase' ? 'Supabase' : 'catálogo local') + '. Encargado: ' + encargadoInput.value;
        help.style.color = '#0b8db8';
      }
      return g;
    }

    encargadoInput.value = '';
    if(help){
      help.textContent = strict ? 'Selecciona un grupo existente del catálogo.' : 'Escribe y selecciona un grupo existente. No se permiten grupos inventados.';
      help.style.color = strict ? '#d97706' : '#6b7f8f';
    }
    return null;
  }

  window.lotekaPopulateAgenciaGrupos = populate;
  window.lotekaAgenciaGrupoAutoEncargado = autoEncargado;
  window.lotekaGetGrupoAgenciaSeleccionado = function(){ return findGroup(el('agenciaGrupo') && el('agenciaGrupo').value); };

  function wrapOpeners(){
    if(window.__lotekaV174GrupoAgenciaWrapped) return;
    window.__lotekaV174GrupoAgenciaWrapped = true;

    var originalAbrir = window.abrirModalAgencia;
    if(typeof originalAbrir === 'function'){
      window.abrirModalAgencia = function(){
        var r = originalAbrir.apply(this, arguments);
        setTimeout(function(){ populate(true).then(function(){ autoEncargado(false); }); }, 80);
        return r;
      };
    }

    var originalEditar = window.editarAgencia;
    if(typeof originalEditar === 'function'){
      window.editarAgencia = function(){
        var r = originalEditar.apply(this, arguments);
        setTimeout(function(){ populate(true).then(function(){ autoEncargado(false); }); }, 100);
        return r;
      };
    }

    var originalGuardar = window.guardarAgencia;
    if(typeof originalGuardar === 'function'){
      window.guardarAgencia = async function(){
        await populate(false);
        var g = await autoEncargado(true);
        var groupInput = el('agenciaGrupo');
        var encargadoInput = el('agenciaEncargado');
        if(!g){
          alert('Selecciona un grupo existente del catálogo antes de guardar la agencia.');
          if(groupInput) groupInput.focus();
          return;
        }
        if(groupInput) groupInput.value = g.nombre;
        if(encargadoInput) encargadoInput.value = encargFrom(g) || 'Sin encargado asignado';
        return originalGuardar.apply(this, arguments);
      };
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ populate(false); setTimeout(wrapOpeners, 300); });
  }else{
    populate(false); setTimeout(wrapOpeners, 300);
  }
  window.addEventListener('load', function(){ populate(true); setTimeout(wrapOpeners, 500); });
})();

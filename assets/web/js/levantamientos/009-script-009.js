
/* ==========================================================
   LOTEKA · FIX FINAL LEVANTAMIENTOS EN FICHA DE AGENCIA
   - Filtra levantamientos reales por agencia dentro de Consultas > Agencias.
   - Consulta backend futuro directo si hace falta.
   - El botón Ver abre la ficha empresarial completa del levantamiento.
   - No toca la estructura general del sistema.
   ========================================================== */
(function(){
  function onlyDigits(value){ return String(value ?? '').replace(/\D+/g,''); }
  function clean(value){ return String(value ?? '').trim(); }
  function escapeHtmlSafe(value){
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function normalizeAgencyCode(value){
    const digits = onlyDigits(value);
    return digits ? String(Number(digits)) : '';
  }
  function getAgencyCodesFromAgency(agencia){
    const values = [
      agencia?.numero,
      agencia?.codigo_agencia,
      agencia?.agency,
      agencia?.agencyCode,
      agencia?.go,
      agencia?.nombre,
      agencia?.detalle?.go,
      agencia?.detalle?.numeroVisible,
      document.getElementById('agencyFieldNumero')?.value,
      document.getElementById('detalleAgenciaGoCodigo')?.innerText,
      document.getElementById('detalleAgenciaNombre')?.innerText
    ];
    return [...new Set(values.map(normalizeAgencyCode).filter(Boolean))];
  }
  function getAgencyCodesFromLev(record){
    const values = [
      record?.agency,
      record?.agencia,
      record?.codigo_agencia,
      record?.agencyCode,
      record?.go,
      record?.location,
      record?.raw?.codigo_agencia,
      record?.metadata?.codigo_agencia
    ];
    return [...new Set(values.map(normalizeAgencyCode).filter(Boolean))];
  }
  function levBelongsToAgency(record, agencia){
    const agencyCodes = getAgencyCodesFromAgency(agencia);
    const levCodes = getAgencyCodesFromLev(record);
    if(!agencyCodes.length || !levCodes.length) return false;
    return agencyCodes.some(code => levCodes.includes(code));
  }
  function getLevRecordsSafe(){
    const output = [];
    try {
      if(typeof levRecords !== 'undefined' && Array.isArray(levRecords)){
        levRecords.forEach(item => output.push(typeof levNormalizeItem === 'function' ? levNormalizeItem(item) : item));
      }
    } catch(e) {}
    try {
      const key = typeof LEV_STORAGE_KEY !== 'undefined' ? LEV_STORAGE_KEY : 'loteka_operaciones_levantamientos_v2';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if(Array.isArray(stored)) stored.forEach(item => output.push(typeof levNormalizeItem === 'function' ? levNormalizeItem(item) : item));
    } catch(e) {}
    const map = new Map();
    output.forEach(item => {
      if(!item) return;
      const id = clean(item.id || item.code || `${item.agency || item.codigo_agencia || 'x'}-${item.createdAt || item.submittedAt || Math.random()}`);
      if(!map.has(id)) map.set(id, item);
    });
    return Array.from(map.values());
  }
  function sortLevs(list){
    return [...list].sort((a,b) => new Date(b.submittedAt || b.updatedAt || b.visitDate || b.createdAt || 0) - new Date(a.submittedAt || a.updatedAt || a.visitDate || a.createdAt || 0));
  }
  window.agencyGetLevsForAgency = function(agencia){
    return sortLevs(getLevRecordsSafe().filter(item => levBelongsToAgency(item, agencia)));
  };
  function renderLevsRows(tbody, levs){
    if(!tbody) return;
    if(!levs.length){
      tbody.innerHTML = `<tr><td colspan="8"><div class="lev-empty">No hay levantamientos vinculados a esta agencia.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = levs.map(item => {
      const status = item.overallStatus || item.workflowStatus || 'Pendiente de revisión';
      const stClass = /mal|cr[ií]tic|requier/i.test(status) ? 'gold' : (/buen|revis|pend/i.test(status) ? 'blue' : 'gray');
      const id = escapeHtmlSafe(item.id || item.code || '');
      return `<tr>
        <td><strong>${escapeHtmlSafe(item.code || item.id || '-')}</strong></td>
        <td>${escapeHtmlSafe(item.type || item.category || 'Levantamiento técnico')}</td>
        <td>${escapeHtmlSafe(item.technician || item.responsible || '-')}</td>
        <td><span class="status-pill ${stClass}">${escapeHtmlSafe(status)}</span></td>
        <td>${typeof agencyFmtShortDate === 'function' ? agencyFmtShortDate(item.visitDate || item.submittedAt || item.createdAt || '') : escapeHtmlSafe(item.visitDate || '-')}</td>
        <td>${escapeHtmlSafe(item.findingsCount ?? 0)}</td>
        <td><button class="btn-secondary" type="button" onclick="agencyViewLev('${id}')"><i class="fas fa-eye"></i> Ver</button></td>
      </tr>`;
    }).join('');
  }
  async function fetchLevsFromBackendCeroForAgency(agencia){
    try {
      const codes = getAgencyCodesFromAgency(agencia);
      const code = codes[0];
      if(!code) return [];
      if(typeof ltkBridgeConfig === 'undefined') return [];
      const base = clean(ltkBridgeConfig.backendCeroUrl).replace(/\/$/, '');
      const key = clean(ltkBridgeConfig.anonKey);
      if(!base || !key) return [];
      const headers = { apikey:key, Authorization:`Bearer ${key}` };
      const levUrl = `${base}/rest/v1/levantamientos?select=*&codigo_agencia=eq.${encodeURIComponent(code)}&order=created_at.desc`;
      const levResp = await fetch(levUrl, { headers });
      if(!levResp.ok) throw new Error(`No se pudieron leer levantamientos de agencia ${code}: ${levResp.status}`);
      const rows = await levResp.json();
      if(!Array.isArray(rows) || !rows.length) return [];
      const ids = rows.map(r => r.id).filter(v => v !== null && v !== undefined);
      let detailsByLev = {};
      if(ids.length){
        const detailUrl = `${base}/rest/v1/levantamientos_detalle?select=*&levantamiento_id=in.(${ids.join(',')})`;
        const detResp = await fetch(detailUrl, { headers });
        if(detResp.ok){
          const details = await detResp.json();
          (details || []).forEach(row => {
            const k = String(row.levantamiento_id);
            if(!detailsByLev[k]) detailsByLev[k] = [];
            detailsByLev[k].push(row);
          });
        }
      }
      const built = rows.map((row, idx) => {
        if(typeof ltkBuildLevRecord === 'function') return ltkBuildLevRecord(row, detailsByLev, idx);
        return row;
      });
      try {
        if(typeof levRecords !== 'undefined' && Array.isArray(levRecords)){
          const map = new Map(levRecords.map(item => [String(item.id), item]));
          built.forEach(item => map.set(String(item.id), item));
          levRecords = Array.from(map.values()).map(item => typeof levNormalizeItem === 'function' ? levNormalizeItem(item) : item);
          if(typeof levSave === 'function') levSave();
          if(typeof levRender === 'function') levRender();
        }
      } catch(e) {}
      return built;
    } catch(error){
      console.error('Error leyendo levantamientos de la agencia desde BackendCero:', error);
      return [];
    }
  }
  window.agencyRenderLevantamientos = function(agencia){
    const tbody = document.getElementById('agencyLevantamientosBody');
    if(!tbody) return;
    const localLevs = window.agencyGetLevsForAgency(agencia);
    renderLevsRows(tbody, localLevs);
    const codes = getAgencyCodesFromAgency(agencia);
    const fetchKey = codes[0] || '';
    if(fetchKey){
      tbody.dataset.agencyCode = fetchKey;
      fetchLevsFromBackendCeroForAgency(agencia).then(fresh => {
        if(tbody.dataset.agencyCode !== fetchKey) return;
        const mergedMap = new Map(localLevs.map(item => [String(item.id), item]));
        fresh.forEach(item => mergedMap.set(String(item.id), item));
        renderLevsRows(tbody, sortLevs(Array.from(mergedMap.values())));
        try {
          const levCount = document.getElementById('detalleAgenciaLevantamientos');
          if(levCount) levCount.innerText = Array.from(mergedMap.values()).length;
        } catch(e) {}
      });
    }
  };
  window.agencyViewLev = function(id){
    const all = getLevRecordsSafe();
    const item = all.find(row => String(row.id) === String(id) || String(row.code) === String(id));
    if(!item){
      alert('No se encontró el expediente de levantamiento. Actualiza la vista e intenta nuevamente.');
      return;
    }
    try {
      if(typeof levRecords !== 'undefined' && Array.isArray(levRecords) && !levRecords.some(row => String(row.id) === String(item.id))){
        levRecords.unshift(item);
      }
      if(typeof levOpenDetail === 'function'){
        levOpenDetail(item.id);
        return;
      }
    } catch(e) { console.error(e); }
    const lines = [
      `${item.code || item.id || ''} · Agencia ${item.agency || item.codigo_agencia || '-'}`,
      `Tipo: ${item.type || item.category || '-'}`,
      `Técnico: ${item.technician || item.responsible || '-'}`,
      `Estado general: ${item.overallStatus || '-'}`,
      `Fecha: ${typeof agencyFmtShortDate === 'function' ? agencyFmtShortDate(item.visitDate || item.submittedAt || '') : (item.visitDate || '-')}`,
      '',
      item.executiveSummary || item.findings || 'Sin resumen disponible.'
    ];
    alert(lines.join('\n'));
  };
  const originalCambiarSeccionAgencia = window.cambiarSeccionAgencia;
  window.cambiarSeccionAgencia = function(seccion, el){
    if(typeof originalCambiarSeccionAgencia === 'function') originalCambiarSeccionAgencia(seccion, el);
    if(seccion === 'levantamientos'){
      try {
        if(Number.isInteger(agenciaDetalleActualIndex) && agencias[agenciaDetalleActualIndex]){
          window.agencyRenderLevantamientos(agencias[agenciaDetalleActualIndex]);
        }
      } catch(e) { console.error('No se pudo refrescar levantamientos de agencia', e); }
    }
  };
})();

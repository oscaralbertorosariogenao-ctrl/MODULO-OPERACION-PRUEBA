(function (global) {
  'use strict';

  if (global.GOControlTecnico && global.GOControlTecnico.version === '808.30') return;

  const VERSION = '808.30';
  const TABLE = 'control_tecnico_personal';
  const PAGE_SIZES = [10, 20, 50];
  const MAX_EVIDENCE_FILES = 12;
  const MAX_EVIDENCE_BYTES = 15 * 1024 * 1024;

  const STATES = [
    'PENDIENTE', 'POR_VERIFICAR', 'EN_COORDINACION', 'PROGRAMADO', 'EN_PROCESO',
    'FALTA_EQUIPO', 'REQUIERE_CAMBIO', 'REQUIERE_NUEVA_VISITA', 'RESUELTO',
    'NO_REALIZADO', 'ARCHIVADO'
  ];

  const STATE_LABEL = {
    PENDIENTE: 'Pendiente',
    POR_VERIFICAR: 'Por verificar',
    EN_COORDINACION: 'En coordinación',
    PROGRAMADO: 'Programado',
    EN_PROCESO: 'En proceso',
    FALTA_EQUIPO: 'Falta equipo',
    REQUIERE_CAMBIO: 'Requiere cambio',
    REQUIERE_NUEVA_VISITA: 'Requiere nueva visita',
    RESUELTO: 'Resuelto',
    NO_REALIZADO: 'No realizado',
    ARCHIVADO: 'Archivado'
  };

  const CAT_LABEL = {
    INSTALACION: 'Instalación pendiente',
    AVERIA_CAMARA: 'Avería de cámara',
    OTRO: 'Otro seguimiento'
  };

  const CATEGORY_DEFAULT_SUBJECT = {
    INSTALACION: 'Instalación pendiente',
    AVERIA_CAMARA: 'Avería de cámara pendiente',
    OTRO: 'Seguimiento técnico pendiente'
  };

  const state = {
    ready: false,
    items: [],
    filtered: [],
    page: 1,
    pageSize: 10,
    editing: null,
    importRows: [],
    importCategory: null,
    activeCategory: '',
    formEvidence: [],
    pendingFiles: [],
    saving: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const text = (value) => String(value == null ? '' : value).trim();
  const esc = (value) => text(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const padAgency = (value) => {
    const digits = text(value).replace(/\D/g, '');
    return digits ? (digits.length < 4 ? digits.padStart(4, '0') : digits) : '';
  };

  function runtime() {
    return global.GOApp && global.GOApp.__phase2aRuntime ? global.GOApp : null;
  }

  function client() {
    try {
      const appRuntime = runtime();
      const connected = appRuntime && appRuntime.supabase.getClient();
      if (connected && connected.from) return connected;
    } catch (_error) {}
    return global.lotekaSupabase || global.supabaseClient || global.__supabaseClient || null;
  }

  function toast(message, tone = 'info') {
    try {
      if (global.showToast) return global.showToast(message, tone);
    } catch (_error) {}
    (tone === 'error' ? console.error : console.log)('[Control técnico]', message);
  }

  function uuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
  }

  function agencies() {
    return (Array.isArray(global.agencias) ? global.agencias : []).filter((agency) => {
      const status = text(agency.estado || agency.estado_operativo);
      return agency.activo !== false && !/cerrad|inactiv|desactiv/i.test(status);
    });
  }

  function groups() {
    return (Array.isArray(global.grupos) ? global.grupos : []).filter((group) => {
      const label = text(group.nombre || group.codigo);
      return group.activo !== false && !/prueba|test|cerrad|desactiv/i.test(label);
    });
  }

  function agencyId(agency) {
    for (const value of [agency?.supabaseId, agency?.id_supabase, agency?.agencia_id, agency?.id]) {
      if (uuid(value)) return text(value);
    }
    return '';
  }

  function agencyNum(agency) {
    return padAgency(agency?.numero || agency?.codigo || agency?.agencia);
  }

  function agencyName(agency) {
    return text(agency?.nombre || agency?.descripcion || agency?.nombre_agencia) || `Agencia ${agencyNum(agency)}`;
  }

  function groupId(group) {
    for (const value of [group?.supabaseId, group?.id_supabase, group?.grupo_id, group?.id]) {
      if (uuid(value)) return text(value);
    }
    return '';
  }

  function groupLabel(group) {
    return text(group?.codigo || group?.nombre || group?.numero) || 'Sin grupo';
  }

  function normalizeGroupKey(value) {
    return text(value).toLowerCase().replace(/^g\s*[-:]?\s*/i, '').replace(/^0+/, '') || '0';
  }

  function agencyGroupCandidates(agency) {
    return [agency?.grupoId, agency?.grupo_id, agency?.group_id, agency?.grupo, agency?.grupo_codigo, agency?.codigo_grupo, agency?.grupoNumero]
      .map(text).filter(Boolean);
  }

  function groupFor(agency) {
    const candidates = agencyGroupCandidates(agency);
    if (!candidates.length) return null;
    return groups().find((group) => {
      const identifiers = [groupId(group), group?.id, group?.codigo, group?.nombre, group?.numero].map(text).filter(Boolean);
      return candidates.some((candidate) => identifiers.some((identifier) => (
        candidate === identifier || normalizeGroupKey(candidate) === normalizeGroupKey(identifier)
      )));
    }) || null;
  }

  function formatDate(value) {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .format(new Date(`${String(value).slice(0, 10)}T00:00:00`));
    } catch (_error) {
      return text(value);
    }
  }

  function today() {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function isResolved(item) {
    return text(item?.estado).toUpperCase() === 'RESUELTO';
  }

  function normalizeEvidence(value) {
    let list = value;
    if (typeof list === 'string') {
      try { list = JSON.parse(list); } catch (_error) { list = []; }
    }
    if (!Array.isArray(list)) return [];
    return list.map((item, index) => {
      if (typeof item === 'string') return { url: item, name: `Foto ${index + 1}`, type: 'image/*', uploaded_at: null };
      if (!item || typeof item !== 'object' || !text(item.url || item.publicUrl || item.public_url)) return null;
      return {
        url: text(item.url || item.publicUrl || item.public_url),
        name: text(item.name || item.nombre || item.filename || `Foto ${index + 1}`),
        type: text(item.type || item.mime || 'image/*'),
        uploaded_at: item.uploaded_at || item.created_at || null
      };
    }).filter(Boolean);
  }

  function badgeClass(status) {
    if (/RESUELTO/.test(status)) return 'ok';
    if (/FALTA|CAMBIO|NO_REALIZADO/.test(status)) return 'bad';
    if (/PROCESO|PROGRAMADO|COORDINACION/.test(status)) return 'run';
    return 'wait';
  }


  const STATUS_BUCKETS = {
    PENDIENTE: { key: 'PENDIENTES', label: 'Pendientes', order: 10, stateOrder: 10 },
    POR_VERIFICAR: { key: 'PENDIENTES', label: 'Pendientes', order: 10, stateOrder: 20 },
    EN_COORDINACION: { key: 'EN_COORDINACION', label: 'En coordinación', order: 20, stateOrder: 10 },
    FALTA_EQUIPO: { key: 'FALTA_EQUIPO_CAMBIO', label: 'Falta equipo / cambio', order: 30, stateOrder: 10 },
    REQUIERE_CAMBIO: { key: 'FALTA_EQUIPO_CAMBIO', label: 'Falta equipo / cambio', order: 30, stateOrder: 20 },
    PROGRAMADO: { key: 'PROGRAMADO', label: 'Programados', order: 40, stateOrder: 10 },
    EN_PROCESO: { key: 'EN_PROCESO', label: 'En proceso', order: 50, stateOrder: 10 },
    REQUIERE_NUEVA_VISITA: { key: 'REQUIERE_NUEVA_VISITA', label: 'Requiere nueva visita', order: 60, stateOrder: 10 },
    NO_REALIZADO: { key: 'NO_REALIZADO', label: 'No realizado', order: 70, stateOrder: 10 },
    RESUELTO: { key: 'RESUELTO', label: 'Resueltos', order: 80, stateOrder: 10 },
    ARCHIVADO: { key: 'ARCHIVADO', label: 'Archivados', order: 90, stateOrder: 10 }
  };

  const EXPORT_CONFIG = {
    AVERIA_CAMARA: {
      noun: 'avería', nounPlural: 'averías', copyLabel: 'Copiar averías',
      title: 'Averías de cámaras, DVR y teléfonos',
      excelTitle: 'CONTROL TÉCNICO · AVERÍAS DE CÁMARAS, DVR Y TELÉFONOS',
      detailHeader: 'DETALLE DE AVERÍA', sheetName: 'Averías de cámaras', filename: 'Control-Tecnico-Averias'
    },
    INSTALACION: {
      noun: 'instalación', nounPlural: 'instalaciones', copyLabel: 'Copiar instalaciones',
      title: 'Instalaciones pendientes',
      excelTitle: 'CONTROL TÉCNICO · INSTALACIONES PENDIENTES',
      detailHeader: 'DETALLE DE INSTALACIÓN', sheetName: 'Instalaciones', filename: 'Control-Tecnico-Instalaciones'
    }
  };

  function stateBucket(status) {
    return STATUS_BUCKETS[text(status).toUpperCase()] || { key: 'OTROS', label: 'Otros estados', order: 95, stateOrder: 99 };
  }

  function exportGroupLabel(value) {
    const raw = text(value).toUpperCase();
    const match = raw.match(/(?:^|G\s*[-:]?\s*)(\d{1,3})/i) || raw.match(/(\d{1,3})/);
    if (!match) return raw || 'SIN GRUPO';
    return `G-${String(Number(match[1])).padStart(2, '0')}`;
  }

  function numericGroup(value) {
    const match = exportGroupLabel(value).match(/\d+/);
    return match ? Number(match[0]) : 999999;
  }

  function numericAgency(value) {
    const digits = padAgency(value).replace(/\D/g, '');
    return digits ? Number(digits) : 999999;
  }

  function compareOperational(a, b) {
    const bucketA = stateBucket(a.estado), bucketB = stateBucket(b.estado);
    if (bucketA.order !== bucketB.order) return bucketA.order - bucketB.order;
    if (bucketA.stateOrder !== bucketB.stateOrder) return bucketA.stateOrder - bucketB.stateOrder;
    const groupDiff = numericGroup(a.grupo_codigo) - numericGroup(b.grupo_codigo);
    if (groupDiff) return groupDiff;
    const agencyDiff = numericAgency(a.agencia_numero) - numericAgency(b.agencia_numero);
    if (agencyDiff) return agencyDiff;
    return text(a.asunto).localeCompare(text(b.asunto), 'es', { sensitivity: 'base' });
  }

  function activeExportConfig() {
    return EXPORT_CONFIG[state.activeCategory] || null;
  }

  function exportRowsForCategory(category = state.activeCategory) {
    if (!EXPORT_CONFIG[category]) return [];
    return state.filtered
      .filter((item) => item.categoria === category)
      .map((item) => ({
        agencia: padAgency(item.agencia_numero) || text(item.agencia_numero) || '-',
        grupo: exportGroupLabel(item.grupo_codigo),
        detalle: text(item.asunto) || '-',
        estadoCodigo: text(item.estado).toUpperCase(),
        estado: STATE_LABEL[item.estado] || text(item.estado) || '-'
      }))
      .sort((a, b) => {
        const bucketA = stateBucket(a.estadoCodigo), bucketB = stateBucket(b.estadoCodigo);
        if (bucketA.order !== bucketB.order) return bucketA.order - bucketB.order;
        if (bucketA.stateOrder !== bucketB.stateOrder) return bucketA.stateOrder - bucketB.stateOrder;
        const groupDiff = numericGroup(a.grupo) - numericGroup(b.grupo);
        if (groupDiff) return groupDiff;
        const agencyDiff = numericAgency(a.agencia) - numericAgency(b.agencia);
        if (agencyDiff) return agencyDiff;
        return a.detalle.localeCompare(b.detalle, 'es', { sensitivity: 'base' });
      });
  }

  function groupedExportRows(rows) {
    const groupsMap = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const bucket = stateBucket(row.estadoCodigo);
      if (!groupsMap.has(bucket.key)) groupsMap.set(bucket.key, { ...bucket, rows: [] });
      groupsMap.get(bucket.key).rows.push(row);
    });
    return Array.from(groupsMap.values()).sort((a, b) => a.order - b.order);
  }

  function currentFilterSummary() {
    const parts = [];
    const search = text($('#goct-search')?.value);
    const status = $('#goct-state')?.value || '';
    const group = $('#goct-group')?.value || '';
    if (search) parts.push(`Búsqueda: ${search}`);
    if (status) parts.push(`Estado: ${STATE_LABEL[status] || status}`);
    if (group) {
      const selected = $('#goct-group')?.selectedOptions?.[0]?.textContent;
      parts.push(`Grupo: ${text(selected) || exportGroupLabel(group)}`);
    }
    return parts.length ? parts.join(' · ') : 'Sin filtros adicionales';
  }

  function clipboardExportText(rows, config) {
    const sections = groupedExportRows(rows);
    const lines = [config.title + ':', ''];
    sections.forEach((section, sectionIndex) => {
      lines.push(`${section.label.toUpperCase()} (${section.rows.length})`);
      section.rows.forEach((row) => lines.push(`${row.agencia} ${row.grupo}: ${row.detalle} — ${row.estado}`));
      if (sectionIndex < sections.length - 1) lines.push('');
    });
    return lines.join('\n');
  }

  async function copyText(value) {
    if (navigator.clipboard && global.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('El navegador no permitió copiar al portapapeles.');
  }

  async function copyCurrentCategory() {
    const config = activeExportConfig();
    const rows = exportRowsForCategory();
    if (!config || !rows.length) return toast('No hay registros para copiar con los filtros actuales.', 'error');
    try {
      await copyText(clipboardExportText(rows, config));
      toast(`${rows.length} ${rows.length === 1 ? config.noun : config.nounPlural} copiada${rows.length === 1 ? '' : 's'} al portapapeles.`, 'success');
    } catch (error) {
      toast(error.message || 'No se pudieron copiar los registros.', 'error');
    }
  }

  function xmlSafe(value) {
    return text(value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function excelColumnName(number) {
    let value = Number(number), name = '';
    while (value > 0) { value -= 1; name = String.fromCharCode(65 + (value % 26)) + name; value = Math.floor(value / 26); }
    return name;
  }

  function xlsxInlineCell(column, row, value, style = 0) {
    const ref = `${excelColumnName(column)}${row}`;
    return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlSafe(value)}</t></is></c>`;
  }

  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds() / 2)) & 31),
      date: (((year - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31)
    };
  }

  function writeU16(view, offset, value) { view.setUint16(offset, value & 0xFFFF, true); }
  function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
  function concatBytes(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length); let offset = 0;
    parts.forEach((part) => { output.set(part, offset); offset += part.length; });
    return output;
  }

  function zipStore(entries) {
    const encoder = new TextEncoder();
    const localParts = [], centralParts = [];
    let localOffset = 0;
    const stamp = dosDateTime();
    entries.forEach((entry) => {
      const name = encoder.encode(entry.name);
      const data = entry.data instanceof Uint8Array ? entry.data : encoder.encode(String(entry.data));
      const crc = crc32(data);
      const local = new Uint8Array(30); const lv = new DataView(local.buffer);
      writeU32(lv, 0, 0x04034B50); writeU16(lv, 4, 20); writeU16(lv, 6, 0x0800); writeU16(lv, 8, 0);
      writeU16(lv, 10, stamp.time); writeU16(lv, 12, stamp.date); writeU32(lv, 14, crc); writeU32(lv, 18, data.length); writeU32(lv, 22, data.length); writeU16(lv, 26, name.length); writeU16(lv, 28, 0);
      localParts.push(local, name, data);

      const central = new Uint8Array(46); const cv = new DataView(central.buffer);
      writeU32(cv, 0, 0x02014B50); writeU16(cv, 4, 20); writeU16(cv, 6, 20); writeU16(cv, 8, 0x0800); writeU16(cv, 10, 0);
      writeU16(cv, 12, stamp.time); writeU16(cv, 14, stamp.date); writeU32(cv, 16, crc); writeU32(cv, 20, data.length); writeU32(cv, 24, data.length); writeU16(cv, 28, name.length); writeU16(cv, 30, 0); writeU16(cv, 32, 0); writeU16(cv, 34, 0); writeU16(cv, 36, 0); writeU32(cv, 38, 0); writeU32(cv, 42, localOffset);
      centralParts.push(central, name);
      localOffset += local.length + name.length + data.length;
    });
    const localBytes = concatBytes(localParts), centralBytes = concatBytes(centralParts);
    const end = new Uint8Array(22); const ev = new DataView(end.buffer);
    writeU32(ev, 0, 0x06054B50); writeU16(ev, 4, 0); writeU16(ev, 6, 0); writeU16(ev, 8, entries.length); writeU16(ev, 10, entries.length); writeU32(ev, 12, centralBytes.length); writeU32(ev, 16, localBytes.length); writeU16(ev, 20, 0);
    return concatBytes([localBytes, centralBytes, end]);
  }

  function stateExcelStyle(statusCode, alternate) {
    const bucket = stateBucket(statusCode);
    if (bucket.key === 'PENDIENTES') return alternate ? 7 : 6;
    if (bucket.key === 'EN_COORDINACION') return alternate ? 9 : 8;
    if (bucket.key === 'FALTA_EQUIPO_CAMBIO') return alternate ? 11 : 10;
    if (bucket.key === 'RESUELTO') return alternate ? 13 : 12;
    return alternate ? 5 : 4;
  }

  function buildControlWorkbook(rows, config, filterSummary = '') {
    const encoder = new TextEncoder();
    const now = new Date();
    const generated = new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(now);
    const dataStartRow = 6;
    const lastRow = dataStartRow + rows.length - 1;
    const rowXml = rows.map((row, index) => {
      const r = dataStartRow + index, alternate = index % 2 === 1, baseStyle = alternate ? 5 : 4;
      return `<row r="${r}" ht="28" customHeight="1">${xlsxInlineCell(1, r, row.agencia, baseStyle)}${xlsxInlineCell(2, r, row.grupo, baseStyle)}${xlsxInlineCell(3, r, row.detalle, baseStyle)}${xlsxInlineCell(4, r, row.estado, stateExcelStyle(row.estadoCodigo, alternate))}</row>`;
    }).join('');
    const filterEnd = Math.max(5, lastRow);
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:D${filterEnd}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="2" width="12" customWidth="1"/><col min="3" max="3" width="58" customWidth="1"/><col min="4" max="4" width="23" customWidth="1"/></cols><sheetData><row r="1" ht="32" customHeight="1">${xlsxInlineCell(1, 1, config.excelTitle, 1)}</row><row r="2" ht="22" customHeight="1">${xlsxInlineCell(1, 2, `Grupo Ortiz · ${rows.length} registro${rows.length === 1 ? '' : 's'} · Generado ${generated}`, 2)}</row><row r="3" ht="22" customHeight="1">${xlsxInlineCell(1, 3, filterSummary || 'Sin filtros adicionales', 2)}</row><row r="4" ht="8" customHeight="1"></row><row r="5" ht="26" customHeight="1">${xlsxInlineCell(1, 5, 'AGENCIA', 3)}${xlsxInlineCell(2, 5, 'GRUPO', 3)}${xlsxInlineCell(3, 5, config.detailHeader, 3)}${xlsxInlineCell(4, 5, 'ESTADO', 3)}</row>${rowXml}</sheetData><autoFilter ref="A5:D${filterEnd}"/><mergeCells count="3"><mergeCell ref="A1:D1"/><mergeCell ref="A2:D2"/><mergeCell ref="A3:D3"/></mergeCells><pageMargins left="0.35" right="0.35" top="0.55" bottom="0.55" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" horizontalDpi="300" verticalDpi="300"/></worksheet>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF547086"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="10"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF075F8F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B78AE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7FBFD"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4CC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F5FF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE8E6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F7ED"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F0FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9E6EE"/></left><right style="thin"><color rgb="FFD9E6EE"/></right><top style="thin"><color rgb="FFD9E6EE"/></top><bottom style="thin"><color rgb="FFD9E6EE"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="14"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" horizontal="left"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" horizontal="left"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="15000"/></bookViews><sheets><sheet name="${xmlSafe(config.sheetName)}" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>`;
    const entries = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
      { name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Grupo Ortiz</Application><AppVersion>808.30</AppVersion></Properties>` },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlSafe(config.title)}</dc:title><dc:creator>Grupo Ortiz</dc:creator><cp:lastModifiedBy>Grupo Ortiz</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:modified></cp:coreProperties>` },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: styles },
      { name: 'xl/worksheets/sheet1.xml', data: sheet }
    ].map((entry) => ({ name: entry.name, data: encoder.encode(entry.data) }));
    return zipStore(entries);
  }

  function downloadBytes(bytes, filename, mime) {
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportCurrentExcel() {
    const config = activeExportConfig();
    const rows = exportRowsForCategory();
    if (!config || !rows.length) return toast('No hay registros para exportar con los filtros actuales.', 'error');
    try {
      const bytes = buildControlWorkbook(rows, config, currentFilterSummary());
      downloadBytes(bytes, `${config.filename}-${today()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      toast(`Excel generado correctamente: ${rows.length} registro${rows.length === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      console.error('[Control técnico] Error generando XLSX', error);
      toast(error.message || 'No se pudo generar el Excel.', 'error');
    }
  }

  function printCurrentCategory() {
    const config = activeExportConfig();
    const rows = exportRowsForCategory();
    if (!config || !rows.length) return toast('No hay registros para imprimir con los filtros actuales.', 'error');
    const popup = global.open('', '_blank', 'noopener,noreferrer');
    if (!popup) return toast('El navegador bloqueó la ventana de impresión. Habilita ventanas emergentes e inténtalo de nuevo.', 'error');
    const generated = new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    const sections = groupedExportRows(rows);
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(config.title)}</title><style>@page{size:landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#173f59;margin:0}h1{font-size:22px;margin:0 0 4px}.meta{font-size:11px;color:#617b8d;margin-bottom:16px}.section{margin:0 0 18px;break-inside:avoid}.section h2{font-size:13px;margin:0;padding:8px 10px;background:#eaf6fc;border:1px solid #cfe4ef}.section table{width:100%;border-collapse:collapse}.section th,.section td{border:1px solid #d5e5ee;padding:7px 8px;font-size:11px;text-align:left;vertical-align:top}.section th{background:#f4f9fc}.agency{width:12%}.group{width:10%}.status{width:19%}.detail{width:59%}</style></head><body><h1>${esc(config.excelTitle)}</h1><div class="meta">Grupo Ortiz · ${rows.length} registros · ${esc(generated)}<br>${esc(currentFilterSummary())}</div>${sections.map((section) => `<div class="section"><h2>${esc(section.label.toUpperCase())} · ${section.rows.length}</h2><table><thead><tr><th class="agency">Agencia</th><th class="group">Grupo</th><th class="detail">Detalle</th><th class="status">Estado</th></tr></thead><tbody>${section.rows.map((row) => `<tr><td>${esc(row.agencia)}</td><td>${esc(row.grupo)}</td><td>${esc(row.detalle)}</td><td>${esc(row.estado)}</td></tr>`).join('')}</tbody></table></div>`).join('')}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),120));<\/script></body></html>`;
    popup.document.open(); popup.document.write(html); popup.document.close();
  }

  function updateExportActions() {
    const config = activeExportConfig();
    const rows = config ? exportRowsForCategory() : [];
    const copy = $('#goct-copy-averias'), excel = $('#goct-excel-averias'), pdf = $('#goct-pdf-export');
    [copy, excel, pdf].forEach((button) => {
      if (!button) return;
      button.hidden = !config;
      button.disabled = !config || !rows.length;
    });
    if (copy && config) {
      copy.innerHTML = `<i class="fas fa-copy"></i> ${config.copyLabel}`;
      copy.title = rows.length ? `${config.copyLabel}: ${rows.length} registro(s) filtrado(s)` : 'No hay registros con los filtros actuales.';
    }
    if (excel && config) excel.title = rows.length ? `Exportar ${rows.length} registro(s) a Excel` : 'No hay registros con los filtros actuales.';
    if (pdf && config) pdf.title = rows.length ? `Imprimir o guardar PDF de ${rows.length} registro(s)` : 'No hay registros con los filtros actuales.';
  }

  function injectStyles() {
    if ($('#goct-style')) return;
    const style = document.createElement('style');
    style.id = 'goct-style';
    style.textContent = `
      #goct-root{font-family:Inter,system-ui;color:#103b5b;padding-bottom:34px}.goct-hero{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:24px;border-radius:22px;border:1px solid #cde2ef;background:linear-gradient(135deg,#f7fcff,#e8f7ff);box-shadow:0 15px 34px rgba(18,73,109,.08);margin-bottom:15px}.goct-hero h2{margin:0;font-size:28px;color:#0b4166}.goct-hero p{margin:7px 0 0;color:#647f93}.goct-actions,.goct-tabs,.goct-pagination{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.goct-btn{border:1px solid #c9ddea;background:#fff;color:#086796;border-radius:11px;padding:10px 13px;font-weight:900;cursor:pointer;transition:.16s ease}.goct-btn:hover:not(:disabled){transform:translateY(-1px)}.goct-btn:disabled{opacity:.5;cursor:not-allowed}.goct-btn.primary{border:0;color:#fff;background:linear-gradient(135deg,#087dbb,#05a8d4)}.goct-btn.danger{color:#b42318}.goct-btn.small{padding:7px 9px;font-size:12px}.goct-tabs{background:#edf6fb;padding:5px;border-radius:13px;width:max-content;max-width:100%;margin-bottom:14px}.goct-tab{border:0;background:transparent;color:#607b8e;padding:9px 14px;border-radius:9px;font-weight:900;cursor:pointer}.goct-tab.active{background:#fff;color:#0870a4;box-shadow:0 4px 13px #aac6d655}.goct-stats{display:grid;grid-template-columns:repeat(5,minmax(125px,1fr));gap:11px;margin-bottom:14px}.goct-stat,.goct-card{background:#fff;border:1px solid #d6e5ef;border-radius:17px;padding:16px;box-shadow:0 10px 24px rgba(11,61,95,.055)}.goct-stat span{font-size:11px;color:#6b8497;font-weight:900;text-transform:uppercase}.goct-stat strong{display:block;font-size:26px;margin-top:4px;color:#0b456d}.goct-card-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.goct-card h3{margin:0}.goct-toolbar{display:grid;grid-template-columns:2fr repeat(2,minmax(150px,1fr)) auto;gap:10px;margin-bottom:12px}.goct-export-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.goct-btn.export{background:#eef9f1;border-color:#b9dec4;color:#176a36}.goct-btn.copy{background:#f4f9fc}.goct-input,.goct-select,.goct-textarea{width:100%;box-sizing:border-box;border:1px solid #c8dce8;border-radius:11px;padding:10px 11px;font:inherit;background:#fff}.goct-table-wrap{overflow:auto;border:1px solid #dbe8f0;border-radius:14px}.goct-table{width:100%;border-collapse:collapse;min-width:1120px}.goct-table th,.goct-table td{padding:11px;border-bottom:1px solid #e7eff4;text-align:left;font-size:13px;vertical-align:top}.goct-table th{background:#eff8fc;color:#5e788c;font-size:11px;text-transform:uppercase;position:sticky;top:0}.goct-table tr:hover td{background:#f9fdff}.goct-badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:1000}.goct-badge.ok{background:#e5f8ed;color:#087448}.goct-badge.bad{background:#fff0ef;color:#b42318}.goct-badge.run{background:#e7f5ff;color:#08689c}.goct-badge.wait{background:#fff7dc;color:#876400}.goct-empty{text-align:center;padding:35px;color:#71899a}.goct-pagination{justify-content:space-between;margin-top:12px}.goct-pages{display:flex;gap:6px;align-items:center}.goct-page{min-width:34px;height:34px;border:1px solid #d0e0e9;border-radius:9px;background:#fff;font-weight:900;cursor:pointer}.goct-page.active{background:#0786bd;color:#fff;border-color:#0786bd}.goct-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#072c4775;z-index:11000;padding:20px}.goct-modal.open{display:flex}.goct-dialog{width:min(920px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:20px;box-shadow:0 30px 80px #071c2c66}.goct-dialog.viewer{width:min(1040px,96vw)}.goct-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.goct-field.full{grid-column:1/-1}.goct-field label{display:block;font-size:11px;font-weight:1000;color:#5c7588;text-transform:uppercase;margin-bottom:6px}.goct-preview{max-height:380px;overflow:auto;border:1px solid #d8e6ef;border-radius:13px}.goct-preview-row{display:grid;grid-template-columns:95px 120px 1fr 125px;gap:8px;padding:9px 11px;border-bottom:1px solid #eaf1f5;font-size:12px}.goct-private{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:#e9f8ee;color:#087449;font-weight:900;font-size:12px}.goct-help{padding:11px 13px;border-radius:12px;background:#f4f9fc;border:1px solid #d7e8f1;color:#5d788c;font-size:12px;line-height:1.5}.goct-evidence-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:10px;margin-top:10px}.goct-evidence-card{position:relative;border:1px solid #d4e4ed;border-radius:13px;overflow:hidden;background:#f6fbfd;min-height:125px}.goct-evidence-card img{display:block;width:100%;height:105px;object-fit:cover}.goct-evidence-card span{display:block;padding:7px 8px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.goct-evidence-remove{position:absolute;right:6px;top:6px;width:28px;height:28px;border:0;border-radius:999px;background:#a61b1bea;color:#fff;cursor:pointer;font-weight:900}.goct-viewer-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:13px}.goct-viewer-item{border:1px solid #d7e5ed;border-radius:14px;overflow:hidden;background:#f8fcfe}.goct-viewer-item img{display:block;width:100%;height:210px;object-fit:contain;background:#0b1d2b}.goct-viewer-item div{padding:9px;font-size:12px}.goct-upload-status{display:none;padding:10px 12px;border-radius:11px;background:#e9f7ff;color:#075f8c;font-weight:900;margin-top:10px}.goct-upload-status.show{display:block}@media(max-width:1100px){.goct-stats{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.goct-hero{align-items:flex-start;flex-direction:column}.goct-stats{grid-template-columns:repeat(2,1fr)}.goct-toolbar{grid-template-columns:1fr}.goct-grid{grid-template-columns:1fr}.goct-field.full{grid-column:auto}.goct-tabs{width:100%;overflow:auto;flex-wrap:nowrap}.goct-tab{white-space:nowrap}}
    `;
    document.head.appendChild(style);
  }

  function injectView() {
    const host = $('#vista-ops-control-tecnico');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    host.innerHTML = `
      <div id="goct-root">
        <section class="goct-hero"><div><span class="goct-private"><i class="fas fa-lock"></i> Control interno</span><h2>Control técnico</h2><p>Seguimiento de instalaciones, averías de cámaras y acciones técnicas. Los levantamientos fotográficos se administran en el módulo Levantamientos por grupo.</p></div><div class="goct-actions"><button class="goct-btn" id="goct-open-surveys"><i class="fas fa-clipboard-check"></i> Abrir Levantamientos</button><button class="goct-btn" id="goct-import"><i class="fas fa-paste"></i> Entrada rápida</button><button class="goct-btn primary" id="goct-new"><i class="fas fa-plus"></i> Nuevo registro</button></div></section>
        <div class="goct-tabs"><button class="goct-tab active" data-cat="">Todos activos</button><button class="goct-tab" data-cat="INSTALACION">Instalaciones</button><button class="goct-tab" data-cat="AVERIA_CAMARA">Averías de cámaras</button><button class="goct-tab" data-cat="RESUELTO">Resueltos</button></div>
        <div class="goct-stats"><div class="goct-stat"><span>Total activo</span><strong id="goct-s-total">0</strong></div><div class="goct-stat"><span>Pendientes</span><strong id="goct-s-pending">0</strong></div><div class="goct-stat"><span>En coordinación</span><strong id="goct-s-process">0</strong></div><div class="goct-stat"><span>Falta equipo/cambio</span><strong id="goct-s-equipment">0</strong></div><div class="goct-stat"><span>Resueltos</span><strong id="goct-s-resolved">0</strong></div></div>
        <section class="goct-card"><div class="goct-card-head"><div><h3 id="goct-list-title">Seguimiento activo</h3><small id="goct-count-label">0 registros</small></div><div class="goct-export-actions"><button class="goct-btn small copy" id="goct-copy-averias" hidden><i class="fas fa-copy"></i> Copiar</button><button class="goct-btn small export" id="goct-excel-averias" hidden><i class="fas fa-file-excel"></i> Exportar Excel</button><button class="goct-btn small" id="goct-pdf-export" hidden><i class="fas fa-print"></i> Imprimir / PDF</button><button class="goct-btn small" id="goct-refresh"><i class="fas fa-rotate"></i> Actualizar</button></div></div><div class="goct-toolbar"><input class="goct-input" id="goct-search" placeholder="Buscar agencia, problema, equipo o nota"><select class="goct-select" id="goct-state"><option value="">Todos los estados</option>${STATES.map((item) => `<option value="${item}">${STATE_LABEL[item]}</option>`).join('')}</select><select class="goct-select" id="goct-group"><option value="">Todos los grupos</option></select><button class="goct-btn" id="goct-clear">Limpiar</button></div><div id="goct-table"></div><div class="goct-pagination"><div><select class="goct-select" id="goct-size" style="width:auto">${PAGE_SIZES.map((size) => `<option ${size === 10 ? 'selected' : ''}>${size}</option>`).join('')}</select> <small>por página</small></div><div class="goct-pages" id="goct-pages"></div></div></section>
      </div>
      <div class="goct-modal" id="goct-form-modal"><div class="goct-dialog"><div class="goct-card-head"><div><h3 id="goct-form-title">Nuevo registro</h3><small>Control técnico interno</small></div><button class="goct-btn" data-close="goct-form-modal">Cerrar</button></div><div class="goct-grid"><div class="goct-field"><label>Categoría</label><select class="goct-select" id="goct-f-cat"><option value="INSTALACION">Instalación pendiente</option><option value="AVERIA_CAMARA">Avería de cámara</option><option value="OTRO">Otro seguimiento</option></select></div><div class="goct-field"><label>Agencia</label><select class="goct-select" id="goct-f-agency"></select></div><div class="goct-field"><label>Tipo / equipo</label><input class="goct-input" id="goct-f-equipment" placeholder="Ej. Registro fotográfico, cámara domo, PTZ"></div><div class="goct-field"><label>Estado</label><select class="goct-select" id="goct-f-state">${STATES.map((item) => `<option value="${item}">${STATE_LABEL[item]}</option>`).join('')}</select></div><div class="goct-field"><label>Fecha reportada</label><input class="goct-input" type="date" id="goct-f-date"></div><div class="goct-field full"><label>Problema / trabajo pendiente</label><textarea class="goct-textarea" rows="3" id="goct-f-subject" placeholder="Describe la instalación, avería o levantamiento pendiente"></textarea></div><div class="goct-field full"><label>Observaciones</label><textarea class="goct-textarea" rows="3" id="goct-f-notes"></textarea></div><div class="goct-field full"><label>Fotos / evidencias técnicas</label><input class="goct-input" type="file" id="goct-f-files" accept="image/*" multiple><div class="goct-help">Puedes tomar o seleccionar hasta ${MAX_EVIDENCE_FILES} fotos para documentar la instalación o avería.</div><div class="goct-upload-status" id="goct-upload-status"></div><div class="goct-evidence-grid" id="goct-form-evidence"></div></div></div><div class="goct-actions" style="justify-content:flex-end;margin-top:16px"><button class="goct-btn" data-close="goct-form-modal">Cancelar</button><button class="goct-btn primary" id="goct-save">Guardar</button></div></div></div>
      <div class="goct-modal" id="goct-import-modal"><div class="goct-dialog"><div class="goct-card-head"><div><h3 id="goct-import-title">Entrada rápida</h3><small>Pega listas desde WhatsApp o Bloc de notas</small></div><button class="goct-btn" data-close="goct-import-modal">Cerrar</button></div><div id="goct-import-rule" class="goct-help" style="margin-bottom:12px">Todos los registros se guardarán en la categoría seleccionada.</div><div class="goct-field"><label>Texto</label><textarea class="goct-textarea" rows="9" id="goct-import-text" placeholder="1502 (DOMO)\n1576 (PTZ)\n1175 G-11 (verificar)\n1058 G-11: 17-7-2026"></textarea></div><div class="goct-actions" style="margin:12px 0"><div id="goct-import-category-label" class="goct-private">Categoría</div><button class="goct-btn" id="goct-preview-btn">Analizar lista</button></div><div class="goct-preview" id="goct-preview"><div class="goct-empty">Pega una lista y pulsa Analizar.</div></div><div class="goct-actions" style="justify-content:flex-end;margin-top:14px"><button class="goct-btn primary" id="goct-import-save" disabled>Guardar registros válidos</button></div></div></div>
      <div class="goct-modal" id="goct-viewer-modal"><div class="goct-dialog viewer"><div class="goct-card-head"><div><h3 id="goct-viewer-title">Evidencias</h3><small id="goct-viewer-subtitle"></small></div><button class="goct-btn" data-close="goct-viewer-modal">Cerrar</button></div><div class="goct-viewer-grid" id="goct-viewer-grid"></div></div></div>
    `;
  }

  function fillAgencyOptions() {
    const agencySelect = $('#goct-f-agency');
    if (!agencySelect) return;
    const validAgencies = agencies().filter((agency) => agencyId(agency));
    agencySelect.innerHTML = '<option value="">Selecciona una agencia</option>' + validAgencies
      .sort((a, b) => Number(agencyNum(a)) - Number(agencyNum(b)))
      .map((agency) => `<option value="${agencyId(agency)}">AG ${agencyNum(agency)} · ${esc(agencyName(agency))} · ${esc(groupLabel(groupFor(agency)))}</option>`)
      .join('');
    const groupFilter = $('#goct-group');
    if (groupFilter) {
      groupFilter.innerHTML = '<option value="">Todos los grupos</option>' + groups()
        .sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), 'es', { numeric: true }))
        .map((group) => `<option value="${groupId(group) || esc(groupLabel(group))}">${esc(groupLabel(group))}</option>`).join('');
    }
  }

  function updateContextActions() {
    const importButton = $('#goct-import');
    const listTitle = $('#goct-list-title');
    const category = state.activeCategory;
    if (listTitle) listTitle.textContent = category === 'RESUELTO' ? 'Registros resueltos' : (category ? CAT_LABEL[category] : 'Seguimiento activo');
    if (!importButton) return;
    const importable = ['INSTALACION', 'AVERIA_CAMARA'].includes(category);
    importButton.disabled = !importable;
    importButton.title = importable ? '' : 'Selecciona Instalaciones o Averías para usar la entrada rápida.';
    importButton.innerHTML = category === 'AVERIA_CAMARA' ? '<i class="fas fa-paste"></i> Entrada rápida de averías' : category === 'INSTALACION' ? '<i class="fas fa-paste"></i> Entrada rápida de instalaciones' : '<i class="fas fa-paste"></i> Entrada rápida';
    updateExportActions();
  }

  function open(navElement) {
    injectStyles(); injectView(); bind();
    const link = navElement || $('#navControlTecnico');
    if (typeof global.cambiarVista === 'function') global.cambiarVista('ops-control-tecnico', link);
    else {
      $$('[id^="vista-"]').forEach((view) => view.classList.add('hidden'));
      $('#vista-ops-control-tecnico')?.classList.remove('hidden');
      $$('.sidebar-link').forEach((item) => item.classList.remove('active'));
      link?.classList.add('active');
    }
    try { global.setSidebarSectionOpen?.('operaciones', true); } catch (_error) {}
    fillAgencyOptions(); updateContextActions(); load();
  }

  async function load() {
    const connected = client();
    if (!connected) return toast('No se encontró conexión con Supabase.', 'error');
    $('#goct-table').innerHTML = '<div class="goct-empty">Cargando control técnico…</div>';
    try {
      const response = await connected.from(TABLE).select('*').order('creado_en', { ascending: false });
      if (response.error) throw response.error;
      state.items = (response.data || []).filter((item) => item.categoria !== 'LEVANTAMIENTO').map((item) => ({ ...item, evidencias: normalizeEvidence(item.evidencias) }));
      applyFilters(); renderStats();
    } catch (error) {
      toast(error.message || 'No se pudo cargar Control técnico.', 'error');
      $('#goct-table').innerHTML = '<div class="goct-empty">No se pudieron cargar los registros.</div>';
    }
  }

  function renderStats() {
    const activeItems = state.items.filter((item) => !isResolved(item));
    $('#goct-s-total').textContent = activeItems.length;
    $('#goct-s-pending').textContent = activeItems.filter((item) => ['PENDIENTE', 'POR_VERIFICAR'].includes(item.estado)).length;
    $('#goct-s-process').textContent = activeItems.filter((item) => item.estado === 'EN_COORDINACION').length;
    $('#goct-s-equipment').textContent = activeItems.filter((item) => ['FALTA_EQUIPO', 'REQUIERE_CAMBIO'].includes(item.estado)).length;
    $('#goct-s-resolved').textContent = state.items.filter(isResolved).length;
  }

  function applyFilters() {
    const query = text($('#goct-search')?.value).toLowerCase();
    const status = $('#goct-state')?.value || '';
    const group = $('#goct-group')?.value || '';
    const activeTab = state.activeCategory || '';
    state.filtered = state.items.filter((item) => {
      if (activeTab === 'RESUELTO') { if (!isResolved(item)) return false; }
      else { if (isResolved(item)) return false; if (activeTab && item.categoria !== activeTab) return false; }
      if (status && item.estado !== status) return false;
      if (group && item.grupo_id !== group && normalizeGroupKey(item.grupo_codigo) !== normalizeGroupKey(group)) return false;
      if (query) {
        const searchable = [item.agencia_numero, item.grupo_codigo, item.asunto, item.equipo, item.observaciones, CAT_LABEL[item.categoria], STATE_LABEL[item.estado]].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    }).sort(compareOperational);
    const pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    if (state.page > pages) state.page = pages;
    renderTable(); renderPagination(); updateContextActions(); updateExportActions();
  }

  function renderTable() {
    const start = (state.page - 1) * state.pageSize;
    const list = state.filtered.slice(start, start + state.pageSize);
    $('#goct-count-label').textContent = `${state.filtered.length} registros`;
    if (!list.length) { $('#goct-table').innerHTML = '<div class="goct-empty">No hay registros para estos filtros.</div>'; return; }
    $('#goct-table').innerHTML = `<div class="goct-table-wrap"><table class="goct-table"><thead><tr><th>Agencia</th><th>Grupo</th><th>Categoría</th><th>Equipo / tipo</th><th>Problema o pendiente</th><th>Fecha</th><th>Fotos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${list.map((item) => {
      const evidence = normalizeEvidence(item.evidencias);
      return `<tr><td><b>AG ${esc(item.agencia_numero || '-')}</b></td><td>${esc(item.grupo_codigo || '-')}</td><td>${esc(CAT_LABEL[item.categoria] || item.categoria)}</td><td>${esc(item.equipo || '-')}</td><td>${esc(item.asunto || '-')}${item.observaciones ? `<br><small>${esc(item.observaciones)}</small>` : ''}</td><td>${formatDate(item.fecha_reportada)}</td><td>${evidence.length ? `<button class="goct-btn small" data-view="${item.id}"><i class="fas fa-images"></i> ${evidence.length}</button>` : '<span>-</span>'}</td><td><span class="goct-badge ${badgeClass(item.estado)}">${esc(STATE_LABEL[item.estado] || item.estado)}</span></td><td><div class="goct-actions"><button class="goct-btn small" data-edit="${item.id}">Editar</button>${!isResolved(item) ? `<button class="goct-btn small" data-control-survey="${item.id}">Levantamiento</button><button class="goct-btn small" data-resolve="${item.id}">Resolver</button>` : ''}<button class="goct-btn small danger" data-delete="${item.id}">Eliminar</button></div></td></tr>`;
    }).join('')}</tbody></table></div>`;
    const table = $('#goct-table');
    $$('[data-edit]', table).forEach((button) => { button.onclick = () => editItem(button.dataset.edit); });
    $$('[data-control-survey]', table).forEach((button) => { button.onclick = () => openControlSurvey(button.dataset.controlSurvey); });
    $$('[data-resolve]', table).forEach((button) => { button.onclick = () => quickResolve(button.dataset.resolve); });
    $$('[data-delete]', table).forEach((button) => { button.onclick = () => deleteItem(button.dataset.delete); });
    $$('[data-view]', table).forEach((button) => { button.onclick = () => viewEvidence(button.dataset.view); });
  }

  function renderPagination() {
    const pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    const wrap = $('#goct-pages'); if (!wrap) return;
    let buttons = `<button class="goct-page" data-page="${Math.max(1, state.page - 1)}" ${state.page === 1 ? 'disabled' : ''}>‹</button>`;
    const from = Math.max(1, state.page - 2), to = Math.min(pages, from + 4);
    for (let page = from; page <= to; page += 1) buttons += `<button class="goct-page ${page === state.page ? 'active' : ''}" data-page="${page}">${page}</button>`;
    buttons += `<button class="goct-page" data-page="${Math.min(pages, state.page + 1)}" ${state.page === pages ? 'disabled' : ''}>›</button><small>Página ${state.page} de ${pages}</small>`;
    wrap.innerHTML = buttons;
    $$('[data-page]', wrap).forEach((button) => { button.onclick = () => { state.page = Number(button.dataset.page); renderTable(); renderPagination(); }; });
  }

  function categoryForNewItem() {
    return ['INSTALACION', 'AVERIA_CAMARA'].includes(state.activeCategory) ? state.activeCategory : 'INSTALACION';
  }

  function newItem() {
    state.editing = null; state.formEvidence = []; state.pendingFiles = [];
    const category = categoryForNewItem();
    $('#goct-form-title').textContent = 'Nuevo registro'; $('#goct-f-cat').value = category; $('#goct-f-agency').value = '';
    $('#goct-f-equipment').value = '';
    $('#goct-f-state').value = 'PENDIENTE'; $('#goct-f-date').value = today();
    $('#goct-f-subject').value = CATEGORY_DEFAULT_SUBJECT[category]; $('#goct-f-notes').value = ''; $('#goct-f-files').value = '';
    setUploadStatus(''); renderFormEvidence(); $('#goct-form-modal').classList.add('open');
  }

  function editItem(id) {
    const item = state.items.find((record) => record.id === id); if (!item) return;
    state.editing = item; state.formEvidence = normalizeEvidence(item.evidencias); state.pendingFiles = [];
    $('#goct-form-title').textContent = 'Editar registro'; $('#goct-f-cat').value = item.categoria; $('#goct-f-agency').value = item.agencia_id || '';
    $('#goct-f-equipment').value = item.equipo || ''; $('#goct-f-state').value = item.estado;
    $('#goct-f-date').value = item.fecha_reportada || today(); $('#goct-f-subject').value = item.asunto || ''; $('#goct-f-notes').value = item.observaciones || '';
    $('#goct-f-files').value = ''; setUploadStatus(''); renderFormEvidence(); $('#goct-form-modal').classList.add('open');
  }

  function setUploadStatus(message) {
    const element = $('#goct-upload-status'); if (!element) return;
    element.textContent = message; element.classList.toggle('show', Boolean(message));
  }

  function renderFormEvidence() {
    const wrap = $('#goct-form-evidence'); if (!wrap) return;
    const existingCards = state.formEvidence.map((item, index) => `<div class="goct-evidence-card"><button type="button" class="goct-evidence-remove" data-remove-existing="${index}" title="Quitar foto">×</button><img src="${esc(item.url)}" alt="${esc(item.name)}" loading="lazy"><span>${esc(item.name)}</span></div>`);
    const pendingCards = state.pendingFiles.map((item, index) => `<div class="goct-evidence-card"><button type="button" class="goct-evidence-remove" data-remove-pending="${index}" title="Quitar foto">×</button><img src="${esc(item.preview)}" alt="${esc(item.file.name)}"><span>${esc(item.file.name)} · pendiente</span></div>`);
    wrap.innerHTML = [...existingCards, ...pendingCards].join('') || '<div class="goct-help">Todavía no hay fotos agregadas.</div>';
    $$('[data-remove-existing]', wrap).forEach((button) => { button.onclick = () => { state.formEvidence.splice(Number(button.dataset.removeExisting), 1); renderFormEvidence(); }; });
    $$('[data-remove-pending]', wrap).forEach((button) => { button.onclick = () => { const removed = state.pendingFiles.splice(Number(button.dataset.removePending), 1)[0]; if (removed?.preview) URL.revokeObjectURL(removed.preview); renderFormEvidence(); }; });
  }

  function addPendingFiles(fileList) {
    const incoming = Array.from(fileList || []); if (!incoming.length) return;
    const available = MAX_EVIDENCE_FILES - state.formEvidence.length - state.pendingFiles.length;
    if (available <= 0) return toast(`Solo se permiten ${MAX_EVIDENCE_FILES} fotos por registro.`, 'error');
    const accepted = [];
    for (const file of incoming.slice(0, available)) {
      if (!text(file.type).startsWith('image/')) { toast(`${file.name}: solo se permiten imágenes.`, 'error'); continue; }
      if (file.size > MAX_EVIDENCE_BYTES) { toast(`${file.name}: supera el límite de 15 MB.`, 'error'); continue; }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    state.pendingFiles.push(...accepted); $('#goct-f-files').value = ''; renderFormEvidence();
  }

  async function apiAuthHeaders() {
    try { if (typeof global.lotekaGetApiAuthHeaders === 'function') return await global.lotekaGetApiAuthHeaders(); } catch (_error) {}
    try {
      const response = await client()?.auth?.getSession?.(); const token = response?.data?.session?.access_token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch (_error) { return {}; }
  }

  async function uploadEvidence(file, agencyNumber, index, total) {
    const form = new FormData(); form.append('file', file, file.name || `foto-${Date.now()}.jpg`); form.append('codigo', `control-tecnico-AG-${agencyNumber || 'sin-agencia'}`); form.append('origen', 'control-tecnico-web');
    setUploadStatus(`Subiendo foto ${index + 1} de ${total}…`);
    const response = await fetch('/api/r2-upload', { method: 'POST', headers: await apiAuthHeaders(), body: form, cache: 'no-store', credentials: 'same-origin' });
    const raw = await response.text(); let result = {}; try { result = raw ? JSON.parse(raw) : {}; } catch (_error) {}
    if (!response.ok || result.ok === false) throw new Error(result.message || result.error || `No se pudo subir ${file.name}.`);
    const url = result.url || result.publicUrl || result.public_url || result.location; if (!url) throw new Error(`R2 no devolvió la URL de ${file.name}.`);
    return { url, name: file.name || `Foto ${index + 1}`, type: file.type || 'image/*', uploaded_at: new Date().toISOString() };
  }

  async function uploadPendingEvidence(agencyNumber) {
    const uploaded = [];
    for (let index = 0; index < state.pendingFiles.length; index += 1) uploaded.push(await uploadEvidence(state.pendingFiles[index].file, agencyNumber, index, state.pendingFiles.length));
    return uploaded;
  }

  async function saveItem() {
    if (state.saving) return;
    const connected = client(); if (!connected) return toast('No se encontró conexión con Supabase.', 'error');
    const agencyIdValue = $('#goct-f-agency').value;
    const agency = agencies().find((item) => agencyId(item) === agencyIdValue); if (!agency) return toast('Selecciona una agencia.', 'error');
    const category = $('#goct-f-cat').value, selectedStatus = $('#goct-f-state').value, subject = text($('#goct-f-subject').value);
    const totalEvidence = state.formEvidence.length + state.pendingFiles.length;
    if (!subject) return toast('Describe el trabajo o problema.', 'error');
    const group = groupFor(agency), saveButton = $('#goct-save'); state.saving = true; saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando';
    try {
      const uploaded = await uploadPendingEvidence(agencyNum(agency));
      const payload = {
        categoria: category, agencia_id: agencyIdValue, agencia_numero: agencyNum(agency), grupo_id: group ? groupId(group) || null : null,
        grupo_codigo: group ? groupLabel(group) : null, equipo: text($('#goct-f-equipment').value) || null, asunto: subject,
        estado: selectedStatus, fecha_reportada: $('#goct-f-date').value || today(),
        fecha_resolucion: selectedStatus === 'RESUELTO' ? (state.editing?.fecha_resolucion || new Date().toISOString()) : null,
        observaciones: text($('#goct-f-notes').value) || null, evidencias: [...state.formEvidence, ...uploaded]
      };
      const response = state.editing ? await connected.from(TABLE).update(payload).eq('id', state.editing.id) : await connected.from(TABLE).insert(payload);
      if (response.error) throw response.error;
      state.pendingFiles.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)); state.pendingFiles = [];
      $('#goct-form-modal').classList.remove('open'); toast(state.editing ? 'Registro actualizado.' : 'Registro creado.', 'success'); await load();
    } catch (error) { toast(error.message || 'No se pudo guardar el registro.', 'error'); }
    finally { state.saving = false; saveButton.disabled = false; saveButton.innerHTML = 'Guardar'; setUploadStatus(''); }
  }

  async function quickResolve(id) {
    const item = state.items.find((record) => record.id === id); if (!item) return;
    if (!global.confirm('¿Marcar este registro como resuelto? Se quitará de las listas activas y pasará a Resueltos.')) return;
    try {
      const response = await client().from(TABLE).update({ estado: 'RESUELTO', fecha_resolucion: new Date().toISOString() }).eq('id', id);
      if (response.error) throw response.error; toast('Marcado como resuelto y movido a Resueltos.', 'success'); await load();
    } catch (error) { toast(error.message || 'No se pudo resolver el registro.', 'error'); }
  }

  async function deleteItem(id) {
    if (!global.confirm('¿Eliminar este registro de Control técnico? Esta acción no elimina la agencia ni sus operaciones.')) return;
    try { const response = await client().from(TABLE).delete().eq('id', id); if (response.error) throw response.error; toast('Registro eliminado.', 'success'); await load(); }
    catch (error) { toast(error.message || 'No se pudo eliminar el registro.', 'error'); }
  }

  function viewEvidence(id) {
    const item = state.items.find((record) => record.id === id); if (!item) return;
    const evidence = normalizeEvidence(item.evidencias);
    $('#goct-viewer-title').textContent = `Evidencias · AG ${item.agencia_numero || '-'}`;
    $('#goct-viewer-subtitle').textContent = `${CAT_LABEL[item.categoria] || item.categoria} · ${evidence.length} foto(s)`;
    $('#goct-viewer-grid').innerHTML = evidence.map((photo, index) => `<a class="goct-viewer-item" href="${esc(photo.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(photo.url)}" alt="${esc(photo.name || `Foto ${index + 1}`)}" loading="lazy"><div>${esc(photo.name || `Foto ${index + 1}`)}</div></a>`).join('') || '<div class="goct-empty">Este registro no tiene evidencias.</div>';
    $('#goct-viewer-modal').classList.add('open');
  }

  function openControlSurvey(id) {
    const item = state.items.find((record) => record.id === id);
    if (!item) return toast('No se encontró el registro técnico.', 'error');
    const agency = agencies().find((record) => agencyId(record) === text(item.agencia_id) || agencyNum(record) === padAgency(item.agencia_numero));
    const group = agency ? groupFor(agency) : groups().find((record) => normalizeGroupKey(groupLabel(record)) === normalizeGroupKey(item.grupo_codigo));
    if (!agency || !group) return toast('No se pudo identificar la agencia o su grupo.', 'error');
    if (!global.GOLevantamientosGrupos) return toast('El módulo Levantamientos todavía no está disponible.', 'error');
    global.GOLevantamientosGrupos.openFromControl({
      controlId: item.id,
      originId: item.id,
      agencyId: agencyId(agency),
      groupId: groupId(group),
      groupCode: groupLabel(group),
      responsible: '',
      name: `Levantamiento técnico · ${item.asunto || CAT_LABEL[item.categoria] || 'Control técnico'}`,
      metadata: { control_categoria: item.categoria, control_equipo: item.equipo || null }
    });
  }

  function parseDate(line) {
    const match = line.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/); if (!match) return null;
    let year = Number(match[3]); if (year < 100) year += 2000;
    return `${year}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  }

  function parseImport() {
    const category = state.importCategory;
    if (!['INSTALACION', 'AVERIA_CAMARA'].includes(category)) return toast('La categoría de entrada rápida no está definida.', 'error');
    state.importRows = text($('#goct-import-text').value).split(/\n+/).map(text).filter(Boolean).map((line, index) => {
      const agencyNumber = padAgency((line.match(/^\s*(\d{1,5})/) || [])[1]);
      const groupMatch = line.match(/G\s*[-:]?\s*(\d{1,3})/i), reportedDate = parseDate(line);
      let equipment = '';
      const parenthesis = line.match(/\(([^)]+)\)/); if (parenthesis) equipment = text(parenthesis[1]);
      if (/\bDOMO\b/i.test(line)) equipment = 'Cámara domo'; if (/\bPTZ\b/i.test(line)) equipment = 'Cámara PTZ';
      const agency = agencies().find((item) => agencyNum(item) === agencyNumber && agencyId(item)); const group = agency ? groupFor(agency) : null;
      let subject = line.replace(/^\s*\d{1,5}\s*/, '').replace(/G\s*[-:]?\s*\d{1,3}/i, '').replace(/\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b/, '').replace(/[():-]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!subject) subject = CATEGORY_DEFAULT_SUBJECT[category];
      return { line: index + 1, valid: Boolean(agency), agency, agencia_numero: agencyNumber, grupo_codigo: group ? groupLabel(group) : (groupMatch ? `G-${groupMatch[1]}` : '-'), categoria: category, equipo: equipment, asunto: subject, fecha_reportada: reportedDate || today(), estado: /cambiar/i.test(line) ? 'REQUIERE_CAMBIO' : /verificar/i.test(line) ? 'POR_VERIFICAR' : 'PENDIENTE' };
    });
    renderImportPreview();
  }

  function renderImportPreview() {
    const preview = $('#goct-preview');
    if (!state.importRows.length) { preview.innerHTML = '<div class="goct-empty">No se detectaron líneas.</div>'; $('#goct-import-save').disabled = true; return; }
    preview.innerHTML = '<div class="goct-preview-row" style="font-weight:900;background:#eef7fb"><span>Agencia</span><span>Grupo</span><span>Detalle</span><span>Resultado</span></div>' + state.importRows.map((row) => `<div class="goct-preview-row"><span>AG ${esc(row.agencia_numero || '-')}</span><span>${esc(row.grupo_codigo)}</span><span>${esc(row.asunto)}${row.equipo ? ` · ${esc(row.equipo)}` : ''}</span><span>${row.valid ? '✅ Válido' : '⚠️ No existe'}</span></div>`).join('');
    $('#goct-import-save').disabled = !state.importRows.some((row) => row.valid);
  }

  async function saveImport() {
    const rows = state.importRows.filter((row) => row.valid).map((row) => {
      const group = groupFor(row.agency);
      return { categoria: state.importCategory, agencia_id: agencyId(row.agency), agencia_numero: row.agencia_numero, grupo_id: group ? groupId(group) || null : null, grupo_codigo: row.grupo_codigo, equipo: row.equipo || null, asunto: row.asunto, estado: row.estado, fecha_reportada: row.fecha_reportada, observaciones: 'Importado desde entrada rápida', evidencias: [] };
    });
    if (!rows.length) return;
    try { const response = await client().from(TABLE).insert(rows); if (response.error) throw response.error; toast(`${rows.length} registros guardados.`, 'success'); $('#goct-import-modal').classList.remove('open'); $('#goct-import-text').value = ''; state.importRows = []; await load(); }
    catch (error) { toast(error.message || 'No se pudo guardar la entrada rápida.', 'error'); }
  }

  function openImport(category) {
    const chosen = category || state.activeCategory;
    if (!['INSTALACION', 'AVERIA_CAMARA'].includes(chosen)) return toast('Selecciona primero Instalaciones o Averías de cámaras.', 'error');
    state.importCategory = chosen; state.importRows = [];
    const label = CAT_LABEL[chosen] || chosen;
    $('#goct-import-title').textContent = `Entrada rápida — ${label}`; $('#goct-import-category-label').textContent = label; $('#goct-import-rule').textContent = `Todos los registros de esta entrada se guardarán en ${label}.`;
    $('#goct-preview').innerHTML = '<div class="goct-empty">Pega una lista y pulsa Analizar.</div>'; $('#goct-import-save').disabled = true; $('#goct-import-modal').classList.add('open');
  }

  function closeModal(id) {
    $(`#${id}`)?.classList.remove('open');
    if (id === 'goct-import-modal') { state.importCategory = null; state.importRows = []; }
    if (id === 'goct-form-modal' && !state.saving) { state.pendingFiles.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)); state.pendingFiles = []; state.formEvidence = []; }
  }

  function bind() {
    if (state.ready) return; state.ready = true; state.activeCategory = $('.goct-tab.active', $('#goct-root'))?.dataset.cat || '';
    $('#goct-new').onclick = newItem; $('#goct-import').onclick = () => openImport(); $('#goct-copy-averias').onclick = copyCurrentCategory; $('#goct-excel-averias').onclick = exportCurrentExcel; $('#goct-pdf-export').onclick = printCurrentCategory; $('#goct-open-surveys').onclick = () => global.GOLevantamientosGrupos ? global.GOLevantamientosGrupos.open($('#navLevantamientos')) : toast('El módulo Levantamientos todavía no está disponible.','error'); $('#goct-refresh').onclick = load; $('#goct-save').onclick = saveItem; $('#goct-preview-btn').onclick = parseImport; $('#goct-import-save').onclick = saveImport; $('#goct-f-files').onchange = (event) => addPendingFiles(event.target.files);
    $('#goct-search').oninput = () => { state.page = 1; applyFilters(); };
    ['#goct-state', '#goct-group'].forEach((selector) => { $(selector).onchange = () => { state.page = 1; applyFilters(); }; });
    $('#goct-clear').onclick = () => { $('#goct-search').value = ''; $('#goct-state').value = ''; $('#goct-group').value = ''; state.page = 1; applyFilters(); };
    $('#goct-size').onchange = (event) => { state.pageSize = Number(event.target.value); state.page = 1; applyFilters(); };
    $$('.goct-tab', $('#goct-root')).forEach((button) => { button.onclick = () => { $$('.goct-tab', $('#goct-root')).forEach((item) => item.classList.remove('active')); button.classList.add('active'); state.activeCategory = button.dataset.cat || ''; state.page = 1; applyFilters(); }; });
    const host = $('#vista-ops-control-tecnico');
    $$('[data-close]', host).forEach((button) => { button.onclick = () => closeModal(button.dataset.close); });
    $$('.goct-modal', host).forEach((modal) => { modal.onclick = (event) => { if (event.target === modal) closeModal(modal.id); }; });
  }

  function init() {
    injectStyles(); injectView(); bind(); fillAgencyOptions(); updateContextActions();
    try { runtime()?.modules.register('control-tecnico-personal', { version: VERSION, open, refresh: load }); } catch (_error) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
  global.GOControlTecnico = { version: VERSION, open, refresh: load, openLevantamiento: openControlSurvey };
})(window);

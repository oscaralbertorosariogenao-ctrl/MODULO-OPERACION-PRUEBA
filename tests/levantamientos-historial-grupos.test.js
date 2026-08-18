import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../assets/web/js/operaciones/080-loteka-v80700-levantamientos-grupos.js', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('Historial por Grupo usa las tablas y RPC reales instalados', () => {
  assert.match(source, /ops_levantamiento_historial_grupos/);
  assert.match(source, /ops_levantamiento_historial_agencias/);
  assert.match(source, /ops_levantamiento_historial_guardar_manual_v1/);
  assert.match(source, /ops_levantamiento_historial_eliminar_manual_v1/);
  assert.match(source, /ops_levantamiento_historial_sincronizar_automatico_v1/);
});

test('la nueva pestaña se integra en el módulo actual sin crear un módulo Jotform paralelo', () => {
  assert.match(source, /data-main="HISTORY">Historial por grupo/);
  assert.match(source, /data-main-panel="HISTORY"/);
  assert.match(source, /Registros = agencias únicas seleccionadas/);
  assert.doesNotMatch(source, /golevg-history-manual-photo|golevg-history-manual-evidence/);
});

test('manual usa un Set de agencias y no permite escribir el número de registros', () => {
  assert.match(source, /historyManualSelectedAgencyIds: new Set\(\)/);
  assert.match(source, /state\.historyManualSelectedAgencyIds\.size \+ locked/);
  assert.match(source, /id="golevg-history-manual-records"/);
  assert.doesNotMatch(source, /id="golevg-history-manual-records"[^>]*type="number"/);
});

test('filtro de período usa intersección Desde-Hasta', () => {
  assert.match(source, /filters\.from && text\(item\.fecha_hasta\) < filters\.from/);
  assert.match(source, /filters\.to && text\(item\.fecha_desde\) > filters\.to/);
});

test('automático se sincroniza al cerrar la campaña y no al recibir cada Jotform', () => {
  const toggleStart = source.indexOf('async function toggleCampaign');
  const toggleEnd = source.indexOf('\n  async function openCampaign', toggleStart);
  const toggle = source.slice(toggleStart, toggleEnd);
  assert.match(toggle, /next === 'CERRADO'/);
  assert.match(toggle, /ops_levantamiento_historial_sincronizar_automatico_v1/);
  assert.doesNotMatch(toggle, /ops_jotform_levantamientos_ingresos/);
});

test('históricos automáticos quedan protegidos de editar/eliminar desde la UI', () => {
  assert.match(source, /item\.origen === 'MANUAL' && canManage\(\)/);
  assert.match(source, /item\.origen === 'AUTOMATICO' && item\.campana_origen_id/);
  assert.match(source, /record\.origen !== 'MANUAL'/);
});

test('Excel de historial es XLSX real con filtro, encabezado congelado y fechas tipadas', () => {
  assert.match(source, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(source, /state=\\?"frozen\\?"/);
  assert.match(source, /<autoFilter ref=/);
  assert.match(source, /numFmtId=\\?"14\\?"/);
  assert.match(source, /\.xlsx`/);
});

test('no se agrega una segunda dependencia Excel', () => {
  assert.equal(Boolean(pkg.dependencies?.xlsx), false);
  assert.equal(Boolean(pkg.dependencies?.exceljs), false);
});

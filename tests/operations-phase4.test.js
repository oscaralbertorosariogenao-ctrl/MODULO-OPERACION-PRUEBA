import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const index = read('../index.html');
const core = read('../assets/web/js/core/005-const-demo-user-email-admin-empresa-com-password-1234.js');
const domain = read('../assets/web/js/operaciones/081-loteka-v80820-reportes-bandeja.js');
const rendimiento = read('../assets/web/js/operaciones/065-loteka-v300-rendimiento-js.js');
const css = read('../assets/web/css/operaciones/070-go-operations-domain.css');

const canonicalStates = ['Reportado','Asignado','En proceso','En incidencia','Completado','Resuelto por soporte remoto'];

test('Operaciones expone un dominio oficial con lifecycle y render controlado', () => {
  assert.match(domain, /global\.GOApp\.operations\.domain=api/);
  assert.match(domain, /scheduleRender/);
  assert.match(domain, /function mount\(\)/);
  assert.match(domain, /function destroy\(\)/);
  assert.match(domain, /AbortController/);
  assert.match(domain, /global\.renderOperations=render/);
});

test('filtros del listado usan un único adaptador dinámico y debounce', () => {
  assert.match(core, /function requestActiveOperationsRender\(immediate = false\)/);
  assert.match(core, /domain\.scheduleRender\(\{ immediate \}\)/);
  assert.match(domain, /global\.setTimeout\(\(\)=>\{renderTimer=0;render\(\);\},120\)/);
  assert.equal(domain.includes("document.getElementById(id)?.addEventListener('input',render)"), false);
});

test('listado elimina Restablecer datos y separa actualizar de limpiar filtros', () => {
  assert.equal(index.includes('id="resetDataBtn"'), false);
  assert.match(index, /id="refreshOperationsBtn"/);
  assert.match(index, /id="clearOperationsFiltersBtn"/);
  assert.match(domain, /async function refresh\(/);
  assert.match(domain, /syncOperationsFromBackendCero/);
  assert.match(domain, /function clearFilters\(\)/);
});

test('estados de Operaciones son canónicos en listado y filtros de reportes', () => {
  for (const state of canonicalStates) {
    assert.equal(domain.includes(`'${state}'`), true, `dominio sin ${state}`);
    assert.equal(index.includes(`<option value="${state}">${state}</option>`), true, `HTML sin opción ${state}`);
  }
  assert.match(core, /function canonicalOperationStatus\(status\)/);
  assert.match(core, /function isOperationTerminalStatus\(status\)/);
  assert.match(core, /\['Completado', 'Resuelto por soporte remoto'\]/);
  assert.match(core, /Resuelto por soporte remoto<\/span>/);
  assert.match(index, /<span>Cerradas<\/span><strong id="reportStatDone">/);
  assert.match(index, /<span>Activas<\/span><strong id="reportStatPending">/);
});

test('modal moderno usa accesibilidad y tokens, sin CSS inyectado ni z-index arbitrario', () => {
  assert.match(domain, /role="dialog" aria-modal="true"/);
  assert.match(domain, /event\.key==='Escape'/);
  assert.match(domain, /event\.key!=='Tab'/);
  assert.match(domain, /previousFocus/);
  assert.equal(domain.includes('installStyles'), false);
  assert.equal(domain.includes('1000025'), false);
  assert.match(css, /z-index:var\(--go-z-modal\)/);
  assert.equal(css.includes('!important'), false);
});

test('acciones de Operaciones usan namespace propio y neutralizan el listener legacy al guardar', () => {
  assert.match(domain, /data-go-ops-action=/);
  assert.equal(domain.includes('data-v808-action='), false);
  assert.match(domain, /event\.stopImmediatePropagation\(\)/);
  assert.match(domain, /rpc_operacion_reportar_v3/);
  assert.match(domain, /rpc_operacion_asignar_v2/);
  assert.match(domain, /rpc_operacion_resolver_soporte_remoto_v2/);
});

test('estilos de dominio están scopeados y excluyen subdominios con fase propia', () => {
  assert.match(css, /\.go-ops-domain/);
  assert.match(index, /<div class="[^"]*go-ops-domain[^"]*" id="vista-ops-operaciones"/);
  for (const id of ['vista-ops-levantamientos','vista-ops-mantenimiento','vista-ops-control-tecnico']) {
    const match = index.match(new RegExp(`<div class="([^"]*)" id="${id}"`));
    assert.ok(match, `no aparece ${id}`);
    assert.equal(match[1].includes('go-ops-domain'), false, `${id} no debe migrarse en esta fase`);
  }
});

test('Rendimiento adopta terminología canónica sin rediseñar su lógica', () => {
  assert.match(rendimiento, /Reportado → Asignado/);
  assert.match(rendimiento, /Asignado → En proceso/);
  assert.match(rendimiento, /En proceso → Cerrada/);
  assert.equal(rendimiento.includes('Pendiente → Asignada'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  normalizeOperationStatus,
  isActiveOperationStatus,
  isTerminalOperationStatus
} from '../assets/app/js/operation-status.js';
import { validatePushRequestBody } from '../api/_push-contract.js';

test('Operaciones normaliza variantes sin cambiar otros dominios globalmente', () => {
  assert.equal(normalizeOperationStatus('Asignada'), 'Asignado');
  assert.equal(normalizeOperationStatus('ASIGNADO'), 'Asignado');
  assert.equal(normalizeOperationStatus('Completada'), 'Completado');
  assert.equal(normalizeOperationStatus('cerrada'), 'Completado');
  assert.equal(normalizeOperationStatus('resuelto por soporte remoto'), 'Resuelto por soporte remoto');
  assert.equal(normalizeOperationStatus('en incidencia'), 'En incidencia');
  assert.equal(normalizeOperationStatus('pendiente'), 'Reportado');
});

test('Operaciones distingue estados activos y terminales', () => {
  assert.equal(isActiveOperationStatus('Asignada'), true);
  assert.equal(isActiveOperationStatus('En proceso'), true);
  assert.equal(isActiveOperationStatus('En incidencia'), true);
  assert.equal(isActiveOperationStatus('Completado'), false);
  assert.equal(isTerminalOperationStatus('Completada'), true);
  assert.equal(isTerminalOperationStatus('Resuelto por soporte remoto'), true);
  assert.equal(isTerminalOperationStatus('Asignado'), false);
});

test('Push acepta solo el contrato oficial username/title/body/url', () => {
  assert.deepEqual(validatePushRequestBody({
    username: 'tecnico.real',
    title: 'Operación asignada',
    body: 'Tienes una nueva operación.',
    url: '/app.html#/operations/1'
  }), {
    ok: true,
    value: {
      username: 'tecnico.real',
      title: 'Operación asignada',
      body: 'Tienes una nueva operación.',
      url: '/app.html#/operations/1'
    }
  });

  assert.equal(validatePushRequestBody({ subscription: {}, title: 'x', body: 'y', username: 'u' }).code, 'UNSUPPORTED_FIELDS');
  assert.equal(validatePushRequestBody({ username: 'u', title: 'x', body: 'y', url: 'https://evil.example' }).code, 'INVALID_URL');
});

test('runtime web no contiene credencial demo activa', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const core = fs.readFileSync(new URL('../assets/web/js/core/005-const-demo-user-email-admin-empresa-com-password-1234.js', import.meta.url), 'utf8');
  assert.equal(index.includes('value="admin@empresa.com"'), false);
  assert.equal(index.includes('value="1234"'), false);
  assert.equal(core.includes("const DEMO_USER"), false);
  assert.equal(core.includes("localStorage.setItem('operations_session'"), false);
});

test('version.json es la fuente sincronizada', () => {
  execFileSync('python3', ['tools/sync_version.py', '--check'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
});

test('scripts web de cache/build consumen la versión canónica del HTML', () => {
  const updater = fs.readFileSync(new URL('../assets/web/js/pwa/068-loteka-capa7-version-safe-update.js', import.meta.url), 'utf8');
  const cacheHelper = fs.readFileSync(new URL('../assets/web/js/pwa/014-loteka-menu-refresh-cache-fix-js.js', import.meta.url), 'utf8');
  const dispatches = fs.readFileSync(new URL('../assets/web/js/despachos/073-loteka-v410-control-despachos-rpc-js.js', import.meta.url), 'utf8');
  for (const source of [updater, cacheHelper, dispatches]) {
    assert.match(source, /meta\[name=[\"]grupo-ortiz-build/);
  }
});

test('Service Worker conserva activación explícita', () => {
  const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
  assert.match(sw, /data\.type === "LOTEKA_ACTIVATE_NEW_VERSION"/);
  assert.match(sw, /userRequestedActivation = true;[\s\S]{0,200}self\.skipWaiting\(\)/);
  assert.match(sw, /if \(userRequestedActivation\) await clients\.claim\(\)/);
  assert.match(sw, /assets\/app\/js\/operation-status\.js/);
});

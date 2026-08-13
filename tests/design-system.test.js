import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

const tokens = read('../assets/shared/css/go-design-tokens.css');
const components = read('../assets/web/css/design-system/go-components.css');
const appTokens = read('../assets/app/css/tokens.css');
const index = read('../index.html');
const pantalla = read('../pantalla.html');
const sw = read('../service-worker.js');

test('Design System declara la escala oficial requerida', () => {
  const required = [
    '--go-brand-navy:', '--go-brand-blue:', '--go-brand-cyan:',
    '--go-color-bg:', '--go-color-surface:', '--go-color-border:', '--go-color-text:', '--go-color-text-muted:',
    '--go-color-success:', '--go-color-warning:', '--go-color-danger:', '--go-color-info:',
    '--go-space-1:', '--go-space-4:', '--go-space-8:',
    '--go-radius-sm:', '--go-radius-md:', '--go-radius-lg:',
    '--go-shadow-subtle:', '--go-shadow-card:', '--go-shadow-floating:',
    '--go-z-base:', '--go-z-sticky:', '--go-z-dropdown:', '--go-z-overlay:', '--go-z-modal:', '--go-z-toast:',
    '--go-control-min-height:'
  ];
  for (const token of required) assert.equal(tokens.includes(token), true, `falta ${token}`);
});

test('tokens compartidos preservan los valores visuales móviles anteriores', () => {
  assert.match(tokens, /--go-brand-navy-950:\s*#061d33/);
  assert.match(tokens, /--go-brand-navy-900:\s*#082844/);
  assert.match(tokens, /--go-brand-navy-800:\s*#0b3a67/);
  assert.match(tokens, /--go-blue-700:\s*#0b5fa5/);
  assert.match(tokens, /--go-blue-600:\s*var\(--go-brand-blue-600\)/);
  assert.match(tokens, /--go-brand-blue-600:\s*#1479c9/);
  assert.match(tokens, /--go-brand-sky:\s*#39a9e8/);
  assert.match(tokens, /--go-color-bg:\s*#f3f7fb/);
  assert.match(tokens, /--go-color-border:\s*#dce7f0/);
  assert.match(tokens, /--go-color-text:\s*#13283b/);
});

test('app móvil consume tokens compartidos y conserva solo tokens de shell propios', () => {
  assert.match(appTokens, /@import url\('\.\.\/\.\.\/shared\/css\/go-design-tokens\.css'\)/);
  assert.match(appTokens, /--header-h:/);
  assert.match(appTokens, /--nav-h:/);
  assert.equal(appTokens.includes('--go-navy-900:#082844'), false);
  assert.equal(appTokens.includes('--go-success:#178a55'), false);
});

test('web y pantalla de monitoreo cargan el Design System sin sustituir el CSS legacy', () => {
  for (const html of [index, pantalla]) {
    assert.match(html, /assets\/shared\/css\/go-design-tokens\.css/);
    assert.match(html, /assets\/web\/css\/design-system\/go-components\.css/);
  }
  assert.match(index, /id="grupo-ortiz-web-bundle-inline"/);
  assert.match(pantalla, /data-go-theme="dark"/);
});

test('componentes web son opt-in y no redefinen selectores legacy genéricos', () => {
  assert.match(components, /\.go-ui-btn/);
  assert.match(components, /\.go-ui-card/);
  assert.match(components, /\.go-ui-field/);
  assert.match(components, /\.go-ui-badge/);
  assert.match(components, /\.go-ui-table/);
  assert.match(components, /\.go-ui-state/);
  assert.match(components, /\.go-ui-modal/);
  assert.equal(/(^|\n)\s*(body|html|button|input|select|textarea|\.btn|\.card)\s*[{,]/m.test(components), false);
});

test('Design System está precacheado para no introducir regresión offline', () => {
  assert.match(sw, /\/assets\/shared\/css\/go-design-tokens\.css/);
  assert.match(sw, /\/assets\/web\/css\/design-system\/go-components\.css/);
});

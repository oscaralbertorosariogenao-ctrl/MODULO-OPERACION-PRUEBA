
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const tokens = read('../assets/shared/css/go-design-tokens.css');
const base = read('../assets/web/css/ui/002-root');
const topbar = read('../assets/web/css/ui/018-loteka-v75-global-topbar-css.css');
const sidebar = read('../assets/web/css/ui/022-sidebar-profesional-v206.css');
const mobile = read('../assets/web/css/ui/024-loteka-v218-responsive-mobile-safe-css.css');
const account = read('../assets/web/css/legacy/053-loteka-v180-account-menu-css.css');
const nav = read('../assets/web/js/core/006-function-setsidebarsectionopen-sectionname-forceopen.js');
const toggle = read('../assets/web/js/pwa/014-loteka-menu-refresh-cache-fix-js.js');
const bundle = read('../assets/web/css/grupo-ortiz-web.bundle.css');
const index = read('../index.html');

test('Shell utiliza dimensiones y escalas oficiales del Design System', () => {
  for (const token of ['--go-shell-topbar-height:','--go-shell-topbar-height-mobile:','--go-shell-sidebar-width:','--go-shell-content-pad-x:']) {
    assert.equal(tokens.includes(token), true, `falta ${token}`);
  }
  assert.match(topbar, /z-index:var\(--go-z-sticky\)/);
  assert.match(account, /z-index:var\(--go-z-dropdown\)/);
  assert.match(base, /\.modal\{z-index:var\(--go-z-overlay\)/);
});

test('Shell activo consume tokens oficiales en lugar de mini-paletas duplicadas', () => {
  assert.match(base, /--bg:var\(--go-color-bg\)/);
  assert.match(sidebar, /--go-sidebar-blue:var\(--go-brand-blue\)/);
  assert.match(topbar, /var\(--go-brand-navy-950\)/);
  assert.equal(sidebar.includes('--go-sidebar-blue:#049fd0'), false);
});

test('Sidebar mantiene navegación legacy y añade accesibilidad progresiva', () => {
  assert.match(nav, /function cambiarVista\(vista, el\)/);
  assert.match(nav, /aria-expanded/);
  assert.match(nav, /setupSidebarLinkAccessibility/);
  assert.match(nav, /event\.key !== 'Enter' && event\.key !== ' '/);
});

test('Sidebar móvil funciona como drawer cerrable sin cambiar rutas', () => {
  assert.match(mobile, /width:min\(88vw,310px\)/);
  assert.match(toggle, /ltkSidebarBackdrop/);
  assert.match(toggle, /event\.key !== 'Escape'/);
  assert.match(nav, /closeSidebarOnMobile/);
});

test('fuentes shell modificadas están sincronizadas dentro del bundle e inline', () => {
  for (const source of [
    read('../assets/web/css/pwa/007-loteka-menu-refresh-cache-fix-css.css'),
    topbar,
    read('../assets/web/css/ui/019-loteka-v79-topbar-user-elegante-css.css'),
    sidebar,
    read('../assets/web/css/ui/023-go-branding-interno-v208.css'),
    mobile,
    account
  ]) {
    assert.equal(bundle.includes(source.trim()), true);
  }
  const inline = index.match(/<style id="grupo-ortiz-web-bundle-inline">([\s\S]*?)<\/style>/)?.[1] || '';
  const normalizeNewlines = (value) => value.replace(/\r\n/g, '\n').trim();
  assert.equal(normalizeNewlines(inline), normalizeNewlines(bundle));
});

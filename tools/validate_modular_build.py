#!/usr/bin/env python3
from __future__ import annotations
import hashlib
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

try:
    import tinycss2
except ImportError:
    tinycss2 = None

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'index.html'
APP = ROOT / 'app.html'
PANTALLA = ROOT / 'pantalla.html'
CSS_BUNDLE = ROOT / 'assets/web/css/grupo-ortiz-web.bundle.css'
DESIGN_TOKENS = ROOT / 'assets/shared/css/go-design-tokens.css'
WEB_COMPONENTS = ROOT / 'assets/web/css/design-system/go-components.css'
APP_TOKENS = ROOT / 'assets/app/css/tokens.css'
OPERATIONS_DOMAIN_CSS = ROOT / 'assets/web/css/operaciones/070-go-operations-domain.css'


class RefParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts: list[str] = []
        self.styles: list[str] = []

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == 'script' and data.get('src'):
            self.scripts.append(data['src'])
        if tag == 'link' and str(data.get('rel', '')).lower() == 'stylesheet' and data.get('href'):
            self.styles.append(data['href'])


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def local_path(ref: str) -> Path | None:
    raw = str(ref or '').strip()
    if not raw or raw.startswith(('http://', 'https://', '//', 'data:', 'blob:')):
        return None
    clean = urlsplit(raw).path.lstrip('/')
    if not clean:
        return None
    return ROOT / clean


def parse_refs(path: Path) -> RefParser:
    parser = RefParser()
    parser.feed(path.read_text(encoding='utf-8', errors='replace'))
    return parser


def check_js(paths: list[Path]) -> list[str]:
    failures = []
    for path in sorted(set(paths)):
        result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
        if result.returncode:
            failures.append(f'{path.relative_to(ROOT)}: {result.stderr.strip()}')
    return failures


def check_css(path: Path) -> list[str]:
    if not tinycss2 or not path.is_file():
        return []
    failures = []
    tokens = tinycss2.parse_stylesheet(path.read_text(encoding='utf-8'), skip_comments=False, skip_whitespace=False)
    for token in tokens:
        if token.type == 'error':
            failures.append(f'{path.relative_to(ROOT)}:{token.source_line}:{token.source_column} {token.message}')
    return failures


def version_check() -> tuple[bool, dict]:
    result = subprocess.run(
        ['python3', 'tools/sync_version.py', '--check'],
        cwd=ROOT,
        capture_output=True,
        text=True
    )
    try:
        payload = json.loads(result.stdout or '{}')
    except json.JSONDecodeError:
        payload = {'ok': False, 'failures': [result.stdout or result.stderr or 'sync_version.py no devolvió JSON']}
    return result.returncode == 0, payload


def main() -> int:
    failures: list[str] = []
    warnings: list[str] = []
    for required in (INDEX, APP, PANTALLA, ROOT / 'version.json', ROOT / 'service-worker.js', DESIGN_TOKENS, WEB_COMPONENTS, APP_TOKENS, OPERATIONS_DOMAIN_CSS):
        if not required.is_file():
            failures.append(f'Falta {required.relative_to(ROOT)}')
    if failures:
        print(json.dumps({'ok': False, 'failures': failures}, ensure_ascii=False, indent=2))
        return 1

    parsed = {path: parse_refs(path) for path in (INDEX, APP, PANTALLA)}
    local_refs: list[Path] = []
    for html_path, parser in parsed.items():
        for ref in parser.scripts + parser.styles:
            path = local_path(ref)
            if path is None:
                continue
            local_refs.append(path)
            if not path.is_file():
                failures.append(f'Referencia local inexistente en {html_path.name}: {ref}')

    index_scripts = [local_path(ref) for ref in parsed[INDEX].scripts]
    index_scripts = [path for path in index_scripts if path and path.suffix.lower() == '.js' and path.is_file()]
    app_js = list((ROOT / 'assets/app/js').rglob('*.js'))
    api_js = list((ROOT / 'api').glob('*.js'))
    js_failures = check_js(index_scripts + app_js + api_js + [ROOT / 'service-worker.js'])
    failures.extend(js_failures)

    css_paths = [CSS_BUNDLE, DESIGN_TOKENS, WEB_COMPONENTS, OPERATIONS_DOMAIN_CSS] + list((ROOT / 'assets/app/css').rglob('*.css'))
    css_failures = []
    for css_path in sorted(set(path for path in css_paths if path.is_file())):
        css_failures.extend(check_css(css_path))
    failures.extend(css_failures)

    index_text = INDEX.read_text(encoding='utf-8')
    bundle_text = CSS_BUNDLE.read_text(encoding='utf-8') if CSS_BUNDLE.is_file() else ''
    inline_match = re.search(r'<style\s+id="grupo-ortiz-web-bundle-inline"[^>]*>([\s\S]*?)</style>', index_text, flags=re.I)
    inline_css = inline_match.group(1) if inline_match else ''
    inline_matches_bundle = bool(inline_css and bundle_text and inline_css.strip() == bundle_text.strip())
    if inline_css and bundle_text and not inline_matches_bundle:
        warnings.append('El CSS inline principal ya no coincide exactamente con el bundle externo; revisar la cascada antes de extraerlo.')

    version_ok, version_payload = version_check()
    if not version_ok:
        failures.extend(version_payload.get('failures') or ['Los consumidores de versión no están sincronizados.'])

    core_path = ROOT / 'assets/web/js/core/005-const-demo-user-email-admin-empresa-com-password-1234.js'
    core_text = core_path.read_text(encoding='utf-8') if core_path.is_file() else ''
    if 'value="admin@empresa.com"' in index_text or 'value="1234"' in index_text:
        failures.append('index.html todavía expone credenciales demo en helpers legacy.')
    if 'const DEMO_USER' in core_text or "localStorage.setItem('operations_session'" in core_text:
        failures.append('El runtime legacy todavía crea identidad/sesión demo.')

    push_path = ROOT / 'api/send-push.js'
    push_text = push_path.read_text(encoding='utf-8') if push_path.is_file() else ''
    if 'requireAuthenticatedUser' not in push_text:
        failures.append('/api/send-push no exige autenticación.')
    if 'body.subscription' in push_text or 'webpush.sendNotification' in push_text:
        failures.append('/api/send-push todavía acepta/envía subscriptions arbitrarias desde el cliente.')

    sw_text = (ROOT / 'service-worker.js').read_text(encoding='utf-8')

    # Design System compartido: fuente única de tokens + componentes web opt-in.
    design_text = DESIGN_TOKENS.read_text(encoding='utf-8')
    components_text = WEB_COMPONENTS.read_text(encoding='utf-8')
    app_tokens_text = APP_TOKENS.read_text(encoding='utf-8')
    required_tokens = (
        '--go-brand-navy:', '--go-brand-blue:', '--go-brand-cyan:',
        '--go-color-bg:', '--go-color-surface:', '--go-color-border:',
        '--go-color-text:', '--go-color-text-muted:',
        '--go-color-success:', '--go-color-warning:', '--go-color-danger:', '--go-color-info:',
        '--go-space-1:', '--go-space-4:', '--go-space-8:',
        '--go-radius-sm:', '--go-radius-md:', '--go-radius-lg:',
        '--go-shadow-subtle:', '--go-shadow-card:', '--go-shadow-floating:',
        '--go-z-sticky:', '--go-z-dropdown:', '--go-z-overlay:', '--go-z-modal:', '--go-z-toast:',
        '--go-control-min-height:'
    )
    for token in required_tokens:
        if token not in design_text:
            failures.append(f'Falta token oficial del Design System: {token}')

    if "@import url('../../shared/css/go-design-tokens.css')" not in app_tokens_text:
        failures.append('La app móvil no consume la fuente compartida oficial de tokens.')

    expected_design_refs = {
        INDEX: ('./assets/shared/css/go-design-tokens.css', './assets/web/css/design-system/go-components.css'),
        PANTALLA: ('./assets/shared/css/go-design-tokens.css', './assets/web/css/design-system/go-components.css'),
    }
    for html_path, refs in expected_design_refs.items():
        styles = set(parsed[html_path].styles)
        for ref in refs:
            if ref not in styles:
                failures.append(f'{html_path.name} no carga el Design System requerido: {ref}')

    if '.go-ui-btn' not in components_text or '.go-ui-card' not in components_text or '.go-ui-state' not in components_text:
        failures.append('La capa de componentes web del Design System está incompleta.')
    if re.search(r'(^|\n)\s*(body|html|button|input|select|textarea|\.btn|\.card)\s*[{,]', components_text):
        failures.append('Los componentes nuevos contienen selectores globales/legacy que podrían alterar el runtime actual.')

    if '/assets/shared/css/go-design-tokens.css' not in sw_text or '/assets/web/css/design-system/go-components.css' not in sw_text:
        failures.append('Los assets del Design System no están incluidos en CORE_ASSETS del Service Worker.')

    # Fase 4 · Dominio Operaciones: ownership, estados, UX segura y CSS scopeado.
    operations_domain_path = ROOT / 'assets/web/js/operaciones/081-loteka-v80820-reportes-bandeja.js'
    operations_domain_text = operations_domain_path.read_text(encoding='utf-8') if operations_domain_path.is_file() else ''
    operations_css_text = OPERATIONS_DOMAIN_CSS.read_text(encoding='utf-8') if OPERATIONS_DOMAIN_CSS.is_file() else ''
    if 'global.GOApp.operations.domain=api' not in operations_domain_text:
        failures.append('Operaciones no expone GOApp.operations.domain como ownership de la migración Fase 4.')
    if 'id="resetDataBtn"' in index_text:
        failures.append('Operaciones todavía expone el botón destructivo Restablecer datos.')
    if 'id="refreshOperationsBtn"' not in index_text or 'id="clearOperationsFiltersBtn"' not in index_text:
        failures.append('Operaciones no expone acciones separadas de actualizar y limpiar filtros.')
    if 'data-v808-action=' in operations_domain_text or '1000025' in operations_domain_text or 'installStyles' in operations_domain_text:
        failures.append('El dominio Operaciones conserva hooks/CSS inyectado o z-index legacy de v808.20.')
    if '.go-ops-domain' not in operations_css_text or '!important' in operations_css_text:
        failures.append('La hoja oficial de Operaciones debe estar scopeada y sin !important nuevos.')
    for state in ('Reportado', 'Asignado', 'En proceso', 'En incidencia', 'Completado', 'Resuelto por soporte remoto'):
        if state not in operations_domain_text:
            failures.append(f'El dominio Operaciones no contempla el estado canónico: {state}')

    if '/assets/app/js/operation-status.js' not in sw_text:
        failures.append('El módulo canónico de estados no está incluido en CORE_ASSETS del Service Worker.')
    if 'LOTEKA_ACTIVATE_NEW_VERSION' not in sw_text or 'userRequestedActivation' not in sw_text:
        failures.append('El Service Worker perdió el flujo de activación explícita.')

    active_web_text = '\n'.join(path.read_text(encoding='utf-8', errors='replace') for path in index_scripts)
    if re.search(r"(?:const|let|var)\s+BUILD\s*=\s*['\"]2026-", active_web_text):
        failures.append('Existe un BUILD global hardcodeado en un script web activo; debe derivar del build canónico.')
    if re.search(r"LOTEKA_HTML_VERSION\s*=\s*['\"]2026-", active_web_text):
        failures.append('El actualizador PWA todavía contiene una versión HTML hardcodeada.')

    manifest = ROOT / 'assets/web/manifest.json'
    if manifest.exists():
        warnings.append('assets/web/manifest.json se conserva como artefacto histórico; el validador ya usa las referencias reales del HTML actual.')

    output = {
        'ok': not failures,
        'build': version_payload.get('build'),
        'index_bytes': INDEX.stat().st_size,
        'index_sha256': sha256(INDEX),
        'index_local_scripts': len(index_scripts),
        'app_js_files_checked': len(app_js),
        'api_js_files_checked': len(api_js),
        'local_html_refs_checked': len(set(local_refs)),
        'js_syntax_failures': len(js_failures),
        'css_files_checked': len(set(path for path in css_paths if path.is_file())),
        'css_parser_errors': len(css_failures),
        'design_system_tokens_bytes': DESIGN_TOKENS.stat().st_size,
        'design_system_components_bytes': WEB_COMPONENTS.stat().st_size,
        'inline_css_bytes': len(inline_css.encode('utf-8')) if inline_css else 0,
        'external_css_bundle_bytes': CSS_BUNDLE.stat().st_size if CSS_BUNDLE.is_file() else 0,
        'inline_css_matches_external_bundle': inline_matches_bundle,
        'version_synced': version_ok,
        'failures': failures,
        'warnings': warnings,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())

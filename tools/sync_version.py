#!/usr/bin/env python3
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / 'version.json'


def replace_exact(path: Path, pattern: str, replacement: str) -> bool:
    with path.open('r', encoding='utf-8', newline='') as file:
        text = file.read()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError(f'No se pudo localizar exactamente un marcador de versión en {path.relative_to(ROOT)}')
    if updated != text:
        with path.open('w', encoding='utf-8', newline='') as file:
            file.write(updated)
        return True
    return False


def desired_version() -> tuple[str, str]:
    data = json.loads(VERSION_FILE.read_text(encoding='utf-8'))
    build = str(data.get('version') or '').strip()
    if not build:
        raise RuntimeError('version.json no contiene version')
    match = re.search(r'-v([0-9]+(?:\.[0-9]+)*)-', build, re.I)
    if not match:
        raise RuntimeError('No se pudo derivar APP_VERSION desde version.json')
    return build, f"V{match.group(1)}"


def expected_contents(build: str, app_version: str) -> dict[Path, list[tuple[str, str]]]:
    return {
        ROOT / 'service-worker.js': [
            (r'const SW_VERSION = "[^"]+";', f'const SW_VERSION = "{build}";'),
        ],
        ROOT / 'index.html': [
            (r'(<meta\s+name="grupo-ortiz-build"\s+content=")[^"]+("\s*/?>)', rf'\g<1>{build}\g<2>'),
            (r'(<meta\s+content=")[^"]+("\s+name="loteka-build"\s*/?>)', rf'\g<1>{build}\g<2>'),
        ],
        ROOT / 'app.html': [
            (r'(<html\s+lang="es"\s+data-app-build=")[^"]+("[^>]*>)', rf'\g<1>{build}\g<2>'),
        ],
        ROOT / 'assets/app/js/config.js': [
            (r"export const APP_BUILD = '[^']+';", f"export const APP_BUILD = '{build}';"),
            (r"export const APP_VERSION = '[^']+';", f"export const APP_VERSION = '{app_version}';"),
        ],
    }


def check_file(path: Path, entries: list[tuple[str, str]]) -> list[str]:
    with path.open('r', encoding='utf-8', newline='') as file:
        text = file.read()
    failures = []
    for pattern, expected in entries:
        match = re.search(pattern, text, flags=re.MULTILINE)
        if not match:
            failures.append(f'Falta marcador esperado en {path.relative_to(ROOT)}: {pattern}')
            continue
        current = match.group(0)
        # Apply the same replacement against just the matched text so backrefs resolve.
        resolved = re.sub(pattern, expected, current, count=1, flags=re.MULTILINE)
        if current != resolved:
            failures.append(f'Versión desincronizada en {path.relative_to(ROOT)}: {current}')
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description='Sincroniza consumidores de versión con version.json')
    parser.add_argument('--check', action='store_true', help='solo valida, no escribe archivos')
    args = parser.parse_args()

    build, app_version = desired_version()
    plan = expected_contents(build, app_version)

    if args.check:
        failures = []
        for path, entries in plan.items():
            failures.extend(check_file(path, entries))
        print(json.dumps({'ok': not failures, 'build': build, 'app_version': app_version, 'failures': failures}, ensure_ascii=False, indent=2))
        return 1 if failures else 0

    changed = []
    for path, entries in plan.items():
        file_changed = False
        for pattern, replacement in entries:
            file_changed = replace_exact(path, pattern, replacement) or file_changed
        if file_changed:
            changed.append(str(path.relative_to(ROOT)))
    print(json.dumps({'ok': True, 'build': build, 'app_version': app_version, 'changed': changed}, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, subprocess
from pathlib import Path
try:
    import tinycss2
except ImportError:
    tinycss2 = None
ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT/'index.html'; MANIFEST=ROOT/'assets/web/manifest.json'
def sha256(path):
    h=hashlib.sha256();
    with open(path,'rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()
def main():
    failures=[]
    if not INDEX.is_file(): failures.append('Falta index.html')
    if not MANIFEST.is_file(): failures.append('Falta assets/web/manifest.json')
    if failures: print(json.dumps({'ok':False,'failures':failures},indent=2)); return 1
    m=json.loads(MANIFEST.read_text(encoding='utf-8')); html=INDEX.read_text(encoding='utf-8')
    scripts=[x for x in m['items'] if x['kind']=='script']; styles=[x for x in m['items'] if x['kind']=='style']
    jsf=[]; cssf=[]
    for x in m['items']:
        p=ROOT/x['path']
        if not p.is_file(): failures.append('Falta '+x['path']); continue
        expected=x.get('sha256') if x['kind']=='script' else x.get('sha256_external')
        if expected and sha256(p)!=expected: failures.append('Checksum diferente: '+x['path'])
        if x['path'] not in html: failures.append('Referencia ausente: '+x['path'])
    for x in scripts:
        p=ROOT/x['path'];
        if not p.is_file(): continue
        r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
        if r.returncode: jsf.append(x['path']+': '+r.stderr.strip())
    if tinycss2:
        for x in styles:
            p=ROOT/x['path'];
            if not p.is_file(): continue
            for t in tinycss2.parse_stylesheet(p.read_text(encoding='utf-8'),skip_comments=False,skip_whitespace=False):
                if t.type=='error': cssf.append(f"{x['path']}:{t.source_line}:{t.source_column} {t.message}")
    failures += jsf + cssf
    if len(scripts)!=76: failures.append(f'Scripts esperados 76, encontrados {len(scripts)}')
    if len(styles)!=75: failures.append(f'Estilos esperados 75, encontrados {len(styles)}')
    out={'ok':not failures,'index_bytes':INDEX.stat().st_size,'index_sha256':sha256(INDEX),'scripts':len(scripts),'styles':len(styles),'js_syntax_failures':len(jsf),'css_parser_errors':len(cssf),'failures':failures}
    print(json.dumps(out,ensure_ascii=False,indent=2)); return 1 if failures else 0
if __name__=='__main__': raise SystemExit(main())

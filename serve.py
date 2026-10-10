#!/usr/bin/env python3
"""Loopback-only Research Atlas server. Evidence ZIPs are never static routes."""
import argparse
import hashlib
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote
import zipfile
from privacy import redact, preview_allowed

TEXT = {'.md', '.txt', '.csv', '.json', '.jsonl', '.yaml', '.yml', '.log', '.tex', '.rst', '.py', '.r', '.js', '.ts'}

def make_handler(site, evidence_dir, manifest_paths=(), enable_raw_preview=False):
    site, evidence_dir = Path(site).resolve(), Path(evidence_dir).resolve()
    inventory_cache = {'stamp': None, 'entries': []}
    def inventory():
        stamp = tuple((str(p), Path(p).stat().st_mtime_ns) for p in manifest_paths if Path(p).exists())
        if stamp != inventory_cache['stamp']:
            entries = []
            for p, _ in stamp:
                with Path(p).open(encoding='utf-8-sig') as stream:
                    for line in stream:
                        if not line.strip():
                            continue
                        e = json.loads(line)
                        entries.append({k: e.get(k) for k in ('machine', 'root', 'path', 'status', 'sha256', 'size', 'archive', 'member', 'modified_utc', 'chunks', 'reason') if k in e})
            inventory_cache.update(stamp=stamp, entries=entries)
        if not manifest_paths:
            catalog = json.loads((site / 'data' / 'merged.json').read_text(encoding='utf-8-sig'))
            seen, rows = set(), []
            for record in catalog['records']:
                for ev in record.get('evidence', []):
                    key = (ev.get('machine'), ev.get('root'), ev.get('path'), ev.get('sha256'))
                    if key in seen:
                        continue
                    seen.add(key)
                    rows.append(dict(ev, status='SOURCE_PROVENANCE_METADATA_ONLY'))
            return rows
        return inventory_cache['entries']
    class Handler(BaseHTTPRequestHandler):
        def reply(self, status, data, mime='application/json; charset=utf-8'):
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(data)
        def error(self, status, msg):
            self.reply(status, json.dumps({'error': msg}).encode())
        def do_GET(self):
            parsed = urlsplit(self.path)
            if parsed.path == '/api/inventory':
                try:
                    args = parse_qs(parsed.query)
                    rows = inventory()
                    q = args.get('q', [''])[0].lower().split()
                    root = args.get('root', [''])[0]
                    rows = [r for r in rows if (not root or r.get('root') == root) and all(x in (r.get('path', '') + ' ' + r.get('root', '') + ' ' + r.get('status', '')).lower() for x in q)]
                    page, limit = max(1, int(args.get('page', ['1'])[0])), min(100, max(1, int(args.get('limit', ['30'])[0])))
                    return self.reply(200, json.dumps({'total': len(rows), 'entries': rows[(page-1)*limit:page*limit]}, ensure_ascii=False).encode())
                except (ValueError, OSError, json.JSONDecodeError):
                    return self.error(400, 'Inventory unavailable or malformed request')
            if parsed.path == '/api/evidence':
                if not enable_raw_preview:
                    return self.error(403, 'Raw archive preview is disabled; use the portable scoped provenance excerpts in this compact catalog')
                args = parse_qs(parsed.query)
                try:
                    catalog = json.loads((site / 'data' / 'merged.json').read_text(encoding='utf-8-sig'))
                    record = next(r for r in catalog['records'] if r['id'] == args.get('record', [''])[0])
                    ev = record['evidence'][int(args.get('index', ['0'])[0])]
                    arch = evidence_dir / Path(ev['archive']).name
                    if arch.name != ev['archive'] or arch.resolve().parent != evidence_dir:
                        raise ValueError('archive path')
                    member = ev['member']
                    if not preview_allowed(member):
                        return self.error(403, 'Sensitive or internal Git member cannot be previewed')
                    with zipfile.ZipFile(arch) as z:
                        manifest = json.loads(z.read('manifest.json'))
                        entries = manifest.get('entries', [])
                        if not entries and manifest.get('entries_file'):
                            entries = [json.loads(x) for x in z.read(manifest['entries_file']).decode().splitlines() if x.strip()]
                        entry = next(e for e in entries if e.get('archive_member', e.get('member', f"files/{e.get('root')}/{e.get('path')}")) == member and e['status'] == 'ARCHIVED')
                        info = z.getinfo(member)
                        if Path(member).suffix.lower() not in TEXT or info.file_size > 2_000_000:
                            return self.error(413, 'Evidence text preview limited to 2 MB; restore original archive for large/binary evidence')
                        raw = z.read(member)
                    if hashlib.sha256(raw).hexdigest() != entry['sha256'] or entry['sha256'] != ev['sha256']:
                        return self.error(409, 'Evidence SHA-256 mismatch')
                    content = redact(raw.decode('utf-8', 'replace'))
                    return self.reply(200, json.dumps({'content': content[:200000], 'truncated': len(content) > 200000, 'credential_redaction': True, 'sha256': ev['sha256'], 'member': member, 'archive': arch.name}, ensure_ascii=False).encode())
                except (KeyError, StopIteration, ValueError, OSError, zipfile.BadZipFile, IndexError):
                    return self.error(404, 'No catalog-authorized manifest evidence')
            route = unquote(parsed.path)
            allowed = {'/', '/index.html', '/app.js', '/style.css', '/data/merged.json'}
            if route not in allowed:
                return self.error(404, 'Route not available')
            path = site / ('index.html' if route == '/' else route.lstrip('/'))
            try:
                mime = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8'}.get(path.suffix, 'application/json; charset=utf-8')
                self.reply(200, path.read_bytes(), mime)
            except OSError:
                self.error(404, 'Site file unavailable')
    return Handler

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--site', default='web')
    p.add_argument('--evidence-dir', default='evidence')
    p.add_argument('--port', type=int, default=8765)
    p.add_argument('--manifest', action='append', default=[])
    p.add_argument('--enable-raw-preview', action='store_true', help='Explicitly enable manifest-authorized bounded text previews')
    a = p.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', a.port), make_handler(a.site, a.evidence_dir, a.manifest, a.enable_raw_preview))
    print(f'Research Atlas http://127.0.0.1:{a.port} (loopback only)', flush=True)
    server.serve_forever()

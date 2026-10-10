#!/usr/bin/env python3
"""Build a private, provenance-preserving catalog from verified machine ZIPs.

Compatible with Research Atlas Starter build_index.py. Scientific verdicts are
never inferred from a token or filename. Duplicate content retains all origins.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import zipfile
from collections import defaultdict
from privacy import redact, preview_allowed

TEXT = {'.md', '.txt', '.csv', '.json', '.jsonl', '.yaml', '.yml', '.log', '.tex', '.rst', '.ipynb'}
MATCH = re.compile(r'(research|hypothes|conjecture|experiment|verdict|decision|closeout|failed|kill|hold|sentinel|result|collision|negative|研究|假设|实验|失败|结论)', re.I)
HINT = re.compile(r'\b(KILL|HOLD|GO|COMPLETED|INCONCLUSIVE|INVALIDATED|BLOCKED|NO_EXECUTABLE_CANDIDATE|REMOTE_UNKNOWN|FAILED_REPLICATION)\b', re.I)
SECTIONS = [('Hypothesis', re.compile(r'假设|猜想|hypothes|conjecture', re.I)), ('Experiment', re.compile(r'实验|experiment|sentinel|配置|random.seed', re.I)), ('Verdict', re.compile(r'结论|裁决|失败|verdict|decision|kill|hold|collision', re.I)), ('Follow-up', re.compile(r'下一步|后续|follow.up|next.step', re.I))]

def digest(data):
    return hashlib.sha256(data).hexdigest()

def safe_member(name):
    p = PurePosixPath(name)
    return bool(name) and not p.is_absolute() and '..' not in p.parts and '\\' not in name

def migrate(catalog):
    """Non-destructive v0.1 -> v0.2 defaults; never invent verification."""
    out = dict(catalog)
    out['schema_version'] = 'atlas-catalog-v0.2'
    out.setdefault('records', [])
    for r in out['records']:
        r.setdefault('verification', 'UNREVIEWED')
        r.setdefault('date_provenance', 'UNSPECIFIED')
        r.setdefault('origin_machines', [r.get('machine', 'UNKNOWN')])
        r.setdefault('project', 'UNCLASSIFIED')
        r.setdefault('domain', 'UNCLASSIFIED')
        r.setdefault('status', 'NEEDS_REVIEW')
        r.setdefault('kind', 'problem')
        r.setdefault('machine', 'UNKNOWN')
        r.setdefault('evidence', [])
        r.setdefault('relations', [])
        r.setdefault('scope', 'UNSPECIFIED; do not generalize this record')
    return out

def load_manifest(z):
    manifest = json.loads(z.read('manifest.json'))
    if 'entries' not in manifest and manifest.get('entries_file'):
        manifest['entries'] = [json.loads(x) for x in z.read(manifest['entries_file']).decode('utf-8').splitlines() if x.strip()]
    return manifest

def normalize_title(title):
    return re.sub(r'[^\w\u4e00-\u9fff]+', ' ', title.lower()).strip()

def derive(archives, seed=None, max_text_bytes=2_000_000, manifests=(), topic_only=False):
    catalog = migrate(json.loads(Path(seed).read_text(encoding='utf-8-sig')) if seed else {'records': []})
    by_id = {r['id']: r for r in catalog['records']}
    sources, errors = {}, []
    for archive in sorted(set(map(str, archives))):
        with zipfile.ZipFile(archive) as z:
            manifest = load_manifest(z)
            machine = manifest['machine']
            entries = manifest['entries']
            src_key = machine + '/' + Path(archive).name
            sources[src_key] = {'machine': machine, 'archive': Path(archive).name,
                                'files': sum(e['status'] == 'ARCHIVED' for e in entries),
                                'excluded': sum(e['status'] not in ('ARCHIVED', 'GIT_BUNDLE_ARCHIVED') for e in entries),
                                'created_utc': manifest.get('created_utc'), 'index_errors': []}
            for entry in entries:
                if entry['status'] != 'ARCHIVED':
                    continue
                path = entry['path']
                if Path(path).suffix.lower() not in TEXT or entry.get('size', 0) > max_text_bytes:
                    continue
                member = entry.get('archive_member', entry.get('member', f"files/{entry['root']}/{path}"))
                if not preview_allowed(member):
                    continue
                if not safe_member(member):
                    errors.append({'archive': Path(archive).name, 'path': path, 'reason': 'UNSAFE_MEMBER'})
                    continue
                try:
                    info = z.getinfo(member)
                    if info.file_size > max_text_bytes:
                        continue
                    raw = z.read(member)
                except (KeyError, OSError) as exc:
                    errors.append({'archive': Path(archive).name, 'path': path, 'reason': 'MISSING_MEMBER'})
                    continue
                h = digest(raw)
                if entry.get('sha256') != h:
                    errors.append({'archive': Path(archive).name, 'path': path, 'reason': 'HASH_MISMATCH'})
                    continue
                text = redact(raw.decode('utf-8', 'replace'))
                if not text.strip() or not MATCH.search(path + '\n' + text[:200000]):
                    continue
                rid = 'file-' + h
                evidence = {'label': f"{machine}/{entry['root']}/{path}", 'sha256': h,
                            'archive': Path(archive).name, 'member': member,
                            'machine': machine, 'root': entry['root'], 'path': path,
                            'modified_utc': entry.get('modified_utc'), 'size': len(raw)}
                if rid in by_id:
                    record = by_id[rid]
                    if evidence not in record['evidence']:
                        record['evidence'].append(evidence)
                    machines = sorted(set(record.get('origin_machines', [])) | {machine})
                    record['origin_machines'] = machines
                    record['machine'] = machines[0] if len(machines) == 1 else 'MULTI_SOURCE'
                    continue
                heading = next((line.lstrip('# ').strip() for line in text.splitlines()[:30]
                                if line.startswith('# ') and len(line) < 240), Path(path).name)
                record = {'id': rid, 'title': heading, 'kind': 'source-document',
                          'domain': 'UNCLASSIFIED', 'project': entry['root'],
                          'status': 'NEEDS_REVIEW', 'cause': 'UNDETERMINED',
                          'verification': 'HASH_VERIFIED_SOURCE_UNREVIEWED',
                          'summary': text[:1600], 'search_text': text[:100000],
                          'search_text_truncated': len(text) > 100000,
                          'machine': machine, 'origin_machines': [machine],
                          'tags': sorted(set(x.upper() for x in HINT.findall(text))),
                          'reported_status_hints': sorted(set(x.upper() for x in HINT.findall(text))),
                          'scope': 'Source document candidate; scientific claims and failure applicability require review.',
                          'relations': [], 'evidence': [evidence],
                          'date': entry.get('modified_utc', '')[:10],
                          'date_provenance': 'FILE_MTIME; not an inferred exploration date'}
                catalog['records'].append(record)
                by_id[rid] = record
    # Content deduplication only; every independent file origin remains attached.
    for manifest_path in manifests:
        with Path(manifest_path).open(encoding='utf-8-sig') as stream:
            for line in stream:
                if not line.strip():
                    continue
                entry = json.loads(line)
                record = by_id.get('file-' + entry.get('sha256', ''))
                if not record or entry.get('status') not in ('ARCHIVED', 'ARCHIVED_DUPLICATE_POINTER'):
                    continue
                if not entry.get('archive') or not entry.get('member'):
                    continue
                machine = entry.get('machine', 'RANCHO')
                ev = {k: entry.get(k) for k in ('sha256', 'archive', 'member', 'root', 'path', 'modified_utc', 'size')}
                ev.update(machine=machine, label=f"{machine}/{entry['root']}/{entry['path']}", status=entry['status'])
                if not any(x.get('label') == ev['label'] and x.get('archive') == ev['archive'] for x in record['evidence']):
                    record['evidence'].append(ev)
                record['origin_machines'] = sorted(set(record['origin_machines']) | {machine})
    catalog['records'] = sorted(by_id.values(), key=lambda x: x['id'])
    catalog['source_archives'] = sources
    catalog['index_errors'] = errors
    catalog['generated_utc'] = dt.datetime.now(dt.timezone.utc).isoformat()
    catalog['data_policy'] = 'PRIVATE_LOCAL_DERIVED; scientific claims require source review'
    if topic_only:
        # User-requested compact migration excludes procedure/doc candidates.
        catalog['records'] = [r for r in catalog['records'] if r.get('kind') != 'source-document']
        for r in catalog['records']:
            r.pop('search_text', None)
            for key in ('summary', 'scope', 'verification_basis', 'result_summary'):
                if isinstance(r.get(key), str):
                    r[key] = redact(r[key])
            for ev in r.get('evidence', []):
                if isinstance(ev.get('excerpt'), str):
                    ev['excerpt'] = redact(ev['excerpt'])[:12000]
        catalog['data_policy'] = 'PRIVATE_COMPACT_TOPICS_AND_SOURCE_SUPPORTED_RESULTS; raw evidence and process files excluded'
        catalog['archive_scope'] = 'COMPACT_KNOWLEDGE_ONLY; not a full code/data/history backup'
    return enrich(catalog)

def enrich(catalog):
    nodes, edges, review = {}, [], []
    grouped = defaultdict(list)
    def add(kind, key, label, provenance, **extra):
        node_id = kind.lower() + '-' + digest(key.encode())[:24]
        if node_id in nodes:
            known = {json.dumps(p, sort_keys=True, ensure_ascii=False) for p in nodes[node_id]['provenance']}
            for p in provenance:
                if json.dumps(p, sort_keys=True, ensure_ascii=False) not in known:
                    nodes[node_id]['provenance'].append(p)
                    known.add(json.dumps(p, sort_keys=True, ensure_ascii=False))
        else:
            nodes[node_id] = dict(id=node_id, type=kind, label=label, provenance=list(provenance), **extra)
        return node_id
    for r in catalog['records']:
        grouped[normalize_title(r['title'])].append(r)
        evs = r.get('evidence', [])
        area = add('Research Area', r['domain'], r['domain'], evs, verification='CLASSIFICATION_REQUIRES_REVIEW')
        problem = add('Problem', r['id'], r['title'], evs, record_id=r['id'], verification=r['verification'])
        edges.append({'source': area, 'target': problem, 'type': 'contains', 'provenance': evs})
        for kind, value in [('Hypothesis', r.get('hypothesis')), ('Experiment', r.get('experiment')), ('Verdict', r.get('status') if r['verification'].startswith('SOURCE_DOCUMENTED') or r['verification'] == 'REVIEWED' else None), ('Follow-up', r.get('follow_up', r.get('next_step')))]:
            if value:
                label = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
                child = add(kind, r['id'] + ':' + kind, label[:500], evs, record_id=r['id'], verification=r['verification'], scope=r.get('scope'))
                edges.append({'source': problem, 'target': child, 'type': 'source-recorded-' + kind.lower(), 'provenance': evs})
        for ev in evs:
            evidence = add('Evidence', ev.get('sha256', '') + ev.get('label', ''), ev.get('label', 'Source'), [ev])
            edges.append({'source': problem, 'target': evidence, 'type': 'documented-by', 'provenance': [ev]})
        for line_num, line in enumerate(r.get('search_text', '').splitlines(), 1):
            if not re.match(r'^#{1,6}\s', line):
                continue
            for kind, pattern in SECTIONS:
                if pattern.search(line):
                    provenance = [dict(ev, line_start=line_num, line_end=line_num) for ev in evs]
                    child = add(kind, r['id'] + ':' + str(line_num) + ':' + kind, line.lstrip('# ').strip(), provenance,
                                verification='SECTION_CANDIDATE_UNREVIEWED', record_id=r['id'], status='NEEDS_REVIEW')
                    edges.append({'source': problem, 'target': child, 'type': 'section-candidate', 'provenance': provenance})
        for relation in r.get('relations', []):
            target = 'problem-' + digest(relation['target'].encode())[:24]
            edges.append({'source': problem, 'target': target, 'type': relation['type'], 'provenance': relation.get('provenance', evs)})
    for title, members in sorted(grouped.items()):
        if title and len(members) > 1:
            review.append({'type': 'POSSIBLE_DUPLICATE_OR_VERSION_CONFLICT', 'title_key': title,
                           'record_ids': [x['id'] for x in members],
                           'statuses': sorted(set(x['status'] for x in members)),
                           'action': 'REVIEW_SEPARATELY; no scientific conclusions merged'})
    catalog['nodes'] = sorted(nodes.values(), key=lambda x: x['id'])
    catalog['edges'] = edges
    catalog['review_queue'] = review
    catalog['statistics'] = {'source_documents': sum(r.get('kind') == 'source-document' for r in catalog['records']),
                             'scoped_topic_records': sum(r.get('kind') != 'source-document' for r in catalog['records']),
                             'unique_explicit_topic_ids': len(set(r['topic_id'] for r in catalog['records'] if r.get('topic_id'))),
                             'source_documented_records': sum(r.get('verification', '').startswith('SOURCE_DOCUMENTED') for r in catalog['records']),
                             'historical_result_receipts_checked': sum(r.get('result_verified') is True for r in catalog['records']),
                             'independently_reproduced_results': sum(r.get('verification') == 'INDEPENDENTLY_REPRODUCED' for r in catalog['records']),
                             'reviewed_topics': sum(r.get('kind') != 'source-document' and r.get('verification') in ('SOURCE_DOCUMENTED', 'REVIEWED') for r in catalog['records']),
                             'by_status': dict(sorted((s, sum(r['status'] == s for r in catalog['records'])) for s in set(r['status'] for r in catalog['records'])))}
    for field in ('kind', 'result_kind', 'verification'):
        catalog['statistics']['by_' + field] = dict(sorted((v, sum(r.get(field, 'UNSPECIFIED') == v for r in catalog['records'])) for v in set(r.get(field, 'UNSPECIFIED') for r in catalog['records'])))
    return catalog

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', action='append', default=[])
    parser.add_argument('--seed', default=None, help='Explicit seed only; no demo examples imported by default')
    parser.add_argument('--output', default='data/merged.json')
    parser.add_argument('--manifest', action='append', default=[], help='Global machine JSONL inventory for duplicate origin preservation')
    parser.add_argument('--review-catalog', help='Compact source-reviewed research topics and result catalog (no raw archive required)')
    parser.add_argument('--source-manifest', action='append', default=[], help='Compact provenance manifest; metadata only, not ingested as topics')
    parser.add_argument('--topic-only', action='store_true', help='Exclude procedure/document candidates and full source text')
    args = parser.parse_args()
    if args.review_catalog and args.seed:
        parser.error('Choose --review-catalog or --seed')
    result = derive(args.archive, args.review_catalog or args.seed, manifests=args.manifest, topic_only=args.topic_only or bool(args.review_catalog))
    if args.source_manifest:
        result['source_manifest_references'] = [{'name': Path(p).name, 'sha256': digest(Path(p).read_bytes())} for p in args.source_manifest]
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Created {path}: {len(result['records'])} source/curated records, {len(result['index_errors'])} integrity errors")

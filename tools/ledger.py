#!/usr/bin/env python3
"""Research Atlas verdict ledger: validate, search, build, reproduce, import.

One JSON file per tested hypothesis lives under ledger/<domain>/<id>.json.
Failures are first-class records. Nothing here upgrades a record's evidence
level automatically: CI reports reproduction results, maintainers decide.

  python tools/ledger.py validate
  python tools/ledger.py search "warmup cosine" --verdict KILLED_IN_SCOPE
  python tools/ledger.py new --domain llm-training --id my-idea < draft.json
  python tools/ledger.py build --output web/data/merged.json
  python tools/ledger.py repro <id> [<id> ...]
  python tools/ledger.py import-nk bank.jsonl --domain pde --contributor "name" --out drafts/

Standard library only (Python 3.10+).
"""
import argparse
import datetime as dt
import json
import math
import re
import shlex
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from build_index import enrich  # noqa: E402  (shared graph builder)
from privacy import redact  # noqa: E402

SCHEMA = 'verdict-record-v1'
VERDICTS = ['SUPPORTED', 'KILLED_IN_SCOPE', 'IMPLEMENTATION_FAILED', 'LITERATURE_COLLISION',
            'INVALIDATED', 'RESOURCE_LIMITED', 'INCONCLUSIVE', 'OPEN']
LEVELS = ['CLAIMED', 'SOURCE_DOCUMENTED', 'ARTIFACT_LINKED', 'CI_REPRODUCED', 'INDEPENDENTLY_REPRODUCED']
RELATIONS = {'refines', 'contradicts', 'supersedes', 'depends_on', 'duplicates', 'follows_up'}
OPS = {'<', '<=', '>', '>=', '==', '~='}
FIELDS = {'schema', 'id', 'title', 'domain', 'project', 'question', 'hypothesis', 'setup', 'outcome',
          'metrics', 'verdict', 'scope', 'cause', 'evidence_level', 'contributor', 'date', 'evidence',
          'repro', 'reproductions', 'related', 'follow_up', 'tags', 'license'}
REQUIRED = ['schema', 'id', 'title', 'domain', 'hypothesis', 'verdict', 'scope', 'evidence_level',
            'contributor', 'date', 'evidence']
ID_RE = re.compile(r'^[a-z0-9][a-z0-9-]{2,80}$')
DOMAIN_RE = re.compile(r'^[a-z0-9][a-z0-9-]*$')
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
SHA_RE = re.compile(r'^[a-fA-F0-9]{64}$')
DEFAULT_LEDGER = ROOT / 'ledger'


# ---------------------------------------------------------------- loading

def load(ledgers):
    """Return [(path, record_or_None, error_or_None)] for every ledger/*/*.json."""
    out = []
    for base in ledgers:
        base = Path(base)
        if not base.is_dir():
            out.append((base, None, 'ledger directory not found'))
            continue
        for path in sorted(base.glob('*/*.json')):
            try:
                out.append((path, json.loads(path.read_text(encoding='utf-8-sig')), None))
            except (OSError, json.JSONDecodeError) as exc:
                out.append((path, None, f'unreadable JSON: {exc}'))
    return out


# ---------------------------------------------------------------- validation

def _tokens(text):
    return set(re.findall(r'[a-z0-9]{3,}|[一-鿿]', (text or '').lower()))


def check_record(r, path=None):
    """Return a list of error strings for one record. Empty list means valid."""
    e = []
    if not isinstance(r, dict):
        return ['record must be a JSON object']
    for k in REQUIRED:
        if k not in r or r[k] in ('', None, [], {}):
            e.append(f'missing required field: {k}')
    for k in r:
        if k not in FIELDS:
            e.append(f'unknown field: {k}')
    if r.get('schema') not in (None, SCHEMA):
        e.append(f'schema must be {SCHEMA}')
    rid = r.get('id', '')
    if rid and not ID_RE.match(str(rid)):
        e.append('id must be lowercase letters, digits and hyphens (3-81 chars)')
    dom = r.get('domain', '')
    if dom and not DOMAIN_RE.match(str(dom)):
        e.append('domain must be lowercase letters, digits and hyphens')
    if path is not None:
        p = Path(path)
        if rid and p.stem != rid:
            e.append(f'file name {p.name} must equal id {rid}.json')
        if dom and p.parent.name != dom:
            e.append(f'directory {p.parent.name}/ must equal domain {dom}')
    for k in ('title', 'hypothesis', 'scope'):
        if k in r and not isinstance(r[k], str):
            e.append(f'{k} must be a string')
    if isinstance(r.get('title'), str) and not 8 <= len(r['title']) <= 200:
        e.append('title must be 8-200 characters')
    if isinstance(r.get('hypothesis'), str) and len(r['hypothesis']) < 10:
        e.append('hypothesis is too short to be falsifiable')
    if isinstance(r.get('scope'), str) and len(r['scope']) < 10:
        e.append('scope must state the conditions under which the verdict holds')
    if r.get('verdict') and r['verdict'] not in VERDICTS:
        e.append(f'verdict must be one of {VERDICTS}')
    if r.get('evidence_level') and r['evidence_level'] not in LEVELS:
        e.append(f'evidence_level must be one of {LEVELS}')
    if r.get('date') and not (isinstance(r['date'], str) and DATE_RE.match(r['date'])):
        e.append('date must be YYYY-MM-DD')
    c = r.get('contributor')
    if c is not None:
        if not isinstance(c, dict) or not c.get('name') or c.get('kind') not in ('human', 'agent'):
            e.append('contributor needs name and kind (human|agent)')
        elif set(c) - {'name', 'kind', 'model', 'operator'}:
            e.append('contributor has unknown fields')
        elif c['kind'] == 'agent' and not c.get('operator'):
            e.append('agent contributors must name a responsible human operator')
    ev = r.get('evidence')
    if ev is not None:
        if not isinstance(ev, list):
            e.append('evidence must be a list')
        else:
            for i, x in enumerate(ev):
                if not isinstance(x, dict) or not x.get('label'):
                    e.append(f'evidence[{i}] needs a label')
                    continue
                if set(x) - {'label', 'url', 'path', 'sha256', 'excerpt', 'line_start', 'line_end'}:
                    e.append(f'evidence[{i}] has unknown fields')
                if x.get('url') and not str(x['url']).startswith('https://'):
                    e.append(f'evidence[{i}].url must be https')
                if x.get('sha256') and not SHA_RE.match(str(x['sha256'])):
                    e.append(f'evidence[{i}].sha256 must be 64 hex characters')
                if len(str(x.get('excerpt', ''))) > 2000:
                    e.append(f'evidence[{i}].excerpt must be at most 2000 characters')
    # Semantics that distinguish this ledger from a pile of notes.
    verdict, level = r.get('verdict'), r.get('evidence_level')
    if verdict in ('KILLED_IN_SCOPE', 'INVALIDATED', 'IMPLEMENTATION_FAILED') and not r.get('cause'):
        e.append(f'{verdict} needs a cause: why did it fail, as far as the evidence shows?')
    if verdict == 'LITERATURE_COLLISION' and not any(isinstance(x, dict) and x.get('url') for x in ev or []):
        e.append('LITERATURE_COLLISION needs an evidence url pointing to the prior work')
    if level in ('ARTIFACT_LINKED', 'CI_REPRODUCED', 'INDEPENDENTLY_REPRODUCED') and not any(
            isinstance(x, dict) and (x.get('url') or x.get('path')) for x in ev or []):
        e.append(f'{level} needs at least one evidence item with a url or path')
    if level == 'CI_REPRODUCED' and not r.get('repro'):
        e.append('CI_REPRODUCED needs a repro block')
    if level == 'INDEPENDENTLY_REPRODUCED':
        name = (c or {}).get('name') if isinstance(c, dict) else None
        confirmed = [x for x in r.get('reproductions', []) if isinstance(x, dict)
                     and x.get('result') == 'CONFIRMED' and x.get('by') != name]
        if not confirmed:
            e.append('INDEPENDENTLY_REPRODUCED needs a CONFIRMED reproduction by someone other than the contributor')
    rp = r.get('repro')
    if rp is not None:
        if not isinstance(rp, dict) or not rp.get('command') or not rp.get('expect'):
            e.append('repro needs command, timeout_minutes and expect')
        else:
            t = rp.get('timeout_minutes')
            if not isinstance(t, (int, float)) or not 0 < t <= 20:
                e.append('repro.timeout_minutes must be in (0, 20]')
            for i, x in enumerate(rp.get('expect') or []):
                if not isinstance(x, dict) or not x.get('metric') or x.get('op') not in OPS \
                        or not isinstance(x.get('value'), (int, float)):
                    e.append(f'repro.expect[{i}] needs metric, op in {sorted(OPS)} and numeric value')
    for i, x in enumerate(r.get('reproductions') or []):
        if not isinstance(x, dict) or not x.get('by') or x.get('result') not in ('CONFIRMED', 'CONTRADICTED', 'PARTIAL') \
                or not DATE_RE.match(str(x.get('date', ''))):
            e.append(f'reproductions[{i}] needs by, date and result (CONFIRMED|CONTRADICTED|PARTIAL)')
    for i, x in enumerate(r.get('related') or []):
        if not isinstance(x, dict) or x.get('type') not in RELATIONS or not x.get('target'):
            e.append(f'related[{i}] needs type in {sorted(RELATIONS)} and target id')
    if 'tags' in r and (not isinstance(r['tags'], list) or len(set(map(str, r['tags']))) != len(r['tags'])):
        e.append('tags must be a list of unique strings')
    if 'metrics' in r and not isinstance(r['metrics'], dict):
        e.append('metrics must be an object')
    return e


def validate(ledgers):
    """Return (errors, warnings, records). errors/warnings are lists of strings."""
    errors, warnings, records, seen = [], [], [], {}
    for path, r, err in load(ledgers):
        rel = _rel(path)
        if err:
            errors.append(f'{rel}: {err}')
            continue
        for msg in check_record(r, path):
            errors.append(f'{rel}: {msg}')
        rid = r.get('id') if isinstance(r, dict) else None
        if rid in seen:
            errors.append(f'{rel}: duplicate id {rid} (also {seen[rid]})')
        elif rid:
            seen[rid] = rel
            records.append(r)
    ids = set(seen)
    for r in records:
        for x in r.get('related') or []:
            if isinstance(x, dict) and x.get('target') and x['target'] not in ids:
                errors.append(f"{seen[r['id']]}: related target {x['target']} does not exist")
    # Near-duplicate hypotheses are a warning: two scoped tests of similar ideas
    # can both be legitimate, but a reviewer should look before merging.
    toks = [(r['id'], _tokens(r.get('hypothesis', '') + ' ' + r.get('title', ''))) for r in records]
    for i in range(len(toks)):
        for j in range(i + 1, len(toks)):
            a, b = toks[i][1], toks[j][1]
            if a and b and len(a & b) / len(a | b) >= 0.8:
                warnings.append(f'possible duplicate: {toks[i][0]} ~ {toks[j][0]} (link with related.duplicates or refines)')
    return errors, warnings, records


def _rel(path):
    try:
        return Path(path).resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


# ---------------------------------------------------------------- search

def search_records(records, query, verdict=None, domain=None, failures_only=False):
    terms = [t for t in query.lower().split() if t]
    out = []
    for r in records:
        if verdict and r.get('verdict') != verdict:
            continue
        if domain and r.get('domain') != domain:
            continue
        if failures_only and r.get('verdict') in ('SUPPORTED', 'OPEN'):
            continue
        hay = ' '.join(str(r.get(k, '')) for k in ('id', 'title', 'question', 'hypothesis', 'setup', 'outcome',
                                                     'scope', 'cause', 'follow_up', 'project', 'domain')).lower()
        hay += ' ' + ' '.join(map(str, r.get('tags', []))).lower()
        if all(t in hay for t in terms):
            out.append(r)
    return sorted(out, key=lambda r: (LEVELS.index(r.get('evidence_level', 'CLAIMED')) * -1, r.get('date', '')), reverse=False)


# ---------------------------------------------------------------- build

def to_atlas(r, source):
    c = r.get('contributor', {})
    who = c.get('name', 'unknown') + (f" ({c['model']})" if c.get('model') else '')
    evidence = []
    for x in r.get('evidence', []):
        item = {k: v for k, v in x.items() if k in ('label', 'url', 'path', 'sha256', 'line_start', 'line_end')}
        if x.get('excerpt'):
            item['excerpt'] = redact(x['excerpt'])
        item['source_path'] = x.get('path') or x.get('url') or source
        evidence.append(item)
    return {
        'id': r['id'], 'title': r['title'], 'kind': 'verdict', 'domain': r['domain'],
        'project': r.get('project', r['domain']), 'status': r['verdict'],
        'verification': r['evidence_level'], 'scope': r['scope'], 'cause': r.get('cause', ''),
        'question': r.get('question', ''), 'hypothesis': r['hypothesis'],
        'experiment': r.get('setup', ''), 'result_summary': r.get('outcome', ''),
        'metrics': r.get('metrics', {}), 'follow_up': r.get('follow_up', ''),
        'summary': r.get('outcome') or r['hypothesis'], 'tags': r.get('tags', []),
        'date': r['date'], 'date_provenance': 'VERDICT_DATE_STATED_BY_CONTRIBUTOR',
        'machine': who, 'origin_machines': [who], 'contributor': c,
        'result_verified': r['evidence_level'] in ('CI_REPRODUCED', 'INDEPENDENTLY_REPRODUCED'),
        'reproductions': r.get('reproductions', []), 'repro': r.get('repro'),
        'relations': [{'type': x['type'], 'target': x['target']} for x in r.get('related', [])],
        'evidence': evidence, 'ledger_path': source, 'license': r.get('license', 'CC-BY-4.0'),
    }


def build(ledgers, private=False):
    errors, warnings, records = validate(ledgers)
    if errors:
        raise SystemExit('ledger has errors; run `python tools/ledger.py validate`:\n  ' + '\n  '.join(errors))
    paths = {r['id']: _rel(p) for p, r, err in load(ledgers) if r and not err}
    catalog = {
        'schema_version': 'atlas-catalog-v0.2',
        'project': 'Research Atlas verdict ledger',
        'data_policy': 'PRIVATE_LOCAL_LEDGER' if private else 'PUBLIC_LEDGER_CC_BY_4_0',
        'archive_scope': 'VERDICT_LEDGER',
        'generated_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
        'records': [to_atlas(r, paths[r['id']]) for r in sorted(records, key=lambda r: r['id'])],
        'source_archives': {}, 'index_errors': [],
        'semantic_review': [{'type': 'POSSIBLE_DUPLICATE_HYPOTHESIS', 'title_key': w,
                             'record_ids': re.findall(r'([a-z0-9-]+) ~ ([a-z0-9-]+)', w)[0],
                             'statuses': [], 'action': 'REVIEW; link with related if both stand'}
                            for w in warnings if w.startswith('possible duplicate')],
    }
    for item in catalog['semantic_review']:
        item['record_ids'] = list(item['record_ids'])
    catalog = enrich(catalog)
    catalog['statistics']['failure_records'] = sum(r['status'] not in ('SUPPORTED', 'OPEN') for r in catalog['records'])
    return catalog


# ---------------------------------------------------------------- reproduction

def _compare(actual, op, value, tol):
    if op == '<': return actual < value
    if op == '<=': return actual <= value
    if op == '>': return actual > value
    if op == '>=': return actual >= value
    if op == '==': return actual == value
    return math.isclose(actual, value, abs_tol=tol if tol is not None else 1e-6)  # ~=


def reproduce(record, cwd=ROOT):
    """Run record['repro'] and return (ok, report_dict). Never edits the record."""
    rp = record.get('repro')
    if not rp:
        return None, {'id': record.get('id'), 'status': 'NO_REPRO'}
    workdir = (Path(cwd) / rp.get('workdir', '.')).resolve()
    if Path(cwd).resolve() not in (workdir, *workdir.parents):
        return False, {'id': record['id'], 'status': 'BAD_WORKDIR'}
    try:
        proc = subprocess.run(shlex.split(rp['command']), cwd=workdir, capture_output=True, text=True,
                              timeout=rp['timeout_minutes'] * 60)
    except subprocess.TimeoutExpired:
        return False, {'id': record['id'], 'status': 'TIMEOUT'}
    except OSError as exc:
        return False, {'id': record['id'], 'status': 'CANNOT_RUN', 'error': str(exc)}
    lines = [x for x in proc.stdout.splitlines() if x.strip()]
    try:
        got = json.loads(lines[-1]) if lines else None
        assert isinstance(got, dict)
    except (ValueError, AssertionError):
        return False, {'id': record['id'], 'status': 'NO_METRICS_LINE', 'returncode': proc.returncode,
                       'stderr_tail': proc.stderr[-800:]}
    checks, ok = [], proc.returncode == 0
    for x in rp['expect']:
        actual = got.get(x['metric'])
        passed = isinstance(actual, (int, float)) and _compare(actual, x['op'], x['value'], x.get('tolerance'))
        ok = ok and passed
        checks.append({**x, 'actual': actual, 'passed': passed})
    return ok, {'id': record['id'], 'status': 'MATCHED' if ok else 'MISMATCH', 'returncode': proc.returncode,
                'checks': checks}


# ---------------------------------------------------------------- Negative_Knowledge import

def from_negative_knowledge(nk, domain, contributor, kind='human', operator=None, model=None):
    """Convert one hch-wang/Negative_Knowledge record into a CLAIMED draft."""
    f = nk.get('failure') or {}
    layer = ' '.join(str(f.get(k, '')) for k in ('layer', 'recommended_action')).lower()
    if any(w in layer for w in ('implement', 'code', 'bug', 'runtime', 'environment')):
        verdict = 'IMPLEMENTATION_FAILED'
    elif any(w in layer for w in ('resource', 'budget', 'compute', 'timeout', 'memory')):
        verdict = 'RESOURCE_LIMITED'
    else:
        verdict = 'KILLED_IN_SCOPE'
    route = str(nk.get('attempted_route', '')).strip()
    task = str(nk.get('task_id', 'task'))
    rid = re.sub(r'[^a-z0-9]+', '-', f'{task}-{route}'.lower()).strip('-')[:70] or 'nk-record'
    c = {'name': contributor, 'kind': kind}
    if model: c['model'] = model
    if operator: c['operator'] = operator
    return {
        'schema': SCHEMA, 'id': rid, 'title': (route or task)[:200].ljust(8, '.'), 'domain': domain,
        'project': task, 'hypothesis': f'Route "{route}" solves task {task}.',
        'outcome': str(nk.get('observation', '')),
        'verdict': verdict,
        'scope': f"Task {task}; failure scope as recorded: {f.get('scope', 'unspecified')}; degree: {f.get('degree', 'unspecified')}.",
        'cause': str(nk.get('rationale', '') or f.get('layer', '')),
        'follow_up': str(nk.get('recommended_alternative', '')),
        'evidence_level': 'CLAIMED', 'contributor': c,
        'date': dt.date.today().isoformat(),
        'evidence': [{'label': 'Imported from a Negative_Knowledge bank (github.com/hch-wang/Negative_Knowledge format); review before merging',
                      'excerpt': json.dumps(nk, ensure_ascii=False)[:2000]}],
        'tags': ['imported-negative-knowledge'] + ([f"risk:{f['risk']}"] if f.get('risk') else []),
    }


# ---------------------------------------------------------------- CLI

def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--ledger', action='append', help='Ledger directory (repeatable). Default: ./ledger')
    sub = p.add_subparsers(dest='cmd', required=True)
    sub.add_parser('validate', help='Check every record; exit 1 on errors')
    s = sub.add_parser('search', help='Look up prior verdicts before running an experiment')
    s.add_argument('query', nargs='?', default='')
    s.add_argument('--verdict', choices=VERDICTS)
    s.add_argument('--domain')
    s.add_argument('--failures', action='store_true', help='Only failed / dead-end records')
    s.add_argument('--json', action='store_true')
    n = sub.add_parser('new', help='Write a record from a JSON draft on stdin (or an empty template)')
    n.add_argument('--domain', required=True)
    n.add_argument('--id', required=True)
    n.add_argument('--template', action='store_true', help='Write a template instead of reading stdin')
    b = sub.add_parser('build', help='Compile ledger(s) into the web catalog (atlas-catalog-v0.2)')
    b.add_argument('--output', default=str(ROOT / 'web' / 'data' / 'merged.json'))
    b.add_argument('--private', action='store_true', help='Mark output as a private local catalog')
    r = sub.add_parser('repro', help='Run repro blocks and report; never edits records')
    r.add_argument('ids', nargs='*', help='Record ids; default: all records that have repro')
    r.add_argument('--files', nargs='*', default=[], help='Changed file paths (CI); non-ledger paths ignored')
    r.add_argument('--report', help='Write a markdown report here (e.g. $GITHUB_STEP_SUMMARY)')
    i = sub.add_parser('import-nk', help='Convert a Negative_Knowledge bank (JSON list or JSONL) into drafts')
    i.add_argument('bank')
    i.add_argument('--domain', required=True)
    i.add_argument('--contributor', required=True)
    i.add_argument('--agent-model', help='Mark records as agent-contributed by this model')
    i.add_argument('--operator', help='Responsible human for agent contributions')
    i.add_argument('--out', required=True, help='Draft directory; review, then move into ledger/<domain>/')
    a = p.parse_args(argv)
    ledgers = a.ledger or [DEFAULT_LEDGER]

    if a.cmd == 'validate':
        errors, warnings, records = validate(ledgers)
        for w in warnings:
            print('WARN ', w)
        for e in errors:
            print('ERROR', e)
        print(f'{len(records)} records, {len(errors)} errors, {len(warnings)} warnings')
        return 1 if errors else 0

    if a.cmd == 'search':
        _, _, records = validate(ledgers)
        hits = search_records(records, a.query, a.verdict, a.domain, a.failures)
        if a.json:
            print(json.dumps(hits, ensure_ascii=False, indent=2))
        else:
            for h in hits:
                print(f"[{h['verdict']} · {h['evidence_level']}] {h['id']}: {h['title']}\n    scope: {h['scope']}"
                      + (f"\n    cause: {h['cause']}" if h.get('cause') else ''))
            print(f'{len(hits)} matching records')
        return 0

    if a.cmd == 'new':
        base = Path(ledgers[0]) / a.domain
        path = base / f'{a.id}.json'
        if path.exists():
            print(f'refusing to overwrite {path}', file=sys.stderr)
            return 1
        if a.template:
            draft = {'title': '', 'hypothesis': '', 'setup': '', 'outcome': '', 'verdict': 'OPEN', 'scope': '',
                     'cause': '', 'evidence_level': 'CLAIMED', 'contributor': {'name': '', 'kind': 'human'},
                     'evidence': [{'label': ''}], 'tags': []}
        else:
            draft = json.loads(sys.stdin.read())
        record = {'schema': SCHEMA, 'id': a.id, 'domain': a.domain, 'date': dt.date.today().isoformat(), **draft}
        record['id'], record['domain'], record['schema'] = a.id, a.domain, SCHEMA
        problems = check_record(record, path)
        base.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'wrote {path}')
        for msg in problems:
            print('TODO ', msg)
        return 0 if (a.template or not problems) else 1

    if a.cmd == 'build':
        catalog = build(ledgers, a.private)
        out = Path(a.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
        st = catalog['statistics']
        print(f"wrote {out}: {len(catalog['records'])} records ({st['failure_records']} failures), "
              f"{len(catalog['nodes'])} nodes, {len(catalog['edges'])} edges")
        return 0

    if a.cmd == 'repro':
        errors, _, records = validate(ledgers)
        if errors:
            print('\n'.join(errors))
            return 1
        wanted = set(a.ids)
        for f in a.files:
            fp = Path(f)
            if fp.suffix == '.json' and 'ledger' in fp.parts:
                wanted.add(fp.stem)
        targets = [r for r in records if r.get('repro') and (not wanted or r['id'] in wanted)] \
            if (wanted or not a.files) else []
        failed = False
        lines = ['## Reproduction report', '',
                 'CI never upgrades evidence levels. A maintainer may set CI_REPRODUCED after a MATCHED run.', '']
        for rec in targets:
            ok, rep = reproduce(rec)
            failed |= ok is False
            lines.append(f"- `{rec['id']}`: **{rep['status']}**")
            for ch in rep.get('checks', []):
                lines.append(f"  - {ch['metric']} {ch['op']} {ch['value']} → actual {ch['actual']} "
                             f"({'pass' if ch['passed'] else 'FAIL'})")
            if rep.get('stderr_tail'):
                lines.append('  ```\n' + rep['stderr_tail'] + '\n  ```')
        if not targets:
            lines.append('No records with repro blocks in scope.')
        text = '\n'.join(lines)
        print(text)
        if a.report:
            with open(a.report, 'a', encoding='utf-8') as fh:
                fh.write(text + '\n')
        return 1 if failed else 0

    if a.cmd == 'import-nk':
        raw = Path(a.bank).read_text(encoding='utf-8-sig').strip()
        items = json.loads(raw) if raw.startswith('[') else [json.loads(x) for x in raw.splitlines() if x.strip()]
        out = Path(a.out) / a.domain
        out.mkdir(parents=True, exist_ok=True)
        kind = 'agent' if a.agent_model else 'human'
        for nk in items:
            rec = from_negative_knowledge(nk, a.domain, a.contributor, kind, a.operator, a.agent_model)
            path = out / f"{rec['id']}.json"
            path.write_text(json.dumps(rec, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            print(f"draft {path}" + ''.join(f'\n  TODO {m}' for m in check_record(rec, path)))
        return 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""Turn autoresearch run artifacts into Sci-Map draft records.

Drafts are written to a review directory, never into ledger/. A human reads
them, rewrites what needs rewriting, and moves the approved ones in with
`python tools/ledger.py submit draft.json --write`.

Adapters (one per artifact shape found in the RanchoResearch family):

  round-report   <campaign>/rounds/*/REPORT.md   (H1 title, "Decision: **...**", source URLs)
  run-findings   <outputs>/*/*/FINDINGS.md + summary.json   (executed experiments)
  nk-jsonl       NEGATIVE_KNOWLEDGE.jsonl   (one decision per line: KILL_* / PARK_* / HOLD_*)
  research-state RanchoResearch research_state v0.1 JSON   (structured; usually review-ready)
  mathforge      MathForge workspace: negative_knowledge/ + atlas.jsonl + knowledge/sources

Every draft carries provenance: the source repository, the file path inside
it, the file's SHA-256 and a short excerpt. Local absolute paths are never
written; pass --source-repo so evidence reads e.g. "RanchoTao/KDD2027:rounds/R029/REPORT.md".

  python tools/import_runs.py round-report ../KDD2027 --source-repo RanchoTao/KDD2027 \\
      --domain kdd-data-mining --operator "Shengye Tao" --out drafts/
  python tools/import_runs.py run-findings ../RanchoControl/outputs --source-repo RanchoTao/RanchoControl \\
      --domain test-time-adaptation --operator "Shengye Tao" --out drafts/

Standard library only.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'tools'))
from privacy import redact  # noqa: E402
import ledger  # noqa: E402

URL_RE = re.compile(r'https://[^\s)\]>"\'`]+')


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def slug(text, limit=70):
    s = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    s = s[:limit].rstrip('-') or 'record'
    return s if len(s) >= 3 else s + '-record'


def excerpt(text, limit=600):
    text = re.sub(r'\s+', ' ', redact(text)).strip()
    return text[:limit] + ('…' if len(text) > limit else '')


def classify(decision):
    """Map a campaign's own decision words to a Sci-Map verdict. Conservative: unknown → INCONCLUSIVE."""
    d = (decision or '').upper()
    if any(w in d for w in ('COLLISION', 'SOURCE-OWNED', 'SOURCE_OWNED', 'PRIOR ART', 'ALREADY', 'CLASSICAL CONTROL',
                            'REDISCOVER')):
        return 'LITERATURE_COLLISION'
    if any(w in d for w in ('BUILD ATTEMPT FAILED', 'IMPLEMENTATION_FAILED', 'IMPLEMENTATION FAILED', 'NOT_QUALIFIED',
                            'NOT QUALIFIED', 'FLOAT QUALIFICATION', 'DRAFT REJECTED', 'BUG FOUND')):
        return 'IMPLEMENTATION_FAILED'
    if any(w in d for w in ('INVALID', 'RETIRED', 'SUPERSEDED', 'CORRECTED')):
        return 'INVALIDATED'
    if any(w in d for w in ('BLOCKED', 'ACQUISITION', 'BUDGET', 'INTERRUPTED', 'TIMEOUT', 'ACCESS')):
        return 'RESOURCE_LIMITED'
    if any(w in d for w in ('KILL', 'REJECT', 'FAIL', 'NEGATIVE', 'MISSES', 'DOES NOT', 'NO CANDIDATE', 'PARK',
                            'ZERO', 'NO DISTINCT', 'NO ORIGINAL', 'REDUCES EXACTLY')):
        return 'KILLED_IN_SCOPE'
    if 'PASS' in d and 'HOLD' not in d:
        return 'SUPPORTED'
    return 'INCONCLUSIVE'


def contributor(a):
    c = {'name': a.contributor, 'kind': 'agent' if a.model else 'human'}
    if a.model:
        c['model'] = a.model
        c['operator'] = a.operator
    return c


def base_draft(a, rid, title, hypothesis, verdict, scope, date, evidence, **extra):
    rec = {'schema': ledger.SCHEMA, 'id': rid[:81], 'title': title[:200].ljust(8, '.'), 'domain': a.domain,
           'project': a.project or a.source_repo.split('/')[-1], 'hypothesis': hypothesis, 'verdict': verdict,
           'scope': scope, 'evidence_level': 'SOURCE_DOCUMENTED', 'contributor': contributor(a), 'date': date,
           'evidence': evidence, 'tags': ['imported', a.adapter]}
    rec.update({k: v for k, v in extra.items() if v})
    if verdict in ('KILLED_IN_SCOPE', 'INVALIDATED', 'IMPLEMENTATION_FAILED') and not rec.get('cause'):
        rec['cause'] = 'TODO: state why, as far as the source shows.'
    return rec


def src_evidence(a, root, path, text, label='Source record'):
    rel = Path(path).relative_to(root).as_posix()
    return {'label': f'{label}: {a.source_repo}:{rel}', 'sha256': sha256(path), 'excerpt': excerpt(text)}


def date_from(name, fallback='1970-01-01'):
    m = re.search(r'(20\d{2})(\d{2})(\d{2})', name)
    return f'{m.group(1)}-{m.group(2)}-{m.group(3)}' if m else fallback


# ---------------------------------------------------------------- adapters

def adapt_round_report(a):
    root = Path(a.path)
    for rep in sorted(root.glob('rounds/*/REPORT.md')):
        text = rep.read_text(encoding='utf-8', errors='replace')
        h = re.search(r'^#\s+(.+)$', text, re.M)
        title = h.group(1).strip() if h else rep.parent.name
        dm = re.search(r'Decision:\s*\*\*(.+?)\*\*', text, re.S)
        decision = dm.group(1) if dm else title
        body = re.sub(r'^#.*$', '', text, count=1, flags=re.M).strip()
        first = body.split('\n\n')[0]
        evidence = [src_evidence(a, root, rep, first, 'Round report')]
        for u in dict.fromkeys(URL_RE.findall(text)):
            evidence.append({'label': 'Source cited in the round report', 'url': u.rstrip('.,;')})
        rid = slug(f'{a.id_prefix}{rep.parent.name.split("_")[0]}-{title}')
        yield base_draft(a, rid, title, f'TODO (from: {excerpt(decision, 200)})', classify(decision + ' ' + title),
                         'TODO: narrowest honest scope.', date_from(rep.parent.name), evidence,
                         outcome=excerpt(first, 1200))


def adapt_run_findings(a):
    root = Path(a.path)
    for fnd in sorted(root.glob('*/*/FINDINGS.md')):
        text = fnd.read_text(encoding='utf-8', errors='replace')
        h = re.search(r'^#\s+(.+)$', text, re.M)
        title = h.group(1).strip() if h else fnd.parent.parent.name
        evidence = [src_evidence(a, root, fnd, text.split('\n\n')[1] if '\n\n' in text else text, 'Run findings')]
        metrics = {}
        summ = fnd.parent / 'summary.json'
        if summ.exists():
            evidence.append(src_evidence(a, root, summ, summ.read_text(encoding='utf-8')[:400], 'Run summary'))
            try:
                s = json.loads(summ.read_text(encoding='utf-8'))
                for k, v in (s.get('METRICS') or s.get('metrics') or {}).items():
                    if isinstance(v, (int, float, str, bool)) or v is None:
                        metrics[k] = v
            except ValueError:
                pass
        rid = slug(f'{a.id_prefix}{fnd.parent.parent.name}')
        yield base_draft(a, rid, title, 'TODO: the falsifiable claim this run tested.', classify(title),
                         'TODO: data, model, budget, seeds.', date_from(fnd.parent.parent.name), evidence,
                         outcome=excerpt(text, 1200), metrics=metrics)


def adapt_nk_jsonl(a):
    path = Path(a.path)
    root = path.parent
    for i, line in enumerate(path.read_text(encoding='utf-8').splitlines()):
        if not line.strip():
            continue
        r = json.loads(line)
        decision = str(r.get('decision') or r.get('disposition') or r.get('classification') or '')
        if not decision:
            continue
        name = str(r.get('id') or r.get('problem_id') or f'line-{i + 1}')
        ev = [{'label': f'Negative-knowledge entry {name}: {a.source_repo}:{path.name} line {i + 1}',
               'sha256': sha256(path), 'excerpt': excerpt(json.dumps(r, ensure_ascii=False))}]
        for u in dict.fromkeys(URL_RE.findall(line)):
            ev.append({'label': 'Cited source', 'url': u.rstrip('.,;')})
        scope = r.get('scope') if isinstance(r.get('scope'), str) else 'TODO: narrowest honest scope.'
        yield base_draft(a, slug(f'{a.id_prefix}{name}'), decision.replace('_', ' ').capitalize(),
                         'TODO: the claim that was tested.', classify(decision), scope,
                         str(r.get('utc', ''))[:10] or '1970-01-01', ev)


# ---------------------------------------------------------------- structured exporters (one-command export)

def _https(u):
    return u if isinstance(u, str) and u.startswith('https://') else None


def adapt_research_state(a):
    """RanchoResearch / AutoResearchClaw research_state v0.1 (one JSON file per project).

    One record per hypothesis that reached a verdict: SUPPORTED, RESTRICTED or REFUTED, or that a KILL
    decision targets. PROPOSED / UNDER_TEST / FROZEN hypotheses are skipped (nothing was decided).
    """
    path = Path(a.path)
    if path.suffix in ('.yaml', '.yml'):
        try:
            import yaml  # optional; JSON state files need nothing beyond the standard library
        except ImportError:
            raise SystemExit('YAML state needs PyYAML (pip install pyyaml), or export the state as JSON')
        st = yaml.safe_load(path.read_text(encoding='utf-8'))
    else:
        st = json.loads(path.read_text(encoding='utf-8'))
    st = json.loads(json.dumps(st, default=str))  # YAML timestamps -> ISO strings
    proj = st.get('project', {})
    ev_by_id = {e['id']: e for e in st.get('evidence', [])}
    art_by_id = {x['id']: x for x in st.get('artifacts', [])}
    claims = {c['id']: c for c in st.get('claims', [])}
    kills = {d['target_id']: d for d in st.get('decisions', []) if d.get('decision_type') == 'KILL'}
    exps = st.get('experiments', [])
    tasks = {t['id']: t for t in st.get('tasks', [])}

    def task_text(ref):
        t = tasks.get(ref or '')
        return (t.get('title') + (': ' + t['description'] if t.get('description') else '')) if t else None

    for h in st.get('hypotheses', []):
        status, kill = h.get('status'), kills.get(h['id'])
        if status not in ('SUPPORTED', 'RESTRICTED', 'REFUTED') and not kill:
            continue
        my_exps = [x for x in exps if h['id'] in (x.get('hypothesis_ids') or [])]
        failed_impl = any(x.get('status') in ('FAILED', 'ABORTED') and re.search(r'(?i)bug|implement|crash|oom',
                          str(x.get('failure_reason') or '')) for x in my_exps)
        if status == 'REFUTED' or kill:
            verdict = 'IMPLEMENTATION_FAILED' if failed_impl else 'KILLED_IN_SCOPE'
        elif any(x.get('status') == 'INCONCLUSIVE' for x in my_exps) and status != 'SUPPORTED':
            verdict = 'INCONCLUSIVE'
        else:
            verdict = 'SUPPORTED'
        ev_ids = set(h.get('supporting_claims', [])) | set(h.get('attacking_claims', []))
        evidence, linked = [], set()
        for cid in ev_ids:
            c = claims.get(cid, {})
            linked |= set(c.get('supporting_evidence', [])) | set(c.get('opposing_evidence', []))
        if kill:
            linked |= set(kill.get('supporting_evidence', []))
        for x in my_exps:
            linked |= set(x.get('result_evidence', []))
        for eid in sorted(linked):
            e = ev_by_id.get(eid)
            if not e:
                continue
            item = {'label': f"{e.get('type', 'EVIDENCE').title()}: {e.get('title', eid)}"[:300]}
            if _https(e.get('source_uri')):
                item['url'] = e['source_uri']
            art = art_by_id.get(e.get('artifact_id') or '')
            if art and art.get('sha256') and re.fullmatch(r'[0-9a-fA-F]{64}', art['sha256']):
                item['label'] += f" (artifact {a.source_repo}:{art.get('path', '')})"
                item['sha256'] = art['sha256']
            if e.get('summary'):
                item['excerpt'] = excerpt(e['summary'], 500)
            evidence.append(item)
        level = 'SOURCE_DOCUMENTED' if any('url' in x or 'sha256' in x for x in evidence) else 'CLAIMED'
        if not evidence:
            evidence = [{'label': f'research_state hypothesis {h["id"]}: {a.source_repo}:{path.name}', 'sha256': sha256(path)}]
        scopes = [claims[c]['scope'] for c in ev_ids if claims.get(c, {}).get('scope')]
        scope = '; '.join(scopes) or ('Assumptions: ' + '; '.join(h['assumptions']) if h.get('assumptions') else
                                      'TODO: narrowest honest scope.')
        metrics = {}
        for x in my_exps:
            for k, v in (x.get('metrics') or {}).items():
                if isinstance(v, (int, float, str, bool)) or v is None:
                    metrics[k] = v
        outcome = ' '.join(filter(None, [x.get('interpretation') for x in my_exps])) or None
        rec = base_draft(a, slug(f"{a.id_prefix}{h['statement']}"), h['statement'][:200],
                         h.get('formal_statement') or h['statement'], verdict, scope,
                         str(kill.get('timestamp') if kill else h.get('last_updated', ''))[:10] or '1970-01-01',
                         evidence, project=a.project or proj.get('title'), outcome=outcome and excerpt(outcome, 1500),
                         metrics=metrics, follow_up=task_text((kill or {}).get('next_action')) or task_text(proj.get('next_action')),
                         cause=h.get('kill_reason') or (kill or {}).get('reasoning_summary'))
        rec['evidence_level'] = level
        decider = str((kill or {}).get('decided_by') or h.get('created_by') or '')
        if decider.startswith('agent') and rec['contributor']['kind'] == 'human':
            owner = a.operator or (proj.get('owners') or [None])[0]
            if owner:
                rec['contributor'] = {'name': a.contributor, 'kind': 'agent',
                                      'model': a.model or 'RanchoResearch agents', 'operator': owner}
        rec['tags'] = sorted(set(rec['tags']) | set(proj.get('tags') or []))
        yield rec


MF_KIND = {'false_conjecture': 'KILLED_IN_SCOPE', 'failed_proof_strategy': 'KILLED_IN_SCOPE',
           'known_barrier': 'KILLED_IN_SCOPE', 'literature_collision': 'LITERATURE_COLLISION'}


def adapt_mathforge(a):
    """MathForge workspace: negative_knowledge/**/*.json joined with atlas.jsonl and knowledge/sources.

    replay_prohibition entries are operational, not scientific results, and are skipped.
    """
    root = Path(a.path)
    problems = {}
    atlas = root / 'atlas' / 'atlas.jsonl'
    if atlas.exists():
        for line in atlas.read_text(encoding='utf-8').splitlines():
            if line.strip():
                pr = json.loads(line)
                problems[pr['problem_id']] = pr
    sources = {}
    cat = root / 'knowledge' / 'sources' / 'catalog.json'
    if cat.exists():
        sources = {s['source_id']: s for s in json.loads(cat.read_text(encoding='utf-8'))}
    for f in sorted((root / 'negative_knowledge').rglob('*.json')):
        n = json.loads(f.read_text(encoding='utf-8'))
        kind = n.get('kind')
        if kind not in MF_KIND:
            continue
        det = n.get('details') or {}
        probs = [problems.get(pid, {}) for pid in n.get('problem_ids', [])]
        pname = '; '.join(p.get('name', pid) for p, pid in zip(probs, n.get('problem_ids', [])))
        if kind == 'false_conjecture':
            hyp, outcome = det.get('conjecture'), f"Counterexample: {det.get('smallest_known_counterexample')} " \
                f"(minimality {det.get('minimality_status')}). Verified by: {det.get('verification_procedure')}"
            cause = det.get('failure_reason')
        elif kind == 'failed_proof_strategy':
            hyp = f"Strategy \"{det.get('strategy')}\" proves: {det.get('target_theorem')}"
            outcome = f"Fails at: {det.get('failure_point')} ({det.get('failure_type')})."
            cause, follow = det.get('failure_type'), det.get('possible_repair')
        elif kind == 'known_barrier':
            hyp = f"Methods of type {det.get('barrier_type')} can resolve {pname or 'the problem'}."
            outcome = f"Barrier under hypotheses: {det.get('precise_hypotheses')}"
            cause = n.get('reason')
        else:
            hyp = f"The candidate statement is new: {det.get('matched_statement')}"
            outcome = f"Matched at {det.get('locator')}: {det.get('equivalence_argument')}"
            cause = 'Prior work states the same result.'
        ev = [{'label': f'MathForge negative record {n["negative_id"]}: {a.source_repo}:{f.relative_to(root).as_posix()}',
               'sha256': sha256(f), 'excerpt': excerpt(n.get('reason', ''), 400)}]
        if kind == 'false_conjecture' and re.fullmatch(r'[0-9a-f]{64}', str(det.get('code_sha256', ''))):
            ev.append({'label': f"Verification code {a.source_repo}:{det.get('exact_code_path')}", 'sha256': det['code_sha256']})
        for e in n.get('evidence', []) + ([{'source_id': det['source_id'], 'locator': det.get('locator', '')}]
                                          if det.get('source_id') else []):
            src = sources.get(e.get('source_id'), {})
            item = {'label': f"{src.get('title', e.get('source_id'))} — {e.get('locator', '')}"[:300]}
            if _https(src.get('url')) and 'example.invalid' not in src['url']:
                item['url'] = src['url']
            ev.append(item)
        verdict = MF_KIND[kind]
        if verdict == 'LITERATURE_COLLISION' and not any('url' in x for x in ev):
            verdict = 'KILLED_IN_SCOPE'   # collision without a linkable source cannot be published as one
        yield base_draft(a, slug(f"{a.id_prefix}{n['negative_id']}"), f"{pname or n['negative_id']}: {kind.replace('_', ' ')}",
                         hyp or 'TODO', verdict, n.get('scope') or 'TODO', str(n['provenance']['recorded_at'])[:10],
                         ev, project=a.project or 'MathForge', outcome=excerpt(outcome, 1500), cause=cause,
                         follow_up=locals().get('follow'), tags=['mathematics', kind])


ADAPTERS = {'round-report': adapt_round_report, 'run-findings': adapt_run_findings, 'nk-jsonl': adapt_nk_jsonl,
            'research-state': adapt_research_state, 'mathforge': adapt_mathforge}


def apply_overrides(drafts, overrides):
    """Curated fields win: {draft_id: {field: value, ...}}. A key "_drop": true removes the draft."""
    out = []
    for d in drafts:
        o = overrides.get(d['id'])
        if o is None:
            if not overrides.get('_only_listed'):
                out.append(d)
            continue
        if o.get('_drop'):
            continue
        new = {**d, **{k: v for k, v in o.items() if not k.startswith('_')}}
        if o.get('_evidence_extra'):
            new['evidence'] = d['evidence'] + o['_evidence_extra']
        out.append(new)
    return out


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('adapter', choices=sorted(ADAPTERS))
    p.add_argument('path', help='Campaign directory, outputs directory or JSONL file')
    p.add_argument('--source-repo', required=True, help='owner/repo shown in provenance (no local paths)')
    p.add_argument('--domain', required=True)
    p.add_argument('--project')
    p.add_argument('--contributor', default='RanchoResearch')
    p.add_argument('--model', help='Agent system that produced the run (makes contributor kind=agent)')
    p.add_argument('--operator', help='Responsible human (required with --model)')
    p.add_argument('--id-prefix', default='')
    p.add_argument('--overrides', help='JSON {draft_id: {field: value}} with curated fields')
    p.add_argument('--out', required=True, help='Draft directory (not ledger/)')
    a = p.parse_args(argv)
    if a.model and not a.operator:
        p.error('--operator is required with --model')
    drafts = list(ADAPTERS[a.adapter](a))
    if a.overrides:
        drafts = apply_overrides(drafts, json.loads(Path(a.overrides).read_text(encoding='utf-8')))
    out = Path(a.out) / a.domain
    out.mkdir(parents=True, exist_ok=True)
    n_ok = 0
    for d in drafts:
        path = out / f"{d['id']}.json"
        path.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        problems = ledger.check_record(d, path)
        todo = [k for k, v in d.items() if isinstance(v, str) and v.startswith('TODO')]
        n_ok += not problems and not todo
        print(f"{'READY' if not problems and not todo else 'DRAFT'} {path}"
              + ''.join(f'\n    {m}' for m in problems) + (f"\n    TODO fields: {', '.join(todo)}" if todo else ''))
    print(f'{len(drafts)} drafts, {n_ok} ready for review', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())

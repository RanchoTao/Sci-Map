#!/usr/bin/env python3
"""Convert a ResearchTree research_tree.json into a Sci-Map problem tree.

The problem tree is what the map shows: domain → topic → area → open problem,
each open problem tied to the sentence in the paper where it was posed.
Ledger verdicts attach to tree nodes through their `addresses` field.

  python tools/import_tree.py research_tree.json --out tree.json            # public-safe
  python tools/import_tree.py research_tree.json --out tree.json --private  # keeps local paths

Without --private, local file paths and hashes of private project files are
dropped; project names, verdicts and scopes are kept only if --keep-attempts.
The importer never invents a status: it copies the source status and adds
audit hints that point at places where a human should look twice.
"""
import argparse
import json
import re
from pathlib import Path

EXPLICIT = re.compile(r'open (question|problem)|remains? (to be understood|unclear|unknown|open|unresolved)|'
                      r'still need to be explored|not (yet )?(well )?understood|unresolved|are not classified', re.I)
LEVELS = ['domain', 'field', 'subfield', 'topic', 'area', 'problem']


def short_papers(papers, n=3):
    return [{k: p.get(k) for k in ('id', 'title', 'year', 'url', 'citation_count')} for p in (papers or [])[:n]]


def concerns(node, n=3):
    out = []
    for c in (node.get('reviewer_concerns') or [])[:n]:
        ex = (c.get('examples') or [{}])[0]
        out.append({'name': c.get('name'), 'reviews': c.get('reviews'), 'denominator': c.get('denominator'),
                    'papers': c.get('papers'), 'example': (ex.get('excerpt') or '')[:300], 'url': ex.get('url')})
    return out


def attempts(node, private, keep):
    if not (private or keep):
        return []
    out = []
    for a in (node.get('our_attempts') or []) + (node.get('project_refs') or []):
        item = {k: a.get(k) for k in ('project', 'item_id', 'verdict', 'date', 'scope', 'note', 'public_paper', 'url', 'relationship') if a.get(k)}
        if private:
            item.update({k: a.get(k) for k in ('path', 'locator', 'sha256') if a.get(k)})
        item['kind'] = 'verdict' if a.get('verdict') else 'project-link'
        out.append(item)
    return out


def venue_flags(node):
    for venue, years in (node.get('venue_stats') or {}).items():
        for year, s in years.items():
            sub, acc = s.get('observed_submissions'), s.get('observed_acceptances')
            if sub is not None and acc is not None and acc > sub:
                return [{'code': 'mixed_denominator',
                         'text_en': f'{venue} {year}: {acc} accepted papers seen but only {sub} submissions in the cached sample; counts come from different sources and are not a rate.',
                         'text_zh': f'{venue} {year}：可见录用 {acc} 篇，但缓存样本只有 {sub} 篇投稿；两者来源不同，不能当作录用率。'}]
    return []


def problem(node):
    op = (node.get('open_problems') or [{}])[0]
    fu = op.get('follow_up') or {}
    shortlist = fu.get('shortlist') or []
    best = max((s.get('similarity') or 0 for s in shortlist), default=None)
    flags = []
    if shortlist and best is not None and best < 0.05 and '相近' in str(fu.get('screen_outcome', '')):
        flags.append({'code': 'weak_followup_match',
                      'text_en': 'Labelled as having related follow-up work, but the best candidate has similarity ≈ 0. Treat as "no related follow-up found".',
                      'text_zh': '标为"有相近后续文献"，但最相近候选的相似度约为 0。应视为"未发现相关后续"。'})
    explicit = bool(EXPLICIT.search(op.get('quote', '')))
    return {
        'statement': op.get('statement') or node.get('name'),
        'quote': op.get('quote'), 'source_paper': op.get('source_paper'), 'source_title': op.get('source_title'),
        'source_url': op.get('source_url'), 'locator': op.get('locator'), 'date': op.get('date'),
        'status': op.get('status', 'open'), 'status_basis': op.get('status_basis'),
        'strength': 'explicit_open_problem' if explicit else 'author_future_work',
        'follow_up': {'outcome': fu.get('screen_outcome'), 'resolution': fu.get('current_resolution'),
                      'candidates': [{'title': s.get('title'), 'url': s.get('url'), 'year': s.get('year'),
                                      'similarity': s.get('similarity')} for s in shortlist[:3]]},
        'text_sha256': op.get('text_sha256'), 'pdf_sha256': op.get('pdf_sha256'),
    }, flags


def convert(tree, private=False, keep_attempts=False):
    nodes = []
    for n in tree['nodes']:
        item = {'id': n['id'], 'parent': n.get('parent'), 'level': n['level'], 'branch': n.get('branch'),
                'name': n['name'], 'definition': n.get('definition', ''),
                'papers': short_papers(n.get('canonical_papers')), 'paper_count': len(n.get('member_ids') or []),
                'keywords': (n.get('hot_keywords') or [])[:6], 'yearly_counts': n.get('yearly_counts') or {},
                'concerns': concerns(n), 'review_coverage': n.get('review_coverage'),
                'cross_links': [{'id': c['id'], 'type': c.get('type')} for c in n.get('cross_links') or []],
                'attempts': attempts(n, private, keep_attempts), 'last_updated': n.get('last_updated'),
                'evidence_quality': n.get('evidence_quality'), 'flags': venue_flags(n)}
        if n['level'] == 'problem':
            item['problem'], extra = problem(n)
            item['flags'] += extra
        nodes.append(item)
    ids = {x['id'] for x in nodes}
    for x in nodes:
        if x['parent'] and x['parent'] not in ids:
            raise SystemExit(f"node {x['id']} has unknown parent {x['parent']}")
    return {'schema': 'scimap-tree-v1', 'source_version': tree.get('version'), 'as_of': tree.get('as_of'),
            'scope': tree.get('scope'), 'notes': [tree.get('year_note'), tree.get('venue_note')],
            'visibility': 'private' if private else 'public', 'nodes': nodes}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('tree')
    p.add_argument('--out', required=True)
    p.add_argument('--private', action='store_true', help='Keep local paths and hashes (never publish)')
    p.add_argument('--keep-attempts', action='store_true', help='Keep project names/verdicts without paths')
    a = p.parse_args(argv)
    out = convert(json.loads(Path(a.tree).read_text(encoding='utf-8-sig')), a.private, a.keep_attempts)
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    probs = [x for x in out['nodes'] if x['level'] == 'problem']
    print(f"wrote {a.out}: {len(out['nodes'])} nodes, {len(probs)} problems, "
          f"{sum(bool(x['flags']) for x in out['nodes'])} nodes with audit hints ({out['visibility']})")


if __name__ == '__main__':
    main()

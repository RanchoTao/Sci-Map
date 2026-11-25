import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
sys.path.insert(0, str(ROOT))
import import_runs  # noqa: E402
import ledger  # noqa: E402


class ImportRuns(unittest.TestCase):
    def run_adapter(self, adapter, src, *extra):
        out = Path(tempfile.mkdtemp())
        import_runs.main([adapter, str(src), '--source-repo', 'someone/campaign', '--domain', 'demo',
                          '--out', str(out), *extra])
        return [json.loads(p.read_text(encoding='utf-8')) for p in sorted((out / 'demo').glob('*.json'))]

    def test_round_report_draft_has_provenance_and_no_local_paths(self):
        tmp = Path(tempfile.mkdtemp())
        rep = tmp / 'rounds' / 'R001_DEMO_20261013' / 'REPORT.md'
        rep.parent.mkdir(parents=True)
        rep.write_text('# R001: generic composition is classical\n\nDecision: **PARK generic composition**. '
                       'See https://arxiv.org/abs/0000.00000 and /home/alice/notes.\n', encoding='utf-8')
        [d] = self.run_adapter('round-report', tmp)
        self.assertEqual(d['date'], '2026-10-13')
        self.assertEqual(d['verdict'], 'KILLED_IN_SCOPE')
        self.assertTrue(d['evidence'][0]['label'].startswith('Round report: someone/campaign:rounds/'))
        self.assertEqual(len(d['evidence'][0]['sha256']), 64)
        self.assertIn('https://arxiv.org/abs/0000.00000', [e.get('url') for e in d['evidence']])
        self.assertTrue(d['hypothesis'].startswith('TODO'))   # a human must write the claim
        self.assertNotIn(str(tmp), json.dumps(d))

    def test_overrides_make_a_valid_record(self):
        tmp = Path(tempfile.mkdtemp())
        line = {'id': 'X1', 'utc': '2026-10-13T00:00:00+00:00', 'decision': 'KILL_EXACT_SOURCE_COLLISION',
                'source': 'https://example.org/paper.pdf', 'scope': 'Only the bounded case studied here.'}
        (tmp / 'nk.jsonl').write_text(json.dumps(line) + '\n', encoding='utf-8')
        ov = tmp / 'ov.json'
        ov.write_text(json.dumps({'x1': {'hypothesis': 'The bounded route is a new contribution.',
                                         'cause': 'Prior work covers it.'}}), encoding='utf-8')
        [d] = self.run_adapter('nk-jsonl', tmp / 'nk.jsonl', '--overrides', str(ov))
        self.assertEqual(d['verdict'], 'LITERATURE_COLLISION')
        self.assertEqual(ledger.check_record(d), [])

    def test_research_state_export_is_review_ready(self):
        [d] = self.run_adapter('research-state', ROOT / 'examples' / 'import' / 'research_state_minimal.json')
        self.assertEqual(ledger.check_record(d), [])
        self.assertEqual(d['verdict'], 'KILLED_IN_SCOPE')          # REFUTED + KILL decision
        self.assertEqual(d['scope'], 'Only f(x)=x^2, plain GD, lr 2.5, x0=1, 50 steps')
        self.assertEqual(d['contributor']['kind'], 'agent')
        self.assertEqual(d['contributor']['operator'], 'example-operator')
        self.assertTrue(d['follow_up'].startswith('Test lr <= 1'))  # task id resolved to its title
        self.assertEqual(d['evidence_level'], 'SOURCE_DOCUMENTED')

    def test_mathforge_export(self):
        ws = Path(tempfile.mkdtemp())
        (ws / 'atlas').mkdir(); (ws / 'knowledge' / 'sources').mkdir(parents=True)
        (ws / 'negative_knowledge' / 'false').mkdir(parents=True)
        (ws / 'atlas' / 'atlas.jsonl').write_text(json.dumps({'problem_id': 'MF-0001', 'name': 'Toy sums'}) + '\n')
        (ws / 'knowledge' / 'sources' / 'catalog.json').write_text(json.dumps(
            [{'source_id': 'SRC-1', 'title': 'A paper', 'url': 'https://example.org/p.pdf'}]))
        prov = {'actor': 'agent', 'recorded_at': '2026-11-01T00:00:00+00:00', 'method': 'm', 'limitations': 'l'}
        (ws / 'negative_knowledge' / 'false' / 'NEG-1.json').write_text(json.dumps({
            'negative_id': 'NEG-1', 'kind': 'false_conjecture', 'problem_ids': ['MF-0001'], 'scope': 'n <= 10^6 only',
            'reason': 'counterexample found', 'evidence': [], 'provenance': prov, 'supersedes': None,
            'details': {'conjecture': 'Every n has property P', 'smallest_known_counterexample': 'n = 1729',
                        'minimality_status': 'verified_in_scope', 'verification_procedure': 'exhaustive search',
                        'exact_code_path': 'scripts/check.py', 'code_sha256': 'a' * 64, 'failure_reason': 'P fails at 1729',
                        'source_agent': 'x', 'timestamp': '2026-11-01T00:00:00+00:00', 'dependencies': []}}))
        (ws / 'negative_knowledge' / 'false' / 'NEG-2.json').write_text(json.dumps({
            'negative_id': 'NEG-2', 'kind': 'replay_prohibition', 'problem_ids': [], 'scope': 's', 'reason': 'r',
            'evidence': [], 'provenance': prov, 'supersedes': None, 'details': {}}))
        drafts = self.run_adapter('mathforge', ws)
        self.assertEqual(len(drafts), 1)                     # operational replay prohibitions are skipped
        d = drafts[0]
        self.assertEqual(ledger.check_record(d), [])
        self.assertEqual(d['hypothesis'], 'Every n has property P')
        self.assertIn('1729', d['outcome'])
        self.assertIn('a' * 64, [e.get('sha256') for e in d['evidence']])

    def test_classify_is_conservative(self):
        self.assertEqual(import_runs.classify('something new happened'), 'INCONCLUSIVE')
        self.assertEqual(import_runs.classify('build attempt failed'), 'IMPLEMENTATION_FAILED')
        self.assertEqual(import_runs.classify('PASS_FINITE_EXACT_IMPLEMENTATION; value HOLD'), 'INCONCLUSIVE')


if __name__ == '__main__':
    unittest.main()

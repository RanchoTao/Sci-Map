import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
sys.path.insert(0, str(ROOT))
import ledger  # noqa: E402

EXAMPLE = ROOT / 'examples' / 'ledger'
BASE = json.loads((EXAMPLE / 'toy-optimization' / 'gd-quadratic-large-lr-diverges.json').read_text(encoding='utf-8'))


def write(tmp, rec):
    path = Path(tmp) / rec['domain'] / f"{rec['id']}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rec), encoding='utf-8')
    return path


def variant(**changes):
    rec = copy.deepcopy(BASE)
    for k, v in changes.items():
        if v is None:
            rec.pop(k, None)
        else:
            rec[k] = v
    return rec


class LedgerValidation(unittest.TestCase):
    def test_publication_gate_blocks_private_material(self):
        bad = {
            'outcome': 'see D:\\Work\\03-research\\run.log',
            'setup': 'ran from /home/alice/runs',
            'cause': 'key sk-abcdefghijklmnop1234 leaked',
            'follow_up': 'ask me at someone@example.com',
            'question': 'call 13812345678',
        }
        for field, text in bad.items():
            errs = ledger.check_record(variant(**{field: text}))
            self.assertTrue(any(x.startswith('privacy:') and field in x for x in errs), (field, errs))
        ok = ledger.check_record(variant(outcome='see https://github.com/RanchoTao/Sci-Map and repro/x.py; ratio 3:2'))
        self.assertEqual(ok, [])

    def test_example_is_valid(self):
        errors, warnings, records = ledger.validate([EXAMPLE])
        self.assertEqual(errors, [])
        self.assertEqual(len(records), 1)

    def test_shipped_public_ledger_is_valid(self):
        errors, _, _ = ledger.validate([ROOT / 'ledger'])
        self.assertEqual(errors, [])

    def test_failure_without_cause_rejected(self):
        self.assertTrue(any('needs a cause' in e for e in ledger.check_record(variant(cause=None))))

    def test_scope_is_mandatory(self):
        self.assertTrue(any('scope' in e for e in ledger.check_record(variant(scope=None))))

    def test_agent_needs_responsible_operator(self):
        rec = variant(contributor={'name': 'bot', 'kind': 'agent', 'model': 'x'})
        self.assertTrue(any('operator' in e for e in ledger.check_record(rec)))
        rec['contributor']['operator'] = 'Rancho'
        self.assertFalse(any('operator' in e for e in ledger.check_record(rec)))

    def test_ci_level_requires_repro(self):
        self.assertTrue(any('repro block' in e for e in ledger.check_record(variant(repro=None))))

    def test_independent_level_requires_someone_else(self):
        rec = variant(evidence_level='INDEPENDENTLY_REPRODUCED',
                      reproductions=[{'by': BASE['contributor']['name'], 'date': '2026-11-23', 'result': 'CONFIRMED'}])
        self.assertTrue(any('someone other' in e for e in ledger.check_record(rec)))
        rec['reproductions'].append({'by': 'another lab', 'date': '2026-11-24', 'result': 'CONFIRMED'})
        self.assertEqual(ledger.check_record(rec), [])

    def test_literature_collision_needs_prior_work_url(self):
        rec = variant(verdict='LITERATURE_COLLISION', evidence_level='CLAIMED', repro=None)
        self.assertTrue(any('prior work' in e for e in ledger.check_record(rec)))
        rec['evidence'].append({'label': 'Prior paper', 'url': 'https://arxiv.org/abs/0000.00000'})
        self.assertEqual(ledger.check_record(rec), [])

    def test_unknown_fields_and_bad_verdict_rejected(self):
        errs = ledger.check_record(variant(verdict='KILL', extra=1))
        self.assertTrue(any('verdict must be' in e for e in errs))
        self.assertTrue(any('unknown field' in e for e in errs))

    def test_path_must_match_id_and_domain(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'other-domain' / 'wrong-name.json'
            path.parent.mkdir()
            path.write_text(json.dumps(BASE), encoding='utf-8')
            errors, _, _ = ledger.validate([tmp])
            self.assertTrue(any('must equal id' in e for e in errors))
            self.assertTrue(any('must equal domain' in e for e in errors))

    def test_dangling_relation_and_duplicates(self):
        with tempfile.TemporaryDirectory() as tmp:
            write(tmp, variant(related=[{'type': 'refines', 'target': 'missing-record'}]))
            twin = variant(id='gd-quadratic-large-lr-diverges-copy')
            write(tmp, twin)
            errors, warnings, _ = ledger.validate([tmp])
            self.assertTrue(any('does not exist' in e for e in errors))
            self.assertTrue(any('possible duplicate' in w for w in warnings))


class DuplicateDetection(unittest.TestCase):
    def test_formal_statements_differing_by_a_symbol_are_not_duplicates(self):
        with tempfile.TemporaryDirectory() as tmp:
            for rid, stmt in [('p-eq-np', 'P = NP under the frozen encoding'), ('p-ne-np', 'P ≠ NP under the frozen encoding')]:
                write(tmp, variant(id=rid, title='Frozen open statement ' + rid, hypothesis='Lean proves the frozen statement: ' + stmt,
                                   verdict='OPEN', evidence_level='CLAIMED', repro=None, cause=None))
            _, warnings, _ = ledger.validate([tmp])
            self.assertEqual(warnings, [])


class LedgerBuildAndRepro(unittest.TestCase):
    def test_build_is_ui_compatible_catalog(self):
        cat = ledger.build([EXAMPLE])
        self.assertEqual(cat['schema_version'], 'atlas-catalog-v0.2')
        r = cat['records'][0]
        for k in ('id', 'title', 'status', 'scope', 'verification', 'evidence'):
            self.assertIn(k, r)
        self.assertEqual(r['status'], 'KILLED_IN_SCOPE')
        self.assertTrue(r['result_verified'])
        self.assertEqual(cat['statistics']['failure_records'], 1)
        self.assertIn('Verdict', {n['type'] for n in cat['nodes']})

    def test_claimed_records_do_not_become_verdict_nodes(self):
        with tempfile.TemporaryDirectory() as tmp:
            write(tmp, variant(evidence_level='CLAIMED', repro=None))
            cat = ledger.build([tmp])
            self.assertNotIn('Verdict', {n['type'] for n in cat['nodes']})
            self.assertFalse(cat['records'][0]['result_verified'])

    def test_build_refuses_invalid_ledger(self):
        with tempfile.TemporaryDirectory() as tmp:
            write(tmp, variant(cause=None))
            with self.assertRaises(SystemExit):
                ledger.build([tmp])

    def test_repro_matches_and_detects_mismatch(self):
        ok, rep = ledger.reproduce(BASE)
        self.assertTrue(ok, rep)
        wrong = variant(repro={**BASE['repro'], 'command': 'python examples/repro/gd_quadratic.py 0.25'})
        ok, rep = ledger.reproduce(wrong)
        self.assertFalse(ok)
        self.assertEqual(rep['status'], 'MISMATCH')

    def test_repro_workdir_cannot_escape_repository(self):
        bad = variant(repro={**BASE['repro'], 'workdir': '../..'})
        ok, rep = ledger.reproduce(bad)
        self.assertFalse(ok)
        self.assertEqual(rep['status'], 'BAD_WORKDIR')

    def test_search_finds_dead_ends(self):
        _, _, records = ledger.validate([EXAMPLE])
        self.assertEqual(len(ledger.search_records(records, 'quadratic', failures_only=True)), 1)
        self.assertEqual(ledger.search_records(records, 'transformer'), [])


class NegativeKnowledgeImport(unittest.TestCase):
    def test_import_produces_valid_claimed_draft(self):
        nk = {'task_id': 'burgers-1d', 'attempted_route': 'Fourier spectral solver without dealiasing',
              'observation': 'Energy blows up after shock formation', 'rationale': 'Aliasing of quadratic term',
              'recommended_alternative': 'Apply 2/3 rule',
              'failure': {'layer': 'method', 'scope': 'shock regime', 'degree': 'fatal',
                          'recommended_action': 'switch method', 'risk': 'high'}}
        rec = ledger.from_negative_knowledge(nk, 'pde', 'curator', 'agent', 'Rancho', 'model-x')
        self.assertEqual(rec['evidence_level'], 'CLAIMED')
        self.assertEqual(rec['verdict'], 'KILLED_IN_SCOPE')
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(ledger.check_record(rec, write(tmp, rec)), [])


if __name__ == '__main__':
    unittest.main()


class ProblemTreeImport(unittest.TestCase):
    TREE = {'version': '0.1', 'as_of': '2026-11-21', 'scope': 'test', 'nodes': [
        {'id': 'T', 'name': 'Topic', 'level': 'topic', 'parent': None, 'branch': 'A', 'member_ids': [1, 2],
         'venue_stats': {'ICLR': {'2025': {'observed_submissions': 1, 'observed_acceptances': 3}}}},
        {'id': 'A0', 'name': 'Area', 'level': 'area', 'parent': 'T', 'branch': 'A',
         'our_attempts': [{'project': 'P', 'verdict': 'KILL', 'scope': 'one round', 'path': 'D:\\\\secret\\\\x.md', 'sha256': 'a' * 64}]},
        {'id': 'q1', 'name': 'Q1', 'level': 'problem', 'parent': 'A0', 'branch': 'A', 'open_problems': [{
            'statement': 'Does X hold?', 'quote': 'Whether X holds remains an open question.', 'status': 'open',
            'follow_up': {'screen_outcome': '有相近后续文献', 'shortlist': [{'title': 'Unrelated', 'similarity': 0.0}]}}]},
    ]}

    def test_public_tree_drops_private_paths_and_attempts(self):
        import import_tree
        out = import_tree.convert(self.TREE)
        self.assertNotIn('secret', json.dumps(out))
        self.assertEqual(out['visibility'], 'public')
        area = next(n for n in out['nodes'] if n['id'] == 'A0')
        self.assertEqual(area['attempts'], [])

    def test_private_tree_keeps_attempts_and_flags(self):
        import import_tree
        out = import_tree.convert(self.TREE, private=True)
        area = next(n for n in out['nodes'] if n['id'] == 'A0')
        self.assertEqual(area['attempts'][0]['verdict'], 'KILL')
        q = next(n for n in out['nodes'] if n['id'] == 'q1')
        self.assertEqual(q['problem']['strength'], 'explicit_open_problem')
        self.assertEqual(q['flags'], [])  # lexical similarity alone is not a relevance signal
        topic = next(n for n in out['nodes'] if n['id'] == 'T')
        self.assertIn('mixed_denominator', [f['code'] for f in topic['flags']])

    def test_public_build_refuses_private_tree(self):
        import import_tree
        with self.assertRaises(SystemExit):
            ledger.build([EXAMPLE], private=False, tree=import_tree.convert(self.TREE, private=True))
        cat = ledger.build([EXAMPLE], private=True, tree=import_tree.convert(self.TREE, private=True))
        self.assertEqual(len(cat['tree']['nodes']), 3)

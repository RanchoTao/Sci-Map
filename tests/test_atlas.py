import hashlib
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import urlopen
from urllib.error import HTTPError
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_index import derive, migrate, enrich
from serve import make_handler
from privacy import redact

class AtlasTests(unittest.TestCase):
    def test_semantic_review_preserves_scoped_records(self):
        records=[{'id':i,'title':'Same question','domain':'test','verification':'SOURCE_DOCUMENTED','status':s,'kind':'problem','evidence':[{'label':i,'sha256':i}]} for i,s in [('old','INVALIDATED'),('corrected','GO')]]
        proposal={'type':'VERSION_CORRECTION','record_ids':['old','corrected'],'action':'RETAIN_SEPARATELY'}
        catalog=enrich({'records':records,'semantic_review':[proposal]})
        self.assertEqual([(r['id'],r['status']) for r in catalog['records']],[('old','INVALIDATED'),('corrected','GO')])
        self.assertIn(proposal,catalog['review_queue'])

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
    def tearDown(self):
        self.tmp.cleanup()
    def archive(self, name='one.zip', machine='RANCHO', text='# Test research\n## Hypothesis\nKILL is conditional, not a verdict.\n', corrupt=False):
        raw = text.encode()
        entry = {'root': 'project', 'path': 'VERDICT.md', 'status': 'ARCHIVED', 'sha256': '0'*64 if corrupt else hashlib.sha256(raw).hexdigest(), 'size': len(raw), 'modified_utc': '2026-01-02T12:00:00Z'}
        path = self.dir / name
        with zipfile.ZipFile(path, 'w') as z:
            z.writestr('manifest.json', json.dumps({'machine': machine, 'entries': [entry]}))
            z.writestr('files/project/VERDICT.md', raw)
        return path
    def test_idempotent_cross_machine_duplicate_provenance(self):
        a, b = self.archive(), self.archive('two.zip', 'TAO')
        initial = derive([a, b])
        seed = self.dir/'seed.json'
        seed.write_text(json.dumps(initial), encoding='utf-8')
        second = derive([a, b, a], seed)
        self.assertEqual(initial['records'], second['records'])
        self.assertEqual(len(second['records']), 1)
        self.assertEqual(second['records'][0]['origin_machines'], ['RANCHO','TAO'])
        self.assertEqual(len(second['records'][0]['evidence']), 2)
        self.assertEqual(len(second['source_archives']), 2)
    def test_hash_mismatch_cannot_enter_catalog(self):
        result = derive([self.archive(corrupt=True)])
        self.assertEqual(result['records'], [])
        self.assertEqual(result['index_errors'][0]['reason'], 'HASH_MISMATCH')
    def test_conditional_kill_never_becomes_verdict(self):
        record = derive([self.archive()])['records'][0]
        self.assertEqual(record['status'], 'NEEDS_REVIEW')
        self.assertEqual(record['reported_status_hints'], ['KILL'])
        self.assertIn('FILE_MTIME', record['date_provenance'])
    def test_different_conclusions_retained_and_flagged(self):
        result = derive([self.archive(), self.archive('two.zip', text='# Test research\nGO under altered conditions.\n')])
        self.assertEqual(len(result['records']), 2)
        self.assertEqual(len(result['review_queue']), 1)
        self.assertTrue(all(r['status'] == 'NEEDS_REVIEW' for r in result['records']))
    def test_graph_source_and_scoped_sections(self):
        result = derive([self.archive()])
        self.assertTrue({'Problem','Evidence','Research Area','Hypothesis'}.issubset({n['type'] for n in result['nodes']}))
        self.assertTrue(all(e['provenance'] for e in result['edges']))
        self.assertTrue(all(n['provenance'] for n in result['nodes']))
    def test_shared_area_unions_all_provenance(self):
        result=derive([self.archive(),self.archive('two.zip',text='# Other research\n## Hypothesis\nChanged condition.\n')])
        areas=[n for n in result['nodes'] if n['type']=='Research Area']
        self.assertEqual(len(areas),1)
        self.assertEqual(len(areas[0]['provenance']),2)
    def test_credentials_redacted_in_derived_content(self):
        token = 'sk-'+'a'*35
        record = derive([self.archive(text='# Research results\napi_key='+token+'\n')])['records'][0]
        self.assertNotIn(token, record['search_text'])
        self.assertIn('[REDACTED', record['search_text'])
    def test_duplicate_pointer_keeps_logical_path(self):
        a = self.archive()
        result = derive([a])
        entry = dict(result['records'][0]['evidence'][0], status='ARCHIVED_DUPLICATE_POINTER', path='other/VERDICT.md')
        inventory = self.dir/'manifest.jsonl'
        inventory.write_text(json.dumps(entry)+'\n', encoding='utf-8')
        result = derive([a], manifests=[inventory])
        self.assertEqual(len(result['records'][0]['evidence']), 2)
    def test_safe_server_real_requests_and_integrity(self):
        archive = self.archive()
        catalog = derive([archive])
        site = self.dir/'site'; (site/'data').mkdir(parents=True)
        (site/'index.html').write_text('atlas', encoding='utf-8')
        (site/'data'/'merged.json').write_text(json.dumps(catalog), encoding='utf-8')
        server = ThreadingHTTPServer(('127.0.0.1',0), make_handler(site,self.dir,enable_raw_preview=True))
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        base = f'http://127.0.0.1:{server.server_address[1]}'
        try:
            self.assertEqual(urlopen(base+'/').read(), b'atlas')
            for route in ['/one.zip','/../one.zip','/data/../one.zip','/api/evidence?record=missing','/%2e%2e/one.zip']:
                with self.assertRaises(HTTPError) as error:
                    urlopen(base+route)
                self.assertEqual(error.exception.code,404)
            reply=json.loads(urlopen(base+'/api/evidence?record='+catalog['records'][0]['id']).read())
            self.assertIn('KILL is conditional',reply['content'])
            ev=catalog['records'][0]['evidence'][0]; ev['sha256']='0'*64
            (site/'data'/'merged.json').write_text(json.dumps(catalog),encoding='utf-8')
            with self.assertRaises(HTTPError) as error:
                urlopen(base+'/api/evidence?record='+catalog['records'][0]['id'])
            self.assertEqual(error.exception.code,409)
        finally:
            server.shutdown(); server.server_close(); thread.join()
    def test_migration_preserves_old_verdict_scope(self):
        data=migrate({'schema_version':'atlas-catalog-v0.1','records':[{'id':'x','title':'Scoped failure','status':'KILL','scope':'only scenario A'}]})
        self.assertEqual(data['records'][0]['scope'],'only scenario A')
        self.assertEqual(data['records'][0]['verification'],'UNREVIEWED')
    def test_compact_topics_preserve_scope_and_exclude_full_source(self):
        seed = self.dir/'compact.json'
        seed.write_text(json.dumps({'records': [{'id':'project/H01','title':'A scoped topic','kind':'hypothesis','project':'project','status':'KILL','scope':'condition A only','verification':'SOURCE_DOCUMENTED','hypothesis':'A => B','search_text':'full procedure text','evidence':[{'label':'source.md','sha256':'a'*64,'excerpt':'Observed counterexample under condition A.'}]}]}),encoding='utf-8')
        result = derive([],seed,topic_only=True)
        self.assertNotIn('search_text', result['records'][0])
        self.assertEqual(result['records'][0]['scope'],'condition A only')
        self.assertEqual(result['statistics']['scoped_topic_records'],1)
        self.assertTrue({'Hypothesis','Verdict'}.issubset({n['type'] for n in result['nodes']}))
    def test_compact_server_raw_disabled_and_provenance_inventory(self):
        site = self.dir/'site'; (site/'data').mkdir(parents=True)
        (site/'data'/'merged.json').write_text(json.dumps({'records':[{'evidence':[{'label':'RANCHO/project/result.md','machine':'RANCHO','root':'project','path':'result.md','sha256':'a'*64,'excerpt':'Scoped result'}]}]}),encoding='utf-8')
        server=ThreadingHTTPServer(('127.0.0.1',0),make_handler(site,self.dir))
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base=f'http://127.0.0.1:{server.server_address[1]}'
        try:
            with self.assertRaises(HTTPError) as error:
                urlopen(base+'/api/evidence?record=anything')
            self.assertEqual(error.exception.code,403)
            inventory=json.loads(urlopen(base+'/api/inventory').read())
            self.assertEqual(inventory['total'],1)
            self.assertEqual(inventory['entries'][0]['status'],'SOURCE_PROVENANCE_METADATA_ONLY')
        finally:
            server.shutdown();server.server_close();thread.join()

if __name__ == '__main__':
    unittest.main()

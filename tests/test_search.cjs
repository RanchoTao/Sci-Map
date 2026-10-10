/* Exercise the actual shipped UI search function in a minimal DOM runtime. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fields = new Map();
function field(id) {
  if (!fields.has(id)) fields.set(id, {value:'',addEventListener(){},classList:{add(){}},textContent:''});
  return fields.get(id);
}
const context = vm.createContext({document:{getElementById:field,querySelectorAll:()=>[]}, console,
  fetch: async()=>({ok:false})});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8'),context);
vm.runInContext(`state.catalog={records:[
{id:'topostat-wu:H33',topic_id:'topostat-wu:H33',title:'Scoped topic',kind:'hypothesis',status:'KILL_TRIVIAL',domain:'Statistics',project:'topostat-wu',verification:'SOURCE_DOCUMENTED',origin_machines:['RANCHO'],date:'2026-09-28',historical_status:'KILL',evidence:[{source_path:'C:/research/decision.md',excerpt:'Jensen curvature counterexample'}]},
{id:'history-02',title:'Historical session',question:'Could nonlinear filters identify multiscale observations?',status:'NEEDS_REVIEW',domain:'UNCLASSIFIED',project:'history',origin_machines:['RANCHO'],tags:[]}
]}`,context);
function results(query) {
  field('query').value=query;
  return JSON.parse(vm.runInContext('JSON.stringify(filterRecords().map(r=>r.id))',context));
}
assert.deepEqual(results('H33'),['topostat-wu:H33']);
assert.deepEqual(results('topostat-wu:H33'),['topostat-wu:H33']);
assert.deepEqual(results('Jensen curvature'),['topostat-wu:H33']);
assert.deepEqual(results('decision.md'),['topostat-wu:H33']);
assert.deepEqual(results('2026-09-28'),['topostat-wu:H33']);
assert.deepEqual(results('nonlinear multiscale'),['history-02']);
field('status').value='NEEDS_REVIEW';
assert.deepEqual(results('H33'),[]);
field('status').value='';
assert.deepEqual(results('nonexistent'),[]);
console.log('PASS: actual UI search matches topic IDs, questions, excerpts, paths, dates and filters');

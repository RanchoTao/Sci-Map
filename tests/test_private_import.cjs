/* Validate that the public site can open a private catalog without storage or upload. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Node {
  constructor(tag='div') {
    this.tag = tag; this.value=''; this.textContent=''; this.disabled=false;
    this.dataset={}; this.children=[]; this.options=[];
    this.classList={add(){},remove(){},toggle(){}};
    this.listeners={}; this.open=false;
  }
  addEventListener(n,f){this.listeners[n]=f;}
  append(...nodes){this.children.push(...nodes); if(this.tag==='select')this.options.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes; if(this.tag==='select')this.options=nodes;}
  remove(i){this.options.splice(i,1);}
  setAttribute(k,v){this[k]=v;}
  close(){this.open=false;}
}
const ids=new Map();
const selectors=new Set(['domain','project','status','machine','tag','kind','verification']);
function field(id){if(!ids.has(id))ids.set(id,new Node(selectors.has(id)?'select':'div'));return ids.get(id);}
const calls=[];
const context=vm.createContext({
  document:{getElementById:field,querySelectorAll:()=>[],createElement:(tag)=>new Node(tag)},
  window:{location:{protocol:'https:',hostname:'ranchotao.com'}},
  console, Blob, URL, fetch: async(...args)=>{calls.push(args);return {ok:false};}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8'),context);
const empty={schema_version:'atlas-catalog-v0.2',records:[],nodes:[],edges:[],review_queue:[],source_archives:{},statistics:{}};
const privateCatalog={...empty,records:[{
  id:'TAO-001',title:'Negative result',status:'NEEDS_REVIEW',
  project:'TAO',domain:'Math',verification:'UNREVIEWED',
  origin_machines:['TAO'],summary:'Cannot infer impossibility',tags:[],evidence:[]
}]};
const run=expr=>vm.runInContext(expr,context);
(async()=>{
  await new Promise(resolve=>setImmediate(resolve)); // Allow initial empty-site fetch to reject.
  assert.equal(run('secureOrigin()'),true);
  assert.equal(run('validateCatalog({schema_version:"atlas-catalog-v0.2",records:[],nodes:[],edges:[]}).records.length'),0);
  assert.throws(()=>run('validateCatalog({schema_version:"wrong",records:[],nodes:[],edges:[]})'),/版本不兼容/);
  assert.throws(()=>run('validateCatalog({schema_version:"atlas-catalog-v0.2",records:"bad",nodes:[],edges:[]})'),/数组字段/);
  context.testFile={name:'merged.json',size:100,text:async()=>JSON.stringify(privateCatalog)};
  assert.equal(await run('importPrivateFile(testFile)'),true);
  assert.equal(run('state.catalog.records.length'),1);
  assert.equal(run('state.privateLoaded'),true);
  assert.equal(field('private-status').dataset.mode,'private');
  assert.equal(field('clear-private').disabled,false);
  assert.deepEqual(JSON.parse(run('JSON.stringify(filterRecords().map(r=>r.id))')),['TAO-001']);
  context.publicEmpty=empty;
  run('state.publicCatalog=publicEmpty; clearPrivateCatalog()');
  assert.equal(run('state.catalog.records.length'),0);
  assert.equal(run('state.privateLoaded'),false);
  context.window.location.protocol='http:';
  await assert.rejects(async()=>run('importPrivateFile(testFile)'),/不是 HTTPS/);
  context.window.location.hostname='localhost';
  assert.equal(run('secureOrigin()'),true);
  context.window.location.hostname='ranchotao.com';
  context.window.location.protocol='https:';
  context.testFile={name:'bad.zip',size:100,text:async()=>{throw Error('unread')}};
  await assert.rejects(async()=>run('importPrivateFile(testFile)'),/不支持 ZIP/);
  context.testFile={name:'merged.json',size:70*1024*1024,text:async()=>{throw Error('unread')}};
  await assert.rejects(async()=>run('importPrivateFile(testFile)'),/64 MiB/);
  assert.equal(calls.length,1); // Only the initial same-origin public catalog fetch.
  console.log('PASS: local-only private import, reset, schema validation and HTTPS-only gate');
})().catch(e=>{console.error(e);process.exitCode=1;});

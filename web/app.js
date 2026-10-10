/* No telemetry, network dependencies, auto-upload, or verdict inference. */
'use strict';
const $ = (id) => document.getElementById(id);
const titles = {list:'研究记录',timeline:'来源时间线',graph:'关系图',review:'重复与冲突待审',inventory:'来源清单'};
const state = {catalog:null,publicCatalog:null,privateLoaded:false,view:'list',page:1,pageSize:30,filtered:[],inventory:null};
const element = (tag, text, cls) => {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
function textOf(r){return [r.id,r.topic_id,JSON.stringify(r.source_ids||[]),r.title,r.question,r.summary,r.search_text,r.scope,r.cause,r.hypothesis,r.result_summary,JSON.stringify(r.metrics||{}),JSON.stringify(r.source_status_history||[]),r.verification_basis,r.validation_boundary,r.historical_status,JSON.stringify(r.historical_verdict||''),r.historical_status_group,r.status,r.verification,r.project,r.domain,r.date,r.date_provenance,...(r.tags||[]),...(r.source_paths||[]),...(r.evidence||[]).flatMap(e=>[e.label,e.path,e.source_path,e.excerpt,e.date])].filter(Boolean).join('\n').toLowerCase();}
function filterRecords(){const q=$('query').value.toLowerCase().trim().split(/\s+/).filter(Boolean);return state.catalog.records.filter(r=>q.every(t=>textOf(r).includes(t))&&(!$('status').value||r.status===$('status').value)&&(!$('domain').value||r.domain===$('domain').value)&&(!$('project').value||r.project===$('project').value)&&(!$('machine').value||(r.origin_machines||[r.machine]).includes($('machine').value))&&(!$('tag').value||(r.tags||[]).includes($('tag').value))&&(!$('kind').value||r.kind===$('kind').value)&&(!$('verification').value||r.verification===$('verification').value)&&(!$('result_verified').value||(r.result_verified===true)===($('result_verified').value==='true')));}
function card(r){const node=element('article',undefined,'record');node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label','查看 '+r.title);node.append(element('h3',r.title));const meta=element('div',undefined,'meta');meta.append(element('span',r.status,'badge '+r.status),element('span',r.project||'UNCLASSIFIED'),element('span',(r.origin_machines||[r.machine]).join(' · ')),element('span',r.date||'日期未知'));node.append(meta,element('p',r.summary||'暂无摘要'),element('div',(r.tags||[]).join(' · '),'meta'));node.addEventListener('click',()=>details(r));node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();details(r);}});return node;}
function metrics(){const rs=state.catalog.records;const vals=[['课题 / 结果 / 待核对线索记录',rs.length],['来源已核对记录',state.catalog.statistics?.source_documented_records||0],['历史结果凭据已核对',rs.filter(r=>r.result_verified===true).length],['独立复现结果',state.catalog.statistics?.independently_reproduced_results||0],['来源机器',new Set(rs.flatMap(r=>r.origin_machines||[r.machine])).size],['重复 / 版本待审',state.catalog.review_queue?.length||0]];$('metrics').replaceChildren(...vals.map(([k,v])=>{let n=element('div',undefined,'metric');n.append(element('strong',String(v)),element('span',k));return n;}));}
function render(){if(!state.catalog)return;state.filtered=filterRecords();$('view-title').textContent=titles[state.view];$('results').className=state.view==='timeline'?'timeline':state.view==='inventory'?'inventory':'records';const max=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));if(state.view!=='inventory')state.page=Math.min(state.page,max);$('result-count').textContent=state.filtered.length+' 条匹配记录';$('page').textContent=`${state.page} / ${max}`;$('prev').disabled=state.page<=1;$('next').disabled=state.page>=max;const batch=state.filtered.slice((state.page-1)*state.pageSize,state.page*state.pageSize);$('results').replaceChildren();if(state.view==='graph'){renderGraph(batch);return;}if(state.view==='review'){renderReview();return;}if(state.view==='inventory'){renderInventory();return;}if(!batch.length){$('results').append(element('div','没有匹配记录。未采集或未审阅不表示该方向从未研究。','empty'));return;}if(state.view==='timeline'){const sorted=[...state.filtered].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')).slice((state.page-1)*state.pageSize,state.page*state.pageSize);let date;for(const r of sorted){if(date!==r.date){date=r.date;$('results').append(element('div',date||'日期未知','timeline-date'));}$('results').append(card(r));}}else $('results').append(...batch.map(card));}
function renderReview(){const ids=new Set(state.filtered.map(r=>r.id));const queue=(state.catalog.review_queue||[]).filter(x=>x.record_ids.some(id=>ids.has(id)));if(!queue.length){$('results').append(element('div','当前筛选下没有重复候选。标题相似检索不是科学上的语义去重证明。','empty'));return;}for(const item of queue.slice((state.page-1)*30,state.page*30)){const node=element('article',undefined,'record review-card');node.append(element('h3',item.title_key),element('p',item.action));for(const id of item.record_ids){const r=state.catalog.records.find(r=>r.id===id);if(r){const b=element('button',r.title+' · '+r.status);b.onclick=()=>details(r);node.append(b);}}$('results').append(node);}}
function renderGraph(batch){const c=state.catalog;const ids=new Set(batch.map(r=>r.id));const problemIds=new Set((c.nodes||[]).filter(n=>ids.has(n.record_id)).map(n=>n.id));let edges=(c.edges||[]).filter(e=>problemIds.has(e.source)||problemIds.has(e.target));let nodeIds=new Set(edges.flatMap(e=>[e.source,e.target]));let nodes=(c.nodes||[]).filter(n=>nodeIds.has(n.id)).slice(0,100);nodeIds=new Set(nodes.map(n=>n.id));edges=edges.filter(e=>nodeIds.has(e.source)&&nodeIds.has(e.target));$('results').append(element('p',`本页 ${nodes.length} 个来源节点 · ${edges.length} 条引用关系。连线是来源与章节关联，不表示因果关系。最多显示 100 个节点；使用筛选缩小范围。`,'graph-note'));const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1100 620');svg.setAttribute('class','graph-svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','有来源的研究关系图');const kinds=['Research Area','Problem','Hypothesis','Experiment','Evidence','Verdict','Follow-up'];const positions=new Map();for(const kind of kinds){const group=nodes.filter(n=>n.type===kind);group.forEach((n,i)=>positions.set(n.id,{x:70+kinds.indexOf(kind)*155,y:50+(i+.5)*520/Math.max(1,group.length)}));}for(const edge of edges){const a=positions.get(edge.source),b=positions.get(edge.target);if(!a||!b)continue;const line=document.createElementNS(ns,'line');for(const [key,val] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,val);const title=document.createElementNS(ns,'title');title.textContent=edge.type+' · '+(edge.provenance||[]).map(p=>p.label).join('; ');line.append(title);svg.append(line);}for(const n of nodes){const p=positions.get(n.id);const g=document.createElementNS(ns,'g');g.classList.add('graph-node');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',n.type+': '+n.label);const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);circle.setAttribute('r',n.type==='Problem'?7:4);const text=document.createElementNS(ns,'text');text.setAttribute('x',p.x+10);text.setAttribute('y',p.y+4);text.textContent=n.label.slice(0,17);const title=document.createElementNS(ns,'title');title.textContent=n.type+': '+n.label;g.append(circle,text,title);const open=()=>{const r=state.catalog.records.find(r=>r.id===n.record_id)||state.catalog.records.find(r=>r.evidence?.some(e=>n.provenance?.some(p=>p.sha256===e.sha256)));if(r)details(r);};g.onclick=open;g.onkeydown=e=>{if(e.key==='Enter')open();};svg.append(g);}kinds.forEach((kind,i)=>{const label=document.createElementNS(ns,'text');label.setAttribute('x',25+i*155);label.setAttribute('y',20);label.textContent=kind;svg.append(label);});$('results').append(svg);}
async function renderInventory(){const q=new URLSearchParams({q:$('query').value,root:$('project').value,page:String(state.page),limit:'30'});try{const response=await fetch('/api/inventory?'+q);if(!response.ok)throw new Error('原始全量清单服务尚未配置');const data=await response.json();$('result-count').textContent=data.total+' 个清单文件';const max=Math.max(1,Math.ceil(data.total/30));$('page').textContent=`${state.page} / ${max}`;$('next').disabled=state.page>=max;const table=element('table');const tr=element('tr');for(const title of ['源文件','状态','字节','SHA-256 / 归档位置'])tr.append(element('th',title));table.append(tr);for(const row of data.entries){const r=element('tr');r.append(element('td',(row.root||'')+'/'+row.path),element('td',row.status),element('td',String(row.size||0)),element('td',[row.sha256,row.archive,row.member].filter(Boolean).join(' · ')));table.append(r);}$('results').replaceChildren(table);}catch(error){$('results').replaceChildren(element('div',error.message,'empty'));}}
function details(r){const body=$('details-body');body.replaceChildren(element('h2',r.title),element('p',`${r.status} · ${r.verification} · ${r.project} · ${(r.origin_machines||[r.machine]).join(', ')}`,'detail-meta'),element('p',`${r.date||'日期未知'} — ${r.date_provenance||'UNSPECIFIED'}`,'detail-meta'),element('p',r.scope||'适用范围未审阅','scope'),element('h3','来源内容摘要'),element('pre',r.summary||'暂无摘要'),element('h3','验证依据与来源定位'));for(const [i,ev] of (r.evidence||[]).entries()){const box=element('div',undefined,'evidence-row');box.append(element('div',ev.label),element('code','SHA-256 '+(ev.sha256||'未提供')),element('div',[ev.archive,ev.member].filter(Boolean).join(' :: ')));box.append(element('div',[ev.path||ev.label,ev.line_start?'行 '+ev.line_start+(ev.line_end?'–'+ev.line_end:''):''].filter(Boolean).join(' · ')));if(ev.excerpt)box.append(element('pre',ev.excerpt));if(ev.archive&&ev.member&&!String(state.catalog.archive_scope||'').startsWith('COMPACT_KNOWLEDGE_ONLY')){const btn=element('button','校验并预览原始文本');btn.onclick=async()=>{btn.disabled=true;try{const response=await fetch('/api/evidence?'+new URLSearchParams({record:r.id,index:String(i)}));const data=await response.json();if(!response.ok)throw new Error(data.error);box.append(element('pre',data.content+(data.truncated?'\n[预览截断；请从私有归档恢复完整原件]':'')));btn.textContent='SHA-256 已验证';}catch(e){box.append(element('div',e.message,'error'));btn.disabled=false;}};box.append(btn);}else if(ev.url&&/^https:\/\//.test(ev.url)){const a=element('a','公开来源');a.href=ev.url;a.rel='noopener noreferrer';a.target='_blank';box.append(a);}body.append(box);}if(r.source_ids?.length)body.append(element('p','源机器记录 ID：'+r.source_ids.join(' · '),'detail-meta'));if(r.historical_verdict||r.historical_status_group)body.append(element('h3','对端历史判断（原文待核对，不自动提升当前状态）'),element('pre',JSON.stringify({historical_verdict:r.historical_verdict,historical_status_group:r.historical_status_group},null,2)));if(r.source_status_history?.length)body.append(element('h3','历史状态（来源记载，不自动判定冲突）'),element('pre',JSON.stringify(r.source_status_history,null,2)));body.append(element('p',r.result_verified===true?'历史结果凭据已核对；以声明的校验范围为准，不代表独立科学复现':'历史结果凭据尚未核对或未提供','detail-meta'));if(r.hypothesis)body.append(element('h3','研究假设'),element('p',typeof r.hypothesis==='string'?r.hypothesis:JSON.stringify(r.hypothesis)));if(r.result_summary||r.metrics)body.append(element('h3','已记载结果 / 指标'),element('pre',[r.result_summary,JSON.stringify(r.metrics||{},null,2)].filter(Boolean).join('\n')));if(r.validation_boundary)body.append(element('h3','证据有效性边界'),element('p',r.validation_boundary));if(r.experiment_status)body.append(element('p','实验状态：'+r.experiment_status,'detail-meta'));if(r.result_kind)body.append(element('p','结果类型：'+r.result_kind,'detail-meta'));if(r.verification_basis)body.append(element('h3','验证边界 / 对端校验记载'),element(typeof r.verification_basis==='string'?'p':'pre',typeof r.verification_basis==='string'?r.verification_basis:JSON.stringify(r.verification_basis,null,2)));if(r.verified_result_scope)body.append(element('h3','已核对结果的限定范围'),element(typeof r.verified_result_scope==='string'?'p':'pre',typeof r.verified_result_scope==='string'?r.verified_result_scope:JSON.stringify(r.verified_result_scope,null,2)));const nodes=(state.catalog.nodes||[]).filter(n=>n.record_id===r.id);body.append(element('h3','问题 → 假设 → 实验 → 证据 → 判断 → 后续'));for(const node of nodes)body.append(element('p',`${node.type} · ${node.label} · ${node.verification||'SOURCE_POINTER'}`,'detail-meta'));body.append(element('h3','已发现的状态词（待审阅）'),element('p',(r.reported_status_hints||[]).join(', ')||'未提取状态词','detail-meta'));$('details').showModal();}

/* Private catalogs are parsed from a user-selected file only. Nothing is sent to the server,
   placed in URL parameters, or saved in localStorage, IndexedDB or cookies. */
const MAX_PRIVATE_CATALOG_BYTES = 64 * 1024 * 1024;
const FILTER_IDS = ['domain','project','status','machine','tag','kind','verification'];
function secureOrigin() {
  const loc = window.location;
  return loc.protocol === 'https:' || (loc.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(loc.hostname));
}
function validateCatalog(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('请选择有效的研究地图 JSON 对象');
  if (input.schema_version !== 'atlas-catalog-v0.2') throw new Error('目录版本不兼容：需要 atlas-catalog-v0.2 的 merged.json，而不是原始归档 ZIP 或源清单');
  for (const key of ['records','nodes','edges']) if (!Array.isArray(input[key])) throw new Error('目录缺少数组字段：'+key);
  if (input.records.length > 100000 || input.nodes.length > 500000 || input.edges.length > 1000000) throw new Error('目录记录量超出本地浏览器安全上限');
  for (const [index, r] of input.records.entries()) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || typeof r.title !== 'string' || typeof r.status !== 'string') {
      throw new Error('研究记录字段不完整，位置：'+index);
    }
    if (r.evidence !== undefined && !Array.isArray(r.evidence)) throw new Error('研究记录的 evidence 必须是数组，位置：'+index);
  }
  if (input.review_queue !== undefined && !Array.isArray(input.review_queue)) throw new Error('review_queue 必须是数组');
  return input;
}
function setCatalog(input, privateLoaded, fileName) {
  const catalog = validateCatalog(input);
  state.catalog = catalog;
  state.privateLoaded = Boolean(privateLoaded);
  state.view = 'list';
  state.page = 1;
  state.filtered = [];
  const dlg = $('details');
  if (dlg.open) dlg.close();
  $('details-body').replaceChildren();
  $('query').value = '';
  $('result_verified').value = '';
  for (const [id, key] of [['domain','domain'],['project','project'],['status','status'],['machine','origin_machines'],['tag','tags'],['kind','kind'],['verification','verification']]) {
    const select = $(id);
    while (select.options.length > 1) select.remove(1);
    select.value = '';
    const values = [...new Set(catalog.records.flatMap(r => Array.isArray(r[key]) ? r[key] : [r[key]]).filter(Boolean))].sort();
    for (const v of values) {
      const option = element('option',String(v));
      option.value = String(v);
      select.append(option);
    }
  }
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active',b.dataset.view==='list'));
  const count = catalog.records.length;
  $('private-status').dataset.mode = privateLoaded ? 'private' : 'public';
  $('private-status').textContent = privateLoaded
    ? `已在本机内存打开 ${fileName || '私有目录'} · ${count} 条来源记录。没有上传、持久化或科学有效性升级。`
    : '公开界面使用空目录。选择可信的本地 merged.json 即可临时打开私有地图。';
  $('clear-private').disabled = !privateLoaded;
  $('load-state').classList.remove('error');
  $('load-state').textContent = `${privateLoaded ? '已加载本地私有目录' : '公开空目录'} · ${catalog.generated_utc || '生成时间未知'} · ${count} 条来源记录 · ${(catalog.index_errors||[]).length} 个索引错误`;
  metrics();
  render();
}
async function importPrivateFile(file) {
  if (!file) return false;
  if (!secureOrigin()) throw new Error('当前网页不是 HTTPS 或 localhost。拒绝读取私有文件，请通过安全的 HTTPS 网址打开网站');
  if (!/\\.json$/i.test(file.name || '')) throw new Error('请选择生成后的 merged.json 文件，不支持 ZIP 或其他格式');
  if (!Number.isFinite(file.size) || file.size < 2 || file.size > MAX_PRIVATE_CATALOG_BYTES) throw new Error('JSON 文件大小不合法或超过 64 MiB 限制');
  const parsed = JSON.parse(await file.text());
  setCatalog(parsed,true,file.name);
  return true;
}
async function onPrivateFileChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  try {
    await importPrivateFile(file);
  } catch (error) {
    $('private-status').dataset.mode = 'error';
    $('private-status').textContent = '导入失败：'+error.message+'。已有地图保持不变。';
  } finally {
    input.value = '';
  }
}
function clearPrivateCatalog() {
  if (state.publicCatalog) setCatalog(state.publicCatalog,false,'');
  $('private-file').value = '';
}

async function init() {
  try {
    const response = await fetch('data/merged.json',{cache:'no-store'});
    if (!response.ok) throw new Error('找不到默认目录；请先运行本地构建或打开已部署的 Pages');
    const catalog = validateCatalog(await response.json());
    // The public site ships an empty default catalog. Local servers may serve private data.
    state.publicCatalog = catalog.records.length === 0 ? catalog : {...catalog,records:[],nodes:[],edges:[],review_queue:[],source_archives:{}};
    setCatalog(catalog,catalog.records.length > 0,catalog.records.length > 0 ? '本机服务提供的目录' : '');
  } catch (error) {
    $('load-state').textContent = error.message;
    $('load-state').classList.add('error');
  }
}
for(const id of ['query','domain','project','status','machine','tag','kind','verification','result_verified'])$(id).addEventListener(id==='query'?'input':'change',()=>{state.page=1;render();});document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.page=1;document.querySelectorAll('nav button').forEach(n=>n.classList.toggle('active',n===b));render();});$('prev').onclick=()=>{state.page--;render();};$('next').onclick=()=>{state.page++;render();};$('close').onclick=()=>$('details').close();$('private-file').addEventListener('change',onPrivateFileChange);$('clear-private').onclick=clearPrivateCatalog;$('export').onclick=()=>{const blob=new Blob([JSON.stringify({schema_version:state.catalog.schema_version,data_policy:'PRIVATE_LOCAL_DERIVED',records:state.filtered},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=element('a');a.href=url;a.download='research-atlas-filtered-private.json';a.click();URL.revokeObjectURL(url);};init();

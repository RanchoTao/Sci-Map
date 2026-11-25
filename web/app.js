/* No telemetry, network dependencies, auto-upload, or verdict inference. */
'use strict';
const I18N = {
"en": {
"view_prefix": "View ",
"date_unknown": "date unknown",
"no_summary": "No summary",
"m_records": "Records",
"m_sourced": "Source-documented or better",
"m_receipts": "CI or receipt verified",
"m_indep": "Independently reproduced",
"m_failures": "Failures / dead ends",
"m_contrib": "Contributors / sources",
"m_dupes": "Possible duplicates",
"n_matching": " matching records",
"empty_list": "No matching records. A gap in the ledger does not mean nobody has tried this.",
"empty_review": "No duplicate candidates for this filter. Title similarity is not proof of semantic duplication.",
"graph_aria": "Research graph with provenance",
"unnamed_source": "Unnamed source",
"has_excerpt": "with excerpt",
"locator_only": "locator only",
"n_cited": " cited source locations",
"inv_note": "Built only from the loaded catalog; not a full file inventory. No query, path or record id is sent to any server.",
"inv_empty": "This catalog has no evidence locations to show.",
"th_path": "Cited source path",
"th_machine": "Source",
"th_count": "Citations / evidence",
"not_provided": "not provided",
"times_sep": " × · ",
"scope_unreviewed": "Scope not reviewed",
"h_summary": "Outcome / summary",
"h_evidence": "Evidence and provenance",
"lines_prefix": "lines ",
"btn_preview": "Verify and preview source",
"preview_truncated": "\n[Preview truncated; restore the full original from the private archive]",
"sha_verified": "SHA-256 verified",
"public_source": "Public source",
"source_ids": "Source record ids: ",
"h_peer": "Peer historical judgment (unverified; does not change status)",
"h_history": "Status history (as recorded by the source)",
"receipt_yes": "Result check passed within its declared scope; not an independent scientific reproduction",
"receipt_no": "Result not checked or no receipt provided",
"contributor": "Contributor: ",
"operator": " · operator ",
"h_cause": "Cause (as far as the evidence shows)",
"h_setup": "Setup",
"h_repro": "CI repro command",
"expect": "\nExpect: ",
"h_reproductions": "Reproductions",
"h_followup": "Follow-up",
"ledger_file": "Ledger file: ",
"h_hypothesis": "Hypothesis",
"h_results": "Recorded outcome / metrics",
"h_boundary": "Evidence validity boundary",
"exp_status": "Experiment status: ",
"result_kind": "Result kind: ",
"h_basis": "Verification basis",
"h_vscope": "Scope of the verified result",
"h_chain": "Problem → Hypothesis → Experiment → Evidence → Verdict → Follow-up",
"h_hints": "Status words found in source (unreviewed)",
"no_hints": "none extracted",
"err_object": "Choose a valid Sci-Map catalog JSON object",
"err_version": "Incompatible catalog version: expected an atlas-catalog-v0.2 merged.json, not a raw archive ZIP or manifest",
"err_array": "Catalog is missing array field: ",
"err_size": "Catalog exceeds the browser safety limit",
"err_record": "Incomplete record at index ",
"err_evidence": "Record evidence must be an array, index ",
"err_queue": "review_queue must be an array",
"err_https": "This page is not served over HTTPS or localhost; refusing to read a private file",
"err_ext": "Choose a generated merged.json; ZIP and other formats are not supported",
"err_filesize": "JSON file is empty or larger than 64 MiB",
"import_failed": "Import failed: ",
"import_kept": ". The current map is unchanged.",
"err_default": "Default catalog not found; run `python tools/ledger.py build` or open the deployed site",
"local_served": "catalog served by this machine",
"private_dir": "private catalog",
"gen_unknown": "generation time unknown",
"graph_note": "{n} nodes · {e} links on this page. Links are provenance and section relations, not causation. At most 100 nodes; narrow with filters.",
"status_private": "Opened {file} in this browser's memory · {n} records. Nothing uploaded, stored or upgraded.",
"status_public": "Public verdict ledger · {n} records (CC BY 4.0). Choose a local merged.json to view a private map in memory only; nothing is uploaded.",
"status_empty": "The public ledger has no records yet. Choose a trusted local merged.json to view a private map.",
"load_state": "{mode} · {time} · {n} records · {e} index errors",
"mode_private": "Local private catalog",
"mode_public": "Public verdict ledger",
"mode_empty": "Empty public catalog",
"title": "Sci-Map · Research verdict ledger",
"tagline": "Failures count",
"nav_aria": "Map views",
"nav_list": "Records",
"nav_timeline": "Timeline",
"nav_graph": "Graph",
"nav_review": "Duplicates & conflicts",
"nav_inventory": "Source inventory",
"policy": "A public ledger of tested research hypotheses and their scoped verdicts. Check before you run; don't repeat someone else's dead end. Contribute by GitHub pull request.",
"contribute": "How to contribute",
"eyebrow": "EVIDENCE BEFORE VERDICT",
"h1": "Check the dead ends before you run.",
"lede": "Each record is a tested hypothesis: within what scope it failed or held, why, and how strong the evidence is. Source claims, CI reproductions and independent reproductions are labelled separately.",
"loading": "Loading ledger…",
"loader_aria": "Open a private map locally in this browser",
"loader_title": "Open a private map on this device",
"loader_text": "Choose a merged.json built with tools/ledger.py build --private. It is parsed in browser memory only: never uploaded or cached. Reloading clears it.",
"loader_label": "Choose local catalog JSON",
"clear_private": "Clear private map from memory",
"private_initial": "No private catalog loaded.",
"metrics_aria": "Ledger statistics",
"f_search": "Search",
"f_search_ph": "hypothesis / cause / method / domain",
"f_domain": "Domain",
"f_domain_all": "All domains",
"f_project": "Project",
"f_project_all": "All projects",
"f_status": "Verdict",
"f_status_all": "All verdicts",
"f_machine": "Contributor / source",
"f_machine_all": "All contributors",
"f_tag": "Tag",
"f_tag_all": "All tags",
"f_kind": "Record kind",
"f_kind_all": "All kinds",
"f_verification": "Evidence level",
"f_verification_all": "All levels",
"f_receipt": "Reproduction",
"f_receipt_all": "Any",
"f_receipt_true": "Reproduced or receipt checked",
"f_receipt_false": "Not reproduced / unchecked",
"export": "Export filtered JSON",
"prev": "Previous",
"next": "Next",
"footer": "A verdict applies only to the hypothesis and scope its evidence states. No record does not mean nobody tried.",
"close": "Close",
"lang_toggle": "中文",
"nav_map": "Problem map",
"map_none": "This catalog has no problem tree. Generate one with tools/import_tree.py and add it with build --tree.",
"map_summary": "{areas} areas · {problems} open problems · {progress} with partial progress · {tried} already tried · {flagged} need a second look · as of {asof}",
"map_updated": "The map changed since your last visit ({since}).",
"map_nav_aria": "Research areas",
"area_counts": "{open} open · {progress} progress · {tried} tried",
"area_papers": "{n} papers in this area",
"start_here": "Start reading here",
"cites": "{n} citations",
"reviewers_question": "Reviewers in this area most often question: {name} ({k}/{n} reviews)",
"mf_all": "All",
"mf_attention": "Needs attention",
"mf_explicit": "Explicitly called open",
"mf_progress": "Has progress",
"mf_tried": "Tried",
"map_no_problems": "No problems match this filter.",
"project_link": "Linked project",
"st_open": "Open",
"st_progress": "Partial progress",
"sg_explicit": "Explicit open problem",
"sg_future": "Author future-work idea",
"tried": "Tried",
"check": "Check",
"more": "Source and details",
"orig_sentence": "Original sentence",
"followup_h": "Follow-up search",
"context_sentence": "Context",
"anchor_manual": "Hand-picked anchor problem, not part of the search sample."
},
"zh": {
"view_prefix": "查看 ",
"date_unknown": "日期未知",
"no_summary": "暂无摘要",
"m_records": "课题 / 结果 / 待核对线索记录",
"m_sourced": "来源已核对记录",
"m_receipts": "历史结果凭据已核对",
"m_indep": "独立复现结果",
"m_failures": "失败 / 死路记录",
"m_contrib": "贡献者 / 来源机器",
"m_dupes": "重复 / 版本待审",
"n_matching": " 条匹配记录",
"empty_list": "没有匹配记录。未采集或未审阅不表示该方向从未研究。",
"empty_review": "当前筛选下没有重复候选。标题相似检索不是科学上的语义去重证明。",
"graph_aria": "有来源的研究关系图",
"unnamed_source": "未命名来源",
"has_excerpt": "附有来源摘录",
"locator_only": "仅有来源定位",
"n_cited": " 个已引用的来源位置",
"inv_note": "当前表仅根据已导入的轻量目录生成，不等同全机器文件覆盖清单。不会发送查询、路径或记录 ID 到服务器。",
"inv_empty": "此目录没有可显示的来源证据定位。",
"th_path": "引用来源路径",
"th_machine": "机器",
"th_count": "被引用次数 / 证据范围",
"not_provided": "未提供",
"times_sep": " 次 · ",
"scope_unreviewed": "适用范围未审阅",
"h_summary": "来源内容摘要",
"h_evidence": "验证依据与来源定位",
"lines_prefix": "行 ",
"btn_preview": "校验并预览原始文本",
"preview_truncated": "\n[预览截断；请从私有归档恢复完整原件]",
"sha_verified": "SHA-256 已验证",
"public_source": "公开来源",
"source_ids": "源机器记录 ID：",
"h_peer": "对端历史判断（原文待核对，不自动提升当前状态）",
"h_history": "历史状态（来源记载，不自动判定冲突）",
"receipt_yes": "历史结果凭据已核对；以声明的校验范围为准，不代表独立科学复现",
"receipt_no": "历史结果凭据尚未核对或未提供",
"contributor": "贡献者：",
"operator": " · 负责人 ",
"h_cause": "原因（证据所示范围内）",
"h_setup": "实验设置",
"h_repro": "CI 复现命令",
"expect": "\n期望：",
"h_reproductions": "独立复现记录",
"h_followup": "后续",
"ledger_file": "账本文件：",
"h_hypothesis": "研究假设",
"h_results": "已记载结果 / 指标",
"h_boundary": "证据有效性边界",
"exp_status": "实验状态：",
"result_kind": "结果类型：",
"h_basis": "验证边界 / 对端校验记载",
"h_vscope": "已核对结果的限定范围",
"h_chain": "问题 → 假设 → 实验 → 证据 → 判断 → 后续",
"h_hints": "已发现的状态词（待审阅）",
"no_hints": "未提取状态词",
"err_object": "请选择有效的研究地图 JSON 对象",
"err_version": "目录版本不兼容：需要 atlas-catalog-v0.2 的 merged.json，而不是原始归档 ZIP 或源清单",
"err_array": "目录缺少数组字段：",
"err_size": "目录记录量超出本地浏览器安全上限",
"err_record": "研究记录字段不完整，位置：",
"err_evidence": "研究记录的 evidence 必须是数组，位置：",
"err_queue": "review_queue 必须是数组",
"err_https": "当前网页不是 HTTPS 或 localhost。拒绝读取私有文件，请通过安全的 HTTPS 网址打开网站",
"err_ext": "请选择生成后的 merged.json 文件，不支持 ZIP 或其他格式",
"err_filesize": "JSON 文件大小不合法或超过 64 MiB 限制",
"import_failed": "导入失败：",
"import_kept": "。已有地图保持不变。",
"err_default": "找不到默认目录；请先运行本地构建或打开已部署的 Pages",
"local_served": "本机服务提供的目录",
"private_dir": "私有目录",
"gen_unknown": "生成时间未知",
"graph_note": "本页 {n} 个来源节点 · {e} 条引用关系。连线是来源与章节关联，不表示因果关系。最多显示 100 个节点；使用筛选缩小范围。",
"status_private": "已在本机内存打开 {file} · {n} 条记录。没有上传、持久化或科学有效性升级。",
"status_public": "公开判决账本 · {n} 条记录（CC BY 4.0）。选择本地 merged.json 可临时切换为私有地图，只在内存中，不上传。",
"status_empty": "公开账本暂无记录。选择可信的本地 merged.json 即可临时打开私有地图。",
"load_state": "{mode} · {time} · {n} 条记录 · {e} 个索引错误",
"mode_private": "已加载本地私有目录",
"mode_public": "公开判决账本",
"mode_empty": "公开空目录",
"title": "Sci-Map · 研究判决账本",
"tagline": "失败也是贡献",
"nav_aria": "地图视图",
"nav_list": "研究记录",
"nav_timeline": "时间线",
"nav_graph": "关系图",
"nav_review": "重复与冲突待审",
"nav_inventory": "来源清单",
"policy": "公开账本记录被检验过的研究假设及其限定范围内的判决。查过再跑，别重复别人的死路。通过 GitHub PR 贡献。",
"contribute": "如何贡献",
"eyebrow": "EVIDENCE BEFORE VERDICT",
"h1": "开跑之前，先查死路。",
"lede": "每条记录是一个被检验过的假设：在什么范围内、因为什么失败或成立、证据到哪一级。来源记载、CI 复现与独立复现分开标注。",
"loading": "正在读取账本…",
"loader_aria": "在浏览器本地打开私有地图",
"loader_title": "在这台设备上打开私有地图",
"loader_text": "选择用 tools/ledger.py build --private 生成的 merged.json。只在浏览器内存中解析和检索，不上传、不缓存。刷新页面即清除。",
"loader_label": "选择本地目录 JSON",
"clear_private": "清空内存中的私有地图",
"private_initial": "未加载私有目录。",
"metrics_aria": "账本统计",
"f_search": "全文检索",
"f_search_ph": "假设 / 失败原因 / 方法 / 领域",
"f_domain": "领域",
"f_domain_all": "全部领域",
"f_project": "项目",
"f_project_all": "全部项目",
"f_status": "判决",
"f_status_all": "全部判决",
"f_machine": "贡献者 / 来源",
"f_machine_all": "全部贡献者",
"f_tag": "标签",
"f_tag_all": "全部标签",
"f_kind": "记录类型",
"f_kind_all": "全部类型",
"f_verification": "证据层级",
"f_verification_all": "全部层级",
"f_receipt": "复现凭据",
"f_receipt_all": "全部",
"f_receipt_true": "已复现或凭据已核对",
"f_receipt_false": "未复现 / 未核对",
"export": "导出当前筛选 JSON",
"prev": "上一页",
"next": "下一页",
"footer": "判决只适用于证据所声明的假设与范围。账本里没有记录，不代表没人试过。",
"close": "关闭",
"lang_toggle": "English",
"nav_map": "问题地图",
"map_none": "这个目录没有问题树。用 tools/import_tree.py 生成后，以 build --tree 加入。",
"map_summary": "{areas} 个方向 · {problems} 个开放问题 · {progress} 个已有部分进展 · {tried} 处有人尝试过 · {flagged} 处需要复查 · 截至 {asof}",
"map_updated": "自你上次查看（{since}）以来地图已更新。",
"map_nav_aria": "研究方向",
"area_counts": "{open} 开放 · {progress} 有进展 · {tried} 尝试过",
"area_papers": "本方向收录 {n} 篇论文",
"start_here": "从这几篇开始读",
"cites": "{n} 次引用",
"reviewers_question": "这一方向的审稿人最常质疑：{name}（{k}/{n} 份评审）",
"mf_all": "全部",
"mf_attention": "需要注意",
"mf_explicit": "作者明确称为开放问题",
"mf_progress": "已有进展",
"mf_tried": "有人尝试过",
"map_no_problems": "这个筛选下没有问题。",
"project_link": "关联项目",
"st_open": "开放",
"st_progress": "部分进展",
"sg_explicit": "作者明确称为开放问题",
"sg_future": "作者的后续工作设想",
"tried": "有人尝试过",
"check": "需复查",
"more": "出处与细节",
"orig_sentence": "原文句子",
"followup_h": "后续工作检索",
"context_sentence": "上下文",
"anchor_manual": "此问题为手工加入的锚文/项目相关问题，不是检索抽样所得。"
}
};
function detectLang() {
  try { const saved = window.localStorage.getItem('scimap-lang'); if (saved === 'en' || saved === 'zh') return saved; } catch (e) { /* storage unavailable */ }
  try { return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'; } catch (e) { return 'en'; }
}
let LANG = detectLang();
function t(key, vars) {
  let text = (I18N[LANG] && I18N[LANG][key]) ?? I18N.en[key] ?? key;
  if (vars) text = text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return text;
}
function applyI18n() {
  if (document.documentElement) document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}
function setLang(lang) {
  LANG = lang === 'zh' ? 'zh' : 'en';
  try { window.localStorage.setItem('scimap-lang', LANG); } catch (e) { /* storage unavailable */ }
  applyI18n();
  if (typeof state !== 'undefined' && state.catalog) { refreshStatus(); metrics(); render(); }
}
const $ = (id) => document.getElementById(id);
const titles = {map:'nav_map',list:'nav_list',timeline:'nav_timeline',graph:'nav_graph',review:'nav_review',inventory:'nav_inventory'};
const state = {catalog:null,publicCatalog:null,privateLoaded:false,view:'list',page:1,pageSize:30,filtered:[],inventory:null};
const element = (tag, text, cls) => {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
function textOf(r){return [r.id,r.topic_id,JSON.stringify(r.source_ids||[]),r.title,r.question,r.summary,r.search_text,r.scope,r.cause,r.hypothesis,r.result_summary,JSON.stringify(r.metrics||{}),JSON.stringify(r.source_status_history||[]),r.verification_basis,r.validation_boundary,r.historical_status,JSON.stringify(r.historical_verdict||''),r.historical_status_group,r.status,r.verification,r.project,r.domain,r.date,r.date_provenance,...(r.tags||[]),...(r.source_paths||[]),...(r.evidence||[]).flatMap(e=>[e.label,e.path,e.source_path,e.excerpt,e.date])].filter(Boolean).join('\n').toLowerCase();}
function filterRecords(){const q=$('query').value.toLowerCase().trim().split(/\s+/).filter(Boolean);return state.catalog.records.filter(r=>q.every(t=>textOf(r).includes(t))&&(!$('status').value||r.status===$('status').value)&&(!$('domain').value||r.domain===$('domain').value)&&(!$('project').value||r.project===$('project').value)&&(!$('machine').value||(r.origin_machines||[r.machine]).includes($('machine').value))&&(!$('tag').value||(r.tags||[]).includes($('tag').value))&&(!$('kind').value||r.kind===$('kind').value)&&(!$('verification').value||r.verification===$('verification').value)&&(!$('result_verified').value||(r.result_verified===true)===($('result_verified').value==='true')));}
function card(r){const node=element('article',undefined,'record');node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label',t('view_prefix')+r.title);node.append(element('h3',r.title));const meta=element('div',undefined,'meta');meta.append(element('span',r.status,'badge '+r.status),element('span',r.project||'UNCLASSIFIED'),element('span',(r.origin_machines||[r.machine]).join(' · ')),element('span',r.date||t('date_unknown')));node.append(meta,element('p',r.summary||t('no_summary')),element('div',(r.tags||[]).join(' · '),'meta'));node.addEventListener('click',()=>details(r));node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();details(r);}});return node;}
function metrics(){const rs=state.catalog.records;const vals=[[t('m_records'),rs.length],[t('m_sourced'),state.catalog.statistics?.source_documented_records||0],[t('m_receipts'),rs.filter(r=>r.result_verified===true).length],[t('m_indep'),state.catalog.statistics?.independently_reproduced_results||0],[t('m_failures'),rs.filter(r=>r.kind==='verdict'&&['KILLED_IN_SCOPE','IMPLEMENTATION_FAILED','LITERATURE_COLLISION','INVALIDATED'].includes(r.status)).length],[t('m_contrib'),new Set(rs.flatMap(r=>r.origin_machines||[r.machine])).size],[t('m_dupes'),state.catalog.review_queue?.length||0]];$('metrics').replaceChildren(...vals.map(([k,v])=>{let n=element('div',undefined,'metric');n.append(element('strong',String(v)),element('span',k));return n;}));}
function render(){if(!state.catalog)return;setChrome(state.view==='map');if(state.view==='map'){renderMapView();return;}state.filtered=filterRecords();$('view-title').textContent=t(titles[state.view]);$('results').className=state.view==='timeline'?'timeline':state.view==='inventory'?'inventory':'records';const max=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));if(state.view!=='inventory')state.page=Math.min(state.page,max);$('result-count').textContent=state.filtered.length+t('n_matching');$('page').textContent=`${state.page} / ${max}`;$('prev').disabled=state.page<=1;$('next').disabled=state.page>=max;const batch=state.filtered.slice((state.page-1)*state.pageSize,state.page*state.pageSize);$('results').replaceChildren();if(state.view==='graph'){renderGraph(batch);return;}if(state.view==='review'){renderReview();return;}if(state.view==='inventory'){renderInventory();return;}if(!batch.length){$('results').append(element('div',t('empty_list'),'empty'));return;}if(state.view==='timeline'){const sorted=[...state.filtered].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')).slice((state.page-1)*state.pageSize,state.page*state.pageSize);let date;for(const r of sorted){if(date!==r.date){date=r.date;$('results').append(element('div',date||t('date_unknown'),'timeline-date'));}$('results').append(card(r));}}else $('results').append(...batch.map(card));}
function renderReview(){const ids=new Set(state.filtered.map(r=>r.id));const queue=(state.catalog.review_queue||[]).filter(x=>x.record_ids.some(id=>ids.has(id)));if(!queue.length){$('results').append(element('div',t('empty_review'),'empty'));return;}for(const item of queue.slice((state.page-1)*30,state.page*30)){const node=element('article',undefined,'record review-card');node.append(element('h3',item.title_key),element('p',item.action));for(const id of item.record_ids){const r=state.catalog.records.find(r=>r.id===id);if(r){const b=element('button',r.title+' · '+r.status);b.onclick=()=>details(r);node.append(b);}}$('results').append(node);}}
function renderGraph(batch){const c=state.catalog;const ids=new Set(batch.map(r=>r.id));const problemIds=new Set((c.nodes||[]).filter(n=>ids.has(n.record_id)).map(n=>n.id));let edges=(c.edges||[]).filter(e=>problemIds.has(e.source)||problemIds.has(e.target));let nodeIds=new Set(edges.flatMap(e=>[e.source,e.target]));let nodes=(c.nodes||[]).filter(n=>nodeIds.has(n.id)).slice(0,100);nodeIds=new Set(nodes.map(n=>n.id));edges=edges.filter(e=>nodeIds.has(e.source)&&nodeIds.has(e.target));$('results').append(element('p',t('graph_note',{n:nodes.length,e:edges.length}),'graph-note'));const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1100 620');svg.setAttribute('class','graph-svg');svg.setAttribute('role','img');svg.setAttribute('aria-label',t('graph_aria'));const kinds=['Research Area','Problem','Hypothesis','Experiment','Evidence','Verdict','Follow-up'];const positions=new Map();for(const kind of kinds){const group=nodes.filter(n=>n.type===kind);group.forEach((n,i)=>positions.set(n.id,{x:70+kinds.indexOf(kind)*155,y:50+(i+.5)*520/Math.max(1,group.length)}));}for(const edge of edges){const a=positions.get(edge.source),b=positions.get(edge.target);if(!a||!b)continue;const line=document.createElementNS(ns,'line');for(const [key,val] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,val);const title=document.createElementNS(ns,'title');title.textContent=edge.type+' · '+(edge.provenance||[]).map(p=>p.label).join('; ');line.append(title);svg.append(line);}for(const n of nodes){const p=positions.get(n.id);const g=document.createElementNS(ns,'g');g.classList.add('graph-node');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',n.type+': '+n.label);const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);circle.setAttribute('r',n.type==='Problem'?7:4);const text=document.createElementNS(ns,'text');text.setAttribute('x',p.x+10);text.setAttribute('y',p.y+4);text.textContent=n.label.slice(0,17);const title=document.createElementNS(ns,'title');title.textContent=n.type+': '+n.label;g.append(circle,text,title);const open=()=>{const r=state.catalog.records.find(r=>r.id===n.record_id)||state.catalog.records.find(r=>r.evidence?.some(e=>n.provenance?.some(p=>p.sha256===e.sha256)));if(r)details(r);};g.onclick=open;g.onkeydown=e=>{if(e.key==='Enter')open();};svg.append(g);}kinds.forEach((kind,i)=>{const label=document.createElementNS(ns,'text');label.setAttribute('x',25+i*155);label.setAttribute('y',20);label.textContent=kind;svg.append(label);});$('results').append(svg);}

function renderInventory() {
  // Derive source references in browser memory. Never send a private query to a public /api endpoint.
  const entries = new Map();
  for (const record of state.filtered) {
    const machine = (record.origin_machines || [record.machine || 'UNKNOWN']).join(', ');
    for (const ev of record.evidence || []) {
      if (!ev || typeof ev !== 'object') continue;
      const path = String(ev.source_path || ev.path || ev.label || t('unnamed_source'));
      const sha = String(ev.sha256 || '');
      const key = [machine,path,sha].join('\u0000');
      if (!entries.has(key)) entries.set(key,{
        machine, path, sha, count:0, bytes:ev.source_bytes || null,
        verification:ev.excerpt ? t('has_excerpt') : t('locator_only')
      });
      entries.get(key).count++;
    }
  }
  const rows = [...entries.values()].sort((a,b)=>a.path.localeCompare(b.path));
  const total = rows.length;
  const limit = 30;
  const max = Math.max(1,Math.ceil(total/limit));
  state.page = Math.min(state.page,max);
  $('result-count').textContent = total + t('n_cited');
  $('page').textContent = `${state.page} / ${max}`;
  $('prev').disabled = state.page <= 1;
  $('next').disabled = state.page >= max;
  const note = element('p',t('inv_note'),'graph-note');
  if (!total) {
    $('results').replaceChildren(note,element('div',t('inv_empty'),'empty'));
    return;
  }
  const table = element('table');
  const head = element('tr');
  for (const label of [t('th_path'),t('th_machine'),'SHA-256',t('th_count')]) head.append(element('th',label));
  table.append(head);
  for (const entry of rows.slice((state.page-1)*limit,state.page*limit)) {
    const row = element('tr');
    row.append(element('td',entry.path),element('td',entry.machine),
      element('td',entry.sha || t('not_provided')),
      element('td',entry.count+t('times_sep')+entry.verification));
    table.append(row);
  }
  $('results').replaceChildren(note,table);
}
function details(r){const body=$('details-body');body.replaceChildren(element('h2',r.title),element('p',`${r.status} · ${r.verification} · ${r.project} · ${(r.origin_machines||[r.machine]).join(', ')}`,'detail-meta'),element('p',`${r.date||t('date_unknown')} — ${r.date_provenance||'UNSPECIFIED'}`,'detail-meta'),element('p',r.scope||t('scope_unreviewed'),'scope'),element('h3',t('h_summary')),element('pre',r.summary||t('no_summary')),element('h3',t('h_evidence')));for(const [i,ev] of (r.evidence||[]).entries()){const box=element('div',undefined,'evidence-row');box.append(element('div',ev.label),element('code','SHA-256 '+(ev.sha256||t('not_provided'))),element('div',[ev.archive,ev.member].filter(Boolean).join(' :: ')));box.append(element('div',[ev.path||ev.label,ev.line_start?t('lines_prefix')+ev.line_start+(ev.line_end?'–'+ev.line_end:''):''].filter(Boolean).join(' · ')));if(ev.excerpt)box.append(element('pre',ev.excerpt));if(ev.archive&&ev.member&&isLoopbackOrigin()&&!String(state.catalog.archive_scope||'').startsWith('COMPACT_KNOWLEDGE_ONLY')){const btn=element('button',t('btn_preview'));btn.onclick=async()=>{btn.disabled=true;try{const response=await fetch('/api/evidence?'+new URLSearchParams({record:r.id,index:String(i)}));const data=await response.json();if(!response.ok)throw new Error(data.error);box.append(element('pre',data.content+(data.truncated?t('preview_truncated'):'')));btn.textContent=t('sha_verified');}catch(e){box.append(element('div',e.message,'error'));btn.disabled=false;}};box.append(btn);}else if(ev.url&&/^https:\/\//.test(ev.url)){const a=element('a',t('public_source'));a.href=ev.url;a.rel='noopener noreferrer';a.target='_blank';box.append(a);}body.append(box);}if(r.source_ids?.length)body.append(element('p',t('source_ids')+r.source_ids.join(' · '),'detail-meta'));if(r.historical_verdict||r.historical_status_group)body.append(element('h3',t('h_peer')),element('pre',JSON.stringify({historical_verdict:r.historical_verdict,historical_status_group:r.historical_status_group},null,2)));if(r.source_status_history?.length)body.append(element('h3',t('h_history')),element('pre',JSON.stringify(r.source_status_history,null,2)));body.append(element('p',r.result_verified===true?t('receipt_yes'):t('receipt_no'),'detail-meta'));if(r.contributor){const c=r.contributor;body.append(element('p',t('contributor')+c.name+(c.kind==='agent'?' · agent'+(c.model?' ('+c.model+')':'')+(c.operator?t('operator')+c.operator:''):' · human'),'detail-meta'));}if(r.cause)body.append(element('h3',t('h_cause')),element('p',r.cause));if(r.experiment&&typeof r.experiment==='string')body.append(element('h3',t('h_setup')),element('p',r.experiment));if(r.repro)body.append(element('h3',t('h_repro')),element('pre',r.repro.command+t('expect')+(r.repro.expect||[]).map(x=>x.metric+' '+x.op+' '+x.value).join('; ')));if(r.reproductions?.length)body.append(element('h3',t('h_reproductions')),element('pre',JSON.stringify(r.reproductions,null,2)));if(r.follow_up&&typeof r.follow_up==='string')body.append(element('h3',t('h_followup')),element('p',r.follow_up));if(r.ledger_path)body.append(element('p',t('ledger_file')+r.ledger_path+' · '+(r.license||'CC-BY-4.0'),'detail-meta'));if(r.hypothesis)body.append(element('h3',t('h_hypothesis')),element('p',typeof r.hypothesis==='string'?r.hypothesis:JSON.stringify(r.hypothesis)));if(r.result_summary||r.metrics)body.append(element('h3',t('h_results')),element('pre',[r.result_summary,JSON.stringify(r.metrics||{},null,2)].filter(Boolean).join('\n')));if(r.validation_boundary)body.append(element('h3',t('h_boundary')),element('p',r.validation_boundary));if(r.experiment_status)body.append(element('p',t('exp_status')+r.experiment_status,'detail-meta'));if(r.result_kind)body.append(element('p',t('result_kind')+r.result_kind,'detail-meta'));if(r.verification_basis)body.append(element('h3',t('h_basis')),element(typeof r.verification_basis==='string'?'p':'pre',typeof r.verification_basis==='string'?r.verification_basis:JSON.stringify(r.verification_basis,null,2)));if(r.verified_result_scope)body.append(element('h3',t('h_vscope')),element(typeof r.verified_result_scope==='string'?'p':'pre',typeof r.verified_result_scope==='string'?r.verified_result_scope:JSON.stringify(r.verified_result_scope,null,2)));const nodes=(state.catalog.nodes||[]).filter(n=>n.record_id===r.id);body.append(element('h3',t('h_chain')));for(const node of nodes)body.append(element('p',`${node.type} · ${node.label} · ${node.verification||'SOURCE_POINTER'}`,'detail-meta'));body.append(element('h3',t('h_hints')),element('p',(r.reported_status_hints||[]).join(', ')||t('no_hints'),'detail-meta'));$('details').showModal();}

/* Private catalogs are parsed from a user-selected file only. Nothing is sent to the server,
   placed in URL parameters, or saved in localStorage, IndexedDB or cookies. */
const MAX_PRIVATE_CATALOG_BYTES = 64 * 1024 * 1024;
const FILTER_IDS = ['domain','project','status','machine','tag','kind','verification'];
function isLoopbackOrigin() {
  return ['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);
}
function secureOrigin() {
  const loc = window.location;
  return loc.protocol === 'https:' || (loc.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(loc.hostname));
}
function validateCatalog(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(t('err_object'));
  if (input.schema_version !== 'atlas-catalog-v0.2') throw new Error(t('err_version'));
  for (const key of ['records','nodes','edges']) if (!Array.isArray(input[key])) throw new Error(t('err_array')+key);
  if (input.records.length > 100000 || input.nodes.length > 500000 || input.edges.length > 1000000) throw new Error(t('err_size'));
  for (const [index, r] of input.records.entries()) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || typeof r.title !== 'string' || typeof r.status !== 'string') {
      throw new Error(t('err_record')+index);
    }
    if (r.evidence !== undefined && !Array.isArray(r.evidence)) throw new Error(t('err_evidence')+index);
  }
  if (input.review_queue !== undefined && !Array.isArray(input.review_queue)) throw new Error(t('err_queue'));
  return input;
}
function setCatalog(input, privateLoaded, fileName) {
  const catalog = validateCatalog(input);
  state.catalog = catalog;
  state.privateLoaded = Boolean(privateLoaded);
  state.view = input.tree ? 'map' : 'list';
  state.mapNode = null;
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
  document.querySelectorAll('aside nav button').forEach(b => b.classList.toggle('active',b.dataset.view===state.view));
  const mapBtn = document.querySelector ? document.querySelector('aside nav button[data-view=map]') : null; if (mapBtn) mapBtn.hidden = !input.tree;
  const count = catalog.records.length;
  state.fileName = fileName || '';
  refreshStatus();
  metrics();
  render();
}

function refreshStatus() {
  if (!state.catalog) return;
  const catalog = state.catalog, count = catalog.records.length, privateLoaded = state.privateLoaded;
  $('private-status').dataset.mode = privateLoaded ? 'private' : 'public';
  $('private-status').textContent = privateLoaded
    ? t('status_private',{file:state.fileName || t('local_served'),n:count})
    : (count ? t('status_public',{n:count}) : t('status_empty'));
  $('clear-private').disabled = !privateLoaded;
  $('load-state').classList.remove('error');
  $('load-state').textContent = t('load_state',{mode:privateLoaded ? t('mode_private') : (count ? t('mode_public') : t('mode_empty')),time:catalog.generated_utc || t('gen_unknown'),n:count,e:(catalog.index_errors||[]).length});
}
async function importPrivateFile(file) {
  if (!file) return false;
  if (!secureOrigin()) throw new Error(t('err_https'));
  if (!/\.json$/i.test(file.name || '')) throw new Error(t('err_ext'));
  if (!Number.isFinite(file.size) || file.size < 2 || file.size > MAX_PRIVATE_CATALOG_BYTES) throw new Error(t('err_filesize'));
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
    $('private-status').textContent = t('import_failed')+error.message+t('import_kept');
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
    if (!response.ok) throw new Error(t('err_default'));
    const catalog = validateCatalog(await response.json());
    // The public site ships an empty default catalog. Local servers may serve private data.
    // Public ledger catalogs (and empty ones) are safe to keep as the reset target; a locally served private catalog is not.
    const policy = String(catalog.data_policy || '');
    const isPublic = policy.startsWith('PUBLIC_') || (!policy.startsWith('PRIVATE') && catalog.records.length === 0 && !catalog.tree);
    state.publicCatalog = isPublic ? catalog : {...catalog,records:[],nodes:[],edges:[],review_queue:[],source_archives:{}};
    setCatalog(catalog,!isPublic,'');
  } catch (error) {
    $('load-state').textContent = error.message;
    $('load-state').classList.add('error');
  }
}
for(const id of ['query','domain','project','status','machine','tag','kind','verification','result_verified'])$(id).addEventListener(id==='query'?'input':'change',()=>{state.page=1;render();});document.querySelectorAll('aside nav button').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.page=1;document.querySelectorAll('aside nav button').forEach(n=>n.classList.toggle('active',n===b));render();});$('prev').onclick=()=>{state.page--;render();};$('next').onclick=()=>{state.page++;render();};$('close').onclick=()=>$('details').close();$('private-file').addEventListener('change',onPrivateFileChange);$('clear-private').onclick=clearPrivateCatalog;$('export').onclick=()=>{const blob=new Blob([JSON.stringify({schema_version:state.catalog.schema_version,data_policy:'PRIVATE_LOCAL_DERIVED',records:state.filtered},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=element('a');a.href=url;a.download='research-atlas-filtered-private.json';a.click();URL.revokeObjectURL(url);};
/* ---------------------------------------------------------------- Problem-tree map
   The default view when a catalog carries a problem tree. Designed to keep
   reading cost low: one summary line, a tree on the left, ten-second cards on
   the right, details folded until asked for. */
const MAP_FILTERS = ['all','attention','explicit','progress','tried'];
function setChrome(isMap) {
  if (!document.querySelector) return;
  for (const sel of ['#metrics','.filters','.pagination','#result-count','#export']) {
    const el = document.querySelector(sel); if (el) el.hidden = isMap;
  }
}
function chip(text, cls) { return element('span', text, 'chip ' + (cls || '')); }
function treeIndex(tree) {
  const byId = new Map(tree.nodes.map(n => [n.id, n]));
  const kids = new Map();
  for (const n of tree.nodes) { if (!kids.has(n.parent)) kids.set(n.parent, []); kids.get(n.parent).push(n); }
  return {byId, kids};
}
function recordsFor(nodeId) { return state.catalog.records.filter(r => (r.addresses || []).includes(nodeId)); }
function problemTried(n) { return (n.attempts || []).length + recordsFor(n.id).length > 0; }
function needsAttention(n) { return (n.flags || []).length > 0 || n.problem?.status === 'partially_solved' || problemTried(n); }
function areaStats(area, idx) {
  const probs = (idx.kids.get(area.id) || []).filter(n => n.level === 'problem');
  return {total: probs.length,
    open: probs.filter(n => n.problem.status === 'open').length,
    progress: probs.filter(n => n.problem.status !== 'open').length,
    tried: probs.filter(problemTried).length + ((area.attempts || []).length ? 1 : 0),
    flagged: probs.filter(n => (n.flags || []).length).length};
}
function seenKey() { return 'scimap-seen-' + (state.catalog.tree.scope || 'tree'); }
function lastSeen() { try { return window.localStorage.getItem(seenKey()); } catch (e) { return null; } }
function markSeen() { try { window.localStorage.setItem(seenKey(), state.catalog.tree.as_of || ''); } catch (e) { /* ignore */ } }
function flagText(f) { return LANG === 'zh' ? f.text_zh : f.text_en; }
function renderMapView() {
  const out = $('results');
  out.className = 'map';
  out.replaceChildren();
  $('view-title').textContent = t('nav_map');
  const tree = state.catalog.tree;
  if (!tree || !Array.isArray(tree.nodes) || !tree.nodes.length) { out.append(element('div', t('map_none'), 'empty')); return; }
  const idx = treeIndex(tree);
  const areas = tree.nodes.filter(n => n.level === 'area');
  const probs = tree.nodes.filter(n => n.level === 'problem');
  if (!state.mapNode || !idx.byId.has(state.mapNode)) state.mapNode = areas[0]?.id;
  state.mapFilter = state.mapFilter || 'all';
  // One-line state of the whole map.
  const seen = lastSeen();
  const summary = element('p', t('map_summary', {areas: areas.length, problems: probs.length,
    progress: probs.filter(n => n.problem.status !== 'open').length,
    tried: probs.filter(problemTried).length + areas.filter(a => (a.attempts || []).length).length,
    flagged: tree.nodes.filter(n => (n.flags || []).length).length, asof: tree.as_of || '?'}), 'map-summary');
  out.append(summary);
  if (seen !== null && seen !== (tree.as_of || '')) out.append(element('p', t('map_updated', {since: seen || '—'}), 'map-updated'));
  markSeen();
  const layout = element('div', undefined, 'map-layout');
  const nav = element('nav', undefined, 'map-nav');
  nav.setAttribute('aria-label', t('map_nav_aria'));
  for (const topic of tree.nodes.filter(n => n.level === 'topic')) {
    nav.append(element('div', (topic.branch ? topic.branch + ' · ' : '') + topic.name, 'map-topic'));
    for (const area of (idx.kids.get(topic.id) || []).filter(n => n.level === 'area')) {
      const s = areaStats(area, idx);
      const b = element('button', undefined, 'map-area' + (area.id === state.mapNode ? ' active' : ''));
      b.append(element('span', area.name, 'map-area-name'));
      const bar = element('span', undefined, 'map-bar');
      for (const [k, v] of [['open', s.open], ['progress', s.progress]]) {
        const seg = element('span', undefined, 'seg ' + k); seg.style.flexGrow = String(v || 0); bar.append(seg);
      }
      b.append(bar, element('span', t('area_counts', s), 'map-area-meta'));
      b.onclick = () => { state.mapNode = area.id; renderMapView(); };
      nav.append(b);
    }
  }
  layout.append(nav, renderAreaPanel(idx.byId.get(state.mapNode), idx));
  out.append(layout);
}
function renderAreaPanel(area, idx) {
  const panel = element('section', undefined, 'map-panel');
  if (!area) return panel;
  panel.append(element('h2', area.name), element('p', area.definition, 'map-def'));
  const meta = [t('area_papers', {n: area.paper_count})];
  if (area.keywords?.length) meta.push(area.keywords.slice(0, 5).join(' · '));
  panel.append(element('p', meta.join(' — '), 'detail-meta'));
  if (area.papers?.length) {
    panel.append(element('h3', t('start_here')));
    const ul = element('ul', undefined, 'start-list');
    for (const p of area.papers) {
      const li = element('li'); const a = element('a', p.title); a.href = p.url || '#'; a.target = '_blank'; a.rel = 'noopener noreferrer';
      li.append(a, element('span', ' · ' + (p.year || '') + (p.citation_count != null ? ' · ' + t('cites', {n: p.citation_count}) : ''), 'detail-meta'));
      ul.append(li);
    }
    panel.append(ul);
  }
  if (area.concerns?.length) {
    const c = area.concerns[0];
    panel.append(element('p', t('reviewers_question', {name: c.name, k: c.reviews, n: c.denominator}), 'map-concern'));
  }
  for (const f of area.flags || []) panel.append(element('p', '⚠ ' + flagText(f), 'map-flag'));
  for (const a of area.attempts || []) panel.append(attemptRow(a));
  const tools = element('div', undefined, 'map-filters');
  tools.setAttribute('role', 'group');
  for (const f of MAP_FILTERS) {
    const b = element('button', t('mf_' + f), state.mapFilter === f ? 'active' : '');
    b.setAttribute('aria-pressed', String(state.mapFilter === f));
    b.onclick = () => { state.mapFilter = f; renderMapView(); };
    tools.append(b);
  }
  panel.append(tools);
  let probs = (idx.kids.get(area.id) || []).filter(n => n.level === 'problem');
  const pick = {all: () => true, attention: needsAttention, explicit: n => n.problem.strength === 'explicit_open_problem',
    progress: n => n.problem.status !== 'open', tried: problemTried}[state.mapFilter] || (() => true);
  probs = probs.filter(pick).sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)));
  if (!probs.length) panel.append(element('div', t('map_no_problems'), 'empty'));
  for (const n of probs) panel.append(problemCard(n, idx));
  return panel;
}
function attemptRow(a) {
  const row = element('div', undefined, 'attempt');
  row.append(chip(a.verdict || t('project_link'), a.verdict === 'KILL' ? 'kill' : 'link'),
    element('span', [a.project, a.item_id, a.date].filter(Boolean).join(' · ')));
  if (a.scope || a.note) row.append(element('p', a.scope || a.note, 'detail-meta'));
  return row;
}
function problemCard(n, idx) {
  const p = n.problem;
  const card = element('article', undefined, 'pcard' + (needsAttention(n) ? ' attention' : ''));
  const chips = element('div', undefined, 'chips');
  chips.append(chip(p.status === 'open' ? t('st_open') : t('st_progress'), p.status === 'open' ? 'open' : 'progress'));
  chips.append(chip(p.strength === 'explicit_open_problem' ? t('sg_explicit') : t('sg_future'), 'strength'));
  if (problemTried(n)) chips.append(chip(t('tried'), 'tried'));
  if ((n.flags || []).length) chips.append(chip('⚠ ' + t('check'), 'flag'));
  card.append(chips, element('h3', p.statement));
  const src = element('p', undefined, 'pcard-src');
  const a = element('a', (p.source_title || p.source_paper) + (p.date ? ' (' + p.date.slice(0, 4) + ')' : ''));
  a.href = p.source_url || '#'; a.target = '_blank'; a.rel = 'noopener noreferrer';
  src.append(a, element('span', ' · ' + (p.locator || ''), 'detail-meta'));
  card.append(src);
  const more = element('details');
  more.append(element('summary', t('more')));
  more.append(element('h4', t('orig_sentence')), element('blockquote', p.quote || ''));
  if (p.context_quote) more.append(element('h4', t('context_sentence')), element('blockquote', p.context_quote));
  if (p.selection === 'anchor_manual') more.append(element('p', t('anchor_manual'), 'detail-meta'));
  for (const f of n.flags || []) more.append(element('p', '⚠ ' + flagText(f), 'map-flag'));
  more.append(element('h4', t('followup_h')), element('p', [p.follow_up?.outcome, p.status_basis].filter(Boolean).join(' · ') || '—', 'detail-meta'));
  const cands = (p.follow_up?.candidates || []).filter(c => (c.similarity || 0) >= 0.05);
  for (const c of cands) { const l = element('a', c.title + (c.year ? ' (' + c.year + ')' : '')); l.href = c.url || '#'; l.target = '_blank'; l.rel = 'noopener noreferrer'; more.append(l, element('br')); }
  for (const at of n.attempts || []) more.append(attemptRow(at));
  for (const r of recordsFor(n.id)) { const b = element('button', r.status + ' · ' + r.title, 'linked-record'); b.onclick = () => details(r); more.append(b); }
  for (const x of n.cross_links || []) { const other = idx.byId.get(x.id); if (other) more.append(element('p', (x.type || '') + ' → ' + other.name, 'detail-meta')); }
  card.append(more);
  return card;
}

if(document.getElementById('lang-toggle'))$('lang-toggle').onclick=()=>setLang(LANG==='en'?'zh':'en');applyI18n();init();

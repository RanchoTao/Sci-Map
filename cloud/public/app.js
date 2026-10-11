"use strict";
/* Private data lives in page memory only. All content is rendered as text. */
const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  csrf: null,
  overview: null,
  view: "list",
  page: 1,
  total: 0,
  limit: 30,
  records: [],
  reviews: [],
  detailId: null,
  poll: null,
  queryTimer: null,
  request: 0,
  detailRequest: 0,
  detailExtraRequest: 0,
  overviewRequest: 0,
  authRequest: 0,
  controllers: new Set(),
};
const titles = {
  list: "研究记录",
  graph: "来源关系图",
  timeline: "研究时间线",
  machines: "跨机器对照",
  reviews: "重复与冲突审核",
};
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined && text !== null) n.textContent = String(text);
  if (cls) n.className = cls;
  return n;
}
function format(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
function showNotice(message) {
  $("notice").textContent = message || "";
  $("notice").classList.toggle("hidden", !message);
}
function clearPrivate() {
  for (const c of state.controllers) c.abort();
  state.controllers.clear();
  clearInterval(state.poll);
  clearTimeout(state.queryTimer);
  state.request++;
  state.detailRequest++;
  state.detailExtraRequest++;
  state.overviewRequest++;
  state.authRequest++;
  Object.assign(state, {
    user: null,
    csrf: null,
    overview: null,
    records: [],
    reviews: [],
    detailId: null,
    poll: null,
    total: 0,
    page: 1,
  });
  $("results").replaceChildren();
  $("metrics").replaceChildren();
  $("detail-body").replaceChildren();
  $("sync-banner").textContent = "";
  $("result-count").textContent = "";
  $("user-name").textContent = "";
  if ($("details").open) $("details").close();
  $("workspace").classList.add("hidden");
  $("logout").classList.add("hidden");
  $("query").value = "";
  $("status").replaceChildren(el("option", "全部状态"));
  $("status").firstChild.value = "";
  $("machine").value = "";
  $("domain").replaceChildren(el("option", "全部领域"));
  $("domain").firstChild.value = "";
  $("tag").replaceChildren(el("option", "全部标签"));
  $("tag").firstChild.value = "";
  $("failure").checked = false;
}
function authScreen(status, message) {
  clearPrivate();
  $("auth-panel").classList.remove("hidden");
  $("auth-title").textContent =
    status === 403 && message === "CSRF_REJECTED"
      ? "访问请求校验未通过"
      : status === 403
        ? "此账号尚未获得访问权限"
        : status === 503 && message === "SETUP_REQUIRED"
          ? "私有地图服务尚未配置"
          : status === 503
            ? "私有地图暂时不可用"
            : "登录私有研究地图";
  const descriptions = {
    LOGIN_REQUIRED: "尚未登录，请使用已授权的 GitHub 账号登录。",
    SESSION_EXPIRED: "登录已过期，请重新登录。",
    USER_NOT_ALLOWED: "此 GitHub 账号尚未获准访问私有研究目录。",
    SETUP_REQUIRED: "服务尚未完成私有 GitHub 连接配置，请完成配置后重试。",
    CSRF_REJECTED: "请求校验未通过，请重新登录后重试。",
    TOKEN_EXPIRED: "GitHub 授权已过期，请重新登录。",
    GITHUB_RATE_OR_PERMISSION: "GitHub 访问暂时被限流或拒绝，请稍后重试。",
    SNAPSHOT_INTEGRITY_FAILED:
      "快照未通过完整性核验，当前无法显示未经核验的目录。",
    NO_VERIFIED_SNAPSHOT: "尚无通过核验的私有目录，请稍后重试。",
  };
  $("auth-message").textContent =
    descriptions[message] ||
    message ||
    "通过已授权的 GitHub 账号读取私有研究目录。";
  $("login-link").classList.toggle("hidden", status === 503);
  $("connection").textContent =
    status === 503
      ? message === "SETUP_REQUIRED"
        ? "服务配置待完成"
        : "暂时无法取得已核验目录"
      : status === 403
        ? "访问被拒绝"
        : "尚未登录";
  showNotice("");
}
async function api(path, options = {}) {
  const authEpoch = state.authRequest;
  const controller = new AbortController();
  state.controllers.add(controller);
  try {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body
          ? {
              "Content-Type": "application/json",
              "X-CSRF-Token": state.csrf || "",
            }
          : {}),
        ...(options.headers || {}),
      },
    });
    let data;
    try {
      data = await response.json();
    } catch {
      data = { error: "服务返回了无法解析的响应" };
    }
    if (authEpoch !== state.authRequest)
      throw new DOMException("请求已被更新的登录会话替代", "AbortError");
    if (!response.ok) {
      const message =
        typeof data.error === "string"
          ? data.error
          : data.message || "请求失败";
      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 503
      ) {
        authScreen(response.status, message);
      }
      throw Object.assign(new Error(message), { status: response.status });
    }
    return data;
  } finally {
    state.controllers.delete(controller);
  }
}
function errorNotice(error) {
  if (error.name !== "AbortError" && state.user)
    showNotice(error.message || "连接暂时失败");
}
function metric(label, value) {
  const n = el("div", null, "metric");
  n.append(el("strong", value ?? "尚未提供"), el("span", label));
  return n;
}
function countFrom(stats, ...keys) {
  for (const k of keys) if (stats?.[k] !== undefined) return stats[k];
  return null;
}
function renderOverview() {
  const o = state.overview,
    s = o.statistics || {},
    c = o.counts || {};
  $("metrics").replaceChildren(
    metric(
      "课题 / 结果 / 待核对线索记录",
      countFrom(c, "records", "total", "totalRecords") ??
        countFrom(s, "scoped_topic_records", "records", "total"),
    ),
    metric(
      "来源记录已核对",
      countFrom(
        s,
        "source_reviewed_records",
        "source_documented_records",
        "reviewed_topics",
      ),
    ),
    metric(
      "历史结果凭据已核对",
      countFrom(s, "historical_result_receipts_checked", "result_verified"),
    ),
    metric(
      "独立科学复现结果",
      countFrom(s, "independently_reproduced_results") ?? 0,
    ),
    metric("待审核关系", o.reviewCount ?? 0),
    metric(
      "归档门禁",
      typeof o.archiveGate === "object"
        ? o.archiveGate.status
        : o.archiveGate || "UNKNOWN",
    ),
  );
  $("connection").textContent = "已登录 · 私有目录 · 自动检查更新";
  const gate =
    typeof o.archiveGate === "object"
      ? format(o.archiveGate)
      : o.archiveGate || "UNKNOWN";
  $("sync-banner").textContent =
    `快照 ${o.snapshot || "未知"} · 同步时间 ${o.syncedAt || "未提供"} · ARCHIVE_GATE ${gate}${o.stale ? " · 当前为上一次可用快照，最新同步尚未完成" : ""}${o.error ? " · " + format(o.error) : ""}`;
  const old = $("status").value;
  $("status").replaceChildren(el("option", "全部状态"));
  $("status").firstChild.value = "";
  for (const status of Object.keys(s.by_status || {}).sort()) {
    const n = el("option", status);
    n.value = status;
    $("status").append(n);
  }
  if ([...$("status").options].some((x) => x.value === old))
    $("status").value = old;
  for (const [id, values] of [
    ["domain", Object.keys(s.by_domain || {}).sort()],
    ["tag", s.tags || []],
  ]) {
    const selected = $(id).value;
    $(id).replaceChildren(
      el("option", id === "domain" ? "全部领域" : "全部标签"),
    );
    $(id).firstChild.value = "";
    for (const value of values) {
      const option = el("option", value);
      option.value = value;
      $(id).append(option);
    }
    if ([...$(id).options].some((x) => x.value === selected))
      $(id).value = selected;
  }
}
async function overview() {
  const version = ++state.overviewRequest,
    previous = state.overview?.snapshot;
  const data = await api("/api/overview");
  if (!state.user || version !== state.overviewRequest) return false;
  state.overview = data;
  renderOverview();
  return previous !== data.snapshot;
}
function queryParams() {
  return new URLSearchParams({
    q: $("query").value.trim(),
    machine: $("machine").value,
    status: $("status").value,
    domain: $("domain").value,
    tag: $("tag").value,
    failure: $("failure").checked ? "1" : "0",
    page: String(state.page),
    limit: String(state.limit),
  });
}
function updatePagination() {
  const pages = Math.max(1, Math.ceil(state.total / state.limit));
  $("page-number").textContent = `${state.page} / ${pages}`;
  $("prev").disabled = state.page <= 1;
  $("next").disabled = state.page >= pages;
  $("pagination").classList.toggle(
    "hidden",
    !["list", "reviews"].includes(state.view),
  );
}
function card(record) {
  const n = el("article", null, "record");
  n.tabIndex = 0;
  n.setAttribute("role", "button");
  n.setAttribute("aria-label", "查看 " + record.title);
  n.append(el("h3", record.title || record.id));
  const meta = el("div", null, "meta");
  meta.append(
    el(
      "span",
      record.status || "UNKNOWN",
      "badge " +
        (/KILL|INVALID|REFUT|FAILED/i.test(record.status || "")
          ? "negative"
          : ""),
    ),
    el("span", record.project || record.domain || "项目未知"),
    el(
      "span",
      (record.origin_machines || [record.machine || "UNKNOWN"]).join(" · "),
    ),
    el("span", record.kind || "记录"),
  );
  n.append(
    meta,
    el(
      "p",
      record.summary || record.question || record.hypothesis || "暂无摘要",
    ),
    el("div", record.verification || "UNREVIEWED", "meta"),
  );
  const open = () => openDetail(record.id);
  n.onclick = open;
  n.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  return n;
}
async function renderView() {
  if (!state.user) return;
  const version = ++state.request;
  showNotice("");
  $("view-title").textContent = titles[state.view];
  $("results").replaceChildren(el("p", "正在读取私有目录…", "empty"));
  try {
    if (state.view === "list") {
      const data = await api("/api/records?" + queryParams());
      if (version !== state.request) return;
      state.records = data.records || [];
      state.total = data.total || 0;
      state.page = data.page || state.page;
      $("results").replaceChildren(...state.records.map(card));
      if (!state.records.length)
        $("results").append(
          el("div", "没有匹配记录。目录空白不代表该方向从未被研究。", "empty"),
        );
      $("result-count").textContent = state.total + " 条匹配记录";
      updatePagination();
    } else if (state.view === "reviews") {
      await renderReviews(version);
    } else if (state.view === "machines") {
      renderMachines();
      updatePagination();
    } else if (state.view === "graph") {
      const params = queryParams();
      params.set("limit", "80");
      const data = await api("/api/graph?" + params);
      if (version !== state.request) return;
      renderGraph(data, $("results"));
      $("result-count").textContent = (data.nodes || []).length + " 个来源节点";
      updatePagination();
    } else if (state.view === "timeline") {
      const data = await api("/api/timeline?" + queryParams());
      if (version !== state.request) return;
      renderTimeline(data.events || [], $("results"));
      $("result-count").textContent =
        (data.events || []).length + " 个来源事件";
      updatePagination();
    }
  } catch (e) {
    if (version === state.request && state.user) {
      $("results").replaceChildren(
        el("div", "数据读取失败；可点击“更新目录”重试。", "empty"),
      );
      errorNotice(e);
    }
  }
}
function section(body, title, value) {
  if (value === undefined || value === null || value === "") return;
  body.append(
    el("h3", title),
    el(typeof value === "string" ? "p" : "pre", format(value)),
  );
}
async function openDetail(id) {
  if (!state.user) return;
  const version = ++state.detailRequest;
  state.detailExtraRequest++;
  state.detailId = id;
  $("detail-body").replaceChildren(el("p", "正在读取记录…"));
  if (!$("details").open) $("details").showModal();
  try {
    const reply = await api("/api/records/" + encodeURIComponent(id));
    const r = reply.record || reply;
    if (!state.user || state.detailId !== id || version !== state.detailRequest)
      return;
    const b = $("detail-body");
    b.replaceChildren(
      el("h2", r.title || r.id),
      el(
        "p",
        [r.id, r.status, r.verification].filter(Boolean).join(" · "),
        "detail-meta",
      ),
      el(
        "p",
        (r.origin_machines || [r.machine || "UNKNOWN"]).join(" / ") +
          " · " +
          (r.project || ""),
        "detail-meta",
      ),
      el(
        "p",
        (r.date || "日期未知") + " · " + (r.date_provenance || "UNSPECIFIED"),
        "detail-meta",
      ),
      el("p", r.scope || "适用范围尚未核对", "scope"),
    );
    section(b, "研究问题", r.question);
    section(b, "假设", r.hypothesis);
    section(b, "来源记载摘要", r.summary);
    section(
      b,
      "结果 / 关键指标",
      r.result_summary || r.metrics || r.recorded_metrics,
    );
    section(b, "失败原因及边界", r.cause);
    section(b, "验证依据", r.verification_basis);
    section(b, "验证边界", r.validation_boundary);
    section(b, "已核对结果的限定范围", r.verified_result_scope);
    b.append(
      el(
        "p",
        r.result_verified === true
          ? "历史结果凭据已核对；只在所声明的范围内成立，不代表独立科学复现。"
          : "历史结果凭据未核对或未提供。",
        "scope",
      ),
    );
    if (r.source_ids?.length) section(b, "原机器记录编号", r.source_ids);
    if (r.historical_verdict || r.historical_status_group)
      section(b, "对端历史判断（原文待核对，不提升当前状态）", {
        historical_verdict: r.historical_verdict,
        historical_status_group: r.historical_status_group,
      });
    section(b, "历史状态（来源记载，不自动判定冲突）", r.source_status_history);
    section(b, "后续方向", r.follow_up || r.next_step);
    b.append(el("h3", "来源摘录与完整性定位"));
    for (const ev of r.evidence || []) {
      const n = el("div", null, "evidence");
      n.append(
        el("div", ev.label || ev.path || "来源"),
        el("code", "SHA-256 " + (ev.sha256 || "未提供")),
        el(
          "div",
          [
            ev.machine,
            ev.path || ev.source_path,
            ev.line_start
              ? "行 " + ev.line_start + (ev.line_end ? "–" + ev.line_end : "")
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      );
      if (ev.excerpt) n.append(el("pre", ev.excerpt));
      b.append(n);
    }
    const actions = el("div", null, "detail-actions");
    const graph = el("button", "查看该记录的来源关系"),
      timeline = el("button", "查看该记录的时间线");
    const extra = el("section");
    graph.onclick = async () => {
      const extraVersion = ++state.detailExtraRequest;
      try {
        const data = await api(
          "/api/graph?" + new URLSearchParams({ id, limit: "80" }),
        );
        if (
          state.user &&
          state.detailId === id &&
          version === state.detailRequest &&
          extraVersion === state.detailExtraRequest
        )
          renderGraph(data, extra);
      } catch (e) {
        if (
          version === state.detailRequest &&
          extraVersion === state.detailExtraRequest
        )
          errorNotice(e);
      }
    };
    timeline.onclick = async () => {
      const extraVersion = ++state.detailExtraRequest;
      try {
        const data = await api(
          "/api/timeline?" + new URLSearchParams({ record: id }),
        );
        if (
          state.user &&
          state.detailId === id &&
          version === state.detailRequest &&
          extraVersion === state.detailExtraRequest
        )
          renderTimeline(data.events || [], extra);
      } catch (e) {
        if (
          version === state.detailRequest &&
          extraVersion === state.detailExtraRequest
        )
          errorNotice(e);
      }
    };
    actions.append(graph, timeline);
    const related = el("section");
    b.append(actions, extra, related);
    loadRelated(id, related, version);
  } catch (e) {
    if (
      state.user &&
      state.detailId === id &&
      version === state.detailRequest
    ) {
      $("detail-body").replaceChildren(el("p", e.message, "error"));
    }
  }
}
async function loadRelated(id, target, version) {
  try {
    const data = await api("/api/related?" + new URLSearchParams({ id }));
    if (!state.user || state.detailId !== id || version !== state.detailRequest)
      return;
    target.append(
      el("h3", "关联的跨来源记录（待审核关联，保持独立）"),
      el(
        "p",
        data.semantics || "仅表示审核候选或原机器编号相同，不自动合并。",
        "detail-meta",
      ),
    );
    for (const r of data.records || []) {
      const n = el("div", null, "evidence");
      n.append(
        el("h4", r.title || r.id),
        el(
          "p",
          [r.machine, r.status, r.verification].filter(Boolean).join(" · "),
          "detail-meta",
        ),
        el("p", r.scope || "适用范围待核对"),
        el("p", "关联依据：" + (r.match_basis || "待审核"), "detail-meta"),
      );
      const button = el("button", "查看独立来源记录");
      button.onclick = () => openDetail(r.id);
      n.append(button);
      target.append(n);
    }
    if (!data.records?.length)
      target.append(el("p", "暂无有明确来源的关联候选。", "detail-meta"));
  } catch (e) {
    if (state.user && state.detailId === id && version === state.detailRequest)
      target.append(el("p", "关联候选暂时无法读取：" + e.message, "error"));
  }
}
function renderTimeline(events, target) {
  target.replaceChildren();
  if (!events.length) {
    target.append(
      el("p", "暂无带来源的时间事件。未提供日期不补造日期。", "empty"),
    );
    return;
  }
  for (const event of events) {
    const n = el("article", null, "timeline-event");
    n.append(
      el("div", event.date || event.timestamp || "日期未知", "timeline-date"),
      el("h3", event.title || event.label || event.type || "来源事件"),
      el("p", event.summary || event.status || event.description || ""),
      el(
        "p",
        event.date_provenance ||
          event.provenance?.date_provenance ||
          "日期出处见记录",
        "detail-meta",
      ),
    );
    if (event.provenance) n.append(el("pre", format(event.provenance)));
    if (event.record_id) {
      const button = el("button", "查看关联记录");
      button.onclick = () => openDetail(event.record_id);
      n.append(button);
    }
    target.append(n);
  }
}
function renderGraph(data, target) {
  target.replaceChildren();
  const nodes = (data.nodes || []).slice(0, 80),
    ids = new Set(nodes.map((n) => n.id)),
    edges = (data.edges || []).filter(
      (e) => ids.has(e.source) && ids.has(e.target),
    );
  target.append(
    el(
      "p",
      `${nodes.length} 个来源节点 · ${edges.length} 条来源关系。图为有界视图，最多 80 个节点；连线不表示因果证明。打开具体记录可查看其关系。`,
      "graph-note",
    ),
  );
  if (!nodes.length) {
    target.append(el("p", "暂无来源关系；不会生成无依据连线。", "empty"));
    return;
  }
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 1150 650");
  svg.setAttribute("class", "graph-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "带出处的研究关系图");
  const preferred = [
    "Research Area",
    "Problem",
    "Hypothesis",
    "Experiment",
    "Evidence",
    "Verdict",
    "Follow-up",
  ];
  const kinds = [
    ...new Set([
      ...preferred,
      ...nodes.map((n) => n.type || n.kind || "UNKNOWN"),
    ]),
  ].filter((k) => nodes.some((n) => (n.type || n.kind || "UNKNOWN") === k));
  const pos = new Map();
  kinds.forEach((kind, index) => {
    const group = nodes.filter((n) => (n.type || n.kind || "UNKNOWN") === kind);
    group.forEach((n, i) =>
      pos.set(n.id, {
        x: 40 + (index * 1050) / Math.max(1, kinds.length - 1),
        y: 60 + ((i + 0.5) * 540) / group.length,
      }),
    );
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", 20 + (index * 1050) / Math.max(1, kinds.length - 1));
    text.setAttribute("y", 25);
    text.textContent = kind;
    svg.append(text);
  });
  for (const e of edges) {
    const a = pos.get(e.source),
      b = pos.get(e.target);
    const line = document.createElementNS(ns, "line");
    for (const [k, v] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }))
      line.setAttribute(k, v);
    const title = document.createElementNS(ns, "title");
    title.textContent =
      (e.type || "来源关系") + "\n" + format(e.provenance || []);
    line.append(title);
    svg.append(line);
  }
  for (const n of nodes) {
    const p = pos.get(n.id),
      g = document.createElementNS(ns, "g"),
      circle = document.createElementNS(ns, "circle"),
      text = document.createElementNS(ns, "text"),
      title = document.createElementNS(ns, "title");
    g.setAttribute("class", "graph-node");
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    circle.setAttribute("cx", p.x);
    circle.setAttribute("cy", p.y);
    circle.setAttribute("r", 6);
    text.setAttribute("x", p.x + 9);
    text.setAttribute("y", p.y + 4);
    text.textContent = String(n.label || n.title || n.id).slice(0, 16);
    title.textContent =
      String(n.label || n.id) + "\n" + format(n.provenance || []);
    g.setAttribute("aria-label", title.textContent);
    g.append(circle, text, title);
    const record = n.record_id || n.recordId;
    if (record) {
      g.onclick = () => openDetail(record);
      g.onkeydown = (e) => {
        if (e.key === "Enter") openDetail(record);
      };
    }
    svg.append(g);
  }
  target.append(svg);
}
function renderMachines() {
  const o = state.overview,
    s = o.statistics || {},
    counts = o.counts || {};
  const machines =
    counts.by_machine || counts.machines || s.by_machine || s.machines || {};
  const grid = el("div", null, "machine-grid");
  for (const machine of ["RANCHO", "TAO"]) {
    const n = el("article", null, "machine-card");
    n.append(el("h3", machine));
    const info = machines[machine] ?? counts[machine];
    if (info === undefined)
      n.append(el("p", "当前快照未提供该机器分项。", "detail-meta"));
    else if (typeof info === "object") {
      for (const [k, v] of Object.entries(info)) {
        const row = el("div", null, "key-value");
        row.append(
          el("span", k),
          el("span", typeof v === "object" ? format(v) : v),
        );
        n.append(row);
      }
    } else n.append(el("p", info + " 条目录记录"));
    const btn = el("button", "检索 " + machine + " 的记录");
    btn.onclick = () => {
      $("machine").value = machine;
      setView("list");
    };
    n.append(btn);
    grid.append(n);
  }
  $("results").replaceChildren(
    grid,
    el(
      "p",
      "不同来源、不同版本或不同结论保持独立。记录数不等同跨机器去重后的科学课题数。",
      "graph-note",
    ),
  );
  $("result-count").textContent = "独立来源对照";
}
async function renderReviews(version) {
  const data = await api(
    "/api/reviews?" +
      new URLSearchParams({
        page: String(state.page),
        limit: String(state.limit),
      }),
  );
  if (version !== state.request) return;
  state.reviews = data.items || [];
  state.total = data.total || 0;
  $("result-count").textContent = state.total + " 个待审关系";
  $("results").replaceChildren();
  for (const item of state.reviews) {
    const n = el("article", null, "review-card");
    n.append(
      el("h3", item.title || item.title_key || item.type || item.id),
      el(
        "p",
        item.action || item.reason || "相似记录仅为审核候选，不自动合并判断。",
        "detail-meta",
      ),
    );
    const links = el("div", null, "record-links");
    for (const id of item.record_ids || item.records || []) {
      const value = typeof id === "object" ? id.id : id;
      const b = el("button", typeof id === "object" ? id.title || id.id : id);
      b.onclick = () => openDetail(value);
      links.append(b);
    }
    n.append(links);
    if (item.evidence || item.provenance)
      n.append(el("pre", format(item.evidence || item.provenance)));
    const annotations = Array.isArray(data.annotations)
      ? data.annotations.filter(
          (a) => a.review_id === item.id || a.id === item.id,
        )
      : [(data.annotations || {})[item.id]].filter(Boolean);
    if (annotations.length)
      n.append(
        el("h4", "已保存的审核意见（保留全部记录）"),
        el("pre", format(annotations)),
      );
    const controls = el("div", null, "review-controls");
    const label = el("label", "关系分类"),
      decision = el("select");
    decision.setAttribute("aria-label", "审核关系分类");
    for (const [value, text] of [
      ["", "选择分类"],
      ["DUPLICATE", "重复课题"],
      ["VERSION", "不同版本"],
      ["UPDATE", "后续更新"],
      ["CONFLICT", "结论冲突"],
      ["UNRELATED", "无关"],
    ]) {
      const opt = el("option", text);
      opt.value = value;
      decision.append(opt);
    }
    label.append(decision);
    const noteLabel = el("label", "判断依据与适用条件"),
      note = el("textarea");
    note.maxLength = 2000;
    note.placeholder =
      "引用具体证据，说明版本、条件和结论范围；不改写原始记录。";
    noteLabel.append(note);
    const save = el("button", "保存审核意见"),
      message = el("p", "", "detail-meta");
    save.onclick = async () => {
      if (!decision.value) {
        message.textContent = "请先选择关系分类。";
        return;
      }
      save.disabled = true;
      message.textContent = "正在保存…";
      try {
        const reply = await api("/api/reviews/" + encodeURIComponent(item.id), {
          method: "POST",
          body: JSON.stringify({ decision: decision.value, note: note.value }),
        });
        if (!state.user) return;
        message.textContent = "审核意见已保存。原始来源记录保持独立。";
        message.append(el("pre", format(reply.annotation || reply)));
      } catch (e) {
        if (state.user) message.textContent = e.message;
      } finally {
        save.disabled = false;
      }
    };
    controls.append(label, noteLabel, save, message);
    n.append(controls);
    $("results").append(n);
  }
  if (!state.reviews.length)
    $("results").append(
      el("p", "当前没有待审关系。审核意见不会直接合并原始证据。", "empty"),
    );
  updatePagination();
}
function setView(view) {
  state.view = view;
  state.page = 1;
  for (const b of document.querySelectorAll("nav button"))
    b.classList.toggle("active", b.dataset.view === view);
  renderView();
}
async function start() {
  const version = ++state.authRequest;
  try {
    const session = await api("/api/session");
    if (version !== state.authRequest) return;
    if (!session.user) {
      authScreen(401);
      return;
    }
    state.user = session.user;
    state.csrf = session.csrf;
    $("auth-panel").classList.add("hidden");
    $("workspace").classList.remove("hidden");
    $("logout").classList.remove("hidden");
    $("user-name").textContent =
      session.user.name ||
      session.user.login ||
      session.user.email ||
      "已授权用户";
    await overview();
    if (!state.user) return;
    await renderView();
    clearInterval(state.poll);
    state.poll = setInterval(async () => {
      if (!state.user || document.hidden) return;
      try {
        if (await overview()) {
          await renderView();
          if (state.detailId) openDetail(state.detailId);
        }
      } catch (e) {
        errorNotice(e);
      }
    }, 60000);
  } catch (e) {
    if (
      e.name !== "AbortError" &&
      !state.user &&
      version === state.authRequest
    ) {
      authScreen(e.status || 0, e.message);
    }
  }
}
$("retry").onclick = start;
$("refresh").onclick = async () => {
  try {
    await overview();
    await renderView();
  } catch (e) {
    errorNotice(e);
  }
};
$("query").addEventListener("input", () => {
  clearTimeout(state.queryTimer);
  state.queryTimer = setTimeout(() => {
    state.page = 1;
    renderView();
  }, 250);
});
for (const id of ["machine", "status", "domain", "tag", "failure"])
  $(id).addEventListener("change", () => {
    state.page = 1;
    renderView();
  });
for (const b of document.querySelectorAll("nav button"))
  b.onclick = () => setView(b.dataset.view);
$("prev").onclick = () => {
  state.page--;
  renderView();
};
$("next").onclick = () => {
  state.page++;
  renderView();
};
$("close-detail").onclick = () => {
  state.detailId = null;
  state.detailRequest++;
  state.detailExtraRequest++;
  $("details").close();
  $("detail-body").replaceChildren();
};
$("details").addEventListener("close", () => {
  state.detailId = null;
  state.detailRequest++;
  state.detailExtraRequest++;
  $("detail-body").replaceChildren();
});
$("logout").onclick = async () => {
  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    authScreen(401, "已退出。此页面内存中的研究目录已清空。");
  } catch (e) {
    clearPrivate();
    authScreen(
      e.status || 0,
      "此页面内存已清空；服务端退出未确认，请重试。" + e.message,
    );
  }
};
window.addEventListener("pagehide", clearPrivate);
window.addEventListener("pageshow", (e) => {
  if (e.persisted) start();
});
start();

import { $, esc, php, fmtDate, api, toast, modal } from "/app.js";
import { statusChip, scoreClass } from "/views/review.js";

const todayISO = () => new Date().toISOString().slice(0, 10);
const isFinal = (s) => ["Approved", "Rejected", "Paid"].includes(s);
const ui = { status: "All", who: "All" };

// ============================ CASE OVERSIGHT ============================
export async function renderOverview(root) {
  const { rows, people } = await api("/manager/overview");
  const esc_ = rows.filter((r) => r.status === "Escalated");
  const open = rows.filter((r) => !isFinal(r.status));
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;
  const paint = () => {
    const shown = rows.filter((r) => (ui.status === "All" || r.status === ui.status) && (ui.who === "All" || r.assignee === ui.who));
    root.innerHTML = `
      <div class="page-head"><div><h1>Case oversight</h1><div class="muted">Good morning, Elena. See what your team is working on, and the cases they need you to review.</div></div></div>

      <div class="card review-box">
        <div class="between"><h2 style="margin:0">Needs your review <span class="chip amber">${esc_.length}</span></h2><span class="muted small">Cases escalated by your claim executives</span></div>
        ${esc_.length ? esc_.map((r) => `<div class="esc-row" data-id="${r.id}">
          <div style="flex:1"><div><b>${r.id}</b>, ${esc(r.claimant)} <span class="muted">${esc(r.type)}, ${php(r.amount)}</span> <span class="score ${scoreClass(r.score)}">${r.score}</span></div>
            <div class="esc-note"><b>${esc(r.escalation.by)}:</b> ${esc(r.escalation.note)}</div></div>
          <button class="btn primary sm" data-open="${r.id}">Review case</button></div>`).join("") : `<div class="muted" style="margin-top:10px">Nothing is waiting for you.</div>`}
      </div>

      <div class="kpi-row" style="margin-top:16px">
        <div class="card kpi"><div class="v">${open.length}</div><div class="l">Open cases</div></div>
        <div class="card kpi"><div class="v">${esc_.length}</div><div class="l">Escalated to you</div></div>
        <div class="card kpi"><div class="v">${rows.filter((r) => isFinal(r.status)).length}</div><div class="l">Decided by the team</div></div>
        <div class="card kpi"><div class="v">${avg}</div><div class="l">Average risk score</div></div>
      </div>

      <div class="card"><h2>Team</h2>
        <table><thead><tr><th>Claim executive</th><th>Open</th><th>Escalated</th><th>Decided</th><th>Total</th></tr></thead><tbody>
          ${people.map((p) => `<tr class="click" data-who="${esc(p.name)}"><td><b>${esc(p.name)}</b></td><td>${p.open}</td><td>${p.escalated}</td><td>${p.decided}</td><td>${p.total}</td></tr>`).join("")}
        </tbody></table>
        <div class="muted small" style="margin-top:6px">Click an executive to filter the case queue below.</div>
      </div>

      <div class="card"><h2>Case queue</h2>
        <div class="toolbar">
          <select id="fs" style="max-width:200px"><option value="All">All statuses</option>${["New", "In review", "Documents requested", "Escalated", "Approved", "Rejected", "Paid"].map((s) => `<option ${ui.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <select id="fw" style="max-width:200px"><option value="All">All executives</option>${people.map((p) => `<option ${ui.who === p.name ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
        </div>
        <table><thead><tr><th>Claim</th><th>Claimant</th><th>Type</th><th>Amount</th><th>Handled by</th><th>Status</th><th>Risk</th><th>AI suggests</th><th>Due</th></tr></thead><tbody>
          ${shown.map((r) => `<tr class="click ${r.status === "Escalated" ? "esc" : ""}" data-id="${r.id}"><td><b>${r.id}</b></td><td>${esc(r.claimant)}</td><td>${esc(r.type)}</td><td>${php(r.amount)}</td><td>${esc(r.assignee)}</td><td>${statusChip(r.status)}</td><td><span class="score ${scoreClass(r.score)}">${r.score}</span></td><td>${esc(r.outcome)}</td><td>${isFinal(r.status) ? '<span class="muted">-</span>' : `<span class="${r.due < todayISO() ? "due late" : ""}">${fmtDate(r.due)}</span>`}</td></tr>`).join("") || `<tr><td colspan="9" class="empty">No cases match.</td></tr>`}
        </tbody></table>
      </div>`;
    root.querySelectorAll("[data-id]").forEach((el) => (el.onclick = (e) => { if (!e.target.closest("[data-open]")) location.hash = "#/manager/claim/" + el.dataset.id; }));
    root.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => (location.hash = "#/manager/claim/" + b.dataset.open)));
    root.querySelectorAll("[data-who]").forEach((tr) => (tr.onclick = () => { ui.who = tr.dataset.who; paint(); $("#fw").scrollIntoView({ block: "center" }); }));
    $("#fs").onchange = (e) => { ui.status = e.target.value; paint(); };
    $("#fw").onchange = (e) => { ui.who = e.target.value; paint(); };
  };
  paint();
}

// ============================ RULE MANAGEMENT ============================
const ACTIONS = [["approve", "Fast-track approve"], ["review", "Review"], ["escalate", "Escalate to manager"], ["decline", "Reject"]];

export async function renderRules(root) {
  let state = await api("/manager/rules");
  let draft = structuredClone(state.rules);
  let note = "";

  const fieldOf = (k) => state.fields.find((f) => f.key === k) || state.fields[0];
  const same = (a, b) => JSON.stringify(a.cond || null) === JSON.stringify(b.cond || null) && a.enabled === b.enabled && a.action === b.action && Number(a.weight) === Number(b.weight) && (a.param?.value ?? null) === (b.param?.value ?? null) && a.name === b.name && a.text === b.text;
  const changed = () => {
    const base = Object.fromEntries(state.rules.map((r) => [r.id, r]));
    const edits = draft.filter((r) => base[r.id] && !same(r, base[r.id])).length;
    const removed = state.rules.filter((r) => !draft.some((d) => d.id === r.id)).length;
    const added = draft.filter((r) => !base[r.id]).length;
    return edits + removed + added;
  };

  const condInput = (fd, cond, f) => fd.type === "choice"
    ? `<select data-f="${f}">${fd.options.map((o) => `<option ${String(cond.value) === o ? "selected" : ""}>${o}</option>`).join("")}</select>`
    : `<input ${fd.type === "number" ? 'type="number"' : 'type="text"'} data-f="${f}" value="${esc(cond.value)}" placeholder="Value">`;
  const condEditor = (r) => {
    const fd = fieldOf(r.cond.field);
    return `<label class="p">Fires when</label><select data-f="cfield" aria-label="Field">${state.fields.map((x) => `<option value="${x.key}" ${x.key === fd.key ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select>
      <div class="param" style="margin-top:6px"><select data-f="cop" style="width:96px" aria-label="Comparison">${state.ops[fd.type].map((o) => `<option ${r.cond.op === o ? "selected" : ""}>${o}</option>`).join("")}</select>${condInput(fd, r.cond, "cvalue")}</div>`;
  };
  const addRule = () => {
    const next = Math.max(0, ...[...draft, ...state.rules].map((r) => /^C(\d+)$/.test(r.id) ? Number(r.id.slice(1)) : 0)) + 1;
    const id = "C" + String(next).padStart(2, "0");
    const m = modal(`
      <div class="between"><h2 style="margin:0">Add a rule</h2><button class="btn sm" id="x">Close</button></div>
      <p class="muted">A rule fires when one measure of the claim meets your condition. It adds its points to the risk score and sets the suggested action.</p>
      <label class="f" for="rn">Name</label><input type="text" id="rn" placeholder="e.g. Night-time loss">
      <label class="f" for="rt">Description</label><textarea id="rt" rows="2" placeholder="Why this matters, in plain words"></textarea>
      <label class="f" for="rf">Fires when</label><select id="rf">${state.fields.map((x) => `<option value="${x.key}">${esc(x.label)}</option>`).join("")}</select>
      <div class="grid2"><div><label class="f" for="ro">Comparison</label><select id="ro"></select></div><div><label class="f" for="rv">Value</label><div id="rvw"></div></div></div>
      <div class="grid2"><div><label class="f" for="ra">Then suggest</label><select id="ra">${ACTIONS.map(([k, l]) => `<option value="${k}" ${k === "review" ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div><label class="f" for="rw">Score points</label><input type="number" id="rw" min="0" max="100" value="10"></div></div>
      <div id="rerr" class="small" style="color:var(--red);min-height:18px;margin-top:6px"></div>
      <div class="between"><span class="muted small">Id ${id}. Nothing changes until you publish.</span><button class="btn primary" id="rok">Add to draft</button></div>`);
    const q = (x) => m.el.querySelector(x);
    const syncField = () => {
      const fd = fieldOf(q("#rf").value);
      q("#ro").innerHTML = state.ops[fd.type].map((o) => `<option>${o}</option>`).join("");
      q("#rvw").innerHTML = condInput(fd, { value: fd.type === "choice" ? fd.options[0] : "" }, "x").replace('data-f="x"', 'id="rv"');
    };
    q("#rf").onchange = syncField; syncField();
    q("#x").onclick = m.close;
    q("#rok").onclick = () => {
      const name = q("#rn").value.trim(), value = q("#rv").value.trim(), fd = fieldOf(q("#rf").value);
      if (!name) return (q("#rerr").textContent = "Give the rule a name.");
      if (value === "" || (fd.type === "number" && Number.isNaN(Number(value)))) return (q("#rerr").textContent = "Enter a value for the condition.");
      draft.push({ id, name, text: q("#rt").value.trim() || name, kind: "custom", custom: true, enabled: true, param: null, action: q("#ra").value, weight: Number(q("#rw").value) || 0, cond: { field: fd.key, op: q("#ro").value, value } });
      m.close(); paint();
    };
  };

  const paint = () => {
    const n = changed();
    const removed = state.rules.filter((r) => !draft.some((d) => d.id === r.id));
    root.innerHTML = `
      <div class="page-head">
        <div><h1>Rule management</h1><div class="muted">These rules score every claim for fraud risk. Edit them, delete the ones you do not need, then publish. Open claims are re-scored when you publish.</div></div>
        <div style="display:flex;gap:8px;align-items:center"><span class="chip">Version ${state.version}</span><button class="btn" id="reset">Reset to defaults</button><button class="btn brand" id="addrule">Add rule</button></div>
      </div>
      <div class="card">
        ${draft.map((r) => `<div class="rule ${r.enabled ? "" : "off"}" data-rid="${r.id}">
          <div class="id">${r.id}${r.custom ? '<div class="chip blue" style="margin-top:4px">Custom</div>' : ""}</div>
          <div><input type="text" data-f="name" value="${esc(r.name)}" aria-label="Rule name"><textarea data-f="text" rows="2" aria-label="Rule description" style="margin-top:6px">${esc(r.text)}</textarea></div>
          <div><label class="p">When it fires</label><select data-f="action">${ACTIONS.map(([k, l]) => `<option value="${k}" ${r.action === k ? "selected" : ""}>${l}</option>`).join("")}</select>
            <label class="p" style="margin-top:6px">Score points</label><input type="number" min="0" max="100" data-f="weight" value="${r.weight}"></div>
          <div>${r.custom ? condEditor(r) : r.param ? `<label class="p">${esc(r.param.label)}</label><div class="param"><input type="number" min="0" data-f="param" value="${r.param.value}"><span class="muted small">${esc(r.param.unit)}</span></div>` : '<span class="muted small">No parameter</span>'}</div>
          <div style="display:grid;gap:8px;justify-items:start">
            <label class="toggle" title="Switched on"><input type="checkbox" data-f="enabled" ${r.enabled ? "checked" : ""}><span></span></label>
            <button class="btn sm danger-o" data-del="${r.id}">Delete</button></div>
        </div>`).join("") || '<div class="empty">No rules left. Every claim will score 0.</div>'}
        ${removed.length ? `<div class="chip amber" style="white-space:normal;margin-top:12px;display:block">Marked for deletion: ${removed.map((r) => `<b>${r.id}</b> <button class="linkish" data-undo="${r.id}">Undo</button>`).join(", ")}</div>` : ""}
      </div>
      <div class="actionbar">
        <span class="${n ? "" : "muted"}">${n ? `<b>${n}</b> unpublished change${n === 1 ? "" : "s"}` : "No unpublished changes"}</span><span class="right"></span>
        <input type="text" id="note" placeholder="Version note (optional)" value="${esc(note)}" style="max-width:280px" ${n ? "" : "disabled"}>
        <button class="btn" id="discard" ${n ? "" : "disabled"}>Discard</button>
        <button class="btn primary" id="publish" ${n ? "" : "disabled"}>Publish update</button>
      </div>
      <div class="card" style="margin-top:16px"><h2>Change log</h2>
        ${state.log.map((l) => `<div class="act"><span class="tag">v${l.version}</span><div><div><b>${esc(l.by)}</b> ${esc(l.note || (l.changes.length ? "" : "No changes"))}</div>
          ${l.changes.length ? `<div class="small muted">${l.changes.map(esc).join("; ")}</div>` : ""}<div class="small muted">${new Date(l.at).toLocaleString("en-PH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div></div></div>`).join("")}
      </div>`;

    root.querySelectorAll("[data-rid]").forEach((row) => {
      const r = draft.find((x) => x.id === row.dataset.rid);
      row.querySelectorAll("[data-f]").forEach((el) => (el.onchange = () => {
        const f = el.dataset.f;
        if (f === "enabled") r.enabled = el.checked;
        else if (f === "cfield") { const fd = fieldOf(el.value); r.cond = { field: fd.key, op: state.ops[fd.type][0], value: fd.type === "choice" ? fd.options[0] : "" }; }
        else if (f === "cop") r.cond.op = el.value;
        else if (f === "cvalue") r.cond.value = el.value;
        else if (f === "param") r.param.value = Number(el.value);
        else if (f === "weight") r.weight = Number(el.value);
        else r[f] = el.value;
        paint();
      }));
    });
    root.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
      const m = modal(`<h2>Delete ${b.dataset.del}?</h2><p class="muted">The rule stops scoring claims once you publish. You can still undo this before publishing.</p>
        <div class="between" style="margin-top:14px"><button class="btn" id="no">Cancel</button><button class="btn danger" id="yes">Delete rule</button></div>`);
      m.el.querySelector("#no").onclick = m.close;
      m.el.querySelector("#yes").onclick = () => { draft = draft.filter((x) => x.id !== b.dataset.del); m.close(); paint(); };
    }));
    root.querySelectorAll("[data-undo]").forEach((b) => (b.onclick = () => {
      const orig = state.rules.find((r) => r.id === b.dataset.undo);
      draft.push(structuredClone(orig)); draft.sort((a, c) => a.id.localeCompare(c.id)); paint();
    }));
    $("#addrule").onclick = addRule;
    $("#note").oninput = (e) => (note = e.target.value);
    $("#discard").onclick = () => { draft = structuredClone(state.rules); note = ""; paint(); };
    $("#publish").onclick = async () => {
      try {
        const out = await api("/manager/rules", { rules: draft, note }, "PUT");
        state = { ...state, ...out.state }; draft = structuredClone(state.rules); note = "";
        paint();
        toast(out.rescored.length ? `Version ${out.version} published. ${out.rescored.map((r) => `${r.id} ${r.from} to ${r.to}`).join(", ")}` : `Version ${out.version} published. No open claim changed.`);
      } catch (e) { toast(e.message, true); }
    };
    $("#reset").onclick = async () => {
      const out = await api("/manager/rules/reset", {});
      state = { ...state, ...out.state }; draft = structuredClone(state.rules); note = "";
      paint(); toast("Rules reset to the defaults");
    };
  };
  paint();
}

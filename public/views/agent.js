import { $, esc, php, fmtDate, api, streamApi, toast, modal, md } from "/app.js";

const TODAY = "2026-10-23"; // matches the server's fixed demo date
const STAGES = ["New", "Contacted", "Quoted", "Negotiation", "Won", "Lost"];
const crm = { leads: [], emails: [] };
// `view` is set while the leads workspace is on screen, so the assistant can refresh it after it changes a lead.
const ui = { stage: "All", q: "", flash: null, view: null };

async function refresh() {
  const r = await api("/crm/leads");
  crm.leads = r.leads; crm.emails = r.emails;
}
const isOpen = (l) => !["Won", "Lost"].includes(l.stage);
const stageChip = (s) => `<span class="stage ${s}">${s}</span>`;
const dueLabel = (l) => {
  if (!l.next_due || !isOpen(l)) return "";
  const cls = l.next_due < TODAY ? "late" : l.next_due === TODAY ? "today" : "";
  return `<span class="due ${cls}">${l.next_due === TODAY ? "Due today" : l.next_due < TODAY ? "Overdue" : "Due " + fmtDate(l.next_due)}</span>`;
};

// ---------- pane resizing: drag a divider, use arrow keys, or double-click to reset; widths are remembered ----------
const PANES = { list: { v: "--list-w", def: 320, min: 220, max: 520, dir: 1 }, dock: { v: "--dock-w", def: 380, min: 300, max: 720, dir: -1 } };
const paneKey = (n) => "wfs_pane_" + n;
function setPane(n, px, save = true) {
  const p = PANES[n];
  const w = Math.max(p.min, Math.min(p.max, Math.round(px)));
  document.documentElement.style.setProperty(p.v, w + "px");
  if (save) { try { localStorage.setItem(paneKey(n), String(w)); } catch {} }
  return w;
}
export function restorePanes() {
  for (const n of Object.keys(PANES)) { try { const v = Number(localStorage.getItem(paneKey(n))); if (v) setPane(n, v, false); } catch {} }
}
function resizable(el, n) {
  const p = PANES[n];
  const cur = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue(p.v)) || p.def;
  el.onpointerdown = (e) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = cur();
    el.setPointerCapture?.(e.pointerId);
    el.classList.add("drag"); document.body.classList.add("resizing");
    el.onpointermove = (ev) => setPane(n, w0 + (ev.clientX - x0) * p.dir, false);
    el.onpointerup = el.onpointercancel = () => {
      el.classList.remove("drag"); document.body.classList.remove("resizing");
      el.onpointermove = el.onpointerup = el.onpointercancel = null;
      setPane(n, cur());
    };
  };
  el.onkeydown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setPane(n, cur() + (e.key === "ArrowRight" ? 16 : -16) * p.dir);
  };
  el.ondblclick = () => setPane(n, p.def);
}

// ============================ LEADS WORKSPACE: list | details ============================
export async function renderLeads(root, selectedId) {
  await refresh();
  const firstDue = crm.leads.find((l) => isOpen(l) && l.next_due && l.next_due <= TODAY);
  let sel = crm.leads.some((l) => l.id === selectedId) ? selectedId : (firstDue || crm.leads[0])?.id;

  root.innerHTML = `
    <div class="workspace">
      <aside class="leadlist" aria-label="Leads">
        <div class="between" style="margin-bottom:10px">
          <div><h1 style="font-size:18px;margin:0">Leads</h1><div class="muted small" id="count"></div></div>
          <div style="display:flex;gap:6px"><button class="btn sm" id="reset" title="Restore the demo leads">Reset</button><button class="btn brand sm" id="new">New lead</button></div>
        </div>
        <input type="text" id="q" placeholder="Search leads" aria-label="Search leads" value="${esc(ui.q)}">
        <select id="stagef" aria-label="Filter by stage" style="margin:8px 0 6px"><option value="All">All stages</option>${STAGES.map((s) => `<option ${ui.stage === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        <div id="items" role="listbox"></div>
      </aside>
      <div class="resizer" id="rs-list" role="separator" aria-orientation="vertical" aria-label="Resize the lead list" title="Drag to resize, double-click to reset" tabindex="0"></div>
      <section class="detail" id="detail" aria-live="polite"></section>
    </div>`;

  restorePanes();
  resizable($("#rs-list"), "list");
  const paintList = () => {
    const open = crm.leads.filter(isOpen);
    const due = open.filter((l) => l.next_due && l.next_due <= TODAY).length;
    $("#count").textContent = `${open.length} open, ${due} to follow up`;
    const q = ui.q.toLowerCase();
    const rows = crm.leads.filter((l) => (ui.stage === "All" || l.stage === ui.stage) && (!q || `${l.name} ${l.product} ${l.location}`.toLowerCase().includes(q)));
    $("#items").innerHTML = rows.map((l) => `
      <button class="leaditem ${l.id === sel ? "on" : ""} ${ui.flash === l.id ? "flash" : ""}" data-id="${l.id}" role="option" aria-selected="${l.id === sel}">
        <span class="between"><b>${esc(l.name)}</b>${stageChip(l.stage)}</span>
        <span class="between small muted"><span>${esc(l.product)}</span>${dueLabel(l)}</span>
      </button>`).join("") || `<div class="empty">No leads match.</div>`;
    ui.flash = null;
    root.querySelectorAll(".leaditem").forEach((b) => (b.onclick = () => select(b.dataset.id)));
  };
  const select = (id) => {
    sel = id;
    history.replaceState(null, "", "#/agent/" + id); // keeps the selection in the URL without re-rendering the page
    paintList(); paintDetail();
  };
  const paintAll = () => { paintList(); paintDetail(); };

  function paintDetail() {
    const l = crm.leads.find((x) => x.id === sel);
    const box = $("#detail");
    if (!l) { box.innerHTML = `<div class="empty">Select a lead to see its details.</div>`; return; }
    box.innerHTML = `
      <div class="card">
        <div class="between" style="align-items:flex-start">
          <div><h1 style="margin:0">${esc(l.name)}</h1><div class="muted">${esc(l.product)} · ${esc(l.location)} · from ${esc(l.source)}</div></div>
          <div style="display:flex;gap:8px"><button class="btn" id="mail">Write email</button></div>
        </div>
        <div style="margin:12px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${stageChip(l.stage)} <span class="chip">${l.priority} priority</span> ${l.premium ? `<span class="chip brand">${php(l.premium)} a year</span>` : ""} ${dueLabel(l)}</div>
        <div class="grid2">
          <div><div class="small muted">Email</div><a href="mailto:${esc(l.email)}">${esc(l.email)}</a></div>
          <div><div class="small muted">Phone</div>${esc(l.phone)}</div>
          <div><div class="small muted">Last contact</div>${l.last_contact ? fmtDate(l.last_contact) : "None yet"}</div>
          <div><div class="small muted">Next step</div>${esc(l.next_step)}</div>
        </div>
        <p style="margin:14px 0 0">${esc(l.notes)}</p>
      </div>
      <div class="card">
        <h2>Update this lead</h2>
        <div class="grid2">
          <div><label class="f" for="stage">Stage</label><select id="stage">${STAGES.map((s) => `<option ${s === l.stage ? "selected" : ""}>${s}</option>`).join("")}</select></div>
          <div><label class="f" for="prio">Priority</label><select id="prio">${["High", "Medium", "Low"].map((s) => `<option ${s === l.priority ? "selected" : ""}>${s}</option>`).join("")}</select></div>
          <div><label class="f" for="step">Next step</label><input type="text" id="step" value="${esc(l.next_step)}"></div>
          <div><label class="f" for="due">Follow-up date</label><input type="date" id="due" value="${esc(l.next_due)}"></div>
        </div>
        <div style="margin-top:12px"><button class="btn primary" id="save">Save changes</button></div>
        <label class="f" for="note" style="margin-top:16px">Add a note</label>
        <div style="display:flex;gap:8px"><input type="text" id="note" placeholder="What happened?"><button class="btn" id="addnote">Add</button></div>
      </div>
      <div class="card">
        <h2>Activity</h2>
        ${l.activities.map((a) => `<div class="act"><span class="tag ${a.type}">${a.type}</span><div><div>${esc(a.text)}</div><div class="small muted">${fmtDate(a.date)}</div></div></div>`).join("") || '<div class="muted">No activity yet. Notes, calls and emails appear here.</div>'}
      </div>`;
    const patch = async (body, msg) => {
      try { await api("/crm/leads/" + l.id, body, "PATCH"); await refresh(); ui.flash = l.id; paintAll(); if (msg) toast(msg); }
      catch (e) { toast(e.message, true); }
    };
    $("#save").onclick = () => patch({ stage: $("#stage").value, priority: $("#prio").value, next_step: $("#step").value, next_due: $("#due").value }, "Lead updated");
    $("#addnote").onclick = () => { const v = $("#note").value.trim(); if (v) patch({ notes: v }, "Note added"); };
    $("#mail").onclick = () => emailModal(l, async () => { await refresh(); ui.flash = l.id; paintAll(); });
  }

  $("#q").oninput = (e) => { ui.q = e.target.value; paintList(); };
  $("#stagef").onchange = (e) => { ui.stage = e.target.value; paintList(); };
  $("#new").onclick = () => newLeadModal(async (id) => { await refresh(); if (id) sel = id; paintAll(); });
  $("#reset").onclick = async () => { const r = await api("/crm/reset", {}); crm.leads = r.leads; crm.emails = r.emails; sel = crm.leads[0]?.id; paintAll(); toast("Demo data reset"); };
  paintAll();

  // The assistant calls this after it changes a lead: the list refreshes, the lead flashes, and its details update if it is open.
  ui.view = async (action) => {
    await refresh();
    ui.flash = action?.lead_id || null;
    if (action?.kind === "create" && action.lead_id) sel = action.lead_id;
    paintAll();
  };
}

function emailModal(l, done) {
  const first = l.name.split(" ")[0];
  const m = modal(`
    <div class="between"><h2>Email ${esc(l.name)}</h2><button class="btn sm" id="x">Close</button></div>
    <label class="f" for="to">To</label><input type="text" id="to" value="${esc(l.email)}" disabled>
    <label class="f" for="subj">Subject</label><input type="text" id="subj" value="Following up on your ${esc(l.product)} inquiry">
    <label class="f" for="body">Message</label><textarea id="body" rows="9">Dear ${esc(first)},\n\nThank you for your interest in our ${esc(l.product)} cover. I'd be glad to walk you through the options and answer any questions. When is a good time for a short call this week?\n\nWarm regards,\nAngelo Reyes\nWorkforce Solution</textarea>
    <div class="between" style="margin-top:14px"><span class="muted small">Demo: emails are logged, not actually sent.</span><button class="btn brand" id="send">Send email</button></div>`);
  m.el.querySelector("#x").onclick = m.close;
  m.el.querySelector("#send").onclick = async () => {
    try { await api("/crm/emails", { lead: l.id, subject: m.el.querySelector("#subj").value, body: m.el.querySelector("#body").value }); m.close(); toast("Email sent to " + l.name); done(); }
    catch (e) { toast(e.message, true); }
  };
}

function newLeadModal(done) {
  const m = modal(`
    <div class="between"><h2>New lead</h2><button class="btn sm" id="x">Close</button></div>
    <label class="f" for="name">Name</label><input type="text" id="name">
    <div class="grid2"><div><label class="f" for="phone">Phone</label><input type="text" id="phone"></div><div><label class="f" for="email">Email</label><input type="text" id="email"></div></div>
    <label class="f" for="product">Product</label><select id="product"><option>Personal Accident</option><option>Motor Comprehensive</option><option>Home Fire</option></select>
    <div class="between" style="margin-top:14px"><span></span><button class="btn brand" id="save">Create lead</button></div>`);
  m.el.querySelector("#x").onclick = m.close;
  m.el.querySelector("#save").onclick = async () => {
    const v = (id) => m.el.querySelector("#" + id).value.trim();
    if (!v("name")) return toast("Please enter a name", true);
    try { const r = await api("/crm/leads", { name: v("name"), phone: v("phone"), email: v("email"), product: v("product") }); m.close(); await done(r.lead); toast("Lead created"); }
    catch (e) { toast(e.message, true); }
  };
}

// ============================ PRODUCTS ============================
export async function renderProducts(root) {
  ui.view = null;
  const items = await api("/products");
  root.innerHTML = `
    <div class="page-head"><div><h1>Products</h1><div class="muted">What you can sell. Ask the assistant for details, comparisons or client-ready wording.</div></div></div>
    <div class="products">${items.map((p) => `<div class="card product"><span class="chip brand">${esc(p.line)}</span><h2 style="margin-top:8px">${esc(p.name)}</h2>
      <div class="muted">${esc(p.tagline)}</div>${p.from ? `<div style="margin:8px 0"><b>From ${esc(p.from)}</b></div>` : ""}
      <ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
      <button class="btn sm" data-ask="${esc(p.name)}">Ask the assistant about this</button></div>`).join("")}</div>`;
  root.querySelectorAll("[data-ask]").forEach((b) => (b.onclick = () => askAssistant(`Tell me about ${b.dataset.ask}: what is covered, what is excluded, and how much does it cost?`)));
}

// ============================ ASSISTANT DOCK (right side, like an IDE copilot panel) ============================
const BOT_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/></svg>`;
const chat = { open: true, history: [], busy: false, mounted: false, sugg: [] };

export function unmountAssistant() {
  $("#widget-root").innerHTML = ""; chat.mounted = false; chat.history = []; chat.open = true;
  document.body.classList.remove("dock-open"); ui.view = null;
}

export async function mountAssistant() {
  if (chat.mounted) return;
  chat.mounted = true;
  try { chat.sugg = await api("/crm/suggestions"); } catch { chat.sugg = []; }
  $("#widget-root").innerHTML = `
    <aside class="dock" id="dock" aria-label="Assistant">
      <div class="resizer dock-rs" id="rs-dock" role="separator" aria-orientation="vertical" aria-label="Resize the assistant" title="Drag to resize, double-click to reset" tabindex="0"></div>
      <div class="dock-head"><div><b>WS Assistant</b><small>Product answers and CRM actions</small></div><button class="x" id="cx" aria-label="Hide the assistant">×</button></div>
      <div class="msgs" id="msgs" aria-live="polite"></div>
      <div class="chat-sugg" id="sugg"></div>
      <form class="composer" id="cf"><input type="text" id="ci" placeholder="Ask about a product, or tell me what to do" aria-label="Message" autocomplete="off"><button class="btn brand" id="cs">Send</button></form>
    </aside>
    <button class="dock-tab" id="tab" aria-label="Show the assistant">${BOT_ICON}<span>Assistant</span></button>`;
  restorePanes();
  resizable($("#rs-dock"), "dock");
  $("#cx").onclick = () => toggle(false);
  $("#tab").onclick = () => toggle(true);
  $("#cf").onsubmit = (e) => { e.preventDefault(); const v = $("#ci").value.trim(); if (v) send(v); };
  paintSugg();
  addBubble("them", "Hi Angelo! I can answer product questions from our product sheets, and I can update leads and send emails for you. Try one of the suggestions below.");
  toggle(chat.open);
}

function toggle(open) {
  chat.open = open;
  document.body.classList.toggle("dock-open", open);
  $("#dock").hidden = !open;
  $("#tab").hidden = open;
  if (open) $("#ci").focus();
}
function paintSugg() {
  $("#sugg").innerHTML = chat.sugg.map((s, i) => `<button type="button" data-i="${i}">${esc(s.label)}</button>`).join("");
  $("#sugg").querySelectorAll("button").forEach((b) => (b.onclick = () => send(chat.sugg[+b.dataset.i].label, chat.sugg[+b.dataset.i].scenario)));
}
export function askAssistant(text) { toggle(true); send(text); }

function scroll() { const m = $("#msgs"); m.scrollTop = m.scrollHeight; }
function addBubble(who, text) {
  const b = document.createElement("div");
  b.className = "bubble " + who;
  b.innerHTML = who === "me" ? esc(text) : md(text);
  $("#msgs").appendChild(b); scroll();
  return b;
}
const ACTION_ICON = { update: "✓", note: "✓", create: "＋", email: "✉" };
function addAction(a) {
  const c = document.createElement("div");
  c.className = "actcard";
  c.innerHTML = `<b><span class="ck">${ACTION_ICON[a.kind] || "✓"}</span>${esc(a.title)}</b><div class="small muted">${esc(a.detail || "")}</div>
    ${a.email ? `<details style="margin-top:6px"><summary class="small" style="cursor:pointer">View email</summary><div class="mail"><b>To:</b> ${esc(a.email.to)}\n<b>Subject:</b> ${esc(a.email.subject)}\n\n${esc(a.email.body)}</div></details>` : ""}`;
  $("#msgs").appendChild(c); scroll();
}

async function send(text, scenario) {
  if (chat.busy) return;
  chat.busy = true;
  $("#ci").value = ""; $("#cs").disabled = true;
  chat.history.push({ role: "user", content: text });
  addBubble("me", text);
  let bubble = null, cur = "", all = "", typing = null;
  const clearTyping = () => { typing?.remove(); typing = null; };
  const showTyping = () => { if (typing) return; typing = document.createElement("div"); typing.className = "typing"; typing.innerHTML = "<i></i><i></i><i></i>"; $("#msgs").appendChild(typing); scroll(); };
  showTyping();
  try {
    await streamApi("/crm/chat", { messages: chat.history, scenario }, (ev) => {
      if (ev.typing) showTyping();
      if (ev.t) {
        clearTyping();
        if (!bubble) { bubble = addBubble("them", ""); cur = ""; }
        cur += ev.t; all += ev.t; bubble.innerHTML = md(cur); scroll();
      }
      if (ev.action) { clearTyping(); bubble = null; addAction(ev.action); ui.view?.(ev.action); }
    });
  } catch (e) {
    clearTyping(); addBubble("them", "Sorry, I couldn't reach the server. " + e.message);
  }
  clearTyping();
  if (all) chat.history.push({ role: "assistant", content: all });
  chat.busy = false; $("#cs").disabled = false; $("#ci")?.focus();
}

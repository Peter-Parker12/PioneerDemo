import { $, esc, php, fmtDate, api, streamApi, toast, modal, md, sleep } from "/app.js";

const TODAY = "2026-10-23"; // matches the server's fixed demo date
const STAGES = ["New", "Contacted", "Quoted", "Negotiation", "Won", "Lost"];
const crm = { leads: [], emails: [] };
const ui = { stage: "All", q: "", flash: null, onChange: null };

async function refresh() {
  const r = await api("/crm/leads");
  crm.leads = r.leads; crm.emails = r.emails;
}
const stageChip = (s) => `<span class="stage ${s}">${s}</span>`;
const dueCell = (l) => {
  if (!l.next_due || ["Won", "Lost"].includes(l.stage)) return `<span class="muted">${l.next_due ? fmtDate(l.next_due) : "-"}</span>`;
  const cls = l.next_due < TODAY ? "late" : l.next_due === TODAY ? "today" : "";
  return `<span class="due ${cls}">${l.next_due === TODAY ? "Today" : fmtDate(l.next_due)}</span>`;
};

// ============================ LEADS (CRM) ============================
export async function renderLeads(root) {
  await refresh();
  const paint = () => {
    const open = crm.leads.filter((l) => !["Won", "Lost"].includes(l.stage));
    const dueNow = open.filter((l) => l.next_due && l.next_due <= TODAY).length;
    const counts = Object.fromEntries(STAGES.map((s) => [s, crm.leads.filter((l) => l.stage === s).length]));
    const q = ui.q.toLowerCase();
    const rows = crm.leads.filter((l) => (ui.stage === "All" || l.stage === ui.stage) && (!q || `${l.name} ${l.product} ${l.location}`.toLowerCase().includes(q)));
    root.innerHTML = `
      <div class="page-head">
        <div><h1>Leads</h1><div class="muted">Good morning, Angelo. Ask the assistant (bottom right) to update leads or send emails for you.</div></div>
        <div class="chips"><button class="btn" id="reset">Reset demo data</button><button class="btn primary" id="new">New lead</button></div>
      </div>
      <dl class="figures">
        <div><dt>Open leads</dt><dd>${open.length}</dd></div>
        <div><dt>Follow-ups due today or overdue</dt><dd>${dueNow}</dd></div>
        <div><dt>Open pipeline, annual premium</dt><dd class="fig">${php(open.reduce((a, l) => a + (l.premium || 0), 0))}</dd></div>
        <div><dt>Won this month</dt><dd>${counts.Won}</dd></div>
      </dl>
      <div class="toolbar">
        <div class="stagebar" role="group" aria-label="Filter by stage">${["All", ...STAGES].map((s) => `<button data-stage="${s}" class="${ui.stage === s ? "on" : ""}" aria-pressed="${ui.stage === s}">${s}<span>${s === "All" ? crm.leads.length : counts[s]}</span></button>`).join("")}</div>
        <input type="text" id="q" class="right" placeholder="Search name, product, city" aria-label="Search leads" value="${esc(ui.q)}">
      </div>
      <table><thead><tr><th>Lead</th><th>Product</th><th>Stage</th><th>Priority</th><th class="fig">Est. premium</th><th>Last contact</th><th>Next step</th><th>Due</th></tr></thead><tbody>
        ${rows.map((l) => `<tr class="click ${ui.flash === l.id ? "flash" : ""}" tabindex="0" data-id="${l.id}"><td class="who-cell"><b>${esc(l.name)}</b><span>${esc(l.location)}, ${esc(l.source)}</span></td><td>${esc(l.product)}</td><td>${stageChip(l.stage)}</td><td>${l.priority}</td><td class="fig">${l.premium ? php(l.premium) : "-"}</td><td>${l.last_contact ? fmtDate(l.last_contact) : "-"}</td><td>${esc(l.next_step)}</td><td>${dueCell(l)}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No leads match. Clear the search or pick another stage.</td></tr>`}
      </tbody></table>`;
    ui.flash = null;
    root.querySelectorAll("[data-stage]").forEach((b) => (b.onclick = () => { ui.stage = b.dataset.stage; paint(); }));
    const qi = $("#q"); qi.oninput = () => { ui.q = qi.value; const pos = qi.selectionStart; paint(); const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); };
    root.querySelectorAll("[data-id]").forEach((tr) => {
      tr.onclick = () => openDrawer(tr.dataset.id, paint);
      tr.onkeydown = (e) => { if (e.key === "Enter") openDrawer(tr.dataset.id, paint); };
    });
    $("#new").onclick = () => newLeadModal(paint);
    $("#reset").onclick = async () => { const r = await api("/crm/reset", {}); crm.leads = r.leads; crm.emails = r.emails; closeDrawer(); paint(); toast("Demo data reset"); };
  };
  paint();
  // The assistant calls this after it changes a lead, so the list updates and the row flashes.
  ui.onChange = async (action) => {
    await refresh();
    ui.flash = action?.lead_id || null;
    if (location.hash === "#/agent") paint();
    if ($("#drawer") && $("#drawer").dataset.id === action?.lead_id) openDrawer(action.lead_id, paint);
  };
}

function closeDrawer() { $("#drawer-bg")?.remove(); $("#drawer")?.remove(); }

function openDrawer(id, repaint) {
  closeDrawer();
  const l = crm.leads.find((x) => x.id === id);
  if (!l) return;
  const bg = document.createElement("div"); bg.id = "drawer-bg"; bg.className = "drawer-bg";
  const d = document.createElement("aside"); d.id = "drawer"; d.className = "drawer"; d.dataset.id = id;
  d.innerHTML = `
    <div class="between"><div><h2 style="margin:0">${esc(l.name)}</h2><div class="muted small">${esc(l.id)}, ${esc(l.product)}, ${esc(l.location)}</div></div><button class="btn sm" id="close">Close</button></div>
    <div class="chips" style="margin:var(--space-sm) 0">${stageChip(l.stage)} <span class="chip">${l.priority} priority</span> ${l.premium ? `<span class="chip fig">${php(l.premium)} a year</span>` : ""}</div>
    <div class="small"><a href="mailto:${esc(l.email)}">${esc(l.email)}</a><br>${esc(l.phone)}</div>
    <p style="margin:var(--space-sm) 0">${esc(l.notes)}</p>
    <div class="grid2">
      <div><label class="f" for="stage">Stage</label><select id="stage">${STAGES.map((s) => `<option ${s === l.stage ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <div><label class="f" for="prio">Priority</label><select id="prio">${["High", "Medium", "Low"].map((s) => `<option ${s === l.priority ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <div><label class="f" for="step">Next step</label><input type="text" id="step" value="${esc(l.next_step)}"></div>
      <div><label class="f" for="due">Follow-up date</label><input type="date" id="due" value="${esc(l.next_due)}"></div>
    </div>
    <div class="chips" style="margin:var(--space-md) 0"><button class="btn primary" id="save">Save changes</button><button class="btn" id="mail">Write email</button></div>
    <label class="f" for="note">Add a note</label><div class="chips"><input type="text" id="note" placeholder="What happened?" style="flex:1"><button class="btn" id="addnote">Add</button></div>
    <h3 style="margin-top:var(--space-lg)">Activity</h3>
    ${l.activities.map((a) => `<div class="act"><span class="tag">${a.type}</span><div><div>${esc(a.text)}</div><div class="small muted">${fmtDate(a.date)}</div></div></div>`).join("") || '<div class="muted">No activity yet. Notes, calls and emails appear here.</div>'}`;
  document.body.append(bg, d);
  bg.onclick = closeDrawer; $("#close", d).onclick = closeDrawer;
  const patch = async (body, msg) => {
    try { await api("/crm/leads/" + id, body, "PATCH"); await refresh(); ui.flash = id; repaint(); openDrawer(id, repaint); if (msg) toast(msg); }
    catch (e) { toast(e.message, true); }
  };
  $("#save", d).onclick = () => patch({ stage: $("#stage", d).value, priority: $("#prio", d).value, next_step: $("#step", d).value, next_due: $("#due", d).value }, "Lead updated");
  $("#addnote", d).onclick = () => { const v = $("#note", d).value.trim(); if (v) patch({ notes: v }, "Note added"); };
  $("#mail", d).onclick = () => emailModal(l, async () => { await refresh(); ui.flash = id; repaint(); openDrawer(id, repaint); });
}

function emailModal(l, done) {
  const first = l.name.split(" ")[0];
  const m = modal(`
    <div class="between"><h2 style="margin:0">Email ${esc(l.name)}</h2><button class="btn sm" id="x">Close</button></div>
    <label class="f" for="to">To</label><input type="text" id="to" value="${esc(l.email)}" disabled>
    <label class="f" for="subj">Subject</label><input type="text" id="subj" value="Following up on your ${esc(l.product)} inquiry">
    <label class="f" for="body">Message</label><textarea id="body" rows="9">Dear ${esc(first)},\n\nThank you for your interest in our ${esc(l.product)} cover. I'd be glad to walk you through the options and answer any questions. When is a good time for a short call this week?\n\nWarm regards,\nAngelo Reyes\nWorkforce Solution</textarea>
    <div class="between" style="margin-top:var(--space-md)"><span class="muted small">Demo: emails are logged, not actually sent.</span><button class="btn primary" id="send">Send email</button></div>`);
  m.el.querySelector("#x").onclick = m.close;
  m.el.querySelector("#send").onclick = async () => {
    try { await api("/crm/emails", { lead: l.id, subject: m.el.querySelector("#subj").value, body: m.el.querySelector("#body").value }); m.close(); toast("Email sent to " + l.name); done(); }
    catch (e) { toast(e.message, true); }
  };
}

function newLeadModal(repaint) {
  const m = modal(`
    <div class="between"><h2 style="margin:0">New lead</h2><button class="btn sm" id="x">Close</button></div>
    <label class="f" for="name">Name</label><input type="text" id="name">
    <div class="grid2"><div><label class="f" for="phone">Phone</label><input type="text" id="phone"></div><div><label class="f" for="email">Email</label><input type="text" id="email"></div></div>
    <label class="f" for="product">Product</label><select id="product"><option>Personal Accident</option><option>Motor Comprehensive</option><option>Home Fire</option></select>
    <div class="between" style="margin-top:var(--space-md)"><span></span><button class="btn primary" id="save">Create lead</button></div>`);
  m.el.querySelector("#x").onclick = m.close;
  m.el.querySelector("#save").onclick = async () => {
    const v = (id) => m.el.querySelector("#" + id).value.trim();
    if (!v("name")) return toast("Please enter a name", true);
    try { await api("/crm/leads", { name: v("name"), phone: v("phone"), email: v("email"), product: v("product") }); await refresh(); m.close(); repaint(); toast("Lead created"); }
    catch (e) { toast(e.message, true); }
  };
}

// ============================ PRODUCTS ============================
export async function renderProducts(root) {
  ui.onChange = null; closeDrawer();
  const items = await api("/products");
  root.innerHTML = `
    <div class="page-head"><div><h1>Products</h1><div class="muted">What you can sell. Ask the assistant for details, comparisons or client-ready wording.</div></div></div>
    <div class="products">${items.map((p) => `<article class="product"><span class="chip">${esc(p.line)}</span><h2 style="margin-top:var(--space-xs)">${esc(p.name)}</h2>
      <div class="muted">${esc(p.tagline)}</div>${p.from ? `<div style="margin:var(--space-xs) 0"><b>From ${esc(p.from)}</b></div>` : ""}
      <ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
      <button class="btn sm" data-ask="${esc(p.name)}">Ask the assistant about this</button></article>`).join("")}</div>`;
  root.querySelectorAll("[data-ask]").forEach((b) => (b.onclick = () => askAssistant(`Tell me about ${b.dataset.ask}: what is covered, what is excluded, and how much does it cost?`)));
}

// ============================ FLOATING ASSISTANT ============================
const BOT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/></svg>`;
const chat = { open: false, history: [], busy: false, mounted: false, sugg: [] };

export function unmountAssistant() {
  $("#widget-root").innerHTML = ""; chat.mounted = false; chat.history = []; chat.open = false; closeDrawer(); ui.onChange = null;
}

export async function mountAssistant() {
  if (chat.mounted) return;
  chat.mounted = true;
  try { chat.sugg = await api("/crm/suggestions"); } catch { chat.sugg = []; }
  $("#widget-root").innerHTML = `
    <div class="fab-label" id="fablabel">Ask the assistant</div>
    <button class="fab" id="fab" aria-label="Open the assistant">${BOT_ICON}</button>
    <section class="chat-panel" id="panel" aria-label="Assistant" hidden>
      <div class="chat-head"><div><b>WS Assistant</b><small>Product answers and CRM actions</small></div><button class="x" id="cx" aria-label="Close the assistant">×</button></div>
      <div class="msgs" id="msgs" aria-live="polite"></div>
      <div class="chat-sugg" id="sugg"></div>
      <form class="composer" id="cf"><input type="text" id="ci" placeholder="Ask about a product, or tell me what to do" aria-label="Message" autocomplete="off"><button class="btn primary" id="cs">Send</button></form>
    </section>`;
  $("#fab").onclick = toggle;
  $("#cx").onclick = toggle;
  $("#cf").onsubmit = (e) => { e.preventDefault(); const v = $("#ci").value.trim(); if (v) send(v); };
  setTimeout(() => $("#fablabel")?.remove(), 7000);
  paintSugg();
  if (chat.open) toggle(true);
}

function toggle(force) {
  chat.open = typeof force === "boolean" ? force : !chat.open;
  $("#panel").hidden = !chat.open;
  $("#fablabel")?.remove();
  if (chat.open) {
    if (!$("#msgs").children.length) addBubble("them", "Hi Angelo! I can answer product questions from our product sheets, and I can update leads and send emails for you. Try one of the suggestions below.");
    $("#ci").focus();
  }
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
function addAction(a) {
  const c = document.createElement("div");
  c.className = "actcard";
  c.innerHTML = `<b>${esc(a.title)}</b><div class="small muted">${esc(a.detail || "")}</div>
    ${a.email ? `<details style="margin-top:var(--space-xs)"><summary>View email</summary><div class="mail"><b>To:</b> ${esc(a.email.to)}\n<b>Subject:</b> ${esc(a.email.subject)}\n\n${esc(a.email.body)}</div></details>` : ""}`;
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
      if (ev.action) { clearTyping(); bubble = null; addAction(ev.action); ui.onChange?.(ev.action); }
    });
  } catch (e) {
    clearTyping(); addBubble("them", "Sorry, I couldn't reach the server. " + e.message);
  }
  clearTyping();
  if (all) chat.history.push({ role: "assistant", content: all });
  chat.busy = false; $("#cs").disabled = false; $("#ci")?.focus();
}

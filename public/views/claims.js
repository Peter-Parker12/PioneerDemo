import { $, esc, php, fmtDate, state, save, boot, api, fileToB64, fetchAsFile, toast, modal, scoreClass } from "/app.js";

const narrating = new Set();
const now = () => new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
const statusChip = (s) => {
  const c = /approved/i.test(s) ? "green" : /SIU|decline/i.test(s) ? "red" : /request|docs/i.test(s) ? "amber" : /new|ai/i.test(s) ? "blue" : "";
  return `<span class="chip ${c}">${esc(s)}</span>`;
};

// ============================ QUEUE ============================
export function renderQueue(root) {
  const mine = Object.values(state.claims).sort((a, b) => b.id.localeCompare(a.id));
  const seed = boot.data.queue;
  const open = seed.filter((c) => !/approved/i.test(c.status)).length + mine.filter((c) => !/approved/i.test(c.status)).length;
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Claims workbench</h1><div class="muted">Good morning, Maricar. Here is what is waiting for you today.</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn" id="try-receipt">Try your own receipt</button>
        <button class="btn primary" id="upload">＋ Upload claim</button>
      </div>
    </div>
    <div class="grid4" style="margin-bottom:16px">
      <div class="card kpi"><div class="v">${open}</div><div class="l">Open claims</div></div>
      <div class="card kpi"><div class="v">32 min → 4 min</div><div class="l">Manual vs. AI intake per claim</div><div class="d">-87% handling time</div></div>
      <div class="card kpi"><div class="v">${seed.filter((c) => /approved/i.test(c.status)).length + mine.filter((c) => /approved/i.test(c.status)).length + 3}</div><div class="l">Auto-triaged today</div></div>
      <div class="card kpi"><div class="v">${seed.filter((c) => c.score >= 60).length + mine.filter((c) => c.evaluation?.score >= 60).length}</div><div class="l">High fraud-risk flags</div></div>
    </div>
    <div class="card">
      <h2>Claims queue</h2>
      <table>
        <thead><tr><th>Claim</th><th>Claimant</th><th>Type</th><th>Amount</th><th>Received</th><th>Risk</th><th>Status</th><th>Assignee</th></tr></thead>
        <tbody>
          ${mine.map((c) => `<tr class="click new" data-open="${c.id}"><td><b>${c.id}</b> <span class="chip blue">New</span></td><td>${esc(c.claimant)}</td><td>${esc(c.type)}</td><td>${php(c.normalized.estimate_total)}</td><td>${fmtDate(c.received)}</td><td>${c.evaluation ? `<span class="score ${scoreClass(c.evaluation.score)}">${c.evaluation.score}</span>` : "-"}</td><td>${statusChip(c.status)}</td><td>M. Ocampo</td></tr>`).join("")}
          ${seed.map((c) => `<tr><td><b>${c.id}</b></td><td>${esc(c.claimant)}</td><td>${esc(c.type)}</td><td>${php(c.amount)}</td><td>${fmtDate(c.received)}</td><td><span class="score ${scoreClass(c.score)}">${c.score}</span></td><td>${statusChip(c.status)}</td><td>${esc(c.assignee)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h2>Coming next on the same engine</h2>
      <div class="tiles">
        <div class="tile"><b>Underwriting support</b><span class="muted small">Read applications, surveys and loss runs; pre-fill risk summaries and referral reasons.</span></div>
        <div class="tile"><b>Policy servicing</b><span class="muted small">Endorsements, renewals and cancellations drafted from customer emails and forms.</span></div>
        <div class="tile"><b>Subrogation and recovery</b><span class="muted small">Spot third-party recovery opportunities in settled claims.</span></div>
      </div>
    </div>`;
  root.querySelectorAll("[data-open]").forEach((tr) => (tr.onclick = () => (location.hash = "#/claims/" + tr.dataset.open)));
  $("#upload").onclick = openUpload;
  $("#try-receipt").onclick = () => openReceipt(null);
}

// ============================ UPLOAD + PROCESS ============================
function openUpload() {
  let files = [];
  let sample = false;
  const m = modal(`
    <div class="between"><h2>Upload claim documents</h2><button class="btn sm" id="x">Close</button></div>
    <p class="muted">Claimants send photos and PDFs through email or the app. Drop them here and the AI does the intake.</p>
    <div class="drop" id="drop"><b>Drag and drop files here</b><div class="muted small">PDF, JPG or PNG - or click to browse</div></div>
    <input type="file" id="pick" multiple accept="application/pdf,image/*" hidden>
    <div style="text-align:center;margin:12px 0" class="muted">or</div>
    <button class="btn amber" id="sample" style="width:100%;justify-content:center">Use sample claim pack: Dela Cruz motor collision (5 documents)</button>
    <ul class="filelist" id="list"></ul>
    <div id="steps"></div>
    <div class="between" style="margin-top:10px"><span class="muted small">Documents are processed by Claude. Sample data is fictional.</span><button class="btn primary" id="go" disabled>Process claim</button></div>`);
  const list = m.el.querySelector("#list"), go = m.el.querySelector("#go");
  const show = () => {
    list.innerHTML = files.map((f) => `<li>📄 ${esc(f.name)}</li>`).join("");
    go.disabled = !files.length;
  };
  const add = (fl) => { files = [...fl]; sample = false; show(); };
  m.el.querySelector("#x").onclick = m.close;
  const drop = m.el.querySelector("#drop"), pick = m.el.querySelector("#pick");
  drop.onclick = () => pick.click();
  pick.onchange = () => add(pick.files);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); add(e.dataTransfer.files); };
  m.el.querySelector("#sample").onclick = async () => {
    files = await Promise.all(boot.data.claimFiles.map((n) => fetchAsFile("/files/claim/" + n, n)));
    sample = true; show();
  };
  go.onclick = () => processClaim(m, files, sample);
}

async function processClaim(m, files, sample) {
  const steps = ["Reading documents", "Extracting claim data", "Applying approval rules", "Opening claim"];
  const box = m.el.querySelector("#steps");
  const paint = (i, err) => {
    box.innerHTML = `<ul class="steps">${steps.map((s, k) => `<li class="${k < i ? "done" : k === i ? "on" : ""}">${k < i ? "✓" : k === i ? (err ? "✕" : '<span class="spin"></span>') : "○"} ${s}${k === i && err ? ` - ${esc(err)}` : ""}</li>`).join("")}</ul>`;
  };
  m.el.querySelector("#go").disabled = true;
  const t0 = Date.now();
  let i = 0;
  try {
    paint(0);
    const payload = await Promise.all(files.map(fileToB64));
    paint((i = 1));
    const ex = await api("/claims/extract", { files: payload });
    paint((i = 2));
    const id = "CLM-2026-" + (1042 + Object.keys(state.claims).length);
    const claim = {
      id, claimant: ex.normalized.claimant_name || "Unknown claimant", type: "Motor - own damage",
      received: new Date().toISOString().slice(0, 10), status: "AI triaged - awaiting adjuster",
      normalized: ex.normalized, fields: ex.fields, documents: ex.documents,
      docFiles: files.map((f) => ({ name: f.name, url: sample ? "/files/claim/" + f.name : URL.createObjectURL(f) })),
      receipt: null, narrative: null, decision: null, ms: Date.now() - t0,
      audit: [{ t: now(), who: "AI", text: `Intake complete: ${files.length} documents read and classified in ${Math.round((Date.now() - t0) / 1000)}s` }],
    };
    claim.evaluation = await api("/claims/evaluate", { claim, rules: state.rules });
    claim.audit.push({ t: now(), who: "AI", text: `Rules applied: risk score ${claim.evaluation.score} (${claim.evaluation.band}), recommendation "${claim.evaluation.outcome}"` });
    state.claims[id] = claim; save();
    paint((i = 3));
    await new Promise((r) => setTimeout(r, 400));
    m.close();
    location.hash = "#/claims/" + id;
  } catch (e) {
    paint(i, e.message);
    m.el.querySelector("#go").disabled = false;
  }
}

// ============================ CLAIM DETAIL ============================
const gauge = (s) => {
  const c = 2 * Math.PI * 52, col = s >= 60 ? "#d3433b" : s >= 30 ? "#e0a21a" : "#1f9d63";
  return `<svg class="gauge" viewBox="0 0 130 130"><circle cx="65" cy="65" r="52" fill="none" stroke="#e7ebf2" stroke-width="12"/>
    <circle cx="65" cy="65" r="52" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c * s) / 100} ${c}" transform="rotate(-90 65 65)"/>
    <text x="65" y="64" text-anchor="middle" font-size="32" font-weight="800" fill="${col}">${s}</text><text x="65" y="84" text-anchor="middle" font-size="11" fill="#66738a">of 100</text></svg>`;
};

export function renderClaim(root, id, view = {}) {
  const c = state.claims[id];
  if (!c) { root.innerHTML = `<div class="card empty">Claim not found. <a href="#/claims">Back to queue</a></div>`; return; }
  const ev = c.evaluation, n = c.normalized;
  const reasons = Object.fromEntries((c.narrative?.flag_reasons || []).map((r) => [r.rule_id, r.reasoning]));
  const fired = ev.results.filter((r) => r.status === "fail");
  const docIdx = view.doc ?? 0;
  const doc = c.docFiles[docIdx];
  const recClass = ev.action === "approve" ? "green" : ev.action === "review" ? "amber" : "red";
  const dup = ev.results.find((r) => r.id === "R08" && r.matches);

  root.innerHTML = `
    <div class="page-head">
      <div><a href="#/claims" class="small">← Claims queue</a><h1>${c.id} · ${esc(c.claimant)}</h1>
        <div class="muted">${esc(c.type)} · ${esc(n.vehicle_model)} ${esc(n.plate_no)} · loss ${fmtDate(n.loss_date)} · ${esc(n.loss_location)}</div></div>
      <div style="display:flex;gap:8px;align-items:center">${statusChip(c.status)}<button class="btn" id="receipt">Try your own receipt</button><a class="btn" href="#/rules">Edit rules</a><button class="btn primary" id="rerun">↻ Re-run with current rules</button></div>
    </div>
    <div class="split">
      <div class="viewer card">
        <div class="tabs">${c.docFiles.map((d, i) => `<button class="tab ${i === docIdx ? "on" : ""}" data-doc="${i}">${esc(docLabel(c, d.name))}</button>`).join("")}</div>
        ${doc ? `<iframe src="${doc.url}#toolbar=0&navpanes=0" title="${esc(doc.name)}"></iframe>` : ""}
        <div class="quote" id="quote" ${view.quote ? "" : "hidden"}>${view.quote ? `Read from <b>${esc(view.quoteDoc)}</b>: “${esc(view.quote)}”` : ""}</div>
      </div>
      <div>
        <div class="card">
          <div class="gauge-wrap">
            ${gauge(ev.score)}
            <div style="flex:1">
              <div class="muted small">AI recommendation</div>
              <div style="font-size:20px;font-weight:700" class="chip-lg"><span class="chip ${recClass}" style="font-size:15px;padding:4px 12px">${esc(ev.outcome)}</span></div>
              <div class="muted small" style="margin:4px 0 8px">Fraud-risk band: <b>${ev.band}</b> · ${fired.length} rule${fired.length === 1 ? "" : "s"} fired · processed in ${Math.round((c.ms || 0) / 1000)}s</div>
              ${c.narrative ? `<div>${esc(c.narrative.summary)}</div>` : `<div class="skel" style="width:95%"></div><div class="skel" style="width:80%"></div><div class="skel" style="width:60%"></div>`}
            </div>
          </div>
          ${c.narrative ? `<div class="small muted" style="margin-top:10px"><b>Suggested next step:</b> ${esc(c.narrative.recommendation)}</div>` : ""}
        </div>

        <div class="card">
          <h2>Why this score</h2>
          ${fired.length ? fired.map((r) => `<div class="flag ${r.weight >= 20 || r.action === "escalate" || r.action === "decline" ? "red" : "amber"}">
            <div class="rid">${r.id}</div><div style="flex:1"><b>${esc(r.name)}</b> <span class="muted small">+${r.weight} pts → ${esc(r.action)}</span>
            <div class="small muted">${esc(r.detail)}</div>
            ${reasons[r.id] ? `<div style="margin-top:4px">${esc(reasons[r.id])}</div>` : c.narrative ? "" : `<div class="skel" style="width:70%"></div>`}</div></div>`).join("") : `<div class="muted">No rules fired. ${ev.fastTrack ? "This claim is eligible for fast-track approval." : ""}</div>`}
          <details style="margin-top:12px"><summary class="small muted" style="cursor:pointer">Rules that passed or did not apply (${ev.results.length - fired.length})</summary>
            ${ev.results.filter((r) => r.status !== "fail").map((r) => `<div class="check"><span class="dot ${r.status === "pass" ? "ok" : "na"}">${r.status === "pass" ? "✓" : "–"}</span><span><b>${r.id}</b> ${esc(r.name)} <span class="muted small">${esc(r.detail)}</span></span></div>`).join("")}
          </details>
        </div>

        ${dup ? `<div class="card"><h2>Similar claims found</h2>
          <table><thead><tr><th>Claim</th><th>Loss date</th><th>Damage</th><th>Shop</th><th>Amount</th><th>Status</th></tr></thead><tbody>
          <tr><td><b>${c.id}</b> (this)</td><td>${fmtDate(n.loss_date)}</td><td>${esc((n.damage_areas || []).join(", "))}</td><td>${esc(n.repair_shop)}</td><td>${php(n.estimate_total)}</td><td>New</td></tr>
          ${dup.matches.map((h) => `<tr><td><b>${h.id}</b></td><td>${fmtDate(h.loss_date)}</td><td>${esc(h.damage_areas.join(", "))}</td><td>${esc(h.shop)}</td><td>${php(h.amount)}</td><td>${esc(h.status)}</td></tr>`).join("")}
          </tbody></table>${dup.matches[0].note ? `<div class="small muted" style="margin-top:6px">Note on ${dup.matches[0].id}: ${esc(dup.matches[0].note)}</div>` : ""}</div>` : ""}

        <div class="card">
          <h2>Extracted data <span class="muted small">click a row to see where it was read</span></h2>
          <table class="fields"><tbody>
            ${c.fields.map((f, i) => `<tr class="click" data-field="${i}"><td>${esc(f.label)}</td><td><b>${esc(f.value)}</b></td><td style="width:90px;white-space:nowrap"><span class="conf"><i style="width:${Math.round(f.confidence * 100)}%;background:${f.confidence < 0.8 ? "#e0a21a" : "#1f9d63"}"></i></span><span class="small muted">${Math.round(f.confidence * 100)}%</span></td></tr>`).join("")}
          </tbody></table>
        </div>

        <div class="grid2">
          <div class="card"><h2>Document checklist</h2>
            ${ev.checklist.map((k) => `<div class="check"><span class="dot ${k.present ? "ok" : k.needed ? "no" : "na"}">${k.present ? "✓" : k.needed ? "✕" : "–"}</span>${esc(k.label)}${!k.needed ? ' <span class="muted small">(not needed)</span>' : ""}</div>`).join("")}
          </div>
          <div class="card"><h2>Receipt</h2>
            ${c.receipt ? `<div><b>${esc(c.receipt.vendor_name)}</b><div class="small muted">${esc(c.receipt.document_type || "Receipt")} ${esc(c.receipt.invoice_no)} · ${fmtDate(c.receipt.date)}</div><div style="font-size:20px;font-weight:700;margin:4px 0">${php(c.receipt.total)}</div>
              ${ev.results.find((r) => r.id === "R10")?.status === "fail" ? `<span class="chip red">Receipt check failed</span>` : `<span class="chip green">Matches estimate</span>`}
              <div class="small muted" style="margin-top:4px">${esc(ev.results.find((r) => r.id === "R10")?.detail || "")}</div></div>`
              : `<div class="muted">No receipt attached yet. Use “Try your own receipt” to read one and attach it.</div>`}
          </div>
        </div>

        <div class="card"><h2>Audit trail</h2><ul class="audit">${c.audit.map((a) => `<li><span class="muted small">${a.t}</span> <b>${esc(a.who)}</b> ${esc(a.text)}</li>`).join("")}</ul></div>

        <div class="actionbar">
          ${c.decision ? `<span>Decision recorded: <b>${esc(c.decision)}</b></span><span class="right"></span><button class="btn" id="reopen">Reopen</button>` : `
          <span class="muted small">AI recommends, the adjuster decides.</span><span class="right"></span>
          <button class="btn" id="docs">Request documents</button>
          <button class="btn danger" id="escalate">Escalate to SIU</button>
          <button class="btn ok" id="approve">Approve</button>`}
        </div>
      </div>
    </div>`;

  // viewer + fields
  root.querySelectorAll("[data-doc]").forEach((b) => (b.onclick = () => renderClaim(root, id, { doc: +b.dataset.doc })));
  root.querySelectorAll("[data-field]").forEach((tr) => (tr.onclick = () => {
    const f = c.fields[+tr.dataset.field];
    const di = Math.max(0, c.docFiles.findIndex((d) => d.name === f.source_doc));
    renderClaim(root, id, { doc: di, quote: f.source_quote, quoteDoc: f.source_doc });
  }));
  $("#receipt").onclick = () => openReceipt(id);
  $("#rerun").onclick = () => rerun(root, id, true);

  // decisions
  if (c.decision) $("#reopen").onclick = () => { c.decision = null; c.status = "AI triaged - awaiting adjuster"; c.audit.push({ t: now(), who: "M. Ocampo", text: "Reopened claim" }); save(); renderClaim(root, id, view); };
  else {
    $("#approve").onclick = () => decide(root, id, "Approved", "Approved", "approve");
    $("#escalate").onclick = () => decide(root, id, "Escalated to SIU", "Escalated to SIU", "escalate");
    $("#docs").onclick = () => decide(root, id, "Docs requested", "Documents requested", "docs");
  }

  // narrate once per evaluation
  if (!c.narrative && !narrating.has(id)) narrate(root, id);
}

function docLabel(c, name) {
  const d = c.documents.find((x) => x.filename === name);
  const t = { claim_form: "Claim form", or_cr: "OR/CR", drivers_license: "Driver's license", police_report: "Police report", repair_estimate: "Repair estimate" }[d?.doc_type];
  return t || name.replace(/^\d-/, "").replace(/\.\w+$/, "");
}

async function narrate(root, id) {
  const c = state.claims[id];
  narrating.add(id);
  const evaluation = c.evaluation;
  try {
    const narrative = await api("/claims/narrate", { claim: c, evaluation });
    if (c.evaluation !== evaluation) { narrating.delete(id); return renderClaim(root, id); } // rules changed meanwhile
    c.narrative = narrative;
    c.audit.push({ t: now(), who: "AI", text: "Assessment written for the adjuster" });
    save();
  } catch (e) { toast("AI assessment failed: " + e.message, true); }
  narrating.delete(id);
  if (location.hash === "#/claims/" + id) renderClaim(root, id);
}

export async function rerun(root, id, announce) {
  const c = state.claims[id];
  const prev = c.evaluation;
  try {
    c.evaluation = await api("/claims/evaluate", { claim: c, rules: state.rules });
    c.narrative = null;
    if (announce) {
      const ev = c.evaluation;
      c.audit.push({ t: now(), who: "M. Ocampo", text: `Re-ran with current rules: score ${prev.score} → ${ev.score}, recommendation "${prev.outcome}" → "${ev.outcome}"` });
      toast(`Score ${prev.score} → ${ev.score} · ${ev.outcome}`);
    }
    save();
    if (location.hash === "#/claims/" + id) renderClaim(root, id);
  } catch (e) { toast(e.message, true); }
}

function decide(root, id, status, label, kind) {
  const c = state.claims[id];
  const ev = c.evaluation;
  const missing = ev.checklist.filter((k) => k.needed && !k.present).map((k) => k.label);
  const prefill =
    kind === "escalate" ? `Referring to SIU. ${ev.results.filter((r) => r.status === "fail").map((r) => `${r.id}: ${r.detail}`).join(" | ")}`
    : kind === "docs" ? `Dear ${c.claimant},\n\nThank you for filing your claim ${c.id}. To continue processing it we still need: ${missing.length ? missing.join(", ") : "a clearer copy of your repair estimate and proof of payment"}.\n\nYou can reply to this message with photos or PDFs.\n\nPioneer Claims Team`
    : "Approved after review of documents and AI assessment.";
  const m = modal(`
    <h2>${kind === "escalate" ? "Escalate to SIU" : kind === "docs" ? "Request documents" : "Approve claim"}</h2>
    <p class="muted">${kind === "docs" ? "AI drafted this message to the claimant." : "Add a note for the audit trail."}</p>
    <textarea id="note" rows="${kind === "docs" ? 9 : 5}">${esc(prefill)}</textarea>
    ${kind === "approve" && ev.score >= 30 ? `<p class="chip amber" style="margin-top:10px">Heads up: risk score is ${ev.score}. Approving overrides the AI recommendation and is logged.</p>` : ""}
    <div class="between" style="margin-top:14px"><button class="btn" id="cancel">Cancel</button><button class="btn primary" id="confirm">${kind === "docs" ? "Send request" : "Confirm"}</button></div>`);
  m.el.querySelector("#cancel").onclick = m.close;
  m.el.querySelector("#confirm").onclick = () => {
    c.decision = label; c.status = status;
    c.audit.push({ t: now(), who: "M. Ocampo", text: `${label}. Note: ${m.el.querySelector("#note").value.slice(0, 160).replace(/\n/g, " ")}` });
    save(); m.close(); toast(`${c.id}: ${label}`); renderClaim(root, id);
  };
}

// ============================ RECEIPT ============================
export function openReceipt(claimId) {
  const targetId = claimId || Object.keys(state.claims).sort().pop() || null;
  let data = null;
  const m = modal(`
    <div class="between"><h2>Read a receipt</h2><button class="btn sm" id="x">Close</button></div>
    <p class="muted">Drop any receipt or invoice, any layout. The AI reads vendor, TIN, items and totals and checks it looks like a valid BIR receipt.</p>
    <div class="drop" id="drop"><b>Drop a receipt here</b><div class="muted small">PDF, JPG or PNG - or click to browse (try one from your phone)</div></div>
    <input type="file" id="pick" accept="application/pdf,image/*" hidden>
    <div class="chips"><span class="muted small" style="align-self:center">Samples:</span>
      ${boot.data.receiptFiles.map((f) => `<button data-sample="${f}">${esc(f.replace(/^receipt-|\.pdf$/g, "").replace(/-/g, " "))}</button>`).join("")}</div>
    <div id="out"></div>`, { wide: true });
  const out = m.el.querySelector("#out");
  m.el.querySelector("#x").onclick = m.close;
  const drop = m.el.querySelector("#drop"), pick = m.el.querySelector("#pick");
  drop.onclick = () => pick.click();
  pick.onchange = () => run(pick.files[0]);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); run(e.dataTransfer.files[0]); };
  m.el.querySelectorAll("[data-sample]").forEach((b) => (b.onclick = async () => run(await fetchAsFile("/files/receipts/" + b.dataset.sample, b.dataset.sample))));

  async function run(file) {
    if (!file) return;
    out.innerHTML = `<ul class="steps"><li class="on"><span class="spin"></span> Reading ${esc(file.name)}…</li></ul>`;
    try {
      data = await api("/receipts/extract", { file: await fileToB64(file) });
      paint();
    } catch (e) { out.innerHTML = `<div class="chip red">${esc(e.message)}</div>`; }
  }
  function paint() {
    const d = data;
    out.innerHTML = `
      ${!d.is_receipt ? `<div class="chip amber" style="margin:10px 0">This does not look like a receipt or invoice. Values below may be incomplete.</div>` : ""}
      <div class="grid2" style="margin-top:12px">
        <div>
          <h3>Extracted fields <span class="muted small">(editable)</span></h3>
          ${[["vendor_name", "Vendor"], ["vendor_tin", "TIN"], ["invoice_no", "Invoice / OR no."], ["date", "Date"], ["payment_method", "Payment"]].map(([k, l]) => `<label class="small muted">${l}</label><input type="text" data-k="${k}" value="${esc(d[k])}" style="margin-bottom:6px">`).join("")}
          <label class="small muted">Total (PHP)</label><input type="number" data-k="total" value="${d.total}">
          <div class="small muted" style="margin-top:6px">${esc(d.document_type)} · VAT ${php(d.vat)} · confidence ${Math.round((d.confidence || 0) * 100)}%</div>
        </div>
        <div>
          <h3>Line items</h3>
          <table><tbody>${d.line_items.map((l) => `<tr><td>${esc(l.description)}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${php(l.amount)}</td></tr>`).join("") || `<tr><td class="muted">None found</td></tr>`}</tbody></table>
          <h3 style="margin-top:12px">Validity checks</h3>
          ${d.checks.map((k) => `<div class="check"><span class="dot ${k.passed ? "ok" : "no"}">${k.passed ? "✓" : "✕"}</span><span>${esc(k.check)} <span class="muted small">${esc(k.note)}</span></span></div>`).join("")}
        </div>
      </div>
      <div class="between" style="margin-top:14px">
        <span class="muted small">${targetId ? `Attaching will update the checks on ${targetId}.` : "Process a claim first to attach a receipt to it."}</span>
        <button class="btn primary" id="attach" ${targetId ? "" : "disabled"}>Attach to ${targetId || "claim"}</button>
      </div>`;
    out.querySelectorAll("[data-k]").forEach((el) => (el.oninput = () => (data[el.dataset.k] = el.type === "number" ? Number(el.value) : el.value)));
    const attach = out.querySelector("#attach");
    if (attach) attach.onclick = async () => {
      const c = state.claims[targetId];
      c.receipt = data;
      c.audit.push({ t: now(), who: "M. Ocampo", text: `Attached receipt ${data.invoice_no || "(no number)"} from ${data.vendor_name} for ${php(data.total)}` });
      m.close();
      location.hash = "#/claims/" + targetId;
      await rerun($("#app"), targetId, false);
      toast("Receipt attached and rules re-checked");
    };
  }
}

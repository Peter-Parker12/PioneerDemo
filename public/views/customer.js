import { $, esc, php, fmtDate, api, fileToB64, toast, modal, sleep } from "/app.js";

// ---------- per-browser state (claims the demo customer has submitted) ----------
const KEY = "wfs_customer_v1";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const store = load();
if (!store.claims) store.claims = {};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };
const now = () => new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

const boot = { data: null };
export async function customerBoot() {
  if (!boot.data) boot.data = await api("/customer/bootstrap");
}

const STAGES = ["Submitted", "Documents checked", "Adjuster review", "Decision", "Payment"];
const STATUS = ["Submitted", "Documents checked", "Under review", "Approved", "Paid"];
const statusChip = (i) => `<span class="chip ${i >= 4 ? "green" : i === 3 ? "green" : i === 2 ? "amber" : "blue"}">${STATUS[Math.min(i, 4)]}</span>`;
const DOC_LABEL = { claim_form: "Claim form", or_cr: "OR/CR", drivers_license: "Driver's license", police_report: "Police report", repair_estimate: "Repair estimate" };
const docLabel = (documents, name) => DOC_LABEL[documents?.find((d) => d.filename === name)?.doc_type] || name.replace(/^\d-/, "").replace(/\.\w+$/, "");

const PAST = { id: "CLM-2026-0988", type: "Motor - windshield replacement", received: "2026-08-21", amount: 8400, stage: 5, past: true };

// ============================ HOME ============================
export function renderCustomerHome(root) {
  const p = boot.data.policy;
  const mine = Object.values(store.claims).sort((a, b) => b.id.localeCompare(a.id));
  root.innerHTML = `
    <div class="page-head"><div><h1>Hello, Ramon</h1><div class="muted">Your policy and your claims, in one place.</div></div></div>
    <div class="policy" style="margin-bottom:16px">
      <div class="policy-card">
        <div class="no">POLICY ${esc(p.policy_no)}</div>
        <h2>${esc(p.product.replace(" (illustrative)", ""))}</h2>
        <dl><div><dt>Vehicle</dt><dd>${esc(p.vehicle)}</dd></div><div><dt>Plate</dt><dd>${esc(p.plate_no)}</dd></div><div><dt>Valid until</dt><dd>${fmtDate(p.expiry)}</dd></div>
        <div><dt>Sum insured</dt><dd>${php(p.sum_insured)}</dd></div><div><dt>Premium</dt><dd>Paid</dd></div><div><dt>Status</dt><dd>Active</dd></div></dl>
      </div>
      <div class="cta"><h2 style="margin:0">Had an accident?</h2>
        <div class="muted">Upload your claim documents. We read them for you, check that nothing is missing, and send your claim straight to an adjuster.</div>
        <a class="btn brand lg" href="#/customer/new" style="justify-content:center">Submit a claim</a></div>
    </div>
    <div class="card"><h2>My claims</h2>
      <table><thead><tr><th>Claim</th><th>Type</th><th>Submitted</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        ${mine.map((c) => `<tr class="click" data-open="${c.id}"><td><b>${c.id}</b> <span class="chip brand">New</span></td><td>${esc(c.type)}</td><td>${fmtDate(c.received)}</td><td>${php(c.normalized.estimate_total)}</td><td>${statusChip(c.stage)}</td></tr>`).join("")}
        <tr><td><b>${PAST.id}</b></td><td>${PAST.type}</td><td>${fmtDate(PAST.received)}</td><td>${php(PAST.amount)}</td><td>${statusChip(4)}</td></tr>
      </tbody></table>
    </div>`;
  root.querySelectorAll("[data-open]").forEach((tr) => (tr.onclick = () => (location.hash = "#/customer/claim/" + tr.dataset.open)));
}

// ============================ SUBMIT A CLAIM ============================
const stepper = (n) => `<div class="stepper">${["1. Upload documents", "2. We read them", "3. Submitted"].map((s, i) => `<div class="${i + 1 < n ? "done" : i + 1 === n ? "on" : ""}">${s}</div>`).join("")}</div>`;

export function renderNewClaim(root) {
  let files = [], sample = false;

  const paintUpload = () => {
    root.innerHTML = `
      <div class="page-head"><div><a href="#/customer" class="small">← My account</a><h1>Submit a motor claim</h1><div class="muted">Add your documents and we do the data entry.</div></div></div>
      ${stepper(1)}
      <div class="grid2">
        <div class="card">
          <h2>Your documents</h2>
          <div class="drop" id="drop"><b>Drag and drop files here</b><div class="muted small">PDF, JPG or PNG, or click to browse</div></div>
          <input type="file" id="pick" multiple accept="application/pdf,image/*" hidden>
          <div class="muted" style="text-align:center;margin:12px 0">or</div>
          <button class="btn brand lg" id="sample" style="width:100%;justify-content:center">Use the sample claim pack (5 documents)</button>
          <ul class="filelist" id="list"></ul>
          <button class="btn primary lg" id="go" style="width:100%;justify-content:center" disabled>Read my documents</button>
        </div>
        <div class="card"><h2>What to include</h2>
          ${["Claim form", "LTO OR/CR", "Driver's license", "Police report (for collisions)", "Repair estimate from your shop"].map((d) => `<div class="check"><span class="dot ok">✓</span>${d}</div>`).join("")}
          <p class="muted small" style="margin-top:12px">Photos taken with your phone work too. After repairs, you can add your receipt to the claim.</p>
        </div>
      </div>`;
    const list = $("#list"), go = $("#go"), drop = $("#drop"), pick = $("#pick");
    const show = () => { list.innerHTML = files.map((f) => `<li>📄 ${esc(f.name)}</li>`).join(""); go.disabled = !files.length; };
    const add = (fl) => { files = [...fl]; sample = false; show(); };
    drop.onclick = () => pick.click();
    pick.onchange = () => add(pick.files);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); add(e.dataTransfer.files); };
    $("#sample").onclick = () => { files = boot.data.claimFiles.map((n) => ({ name: n })); sample = true; show(); go.focus(); };
    go.onclick = () => read();
  };

  async function read() {
    const names = files.map((f) => f.name);
    root.innerHTML = `
      <div class="page-head"><div><h1>Reading your documents</h1><div class="muted">This takes a few seconds.</div></div></div>
      ${stepper(2)}
      <div class="read">
        <div class="docs card">${names.map((n, i) => `<div class="doc" id="d${i}"><div class="ic">PDF</div><div><b>${esc(n)}</b></div><div class="st">Waiting</div></div>`).join("")}</div>
        <div class="card found"><h2>What we found</h2><div id="found"><div class="muted">Details appear here as each document is read.</div></div><div id="review"></div></div>
      </div>`;

    let result = null, error = null;
    (sample ? api("/claims/extract", { sample: "hero-claim" }) : Promise.all(files.map(fileToB64)).then((payload) => api("/claims/extract", { files: payload })))
      .then((r) => (result = r), (e) => (error = e));

    for (let i = 0; i < names.length && !error; i++) {
      const el = $("#d" + i);
      el.classList.add("scan"); el.querySelector(".st").innerHTML = '<span class="spin"></span> Reading';
      await sleep(sample ? 750 : 900);
      el.classList.remove("scan"); el.classList.add("done"); el.querySelector(".st").textContent = "Read ✓";
    }
    if (!result && !error) $("#found").innerHTML = '<div class="muted"><span class="spin"></span> Putting the details together…</div>';
    while (!result && !error) await sleep(150);
    if (error) return paintError(error);

    const found = $("#found");
    found.innerHTML = "";
    const gap = Math.min(120, 2600 / result.fields.length);
    for (const f of result.fields) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<div class="k">${esc(f.label)}</div><div class="v">${esc(f.value)}</div><span class="chip green" style="align-self:center">${Math.round(f.confidence * 100)}%</span>`;
      found.appendChild(row);
      await sleep(gap);
    }

    let check;
    try { check = await api("/claims/check", { claim: { normalized: result.normalized, documents: result.documents } }); }
    catch (e) { return paintError(e); }
    paintReview(result, check);
  }

  function paintError(e) {
    $("#found").innerHTML = `<div class="chip red" style="white-space:normal">${esc(e.message)}</div>
      <div class="chips" style="margin-top:12px"><button class="btn" id="again">Start over</button><button class="btn brand" id="usesample">Use the sample claim pack</button></div>`;
    $("#again").onclick = () => { files = []; paintUpload(); };
    $("#usesample").onclick = () => { files = boot.data.claimFiles.map((n) => ({ name: n })); sample = true; read(); };
  }

  function paintReview(result, check) {
    const missing = check.checklist.filter((k) => k.needed && !k.present);
    $("#review").innerHTML = `
      <div class="grid2" style="margin-top:16px">
        <div><h3>Document checklist</h3>${check.checklist.map((k) => `<div class="check"><span class="dot ${k.present ? "ok" : k.needed ? "no" : "na"}">${k.present ? "✓" : k.needed ? "✕" : "–"}</span>${esc(k.label)}</div>`).join("")}</div>
        <div><h3>Policy check</h3>
          <div class="check"><span class="dot ${check.inForce ? "ok" : "no"}">${check.inForce ? "✓" : "✕"}</span>${check.inForce ? "Your policy was active on the date of loss" : "We could not match an active policy"}</div>
          <div class="check"><span class="dot ok">✓</span>Repair estimate ${php(result.normalized.estimate_total)}</div></div>
      </div>
      ${missing.length ? `<div class="chip amber" style="white-space:normal;margin-top:12px">Still missing: ${missing.map((m) => esc(m.label)).join(", ")}. You can submit now and add them later.</div>` : `<div class="status-banner"><b>✓</b><span>Everything we need is here. Please check the details above, then submit.</span></div>`}
      <div class="between" style="margin-top:16px"><button class="btn" id="restart">Start over</button><button class="btn brand lg" id="submit">Submit claim</button></div>`;
    $("#restart").onclick = () => { files = []; paintUpload(); };
    $("#submit").onclick = async () => {
      const idNum = 1042 + Object.keys(store.claims).length;
      const id = "CLM-2026-" + idNum;
      const docFiles = files.map((f) => ({ name: f.name, url: sample ? "/files/claim/" + f.name : f instanceof File ? URL.createObjectURL(f) : "" }));
      store.claims[id] = {
        id, type: "Motor - own damage", received: new Date().toISOString().slice(0, 10), stage: 2,
        normalized: result.normalized, fields: result.fields, documents: result.documents, docFiles, checklist: check.checklist, receipt: null,
        log: [
          { t: now(), text: "Claim received. Reference " + id + "." },
          { t: now(), text: `${files.length} documents read and checked automatically.` },
          { t: now(), text: "Assigned to a claims officer. Complete documents are decided within 10 working days." },
        ],
      };
      save();
      toast("Claim submitted: " + id);
      location.hash = "#/customer/claim/" + id;
    };
  }

  paintUpload();
}

// ============================ CLAIM DETAIL ============================
export function renderClaim(root, id, view = {}) {
  const c = store.claims[id];
  if (!c) { root.innerHTML = `<div class="card empty">Claim not found. <a href="#/customer">Back to my account</a></div>`; return; }
  const n = c.normalized;
  const docIdx = view.doc ?? 0;
  const doc = c.docFiles[docIdx];
  const est = n.estimate_total;
  root.innerHTML = `
    <div class="page-head">
      <div><a href="#/customer" class="small">← My account</a><h1>${c.id}</h1>
        <div class="muted">${esc(c.type)} · ${esc(n.vehicle_model)} ${esc(n.plate_no)} · loss on ${fmtDate(n.loss_date)}</div></div>
      <div>${statusChip(c.stage)}</div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="timeline">${STAGES.map((s, i) => `<div class="s ${i < c.stage ? "done" : i === c.stage ? "cur" : ""}"><div class="b">${i < c.stage ? "✓" : i + 1}</div>${s}</div>`).join("")}</div>
      <div class="between" style="margin-top:10px"><span class="muted small">${c.stage >= 4 ? "Your claim is settled." : c.stage === 3 ? "Approved. Payment is released within 3 working days." : "A claims officer is reviewing your claim. Complete documents are decided within 10 working days."}</span>
        ${c.stage < 4 ? `<button class="btn sm" id="advance" title="Demo control">Demo: move to next step</button>` : ""}</div>
    </div>
    <div class="split">
      <div class="viewer card">
        <div class="tabs">${c.docFiles.map((d, i) => `<button class="tab ${i === docIdx ? "on" : ""}" data-doc="${i}">${esc(docLabel(c.documents, d.name))}</button>`).join("")}</div>
        ${doc?.url ? `<iframe src="${doc.url}#toolbar=0&navpanes=0" title="${esc(doc.name)}"></iframe>` : `<div class="empty">Preview is not available for this file after a page reload.</div>`}
        <div class="quote" ${view.quote ? "" : "hidden"}>${view.quote ? `Read from <b>${esc(view.quoteDoc)}</b>: “${esc(view.quote)}”` : ""}</div>
      </div>
      <div>
        <div class="card"><h2>Details we read <span class="muted small">click a row to see where it came from</span></h2>
          <table class="fields"><tbody>${c.fields.map((f, i) => `<tr class="click" data-field="${i}"><td>${esc(f.label)}</td><td><b>${esc(f.value)}</b></td><td style="width:90px;white-space:nowrap"><span class="conf"><i style="width:${Math.round(f.confidence * 100)}%"></i></span><span class="small muted">${Math.round(f.confidence * 100)}%</span></td></tr>`).join("")}</tbody></table></div>
        <div class="grid2" style="margin-top:16px">
          <div class="card"><h2>Document checklist</h2>${c.checklist.map((k) => `<div class="check"><span class="dot ${k.present ? "ok" : k.needed ? "no" : "na"}">${k.present ? "✓" : k.needed ? "✕" : "–"}</span>${esc(k.label)}</div>`).join("")}</div>
          <div class="card"><h2>Repair receipt</h2>${receiptCard(c)}</div>
        </div>
        <div class="card"><h2>Updates</h2><ul class="msglog">${c.log.map((l) => `<li><span class="muted small">${l.t}</span> ${esc(l.text)}</li>`).join("")}</ul></div>
      </div>
    </div>`;
  root.querySelectorAll("[data-doc]").forEach((b) => (b.onclick = () => renderClaim(root, id, { doc: +b.dataset.doc })));
  root.querySelectorAll("[data-field]").forEach((tr) => (tr.onclick = () => {
    const f = c.fields[+tr.dataset.field];
    renderClaim(root, id, { doc: Math.max(0, c.docFiles.findIndex((d) => d.name === f.source_doc)), quote: f.source_quote, quoteDoc: f.source_doc });
  }));
  $("#advance")?.addEventListener("click", () => {
    c.stage = Math.min(4, c.stage + 1);
    c.log.unshift({ t: now(), text: ["", "", "", "Your claim was approved. Payment is released within 3 working days.", "Payment sent to your account. Your claim is closed."][c.stage] });
    save(); renderClaim(root, id, view);
  });
  $("#addreceipt")?.addEventListener("click", () => openReceipt(id, root));
}

function receiptCard(c) {
  const r = c.receipt;
  if (!r) return `<div class="muted">Add the receipt from your repair shop to speed up payment.</div><button class="btn brand" id="addreceipt" style="margin-top:10px">Add a receipt</button>`;
  const est = c.normalized.estimate_total;
  const dev = est ? Math.round((Math.abs(r.total - est) / est) * 100) : 0;
  return `<b>${esc(r.vendor_name)}</b><div class="small muted">${esc(r.document_type)} ${esc(r.invoice_no)} · ${fmtDate(r.date)}</div>
    <div style="font-size:20px;font-weight:700;margin:4px 0">${php(r.total)}</div>
    ${dev <= 5 ? '<span class="chip green">Matches your repair estimate</span>' : `<span class="chip amber">${dev}% different from your estimate</span>`}
    <div><button class="btn sm" id="addreceipt" style="margin-top:10px">Replace receipt</button></div>`;
}

// ============================ RECEIPT READER ============================
function openReceipt(claimId, root) {
  const c = store.claims[claimId];
  let data = null;
  const m = modal(`
    <div class="between"><h2>Add your receipt</h2><button class="btn sm" id="x">Close</button></div>
    <p class="muted">Drop a photo or PDF of your repair receipt. We read the vendor, TIN, items and total and check that it looks like a valid receipt.</p>
    <div class="drop" id="drop"><b>Drop a receipt here</b><div class="muted small">PDF, JPG or PNG, or click to browse (phone photos work)</div></div>
    <input type="file" id="pick" accept="application/pdf,image/*" hidden>
    <div class="chips"><span class="muted small" style="align-self:center">Samples:</span>
      ${boot.data.receiptFiles.map((f) => `<button data-sample="${f}">${esc(f.replace(/^receipt-|\.pdf$/g, "").replace(/-/g, " "))}</button>`).join("")}</div>
    <div id="out"></div>`, { wide: true });
  const out = m.el.querySelector("#out");
  m.el.querySelector("#x").onclick = m.close;
  const drop = m.el.querySelector("#drop"), pick = m.el.querySelector("#pick");
  drop.onclick = () => pick.click();
  pick.onchange = () => run({ file: pick.files[0] });
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); run({ file: e.dataTransfer.files[0] }); };
  m.el.querySelectorAll("[data-sample]").forEach((b) => (b.onclick = () => run({ sample: b.dataset.sample })));

  async function run({ file, sample }) {
    if (!file && !sample) return;
    const name = sample || file.name;
    out.innerHTML = `<div class="scanbox go"><div class="muted"><span class="spin"></span> Reading ${esc(name)}…</div></div>`;
    try {
      const req = sample ? api("/receipts/extract", { sample }) : fileToB64(file).then((f) => api("/receipts/extract", { file: f }));
      const [res] = await Promise.all([req, sleep(sample ? 1600 : 0)]);
      data = res;
      paint();
    } catch (e) { out.innerHTML = `<div class="chip red" style="white-space:normal;margin-top:12px">${esc(e.message)}</div>`; }
  }
  function paint() {
    const d = data, est = c.normalized.estimate_total;
    const dev = est ? Math.round((Math.abs(d.total - est) / est) * 100) : 0;
    out.innerHTML = `
      ${!d.is_receipt ? `<div class="chip amber" style="margin:10px 0;white-space:normal">This does not look like a receipt or invoice. Values below may be incomplete.</div>` : ""}
      <div class="grid2" style="margin-top:12px">
        <div class="found">
          <h3>What we read</h3>
          ${[["Vendor", d.vendor_name], ["TIN", d.vendor_tin], ["Invoice / OR no.", d.invoice_no], ["Date", fmtDate(d.date)], ["Payment", d.payment_method], ["Total", php(d.total)]].map(([k, v]) => `<div class="row"><div class="k">${k}</div><div class="v">${esc(v || "-")}</div></div>`).join("")}
          <div class="small muted" style="margin-top:6px">${esc(d.document_type)} · VAT ${php(d.vat)} · confidence ${Math.round((d.confidence || 0) * 100)}%</div>
        </div>
        <div>
          <h3>Line items</h3>
          <table><tbody>${d.line_items.map((l) => `<tr><td>${esc(l.description)}</td><td style="text-align:right">${php(l.amount)}</td></tr>`).join("") || `<tr><td class="muted">None found</td></tr>`}</tbody></table>
          <h3 style="margin-top:12px">Checks</h3>
          ${d.checks.map((k) => `<div class="check"><span class="dot ${k.passed ? "ok" : "no"}">${k.passed ? "✓" : "✕"}</span><span>${esc(k.check)} <span class="muted small">${esc(k.note)}</span></span></div>`).join("")}
          <div class="check"><span class="dot ${dev <= 5 ? "ok" : "no"}">${dev <= 5 ? "✓" : "!"}</span><span>${dev <= 5 ? `Matches your repair estimate (${php(est)})` : `Total differs from your estimate (${php(est)}) by ${dev}%`}</span></div>
        </div>
      </div>
      <div class="between" style="margin-top:14px"><span class="muted small">${esc(d.notes || "")}</span><button class="btn brand" id="attach">Attach to ${claimId}</button></div>`;
    out.querySelector("#attach").onclick = () => {
      c.receipt = d;
      c.log.unshift({ t: now(), text: `Receipt ${d.invoice_no || ""} from ${d.vendor_name} for ${php(d.total)} added.` });
      save(); m.close(); renderClaim(root, claimId); toast("Receipt added to your claim");
    };
  }
}

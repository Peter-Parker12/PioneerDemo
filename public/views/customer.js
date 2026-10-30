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
const statusChip = (i) => `<span class="chip ${i >= 3 ? "green" : i === 2 ? "amber" : ""}">${STATUS[Math.min(i, 4)]}</span>`;
const DOC_LABEL = { claim_form: "Claim form", or_cr: "OR/CR", drivers_license: "Driver's license", police_report: "Police report", repair_estimate: "Repair estimate" };
const docLabel = (documents, name) => DOC_LABEL[documents?.find((d) => d.filename === name)?.doc_type] || name.replace(/^\d-/, "").replace(/\.\w+$/, "");
const mark = (ok, yes = "Present", no = "Missing", na = "Not needed") =>
  `<span class="status ${ok === true ? "good" : ok === false ? "bad" : "off"}">${ok === true ? yes : ok === false ? no : na}</span>`;
const checkRow = (label, ok, yes, no, na) => `<div class="list-row"><span>${esc(label)}</span>${mark(ok, yes, no, na)}</div>`;

const PAST = { id: "CLM-2026-0988", type: "Motor, windshield replacement", received: "2026-08-21", amount: 8400, stage: 4 };

// ============================ HOME ============================
export function renderCustomerHome(root) {
  const p = boot.data.policy;
  const mine = Object.values(store.claims).sort((a, b) => b.id.localeCompare(a.id));
  root.innerHTML = `
    <div class="page-head"><div><h1>Hello, Ramon</h1><div class="muted">Your policy and your claims, in one place.</div></div></div>
    <div class="policy">
      <div class="sheet">
        <div class="no">Policy ${esc(p.policy_no)}</div>
        <h2 style="margin:var(--space-2xs) 0 0">${esc(p.product.replace(" (illustrative)", ""))}</h2>
        <dl><div><dt>Vehicle</dt><dd>${esc(p.vehicle)}</dd></div><div><dt>Plate</dt><dd>${esc(p.plate_no)}</dd></div><div><dt>Valid until</dt><dd>${fmtDate(p.expiry)}</dd></div>
        <div><dt>Sum insured</dt><dd class="fig">${php(p.sum_insured)}</dd></div><div><dt>Premium</dt><dd>Paid</dd></div><div><dt>Status</dt><dd>Active</dd></div></dl>
      </div>
      <div class="cta"><h2>Had an accident?</h2>
        <p>Upload your claim documents. We read them for you, check that nothing is missing, and send your claim to an adjuster.</p>
        <a class="btn primary lg" href="#/customer/new">Submit a claim</a></div>
    </div>
    <div class="section"><h2>My claims</h2>
      <table><thead><tr><th>Claim</th><th>Type</th><th>Submitted</th><th class="fig">Amount</th><th>Status</th></tr></thead><tbody>
        ${mine.map((c) => `<tr class="click" tabindex="0" data-open="${c.id}"><td><b>${c.id}</b> <span class="chip">New</span></td><td>${esc(c.type)}</td><td>${fmtDate(c.received)}</td><td class="fig">${php(c.normalized.estimate_total)}</td><td>${statusChip(c.stage)}</td></tr>`).join("")}
        <tr><td><b>${PAST.id}</b></td><td>${PAST.type}</td><td>${fmtDate(PAST.received)}</td><td class="fig">${php(PAST.amount)}</td><td>${statusChip(PAST.stage)}</td></tr>
      </tbody></table>
    </div>`;
  root.querySelectorAll("[data-open]").forEach((tr) => {
    const go = () => (location.hash = "#/customer/claim/" + tr.dataset.open);
    tr.onclick = go;
    tr.onkeydown = (e) => { if (e.key === "Enter") go(); };
  });
}

// ============================ SUBMIT A CLAIM ============================
const stepper = (n) => `<div class="stepper">${["1. Upload documents", "2. We read them", "3. Submitted"].map((s, i) => `<div class="${i + 1 < n ? "done" : i + 1 === n ? "on" : ""}">${s}</div>`).join("")}</div>`;

export function renderNewClaim(root) {
  let files = [], sample = false;

  const paintUpload = () => {
    root.innerHTML = `
      <div class="page-head"><div><a href="#/customer" class="back">Back to my account</a><h1>Submit a motor claim</h1><div class="muted">Add your documents and we do the data entry.</div></div></div>
      ${stepper(1)}
      <div class="grid2">
        <div class="sheet">
          <h2>Your documents</h2>
          <div class="drop" id="drop" tabindex="0" role="button"><b>Drag and drop files here</b><div class="muted small">PDF, JPG or PNG, or click to browse</div></div>
          <input type="file" id="pick" multiple accept="application/pdf,image/*" hidden>
          <div class="muted" style="text-align:center;margin:var(--space-sm) 0">or</div>
          <button class="btn lg full" id="sample">Use the sample claim pack (5 documents)</button>
          <ul class="filelist" id="list"></ul>
          <button class="btn primary lg full" id="go" disabled>Read my documents</button>
        </div>
        <div><h2>What to include</h2>
          ${["Claim form", "LTO OR/CR", "Driver's license", "Police report (for collisions)", "Repair estimate from your shop"].map((d) => `<div class="list-row"><span>${d}</span></div>`).join("")}
          <p class="muted small" style="margin-top:var(--space-sm)">Photos taken with your phone work too. After repairs, you can add your receipt to the claim.</p>
        </div>
      </div>`;
    const list = $("#list"), go = $("#go"), drop = $("#drop"), pick = $("#pick");
    const show = () => { list.innerHTML = files.map((f) => `<li>${esc(f.name)}</li>`).join(""); go.disabled = !files.length; };
    const add = (fl) => { files = [...fl]; sample = false; show(); };
    drop.onclick = () => pick.click();
    drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick.click(); } };
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
        <div class="docs">${names.map((n, i) => `<div class="doc" id="d${i}"><b>${esc(n)}</b><div class="st">Waiting</div></div>`).join("")}</div>
        <div class="found" aria-live="polite"><h2>What we found</h2><div id="found"><div class="muted">Details appear here as each document is read.</div></div><div id="review"></div></div>
      </div>`;

    let result = null, error = null;
    (sample ? api("/claims/extract", { sample: "hero-claim" }) : Promise.all(files.map(fileToB64)).then((payload) => api("/claims/extract", { files: payload })))
      .then((r) => (result = r), (e) => (error = e));

    for (let i = 0; i < names.length && !error; i++) {
      const el = $("#d" + i);
      el.classList.add("scan"); el.querySelector(".st").innerHTML = '<span class="spin"></span> Reading';
      await sleep(sample ? 750 : 900);
      el.classList.remove("scan"); el.classList.add("done"); el.querySelector(".st").textContent = "Read";
    }
    if (!result && !error) $("#found").innerHTML = '<div class="muted"><span class="spin"></span> Putting the details together</div>';
    while (!result && !error) await sleep(150);
    if (error) return paintError(error);

    const found = $("#found");
    found.innerHTML = "";
    const gap = Math.min(120, 2600 / result.fields.length);
    for (const f of result.fields) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<div class="k">${esc(f.label)}</div><div class="v">${esc(f.value)}</div><span class="conf">${Math.round(f.confidence * 100)}%</span>`;
      found.appendChild(row);
      await sleep(gap);
    }

    let check;
    try { check = await api("/claims/check", { claim: { normalized: result.normalized, documents: result.documents } }); }
    catch (e) { return paintError(e); }
    paintReview(result, check);
  }

  function paintError(e) {
    $("#found").innerHTML = `<div class="note warn" role="alert">${esc(e.message)}</div>
      <div class="chips" style="margin-top:var(--space-sm)"><button class="btn" id="again">Start over</button><button class="btn primary" id="usesample">Use the sample claim pack</button></div>`;
    $("#again").onclick = () => { files = []; paintUpload(); };
    $("#usesample").onclick = () => { files = boot.data.claimFiles.map((n) => ({ name: n })); sample = true; read(); };
  }

  function paintReview(result, check) {
    const missing = check.checklist.filter((k) => k.needed && !k.present);
    $("#review").innerHTML = `
      <div class="grid2 section">
        <div><h3>Document checklist</h3>${check.checklist.map((k) => checkRow(k.label, k.present ? true : k.needed ? false : null)).join("")}</div>
        <div><h3>Policy check</h3>
          ${checkRow(check.inForce ? "Your policy was active on the date of loss" : "We could not match an active policy", check.inForce, "Yes", "No")}
          <div class="list-row"><span>Repair estimate</span><span class="fig">${php(result.normalized.estimate_total)}</span></div></div>
      </div>
      ${missing.length ? `<div class="note warn" style="margin-top:var(--space-md)">Still missing: ${missing.map((m) => esc(m.label)).join(", ")}. You can submit now and add them later.</div>` : `<div class="note ok" style="margin-top:var(--space-md)">Everything we need is here. Please check the details above, then submit.</div>`}
      <div class="between" style="margin-top:var(--space-md)"><button class="btn" id="restart">Start over</button><button class="btn primary lg" id="submit">Submit claim</button></div>`;
    $("#restart").onclick = () => { files = []; paintUpload(); };
    $("#submit").onclick = async () => {
      const idNum = 1042 + Object.keys(store.claims).length;
      const id = "CLM-2026-" + idNum;
      const docFiles = files.map((f) => ({ name: f.name, url: sample ? "/files/claim/" + f.name : f instanceof File ? URL.createObjectURL(f) : "" }));
      store.claims[id] = {
        id, type: "Motor, own damage", received: new Date().toISOString().slice(0, 10), stage: 2,
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
  if (!c) { root.innerHTML = `<div class="empty">Claim not found. <a href="#/customer">Back to my account</a></div>`; return; }
  const n = c.normalized;
  const docIdx = view.doc ?? 0;
  const doc = c.docFiles[docIdx];
  root.innerHTML = `
    <div class="page-head">
      <div><a href="#/customer" class="back">Back to my account</a><h1>${c.id}</h1>
        <div class="muted">${esc(c.type)}, ${esc(n.vehicle_model)} ${esc(n.plate_no)}, loss on ${fmtDate(n.loss_date)}</div></div>
      <div>${statusChip(c.stage)}</div>
    </div>
    <div class="section" style="margin-top:0">
      <ol class="timeline" aria-label="Claim progress">${STAGES.map((s, i) => `<li class="${i < c.stage ? "done" : i === c.stage ? "cur" : ""}">${s}<small>${i < c.stage ? "Done" : i === c.stage ? "In progress" : "Next"}</small></li>`).join("")}</ol>
      <div class="between" style="margin-top:var(--space-sm)"><span class="muted small">${c.stage >= 4 ? "Your claim is settled." : c.stage === 3 ? "Approved. Payment is released within 3 working days." : "A claims officer is reviewing your claim. Complete documents are decided within 10 working days."}</span>
        ${c.stage < 4 ? `<button class="btn sm" id="advance" title="Demo control">Demo: move to next step</button>` : ""}</div>
    </div>
    <div class="split section">
      <div class="viewer">
        <div class="tabs">${c.docFiles.map((d, i) => `<button class="tab ${i === docIdx ? "on" : ""}" data-doc="${i}">${esc(docLabel(c.documents, d.name))}</button>`).join("")}</div>
        ${doc?.url ? `<iframe src="${doc.url}#toolbar=0&navpanes=0" title="${esc(doc.name)}"></iframe>` : `<div class="empty">Preview is not available for this file after a page reload.</div>`}
        <div class="quote" ${view.quote ? "" : "hidden"}>${view.quote ? `Read from <b>${esc(view.quoteDoc)}</b>: “${esc(view.quote)}”` : ""}</div>
      </div>
      <div>
        <h2>Details we read <span class="muted small">Click a row to see where it came from.</span></h2>
        <table class="fields"><tbody>${c.fields.map((f, i) => `<tr class="click" tabindex="0" data-field="${i}"><td>${esc(f.label)}</td><td><b>${esc(f.value)}</b></td><td class="conf">${Math.round(f.confidence * 100)}%</td></tr>`).join("")}</tbody></table>
        <div class="grid2 section">
          <div><h2>Document checklist</h2>${c.checklist.map((k) => checkRow(k.label, k.present ? true : k.needed ? false : null)).join("")}</div>
          <div><h2>Repair receipt</h2>${receiptCard(c)}</div>
        </div>
        <div class="section"><h2>Updates</h2><ul class="msglog">${c.log.map((l) => `<li><span class="muted small">${l.t}</span> ${esc(l.text)}</li>`).join("")}</ul></div>
      </div>
    </div>`;
  root.querySelectorAll("[data-doc]").forEach((b) => (b.onclick = () => renderClaim(root, id, { doc: +b.dataset.doc })));
  root.querySelectorAll("[data-field]").forEach((tr) => {
    const go = () => {
      const f = c.fields[+tr.dataset.field];
      renderClaim(root, id, { doc: Math.max(0, c.docFiles.findIndex((d) => d.name === f.source_doc)), quote: f.source_quote, quoteDoc: f.source_doc });
    };
    tr.onclick = go;
    tr.onkeydown = (e) => { if (e.key === "Enter") go(); };
  });
  $("#advance")?.addEventListener("click", () => {
    c.stage = Math.min(4, c.stage + 1);
    c.log.unshift({ t: now(), text: ["", "", "", "Your claim was approved. Payment is released within 3 working days.", "Payment sent to your account. Your claim is closed."][c.stage] });
    save(); renderClaim(root, id, view);
  });
  $("#addreceipt")?.addEventListener("click", () => openReceipt(id, root));
}

function receiptCard(c) {
  const r = c.receipt;
  if (!r) return `<div class="muted">Add the receipt from your repair shop to speed up payment.</div><button class="btn primary" id="addreceipt" style="margin-top:var(--space-sm)">Add a receipt</button>`;
  const est = c.normalized.estimate_total;
  const dev = est ? Math.round((Math.abs(r.total - est) / est) * 100) : 0;
  return `<b>${esc(r.vendor_name)}</b><div class="small muted">${esc(r.document_type)} ${esc(r.invoice_no)}, ${fmtDate(r.date)}</div>
    <div class="fig" style="font-size:var(--text-xl);margin:var(--space-2xs) 0">${php(r.total)}</div>
    ${dev <= 5 ? '<span class="chip green">Matches your repair estimate</span>' : `<span class="chip red">${dev}% different from your estimate</span>`}
    <div><button class="btn sm" id="addreceipt" style="margin-top:var(--space-sm)">Replace receipt</button></div>`;
}

// ============================ RECEIPT READER ============================
function openReceipt(claimId, root) {
  const c = store.claims[claimId];
  let data = null;
  const m = modal(`
    <div class="between"><h2 style="margin:0">Add your receipt</h2><button class="btn sm" id="x">Close</button></div>
    <p class="muted" style="margin:var(--space-xs) 0 var(--space-md)">Drop a photo or PDF of your repair receipt. We read the vendor, TIN, items and total and check that it looks like a valid receipt.</p>
    <div class="drop" id="drop" tabindex="0" role="button"><b>Drop a receipt here</b><div class="muted small">PDF, JPG or PNG, or click to browse (phone photos work)</div></div>
    <input type="file" id="pick" accept="application/pdf,image/*" hidden>
    <div class="chips"><span class="muted small">Samples:</span>
      ${boot.data.receiptFiles.map((f) => `<button data-sample="${f}">${esc(f.replace(/^receipt-|\.pdf$/g, "").replace(/-/g, " "))}</button>`).join("")}</div>
    <div id="out"></div>`, { wide: true });
  const out = m.el.querySelector("#out");
  m.el.querySelector("#x").onclick = m.close;
  const drop = m.el.querySelector("#drop"), pick = m.el.querySelector("#pick");
  drop.onclick = () => pick.click();
  drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick.click(); } };
  pick.onchange = () => run({ file: pick.files[0] });
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); run({ file: e.dataTransfer.files[0] }); };
  m.el.querySelectorAll("[data-sample]").forEach((b) => (b.onclick = () => run({ sample: b.dataset.sample })));

  async function run({ file, sample }) {
    if (!file && !sample) return;
    const name = sample || file.name;
    out.innerHTML = `<div class="scanbox go"><div class="muted"><span class="spin"></span> Reading ${esc(name)}</div></div>`;
    try {
      const req = sample ? api("/receipts/extract", { sample }) : fileToB64(file).then((f) => api("/receipts/extract", { file: f }));
      const [res] = await Promise.all([req, sleep(sample ? 1600 : 0)]);
      data = res;
      paint();
    } catch (e) { out.innerHTML = `<div class="note warn" style="margin-top:var(--space-md)" role="alert">${esc(e.message)}</div>`; }
  }
  function paint() {
    const d = data, est = c.normalized.estimate_total;
    const dev = est ? Math.round((Math.abs(d.total - est) / est) * 100) : 0;
    out.innerHTML = `
      ${!d.is_receipt ? `<div class="note warn" style="margin:var(--space-sm) 0">This does not look like a receipt or invoice. Values below may be incomplete.</div>` : ""}
      <div class="grid2 section">
        <div class="found">
          <h3>What we read</h3>
          ${[["Vendor", d.vendor_name], ["TIN", d.vendor_tin], ["Invoice or OR no.", d.invoice_no], ["Date", fmtDate(d.date)], ["Payment", d.payment_method], ["Total", php(d.total)]].map(([k, v]) => `<div class="row"><div class="k">${k}</div><div class="v">${esc(v || "-")}</div></div>`).join("")}
          <div class="small muted" style="margin-top:var(--space-xs)">${esc(d.document_type)}, VAT ${php(d.vat)}, confidence ${Math.round((d.confidence || 0) * 100)}%</div>
        </div>
        <div>
          <h3>Line items</h3>
          <table><tbody>${d.line_items.map((l) => `<tr><td>${esc(l.description)}</td><td class="fig">${php(l.amount)}</td></tr>`).join("") || `<tr><td class="muted">None found</td></tr>`}</tbody></table>
          <h3 style="margin-top:var(--space-md)">Checks</h3>
          ${d.checks.map((k) => `<div class="list-row"><span>${esc(k.check)} <span class="muted small">${esc(k.note)}</span></span>${mark(k.passed, "Pass", "Fail")}</div>`).join("")}
          <div class="list-row"><span>${dev <= 5 ? `Matches your repair estimate (${php(est)})` : `Total differs from your estimate (${php(est)}) by ${dev}%`}</span>${mark(dev <= 5, "Pass", "Check")}</div>
        </div>
      </div>
      <div class="between" style="margin-top:var(--space-md)"><span class="muted small">${esc(d.notes || "")}</span><button class="btn primary" id="attach">Attach to ${claimId}</button></div>`;
    out.querySelector("#attach").onclick = () => {
      c.receipt = d;
      c.log.unshift({ t: now(), text: `Receipt ${d.invoice_no || ""} from ${d.vendor_name} for ${php(d.total)} added.` });
      save(); m.close(); renderClaim(root, claimId); toast("Receipt added to your claim");
    };
  }
}

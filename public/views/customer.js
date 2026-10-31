import { $, esc, php, fmtDate, api, fileToB64, toast, modal, sleep } from "/app.js";

// Claims live on the server so the claim executive and manager see what the customer submits.
let freshId = null; // set right after a submission so the claim page shows its confirmation banner once

const boot = { data: null };
export async function customerBoot() {
  if (!boot.data) boot.data = await api("/customer/bootstrap");
}

const STAGES = ["Submitted", "Documents checked", "Adjuster review", "Decision", "Payment"];
const STATUS = ["Submitted", "Documents checked", "Under review", "Approved", "Paid"];
const statusChip = (c) => `<span class="chip ${c.label === "Declined" ? "red" : c.stage >= 3 ? "green" : c.stage === 2 ? "amber" : "blue"}">${esc(c.label || STATUS[Math.min(c.stage, 4)])}</span>`;
const DOC_LABEL = { claim_form: "Claim form", or_cr: "OR/CR", drivers_license: "Driver's license", police_report: "Police report", repair_estimate: "Repair estimate" };
const docLabel = (documents, name, slot) => slot ||  DOC_LABEL[documents?.find((d) => d.filename === name)?.doc_type] || name.replace(/^\d-/, "").replace(/\.\w+$/, "");

const PAST = { id: "CLM-2026-0988", type: "Motor - windshield replacement", received: "2026-08-21", amount: 8400, stage: 4, label: "Paid" };

// ============================ HOME ============================
export async function renderCustomerHome(root) {
  const p = boot.data.policy;
  const mine = await api("/customer/claims");
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
        ${mine.map((c) => `<tr class="click" data-open="${c.id}"><td><b>${c.id}</b> <span class="chip brand">New</span></td><td>${esc(c.type)}</td><td>${fmtDate(c.received)}</td><td>${php(c.amount)}</td><td>${statusChip(c)}</td></tr>`).join("")}
        <tr><td><b>${PAST.id}</b></td><td>${PAST.type}</td><td>${fmtDate(PAST.received)}</td><td>${php(PAST.amount)}</td><td>${statusChip(PAST)}</td></tr>
      </tbody></table>
    </div>`;
  root.querySelectorAll("[data-open]").forEach((tr) => (tr.onclick = () => (location.hash = "#/customer/claim/" + tr.dataset.open)));
}

// ============================ SUBMIT A CLAIM ============================
const SLOTS = [
  { key: "claim_form", label: "Claim form", hint: "Signed motor claim form", required: true, sample: "1-claim-form.pdf" },
  { key: "or_cr", label: "LTO OR/CR", hint: "Official receipt and certificate of registration", required: true, sample: "2-or-cr.pdf" },
  { key: "drivers_license", label: "Driver's license", hint: "Valid on the date of loss", required: true, sample: "3-drivers-license.pdf" },
  { key: "police_report", label: "Police report", hint: "PNP Traffic Accident Report (TARAS form) or certified blotter", required: true, sample: "4-police-report.pdf" },
  { key: "repair_estimate", label: "Repair estimate", hint: "From an accredited repair shop", required: true, sample: "5-repair-estimate.pdf" },
  { key: "photos", label: "Photos of the damage", hint: "Optional. Up to 5 photos, JPG or PNG", required: false, multi: true },
];
const TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;
const LOSS_TYPES = ["Own damage, collision", "Theft", "Flood or natural peril", "Fire", "Third-party liability"];
const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const SAMPLE_INCIDENT = {
  loss_date: "2026-10-02", loss_time: "21:40", loss_place: "Commonwealth Ave. cor. Tandang Sora Ave., Quezon City",
  loss_type: "Own damage, collision", injuries: "No", police: "Yes", police_no: "2026-10-3381",
  description: "While travelling eastbound on Commonwealth Avenue, a motorcycle suddenly swerved into my lane. I braked and steered right to avoid it and the front of my car hit the concrete island. The front bumper, right headlamp and hood were damaged. No one was injured. The motorcycle did not stop.",
};
const stepper = (n) => `<div class="stepper">${["1. Incident details", "2. Attach documents", "3. Review", "4. Submitted"].map((s, i) => `<div class="${i + 1 < n ? "done" : i + 1 === n ? "on" : ""}">${s}</div>`).join("")}</div>`;
const sameWords = (a, b) => {
  const w = (s) => new Set(String(s).toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3));
  const A = w(a), B = w(b);
  if (!A.size || !B.size) return false;
  return [...A].filter((x) => B.has(x)).length / Math.min(A.size, B.size) >= 0.5;
};

export function renderNewClaim(root) {
  const policy = boot.data.policy;
  let incident = { loss_type: LOSS_TYPES[0], injuries: "No", police: "Yes", phone: "0917 555 0142", email: "ramon@workforcesolution.demo", loss_date: "", loss_time: "", loss_place: "", police_no: "", description: "" };
  const att = Object.fromEntries(SLOTS.map((s) => [s.key, []]));
  const header = (t, sub, n) => `<div class="page-head"><div><a href="#/customer" class="small">← My account</a><h1>${t}</h1><div class="muted">${sub}</div></div></div>${stepper(n)}`;

  // ---------- step 1: incident details ----------
  const paintIncident = (errors = []) => {
    const v = incident;
    root.innerHTML = `${header("Report an incident", "Tell us what happened. We use this to check it against your documents.", 1)}
      <div class="grid2">
        <div class="card">
          <div class="between"><h2 style="margin:0">Incident details</h2><button class="btn sm" id="fillsample">Fill with sample incident</button></div>
          <label class="f">Policy</label><select id="f_policy"><option>${esc(policy.policy_no)}, ${esc(policy.vehicle)} (${esc(policy.plate_no)})</option></select>
          <label class="f">Type of loss</label><select id="f_loss_type">${LOSS_TYPES.map((t) => `<option ${t === v.loss_type ? "selected" : ""}>${t}</option>`).join("")}</select>
          <div class="grid2"><div><label class="f">Date of loss</label><input type="date" id="f_loss_date" max="${new Date().toISOString().slice(0, 10)}" value="${esc(v.loss_date)}"></div>
          <div><label class="f">Approximate time</label><input type="time" id="f_loss_time" value="${esc(v.loss_time)}"></div></div>
          <label class="f">Place of loss</label><input type="text" id="f_loss_place" placeholder="Street, barangay, city" value="${esc(v.loss_place)}">
          <label class="f">What happened</label><textarea id="f_description" rows="5" placeholder="Describe the accident in your own words">${esc(v.description)}</textarea>
        </div>
        <div class="card">
          <h2>A few more questions</h2>
          <label class="f">Was anyone injured?</label>
          <div class="radios">${["No", "Yes"].map((o) => `<label><input type="radio" name="f_injuries" value="${o}" ${v.injuries === o ? "checked" : ""}> ${o}</label>`).join("")}</div>
          <label class="f">Did you report it to the police?</label>
          <div class="radios">${["Yes", "No"].map((o) => `<label><input type="radio" name="f_police" value="${o}" ${v.police === o ? "checked" : ""}> ${o}</label>`).join("")}</div>
          <label class="f">Police report number (if you have it)</label><input type="text" id="f_police_no" value="${esc(v.police_no)}">
          <div class="grid2"><div><label class="f">Mobile number</label><input type="text" id="f_phone" value="${esc(v.phone)}"></div>
          <div><label class="f">Email</label><input type="text" id="f_email" value="${esc(v.email)}"></div></div>
          <p class="muted small" style="margin-top:12px">By submitting a claim you confirm the information is true. Providing false information can void your claim.</p>
        </div>
      </div>
      ${errors.length ? `<div class="chip red" style="white-space:normal;margin-top:14px;display:block">${errors.map(esc).join(" ")}</div>` : ""}
      <div class="between" style="margin-top:16px"><span class="muted small">Step 1 of 4</span><button class="btn brand lg" id="next1">Continue to documents</button></div>`;
    const read1 = () => {
      const val = (id) => $("#" + id).value.trim();
      const radio = (n) => root.querySelector(`input[name="${n}"]:checked`)?.value || "";
      incident = { loss_type: val("f_loss_type"), loss_date: val("f_loss_date"), loss_time: val("f_loss_time"), loss_place: val("f_loss_place"), description: val("f_description"), injuries: radio("f_injuries"), police: radio("f_police"), police_no: val("f_police_no"), phone: val("f_phone"), email: val("f_email") };
    };
    $("#fillsample").onclick = () => { read1(); incident = { ...incident, ...SAMPLE_INCIDENT }; paintIncident(); };
    $("#next1").onclick = () => {
      read1();
      const errs = [];
      if (!incident.loss_date) errs.push("Enter the date of loss.");
      else if (incident.loss_date < policy.inception || incident.loss_date > policy.expiry) errs.push(`The date of loss is outside your policy period (${fmtDate(policy.inception)} to ${fmtDate(policy.expiry)}).`);
      if (!incident.loss_place) errs.push("Enter the place of loss.");
      if (incident.description.length < 20) errs.push("Describe what happened in at least a sentence.");
      if (!incident.phone) errs.push("Enter a mobile number so the claims officer can reach you.");
      errs.length ? paintIncident(errs) : paintDocs();
    };
  };

  // ---------- step 2: attach documents ----------
  const doneItems = () => SLOTS.flatMap((s) => att[s.key].filter((i) => i.status === "done").map((i) => ({ ...i, slot: s })));
  const requiredLeft = () => SLOTS.filter((s) => s.required && !att[s.key].some((i) => i.status === "done"));
  const busy = () => SLOTS.some((s) => att[s.key].some((i) => i.status === "uploading"));

  function paintDocs() {
    root.innerHTML = `${header("Attach your documents", "Add each document below. PDF, JPG or PNG, up to 10 MB each.", 2)}
      <div class="card">
        <div class="between" style="margin-bottom:6px"><h2 style="margin:0">Documents</h2><button class="btn amber sm" id="attachsamples">Attach sample documents</button></div>
        ${SLOTS.map((s) => `<div class="slot" data-k="${s.key}">
          <div class="slot-main"><b>${s.label}</b> ${s.required ? "" : '<span class="chip">Optional</span>'}<div class="muted small">${s.hint}</div><div class="slot-err small" id="err-${s.key}"></div></div>
          <div class="slot-files" id="sf-${s.key}"></div>
          <div class="slot-act"><button class="btn sm" data-browse="${s.key}">${s.multi ? "Add photos" : "Browse"}</button><input type="file" hidden data-pick="${s.key}" accept="application/pdf,image/jpeg,image/png" ${s.multi ? "multiple" : ""}></div>
        </div>`).join("")}
      </div>
      <div class="between" style="margin-top:16px"><div><button class="btn" id="back2">Back</button> <span class="muted small" id="sum" style="margin-left:10px"></span></div><button class="btn brand lg" id="next2" disabled>Read my documents</button></div>`;
    SLOTS.forEach((s) => paintSlot(s.key));
    paintSummary();
    root.querySelectorAll("[data-browse]").forEach((b) => (b.onclick = () => root.querySelector(`[data-pick="${b.dataset.browse}"]`).click()));
    root.querySelectorAll("[data-pick]").forEach((inp) => (inp.onchange = () => { addFiles(inp.dataset.pick, [...inp.files]); inp.value = ""; }));
    root.querySelectorAll(".slot").forEach((el) => {
      el.ondragover = (e) => { e.preventDefault(); el.classList.add("over"); };
      el.ondragleave = () => el.classList.remove("over");
      el.ondrop = (e) => { e.preventDefault(); el.classList.remove("over"); addFiles(el.dataset.k, [...e.dataTransfer.files]); };
    });
    $("#attachsamples").onclick = attachSamples;
    $("#back2").onclick = () => paintIncident();
    $("#next2").onclick = () => read();
  }

  function paintSlot(k) {
    const box = $("#sf-" + k);
    if (!box) return;
    box.innerHTML = att[k].map((it, i) => `<div class="fileitem ${it.status}">
      <div class="between"><span class="fname">${esc(it.name)}</span><span class="small muted">${kb(it.size)}</span><button class="x" data-rm="${k}:${i}" aria-label="Remove ${esc(it.name)}">×</button></div>
      <div class="pbar"><i style="width:${it.pct}%"></i></div>
      <div class="small ${it.status === "done" ? "ok-t" : "muted"}">${it.status === "done" ? "Uploaded" : "Uploading " + it.pct + "%"}</div></div>`).join("");
    box.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { const [kk, i] = b.dataset.rm.split(":"); att[kk].splice(+i, 1); paintSlot(kk); paintSummary(); }));
  }
  function paintSummary() {
    const total = SLOTS.filter((s) => s.required).length, left = requiredLeft().length;
    const sum = $("#sum");
    if (!sum) return;
    sum.textContent = busy() ? "Uploading…" : left ? `${total - left} of ${total} required documents attached` : "All required documents attached";
    $("#next2").disabled = !!left || busy();
  }
  function upload(k, item) {
    const total = 600 + Math.min(1400, item.size / 700);
    const t0 = Date.now();
    const tick = setInterval(() => {
      item.pct = Math.min(100, Math.round(((Date.now() - t0) / total) * 100));
      if (item.pct >= 100) { clearInterval(tick); item.status = "done"; }
      if ($("#sf-" + k)) { paintSlot(k); paintSummary(); } // the user may have moved to another step meanwhile
    }, 60);
  }
  function addFiles(k, files) {
    const slot = SLOTS.find((s) => s.key === k), err = $("#err-" + k);
    err.textContent = "";
    for (const f of files) {
      if (!TYPES.includes(f.type)) { err.textContent = `${f.name} is not a PDF, JPG or PNG file.`; continue; }
      if (f.size > MAX_BYTES) { err.textContent = `${f.name} is ${kb(f.size)}. The limit is 10 MB.`; continue; }
      if (slot.multi && att[k].length >= 5) { err.textContent = "You can attach up to 5 photos."; break; }
      if (!slot.multi) att[k] = [];
      const item = { name: f.name, size: f.size, file: f, sample: false, status: "uploading", pct: 0 };
      att[k].push(item); upload(k, item);
    }
    paintSlot(k); paintSummary();
  }
  async function attachSamples() {
    $("#attachsamples").disabled = true;
    for (const s of SLOTS.filter((x) => x.sample)) {
      const blob = await (await fetch("/files/claim/" + s.sample)).blob();
      att[s.key] = [];
      const item = { name: s.sample, size: blob.size, file: new File([blob], s.sample, { type: "application/pdf" }), sample: true, status: "uploading", pct: 0 };
      att[s.key].push(item); upload(s.key, item); paintSlot(s.key); paintSummary();
      await sleep(350);
    }
  }

  // ---------- step 3: read + review ----------
  async function read() {
    const items = doneItems();
    const sample = SLOTS.filter((s) => s.required).every((s) => att[s.key][0]?.sample);
    root.innerHTML = `${header("Reading your documents", "This takes a few seconds.", 3)}
      <div class="read">
        <div class="docs card">${items.map((it, i) => `<div class="doc" id="d${i}"><div class="ic">${it.name.toLowerCase().endsWith(".pdf") ? "PDF" : "IMG"}</div><div><b>${esc(it.slot.label)}</b><div class="small muted">${esc(it.name)}, ${kb(it.size)}</div></div><div class="st">Waiting</div></div>`).join("")}</div>
        <div class="card found"><h2>What we found</h2><div id="found"><div class="muted">Details appear here as each document is read.</div></div><div id="review"></div></div>
      </div>`;
    let result = null, error = null;
    (sample ? api("/claims/extract", { sample: "hero-claim" }) : Promise.all(items.map((i) => fileToB64(i.file))).then((payload) => api("/claims/extract", { files: payload })))
      .then((r) => (result = r), (e) => (error = e));
    for (let i = 0; i < items.length && !error; i++) {
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
    const gap = Math.min(110, 2600 / result.fields.length);
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
    paintReview(result, check, items);
  }

  function paintError(e) {
    $("#found").innerHTML = `<div class="chip red" style="white-space:normal">${esc(e.message)}</div>
      <div class="chips" style="margin-top:12px"><button class="btn" id="again">Back to documents</button></div>`;
    $("#again").onclick = () => paintDocs();
  }

  function crossChecks(n) {
    const rows = [
      ["Policy number", policy.policy_no, n.policy_no, n.policy_no === policy.policy_no],
      ["Vehicle plate", policy.plate_no, n.plate_no, String(n.plate_no).replace(/ /g, "") === policy.plate_no.replace(/ /g, "")],
      ["Date of loss", fmtDate(incident.loss_date), fmtDate(n.loss_date), incident.loss_date === n.loss_date],
      ["Place of loss", incident.loss_place, n.loss_location, sameWords(incident.loss_place, n.loss_location)],
    ];
    return rows;
  }

  function paintReview(result, check, items) {
    const missing = check.checklist.filter((k) => k.needed && !k.present);
    const cc = crossChecks(result.normalized);
    const bad = cc.filter((r) => !r[3]);
    $("#review").innerHTML = `
      <div class="grid2" style="margin-top:18px">
        <div><h3>Document checklist</h3>${check.checklist.map((k) => `<div class="check"><span class="dot ${k.present ? "ok" : k.needed ? "no" : "na"}">${k.present ? "✓" : k.needed ? "✕" : "–"}</span>${esc(k.label)}</div>`).join("")}</div>
        <div><h3>Checked against what you told us</h3>${cc.map(([l, a, b, ok]) => `<div class="check"><span class="dot ${ok ? "ok" : "no"}">${ok ? "✓" : "!"}</span><span>${l}${ok ? "" : `<div class="small muted">You entered ${esc(a)}, the documents say ${esc(b || "nothing")}</div>`}</span></div>`).join("")}
          <div class="check"><span class="dot ${check.inForce ? "ok" : "no"}">${check.inForce ? "✓" : "✕"}</span>${check.inForce ? "Your policy was active on the date of loss" : "We could not match an active policy"}</div></div>
      </div>
      ${missing.length ? `<div class="chip amber" style="white-space:normal;margin-top:12px;display:block">Still missing: ${missing.map((m) => esc(m.label)).join(", ")}. You can submit now and add them later.</div>` : ""}
      ${bad.length ? `<div class="chip amber" style="white-space:normal;margin-top:12px;display:block">Some details differ. You can still submit; the claims officer will confirm them with you.</div>` : `<div class="status-banner"><b>✓</b><span>Your details and documents agree. Please review the information above, then submit.</span></div>`}
      <div class="between" style="margin-top:16px"><button class="btn" id="restart">Back to documents</button><button class="btn brand lg" id="submit">Submit claim</button></div>`;
    $("#restart").onclick = () => paintDocs();
    $("#submit").onclick = async () => {
      const btn = $("#submit");
      btn.disabled = true; btn.textContent = "Submitting…";
      try {
        const files = await Promise.all(items.map(async (it) => ({
          name: it.name, size: it.size, slot: it.slot.label, sample: it.sample,
          ...(it.sample ? {} : await fileToB64(it.file)),
        })));
        const claim = await api("/customer/claims", { incident, normalized: result.normalized, fields: result.fields, documents: result.documents, checklist: check.checklist, files });
        freshId = claim.id;
        toast("Claim submitted: " + claim.id);
        location.hash = "#/customer/claim/" + claim.id;
      } catch (e) { btn.disabled = false; btn.textContent = "Submit claim"; toast(e.message, true); }
    };
  }

  paintIncident();
}

// ============================ CLAIM DETAIL ============================
export async function renderClaim(root, id, view = {}) {
  let c = view.claim;
  if (!c) {
    try { c = await api("/customer/claims/" + id); }
    catch { root.innerHTML = `<div class="card empty">Claim not found. <a href="#/customer">Back to my account</a></div>`; return; }
  }
  const n = c.normalized;
  const fresh = freshId === id;
  if (fresh) freshId = null;
  const inc = c.incident;
  const docIdx = view.doc ?? 0;
  const doc = c.docFiles[docIdx];
  const est = n.estimate_total;
  root.innerHTML = `
    <div class="page-head">
      <div><a href="#/customer" class="small">← My account</a><h1>${c.id}</h1>
        <div class="muted">${esc(c.type)} · ${esc(n.vehicle_model)} ${esc(n.plate_no)} · loss on ${fmtDate(n.loss_date)}</div></div>
      <div>${statusChip(c)}</div>
    </div>
    ${fresh ? `<div class="status-banner" style="margin:0 0 16px"><b>✓</b><span><b>Claim submitted.</b> Your reference is ${c.id}. We sent a confirmation to ${esc(inc?.email || "your email")}. A claims officer will acknowledge it within 1 working day.</span></div>` : ""}
    <div class="card" style="margin-bottom:16px">
      <div class="timeline">${STAGES.map((s, i) => `<div class="s ${i < c.stage ? "done" : i === c.stage ? "cur" : ""}"><div class="b">${i < c.stage ? "✓" : i + 1}</div>${s}</div>`).join("")}</div>
      <div style="margin-top:10px" class="muted small">${c.stage >= 4 ? "Your claim is settled." : c.label === "Declined" ? "We could not approve this claim. A claims officer will contact you." : c.stage === 3 ? "Approved. Payment is released within 3 working days." : c.status === "Documents requested" ? "We need more information from you. See the latest update below." : "A claims officer is reviewing your claim. Complete documents are decided within 10 working days."}</div>
    </div>
    <div class="split">
      <div class="viewer card">
        <div class="tabs">${c.docFiles.map((d, i) => `<button class="tab ${i === docIdx ? "on" : ""}" data-doc="${i}">${esc(docLabel(c.documents, d.name, d.slot))}</button>`).join("")}</div>
        ${doc?.url ? `<iframe src="${doc.url}#toolbar=0&navpanes=0" title="${esc(doc.name)}"></iframe>` : `<div class="empty">Preview is not available for this file after a page reload.</div>`}
        <div class="quote" ${view.quote ? "" : "hidden"}>${view.quote ? `Read from <b>${esc(view.quoteDoc)}</b>: “${esc(view.quote)}”` : ""}</div>
      </div>
      <div>
        ${inc ? `<div class="card"><h2>What you reported</h2>
          <table class="fields"><tbody>
            <tr><td>Type of loss</td><td><b>${esc(inc.loss_type)}</b></td></tr>
            <tr><td>Date and time</td><td><b>${fmtDate(inc.loss_date)}${inc.loss_time ? ", " + esc(inc.loss_time) : ""}</b></td></tr>
            <tr><td>Place</td><td><b>${esc(inc.loss_place)}</b></td></tr>
            <tr><td>Injuries</td><td><b>${esc(inc.injuries)}</b></td></tr>
            <tr><td>Police report</td><td><b>${esc(inc.police)}${inc.police_no ? ", no. " + esc(inc.police_no) : ""}</b></td></tr>
            <tr><td>Contact</td><td><b>${esc(inc.phone)}, ${esc(inc.email)}</b></td></tr>
          </tbody></table>
          <p style="margin:10px 0 0">${esc(inc.description)}</p></div>` : ""}
        <div class="card">
          <h2>Attachments <span class="muted small">${c.docFiles.length} files</span></h2>
          ${c.docFiles.map((d) => `<div class="check"><span class="dot ok">✓</span><span><b>${esc(d.slot || docLabel(c.documents, d.name))}</b> <span class="muted small">${esc(d.name)}${d.size ? ", " + kb(d.size) : ""}</span></span></div>`).join("")}
        </div>
        <div class="card"><h2>Details we read <span class="muted small">click a row to see where it came from</span></h2>
          <table class="fields"><tbody>${c.fields.map((f, i) => `<tr class="click" data-field="${i}"><td>${esc(f.label)}</td><td><b>${esc(f.value)}</b></td><td style="width:90px;white-space:nowrap"><span class="conf"><i style="width:${Math.round(f.confidence * 100)}%"></i></span><span class="small muted">${Math.round(f.confidence * 100)}%</span></td></tr>`).join("")}</tbody></table></div>
        <div class="grid2" style="margin-top:16px">
          <div class="card"><h2>Document checklist</h2>${c.checklist.map((k) => `<div class="check"><span class="dot ${k.present ? "ok" : k.needed ? "no" : "na"}">${k.present ? "✓" : k.needed ? "✕" : "–"}</span>${esc(k.label)}</div>`).join("")}</div>
          <div class="card"><h2>Repair receipt</h2>${receiptCard(c)}</div>
        </div>
        <div class="card"><h2>Updates</h2><ul class="msglog">${c.log.map((l) => `<li><span class="muted small">${l.t}</span> ${esc(l.text)}</li>`).join("")}</ul></div>
      </div>
    </div>`;
  root.querySelectorAll("[data-doc]").forEach((b) => (b.onclick = () => renderClaim(root, id, { claim: c, doc: +b.dataset.doc })));
  root.querySelectorAll("[data-field]").forEach((tr) => (tr.onclick = () => {
    const f = c.fields[+tr.dataset.field];
    renderClaim(root, id, { claim: c, doc: Math.max(0, c.docFiles.findIndex((d) => d.name === f.source_doc)), quote: f.source_quote, quoteDoc: f.source_doc });
  }));
  $("#addreceipt")?.addEventListener("click", () => openReceipt(c, root));
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
function openReceipt(c, root) {
  const claimId = c.id;
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
    out.querySelector("#attach").onclick = async () => {
      try {
        const updated = await api(`/customer/claims/${claimId}/receipt`, { receipt: d });
        m.close(); renderClaim(root, claimId, { claim: updated }); toast("Receipt added to your claim");
      } catch (e) { toast(e.message, true); }
    };
  }
}

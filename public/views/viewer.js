// Full-screen document viewer: zoom in/out, fit to width, page and document navigation, print, download, open in a new tab.
// PDFs are drawn with pdf.js (vendored in /vendor/pdfjs) so zoom stays sharp; images use <img>. If pdf.js fails, the browser's own viewer is used.
import { esc } from "/app.js";

let pdfjs = null;
async function loadPdfjs() {
  if (!pdfjs) {
    pdfjs = await import("/vendor/pdfjs/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
  }
  return pdfjs;
}

const BASE = 96 / 72; // CSS pixels per PDF point at 100%
const MIN = 0.5, MAX = 3, STEP = 0.25;
const isImage = (d) => /\.(png|jpe?g|gif|webp)$/i.test(d.name) || d.type?.startsWith("image/");

export function openViewer(docs, start = 0) {
  if (!docs?.length) return;
  const opener = document.activeElement;
  let idx = Math.min(Math.max(start, 0), docs.length - 1);
  let zoom = 1, fit = true, pdf = null, token = 0, fallback = false, redraw = null;

  const root = document.createElement("div");
  root.className = "vwr";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Document viewer");
  root.innerHTML = `
    <div class="vwr-bar">
      <div class="vwr-title"><b id="v-vt"></b><span class="muted small" id="v-vs"></span></div>
      <div class="vwr-group" id="v-nav" role="group" aria-label="Documents">
        <button class="vbtn" id="v-prev" aria-label="Previous document">‹</button><span class="vcount" id="v-count"></span><button class="vbtn" id="v-next" aria-label="Next document">›</button>
      </div>
      <div class="vwr-group" role="group" aria-label="Zoom">
        <button class="vbtn" id="v-zout" aria-label="Zoom out" title="Zoom out (-)">−</button>
        <span class="vcount" id="v-zpct" aria-live="polite">100%</span>
        <button class="vbtn" id="v-zin" aria-label="Zoom in" title="Zoom in (+)">+</button>
        <button class="vbtn wide" id="v-zfit" title="Fit to width (0)">Fit width</button>
      </div>
      <div class="vwr-group">
        <button class="vbtn wide" id="v-print">Print</button>
        <button class="vbtn wide" id="v-dl">Download</button>
        <button class="vbtn wide" id="v-tab">Open in new tab</button>
      </div>
      <button class="vbtn close" id="v-close" aria-label="Close the viewer" title="Close (Esc)">×</button>
    </div>
    <div class="vwr-body" id="v-body" tabindex="0"><div class="vwr-pages" id="v-pages"></div></div>`;
  document.body.appendChild(root);
  document.body.classList.add("vwr-open");
  const $ = (s) => root.querySelector(s);
  const body = $("#v-body"), pages = $("#v-pages");

  const close = () => {
    token++;
    pdf?.destroy?.();
    document.removeEventListener("keydown", onKey, true);
    root.remove();
    document.body.classList.remove("vwr-open");
    opener?.focus?.();
  };

  function setZoom(z, keepFit = false) {
    zoom = Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));
    fit = keepFit;
    $("#v-zpct").textContent = Math.round(zoom * 100) + "%";
    $("#v-zout").disabled = zoom <= MIN; $("#v-zin").disabled = zoom >= MAX;
  }
  const bodyWidth = () => Math.max(240, body.clientWidth - 48);

  async function render() {
    const my = ++token;
    const d = docs[idx];
    $("#v-vt").textContent = d.label || d.name;
    $("#v-vs").textContent = d.label ? "  " + d.name : "";
    $("#v-count").textContent = `${idx + 1} / ${docs.length}`;
    $("#v-prev").disabled = idx === 0; $("#v-next").disabled = idx === docs.length - 1;
    $("#v-nav").hidden = docs.length < 2;
    pages.innerHTML = `<div class="vwr-msg"><span class="spin"></span> Loading…</div>`;
    fallback = false; redraw = null; pdf?.destroy?.(); pdf = null;

    if (isImage(d)) {
      const img = new Image();
      img.alt = d.label || d.name;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = d.url; }).catch(() => {});
      if (my !== token) return;
      if (!img.naturalWidth) { pages.innerHTML = `<div class="vwr-msg">This image could not be loaded.</div>`; return; }
      img.className = "vwr-img";
      pages.replaceChildren(img);
      const apply = () => { img.style.width = img.naturalWidth * zoom + "px"; };
      if (fit) setZoom(Math.min(MAX, bodyWidth() / img.naturalWidth), true);
      apply(); redraw = apply;
      return;
    }

    try {
      const lib = await loadPdfjs();
      pdf = await lib.getDocument(d.url).promise;
      if (my !== token) return;
      if (fit) {
        const p1 = await pdf.getPage(1);
        setZoom(bodyWidth() / (p1.getViewport({ scale: 1 }).width * BASE), true);
      }
      await drawPages(my);
      redraw = () => drawPages(++token);
    } catch (e) {
      if (my !== token) return;
      fallback = true;
      pages.innerHTML = `<iframe class="vwr-native" src="${esc(d.url)}#toolbar=1" title="${esc(d.name)}"></iframe>`;
      $("#v-zpct").textContent = "-";
      redraw = null;
    }
  }

  async function drawPages(my) {
    const dpr = window.devicePixelRatio || 1;
    const frag = document.createDocumentFragment();
    const canvases = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      if (my !== token) return;
      const vp = page.getViewport({ scale: zoom * BASE });
      const wrap = document.createElement("div");
      wrap.className = "vwr-page";
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
      c.style.width = vp.width + "px"; c.style.height = vp.height + "px";
      c.setAttribute("aria-label", `Page ${n} of ${pdf.numPages}`);
      wrap.appendChild(c); frag.appendChild(wrap);
      canvases.push([page, vp, c]);
    }
    if (my !== token) return;
    pages.replaceChildren(frag);
    for (const [page, vp, c] of canvases) {
      if (my !== token) return;
      await page.render({ canvasContext: c.getContext("2d"), viewport: page.getViewport({ scale: zoom * BASE * dpr }) }).promise;
    }
  }

  const zoomTo = (z) => { setZoom(z); redraw?.(); };

  // Print: draw every page at print resolution into a hidden frame, then print that frame.
  async function print() {
    const d = docs[idx];
    const urls = [];
    try {
      if (fallback || (!pdf && !isImage(d))) { window.open(d.url, "_blank"); return; }
      if (isImage(d)) urls.push(d.url);
      else for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 2 });
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        urls.push(c.toDataURL("image/png"));
      }
    } catch { window.open(d.url, "_blank"); return; }
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    const doc = f.contentDocument;
    doc.open();
    doc.write(`<!doctype html><title>${esc(d.label || d.name)}</title><style>@page{margin:8mm}html,body{margin:0}img{display:block;width:100%;max-height:277mm;object-fit:contain;page-break-after:always}img:last-child{page-break-after:auto}</style>${urls.map((u) => `<img src="${u}">`).join("")}`);
    doc.close();
    const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); };
    const imgs = [...doc.images];
    let left = imgs.length;
    if (!left) return go();
    imgs.forEach((im) => { const done = () => { if (--left === 0) go(); }; im.complete ? done() : ((im.onload = done), (im.onerror = done)); });
  }

  function onKey(e) {
    if (!root.isConnected) return;
    const typing = /input|textarea|select/i.test(e.target.tagName);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (typing) return;
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomTo(zoom + STEP); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomTo(zoom - STEP); }
    else if (e.key === "0") { e.preventDefault(); fit = true; render(); }
    else if (e.key === "ArrowRight" && e.target === root) { if (idx < docs.length - 1) { idx++; fit = true; render(); } }
    else if (e.key === "ArrowLeft" && e.target === root) { if (idx > 0) { idx--; fit = true; render(); } }
    else if (e.key === "Tab") { // keep focus inside the viewer
      const f = [...root.querySelectorAll("button:not([disabled])")].filter((b) => b.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener("keydown", onKey, true);

  $("#v-close").onclick = close;
  $("#v-zin").onclick = () => zoomTo(zoom + STEP);
  $("#v-zout").onclick = () => zoomTo(zoom - STEP);
  $("#v-zfit").onclick = () => { fit = true; render(); };
  $("#v-prev").onclick = () => { if (idx > 0) { idx--; fit = true; render(); } };
  $("#v-next").onclick = () => { if (idx < docs.length - 1) { idx++; fit = true; render(); } };
  $("#v-print").onclick = print;
  $("#v-dl").onclick = () => { const a = document.createElement("a"); a.href = docs[idx].url; a.download = docs[idx].name; document.body.appendChild(a); a.click(); a.remove(); };
  $("#v-tab").onclick = () => window.open(docs[idx].url, "_blank");
  // Ctrl or Cmd + wheel zooms the document instead of the page
  body.addEventListener("wheel", (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomTo(zoom + (e.deltaY < 0 ? STEP / 2 : -STEP / 2)); } }, { passive: false });

  $("#v-close").focus();
  render();
}

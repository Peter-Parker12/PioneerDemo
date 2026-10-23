import { renderLogin } from "/views/login.js";
import { renderCustomerHome, renderNewClaim, renderClaim, customerBoot } from "/views/customer.js";
import { renderLeads, renderProducts, mountAssistant, unmountAssistant } from "/views/agent.js";

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const php = (n) => "₱" + Math.round(Number(n) || 0).toLocaleString("en-PH");
export const fmtDate = (d) => (d ? new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" }) : "-");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const LOGO = `<svg class="logo" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0fa3a3"/><path d="M6 10l4.5 12L16 12l5.5 10L26 10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---------- session ----------
const SKEY = "wfs_session";
export const session = {
  get() { try { return JSON.parse(localStorage.getItem(SKEY)); } catch { return null; } },
  set(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch {} },
  clear() { try { localStorage.removeItem(SKEY); } catch {} },
};

// ---------- api ----------
function authHeaders() {
  const h = { "Content-Type": "application/json" };
  const s = session.get();
  if (s?.token) h["x-token"] = s.token;
  return h;
}
export async function api(path, body, method) {
  const res = await fetch("/api" + path, { method: method || (body ? "POST" : "GET"), headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/login") { session.clear(); location.hash = "#/login"; throw new Error(j.error || "Please sign in again"); }
  if (!res.ok) { const e = new Error(j.error || res.statusText); e.offline = j.offline; throw e; }
  return j;
}
// Server-sent-event POST: calls onEvent for each JSON event.
export async function streamApi(path, body, onEvent) {
  const res = await fetch("/api" + path, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, i).replace(/^data: /, "");
      buf = buf.slice(i + 2);
      if (line) onEvent(JSON.parse(line));
    }
  }
}
export function fileToB64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, mediaType: file.type || "application/pdf", data: String(r.result).split(",")[1] });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ---------- ui helpers ----------
let toastT;
export function toast(msg, err) {
  const t = $("#toast");
  t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ""), 3400);
}
export function modal(html, { wide } = {}) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="overlay"><div class="modal ${wide ? "wide" : ""}">${html}</div></div>`;
  const close = () => (root.innerHTML = "");
  root.querySelector(".overlay").addEventListener("mousedown", (e) => { if (e.target.classList.contains("overlay")) close(); });
  return { el: root.querySelector(".modal"), close };
}
// Small markdown subset for assistant replies: bold, italics, bullets, numbered lists, tables, [Source: ...] chips.
export function md(src) {
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|\s)_(.+?)_(?=\s|$|[.,])/g, "$1<i>$2</i>")
    .replace(/\[Source: ([^\]]+)\]/g, '<span class="src">Source: $1</span>');
  const lines = String(src).split("\n");
  let html = "", list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*\|/.test(l) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
      close();
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(l); i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      i--;
      html += `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    } else if (/^\s*[-*] /.test(l)) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${inline(l.replace(/^\s*[-*] /, ""))}</li>`; }
    else if (/^\s*\d+\. /.test(l)) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${inline(l.replace(/^\s*\d+\. /, ""))}</li>`; }
    else if (!l.trim()) close();
    else { close(); html += `<p>${inline(l)}</p>`; }
  }
  close();
  return html;
}

// ---------- header ----------
const initials = (n) => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
let ai = null;
function paintHeader(sec) {
  const s = session.get();
  const top = $("#top");
  if (!s) { top.innerHTML = `<a class="brand" href="#/login">${LOGO}<span>Workforce Solution</span></a>`; return; }
  const nav = s.role === "customer"
    ? [["customer", "My account", "#/customer"], ["new", "Submit a claim", "#/customer/new"]]
    : [["leads", "Leads", "#/agent"], ["products", "Products", "#/agent/products"]];
  top.innerHTML = `
    <a class="brand" href="${s.role === "customer" ? "#/customer" : "#/agent"}">${LOGO}<span>Workforce Solution</span><em>${s.role === "customer" ? "Customer portal" : "Agent workspace"}</em></a>
    <nav id="nav">${nav.map(([k, l, h]) => `<a href="${h}" data-nav="${k}" class="${k === sec ? "on" : ""}">${l}</a>`).join("")}</nav>
    <div class="who">
      <span class="pill ${ai?.live ? "live" : "demo"}" title="${esc(ai?.live ? "Claude is connected" : ai?.configured ? "Claude key check failed, showing built-in demo data" : "No API key set, showing built-in demo data")}"><i></i>${ai?.live ? "Live AI" : "Demo mode"}</span>
      <div class="userbox"><div class="avatar-sm">${esc(initials(s.name))}</div><span>${esc(s.name)}</span></div>
      <button class="linkbtn" id="logout">Sign out</button>
    </div>`;
  $("#logout").onclick = () => { session.clear(); unmountAssistant(); location.hash = "#/login"; };
}

// ---------- router ----------
const app = $("#app");
async function route() {
  const s = session.get();
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  const area = parts[0];
  window.scrollTo(0, 0);
  $("#modal-root").innerHTML = "";
  app.style.maxWidth = ""; app.style.padding = "";
  if (!s) { unmountAssistant(); paintHeader(); return renderLogin(app, () => { ai = null; refreshAi().then(route); }); }
  if (area !== s.role) {
    location.hash = s.role === "customer" ? "#/customer" : "#/agent";
    return;
  }
  try {
    if (s.role === "customer") {
      await customerBoot();
      paintHeader(parts[1] === "new" ? "new" : "customer");
      if (parts[1] === "new") return renderNewClaim(app);
      if (parts[1] === "claim" && parts[2]) return renderClaim(app, parts[2]);
      return renderCustomerHome(app);
    }
    mountAssistant();
    paintHeader(parts[1] === "products" ? "products" : "leads");
    if (parts[1] === "products") return renderProducts(app);
    return renderLeads(app);
  } catch (e) {
    app.innerHTML = `<div class="card empty">Could not load the page: ${esc(e.message)}</div>`;
  }
}
window.addEventListener("hashchange", route);

async function refreshAi() {
  try { ai = (await (await fetch("/api/health")).json()).ai; } catch {}
}
refreshAi().then(route);

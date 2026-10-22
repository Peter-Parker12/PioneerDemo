import { renderQueue, renderClaim } from "/views/claims.js";
import { renderRules } from "/views/rules.js";
import { renderAcademy } from "/views/academy.js";

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const php = (n) => "₱" + Math.round(Number(n) || 0).toLocaleString("en-PH");
export const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" }) : "-");

// ---------- persisted state ----------
const KEY = "pioneer_demo_v1";
export const boot = { data: null };
export const state = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  return s;
})();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
export function resetDemo() { try { localStorage.removeItem(KEY); } catch {} location.hash = "#/claims"; location.reload(); }

// ---------- api ----------
export async function api(path, body) {
  const headers = { "Content-Type": "application/json" };
  const pc = localStorage.getItem("pioneer_passcode");
  if (pc) headers["x-passcode"] = pc;
  const res = await fetch("/api" + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) {
    const p = prompt("Enter the demo passcode");
    if (p) { localStorage.setItem("pioneer_passcode", p); return api(path, body); }
    throw new Error("Passcode required");
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || res.statusText);
  return j;
}
// Server-sent-event POST: calls onText for each delta.
export async function streamApi(path, body, onText) {
  const headers = { "Content-Type": "application/json" };
  const pc = localStorage.getItem("pioneer_passcode");
  if (pc) headers["x-passcode"] = pc;
  const res = await fetch("/api" + path, { method: "POST", headers, body: JSON.stringify(body) });
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
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.error) throw new Error(ev.error);
      if (ev.t) onText(ev.t);
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
export async function fetchAsFile(url, name) {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: blob.type || "application/pdf" });
}

// ---------- ui helpers ----------
let toastT;
export function toast(msg, err) {
  const t = $("#toast");
  t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ""), 3200);
}
export function modal(html, { wide } = {}) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="overlay"><div class="modal ${wide ? "wide" : ""}">${html}</div></div>`;
  const close = () => (root.innerHTML = "");
  root.querySelector(".overlay").addEventListener("mousedown", (e) => { if (e.target.classList.contains("overlay")) close(); });
  return { el: root.querySelector(".modal"), close };
}
export const scoreClass = (s) => (s >= 60 ? "high" : s >= 30 ? "med" : "low");

// ---------- router ----------
const app = $("#app");
async function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  const sec = parts[0] || "claims";
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.nav === sec));
  window.scrollTo(0, 0);
  if (sec === "claims" && parts[1]) return renderClaim(app, parts[1]);
  if (sec === "claims") return renderQueue(app);
  if (sec === "rules") return renderRules(app);
  if (sec === "academy") return renderAcademy(app, parts[1] || "home");
  location.hash = "#/claims";
}
window.addEventListener("hashchange", route);

(async function start() {
  try {
    boot.data = await api("/bootstrap");
  } catch (e) {
    app.innerHTML = `<div class="card empty">Could not load demo data: ${esc(e.message)}</div>`;
    return;
  }
  if (!state.rules) state.rules = structuredClone(boot.data.rules);
  if (!state.claims) state.claims = {};
  if (!state.sessions) state.sessions = [];
  save();
  route();
})();

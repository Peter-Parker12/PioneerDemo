import { $, esc, php, fmtDate, api } from "/app.js";
import { statusChip, scoreClass } from "/views/review.js";

const FILTERS = ["All", "To review", "Documents requested", "Escalated", "Decided"];
const ui = { filter: "To review" };
const group = (r) => (["New", "In review"].includes(r.status) ? "To review" : ["Approved", "Rejected", "Paid"].includes(r.status) ? "Decided" : r.status);
const dueCell = (r) => {
  if (["Approved", "Rejected", "Paid"].includes(r.status)) return '<span class="muted">-</span>';
  const late = r.due < new Date().toISOString().slice(0, 10);
  return `<span class="${late ? "due late" : ""}">${late ? "Overdue, " : ""}${fmtDate(r.due)}</span>`;
};

export async function renderQueue(root) {
  const rows = await api("/executive/claims");
  const toReview = rows.filter((r) => group(r) === "To review");
  const paint = () => {
    const shown = rows.filter((r) => ui.filter === "All" || group(r) === ui.filter);
    root.innerHTML = `
      <div class="page-head">
        <div><h1>Claims queue</h1><div class="muted">Good morning, Maricar. Claims customers submit appear here with an AI risk score and a suggested action.</div></div>
      </div>
      <div class="kpi-row">
        <div class="card kpi"><div class="v">${toReview.length}</div><div class="l">To review</div></div>
        <div class="card kpi"><div class="v">${toReview.filter((r) => r.status === "New").length}</div><div class="l">New since you last looked</div></div>
        <div class="card kpi"><div class="v">${rows.filter((r) => r.status === "Escalated").length}</div><div class="l">With the manager</div></div>
        <div class="card kpi"><div class="v">${rows.filter((r) => r.score >= 60 && group(r) !== "Decided").length}</div><div class="l">High risk, not yet decided</div></div>
      </div>
      <div class="card">
        <div class="toolbar"><div class="stagebar">${FILTERS.map((f) => `<button data-f="${f}" class="${ui.filter === f ? "on" : ""}">${f}<span>${f === "All" ? rows.length : rows.filter((r) => group(r) === f).length}</span></button>`).join("")}</div></div>
        <table><thead><tr><th>Claim</th><th>Claimant</th><th>Type</th><th>Amount</th><th>Received</th><th>Risk</th><th>AI suggests</th><th>Status</th><th>Due</th></tr></thead><tbody>
          ${shown.map((r) => `<tr class="click ${r.status === "New" ? "new" : ""}" data-id="${r.id}"><td><b>${r.id}</b>${r.status === "New" ? ' <span class="chip blue">New</span>' : ""}</td><td>${esc(r.claimant)}</td><td>${esc(r.type)}</td><td>${php(r.amount)}</td><td>${fmtDate(r.received)}</td><td><span class="score ${scoreClass(r.score)}">${r.score}</span></td><td>${esc(r.outcome)}</td><td>${statusChip(r.status)}</td><td>${dueCell(r)}</td></tr>`).join("") || `<tr><td colspan="9" class="empty">Nothing here. New customer claims will appear in "To review".</td></tr>`}
        </tbody></table>
      </div>`;
    root.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { ui.filter = b.dataset.f; paint(); }));
    root.querySelectorAll("[data-id]").forEach((tr) => (tr.onclick = () => (location.hash = "#/executive/claim/" + tr.dataset.id)));
  };
  paint();
}

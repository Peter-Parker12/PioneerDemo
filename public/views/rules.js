import { $, esc, state, save, boot, toast } from "/app.js";

const ACTIONS = [["approve", "Fast-track approve"], ["review", "Adjuster review"], ["escalate", "Escalate to SIU"], ["decline", "Decline"]];

export function renderRules(root) {
  const rs = state.rules;
  const hasClaim = Object.keys(state.claims).length > 0;
  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Claim approval rules</h1>
        <div class="muted">Your team owns the criteria. Change a threshold or action and re-run a claim to see the outcome change. Changes save automatically in this browser.</div>
      </div>
      <div style="display:flex;gap:8px">
        ${hasClaim ? `<a class="btn primary" href="#/claims/${Object.keys(state.claims)[0]}">Back to claim and re-run</a>` : ""}
        <button class="btn" id="reset">Reset to Pioneer defaults</button>
      </div>
    </div>
    <div class="card">
      <div class="small muted" style="margin-bottom:6px">Rule set: ${esc(boot.data.rules.version)}</div>
      ${rs.rules.map(ruleRow).join("")}
    </div>`;
  root.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("change", () => {
      const rule = rs.rules.find((r) => r.id === el.dataset.id);
      if (el.dataset.f === "enabled") rule.enabled = el.checked;
      if (el.dataset.f === "action") rule.action = el.value;
      if (el.dataset.f === "param") rule.param.value = Number(el.value);
      if (el.dataset.f === "weight") rule.weight = Number(el.value);
      save();
      el.closest(".rule").classList.toggle("off", !rule.enabled);
      toast(`${rule.id} updated`);
    });
  });
  $("#reset").onclick = () => {
    state.rules = structuredClone(boot.data.rules);
    save(); renderRules(root); toast("Rules reset to defaults");
  };
}

function ruleRow(r) {
  const gate = r.kind === "gate" && !r.param;
  return `<div class="rule ${r.enabled ? "" : "off"}">
    <div class="id">${r.id}</div>
    <div><b>${esc(r.name)}</b><div class="muted small">${esc(r.text)}</div></div>
    <div>${r.param ? `<label class="p">${esc(r.param.label)}</label><div class="param"><input type="number" min="0" value="${r.param.value}" data-id="${r.id}" data-f="param"> <span class="muted small">${esc(r.param.unit)}</span></div>` : `<span class="muted small">No parameter</span>`}</div>
    <div><label class="p">When it ${r.kind === "eligibility" ? "applies" : "fires"}</label>
      <select data-id="${r.id}" data-f="action">${ACTIONS.map(([v, l]) => `<option value="${v}" ${r.action === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div style="text-align:right"><label class="toggle"><input type="checkbox" data-id="${r.id}" data-f="enabled" ${r.enabled ? "checked" : ""}><span></span></label></div>
  </div>`;
}

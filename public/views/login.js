import { $, api, session, esc, LOGO } from "/app.js";

// Hardcoded demo accounts (also enforced by the server).
const ACCOUNTS = [
  { role: "customer", label: "Customer", name: "Ramon A. Dela Cruz", blurb: "Submit a motor claim and track it", email: "ramon@workforcesolution.demo", password: "customer123" },
  { role: "agent", label: "Sales agent", name: "Angelo Reyes", blurb: "CRM leads and the AI assistant", email: "angelo@workforcesolution.demo", password: "agent123" },
  { role: "executive", label: "Claim executive", name: "Maricar Ocampo", blurb: "Review submitted claims, AI risk score and suggested actions", email: "maricar@workforcesolution.demo", password: "executive123" },
  { role: "manager", label: "Claim manager", name: "Elena Marquez", blurb: "Case oversight, escalations and fraud rule management", email: "elena@workforcesolution.demo", password: "manager123" },
];

export function renderLogin(root, onDone) {
  root.style.maxWidth = "none"; root.style.padding = "0";
  root.innerHTML = `
    <div class="login-wrap"><div class="login">
      <div class="hero">
        <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px">${LOGO}Workforce Solution</div>
        <div><h1>Insurance that works as hard as your team.</h1>
          <p>Customers file claims in minutes. Agents manage leads and get answers from one AI assistant.</p></div>
        <div class="small" style="opacity:.7">Demo environment. All names and data are fictional.</div>
      </div>
      <form class="form" id="f">
        <h2 style="font-size:20px">Sign in</h2>
        <div class="muted small">Pick a demo account to fill in the credentials, then sign in.</div>
        ${ACCOUNTS.map((a, i) => `<button type="button" class="acct" data-i="${i}"><div class="avatar-sm">${esc(a.label[0])}</div><div><b>${esc(a.label)} · ${esc(a.name)}</b><span class="muted small">${esc(a.blurb)}</span></div></button>`).join("")}
        <label class="f">Email</label><input type="email" id="email" autocomplete="username" required>
        <label class="f">Password</label><input type="password" id="pw" autocomplete="current-password" required>
        <div class="err" id="err"></div>
        <button class="btn primary lg" style="width:100%;justify-content:center;margin-top:6px" id="go">Sign in</button>
      </form>
    </div></div>`;
  const email = $("#email"), pw = $("#pw"), err = $("#err");
  root.querySelectorAll(".acct").forEach((b) => (b.onclick = () => {
    const a = ACCOUNTS[+b.dataset.i];
    email.value = a.email; pw.value = a.password; err.textContent = "";
    $("#go").focus();
  }));
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    err.textContent = "";
    try {
      const s = await api("/login", { email: email.value, password: pw.value });
      session.set(s);
      root.style.maxWidth = ""; root.style.padding = "";
      location.hash = "#/" + s.role;
      onDone?.();
    } catch (ex) { err.textContent = ex.message; }
  };
}

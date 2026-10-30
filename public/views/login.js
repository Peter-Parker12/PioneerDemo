import { $, api, session, esc, LOGO } from "/app.js";

// Hardcoded demo accounts (also enforced by the server).
const ACCOUNTS = [
  { role: "customer", label: "Customer", name: "Ramon A. Dela Cruz", blurb: "Submit a motor claim and track it", email: "ramon@workforcesolution.demo", password: "customer123" },
  { role: "agent", label: "Sales agent", name: "Angelo Reyes", blurb: "CRM leads and the assistant", email: "angelo@workforcesolution.demo", password: "agent123" },
];

export function renderLogin(root, onDone) {
  root.innerHTML = `
    <div class="login-wrap"><div class="login">
      <div class="side">
        <div class="brand">${LOGO}<span>Workforce Solution</span></div>
        <div><h1>Insurance that works as hard as your team.</h1>
          <p>Customers file claims in minutes. Agents manage leads and get answers from one assistant.</p></div>
        <div class="small">Demo environment. All names and data are fictional.</div>
      </div>
      <form class="form" id="f">
        <h2>Sign in</h2>
        <div class="muted small">Pick a demo account to fill in the credentials, then sign in.</div>
        ${ACCOUNTS.map((a, i) => `<button type="button" class="acct" data-i="${i}"><b>${esc(a.label)}, ${esc(a.name)}</b><span class="muted small">${esc(a.blurb)}</span></button>`).join("")}
        <label class="f" for="email">Email</label><input type="email" id="email" autocomplete="username" required>
        <label class="f" for="pw">Password</label><input type="password" id="pw" autocomplete="current-password" required>
        <div class="err" id="err" role="alert"></div>
        <button class="btn primary lg full" id="go">Sign in</button>
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
      location.hash = s.role === "customer" ? "#/customer" : "#/agent";
      onDone?.();
    } catch (ex) { err.textContent = ex.message; }
  };
}

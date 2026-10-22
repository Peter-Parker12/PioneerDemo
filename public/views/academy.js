import { $, esc, state, save, boot, api, streamApi, toast } from "/app.js";

const rp = { personaId: "marites", messages: [], mood: 3, busy: false, score: null };
const qa = { messages: [], busy: false };
const HINTS = [
  "Before you pitch, ask about her family, who depends on the remittance, and what worries her most.",
  "When she says the premium is expensive, ask what monthly amount feels comfortable before you quote anything.",
  "Don't argue about the claims experience of her aunt. Acknowledge it, then explain how your claims steps work.",
  "Tie the benefit to her story, for example the daily hospital income when the breadwinner at home is unable to work.",
  "Close with a small, specific next step: a quotation she can show her husband tonight.",
];
let hintI = 0;

const moodLabel = ["", "Closed", "Doubtful", "Neutral", "Interested", "Ready to move forward"];
const persona = () => boot.data.personas.find((p) => p.id === rp.personaId);

// Minimal safe markdown: bold, bullets, [Source: ...] chips.
function md(t) {
  const lines = esc(t).split("\n");
  let out = "", inList = false;
  for (const l of lines) {
    const m = l.match(/^\s*[-*•]\s+(.*)/);
    if (m) { if (!inList) { out += "<ul>"; inList = true; } out += `<li>${inline(m[1])}</li>`; }
    else { if (inList) { out += "</ul>"; inList = false; } out += inline(l) + (l.trim() ? "<br>" : ""); }
  }
  return out + (inList ? "</ul>" : "");
}
const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[Source:([^\]]+)\]/g, '<span class="src">Source:$1</span>');

export function renderAcademy(root, sub) {
  const tab = sub === "qa" ? "qa" : sub === "progress" ? "progress" : "roleplay";
  root.innerHTML = `
    <div class="page-head"><div><h1>Agent academy</h1><div class="muted">Practice client conversations, check product knowledge and track progress. Angelo Reyes · Sales agent</div></div></div>
    <div class="tabs" style="margin-bottom:16px">
      <a class="tab ${tab === "roleplay" ? "on" : ""}" href="#/academy/home">Roleplay coach</a>
      <a class="tab ${tab === "qa" ? "on" : ""}" href="#/academy/qa">Product Q&amp;A</a>
      <a class="tab ${tab === "progress" ? "on" : ""}" href="#/academy/progress">My progress</a>
    </div>
    <div id="pane"></div>`;
  const pane = $("#pane");
  if (sub === "qa") return viewQA(pane);
  if (sub === "progress") return viewProgress(pane);
  if (sub === "chat") return viewChat(pane);
  if (sub === "score") return viewScore(pane);
  viewHome(pane);
}

// ---------------- roleplay home ----------------
function viewHome(pane) {
  const p = persona();
  pane.innerHTML = `
    <div class="persona-cards">
      ${boot.data.personas.map((x) => `<div class="pcard ${x.id === rp.personaId ? "on" : ""} ${x.active ? "" : "locked"}" data-p="${x.id}">
        <div class="avatar">${x.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
        <b>${esc(x.name)}</b>, ${x.age}<div class="muted small">${esc(x.tagline)}</div>
        <div style="margin-top:8px"><span class="chip ${x.difficulty === "Easy" ? "green" : x.difficulty === "Hard" ? "red" : "amber"}">${x.difficulty}</span> ${x.active ? "" : '<span class="chip">Coming soon</span>'}</div></div>`).join("")}
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Scenario: ${esc(p.name)}</h2>
      <p>${esc(p.scenario)}</p>
      <p><b>Your goal:</b> ${esc(p.goal)}</p>
      <p class="muted small">Tip: speak Taglish or English. The customer reacts to what you say, and you get a scored debrief at the end.</p>
      <button class="btn primary" id="start">Start roleplay</button>
    </div>`;
  pane.querySelectorAll("[data-p]").forEach((el) => (el.onclick = () => {
    const x = boot.data.personas.find((q) => q.id === el.dataset.p);
    if (!x.active) return toast("This persona is not part of the demo build");
    rp.personaId = x.id; viewHome(pane);
  }));
  $("#start").onclick = () => { Object.assign(rp, { messages: [], mood: 3, score: null, busy: false }); hintI = 0; location.hash = "#/academy/chat"; };
}

// ---------------- roleplay chat ----------------
function viewChat(pane) {
  const p = persona();
  pane.innerHTML = `
    <div class="row">
      <div class="card" style="flex:1">
        <div class="chat">
          <div class="msgs" id="msgs">
            <div class="chip blue" style="align-self:center">Scene: ${esc(p.name)} approaches. Open the conversation as the agent.</div>
          </div>
          <div class="composer"><input type="text" id="inp" placeholder="Type what you would say to ${esc(p.name.split(" ")[0])}…" autocomplete="off"><button class="btn primary" id="send">Send</button></div>
        </div>
      </div>
      <div style="width:300px;flex:none">
        <div class="card"><div class="avatar">${p.name.split(" ").map((w) => w[0]).join("")}</div><b>${esc(p.name)}</b>, ${p.age}<div class="muted small">${esc(p.tagline)}</div>
          <h3 style="margin-top:14px">Customer mood</h3><div class="mood" id="mood"></div><div class="small muted" id="moodlabel"></div></div>
        <div class="card"><h3>Coach hint</h3><div class="small muted" id="hint">Stuck? Ask for a hint.</div><button class="btn sm" id="hintbtn" style="margin-top:8px">Show hint</button></div>
        <button class="btn amber" id="end" style="width:100%;justify-content:center;margin-top:16px">End session and get score</button>
      </div>
    </div>`;
  const msgs = $("#msgs"), inp = $("#inp");
  const paintMood = () => {
    $("#mood").innerHTML = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= rp.mood ? "on" + rp.mood : ""}"></i>`).join("");
    $("#moodlabel").textContent = moodLabel[rp.mood];
  };
  const bubble = (role, text) => {
    const d = document.createElement("div");
    d.className = "bubble " + (role === "user" ? "me" : "them");
    d.textContent = text; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
  };
  rp.messages.forEach((m) => bubble(m.role, m.role === "user" ? m.content : stripTag(m.content)));
  paintMood();

  async function send() {
    const text = inp.value.trim();
    if (!text || rp.busy) return;
    inp.value = ""; rp.busy = true;
    rp.messages.push({ role: "user", content: text });
    bubble("user", text);
    const b = bubble("assistant", "…");
    let raw = "";
    try {
      await streamApi("/coach/chat", { mode: "roleplay", personaId: rp.personaId, messages: rp.messages }, (t) => {
        raw += t;
        const m = raw.match(/^\s*\[mood:(\d)\]\s*/);
        if (m) { rp.mood = Math.max(1, Math.min(5, +m[1])); paintMood(); }
        if (!raw.trimStart().startsWith("[") || m) b.textContent = raw.replace(/^\s*\[mood:\d\]\s*/, "");
        msgs.scrollTop = msgs.scrollHeight;
      });
      rp.messages.push({ role: "assistant", content: raw });
    } catch (e) { b.textContent = "(connection problem: " + e.message + ")"; rp.messages.pop(); toast(e.message, true); }
    rp.busy = false; inp.focus();
  }
  $("#send").onclick = send;
  inp.onkeydown = (e) => { if (e.key === "Enter") send(); };
  inp.focus();
  $("#hintbtn").onclick = () => { $("#hint").textContent = HINTS[hintI++ % HINTS.length]; };
  $("#end").onclick = async () => {
    if (rp.messages.filter((m) => m.role === "user").length < 2) return toast("Have a short conversation first (at least 2 messages)");
    if (rp.busy) return;
    location.hash = "#/academy/score";
  };
}
const stripTag = (s) => s.replace(/^\s*\[mood:\d\]\s*/, "");

// ---------------- scorecard ----------------
async function viewScore(pane) {
  if (!rp.messages.length) { location.hash = "#/academy/home"; return; }
  if (!rp.score) {
    pane.innerHTML = `<div class="card empty"><span class="spin" style="display:inline-block;vertical-align:middle"></span> The coach is reviewing your conversation…</div>`;
    try {
      const transcript = rp.messages.map((m) => ({ role: m.role, content: m.role === "user" ? m.content : stripTag(m.content) }));
      rp.score = await api("/coach/score", { personaId: rp.personaId, messages: transcript });
      state.sessions.push({
        date: new Date().toISOString().slice(0, 10), persona: persona().name, total: rp.score.total,
        scores: rp.score.criteria.map((c) => c.score), you: true,
      });
      save();
    } catch (e) { pane.innerHTML = `<div class="card empty">Scoring failed: ${esc(e.message)} <br><button class="btn" onclick="location.reload()">Retry</button></div>`; return; }
  }
  const s = rp.score;
  pane.innerHTML = `
    <div class="card"><div class="row">
      <div style="text-align:center;width:150px"><div class="bigscore">${s.total}</div><div class="muted">out of 100</div>
        <div style="margin-top:8px"><span class="chip ${s.total >= 75 ? "green" : s.total >= 55 ? "amber" : "red"}">${s.total >= 75 ? "Strong" : s.total >= 55 ? "Developing" : "Needs work"}</span></div></div>
      <div style="flex:1"><h2>Coach summary</h2><p>${esc(s.summary)}</p>
        <div class="chips">${s.objections.map((o) => `<span class="chip ${o.handled ? "green" : "red"}">${o.handled ? "✓" : "✕"} ${esc(o.objection)}</span>`).join("")}</div></div>
    </div></div>
    <div class="grid2">
      <div class="card"><h2>Score breakdown</h2>
        ${s.criteria.map((c) => `<div class="crit"><div class="between"><b>${esc(c.name)}</b><b>${c.score}/20</b></div>
          <div class="bar" style="margin:6px 0"><i style="width:${c.score * 5}%"></i></div>
          <div class="small">${esc(c.comment)}</div>${c.quote ? `<div class="quote">You said: “${esc(c.quote)}”</div>` : ""}</div>`).join("")}</div>
      <div>
        <div class="card"><h2>What worked</h2><ul>${s.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          <h2 style="margin-top:14px">Work on next</h2><ul>${s.improvements.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div class="card"><h2>Try this phrasing</h2><div class="diff">
          <div class="bad"><div class="small muted">What you said</div>${esc(s.rewrite.original)}</div>
          <div class="good"><div class="small muted">A stronger version</div>${esc(s.rewrite.better)}</div></div>
          <p class="small muted" style="margin-top:8px">${esc(s.rewrite.why)}</p></div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px"><a class="btn primary" href="#/academy/progress">See my progress</a><a class="btn" href="#/academy/home">Practise again</a></div>`;
}

// ---------------- product Q&A ----------------
function viewQA(pane) {
  const chips = ["Ano ang covered ng personal accident plan kapag nasa motor ako?", "Magkano ang Plus plan para sa family of 4?", "May waiting period ba?", "Ano ang mga exclusions?", "Paano mag-file ng claim at gaano katagal?"];
  pane.innerHTML = `<div class="card"><div class="chat" style="height:560px">
    <div class="msgs" id="msgs"><div class="chip blue" style="align-self:center">Answers come only from the product sheets, with the source cited. Ask in English or Taglish.</div></div>
    <div class="chips">${chips.map((c) => `<button>${esc(c)}</button>`).join("")}</div>
    <div class="composer"><input type="text" id="inp" placeholder="Ask about coverage, premiums, exclusions, claims…" autocomplete="off"><button class="btn primary" id="send">Ask</button></div></div></div>`;
  const msgs = $("#msgs"), inp = $("#inp");
  const bubble = (role, html, isHtml) => {
    const d = document.createElement("div");
    d.className = "bubble wide " + (role === "user" ? "me" : "them");
    if (isHtml) d.innerHTML = html; else d.textContent = html;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
  };
  qa.messages.forEach((m) => bubble(m.role, m.role === "user" ? m.content : md(m.content), m.role !== "user"));
  async function send(text) {
    text = (text ?? inp.value).trim();
    if (!text || qa.busy) return;
    inp.value = ""; qa.busy = true;
    qa.messages.push({ role: "user", content: text }); bubble("user", text);
    const b = bubble("assistant", "…");
    let raw = "";
    try {
      await streamApi("/coach/chat", { mode: "qa", messages: qa.messages }, (t) => { raw += t; b.innerHTML = md(raw); msgs.scrollTop = msgs.scrollHeight; });
      qa.messages.push({ role: "assistant", content: raw });
    } catch (e) { b.textContent = "(connection problem: " + e.message + ")"; qa.messages.pop(); }
    qa.busy = false;
  }
  $("#send").onclick = () => send();
  inp.onkeydown = (e) => { if (e.key === "Enter") send(); };
  pane.querySelectorAll(".chips button").forEach((b) => (b.onclick = () => send(b.textContent)));
}

// ---------------- progress dashboard ----------------
function viewProgress(pane) {
  const seed = boot.data.seed;
  const sessions = [...seed.sessions, ...state.sessions];
  const names = seed.criteria;
  const avgOf = (arr, i) => arr.reduce((s, x) => s + (x.scores[i] || 0), 0) / (arr.length || 1);
  const recent = sessions.slice(-3);
  const latest = sessions[sessions.length - 1];
  const myAvg = Math.round(sessions.reduce((s, x) => s + x.total, 0) / sessions.length);
  const teamAvg = Math.round(seed.team.reduce((s, x) => s + x.avg, 0) / seed.team.length);
  const weakest = names.map((n, i) => [n, avgOf(recent, i)]).sort((a, b) => a[1] - b[1])[0];
  const board = seed.team.map((t) => t.name === seed.agent ? { ...t, sessions: sessions.length, avg: myAvg, you: true } : t).sort((a, b) => b.avg - a.avg);

  pane.innerHTML = `
    <div class="grid4" style="margin-bottom:16px">
      <div class="card kpi"><div class="v">${latest.total}</div><div class="l">Latest score</div><div class="d">${latest.total - sessions[0].total >= 0 ? "+" : ""}${latest.total - sessions[0].total} since first session</div></div>
      <div class="card kpi"><div class="v">${sessions.length}</div><div class="l">Sessions completed</div></div>
      <div class="card kpi"><div class="v">${myAvg}</div><div class="l">My average</div></div>
      <div class="card kpi"><div class="v">${teamAvg}</div><div class="l">Team average</div></div>
    </div>
    <div class="grid2">
      <div class="card"><h2>Score trend</h2>${trend(sessions)}</div>
      <div class="card"><h2>Skill profile <span class="muted small">recent vs. team target</span></h2>${radar(names, names.map((_, i) => avgOf(recent, i)))}</div>
    </div>
    <div class="grid2" style="margin-top:16px">
      <div class="card"><h2>Team leaderboard</h2>
        <table><thead><tr><th>#</th><th>Agent</th><th>Sessions</th><th>Avg</th></tr></thead><tbody>
        ${board.map((t, i) => `<tr ${t.you ? 'style="background:#fffaf0"' : ""}><td>${i + 1}</td><td><b>${esc(t.name)}</b>${t.you ? ' <span class="chip blue">You</span>' : ""}</td><td>${t.sessions}</td><td><b>${t.avg}</b></td></tr>`).join("")}</tbody></table></div>
      <div>
        <div class="card"><h2>Recommended next practice</h2>
          <p>Your weakest area lately is <b>${esc(weakest[0])}</b> (${weakest[1].toFixed(1)}/20). Try another run with Marites focusing on it, then compare your score.</p>
          <a class="btn primary" href="#/academy/home">Start recommended roleplay</a></div>
        <div class="card"><h2>Team weak spots <span class="muted small">for managers</span></h2>
          ${seed.team_weak_spots.map((w) => `<div style="margin:8px 0"><div class="between small"><span>${esc(w.label)}</span><b>${w.pct}% of agents</b></div><div class="bar"><i style="width:${w.pct}%;background:#e48a3d"></i></div></div>`).join("")}</div>
      </div>
    </div>`;
}

function trend(sessions) {
  const W = 520, H = 200, pad = 30;
  const xs = (i) => pad + (i * (W - pad * 2)) / Math.max(1, sessions.length - 1);
  const ys = (v) => H - pad - ((v - 40) / 60) * (H - pad * 2);
  const pts = sessions.map((s, i) => `${xs(i)},${ys(s.total)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%">
    ${[40, 60, 80, 100].map((v) => `<line x1="${pad}" x2="${W - pad}" y1="${ys(v)}" y2="${ys(v)}" stroke="#e7ebf2"/><text x="4" y="${ys(v) + 4}" font-size="10" fill="#66738a">${v}</text>`).join("")}
    <polyline fill="none" stroke="#1d3a6b" stroke-width="2.5" points="${pts}"/>
    ${sessions.map((s, i) => `<circle cx="${xs(i)}" cy="${ys(s.total)}" r="${s.you ? 6 : 4}" fill="${s.you ? "#f2b441" : "#1d3a6b"}"><title>${s.date} ${esc(s.persona)}: ${s.total}</title></circle>`).join("")}
  </svg><div class="small muted">Gold dot = sessions you complete during this demo.</div>`;
}

function radar(names, vals) {
  const C = 120, R = 85, n = names.length;
  const pt = (i, v) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v]; };
  const poly = (f) => names.map((_, i) => pt(i, f(i)).join(",")).join(" ");
  return `<svg viewBox="0 0 240 240" style="width:100%;max-width:340px;display:block;margin:auto">
    ${[0.25, 0.5, 0.75, 1].map((l) => `<polygon points="${poly(() => l)}" fill="none" stroke="#e1e6ee"/>`).join("")}
    <polygon points="${poly(() => 0.8)}" fill="none" stroke="#1f9d63" stroke-dasharray="4 3"/>
    <polygon points="${poly((i) => Math.min(1, vals[i] / 20))}" fill="rgba(29,58,107,.25)" stroke="#1d3a6b" stroke-width="2"/>
    ${names.map((nm, i) => { const [x, y] = pt(i, 1.2); return `<text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="#66738a">${esc(nm)}</text>`; }).join("")}
  </svg>`;
}

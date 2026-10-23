// CRM assistant. Two engines that emit the same events so the browser does not care which one ran:
//   live   - Claude with tool use (streams text, runs CRM tools in a loop)
//   script - canned replies that still call the real CRM functions, with typing delays for the animation
// Events: {t} text delta, {action} CRM change card, {typing} thinking indicator, {done, mode}
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { client, MODEL, live } from "./claude.js";
import { tools, run, listLeads, TODAY, STAGES } from "./crm.js";
import { faq, faqFallback } from "./fixtures.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (n) => "PHP " + Number(n).toLocaleString("en-PH");

const productDocs = () =>
  fs.readdirSync(path.join(root, "data/products")).sort()
    .map((f) => `<document name="${f}">\n${read("data/products", f)}\n</document>`).join("\n\n");

// ============================ live engine ============================
async function runLive(messages, emit) {
  const system = read("server/prompts/assistant.md").replace("{{TODAY}}", TODAY).replace("{{DOCS}}", productDocs());
  const msgs = messages.map((m) => ({ role: m.role, content: m.content }));
  let emitted = false;
  const out = (e) => { emitted = true; emit(e); };
  try {
    for (let turn = 0; turn < 6; turn++) {
      const stream = client.messages.stream({ model: MODEL, max_tokens: 1500, system, tools, messages: msgs, output_config: { effort: "low" } });
      let first = true;
      stream.on("text", (t) => { if (first && turn > 0 && emitted) out({ t: "\n\n" }); first = false; out({ t }); });
      const final = await stream.finalMessage();
      msgs.push({ role: "assistant", content: final.content });
      const uses = final.content.filter((b) => b.type === "tool_use");
      if (!uses.length) return true;
      const results = [];
      for (const u of uses) {
        out({ typing: true });
        const r = run[u.name]?.(u.input || {}) || { error: `Unknown tool ${u.name}` };
        if (r.action) out({ action: r.action });
        results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(r.error ? { error: r.error } : r.result), is_error: !!r.error });
      }
      msgs.push({ role: "user", content: results });
    }
    return true;
  } catch (e) {
    console.error("assistant live error:", e?.message || e);
    if (!emitted) return false; // nothing shown yet: caller falls back to the scripted engine
    out({ t: "\n\n_The connection to the AI dropped. Try again._" });
    return true;
  }
}

// ============================ scripted engine ============================
async function say(emit, text) {
  for (const w of text.split(/(\s+)/)) { emit({ t: w }); if (w.trim()) await sleep(22); }
}
async function act(emit, name, input) {
  emit({ typing: true });
  await sleep(750);
  const r = run[name](input);
  if (r.action) emit({ action: r.action });
  await sleep(350);
  return r;
}

const dueLine = (l) => `- **${l.name}** (${l.stage}, ${l.product}): ${l.next_step}, due ${l.next_due === TODAY ? "today" : l.next_due}`;

const scripts = {
  async followups(emit) {
    emit({ typing: true }); await sleep(700);
    const due = listLeads().filter((l) => l.next_due && l.next_due <= TODAY && !["Won", "Lost"].includes(l.stage))
      .sort((a, b) => a.next_due.localeCompare(b.next_due));
    await say(emit, `You have **${due.length} follow-ups** due today or overdue:\n${due.map(dueLine).join("\n")}\n\nI'd start with Joel Mendoza and Marites Santos, since both are high priority and waiting on you. Want me to draft emails for them?`);
  },

  async update_marites(emit) {
    await act(emit, "update_lead", { lead: "Marites Santos", stage: "Quoted", next_step: "Call after she talks to her husband about the Plus plan", next_due: "2026-10-26", notes: "Quotation for Plus plan (PHP 2,990/yr) discussed. She will decide after talking to her husband." });
    await say(emit, "Done. I moved **Marites Santos** to **Quoted**, set the next step to a call after she talks to her husband, scheduled the follow-up for **Monday, 26 Oct**, and logged a note about the Plus plan.");
  },

  async email_marites(emit) {
    await act(emit, "send_email", {
      lead: "Marites Santos",
      subject: "Your Family Protect Plus plan quotation",
      body: `Dear Ma'am Marites,\n\nThank you for taking my call. As promised, here is the Plus plan of our Family Protect Personal Accident insurance for your family of 4:\n\n- Accidental death / permanent disability: PHP 250,000\n- Accident medical reimbursement: PHP 25,000\n- Daily hospital income: PHP 1,000 per day, up to 30 days\n- Annual premium: PHP 2,990 (about PHP 8 a day for the whole family)\n\nThe plan pays on top of PhilHealth, so your benefits are not reduced. Once your documents are complete, claims are decided within 10 working days and payment is released within 3 working days of approval.\n\nPlease feel free to share this with your husband. I'm happy to answer any of his questions.\n\nWarm regards,\nAngelo Reyes\nWorkforce Solution`,
    });
    await act(emit, "update_lead", { lead: "Marites Santos", next_step: "Call to follow up on the emailed quotation", next_due: "2026-10-26" });
    await say(emit, "I sent Marites the Plus plan quotation, using the benefits and the PHP 2,990 premium from the product sheet, and mentioned that PhilHealth benefits are not reduced. I also set her next step to a follow-up call on Monday.");
  },

  async create_lead(emit) {
    await act(emit, "create_lead", { name: "Rosa Aquino", phone: "0917 555 0100", email: "rosa.aquino@example.com", product: "Home Fire", source: "Agent entry", notes: "Asked about fire cover for her house in Marikina." });
    await say(emit, "I added **Rosa Aquino** as a new lead interested in **Home Fire**, in stage New with an intro call due today. You'll find her at the top of the list.");
  },

  async leads_by_stage(emit) {
    emit({ typing: true }); await sleep(700);
    const by = STAGES.map((s) => [s, listLeads().filter((l) => l.stage === s)]);
    const open = listLeads().filter((l) => !["Won", "Lost"].includes(l.stage));
    const value = open.reduce((a, l) => a + (l.premium || 0), 0);
    await say(emit, `Here is your pipeline:\n${by.map(([s, ls]) => `- **${s}**: ${ls.length}${ls.length ? " (" + ls.map((l) => l.name.split(" ")[0]).join(", ") + ")" : ""}`).join("\n")}\n\nOpen opportunities total about **${money(value)}** in annual premium. Carlos Dizon's fleet renewal is the biggest at ${money(186000)}.`);
  },
};

const answer = (text) => faq.find((e) => e.keys.some((k) => text.includes(k)))?.answer || faqFallback;

// Free text without a live model: recognise a few intents, otherwise answer from the canned product notes.
async function freeText(message, emit) {
  const m = message.toLowerCase();
  const lead = listLeads().find((l) => m.includes(l.name.toLowerCase()) || m.includes(l.name.split(" ")[0].toLowerCase()));
  if (lead && /(e-?mail|mail)/.test(m)) {
    await act(emit, "send_email", { lead: lead.id, subject: `Following up on your ${lead.product} inquiry`, body: `Dear ${lead.name.split(" ")[0]},\n\nThank you for your interest in our ${lead.product} cover. I'd be glad to walk you through the options and answer any questions. When is a good time for a short call this week?\n\nWarm regards,\nAngelo Reyes\nWorkforce Solution` });
    return say(emit, `I emailed **${lead.name}** a short follow-up and logged it in their activity.`);
  }
  const stage = STAGES.find((s) => m.includes(s.toLowerCase()));
  if (lead && stage && /(move|mark|set|change|update)/.test(m)) {
    const r = await act(emit, "update_lead", { lead: lead.id, stage });
    return say(emit, r.error ? r.error : `Done. **${lead.name}** is now in **${stage}**.`);
  }
  if (lead && /note/.test(m)) {
    await act(emit, "add_note", { lead: lead.id, note: message.replace(/^.*?note[:\s]*/i, "").trim() || message });
    return say(emit, `Noted on **${lead.name}**.`);
  }
  if (/(follow.?up|due today|overdue|who should i)/.test(m)) return scripts.followups(emit);
  if (/(pipeline|how many leads|my leads)/.test(m)) return scripts.leads_by_stage(emit);
  emit({ typing: true }); await sleep(800);
  return say(emit, answer(m));
}

async function runScript(messages, scenario, emit) {
  const last = messages[messages.length - 1]?.content || "";
  if (scenario && scripts[scenario]) await scripts[scenario](emit);
  else if (scenario && scenario.startsWith("faq:")) { emit({ typing: true }); await sleep(800); await say(emit, answer(scenario.slice(4))); }
  else await freeText(last, emit);
}

// ============================ entry ============================
// Scripted demo items always run the script (instant and reliable). Typed messages use Claude when it is available.
export async function runAssistant({ messages, scenario, emit }) {
  let mode = "demo";
  if (!scenario && live()) {
    if (await runLive(messages, emit)) mode = "live";
  }
  if (mode === "demo") await runScript(messages, scenario, emit);
  emit({ done: true, mode });
}

export const suggestions = [
  { label: "Who should I follow up with today?", scenario: "followups" },
  { label: "What does the Personal Accident plan cost for a family of 4?", scenario: "faq:plus premium" },
  { label: "Are motorcycle accidents covered?", scenario: "faq:motorcycle" },
  { label: "Move Marites Santos to Quoted and follow up Monday", scenario: "update_marites" },
  { label: "Email Marites the Plus plan quotation", scenario: "email_marites" },
  { label: "Add a new lead: Rosa Aquino, Home Fire", scenario: "create_lead" },
  { label: "Show my pipeline by stage", scenario: "leads_by_stage" },
];

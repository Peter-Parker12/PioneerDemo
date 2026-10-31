# Workforce Solution - Interactive AI Demo

Two role-based portals, signed into with hardcoded demo accounts:

| Role | Email | Password | What it shows |
|---|---|---|---|
| Customer | `ramon@workforcesolution.demo` | `customer123` | Report an incident, attach documents with upload progress, watch the AI read them, submit, track status, add a repair receipt |
| Sales agent | `angelo@workforcesolution.demo` | `agent123` | CRM workspace: lead list, selected lead details, and an AI assistant panel docked on the right that answers product questions and updates leads, sends emails, adds notes |
| Claim executive | `maricar@workforcesolution.demo` | `executive123` | Queue of submitted claims with an AI fraud score, the rules that fired, and suggested actions: Approve, Reject, Escalate to manager, Request documents |
| Claim manager | `elena@workforcesolution.demo` | `manager123` | Case oversight (queue, team workload, highlighted escalations with the executive's note) and Rule management (view, edit, add, delete and publish fraud rules; open claims are re-scored) |

Claims are shared across roles on the server (in memory, reset on restart): what the customer submits appears in the executive's queue, the executive's decision updates the customer's status, and the manager's rule changes re-score open claims.

All names, policies, leads and product terms are **fictional**. Replace `data/products/*.md`, `data/catalog.json` and `data/leads.json` with real content later.

## Demo mode and live AI
Every built-in demo item works **without any API key**: the sample claim pack, the two sample receipts and the assistant's suggested prompts return canned results instantly while the browser plays the reading/typing animation. The header pill shows **Demo mode** or **Live AI**.

With `ANTHROPIC_API_KEY` set, the server checks the key at startup (see the log line starting `AI:`) and also enables:
- reading your own uploaded claim documents and receipts
- free-form assistant chat with real tool use (it calls the CRM functions itself)

If the key is missing or invalid, uploads show a message pointing at the sample items, and typed chat falls back to keyword-matched canned replies.

## Run with Docker
```bash
cp .env.example .env        # optional: add ANTHROPIC_API_KEY
docker compose up --build -d
# open http://localhost:3894
```

## Run locally
```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start     # http://localhost:3000 (omit the key for demo mode)
```

## Layout
```
server/index.js       Express API: login, customer claims/receipts, agent CRM + chat
server/claude.js      Claude client (timeouts, key check, JSON output)
server/assistant.js   Assistant engines: live tool-use loop and scripted fallback (same event stream)
server/crm.js         In-memory CRM store + the tools the assistant can call
server/fixtures.js    Canned results for the demo items
server/rules.js       Deterministic checks (document checklist, policy in force)
public/views/         login.js, customer.js, agent.js (vanilla JS)
data/                 policies, leads, catalogue, product sheets, sample PDFs
demo-files/           the same sample PDFs, grouped for manual upload
```

See `DEMO_SCRIPT.md` for the talk track.

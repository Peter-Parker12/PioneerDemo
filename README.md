# Workforce Solution - Interactive AI Demo

Two role-based portals, signed into with hardcoded demo accounts:

| Role | Email | Password | What it shows |
|---|---|---|---|
| Customer | `ramon@workforcesolution.demo` | `customer123` | Submit a motor claim: upload documents, watch the AI read them, review, submit, track status, add a repair receipt |
| Sales agent | `angelo@workforcesolution.demo` | `agent123` | CRM lead list and product catalogue, plus a floating AI assistant that answers product questions and acts on the CRM (update leads, send emails, add notes, create leads) |

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

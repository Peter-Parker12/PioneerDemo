# Pioneer Insurance (PH) - Interactive AI Demo

Clickable demo of two use cases, running on the live Claude API:

1. **Claims workbench**: upload a claim pack, AI extracts the data, a rule engine scores fraud risk with reasons, the adjuster approves / requests documents / escalates. Includes "Try your own receipt" (any receipt is read live) and an **Approval rules** editor prebaked with illustrative motor-policy rules.
2. **Agent academy**: Taglish roleplay with a customer persona (Marites, OFW spouse), scored debrief with quotes, product Q&A grounded in product sheets, progress dashboard.

All names, policies, claims and product terms are **fictional / illustrative**. Replace `data/products/*.md` and `data/rules_default.json` with Pioneer's real documents after the call.

## Run locally (no Docker)
```bash
cp .env.example .env        # put your ANTHROPIC_API_KEY in it
export $(grep -v '^#' .env | xargs)
npm install
npm start                   # http://localhost:3000
```

## Run with Docker
```bash
cp .env.example .env        # edit: ANTHROPIC_API_KEY (and DEMO_PASSCODE)
docker compose up --build -d
```

## Public URL via Cloudflare Tunnel
```bash
cloudflared tunnel --url http://localhost:3000     # prints a https://*.trycloudflare.com URL
```
Set `DEMO_PASSCODE` before sharing the URL: every click spends API credits.

## Layout
```
server/index.js    Express API (extract, evaluate, narrate, receipts, coach chat/score)
server/rules.js    Deterministic rule engine (drives the score, flags and recommendation)
server/claude.js   Claude client (structured JSON output + streaming)
server/prompts/    Roleplay, Q&A and scoring prompts
data/              Policies, claim history, rules, personas, product sheets, sample PDFs
public/            Vanilla JS frontend (views/claims.js, rules.js, academy.js)
scripts/make-docs.js   Regenerates the sample PDFs (npm run make-docs, needs devDependencies)
```

## How the claim score works
Claude reads the documents into structured fields. `server/rules.js` evaluates the active ruleset (R01-R10) against those fields, the policy register and `claims_history.json`; each fired rule adds its weight to the 0-100 score and the strictest fired action sets the recommendation. Claude then writes the plain-language reasoning for the rules that fired. Changing a rule in the UI and clicking **Re-run** recomputes instantly.

Reset the demo state (rules, claims, sessions) by clearing site data in the browser, or run in a fresh window.

See `DEMO_SCRIPT.md` for the talk track.

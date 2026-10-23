# Demo script (about 12 minutes)

**Before the call**: `docker compose up -d --build`, open http://localhost:3894, and run both flows once. Use a fresh browser window. The CRM resets with **Reset demo data**; the customer's claims reset by clearing site data. The header pill says *Demo mode* (no key) or *Live AI*.

Accounts (the login page fills them in for you):
- Customer: `ramon@workforcesolution.demo` / `customer123`
- Agent: `angelo@workforcesolution.demo` / `agent123`

## Files to upload (in `demo-files/`)
- **Claim pack**: `claim-pack/1-claim-form.pdf` ... `5-repair-estimate.pdf`. The **Use the sample claim pack** button loads the same five; to upload by hand, select all five at once.
- **Receipts**: `receipts/receipt-bonifacio-auto-works.pdf` (matches the estimate) and `receipt-parts-supply.pdf` (does not match).

## Opening (30s)
"Two roles today. A customer filing a claim, and a sales agent working leads with an AI assistant. All data is fictional."

## Part 1 - Customer portal (5 min)
1. **Sign in** as the customer (click the *Customer* card, then *Sign in*). "Ramon sees his policy and his claims."
2. **Submit a claim**: click **Submit a claim → Use the sample claim pack → Read my documents**. Narrate while each document is scanned: "Claim form, OR/CR, license, police report, repair estimate. Nobody retypes anything." Fields appear one by one with a confidence score.
3. **Review**: point at the document checklist ("nothing missing, so no back-and-forth") and the policy check ("active on the date of loss"). Click **Submit claim**.
4. **Claim page**: show the status timeline ("under review"). Click a row such as *Estimate total*: the document on the left jumps to the page and shows the exact quote it was read from.
5. **Add a receipt**: click **Add a receipt**, pick the **bonifacio auto works** sample: "Any layout. Vendor, TIN, items, VAT, validity checks, and it matches the estimate." Attach. Optionally show **parts supply**: "different amount, flagged for the customer."
6. **Finish**: click **Demo: move to next step** twice to show *Approved* then *Paid*.

## Part 2 - Agent workspace (6 min)
1. **Sign out, sign in as the agent.** "Angelo's morning: 12 leads, 4 follow-ups due, the pipeline value."
2. **CRM tour (60s)**: filter by stage, search, click **Marites Santos** to open the drawer (notes, activity, edit stage, write email).
3. **Open the floating assistant** (bottom right). Click the suggestions in this order:
   - **Who should I follow up with today?** The assistant lists the due leads.
   - **What does the Personal Accident plan cost for a family of 4?** A plan table with the source cited. "Answers come only from your product sheets; if it isn't there, it says so."
   - **Are motorcycle accidents covered?** Mention the license and helmet condition.
   - **Move Marites Santos to Quoted and follow up Monday.** An action card appears and her row in the list flashes with the new stage and date.
   - **Email Marites the Plus plan quotation.** The email is written from the product sheet; click *View email*; open her drawer to see it logged in the activity.
   - **Add a new lead: Rosa Aquino, Home Fire.** She appears at the top of the list.
4. **Free typing** (needs Live AI; in demo mode keyword replies still work): "Move Carlos Dizon to Won", "Write a note on Joel: asked about roadside assistance".
5. **Products page**: **Ask the assistant about this** on a card.

## Close (30s)
"Pilot: one claims line plus one agent team, with your real product sheets and leads. What would success look like?"

## Presenter notes
- Demo items never depend on the network, so they are safe to click live. Your own uploads and typed chat need a valid `ANTHROPIC_API_KEY`.
- Check the server log on startup: `AI: key OK` or `AI: key check FAILED`.
- The previous adjuster workbench (fraud score, approval rules) was removed from the UI; it is in git history.

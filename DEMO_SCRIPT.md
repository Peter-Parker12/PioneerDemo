# Demo script (about 12 minutes)

**Before the call**: `docker compose up -d --build`, open http://localhost:3894, and run both flows once. Use a fresh browser window. The CRM resets with **Reset demo data**; the customer's claims reset by clearing site data. The header pill says *Demo mode* (no key) or *Live AI*.

Accounts (the login page fills them in for you):
- Customer: `ramon@workforcesolution.demo` / `customer123`
- Claim executive: `maricar@workforcesolution.demo` / `executive123`
- Claim manager: `elena@workforcesolution.demo` / `manager123`
- Agent: `angelo@workforcesolution.demo` / `agent123`

## Files to upload (in `demo-files/`)
- **Claim pack**: `claim-pack/1-claim-form.pdf` ... `5-repair-estimate.pdf`. Each file goes in its own slot on the upload screen (**Attach sample documents** fills all five). `4-police-report.pdf` follows the PNP Traffic Accident Report (TARAS) form, 3 pages.
- **Receipts**: `receipts/receipt-bonifacio-auto-works.pdf` (matches the estimate) and `receipt-parts-supply.pdf` (does not match).

## Opening (30s)
"Two roles today. A customer filing a claim, and a sales agent working leads with an AI assistant. All data is fictional."

## Part 1 - Customer portal (5 min)
1. **Sign in** as the customer (click the *Customer* card, then *Sign in*). "Ramon sees his policy and his claims."
2. **Report the incident**: click **Submit a claim → Fill with sample incident → Continue to documents**. "Ramon tells us what happened: date, place, injuries, police report. We validate the date against his policy period."
3. **Attach documents**: click **Attach sample documents** and watch each slot upload with a progress bar (claim form, OR/CR, license, police report, repair estimate; the damage photos slot is optional). Optionally try a `.txt` file in a slot to show the file-type check. Click **Read my documents** and narrate the scan: "Nobody retypes anything." Fields appear one by one with a confidence score; the police report is a real TARAS form.
4. **Review**: point at the document checklist, the policy check, and **Checked against what you told us** ("his date, place and plate agree with the documents; if they didn't, the claims officer would be told"). Click **Submit claim**: the claim page opens with a confirmation banner and reference number.
5. **Claim page**: show the status timeline ("under review"). Click a row such as *Estimate total*: the document on the left jumps to the page and shows the exact quote it was read from.
6. **Add a receipt**: click **Add a receipt**, pick the **bonifacio auto works** sample: "Any layout. Vendor, TIN, items, VAT, validity checks, and it matches the estimate." Attach. Optionally show **parts supply**: "different amount, flagged for the customer."
7. **Finish**: click **Demo: move to next step** twice to show *Approved* then *Paid*.

## Part 2 - Claim executive and manager (4 min)
1. **Sign out, sign in as the claim executive** (Maricar). "The claim Ramon just submitted is at the top of her queue, marked New." Open it: the risk score 74 (High), the four rules that fired (early claim, repeat claim on the same car, shop concentration, estimate above typical), the AI's suggested action, and the extracted data and documents side by side.
2. Click **Escalate to manager**, keep the prefilled note or write one, and confirm. "The customer is not told why; they only see Under review."
3. **Sign out, sign in as the claim manager** (Elena). **Needs your review** lists the escalated cases with the executive's note, highlighted; **Team** and the **Case queue** show who handled what. Open the case.
4. **Rule management**: change **R07 early-claim window 30 to 15**, optionally delete a rule, or click **Add rule** (for example "Night-time loss": hour of the loss is at least 21, adds 10 points, suggests Review), then **Publish update** with a note. The toast shows the claim re-scored (74 to 52). Open the case again to see the new score. **Reset to defaults** restores the rules.
5. Back on the case, **Approve**, **Reject** or **Return to executive** with a comment. Sign in as the customer to show the updated status.

## Part 3 - Agent workspace (6 min)
1. **Sign out, sign in as the agent.** "Angelo's morning: 12 leads, 4 follow-ups due, the pipeline value."
2. **CRM tour (60s)**: lead list on the left, details in the centre. Filter by stage, search, click **Marites Santos** (notes, activity, edit stage, write email).
3. **Use the assistant panel** (docked on the right; the Assistant tab reopens it). Click the suggestions in this order:
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
- Claims are stored in server memory: restarting the container clears submitted claims, rule changes and CRM edits. Keep the server running between the customer, executive and manager steps.

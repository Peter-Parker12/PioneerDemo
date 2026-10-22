# Demo script (about 12 minutes)

**Before the call**: start the app and tunnel, open the URL once (enter passcode), click "Approval rules → Reset to Pioneer defaults", and run the whole flow once to warm up. Use a fresh browser window. Have a real receipt ready on your phone or desktop (a restaurant or hardware-store receipt is fine).

## Opening (30s)
"Two things today: how AI takes weight off your claims team, and how it helps new sales agents get ready faster. All data is dummy, but the AI is live, so you'll see it read real documents."

## Part 1 - Claims (7 min)

1. **Queue (30s)**: "This is an adjuster's morning: open claims, risk score per claim, and what we've already auto-triaged. Intake takes about 32 minutes manually; here it's about four."
2. **Upload (30s)**: Click **＋ Upload claim → Use sample claim pack → Process claim**. "Claimants send a mix of PDFs and photos: claim form, OR/CR, license, police report, repair estimate."
3. **Claim opens (60s)**: Point at the progress steps, then the split screen. "Documents on the left, the AI's work on the right." Click a field row (e.g. *Estimate total*): "Every value shows where it was read and how confident the AI is. No retyping." Show the **Document checklist**: "All five required documents are present, so no back-and-forth with the claimant."
4. **Fraud score (90s)**: Gauge shows 74, High. "Not just a number. Four reasons, each tied to a rule." Walk through:
   - R07: loss came 19 days after the policy started.
   - R08: same car, same damage, claimed in June (open **Similar claims found**). "The June repair was never completed, the policy lapsed, then it was re-bought."
   - R09: this repair shop is on three other claims this year.
   - R06: estimate is 31% above the typical cost for this repair.
   "Rules find the pattern, the AI explains it in plain language an adjuster can defend. It never says 'fraud', it says 'review this'."
5. **Your own receipt (60s)**: Click **Try your own receipt**, drop the audience's receipt (or a sample). "Any layout." Show vendor, TIN, items, VAT, validity checks. Then pick the **bonifacio auto works** sample → **Attach**: "Matches the estimate, so rule R10 passes." Optionally attach the **parts supply** sample to show the mismatch flag and score going up.
6. **Your rules (90s)**: Click **Edit rules**. "These ten rules mirror typical motor-policy conditions. Your team owns them, not us." Change: **R07 window 30 → 15**, **R09 claims at shop 3 → 5**. Click **Back to claim and re-run**: score drops from 74 to 38 with the rule IDs cited. Then in rules set **R08 action → Adjuster review**: re-run, the outcome drops from "Escalate to SIU" to "Adjuster review". For the finish, switch off R06 and R08 and set the **R05 limit to 100,000**: re-run → score 0, "Fast-track approval". "Compliance can tune this without a developer." Reset to defaults.
7. **Decision (45s)**: Back on the claim at defaults, click **Escalate to SIU**, confirm the prefilled note. "AI recommends, the adjuster decides. Everything is in the audit trail." Back to the queue: status changed.
8. **Takeaway (15s)**: Point at **Coming next**: "The same engine reads underwriting submissions and policy-service requests."

## Part 2 - Sales agent training (4 min)

1. **Q&A (45s)**: Open **Agent academy → Product Q&A**. Click "Ano ang covered ng personal accident plan kapag nasa motor ako?" "Answers only from your product sheets, with the section cited. If it isn't in the sheet, it says so."
2. **Roleplay (2 min)**: **Roleplay coach → Marites → Start roleplay**. You play the agent. Suggested lines:
   - "Magandang araw po, Ma'am Marites. Kumusta po kayo? Ano po ang pinaka-concern ninyo para sa pamilya?"
   - (when she raises price) "Naiintindihan ko po. Magkano po ang monthly budget na komportable sa inyo?"
   - (trust) "Valid po ang concern ninyo. Ganito po ang proseso ng claim: 10 working days po kapag kumpleto ang documents, at 3 days para ma-release ang bayad."
   - (close) "Gusto po ba ninyong padalhan ko kayo ng quotation na maipakita ninyo sa mister ninyo ngayong gabi?"
   Point at the mood meter moving. Use **Show hint** once if you want to show the coaching.
3. **Score + dashboard (60s)**: Click **End session and get score**. "Five criteria, each with a quote from what you actually said, and a stronger phrasing to try." Click **See my progress**: "Managers see trends, the leaderboard and the team's common weak spots."

## Close (30s)
"Suggested pilot: 4-6 weeks on one line, motor claims intake, plus one agent cohort, using your real product sheets and sample claims. What would success look like for you?"

## Presenter notes
- The hero claim pack and the Marites scenario are the only built paths; the other personas are placeholders.
- AI calls take a few seconds. Fill the wait with the talk track above.
- If the claim page is stuck on skeleton lines, the narration call failed (check the API key / network); the rules and score still work.
- Pioneer's real policy wording and product terms are not in the demo; say so if asked.

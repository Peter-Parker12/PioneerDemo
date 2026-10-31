// Canned results for the built-in demo items. They are returned instantly (the browser plays the
// animation), so the demo never depends on the network, the API key or model latency.

const f = (key, label, value, confidence, source_doc, source_quote) => ({ key, label, value, confidence, source_doc, source_quote });

export const SAMPLE_CLAIM_PACK = "hero-claim";

export const heroClaim = {
  documents: [
    { filename: "1-claim-form.pdf", doc_type: "claim_form", summary: "Motor claim form signed by Ramon A. Dela Cruz for a front-end collision on 2 October 2026." },
    { filename: "2-or-cr.pdf", doc_type: "or_cr", summary: "LTO registration for a 2024 Toyota Vios, plate NCX 4821, registered to the claimant." },
    { filename: "3-drivers-license.pdf", doc_type: "drivers_license", summary: "Valid driver's license for Ramon Abad Dela Cruz, expires 14 March 2031." },
    { filename: "4-police-report.pdf", doc_type: "police_report", summary: "PNP Traffic Accident Report (TARAS form) no. 2026-10-3381, QCPD Station 3: property-damage-only collision on 2 October 2026, 2140H, hit and run by an unidentified motorcycle; no injuries." },
    { filename: "5-repair-estimate.pdf", doc_type: "repair_estimate", summary: "Bonifacio Auto Works estimate EST-26-1187 for PHP 86,400.00 (VAT inclusive)." },
  ],
  fields: [
    f("claimant_name", "Claimant", "Ramon A. Dela Cruz", 0.99, "1-claim-form.pdf", "Insured / Claimant Ramon A. Dela Cruz"),
    f("policy_no", "Policy number", "WFS-MC-2026-004417", 0.99, "1-claim-form.pdf", "Policy No. WFS-MC-2026-004417"),
    f("vehicle", "Vehicle", "2024 Toyota Vios 1.3 XLE, Silver", 0.98, "2-or-cr.pdf", "Toyota / Vios 1.3 XLE  Year model 2024  Color Silver"),
    f("plate_no", "Plate number", "NCX 4821", 0.99, "2-or-cr.pdf", "Plate No. NCX 4821"),
    f("loss_date", "Date and time of loss", "2 October 2026, about 9:40 PM", 0.97, "1-claim-form.pdf", "Date and time of loss 02 October 2026, approx. 9:40 PM"),
    f("loss_location", "Place of loss", "Commonwealth Ave. cor. Tandang Sora Ave., Quezon City", 0.96, "1-claim-form.pdf", "Place of loss Commonwealth Ave. cor. Tandang Sora Ave., Quezon City"),
    f("loss_type", "Type of loss", "Own damage - front collision", 0.95, "1-claim-form.pdf", "Type of loss Own damage - collision"),
    f("narrative", "What happened", "A motorcycle swerved into the lane; the vehicle hit the concrete island. No injuries.", 0.93, "1-claim-form.pdf", "a motorcycle suddenly swerved into my lane ... the front of my vehicle hit the concrete island"),
    f("driver_name", "Driver", "Ramon A. Dela Cruz (insured)", 0.98, "1-claim-form.pdf", "Driver at time of loss Ramon A. Dela Cruz (insured)"),
    f("license_no", "License number", "N03-26-123456", 0.97, "3-drivers-license.pdf", "License No. N03-26-123456"),
    f("license_expiry", "License expires", "14 March 2031", 0.98, "3-drivers-license.pdf", "Expiration date 14 March 2031"),
    f("police_blotter", "Police report no.", "2026-10-3381", 0.98, "4-police-report.pdf", "1. REPORT NO. 2026-10-3381"),
    f("police_station", "Police station", "QCPD Station 3 (Batasan)", 0.97, "4-police-report.pdf", "3. POLICE STATION QCPD Station 3 (Batasan)"),
    f("police_severity", "Accident severity", "Property damage only; hit and run", 0.95, "4-police-report.pdf", "9. ACCIDENT SEVERITY D. Property Damage Only ... 28. HIT & RUN 1. Yes"),
    f("reported_date", "Claim reported", "12 October 2026", 0.97, "1-claim-form.pdf", "Date claim reported 12 October 2026"),
    f("repair_shop", "Repair shop", "Bonifacio Auto Works", 0.99, "5-repair-estimate.pdf", "BONIFACIO AUTO WORKS ... Collision repair and repainting"),
    f("estimate_no", "Estimate number", "EST-26-1187", 0.98, "5-repair-estimate.pdf", "Estimate No. EST-26-1187"),
    f("estimate_total", "Estimate total", "PHP 86,400.00", 0.99, "5-repair-estimate.pdf", "TOTAL ESTIMATE (VAT inclusive) 86,400.00"),
  ],
  normalized: {
    policy_no: "WFS-MC-2026-004417",
    claimant_name: "Ramon A. Dela Cruz",
    driver_name: "Ramon A. Dela Cruz",
    plate_no: "NCX 4821",
    vehicle_model: "Toyota Vios",
    loss_date: "2026-10-02",
    reported_date: "2026-10-12",
    loss_location: "Commonwealth Ave. cor. Tandang Sora Ave., Quezon City",
    license_expiry: "2031-03-14",
    repair_shop: "Bonifacio Auto Works",
    estimate_total: 86400,
    damage_categories_note: "Front bumper, right headlamp, hood",
    damage_category: "front_collision",
    damage_areas: ["front bumper", "right headlamp", "hood"],
  },
};

const line = (description, amount) => ({ description, qty: 1, amount });
const check = (c, passed, note) => ({ check: c, passed, note });

export const receipts = {
  "receipt-bonifacio-auto-works.pdf": {
    is_receipt: true, document_type: "Sales Invoice",
    vendor_name: "Bonifacio Auto Works", vendor_tin: "214-889-307-000", vendor_address: "118 Aurora Blvd., Quezon City",
    invoice_no: "007731", date: "2026-10-11",
    line_items: [
      line("Front bumper cover", 14500), line("Right headlamp assembly", 21800), line("Hood repair and repaint", 9600),
      line("Radiator support straighten", 6200), line("Front bumper reinforcement", 5300), line("Labor", 18000), line("Paint and materials", 11000),
    ],
    subtotal: 77142.86, vat: 9257.14, total: 86400, payment_method: "Cash",
    checks: [
      check("TIN present", true, "214-889-307-000"), check("Invoice number present", true, "No. 007731"),
      check("Date present", true, "11 October 2026"), check("Total present", true, "PHP 86,400.00"),
      check("Line items add up to total", true, "Items sum to PHP 86,400.00"),
    ],
    confidence: 0.98, notes: "Matches the repair estimate EST-26-1187.",
  },
  "receipt-parts-supply.pdf": {
    is_receipt: true, document_type: "Official Receipt",
    vendor_name: "Kalookan Auto Parts Supply", vendor_tin: "188-402-915-000", vendor_address: "Rizal Ave. Ext., Caloocan City",
    invoice_no: "0048812", date: "2026-10-08",
    line_items: [line("Headlamp assy RH - Vios 2023+", 16900), line("Front bumper cover Vios 2023+", 9800)],
    subtotal: 26700, vat: 0, total: 26700, payment_method: "GCash",
    checks: [
      check("TIN present", true, "188-402-915-000"), check("Invoice number present", true, "OR No. 0048812"),
      check("Date present", true, "08 October 2026"), check("Total present", true, "PHP 26,700.00"),
      check("Line items add up to total", true, "Items sum to PHP 26,700.00"),
    ],
    confidence: 0.97, notes: "Parts purchase by the repair shop, not the full repair. Amount is lower than the estimate.",
  },
};

// Canned product answers used when the live model is unavailable. Keywords are lowercase.
export const faq = [
  { keys: ["motorcycle", "motor bike", "rider"], answer:
`Yes, the **Family Protect Personal Accident** plan covers accidents as a driver or passenger of a motorcycle, as long as the rider holds a valid license and wears a helmet.
- Riders without a valid license or without a helmet are excluded.
- [Source: Family Protect Personal Accident Plan, sections 3 and 4]

Tip for the client conversation: say "ride safe, you're covered" and mention the helmet and license condition up front so there are no surprises at claim time.` },
  { keys: ["exclusion", "not covered", "excluded"], answer:
`Main exclusions of the **Family Protect Personal Accident** plan:
- Suicide or self-inflicted injury, and illness or disease of any kind
- Racing, professional sports, and hazardous activities such as skydiving or deep scuba diving
- Injuries while under the influence of alcohol or illegal drugs
- War and riots where the member is an active participant
- Pre-existing physical defects or injuries
- Motorcycle riders without a valid license or helmet
[Source: Family Protect Personal Accident Plan, section 4]

Tip for the client conversation: lead with what is covered, then say "here are the few things we don't cover" so it sounds honest, not defensive.` },
  { keys: ["waiting"], answer:
`There is **no waiting period for accidents**. Cover starts on the effective date. The hospital income benefit starts after a 24-hour confinement.
[Source: Family Protect Personal Accident Plan, section 6]` },
  { keys: ["plus", "premium", "price", "how much", "cost", "family of 4", "plans"], answer:
`Annual premium for a family of 4 on the **Family Protect Personal Accident** plan:

| Plan | Death / disability | Medical reimbursement | Daily hospital income | Premium |
|---|---|---|---|---|
| Basic | PHP 100,000 | PHP 10,000 | PHP 500/day, up to 30 days | PHP 1,490 |
| Plus | PHP 250,000 | PHP 25,000 | PHP 1,000/day, up to 30 days | PHP 2,990 |
| Max | PHP 500,000 | PHP 50,000 | PHP 1,500/day, up to 45 days | PHP 5,490 |

Quarterly payment adds a 3% instalment charge. [Source: Family Protect Personal Accident Plan, section 2]

Tip for the client conversation: Plus works out to about PHP 8 a day for the whole family.` },
  { keys: ["philhealth", "hmo"], answer:
`The plan pays a fixed cash benefit and reimburses accident medical costs **on top of** PhilHealth or an HMO. Benefits are not reduced because the member also has PhilHealth.
[Source: Family Protect Personal Accident Plan, section 5]

Tip for the client conversation: "PhilHealth pays the hospital; this plan pays you."` },
  { keys: ["claim", "file", "how long", "turnaround", "document"], answer:
`How claims work:
1. Notify the company within 30 days (phone, email, or through the agent).
2. Submit the claim form with supporting documents. The claim is acknowledged within 1 working day.
3. Complete documents are decided within **10 working days**; payment is released within **3 working days** of approval (bank transfer or GCash).
4. Claims under PHP 20,000 with complete documents can be fast-tracked.
[Source: Claims Process and Service Commitments, sections 1 and 3]` },
  { keys: ["fire", "home", "house", "condo", "flood"], answer:
`**Home Protect Fire and Allied Perils** covers fire, lightning, explosion, earthquake shock, typhoon, flood and riot for the structure and contents, up to the sum insured. Premiums start at PHP 1,800 a year for a PHP 1,000,000 sum insured.
- Not covered: intentional damage, theft without forced entry, war, nuclear risks, and properties storing flammable goods.
- Notify within 7 days of a loss.
[Source: Home Protect Fire and Allied Perils, sections 1, 2 and 3]` },
  { keys: ["car", "vehicle", "motor comprehensive", "own damage", "deductible"], answer:
`**Motor Car Comprehensive** covers own damage (collision, fire, theft, and natural perils with the Acts of Nature extension), third-party property damage and bodily injury up to PHP 500,000 each, personal accident cover of PHP 50,000 per seat, and roadside assistance.
- Rates start at about 2.5% of the sum insured per year; the deductible is PHP 3,000 per own-damage claim for vehicles up to PHP 1M.
- Report claims within 30 days. Own-damage claims up to PHP 50,000 with complete documents may be fast-tracked.
[Source: Motor Car Comprehensive Insurance, sections 1, 2 and 4]` },
];

export const faqFallback =
`I couldn't find that in the product sheets, so I won't guess. Please check with the product team.

I can help with the **Personal Accident**, **Motor Comprehensive** and **Home Fire** products, and with claims process questions. I can also update leads and send emails for you.`;

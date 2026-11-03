// Sample document packs for the pre-loaded claims, so the executive and the manager can open real files on any claim.
// Writes data/claims/seed/<claim id>/*.pdf and data/claims/seed/manifest.json (read by server/claims.js).
import fs from "fs";
import path from "path";
import { taras } from "./taras.js";

const CLAIMS = [
  { id: "CLM-2026-1031", kind: "motor", insured: "Dennis C. Uy", addr: "88 Acacia St., Brgy. Wack-Wack, Mandaluyong City", mobile: "0919 555 0109", policy: "WFS-MC-2026-002281",
    vehicle: "2023 Honda City 1.5 V, White", plate: "DAK 7316", lossDate: "2026-10-14", lossTime: "1845H", reported: "2026-10-15", place: "EDSA cor. Shaw Blvd., Mandaluyong City",
    narrative: "While stopped in traffic on EDSA, my vehicle was hit from behind by another car. The rear bumper and trunk lid were damaged. No one was injured.", damage: ["Rear bumper cover (replace)", "Trunk lid (repair and repaint)", "Rear lamp assembly LH (replace)", "Labor", "Paint and materials"], items: [18200, 15600, 9800, 16000, 11700],
    shop: "Greenhills Collision Center", shopTin: "305-118-442-000", est: "EST-26-2204", police: { collision: 2, damageCode: 3, desc: "rear bumper, trunk lid, left rear lamp", direction: "3 - East" } },
  { id: "CLM-2026-1024", kind: "motor", insured: "Angelica F. Reyes", addr: "14 Sampaguita Lane, Brgy. Kapitolyo, Pasig City", mobile: "0916 555 0154", policy: "WFS-MC-2026-001916",
    vehicle: "2022 Mitsubishi Mirage G4, Red", plate: "NBR 4408", lossDate: "2026-10-12", lossTime: "0715H", reported: "2026-10-12", place: "C5 Road, Brgy. Ugong, Pasig City",
    narrative: "Another car backed into the front of my parked vehicle at a gas station. The front bumper is cracked. No injuries.", damage: ["Front bumper cover (replace)", "Grille (replace)", "Labor", "Paint and materials"], items: [12400, 4200, 11000, 7800],
    shop: "Ortigas Auto Body", shopTin: "290-774-318-000", est: "EST-26-0911", police: { collision: 8, damageCode: 2, desc: "front bumper and grille", direction: "1 - North" } },
  { id: "CLM-2026-1017", kind: "motor", insured: "Teresita G. Cruz", addr: "5 Mabini St., Brgy. Santo Rosario, Malolos, Bulacan", mobile: "0918 555 0121", policy: "WFS-MC-2026-003340",
    vehicle: "2021 Toyota Innova 2.8 E, Grey", plate: "NDE 9051", lossDate: "2026-09-23", lossTime: "2010H", reported: "2026-10-14", place: "MacArthur Highway, Brgy. Longos, Malolos, Bulacan",
    narrative: "My vehicle collided with a pickup that stopped suddenly ahead. The pickup owner and a passenger complained of neck pain. The front of my vehicle was damaged.", damage: ["Front bumper cover (replace)", "Hood panel (replace)", "Radiator and condenser (replace)", "Headlamp assemblies (replace)", "Labor", "Paint and materials"], items: [14800, 18900, 21500, 19400, 12000, 9900],
    shop: "Bonifacio Auto Works", shopTin: "214-889-307-000", est: "EST-26-1245", third: "Third-party: pickup (plate DAX 5532) and one passenger with neck pain; see police report.", police: { collision: 2, damageCode: 2, desc: "front end, hood, radiator and headlamps", direction: "1 - North", injury: true } },
  { id: "CLM-2026-1006", kind: "motor", insured: "Maribel S. Ramos", addr: "21 Rizal St., Brgy. Real, Calamba, Laguna", mobile: "0923 555 0145", policy: "WFS-MC-2026-001502",
    vehicle: "2020 Suzuki Ertiga GL, Silver", plate: "CAZ 2217", lossDate: "2026-10-08", lossTime: "1620H", reported: "2026-10-09", place: "National Road, Brgy. Parian, Calamba, Laguna",
    narrative: "A tricycle swerved and scraped the right side of my vehicle. The right front fender and door were scratched. No one was hurt.", damage: ["Right front fender (repair and repaint)", "Right front door skin (repaint)", "Labor", "Paint and materials"], items: [7800, 5400, 8200, 7500],
    shop: "Calamba Auto Repair", shopTin: "301-552-109-000", est: "EST-26-0577", police: { collision: 4, damageCode: 4, desc: "right front fender and door", direction: "2 - South" } },
  { id: "CLM-2026-1003", kind: "motor", insured: "Rodel P. Santos", addr: "302 Aurora Heights, Brgy. Socorro, Quezon City", mobile: "0917 555 0173", policy: "WFS-MC-2026-002874",
    vehicle: "2019 Toyota Hilux 2.4 G, Black", plate: "NBH 6620", lossDate: "2026-10-05", lossTime: "2250H", reported: "2026-10-07", place: "Aurora Blvd. cor. P. Tuazon, Cubao, Quezon City", driver: "Mark P. Santos (cousin of the insured)",
    narrative: "My cousin Mark was driving the pickup when he hit a concrete barrier on Aurora Boulevard. The front bumper and left headlamp were damaged.", damage: ["Front bumper (replace)", "Left headlamp assembly (replace)", "Labor", "Paint and materials"], items: [15600, 19800, 9600, 7000],
    shop: "Cubao Motors Repair", shopTin: "277-409-860-000", est: "EST-26-1630", police: { collision: 6, damageCode: 2, desc: "front bumper and left headlamp", direction: "3 - East", driver: "SANTOS, MARK PEREZ" } },
  { id: "CLM-2026-1011", kind: "theft", insured: "Bernard K. Co", addr: "9 Mahogany Ave., Brgy. Molino III, Bacoor, Cavite", mobile: "0917 555 0183", policy: "WFS-MC-2026-003911",
    vehicle: "2017 Toyota Vios 1.3 E, Silver", plate: "NAN 5527", lossDate: "2026-10-01", lossTime: "between 2200H and 0600H", reported: "2026-10-12", place: "In front of the insured's residence, Brgy. Molino III, Bacoor, Cavite", value: 610000,
    narrative: "I parked the vehicle outside my house at about 10 PM. The next morning it was gone. I did not hear anything during the night." },
  { id: "CLM-2026-1029", kind: "fire", insured: "Rosalie B. Navarro", addr: "Lot 12 Blk 5, Sampaguita St., Brgy. San Isidro, Taytay, Rizal", mobile: "0922 555 0136", policy: "WFS-HF-2026-000418",
    lossDate: "2026-10-09", lossTime: "0300H", reported: "2026-10-18", place: "Lot 12 Blk 5, Sampaguita St., Brgy. San Isidro, Taytay, Rizal", amount: 420000,
    narrative: "A fire started in the kitchen at around 3 AM and spread to the living room and the second floor before neighbours helped put it out. No one was hurt. The roof and the second-floor ceiling were damaged." },
  { id: "CLM-2026-1019", kind: "accident", insured: "Felix T. Mercado", addr: "17 Dahlia St., Brgy. Buhangin, Davao City", mobile: "0921 555 0188", policy: "WFS-PA-2026-001077",
    lossDate: "2026-10-02", lossTime: "0630H", reported: "2026-10-15", place: "Diversion Road, Brgy. Matina, Davao City", amount: 58000,
    narrative: "While riding my motorcycle to work, I skidded on a wet road and fell. I wore a helmet. I was brought to Davao Doctors Hospital and treated for a fractured left wrist and cuts." },
];

const money = (n) => "PHP " + n.toLocaleString("en-PH", { minimumFractionDigits: 2 });
const long = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

export function makeSeedDocs({ make, title, rows, table, root, heroTaras }) {
  const dir = path.join(root, "data/claims/seed");
  fs.rmSync(dir, { recursive: true, force: true });
  const manifest = {};

  for (const c of CLAIMS) {
    const out = path.join(dir, c.id);
    fs.mkdirSync(out, { recursive: true });
    const docs = [];
    const add = (file, slot, doc_type, summary, draw, margin) => { make(path.join(out, file), draw, margin); docs.push({ file, slot, doc_type, summary }); };
    const total = c.items ? c.items.reduce((a, b) => a + b, 0) : 0;

    // ----- claim form (all kinds) -----
    add("1-claim-form.pdf", "Claim form", "claim_form", `${c.kind === "fire" ? "Fire" : c.kind === "accident" ? "Personal accident" : c.kind === "theft" ? "Motor theft" : "Motor"} claim form signed by ${c.insured}, loss on ${long(c.lossDate)}.`, (d) => {
      const heading = { motor: "MOTOR INSURANCE CLAIM FORM", theft: "MOTOR INSURANCE CLAIM FORM (THEFT)", fire: "FIRE AND ALLIED PERILS CLAIM FORM", accident: "PERSONAL ACCIDENT CLAIM FORM" }[c.kind];
      title(d, heading, "Illustrative sample - fictional data");
      const base = [["Policy No.", c.policy], ["Insured / Claimant", c.insured], ["Address", c.addr], ["Mobile", c.mobile]];
      if (c.vehicle) base.push(["Insured vehicle", c.vehicle], ["Plate No.", c.plate]);
      base.push(["Date and time of loss", `${long(c.lossDate)}, ${c.lossTime}`], ["Place of loss", c.place]);
      if (c.kind === "motor") base.push(["Driver at time of loss", c.driver || c.insured + " (insured)"], ["Type of loss", c.third ? "Own damage and third-party" : "Own damage - collision"]);
      if (c.kind === "theft") base.push(["Type of loss", "Theft of the entire vehicle"], ["Claimed value", money(c.value)]);
      if (c.kind === "fire") base.push(["Type of loss", "Fire - residential building and contents"], ["Amount claimed", money(c.amount)]);
      if (c.kind === "accident") base.push(["Type of loss", "Accidental injury - motorcycle fall"], ["Amount claimed", money(c.amount)]);
      base.push(["Date claim reported", long(c.reported)]);
      rows(d, base);
      d.moveDown(0.5).font("Helvetica-Bold").fontSize(10).text(c.kind === "accident" ? "Narrative of the accident" : "Narrative of the loss");
      d.font("Helvetica").fontSize(10).text(c.narrative + (c.third ? " " + c.third : ""), { width: 495 });
      d.moveDown(2).text(`Signed: ${c.insured}          Date: ${long(c.reported)}`);
    });

    // ----- motor collision: police report (TARAS) + repair estimate -----
    if (c.kind === "motor") {
      const p = c.police;
      const date = new Date(c.lossDate + "T00:00:00Z");
      const weekday = date.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
      const f = structuredClone(heroTaras);
      Object.assign(f, {
        reportNo: `2026-${c.id.slice(-4)}`, station: "Local police station", sketch: { road: c.place.split(",")[0].toUpperCase(), road2: c.place.includes(" cor. ") ? c.place.split(" cor. ")[1].split(",")[0].toUpperCase() : "SIDE STREET", v1: `V1 ${c.vehicle.split(",")[0]} ${c.plate}  >>>`, v2: "V2 other vehicle", impact: "Point of impact", note: "Scene: " + c.place }, date: long(c.reported).replace(/ (\d{4})$/, " $1"),
        month: c.lossDate.slice(5, 7), day: c.lossDate.slice(8, 10), year: c.lossDate.slice(0, 4), dateLong: long(c.lossDate), weekday, time: c.lossTime,
        severity: p.injury ? 3 : 4, vehicles: 2, driverCas: 0, paxCas: p.injury ? 1 : 0, pedCas: 0,
        collision: p.collision, hitRun: 2, place: c.place.split(",").slice(-2).join(",").trim(), road: c.place.split(",")[0],
        landmark1: "See sketch map", landmark2: "-", road2: c.place.includes(" cor. ") ? c.place.split(" cor. ")[1].split(",")[0] : "-",
        description: `On ${long(c.lossDate)} at about ${c.lossTime}, a ${c.vehicle.split(",")[0]} plate ${c.plate} driven by ${p.driver || c.insured.toUpperCase()} was involved in a traffic accident at ${c.place}. ${c.narrative} Damage to Vehicle 1: ${p.desc}. ${p.injury ? "One passenger of the other vehicle complained of neck pain and was advised to see a doctor." : "No injuries were reported."}`,
        statement1: c.narrative, action: `Incident entered in the station blotter on ${long(c.reported)}, entry no. 2026-${c.id.slice(-4)}.`,
        recommendation: "Issue a certified true copy of this report to the insurer upon request.", status: p.injury ? "Under investigation. Possible third-party claim." : "Closed. Property damage only.",
        investigator: "PO2 JOSEPH L. REYES", supervisor: "PCPT ROMEO D. LIM",
      });
      f.v1 = { ...f.v1, plate: c.plate, driver: p.driver || c.insured.toUpperCase(), owner: `${c.insured}, ${c.addr}`, insurance: `Workforce Solutions, Policy ${c.policy}`, make: c.vehicle.split(" ")[1], model: c.vehicle.split(",")[0].split(" ").slice(2).join(" ") + " / " + c.vehicle.split(" ")[0], damage: `2 - Front (${p.desc})`, direction: p.direction, engine: "On file with LTO", chassis: "On file with LTO", license: "On file", licenseType: "Non-professional", orcr: "On file" };
      f.v2 = { ...f.v2, plate: "On record", driver: "Other driver, details in the report", model: "Other vehicle", type: "5 - Car", maneuver: "8 - Going ahead", direction: p.direction, damage: "Unknown", maneuverText: "" };
      add("2-police-report.pdf", "Police report", "police_report", `PNP Traffic Accident Report (TARAS form) no. 2026-${c.id.slice(-4)} for the incident on ${long(c.lossDate)}${p.injury ? ", with a possible third-party injury" : ", property damage only"}.`, (d) => taras(d, f), 24);

      add("3-repair-estimate.pdf", "Repair estimate", "repair_estimate", `${c.shop} estimate ${c.est} for ${money(total)} (VAT inclusive).`, (d) => {
        title(d, c.shop.toUpperCase(), `Collision repair and repainting - TIN ${c.shopTin} VAT`);
        d.font("Helvetica-Bold").fontSize(13).text("REPAIR ESTIMATE", { align: "center" }).moveDown(0.5);
        rows(d, [["Estimate No.", c.est], ["Date", long(c.reported)], ["Customer", c.insured], ["Vehicle / Plate", `${c.vehicle.split(",")[0]} / ${c.plate}`], ["Insurer / Policy", `Workforce Solutions, Policy ${c.policy}`]]);
        d.moveDown(0.5);
        table(d, ["Description", "Amount (PHP)"], c.damage.map((n, i) => [n, c.items[i].toLocaleString("en-PH", { minimumFractionDigits: 2 })]), [395, 100]);
        d.moveDown(0.5);
        const vat = Math.round((total / 1.12) * 0.12 * 100) / 100;
        rows(d, [["VATable sales", (total - vat).toLocaleString("en-PH", { minimumFractionDigits: 2 })], ["VAT 12%", vat.toLocaleString("en-PH", { minimumFractionDigits: 2 })], ["TOTAL ESTIMATE (VAT inclusive)", total.toLocaleString("en-PH", { minimumFractionDigits: 2 })]]);
      });
    }

    // ----- theft: blotter extract (not certified) + OR/CR -----
    if (c.kind === "theft") {
      add("2-police-blotter-extract.pdf", "Police blotter extract", "police_report", `Uncertified blotter extract: theft of ${c.plate} reported on ${long(c.reported)}, eleven days after the loss.`, (d) => {
        title(d, "PHILIPPINE NATIONAL POLICE - BACOOR CITY POLICE STATION", "Extract of blotter entry (not a certified true copy) - Illustrative sample");
        rows(d, [["Blotter entry no.", "2026-10-5120"], ["Date reported", `${long(c.reported)}, 0945H`], ["Date / time of incident", `${long(c.lossDate)}, ${c.lossTime}`], ["Place of incident", c.place], ["Complainant", c.insured], ["Vehicle", `${c.vehicle.split(",")[0]}, plate ${c.plate}`], ["Nature", "Carnapping / theft of motor vehicle"]]);
        d.moveDown(0.5).font("Helvetica").fontSize(10).text("Complainant states that he parked the vehicle outside his residence the night before and found it missing in the morning. He reported the incident eleven days later.", { width: 495 });
        d.moveDown(2).text("Desk Officer: PSSg. R. Dimaculangan          This extract is not certified.");
      });
      add("3-or-cr.pdf", "LTO OR/CR", "or_cr", `LTO registration for a ${c.vehicle.split(",")[0]}, plate ${c.plate}, in the name of ${c.insured}.`, (d) => {
        title(d, "LAND TRANSPORTATION OFFICE", "Certificate of Registration (CR) and Official Receipt (OR) - Illustrative sample");
        rows(d, [["CR No.", "301274958"], ["OR No.", "6620194477"], ["Plate No.", c.plate], ["Make / Series", "Toyota / Vios 1.3 E"], ["Year model", "2017"], ["Color", "Silver"], ["Engine No.", "2NZ-6671190"], ["Chassis No.", "MR2K29F37H0112345"], ["Registered owner", c.insured.toUpperCase()], ["Address", c.addr], ["Registration valid until", "31 October 2026"]]);
      });
    }

    // ----- fire: proof of ownership + contractor estimate (no BFP report on file) -----
    if (c.kind === "fire") {
      add("2-proof-of-ownership.pdf", "Proof of ownership", "other", `Transfer Certificate of Title extract showing ${c.insured} as registered owner of the burned property.`, (d) => {
        title(d, "REGISTRY OF DEEDS - PROVINCE OF RIZAL", "Transfer Certificate of Title - certified extract - Illustrative sample");
        rows(d, [["TCT No.", "T-402918"], ["Registered owner", c.insured], ["Property", c.addr], ["Lot area", "120 square metres"], ["Improvements", "Two-storey residential house"], ["Encumbrances", "None annotated"]]);
      });
      const items = [["Roof framing and G.I. sheets", 138000], ["Second-floor ceiling and partitions", 96000], ["Kitchen cabinets and fixtures", 74000], ["Electrical rewiring", 52000], ["Labor", 60000]];
      add("3-contractor-estimate.pdf", "Repair estimate", "repair_estimate", `RB Builders repair estimate for ${money(c.amount)}.`, (d) => {
        title(d, "RB BUILDERS AND CONSTRUCTION", "Taytay, Rizal - TIN 266-310-745-000 VAT");
        d.font("Helvetica-Bold").fontSize(13).text("REPAIR ESTIMATE - FIRE DAMAGE", { align: "center" }).moveDown(0.5);
        rows(d, [["Estimate No.", "RB-26-0316"], ["Date", long(c.reported)], ["Client", c.insured], ["Property", c.addr]]);
        d.moveDown(0.5);
        table(d, ["Description", "Amount (PHP)"], items.map(([n, a]) => [n, a.toLocaleString("en-PH", { minimumFractionDigits: 2 })]), [395, 100]);
        d.moveDown(0.5);
        rows(d, [["TOTAL ESTIMATE", c.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })]]);
      });
    }

    // ----- personal accident: medical certificate + hospital statement (14% below the claim) + barangay certification -----
    if (c.kind === "accident") {
      add("2-medical-certificate.pdf", "Medical certificate", "other", "Davao Doctors Hospital certificate: fractured left wrist and lacerations, treated and discharged.", (d) => {
        title(d, "DAVAO DOCTORS HOSPITAL", "Medical Certificate - Illustrative sample");
        rows(d, [["Patient", c.insured], ["Date of consultation", long(c.lossDate)], ["Diagnosis", "Closed fracture, distal radius, left wrist; lacerations, left forearm"], ["Treatment", "Closed reduction, cast application, wound suturing"], ["Estimated recovery", "6 to 8 weeks"], ["Attending physician", "Dr. Maria Lourdes T. Pineda, M.D. (orthopaedics)"]]);
      });
      add("3-hospital-statement.pdf", "Hospital statement of account", "other", "Hospital statement of account totalling PHP 49,800.00, lower than the PHP 58,000.00 claimed.", (d) => {
        title(d, "DAVAO DOCTORS HOSPITAL", "Statement of Account - TIN 004-325-818-000 VAT - Illustrative sample");
        rows(d, [["Patient", c.insured], ["Admission / discharge", `${long(c.lossDate)} / ${long(c.lossDate)}`]]);
        d.moveDown(0.5);
        table(d, ["Description", "Amount (PHP)"], [["Emergency room", "6,500.00"], ["Orthopaedic procedure and cast", "24,800.00"], ["Medicines and supplies", "8,900.00"], ["Radiology (X-ray, CT)", "6,400.00"], ["Professional fee", "3,200.00"]], [395, 100]);
        d.moveDown(0.5);
        rows(d, [["TOTAL AMOUNT DUE", "49,800.00"]]);
      });
      add("4-barangay-certification.pdf", "Barangay certification", "other", "Barangay Matina certification that the motorcycle accident was recorded on 2 October 2026.", (d) => {
        title(d, "BARANGAY MATINA, DAVAO CITY", "Barangay Certification - Illustrative sample");
        d.font("Helvetica").fontSize(11).text(`This is to certify that ${c.insured} of ${c.addr} was involved in a motorcycle accident on ${long(c.lossDate)} at about ${c.lossTime} along ${c.place}, as recorded in the barangay logbook. No third party was involved.`, { width: 495 });
        d.moveDown(2).text("Issued this " + long(c.reported) + " for insurance purposes.");
        d.moveDown(2).text("Hon. Ricardo A. Dizon, Punong Barangay");
      });
    }

    manifest[c.id] = docs;
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 1));
}

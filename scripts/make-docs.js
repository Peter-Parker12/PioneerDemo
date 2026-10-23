// Generates the fictional sample PDFs (hero claim pack + sample receipts).
// Run: npm run make-docs   (output is committed, so this is only needed to regenerate)
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const claimDir = path.join(root, "data/claims/hero-claim");
const receiptDir = path.join(root, "data/receipts");
const php = (n) => "PHP " + n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

function make(file, draw) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(fs.createWriteStream(file));
  draw(doc);
  doc.end();
}
function title(doc, t, sub) {
  doc.font("Helvetica-Bold").fontSize(16).text(t, { align: "center" });
  if (sub) doc.font("Helvetica").fontSize(9).fillColor("#666").text(sub, { align: "center" }).fillColor("#000");
  doc.moveDown(1);
}
function rows(doc, list) {
  for (const [k, v] of list) {
    const y = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor("#555").text(k, 50, y, { width: 150 });
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text(v, 205, y, { width: 340 });
    doc.moveDown(0.5);
  }
  doc.x = 50;
}
function table(doc, head, body, widths) {
  const draw = (cells, bold) => {
    const y = doc.y;
    let x = 50;
    cells.forEach((c, i) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).text(String(c), x, y, { width: widths[i] - 6, align: i === 0 ? "left" : "right" });
      x += widths[i];
    });
    doc.y = y + 16;
  };
  draw(head, true);
  doc.moveTo(50, doc.y - 4).lineTo(545, doc.y - 4).strokeColor("#999").stroke();
  body.forEach((r) => draw(r, false));
  doc.x = 50;
}

// ---------- Hero claim pack ----------
make(path.join(claimDir, "1-claim-form.pdf"), (d) => {
  title(d, "MOTOR INSURANCE CLAIM FORM", "Illustrative sample - fictional data");
  rows(d, [
    ["Policy No.", "WFS-MC-2026-004417"],
    ["Insured / Claimant", "Ramon A. Dela Cruz"],
    ["Address", "27 Mapang-akit St., Brgy. Culiat, Quezon City"],
    ["Mobile", "0917 555 0142"],
    ["Insured vehicle", "2024 Toyota Vios 1.3 XLE, Silver"],
    ["Plate No.", "NCX 4821"],
    ["Date and time of loss", "02 October 2026, approx. 9:40 PM"],
    ["Place of loss", "Commonwealth Ave. cor. Tandang Sora Ave., Quezon City"],
    ["Driver at time of loss", "Ramon A. Dela Cruz (insured)"],
    ["Date claim reported", "12 October 2026"],
    ["Type of loss", "Own damage - collision"],
  ]);
  d.moveDown(0.5).font("Helvetica-Bold").fontSize(10).text("Narrative of the accident");
  d.font("Helvetica").fontSize(10).text(
    "While travelling eastbound on Commonwealth Avenue, a motorcycle suddenly swerved into my lane. I braked and steered right to avoid it and the front of my vehicle hit the concrete island. The front bumper and right headlamp were badly damaged and the hood was dented. No one was injured. The motorcycle did not stop. I reported the incident to the QCPD the next day.",
    { width: 495 });
  d.moveDown(2).text("Signed: Ramon A. Dela Cruz          Date: 12 October 2026");
});

make(path.join(claimDir, "2-or-cr.pdf"), (d) => {
  title(d, "LAND TRANSPORTATION OFFICE", "Certificate of Registration (CR) and Official Receipt (OR) - Illustrative sample");
  rows(d, [
    ["CR No.", "283910475"], ["OR No.", "7741920318"],
    ["Plate No.", "NCX 4821"], ["Make / Series", "Toyota / Vios 1.3 XLE"],
    ["Year model", "2024"], ["Color", "Silver"],
    ["Engine No.", "2NR-8847221"], ["Chassis No.", "MHFBW9F30R0044182"],
    ["Registered owner", "RAMON A. DELA CRUZ"],
    ["Address", "27 Mapang-akit St., Brgy. Culiat, Quezon City"],
    ["Registration valid until", "31 August 2027"],
    ["Amount paid (OR)", php(3250)],
  ]);
});

make(path.join(claimDir, "3-drivers-license.pdf"), (d) => {
  title(d, "LAND TRANSPORTATION OFFICE", "Driver's License - Illustrative sample");
  rows(d, [
    ["Name", "DELA CRUZ, RAMON ABAD"], ["License No.", "N03-26-123456"],
    ["Date of birth", "14 March 1985"], ["Address", "27 Mapang-akit St., Brgy. Culiat, Quezon City"],
    ["Restrictions", "A, A1, B, B1"], ["Conditions", "1"],
    ["Issued", "14 March 2026"], ["Expiration date", "14 March 2031"],
  ]);
});

make(path.join(claimDir, "4-police-report.pdf"), (d) => {
  title(d, "PHILIPPINE NATIONAL POLICE - QUEZON CITY POLICE DISTRICT", "Station 3 - Traffic Sector - Certified True Copy of Blotter (Illustrative sample)");
  rows(d, [
    ["Blotter entry no.", "2026-10-3381"], ["Date reported", "03 October 2026, 8:15 AM"],
    ["Date / time of incident", "02 October 2026, approx. 9:40 PM"],
    ["Place of incident", "Commonwealth Ave. cor. Tandang Sora Ave., Quezon City"],
    ["Complainant", "Ramon A. Dela Cruz"], ["Vehicle", "Toyota Vios, plate NCX 4821"],
    ["Nature", "Vehicular accident - damage to property (self-inflicted, no third party)"],
    ["Damage noted", "Front bumper, right headlamp, hood"], ["Injuries", "None"],
  ]);
  d.moveDown(0.5).font("Helvetica").fontSize(10).text(
    "Complainant states that a motorcycle swerved into his lane, causing him to hit the concrete island. The motorcycle rider left the scene and could not be identified.",
    { width: 495 });
  d.moveDown(2).text("Desk Officer: PSSg. M. Villanueva");
});

make(path.join(claimDir, "5-repair-estimate.pdf"), (d) => {
  title(d, "BONIFACIO AUTO WORKS", "Collision repair and repainting - 118 Aurora Blvd., Quezon City - TIN 214-889-307-000 VAT");
  d.font("Helvetica-Bold").fontSize(13).text("REPAIR ESTIMATE", { align: "center" }).moveDown(0.5);
  rows(d, [
    ["Estimate No.", "EST-26-1187"], ["Date", "05 October 2026"],
    ["Customer", "Ramon A. Dela Cruz"], ["Vehicle / Plate", "2024 Toyota Vios 1.3 XLE / NCX 4821"],
    ["Insurer / Policy", "Policy WFS-MC-2026-004417"],
  ]);
  d.moveDown(0.5);
  table(d, ["Description", "Amount (PHP)"], [
    ["Front bumper cover (replace)", "14,500.00"],
    ["Right headlamp assembly (replace)", "21,800.00"],
    ["Hood panel - repair and repaint", "9,600.00"],
    ["Radiator support - straighten", "6,200.00"],
    ["Front bumper reinforcement", "5,300.00"],
    ["Labor", "18,000.00"],
    ["Paint and materials", "11,000.00"],
  ], [395, 100]);
  d.moveDown(0.5);
  rows(d, [["VATable sales", "77,142.86"], ["VAT 12%", "9,257.14"], ["TOTAL ESTIMATE (VAT inclusive)", "86,400.00"]]);
});

// ---------- Sample receipts ----------
make(path.join(receiptDir, "receipt-bonifacio-auto-works.pdf"), (d) => {
  title(d, "BONIFACIO AUTO WORKS", "118 Aurora Blvd., Quezon City - TIN 214-889-307-000 VAT");
  d.font("Helvetica-Bold").fontSize(13).text("SALES INVOICE", { align: "center" }).moveDown(0.5);
  rows(d, [["Invoice No.", "007731"], ["Date", "11 October 2026"], ["Sold to", "Ramon A. Dela Cruz"], ["Plate No.", "NCX 4821"], ["Payment", "Cash"]]);
  d.moveDown(0.5);
  table(d, ["Description", "Qty", "Amount"], [
    ["Front bumper cover", "1", "14,500.00"], ["Right headlamp assembly", "1", "21,800.00"],
    ["Hood repair and repaint", "1", "9,600.00"], ["Radiator support straighten", "1", "6,200.00"],
    ["Front bumper reinforcement", "1", "5,300.00"], ["Labor", "1", "18,000.00"], ["Paint and materials", "1", "11,000.00"],
  ], [335, 60, 100]);
  d.moveDown(0.5);
  rows(d, [["VATable sales", "77,142.86"], ["VAT 12%", "9,257.14"], ["TOTAL AMOUNT DUE", "86,400.00"]]);
  d.moveDown(1).fontSize(8).fillColor("#666").text("This invoice shall be valid for five (5) years from the date of ATP. BIR ATP No. 0AU0000412345 (illustrative).");
});

make(path.join(receiptDir, "receipt-parts-supply.pdf"), (d) => {
  title(d, "KALOOKAN AUTO PARTS SUPPLY", "Rizal Ave. Ext., Caloocan City - TIN 188-402-915-000 NON-VAT");
  d.font("Helvetica-Bold").fontSize(13).text("OFFICIAL RECEIPT", { align: "center" }).moveDown(0.5);
  rows(d, [["OR No.", "0048812"], ["Date", "08 October 2026"], ["Received from", "Bonifacio Auto Works"], ["Payment", "GCash"]]);
  d.moveDown(0.5);
  table(d, ["Description", "Qty", "Amount"], [
    ["Headlamp assy RH - Vios 2023+", "1", "16,900.00"], ["Front bumper cover Vios 2023+", "1", "9,800.00"],
  ], [335, 60, 100]);
  d.moveDown(0.5);
  rows(d, [["TOTAL", "26,700.00"]]);
});
console.log("PDFs written");

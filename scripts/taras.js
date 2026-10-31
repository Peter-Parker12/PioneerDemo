// PNP Traffic Accident Report Form (TARAS layout), filled with the fictional Dela Cruz incident.
// Field numbers and code lists follow the template in 137495349-Traffic-Accident-Report-TARAS-Form.docx.
const L = 24, W = 547; // left margin, usable width on A4 (595 wide)
const INK = "#111", GREY = "#555", LINE = "#222";

const box = (d, x, y, w, h) => d.lineWidth(0.6).strokeColor(LINE).rect(x, y, w, h).stroke();
const label = (d, t, x, y, w) => d.font("Helvetica-Bold").fontSize(6.3).fillColor(GREY).text(t, x + 3, y + 2.5, { width: w - 6, lineBreak: false });
const value = (d, t, x, y, w, size = 8.5, bold = false) => d.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(INK).text(String(t), x + 3, y, { width: w - 6 });

// A labelled box listing code options; the chosen option(s) get a filled square and bold text.
function codes(d, x, y, w, num, title, opts, sel, h) {
  box(d, x, y, w, h);
  label(d, `${num}. ${title}`, x, y, w);
  const chosen = Array.isArray(sel) ? sel : [sel];
  opts.forEach((o, i) => {
    const oy = y + 13 + i * 8.6;
    const on = chosen.includes(i + 1);
    d.lineWidth(0.5).strokeColor(LINE).rect(x + 4, oy + 0.8, 5.5, 5.5).stroke();
    if (on) d.rect(x + 5.2, oy + 2, 3.1, 3.1).fill(INK);
    d.font(on ? "Helvetica-Bold" : "Helvetica").fontSize(6.6).fillColor(on ? INK : GREY).text(`${i + 1}. ${o}`, x + 13, oy, { width: w - 16, lineBreak: false });
  });
}
const boxH = (n) => 15 + n * 8.6;

function strip(d, f) {
  const y = 24;
  const cells = [["1. REP NO", f.reportNo, 90], ["2. PROV OFFICE", "-", 90], ["3. POL STN", f.station, 150], ["4. REG OFFICE", f.region, 100], ["5. DATE", f.date, 117]];
  let x = L;
  cells.forEach(([k, v, w]) => { box(d, x, y, w, 26); label(d, k, x, y, w); value(d, v, x, y + 11, w, 8); x += w; });
}

export function taras(d, f) {
  // ---------- page 1 ----------
  d.font("Helvetica-Bold").fontSize(8).fillColor(INK).text("REPUBLIC OF THE PHILIPPINES", L, 24, { width: W, align: "center" });
  d.fontSize(11).text("PHILIPPINE NATIONAL POLICE", { width: W, align: "center" });
  d.fontSize(12).text("TRAFFIC ACCIDENT REPORT FORM", { width: W, align: "center" });
  d.font("Helvetica").fontSize(6.5).fillColor(GREY).text("Illustrative sample, fictional data", { width: W, align: "center" });

  let y = 78;
  const row1 = [["1. REPORT NO.", f.reportNo, 88], ["2. PROV. OFFICE", "-", 70], ["3. POLICE STATION", f.station, 118], ["4. REGIONAL OFC.", f.region, 62], ["5. VEHICLES", f.vehicles, 52], ["6. DRIVER CAS.", f.driverCas, 52], ["7. PASSENGER CAS.", f.paxCas, 52], ["8. PEDESTRIAN CAS.", f.pedCas, 53]];
  let x = L;
  row1.forEach(([k, v, w]) => { box(d, x, y, w, 30); label(d, k, x, y, w); value(d, v, x, y + 13, w, 8.5, true); x += w; });

  y += 34;
  codes(d, L, y, 110, 9, "ACCIDENT SEVERITY", ["F. Fatal Accident", "S. Serious Injury Accident", "M. Minor Injury Accident", "D. Property Damage Only"], f.severity, 52);
  box(d, L + 110, y, 170, 52); label(d, "10. MONTH   11. DAY   12. YEAR", L + 110, y, 170);
  value(d, `${f.month}        ${f.day}        ${f.year}`, L + 110, y + 14, 170, 12, true);
  value(d, f.dateLong, L + 110, y + 36, 170, 7.5);
  box(d, L + 280, y, 120, 52); label(d, "13. DAY OF THE WEEK", L + 280, y, 120); value(d, f.weekday, L + 280, y + 16, 120, 11, true);
  box(d, L + 400, y, 147, 52); label(d, "14. TIME (MILITARY TIME)", L + 400, y, 147); value(d, f.time, L + 400, y + 16, 147, 13, true);

  y += 56;
  const cw = W / 5;
  const rowA = [
    [15, "JUNCTION (TYPE)", ["Not at Junction", "T-Junction", "X-Junction", "Roundabout", "Y-Junction", "Staggered", "Railway", "Other"], f.junction],
    [16, "TRAFFIC CONTROL", ["None", "Centerline", "Pedestrian Crossing", "School Crossing", "Police Controlled", "Traffic Lights", "Stop Sign", "Give Way", "Other"], f.control],
    [17, "COLLISION TYPE", ["Head On", "Rear End", "Right Angle", "Side Swipe", "Overturned Vehicle", "Hit Object in Road", "Hit Object Off Road", "Hit Parked Vehicle", "Hit Pedestrian", "Hit Animal", "Other"], f.collision],
    [18, "MOVEMENT", ["1-Way", "2-Way"], f.movement],
    [19, "SEPARATION", ["Median", "Not Median"], f.separation],
  ];
  let h = boxH(11);
  rowA.forEach(([n, t, o, s], i) => codes(d, L + i * cw, y, cw, n, t, o, s, h));
  y += h;
  const rowB = [
    [20, "WEATHER", ["Fair", "Rain", "Wind", "Smoke", "Fog", "Dazzle", "Storm"], f.weather],
    [21, "LIGHT", ["Daylight", "Dawn/Dusk", "Night (lit)", "Night (unlit)"], f.light],
    [22, "ROAD CHARACTER", ["Straight+Flat", "Curve Only", "Incline Only", "Curve+Incline", "Bridge", "Crest"], f.roadChar],
    [23, "SURFACE CONDITION", ["Dry", "Wet", "Muddy", "Flooded", "Other"], f.surface],
    [24, "SURFACE TYPE", ["Concrete", "Asphalt", "Gravel", "Earth"], f.surfaceType],
  ];
  h = boxH(7);
  rowB.forEach(([n, t, o, s], i) => codes(d, L + i * cw, y, cw, n, t, o, s, h));
  y += h;
  const rowC = [
    [25, "MAIN CAUSE", ["Vehicle Defect", "Road Defect", "Human Error", "Other"], f.cause],
    [26, "ROAD CLASS", ["National", "Provincial", "City", "Municipal", "Barangay"], f.roadClass],
    [27, "ROAD REPAIRS", ["Yes", "No"], f.repairs],
    [28, "HIT & RUN", ["Yes", "No"], f.hitRun],
    [29, "LOCATION TYPE", ["Urban Area", "Rural Area"], f.locType],
  ];
  h = boxH(5);
  rowC.forEach(([n, t, o, s], i) => codes(d, L + i * cw, y, cw, n, t, o, s, h));
  y += h + 4;

  // location block
  box(d, L, y, W, 74);
  label(d, "LOCATION", L, y, 80);
  const loc = [
    ["Name of City/Town/Barangay:", f.place],
    ["Name of Road:", f.road],
    ["Landmark 1:", f.landmark1],
    ["Landmark 2:", f.landmark2],
    ["Second road (junction accident only):", f.road2],
  ];
  loc.forEach(([k, v], i) => {
    d.font("Helvetica-Bold").fontSize(6.8).fillColor(GREY).text(k, L + 6, y + 12 + i * 11.5, { lineBreak: false });
    d.font("Helvetica").fontSize(8).fillColor(INK).text(v, L + 170, y + 11 + i * 11.5, { width: W - 180, lineBreak: false });
  });
  y += 78;

  // sketch map
  const sh = 842 - y - 36;
  box(d, L, y, W, sh); label(d, "LOCATION SKETCH MAP (show site in relation to landmarks; mark distances)", L, y, W);
  const cx = L + W / 2, cy = y + sh / 2 + 4;
  d.lineWidth(0.6).strokeColor(LINE);
  d.rect(L + 20, cy - 16, W - 40, 32).stroke();                 // Commonwealth Ave
  d.rect(cx - 16, y + 18, 32, sh - 24).stroke();                // Tandang Sora Ave
  d.moveTo(L + 20, cy).lineTo(cx - 16, cy).dash(4, { space: 3 }).stroke().undash();
  d.moveTo(cx + 16, cy).lineTo(L + W - 20, cy).dash(4, { space: 3 }).stroke().undash();
  d.rect(cx - 130, cy - 4, 40, 8).fill(INK);                    // concrete island
  d.font("Helvetica").fontSize(6.5).fillColor(INK);
  d.text("Concrete island (point of impact)", cx - 160, cy - 15, { lineBreak: false });
  d.text("V1 Toyota Vios NCX 4821  >>> EAST", cx - 215, cy + 7, { lineBreak: false });
  d.text("V2 motorcycle (unidentified)", cx - 110, cy - 28, { lineBreak: false });
  d.text("COMMONWEALTH AVE.", L + 40, cy + 20, { lineBreak: false });
  d.text("TANDANG SORA AVE.", cx + 22, y + 24, { lineBreak: false });
  d.text("N", cx + 100, y + 26, { lineBreak: false });
  d.moveTo(cx + 103, y + 46).lineTo(cx + 103, y + 34).lineWidth(1).stroke();
  d.fontSize(6.3).fillColor(GREY).text("Landmark 1: Tandang Sora flyover, 60 m west.  Landmark 2: Philcoa, 1.4 km east.", L + 6, y + sh - 12, { lineBreak: false });

  // ---------- page 2: vehicles ----------
  d.addPage({ size: "A4", margin: 24 });
  strip(d, f);
  const veh = (vx, title, v) => {
    const w = W / 2;
    let yy = 58;
    d.rect(vx, yy, w, 14).fill(INK);
    d.font("Helvetica-Bold").fontSize(8.5).fillColor("#fff").text(title, vx + 4, yy + 3.5, { lineBreak: false });
    yy += 14;
    const rows = [
      ["30. VEHICLE PLATE NUMBER", v.plate], ["DRIVER NAME", v.driver], ["31. OWNER'S NAME & ADDRESS", v.owner],
      ["32. ENGINE NUMBER", v.engine], ["CHASSIS NUMBER", v.chassis], ["LICENSE NUMBER", v.license],
      ["LICENSE TYPE / EXPIRY DATE", v.licenseType], ["33. INSURANCE", v.insurance], ["OR/CR DETAILS", v.orcr],
      ["MANUFACTURER (MAKE)", v.make], ["MODEL / YEAR", v.model], ["40. DRIVER SEX", v.sex], ["41. DRIVER AGE", v.age],
      ["42. DRIVER INJURY (1 Fatal, 2 Serious, 3 Minor, 4 Not injured)", v.injury], ["HOSPITAL", v.hospital],
      ["34. VEHICLE TYPE", v.type], ["35. VEHICLE MANEUVER", v.maneuver], ["36. LOADING", v.loading], ["37. DIRECTION", v.direction],
      ["38. VEHICLE DEFECT", v.defect], ["39. VEHICLE DAMAGE", v.damage], ["43. DRIVER ERROR", v.error],
      ["44. ALCOHOL / DRUGS", v.alcohol], ["45. SEAT BELT / HELMET", v.belt],
    ];
    rows.forEach(([k, val]) => {
      const rh = ["31. OWNER'S NAME & ADDRESS", "LICENSE TYPE / EXPIRY DATE", "33. INSURANCE", "35. VEHICLE MANEUVER", "39. VEHICLE DAMAGE"].includes(k) ? 31 : 25;
      box(d, vx, yy, w, rh); label(d, k, vx, yy, w); value(d, val, vx, yy + 11.5, w, 8);
      yy += rh;
    });
  };
  veh(L, "VEHICLE 1", f.v1);
  veh(L + W / 2, "VEHICLE 2", f.v2);

  // ---------- page 3: casualties, narrative, officers ----------
  d.addPage({ size: "A4", margin: 24 });
  strip(d, f);
  let y3 = 58;
  const table = (title, cols, rowsData, hint) => {
    d.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text(title, L, y3, { lineBreak: false });
    y3 += 11;
    let x3 = L;
    cols.forEach(([c, w]) => { box(d, x3, y3, w, 16); label(d, c, x3, y3, w); x3 += w; });
    y3 += 16;
    rowsData.forEach((r) => { x3 = L; cols.forEach(([, w], i) => { box(d, x3, y3, w, 16); value(d, r[i] || "", x3, y3 + 4, w, 8); x3 += w; }); y3 += 16; });
    d.font("Helvetica").fontSize(6).fillColor(GREY).text(hint, L, y3 + 2, { lineBreak: false });
    y3 += 14;
  };
  table("PASSENGER CASUALTIES: complete 1 full line for each passenger casualty", [["NAME AND ADDRESS", 235], ["46. VEH. NO", 52], ["47. SEX", 45], ["48. AGE", 45], ["49. INJURY / HOSP", 90], ["50. POSITION", 40], ["51. ACTION", 40]], [["NIL: no passenger casualties"]], "Injury: F Fatal, S Serious, M Minor. Position: 1 Front seat, 2 Rear seat, 3 M/C passenger. Action: 1 None, 2 Boarding, 3 Alighting, 4 Falling.");
  table("PEDESTRIAN CASUALTIES: complete 1 full line for each pedestrian casualty", [["NAME AND ADDRESS", 255], ["52. SEX", 50], ["53. AGE", 50], ["54. INJURY / HOSP", 92], ["55. POSITION", 50], ["56. ACTION", 50]], [["NIL: no pedestrian casualties"]], "Location: 1 On crossing, 2 Within 50 m of crossing, 3 Central refuge, 4 Road centre, 5 Footpath/verge. Action: 1 None, 2 Crossing, 3 Walking along road.");

  const block = (title, text, h) => {
    box(d, L, y3, W, h); label(d, title, L, y3, W);
    d.font("Helvetica").fontSize(8.3).fillColor(INK).text(text, L + 5, y3 + 13, { width: W - 10 });
    y3 += h + 4;
  };
  block("POLICE DESCRIPTION OF ACCIDENT", f.description, 96);
  block("WITNESSES", "1. Name: None identified at the scene.   Address: -\n2. Name: -   Address: -", 38);
  block("DRIVER STATEMENT", `Driver 1 (Ramon A. Dela Cruz): ${f.statement1}\nDriver 2: Unidentified motorcycle rider; no statement. The rider left the scene.`, 80);
  block("ACTION TAKEN", f.action, 50);
  block("RECOMMENDATION", f.recommendation, 36);
  box(d, L, y3, W, 22); label(d, "STATUS OF CASE", L, y3, W); value(d, f.status, L, y3 + 11, W, 8.5, true);
  y3 += 26;
  const half = W / 2;
  box(d, L, y3, half, 40); label(d, "INVESTIGATING OFFICER", L, y3, half); value(d, f.investigator, L, y3 + 14, half, 8.5, true);
  box(d, L + half, y3, half, 40); label(d, "SUPERVISING OFFICER", L + half, y3, half); value(d, f.supervisor, L + half, y3 + 14, half, 8.5, true);
  y3 += 44;
  d.font("Helvetica").fontSize(7.5).fillColor(INK).text("Signatures:  Driver 1 ______________________     Driver 2 ______________________", L, y3 + 6, { lineBreak: false });
  d.fontSize(6).fillColor(GREY).text("Additional forms are needed if there are more than 2 vehicles, more than 4 passenger casualties or more than 2 pedestrian casualties. Fill in the report no., provincial office, police station and dates, and fix the forms together securely.", L, y3 + 24, { width: W });
}

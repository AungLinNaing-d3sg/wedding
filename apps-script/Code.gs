// === Google Apps Script: RSVP Sheet Backend ===
const SHEET_NAME = "RSVPs";

function doGet(e) {
  try {
    const action = (e.parameter.action || "").toLowerCase();
    if (action === "list") {
      const rows = listRSVPs_();
      return respond_(200, rows);
    }
    return respond_(400, { error: "Unknown action" });
  } catch (err) {
    return respond_(500, { error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = (body.action || "").toLowerCase();
    if (action === "add") {
      const entry = body.entry || {};
      addRSVP_(entry);
      return respond_(200, { ok: true });
    }
    return respond_(400, { error: "Unknown action" });
  } catch (err) {
    return respond_(500, { error: String(err) });
  }
}

function listRSVPs_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    headers.forEach((h, idx) => obj[String(h).trim()] = row[idx]);
    out.push(obj);
  }
  return out;
}

function addRSVP_(entry) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const headers = ["name","email","attending","guests","message","timestamp"];
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  const row = [
    entry.name || "",
    entry.email || "",
    entry.attending || "",
    Number(entry.guests || 0),
    entry.message || "",
    entry.timestamp || new Date().toISOString()
  ];
  sh.appendRow(row);
}

function respond_(status, obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

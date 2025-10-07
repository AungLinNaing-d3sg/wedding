// === Google Apps Script: RSVP Sheet Backend ===
const SHEET_NAME = "RSVPs";

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function doOptions(e) {
  return HtmlService.createHtmlOutput("ok").setXFrameOptionsMode(
    HtmlService.XFrameOptionsMode.ALLOWALL
  ); // just responds to preflight
}

// unified handler
function handleRequest(e) {
  const action = (
    e.parameter?.action ||
    (e.postData && JSON.parse(e.postData.contents).action) ||
    ""
  ).toLowerCase();

  let result;

  try {
    if (action === "list") {
      result = listRSVPs_();
    } else if (action === "add") {
      let entry;
      if (e.postData && e.postData.contents) {
        // POST request
        entry = JSON.parse(e.postData.contents).entry;
      } else {
        // GET request
        entry = {
          name: e.parameter.name || "",
          email: e.parameter.email || "",
          attending: e.parameter.attending || "",
          guests: Number(e.parameter.guests || 0),
          message: e.parameter.message || "",
          timestamp: e.parameter.timestamp || new Date().toISOString(),
        };
      }
      addRSVP_(entry);
      result = { ok: true };
    } else {
      result = { error: "Unknown action" };
    }
  } catch (err) {
    result = { error: String(err) };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * List all RSVPs
 */
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
    headers.forEach((h, idx) => (obj[String(h).trim()] = row[idx]));
    out.push(obj);
  }
  return out;
}

/**
 * Add a new RSVP entry
 */
function addRSVP_(entry) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const headers = [
    "name",
    "email",
    "attending",
    "guests",
    "message",
    "timestamp",
  ];
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  const row = [
    entry.name || "",
    entry.email || "",
    entry.attending || "",
    Number(entry.guests || 0),
    entry.message || "",
    entry.timestamp || new Date().toISOString(),
  ];
  sh.appendRow(row);
}

/**
 * JSON response with CORS headers
 */
function respond_(status, obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);

  // Add CORS headers
  output.setHeader("Access-Control-Allow-Origin", "*");
  output.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  output.setHeader("Access-Control-Allow-Headers", "Content-Type");

  return output;
}

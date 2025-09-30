import React, { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip"; // default import per library
import * as XLSX from "xlsx";

// ---------------------------------
// THEME
// ---------------------------------
const theme = {
  navy: "#0b2545",
  baby: "#cfe8ff",
  baby2: "#e8f3ff",
  ink: "#0f172a",
};

// Base dimensions & responsiveness config
const BASE_W = 900;
const BASE_H = 620;
const ASPECT = BASE_H / BASE_W; // maintain aspect ratio
const MIN_W = 320; // minimum readable width
const MAX_W = 1200; // maximum page width

// ---------------------------------
// GOOGLE SHEETS ENDPOINT
// ---------------------------------
// Set this via Vite env: VITE_SHEETS_WEB_APP_URL
// or hardcode your Apps Script Web App URL below.
const SHEETS_WEB_APP_URL =
  import.meta.env?.VITE_SHEETS_WEB_APP_URL ||
  "https://script.google.com/macros/s/DEPLOYMENT_ID/exec";

// Helper: detect if endpoint is configured
function isSheetsConfigured() {
  return (
    typeof SHEETS_WEB_APP_URL === "string" &&
    SHEETS_WEB_APP_URL.startsWith("http") &&
    !SHEETS_WEB_APP_URL.includes("DEPLOYMENT_ID")
  );
}

// ---------------------------------
// ADMIN GATING (hide responses/buttons from public)
// ---------------------------------
// Provide a simple admin code via env var. Admin mode is granted if the URL has
// ?admin=<code> matching VITE_ADMIN_CODE, or the user logs in via the dialog.
// The flag is saved in sessionStorage for the browser session.
const ADMIN_CODE = import.meta.env?.VITE_ADMIN_CODE || "";
export function canSeeAdmin(configured, isAdmin) {
  return !!configured && !!isAdmin;
}
export function canShowSheetsWarning(configured, isAdmin) {
  return !!isAdmin && !configured;
}

function detectAdminFromURL() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("admin");
  if (!token) return false;
  if (ADMIN_CODE) return token === ADMIN_CODE; // strict match when set
  return token === "1"; // dev fallback
}

// API: list RSVPs
async function fetchRSVPsFromSheets() {
  if (!isSheetsConfigured()) throw new Error("SHEETS_URL_NOT_CONFIGURED");
  const url = SHEETS_WEB_APP_URL.includes("?")
    ? `${SHEETS_WEB_APP_URL}&action=list`
    : `${SHEETS_WEB_APP_URL}?action=list`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`LIST_FAILED_${res.status}`);
  const data = await res.json();
  // Expect array of rows with fields matching our schema
  return Array.isArray(data) ? data : data?.rows || [];
}

// API: add RSVP
async function addRSVPToSheets(entry) {
  if (!isSheetsConfigured()) throw new Error("SHEETS_URL_NOT_CONFIGURED");
  const res = await fetch(SHEETS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add", entry }),
  });
  if (!res.ok) throw new Error(`ADD_FAILED_${res.status}`);
  return res.json();
}

// ---------------------------------
// SMALL PURE HELPERS (also used by tests)
// ---------------------------------
export function computeNextIndex(total, current) {
  if (total <= 0) return 0;
  return (current + 1) % total;
}
export function computePrevIndex(total, current) {
  if (total <= 0) return 0;
  return (current - 1 + total) % total;
}
export function rowsToCSV(rows) {
  const processRow = (row) =>
    Object.values(row)
      .map((v) => {
        const val = v == null ? "" : String(v);
        const needsQuotes = /[",\n]/.test(val);
        const escaped = val.replace(/"/g, '""');
        return needsQuotes ? `"${escaped}"` : escaped;
      })
      .join(",");
  const header = Object.keys(rows[0] || {}).join(",");
  return [header, ...rows.map(processRow)].join("\n");
}
export function validateRSVP(entry) {
  return Boolean(entry && entry.name && entry.email);
}

// Utility: CSV download (uses rowsToCSV)
function downloadCSV(filename, rows) {
  const csvContent = rowsToCSV(rows);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------------------------------
// HOME PAGE (NEWSPAPER-STYLE)
// ---------------------------------
const HomePage = React.forwardRef(
  ({ coverImage, couple, dateText, locationText }, ref) => {
    return (
      <div
        ref={ref}
        className="w-full h-full bg-white text-[--ink] flex flex-col"
        style={{ "--ink": theme.ink }}
      >
        {/* Top ribbon */}
        <div
          className="px-6 py-3 border-b border-black/50 grid grid-cols-3 text-xs tracking-[0.3em] uppercase"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <div className="text-left">{dateText}</div>
          <div className="text-center">{couple}</div>
          <div className="text-right">{locationText}</div>
        </div>

        {/* Masthead */}
        <div className="px-4 sm:px-8 py-4 border-b border-black/50">
          <div
            className="text-center text-4xl sm:text-5xl md:text-6xl font-serif"
            style={{ fontFamily: '"Playfair Display", serif' }}
          >
            <span
              className="inline-block px-3 py-1 rounded"
              style={{ color: theme.navy }}
            >
              The Newlywed Times
            </span>
          </div>
          <div
            className="mt-3 text-center text-2xl sm:text-3xl tracking-widest"
            style={{ fontFamily: "Cinzel, serif" }}
          >
            <span className="border-y border-black/50 py-2 inline-block">
              WEDDING OF THE YEAR
            </span>
          </div>
        </div>

        {/* Photo (fills remaining height) */}
        <div className="flex-1 p-4 bg-[rgba(0,0,0,0.02)] overflow-hidden">
          <div className="w-full h-full rounded shadow overflow-hidden">
            <img
              src={coverImage}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    );
  }
);

// ---------------------------------
// EVENT DETAILS
// ---------------------------------
const EventDetails = React.forwardRef((props, ref) => {
  const items = [
    {
      label: "Ceremony",
      date: "Fri, Nov 7, 2025",
      time: "3:00 PM",
      location: "Yangon Cathedral, Yangon",
      note: "Doors open 2:30 PM.",
    },
    {
      label: "Reception",
      date: "Fri, Nov 7, 2025",
      time: "6:00 PM",
      location: "The Strand Ballroom, Yangon",
      note: "Dinner & dancing to follow.",
    },
  ];
  return (
    <div ref={ref} className="w-full h-full bg-white flex flex-col">
      <div
        className="h-2 w-full"
        style={{
          background: `linear-gradient(90deg, ${theme.navy}, ${theme.baby})`,
        }}
      />
      <div className="px-6 py-6 flex-1 overflow-auto">
        <h2
          className="text-3xl md:text-4xl font-semibold text-[var(--navy)]"
          style={{
            "--navy": theme.navy,
            fontFamily: "Playfair Display, serif",
          }}
        >
          Event Details
        </h2>
        <p className="mt-2 text-slate-700">
          We’re so excited to celebrate with you. Here’s the plan for the day.
        </p>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {items.map((it, idx) => (
            <div
              key={idx}
              className="rounded-2xl p-5 shadow bg-[var(--baby2)]"
              style={{ "--baby2": theme.baby2 }}
            >
              <div className="text-xs uppercase tracking-widest text-slate-600">
                {it.label}
              </div>
              <div className="mt-1 text-xl font-medium text-slate-900">
                {it.date} · {it.time}
              </div>
              <div className="text-slate-700">{it.location}</div>
              <div className="mt-2 text-slate-600 text-sm">{it.note}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-xl p-5 bg-white ring-1 ring-slate-200">
          <h3 className="font-semibold" style={{ color: theme.navy }}>
            Dress Code
          </h3>
          <p className="text-slate-700">
            Black-tie optional. Navy & baby blue accents welcome ✨
          </p>
        </div>
      </div>
    </div>
  );
});

// ---------------------------------
// LOVE STORY
// ---------------------------------
const LoveStory = React.forwardRef((props, ref) => {
  return (
    <div ref={ref} className="w-full h-full bg-white flex flex-col">
      <div
        className="h-2 w-full"
        style={{
          background: `linear-gradient(90deg, ${theme.baby}, ${theme.navy})`,
        }}
      />
      <div className="px-6 py-6 flex-1 overflow-auto">
        <h2
          className="text-3xl md:text-4xl font-semibold"
          style={{ color: theme.navy, fontFamily: "Playfair Display, serif" }}
        >
          Our Love Story
        </h2>
        <div className="mt-4 prose max-w-none">
          <p>
            Fourteen years ago, a chance meeting at a cosmetics store sparked a
            playful hello. Life pulled us to different places and studies
            abroad, but fate had its own flipbook— our pages turned back to one
            another.
          </p>
          <p>
            Today, we’re writing the headline we waited for:{" "}
            <em>Hla Thu Zar & Thaw Zin Htet — together, always.</em>
          </p>
        </div>
        <div className="mt-4 grid sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="aspect-[4/3] rounded-xl overflow-hidden shadow ring-1 ring-slate-200"
            >
              <img
                className="w-full h-full object-cover"
                src={`https://images.unsplash.com/photo-1522673607200-1644a24902fd?auto=format&fit=crop&w=1200&q=60`}
                alt="story"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------
// RSVP PAGE
// ---------------------------------
const RSVP = React.forwardRef(
  (
    {
      isAdmin,
      onSubmit,
      entries,
      onExportXLSX,
      onExportCSV,
      onRefresh,
      loading,
      saveState,
      configured,
    },
    ref
  ) => {
    const [form, setForm] = useState({
      name: "",
      email: "",
      attending: "Yes",
      guests: 1,
      message: "",
    });
    const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!validateRSVP(form))
        return alert("Please enter your name and email.");
      await onSubmit({ ...form, timestamp: new Date().toISOString() });
      setForm({
        name: "",
        email: "",
        attending: "Yes",
        guests: 1,
        message: "",
      });
    };
    return (
      <div ref={ref} className="w-full h-full bg-white flex flex-col">
        <div
          className="h-2 w-full"
          style={{
            background: `linear-gradient(90deg, ${theme.navy}, ${theme.baby})`,
          }}
        />
        <div className="px-6 py-6 flex-1 overflow-hidden">
          <h2
            className="text-3xl md:text-4xl font-semibold"
            style={{ color: theme.navy, fontFamily: "Playfair Display, serif" }}
          >
            RSVP
          </h2>
          {canShowSheetsWarning(configured, isAdmin) && (
            <div className="mt-3 text-sm p-3 rounded-lg bg-yellow-50 text-yellow-900 ring-1 ring-yellow-200">
              Not connected to Google Sheets yet. Add your{" "}
              <code>VITE_SHEETS_WEB_APP_URL</code> and redeploy.
            </div>
          )}
          <p className="mt-2 text-slate-700">
            Let us know you’re coming. Submissions save to our Google Sheet.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-4 grid sm:grid-cols-2 gap-4 overflow-auto pr-1"
          >
            <div>
              <label className="block text-sm font-medium">Full Name</label>
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2"
                style={{ outlineColor: theme.navy }}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Attending?</label>
              <select
                value={form.attending}
                onChange={(e) => update("attending", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-3"
              >
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">
                Guests (including you)
              </label>
              <input
                type="number"
                min={1}
                value={form.guests}
                onChange={(e) => update("guests", Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 p-3"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Message</label>
              <textarea
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-300 p-3"
                placeholder="Dietary notes, song requests, etc."
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-3 items-center">
              <button
                className="px-5 py-3 rounded-2xl text-white disabled:opacity-60"
                disabled={saveState === "saving"}
                style={{ background: theme.navy }}
              >
                {saveState === "saving" ? "Saving…" : "Submit RSVP"}
              </button>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="px-4 py-3 rounded-2xl bg-white text-slate-900 ring-1 ring-slate-300 disabled:opacity-60"
                    disabled={loading}
                  >
                    {loading ? "Refreshing…" : "Refresh List"}
                  </button>
                  <button
                    type="button"
                    onClick={onExportXLSX}
                    className="px-5 py-3 rounded-2xl bg-[var(--baby)] text-[var(--navy)] ring-1 ring-[var(--navy)]"
                    style={{ "--baby": theme.baby, "--navy": theme.navy }}
                  >
                    Export to Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={onExportCSV}
                    className="px-5 py-3 rounded-2xl bg-white text-slate-900 ring-1 ring-slate-300"
                  >
                    Export CSV
                  </button>
                </>
              )}
              {saveState === "success" && (
                <span className="text-sm text-green-700">Saved ✓</span>
              )}
              {saveState === "error" && (
                <span className="text-sm text-rose-700">
                  Could not save (check Sheets URL)
                </span>
              )}
            </div>
          </form>

          {isAdmin ? (
            <div className="mt-4 h-[40%] overflow-auto">
              <h3 className="font-semibold" style={{ color: theme.navy }}>
                Current Responses ({entries.length})
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr
                      className="bg-[var(--baby2)]"
                      style={{ "--baby2": theme.baby2 }}
                    >
                      {[
                        "name",
                        "email",
                        "attending",
                        "guests",
                        "message",
                        "timestamp",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left p-3 whitespace-nowrap uppercase text-xs tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((r, i) => (
                      <tr key={i} className="odd:bg-white even:bg-slate-50">
                        <td className="p-3 whitespace-nowrap">{r.name}</td>
                        <td className="p-3 whitespace-nowrap">{r.email}</td>
                        <td className="p-3 whitespace-nowrap">{r.attending}</td>
                        <td className="p-3 whitespace-nowrap">{r.guests}</td>
                        <td className="p-3 min-w-[16rem]">{r.message}</td>
                        <td className="p-3 whitespace-nowrap">
                          {r.timestamp
                            ? new Date(r.timestamp).toLocaleString()
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-500">
              Guest list is private.
            </p>
          )}
        </div>
      </div>
    );
  }
);

// ---------------------------------
// ADMIN LOGIN DIALOG (client-side only, lightweight)
// ---------------------------------
function AdminLoginDialog({ open, onClose, onSuccess }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) {
      setCode("");
      setError("");
    }
  }, [open]);

  const submit = (e) => {
    e.preventDefault();
    const expected = ADMIN_CODE || "1";
    if (code === expected) {
      onSuccess();
    } else {
      setError("Incorrect code. Please try again.");
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold" style={{ color: theme.navy }}>
          Admin Login
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Enter the admin code to view responses and export tools.
        </p>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Admin code"
            className="w-full rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2"
          />
          {error && <div className="text-sm text-rose-700">{error}</div>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-white ring-1 ring-slate-300"
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-xl text-white"
              style={{ background: theme.navy }}
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------
// ROOT APP
// ---------------------------------
export default function App() {
  const bookRef = useRef(null);
  const containerRef = useRef(null); // measure available width
  const [page, setPage] = useState(0);

  // Responsive book size state
  const [bookSize, setBookSize] = useState({ width: BASE_W, height: BASE_H });

  // RSVP state (server-backed)
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | success | error

  // Admin state (persist for the session)
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);

  const configured = isSheetsConfigured();

  const refreshRSVPs = async () => {
    if (!isAdmin) return; // don't fetch for public visitors
    setLoading(true);
    try {
      const rows = await fetchRSVPsFromSheets();
      // Normalize keys (Apps Script might return strings)
      const norm = rows.map((r) => ({
        name: r.name || r.Name || r.full_name || "",
        email: r.email || r.Email || "",
        attending: r.attending || r.Attending || "",
        guests: Number(r.guests || r.Guests || 0),
        message: r.message || r.Message || "",
        timestamp: r.timestamp || r.Timestamp || r.time || r.Time || "",
      }));
      setRsvps(norm.filter((x) => x.name || x.email));
    } catch (e) {
      console.warn("Fetch RSVPs failed:", e);
      setRsvps([]);
    } finally {
      setLoading(false);
    }
  };

  // Detect admin from URL or session once on load
  useEffect(() => {
    if (typeof window === "undefined") return;
    let granted = false;
    const fromURL = detectAdminFromURL();
    if (fromURL) {
      granted = true;
      sessionStorage.setItem("is_admin", "true");
    } else {
      granted = sessionStorage.getItem("is_admin") === "true";
    }
    setIsAdmin(granted);
  }, []);

  // Fetch RSVPs only in admin mode (and when toggled)
  useEffect(() => {
    if (isAdmin) refreshRSVPs();
    else setRsvps([]);
  }, [isAdmin]);

  const handleRSVPSubmit = async (entry) => {
    try {
      setSaveState("saving");
      await addRSVPToSheets(entry);
      setSaveState("success");
      if (isAdmin) await refreshRSVPs();
      alert("Thanks! Your RSVP has been recorded.");
    } catch (e) {
      console.error("Add RSVP failed:", e);
      setSaveState("error");
      alert("Sorry, we couldn't save your RSVP. Please check back later.");
    } finally {
      setTimeout(() => setSaveState("idle"), 1500);
    }
  };

  const exportXLSX = () => {
    try {
      const sheet = XLSX.utils.json_to_sheet(rsvps);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "RSVPs");
      XLSX.writeFile(wb, "wedding-rsvps.xlsx");
    } catch (e) {
      if (rsvps.length) downloadCSV("wedding-rsvps.csv", rsvps);
    }
  };

  const exportCSV = () => {
    if (rsvps.length) downloadCSV("wedding-rsvps.csv", rsvps);
  };

  // Cover image: allow override via query ?img=url
  const coverImage = useMemo(() => {
    if (typeof window === "undefined")
      return "https://images.unsplash.com/photo-1521543832209-13f301cc1c59?auto=format&fit=crop&w=1350&q=60";
    const params = new URLSearchParams(window.location.search);
    const img = params.get("img");
    return (
      img ||
      "https://images.unsplash.com/photo-1521543832209-13f301cc1c59?auto=format&fit=crop&w=1350&q=60"
    );
  }, []);

  const pages = [
    {
      key: "home",
      title: "Home",
      el: (
        <HomePage
          coverImage={coverImage}
          couple="Hla Thu Zar & Thaw Zin Htet"
          dateText="November 7th, 2025"
          locationText="Yangon, Myanmar"
        />
      ),
    },
    { key: "details", title: "Event Details", el: <EventDetails /> },
    { key: "story", title: "Love Story", el: <LoveStory /> },
    {
      key: "rsvp",
      title: "RSVP",
      el: (
        <RSVP
          isAdmin={isAdmin}
          onSubmit={handleRSVPSubmit}
          entries={rsvps}
          onExportXLSX={exportXLSX}
          onExportCSV={exportCSV}
          onRefresh={refreshRSVPs}
          loading={loading}
          saveState={saveState}
          configured={configured}
        />
      ),
    },
  ];

  const lastIndex = pages.length - 1;

  const goNext = () => {
    const inst = bookRef.current;
    if (!inst) return;
    if (page >= lastIndex) {
      const next = 0;
      setPage(next);
      inst.pageFlip().turnToPage(next);
    } else {
      inst.pageFlip().flipNext();
    }
  };

  const goPrev = () => {
    const inst = bookRef.current;
    if (!inst) return;
    if (page <= 0) {
      const prev = lastIndex;
      setPage(prev);
      inst.pageFlip().turnToPage(prev);
    } else {
      inst.pageFlip().flipPrev();
    }
  };

  // Responsive measurement
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = containerRef.current;
    const measure = () => {
      const cw = Math.max(MIN_W, Math.min(MAX_W, el?.clientWidth || BASE_W));
      const ch = Math.round(cw * ASPECT);
      setBookSize({ width: cw, height: ch });
    };
    measure();

    let ro;
    if (window.ResizeObserver && el) {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else {
      window.addEventListener("resize", measure);
    }
    return () => {
      if (ro && el) ro.unobserve(el);
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page]);

  // ---------------------------------
  // RUNTIME TESTS (non-breaking) — console.assert
  // ---------------------------------
  useEffect(() => {
    try {
      // Import exists
      console.assert(
        HTMLFlipBook !== undefined && HTMLFlipBook !== null,
        "react-pageflip default import should exist"
      );

      // Page looping math
      console.assert(
        computeNextIndex(4, 3) === 0,
        "computeNextIndex wrap to 0 from last"
      );
      console.assert(
        computePrevIndex(4, 0) === 3,
        "computePrevIndex wrap to last from 0"
      );
      console.assert(
        computeNextIndex(1, 0) === 0,
        "computeNextIndex single-page"
      );
      console.assert(
        computePrevIndex(1, 0) === 0,
        "computePrevIndex single-page"
      );
      console.assert(
        computeNextIndex(5, 2) === 3,
        "computeNextIndex middle advance"
      );
      console.assert(
        computePrevIndex(5, 2) === 1,
        "computePrevIndex middle back"
      );

      // CSV escaping
      const csv1 = rowsToCSV([{ a: "A,B", b: 'He said "hi"' }]);
      console.assert(csv1.includes('"A,B"'), "CSV quotes commas");
      console.assert(csv1.includes('"He said ""hi"""'), "CSV escapes quotes");
      const csv2 = rowsToCSV([{ a: "line1\nline2", b: "x" }]);
      console.assert(csv2.includes('"line1\nline2"'), "CSV quotes newlines");

      // RSVP validation
      console.assert(
        validateRSVP({ name: "Joy", email: "joy@example.com" }) === true,
        "RSVP valid"
      );
      console.assert(
        validateRSVP({ name: "", email: "x" }) === false,
        "RSVP invalid without name"
      );
      console.assert(
        validateRSVP({ name: "A", email: "" }) === false,
        "RSVP invalid without email"
      );
      console.assert(validateRSVP(null) === false, "RSVP invalid for null");

      // Responsive constraints
      console.assert(
        bookSize.width >= MIN_W && bookSize.width <= MAX_W,
        "book width within bounds"
      );
      const ratioOk =
        Math.abs(bookSize.height / bookSize.width - ASPECT) < 0.02;
      console.assert(ratioOk, "book keeps aspect ratio");

      // Pages
      console.assert(
        Array.isArray(pages) && pages.length === 4,
        "There should be 4 pages"
      );

      // Sheets config sanity
      console.assert(
        typeof SHEETS_WEB_APP_URL === "string" && SHEETS_WEB_APP_URL.length > 0,
        "Sheets URL string defined"
      );

      // Admin gating
      console.assert(
        canSeeAdmin(true, false) === false,
        "Public should not see admin"
      );
      console.assert(
        canSeeAdmin(true, true) === true,
        "Admin can see admin area"
      );
      console.assert(
        canSeeAdmin(false, true) === false,
        "No admin view if sheets not configured"
      );
      console.assert(
        canShowSheetsWarning(false, false) === false,
        "Public should not see sheets warning"
      );
      console.assert(
        canShowSheetsWarning(false, true) === true,
        "Admin sees sheets warning when not configured"
      );
    } catch (err) {
      console.warn("Runtime tests encountered an error:", err);
    }
  }, [bookSize]);

  // Admin login helpers
  const openAdminLogin = () => setShowAdminDialog(true);
  const closeAdminLogin = () => setShowAdminDialog(false);
  const confirmAdminLogin = () => {
    sessionStorage.setItem("is_admin", "true");
    setIsAdmin(true);
    setShowAdminDialog(false);
  };
  const logoutAdmin = () => {
    sessionStorage.removeItem("is_admin");
    setIsAdmin(false);
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: `radial-gradient(1200px 700px at 10% 0%, ${theme.baby} 0%, transparent 40%), linear-gradient(180deg, ${theme.navy} 0%, #081a30 100%)`,
      }}
    >
      {/* Header */}
      <header className="max-w-6xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl md:text-2xl font-semibold tracking-wide">
            Hla Thu Zar & Thaw Zin Htet — Wedding Invitation
          </h1>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <span className="px-2 py-1 rounded-lg text-xs bg-white/15 text-white ring-1 ring-white/30">
                  Admin
                </span>
                <button
                  onClick={logoutAdmin}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={openAdminLogin}
                className="px-3 py-2 rounded-xl bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 text-sm"
              >
                Admin login
              </button>
            )}
            <button
              onClick={goPrev}
              className="px-4 py-2 rounded-xl bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20"
            >
              Prev
            </button>
            <button
              onClick={goNext}
              className="px-4 py-2 rounded-xl bg-[var(--baby)] text-[var(--navy)] ring-1 ring-[var(--navy)] hover:opacity-90"
              style={{ "--baby": theme.baby, "--navy": theme.navy }}
            >
              Next
            </button>
          </div>
        </div>
      </header>

      {/* Admin Login Dialog */}
      <AdminLoginDialog
        open={showAdminDialog}
        onClose={closeAdminLogin}
        onSuccess={confirmAdminLogin}
      />

      {/* Responsive container provides measurement */}
      <main ref={containerRef} className="max-w-6xl mx-auto px-4 py-6">
        {/* Placeholder EXACTLY matches computed flipbook size */}
        <div
          className="mx-auto rounded-2xl shadow-soft overflow-hidden bg-white/90"
          style={{ width: bookSize.width, height: bookSize.height }}
        >
          <HTMLFlipBook
            width={bookSize.width}
            height={bookSize.height}
            size="fixed" // fixed to computed size; we recalc on resize
            className="w-full h-full"
            ref={bookRef}
            showCover={true}
            mobileScrollSupport={true}
            onFlip={(e) => setPage(e.data)}
          >
            {pages.map((p) => (
              <div key={p.key} className="w-full h-full">
                {p.el}
              </div>
            ))}
          </HTMLFlipBook>
        </div>

        {/* Page dots */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {pages.map((p, i) => (
            <button
              key={p.key}
              onClick={() => {
                setPage(i);
                bookRef.current?.pageFlip().turnToPage(i);
              }}
              className={`w-3 h-3 rounded-full ${
                i === page ? "bg-[var(--navy)]" : "bg-slate-300"
              }`}
              style={{ "--navy": theme.navy }}
              aria-label={`Go to ${p.title}`}
            />
          ))}
        </div>

        {/* Loop hint */}
        <p className="mt-3 text-center text-xs text-slate-300">
          Pages loop: next from the last page returns to Home; prev from Home
          goes to RSVP.
        </p>
      </main>

      {/* Footer */}
      <footer className="pb-8 text-center text-white/70 text-sm">
        Made with ❤️ in navy & baby blue. Tip: Use the arrow keys ↔ to flip.
      </footer>
    </div>
  );
}

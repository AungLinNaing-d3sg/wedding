import React, { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import * as XLSX from "xlsx";

// ---------------------------------
// THEME
// ---------------------------------
const theme = {
  navy: "#0b2545",
  baby: "#cfe8ff",
  baby2: "#e8f3ff",
  ink: "#0f172a",
  accent: "#8b5cf6", // Added accent color for better visual hierarchy
  success: "#10b981",
  error: "#ef4444",
};

// Base dimensions & responsiveness config
const BASE_W = 900;
const BASE_H = 620;
const ASPECT = BASE_H / BASE_W;
const MIN_W = 320;
const MAX_W = 1200;

// Responsive breakpoints
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

// ---------------------------------
// GOOGLE SHEETS ENDPOINT
// ---------------------------------
const SHEETS_WEB_APP_URL = import.meta.env?.VITE_SHEETS_WEB_APP_URL;

function isSheetsConfigured() {
  return (
    typeof SHEETS_WEB_APP_URL === "string" &&
    SHEETS_WEB_APP_URL.startsWith("http")
  );
}

// ---------------------------------
// ADMIN GATING
// ---------------------------------
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
  if (ADMIN_CODE) return token === ADMIN_CODE;
  return token === "1";
}

// API helpers
async function fetchRSVPsFromSheets() {
  if (!isSheetsConfigured()) throw new Error("SHEETS_URL_NOT_CONFIGURED");
  const url = SHEETS_WEB_APP_URL.includes("?")
    ? `${SHEETS_WEB_APP_URL}&action=list`
    : `${SHEETS_WEB_APP_URL}?action=list`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`LIST_FAILED_${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data?.rows || [];
}

// --- React: addRSVPToSheets using GET (no CORS issues) ---
async function addRSVPToSheets(entry) {
  if (!SHEETS_WEB_APP_URL) throw new Error("SHEETS_URL_NOT_CONFIGURED");

  // Build query parameters
  const params = new URLSearchParams({
    action: "add",
    name: entry.name || "",
    email: entry.email || "",
    attending: entry.attending || "",
    guests: entry.guests ? String(entry.guests) : "0",
    message: entry.message || "",
    timestamp: new Date().toISOString(),
  });

  const url = `${SHEETS_WEB_APP_URL}?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ADD_FAILED_${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("RSVP add error:", err);
    throw err;
  }
}

// ---------------------------------
// SMALL PURE HELPERS
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
// ENHANCED INPUT COMPONENTS
// ---------------------------------
const FloatingInput = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative mt-6">
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="block w-full px-4 pt-6 pb-2 text-slate-900 bg-white/80 border-2 border-slate-200 rounded-2xl 
                  focus:outline-none focus:border-[var(--navy)] focus:bg-white transition-all duration-200
                  placeholder-transparent peer"
        placeholder={placeholder}
        required={required}
        style={{
          transform: "translateZ(0)",
          position: "relative",
          zIndex: 2,
        }}
        {...props}
      />
      <label
        className={`absolute left-4 transition-all duration-200 pointer-events-none
          ${
            isFocused || value
              ? "top-2 text-xs text-[var(--navy)] font-medium"
              : "top-4 text-slate-500"
          }
          peer-focus:top-2 peer-focus:text-xs peer-focus:text-[var(--navy)] peer-focus:font-medium`}
        style={{ "--navy": theme.navy }}
      >
        {label} {required && "*"}
      </label>
    </div>
  );
};

const FloatingSelect = ({
  label,
  value,
  onChange,
  options,
  required = false,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative mt-6">
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="block w-full px-4 pt-6 pb-2 text-slate-900 bg-white/80 border-2 border-slate-200 rounded-2xl 
                  focus:outline-none focus:border-[var(--navy)] focus:bg-white transition-all duration-200
                  appearance-none cursor-pointer peer"
        required={required}
        style={{
          transform: "translateZ(0)",
          position: "relative",
          zIndex: 2,
        }}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>
      <label
        className={`absolute left-4 transition-all duration-200 pointer-events-none
          ${
            isFocused || value
              ? "top-2 text-xs text-[var(--navy)] font-medium"
              : "top-4 text-slate-500"
          }
          peer-focus:top-2 peer-focus:text-xs peer-focus:text-[var(--navy)] peer-focus:font-medium`}
        style={{ "--navy": theme.navy }}
      >
        {label} {required && "*"}
      </label>
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg
          className="w-4 h-4 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
};

const FloatingTextarea = ({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative mt-6">
      <textarea
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        rows={rows}
        className="block w-full px-4 pt-6 pb-2 text-slate-900 bg-white/80 border-2 border-slate-200 rounded-2xl 
                  focus:outline-none focus:border-[var(--navy)] focus:bg-white transition-all duration-200
                  placeholder-transparent resize-none peer"
        placeholder={placeholder}
        style={{
          transform: "translateZ(0)",
          position: "relative",
          zIndex: 2,
        }}
        {...props}
      />
      <label
        className={`absolute left-4 transition-all duration-200 pointer-events-none
          ${
            isFocused || value
              ? "top-2 text-xs text-[var(--navy)] font-medium"
              : "top-4 text-slate-500"
          }
          peer-focus:top-2 peer-focus:text-xs peer-focus:text-[var(--navy)] peer-focus:font-medium`}
        style={{ "--navy": theme.navy }}
      >
        {label}
      </label>
    </div>
  );
};

// Enhanced Button Component
const Button = ({ children, variant = "primary", ...props }) => {
  const baseClasses =
    "min-w-[120px] text-[14px] font-semibold py-3 rounded-2xl font-medium transition-all duration-200 transform active:scale-95 focus:outline-none";

  const variants = {
    primary: `bg-[var(--navy)] text-white hover:bg-[var(--navy-dark)] focus:ring-[var(--navy-light)]`,
    secondary: `bg-white text-slate-900 ring-2 ring-slate-300 hover:bg-slate-50 focus:ring-slate-400`,
    accent: `bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] focus:ring-[var(--accent-light)]`,
    baby: `bg-[var(--baby)] text-[var(--navy)] ring-2 ring-[var(--navy)] hover:bg-[var(--baby-dark)] focus:ring-[var(--baby)]`,
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]}`}
      style={{
        "--navy": theme.navy,
        "--navy-dark": "#0a1f38",
        "--navy-light": "#0b254580",
        "--accent": theme.accent,
        "--accent-dark": "#7c3aed",
        "--accent-light": "#8b5cf680",
        "--baby": theme.baby,
        "--baby-dark": "#b8d9ff",
      }}
      {...props}
    >
      {children}
    </button>
  );
};

// ---------------------------------
// HOME PAGE (NEWSPAPER-STYLE)
// ---------------------------------
const HomePage = React.forwardRef(
  ({ coverImage, couple, dateText, locationText }, ref) => {
    return (
      <div
        ref={ref}
        className="w-full h-full bg-white text-[--ink] flex flex-col overflow-hidden"
        style={{ "--ink": theme.ink }}
      >
        {/* Top ribbon */}
        <div
          className="px-4 sm:px-6 py-3 border-b border-black/20 grid grid-cols-3 text-xs tracking-[0.3em] uppercase bg-gradient-to-r from-white to-slate-50"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <div className="text-left text-slate-600">{dateText}</div>
          <div
            className="text-center font-semibold"
            style={{ color: theme.navy }}
          >
            {couple}
          </div>
          <div className="text-right text-slate-600">{locationText}</div>
        </div>

        {/* Masthead */}
        <div className="px-4 sm:px-8 py-6 sm:py-8 border-b border-black/10 bg-gradient-to-br from-white to-slate-50">
          <div
            className="text-center text-3xl sm:text-5xl md:text-6xl font-serif"
            style={{ fontFamily: '"Playfair Display", serif' }}
          >
            <span
              className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--navy)] to-[var(--accent)] text-white shadow-lg"
              style={{
                "--navy": theme.navy,
                "--accent": theme.accent,
              }}
            >
              The Newlywed Times
            </span>
          </div>
          <div
            className="mt-4 text-center text-xl sm:text-2xl tracking-widest"
            style={{ fontFamily: "Cinzel, serif" }}
          >
            <span className="border-y border-black/20 py-3 inline-block text-slate-700">
              WEDDING OF THE YEAR
            </span>
          </div>
        </div>

        {/* Photo (fills remaining height) */}
        <div className="flex-1 p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
          <div className="w-full h-full rounded-2xl shadow-2xl overflow-hidden border-4 border-white">
            <img
              src={coverImage}
              alt="Cover"
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
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
      icon: "💒",
    },
    {
      label: "Reception",
      date: "Fri, Nov 7, 2025",
      time: "6:00 PM",
      location: "The Strand Ballroom, Yangon",
      note: "Dinner & dancing to follow.",
      icon: "🎉",
    },
  ];
  return (
    <div
      ref={ref}
      className="w-full h-full bg-white flex flex-col overflow-hidden"
    >
      <div
        className="h-3 w-full bg-gradient-to-r from-[var(--baby)] via-[var(--navy)] to-[var(--accent)]"
        style={{
          "--navy": theme.navy,
          "--baby": theme.baby,
          "--accent": theme.accent,
        }}
      />
      <div className="px-4 sm:px-6 py-6 flex-1 overflow-auto bg-gradient-to-br from-white to-slate-50">
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-2"
          style={{
            color: theme.navy,
            fontFamily: "Playfair Display, serif",
            background: "linear-gradient(135deg, #0b2545, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Event Details
        </h2>
        <p className="text-center text-slate-600 mb-8 max-w-md mx-auto">
          We're so excited to celebrate with you. Here's the plan for the day.
        </p>
        <div className="grid gap-6 max-w-4xl mx-auto">
          {items.map((it, idx) => (
            <div
              key={idx}
              className="rounded-2xl p-6 shadow-lg border border-slate-200 bg-white hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">{it.icon}</div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">
                      {it.label}
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      {it.date} · {it.time}
                    </div>
                  </div>
                  <div className="mt-2 text-slate-700 font-medium">
                    {it.location}
                  </div>
                  <div className="mt-3 text-slate-600 text-sm bg-slate-50 rounded-lg p-3">
                    {it.note}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 max-w-4xl mx-auto rounded-2xl p-6 bg-gradient-to-r from-[var(--baby)] to-[var(--baby2)] border border-slate-200 shadow-lg">
          <h3
            className="font-bold text-lg mb-2 flex items-center gap-2"
            style={{ color: theme.navy }}
          >
            <span>👗</span> Dress Code
          </h3>
          <p className="text-slate-700">
            <strong>Black-tie optional.</strong> Navy & baby blue accents
            welcome ✨
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
    <div
      ref={ref}
      className="w-full h-full bg-white flex flex-col overflow-hidden"
    >
      <div
        className="h-3 w-full bg-gradient-to-r from-[var(--accent)] via-[var(--baby)] to-[var(--navy)]"
        style={{
          "--navy": theme.navy,
          "--baby": theme.baby,
          "--accent": theme.accent,
        }}
      />
      <div className="px-4 sm:px-6 py-6 flex-1 overflow-auto bg-gradient-to-br from-white to-slate-50">
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4"
          style={{
            color: theme.navy,
            fontFamily: "Playfair Display, serif",
            background: "linear-gradient(135deg, #0b2545, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Our Love Story
        </h2>
        <div className="max-w-4xl mx-auto prose prose-lg">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
            <p className="text-slate-700 leading-relaxed text-lg">
              Fourteen years ago, a chance meeting at a cosmetics store sparked
              a playful hello. Life pulled us to different places and studies
              abroad, but fate had its own flipbook— our pages turned back to
              one another.
            </p>
            <p className="text-slate-700 leading-relaxed text-lg mt-4">
              Today, we're writing the headline we waited for:{" "}
              <em className="font-semibold" style={{ color: theme.navy }}>
                "Hla Thu Zar & Thaw Zin Htet — together, always."
              </em>
            </p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[1, 2, 3].map((n, index) => (
            <div
              key={n}
              className="aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border-2 border-white hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <img
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                src={`images/story${index + 1}.jpg`}
                alt={`Our story ${index + 1}`}
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
      <div
        ref={ref}
        className="w-full h-full bg-white flex flex-col overflow-hidden"
        style={{ pointerEvents: "auto" }}
      >
        <div
          className="h-3 w-full bg-gradient-to-r from-[var(--navy)] via-[var(--accent)] to-[var(--baby)]"
          style={{
            "--navy": theme.navy,
            "--baby": theme.baby,
            "--accent": theme.accent,
          }}
        />
        <div className="px-4 sm:px-6 py-6 flex-1 overflow-hidden bg-gradient-to-br from-white to-slate-50">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-2"
            style={{
              color: theme.navy,
              fontFamily: "Playfair Display, serif",
              background: "linear-gradient(135deg, #0b2545, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            RSVP
          </h2>

          {canShowSheetsWarning(configured, isAdmin) && (
            <div className="mt-3 mx-auto max-w-2xl text-sm p-4 rounded-2xl bg-yellow-50 text-yellow-800 ring-2 ring-yellow-200 flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              <div>
                <strong>Not connected to Google Sheets yet.</strong> Add your{" "}
                <code className="bg-yellow-100 px-2 py-1 rounded">
                  VITE_SHEETS_WEB_APP_URL
                </code>{" "}
                and redeploy.
              </div>
            </div>
          )}

          <p className="text-center text-slate-600 mb-8 max-w-md mx-auto">
            Let us know you're coming. Submissions save to our Google Sheet.
          </p>

          <form
            onSubmit={handleSubmit}
            className="max-w-2xl mx-auto grid gap-6 overflow-auto pr-1"
            style={{
              transform: "translateZ(0)",
              position: "relative",
              zIndex: 1,
            }}
            onPointerDownCapture={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onPointerUpCapture={(e) => e.stopPropagation()}
            onTouchStartCapture={(e) => e.stopPropagation()}
            onTouchEndCapture={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            onClickCapture={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FloatingInput
                label="Full Name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Your full name"
                required
              />
              <FloatingInput
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FloatingSelect
                label="Attending?"
                value={form.attending}
                onChange={(e) => update("attending", e.target.value)}
                options={["Yes", "No"]}
                required
              />
              <FloatingInput
                label="Guests (including you)"
                type="number"
                min={1}
                value={form.guests}
                onChange={(e) => update("guests", Number(e.target.value))}
                placeholder="Number of guests"
                required
              />
            </div>

            <FloatingTextarea
              label="Message"
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              placeholder="Dietary notes, song requests, etc."
              rows={3}
            />

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4">
              <div className="flex items-center gap-4">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saveState === "saving"}
                  className="min-w-[120px] text-[14px] font-semibold py-3 text-white rounded-xl bg-gradient-to-r from-[#0b2545] to-[#8b5cf6] hover:from-[#0a1f38] hover:to-[#7c3aed] focus:ring-4 focus:ring-[#8b5cf680] transition-all duration-200"
                >
                  {saveState === "saving" ? "Saving..." : "Submit RSVP"}
                </Button>

                {saveState === "success" && (
                  <span className="flex items-center gap-2 text-sm font-medium text-green-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Saved successfully!
                  </span>
                )}
                {saveState === "error" && (
                  <span className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Failed to save
                  </span>
                )}
              </div>

              {isAdmin && (
                <div className="flex flex-wrap gap-3 justify-center mb-[2px]">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onRefresh}
                    disabled={loading}
                  >
                    {loading ? "Refreshing..." : "Refresh List"}
                  </Button>
                  <Button type="button" variant="accent" onClick={onExportXLSX}>
                    Export Excel
                  </Button>
                  <Button type="button" variant="baby" onClick={onExportCSV}>
                    Export CSV
                  </Button>
                </div>
              )}
            </div>
          </form>

          {isAdmin ? (
            <div className="mt-8 max-w-6xl mx-auto">
              <h3
                className="font-bold text-lg mb-4 flex items-center gap-2"
                style={{ color: theme.navy }}
              >
                <span>📋</span> Current Responses ({entries.length})
              </h3>
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-[var(--baby)] to-[var(--baby2)]">
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
                            className="text-left p-4 whitespace-nowrap uppercase text-xs tracking-wide font-semibold text-slate-700"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-4 whitespace-nowrap font-medium text-slate-900">
                            {r.name}
                          </td>
                          <td className="p-4 whitespace-nowrap text-slate-600">
                            {r.email}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                r.attending === "Yes"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {r.attending}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap text-slate-600">
                            {r.guests}
                          </td>
                          <td className="p-4 min-w-[16rem] text-slate-600">
                            {r.message}
                          </td>
                          <td className="p-4 whitespace-nowrap text-slate-500 text-xs">
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
            </div>
          ) : (
            <p className="text-center text-slate-500 mt-8">
              Guest list is private. Your response will only be visible to the
              wedding organizers.
            </p>
          )}
        </div>
      </div>
    );
  }
);

// ---------------------------------
// ADMIN LOGIN DIALOG
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="text-center mb-2">
          <div className="w-12 h-12 bg-gradient-to-r from-[var(--navy)] to-[var(--accent)] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg">🔐</span>
          </div>
          <h3 className="text-xl font-bold" style={{ color: theme.navy }}>
            Admin Login
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Enter the admin code to view responses and export tools.
          </p>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <FloatingInput
            label="Admin Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter admin code"
            autoFocus
          />
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl">
              <span>⚠️</span>
              {error}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Login
            </Button>
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
  const containerRef = useRef(null);
  const [page, setPage] = useState(0);

  const [bookSize, setBookSize] = useState({ width: BASE_W, height: BASE_H });
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);

  const configured = isSheetsConfigured();

  const refreshRSVPs = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const rows = await fetchRSVPsFromSheets();
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
      setTimeout(() => {
        if (saveState === "success") {
          alert("Thanks! Your RSVP has been recorded.");
        }
      }, 100);
    } catch (e) {
      console.error("Add RSVP failed:", e);
      setSaveState("error");
      alert("Sorry, we couldn't save your RSVP. Please check back later.");
    } finally {
      setTimeout(() => setSaveState("idle"), 3000);
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
          coverImage="/images/home.webp"
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
      className="min-h-screen w-full overflow-x-hidden"
      style={{
        background: `radial-gradient(1200px 700px at 10% 0%, ${theme.baby}80 0%, transparent 40%), 
                    linear-gradient(180deg, ${theme.navy} 0%, #081a30 100%)`,
      }}
    >
      {/* Header */}
      <header className="max-w-7xl mx-auto px-4 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h1 className="text-white text-xl md:text-2xl font-bold text-center sm:text-left tracking-wide">
            Hla Thu Zar & Thaw Zin Htet — Wedding Invitation
          </h1>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {isAdmin ? (
              <>
                <span className="px-3 py-1.5 rounded-xl text-sm bg-white/20 text-white ring-1 ring-white/30 backdrop-blur-sm">
                  👑 Admin Mode
                </span>
                <button
                  onClick={logoutAdmin}
                  className="px-4 py-2.5 rounded-xl bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 transition-colors text-sm backdrop-blur-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={openAdminLogin}
                className="px-4 py-2.5 rounded-xl bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 transition-colors text-sm backdrop-blur-sm"
              >
                Admin Login
              </button>
            )}
            <div className="flex gap-2">
              <button
                onClick={goPrev}
                className="px-4 py-2.5 rounded-xl bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <span>←</span>
                <span className="hidden sm:inline">Prev</span>
              </button>
              <button
                onClick={goNext}
                className="px-4 py-2.5 rounded-xl bg-white text-slate-900 ring-2 ring-white/50 hover:bg-slate-50 transition-colors font-medium flex items-center gap-2 shadow-lg"
              >
                <span className="hidden sm:inline">Next</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Login Dialog */}
      <AdminLoginDialog
        open={showAdminDialog}
        onClose={closeAdminLogin}
        onSuccess={confirmAdminLogin}
      />

      {/* Main Content */}
      <div className="p-4 py-6">
        <main ref={containerRef} className="max-w-7xl mx-auto">
          <div
            className="mx-auto rounded-3xl shadow-2xl overflow-hidden bg-white/95 backdrop-blur-sm border border-white/20"
            style={{ width: bookSize.width, height: bookSize.height }}
          >
            <HTMLFlipBook
              width={bookSize.width}
              height={bookSize.height}
              size="fixed"
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
          <div className="mt-6 flex items-center justify-center gap-3">
            {pages.map((p, i) => (
              <button
                key={p.key}
                onClick={() => {
                  setPage(i);
                  bookRef.current?.pageFlip().turnToPage(i);
                }}
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  i === page
                    ? "bg-white shadow-lg scale-125"
                    : "bg-white/50 hover:bg-white/70"
                }`}
                aria-label={`Go to ${p.title}`}
              />
            ))}
          </div>

          {/* Mobile instructions */}
          <p className="mt-4 text-center text-sm text-white/80 max-w-md mx-auto">
            📱 <strong>Mobile tip:</strong> Swipe or tap page edges to flip. Use
            buttons above for easier navigation.
          </p>
        </main>
      </div>

      {/* Footer */}
      <footer className="pb-8 text-center text-white/70 text-sm px-4">
        <div className="max-w-2xl mx-auto">
          Made with ❤️ in navy & baby blue.
          <span className="hidden sm:inline">
            {" "}
            Tip: Use arrow keys ↔ to flip pages.
          </span>
        </div>
      </footer>
    </div>
  );
}

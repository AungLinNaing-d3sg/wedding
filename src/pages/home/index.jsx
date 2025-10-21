import {
  CalendarLove01Icon,
  ChurchIcon,
  Hotel02Icon,
  Location08Icon,
  VintageClockIcon,
} from "hugeicons-react";

import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";

import React, { useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { twMerge } from "tailwind-merge";
import * as XLSX from "xlsx";

// ---------------------------------
// THEME
// ---------------------------------
const theme = {
  navy: "#0b2545",
  baby: "#cfe8ff",
  baby2: "#e8f3ff",
  ink: "#0f172a",
  accent: "#8b5cf6",
  success: "#10b981",
  error: "#ef4444",
};

// Responsive dimensions config
const getBookDimensions = () => {
  if (typeof window === "undefined") return { width: 900, height: 620 };

  const screenWidth = window.innerWidth;
  if (screenWidth < 640) {
    // Mobile
    return { width: Math.min(350, screenWidth - 40), height: 620 };
  } else if (screenWidth < 768) {
    // Small tablet
    return { width: 600, height: 650 };
  } else if (screenWidth < 1024) {
    // Tablet
    return { width: 700, height: 650 };
  } else {
    // Desktop
    return { width: 900, height: 620 };
  }
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
  placeholder = "",
  required = false,
  ...props
}) => {
  return (
    <div className="relative w-full">
      <input
        type={type}
        value={value}
        onChange={onChange}
        id={label}
        required={required}
        placeholder={placeholder}
        className="peer block w-full px-3 sm:px-4 lg:py-3 py-2 text-slate-900 bg-white/80 border-2 border-slate-200 rounded-xl sm:rounded-2xl focus:outline-none focus:border-[var(--navy)] focus:bg-white transition-all duration-200 placeholder-transparent text-sm sm:text-base"
        {...props}
      />

      <label
        htmlFor={label}
        className={twMerge(
          "absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm sm:text-base transition-all duration-200 ease-in-out bg-white px-1 rounded peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-focus:-top-3 peer-focus:translate-y-0 peer-focus:text-[13px] peer-focus:text-[var(--navy)]",
          value &&
            value !== "" &&
            "-top-3 translate-y-0 text-[13px] text-[var(--navy)]"
        )}
      >
        <span className={twMerge(value && value !== "" && "text-[13px]")}>
          {label}
        </span>
        {required && <span className="text-red-500 ml-0.5">*</span>}
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
  placeholder = "-- Select --",
  ...props
}) => {
  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={onChange}
        required={required}
        id={label}
        className={`peer block w-full px-3 sm:px-4 lg:py-3 py-2 bg-white/80 border-2 border-slate-200 rounded-xl sm:rounded-2xl
                   focus:outline-none focus:border-[var(--navy)] focus:bg-white transition-all duration-200
                   appearance-none cursor-pointer text-sm sm:text-base
                   ${!value ? "text-transparent" : "text-slate-900"}`}
        {...props}
      >
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {options.map((option) => (
          <option
            className="text-slate-900"
            key={option.value || option}
            value={option.value || option}
          >
            {option.label || option}
          </option>
        ))}
      </select>

      {/* Floating label */}
      <label
        htmlFor={label}
        className={twMerge(
          `absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 
     text-slate-400 text-sm sm:text-base 
     transition-all duration-200 ease-in-out 
     bg-white px-1 rounded 
     peer-focus:-top-3 peer-focus:translate-y-0 
     peer-focus:text-[13px] peer-focus:text-[var(--navy)]`,
          value && "-top-3 translate-y-0 text-[13px] text-[var(--navy)]"
        )}
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {/* ▼ Dropdown icon */}
      <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className={`w-3 h-3 sm:w-4 sm:h-4 ${
            !value ? "text-slate-400" : "text-slate-500"
          }`}
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
  required = false,
  placeholder = " ",
  ...props
}) => {
  return (
    <div className="relative w-full">
      <textarea
        value={value}
        onChange={onChange}
        id={label}
        rows={rows}
        placeholder={placeholder}
        required={required}
        className="peer block w-full px-3 sm:px-4 lg:py-3 py-2 text-slate-900 bg-white/80 border-2 border-slate-200 rounded-xl sm:rounded-2xl
                   focus:outline-none focus:border-[var(--navy)] focus:bg-white transition-all duration-200
                   placeholder-transparent resize-none text-sm sm:text-base"
        {...props}
      />

      <label
        htmlFor={label}
        className={twMerge(
          "absolute left-3 sm:left-4 top-3 text-slate-400 text-sm sm:text-base transition-all duration-200 ease-in-out bg-white px-1 rounded peer-placeholder-shown:top-3 peer-focus:-top-3 peer-focus:translate-y-0 peer-focus:text-[13px] peer-focus:text-[var(--navy)]",
          value &&
            value !== "" &&
            "-top-3 translate-y-0 text-[13px] text-[var(--navy)]"
        )}
      >
        <span className={twMerge(value && value !== "" && "text-[13px]")}>
          {label}
        </span>
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    </div>
  );
};

const Button = ({
  children,
  variant = "primary",
  className = "",
  ...props
}) => {
  const baseClasses =
    "min-w-[120px] sm:min-w-[120px] text-xs sm:text-sm font-semibold py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-medium transition-all duration-200 transform focus:outline-none text-sm sm:text-base";

  const variants = {
    primary: `bg-gradient-to-r from-[#0b2545] to-[#8b5cf6] text-white hover:from-[#0a1f38] hover:to-[#7c3aed] focus:ring-[#8b5cf680] ${className}`,
    secondary: `bg-white text-slate-900 ring-1 sm:ring-2 ring-slate-300 hover:bg-slate-50 focus:ring-slate-400 ${className}`,
    accent: `bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] focus:ring-[var(--accent-light)] ${className}`,
    baby: `bg-[var(--baby)] text-[var(--navy)] ring-1 sm:ring-2 ring-[var(--navy)] hover:bg-[var(--baby-dark)] focus:ring-[var(--baby)] ${className}`,
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]}`}
      style={{
        "--navy": theme.navy,
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
        className="w-full h-screen bg-white text-[--ink] flex flex-col  overflow-hidden"
        style={{ "--ink": theme.ink }}
      >
        {/* Top ribbon */}
        <div
          className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 border-b border-black/20 grid grid-cols-3 text-[10px] xs:text-xs tracking-[0.2em] sm:tracking-[0.3em] uppercase bg-gradient-to-r from-white to-slate-50"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <div className="text-left text-slate-600 truncate pr-1">
            {dateText}
          </div>
          <div
            className="text-center font-semibold truncate px-1"
            style={{ color: theme.navy }}
          >
            {couple}
          </div>
          <div className="text-right text-slate-600 truncate pl-1">
            {locationText}
          </div>
        </div>

        {/* Masthead */}
        <div className="w-full h-screen overflow-hidden">
          <div
            className="relative w-full h-screen"
            style={{
              backgroundImage: `url(${coverImage})`,
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            {/* Content overlay */}
            <div className="relative z-10 flex flex-col items-center justify-start px-3 sm:px-6 md:px-8 py-8 h-full">
              <div
                className="text-center text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-serif"
                style={{ fontFamily: '"Playfair Display", serif' }}
              >
                <span
                  className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-[var(--navy)] to-[var(--accent)] text-white shadow-lg text-sm sm:text-base"
                  style={{
                    "--navy": theme.navy,
                    "--accent": theme.accent,
                  }}
                >
                  The Newlywed Times
                </span>
              </div>
              <div
                className="mt-4 sm:mt-6 text-center text-lg sm:text-xl md:text-2xl tracking-wider sm:tracking-widest"
                style={{ fontFamily: "Cinzel, serif" }}
              >
                <span className="border-y border-white/50 py-2 sm:py-3 inline-block text-white text-sm sm:text-base">
                  WEDDING OF THE YEAR
                </span>
              </div>
            </div>
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
      labelIcon: <ChurchIcon size={22} color="#64748b" />,
      label: "Ceremony",
      dateIcon: <CalendarLove01Icon size={18} color="#475569" />,
      date: "Date: Thus, 06 Nov 2025",
      locationIcon: <Location08Icon size={20} color="#334155" />,
      location: "Judson Chruch",
      timeIcon: <VintageClockIcon size={20} color="#475569" />,
      time: "Time: 3PM - 5PM",
    },
    {
      labelIcon: <Hotel02Icon size={22} color="#64748b" />,
      label: "Dinner Party",
      dateIcon: <CalendarLove01Icon size={18} color="#475569" />,
      date: "Date: Fri, Nov 7, 2025",
      locationIcon: <Location08Icon size={20} color="#334155" />,
      location: "Sedona Hotel, Yangon",
      timeIcon: <VintageClockIcon size={20} color="#475569" />,
      time: "Time: 6PM - 9PM",
    },
  ];
  return (
    <div
      ref={ref}
      className="w-full h-full bg-white flex flex-col overflow-hidden"
    >
      <div
        className="h-2 sm:h-3 w-full bg-gradient-to-r from-[var(--baby)] via-[var(--navy)] to-[var(--accent)]"
        style={{
          "--navy": theme.navy,
          "--baby": theme.baby,
          "--accent": theme.accent,
        }}
      />
      <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 flex-1 overflow-auto bg-gradient-to-br from-white to-slate-50">
        <h2
          className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-2"
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
        <p className="text-center text-slate-600 mb-4 sm:mb-6 md:mb-8 max-w-md mx-auto text-sm sm:text-base px-2">
          We're so excited to celebrate with you. Here's the plan for the day.
        </p>
        <div className="grid gap-3 sm:gap-4 md:gap-6 max-w-4xl mx-auto px-2">
          {items.map((it, idx) => (
            <div
              key={idx}
              className="rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 shadow-md sm:shadow-lg border border-slate-200 bg-white hover:shadow-lg sm:hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start gap-1 sm:gap-2">
                    <div className="text-s uppercase tracking-widest flex gap-2 justify-start items-end font-semibold text-slate-500">
                      <div className="relative">{it.labelIcon}</div>
                      <div className="leading-none">{it.label}</div>
                    </div>
                  </div>
                  <div className="mt-1 flex justify-start items-end gap-2 sm:mt-2 text-slate-700 font-medium text-xs sm:text-base">
                    <div className="relative">{it.locationIcon}</div>
                    <span className="leading-none">{it.location}</span>
                  </div>
                  <div className="mt-2 sm:mt-3 text-slate-600 text-xs sm:text-xs bg-slate-50 p-0 flex lg:flex-row gap-2 lg:gap-0 justify-start items-start flex-col lg:justify-between lg:items-center  rounded-lg lg:p-2 sm:p-3">
                    <div className="flex justify-center items-center gap-1">
                      {it.dateIcon}
                      {it.date}
                    </div>
                    <div className="flex justify-center items-center gap-1">
                      {it.timeIcon}
                      {it.time}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------
// LOVE STORY
// ---------------------------------

const LoveStory = React.forwardRef(({ currentPage }, ref) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const [showPoster, setShowPoster] = useState(true); // Only show poster initially

  // Handle user interaction to enable video playback
  useEffect(() => {
    const handleUserInteraction = () => {
      setUserInteracted(true);
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
    };

    document.addEventListener("click", handleUserInteraction);
    document.addEventListener("touchstart", handleUserInteraction);

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
    };
  }, []);

  // Enhanced gesture blocking for flipbook
  useEffect(() => {
    const stopIfInsideIgnore = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      if (target.closest("[data-ignore-stop]")) {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") {
          e.stopImmediatePropagation();
        }
      }
    };

    const events = ["pointerdown", "touchstart", "mousedown"];

    for (const ev of events) {
      document.addEventListener(ev, stopIfInsideIgnore, { capture: true });
    }

    return () => {
      for (const ev of events) {
        document.removeEventListener(ev, stopIfInsideIgnore, { capture: true });
      }
    };
  }, []);

  // Handle video state when page changes
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    if (currentPage !== "story") {
      // Pause and reset video when leaving story page
      video.pause();
      setIsPlaying(false);
      setShowPoster(true); // Show poster again when leaving and returning to page
    }
  }, [currentPage]);

  // Handle video play/pause
  const handleVideoPlayPause = async () => {
    if (!videoRef.current || !userInteracted) return;

    try {
      const video = videoRef.current;

      if (video.paused) {
        await video.play();
        setIsPlaying(true);
        setShowPoster(false); // Hide poster when video starts playing
      } else {
        video.pause();
        setIsPlaying(false);
        // Don't show poster again when pausing, only keep it for initial state
      }
    } catch (error) {
      console.log("Video play/pause failed:", error);
    }
  };

  // Handle mute/unmute separately
  const handleMuteToggle = (e) => {
    e.stopPropagation(); // Prevent triggering play/pause when clicking mute button

    if (!videoRef.current) return;

    const video = videoRef.current;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setShowPoster(false); // Hide poster when video plays
    };

    const handlePause = () => {
      setIsPlaying(false);
      // Don't show poster when pausing
    };

    const handleEnded = () => {
      setIsPlaying(false);
      // Don't show poster when video ends
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="w-full h-full bg-white flex flex-col overflow-hidden"
    >
      <div
        className="h-2 sm:h-3 w-full bg-gradient-to-r from-[var(--accent)] via-[var(--baby)] to-[var(--navy)]"
        style={{
          "--navy": theme.navy,
          "--baby": theme.baby,
          "--accent": theme.accent,
        }}
      />
      <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 flex-1 overflow-auto bg-gradient-to-br from-white to-slate-50">
        <h2
          className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-3 sm:mb-4"
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
        <div className="max-w-4xl mx-auto prose prose-sm sm:prose-lg px-2">
          <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 shadow-md sm:shadow-lg border border-slate-200">
            <p className="text-slate-700 leading-relaxed text-sm sm:text-base md:text-lg">
              Fourteen years ago, a chance meeting at a cosmetics store sparked
              a playful hello. Life pulled us to different places and studies
              abroad, but fate had its own flipbook— our pages turned back to
              one another.
            </p>
            <p className="text-slate-700 leading-relaxed text-sm sm:text-base md:text-lg mt-2 sm:mt-3 md:mt-4">
              Today, we're writing the headline we waited for:{" "}
              <em className="font-semibold" style={{ color: theme.navy }}>
                "Hla Thu Zar & Thaw Zin Htet — together, always."
              </em>
            </p>
          </div>
        </div>
        <div
          data-ignore-stop
          className="mt-4 sm:mt-6 md:mt-8 grid grid-cols-1 max-w-4xl mx-auto px-2"
        >
          <div className="rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden shadow-md sm:shadow-lg border-2 border-white hover:shadow-lg sm:hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
              {/* Poster Image - Only show for initial state */}
              {showPoster && (
                <div className="absolute inset-0 z-10">
                  <img
                    src="/images/thumbnail.PNG"
                    alt="Our love story video thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Video Element */}
              <video
                ref={videoRef}
                src="/images/story_vdo.mp4"
                className="absolute top-0 left-0 w-full h-full object-cover cursor-pointer bg-gray-100"
                loop
                muted={isMuted}
                playsInline
                webkit-playsinline="true"
                preload="metadata"
                onClick={handleVideoPlayPause}
                // iOS-specific attributes
                x-webkit-airplay="allow"
                x5-video-player-type="h5"
                x5-video-player-fullscreen="true"
                x5-video-orientation="landscape"
                style={{
                  backgroundColor: "#f1f5f9", // fallback background color
                }}
              />

              {/* Custom Video Controls - Always visible when video is playing */}
              <div
                className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 sm:p-4 z-20 transition-opacity duration-300 ${
                  isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Play/Pause Button */}
                  <button
                    onClick={handleVideoPlayPause}
                    className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-white/90 rounded-full hover:bg-white transition-colors"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--navy)]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--navy)]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Mute/Unmute Button */}
                  <button
                    onClick={handleMuteToggle}
                    className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-white/90 rounded-full hover:bg-white transition-colors"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? (
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--navy)]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--navy)]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Large Play Button Overlay - Only show when video is NOT playing AND poster is visible */}
              {!isPlaying && showPoster && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer z-30"
                  onClick={handleVideoPlayPause}
                >
                  <div className="bg-white/90 rounded-full p-4 sm:p-6 shadow-2xl transition-transform hover:scale-110">
                    <svg
                      className="w-8 h-8 sm:w-12 sm:h-12 text-[var(--navy)]"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 md:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 max-w-4xl mx-auto px-2">
          {[0, 1, 2].map((index) => {
            return (
              <div
                key={index}
                className="aspect-[2/3] rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden shadow-md sm:shadow-lg border-2 border-white hover:shadow-lg sm:hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <img
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                  src={`/images/story${index + 1}.jpg`}
                  alt={`Our story ${index + 1}`}
                  onError={(e) => {
                    e.target.src = "/images/thumbnail.PNG"; // fallback to thumbnail if story image fails
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------
// RSVP MODAL DIALOG
// ---------------------------------

function SubmitStatusModal({ open, status, onClose }) {
  if (!open) return null;

  const isSuccess = status === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div className="w-full max-w-xs sm:max-w-sm rounded-xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-slate-200 text-center relative">
        {/* Icon */}
        <div
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 ${
            isSuccess ? "bg-green-100" : "bg-red-100"
          }`}
        >
          {isSuccess ? (
            <FaCheckCircle className="text-green-500" />
          ) : (
            <FaTimesCircle className="text-red-500" />
          )}
        </div>

        {/* Title */}
        <h3
          className={`text-lg sm:text-xl font-bold ${
            isSuccess ? "text-green-600" : "text-red-600"
          }`}
        >
          {isSuccess ? "Submitted Successfully" : "Submission Failed"}
        </h3>

        {/* Message */}
        <p className="mt-2 text-sm sm:text-base text-slate-600">
          {isSuccess
            ? "Thank you! Your RSVP has been received."
            : "Something went wrong. Please try again."}
        </p>

        {/* Close button */}
        <div className="mt-4 sm:mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => {
              onClose?.();
            }}
            className={`px-6 py-2 rounded-lg text-sm font-medium text-white ${
              isSuccess
                ? "bg-green-500 hover:bg-green-600"
                : "bg-red-500 hover:bg-red-600"
            } transition-colors`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function RSVPDialog({
  open,
  onClose,
  isAdmin,
  onSubmit,
  onResetSaveState,
  entries,
  onExportXLSX,
  onExportCSV,
  onRefresh,
  loading,
  saveState,
  configured,
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    attending: "",
    guests: "",
    message: "",
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateRSVP(form)) return alert("Please enter your name and email.");
    await onSubmit({ ...form, timestamp: new Date().toISOString() });
  };

  const handleClose = () => {
    setForm({
      name: "",
      email: "",
      attending: "",
      guests: "",
      message: "",
    });
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-2xl sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl md:rounded-3xl bg-white p-4 sm:p-5 md:p-6 shadow-xl sm:shadow-2xl border border-slate-200 mx-2">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-[var(--navy)] to-[var(--accent)] rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <span className="text-white text-lg sm:text-xl">💌</span>
          </div>
          <h3
            className="text-xl sm:text-2xl font-bold"
            style={{ color: theme.navy }}
          >
            RSVP
          </h3>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-600">
            Let us know you're coming. Submissions save to our Google Sheet.
          </p>
        </div>

        {canShowSheetsWarning(configured, isAdmin) && (
          <div className="mt-2 sm:mt-3 mx-auto text-xs sm:text-sm p-2 sm:p-3 rounded-lg sm:rounded-xl bg-yellow-50 text-yellow-800 ring-1 sm:ring-2 ring-yellow-200 flex items-start sm:items-center gap-2 sm:gap-3 mb-4">
            <span className="text-base sm:text-lg mt-0.5">⚠️</span>
            <div className="flex-1">
              <strong className="text-sm sm:text-base">
                Not connected to Google Sheets yet.
              </strong>{" "}
              <span className="block sm:inline">
                Add your{" "}
                <code className="bg-yellow-100 px-1 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm">
                  VITE_SHEETS_WEB_APP_URL
                </code>{" "}
                and redeploy.
              </span>
            </div>
          </div>
        )}

        {/* RSVP Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {!isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
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
          )}

          {!isAdmin && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <FloatingSelect
                  label="Attending?"
                  placeholder="Attending?"
                  value={form.attending}
                  onChange={(e) => update("attending", e.target.value)}
                  options={["Yes", "No"]}
                  required
                />
                <FloatingInput
                  label="Guests (including you)"
                  type="text"
                  value={form.guests}
                  onChange={(e) => {
                    const onlyNumbers = e.target.value.replace(/[^0-9]/g, "");
                    update("guests", Number(onlyNumbers));
                  }}
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
            </>
          )}

          <div
            className={twMerge(
              "flex flex-col sm:flex-row gap-3 sm:gap-4 items-center pt-3",
              isAdmin ? "justify-center" : "justify-between"
            )}
          >
            {!isAdmin && (
              <Button
                type="submit"
                variant="primary"
                disabled={saveState === "saving"}
                className="min-w-[140px] sm:min-w-[160px] text-sm sm:text-base font-semibold py-2.5 sm:py-3 text-white rounded-xl bg-gradient-to-r from-[#0b2545] to-[#8b5cf6] hover:from-[#0a1f38] hover:to-[#7c3aed] focus:ring-2 sm:focus:ring-4 focus:ring-[#8b5cf680] transition-all duration-200 w-full sm:w-auto"
              >
                {saveState === "saving" ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Submit RSVP"
                )}
              </Button>
            )}

            {isAdmin && (
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 w-full justify-center sm:justify-center items-stretch sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onRefresh}
                  disabled={loading}
                  className="text-xs sm:text-sm w-full sm:w-auto"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </Button>

                <Button
                  type="button"
                  variant="accent"
                  onClick={onExportXLSX}
                  className="w-full sm:w-auto"
                >
                  Export Excel
                </Button>

                <Button
                  type="button"
                  variant="baby"
                  onClick={onExportCSV}
                  className="w-full sm:w-auto"
                >
                  Export CSV
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="text-xs sm:text-sm w-full sm:w-auto"
            >
              Close
            </Button>
          </div>
        </form>

        <SubmitStatusModal
          open={saveState === "success" || saveState === "error"}
          status={saveState}
          onClose={() => {
            setForm({
              name: "",
              email: "",
              attending: "",
              guests: "",
              message: "",
            });
            onResetSaveState?.();
            onClose?.();
          }}
        />

        {isAdmin ? (
          <div className="mt-6 sm:mt-8">
            <h3
              className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2"
              style={{ color: theme.navy }}
            >
              <span>📋</span> Current Responses ({entries.length})
            </h3>
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-md sm:shadow-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto max-h-48 sm:max-h-64">
                <table className="min-w-full text-xs sm:text-sm">
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
                          className="text-left p-2 sm:p-3 md:p-4 whitespace-nowrap uppercase tracking-wide font-semibold text-slate-700 text-xs"
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
                        <td className="p-2 sm:p-3 md:p-4 whitespace-nowrap font-medium text-slate-900 max-w-[80px] sm:max-w-none truncate">
                          {r.name}
                        </td>
                        <td className="p-2 sm:p-3 md:p-4 whitespace-nowrap text-slate-600 max-w-[100px] sm:max-w-none truncate">
                          {r.email}
                        </td>
                        <td className="p-2 sm:p-3 md:p-4 whitespace-nowrap">
                          <span
                            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${
                              r.attending === "Yes"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {r.attending}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 md:p-4 whitespace-nowrap text-slate-600">
                          {r.guests}
                        </td>
                        <td className="p-2 sm:p-3 md:p-4 text-slate-600 max-w-[120px] sm:max-w-[16rem] truncate">
                          {r.message}
                        </td>
                        <td className="p-2 sm:p-3 md:p-4 whitespace-nowrap text-slate-500 text-xs">
                          {r.timestamp
                            ? new Date(r.timestamp).toLocaleDateString()
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
          <p className="text-center text-slate-500 mt-4 sm:mt-6 text-sm sm:text-base">
            Guest list is private. Your response will only be visible to the
            wedding organizers.
          </p>
        )}
      </div>
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-xs sm:max-w-md rounded-xl sm:rounded-2xl md:rounded-3xl bg-white p-4 sm:p-5 md:p-6 shadow-xl sm:shadow-2xl border border-slate-200 mx-2">
        <div className="text-center mb-2">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-[var(--navy)] to-[var(--accent)] rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-3">
            <span className="text-white text-base sm:text-lg">🔐</span>
          </div>
          <h3
            className="text-lg sm:text-xl font-bold"
            style={{ color: theme.navy }}
          >
            Admin Login
          </h3>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-600">
            Enter the admin code to view responses and export tools.
          </p>
        </div>
        <form onSubmit={submit} className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
          <FloatingInput
            label="Admin Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter admin code"
            autoFocus
          />
          {error && (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-red-600 bg-red-50 p-2 sm:p-3 rounded-lg sm:rounded-xl">
              <span>⚠️</span>
              {error}
            </div>
          )}
          <div className="flex gap-2 sm:gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="text-xs sm:text-sm"
            >
              Login
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------
// RSVP BUTTON PAGE
// ---------------------------------
const RSVPButtonPage = React.forwardRef(({ onOpenRSVP }, ref) => {
  return (
    <div
      ref={ref}
      className="w-full h-full bg-white flex flex-col overflow-hidden"
    >
      <div
        className="h-2 sm:h-3 w-full bg-gradient-to-r from-[var(--navy)] via-[var(--accent)] to-[var(--baby)]"
        style={{
          "--navy": theme.navy,
          "--baby": theme.baby,
          "--accent": theme.accent,
        }}
      />
      <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 flex-1 overflow-auto bg-gradient-to-br from-white to-slate-50 flex flex-col items-center justify-center">
        <div className="text-center max-w-2xl mx-auto">
          <h2
            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-4 sm:mb-6"
            style={{
              color: theme.navy,
              fontFamily: "Playfair Display, serif",
              background: "linear-gradient(135deg, #0b2545, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            We Can't Wait to Celebrate With You!
          </h2>

          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg sm:shadow-xl border border-slate-200 mb-6 sm:mb-8">
            <p className="text-slate-700 leading-relaxed text-sm sm:text-base md:text-lg mb-4 sm:mb-6">
              Your presence would mean the world to us as we begin this
              beautiful journey together. Please let us know if you can join our
              celebration.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <Button
                onClick={onOpenRSVP}
                variant="primary"
                className="min-w-[200px] text-sm sm:text-base font-semibold py-3 sm:py-4 px-6 sm:px-8 text-white rounded-xl bg-gradient-to-r from-[#0b2545] to-[#8b5cf6] hover:from-[#0a1f38] hover:to-[#7c3aed] focus:ring-2 sm:focus:ring-4 focus:ring-[#8b5cf680] transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                💌 RSVP Now
              </Button>
            </div>
          </div>

          <div className="text-slate-600 text-xs sm:text-sm max-w-md mx-auto">
            <p>Please respond by October 31, 2025.</p>
            <p className="mt-2 text-slate-500">
              We look forward to celebrating with you!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

// ---------------------------------
// Page Home
// ---------------------------------
const Home = () => {
  const bookRef = useRef(null);
  const containerRef = useRef(null);
  const [page, setPage] = useState(0);

  const [bookSize, setBookSize] = useState(getBookDimensions());
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [showRSVPDialog, setShowRSVPDialog] = useState(false);

  const [currentPage, setCurrentPage] = useState("home");

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
    } catch (e) {
      console.error("Add RSVP failed:", e);
      setSaveState("error");
      alert("Sorry, we couldn't save your RSVP. Please check back later.");
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

  const pages = [
    {
      key: "home",
      title: "Home",
      el: (
        <HomePage
          coverImage="/images/home.jpg"
          couple="Hla Thu Zar & Thaw Zin Htet"
          dateText="November 7th, 2025"
          locationText="Yangon, Myanmar"
        />
      ),
    },
    { key: "details", title: "Event Details", el: <EventDetails /> },
    {
      key: "story",
      title: "Love Story",
      el: <LoveStory currentPage={currentPage} />,
    },
    {
      key: "rsvp-button",
      title: "RSVP",
      el: <RSVPButtonPage onOpenRSVP={() => setShowRSVPDialog(true)} />,
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

    const updateBookSize = () => {
      const newSize = getBookDimensions();
      setBookSize(newSize);
    };

    updateBookSize();
    window.addEventListener("resize", updateBookSize);

    return () => {
      window.removeEventListener("resize", updateBookSize);
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

  const handleCloseRSVP = () => {
    setShowRSVPDialog(false);
    setSaveState("idle");
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
      <header className="max-w-7xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-2 sm:pb-4">
        <div className="flex flex-col xs:flex-row items-center justify-between gap-2 sm:gap-3 md:gap-4">
          <h1 className="text-white text-lg sm:text-xl md:text-2xl font-bold text-center xs:text-left tracking-wide leading-tight">
            Hla Thu Zar & Thaw Zin Htet
            <br className="xs:hidden" />
            <span className="text-white/80 text-sm sm:text-base">
              {" "}
              Wedding Invitation
            </span>
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
            {isAdmin ? (
              <>
                <button className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 transition-colors text-xs sm:text-sm backdrop-blur-sm">
                  👑 Admin
                </button>
                <button
                  onClick={logoutAdmin}
                  className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 transition-colors text-xs sm:text-sm backdrop-blur-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={openAdminLogin}
                className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 transition-colors text-xs sm:text-sm backdrop-blur-sm"
              >
                Admin Login
              </button>
            )}
            <div className="flex gap-1 sm:gap-2">
              <button
                onClick={goPrev}
                className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20 transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              >
                <span>←</span>
                <span className="hidden xs:inline">Prev</span>
              </button>
              <button
                onClick={goNext}
                className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-white text-slate-900 ring-1 sm:ring-2 ring-white/50 hover:bg-slate-50 transition-colors font-medium flex items-center gap-1 sm:gap-2 text-xs sm:text-sm shadow-lg"
              >
                <span className="hidden xs:inline">Next</span>
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

      {/* RSVP Dialog */}
      <RSVPDialog
        open={showRSVPDialog}
        onClose={handleCloseRSVP}
        isAdmin={isAdmin}
        onSubmit={handleRSVPSubmit}
        entries={rsvps}
        onExportXLSX={exportXLSX}
        onExportCSV={exportCSV}
        onRefresh={refreshRSVPs}
        loading={loading}
        saveState={saveState}
        onResetSaveState={() => setSaveState("idle")}
        configured={configured}
      />

      {/* Main Content */}
      <main
        ref={containerRef}
        className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 md:py-6 md:pb-0"
      >
        <div
          className="mx-auto rounded-lg sm:rounded-xl md:rounded-2xl lg:rounded-3xl shadow-lg sm:shadow-xl md:shadow-2xl overflow-hidden bg-white/95 backdrop-blur-sm border border-white/20"
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
            useMouseEvents={true}
            onFlip={(e) => {
              setPage(e.data);
              const pageIndex = e.data;
              const pageKey = pages[pageIndex]?.key;
              if (pageKey) {
                setCurrentPage(pageKey);
              }
            }}
          >
            {pages.map((p) => (
              <div key={p.key} className="w-full h-full">
                {p.el}
              </div>
            ))}
          </HTMLFlipBook>
        </div>

        {/* Page dots */}
        <div className="mt-3 sm:mt-4 md:mt-6 flex items-center justify-center gap-2 sm:gap-3">
          {pages.map((p, i) => (
            <button
              key={p.key}
              onClick={() => {
                setPage(i);
                bookRef.current?.pageFlip().turnToPage(i);
              }}
              className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-all duration-300 ${
                i === page
                  ? "bg-white shadow-lg scale-110 sm:scale-125"
                  : "bg-white/50 hover:bg-white/70"
              }`}
              aria-label={`Go to ${p.title}`}
            />
          ))}
        </div>

        {/* Mobile instructions */}
        <p className="mt-2 sm:mt-3 md:mt-4 text-center text-xs sm:text-sm text-white/80 max-w-md mx-auto px-2">
          📱 <strong>Mobile tip:</strong> Swipe or tap page edges to flip.
          <span className="hidden sm:inline">
            {" "}
            Use buttons above for easier navigation.
          </span>
        </p>
      </main>

      {/* Footer */}
      <footer className="pb-4 sm:pb-6 md:pb-8 text-center text-white/70 text-xs sm:text-sm px-3 sm:px-4">
        <span className="hidden sm:inline">
          Tip: Use arrow keys ↔ to flip pages.
        </span>
      </footer>
    </div>
  );
};

export default Home;

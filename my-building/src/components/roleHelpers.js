// ─── roleHelpers.js ────────────────────────────────────────────────────────────
// Shared constants, Cesium command helper, and analytics functions
// for all role dashboard components.

export const FONT              = '"Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif';
export const CARBON_FACTOR     = 0.233;   // kg CO₂ per kWh (Bulgarian grid avg)
export const WORKING_DAYS_MONTH= 22;
export const FLOOR_AREA_M2     = 3200;

export const CIRCUIT_COLORS = {
  main:"#60A5FA",circuit6boiler:"#F87171",circuit7:"#FBBF24",elevator:"#A78BFA",
  circuit8:"#34D399",circuit9:"#22D3EE",circuit10:"#FB923C",circuit11:"#F472B6",
  circuit12:"#A3E635",airconditioner1:"#38BDF8",airconditioner2:"#0EA5E9",
  outsidelighting1:"#FDE68A",outsidelighting2:"#FCD34D",
  vehiclecharging1:"#4ADE80",vehiclecharging2:"#16A34A",
  "3DLED":"#FF6B9D",ovk:"#E879F9",
};

export const CIRCUIT_LABELS = {
  main:"Main",circuit6boiler:"Boiler",circuit7:"Circuit 7",elevator:"Elevator",
  circuit8:"Circuit 8",circuit9:"Circuit 9",circuit10:"Circuit 10",
  circuit11:"Circuit 11",circuit12:"Circuit 12",airconditioner1:"Air Cond. 1",
  airconditioner2:"Air Cond. 2",outsidelighting1:"Outside Light N",
  outsidelighting2:"Outside Light S",vehiclecharging1:"EV Charger 1",
  vehiclecharging2:"EV Charger 2","3DLED":"3D LED Display",ovk:"OVK",
};

export const ROLES = {
  director: {
    id:"director", emoji:"🏢", label:"Building Director",
    tagline:"Costs, sustainability and compliance",
    color:"#818CF8", accentBg:"rgba(99,102,241,0.15)",
    accentBorder:"rgba(129,140,248,0.4)",
  },
  facilities: {
    id:"facilities", emoji:"🔧", label:"Facilities Manager",
    tagline:"Faults, waste and equipment health",
    color:"#34D399", accentBg:"rgba(52,211,153,0.12)",
    accentBorder:"rgba(52,211,153,0.4)",
  },
  it: {
    id:"it", emoji:"💻", label:"IT / Technical",
    tagline:"Precise data, circuits and server room",
    color:"#60A5FA", accentBg:"rgba(96,165,250,0.12)",
    accentBorder:"rgba(96,165,250,0.4)",
  },
  sustainability: {
    id:"sustainability", emoji:"🌿", label:"Sustainability Officer",
    tagline:"Carbon, solar and EU reporting",
    color:"#4ADE80", accentBg:"rgba(74,222,128,0.12)",
    accentBorder:"rgba(74,222,128,0.4)",
  },
  worker: {
    id:"worker", emoji:"👤", label:"Office Worker",
    tagline:"My floor, my room, my comfort",
    color:"#FBBF24", accentBg:"rgba(251,191,36,0.12)",
    accentBorder:"rgba(251,191,36,0.4)",
  },
  ev: {
    id:"ev", emoji:"🚗", label:"EV Driver",
    tagline:"Charging cost and best time to plug in",
    color:"#38BDF8", accentBg:"rgba(56,189,248,0.12)",
    accentBorder:"rgba(56,189,248,0.4)",
  },
  visitor: {
    id:"visitor", emoji:"👋", label:"Visitor",
    tagline:"Explore this smart building",
    color:"#F9A8D4", accentBg:"rgba(249,168,212,0.12)",
    accentBorder:"rgba(249,168,212,0.4)",
  },
};

export const ROLE_ENTRY_ACTIONS = {
  director:      [{ action:"reset_view" }, { action:"show_heatmap", metric:"temperature" }],
  facilities:    [{ action:"reset_view" }, { action:"show_alerts" }],
  it:            [{ action:"reset_view" }, { action:"show_energy_flow" }],
  sustainability:[{ action:"reset_view" }, { action:"show_heatmap", metric:"co2" }, { action:"show_energy_flow" }],
  worker:        [{ action:"reset_view" }],
  ev:            [{ action:"reset_view" }],
  visitor:       [{ action:"reset_view" }],
};

export const ROLE_ENTRY_MESSAGE = {
  director:      "Showing building overview with temperature heatmap",
  facilities:    "Showing all active alerts across the building",
  it:            "Showing server room and technical circuits",
  sustainability:"Showing CO₂ levels and energy flow",
  worker:        "Showing your floor — select your room below",
  ev:            "Showing EV charging area",
  visitor:       "Welcome! Explore this smart building",
};

// ─── Cesium command helper ────────────────────────────────────────────────────

export function dispatchCmd(action, extra = {}) {
  window.dispatchEvent(new CustomEvent("cesium-command", {
    detail: { type:"cesium", action, ...extra },
  }));
}

// ─── Analytics helpers ────────────────────────────────────────────────────────

export function computeBaseline(replayData, tariff) {
  const frames = replayData["main"] || [];
  if (!frames.length) return null;
  const totalKwh = frames.reduce((s, f) => s + (f.watts/1000)*0.25, 0);
  const watts    = frames.map(f => f.watts);
  const peakW    = Math.max(...watts);
  const avgW     = watts.reduce((a,b) => a+b, 0) / watts.length;
  const afterHoursKwh = frames.filter(f => f.hour >= 20 || f.hour < 7)
                               .reduce((s, f) => s + (f.watts/1000)*0.25, 0);
  const dailyKwh   = totalKwh / 2;
  const monthlyKwh = dailyKwh * WORKING_DAYS_MONTH;
  const annualKwh  = monthlyKwh * 12;
  const eui        = annualKwh / FLOOR_AREA_M2;
  const monthlyCost= monthlyKwh * tariff;
  const carbonKgDay= dailyKwh * CARBON_FACTOR;
  const carbonTonYear = (annualKwh * CARBON_FACTOR) / 1000;
  const afterHoursRatio = totalKwh > 0 ? (afterHoursKwh/totalKwh)*100 : 0;
  const peakFactor = avgW > 0 ? peakW / avgW : 0;
  const loadFactor = peakW > 0 ? avgW / peakW : 0;

  let epcRating = "G";
  if      (eui < 50)  epcRating = "A+";
  else if (eui < 100) epcRating = "A";
  else if (eui < 150) epcRating = "B";
  else if (eui < 200) epcRating = "C";
  else if (eui < 250) epcRating = "D";
  else if (eui < 350) epcRating = "E";
  else if (eui < 500) epcRating = "F";

  return { totalKwh, dailyKwh, monthlyKwh, annualKwh,
           peakW, avgW, peakFactor, loadFactor,
           afterHoursKwh, afterHoursRatio, monthlyCost,
           carbonKgDay, carbonTonYear, eui, epcRating };
}

export function circuitStats(replayData, circuitId) {
  const frames = replayData[circuitId] || [];
  if (!frames.length) return { current:0, peak:0, avg:0, kwh48:0 };
  const watts  = frames.map(f => f.watts);
  const current= (frames[frames.length-1] || frames[0])?.watts ?? 0;
  return {
    current,
    peak:   Math.max(...watts),
    avg:    watts.reduce((a,b) => a+b,0) / watts.length,
    kwh48:  frames.reduce((s,f) => s + (f.watts/1000)*0.25, 0),
  };
}

export function fmtEur(v)  { return `€${Math.abs(v ?? 0).toFixed(0)}`; }
export function fmtW(w)    { return w >= 1000 ? `${(w/1000).toFixed(1)} kW` : `${Math.round(w)} W`; }

export function epcColor(r) {
  if (r === "A+" || r === "A") return "#4ADE80";
  if (r === "B"  || r === "C") return "#FBBF24";
  if (r === "D"  || r === "E") return "#FB923C";
  return "#EF4444";
}

export function comfortStatus(temp, co2, humidity) {
  const warnings = [];
  if (temp > 25) warnings.push("warm");
  if (temp < 18) warnings.push("cold");
  if (co2  > 1000) warnings.push("stuffy");
  if (humidity < 25 || humidity > 75) warnings.push("dry/humid");
  if (!warnings.length) return { label:"✓ Comfortable right now", color:"#4ADE80" };
  if (co2 > 1000)       return { label:"💨 Air feels a bit stale — try opening a window", color:"#FBBF24" };
  if (temp > 25)        return { label:"🌡 A bit warm — AC may need adjustment", color:"#FB923C" };
  if (warnings.length === 1) return { label:`⚠ Mostly comfortable (${warnings[0]})`, color:"#FBBF24" };
  return { label:"Contact facilities: Room needs attention", color:"#EF4444" };
}

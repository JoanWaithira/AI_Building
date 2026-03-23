// ─── ScenarioPanel ────────────────────────────────────────────────────────────
// Self-contained "What-if Scenarios" tab for the Replay panel.
// When a role is active (localStorage "dtwin_role"), shows role-specific
// scenarios. Otherwise shows the generic goal-based flow (expert mode).

import { useState } from 'react';
import { ROLE_SCENARIOS } from '../scenarios/roleScenarios';

const FLOOR_AREA_M2      = 3200;
const DEMAND_CHARGE      = 8.50;
const CARBON_FACTOR      = 0.233;
const WORKING_DAYS_MONTH = 22;

const UI_FONT = '"Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif';

// ─── Generic goal / scenario lookups ──────────────────────────────────────────

const GOAL_SCENARIOS = {
  bill:    ["after_hours_off","ev_night_shift","friday_shutdown","weekend_skeleton"],
  comfort: ["precool_30min","monday_ventilation","boiler_setpoint"],
  carbon:  ["after_hours_off","boiler_setpoint","weekend_skeleton","ev_night_shift"],
  ev:      ["ev_night_shift","ev_stagger"],
  waste:   ["after_hours_off","friday_shutdown","weekend_skeleton"],
};

const GOAL_LABELS = {
  bill:    { emoji: "💰", label: "Reduce our energy bill" },
  comfort: { emoji: "🌡", label: "Improve comfort for staff" },
  carbon:  { emoji: "🌍", label: "Lower our carbon footprint" },
  ev:      { emoji: "🚗", label: "Manage EV charging better" },
  waste:   { emoji: "🔍", label: "Find energy waste" },
};

// ─── Role metadata ────────────────────────────────────────────────────────────

const ROLE_META = {
  director:       { emoji: "🏢", label: "Director",        color: "#60A5FA" },
  facilities:     { emoji: "🔧", label: "Facilities",      color: "#4ADE80" },
  it:             { emoji: "💻", label: "IT",               color: "#60A5FA" },
  sustainability: { emoji: "🌿", label: "Sustainability",   color: "#34D399" },
  worker:         { emoji: "👤", label: "Worker",           color: "#FBBF24" },
  ev:             { emoji: "🚗", label: "EV Driver",        color: "#38BDF8" },
  visitor:        { emoji: "🏛", label: "Visitor",          color: "#A78BFA" },
};

const ROLE_PRIMARY_COLOR = {
  director: "#4ADE80", facilities: "#4ADE80", sustainability: "#34D399",
  it: "#60A5FA", worker: "#FBBF24", ev: "#38BDF8", visitor: "#A78BFA",
};

const TIMEFRAME_BADGE = {
  immediate:  { label: "Now",       color: "#4ADE80", bg: "rgba(74,222,128,0.15)" },
  this_week:  { label: "This week", color: "#60A5FA", bg: "rgba(96,165,250,0.15)" },
  this_month: { label: "Month",     color: "#FBBF24", bg: "rgba(251,191,36,0.15)" },
  long_term:  { label: "Long term", color: "#A78BFA", bg: "rgba(167,139,250,0.15)" },
};

const COMBINED_HEADERS = {
  director:       "Your scenario plan",
  facilities:     "Operations change summary",
  it:             "System resilience summary",
  sustainability: "Environmental impact summary",
  ev:             "Your charging plan",
};

// ─── Generic pure helpers ─────────────────────────────────────────────────────

function computeBaseline(replayData, tariff) {
  const frames = replayData["main"] || [];
  if (!frames.length) return null;

  const totalKwh = frames.reduce((sum, f) => sum + (f.watts / 1000) * 0.25, 0);
  const watts    = frames.map(f => f.watts);
  const peakW    = Math.max(...watts);
  const avgW     = watts.reduce((a, b) => a + b, 0) / watts.length;

  const afterHoursKwh = frames
    .filter(f => f.hour >= 20 || f.hour < 7)
    .reduce((sum, f) => sum + (f.watts / 1000) * 0.25, 0);

  const hvacKwh = ["airconditioner1","airconditioner2","circuit6boiler"]
    .reduce((sum, id) => {
      const s = replayData[id] || [];
      return sum + s.reduce((a, f) => a + (f.watts / 1000) * 0.25, 0);
    }, 0);

  const lightingKwh = ["outsidelighting1","outsidelighting2"]
    .reduce((sum, id) => {
      const s = replayData[id] || [];
      return sum + s.reduce((a, f) => a + (f.watts / 1000) * 0.25, 0);
    }, 0);

  const dailyKwh        = totalKwh / 2;
  const monthlyKwh      = dailyKwh * WORKING_DAYS_MONTH;
  const annualKwh       = monthlyKwh * 12;
  const eui             = annualKwh / FLOOR_AREA_M2;
  const afterHoursRatio = totalKwh > 0 ? (afterHoursKwh / totalKwh) * 100 : 0;
  const hvacFraction    = totalKwh > 0 ? (hvacKwh / totalKwh) * 100 : 0;
  const lightingFraction= totalKwh > 0 ? (lightingKwh / totalKwh) * 100 : 0;
  const dailyCost       = dailyKwh * tariff;
  const monthlyCost     = monthlyKwh * tariff;
  const carbonKgDay     = dailyKwh * CARBON_FACTOR;
  const carbonTonYear   = (annualKwh * CARBON_FACTOR) / 1000;
  const peakFactor      = avgW > 0 ? peakW / avgW : 0;
  const loadFactor      = peakW > 0 ? avgW / peakW : 0;

  let epcRating = "G";
  if      (eui < 50)  epcRating = "A+";
  else if (eui < 100) epcRating = "A";
  else if (eui < 150) epcRating = "B";
  else if (eui < 200) epcRating = "C";
  else if (eui < 250) epcRating = "D";
  else if (eui < 350) epcRating = "E";
  else if (eui < 500) epcRating = "F";

  return {
    totalKwh, dailyKwh, monthlyKwh, annualKwh,
    peakW, avgW, peakFactor, loadFactor,
    afterHoursKwh, afterHoursRatio,
    hvacFraction, lightingFraction,
    dailyCost, monthlyCost,
    carbonKgDay, carbonTonYear,
    eui, epcRating,
  };
}

function applyScenario(scenarioId, replayData, tariff, occupancyPct, carbonPriceTonne) {
  const baseline = computeBaseline(replayData, tariff);
  if (!baseline) return null;

  const cp = carbonPriceTonne / 1000;

  const scenarios = {
    after_hours_off: {
      label: "After-hours Auto-off", emoji: "🌙",
      description: "Circuits 9 and 11 switch off automatically after 20:00. Staff who stay late can override manually.",
      hardware: null,
      compute: () => {
        const affectedIds = ["circuit9","circuit11"];
        const savedKwh = affectedIds.reduce((sum, id) => {
          const s = replayData[id] || [];
          return sum + s.filter(f => f.hour >= 20 || f.hour < 7)
                        .reduce((a, f) => a + (f.watts / 1000) * 0.25, 0);
        }, 0);
        const dailySaving   = savedKwh / 2;
        const monthlySaving = dailySaving * WORKING_DAYS_MONTH;
        return { dailySaving, monthlySaving, demandSaving: 0,
                 carbonSaving: monthlySaving * CARBON_FACTOR,
                 comfortImpact: "No change expected", peakReduction: 0 };
      },
    },

    ev_night_shift: {
      label: "EV Night Shift", emoji: "🚗",
      description: "Move EV charging from daytime to after 22:00 when tariffs are lower and grid is greener.",
      hardware: "EV smart charging controller", hardwareCost: 650,
      compute: () => {
        const evIds = ["vehiclecharging1","vehiclecharging2"];
        const daytimeKwh = evIds.reduce((sum, id) => {
          const s = replayData[id] || [];
          return sum + s.filter(f => f.hour >= 7 && f.hour < 22)
                        .reduce((a, f) => a + (f.watts / 1000) * 0.25, 0);
        }, 0);
        const peakEvW = evIds.reduce((max, id) => {
          const s = replayData[id] || [];
          return max + Math.max(...s.map(f => f.watts), 0);
        }, 0);
        const dailySaving   = (daytimeKwh / 2) * 0.08;
        const demandSaving  = (peakEvW / 1000) * DEMAND_CHARGE;
        const monthlySaving = dailySaving * WORKING_DAYS_MONTH + demandSaving;
        return { dailySaving, monthlySaving, demandSaving,
                 carbonSaving: (daytimeKwh / 2) * WORKING_DAYS_MONTH * CARBON_FACTOR * 0.15,
                 comfortImpact: "No change expected", peakReduction: 18 };
      },
    },

    friday_shutdown: {
      label: "Friday Afternoon Shutdown", emoji: "🏖",
      description: "Non-essential circuits off from 13:00 on Fridays. Saves roughly half a working day per week.",
      hardware: null,
      compute: () => {
        const nonEssential = ["circuit9","circuit11","circuit7","outsidelighting1","outsidelighting2","3DLED"];
        const afternoonKwh = nonEssential.reduce((sum, id) => {
          const s = replayData[id] || [];
          return sum + s.filter(f => f.hour >= 13 && f.hour < 20)
                        .reduce((a, f) => a + (f.watts / 1000) * 0.25, 0);
        }, 0);
        const dailySaving   = afternoonKwh / 2;
        const monthlySaving = dailySaving * 4;
        return { dailySaving, monthlySaving, demandSaving: 0,
                 carbonSaving: monthlySaving * CARBON_FACTOR,
                 comfortImpact: "No change on Mon–Thu", peakReduction: 5 };
      },
    },

    weekend_skeleton: {
      label: "Weekend Skeleton Mode", emoji: "🏢",
      description: "Keep only essential services running on weekends. Everything else powers down automatically.",
      hardware: "BMS scheduling integration", hardwareCost: 1200,
      compute: () => {
        const nonEssential = ["circuit7","circuit8","circuit9","circuit10",
          "circuit11","circuit12","airconditioner1","airconditioner2",
          "outsidelighting1","outsidelighting2","3DLED","elevator"];
        const weekendKwh = nonEssential.reduce((sum, id) => {
          const s = replayData[id] || [];
          return sum + s.reduce((a, f) => a + (f.watts / 1000) * 0.25, 0);
        }, 0) * 0.85;
        const dailySaving   = weekendKwh / 2;
        const monthlySaving = dailySaving * 8;
        return { dailySaving, monthlySaving, demandSaving: 0,
                 carbonSaving: monthlySaving * CARBON_FACTOR,
                 comfortImpact: "Weekdays unaffected", peakReduction: 30 };
      },
    },

    precool_30min: {
      label: "Pre-cool Before Arrival", emoji: "❄️",
      description: "Start AC 30 minutes before staff arrive so the building is already comfortable at 08:00.",
      hardware: null,
      compute: () => {
        const acIds = ["airconditioner1","airconditioner2"];
        const acAvgW = acIds.reduce((sum, id) => {
          const s = replayData[id] || [];
          const morning = s.filter(f => f.hour >= 7 && f.hour < 9);
          return sum + (morning.length ? morning.reduce((a, f) => a + f.watts, 0) / morning.length : 0);
        }, 0);
        const addedKwh      = (acAvgW / 1000) * 0.5;
        const savedKwh      = addedKwh * 0.3;
        const dailySaving   = Math.max(0, savedKwh - addedKwh) * tariff;
        const monthlySaving = dailySaving * WORKING_DAYS_MONTH;
        return { dailySaving, monthlySaving, demandSaving: 0,
                 carbonSaving: monthlySaving * CARBON_FACTOR,
                 comfortImpact: "Noticeable improvement", peakReduction: 8 };
      },
    },

    boiler_setpoint: {
      label: "Boiler Setpoint −2°C", emoji: "🔥",
      description: "Reduce heating setpoint by 2°C. Barely noticeable to occupants, meaningful energy saving.",
      hardware: null,
      compute: () => {
        const s = replayData["circuit6boiler"] || [];
        const boilerKwh  = s.reduce((a, f) => a + (f.watts / 1000) * 0.25, 0);
        const savedKwh   = (boilerKwh / 2) * 0.12;
        const monthlySaving = savedKwh * WORKING_DAYS_MONTH * tariff;
        return { dailySaving: savedKwh * tariff, monthlySaving, demandSaving: 0,
                 carbonSaving: savedKwh * WORKING_DAYS_MONTH * CARBON_FACTOR,
                 comfortImpact: "Slight reduction — within comfort range", peakReduction: 3 };
      },
    },

    monday_ventilation: {
      label: "Monday Morning Ventilation", emoji: "💨",
      description: "Run ventilation 1 hour before staff arrive on Mondays to flush weekend air buildup.",
      hardware: null,
      compute: () => {
        const s = replayData["ovk"] || [];
        const ovkAvgW = s.length ? s.reduce((a, f) => a + f.watts, 0) / s.length : 3000;
        const addedKwh      = (ovkAvgW / 1000) * 1;
        const monthlySaving = addedKwh * 4 * tariff * -1;
        return { dailySaving: 0, monthlySaving, demandSaving: 0, carbonSaving: 0,
                 comfortImpact: "Noticeable improvement on Mondays", peakReduction: 0,
                 note: "Small cost — big comfort win on Monday mornings" };
      },
    },

    ev_stagger: {
      label: "Stagger EV Chargers", emoji: "⚡",
      description: "Start the two EV chargers 30 minutes apart instead of simultaneously. Cuts peak demand spike.",
      hardware: null,
      compute: () => {
        const evIds = ["vehiclecharging1","vehiclecharging2"];
        const peakEvW = evIds.reduce((max, id) => {
          const s = replayData[id] || [];
          return max + Math.max(...s.map(f => f.watts), 0);
        }, 0);
        const demandSaving  = (peakEvW * 0.4 / 1000) * DEMAND_CHARGE;
        return { dailySaving: 0, monthlySaving: demandSaving, demandSaving,
                 carbonSaving: 0, comfortImpact: "No change expected", peakReduction: 40,
                 note: "No energy saving — but reduces peak demand charge" };
      },
    },
  };

  const s = scenarios[scenarioId];
  if (!s) return null;
  const result = s.compute();

  const carbonValueSaving  = result.carbonSaving * cp * 1000;
  const totalMonthlySaving = result.monthlySaving + carbonValueSaving;
  const paybackMonths      = s.hardwareCost
    ? Math.ceil(s.hardwareCost / Math.max(0.01, totalMonthlySaving))
    : 0;

  const savingFraction = baseline.monthlyCost > 0
    ? result.monthlySaving / baseline.monthlyCost : 0;
  const newEui = baseline.eui * (1 - savingFraction);
  let newEpc = baseline.epcRating;
  if      (newEui < 50)  newEpc = "A+";
  else if (newEui < 100) newEpc = "A";
  else if (newEui < 150) newEpc = "B";
  else if (newEui < 200) newEpc = "C";
  else if (newEui < 250) newEpc = "D";
  else if (newEui < 350) newEpc = "E";
  else if (newEui < 500) newEpc = "F";

  return {
    ...s, scenarioId, ...result,
    carbonValueSaving, totalMonthlySaving, paybackMonths,
    hardwareCost: s.hardwareCost || 0,
    newEpcRating: newEpc,
    currentEpcRating: baseline.epcRating,
  };
}

function getSeverity(monthlySaving, baselineMonthlyCost) {
  if (!baselineMonthlyCost) return "LOW";
  const pct = (monthlySaving / baselineMonthlyCost) * 100;
  if (pct >= 10) return "HIGH";
  if (pct >= 4)  return "MED";
  return "LOW";
}

function epcColor(rating) {
  if (rating === "A+" || rating === "A") return "#4ADE80";
  if (rating === "B"  || rating === "C") return "#FBBF24";
  if (rating === "D"  || rating === "E") return "#FB923C";
  return "#EF4444";
}

function fmtEur(v) {
  return isNaN(v) ? "—" : `€${Math.abs(v).toFixed(0)}`;
}

// ─── Mini design-system (mirrors the parent panel) ────────────────────────────

const SBtn = ({ children, onClick, style = {}, active = false, accent = false, full = false, danger = false, small = false }) => (
  <button onClick={onClick} style={{
    borderRadius: 6, border: "1px solid rgba(125,211,252,0.28)", cursor: "pointer",
    fontFamily: UI_FONT, fontSize: small ? 10 : 12, fontWeight: 600, letterSpacing: "0.01em",
    transition: "all 0.15s ease", padding: small ? "4px 8px" : "7px 10px",
    width: full ? "100%" : undefined,
    background: danger ? "rgba(220,38,38,0.24)" : active ? "rgba(37,99,235,0.35)" : accent ? "rgba(14,165,233,0.24)" : "rgba(255,255,255,0.08)",
    color: danger ? "#FECACA" : active ? "#DBEAFE" : accent ? "#CFFAFE" : "#DDEFFF",
    borderColor: danger ? "rgba(248,113,113,0.58)" : active ? "rgba(147,197,253,0.72)" : accent ? "rgba(125,211,252,0.6)" : "rgba(186,230,253,0.35)",
    ...style,
  }}>{children}</button>
);

const SSL = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A5C8EC", marginBottom: 5, marginTop: 12 }}>
    {children}
  </div>
);

const SHr = () => <div style={{ height: 1, background: "rgba(147,197,253,0.2)", margin: "10px 0" }} />;

// ─── Param renderer ───────────────────────────────────────────────────────────

function ParamControl({ param, value, onChange }) {
  if (param.type === "slider") {
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9AB8D7", marginBottom: 3 }}>
          <span>{param.label}</span>
          <span style={{ fontWeight: 700, color: "#E2F1FF" }}>{value}{param.unit || ""}</span>
        </div>
        <input
          type="range" min={param.min} max={param.max} step={param.step}
          value={value}
          onChange={e => onChange(param.type === "slider" && param.step < 1 ? Number(e.target.value) : Number(e.target.value))}
          style={{ width: "100%", accentColor: "#60A5FA", cursor: "pointer" }}
        />
      </div>
    );
  }
  if (param.type === "toggle") {
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 4 }}>{param.label}</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {param.options.map(opt => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                padding: "4px 8px", fontSize: 10, borderRadius: 4, cursor: "pointer",
                fontFamily: UI_FONT,
                border: `1px solid ${value === opt ? "rgba(125,211,252,0.6)" : "rgba(125,211,252,0.2)"}`,
                background: value === opt ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.06)",
                color: value === opt ? "#DBEAFE" : "#9AB8D7",
              }}
            >{opt}</button>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScenarioPanel({
  replayDataRef,
  pvDataRef,
  tariffRate,    setTariffRate,
  occupancyLevel,setOccupancyLevel,
  carbonPrice,   setCarbonPrice,
  scenarioGoal,  setScenarioGoal,
  appliedScenarios, setAppliedScenarios,
  scenarioResult,   setScenarioResult,
}) {
  const replayData = replayDataRef.current || {};
  const pvData     = pvDataRef?.current || {};
  const hasData    = Object.values(replayData).some(arr => Array.isArray(arr) && arr.length > 0);

  // ── Role scenario state ─────────────────────────────────────────────────────
  const [scenarioParams,      setScenarioParams]      = useState({});
  const [expandedEffects,     setExpandedEffects]     = useState({});
  const [appliedRoleScenarios,setAppliedRoleScenarios]= useState([]);

  // Read active role each render (localStorage is sync)
  const activeRole    = localStorage.getItem("dtwin_role") || null;
  const roleScenarios = activeRole ? (ROLE_SCENARIOS[activeRole] || []) : [];
  const roleMeta      = activeRole ? (ROLE_META[activeRole] || {}) : null;
  const primaryColor  = activeRole ? (ROLE_PRIMARY_COLOR[activeRole] || "#4ADE80") : "#4ADE80";

  // ── Param helpers ───────────────────────────────────────────────────────────
  function getParam(scenId, param) {
    const key = `${scenId}_${param.id}`;
    return key in scenarioParams ? scenarioParams[key] : param.default;
  }
  function setParam(scenId, paramId, val) {
    setScenarioParams(prev => ({ ...prev, [`${scenId}_${paramId}`]: val }));
  }
  function getRoleResult(sc) {
    const params = {};
    (sc.params || []).forEach(param => { params[param.id] = getParam(sc.id, param); });
    try { return sc.compute(replayData, pvData, tariffRate, params); }
    catch { return null; }
  }

  if (!hasData) {
    return (
      <div style={{ fontSize: 11, color: "#9AB8D7", lineHeight: 1.6, padding: "12px 0", textAlign: "center" }}>
        Load energy data first — click{" "}
        <span style={{ color: "#A5B4FC", fontWeight: 700 }}>▶ Energy</span>{" "}
        tab and press{" "}
        <span style={{ color: "#60A5FA", fontWeight: 700 }}>Play</span>{" "}
        to populate baseline data.
      </div>
    );
  }

  const baseline = computeBaseline(replayData, tariffRate);

  // ── Generic applied scenario results ───────────────────────────────────────
  const appliedResults = appliedScenarios
    .map(id => applyScenario(id, replayData, tariffRate, occupancyLevel, carbonPrice))
    .filter(Boolean);

  const combined = appliedResults.length > 0 ? {
    monthlySaving:  appliedResults.reduce((s, r) => s + r.totalMonthlySaving, 0),
    carbonSaving:   appliedResults.reduce((s, r) => s + (r.carbonSaving || 0), 0),
    peakReduction:  Math.max(...appliedResults.map(r => r.peakReduction || 0)),
    hardwareCost:   appliedResults.reduce((s, r) => s + (r.hardwareCost || 0), 0),
    paybackMonths:  Math.max(...appliedResults.map(r => r.paybackMonths || 0)),
    comfortImpact:  appliedResults[0]?.comfortImpact || "",
    currentEpc:     appliedResults[0]?.currentEpcRating || baseline?.epcRating || "—",
    newEpc:         appliedResults[appliedResults.length - 1]?.newEpcRating || baseline?.epcRating || "—",
  } : null;

  const toggleGenericScenario = (id) => {
    setAppliedScenarios(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleRoleScenario = (id) => {
    setAppliedRoleScenarios(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const severityStyle = (sev) => ({
    HIGH: { background: "rgba(220,38,38,0.2)",  color: "#FCA5A5" },
    MED:  { background: "rgba(251,191,36,0.2)", color: "#FDE68A" },
    LOW:  { background: "rgba(74,222,128,0.2)", color: "#BBF7D0" },
  }[sev] || { background: "rgba(74,222,128,0.2)", color: "#BBF7D0" });

  // ── Role combined results ───────────────────────────────────────────────────
  const roleAppliedResults = appliedRoleScenarios
    .map(id => {
      const sc = roleScenarios.find(s => s.id === id);
      return sc ? getRoleResult(sc) : null;
    })
    .filter(Boolean);

  const roleCombined = roleAppliedResults.length > 0 ? {
    monthlySaving: roleAppliedResults.reduce((s, r) => s + (r.monthlySaving || 0), 0),
    carbonSaving:  roleAppliedResults.reduce((s, r) => s + (r.carbonSaving || 0), 0),
    peakReduction: Math.max(...roleAppliedResults.map(r => r.peakReduction || 0)),
    hardwareCost:  roleAppliedResults.reduce((s, r) => s + (r.hardwareCost || 0), 0),
  } : null;

  // ── Pill style ──────────────────────────────────────────────────────────────
  const pillStyle = {
    background: "rgba(15,23,42,0.85)",
    border: "1px solid rgba(125,211,252,0.2)",
    borderRadius: 8, padding: 8,
  };
  const pillLabel = { fontSize: 10, color: "#9AB8D7", marginBottom: 3 };
  const pillValue = { fontSize: 14, fontWeight: 700, color: "#E2F1FF" };

  return (
    <>
      {/* ── Baseline strip — always shown ── */}
      {baseline && (
        <>
          <SSL>Building Baseline</SSL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            <div style={pillStyle}>
              <div style={pillLabel}>EUI</div>
              <div style={pillValue}>{baseline.eui.toFixed(0)} <span style={{ fontSize: 9, color: "#9AB8D7" }}>kWh/m²/yr</span></div>
            </div>
            <div style={pillStyle}>
              <div style={pillLabel}>EPC Rating</div>
              <div style={{ ...pillValue, color: epcColor(baseline.epcRating) }}>{baseline.epcRating}</div>
            </div>
            <div style={pillStyle}>
              <div style={pillLabel}>After-hours waste</div>
              <div style={pillValue}>{baseline.afterHoursRatio.toFixed(1)}<span style={{ fontSize: 9, color: "#9AB8D7" }}>%</span></div>
            </div>
            <div style={pillStyle}>
              <div style={pillLabel}>Est. monthly cost</div>
              <div style={{ ...pillValue, color: "#FBBF24" }}>~{fmtEur(baseline.monthlyCost)}</div>
            </div>
          </div>
          <SHr />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ROLE MODE — role-specific scenario cards
          ════════════════════════════════════════════════════════════════════ */}
      {activeRole && roleScenarios.length > 0 ? (
        <>
          {/* Role header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>{roleMeta?.emoji}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: primaryColor }}>{roleMeta?.label} Scenarios</div>
              <div style={{ fontSize: 10, color: "#64748B" }}>Showing scenarios relevant to your role</div>
            </div>
          </div>

          {/* Scenario cards */}
          {roleScenarios.map((sc, idx, arr) => {
            const result   = getRoleResult(sc);
            const isApplied= appliedRoleScenarios.includes(sc.id);
            const tfBadge  = TIMEFRAME_BADGE[sc.timeframe] || TIMEFRAME_BADGE.immediate;
            const expanded = expandedEffects[sc.id] || false;
            if (!result) return null;

            return (
              <div key={sc.id}>
                <div style={{
                  background: "rgba(15,23,42,0.85)",
                  border: `1px solid ${isApplied ? "rgba(74,222,128,0.35)" : "rgba(125,211,252,0.2)"}`,
                  borderRadius: 8, padding: "10px 12px", marginBottom: 6,
                  transition: "border-color 0.15s",
                }}>

                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{sc.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, color: "#E2F1FF", flex: 1, lineHeight: 1.3 }}>{sc.label}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      whiteSpace: "nowrap", flexShrink: 0,
                      color: tfBadge.color, background: tfBadge.bg,
                      border: `1px solid ${tfBadge.color}44`,
                    }}>{tfBadge.label}</span>
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 8, lineHeight: 1.5 }}>
                    {sc.description}
                  </div>

                  {/* Params */}
                  {(sc.params || []).map(param => (
                    <ParamControl
                      key={param.id}
                      param={param}
                      value={getParam(sc.id, param)}
                      onChange={val => setParam(sc.id, param.id, val)}
                    />
                  ))}

                  {/* Primary metric */}
                  <div style={{ fontSize: 17, fontWeight: 700, color: primaryColor, marginBottom: 3, lineHeight: 1.2 }}>
                    {result.primaryLabel}
                  </div>

                  {/* Runtime status (IT scenarios) */}
                  {result.runtimeStatus && (
                    <div style={{ fontSize: 10, color: "#CBD5E1", marginBottom: 4, lineHeight: 1.4 }}>
                      {result.runtimeStatus}
                    </div>
                  )}

                  {/* Checklist (ISO 50001 scenario) */}
                  {result.checklist && (
                    <div style={{ marginBottom: 6 }}>
                      {result.checklist.map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 3 }}>
                          <span style={{ fontSize: 10, flexShrink: 0,
                            color: item.done === true ? "#4ADE80" : item.done === null ? "#FBBF24" : "#EF4444" }}>
                            {item.done === true ? "✓" : item.done === null ? "?" : "✗"}
                          </span>
                          <span style={{ fontSize: 10, color: item.done === true ? "#9AB8D7" : "#CBD5E1", lineHeight: 1.4 }}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Secondary metrics */}
                  {result.secondary && result.secondary.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
                      {result.secondary.map(({ label, value }) => (
                        <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "4px 6px" }}>
                          <div style={{ fontSize: 9, color: "#64748B" }}>{label}</div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#CBD5E1" }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Confidence */}
                  {result.confidence === "medium" && (
                    <div style={{ fontSize: 9, color: "#94A3B8", marginBottom: 5 }}>~ estimate</div>
                  )}
                  {result.confidence === "low" && (
                    <div style={{ fontSize: 9, color: "#FBBF24", marginBottom: 5 }}>⚠ rough estimate</div>
                  )}

                  {/* Side effects collapsible */}
                  {result.sideEffects && result.sideEffects.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <button
                        onClick={() => setExpandedEffects(prev => ({ ...prev, [sc.id]: !prev[sc.id] }))}
                        style={{ background: "none", border: "none", cursor: "pointer",
                          color: "#94A3B8", fontSize: 10, padding: 0, fontFamily: UI_FONT }}
                      >
                        Things to consider {expanded ? "▴" : "▾"}
                      </button>
                      {expanded && (
                        <ul style={{ margin: "4px 0 0 0", padding: "0 0 0 14px" }}>
                          {result.sideEffects.map((fx, i) => (
                            <li key={i} style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.5 }}>{fx}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Action button — worker/visitor get mailto, others get apply */}
                  {result.actionLabel ? (
                    <a
                      href={result.actionMailto || "#"}
                      style={{
                        display: "block", width: "100%", textAlign: "center",
                        padding: "6px 10px", borderRadius: 6, textDecoration: "none",
                        fontSize: 11, fontWeight: 600, fontFamily: UI_FONT,
                        background: "rgba(251,191,36,0.18)",
                        border: "1px solid rgba(251,191,36,0.4)",
                        color: "#FBBF24",
                      }}
                    >
                      {result.actionLabel}
                    </a>
                  ) : (
                    <SBtn
                      full
                      accent={!isApplied}
                      active={isApplied}
                      onClick={() => toggleRoleScenario(sc.id)}
                    >
                      {isApplied ? "✓ Applied — click to remove" : "Apply to model"}
                    </SBtn>
                  )}
                </div>
                {idx < arr.length - 1 && <SHr />}
              </div>
            );
          })}

          {/* ── Role combined results ── */}
          {roleCombined && appliedRoleScenarios.length > 0 && (
            <>
              <SHr />
              <div style={{
                background: "rgba(10,18,32,0.9)",
                border: `1px solid rgba(74,222,128,0.3)`,
                borderRadius: 10, padding: "12px 14px", marginBottom: 10,
              }}>
                <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 4 }}>
                  {COMBINED_HEADERS[activeRole] || "Your scenario plan"}
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: primaryColor, letterSpacing: "-0.02em" }}>
                  {roleCombined.monthlySaving > 0
                    ? `${fmtEur(roleCombined.monthlySaving)}/month`
                    : roleCombined.carbonSaving > 0
                      ? `${(roleCombined.carbonSaving*12/1000).toFixed(2)} tCO₂/yr`
                      : "Applied"}
                </div>
                <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 10 }}>
                  {appliedRoleScenarios.length === 1 ? "1 scenario applied" : `${appliedRoleScenarios.length} scenarios combined`}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                  {[
                    ["Monthly saving",  roleCombined.monthlySaving > 0 ? fmtEur(roleCombined.monthlySaving) : "—"],
                    ["Carbon saved",    `${roleCombined.carbonSaving.toFixed(1)} kg/mo`],
                    ["Peak reduction",  `${roleCombined.peakReduction}%`],
                    ["Total investment",roleCombined.hardwareCost > 0 ? fmtEur(roleCombined.hardwareCost) : "None"],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ background: "rgba(15,23,42,0.7)", borderRadius: 6, padding: "7px 8px" }}>
                      <div style={{ fontSize: 9, color: "#9AB8D7", marginBottom: 2 }}>{lbl}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#E2F1FF" }}>{val}</div>
                    </div>
                  ))}
                </div>
                <SHr />
                <SBtn
                  full danger
                  onClick={() => setAppliedRoleScenarios([])}
                >
                  × Clear all applied
                </SBtn>
              </div>
            </>
          )}
        </>
      ) : (
        /* ════════════════════════════════════════════════════════════════════
           GENERIC / EXPERT MODE — goal-based flow
           ════════════════════════════════════════════════════════════════════ */
        <>
          {/* STEP 2 — Goal selection */}
          {!scenarioGoal ? (
            <>
              <SSL>What's your goal?</SSL>
              {Object.entries(GOAL_LABELS).map(([key, { emoji, label }]) => (
                <GoalCard key={key} emoji={emoji} label={label} onClick={() => setScenarioGoal(key)} />
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setScenarioGoal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#60A5FA", fontSize: 11, padding: "0 0 8px 0", fontFamily: UI_FONT }}
              >
                ← Back to goals
              </button>

              <div style={{ fontSize: 13, fontWeight: 700, color: "#E2F1FF", marginBottom: 10 }}>
                {GOAL_LABELS[scenarioGoal]?.emoji} {GOAL_LABELS[scenarioGoal]?.label}
              </div>

              {/* STEP 3 — Scenario cards */}
              {GOAL_SCENARIOS[scenarioGoal]?.map((scenarioId, idx, arr) => {
                const result = applyScenario(scenarioId, replayData, tariffRate, occupancyLevel, carbonPrice);
                if (!result) return null;
                const sev = getSeverity(result.totalMonthlySaving, baseline?.monthlyCost);
                const isApplied = appliedScenarios.includes(scenarioId);

                return (
                  <div key={scenarioId}>
                    <div style={{
                      background: "rgba(15,23,42,0.85)", border: "1px solid rgba(125,211,252,0.2)",
                      borderRadius: 8, padding: "10px 12px", marginBottom: 6,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                        <span style={{ fontSize: 16 }}>{result.emoji}</span>
                        <span style={{ fontWeight: 700, fontSize: 12, color: "#E2F1FF", flex: 1 }}>{result.label}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                          padding: "2px 6px", borderRadius: 4,
                          ...severityStyle(sev),
                        }}>{sev}</span>
                      </div>

                      <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 8, lineHeight: 1.5 }}>
                        {result.description}
                      </div>

                      <div style={{ fontSize: 16, fontWeight: 700, color: "#4ADE80", marginBottom: 3 }}>
                        Saves ~{fmtEur(result.totalMonthlySaving)}/month
                      </div>
                      {result.demandSaving > 0 && (
                        <div style={{ fontSize: 10, color: "#FBBF24", marginBottom: 3 }}>
                          + {fmtEur(result.demandSaving)} demand charge saving
                        </div>
                      )}
                      {result.note && (
                        <div style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic", marginBottom: 3 }}>
                          {result.note}
                        </div>
                      )}
                      {result.hardwareCost > 0 && (
                        <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 3 }}>
                          Needs: {result.hardware} — payback ~{result.paybackMonths} months
                        </div>
                      )}
                      {result.newEpcRating !== result.currentEpcRating && (
                        <div style={{ fontSize: 10, color: "#CBD5E1", marginBottom: 6 }}>
                          EPC:{" "}
                          <span style={{ color: epcColor(result.currentEpcRating), fontWeight: 700 }}>{result.currentEpcRating}</span>
                          {" → "}
                          <span style={{ color: epcColor(result.newEpcRating), fontWeight: 700 }}>{result.newEpcRating}</span>
                        </div>
                      )}

                      <SBtn
                        full
                        accent={!isApplied}
                        active={isApplied}
                        onClick={() => toggleGenericScenario(scenarioId)}
                      >
                        {isApplied ? "✓ Applied — click to remove" : "Apply scenario"}
                      </SBtn>
                    </div>
                    {idx < arr.length - 1 && <SHr />}
                  </div>
                );
              })}
            </>
          )}

          {/* STEP 4 — Generic combined results */}
          {combined && appliedScenarios.length > 0 && (
            <>
              <SHr />
              <div style={{
                background: "rgba(10,18,32,0.9)", border: "1px solid rgba(74,222,128,0.3)",
                borderRadius: 10, padding: "12px 14px", marginBottom: 10,
              }}>
                <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 4 }}>
                  {appliedScenarios.length === 1 ? "Your scenario" : `${appliedScenarios.length} scenarios combined`}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#4ADE80", letterSpacing: "-0.02em" }}>
                  {fmtEur(combined.monthlySaving)}<span style={{ fontSize: 14, color: "#9AB8D7", fontWeight: 400 }}>/month</span>
                </div>
                <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 10 }}>estimated saving</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                  {[
                    ["Annual saving", fmtEur(combined.monthlySaving * 12)],
                    ["Carbon saved", `${combined.carbonSaving.toFixed(1)} kg/mo`],
                    ["Peak reduction", `${combined.peakReduction}%`],
                    ["Payback", combined.hardwareCost > 0 ? `~${combined.paybackMonths} mo` : "Immediate"],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ background: "rgba(15,23,42,0.7)", borderRadius: 6, padding: "7px 8px" }}>
                      <div style={{ fontSize: 9, color: "#9AB8D7", marginBottom: 2 }}>{lbl}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#E2F1FF" }}>{val}</div>
                    </div>
                  ))}
                </div>

                {combined.comfortImpact && (
                  <div style={{ fontSize: 10, color: "#CBD5E1", marginBottom: 8 }}>
                    Comfort: {combined.comfortImpact}
                  </div>
                )}

                {combined.currentEpc !== combined.newEpc && (
                  <>
                    <SHr />
                    <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 4 }}>EPC change</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: epcColor(combined.currentEpc) + "33", color: epcColor(combined.currentEpc), fontWeight: 700, fontSize: 13, padding: "3px 8px", borderRadius: 5 }}>
                        {combined.currentEpc}
                      </span>
                      <span style={{ color: "#475569" }}>→</span>
                      <span style={{ background: epcColor(combined.newEpc) + "33", color: epcColor(combined.newEpc), fontWeight: 700, fontSize: 13, padding: "3px 8px", borderRadius: 5 }}>
                        {combined.newEpc}
                      </span>
                    </div>
                  </>
                )}

                {combined.hardwareCost > 0 && (
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 8 }}>
                    Requires investment: {fmtEur(combined.hardwareCost)} total<br />
                    Payback: ~{combined.paybackMonths} months at current rates
                  </div>
                )}

                <SHr />
                <SBtn
                  full danger
                  onClick={() => { setAppliedScenarios([]); setScenarioResult(null); }}
                >
                  × Clear scenarios
                </SBtn>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Sensitivity sliders — always shown ── */}
      <SHr />
      <SSL>Sensitivity sliders</SSL>

      {[
        {
          label: `Tariff  €${tariffRate.toFixed(2)}/kWh`,
          min: 0.10, max: 0.40, step: 0.01,
          value: tariffRate,
          onChange: e => setTariffRate(Number(e.target.value)),
          accent: "#60A5FA",
        },
        {
          label: `Occupancy  ${occupancyLevel}%`,
          min: 25, max: 100, step: 5,
          value: occupancyLevel,
          onChange: e => setOccupancyLevel(Number(e.target.value)),
          accent: "#34D399",
        },
        {
          label: `Carbon price  €${carbonPrice}/tonne`,
          min: 0, max: 100, step: 5,
          value: carbonPrice,
          onChange: e => setCarbonPrice(Number(e.target.value)),
          accent: "#F59E0B",
        },
      ].map(({ label, min, max, step, value, onChange, accent }) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 4 }}>{label}</div>
          <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={onChange}
            style={{ width: "100%", accentColor: accent, cursor: "pointer" }}
          />
        </div>
      ))}
    </>
  );
}

// ─── GoalCard ─────────────────────────────────────────────────────────────────

function GoalCard({ emoji, label, onClick }) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(125,211,252,0.6)"; e.currentTarget.style.background = "rgba(15,23,42,0.95)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(125,211,252,0.2)"; e.currentTarget.style.background = "rgba(15,23,42,0.7)"; }}
      style={{
        padding: "12px 14px", borderRadius: 8,
        border: "1px solid rgba(125,211,252,0.2)",
        background: "rgba(15,23,42,0.7)",
        cursor: "pointer", marginBottom: 6,
        display: "flex", alignItems: "center", gap: 10,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color: "#E2F1FF" }}>{label}</span>
    </div>
  );
}

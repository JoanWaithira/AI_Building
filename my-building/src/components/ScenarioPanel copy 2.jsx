import { useState } from "react";

const FLOOR_AREA_M2 = 3200;
const CARBON_FACTOR = 0.233;
const WORKING_DAYS_MONTH = 22;
const UI_FONT = '"Segoe UI", "Inter", Arial, sans-serif';

// ─────────────────────────────────────────────────────────────────────────────
// Goals
// ─────────────────────────────────────────────────────────────────────────────

const GOAL_LABELS = {
  bill:    { emoji: "💰", label: "Reduce energy bill" },
  comfort: { emoji: "🌡", label: "Improve comfort" },
  carbon:  { emoji: "🌍", label: "Lower carbon footprint" },
  waste:   { emoji: "🔍", label: "Find energy waste" },
};

const GOAL_SCENARIOS = {
  bill:    ["after_hours_off", "weekend_mode", "boiler_setback"],
  comfort: ["morning_precool", "fresh_air_start"],
  carbon:  ["after_hours_off", "weekend_mode", "boiler_setback"],
  waste:   ["after_hours_off", "weekend_mode"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Simple scenario definitions
// ─────────────────────────────────────────────────────────────────────────────

const SIMPLE_SCENARIOS = {
  after_hours_off: {
    label: "After-hours auto-off",
    emoji: "🌙",
    description: "Turn off non-essential loads after 20:00.",
    estimate: (baseline, tariff) => {
      const savedKwhMonth = baseline.afterHoursKwhDay * 0.35 * WORKING_DAYS_MONTH;
      return {
        monthlySaving: savedKwhMonth * tariff,
        carbonSaving: savedKwhMonth * CARBON_FACTOR,
        comfortImpact: "Low",
        peakReduction: 5,
      };
    },
  },

  weekend_mode: {
    label: "Weekend skeleton mode",
    emoji: "🏢",
    description: "Keep only essential systems on during weekends.",
    estimate: (baseline, tariff) => {
      const savedKwhMonth = baseline.dailyKwh * 0.20 * 8;
      return {
        monthlySaving: savedKwhMonth * tariff,
        carbonSaving: savedKwhMonth * CARBON_FACTOR,
        comfortImpact: "Low",
        peakReduction: 10,
      };
    },
  },

  boiler_setback: {
    label: "Boiler setpoint -2°C",
    emoji: "🔥",
    description: "Reduce heating setpoint slightly to save energy.",
    estimate: (baseline, tariff) => {
      const savedKwhMonth = baseline.hvacKwhDay * 0.10 * WORKING_DAYS_MONTH;
      return {
        monthlySaving: savedKwhMonth * tariff,
        carbonSaving: savedKwhMonth * CARBON_FACTOR,
        comfortImpact: "Medium",
        peakReduction: 3,
      };
    },
  },

  morning_precool: {
    label: "Pre-cool before arrival",
    emoji: "❄️",
    description: "Start cooling a little earlier so staff arrive to a comfortable space.",
    estimate: (baseline, tariff) => {
      const extraKwhMonth = 4 * WORKING_DAYS_MONTH;
      return {
        monthlySaving: -(extraKwhMonth * tariff),
        carbonSaving: -(extraKwhMonth * CARBON_FACTOR),
        comfortImpact: "High benefit",
        peakReduction: 0,
        note: "Improves comfort, but may slightly increase energy use.",
      };
    },
  },

  fresh_air_start: {
    label: "Fresh-air start on Monday",
    emoji: "💨",
    description: "Run ventilation before people arrive after the weekend.",
    estimate: (baseline, tariff) => {
      const extraKwhMonth = 8;
      return {
        monthlySaving: -(extraKwhMonth * tariff),
        carbonSaving: -(extraKwhMonth * CARBON_FACTOR),
        comfortImpact: "High benefit",
        peakReduction: 0,
        note: "Small energy cost for better Monday air quality.",
      };
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeBaseline(replayData, tariff) {
  const frames = replayData?.main || [];
  if (!frames.length) return null;

  const totalKwh48h = frames.reduce((sum, f) => sum + (f.watts / 1000) * 0.25, 0);
  const watts = frames.map(f => f.watts || 0);
  const peakW = Math.max(...watts, 0);
  const avgW = watts.reduce((a, b) => a + b, 0) / Math.max(1, watts.length);

  const afterHoursKwh48h = frames
    .filter(f => f.hour >= 20 || f.hour < 7)
    .reduce((sum, f) => sum + (f.watts / 1000) * 0.25, 0);

  const hvacIds = ["airconditioner1", "airconditioner2", "circuit6boiler"];
  const hvacKwh48h = hvacIds.reduce((sum, id) => {
    const s = replayData[id] || [];
    return sum + s.reduce((a, f) => a + (f.watts / 1000) * 0.25, 0);
  }, 0);

  const dailyKwh = totalKwh48h / 2;
  const afterHoursKwhDay = afterHoursKwh48h / 2;
  const hvacKwhDay = hvacKwh48h / 2;
  const monthlyKwh = dailyKwh * WORKING_DAYS_MONTH;
  const annualKwh = monthlyKwh * 12;
  const monthlyCost = monthlyKwh * tariff;
  const eui = annualKwh / FLOOR_AREA_M2;

  // Energy Use Intensity (EUI) rating based on typical commercial building benchmarks

  let epcRating = "G";
  if      (eui < 50)  epcRating = "A+";
  else if (eui < 100) epcRating = "A";
  else if (eui < 150) epcRating = "B";
  else if (eui < 200) epcRating = "C";
  else if (eui < 250) epcRating = "D";
  else if (eui < 350) epcRating = "E";
  else if (eui < 500) epcRating = "F";

  return {
    dailyKwh,
    monthlyKwh,
    monthlyCost,
    peakW,
    avgW,
    afterHoursKwhDay,
    hvacKwhDay,
    eui,
    epcRating,
  };
}

function fmtEur(v) {
  const sign = v < 0 ? "-" : "";
  return `${sign}€${Math.abs(v).toFixed(0)}`;
}

function severity(monthlySaving, baselineMonthlyCost) {
  if (!baselineMonthlyCost) return "LOW";
  const pct = Math.abs(monthlySaving / baselineMonthlyCost) * 100;
  if (pct >= 10) return "HIGH";
  if (pct >= 4) return "MED";
  return "LOW";
}

function epcColor(rating) {
  if (rating === "A+" || rating === "A") return "#4ADE80";
  if (rating === "B" || rating === "C") return "#FBBF24";
  if (rating === "D" || rating === "E") return "#FB923C";
  return "#EF4444";
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI bits
// ─────────────────────────────────────────────────────────────────────────────

const SBtn = ({ children, onClick, active = false, full = false, danger = false }) => (
  <button
    onClick={onClick}
    style={{
      width: full ? "100%" : undefined,
      padding: "7px 10px",
      borderRadius: 6,
      cursor: "pointer",
      fontFamily: UI_FONT,
      fontSize: 12,
      fontWeight: 600,
      border: "1px solid rgba(125,211,252,0.28)",
      background: danger
        ? "rgba(220,38,38,0.24)"
        : active
          ? "rgba(37,99,235,0.35)"
          : "rgba(255,255,255,0.08)",
      color: danger ? "#FECACA" : active ? "#DBEAFE" : "#DDEFFF",
    }}
  >
    {children}
  </button>
);

const SectionLabel = ({ children }) => (
  <div
    style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "#A5C8EC",
      marginBottom: 6,
      marginTop: 12,
    }}
  >
    {children}
  </div>
);

const Divider = () => (
  <div style={{ height: 1, background: "rgba(147,197,253,0.2)", margin: "10px 0" }} />
);

function GoalCard({ emoji, label, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        border: "1px solid rgba(125,211,252,0.2)",
        background: "rgba(15,23,42,0.7)",
        cursor: "pointer",
        marginBottom: 6,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color: "#E2F1FF" }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ScenarioPanel({
  replayDataRef,
  tariffRate,
  setTariffRate,
  occupancyLevel,
  setOccupancyLevel,
  carbonPrice,
  setCarbonPrice,
}) {
  const replayData = replayDataRef.current || {};
  const hasData = Object.values(replayData).some(arr => Array.isArray(arr) && arr.length > 0);

  const [scenarioGoal, setScenarioGoal] = useState(null);
  const [appliedScenarios, setAppliedScenarios] = useState([]);

  if (!hasData) {
    return (
      <div style={{ fontSize: 11, color: "#9AB8D7", lineHeight: 1.6, padding: "12px 0", textAlign: "center" }}>
        Load energy data first to see scenario estimates.
      </div>
    );
  }

  const baseline = computeBaseline(replayData, tariffRate);

  const results = appliedScenarios
    .map(id => {
      const sc = SIMPLE_SCENARIOS[id];
      if (!sc || !baseline) return null;
      return { id, ...sc, ...sc.estimate(baseline, tariffRate) };
    })
    .filter(Boolean);

  const combined = results.length
    ? {
        monthlySaving: results.reduce((s, r) => s + r.monthlySaving, 0),
        carbonSaving: results.reduce((s, r) => s + r.carbonSaving, 0),
        peakReduction: Math.max(...results.map(r => r.peakReduction || 0)),
      }
    : null;

  function toggleScenario(id) {
    setAppliedScenarios(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  return (
    <>
      {baseline && (
        <>
          <SectionLabel>Building baseline</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            <InfoPill label="Energy Use Intensity" value={`${baseline.eui.toFixed(0)} kWh/m²/yr`} />
            <InfoPill label="Electricity Performance Certificate (EPC) rating" value={baseline.epcRating} valueColor={epcColor(baseline.epcRating)} />
            <InfoPill label="After-hours use" value={`${baseline.afterHoursKwhDay.toFixed(1)} kWh/day`} />
            <InfoPill label="Monthly cost" value={fmtEur(baseline.monthlyCost)} valueColor="#FBBF24" />
          </div>
          <Divider />
        </>
      )}

      {!scenarioGoal ? (
        <>
          <SectionLabel>What's your goal?</SectionLabel>
          {Object.entries(GOAL_LABELS).map(([key, g]) => (
            <GoalCard
              key={key}
              emoji={g.emoji}
              label={g.label}
              onClick={() => setScenarioGoal(key)}
            />
          ))}
        </>
      ) : (
        <>
          <button
            onClick={() => setScenarioGoal(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#60A5FA",
              fontSize: 11,
              padding: "0 0 8px 0",
              fontFamily: UI_FONT,
            }}
          >
            ← Back to goals
          </button>

          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2F1FF", marginBottom: 10 }}>
            {GOAL_LABELS[scenarioGoal]?.emoji} {GOAL_LABELS[scenarioGoal]?.label}
          </div>

          {GOAL_SCENARIOS[scenarioGoal]?.map((id, idx, arr) => {
            const sc = SIMPLE_SCENARIOS[id];
            if (!sc || !baseline) return null;

            const result = sc.estimate(baseline, tariffRate);
            const sev = severity(result.monthlySaving, baseline.monthlyCost);
            const isApplied = appliedScenarios.includes(id);

            return (
              <div key={id}>
                <div
                  style={{
                    background: "rgba(15,23,42,0.85)",
                    border: "1px solid rgba(125,211,252,0.2)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <span style={{ fontSize: 16 }}>{sc.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, color: "#E2F1FF", flex: 1 }}>{sc.label}</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background:
                          sev === "HIGH"
                            ? "rgba(220,38,38,0.2)"
                            : sev === "MED"
                              ? "rgba(251,191,36,0.2)"
                              : "rgba(74,222,128,0.2)",
                        color:
                          sev === "HIGH"
                            ? "#FCA5A5"
                            : sev === "MED"
                              ? "#FDE68A"
                              : "#BBF7D0",
                      }}
                    >
                      {sev}
                    </span>
                  </div>

                  <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 8, lineHeight: 1.5 }}>
                    {sc.description}
                  </div>

                  <div style={{ fontSize: 16, fontWeight: 700, color: result.monthlySaving >= 0 ? "#4ADE80" : "#FBBF24", marginBottom: 4 }}>
                    {result.monthlySaving >= 0 ? "Saves" : "Costs"} ~{fmtEur(result.monthlySaving)}/month
                  </div>

                  <div style={{ fontSize: 10, color: "#CBD5E1", marginBottom: 3 }}>
                    Carbon impact: {result.carbonSaving >= 0 ? "-" : "+"}{Math.abs(result.carbonSaving).toFixed(1)} kg CO₂/month
                  </div>

                  <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 6 }}>
                    Comfort impact: {result.comfortImpact}
                  </div>

                  {result.note && (
                    <div style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic", marginBottom: 6 }}>
                      {result.note}
                    </div>
                  )}

                  <SBtn full active={isApplied} onClick={() => toggleScenario(id)}>
                    {isApplied ? "✓ Applied — click to remove" : "Apply scenario"}
                  </SBtn>
                </div>
                {idx < arr.length - 1 && <Divider />}
              </div>
            );
          })}
        </>
      )}

      {combined && (
        <>
          <Divider />
          <div
            style={{
              background: "rgba(10,18,32,0.9)",
              border: "1px solid rgba(74,222,128,0.3)",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 4 }}>
              {appliedScenarios.length === 1 ? "Your scenario" : `${appliedScenarios.length} scenarios combined`}
            </div>

            <div style={{ fontSize: 28, fontWeight: 700, color: combined.monthlySaving >= 0 ? "#4ADE80" : "#FBBF24" }}>
              {fmtEur(combined.monthlySaving)}
              <span style={{ fontSize: 14, color: "#9AB8D7", fontWeight: 400 }}>/month</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
              <InfoPill label="Annual impact" value={fmtEur(combined.monthlySaving * 12)} />
              <InfoPill label="Carbon" value={`${combined.carbonSaving.toFixed(1)} kg/mo`} />
              <InfoPill label="Peak reduction" value={`${combined.peakReduction}%`} />
              <InfoPill label="Scenarios" value={`${appliedScenarios.length}`} />
            </div>

            <Divider />
            <SBtn full danger onClick={() => setAppliedScenarios([])}>
              × Clear scenarios
            </SBtn>
          </div>
        </>
      )}

      <Divider />
      <SectionLabel>Sensitivity sliders</SectionLabel>

      {[
        {
          label: `Tariff €${tariffRate.toFixed(2)}/kWh`,
          min: 0.1,
          max: 0.4,
          step: 0.01,
          value: tariffRate,
          onChange: e => setTariffRate(Number(e.target.value)),
          accent: "#60A5FA",
        },
        {
          label: `Occupancy ${occupancyLevel}%`,
          min: 25,
          max: 100,
          step: 5,
          value: occupancyLevel,
          onChange: e => setOccupancyLevel(Number(e.target.value)),
          accent: "#34D399",
        },
        {
          label: `Carbon price €${carbonPrice}/tonne`,
          min: 0,
          max: 100,
          step: 5,
          value: carbonPrice,
          onChange: e => setCarbonPrice(Number(e.target.value)),
          accent: "#F59E0B",
        },
      ].map(s => (
        <div key={s.label} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 4 }}>{s.label}</div>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={s.value}
            onChange={s.onChange}
            style={{ width: "100%", accentColor: s.accent, cursor: "pointer" }}
          />
        </div>
      ))}
    </>
  );
}

function InfoPill({ label, value, valueColor = "#E2F1FF" }) {
  return (
    <div
      style={{
        background: "rgba(15,23,42,0.85)",
        border: "1px solid rgba(125,211,252,0.2)",
        borderRadius: 8,
        padding: 8,
      }}
    >
      <div style={{ fontSize: 10, color: "#9AB8D7", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: valueColor }}>{value}</div>
    </div>
  );
}
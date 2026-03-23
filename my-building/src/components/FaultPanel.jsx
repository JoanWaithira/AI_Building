import { useState } from "react";
import { FAULT_RULES, FAULT_CATEGORY } from "../faultEngine";

const UI_FONT = '"Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif';

function severityColor(s) {
  if (s === "critical") return "#EF4444";
  if (s === "alert")    return "#FBBF24";
  if (s === "warning")  return "#94A3B8";
  return "#475569";
}

function severityIcon(s) {
  if (s === "critical") return "🚨";
  if (s === "alert")    return "⚠️";
  if (s === "warning")  return "⚡";
  return "ℹ";
}

function FaultCard({ fault }) {
  const [expanded, setExpanded] = useState(false);
  const color = severityColor(fault.severity);

  return (
    <div
      style={{
        marginBottom: 8,
        background: "rgba(15,23,42,0.6)",
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        overflow: "hidden",
        fontFamily: UI_FONT,
      }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "7px 10px",
          display: "flex",
          alignItems: "center",
          gap: 7,
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 13, flexShrink: 0 }}>{severityIcon(fault.severity)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#E2E8F0", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {fault.label}
          </div>
          <div style={{ fontSize: 9, color: "#475569", marginTop: 1 }}>
            {fault.data?.circuit ?? fault.data?.room ?? fault.category}
            {fault.data?.deviationPct ? ` · +${fault.data.deviationPct}%` : ""}
            {fault.data?.co2 ? ` · ${Math.round(fault.data.co2)} ppm` : ""}
            {fault.data?.temp ? ` · ${fault.data.temp.toFixed(1)}°C` : ""}
          </div>
        </div>
        {fault.weeklyCost > 0 && (
          <div style={{ fontSize: 9, color: "#FDE68A", flexShrink: 0, textAlign: "right" }}>
            €{fault.weeklyCost.toFixed(1)}<br />
            <span style={{ color: "#475569" }}>/wk</span>
          </div>
        )}
        <span style={{ color: "#334155", fontSize: 10, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 10px 10px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p style={{ fontSize: 10, color: "#94A3B8", margin: "8px 0 6px", lineHeight: 1.5 }}>
            {fault.description}
          </p>
          <div style={{ fontSize: 9, color: "#FBBF24", fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Likely causes
          </div>
          <ul style={{ margin: "0 0 8px", paddingLeft: 14 }}>
            {fault.causes.map((c, i) => (
              <li key={i} style={{ fontSize: 10, color: "#64748B", marginBottom: 2 }}>{c}</li>
            ))}
          </ul>
          <div style={{ fontSize: 9, color: "#4ADE80", fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Recommended actions
          </div>
          <ul style={{ margin: 0, paddingLeft: 14 }}>
            {fault.actions.map((a, i) => (
              <li key={i} style={{ fontSize: 10, color: "#86EFAC", marginBottom: 2 }}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function FaultPanel({
  faults        = [],
  summary       = null,
  faultHistory  = [],
  clearHistory,
  replayFrame   = 0,
  onClose,
}) {
  const [view, setView] = useState("active");

  const PS = {
    background:    "rgba(10,15,26,0.95)",
    border:        "1px solid rgba(125,211,252,0.15)",
    borderRadius:  12,
    backdropFilter:"blur(14px)",
    overflow:      "hidden",
    boxShadow:     "0 8px 32px rgba(0,0,0,0.5)",
    fontFamily:    UI_FONT,
    color:         "#D1E8FF",
    fontSize:      12,
  };

  return (
    <div style={{ ...PS, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 32px)" }}>

      {/* Header */}
      <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#F8FAFC" }}>🔍 Fault Detection</div>
          <div style={{ fontSize: 9, color: "#475569" }}>Frame {replayFrame}/96 · updated every 15 min</div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#475569", fontSize: 16, cursor: "pointer", padding: 4 }}>✕</button>
        )}
      </div>

      {/* Severity summary bar */}
      <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
        {[
          { key: "critical", label: "Critical", color: "#EF4444" },
          { key: "alert",    label: "Alert",    color: "#FBBF24" },
          { key: "warning",  label: "Warning",  color: "#94A3B8" },
          { key: "info",     label: "Info",     color: "#475569" },
        ].map(({ key, label, color }) => {
          const count = summary?.[key] ?? 0;
          return (
            <div key={key} style={{ flex: 1, textAlign: "center", background: count > 0 ? `${color}14` : "rgba(15,23,42,0.5)", borderRadius: 6, padding: "4px 0", border: `1px solid ${count > 0 ? color + "44" : "rgba(255,255,255,0.04)"}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: count > 0 ? color : "#334155" }}>{count}</div>
              <div style={{ fontSize: 8, color: "#475569" }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* Weekly cost banner */}
      {(summary?.totalWeeklyCost ?? 0) > 1 && (
        <div style={{ margin: "6px 12px 0", padding: "6px 10px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 6, fontSize: 10, color: "#FDE68A", flexShrink: 0 }}>
          ⚡ Estimated waste: <strong>€{summary.totalWeeklyCost.toFixed(2)}/week</strong> if faults unresolved
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, padding: "8px 12px 0", flexShrink: 0 }}>
        {[
          { key: "active",  label: "Active"    },
          { key: "history", label: "History"   },
          { key: "rules",   label: "All Rules" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)} style={{ flex: 1, padding: "4px 0", fontSize: 10, borderRadius: 4, border: "1px solid rgba(125,211,252,0.15)", background: view === key ? "rgba(125,211,252,0.12)" : "transparent", color: view === key ? "#7DD3FC" : "#475569", cursor: "pointer", fontFamily: UI_FONT }}>
            {label}
            {key === "active" && (summary?.total ?? 0) > 0 && (
              <span style={{ marginLeft: 4, background: "#EF4444", color: "#fff", borderRadius: 8, padding: "0 4px", fontSize: 8 }}>
                {summary.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px 16px" }}>

        {/* ── ACTIVE ── */}
        {view === "active" && (
          faults.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#4ADE80", fontSize: 12 }}>
              <div style={{ fontSize: 28 }}>✓</div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>No active faults</div>
              <div style={{ fontSize: 10, color: "#334155", marginTop: 4 }}>
                {replayFrame < 3 ? "Load more replay data to enable detection" : "All systems operating normally"}
              </div>
            </div>
          ) : (
            faults.map((fault, fi) => <FaultCard key={fault.id + fi} fault={fault} />)
          )
        )}

        {/* ── HISTORY ── */}
        {view === "history" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: "#475569" }}>{faultHistory.length} events recorded</span>
              <button onClick={clearHistory} style={{ fontSize: 9, color: "#475569", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontFamily: UI_FONT }}>
                Clear
              </button>
            </div>
            {faultHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#334155", fontSize: 11 }}>
                No fault history yet.<br />Play the replay to accumulate data.
              </div>
            ) : (
              [...faultHistory].reverse().map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 10 }}>
                  <span style={{ color: severityColor(f.severity), flexShrink: 0, width: 12 }}>{severityIcon(f.severity)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#CBD5E1", fontWeight: 500 }}>{f.label}</div>
                    <div style={{ color: "#475569" }}>Frame {f.frameIdx} · {f.data?.circuit ?? f.data?.room ?? ""}</div>
                  </div>
                  <div style={{ color: "#334155", fontSize: 9, flexShrink: 0 }}>{f.hour}:00</div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── ALL RULES ── */}
        {view === "rules" && (
          <>
            <div style={{ fontSize: 9, color: "#334155", marginBottom: 8 }}>
              {FAULT_RULES.length} rules active · monitoring all circuits
            </div>
            {Object.values(FAULT_CATEGORY).map((cat) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 2 }}>
                  {cat}
                </div>
                {FAULT_RULES.filter((r) => r.category === cat).map((r) => {
                  const isActive = faults.some((f) => f.id === r.id);
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                      <span style={{ fontSize: 9, color: isActive ? severityColor(r.severity) : "#1E293B", flexShrink: 0 }}>
                        {isActive ? severityIcon(r.severity) : "○"}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: isActive ? "#E2E8F0" : "#334155", fontWeight: isActive ? 600 : 400 }}>{r.label}</div>
                      </div>
                      <span style={{ fontSize: 8, color: isActive ? severityColor(r.severity) : "#1E293B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {isActive ? r.severity : "ok"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

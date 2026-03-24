// ─── RoleDashboard_IT.jsx ──────────────────────────────────────────────────────
// IT / Technical role dashboard with circuit deep-dive analytics,
// history range picker, and cross-circuit comparison.

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  FONT, CIRCUIT_COLORS, CIRCUIT_LABELS,
  computeBaseline, circuitStats, fmtW, dispatchCmd, buildCircuitHistoryRows, buildCircuitHistoryMap,
} from "./roleHelpers.js";
import { Btn, SL, Pill, EmptyState, Hr } from "./panelUI.jsx";

import {
  Chart as ChartJS,
  LineElement, BarElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { buildApiUrl, POWER_API_BASE } from "../config/api.js";

ChartJS.register(
  LineElement, BarElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
);

// ── API ────────────────────────────────────────────────────────────────────────

async function fetchApi(path, params = {}) {
  const url = new URL(buildApiUrl(POWER_API_BASE, path), window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") url.searchParams.append(k, v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: "24 h",  value: 1  },
  { label: "48 h",  value: 2  },
  { label: "7 d",   value: 7  },
  { label: "30 d",  value: 30 },
  { label: "90 d",  value: 90 },
];

function getSeason(d) {
  const m = d.getMonth() + 1;
  if ([12, 1, 2].includes(m)) return "Winter";
  if ([3, 4, 5].includes(m)) return "Spring";
  if ([6, 7, 8].includes(m)) return "Summer";
  return "Autumn";
}

/** Map front-end circuit id → DB circuit_id */
function dbCircuitId(id) { return id === "3DLED" ? "x3dled" : id; }

function dateFmt(iso) {
  const d = new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

/** Hex color → rgba string */
function hexToRgba(hex, alpha) {
  const h = hex.replace("#","");
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Compact chart theme matching the dark panel
const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(10,18,32,0.95)",
      titleColor: "#94A3B8",
      bodyColor: "#E2F1FF",
      borderColor: "rgba(96,165,250,0.3)",
      borderWidth: 1,
      padding: 8,
      titleFont: { size: 10 },
      bodyFont: { size: 11 },
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(96,165,250,0.06)" },
      ticks: { color: "#64748B", font: { size: 9 }, maxTicksLimit: 8 },
      border: { color: "rgba(96,165,250,0.15)" },
    },
    y: {
      grid: { color: "rgba(96,165,250,0.06)" },
      ticks: { color: "#64748B", font: { size: 9 }, maxTicksLimit: 6 },
      border: { color: "rgba(96,165,250,0.15)" },
      beginAtZero: true,
    },
  },
};

function chartLine(labels, data, color, label) {
  return {
    labels,
    datasets: [{
      label,
      data,
      borderColor: color,
      backgroundColor: hexToRgba(color, 0.12),
      borderWidth: 1.5,
      tension: 0.35,
      fill: true,
      pointRadius: 0,
      pointHitRadius: 6,
    }],
  };
}

function chartBar(labels, data, color, label) {
  return {
    labels,
    datasets: [{
      label,
      data,
      backgroundColor: hexToRgba(color, 0.45),
      borderColor: color,
      borderWidth: 1,
      borderRadius: 3,
      maxBarThickness: 18,
    }],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. CIRCUIT LIST (overview) ────────────────────────────────────────────────

function CircuitListView({ replayData, onSelect, onCompare }) {
  const [sortKey, setSortKey] = useState("current");
  const [sortAsc, setSortAsc]  = useState(false);
  const baseline = computeBaseline(replayData, 0.22);

  const circuitIds = Object.keys(CIRCUIT_COLORS);
  let rows = circuitIds.map(id => ({
    id, label: CIRCUIT_LABELS[id] || id, color: CIRCUIT_COLORS[id],
    ...circuitStats(replayData, id),
  }));
  rows = rows.sort((a, b) => (a[sortKey] - b[sortKey]) * (sortAsc ? 1 : -1));

  const SortHdr = ({ k, children }) => (
    <th onClick={() => { if (sortKey===k) setSortAsc(p=>!p); else { setSortKey(k); setSortAsc(false); }}}
      style={{ cursor:"pointer", padding:"4px 6px", textAlign:"left", fontSize:9, fontWeight:700, color: sortKey===k ? "#60A5FA":"#64748B", whiteSpace:"nowrap" }}>
      {children}{sortKey===k?(sortAsc?"↑":"↓"):""}
    </th>
  );

  const profileIds = ["main","circuit8","circuit9","circuit10","airconditioner1"];

  return (
    <>
      <SL>Technical KPIs</SL>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
        <Pill label="Peak demand" value={fmtW(baseline?.peakW||0)} sub="48h window" color="#F87171"/>
        <Pill label="Load factor" value={baseline?.loadFactor.toFixed(2)||"—"} sub="avg/peak ratio" color="#60A5FA"/>
        <Pill label="Peak factor" value={baseline?.peakFactor.toFixed(2)||"—"} sub={baseline?.peakFactor > 1.6 ? "⚠ High" : "Normal"} color={baseline?.peakFactor > 1.6 ? "#EF4444":"#4ADE80"}/>
        <Pill label="Server room" value={fmtW(circuitStats(replayData,"circuit8").current)} sub="current watts" color="#34D399"/>
      </div>

      <SL>Load profile — key circuits</SL>
      <div style={{ marginBottom:6 }}>
        <svg width="100%" viewBox="0 0 264 64" style={{ display:"block", borderRadius:4, background:"rgba(10,15,26,0.7)", border:"1px solid rgba(96,165,250,0.08)" }}>
          {profileIds.map(id => {
            const frames = replayData[id] || [];
            if (frames.length < 2) return null;
            const peakAll = Math.max(...(replayData["main"]||[]).map(f=>f.watts), 1);
            const pts = frames.map((f,i) => {
              const x = (i/(frames.length-1))*264;
              const y = 62 - (f.watts/peakAll)*58;
              return `${x},${y}`;
            }).join(" ");
            return <polyline key={id} points={pts} fill="none" stroke={CIRCUIT_COLORS[id]||"#888"} strokeWidth="1.2" strokeLinejoin="round" opacity="0.85"/>;
          })}
        </svg>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:4 }}>
          {profileIds.map(id => (
            <div key={id} style={{ display:"flex", alignItems:"center", gap:3, fontSize:8, color:"#9AB8D7" }}>
              <div style={{ width:10, height:2, background:CIRCUIT_COLORS[id]||"#888", borderRadius:1 }}/>
              {CIRCUIT_LABELS[id]||id}
            </div>
          ))}
        </div>
      </div>

      <SL>All circuits — click to inspect</SL>
      <div style={{ overflowX:"auto", marginBottom:8 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, fontFamily:FONT }}>
          <thead>
            <tr style={{ borderBottom:"1px solid rgba(125,211,252,0.15)" }}>
              <th style={{ padding:"4px 6px", textAlign:"left", fontSize:9, color:"#64748B" }}>Circuit</th>
              <SortHdr k="current">Now</SortHdr>
              <SortHdr k="peak">Peak</SortHdr>
              <SortHdr k="avg">Avg</SortHdr>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const loadPct = r.peak > 0 ? r.current/r.peak : 0;
              const rowBg = loadPct > 0.9 ? "rgba(239,68,68,0.08)" : loadPct > 0.75 ? "rgba(251,191,36,0.06)" : "transparent";
              return (
                <tr key={r.id}
                  onClick={() => { dispatchCmd("zoom_to_circuit", { circuit_id: r.id }); onSelect(r.id); }}
                  style={{ background:rowBg, borderBottom:"1px solid rgba(255,255,255,0.03)", cursor:"pointer", transition:"background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.1)"}
                  onMouseLeave={e => e.currentTarget.style.background = rowBg}
                >
                  <td style={{ padding:"3px 6px", color:r.color, fontWeight:700, fontSize:10 }}>
                    {r.label.slice(0,14)} →
                  </td>
                  <td style={{ padding:"3px 6px", color:"#E2F1FF", fontSize:10 }}>{fmtW(r.current)}</td>
                  <td style={{ padding:"3px 6px", color:"#9AB8D7", fontSize:10 }}>{fmtW(r.peak)}</td>
                  <td style={{ padding:"3px 6px", color:"#9AB8D7", fontSize:10 }}>{fmtW(r.avg)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
        <Btn onClick={onCompare} accent>⚖ Compare</Btn>
        <Btn onClick={() => dispatchCmd("show_energy_flow")}>⚡ Energy flow</Btn>
      </div>
    </>
  );
}

// ── 2. SINGLE CIRCUIT DETAIL ──────────────────────────────────────────────────

function CircuitDetailView({ circuitId, replayData, onBack }) {
  const [rangeDays, setRangeDays] = useState(7);
  const [raw, setRaw]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const color = CIRCUIT_COLORS[circuitId] || "#60A5FA";
  const label = CIRCUIT_LABELS[circuitId] || circuitId;

  // Zoom camera to circuit on mount
  useEffect(() => { dispatchCmd("zoom_to_circuit", { circuit_id: circuitId }); }, [circuitId]);

  // Fetch from PostgREST
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const latest = await fetchApi("power_5min", {
          select: "ts_5min",
          order: "ts_5min.desc",
          limit: 1,
        });
        if (cancelled) return;
        if (!latest?.length) {
          setRaw(buildCircuitHistoryRows(circuitId, rangeDays, replayData));
          setLoading(false);
          return;
        }

        const to = new Date(latest[0].ts_5min);
        const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);

        const data = await fetchApi("power_5min", {
          select: "ts_5min,value,circuit_id",
          circuit_id: `eq.${dbCircuitId(circuitId)}`,
          and: `(ts_5min.gte.${from.toISOString()},ts_5min.lte.${to.toISOString()})`,
          order: "ts_5min.asc",
          limit: 100000,
        });
        if (cancelled) return;
        const normalized = Array.isArray(data) ? data : [];
        setRaw(normalized.length ? normalized : buildCircuitHistoryRows(circuitId, rangeDays, replayData));
      } catch (e) {
        if (!cancelled) {
          setRaw(buildCircuitHistoryRows(circuitId, rangeDays, replayData));
          setError(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [circuitId, rangeDays, replayData]);

  // ── Compute aggregations ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!raw.length) return null;

    const vals = raw.map(r => r.value ?? 0);
    const currentVal  = vals[vals.length - 1];
    const peakVal     = Math.max(...vals);
    const avgVal      = vals.reduce((a, b) => a + b, 0) / vals.length;

    // Timeseries — subsample for chart perf (max ~200 points)
    const step = Math.max(1, Math.floor(raw.length / 200));
    const tsLabels = [];
    const tsData   = [];
    for (let i = 0; i < raw.length; i += step) {
      tsLabels.push(dateFmt(raw[i].ts_5min));
      tsData.push(raw[i].value ?? 0);
    }

    // Hourly profile
    const hourMap = new Map();
    raw.forEach(r => {
      const h = new Date(r.ts_5min).getHours();
      const prev = hourMap.get(h) || { sum: 0, count: 0 };
      prev.sum += r.value ?? 0;
      prev.count++;
      hourMap.set(h, prev);
    });
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const entry = hourMap.get(h);
      return { hour: h, avg: entry ? entry.sum / entry.count : 0 };
    });

    // Daily totals
    const dayMap = new Map();
    raw.forEach(r => {
      const dayKey = r.ts_5min.slice(0, 10);
      dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + (r.value ?? 0));
    });
    const daily = [...dayMap.entries()].sort(([a],[b]) => a.localeCompare(b))
      .map(([day, total]) => ({ day, total }));

    // Weekday vs Weekend (average daily total)
    let wdSum = 0, wdCount = 0, weSum = 0, weCount = 0;
    daily.forEach(d => {
      const dow = new Date(d.day).getDay();
      if (dow === 0 || dow === 6) { weSum += d.total; weCount++; }
      else { wdSum += d.total; wdCount++; }
    });

    // Working vs non-working hours (average load)
    let workSum = 0, workN = 0, offSum = 0, offN = 0;
    raw.forEach(r => {
      const dt = new Date(r.ts_5min);
      const dow = dt.getDay();
      const h = dt.getHours();
      const val = r.value ?? 0;
      if (dow >= 1 && dow <= 5 && h >= 8 && h <= 17) { workSum += val; workN++; }
      else { offSum += val; offN++; }
    });

    // Seasonal totals
    const seasonMap = new Map();
    raw.forEach(r => {
      const s = getSeason(new Date(r.ts_5min));
      seasonMap.set(s, (seasonMap.get(s) || 0) + (r.value ?? 0));
    });
    const seasons = ["Winter","Spring","Summer","Autumn"].filter(s => seasonMap.has(s))
      .map(s => ({ season: s, total: seasonMap.get(s) }));

    // Peak demand (top 5)
    const peaks = [...raw]
      .filter(r => typeof r.value === "number")
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(r => ({ ts: r.ts_5min, value: r.value }));

    return {
      currentVal, peakVal, avgVal,
      tsLabels, tsData,
      hourly, daily,
      weekdayAvg: wdCount ? wdSum / wdCount : 0,
      weekendAvg: weCount ? weSum / weCount : 0,
      wdCount, weCount,
      workAvg: workN ? workSum / workN : 0,
      offAvg: offN ? offSum / offN : 0,
      seasons, peaks,
      totalRecords: raw.length,
    };
  }, [raw]);

  // Circuit selected — no camera change, keep same building view

  return (
    <>
      {/* Back button + header */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
        <button onClick={onBack} style={{
          background:"none", border:"none", cursor:"pointer",
          color:"#64748B", fontSize:14, fontFamily:FONT, padding:"2px 4px",
        }}>←</button>
        <span style={{ fontSize:13, fontWeight:700, color, fontFamily:FONT }}>{label}</span>
      </div>

      {/* Range selector */}
      <div style={{ display:"flex", gap:4, marginBottom:10, flexWrap:"wrap" }}>
        {RANGE_OPTIONS.map(r => (
          <Btn key={r.value}
            onClick={() => setRangeDays(r.value)}
            active={rangeDays === r.value}
            small
          >{r.label}</Btn>
        ))}
      </div>

      {loading && <EmptyState msg="Loading circuit data…"/>}
      {error && <EmptyState msg={`Error: ${error}`}/>}
      {!loading && !error && !stats && <EmptyState msg="No data for this circuit"/>}

      {stats && (
        <>
          {/* KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
            <Pill label="Current" value={fmtW(stats.currentVal)} color={color}/>
            <Pill label="Peak" value={fmtW(stats.peakVal)} sub={`${rangeDays}d window`} color="#F87171"/>
            <Pill label="Average" value={fmtW(stats.avgVal)} color="#94A3B8"/>
            <Pill label="Records" value={stats.totalRecords.toLocaleString()} sub="data points" color="#64748B"/>
          </div>

          {/* Timeseries trend */}
          <SL>Power trend</SL>
          <div style={{ height:100, marginBottom:10 }}>
            <Line
              data={chartLine(stats.tsLabels, stats.tsData, color, "Power (W)")}
              options={{
                ...CHART_OPTS,
                scales: {
                  ...CHART_OPTS.scales,
                  x: { ...CHART_OPTS.scales.x, ticks: { ...CHART_OPTS.scales.x.ticks, maxTicksLimit: 5 } },
                },
              }}
            />
          </div>

          {/* Daily totals */}
          {stats.daily.length > 1 && (
            <>
              <SL>Daily energy</SL>
              <div style={{ height:90, marginBottom:10 }}>
                <Line
                  data={chartLine(
                    stats.daily.map(d => d.day.slice(5)),
                    stats.daily.map(d => d.total),
                    "#2563EB", "Daily energy (Wh)"
                  )}
                  options={{
                    ...CHART_OPTS,
                    scales: {
                      ...CHART_OPTS.scales,
                      x: { ...CHART_OPTS.scales.x, ticks: { ...CHART_OPTS.scales.x.ticks, maxTicksLimit: 7 } },
                    },
                  }}
                />
              </div>
            </>
          )}

          {/* Hourly profile */}
          <SL>Hourly profile (avg)</SL>
          <div style={{ height:80, marginBottom:10 }}>
            <Bar
              data={chartBar(
                stats.hourly.map(h => `${h.hour}h`),
                stats.hourly.map(h => h.avg),
                color, "Avg power (W)"
              )}
              options={CHART_OPTS}
            />
          </div>

          {/* Typical day curve */}
          <SL>Typical day curve</SL>
          <div style={{ height:80, marginBottom:10 }}>
            <Line
              data={chartLine(
                stats.hourly.map(h => `${h.hour}:00`),
                stats.hourly.map(h => h.avg),
                "#10B981", "Typical load (W)"
              )}
              options={CHART_OPTS}
            />
          </div>

          {/* Weekday vs Weekend */}
          <SL>Weekday vs Weekend</SL>
          <div style={{ height:70, marginBottom:10 }}>
            <Bar
              data={{
                labels: [`Weekday (${stats.wdCount}d)`, `Weekend (${stats.weCount}d)`],
                datasets: [{
                  data: [stats.weekdayAvg, stats.weekendAvg],
                  backgroundColor: ["rgba(34,197,94,0.45)", "rgba(168,85,247,0.45)"],
                  borderColor: ["#22C55E", "#A855F7"],
                  borderWidth: 1, borderRadius: 3, maxBarThickness: 32,
                }],
              }}
              options={CHART_OPTS}
            />
          </div>

          {/* Working vs Non-working */}
          <SL>Working vs off-hours</SL>
          <div style={{ height:70, marginBottom:10 }}>
            <Bar
              data={{
                labels: ["Working (Mon-Fri 8-17)", "Off-hours"],
                datasets: [{
                  data: [stats.workAvg, stats.offAvg],
                  backgroundColor: ["rgba(96,165,250,0.45)", "rgba(234,88,12,0.45)"],
                  borderColor: ["#60A5FA", "#EA580C"],
                  borderWidth: 1, borderRadius: 3, maxBarThickness: 32,
                }],
              }}
              options={CHART_OPTS}
            />
          </div>

          {/* Seasonal comparison */}
          {stats.seasons.length > 1 && (
            <>
              <SL>Seasonal comparison</SL>
              <div style={{ height:70, marginBottom:10 }}>
                <Bar
                  data={chartBar(
                    stats.seasons.map(s => s.season),
                    stats.seasons.map(s => s.total),
                    "#3B82F6", "Total energy (Wh)"
                  )}
                  options={CHART_OPTS}
                />
              </div>
            </>
          )}

          {/* Peak demand top 5 */}
          <SL>Peak demand (top 5)</SL>
          <div style={{ marginBottom:10 }}>
            {stats.peaks.map((p, i) => (
              <div key={i} style={{
                display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"3px 0", borderBottom:"1px solid rgba(255,255,255,0.04)",
                fontSize:10, fontFamily:FONT,
              }}>
                <span style={{ color:"#64748B" }}>#{i+1}</span>
                <span style={{ color:"#E2F1FF", fontWeight:600 }}>{fmtW(p.value)}</span>
                <span style={{ color:"#475569", fontSize:9 }}>{dateFmt(p.ts)}</span>
              </div>
            ))}
          </div>

          <Hr/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:5 }}>
            <Btn onClick={() => dispatchCmd("show_energy_flow")} accent>⚡ Energy flow</Btn>
          </div>
        </>
      )}
    </>
  );
}


// ── 3. COMPARE MODE ───────────────────────────────────────────────────────────

function CompareView({ replayData, onBack }) {
  const allIds = Object.keys(CIRCUIT_COLORS);
  const [selected, setSelected] = useState(() => new Set(["main","circuit8","circuit9"]));
  const [rangeDays, setRangeDays] = useState(7);
  const [dataMap, setDataMap] = useState({});
  const [loading, setLoading] = useState(false);

  const toggle = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Fetch data for all selected circuits
  useEffect(() => {
    if (!selected.size) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const latest = await fetchApi("power_5min", {
          select: "ts_5min",
          order: "ts_5min.desc",
          limit: 1,
        });
        if (cancelled) return;
        if (!latest?.length) {
          setDataMap(buildCircuitHistoryMap([...selected], rangeDays, replayData));
          setLoading(false);
          return;
        }

        const to = new Date(latest[0].ts_5min);
        const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);

        const ids = [...selected].map(dbCircuitId);
        const data = await fetchApi("power_5min", {
          select: "ts_5min,value,circuit_id",
          circuit_id: `in.(${ids.join(",")})`,
          and: `(ts_5min.gte.${from.toISOString()},ts_5min.lte.${to.toISOString()})`,
          order: "ts_5min.asc",
          limit: 100000,
        });
        if (cancelled) return;

        // Group by circuit
        const grouped = {};
        (data || []).forEach(r => {
          let fid = r.circuit_id;
          if (fid === "x3dled") fid = "3DLED";
          if (!grouped[fid]) grouped[fid] = [];
          grouped[fid].push(r);
        });
        const fallbackMap = buildCircuitHistoryMap([...selected], rangeDays, replayData);
        setDataMap({ ...fallbackMap, ...grouped });
      } catch (e) {
        console.warn("Compare fetch error:", e);
        if (!cancelled) setDataMap(buildCircuitHistoryMap([...selected], rangeDays, replayData));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selected, rangeDays, replayData]);

  // ── Build comparison charts ─────────────────────────────────────────────────
  const { overlayCfg, totalBarCfg, weekdayCfg } = useMemo(() => {
    const selArr = [...selected];

    // Overlay timeseries — subsample each circuit
    const overlayDatasets = selArr.map(id => {
      const records = dataMap[id] || [];
      const step = Math.max(1, Math.floor(records.length / 150));
      const pts = [];
      const labels = [];
      for (let i = 0; i < records.length; i += step) {
        labels.push(dateFmt(records[i].ts_5min));
        pts.push(records[i].value ?? 0);
      }
      return { id, labels, pts };
    });

    const longestLabels = overlayDatasets.reduce((a, b) => b.labels.length > a.length ? b.labels : a, []);

    const overlayCfg = {
      labels: longestLabels,
      datasets: overlayDatasets.map(d => ({
        label: CIRCUIT_LABELS[d.id] || d.id,
        data: d.pts,
        borderColor: CIRCUIT_COLORS[d.id] || "#888",
        borderWidth: 1.5,
        tension: 0.35,
        fill: false,
        pointRadius: 0,
        pointHitRadius: 4,
      })),
    };

    // Total energy per circuit
    const totalBarCfg = {
      labels: selArr.map(id => (CIRCUIT_LABELS[id] || id).slice(0, 10)),
      datasets: [{
        data: selArr.map(id => {
          const records = dataMap[id] || [];
          return records.reduce((s, r) => s + (r.value ?? 0), 0);
        }),
        backgroundColor: selArr.map(id => hexToRgba(CIRCUIT_COLORS[id] || "#888", 0.45)),
        borderColor: selArr.map(id => CIRCUIT_COLORS[id] || "#888"),
        borderWidth: 1,
        borderRadius: 3,
        maxBarThickness: 24,
      }],
    };

    // Weekday vs Weekend per circuit
    const wdweData = selArr.map(id => {
      const records = dataMap[id] || [];
      const dayMap = new Map();
      records.forEach(r => {
        const dk = r.ts_5min.slice(0, 10);
        dayMap.set(dk, (dayMap.get(dk) || 0) + (r.value ?? 0));
      });
      let wdS = 0, wdN = 0, weS = 0, weN = 0;
      dayMap.forEach((total, dk) => {
        const dow = new Date(dk).getDay();
        if (dow === 0 || dow === 6) { weS += total; weN++; }
        else { wdS += total; wdN++; }
      });
      return {
        id,
        weekdayAvg: wdN ? wdS / wdN : 0,
        weekendAvg: weN ? weS / weN : 0,
      };
    });

    const weekdayCfg = {
      labels: selArr.map(id => (CIRCUIT_LABELS[id]||id).slice(0, 8)),
      datasets: [
        {
          label: "Weekday avg",
          data: wdweData.map(d => d.weekdayAvg),
          backgroundColor: "rgba(34,197,94,0.4)",
          borderColor: "#22C55E",
          borderWidth: 1, borderRadius: 2, maxBarThickness: 18,
        },
        {
          label: "Weekend avg",
          data: wdweData.map(d => d.weekendAvg),
          backgroundColor: "rgba(168,85,247,0.4)",
          borderColor: "#A855F7",
          borderWidth: 1, borderRadius: 2, maxBarThickness: 18,
        },
      ],
    };

    return { overlayCfg, totalBarCfg, weekdayCfg };
  }, [selected, dataMap]);

  return (
    <>
      {/* Back + header */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
        <button onClick={onBack} style={{
          background:"none", border:"none", cursor:"pointer",
          color:"#64748B", fontSize:14, fontFamily:FONT, padding:"2px 4px",
        }}>←</button>
        <span style={{ fontSize:13, fontWeight:700, color:"#A5B4FC", fontFamily:FONT }}>Compare circuits</span>
      </div>

      {/* Range */}
      <div style={{ display:"flex", gap:4, marginBottom:8, flexWrap:"wrap" }}>
        {RANGE_OPTIONS.map(r => (
          <Btn key={r.value}
            onClick={() => setRangeDays(r.value)}
            active={rangeDays === r.value}
            small
          >{r.label}</Btn>
        ))}
      </div>

      {/* Circuit toggles */}
      <SL>Select circuits</SL>
      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
        {allIds.map(id => {
          const on = selected.has(id);
          return (
            <button key={id}
              onClick={() => toggle(id)}
              style={{
                fontSize:9, fontWeight:600, fontFamily:FONT,
                padding:"3px 6px", borderRadius:4, cursor:"pointer",
                border: on ? `1px solid ${CIRCUIT_COLORS[id]}` : "1px solid rgba(255,255,255,0.1)",
                background: on ? hexToRgba(CIRCUIT_COLORS[id], 0.15) : "rgba(255,255,255,0.04)",
                color: on ? CIRCUIT_COLORS[id] : "#64748B",
                transition: "all 0.15s",
              }}
            >
              {(CIRCUIT_LABELS[id]||id).slice(0,10)}
            </button>
          );
        })}
      </div>

      {loading && <EmptyState msg="Loading comparison data…"/>}

      {!loading && selected.size > 0 && (
        <>
          {/* Overlay timeseries */}
          <SL>Power overlay</SL>
          <div style={{ height:110, marginBottom:10 }}>
            <Line
              data={overlayCfg}
              options={{
                ...CHART_OPTS,
                plugins: {
                  ...CHART_OPTS.plugins,
                  legend: {
                    display: true,
                    position: "bottom",
                    labels: { color: "#94A3B8", font: { size: 8 }, boxWidth: 10, padding: 6 },
                  },
                },
                scales: {
                  ...CHART_OPTS.scales,
                  x: { ...CHART_OPTS.scales.x, ticks: { ...CHART_OPTS.scales.x.ticks, maxTicksLimit: 5 } },
                },
              }}
            />
          </div>

          {/* Total energy per circuit */}
          <SL>Total energy</SL>
          <div style={{ height:80, marginBottom:10 }}>
            <Bar
              data={totalBarCfg}
              options={CHART_OPTS}
            />
          </div>

          {/* Weekday vs Weekend grouped */}
          <SL>Weekday vs weekend</SL>
          <div style={{ height:90, marginBottom:10 }}>
            <Bar
              data={weekdayCfg}
              options={{
                ...CHART_OPTS,
                plugins: {
                  ...CHART_OPTS.plugins,
                  legend: {
                    display: true,
                    position: "bottom",
                    labels: { color: "#94A3B8", font: { size: 8 }, boxWidth: 10, padding: 6 },
                  },
                },
              }}
            />
          </div>
        </>
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — orchestrates the three views
// ═══════════════════════════════════════════════════════════════════════════════

export default function ITView({ replayData }) {
  // "list" | { circuit: string } | "compare"
  const [view, setView] = useState("list");

  if (view === "compare") {
    return <CompareView replayData={replayData} onBack={() => setView("list")}/>;
  }

  if (typeof view === "object" && view.circuit) {
    return (
      <CircuitDetailView
        circuitId={view.circuit}
        replayData={replayData}
        onBack={() => setView("list")}
      />
    );
  }

  return (
    <CircuitListView
      replayData={replayData}
      onSelect={(id) => setView({ circuit: id })}
      onCompare={() => setView("compare")}
    />
  );
}

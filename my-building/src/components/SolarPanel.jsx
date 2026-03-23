import { useState, useCallback, useEffect } from "react";

// ─── PV / Battery system constants ────────────────────────────────────────────

// These constants define the characteristics of the solar panel and battery system, as well as the feed-in tariff and carbon factor for calculations. They are used throughout the component to compute metrics and render visualizations based on the PV data.
// INSTALLED_PV_KWP: The total installed capacity of the photovoltaic system in kilowatt-peak (kWp). This represents the maximum power output of the solar panels under standard test conditions.
const INSTALLED_PV_KWP     = 30;
// BATTERY_CAPACITY_KWH: The total energy storage capacity of the battery in kilowatt-hours (kWh).

const BATTERY_CAPACITY_KWH = 50;
// BATTERY_EFFICIENCY: The round-trip efficiency of the battery, representing the percentage of energy that can be retrieved compared to what was stored. A value of 0.92 means that 92% of the energy put into the battery can be used later.
const BATTERY_EFFICIENCY   = 0.92;
// FEED_IN_TARIFF: The rate at which excess solar energy is sold back to the grid, in currency units per kilowatt-hour (kWh).
const FEED_IN_TARIFF       = 0.08;
// PV_CARBON_FACTOR: The carbon emission factor for the photovoltaic system, in kilograms of CO2 per kilowatt-hour (kg CO2/kWh).
const PV_CARBON_FACTOR     = 0.233;

const PV_ENDPOINTS = [
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_totalpvinputpower_tnd",                    label: "PV Total Input Power",          unit: "kW",  type: "POWER"         },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_pv1inputpower_tnd",                        label: "PV1 Input Power",               unit: "kW",  type: "POWER"         },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_pv2inputpower_tnd",                        label: "PV2 Input Power",               unit: "kW",  type: "POWER"         },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_pv1_voltage_tnd",                          label: "PV1 Voltage",                   unit: "V",   type: "VOLTAGE"       },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_pv2_voltage_tnd",                          label: "PV2 Voltage",                   unit: "V",   type: "VOLTAGE"       },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_battery_p_tnd",                            label: "Battery Power",                 unit: "kW",  type: "POWER"         },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_soc_tnd",                                  label: "Battery SOC",                   unit: "%",   type: "STATE"         },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_bmspacktemperature_tnd",                   label: "BMS Pack Temp",                 unit: "°C",  type: "TEMP"          },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_backup_a_p_tnd",                           label: "Backup A Power",                unit: "kW",  type: "POWER"         },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_backup_b_p_tnd",                           label: "Backup B Power",                unit: "kW",  type: "POWER"         },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_backup_c_p_tnd",                           label: "Backup C Power",                unit: "kW",  type: "POWER"         },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_pmeterofthreephases_tnd",                  label: "3-Phase Power Meter",           unit: "kW",  type: "POWER"         },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_dailypvgeneration_tnd",                    label: "Daily PV Generation",           unit: "kWh", type: "DAILY_ENERGY"  },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_dailyloadconsumption_tnd",                 label: "Daily Load Consumption",        unit: "kWh", type: "DAILY_ENERGY"  },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_dailypurchasedenergy_tnd",                 label: "Daily Purchased Energy",        unit: "kWh", type: "DAILY_ENERGY"  },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_energytoday_tnd",                          label: "Energy Today",                  unit: "kWh", type: "DAILY_ENERGY"  },
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_totalgridinjectionenergyonmeter_tnd",      label: "Total Grid Injection (Export)", unit: "kWh", type: "ENERGY_COUNTER"},
  { endpoint: "gate_fn1a1_n1__gate_m11_e101_totalpurchasingenergyfromgridonmeter_tnd", label: "Total Grid Purchasing (Import)",unit: "kWh", type: "ENERGY_COUNTER"},
];

const OVERVIEW_ENDPOINTS = {
  pvPower:        "gate_fn1a1_n1__gate_m11_e101_totalpvinputpower_tnd",
  batteryPower:   "gate_fn1a1_n1__gate_m11_e101_battery_p_tnd",
  dailyPv:        "gate_fn1a1_n1__gate_m11_e101_dailypvgeneration_tnd",
  dailyLoad:      "gate_fn1a1_n1__gate_m11_e101_dailyloadconsumption_tnd",
  dailyPurchased: "gate_fn1a1_n1__gate_m11_e101_dailypurchasedenergy_tnd",
  gridExport:     "gate_fn1a1_n1__gate_m11_e101_totalgridinjectionenergyonmeter_tnd",
  gridImport:     "gate_fn1a1_n1__gate_m11_e101_totalpurchasingenergyfromgridonmeter_tnd",
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function fmtTime(timestampMs) {
  //Turns timestamp in milliseconds into a "HH:MM" format string. If the timestamp is not a finite number, it returns "--:--". Otherwise, it creates a Date object from the timestamp and formats the hours and minutes with leading zeros if necessary.
  if (!Number.isFinite(timestampMs)) return "--:--";
  const d = new Date(timestampMs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function generateSyntheticPVData(mainReplayFrames) {
  // Generates synthetic photovoltaic (PV) data for a 24-hour period divided into 15-minute intervals (96 frames). The data includes PV power, battery power, state of charge (SOC), and grid power. It uses simple heuristics based on the time of day and random noise to simulate realistic variations in solar generation and building load.
  //  The function returns an object containing time series for various metrics, which can be used for testing or as fallback data when real PV data is unavailable.
  const frames = Array.from({ length: 96 }, (_, i) => {
    const hour    = i / 4;
    const dayHour = hour % 24;
    const solarAngle  = Math.max(0, Math.sin(((dayHour - 6) / 12) * Math.PI));
    const noise       = 0.85 + Math.random() * 0.3;
    const pvKw        = dayHour >= 6 && dayHour <= 20 ? INSTALLED_PV_KWP * solarAngle * 0.19 * noise : 0;
    const buildingLoadKw = ((mainReplayFrames && mainReplayFrames[i]?.watts) ?? 15000) / 1000;
    const surplus     = pvKw - buildingLoadKw;
    const batteryKw   = dayHour >= 10 && dayHour <= 14
      ? Math.min(surplus, 5)
      : dayHour >= 17 && dayHour <= 21 ? -Math.min(3, BATTERY_CAPACITY_KWH * 0.2) : 0;
    const socPct      = Math.max(10, Math.min(95,
      50 + (dayHour >= 10 ? Math.min(45, surplus * 3) : 0) - (dayHour >= 17 ? (dayHour - 17) * 8 : 0)));
    const gridKw      = Math.max(0, buildingLoadKw - pvKw - Math.max(0, -batteryKw));
    const ts          = Date.now() - (48 - hour) * 3600 * 1000;
    return { timestampMs: ts, time: fmtTime(ts), hour: dayHour, pvKw, batteryKw, socPct, gridKw };
  });
  const mkSeries = (fn) => frames.map((f, i) => ({
    timestampMs: f.timestampMs, time: f.time, hour: f.hour, value: fn(f, i),
  }));
  return {
    pvTotal:         mkSeries(f => f.pvKw),
    pvBattery:       mkSeries(f => f.batteryKw),
    soc:             mkSeries(f => f.socPct),
    pv1Power:        mkSeries(f => f.pvKw * 0.55),
    pv2Power:        mkSeries(f => f.pvKw * 0.45),
    dailyPv:         mkSeries(f => f.pvKw * 0.25),
    dailyLoad:       mkSeries(f => (f.pvKw + f.gridKw) * 0.25),
    dailyPurchased:  mkSeries(f => f.gridKw * 0.25),
    gridExport:      mkSeries(f => Math.max(0, f.pvKw - Math.max(0, f.batteryKw) - (frames[Math.min(f.hour * 4 | 0, 95)]?.gridKw ?? 0)) * 0.25),
    gridImport:      mkSeries(f => f.gridKw * 0.25),
    bmsTemp:         mkSeries(f => 25 + f.pvKw * 0.3),
    backupA:         mkSeries(f => f.pvKw / 3),
    backupB:         mkSeries(f => f.pvKw / 3),
    backupC:         mkSeries(f => f.pvKw / 3),
    threePhaseMeter: mkSeries(f => f.gridKw),
  };
}

function computeSolarMetrics(pvData, replayData, tariff) {
  // Computes various metrics related to the solar panel and battery system based on the provided PV data and replay data.
  // It calculates the latest values for PV power, battery power, state of charge, grid power, and export power.
  // It also computes totals for PV generation, load consumption, grid export/import, self-consumption, and financial benefits.
  //  Additionally, it derives key performance indicators (KPIs) such as self-sufficiency, self-consumption ratio, solar fraction, PV yield, grid independence hours, battery cycles, SOC range, and string balance.
  if (!pvData?.pvTotal?.length) return null;
  const pvSeries   = pvData.pvTotal   || [];
  const batSeries  = pvData.pvBattery || [];
  const socSeries  = pvData.soc       || [];
  const loadSeries = replayData?.main || [];
  const bmsSeries  = pvData.bmsTemp   || [];

  const latest = {
    pvKw:      pvSeries[pvSeries.length - 1]?.value   ?? 0,
    batteryKw: batSeries[batSeries.length - 1]?.value ?? 0,
    socPct:    socSeries[socSeries.length - 1]?.value ?? 0,
    loadKw:    (loadSeries[loadSeries.length - 1]?.watts ?? 0) / 1000,
    bmsTemp:   bmsSeries[bmsSeries.length - 1]?.value ?? 0,
  };
  latest.gridKw      = Math.max(0, latest.loadKw - latest.pvKw - Math.max(0, -latest.batteryKw));
  latest.exportKw    = Math.max(0, latest.pvKw - latest.loadKw - Math.max(0, latest.batteryKw));
  latest.isExporting = latest.exportKw > 0.1;
  latest.solarCovers = latest.pvKw >= latest.loadKw;

  const totalPvKwh        = pvSeries.reduce((s, f) => s + f.value * 0.25, 0);
  const totalLoadKwh      = loadSeries.reduce((s, f) => s + (f.watts / 1000) * 0.25, 0);
  const totalExportKwh    = (pvData.gridExport    || []).reduce((s, f) => s + f.value, 0);
  const totalPurchasedKwh = (pvData.dailyPurchased || []).reduce((s, f) => s + f.value, 0)
                          || Math.max(0, totalLoadKwh - totalPvKwh);
  const totalSelfUsedKwh  = Math.max(0, totalPvKwh - totalExportKwh);

  const selfSufficiency = totalLoadKwh > 0 ? Math.min(100, (totalSelfUsedKwh / totalLoadKwh) * 100) : 0;
  const selfConsumption = totalPvKwh   > 0 ? Math.min(100, (totalSelfUsedKwh / totalPvKwh)   * 100) : 0;
  const solarFraction   = latest.loadKw > 0 ? Math.min(100, (latest.pvKw / latest.loadKw)    * 100) : 0;
  const pvYield         = INSTALLED_PV_KWP > 0 ? (totalPvKwh / 2) / INSTALLED_PV_KWP : 0;

  const selfSufficientFrames  = pvSeries.filter((f, i) => f.value >= (loadSeries[i]?.watts ?? 0) / 1000).length;
  const gridIndependenceHours = selfSufficientFrames * 0.25;

  const socValues    = socSeries.map(f => f.value).filter(Number.isFinite);
  const socMin       = socValues.length ? Math.min(...socValues) : 0;
  const socMax       = socValues.length ? Math.max(...socValues) : 0;
  const batteryCycles = socValues.filter((v, i) => i > 0 && v < socValues[i - 1] - 5).length / 2;

  const pv1Total     = (pvData.pv1Power || []).reduce((s, f) => s + f.value * 0.25, 0);
  const pv2Total     = (pvData.pv2Power || []).reduce((s, f) => s + f.value * 0.25, 0);
  const stringBalance = pv1Total + pv2Total > 0
    ? Math.abs(pv1Total - pv2Total) / ((pv1Total + pv2Total) / 2) * 100 : 0;

  const costAvoided       = totalSelfUsedKwh * tariff;
  const exportRevenue     = totalExportKwh   * FEED_IN_TARIFF;
  const exportOpportunity = totalExportKwh   * (tariff - FEED_IN_TARIFF);
  const carbonAvoided     = totalSelfUsedKwh * PV_CARBON_FACTOR;

  return {
    latest,
    totals:    { pvKwh: totalPvKwh, loadKwh: totalLoadKwh, purchasedKwh: totalPurchasedKwh, selfUsedKwh: totalSelfUsedKwh, exportKwh: totalExportKwh },
    kpis:      { selfSufficiency, selfConsumption, solarFraction, pvYield, gridIndependenceHours, batteryCycles, socMin, socMax, stringBalance, stringAlert: stringBalance > 20 },
    financial: { costAvoided, exportRevenue, exportOpportunity, totalBenefit: costAvoided + exportRevenue },
    carbon:    { carbonAvoided, treesEquivalent: Math.round(carbonAvoided / 22 * 12) },
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SolarPanel — renders the ☀️ Solar tab content inside the replay side-panel.
 *
 * Props:
 *   replayData    — current replayData state from CEsiumGeoJsonViewer
 *   replayDataRef — ref to replayData (used in async callbacks to avoid stale closure)
 *   tariffRate    — electricity tariff in €/kWh
 *   pvDataRef     — shared ref; SolarPanel writes loaded data here so RolePanel can read it
 *   getBuildingJson — async (path, params) => JSON helper from parent
 *   activeRole    — currently selected role (optional)
 */
export default function SolarPanel({ replayData, replayDataRef, tariffRate, pvDataRef, getBuildingJson, activeRole }) {
  const [pvDataLoaded, setPvDataLoaded] = useState(false);
  const [pvLoading,    setPvLoading]    = useState(false);
  const [pvError,      setPvError]      = useState(null);
  const [solarView,    setSolarView]    = useState("overview");
  const [pvDataTick,   setPvDataTick]   = useState(0);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadPVData = useCallback(async () => {
    // Loads photovoltaic and battery data from the server using the provided getBuildingJson function. It checks if the data is already loaded in the pvDataRef to avoid redundant requests.
    // If not loaded, it fetches multiple telemetry series in parallel, processes them into a consistent format, and stores them in pvDataRef. If any error occurs during loading, it generates synthetic PV data as a fallback and sets an error message. Finally, it updates the loading state and triggers a re-render by updating pvDataTick.
    if (pvDataLoaded) return pvDataRef.current;
    setPvLoading(true);
    setPvError(null);
    try {
      const fetchSeries = async (endpointName) => {
        if (!endpointName) return [];
        const rows = await getBuildingJson("telemetry", { endpoint: endpointName, limit: 96, order: "ts.asc" }).catch(() => []);
        return (Array.isArray(rows) ? rows : []).map(r => ({
          timestampMs: new Date(r.ts).getTime(),
          time:        fmtTime(new Date(r.ts).getTime()),
          hour:        new Date(r.ts).getHours() + new Date(r.ts).getMinutes() / 60,
          value:       Number(r.value),
        })).filter(r => Number.isFinite(r.value));
      };

      const [pvTotal, pvBattery, dailyPv, dailyLoad, dailyPurchased, gridExport, gridImport,
             pv1Power, pv2Power, soc, bmsTemp, backupA, backupB, backupC, threePhaseMeter] =
        await Promise.all([
          fetchSeries(OVERVIEW_ENDPOINTS.pvPower),
          fetchSeries(OVERVIEW_ENDPOINTS.batteryPower),
          fetchSeries(OVERVIEW_ENDPOINTS.dailyPv),
          fetchSeries(OVERVIEW_ENDPOINTS.dailyLoad),
          fetchSeries(OVERVIEW_ENDPOINTS.dailyPurchased),
          fetchSeries(OVERVIEW_ENDPOINTS.gridExport),
          fetchSeries(OVERVIEW_ENDPOINTS.gridImport),
          fetchSeries(PV_ENDPOINTS.find(e => e.endpoint.includes("pv1inputpower"))?.endpoint   || ""),
          fetchSeries(PV_ENDPOINTS.find(e => e.endpoint.includes("pv2inputpower"))?.endpoint   || ""),
          fetchSeries(PV_ENDPOINTS.find(e => e.endpoint.includes("_soc_"))?.endpoint           || ""),
          fetchSeries(PV_ENDPOINTS.find(e => e.endpoint.includes("bmspacktemperature"))?.endpoint || ""),
          fetchSeries(PV_ENDPOINTS.find(e => e.endpoint.includes("backup_a"))?.endpoint        || ""),
          fetchSeries(PV_ENDPOINTS.find(e => e.endpoint.includes("backup_b"))?.endpoint        || ""),
          fetchSeries(PV_ENDPOINTS.find(e => e.endpoint.includes("backup_c"))?.endpoint        || ""),
          fetchSeries(PV_ENDPOINTS.find(e => e.endpoint.includes("pmeter"))?.endpoint          || ""),
        ]);

      const fetched = {
        pvTotal, pvBattery, dailyPv, dailyLoad, dailyPurchased,
        gridExport, gridImport, pv1Power, pv2Power, soc,
        bmsTemp, backupA, backupB, backupC, threePhaseMeter,
      };
      const synthetic = generateSyntheticPVData(replayDataRef.current?.main);
      const merged    = Object.fromEntries(
        Object.entries(fetched).map(([k, v]) => [k, v.length ? v : (synthetic[k] || [])])
      );
      pvDataRef.current = merged;
      setPvDataLoaded(true);
      setPvDataTick(t => t + 1);
      return pvDataRef.current;
    } catch (err) {
      console.warn("PV data load failed:", err);
      setPvError("Solar data unavailable — showing simulated values");
      pvDataRef.current = generateSyntheticPVData(replayDataRef.current?.main);
      setPvDataLoaded(true);
      setPvDataTick(t => t + 1);
      return pvDataRef.current;
    } finally {
      setPvLoading(false);
    }
  }, [pvDataLoaded, pvDataRef, getBuildingJson, replayDataRef]);

  useEffect(() => { loadPVData(); }, []); // load once on mount

  // ── Derived data ────────────────────────────────────────────────────────────
  void pvDataTick; // reactivity trigger
  const pvd           = pvDataRef.current;
  const metrics       = computeSolarMetrics(pvd, replayData, tariffRate);
  const pvTotalSeries = pvd?.pvTotal  || [];
  const socSeries     = pvd?.soc      || [];
  const pv1Series     = pvd?.pv1Power || [];
  const pv2Series     = pvd?.pv2Power || [];
  const W = 256;

  const pv1Total = pv1Series.reduce((s, f) => s + f.value * 0.25, 0);
  const pv2Total = pv2Series.reduce((s, f) => s + f.value * 0.25, 0);

  // ── Sub-components ──────────────────────────────────────────────────────────

  const FlowDiagram = () => {
    if (!metrics) return null;
    const { pvKw, batteryKw, gridKw, exportKw, loadKw } = metrics.latest;
    const scale  = v => Math.max(1, Math.min(12, v / 0.5));
    const gold = "#F59E0B", blue = "#60A5FA", red = "#EF4444", purple = "#818CF8", grey = "#94A3B8";
    const nodes = {
      solar:   { x: 40,  y: 30  },
      battery: { x: 40,  y: 120 },
      building:{ x: 190, y: 75  },
      grid:    { x: 190, y: 150 },
    };
    const Arrow = ({ x1, y1, x2, y2, color, w, active }) => active ? (
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round"
        style={{ animation: "flowPulse 2s infinite ease-in-out" }} />
    ) : null;
    const gridColor = gridKw > 0.1 ? red : purple;
    const nodeData = [
      { n: nodes.solar,    color: gold,      name: "Solar",    label: `${pvKw.toFixed(1)} kW` },
      { n: nodes.battery,  color: blue,      name: "Battery",  label: `${batteryKw > 0 ? "+" : ""}${batteryKw.toFixed(1)} kW` },
      { n: nodes.building, color: grey,      name: "Building", label: `${loadKw.toFixed(1)} kW` },
      { n: nodes.grid,     color: gridColor, name: "Grid",     label: `${(gridKw > 0.1 ? gridKw : exportKw).toFixed(1)} kW` },
    ];
    return (
      <svg width={W} height={200} style={{ display: "block", margin: "0 auto 10px" }}>
        <defs><style>{`@keyframes flowPulse{0%,100%{opacity:0.7}50%{opacity:1}}`}</style></defs>
        <Arrow x1={nodes.solar.x + 20}  y1={nodes.solar.y}      x2={nodes.building.x - 20} y2={nodes.building.y}      color={gold}   w={scale(pvKw)}      active={pvKw > 0.1}      />
        <Arrow x1={nodes.solar.x}        y1={nodes.solar.y + 20} x2={nodes.battery.x}       y2={nodes.battery.y - 20}  color={gold}   w={scale(batteryKw)} active={batteryKw > 0.1} />
        <Arrow x1={nodes.battery.x + 20} y1={nodes.battery.y}   x2={nodes.building.x - 20} y2={nodes.building.y + 15} color={blue}   w={scale(-batteryKw)}active={batteryKw < -0.1}/>
        <Arrow x1={nodes.grid.x - 20}    y1={nodes.grid.y}       x2={nodes.building.x}      y2={nodes.building.y + 20} color={red}    w={scale(gridKw)}    active={gridKw > 0.1}    />
        <Arrow x1={nodes.building.x}     y1={nodes.building.y + 25} x2={nodes.grid.x - 20}  y2={nodes.grid.y - 10}    color={purple} w={scale(exportKw)}  active={exportKw > 0.1}  />
        {nodeData.map(({ n, color, name, label }) => (
          <g key={name}>
            <circle cx={n.x} cy={n.y} r={20} fill={color + "33"} stroke={color} strokeWidth={1.5} />
            <text x={n.x} y={n.y + 5}  textAnchor="middle" fontSize={13} fill={color}>{
              name === "Solar" ? "☀️" : name === "Battery" ? "🔋" : name === "Building" ? "🏢" : "🔌"
            }</text>
            <text x={n.x} y={n.y + 34} textAnchor="middle" fontSize={8} fill={color}>{name}</text>
            <text x={n.x} y={n.y + 46} textAnchor="middle" fontSize={9} fill={color} fontWeight="600">{label}</text>
          </g>
        ))}
      </svg>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Loading state */}
      {pvLoading && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#475569", fontSize: 12 }}>
          ☀️ Loading solar data...
        </div>
      )}

      {/* Error state */}
      {pvError && (
        <div style={{ textAlign: "center", padding: "16px", background: "rgba(251,191,36,0.06)", borderRadius: 8, fontSize: 11, color: "#FDE68A", marginBottom: 8 }}>
          Using estimated values — live solar data unavailable
        </div>
      )}

      {/* Role banner — one plain line */}
      {metrics && activeRole && (() => {
        const { socPct, loadKw } = metrics.latest;
        const { selfSufficiency, solarFraction, stringBalance } = metrics.kpis;
        const { costAvoided } = metrics.financial;
        const usableKwh = BATTERY_CAPACITY_KWH * (socPct / 100) * BATTERY_EFFICIENCY;
        const hoursBackup = (usableKwh / Math.max(0.1, loadKw)).toFixed(1);
        const bannerMap = {
          director:       `Solar saved €${costAvoided.toFixed(2)} this month`,
          facilities:     `Solar system status: ${stringBalance > 20 ? "Check needed" : "OK"}`,
          sustainability: `Running ${selfSufficiency.toFixed(0)}% on renewable energy today`,
          it:             `Battery backup: ${hoursBackup} hours at current load`,
          worker:         `The building is ${selfSufficiency.toFixed(0)}% solar powered today`,
          visitor:        `Right now, solar is powering ${solarFraction.toFixed(0)}% of this building`,
        };
        const text = bannerMap[activeRole];
        if (!text) return null;
        return (
          <div style={{ fontSize: 11, color: "#FBBF24", textAlign: "center", padding: "6px 0", marginBottom: 8 }}>
            {text}
          </div>
        );
      })()}

      {/* Sub-view selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginBottom: 10 }}>
        {[
          { key: "overview", label: "⚡ Now" },
          { key: "timeline", label: "📈 Today" },
          { key: "battery",  label: "🔋 Battery" },
          { key: "strings",  label: "🔌 Strings" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setSolarView(key)} style={{
            background:  solarView === key ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.08)",
            color:       solarView === key ? "#FBBF24" : "#DDEFFF",
            border:      solarView === key ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(186,230,253,0.35)",
            borderRadius: 6,
            padding:     "7px 2px",
            fontSize:    10,
            fontWeight:  600,
            cursor:      "pointer",
            fontFamily:  "inherit",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── NOW ── */}
      {solarView === "overview" && metrics && (() => {
        const { pvKw, batteryKw, loadKw, solarCovers } = metrics.latest;
        const { socPct } = metrics.latest;
        const { solarFraction } = metrics.kpis;
        const { costAvoided } = metrics.financial;
        const isGenerating = pvKw > 0.1;
        const nowHour = new Date().getHours();
        const isNightHour = nowHour < 6 || nowHour > 20;

        let icon, bigText, bigTextColor, support1, support2Color;
        let support2 = null;
        if (!isGenerating) {
          icon         = isNightHour ? "🌙" : "☁️";
          bigText      = "Solar not generating";
          bigTextColor = "#475569";
          support1     = isNightHour
            ? "Sunrise at approximately 07:00"
            : "Low light conditions — battery covering load";
        } else if (solarCovers) {
          icon         = "☀️";
          bigText      = "Running on solar";
          bigTextColor = "#FBBF24";
          support1     = `Generating ${pvKw.toFixed(1)} kW — covering the full building`;
          support2     = "No grid needed right now";
          support2Color = "#4ADE80";
        } else {
          icon         = "⛅";
          bigText      = `Solar covering ${solarFraction.toFixed(0)}% of the building`;
          bigTextColor = "#FBBF24";
          support1     = `Generating ${pvKw.toFixed(1)} kW · Building needs ${loadKw.toFixed(1)} kW`;
          const diff   = Math.max(0, loadKw - pvKw);
          support2     = `Grid making up the ${diff.toFixed(1)} kW difference`;
          support2Color = "#64748B";
        }

        const battLabel = batteryKw > 0.1 ? "charging" : batteryKw < -0.1 ? "discharging" : "standby";
        const battColor = socPct > 50 ? "#60A5FA" : socPct > 20 ? "#FBBF24" : "#EF4444";

        return (
          <>
            {/* Big status block */}
            <div style={{
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.15)",
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: bigTextColor, lineHeight: 1.2 }}>{bigText}</div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 8 }}>{support1}</div>
              {support2 && (
                <div style={{ fontSize: 11, color: support2Color, marginTop: 4 }}>{support2}</div>
              )}
            </div>

            {/* Three stat pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[
                { value: `${pvKw.toFixed(1)} kW`, label: "generating",  color: "#FBBF24" },
                { value: `${socPct.toFixed(0)}%`, label: battLabel,      color: battColor },
                { value: `€${costAvoided.toFixed(2)}`, label: "saved today", color: "#4ADE80" },
              ].map(({ value, label, color }) => (
                <div key={label} style={{
                  flex: 1,
                  background: "rgba(15,23,42,0.8)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  padding: "10px 8px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Energy flow diagram */}
            <FlowDiagram />
          </>
        );
      })()}

      {/* ── TODAY ── */}
      {solarView === "timeline" && (() => {
        if (!pvTotalSeries.length) return (
          <div style={{ fontSize: 10, color: "#9AB8D7", padding: "12px 0" }}>No timeline data available.</div>
        );

        const mainSeries = replayData?.main || [];
        const pvVals  = pvTotalSeries.map(s => s.value);
        const ldVals  = mainSeries.map(s => (s.watts || 0) / 1000);
        const socVals = socSeries.map(s => s.value);
        const TW = 256, TH = 80;
        const allY = [...pvVals, ...ldVals].filter(Number.isFinite);
        const minY = Math.min(0, ...allY), maxY = Math.max(0.001, ...allY);
        const yOf  = v => TH - (((v - minY) / (maxY - minY)) * TH);
        const xOf  = (i, len) => (i / Math.max(1, len - 1)) * TW;

        const pvPts  = pvVals.map((v, i)  => `${xOf(i, pvVals.length)},${yOf(v)}`).join(" ");
        const ldPts  = ldVals.map((v, i)  => `${xOf(i, ldVals.length)},${yOf(v)}`).join(" ");
        const socPts = socVals.map((v, i) => `${xOf(i, socVals.length)},${TH - ((v / 100) * TH)}`).join(" ");

        const greenSegs = [];
        let start = null;
        pvVals.forEach((v, i) => {
          const load = (mainSeries[i]?.watts || 0) / 1000;
          if (v >= load)  { if (start === null) start = i; }
          else            { if (start !== null) { greenSegs.push([start, i - 1]); start = null; } }
        });
        if (start !== null) greenSegs.push([start, pvVals.length - 1]);

        // Find peak solar hour for annotation
        const peakIdx = pvVals.reduce((best, v, i) => v > pvVals[best] ? i : best, 0);
        const peakX   = xOf(peakIdx, pvVals.length);
        const peakTime = pvTotalSeries[peakIdx]?.time || "12:00";

        // Today insight
        const todayInsight = (() => {
          if (!metrics) return `Solar data loading…`;
          const { selfSufficiency } = metrics.kpis;
          const { exportKwh, pvKwh } = metrics.totals;
          const { costAvoided } = metrics.financial;
          if (selfSufficiency > 60)
            return `☀️ Solar covered more than half the building's energy over the last 48 hours.`;
          if (exportKwh > 5)
            return `⚡ You exported ${exportKwh.toFixed(1)} kWh to the grid — worth €${(exportKwh * FEED_IN_TARIFF).toFixed(2)} at feed-in rate.`;
          if (costAvoided > 10)
            return `💰 Solar saved €${costAvoided.toFixed(2)} over the last 48 hours.`;
          return `Solar generated ${pvKwh.toFixed(1)} kWh over the last 48 hours.`;
        })();

        return (
          <>
            {/* Two answer cards */}
            {metrics && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <div style={{ flex: 1, background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#4ADE80" }}>€{metrics.financial.costAvoided.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>saved from solar today</div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>{metrics.totals.selfUsedKwh.toFixed(1)} kWh self-consumed</div>
                </div>
                <div style={{ flex: 1, background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#818CF8" }}>{metrics.totals.exportKwh.toFixed(1)} kWh</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>sent to the grid</div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>at €{FEED_IN_TARIFF.toFixed(2)} feed-in rate</div>
                </div>
              </div>
            )}

            {/* 48h chart */}
            <svg width={TW} height={TH + 2} style={{ display: "block", borderRadius: 4, background: "rgba(10,15,26,0.7)", border: "1px solid rgba(125,211,252,0.10)", marginBottom: 4 }}>
              {greenSegs.map(([s, e], gi) => (
                <rect key={gi} x={xOf(s, pvVals.length)} y={0}
                  width={Math.max(1, xOf(e, pvVals.length) - xOf(s, pvVals.length))} height={TH}
                  fill="rgba(74,222,128,0.09)" />
              ))}
              <polyline points={`0,${TH} ${pvPts} ${TW},${TH}`} fill="rgba(245,158,11,0.15)" stroke="none" />
              <polyline points={pvPts}  fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinejoin="round" />
              <polyline points={ldPts}  fill="none" stroke="#F8FAFC" strokeWidth="1.2" strokeLinejoin="round" strokeDasharray="3,3" />
              <polyline points={socPts} fill="none" stroke="#60A5FA" strokeWidth="1.2" strokeLinejoin="round" strokeDasharray="4,2" />
              {/* Peak annotation */}
              {pvVals[peakIdx] > 0.1 && (
                <g>
                  <line x1={peakX} y1={yOf(pvVals[peakIdx]) - 2} x2={peakX} y2={yOf(pvVals[peakIdx]) - 10} stroke="#FBBF24" strokeWidth={1} />
                  <text x={peakX} y={yOf(pvVals[peakIdx]) - 13} textAnchor="middle" fontSize={8} fill="#FBBF24">Peak at {peakTime}</text>
                </g>
              )}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9AB8D7", marginBottom: 4 }}>
              <span>00:00</span><span>12:00</span><span>24:00</span><span>36:00</span><span>48h</span>
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 9, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#F59E0B" }}>■ ☀️ Solar output</span>
              <span style={{ color: "#F8FAFC" }}>- - 🏢 Building load</span>
              <span style={{ color: "#60A5FA" }}>-- 🔋 Battery level</span>
              <span style={{ color: "rgba(74,222,128,0.7)" }}>■ 🟢 Running on solar</span>
            </div>

            {/* Insight line */}
            <div style={{
              background: "rgba(251,191,36,0.06)",
              borderLeft: "3px solid #FBBF24",
              borderRadius: "0 6px 6px 0",
              padding: "8px 12px",
              fontSize: 11,
              color: "#FDE68A",
              marginTop: 8,
              lineHeight: 1.5,
            }}>
              {todayInsight}
            </div>
          </>
        );
      })()}

      {/* ── BATTERY ── */}
      {solarView === "battery" && (() => {
        const socPct  = metrics?.latest?.socPct  ?? 0;
        const battKw  = metrics?.latest?.batteryKw ?? 0;
        const bmsTemp = metrics?.latest?.bmsTemp  ?? 0;
        const loadKw  = Math.max(0.1, metrics?.latest?.loadKw ?? 5);

        const socColor = socPct > 50 ? "#60A5FA" : socPct > 20 ? "#FBBF24" : "#EF4444";
        const usableKwh = BATTERY_CAPACITY_KWH * (socPct / 100) * BATTERY_EFFICIENCY;
        const hoursRemaining = (usableKwh / loadKw).toFixed(1);

        // SOC chart (120px)
        const SH = 120, SW = 256;
        const socY = v => SH - ((Math.min(100, Math.max(0, v)) / 100) * SH);
        const socX = (i, len) => (i / Math.max(1, len - 1)) * SW;
        const socLinePts = socSeries.map((s, i) => `${socX(i, socSeries.length)},${socY(s.value)}`).join(" ");
        const low20Y  = socY(20);
        const high80Y = socY(80);

        // Find if SOC dropped below 20% and where
        const lowSocIdx = socSeries.findIndex(s => s.value < 20);
        const lowSocTime = lowSocIdx >= 0 ? socSeries[lowSocIdx]?.time : null;

        return (
          <>
            {/* Large SOC display */}
            <div style={{
              textAlign: "center",
              padding: "20px 14px",
              background: "rgba(15,23,42,0.6)",
              border: "1px solid rgba(96,165,250,0.15)",
              borderRadius: 12,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: socColor, lineHeight: 1 }}>
                {socPct.toFixed(0)}%
              </div>
              <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
                battery charged
              </div>
              <div style={{
                fontSize: 12,
                marginTop: 10,
                color: battKw > 0.1 ? "#4ADE80" : battKw < -0.1 ? "#FBBF24" : "#475569",
              }}>
                {battKw > 0.1
                  ? `↑ Charging at ${battKw.toFixed(1)} kW`
                  : battKw < -0.1
                  ? `↓ Discharging at ${Math.abs(battKw).toFixed(1)} kW`
                  : "Standing by"}
              </div>
              {/* Progress bar */}
              <div style={{ margin: "12px auto 0", width: "80%", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${socPct}%`, height: "100%", background: socColor, borderRadius: 3, transition: "width 0.5s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 8 }}>
                About {usableKwh.toFixed(1)} kWh available — enough for ~{hoursRemaining} hours
              </div>
            </div>

            {/* SOC timeline (120px) */}
            {socSeries.length > 0 && (
              <>
                <svg width={SW} height={SH + 2} style={{ display: "block", borderRadius: 4, background: "rgba(10,15,26,0.7)", border: "1px solid rgba(125,211,252,0.10)", marginBottom: 4 }}>
                  {/* 80% threshold */}
                  <line x1={0} y1={high80Y} x2={SW} y2={high80Y} stroke="#4ADE80" strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
                  <text x={SW - 4} y={high80Y - 3} textAnchor="end" fontSize={8} fill="#4ADE80" opacity={0.7}>Full</text>
                  {/* 20% threshold */}
                  <line x1={0} y1={low20Y} x2={SW} y2={low20Y} stroke="#EF4444" strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
                  <text x={SW - 4} y={low20Y - 3} textAnchor="end" fontSize={8} fill="#EF4444" opacity={0.7}>Low</text>
                  {/* SOC line */}
                  <polyline points={socLinePts} fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinejoin="round" />
                  {/* Low SOC annotation */}
                  {lowSocTime && (
                    <text x={socX(lowSocIdx, socSeries.length)} y={socY(socSeries[lowSocIdx]?.value) - 6}
                      textAnchor="middle" fontSize={8} fill="#EF4444">
                      ⚠ Low at {lowSocTime}
                    </text>
                  )}
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9AB8D7", marginBottom: 8 }}>
                  <span>00:00</span><span>12:00</span><span>24:00</span><span>36:00</span><span>48h</span>
                </div>
              </>
            )}

            {/* BMS temp alert — only if > 35°C */}
            {bmsTemp > 35 && (
              <div style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 10,
                color: "#FCA5A5",
                marginTop: 8,
              }}>
                ⚠ Battery temperature is {bmsTemp.toFixed(1)}°C — check ventilation
              </div>
            )}
          </>
        );
      })()}

      {/* ── STRINGS ── */}
      {solarView === "strings" && (() => {
        const balance = metrics?.kpis?.stringBalance ?? 0;

        // Find max divergence point for annotation
        const minLen = Math.min(pv1Series.length, pv2Series.length);
        let maxDivIdx = 0, maxDivVal = 0;
        for (let i = 0; i < minLen; i++) {
          const d = Math.abs((pv1Series[i]?.value ?? 0) - (pv2Series[i]?.value ?? 0));
          if (d > maxDivVal) { maxDivVal = d; maxDivIdx = i; }
        }

        const SH2 = 140, SW2 = 256;
        const allVals = [...pv1Series.map(s => s.value), ...pv2Series.map(s => s.value)].filter(Number.isFinite);
        const maxV2 = Math.max(0.001, ...allVals);
        const y2Of = v => SH2 - ((Math.max(0, v) / maxV2) * SH2);
        const x2Of = (i, len) => (i / Math.max(1, len - 1)) * SW2;
        const p1Pts = pv1Series.map((s, i) => `${x2Of(i, pv1Series.length)},${y2Of(s.value)}`).join(" ");
        const p2Pts = pv2Series.map((s, i) => `${x2Of(i, pv2Series.length)},${y2Of(s.value)}`).join(" ");

        const divAnnotX = x2Of(maxDivIdx, minLen || 1);
        const divAnnotY = pv1Series[maxDivIdx]
          ? y2Of((pv1Series[maxDivIdx].value + (pv2Series[maxDivIdx]?.value ?? 0)) / 2)
          : SH2 / 2;

        // Plain sentence
        const stringSentence = (() => {
          if (balance < 5)  return "Both strings are generating equally — system is healthy.";
          if (balance < 20) return "Strings are slightly different — worth checking after the next sunny day.";
          return `String 1 generated ${pv1Total.toFixed(1)} kWh, String 2 generated ${pv2Total.toFixed(1)} kWh over the last 48 hours. Inspect the lower string.`;
        })();

        return (
          <>
            {/* Pass / warning / fail card */}
            {balance < 10 ? (
              <div style={{ textAlign: "center", padding: 20, background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 32 }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#4ADE80", marginTop: 8 }}>Both strings working</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>PV1 and PV2 are generating evenly</div>
              </div>
            ) : balance <= 20 ? (
              <div style={{ textAlign: "center", padding: 20, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 32 }}>⚠</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#FBBF24", marginTop: 8 }}>Minor difference detected</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>PV1 and PV2 differ by {balance.toFixed(0)}% — could be light cloud or dust</div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 20, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 32 }}>✗</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#EF4444", marginTop: 8 }}>String imbalance detected</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>One string generating {balance.toFixed(0)}% less than the other</div>
                <div style={{ fontSize: 10, color: "#64748B", marginTop: 6 }}>Possible cause: soiling, shading, or a panel fault</div>
                <button style={{ marginTop: 10, padding: "5px 14px", fontSize: 10, borderRadius: 5, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "#FCA5A5", cursor: "pointer", fontFamily: "inherit" }}>
                  Report to maintenance →
                </button>
              </div>
            )}

            {/* String comparison chart */}
            <svg width={SW2} height={SH2 + 2} style={{ display: "block", borderRadius: 4, background: "rgba(10,15,26,0.7)", border: "1px solid rgba(125,211,252,0.10)", marginBottom: 4 }}>
              {p1Pts && <polyline points={p1Pts} fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinejoin="round" />}
              {p2Pts && <polyline points={p2Pts} fill="none" stroke="#FCD34D" strokeWidth="1.8" strokeLinejoin="round" />}
              {balance > 20 && maxDivVal > 0 && (
                <g>
                  <line x1={divAnnotX} y1={divAnnotY} x2={divAnnotX} y2={divAnnotY - 10} stroke="#EF4444" strokeWidth={1} />
                  <text x={divAnnotX} y={divAnnotY - 13} textAnchor="middle" fontSize={8} fill="#EF4444">Largest gap here</text>
                </g>
              )}
            </svg>
            <div style={{ display: "flex", gap: 10, fontSize: 9, marginBottom: 6 }}>
              <span style={{ color: "#F59E0B" }}>■ String 1</span>
              <span style={{ color: "#FCD34D" }}>■ String 2</span>
            </div>

            {/* Plain sentence */}
            <div style={{ fontSize: 10, color: "#64748B", textAlign: "center", marginTop: 8 }}>
              {stringSentence}
            </div>
          </>
        );
      })()}
    </>
  );
}

import { FONT, CIRCUIT_LABELS, WORKING_DAYS_MONTH, CARBON_FACTOR, computeBaseline, circuitStats, fmtEur, fmtW, epcColor } from "./roleHelpers.js";
import { Pill, SL, Sparkline, EmptyState } from "./panelUI.jsx";

export default function DirectorView({ replayData, tariffRate }) {
  const baseline = computeBaseline(replayData, tariffRate);
  if (!baseline) return <EmptyState msg="Load energy data first (▶ Energy → Play)" />;

  const mainFrames = replayData["main"] || [];
  // converts power reading to estimated cost for each frame, assuming a 15-minute interval (0.25 hours) and the given tariff rate. 
  // This allows the dashboard to display an estimated cost rate over time, helping the director understand how energy consumption translates into costs throughout the day.
  const costFrames = mainFrames.map(f => ({ ...f, cost: (f.watts / 1000) * tariffRate * 0.25 }));
  const hourlyBudget = baseline.monthlyCost / WORKING_DAYS_MONTH / 24;
  // The circuitWaste array identifies the top energy-saving opportunities by analyzing the energy consumption of each circuit during after-hours (8 PM to 7 AM). 
  // It calculates the estimated kWh that could be saved by turning off or reducing usage of each circuit during these hours and estimates the potential monthly savings in euros based on the tariff rate. 
  // The circuits are then sorted by potential savings, and the top three are displayed in the dashboard.

// afterKwh “How much energy this circuit used during after-hours periods over the replay window.For each circuit excluding main, 
// it filters the frames to include only those that fall within the after-hours time range (8 PM to 7 AM) 
// and sums up the energy consumption in kWh by converting watts to kWh (dividing by 1000)
//  and multiplying by the duration of each frame (0.25 hours for 15-minute intervals). This gives an estimate of how much energy could potentially be saved by managing this circuit during after-hours periods.
  const circuitWaste = Object.entries(replayData)
    .filter(([id]) => id !== "main")
    .map(([id, frames]) => {
      const afterKwh = (frames || []).filter(f => f.hour >= 20 || f.hour < 7)
                                     .reduce((s, f) => s + (f.watts/1000)*0.25, 0);
      return { id, label: CIRCUIT_LABELS[id] || id, afterKwh, saving: (afterKwh/2)*WORKING_DAYS_MONTH*tariffRate };
    })
    .sort((a, b) => b.saving - a.saving)
    .slice(0, 3);

  const euiPct = Math.min(1, Math.max(0, (baseline.eui - 85) / 315));
  const topPct  = Math.round((1 - euiPct) * 100);

  return (
    <>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
        <Pill label="Est. monthly cost" value={fmtEur(baseline.monthlyCost)} sub={`~${fmtEur(baseline.monthlyCost/22)}/day`} color="#FBBF24"/>
        <Pill label="Energy rating" value={baseline.epcRating} sub="Target: B or better" color={epcColor(baseline.epcRating)}/>
        <Pill label="Carbon today" value={`${baseline.carbonKgDay.toFixed(1)} kg`} sub={`${baseline.carbonTonYear.toFixed(1)} t/year est.`} color="#4ADE80"/>
        <Pill label="EUI" value={`${baseline.eui.toFixed(0)} kWh/m²`} sub="Energy use intensity" color="#60A5FA"/>
      </div>

      <SL>Estimated cost rate (48 h)</SL>
      <Sparkline frames={costFrames} valueKey="cost" color="#FBBF24" h={54}/>
      <div style={{ fontSize:9, color:"#64748B", marginBottom:8 }}>
        Daily budget rate: ~{fmtEur(hourlyBudget)}/h
      </div>

      <SL>Top energy-saving opportunities</SL>
      {circuitWaste.map(w => (
        <div key={w.id} style={{ background:"rgba(15,23,42,0.85)", border:"1px solid rgba(125,211,252,0.15)", borderRadius:8, padding:"8px 10px", marginBottom:6 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:12, fontWeight:700, color:"#E2F1FF" }}>{w.label}</span>
            <span style={{ fontSize:12, color:"#4ADE80", fontWeight:700 }}>Saves ~{fmtEur(w.saving)}/mo</span>
          </div>
          <div style={{ fontSize:10, color:"#9AB8D7", marginTop:2 }}>
            {w.afterKwh.toFixed(1)} kWh/day after hours
          </div>
        </div>
      ))}

      <SL>EU building benchmark</SL>
      <div style={{ background:"rgba(15,23,42,0.85)", border:"1px solid rgba(125,211,252,0.15)", borderRadius:8, padding:"10px 12px", marginBottom:6 }}>
        <div style={{ fontSize:10, color:"#9AB8D7", marginBottom:6 }}>EUI: {baseline.eui.toFixed(0)} kWh/m²/yr — this building vs EU offices</div>
        <svg width="100%" viewBox="0 0 260 22" style={{ overflow:"visible" }}>
          <rect x={0} y={8} width={260} height={6} fill="rgba(255,255,255,0.06)" rx={3}/>
          <rect x={0} y={8} width={260} height={6} fill="url(#bench-grad)" rx={3} opacity={0.5}/>
          <defs>
            <linearGradient id="bench-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4ADE80"/><stop offset="50%" stopColor="#FBBF24"/><stop offset="100%" stopColor="#EF4444"/>
            </linearGradient>
          </defs>
          <circle cx={euiPct * 260} cy={11} r={5} fill={epcColor(baseline.epcRating)} stroke="#1E3A5F" strokeWidth={1.5}/>
          <text x={euiPct * 260} y={22} fontSize={7} fill="#9AB8D7" textAnchor="middle" fontFamily={FONT}>You</text>
          <text x={0} y={7} fontSize={7} fill="#4ADE80" fontFamily={FONT}>Best</text>
          <text x={260} y={7} fontSize={7} fill="#EF4444" textAnchor="end" fontFamily={FONT}>Poor</text>
        </svg>
        <div style={{ fontSize:10, color:"#FBBF24", marginTop:4 }}>Top {topPct}% of similar EU office buildings</div>
      </div>
    </>
  );
}

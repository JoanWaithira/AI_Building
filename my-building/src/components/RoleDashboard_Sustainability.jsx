import { useState } from "react";
import { CARBON_FACTOR, computeBaseline, fmtEur, epcColor } from "./roleHelpers.js";
import { Btn, SL, Pill, Sparkline, EmptyState } from "./panelUI.jsx";

export default function SustainabilityView({ replayData, pvData, tariffRate }) {
  const [reportText, setReportText] = useState(null);
  const baseline = computeBaseline(replayData, tariffRate);
  if (!baseline) return <EmptyState msg="Load energy data first (▶ Energy → Play)"/>;

  const mainFrames = replayData["main"] || [];
  const carbonFrames = mainFrames.map(f => ({ ...f, carbon: (f.watts/1000)*CARBON_FACTOR*0.25 }));

  const criteria = [
    { label:"EPC B or better", met: ["A+","A","B"].includes(baseline.epcRating), note: baseline.epcRating },
    { label:"EUI < 150 kWh/m²/yr", met: baseline.eui < 150, note: `${baseline.eui.toFixed(0)} kWh/m²` },
    { label:"Renewable energy share > 30%", met: false, note: "No PV data configured" },
    { label:"Smart metering installed", met: true,  note: "Data confirms this" },
    { label:"Carbon reporting capable",   met: true,  note: "This dashboard" },
  ];
  const metCount = criteria.filter(c => c.met).length;

  const genReport = () => {
    const now = new Date().toLocaleDateString();
    const text = [
      `CARBON REPORT — Gate Building`,
      `Period: last 48h data as of ${now}`,
      ``,
      `Total consumption:  ${baseline.totalKwh.toFixed(1)} kWh`,
      `Carbon emitted:     ${(baseline.totalKwh * CARBON_FACTOR).toFixed(1)} kg CO₂`,
      `Solar offset:       0 kg CO₂ (no PV data)`,
      `Net carbon:         ${(baseline.totalKwh * CARBON_FACTOR).toFixed(1)} kg CO₂`,
      ``,
      `Annualised:         ${baseline.carbonTonYear.toFixed(2)} tonnes CO₂/year`,
      `EPC Rating:         ${baseline.epcRating}`,
      `EU Taxonomy:        ${metCount}/5 criteria met`,
    ].join("\n");
    setReportText(text);
  };

  return (
    <>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
        <Pill label="Carbon today"  value={`${baseline.carbonKgDay.toFixed(1)} kg`}   color="#4ADE80"/>
        <Pill label="Carbon/year"   value={`${baseline.carbonTonYear.toFixed(1)} t`}   color="#FBBF24"/>
        <Pill label="EPC Rating"    value={baseline.epcRating}  sub="Energy performance" color={epcColor(baseline.epcRating)}/>
        <Pill label="EUI"           value={`${baseline.eui.toFixed(0)} kWh/m²`} sub="vs 150 target" color={baseline.eui < 150 ? "#4ADE80":"#EF4444"}/>
      </div>

      <SL>Carbon intensity — 48 h</SL>
      <Sparkline frames={carbonFrames} valueKey="carbon" color="#4ADE80" h={48}/>

      <SL>EU Taxonomy checklist</SL>
      <div style={{ marginBottom:10 }}>
        {criteria.map((c, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize:14, flexShrink:0 }}>{c.met ? "✅":"❌"}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:"#E2F1FF" }}>{c.label}</div>
              <div style={{ fontSize:9, color:"#64748B" }}>{c.note}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:10, color:"#9AB8D7", marginBottom:4 }}>{metCount} of 5 criteria met</div>
          <div style={{ height:6, background:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden" }}>
            <div style={{ width:`${(metCount/5)*100}%`, height:"100%", background: metCount>=4?"#4ADE80":metCount>=3?"#FBBF24":"#EF4444", borderRadius:3 }}/>
          </div>
        </div>
        {!["A+","A","B"].includes(baseline.epcRating) && (
          <div style={{ fontSize:9, color:"#9AB8D7", marginTop:6, lineHeight:1.5 }}>
            Achieving EPC B would qualify this building for EU sustainable finance taxonomy.
          </div>
        )}
      </div>

      <Btn full accent onClick={genReport}>📄 Generate Carbon Report</Btn>
      {reportText && (
        <textarea readOnly value={reportText}
          style={{ width:"100%", marginTop:8, background:"rgba(10,15,26,0.9)", border:"1px solid rgba(125,211,252,0.2)", borderRadius:6, color:"#CBD5E1", fontSize:9, fontFamily:"'Courier New',monospace", padding:8, resize:"vertical", minHeight:160 }}/>
      )}
    </>
  );
}

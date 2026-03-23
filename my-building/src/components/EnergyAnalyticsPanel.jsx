import React, { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
const TARIFF     = 0.22;   // €/kWh
const FLOOR_AREA = 3200;   // m²
const C_FACTOR   = 0.233;  // kg CO₂/kWh

const SEASONS = {
  Winter: { months:[11,0,1],  color:"#60A5FA", label:"Dec–Feb" },
  Spring: { months:[2,3,4],   color:"#34D399", label:"Mar–May" },
  Summer: { months:[5,6,7],   color:"#FCD34D", label:"Jun–Aug" },
  Autumn: { months:[8,9,10],  color:"#F97316", label:"Sep–Nov" },
};

// ── Realistic synthetic data: 3,200 m² office building + 30 kWp solar ──
const SYNTH = {

  consumption:   [28000,25000,22000,18000,16000,15000,16000,14000,17000,21000,25000,27000],
  solar:         [600,1200,2100,2800,3200,3100,2900,2700,2100,1400,700,450],
  solarExpected: [700,1300,2200,3000,3400,3200,3000,2800,2200,1500,800,500],
  baseline:      [24000,21500,19000,15500,13800,13000,13800,12000,14500,18000,21500,23000],
  // Heating degree days (HDD) and cooling degree days (CDD) for a temperate climate
  hdd:           [380,340,250,130,50,10,0,0,30,130,260,360],
  cdd:           [0,0,0,0,5,35,60,55,15,0,0,0],
};

function circuitBreakdown(monthIdx) {
  const total = SYNTH.consumption[monthIdx];
  const isWinter = [11,0,1,2].includes(monthIdx);
  const isSummer = [5,6,7,8].includes(monthIdx);
  const hvacFrac = isWinter ? 0.37 : isSummer ? 0.22 : 0.14;
  const other = 1 - hvacFrac - 0.17 - 0.13 - 0.16 - 0.04;
  return {
    "HVAC":        total * hvacFrac,
    "Lighting":    total * 0.17,
    "EV Charging": total * 0.13,
    "Servers/IT":  total * 0.16,
    "Elevators":   total * 0.04,
    "Other":       total * Math.max(0, other),
  };
}

// ── Shared dark-theme chart defaults ─────────────────────────────────────────
const GRID = "rgba(255,255,255,0.07)";
const TICK = "rgba(255,255,255,0.45)";
const baseScales = {
  x: { grid:{ color:GRID }, ticks:{ color:TICK } },
  y: { grid:{ color:GRID }, ticks:{ color:TICK }, beginAtZero:true },
};
const baseLegend = { labels:{ color:"rgba(255,255,255,0.7)", boxWidth:11, font:{ size:11 } } };
const baseTip = {
  backgroundColor:"rgba(10,18,35,0.96)",
  borderColor:"rgba(255,255,255,0.12)",
  borderWidth:1,
  titleColor:"#fff",
  bodyColor:"rgba(255,255,255,0.65)",
  padding:10,
};

// ── KPI pill ──────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, accent="#3B82F6" }) {
  return (
    <div style={{
      background:"rgba(255,255,255,0.05)", borderRadius:10,
      padding:"9px 13px", minWidth:108, flex:"1 1 108px",
    }}>
      <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:700, color:accent, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:"rgba(255,255,255,0.38)", marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// YEAR VIEW  — "executive" overview
// ══════════════════════════════════════════════════════════════════════════════
function YearView() {
  const annual = useMemo(()=>{
    const total    = SYNTH.consumption.reduce((a,b)=>a+b,0);
    const solar    = SYNTH.solar.reduce((a,b)=>a+b,0);
    const baseline = SYNTH.baseline.reduce((a,b)=>a+b,0);
    const eui      = total / FLOOR_AREA;
    const rating   = eui<50?"A+":eui<100?"A":eui<150?"B":eui<200?"C":eui<250?"D":"E";
    return {
      total, solar, eui:eui.toFixed(0), rating,
      cost: (total*TARIFF/1000).toFixed(1),
      carbon: (total*C_FACTOR/1000).toFixed(1),
      savedVsBaseline: Math.round((baseline-total)*TARIFF),
    };
  },[]);

  const barColors = MONTHS.map((_,i)=>{
    if([11,0,1].includes(i)) return "#60A5FA70";
    if([2,3,4].includes(i))  return "#34D39970";
    if([5,6,7].includes(i))  return "#FCD34D70";
    return "#F9741670";
  });

  const chartData = {
    labels: MONTHS,
    datasets: [
      {
        label:"Consumption (kWh)",
        data: SYNTH.consumption,
        backgroundColor: barColors,
        borderColor: barColors.map(c=>c.replace("70","cc")),
        borderWidth:1, yAxisID:"y", order:2,
      },
      {
        label:"Benchmark",
        data: SYNTH.baseline,
        type:"line",
        borderColor:"rgba(255,255,255,0.32)",
        borderDash:[5,4], borderWidth:1.5,
        pointRadius:0, fill:false, yAxisID:"y", order:1,
      },
      {
        label:"HDD (÷10 scale)",
        data: SYNTH.hdd.map(v=>v*10),
        type:"line",
        borderColor:"#7DD3FC60",
        borderWidth:1, pointRadius:0, fill:false, yAxisID:"y2", order:0,
      },
    ],
  };

  const chartOptions = {
    responsive:true, maintainAspectRatio:false,
    interaction:{ mode:"index", intersect:false },
    plugins:{
      legend:baseLegend,
      tooltip:{ ...baseTip, callbacks:{
        label:(ctx)=>{
          if(ctx.dataset.label==="HDD (÷10 scale)") return ` HDD: ${Math.round(ctx.raw/10)}`;
          if(ctx.dataset.label==="Benchmark") return ` Benchmark: ${ctx.raw.toLocaleString()} kWh`;
          return ` ${ctx.dataset.label}: ${ctx.raw.toLocaleString()} kWh`;
        }
      }},
    },
    scales:{
      x:baseScales.x,
      y:{ ...baseScales.y, title:{display:true,text:"kWh",color:TICK,font:{size:10}} },
      y2:{
        position:"right",
        grid:{drawOnChartArea:false},
        ticks:{ color:TICK, font:{size:10}, callback:v=>Math.round(v/10) },
        title:{display:true,text:"HDD",color:TICK,font:{size:10}},
      },
    },
  };

  const epcColors = {"A+":"#15803D","A":"#22C55E","B":"#86EFAC","C":"#FCD34D","D":"#F97316","E":"#EF4444"};

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* KPIs */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <KPI label="Annual Consumption" value={`${(SYNTH.consumption.reduce((a,b)=>a+b,0)/1000).toFixed(0)} MWh`} sub="total electrical" accent="#3B82F6" />
        <KPI label="Solar Generated"    value={`${(SYNTH.solar.reduce((a,b)=>a+b,0)/1000).toFixed(1)} MWh`} sub="30 kWp system" accent="#F59E0B" />
        <KPI label="Annual Cost"         value={`€${annual.cost}k`} sub={`@€${TARIFF}/kWh`} accent="#F87171" />
        <KPI label="EUI"                 value={`${annual.eui} kWh/m²`} sub="EU 2030 target: 60" accent={Number(annual.eui)<80?"#34D399":Number(annual.eui)<120?"#FCD34D":"#F87171"} />
        <KPI label="Carbon"              value={`${annual.carbon} tCO₂`} sub="grid 0.233 kg/kWh" accent="#A78BFA" />
        <KPI label="vs Benchmark"        value={`€${annual.savedVsBaseline.toLocaleString()}`} sub={annual.savedVsBaseline>=0?"saved vs baseline":"over baseline"} accent={annual.savedVsBaseline>=0?"#34D399":"#F87171"} />
      </div>

      {/* Bar chart */}
      <div style={{ height:235 }}>
        <Bar data={chartData} options={chartOptions} />
      </div>

      {/* Season cards */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {Object.entries(SEASONS).map(([name,{months,color,label}])=>{
          const total = months.reduce((a,i)=>a+SYNTH.consumption[i],0);
          const annual = SYNTH.consumption.reduce((a,b)=>a+b,0);
          return (
            <div key={name} style={{
              background:"rgba(255,255,255,0.05)", borderRadius:10,
              padding:"9px 12px", flex:"1 1 120px",
              borderLeft:`3px solid ${color}`,
            }}>
              <div style={{ fontSize:11, color, fontWeight:600, marginBottom:3 }}>{name}</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#fff" }}>{(total/1000).toFixed(1)} MWh</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>
                {((total/annual)*100).toFixed(0)}% of annual · €{(total*TARIFF/1000).toFixed(1)}k · {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* EPC strip */}
      <div style={{
        background:"rgba(255,255,255,0.04)", borderRadius:8,
        padding:"7px 12px", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap",
      }}>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginRight:4 }}>EPC RATING</span>
        {Object.entries(epcColors).map(([r,col])=>(
          <div key={r} style={{
            padding:"2px 9px", borderRadius:4, fontSize:12, fontWeight:600,
            background: r===annual.rating ? col+"33" : "rgba(255,255,255,0.06)",
            color: r===annual.rating ? col : "rgba(255,255,255,0.25)",
            border: r===annual.rating ? `1px solid ${col}` : "1px solid transparent",
          }}>{r}</div>
        ))}
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginLeft:"auto" }}>
          EU 2030 target 60 kWh/m² · current {annual.eui} kWh/m²
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MONTHLY VIEW  — "analyst" — which months are expensive & why
// ══════════════════════════════════════════════════════════════════════════════
function MonthlyView() {
  const chartData = {
    labels: MONTHS,
    datasets:[
      {
        label:"Actual (kWh)",
        data: SYNTH.consumption,
        backgroundColor: SYNTH.consumption.map((v,i)=>v>SYNTH.baseline[i]?"#F8717170":"#3B82F670"),
        borderColor:      SYNTH.consumption.map((v,i)=>v>SYNTH.baseline[i]?"#F87171bb":"#3B82F6bb"),
        borderWidth:1,
      },
      {
        label:"Well-managed Baseline",
        data: SYNTH.baseline,
        type:"line",
        borderColor:"rgba(255,255,255,0.38)",
        borderDash:[6,4], borderWidth:1.5,
        pointRadius:0, fill:false,
      },
    ],
  };

  const chartOptions = {
    responsive:true, maintainAspectRatio:false,
    interaction:{ mode:"index", intersect:false },
    plugins:{
      legend:baseLegend,
      tooltip:{ ...baseTip, callbacks:{
        afterBody:(items)=>{
          const actual = items.find(i=>i.dataset.label==="Actual (kWh)")?.raw ?? 0;
          const base   = items.find(i=>i.dataset.label==="Well-managed Baseline")?.raw ?? 0;
          const diff   = actual - base;
          const pct    = ((diff/base)*100).toFixed(1);
          return diff>=0
            ? [`⚠ ${diff.toLocaleString()} kWh over baseline (+${pct}%)`]
            : [`✓ ${Math.abs(diff).toLocaleString()} kWh under baseline (${pct}%)`];
        }
      }},
    },
    scales:{
      x:baseScales.x,
      y:{ ...baseScales.y, title:{display:true,text:"kWh",color:TICK,font:{size:10}} },
    },
  };

  const overMonths = SYNTH.consumption.filter((v,i)=>v>SYNTH.baseline[i]).length;
  const worstIdx   = SYNTH.consumption.reduce((w,v,i,a)=>(v-SYNTH.baseline[i])>(a[w]-SYNTH.baseline[w])?i:w,0);
  const bestIdx    = SYNTH.consumption.reduce((b,v,i,a)=>(v-SYNTH.baseline[i])<(a[b]-SYNTH.baseline[b])?i:b,0);
  const totalOverspend = SYNTH.consumption.reduce((a,v,i)=>a+Math.max(0,(v-SYNTH.baseline[i])),0)*TARIFF;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <KPI label="Over Baseline"  value={`${overMonths} months`}            sub="exceeded benchmark" accent="#F87171" />
        <KPI label="Worst Month"    value={MONTHS[worstIdx]}                  sub={`+${((SYNTH.consumption[worstIdx]-SYNTH.baseline[worstIdx])/1000).toFixed(1)} MWh over`} accent="#F97316" />
        <KPI label="Best Month"     value={MONTHS[bestIdx]}                   sub={`${((SYNTH.consumption[bestIdx]-SYNTH.baseline[bestIdx])/1000).toFixed(1)} MWh vs baseline`} accent="#34D399" />
        <KPI label="Total Overspend" value={`€${Math.round(totalOverspend).toLocaleString()}`} sub="above benchmark cost" accent="#F87171" />
      </div>

      <div style={{ height:225 }}>
        <Bar data={chartData} options={chartOptions} />
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr>{["Month","Actual (kWh)","Baseline","Difference","Cost (€)","vs Baseline"].map(h=>(
              <th key={h} style={{ padding:"5px 8px", textAlign:"right", color:"rgba(255,255,255,0.4)", borderBottom:"1px solid rgba(255,255,255,0.1)", whiteSpace:"nowrap" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {MONTHS.map((m,i)=>{
              const diff   = SYNTH.consumption[i]-SYNTH.baseline[i];
              const pct    = ((diff/SYNTH.baseline[i])*100).toFixed(0);
              const isOver = diff>0;
              return (
                <tr key={m} style={{ background:i%2===0?"rgba(255,255,255,0.02)":"transparent" }}>
                  <td style={{ padding:"4px 8px", color:"rgba(255,255,255,0.75)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>{m}</td>
                  <td style={{ padding:"4px 8px", textAlign:"right", color:"#fff",                    borderBottom:"1px solid rgba(255,255,255,0.06)" }}>{SYNTH.consumption[i].toLocaleString()}</td>
                  <td style={{ padding:"4px 8px", textAlign:"right", color:"rgba(255,255,255,0.45)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>{SYNTH.baseline[i].toLocaleString()}</td>
                  <td style={{ padding:"4px 8px", textAlign:"right", color:isOver?"#F87171":"#34D399", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>{isOver?"+":""}{diff.toLocaleString()}</td>
                  <td style={{ padding:"4px 8px", textAlign:"right", color:"rgba(255,255,255,0.65)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>{(SYNTH.consumption[i]*TARIFF).toFixed(0)}</td>
                  <td style={{ padding:"4px 8px", textAlign:"right",                                  borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ padding:"1px 6px", borderRadius:4, fontSize:10,
                      background:isOver?"rgba(248,113,113,0.15)":"rgba(52,211,153,0.12)",
                      color:isOver?"#F87171":"#34D399",
                    }}>{isOver?`+${pct}%`:`${pct}%`}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SOLAR VIEW  — "solar manager" — expected vs projected, cleaning flags
// ══════════════════════════════════════════════════════════════════════════════
function SolarView() {
  const annualActual   = SYNTH.solar.reduce((a,b)=>a+b,0);
  const annualExpected = SYNTH.solarExpected.reduce((a,b)=>a+b,0);
  const pr             = ((annualActual/annualExpected)*100).toFixed(1);
  const cleaningMonths = MONTHS.filter((_,i)=>SYNTH.solar[i]/SYNTH.solarExpected[i]<0.85);

  const chartData = {
    labels: MONTHS,
    datasets:[
      {
        label:"Expected (kWh)",
        data: SYNTH.solarExpected,
        backgroundColor:"rgba(251,191,36,0.18)",
        borderColor:"#FBD24866", borderWidth:1.5, type:"bar",
      },
      {
        label:"Actual (kWh)",
        data: SYNTH.solar,
        backgroundColor: SYNTH.solar.map((v,i)=>v/SYNTH.solarExpected[i]<0.85?"#F8717175":"#F59E0B75"),
        borderColor:     SYNTH.solar.map((v,i)=>v/SYNTH.solarExpected[i]<0.85?"#F87171bb":"#F59E0Bbb"),
        borderWidth:1, type:"bar",
      },
      {
        label:"Performance Ratio (%)",
        data: SYNTH.solar.map((v,i)=>Number(((v/SYNTH.solarExpected[i])*100).toFixed(1))),
        type:"line",
        borderColor:"#A78BFA",
        pointBackgroundColor: SYNTH.solar.map((v,i)=>v/SYNTH.solarExpected[i]<0.85?"#F87171":"#A78BFA"),
        borderWidth:1.5, pointRadius:3, fill:false, yAxisID:"y2",
      },
    ],
  };

  const chartOptions = {
    responsive:true, maintainAspectRatio:false,
    interaction:{ mode:"index", intersect:false },
    plugins:{
      legend:baseLegend,
      tooltip:{ ...baseTip, callbacks:{
        afterBody:(items)=>{
          const pr = items.find(i=>i.dataset.label==="Performance Ratio (%)")?.raw;
          if(pr!==undefined && pr<85) return ["⚠ Below 85% threshold — schedule panel cleaning"];
          return [];
        }
      }},
    },
    scales:{
      x:baseScales.x,
      y:{ ...baseScales.y, title:{display:true,text:"kWh",color:TICK,font:{size:10}} },
      y2:{
        position:"right",
        grid:{drawOnChartArea:false},
        ticks:{ color:TICK, font:{size:10}, callback:v=>`${v}%` },
        min:60, max:110,
        title:{display:true,text:"PR %",color:TICK,font:{size:10}},
      },
    },
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <KPI label="Annual Yield"        value={`${(annualActual/1000).toFixed(1)} MWh`}  sub="30 kWp · ~775 kWh/kWp" accent="#F59E0B" />
        <KPI label="Performance Ratio"   value={`${pr}%`}                                  sub="actual vs expected" accent={Number(pr)>=90?"#34D399":Number(pr)>=80?"#FCD34D":"#F87171"} />
        <KPI label="Cost Avoided"         value={`€${(annualActual*TARIFF).toFixed(0)}`}   sub="at €0.22/kWh" accent="#34D399" />
        <KPI label="CO₂ Avoided"          value={`${(annualActual*C_FACTOR/1000).toFixed(1)} t`} sub="vs grid electricity" accent="#A78BFA" />
        <KPI label="Panel Cleaning Alert" value={`${cleaningMonths.length} months`}         sub={cleaningMonths.length>0?cleaningMonths.join(", "):"all ≥85%"} accent={cleaningMonths.length>0?"#F97316":"#34D399"} />
      </div>

      <div style={{ height:235 }}>
        <Bar data={chartData} options={chartOptions} />
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr>{["Month","Expected","Actual","PR %","Lost (kWh)","Action"].map(h=>(
              <th key={h} style={{ padding:"5px 8px", textAlign:"right", color:"rgba(255,255,255,0.4)", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {MONTHS.map((m,i)=>{
              const prPct     = ((SYNTH.solar[i]/SYNTH.solarExpected[i])*100).toFixed(0);
              const lost      = SYNTH.solarExpected[i]-SYNTH.solar[i];
              const needsClean = Number(prPct)<85;
              return (
                <tr key={m} style={{ background:i%2===0?"rgba(255,255,255,0.02)":"transparent" }}>
                  <td style={{ padding:"4px 8px", color:"rgba(255,255,255,0.75)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>{m}</td>
                  <td style={{ padding:"4px 8px", textAlign:"right", color:"rgba(255,255,255,0.45)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>{SYNTH.solarExpected[i].toLocaleString()}</td>
                  <td style={{ padding:"4px 8px", textAlign:"right", color:"#fff",                    borderBottom:"1px solid rgba(255,255,255,0.06)" }}>{SYNTH.solar[i].toLocaleString()}</td>
                  <td style={{ padding:"4px 8px", textAlign:"right",                                  borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ color:Number(prPct)>=90?"#34D399":Number(prPct)>=85?"#FCD34D":"#F87171" }}>{prPct}%</span>
                  </td>
                  <td style={{ padding:"4px 8px", textAlign:"right", color:"rgba(255,255,255,0.55)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>{lost.toLocaleString()}</td>
                  <td style={{ padding:"4px 8px", textAlign:"right",                                  borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    {needsClean
                      ? <span style={{ padding:"1px 6px", borderRadius:4, fontSize:10, background:"rgba(249,115,22,0.18)", color:"#F97316" }}>Clean panels</span>
                      : <span style={{ padding:"1px 6px", borderRadius:4, fontSize:10, background:"rgba(52,211,153,0.08)", color:"#34D39966" }}>OK</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BREAKDOWN VIEW  — pick a season, see 3 months as donut charts
// ══════════════════════════════════════════════════════════════════════════════
const CIRCUIT_COLORS = {
  "HVAC":        "#3B82F6",
  "Lighting":    "#FCD34D",
  "EV Charging": "#34D399",
  "Servers/IT":  "#A78BFA",
  "Elevators":   "#F97316",
  "Other":       "#6B7280",
};

function MonthDonut({ monthIdx }) {
  const bd     = circuitBreakdown(monthIdx);
  const labels = Object.keys(bd);
  const values = Object.values(bd).map(v=>Math.round(v));
  const total  = values.reduce((a,b)=>a+b,0);
  const topCat = labels[values.indexOf(Math.max(...values))];

  const data = {
    labels,
    datasets:[{
      data: values,
      backgroundColor: labels.map(l=>(CIRCUIT_COLORS[l]||"#888")+"bb"),
      borderColor:     labels.map(l=>CIRCUIT_COLORS[l]||"#888"),
      borderWidth:1, hoverOffset:4,
    }],
  };

  const options = {
    responsive:true, maintainAspectRatio:false, cutout:"63%",
    plugins:{
      legend:{ display:false },
      tooltip:{ ...baseTip, callbacks:{
        label:(ctx)=>` ${ctx.label}: ${ctx.raw.toLocaleString()} kWh (${((ctx.raw/total)*100).toFixed(0)}%)`,
      }},
    },
  };

  return (
    <div style={{
      background:"rgba(255,255,255,0.04)", borderRadius:10,
      padding:"12px", flex:"1 1 200px",
      display:"flex", flexDirection:"column", gap:8,
    }}>
      <div>
        <div style={{ fontWeight:600, color:"#fff", fontSize:13 }}>{MONTH_FULL[monthIdx]}</div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>
          {(total/1000).toFixed(1)} MWh · €{(total*TARIFF).toFixed(0)}
        </div>
      </div>

      <div style={{ height:130, position:"relative" }}>
        <Doughnut data={data} options={options} />
        <div style={{
          position:"absolute", top:"50%", left:"50%",
          transform:"translate(-50%,-50%)", textAlign:"center", pointerEvents:"none",
        }}>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", lineHeight:1 }}>top use</div>
          <div style={{
            fontSize:9, fontWeight:700, lineHeight:1.3,
            color:CIRCUIT_COLORS[topCat]||"#fff", maxWidth:50, textAlign:"center",
          }}>{topCat}</div>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
        {labels.map((l,idx)=>(
          <div key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:9 }}>
            <div style={{ width:7, height:7, borderRadius:2, background:CIRCUIT_COLORS[l], flexShrink:0 }} />
            <span style={{ color:"rgba(255,255,255,0.48)", flex:1 }}>{l}</span>
            <span style={{ color:"rgba(255,255,255,0.7)" }}>{((values[idx]/total)*100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownView() {
  const [season, setSeason] = useState("Winter");
  const { months, color } = SEASONS[season];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Season tabs */}
      <div style={{ display:"flex", gap:6 }}>
        {Object.entries(SEASONS).map(([name,{color:c,label}])=>(
          <button
            key={name}
            onClick={()=>setSeason(name)}
            style={{
              padding:"6px 14px", borderRadius:7, border:"none", cursor:"pointer",
              fontSize:12, fontWeight:600, transition:"all 0.15s",
              background: season===name ? c+"30" : "rgba(255,255,255,0.06)",
              color:       season===name ? c      : "rgba(255,255,255,0.45)",
              borderBottom: season===name ? `2px solid ${c}` : "2px solid transparent",
            }}
          >
            {name} <span style={{ fontSize:10, opacity:0.6 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Season-level KPIs */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {["HVAC","Lighting","EV Charging","Servers/IT"].map(cat=>{
          const total = months.reduce((a,i)=>a+circuitBreakdown(i)[cat],0);
          return (
            <KPI key={cat} label={cat}
              value={`${(total/1000).toFixed(1)} MWh`}
              sub={`€${(total*TARIFF).toFixed(0)}`}
              accent={CIRCUIT_COLORS[cat]}
            />
          );
        })}
      </div>

      {/* 3 donut charts */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {months.map(mIdx=><MonthDonut key={mIdx} monthIdx={mIdx} />)}
      </div>

      <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>
        Circuit breakdown estimated from seasonal load profiles. Connect circuit-level metering for precise splits.
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL SHELL
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id:"year",      icon:"📅", label:"Year View",  desc:"Executive" },
  { id:"monthly",   icon:"📊", label:"Monthly",    desc:"Analyst" },
  { id:"solar",     icon:"☀️",  label:"Solar",      desc:"Solar Mgr" },
  { id:"breakdown", icon:"🍩", label:"Breakdown",  desc:"Drill-down" },
];

export default function EnergyAnalyticsPanel({ onClose }) {
  const [tab, setTab] = useState("year");

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:3100,
      display:"flex", alignItems:"center", justifyContent:"center",
      backdropFilter:"blur(4px)",
    }}>
      <div style={{
        width:"min(96vw,1080px)", height:"min(92vh,780px)",
        background:"rgba(8,13,26,0.98)", borderRadius:14,
        border:"1px solid rgba(255,255,255,0.11)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        boxShadow:"0 28px 90px rgba(0,0,0,0.7)",
        fontFamily:"'Inter',system-ui,sans-serif",
      }}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{
          display:"flex", alignItems:"center", padding:"13px 18px",
          borderBottom:"1px solid rgba(255,255,255,0.08)", flexShrink:0, gap:10,
        }}>
          <span style={{ fontSize:16 }}>⚡</span>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#fff", lineHeight:1 }}>Energy Analytics</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>GATE Building · 3,200 m² · 30 kWp solar</div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:4, marginLeft:"auto", marginRight:10 }}>
            {TABS.map(t=>(
              <button
                key={t.id}
                onClick={()=>setTab(t.id)}
                title={t.desc}
                style={{
                  padding:"5px 11px", borderRadius:7, border:"none", cursor:"pointer",
                  fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:5,
                  transition:"all 0.15s",
                  background:    tab===t.id ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.06)",
                  color:         tab===t.id ? "#93C5FD"                : "rgba(255,255,255,0.45)",
                  borderBottom:  tab===t.id ? "2px solid #3B82F6"      : "2px solid transparent",
                }}
              >
                <span style={{ fontSize:13 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            style={{
              background:"rgba(255,255,255,0.07)", border:"none", cursor:"pointer",
              color:"rgba(255,255,255,0.5)", fontSize:14, borderRadius:6,
              width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center",
              flexShrink:0,
            }}
          >×</button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <div style={{ flex:1, overflow:"auto", padding:"15px 18px" }}>
          {tab==="year"      && <YearView />}
          {tab==="monthly"   && <MonthlyView />}
          {tab==="solar"     && <SolarView />}
          {tab==="breakdown" && <BreakdownView />}
        </div>
      </div>
    </div>
  );
}

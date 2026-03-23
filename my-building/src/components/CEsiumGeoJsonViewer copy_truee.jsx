import { useEffect, useRef, useState, useCallback } from "react";
import * as Cesium from "cesium";
import { ROOM_BMS_ENDPOINTS, fetchLatestRoomTelemetry, fetchRoomHistory } from "../utils/roomDataUtils.js";
import { ROLES } from "./roleHelpers.js";
import ScenarioPanel from "./ScenarioPanel.jsx";
import RolePanel from "./RolePanel.jsx";
import SolarPanel from "./SolarPanel.jsx";
import ForecastPanel from "./ForecastPanel.jsx";
import FaultPanel from "./FaultPanel.jsx";
import { useFaultDetection } from "../hooks/useFaultDetection";

const ION_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlNDgxNjNjYS1kMTY1LTRhOTQtODFiZC1mYWMyNzY4OWVjN2YiLCJpZCI6MzQzOTQwLCJpYXQiOjE3NTg2MzQ0MTR9.pQiAchoUyxCsz38HgMWMnBs4ua7xTKPcbTE2s5EnbK4";
const I3S_URL = "https://tiles-eu1.arcgis.com/XYGfXK4rEYwaj5A0/arcgis/rest/services/Gate_export_20241104_r23_reduced_20241114_notex/SceneServer";
const GEOJSON_URL = "/floorplans/Floorplan_polygon_4326.geojson";
const BUILDING_API_BASE = (import.meta.env.VITE_BUILDING_API_BASE || "http://127.0.0.1:3001").replace(/\/+$/, "");
const POWER_API_BASE = (import.meta.env.VITE_POWER_API_BASE || "http://127.0.0.1:3000").replace(/\/+$/, "");
const REPLAY_WINDOW_HOURS = 48;

const CIRCUIT_CONFIGS = {
  main:             { label: "Main",            color: "#60A5FA" },
  circuit6boiler:   { label: "Boiler",          color: "#F87171" },
  circuit7:         { label: "Circuit 7",       color: "#FBBF24" },
  elevator:         { label: "Elevator",        color: "#A78BFA" },
  circuit8:         { label: "Circuit 8",       color: "#34D399" },
  circuit9:         { label: "Circuit 9",       color: "#22D3EE" },
  circuit10:        { label: "Circuit 10",      color: "#FB923C" },
  circuit11:        { label: "Circuit 11",      color: "#F472B6" },
  circuit12:        { label: "Circuit 12",      color: "#A3E635" },
  airconditioner1:  { label: "Air Cond. 1",     color: "#38BDF8" },
  airconditioner2:  { label: "Air Cond. 2",     color: "#0EA5E9" },
  outsidelighting1: { label: "Outside Light N", color: "#FDE68A" },
  outsidelighting2: { label: "Outside Light S", color: "#FCD34D" },
  vehiclecharging1: { label: "EV Charger 1",    color: "#4ADE80" },
  vehiclecharging2: { label: "EV Charger 2",    color: "#16A34A" },
  "3DLED":          { label: "3D LED Display",  color: "#FF6B9D" },
  ovk:              { label: "OVK",             color: "#E879F9" },
};

const CIRCUIT_CAM = {
  main:             { lon:23.330494, lat:42.673775, h:620,  heading:0,   pitch:-45 },
  circuit6boiler:   { lon:23.330494, lat:42.673775, h:620,  heading:0,   pitch:-45 },
  circuit7:         { lon:23.330494, lat:42.673775, h:620,  heading:0,   pitch:-45 },
  elevator:         { lon:23.330494, lat:42.673775, h:620,  heading:0,   pitch:-45 },
  circuit8:         { lon:23.330600, lat:42.673750, h:615,  heading:0,   pitch:-50 },
  circuit9:         { lon:23.330494, lat:42.673775, h:620,  heading:0,   pitch:-45 },
  circuit10:        { lon:23.330400, lat:42.673700, h:619,  heading:45,  pitch:-50 },
  circuit11:        { lon:23.330494, lat:42.673775, h:620,  heading:0,   pitch:-45 },
  circuit12:        { lon:23.330550, lat:42.673800, h:617,  heading:0,   pitch:-50 },
  airconditioner1:  { lon:23.330700, lat:42.673900, h:625,  heading:180, pitch:-55 },
  airconditioner2:  { lon:23.330700, lat:42.673900, h:625,  heading:180, pitch:-55 },
  outsidelighting1: { lon:23.330450, lat:42.673920, h:610,  heading:180, pitch:-60 },
  outsidelighting2: { lon:23.330450, lat:42.673520, h:610,  heading:0,   pitch:-60 },
  vehiclecharging1: { lon:23.330250, lat:42.673800, h:608,  heading:270, pitch:-65 },
  vehiclecharging2: { lon:23.330750, lat:42.673650, h:608,  heading:90,  pitch:-65 },
  "3DLED":          { lon:23.330350, lat:42.673750, h:608,  heading:270, pitch:-55 },
  ovk:              { lon:23.330494, lat:42.673775, h:620,  heading:0,   pitch:-45 },
};

const HOME_CAMERA = {
  lon:     23.330494,
  lat:     42.672500,
  height:  700,
  heading: Cesium.Math.toRadians(0),
  pitch:   Cesium.Math.toRadians(-40),
  roll:    0,
};

const CAM_PRESETS = {
  overview:     { lon: 23.330494, lat: 42.67280,  h: 450, heading: 0,   pitch: -45 },
  north_facade: { lon: 23.330494, lat: 42.67410,  h: 560, heading: 180, pitch: -20 },
  south_facade: { lon: 23.330494, lat: 42.67340,  h: 560, heading: 0,   pitch: -20 },
  roof:         { lon: 23.330494, lat: 42.673775, h: 580, heading: 0,   pitch: -89 },
  interior_fl0: { lon: 23.330494, lat: 42.673775, h: 610, heading: 0,   pitch: -55 },
  interior_fl1: { lon: 23.330494, lat: 42.673775, h: 613, heading: 0,   pitch: -55 },
  interior_fl2: { lon: 23.330494, lat: 42.673775, h: 616, heading: 0,   pitch: -55 },
  interior_fl3: { lon: 23.330494, lat: 42.673775, h: 619, heading: 0,   pitch: -55 },
  interior_fl4: { lon: 23.330494, lat: 42.673775, h: 622, heading: 0,   pitch: -55 },
};

const ALERT_THRESHOLDS = {
  co2:         { op: "gt", value: 1000, color: "#EF4444" },
  temperature: { op: "gt", value: 26,   color: "#F97316" },
  humidity_lo: { op: "lt", value: 30,   color: "#60A5FA" },
  humidity_hi: { op: "gt", value: 65,   color: "#06B6D4" },
};

// 24h simulated watt readings – realistic bell-curve profiles per circuit
function generateReplayData(circuitId) {
  const profiles = {
    main:             { base: 18000, peak: 42000, peakHour: 10 },
    circuit6boiler:   { base: 3200,  peak: 8500,  peakHour: 7  },
    circuit7:         { base: 400,   peak: 2800,  peakHour: 11 },
    elevator:         { base: 600,   peak: 3200,  peakHour: 9  },
    circuit8:         { base: 2100,  peak: 4800,  peakHour: 14 },
    circuit9:         { base: 1800,  peak: 5200,  peakHour: 10 },
    circuit10:        { base: 2400,  peak: 6100,  peakHour: 13 },
    circuit11:        { base: 1600,  peak: 3900,  peakHour: 10 },
    circuit12:        { base: 900,   peak: 2200,  peakHour: 12 },
    airconditioner1:  { base: 1200,  peak: 7800,  peakHour: 14 },
    airconditioner2:  { base: 1100,  peak: 7200,  peakHour: 15 },
    outsidelighting1: { base: 320,   peak: 640,   peakHour: 20 },
    outsidelighting2: { base: 320,   peak: 640,   peakHour: 20 },
    vehiclecharging1: { base: 0,     peak: 7200,  peakHour: 18 },
    vehiclecharging2: { base: 0,     peak: 7200,  peakHour: 19 },
    "3DLED":          { base: 800,   peak: 2400,  peakHour: 10 },
    ovk:              { base: 3000,  peak: 9000,  peakHour: 8  },
  };
  const p = profiles[circuitId] || { base: 1000, peak: 4000, peakHour: 10 };
  return Array.from({ length: 96 }, (_, i) => {
    const hour = i / 4;
    const nightScale = hour < 6 || hour > 22 ? 0.15 : 1;
    const bell = Math.exp(-0.5 * Math.pow((hour - p.peakHour) / 3, 2));
    const noise = 0.88 + Math.random() * 0.24;
    const watts = Math.round((p.base + (p.peak - p.base) * bell) * nightScale * noise);
    const hh = String(Math.floor(hour)).padStart(2, "0");
    const mm = ["00","15","30","45"][i % 4];
    return { time: `${hh}:${mm}`, hour, watts };
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function normalizeCircuitId(raw) {
  if (raw == null) return "";
  const v = String(raw).trim();
  if (CIRCUIT_CONFIGS[v]) return v;
  const lower   = v.toLowerCase().replace(/\s+/g, "");
  const compact = v.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (CIRCUIT_CONFIGS[lower])   return lower;
  if (CIRCUIT_CONFIGS[compact]) return compact;
  if (compact === "3dled" || compact === "x3dled") return "3DLED";
  const digits = compact.match(/^\d+$/);
  if (digits) { const c = `circuit${digits[0]}`; if (CIRCUIT_CONFIGS[c]) return c; }
  const cm = compact.match(/^circuit(\d+)$/);
  if (cm) { const c = `circuit${cm[1]}`; if (CIRCUIT_CONFIGS[c]) return c; }
  return v;
}

const normStr = (v) => String(v ?? "").toLowerCase().trim().replace(/\s+/g, " ");

function extractRoomNum(value) {
  const text = normStr(value);
  const dm = text.match(/(?:room[-\s]?)?(-?\d+\.\d+)/i);
  if (dm) { const p = dm[1].split("."); return `${parseInt(p[0], 10)}.${p[1].padStart(2, "0")}`; }
  const pm = text.match(/(?:room[-\s]?)?(-?\d+)/i);
  return pm ? pm[1].replace(/^0+(?=\d)/, "") : "";
}

function interpolateColorStops(t, stops) {
  const c = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (c >= a.t && c <= b.t) {
      const f = (c - a.t) / (b.t - a.t);
      return new Cesium.Color((a.r + f*(b.r-a.r))/255,(a.g + f*(b.g-a.g))/255,(a.b + f*(b.b-a.b))/255,0.88);
    }
  }
  const last = stops[stops.length-1];
  return new Cesium.Color(last.r/255, last.g/255, last.b/255, 0.88);
}

const tempToColor     = (v) => interpolateColorStops((v-15)/15,    [{t:0,r:59,g:130,b:246},{t:0.45,r:34,g:197,b:94},{t:0.75,r:251,g:146,b:60},{t:1,r:239,g:68,b:68}]);
const co2ToColor      = (v) => interpolateColorStops((v-400)/800,  [{t:0,r:34,g:197,b:94},{t:0.5,r:250,g:204,b:21},{t:1,r:239,g:68,b:68}]);
const humidityToColor = (v) => interpolateColorStops((v-20)/60,    [{t:0,r:239,g:68,b:68},{t:0.5,r:34,g:197,b:94},{t:1,r:59,g:130,b:246}]);
const occupancyToColor= (v) => interpolateColorStops(v/10,         [{t:0,r:240,g:240,b:240},{t:0.5,r:251,g:146,b:60},{t:1,r:239,g:68,b:68}]);

function metricToColor(metric, value) {
  if (metric === "temperature") return tempToColor(value);
  if (metric === "co2")         return co2ToColor(value);
  if (metric === "humidity")    return humidityToColor(value);
  if (metric === "occupancy")   return occupancyToColor(value);
  return Cesium.Color.fromCssColorString("#4DA3FF").withAlpha(0.72);
}

function evaluateOp(v, op, thr) {
  return op==="gt"?v>thr:op==="lt"?v<thr:op==="gte"?v>=thr:op==="lte"?v<=thr:op==="eq"?v===thr:false;
}

function getRoomColor(roomName) {
  const n = (roomName||"").toUpperCase();
  if (n.includes("WC")||n.includes("TOILET"))   return Cesium.Color.fromCssColorString("#FFFFFF").withAlpha(0.88);
  if (n.includes("STAIRCASE")||n.includes("СТЪЛБА")) return Cesium.Color.fromCssColorString("#7A7A7A").withAlpha(0.92);
  if (n.includes("ELEVATOR")||n.includes("АСАНСЬОР")) return Cesium.Color.fromCssColorString("#5C5C5C").withAlpha(0.92);
  if (n.includes("CORRIDOR")||n.includes("КОРИДОР"))  return Cesium.Color.fromCssColorString("#E8E8E8").withAlpha(0.78);
  if (n.includes("MEETING")||n.includes("CONFERENCE")||n.includes("ЗАЛА")) return Cesium.Color.fromCssColorString("#D4A373").withAlpha(0.85);
  if (n.includes("DIRECTOR")||n.includes("ДИРЕКТОР")) return Cesium.Color.fromCssColorString("#8B4513").withAlpha(0.88);
  if (n.includes("IT")||n.includes("TECHNICAL")||n.includes("ЕЛЕКТР")) return Cesium.Color.fromCssColorString("#B0B0B0").withAlpha(0.85);
  return Cesium.Color.fromCssColorString("#4DA3FF").withAlpha(0.72);
}

function translateRoomName(bg) {
  if (!bg) return "";
  const map = {
    "ЗОНА ЗА ИЗЧАКВАНЕ":"Waiting Zone","КОРИДОР":"Corridor","ИЗСЛЕДОВАТЕЛИ":"Researchers",
    "КАБИНЕТ":"Office","WC ЖЕНИ":"Women's WC","WC МЪЖЕ":"Men's WC",
    "WC за хора в  неравностойно  положение":"Accessible WC","WC за хора в неравностойно положение":"Accessible WC",
    "СТЪЛБА":"Staircase","ЕВАКУАЦИОННА СТЪЛБА":"Emergency Staircase","АСАНСЬОР И ШАХТА":"Elevator Shaft",
    "АСАНСЬОР":"Elevator","АСАНСЬОРНА ШАХТА":"Elevator Shaft","ПОМЕЩЕНИЕ ЕЛ":"Electrical Room",
    "ПОМЕЩЕНИЕ UPS":"UPS Room","ПОМЕЩЕНИЕ":"Room","ТЕХНИЧЕСКА СТАЯ":"Technical Room",
    "ТЕХНОЛОГИЧНА СТАЯ":"Technical Room","СЪРВЪРНО ПОМЕЩЕНИЕ":"Server Room","АБОНАТНА СТАНЦИЯ":"Subscriber Station",
    "ГРТ":"Gas Regulation Station","IT ОТДЕЛ":"IT Department","ОФИС":"Office",
    "БИЗНЕС РАЗВИТИЕ":"Business Development","ГАРДЕРОБ":"Wardrobe","ЧОВЕШКИ РЕСУРСИ":"Human Resources",
    "СЧЕТОВОДИТЕЛ":"Accountant","ДИРЕКТОР":"Director","АСИСТЕНТ":"Assistant","ЗАМ. ДИРЕКТОР":"Deputy Director",
    "ДЕЛОВОДИТЕЛ И ДОМАКИН":"Administrator","РЪКОВОДИТЕЛ НА ИЗСЛЕДОВАТЕЛСКА ГРУПА":"Research Group Leader",
    "ЗАЛА ЗА СРЕЩИ":"Meeting Room","ЗАЛА ЗА КОНФЕРЕНЦИИ":"Conference Hall",
    "ЗАЛА ЗА КОНФЕРЕНТНИ РАЗГОВОРИ":"Conference Room","ЗАЛА ЗА СЕМИНАРНИ СРЕЩИ":"Seminar Room",
    "ЗАЛА ЗА ВИЗУАЛИЗАЦИЯ":"Visualization Hall","ЗАЛА SAP":"SAP Hall",
    "ПРОСТРАНСТВО ЗА ХРАНЕНЕ":"Dining Area","ОТВОРЕНО ПРОСТРАНСТВО ЗА РАБОТА":"Open Work Space",
    "ФОАЙЕ":"Foyer","ФОАЙЕ / ЗОНА ЗА ДИСКУСИИ":"Foyer / Discussion Zone","ВИНДФАНГ":"Vestibule",
    "СТАЯ ЗА ПОЧИВКА":"Break Room","СТОЛОВА":"Cafeteria","КУХНЯ":"Kitchen","СКЛАДОВА БАЗА":"Storage Room",
    "СКЛАД":"Storage","АРХИВ":"Archive","КОПИРНА":"Copy Room","КАСИЕР":"Cashier","РЕЦЕПЦИЯ":"Reception",
    "ЛАБОРАТОРИЯ ЗА ОБУЧЕНИЕ":"Training Laboratory","ЗАЛА":"Hall","САНИТАРЕН ВЪЗЕЛ":"Restroom","БАНЯ":"Bathroom",
    "PR":"PR Officer","ЗОНА ЗА ДИСКУСИИ":"Discussion Zone",
  };
  if (map[bg]) return map[bg];
  const u = bg.toUpperCase();
  for (const [k,v] of Object.entries(map)) if (u.includes(k.toUpperCase())) return v;
  return bg;
}

function getRoomData(roomName) {
  const n = (roomName||"").toUpperCase();
  if (n.includes("WC")||n.includes("TOILET")) return {temp:20,humidity:55,occupancy:0,co2:400};
  if (n.includes("MEETING")||n.includes("CONFERENCE")||n.includes("ЗАЛА")) return {temp:23,humidity:42,occupancy:8,co2:600};
  return {temp:22+Math.floor(Math.random()*3),humidity:40+Math.floor(Math.random()*10),occupancy:Math.floor(Math.random()*4),co2:450+Math.floor(Math.random()*300)};
}

function getRoomCircuitIds(roomNumber, roomName, floorLevel) {
  const n=(roomName||"").toLowerCase(), s=(roomNumber||"").toString();
  const ids=[];
  if (n.includes("elevator")||n.includes("shaft")||n.includes("асансьор")||n.includes("шахта")) ids.push("elevator");
  if (floorLevel===1||n.includes("абонатн")||n.includes("грт")||["14","15","16","006","107","42","68"].includes(s)) ids.push("circuit6boiler");
  if (n.includes("ups")||n.includes("power")||n.includes("ел")||s==="16") ids.push("circuit10");
  if (n.includes("човешки ресурси")||n.includes("human resources")||n.includes("it отдел")||n.includes("it department")||s==="315"||s==="310") ids.push("circuit11");
  if (n.includes("server")||n.includes("сървър")||s==="17") ids.push("circuit8");
  if ((n.includes("склад")||n.includes("storage"))||["-13","22","007","29"].includes(s)) ids.push("circuit12");
  if (floorLevel===1||floorLevel===2) ids.push("airconditioner1");
  if (floorLevel===3||floorLevel===4||floorLevel===5) ids.push("airconditioner2");
  if (n.includes("conference")||n.includes("meeting")||n.includes("конференц")||n.includes("срещ")||n.includes("visualization")||n.includes("sap")||n.includes("зала")||["002","-01","-02","110"].includes(s)) ids.push("circuit7");
  if (n.includes("office")||n.includes("офис")||n.includes("workspace")||n.includes("работ")||n.includes("open")||n.includes("отворен")||n.includes("лаборатория")||n.includes("director")||n.includes("директор")||n.includes("изследовател")||n.includes("кабинет")||n.includes("бизнес")||n.includes("счетоводител")||n.includes("асистент")) ids.push("circuit9");
  ids.push("main");
  return [...new Set(ids)];
}

function geometryToPolygons(geometry, baseElev) {
  if (!geometry) return [];
  const ringToPos = (ring) => ring.map(([lon,lat]) => Cesium.Cartesian3.fromDegrees(lon,lat,baseElev));
  if (geometry.type==="Polygon") { const o=geometry.coordinates?.[0]; if (!Array.isArray(o)||o.length<3) return []; return [ringToPos(o)]; }
  if (geometry.type==="MultiPolygon") return geometry.coordinates.map(p=>p?.[0]).filter(r=>Array.isArray(r)&&r.length>=3).map(ringToPos);
  return [];
}

function getBoundingSphere(entities) {
  const positions=[];
  entities.forEach(e=>{
    if (e.polygon?.hierarchy?.getValue) { const h=e.polygon.hierarchy.getValue(Cesium.JulianDate.now()); if (h?.positions) positions.push(...h.positions); }
    else if (e.position?.getValue) { const p=e.position.getValue(Cesium.JulianDate.now()); if (p) positions.push(p); }
  });
  return positions.length ? Cesium.BoundingSphere.fromPoints(positions) : null;
}

function fmtW(w) { return w>=1000?`${(w/1000).toFixed(1)} kW`:`${w} W`; }

const UI_FONT_STACK = '"Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif';

async function getBuildingJson(path, params = {}) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const directUrl = new URL(`${BUILDING_API_BASE}/${cleanPath}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") directUrl.searchParams.append(key, value);
  });

  try {
    const response = await fetch(directUrl.toString());
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } catch (directError) {
    const fallbackUrl = new URL(`/${cleanPath}`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== "") fallbackUrl.searchParams.append(key, value);
    });
    const fallbackResponse = await fetch(fallbackUrl.toString());
    if (!fallbackResponse.ok) throw directError;
    return fallbackResponse.json();
  }
}

function toReplayRoomKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const asDotted = raw.match(/^(-?\d+)\.(\d+)$/);
  if (asDotted) return `${parseInt(asDotted[1], 10)}.${asDotted[2].padStart(2, "0")}`;

  const compact3 = raw.match(/^(-?\d)(\d{2})$/);
  if (compact3) return `${compact3[1]}.${compact3[2]}`;

  const extracted = extractRoomNum(raw);
  const extractedCompact3 = extracted.match(/^(-?\d)(\d{2})$/);
  if (extractedCompact3) return `${extractedCompact3[1]}.${extractedCompact3[2]}`;

  return extracted || raw;
}

function formatReplayTimeFromTimestamp(timestampMs) {
  if (!Number.isFinite(timestampMs)) return "--:--";
  const date = new Date(timestampMs);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function bucketQuarterHour(timestampMs) {
  const bucketSize = 15 * 60 * 1000;
  return Math.floor(timestampMs / bucketSize) * bucketSize;
}

function buildClimateReplayFrames(history) {
  const metricMap = { temp: "temperature", humidity: "humidity", co2: "co2" };
  const buckets = new Map();

  Object.entries(metricMap).forEach(([historyKey, metricKey]) => {
    const points = Array.isArray(history?.[historyKey]) ? history[historyKey] : [];
    points.forEach((point) => {
      const ts = Number(point?.t);
      const value = Number(point?.v);
      if (!Number.isFinite(ts) || !Number.isFinite(value)) return;
      const bucket = bucketQuarterHour(ts);
      const existing = buckets.get(bucket) || { timestampMs: bucket };
      existing[metricKey] = value;
      buckets.set(bucket, existing);
    });
  });

  const sorted = [...buckets.values()]
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .slice(-96);

  let lastTemperature = null;
  let lastHumidity = null;
  let lastCo2 = null;

  return sorted
    .map((sample) => {
      if (Number.isFinite(sample.temperature)) lastTemperature = sample.temperature;
      if (Number.isFinite(sample.humidity)) lastHumidity = sample.humidity;
      if (Number.isFinite(sample.co2)) lastCo2 = sample.co2;
      return {
        timestampMs: sample.timestampMs,
        time: formatReplayTimeFromTimestamp(sample.timestampMs),
        hour: new Date(sample.timestampMs).getHours() + new Date(sample.timestampMs).getMinutes() / 60,
        temperature: lastTemperature,
        humidity: lastHumidity,
        co2: lastCo2,
      };
    })
    .filter((sample) => sample.temperature != null || sample.humidity != null || sample.co2 != null);
}

function buildEnergyReplayData(rows) {
  const allCircuitIds = Object.keys(CIRCUIT_CONFIGS);
  const bucketed = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const circuitId = normalizeCircuitId(row?.circuit_id);
    const timestampMs = new Date(row?.ts_5min).getTime();
    const watts = Number(row?.value);
    if (!circuitId || !CIRCUIT_CONFIGS[circuitId] || !Number.isFinite(timestampMs) || !Number.isFinite(watts)) return;
    const bucket = bucketQuarterHour(timestampMs);
    const entry = bucketed.get(bucket) || { timestampMs: bucket, values: {} };
    entry.values[circuitId] = watts;
    bucketed.set(bucket, entry);
  });

  const timeline = [...bucketed.values()].sort((a, b) => a.timestampMs - b.timestampMs).slice(-96);
  const byCircuit = Object.fromEntries(allCircuitIds.map((id) => [id, []]));
  const lastByCircuit = Object.fromEntries(allCircuitIds.map((id) => [id, 0]));

  timeline.forEach((frame) => {
    allCircuitIds.forEach((circuitId) => {
      const raw = frame.values[circuitId];
      if (Number.isFinite(raw)) lastByCircuit[circuitId] = raw;
      byCircuit[circuitId].push({
        timestampMs: frame.timestampMs,
        time: formatReplayTimeFromTimestamp(frame.timestampMs),
        hour: new Date(frame.timestampMs).getHours() + new Date(frame.timestampMs).getMinutes() / 60,
        watts: lastByCircuit[circuitId] ?? 0,
      });
    });
  });

  return byCircuit;
}

function fmtClimate(metric, value) {
  if (metric === "temperature") return `${value.toFixed(1)} C`;
  if (metric === "humidity") return `${Math.round(value)} %`;
  if (metric === "co2") return `${Math.round(value)} ppm`;
  return `${value}`;
}

function metricLabel(metric) {
  if (metric === "temperature") return "Temperature";
  if (metric === "humidity") return "Humidity";
  if (metric === "co2") return "CO2";
  return metric;
}

function stableHash(text) {
  const str = String(text ?? "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function generateRoomClimateReplay(roomSeed, base) {
  const seed = stableHash(roomSeed);
  const phase = (seed % 360) * (Math.PI / 180);
  const micro = ((seed % 19) - 9) / 9;
  const baseTemp = Number(base?.temperature ?? 22);
  const baseHumidity = Number(base?.humidity ?? 45);
  const baseCo2 = Number(base?.co2 ?? 500);
  return Array.from({ length: 96 }, (_, i) => {
    const hour = i / 4;
    const dayT = Math.sin(((hour - 6) / 24) * Math.PI * 2 + phase);
    const officeT = Math.sin(((hour - 8) / 12) * Math.PI) > 0 ? Math.sin(((hour - 8) / 12) * Math.PI) : 0;
    const temperature = baseTemp + dayT * 1.8 + officeT * 1.2 + micro * 0.45;
    const humidity = Math.max(20, Math.min(80, baseHumidity - dayT * 5 + officeT * 3 + micro * 2.2));
    const co2 = Math.max(380, baseCo2 + officeT * 480 + (dayT + 1) * 35 + micro * 25);
    const hh = String(Math.floor(hour)).padStart(2, "0");
    const mm = ["00", "15", "30", "45"][i % 4];
    return { time: `${hh}:${mm}`, hour, temperature, humidity, co2 };
  });
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function CesiumGeoJsonViewer({ onFeatureClick }) {
  const containerRef = useRef(null);
  const viewerRef    = useRef(null);
  const i3sRef       = useRef(null);
  const roomEntitiesRef    = useRef([]);
  const circuitEntitiesRef = useRef([]);
  const flowEntitiesRef    = useRef([]);
  const energyFlowEnabledRef = useRef(true);
  const sensorEntitiesRef  = useRef([]);
  const homeDestRef        = useRef(null);
  const floorsRef          = useRef([]);
  const timeWindowRef      = useRef({start:null,end:null});
  const circuitCentroidsRef = useRef({});
  const pvDataRef          = useRef({});
  const animFramesRef      = useRef([]);
  const animIntervalRef    = useRef(null);
  const activeHeatmapRef   = useRef(null);
  const hoverHandlerRef    = useRef(null);
  const liveFrameDataRef   = useRef(new Map()); // Map<roomNumber, {temperature,humidity,co2,occupancy}>
  const replayRafRef       = useRef(null);
  const replayDataRef      = useRef({});
  const replayPlayingRef   = useRef(false);
  const replayFrameRef     = useRef(0);
  const replaySpeedRef     = useRef(1);
  const climateReplayTimerRef    = useRef(null);
  const climateReplayDataRef     = useRef({});
  const climateReplayPlayingRef  = useRef(false);
  const climateReplayFrameRef    = useRef(0);
  const climateReplaySpeedRef    = useRef(1);

  const [loading,         setLoading]         = useState(true);
  const [i3sAvailable,    setI3sAvailable]    = useState(true);
  const [showControls,    setShowControls]     = useState(true);
  const [availableFloors, setAvailableFloors]  = useState([]);
  const [availableRooms,  setAvailableRooms]   = useState([]);
  const [selectedRoom,    setSelectedRoom]     = useState("");
  const [selectedCircuit, setSelectedCircuit]  = useState("");
  const [searchQuery,     setSearchQuery]      = useState("");
  const [activeHeatmap,   setActiveHeatmap]    = useState(null);
  const [activeMode,      setActiveMode]       = useState("default");
  const [replayOpen,      setReplayOpen]       = useState(false);
  const [replayMode,      setReplayMode]       = useState("energy");
  const [replayCircuit,   setReplayCircuit]    = useState("main");
  const [replayPlaying,   setReplayPlaying]    = useState(false);
  const [replayFrame,     setReplayFrame]      = useState(0);
  const [replaySpeed,     setReplaySpeed]      = useState(1);
  const [climateReplayRoom,    setClimateReplayRoom]    = useState("");
  const [climateReplayMetric,  setClimateReplayMetric]  = useState("temperature");
  const [climateApplyToBuilding,setClimateApplyToBuilding]= useState(false);
  const [climateReplayPlaying, setClimateReplayPlaying] = useState(false);
  const [climateReplayFrame,   setClimateReplayFrame]   = useState(0);
  const [climateReplaySpeed,   setClimateReplaySpeed]   = useState(1);
  const [compareRoom,          setCompareRoom]          = useState("");
  const [compareCircuit,       setCompareCircuit]       = useState("main");
  const [compareLag,           setCompareLag]           = useState(0);
  const [comparePair,          setComparePair]          = useState("energy_vs_temp");
  const [occupancyMode,        setOccupancyMode]        = useState("auto");
  const [compareDataTick,      setCompareDataTick]      = useState(0); // bumped to re-render after async data load

  const [outsideTempSeries, setOutsideTempSeries] = useState([]); // [{hour, temp}] 48-h hourly outside temp
  const outsideTempRef = useRef([]);

  const { faults, summary: faultSummary, faultHistory, clearHistory } = useFaultDetection({
    replayDataRef,
    pvDataRef,
    climateReplayDataRef,
    currentFrame: replayFrame,
    outsideTempRef,
    tariff:       tariffRate || 0.22,
    demandCharge: 8.50,
    enabled:      !loading,
  });

  const [scenarioGoal,      setScenarioGoal]      = useState(null);
  const [appliedScenarios,  setAppliedScenarios]  = useState([]);
  const [scenarioResult,    setScenarioResult]    = useState(null);
  const [tariffRate,        setTariffRate]        = useState(0.22);
  const [occupancyLevel,    setOccupancyLevel]    = useState(100);
  const [carbonPrice,       setCarbonPrice]       = useState(25);
  const [showRolePanel,     setShowRolePanel]     = useState(false);
  const [activeRole,        setActiveRole]        = useState(null);
  const [expertMode,        setExpertMode]        = useState(false);
  const [energyFlowEnabled, setEnergyFlowEnabled] = useState(true);
  const [faultPanelOpen,    setFaultPanelOpen]    = useState(false);

  // ── Heatmap animation + overlays ───────────────────────────────────────────
  const [animFrame,        setAnimFrame]        = useState(0);
  const [animPlaying,      setAnimPlaying]      = useState(false);
  const [animReady,        setAnimReady]        = useState(false);
  const [hoveredRoom,      setHoveredRoom]      = useState(null);
  const [buildingSummary,  setBuildingSummary]  = useState(null);

  // On mount: always show role picker (no persistence)
  useEffect(()=>{
    localStorage.removeItem("dtwin_role");
    if(localStorage.getItem("dtwin_expert")==="1") setExpertMode(true);
    else setShowRolePanel(true);
  },[]);

  useEffect(()=>{ activeHeatmapRef.current = activeHeatmap; },[activeHeatmap]);

  // In role-first mode: show role panel automatically when a role is active
  const rolePanelVisible = expertMode ? showRolePanel : (showRolePanel && !loading);
  // In role-first mode: hide original control panels unless expert mode is on
  const showOriginalPanels = expertMode;
  // Replay panel is ALWAYS available regardless of role
  const replayAvailable = !loading;

  // ─── ENTITY UTILS ────────────────────────────────────────────────────────

  const resetStyles = useCallback(()=>{
    [...roomEntitiesRef.current,...circuitEntitiesRef.current].forEach(e=>{
      if(e.polygon&&e.originalMaterial){e.polygon.material=e.originalMaterial;e.polygon.outlineColor=Cesium.Color.BLACK.withAlpha(0.85);e.polygon.outlineWidth=2;}
      if(e.box&&e.originalMaterial) e.box.material=e.originalMaterial;
      if(e.cylinder&&e.originalMaterial) e.cylinder.material=e.originalMaterial;
      if(e.ellipsoid&&e.originalMaterial) e.ellipsoid.material=e.originalMaterial;
      if(e.labelEntity) e.labelEntity.show=false;
    });
    setActiveHeatmap(null);
    activeHeatmapRef.current = null;
    setBuildingSummary(null);
    setHoveredRoom(null);
    setAnimPlaying(false);
  },[]);

  const showOnly = useCallback((pred)=>{
    [...roomEntitiesRef.current,...circuitEntitiesRef.current].forEach(e=>{e.show=pred(e);if(e.labelEntity) e.labelEntity.show=false;});
  },[]);

  const zoomToEntities = useCallback((entities,mult=2.5,min=25)=>{
    const viewer=viewerRef.current;
    if(!viewer||!entities.length) return;
    const sphere=getBoundingSphere(entities);
    if(!sphere) return;
    viewer.camera.flyToBoundingSphere(sphere,{duration:1.5,offset:new Cesium.HeadingPitchRange(0,Cesium.Math.toRadians(-45),Math.max(sphere.radius*mult,min))});
  },[]);

  // ─── CIRCUIT CENTROIDS FROM GeoJSON GEOMETRY ─────────────────────────────
  // Each circuit centroid is the average position of all room polygon centers
  // that belong to that circuit — derived purely from the loaded entities.

  const computeCircuitCentroids = useCallback(()=>{
    const buckets={};
    roomEntitiesRef.current.forEach(entity=>{
      const circuits=entity.properties?.circuit_id?.getValue?.();
      if(!circuits) return;
      const ids=Array.isArray(circuits)?circuits:[circuits];
      ids.forEach(raw=>{
        const id=normalizeCircuitId(raw);
        if(!id) return;
        const sphere=getBoundingSphere([entity]);
        if(!sphere) return;
        if(!buckets[id]) buckets[id]=[];
        buckets[id].push(sphere.center);
      });
    });

    const centroids={};
    Object.entries(buckets).forEach(([id,positions])=>{
      if(!positions.length) return;
      let x=0,y=0,z=0;
      positions.forEach(p=>{x+=p.x;y+=p.y;z+=p.z;});
      const avg=new Cesium.Cartesian3(x/positions.length,y/positions.length,z/positions.length);
      const carto=Cesium.Cartographic.fromCartesian(avg);
      carto.height+=6;
      centroids[id]=Cesium.Cartesian3.fromRadians(carto.longitude,carto.latitude,carto.height);
    });

    // Main hub = centroid of all rooms, pushed higher
    const all=roomEntitiesRef.current.map(e=>getBoundingSphere([e])?.center).filter(Boolean);
    if(all.length){
      let x=0,y=0,z=0;
      all.forEach(p=>{x+=p.x;y+=p.y;z+=p.z;});
      const avg=new Cesium.Cartesian3(x/all.length,y/all.length,z/all.length);
      const carto=Cesium.Cartographic.fromCartesian(avg);
      carto.height+=14;
      centroids["main"]=Cesium.Cartesian3.fromRadians(carto.longitude,carto.latitude,carto.height);
    }
    circuitCentroidsRef.current=centroids;
  },[]);

  // ─── ENERGY FLOW (geometry-derived lines) ────────────────────────────────

  const hideEnergyFlow = useCallback(()=>{
    const viewer=viewerRef.current; if(!viewer) return;
    flowEntitiesRef.current.forEach(e=>{try{viewer.entities.remove(e);}catch(_){}});
    flowEntitiesRef.current=[];
  },[]);

  const showEnergyFlow = useCallback((circuitId,frameData=null)=>{
    const viewer=viewerRef.current; if(!viewer) return;
    hideEnergyFlow();
    computeCircuitCentroids();
    const centroids=circuitCentroidsRef.current;
    const mainPos=centroids["main"]; if(!mainPos) return;

    const targets=circuitId?[normalizeCircuitId(circuitId)]:Object.keys(CIRCUIT_CONFIGS).filter(k=>k!=="main");

    targets.forEach(id=>{
      const targetPos=centroids[id];
      if(!targetPos||id==="main") return;
      const cfg=CIRCUIT_CONFIGS[id];
      const lineColor=Cesium.Color.fromCssColorString(cfg?.color||"#22C55E");
      const watts=frameData?.[id]??null;
      const glowPow=watts!=null?Math.min(0.12+(watts/50000),0.9):0.28;
      const lineW=watts!=null?Math.min(2+(watts/8000),8):3;

      flowEntitiesRef.current.push(viewer.entities.add({
        polyline:{
          positions:[mainPos,targetPos],width:lineW,
          material:new Cesium.PolylineGlowMaterialProperty({glowPower:glowPow,color:lineColor}),
          clampToGround:false,
        },
      }));
      flowEntitiesRef.current.push(viewer.entities.add({
        position:targetPos,
        ellipsoid:{radii:new Cesium.Cartesian3(1.8,1.8,1.8),material:lineColor.withAlpha(0.9)},
        label:{
          text:watts!=null?`${cfg?.label||id}\n${fmtW(watts)}`:(cfg?.label||id),
          font:"700 13px 'Courier New',monospace",fillColor:Cesium.Color.WHITE,outlineColor:Cesium.Color.BLACK,outlineWidth:3,
          style:Cesium.LabelStyle.FILL_AND_OUTLINE,verticalOrigin:Cesium.VerticalOrigin.BOTTOM,
          pixelOffset:new Cesium.Cartesian2(0,-16),disableDepthTestDistance:Number.POSITIVE_INFINITY,
          showBackground:true,backgroundColor:Cesium.Color.BLACK.withAlpha(0.84),backgroundPadding:new Cesium.Cartesian2(8,6),
        },
      }));
    });

    const mainWatts=frameData?.["main"]??null;
    flowEntitiesRef.current.push(viewer.entities.add({
      position:mainPos,
      ellipsoid:{radii:new Cesium.Cartesian3(3,3,3),material:Cesium.Color.fromCssColorString(CIRCUIT_CONFIGS.main.color).withAlpha(0.95)},
      label:{
        text:mainWatts!=null?`MAIN\n${fmtW(mainWatts)}`:"MAIN",
        font:"700 15px 'Courier New',monospace",fillColor:Cesium.Color.WHITE,outlineColor:Cesium.Color.BLACK,outlineWidth:3,
        style:Cesium.LabelStyle.FILL_AND_OUTLINE,verticalOrigin:Cesium.VerticalOrigin.BOTTOM,
        pixelOffset:new Cesium.Cartesian2(0,-18),disableDepthTestDistance:Number.POSITIVE_INFINITY,
        showBackground:true,backgroundColor:Cesium.Color.BLACK.withAlpha(0.86),backgroundPadding:new Cesium.Cartesian2(10,7),
      },
    }));
  },[computeCircuitCentroids,hideEnergyFlow]);

  // ─── REPLAY ───────────────────────────────────────────────────────────────

  const stopReplay = useCallback(()=>{
    if(replayRafRef.current) clearTimeout(replayRafRef.current);
    replayRafRef.current=null; replayPlayingRef.current=false; setReplayPlaying(false);
  },[]);

  const toggleEnergyFlow = useCallback(()=>{
    const next=!energyFlowEnabledRef.current;
    setEnergyFlowEnabled(next);
    energyFlowEnabledRef.current=next;
    if(!next) {
      hideEnergyFlow();
      return;
    }
    const allData=replayDataRef.current;
    const circuits=Object.keys(allData);
    if(circuits.length){
      const frameData={};
      circuits.forEach(id=>{frameData[id]=allData[id][replayFrame]?.watts??0;});
      showEnergyFlow(null,frameData);
      return;
    }
    showEnergyFlow(null);
  },[hideEnergyFlow,replayFrame,showEnergyFlow]);

  const loadEnergyReplayData = useCallback(async()=>{
    if(Object.keys(replayDataRef.current).some((id)=>Array.isArray(replayDataRef.current[id])&&replayDataRef.current[id].length)) {
      return replayDataRef.current;
    }

    const fallbackEnergyData = Object.fromEntries(
      Object.keys(CIRCUIT_CONFIGS).map((id)=>[id, generateReplayData(id)])
    );

    const latestRows = await getPowerJson("power_5min", {
      select: "ts_5min",
      order: "ts_5min.desc",
      limit: 1,
    }).catch((error)=>{
      console.warn("Failed to read latest energy timestamp from Postgres:", error);
      return [];
    });
    const latestTs = Array.isArray(latestRows) && latestRows.length ? new Date(latestRows[0]?.ts_5min).getTime() : NaN;
    if(!Number.isFinite(latestTs)) {
      replayDataRef.current = fallbackEnergyData;
      return fallbackEnergyData;
    }
    const fromIso = new Date(latestTs - REPLAY_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const toIso = new Date(latestTs).toISOString();
    // Build circuit_id list: 3DLED is stored as x3dled in the DB
    const dbCircuitIds = Object.keys(CIRCUIT_CONFIGS).map((id) => id === "3DLED" ? "x3dled" : id);
    // ovk is already correctly named in the DB
    const rows = await getPowerJson("power_5min", {
      select: "ts_5min,value,circuit_id",
      circuit_id: `in.(${dbCircuitIds.join(",")})`,
      and: `(ts_5min.gte.${fromIso},ts_5min.lte.${toIso})`,
      order: "ts_5min.asc",
      limit: 20000,
    }).catch((error)=>{
      console.warn("Failed to load circuit replay data from Postgres:", error);
      return [];
    });

    const replayData = buildEnergyReplayData(rows);
    // Per-circuit fallback: use synthetic data for any circuit that came back empty from DB
    const mergedData = Object.fromEntries(
      Object.keys(CIRCUIT_CONFIGS).map((id) => [
        id,
        replayData[id]?.length ? replayData[id] : fallbackEnergyData[id],
      ])
    );
    replayDataRef.current = mergedData;
    return replayDataRef.current;
  },[]);

  const loadOutsideTemperature = useCallback(async () => {
    try {
      // Find latest available record
      const latestRows = await getPowerJson("temperature_data", {
        select: "timestamp",
        order: "timestamp.desc",
        limit: 1,
      });
      const latestTs = Array.isArray(latestRows) && latestRows.length
        ? new Date(latestRows[0].timestamp).getTime() : NaN;
      if (!Number.isFinite(latestTs)) return;
      const fromIso = new Date(latestTs - 48 * 3600 * 1000).toISOString();
      const toIso   = new Date(latestTs).toISOString();
      const rows = await getPowerJson("temperature_data", {
        and: `(timestamp.gte.${fromIso},timestamp.lte.${toIso})`,
        order: "timestamp.asc",
        limit: 200,
      });
      if (!Array.isArray(rows) || !rows.length) return;
      const series = rows.map((r) => ({
        timestampMs: new Date(r.timestamp).getTime(),
        hour: new Date(r.timestamp).getHours() + new Date(r.timestamp).getMinutes() / 60,
        temp: Number(r.temp_mean),
      }));
      outsideTempRef.current = series;
      setOutsideTempSeries(series);
    } catch (e) {
      console.warn("Failed to load outside temperature:", e);
    }
  }, []);

  const tickReplay = useCallback(()=>{
    if(!replayPlayingRef.current) return;
    const allData=replayDataRef.current;
    const circuits=Object.keys(allData);
    if(!circuits.length) return;
    const totalFrames=allData[circuits[0]]?.length||96;
    let frame=(replayFrameRef.current+1)%totalFrames;
    replayFrameRef.current=frame; setReplayFrame(frame);
    const frameData={};
    circuits.forEach(id=>{ frameData[id]=allData[id][frame]?.watts??0; });
    if(energyFlowEnabledRef.current) showEnergyFlow(null,frameData);
    replayRafRef.current=setTimeout(tickReplay,500/replaySpeedRef.current);
  },[showEnergyFlow]);

  const startReplay = useCallback(async()=>{
    stopReplay();
    const data = await loadEnergyReplayData();
    const firstCircuit = Object.keys(CIRCUIT_CONFIGS).find((id)=>data[id]?.length) || "main";
    if(!data[firstCircuit]?.length) return;
    replayFrameRef.current=0; setReplayFrame(0);
    if(i3sRef.current) i3sRef.current.show=false;
    resetStyles();
    roomEntitiesRef.current.forEach(e=>{e.show=true;});
    replayPlayingRef.current=true; setReplayPlaying(true);
    replayRafRef.current=setTimeout(tickReplay,0);
  },[stopReplay,loadEnergyReplayData,tickReplay,resetStyles]);

  const seekReplay = useCallback((frame)=>{
    replayFrameRef.current=frame; setReplayFrame(frame);
    const allData=replayDataRef.current;
    const circuits=Object.keys(allData);
    if(!circuits.length) return;
    const frameData={};
    circuits.forEach(id=>{ frameData[id]=allData[id][frame]?.watts??0; });
    if(energyFlowEnabledRef.current) showEnergyFlow(null,frameData);
  },[showEnergyFlow]);

  const changeSpeed = useCallback((s)=>{ replaySpeedRef.current=s; setReplaySpeed(s); },[]);

  // ─── ROOM CLIMATE REPLAY ───────────────────────────────────────────────

  const stopClimateReplay = useCallback(()=>{
    if(climateReplayTimerRef.current) clearTimeout(climateReplayTimerRef.current);
    climateReplayTimerRef.current=null;
    climateReplayPlayingRef.current=false;
    setClimateReplayPlaying(false);
  },[]);

  const applyClimateFrame = useCallback((frame, metric=climateReplayMetric, targetRoom=climateReplayRoom, scope="room")=>{
    const data=climateReplayDataRef.current;
    if(!Object.keys(data).length) return;
    if(i3sRef.current) i3sRef.current.show=false;
    hideEnergyFlow();
    const focusRoom=toReplayRoomKey(targetRoom);
    const showWholeBuilding=scope==="building";
    const focusSingleRoom=Boolean(!showWholeBuilding&&focusRoom&&data[focusRoom]);
    roomEntitiesRef.current.forEach(e=>{
      const rn=e.properties?.roomNumber?.getValue?.();
      const roomKey=toReplayRoomKey(rn);
      const sample=data[roomKey]?.[frame];
      const matchesFocus=!focusSingleRoom||roomKey===focusRoom;
      e.show=showWholeBuilding?Boolean(sample):matchesFocus;
      if(!e.show){
        if(e.labelEntity) e.labelEntity.show=false;
        return;
      }
      if(!sample) return;
      const v=Number(sample[metric]??0);
      if(e.polygon) {
        const color=metricToColor(metric,v);
        e.polygon.material=color;
        e.polygon.outlineColor=color.brighten(0.15,new Cesium.Color());
        e.polygon.outlineWidth=focusRoom&&roomKey===focusRoom?5:showWholeBuilding?2.5:3;
      }
      if(e.labelEntity&&roomKey===focusRoom){
        const temp=fmtClimate("temperature",Number(sample.temperature));
        const hum=fmtClimate("humidity",Number(sample.humidity));
        const co2=fmtClimate("co2",Number(sample.co2));
        e.labelEntity.label.text=`${e.properties.roomName?.getValue?.()||"Room"}\n${rn} @ ${sample.time}\nT ${temp} | H ${hum} | CO2 ${co2}`;
        e.labelEntity.label.font="700 13px 'Courier New',monospace";
        e.labelEntity.label.outlineWidth=3;
        e.labelEntity.label.backgroundColor=Cesium.Color.BLACK.withAlpha(0.88);
        e.labelEntity.show=true;
      } else if(e.labelEntity){
        e.labelEntity.show=false;
      }
    });
    circuitEntitiesRef.current.forEach(e=>{e.show=false;});
  },[climateReplayMetric,climateReplayRoom,hideEnergyFlow]);

  const tickClimateReplay = useCallback(()=>{
    if(!climateReplayPlayingRef.current) return;
    const allData=climateReplayDataRef.current;
    const rooms=Object.keys(allData);
    if(!rooms.length) return;
    const activeRoomKey=toReplayRoomKey(climateReplayRoom);
    const totalFrames=allData[activeRoomKey]?.length||allData[rooms[0]]?.length||96;
    const frame=(climateReplayFrameRef.current+1)%totalFrames;
    climateReplayFrameRef.current=frame;
    setClimateReplayFrame(frame);
    applyClimateFrame(frame,climateReplayMetric,climateReplayRoom,climateApplyToBuilding?"building":"room");
    climateReplayTimerRef.current=setTimeout(tickClimateReplay,550/climateReplaySpeedRef.current);
  },[applyClimateFrame,climateApplyToBuilding,climateReplayMetric,climateReplayRoom]);

  const ensureClimateReplayData = useCallback(async(roomNumber)=>{
    const roomKey = toReplayRoomKey(roomNumber);
    if(!roomKey) return [];
    if(Array.isArray(climateReplayDataRef.current[roomKey]) && climateReplayDataRef.current[roomKey].length) {
      return climateReplayDataRef.current[roomKey];
    }

    const firstEntity = roomEntitiesRef.current.find((e)=>toReplayRoomKey(e.properties?.roomNumber?.getValue?.())===roomKey);
    const syntheticBase = {
      temperature: Number(firstEntity?.properties?.temperature?.getValue?.() ?? 22),
      humidity: Number(firstEntity?.properties?.humidity?.getValue?.() ?? 45),
      co2: Number(firstEntity?.properties?.co2?.getValue?.() ?? 500),
    };

    const latest = await fetchLatestRoomTelemetry(roomKey).catch(()=>({ timestampMs: null }));
    const endIso = Number.isFinite(latest?.timestampMs) ? new Date(latest.timestampMs).toISOString() : null;
    const history = await fetchRoomHistory(roomKey, 2, endIso).catch((error)=>{
      console.warn(`Failed to load room history for ${roomKey}:`, error);
      return { temp: [], humidity: [], co2: [] };
    });
    const framesFromDb = buildClimateReplayFrames(history);
    const frames = framesFromDb.length ? framesFromDb : generateRoomClimateReplay(roomKey, syntheticBase);
    climateReplayDataRef.current = {
      ...climateReplayDataRef.current,
      [roomKey]: frames,
    };
    return frames;
  },[]);

  const ensureAllClimateReplayData = useCallback(async()=>{
    const roomKeys=[...new Set(
      availableRooms
        .map((room)=>toReplayRoomKey(room.roomNumber))
        .filter((roomKey)=>roomKey&&ROOM_BMS_ENDPOINTS[roomKey])
    )];
    if(!roomKeys.length) return climateReplayDataRef.current;
    await Promise.all(roomKeys.map((roomKey)=>ensureClimateReplayData(roomKey)));
    return climateReplayDataRef.current;
  },[availableRooms,ensureClimateReplayData]);

  const focusClimateRoom = useCallback((roomNumber)=>{
    const rawRoom = String(roomNumber ?? "").trim();
    const roomId=toReplayRoomKey(rawRoom);
    if(!roomId) return false;

    // Prefer exact room-number matches first to avoid collapsing multiple rooms
    // that normalize to the same key (e.g., 110 and 1.10).
    let matches=roomEntitiesRef.current.filter((e)=>{
      const rn = String(e.properties?.roomNumber?.getValue?.() ?? "").trim();
      return rn && rawRoom && rn === rawRoom;
    });

    if(!matches.length){
      matches=roomEntitiesRef.current.filter(e=>toReplayRoomKey(e.properties?.roomNumber?.getValue?.())===roomId);
    }

    if(!matches.length) return false;
    setSelectedRoom(matches[0].properties?.roomNumber?.getValue?.() ?? roomId);
    if(i3sRef.current) i3sRef.current.show=false;
    zoomToEntities(matches,matches.length>1?2.8:4,15);
    return true;
  },[zoomToEntities]);

  const startClimateReplay = useCallback(async()=>{
    stopReplay();
    stopClimateReplay();
    const roomKey = toReplayRoomKey(climateReplayRoom);
    if(!roomKey) return;
    const frames = await ensureClimateReplayData(roomKey);
    if(!frames.length) return;
    climateReplayFrameRef.current=0;
    setClimateReplayFrame(0);
    climateReplayPlayingRef.current=true;
    setClimateReplayPlaying(true);
    resetStyles();
    focusClimateRoom(climateReplayRoom || roomKey);
    applyClimateFrame(0,climateReplayMetric,climateReplayRoom || roomKey,climateApplyToBuilding?"building":"room");
    climateReplayTimerRef.current=setTimeout(tickClimateReplay,0);
  },[stopReplay,stopClimateReplay,ensureClimateReplayData,resetStyles,applyClimateFrame,climateApplyToBuilding,climateReplayMetric,climateReplayRoom,tickClimateReplay,focusClimateRoom]);

  const seekClimateReplay = useCallback(async(frame)=>{
    const roomKey=toReplayRoomKey(climateReplayRoom);
    await ensureClimateReplayData(roomKey);
    climateReplayFrameRef.current=frame;
    setClimateReplayFrame(frame);
    applyClimateFrame(frame,climateReplayMetric,climateReplayRoom,climateApplyToBuilding?"building":"room");
  },[ensureClimateReplayData,applyClimateFrame,climateApplyToBuilding,climateReplayMetric,climateReplayRoom]);

  const changeClimateSpeed = useCallback((s)=>{
    climateReplaySpeedRef.current=s;
    setClimateReplaySpeed(s);
  },[]);

  const hydrateLatestRoomTelemetry = useCallback(async()=>{
    const roomKeys=[...new Set(roomEntitiesRef.current.map((e)=>toReplayRoomKey(e.properties?.roomNumber?.getValue?.())).filter(Boolean))];
    if(!roomKeys.length) return;

    const telemetryEntries = await Promise.all(roomKeys.map(async(roomKey)=>[
      roomKey,
      await fetchLatestRoomTelemetry(roomKey).catch((error)=>{
        console.warn(`Failed to load latest telemetry for ${roomKey}:`, error);
        return { temperature: null, humidity: null, co2: null };
      }),
    ]));
    const telemetryByRoom=Object.fromEntries(telemetryEntries);

    roomEntitiesRef.current.forEach((entity)=>{
      const roomKey=toReplayRoomKey(entity.properties?.roomNumber?.getValue?.());
      const telemetry=telemetryByRoom[roomKey];
      if(!telemetry) return;
      if(Number.isFinite(telemetry.temperature)) entity.properties.temperature = new Cesium.ConstantProperty(telemetry.temperature);
      if(Number.isFinite(telemetry.humidity)) entity.properties.humidity = new Cesium.ConstantProperty(telemetry.humidity);
      if(Number.isFinite(telemetry.co2)) entity.properties.co2 = new Cesium.ConstantProperty(telemetry.co2);
    });
  },[]);

  // ─── HEATMAP ─────────────────────────────────────────────────────────────

  const applyHeatmapColors = useCallback((metric)=>{
    if(!metric) return;
    const live=liveFrameDataRef.current;
    roomEntitiesRef.current.forEach(entity=>{
      if(!entity.show) return;
      const rn=entity.properties?.roomNumber?.getValue?.();
      const liveVal=live.get(rn)?.[metric];
      const fallback=entity.properties?.[metric]?.getValue?.();
      const value=liveVal??fallback;
      if(value!=null&&entity.polygon){
        entity.polygon.material=metricToColor(metric,Number(value));
        entity.polygon.outlineColor=Cesium.Color.BLACK.withAlpha(0.5);
        entity.polygon.outlineWidth=1;
      }
    });
  },[]);

  const computeBuildingSummary = useCallback((metric)=>{
    if(!metric){setBuildingSummary(null);return;}
    const UNITS={temperature:"°C",co2:" ppm",humidity:"%",occupancy:""};
    const unit=UNITS[metric]??"";
    const live=liveFrameDataRef.current;
    const seen=new Set();const vals=[];const byRoom=[];
    roomEntitiesRef.current.forEach(e=>{
      if(!e.show) return;
      const rn=e.properties?.roomNumber?.getValue?.();
      if(seen.has(rn)) return;
      seen.add(rn);
      const liveVal=live.get(rn)?.[metric];
      const fallback=e.properties?.[metric]?.getValue?.();
      const raw=liveVal??fallback;
      if(raw==null) return;
      const v=Number(raw);
      vals.push(v);
      byRoom.push({rn,name:e.properties?.roomName?.getValue?.()??rn,floor:e.properties?.floorLevel?.getValue?.()??"-",v});
    });
    if(!vals.length){setBuildingSummary(null);return;}
    const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    const sorted=[...byRoom].sort((a,b)=>a.v-b.v);
    const worst=sorted[sorted.length-1];
    const best=sorted[0];
    let alertCount=0;
    if(metric==="temperature") alertCount=vals.filter(v=>v>26).length;
    else if(metric==="co2")    alertCount=vals.filter(v=>v>1000).length;
    else if(metric==="humidity") alertCount=vals.filter(v=>v<30||v>65).length;
    setBuildingSummary({min:Math.min(...vals),max:Math.max(...vals),avg,alertCount,unit,worst,best,metric,byRoom:sorted});
  },[]);

  const showHeatmap = useCallback((metric)=>{
    if(!metric) return;
    if(i3sRef.current) i3sRef.current.show=false;
    resetStyles();
    roomEntitiesRef.current.forEach(entity=>{
      entity.show=true;
      const value=entity.properties?.[metric]?.getValue?.();
      if(value!=null&&entity.polygon) entity.polygon.material=metricToColor(metric,Number(value));
    });
    setActiveHeatmap(metric);
    activeHeatmapRef.current=metric;
    computeBuildingSummary(metric);
  },[resetStyles,computeBuildingSummary]);

  const generateAnimFrames = useCallback((entities)=>{
    const roomBases=new Map();
    entities.forEach(e=>{
      const rn=e.properties?.roomNumber?.getValue?.();
      if(rn&&!roomBases.has(rn)){
        roomBases.set(rn,{
          temperature:Number(e.properties.temperature?.getValue?.()??22),
          humidity:Number(e.properties.humidity?.getValue?.()??45),
          co2:Number(e.properties.co2?.getValue?.()??450),
          occupancy:Number(e.properties.occupancy?.getValue?.()??0),
        });
      }
    });
    // Seed liveFrameDataRef with the initial (frame 0) values
    liveFrameDataRef.current=new Map(roomBases);

    // 96 frames — one every 15 minutes across 24 hours
    const frames=Array.from({length:96},(_,i)=>{
      const h=Math.floor(i/4);
      const m=(i%4)*15;
      const isWork=h>=8&&h<=18;
      const isPeak=(h>=10&&h<=12)||(h>=14&&h<=16);
      const sway=Math.sin((i/96)*2*Math.PI*3);
      const roomData=new Map();
      roomBases.forEach((base,rn)=>{
        const seed=(rn.charCodeAt(0)+i)%7;
        roomData.set(rn,{
          temperature:+(base.temperature+(isPeak?3:isWork?1.5:-1)+sway*0.4+(seed*0.1-0.3)).toFixed(1),
          humidity:+(base.humidity+(isWork?-4:3)+sway*1.5+(seed*0.2-0.7)).toFixed(1),
          co2:Math.round(base.co2+(isPeak?350:isWork?150:0)+sway*30+seed*8-20),
          occupancy:Math.max(0,Math.round(base.occupancy+(isPeak?3:isWork?1:0)+(seed%2))),
        });
      });
      return{label:`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`,minute:i*15,roomData};
    });
    animFramesRef.current=frames;
    setAnimReady(true);
  },[]);

  const applyAnimFrame = useCallback((frameIdx)=>{
    const frames=animFramesRef.current;
    if(!frames.length) return;
    const frame=frames[Math.max(0,Math.min(frameIdx,frames.length-1))];
    // Store live values in a plain Map — never mutate Cesium ConstantProperty objects
    liveFrameDataRef.current=frame.roomData;
    if(activeHeatmapRef.current){
      applyHeatmapColors(activeHeatmapRef.current);
      computeBuildingSummary(activeHeatmapRef.current);
    }
  },[applyHeatmapColors,computeBuildingSummary]);

  // ─── HIGHLIGHTS ──────────────────────────────────────────────────────────

  const highlightByQuery = useCallback((queries,color="cyan",labelOverride=null)=>{
    if(!Array.isArray(queries)||!queries.length) return;
    const css=Cesium.Color.fromCssColorString(color).withAlpha(0.92);
    if(i3sRef.current) i3sRef.current.show=false;
    resetStyles();
    const matched=[];
    queries.forEach(query=>{
      const nq=normStr(query),nrn=extractRoomNum(query);
      roomEntitiesRef.current.filter(e=>{
        const en=extractRoomNum(e.properties?.roomNumber?.getValue?.());
        if(nrn) return en===nrn;
        const rn=normStr(e.properties?.roomName?.getValue?.()),ro=normStr(e.properties?.roomNameOriginal?.getValue?.());
        return rn.includes(nq)||ro.includes(nq);
      }).forEach(entity=>{
        entity.show=true;
        if(entity.polygon){entity.polygon.material=css;entity.polygon.outlineColor=css;entity.polygon.outlineWidth=3;}
        if(entity.labelEntity){if(labelOverride) entity.labelEntity.label.text=labelOverride; entity.labelEntity.show=true;}
        matched.push(entity);
      });
    });
    roomEntitiesRef.current.forEach(e=>{if(!matched.includes(e)) e.show=false;});
    if(matched.length) zoomToEntities(matched,2.8,15);
  },[resetStyles,zoomToEntities]);

  const highlightByThreshold = useCallback((metric,op,threshold,color="red")=>{
    if(!metric||!op||threshold===undefined) return;
    const css=Cesium.Color.fromCssColorString(color).withAlpha(0.92);
    if(i3sRef.current) i3sRef.current.show=false;
    resetStyles();
    const matched=[];
    roomEntitiesRef.current.forEach(entity=>{
      entity.show=true;
      const raw=entity.properties?.[metric]?.getValue?.();
      if(raw==null) return;
      const v=Number(raw);
      if(!isNaN(v)&&evaluateOp(v,op,threshold)){
        if(entity.polygon){entity.polygon.material=css;entity.polygon.outlineColor=css;entity.polygon.outlineWidth=3;}
        if(entity.labelEntity) entity.labelEntity.show=true;
        matched.push(entity);
      }
    });
    if(matched.length) zoomToEntities(matched,2.8,20);
  },[resetStyles,zoomToEntities]);

  const showAlerts = useCallback(()=>{
    if(i3sRef.current) i3sRef.current.show=false;
    resetStyles();
    const alertEntities=[];
    roomEntitiesRef.current.forEach(entity=>{
      entity.show=true;
      const temp=Number(entity.properties?.temperature?.getValue?.()??0);
      const co2=Number(entity.properties?.co2?.getValue?.()??0);
      const humidity=Number(entity.properties?.humidity?.getValue?.()??50);
      let alertColor=null,alertReason="";
      if(co2>ALERT_THRESHOLDS.co2.value){alertColor=Cesium.Color.fromCssColorString(ALERT_THRESHOLDS.co2.color).withAlpha(0.92);alertReason=`⚠ CO₂ ${co2} ppm`;}
      else if(temp>ALERT_THRESHOLDS.temperature.value){alertColor=Cesium.Color.fromCssColorString(ALERT_THRESHOLDS.temperature.color).withAlpha(0.92);alertReason=`🌡 Temp ${temp}°C`;}
      else if(humidity<ALERT_THRESHOLDS.humidity_lo.value){alertColor=Cesium.Color.fromCssColorString(ALERT_THRESHOLDS.humidity_lo.color).withAlpha(0.88);alertReason=`💧 Dry ${humidity}%`;}
      else if(humidity>ALERT_THRESHOLDS.humidity_hi.value){alertColor=Cesium.Color.fromCssColorString(ALERT_THRESHOLDS.humidity_hi.color).withAlpha(0.88);alertReason=`💧 Humid ${humidity}%`;}
      if(alertColor&&entity.polygon){
        entity.polygon.material=alertColor;entity.polygon.outlineColor=alertColor;entity.polygon.outlineWidth=4;
        if(entity.labelEntity){entity.labelEntity.label.text=`${entity.properties.roomName?.getValue()??""}\n${alertReason}`;entity.labelEntity.show=true;}
        alertEntities.push(entity);
      }
    });
    if(alertEntities.length) zoomToEntities(alertEntities,2.8,20);
  },[resetStyles,zoomToEntities]);

  // ─── NAVIGATION ──────────────────────────────────────────────────────────

  const hideSensorMarkers = useCallback(()=>{
    const viewer=viewerRef.current; if(!viewer) return;
    sensorEntitiesRef.current.forEach(e=>{try{viewer.entities.remove(e);}catch(_){}});
    sensorEntitiesRef.current=[];
  },[]);

  const zoomToBuilding = useCallback(()=>{
    setSelectedCircuit("");
    const viewer=viewerRef.current;
    if(!viewer) return;
    resetStyles(); hideEnergyFlow(); hideSensorMarkers();
    [...roomEntitiesRef.current,...circuitEntitiesRef.current].forEach(e=>{e.show=false;if(e.labelEntity) e.labelEntity.show=false;});
    if(i3sRef.current) i3sRef.current.show=true;

    // Center on actual building geometry when available
    const allEntities=[...roomEntitiesRef.current,...circuitEntitiesRef.current];
    const sphere=allEntities.length?getBoundingSphere(allEntities):null;
    if(sphere){
      viewer.camera.flyToBoundingSphere(sphere,{
        duration:1.5,
        offset:new Cesium.HeadingPitchRange(HOME_CAMERA.heading,HOME_CAMERA.pitch,Math.max(sphere.radius*3,80)),
        easingFunction:Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    } else {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(HOME_CAMERA.lon, HOME_CAMERA.lat, HOME_CAMERA.height),
        orientation: { heading:HOME_CAMERA.heading, pitch:HOME_CAMERA.pitch, roll:HOME_CAMERA.roll },
        duration: 1.5,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    }

    if(!i3sRef.current) {
      roomEntitiesRef.current.forEach(e=>{e.show=true;});
    }
  },[resetStyles,hideEnergyFlow,hideSensorMarkers]);

  const showExteriorModel = useCallback(()=>{
    const viewer=viewerRef.current;
    if(!viewer) return;
    resetStyles();
    hideEnergyFlow();
    hideSensorMarkers();
    roomEntitiesRef.current.forEach(e=>{e.show=false;if(e.labelEntity) e.labelEntity.show=false;});
    circuitEntitiesRef.current.forEach(e=>{e.show=false;});
    if(i3sRef.current?.extent){
      i3sRef.current.show=true;
      const center=Cesium.Rectangle.center(i3sRef.current.extent);
      center.height=240;
      viewer.camera.flyTo({
        destination:Cesium.Ellipsoid.WGS84.cartographicToCartesian(center),
        duration:1.2,
      });
      return;
    }
    roomEntitiesRef.current.forEach(e=>{e.show=true;});
    zoomToEntities(roomEntitiesRef.current,2.8,30);
  },[resetStyles,hideEnergyFlow,hideSensorMarkers,zoomToEntities]);

  const showSensorMarkers = useCallback((sensorType="all")=>{
    const viewer=viewerRef.current; if(!viewer) return;
    hideSensorMarkers();
    const grouped=new Map();
    roomEntitiesRef.current.forEach(e=>{
      const rn=e.properties?.roomNumber?.getValue?.(); if(!rn) return;
      if(!grouped.has(rn)) grouped.set(rn,[]);
      grouped.get(rn).push(e);
    });
    const types=sensorType==="all"?["temperature","co2","humidity"]:[sensorType];
    const icons={temperature:"🌡",co2:"💨",humidity:"💧"};
    const unitMap={temperature:"C",co2:"ppm",humidity:"%"};
    const bgMap={
      temperature:Cesium.Color.fromCssColorString("#7C2D12").withAlpha(0.82),
      co2:Cesium.Color.fromCssColorString("#7F1D1D").withAlpha(0.82),
      humidity:Cesium.Color.fromCssColorString("#0C4A6E").withAlpha(0.82),
    };
    grouped.forEach(entities=>{
      const sphere=getBoundingSphere(entities); if(!sphere) return;
      const carto=Cesium.Cartographic.fromCartesian(sphere.center);
      const first=entities[0];
      const elev=(first.polygon?.extrudedHeight?.getValue?.()??0)-3.5+2.5;
      const vals={temperature:Number(first.properties?.temperature?.getValue?.()??22),co2:Number(first.properties?.co2?.getValue?.()??400),humidity:Number(first.properties?.humidity?.getValue?.()??45)};
      types.forEach((type,idx)=>{
        const rawVal=vals[type];
        const value=type==="temperature"?rawVal.toFixed(1):Math.round(rawVal);
        sensorEntitiesRef.current.push(viewer.entities.add({
          position:Cesium.Cartesian3.fromRadians(carto.longitude,carto.latitude,elev),
          label:{text:`${icons[type]||"●"} ${value} ${unitMap[type]||""}`,font:"700 12px 'Courier New',monospace",fillColor:Cesium.Color.WHITE,outlineColor:Cesium.Color.BLACK,outlineWidth:3,style:Cesium.LabelStyle.FILL_AND_OUTLINE,verticalOrigin:Cesium.VerticalOrigin.BOTTOM,pixelOffset:new Cesium.Cartesian2(0,-8-(idx*16)),disableDepthTestDistance:Number.POSITIVE_INFINITY,showBackground:true,backgroundColor:bgMap[type]||Cesium.Color.BLACK.withAlpha(0.78),backgroundPadding:new Cesium.Cartesian2(6,4)},
        }));
      });
    });
  },[hideSensorMarkers]);

  const zoomToRoom = useCallback((roomQuery)=>{
    setSelectedCircuit("");
    const query=String(roomQuery??"").trim(); if(!query) return;
    const nq=normStr(query),nrn=extractRoomNum(query);
    let matches=roomEntitiesRef.current.filter(e=>{
      const en=extractRoomNum(e.properties?.roomNumber?.getValue?.());
      if(nrn) return en===nrn;
      return normStr(e.properties?.roomNumber?.getValue?.())===nq;
    });
    if(!matches.length){
      matches=roomEntitiesRef.current.filter(e=>{
        const rn=normStr(e.properties?.roomName?.getValue?.()),ro=normStr(e.properties?.roomNameOriginal?.getValue?.());
        return rn===nq||ro===nq||rn.includes(nq)||ro.includes(nq);
      });
    }
    if(!matches.length) return;
    if(i3sRef.current) i3sRef.current.show=false;
    resetStyles(); showOnly(e=>matches.includes(e));
    matches.forEach(e=>{if(e.polygon) e.polygon.material=Cesium.Color.CYAN.withAlpha(0.9);if(e.labelEntity) e.labelEntity.show=true;});
    zoomToEntities(matches,matches.length>1?2.8:4,15);
    const first=matches[0];
    if(onFeatureClick&&first) onFeatureClick({roomNumber:first.properties.roomNumber?.getValue(),roomName:first.properties.roomName?.getValue(),floor:first.properties.floorLevel?.getValue(),temperature:first.properties.temperature?.getValue(),humidity:first.properties.humidity?.getValue(),co2:first.properties.co2?.getValue(),occupancy:first.properties.occupancy?.getValue(),circuitIds:first.properties.circuit_id?.getValue?.()??[]});
  },[resetStyles,showOnly,zoomToEntities,onFeatureClick]);

  const zoomToFloor = useCallback((floor)=>{
    setSelectedCircuit("");
    const available=floorsRef.current.map(Number).filter(Number.isFinite); if(!available.length) return;
    const str=String(floor??"").trim(); let target=Number(str);
    if(!Number.isFinite(target)||!available.includes(target)){
      if(available.includes(target+1)) target=target+1;
      else if(available.includes(target-1)) target=target-1;
      else if(str.toUpperCase()==="ROOF") target=Math.max(...available);
      else return;
    }
    const matches=roomEntitiesRef.current.filter(e=>Number(e.properties?.floorLevel?.getValue?.())===target);
    if(!matches.length) return;
    if(i3sRef.current) i3sRef.current.show=false;
    resetStyles(); showOnly(e=>Number(e.properties?.floorLevel?.getValue?.())===target);
    zoomToEntities(matches,2.6,30);
  },[resetStyles,showOnly,zoomToEntities]);

  const zoomToCircuit = useCallback((circuitId)=>{
    const id=normalizeCircuitId(circuitId),viewer=viewerRef.current;
    console.log("[zoomToCircuit] called with:", circuitId, "→ normalized:", id);
    if(!viewer||!id){ console.warn("[zoomToCircuit] abort: no viewer or id"); return false; }
    setSelectedCircuit(id);
    const cfg=CIRCUIT_CONFIGS[id],color=Cesium.Color.fromCssColorString(cfg?.color||"#22C55E");
    if(i3sRef.current) i3sRef.current.show=false;
    resetStyles();
    const all=[...roomEntitiesRef.current,...circuitEntitiesRef.current];
    const matches=all.filter(e=>{const v=e.properties?.circuit_id?.getValue?.();return Array.isArray(v)?v.map(normalizeCircuitId).includes(id):normalizeCircuitId(v)===id;});
    console.log("[zoomToCircuit] matched entities:", matches.length, "for circuit:", id);
    if(matches.length){
      all.forEach(e=>{e.show=false;if(e.labelEntity) e.labelEntity.show=false;});
      matches.forEach(e=>{
        e.show=true;
        if(e.polygon){e.polygon.material=color.withAlpha(0.92);e.polygon.outlineColor=color;e.polygon.outlineWidth=4;}
        if(e.cylinder) e.cylinder.material=color.withAlpha(0.95);
        if(e.ellipsoid) e.ellipsoid.material=color.withAlpha(0.8);
      });
    }
    if(matches.length){
      // Always center on the actual matched rooms
      const sphere=getBoundingSphere(matches);
      if(sphere){
        const preset=CIRCUIT_CAM[id];
        const heading=preset?Cesium.Math.toRadians(preset.heading):0;
        const pitch=preset?Cesium.Math.toRadians(preset.pitch):Cesium.Math.toRadians(-45);
        const range=Math.max(sphere.radius*2.5,25);
        viewer.camera.flyToBoundingSphere(sphere,{duration:1.5,offset:new Cesium.HeadingPitchRange(heading,pitch,range),easingFunction:Cesium.EasingFunction.CUBIC_IN_OUT});
      } else {
        zoomToEntities(matches,2.5,25);
      }
    } else {
      const preset=CIRCUIT_CAM[id];
      if(preset){
        viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(preset.lon,preset.lat,preset.h),orientation:{heading:Cesium.Math.toRadians(preset.heading),pitch:Cesium.Math.toRadians(preset.pitch),roll:0},duration:1.5,easingFunction:Cesium.EasingFunction.CUBIC_IN_OUT});
      } else {
        const centroid=circuitCentroidsRef.current[id];
        if(centroid){
          viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(centroid.lon,centroid.lat,centroid.h||615),orientation:{heading:0,pitch:Cesium.Math.toRadians(-45),roll:0},duration:1.5});
        } else {
          console.warn("[zoomToCircuit] no matches, no preset, no centroid for:", id);
          return false;
        }
      }
    }
    return true;
  },[resetStyles,zoomToEntities]);

  const zoomToName = useCallback((rawQuery)=>{
    const terms=[normStr(rawQuery)].filter(Boolean); if(!terms.length) return false;
    setSelectedCircuit("");
    if(i3sRef.current) i3sRef.current.show=false;
    resetStyles();
    const all=[...roomEntitiesRef.current,...circuitEntitiesRef.current];
    const matches=all.filter(e=>{
      const hay=[normStr(e.properties?.roomName?.getValue?.()),normStr(e.properties?.roomNameOriginal?.getValue?.()),normStr(e.properties?.roomNumber?.getValue?.()),normStr(e.name)].join(" ");
      return terms.some(t=>hay.includes(t));
    });
    if(!matches.length) return false;
    showOnly(e=>matches.includes(e));
    matches.forEach(e=>{
      if(e.polygon) e.polygon.material=Cesium.Color.CYAN.withAlpha(0.9);
      if(e.box) e.box.material=Cesium.Color.CYAN.withAlpha(0.85);
      if(e.cylinder) e.cylinder.material=Cesium.Color.CYAN.withAlpha(0.85);
      if(e.ellipsoid) e.ellipsoid.material=Cesium.Color.CYAN.withAlpha(0.75);
      if(e.labelEntity) e.labelEntity.show=true;
    });
    zoomToEntities(matches,matches.length>1?2.8:4,20);
    return true;
  },[resetStyles,showOnly,zoomToEntities]);

  const searchAndNavigate = useCallback((rawQuery)=>{
    const query=String(rawQuery??"").trim();
    if(!query) return false;

    const normQuery=normalizeCircuitId(query);
    if(CIRCUIT_CONFIGS[normQuery]) return zoomToCircuit(normQuery);

    const lower=normStr(query);
    const byLabel=Object.entries(CIRCUIT_CONFIGS).find(([id,cfg])=>{
      const idText=normStr(id);
      const labelText=normStr(cfg?.label);
      return idText===lower||labelText===lower||idText.includes(lower)||labelText.includes(lower);
    });
    if(byLabel) return zoomToCircuit(byLabel[0]);

    const roomNum=extractRoomNum(query);
    if(roomNum){
      const matched=availableRooms.find(r=>extractRoomNum(r.roomNumber)===roomNum);
      if(matched){
        setSelectedRoom(matched.roomNumber);
        zoomToRoom(matched.roomNumber);
        return true;
      }
    }

    const matchedRoom=availableRooms.find(r=>{
      const roomNumberText=normStr(r.roomNumber);
      const roomNameText=normStr(r.roomName);
      return roomNumberText===lower||roomNameText===lower||roomNumberText.includes(lower)||roomNameText.includes(lower);
    });
    if(matchedRoom){
      setSelectedRoom(matchedRoom.roomNumber);
      zoomToRoom(matchedRoom.roomNumber);
      return true;
    }

    return zoomToName(query);
  },[availableRooms,zoomToCircuit,zoomToRoom,zoomToName]);

  const setVisualizationMode = useCallback((mode)=>{
    setActiveMode(mode);
    switch(mode){
      case "default": resetStyles();showOnly(()=>false);if(i3sRef.current) i3sRef.current.show=true;hideEnergyFlow();hideSensorMarkers();break;
      case "rooms": if(i3sRef.current) i3sRef.current.show=false;resetStyles();roomEntitiesRef.current.forEach(e=>{e.show=true;});circuitEntitiesRef.current.forEach(e=>{e.show=false;});hideEnergyFlow();break;
      case "circuits": if(i3sRef.current) i3sRef.current.show=false;resetStyles();showOnly(()=>true);break;
      case "heatmap": showHeatmap(activeHeatmap||"temperature");break;
      case "energy": if(i3sRef.current) i3sRef.current.show=false;resetStyles();roomEntitiesRef.current.forEach(e=>{e.show=true;});if(energyFlowEnabledRef.current) showEnergyFlow(null);break;
      case "sensors": if(i3sRef.current) i3sRef.current.show=false;resetStyles();roomEntitiesRef.current.forEach(e=>{e.show=true;});showSensorMarkers("all");break;
      case "alerts": showAlerts();break;
      default:break;
    }
  },[resetStyles,showOnly,hideEnergyFlow,hideSensorMarkers,showHeatmap,activeHeatmap,showEnergyFlow,showSensorMarkers,showAlerts]);

  const toggleLayer = useCallback((layer,visible)=>{
    const vis=Boolean(visible);
    switch(layer){
      case "rooms": roomEntitiesRef.current.forEach(e=>{e.show=vis;}); break;
      case "circuits": circuitEntitiesRef.current.forEach(e=>{e.show=vis;}); break;
      case "sensors": sensorEntitiesRef.current.forEach(e=>{e.show=vis;}); break;
      case "energy_flow": flowEntitiesRef.current.forEach(e=>{e.show=vis;}); break;
      case "labels": roomEntitiesRef.current.forEach(e=>{if(e.labelEntity) e.labelEntity.show=vis;}); break;
      case "exterior": if(i3sRef.current) i3sRef.current.show=vis; break;
      case "alerts": if(vis) showAlerts(); else resetStyles(); break;
      default:break;
    }
  },[showAlerts,resetStyles]);

  const flyToCoordinates = useCallback((lat,lon,height=500)=>{
    const viewer=viewerRef.current; if(!viewer) return;
    viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(lon,lat,height),duration:1.5});
  },[]);

  const flyToCameraPreset = useCallback((preset)=>{
    const viewer=viewerRef.current; if(!viewer) return;
    const p=CAM_PRESETS[preset]; if(!p) return;
    viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(p.lon,p.lat,p.h),orientation:{heading:Cesium.Math.toRadians(p.heading),pitch:Cesium.Math.toRadians(p.pitch),roll:0},duration:1.5,easingFunction:Cesium.EasingFunction.CUBIC_IN_OUT});
  },[]);

  const setTimeWindow = useCallback((startIso,endIso=null)=>{
    timeWindowRef.current={start:startIso?new Date(startIso):null,end:endIso?new Date(endIso):new Date()};
    if(activeHeatmap) showHeatmap(activeHeatmap);
  },[activeHeatmap,showHeatmap]);

  const resetTimeWindow = useCallback(()=>{
    timeWindowRef.current={start:null,end:null};
    if(activeHeatmap) showHeatmap(activeHeatmap);
  },[activeHeatmap,showHeatmap]);

  // ─── INIT ─────────────────────────────────────────────────────────────────

  useEffect(()=>{
    if(!containerRef.current||viewerRef.current) return;
    let destroyed=false;

    const init=async()=>{
      try{
        window.__cesiumViewerReady=false;
        Cesium.Ion.defaultAccessToken=ION_TOKEN;
        const terrain=new Cesium.Terrain(Cesium.ArcGISTiledElevationTerrainProvider.fromUrl("https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"));
        const viewer=new Cesium.Viewer(containerRef.current,{terrain,animation:false,timeline:false,baseLayerPicker:false,geocoder:false,sceneModePicker:false,infoBox:false,selectionIndicator:false,shadows:false,homeButton:true});
        viewerRef.current=viewer;
        viewer.shadows=false; viewer.terrainShadows=Cesium.ShadowMode.DISABLED;
        viewer.scene.globe.enableLighting=true; viewer.scene.globe.depthTestAgainstTerrain=true;
        viewer.scene.highDynamicRange=true; viewer.scene.fog.enabled=true; viewer.scene.fog.density=0.0001; viewer.scene.fog.minimumBrightness=0.8;
        viewer.scene.screenSpaceCameraController.enableCollisionDetection=true;

        let i3sProvider=null;
        try{
          i3sProvider=await Cesium.I3SDataProvider.fromUrl(I3S_URL,{adjustMaterialAlphaMode:true,showFeatures:true,applySymbology:true,calculateNormals:true});
          if(destroyed) return;
          viewer.scene.primitives.add(i3sProvider);
          i3sRef.current=i3sProvider;
          setI3sAvailable(true);
        }catch(modelErr){
          console.warn("I3S model could not be loaded, falling back to room geometry:",modelErr);
          i3sRef.current=null;
          setI3sAvailable(false);
        }

        const response=await fetch(GEOJSON_URL);
        const geojson=await response.json();
        if(destroyed) return;

        const createdRooms=[],createdCircuits=[],floorsSet=new Set(),roomList=[];

        geojson.features.forEach((feature,idx)=>{
          const props=feature.properties||{};
          const floorLevel=Number(props.BldgLevel??0);
          const roomNumber=props.RoomNumber||`Room-${idx}`;
          const roomNameBG=props.RoomName||"";
          const roomName=translateRoomName(roomNameBG);
          const baseElev=Number(props.BldgLevel_Elev??0);
          const area=props.SourceArea;
          floorsSet.add(floorLevel);
          if(!roomList.find(r=>r.roomNumber===roomNumber)) roomList.push({roomNumber,roomName,floorLevel});
          const roomData=getRoomData(roomName);
          const circuitIds=getRoomCircuitIds(roomNumber,roomName,floorLevel);
          const polygons=geometryToPolygons(feature.geometry,baseElev);
          polygons.forEach((positions,pi)=>{
            const entity=viewer.entities.add({
              id:`${roomNumber}-${pi}`,name:roomNumber,
              polygon:{hierarchy:new Cesium.PolygonHierarchy(positions),material:getRoomColor(roomName),extrudedHeight:baseElev+3.5,perPositionHeight:true,outline:true,outlineColor:Cesium.Color.BLACK.withAlpha(0.85),outlineWidth:2,shadows:Cesium.ShadowMode.DISABLED},
              properties:{roomNumber,roomName,roomNameOriginal:roomNameBG,floorLevel,area,temperature:roomData.temp,humidity:roomData.humidity,co2:roomData.co2,occupancy:roomData.occupancy,circuit_id:circuitIds},
              show:false,
            });
            entity.originalMaterial=entity.polygon.material;
            createdRooms.push(entity);
          });
        });

        // Labels
        const grouped=new Map();
        createdRooms.forEach(e=>{const rn=e.properties.roomNumber.getValue();if(!grouped.has(rn)) grouped.set(rn,[]);grouped.get(rn).push(e);});
        grouped.forEach(entities=>{
          const sphere=getBoundingSphere(entities); if(!sphere) return;
          const first=entities[0],carto=Cesium.Cartographic.fromCartesian(sphere.center);
          const baseElev=first.polygon.extrudedHeight.getValue()-3.5,circuits=first.properties.circuit_id.getValue();
          const labelEnt=viewer.entities.add({
            position:Cesium.Cartesian3.fromRadians(carto.longitude,carto.latitude,baseElev+4.1),
            label:{text:`${first.properties.roomName.getValue()}\n${first.properties.roomNumber.getValue()}\nCircuits: ${Array.isArray(circuits)?circuits.join(", "):circuits}`,font:"700 13px 'Courier New',monospace",fillColor:Cesium.Color.WHITE,outlineColor:Cesium.Color.BLACK,outlineWidth:3,style:Cesium.LabelStyle.FILL_AND_OUTLINE,verticalOrigin:Cesium.VerticalOrigin.BOTTOM,pixelOffset:new Cesium.Cartesian2(0,-12),disableDepthTestDistance:Number.POSITIVE_INFINITY,showBackground:true,backgroundColor:Cesium.Color.BLACK.withAlpha(0.84),backgroundPadding:new Cesium.Cartesian2(9,7)},
            show:false,
          });
          entities.forEach(e=>{e.labelEntity=labelEnt;});
        });

        // External circuit entities
        const addCirc=(entity,key="cylinder")=>{if(entity[key]?.material) entity.originalMaterial=entity[key].material;createdCircuits.push(entity);};
        [[23.33035,42.67395,"vehiclecharging1"],[23.33075,42.67365,"vehiclecharging2"]].forEach(([lon,lat,cid])=>{
          addCirc(viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(lon,lat,605),cylinder:{length:1.5,topRadius:0.3,bottomRadius:0.3,material:Cesium.Color.fromCssColorString("#AED6F1"),outline:true,outlineColor:Cesium.Color.BLACK},properties:{circuit_id:cid,type:"EV Charger"},show:false}),"cylinder");
          addCirc(viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(lon,lat,606.2),box:{dimensions:new Cesium.Cartesian3(0.4,0.05,0.6),material:Cesium.Color.fromCssColorString("#2C3E50"),outline:true,outlineColor:Cesium.Color.CYAN},properties:{circuit_id:cid,type:"EV Charger"},show:false}),"box");
        });
        [[23.3303,42.67392],[23.33045,42.67392],[23.3306,42.67392],[23.33075,42.67392]].forEach(([lon,lat])=>{
          addCirc(viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(lon,lat,605),cylinder:{length:5,topRadius:0.08,bottomRadius:0.12,material:Cesium.Color.DARKGRAY},properties:{circuit_id:"outsidelighting1"},show:false}),"cylinder");
          addCirc(viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(lon,lat,607.5),ellipsoid:{radii:new Cesium.Cartesian3(0.25,0.25,0.15),material:Cesium.Color.fromCssColorString("#F9E79F").withAlpha(0.95)},properties:{circuit_id:"outsidelighting1"},show:false}),"ellipsoid");
        });
        [[23.3303,42.67365],[23.33045,42.67365],[23.3306,42.67365],[23.33075,42.67365]].forEach(([lon,lat])=>{
          addCirc(viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(lon,lat,605),cylinder:{length:5,topRadius:0.08,bottomRadius:0.12,material:Cesium.Color.DARKGRAY},properties:{circuit_id:"outsidelighting2"},show:false}),"cylinder");
          addCirc(viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(lon,lat,607.5),ellipsoid:{radii:new Cesium.Cartesian3(0.25,0.25,0.15),material:Cesium.Color.fromCssColorString("#FAD7A0").withAlpha(0.95)},properties:{circuit_id:"outsidelighting2"},show:false}),"ellipsoid");
        });
        addCirc(viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(23.330534,42.67387,608),box:{dimensions:new Cesium.Cartesian3(4.0,0.4,2.5),material:Cesium.Color.fromCssColorString("#2C3E50"),outline:true,outlineColor:Cesium.Color.BLACK},properties:{circuit_id:"3DLED",type:"LED Display"},show:false}),"box");
        addCirc(viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(23.330534,42.67387,608),box:{dimensions:new Cesium.Cartesian3(3.6,0.2,2.2),material:Cesium.Color.fromCssColorString("#FF6B6B").withAlpha(0.9),outline:true,outlineColor:Cesium.Color.RED},properties:{circuit_id:"3DLED",type:"LED Display"},show:false}),"box");

        roomEntitiesRef.current=createdRooms;
        circuitEntitiesRef.current=createdCircuits;
        const sortedFloors=Array.from(floorsSet).sort((a,b)=>a-b);
        floorsRef.current=sortedFloors; setAvailableFloors(sortedFloors);
        const sortedRooms=roomList.sort((a,b)=>{if(a.floorLevel!==b.floorLevel) return a.floorLevel-b.floorLevel;return String(a.roomNumber).localeCompare(String(b.roomNumber),undefined,{numeric:true,sensitivity:"base"});});
        setAvailableRooms(sortedRooms);
        setClimateReplayRoom((prev)=>{
          if(prev&&toReplayRoomKey(prev)) return prev;
          const firstMapped=sortedRooms.find((r)=>toReplayRoomKey(r.roomNumber));
          return firstMapped?String(firstMapped.roomNumber):"";
        });
        setCompareRoom((prev)=>{
          if(prev&&toReplayRoomKey(prev)) return prev;
          const firstMapped=sortedRooms.find((r)=>toReplayRoomKey(r.roomNumber));
          return firstMapped?String(firstMapped.roomNumber):"";
        });
        void hydrateLatestRoomTelemetry();
        void loadOutsideTemperature();

        const homePos = Cesium.Cartesian3.fromDegrees(HOME_CAMERA.lon, HOME_CAMERA.lat, HOME_CAMERA.height);
        homeDestRef.current = homePos;

        // Center on actual building geometry when entities are available
        const allLoaded = [...roomEntitiesRef.current, ...circuitEntitiesRef.current];
        const initSphere = allLoaded.length ? getBoundingSphere(allLoaded) : null;
        if (initSphere) {
          viewer.camera.viewBoundingSphere(initSphere, new Cesium.HeadingPitchRange(
            HOME_CAMERA.heading, HOME_CAMERA.pitch, Math.max(initSphere.radius * 3, 80)
          ));
        } else {
          viewer.camera.setView({
            destination: homePos,
            orientation: {
              heading: HOME_CAMERA.heading,
              pitch:   HOME_CAMERA.pitch,
              roll:    HOME_CAMERA.roll,
            },
          });
        }
        if(!i3sProvider) {
          roomEntitiesRef.current.forEach(e=>{e.show=true;});
        }

        viewer.homeButton.viewModel.command.beforeExecute.addEventListener(ev=>{ev.cancel=true;zoomToBuilding();});
        viewer.screenSpaceEventHandler.setInputAction(click=>{
          const picked=viewer.scene.pick(click.position);
          if(!Cesium.defined(picked)||!picked.id) return;
          const e=picked.id;
          const rn=e.properties?.roomNumber?.getValue?.(),cv=e.properties?.circuit_id?.getValue?.();
          if(rn){zoomToRoom(rn);return;}
          if(typeof cv==="string") zoomToCircuit(cv);
        },Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Generate 24-hour animation frames from initial room telemetry
        generateAnimFrames(createdRooms);

        // Hover handler for per-room tooltip
        const hoverHandler=new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        hoverHandlerRef.current=hoverHandler;
        hoverHandler.setInputAction((movement)=>{
          const metric=activeHeatmapRef.current;
          if(!metric){setHoveredRoom(null);return;}
          const picked=viewer.scene.pick(movement.endPosition);
          if(!Cesium.defined(picked)||!picked.id){setHoveredRoom(null);return;}
          const entity=picked.id;
          const rn=entity.properties?.roomNumber?.getValue?.();
          if(!rn){setHoveredRoom(null);return;}
          const UNITS={temperature:"°C",co2:" ppm",humidity:"%",occupancy:""};
          const liveVal=liveFrameDataRef.current.get(rn)?.[metric];
          const raw=liveVal??entity.properties?.[metric]?.getValue?.();
          setHoveredRoom({
            x:movement.endPosition.x+14,
            y:movement.endPosition.y-14,
            name:entity.properties?.roomName?.getValue?.()??rn,
            rn,
            floor:entity.properties?.floorLevel?.getValue?.()??"",
            value:raw!=null?Number(raw):null,
            unit:UNITS[metric]??"",
            metric,
          });
        },Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        setLoading(false); window.__cesiumViewerReady=true;
        const pending=Array.isArray(window.__pendingCesiumCommands)?window.__pendingCesiumCommands:[];
        if(pending.length){pending.forEach(cmd=>window.dispatchEvent(new CustomEvent("cesium-command",{detail:cmd})));window.__pendingCesiumCommands=[];}
      }catch(e){console.error("Viewer init failed:",e);setLoading(false);window.__cesiumViewerReady=false;}
    };

    init()
    return ()=>{
      destroyed=true; stopReplay(); stopClimateReplay(); window.__cesiumViewerReady=false;
      if(hoverHandlerRef.current&&!hoverHandlerRef.current.isDestroyed()) hoverHandlerRef.current.destroy();
      hoverHandlerRef.current=null;
      if(animIntervalRef.current) clearInterval(animIntervalRef.current);
      animIntervalRef.current=null;
      if(viewerRef.current&&!viewerRef.current.isDestroyed()) viewerRef.current.destroy();
      viewerRef.current=null;i3sRef.current=null;
      roomEntitiesRef.current=[];circuitEntitiesRef.current=[];flowEntitiesRef.current=[];sensorEntitiesRef.current=[];
    };
  },[stopReplay,stopClimateReplay,zoomToEntities,hydrateLatestRoomTelemetry,loadOutsideTemperature,generateAnimFrames]);

  // ─── COMMAND LISTENER ─────────────────────────────────────────────────────

  useEffect(()=>{
    const listener=(event)=>{
      const cmd=event.detail,viewer=viewerRef.current;
      if(!viewer||cmd?.type!=="cesium") return;
      switch(cmd.action){
        case "fly_to_coordinates": flyToCoordinates(cmd.lat,cmd.lon,cmd.height??500); break;
        case "zoom_to_room": zoomToRoom(cmd.room_query||cmd.room_number||cmd.room_name||cmd.room||cmd.name); break;
        case "zoom_to_floor": zoomToFloor(cmd.floor); break;
        case "zoom_to_building": case "reset_view": zoomToBuilding(); break;
        case "zoom_to_circuit": if(!zoomToCircuit(cmd.circuit_id||cmd.circuit)) zoomToName(cmd.circuit_id||cmd.circuit||""); break;
        case "zoom_to_name": case "zoom_to_entity": zoomToName(cmd.name||cmd.query||cmd.entity_id||""); break;
        case "show_building": if(i3sRef.current) i3sRef.current.show=true; break;
        case "hide_building": if(i3sRef.current) i3sRef.current.show=false; break;
        case "show_all_rooms": roomEntitiesRef.current.forEach(e=>{e.show=true;}); break;
        case "hide_all_rooms": roomEntitiesRef.current.forEach(e=>{e.show=false;}); break;
        case "show_heatmap": showHeatmap(cmd.metric); break;
        case "clear_heatmap": case "clear_highlights": resetStyles();showOnly(()=>false);if(i3sRef.current) i3sRef.current.show=true; break;
        case "highlight_rooms": highlightByQuery(cmd.room_queries,cmd.color,cmd.label_override); break;
        case "highlight_rooms_by_threshold": highlightByThreshold(cmd.metric,cmd.operator,cmd.threshold,cmd.color); break;
        case "highlight_entities": highlightByQuery(cmd.entity_ids,cmd.color); break;
        case "show_alerts": showAlerts(); break;
        case "toggle_layer": toggleLayer(cmd.layer,cmd.visible); break;
        case "set_visualization_mode": setVisualizationMode(cmd.mode); break;
        case "show_energy_flow": showEnergyFlow(cmd.circuit_id??null); break;
        case "hide_energy_flow": hideEnergyFlow(); break;
        case "compare_floors":{
          if(i3sRef.current) i3sRef.current.show=false; resetStyles();
          roomEntitiesRef.current.forEach(e=>{const f=Number(e.properties?.floorLevel?.getValue?.());e.show=f===cmd.floor_a||f===cmd.floor_b;if(e.show&&e.polygon) e.polygon.material=metricToColor(cmd.metric||"temperature",Number(e.properties?.[cmd.metric||"temperature"]?.getValue?.()??22));});
          break;}
        case "compare_rooms":{
          if(!Array.isArray(cmd.room_queries)||!cmd.room_queries.length) break;
          if(i3sRef.current) i3sRef.current.show=false; resetStyles();
          const m=cmd.metric||"co2";
          const candidates=cmd.room_queries.flatMap(q=>{const nrn=extractRoomNum(q);return roomEntitiesRef.current.filter(e=>{const en=extractRoomNum(e.properties?.roomNumber?.getValue?.());return nrn?en===nrn:normStr(e.properties?.roomName?.getValue?.()).includes(normStr(q));});});
          roomEntitiesRef.current.forEach(e=>{e.show=false;});
          candidates.forEach(e=>{e.show=true;const v=Number(e.properties?.[m]?.getValue?.()??0);if(e.polygon) e.polygon.material=metricToColor(m,v);});
          break;}
        case "show_sensor_markers": showSensorMarkers(cmd.sensor_type??"all"); break;
        case "hide_sensor_markers": hideSensorMarkers(); break;
        case "set_camera_preset": flyToCameraPreset(cmd.preset); break;
        case "set_time_window": setTimeWindow(cmd.start_iso,cmd.end_iso); break;
        case "reset_time_window": resetTimeWindow(); break;
        default:break;
      }
    };
    window.addEventListener("cesium-command",listener);
    return ()=>window.removeEventListener("cesium-command",listener);
  },[activeHeatmap,flyToCoordinates,zoomToRoom,zoomToFloor,zoomToBuilding,zoomToCircuit,zoomToName,showHeatmap,resetStyles,showOnly,highlightByQuery,highlightByThreshold,showAlerts,toggleLayer,setVisualizationMode,showEnergyFlow,hideEnergyFlow,showSensorMarkers,hideSensorMarkers,flyToCameraPreset,setTimeWindow,resetTimeWindow]);

  // ─── ANIMATION PLAYBACK ───────────────────────────────────────────────────
  useEffect(()=>{
    if(animPlaying){
      animIntervalRef.current=setInterval(()=>{
        setAnimFrame(prev=>{
          const next=(prev+1)%96;
          applyAnimFrame(next);
          return next;
        });
      },600);
    } else {
      if(animIntervalRef.current){clearInterval(animIntervalRef.current);animIntervalRef.current=null;}
    }
    return ()=>{if(animIntervalRef.current){clearInterval(animIntervalRef.current);animIntervalRef.current=null;}};
  },[animPlaying,applyAnimFrame]);

  // ─── COMPARE TAB DATA LOADING ─────────────────────────────────────────────
  // Both replayDataRef and climateReplayDataRef are refs — mutating them won't
  // trigger a re-render on their own.  This effect loads the needed data and
  // then bumps compareDataTick so the component re-renders with fresh data.
  useEffect(()=>{
    if(replayMode !== "compare") return;
    let cancelled = false;
    (async ()=>{
      const key = toReplayRoomKey(compareRoom || climateReplayRoom);
      const [,] = await Promise.all([
        key ? ensureClimateReplayData(key) : Promise.resolve(),
        loadEnergyReplayData(),
      ]);
      if(!cancelled) setCompareDataTick(t=>t+1);
    })();
    return ()=>{ cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[replayMode, compareRoom, climateReplayRoom]);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  const allCircIds=Object.keys(CIRCUIT_CONFIGS);
  // compareDataTick is bumped by the Compare useEffect after async data loads,
  // forcing a re-render so the charts read fresh ref data.
  void compareDataTick;
  const replayData=replayDataRef.current;
  const totalFrames=replayData[replayCircuit]?.length||96;
  const currentSample=replayData[replayCircuit]?.[replayFrame];
  const climateData=climateReplayDataRef.current;
  const activeClimateRoomKey=toReplayRoomKey(climateReplayRoom);
  const mappedClimateRooms=availableRooms.filter((r)=>ROOM_BMS_ENDPOINTS[toReplayRoomKey(r.roomNumber)]);
  const climateRoomOptions=mappedClimateRooms.length?mappedClimateRooms:availableRooms;
  const climateTotalFrames=climateData[activeClimateRoomKey]?.length||96;
  const climateCurrentSample=climateData[activeClimateRoomKey]?.[climateReplayFrame];
  const compareRoomKey = toReplayRoomKey(compareRoom || climateReplayRoom);
  const compareRoomMeta = availableRooms.find((r)=>toReplayRoomKey(r.roomNumber)===compareRoomKey);

  const compareAnalysis = (()=>{
    const roomSeries = climateData[compareRoomKey] || [];
    const circuitSeries = replayData[compareCircuit] || [];
    const ovkSeries = replayData.ovk || [];
    const outsideSeries = outsideTempSeries || [];
    const lagFrames = Number(compareLag) || 0;
    const frameCount = Math.max(roomSeries.length || 0, circuitSeries.length || 0, 96);
    if (!compareRoomKey || frameCount < 2) return null;

    const points = [];
    const occupancy = [];
    const occupancyForFrame = (i)=>{
      const sample = roomSeries[Math.min(i, Math.max(0, roomSeries.length - 1))] || null;
      const prev = roomSeries[Math.max(0, Math.min(i - 1, roomSeries.length - 1))] || null;
      const occ = inferOccupancySample(sample, prev, compareRoomMeta?.roomName, occupancyMode);
      return Number.isFinite(occ) ? occ : NaN;
    };

    const seriesAt = (series, key, i) => interpByIndex(series, i, key);

    for (let i = 0; i < frameCount; i++) {
      const j = i + lagFrames;
      let x = NaN;
      let y = NaN;
      if (comparePair === "energy_vs_temp") {
        x = seriesAt(circuitSeries, "watts", i);
        y = seriesAt(roomSeries, "temperature", j);
      } else if (comparePair === "energy_vs_humidity") {
        x = seriesAt(circuitSeries, "watts", i);
        y = seriesAt(roomSeries, "humidity", j);
      } else if (comparePair === "energy_vs_co2") {
        x = seriesAt(circuitSeries, "watts", i);
        y = seriesAt(roomSeries, "co2", j);
      } else if (comparePair === "ovk_vs_co2") {
        x = seriesAt(ovkSeries, "watts", i);
        y = seriesAt(roomSeries, "co2", j);
      } else if (comparePair === "outdoor_temp_vs_hvac") {
        const hvac1 = seriesAt(replayData.airconditioner1 || [], "watts", j);
        const hvac2 = seriesAt(replayData.airconditioner2 || [], "watts", j);
        x = seriesAt(outsideSeries, "temp", i * (outsideSeries.length > 1 ? (outsideSeries.length - 1) / Math.max(1, frameCount - 1) : 0));
        y = (Number.isFinite(hvac1) ? hvac1 : 0) + (Number.isFinite(hvac2) ? hvac2 : 0);
      }
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push({ i, x, y });
      }
      const occ = occupancyForFrame(i);
      occupancy.push(occ);
    }

    const corr = pearsonCorrelation(points);
    const xs = points.map((p)=>p.x);
    const ys = points.map((p)=>p.y);
    const xStats = basicStats(xs);
    const yStats = basicStats(ys);

    const co2Series = roomSeries.map((s)=>Number(s?.co2)).filter(Number.isFinite);
    const energySeries = circuitSeries.map((s)=>Number(s?.watts)).filter(Number.isFinite);
    const occSeries = occupancy.filter(Number.isFinite).map((v)=>Math.max(v, 0.2));
    const co2PerOcc = co2Series.length && occSeries.length
      ? co2Series.slice(0, occSeries.length).map((v, idx)=>Math.max(0, v - 420) / occSeries[idx])
      : [];
    const energyPerOcc = energySeries.length && occSeries.length
      ? energySeries.slice(0, occSeries.length).map((v, idx)=>v / occSeries[idx])
      : [];
    const co2OccStats = basicStats(co2PerOcc);
    const eOccStats = basicStats(energyPerOcc);
    const ventAdequacy = Number.isFinite(co2OccStats.avg)
      ? (co2OccStats.avg < 70 ? "Good" : co2OccStats.avg < 120 ? "Moderate" : "Poor")
      : "Unknown";

    let insight = "Not enough data to infer a relationship.";
    if (Number.isFinite(corr)) {
      const strength = Math.abs(corr) >= 0.7 ? "strong" : Math.abs(corr) >= 0.4 ? "moderate" : "weak";
      const direction = corr > 0 ? "positive" : "negative";
      insight = `Detected a ${strength} ${direction} correlation (${corr.toFixed(2)}). `;
      if (Number.isFinite(eOccStats.avg)) insight += `Energy per occupant averages ${fmtW(Math.round(eOccStats.avg))}. `;
      if (Number.isFinite(co2OccStats.avg)) insight += `CO2 per occupant delta averages ${co2OccStats.avg.toFixed(1)} ppm/person.`;
    }

    return {
      points,
      corr,
      xStats,
      yStats,
      occupancyStats: basicStats(occupancy.filter(Number.isFinite)),
      co2OccStats,
      eOccStats,
      ventAdequacy,
      insight,
    };
  })();

  const PS={ // panel style
    background:"rgba(10,18,32,0.96)",
    border:"1px solid rgba(125,211,252,0.2)",borderRadius:12,
    boxShadow:"0 12px 40px rgba(2,6,23,0.6),inset 0 1px 0 rgba(255,255,255,0.05)",
    backdropFilter:"blur(20px)",color:"#D1E8FF",fontFamily:UI_FONT_STACK,fontSize:12,
  };

  const Btn=({children,onClick,style={},active=false,danger=false,accent=false,full=false})=>(
    <button onClick={onClick} style={{
      borderRadius:6,border:"1px solid rgba(125,211,252,0.28)",cursor:"pointer",
      fontFamily:UI_FONT_STACK,fontSize:12,fontWeight:600,letterSpacing:"0.01em",
      transition:"all 0.15s ease",padding:"7px 10px",
      width:full?"100%":undefined,
      background:danger?"rgba(220,38,38,0.24)":active?"rgba(37,99,235,0.35)":accent?"rgba(14,165,233,0.24)":"rgba(255,255,255,0.08)",
      color:danger?"#FECACA":active?"#DBEAFE":accent?"#CFFAFE":"#DDEFFF",
      borderColor:danger?"rgba(248,113,113,0.58)":active?"rgba(147,197,253,0.72)":accent?"rgba(125,211,252,0.6)":"rgba(186,230,253,0.35)",
      ...style,
    }}>{children}</button>
  );

  const SL=({children})=>(
    <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:"#A5C8EC",marginBottom:5,marginTop:12}}>{children}</div>
  );
  const Hr=()=><div style={{height:1,background:"rgba(147,197,253,0.2)",margin:"10px 0"}} />;

  const selectStyle={width:"100%",padding:"8px 10px",borderRadius:6,marginBottom:6,background:"rgba(15,23,42,0.92)",color:"#E2F1FF",border:"1px solid rgba(125,211,252,0.42)",fontFamily:UI_FONT_STACK,fontSize:12,outline:"none"};

  return (
    <div style={{width:"100%",height:"100%",position:"relative"}}>
      <style>{`
        @keyframes dot-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.3;transform:scale(0.7)}}
        @keyframes faultPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:rgba(15,23,42,0.3);border-radius:3px}
        ::-webkit-scrollbar-thumb{background:rgba(96,165,250,0.22);border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(96,165,250,0.4)}
        *{scroll-behavior:smooth}
      `}</style>

      {/* Loading */}
      {loading&&(
        <div style={{position:"absolute",zIndex:20,top:16,left:"50%",transform:"translateX(-50%)",...PS,padding:"12px 20px",fontSize:13,color:"#60A5FA",display:"flex",alignItems:"center",gap:10}}>
          <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#3B82F6",animation:"dot-pulse 1.2s infinite",boxShadow:"0 0 8px #3B82F6"}} />
          Initialising digital twin…
        </div>
      )}

      {/* Mode badge */}
      {activeMode!=="default"&&!loading&&(
        <div style={{position:"absolute",zIndex:18,top:16,right:replayOpen?312:16,...PS,padding:"6px 14px",display:"flex",alignItems:"center",gap:8,transition:"right 0.3s ease"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#3B82F6",boxShadow:"0 0 6px #3B82F6",flexShrink:0}} />
          <span style={{color:"#334155",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase"}}>Mode</span>
          <span style={{color:"#93C5FD",fontWeight:700}}>{activeMode}</span>
          {activeHeatmap&&<><span style={{color:"#1E293B"}}>·</span><span style={{color:"#FBBF24"}}>{activeHeatmap}</span></>}
        </div>
      )}

      <div ref={containerRef} style={{width:"100%",height:"100%"}} />

      {/* ── Credit logo (covers Cesium Ion watermark) ────────────────── */}
      <div style={{
        position:"absolute",bottom:0,left:0,zIndex:10,
        background:"linear-gradient(135deg,rgba(10,15,26,0.95),rgba(15,23,42,0.92))",
        backdropFilter:"blur(10px)",
        padding:"8px 16px",borderTopRightRadius:10,
        display:"flex",alignItems:"center",gap:10,
        borderTop:"1px solid rgba(96,165,250,0.15)",
        borderRight:"1px solid rgba(96,165,250,0.15)",
        pointerEvents:"auto"
      }}>
        <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0,letterSpacing:"-0.02em"}}>JW</div>
        <div style={{lineHeight:1.25}}>
          <div style={{fontSize:10,fontWeight:700,color:"#E2F1FF",letterSpacing:"0.02em"}}>Made by: <a href="https://www.linkedin.com/in/joan-waithira/" target="_blank" rel="noopener noreferrer" style={{color:"#93C5FD",textDecoration:"none"}}>Joan Waithira</a></div>
          <div style={{fontSize:8.5,color:"#64748B",letterSpacing:"0.03em"}}>University of Twente — ITC &nbsp;|&nbsp; GATE Institute</div>
        </div>
      </div>

      {/* ── Title bar ──────────────────────────────────────────────────── */}
      {!loading&&(
        <div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",zIndex:14,
          ...PS,padding:"8px 24px",display:"flex",alignItems:"center",gap:10,pointerEvents:"none",whiteSpace:"nowrap"}}>
          <span style={{fontSize:16}}>⬡</span>
          <span style={{fontWeight:700,fontSize:15,color:"#F1F5F9",letterSpacing:"0.01em"}}>Gate Digital Twin</span>
        </div>
      )}

      {/* Toggle controls button — only in expert mode */}
      {showOriginalPanels&&(
        <div style={{
          position:"absolute",top:16,left:showControls?264:16,zIndex:16,
          display:"flex", gap:6,
          transition:"left 0.3s ease",
        }}>
          <button onClick={()=>setShowControls(p=>!p)} style={{
            borderRadius:6,border:"1px solid rgba(255,255,255,0.10)",cursor:"pointer",
            fontFamily:UI_FONT_STACK,fontSize:12,fontWeight:600,
            padding:"10px 14px",background:"rgba(55,60,68,0.82)",color:"#93C5FD",
            boxShadow:"0 4px 16px rgba(0,0,0,0.28)",backdropFilter:"blur(16px)",
          }}>
            {showControls?"← Hide":"☰"}
          </button>
          <button onClick={()=>setShowRolePanel(p=>!p)} style={{
            borderRadius:6,cursor:"pointer",fontFamily:UI_FONT_STACK,fontSize:12,fontWeight:600,
            padding:"10px 14px",
            background:activeRole?"rgba(99,102,241,0.25)":"rgba(55,60,68,0.82)",
            color:activeRole?"#C7D2FE":"#CBD5E1",
            border:"1px solid rgba(255,255,255,0.14)",
            boxShadow:"0 4px 16px rgba(0,0,0,0.28)",backdropFilter:"blur(16px)",
          }}>
            {activeRole
              ? `${{director:"🏢",facilities:"🔧",it:"💻",sustainability:"🌿",worker:"👤",ev:"🚗",visitor:"👋"}[activeRole]||"👤"} ${{director:"Director",facilities:"Facilities",it:"IT",sustainability:"Sustainability",worker:"Worker",ev:"EV",visitor:"Visitor"}[activeRole]||"Role"}`
              : "👤 My Role"}
          </button>
          <button onClick={toggleEnergyFlow} style={{
            borderRadius:6,cursor:"pointer",fontFamily:UI_FONT_STACK,fontSize:12,fontWeight:600,
            padding:"10px 12px",
            background:energyFlowEnabled?"rgba(14,165,233,0.24)":"rgba(55,60,68,0.82)",
            color:energyFlowEnabled?"#BAE6FD":"#CBD5E1",
            border:`1px solid ${energyFlowEnabled?"rgba(125,211,252,0.5)":"rgba(255,255,255,0.14)"}`,
            boxShadow:"0 4px 16px rgba(0,0,0,0.28)",backdropFilter:"blur(16px)",
          }}>
            ⚡ Energy Flow
          </button>
          {(activeRole==="director"||activeRole==="facilities")&&<button
            onClick={()=>setFaultPanelOpen(o=>!o)}
            title="Fault Detection & Diagnostics"
            style={{
              borderRadius:6,cursor:"pointer",fontFamily:UI_FONT_STACK,fontSize:12,fontWeight:600,
              padding:"10px 12px",display:"flex",alignItems:"center",gap:6,
              background:(faultSummary?.critical??0)>0?"rgba(239,68,68,0.12)":(faultSummary?.alert??0)>0?"rgba(251,191,36,0.10)":"rgba(55,60,68,0.82)",
              color:(faultSummary?.critical??0)>0?"#FCA5A5":(faultSummary?.alert??0)>0?"#FDE68A":"#64748B",
              border:`1px solid ${(faultSummary?.critical??0)>0?"rgba(239,68,68,0.5)":(faultSummary?.alert??0)>0?"rgba(251,191,36,0.4)":"rgba(255,255,255,0.14)"}`,
              boxShadow:"0 4px 16px rgba(0,0,0,0.28)",backdropFilter:"blur(16px)",
              animation:(faultSummary?.critical??0)>0?"faultPulse 1.5s ease-in-out infinite":"none",
            }}
          >
            <span>{(faultSummary?.critical??0)>0?"🚨":(faultSummary?.alert??0)>0?"⚠️":(faultSummary?.warning??0)>0?"⚡":"✓"}</span>
            <span>FDD {(faultSummary?.total??0)>0?`· ${faultSummary.total} fault${faultSummary.total>1?"s":""}`:""}</span>
          </button>}
        </div>
      )}
      {/* Role toggle when not in expert mode — top left alongside nothing */}
      {!showOriginalPanels&&!loading&&(
        <div style={{position:"absolute",top:16,left:16,zIndex:16,display:"flex",alignItems:"center",gap:8}}>
          {(activeRole==="director"||activeRole==="facilities")&&<button
            onClick={()=>setFaultPanelOpen(o=>!o)}
            title="Fault Detection & Diagnostics"
            style={{
              borderRadius:6,cursor:"pointer",fontFamily:UI_FONT_STACK,fontSize:12,fontWeight:600,
              padding:"10px 12px",display:"flex",alignItems:"center",gap:6,
              background:(faultSummary?.critical??0)>0?"rgba(239,68,68,0.12)":(faultSummary?.alert??0)>0?"rgba(251,191,36,0.10)":"rgba(55,60,68,0.82)",
              color:(faultSummary?.critical??0)>0?"#FCA5A5":(faultSummary?.alert??0)>0?"#FDE68A":"#64748B",
              border:`1px solid ${(faultSummary?.critical??0)>0?"rgba(239,68,68,0.5)":(faultSummary?.alert??0)>0?"rgba(251,191,36,0.4)":"rgba(255,255,255,0.14)"}`,
              boxShadow:"0 4px 16px rgba(0,0,0,0.28)",backdropFilter:"blur(16px)",
              animation:(faultSummary?.critical??0)>0?"faultPulse 1.5s ease-in-out infinite":"none",
            }}
          >
            <span>{(faultSummary?.critical??0)>0?"🚨":(faultSummary?.alert??0)>0?"⚠️":(faultSummary?.warning??0)>0?"⚡":"✓"}</span>
            <span>{(faultSummary?.total??0)>0?`${faultSummary.total} fault${faultSummary.total>1?"s":""}`:"No faults"}</span>
            {(faultSummary?.total??0)>0&&(
              <span style={{background:(faultSummary?.critical??0)>0?"#EF4444":"#FBBF24",color:"#000",borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {faultSummary.total}
              </span>
            )}
          </button>}
          <button onClick={()=>setShowRolePanel(p=>!p)} style={{
            borderRadius:6,cursor:"pointer",fontFamily:UI_FONT_STACK,fontSize:12,fontWeight:600,
            padding:"10px 14px",
            background:activeRole?"rgba(99,102,241,0.25)":"rgba(55,60,68,0.82)",
            color:activeRole?"#C7D2FE":"#CBD5E1",
            border:"1px solid rgba(255,255,255,0.14)",
            boxShadow:"0 4px 16px rgba(0,0,0,0.28)",backdropFilter:"blur(16px)",
          }}>
            {activeRole
              ? `${{director:"🏢",facilities:"🔧",it:"💻",sustainability:"🌿",worker:"👤",ev:"🚗",visitor:"👋"}[activeRole]||"👤"} ${{director:"Director",facilities:"Facilities",it:"IT",sustainability:"Sustainability",worker:"Worker",ev:"EV",visitor:"Visitor"}[activeRole]||"Role"}`
              : "👤 My Role"}
          </button>
          <button onClick={toggleEnergyFlow} style={{
            borderRadius:6,cursor:"pointer",fontFamily:UI_FONT_STACK,fontSize:12,fontWeight:600,
            padding:"10px 12px",
            background:energyFlowEnabled?"rgba(14,165,233,0.24)":"rgba(55,60,68,0.82)",
            color:energyFlowEnabled?"#BAE6FD":"#CBD5E1",
            border:`1px solid ${energyFlowEnabled?"rgba(125,211,252,0.5)":"rgba(255,255,255,0.14)"}`,
            boxShadow:"0 4px 16px rgba(0,0,0,0.28)",backdropFilter:"blur(16px)",
          }}>
            ⚡ Energy Flow
          </button>
        </div>
      )}

      {/* Toggle replay button — visible for ALL roles */}
      {replayAvailable&&!replayOpen&&(
        <button onClick={()=>setReplayOpen(true)} style={{
          position:"absolute",top:16,right:16,zIndex:16,
          borderRadius:6,border:"1px solid rgba(165,180,252,0.2)",cursor:"pointer",
          fontFamily:UI_FONT_STACK,fontSize:12,fontWeight:600,
          padding:"10px 14px",background:"rgba(55,60,68,0.82)",
          color:"#C4B5FD",boxShadow:"0 4px 16px rgba(0,0,0,0.28)",backdropFilter:"blur(16px)",
        }}>
          ▶ More Information + Replay
        </button>
      )}

      {/* Expert mode toggle (shown when expert mode is on) */}
      {expertMode && (
        <button onClick={()=>{ setExpertMode(false); localStorage.removeItem("dtwin_expert"); }} style={{
          position:"absolute",top:16,right:replayOpen?368:16,zIndex:16,
          borderRadius:6,cursor:"pointer",fontFamily:UI_FONT_STACK,fontSize:11,fontWeight:600,
          padding:"6px 10px",background:"rgba(99,102,241,0.18)",color:"#A5B4FC",
          border:"1px solid rgba(129,140,248,0.35)",backdropFilter:"blur(16px)",
          boxShadow:"0 4px 20px rgba(0,0,0,0.4)",
          transition:"right 0.3s ease",
        }}>
          🔬 Expert — Exit
        </button>
      )}

      {/* ── REPLAY PANEL (visible for ALL roles) ─────────────────────────── */}
      {replayAvailable&&replayOpen&&(
        <div style={{position:"absolute",top:16,right:16,zIndex:15,width:430,maxHeight:"calc(100% - 32px)",overflow:"auto",...PS,padding:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
            <span style={{fontWeight:700,fontSize:14,color:"#E2E8F0"}}>▶ More Information + Replay</span>
            <button onClick={()=>setReplayOpen(false)} style={{background:"rgba(99,102,241,0.25)",border:"1px solid rgba(165,180,252,0.25)",borderRadius:5,color:"#C4B5FD",cursor:"pointer",fontSize:11,fontWeight:600,padding:"4px 10px",fontFamily:UI_FONT_STACK}}>✕ Close</button>
          </div>
          <div style={{fontSize:10,color:"#9AB8D7",marginBottom:8}}>Last 48 hours ending at latest database record · 15 min intervals</div>

          {/* Role-aware banner */}
          {activeRole==="director"&&replayMode==="energy"&&(()=>{
            const r=ROLES.director; const mainData=replayData["main"]||[];
            const totalKwh=mainData.reduce((s,f)=>s+(f.watts/1000)*0.25,0);
            const cost=(totalKwh/2*tariffRate).toFixed(0);
            return <div style={{background:r.accentBg,borderLeft:`3px solid ${r.color}`,borderRadius:"0 6px 6px 0",padding:"6px 10px",fontSize:10,color:r.color,marginBottom:8}}>💰 Your estimated cost this period: €{cost}</div>;
          })()}
          {activeRole==="facilities"&&replayMode==="energy"&&(()=>{
            const r=ROLES.facilities; const overloaded=Object.keys(CIRCUIT_CONFIGS).filter(id=>{const d=replayData[id];if(!d||!d.length) return false;const peak=Math.max(...d.map(f=>f.watts));const avg=d.reduce((s,f)=>s+f.watts,0)/d.length;return avg/peak>0.8;}).length;
            return <div style={{background:r.accentBg,borderLeft:`3px solid ${r.color}`,borderRadius:"0 6px 6px 0",padding:"6px 10px",fontSize:10,color:r.color,marginBottom:8}}>⚠ {overloaded} circuits above 80% peak load</div>;
          })()}
          {activeRole==="sustainability"&&replayMode==="energy"&&(()=>{
            const r=ROLES.sustainability; const mainNow=replayData["main"]?.[replayFrame]?.watts||0;
            const carbonHr=((mainNow/1000)*0.233).toFixed(1);
            return <div style={{background:r.accentBg,borderLeft:`3px solid ${r.color}`,borderRadius:"0 6px 6px 0",padding:"6px 10px",fontSize:10,color:r.color,marginBottom:8}}>🌿 Carbon intensity now: {carbonHr} kg/hr</div>;
          })()}
          {activeRole==="worker"&&replayMode==="climate"&&climateReplayRoom&&(()=>{
            const r=ROLES.worker; const roomMeta=availableRooms.find(rm=>rm.roomNumber===climateReplayRoom);
            return <div style={{background:r.accentBg,borderLeft:`3px solid ${r.color}`,borderRadius:"0 6px 6px 0",padding:"6px 10px",fontSize:10,color:r.color,marginBottom:8}}>👤 Showing your room: {roomMeta?.roomName||climateReplayRoom}</div>;
          })()}
          {activeRole==="visitor"&&replayMode==="energy"&&(()=>{
            const r=ROLES.visitor; const mainNow=replayData["main"]?.[replayFrame]?.watts||0;
            return <div style={{background:r.accentBg,borderLeft:`3px solid ${r.color}`,borderRadius:"0 6px 6px 0",padding:"6px 10px",fontSize:10,color:r.color,marginBottom:8}}>☀️ Solar is generating {(mainNow*0.12/1000).toFixed(1)} kW right now</div>;
          })()}

          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,marginBottom:10}}>
            <Btn active={replayMode==="energy"} onClick={()=>setReplayMode("energy")}>⚡ Energy</Btn>
            <Btn active={replayMode==="climate"} onClick={()=>{ensureClimateReplayData();setReplayMode("climate");}}>🌡 IAQ Rooms</Btn>
            <Btn active={replayMode==="solar"} onClick={()=>setReplayMode("solar")}>☀️ Solar</Btn>
            <Btn active={replayMode==="compare"} onClick={()=>{ensureClimateReplayData(compareRoom||climateReplayRoom);setReplayMode("compare");}}>📈 Compare</Btn>
            <Btn active={replayMode==="scenarios"} onClick={()=>setReplayMode("scenarios")}>⚡ Scenarios</Btn>
            <Btn active={replayMode==="forecast"} onClick={()=>setReplayMode("forecast")}>🔮 Forecast</Btn>
          </div>

          {replayMode==="energy"&&(
            <>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{flex:1}}>
                  <SL>Circuit</SL>
                  <select value={replayCircuit} onChange={e=>setReplayCircuit(e.target.value)} style={selectStyle}>
                    {allCircIds.map(id=><option key={id} value={id}>{CIRCUIT_CONFIGS[id]?.label||id}</option>)}
                  </select>
                </div>
                <button onClick={toggleEnergyFlow} style={{
                  marginTop:14,padding:"5px 10px",borderRadius:5,cursor:"pointer",
                  fontFamily:UI_FONT_STACK,fontSize:10,fontWeight:600,
                  background:energyFlowEnabled?"rgba(34,197,94,0.18)":"rgba(239,68,68,0.18)",
                  color:energyFlowEnabled?"#4ADE80":"#F87171",
                  border:`1px solid ${energyFlowEnabled?"rgba(74,222,128,0.35)":"rgba(248,113,113,0.35)"}`,
                }}>
                  {energyFlowEnabled?"⚡ Flow On":"⚡ Flow Off"}
                </button>
              </div>

              {/* Sparkline */}
              {replayData[replayCircuit]&&(()=>{
                const samples=replayData[replayCircuit];
                const maxW=Math.max(...samples.map(s=>s.watts));
                const W=1000,H=54;
                const pts=samples.map((s,i)=>`${(i/(samples.length-1))*W},${H-(s.watts/maxW)*H}`).join(" ");
                const curX=(replayFrame/(samples.length-1))*W;
                const curY=H-((samples[replayFrame]?.watts||0)/maxW)*H;
                const circColor=CIRCUIT_CONFIGS[replayCircuit]?.color||"#60A5FA";
                const otSeries=outsideTempRef.current;
                let otPts="";
                if(otSeries.length>=2){
                  const otTemps=otSeries.map(d=>d.temp);
                  const minOT=Math.min(...otTemps), maxOT=Math.max(...otTemps);
                  const rangeOT=Math.max(0.001,maxOT-minOT);
                  const interpOT=(idx)=>{
                    const t=(idx/(samples.length-1))*(otSeries.length-1);
                    const lo=Math.floor(t),hi=Math.min(Math.ceil(t),otSeries.length-1),frac=t-lo;
                    return otSeries[lo].temp*(1-frac)+otSeries[hi].temp*frac;
                  };
                  otPts=samples.map((_,i)=>{
                    const temp=interpOT(i);
                    const y=H*0.1+(H*0.8)*(1-(temp-minOT)/rangeOT);
                    return `${(i/(samples.length-1))*W},${y}`;
                  }).join(" ");
                }
                return(
                  <div style={{marginBottom:10}}>
                    <svg viewBox={`0 0 ${W} ${H+2}`} preserveAspectRatio="none" style={{display:"block",width:"100%",height:H+2,borderRadius:4,background:"rgba(10,15,26,0.7)",border:"1px solid rgba(96,165,250,0.06)"}}>
                      <defs>
                        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={circColor} stopOpacity="0.5"/>
                          <stop offset="100%" stopColor={circColor} stopOpacity="0.02"/>
                        </linearGradient>
                      </defs>
                      <polyline points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)" stroke="none"/>
                      <polyline points={pts} fill="none" stroke={circColor} strokeWidth="1.5" strokeLinejoin="round"/>
                      {otPts&&<polyline points={otPts} fill="none" stroke="#FFA040" strokeWidth="1" strokeDasharray="3,2" strokeLinejoin="round" opacity="0.75"/>}
                      <line x1={curX} y1={0} x2={curX} y2={H} stroke="white" strokeWidth={1} strokeOpacity={0.35} strokeDasharray="3,3"/>
                      <circle cx={curX} cy={curY} r={3} fill="white" stroke={circColor} strokeWidth={2}/>
                    </svg>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#334155",marginTop:3}}>
                      <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
                    </div>
                    {otSeries.length>=2&&(
                      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:9,color:"#9AB8D7",marginTop:2}}>
                        <span style={{display:"inline-block",width:16,height:1,borderTop:"1px dashed #FFA040",opacity:0.75}}/>
                        <span style={{color:"#FFA040"}}>Outdoor temp</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Current value */}
              {(()=>{
                const otSeries2=outsideTempRef.current;
                let eOutdoorT=null;
                if(otSeries2.length>=2){
                  const t=(replayFrame/(totalFrames-1))*(otSeries2.length-1);
                  const lo=Math.floor(t),hi=Math.min(Math.ceil(t),otSeries2.length-1),frac=t-lo;
                  eOutdoorT=(otSeries2[lo].temp*(1-frac)+otSeries2[hi].temp*frac).toFixed(1);
                }
                return(
                  <div style={{background:"rgba(10,15,26,0.7)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:8,padding:"10px 12px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:10,color:"#334155",letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:2}}>{currentSample?.time||"--:--"}</div>
                      <div style={{fontSize:22,fontWeight:700,color:CIRCUIT_CONFIGS[replayCircuit]?.color||"#60A5FA",letterSpacing:"-0.02em"}}>{currentSample?fmtW(currentSample.watts):"—"}</div>
                      {eOutdoorT!==null&&<div style={{fontSize:10,color:"#FFA040",marginTop:3}}>Outdoor: {eOutdoorT} C</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:10,color:"#334155",letterSpacing:"0.04em",textTransform:"uppercase"}}>Frame</div>
                      <div style={{fontSize:15,color:"#475569",fontWeight:700}}>{replayFrame+1}/{totalFrames}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Scrubber */}
              <input type="range" min={0} max={totalFrames-1} value={replayFrame}
                onChange={e=>seekReplay(Number(e.target.value))}
                style={{width:"100%",accentColor:CIRCUIT_CONFIGS[replayCircuit]?.color||"#3B82F6",cursor:"pointer",marginBottom:10}}/>

              {/* Playback controls */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:8}}>
                <Btn onClick={()=>seekReplay(Math.max(0,replayFrame-4))}>◀◀ -1h</Btn>
                <Btn onClick={()=>replayPlaying?stopReplay():startReplay()} accent={!replayPlaying} active={replayPlaying}>
                  {replayPlaying?"⏸ Pause":"▶ Play"}
                </Btn>
                <Btn onClick={()=>seekReplay(Math.min(totalFrames-1,replayFrame+4))}>+1h ▶▶</Btn>
              </div>

              <SL>Speed</SL>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:12}}>
                {[0.5,1,2,4].map(s=><Btn key={s} onClick={()=>changeSpeed(s)} active={replaySpeed===s}>{s}×</Btn>)}
              </div>

              <Hr/>

              {/* All-circuit live bar chart */}
              {Object.keys(replayData).length>0&&(
                <>
                  <SL>All Circuits @ {currentSample?.time||"--:--"}</SL>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {allCircIds.map(id=>{
                      const sample=replayData[id]?.[replayFrame]; if(!sample) return null;
                      const maxW=Math.max(...(replayData[id]?.map(s=>s.watts)||[1]));
                      const pct=(sample.watts/maxW)*100;
                      return(
                        <div key={id} style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:CIRCUIT_CONFIGS[id]?.color||"#888",flexShrink:0,boxShadow:`0 0 4px ${CIRCUIT_CONFIGS[id]?.color||"#888"}`}}/>
                          <div style={{flex:1,fontSize:10,color:"#475569",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{CIRCUIT_CONFIGS[id]?.label||id}</div>
                          <div style={{width:56,height:3,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden"}}>
                            <div style={{width:`${pct}%`,height:"100%",background:CIRCUIT_CONFIGS[id]?.color||"#888",borderRadius:2,transition:"width 0.35s ease"}}/>
                          </div>
                          <div style={{fontSize:10,color:"#64748B",minWidth:46,textAlign:"right"}}>{fmtW(sample.watts)}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

            </>
          )}

          {replayMode==="climate"&&(
            <>
              <SL>Room</SL>
              <select
                value={climateReplayRoom}
                onChange={async e=>{
                  const nextRoom=e.target.value;
                  setClimateReplayRoom(nextRoom);
                  const roomKey=toReplayRoomKey(nextRoom);
                  if(roomKey){
                    await ensureClimateReplayData(roomKey);
                    focusClimateRoom(nextRoom);
                    applyClimateFrame(climateReplayFrame,climateReplayMetric,nextRoom,climateApplyToBuilding?"building":"room");
                  }
                }}
                style={selectStyle}
              >
                <option value="">Select room...</option>
                {climateRoomOptions.map(r=><option key={`${r.roomNumber}-${r.floorLevel}`} value={r.roomNumber}>{r.roomNumber} - {r.roomName}</option>)}
              </select>

              <SL>Metric</SL>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:8}}>
                {["temperature","humidity","co2"].map(m=><Btn key={m} active={climateReplayMetric===m} onClick={()=>{setClimateReplayMetric(m);applyClimateFrame(climateReplayFrame,m,climateReplayRoom,climateApplyToBuilding?"building":"room");}}>{metricLabel(m)}</Btn>)}
              </div>

              {activeClimateRoomKey&&climateData[activeClimateRoomKey]&&(()=>{
                const samples=climateData[activeClimateRoomKey];
                const metric=climateReplayMetric;
                const vals=samples.map(s=>Number(s[metric]??0));
                const minV=Math.min(...vals);
                const maxV=Math.max(...vals);
                const range=Math.max(0.001,maxV-minV);
                const W=1000,H=54;
                const pts=samples.map((s,i)=>{
                  const v=Number(s[metric]??0);
                  const y=H-(((v-minV)/range)*H);
                  return `${(i/(samples.length-1))*W},${y}`;
                }).join(" ");
                const curX=(climateReplayFrame/(samples.length-1))*W;
                const curV=Number(samples[climateReplayFrame]?.[metric]??0);
                const curY=H-(((curV-minV)/range)*H);
                const color=metric==="temperature"?"#FB923C":metric==="humidity"?"#38BDF8":"#EF4444";
                const iotSeries=outsideTempRef.current;
                let iotPts="";
                if(iotSeries.length>=2){
                  const iotTemps=iotSeries.map(d=>d.temp);
                  const minIOT=Math.min(...iotTemps),maxIOT=Math.max(...iotTemps),rangeIOT=Math.max(0.001,maxIOT-minIOT);
                  iotPts=samples.map((_,i)=>{
                    const t=(i/(samples.length-1))*(iotSeries.length-1);
                    const lo=Math.floor(t),hi=Math.min(Math.ceil(t),iotSeries.length-1),frac=t-lo;
                    const temp=iotSeries[lo].temp*(1-frac)+iotSeries[hi].temp*frac;
                    const y=H*0.1+(H*0.8)*(1-(temp-minIOT)/rangeIOT);
                    return `${(i/(samples.length-1))*W},${y}`;
                  }).join(" ");
                }
                return(
                  <div style={{marginBottom:10}}>
                    <svg viewBox={`0 0 ${W} ${H+2}`} preserveAspectRatio="none" style={{display:"block",width:"100%",height:H+2,borderRadius:4,background:"rgba(10,15,26,0.7)",border:"1px solid rgba(125,211,252,0.14)"}}>
                      <defs>
                        <linearGradient id="climate-sg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity="0.5"/>
                          <stop offset="100%" stopColor={color} stopOpacity="0.03"/>
                        </linearGradient>
                      </defs>
                      <polyline points={`0,${H} ${pts} ${W},${H}`} fill="url(#climate-sg)" stroke="none"/>
                      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
                      {iotPts&&<polyline points={iotPts} fill="none" stroke="#FFA040" strokeWidth="1" strokeDasharray="3,2" strokeLinejoin="round" opacity="0.75"/>}
                      <line x1={curX} y1={0} x2={curX} y2={H} stroke="white" strokeWidth={1} strokeOpacity={0.35} strokeDasharray="3,3"/>
                      <circle cx={curX} cy={curY} r={3} fill="white" stroke={color} strokeWidth={2}/>
                    </svg>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#9AB8D7",marginTop:3}}>
                      <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
                    </div>
                    {iotSeries.length>=2&&(
                      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:9,color:"#9AB8D7",marginTop:2}}>
                        <span style={{display:"inline-block",width:16,height:1,borderTop:"1px dashed #FFA040",opacity:0.75}}/>
                        <span style={{color:"#FFA040"}}>Outdoor temp</span>
                        <span style={{marginLeft:"auto",color:"#64748B",fontSize:8}}>({new Date(iotSeries[0].timestampMs).toLocaleDateString()} period)</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(()=>{
                const ciotSeries=outsideTempRef.current;
                let cOutdoorT=null;
                if(ciotSeries.length>=2){
                  const t=(climateReplayFrame/(climateTotalFrames-1))*(ciotSeries.length-1);
                  const lo=Math.floor(t),hi=Math.min(Math.ceil(t),ciotSeries.length-1),frac=t-lo;
                  cOutdoorT=(ciotSeries[lo].temp*(1-frac)+ciotSeries[hi].temp*frac).toFixed(1);
                }
                return(
                  <div style={{background:"rgba(10,15,26,0.7)",border:"1px solid rgba(125,211,252,0.2)",borderRadius:8,padding:"10px 12px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:10,color:"#9AB8D7",letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:2}}>{climateCurrentSample?.time||"--:--"}</div>
                      <div style={{fontSize:21,fontWeight:700,color:climateReplayMetric==="temperature"?"#FB923C":climateReplayMetric==="humidity"?"#38BDF8":"#F87171",letterSpacing:"-0.02em"}}>{climateCurrentSample?fmtClimate(climateReplayMetric,Number(climateCurrentSample[climateReplayMetric]??0)):"-"}</div>
                      {cOutdoorT!==null&&<div style={{fontSize:10,color:"#FFA040",marginTop:3}}>🌡 {cOutdoorT} °C outdoor</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:10,color:"#9AB8D7",letterSpacing:"0.04em",textTransform:"uppercase"}}>Frame</div>
                      <div style={{fontSize:15,color:"#CFE8FF",fontWeight:700}}>{climateReplayFrame+1}/{climateTotalFrames}</div>
                    </div>
                  </div>
                );
              })()}

              <input type="range" min={0} max={climateTotalFrames-1} value={climateReplayFrame}
                onChange={e=>seekClimateReplay(Number(e.target.value))}
                style={{width:"100%",accentColor:climateReplayMetric==="temperature"?"#FB923C":climateReplayMetric==="humidity"?"#38BDF8":"#EF4444",cursor:"pointer",marginBottom:10}}/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:8}}>
                <Btn onClick={()=>seekClimateReplay(Math.max(0,climateReplayFrame-4))}>◀◀ -1h</Btn>
                <Btn onClick={()=>climateReplayPlaying?stopClimateReplay():startClimateReplay()} accent={!climateReplayPlaying} active={climateReplayPlaying}>
                  {climateReplayPlaying?"⏸ Pause":"▶ Play"}
                </Btn>
                <Btn onClick={()=>seekClimateReplay(Math.min(climateTotalFrames-1,climateReplayFrame+4))}>+1h ▶▶</Btn>
              </div>

              <SL>Speed</SL>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:10}}>
                {[0.5,1,2,4].map(s=><Btn key={s} onClick={()=>changeClimateSpeed(s)} active={climateReplaySpeed===s}>{s}x</Btn>)}
              </div>

              <Btn full accent active={climateApplyToBuilding} onClick={async()=>{
                const nextApplyToBuilding=!climateApplyToBuilding;
                setClimateApplyToBuilding(nextApplyToBuilding);
                if(nextApplyToBuilding){
                  await ensureAllClimateReplayData();
                  if(activeClimateRoomKey) focusClimateRoom(activeClimateRoomKey);
                  applyClimateFrame(climateReplayFrame,climateReplayMetric,climateReplayRoom,"building");
                } else {
                  applyClimateFrame(climateReplayFrame,climateReplayMetric,climateReplayRoom,"room");
                }
              }}>
                {climateApplyToBuilding?"Applied to Building":"Apply to Building"}
              </Btn>

              <div style={{fontSize:10,color:"#9AB8D7",marginTop:8,lineHeight:1.5}}>
                Replays Postgres room telemetry for temperature, humidity, and CO2. Use Apply to Building to keep the whole floorplan shaded as you switch metrics.
              </div>
            </>
          )}

          {replayMode==="solar"&&<SolarPanel replayData={replayData} replayDataRef={replayDataRef} tariffRate={tariffRate} pvDataRef={pvDataRef} getBuildingJson={getBuildingJson}/>}

          {replayMode==="compare"&&(
            <>
              <SL>Compare Room</SL>
              <select value={compareRoom} onChange={(e)=>{setCompareRoom(e.target.value);}} style={selectStyle}>
                <option value="">Select room...</option>
                {climateRoomOptions.map(r=><option key={`${r.roomNumber}-${r.floorLevel}`} value={r.roomNumber}>{r.roomNumber} - {r.roomName}</option>)}
              </select>

              <SL>Compare Circuit</SL>
              <select value={compareCircuit} onChange={(e)=>setCompareCircuit(e.target.value)} style={selectStyle}>
                {allCircIds.map(id=><option key={id} value={id}>{CIRCUIT_CONFIGS[id]?.label||id}</option>)}
              </select>

              <SL>Lag</SL>
              <select value={compareLag} onChange={(e)=>setCompareLag(Number(e.target.value))} style={selectStyle}>
                <option value={-8}>-2h</option>
                <option value={-4}>-1h</option>
                <option value={0}>0h</option>
                <option value={4}>+1h</option>
                <option value={8}>+2h</option>
              </select>

              <SL>Metric Pair</SL>
              <select value={comparePair} onChange={(e)=>setComparePair(e.target.value)} style={selectStyle}>
                <option value="energy_vs_temp">energy vs temp</option>
                <option value="energy_vs_humidity">energy vs humidity</option>
                <option value="energy_vs_co2">energy vs CO2</option>
                <option value="ovk_vs_co2">OVK vs CO2</option>
                <option value="outdoor_temp_vs_hvac">outdoor temp vs HVAC</option>
              </select>

              <SL>Occupancy Source</SL>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:10}}>
                {["auto","measured","estimated","inferred"].map(m=><Btn key={m} onClick={()=>setOccupancyMode(m)} active={occupancyMode===m}>{m}</Btn>)}
              </div>

              {compareAnalysis&&compareAnalysis.points.length>5&&(()=>{
                const pts=compareAnalysis.points;
                const W=1000, H=72;
                const xs=pts.map((p)=>p.x), ys=pts.map((p)=>p.y);
                const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
                const rangeX=Math.max(0.001,maxX-minX), rangeY=Math.max(0.001,maxY-minY);
                const lineA=pts.map((p,i)=>`${(i/(pts.length-1))*W},${H-((p.x-minX)/rangeX)*H}`).join(" ");
                const lineB=pts.map((p,i)=>`${(i/(pts.length-1))*W},${H-((p.y-minY)/rangeY)*H}`).join(" ");
                return (
                  <>
                    <SL>Dual Line Chart</SL>
                    <svg viewBox={`0 0 ${W} ${H+2}`} preserveAspectRatio="none" style={{display:"block",width:"100%",height:H+2,borderRadius:4,background:"rgba(10,15,26,0.7)",border:"1px solid rgba(125,211,252,0.14)",marginBottom:10}}>
                      <polyline points={lineA} fill="none" stroke="#60A5FA" strokeWidth="1.6"/>
                      <polyline points={lineB} fill="none" stroke="#F59E0B" strokeWidth="1.6"/>
                    </svg>

                    <SL>Scatter Chart</SL>
                    <svg viewBox={`0 0 ${W} ${H+2}`} preserveAspectRatio="none" style={{display:"block",width:"100%",height:H+2,borderRadius:4,background:"rgba(10,15,26,0.7)",border:"1px solid rgba(125,211,252,0.14)",marginBottom:10}}>
                      {pts.map((p,idx)=>{
                        const x=((p.x-minX)/rangeX)*W;
                        const y=H-((p.y-minY)/rangeY)*H;
                        return <circle key={idx} cx={x} cy={y} r={2.2} fill="#7DD3FC" opacity={0.75}/>;
                      })}
                    </svg>
                  </>
                );
              })()}

              <SL>Correlation</SL>
              <div style={{fontSize:15,fontWeight:700,color:Number.isFinite(compareAnalysis?.corr)?"#93C5FD":"#64748B",marginBottom:8}}>
                {Number.isFinite(compareAnalysis?.corr) ? compareAnalysis.corr.toFixed(3) : "N/A"}
              </div>

              <SL>Min/Max/Avg</SL>
              <div style={{fontSize:10,color:"#CFE8FF",lineHeight:1.7,marginBottom:8}}>
                <div>X: min {Number.isFinite(compareAnalysis?.xStats?.min)?compareAnalysis.xStats.min.toFixed(2):"-"} · max {Number.isFinite(compareAnalysis?.xStats?.max)?compareAnalysis.xStats.max.toFixed(2):"-"} · avg {Number.isFinite(compareAnalysis?.xStats?.avg)?compareAnalysis.xStats.avg.toFixed(2):"-"}</div>
                <div>Y: min {Number.isFinite(compareAnalysis?.yStats?.min)?compareAnalysis.yStats.min.toFixed(2):"-"} · max {Number.isFinite(compareAnalysis?.yStats?.max)?compareAnalysis.yStats.max.toFixed(2):"-"} · avg {Number.isFinite(compareAnalysis?.yStats?.avg)?compareAnalysis.yStats.avg.toFixed(2):"-"}</div>
                <div>Occupancy avg: {Number.isFinite(compareAnalysis?.occupancyStats?.avg)?compareAnalysis.occupancyStats.avg.toFixed(2):"-"}</div>
                <div>CO2/occupant avg: {Number.isFinite(compareAnalysis?.co2OccStats?.avg)?compareAnalysis.co2OccStats.avg.toFixed(1):"-"} ppm/person</div>
                <div>Energy/occupant avg: {Number.isFinite(compareAnalysis?.eOccStats?.avg)?fmtW(Math.round(compareAnalysis.eOccStats.avg)):"-"}</div>
                <div>Ventilation adequacy: {compareAnalysis?.ventAdequacy||"Unknown"}</div>
              </div>

              <SL>Insight</SL>
              <div style={{fontSize:10,color:"#9AB8D7",lineHeight:1.6}}>{compareAnalysis?.insight||"Not enough data yet."}</div>
            </>
          )}

          {replayMode==="scenarios"&&(
            <ScenarioPanel
              replayDataRef={replayDataRef}
              pvDataRef={pvDataRef}
              tariffRate={tariffRate}        setTariffRate={setTariffRate}
              occupancyLevel={occupancyLevel} setOccupancyLevel={setOccupancyLevel}
              carbonPrice={carbonPrice}       setCarbonPrice={setCarbonPrice}
              scenarioGoal={scenarioGoal}     setScenarioGoal={setScenarioGoal}
              appliedScenarios={appliedScenarios} setAppliedScenarios={setAppliedScenarios}
              scenarioResult={scenarioResult}     setScenarioResult={setScenarioResult}
              activeRoleProp={activeRole}
            />
          )}

          {replayMode==="forecast"&&(
            <ForecastPanel getPowerJson={getPowerJson} circuitConfigs={CIRCUIT_CONFIGS} selectStyle={selectStyle}/>
          )}
        </div>
      )}

      {/* ── MAIN CONTROLS (hidden in role-first mode unless expert) ──────── */}
      {showOriginalPanels&&showControls&&(
        <div style={{position:"absolute",top:16,left:16,zIndex:15,width:240,maxHeight:"calc(100% - 32px)",overflow:"auto",...PS,padding:14}}>
          <div style={{fontWeight:700,fontSize:14,color:"#E2E8F0",marginBottom:12}}>Building Twin</div>

          <Btn onClick={zoomToBuilding} full>↺ Whole Building</Btn>
          <Btn onClick={showExteriorModel} full accent style={{marginTop:6}}>
            🧱 Show 3D Model
          </Btn>
          {!i3sAvailable&&(
            <div style={{marginTop:8,fontSize:10,lineHeight:1.5,color:"#FCA5A5",background:"rgba(127,29,29,0.25)",border:"1px solid rgba(248,113,113,0.45)",borderRadius:6,padding:"6px 8px"}}>
              3D model source is unavailable right now. Showing room geometry fallback.
            </div>
          )}

          <SL>Heatmap</SL>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:5}}>
            {[["temperature","🌡 Temp"],["co2","💨 CO₂"],["humidity","💧 Humid"],["occupancy","👤 Occ"]].map(([m,label])=>(
              <Btn key={m} onClick={()=>showHeatmap(m)} active={activeHeatmap===m}>{label}</Btn>
            ))}
          </div>
          <Btn onClick={()=>{resetStyles();showOnly(()=>false);if(i3sRef.current){i3sRef.current.show=true;}else{roomEntitiesRef.current.forEach(e=>{e.show=true;});}}} full style={{marginBottom:6}}>× Clear</Btn>

          <Hr/>
          <Btn onClick={showAlerts} danger full style={{marginBottom:6}}>⚠ Show Alerts</Btn>

          <SL>Energy Flow</SL>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}>
            <Btn onClick={()=>showEnergyFlow(null)} accent>⚡ All</Btn>
            <Btn onClick={hideEnergyFlow}>✕ Hide</Btn>
          </div>

          <SL>Sensors</SL>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}>
            <Btn onClick={()=>showSensorMarkers("all")} accent>📡 Show</Btn>
            <Btn onClick={hideSensorMarkers}>✕ Hide</Btn>
          </div>

          <Hr/>
          <SL>Floors</SL>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,marginBottom:4}}>
            {availableFloors.map(floor=><Btn key={floor} onClick={()=>zoomToFloor(floor)}>FL {floor}</Btn>)}
          </div>

          <SL>Room</SL>
          <input
            type="text"
            value={searchQuery}
            placeholder="Search room or circuit..."
            onChange={e=>setSearchQuery(e.target.value)}
            onKeyDown={e=>{
              if(e.key==="Enter") searchAndNavigate(searchQuery);
            }}
            style={{
              width:"100%",padding:"8px 10px",borderRadius:6,marginBottom:6,
              background:"rgba(15,23,42,0.92)",color:"#E2F1FF",
              border:"1px solid rgba(125,211,252,0.42)",
              fontFamily:UI_FONT_STACK,fontSize:12,outline:"none",
            }}
          />
          <Btn
            onClick={()=>searchAndNavigate(searchQuery)}
            full
            accent
            style={{marginBottom:6}}
          >
            Search
          </Btn>

          <select value={selectedRoom} onChange={e=>setSelectedRoom(e.target.value)} style={selectStyle}>
            <option value="">Select room…</option>
            {availableRooms.map(r=><option key={`${r.roomNumber}-${r.floorLevel}`} value={r.roomNumber}>{r.roomNumber} — {r.roomName} (F{r.floorLevel})</option>)}
          </select>
          <Btn onClick={()=>{if(selectedRoom) zoomToRoom(selectedRoom);}} full active={!!selectedRoom} style={{opacity:selectedRoom?1:0.4,cursor:selectedRoom?"pointer":"not-allowed",marginBottom:4}}>
            Zoom to Room
          </Btn>

          <SL>Circuit</SL>
          <select value={selectedCircuit} onChange={e=>setSelectedCircuit(e.target.value)} style={selectStyle}>
            <option value="">Select circuit…</option>
            {Object.entries(CIRCUIT_CONFIGS).map(([id,cfg])=><option key={id} value={id}>{cfg.label}</option>)}
          </select>
          <Btn onClick={()=>{if(selectedCircuit) zoomToCircuit(selectedCircuit);}} full active={!!selectedCircuit} style={{opacity:selectedCircuit?1:0.4,cursor:selectedCircuit?"pointer":"not-allowed"}}>
            Zoom to Circuit
          </Btn>

          <Hr/>
          {/* <div style={{fontSize:9,color:"#1E293B",lineHeight:2,letterSpacing:"0.03em"}}>
            {["fly_to_coordinates","zoom_to_floor","zoom_to_room","zoom_to_circuit","show_heatmap","highlight_rooms_by_threshold","show_alerts","show_energy_flow","compare_floors","reset_view"].map(cmd=>(
              <div key={cmd}><span style={{color:"#1E3A5F"}}>▸ </span><span style={{color:"#3B82F6"}}>{cmd}</span></div>
            ))}
          </div> */}
        </div>
      )}

      {/* ── ROLE PANEL ───────────────────────────────────────────────────── */}
      <RolePanel
        replayData={replayDataRef.current}
        climateData={climateReplayDataRef.current}
        pvData={pvDataRef.current}
        outsideTemp={outsideTempRef.current}
        availableRooms={availableRooms}
        availableFloors={availableFloors}
        onClose={()=>setShowRolePanel(false)}
        tariffRate={tariffRate||0.22}
        visible={rolePanelVisible}
        onRoleChange={(roleId)=>setActiveRole(roleId)}
        onExpertMode={()=>{ setExpertMode(true); setShowRolePanel(false); localStorage.setItem("dtwin_expert","1"); }}
        initialRole={activeRole}
        leftOffset={showOriginalPanels&&showControls?272:16}
        activeHeatmap={activeHeatmap}
      />

      {/* ── FAULT PANEL ────────────────────────────────────────────────────── */}
      {faultPanelOpen&&!loading&&(activeRole==="director"||activeRole==="facilities")&&(
        <div style={{
          position:"absolute",
          top:16,
          left: rolePanelVisible ? (showOriginalPanels&&showControls ? 272+240+12 : 16+240+12) : 16,
          zIndex:16,
          width:300,
        }}>
          <FaultPanel
            faults={faults}
            summary={faultSummary}
            faultHistory={faultHistory}
            clearHistory={clearHistory}
            replayFrame={replayFrame}
            onClose={()=>setFaultPanelOpen(false)}
          />
        </div>
      )}

      {/* ── HOVER TOOLTIP ──────────────────────────────────────────────────── */}
      {hoveredRoom&&hoveredRoom.value!==null&&(
        <div style={{
          position:"absolute",left:hoveredRoom.x,top:hoveredRoom.y,
          zIndex:30,pointerEvents:"none",
          background:"rgba(10,15,30,0.93)",color:"#E2F1FF",
          border:"1px solid rgba(125,211,252,0.35)",borderRadius:8,
          padding:"8px 12px",fontSize:12,lineHeight:1.5,
          boxShadow:"0 4px 16px rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",maxWidth:200,
        }}>
          <div style={{fontWeight:700,marginBottom:2,color:"#7DD3FC"}}>{hoveredRoom.name}</div>
          <div style={{fontSize:10,color:"#64748B",marginBottom:4}}>Room {hoveredRoom.rn} · Floor {hoveredRoom.floor}</div>
          <div style={{fontSize:15,fontWeight:700,color:"#F1F5F9"}}>
            {typeof hoveredRoom.value==="number"
              ? hoveredRoom.value.toFixed(hoveredRoom.metric==="co2"||hoveredRoom.metric==="occupancy"?0:1)
              : hoveredRoom.value}
            <span style={{fontSize:11,fontWeight:400,color:"#94A3B8",marginLeft:2}}>{hoveredRoom.unit}</span>
          </div>
        </div>
      )}

      {/* ── BUILDING SUMMARY STRIP — only when a metric is actively selected ── */}
      {buildingSummary&&activeHeatmap&&(()=>{
        const dp=buildingSummary.metric==="co2"||buildingSummary.metric==="occupancy"?0:1;
        const fmt=v=>Number(v).toFixed(dp)+buildingSummary.unit;
        const {min,max,avg,alertCount,best,worst,metric}=buildingSummary;
        const ts=animFramesRef.current[animFrame]?.label;
        return(
          <div style={{
            position:"absolute",bottom:116,left:"50%",transform:"translateX(-50%)",
            zIndex:20,pointerEvents:"none",
            background:"rgba(10,15,30,0.92)",border:"1px solid rgba(125,211,252,0.2)",
            borderRadius:8,padding:"6px 12px",backdropFilter:"blur(12px)",
            boxShadow:"0 4px 16px rgba(0,0,0,0.5)",
            display:"flex",gap:6,alignItems:"stretch",
          }}>
            {/* MIN */}
            <div style={{textAlign:"center",minWidth:110,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:6,padding:"5px 8px"}}>
              <div style={{fontSize:8,color:"#6EE7B7",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:1}}>▼ Min Room</div>
              <div style={{fontSize:13,fontWeight:700,color:"#34D399",lineHeight:1.2}}>{fmt(min)}</div>
              <div style={{fontSize:8,color:"#6EE7B7",marginTop:2,maxWidth:106,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600}}>{best?.name??"—"}</div>
              <div style={{fontSize:7,color:"#334155",marginTop:1}}>Floor {best?.floor??"-"}</div>
            </div>
            {/* AVG */}
            <div style={{textAlign:"center",minWidth:90,background:"rgba(37,99,235,0.1)",border:"1px solid rgba(96,165,250,0.25)",borderRadius:6,padding:"5px 8px"}}>
              <div style={{fontSize:8,color:"#93C5FD",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:1}}>≈ Avg</div>
              <div style={{fontSize:13,fontWeight:700,color:"#60A5FA",lineHeight:1.2}}>{fmt(avg)}</div>
              <div style={{fontSize:7,color:"#475569",marginTop:2}}>{buildingSummary.byRoom?.length??0} rooms</div>
            </div>
            {/* MAX */}
            <div style={{textAlign:"center",minWidth:110,background:"rgba(220,38,38,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:6,padding:"5px 8px"}}>
              <div style={{fontSize:8,color:"#FCA5A5",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:1}}>▲ Max Room</div>
              <div style={{fontSize:13,fontWeight:700,color:"#F87171",lineHeight:1.2}}>{fmt(max)}</div>
              <div style={{fontSize:8,color:"#FCA5A5",marginTop:2,maxWidth:106,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600}}>{worst?.name??"—"}</div>
              <div style={{fontSize:7,color:"#334155",marginTop:1}}>Floor {worst?.floor??"-"}</div>
            </div>
            {/* ALERTS */}
            <div style={{textAlign:"center",minWidth:60,background:alertCount>0?"rgba(180,83,9,0.13)":"rgba(16,185,129,0.07)",border:`1px solid ${alertCount>0?"rgba(251,191,36,0.35)":"rgba(74,222,128,0.2)"}`,borderRadius:6,padding:"5px 8px"}}>
              <div style={{fontSize:8,color:alertCount>0?"#FCD34D":"#86EFAC",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:1}}>⚠ Alerts</div>
              <div style={{fontSize:16,fontWeight:700,color:alertCount>0?"#FBBF24":"#4ADE80",lineHeight:1.2}}>{alertCount}</div>
              <div style={{fontSize:7,color:"#475569",marginTop:2}}>rooms</div>
            </div>
            {/* Timestamp */}
            {ts&&(
              <div style={{textAlign:"center",minWidth:48,background:"rgba(30,58,138,0.18)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:6,padding:"5px 8px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
                <div style={{fontSize:7,color:"#60A5FA",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:2}}>Time</div>
                <div style={{fontSize:13,fontWeight:700,color:"#BAE6FD",fontVariantNumeric:"tabular-nums"}}>{ts}</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── COLOR LEGEND ───────────────────────────────────────────────────── */}
      {activeHeatmap&&(()=>{
        const LEGENDS={
          temperature:{stops:["#3B82F6","#22C55E","#FB923C","#EF4444"],min:"15°C",mid:"22°C",max:"30°C",label:"Temperature"},
          co2:        {stops:["#22C55E","#FACC15","#EF4444"],          min:"400",  mid:"800",  max:"1200 ppm",label:"CO₂"},
          humidity:   {stops:["#EF4444","#22C55E","#3B82F6"],          min:"20%",  mid:"50%",  max:"80%",label:"Humidity"},
          occupancy:  {stops:["#F0F0F0","#FB923C","#EF4444"],          min:"0",    mid:"5",    max:"10+",label:"Occupancy"},
        };
        const leg=LEGENDS[activeHeatmap];if(!leg) return null;
        const gradId=`lg-${activeHeatmap}`;
        return(
          <div style={{
            position:"absolute",bottom:buildingSummary?192:116,right:16,zIndex:20,
            background:"rgba(10,15,30,0.90)",border:"1px solid rgba(125,211,252,0.2)",
            borderRadius:8,padding:"10px 12px",backdropFilter:"blur(10px)",
            boxShadow:"0 4px 20px rgba(0,0,0,0.45)",minWidth:130,
          }}>
            <div style={{fontSize:10,color:"#7DD3FC",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:6}}>{leg.label}</div>
            <svg width="106" height="14" style={{display:"block",borderRadius:3,marginBottom:4}}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                  {leg.stops.map((c,i)=><stop key={i} offset={`${(i/(leg.stops.length-1))*100}%`} stopColor={c}/>)}
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="106" height="14" fill={`url(#${gradId})`} rx="2"/>
            </svg>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#94A3B8"}}>
              <span>{leg.min}</span><span>{leg.mid}</span><span>{leg.max}</span>
            </div>
          </div>
        );
      })()}

      {/* ── HEATMAP TIMELINE BAR ───────────────────────────────────────────── */}
      {animReady&&activeHeatmap&&(
        <div style={{
          position:"absolute",bottom:16,
          left:"50%",transform:"translateX(-50%)",
          zIndex:20,
          background:"rgba(10,15,30,0.92)",border:"1px solid rgba(125,211,252,0.22)",
          borderRadius:12,padding:"10px 16px",backdropFilter:"blur(12px)",
          boxShadow:"0 6px 24px rgba(0,0,0,0.5)",
          display:"flex",flexDirection:"column",gap:8,alignItems:"center",
          minWidth:420,
        }}>

          {/* Row 1 — metric selector */}
          <div style={{display:"flex",gap:6,width:"100%",justifyContent:"center"}}>
            {[
              {m:"temperature", icon:"🌡", label:"Temp"},
              {m:"co2",         icon:"💨", label:"CO₂"},
              {m:"humidity",    icon:"💧", label:"Humid"},
              {m:"occupancy",   icon:"👤", label:"Occ"},
            ].map(({m,icon,label})=>(
              <button key={m} onClick={()=>showHeatmap(m)} style={{
                flex:1,padding:"5px 0",borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:600,
                border:`1px solid ${activeHeatmap===m?"rgba(125,211,252,0.7)":"rgba(125,211,252,0.18)"}`,
                background:activeHeatmap===m?"rgba(37,99,235,0.4)":"rgba(255,255,255,0.07)",
                color:activeHeatmap===m?"#BAE6FD":"#94A3B8",
                transition:"all 0.15s",
              }}>{icon} {label}</button>
            ))}
            {activeHeatmap&&(
              <button onClick={()=>{resetStyles();showOnly(()=>false);if(i3sRef.current){i3sRef.current.show=true;}else{roomEntitiesRef.current.forEach(e=>{e.show=true;});}}} style={{
                padding:"5px 10px",borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:600,
                border:"1px solid rgba(248,113,113,0.35)",background:"rgba(127,29,29,0.25)",color:"#FCA5A5",
              }}>✕</button>
            )}
          </div>

          {/* Row 2 — playback controls + scrubber + timestamp */}
          <div style={{display:"flex",alignItems:"center",gap:10,width:"100%"}}>
            <button onClick={()=>setAnimPlaying(p=>!p)} style={{
              background:animPlaying?"rgba(59,130,246,0.4)":"rgba(255,255,255,0.1)",
              border:`1px solid ${animPlaying?"rgba(96,165,250,0.6)":"rgba(125,211,252,0.3)"}`,
              borderRadius:7,color:"#E2F1FF",fontSize:15,
              width:34,height:28,cursor:"pointer",flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>{animPlaying?"⏸":"▶"}</button>

            <div style={{flex:1,display:"flex",flexDirection:"column",gap:3}}>
              <input type="range" min={0} max={95} value={animFrame}
                onChange={e=>{const f=Number(e.target.value);setAnimFrame(f);applyAnimFrame(f);}}
                style={{width:"100%",accentColor:"#3B82F6",cursor:"pointer",margin:0}}
              />
              {/* tick marks at 00, 06, 12, 18 */}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#475569",paddingLeft:2,paddingRight:2}}>
                {["00:00","06:00","12:00","18:00","24:00"].map(t=><span key={t}>{t}</span>)}
              </div>
            </div>

            {/* Timestamp badge */}
            <div style={{
              background:"rgba(30,58,138,0.5)",border:"1px solid rgba(96,165,250,0.4)",
              borderRadius:7,padding:"4px 10px",textAlign:"center",flexShrink:0,minWidth:52,
            }}>
              <div style={{fontSize:9,color:"#60A5FA",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:1}}>Time</div>
              <div style={{fontSize:13,fontWeight:700,color:"#E2F1FF",fontVariantNumeric:"tabular-nums",letterSpacing:"0.04em"}}>
                {animFramesRef.current[animFrame]?.label??"00:00"}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

async function getPowerJson(path, params = {}) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const directUrl = new URL(`${POWER_API_BASE}/${cleanPath}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") directUrl.searchParams.append(key, value);
  });

  try {
    const response = await fetch(directUrl.toString());
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } catch (directError) {
    const fallbackUrl = new URL(`/${cleanPath}`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== "") fallbackUrl.searchParams.append(key, value);
    });
    const fallbackResponse = await fetch(fallbackUrl.toString());
    if (!fallbackResponse.ok) throw directError;
    return fallbackResponse.json();
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function interpByIndex(samples, idx, key) {
  if (!Array.isArray(samples) || !samples.length) return NaN;
  const i = clamp(idx, 0, samples.length - 1);
  const lo = Math.floor(i);
  const hi = Math.min(Math.ceil(i), samples.length - 1);
  const frac = i - lo;
  const a = Number(samples[lo]?.[key]);
  const b = Number(samples[hi]?.[key]);
  if (!Number.isFinite(a) && !Number.isFinite(b)) return NaN;
  if (!Number.isFinite(a)) return b;
  if (!Number.isFinite(b)) return a;
  return a * (1 - frac) + b * frac;
}

function pearsonCorrelation(points) {
  const clean = (Array.isArray(points) ? points : []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  const n = clean.length;
  if (n < 2) return NaN;
  let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
  clean.forEach(({ x, y }) => {
    sumX += x; sumY += y; sumXX += x * x; sumYY += y * y; sumXY += x * y;
  });
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  return den ? num / den : NaN;
}

function basicStats(values) {
  const arr = (Array.isArray(values) ? values : []).filter(Number.isFinite);
  if (!arr.length) return { min: NaN, max: NaN, avg: NaN };
  const sum = arr.reduce((a, b) => a + b, 0);
  return { min: Math.min(...arr), max: Math.max(...arr), avg: sum / arr.length };
}

function estimateScheduleOccupancy(roomName, hour) {
  const n = String(roomName || "").toLowerCase();
  const workHour = hour >= 8 && hour <= 18;
  const isMeeting = n.includes("meeting") || n.includes("conference") || n.includes("hall") || n.includes("sap");
  const isOffice = n.includes("office") || n.includes("director") || n.includes("assistant") || n.includes("research") || n.includes("it");
  const isCirculation = n.includes("corridor") || n.includes("foyer") || n.includes("lobby");
  if (!workHour) return isMeeting ? 1 : isOffice ? 1 : 0;
  if (isMeeting) return 6;
  if (isOffice) return 3;
  if (isCirculation) return 1;
  return 2;
}

function inferOccupancySample(sample, prevSample, roomName, mode = "auto") {
  const measured = Number(sample?.occupancy);
  const hour = Number(sample?.hour ?? 12);
  const scheduleBase = estimateScheduleOccupancy(roomName, hour);
  const co2 = Number(sample?.co2);
  const prevCo2 = Number(prevSample?.co2);
  const co2Level = Number.isFinite(co2) ? clamp((co2 - 430) / 110, 0, 20) : 0;
  const slope = (Number.isFinite(co2) && Number.isFinite(prevCo2)) ? (co2 - prevCo2) : 0;
  const slopeBoost = clamp(slope / 18, -2, 6);
  const inferred = clamp(scheduleBase * 0.6 + co2Level * 0.4 + slopeBoost, 0, 25);

  if (mode === "measured") return Number.isFinite(measured) ? measured : NaN;
  if (mode === "estimated") return scheduleBase;
  if (mode === "inferred") return inferred;
  return Number.isFinite(measured) ? measured : inferred;
}

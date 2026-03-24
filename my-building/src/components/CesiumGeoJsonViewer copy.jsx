import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { MOCK_ROOM_DATA, ROOM_BMS_ENDPOINTS } from "../utils/roomDataUtils";



const ION_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlNDgxNjNjYS1kMTY1LTRhOTQtODFiZC1mYWMyNzY4OWVjN2YiLCJpZCI6MzQzOTQwLCJpYXQiOjE3NTg2MzQ0MTR9.pQiAchoUyxCsz38HgMWMnBs4ua7xTKPcbTE2s5EnbK4";

const I3S_URL =
  "https://tiles-eu1.arcgis.com/XYGfXK4rEYwaj5A0/arcgis/rest/services/Gate_export_20241104_r23_reduced_20241114_notex/SceneServer";
const GEOJSON_URL = "/floorplans/Floorplan_polygon_4326.geojson";
const TELEMETRY_API_BASE =
  import.meta.env.VITE_BUILDING_API_BASE || "http://127.0.0.1:3001";

const LIVE_REFRESH_MS = 30000;
const ALL_FLOORS_VALUE = "__all_floors__";

const ROOM_TREND_ENDPOINT_MAP = {
  gatebms__fl0_conference_room: "/ts_fl0_conference_room",
  gatebms__fl0_conference_room_82000968: "/ts_fl0_conference_room__82000968",
  gatebms__fl0_conference_room_82000969: "/ts_fl0_conference_room__82000969",
  gatebms__fl0_conference_room_82000970: "/ts_fl0_conference_room__82000970",
  gatebms__fl0_conference_room_82000971: "/ts_fl0_conference_room__82000971",
  gatebms__fl0_conference_room_avg: "/ts_fl0_conference_room_avg",
  gatebms__fl0_kitchen: "/ts_fl0_kitchen",
  gatebms__fl0_lobby: "/ts_fl0_lobby",
  gatebms__fl1_hall_sap: "/ts_fl1_hall_sap",
  gatebms__fl1_meeting_room: "/ts_fl1_meeting_room",
  gatebms__fl1_training_lab: "/ts_fl1_training_lab",
  gatebms__fl1_visualisation: "/ts_fl1_visualisation",
  gatebms__fl2_cabinet_1: "/ts_fl2_cabinet_1",
  gatebms__fl2_cabinet_3: "/ts_fl2_cabinet_3",
  gatebms__fl2_cabinet_5: "/ts_fl2_cabinet_5",
  gatebms__fl2_cabinet_6: "/ts_fl2_cabinet_6",
  gatebms__fl2_cabinet_7: "/ts_fl2_cabinet_7",
  gatebms__fl2_cabinet_8: "/ts_fl2_cabinet_8",
  gatebms__fl2_cabinet_9: "/ts_fl2_cabinet_9",
  gatebms__fl2_discussion_room: "/ts_fl2_discussion_room",
  gatebms__fl2_recreation_hall: "/ts_fl2_recreation_hall",
  gatebms__fl2_research_leader_1: "/ts_fl2_research_leader_1",
  gatebms__fl2_research_leader_2: "/ts_fl2_research_leader_2",
  gatebms__fl2_research_leader_3: "/ts_fl2_research_leader_3",
  gatebms__fl2_research_leader_4: "/ts_fl2_research_leader_4",
  gatebms__fl2_researchers: "/ts_fl2_researchers",
  gatebms__fl2_waiting_area: "/ts_fl2_waiting_area",
  gatebms__fl3_assist_director_2: "/ts_fl3_assist_director_2",
  gatebms__fl3_assist_director_3: "/ts_fl3_assist_director_3",
  gatebms__fl3_assistant: "/ts_fl3_assistant",
  gatebms__fl3_business: "/ts_fl3_business",
  gatebms__fl3_cabinet: "/ts_fl3_cabinet",
  gatebms__fl3_director: "/ts_fl3_director",
  gatebms__fl3_host: "/ts_fl3_host",
  gatebms__fl3_hr: "/ts_fl3_hr",
  gatebms__fl3_it_department: "/ts_fl3_it_department",
  gatebms__fl3_lawyer: "/ts_fl3_lawyer",
  gatebms__fl3_meeting: "/ts_fl3_meeting",
  gatebms__fl3_office_1: "/ts_fl3_office_1",
  gatebms__fl3_waiting_area: "/ts_fl3_waiting_area",
};

const COLORS = {
  NO_DATA: Cesium.Color.fromCssColorString("#6b7280").withAlpha(0.62),
  HOVER: Cesium.Color.fromCssColorString("#f59e0b").withAlpha(0.84),
  SELECTED: Cesium.Color.fromCssColorString("#00d1ff").withAlpha(0.92),
  OUTLINE: Cesium.Color.BLACK.withAlpha(0.3),
};

const METRIC_CONFIG = {
  temperature: {
    label: "Temperature",
    evaluate: (v) =>
      v == null ? "no-data" : v >= 20 && v <= 24 ? "good" : v >= 18 && v <= 26 ? "warning" : "critical",
    norm: (v) => clamp((v - 16) / 14, 0, 1),
    colors: ["#2563eb", "#22c55e", "#f59e0b", "#ef4444"],
    legend: [
      { label: "< 18", color: "#2563eb" },
      { label: "18 - 24", color: "#22c55e" },
      { label: "24 - 27", color: "#f59e0b" },
      { label: "> 27", color: "#ef4444" },
    ],
  },
  humidity: {
    label: "Humidity",
    evaluate: (v) =>
      v == null ? "no-data" : v >= 40 && v <= 60 ? "good" : v >= 30 && v <= 70 ? "warning" : "critical",
    norm: (v) => clamp((v - 20) / 60, 0, 1),
    colors: ["#7c3aed", "#06b6d4", "#22c55e", "#f97316"],
    legend: [
      { label: "< 30 / > 70", color: "#ef4444" },
      { label: "30 - 40 / 60 - 70", color: "#f59e0b" },
      { label: "40 - 60", color: "#22c55e" },
    ],
  },
  co2: {
    label: "CO2",
    evaluate: (v) =>
      v == null ? "no-data" : v <= 800 ? "good" : v <= 1200 ? "warning" : "critical",
    norm: (v) => clamp((v - 500) / 1800, 0, 1),
    colors: ["#22c55e", "#84cc16", "#f59e0b", "#ef4444"],
    legend: [
      { label: "< 800 ppm", color: "#22c55e" },
      { label: "800 - 1000 ppm", color: "#84cc16" },
      { label: "1000 - 1400 ppm", color: "#f59e0b" },
      { label: "> 1400 ppm", color: "#ef4444" },
    ],
  },
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatTimestamp(ts) {
  if (!ts) return "No timestamp";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "No timestamp" : d.toLocaleString();
}

function formatValue(v, metric) {
  if (v == null) return "No data";
  if (metric === "temperature") return `${v.toFixed(1)} °C`;
  if (metric === "humidity") return `${v.toFixed(1)} %`;
  if (metric === "co2") return `${Math.round(v)} ppm`;
  return String(v);
}

async function getJson(input, params) {
  const url = new URL(input, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== "") url.searchParams.set(key, value);
    });
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function normalizeRoomKey(value) {
  if (!value) return null;
  const s = String(value).trim();
  const dotted = s.match(/^(\d+)\.(\d+)$/);
  if (dotted) return `${parseInt(dotted[1], 10)}.${String(parseInt(dotted[2], 10)).padStart(2, "0")}`;
  const compact = s.match(/^(\d)(\d{2})$/);
  if (compact) return `${parseInt(compact[1], 10)}.${compact[2]}`;
  return s;
}

function normalizeBgName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function toEnglishRoomName(value) {
  const name = String(value || "").trim();
  if (!name) return "";
  if (!/[\u0400-\u04FF]/.test(name)) return name;

  const key = normalizeBgName(name);
  const exact = [
    ["WC ЖЕНИ", "Women's WC"],
    ["WC МЪЖЕ", "Men's WC"],
    ["АСАНСЬОР И ШАХТА", "Elevator Shaft"],
    ["АСАНСЬОРНА ШАХТА", "Elevator Shaft"],
    ["АСАНСЬОР", "Elevator"],
    ["ЕВАКУАЦИОННА СТЪЛБА", "Emergency Staircase"],
    ["СТЪЛБА", "Staircase"],
    ["ТЕХНИЧЕСКА СТАЯ", "Technical Room"],
    ["ТЕХНОЛОГИЧНА СТАЯ", "Technical Room"],
    ["СЪРВЪРНО ПОМЕЩЕНИЕ", "Server Room"],
    ["ПОМЕЩЕНИЕ ЕЛ", "Electrical Room"],
    ["ПОМЕЩЕНИЕ UPS", "UPS Room"],
    ["ЛАБОРАТОРИЯ ЗА ОБУЧЕНИЕ", "Training Laboratory"],
    ["IT ОТДЕЛ", "IT Department"],
    ["БИЗНЕС РАЗВИТИЕ", "Business Development"],
    ["ЧОВЕШКИ РЕСУРСИ", "Human Resources"],
    ["ДИРЕКТОР", "Director"],
    ["АСИСТЕНТ", "Assistant"],
    ["ЗАЛА SAP", "SAP Hall"],
    ["КУХНЯ", "Kitchen"],
    ["РЕЦЕПЦИЯ", "Reception"],
    ["ЗОНА ЗА ИЗЧАКВАНЕ", "Waiting Zone"],
    ["КОРИДОР", "Corridor"],
    ["КАБИНЕТ", "Office"],
  ];

  for (const [bg, en] of exact) {
    if (normalizeBgName(bg) === key) return en;
  }

  const partial = [
    ["WC", "WC"],
    ["КОНФЕРЕН", "Conference Room"],
    ["СЕМИНАР", "Seminar Room"],
    ["СРЕЩ", "Meeting Room"],
    ["ВИЗУАЛИЗ", "Visualization Hall"],
    ["ИЗЧАКВАН", "Waiting Area"],
    ["КОРИДОР", "Corridor"],
    ["ОФИС", "Office"],
    ["КАБИНЕТ", "Office"],
    ["РЕСУРСИ", "Human Resources"],
    ["БИЗНЕС", "Business Development"],
    ["КУХН", "Kitchen"],
    ["ФОАЙЕ", "Foyer"],
    ["ТЕХНИЧ", "Technical Room"],
    ["СЪРВЪР", "Server Room"],
    ["ЛАБОРАТ", "Laboratory"],
    ["АСАНСЬОР", "Elevator"],
    ["СТЪЛБ", "Staircase"],
    ["ЗАЛА", "Hall"],
  ];

  for (const [part, en] of partial) {
    if (key.includes(part)) return en;
  }

  return name;
}

function floorNumberFromLevel(levelValue) {
  if (levelValue == null) return null;
  const raw = String(levelValue).trim();
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  const m = raw.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function normalizeFloorKey(value) {
  if (value == null) return "unknown";
  const s = String(value).trim();
  return s || "unknown";
}

function sortFloorKeys(keys) {
  return [...keys].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return String(a).localeCompare(String(b));
  });
}

function roomHeightFromProperties(properties) {
  const levelHeight = toNumber(properties?.BldgLevel_Height, NaN);
  return Number.isFinite(levelHeight) && levelHeight > 0 ? Math.max(levelHeight, 2.8) : 3;
}

function getFeaturePolygons(feature) {
  if (!feature?.geometry) return [];
  const { type, coordinates } = feature.geometry;
  if (type === "Polygon") return Array.isArray(coordinates) ? [coordinates] : [];
  if (type === "MultiPolygon") return Array.isArray(coordinates) ? coordinates : [];
  return [];
}

function getFeatureMeta(properties = {}, index = 0) {
  const roomNumber = properties.RoomNumber || properties.Number || "-";
  const rawEnglishName =
    properties.name_en ||
    properties.Name_EN ||
    properties.RoomName_EN ||
    properties.RoomNameEn ||
    properties.EnglishName ||
    properties.NameEn ||
    "";

  const localName = properties.RoomName || properties.Name_BG || properties.BgName || "";
  const floorValue =
    properties.BldgLevel ??
    properties.Level ??
    properties.BldgLevel_Name ??
    properties.BldgLevel_Desc ??
    "-";

  const floorNumber = floorNumberFromLevel(floorValue);
  const normalizedKey = normalizeRoomKey(roomNumber);
  let roomKey = normalizedKey;

  if (normalizedKey && floorNumber != null) {
    const m = String(normalizedKey).match(/^(\d+)\.(\d+)$/);
    if (m && Number(m[1]) === 0) roomKey = `${floorNumber}.${m[2]}`;
  }

  return {
    roomName: rawEnglishName || toEnglishRoomName(localName) || `Room ${index + 1}`,
    roomNameSecondary: localName || "",
    roomNumber,
    roomKey,
    roomArea: toNumber(properties.Shape_Area ?? properties.SourceArea ?? properties.Area, 0),
    roomLevel:
      properties.BldgLevel_Desc ||
      properties.BldgLevel_Name ||
      properties.BldgLevel ||
      properties.Level ||
      "-",
    floorKey: normalizeFloorKey(floorValue),
  };
}

function collectBoundsAndMinElevation(features) {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  let minElev = Infinity;

  for (const feature of features) {
    const polygons = getFeaturePolygons(feature);
    const propElev = toNumber(feature?.properties?.BldgLevel_Elev, NaN);

    for (const polygon of polygons) {
      const outer = polygon?.[0];
      if (!Array.isArray(outer)) continue;
      for (const coord of outer) {
        const lon = toNumber(coord?.[0], NaN);
        const lat = toNumber(coord?.[1], NaN);
        const z = toNumber(coord?.[2], NaN);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
        west = Math.min(west, lon);
        east = Math.max(east, lon);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
        if (Number.isFinite(z)) minElev = Math.min(minElev, z);
      }
    }

    if (Number.isFinite(propElev)) minElev = Math.min(minElev, propElev);
  }

  return {
    hasBounds:
      Number.isFinite(west) &&
      Number.isFinite(east) &&
      Number.isFinite(south) &&
      Number.isFinite(north),
    west,
    east,
    south,
    north,
    minElev: Number.isFinite(minElev) ? minElev : 0,
  };
}

function rectangleToPositions(rectangle, h) {
  return [
    Cesium.Rectangle.southwest(rectangle),
    Cesium.Rectangle.northwest(rectangle),
    Cesium.Rectangle.northeast(rectangle),
    Cesium.Rectangle.southeast(rectangle),
  ].map((c) => Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, h));
}

function toWindowCoordinates(viewer, worldPosition) {
  if (!viewer || !worldPosition) return null;
  const st = Cesium.SceneTransforms;
  if (st?.wgs84ToWindowCoordinates) return st.wgs84ToWindowCoordinates(viewer.scene, worldPosition);
  if (st?.worldToWindowCoordinates) return st.worldToWindowCoordinates(viewer.scene, worldPosition);
  if (viewer.scene?.cartesianToCanvasCoordinates) return viewer.scene.cartesianToCanvasCoordinates(worldPosition);
  return null;
}

function mixHex(startHex, endHex, t) {
  const s = Cesium.Color.fromCssColorString(startHex);
  const e = Cesium.Color.fromCssColorString(endHex);
  return new Cesium.Color(
    s.red + (e.red - s.red) * t,
    s.green + (e.green - s.green) * t,
    s.blue + (e.blue - s.blue) * t,
    0.78
  );
}

function metricColor(metricKey, value) {
  if (value == null) return COLORS.NO_DATA;
  const conf = METRIC_CONFIG[metricKey];
  const n = conf.norm(value);
  const p = conf.colors;
  if (n <= 0.33) return mixHex(p[0], p[1], n / 0.33);
  if (n <= 0.66) return mixHex(p[1], p[2], (n - 0.33) / 0.33);
  return mixHex(p[2], p[3], (n - 0.66) / 0.34);
}

function worstStatus(values) {
  let status = "good";
  for (const value of values) {
    if (value === "critical") return "critical";
    if (value === "warning") status = "warning";
    if (value === "no-data" && status === "good") status = "no-data";
  }
  return status;
}

function deriveTrendRoomKey(roomKey) {
  const tempEndpoint = ROOM_BMS_ENDPOINTS?.[roomKey]?.temp;
  if (!tempEndpoint) return "";
  if (tempEndpoint.endsWith("__temp")) return tempEndpoint.slice(0, -6).replace(/__\d+$/, "");
  return tempEndpoint.replace(/__\d+__temp$/, "").replace(/__temp$/, "");
}

const ROOM_TO_TREND_KEY = Object.keys(ROOM_BMS_ENDPOINTS).reduce((acc, roomKey) => {
  acc[roomKey] = deriveTrendRoomKey(roomKey);
  return acc;
}, {});

const UNIQUE_TREND_ENDPOINTS = Object.values(
  Object.keys(ROOM_BMS_ENDPOINTS).reduce((acc, roomKey) => {
    const trendKey = ROOM_TO_TREND_KEY[roomKey];
    const endpoint = ROOM_TREND_ENDPOINT_MAP[trendKey];
    if (trendKey && endpoint) acc[trendKey] = { trendKey, endpoint };
    return acc;
  }, {})
);

function buildTelemetryForRooms(trendSampleByKey, timestampMs) {
  const out = {};
  for (const roomKey of Object.keys(ROOM_BMS_ENDPOINTS)) {
    const trendKey = ROOM_TO_TREND_KEY[roomKey];
    const sample = trendKey ? trendSampleByKey?.[trendKey] : null;
    const temperature = sample?.temperature ?? null;
    const humidity = sample?.humidity ?? null;
    const co2 = sample?.co2 ?? null;

    out[roomKey] = {
      temperature,
      humidity,
      co2,
      status: worstStatus([
        METRIC_CONFIG.temperature.evaluate(temperature),
        METRIC_CONFIG.humidity.evaluate(humidity),
        METRIC_CONFIG.co2.evaluate(co2),
      ]),
      timestampMs: Number.isFinite(sample?.timestampMs)
        ? sample.timestampMs
        : Number.isFinite(timestampMs)
          ? timestampMs
          : null,
    };
  }
  return out;
}

function getRoomCircuitIds(roomKey) {
  const roomMeta = roomKey ? MOCK_ROOM_DATA?.[roomKey] : null;
  const rawCircuits = Array.isArray(roomMeta?.circuits) ? roomMeta.circuits : [];
  return [...new Set(
    rawCircuits
      .flatMap((entry) => String(entry || "").split(","))
      .map((c) => c.trim())
      .filter(Boolean)
  )];
}

async function fetchTelemetryRows(endpoint, params) {
  const endpointPath = String(endpoint || "").replace(/^\/+/, "");
  const directPath = `${TELEMETRY_API_BASE.replace(/\/+$/, "")}/${endpointPath}`;
  try {
    return await getJson(directPath, params);
  } catch (directErr) {
    try {
      return await getJson(`/${endpointPath}`, params);
    } catch {
      throw directErr;
    }
  }
}

async function fetchLatestTrendSample(endpoint) {
  const rows = await fetchTelemetryRows(endpoint, {
    select: "timestamp,temp_c,humidity_rh,co2_ppm",
    order: "timestamp.desc",
    limit: 1,
  });

  if (!Array.isArray(rows) || !rows.length) {
    return { temperature: null, humidity: null, co2: null, timestampMs: null };
  }

  const row = rows[0];
  const ts = new Date(row.timestamp).getTime();
  return {
    temperature: Number.isFinite(Number(row.temp_c)) ? Number(row.temp_c) : null,
    humidity: Number.isFinite(Number(row.humidity_rh)) ? Number(row.humidity_rh) : null,
    co2: Number.isFinite(Number(row.co2_ppm)) ? Number(row.co2_ppm) : null,
    timestampMs: Number.isFinite(ts) ? ts : null,
  };
}

import { buildFallbackCircuitSample } from "../utils/circuitUtils";

const fetchLatestCircuitSample = async (circuitId) => {
  try {
    const rows = await getJson("/energy_harmonised_5min", {
      select: "ts_5min,value,circuit_id",
      circuit_id: `eq.${circuitId}`,
      order: "ts_5min.desc",
      limit: 1,
    });

    if (!Array.isArray(rows) || !rows.length) {
      // Fallback if no data
      return buildFallbackCircuitSample(circuitId);
    }

    const row = rows[0];
    const tsMs = new Date(row.ts_5min).getTime();
    const value = Number(row.value);

    return {
      circuitId,
      value: Number.isFinite(value) ? value : null,
      timestampMs: Number.isFinite(tsMs) ? tsMs : Date.now(),
    };
  } catch (err) {
    // Fallback if fetch fails
    return buildFallbackCircuitSample(circuitId);
  }
}

function getEntityBaseColor(entity, telemetryByRoom, activeMetric) {
  const roomTelemetry = entity?.__roomKey ? telemetryByRoom[entity.__roomKey] : null;
  return metricColor(activeMetric, roomTelemetry ? roomTelemetry[activeMetric] : null);
}

function setEntityColor(entity, color) {
  if (entity?.polygon) entity.polygon.material = color;
}

function buildRoomInfo(entity, telemetryByRoom, displayTimestampMs, viewer, container) {
  if (!entity || !viewer || !container || !entity.__anchor) return null;

  const canvasPos = toWindowCoordinates(viewer, entity.__anchor);
  if (!canvasPos) return null;

  const roomTelemetry = entity.__roomKey ? telemetryByRoom[entity.__roomKey] : null;
  const rect = container.getBoundingClientRect();

  return {
    roomId: entity.__roomId,
    x: Math.min(Math.max(canvasPos.x + 14, 16), Math.max(16, rect.width - 340)),
    y: Math.min(Math.max(canvasPos.y - 14, 16), Math.max(16, rect.height - 240)),
    name: entity.__roomMeta?.roomName || "Unknown",
    secondaryName: entity.__roomMeta?.roomNameSecondary || "",
    number: entity.__roomMeta?.roomNumber || "-",
    roomKey: entity.__roomMeta?.roomKey || "-",
    area: entity.__roomMeta?.roomArea || 0,
    level: entity.__roomMeta?.roomLevel || "-",
    temperature: roomTelemetry?.temperature ?? null,
    humidity: roomTelemetry?.humidity ?? null,
    co2: roomTelemetry?.co2 ?? null,
    status: roomTelemetry?.status || "no-data",
    timestampMs: roomTelemetry?.timestampMs ?? displayTimestampMs,
  };
}

export default function CesiumI3SViewer({ showBim = true }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const buildingBoundsRef = useRef(null);
  const buildingFallbackDestinationRef = useRef(null);
  const i3sProviderRef = useRef(null);
  const floorBoundsRef = useRef({});
  const roomEntitiesRef = useRef([]);
  const telemetryByRoomRef = useRef({});
  const selectedRoomRef = useRef(null);
  const hoveredRoomRef = useRef(null);
  const liveTimerRef = useRef(null);
  const popupRafRef = useRef(null);
  const popupThrottleRef = useRef(0);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState("");
  const [telemetryBusy, setTelemetryBusy] = useState(false);
  const [activeMetric, setActiveMetric] = useState("temperature");
  const [displayTimestampMs, setDisplayTimestampMs] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [viewMode, setViewMode] = useState("building");
  const [availableFloors, setAvailableFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState("");

  const clearTelemetryTimers = useCallback(() => {
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    if (popupRafRef.current) cancelAnimationFrame(popupRafRef.current);
    liveTimerRef.current = null;
    popupRafRef.current = null;
    popupThrottleRef.current = 0;
  }, []);

  const zoomToBuilding = useCallback(() => {
    const viewer = viewerRef.current;
    const bounds = buildingBoundsRef.current;
    if (!viewer) return;

    if (bounds) {
      viewer.camera.flyToBoundingSphere(bounds, {
        duration: 1.2,
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(35),
          Cesium.Math.toRadians(-45),
          Math.max(bounds.radius * 2.8, 120)
        ),
      });
      return;
    }

    if (buildingFallbackDestinationRef.current) {
      viewer.camera.flyTo({
        duration: 1.2,
        destination: buildingFallbackDestinationRef.current,
        orientation: {
          heading: Cesium.Math.toRadians(35),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
      });
    }
  }, []);

  const zoomToFloor = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || !selectedFloor) return;

    if (selectedFloor === ALL_FLOORS_VALUE) {
      zoomToBuilding();
      return;
    }

    const floorBounds = floorBoundsRef.current?.[selectedFloor];
    if (!floorBounds) return;

    viewer.camera.flyToBoundingSphere(floorBounds, {
      duration: 1,
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(25),
        Cesium.Math.toRadians(-55),
        Math.max(floorBounds.radius * 3, 90)
      ),
    });
  }, [selectedFloor, zoomToBuilding]);

  const schedulePopupRefresh = useCallback((force = false) => {
    const viewer = viewerRef.current;
    const container = containerRef.current;
    const entity = selectedRoomRef.current;
    if (!viewer || !container || !entity) return;

    const now = performance.now();
    if (!force && now - popupThrottleRef.current < 80) return;
    popupThrottleRef.current = now;

    if (popupRafRef.current) cancelAnimationFrame(popupRafRef.current);
    popupRafRef.current = requestAnimationFrame(() => {
      popupRafRef.current = null;
      const next = buildRoomInfo(entity, telemetryByRoomRef.current, displayTimestampMs, viewer, container);
      if (!next) return;

      setRoomInfo((prev) => {
        if (
          prev &&
          prev.roomId === next.roomId &&
          Math.abs(prev.x - next.x) < 1 &&
          Math.abs(prev.y - next.y) < 1 &&
          prev.temperature === next.temperature &&
          prev.humidity === next.humidity &&
          prev.co2 === next.co2 &&
          prev.status === next.status &&
          prev.timestampMs === next.timestampMs
        ) {
          return prev;
        }
        return next;
      });
    });
  }, [displayTimestampMs]);

  const colorEntityForState = useCallback((entity) => {
    if (!entity) return;
    if (selectedRoomRef.current === entity) return setEntityColor(entity, COLORS.SELECTED);
    if (hoveredRoomRef.current === entity) return setEntityColor(entity, COLORS.HOVER);
    setEntityColor(entity, getEntityBaseColor(entity, telemetryByRoomRef.current, activeMetric));
  }, [activeMetric]);

  const repaintAllRooms = useCallback(() => {
    for (const entity of roomEntitiesRef.current) colorEntityForState(entity);
  }, [colorEntityForState]);

  const updateHoveredEntity = useCallback((nextHovered) => {
    const prevHovered = hoveredRoomRef.current;
    if (prevHovered === nextHovered) return;
    hoveredRoomRef.current = nextHovered;
    if (prevHovered && prevHovered !== selectedRoomRef.current) colorEntityForState(prevHovered);
    if (nextHovered && nextHovered !== selectedRoomRef.current) colorEntityForState(nextHovered);
  }, [colorEntityForState]);

  const updateSelectedEntity = useCallback((nextSelected) => {
    const prevSelected = selectedRoomRef.current;
    if (prevSelected === nextSelected) return;
    selectedRoomRef.current = nextSelected;
    if (prevSelected) colorEntityForState(prevSelected);
    if (nextSelected) {
      colorEntityForState(nextSelected);
      const nextInfo = buildRoomInfo(
        nextSelected,
        telemetryByRoomRef.current,
        displayTimestampMs,
        viewerRef.current,
        containerRef.current
      );
      setRoomInfo(nextInfo);
      schedulePopupRefresh(true);
    } else {
      setRoomInfo(null);
    }
  }, [colorEntityForState, displayTimestampMs, schedulePopupRefresh]);

  const applyRoomVisibilityByView = useCallback(() => {
    const isFloorMode = viewMode === "floor";

    for (const entity of roomEntitiesRef.current) {
      entity.show =
        !isFloorMode ||
        !selectedFloor ||
        selectedFloor === ALL_FLOORS_VALUE ||
        entity.__floorKey === selectedFloor;
    }

    if (i3sProviderRef.current) i3sProviderRef.current.show = showBim && !isFloorMode;

    const selected = selectedRoomRef.current;
    if (selected && !selected.show) {
      selectedRoomRef.current = null;
      setRoomInfo(null);
    }
  }, [selectedFloor, showBim, viewMode]);

  const pullLiveTelemetry = useCallback(async () => {
    try {
      setTelemetryBusy(true);
      setTelemetryError("");

      const trendSampleByKey = {};
      const endpointTs = [];

      await Promise.all(
        UNIQUE_TREND_ENDPOINTS.map(async ({ trendKey, endpoint }) => {
          try {
            const latest = await fetchLatestTrendSample(endpoint);
            trendSampleByKey[trendKey] = latest;
            if (Number.isFinite(latest.timestampMs)) endpointTs.push(latest.timestampMs);
          } catch (endpointErr) {
            trendSampleByKey[trendKey] = {
              temperature: null,
              humidity: null,
              co2: null,
              timestampMs: null,
            };
            console.warn(`Live sample failed for ${trendKey}:`, endpointErr?.message || endpointErr);
          }
        })
      );

      const latestTs = endpointTs.length ? Math.max(...endpointTs) : Date.now();
      telemetryByRoomRef.current = buildTelemetryForRooms(trendSampleByKey, latestTs);
      setDisplayTimestampMs(latestTs);
      repaintAllRooms();
      schedulePopupRefresh(true);
    } catch (fetchErr) {
      console.error("Live telemetry fetch failed:", fetchErr);
      setTelemetryError(`Live data failed: ${fetchErr.message}`);
    } finally {
      setTelemetryBusy(false);
    }
  }, [repaintAllRooms, schedulePopupRefresh]);



  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    let cleanupInternal;
    let cancelled = false;
    const isViewerAlive = (viewer) => viewer && !(typeof viewer.isDestroyed === "function" && viewer.isDestroyed());

    async function init() {
      try {
        Cesium.Ion.defaultAccessToken = ION_TOKEN;

        const terrain = new Cesium.Terrain(
          Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
            "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"
          )
        );

        const viewer = new Cesium.Viewer(containerRef.current, {
          terrain,
          animation: false,
          timeline: false,
          orderIndependentTranslucency: false,
          baseLayerPicker: false,
          geocoder: false,
          sceneModePicker: false,
          infoBox: false,
          selectionIndicator: false,
          shadows: false,
        });

        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.shadows = false;
        viewer.terrainShadows = Cesium.ShadowMode.DISABLED;
        viewer.scene.globe.enableLighting = true;
        viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date());
        viewer.scene.light = new Cesium.DirectionalLight({
          direction: new Cesium.Cartesian3(-0.3, -0.5, -0.8),
          intensity: 1.5,
        });
        viewer.scene.highDynamicRange = true;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0001;
        viewer.scene.fog.minimumBrightness = 0.8;
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;

        viewerRef.current = viewer;
        if (cancelled || !isViewerAlive(viewer)) {
          if (isViewerAlive(viewer)) viewer.destroy();
          return;
        }

        try {
          const i3sProvider = await Cesium.I3SDataProvider.fromUrl(I3S_URL, {
            adjustMaterialAlphaMode: true,
            showFeatures: true,
            applySymbology: true,
            calculateNormals: true,
          });
          viewer.scene.primitives.add(i3sProvider);
          i3sProviderRef.current = i3sProvider;
          i3sProvider.show = true;
        } catch (i3sError) {
          console.warn("I3S layer failed, continuing with GeoJSON:", i3sError);
        }

        const response = await fetch(GEOJSON_URL);
        if (!response.ok) throw new Error(`GeoJSON request failed (${response.status})`);
        const geojson = await response.json();
        if (cancelled || !isViewerAlive(viewer)) return;

        const features = Array.isArray(geojson?.features) ? geojson.features : [];
        if (!features.length) throw new Error("GeoJSON has no features");

        const bounds = collectBoundsAndMinElevation(features);
        if (!bounds.hasBounds) throw new Error("GeoJSON has no valid coordinates");

        const footprintRect = Cesium.Rectangle.fromDegrees(
          bounds.west - 0.00003,
          bounds.south - 0.00003,
          bounds.east + 0.00003,
          bounds.north + 0.00003
        );

        const roomEntities = [];
        const buildingPositions = [];
        const floorPositions = {};
        const floorKeys = new Set();

        features.forEach((feature, index) => {
          const props = feature?.properties || {};
          const polygons = getFeaturePolygons(feature);
          const baseElevation = toNumber(props.BldgLevel_Elev, bounds.minElev);
          const roomHeight = roomHeightFromProperties(props);
          const meta = getFeatureMeta(props, index);

          polygons.forEach((polygon, polyIndex) => {
            if (cancelled || !isViewerAlive(viewer) || !viewer.entities) return;
            const outer = polygon?.[0];
            if (!Array.isArray(outer) || outer.length < 3) return;

            const positions = outer
              .map((coord) => {
                const lon = toNumber(coord?.[0], NaN);
                const lat = toNumber(coord?.[1], NaN);
                const z = toNumber(coord?.[2], baseElevation);
                if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
                return Cesium.Cartesian3.fromDegrees(lon, lat, z);
              })
              .filter(Boolean);

            if (positions.length < 3) return;

            buildingPositions.push(...positions);
            const roomId = `${meta.roomKey || meta.roomNumber || index}-${polyIndex}`;
            const entity = viewer.entities.add({
              name: meta.roomName,
              polygon: {
                hierarchy: positions,
                perPositionHeight: true,
                extrudedHeight: baseElevation + roomHeight,
                material: COLORS.NO_DATA,
                outline: true,
                outlineColor: COLORS.OUTLINE,
                outlineWidth: 1,
              },
              properties: {
                roomId,
                RoomName: meta.roomName,
                RoomNumber: meta.roomNumber,
                RoomKey: meta.roomKey,
                Area: meta.roomArea,
                Level: meta.roomLevel,
              },
            });

            entity.__isGeoRoom = true;
            entity.__roomId = roomId;
            entity.__roomKey = meta.roomKey;
            entity.__roomMeta = meta;
            entity.__floorKey = meta.floorKey;
            entity.__anchor = Cesium.BoundingSphere.fromPoints(positions).center;
            roomEntities.push(entity);
            floorKeys.add(meta.floorKey);
            if (!floorPositions[meta.floorKey]) floorPositions[meta.floorKey] = [];
            floorPositions[meta.floorKey].push(...positions);
          });
        });

        roomEntitiesRef.current = roomEntities;
        floorBoundsRef.current = {};
        Object.entries(floorPositions).forEach(([floorKey, positions]) => {
          if (positions.length > 3) floorBoundsRef.current[floorKey] = Cesium.BoundingSphere.fromPoints(positions);
        });

        const sortedFloors = sortFloorKeys(floorKeys);
        setAvailableFloors(sortedFloors);
        if (sortedFloors.length) setSelectedFloor(ALL_FLOORS_VALUE);

        const center = Cesium.Rectangle.center(footprintRect);
        const destination = Cesium.Cartesian3.fromRadians(center.longitude, center.latitude, bounds.minElev + 120);

        buildingFallbackDestinationRef.current = Cesium.Cartesian3.clone(destination);
        buildingBoundsRef.current =
          buildingPositions.length > 3
            ? Cesium.BoundingSphere.fromPoints(buildingPositions)
            : Cesium.BoundingSphere.fromPoints(rectangleToPositions(footprintRect, bounds.minElev + 8));

        viewer.camera.setView({
          destination,
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-40), roll: 0 },
        });
        zoomToBuilding();

        setTimeout(() => {
          if (viewerRef.current && !viewerRef.current.isDestroyed()) zoomToBuilding();
        }, 180);

        viewer.homeButton.viewModel.command.beforeExecute.addEventListener((commandInfo) => {
          commandInfo.cancel = true;
          zoomToBuilding();
        });

        viewer.screenSpaceEventHandler.setInputAction((movement) => {
          const pickedList = viewer.scene.drillPick(movement.endPosition, 8) || [];
          const pickedRoom = pickedList.map((item) => item?.id).find((id) => id?.__isGeoRoom) || null;
          const nextHovered = pickedRoom;
          updateHoveredEntity(nextHovered);
          if (containerRef.current) containerRef.current.style.cursor = nextHovered ? "pointer" : "default";
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        viewer.screenSpaceEventHandler.setInputAction((movement) => {
          const pickedList = viewer.scene.drillPick(movement.position, 12) || [];
          const pickedEntity = pickedList.map((item) => item?.id).find((id) => id?.__isGeoRoom) || null;

          if (!pickedEntity?.__isGeoRoom) {
            updateSelectedEntity(null);
            return;
          }

          if (selectedRoomRef.current?.__roomId === pickedEntity.__roomId) {
            updateSelectedEntity(null);
            return;
          }

          updateSelectedEntity(pickedEntity);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        const onPostRender = () => schedulePopupRefresh(false);
        viewer.scene.postRender.addEventListener(onPostRender);
        cleanupInternal = () => viewer.scene.postRender.removeEventListener(onPostRender);

        setLoading(false);
      } catch (viewerErr) {
        if (cancelled) return;
        console.error("Viewer initialization failed:", viewerErr);
        setErr(`Failed to initialize viewer: ${viewerErr.message}`);
        setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      clearTelemetryTimers();
      if (cleanupInternal) cleanupInternal();
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [clearTelemetryTimers, schedulePopupRefresh, updateHoveredEntity, updateSelectedEntity, zoomToBuilding]);

  useEffect(() => {
    repaintAllRooms();
    schedulePopupRefresh(true);
  }, [activeMetric, repaintAllRooms, schedulePopupRefresh]);

  useEffect(() => {
    applyRoomVisibilityByView();
    repaintAllRooms();
    schedulePopupRefresh(true);
  }, [applyRoomVisibilityByView, repaintAllRooms, schedulePopupRefresh]);

  useEffect(() => {
    if (viewMode === "floor" && !selectedFloor && availableFloors.length) {
      setSelectedFloor(ALL_FLOORS_VALUE);
    }
  }, [availableFloors, selectedFloor, viewMode]);

  useEffect(() => {
    clearTelemetryTimers();
    pullLiveTelemetry();
    liveTimerRef.current = setInterval(pullLiveTelemetry, LIVE_REFRESH_MS);
    return () => clearTelemetryTimers();
  }, [clearTelemetryTimers, pullLiveTelemetry]);


  return (
    <div className="cesium-container-wrapper">
      {loading && <div className="cesium-loading">Loading digital twin model...</div>}
      {err && <div className="cesium-error">{err}</div>}

      <div ref={containerRef} className="cesium-container" />

      <div className="digital-twin-controls" onClick={(e) => e.stopPropagation()}>
        <div className="dt-row">
          <div className="dt-mode-toggle">
            <button className="dt-btn" onClick={zoomToBuilding}>Zoom to Building</button>
          </div>

          <div className="dt-mode-toggle">
            <button
              className={`dt-btn ${viewMode === "building" ? "active" : ""}`}
              onClick={() => setViewMode("building")}
            >
              Building
            </button>
            <button
              className={`dt-btn ${viewMode === "floor" ? "active" : ""}`}
              onClick={() => setViewMode("floor")}
            >
              Floors
            </button>
          </div>

          <label className="dt-field">
            Visualise
            <select value={activeMetric} onChange={(e) => setActiveMetric(e.target.value)}>
              <option value="temperature">Temperature</option>
              <option value="humidity">Humidity</option>
              <option value="co2">CO2</option>
            </select>
          </label>
        </div>

        {viewMode === "floor" && (
          <div className="dt-row">
            <button
              className={`dt-btn ${selectedFloor === ALL_FLOORS_VALUE ? "active" : ""}`}
              onClick={() => setSelectedFloor(ALL_FLOORS_VALUE)}
            >
              All Floors
            </button>

            <label className="dt-field">
              Floor
              <select value={selectedFloor} onChange={(e) => setSelectedFloor(e.target.value)}>
                <option value={ALL_FLOORS_VALUE}>All Floors (GeoJSON)</option>
                {availableFloors.map((floor) => (
                  <option key={floor} value={floor}>{floor}</option>
                ))}
              </select>
            </label>

            <button className="dt-btn" onClick={zoomToFloor} disabled={!selectedFloor}>
              {selectedFloor === ALL_FLOORS_VALUE ? "Zoom All Floors" : "Zoom to Floor"}
            </button>
          </div>
        )}

        <div className="dt-row dt-legend">
          {METRIC_CONFIG[activeMetric].legend.map((entry) => (
            <div className="dt-legend-item" key={`${activeMetric}-${entry.label}`}>
              <span className="dt-legend-swatch" style={{ backgroundColor: entry.color }} aria-hidden="true" />
              <span>{entry.label}</span>
            </div>
          ))}
        </div>

        <div className="dt-row dt-status-row">
          <span className="dt-chip">Mode: Live</span>
          <span className="dt-chip">{METRIC_CONFIG[activeMetric].label}</span>
          <span className="dt-chip">{formatTimestamp(displayTimestampMs)}</span>
          {telemetryBusy && <span className="dt-chip">Updating...</span>}
        </div>

        {telemetryError && <div className="dt-error">{telemetryError}</div>}
      </div>

      {roomInfo && (
        <div
          className="room-info-textbox"
          style={{ left: `${roomInfo.x}px`, top: `${roomInfo.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="room-info-close" onClick={() => updateSelectedEntity(null)} aria-label="Close room info">x</button>

          <div className="room-info-title">{roomInfo.name}</div>
          <div className="room-info-row"><span>Space ID</span><span>{roomInfo.roomKey}</span></div>
          <div className="room-info-row"><span>Room</span><span>{roomInfo.number}</span></div>
          <div className="room-info-row">
            <span>Bulgarian</span>
            <span>{roomInfo.secondaryName && roomInfo.secondaryName !== roomInfo.name ? roomInfo.secondaryName : "-"}</span>
          </div>
          <div className="room-info-row"><span>Area</span><span>{roomInfo.area || "-"} m2</span></div>
          <div className="room-info-row"><span>Level</span><span>{roomInfo.level}</span></div>
          <div className="room-info-row"><span>Temperature</span><span>{formatValue(roomInfo.temperature, "temperature")}</span></div>
          <div className="room-info-row"><span>Humidity</span><span>{formatValue(roomInfo.humidity, "humidity")}</span></div>
          <div className="room-info-row"><span>CO2</span><span>{formatValue(roomInfo.co2, "co2")}</span></div>
          <div className="room-info-row"><span>Updated</span><span>{formatTimestamp(roomInfo.timestampMs)}</span></div>

          <div className={`room-status-badge ${roomInfo.status || "no-data"}`}>
            {roomInfo.status === "critical"
              ? "Critical"
              : roomInfo.status === "warning"
                ? "Warning"
                : roomInfo.status === "good"
                  ? "Good"
                  : "No data"}
          </div>
        </div>
      )}
    </div>
  );
}



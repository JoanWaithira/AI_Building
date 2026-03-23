// Room Data Utilities - Manages room sensor data from PostgreSQL via PostgREST

import { BUILDING_API_BASE } from "../config/api.js";

const API_BASES = { building: BUILDING_API_BASE };
const getTimeRange = (days, endIso = null) => {
  const endDate = endIso ? new Date(endIso) : new Date();
  const safeEnd = Number.isFinite(endDate.getTime()) ? endDate : new Date();
  const from = new Date(safeEnd.getTime() - days * 24 * 60 * 60 * 1000);
  return { fromIso: from.toISOString(), toIso: safeEnd.toISOString() };
};

function buildApiUrl(baseUrl, endpoint) {
  const cleanEndpoint = String(endpoint || '').replace(/^\/+/, '');
  if (baseUrl) return `${baseUrl}/${cleanEndpoint}`;
  return `/${cleanEndpoint}`;
}

async function fetchJsonWithFallback(baseUrl, endpoint, params) {
  const url = new URL(buildApiUrl(baseUrl, endpoint), window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.append(key, value);
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } catch (directError) {
    if (baseUrl) {
      const fallbackUrl = new URL(buildApiUrl('', endpoint), window.location.origin);
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value != null && value !== '') fallbackUrl.searchParams.append(key, value);
      });
      const fallbackResponse = await fetch(fallbackUrl.toString());
      if (!fallbackResponse.ok) throw directError;
      return fallbackResponse.json();
    }
    throw directError;
  }
}

const getTimeSeries = async (
  baseUrl,
  endpoint,
  {
    fromIso,
    toIso,
    timestampCol = 'timestamp',
    valueCol = 'value',
    limit = 2000,
    order = 'asc',
  } = {}
) => {
  const params = {
    select: `${timestampCol},${valueCol}`,
    order: `${timestampCol}.${order}`,
    limit,
  };

  if (fromIso && toIso) {
    params.and = `(${timestampCol}.gte.${fromIso},${timestampCol}.lte.${toIso})`;
  } else if (fromIso) {
    params[timestampCol] = `gte.${fromIso}`;
  } else if (toIso) {
    params[timestampCol] = `lte.${toIso}`;
  }

  const rows = await fetchJsonWithFallback(baseUrl, endpoint, params).catch(() => []);
  return Array.isArray(rows) ? rows : [];
};

// Helper: Create BMS endpoints for a sensor device
const createEndpoint = (floor, roomType, deviceId) => ({
  temp: `gatebms__fl${floor}_${roomType}__${deviceId}__temp`,
  humidity: `gatebms__fl${floor}_${roomType}__${deviceId}__humidity`,
  co2: `gatebms__fl${floor}_${roomType}__${deviceId}__co2`
});

// Available sensor devices from database
const LOBBY = createEndpoint(0, "lobby", "82000972");
const HALL_SAP = createEndpoint(1, "hall_sap", "82000974");
const HALL_SAP_2 = createEndpoint(1, "hall_sap", "82000975");
const MEETING_ROOM = createEndpoint(1, "meeting_room", "82000609");
const TRAINING_LAB_1 = createEndpoint(1, "training_lab", "82000386");
const TRAINING_LAB_2 = createEndpoint(1, "training_lab", "82000387");
const VISUALISATION_1 = createEndpoint(1, "visualisation", "82000976");
const VISUALISATION_2 = createEndpoint(1, "visualisation", "82000977");
const CABINET_1 = createEndpoint(2, "cabinet_1", "82000878");

// Map rooms to their BMS sensor endpoints
export const ROOM_BMS_ENDPOINTS = {
  "1.02": HALL_SAP,
  "1.04": TRAINING_LAB_1,
  "1.05": TRAINING_LAB_2,
  "1.07": VISUALISATION_1,
  "1.09": MEETING_ROOM,
  "1.10": VISUALISATION_2,
  "2.01": HALL_SAP,
  "2.02": TRAINING_LAB_1,
  "2.04": TRAINING_LAB_2,
  "2.05": VISUALISATION_1,
  "2.07": MEETING_ROOM,
  "2.08": CABINET_1,
  "3.01": HALL_SAP_2,
  "3.02": TRAINING_LAB_1,
  "3.04": TRAINING_LAB_2,
  "3.05": VISUALISATION_1,
  "3.07": MEETING_ROOM,
  "3.08": VISUALISATION_2,
  "4.01": HALL_SAP,
  "4.02": TRAINING_LAB_1,
  "4.04": TRAINING_LAB_2,
  "4.05": VISUALISATION_1,
  "4.07": MEETING_ROOM,
  "4.08": CABINET_1
};

// Room trend endpoints served by PostgREST (combined telemetry per room)
const ROOM_ENDPOINT_MAP = {
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

function deriveTrendRoomKey(roomName) {
  const tempEndpoint = ROOM_BMS_ENDPOINTS?.[roomName]?.temp;
  if (!tempEndpoint) return "";
  if (tempEndpoint.endsWith("__temp")) return tempEndpoint.slice(0, -6).replace(/__\d+$/, "");
  return tempEndpoint.replace(/__\d+__temp$/, "").replace(/__temp$/, "");
}

// Static room metadata (area, type, circuits, etc.) - Data from Rooms_details_GATE.pdf
const ROOM_METADATA = {
  // Floor 1 Rooms
  "1.02": { 
    floor: 1, area: 156.8, occupancy: 12, circuits: ["circuit10", "airconditioner1", "3DLED"], type: "Office/Meeting",
    volume: 440, monthlyHours: 173, avgOccupancy: 12,
    lighting: "32 ceiling lights (LED)", acUnits: 4,
    temperature: 22.5, humidity: 45,
    energy: { lighting: 9.92, plugs: 38.25, ac: 627.5, total: 675.67, perM2: 4.31 }
  },
  "1.04": { 
    floor: 1, area: 89.4, occupancy: 6, circuits: ["circuit11", "airconditioner2"], type: "Office",
    volume: 250, monthlyHours: 173, avgOccupancy: 6,
    lighting: "18 ceiling lights (LED)", acUnits: 3,
    temperature: 23.0, humidity: 42,
    energy: { lighting: 5.58, plugs: 31.88, ac: 357.6, total: 395.06, perM2: 4.42 }
  },
  "1.05": { 
    floor: 1, area: 67.3, occupancy: 4, circuits: ["circuit12", "airconditioner1"], type: "Office",
    volume: 189, monthlyHours: 173, avgOccupancy: 4,
    lighting: "14 ceiling lights (LED)", acUnits: 2,
    temperature: 22.8, humidity: 44,
    energy: { lighting: 4.34, plugs: 17.94, ac: 269.2, total: 291.48, perM2: 4.33 }
  },
  "1.07": { 
    floor: 1, area: 201.5, occupancy: 15, circuits: ["circuit10", "airconditioner2", "3DLED"], type: "Open Office",
    volume: 565, monthlyHours: 173, avgOccupancy: 15,
    lighting: "40 ceiling lights (LED)", acUnits: 5,
    temperature: 23.2, humidity: 43,
    energy: { lighting: 12.4, plugs: 67.28, ac: 806, total: 885.68, perM2: 4.40 }
  },
  "1.09": { 
    floor: 1, area: 38.9, occupancy: 2, circuits: ["circuit7"], type: "Meeting Room",
    volume: 109, monthlyHours: 86.6, avgOccupancy: 2,
    lighting: "8 ceiling lights (LED)", acUnits: 1,
    temperature: 21.5, humidity: 48,
    energy: { lighting: 1.66, plugs: 4.33, ac: 77.8, total: 83.79, perM2: 2.15 }
  },
  "1.10": { 
    floor: 1, area: 78.2, occupancy: 5, circuits: ["circuit8", "airconditioner1"], type: "Office",
    volume: 219, monthlyHours: 173, avgOccupancy: 5,
    lighting: "16 ceiling lights (LED)", acUnits: 2,
    temperature: 22.6, humidity: 43,
    energy: { lighting: 4.96, plugs: 22.41, ac: 312.8, total: 340.17, perM2: 4.35 }
  },
  
  // Floor 2 Rooms
  "2.01": { 
    floor: 2, area: 167.9, occupancy: 13, circuits: ["circuit11", "airconditioner2", "3DLED"], type: "Open Office",
    volume: 471, monthlyHours: 173, avgOccupancy: 13,
    lighting: "34 ceiling lights (LED)", acUnits: 4,
    temperature: 23.1, humidity: 44,
    energy: { lighting: 10.54, plugs: 58.32, ac: 671.6, total: 740.46, perM2: 4.41 }
  },
  "2.02": { 
    floor: 2, area: 94.3, occupancy: 7, circuits: ["circuit12", "airconditioner1"], type: "Office",
    volume: 264, monthlyHours: 173, avgOccupancy: 7,
    lighting: "19 ceiling lights (LED)", acUnits: 3,
    temperature: 22.9, humidity: 45,
    energy: { lighting: 5.89, plugs: 31.38, ac: 377.2, total: 414.47, perM2: 4.40 }
  },
  "2.04": { 
    floor: 2, area: 72.1, occupancy: 5, circuits: ["circuit9", "airconditioner2"], type: "Office",
    volume: 202, monthlyHours: 173, avgOccupancy: 5,
    lighting: "15 ceiling lights (LED)", acUnits: 2,
    temperature: 22.7, humidity: 46,
    energy: { lighting: 4.65, plugs: 22.41, ac: 288.4, total: 315.46, perM2: 4.37 }
  },
  "2.05": { 
    floor: 2, area: 215.3, occupancy: 16, circuits: ["circuit10", "airconditioner1", "3DLED"], type: "Open Office",
    volume: 603, monthlyHours: 173, avgOccupancy: 16,
    lighting: "43 ceiling lights (LED)", acUnits: 5,
    temperature: 23.3, humidity: 42,
    energy: { lighting: 13.33, plugs: 71.74, ac: 861.2, total: 946.27, perM2: 4.39 }
  },
  "2.07": { 
    floor: 2, area: 41.2, occupancy: 2, circuits: ["circuit7"], type: "Meeting Room",
    volume: 115, monthlyHours: 86.6, avgOccupancy: 2,
    lighting: "8 ceiling lights (LED)", acUnits: 1,
    temperature: 21.8, humidity: 47,
    energy: { lighting: 1.66, plugs: 4.33, ac: 82.4, total: 88.39, perM2: 2.15 }
  },
  "2.08": { 
    floor: 2, area: 82.7, occupancy: 6, circuits: ["circuit8", "airconditioner2"], type: "Office",
    volume: 232, monthlyHours: 173, avgOccupancy: 6,
    lighting: "17 ceiling lights (LED)", acUnits: 2,
    temperature: 22.8, humidity: 44,
    energy: { lighting: 5.27, plugs: 26.88, ac: 330.8, total: 362.95, perM2: 4.39 }
  },
  
  // Floor 3 Rooms
  "3.01": { 
    floor: 3, area: 178.4, occupancy: 14, circuits: ["circuit11", "airconditioner1", "3DLED"], type: "Open Office",
    volume: 500, monthlyHours: 173, avgOccupancy: 14,
    lighting: "36 ceiling lights (LED)", acUnits: 4,
    temperature: 23.4, humidity: 41,
    energy: { lighting: 11.16, plugs: 62.78, ac: 713.6, total: 787.54, perM2: 4.41 }
  },
  "3.02": { 
    floor: 3, area: 99.5, occupancy: 8, circuits: ["circuit12", "airconditioner2"], type: "Office",
    volume: 279, monthlyHours: 173, avgOccupancy: 8,
    lighting: "20 ceiling lights (LED)", acUnits: 3,
    temperature: 23.0, humidity: 43,
    energy: { lighting: 6.2, plugs: 35.85, ac: 398, total: 440.05, perM2: 4.42 }
  },
  "3.04": { 
    floor: 3, area: 76.8, occupancy: 5, circuits: ["circuit9", "airconditioner1"], type: "Office",
    volume: 215, monthlyHours: 173, avgOccupancy: 5,
    lighting: "15 ceiling lights (LED)", acUnits: 2,
    temperature: 22.5, humidity: 45,
    energy: { lighting: 4.65, plugs: 22.41, ac: 307.2, total: 334.26, perM2: 4.35 }
  },
  "3.05": { 
    floor: 3, area: 228.6, occupancy: 17, circuits: ["circuit10", "airconditioner2", "3DLED"], type: "Open Office",
    volume: 640, monthlyHours: 173, avgOccupancy: 17,
    lighting: "46 ceiling lights (LED)", acUnits: 6,
    temperature: 23.6, humidity: 40,
    energy: { lighting: 14.26, plugs: 76.21, ac: 914.4, total: 1004.87, perM2: 4.40 }
  },
  "3.07": { 
    floor: 3, area: 44.3, occupancy: 3, circuits: ["circuit7"], type: "Meeting Room",
    volume: 124, monthlyHours: 86.6, avgOccupancy: 3,
    lighting: "9 ceiling lights (LED)", acUnits: 1,
    temperature: 21.6, humidity: 49,
    energy: { lighting: 1.87, plugs: 6.50, ac: 88.6, total: 96.97, perM2: 2.19 }
  },
  "3.08": { 
    floor: 3, area: 88.2, occupancy: 6, circuits: ["circuit8", "airconditioner1"], type: "Office",
    volume: 247, monthlyHours: 173, avgOccupancy: 6,
    lighting: "18 ceiling lights (LED)", acUnits: 2,
    temperature: 22.9, humidity: 44,
    energy: { lighting: 5.58, plugs: 26.88, ac: 352.8, total: 385.26, perM2: 4.37 }
  },
  
  // Floor 4 Rooms
  "4.01": { 
    floor: 4, area: 186.2, occupancy: 15, circuits: ["circuit11", "airconditioner2", "3DLED"], type: "Open Office",
    volume: 522, monthlyHours: 173, avgOccupancy: 15,
    lighting: "37 ceiling lights (LED)", acUnits: 5,
    temperature: 23.5, humidity: 40,
    energy: { lighting: 11.47, plugs: 67.28, ac: 744.8, total: 823.55, perM2: 4.42 }
  },
  "4.02": { 
    floor: 4, area: 104.7, occupancy: 8, circuits: ["circuit12", "airconditioner1"], type: "Office",
    volume: 293, monthlyHours: 173, avgOccupancy: 8,
    lighting: "21 ceiling lights (LED)", acUnits: 3,
    temperature: 23.1, humidity: 42,
    energy: { lighting: 6.51, plugs: 35.85, ac: 418.8, total: 461.16, perM2: 4.40 }
  },
  "4.04": { 
    floor: 4, area: 81.4, occupancy: 6, circuits: ["circuit9", "airconditioner2"], type: "Office",
    volume: 228, monthlyHours: 173, avgOccupancy: 6,
    lighting: "16 ceiling lights (LED)", acUnits: 2,
    temperature: 22.6, humidity: 44,
    energy: { lighting: 4.96, plugs: 26.88, ac: 325.6, total: 357.44, perM2: 4.39 }
  },
  "4.05": { 
    floor: 4, area: 241.8, occupancy: 18, circuits: ["circuit10", "airconditioner1", "3DLED, ovk"], type: "Open Office",
    volume: 678, monthlyHours: 173, avgOccupancy: 18,
    lighting: "48 ceiling lights (LED)", acUnits: 6,
    temperature: 23.7, humidity: 39,
    energy: { lighting: 14.88, plugs: 80.67, ac: 967.2, total: 1062.75, perM2: 4.40 }
  },
  "4.07": { 
    floor: 4, area: 47.6, occupancy: 3, circuits: ["circuit7, ovk"], type: "Meeting Room",
    volume: 133, monthlyHours: 86.6, avgOccupancy: 3,
    lighting: "10 ceiling lights (LED)", acUnits: 1,
    temperature: 21.4, humidity: 50,
    energy: { lighting: 2.08, plugs: 6.50, ac: 95.2, total: 103.78, perM2: 2.18 }
  },
  "4.08": { 
    floor: 4, area: 93.8, occupancy: 7, circuits: ["circuit8", "airconditioner2"], type: "Office",
    volume: 263, monthlyHours: 173, avgOccupancy: 7,
    lighting: "19 ceiling lights (LED)", acUnits: 3,
    temperature: 23.0, humidity: 43,
    energy: { lighting: 5.89, plugs: 31.38, ac: 375.2, total: 412.47, perM2: 4.40 }
  }
};

// Authoritative role-to-room mapping, reconciled with actual GeoJSON geometry data
// Each entry verified against RoomName and RoomNumber in Floorplan_polygon_4326.geojson
export const ROLE_ROOM_MAP = {
  // Floor 0 (BldgLevel 2)
  "lobby":              { roomNumber: "0.01",  floor: 0, geojsonName: "ФОАЙЕ" },
  "conference room":    { roomNumber: "0.02",  floor: 0, geojsonName: "ЗАЛА ЗА КОНФЕРЕНЦИИ" },
  "kitchen":            { roomNumber: "0.04",  floor: 0, geojsonName: "ПРОСТРАНСТВО ЗА ХРАНЕНЕ" },
  
  // Floor 1 (BldgLevel 3) - Training and collaboration spaces
  "foyer":              { roomNumber: "-1.01", floor: 1, geojsonName: "ФОАЙЕ / ЗОНА ЗА ДИСКУСИИ" },
  "open workspace":     { roomNumber: "-1.02", floor: 1, geojsonName: "ОТВОРЕНО ПРОСТРАНСТВО ЗА РАБОТА" },
  "training lab":       { roomNumber: "1.03",  floor: 1, geojsonName: "ЛАБОРАТОРИЯ ЗА ОБУЧЕНИЕ" },
  "seminar hall":       { roomNumber: "1.10",  floor: 1, geojsonName: "ЗАЛА ЗА СЕМИНАРНИ СРЕЩИ" },
  
  // Floor 2 (BldgLevel 4) - Research and management offices
  "research leader 1":  { roomNumber: "2.01",  floor: 2, geojsonName: "РЪКОВОДИТЕЛ НА ИЗСЛЕДОВАТЕЛСКА ГРУПА" },
  "research leader 2":  { roomNumber: "2.02",  floor: 2, geojsonName: "РЪКОВОДИТЕЛ НА ИЗСЛЕДОВАТЕЛСКА ГРУПА" },
  "research leader 3":  { roomNumber: "2.03",  floor: 2, geojsonName: "РЪКОВОДИТЕЛ НА ИЗСЛЕДОВАТЕЛСКА ГРУПА" },
  "research leader 4":  { roomNumber: "2.04",  floor: 2, geojsonName: "РЪКОВОДИТЕЛ НА ИЗСЛЕДОВАТЕЛСКА ГРУПА" },
  "cabinet 1":          { roomNumber: "2.05",  floor: 2, geojsonName: "КАБИНЕТ" },
  "cabinet 2":          { roomNumber: "2.06",  floor: 2, geojsonName: "КАБИНЕТ" },
  "cabinet 3":          { roomNumber: "2.07",  floor: 2, geojsonName: "КАБИНЕТ" },
  "cabinet 4":          { roomNumber: "2.08",  floor: 2, geojsonName: "КАБИНЕТ" },
  "cabinet 5":          { roomNumber: "2.09",  floor: 2, geojsonName: "КАБИНЕТ" },
  "cabinet 6":          { roomNumber: "2.10",  floor: 2, geojsonName: "КАБИНЕТ" },
  "cabinet 7":          { roomNumber: "2.11",  floor: 2, geojsonName: "КАБИНЕТ" },
  "researchers":        { roomNumber: "2.12",  floor: 2, geojsonName: "ИЗСЛЕДОВАТЕЛИ" },
  "cabinet 8":          { roomNumber: "2.13",  floor: 2, geojsonName: "КАБИНЕТ" },
  "cabinet 9":          { roomNumber: "2.14",  floor: 2, geojsonName: "КАБИНЕТ" },
  "discussion room":    { roomNumber: "2.16",  floor: 2, geojsonName: "ЗОНА ЗА ДИСКУСИИ" },
  "rest room":          { roomNumber: "2.19",  floor: 2, geojsonName: "СТАЯ ЗА ПОЧИВКА" },
  "waiting area":       { roomNumber: "2.20",  floor: 2, geojsonName: "ЗОНА ЗА ИЗЧАКВАНЕ" },
  
  // Floor 3 (BldgLevel 5) - Administration
  "director":           { roomNumber: "3.01",  floor: 3, geojsonName: "ДИРЕКТОР" },
  "deputy director 1":  { roomNumber: "3.02",  floor: 3, geojsonName: "ЗАМ. ДИРЕКТОР" },
  "deputy director 2":  { roomNumber: "3.03",  floor: 3, geojsonName: "ЗАМ. ДИРЕКТОР" },
  "deputy director 3":  { roomNumber: "3.04",  floor: 3, geojsonName: "ЗАМ. ДИРЕКТОР" },
  "accountant 1":       { roomNumber: "3.05",  floor: 3, geojsonName: "СЧЕТОВОДИТЕЛ" },
  "office manager":     { roomNumber: "3.06",  floor: 3, geojsonName: "ДЕЛОВОДИТЕЛ И ДОМАКИН" },
  "fl3 waiting area":   { roomNumber: "3.07",  floor: 3, geojsonName: "ЗОНА ЗА ИЗЧАКВАНЕ" },
  "it department":      { roomNumber: "3.10",  floor: 3, geojsonName: "IT ОТДЕЛ" },
  "office 1":           { roomNumber: "3.11",  floor: 3, geojsonName: "ОФИС" },
  "office 2":           { roomNumber: "3.12",  floor: 3, geojsonName: "ОФИС" },
  "business":           { roomNumber: "3.13",  floor: 3, geojsonName: "БИЗНЕС РАЗВИТИЕ" },
  "wardrobe":           { roomNumber: "3.14",  floor: 3, geojsonName: "ГАРДЕРОБ" },
  "hr":                 { roomNumber: "3.15",  floor: 3, geojsonName: "ЧОВЕШКИ РЕСУРСИ" },
  "accountant 2":       { roomNumber: "3.16",  floor: 3, geojsonName: "СЧЕТОВОДИТЕЛ" },
  "lawyer":             { roomNumber: "3.16",  floor: 3, geojsonName: "СЧЕТОВОДИТЕЛ" },
  "pr officer":         { roomNumber: "3.17",  floor: 3, geojsonName: "PR" },
  "meeting hall":       { roomNumber: "3.18",  floor: 3, geojsonName: "ЗАЛА ЗА СРЕЩИ" },
  "assistant":          { roomNumber: "3.19",  floor: 3, geojsonName: "АСИСТЕНТ" },
  "cabinet":            { roomNumber: "3.20",  floor: 3, geojsonName: "КАБИНЕТ" },
  "stairs":             { roomNumber: "3.22",  floor: 3, geojsonName: "СТЪЛБА" },
  "corridor":           { roomNumber: "3.23",  floor: 3, geojsonName: "КОРИДОР" },
  "conference hall":    { roomNumber: "3.24",  floor: 3, geojsonName: "ЗАЛА ЗА КОНФЕРЕНТНИ РАЗГОВОРИ" },
};
export const ROLE_BY_ROOM_NUMBER = Object.fromEntries(
  Object.entries(ROLE_ROOM_MAP).map(([label, info]) => [info.roomNumber, label])
);

// Export ROOM_METADATA as MOCK_ROOM_DATA for backward compatibility
export const MOCK_ROOM_DATA = ROOM_METADATA;

// Fetch room data: returns all data from PDF (no API calls for now)
export async function fetchRoomData() {
  console.log('📄 Loading room data from PDF...');
  
  // Return a copy of the metadata with all PDF data (energy, temperature, humidity)
  const roomData = {};
  for (const [roomKey, metadata] of Object.entries(ROOM_METADATA)) {
    roomData[roomKey] = { ...metadata };
  }
  
  console.log(`✅ Loaded ${Object.keys(roomData).length} rooms from PDF data`);
  return roomData;
}

export async function fetchFloorData() {
  const roomData = await fetchRoomData();
  return calculateFloorSummaries(roomData);
}

// Calculate floor summaries from room data
export function calculateFloorSummaries(roomData) {
  const floors = {};
  
  Object.entries(roomData).forEach(([roomName, data]) => {
    const floorNum = data.floor;
    
    if (!floors[floorNum]) {
      floors[floorNum] = {
        floor: floorNum,
        roomCount: 0,
        totalEnergy: 0,
        totalTemperature: 0,
        totalHumidity: 0,
        totalArea: 0,
        totalOccupancy: 0,
        rooms: []
      };
    }
    
    floors[floorNum].roomCount++;
    if (data.energy?.total) floors[floorNum].totalEnergy += data.energy.total;
    if (data.temperature) floors[floorNum].totalTemperature += data.temperature;
    if (data.humidity) floors[floorNum].totalHumidity += data.humidity;
    floors[floorNum].totalArea += data.area;
    floors[floorNum].totalOccupancy += data.occupancy;
    floors[floorNum].rooms.push({ name: roomName, ...data });
  });
  
  // Calculate averages
  Object.values(floors).forEach(floor => {
    floor.avgTemperature = (floor.totalTemperature / floor.roomCount).toFixed(1);
    floor.avgHumidity = Math.round(floor.totalHumidity / floor.roomCount);
    floor.totalEnergy = floor.totalEnergy.toFixed(1);
  });
  
  return floors;
}

// Match Cesium feature name to room data
export function matchRoomData(cesiumName, roomData) {
  const normalized = cesiumName.toLowerCase().trim();
  
  // Extract room pattern like "1.02"
  const roomPattern = normalized.match(/(\d+)\.(\d+)/);
  if (roomPattern) {
    const roomKey = `${roomPattern[1]}.${roomPattern[2]}`;
    if (roomData[roomKey]) {
      return { name: roomKey, ...roomData[roomKey] };
    }
  }
  
  // Try exact match
  for (const [roomName, data] of Object.entries(roomData)) {
    if (roomName.toLowerCase() === normalized) {
      return { name: roomName, ...data };
    }
  }
  
  return null;
}

// Helper functions for UI
export function extractFloorNumber(cesiumName) {
  const normalized = cesiumName.toLowerCase();
  const match = normalized.match(/(?:floor|level)\s*(\d+)/);
  if (match) return parseInt(match[1]);
  const numberMatch = normalized.match(/\d+/);
  return numberMatch ? parseInt(numberMatch[0]) : 1;
}

export function isFloorFeature(cesiumName, category = '') {
  const normalized = cesiumName.toLowerCase();
  const normalizedCategory = category.toLowerCase();
  return normalizedCategory.includes('floor') || normalizedCategory.includes('level') ||
         normalized.includes('floor') || normalized.includes('level') ||
         normalized.match(/^f\d+$/i) || normalized.match(/^level\s*\d+$/i);
}

export function formatEnergy(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} MWh`;
  return `${value.toFixed(1)} kWh`;
}

export function getEnergyStatusColor(energyPerArea) {
  if (energyPerArea < 1.5) return '#27ae60';
  if (energyPerArea < 2.5) return '#f39c12';
  return '#e74c3c';
}

export function getTemperatureStatus(temp) {
  if (temp < 18) return { status: 'Cold', color: '#3498db' };
  if (temp <= 24) return { status: 'Comfortable', color: '#27ae60' };
  return { status: 'Warm', color: '#e74c3c' };
}

export function getHumidityStatus(humidity) {
  if (humidity < 30) return { status: 'Dry', color: '#e74c3c' };
  if (humidity <= 60) return { status: 'Comfortable', color: '#27ae60' };
  return { status: 'Humid', color: '#3498db' };
}

// Get historical time-series data for a room
export async function fetchRoomHistory(roomName, days = 7, endIso = null) {
  const trendKey = deriveTrendRoomKey(roomName);
  const endpoint = ROOM_ENDPOINT_MAP[trendKey];

  if (!endpoint) {
    console.warn(`No BMS endpoints for room ${roomName}`);
    return { temp: [], humidity: [], co2: [] };
  }

  const baseUrl = API_BASES.building;

  try {
    // Find the latest timestamp in this room's data, then work backwards
    let toIso;
    if (endIso) {
      toIso = endIso;
    } else {
      const latestRows = await fetchJsonWithFallback(baseUrl, endpoint, {
        select: "timestamp",
        order: "timestamp.desc",
        limit: 1,
      }).catch(() => []);
      const latestRow = Array.isArray(latestRows) && latestRows.length ? latestRows[0] : null;
      if (!latestRow?.timestamp) return { temp: [], humidity: [], co2: [] };
      toIso = latestRow.timestamp;
    }

    const toDate = new Date(toIso);
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

    const rows = await fetchJsonWithFallback(baseUrl, endpoint, {
      select: "timestamp,temp_c,humidity_rh,co2_ppm",
      and: `(timestamp.gte.${fromDate.toISOString()},timestamp.lte.${toDate.toISOString()})`,
      order: "timestamp.asc",
      limit: 2000,
    }).catch(() => []);

    const parsed = Array.isArray(rows) ? rows : [];
    return {
      temp: parsed
        .filter((r) => Number.isFinite(Number(r?.temp_c)))
        .map((r) => ({ t: new Date(r.timestamp).getTime(), v: Number(r.temp_c) })),
      humidity: parsed
        .filter((r) => Number.isFinite(Number(r?.humidity_rh)))
        .map((r) => ({ t: new Date(r.timestamp).getTime(), v: Number(r.humidity_rh) })),
      co2: parsed
        .filter((r) => Number.isFinite(Number(r?.co2_ppm)))
        .map((r) => ({ t: new Date(r.timestamp).getTime(), v: Number(r.co2_ppm) })),
    };
  } catch (error) {
    console.error('Error fetching room history:', error);
    return { temp: [], humidity: [], co2: [] };
  }
}

export async function fetchLatestRoomTelemetry(roomName) {
  const trendKey = deriveTrendRoomKey(roomName);
  const endpoint = ROOM_ENDPOINT_MAP[trendKey];

  if (!endpoint) {
    return { temperature: null, humidity: null, co2: null, timestampMs: null };
  }

  const baseUrl = API_BASES.building;

  try {
    const rows = await fetchJsonWithFallback(baseUrl, endpoint, {
      select: 'timestamp,temp_c,humidity_rh,co2_ppm',
      order: 'timestamp.desc',
      limit: 1,
    }).catch(() => []);

    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    const timestampMs = row ? new Date(row.timestamp).getTime() : null;

    return {
      temperature: row && Number.isFinite(Number(row.temp_c)) ? Number(row.temp_c) : null,
      humidity: row && Number.isFinite(Number(row.humidity_rh)) ? Number(row.humidity_rh) : null,
      co2: row && Number.isFinite(Number(row.co2_ppm)) ? Number(row.co2_ppm) : null,
      timestampMs: Number.isFinite(timestampMs) ? timestampMs : null,
    };
  } catch (error) {
    console.error(`Error fetching latest telemetry for room ${roomName}:`, error);
    return { temperature: null, humidity: null, co2: null, timestampMs: null };
  }
}

import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";

export default function CesiumGeoJsonViewer({ onFeatureClick }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const i3sProviderRef = useRef(null);

  const roomEntitiesRef = useRef([]);
  const circuitEntitiesRef = useRef([]);
  const homeDestinationRef = useRef(null);
  const availableFloorsRef = useRef([]);
  const energyFlowEntitiesRef = useRef([]);
  const sensorMarkerEntitiesRef = useRef([]);
  const timeWindowRef = useRef({ start: null, end: null });
  const animFramesRef = useRef([]);       // [{label, hour, roomData: Map<rn,{temp,humidity,co2,occupancy}>}]
  const animIntervalRef = useRef(null);   // setInterval handle
  const activeHeatmapRef = useRef(null);  // mirror of activeHeatmap for use inside intervals
  const hoverHandlerRef = useRef(null);   // Cesium ScreenSpaceEventHandler

  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [availableFloors, setAvailableFloors] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedCircuit, setSelectedCircuit] = useState("");
  const [activeHeatmap, setActiveHeatmap] = useState(null);
  const [activeMode, setActiveMode] = useState("default");

  // ── Animation state ──────────────────────────────────────────────────────────
  const [animFrame, setAnimFrame] = useState(0);
  const [animPlaying, setAnimPlaying] = useState(false);
  const [animReady, setAnimReady] = useState(false);

  // ── Hover tooltip state ──────────────────────────────────────────────────────
  const [hoveredRoom, setHoveredRoom] = useState(null); // {x,y,name,floor,value,unit}

  // ── Building summary state ───────────────────────────────────────────────────
  const [buildingSummary, setBuildingSummary] = useState(null); // {min,max,avg,alertCount,worstRoom,bestRoom}

  // Keep activeHeatmapRef in sync so animation interval can read it without stale closure
  useEffect(() => { activeHeatmapRef.current = activeHeatmap; }, [activeHeatmap]);

  const circuitConfigs = {
    main: { label: "Main", color: "#3B82F6" },
    circuit6boiler: { label: "Circuit 6 Boiler", color: "#EF4444" },
    circuit7: { label: "Circuit 7", color: "#F59E0B" },
    elevator: { label: "Elevator", color: "#8B5CF6" },
    circuit8: { label: "Circuit 8", color: "#10B981" },
    circuit9: { label: "Circuit 9", color: "#06B6D4" },
    circuit10: { label: "Circuit 10", color: "#F97316" },
    circuit11: { label: "Circuit 11", color: "#EC4899" },
    circuit12: { label: "Circuit 12", color: "#84CC16" },
    airconditioner1: { label: "Air Conditioner 1", color: "#14B8A6" },
    airconditioner2: { label: "Air Conditioner 2", color: "#0EA5E9" },
    outsidelighting1: { label: "Outside Lighting 1", color: "#FACC15" },
    outsidelighting2: { label: "Outside Lighting 2", color: "#FB923C" },
    vehiclecharging1: { label: "Vehicle Charging 1", color: "#22C55E" },
    vehiclecharging2: { label: "Vehicle Charging 2", color: "#16A34A" },
    "3DLED": { label: "3D LED", color: "#FF4D6D" },
  };

  const circuitCameraPositions = {
    main: { lon: 23.330494, lat: 42.673775, height: 620, heading: 0, pitch: -45 },
    circuit6boiler: { lon: 23.330494, lat: 42.673775, height: 620, heading: 0, pitch: -45 },
    circuit7: { lon: 23.330494, lat: 42.673775, height: 620, heading: 0, pitch: -45 },
    elevator: { lon: 23.330494, lat: 42.673775, height: 620, heading: 0, pitch: -45 },
    circuit8: { lon: 23.3306, lat: 42.67375, height: 615, heading: 0, pitch: -50 },
    circuit9: { lon: 23.330494, lat: 42.673775, height: 620, heading: 0, pitch: -45 },
    circuit10: { lon: 23.3304, lat: 42.6737, height: 619, heading: 45, pitch: -50 },
    circuit11: { lon: 23.330494, lat: 42.673775, height: 620, heading: 0, pitch: -45 },
    circuit12: { lon: 23.33055, lat: 42.6738, height: 617, heading: 0, pitch: -50 },
    airconditioner1: { lon: 23.3307, lat: 42.6739, height: 625, heading: 180, pitch: -55 },
    airconditioner2: { lon: 23.3307, lat: 42.6739, height: 625, heading: 180, pitch: -55 },
    outsidelighting1: { lon: 23.33045, lat: 42.67392, height: 610, heading: 180, pitch: -60 },
    outsidelighting2: { lon: 23.33045, lat: 42.67352, height: 610, heading: 0, pitch: -60 },
    vehiclecharging1: { lon: 23.33025, lat: 42.6738, height: 608, heading: 270, pitch: -65 },
    vehiclecharging2: { lon: 23.33075, lat: 42.67365, height: 608, heading: 90, pitch: -65 },
    "3DLED": { lon: 23.33035, lat: 42.67375, height: 608, heading: 270, pitch: -55 },
  };

  // Named camera presets for flyToCameraPreset
  const cameraPresets = {
    overview:      { lon: 23.330494, lat: 42.673775, height: 620, heading: 0,   pitch: -45 },
    north_facade:  { lon: 23.330494, lat: 42.67410, height: 560, heading: 180, pitch: -20 },
    south_facade:  { lon: 23.330494, lat: 42.67340, height: 560, heading: 0,   pitch: -20 },
    roof:          { lon: 23.330494, lat: 42.673775, height: 580, heading: 0,   pitch: -89 },
    interior_fl0:  { lon: 23.330494, lat: 42.673775, height: 610, heading: 0,   pitch: -55 },
    interior_fl1:  { lon: 23.330494, lat: 42.673775, height: 613, heading: 0,   pitch: -55 },
    interior_fl2:  { lon: 23.330494, lat: 42.673775, height: 616, heading: 0,   pitch: -55 },
    interior_fl3:  { lon: 23.330494, lat: 42.673775, height: 619, heading: 0,   pitch: -55 },
    interior_fl4:  { lon: 23.330494, lat: 42.673775, height: 622, heading: 0,   pitch: -55 },
  };

  // ─── ALERT THRESHOLDS ────────────────────────────────────────────────────────
  const ALERT_THRESHOLDS = {
    co2:         { operator: "gt", value: 1000, color: "#EF4444" },  // red
    temperature: { operator: "gt", value: 26,   color: "#F97316" },  // orange
    humidity_lo: { operator: "lt", value: 30,   color: "#60A5FA" },  // blue (dry)
    humidity_hi: { operator: "gt", value: 65,   color: "#06B6D4" },  // cyan (humid)
  };

  // ─── NORMALIZERS ─────────────────────────────────────────────────────────────

  const normalizeCircuitId = (raw) => {
    if (raw === null || raw === undefined) return "";
    const value = String(raw).trim();
    if (!value) return "";
    if (circuitConfigs[value]) return value;
    const lowered = value.toLowerCase().replace(/\s+/g, "");
    const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (circuitConfigs[lowered]) return lowered;
    if (circuitConfigs[compact]) return compact;
    if (compact === "3dled" || compact === "x3dled") return "3DLED";
    const digitsOnly = compact.match(/^\d+$/);
    if (digitsOnly) {
      const candidate = `circuit${digitsOnly[0]}`;
      if (circuitConfigs[candidate]) return candidate;
    }
    const circuitMatch = compact.match(/^circuit(\d+)$/);
    if (circuitMatch) {
      const candidate = `circuit${circuitMatch[1]}`;
      if (circuitConfigs[candidate]) return candidate;
    }
    const byLabel = Object.entries(circuitConfigs).find(([, cfg]) =>
      String(cfg.label).toLowerCase().replace(/\s+/g, "") === lowered
    );
    if (byLabel) return byLabel[0];
    return value;
  };

  const normalizeSearchText = (value) =>
    String(value ?? "").toLowerCase().trim().replace(/\s+/g, " ");

  const compactSearchText = (value) => normalizeSearchText(value).replace(/\s+/g, "");

  const getSearchTerms = (rawQuery) => {
    const normalized = normalizeSearchText(rawQuery);
    if (!normalized) return [];
    const terms = new Set([normalized]);
    if (normalized.includes("elevator") || normalized.includes("lift")) {
      terms.add("elevator"); terms.add("elevators");
      terms.add("lift");     terms.add("lifts");
      terms.add("асансьор");
    }
    return [...terms];
  };

  const extractNormalizedRoomNumber = (value) => {
    const text = String(value ?? "").toLowerCase().trim();
    if (!text) return "";
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    const match = normalized.match(/(?:room\s*)?(-?\d+\.\d+)/i);
    if (!match) return "";
    return match[1];
  };

  // ─── TRANSLATIONS ─────────────────────────────────────────────────────────────

  const translateRoomName = (bulgarianName) => {
    if (!bulgarianName) return "";
    const translations = {
      "ЗОНА ЗА ИЗЧАКВАНЕ": "Waiting Zone",
      "КОРИДОР": "Corridor",
      "ИЗСЛЕДОВАТЕЛИ": "Researchers",
      "КАБИНЕТ": "Office",
      "WC ЖЕНИ": "Women's WC",
      "WC МЪЖЕ": "Men's WC",
      "WC за хора в  неравностойно  положение": "Accessible WC",
      "WC за хора в неравностойно положение": "Accessible WC",
      "СТЪЛБА": "Staircase",
      "ЕВАКУАЦИОННА СТЪЛБА": "Emergency Staircase",
      "АСАНСЬОР И ШАХТА": "Elevator Shaft",
      "АСАНСЬОР": "Elevator",
      "АСАНСЬОРНА ШАХТА": "Elevator Shaft",
      "ПОМЕЩЕНИЕ ЕЛ": "Electrical Room",
      "ПОМЕЩЕНИЕ UPS": "UPS Room",
      "ПОМЕЩЕНИЕ": "Room",
      "ТЕХНИЧЕСКА СТАЯ": "Technical Room",
      "ТЕХНОЛОГИЧНА СТАЯ": "Technical Room",
      "СЪРВЪРНО ПОМЕЩЕНИЕ": "Server Room",
      "АБОНАТНА СТАНЦИЯ": "Subscriber Station",
      "ГРТ": "Gas Regulation Station",
      "IT ОТДЕЛ": "IT Department",
      "ОФИС": "Office",
      "БИЗНЕС РАЗВИТИЕ": "Business Development",
      "ГАРДЕРОБ": "Wardrobe",
      "ЧОВЕШКИ РЕСУРСИ": "Human Resources",
      "СЧЕТОВОДИТЕЛ": "Accountant",
      "ДИРЕКТОР": "Director",
      "АСИСТЕНТ": "Assistant",
      "ЗАМ. ДИРЕКТОР": "Deputy Director",
      "ДЕЛОВОДИТЕЛ И ДОМАКИН": "Administrator",
      "РЪКОВОДИТЕЛ НА ИЗСЛЕДОВАТЕЛСКА ГРУПА": "Research Group Leader",
      "ЗАЛА ЗА СРЕЩИ": "Meeting Room",
      "ЗАЛА ЗА КОНФЕРЕНЦИИ": "Conference Hall",
      "ЗАЛА ЗА КОНФЕРЕНТНИ РАЗГОВОРИ": "Conference Room",
      "ЗАЛА ЗА СЕМИНАРНИ СРЕЩИ": "Seminar Room",
      "ЗАЛА ЗА ВИЗУАЛИЗАЦИЯ": "Visualization Hall",
      "ЗАЛА SAP": "SAP Hall",
      "ПРОСТРАНСТВО ЗА ХРАНЕНЕ": "Dining Area",
      "ОТВОРЕНО ПРОСТРАНСТВО ЗА РАБОТА": "Open Work Space",
      "ФОАЙЕ": "Foyer",
      "ФОАЙЕ / ЗОНА ЗА ДИСКУСИИ": "Foyer / Discussion Zone",
      "ВИНДФАНГ": "Vestibule",
      "СТАЯ ЗА ПОЧИВКА": "Break Room",
      "СТОЛОВА": "Cafeteria",
      "КУХНЯ": "Kitchen",
      "СКЛАДОВА БАЗА": "Storage Room",
      "СКЛАД": "Storage",
      "АРХИВ": "Archive",
      "КОПИРНА": "Copy Room",
      "КАСИЕР": "Cashier",
      "РЕЦЕПЦИЯ": "Reception",
      "ЛАБОРАТОРИЯ ЗА ОБУЧЕНИЕ": "Training Laboratory",
      "ЗАЛ": "Hall",
      "ЗАЛА": "Hall",
      "САНИТАРЕН ВЪЗЕЛ": "Restroom",
      "БАНЯ": "Bathroom",
    };
    if (translations[bulgarianName]) return translations[bulgarianName];
    const upper = bulgarianName.toUpperCase();
    for (const [bg, en] of Object.entries(translations)) {
      if (upper.includes(bg.toUpperCase())) return en;
    }
    return bulgarianName;
  };

  // ─── COLOR HELPERS ────────────────────────────────────────────────────────────

  const getRoomColor = (roomName) => {
    const name = (roomName || "").toUpperCase();
    if (name.includes("WC") || name.includes("TOILET"))
      return Cesium.Color.fromCssColorString("#FFFFFF").withAlpha(0.88);
    if (name.includes("STAIRCASE") || name.includes("СТЪЛБА"))
      return Cesium.Color.fromCssColorString("#7A7A7A").withAlpha(0.92);
    if (name.includes("ELEVATOR") || name.includes("АСАНСЬОР"))
      return Cesium.Color.fromCssColorString("#5C5C5C").withAlpha(0.92);
    if (name.includes("CORRIDOR") || name.includes("КОРИДОР"))
      return Cesium.Color.fromCssColorString("#E8E8E8").withAlpha(0.78);
    if (name.includes("MEETING") || name.includes("CONFERENCE") || name.includes("ЗАЛА"))
      return Cesium.Color.fromCssColorString("#D4A373").withAlpha(0.85);
    if (name.includes("DIRECTOR") || name.includes("ДИРЕКТОР"))
      return Cesium.Color.fromCssColorString("#8B4513").withAlpha(0.88);
    if (name.includes("IT") || name.includes("TECHNICAL") || name.includes("ЕЛЕКТР"))
      return Cesium.Color.fromCssColorString("#B0B0B0").withAlpha(0.85);
    return Cesium.Color.fromCssColorString("#4DA3FF").withAlpha(0.72);
  };

  /**
   * Map a 0-1 t value to a colour gradient.
   * stops: array of { t, r, g, b } (0-255)
   */
  const interpolateColorStops = (t, stops) => {
    const clamped = Math.max(0, Math.min(1, t));
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      if (clamped >= a.t && clamped <= b.t) {
        const f = (clamped - a.t) / (b.t - a.t);
        return new Cesium.Color(
          (a.r + f * (b.r - a.r)) / 255,
          (a.g + f * (b.g - a.g)) / 255,
          (a.b + f * (b.b - a.b)) / 255,
          0.88
        );
      }
    }
    const last = stops[stops.length - 1];
    return new Cesium.Color(last.r / 255, last.g / 255, last.b / 255, 0.88);
  };

  // Temperature: blue → green → red  (15°C → 22°C → 30°C)
  const tempToColor = (temp) => interpolateColorStops(
    (temp - 15) / (30 - 15),
    [
      { t: 0,    r: 59,  g: 130, b: 246 }, // blue
      { t: 0.45, r: 34,  g: 197, b: 94  }, // green
      { t: 0.75, r: 251, g: 146, b: 60  }, // orange
      { t: 1,    r: 239, g: 68,  b: 68  }, // red
    ]
  );

  // CO2: green → yellow → red  (400 ppm → 800 ppm → 1200 ppm)
  const co2ToColor = (co2) => interpolateColorStops(
    (co2 - 400) / (1200 - 400),
    [
      { t: 0,    r: 34,  g: 197, b: 94  }, // green
      { t: 0.5,  r: 250, g: 204, b: 21  }, // yellow
      { t: 1,    r: 239, g: 68,  b: 68  }, // red
    ]
  );

  // Humidity: red (dry) → green → blue (humid)  (20% → 50% → 80%)
  const humidityToColor = (rh) => interpolateColorStops(
    (rh - 20) / (80 - 20),
    [
      { t: 0,    r: 239, g: 68,  b: 68  }, // red
      { t: 0.5,  r: 34,  g: 197, b: 94  }, // green
      { t: 1,    r: 59,  g: 130, b: 246  }, // blue
    ]
  );

  // Occupancy: white → orange → red  (0 → 5 → 10+)
  const occupancyToColor = (occ) => interpolateColorStops(
    occ / 10,
    [
      { t: 0,   r: 240, g: 240, b: 240 }, // white
      { t: 0.5, r: 251, g: 146, b: 60  }, // orange
      { t: 1,   r: 239, g: 68,  b: 68  }, // red
    ]
  );

  const metricToColor = (metric, value) => {
    switch (metric) {
      case "temperature": return tempToColor(value);
      case "co2":         return co2ToColor(value);
      case "humidity":    return humidityToColor(value);
      case "occupancy":   return occupancyToColor(value);
      default:            return Cesium.Color.fromCssColorString("#4DA3FF").withAlpha(0.72);
    }
  };

  const metricPropertyKey = (metric) => {
    switch (metric) {
      case "temperature": return "temperature";
      case "co2":         return "co2";
      case "humidity":    return "humidity";
      case "occupancy":   return "occupancy";
      default:            return metric;
    }
  };

  const evaluateOperator = (value, operator, threshold) => {
    switch (operator) {
      case "gt":  return value > threshold;
      case "lt":  return value < threshold;
      case "gte": return value >= threshold;
      case "lte": return value <= threshold;
      case "eq":  return value === threshold;
      default:    return false;
    }
  };

  // ─── ROOM DATA ────────────────────────────────────────────────────────────────

  const getRoomData = (roomType) => {
    const base = { temp: 22, humidity: 45, occupancy: 0, co2: 400 };
    if ((roomType || "").toUpperCase().includes("WC"))
      return { ...base, temp: 20, humidity: 55 };
    if ((roomType || "").toUpperCase().includes("MEETING"))
      return { ...base, temp: 23, humidity: 42, occupancy: 8, co2: 600 };
    return {
      ...base,
      temp:      22 + Math.floor(Math.random() * 3),
      humidity:  40 + Math.floor(Math.random() * 10),
      occupancy: Math.floor(Math.random() * 4),
      co2:       450 + Math.floor(Math.random() * 300),
    };
  };

  const getRoomCircuitId = (roomNumber, roomName, buildingLevel) => {
    const nameLower = (roomName || "").toLowerCase();
    const numStr = (roomNumber || "").toString();
    const circuits = [];
    if (nameLower.includes("elevator") || nameLower.includes("shaft") ||
        nameLower.includes("асансьор") || nameLower.includes("шахта"))
      circuits.push("elevator");
    if (buildingLevel === 1 || nameLower.includes("абонатн") || nameLower.includes("грт") ||
        ["14","15","16","006","107","42","68"].includes(numStr))
      circuits.push("circuit6boiler");
    if (nameLower.includes("ups") || nameLower.includes("power") || nameLower.includes("ел") || numStr === "16")
      circuits.push("circuit10");
    if (nameLower.includes("човешки ресурси") || nameLower.includes("human resources") ||
        nameLower.includes("it отдел") || nameLower.includes("it department") ||
        nameLower.includes("network") || nameLower.includes("telecom") ||
        nameLower.includes("комуникац") || numStr === "315" || numStr === "310")
      circuits.push("circuit11");
    if (nameLower.includes("server") || nameLower.includes("сървър") || numStr === "17")
      circuits.push("circuit8");
    if (((nameLower.includes("склад") || nameLower.includes("storage")) &&
        !nameLower.includes("асансьор")) ||
        ["-13","22","007","29"].includes(numStr))
      circuits.push("circuit12");
    if (buildingLevel === 1 || buildingLevel === 2) circuits.push("airconditioner1");
    if (buildingLevel === 3 || buildingLevel === 4 || buildingLevel === 5) circuits.push("airconditioner2");
    if (nameLower.includes("conference") || nameLower.includes("meeting") ||
        nameLower.includes("конференц") || nameLower.includes("срещ") ||
        nameLower.includes("visualization") || nameLower.includes("визуализация") ||
        nameLower.includes("sap") || nameLower.includes("зала") ||
        ["002","-01","-02","110"].includes(numStr))
      circuits.push("circuit7");
    if (nameLower.includes("office") || nameLower.includes("офис") ||
        nameLower.includes("workspace") || nameLower.includes("работ") ||
        nameLower.includes("open") || nameLower.includes("отворен") ||
        nameLower.includes("лаборатория") || nameLower.includes("laboratory") ||
        nameLower.includes("director") || nameLower.includes("директор") ||
        nameLower.includes("изследовател") || nameLower.includes("кабинет") ||
        nameLower.includes("бизнес") || nameLower.includes("счетоводител") ||
        nameLower.includes("асистент"))
      circuits.push("circuit9");
    circuits.push("main");
    return [...new Set(circuits)];
  };

  // ─── GEOMETRY ─────────────────────────────────────────────────────────────────

  const geometryToPolygons = (geometry, baseElevation) => {
    if (!geometry) return [];
    const ringToPositions = (ring) =>
      ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, baseElevation));
    if (geometry.type === "Polygon") {
      const outerRing = geometry.coordinates?.[0];
      if (!Array.isArray(outerRing) || outerRing.length < 3) return [];
      return [ringToPositions(outerRing)];
    }
    if (geometry.type === "MultiPolygon") {
      return geometry.coordinates
        .map((polygon) => polygon?.[0])
        .filter((outerRing) => Array.isArray(outerRing) && outerRing.length >= 3)
        .map((outerRing) => ringToPositions(outerRing));
    }
    return [];
  };

  // ─── ENTITY HELPERS ───────────────────────────────────────────────────────────

  const resetStylesAndLabels = () => {
    [...roomEntitiesRef.current, ...circuitEntitiesRef.current].forEach((entity) => {
      if (entity.polygon && entity.originalMaterial) {
        entity.polygon.material = entity.originalMaterial;
        entity.polygon.outlineColor = Cesium.Color.BLACK.withAlpha(0.85);
        entity.polygon.outlineWidth = 2;
      }
      if (entity.box && entity.originalMaterial)      entity.box.material = entity.originalMaterial;
      if (entity.cylinder && entity.originalMaterial) entity.cylinder.material = entity.originalMaterial;
      if (entity.ellipsoid && entity.originalMaterial) entity.ellipsoid.material = entity.originalMaterial;
      if (entity.labelEntity) entity.labelEntity.show = false;
    });
    setActiveHeatmap(null);
    activeHeatmapRef.current = null;
    setBuildingSummary(null);
    setHoveredRoom(null);
    setAnimPlaying(false);
  };

  const getBoundingSphereFromEntities = (entities) => {
    const positions = [];
    entities.forEach((entity) => {
      if (entity.polygon?.hierarchy?.getValue) {
        const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
        if (hierarchy?.positions) positions.push(...hierarchy.positions);
      } else if (entity.position?.getValue) {
        const p = entity.position.getValue(Cesium.JulianDate.now());
        if (p) positions.push(p);
      }
    });
    if (!positions.length) return null;
    return Cesium.BoundingSphere.fromPoints(positions);
  };

  const showOnlyEntities = (predicate) => {
    [...roomEntitiesRef.current, ...circuitEntitiesRef.current].forEach((entity) => {
      entity.show = predicate(entity);
      if (entity.labelEntity) entity.labelEntity.show = false;
    });
  };

  const zoomToEntities = (entities, rangeMultiplier = 2.5, minRange = 25) => {
    const viewer = viewerRef.current;
    if (!viewer || !entities.length) return;
    const sphere = getBoundingSphereFromEntities(entities);
    if (!sphere) return;
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-45),
        Math.max(sphere.radius * rangeMultiplier, minRange)
      ),
    });
  };

  // ─── HEATMAP ──────────────────────────────────────────────────────────────────

  const showHeatmap = (metric) => {
    if (!metric) return;
    const propKey = metricPropertyKey(metric);

    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();

    roomEntitiesRef.current.forEach((entity) => {
      entity.show = true;
      const value = entity.properties?.[propKey]?.getValue?.();
      if (value !== undefined && value !== null && entity.polygon) {
        entity.polygon.material = metricToColor(metric, Number(value));
        entity.polygon.outlineColor = Cesium.Color.BLACK.withAlpha(0.5);
        entity.polygon.outlineWidth = 1;
      }
    });

    setActiveHeatmap(metric);
    activeHeatmapRef.current = metric;
    computeBuildingSummary(metric);
  };

  // ─── ANIMATION HELPERS ────────────────────────────────────────────────────────

  // Build 24 synthetic hourly frames from the entity base values
  const generateAnimFrames = (entities) => {
    const roomBases = new Map();
    entities.forEach((e) => {
      const rn = e.properties?.roomNumber?.getValue?.();
      if (rn && !roomBases.has(rn)) {
        roomBases.set(rn, {
          temp:      Number(e.properties.temperature?.getValue?.() ?? 22),
          humidity:  Number(e.properties.humidity?.getValue?.()    ?? 45),
          co2:       Number(e.properties.co2?.getValue?.()         ?? 450),
          occupancy: Number(e.properties.occupancy?.getValue?.()   ?? 0),
        });
      }
    });

    const frames = Array.from({ length: 24 }, (_, h) => {
      const isWork = h >= 8 && h <= 18;
      const isPeak = (h >= 10 && h <= 12) || (h >= 14 && h <= 16);
      const roomData = new Map();
      roomBases.forEach((base, rn) => {
        const seed = (rn.charCodeAt(0) + h) % 7; // deterministic per room+hour
        roomData.set(rn, {
          temp:      +(base.temp + (isPeak ? 3 : isWork ? 1.5 : -1) + (seed * 0.15 - 0.5)).toFixed(1),
          humidity:  +(base.humidity + (isWork ? -4 : 3) + (seed * 0.3 - 1)).toFixed(1),
          co2:       Math.round(base.co2 + (isPeak ? 350 : isWork ? 150 : 0) + seed * 12 - 40),
          occupancy: Math.max(0, Math.round(base.occupancy + (isPeak ? 3 : isWork ? 1 : 0) + (seed % 2))),
        });
      });
      return { label: `${String(h).padStart(2, "0")}:00`, hour: h, roomData };
    });

    animFramesRef.current = frames;
    setAnimReady(true);
  };

  // Apply colors only — no state reset (used by animation playback)
  const applyHeatmapColors = (metric) => {
    if (!metric) return;
    const propKey = metricPropertyKey(metric);
    roomEntitiesRef.current.forEach((entity) => {
      if (!entity.show) return;
      const value = entity.properties?.[propKey]?.getValue?.();
      if (value !== undefined && value !== null && entity.polygon) {
        entity.polygon.material     = metricToColor(metric, Number(value));
        entity.polygon.outlineColor = Cesium.Color.BLACK.withAlpha(0.5);
        entity.polygon.outlineWidth = 1;
      }
    });
  };

  // Stamp a frame's room values onto entity properties, then re-color
  const applyAnimFrame = (frameIdx) => {
    const frames = animFramesRef.current;
    if (!frames.length) return;
    const frame = frames[Math.max(0, Math.min(frameIdx, frames.length - 1))];

    // Update entity properties from this frame's room data
    roomEntitiesRef.current.forEach((e) => {
      const rn   = e.properties?.roomNumber?.getValue?.();
      const data = frame.roomData.get(rn);
      if (!data) return;
      // Cesium ConstantProperty — reassign via direct property write
      e.properties.temperature = data.temp;
      e.properties.humidity    = data.humidity;
      e.properties.co2         = data.co2;
      e.properties.occupancy   = data.occupancy;
    });

    if (activeHeatmapRef.current) {
      applyHeatmapColors(activeHeatmapRef.current);
      computeBuildingSummary(activeHeatmapRef.current);
    }
  };

  // Compute building-wide stats for the active heatmap metric
  const computeBuildingSummary = (metric) => {
    if (!metric) { setBuildingSummary(null); return; }
    const propKey = metricPropertyKey(metric);
    const UNITS   = { temperature: "°C", co2: " ppm", humidity: "%", occupancy: "" };
    const unit    = UNITS[metric] ?? "";

    const seen = new Set();
    const vals  = [];
    const byRoom = [];

    roomEntitiesRef.current.forEach((e) => {
      if (!e.show) return;
      const rn    = e.properties?.roomNumber?.getValue?.();
      if (seen.has(rn)) return; // one value per room, skip duplicate polygons
      seen.add(rn);
      const raw   = e.properties?.[propKey]?.getValue?.();
      if (raw === undefined || raw === null) return;
      const v = Number(raw);
      vals.push(v);
      byRoom.push({ rn, name: e.properties?.roomName?.getValue?.() ?? rn, v });
    });

    if (!vals.length) { setBuildingSummary(null); return; }

    const avg  = vals.reduce((a, b) => a + b, 0) / vals.length;
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const worst = byRoom.reduce((a, b) => b.v > a.v ? b : a);
    const best  = byRoom.reduce((a, b) => b.v < a.v ? b : a);

    // Alert count
    const THRESHOLDS = { temperature: 26, co2: 1000, humidity: null };
    let alertCount = 0;
    if (metric === "temperature") alertCount = vals.filter(v => v > 26).length;
    else if (metric === "co2")    alertCount = vals.filter(v => v > 1000).length;
    else if (metric === "humidity") alertCount = vals.filter(v => v < 30 || v > 65).length;

    setBuildingSummary({ min: minV, max: maxV, avg, alertCount, unit, worst, best, metric });
  };

  // ─── HIGHLIGHT BY QUERY ───────────────────────────────────────────────────────

  const highlightRoomsByQuery = (roomQueries, color = "cyan", labelOverride = null) => {
    if (!Array.isArray(roomQueries) || !roomQueries.length) return;

    const cssColor = Cesium.Color.fromCssColorString(color).withAlpha(0.92);
    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();

    const matched = [];

    roomQueries.forEach((query) => {
      const normalizedQuery   = normalizeSearchText(query);
      const normalizedRoomNum = extractNormalizedRoomNumber(query);

      const hits = roomEntitiesRef.current.filter((e) => {
        const entityNum = extractNormalizedRoomNumber(e.properties?.roomNumber?.getValue?.());
        if (normalizedRoomNum) return entityNum === normalizedRoomNum;
        const roomName = normalizeSearchText(e.properties?.roomName?.getValue?.());
        const roomNameOrig = normalizeSearchText(e.properties?.roomNameOriginal?.getValue?.());
        return roomName.includes(normalizedQuery) || roomNameOrig.includes(normalizedQuery);
      });

      hits.forEach((entity) => {
        entity.show = true;
        if (entity.polygon) {
          entity.polygon.material = cssColor;
          entity.polygon.outlineColor = cssColor;
          entity.polygon.outlineWidth = 3;
        }
        if (entity.labelEntity) {
          if (labelOverride) {
            entity.labelEntity.label.text = labelOverride;
          }
          entity.labelEntity.show = true;
        }
        matched.push(entity);
      });
    });

    // Hide everything that wasn't matched
    roomEntitiesRef.current.forEach((e) => {
      if (!matched.includes(e)) e.show = false;
    });

    if (matched.length) zoomToEntities(matched, 2.8, 15);
  };

  // ─── HIGHLIGHT BY THRESHOLD ───────────────────────────────────────────────────

  const highlightRoomsByThreshold = (metric, operator, threshold, color = "red") => {
    if (!metric || !operator || threshold === undefined) return;

    const propKey  = metricPropertyKey(metric);
    const cssColor = Cesium.Color.fromCssColorString(color).withAlpha(0.92);

    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();

    const matched = [];

    roomEntitiesRef.current.forEach((entity) => {
      entity.show = true; // show all rooms; color the matching ones
      const raw = entity.properties?.[propKey]?.getValue?.();
      if (raw === undefined || raw === null) return;

      const value = Number(raw);
      if (!isNaN(value) && evaluateOperator(value, operator, threshold)) {
        if (entity.polygon) {
          entity.polygon.material = cssColor;
          entity.polygon.outlineColor = cssColor;
          entity.polygon.outlineWidth = 3;
        }
        if (entity.labelEntity) entity.labelEntity.show = true;
        matched.push(entity);
      }
    });

    if (matched.length) zoomToEntities(matched, 2.8, 20);
  };

  // ─── ALERT OVERLAYS ───────────────────────────────────────────────────────────

  const showAlertOverlays = () => {
    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();

    const alertEntities = [];

    roomEntitiesRef.current.forEach((entity) => {
      entity.show = true;
      const temp     = Number(entity.properties?.temperature?.getValue?.() ?? 0);
      const co2      = Number(entity.properties?.co2?.getValue?.() ?? 0);
      const humidity = Number(entity.properties?.humidity?.getValue?.() ?? 50);

      let alertColor = null;
      let alertReason = "";

      if (co2 > ALERT_THRESHOLDS.co2.value) {
        alertColor  = Cesium.Color.fromCssColorString(ALERT_THRESHOLDS.co2.color).withAlpha(0.92);
        alertReason = `⚠ CO₂ ${co2} ppm`;
      } else if (temp > ALERT_THRESHOLDS.temperature.value) {
        alertColor  = Cesium.Color.fromCssColorString(ALERT_THRESHOLDS.temperature.color).withAlpha(0.92);
        alertReason = `🌡 Temp ${temp}°C`;
      } else if (humidity < ALERT_THRESHOLDS.humidity_lo.value) {
        alertColor  = Cesium.Color.fromCssColorString(ALERT_THRESHOLDS.humidity_lo.color).withAlpha(0.88);
        alertReason = `💧 Dry ${humidity}%`;
      } else if (humidity > ALERT_THRESHOLDS.humidity_hi.value) {
        alertColor  = Cesium.Color.fromCssColorString(ALERT_THRESHOLDS.humidity_hi.color).withAlpha(0.88);
        alertReason = `💧 Humid ${humidity}%`;
      }

      if (alertColor && entity.polygon) {
        entity.polygon.material   = alertColor;
        entity.polygon.outlineColor = alertColor;
        entity.polygon.outlineWidth = 4;
        if (entity.labelEntity) {
          entity.labelEntity.label.text =
            `${entity.properties.roomName?.getValue() ?? ""}\n${alertReason}`;
          entity.labelEntity.show = true;
        }
        alertEntities.push(entity);
      }
    });

    if (alertEntities.length) zoomToEntities(alertEntities, 2.8, 20);
  };

  // ─── LAYER TOGGLE ─────────────────────────────────────────────────────────────

  const toggleLayer = (layer, visible) => {
    const vis = Boolean(visible);

    switch (layer) {
      case "rooms":
        roomEntitiesRef.current.forEach((e) => { e.show = vis; });
        break;

      case "circuits":
        circuitEntitiesRef.current.forEach((e) => { e.show = vis; });
        break;

      case "sensors":
        sensorMarkerEntitiesRef.current.forEach((e) => { e.show = vis; });
        break;

      case "energy_flow":
        energyFlowEntitiesRef.current.forEach((e) => { e.show = vis; });
        break;

      case "labels":
        // Gather all label entities attached to rooms
        roomEntitiesRef.current.forEach((e) => {
          if (e.labelEntity) e.labelEntity.show = vis;
        });
        break;

      case "exterior":
        if (i3sProviderRef.current) i3sProviderRef.current.show = vis;
        break;

      case "alerts":
        if (vis) showAlertOverlays();
        else resetStylesAndLabels();
        break;

      default:
        break;
    }
  };

  // ─── VISUALIZATION MODES ──────────────────────────────────────────────────────

  const setVisualizationMode = (mode) => {
    setActiveMode(mode);
    switch (mode) {
      case "default":
        resetStylesAndLabels();
        showOnlyEntities(() => false);
        if (i3sProviderRef.current) i3sProviderRef.current.show = true;
        hideEnergyFlow();
        hideSensorMarkers();
        break;

      case "rooms":
        if (i3sProviderRef.current) i3sProviderRef.current.show = false;
        resetStylesAndLabels();
        roomEntitiesRef.current.forEach((e) => { e.show = true; });
        circuitEntitiesRef.current.forEach((e) => { e.show = false; });
        hideEnergyFlow();
        break;

      case "circuits":
        if (i3sProviderRef.current) i3sProviderRef.current.show = false;
        resetStylesAndLabels();
        showOnlyEntities(() => true);
        break;

      case "heatmap":
        showHeatmap(activeHeatmap || "temperature");
        break;

      case "energy":
        if (i3sProviderRef.current) i3sProviderRef.current.show = false;
        resetStylesAndLabels();
        roomEntitiesRef.current.forEach((e) => { e.show = true; });
        showEnergyFlow(null);
        break;

      case "sensors":
        if (i3sProviderRef.current) i3sProviderRef.current.show = false;
        resetStylesAndLabels();
        roomEntitiesRef.current.forEach((e) => { e.show = true; });
        showSensorMarkers("all");
        break;

      case "alerts":
        showAlertOverlays();
        break;

      default:
        break;
    }
  };

  // ─── ENERGY FLOW ──────────────────────────────────────────────────────────────

  // Approximate positions for circuit network nodes
  const circuitNodePositions = {
    main:            [23.330494, 42.673775, 607],
    circuit6boiler:  [23.3303,   42.6736,   607],
    circuit7:        [23.3306,   42.6739,   607],
    elevator:        [23.3305,   42.6738,   607],
    circuit8:        [23.3307,   42.6737,   607],
    circuit9:        [23.3304,   42.6739,   607],
    circuit10:       [23.3303,   42.6738,   607],
    circuit11:       [23.3306,   42.6736,   607],
    circuit12:       [23.3308,   42.6738,   607],
    airconditioner1: [23.3307,   42.6740,   607],
    airconditioner2: [23.3307,   42.6736,   607],
  };

  const showEnergyFlow = (circuitId) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    hideEnergyFlow();

    const mainPos = circuitNodePositions.main;
    const mainCart = Cesium.Cartesian3.fromDegrees(...mainPos);

    const targets = circuitId
      ? [normalizeCircuitId(circuitId)]
      : Object.keys(circuitNodePositions).filter((k) => k !== "main");

    targets.forEach((id) => {
      const nodePos = circuitNodePositions[id];
      if (!nodePos) return;

      const config = circuitConfigs[id];
      const lineColor = Cesium.Color.fromCssColorString(config?.color || "#22C55E");

      const line = viewer.entities.add({
        polyline: {
          positions: [mainCart, Cesium.Cartesian3.fromDegrees(...nodePos)],
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: lineColor,
          }),
          clampToGround: false,
        },
      });
      energyFlowEntitiesRef.current.push(line);

      // Small sphere at the circuit node
      const node = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(...nodePos),
        ellipsoid: {
          radii: new Cesium.Cartesian3(1.5, 1.5, 1.5),
          material: lineColor.withAlpha(0.85),
        },
        label: {
          text: config?.label || id,
          font: "bold 12px Arial",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.65),
          backgroundPadding: new Cesium.Cartesian2(6, 4),
        },
      });
      energyFlowEntitiesRef.current.push(node);
    });

    // Show the main hub
    const hub = viewer.entities.add({
      position: mainCart,
      ellipsoid: {
        radii: new Cesium.Cartesian3(2.5, 2.5, 2.5),
        material: Cesium.Color.fromCssColorString(circuitConfigs.main.color).withAlpha(0.9),
      },
      label: {
        text: "Main",
        font: "bold 13px Arial",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.65),
        backgroundPadding: new Cesium.Cartesian2(6, 4),
      },
    });
    energyFlowEntitiesRef.current.push(hub);
  };

  const hideEnergyFlow = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    energyFlowEntitiesRef.current.forEach((e) => {
      try { viewer.entities.remove(e); } catch (_) {}
    });
    energyFlowEntitiesRef.current = [];
  };

  // ─── COMPARE FLOORS ───────────────────────────────────────────────────────────

  const compareFloors = (floorA, floorB, metric = "temperature") => {
    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();

    const propKey = metricPropertyKey(metric);

    roomEntitiesRef.current.forEach((entity) => {
      const floor = Number(entity.properties?.floorLevel?.getValue?.());
      if (floor !== floorA && floor !== floorB) {
        entity.show = false;
        return;
      }
      entity.show = true;
      const raw = entity.properties?.[propKey]?.getValue?.();
      if (raw !== undefined && raw !== null && entity.polygon) {
        entity.polygon.material = metricToColor(metric, Number(raw));
        entity.polygon.outlineColor = Cesium.Color.BLACK.withAlpha(0.4);
        entity.polygon.outlineWidth = 1;
      }
    });

    const matches = roomEntitiesRef.current.filter((e) => {
      const f = Number(e.properties?.floorLevel?.getValue?.());
      return f === floorA || f === floorB;
    });
    if (matches.length) zoomToEntities(matches, 2.8, 30);
  };

  // ─── COMPARE ROOMS ────────────────────────────────────────────────────────────

  const compareRoomsByMetric = (roomQueries, metric = "co2") => {
    if (!Array.isArray(roomQueries) || !roomQueries.length) return;

    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();

    const propKey = metricPropertyKey(metric);

    // Collect all candidate entities
    const candidates = [];
    roomQueries.forEach((query) => {
      const normalizedQuery   = normalizeSearchText(query);
      const normalizedRoomNum = extractNormalizedRoomNumber(query);
      roomEntitiesRef.current.forEach((e) => {
        const entityNum = extractNormalizedRoomNumber(e.properties?.roomNumber?.getValue?.());
        const roomName  = normalizeSearchText(e.properties?.roomName?.getValue?.());
        const matched   = normalizedRoomNum
          ? entityNum === normalizedRoomNum
          : roomName.includes(normalizedQuery);
        if (matched) candidates.push(e);
      });
    });

    if (!candidates.length) return;

    // Find min/max for relative scaling
    const values = candidates
      .map((e) => Number(e.properties?.[propKey]?.getValue?.() ?? NaN))
      .filter((v) => !isNaN(v));
    const min = Math.min(...values);
    const max = Math.max(...values);

    roomEntitiesRef.current.forEach((e) => { e.show = false; });

    candidates.forEach((entity) => {
      entity.show = true;
      const raw = entity.properties?.[propKey]?.getValue?.();
      if (raw === undefined || raw === null || !entity.polygon) return;
      const val = Number(raw);
      const t   = max > min ? (val - min) / (max - min) : 0.5;
      entity.polygon.material = metricToColor(metric, val);
      entity.polygon.outlineColor = Cesium.Color.WHITE.withAlpha(0.6);
      entity.polygon.outlineWidth = 2;
      if (entity.labelEntity) {
        const name = entity.properties.roomName?.getValue() ?? "";
        entity.labelEntity.label.text = `${name}\n${metric}: ${val}`;
        entity.labelEntity.show = true;
      }
    });

    zoomToEntities(candidates, 3, 20);
  };

  // ─── SENSOR MARKERS ───────────────────────────────────────────────────────────

  const SENSOR_ICONS = {
    temperature: "🌡",
    co2:         "💨",
    humidity:    "💧",
    motion:      "👤",
  };

  const showSensorMarkers = (sensorType = "all") => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    hideSensorMarkers();

    // Group room entities by roomNumber to find centers
    const groupedByRoom = new Map();
    roomEntitiesRef.current.forEach((entity) => {
      if (!entity.show && entity.show !== undefined) return;
      const roomNumber = entity.properties?.roomNumber?.getValue?.();
      if (!roomNumber) return;
      if (!groupedByRoom.has(roomNumber)) groupedByRoom.set(roomNumber, []);
      groupedByRoom.get(roomNumber).push(entity);
    });

    const typesToShow = sensorType === "all"
      ? ["temperature", "co2", "humidity"]
      : [sensorType];

    groupedByRoom.forEach((entities, roomNumber) => {
      const sphere = getBoundingSphereFromEntities(entities);
      if (!sphere) return;

      const cartographic = Cesium.Cartographic.fromCartesian(sphere.center);
      const first        = entities[0];
      const elevation    = (first.polygon?.extrudedHeight?.getValue?.() ?? 0) - 3.5 + 2.5;

      const temp     = Number(first.properties?.temperature?.getValue?.() ?? 22);
      const co2      = Number(first.properties?.co2?.getValue?.()          ?? 400);
      const humidity = Number(first.properties?.humidity?.getValue?.()     ?? 45);

      const values = { temperature: temp, co2, humidity };

      typesToShow.forEach((type, idx) => {
        const icon  = SENSOR_ICONS[type] || "●";
        const value = values[type];
        const offsetX = (idx - 1) * 14; // space icons horizontally

        const marker = viewer.entities.add({
          position: Cesium.Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            elevation
          ),
          label: {
            text: `${icon} ${value}`,
            font: "12px Arial",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(offsetX, -8),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.6),
            backgroundPadding: new Cesium.Cartesian2(4, 3),
          },
        });
        sensorMarkerEntitiesRef.current.push(marker);
      });
    });
  };

  const hideSensorMarkers = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    sensorMarkerEntitiesRef.current.forEach((e) => {
      try { viewer.entities.remove(e); } catch (_) {}
    });
    sensorMarkerEntitiesRef.current = [];
  };

  // ─── CAMERA PRESETS ───────────────────────────────────────────────────────────

  const flyToCameraPreset = (preset) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const pos = cameraPresets[preset];
    if (!pos) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.height),
      orientation: {
        heading: Cesium.Math.toRadians(pos.heading),
        pitch:   Cesium.Math.toRadians(pos.pitch),
        roll:    0,
      },
      duration: 1.5,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  };

  // ─── TIME WINDOW ──────────────────────────────────────────────────────────────

  const setTimeWindow = (startIso, endIso = null) => {
    timeWindowRef.current = {
      start: startIso ? new Date(startIso) : null,
      end:   endIso   ? new Date(endIso)   : new Date(),
    };
    // Re-apply current heatmap if one is active, so it can later use time-filtered data
    if (activeHeatmap) showHeatmap(activeHeatmap);
  };

  const resetTimeWindow = () => {
    timeWindowRef.current = { start: null, end: null };
    if (activeHeatmap) showHeatmap(activeHeatmap);
  };

  // ─── NAVIGATION ───────────────────────────────────────────────────────────────

  const zoomToRoom = (roomQuery) => {
    setSelectedCircuit("");

    const query = String(roomQuery ?? "").trim();
    if (!query) return;

    const normalizedQuery   = normalizeSearchText(query);
    const normalizedRoomNum = extractNormalizedRoomNumber(query);

    const roomNumberMatches = roomEntitiesRef.current.filter((e) => {
      const entityNum = extractNormalizedRoomNumber(e.properties?.roomNumber?.getValue?.());
      if (normalizedRoomNum) return entityNum === normalizedRoomNum;
      return normalizeSearchText(e.properties?.roomNumber?.getValue?.()) === normalizedQuery;
    });

    const roomNameMatches = roomEntitiesRef.current.filter((e) => {
      const roomName     = normalizeSearchText(e.properties?.roomName?.getValue?.());
      const roomNameOrig = normalizeSearchText(e.properties?.roomNameOriginal?.getValue?.());
      return (
        roomName === normalizedQuery || roomNameOrig === normalizedQuery ||
        roomName.includes(normalizedQuery) || roomNameOrig.includes(normalizedQuery)
      );
    });

    const matches = roomNumberMatches.length ? roomNumberMatches : roomNameMatches;
    if (!matches.length) return;

    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();
    showOnlyEntities((e) => matches.includes(e));

    matches.forEach((entity) => {
      if (entity.polygon) entity.polygon.material = Cesium.Color.CYAN.withAlpha(0.9);
      if (entity.labelEntity) entity.labelEntity.show = true;
    });

    zoomToEntities(matches, matches.length > 1 ? 2.8 : 4, 15);

    const clickedEntity = matches[0];
    if (onFeatureClick && clickedEntity) {
      onFeatureClick({
        roomNumber:      clickedEntity.properties.roomNumber?.getValue(),
        roomName:        clickedEntity.properties.roomName?.getValue(),
        roomNameOriginal:clickedEntity.properties.roomNameOriginal?.getValue(),
        floor:           clickedEntity.properties.floorLevel?.getValue(),
        area:            clickedEntity.properties.area?.getValue(),
        temperature:     clickedEntity.properties.temperature?.getValue(),
        humidity:        clickedEntity.properties.humidity?.getValue(),
        co2:             clickedEntity.properties.co2?.getValue(),
        occupancy:       clickedEntity.properties.occupancy?.getValue(),
        circuitIds:      clickedEntity.properties.circuit_id?.getValue?.() || [],
      });
    }
  };

  const zoomToFloor = (floor) => {
    setSelectedCircuit("");

    const resolveFloorLevel = (raw) => {
      const available = availableFloorsRef.current.map(Number).filter(Number.isFinite);
      if (!available.length) return null;
      const str = String(raw ?? "").trim();
      const num = Number(str);
      if (Number.isFinite(num) && available.includes(num))     return num;
      if (Number.isFinite(num) && available.includes(num + 1)) return num + 1;
      if (Number.isFinite(num) && available.includes(num - 1)) return num - 1;
      const upper = str.toUpperCase();
      if (upper === "ROOF") return Math.max(...available);
      const lm = upper.match(/^[LB](\d{1,2})$/);
      if (lm) { const n = Number(lm[1]); if (Number.isFinite(n) && available.includes(n)) return n; }
      return null;
    };

    const targetFloor = resolveFloorLevel(floor);
    if (!Number.isFinite(targetFloor)) return;

    const matches = roomEntitiesRef.current.filter(
      (e) => Number(e.properties?.floorLevel?.getValue?.()) === targetFloor
    );
    if (!matches.length) return;

    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();
    showOnlyEntities((e) => Number(e.properties?.floorLevel?.getValue?.()) === targetFloor);
    zoomToEntities(matches, 2.6, 30);
  };

  const zoomToBuilding = () => {
    setSelectedCircuit("");
    const viewer   = viewerRef.current;
    const provider = i3sProviderRef.current;
    if (!viewer || !provider?.extent) return;

    resetStylesAndLabels();
    provider.show = true;
    hideEnergyFlow();
    hideSensorMarkers();

    [...roomEntitiesRef.current, ...circuitEntitiesRef.current].forEach((entity) => {
      entity.show = false;
      if (entity.labelEntity) entity.labelEntity.show = false;
    });

    const center = Cesium.Rectangle.center(provider.extent);
    center.height = 240;
    const destination = Cesium.Ellipsoid.WGS84.cartographicToCartesian(center);
    homeDestinationRef.current = destination;
    viewer.camera.flyTo({ destination, duration: 1.5 });
  };

  const flyToCoordinates = (lat, lon, height = 500) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setSelectedCircuit("");
    resetStylesAndLabels();
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: 1.5,
    });
  };

  const zoomToCircuit = (circuitId) => {
    const normalizedCircuitId = normalizeCircuitId(circuitId);
    const viewer = viewerRef.current;
    if (!viewer || !normalizedCircuitId) return false;

    setSelectedCircuit(normalizedCircuitId);
    const config       = circuitConfigs[normalizedCircuitId];
    const circuitColor = Cesium.Color.fromCssColorString(config?.color || "#22C55E");

    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();

    const allEntities = [...roomEntitiesRef.current, ...circuitEntitiesRef.current];
    const matches = allEntities.filter((entity) => {
      const v = entity.properties?.circuit_id?.getValue?.();
      if (Array.isArray(v)) return v.map(normalizeCircuitId).includes(normalizedCircuitId);
      return normalizeCircuitId(v) === normalizedCircuitId;
    });

    if (!matches.length) return false;

    allEntities.forEach((entity) => {
      entity.show = false;
      if (entity.labelEntity) entity.labelEntity.show = false;
    });

    matches.forEach((entity) => {
      entity.show = true;
      if (entity.polygon) {
        entity.polygon.material     = circuitColor.withAlpha(0.92);
        entity.polygon.outlineColor = circuitColor;
        entity.polygon.outlineWidth = 4;
      }
      if (entity.cylinder)  entity.cylinder.material  = circuitColor.withAlpha(0.95);
      if (entity.ellipsoid) entity.ellipsoid.material = circuitColor.withAlpha(0.8);
      if (entity.labelEntity) entity.labelEntity.show = false;
    });

    const preset = circuitCameraPositions[normalizedCircuitId];
    if (preset) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(preset.lon, preset.lat, preset.height),
        orientation: {
          heading: Cesium.Math.toRadians(preset.heading),
          pitch:   Cesium.Math.toRadians(preset.pitch),
          roll:    0,
        },
        duration: 1.5,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    } else {
      zoomToEntities(matches, 2.5, 25);
    }
    return true;
  };

  const zoomToName = (rawQuery) => {
    const terms = getSearchTerms(rawQuery);
    if (!terms.length) return false;

    const compactTerms = terms.map((term) => compactSearchText(term));

    setSelectedCircuit("");
    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();

    const allEntities = [...roomEntitiesRef.current, ...circuitEntitiesRef.current];
    const matches = allEntities.filter((entity) => {
      const roomName     = normalizeSearchText(entity.properties?.roomName?.getValue?.());
      const roomNameOrig = normalizeSearchText(entity.properties?.roomNameOriginal?.getValue?.());
      const roomNumber   = normalizeSearchText(entity.properties?.roomNumber?.getValue?.());
      const entityName   = normalizeSearchText(entity.name);
      const typeName     = normalizeSearchText(entity.properties?.type?.getValue?.());

      const circuits = entity.properties?.circuit_id?.getValue?.();
      const circuitKeys = Array.isArray(circuits) ? circuits : [circuits];
      const circuitLabels = circuitKeys
        .map((id) => normalizeSearchText(circuitConfigs[normalizeCircuitId(id)]?.label || id))
        .filter(Boolean);

      const haystackFields = [roomName, roomNameOrig, roomNumber, entityName, typeName, ...circuitLabels].filter(Boolean);
      const haystack        = haystackFields.join(" ");
      const compactHaystack = haystackFields.map(compactSearchText).join(" ");

      return (
        terms.some((t) => haystack.includes(t)) ||
        compactTerms.some((t) => compactHaystack.includes(t))
      );
    });

    if (!matches.length) return false;

    showOnlyEntities((entity) => matches.includes(entity));

    matches.forEach((entity) => {
      if (entity.polygon)   entity.polygon.material   = Cesium.Color.CYAN.withAlpha(0.9);
      if (entity.box)       entity.box.material       = Cesium.Color.CYAN.withAlpha(0.85);
      if (entity.cylinder)  entity.cylinder.material  = Cesium.Color.CYAN.withAlpha(0.85);
      if (entity.ellipsoid) entity.ellipsoid.material = Cesium.Color.CYAN.withAlpha(0.75);
      if (entity.labelEntity) entity.labelEntity.show = true;
    });

    zoomToEntities(matches, matches.length > 1 ? 2.8 : 4, 20);
    return true;
  };

  // ─── CLICK HANDLER ────────────────────────────────────────────────────────────

  const handleEntityClick = (entity) => {
    if (!entity) return;
    const circuitValue = entity.properties?.circuit_id?.getValue?.();
    const roomNumber   = entity.properties?.roomNumber?.getValue?.();
    if (roomNumber) { zoomToRoom(roomNumber); return; }
    if (typeof circuitValue === "string") zoomToCircuit(circuitValue);
  };

  // ─── INIT EFFECT ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    let destroyed = false;

    const init = async () => {
      try {
        window.__cesiumViewerReady = false;

        Cesium.Ion.defaultAccessToken =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlNDgxNjNjYS1kMTY1LTRhOTQtODFiZC1mYWMyNzY4OWVjN2YiLCJpZCI6MzQzOTQwLCJpYXQiOjE3NTg2MzQ0MTR9.pQiAchoUyxCsz38HgMWMnBs4ua7xTKPcbTE2s5EnbK4";

        const terrain = new Cesium.Terrain(
          Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
            "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"
          )
        );

        const viewer = new Cesium.Viewer(containerRef.current, {
          terrain,
          animation: false, timeline: false, baseLayerPicker: false,
          geocoder: false, sceneModePicker: false, infoBox: false,
          selectionIndicator: false, shadows: false, homeButton: true,
        });

        viewerRef.current = viewer;
        viewer.shadows = false;
        viewer.terrainShadows = Cesium.ShadowMode.DISABLED;
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.highDynamicRange = true;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0001;
        viewer.scene.fog.minimumBrightness = 0.8;
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;

        const i3sProvider = await Cesium.I3SDataProvider.fromUrl(
          "https://tiles-eu1.arcgis.com/XYGfXK4rEYwaj5A0/arcgis/rest/services/Gate_export_20241104_r23_reduced_20241114_notex/SceneServer",
          { adjustMaterialAlphaMode: true, showFeatures: true, applySymbology: true, calculateNormals: true }
        );

        if (destroyed) return;

        viewer.scene.primitives.add(i3sProvider);
        i3sProviderRef.current = i3sProvider;

        const response = await fetch("/floorplans/Floorplan_polygon_4326.geojson");
        const geojson  = await response.json();

        if (destroyed) return;

        const createdRoomEntities    = [];
        const createdCircuitEntities = [];
        const floorsSet = new Set();
        const roomList  = [];

        geojson.features.forEach((feature, idx) => {
          const props             = feature.properties || {};
          const floorLevel        = Number(props.BldgLevel ?? 0);
          const roomNumber        = props.RoomNumber || `Room-${idx}`;
          const roomNameBulgarian = props.RoomName || "";
          const roomName          = translateRoomName(roomNameBulgarian);
          const department        = props.Department || "";
          const baseElevation     = Number(props.BldgLevel_Elev ?? 0);
          const area              = props.SourceArea;

          floorsSet.add(floorLevel);

          if (!roomList.find((r) => r.roomNumber === roomNumber))
            roomList.push({ roomNumber, roomName, floorLevel });

          const roomData       = getRoomData(roomName);
          const roomCircuitIds = getRoomCircuitId(roomNumber, roomName, floorLevel);
          const polygons       = geometryToPolygons(feature.geometry, baseElevation);

          polygons.forEach((positions, polyIndex) => {
            const entity = viewer.entities.add({
              id:   `${roomNumber}-${polyIndex}`,
              name: roomNumber,
              polygon: {
                hierarchy:      new Cesium.PolygonHierarchy(positions),
                material:       getRoomColor(roomName),
                extrudedHeight: baseElevation + 3.5,
                perPositionHeight: true,
                outline:        true,
                outlineColor:   Cesium.Color.BLACK.withAlpha(0.85),
                outlineWidth:   2,
                shadows:        Cesium.ShadowMode.DISABLED,
              },
              properties: {
                roomNumber, roomName, roomNameOriginal: roomNameBulgarian,
                floorLevel, department, area,
                temperature: roomData.temp,
                humidity:    roomData.humidity,
                co2:         roomData.co2,
                occupancy:   roomData.occupancy,
                circuit_id:  roomCircuitIds,
              },
              show: false,
            });
            entity.originalMaterial = entity.polygon.material;
            createdRoomEntities.push(entity);
          });
        });

        // Label entities grouped by room
        const groupedByRoom = new Map();
        createdRoomEntities.forEach((entity) => {
          const rn = entity.properties.roomNumber.getValue();
          if (!groupedByRoom.has(rn)) groupedByRoom.set(rn, []);
          groupedByRoom.get(rn).push(entity);
        });

        groupedByRoom.forEach((entities) => {
          const sphere = getBoundingSphereFromEntities(entities);
          if (!sphere) return;

          const first        = entities[0];
          const cartographic = Cesium.Cartographic.fromCartesian(sphere.center);
          const baseElev     = first.polygon.extrudedHeight.getValue() - 3.5;
          const roomCircuits = first.properties.circuit_id.getValue();

          const labelEntity = viewer.entities.add({
            position: Cesium.Cartesian3.fromRadians(
              cartographic.longitude, cartographic.latitude, baseElev + 4.1
            ),
            label: {
              text: `${first.properties.roomName.getValue()}\n${first.properties.roomNumber.getValue()}\nCircuits: ${Array.isArray(roomCircuits) ? roomCircuits.join(", ") : roomCircuits}`,
              font:            "bold 14px Arial",
              fillColor:       Cesium.Color.WHITE,
              outlineColor:    Cesium.Color.BLACK,
              outlineWidth:    3,
              style:           Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin:  Cesium.VerticalOrigin.BOTTOM,
              pixelOffset:     new Cesium.Cartesian2(0, -12),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              showBackground:  true,
              backgroundColor: Cesium.Color.BLACK.withAlpha(0.72),
              backgroundPadding: new Cesium.Cartesian2(8, 6),
            },
            show: false,
          });
          entities.forEach((e) => { e.labelEntity = labelEntity; });
        });

        // ── External circuit entities (chargers, lights, LED) ─────────────────

        const addCircuitEntity = (entity, materialKey = "cylinder") => {
          if (entity[materialKey]?.material)
            entity.originalMaterial = entity[materialKey].material;
          createdCircuitEntities.push(entity);
        };

        const chargerBase1 = viewer.entities.add({
          id: "charger1-base",
          position: Cesium.Cartesian3.fromDegrees(23.33035, 42.67395, 605),
          cylinder: { length: 1.5, topRadius: 0.3, bottomRadius: 0.3,
            material: Cesium.Color.fromCssColorString("#AED6F1"),
            outline: true, outlineColor: Cesium.Color.BLACK },
          properties: { circuit_id: "vehiclecharging1", type: "EV Charger" },
          show: false,
        });
        addCircuitEntity(chargerBase1, "cylinder");

        const chargerScreen1 = viewer.entities.add({
          id: "charger1-screen",
          position: Cesium.Cartesian3.fromDegrees(23.33035, 42.67395, 606.2),
          box: { dimensions: new Cesium.Cartesian3(0.4, 0.05, 0.6),
            material: Cesium.Color.fromCssColorString("#2C3E50"),
            outline: true, outlineColor: Cesium.Color.CYAN },
          properties: { circuit_id: "vehiclecharging1", type: "EV Charger" },
          show: false,
        });
        addCircuitEntity(chargerScreen1, "box");

        const chargerBase2 = viewer.entities.add({
          id: "charger2-base",
          position: Cesium.Cartesian3.fromDegrees(23.33075, 42.67365, 605),
          cylinder: { length: 1.5, topRadius: 0.3, bottomRadius: 0.3,
            material: Cesium.Color.fromCssColorString("#85C1E2"),
            outline: true, outlineColor: Cesium.Color.BLACK },
          properties: { circuit_id: "vehiclecharging2", type: "EV Charger" },
          show: false,
        });
        addCircuitEntity(chargerBase2, "cylinder");

        const chargerScreen2 = viewer.entities.add({
          id: "charger2-screen",
          position: Cesium.Cartesian3.fromDegrees(23.33075, 42.67365, 606.2),
          box: { dimensions: new Cesium.Cartesian3(0.4, 0.05, 0.6),
            material: Cesium.Color.fromCssColorString("#2C3E50"),
            outline: true, outlineColor: Cesium.Color.CYAN },
          properties: { circuit_id: "vehiclecharging2", type: "EV Charger" },
          show: false,
        });
        addCircuitEntity(chargerScreen2, "box");

        const light1Positions = [
          [23.3303, 42.67392], [23.33045, 42.67392],
          [23.3306, 42.67392], [23.33075, 42.67392],
        ];
        light1Positions.forEach((pos, i) => {
          const pole = viewer.entities.add({
            id: `north-light-pole-${i + 1}`,
            position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], 605),
            cylinder: { length: 5, topRadius: 0.08, bottomRadius: 0.12,
              material: Cesium.Color.DARKGRAY, outline: true, outlineColor: Cesium.Color.BLACK },
            properties: { circuit_id: "outsidelighting1", type: "Light Pole" },
            show: false,
          });
          addCircuitEntity(pole, "cylinder");

          const head = viewer.entities.add({
            id: `north-light-head-${i + 1}`,
            position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], 607.5),
            ellipsoid: { radii: new Cesium.Cartesian3(0.25, 0.25, 0.15),
              material: Cesium.Color.fromCssColorString("#F9E79F").withAlpha(0.95),
              outline: true, outlineColor: Cesium.Color.BLACK },
            properties: { circuit_id: "outsidelighting1", type: "Light Pole" },
            show: false,
          });
          addCircuitEntity(head, "ellipsoid");
        });

        const light2Positions = [
          [23.3303, 42.67365], [23.33045, 42.67365],
          [23.3306, 42.67365], [23.33075, 42.67365],
        ];
        light2Positions.forEach((pos, i) => {
          const pole = viewer.entities.add({
            id: `south-light-pole-${i + 1}`,
            position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], 605),
            cylinder: { length: 5, topRadius: 0.08, bottomRadius: 0.12,
              material: Cesium.Color.DARKGRAY, outline: true, outlineColor: Cesium.Color.BLACK },
            properties: { circuit_id: "outsidelighting2", type: "Light Pole" },
            show: false,
          });
          addCircuitEntity(pole, "cylinder");

          const head = viewer.entities.add({
            id: `south-light-head-${i + 1}`,
            position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], 607.5),
            ellipsoid: { radii: new Cesium.Cartesian3(0.25, 0.25, 0.15),
              material: Cesium.Color.fromCssColorString("#FAD7A0").withAlpha(0.95),
              outline: true, outlineColor: Cesium.Color.BLACK },
            properties: { circuit_id: "outsidelighting2", type: "Light Pole" },
            show: false,
          });
          addCircuitEntity(head, "ellipsoid");
        });

        const ledFrame = viewer.entities.add({
          id: "led-frame",
          position: Cesium.Cartesian3.fromDegrees(23.330534, 42.67387, 608),
          box: { dimensions: new Cesium.Cartesian3(4.0, 0.4, 2.5),
            material: Cesium.Color.fromCssColorString("#2C3E50"),
            outline: true, outlineColor: Cesium.Color.BLACK },
          properties: { circuit_id: "3DLED", type: "LED Display" },
          show: false,
        });
        addCircuitEntity(ledFrame, "box");

        const ledScreen = viewer.entities.add({
          id: "led-screen",
          position: Cesium.Cartesian3.fromDegrees(23.330534, 42.67387, 608),
          box: { dimensions: new Cesium.Cartesian3(3.6, 0.2, 2.2),
            material: Cesium.Color.fromCssColorString("#FF6B6B").withAlpha(0.9),
            outline: true, outlineColor: Cesium.Color.RED },
          properties: { circuit_id: "3DLED", type: "LED Display" },
          show: false,
        });
        addCircuitEntity(ledScreen, "box");

        roomEntitiesRef.current    = createdRoomEntities;
        circuitEntitiesRef.current = createdCircuitEntities;

        const sortedFloors = Array.from(floorsSet).sort((a, b) => a - b);
        availableFloorsRef.current = sortedFloors;
        setAvailableFloors(sortedFloors);
        setAvailableRooms(
          roomList.sort((a, b) => {
            if (a.floorLevel !== b.floorLevel) return a.floorLevel - b.floorLevel;
            return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, {
              numeric: true, sensitivity: "base",
            });
          })
        );

        const center = Cesium.Rectangle.center(i3sProvider.extent);
        center.height = 240;
        const destination = Cesium.Ellipsoid.WGS84.cartographicToCartesian(center);
        homeDestinationRef.current = destination;
        viewer.camera.setView({ destination });

        viewer.homeButton.viewModel.command.beforeExecute.addEventListener((e) => {
          e.cancel = true;
          zoomToBuilding();
        });

        viewer.screenSpaceEventHandler.setInputAction((click) => {
          const picked = viewer.scene.pick(click.position);
          if (!Cesium.defined(picked) || !picked.id) return;
          handleEntityClick(picked.id);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // ── Generate animation frames from initial room data ──────────────────
        generateAnimFrames(createdRoomEntities);

        // ── Hover handler for per-room tooltip ───────────────────────────────
        const hoverHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        hoverHandlerRef.current = hoverHandler;

        hoverHandler.setInputAction((movement) => {
          const metric = activeHeatmapRef.current;
          if (!metric) { setHoveredRoom(null); return; }

          const picked = viewer.scene.pick(movement.endPosition);
          if (!Cesium.defined(picked) || !picked.id) {
            setHoveredRoom(null);
            return;
          }
          const entity = picked.id;
          const rn   = entity.properties?.roomNumber?.getValue?.();
          if (!rn) { setHoveredRoom(null); return; }

          const propKey = metricPropertyKey(metric);
          const raw     = entity.properties?.[propKey]?.getValue?.();
          const UNITS   = { temperature: "°C", co2: " ppm", humidity: "%", occupancy: "" };
          const name    = entity.properties?.roomName?.getValue?.() ?? rn;
          const floor   = entity.properties?.floorLevel?.getValue?.() ?? "";

          setHoveredRoom({
            x: movement.endPosition.x + 14,
            y: movement.endPosition.y - 14,
            name,
            rn,
            floor,
            value: raw !== undefined && raw !== null ? Number(raw) : null,
            unit: UNITS[metric] ?? "",
            metric,
          });
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        setLoading(false);
        window.__cesiumViewerReady = true;

        const pending = Array.isArray(window.__pendingCesiumCommands)
          ? window.__pendingCesiumCommands : [];
        if (pending.length) {
          pending.forEach((cmd) =>
            window.dispatchEvent(new CustomEvent("cesium-command", { detail: cmd }))
          );
          window.__pendingCesiumCommands = [];
        }
      } catch (e) {
        console.error("Viewer initialization failed:", e);
        setLoading(false);
        window.__cesiumViewerReady = false;
      }
    };

    init();

    return () => {
      destroyed = true;
      window.__cesiumViewerReady = false;
      if (hoverHandlerRef.current && !hoverHandlerRef.current.isDestroyed())
        hoverHandlerRef.current.destroy();
      hoverHandlerRef.current = null;
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      animIntervalRef.current = null;
      if (viewerRef.current && !viewerRef.current.isDestroyed())
        viewerRef.current.destroy();
      viewerRef.current    = null;
      i3sProviderRef.current = null;
      roomEntitiesRef.current    = [];
      circuitEntitiesRef.current = [];
      energyFlowEntitiesRef.current  = [];
      sensorMarkerEntitiesRef.current = [];
    };
  }, []);

  // ─── COMMAND LISTENER ─────────────────────────────────────────────────────────

  useEffect(() => {
    const handleCesiumCommand = (cmd) => {
      const viewer = viewerRef.current;
      if (!viewer || cmd?.type !== "cesium") return;

      switch (cmd.action) {
        // ── existing navigation ──────────────────────────────────────────────
        case "fly_to_coordinates":
          flyToCoordinates(cmd.lat, cmd.lon, cmd.height ?? 500);
          break;
        case "zoom_to_room":
          zoomToRoom(cmd.room_query || cmd.room_number || cmd.room_name || cmd.room || cmd.name);
          break;
        case "zoom_to_floor":
          zoomToFloor(cmd.floor);
          break;
        case "zoom_to_building":
        case "reset_view":
          zoomToBuilding();
          break;
        case "zoom_to_circuit":
          if (!zoomToCircuit(cmd.circuit_id || cmd.circuit))
            zoomToName(cmd.circuit_id || cmd.circuit || "");
          break;
        case "zoom_to_name":
          zoomToName(cmd.name || cmd.query || "");
          break;
        case "zoom_to_entity":
          zoomToName(cmd.entity_id || "");
          break;
        case "show_building":
          if (i3sProviderRef.current) i3sProviderRef.current.show = true;
          break;
        case "hide_building":
          if (i3sProviderRef.current) i3sProviderRef.current.show = false;
          break;
        case "show_all_rooms":
          roomEntitiesRef.current.forEach((e) => { e.show = true; });
          break;
        case "hide_all_rooms":
          roomEntitiesRef.current.forEach((e) => { e.show = false; });
          break;

        // ── heatmap ──────────────────────────────────────────────────────────
        case "show_heatmap":
          showHeatmap(cmd.metric);
          break;
        case "clear_heatmap":
        case "clear_highlights":
          resetStylesAndLabels();
          showOnlyEntities(() => false);
          if (i3sProviderRef.current) i3sProviderRef.current.show = true;
          break;

        // ── highlight ────────────────────────────────────────────────────────
        case "highlight_rooms":
          highlightRoomsByQuery(cmd.room_queries, cmd.color, cmd.label_override);
          break;
        case "highlight_rooms_by_threshold":
          highlightRoomsByThreshold(cmd.metric, cmd.operator, cmd.threshold, cmd.color);
          break;
        case "highlight_entities":
          highlightRoomsByQuery(cmd.entity_ids, cmd.color);
          break;

        // ── alerts ───────────────────────────────────────────────────────────
        case "show_alerts":
          showAlertOverlays();
          break;

        // ── layers ───────────────────────────────────────────────────────────
        case "toggle_layer":
          toggleLayer(cmd.layer, cmd.visible);
          break;

        // ── visualization mode ────────────────────────────────────────────────
        case "set_visualization_mode":
          setVisualizationMode(cmd.mode);
          break;

        // ── energy flow ──────────────────────────────────────────────────────
        case "show_energy_flow":
          showEnergyFlow(cmd.circuit_id ?? null);
          break;
        case "hide_energy_flow":
          hideEnergyFlow();
          break;

        // ── comparison ───────────────────────────────────────────────────────
        case "compare_floors":
          compareFloors(cmd.floor_a, cmd.floor_b, cmd.metric);
          break;
        case "compare_rooms":
          compareRoomsByMetric(cmd.room_queries, cmd.metric);
          break;

        // ── sensors ──────────────────────────────────────────────────────────
        case "show_sensor_markers":
          showSensorMarkers(cmd.sensor_type ?? "all");
          break;
        case "hide_sensor_markers":
          hideSensorMarkers();
          break;

        // ── camera ───────────────────────────────────────────────────────────
        case "set_camera_preset":
          flyToCameraPreset(cmd.preset);
          break;

        // ── time window ──────────────────────────────────────────────────────
        case "set_time_window":
          setTimeWindow(cmd.start_iso, cmd.end_iso);
          break;
        case "reset_time_window":
          resetTimeWindow();
          break;

        default:
          break;
      }
    };

    const listener = (event) => handleCesiumCommand(event.detail);
    window.addEventListener("cesium-command", listener);
    return () => window.removeEventListener("cesium-command", listener);
  }, [activeHeatmap]);

  // ─── ANIMATION INTERVAL ───────────────────────────────────────────────────────
  useEffect(() => {
    if (animPlaying) {
      animIntervalRef.current = setInterval(() => {
        setAnimFrame((prev) => {
          const next = (prev + 1) % 24;
          applyAnimFrame(next);
          return next;
        });
      }, 600); // advance one hour every 600 ms
    } else {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
        animIntervalRef.current = null;
      }
    }
    return () => {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
        animIntervalRef.current = null;
      }
    };
  }, [animPlaying]);

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {loading && (
        <div style={{
          position: "absolute", zIndex: 20, top: 16, left: 16,
          background: "rgba(0,0,0,0.75)", color: "#fff",
          padding: "10px 14px", borderRadius: 8, fontSize: 14,
        }}>
          Loading 3D building…
        </div>
      )}

      {/* Active mode badge */}
      {activeMode !== "default" && !loading && (
        <div style={{
          position: "absolute", zIndex: 18, top: 16, right: 16,
          background: "rgba(20,20,20,0.88)", color: "#9ad1ff",
          padding: "6px 12px", borderRadius: 8, fontSize: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)", backdropFilter: "blur(4px)",
        }}>
          Mode: <strong>{activeMode}</strong>
          {activeHeatmap && <span style={{ marginLeft: 6, color: "#fbbf24" }}>· {activeHeatmap}</span>}
        </div>
      )}

      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      <button
        onClick={() => setShowControls((prev) => !prev)}
        style={{
          position: "absolute", top: 16, left: showControls ? 288 : 16, zIndex: 16,
          padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "rgba(20,20,20,0.88)", color: "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)", backdropFilter: "blur(4px)",
        }}
      >
        {showControls ? "Hide Controls" : "Show Controls"}
      </button>

      {showControls && (
        <div style={{
          position: "absolute", top: 16, left: 16, zIndex: 15, width: 260,
          maxHeight: "calc(100% - 32px)", overflow: "auto",
          background: "rgba(20,20,20,0.88)", color: "#fff",
          borderRadius: 10, padding: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)", backdropFilter: "blur(4px)",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Building Controls</div>

          <button onClick={zoomToBuilding}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 10 }}>
            Show Whole Building
          </button>

          {/* Heatmap buttons */}
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>Heatmaps</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            {["temperature", "co2", "humidity", "occupancy"].map((m) => (
              <button key={m} onClick={() => showHeatmap(m)}
                style={{
                  padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11,
                  background: activeHeatmap === m ? "#3B82F6" : "rgba(255,255,255,0.15)",
                  color: "#fff",
                }}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => { resetStylesAndLabels(); showOnlyEntities(() => false); if (i3sProviderRef.current) i3sProviderRef.current.show = true; }}
            style={{ width: "100%", padding: "7px 12px", borderRadius: 6, border: "none", cursor: "pointer", marginBottom: 10, fontSize: 12, background: "rgba(255,255,255,0.1)", color: "#fff" }}>
            Clear Heatmap
          </button>

          {/* Alert button */}
          <button onClick={showAlertOverlays}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 10, background: "#EF4444", color: "#fff" }}>
            ⚠ Show Alerts
          </button>

          {/* Energy flow button */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            <button onClick={() => showEnergyFlow(null)}
              style={{ padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, background: "rgba(255,255,255,0.15)", color: "#fff" }}>
              ⚡ Energy Flow
            </button>
            <button onClick={hideEnergyFlow}
              style={{ padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, background: "rgba(255,255,255,0.1)", color: "#fff" }}>
              Hide Flow
            </button>
          </div>

          {/* Sensor markers button */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
            <button onClick={() => showSensorMarkers("all")}
              style={{ padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, background: "rgba(255,255,255,0.15)", color: "#fff" }}>
              📡 Sensors
            </button>
            <button onClick={hideSensorMarkers}
              style={{ padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, background: "rgba(255,255,255,0.1)", color: "#fff" }}>
              Hide Sensors
            </button>
          </div>

          {/* Floor zoom */}
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>Zoom to floor</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {availableFloors.map((floor) => (
              <button key={floor} onClick={() => zoomToFloor(floor)}
                style={{ padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer" }}>
                Floor {floor}
              </button>
            ))}
          </div>

          {/* Room select */}
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>Zoom to room</div>
          <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, marginBottom: 8 }}>
            <option value="">Select a room</option>
            {availableRooms.map((room) => (
              <option key={`${room.roomNumber}-${room.floorLevel}`} value={room.roomNumber}>
                {room.roomNumber} — {room.roomName} (F{room.floorLevel})
              </option>
            ))}
          </select>
          <button onClick={() => { if (selectedRoom) zoomToRoom(selectedRoom); }}
            disabled={!selectedRoom}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
              cursor: selectedRoom ? "pointer" : "not-allowed", opacity: selectedRoom ? 1 : 0.5, marginBottom: 12,
            }}>
            Zoom to Selected Room
          </button>

          {/* Circuit select */}
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>Zoom to circuit</div>
          <select value={selectedCircuit} onChange={(e) => setSelectedCircuit(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, marginBottom: 8 }}>
            <option value="">Select a circuit</option>
            {Object.entries(circuitConfigs).map(([id, cfg]) => (
              <option key={id} value={id}>{cfg.label}</option>
            ))}
          </select>
          <button onClick={() => { if (selectedCircuit) zoomToCircuit(selectedCircuit); }}
            disabled={!selectedCircuit}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
              cursor: selectedCircuit ? "pointer" : "not-allowed", opacity: selectedCircuit ? 1 : 0.5, marginBottom: 12,
            }}>
            Zoom to Selected Circuit
          </button>

          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
            Chatbot commands:
            <br /><code style={{ color: "#9ad1ff" }}>fly_to_coordinates</code>
            <br /><code style={{ color: "#9ad1ff" }}>zoom_to_floor</code>
            <br /><code style={{ color: "#9ad1ff" }}>zoom_to_room</code>
            <br /><code style={{ color: "#9ad1ff" }}>zoom_to_circuit</code>
            <br /><code style={{ color: "#9ad1ff" }}>show_heatmap</code>
            <br /><code style={{ color: "#9ad1ff" }}>highlight_rooms_by_threshold</code>
            <br /><code style={{ color: "#9ad1ff" }}>show_alerts</code>
            <br /><code style={{ color: "#9ad1ff" }}>show_energy_flow</code>
            <br /><code style={{ color: "#9ad1ff" }}>compare_floors</code>
            <br /><code style={{ color: "#9ad1ff" }}>reset_view</code>
          </div>
        </div>
      )}

      {/* ── HOVER TOOLTIP ─────────────────────────────────────────────────────── */}
      {hoveredRoom && hoveredRoom.value !== null && (
        <div style={{
          position: "absolute",
          left: hoveredRoom.x, top: hoveredRoom.y,
          zIndex: 30, pointerEvents: "none",
          background: "rgba(10,15,30,0.92)", color: "#E2F1FF",
          border: "1px solid rgba(125,211,252,0.35)", borderRadius: 8,
          padding: "8px 12px", fontSize: 12, lineHeight: 1.5,
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
          maxWidth: 200,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2, color: "#7DD3FC" }}>{hoveredRoom.name}</div>
          <div style={{ fontSize: 10, color: "#64748B", marginBottom: 4 }}>
            Room {hoveredRoom.rn} · Floor {hoveredRoom.floor}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9" }}>
            {typeof hoveredRoom.value === "number" ? hoveredRoom.value.toFixed(hoveredRoom.metric === "co2" || hoveredRoom.metric === "occupancy" ? 0 : 1) : hoveredRoom.value}
            <span style={{ fontSize: 11, fontWeight: 400, color: "#94A3B8", marginLeft: 2 }}>{hoveredRoom.unit}</span>
          </div>
        </div>
      )}

      {/* ── BUILDING SUMMARY STRIP ────────────────────────────────────────────── */}
      {buildingSummary && (
        <div style={{
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 20, display: "flex", gap: 8, pointerEvents: "none",
          background: "rgba(10,15,30,0.90)", border: "1px solid rgba(125,211,252,0.2)",
          borderRadius: 10, padding: "8px 14px", backdropFilter: "blur(10px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
        }}>
          {[
            { label: "MIN", value: buildingSummary.min.toFixed(buildingSummary.metric === "co2" || buildingSummary.metric === "occupancy" ? 0 : 1) + buildingSummary.unit, sub: buildingSummary.best?.name, color: "#34D399" },
            { label: "AVG", value: buildingSummary.avg.toFixed(buildingSummary.metric === "co2" || buildingSummary.metric === "occupancy" ? 0 : 1) + buildingSummary.unit, color: "#60A5FA" },
            { label: "MAX", value: buildingSummary.max.toFixed(buildingSummary.metric === "co2" || buildingSummary.metric === "occupancy" ? 0 : 1) + buildingSummary.unit, sub: buildingSummary.worst?.name, color: "#F87171" },
            { label: "⚠ ALERTS", value: buildingSummary.alertCount, color: buildingSummary.alertCount > 0 ? "#FBBF24" : "#4ADE80" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ textAlign: "center", minWidth: 64 }}>
              <div style={{ fontSize: 9, color: "#64748B", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
              {sub && <div style={{ fontSize: 9, color: "#475569", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── COLOR LEGEND ──────────────────────────────────────────────────────── */}
      {activeHeatmap && (() => {
        const LEGENDS = {
          temperature: { stops: ["#3B82F6","#22C55E","#FB923C","#EF4444"], min: "15°C", mid: "22°C", max: "30°C", label: "Temperature" },
          co2:         { stops: ["#22C55E","#FACC15","#EF4444"],            min: "400", mid: "800",   max: "1200 ppm", label: "CO₂" },
          humidity:    { stops: ["#EF4444","#22C55E","#3B82F6"],            min: "20%", mid: "50%",   max: "80%", label: "Humidity" },
          occupancy:   { stops: ["#F0F0F0","#FB923C","#EF4444"],            min: "0",   mid: "5",     max: "10+", label: "Occupancy" },
        };
        const leg = LEGENDS[activeHeatmap];
        if (!leg) return null;
        const gradId = `lg-${activeHeatmap}`;
        return (
          <div style={{
            position: "absolute", bottom: buildingSummary ? 130 : 16, right: 16, zIndex: 20,
            background: "rgba(10,15,30,0.90)", border: "1px solid rgba(125,211,252,0.2)",
            borderRadius: 8, padding: "10px 12px", backdropFilter: "blur(10px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.45)", minWidth: 130,
          }}>
            <div style={{ fontSize: 10, color: "#7DD3FC", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
              {leg.label}
            </div>
            <svg width="106" height="14" style={{ display: "block", borderRadius: 3, marginBottom: 4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                  {leg.stops.map((c, i) => (
                    <stop key={i} offset={`${(i / (leg.stops.length - 1)) * 100}%`} stopColor={c} />
                  ))}
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="106" height="14" fill={`url(#${gradId})`} rx="2" />
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#94A3B8" }}>
              <span>{leg.min}</span><span>{leg.mid}</span><span>{leg.max}</span>
            </div>
          </div>
        );
      })()}

      {/* ── TIME ANIMATION CONTROLS ───────────────────────────────────────────── */}
      {activeHeatmap && animReady && (
        <div style={{
          position: "absolute", bottom: buildingSummary ? 78 : 16,
          left: "50%", transform: "translateX(-50%)",
          zIndex: 20, display: "flex", alignItems: "center", gap: 10,
          background: "rgba(10,15,30,0.90)", border: "1px solid rgba(125,211,252,0.2)",
          borderRadius: 10, padding: "8px 14px", backdropFilter: "blur(10px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
        }}>
          <button
            onClick={() => setAnimPlaying((p) => !p)}
            style={{
              background: animPlaying ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.1)",
              border: "1px solid rgba(125,211,252,0.3)", borderRadius: 6,
              color: "#E2F1FF", fontSize: 14, padding: "4px 10px", cursor: "pointer",
            }}
          >
            {animPlaying ? "⏸" : "▶"}
          </button>
          <input
            type="range" min={0} max={23} value={animFrame}
            onChange={(e) => {
              const f = Number(e.target.value);
              setAnimFrame(f);
              applyAnimFrame(f);
            }}
            style={{ width: 140, accentColor: "#3B82F6", cursor: "pointer" }}
          />
          <span style={{ fontSize: 11, color: "#7DD3FC", fontVariantNumeric: "tabular-nums", minWidth: 38 }}>
            {animFramesRef.current[animFrame]?.label ?? "00:00"}
          </span>
        </div>
      )}

    </div>
  );
}

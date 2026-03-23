import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { ROLE_ROOM_MAP } from "../utils/roomDataUtils";

export default function CesiumGeoJsonViewer({ onFeatureClick }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const i3sProviderRef = useRef(null);

  const roomEntitiesRef = useRef([]);
  const circuitEntitiesRef = useRef([]);
  const homeDestinationRef = useRef(null);
  const availableFloorsRef = useRef([]);

  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [availableFloors, setAvailableFloors] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedCircuit, setSelectedCircuit] = useState("");

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
    String(value ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  const compactSearchText = (value) => normalizeSearchText(value).replace(/\s+/g, "");

  const getSearchTerms = (rawQuery) => {
    const normalized = normalizeSearchText(rawQuery);
    if (!normalized) return [];

    const terms = new Set([normalized]);

    if (normalized.includes("elevator") || normalized.includes("lift")) {
      terms.add("elevator");
      terms.add("elevators");
      terms.add("lift");
      terms.add("lifts");
      terms.add("асансьор");
    }

    // Deterministic role→room lookup using the authoritative database mapping.
    // Sort by label length descending so longer/more-specific labels match before shorter ones
    // (e.g. "cabinet 1" resolves before the generic "cabinet" key).
    const sortedEntries = Object.entries(ROLE_ROOM_MAP).sort((a, b) => b[0].length - a[0].length);
    for (const [label, { roomNumber }] of sortedEntries) {
      if (normalized.includes(label)) {
        terms.add(roomNumber);                               // display form e.g. "3.16"
        terms.add(label);                                    // role label itself
        const rawCandidates = displayRoomToRawCandidates(roomNumber);
        // Only add unambiguous (≥3-char) candidates; short ones like "16" would
        // match unrelated rooms (e.g. room "216") as text substrings.
        rawCandidates.filter(r => r.length >= 3).forEach((r) => terms.add(r));
        break; // stop at the first (longest) match
      }
    }

    return [...terms];
  };

  const extractNormalizedRoomNumber = (value) => {
    const text = String(value ?? "").toLowerCase().trim();
    if (!text) return "";
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    
    // Matches:
    // "0.02"
    // "room 0.02"
    // "Room 2.12"
    // "room-2.12"
    const match = normalized.match(/(?:room\s*)?(-?\d+\.\d+)/i);
    if (!match) return "";

    return match[1];
  };

  // Converts display IDs like "0.02", "-1.01", "1.03", "2.12" to raw GeoJSON RoomNumber
  // candidates: "002", "-01", "103", "212" respectively.
  // The first element is always the floor-qualified form (the "primary" candidate).
  const displayRoomToRawCandidates = (displayId) => {
    if (!displayId) return [];
    const m = String(displayId).match(/^(-?\d+)\.(\d+)$/);
    if (!m) return [];
    const floor = parseInt(m[1], 10);
    const roomPart = m[2];
    const candidates = new Set();
    if (floor === 0) {
      candidates.add(roomPart.padStart(3, "0"));          // "004"
    } else if (floor > 0) {
      candidates.add(`${floor}${roomPart.padStart(2, "0")}`); // "316"
    } else {
      candidates.add(`-${roomPart.padStart(2, "0")}`);    // "-01" for floor -1
    }
    candidates.add(roomPart.replace(/^0+/, "") || "0");  // broader fallback
    candidates.add(roomPart);
    return [...candidates];
  };

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

  const getRoomColor = (roomName) => {
    const name = (roomName || "").toUpperCase();

    if (name.includes("WC") || name.includes("TOILET")) {
      return Cesium.Color.fromCssColorString("#FFFFFF").withAlpha(0.88);
    }
    if (name.includes("STAIRCASE") || name.includes("СТЪЛБА")) {
      return Cesium.Color.fromCssColorString("#7A7A7A").withAlpha(0.92);
    }
    if (name.includes("ELEVATOR") || name.includes("АСАНСЬОР")) {
      return Cesium.Color.fromCssColorString("#5C5C5C").withAlpha(0.92);
    }
    if (name.includes("CORRIDOR") || name.includes("КОРИДОР")) {
      return Cesium.Color.fromCssColorString("#E8E8E8").withAlpha(0.78);
    }
    if (
      name.includes("MEETING") ||
      name.includes("CONFERENCE") ||
      name.includes("ЗАЛА")
    ) {
      return Cesium.Color.fromCssColorString("#D4A373").withAlpha(0.85);
    }
    if (name.includes("DIRECTOR") || name.includes("ДИРЕКТОР")) {
      return Cesium.Color.fromCssColorString("#8B4513").withAlpha(0.88);
    }
    if (
      name.includes("IT") ||
      name.includes("TECHNICAL") ||
      name.includes("ЕЛЕКТР")
    ) {
      return Cesium.Color.fromCssColorString("#B0B0B0").withAlpha(0.85);
    }

    return Cesium.Color.fromCssColorString("#4DA3FF").withAlpha(0.72);
  };

  const getRoomData = (roomType) => {
    const base = {
      temp: 22,
      humidity: 45,
      occupancy: 0,
      co2: 400,
    };

    if ((roomType || "").toUpperCase().includes("WC")) {
      return { ...base, temp: 20, humidity: 55 };
    }
    if ((roomType || "").toUpperCase().includes("MEETING")) {
      return { ...base, temp: 23, humidity: 42, occupancy: 8, co2: 600 };
    }

    return {
      ...base,
      temp: 22 + Math.floor(Math.random() * 3),
      humidity: 40 + Math.floor(Math.random() * 10),
      occupancy: Math.floor(Math.random() * 4),
      co2: 450 + Math.floor(Math.random() * 300),
    };
  };

  const getRoomCircuitId = (roomNumber, roomName, buildingLevel) => {
    const nameLower = (roomName || "").toLowerCase();
    const numStr = (roomNumber || "").toString();
    const circuits = [];

    if (
      nameLower.includes("elevator") ||
      nameLower.includes("shaft") ||
      nameLower.includes("асансьор") ||
      nameLower.includes("шахта")
    ) {
      circuits.push("elevator");
    }

    if (
      buildingLevel === 1 ||
      nameLower.includes("абонатн") ||
      nameLower.includes("грт") ||
      numStr === "14" ||
      numStr === "15" ||
      numStr === "16" ||
      numStr === "006" ||
      numStr === "107" ||
      numStr === "42" ||
      numStr === "68"
    ) {
      circuits.push("circuit6boiler");
    }

    if (
      nameLower.includes("ups") ||
      nameLower.includes("power") ||
      nameLower.includes("ел") ||
      numStr === "16"
    ) {
      circuits.push("circuit10");
    }

    if (
      nameLower.includes("човешки ресурси") ||
      nameLower.includes("human resources") ||
      nameLower.includes("it отдел") ||
      nameLower.includes("it department") ||
      nameLower.includes("network") ||
      nameLower.includes("telecom") ||
      nameLower.includes("комуникац") ||
      numStr === "315" ||
      numStr === "310"
    ) {
      circuits.push("circuit11");
    }

    if (
      nameLower.includes("server") ||
      nameLower.includes("сървър") ||
      numStr === "17"
    ) {
      circuits.push("circuit8");
    }

    if (
      ((nameLower.includes("склад") || nameLower.includes("storage")) &&
        !nameLower.includes("асансьор")) ||
      numStr === "-13" ||
      numStr === "22" ||
      numStr === "007" ||
      numStr === "29"
    ) {
      circuits.push("circuit12");
    }

    if (buildingLevel === 1 || buildingLevel === 2) {
      circuits.push("airconditioner1");
    }

    if (buildingLevel === 3 || buildingLevel === 4 || buildingLevel === 5) {
      circuits.push("airconditioner2");
    }

    if (
      nameLower.includes("conference") ||
      nameLower.includes("meeting") ||
      nameLower.includes("конференц") ||
      nameLower.includes("срещ") ||
      nameLower.includes("visualization") ||
      nameLower.includes("визуализация") ||
      nameLower.includes("sap") ||
      nameLower.includes("зала") ||
      numStr === "002" ||
      numStr === "-01" ||
      numStr === "-02" ||
      numStr === "110"
    ) {
      circuits.push("circuit7");
    }

    if (
      nameLower.includes("office") ||
      nameLower.includes("офис") ||
      nameLower.includes("workspace") ||
      nameLower.includes("работ") ||
      nameLower.includes("open") ||
      nameLower.includes("отворен") ||
      nameLower.includes("лаборатория") ||
      nameLower.includes("laboratory") ||
      nameLower.includes("director") ||
      nameLower.includes("директор") ||
      nameLower.includes("изследовател") ||
      nameLower.includes("кабинет") ||
      nameLower.includes("бизнес") ||
      nameLower.includes("счетоводител") ||
      nameLower.includes("асистент")
    ) {
      circuits.push("circuit9");
    }

    circuits.push("main");

    return [...new Set(circuits)];
  };

  const geometryToPolygons = (geometry, baseElevation) => {
    if (!geometry) return [];

    const ringToPositions = (ring) =>
      ring.map(([lon, lat]) =>
        Cesium.Cartesian3.fromDegrees(lon, lat, baseElevation)
      );

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

  const resetStylesAndLabels = () => {
    [...roomEntitiesRef.current, ...circuitEntitiesRef.current].forEach((entity) => {
      if (entity.polygon && entity.originalMaterial) {
        entity.polygon.material = entity.originalMaterial;
        entity.polygon.outlineColor = Cesium.Color.BLACK.withAlpha(0.85);
        entity.polygon.outlineWidth = 2;
      }
      if (entity.box && entity.originalMaterial) {
        entity.box.material = entity.originalMaterial;
      }
      if (entity.cylinder && entity.originalMaterial) {
        entity.cylinder.material = entity.originalMaterial;
      }
      if (entity.ellipsoid && entity.originalMaterial) {
        entity.ellipsoid.material = entity.originalMaterial;
      }
      if (entity.labelEntity) {
        entity.labelEntity.show = false;
      }
    });
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

  const zoomToRoom = (roomQuery) => {
    setSelectedCircuit("");

    const query = String(roomQuery ?? "").trim();
    if (!query) return;

    const normalizedQuery = normalizeSearchText(query);
    const normalizedRoomNumber = extractNormalizedRoomNumber(query);

    const rawCandidates = normalizedRoomNumber ? displayRoomToRawCandidates(normalizedRoomNumber) : [];
    // Only match against the unambiguous floor-qualified candidates (≥3 chars) so
    // that e.g. short candidate "16" from room "3.16" doesn't match entity "16"
    // (the basement UPS room) as well as the intended room "316".
    const primaryCandidates = rawCandidates.filter(r => r.length >= 3);

    const roomNumberMatches = roomEntitiesRef.current.filter((e) => {
      const entityRoomNumber = e.properties?.roomNumber?.getValue?.();
      const entityNormalized = normalizeSearchText(entityRoomNumber);
      const entityNormalizedRoomNumber = extractNormalizedRoomNumber(entityRoomNumber);

      if (normalizedRoomNumber) {
        if (entityNormalizedRoomNumber === normalizedRoomNumber) return true;
        if (primaryCandidates.includes(entityNormalized)) return true;
        return false;
      }
      return entityNormalized === normalizedQuery;
    });

    const roomNameMatches = roomEntitiesRef.current.filter((e) => {
      const roomName = normalizeSearchText(e.properties?.roomName?.getValue?.());
      const roomNameOriginal = normalizeSearchText(
        e.properties?.roomNameOriginal?.getValue?.()
      );
      return (
        roomName === normalizedQuery ||
        roomNameOriginal === normalizedQuery ||
        roomName.includes(normalizedQuery) ||
        roomNameOriginal.includes(normalizedQuery)
      );
    });

    const matches = roomNumberMatches.length
      ? roomNumberMatches
      : roomNameMatches;
    if (!matches.length) return;

    if (i3sProviderRef.current) i3sProviderRef.current.show = false;
    resetStylesAndLabels();

    showOnlyEntities((e) => matches.includes(e));

    matches.forEach((entity) => {
      if (entity.polygon) {
        entity.polygon.material = Cesium.Color.CYAN.withAlpha(0.9);
      }
      if (entity.labelEntity) {
        entity.labelEntity.show = true;
      }
    });

    zoomToEntities(matches, matches.length > 1 ? 2.8 : 4, 15);

    const clickedEntity = matches[0];
    if (onFeatureClick && clickedEntity) {
      onFeatureClick({
        roomNumber: clickedEntity.properties.roomNumber?.getValue(),
        roomName: clickedEntity.properties.roomName?.getValue(),
        roomNameOriginal: clickedEntity.properties.roomNameOriginal?.getValue(),
        floor: clickedEntity.properties.floorLevel?.getValue(),
        area: clickedEntity.properties.area?.getValue(),
        temperature: clickedEntity.properties.temperature?.getValue(),
        humidity: clickedEntity.properties.humidity?.getValue(),
        co2: clickedEntity.properties.co2?.getValue(),
        occupancy: clickedEntity.properties.occupancy?.getValue(),
        circuitIds: clickedEntity.properties.circuit_id?.getValue?.() || [],
      });
    }
  };

  const zoomToFloor = (floor) => {
    setSelectedCircuit("");

    const resolveFloorLevel = (requestedFloorRaw) => {
      const available = availableFloorsRef.current
        .map((f) => Number(f))
        .filter((f) => Number.isFinite(f));
      if (!available.length) return null;

      const requestedStr = String(requestedFloorRaw ?? "").trim();
      const requestedNum = Number(requestedStr);

      if (Number.isFinite(requestedNum) && available.includes(requestedNum)) {
        return requestedNum;
      }

      if (Number.isFinite(requestedNum) && available.includes(requestedNum + 1)) {
        return requestedNum + 1;
      }
      if (Number.isFinite(requestedNum) && available.includes(requestedNum - 1)) {
        return requestedNum - 1;
      }

      const upper = requestedStr.toUpperCase();
      if (upper === "ROOF") {
        return Math.max(...available);
      }
      const levelMatch = upper.match(/^[LB](\d{1,2})$/);
      if (levelMatch) {
        const n = Number(levelMatch[1]);
        if (Number.isFinite(n) && available.includes(n)) return n;
      }

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

    showOnlyEntities(
      (e) => Number(e.properties?.floorLevel?.getValue?.()) === targetFloor
    );

    zoomToEntities(matches, 2.6, 30);
  };

  const zoomToBuilding = () => {
    setSelectedCircuit("");

    const viewer = viewerRef.current;
    const provider = i3sProviderRef.current;
    if (!viewer || !provider?.extent) return;

    resetStylesAndLabels();
    provider.show = true;

    [...roomEntitiesRef.current, ...circuitEntitiesRef.current].forEach((entity) => {
      entity.show = false;
      if (entity.labelEntity) entity.labelEntity.show = false;
    });

    const center = Cesium.Rectangle.center(provider.extent);
    center.height = 240;
    const destination = Cesium.Ellipsoid.WGS84.cartographicToCartesian(center);

    homeDestinationRef.current = destination;

    viewer.camera.flyTo({
      destination,
      duration: 1.5,
    });
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

  const config = circuitConfigs[normalizedCircuitId];
  const circuitColor = Cesium.Color.fromCssColorString(
    config?.color || "#22C55E"
  );

  // Hide the building exterior completely
  if (i3sProviderRef.current) {
    i3sProviderRef.current.show = false;
  }

  resetStylesAndLabels();

  const allEntities = [...roomEntitiesRef.current, ...circuitEntitiesRef.current];

  const matches = allEntities.filter((entity) => {
    const circuitValue = entity.properties?.circuit_id?.getValue?.();
    if (Array.isArray(circuitValue)) {
      return circuitValue.map(normalizeCircuitId).includes(normalizedCircuitId);
    }
    return normalizeCircuitId(circuitValue) === normalizedCircuitId;
  });

  if (!matches.length) return false;

  // Hide everything first
  allEntities.forEach((entity) => {
    entity.show = false;
    if (entity.labelEntity) entity.labelEntity.show = false;
  });

  // Show only selected circuit entities
  matches.forEach((entity) => {
    entity.show = true;

    if (entity.polygon) {
      entity.polygon.material = circuitColor.withAlpha(0.92);
      entity.polygon.outlineColor = circuitColor;
      entity.polygon.outlineWidth = 4;
    }

    // if (entity.box) {
    //   entity.box.material = circuitColor.withAlpha(0.95);
    // }

    if (entity.cylinder) {
      entity.cylinder.material = circuitColor.withAlpha(0.95);
    }

    if (entity.ellipsoid) {
      entity.ellipsoid.material = circuitColor.withAlpha(0.8);
    }

    if (entity.labelEntity) {
      entity.labelEntity.show = false;
    }
  });

  const preset = circuitCameraPositions[normalizedCircuitId];
  if (preset) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        preset.lon,
        preset.lat,
        preset.height
      ),
      orientation: {
        heading: Cesium.Math.toRadians(preset.heading),
        pitch: Cesium.Math.toRadians(preset.pitch),
        roll: 0,
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
      const roomName = normalizeSearchText(entity.properties?.roomName?.getValue?.());
      const roomNameOriginal = normalizeSearchText(
        entity.properties?.roomNameOriginal?.getValue?.()
      );
      const roomNumber = normalizeSearchText(entity.properties?.roomNumber?.getValue?.());
      const entityName = normalizeSearchText(entity.name);
      const typeName = normalizeSearchText(entity.properties?.type?.getValue?.());

      const circuits = entity.properties?.circuit_id?.getValue?.();
      const circuitKeys = Array.isArray(circuits) ? circuits : [circuits];
      const circuitLabels = circuitKeys
        .map((id) => {
          const normalizedId = normalizeCircuitId(id);
          return normalizeSearchText(circuitConfigs[normalizedId]?.label || normalizedId);
        })
        .filter(Boolean);

      const haystackFields = [
        roomName,
        roomNameOriginal,
        roomNumber,
        entityName,
        typeName,
        ...circuitLabels,
      ].filter(Boolean);

      const haystack = haystackFields.join(" ");
      const compactHaystack = haystackFields.map((field) => compactSearchText(field)).join(" ");

      return (
        terms.some((term) => haystack.includes(term)) ||
        compactTerms.some((term) => compactHaystack.includes(term))
      );
    });

    if (!matches.length) {
      return false;
    }

    showOnlyEntities((entity) => matches.includes(entity));

    matches.forEach((entity) => {
      if (entity.polygon) {
        entity.polygon.material = Cesium.Color.CYAN.withAlpha(0.9);
      }
      if (entity.box) {
        entity.box.material = Cesium.Color.CYAN.withAlpha(0.85);
      }
      if (entity.cylinder) {
        entity.cylinder.material = Cesium.Color.CYAN.withAlpha(0.85);
      }
      if (entity.ellipsoid) {
        entity.ellipsoid.material = Cesium.Color.CYAN.withAlpha(0.75);
      }
      if (entity.labelEntity) {
        entity.labelEntity.show = true;
      }
    });

    zoomToEntities(matches, matches.length > 1 ? 2.8 : 4, 20);
    return true;
  };

  const handleEntityClick = (entity) => {
    if (!entity) return;

    const circuitValue = entity.properties?.circuit_id?.getValue?.();
    const roomNumber = entity.properties?.roomNumber?.getValue?.();

    if (roomNumber) {
      zoomToRoom(roomNumber);
      return;
    }

    if (typeof circuitValue === "string") {
      zoomToCircuit(circuitValue);
    }
  };

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
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          sceneModePicker: false,
          infoBox: false,
          selectionIndicator: false,
          shadows: false,
          homeButton: true,
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
          {
            adjustMaterialAlphaMode: true,
            showFeatures: true,
            applySymbology: true,
            calculateNormals: true,
          }
        );

        if (destroyed) return;

        viewer.scene.primitives.add(i3sProvider);
        i3sProviderRef.current = i3sProvider;

        const response = await fetch("/floorplans/Floorplan_polygon_4326.geojson");
        const geojson = await response.json();

        if (destroyed) return;

        const createdRoomEntities = [];
        const createdCircuitEntities = [];
        const floorsSet = new Set();
        const roomList = [];

        geojson.features.forEach((feature, idx) => {
          const props = feature.properties || {};
          const floorLevel = Number(props.BldgLevel ?? 0);
          const roomNumber = props.RoomNumber || `Room-${idx}`;
          const roomNameBulgarian = props.RoomName || "";
          const roomName = translateRoomName(roomNameBulgarian);
          const department = props.Department || "";
          const baseElevation = Number(props.BldgLevel_Elev ?? 0);
          const area = props.SourceArea;

          floorsSet.add(floorLevel);

          if (!roomList.find((r) => r.roomNumber === roomNumber)) {
            roomList.push({
              roomNumber,
              roomName,
              floorLevel,
            });
          }

          const roomData = getRoomData(roomName);
          const roomCircuitIds = getRoomCircuitId(roomNumber, roomName, floorLevel);
          const polygons = geometryToPolygons(feature.geometry, baseElevation);

          polygons.forEach((positions, polyIndex) => {
            const entity = viewer.entities.add({
              id: `${roomNumber}-${polyIndex}`,
              name: roomNumber,
              polygon: {
                hierarchy: new Cesium.PolygonHierarchy(positions),
                material: getRoomColor(roomName),
                extrudedHeight: baseElevation + 3.5,
                perPositionHeight: true,
                outline: true,
                outlineColor: Cesium.Color.BLACK.withAlpha(0.85),
                outlineWidth: 2,
                shadows: Cesium.ShadowMode.DISABLED,
              },
              properties: {
                roomNumber,
                roomName,
                roomNameOriginal: roomNameBulgarian,
                floorLevel,
                department,
                area,
                temperature: roomData.temp,
                humidity: roomData.humidity,
                co2: roomData.co2,
                occupancy: roomData.occupancy,
                circuit_id: roomCircuitIds,
              },
              show: false,
            });

            entity.originalMaterial = entity.polygon.material;
            createdRoomEntities.push(entity);
          });
        });

        const groupedByRoom = new Map();

        createdRoomEntities.forEach((entity) => {
          const roomNumber = entity.properties.roomNumber.getValue();
          if (!groupedByRoom.has(roomNumber)) {
            groupedByRoom.set(roomNumber, []);
          }
          groupedByRoom.get(roomNumber).push(entity);
        });

        groupedByRoom.forEach((entities) => {
          const sphere = getBoundingSphereFromEntities(entities);
          if (!sphere) return;

          const first = entities[0];
          const cartographic = Cesium.Cartographic.fromCartesian(sphere.center);
          const baseElevation =
            first.polygon.extrudedHeight.getValue() - 3.5;

          const roomCircuits = first.properties.circuit_id.getValue();
          const labelEntity = viewer.entities.add({
            position: Cesium.Cartesian3.fromRadians(
              cartographic.longitude,
              cartographic.latitude,
              baseElevation + 4.1
            ),
            label: {
              text: `${first.properties.roomName.getValue()}\n${first.properties.roomNumber.getValue()}\nCircuits: ${Array.isArray(roomCircuits) ? roomCircuits.join(", ") : roomCircuits}`,
              font: "bold 14px Arial",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -12),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              showBackground: true,
              backgroundColor: Cesium.Color.BLACK.withAlpha(0.72),
              backgroundPadding: new Cesium.Cartesian2(8, 6),
            },
            show: false,
          });

          entities.forEach((entity) => {
            entity.labelEntity = labelEntity;
          });
        });

        const addExternalEntity = (entity, materialAccessor = "box") => {
          if (entity[materialAccessor]?.material) {
            entity.originalMaterial = entity[materialAccessor].material;
          }
          createdCircuitEntities.push(entity);
        };

        const chargerBase1 = viewer.entities.add({
          id: "charger1-base",
          position: Cesium.Cartesian3.fromDegrees(23.33035, 42.67395, 605),
          cylinder: {
            length: 1.5,
            topRadius: 0.3,
            bottomRadius: 0.3,
            material: Cesium.Color.fromCssColorString("#AED6F1"),
            outline: true,
            outlineColor: Cesium.Color.BLACK,
          },
          properties: {
            circuit_id: "vehiclecharging1",
            type: "EV Charger",
          },
          show: false,
        });
        chargerBase1.originalMaterial = chargerBase1.cylinder.material;
        createdCircuitEntities.push(chargerBase1);

        const chargerScreen1 = viewer.entities.add({
          id: "charger1-screen",
          position: Cesium.Cartesian3.fromDegrees(23.33035, 42.67395, 606.2),
          box: {
            dimensions: new Cesium.Cartesian3(0.4, 0.05, 0.6),
            material: Cesium.Color.fromCssColorString("#2C3E50"),
            outline: true,
            outlineColor: Cesium.Color.CYAN,
          },
          properties: {
            circuit_id: "vehiclecharging1",
            type: "EV Charger",
          },
          show: false,
        });
        chargerScreen1.originalMaterial = chargerScreen1.box.material;
        createdCircuitEntities.push(chargerScreen1);

        const chargerBase2 = viewer.entities.add({
          id: "charger2-base",
          position: Cesium.Cartesian3.fromDegrees(23.33075, 42.67365, 605),
          cylinder: {
            length: 1.5,
            topRadius: 0.3,
            bottomRadius: 0.3,
            material: Cesium.Color.fromCssColorString("#85C1E2"),
            outline: true,
            outlineColor: Cesium.Color.BLACK,
          },
          properties: {
            circuit_id: "vehiclecharging2",
            type: "EV Charger",
          },
          show: false,
        });
        chargerBase2.originalMaterial = chargerBase2.cylinder.material;
        createdCircuitEntities.push(chargerBase2);

        const chargerScreen2 = viewer.entities.add({
          id: "charger2-screen",
          position: Cesium.Cartesian3.fromDegrees(23.33075, 42.67365, 606.2),
          box: {
            dimensions: new Cesium.Cartesian3(0.4, 0.05, 0.6),
            material: Cesium.Color.fromCssColorString("#2C3E50"),
            outline: true,
            outlineColor: Cesium.Color.CYAN,
          },
          properties: {
            circuit_id: "vehiclecharging2",
            type: "EV Charger",
          },
          show: false,
        });
        chargerScreen2.originalMaterial = chargerScreen2.box.material;
        createdCircuitEntities.push(chargerScreen2);

        const light1Positions = [
          [23.3303, 42.67392],
          [23.33045, 42.67392],
          [23.3306, 42.67392],
          [23.33075, 42.67392],
        ];

        light1Positions.forEach((pos, i) => {
          const pole = viewer.entities.add({
            id: `north-light-pole-${i + 1}`,
            position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], 605),
            cylinder: {
              length: 5,
              topRadius: 0.08,
              bottomRadius: 0.12,
              material: Cesium.Color.DARKGRAY,
              outline: true,
              outlineColor: Cesium.Color.BLACK,
            },
            properties: {
              circuit_id: "outsidelighting1",
              type: "Light Pole",
            },
            show: false,
          });
          pole.originalMaterial = pole.cylinder.material;
          createdCircuitEntities.push(pole);

          const head = viewer.entities.add({
            id: `north-light-head-${i + 1}`,
            position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], 607.5),
            ellipsoid: {
              radii: new Cesium.Cartesian3(0.25, 0.25, 0.15),
              material: Cesium.Color.fromCssColorString("#F9E79F").withAlpha(0.95),
              outline: true,
              outlineColor: Cesium.Color.BLACK,
            },
            properties: {
              circuit_id: "outsidelighting1",
              type: "Light Pole",
            },
            show: false,
          });
          head.originalMaterial = head.ellipsoid.material;
          createdCircuitEntities.push(head);
        });

        const light2Positions = [
          [23.3303, 42.67365],
          [23.33045, 42.67365],
          [23.3306, 42.67365],
          [23.33075, 42.67365],
        ];

        light2Positions.forEach((pos, i) => {
          const pole = viewer.entities.add({
            id: `south-light-pole-${i + 1}`,
            position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], 605),
            cylinder: {
              length: 5,
              topRadius: 0.08,
              bottomRadius: 0.12,
              material: Cesium.Color.DARKGRAY,
              outline: true,
              outlineColor: Cesium.Color.BLACK,
            },
            properties: {
              circuit_id: "outsidelighting2",
              type: "Light Pole",
            },
            show: false,
          });
          pole.originalMaterial = pole.cylinder.material;
          createdCircuitEntities.push(pole);

          const head = viewer.entities.add({
            id: `south-light-head-${i + 1}`,
            position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1], 607.5),
            ellipsoid: {
              radii: new Cesium.Cartesian3(0.25, 0.25, 0.15),
              material: Cesium.Color.fromCssColorString("#FAD7A0").withAlpha(0.95),
              outline: true,
              outlineColor: Cesium.Color.BLACK,
            },
            properties: {
              circuit_id: "outsidelighting2",
              type: "Light Pole",
            },
            show: false,
          });
          head.originalMaterial = head.ellipsoid.material;
          createdCircuitEntities.push(head);
        });

        const ledFrame = viewer.entities.add({
          id: "led-frame",
          position: Cesium.Cartesian3.fromDegrees(23.330534, 42.67387, 608),
          box: {
            dimensions: new Cesium.Cartesian3(4.0, 0.4, 2.5),
            material: Cesium.Color.fromCssColorString("#2C3E50"),
            outline: true,
            outlineColor: Cesium.Color.BLACK,
          },
          properties: {
            circuit_id: "3DLED",
            type: "LED Display",
          },
          show: false,
        });
        ledFrame.originalMaterial = ledFrame.box.material;
        createdCircuitEntities.push(ledFrame);

        const ledScreen = viewer.entities.add({
          id: "led-screen",
          position: Cesium.Cartesian3.fromDegrees(23.330534, 42.67387, 608),
          box: {
            dimensions: new Cesium.Cartesian3(3.6, 0.2, 2.2),
            material: Cesium.Color.fromCssColorString("#FF6B6B").withAlpha(0.9),
            outline: true,
            outlineColor: Cesium.Color.RED,
          },
          properties: {
            circuit_id: "3DLED",
            type: "LED Display",
          },
          show: false,
        });
        ledScreen.originalMaterial = ledScreen.box.material;
        createdCircuitEntities.push(ledScreen);

        roomEntitiesRef.current = createdRoomEntities;
        circuitEntitiesRef.current = createdCircuitEntities;

        const sortedFloors = Array.from(floorsSet).sort((a, b) => a - b);
        availableFloorsRef.current = sortedFloors;
        setAvailableFloors(sortedFloors);
        setAvailableRooms(
          roomList.sort((a, b) => {
            if (a.floorLevel !== b.floorLevel) return a.floorLevel - b.floorLevel;
            return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, {
              numeric: true,
              sensitivity: "base",
            });
          })
        );

        const center = Cesium.Rectangle.center(i3sProvider.extent);
        center.height = 240;
        const destination =
          Cesium.Ellipsoid.WGS84.cartographicToCartesian(center);

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

        setLoading(false);
        window.__cesiumViewerReady = true;

        const pending = Array.isArray(window.__pendingCesiumCommands)
          ? window.__pendingCesiumCommands
          : [];
        if (pending.length) {
          pending.forEach((cmd) => {
            window.dispatchEvent(
              new CustomEvent("cesium-command", { detail: cmd })
            );
          });
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
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
      i3sProviderRef.current = null;
      roomEntitiesRef.current = [];
      circuitEntitiesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const handleCesiumCommand = (cmd) => {
      const viewer = viewerRef.current;
      if (!viewer || cmd?.type !== "cesium") return;

      switch (cmd.action) {
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
          if (!zoomToCircuit(cmd.circuit_id || cmd.circuit)) {
            zoomToName(cmd.circuit_id || cmd.circuit || "");
          }
          break;
        case "zoom_to_name":
          zoomToName(cmd.name || cmd.query || "");
          break;
        case "highlight_by_name":
          zoomToName(cmd.name || cmd.query || "");
          break;
        case "show_building":
          if (i3sProviderRef.current) i3sProviderRef.current.show = true;
          break;
        case "hide_building":
          if (i3sProviderRef.current) i3sProviderRef.current.show = false;
          break;
          
        default:
          break;
      }
    };

    const listener = (event) => handleCesiumCommand(event.detail);
    window.addEventListener("cesium-command", listener);
    return () => window.removeEventListener("cesium-command", listener);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {loading && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            top: 16,
            left: 16,
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          Loading 3D building…
        </div>
      )}

      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      <button
        onClick={() => setShowControls((prev) => !prev)}
        style={{
          position: "absolute",
          top: 16,
          left: showControls ? 288 : 16,
          zIndex: 16,
          padding: "10px 12px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          background: "rgba(20,20,20,0.88)",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          backdropFilter: "blur(4px)",
        }}
      >
        {showControls ? "Hide Controls" : "Show Controls"}
      </button>

      {showControls && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 15,
            width: 260,
            maxHeight: "calc(100% - 32px)",
            overflow: "auto",
            background: "rgba(20,20,20,0.88)",
            color: "#fff",
            borderRadius: 10,
            padding: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            Building Controls
          </div>

          <button
            onClick={zoomToBuilding}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            Show Whole Building
          </button>

          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>
            Zoom to floor
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {availableFloors.map((floor) => (
              <button
                key={floor}
                onClick={() => zoomToFloor(floor)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Floor {floor}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>
            Zoom to room
          </div>

          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <option value="">Select a room</option>
            {availableRooms.map((room) => (
              <option
                key={`${room.roomNumber}-${room.floorLevel}`}
                value={room.roomNumber}
              >
                {room.roomNumber} — {room.roomName} (F{room.floorLevel})
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              if (selectedRoom) zoomToRoom(selectedRoom);
            }}
            disabled={!selectedRoom}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              cursor: selectedRoom ? "pointer" : "not-allowed",
              opacity: selectedRoom ? 1 : 0.5,
              marginBottom: 12,
            }}
          >
            Zoom to Selected Room
          </button>

          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>
            Zoom to circuit
          </div>

          <select
            value={selectedCircuit}
            onChange={(e) => setSelectedCircuit(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <option value="">Select a circuit</option>
            {Object.entries(circuitConfigs).map(([id, cfg]) => (
              <option key={id} value={id}>
                {cfg.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              if (selectedCircuit) zoomToCircuit(selectedCircuit);
            }}
            disabled={!selectedCircuit}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              cursor: selectedCircuit ? "pointer" : "not-allowed",
              opacity: selectedCircuit ? 1 : 0.5,
              marginBottom: 12,
            }}
          >
            Zoom to Selected Circuit
          </button>

          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
            Chatbot commands can dispatch:
            <br />
            <code style={{ color: "#9ad1ff" }}>fly_to_coordinates</code>
            <br />
            <code style={{ color: "#9ad1ff" }}>zoom_to_floor</code>
            <br />
            <code style={{ color: "#9ad1ff" }}>zoom_to_room</code>
            <br />
            <code style={{ color: "#9ad1ff" }}>zoom_to_circuit</code>
            <br />
            <code style={{ color: "#9ad1ff" }}>reset_view</code>
          </div>
        </div>
      )}
    </div>
  );
}
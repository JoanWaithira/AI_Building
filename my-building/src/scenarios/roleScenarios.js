// ─── roleScenarios.js ────────────────────────────────────────────────────────
// Role-specific scenario definitions.
// Each compute(replayData, pvData, tariff, params) is a pure function.
// No React imports — plain JS only.

export const CARBON_FACTOR       = 0.233;   // kg CO2 / kWh (Bulgarian grid)
export const GRID_TARIFF_DEFAULT = 0.22;    // €/kWh
export const WORKING_DAYS_MONTH  = 22;
export const DEMAND_CHARGE       = 8.50;    // € / kW peak demand

// ─── ROLE_SCENARIOS ───────────────────────────────────────────────────────────

export const ROLE_SCENARIOS = {

  // ── DIRECTOR ────────────────────────────────────────────────────────────────
  director: [
    {
      id:       "dir_lights_off",
      emoji:    "💡",
      question: "What if lights turned off after hours?",
      detail:   "Schedule lighting circuits to switch off at a set time every evening automatically.",
      params: [{
        id:      "cutoff",
        label:   "Lights off at",
        type:    "slider",
        min:     19, max: 23, step: 1,
        default: 21,
        unit:    ":00",
      }],
      compute(replayData, pvData, tariff, p) {
        const lightingCircuits = [
          "outsidelighting1",
          "outsidelighting2",
          "3dled",
        ];
        let wasteKwh = 0;
        lightingCircuits.forEach(circ => {
          const frames = replayData?.[circ] ?? [];
          frames.forEach(f => {
            const hour = new Date(f.ts ?? f.timestampMs).getHours();
            if (hour >= p.cutoff) {
              wasteKwh += (f.watts ?? 0) / 1000 * 0.25;
            }
          });
        });
        const monthlySaving = wasteKwh / 2 * 22 * tariff;
        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving:  monthlySaving / tariff * 0.233,
        };
      },
      action: {
        type:  "mailto",
        label: "Request this change",
        href:  "mailto:facilities@gate-sofia.com?subject=Lighting%20schedule%20request",
      },
    },

    {
      id:       "dir_solar_panels",
      emoji:    "☀️",
      question: "What if we added more solar panels?",
      detail:   "Extra panels on the roof generate more free electricity and reduce grid bills.",
      params: [{
        id:      "extra_kwp",
        label:   "Extra capacity",
        type:    "slider",
        min:     5, max: 30, step: 5,
        default: 10,
        unit:    " kWp",
      }],
      compute(replayData, pvData, tariff, p) {
        const peakSunHours    = 4.2;
        const extraDailyKwh   = p.extra_kwp * peakSunHours * 0.19 * 0.86;
        const extraMonthlyKwh = extraDailyKwh * 30;
        const monthlySaving   = extraMonthlyKwh * tariff;
        const hardwareCost    = p.extra_kwp * 950;
        const paybackMonths   = hardwareCost / monthlySaving;
        return {
          monthlySaving,
          paybackMonths,
          hardwareCost,
          carbonSaving: extraMonthlyKwh * 0.233,
        };
      },
      action: {
        type:  "mailto",
        label: "Get a quote",
        href:  "mailto:facilities@gate-sofia.com?subject=Solar%20expansion%20enquiry",
      },
    },

    {
      id:       "dir_weekend_off",
      emoji:    "🏢",
      question: "What if the building was empty this weekend?",
      detail:   "Full shutdown every Saturday and Sunday — only security, server room, and emergency systems stay on.",
      params:   [],
      compute(replayData, pvData, tariff, p) {
        const nonEssential = [
          "circuit7","circuit9","circuit10","circuit11",
          "circuit12","outsidelighting1","outsidelighting2",
          "3dled","airconditioner1","airconditioner2",
          "elevator",
        ];
        let weekendKwh = 0;
        nonEssential.forEach(circ => {
          const frames = replayData?.[circ] ?? [];
          frames.forEach(f => {
            weekendKwh += (f.watts ?? 0) / 1000 * 0.25;
          });
        });
        const monthlySaving = (weekendKwh / 2) * 8 * tariff * 0.75;
        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving: monthlySaving / tariff * 0.233,
        };
      },
      action: {
        type:  "mailto",
        label: "Schedule shutdown",
        href:  "mailto:facilities@gate-sofia.com?subject=Weekend%20shutdown%20request",
      },
    },

    {
      id:       "dir_heating_down",
      emoji:    "🌡",
      question: "What if we lowered heating by 1°C?",
      detail:   "Reducing the heating setpoint by one degree cuts boiler energy use with minimal comfort impact.",
      params: [{
        id:      "degrees",
        label:   "Reduce by",
        type:    "slider",
        min:     1, max: 3, step: 1,
        default: 1,
        unit:    "°C",
      }],
      compute(replayData, pvData, tariff, p) {
        const boilerFrames = replayData?.["boiler"] ??
                             replayData?.["circuit6boiler"] ?? [];
        let boilerKwh48h = 0;
        boilerFrames.forEach(f => {
          boilerKwh48h += (f.watts ?? 0) / 1000 * 0.25;
        });
        const savingFraction = p.degrees * 0.06;
        const monthlySaving  = (boilerKwh48h / 2) * 22 * savingFraction * tariff;
        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving:  monthlySaving / tariff * 0.233,
          comfortImpact: p.degrees === 1
            ? "Most people won't notice 1°C"
            : p.degrees === 2
            ? "Slightly cooler — consider occupant feedback"
            : "Noticeable — discuss with staff first",
        };
      },
      action: {
        type:  "mailto",
        label: "Request setpoint change",
        href:  "mailto:facilities@gate-sofia.com?subject=Heating%20setpoint%20request",
      },
    },
  ],

  // ── FACILITIES ──────────────────────────────────────────────────────────────
  facilities: [
    {
      id:       "fac_lights_off",
      emoji:    "💡",
      question: "What if I set lights to auto-off tonight?",
      detail:   "One schedule change in the BMS cuts wasted electricity every evening from tonight.",
      params: [{
        id:      "cutoff",
        label:   "Lights off at",
        type:    "slider",
        min:     19, max: 23, step: 1,
        default: 21,
        unit:    ":00",
      }],
      compute(replayData, pvData, tariff, p) {
        const lightingCircuits = [
          "outsidelighting1",
          "outsidelighting2",
          "3dled",
        ];
        let wasteKwh = 0;
        lightingCircuits.forEach(circ => {
          const frames = replayData?.[circ] ?? [];
          frames.forEach(f => {
            const hour = new Date(f.ts ?? f.timestampMs).getHours();
            if (hour >= p.cutoff) {
              wasteKwh += (f.watts ?? 0) / 1000 * 0.25;
            }
          });
        });
        const monthlySaving = wasteKwh / 2 * 22 * tariff;
        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving:  monthlySaving / tariff * 0.233,
        };
      },
      action: {
        type:  "mailto",
        label: "Set schedule now",
        href:  "mailto:facilities@gate-sofia.com?subject=Lighting%20schedule%20request",
      },
    },

    {
      id:       "fac_clean_panels",
      emoji:    "☀️",
      question: "What if we clean the solar panels this week?",
      detail:   "Dirty panels lose 10-15% output. A clean typically recovers this within days.",
      params:   [],
      compute(replayData, pvData, tariff, p) {
        const pvFrames = pvData?.pvTotal ?? [];
        const avgPvKw  = pvFrames.length
          ? pvFrames.reduce((s, f) => s + (f.value ?? 0), 0) / pvFrames.length
          : 0;
        const recoveryFraction = 0.12;
        const extraMonthlyKwh  = avgPvKw * recoveryFraction * 24 * 30;
        const monthlySaving    = extraMonthlyKwh * tariff;
        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving:  extraMonthlyKwh * 0.233,
          displayValue:  monthlySaving > 0
            ? `recovers €${monthlySaving.toFixed(0)}/month`
            : "Clean panels for full solar output",
        };
      },
      action: {
        type:  "mailto",
        label: "Schedule panel cleaning",
        href:  "mailto:facilities@gate-sofia.com?subject=Solar%20panel%20cleaning",
      },
    },

    {
      id:       "fac_weekend_off",
      emoji:    "🏢",
      question: "What if I activate weekend shutdown mode?",
      detail:   "Full shutdown every Saturday and Sunday — only security, server room, and emergency systems stay on.",
      params:   [],
      compute(replayData, pvData, tariff, p) {
        const nonEssential = [
          "circuit7","circuit9","circuit10","circuit11",
          "circuit12","outsidelighting1","outsidelighting2",
          "3dled","airconditioner1","airconditioner2",
          "elevator",
        ];
        let weekendKwh = 0;
        nonEssential.forEach(circ => {
          const frames = replayData?.[circ] ?? [];
          frames.forEach(f => {
            weekendKwh += (f.watts ?? 0) / 1000 * 0.25;
          });
        });
        const monthlySaving = (weekendKwh / 2) * 8 * tariff * 0.75;
        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving: monthlySaving / tariff * 0.233,
        };
      },
      action: {
        type:  "mailto",
        label: "Activate shutdown schedule",
        href:  "mailto:facilities@gate-sofia.com?subject=Weekend%20shutdown%20request",
      },
    },

    {
      id:       "fac_heating_down",
      emoji:    "🌡",
      question: "What if I drop the boiler setpoint by 1°C?",
      detail:   "Reducing the heating setpoint by one degree cuts boiler energy use with minimal comfort impact.",
      params: [{
        id:      "degrees",
        label:   "Reduce by",
        type:    "slider",
        min:     1, max: 3, step: 1,
        default: 1,
        unit:    "°C",
      }],
      compute(replayData, pvData, tariff, p) {
        const boilerFrames = replayData?.["boiler"] ??
                             replayData?.["circuit6boiler"] ?? [];
        let boilerKwh48h = 0;
        boilerFrames.forEach(f => {
          boilerKwh48h += (f.watts ?? 0) / 1000 * 0.25;
        });
        const savingFraction = p.degrees * 0.06;
        const monthlySaving  = (boilerKwh48h / 2) * 22 * savingFraction * tariff;
        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving:  monthlySaving / tariff * 0.233,
          comfortImpact: p.degrees === 1
            ? "Most people won't notice 1°C"
            : p.degrees === 2
            ? "Slightly cooler — consider occupant feedback"
            : "Noticeable — discuss with staff first",
        };
      },
      action: {
        type:  "mailto",
        label: "Adjust BMS setpoint",
        href:  "mailto:facilities@gate-sofia.com?subject=Heating%20setpoint%20request",
      },
    },
  ],

  // ── SUSTAINABILITY ──────────────────────────────────────────────────────────
  sustainability: [
    {
      id:       "sus_after_hours",
      emoji:    "🌿",
      question: "What if we fixed the after-hours waste?",
      detail:   "Equipment left running overnight and on weekends is the single fastest carbon win.",
      params:   [],
      compute(replayData, pvData, tariff, p) {
        let wasteKwh = 0;
        Object.entries(replayData ?? {}).forEach(([key, frames]) => {
          if (key === "main") return;
          frames.forEach(f => {
            const hour = new Date(
              f.ts ?? f.timestampMs ?? Date.now()
            ).getHours();
            if (hour < 7 || hour >= 21) {
              wasteKwh += (f.watts ?? 0) / 1000 * 0.25;
            }
          });
        });
        const monthlySaving = (wasteKwh / 2) * 22 * tariff * 0.6;
        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving:  monthlySaving / tariff * 0.233,
        };
      },
      action: {
        type:  "mailto",
        label: "Generate action plan",
        href:  "mailto:facilities@gate-sofia.com?subject=After-hours%20waste%20reduction",
      },
    },

    {
      id:       "sus_solar_panels",
      emoji:    "☀️",
      question: "What if we added more solar panels?",
      detail:   "Extra panels on the roof generate more free electricity and reduce grid bills.",
      params: [{
        id:      "extra_kwp",
        label:   "Extra capacity",
        type:    "slider",
        min:     5, max: 30, step: 5,
        default: 10,
        unit:    " kWp",
      }],
      compute(replayData, pvData, tariff, p) {
        const peakSunHours    = 4.2;
        const extraDailyKwh   = p.extra_kwp * peakSunHours * 0.19 * 0.86;
        const extraMonthlyKwh = extraDailyKwh * 30;
        const monthlySaving   = extraMonthlyKwh * tariff;
        const hardwareCost    = p.extra_kwp * 950;
        const paybackMonths   = hardwareCost / monthlySaving;
        return {
          monthlySaving,
          paybackMonths,
          hardwareCost,
          carbonSaving: extraMonthlyKwh * 0.233,
        };
      },
      action: {
        type:  "mailto",
        label: "Get a quote",
        href:  "mailto:facilities@gate-sofia.com?subject=Solar%20expansion%20enquiry",
      },
    },

    {
      id:       "sus_heating_down",
      emoji:    "🌡",
      question: "What if we lowered heating by 1°C?",
      detail:   "Reducing the heating setpoint by one degree cuts boiler energy use with minimal comfort impact.",
      params: [{
        id:      "degrees",
        label:   "Reduce by",
        type:    "slider",
        min:     1, max: 3, step: 1,
        default: 1,
        unit:    "°C",
      }],
      compute(replayData, pvData, tariff, p) {
        const boilerFrames = replayData?.["boiler"] ??
                             replayData?.["circuit6boiler"] ?? [];
        let boilerKwh48h = 0;
        boilerFrames.forEach(f => {
          boilerKwh48h += (f.watts ?? 0) / 1000 * 0.25;
        });
        const savingFraction = p.degrees * 0.06;
        const monthlySaving  = (boilerKwh48h / 2) * 22 * savingFraction * tariff;
        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving:  monthlySaving / tariff * 0.233,
          comfortImpact: p.degrees === 1
            ? "Most people won't notice 1°C"
            : p.degrees === 2
            ? "Slightly cooler — consider occupant feedback"
            : "Noticeable — discuss with staff first",
        };
      },
      action: {
        type:  "mailto",
        label: "Request setpoint change",
        href:  "mailto:facilities@gate-sofia.com?subject=Heating%20setpoint%20request",
      },
    },
  ],

  // ── IT ──────────────────────────────────────────────────────────────────────
  it: [
    {
      id:       "it_ups_runtime",
      emoji:    "🔋",
      question: "If power fails now, how long do we last?",
      detail:   "Based on current building load and your UPS battery capacity.",
      params: [{
        id:      "battery_kwh",
        label:   "UPS battery",
        type:    "slider",
        min:     5, max: 50, step: 5,
        default: 15,
        unit:    " kWh",
      }],
      compute(replayData, pvData, tariff, p) {
        const mainFrames  = replayData?.["main"] ?? [];
        const latestWatts = mainFrames.length
          ? mainFrames[mainFrames.length - 1]?.watts ?? 15000
          : 15000;
        const criticalKw  = latestWatts * 0.25 / 1000;
        const runtimeH    = (p.battery_kwh * 0.92) / criticalKw;
        const runtimeMins = Math.round(runtimeH * 60);
        return {
          monthlySaving: 0,
          paybackMonths: 0,
          runtimeHours:  runtimeH,
          displayValue:  runtimeMins >= 60
            ? `${Math.floor(runtimeMins / 60)}h ${runtimeMins % 60}m backup`
            : `${runtimeMins} minutes backup`,
          comfortImpact: runtimeH > 4
            ? "Good — exceeds 4h minimum recommendation"
            : runtimeH > 2
            ? "Acceptable — monitor closely"
            : "Risk — consider expanding battery",
        };
      },
      action: {
        type:  "mailto",
        label: "Review UPS spec",
        href:  "mailto:it@gate-sofia.com?subject=UPS%20capacity%20review",
      },
    },

    {
      id:       "it_low_power",
      emoji:    "💾",
      question: "What if servers went to low-power mode at night?",
      detail:   "Reducing server power during off-hours saves energy with minimal operational impact.",
      params: [{
        id:      "saving_pct",
        label:   "Power reduction",
        type:    "slider",
        min:     10, max: 40, step: 5,
        default: 20,
        unit:    "%",
      }],
      compute(replayData, pvData, tariff, p) {
        const serverFrames = replayData?.["circuit8"] ?? [];
        let serverKwh = 0;
        serverFrames.forEach(f => {
          const hour = new Date(
            f.ts ?? f.timestampMs ?? Date.now()
          ).getHours();
          if (hour < 7 || hour >= 21) {
            serverKwh += (f.watts ?? 0) / 1000 * 0.25;
          }
        });
        const monthlySaving = (serverKwh / 2) * 30 * (p.saving_pct / 100) * tariff;
        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving:  monthlySaving / tariff * 0.233,
        };
      },
      action: {
        type:  "mailto",
        label: "Discuss with IT team",
        href:  "mailto:it@gate-sofia.com?subject=Server%20low-power%20mode",
      },
    },
  ],

  // ── WORKER ──────────────────────────────────────────────────────────────────
  worker: [
    {
      id:       "wkr_warmer_morning",
      emoji:    "🌅",
      question: "What if heating started 30 minutes earlier?",
      detail:   "Your room would already be warm when you arrive instead of taking time to heat up.",
      params: [{
        id:      "arrival",
        label:   "I arrive at",
        type:    "slider",
        min:     7, max: 10, step: 1,
        default: 8,
        unit:    ":00",
      }],
      compute(replayData, pvData, tariff, p) {
        return {
          monthlySaving: 0,
          paybackMonths: 0,
          displayValue:  `Warm by ${p.arrival}:00`,
          comfortImpact:
            "Room reaches comfortable temperature before you sit down",
        };
      },
      action: {
        type:  "mailto",
        label: "Request earlier heating",
        href:  "mailto:facilities@gate-sofia.com?subject=Earlier%20heating%20request",
      },
    },

    {
      id:       "wkr_fresher_air",
      emoji:    "💨",
      question: "What if the ventilation was boosted in my room?",
      detail:   "Better air quality reduces tiredness and improves concentration throughout the day.",
      params:   [],
      compute(replayData, pvData, tariff, p) {
        return {
          monthlySaving: 0,
          paybackMonths: 0,
          displayValue:  "Fresher air all day",
          comfortImpact:
            "Studies show 25% better concentration at CO₂ below 800ppm",
        };
      },
      action: {
        type:  "mailto",
        label: "Request ventilation boost",
        href:  "mailto:facilities@gate-sofia.com?subject=Ventilation%20request",
      },
    },
  ],

  // ── EV DRIVER ───────────────────────────────────────────────────────────────
  ev: [
    {
      id:       "ev_solar_charge",
      emoji:    "⚡",
      question: "What if I charged my EV during solar hours?",
      detail:   "Charging when solar panels are generating means using free electricity instead of grid power.",
      params: [{
        id:      "battery_size",
        label:   "My car battery",
        type:    "slider",
        min:     40, max: 100, step: 20,
        default: 60,
        unit:    " kWh",
      }],
      compute(replayData, pvData, tariff, p) {
        const pvFrames = pvData?.pvTotal ?? [];
        const solarSurplusKwh = pvFrames
          .filter(f => {
            const hour = new Date(f.timestampMs ?? Date.now()).getHours();
            return hour >= 10 && hour <= 15;
          })
          .reduce((s, f) => {
            const loadKw = (replayData?.main?.[0]?.watts ?? 15000) / 1000;
            return s + Math.max(0, (f.value ?? 0) - loadKw) * 0.25;
          }, 0);

        const chargeNeeded  = p.battery_size * 0.5;
        const solarCovered  = Math.min(chargeNeeded, solarSurplusKwh * 7.2);
        const gridCovered   = Math.max(0, chargeNeeded - solarCovered);
        const normalCost    = chargeNeeded * tariff;
        const solarCost     = gridCovered * tariff;
        const monthlySaving = (normalCost - solarCost) * 4.3;

        return {
          monthlySaving,
          paybackMonths: 0,
          carbonSaving:  solarCovered * 0.233 * 4.3,
          comfortImpact: "Best solar window: 10:00–15:00",
        };
      },
      action: {
        type:    "cesium",
        label:   "Show solar window",
        command: { type: "set_replay_mode", mode: "solar" },
      },
    },

    {
      id:       "ev_monthly_cost",
      emoji:    "📊",
      question: "What does charging here cost me per month?",
      detail:   "Based on current tariff and typical charging sessions.",
      params: [{
        id:      "sessions",
        label:   "Sessions per week",
        type:    "slider",
        min:     1, max: 5, step: 1,
        default: 3,
        unit:    "×",
      }],
      compute(replayData, pvData, tariff, p) {
        const kwhPerSession  = 20;
        const monthlyKwh     = p.sessions * 4.3 * kwhPerSession;
        const monthlyCost    = monthlyKwh * tariff * 0.5;
        const publicCost     = monthlyKwh * 0.45;
        const vsPublicSaving = publicCost - monthlyCost;
        return {
          monthlySaving: 0,
          paybackMonths: 0,
          displayValue:  `€${monthlyCost.toFixed(0)}/month`,
          comfortImpact:
            `vs public charger: saves €${vsPublicSaving.toFixed(0)}/month`,
        };
      },
      action: null,
    },
  ],

  // ── VISITOR ─────────────────────────────────────────────────────────────────
  visitor: [
    {
      id:       "vis_full_solar",
      emoji:    "☀️",
      question: "What if the whole roof was covered in solar?",
      detail:   "Gate Sofia has enough roof space for up to 45 kWp of solar panels.",
      params: [{
        id:      "coverage",
        label:   "Roof coverage",
        type:    "slider",
        min:     25, max: 100, step: 25,
        default: 100,
        unit:    "%",
      }],
      compute(replayData, pvData, tariff, p) {
        const maxKwp        = 45;
        const scenarioKwp   = maxKwp * p.coverage / 100;
        const dailyKwh      = scenarioKwp * 4.2 * 0.19 * 0.86;
        const monthlyKwh    = dailyKwh * 30;
        const monthlySaving = monthlyKwh * tariff;
        const treesPerYear  = Math.round(monthlyKwh * 0.233 * 12 / 22);
        return {
          monthlySaving,
          paybackMonths: (scenarioKwp * 950) / monthlySaving,
          hardwareCost:  scenarioKwp * 950,
          carbonSaving:  monthlyKwh * 0.233,
          comfortImpact: `Equivalent to planting ${treesPerYear} trees/year`,
        };
      },
      action: {
        type:    "cesium",
        label:   "Show me the building",
        command: { type: "zoom_to_building" },
      },
    },

    {
      id:       "vis_scale_up",
      emoji:    "🌍",
      question: "What if every office in the EU did this?",
      detail:   "There are 4.5 million commercial buildings in Europe.",
      params: [{
        id:      "adoption",
        label:   "Adoption rate",
        type:    "slider",
        min:     1, max: 100, step: 1,
        default: 10,
        unit:    "%",
      }],
      compute(replayData, pvData, tariff, p) {
        const euBuildings   = 4500000;
        const adopted       = euBuildings * p.adoption / 100;
        const savingPerBldg = 0.15;
        const avgKwhYear    = 350000;
        const totalTwh      = adopted * avgKwhYear * savingPerBldg / 1e9;
        const carbonMt      = totalTwh * 0.233;
        const homesEquiv    = Math.round(totalTwh * 1e9 / 3500);
        return {
          monthlySaving: 0,
          paybackMonths: 0,
          displayValue:  `${totalTwh.toFixed(0)} TWh saved/year`,
          comfortImpact:
            `That's enough to power ${(homesEquiv / 1e6).toFixed(1)}M homes — ` +
            `${carbonMt.toFixed(0)}M tonnes CO₂ avoided`,
        };
      },
      action: null,
    },
  ],
};

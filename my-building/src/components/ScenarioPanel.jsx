import { useEffect, useMemo, useState } from "react";
import { GRID_TARIFF_DEFAULT, ROLE_SCENARIOS } from "../scenarios/roleScenarios.js";

function formatCurrency(value) {
  const abs = Math.abs(value ?? 0);
  return `EUR ${abs.toFixed(0)}`;
}

// The getRoleScenarioHint function provides a short description for each user role, explaining the purpose of the scenarios in that role's dashboard. It returns a specific hint based on the role or a default message if the role is not recognized.
function getRoleScenarioHint(role) {
  const hints = {
    director: "These scenarios estimate business impact for common building decisions.",
    facilities: "These scenarios show practical building changes and their likely effect.",
    sustainability: "These scenarios estimate carbon and energy improvements from likely actions.",
    it: "These scenarios focus on resilience, backup time, and IT energy behavior.",
    worker: "These scenarios explain likely comfort changes for day-to-day occupants.",
    ev: "These scenarios estimate charging cost and solar-charging opportunities.",
    visitor: "These scenarios explain the building in a simpler, public-facing way.",
  };

  return hints[role] ?? "These scenarios estimate what could happen if one building setting changes.";
}

// The getScenariosForRole function retrieves the list of scenarios associated with a specific user role. It looks up the scenarios in the ROLE_SCENARIOS object and returns them. If the role is not found, it falls back to the visitor scenarios or an empty array.
function getScenariosForRole(role) {
  return ROLE_SCENARIOS[role] ?? ROLE_SCENARIOS.visitor ?? [];
}
// The buildDefaultParams function takes a scenario object and constructs an object containing the default parameter values for that scenario. It iterates over the scenario's parameters and creates key-value pairs where the key is the parameter ID and the value is the parameter's default value.
function buildDefaultParams(scenario) {
  return Object.fromEntries((scenario.params ?? []).map((param) => [param.id, param.default]));
}
// The getScenarioExplanation function provides detailed explanations for each scenario based on its ID. 
// It returns an object containing a summary and specific explanations for different aspects of the scenario, such as how monthly savings are calculated, carbon impact, investment, payback, and comfort implications. If the scenario ID is not recognized, it returns a fallback explanation using the scenario's detail property.

function getPrimaryAnswer(result) {
  if (!result) return "-";
  if (result.monthlySaving > 0) return `saves ${formatCurrency(result.monthlySaving)}/month`;
  if (result.monthlySaving < 0) return `costs ${formatCurrency(result.monthlySaving)}/month extra`;
  if (result.runtimeHours) return `${result.runtimeHours.toFixed(1)} hours backup`;
  if (result.displayValue) return result.displayValue;
  return "No financial impact";
}
//getSupportLines takes a scenario result object and generates an array of supporting text lines that provide additional context and details about the scenario's impact. 
// It checks for various properties in the result, such as monthly savings, payback period, carbon savings, and comfort impact, and constructs informative lines based on those values. The function ensures that no more than two lines are returned to keep the information concise and focused on the most relevant details.

function getSupportLines(result) {
  if (!result) return [];

  const lines = [];

  if (result.monthlySaving > 0) {
    lines.push(`That is about ${formatCurrency(result.monthlySaving * 12)} per year.`);
  }

  if (result.paybackMonths > 0 && result.paybackMonths < 120) {
    if (result.paybackMonths < 1) {
      lines.push("Payback is effectively immediate.");
    } else if (result.paybackMonths < 12) {
      lines.push(`Payback is about ${result.paybackMonths.toFixed(0)} months.`);
    } else {
      lines.push(`Payback is about ${(result.paybackMonths / 12).toFixed(1)} years.`);
    }
  } else if (result.paybackMonths === 0) {
    lines.push("No extra hardware cost is assumed for this scenario.");
  }

  if (result.carbonSaving > 0 && lines.length < 2) {
    lines.push(`It avoids about ${result.carbonSaving.toFixed(0)} kg CO2 each month.`);
  }

  if (result.comfortImpact && lines.length < 2) {
    lines.push(result.comfortImpact);
  }

  return lines.slice(0, 2);
}

function getAnswerColor(result) {
  if (result?.monthlySaving > 0) return "#4ADE80";
  if (result?.monthlySaving < 0) return "#EF4444";
  if (result?.runtimeHours) return "#7DD3FC";
  return "#F8FAFC";
}

function getScenarioExplanation(scenario, paramValues, tariff) {
  const fallback = {
    summary: scenario.detail,
    monthly: "This monthly figure is produced directly by the scenario's compute function using the selected slider values and current tariff.",
    carbon: "Carbon impact is estimated from the energy impact multiplied by the building's grid carbon factor.",
    investment: "Investment is shown only when the scenario assumes new hardware or a capital cost.",
    payback: "Payback compares the assumed upfront cost with the estimated monthly savings.",
    comfort: "Comfort notes are a plain-language explanation of the likely occupant impact.",
  };

  switch (scenario.id) {
    case "dir_lights_off":
    case "fac_lights_off":
      return {
        summary: `This checks lighting energy after ${paramValues.cutoff}:00 on the monitored lighting circuits. Each 15-minute reading after the cutoff is converted from watts to kWh, scaled from the 48-hour replay window to a typical working month, then multiplied by the tariff of EUR ${tariff.toFixed(2)}/kWh.`,
        monthly: "Monthly saving = after-hours lighting kWh in replay data / 2 x 22 working days x tariff.",
        carbon: "Carbon saved = avoided kWh x 0.233 kg CO2 per kWh.",
        investment: "No hardware cost is assumed because this is modeled as a scheduling change.",
        payback: "Payback is immediate because the scenario assumes no new equipment cost.",
      };
    case "dir_solar_panels":
    case "sus_solar_panels":
      return {
        summary: `This estimates extra solar generation from ${paramValues.extra_kwp} kWp of added PV. The model uses 4.2 peak sun hours, 19% panel efficiency, and 86% system efficiency to convert added capacity into daily and monthly energy.`,
        monthly: "Monthly saving = extra monthly solar kWh x tariff.",
        carbon: "Carbon saved = extra monthly solar kWh x 0.233 kg CO2 per kWh.",
        investment: "Investment = added solar capacity x EUR 950 per kWp.",
        payback: "Payback months = hardware cost / monthly saving.",
      };
    case "dir_weekend_off":
    case "fac_weekend_off":
      return {
        summary: "This totals selected non-essential circuits and assumes those loads could be reduced during weekend shutdown mode. The replay energy is scaled to a monthly weekend pattern and then discounted to 75% realizable savings.",
        monthly: "Monthly saving = non-essential replay kWh / 2 x 8 weekend days x tariff x 0.75.",
        carbon: "Carbon saved = avoided kWh x 0.233 kg CO2 per kWh.",
        investment: "No hardware investment is assumed for this operational scheduling change.",
        payback: "Payback is immediate because this is modeled as a process change.",
      };
    case "dir_heating_down":
    case "fac_heating_down":
    case "sus_heating_down":
      return {
        summary: `This uses boiler replay data and assumes each degree of setpoint reduction saves about 6% of boiler energy. The slider is currently set to ${paramValues.degrees} degree(s).`,
        monthly: "Monthly saving = boiler replay kWh / 2 x 22 working days x savings fraction x tariff.",
        carbon: "Carbon saved = avoided boiler kWh x 0.233 kg CO2 per kWh.",
        investment: "No hardware cost is assumed if the building management system already supports the setpoint change.",
        payback: "Payback is immediate because the scenario assumes no capex.",
        comfort: "Comfort text reflects a simple rule of thumb: lower setpoints save more energy but may be noticed more by occupants.",
      };
    case "fac_clean_panels":
      return {
        summary: "This uses average PV production in the replay data and assumes cleaning recovers about 12% of lost output. That recovered energy is converted into a monthly bill reduction at the current tariff.",
        monthly: "Monthly saving = average PV output x 12% recovery x 24 hours x 30 days x tariff.",
        carbon: "Carbon saved = recovered PV energy x 0.233 kg CO2 per kWh.",
        investment: "No capex is shown because this is treated as maintenance rather than new equipment.",
        payback: "No payback is shown because no hardware purchase is assumed.",
      };
    case "sus_after_hours":
      return {
        summary: "This scans all replayed circuits outside the main meter and totals energy used before 07:00 or after 21:00. It assumes only part of that load is truly avoidable, so the result applies a 60% savings factor.",
        monthly: "Monthly saving = after-hours replay kWh / 2 x 22 days x tariff x 0.6.",
        carbon: "Carbon saved = avoided kWh x 0.233 kg CO2 per kWh.",
        investment: "No hardware investment is included in this estimate.",
        payback: "Payback is immediate because the scenario models an operational fix.",
      };
    case "it_ups_runtime":
      return {
        summary: `This compares the selected UPS battery size of ${paramValues.battery_kwh} kWh to the latest main building load. The model assumes 92% usable battery efficiency.`,
        monthly: "There is no monthly saving here. The headline value is runtime based on usable battery energy divided by current critical load.",
        carbon: "No carbon figure is emphasized because this scenario is about resilience rather than energy reduction.",
        investment: "No investment is shown because this scenario is sizing and checking runtime, not purchasing a system in the card itself.",
        payback: "No payback is shown because the card does not estimate a hardware purchase cost.",
        comfort: "The status note compares the estimated runtime against simple resilience thresholds.",
      };
    case "it_low_power":
      return {
        summary: `This sums server-circuit energy during off-hours and applies the selected power-reduction percentage of ${paramValues.saving_pct}%.`,
        monthly: "Monthly saving = off-hours server replay kWh / 2 x 30 days x reduction percentage x tariff.",
        carbon: "Carbon saved = avoided IT energy x 0.233 kg CO2 per kWh.",
        investment: "No new hardware cost is assumed for this operating-mode change.",
        payback: "Payback is immediate because no capex is included.",
      };
    case "wkr_warmer_morning":
      return {
        summary: `This is a comfort scenario rather than an energy-saving one. The slider simply changes the arrival time, and the card explains the likely comfort outcome if heating starts earlier.`,
        monthly: "No monthly saving is calculated because this scenario focuses on comfort, not cost reduction.",
        comfort: "The comfort note is a qualitative explanation rather than a meter-based formula.",
      };
    case "wkr_fresher_air":
      return {
        summary: "This is a comfort scenario. It does not estimate energy savings and instead explains the likely occupant benefit from stronger ventilation.",
        monthly: "No monthly saving is calculated for this scenario.",
        comfort: "The comfort note is a qualitative rule-of-thumb explanation tied to better air quality.",
      };
    case "ev_solar_charge":
      return {
        summary: `This compares EV charging demand with solar surplus between 10:00 and 15:00. The model estimates how much of a half battery charge could be covered by on-site solar instead of grid electricity.`,
        monthly: "Monthly saving = normal charging cost - solar-shifted charging cost, scaled to about 4.3 weeks per month.",
        carbon: "Carbon saved = solar-covered charging energy x 0.233 kg CO2 per kWh x 4.3 weeks.",
        comfort: "The note highlights the best charging window for matching the building's solar production.",
      };
    case "ev_monthly_cost":
      return {
        summary: `This assumes around 20 kWh per charging session and multiplies that by ${paramValues.sessions} session(s) per week over about 4.3 weeks per month.`,
        monthly: "Monthly charging cost = sessions x 4.3 x 20 kWh x tariff x 0.5.",
        comfort: "The comparison note explains the estimated saving versus a public charger price assumption.",
      };
    case "vis_full_solar":
      return {
        summary: `This assumes the roof can support up to 45 kWp of solar and the slider is currently set to ${paramValues.coverage}% coverage. Generation is estimated from solar capacity, sun hours, and system efficiency.`,
        monthly: "Monthly saving = estimated monthly solar generation x tariff.",
        carbon: "Carbon saved = estimated monthly solar generation x 0.233 kg CO2 per kWh.",
        investment: "Investment = installed solar capacity x EUR 950 per kWp.",
        payback: "Payback = hardware cost / monthly saving.",
        comfort: "The trees comparison is a simple public-facing equivalence based on annual carbon impact.",
      };
    case "vis_scale_up":
      return {
        summary: `This is a scale illustration, not a site calculation. It assumes ${paramValues.adoption}% of 4.5 million EU commercial buildings adopt a 15% annual energy saving on an average annual demand of 350,000 kWh.`,
        monthly: "The headline value is annual TWh saved, not monthly savings for this single building.",
        carbon: "Carbon avoided is the scaled energy saving multiplied by the same 0.233 kg CO2 per kWh factor.",
        comfort: "The homes-powered figure is a public-facing equivalence to make the scale easier to understand.",
      };
    default:
      return fallback;
  }
}

function buildMetricItems(result) {
  const items = [];

  if (typeof result?.monthlySaving === "number") {
    items.push({
      key: "monthly",
      label: "Monthly impact",
      value: result.monthlySaving === 0 ? "No change" : `${result.monthlySaving > 0 ? "Saves" : "Costs"} ${formatCurrency(result.monthlySaving)}`,
    });
  }

  if (typeof result?.carbonSaving === "number" && result.carbonSaving > 0) {
    items.push({
      key: "carbon",
      label: "Carbon",
      value: `${result.carbonSaving.toFixed(0)} kg CO2/month`,
    });
  }

  if (typeof result?.hardwareCost === "number" && result.hardwareCost > 0) {
    items.push({
      key: "investment",
      label: "Investment",
      value: formatCurrency(result.hardwareCost),
    });
  }

  if (typeof result?.paybackMonths === "number" && result.paybackMonths > 0 && Number.isFinite(result.paybackMonths)) {
    items.push({
      key: "payback",
      label: "Payback",
      value: result.paybackMonths < 12
        ? `${result.paybackMonths.toFixed(0)} months`
        : `${(result.paybackMonths / 12).toFixed(1)} years`,
    });
  }

  if (typeof result?.runtimeHours === "number" && result.runtimeHours > 0) {
    items.push({
      key: "monthly",
      label: "Backup time",
      value: `${result.runtimeHours.toFixed(1)} hours`,
    });
  }

  if (result?.comfortImpact) {
    items.push({
      key: "comfort",
      label: "Comfort note",
      value: result.comfortImpact,
    });
  }

  return items.slice(0, 4);
}
// The combineScenarioResults function takes an array of individual scenario results and 
// aggregates them into a single combined result. It sums up the monthly savings, carbon savings, hardware costs, and runtime hours across all scenarios. It also collects comfort notes into an array. The paybackMonths field is set to 0 in the combined result, as it may not be meaningful to aggregate payback periods across different scenarios.
function combineScenarioResults(results) {
  return results.reduce((combined, result) => ({
    monthlySaving: combined.monthlySaving + (result?.monthlySaving ?? 0),
    carbonSaving: combined.carbonSaving + (result?.carbonSaving ?? 0),
    hardwareCost: combined.hardwareCost + (result?.hardwareCost ?? 0),
    paybackMonths: 0,
    runtimeHours: combined.runtimeHours + (result?.runtimeHours ?? 0),
    comfortNotes: [
      ...combined.comfortNotes,
      ...(result?.comfortImpact ? [result.comfortImpact] : []),
    ],
  }), {
    monthlySaving: 0,
    carbonSaving: 0,
    hardwareCost: 0,
    paybackMonths: 0,
    runtimeHours: 0,
    comfortNotes: [],
  });
}

function InfoButton({ onClick, active, title = "Show explanation" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: `1px solid ${active ? "rgba(125,211,252,0.55)" : "rgba(125,211,252,0.25)"}`,
        background: active ? "rgba(125,211,252,0.18)" : "rgba(15,23,42,0.75)",
        color: active ? "#E0F2FE" : "#7DD3FC",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      i
    </button>
  );
}

function ExplanationPanel({ title, text }) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(8,15,28,0.92)",
        border: "1px solid rgba(125,211,252,0.18)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "#BAE6FD", marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 10, color: "#CBD5E1", lineHeight: 1.6 }}>
        {text}
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario,
  replayData,
  pvData,
  tariff,
  paramValues,
  setParamValues,
  isApplied,
  onToggleApply,
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeInfo, setActiveInfo] = useState(null);

  const result = useMemo(() => {
    try {
      return scenario.compute(replayData, pvData, tariff, paramValues);
    } catch {
      return null;
    }
  }, [paramValues, pvData, replayData, scenario, tariff]);

  const explanation = useMemo(
    () => getScenarioExplanation(scenario, paramValues, tariff),
    [paramValues, scenario, tariff]
  );

  const metricItems = buildMetricItems(result);
  const primaryAnswer = getPrimaryAnswer(result);
  const supportLines = getSupportLines(result);
  const answerColor = getAnswerColor(result);

  const activeExplanation = activeInfo ? explanation[activeInfo] ?? explanation.summary : null;
  const activeExplanationTitle = {
    summary: "What this scenario means",
    monthly: "How this value is calculated",
    carbon: "How carbon impact is calculated",
    investment: "How investment is calculated",
    payback: "How payback is calculated",
    comfort: "How this comfort note should be read",
  }[activeInfo] ?? "Scenario explanation";

  return (
    <div
      style={{
        background: "rgba(15,23,42,0.82)",
        border: "1px solid rgba(125,211,252,0.12)",
        borderRadius: 12,
        marginBottom: 10,
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(2,8,23,0.18)",
      }}
    >
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 16, lineHeight: 1.1, marginTop: 1 }}>{scenario.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#F1F5F9", lineHeight: 1.4 }}>
              {scenario.question}
            </div>
          </div>
          <InfoButton
            active={activeInfo === "summary"}
            onClick={() => setActiveInfo((current) => (current === "summary" ? null : "summary"))}
            title="Explain this scenario"
          />
        </div>

        {scenario.params?.length >= 1 && (() => {
          const param = scenario.params[0];

          if (param.type === "slider") {
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: "#94A3B8", minWidth: 88 }}>{param.label}</span>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={paramValues[param.id]}
                  onChange={(event) => setParamValues({
                    ...paramValues,
                    [param.id]: Number(event.target.value),
                  })}
                  style={{ flex: 1, accentColor: "#7DD3FC" }}
                />
                <span style={{ fontSize: 10, color: "#7DD3FC", minWidth: 48, textAlign: "right" }}>
                  {paramValues[param.id]}{param.unit}
                </span>
              </div>
            );
          }

          if (param.type === "toggle") {
            return (
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {param.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setParamValues({ ...paramValues, [param.id]: option })}
                    style={{
                      flex: 1,
                      padding: "5px 0",
                      fontSize: 10,
                      borderRadius: 5,
                      border: "1px solid rgba(125,211,252,0.22)",
                      background: paramValues[param.id] === option ? "rgba(125,211,252,0.15)" : "transparent",
                      color: paramValues[param.id] === option ? "#7DD3FC" : "#94A3B8",
                      cursor: "pointer",
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            );
          }

          return null;
        })()}

        <div style={{ fontSize: 22, fontWeight: 700, color: answerColor, marginBottom: 6, letterSpacing: "-0.02em" }}>
          {primaryAnswer}
        </div>

        {supportLines.map((line, index) => (
          <div key={index} style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.5 }}>
            {line}
          </div>
        ))}

        {metricItems.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
            {metricItems.map((item) => (
              <div
                key={`${scenario.id}-${item.label}`}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(125,211,252,0.08)",
                  borderRadius: 8,
                  padding: "7px 8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: "#94A3B8", flex: 1 }}>{item.label}</div>
                  <InfoButton
                    active={activeInfo === item.key}
                    onClick={() => setActiveInfo((current) => (current === item.key ? null : item.key))}
                    title={`Explain ${item.label}`}
                  />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#E2E8F0", lineHeight: 1.4 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeExplanation && <ExplanationPanel title={activeExplanationTitle} text={activeExplanation} />}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={onToggleApply}
            style={{
              padding: "6px 12px",
              fontSize: 10,
              borderRadius: 6,
              border: isApplied ? "1px solid rgba(74,222,128,0.32)" : "1px solid rgba(125,211,252,0.24)",
              background: isApplied ? "rgba(22,101,52,0.24)" : "rgba(15,23,42,0.68)",
              color: isApplied ? "#86EFAC" : "#E2E8F0",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {isApplied ? "Remove from model" : "Add to model"}
          </button>
          {scenario.action && (
            <button
              type="button"
              onClick={() => {
                if (scenario.action.type === "mailto") {
                  window.location.href = scenario.action.href;
                } else if (scenario.action.type === "cesium") {
                  window.dispatchEvent(new CustomEvent("cesium-command", { detail: scenario.action.command }));
                }
              }}
              style={{
                padding: "6px 12px",
                fontSize: 10,
                borderRadius: 6,
                border: "1px solid rgba(125,211,252,0.3)",
                background: "rgba(125,211,252,0.08)",
                color: "#7DD3FC",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {scenario.action.label} -&gt;
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "#94A3B8",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            {expanded ? "Less details ^" : "Details v"}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            padding: "10px 14px 12px",
            fontSize: 10,
            color: "#CBD5E1",
            lineHeight: 1.6,
            background: "rgba(2,6,23,0.25)",
          }}
        >
          <div style={{ marginBottom: 8 }}>{scenario.detail}</div>

          {(scenario.params?.length ?? 0) > 1 && (
            <div style={{ marginTop: 8 }}>
              {scenario.params.slice(1).map((param) => (
                <div key={param.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 9, color: "#94A3B8", minWidth: 90 }}>{param.label}</span>
                  {param.type === "slider" ? (
                    <>
                      <input
                        type="range"
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        value={paramValues[param.id]}
                        onChange={(event) => setParamValues({
                          ...paramValues,
                          [param.id]: Number(event.target.value),
                        })}
                        style={{ flex: 1, accentColor: "#7DD3FC" }}
                      />
                      <span style={{ fontSize: 9, color: "#7DD3FC", minWidth: 40, textAlign: "right" }}>
                        {paramValues[param.id]}{param.unit}
                      </span>
                    </>
                  ) : null}
                  {param.type === "toggle" ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      {param.options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setParamValues({ ...paramValues, [param.id]: option })}
                          style={{
                            padding: "2px 6px",
                            fontSize: 9,
                            borderRadius: 4,
                            border: "1px solid rgba(125,211,252,0.18)",
                            background: paramValues[param.id] === option ? "rgba(125,211,252,0.12)" : "transparent",
                            color: paramValues[param.id] === option ? "#7DD3FC" : "#94A3B8",
                            cursor: "pointer",
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {result && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 8, paddingTop: 8 }}>
              {result.monthlySaving > 0 && <div>Annual saving: {formatCurrency(result.monthlySaving * 12)}</div>}
              {result.carbonSaving > 0 && <div>Carbon impact: {result.carbonSaving.toFixed(0)} kg CO2/month avoided</div>}
              {result.hardwareCost > 0 && <div>Investment required: {formatCurrency(result.hardwareCost)}</div>}
              {result.displayValue && <div>Display value: {result.displayValue}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScenarioGuide() {
  const rows = [
    ["Question", "The scenario title says what change is being tested."],
    ["Slider or toggle", "This lets you change the assumption used in the estimate."],
    ["Primary answer", "This is the main result, such as monthly savings, runtime, or a comfort outcome."],
    ["Metric boxes", "These break the result into cost, carbon, investment, payback, or comfort."],
    ["Info buttons", "Click any i button to see how that specific value is calculated."],
    ["Details", "This opens the longer explanation and any extra controls or result lines."],
  ];

  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(125,211,252,0.05)",
        border: "1px solid rgba(125,211,252,0.14)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#E2E8F0", marginBottom: 6 }}>
        How to read the scenario cards
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4 }}>
        {rows.map(([label, text]) => (
          <div key={label} style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.5 }}>
            <span style={{ color: "#CBD5E1", fontWeight: 700 }}>{label}:</span> {text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScenarioPanel({
  replayDataRef,
  pvDataRef,
  tariffRate,
  activeRoleProp,
  setTariffRate,
  occupancyLevel,
  setOccupancyLevel,
  carbonPrice,
  setCarbonPrice,
  scenarioGoal,
  setScenarioGoal,
  appliedScenarios,
  setAppliedScenarios,
  scenarioResult,
  setScenarioResult,
}) {
  void setTariffRate;
  void occupancyLevel;
  void setOccupancyLevel;
  void carbonPrice;
  void setCarbonPrice;
  void scenarioGoal;
  void setScenarioGoal;
  void scenarioResult;

  const activeRole = activeRoleProp ?? "visitor";
  const tariff = tariffRate ?? GRID_TARIFF_DEFAULT;
  const scenarios = getScenariosForRole(activeRole);
  const [scenarioParams, setScenarioParams] = useState({});

  const appliedScenarioIds = appliedScenarios ?? [];

  const getScenarioParams = (scenario) => scenarioParams[scenario.id] ?? buildDefaultParams(scenario);

  const setScenarioParamValues = (scenarioId, values) => {
    setScenarioParams((current) => ({
      ...current,
      [scenarioId]: values,
    }));
  };

  const toggleScenario = (scenarioId) => {
    const update = appliedScenarioIds.includes(scenarioId)
      ? appliedScenarioIds.filter((id) => id !== scenarioId)
      : [...appliedScenarioIds, scenarioId];

    setAppliedScenarios?.(update);
  };

  /* eslint-disable react-hooks/refs */
  const replayData = replayDataRef?.current;
  const pvData = pvDataRef?.current;
  /* eslint-enable react-hooks/refs */

  /* eslint-disable react-hooks/refs */
  const combinedResult = combineScenarioResults(
    scenarios
      .filter((scenario) => appliedScenarioIds.includes(scenario.id))
      .map((scenario) => {
        try {
          return scenario.compute(replayData, pvData, tariff, getScenarioParams(scenario));
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    setScenarioResult?.(combinedResult);
  }, [combinedResult, setScenarioResult]);

  return (
    <>
      <div
        style={{
          fontSize: 10,
          color: "#94A3B8",
          marginBottom: 10,
          padding: "8px 10px",
          background: "rgba(125,211,252,0.04)",
          border: "1px solid rgba(125,211,252,0.1)",
          borderRadius: 8,
          lineHeight: 1.5,
        }}
      >
        {getRoleScenarioHint(activeRole)}
      </div>

      <ScenarioGuide />
      {/* eslint-disable react-hooks/refs */}
      {scenarios.map((scenario) => (
        <ScenarioCard
          key={scenario.id}
          scenario={scenario}
          replayData={replayData}
          pvData={pvData}
          tariff={tariff}
          paramValues={getScenarioParams(scenario)}
          setParamValues={(values) => setScenarioParamValues(scenario.id, values)}
          isApplied={appliedScenarioIds.includes(scenario.id)}
          onToggleApply={() => toggleScenario(scenario.id)}
        />
      ))}
      {appliedScenarioIds.length > 0 && (
        <div
          style={{
            marginTop: 12,
            marginBottom: 10,
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(10,18,32,0.92)",
            border: "1px solid rgba(74,222,128,0.26)",
          }}
        >
          <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4 }}>
            {appliedScenarioIds.length === 1 ? "1 scenario added to the model" : `${appliedScenarioIds.length} scenarios added to the model`}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: combinedResult.monthlySaving >= 0 ? "#4ADE80" : "#FBBF24", marginBottom: 6 }}>
            {combinedResult.monthlySaving >= 0 ? "Combined saving" : "Combined cost"} {formatCurrency(combinedResult.monthlySaving)}/month
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 9px" }}>
              <div style={{ fontSize: 9, color: "#94A3B8" }}>Annual impact</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>{formatCurrency(combinedResult.monthlySaving * 12)}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 9px" }}>
              <div style={{ fontSize: 9, color: "#94A3B8" }}>Carbon</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>{combinedResult.carbonSaving.toFixed(0)} kg CO2/month</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 9px" }}>
              <div style={{ fontSize: 9, color: "#94A3B8" }}>Investment</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>{combinedResult.hardwareCost > 0 ? formatCurrency(combinedResult.hardwareCost) : "None"}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 9px" }}>
              <div style={{ fontSize: 9, color: "#94A3B8" }}>Backup time</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>{combinedResult.runtimeHours > 0 ? `${combinedResult.runtimeHours.toFixed(1)} hours` : "Not used"}</div>
            </div>
          </div>
          {combinedResult.comfortNotes.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 10, color: "#CBD5E1", lineHeight: 1.5 }}>
              Comfort and notes: {combinedResult.comfortNotes.join(" | ")}
            </div>
          )}
          <button
            type="button"
            onClick={() => setAppliedScenarios?.([])}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "7px 10px",
              borderRadius: 7,
              border: "1px solid rgba(248,113,113,0.28)",
              background: "rgba(127,29,29,0.22)",
              color: "#FCA5A5",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear model
          </button>
        </div>
      )}
      {!replayData?.main?.length && (
        <div
          style={{
            textAlign: "center",
            padding: "16px 0",
            color: "#475569",
            fontSize: 10,
          }}
        >
          Play the Energy tab first to load building data for data-based estimates.
        </div>
      )}
      {/* eslint-enable react-hooks/refs */}
    </>
  );
}



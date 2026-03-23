import { useMemo, useState } from "react";
// import { ROLE_SCENARIOS, GRID_TARIFF_DEFAULT } from "../scenarios/roleScenarios.js";

// function getRoleScenarioHint(role) {
//   const hints = {
//     director: "Financial impact of building decisions",
//     facilities: "Changes you can make today",
//     sustainability: "Carbon and energy improvements",
//     it: "Resilience and efficiency",
//     worker: "Your comfort at work",
//     ev: "Your charging costs",
//     visitor: "What this building means at scale",
//   };

//   return hints[role] ?? "What-if scenarios for Gate Sofia";
// }

// function getScenariosForRole(role) {
//   return ROLE_SCENARIOS[role] ?? ROLE_SCENARIOS.visitor;
// }

// function buildDefaultParams(scenario) {
//   return Object.fromEntries((scenario.params ?? []).map((param) => [param.id, param.default]));
// }

// export default function ScenarioPanel({
//   replayDataRef,
//   pvDataRef,
//   tariffRate,
//   activeRoleProp,
//   setTariffRate,
//   occupancyLevel,
//   setOccupancyLevel,
//   carbonPrice,
//   setCarbonPrice,
//   scenarioGoal,
//   setScenarioGoal,
//   appliedScenarios,
//   setAppliedScenarios,
//   scenarioResult,
//   setScenarioResult,
// }) {
//   void setTariffRate;
//   void occupancyLevel;
//   void setOccupancyLevel;
//   void carbonPrice;
//   void setCarbonPrice;
//   void scenarioGoal;
//   void setScenarioGoal;
//   void appliedScenarios;
//   void setAppliedScenarios;
//   void scenarioResult;
//   void setScenarioResult;

//   const activeRole = activeRoleProp ?? "visitor";
//   const tariff = tariffRate ?? GRID_TARIFF_DEFAULT;
//   const [expandedScenarios, setExpandedScenarios] = useState({});
//   const [scenarioParams, setScenarioParams] = useState({});

//   const ScenarioCard = ({ scenario, replayData, pvData }) => {
//     const paramValues = scenarioParams[scenario.id] ?? buildDefaultParams(scenario);
//     const expanded = expandedScenarios[scenario.id] ?? false;

//     const setScenarioParam = (paramId, value) => {
//       setScenarioParams((current) => ({
//         ...current,
//         [scenario.id]: {
//           ...buildDefaultParams(scenario),
//           ...(current[scenario.id] ?? {}),
//           [paramId]: value,
//         },
//       }));
//     };

//     const result = useMemo(() => {
//       try {
//         return scenario.compute(replayData, pvData, tariff, paramValues);
//       } catch {
//         return null;
//       }
//     }, [paramValues, pvData, replayData, scenario]);

//     const primaryAnswer = (() => {
//       if (!result) return "-";
//       if (result.monthlySaving > 0) {
//         return `saves EUR ${result.monthlySaving.toFixed(0)}/month`;
//       }
//       if (result.monthlySaving < 0) {
//         return `costs EUR ${Math.abs(result.monthlySaving).toFixed(0)}/month extra`;
//       }
//       if (result.runtimeHours) {
//         return `${result.runtimeHours.toFixed(1)} hours backup`;
//       }
//       if (result.displayValue) {
//         return result.displayValue;
//       }
//       return "No financial impact";
//     })();

//     const supportLines = (() => {
//       if (!result) return [];
//       const lines = [];

//       if (result.monthlySaving > 0) {
//         lines.push(`That's EUR ${(result.monthlySaving * 12).toFixed(0)} per year`);
//       }

//       if (result.paybackMonths > 0 && result.paybackMonths < 120) {
//         lines.push(
//           result.paybackMonths < 1
//             ? "Payback: immediate"
//             : result.paybackMonths < 12
//               ? `Payback: ${result.paybackMonths.toFixed(0)} months`
//               : `Payback: ${(result.paybackMonths / 12).toFixed(1)} years`
//         );
//       } else if (result.paybackMonths === 0) {
//         lines.push("Payback: immediate - no hardware needed");
//       }

//       if (result.carbonSaving > 0 && lines.length < 2) {
//         lines.push(`Saves ${result.carbonSaving.toFixed(0)} kg CO2/month`);
//       }

//       if (result.comfortImpact && lines.length < 2) {
//         lines.push(result.comfortImpact);
//       }

//       return lines.slice(0, 2);
//     })();

//     const answerColor =
//       result?.monthlySaving > 0 ? "#4ADE80" :
//       result?.monthlySaving < 0 ? "#EF4444" :
//       result?.runtimeHours ? "#7DD3FC" :
//       "#F8FAFC";

//     return (
//       <div
//         style={{
//           background: "rgba(15,23,42,0.8)",
//           border: "1px solid rgba(125,211,252,0.12)",
//           borderRadius: 10,
//           marginBottom: 8,
//           overflow: "hidden",
//         }}
//       >
//         <div style={{ padding: "12px 14px" }}>
//           <div
//             style={{
//               fontSize: 12,
//               fontWeight: 600,
//               color: "#F1F5F9",
//               lineHeight: 1.4,
//               marginBottom: 10,
//             }}
//           >
//             {scenario.emoji} {scenario.question}
//           </div>

//           {scenario.params?.length >= 1 && (() => {
//             const param = scenario.params[0];

//             if (param.type === "slider") {
//               return (
//                 <div
//                   style={{
//                     display: "flex",
//                     alignItems: "center",
//                     gap: 8,
//                     marginBottom: 10,
//                   }}
//                 >
//                   <span style={{ fontSize: 10, color: "#475569", minWidth: 80 }}>
//                     {param.label}
//                   </span>
//                   <input
//                     type="range"
//                     min={param.min}
//                     max={param.max}
//                     step={param.step}
//                     value={paramValues[param.id]}
//                     onChange={(event) => setScenarioParam(param.id, Number(event.target.value))}
//                     style={{ flex: 1, accentColor: "#7DD3FC" }}
//                   />
//                   <span
//                     style={{
//                       fontSize: 10,
//                       color: "#7DD3FC",
//                       minWidth: 40,
//                       textAlign: "right",
//                     }}
//                   >
//                     {paramValues[param.id]}{param.unit}
//                   </span>
//                 </div>
//               );
//             }

//             if (param.type === "toggle") {
//               return (
//                 <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
//                   {param.options.map((option) => (
//                     <button
//                       key={option}
//                       onClick={() => setScenarioParam(param.id, option)}
//                       style={{
//                         flex: 1,
//                         padding: "4px 0",
//                         fontSize: 10,
//                         borderRadius: 4,
//                         border: "1px solid rgba(125,211,252,0.2)",
//                         background: paramValues[param.id] === option
//                           ? "rgba(125,211,252,0.15)"
//                           : "transparent",
//                         color: paramValues[param.id] === option ? "#7DD3FC" : "#475569",
//                         cursor: "pointer",
//                       }}
//                     >
//                       {option}
//                     </button>
//                   ))}
//                 </div>
//               );
//             }

//             return null;
//           })()}

//           <div
//             style={{
//               fontSize: 22,
//               fontWeight: 700,
//               color: answerColor,
//               marginBottom: 4,
//               letterSpacing: "-0.02em",
//             }}
//           >
//             {primaryAnswer}
//           </div>

//           {supportLines.map((line, index) => (
//             <div key={index} style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>
//               {line}
//             </div>
//           ))}

//           <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
//             {scenario.action && (
//               <button
//                 onClick={() => {
//                   if (scenario.action.type === "mailto") {
//                     window.location.href = scenario.action.href;
//                   } else if (scenario.action.type === "cesium") {
//                     window.dispatchEvent(
//                       new CustomEvent("cesium-command", { detail: scenario.action.command })
//                     );
//                   }
//                 }}
//                 style={{
//                   padding: "5px 12px",
//                   fontSize: 10,
//                   borderRadius: 5,
//                   border: "1px solid rgba(125,211,252,0.3)",
//                   background: "rgba(125,211,252,0.08)",
//                   color: "#7DD3FC",
//                   cursor: "pointer",
//                   fontWeight: 500,
//                 }}
//               >
//                 {scenario.action.label} -&gt;
//               </button>
//             )}

//             <button
//               onClick={() => setExpandedScenarios((current) => ({
//                 ...current,
//                 [scenario.id]: !expanded,
//               }))}
//               style={{
//                 marginLeft: "auto",
//                 fontSize: 9,
//                 color: "#334155",
//                 background: "transparent",
//                 border: "none",
//                 cursor: "pointer",
//                 padding: "4px 0",
//               }}
//             >
//               {expanded ? "Less ^" : "Details v"}
//             </button>
//           </div>
//         </div>

//         {expanded && (
//           <div
//             style={{
//               borderTop: "1px solid rgba(255,255,255,0.05)",
//               padding: "10px 14px",
//               fontSize: 10,
//               color: "#64748B",
//               lineHeight: 1.6,
//             }}
//           >
//             {scenario.detail}

//             {(scenario.params?.length ?? 0) > 1 && (
//               <div style={{ marginTop: 8 }}>
//                 {scenario.params.slice(1).map((param) => (
//                   <div
//                     key={param.id}
//                     style={{
//                       display: "flex",
//                       alignItems: "center",
//                       gap: 8,
//                       marginBottom: 6,
//                     }}
//                   >
//                     <span style={{ fontSize: 9, color: "#475569", minWidth: 90 }}>
//                       {param.label}
//                     </span>
//                     {param.type === "slider" ? (
//                       <>
//                         <input
//                           type="range"
//                           min={param.min}
//                           max={param.max}
//                           step={param.step}
//                           value={paramValues[param.id]}
//                           onChange={(event) => setScenarioParam(param.id, Number(event.target.value))}
//                           style={{ flex: 1, accentColor: "#7DD3FC" }}
//                         />
//                         <span
//                           style={{
//                             fontSize: 9,
//                             color: "#7DD3FC",
//                             minWidth: 36,
//                             textAlign: "right",
//                           }}
//                         >
//                           {paramValues[param.id]}{param.unit}
//                         </span>
//                       </>
//                     ) : null}
//                     {param.type === "toggle" ? (
//                       <div style={{ display: "flex", gap: 3 }}>
//                         {param.options.map((option) => (
//                           <button
//                             key={option}
//                             onClick={() => setScenarioParam(param.id, option)}
//                             style={{
//                               padding: "2px 6px",
//                               fontSize: 9,
//                               borderRadius: 3,
//                               border: "1px solid rgba(125,211,252,0.15)",
//                               background: paramValues[param.id] === option
//                                 ? "rgba(125,211,252,0.12)"
//                                 : "transparent",
//                               color: paramValues[param.id] === option ? "#7DD3FC" : "#475569",
//                               cursor: "pointer",
//                             }}
//                           >
//                             {option}
//                           </button>
//                         ))}
//                       </div>
//                     ) : null}
//                   </div>
//                 ))}
//               </div>
//             )}

//             {result && (
//               <div
//                 style={{
//                   marginTop: 8,
//                   borderTop: "1px solid rgba(255,255,255,0.04)",
//                   paddingTop: 8,
//                 }}
//               >
//                 {result.monthlySaving > 0 && (
//                   <div>Annual saving: EUR {(result.monthlySaving * 12).toFixed(0)}</div>
//                 )}
//                 {result.carbonSaving > 0 && (
//                   <div>Carbon: {result.carbonSaving.toFixed(0)} kg CO2/month avoided</div>
//                 )}
//                 {result.hardwareCost > 0 && (
//                   <div>Investment required: EUR {result.hardwareCost.toFixed(0)}</div>
//                 )}
//               </div>
//             )}
//           </div>
//         )}
//       </div>
//     );
//   };

//   return (
//     <>
//       <div
//         style={{
//           fontSize: 10,
//           color: "#475569",
//           marginBottom: 8,
//           padding: "6px 10px",
//           background: "rgba(125,211,252,0.05)",
//           border: "1px solid rgba(125,211,252,0.1)",
//           borderRadius: 6,
//         }}
//       >
//         {getRoleScenarioHint(activeRole)}
//       </div>

//       {getScenariosForRole(activeRole).map((scenario) => (
//         <ScenarioCard
//           key={scenario.id}
//           scenario={scenario}
//           replayData={replayDataRef?.current}
//           pvData={pvDataRef?.current}
//         />
//       ))}

//       {!replayDataRef?.current?.main?.length && (
//         <div
//           style={{
//             textAlign: "center",
//             padding: "16px 0",
//             color: "#334155",
//             fontSize: 10,
//           }}
//         >
//           Play the Energy tab first to load building data
//         </div>
//       )}
//     </>
//   );
// }

// ─── ScenarioPanel ────────────────────────────────────────────────────────────
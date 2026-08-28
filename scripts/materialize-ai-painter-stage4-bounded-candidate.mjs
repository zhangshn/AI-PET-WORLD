import { materializeStage4BoundedCandidate } from "./lib/ai-painter-stage4-bounded-candidate-planner-v1.mjs";

const args = process.argv.slice(2);
const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const required = (name) => { const result = value(name); if (!result) throw new Error(`${name} is required`); return result; };
const roles = {
  original64: "--original-64-terminal",
  autoencoder: "--autoencoder-terminal",
  conditionFusion: "--condition-fusion-terminal",
  capacity: "--capacity-terminal",
  threeComponent: "--three-component-terminal",
};
const sourceEvidence = Object.entries(roles).map(([role, option]) => ({ role, path: required(option), sha256: required(`${option}-sha256`) }));
const result = materializeStage4BoundedCandidate({ capabilityVersion: required("--capability-version"), sourceEvidence });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);


import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const file = (value) => {
  assert.ok(value, "project_relative_path_required");
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`);
  assert.equal(value.split(/[\\/]/).includes(".."), false, `parent_traversal_rejected:${value}`);
  const target = path.resolve(ROOT, value);
  assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`);
  return target;
};
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/");
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex");
const bind = (value) => ({ path: rel(value), sha256: sha(value) });

const runId = arg("--run-id");
assert.match(runId ?? "", /^[a-zA-Z0-9][a-zA-Z0-9._-]{7,159}$/, "run_id_invalid");
const sourceArguments = {
  terminal: "--terminal",
  review: "--review",
  finalization: "--finalization",
  sourceCpuReport: "--source-cpu-report",
  terrainManifest: "--terrain-manifest",
  objectManifest: "--object-manifest",
  finalManifest: "--final-manifest",
};
const sourceEvidence = {};
for (const [role, option] of Object.entries(sourceArguments)) {
  const target = file(arg(option));
  assert.equal(fs.existsSync(target) && fs.statSync(target).isFile(), true, `${role}_missing`);
  assert.equal(/\.(pt|pth|ckpt|safetensors)$/iu.test(target), false, `${role}_checkpoint_forbidden`);
  sourceEvidence[role] = bind(target);
}
const programs = {
  runner: file("scripts/run-stage4-three-component-smoke-failure-boundary-adjudication-v2.mjs"),
  checker: file("scripts/check-stage4-three-component-smoke-failure-boundary-adjudication-v2.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-three-component-smoke-failure-boundary-adjudication.mjs"),
};
const packageDirectory = file(`.runtime/ai-painter/stage4-three-component-smoke-failure-boundary-local-packages/${runId}`);
assert.equal(fs.existsSync(packageDirectory), false, "local_package_directory_already_exists");
fs.mkdirSync(path.dirname(packageDirectory), { recursive: true });
fs.mkdirSync(packageDirectory, { recursive: false });
const packagePath = path.join(packageDirectory, "package.json");
const taskPackage = {
  schemaVersion: "stage4-three-component-smoke-failure-boundary-local-package-v2",
  status: "package_materialized",
  generatedBy: "local_ai_pet_world_program",
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  action: "stage4_three_component_smoke_failure_boundary_causal_adjudication",
  runId,
  sourceEvidence,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-three-component-smoke-failure-boundary-adjudications-v2/${runId}`,
  directWiringDefectEvidence: false,
  finalErasureComparisonEvidence: false,
  checkpointWeightsReadAllowed: false,
  gpuAllowed: false,
  optimizerAllowed: false,
  backwardAllowed: false,
  trainingAllowed: false,
  materializedAtUtc: new Date().toISOString(),
};
const handle = fs.openSync(packagePath, "wx");
try {
  fs.writeFileSync(handle, `${JSON.stringify(taskPackage, null, 2)}\n`, "utf8");
  fs.fsyncSync(handle);
} finally {
  fs.closeSync(handle);
}
process.stdout.write(`${JSON.stringify({
  ok: true,
  status: "local_internal_package_materialized_without_owner_authorization",
  package: bind(packagePath),
  outputNamespace: taskPackage.outputNamespace,
  ownerAuthorizationRequired: false,
}, null, 2)}\n`);

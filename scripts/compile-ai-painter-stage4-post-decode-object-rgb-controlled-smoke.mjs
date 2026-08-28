import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";

const root = process.cwd();
const capabilityVersion = required("--capability-version");
assert.match(capabilityVersion, /^[a-z0-9][a-z0-9-]{7,127}$/u);
const lifecyclePath = inside(
  `.runtime/ai-painter/capability-lifecycle/${capabilityVersion}/state.json`,
);
const lifecycle = read(lifecyclePath);
assert.equal(lifecycle.state, "readonly_gpu_qualified");
const candidateRoot = inside(
  `.runtime/ai-painter/stage4-post-decode-object-rgb-candidates/${capabilityVersion}`,
);
const gpuRoot = inside(
  ".runtime/ai-painter/stage4-post-decode-object-rgb-readonly-gpu",
);
const gpuTerminals = fs
  .readdirSync(gpuRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(gpuRoot, entry.name, "phase-terminal.json"))
  .filter((file) => fs.existsSync(file))
  .map((file) => ({ file, value: read(file) }))
  .filter(
    ({ value }) =>
      value.capabilityVersion === capabilityVersion &&
      value.status === "readonly_gpu_qualified",
  );
assert.equal(
  gpuTerminals.length,
  1,
  "qualified GPU terminal identity is not unique",
);
const contractPath = path.join(candidateRoot, "controlled-smoke-contract.json");
assert.equal(
  fs.existsSync(contractPath),
  false,
  "controlled Smoke contract already exists",
);
const contract = {
  schemaVersion: "stage4-post-decode-object-rgb-controlled-smoke-contract-v1",
  status: "compiled_not_started",
  capabilityVersion,
  architectureId: "stage4_post_decode_authoritative_object_rgb_compositor_v1",
  modeId: "post_decode_object_rgb_stage4_smoke",
  sampleId:
    "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
  sampleSplit: "validation",
  seed: 20263722,
  requiredBoundarySides: ["west"],
  resolution: { width: 256, height: 192 },
  epochCount: 30,
  previewEpochs: [1, 5, 10, 20, 30],
  initialization: "fixed_project_random_post_decode_object_rgb",
  frozenBoundaries: {
    approvedDataAndSplit: true,
    conditionChannelsAndOrder: true,
    autoencoder: true,
    lossValuesAndWeights: true,
    checkpointFormat: true,
    machineReviewThresholds: true,
  },
  automaticClosure: {
    previewByteReproduction: true,
    machineReview: true,
    lateStabilityQualification: true,
    finalization: true,
    eventLedgerAndSqlite: true,
  },
  automaticRetryAllowed: false,
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  sourceEvidence: {
    cpuTerminal: bind(path.join(candidateRoot, "phase-terminal.json")),
    inactiveConfig: bind(path.join(candidateRoot, "inactive-config.json")),
    cpuReport: bind(path.join(candidateRoot, "cpu-report.json")),
    readonlyGpuTerminal: bind(gpuTerminals[0].file),
  },
  recordedAtUtc: new Date().toISOString(),
};
writeJsonAtomic(contractPath, contract);
appendAiPainterProgramEvent({
  id: `stage4-post-decode-object-rgb-smoke-contract-${capabilityVersion}`,
  timestamp: new Date().toISOString(),
  action: "stage4_post_decode_object_rgb_controlled_smoke_contract_compiled",
  runId: capabilityVersion,
  kind: "local_autonomous_controlled_smoke_compilation",
  status: "success",
  title: "Stage4 post-decode object RGB controlled Smoke compiled",
  titleZh: "Stage4解码后对象RGB候选受控Smoke合同已编译",
  detailZh:
    "训练、预览复现、机器审核、后期稳定裁决和终态记录已绑定为同一自主执行包。",
  evidencePath: relative(contractPath),
  evidenceSha256: sha(contractPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
});
process.stdout.write(
  `${JSON.stringify({ status: "compiled_not_started", capabilityVersion, contract: bind(contractPath), ownerAuthorizationRequired: false }, null, 2)}\n`,
);

function required(flag) {
  const index = process.argv.indexOf(flag);
  assert(index >= 0 && process.argv[index + 1], `missing ${flag}`);
  return process.argv[index + 1];
}
function inside(rel) {
  assert.equal(path.isAbsolute(rel), false);
  assert.equal(rel.split(/[\\/]/u).includes(".."), false);
  const value = path.resolve(root, rel);
  assert.ok(value.startsWith(`${path.resolve(root)}${path.sep}`));
  return value;
}
function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}
function sha(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}
function bind(file) {
  return { path: relative(file), sha256: sha(file) };
}

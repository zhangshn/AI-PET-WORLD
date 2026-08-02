import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const slotId = argumentValue("--slot-id");
const PREVIOUS_AUTHORIZATION_ID =
  "owner-authorized-thailand-rebuild64-complete-batch-generation-20260731";
const AUTHORIZATION_ID = argumentValue("--owner-authorization-id");
const OWNER_AUTHORIZED_RETRY = process.argv.includes("--owner-authorized-retry");
const RETRY_REASON = argumentValue("--retry-reason");
const RETRY_REPAIR_MANIFEST = argumentValue("--retry-repair-manifest");
const RETRY_REPAIR_PACKAGE = RETRY_REPAIR_MANIFEST
  ? readJson(RETRY_REPAIR_MANIFEST)
  : null;
const EFFECTIVE_RETRY_REASON = RETRY_REPAIR_PACKAGE?.retryReason ?? RETRY_REASON;
assert(
  /^v7-capacity-slot-(14[6-9]|1[5-9][0-9]|20[0-9])$/.test(slotId ?? ""),
  "slot-id must be a Thailand rebuild64 slot",
);
assert(
  AUTHORIZATION_ID && AUTHORIZATION_ID !== PREVIOUS_AUTHORIZATION_ID,
  "RGB generation remains paused after the full-world upgrade; a new post-regression owner authorization id is required",
);
if (OWNER_AUTHORIZED_RETRY) {
  assert(
    EFFECTIVE_RETRY_REASON?.trim(),
    "an explicit retry reason is required for owner-authorized replacement of historical slot requests",
  );
  assert(
    RETRY_REPAIR_MANIFEST,
    "an owner-authorized Thailand replacement retry requires a structured repair manifest",
  );
}

const auditPointer = readJson(
  ".runtime/ai-painter/earth-geospatial-v7-capacity-146-209-complete-framework-audits/latest.json",
);
assert(
  auditPointer.status ===
    "all_64_packages_passed_full_world_dynamic_readiness_framework_standard" &&
    auditPointer.rebuildRequiredPackageCount === 0 &&
    auditPointer.hardFailurePairCount === 0 &&
    auditPointer.attentionPairCount === 0 &&
    auditPointer.semanticRouteTopologyDuplicatePairCount === 0 &&
    auditPointer.semanticWaterNetworkTypeDuplicatePairCount === 0 &&
    auditPointer.semanticCompleteSkeletonDuplicatePairCount === 0 &&
    auditPointer.semanticTopologyContractPath ===
      "data/ai-painter/system-governance/complete-map-semantic-topology-diversity-contract-v1.json",
  "current 64-package complete-framework and semantic-topology audit is not fully passed",
);
const audit = readJson(auditPointer.runPath);
const selected = audit.selectedPackages.find((entry) => entry.slotId === slotId);
assert(selected, `selected current condition package missing: ${slotId}`);
assert(
  selected.semanticTopologySignature?.schemaVersion ===
    "complete-map-semantic-topology-signature-v1",
  `semantic topology signature missing from current 64-package audit: ${slotId}`,
);
const conditionRun = readJson(selected.manifestPath);
const taskDir = path.dirname(resolve(conditionRun.taskPath));
const taskManifestPath = path.join(taskDir, "task-manifest.json");
const guideManifestPath = path.join(
  taskDir,
  "compiled-conditions",
  "condition-guide-manifest.json",
);
if (!fs.existsSync(guideManifestPath)) {
  runNode("scripts/build-current-world-condition-guide.mjs", [
    "--task",
    conditionRun.taskPath,
    "--condition-pack",
    conditionRun.conditionPackPath,
  ]);
}

const taskManifest = readJson(taskManifestPath);
const existing = readRequests().find(
  (request) =>
    request.status === "ready_for_openai_assisted_generation" &&
    request.sourceRecordId === slotId &&
    request.conditionLabel === taskManifest.conditionLabel &&
    (
      request.conditionPackId === readJson(conditionRun.conditionPackPath).conditionPackId ||
      readJson(request.promptEvidencePath).conditionPackId ===
        readJson(conditionRun.conditionPackPath).conditionPackId
    ),
);
let request;
if (existing) {
  assert(
    existing.status === "ready_for_openai_assisted_generation",
    `current condition already has a non-active request: ${existing.status}`,
  );
  request = existing;
} else {
  const requestArgs = [
    "--v7-slot-task-manifest",
    normalize(path.relative(ROOT, taskManifestPath)),
    "--owner-authorization-id",
    AUTHORIZATION_ID,
  ];
  if (OWNER_AUTHORIZED_RETRY) {
    requestArgs.push("--owner-authorized-retry", "--retry-reason", EFFECTIVE_RETRY_REASON.trim());
    requestArgs.push("--retry-repair-manifest", RETRY_REPAIR_MANIFEST);
  }
  const created = runNode(
    "scripts/build-ai-assisted-conditional-rgb-generation-request.mjs",
    requestArgs,
  );
  runNode("scripts/check-ai-assisted-conditional-rgb-request.mjs", [
    "--request",
    created.requestPath,
  ]);
  request = readJson(created.requestPath);
}
const evidence = readJson(request.promptEvidencePath);
const guideManifest = readJson(request.conditionGuideManifestPath);
console.log(
  JSON.stringify({
    status: request.status,
    slotId,
    requestId: request.requestId,
    outputRecordId: request.outputRecordId,
    requestPath: normalize(path.relative(ROOT, resolve(request.requestPath ?? path.join(path.dirname(resolve(request.promptEvidencePath)), "request.json")))),
    promptEvidencePath: request.promptEvidencePath,
    conditionGuidePath: normalize(resolve(guideManifest.guidePath)),
    promptSha256: request.promptEvidenceSha256,
    promptLength: evidence.prompt.length,
  }),
);

function readRequests() {
  const root = path.join(
    ROOT,
    ".runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests",
  );
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const requestPath = path.join(root, entry.name, "request.json");
      if (!fs.existsSync(requestPath)) return [];
      try {
        return [{ ...readJson(requestPath), requestPath: normalize(path.relative(ROOT, requestPath)) }];
      } catch {
        return [];
      }
    });
}

function runNode(script, args) {
  const child = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (child.status !== 0) {
    throw new Error(child.stderr || child.stdout || `${script} exited ${child.status}`);
  }
  return JSON.parse(child.stdout);
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolve(value), "utf8"));
}

function resolve(value) {
  const absolute = path.resolve(ROOT, value);
  assert(
    absolute === ROOT || absolute.startsWith(`${ROOT}${path.sep}`),
    `path escapes project: ${value}`,
  );
  return absolute;
}

function normalize(value) {
  return value.replaceAll("\\", "/");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

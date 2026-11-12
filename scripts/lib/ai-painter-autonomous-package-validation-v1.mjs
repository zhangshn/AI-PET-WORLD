import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Read-only contract and byte-binding validation. No adapter import or execution.
export const CLOSED_LOOP_CONTRACT_PATH =
  "data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json";

export const PHASES = Object.freeze([
  "preflight", "execute", "validate", "review", "adjudicate", "finalize",
]);

export const FORBIDDEN_OWNER_TOKENS = [
  "waiting_owner_authorization", "waiting_owner_decision", "owner-action-request.json",
  "owner-decision-request.json", "owner_authorization_required", "owner_signature_required",
];

export function loadClosedLoopContract(root = process.cwd()) {
  const evidence = readBoundJson(root, CLOSED_LOOP_CONTRACT_PATH);
  const value = evidence.value;
  assert(value?.schemaVersion === "ai-painter-autonomous-closed-loop-contract-v1", "closed-loop contract schema mismatch");
  assert(value?.status === "active", "closed-loop contract is not active");
  assert(value?.authority === "local_ai_pet_world_program", "local AI authority mismatch");
  assert(value?.ownerInNormalStateMachine === false, "Owner must not be in the normal state machine");
  assert(value?.perTaskOwnerAuthorizationRequired === false, "per-task Owner authorization must be false");
  assert(value?.perStageOwnerAuthorizationRequired === false, "per-stage Owner authorization must be false");
  assert(canonical(value.normalPhaseOrder) === canonical(PHASES), "closed-loop phase order mismatch");
  assert(value?.terminalRules?.ownerWaitStateAllowed === false, "Owner wait states must be forbidden");
  assert(value?.terminalRules?.ownerRequestArtifactAllowed === false, "Owner request artifacts must be forbidden");
  return evidence;
}

export function validateClosedLoopPackage(spec, { root = process.cwd(), packageSha256 } = {}) {
  loadClosedLoopContract(root);
  assert(spec?.schemaVersion === "ai-painter-autonomous-closed-loop-package-v1", "package schema mismatch");
  assert(/^[a-z0-9][a-z0-9-]{7,127}$/.test(spec.packageIdentity ?? ""), "package identity is invalid");
  assertHex(packageSha256, "package SHA-256");
  assert(typeof spec.capabilityVersion === "string" && spec.capabilityVersion.length >= 3, "capabilityVersion is invalid");
  assert(spec.ownerAuthorizationRequired === false, "closed-loop package cannot require Owner authorization");
  assert(spec.ownerInStateMachine === false, "closed-loop package cannot place Owner in its state machine");
  assert(Number.isInteger(spec.maxInfrastructureRecoveryAttempts) && spec.maxInfrastructureRecoveryAttempts >= 0 && spec.maxInfrastructureRecoveryAttempts <= 3, "infrastructure recovery limit is invalid");
  validateRelativeRuntimeRoot(spec.outputRoot, "outputRoot");
  assert(spec.programLineage && Object.keys(spec.programLineage).length > 0, "programLineage is required");
  for (const [role, digest] of Object.entries(spec.programLineage)) {
    assert(/^[A-Za-z0-9._-]+$/.test(role), "programLineage role is invalid");
    assertHex(digest, `programLineage.${role}`);
  }
  assert(Array.isArray(spec.inputEvidence) && spec.inputEvidence.length > 0, "inputEvidence is required");
  for (const evidence of spec.inputEvidence) verifyBoundFile(root, evidence);
  assert(spec.phaseAdapters && typeof spec.phaseAdapters === "object", "phaseAdapters are required");
  assert(canonical(Object.keys(spec.phaseAdapters).sort()) === canonical([...PHASES].sort()), "phase adapter set mismatch");
  const serialized = JSON.stringify(spec).toLowerCase();
  for (const token of FORBIDDEN_OWNER_TOKENS) assert(!serialized.includes(token), `forbidden Owner runtime token: ${token}`);
  for (const phase of PHASES) validateAdapterBinding(root, phase, spec.phaseAdapters[phase]);
  const canonicalPackageSha256 = sha256(Buffer.from(`${JSON.stringify(spec, null, 2)}\n`, "utf8"));
  assert(canonicalPackageSha256 === packageSha256, "package SHA-256 does not bind the supplied package bytes");
  return true;
}

function validateAdapterBinding(root, phase, binding) {
  assert(binding?.kind === "project_module_export", `${phase} adapter kind is invalid`);
  assert(typeof binding.exportName === "string" && /^[A-Za-z_$][\w$]*$/.test(binding.exportName), `${phase} exportName is invalid`);
  const absolutePath = resolveExistingProjectFile(root, binding.path);
  assertHex(binding.sha256, `${phase} adapter SHA-256`);
  assert(sha256File(absolutePath) === binding.sha256, `${phase} adapter SHA-256 mismatch`);
  const source = fs.readFileSync(absolutePath, "utf8").toLowerCase();
  for (const token of FORBIDDEN_OWNER_TOKENS) assert(!source.includes(token), `${phase} adapter contains forbidden Owner token: ${token}`);
}

function verifyBoundFile(root, binding) {
  assert(binding && typeof binding === "object", "evidence binding is invalid");
  const absolutePath = resolveExistingProjectFile(root, binding.path);
  assertHex(binding.sha256, "evidence SHA-256");
  assert(sha256File(absolutePath) === binding.sha256, `evidence SHA-256 mismatch: ${binding.path}`);
}

function readBoundJson(root, relativePath) {
  const absolutePath = resolveExistingProjectFile(root, relativePath);
  const bytes = fs.readFileSync(absolutePath);
  return { value: JSON.parse(bytes.toString("utf8")), path: relativePath, sha256: sha256(bytes) };
}

export function resolveExistingProjectFile(root, relativePath) {
  assert(typeof relativePath === "string" && relativePath.length > 0, "project-relative path is required");
  assert(!path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath), "absolute paths are forbidden");
  const absolutePath = resolveInsideRoot(root, relativePath);
  assert(fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(), `file does not exist: ${relativePath}`);
  return absolutePath;
}

export function resolveInsideRoot(root, relativePath) {
  const projectRoot = path.resolve(root);
  const absolutePath = path.resolve(projectRoot, relativePath);
  assert(absolutePath.startsWith(`${projectRoot}${path.sep}`), `path escapes project root: ${relativePath}`);
  return absolutePath;
}

function validateRelativeRuntimeRoot(value, label) {
  assert(typeof value === "string" && value.startsWith(".runtime/ai-painter/") && !value.includes("..") && !value.includes("\\"), `${label} must be a normalized AI Painter runtime path`);
}

export function sha256File(filePath) { return sha256(fs.readFileSync(filePath)); }

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }

export function canonical(value) { return JSON.stringify(value); }

function assertHex(value, label) { assert(typeof value === "string" && /^[a-f0-9]{64}$/.test(value), `${label} is invalid`); }

export function assert(condition, message) { if (!condition) throw new Error(message); }

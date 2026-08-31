import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateClosedLoopPackage } from "./ai-painter-autonomous-closed-loop-v1.mjs";

export const AUTONOMOUS_PACKAGE_ROOT = ".runtime/ai-painter/autonomous-closed-loop-packages";

export function materializeAutonomousClosedLoopPackage(candidate, {
  root = process.cwd(), recordedAtUtc = new Date().toISOString(),
  recoverExistingExact = false,
  _testHooks = null,
} = {}) {
  validateCandidate(candidate);
  const programLineage = Object.fromEntries(Object.entries(candidate.programFiles).map(([role, relativePath]) => [
    role, sha256File(resolveExistingFile(root, relativePath)),
  ]));
  const inputEvidence = candidate.inputEvidencePaths.map((relativePath) => ({
    path: normalize(relativePath), sha256: sha256File(resolveExistingFile(root, relativePath)),
  }));
  const phaseAdapters = Object.fromEntries(Object.entries(candidate.phaseAdapters).map(([phase, binding]) => [phase, {
    kind: "project_module_export", path: normalize(binding.path),
    sha256: sha256File(resolveExistingFile(root, binding.path)), exportName: binding.exportName,
  }]));
  const spec = {
    schemaVersion: "ai-painter-autonomous-closed-loop-package-v1",
    packageIdentity: candidate.packageIdentity,
    capabilityVersion: candidate.capabilityVersion,
    ownerAuthorizationRequired: false,
    ownerInStateMachine: false,
    maxInfrastructureRecoveryAttempts: candidate.maxInfrastructureRecoveryAttempts,
    outputRoot: normalize(candidate.outputRoot),
    programLineage,
    inputEvidence,
    phaseAdapters,
    recordedAtUtc,
    materializedBy: "local_ai_painter_autonomous_package_materializer",
  };
  const bytes = Buffer.from(`${JSON.stringify(spec, null, 2)}\n`, "utf8");
  const packageSha256 = sha256(bytes);
  validateClosedLoopPackage(spec, { root, packageSha256 });

  const relativeRoot = `${AUTONOMOUS_PACKAGE_ROOT}/${spec.packageIdentity}`;
  const absoluteRoot = resolveInsideRoot(root, relativeRoot);
  fs.mkdirSync(path.dirname(absoluteRoot), { recursive: true });
  if (fs.existsSync(absoluteRoot)) {
    assert(recoverExistingExact,
      "autonomous package identity already exists");
    assert(fs.statSync(absoluteRoot).isDirectory(),
      "autonomous package identity is not a directory");
  } else {
    fs.mkdirSync(absoluteRoot, { recursive: false });
  }
  if (typeof _testHooks?.afterPackageRootCreated === "function") {
    _testHooks.afterPackageRootCreated({ absoluteRoot, packageIdentity: spec.packageIdentity });
  }
  const packagePath = path.join(absoluteRoot, "package.json");
  const manifestPath = path.join(absoluteRoot, "manifest.json");
  const manifestBytes = Buffer.from(`${JSON.stringify({
    schemaVersion: "ai-painter-autonomous-closed-loop-package-manifest-v1",
    status: "materialized_not_started", packageIdentity: spec.packageIdentity,
    packagePath: `${relativeRoot}/package.json`, packageSha256,
    ownerAuthorizationRequired: false, ownerResponseRequired: false,
    recordedAtUtc,
  }, null, 2)}\n`, "utf8");
  persistExactFile(packagePath, bytes, { recoverExistingExact });
  if (typeof _testHooks?.afterPackagePersisted === "function") {
    _testHooks.afterPackagePersisted({ packagePath, packageSha256 });
  }
  persistExactFile(manifestPath, manifestBytes, { recoverExistingExact });
  return {
    packageIdentity: spec.packageIdentity,
    packagePath: `${relativeRoot}/package.json`, packageSha256,
    manifestPath: `${relativeRoot}/manifest.json`,
    ownerAuthorizationRequired: false,
  };
}

function persistExactFile(targetPath, bytes, { recoverExistingExact }) {
  if (fs.existsSync(targetPath)) {
    assert(recoverExistingExact,
      `autonomous package file already exists: ${path.basename(targetPath)}`);
    assert(fs.statSync(targetPath).isFile(),
      `autonomous package path is not a file: ${path.basename(targetPath)}`);
    assert(fs.readFileSync(targetPath).equals(bytes),
      `autonomous package recovery bytes differ: ${path.basename(targetPath)}`);
    return;
  }
  const stagedPath = `${targetPath}.staged`;
  if (fs.existsSync(stagedPath)) {
    assert(fs.statSync(stagedPath).isFile(),
      `autonomous package staged path is invalid: ${path.basename(stagedPath)}`);
    assert(fs.readFileSync(stagedPath).equals(bytes),
      `autonomous package staged bytes differ: ${path.basename(targetPath)}`);
  } else {
    const descriptor = fs.openSync(stagedPath, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, bytes);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  }
  try {
    fs.linkSync(stagedPath, targetPath);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    assert(fs.readFileSync(targetPath).equals(bytes),
      `autonomous package concurrent recovery bytes differ: ${path.basename(targetPath)}`);
  }
  fs.unlinkSync(stagedPath);
}

function validateCandidate(candidate) {
  assert(candidate?.schemaVersion === "ai-painter-autonomous-closed-loop-candidate-v1", "candidate schema mismatch");
  assert(/^[a-z0-9][a-z0-9-]{7,127}$/.test(candidate.packageIdentity ?? ""), "candidate package identity is invalid");
  assert(typeof candidate.capabilityVersion === "string" && candidate.capabilityVersion.length >= 3, "candidate capabilityVersion is invalid");
  assert(candidate.ownerAuthorizationRequired === false, "candidate cannot require Owner authorization");
  assert(Number.isInteger(candidate.maxInfrastructureRecoveryAttempts) && candidate.maxInfrastructureRecoveryAttempts >= 0 && candidate.maxInfrastructureRecoveryAttempts <= 3, "candidate recovery limit is invalid");
  assert(typeof candidate.outputRoot === "string" && candidate.outputRoot.startsWith(".runtime/ai-painter/") && !candidate.outputRoot.includes("..") && !candidate.outputRoot.includes("\\"), "candidate outputRoot is invalid");
  assert(candidate.programFiles && Object.keys(candidate.programFiles).length > 0, "candidate programFiles are required");
  assert(Array.isArray(candidate.inputEvidencePaths) && candidate.inputEvidencePaths.length > 0, "candidate evidence paths are required");
  assert(candidate.phaseAdapters && typeof candidate.phaseAdapters === "object", "candidate phase adapters are required");
}

function resolveExistingFile(root, relativePath) {
  assert(typeof relativePath === "string" && relativePath.length > 0 && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath), "candidate path must be project-relative");
  const absolute = resolveInsideRoot(root, relativePath);
  assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `candidate file is missing: ${relativePath}`);
  return absolute;
}
function resolveInsideRoot(root, relativePath) {
  const projectRoot = path.resolve(root);
  const absolute = path.resolve(projectRoot, relativePath);
  assert(absolute.startsWith(`${projectRoot}${path.sep}`), `candidate path escapes project root: ${relativePath}`);
  return absolute;
}
function normalize(value) { return value.replaceAll("\\", "/"); }
function sha256File(filePath) { return sha256(fs.readFileSync(filePath)); }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function assert(condition, message) { if (!condition) throw new Error(message); }

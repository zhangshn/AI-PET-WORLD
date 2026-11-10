// Shared registry inspection: no weather implementation imports and no release writes.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
export const TRUSTED_RELEASE_REGISTRY_SCHEMA = "ai-painter-capability-release-registry-v2";

export const TRUSTED_RELEASE_REGISTRY_PATH = "data/ai-painter/system-governance/ai-painter-capability-release-registry-v2.json";

export const RELEASE_ORCHESTRATOR_IDENTITY = "local_ai_capability_release_orchestrator";

export const FIRST_WEATHER_SCOPED_VERSION = "sakaerat-weather-153-runtime-v3";

export const FIRST_WEATHER_SCOPED_PATH = `data/ai-painter/capability-releases/${FIRST_WEATHER_SCOPED_VERSION}/release.json`;

export const FIRST_WEATHER_SCOPED_POLICY_PATH = "data/ai-painter/system-governance/mvp-natural-world-weather-policy-v3.json";

export const ROLLING_WEATHER_VERSION = "sakaerat-weather-153-rolling-v4";

export const ROLLING_WEATHER_RELEASE_PATH = `data/ai-painter/capability-releases/${ROLLING_WEATHER_VERSION}/release.json`;

export const ROLLING_WEATHER_POLICY_PATH = "data/ai-painter/system-governance/mvp-natural-world-weather-policy-v4.json";

export const SCHEDULED_WEATHER_VERSION = "sakaerat-weather-153-scheduled-v5";

export const SCHEDULED_WEATHER_RELEASE_PATH = `data/ai-painter/capability-releases/${SCHEDULED_WEATHER_VERSION}/release.json`;

export const SCHEDULED_WEATHER_POLICY_PATH = "data/ai-painter/system-governance/mvp-natural-world-weather-policy-v5.json";

export const weatherProfiles = Object.freeze([
  Object.freeze({version:FIRST_WEATHER_SCOPED_VERSION,releasePath:FIRST_WEATHER_SCOPED_PATH,policyPath:FIRST_WEATHER_SCOPED_POLICY_PATH,
    budget:"sakaerat-first-committed-weather-runtime-v3",module:"./world-weather-v3-qualification.mjs",
    verify:"verifyFirstWeatherReleaseDomain",policyExport:"FIRST_WEATHER_DOMAIN_POLICY_PATH",rolesExport:"FIRST_WEATHER_DOMAIN_BINDING_ROLES"}),
  Object.freeze({version:ROLLING_WEATHER_VERSION,releasePath:ROLLING_WEATHER_RELEASE_PATH,policyPath:ROLLING_WEATHER_POLICY_PATH,
    budget:"sakaerat-rolling-weather-runtime-v4",module:"./world-weather-rolling-qualification.mjs",
    verify:"verifyRollingWeatherReleaseDomain",policyExport:"ROLLING_WEATHER_DOMAIN_POLICY_PATH",rolesExport:"ROLLING_WEATHER_DOMAIN_BINDING_ROLES"}),
  Object.freeze({version:SCHEDULED_WEATHER_VERSION,releasePath:SCHEDULED_WEATHER_RELEASE_PATH,policyPath:SCHEDULED_WEATHER_POLICY_PATH,
    budget:"sakaerat-scheduled-weather-runtime-v5",module:"./world-weather-scheduled-qualification.mjs",
    verify:"verifyScheduledWeatherReleaseDomain",policyExport:"SCHEDULED_WEATHER_DOMAIN_POLICY_PATH",rolesExport:"SCHEDULED_WEATHER_DOMAIN_BINDING_ROLES"}),
]);

export function weatherReleaseProfile(version) {
  return weatherProfiles.find(p=>p.version===version);
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const SAFE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/;

const ACTIVE_REGISTRY_STATUSES = new Set(["active_no_capability_release", "active_with_capability_release"]);

export function invariant(condition, message) { if (!condition) throw new Error(message); }

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }

export function sha256Of(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === "string" ? value : canonicalJson(value), "utf8");
  return createHash("sha256").update(input).digest("hex");
}

export function validateSha256(value, field) {
  invariant(typeof value === "string" && SHA256_PATTERN.test(value), `${field} must be a lowercase SHA-256`);
}

export function validateSafeId(value, field) {
  invariant(typeof value === "string" && SAFE_ID_PATTERN.test(value), `${field} is invalid`);
}

export function validateProjectRelativePath(relativePath, field) {
  invariant(typeof relativePath === "string" && relativePath.length > 0, `${field} is required`);
  invariant(!path.isAbsolute(relativePath) && !/^[a-zA-Z]:[\\/]/.test(relativePath), `${field} must be project-relative`);
  invariant(!relativePath.includes("\\") && !relativePath.split("/").includes(".."), `${field} must be normalized without traversal`);
  invariant(path.posix.normalize(relativePath) === relativePath, `${field} must be a normalized logical path`);
}

export function resolveInsideProject(projectRoot, relativePath, field) {
  validateProjectRelativePath(relativePath, field);
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, relativePath);
  invariant(resolved.startsWith(`${root}${path.sep}`), `${field} escapes project root`);
  return resolved;
}

function resolveImmutableProjectFile(projectRoot, relativePath, field) {
  const resolved = resolveInsideProject(projectRoot, relativePath, field);
  invariant(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), `${field} does not identify an existing file`);
  const physicalRoot = fs.realpathSync(path.resolve(projectRoot));
  const physicalFile = fs.realpathSync(resolved);
  invariant(physicalFile.startsWith(`${physicalRoot}${path.sep}`), `${field} resolves outside project root`);
  return resolved;
}

export function readImmutableFile(projectRoot, relativePath, field, expectedSha256 = null) {
  const absolutePath = resolveImmutableProjectFile(projectRoot, relativePath, field);
  const bytes = fs.readFileSync(absolutePath);
  const sha256 = sha256Of(bytes);
  if (expectedSha256 !== null) {
    validateSha256(expectedSha256, `${field} SHA-256`);
    invariant(sha256 === expectedSha256, `${field} SHA-256 mismatch`);
  }
  return { relativePath, absolutePath, bytes, sha256 };
}

export function readImmutableJson(projectRoot, relativePath, field, expectedSha256 = null) {
  const evidence = readImmutableFile(projectRoot, relativePath, field, expectedSha256);
  let value;
  try { value = JSON.parse(evidence.bytes.toString("utf8")); }
  catch { throw new Error(`${field} is not valid JSON`); }
  invariant(value && typeof value === "object" && !Array.isArray(value), `${field} must be a JSON object`);
  return { ...evidence, value };
}

export function loadTrustedReleaseRegistry(projectRoot, trustedReleaseRegistryPath) {
  invariant(typeof projectRoot === "string" && projectRoot.length > 0, "projectRoot is required");
  invariant(trustedReleaseRegistryPath === TRUSTED_RELEASE_REGISTRY_PATH, "untrusted capability release registry path rejected");
  const registryEvidence = readImmutableJson(projectRoot, trustedReleaseRegistryPath, "trusted capability release registry");
  const registry = registryEvidence.value;
  invariant(registry.schemaVersion === TRUSTED_RELEASE_REGISTRY_SCHEMA, "trusted release registry schema mismatch");
  invariant(registry.contractId === TRUSTED_RELEASE_REGISTRY_SCHEMA, "trusted release registry contractId mismatch");
  invariant(ACTIVE_REGISTRY_STATUSES.has(registry.status), "trusted release registry is not active");
  invariant(Number.isInteger(registry.registryRevision) && registry.registryRevision >= 0, "registryRevision is invalid");
  invariant(registry.uniqueWriter?.identity === RELEASE_ORCHESTRATOR_IDENTITY, "release registry writer identity mismatch");
  invariant(registry.uniqueWriter?.compareAndSwapRevisionRequired === true, "registry CAS revision is required");
  invariant(registry.uniqueWriter?.sqliteTransactionRequired === true, "registry SQLite transaction is required");
  invariant(registry.trustBoundary?.callerSuppliedVerificationFlagsAccepted === false, "trusted registry accepts caller verification flags");
  invariant(registry.trustBoundary?.ownerDecisionAcceptedAsReleaseAuthority === false, "Owner decision must not be release authority");
  invariant(Array.isArray(registry.releaseRecords), "trusted release records are required");
  return registryEvidence;
}

export function inspectCapabilityScopeAdmission(options = {}) {
  invariant(options && typeof options === "object" && !Array.isArray(options)
    && [Object.prototype, null].includes(Object.getPrototypeOf(options)), "preflight options must be a plain object");
  const allowedKeys = ["projectRoot", "requiredCapabilityScope", "trustedReleaseRegistryPath"];
  for (const key of Reflect.ownKeys(options)) {
    invariant(allowedKeys.includes(key), "unknown preflight option rejected");
    invariant(Object.hasOwn(Object.getOwnPropertyDescriptor(options, key), "value"), "preflight accessors rejected");
  }
  const { projectRoot, requiredCapabilityScope = "world_evolution",
    trustedReleaseRegistryPath = TRUSTED_RELEASE_REGISTRY_PATH } = options;
  invariant(typeof requiredCapabilityScope === "string" && requiredCapabilityScope.length > 0,
    "requiredCapabilityScope must be a non-empty string");
  const evidence = loadTrustedReleaseRegistry(projectRoot, trustedReleaseRegistryPath);
  const registry = evidence.value;
  validateProjectRelativePath(registry.releaseRoot, "registry releaseRoot");
  invariant(registry.releaseRoot === "data/ai-painter/capability-releases", "untrusted registry releaseRoot");
  invariant(Number.isSafeInteger(registry.registryRevision), "registryRevision must be a safe integer");
  invariant(registry.uniqueWriter.atomicFileReplaceRequired === true, "registry atomic replacement is required");
  for (const field of ["registryEntryRequired", "releaseFileSha256MustBeRecomputed",
    "machineReleaseAdjudicationSha256MustBeRecomputed", "allBoundArtifactSha256ValuesMustBeRecomputed",
    "unknownReleaseRejected", "revokedReleaseRejected"]) {
    invariant(registry.trustBoundary[field] === true, `registry trust boundary ${field} is required`);
  }
  invariant((registry.releaseRecords.length === 0) === (registry.status === "active_no_capability_release"),
    "registry status and record inventory disagree");
  const identities = new Set(), paths = new Set();
  for (const record of registry.releaseRecords) {
    invariant(record && typeof record === "object" && !Array.isArray(record), "release record must be an object");
    validateSafeId(record.capabilityReleaseIdentity, "registry capabilityReleaseIdentity");
    invariant(!identities.has(record.capabilityReleaseIdentity), "duplicate registry capability identity");
    identities.add(record.capabilityReleaseIdentity);
    invariant(record.status === "released_trusted", "unsupported registry record status");
    invariant(Number.isSafeInteger(record.registryRevision) && record.registryRevision > 0
      && record.registryRevision <= registry.registryRevision, "release record revision is invalid");
    for (const field of ["releasePath", "machineReleaseAdjudicationPath"]) {
      validateProjectRelativePath(record[field], `registry ${field}`);
      invariant(record[field].startsWith(`${registry.releaseRoot}/${record.capabilityReleaseIdentity}/`),
        `registry ${field} is outside its release identity`);
    }
    invariant(!paths.has(record.releasePath), "duplicate registry release path");
    paths.add(record.releasePath);
    for (const field of ["releaseSha256", "policyContractSha256", "bindingSetSha256",
      "machineReleaseAdjudicationSha256"]) validateSha256(record[field], field);
    const weather=weatherReleaseProfile(record.capabilityReleaseIdentity);
    if (weather) {
      invariant(record.releasePath === weather.releasePath && record.capabilityScope === "world_evolution"
        && record.ticketIssuerIdentity === null && record.ticketIssuerKeyId === null && record.ticketIssuerPublicKeySha256 === null,
        "scoped weather registry entry is invalid");
    } else {
      validateSha256(record.ticketIssuerPublicKeySha256, "ticketIssuerPublicKeySha256");
      validateSafeId(record.ticketIssuerIdentity, "registry ticketIssuerIdentity");
      validateSafeId(record.ticketIssuerKeyId, "registry ticketIssuerKeyId");
    }
  }
  const hasScopedWeather = requiredCapabilityScope === "world_evolution" && weatherProfiles.some(p=>identities.has(p.version));
  return deepFreeze({
    schemaVersion: "capability-scope-admission-preflight-v1",
    status: hasScopedWeather ? "scoped_record_requires_domain_read" : "unsupported_scope", requiredCapabilityScope, scopeSupported: hasScopedWeather,
    registry: { path: TRUSTED_RELEASE_REGISTRY_PATH, sha256: evidence.sha256,
      status: registry.status, revision: registry.registryRevision, releaseCount: registry.releaseRecords.length },
    capabilityStatus: registry.releaseRecords.length === 0 ? "qualification_missing" : "scope_qualification_not_verified",
    registryValidation: "structure_only_not_release_artifact_verification",
    policyShapeStatus: "not_provided", domainConsumerStatus: "not_integrated",
    productionAdmitted: false, registryWrites: 0, worldWrites: 0,
  });
}

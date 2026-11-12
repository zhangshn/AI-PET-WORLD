import {resolveRuntimePath} from './runtime-working-directory.mjs'
import { TRUSTED_RELEASE_REGISTRY_SCHEMA, TRUSTED_RELEASE_REGISTRY_PATH, RELEASE_ORCHESTRATOR_IDENTITY, FIRST_WEATHER_SCOPED_VERSION, FIRST_WEATHER_SCOPED_PATH, weatherProfiles, weatherReleaseProfile, invariant, canonicalize, deepFreeze, canonicalJson, sha256Of, validateSha256, validateSafeId, validateProjectRelativePath, resolveInsideProject, readImmutableFile, readImmutableJson, loadTrustedReleaseRegistry, inspectCapabilityScopeAdmission } from "./ai-painter-capability-scope-admission.mjs";
export { TRUSTED_RELEASE_REGISTRY_SCHEMA, TRUSTED_RELEASE_REGISTRY_PATH, RELEASE_ORCHESTRATOR_IDENTITY, FIRST_WEATHER_SCOPED_VERSION, FIRST_WEATHER_SCOPED_PATH, FIRST_WEATHER_SCOPED_POLICY_PATH, ROLLING_WEATHER_VERSION, ROLLING_WEATHER_RELEASE_PATH, ROLLING_WEATHER_POLICY_PATH, SCHEDULED_WEATHER_VERSION, SCHEDULED_WEATHER_RELEASE_PATH, SCHEDULED_WEATHER_POLICY_PATH, weatherReleaseProfile, canonicalJson, sha256Of, inspectCapabilityScopeAdmission } from "./ai-painter-capability-scope-admission.mjs";
import {
  createPublicKey,
  randomBytes,
  sign as signBytes,
  verify as verifyBytes,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { types } from "node:util";
import { createRequire } from "node:module";
import { WEATHER_RELEASE_PATH, WEATHER_VERSION, FIRST_WEATHER_VERSION, FIRST_WEATHER_RELEASE_PATH, requireWeatherProductionAdmission } from "./world-weather-release-policy-reader.mjs";

export const RUNTIME_AUTONOMY_CONTRACT_ID = "ai-painter-capability-runtime-autonomy-contract-v3";


export const RUNTIME_AUTONOMY_POLICY_PATH = "data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v3.json";
export const CAPABILITY_RELEASE_SCHEMA = "ai-painter-capability-release-v2";
export const MACHINE_RELEASE_ADJUDICATION_SCHEMA = "ai-painter-machine-capability-release-adjudication-v1";

export const DEFAULT_TICKET_LEDGER_PATH = ".runtime/ai-painter/capability-runtime-ticket-ledger.sqlite";









const requireDomain = createRequire(import.meta.url);


export const REQUIRED_BINDING_ROLES = Object.freeze([
  "datasetRelease", "modelArtifact", "reviewContract", "runtimeInterfaceContract", "conditionContract",
]);

export const EXECUTION_STATES = Object.freeze([
  "package_materialized", "preflight", "executing", "validating", "reviewing",
  "adjudicating", "finalizing", "completed", "failed_closed", "blocked_policy_boundary",
]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  package_materialized: Object.freeze(["preflight", "failed_closed", "blocked_policy_boundary"]),
  preflight: Object.freeze(["preflight", "executing", "failed_closed", "blocked_policy_boundary"]),
  executing: Object.freeze(["executing", "validating", "failed_closed", "blocked_policy_boundary"]),
  validating: Object.freeze(["validating", "reviewing", "failed_closed", "blocked_policy_boundary"]),
  reviewing: Object.freeze(["reviewing", "adjudicating", "failed_closed", "blocked_policy_boundary"]),
  adjudicating: Object.freeze(["adjudicating", "finalizing", "failed_closed", "blocked_policy_boundary"]),
  finalizing: Object.freeze(["finalizing", "completed", "failed_closed", "blocked_policy_boundary"]),
});

export const INTERNAL_ACTION_TARGETS = Object.freeze({
  "preflight.verify": Object.freeze(["package_materialized:preflight"]),
  "formal_inference.start": Object.freeze(["preflight:executing"]),
  "execution.observe": Object.freeze(["executing:executing"]),
  "validation.fixed_evidence": Object.freeze(["executing:validating", "validating:validating"]),
  "review.machine": Object.freeze(["validating:reviewing", "reviewing:reviewing"]),
  "adjudication.deterministic": Object.freeze(["reviewing:adjudicating", "adjudicating:adjudicating"]),
  "runtime_frame.create": Object.freeze(["adjudicating:finalizing"]),
  "world.enter": Object.freeze(["finalizing:completed"]),
  "terminal.complete": Object.freeze(["finalizing:completed"]),
  "terminal.fail_closed": Object.freeze([
    "package_materialized:failed_closed", "preflight:failed_closed", "executing:failed_closed",
    "validating:failed_closed", "reviewing:failed_closed", "adjudicating:failed_closed",
    "finalizing:failed_closed",
  ]),
  "policy_boundary.report": Object.freeze([
    "package_materialized:blocked_policy_boundary", "preflight:blocked_policy_boundary",
    "executing:blocked_policy_boundary", "validating:blocked_policy_boundary",
    "reviewing:blocked_policy_boundary", "adjudicating:blocked_policy_boundary",
    "finalizing:blocked_policy_boundary",
  ]),
  "governance.sync": Object.freeze([
    "preflight:preflight", "executing:executing", "validating:validating",
    "reviewing:reviewing", "adjudicating:adjudicating", "finalizing:finalizing",
  ]),
  "infrastructure.recover_bounded": Object.freeze(["preflight:preflight"]),
});

export const LOCAL_CAPABILITY_LIFECYCLE_ACTIONS = Object.freeze(new Set([
  "training.start_or_retry", "optimizer.create", "weights.modify", "checkpoint.select_or_promote",
  "model.implement_bounded_change", "loss.implement_bounded_change", "data_release.materialize",
  "review_contract.change_candidate", "program_lineage.change_candidate", "model_family.change_candidate",
  "capability_release.adjudicate", "capability_release.rollback",
]));

export const POLICY_BOUNDARY_CLASSES = Object.freeze(new Set([
  "long_term_business_goal_change", "worldfacts_authority_change", "source_license_or_legal_boundary",
  "safety_limit_change", "audit_truthfulness_conflict", "unregistered_external_cost",
  "irreversible_destructive_action",
]));



const SAFE_RUNTIME_NAMESPACE_PATTERN = /^\.runtime\/ai-painter\/[a-zA-Z0-9._/-]+$/;
const ACTIVE_POLICY_STATUSES = new Set(["policy_active_no_capability_release", "policy_active_with_capability_release"]);


























function validateProgramLineage(lineage) {
  invariant(lineage && typeof lineage === "object" && !Array.isArray(lineage), "programLineage must be an object");
  invariant(Object.keys(lineage).length > 0, "programLineage must not be empty");
  for (const [role, digest] of Object.entries(lineage)) {
    validateSafeId(role, "programLineage role");
    validateSha256(digest, `programLineage.${role}`);
  }
}

function validateEvidence(inputEvidence) {
  invariant(Array.isArray(inputEvidence) && inputEvidence.length > 0, "inputEvidence must be non-empty");
  const identities = new Set();
  for (const evidence of inputEvidence) {
    invariant(evidence && typeof evidence === "object", "evidence entry must be an object");
    validateProjectRelativePath(evidence.path, "evidence path");
    validateSha256(evidence.sha256, "evidence sha256");
    const identity = `${evidence.path}\u0000${evidence.sha256}`;
    invariant(!identities.has(identity), "duplicate evidence identity");
    identities.add(identity);
  }
}

export function validateRuntimeAutonomyPolicy(policy) {
  invariant(policy?.contractId === RUNTIME_AUTONOMY_CONTRACT_ID, "unexpected policy contractId");
  invariant(ACTIVE_POLICY_STATUSES.has(policy?.status), "runtime policy is not active");
  invariant(policy?.authorityBoundary?.rootAuthority === "released_capability_identity", "released capability authority is required");
  invariant(policy?.authorityBoundary?.normalOperationAuthority === "local_ai_pet_world_program", "local AI must own normal operation");
  invariant(policy?.authorityBoundary?.ownerInNormalStateMachine === false, "Owner must not be in the normal state machine");
  invariant(policy?.authorityBoundary?.perTaskOwnerAuthorizationRequired === false, "per-task Owner authorization must be false");
  invariant(policy?.authorityBoundary?.perStageOwnerAuthorizationRequired === false, "per-stage Owner authorization must be false");
  invariant(policy?.authorityBoundary?.perCapabilityVersionOwnerAuthorizationRequired === false, "per-version Owner authorization must be false");
  invariant(policy?.authorityBoundary?.perCandidateOwnerReviewRequired === false, "per-candidate Owner review must be false");
  invariant(policy?.authorityBoundary?.codexIsRequiredAtRuntime === false, "Codex must not be a runtime dependency");
  invariant(policy?.capabilityReleaseVerification?.trustedRegistrySchemaVersion === TRUSTED_RELEASE_REGISTRY_SCHEMA, "trusted release registry schema mismatch");
  invariant(policy?.capabilityReleaseVerification?.trustedRegistryPath === TRUSTED_RELEASE_REGISTRY_PATH, "trusted release registry path mismatch");
  invariant(policy?.capabilityReleaseVerification?.releaseSchemaVersion === CAPABILITY_RELEASE_SCHEMA, "capability release schema mismatch");
  invariant(policy?.capabilityReleaseVerification?.machineReleaseAdjudicationSchemaVersion === MACHINE_RELEASE_ADJUDICATION_SCHEMA, "machine release adjudication schema mismatch");
  invariant(policy?.capabilityReleaseVerification?.callerSuppliedVerifiedBooleanTrusted === false, "caller verification flags must not be trusted");
  invariant(policy?.capabilityReleaseVerification?.machineSignatureRequiredForInternalTicket === true, "machine ticket signature is required");
  invariant(policy?.capabilityReleaseVerification?.persistentReplayLedgerRequired === true, "persistent replay ledger is required");
  invariant(canonicalJson(policy?.capabilityReleaseVerification?.requiredBindingRoles) === canonicalJson(REQUIRED_BINDING_ROLES), "required release binding roles mismatch");
  invariant(policy?.decisionRules?.ambiguousTargetState === "blocked_policy_boundary", "ambiguous evidence must stop at policy boundary");
  invariant(policy?.decisionRules?.ownerResponseWaitAllowed === false, "Owner response waits must be forbidden");
  for (const forbidden of ["waiting_owner_decision", "waiting_capability_change", "owner.wait"]) {
    invariant(!policy.executionStates?.includes(forbidden), `forbidden Owner wait state present: ${forbidden}`);
    invariant(!policy.releasedCapabilityInternalActions?.includes(forbidden), `forbidden Owner wait action present: ${forbidden}`);
  }
  return true;
}

// Scope alone grants nothing. The fixed weather identity has its own explicit entry below.
export function assertSupportedCapabilityScope(requiredCapabilityScope) {
  if (requiredCapabilityScope === undefined) return;
  const error = new Error("unsupported_scope: no trusted semantic verifier for requested capability scope");
  error.code = "unsupported_scope";
  error.status = "unsupported_scope";
  error.productionAdmitted = false;
  throw error;
}

export function recomputeFirstWeatherReleaseDomain(root) {
  return recomputeScopedWeatherReleaseDomain(root,FIRST_WEATHER_SCOPED_VERSION);
}

export function recomputeScopedWeatherReleaseDomain(root,version) {
  const profile=weatherReleaseProfile(version);
  invariant(profile,"unknown weather release version");
  // Loading one version must never require another version's optional verifier.
  invariant(fs.existsSync(resolveRuntimePath(root, profile.policyPath)), `fixed weather policy is missing: ${profile.policyPath}`);
  const domain = requireDomain(profile.module);
  invariant(domain[profile.policyExport] === profile.policyPath, "weather verifier policy path differs");
  const { bindings, programLineage, releaseEvidence } = domain[profile.verify](root);
  const roles = [...REQUIRED_BINDING_ROLES].sort();
  invariant(canonicalJson([...domain[profile.rolesExport]].sort()) === canonicalJson(roles)
    && canonicalJson(Object.keys(bindings).sort()) === canonicalJson(roles), "weather domain binding roles mismatch");
  invariant(bindings.reviewContract.identity===version && bindings.reviewContract.path===profile.policyPath
    && bindings.runtimeInterfaceContract.identity===profile.budget
    && bindings.runtimeInterfaceContract.path===`data/ai-painter/system-governance/${profile.budget}.json`,
    "weather policy or execution budget belongs to another version");
  validateProgramLineage(programLineage);
  validateEvidence(releaseEvidence);
  for (const role of roles) {
    const binding = bindings[role];
    invariant(canonicalJson(Object.keys(binding).sort()) === canonicalJson(["identity","path","sha256"]), "weather binding fields mismatch");
    validateSafeId(binding.identity, role);
    validateProjectRelativePath(binding.path, role);
    validateSha256(binding.sha256, role);
  }
  return { bindings, programLineage, releaseEvidence };
}

export function assertNoScopedWeatherBindings(bindings) {
  for (const binding of Object.values(bindings ?? {})) {
    invariant(!weatherProfiles.some(p=>binding?.identity===p.version || binding?.path===p.policyPath || binding?.identity===p.budget
      || binding?.path===`data/ai-painter/system-governance/${p.budget}.json`),
      "fixed weather evidence cannot authorize a generic release");
  }
}

export function assertUnreservedWeatherVersion(...identities) {
  invariant(!identities.some((id) => typeof id === "string" && id.startsWith("sakaerat-weather-153-")),
    "reserved weather identity cannot be used as a generic capability");
}

function scopedRuntimeFile(root, relative) {
  validateProjectRelativePath(relative, "weather runtime evidence");
  invariant(relative.startsWith(".runtime/"), "weather evidence outside runtime");
  const mount = fs.realpathSync.native(resolveRuntimePath(root, ".runtime"));
  const absolute = path.join(mount, relative.slice(".runtime/".length));
  const stat = fs.lstatSync(absolute);
  invariant(stat.isFile() && stat.nlink === 1 && fs.realpathSync.native(absolute) === absolute, "weather runtime evidence path differs");
  return absolute;
}

export function verifyFirstWeatherReleaseLifecycle(root, acceptedStates, expectedAdjudicatedStage = null, finalizingBindings = null) {
  return verifyScopedWeatherReleaseLifecycle(root,FIRST_WEATHER_SCOPED_VERSION,acceptedStates,expectedAdjudicatedStage,finalizingBindings);
}
export function verifyScopedWeatherReleaseLifecycle(root, version, acceptedStates, expectedAdjudicatedStage = null, finalizingBindings = null) {
  const profile=weatherReleaseProfile(version);
  invariant(profile,"unknown weather lifecycle version");
  const weatherLifecycle=`.runtime/ai-painter/capability-lifecycle/${version}`;
  const json = (name) => JSON.parse(fs.readFileSync(scopedRuntimeFile(root, `${weatherLifecycle}/${name}`), "utf8"));
  const state = json("state.json");
  const spec = json("candidate.json");
  invariant(state.schemaVersion === "ai-painter-capability-lifecycle-state-v1" && state.capabilityVersion === version
    && spec.capabilityVersion === state.capabilityVersion && spec.changeClass === "runtime_interface"
    && state.changeClass === spec.changeClass && acceptedStates.includes(state.state), "weather lifecycle state rejected");
  const policyFile = readImmutableJson(root, profile.policyPath, "fixed weather domain policy");
  invariant(spec.sourceEvidence.some((row) => row.path === profile.policyPath && row.sha256 === policyFile.sha256),
    "weather lifecycle does not bind fixed policy");
  const db = new DatabaseSync(scopedRuntimeFile(root, `${weatherLifecycle}/lifecycle.sqlite`), { readOnly: true });
  try {
    const latest = db.prepare("SELECT c.state,c.change_class,t.sequence,t.from_state,t.to_state,t.evidence_sha256 FROM capabilities c JOIN lifecycle_transitions t USING(capability_version) WHERE c.capability_version=? ORDER BY t.sequence DESC LIMIT 1").get(state.capabilityVersion);
    invariant(latest && latest.state === latest.to_state && latest.change_class === state.changeClass, "weather lifecycle transaction differs");
    let row=latest;
    // The original lifecycle writes SQLite before projecting state.json. Only its
    // transition verifier may recover that one split; public reads stay closed.
    if (finalizingBindings && state.state === "machine_release_adjudicated" && latest.to_state === "released"
        && latest.from_state === state.state && latest.sequence === state.sequence+1) {
      const nextFile=`${weatherLifecycle}/evidence/${String(latest.sequence).padStart(3,"0")}-released.json`;
      const bytes=fs.readFileSync(scopedRuntimeFile(root,nextFile));
      const intent=JSON.parse(bytes);
      invariant(sha256Of(bytes) === latest.evidence_sha256 && intent.capabilityVersion === state.capabilityVersion
        && intent.targetState === "released" && intent.status === "passed"
        && canonicalJson(intent.bindings) === canonicalJson(finalizingBindings), "weather lifecycle recovery intent differs");
      row=db.prepare("SELECT sequence,to_state,evidence_sha256 FROM lifecycle_transitions WHERE capability_version=? AND sequence=?").get(state.capabilityVersion,state.sequence);
    }
    invariant(row?.to_state === state.state && row.sequence === state.sequence && state.latestEvidence?.sha256 === row.evidence_sha256,
      "weather lifecycle transaction differs");
    const file = `evidence/${String(state.sequence).padStart(3,"0")}-${state.state}.json`;
    invariant(state.latestEvidence.path === file && sha256Of(fs.readFileSync(scopedRuntimeFile(root,`${weatherLifecycle}/${file}`))) === row.evidence_sha256,
      "weather lifecycle evidence bytes differ");
    if (expectedAdjudicatedStage) {
      const stages = db.prepare("SELECT sequence,evidence_sha256 FROM lifecycle_transitions WHERE capability_version=? AND to_state='machine_release_adjudicated' ORDER BY sequence DESC LIMIT 1").get(version);
      invariant(stages && stages.sequence <= state.sequence, "weather adjudicated lifecycle stage missing");
      const oldFile = `${weatherLifecycle}/evidence/${String(stages.sequence).padStart(3,"0")}-machine_release_adjudicated.json`;
      invariant(canonicalJson(expectedAdjudicatedStage) === canonicalJson({path:oldFile,sha256:stages.evidence_sha256}),
        "weather release bound another lifecycle stage");
      const original = fs.readFileSync(scopedRuntimeFile(root,oldFile));
      const value = JSON.parse(original);
      invariant(sha256Of(original) === stages.evidence_sha256 && value.capabilityVersion === version
        && value.targetState === "machine_release_adjudicated" && value.status === "passed", "immutable weather lifecycle adjudication differs");
    }
    return state;
  } finally { db.close(); }
}



// The original writer appends exactly one record per SQLite-backed revision. An
// older lifecycle receipt keeps the registry hash at *its* revision even after
// a second version is published. Rebuild that exact serialized prefix read-only.
export function scopedWeatherRegistryBindingAtRelease(projectRoot,version) {
  const profile=weatherReleaseProfile(version);
  invariant(profile,"unknown weather release version");
  const evidence=loadTrustedReleaseRegistry(projectRoot,TRUSTED_RELEASE_REGISTRY_PATH);
  const registry=evidence.value;
  const matches=registry.releaseRecords.filter(r=>r.capabilityReleaseIdentity===version && r.releasePath===profile.releasePath);
  invariant(matches.length===1 && matches[0].status==="released_trusted","weather registry release revision absent");
  const revision=matches[0].registryRevision;
  invariant(Number.isSafeInteger(revision) && revision>0 && revision<=registry.registryRevision,"invalid weather registry revision");
  if(revision===registry.registryRevision) return {path:TRUSTED_RELEASE_REGISTRY_PATH,sha256:evidence.sha256};
  invariant(registry.registryRevision===registry.releaseRecords.length &&
    registry.releaseRecords.every((r,i)=>r.registryRevision===i+1),"weather registry history is not a complete append-only prefix");
  const prefix={...registry,status:"active_with_capability_release",registryRevision:revision,releaseRecords:registry.releaseRecords.slice(0,revision)};
  return {path:TRUSTED_RELEASE_REGISTRY_PATH,sha256:sha256Of(Buffer.from(JSON.stringify(prefix,null,2)+"\n"))};
}

// A read-only inventory, never an admission token. A record count is not a count
// of qualified domain capabilities, even when generic release bindings exist.
// Candidate evidence inspection is separate from the inventory below: the
// evidence auditor itself reads that inventory, so routing it back here would
// recurse. This entry neither publishes nor changes the supported-scope guard.
export async function inspectWorldEvolutionCandidateQualification(options = {}) {
  invariant(options !== null && typeof options === "object" && !types.isProxy(options)
    && Object.getPrototypeOf(options) === Object.prototype, "candidate qualification options must be a plain object");
  for (const key of Reflect.ownKeys(options)) {
    invariant(key === "projectRoot", "unknown candidate qualification option rejected");
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    invariant(descriptor.enumerable && Object.hasOwn(descriptor, "value"), "candidate qualification accessors rejected");
  }
  const projectRoot = Object.hasOwn(options, "projectRoot") ? options.projectRoot : process.cwd();
  invariant(typeof projectRoot === "string" && projectRoot.length > 0, "candidate qualification projectRoot is required");
  // Copy the sole accepted primitive before the asynchronous module boundary.
  const { inspectWorldEnvironmentCandidateQualification } = await import("./world-environment-qualification.mjs");
  return inspectWorldEnvironmentCandidateQualification({ projectRoot });
}



export function loadAndValidateReleasedCapabilityBinding(options) {
  return readReleasedCapability(options, false);
}

// Called only to attest the lifecycle transition. Never return bindings, actions or an issuer.
export function verifyFirstWeatherReleaseForLifecycle({ projectRoot, capabilityReleasePath, trustedReleaseRegistryPath }) {
  invariant(capabilityReleasePath === FIRST_WEATHER_SCOPED_PATH, "fixed weather lifecycle release path required");
  return verifyScopedWeatherReleaseForLifecycle(FIRST_WEATHER_SCOPED_VERSION,{projectRoot,capabilityReleasePath,trustedReleaseRegistryPath});
}
export function verifyScopedWeatherReleaseForLifecycle(version,{ projectRoot, capabilityReleasePath, trustedReleaseRegistryPath }) {
  const profile=weatherReleaseProfile(version);
  invariant(profile && capabilityReleasePath === profile.releasePath, "fixed weather lifecycle release path required");
  const { release } = readReleasedCapability({ projectRoot, capabilityReleasePath, trustedReleaseRegistryPath, requiredCapabilityScope: "world_evolution" }, true);
  return { release: { modelCapabilityVersion: release.modelCapabilityVersion, capabilityReleaseIdentity: release.capabilityReleaseIdentity } };
}

function readReleasedCapability({ projectRoot, capabilityReleasePath, trustedReleaseRegistryPath, requiredCapabilityScope }, lifecycleTransition) {
  if ([WEATHER_RELEASE_PATH,FIRST_WEATHER_RELEASE_PATH].includes(capabilityReleasePath) && [undefined, "world_evolution"].includes(requiredCapabilityScope)) {
    invariant(trustedReleaseRegistryPath === TRUSTED_RELEASE_REGISTRY_PATH, "untrusted capability release registry path rejected");
    requireWeatherProductionAdmission(projectRoot,capabilityReleasePath===WEATHER_RELEASE_PATH ? WEATHER_VERSION : FIRST_WEATHER_VERSION);
  }
  const scopedWeather = weatherProfiles.find(p=>p.releasePath===capabilityReleasePath);
  if (scopedWeather) invariant(requiredCapabilityScope === "world_evolution", "scoped weather requires explicit world_evolution");
  else assertSupportedCapabilityScope(requiredCapabilityScope);
  if (scopedWeather) inspectCapabilityScopeAdmission({projectRoot, requiredCapabilityScope, trustedReleaseRegistryPath});
  const registryEvidence = loadTrustedReleaseRegistry(projectRoot, trustedReleaseRegistryPath);
  const registry = registryEvidence.value;
  validateProjectRelativePath(capabilityReleasePath, "capabilityReleasePath");
  invariant(capabilityReleasePath.startsWith(`${registry.releaseRoot}/`), "capability release is outside the trusted release root");

  const matchingRecords = registry.releaseRecords.filter((entry) => entry?.releasePath === capabilityReleasePath);
  invariant(matchingRecords.length === 1, "capability release must have exactly one trusted registry record");
  const registryRecord = matchingRecords[0];
  validateSafeId(registryRecord.capabilityReleaseIdentity, "trusted capabilityReleaseIdentity");
  invariant(registryRecord.status === "released_trusted", "capability release is not trusted and released");
  invariant(registryRecord.registryRevision <= registry.registryRevision, "release record revision exceeds registry revision");

  const releaseEvidence = readImmutableJson(projectRoot, capabilityReleasePath, "capability release", registryRecord.releaseSha256);
  const release = releaseEvidence.value;
  const reservedWeather=[WEATHER_VERSION,FIRST_WEATHER_VERSION].find(v=>v===release.modelCapabilityVersion || v===release.capabilityReleaseIdentity);
  if (reservedWeather) requireWeatherProductionAdmission(projectRoot,reservedWeather);
  if (scopedWeather) {
    invariant(release.modelCapabilityVersion === scopedWeather.version && release.capabilityReleaseIdentity === scopedWeather.version
      && release.capabilityScope === "world_evolution" && registryRecord.capabilityScope === "world_evolution", "scoped weather identity differs");
  } else {
    assertUnreservedWeatherVersion(release.modelCapabilityVersion, release.capabilityReleaseIdentity);
    invariant(release.capabilityScope !== "world_evolution" && registryRecord.capabilityScope !== "world_evolution", "scoped weather cannot use a generic release");
    assertNoScopedWeatherBindings(release.bindings);
  }
  invariant(release.schemaVersion === CAPABILITY_RELEASE_SCHEMA, "capability release schema mismatch");
  invariant(release.status === "released", "capability release status is not released");
  invariant(release.capabilityReleaseIdentity === registryRecord.capabilityReleaseIdentity, "capability release identity differs from trusted registry");
  validateSafeId(release.modelCapabilityVersion, "modelCapabilityVersion");

  const policyBinding = release.runtimeAutonomyPolicy;
  invariant(policyBinding?.contractId === RUNTIME_AUTONOMY_CONTRACT_ID, "capability release lacks runtime policy binding");
  invariant(policyBinding?.path === RUNTIME_AUTONOMY_POLICY_PATH, "capability release references an untrusted runtime policy path");
  const policyEvidence = readImmutableJson(projectRoot, policyBinding.path, "runtime autonomy policy", policyBinding.sha256);
  validateRuntimeAutonomyPolicy(policyEvidence.value);
  invariant(policyEvidence.sha256 === registryRecord.policyContractSha256, "trusted registry policy SHA mismatch");
  invariant(Array.isArray(policyBinding.allowedInternalActions), "allowedInternalActions is required");
  invariant(policyBinding.allowedInternalActions.every((action) => policyEvidence.value.releasedCapabilityInternalActions.includes(action)), "release contains an action outside runtime policy");
  invariant(Number.isInteger(policyBinding.maxInfrastructureRecoveryAttempts) && policyBinding.maxInfrastructureRecoveryAttempts >= 0, "recovery attempt limit is invalid");

  invariant(release.bindings && typeof release.bindings === "object" && !Array.isArray(release.bindings), "capability release bindings are required");
  invariant(canonicalJson(Object.keys(release.bindings).sort()) === canonicalJson([...REQUIRED_BINDING_ROLES].sort()), "capability release binding roles mismatch");
  const domain = scopedWeather ? recomputeScopedWeatherReleaseDomain(projectRoot,scopedWeather.version) : null;
  if (domain) {
    invariant(canonicalJson(release.bindings) === canonicalJson(domain.bindings)
      && canonicalJson(release.programLineage) === canonicalJson(domain.programLineage), "scoped weather release differs from domain evidence");
  }
  const verifiedBindings = {};
  for (const role of REQUIRED_BINDING_ROLES) {
    const binding = release.bindings[role];
    invariant(binding && typeof binding === "object", `${role} binding is required`);
    validateSafeId(binding.identity, `${role}.identity`);
    let evidence;
    if (domain && binding.path.startsWith(".runtime/")) {
      const sha256 = sha256Of(fs.readFileSync(scopedRuntimeFile(projectRoot, binding.path)));
      invariant(sha256 === binding.sha256, `${role} scoped weather binding SHA mismatch`);
      evidence = {sha256};
    } else {
      evidence = readImmutableFile(projectRoot, binding.path, `${role} binding`, binding.sha256);
    }
    verifiedBindings[role] = { identity: binding.identity, path: binding.path, sha256: evidence.sha256 };
  }
  const bindingSetSha256 = sha256Of(release.bindings);
  invariant(bindingSetSha256 === registryRecord.bindingSetSha256, "trusted registry binding set SHA mismatch");

  validateProgramLineage(release.programLineage);
  const programLineageSha256 = sha256Of(release.programLineage);
  const adjudicationBinding = release.machineReleaseAdjudication;
  invariant(adjudicationBinding && typeof adjudicationBinding === "object", "machine release adjudication binding is required");
  invariant(adjudicationBinding.path === registryRecord.machineReleaseAdjudicationPath, "machine adjudication path differs from trusted registry");
  invariant(adjudicationBinding.sha256 === registryRecord.machineReleaseAdjudicationSha256, "machine adjudication SHA differs from trusted registry");
  const adjudicationEvidence = readImmutableJson(projectRoot, adjudicationBinding.path, "machine release adjudication", adjudicationBinding.sha256);
  const adjudication = adjudicationEvidence.value;
  invariant(adjudication.schemaVersion === MACHINE_RELEASE_ADJUDICATION_SCHEMA, "machine release adjudication schema mismatch");
  invariant(adjudication.status === "released", "machine release adjudication is not released");
  invariant(adjudication.writerIdentity === RELEASE_ORCHESTRATOR_IDENTITY, "machine release adjudication writer mismatch");
  invariant(adjudication.capabilityReleaseIdentity === release.capabilityReleaseIdentity, "machine adjudication release identity mismatch");
  invariant(adjudication.bindingSetSha256 === bindingSetSha256, "machine adjudication binding set mismatch");
  invariant(adjudication.policyContractSha256 === policyEvidence.sha256, "machine adjudication policy mismatch");
  invariant(adjudication.programLineageSha256 === programLineageSha256, "machine adjudication program lineage mismatch");
  validateEvidence(adjudication.evidence);

  let verifiedIssuer = null;
  if (scopedWeather) {
    invariant(release.ticketIssuer === null && registryRecord.ticketIssuerIdentity === null && registryRecord.ticketIssuerKeyId === null
      && registryRecord.ticketIssuerPublicKeySha256 === null && release.outputRoot === null && policyBinding.allowedInternalActions.length === 0
      && policyBinding.maxInfrastructureRecoveryAttempts === 0, "weather release cannot grant a ticket, generic output or internal action");
    invariant(release.createdBy === RELEASE_ORCHESTRATOR_IDENTITY && release.ownerDecisionUsed === false
      && adjudication.ownerDecisionUsed === false && adjudication.capabilityScope === "world_evolution"
      && canonicalJson(adjudication.evidence) === canonicalJson(domain.releaseEvidence), "weather adjudication differs from verified domain evidence");
    invariant(adjudication.adjudicatedStage && adjudication.lifecycleState?.path === `.runtime/ai-painter/capability-lifecycle/${scopedWeather.version}/state.json`,
      "weather adjudicated lifecycle evidence required");
    const transitionBindings=lifecycleTransition ? [
      {path:capabilityReleasePath,sha256:releaseEvidence.sha256},
      scopedWeatherRegistryBindingAtRelease(projectRoot,scopedWeather.version),
    ] : null;
    const state = verifyScopedWeatherReleaseLifecycle(projectRoot, scopedWeather.version,lifecycleTransition ? ["machine_release_adjudicated","released"] : ["released"],
      adjudication.adjudicatedStage,transitionBindings);
    if (state.state === "released") invariant(state.releaseIdentity === scopedWeather.version, "weather lifecycle release identity differs");
    const ledger = new DatabaseSync(scopedRuntimeFile(projectRoot, ".runtime/ai-painter/capability-release-ledger.sqlite"), {readOnly:true});
    try {
      const rows = ledger.prepare("SELECT * FROM releases WHERE capability_release_identity=?").all(scopedWeather.version);
      const row = rows[0];
      invariant(rows.length === 1 && row.release_path === capabilityReleasePath && row.release_sha256 === releaseEvidence.sha256
        && row.registry_revision === registryRecord.registryRevision && row.owner_decision_used === 0, "weather release ledger differs");
    } finally { ledger.close(); }
  } else {
    const issuer = release.ticketIssuer;
    invariant(issuer && typeof issuer === "object", "ticket issuer binding is required");
    validateSafeId(issuer.identity, "ticket issuer identity");
    validateSafeId(issuer.keyId, "ticket issuer keyId");
    invariant(issuer.identity === registryRecord.ticketIssuerIdentity, "ticket issuer identity differs from registry");
    invariant(issuer.keyId === registryRecord.ticketIssuerKeyId, "ticket issuer key differs from registry");
    const publicKeyEvidence = readImmutableFile(projectRoot, issuer.publicKeyPath, "ticket issuer public key", issuer.publicKeySha256);
    invariant(publicKeyEvidence.sha256 === registryRecord.ticketIssuerPublicKeySha256, "ticket issuer public key differs from registry");
    const publicKey = createPublicKey(publicKeyEvidence.bytes);
    invariant(typeof release.outputRoot === "string" && SAFE_RUNTIME_NAMESPACE_PATTERN.test(release.outputRoot), "outputRoot must be a project runtime namespace");
    invariant(!release.outputRoot.includes("..") && !release.outputRoot.includes("\\"), "outputRoot must be normalized");
    verifiedIssuer = { identity: issuer.identity, keyId: issuer.keyId, publicKeyPath: issuer.publicKeyPath, publicKeySha256: publicKeyEvidence.sha256, publicKey };
  }

  return deepFreeze({
    verificationStatus: "verified_from_machine_adjudication_and_trusted_registry",
    capabilityReleasePath,
    capabilityReleaseSha256: releaseEvidence.sha256,
    trustedReleaseRegistryPath,
    trustedReleaseRegistrySha256: registryEvidence.sha256,
    policyPath: policyBinding.path,
    policySha256: policyEvidence.sha256,
    release,
    verifiedBindings,
    machineReleaseAdjudicationPath: adjudicationBinding.path,
    machineReleaseAdjudicationSha256: adjudicationEvidence.sha256,
    ticketIssuer: verifiedIssuer,
  });
}

export function validateReleasedCapabilityBinding(options) {
  return loadAndValidateReleasedCapabilityBinding(options);
}

export function classifyActionAuthority(action, context = {}) {
  if (POLICY_BOUNDARY_CLASSES.has(action) || context.policyBoundary === true) return "blocked_policy_boundary";
  if (LOCAL_CAPABILITY_LIFECYCLE_ACTIONS.has(action) || context.capabilityImplementationChanged === true) return "local_capability_lifecycle_action";
  if (action in INTERNAL_ACTION_TARGETS) return "released_capability_internal_action";
  return "denied_unknown_action";
}

export function deriveRuntimeCapabilityTicket({
  projectRoot, capabilityReleasePath, trustedReleaseRegistryPath, action, currentState, targetState,
  inputEvidence, programLineage, outputNamespace, attemptNumber = 1, context = {}, issuedAt,
  expiresAt, nonce = randomBytes(16).toString("hex"), signingPrivateKey,
}) {
  const verified = loadAndValidateReleasedCapabilityBinding({ projectRoot, capabilityReleasePath, trustedReleaseRegistryPath });
  const capabilityRelease = verified.release;
  invariant(classifyActionAuthority(action, context) === "released_capability_internal_action", `action ${action} is not a released-capability runtime action`);
  invariant(capabilityRelease.runtimeAutonomyPolicy.allowedInternalActions.includes(action), `action ${action} is outside released capability scope`);
  invariant(EXECUTION_STATES.includes(currentState) && EXECUTION_STATES.includes(targetState), "unknown execution state");
  invariant(INTERNAL_ACTION_TARGETS[action].includes(`${currentState}:${targetState}`), `action ${action} cannot perform requested transition`);
  invariant(ALLOWED_TRANSITIONS[currentState]?.includes(targetState), "state transition is not allowed");
  validateEvidence(inputEvidence);
  validateProgramLineage(programLineage);
  invariant(canonicalJson(programLineage) === canonicalJson(capabilityRelease.programLineage), "program lineage differs from capability release");
  invariant(Number.isInteger(attemptNumber) && attemptNumber >= 1, "attemptNumber must be a positive integer");
  if (action === "infrastructure.recover_bounded") {
    invariant(attemptNumber <= capabilityRelease.runtimeAutonomyPolicy.maxInfrastructureRecoveryAttempts, "infrastructure recovery attempt limit exceeded");
  } else invariant(attemptNumber === 1, "non-recovery internal actions are single-attempt");
  invariant(typeof outputNamespace === "string" && SAFE_RUNTIME_NAMESPACE_PATTERN.test(outputNamespace), "outputNamespace must be a project runtime namespace");
  invariant(!outputNamespace.includes("..") && !outputNamespace.includes("\\"), "outputNamespace must be normalized");
  invariant(outputNamespace.startsWith(`${capabilityRelease.outputRoot}/`), "outputNamespace is outside capability release outputRoot");
  invariant(typeof issuedAt === "string" && !Number.isNaN(Date.parse(issuedAt)), "issuedAt must be an ISO timestamp");
  invariant(typeof expiresAt === "string" && !Number.isNaN(Date.parse(expiresAt)), "expiresAt must be an ISO timestamp");
  invariant(Date.parse(expiresAt) > Date.parse(issuedAt), "ticket expiry must be after issue time");
  validateSafeId(nonce, "ticket nonce");
  invariant(signingPrivateKey, "machine signing private key is required");
  const derivedPublicKey = createPublicKey(signingPrivateKey).export({ type: "spki", format: "pem" });
  invariant(sha256Of(Buffer.from(derivedPublicKey)) === verified.ticketIssuer.publicKeySha256, "machine signing key is not the trusted ticket issuer");

  const ticketBody = {
    schemaVersion: "ai-painter-runtime-capability-ticket-v3",
    ticketId: `rct-${sha256Of({ release: capabilityRelease.capabilityReleaseIdentity, action, currentState, targetState, inputEvidence, attemptNumber, outputNamespace, nonce }).slice(0, 32)}`,
    issuerIdentity: verified.ticketIssuer.identity,
    issuerKeyId: verified.ticketIssuer.keyId,
    capabilityReleaseIdentity: capabilityRelease.capabilityReleaseIdentity,
    capabilityReleasePath: verified.capabilityReleasePath,
    capabilityReleaseSha256: verified.capabilityReleaseSha256,
    trustedReleaseRegistryPath: verified.trustedReleaseRegistryPath,
    trustedReleaseRegistrySha256: verified.trustedReleaseRegistrySha256,
    policyContractId: RUNTIME_AUTONOMY_CONTRACT_ID,
    policyContractPath: verified.policyPath,
    policyContractSha256: verified.policySha256,
    action, currentState, targetState,
    inputEvidence: canonicalize(inputEvidence),
    programLineage: canonicalize(programLineage),
    outputNamespace, attemptNumber, nonce, issuedAt, expiresAt,
    noPrivilegeEscalation: true,
    singleUse: true,
    status: "issued_not_consumed",
  };
  const ticketSha256 = sha256Of(ticketBody);
  const signedEnvelope = canonicalJson({ ...ticketBody, ticketSha256 });
  const machineSignature = signBytes(null, Buffer.from(signedEnvelope, "utf8"), signingPrivateKey).toString("base64url");
  return deepFreeze({ ...ticketBody, ticketSha256, machineSignature });
}

export function validateRuntimeCapabilityTicketIntegrity(ticket, { publicKey, issuerIdentity, issuerKeyId } = {}) {
  invariant(ticket && typeof ticket === "object" && !Array.isArray(ticket), "ticket is required");
  invariant(publicKey, "trusted ticket issuer public key is required");
  validateSha256(ticket.ticketSha256, "ticketSha256");
  invariant(ticket.issuerIdentity === issuerIdentity, "ticket issuer identity mismatch");
  invariant(ticket.issuerKeyId === issuerKeyId, "ticket issuer key mismatch");
  invariant(typeof ticket.machineSignature === "string" && ticket.machineSignature.length > 0, "machine signature is required");
  const { ticketSha256, machineSignature, ...ticketBody } = ticket;
  invariant(sha256Of(ticketBody) === ticketSha256, "ticket SHA-256 mismatch");
  const signedEnvelope = canonicalJson({ ...ticketBody, ticketSha256 });
  invariant(verifyBytes(null, Buffer.from(signedEnvelope, "utf8"), publicKey, Buffer.from(machineSignature, "base64url")), "ticket machine signature mismatch");
  invariant(ticket.status === "issued_not_consumed", "ticket is not consumable");
  invariant(ticket.singleUse === true && ticket.noPrivilegeEscalation === true, "ticket safety flags are invalid");
  return true;
}

export function applyRuntimeStateTransition(ticket, executionState, {
  projectRoot,
  ticketLedgerPath = DEFAULT_TICKET_LEDGER_PATH,
  consumedAt = new Date().toISOString(),
} = {}) {
  const verified = loadAndValidateReleasedCapabilityBinding({
    projectRoot,
    capabilityReleasePath: ticket.capabilityReleasePath,
    trustedReleaseRegistryPath: ticket.trustedReleaseRegistryPath,
  });
  validateRuntimeCapabilityTicketIntegrity(ticket, {
    publicKey: verified.ticketIssuer.publicKey,
    issuerIdentity: verified.ticketIssuer.identity,
    issuerKeyId: verified.ticketIssuer.keyId,
  });
  invariant(!Number.isNaN(Date.parse(consumedAt)), "consumedAt must be an ISO timestamp");
  invariant(Date.parse(consumedAt) >= Date.parse(ticket.issuedAt), "ticket cannot be consumed before issue time");
  invariant(Date.parse(consumedAt) <= Date.parse(ticket.expiresAt), "ticket is expired");
  invariant(verified.capabilityReleaseSha256 === ticket.capabilityReleaseSha256, "ticket release SHA no longer matches trusted release");
  invariant(verified.trustedReleaseRegistrySha256 === ticket.trustedReleaseRegistrySha256, "ticket registry SHA no longer matches trusted registry");
  invariant(verified.policySha256 === ticket.policyContractSha256, "ticket policy SHA no longer matches trusted policy");
  invariant(executionState?.capabilityReleaseIdentity === ticket.capabilityReleaseIdentity, "ticket capability release mismatch");
  invariant(executionState?.currentState === ticket.currentState, "ticket current state mismatch");

  const ledgerAbsolutePath = resolveInsideProject(projectRoot, ticketLedgerPath, "ticketLedgerPath");
  invariant(ticketLedgerPath.startsWith(".runtime/ai-painter/"), "ticket ledger must be in the AI Painter runtime namespace");
  fs.mkdirSync(path.dirname(ledgerAbsolutePath), { recursive: true });
  const db = new DatabaseSync(ledgerAbsolutePath);
  let persistenceFailed = false;
  try {
    db.exec(`
      PRAGMA busy_timeout=5000;
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS runtime_capability_ticket_consumptions (
        ticket_id TEXT PRIMARY KEY,
        ticket_sha256 TEXT NOT NULL UNIQUE,
        capability_release_identity TEXT NOT NULL,
        action TEXT NOT NULL,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        output_namespace TEXT NOT NULL,
        consumed_at_utc TEXT NOT NULL,
        consumption_json TEXT NOT NULL,
        UNIQUE(capability_release_identity, action, output_namespace)
      );
    `);
    const consumption = {
      schemaVersion: "ai-painter-runtime-capability-consumption-v3",
      ticketId: ticket.ticketId,
      ticketSha256: ticket.ticketSha256,
      issuerIdentity: ticket.issuerIdentity,
      issuerKeyId: ticket.issuerKeyId,
      capabilityReleaseIdentity: ticket.capabilityReleaseIdentity,
      action: ticket.action,
      fromState: ticket.currentState,
      toState: ticket.targetState,
      outputNamespace: ticket.outputNamespace,
      status: "consumed_once_persisted",
      consumedAt,
    };
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`
        INSERT INTO runtime_capability_ticket_consumptions(
          ticket_id, ticket_sha256, capability_release_identity, action,
          from_state, to_state, output_namespace, consumed_at_utc, consumption_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ticket.ticketId, ticket.ticketSha256, ticket.capabilityReleaseIdentity, ticket.action,
        ticket.currentState, ticket.targetState, ticket.outputNamespace, consumedAt, JSON.stringify(consumption),
      );
      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* Preserve the original storage failure. */ }
      // SQLite extended constraint codes: PRIMARYKEY and UNIQUE. Busy, IO and
      // other constraint failures do not establish that a ticket was replayed.
      if (error?.code === "ERR_SQLITE_ERROR" && [1555, 2067].includes(error.errcode)) {
        throw new Error(`ticket replay or output reuse rejected: ${error.message}`, { cause: error });
      }
      throw error;
    }
    executionState.currentState = ticket.targetState;
    return Object.freeze({ ...consumption, resultingState: executionState.currentState, ticketLedgerPath });
  } catch (error) {
    persistenceFailed = true;
    throw error;
  } finally {
    try { db.close(); } catch (closeError) {
      if (!persistenceFailed) throw closeError;
    }
  }
}

export function adjudicateBoundedDecision({ decisionSetId, ruleVersion, optionIds, matchedOptionIds, evidenceReferences, evidenceComplete }) {
  validateSafeId(decisionSetId, "decisionSetId");
  validateSafeId(ruleVersion, "ruleVersion");
  invariant(Array.isArray(optionIds) && optionIds.length >= 2, "at least two bounded options are required");
  invariant(new Set(optionIds).size === optionIds.length, "decision options must be unique");
  invariant(Array.isArray(matchedOptionIds), "matchedOptionIds must be an array");
  validateEvidence(evidenceReferences);
  invariant(matchedOptionIds.every((id) => optionIds.includes(id)), "matched option is outside bounded decision set");
  const uniqueMatches = [...new Set(matchedOptionIds)];
  if (evidenceComplete !== true || uniqueMatches.length !== 1) {
    return Object.freeze({
      decisionSetId,
      ruleVersion,
      status: "blocked_policy_boundary",
      failureCode: evidenceComplete !== true ? "evidence_incomplete" : "evidence_ambiguous",
      matchedOption: null,
      rejectedOptions: [],
      ownerResponseRequired: false,
      evidenceReferences: canonicalize(evidenceReferences),
    });
  }
  const matchedOption = uniqueMatches[0];
  return Object.freeze({
    decisionSetId,
    ruleVersion,
    status: "uniquely_adjudicated",
    matchedOption,
    rejectedOptions: optionIds.filter((id) => id !== matchedOption),
    reason: "exactly_one_frozen_rule_option_matched",
    ownerResponseRequired: false,
    evidenceReferences: canonicalize(evidenceReferences),
  });
}

export function createPolicyBoundaryReport({ reportId, boundaryClass, evidenceReferences, detectedAt, safeAlternative = null }) {
  validateSafeId(reportId, "reportId");
  invariant(POLICY_BOUNDARY_CLASSES.has(boundaryClass), "unknown policy boundary class");
  validateEvidence(evidenceReferences);
  invariant(typeof detectedAt === "string" && !Number.isNaN(Date.parse(detectedAt)), "detectedAt must be an ISO timestamp");
  return deepFreeze({
    schemaVersion: "ai-painter-policy-boundary-report-v1",
    reportId,
    status: "blocked_policy_boundary",
    boundaryClass,
    detectedAt,
    safeAlternative,
    ownerAuthorizationRequested: false,
    ownerResponseRequired: false,
    evidenceReferences: canonicalize(evidenceReferences),
  });
}

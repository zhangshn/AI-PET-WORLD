import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {createHistoricalWeatherFixture,readHistoricalWeatherRegistry} from "./helpers/historical-environment-qualification.mjs";
import {
  REQUIRED_BINDING_ROLES, RUNTIME_AUTONOMY_POLICY_PATH, TRUSTED_RELEASE_REGISTRY_PATH,
  inspectCapabilityScopeAdmission, loadAndValidateReleasedCapabilityBinding, sha256Of,
  inspectWorldEvolutionCandidateQualification,
} from "../lib/ai-painter-autonomous-package-decision-core-v3.mjs";
import { publishMachineAdjudicatedCapability } from "../lib/ai-painter-machine-capability-release-orchestrator-v1.mjs";
import { CAPABILITY_LIFECYCLE_CONTRACT_PATH, advanceCapabilityLifecycle, createCapabilityCandidate }
  from "../lib/ai-painter-capability-lifecycle-v1.mjs";

const sourceRoot = path.resolve(import.meta.dirname, "../..");
const sourceRegistry = JSON.parse(readHistoricalWeatherRegistry());
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "world-admission-161-"));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(`${path.resolve(os.tmpdir())}${path.sep}world-admission-161-`));
    fs.rmSync(root, { recursive: true, force: true });
  });
  function write(relative, value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), bytes);
    return { path: relative, sha256: sha256Of(bytes) };
  }
  write(TRUSTED_RELEASE_REGISTRY_PATH, sourceRegistry);
  return { root, write };
}
function snapshot(root) {
  const result = {};
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else result[path.relative(root, absolute)] = sha256Of(fs.readFileSync(absolute));
    }
  }
  walk(root); return result;
}
function noIo(callback) {
  const names = ["readFileSync", "writeFileSync", "mkdirSync", "openSync", "renameSync", "existsSync", "statSync", "realpathSync", "rmSync"];
  const originals = names.map(name => [name, fs[name]]);
  let calls = 0;
  try {
    for (const [name] of originals) fs[name] = () => { calls++; throw Error(`unexpected IO ${name}`); };
    callback(); assert.equal(calls, 0);
  } finally { for (const [name, original] of originals) fs[name] = original; }
}
function unsupported(error) {
  assert.equal(error.code, "unsupported_scope"); assert.equal(error.status, "unsupported_scope");
  assert.equal(error.productionAdmitted, false); return true;
}

test("candidate qualification entry rejects caller claims and executable options before loading evidence", async () => {
  let getterCalls = 0;
  const getter = { get projectRoot() { getterCalls++; return sourceRoot; } };
  const proxy = new Proxy({}, { getPrototypeOf() { getterCalls++; throw Error("proxy trap"); } });
  for (const options of [getter, proxy, null, [], Object.create({ projectRoot: sourceRoot }),
    { projectRoot: sourceRoot, passed: true }, { projectRoot: sourceRoot, productionAdmitted: true },
    { projectRoot: sourceRoot, read: () => ({ passed: true }) },
    { projectRoot: sourceRoot, manifestPath: "caller.json" }, { projectRoot: "" },
    { [Symbol("passed")]: true }]) {
    await assert.rejects(inspectWorldEvolutionCandidateQualification(options), /candidate qualification/);
  }
  assert.equal(getterCalls, 0);
});

test("candidate qualification snapshots options and keeps verified private evidence separate from release authority", async t => {
  const {fixture,cleanup}=createHistoricalWeatherFixture();
  t.after(cleanup);
  const options = { projectRoot: fixture };
  const pending = inspectWorldEvolutionCandidateQualification(options);
  options.projectRoot = "changed-after-request-invalid-root";
  options.productionAdmitted = true;
  const result = await pending;
  assert.equal(result.verifierSupported, true);
  assert.equal(result.numericalEvidenceVerified, true);
  assert.equal(result.initializedPrivateTransitionVerified, true);
  assert.equal(result.fullContextRetrospectiveInitializationVerified, true);
  assert.equal(result.productionScopeSupported, false);
  assert.equal(result.productionAdmitted, false);
  assert.equal(result.modelForwards, 0);
  assert.equal(result.registryWrites, 0);
  assert.equal(result.worldWrites, 0);
  assert.ok(Object.isFrozen(result));
  assert.ok(result.productionBlockers.length > 0);
});

test("reader and publisher reject every explicit unsupported scope before any IO", () => {
  for (const scope of ["world_evolution", "unknown_scope", "visual_world_generation", "", null, false, {}, []]) {
    noIo(() => {
      assert.throws(() => loadAndValidateReleasedCapabilityBinding({
        projectRoot: "does-not-exist", requiredCapabilityScope: scope, passed: true, productionAdmitted: true,
      }), unsupported);
      assert.throws(() => publishMachineAdjudicatedCapability({ passed: true, productionAdmitted: true }, {
        root: "does-not-exist", requiredCapabilityScope: scope, expectedRegistryRevision: 0,
      }), unsupported);
    });
  }
});

test("legacy actual publisher/reader fixture remains compatible; generic passing release cannot grant world scope", t => {
  const f = fixture(t);
  for (const relative of [CAPABILITY_LIFECYCLE_CONTRACT_PATH, RUNTIME_AUTONOMY_POLICY_PATH])
    f.write(relative, fs.readFileSync(path.join(sourceRoot, relative)));
  const evidence = f.write("fixtures/source.json", { source: true });
  const capabilityVersion = "admission-fixture-capability-v1";
  createCapabilityCandidate({ schemaVersion: "ai-painter-capability-change-candidate-v1", capabilityVersion,
    changeClass: "model_family", ownerAuthorizationRequired: false, ownerInLifecycle: false, sourceEvidence: [evidence] }, { root: f.root });
  for (const targetState of ["isolated_implementation", "cpu_contract_verified", "controlled_smoke_completed",
    "formal_stage_validation_completed", "independent_regression_completed", "machine_release_adjudicated"])
    advanceCapabilityLifecycle({ root: f.root, capabilityVersion, targetState, evidence: {
      schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion, targetState, status: "passed", bindings: [evidence],
    } });
  const bindings = Object.fromEntries(REQUIRED_BINDING_ROLES.map(role => [role, {
    identity: `${role}-fixture`, ...f.write(`fixtures/${role}.json`, { role, passed: true }),
  }]));
  const { publicKey } = generateKeyPairSync("ed25519");
  const key = f.write("fixtures/public.pem", Buffer.from(publicKey.export({ type: "spki", format: "pem" })));
  const draft = {
    schemaVersion: "ai-painter-capability-release-draft-v1", capabilityReleaseIdentity: "admission-fixture-release-v1",
    modelCapabilityVersion: capabilityVersion, ownerAuthorizationRequired: false, ownerDecisionUsed: false,
    lifecycleRoot: `.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`, bindings, releaseEvidence: [evidence],
    ticketIssuer: { identity: "fixture-ticket-issuer", keyId: "fixture-key-v1", publicKeyPath: key.path, publicKeySha256: key.sha256 },
    programLineage: { fixture: sha256Of("fixture") }, outputRoot: ".runtime/ai-painter/fixture-161", maxInfrastructureRecoveryAttempts: 0,
  };
  const released = publishMachineAdjudicatedCapability(draft, { root: f.root, expectedRegistryRevision: 0 });
  assert.equal(released.status, "released");
  const options = { projectRoot: f.root, capabilityReleasePath: released.releasePath, trustedReleaseRegistryPath: TRUSTED_RELEASE_REGISTRY_PATH };
  assert.equal(loadAndValidateReleasedCapabilityBinding(options).verificationStatus, "verified_from_machine_adjudication_and_trusted_registry");
  const before = snapshot(f.root);
  assert.throws(() => loadAndValidateReleasedCapabilityBinding({ ...options, requiredCapabilityScope: "world_evolution", passed: true }), unsupported);
  assert.throws(() => publishMachineAdjudicatedCapability({ ...draft, passed: true }, { root: f.root, expectedRegistryRevision: 1, requiredCapabilityScope: "world_evolution" }), unsupported);
  assert.throws(() => inspectCapabilityScopeAdmission({ projectRoot: f.root, passed: true }), /unknown preflight option/);
  const result = inspectCapabilityScopeAdmission({ projectRoot: f.root, requiredCapabilityScope: "world_evolution" });
  assert.equal(result.registry.releaseCount, 1); assert.equal(result.productionAdmitted, false);
  assert.equal(result.capabilityStatus, "scope_qualification_not_verified");
  assert.deepEqual(snapshot(f.root), before);
  const validRegistry = JSON.parse(fs.readFileSync(path.join(f.root, TRUSTED_RELEASE_REGISTRY_PATH), "utf8"));
  for (const mutate of [
    r => { r.releaseRecords[0].releasePath = "../outside.json"; },
    r => { r.releaseRecords[0].machineReleaseAdjudicationPath = `${r.releaseRoot}/different-id/review.json`; },
    r => { r.releaseRecords[0].releaseSha256 = "passing"; },
    r => { r.releaseRecords[0].registryRevision = 2; },
    r => { r.releaseRecords.push(structuredClone(r.releaseRecords[0])); },
    r => { r.releaseRecords[0].ticketIssuerKeyId = "../escape"; },
  ]) {
    const changed = structuredClone(validRegistry); mutate(changed); f.write(TRUSTED_RELEASE_REGISTRY_PATH, changed);
    const mutatedBefore = snapshot(f.root);
    assert.throws(() => inspectCapabilityScopeAdmission({ projectRoot: f.root }));
    assert.deepEqual(snapshot(f.root), mutatedBefore);
  }
});

test("read-only inventory reports missing capability without trusting caller qualification", t => {
  const f = fixture(t), before = snapshot(f.root);
  for (const key of ["passed", "scopeSupported", "policyShapeStatus", "domainConsumerStatus", "productionAdmitted", "policyShapeValid", "domainConsumerReady"])
    noIo(() => assert.throws(() => inspectCapabilityScopeAdmission({ projectRoot: f.root, [key]: true }), /unknown preflight option/));
  const result = inspectCapabilityScopeAdmission({ projectRoot: f.root });
  assert.equal(result.registry.releaseCount, 0); assert.equal(result.capabilityStatus, "qualification_missing");
  assert.equal(result.registry.sha256, before[TRUSTED_RELEASE_REGISTRY_PATH.split("/").join(path.sep)]);
  assert.equal(result.status, "unsupported_scope"); assert.equal(result.policyShapeStatus, "not_provided");
  assert.equal(result.domainConsumerStatus, "not_integrated"); assert.equal(result.productionAdmitted, false);
  assert.equal(inspectCapabilityScopeAdmission({ projectRoot: f.root, requiredCapabilityScope: "unknown" }).status, "unsupported_scope");
  assert.deepEqual(snapshot(f.root), before);
});

test("preflight does not evaluate accessor or prototype qualification claims", () => {
  let getterCalls = 0;
  noIo(() => {
    assert.throws(() => inspectCapabilityScopeAdmission({ get projectRoot() { getterCalls++; return "ignored"; } }), /accessors rejected/);
    assert.throws(() => inspectCapabilityScopeAdmission(Object.create({ passed: true })), /plain object/);
    assert.throws(() => inspectCapabilityScopeAdmission({ [Symbol("passed")]: true }), /unknown preflight option/);
  });
  assert.equal(getterCalls, 0);
});

test("preflight rejects registry redirection and physical path escape", t => {
  const f = fixture(t), outside = fixture(t);
  for (const registryPath of ["../registry.json", "C:/registry.json", "data/elsewhere.json"])
    noIo(() => assert.throws(() => inspectCapabilityScopeAdmission({ projectRoot: f.root, trustedReleaseRegistryPath: registryPath }), /untrusted.*registry path/));
  fs.rmSync(path.join(f.root, "data"), { recursive: true });
  fs.symlinkSync(path.join(outside.root, "data"), path.join(f.root, "data"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => inspectCapabilityScopeAdmission({ projectRoot: f.root }), /resolves outside project root/);
});

test("inventory validates registry header and every record, never counts malformed records", t => {
  const f = fixture(t);
  const invalid = [
    r => { r.releaseRoot = "../outside"; }, r => { r.registryRevision = 0.5; },
    r => { r.uniqueWriter.identity = "caller"; }, r => { r.trustBoundary.callerSuppliedVerificationFlagsAccepted = true; },
    r => { r.trustBoundary.allBoundArtifactSha256ValuesMustBeRecomputed = false; },
    r => { r.releaseRecords = [null]; r.status = "active_with_capability_release"; },
    r => { r.releaseRecords = [{ passed: true }]; r.status = "active_with_capability_release"; },
    r => { r.status = "active_with_capability_release"; },
  ];
  for (const mutate of invalid) {
    const registry = structuredClone(sourceRegistry); mutate(registry); f.write(TRUSTED_RELEASE_REGISTRY_PATH, registry);
    const before = snapshot(f.root);
    assert.throws(() => inspectCapabilityScopeAdmission({ projectRoot: f.root }));
    assert.deepEqual(snapshot(f.root), before);
  }
});

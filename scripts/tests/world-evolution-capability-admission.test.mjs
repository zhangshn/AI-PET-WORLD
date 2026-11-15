import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {createHistoricalWeatherFixture,readHistoricalWeatherRegistry} from "./helpers/historical-environment-qualification.mjs";
import {
  REQUIRED_BINDING_ROLES, RUNTIME_AUTONOMY_POLICY_PATH, TRUSTED_RELEASE_REGISTRY_PATH,
  inspectCapabilityScopeAdmission, loadAndValidateReleasedCapabilityBinding, sha256Of,
  inspectWorldEvolutionCandidateQualification,
  deriveRuntimeCapabilityTicket, applyRuntimeStateTransition,
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

function publisherFixture(t) {
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
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const key = f.write("fixtures/public.pem", Buffer.from(publicKey.export({ type: "spki", format: "pem" })));
  const draft = {
    schemaVersion: "ai-painter-capability-release-draft-v1", capabilityReleaseIdentity: "admission-fixture-release-v1",
    modelCapabilityVersion: capabilityVersion, ownerAuthorizationRequired: false, ownerDecisionUsed: false,
    lifecycleRoot: `.runtime/ai-painter/capability-lifecycle/${capabilityVersion}`, bindings, releaseEvidence: [evidence],
    ticketIssuer: { identity: "fixture-ticket-issuer", keyId: "fixture-key-v1", publicKeyPath: key.path, publicKeySha256: key.sha256 },
    programLineage: { fixture: sha256Of("fixture") }, outputRoot: ".runtime/ai-painter/fixture-161", maxInfrastructureRecoveryAttempts: 0,
  };
  return { f, draft, privateKey };
}

for (const phase of ["success-and-replay", "commit", "close"]) test(`ticket persistence private SQLite preserves actual state at ${phase}`, t => {
  const { f, draft, privateKey } = publisherFixture(t);
  const release = publishMachineAdjudicatedCapability(draft, { root: f.root, expectedRegistryRevision: 0 });
  const issuedAt = new Date().toISOString(), consumedAt = issuedAt;
  const ticket = deriveRuntimeCapabilityTicket({ projectRoot: f.root, capabilityReleasePath: release.releasePath,
    trustedReleaseRegistryPath: TRUSTED_RELEASE_REGISTRY_PATH, action: "preflight.verify", currentState: "package_materialized",
    targetState: "preflight", inputEvidence: draft.releaseEvidence, programLineage: draft.programLineage,
    outputNamespace: `${draft.outputRoot}/private-ticket`, issuedAt,
    expiresAt: new Date(Date.parse(issuedAt) + 60000).toISOString(), signingPrivateKey: privateKey });
  const state = { capabilityReleaseIdentity: draft.capabilityReleaseIdentity, currentState: "package_materialized" };
  const exec = DatabaseSync.prototype.exec, close = DatabaseSync.prototype.close;
  const primary = new Error("ticket private commit"), rollback = new Error("ticket private rollback"), cleanup = new Error("ticket private close");
  const ticketDatabases = new WeakSet();
  let closed = 0, caught, threw = false, result;
  try {
    DatabaseSync.prototype.exec = function (sql) {
      if (sql.includes("CREATE TABLE IF NOT EXISTS runtime_capability_ticket_consumptions")) ticketDatabases.add(this);
      if (ticketDatabases.has(this) && phase === "commit" && sql === "COMMIT") throw primary;
      const value = exec.call(this, sql);
      if (ticketDatabases.has(this) && phase === "commit" && sql === "ROLLBACK") throw rollback;
      return value;
    };
    DatabaseSync.prototype.close = function () {
      close.call(this);
      if (ticketDatabases.has(this)) { closed++; if (phase !== "success-and-replay") throw cleanup; }
    };
    try { result = applyRuntimeStateTransition(ticket, state, { projectRoot: f.root, consumedAt }); }
    catch (error) { caught = error; threw = true; }
  } finally { DatabaseSync.prototype.exec = exec; DatabaseSync.prototype.close = close; }
  assert.equal(closed, 1); assert.equal(threw, phase !== "success-and-replay");
  if (phase === "commit") { assert.equal(caught.cause, primary); assert.deepEqual(caught.errors, [primary, rollback, cleanup]); }
  if (phase === "close") assert.equal(caught, cleanup);
  assert.equal(state.currentState, phase === "commit" ? "package_materialized" : "preflight");
  const db = new DatabaseSync(path.join(f.root, ".runtime/ai-painter/capability-runtime-ticket-ledger.sqlite"), { readOnly: true });
  try { assert.equal(db.prepare("SELECT COUNT(*) AS n FROM runtime_capability_ticket_consumptions").get().n, phase === "commit" ? 0 : 1); }
  finally { db.close(); }
  if (phase === "success-and-replay") {
    assert.equal(result.resultingState, "preflight");
    const stale = { ...state, currentState: "package_materialized" };
    assert.throws(() => applyRuntimeStateTransition(ticket, stale, { projectRoot: f.root, consumedAt }), error =>
      /ticket replay or output reuse rejected/.test(error.message) && [1555, 2067].includes(error.cause?.errcode));
    assert.equal(stale.currentState, "package_materialized");
  }
});

test("release recovery preserves an existing foreign temporary file", t => {
  const { f, draft } = publisherFixture(t);
  const registryPath = path.join(f.root, TRUSTED_RELEASE_REGISTRY_PATH);
  const original = fs.readFileSync(registryPath), temporary = `${registryPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, "foreign temporary evidence", { flag: "wx" });
  assert.throws(() => publishMachineAdjudicatedCapability(draft, { root: f.root, expectedRegistryRevision: 0 }),
    error => error.code === "EEXIST");
  assert.equal(fs.readFileSync(temporary, "utf8"), "foreign temporary evidence");
  assert.deepEqual(fs.readFileSync(registryPath), original);
  const root = path.join(f.root, sourceRegistry.releaseRoot, draft.capabilityReleaseIdentity);
  assert(!fs.existsSync(root));
  assert(fs.existsSync(path.join(`${root}.staging-${process.pid}`, "release.json")));
});

for (const phase of ["registry-read", "journal", "begin", "commit", "restore", "demote", "restore-and-demote", "close"]) {
  test(`release recovery uses private SQLite and retains evidence after ${phase} failure`, t => {
    const { f, draft } = publisherFixture(t);
    const registryPath = path.join(f.root, TRUSTED_RELEASE_REGISTRY_PATH);
    const originalRegistry = fs.readFileSync(registryPath);
    const releaseRoot = path.join(f.root, sourceRegistry.releaseRoot, draft.capabilityReleaseIdentity);
    const staging = `${releaseRoot}.staging-${process.pid}`;
    const primary = Object.freeze(new Error(`private ${phase} failure`));
    const rollbackFailure = new Error("private rollback failure"), closeFailure = new Error("private close failure");
    const recoveryFailure = new Error("private file recovery failure");
    const original = { read: fs.readFileSync, write: fs.writeFileSync, rename: fs.renameSync,
      remove: fs.rmSync, exec: DatabaseSync.prototype.exec, close: DatabaseSync.prototype.close };
    let opened = false, closed = 0, rollbackCalls = 0, removed = 0, caught, threw = false;
    try {
      DatabaseSync.prototype.exec = function (sql) {
        if (sql.includes("CREATE TABLE IF NOT EXISTS releases")) opened = true;
        if (opened && sql === "BEGIN IMMEDIATE" && phase === "begin") throw primary;
        if (opened && sql === "COMMIT" && ["commit", "restore", "demote", "restore-and-demote"].includes(phase)) throw primary;
        if (opened && sql === "ROLLBACK") {
          rollbackCalls++;
          original.exec.call(this, sql);
          if (phase === "commit") throw rollbackFailure;
          return;
        }
        return original.exec.call(this, sql);
      };
      DatabaseSync.prototype.close = function () {
        const result = original.close.call(this);
        if (opened) { closed++; if (["commit", "close"].includes(phase)) throw closeFailure; }
        return result;
      };
      fs.readFileSync = function (file, ...args) {
        if (opened && file === registryPath && phase === "registry-read") throw primary;
        return original.read(file, ...args);
      };
      fs.writeFileSync = function (file, ...args) {
        if (phase === "journal" && file === path.join(staging, "publish-journal.json")) throw primary;
        return original.write(file, ...args);
      };
      fs.renameSync = function (from, to) {
        if ((["restore", "restore-and-demote"].includes(phase) && from === `${registryPath}.tmp-${process.pid}.restore`)
          || (["demote", "restore-and-demote"].includes(phase) && from === releaseRoot && to === staging)) throw recoveryFailure;
        return original.rename(from, to);
      };
      fs.rmSync = function (...args) { removed++; return original.remove(...args); };
      try { publishMachineAdjudicatedCapability(draft, { root: f.root, expectedRegistryRevision: 0 }); }
      catch (error) { caught = error; threw = true; }
    } finally {
      fs.readFileSync = original.read; fs.writeFileSync = original.write;
      fs.renameSync = original.rename; fs.rmSync = original.remove;
      DatabaseSync.prototype.exec = original.exec; DatabaseSync.prototype.close = original.close;
    }
    assert.equal(threw, true);
    const expected = phase === "commit" ? [primary, rollbackFailure, closeFailure]
      : phase === "restore-and-demote" ? [primary, recoveryFailure, recoveryFailure]
      : ["restore", "demote"].includes(phase) ? [primary, recoveryFailure]
        : [phase === "close" ? closeFailure : primary];
    if (expected.length === 1) assert.equal(caught, expected[0]);
    else { assert.equal(caught.cause, primary); assert.deepEqual(caught.errors, expected); }
    assert.equal(closed, 1); assert.equal(removed, 0);
    assert.equal(rollbackCalls, ["commit", "restore", "demote", "restore-and-demote"].includes(phase) ? 1 : 0);
    const evidenceRoot = ["demote", "restore-and-demote", "close"].includes(phase) ? releaseRoot : staging;
    assert(fs.existsSync(path.join(evidenceRoot, "release.json")));
    assert(fs.existsSync(path.join(evidenceRoot, "machine-release-adjudication.json")));
    if (phase !== "registry-read") assert.deepEqual(fs.readFileSync(path.join(evidenceRoot, "registry-before-publish.json")), originalRegistry);
    if (!["restore", "restore-and-demote", "close"].includes(phase)) assert.deepEqual(fs.readFileSync(registryPath), originalRegistry);
    else assert.equal(JSON.parse(fs.readFileSync(registryPath)).registryRevision, 1);
    const db = new DatabaseSync(path.join(f.root, ".runtime/ai-painter/capability-release-ledger.sqlite"));
    try { assert.equal(db.prepare("SELECT COUNT(*) AS n FROM releases").get().n, phase === "close" ? 1 : 0); }
    finally { db.close(); }
    const state = JSON.parse(fs.readFileSync(path.join(f.root, draft.lifecycleRoot, "state.json")));
    assert.equal(state.state, "machine_release_adjudicated");
    if (phase !== "close") assert.throws(() => loadAndValidateReleasedCapabilityBinding({
      projectRoot: f.root, capabilityReleasePath: `${sourceRegistry.releaseRoot}/${draft.capabilityReleaseIdentity}/release.json`,
      trustedReleaseRegistryPath: TRUSTED_RELEASE_REGISTRY_PATH,
    }));
  });
}

for (const kind of ["missing-row", "wrong-sha", "wrong-path", "wrong-revision", "wrong-identity", "missing-ledger"]) {
  test(`generic release reader rejects ${kind} without changing evidence`, t => {
    const { f, draft } = publisherFixture(t);
    const released = publishMachineAdjudicatedCapability(draft, { root: f.root, expectedRegistryRevision: 0 });
    const options = { projectRoot: f.root, capabilityReleasePath: released.releasePath, trustedReleaseRegistryPath: TRUSTED_RELEASE_REGISTRY_PATH };
    const ledgerPath = path.join(f.root, ".runtime/ai-painter/capability-release-ledger.sqlite");
    const registryBefore = fs.readFileSync(path.join(f.root, TRUSTED_RELEASE_REGISTRY_PATH));
    const releaseBefore = fs.readFileSync(path.join(f.root, released.releasePath));
    if (kind === "missing-ledger") fs.renameSync(ledgerPath, `${ledgerPath}.saved`);
    else {
      const db = new DatabaseSync(ledgerPath);
      try {
        const statements = {
          "missing-row": "DELETE FROM releases",
          "wrong-sha": "UPDATE releases SET release_sha256 = 'wrong'",
          "wrong-path": "UPDATE releases SET release_path = 'wrong'",
          "wrong-revision": "UPDATE releases SET registry_revision = 2",
          "wrong-identity": "UPDATE releases SET capability_release_identity = 'different-identity'",
        };
        db.exec(statements[kind]);
      } finally { db.close(); }
    }
    const databaseBefore = kind === "missing-ledger" ? null : fs.readFileSync(ledgerPath);
    assert.throws(() => loadAndValidateReleasedCapabilityBinding(options), kind === "missing-ledger" ? /ENOENT/ : /capability release ledger differs/);
    assert.deepEqual(fs.readFileSync(path.join(f.root, TRUSTED_RELEASE_REGISTRY_PATH)), registryBefore);
    assert.deepEqual(fs.readFileSync(path.join(f.root, released.releasePath)), releaseBefore);
    if (kind === "missing-ledger") assert(!fs.existsSync(ledgerPath));
    else assert.deepEqual(fs.readFileSync(ledgerPath), databaseBefore);
  });
}

for (const [label, primary, failQuery, failClose] of [
  ["frozen query and close", Object.freeze(new Error("query failed")), true, true],
  ["undefined query and close", undefined, true, true],
  ["null query and close", null, true, true],
  ["false query and close", false, true, true],
  ["query alone", new Error("query only"), true, false],
  ["close alone", null, false, true],
]) {
  test(`generic release reader retains ${label}`, t => {
    const { f, draft } = publisherFixture(t);
    const released = publishMachineAdjudicatedCapability(draft, { root: f.root, expectedRegistryRevision: 0 });
    const options = { projectRoot: f.root, capabilityReleasePath: released.releasePath, trustedReleaseRegistryPath: TRUSTED_RELEASE_REGISTRY_PATH };
    const prepare = DatabaseSync.prototype.prepare, close = DatabaseSync.prototype.close, closeError = new Error("reader close failed");
    let closed = 0, caught, threw = false;
    try {
      DatabaseSync.prototype.prepare = function (sql, ...args) {
        if (failQuery && sql === "SELECT * FROM releases WHERE capability_release_identity=?") throw primary;
        return prepare.call(this, sql, ...args);
      };
      DatabaseSync.prototype.close = function () {
        close.call(this); closed++; if (failClose) throw closeError;
      };
      try { loadAndValidateReleasedCapabilityBinding(options); } catch (error) { caught = error; threw = true; }
    } finally { DatabaseSync.prototype.prepare = prepare; DatabaseSync.prototype.close = close; }
    assert.equal(threw, true); assert.equal(closed, 1);
    if (failQuery && failClose) { assert.equal(caught.cause, primary); assert.deepEqual(caught.errors, [primary, closeError]); }
    else assert.equal(caught, failQuery ? primary : closeError);
    assert.equal(loadAndValidateReleasedCapabilityBinding(options).verificationStatus, "verified_from_machine_adjudication_and_trusted_registry");
  });
}

test("legacy actual publisher/reader fixture remains compatible; generic passing release cannot grant world scope", t => {
  const { f, draft } = publisherFixture(t);
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

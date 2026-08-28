import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CAPABILITY_RELEASE_SCHEMA,
  MACHINE_RELEASE_ADJUDICATION_SCHEMA,
  RELEASE_ORCHESTRATOR_IDENTITY,
  REQUIRED_BINDING_ROLES,
  RUNTIME_AUTONOMY_CONTRACT_ID,
  RUNTIME_AUTONOMY_POLICY_PATH,
  TRUSTED_RELEASE_REGISTRY_PATH,
  loadAndValidateReleasedCapabilityBinding,
  sha256Of,
} from "./ai-painter-autonomous-package-decision-core-v3.mjs";
import { advanceCapabilityLifecycle } from "./ai-painter-capability-lifecycle-v1.mjs";

export const RELEASE_LEDGER_PATH = ".runtime/ai-painter/capability-release-ledger.sqlite";

export function publishMachineAdjudicatedCapability(draft, {
  root = process.cwd(), expectedRegistryRevision, recordedAtUtc = new Date().toISOString(),
} = {}) {
  validateDraft(draft, root);
  const registryPath = resolveExisting(root, TRUSTED_RELEASE_REGISTRY_PATH);
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  assert(registry.schemaVersion === "ai-painter-capability-release-registry-v2", "release registry schema mismatch");
  assert(registry.uniqueWriter?.identity === RELEASE_ORCHESTRATOR_IDENTITY, "release registry writer mismatch");
  assert(registry.uniqueWriter?.compareAndSwapRevisionRequired === true && registry.uniqueWriter?.sqliteTransactionRequired === true, "release registry transaction contract mismatch");
  assert(registry.trustBoundary?.ownerDecisionAcceptedAsReleaseAuthority === false, "Owner decision cannot be release authority");
  assert(registry.registryRevision === expectedRegistryRevision, "release registry revision conflict");
  assert(!registry.releaseRecords.some((record) => record.capabilityReleaseIdentity === draft.capabilityReleaseIdentity), "capability release identity already exists");

  const policyPath = resolveExisting(root, RUNTIME_AUTONOMY_POLICY_PATH);
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const policySha256 = sha256File(policyPath);
  assert(policy.contractId === RUNTIME_AUTONOMY_CONTRACT_ID, "runtime autonomy policy mismatch");
  const lifecycleStatePath = `${draft.lifecycleRoot}/state.json`;
  const lifecycleStateAbsolute = resolveExisting(root, lifecycleStatePath);
  const lifecycleState = JSON.parse(fs.readFileSync(lifecycleStateAbsolute, "utf8"));
  assert(lifecycleState.capabilityVersion === draft.modelCapabilityVersion, "lifecycle capability version mismatch");
  assert(lifecycleState.state === "machine_release_adjudicated", "capability lifecycle is not machine adjudicated");

  const verifiedBindings = {};
  for (const role of REQUIRED_BINDING_ROLES) {
    const binding = draft.bindings[role];
    verifyBinding(root, binding, role);
    verifiedBindings[role] = { identity: binding.identity, path: normalize(binding.path), sha256: binding.sha256 };
  }
  const bindingSetSha256 = sha256Of(verifiedBindings);
  const programLineageSha256 = sha256Of(draft.programLineage);
  const releaseRelativeRoot = `${registry.releaseRoot}/${draft.capabilityReleaseIdentity}`;
  const releaseAbsoluteRoot = resolveInside(root, releaseRelativeRoot);
  assert(!fs.existsSync(releaseAbsoluteRoot), "capability release directory already exists");
  fs.mkdirSync(path.dirname(releaseAbsoluteRoot), { recursive: true });
  const staging = `${releaseAbsoluteRoot}.staging-${process.pid}`;
  assert(!fs.existsSync(staging), "capability release staging directory already exists");
  fs.mkdirSync(staging, { recursive: false });

  const adjudicationRelativePath = `${releaseRelativeRoot}/machine-release-adjudication.json`;
  const releaseRelativePath = `${releaseRelativeRoot}/release.json`;
  const adjudication = {
    schemaVersion: MACHINE_RELEASE_ADJUDICATION_SCHEMA,
    adjudicationId: `machine-adjudication-${draft.capabilityReleaseIdentity}`,
    status: "released", writerIdentity: RELEASE_ORCHESTRATOR_IDENTITY,
    capabilityReleaseIdentity: draft.capabilityReleaseIdentity,
    bindingSetSha256, policyContractSha256: policySha256, programLineageSha256,
    lifecycleState: { path: lifecycleStatePath, sha256: sha256File(lifecycleStateAbsolute) },
    evidence: draft.releaseEvidence.map((binding) => ({ path: normalize(binding.path), sha256: binding.sha256 })),
    ownerDecisionUsed: false, recordedAtUtc,
  };
  const adjudicationBytes = bytesOf(adjudication);
  const adjudicationSha256 = sha256Of(adjudicationBytes);
  fs.writeFileSync(path.join(staging, "machine-release-adjudication.json"), adjudicationBytes, { flag: "wx" });
  const release = {
    schemaVersion: CAPABILITY_RELEASE_SCHEMA,
    capabilityReleaseIdentity: draft.capabilityReleaseIdentity,
    status: "released", modelCapabilityVersion: draft.modelCapabilityVersion,
    runtimeAutonomyPolicy: {
      contractId: RUNTIME_AUTONOMY_CONTRACT_ID, path: RUNTIME_AUTONOMY_POLICY_PATH,
      sha256: policySha256, allowedInternalActions: policy.releasedCapabilityInternalActions,
      maxInfrastructureRecoveryAttempts: draft.maxInfrastructureRecoveryAttempts,
    },
    bindings: verifiedBindings,
    machineReleaseAdjudication: { path: adjudicationRelativePath, sha256: adjudicationSha256 },
    ticketIssuer: { ...draft.ticketIssuer, publicKeyPath: normalize(draft.ticketIssuer.publicKeyPath) },
    programLineage: draft.programLineage,
    outputRoot: normalize(draft.outputRoot),
    createdBy: RELEASE_ORCHESTRATOR_IDENTITY, ownerDecisionUsed: false, recordedAtUtc,
  };
  const releaseBytes = bytesOf(release);
  const releaseSha256 = sha256Of(releaseBytes);
  fs.writeFileSync(path.join(staging, "release.json"), releaseBytes, { flag: "wx" });

  const nextRevision = expectedRegistryRevision + 1;
  const record = {
    capabilityReleaseIdentity: draft.capabilityReleaseIdentity,
    status: "released_trusted", registryRevision: nextRevision,
    releasePath: releaseRelativePath, releaseSha256, policyContractSha256: policySha256,
    bindingSetSha256, machineReleaseAdjudicationPath: adjudicationRelativePath,
    machineReleaseAdjudicationSha256: adjudicationSha256,
    ticketIssuerIdentity: draft.ticketIssuer.identity,
    ticketIssuerKeyId: draft.ticketIssuer.keyId,
    ticketIssuerPublicKeySha256: draft.ticketIssuer.publicKeySha256,
  };
  const nextRegistry = { ...registry, status: "active_with_capability_release", registryRevision: nextRevision, releaseRecords: [...registry.releaseRecords, record] };
  const ledgerPath = resolveInside(root, RELEASE_LEDGER_PATH);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const db = openDb(ledgerPath);
  const registryTemporary = `${registryPath}.tmp-${process.pid}`;
  const journalPath = path.join(staging, "publish-journal.json");
  const originalRegistryBytes = fs.readFileSync(registryPath);
  let releasePromoted = false;
  let registryReplaced = false;
  fs.writeFileSync(journalPath, bytesOf({ schemaVersion: "ai-painter-capability-release-publish-journal-v1", status: "prepared", expectedRegistryRevision, nextRevision, releaseRelativePath, releaseSha256, recordedAtUtc }), { flag: "wx" });
  try {
    db.exec("BEGIN IMMEDIATE");
    const latest = db.prepare("SELECT MAX(registry_revision) AS revision FROM releases").get().revision;
    if (latest === null) assert(expectedRegistryRevision === 0, "release ledger is missing prior registry revisions");
    else assert(Number(latest) === expectedRegistryRevision, "release ledger revision conflict");
    db.prepare("INSERT INTO releases(capability_release_identity, registry_revision, release_path, release_sha256, recorded_at_utc, owner_decision_used) VALUES (?, ?, ?, ?, ?, 0)").run(draft.capabilityReleaseIdentity, nextRevision, releaseRelativePath, releaseSha256, recordedAtUtc);
    fs.renameSync(staging, releaseAbsoluteRoot);
    releasePromoted = true;
    fs.writeFileSync(registryTemporary, bytesOf(nextRegistry), { flag: "wx" });
    fs.renameSync(registryTemporary, registryPath);
    registryReplaced = true;
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    if (fs.existsSync(registryTemporary)) fs.rmSync(registryTemporary, { force: true });
    if (registryReplaced) fs.writeFileSync(registryPath, originalRegistryBytes);
    if (releasePromoted && fs.existsSync(releaseAbsoluteRoot)) fs.rmSync(releaseAbsoluteRoot, { recursive: true, force: true });
    else if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  } finally { db.close(); }

  const verified = loadAndValidateReleasedCapabilityBinding({ projectRoot: root, capabilityReleasePath: releaseRelativePath, trustedReleaseRegistryPath: TRUSTED_RELEASE_REGISTRY_PATH });
  const releasedState = advanceCapabilityLifecycle({
    root, capabilityVersion: draft.modelCapabilityVersion, targetState: "released",
    evidence: {
      schemaVersion: "ai-painter-capability-stage-evidence-v1",
      capabilityVersion: draft.modelCapabilityVersion, targetState: "released", status: "passed",
      bindings: [{ path: releaseRelativePath, sha256: releaseSha256 }, { path: TRUSTED_RELEASE_REGISTRY_PATH, sha256: sha256File(registryPath) }],
    },
    releaseBinding: { capabilityReleasePath: releaseRelativePath, trustedReleaseRegistryPath: TRUSTED_RELEASE_REGISTRY_PATH },
    recordedAtUtc,
  });
  return { status: "released", capabilityReleaseIdentity: draft.capabilityReleaseIdentity, releasePath: releaseRelativePath, releaseSha256, registryRevision: nextRevision, registrySha256: sha256File(registryPath), lifecycleState: releasedState.state, verificationStatus: verified.verificationStatus, ownerAuthorizationRequired: false };
}

function validateDraft(draft, root) {
  assert(draft?.schemaVersion === "ai-painter-capability-release-draft-v1", "release draft schema mismatch");
  assert(/^[a-z0-9][a-z0-9-]{7,127}$/.test(draft.capabilityReleaseIdentity ?? ""), "release identity is invalid");
  assert(/^[a-z0-9][a-z0-9-]{7,127}$/.test(draft.modelCapabilityVersion ?? ""), "model capability version is invalid");
  assert(draft.ownerAuthorizationRequired === false && draft.ownerDecisionUsed === false, "release draft cannot use Owner authority");
  assert(draft.bindings && Object.keys(draft.bindings).sort().join(",") === [...REQUIRED_BINDING_ROLES].sort().join(","), "release binding roles mismatch");
  assert(Array.isArray(draft.releaseEvidence) && draft.releaseEvidence.length > 0, "release evidence is required");
  for (const binding of draft.releaseEvidence) verifyBinding(root, binding, "releaseEvidence");
  assert(draft.programLineage && Object.keys(draft.programLineage).length > 0, "program lineage is required");
  for (const digest of Object.values(draft.programLineage)) assert(/^[a-f0-9]{64}$/.test(digest), "program lineage SHA-256 is invalid");
  assert(Number.isInteger(draft.maxInfrastructureRecoveryAttempts) && draft.maxInfrastructureRecoveryAttempts >= 0 && draft.maxInfrastructureRecoveryAttempts <= 3, "release recovery limit is invalid");
  assert(typeof draft.lifecycleRoot === "string" && draft.lifecycleRoot.startsWith(".runtime/ai-painter/capability-lifecycle/"), "release lifecycle root is invalid");
  assert(typeof draft.outputRoot === "string" && draft.outputRoot.startsWith(".runtime/ai-painter/") && !draft.outputRoot.includes("..") && !draft.outputRoot.includes("\\"), "release outputRoot is invalid");
  assert(draft.ticketIssuer?.identity && draft.ticketIssuer?.keyId, "ticket issuer identity is required");
  verifyBinding(root, { path: draft.ticketIssuer.publicKeyPath, sha256: draft.ticketIssuer.publicKeySha256 }, "ticketIssuer");
}
function verifyBinding(root, binding, role) { assert(binding?.identity || role === "releaseEvidence" || role === "ticketIssuer", `${role} identity is required`); assert(/^[a-f0-9]{64}$/.test(binding?.sha256 ?? ""), `${role} SHA-256 is invalid`); const absolute = resolveExisting(root, binding.path); assert(sha256File(absolute) === binding.sha256, `${role} SHA-256 mismatch`); }
function openDb(file) { const db = new DatabaseSync(file); db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS releases(capability_release_identity TEXT PRIMARY KEY, registry_revision INTEGER NOT NULL UNIQUE, release_path TEXT NOT NULL UNIQUE, release_sha256 TEXT NOT NULL UNIQUE, recorded_at_utc TEXT NOT NULL, owner_decision_used INTEGER NOT NULL CHECK(owner_decision_used = 0));`); return db; }
function resolveExisting(root, relative) { const absolute = resolveInside(root, relative); assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `release file is missing: ${relative}`); return absolute; }
function resolveInside(root, relative) { assert(typeof relative === "string" && relative && !path.isAbsolute(relative) && !/^[A-Za-z]:[\\/]/.test(relative), "release path must be project-relative"); const projectRoot = path.resolve(root); const absolute = path.resolve(projectRoot, relative); assert(absolute.startsWith(`${projectRoot}${path.sep}`), "release path escapes project root"); return absolute; }
function normalize(value) { return value.replaceAll("\\", "/"); }
function bytesOf(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function sha256File(file) { return sha256Of(fs.readFileSync(file)); }
function assert(condition, message) { if (!condition) throw new Error(message); }

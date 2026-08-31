import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as signBytes,
  verify as verifyBytes,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  canonicalJson,
  sha256Of,
} from "./ai-painter-autonomous-package-decision-core-v3.mjs";

export const STAGE4_V2_QUALIFICATION_TICKET_SCHEMA =
  "ai-painter-stage4-v2-pre-release-qualification-ticket-v1";
export const STAGE4_V2_QUALIFICATION_ISSUER_SCHEMA =
  "ai-painter-stage4-v2-pre-release-qualification-ticket-issuer-v1";
export const STAGE4_V2_QUALIFICATION_LEDGER_SCHEMA =
  "ai-painter-stage4-v2-pre-release-qualification-ticket-ledger-v1";
export const STAGE4_V2_QUALIFICATION_ACTION =
  "stage4_v2_readonly_gpu_qualification.execute";
export const STAGE4_V2_CAPABILITY =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
export const DEFAULT_STAGE4_V2_QUALIFICATION_LEDGER_PATH =
  ".runtime/ai-painter/stage4-v2-readonly-gpu-qualification-ticket-ledger.sqlite";
export const DEFAULT_STAGE4_V2_MACHINE_KEY_ROOT =
  ".runtime/ai-painter/machine-keys/stage4-v2-pre-release-qualification-ticket-issuer-v1";

const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,191}$/u;
const RUNTIME_NAMESPACE = /^\.runtime\/ai-painter\/[a-zA-Z0-9._/-]+$/u;
const DPAPI_ENTROPY = Buffer.from(
  "ai-pet-world/stage4-v2/pre-release-readonly-gpu-qualification-ticket/v1",
  "utf8",
);

export function sha256File(filePath) {
  return sha256Of(fs.readFileSync(filePath));
}

export function projectLogicalPath(projectRoot, value) {
  const root = path.resolve(projectRoot);
  const absolute = path.resolve(value);
  assert.ok(
    absolute === root || absolute.startsWith(`${root}${path.sep}`),
    "path is outside project root",
  );
  return path.relative(root, absolute).split(path.sep).join("/");
}

export function resolveProjectPath(projectRoot, logicalPath, {
  mustExist = false,
  kind = null,
} = {}) {
  assert.equal(typeof logicalPath, "string", "logical path must be a string");
  assert.ok(logicalPath.length > 0, "logical path is required");
  assert.equal(path.isAbsolute(logicalPath), false, "absolute logical path is forbidden");
  assert.equal(/^[a-zA-Z]:[\\/]/u.test(logicalPath), false, "drive-qualified logical path is forbidden");
  assert.equal(logicalPath.includes("\\"), false, "logical path must use forward slashes");
  assert.equal(logicalPath.split("/").includes(".."), false, "logical path traversal is forbidden");
  assert.equal(path.posix.normalize(logicalPath), logicalPath, "logical path is not normalized");
  const root = path.resolve(projectRoot);
  const absolute = path.resolve(root, logicalPath);
  assert.ok(absolute.startsWith(`${root}${path.sep}`), "logical path escapes project root");
  if (mustExist) {
    assert.equal(fs.existsSync(absolute), true, `${logicalPath} does not exist`);
    if (kind === "file") assert.equal(fs.statSync(absolute).isFile(), true, `${logicalPath} is not a file`);
    if (kind === "directory") assert.equal(fs.statSync(absolute).isDirectory(), true, `${logicalPath} is not a directory`);
    const physicalRoot = fs.realpathSync(root);
    const physical = fs.realpathSync(absolute);
    const insidePhysicalProject = physical === physicalRoot || physical.startsWith(`${physicalRoot}${path.sep}`);
    // `.runtime` is the project's declared hot-storage junction.  Its physical
    // target may live on the configured data drive, so validate it against the
    // real junction root rather than rejecting every formally registered
    // runtime artifact as an external path.
    const runtimeLogical = logicalPath === ".runtime" || logicalPath.startsWith(".runtime/");
    const runtimeAbsolute = path.join(root, ".runtime");
    const physicalRuntimeRoot = runtimeLogical && fs.existsSync(runtimeAbsolute)
      ? fs.realpathSync(runtimeAbsolute)
      : null;
    const insidePhysicalRuntime = physicalRuntimeRoot !== null
      && (physical === physicalRuntimeRoot || physical.startsWith(`${physicalRuntimeRoot}${path.sep}`));
    assert.ok(insidePhysicalProject || insidePhysicalRuntime, `${logicalPath} resolves outside trusted project/runtime roots`);
  }
  return absolute;
}

export function bindProjectFile(projectRoot, logicalPath, expectedSha256 = null) {
  const absolutePath = resolveProjectPath(projectRoot, logicalPath, { mustExist: true, kind: "file" });
  const sha256 = sha256File(absolutePath);
  if (expectedSha256 !== null) {
    requireSha256(expectedSha256, `${logicalPath} expected SHA-256`);
    assert.equal(sha256, expectedSha256, `${logicalPath} SHA-256 mismatch`);
  }
  return Object.freeze({
    path: logicalPath,
    sha256,
    byteSize: fs.statSync(absolutePath).size,
  });
}

export function writeExclusiveJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const descriptor = fs.openSync(filePath, "wx");
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fsyncDirectoryBestEffort(path.dirname(filePath));
}

export function ensureStage4V2MachineTicketIssuer({
  projectRoot,
  machineKeyRoot = DEFAULT_STAGE4_V2_MACHINE_KEY_ROOT,
  keyProtector = null,
  _testHooks = null,
} = {}) {
  assert.ok(projectRoot, "projectRoot is required");
  assert.ok(RUNTIME_NAMESPACE.test(machineKeyRoot), "machine key root must be an AI Painter runtime namespace");
  const keyRoot = resolveProjectPath(projectRoot, machineKeyRoot);
  const stagingRoot = `${keyRoot}.staging`;
  fs.mkdirSync(path.dirname(keyRoot), { recursive: true });
  const issuerRecordPath = path.join(keyRoot, "issuer.json");
  const publicKeyPath = path.join(keyRoot, "public-key.pem");
  const protectedPrivateKeyPath = path.join(keyRoot, "private-key.pkcs8.dpapi");
  const protector = keyProtector ?? windowsDpapiMachineProtector();

  if (fs.existsSync(keyRoot)) {
    assert.equal(fs.lstatSync(keyRoot).isDirectory(), true,
      "machine issuer publication path is not a directory");
    assert.equal(fs.lstatSync(keyRoot).isSymbolicLink(), false,
      "machine issuer publication directory cannot be a symbolic link");
    const published = loadStage4V2MachineTicketIssuer({
      projectRoot, machineKeyRoot, keyRoot, protector,
    });
    if (fs.existsSync(stagingRoot)) {
      removeIncompleteStage4V2IssuerStaging(stagingRoot, keyRoot);
    }
    return published;
  }

  const stagedIssuerRecordPath = path.join(stagingRoot, "issuer.json");
  const stagedPublicKeyPath = path.join(stagingRoot, "public-key.pem");
  const stagedProtectedPrivateKeyPath = path.join(stagingRoot, "private-key.pkcs8.dpapi");
  if (fs.existsSync(stagingRoot)) {
    const complete = [
      stagedIssuerRecordPath,
      stagedPublicKeyPath,
      stagedProtectedPrivateKeyPath,
    ].every((item) => fs.existsSync(item));
    if (complete) {
      validateStagedStage4V2MachineTicketIssuer({
        projectRoot,
        machineKeyRoot,
        keyRoot,
        stagingRoot,
        protector,
      });
      fs.renameSync(stagingRoot, keyRoot);
      fsyncDirectoryBestEffort(path.dirname(keyRoot));
      invokeIssuerHook(_testHooks, "afterIssuerDirectoryPublished", { keyRoot });
      return loadStage4V2MachineTicketIssuer({
        projectRoot, machineKeyRoot, keyRoot, protector,
      });
    }
    removeIncompleteStage4V2IssuerStaging(stagingRoot, keyRoot);
  }

  fs.mkdirSync(stagingRoot, { recursive: false });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicPem = Buffer.from(publicKey.export({ type: "spki", format: "pem" }));
  const privatePem = Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" }));
  let protectedPrivateKey;
  try {
    protectedPrivateKey = protector.protect(privatePem, DPAPI_ENTROPY);
  } finally {
    privatePem.fill(0);
  }
  try {
    const publicSha256 = sha256Of(publicPem);
    const protectedSha256 = sha256Of(protectedPrivateKey);
    writeExclusiveBytes(stagedPublicKeyPath, publicPem, 0o644);
    invokeIssuerHook(_testHooks, "afterIssuerPublicKeyStaged", { stagingRoot });
    writeExclusiveBytes(stagedProtectedPrivateKeyPath, protectedPrivateKey, 0o600);
    invokeIssuerHook(_testHooks, "afterIssuerPrivateKeyStaged", { stagingRoot });
    const issuer = {
      schemaVersion: STAGE4_V2_QUALIFICATION_ISSUER_SCHEMA,
      status: "active_os_machine_protected",
      issuerIdentity: "local_ai_stage4_v2_pre_release_qualification_ticket_issuer",
      issuerKeyId: `stage4-v2-qk-${publicSha256.slice(0, 24)}`,
      publicKey: {
        path: projectLogicalPath(projectRoot, publicKeyPath),
        sha256: publicSha256,
        algorithm: "Ed25519",
      },
      protectedPrivateKey: {
        path: projectLogicalPath(projectRoot, protectedPrivateKeyPath),
        sha256: protectedSha256,
        protectionScheme: protector.scheme,
        plaintextPersistenceAllowed: false,
      },
      scope: {
        capabilityVersion: STAGE4_V2_CAPABILITY,
        action: STAGE4_V2_QUALIFICATION_ACTION,
        releasedCapabilityAuthorityImplied: false,
        ownerAuthorizationImplied: false,
      },
      createdAtUtc: new Date().toISOString(),
    };
    writeExclusiveJson(stagedIssuerRecordPath, issuer);
    invokeIssuerHook(_testHooks, "afterIssuerRecordStaged", { stagingRoot });
    validateStagedStage4V2MachineTicketIssuer({
      projectRoot,
      machineKeyRoot,
      keyRoot,
      stagingRoot,
      protector,
    });
    fs.renameSync(stagingRoot, keyRoot);
    fsyncDirectoryBestEffort(path.dirname(keyRoot));
    invokeIssuerHook(_testHooks, "afterIssuerDirectoryPublished", { keyRoot });
    return Object.freeze({
      issuer: Object.freeze(issuer),
      issuerBinding: bindProjectFile(projectRoot, projectLogicalPath(projectRoot, issuerRecordPath)),
      privateKey,
    });
  } finally {
    protectedPrivateKey.fill(0);
  }
}

function loadStage4V2MachineTicketIssuer({
  projectRoot, machineKeyRoot, keyRoot, protector,
}) {
  const issuerRecordPath = path.join(keyRoot, "issuer.json");
  const publicKeyPath = path.join(keyRoot, "public-key.pem");
  const protectedPrivateKeyPath = path.join(keyRoot, "private-key.pkcs8.dpapi");
  for (const [label, filePath] of [
    ["record", issuerRecordPath],
    ["public key", publicKeyPath],
    ["protected private key", protectedPrivateKeyPath],
  ]) {
    assert.equal(fs.existsSync(filePath), true, `machine issuer ${label} is incomplete`);
    assert.equal(fs.lstatSync(filePath).isFile(), true, `machine issuer ${label} is not a file`);
    assert.equal(fs.lstatSync(filePath).isSymbolicLink(), false,
      `machine issuer ${label} cannot be a symbolic link`);
  }
  const issuer = readJsonObject(issuerRecordPath);
  validateIssuerRecord({ projectRoot, issuer, expectedRoot: machineKeyRoot });
  const protectedBytes = fs.readFileSync(protectedPrivateKeyPath);
  assert.equal(sha256Of(protectedBytes), issuer.protectedPrivateKey.sha256,
    "protected machine key SHA-256 mismatch");
  const privatePem = protector.unprotect(protectedBytes, DPAPI_ENTROPY);
  try {
    const privateKey = createPrivateKey(privatePem);
    assertPrivateKeyMatchesIssuer(privateKey, fs.readFileSync(publicKeyPath), issuer);
    return Object.freeze({
      issuer: Object.freeze(issuer),
      issuerBinding: bindProjectFile(
        projectRoot,
        projectLogicalPath(projectRoot, issuerRecordPath),
      ),
      privateKey,
    });
  } finally {
    privatePem.fill(0);
  }
}

function validateStagedStage4V2MachineTicketIssuer({
  projectRoot, machineKeyRoot, keyRoot, stagingRoot, protector,
}) {
  assert.equal(fs.lstatSync(stagingRoot).isDirectory(), true,
    "machine issuer staging path is not a directory");
  assert.equal(fs.lstatSync(stagingRoot).isSymbolicLink(), false,
    "machine issuer staging directory cannot be a symbolic link");
  const issuer = readJsonObject(path.join(stagingRoot, "issuer.json"));
  const publicBytes = fs.readFileSync(path.join(stagingRoot, "public-key.pem"));
  const protectedBytes = fs.readFileSync(path.join(stagingRoot, "private-key.pkcs8.dpapi"));
  assert.equal(issuer.publicKey.path,
    projectLogicalPath(projectRoot, path.join(keyRoot, "public-key.pem")),
    "staged machine issuer public-key path mismatch");
  assert.equal(issuer.protectedPrivateKey.path,
    projectLogicalPath(projectRoot, path.join(keyRoot, "private-key.pkcs8.dpapi")),
    "staged machine issuer protected-key path mismatch");
  assert.equal(sha256Of(publicBytes), issuer.publicKey.sha256,
    "staged machine issuer public-key SHA-256 mismatch");
  assert.equal(sha256Of(protectedBytes), issuer.protectedPrivateKey.sha256,
    "staged machine issuer protected-key SHA-256 mismatch");
  assert.ok(issuer.publicKey.path.startsWith(`${machineKeyRoot}/`),
    "staged machine issuer public-key escaped namespace");
  assert.ok(issuer.protectedPrivateKey.path.startsWith(`${machineKeyRoot}/`),
    "staged machine issuer protected-key escaped namespace");
  const privatePem = protector.unprotect(protectedBytes, DPAPI_ENTROPY);
  try {
    assertPrivateKeyMatchesIssuer(createPrivateKey(privatePem), publicBytes, issuer);
  } finally {
    privatePem.fill(0);
  }
  return true;
}

function removeIncompleteStage4V2IssuerStaging(stagingRoot, keyRoot) {
  const resolvedStaging = path.resolve(stagingRoot);
  const resolvedKeyRoot = path.resolve(keyRoot);
  assert.equal(resolvedStaging, `${resolvedKeyRoot}.staging`,
    "machine issuer staging cleanup target differs");
  assert.equal(path.dirname(resolvedStaging), path.dirname(resolvedKeyRoot),
    "machine issuer staging cleanup escapes parent");
  assert.equal(fs.lstatSync(resolvedStaging).isDirectory(), true,
    "machine issuer staging cleanup target is not a directory");
  assert.equal(fs.lstatSync(resolvedStaging).isSymbolicLink(), false,
    "machine issuer staging cleanup target cannot be a symbolic link");
  fs.rmSync(resolvedStaging, { recursive: true, force: false });
  fsyncDirectoryBestEffort(path.dirname(resolvedStaging));
}

function invokeIssuerHook(hooks, point, detail) {
  if (typeof hooks?.[point] === "function") hooks[point](detail);
}

export function buildStage4V2PreReleaseQualificationTicket({
  packageId,
  runId,
  packagePayload,
  packagePayloadBinding,
  issuer,
  privateKey,
  inputEvidence,
  programLineage,
  outputDirectory,
  ledgerPath = DEFAULT_STAGE4_V2_QUALIFICATION_LEDGER_PATH,
  issuedAtUtc,
  expiresAtUtc,
  nonce = randomBytes(24).toString("hex"),
}) {
  requireSafeId(packageId, "packageId");
  requireSafeId(runId, "runId");
  assert.equal(packagePayload?.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-package-payload-v1");
  assert.equal(packagePayload.packageId, packageId);
  assert.equal(packagePayload.runId, runId);
  validateBinding(packagePayloadBinding, "packagePayloadBinding");
  assert.equal(sha256Of(Buffer.from(`${JSON.stringify(packagePayload, null, 2)}\n`, "utf8")), packagePayloadBinding.sha256,
    "package payload binding does not match canonical persisted payload bytes");
  assert.equal(issuer?.schemaVersion, STAGE4_V2_QUALIFICATION_ISSUER_SCHEMA);
  assert.equal(issuer?.status, "active_os_machine_protected");
  assert.ok(privateKey, "machine signing private key is required");
  assertPrivateKeyMatchesIssuer(privateKey, null, issuer);
  validateEvidence(inputEvidence);
  validateProgramLineage(programLineage);
  requireRuntimeNamespace(outputDirectory, "outputDirectory");
  requireRuntimeNamespace(ledgerPath, "ledgerPath");
  assert.equal(typeof issuedAtUtc, "string");
  assert.equal(typeof expiresAtUtc, "string");
  assert.ok(Number.isFinite(Date.parse(issuedAtUtc)), "issuedAtUtc is invalid");
  assert.ok(Date.parse(expiresAtUtc) > Date.parse(issuedAtUtc), "ticket expiry must follow issue time");
  requireSafeId(nonce, "nonce");

  const ticketBody = {
    schemaVersion: STAGE4_V2_QUALIFICATION_TICKET_SCHEMA,
    ticketId: `stage4-v2-qualification-ticket-${sha256Of({ packageId, runId, nonce }).slice(0, 32)}`,
    status: "issued_not_consumed",
    issuerIdentity: issuer.issuerIdentity,
    issuerKeyId: issuer.issuerKeyId,
    issuerRecord: packagePayload.ticketIssuer,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    capabilityReleaseStatus: "pre_release_qualification_only",
    action: STAGE4_V2_QUALIFICATION_ACTION,
    packageId,
    packagePayload: packagePayloadBinding,
    runId,
    fromLifecycleState: "cpu_contract_verified",
    toLifecycleState: "readonly_gpu_qualified",
    inputEvidence: canonicalize(inputEvidence),
    programLineage: canonicalize(programLineage),
    outputDirectory,
    ledgerPath,
    attemptNumber: 1,
    nonce,
    issuedAtUtc,
    expiresAtUtc,
    singleUse: true,
    noPrivilegeEscalation: true,
    ownerAuthorizationRequired: false,
    optimizerAllowed: false,
    backwardAllowed: false,
    weightMutationAllowed: false,
    checkpointWriteAllowed: false,
    trainingAllowed: false,
  };
  const ticketSha256 = sha256Of(ticketBody);
  const signedEnvelope = Buffer.from(canonicalJson({ ...ticketBody, ticketSha256 }), "utf8");
  const machineSignature = signBytes(null, signedEnvelope, privateKey).toString("base64url");
  return Object.freeze({ ...ticketBody, ticketSha256, machineSignature });
}

export function validateStage4V2PreReleaseQualificationTicket({
  projectRoot,
  ticket,
  packagePayload = null,
  verifyEvidence = true,
  nowUtc = null,
}) {
  assert.equal(ticket?.schemaVersion, STAGE4_V2_QUALIFICATION_TICKET_SCHEMA, "ticket schema mismatch");
  assert.equal(ticket.status, "issued_not_consumed", "ticket is not consumable");
  assert.equal(ticket.capabilityVersion, STAGE4_V2_CAPABILITY, "ticket capability mismatch");
  assert.equal(ticket.capabilityReleaseStatus, "pre_release_qualification_only", "ticket authority class mismatch");
  assert.equal(ticket.action, STAGE4_V2_QUALIFICATION_ACTION, "ticket action mismatch");
  assert.equal(ticket.fromLifecycleState, "cpu_contract_verified", "ticket source lifecycle mismatch");
  assert.equal(ticket.toLifecycleState, "readonly_gpu_qualified", "ticket target lifecycle mismatch");
  assert.equal(ticket.attemptNumber, 1, "qualification ticket must be a single attempt");
  assert.equal(ticket.singleUse, true, "ticket must be single-use");
  assert.equal(ticket.noPrivilegeEscalation, true, "ticket must forbid privilege escalation");
  assert.equal(ticket.ownerAuthorizationRequired, false, "ticket must not encode Owner authorization");
  for (const field of [
    "optimizerAllowed",
    "backwardAllowed",
    "weightMutationAllowed",
    "checkpointWriteAllowed",
    "trainingAllowed",
  ]) assert.equal(ticket[field], false, `${field} must be false`);
  requireSafeId(ticket.ticketId, "ticketId");
  requireSafeId(ticket.packageId, "packageId");
  requireSafeId(ticket.runId, "runId");
  requireSafeId(ticket.issuerIdentity, "issuerIdentity");
  requireSafeId(ticket.issuerKeyId, "issuerKeyId");
  requireSafeId(ticket.nonce, "nonce");
  requireSha256(ticket.ticketSha256, "ticketSha256");
  validateBinding(ticket.packagePayload, "ticket.packagePayload");
  validateBinding(ticket.issuerRecord, "ticket.issuerRecord");
  validateEvidence(ticket.inputEvidence);
  validateProgramLineage(ticket.programLineage);
  requireRuntimeNamespace(ticket.outputDirectory, "ticket.outputDirectory");
  requireRuntimeNamespace(ticket.ledgerPath, "ticket.ledgerPath");
  assert.ok(Number.isFinite(Date.parse(ticket.issuedAtUtc)), "ticket issuedAtUtc is invalid");
  assert.ok(Date.parse(ticket.expiresAtUtc) > Date.parse(ticket.issuedAtUtc), "ticket expiry is invalid");
  if (nowUtc !== null) {
    assert.ok(Number.isFinite(Date.parse(nowUtc)), "ticket validation time is invalid");
    assert.ok(Date.parse(nowUtc) >= Date.parse(ticket.issuedAtUtc), "ticket cannot be consumed before issue");
    assert.ok(Date.parse(nowUtc) <= Date.parse(ticket.expiresAtUtc), "ticket is expired");
  }

  const { ticketSha256, machineSignature, ...ticketBody } = ticket;
  assert.equal(sha256Of(ticketBody), ticketSha256, "ticket payload SHA-256 mismatch");
  assert.equal(typeof machineSignature, "string", "ticket machine signature is required");
  assert.ok(machineSignature.length > 0, "ticket machine signature is empty");
  const issuerBinding = bindProjectFile(projectRoot, ticket.issuerRecord.path, ticket.issuerRecord.sha256);
  const issuer = readJsonObject(resolveProjectPath(projectRoot, issuerBinding.path, { mustExist: true, kind: "file" }));
  validateIssuerRecord({ projectRoot, issuer });
  assert.equal(issuer.issuerIdentity, ticket.issuerIdentity, "ticket issuer identity mismatch");
  assert.equal(issuer.issuerKeyId, ticket.issuerKeyId, "ticket issuer key mismatch");
  const publicKeyBytes = fs.readFileSync(resolveProjectPath(projectRoot, issuer.publicKey.path, { mustExist: true, kind: "file" }));
  assert.equal(sha256Of(publicKeyBytes), issuer.publicKey.sha256, "ticket public key SHA-256 mismatch");
  assert.equal(
    verifyBytes(
      null,
      Buffer.from(canonicalJson({ ...ticketBody, ticketSha256 }), "utf8"),
      createPublicKey(publicKeyBytes),
      Buffer.from(machineSignature, "base64url"),
    ),
    true,
    "ticket machine signature mismatch",
  );

  if (packagePayload !== null) {
    assert.equal(packagePayload.packageId, ticket.packageId, "ticket packageId mismatch");
    assert.equal(packagePayload.runId, ticket.runId, "ticket runId mismatch");
    assert.equal(packagePayload.outputDirectory, ticket.outputDirectory, "ticket output directory mismatch");
    assert.equal(packagePayload.ledgerPath, ticket.ledgerPath, "ticket ledger mismatch");
    assert.deepEqual(packagePayload.programLineage, ticket.programLineage, "ticket program lineage mismatch");
    assert.deepEqual(packagePayload.inputEvidence, ticket.inputEvidence, "ticket evidence set mismatch");
  }
  if (verifyEvidence) verifyBoundEvidence(projectRoot, ticket.inputEvidence, ticket.programLineage);
  return Object.freeze({ issuer, issuerBinding });
}

export function initializeStage4V2QualificationReplayLedger({
  projectRoot,
  ledgerPath = DEFAULT_STAGE4_V2_QUALIFICATION_LEDGER_PATH,
} = {}) {
  requireRuntimeNamespace(ledgerPath, "ledgerPath");
  const absolute = resolveProjectPath(projectRoot, ledgerPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const db = new DatabaseSync(absolute);
  try {
    configureLedger(db);
    const integrity = db.prepare("PRAGMA integrity_check").get();
    assert.equal(Object.values(integrity ?? {})[0], "ok", "ticket ledger integrity check failed");
  } finally {
    db.close();
  }
  return Object.freeze({ path: ledgerPath, schemaVersion: STAGE4_V2_QUALIFICATION_LEDGER_SCHEMA });
}

export function registerStage4V2QualificationTicket({
  projectRoot,
  ticket,
  ticketBinding,
  packagePayloadBinding,
}) {
  validateBinding(ticketBinding, "ticketBinding");
  validateBinding(packagePayloadBinding, "packagePayloadBinding");
  assert.equal(ticket.packagePayload.sha256, packagePayloadBinding.sha256);
  const ledger = initializeStage4V2QualificationReplayLedger({ projectRoot, ledgerPath: ticket.ledgerPath });
  const db = new DatabaseSync(resolveProjectPath(projectRoot, ledger.path));
  try {
    configureLedger(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      const ticketJson = JSON.stringify(ticket);
      const inserted = db.prepare(`
        INSERT OR IGNORE INTO stage4_v2_qualification_tickets(
          ticket_id, ticket_sha256, package_id, package_payload_sha256, run_id,
          output_directory, action, status, issued_at_utc, expires_at_utc, ticket_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'issued_not_consumed', ?, ?, ?)
      `).run(
        ticket.ticketId,
        ticket.ticketSha256,
        ticket.packageId,
        packagePayloadBinding.sha256,
        ticket.runId,
        ticket.outputDirectory,
        ticket.action,
        ticket.issuedAtUtc,
        ticket.expiresAtUtc,
        ticketJson,
      );
      let registrationStatus = "registered_new";
      if (Number(inserted.changes) === 0) {
        const rows = db.prepare(`
          SELECT ticket_id, ticket_sha256, package_id, package_payload_sha256,
                 run_id, output_directory, action, status, issued_at_utc,
                 expires_at_utc, ticket_json
          FROM stage4_v2_qualification_tickets
          WHERE ticket_id = ? OR ticket_sha256 = ? OR package_id = ?
             OR package_payload_sha256 = ? OR run_id = ? OR output_directory = ?
        `).all(
          ticket.ticketId,
          ticket.ticketSha256,
          ticket.packageId,
          packagePayloadBinding.sha256,
          ticket.runId,
          ticket.outputDirectory,
        );
        assert.equal(rows.length, 1,
          "qualification ticket identity/output is already bound to another ledger row");
        const row = rows[0];
        assert.deepEqual({ ...row }, {
          ticket_id: ticket.ticketId,
          ticket_sha256: ticket.ticketSha256,
          package_id: ticket.packageId,
          package_payload_sha256: packagePayloadBinding.sha256,
          run_id: ticket.runId,
          output_directory: ticket.outputDirectory,
          action: ticket.action,
          status: "issued_not_consumed",
          issued_at_utc: ticket.issuedAtUtc,
          expires_at_utc: ticket.expiresAtUtc,
          ticket_json: ticketJson,
        }, "qualification ticket exact re-registration bytes changed");
        const prepared = db.prepare(`
          SELECT ticket_id FROM stage4_v2_qualification_consumption_prepares
          WHERE ticket_id = ?
        `).get(ticket.ticketId);
        assert.equal(prepared, undefined,
          "qualification ticket with a prepared consumption cannot be re-registered");
        const consumed = db.prepare(`
          SELECT ticket_id FROM stage4_v2_qualification_consumptions
          WHERE ticket_id = ?
        `).get(ticket.ticketId);
        assert.equal(consumed, undefined,
          "consumed qualification ticket cannot be re-registered");
        const closure = db.prepare(`
          SELECT ticket_id FROM stage4_v2_qualification_ticket_closures
          WHERE ticket_id = ?
        `).get(ticket.ticketId);
        assert.equal(closure, undefined,
          "closed qualification ticket cannot be re-registered");
        registrationStatus = "registered_exact_unconsumed_recovery";
      }
      db.exec("COMMIT");
      return Object.freeze({
        ...ledger,
        ticketId: ticket.ticketId,
        status: "issued_not_consumed_persisted",
        registrationStatus,
      });
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw new Error(`qualification ticket identity/output reuse rejected: ${error.message}`);
    }
  } finally {
    db.close();
  }
}

export function consumeStage4V2QualificationTicket({
  projectRoot,
  ticket,
  packagePayload,
  ticketBinding,
  packagePayloadBinding,
  consumptionPath,
  consumedAtUtc = new Date().toISOString(),
  _testHooks = null,
}) {
  validateBinding(ticketBinding, "ticketBinding");
  validateBinding(packagePayloadBinding, "packagePayloadBinding");
  assert.equal(bindProjectFile(projectRoot, ticketBinding.path, ticketBinding.sha256).sha256, ticketBinding.sha256);
  assert.equal(bindProjectFile(projectRoot, packagePayloadBinding.path, packagePayloadBinding.sha256).sha256, packagePayloadBinding.sha256);
  assert.equal(ticket.packagePayload.sha256, packagePayloadBinding.sha256);
  validateStage4V2PreReleaseQualificationTicket({
    projectRoot,
    ticket,
    packagePayload,
    verifyEvidence: true,
    nowUtc: consumedAtUtc,
  });
  const outputAbsolute = resolveProjectPath(projectRoot, ticket.outputDirectory);
  assert.equal(fs.existsSync(outputAbsolute), false, "qualification output directory reuse is forbidden");
  const consumptionAbsolute = resolveProjectPath(projectRoot, consumptionPath);
  assert.equal(fs.existsSync(consumptionAbsolute), false, "qualification consumption evidence reuse is forbidden");
  assert.ok(consumptionPath.startsWith(".runtime/ai-painter/"), "consumption evidence must be in AI Painter runtime");

  const consumption = {
    schemaVersion: "ai-painter-stage4-v2-pre-release-qualification-ticket-consumption-v1",
    status: "consumed_once",
    ticketId: ticket.ticketId,
    ticketSha256: ticket.ticketSha256,
    packageId: ticket.packageId,
    packagePayloadSha256: packagePayloadBinding.sha256,
    runId: ticket.runId,
    action: ticket.action,
    outputDirectory: ticket.outputDirectory,
    issuerIdentity: ticket.issuerIdentity,
    issuerKeyId: ticket.issuerKeyId,
    machineSignatureVerified: true,
    evidenceRecomputedAtConsumption: true,
    ownerAuthorizationRequired: false,
    consumedAtUtc,
  };
  const consumptionBytes = jsonBytes(consumption);
  const consumptionSha256 = sha256Of(consumptionBytes);
  const db = new DatabaseSync(resolveProjectPath(projectRoot, ticket.ledgerPath));
  try {
    configureLedger(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = db.prepare(`
        SELECT ticket_sha256, package_id, package_payload_sha256, run_id,
               output_directory, action, status
        FROM stage4_v2_qualification_tickets WHERE ticket_id = ?
      `).get(ticket.ticketId);
      assert.ok(row, "qualification ticket is not registered");
      assert.equal(row.ticket_sha256, ticket.ticketSha256, "registered ticket SHA-256 mismatch");
      assert.equal(row.package_id, ticket.packageId, "registered package mismatch");
      assert.equal(row.package_payload_sha256, packagePayloadBinding.sha256, "registered package payload mismatch");
      assert.equal(row.run_id, ticket.runId, "registered run mismatch");
      assert.equal(row.output_directory, ticket.outputDirectory, "registered output mismatch");
      assert.equal(row.action, ticket.action, "registered action mismatch");
      assert.equal(row.status, "issued_not_consumed", "qualification ticket replay rejected");
      const closure = db.prepare(`
        SELECT ticket_id FROM stage4_v2_qualification_ticket_closures WHERE ticket_id = ?
      `).get(ticket.ticketId);
      assert.equal(closure, undefined, "qualification ticket was closed unconsumed");
      const existingPrepare = db.prepare(`
        SELECT ticket_id FROM stage4_v2_qualification_consumption_prepares WHERE ticket_id = ?
      `).get(ticket.ticketId);
      assert.equal(existingPrepare, undefined, "qualification ticket has an unfinished consumption prepare; explicit recovery is required");
      db.prepare(`
        INSERT INTO stage4_v2_qualification_consumption_prepares(
          ticket_id, ticket_sha256, package_id, package_payload_sha256, run_id,
          output_directory, action, consumption_path, consumption_sha256,
          consumed_at_utc, consumption_json, status, prepared_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?)
      `).run(
        ticket.ticketId,
        ticket.ticketSha256,
        ticket.packageId,
        packagePayloadBinding.sha256,
        ticket.runId,
        ticket.outputDirectory,
        ticket.action,
        consumptionPath,
        consumptionSha256,
        consumedAtUtc,
        JSON.stringify(consumption),
        consumedAtUtc,
      );
      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw new Error(`qualification ticket replay or output reuse rejected: ${error.message}`);
    }
  } finally {
    db.close();
  }
  invokeTestHook(_testHooks, "afterConsumptionPrepareCommit", { ticketId: ticket.ticketId, consumptionPath });
  ensureImmutableJson(consumptionAbsolute, consumption, consumptionSha256);
  invokeTestHook(_testHooks, "afterConsumptionEvidencePersisted", { ticketId: ticket.ticketId, consumptionPath });
  finalizePreparedConsumption({
    projectRoot,
    ticket,
    packagePayloadBinding,
    consumptionPath,
    consumption,
    consumptionSha256,
    consumedAtUtc,
  });
  invokeTestHook(_testHooks, "afterConsumptionCommit", { ticketId: ticket.ticketId, consumptionPath });
  return Object.freeze({
    consumption: Object.freeze(consumption),
    consumptionBinding: bindProjectFile(projectRoot, consumptionPath),
    ledgerPath: ticket.ledgerPath,
  });
}

export function recoverStage4V2QualificationTicketConsumption({
  projectRoot,
  ticket,
  packagePayload,
  ticketBinding,
  packagePayloadBinding,
  consumptionPath,
  nowUtc = new Date().toISOString(),
}) {
  validateBinding(ticketBinding, "ticketBinding");
  validateBinding(packagePayloadBinding, "packagePayloadBinding");
  bindProjectFile(projectRoot, ticketBinding.path, ticketBinding.sha256);
  bindProjectFile(projectRoot, packagePayloadBinding.path, packagePayloadBinding.sha256);
  validateStage4V2PreReleaseQualificationTicket({
    projectRoot,
    ticket,
    packagePayload,
    verifyEvidence: true,
    // Recovery authenticates an already prepared operation.  Expiry prevents
    // new prepares, but must not make a durable prepared transaction
    // unrecoverable after a host interruption.
    nowUtc: null,
  });
  assert.ok(Number.isFinite(Date.parse(nowUtc)), "ticket consumption recovery timestamp is invalid");
  const prepared = readPreparedConsumption({
    projectRoot,
    ticket,
    packagePayloadBinding,
    consumptionPath,
  });
  const consumption = JSON.parse(prepared.consumption_json);
  const consumptionBytes = jsonBytes(consumption);
  assert.equal(sha256Of(consumptionBytes), prepared.consumption_sha256,
    "prepared qualification consumption bytes changed");
  const consumptionAbsolute = resolveProjectPath(projectRoot, consumptionPath);
  if (prepared.status !== "committed") {
    const outputAbsolute = resolveProjectPath(projectRoot, ticket.outputDirectory);
    assert.equal(fs.existsSync(outputAbsolute), false,
      "unfinished ticket consumption cannot be recovered after qualification output creation");
  }
  ensureImmutableJson(consumptionAbsolute, consumption, prepared.consumption_sha256);
  finalizePreparedConsumption({
    projectRoot,
    ticket,
    packagePayloadBinding,
    consumptionPath,
    consumption,
    consumptionSha256: prepared.consumption_sha256,
    consumedAtUtc: prepared.consumed_at_utc,
  });
  return Object.freeze({
    consumption: Object.freeze(consumption),
    consumptionBinding: bindProjectFile(projectRoot, consumptionPath, prepared.consumption_sha256),
    ledgerPath: ticket.ledgerPath,
    recoveredAtUtc: nowUtc,
    recoveryStatus: prepared.status === "committed" ? "already_committed_verified" : "prepared_consumption_committed",
  });
}

export function closeStage4V2UnconsumedQualificationTicket({
  projectRoot,
  ticket,
  ticketBinding,
  packagePayloadBinding,
  closurePath,
  reasonCode,
  error = null,
  closedAtUtc = new Date().toISOString(),
}) {
  validateBinding(ticketBinding, "ticketBinding");
  validateBinding(packagePayloadBinding, "packagePayloadBinding");
  bindProjectFile(projectRoot, ticketBinding.path, ticketBinding.sha256);
  bindProjectFile(projectRoot, packagePayloadBinding.path, packagePayloadBinding.sha256);
  requireRuntimeNamespace(closurePath, "closurePath");
  requireSafeId(reasonCode, "reasonCode");
  assert.ok(Number.isFinite(Date.parse(closedAtUtc)), "ticket closure timestamp is invalid");
  const closure = {
    schemaVersion: "ai-painter-stage4-v2-pre-release-qualification-ticket-closure-v1",
    status: "closed_unconsumed",
    ticketId: ticket.ticketId,
    ticketSha256: ticket.ticketSha256,
    packageId: ticket.packageId,
    packagePayloadSha256: packagePayloadBinding.sha256,
    runId: ticket.runId,
    action: ticket.action,
    outputDirectory: ticket.outputDirectory,
    reasonCode,
    error: error === null ? null : String(error),
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    closedAtUtc,
  };
  const closureBytes = jsonBytes(closure);
  const closureSha256 = sha256Of(closureBytes);
  const db = new DatabaseSync(resolveProjectPath(projectRoot, ticket.ledgerPath));
  try {
    configureLedger(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = db.prepare(`
        SELECT ticket_sha256, package_id, package_payload_sha256, run_id,
               output_directory, action, status
        FROM stage4_v2_qualification_tickets WHERE ticket_id = ?
      `).get(ticket.ticketId);
      assert.ok(row, "qualification ticket is not registered");
      assert.equal(row.ticket_sha256, ticket.ticketSha256, "registered ticket SHA-256 mismatch");
      assert.equal(row.package_id, ticket.packageId, "registered package mismatch");
      assert.equal(row.package_payload_sha256, packagePayloadBinding.sha256, "registered package payload mismatch");
      assert.equal(row.run_id, ticket.runId, "registered run mismatch");
      assert.equal(row.output_directory, ticket.outputDirectory, "registered output mismatch");
      assert.equal(row.action, ticket.action, "registered action mismatch");
      assert.equal(row.status, "issued_not_consumed", "only an unconsumed ticket may be closed");
      const prepared = db.prepare(`
        SELECT ticket_id FROM stage4_v2_qualification_consumption_prepares WHERE ticket_id = ?
      `).get(ticket.ticketId);
      assert.equal(prepared, undefined, "prepared qualification consumption cannot be closed as unconsumed");
      const existing = db.prepare(`
        SELECT closure_path, closure_sha256, closure_json
        FROM stage4_v2_qualification_ticket_closures WHERE ticket_id = ?
      `).get(ticket.ticketId);
      if (existing) {
        assert.equal(existing.closure_path, closurePath, "ticket closure path changed");
        assert.equal(existing.closure_sha256, closureSha256, "ticket closure bytes changed");
        assert.deepEqual(JSON.parse(existing.closure_json), closure, "ticket closure payload changed");
      } else {
        db.prepare(`
          INSERT INTO stage4_v2_qualification_ticket_closures(
            ticket_id, ticket_sha256, package_id, run_id, closure_path,
            closure_sha256, closed_at_utc, closure_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ticket.ticketId,
          ticket.ticketSha256,
          ticket.packageId,
          ticket.runId,
          closurePath,
          closureSha256,
          closedAtUtc,
          JSON.stringify(closure),
        );
      }
      db.exec("COMMIT");
    } catch (cause) {
      try { db.exec("ROLLBACK"); } catch {}
      throw cause;
    }
  } finally {
    db.close();
  }
  ensureImmutableJson(resolveProjectPath(projectRoot, closurePath), closure, closureSha256);
  return Object.freeze({
    closure: Object.freeze(closure),
    closureBinding: bindProjectFile(projectRoot, closurePath, closureSha256),
    ledgerPath: ticket.ledgerPath,
  });
}

export function readJsonObject(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""));
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${filePath} must contain a JSON object`);
  return value;
}

function configureLedger(db) {
  db.exec(`
    PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=FULL;
    PRAGMA foreign_keys=ON;
    PRAGMA user_version=1;
    CREATE TABLE IF NOT EXISTS stage4_v2_qualification_tickets (
      ticket_id TEXT PRIMARY KEY,
      ticket_sha256 TEXT NOT NULL UNIQUE,
      package_id TEXT NOT NULL UNIQUE,
      package_payload_sha256 TEXT NOT NULL UNIQUE,
      run_id TEXT NOT NULL UNIQUE,
      output_directory TEXT NOT NULL UNIQUE,
      action TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('issued_not_consumed','consumed_once')),
      issued_at_utc TEXT NOT NULL,
      expires_at_utc TEXT NOT NULL,
      consumed_at_utc TEXT,
      ticket_json TEXT NOT NULL,
      consumption_json TEXT
    );
    CREATE TABLE IF NOT EXISTS stage4_v2_qualification_consumptions (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL UNIQUE REFERENCES stage4_v2_qualification_tickets(ticket_id),
      ticket_sha256 TEXT NOT NULL UNIQUE,
      package_id TEXT NOT NULL UNIQUE,
      run_id TEXT NOT NULL UNIQUE,
      output_directory TEXT NOT NULL UNIQUE,
      consumed_at_utc TEXT NOT NULL,
      consumption_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stage4_v2_qualification_consumption_prepares (
      ticket_id TEXT PRIMARY KEY REFERENCES stage4_v2_qualification_tickets(ticket_id),
      ticket_sha256 TEXT NOT NULL UNIQUE,
      package_id TEXT NOT NULL UNIQUE,
      package_payload_sha256 TEXT NOT NULL UNIQUE,
      run_id TEXT NOT NULL UNIQUE,
      output_directory TEXT NOT NULL UNIQUE,
      action TEXT NOT NULL,
      consumption_path TEXT NOT NULL UNIQUE,
      consumption_sha256 TEXT NOT NULL UNIQUE,
      consumed_at_utc TEXT NOT NULL,
      consumption_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('prepared','committed')),
      prepared_at_utc TEXT NOT NULL,
      committed_at_utc TEXT
    );
    CREATE TABLE IF NOT EXISTS stage4_v2_qualification_ticket_closures (
      ticket_id TEXT PRIMARY KEY REFERENCES stage4_v2_qualification_tickets(ticket_id),
      ticket_sha256 TEXT NOT NULL UNIQUE,
      package_id TEXT NOT NULL UNIQUE,
      run_id TEXT NOT NULL UNIQUE,
      closure_path TEXT NOT NULL UNIQUE,
      closure_sha256 TEXT NOT NULL UNIQUE,
      closed_at_utc TEXT NOT NULL,
      closure_json TEXT NOT NULL
    );
  `);
}

function readPreparedConsumption({ projectRoot, ticket, packagePayloadBinding, consumptionPath }) {
  const db = new DatabaseSync(resolveProjectPath(projectRoot, ticket.ledgerPath));
  try {
    configureLedger(db);
    const prepared = db.prepare(`
      SELECT ticket_id, ticket_sha256, package_id, package_payload_sha256, run_id,
             output_directory, action, consumption_path, consumption_sha256,
             consumed_at_utc, consumption_json, status
      FROM stage4_v2_qualification_consumption_prepares WHERE ticket_id = ?
    `).get(ticket.ticketId);
    assert.ok(prepared, "qualification ticket has no recoverable consumption prepare");
    assert.equal(prepared.ticket_sha256, ticket.ticketSha256, "prepared ticket SHA-256 mismatch");
    assert.equal(prepared.package_id, ticket.packageId, "prepared package mismatch");
    assert.equal(prepared.package_payload_sha256, packagePayloadBinding.sha256, "prepared package payload mismatch");
    assert.equal(prepared.run_id, ticket.runId, "prepared run mismatch");
    assert.equal(prepared.output_directory, ticket.outputDirectory, "prepared output mismatch");
    assert.equal(prepared.action, ticket.action, "prepared action mismatch");
    assert.equal(prepared.consumption_path, consumptionPath, "prepared consumption path mismatch");
    requireSha256(prepared.consumption_sha256, "prepared consumption SHA-256");
    assert.ok(["prepared", "committed"].includes(prepared.status), "prepared consumption status invalid");
    return prepared;
  } finally {
    db.close();
  }
}

function finalizePreparedConsumption({
  projectRoot,
  ticket,
  packagePayloadBinding,
  consumptionPath,
  consumption,
  consumptionSha256,
  consumedAtUtc,
}) {
  const consumptionAbsolute = resolveProjectPath(projectRoot, consumptionPath, { mustExist: true, kind: "file" });
  assert.equal(sha256File(consumptionAbsolute), consumptionSha256,
    "qualification consumption evidence SHA-256 mismatch before commit");
  const db = new DatabaseSync(resolveProjectPath(projectRoot, ticket.ledgerPath));
  try {
    configureLedger(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      const prepared = db.prepare(`
        SELECT ticket_sha256, package_id, package_payload_sha256, run_id,
               output_directory, action, consumption_path, consumption_sha256,
               consumed_at_utc, consumption_json, status
        FROM stage4_v2_qualification_consumption_prepares WHERE ticket_id = ?
      `).get(ticket.ticketId);
      assert.ok(prepared, "qualification consumption prepare is missing");
      assert.equal(prepared.ticket_sha256, ticket.ticketSha256, "prepared ticket SHA-256 mismatch");
      assert.equal(prepared.package_id, ticket.packageId, "prepared package mismatch");
      assert.equal(prepared.package_payload_sha256, packagePayloadBinding.sha256, "prepared payload mismatch");
      assert.equal(prepared.run_id, ticket.runId, "prepared run mismatch");
      assert.equal(prepared.output_directory, ticket.outputDirectory, "prepared output mismatch");
      assert.equal(prepared.action, ticket.action, "prepared action mismatch");
      assert.equal(prepared.consumption_path, consumptionPath, "prepared consumption path mismatch");
      assert.equal(prepared.consumption_sha256, consumptionSha256, "prepared consumption SHA-256 mismatch");
      assert.equal(prepared.consumed_at_utc, consumedAtUtc, "prepared consumption timestamp mismatch");
      assert.deepEqual(JSON.parse(prepared.consumption_json), consumption, "prepared consumption payload mismatch");
      const ticketRow = db.prepare(`
        SELECT status, consumed_at_utc, consumption_json
        FROM stage4_v2_qualification_tickets WHERE ticket_id = ?
      `).get(ticket.ticketId);
      assert.ok(ticketRow, "qualification ticket is not registered");
      const closure = db.prepare(`
        SELECT ticket_id FROM stage4_v2_qualification_ticket_closures WHERE ticket_id = ?
      `).get(ticket.ticketId);
      assert.equal(closure, undefined, "closed qualification ticket cannot be consumed");
      if (prepared.status === "committed") {
        assert.equal(ticketRow.status, "consumed_once", "committed prepare conflicts with ticket state");
        assert.equal(ticketRow.consumed_at_utc, consumedAtUtc, "committed ticket timestamp mismatch");
        assert.deepEqual(JSON.parse(ticketRow.consumption_json), consumption, "committed ticket payload mismatch");
        const existing = db.prepare(`
          SELECT consumption_json FROM stage4_v2_qualification_consumptions WHERE ticket_id = ?
        `).get(ticket.ticketId);
        assert.ok(existing, "committed consumption row is missing");
        assert.deepEqual(JSON.parse(existing.consumption_json), consumption, "committed consumption row mismatch");
      } else {
        assert.equal(ticketRow.status, "issued_not_consumed", "qualification ticket replay rejected");
        const update = db.prepare(`
          UPDATE stage4_v2_qualification_tickets
          SET status='consumed_once', consumed_at_utc=?, consumption_json=?
          WHERE ticket_id=? AND status='issued_not_consumed'
        `).run(consumedAtUtc, JSON.stringify(consumption), ticket.ticketId);
        assert.equal(Number(update.changes), 1, "qualification ticket atomic consumption failed");
        db.prepare(`
          INSERT INTO stage4_v2_qualification_consumptions(
            ticket_id, ticket_sha256, package_id, run_id, output_directory,
            consumed_at_utc, consumption_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          ticket.ticketId,
          ticket.ticketSha256,
          ticket.packageId,
          ticket.runId,
          ticket.outputDirectory,
          consumedAtUtc,
          JSON.stringify(consumption),
        );
        const preparedUpdate = db.prepare(`
          UPDATE stage4_v2_qualification_consumption_prepares
          SET status='committed', committed_at_utc=?
          WHERE ticket_id=? AND status='prepared'
        `).run(new Date().toISOString(), ticket.ticketId);
        assert.equal(Number(preparedUpdate.changes), 1, "qualification consumption prepare commit failed");
      }
      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw new Error(`qualification consumption commit failed: ${error.message}`);
    }
  } finally {
    db.close();
  }
}

function validateIssuerRecord({ projectRoot, issuer, expectedRoot = null }) {
  assert.equal(issuer?.schemaVersion, STAGE4_V2_QUALIFICATION_ISSUER_SCHEMA, "machine issuer schema mismatch");
  assert.equal(issuer.status, "active_os_machine_protected", "machine issuer is not active");
  requireSafeId(issuer.issuerIdentity, "issuerIdentity");
  requireSafeId(issuer.issuerKeyId, "issuerKeyId");
  validateBinding(issuer.publicKey, "issuer.publicKey");
  validateBinding(issuer.protectedPrivateKey, "issuer.protectedPrivateKey");
  assert.equal(issuer.publicKey.algorithm, "Ed25519", "machine issuer algorithm mismatch");
  assert.equal(issuer.protectedPrivateKey.plaintextPersistenceAllowed, false, "plaintext machine key persistence is forbidden");
  assert.equal(issuer.scope?.capabilityVersion, STAGE4_V2_CAPABILITY, "machine issuer capability scope mismatch");
  assert.equal(issuer.scope?.action, STAGE4_V2_QUALIFICATION_ACTION, "machine issuer action scope mismatch");
  assert.equal(issuer.scope?.releasedCapabilityAuthorityImplied, false, "pre-release issuer cannot imply release authority");
  assert.equal(issuer.scope?.ownerAuthorizationImplied, false, "machine issuer cannot imply Owner authorization");
  if (expectedRoot !== null) {
    assert.ok(issuer.publicKey.path.startsWith(`${expectedRoot}/`), "issuer public key escaped machine key root");
    assert.ok(issuer.protectedPrivateKey.path.startsWith(`${expectedRoot}/`), "issuer private key escaped machine key root");
  }
  bindProjectFile(projectRoot, issuer.publicKey.path, issuer.publicKey.sha256);
  bindProjectFile(projectRoot, issuer.protectedPrivateKey.path, issuer.protectedPrivateKey.sha256);
}

function assertPrivateKeyMatchesIssuer(privateKey, publicPem, issuer) {
  const derived = Buffer.from(createPublicKey(privateKey).export({ type: "spki", format: "pem" }));
  assert.equal(sha256Of(derived), issuer.publicKey.sha256, "machine signing key does not match issuer");
  if (publicPem !== null) assert.deepEqual(derived, Buffer.from(publicPem), "machine public key bytes differ from issuer");
}

function validateEvidence(evidence) {
  assert.ok(Array.isArray(evidence) && evidence.length > 0, "input evidence must be non-empty");
  const paths = new Set();
  for (const binding of evidence) {
    validateBinding(binding, "input evidence");
    assert.equal(paths.has(binding.path), false, `duplicate input evidence path: ${binding.path}`);
    paths.add(binding.path);
  }
}

function validateProgramLineage(programLineage) {
  assert.ok(programLineage && typeof programLineage === "object" && !Array.isArray(programLineage), "programLineage must be an object");
  const entries = Object.entries(programLineage);
  assert.ok(entries.length > 0, "programLineage must be non-empty");
  for (const [role, binding] of entries) {
    requireSafeId(role, "program lineage role");
    validateBinding(binding, `programLineage.${role}`);
  }
}

function verifyBoundEvidence(projectRoot, evidence, programLineage) {
  for (const binding of evidence) bindProjectFile(projectRoot, binding.path, binding.sha256);
  for (const binding of Object.values(programLineage)) bindProjectFile(projectRoot, binding.path, binding.sha256);
}

function validateBinding(binding, field) {
  assert.ok(binding && typeof binding === "object" && !Array.isArray(binding), `${field} binding is required`);
  assert.equal(typeof binding.path, "string", `${field}.path is required`);
  assert.equal(binding.path.includes("\\"), false, `${field}.path must be normalized`);
  assert.equal(binding.path.split("/").includes(".."), false, `${field}.path traversal is forbidden`);
  requireSha256(binding.sha256, `${field}.sha256`);
}

function requireSha256(value, field) {
  assert.ok(typeof value === "string" && SHA256.test(value), `${field} must be a lowercase SHA-256`);
}

function requireSafeId(value, field) {
  assert.ok(typeof value === "string" && SAFE_ID.test(value), `${field} is invalid`);
}

function requireRuntimeNamespace(value, field) {
  assert.ok(typeof value === "string" && RUNTIME_NAMESPACE.test(value), `${field} must be an AI Painter runtime namespace`);
  assert.equal(value.includes(".."), false, `${field} traversal is forbidden`);
  assert.equal(value.includes("\\"), false, `${field} must be normalized`);
}

function writeExclusiveBytes(filePath, bytes, mode) {
  const descriptor = fs.openSync(filePath, "wx", mode);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try { fs.chmodSync(filePath, mode); } catch {}
  fsyncDirectoryBestEffort(path.dirname(filePath));
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureImmutableJson(filePath, value, expectedSha256) {
  requireSha256(expectedSha256, "immutable JSON expected SHA-256");
  const bytes = jsonBytes(value);
  assert.equal(sha256Of(bytes), expectedSha256, "immutable JSON payload SHA-256 mismatch");
  if (fs.existsSync(filePath)) {
    assert.equal(fs.statSync(filePath).isFile(), true, "immutable JSON path is not a file");
    assert.equal(sha256File(filePath), expectedSha256, "immutable JSON evidence conflicts with prepared bytes");
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeExclusiveBytes(filePath, bytes, 0o644);
  assert.equal(sha256File(filePath), expectedSha256, "immutable JSON evidence read-back mismatch");
}

function invokeTestHook(hooks, name, detail) {
  const hook = hooks?.[name];
  if (typeof hook === "function") hook(detail);
}

function fsyncDirectoryBestEffort(directory) {
  let descriptor = null;
  try {
    descriptor = fs.openSync(directory, "r");
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (!new Set(["EACCES", "EBADF", "EINVAL", "EISDIR", "EPERM"]).has(error.code)) throw error;
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function windowsDpapiMachineProtector() {
  assert.equal(process.platform, "win32", "OS machine key protection requires Windows DPAPI on this host");
  const run = (operation, input, entropy) => {
    const script = [
      "$ErrorActionPreference='Stop'",
      "$inputStream=[Console]::OpenStandardInput()",
      "$memory=[System.IO.MemoryStream]::new()",
      "$inputStream.CopyTo($memory)",
      "$data=$memory.ToArray()",
      `$entropy=[Convert]::FromBase64String('${Buffer.from(entropy).toString("base64")}')`,
      operation === "protect"
        ? "$result=[Security.Cryptography.ProtectedData]::Protect($data,$entropy,[Security.Cryptography.DataProtectionScope]::LocalMachine)"
        : "$result=[Security.Cryptography.ProtectedData]::Unprotect($data,$entropy,[Security.Cryptography.DataProtectionScope]::LocalMachine)",
      "$output=[Console]::OpenStandardOutput()",
      "$output.Write($result,0,$result.Length)",
    ].join("\n");
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const result = spawnSync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      { input, encoding: null, windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
    );
    if (result.error || result.status !== 0) {
      throw result.error ?? new Error(`Windows DPAPI ${operation} failed: ${Buffer.from(result.stderr ?? []).toString("utf8")}`);
    }
    return Buffer.from(result.stdout);
  };
  return Object.freeze({
    scheme: "windows_dpapi_local_machine_v1",
    protect: (bytes, entropy) => run("protect", bytes, entropy),
    unprotect: (bytes, entropy) => run("unprotect", bytes, entropy),
  });
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

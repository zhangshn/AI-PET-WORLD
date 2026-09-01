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

import { canonicalJson, sha256Of } from "./ai-painter-autonomous-package-decision-core-v3.mjs";
import {
  bindProjectFile,
  projectLogicalPath,
  readJsonObject,
  resolveProjectPath,
  sha256File,
  writeExclusiveJson,
} from "./ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

export const STAGE4_V2_CAPABILITY =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
export const STAGE4_V2_SMOKE_ACTION = "stage4_v2_controlled_smoke.execute";
export const STAGE4_V2_SMOKE_TICKET_SCHEMA =
  "ai-painter-stage4-v2-controlled-smoke-ticket-v1";
export const STAGE4_V2_SMOKE_ISSUER_SCHEMA =
  "ai-painter-stage4-v2-controlled-smoke-ticket-issuer-v1";
export const STAGE4_V2_SMOKE_LEDGER_PATH =
  ".runtime/ai-painter/stage4-v2-controlled-smoke-ticket-ledger.sqlite";
export const STAGE4_V2_SMOKE_MACHINE_KEY_ROOT =
  ".runtime/ai-painter/machine-keys/stage4-v2-controlled-smoke-ticket-issuer-v1";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{7,191}$/u;
const SAFE_PROGRAM_ROLE = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const DPAPI_ENTROPY = Buffer.from(
  "ai-pet-world/stage4-v2/controlled-smoke-ticket/v1",
  "utf8",
);

export function ensureStage4V2SmokeTicketIssuer({
  projectRoot,
  machineKeyRoot = STAGE4_V2_SMOKE_MACHINE_KEY_ROOT,
  keyProtector = null,
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  const directory = resolveProjectPath(root, machineKeyRoot);
  const stagingDirectory = `${directory}.staging`;
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  const issuerPath = path.join(directory, "issuer.json");
  const publicKeyPath = path.join(directory, "public-key.pem");
  const privateKeyPath = path.join(directory, "private-key.pkcs8.dpapi");
  const protector = keyProtector ?? windowsDpapiMachineProtector();
  if (fs.existsSync(directory)) {
    assert.equal(fs.lstatSync(directory).isDirectory(), true,
      "Smoke machine issuer path is not a directory");
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false,
      "Smoke machine issuer directory cannot be a symbolic link");
    const published = loadPublishedIssuer({
      root, directory, machineKeyRoot, protector,
    });
    if (fs.existsSync(stagingDirectory)) removeIncompleteIssuerStaging(
      stagingDirectory, directory,
    );
    return published;
  }

  const stagedIssuerPath = path.join(stagingDirectory, "issuer.json");
  const stagedPublicKeyPath = path.join(stagingDirectory, "public-key.pem");
  const stagedPrivateKeyPath = path.join(stagingDirectory, "private-key.pkcs8.dpapi");
  if (fs.existsSync(stagingDirectory)) {
    const stagedFiles = [
      stagedIssuerPath, stagedPublicKeyPath, stagedPrivateKeyPath,
    ];
    if (stagedFiles.every((item) => fs.existsSync(item))) {
      validateStagedIssuer({
        root, directory, stagingDirectory, machineKeyRoot, protector,
      });
      fs.renameSync(stagingDirectory, directory);
      return loadPublishedIssuer({ root, directory, machineKeyRoot, protector });
    }
    removeIncompleteIssuerStaging(stagingDirectory, directory);
  }
  fs.mkdirSync(stagingDirectory, { recursive: false });
  const keys = generateKeyPairSync("ed25519");
  const publicPem = Buffer.from(keys.publicKey.export({ type: "spki", format: "pem" }));
  const privatePem = Buffer.from(keys.privateKey.export({ type: "pkcs8", format: "pem" }));
  let protectedPrivate;
  try { protectedPrivate = protector.protect(privatePem, DPAPI_ENTROPY); }
  finally { privatePem.fill(0); }
  writeExclusiveBytes(stagedPublicKeyPath, publicPem, 0o644);
  invokeTestHook(_testHooks, "afterIssuerPublicKeyStaged", {
    stagingDirectory,
  });
  writeExclusiveBytes(stagedPrivateKeyPath, protectedPrivate, 0o600);
  invokeTestHook(_testHooks, "afterIssuerPrivateKeyStaged", {
    stagingDirectory,
  });
  const issuer = {
    schemaVersion: STAGE4_V2_SMOKE_ISSUER_SCHEMA,
    status: "active_os_machine_protected",
    issuerIdentity: "local_ai_stage4_v2_controlled_smoke_ticket_issuer",
    issuerKeyId: `stage4-v2-smoke-${sha256Of(publicPem).slice(0, 24)}`,
    publicKey: { path: projectLogicalPath(root, publicKeyPath), sha256: sha256Of(publicPem), algorithm: "Ed25519" },
    protectedPrivateKey: {
      path: projectLogicalPath(root, privateKeyPath), sha256: sha256Of(protectedPrivate),
      protectionScheme: protector.scheme, plaintextPersistenceAllowed: false,
    },
    scope: {
      capabilityVersion: STAGE4_V2_CAPABILITY, action: STAGE4_V2_SMOKE_ACTION,
      fromLifecycleState: "readonly_gpu_qualified", toLifecycleState: "controlled_smoke_completed",
      releasedCapabilityAuthorityImplied: false, ownerAuthorizationImplied: false,
    },
    createdAtUtc: new Date().toISOString(),
  };
  protectedPrivate.fill(0);
  writeExclusiveJson(stagedIssuerPath, issuer);
  invokeTestHook(_testHooks, "afterIssuerRecordStaged", {
    stagingDirectory,
  });
  validateStagedIssuer({
    root, directory, stagingDirectory, machineKeyRoot, protector,
  });
  fs.renameSync(stagingDirectory, directory);
  validateIssuer(root, issuer, machineKeyRoot);
  return Object.freeze({
    issuer: Object.freeze(issuer), privateKey: keys.privateKey,
    issuerBinding: bindAbsolute(root, issuerPath),
  });
}

function loadPublishedIssuer({ root, directory, machineKeyRoot, protector }) {
  const issuerPath = path.join(directory, "issuer.json");
  const publicKeyPath = path.join(directory, "public-key.pem");
  const privateKeyPath = path.join(directory, "private-key.pkcs8.dpapi");
  assert.ok([issuerPath, publicKeyPath, privateKeyPath].every(
    (item) => fs.existsSync(item) && fs.lstatSync(item).isFile()
      && !fs.lstatSync(item).isSymbolicLink(),
  ), "Smoke machine issuer is incomplete");
  const issuer = readJsonObject(issuerPath);
  validateIssuer(root, issuer, machineKeyRoot);
  const protectedBytes = fs.readFileSync(privateKeyPath);
  assert.equal(sha256Of(protectedBytes), issuer.protectedPrivateKey.sha256,
    "Smoke protected key SHA-256 mismatch");
  const privatePem = protector.unprotect(protectedBytes, DPAPI_ENTROPY);
  try {
    const privateKey = createPrivateKey(privatePem);
    assertPrivateKey(privateKey, issuer);
    return Object.freeze({
      issuer: Object.freeze(issuer), privateKey,
      issuerBinding: bindAbsolute(root, issuerPath),
    });
  } finally { privatePem.fill(0); }
}

function validateStagedIssuer({
  root, directory, stagingDirectory, machineKeyRoot, protector,
}) {
  const issuer = readJsonObject(path.join(stagingDirectory, "issuer.json"));
  validateIssuerShape(issuer);
  assert.equal(issuer.scope.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(issuer.scope.action, STAGE4_V2_SMOKE_ACTION);
  assert.equal(issuer.scope.fromLifecycleState, "readonly_gpu_qualified");
  assert.equal(issuer.scope.toLifecycleState, "controlled_smoke_completed");
  const publicPath = path.join(stagingDirectory, "public-key.pem");
  const privatePath = path.join(stagingDirectory, "private-key.pkcs8.dpapi");
  assert.equal(issuer.publicKey.path,
    projectLogicalPath(root, path.join(directory, "public-key.pem")));
  assert.equal(issuer.protectedPrivateKey.path,
    projectLogicalPath(root, path.join(directory, "private-key.pkcs8.dpapi")));
  const publicBytes = fs.readFileSync(publicPath);
  const protectedBytes = fs.readFileSync(privatePath);
  assert.equal(sha256Of(publicBytes), issuer.publicKey.sha256,
    "staged Smoke public key SHA-256 mismatch");
  assert.equal(sha256Of(protectedBytes), issuer.protectedPrivateKey.sha256,
    "staged Smoke protected key SHA-256 mismatch");
  assert.ok(issuer.publicKey.path.startsWith(`${machineKeyRoot}/`));
  assert.ok(issuer.protectedPrivateKey.path.startsWith(`${machineKeyRoot}/`));
  const privatePem = protector.unprotect(protectedBytes, DPAPI_ENTROPY);
  try { assertPrivateKey(createPrivateKey(privatePem), issuer); }
  finally { privatePem.fill(0); }
  return true;
}

function removeIncompleteIssuerStaging(stagingDirectory, directory) {
  const resolvedStaging = path.resolve(stagingDirectory);
  const resolvedDirectory = path.resolve(directory);
  assert.equal(resolvedStaging, `${resolvedDirectory}.staging`,
    "Smoke issuer staging cleanup target differs");
  assert.equal(path.dirname(resolvedStaging), path.dirname(resolvedDirectory),
    "Smoke issuer staging cleanup escapes its parent");
  assert.equal(fs.lstatSync(resolvedStaging).isDirectory(), true,
    "Smoke issuer staging path is not a directory");
  assert.equal(fs.lstatSync(resolvedStaging).isSymbolicLink(), false,
    "Smoke issuer staging path cannot be a symbolic link");
  fs.rmSync(resolvedStaging, { recursive: true, force: false });
}

export function buildStage4V2SmokeTicket({
  packageId, runId, packagePayload, packagePayloadBinding, issuer, privateKey,
  inputEvidence, programLineage, outputDirectory,
  issuedAtUtc, expiresAtUtc, nonce = randomBytes(24).toString("hex"),
}) {
  requireId(packageId, "packageId"); requireId(runId, "runId");
  assert.equal(packagePayload?.schemaVersion, "ai-painter-stage4-v2-controlled-smoke-package-payload-v1");
  assert.equal(packagePayload.packageId, packageId); assert.equal(packagePayload.runId, runId);
  validateDerivedExecution(packagePayload.derivedTrainerExecution, outputDirectory);
  validateBinding(packagePayloadBinding, "packagePayloadBinding");
  assert.equal(sha256Of(Buffer.from(`${JSON.stringify(packagePayload, null, 2)}\n`)), packagePayloadBinding.sha256, "Smoke payload binding mismatch");
  validateIssuerShape(issuer); assertPrivateKey(privateKey, issuer);
  validateBindingList(inputEvidence, "inputEvidence"); validateProgramLineage(programLineage);
  requireRuntimePath(outputDirectory, "outputDirectory");
  assert.ok(Date.parse(expiresAtUtc) > Date.parse(issuedAtUtc), "Smoke ticket expiry is invalid");
  const body = {
    schemaVersion: STAGE4_V2_SMOKE_TICKET_SCHEMA,
    ticketId: `stage4-v2-smoke-ticket-${sha256Of({ packageId, runId, nonce }).slice(0, 32)}`,
    status: "issued_not_consumed", issuerIdentity: issuer.issuerIdentity,
    issuerKeyId: issuer.issuerKeyId, issuerRecord: packagePayload.ticketIssuer,
    capabilityVersion: STAGE4_V2_CAPABILITY, capabilityReleaseStatus: "pre_release_controlled_smoke_only",
    action: STAGE4_V2_SMOKE_ACTION, packageId, packagePayload: packagePayloadBinding, runId,
    fromLifecycleState: "readonly_gpu_qualified", toLifecycleState: "controlled_smoke_completed",
    inputEvidence: canonicalize(inputEvidence), programLineage: canonicalize(programLineage),
    outputDirectory, ledgerPath: STAGE4_V2_SMOKE_LEDGER_PATH,
    derivedTrainerExecution: canonicalize(packagePayload.derivedTrainerExecution),
    attemptNumber: 1, nonce, issuedAtUtc, expiresAtUtc, singleUse: true,
    noPrivilegeEscalation: true, ownerAuthorizationRequired: false,
    gpuAllowed: true, optimizerAllowed: true, backwardAllowed: true,
    weightMutationAllowed: true, checkpointWriteAllowed: true, trainingAllowed: true,
    stage0Allowed: false, stage1Allowed: false, stage2Allowed: false,
    historicalDenoiserCheckpointAllowed: false, outputReuseAllowed: false,
  };
  const ticketSha256 = sha256Of(body);
  const machineSignature = signBytes(null, Buffer.from(canonicalJson({ ...body, ticketSha256 })), privateKey).toString("base64url");
  return Object.freeze({ ...body, ticketSha256, machineSignature });
}

export function validateStage4V2SmokeTicket({ projectRoot, ticket, packagePayload = null, nowUtc = null, verifyEvidence = true }) {
  assert.equal(ticket?.schemaVersion, STAGE4_V2_SMOKE_TICKET_SCHEMA, "Smoke ticket schema mismatch");
  assert.equal(ticket.status, "issued_not_consumed");
  assert.equal(ticket.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(ticket.action, STAGE4_V2_SMOKE_ACTION);
  assert.equal(ticket.fromLifecycleState, "readonly_gpu_qualified");
  assert.equal(ticket.toLifecycleState, "controlled_smoke_completed");
  assert.equal(ticket.singleUse, true); assert.equal(ticket.attemptNumber, 1);
  assert.equal(ticket.ownerAuthorizationRequired, false);
  for (const key of ["gpuAllowed", "optimizerAllowed", "backwardAllowed", "weightMutationAllowed", "checkpointWriteAllowed", "trainingAllowed"]) assert.equal(ticket[key], true, `${key} must be true`);
  for (const key of ["stage0Allowed", "stage1Allowed", "stage2Allowed", "historicalDenoiserCheckpointAllowed", "outputReuseAllowed"]) assert.equal(ticket[key], false, `${key} must be false`);
  validateBinding(ticket.packagePayload, "ticket.packagePayload"); validateBinding(ticket.issuerRecord, "ticket.issuerRecord");
  validateDerivedExecution(ticket.derivedTrainerExecution, ticket.outputDirectory);
  validateBindingList(ticket.inputEvidence, "ticket.inputEvidence"); validateProgramLineage(ticket.programLineage);
  if (nowUtc !== null) {
    assert.ok(Date.parse(nowUtc) >= Date.parse(ticket.issuedAtUtc), "Smoke ticket cannot be consumed before issue");
    assert.ok(Date.parse(nowUtc) <= Date.parse(ticket.expiresAtUtc), "Smoke ticket expired");
  }
  const { ticketSha256, machineSignature, ...body } = ticket;
  assert.equal(sha256Of(body), ticketSha256, "Smoke ticket payload SHA-256 mismatch");
  const issuer = readBoundJson(projectRoot, ticket.issuerRecord);
  validateIssuer(path.resolve(projectRoot), issuer);
  assert.equal(issuer.issuerKeyId, ticket.issuerKeyId); assert.equal(issuer.issuerIdentity, ticket.issuerIdentity);
  const publicPem = fs.readFileSync(resolveProjectPath(projectRoot, issuer.publicKey.path, { mustExist: true, kind: "file" }));
  assert.equal(verifyBytes(null, Buffer.from(canonicalJson({ ...body, ticketSha256 })), createPublicKey(publicPem), Buffer.from(machineSignature, "base64url")), true, "Smoke ticket machine signature mismatch");
  if (packagePayload !== null) {
    assert.equal(packagePayload.packageId, ticket.packageId); assert.equal(packagePayload.runId, ticket.runId);
    assert.equal(packagePayload.outputDirectory, ticket.outputDirectory);
    assert.deepEqual(packagePayload.inputEvidence, ticket.inputEvidence);
    assert.deepEqual(packagePayload.programLineage, ticket.programLineage);
    assert.deepEqual(packagePayload.derivedTrainerExecution, ticket.derivedTrainerExecution);
  }
  if (verifyEvidence) {
    for (const binding of ticket.inputEvidence) bindProjectFile(projectRoot, binding.path, binding.sha256);
    for (const binding of Object.values(ticket.programLineage)) bindProjectFile(projectRoot, binding.path, binding.sha256);
  }
  return Object.freeze({ issuer });
}

export function initializeStage4V2SmokeTicketLedger({ projectRoot } = {}) {
  const absolute = resolveProjectPath(projectRoot, STAGE4_V2_SMOKE_LEDGER_PATH);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const db = new DatabaseSync(absolute); try { configureLedger(db); } finally { db.close(); }
  return Object.freeze({ path: STAGE4_V2_SMOKE_LEDGER_PATH, schemaVersion: "ai-painter-stage4-v2-controlled-smoke-ticket-ledger-v1" });
}

export function registerStage4V2SmokeTicket({
  projectRoot, ticket, ticketBinding, packagePayloadBinding,
  allowExistingExact = false,
}) {
  validateBinding(ticketBinding, "ticketBinding"); validateBinding(packagePayloadBinding, "packagePayloadBinding");
  const ledger = initializeStage4V2SmokeTicketLedger({ projectRoot });
  const db = new DatabaseSync(resolveProjectPath(projectRoot, ledger.path));
  try {
    configureLedger(db); db.exec("BEGIN IMMEDIATE");
    try {
      const existing = db.prepare(
        "SELECT * FROM tickets WHERE ticket_id=?",
      ).get(ticket.ticketId);
      if (existing !== undefined) {
        assert.equal(allowExistingExact, true,
          "Smoke ticket/output reuse rejected: ticket identity already exists");
        validateRegisteredSmokeTicketRow(existing, ticket, packagePayloadBinding);
        assert.equal(existing.status, "issued_not_consumed",
          "Smoke ticket/output reuse rejected: existing ticket is not unconsumed");
        db.exec("COMMIT");
        return Object.freeze({
          ...ledger, ticketId: ticket.ticketId,
          status: "issued_not_consumed_persisted",
          recoveredExistingExact: true,
        });
      }
      db.prepare(`INSERT INTO tickets(ticket_id,ticket_sha256,package_id,payload_sha256,run_id,output_directory,derived_ticket_id,derived_config_contract_sha256,derived_output_directory,status,issued_at_utc,expires_at_utc) VALUES(?,?,?,?,?,?,?,?,?,'issued_not_consumed',?,?)`).run(
        ticket.ticketId, ticket.ticketSha256, ticket.packageId, packagePayloadBinding.sha256,
        ticket.runId, ticket.outputDirectory, ticket.derivedTrainerExecution.ticketId,
        ticket.derivedTrainerExecution.configContractSha256,
        ticket.derivedTrainerExecution.outputDirectory,
        ticket.issuedAtUtc, ticket.expiresAtUtc,
      );
      db.exec("COMMIT");
    } catch (error) { try { db.exec("ROLLBACK"); } catch {} throw new Error(`Smoke ticket/output reuse rejected: ${error.message}`); }
  } finally { db.close(); }
  return Object.freeze({
    ...ledger, ticketId: ticket.ticketId,
    status: "issued_not_consumed_persisted",
    recoveredExistingExact: false,
  });
}

export function consumeStage4V2SmokeTicket({
  projectRoot, ticket, packagePayload, ticketBinding, packagePayloadBinding,
  consumptionPath, consumedAtUtc = new Date().toISOString(),
  _testHooks = null,
}) {
  bindProjectFile(projectRoot, ticketBinding.path, ticketBinding.sha256);
  bindProjectFile(projectRoot, packagePayloadBinding.path, packagePayloadBinding.sha256);
  const existingPrepare = readSmokeConsumptionPrepare({
    projectRoot, ticket, packagePayloadBinding, consumptionPath, required: false,
  });
  if (existingPrepare !== null) {
    return recoverStage4V2SmokeTicketConsumption({
      projectRoot, ticket, packagePayload, ticketBinding, packagePayloadBinding,
      consumptionPath, recoveredAtUtc: consumedAtUtc,
    });
  }
  validateStage4V2SmokeTicket({
    projectRoot, ticket, packagePayload, nowUtc: consumedAtUtc, verifyEvidence: true,
  });
  assert.equal(
    fs.existsSync(resolveProjectPath(projectRoot, ticket.outputDirectory)),
    false,
    "Smoke output reuse is forbidden",
  );
  const consumptionAbsolute = resolveProjectPath(projectRoot, consumptionPath);
  assert.equal(fs.existsSync(consumptionAbsolute), false, "Smoke consumption evidence reuse is forbidden");
  const consumption = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-ticket-consumption-v1",
    status: "consumed_once", ticketId: ticket.ticketId, ticketSha256: ticket.ticketSha256,
    packageId: ticket.packageId, packagePayloadSha256: packagePayloadBinding.sha256,
    runId: ticket.runId, action: ticket.action, outputDirectory: ticket.outputDirectory,
    derivedTrainerExecution: ticket.derivedTrainerExecution,
    oneTimeConsumption: true, consumedAtUtc,
  };
  const consumptionSha256 = sha256Of(jsonBytes(consumption));
  const db = new DatabaseSync(resolveProjectPath(projectRoot, ticket.ledgerPath));
  try {
    configureLedger(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = db.prepare("SELECT * FROM tickets WHERE ticket_id=?").get(ticket.ticketId);
      validateRegisteredSmokeTicketRow(row, ticket, packagePayloadBinding);
      assert.equal(row.status, "issued_not_consumed", "Smoke ticket replay rejected");
      const duplicatePrepare = db.prepare(
        "SELECT ticket_id FROM consumption_prepares WHERE ticket_id=?",
      ).get(ticket.ticketId);
      assert.equal(duplicatePrepare, undefined, "Smoke ticket already has a consumption prepare");
      db.prepare(`INSERT INTO consumption_prepares(
        ticket_id,ticket_sha256,package_id,payload_sha256,run_id,output_directory,
        derived_ticket_id,derived_config_contract_sha256,derived_output_directory,
        consumption_path,consumption_sha256,consumed_at_utc,consumption_json,status,prepared_at_utc
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'prepared',?)`).run(
        ticket.ticketId, ticket.ticketSha256, ticket.packageId, packagePayloadBinding.sha256,
        ticket.runId, ticket.outputDirectory, ticket.derivedTrainerExecution.ticketId,
        ticket.derivedTrainerExecution.configContractSha256,
        ticket.derivedTrainerExecution.outputDirectory, consumptionPath, consumptionSha256,
        consumedAtUtc, JSON.stringify(consumption), consumedAtUtc,
      );
      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  }
  finally { db.close(); }
  invokeTestHook(_testHooks, "afterConsumptionPrepareCommit", {
    ticketId: ticket.ticketId, consumptionPath,
  });
  ensureImmutableJson(consumptionAbsolute, consumption, consumptionSha256);
  invokeTestHook(_testHooks, "afterConsumptionEvidencePersisted", {
    ticketId: ticket.ticketId, consumptionPath,
  });
  finalizePreparedSmokeConsumption({
    projectRoot, ticket, packagePayloadBinding, consumptionPath,
    consumption, consumptionSha256, consumedAtUtc,
  });
  invokeTestHook(_testHooks, "afterConsumptionCommit", {
    ticketId: ticket.ticketId, consumptionPath,
  });
  return Object.freeze({
    consumption: Object.freeze(consumption),
    consumptionBinding: bindProjectFile(projectRoot, consumptionPath, consumptionSha256),
    recoveryStatus: "prepared_evidence_committed",
  });
}

export function recoverStage4V2SmokeTicketConsumption({
  projectRoot, ticket, packagePayload, ticketBinding, packagePayloadBinding,
  consumptionPath, recoveredAtUtc = new Date().toISOString(),
}) {
  bindProjectFile(projectRoot, ticketBinding.path, ticketBinding.sha256);
  bindProjectFile(projectRoot, packagePayloadBinding.path, packagePayloadBinding.sha256);
  validateStage4V2SmokeTicket({
    projectRoot, ticket, packagePayload, nowUtc: null, verifyEvidence: true,
  });
  assert.ok(Number.isFinite(Date.parse(recoveredAtUtc)), "Smoke recovery timestamp is invalid");
  const prepared = readSmokeConsumptionPrepare({
    projectRoot, ticket, packagePayloadBinding, consumptionPath, required: true,
  });
  const consumption = JSON.parse(prepared.consumption_json);
  assert.equal(sha256Of(jsonBytes(consumption)), prepared.consumption_sha256,
    "prepared Smoke consumption bytes changed");
  const consumptionAbsolute = resolveProjectPath(projectRoot, consumptionPath);
  if (prepared.status !== "committed") {
    assert.equal(fs.existsSync(resolveProjectPath(projectRoot, ticket.outputDirectory)), false,
      "unfinished Smoke consumption cannot be recovered after output creation");
  }
  ensureImmutableJson(consumptionAbsolute, consumption, prepared.consumption_sha256);
  finalizePreparedSmokeConsumption({
    projectRoot, ticket, packagePayloadBinding, consumptionPath, consumption,
    consumptionSha256: prepared.consumption_sha256,
    consumedAtUtc: prepared.consumed_at_utc,
  });
  return Object.freeze({
    consumption: Object.freeze(consumption),
    consumptionBinding: bindProjectFile(
      projectRoot, consumptionPath, prepared.consumption_sha256,
    ),
    recoveredAtUtc,
    recoveryStatus: prepared.status === "committed"
      ? "already_committed_verified"
      : "prepared_consumption_committed",
  });
}

function configureLedger(db) {
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS tickets(
      ticket_id TEXT PRIMARY KEY, ticket_sha256 TEXT UNIQUE NOT NULL, package_id TEXT UNIQUE NOT NULL,
      payload_sha256 TEXT UNIQUE NOT NULL, run_id TEXT UNIQUE NOT NULL, output_directory TEXT UNIQUE NOT NULL,
      derived_ticket_id TEXT UNIQUE NOT NULL, derived_config_contract_sha256 TEXT UNIQUE NOT NULL,
      derived_output_directory TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('issued_not_consumed','consumed')),
      issued_at_utc TEXT NOT NULL, expires_at_utc TEXT NOT NULL, consumed_at_utc TEXT,
      consumption_sha256 TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS consumption_prepares(
      ticket_id TEXT PRIMARY KEY REFERENCES tickets(ticket_id),
      ticket_sha256 TEXT UNIQUE NOT NULL, package_id TEXT UNIQUE NOT NULL,
      payload_sha256 TEXT UNIQUE NOT NULL, run_id TEXT UNIQUE NOT NULL,
      output_directory TEXT UNIQUE NOT NULL, derived_ticket_id TEXT UNIQUE NOT NULL,
      derived_config_contract_sha256 TEXT UNIQUE NOT NULL,
      derived_output_directory TEXT UNIQUE NOT NULL,
      consumption_path TEXT UNIQUE NOT NULL, consumption_sha256 TEXT UNIQUE NOT NULL,
      consumed_at_utc TEXT NOT NULL, consumption_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('prepared','committed')),
      prepared_at_utc TEXT NOT NULL, committed_at_utc TEXT
    );`);
}

function readSmokeConsumptionPrepare({
  projectRoot, ticket, packagePayloadBinding, consumptionPath, required,
}) {
  const db = new DatabaseSync(resolveProjectPath(projectRoot, ticket.ledgerPath));
  try {
    configureLedger(db);
    const prepared = db.prepare(
      "SELECT * FROM consumption_prepares WHERE ticket_id=?",
    ).get(ticket.ticketId);
    if (!prepared) {
      assert.equal(required, false, "Smoke ticket has no recoverable consumption prepare");
      return null;
    }
    assert.equal(prepared.ticket_sha256, ticket.ticketSha256, "prepared ticket SHA-256 mismatch");
    assert.equal(prepared.package_id, ticket.packageId, "prepared package mismatch");
    assert.equal(prepared.payload_sha256, packagePayloadBinding.sha256, "prepared payload mismatch");
    assert.equal(prepared.run_id, ticket.runId, "prepared run mismatch");
    assert.equal(prepared.output_directory, ticket.outputDirectory, "prepared output mismatch");
    assert.equal(prepared.derived_ticket_id, ticket.derivedTrainerExecution.ticketId,
      "prepared derived ticket mismatch");
    assert.equal(
      prepared.derived_config_contract_sha256,
      ticket.derivedTrainerExecution.configContractSha256,
      "prepared derived config mismatch",
    );
    assert.equal(prepared.derived_output_directory, ticket.derivedTrainerExecution.outputDirectory,
      "prepared derived output mismatch");
    assert.equal(prepared.consumption_path, consumptionPath, "prepared consumption path mismatch");
    assert.ok(SHA256.test(prepared.consumption_sha256), "prepared consumption SHA-256 is invalid");
    assert.ok(["prepared", "committed"].includes(prepared.status), "prepared status is invalid");
    return prepared;
  } finally { db.close(); }
}

function finalizePreparedSmokeConsumption({
  projectRoot, ticket, packagePayloadBinding, consumptionPath,
  consumption, consumptionSha256, consumedAtUtc,
}) {
  bindProjectFile(projectRoot, consumptionPath, consumptionSha256);
  const db = new DatabaseSync(resolveProjectPath(projectRoot, ticket.ledgerPath));
  try {
    configureLedger(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      const prepared = db.prepare(
        "SELECT * FROM consumption_prepares WHERE ticket_id=?",
      ).get(ticket.ticketId);
      assert.ok(prepared, "Smoke consumption prepare is missing");
      assert.equal(prepared.ticket_sha256, ticket.ticketSha256);
      assert.equal(prepared.payload_sha256, packagePayloadBinding.sha256);
      assert.equal(prepared.consumption_path, consumptionPath);
      assert.equal(prepared.consumption_sha256, consumptionSha256);
      assert.equal(prepared.consumed_at_utc, consumedAtUtc);
      assert.deepEqual(JSON.parse(prepared.consumption_json), consumption);
      const row = db.prepare("SELECT * FROM tickets WHERE ticket_id=?").get(ticket.ticketId);
      validateRegisteredSmokeTicketRow(row, ticket, packagePayloadBinding);
      if (prepared.status === "committed") {
        assert.equal(row.status, "consumed", "committed prepare conflicts with ticket state");
        assert.equal(row.consumption_sha256, consumptionSha256,
          "committed consumption SHA-256 mismatch");
      } else {
        assert.equal(row.status, "issued_not_consumed", "Smoke ticket replay rejected");
        const update = db.prepare(
          "UPDATE tickets SET status='consumed',consumed_at_utc=?,consumption_sha256=? WHERE ticket_id=? AND status='issued_not_consumed'",
        ).run(consumedAtUtc, consumptionSha256, ticket.ticketId);
        assert.equal(Number(update.changes), 1, "Smoke ticket atomic consumption failed");
        const prepareUpdate = db.prepare(
          "UPDATE consumption_prepares SET status='committed',committed_at_utc=? WHERE ticket_id=? AND status='prepared'",
        ).run(new Date().toISOString(), ticket.ticketId);
        assert.equal(Number(prepareUpdate.changes), 1,
          "Smoke consumption prepare commit failed");
      }
      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  } finally { db.close(); }
}

function validateRegisteredSmokeTicketRow(row, ticket, packagePayloadBinding) {
  assert.ok(row, "Smoke ticket is not registered");
  assert.equal(row.ticket_sha256, ticket.ticketSha256, "registered ticket SHA-256 mismatch");
  assert.equal(row.package_id, ticket.packageId, "registered package mismatch");
  assert.equal(row.payload_sha256, packagePayloadBinding.sha256, "registered payload mismatch");
  assert.equal(row.run_id, ticket.runId, "registered run mismatch");
  assert.equal(row.output_directory, ticket.outputDirectory, "registered output mismatch");
  assert.equal(row.derived_ticket_id, ticket.derivedTrainerExecution.ticketId,
    "derived trainer ticket identity mismatch");
  assert.equal(row.derived_config_contract_sha256,
    ticket.derivedTrainerExecution.configContractSha256,
    "derived trainer config contract mismatch");
  assert.equal(row.derived_output_directory, ticket.derivedTrainerExecution.outputDirectory,
    "derived trainer output mismatch");
}

function validateIssuer(root, issuer, expectedRoot = null) {
  validateIssuerShape(issuer);
  assert.equal(issuer.scope.capabilityVersion, STAGE4_V2_CAPABILITY);
  assert.equal(issuer.scope.action, STAGE4_V2_SMOKE_ACTION);
  assert.equal(issuer.scope.fromLifecycleState, "readonly_gpu_qualified");
  assert.equal(issuer.scope.toLifecycleState, "controlled_smoke_completed");
  if (expectedRoot) {
    assert.ok(issuer.publicKey.path.startsWith(`${expectedRoot}/`));
    assert.ok(issuer.protectedPrivateKey.path.startsWith(`${expectedRoot}/`));
  }
  bindProjectFile(root, issuer.publicKey.path, issuer.publicKey.sha256);
  bindProjectFile(root, issuer.protectedPrivateKey.path, issuer.protectedPrivateKey.sha256);
}
function validateIssuerShape(issuer) {
  assert.equal(issuer?.schemaVersion, STAGE4_V2_SMOKE_ISSUER_SCHEMA);
  assert.equal(issuer.status, "active_os_machine_protected");
  assert.equal(issuer.publicKey?.algorithm, "Ed25519");
  assert.equal(issuer.protectedPrivateKey?.plaintextPersistenceAllowed, false);
  assert.equal(issuer.scope?.releasedCapabilityAuthorityImplied, false);
  assert.equal(issuer.scope?.ownerAuthorizationImplied, false);
}
function assertPrivateKey(privateKey, issuer) {
  const derived = Buffer.from(createPublicKey(privateKey).export({ type: "spki", format: "pem" }));
  assert.equal(sha256Of(derived), issuer.publicKey.sha256, "Smoke private key does not match issuer");
}
function readBoundJson(root, binding) { bindProjectFile(root, binding.path, binding.sha256); return readJsonObject(resolveProjectPath(root, binding.path)); }
function bindAbsolute(root, absolute) { return Object.freeze({ path: projectLogicalPath(root, absolute), sha256: sha256File(absolute), byteSize: fs.statSync(absolute).size }); }
function validateBinding(value, label) { assert.ok(value && typeof value.path === "string" && SHA256.test(value.sha256 ?? ""), `${label} is invalid`); }
function validateBindingList(values, label) { assert.ok(Array.isArray(values) && values.length > 0, `${label} is empty`); const paths = new Set(); for (const value of values) { validateBinding(value, label); assert.equal(paths.has(value.path), false, `${label} contains duplicate path`); paths.add(value.path); } }
function validateProgramLineage(value) { assert.ok(value && !Array.isArray(value)); for (const [role, binding] of Object.entries(value)) { assert.match(role, SAFE_PROGRAM_ROLE, "program role is invalid"); validateBinding(binding, role); } }
function validateDerivedExecution(value, outputDirectory) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "derived trainer execution is missing");
  requireId(value.ticketId, "derived trainer ticketId");
  assert.ok(SHA256.test(value.configContractSha256 ?? ""), "derived trainer config contract SHA-256 is invalid");
  requireRuntimePath(value.outputDirectory, "derived trainer outputDirectory");
  assert.equal(value.outputDirectory, outputDirectory, "derived trainer output must equal the Smoke output directory");
  assert.equal(value.oneTimeConsumptionInheritedFromParent, true, "derived trainer ticket must inherit one-time parent consumption");
  assert.equal(value.independentAuthorizationAuthority, false, "derived trainer ticket cannot create independent authority");
}
function requireId(value, label) { assert.ok(typeof value === "string" && SAFE_ID.test(value), `${label} is invalid`); }
function requireRuntimePath(value, label) { assert.ok(typeof value === "string" && value.startsWith(".runtime/ai-painter/") && !value.includes("..") && !value.includes("\\"), `${label} is invalid`); }
function canonicalize(value) { if (Array.isArray(value)) return value.map(canonicalize); if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])); return value; }
function writeExclusiveBytes(filePath, bytes, mode) { const handle = fs.openSync(filePath, "wx", mode); try { fs.writeFileSync(handle, bytes); fs.fsyncSync(handle); } finally { fs.closeSync(handle); } }
function jsonBytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function ensureImmutableJson(filePath, value, expectedSha256) {
  assert.ok(SHA256.test(expectedSha256), "immutable JSON expected SHA-256 is invalid");
  const bytes = jsonBytes(value);
  assert.equal(sha256Of(bytes), expectedSha256, "immutable JSON payload SHA-256 mismatch");
  if (fs.existsSync(filePath)) {
    assert.equal(fs.statSync(filePath).isFile(), true, "immutable JSON evidence path is not a file");
    assert.equal(sha256File(filePath), expectedSha256,
      "immutable JSON evidence conflicts with prepared bytes");
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeExclusiveBytes(filePath, bytes, 0o644);
  assert.equal(sha256File(filePath), expectedSha256,
    "immutable JSON evidence read-back mismatch");
}
function invokeTestHook(hooks, name, detail) {
  const hook = hooks?.[name];
  if (typeof hook === "function") hook(detail);
}
function windowsDpapiMachineProtector() {
  assert.equal(process.platform, "win32", "Smoke machine key protection requires Windows DPAPI");
  const run = (operation, input, entropy) => {
    const script = [
      "$ErrorActionPreference='Stop'", "$s=[Console]::OpenStandardInput()", "$m=[IO.MemoryStream]::new()", "$s.CopyTo($m)", "$d=$m.ToArray()",
      `$e=[Convert]::FromBase64String('${Buffer.from(entropy).toString("base64")}')`,
      operation === "protect" ? "$r=[Security.Cryptography.ProtectedData]::Protect($d,$e,[Security.Cryptography.DataProtectionScope]::LocalMachine)" : "$r=[Security.Cryptography.ProtectedData]::Unprotect($d,$e,[Security.Cryptography.DataProtectionScope]::LocalMachine)",
      "$o=[Console]::OpenStandardOutput()", "$o.Write($r,0,$r.Length)",
    ].join("\n");
    const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { input, encoding: null, windowsHide: true, timeout: 30_000 });
    if (result.error || result.status !== 0) throw result.error ?? new Error(`Windows DPAPI ${operation} failed`);
    return Buffer.from(result.stdout);
  };
  return Object.freeze({ scheme: "windows_dpapi_local_machine_v1", protect: (b, e) => run("protect", b, e), unprotect: (b, e) => run("unprotect", b, e) });
}

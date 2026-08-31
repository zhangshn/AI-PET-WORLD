import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildStage4V2SmokeTicket,
  consumeStage4V2SmokeTicket,
  ensureStage4V2SmokeTicketIssuer,
  initializeStage4V2SmokeTicketLedger,
  registerStage4V2SmokeTicket,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-ticket-v1.mjs";
import { sha256File } from "../lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

for (const crashPoint of [
  "afterConsumptionPrepareCommit",
  "afterConsumptionEvidencePersisted",
  "afterConsumptionCommit",
]) {
  const fixture = createFixture(crashPoint);
  assert.throws(() => consumeStage4V2SmokeTicket({
    ...fixture.consumeArgs,
    _testHooks: { [crashPoint]: () => { throw new Error(`injected:${crashPoint}`); } },
  }), new RegExp(`injected:${crashPoint}`));
  const recovered = consumeStage4V2SmokeTicket(fixture.consumeArgs);
  assert.equal(recovered.consumption.ticketId, fixture.ticket.ticketId);
  assert.ok([
    "prepared_consumption_committed", "already_committed_verified",
  ].includes(recovered.recoveryStatus));
  assert.equal(fs.existsSync(path.join(fixture.root, fixture.ticket.outputDirectory)), false);
  const repeated = consumeStage4V2SmokeTicket(fixture.consumeArgs);
  assert.equal(repeated.recoveryStatus, "already_committed_verified");
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

process.stdout.write("Stage4 V2 controlled-Smoke ticket recovery: 3/3 crash points passed\n");

function createFixture(suffix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-smoke-ticket-"));
  const keyProtector = {
    scheme: "test_copy_protector_v1",
    protect: (bytes) => Buffer.from(bytes),
    unprotect: (bytes) => Buffer.from(bytes),
  };
  const issuerResult = ensureStage4V2SmokeTicketIssuer({ projectRoot: root, keyProtector });
  const evidencePath = writeJson(root, `evidence-${suffix}.json`, { status: "passed" });
  const programPath = writeJson(root, `program-${suffix}.mjs`, { implementation: "fixture" });
  const packageId = `stage4-v2-smoke-package-${suffix.toLowerCase()}`;
  const runId = `stage4-v2-smoke-run-${suffix.toLowerCase()}`;
  const outputDirectory = `.runtime/ai-painter/stage4-v2-controlled-smoke-executions/${runId}`;
  const derivedTrainerExecution = {
    ticketId: `stage4-v2-smoke-trainer-${suffix.toLowerCase()}`,
    configContractSha256: "a".repeat(64),
    outputDirectory,
    oneTimeConsumptionInheritedFromParent: true,
    independentAuthorizationAuthority: false,
  };
  const inputEvidence = [binding(root, evidencePath)];
  const programLineage = { nodeAdapter: binding(root, programPath) };
  const payload = {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-package-payload-v1",
    packageId, runId, outputDirectory, derivedTrainerExecution,
    ticketIssuer: issuerResult.issuerBinding,
    inputEvidence, programLineage,
  };
  const payloadPath = writeJson(root, `payload-${suffix}.json`, payload);
  const payloadBinding = binding(root, payloadPath);
  const ticket = buildStage4V2SmokeTicket({
    packageId, runId, packagePayload: payload, packagePayloadBinding: payloadBinding,
    issuer: issuerResult.issuer, privateKey: issuerResult.privateKey,
    inputEvidence, programLineage, outputDirectory,
    issuedAtUtc: "2026-09-01T00:00:00.000Z",
    expiresAtUtc: "2030-09-01T00:00:00.000Z",
    nonce: `nonce-${suffix.toLowerCase()}-12345678`,
  });
  const ticketPath = writeJson(root, `ticket-${suffix}.json`, ticket);
  const ticketBinding = binding(root, ticketPath);
  initializeStage4V2SmokeTicketLedger({ projectRoot: root });
  registerStage4V2SmokeTicket({
    projectRoot: root, ticket, ticketBinding,
    packagePayloadBinding: payloadBinding,
  });
  return {
    root, ticket,
    consumeArgs: {
      projectRoot: root, ticket, packagePayload: payload,
      ticketBinding, packagePayloadBinding: payloadBinding,
      consumptionPath: `.runtime/ai-painter/smoke-consumptions/${suffix}.json`,
      consumedAtUtc: "2026-09-01T00:01:00.000Z",
    },
  };
}

function writeJson(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  return target;
}

function binding(root, absolute) {
  return {
    path: path.relative(root, absolute).replaceAll("\\", "/"),
    sha256: sha256File(absolute),
    byteSize: fs.statSync(absolute).size,
  };
}

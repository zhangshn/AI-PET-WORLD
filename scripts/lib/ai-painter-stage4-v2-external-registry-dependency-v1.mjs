import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  appendAiPainterProgramEvent,
  verifyAiPainterProgramEventCommitted,
} from "./ai-painter-program-event-store.mjs";
import { catalogPath } from "./ai-pet-world-storage.mjs";
import {
  projectLogicalPath,
  readJsonObject,
  sha256File,
  writeExclusiveJson,
  writeJsonAtomic,
} from "./ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";

export const EXTERNAL_REGISTRY_DEPENDENCY_SCHEMA =
  "ai-painter-current-execution-registry-dependency-manifest-v1";

const JOURNAL_STATES = Object.freeze(["artifacts_staged", "event_committed"]);
const SHA256 = /^[a-f0-9]{64}$/u;

/**
 * Persist the durable dependency boundary required before a current-execution
 * registry publication. The journal is intentionally committed before the
 * registry writer is entered: a retry can re-establish the exact event and
 * manifest without repeating the governed Smoke/GPU operation.
 */
export function commitStage4V2ExternalRegistryDependencies({
  projectRoot = process.cwd(),
  journalPath,
  journalSchemaVersion,
  operationId,
  capabilityVersion,
  packageId,
  runId,
  recordedAtUtc,
  bindings,
  eventInput,
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  assert.equal(path.resolve(process.cwd()), root,
    "program event store root differs from registry dependency project root");
  const absoluteJournal = resolveInside(root, journalPath);
  assert.match(journalSchemaVersion ?? "", /^[a-z0-9][a-z0-9-]{7,191}$/u,
    "registry dependency journal schema is invalid");
  assert.match(operationId ?? "", /^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$/u,
    "registry dependency operationId is invalid");
  assert.ok(typeof capabilityVersion === "string" && capabilityVersion.length > 0,
    "registry dependency capabilityVersion is missing");
  assert.ok(typeof packageId === "string" && packageId.length > 0,
    "registry dependency packageId is missing");
  assert.ok(typeof runId === "string" && runId.length > 0,
    "registry dependency runId is missing");
  assert.ok(typeof recordedAtUtc === "string" && Number.isFinite(Date.parse(recordedAtUtc)),
    "registry dependency recordedAtUtc is invalid");
  const normalizedBindings = normalizeBindings(bindings);
  assert.equal(eventInput?.id && typeof eventInput.id === "string", true,
    "registry dependency program event id is required");

  const prepared = {
    schemaVersion: journalSchemaVersion,
    state: "artifacts_staged",
    operationId,
    capabilityVersion,
    packageId,
    runId,
    bindings: normalizedBindings,
    programEventId: eventInput.id,
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  };
  let journal;
  if (!fs.existsSync(absoluteJournal)) {
    writeExclusiveJson(absoluteJournal, prepared);
    journal = prepared;
  } else {
    journal = readJsonObject(absoluteJournal);
    verifyJournalIdentity(journal, prepared);
  }
  invokeHook(_testHooks, "afterRegistryDependencyJournalPrepared", { journal });

  appendAiPainterProgramEvent(eventInput);
  const eventCommit = verifyAiPainterProgramEventCommitted(eventInput);
  assert.equal(eventCommit?.event?.id, eventInput.id,
    "registry dependency program event commit identity mismatch");
  invokeHook(_testHooks, "afterRegistryDependencyProgramEventCommitted", {
    journal,
    eventCommit,
  });

  const committed = {
    ...prepared,
    state: "event_committed",
  };
  if (journal.state === "artifacts_staged") {
    writeJsonAtomic(absoluteJournal, committed);
    journal = readJsonObject(absoluteJournal);
  }
  assert.deepEqual(journal, committed,
    "registry dependency journal committed state conflicts with exact operation");
  invokeHook(_testHooks, "afterRegistryDependencyJournalEventCommitted", {
    journal,
    eventCommit,
  });

  return Object.freeze({
    journal: Object.freeze(journal),
    eventCommit,
    dependencyManifest: buildStage4V2ExternalRegistryDependencyManifest({
      projectRoot: root,
      journalPath: absoluteJournal,
      eventCommit,
      bindings: normalizedBindings,
    }),
  });
}

export function buildStage4V2ExternalRegistryDependencyManifest({
  projectRoot = process.cwd(),
  journalPath,
  eventCommit,
  bindings,
} = {}) {
  const root = path.resolve(projectRoot);
  const absoluteJournal = resolveInside(root, journalPath);
  const journal = readJsonObject(absoluteJournal);
  assert.equal(journal.state, "event_committed",
    "registry dependency outer journal is not event-committed");
  const normalizedBindings = normalizeBindings(bindings);
  assert.deepEqual(journal.bindings, normalizedBindings,
    "registry dependency journal bindings changed");
  assert.equal(journal.programEventId, eventCommit?.event?.id,
    "registry dependency journal/program event identity mismatch");
  validateEventCommit(eventCommit);
  return Object.freeze({
    schemaVersion: EXTERNAL_REGISTRY_DEPENDENCY_SCHEMA,
    mode: "external",
    outerJournal: {
      path: projectLogicalPath(root, absoluteJournal),
      sha256: sha256File(absoluteJournal),
      requiredState: "event_committed",
      operationId: journal.operationId,
    },
    bindings: normalizedBindings,
    programEvent: {
      event: eventCommit.event,
      eventId: eventCommit.event.id,
      ledgerPath: eventCommit.ledger.path,
      latestPath: eventCommit.latest.path,
      catalogDatabasePath: catalogPath,
    },
    catalogArtifacts: [
      {
        logicalPath: eventCommit.catalog.ledgerArtifact.path,
        sha256: eventCommit.catalog.ledgerArtifact.sha256,
      },
      {
        logicalPath: eventCommit.catalog.latestArtifact.path,
        sha256: eventCommit.catalog.latestArtifact.sha256,
      },
    ],
  });
}

function verifyJournalIdentity(actual, prepared) {
  assert.ok(JOURNAL_STATES.includes(actual?.state),
    "registry dependency journal state is invalid");
  const normalized = { ...actual, state: "artifacts_staged" };
  assert.deepEqual(normalized, prepared,
    "registry dependency journal belongs to another operation");
}

function normalizeBindings(bindings) {
  assert.ok(Array.isArray(bindings) && bindings.length > 0,
    "registry dependency bindings are required");
  const roles = new Set();
  return bindings.map((binding) => {
    assert.ok(typeof binding?.role === "string" && binding.role.length > 0,
      "registry dependency binding role is missing");
    assert.equal(roles.has(binding.role), false,
      `duplicate registry dependency binding role: ${binding.role}`);
    roles.add(binding.role);
    assert.ok(typeof binding.path === "string" && binding.path.length > 0,
      `registry dependency binding path is missing: ${binding.role}`);
    assert.match(binding.sha256 ?? "", SHA256,
      `registry dependency binding SHA-256 is invalid: ${binding.role}`);
    return {
      role: binding.role,
      path: binding.path,
      sha256: binding.sha256,
      ...(Number.isInteger(binding.byteSize) && binding.byteSize >= 0
        ? { byteSize: binding.byteSize } : {}),
    };
  });
}

function validateEventCommit(value) {
  assert.ok(value?.event && typeof value.event.id === "string",
    "registry dependency event commit is missing");
  for (const [label, binding] of [
    ["ledger", value.ledger],
    ["latest", value.latest],
    ["catalog ledger", value.catalog?.ledgerArtifact],
    ["catalog latest", value.catalog?.latestArtifact],
  ]) {
    assert.ok(typeof binding?.path === "string" && SHA256.test(binding.sha256 ?? ""),
      `registry dependency ${label} binding is invalid`);
  }
}

function resolveInside(root, value) {
  assert.ok(typeof value === "string" && value.length > 0,
    "registry dependency journal path is missing");
  const absolute = path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
  const relative = path.relative(root, absolute);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    "registry dependency journal escapes project root");
  return absolute;
}

function invokeHook(hooks, name, value) {
  if (typeof hooks?.[name] === "function") hooks[name](value);
}

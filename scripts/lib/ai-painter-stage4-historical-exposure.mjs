// Read-only historical-use audit. Observed use can disprove an unseen claim;
// absence from these legacy formats can never certify that a sample was unseen.
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const PREFIX = ".runtime/ai-painter/";
const FILENAMES = ["condition-evidence.json", "stage4-step-telemetry.json"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const requireValue = (value, message) => { if (!value) throw new Error(message); };
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const validPath = (value) => typeof value === "string" && value.startsWith(PREFIX)
  && !value.includes("\\") && !value.includes(":")
  && value.split("/").every((part) => !["", ".", "..", "latest", "latest.json"].includes(part))
  && FILENAMES.includes(path.posix.basename(value));

export function mergeExposureInventory(diskPaths, catalogRows) {
  const merged = new Map();
  for (const logical of diskPaths) {
    requireValue(validPath(logical), "invalid historical exposure inventory path");
    requireValue(!merged.has(logical), "duplicate disk exposure path");
    merged.set(logical, { path: logical, onDisk: true, catalogSha256: null, catalogBytes: null });
  }
  const seen = new Set();
  for (const row of catalogRows) {
    requireValue(validPath(row.logical_path), "invalid catalog exposure path");
    requireValue(!seen.has(row.logical_path), "duplicate catalog exposure path");
    seen.add(row.logical_path);
    requireValue(row.sha256 === null || /^[a-f0-9]{64}$/.test(row.sha256), "invalid catalog exposure SHA");
    merged.set(row.logical_path, { path: row.logical_path, onDisk: merged.has(row.logical_path),
      catalogSha256: row.sha256, catalogBytes: row.byte_size });
  }
  return [...merged.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function discoverExposureInventory(root, catalogPath) {
  let output;
  try {
    output = execFileSync("rg", ["--files", "--hidden", "--no-ignore", ".runtime/ai-painter",
      ...FILENAMES.flatMap((name) => ["-g", name])],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    if (error.status !== 1) throw error;
    output = ""; // rg returns 1 for an empty inventory, not a successful audit.
  }
  const disk = output.trim() ? output.trim().split(/\r?\n/).map((name) => name.replaceAll("\\", "/")) : [];
  const database = new DatabaseSync(catalogPath, { readOnly: true });
  let rows;
  try {
    rows = database.prepare(`SELECT logical_path, sha256, byte_size FROM artifacts
      WHERE logical_path >= ? AND logical_path < ?
      AND (logical_path GLOB '*/condition-evidence.json' OR logical_path GLOB '*/stage4-step-telemetry.json')
      ORDER BY logical_path`).all(PREFIX, ".runtime/ai-painter0");
  } finally { database.close(); }
  return { entries: mergeExposureInventory(disk, rows), catalogPath,
    discovery: "runtime_filename_inventory_plus_readonly_sqlite_snapshot",
    coversOtherTrainingFormats: false, provesAllRunsInventoried: false };
}

export function recordedOptimizerSteps(telemetry) {
  // Public v1 parser remains strict, including its result shape/event identity.
  return parseOptimizerSteps(telemetry, false);
}

function parseOptimizerSteps(telemetry, allowUnknownAttribution) {
  requireValue(telemetry.schemaVersion === "stage4-bounded-repair-smoke-step-telemetry-v1",
    "unsupported optimizer telemetry schema");
  const unknownAttribution = telemetry.sampleId === null || telemetry.sampleId === undefined;
  requireValue((allowUnknownAttribution && unknownAttribution)
    || (typeof telemetry.sampleId === "string" && telemetry.sampleId.length > 0),
    "optimizer telemetry sample identity missing");
  requireValue(Array.isArray(telemetry.events), "optimizer telemetry events missing");
  const pending = new Set(), completed = new Set();
  let previousSequence = 0, previousTime = -Infinity;
  let observedEventSample = unknownAttribution ? null : telemetry.sampleId;
  for (const event of telemetry.events) {
    requireValue(Number.isSafeInteger(event.sequence) && event.sequence > previousSequence,
      "optimizer telemetry sequence is not strictly increasing");
    previousSequence = event.sequence;
    if (event.step !== "optimizer_step") continue;
    if (allowUnknownAttribution) requireValue(typeof event.recordedAtUtc === "string",
      "optimizer event timestamp missing or reversed");
    const time = Date.parse(event.recordedAtUtc);
    requireValue(Number.isFinite(time) && time >= previousTime, "optimizer event timestamp missing or reversed");
    previousTime = time;
    if (allowUnknownAttribution) {
      // Do not infer a run's sample from one event. A contradictory event still
      // invalidates the stream, even when the top-level attribution is unknown.
      requireValue(event.sampleIds === undefined, "unsupported optimizer event sampleIds attribution");
      if (event.sampleId !== undefined) {
        requireValue(typeof event.sampleId === "string" && event.sampleId.length > 0,
          "optimizer event sample identity conflict");
        observedEventSample ??= event.sampleId;
        requireValue(event.sampleId === observedEventSample, "optimizer event sample identity conflict");
      }
    } else requireValue(event.sampleId === undefined || event.sampleId === telemetry.sampleId,
      "optimizer event sample identity conflict");
    requireValue(Number.isSafeInteger(event.epoch) && event.epoch > 0
      && Number.isSafeInteger(event.batch) && event.batch > 0, "optimizer event coordinates missing");
    const key = `${event.epoch}:${event.batch}`;
    if (event.status === "started") {
      requireValue(!pending.has(key) && !completed.has(key), "duplicate optimizer step start");
      pending.add(key);
    } else if (event.status === "completed") {
      requireValue(pending.delete(key) && !completed.has(key), "optimizer completion without unique start");
      completed.add(key);
    } else if (event.status === "failed") {
      requireValue(pending.delete(key), "optimizer failure without start");
    } else throw new Error("unsupported optimizer step status");
  }
  const eventIdentity = hash(JSON.stringify({ sampleId: unknownAttribution ? null : telemetry.sampleId,
    events: telemetry.events.filter((event) => event.step === "optimizer_step")
      .map(({ step, status, epoch, batch, recordedAtUtc, sampleId }) => ({ step, status, epoch, batch, recordedAtUtc,
        ...(allowUnknownAttribution && sampleId !== undefined ? { sampleId } : {}) })) }));
  return { completedSteps: completed.size, incompleteSteps: pending.size, eventIdentity,
    source: "recorded_paired_optimizer_events_not_reexecuted_weight_proof" };
}

function verifyHistoricalRow(reader, manifest, row) {
  requireValue(typeof manifest.sourceIndexPath === "string" && /^[a-f0-9]{64}$/.test(manifest.sourceIndexSha256 ?? ""),
    "historical source index is not hash bound");
  verifyHistoricalSourceRow(reader, { path: manifest.sourceIndexPath, sha256: manifest.sourceIndexSha256 }, row);
}

function verifyHistoricalSourceRow(reader, sourceBinding, row) {
  const source = reader.bound(sourceBinding);
  const matches = source.samples?.filter((item) => item.sampleId === row.sampleId) ?? [];
  requireValue(matches.length === 1, "historical sample identity is not unique");
  const sample = matches[0];
  requireValue(sample.split === row.split && sample.imagePath === row.image.path
    && sample.imageSha256 === row.image.sha256 && sample.conditionPackPath === row.conditionPack.path,
  "historical sample content/split differs from current release");
  reader.bytes(row.image.path, row.image.sha256);
  reader.bytes(row.conditionPack.path, row.conditionPack.sha256);
}

// One explicitly supplied, immutable recovery root; never a directory search or
// a synthetic legacy trainer Manifest. Only the evaluation provenance is read.
function recoveredEvaluationSource(reader, rootBinding) {
  const explicitPath = value => typeof value === "string" && !value.includes("\\") && !value.includes(":")
    && (value.startsWith(PREFIX) || value.startsWith("data/"))
    && value.split("/").every(part => !["", ".", "..", "latest", "latest.json", "current.json"].includes(part));
  const binding = value => {
    requireValue(value && explicitPath(value.path) && /^[a-f0-9]{64}$/.test(value.sha256 ?? ""),
      "invalid explicit recovery binding");
    return { path: value.path, sha256: value.sha256 };
  };
  const same = (a, b) => {
    const left = binding(a), right = binding(b);
    requireValue(left.path === right.path && left.sha256 === right.sha256, "recovery cross-binding conflict");
  };
  const reads = [];
  const read = (value, expectedPath, schemaVersion) => {
    const bound = binding(value);
    requireValue(bound.path.endsWith(".json") && (!expectedPath || bound.path === expectedPath),
      "recovery JSON path/namespace conflict");
    const doc = reader.bound(bound);
    requireValue(doc.schemaVersion === schemaVersion, "unsupported recovery schema");
    reads.push(bound);
    return doc;
  };
  const recoveryRoot = binding(rootBinding), recoveryDirectory = path.posix.dirname(recoveryRoot.path);
  const root = read(recoveryRoot, `${recoveryDirectory}/registry-terminal-projection.json`,
    "ai-painter-joint-full-data-screen-post-checkpoint-recovery-registry-terminal-v1");
  const runDirectory = path.posix.dirname(path.posix.dirname(recoveryDirectory));
  requireValue(runDirectory.startsWith(PREFIX) && typeof root.runId === "string" && root.runId.length > 0
    && path.posix.basename(runDirectory) === root.runId && typeof root.recoveryId === "string" && root.recoveryId.length > 0
    && recoveryDirectory === `${runDirectory}/post-training-terminal-recoveries/${root.recoveryId}`
    && typeof root.sourcePackageIdentity === "string" && root.sourcePackageIdentity.length > 0,
  "recovery root identity/namespace conflict");
  requireValue(root.executionState === "completed" && root.resultExecutionState === "failed_closed"
    && root.status === "full_data_screen_real_visual_failure", "recovery root is not a non-promotable failure");
  const terminal = read(root.recoveryTerminal, `${recoveryDirectory}/phase-terminal.json`,
    "ai-painter-joint-full-data-screen-post-checkpoint-recovery-terminal-v1");
  const manifest = read(terminal.manifest, `${recoveryDirectory}/manifest.json`,
    "ai-painter-joint-condition-local-transport-full-data-screen-manifest-v1");
  same(terminal.recoveredTrainingEvidence, manifest.trainingManifest);
  const trainer = read(manifest.trainingManifest, `${recoveryDirectory}/recovered-trainer-evidence.json`,
    "ai-painter-joint-full-data-screen-recovered-training-evidence-v1");
  const recoverySchema = "ai-painter-stage4-joint-condition-local-transport-post-checkpoint-recovery-v1";
  const recovery = read(terminal.recoveryEvidence, `${recoveryDirectory}/post-checkpoint-recovery-evidence.json`, recoverySchema);
  for (const value of [terminal, recovery]) requireValue(value.runId === root.runId
    && value.recoveryId === root.recoveryId && value.sourcePackageIdentity === root.sourcePackageIdentity,
  "recovery run/package/identity conflict");
  requireValue(manifest.runId === root.runId && manifest.packageIdentity === root.recoveryId
    && trainer.stage4JointConditionLocalTransportFullDataScreen?.runId === root.runId,
  "recovered manifest/trainer run identity conflict");
  requireValue(terminal.executionState === "failed_closed" && terminal.status === root.status
    && terminal.correctedSourceFailureCode === "post_checkpoint_manifest_projection_defect"
    && manifest.status === "real_visual_failure"
    && trainer.status === "stage4_joint_condition_local_transport_full_data_screen_training_completed_awaiting_automatic_machine_review"
    && recovery.status === "post_checkpoint_projection_failure_verified_recoverable"
    && recovery.failureClassification?.correctedFailureCode === "post_checkpoint_manifest_projection_defect"
    && recovery.failureClassification.originalTrainerManifestCreated === false,
  "recovery failure/derived role conflict");
  for (const flags of [manifest.postCheckpointRecovery, trainer.evidenceRecovery]) {
    requireValue(flags?.schemaVersion === recoverySchema && flags.recoveryId === root.recoveryId
      && flags.correctedFailureCode === "post_checkpoint_manifest_projection_defect"
      && flags.derivedManifestNotOriginalTrainerManifest === true && flags.checkpointPromotable === false
      && flags.checkpointWeightsLoaded === false && flags.gpuStarted === false && flags.trainingRestarted === false,
    "recovery cannot claim original Manifest, loaded weights or promotion");
    same(flags.recoveryEvidence, terminal.recoveryEvidence);
    same(flags.sourceFailureTerminal, recovery.sourceEvidence?.sourceTerminal);
  }
  const sourceTerminal = binding(recovery.sourceEvidence.sourceTerminal);
  requireValue(sourceTerminal.path === `${PREFIX}autonomous-closed-loop-executions/${root.sourcePackageIdentity}/phase-terminal.json`,
    "recovery source package/terminal path conflict");
  const sourceFailure = read(sourceTerminal, sourceTerminal.path, "ai-painter-autonomous-closed-loop-terminal-v1");
  requireValue(sourceFailure.packageIdentity === root.sourcePackageIdentity
    && (sourceFailure.runId === undefined || sourceFailure.runId === root.runId)
    && sourceFailure.status === "failed_closed" && sourceFailure.failureCode === "trainer_failed_after_start"
    && sourceFailure.finalResult?.status === "failed" && sourceFailure.finalResult.failureKind === "business"
    && sourceFailure.finalResult.failureCode === sourceFailure.failureCode
    && recovery.failureClassification.sourceFailureCode === sourceFailure.failureCode,
  "recovery source failure terminal identity/status conflict");
  const latest = sourceFailure.latestEvidence;
  requireValue(latest?.phase === "execute" && Number.isSafeInteger(latest.attempt) && latest.attempt >= 0
    && latest.path === `phase-evidence/execute-attempt-${latest.attempt}.json`,
  "recovery source failure execute identity conflict");
  same({ path: `${path.posix.dirname(sourceTerminal.path)}/${latest.path}`, sha256: latest.sha256 },
    recovery.sourceEvidence.executeEvidence);
  requireValue(terminal.trainingRestarted === false && terminal.gpuStarted === false && terminal.checkpointWeightsLoaded === false
    && terminal.stage0Started === false && manifest.stage0Started === false && manifest.trainingRetryStarted === false
    && manifest.checkpoint?.promotable === false && trainer.checkpointPromotionEligible === false
    && trainer.stage0InitializationEligible === false && recovery.checkpoint?.promotable === false
    && recovery.checkpoint.loadedOrDeserializedDuringRecovery === false,
  "recovery non-promotable failure boundary conflict");
  // Compare checkpoint identity metadata only. Never open the weight file.
  const checkpoint = binding(manifest.checkpoint);
  requireValue(path.posix.dirname(checkpoint.path) === `${runDirectory}/training-output`,
    "recovery checkpoint namespace conflict");
  same(checkpoint, { path: trainer.checkpointPath, sha256: trainer.checkpointSha256 });
  same(checkpoint, recovery.checkpoint);
  same(checkpoint, recovery.sourceEvidence.checkpointIdentityOnly);
  const activeConfig = binding(recovery.sourceEvidence.activeConfig);
  same(activeConfig, { path: trainer.configPath, sha256: trainer.configSha256 });
  const config = read(activeConfig, `${runDirectory}/active-config.json`,
    "ai-painter-stage4-joint-condition-local-transport-full-data-screen-config-v1");
  requireValue(config.status === "full_data_screen_active_not_started" && config.executionIdentity?.runId === root.runId
    && config.executionIdentity.outputNamespace === runDirectory && config.executionIdentity.crossRunEvidenceAllowed === false
    && config.executionIdentity.namespaceReuseAllowed === false, "recovery config execution identity conflict");
  const capability = "stage4_full_backbone_joint_condition_local_transport_denoiser_v1";
  requireValue([manifest.capabilityVersion, recovery.capabilityVersion, config.denoiserArchitecture,
    trainer.stage4JointConditionLocalTransportFullDataScreen.architectureId].every(value => value === capability)
    && config.architectureVersion === "joint-condition-local-transport-denoiser-v1"
    && trainer.architectureVersion === config.architectureVersion,
  "recovery capability identity conflict");
  const sourceIndex = binding(config.evidenceBindings?.approvedDataset?.sourceIndex);
  const source = read(sourceIndex, null, "ai-assisted-cold-start-dataset-source-index-v1");
  requireValue(typeof source.packageId === "string" && source.packageId.length > 0
    && source.packageId === config.evidenceBindings.approvedDataset.datasetPackageId && Array.isArray(source.samples),
  "recovery source dataset identity conflict");
  const conditionEvidence = binding(recovery.sourceEvidence.conditionEvidence);
  requireValue(conditionEvidence.path === `${runDirectory}/training-output/condition-evidence.json`,
    "recovery condition evidence namespace conflict");
  // This schema is known for this specific recovery protocol, not a blanket
  // exemption for arbitrary trainer formats or unbound historical source paths.
  read(conditionEvidence, conditionEvidence.path, "ai-assisted-conditional-denoiser-evidence-v4");
  const summary = { recoveryRoot, recoveryTerminal: binding(root.recoveryTerminal), manifest: binding(terminal.manifest),
    recoveredTrainingEvidence: binding(manifest.trainingManifest), recoveryEvidence: binding(terminal.recoveryEvidence),
    sourceFailureTerminal: sourceTerminal, activeConfig, sourceIndex, conditionEvidence, runId: root.runId, recoveryId: root.recoveryId,
    sourcePackageIdentity: root.sourcePackageIdentity, role: "derived_recovery_evaluation_only",
    conditionIdentityScope: "historical_path_and_current_release_bytes_only", historicalConditionBytesIdentityProven: false,
    acceptedEvaluationRecords: 0, originalManifestRecreated: false, optimizerUpdateProven: false,
    checkpointSelectionProven: false, trainingAllowed: false, unseenHoldoutQualified: false };
  return { summary, verifyStable: () => { for (const value of reads) reader.bytes(value.path, value.sha256); } };
}

const REPLAY_TYPES = new Map([
  ["epoch_worst_sample_class_replay", "stage4EpochWorstSampleClassReplay"],
  ["epoch_complete_per_class_selected_luminance_replay", "stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity"],
  ["epoch_complete_per_class_selected_reference_feature_replay", "stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay"],
]);

// These legacy writers log replay only AFTER optimizer.step(), not as a
// started/completed pair. This proves recorded events, not executed weights.
export function recordedReplaySteps(telemetry, config) {
  parseOptimizerSteps(telemetry, true);
  const contract = config.training?.stage4EpochWorstSampleClassReplay;
  const passes = contract?.replay?.passesPerObservedPrimaryBatch;
  requireValue(contract?.enabled === true && Number.isSafeInteger(passes) && passes > 0,
    "historical replay budget missing or invalid");
  const completedEvents = [], seen = new Set();
  let currentPrimary = null, completedPrimary = null, previousTime = -Infinity, nextPass = 1;
  for (const [eventIndex, event] of telemetry.events.entries()) {
    const isReplay = typeof event.step === "string" && /replay/i.test(event.step);
    if (!isReplay && event.step !== "optimizer_step") continue;
    requireValue(typeof event.recordedAtUtc === "string", "replay/primary timestamp missing");
    const time = Date.parse(event.recordedAtUtc);
    requireValue(Number.isFinite(time) && time >= previousTime, "replay/primary timestamp reversed or invalid");
    previousTime = time;
    const primaryKey = `${event.epoch}:${event.batch}`;
    if (!isReplay) {
      if (event.status === "started") { currentPrimary = primaryKey; completedPrimary = null; nextPass = 1; }
      if (event.status === "completed") completedPrimary = primaryKey;
      if (event.status === "failed") completedPrimary = null;
      continue;
    }
    requireValue(REPLAY_TYPES.has(event.step), "unsupported historical replay event type");
    requireValue(config.training[REPLAY_TYPES.get(event.step)]?.enabled === true, "replay event lacks enabled bound configuration");
    requireValue(event.status === "completed", "replay event is not a recorded completion");
    requireValue([event.epoch, event.batch, event.replayPass].every(n => Number.isSafeInteger(n) && n > 0),
      "replay coordinates missing or invalid");
    requireValue(primaryKey === currentPrimary && primaryKey === completedPrimary, "replay lacks preceding completed primary batch");
    const key = `${primaryKey}:${event.replayPass}`;
    requireValue(!seen.has(key), "duplicate replay slot across event types");
    requireValue(event.replayPass === nextPass && event.replayPass <= passes, "replay pass order or budget conflict");
    requireValue(typeof event.sampleId === "string" && event.sampleId.length > 0 && event.sampleIds === undefined,
      "replay sample identity missing or ambiguous");
    const classes = event.step === "epoch_worst_sample_class_replay"
      ? ["route", "footprints", "tree", "rock", "vegetation", "joint_four_object_reference_multiscale"]
      : ["footprints", "tree", "rock", "vegetation"];
    requireValue(classes.includes(event.classIdentity) && finite(event.selectionScore), "replay class or selection score invalid");
    requireValue(event.replayLane === undefined || (typeof event.replayLane === "string" && event.replayLane.length > 0),
      "replay lane invalid");
    seen.add(key); nextPass++;
    const identity = { step: event.step, epoch: event.epoch, batch: event.batch, replayPass: event.replayPass,
      sampleId: event.sampleId, classIdentity: event.classIdentity, selectionScore: event.selectionScore,
      recordedAtUtc: event.recordedAtUtc, ...(event.replayLane === undefined ? {} : { replayLane: event.replayLane }) };
    completedEvents.push({ ...identity, eventIndex, sequence: event.sequence, eventIdentity: hash(JSON.stringify(identity)) });
  }
  return { completedEvents, passesPerPrimaryBatch: passes,
    source: "recorded_completed_replay_events_not_reexecuted_weight_proof" };
}

export function auditHistoricalExposure({ root, reader, rows, inventory, progress = () => {}, semanticsVersion = 1, recoveryRoots = [] }) {
  requireValue([1, 2, 3].includes(semanticsVersion), "unsupported historical exposure semanticsVersion");
  requireValue(Array.isArray(recoveryRoots) && recoveryRoots.length <= 16, "recovery roots must be a bounded array (maximum 16)");
  requireValue(semanticsVersion === 3 || recoveryRoots.length === 0, "recovery roots require semanticsVersion 3");
  requireValue(new Set(recoveryRoots.map(item => item?.path)).size === recoveryRoots.length
    && new Set(recoveryRoots.map(item => item?.sha256)).size === recoveryRoots.length, "duplicate recovery roots");
  requireValue(Array.isArray(rows) && rows.length > 0, "current exposure rows missing");
  const byId = new Map(rows.map((row) => [row.sampleId, row]));
  requireValue(byId.size === rows.length, "duplicate current exposure sample ID");
  const observations = [], gaps = [], files = [], reservations = [];
  const runLevelOptimizerObservations = [], evaluationRoleDifferences = [];
  const replayOptimizerObservations = [], replayAccounting = [];
  // Bad explicit roots are fatal, including roots with no matching inventory
  // entry. The caller may not silently turn invalid provenance into absence.
  const recoverySources = recoveryRoots.map(value => recoveredEvaluationSource(reader, value));
  const recoveryByEvidence = new Map(recoverySources.map(value => [value.summary.conditionEvidence.path, value]));
  requireValue(recoveryByEvidence.size === recoverySources.length, "ambiguous recovery sources for one condition evidence file");
  const manifests = new Map();
  const verifiedRows = new Set();
  function manifestFor(logical) {
    const manifestPath = `${path.posix.dirname(logical)}/manifest.json`;
    if (!manifests.has(manifestPath)) {
      const value = reader.json(manifestPath);
      requireValue(/^project-owned-ai-assisted-cold-start-checkpoint-v[2-7](?:-engineering-26)?$/.test(value.schemaVersion ?? ""),
        "unsupported historical trainer manifest schema");
      manifests.set(manifestPath, value);
    }
    return { value: manifests.get(manifestPath), path: manifestPath };
  }
  function verifyRow(manifest, row) {
    const key = `${manifest.path}:${row.sampleId}`;
    if (!verifiedRows.has(key)) { verifyHistoricalRow(reader, manifest.value, row); verifiedRows.add(key); }
  }
  function evaluationManifestFor(logical) {
    try { return manifestFor(logical); }
    catch (error) {
      const recovery = recoveryByEvidence.get(logical);
      if (error.code !== "ENOENT" || !recovery) throw error;
      return { path: recovery.summary.manifest.path, recovery };
    }
  }
  for (const [index, entry] of inventory.entries.entries()) {
    const logical = entry.path;
    try {
      requireValue(validPath(logical), "invalid historical evidence path");
      const bytes = reader.bytes(logical);
      const actualSha256 = hash(bytes);
      const catalogMatches = entry.catalogSha256 === null ? null : entry.catalogSha256 === actualSha256
        && entry.catalogBytes === bytes.length;
      if (catalogMatches === false) gaps.push({ path: logical, code: "historical_catalog_bytes_conflict",
        catalogSha256: entry.catalogSha256, actualSha256 });
      const evidence = JSON.parse(bytes.toString("utf8"));
      files.push({ path: logical, sha256: actualSha256, catalogMatches, schemaVersion: evidence.schemaVersion });
      if (path.posix.basename(logical) === "condition-evidence.json") {
        requireValue(/^ai-assisted-conditional-denoiser-evidence-v[1-4]$/.test(evidence.schemaVersion ?? "")
          && Array.isArray(evidence.records), "unsupported historical condition evidence schema");
        for (const [recordIndex, record] of evidence.records.entries()) {
          if (!record.sampleId) {
            reservations.push({ path: logical, recordIndex, split: record.split ?? null,
              status: record.status ?? null, provesNeverObserved: false });
            continue;
          }
          const row = byId.get(record.sampleId);
          if (!row) continue;
          if (!["velocityPredictionLoss", "decodedRgbMae", "compositeConditionQualityScore"]
            .some((key) => finite(record[key]))) continue;
          try {
            requireValue(["train", "validation", "challenge", "regression"].includes(record.split)
              && record.conditionPackPath === row.conditionPack.path,
              "historical evaluation identity conflict");
            const manifest = evaluationManifestFor(logical);
            if (manifest.recovery) {
              const recovered = manifest.recovery.summary;
              requireValue(recovered.conditionEvidence.sha256 === actualSha256,
                "condition evidence does not match recovery binding");
              requireValue(/\.(png|jpe?g|webp)$/.test(row.image.path) && row.conditionPack.path.endsWith(".json"),
                "recovery row must bind image/JSON data, not model files");
              verifyHistoricalSourceRow(reader, recovered.sourceIndex, row);
              recovered.acceptedEvaluationRecords++;
            } else {
              requireValue(manifest.value.conditionEvidencePath === logical
                && manifest.value.conditionEvidenceSha256 === actualSha256,
              "condition evidence does not match trainer manifest binding");
              verifyRow(manifest, row);
            }
            if (record.split !== row.split) {
              if (semanticsVersion === 1) gaps.push({ path: logical, sampleId: row.sampleId,
                code: "historical_evaluation_split_relabelled", releasedSplit: row.split,
                recordedEvaluationSplit: record.split });
              else evaluationRoleDifferences.push({ sampleId: row.sampleId, releasedSplit: row.split,
                recordedEvaluationSplit: record.split, evidencePath: logical, evidenceSha256: actualSha256,
                recordIndex, manifestPath: manifest.path, optimizerUpdateProven: false,
                checkpointSelectionProven: false, splitRelabelProven: false });
            }
            observations.push({ sampleId: row.sampleId, split: row.split, usage: "recorded_evaluation",
              evidencePath: logical, evidenceSha256: actualSha256, recordIndex, manifestPath: manifest.path,
              recordedEvaluationSplit: record.split,
              optimizerUpdateProven: false, checkpointSelectionProven: false,
              ...(manifest.recovery ? { recoveryRoot: manifest.recovery.summary.recoveryRoot,
                evidenceRole: "derived_recovery_evaluation_only" } : {}),
              ...(semanticsVersion >= 2 ? { splitRelabelProven: false } : {}) });
          } catch (error) { gaps.push({ path: logical, sampleId: row.sampleId, code: "evaluation_binding_unverified", reason: error.message }); }
        }
      } else {
        const steps = semanticsVersion === 1 ? recordedOptimizerSteps(evidence) : parseOptimizerSteps(evidence, true);
        let verifiedReplayCount = 0;
        if (semanticsVersion === 3 && evidence.events.some(e => typeof e.step === "string" && /replay/i.test(e.step))) {
          try {
            const manifest = manifestFor(logical);
            requireValue(typeof manifest.value.checkpointPath === "string"
              && path.posix.dirname(manifest.value.checkpointPath) === path.posix.dirname(logical),
            "replay evidence and checkpoint execution directories differ");
            const configBinding = { path: manifest.value.configPath, sha256: manifest.value.configSha256 };
            const config = reader.bound(configBinding);
            const replay = recordedReplaySteps(evidence, config);
            const accounted = manifest.value.trainingTokenAccounting?.runTotals?.optimizerSteps;
            requireValue(Number.isSafeInteger(accounted) && accounted >= steps.completedSteps + replay.completedEvents.length,
              "replay plus primary events exceed or lack trainer accounting");
            // Validate the complete file before publishing any of its per-sample
            // replay observations. The event's sample is NOT the overfit sample.
            const verified = replay.completedEvents.map(event => {
              const row = byId.get(event.sampleId);
              requireValue(row, "replay sample not bound to the current audited release");
              verifyRow(manifest, row);
              return { ...event, split: row.split, usage: "recorded_replay_optimizer_event",
                evidencePath: logical, evidenceSha256: actualSha256, manifestPath: manifest.path,
                configBinding, source: replay.source, violatesCurrentSplitPolicy: row.split !== "train",
                optimizerUpdateProven: false, checkpointSelectionProven: false, historicalWeightsLoaded: false };
            });
            replayOptimizerObservations.push(...verified);
            verifiedReplayCount = verified.length;
            replayAccounting.push({ evidencePath: logical, evidenceSha256: actualSha256, manifestPath: manifest.path,
              primaryPairedEvents: steps.completedSteps, recordedReplayEvents: verifiedReplayCount,
              reportedOptimizerSteps: accounted, eventsMatchReportedTotal: accounted === steps.completedSteps + verifiedReplayCount,
              wholeRunExecutionProven: false });
          } catch (error) { gaps.push({ path: logical, code: "historical_replay_evidence_unverified", reason: error.message }); }
        }
        if (semanticsVersion >= 2 && (evidence.sampleId === null || evidence.sampleId === undefined)) {
          // Raw paired events survive without inventing sample, Dataset, weight
          // or checkpoint-selection lineage. No inferred sibling Manifest read.
          runLevelOptimizerObservations.push({ usage: "recorded_optimizer_events_unattributed",
            evidencePath: logical, evidenceSha256: actualSha256, runDirectory: path.posix.dirname(logical),
            sampleId: null, split: null, sampleAttributionStatus: "unknown",
            optimizerCountScope: "paired_events_without_sample_attribution", ...steps,
            optimizerUpdateProven: false, checkpointSelectionProven: false,
            datasetBindingVerified: false, weightLineageProven: false, trainingAllowed: false });
          if (steps.completedSteps > 0 || steps.incompleteSteps > 0) gaps.push({ path: logical,
            code: "historical_optimizer_sample_attribution_missing", completedSteps: steps.completedSteps,
            incompleteSteps: steps.incompleteSteps, eventIdentity: steps.eventIdentity });
          continue;
        }
        const row = byId.get(evidence.sampleId);
        if (!row || steps.completedSteps === 0) continue;
        const manifest = manifestFor(logical);
        requireValue(typeof manifest.value.checkpointPath === "string"
          && path.posix.dirname(manifest.value.checkpointPath) === path.posix.dirname(logical),
        "optimizer evidence and checkpoint execution directories differ");
        const selected = manifest.value.singleSampleOverfitSmoke;
        requireValue(selected?.enabled === true && selected.sampleId === row.sampleId
          && selected.selectedSplit === row.split && selected.conditionPackPath === row.conditionPack.path,
        "optimizer source not bound to historical single-sample selection");
        verifyRow(manifest, row);
        const accounted = manifest.value.trainingTokenAccounting?.runTotals?.optimizerSteps;
        requireValue(Number.isSafeInteger(accounted) && accounted >= steps.completedSteps,
          "optimizer event count exceeds or lacks trainer accounting");
        // Legacy replay work can be included in totals but absent from this event
        // format. Count only paired events; never manufacture the missing steps.
        if (accounted !== steps.completedSteps + verifiedReplayCount) gaps.push({ path: logical,
          code: "historical_optimizer_accounting_exceeds_paired_event_coverage",
          reportedOptimizerSteps: accounted, pairedOptimizerEvents: steps.completedSteps,
          ...(semanticsVersion === 3 ? { verifiedReplayEvents: verifiedReplayCount } : {}) });
        observations.push({ sampleId: row.sampleId, split: row.split, usage: "recorded_optimizer_updates",
          evidencePath: logical, evidenceSha256: actualSha256, manifestPath: manifest.path,
          optimizerCountScope: "paired_events_lower_bound", reportedOptimizerSteps: accounted,
          ...(semanticsVersion === 3 ? { primaryEventIdentities: evidence.events
            .filter(e => e.step === "optimizer_step" && e.status === "completed")
            .map(e => hash(JSON.stringify({ sampleId: row.sampleId, epoch: e.epoch, batch: e.batch, recordedAtUtc: e.recordedAtUtc }))) } : {}),
          ...steps, violatesCurrentSplitPolicy: row.split !== "train", historicalWeightsLoaded: false });
      }
    } catch (error) { gaps.push({ path: logical, code: "historical_usage_evidence_unverified", reason: error.message }); }
    if ((index + 1) % 32 === 0) progress(`historical_usage_files_${index + 1}_of_${inventory.entries.length}`);
  }
  const countedStreams = new Set();
  const primaryEventsSeen = new Set();
  for (const observation of observations.filter((item) => item.usage === "recorded_optimizer_updates")) {
    observation.duplicateEventStream = countedStreams.has(observation.eventIdentity);
    if (observation.duplicateEventStream) gaps.push({ path: observation.evidencePath,
      code: "duplicate_historical_optimizer_event_stream", eventIdentity: observation.eventIdentity });
    countedStreams.add(observation.eventIdentity);
    if (semanticsVersion === 3) {
      observation.uniqueCompletedSteps = 0;
      for (const identity of observation.primaryEventIdentities) {
        if (primaryEventsSeen.has(identity)) {
          if (!observation.duplicateEventStream) gaps.push({ path: observation.evidencePath,
            code: "overlapping_historical_primary_event", eventIdentity: identity });
        } else observation.uniqueCompletedSteps++;
        primaryEventsSeen.add(identity);
      }
    }
  }
  const countedUnattributedStreams = new Set();
  for (const observation of runLevelOptimizerObservations) {
    const hasSteps = observation.completedSteps > 0 || observation.incompleteSteps > 0;
    observation.duplicateEventStream = hasSteps && countedUnattributedStreams.has(observation.eventIdentity);
    if (observation.duplicateEventStream) gaps.push({ path: observation.evidencePath,
      code: "duplicate_historical_optimizer_event_stream", eventIdentity: observation.eventIdentity });
    if (hasSteps) countedUnattributedStreams.add(observation.eventIdentity);
  }
  const replayEventsSeen = new Set();
  for (const event of replayOptimizerObservations) {
    event.duplicateEvent = replayEventsSeen.has(event.eventIdentity);
    if (event.duplicateEvent) gaps.push({ path: event.evidencePath, code: "duplicate_historical_replay_event", eventIdentity: event.eventIdentity });
    replayEventsSeen.add(event.eventIdentity);
  }
  const perSample = rows.map((row) => {
    const observed = observations.filter((item) => item.sampleId === row.sampleId);
    const updates = observed.filter((item) => item.usage === "recorded_optimizer_updates" && !item.duplicateEventStream
      && (semanticsVersion !== 3 || item.uniqueCompletedSteps > 0));
    const primarySteps = updates.reduce((sum, item) => sum + (semanticsVersion === 3 ? item.uniqueCompletedSteps : item.completedSteps), 0);
    const replays = replayOptimizerObservations.filter(e => e.sampleId === row.sampleId && !e.duplicateEvent);
    return { sampleId: row.sampleId, split: row.split,
      evaluationRuns: new Set(observed.filter((item) => item.usage === "recorded_evaluation").map((item) => item.manifestPath)).size,
      recordedOptimizerRuns: updates.length, recordedOptimizerSteps: primarySteps,
      optimizerCountScope: "paired_events_lower_bound_not_total_historical_updates",
      ...(semanticsVersion === 3 ? { recordedReplaySteps: replays.length,
        recordedReplayRuns: new Set(replays.map(e => e.manifestPath)).size,
        totalRecordedOptimizerSteps: primarySteps + replays.length,
        replayCountScope: "bound_completed_event_lower_bound_not_reexecuted_weight_proof" } : {}),
      unseenQualified: false,
      status: updates.length || replays.length ? "historical_optimizer_use_recorded" : observed.length ? "historical_evaluation_recorded" : "no_use_found_within_bounded_inventory_not_proof_of_unseen" };
  });
  // Real formal logs can contain tens of thousands of replay events. Keep the
  // immutable source bytes as the event store; reports carry a reproducible
  // per-file/per-sample selector digest, not repeated paths for every event.
  const replayGroups = new Map();
  for (const event of replayOptimizerObservations) {
    const key = JSON.stringify([event.evidencePath, event.sampleId]);
    if (!replayGroups.has(key)) replayGroups.set(key, { sampleId: event.sampleId, split: event.split,
      usage: "recorded_replay_optimizer_events", evidencePath: event.evidencePath, evidenceSha256: event.evidenceSha256,
      manifestPath: event.manifestPath, configBinding: event.configBinding, source: event.source,
      violatesCurrentSplitPolicy: event.violatesCurrentSplitPolicy, optimizerUpdateProven: false,
      checkpointSelectionProven: false, historicalWeightsLoaded: false, recordedCompletedEvents: 0,
      uniqueCompletedEvents: 0, duplicateCompletedEvents: 0, eventTypeCounts: {}, selectors: [] });
    const group = replayGroups.get(key);
    group.recordedCompletedEvents++;
    if (event.duplicateEvent) group.duplicateCompletedEvents++; else group.uniqueCompletedEvents++;
    group.eventTypeCounts[event.step] = (group.eventTypeCounts[event.step] ?? 0) + 1;
    group.selectors.push([event.eventIndex, event.eventIdentity]);
  }
  const compactReplayObservations = [...replayGroups.values()].map(({ selectors, ...group }) => ({ ...group,
    eventSelectionSha256: hash(JSON.stringify(selectors)),
    selectionIdentityAlgorithm: "sha256_ordered_event_index_and_event_identity_pairs_json_v1" }));
  for (const recovery of recoverySources) recovery.verifyStable();
  return { schemaVersion: `ai-painter-stage4-historical-exposure-audit-v${semanticsVersion}`,
    status: "bounded_historical_use_audited_not_qualified", recordedAtUtc: new Date().toISOString(),
    inventory, files, observations, reservations, gaps, perSample,
    summary: { inventoryFiles: inventory.entries.length, readableFiles: files.length,
      evaluationSamples: perSample.filter((item) => item.evaluationRuns > 0).length,
      recordedOptimizerSamples: perSample.filter((item) => item.recordedOptimizerRuns > 0 || item.recordedReplaySteps > 0).length,
      nonTrainOptimizerSamples: perSample.filter((item) => item.split !== "train"
        && (item.recordedOptimizerRuns > 0 || item.recordedReplaySteps > 0)).length,
      ...(semanticsVersion === 3 ? {
        recordedPrimaryOptimizerSamples: perSample.filter(item => item.recordedOptimizerRuns > 0).length,
        recordedReplaySamples: perSample.filter(item => item.recordedReplaySteps > 0).length,
        recordedReplayEvents: perSample.reduce((n, item) => n + item.recordedReplaySteps, 0),
      } : {}),
      unverifiedItems: gaps.length },
    limitations: ["other_training_formats_and_runs_without_condition_or_step_evidence_not_covered",
      "checkpoint_selection_causal_use_not_proven", "absence_of_observation_is_not_independent_holdout_qualification",
      "historical_source_hashes_are_not_retroactively_created", "current_bytes_do_not_prove_missing_historical_content_hashes"],
    trainingAllowed: false, unseenHoldoutQualified: false, gpuStarted: false, checkpointWeightsDeserialized: false,
    ...(semanticsVersion >= 2 ? { runLevelOptimizerObservations, evaluationRoleDifferences } : {}),
    ...(semanticsVersion === 3 ? { replayOptimizerObservations: compactReplayObservations, replayAccounting,
      recoveredEvaluationSources: recoverySources.map(value => value.summary) } : {}) };
}

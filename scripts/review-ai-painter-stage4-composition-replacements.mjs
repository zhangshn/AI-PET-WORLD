// Post-fix diagnostic replay only. No dataset, old review or capability gate is written.
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { auditAiAssistedCompositionNovelty } from "./lib/ai-assisted-composition-novelty.mjs";
import { createReader, explicitFile } from "./lib/ai-painter-stage4-dataset-audit.mjs";
import { persistAudit } from "./audit-ai-painter-stage4-split-release.mjs";

export function replayConclusion(current, old, requiredOldCodes) {
  const oldCodes = new Set(old.issues.map((issue) => issue.code));
  return {
    currentRgbProxyPassed: current.passed === true && current.skippedRecordCount === 0,
    historicalRejectionStillDetected: old.passed === false && old.skippedRecordCount === 0
      && requiredOldCodes.every((code) => oldCodes.has(code)),
    semanticUniquenessQualified: false,
    trainingAllowed: false,
    reason: "RGB proxy replay cannot waive missing semantic history or turn a same-condition retry into new capacity",
  };
}

export async function reviewReplacements({ root, evidenceBinding, baselineBinding, progress = () => {} }) {
  if (path.resolve(root) !== process.cwd()) throw new Error("legacy comparator requires the explicit current project root");
  const reader = createReader(root);
  const previous = reader.bound(evidenceBinding);
  if (previous.schemaVersion !== "ai-painter-stage4-split-risk-audit-v1") throw new Error("wrong source audit schema");
  const baseline = reader.bound(baselineBinding);
  if (baseline.schemaVersion !== "ai-painter-stage4-composition-replacement-replay-v1"
    || baseline.reviewerCoverageFinding?.status !== "existing_decision_defect_reproduced_not_fixed") {
    throw new Error("an immutable pre-fix reproduction report is required");
  }
  for (const receipt of previous.inputReceipts) reader.bytes(receipt.path, receipt.sha256);
  const candidates = previous.semanticAudit.historicalMatches.filter((item) =>
    item.context.interpretation === "historical_composition_rejection_requires_fresh_novelty_evidence");
  if (candidates.length !== 3 || new Set(candidates.map((r) => r.sampleId)).size !== 3) {
    throw new Error("this bounded replay requires exactly the three distinct audited replacement records");
  }
  const libraryPath = "data/world-samples/original-image-library/natural-home-v1/index.json";
  const library = reader.json(libraryPath);
  const byId = new Map(library.records.map((record) => [record.recordId, record]));
  const ownerReviewCoverage = { read: 0, absentReference: 0, missingFile: [] };
  // The legacy comparator reads historical review metadata as well as images.
  // Snapshot those inputs too, so the replay is not justified by image hashes alone.
  for (const record of library.records.filter((r) => r.categoryId === "complete-maps")) {
    const logical = record.reviews?.ownerReviewPath;
    if (!logical) { ownerReviewCoverage.absentReference++; continue; }
    try {
      const review = reader.json(logical);
      if (review.recordId !== record.recordId || review.imageSha256 !== record.originalImage.sha256) {
        throw new Error(`historical review/image identity conflict: ${record.recordId}`);
      }
      ownerReviewCoverage.read++;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      ownerReviewCoverage.missingFile.push({ recordId: record.recordId, path: logical });
    }
  }
  const results = [];
  for (const candidate of candidates) {
    const currentRecord = reader.json(byId.get(candidate.sampleId).recordPath);
    const historicalRecord = reader.json(byId.get(candidate.historicalRecordId).recordPath);
    const currentReview = reader.json(currentRecord.reviews.machineReviewPath);
    const historicalReview = reader.json(historicalRecord.reviews.machineReviewPath);
    for (const [record, review] of [[currentRecord, currentReview], [historicalRecord, historicalReview]]) {
      if (review.recordId !== record.recordId || review.imageSha256 !== record.originalImage.sha256) {
        throw new Error(`machine review/image identity conflict: ${record.recordId}`);
      }
    }
    const imagePath = (record) => explicitFile(root, `${record.relativeDirectory}/${record.originalImage.path}`);
    progress(`replay_current_${currentRecord.recordId}`);
    const chronologyReplay = await auditAiAssistedCompositionNovelty({ record: currentRecord,
      imagePath: imagePath(currentRecord) });
    // An ID-only audit query explicitly removes the creation-time cutoff for a
    // second comparison against today's complete corpus. No record is relabelled.
    const currentCorpusReplay = await auditAiAssistedCompositionNovelty({ record: { recordId: currentRecord.recordId },
      imagePath: imagePath(currentRecord) });
    progress(`replay_rejected_${historicalRecord.recordId}`);
    const negativeControl = await auditAiAssistedCompositionNovelty({ record: historicalRecord,
      imagePath: imagePath(historicalRecord) });
    const requiredOldCodes = historicalReview.issues.map((issue) => issue.code).filter((code) =>
      ["historical_rejected_composition_duplicate", "complete_map_composition_diversity_failed"].includes(code));
    if (!requiredOldCodes.length) throw new Error("source record does not carry a composition rejection");
    const oldThresholds = currentReview.compositionNoveltyAudit.thresholds;
    const baselineResult = baseline.results.find((item) => item.sampleId === currentRecord.recordId);
    if (!baselineResult || JSON.stringify(baselineResult.currentCorpusReplay.thresholds)
      !== JSON.stringify(currentCorpusReplay.thresholds)) throw new Error("pre-fix numeric thresholds changed");
    const thresholdComparisons = Object.entries(oldThresholds).map(([key, value]) => ({
      key, recorded: value, current: chronologyReplay.thresholds[key], unchanged: value === chronologyReplay.thresholds[key],
    }));
    if (thresholdComparisons.some((item) => !item.unchanged)) throw new Error("existing threshold changed; historical result is not directly comparable");
    results.push({ sampleId: currentRecord.recordId, historicalRecordId: historicalRecord.recordId,
      sourceContext: candidate.context,
      recordedReview: { path: currentRecord.reviews.machineReviewPath, status: currentReview.status,
        method: currentReview.compositionNoveltyAudit.method, compared: currentReview.compositionNoveltyAudit.historicalCompleteMapImagesCompared,
        imageSha256: currentReview.imageSha256 },
      thresholdComparisons,
      newlyPresentThresholdKeys: Object.keys(chronologyReplay.thresholds).filter((key) => !(key in oldThresholds)),
      preFixReplay: { method: baselineResult.currentCorpusReplay.method,
        passed: baselineResult.currentCorpusReplay.passed, allNumericThresholdsUnchanged: true },
      chronologyReplay, currentCorpusReplay, negativeControl,
      conclusion: replayConclusion(currentCorpusReplay, negativeControl, requiredOldCodes) });
  }
  const programs = ["scripts/review-ai-painter-stage4-composition-replacements.mjs",
    "scripts/lib/ai-assisted-composition-novelty.mjs", "scripts/lib/ai-painter-stage4-dataset-audit.mjs",
    "scripts/audit-ai-painter-stage4-split-release.mjs",
    "scripts/tests/test-ai-painter-stage4-composition-replacement-replay.mjs"];
  for (const logical of programs) reader.bytes(logical);
  const reviewerBefore = baseline.inputReceipts.find((entry) => entry.path === programs[1]);
  const reviewerAfter = reader.receipts().find((entry) => entry.path === programs[1]);
  if (!reviewerBefore || reviewerBefore.sha256 === reviewerAfter.sha256) throw new Error("post-fix reviewer identity was not changed");
  progress("verify_review_status_independent_gate_in_isolated_regression_fixtures");
  const regression = spawnSync(process.execPath, ["--test", programs.at(-1)], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000, maxBuffer: 128 * 1024,
  });
  if (regression.status !== 0 || regression.error) {
    throw new Error(`reviewer regression failed: ${regression.error?.message ?? regression.stderr}\n${regression.stdout}`);
  }
  reader.verifyStable();
  return { schemaVersion: "ai-painter-stage4-composition-replacement-replay-v1",
    status: "rgb_proxy_replay_completed_not_semantic_or_training_qualification",
    recordedAtUtc: new Date().toISOString(), sourceAudit: evidenceBinding, preFixReplay: baselineBinding,
    methodBoundary: "v7 removes review-label exemptions with v6 numeric thresholds unchanged; original chronology and all-current-corpus scopes remain separate",
    reviewerChange: { before: reviewerBefore, after: reviewerAfter },
    ownerReviewCoverage, results,
    reviewerCoverageFinding: {
      status: "review_status_exemption_fixed_and_regression_verified",
      code: "macro_composition_gate_ignores_machine_only_or_unlabelled_history",
      sourcePath: "scripts/lib/ai-assisted-composition-novelty.mjs",
      description: "All eligible historical images gate composition independently of Owner/machine labels. Machine-only, pending and unlabelled duplicate fixtures are rejected; a distinct image remains accepted.",
      regressionTestPath: programs.at(-1), exitCode: regression.status,
      stdout: regression.stdout, stderr: regression.stderr,
      syntheticFixturesOnly: true, sourceDatasetModified: false,
      fullSemanticTopologyAndTransformCoverageProven: false,
    },
    summary: { candidates: results.length,
      currentRgbProxyPassed: results.filter((r) => r.conclusion.currentRgbProxyPassed).length,
      historicalRejectionsStillDetected: results.filter((r) => r.conclusion.historicalRejectionStillDetected).length },
    qualification: { trainingAllowed: false, semanticUniquenessQualified: false, capabilityReleased: false },
    gpuStarted: false, trainingStarted: false, sourceDataModified: false, reviewerImplementationModified: true,
    reviewerModifiedDuringReplay: false,
    currentRegistryModified: false, inputReceipts: reader.receipts() };
}

async function main() {
  const { values } = parseArgs({ options: { evidence: { type: "string" }, sha256: { type: "string" },
    baseline: { type: "string" }, "baseline-sha256": { type: "string" },
    write: { type: "boolean", default: false } } });
  if (!values.evidence || !/^[a-f0-9]{64}$/.test(values.sha256 ?? "")) throw new Error("--evidence and --sha256 required");
  if (!values.baseline || !/^[a-f0-9]{64}$/.test(values["baseline-sha256"] ?? "")) throw new Error("--baseline and --baseline-sha256 required");
  const report = await reviewReplacements({ root: process.cwd(),
    evidenceBinding: { path: values.evidence, sha256: values.sha256 },
    baselineBinding: { path: values.baseline, sha256: values["baseline-sha256"] },
    progress: (phase) => process.stderr.write(`${new Date().toISOString()} ${phase}\n`) });
  const evidence = values.write ? persistAudit(process.cwd(), report) : null;
  console.log(JSON.stringify({ status: report.status, summary: report.summary, evidence,
    ownerReviewCoverage: report.ownerReviewCoverage,
    results: report.results.map((r) => ({ sampleId: r.sampleId, conclusion: r.conclusion,
      currentIssues: r.currentCorpusReplay.issues, oldIssues: r.negativeControl.issues,
      currentCompared: r.currentCorpusReplay.historicalCompleteMapImagesCompared,
      recordedCompared: r.recordedReview.compared, thresholdsUnchanged: r.thresholdComparisons.every((t) => t.unchanged) })) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

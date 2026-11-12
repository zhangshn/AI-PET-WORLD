import { arrayObjects, object, text, number, strings, type JsonObject } from "@/server/ai-painter-training-progress-projection";
import type { StrictValidationBatch, StrictValidationTokenAccounting } from "@/server/ai-painter-current-training-types";

type ValidationHistoryReader = {
  listDirectories: (relativePath: string) => Promise<Array<{ name: string; isDirectory(): boolean }>>;
  readJson: (relativePath: string) => Promise<JsonObject | null>;
  sha256: (relativePath: string) => Promise<string | null>;
};

const strictValidationRootPath =
  ".runtime/ai-painter/v7-repair-r1-strict-revalidations";

// Historical protocol projection only; the caller owns path validation and IO.
export function createValidationHistoryReader({ listDirectories, readJson, sha256 }: ValidationHistoryReader) {
  async function readStrictValidationBatches(): Promise<StrictValidationBatch[]> {
    try {
      const entries = await listDirectories(strictValidationRootPath);
      const batches = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const reportPath = `${strictValidationRootPath}/${entry.name}/validation-report.json`;
            const report = await readJson(reportPath);
            if (!report) return null;
            const trajectories = await Promise.all(
              arrayObjects(report.trajectories).map(async (trajectory) => {
                const machineReviewPath = text(trajectory.machineReviewPath);
                const review = machineReviewPath
                  ? await readJson(machineReviewPath)
                  : null;
                const token = object(trajectory.validationTokenAccounting);
                const runTotals = object(token?.runTotals);
                return {
                  recordId: text(trajectory.recordId) ?? "unknown-record",
                  conditionLabel:
                    text(trajectory.conditionLabel) ?? "unknown-condition",
                  split: text(trajectory.split) ?? "unknown",
                  seedIndex: number(trajectory.seedIndex) ?? 0,
                  seed: number(trajectory.seed) ?? 0,
                  status: text(trajectory.status) ?? "unknown",
                  durationMs: number(trajectory.durationMs) ?? 0,
                  runId: text(trajectory.runId) ?? "unknown-run",
                  manifestPath: text(trajectory.manifestPath),
                  outputImagePath: text(trajectory.outputImagePath),
                  outputImageSha256: text(trajectory.outputImageSha256),
                  machineReviewPath,
                  machineReviewSha256: text(trajectory.machineReviewSha256),
                  machineReviewIssueCodes: strings(
                    trajectory.machineReviewIssueCodes,
                  ),
                  reviewedAtUtc: text(review?.createdAtUtc),
                  reviewedAtAsiaShanghai: text(review?.createdAtAsiaShanghai),
                  gates: arrayObjects(review?.gates).map((gate) => ({
                    gate: text(gate.gate) ?? "unknown-gate",
                    passed: gate.passed === true,
                    issueCodes: strings(gate.issueCodes),
                  })),
                  issues: arrayObjects(review?.issues).map((issue) => ({
                    code: text(issue.code) ?? "unknown_issue",
                    message: text(issue.message),
                    messageZh: text(issue.messageZh),
                    affectedRegion: text(issue.affectedRegion),
                    nextTrainingTarget:
                      text(issue.nextFixTarget) ?? text(issue.nextTrainingTarget),
                  })),
                  validationTokenAccounting:
                    normalizeStrictValidationTokenAccounting(token, runTotals),
                };
              }),
            );
            return {
              batchId: text(report.batchId) ?? entry.name,
              status: text(report.status) ?? "unknown",
              createdAtUtc: text(report.createdAtUtc),
              createdAtAsiaShanghai: text(report.createdAtAsiaShanghai),
              completedAtUtc: text(report.completedAtUtc),
              completedAtAsiaShanghai: text(report.completedAtAsiaShanghai),
              reportPath,
              reportSha256: await sha256(reportPath),
              checkpointSha256: text(report.checkpointSha256),
              plannedTrajectoryCount: number(report.plannedTrajectoryCount) ?? 0,
              completedTrajectoryCount:
                number(report.completedTrajectoryCount) ?? 0,
              machinePassedCount: number(report.machinePassedCount) ?? 0,
              machineRejectedCount: number(report.machineRejectedCount) ?? 0,
              duplicateOutputHashes: strings(report.duplicateOutputHashes),
              issueCodes: strings(report.issueCodes),
              trainingWeightsModified: report.trainingWeightsModified === true,
              automaticRetryCount: number(report.automaticRetryCount) ?? 0,
              formalInferenceEligible: report.formalInferenceEligible === true,
              runtimeFrameEligible: report.runtimeFrameEligible === true,
              canEnterWorld: report.canEnterWorld === true,
              validationTokenAccounting: normalizeStrictValidationTokenAccounting(
                object(report.validationTokenAccounting),
                object(report.validationTokenAccounting),
              ),
              trajectories,
            } satisfies StrictValidationBatch;
          }),
      );
      return batches
        .filter((batch): batch is StrictValidationBatch => Boolean(batch))
        .sort(
          (left, right) =>
            Date.parse(right.createdAtUtc ?? "") -
            Date.parse(left.createdAtUtc ?? ""),
        );
    } catch {
      return [];
    }
  }
  return readStrictValidationBatches;
}

function normalizeStrictValidationTokenAccounting(
  rootValue: JsonObject | null,
  totalsValue: JsonObject | null,
): StrictValidationTokenAccounting {
  const root = rootValue ?? {};
  const totals = totalsValue ?? {};
  return {
    schemaVersion: text(root.schemaVersion),
    denoiserSampleForwardPasses:
      number(totals.denoiserSampleForwardPasses) ?? 0,
    latentSpatialTokens: number(totals.latentSpatialTokens) ?? 0,
    latentChannelValues: number(totals.latentChannelValues) ?? 0,
    conditionScalarValues: number(totals.conditionScalarValues) ?? 0,
    decodedRgbFrames: number(totals.decodedRgbFrames) ?? 0,
    decodedRgbPixelPredictions: number(totals.decodedRgbPixelPredictions) ?? 0,
    externalApiTokens:
      number(root.externalApiTokens) ??
      number(object(root.externalApi)?.totalTokens) ??
      0,
  };
}

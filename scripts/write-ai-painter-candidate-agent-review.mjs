import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const latestPath = path.join(root, ".runtime/world-visual-dictionary-trials/latest.json");

function resolveProjectPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(resolveProjectPath(filePath), "utf8"));
}

async function writeJson(filePath, value) {
  const absolutePath = resolveProjectPath(filePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function unique(values) {
  return Array.from(new Set(values)).filter(Boolean);
}

const latest = await readJson(latestPath);
const recordPath = resolveProjectPath(latest.latestRecordPath);
const record = await readJson(recordPath);

if (!["ai-painter-vj2-best-candidate", "ai-painter-vj2-failed-candidate"].includes(record.source)) {
  throw new Error(`latest trial is not an AI Painter candidate: ${record.source}`);
}

const isFailedCandidate = record.source === "ai-painter-vj2-failed-candidate";
const agentFindings = isFailedCandidate
  ? [
      {
        code: "failed_training_candidate",
        severity: "hard_for_world_promotion",
        message: "Candidate failed automatic training/VJ review and must be kept only as failure history.",
        target: "review/automatic-storage.md",
      },
      {
        code: "partial_candidate_not_full_world",
        severity: "hard_for_world_promotion",
        message: "Candidate is not a complete 1024x768 first playable world map.",
        target: "versions/mvp-natural-home.md",
      },
    ]
  : [
      {
        code: "partial_candidate_not_full_world",
        severity: "hard_for_world_promotion",
        message: "Candidate has useful local visual quality, but it is not a complete 1024x768 first playable world map.",
        target: "versions/mvp-natural-home.md",
      },
      {
        code: "machine_pass_owner_review_required",
        severity: "medium",
        message: "Candidate should remain pending owner review before any positive training promotion.",
        target: "review/acceptance.md",
      },
    ];

const updatedRecord = {
  ...record,
  agentReview: {
    reviewer: "codex-agent",
    reviewedAt: new Date().toISOString(),
    status: isFailedCandidate ? "failed_training_candidate" : "partial_pass_not_world_ready",
    summary: isFailedCandidate
      ? "Failed training candidate. Stored for failure review and negative history only."
      : "Useful local game-art candidate, but not a complete first-version world map.",
    findings: agentFindings,
  },
  agentStatus: isFailedCandidate ? "failed_training_candidate" : "partial_pass_not_world_ready",
  ownerStatus: "pending",
  canPromoteToWorld: false,
  trainingEligibility: isFailedCandidate ? "negative_failure_candidate" : "positive_local_material_candidate_pending_owner",
  failureCodes: unique([...(record.failureCodes ?? []), ...agentFindings.map((finding) => finding.code)]),
  positiveLabels: isFailedCandidate
    ? unique(record.positiveLabels ?? [])
    : unique([...(record.positiveLabels ?? []), "positive_local_material_candidate"]),
  negativeLabels: isFailedCandidate
    ? unique([...(record.negativeLabels ?? []), "failed_training_candidate"])
    : unique(record.negativeLabels ?? []),
  nextFixTargets: unique([
    ...(record.nextFixTargets ?? []),
    ...agentFindings.map((finding) => finding.target),
    "composition/map-readability.md",
    "composition/professional-quality.md",
  ]).sort(),
};

await writeJson(recordPath, updatedRecord);
await writeJson(latestPath, {
  ...latest,
  agentStatus: updatedRecord.agentStatus,
  ownerStatus: updatedRecord.ownerStatus,
  trainingEligibility: updatedRecord.trainingEligibility,
  failureCodes: updatedRecord.failureCodes,
  positiveLabels: updatedRecord.positiveLabels,
  updatedAt: updatedRecord.agentReview.reviewedAt,
});

console.log(`AI Painter candidate agent review written: ${latest.latestRecordPath}`);
console.log(`agentStatus=${updatedRecord.agentStatus}`);
console.log(`trainingEligibility=${updatedRecord.trainingEligibility}`);
console.log(`failureCodes=${updatedRecord.failureCodes.join(",")}`);

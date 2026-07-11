import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const defaultReportPath = ".runtime/ai-painter/natural-home-v119-v118-complete-world-formal-vj2-review/latest.json";
const reportPath = process.argv[2] ?? defaultReportPath;
const dictionaryLatestPath = path.join(root, "data/world-visual-data-dictionary/latest.json");
const outputRoot = path.join(root, ".runtime/world-visual-dictionary-trials");

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

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

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(resolveProjectPath(filePath))).digest("hex");
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

async function imageMetrics(imagePath) {
  const image = sharp(resolveProjectPath(imagePath)).removeAlpha();
  const metadata = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const luminance = [];
  const colors = new Set();
  let green = 0;
  let blue = 0;
  let brown = 0;
  let sampled = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luminance.push(value);
      if (x % 2 === 0 && y % 2 === 0) colors.add(`${r >> 3},${g >> 3},${b >> 3}`);
      if (g > r * 1.12 && g > b * 1.05) green += 1;
      if (b > r * 1.05 && b > g * 0.9) blue += 1;
      if (r > 85 && g > 55 && b < 130 && Math.abs(r - g) < 95) brown += 1;
      sampled += 1;
    }
  }

  const mean = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  const variance = luminance.reduce((sum, value) => sum + (value - mean) ** 2, 0) / luminance.length;
  return {
    width: metadata.width ?? width,
    height: metadata.height ?? height,
    luminanceMean: round(mean),
    luminanceStdDev: round(Math.sqrt(variance)),
    uniqueColorRatio: round(colors.size / Math.max(1, Math.ceil(width / 2) * Math.ceil(height / 2))),
    greenDominantRatio: round(green / Math.max(1, sampled)),
    blueDominantRatio: round(blue / Math.max(1, sampled)),
    brownPathLikeRatio: round(brown / Math.max(1, sampled)),
  };
}

const report = await readJson(reportPath);
const passedCandidate = report.bestCandidate?.generated ? report.bestCandidate : null;
const failureCandidate = passedCandidate
  ? null
  : [...(report.rows ?? [])]
      .filter((row) => row?.generated)
      .sort((left, right) => {
        const leftScore = left.sourceTrainingQualityScore ?? left.formalVisualScore ?? left.score ?? 0;
        const rightScore = right.sourceTrainingQualityScore ?? right.formalVisualScore ?? right.score ?? 0;
        return rightScore - leftScore;
      })[0];

if (!passedCandidate && !failureCandidate?.generated) {
  throw new Error("VJ2 report does not include a generated candidate row");
}

const dictionaryLatest = await readJson(dictionaryLatestPath);
const dictionary = await readJson(dictionaryLatest.dictionaryPath);
const selectedCandidate = passedCandidate ?? failureCandidate;
const selectedCandidatePassed = Boolean(passedCandidate);
const sourceImagePath = selectedCandidate.generated;
const metrics = await imageMetrics(sourceImagePath);
const imageHash = await sha256File(sourceImagePath);
const safeTimestamp = new Date().toISOString().replaceAll(":", "-");
const stageId = report.stageId ?? "unknown-stage";
const sampleId = selectedCandidate.sampleId ?? "unknown-sample";
const trialId = `ai-painter-dictionary-trial-${stageId}-${safeTimestamp}`;
const trialRoot = path.join(outputRoot, trialId);
const storedImagePath = path.join(trialRoot, "candidate.png");
const reviewRecordPath = path.join(trialRoot, "review-record.json");

await mkdir(trialRoot, { recursive: true });
await copyFile(resolveProjectPath(sourceImagePath), storedImagePath);

const reportFailureCodes = Object.keys(report.summary?.failureReasonCounts ?? {});
const failureCodes = selectedCandidatePassed
  ? ["machine_pass_owner_review_required"]
  : ["vj2_report_no_best_candidate", ...reportFailureCodes];
const machineFindings = selectedCandidatePassed
  ? [
      {
        code: "machine_pass_owner_review_required",
        severity: "medium",
        message: "VJ2 selected this candidate, but dictionary/owner review is still required before promotion.",
        target: "review/acceptance.md",
      },
    ]
  : [
      {
        code: "vj2_report_no_best_candidate",
        severity: "hard_for_world_promotion",
        message: "This VJ2 report has no passing bestCandidate. The stored image is the highest-scored failed row for failure review only.",
        target: "review/automatic-storage.md",
      },
      ...reportFailureCodes.map((code) => ({
        code,
        severity: "high",
        message: `VJ2 failure reason from source report: ${code}`,
        target: "review/acceptance.md",
      })),
    ];

const reviewRecord = {
  schemaVersion: "world-visual-dictionary-trial-review-v1",
  recordId: trialId,
  createdAt: new Date().toISOString(),
  source: selectedCandidatePassed ? "ai-painter-vj2-best-candidate" : "ai-painter-vj2-failed-candidate",
  dictionaryVersionId: dictionary.dictionaryVersionId,
  dictionaryPath: dictionaryLatest.dictionaryPath,
  sourceReportPath: projectPath(resolveProjectPath(reportPath)),
  sourceStageId: report.stageId,
  sampleId,
  sourceImagePath: projectPath(resolveProjectPath(sourceImagePath)),
  storedImagePath: projectPath(storedImagePath),
  imageHash,
  imageMetrics: metrics,
  sourceScores: {
    score: selectedCandidate.score,
    formalVisualScore: selectedCandidate.formalVisualScore,
    sourceTrainingQualityScore: selectedCandidate.sourceTrainingQualityScore,
    vj1Status: selectedCandidate.vj1Status,
    vj2Status: selectedCandidate.vj2Status,
  },
  machineStatus: selectedCandidatePassed ? "pending_owner_review" : "failed_training_candidate",
  agentStatus: "pending",
  ownerStatus: "pending",
  canPromoteToWorld: false,
  trainingEligibility: selectedCandidatePassed ? "pending_owner_review" : "negative_failure_candidate",
  failureCodes,
  positiveLabels: [],
  negativeLabels: selectedCandidatePassed ? [] : ["failed_training_candidate"],
  machineFindings,
  nextFixTargets: selectedCandidatePassed
    ? ["review/acceptance.md", "composition/professional-quality.md"]
    : ["review/automatic-storage.md", "composition/professional-quality.md", "versions/mvp-natural-home.md"],
  notes: selectedCandidatePassed
    ? [
        "This is the best VJ2 candidate from the selected AI Painter report.",
        "It is stored for dictionary-based review and comparison, not approved display.",
      ]
    : [
        "This VJ2 report has no passing bestCandidate.",
        "The stored image is the highest-scored failed row and is kept as negative training/review history.",
      ],
};

await writeJson(reviewRecordPath, reviewRecord);
await writeJson(path.join(outputRoot, "latest.json"), {
  schemaVersion: "world-visual-dictionary-trial-latest-pointer-v1",
  latestRecordId: trialId,
  latestRecordPath: projectPath(reviewRecordPath),
  latestImagePath: projectPath(storedImagePath),
  dictionaryVersionId: dictionary.dictionaryVersionId,
  machineStatus: reviewRecord.machineStatus,
  agentStatus: reviewRecord.agentStatus,
  ownerStatus: reviewRecord.ownerStatus,
  trainingEligibility: reviewRecord.trainingEligibility,
  failureCodes: reviewRecord.failureCodes,
  createdAt: reviewRecord.createdAt,
});

console.log(`AI Painter candidate dictionary trial written: ${projectPath(reviewRecordPath)}`);
console.log(`image=${projectPath(storedImagePath)}`);
console.log(`sampleId=${sampleId}`);
console.log(`score=${reviewRecord.sourceScores.score}`);
console.log(`machineStatus=${reviewRecord.machineStatus}`);

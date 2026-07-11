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

const agentFindings = [
  {
    code: "not_game_ready",
    severity: "hard",
    message: "Frame does not meet first playable professional game-map quality.",
    target: "composition/professional-quality.md",
  },
  {
    code: "professional_read_fail",
    severity: "hard",
    message: "The image contains map elements, but the whole frame does not read as a polished playable map.",
    target: "composition/map-readability.md",
  },
  {
    code: "dirt_path_color_band",
    severity: "hard",
    message: "The road reads as a flat pasted band rather than integrated dirt terrain.",
    target: "terrain/dirt-path.md",
  },
  {
    code: "shoreline_pasted_wall",
    severity: "hard",
    message: "The water edge reads as a vertical pasted wall/strip instead of a coherent shoreline.",
    target: "terrain/shoreline.md",
  },
  {
    code: "object_sticker_asset",
    severity: "hard",
    message: "Several objects look pasted on top of the terrain instead of belonging to the same world.",
    target: "visual-style/object-grounding.md",
  },
  {
    code: "camera_perspective_mismatch",
    severity: "hard",
    message: "Ground, water edge and object assets do not share one stable camera language.",
    target: "visual-style/camera.md",
  },
  {
    code: "style_palette_mismatch",
    severity: "medium",
    message: "Terrain, path, water and object palettes do not feel like one art direction.",
    target: "visual-style/color.md",
  },
  {
    code: "machine_pass_agent_fail",
    severity: "hard",
    message: "The runtime/machine path allowed review to proceed, but professional agent review rejects the frame.",
    target: "review/acceptance.md",
  },
];

const nextFixTargets = unique([
  ...(record.nextFixTargets ?? []),
  ...agentFindings.map((finding) => finding.target),
]).sort();

const updatedRecord = {
  ...record,
  agentReview: {
    reviewer: "codex-agent",
    reviewedAt: new Date().toISOString(),
    status: "fail",
    summary: "Rejected as a first playable professional world map. Store as negative candidate and use for repair targets.",
    findings: agentFindings,
  },
  machineStatus: record.machineStatus,
  agentStatus: "fail",
  ownerStatus: "pending",
  canPromoteToWorld: false,
  trainingEligibility: "negative_candidate_pending_owner",
  failureCodes: unique([...(record.failureCodes ?? []), ...agentFindings.map((finding) => finding.code)]),
  negativeLabels: unique([
    ...(record.negativeLabels ?? []),
    "negative_agent_rejected",
    "negative_machine_pass_agent_fail",
  ]),
  nextFixTargets,
};

await writeJson(recordPath, updatedRecord);
await writeJson(latestPath, {
  ...latest,
  machineStatus: updatedRecord.machineStatus,
  agentStatus: updatedRecord.agentStatus,
  ownerStatus: updatedRecord.ownerStatus,
  trainingEligibility: updatedRecord.trainingEligibility,
  failureCodes: updatedRecord.failureCodes,
  negativeLabels: updatedRecord.negativeLabels,
  updatedAt: updatedRecord.agentReview.reviewedAt,
});

console.log(`World visual dictionary agent review written: ${latest.latestRecordPath}`);
console.log(`agentStatus=${updatedRecord.agentStatus}`);
console.log(`trainingEligibility=${updatedRecord.trainingEligibility}`);
console.log(`failureCodes=${updatedRecord.failureCodes.join(",")}`);

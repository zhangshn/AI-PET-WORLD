import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const latestDictionaryPath = path.join(root, "data/world-visual-data-dictionary/latest.json");
const outputRoot = path.join(root, "data/world-visual-data-dictionary/drawability");
const outputPath = path.join(outputRoot, "natural-home-complete-map-v0.3.json");
const latestPath = path.join(outputRoot, "latest.json");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

const latestDictionary = await readJson(latestDictionaryPath);
const dictionary = await readJson(path.join(root, latestDictionary.dictionaryPath));
const entryIds = new Set(dictionary.entries.map((entry) => entry.id));

const requiredEntryIds = [
  "generation-task/complete-map-image-generation-contract",
  "map-grammar/natural-home-complete-map-template",
  "spatial-grid/complete-map-canvas-contract",
  "render-layer-recipe/complete-map-layer-stack-v2",
  "material-recipe/complete-map-material-token-library",
  "objects/complete-map-object-placement-library",
  "transition/grass-to-path",
  "transition/grass-to-water",
  "transition/object-to-ground",
  "review/complete-map-drawability-gate",
  "training/complete-map-drawability-readiness",
];

const missingEntryIds = requiredEntryIds.filter((id) => !entryIds.has(id));
const generatedAt = new Date().toISOString();
const summary = {
  schemaVersion: "complete-map-drawability-dictionary-summary-v1",
  summaryId: "natural-home-complete-map-v0.3-drawability",
  generatedAt,
  timestampLocal:
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(new Date())
      .replace(" ", "T") + "+08:00",
  dictionaryVersionId: dictionary.dictionaryVersionId,
  dictionaryPath: latestDictionary.dictionaryPath,
  status: missingEntryIds.length === 0 ? "dictionary_draw_ready" : "blocked_missing_drawability_entries",
  drawabilityMeaning:
    "The dictionary contains the minimum structured fields to build a complete-map candidate generation task. This is not training-data sufficiency and not owner approval.",
  requiredEntryIds,
  missingEntryIds,
  taskBindings: {
    canvasContract: "spatial-grid/complete-map-canvas-contract",
    mapTemplate: "map-grammar/natural-home-complete-map-template",
    layerStack: "render-layer-recipe/complete-map-layer-stack-v2",
    materialTokens: "material-recipe/complete-map-material-token-library",
    objectPlacement: "objects/complete-map-object-placement-library",
    transitionPlan: [
      "transition/grass-to-path",
      "transition/grass-to-water",
      "transition/object-to-ground",
    ],
    generationContract: "generation-task/complete-map-image-generation-contract",
    reviewGate: "review/complete-map-drawability-gate",
  },
  nonApprovalRules: [
    "dictionary_draw_ready does not mean training_data_ready",
    "dictionary_draw_ready does not mean owner_approved",
    "dictionary_draw_ready only allows a stored candidate generation attempt",
  ],
};

await mkdir(outputRoot, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await writeFile(
  latestPath,
  `${JSON.stringify(
    {
      schemaVersion: "complete-map-drawability-dictionary-summary-latest-pointer-v1",
      summaryId: summary.summaryId,
      status: summary.status,
      generatedAt,
      dictionaryVersionId: summary.dictionaryVersionId,
      summaryPath: projectPath(outputPath),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Complete map drawability dictionary summary written: ${projectPath(outputPath)}`);
console.log(`status=${summary.status}`);

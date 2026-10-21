import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import sharp from "sharp"
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
export const COUNTS = { train: 48, validation: 8, challenge: 4, regression: 4 }

export async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-intake-v2-"))
  t.after(() => {
    assert(path.basename(root).startsWith("source-intake-v2-"))
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()))
    fs.rmSync(root, { recursive: true, force: true })
  })
  const put = (logical, value) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + "\n")
    fs.mkdirSync(path.dirname(path.join(root, logical)), { recursive: true })
    fs.writeFileSync(path.join(root, logical), bytes)
    return { path: logical, sha256: sha(bytes) }
  }
  const contractPath = "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json"
  const contract = JSON.parse(fs.readFileSync(path.join(REPO, contractPath)))
  put(contractPath, fs.readFileSync(path.join(REPO, contractPath)))
  const policy = put("docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
    fs.readFileSync(path.join(REPO, "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md")))
  const gray = await sharp(Buffer.alloc(1024 * 768, 255), { raw: { width: 1024, height: 768, channels: 1 } }).toColourspace("b-w").png().toBuffer()
  const rgb = await sharp({ create: { width: 1024, height: 768, channels: 3, background: { r: 90, g: 100, b: 70 } } }).png().toBuffer()
  const old = await sharp({ create: { width: 1024, height: 768, channels: 3, background: { r: 40, g: 60, b: 20 } } }).png().toBuffer()
  const plane = put("data/plane.png", gray), guide = put("data/guide.png", gray)
  const image = put("data/candidate.png", rgb), raw = put("data/raw.png", rgb), parentRgb = put("data/old.png", old)
  const facts = put("data/facts.json", { worldId: "world-0" })
  const table = [{ value: 1, objectId: "rock-1", kind: "rock", footprint: { x: 10, y: 10, width: 12, height: 12 }, blocksMovement: true }]
  const task = put("data/task.json", { taskId: "task-0", worldId: "world-0", tick: 0,
    sourceBindings: { naturalizedWorldFactsPath: facts.path, naturalizedWorldFactsSha256: facts.sha256 },
    spatialLayers: { objectFootprints: table } })
  const pack = put("data/pack.json", { worldId: "world-0", tick: 0, taskId: "task-0",
    conditionPackSha256: "a".repeat(64), sourceBindings: { taskPackagePath: task.path }, objectInstanceTable: table,
    channels: contract.tensorContract.channelOrder.map(id => ({ id, ...plane })) })
  const guideManifest = put("data/guide-manifest.json", { conditionPackPath: pack.path,
    conditionPackSha256: "a".repeat(64), guidePath: guide.path, guideSha256: guide.sha256 })
  const snapshotPath = "data/world-samples/original-image-library/natural-home-v1/snapshot.json"
  put(snapshotPath, { snapshotId: "snapshot-v1", worldProfileId: "profile-v1", biomeType: "bamboo-grove", isFinal: false })
  const worldBinding = { snapshotPath, snapshotId: "snapshot-v1", worldProfileId: "profile-v1", biomeType: "bamboo-grove", snapshotIsFinal: false }
  const classification = { mapScope: "complete-map" }
  const parentRecord = put("data/parent-record.json", { recordId: "train-0", worldBinding, classification })
  const rows = Object.entries(COUNTS).flatMap(([split, count]) => Array.from({ length: count }, (_, i) => ({
    sampleId: `${split}-${i}`, split, capacitySlotId: `${split}-slot-${i}`,
    image: split === "train" && i === 0 ? parentRgb : { path: `data/unread-${split}-${i}.png`, sha256: sha(Buffer.from(`${split}-${i}`)) },
    sourceRecord: parentRecord, conditionPack: pack,
    grouping: { worldId: split === "train" && i === 0 ? "world-0" : `${split}-world-${i}` },
    contribution: { path: "data/old-contribution.json", sha256: "c".repeat(64) }
  })))
  const sourceIndex = put("data/source-index.json", { sampleCount: 64, samples: rows })
  const splits = Object.fromEntries(Object.keys(COUNTS).map(split => [split, put(`data/splits/${split}.json`, {
    split, sampleIds: rows.filter(r => r.split === split).map(r => r.sampleId) })]))
  const parentDataset = put("data/parent-manifest.json", { schemaVersion: "ai-painter-stage4-v2-mvp64-denoiser-dataset-release-v1",
    packageId: "parent64", sampleCount: 64, sourceIndex, splits, splitCounts: COUNTS })
  const prompt = { sourceSampleId: "train-0", split: "train", spatialReference: guide, toolReferenceImages: [guide.path],
    validationImagesUsed: false, validationGeometryUsed: false, prompt: "Only same-world guide; original approved facts unchanged." }
  const promptBinding = put("data/prompt.json", prompt)
  const normalization = put("data/normalization.json", { raw, normalized: image, sourceCrop: null,
    resampling: { crop: false, kernel: "nearest", fit: "fill_exact_four_three_no_crop" } })
  const request = { schemaVersion: "original-image-intake-request-v2", recordId: "source-corrected-a", categoryId: "complete-maps",
    title: "Source correction candidate", imagePath: image.path, classification, worldBinding,
    conditionBinding: { conditionPackPath: pack.path, worldId: "world-0", tick: 0, taskId: "task-0" },
    source: { sourceType: "openai_generated", creationMethod: "built_in_image_generation", rightsHolder: "project-source-license-review-pending",
      thirdPartyContentUsed: false, thirdPartyGenerativeModelUsed: true, copiedFromExistingWork: false },
    aiAssistedColdStart: { policyVersion: "AI-PAINTER-DATA-PROVENANCE-1.8", trainingLane: "ai_assisted_cold_start",
      generatorProvider: "openai", generatorSystem: "built_in_image_generation" },
    sourceCorrection: { schemaVersion: "source-correction-intake-evidence-request-v1", sourcePolicy: policy,
      parentDataset, parentSampleId: "train-0", parentSourceRecord: parentRecord, conditionPack: pack,
      task, worldFacts: facts, guideManifest, guide, promptEvidence: promptBinding, image, rawSource: raw, normalization } }
  const library = "data/world-samples/original-image-library/natural-home-v1"
  fs.mkdirSync(path.join(root, library, "complete-maps"), { recursive: true })
  put(library + "/index.json", { schemaVersion: "original-image-library-index-v1", collectionId: "natural-home-v1", records: [] })
  put(library + "/library.json", { schemaVersion: "original-image-library-v1", collectionId: "natural-home-v1", recordCount: 0 })
  fs.mkdirSync(path.join(root, "data/world-samples/ai-assisted-cold-start-dataset-packages"), { recursive: true })
  return { root, put, request, prompt, rows, library, parentDataset, parentRecord, pack, image }
}

export function runIntake(f) {
  f.put("data/request.json", f.request)
  return spawnSync(process.execPath, [path.join(REPO, "scripts/intake-original-image.mjs"), "--request", "data/request.json"],
    { cwd: f.root, encoding: "utf8", timeout: 20000 })
}



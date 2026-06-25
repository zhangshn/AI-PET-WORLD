import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const manifestPath = path.join(root, "data", "visual-units", "manifest.json")

function fail(message) {
  console.error(`VisualUnit data check failed: ${message}`)
  process.exit(1)
}

function readJson(filePath) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch (error) {
    fail(`invalid JSON: ${path.relative(root, filePath)} (${error.message})`)
  }
}

const manifest = readJson(manifestPath)

if (manifest.schemaVersion !== "visual-unit-data-v0") {
  fail("manifest schemaVersion must be visual-unit-data-v0")
}

if (manifest.formalWorldDisplay !== false) {
  fail("manifest must not allow formal world display")
}

if (!Array.isArray(manifest.samples) || manifest.samples.length === 0) {
  fail("manifest.samples must contain at least one VisualUnit sample")
}

if (manifest.sampleCount !== manifest.samples.length) {
  fail("manifest.sampleCount must match samples.length")
}

let trainingReadyCount = 0

for (const sample of manifest.samples) {
  const sampleRoot = path.join(root, sample.sampleRoot)
  const metadata = readJson(path.join(sampleRoot, "metadata.json"))
  const state = readJson(path.join(sampleRoot, "state.json"))
  const lifecycle = readJson(path.join(sampleRoot, "lifecycle.json"))

  if (!existsSync(path.join(sampleRoot, "target"))) {
    fail(`${sample.sampleId} target directory is missing`)
  }

  if (!existsSync(path.join(sampleRoot, "mask"))) {
    fail(`${sample.sampleId} mask directory is missing`)
  }

  if (metadata.sampleId !== sample.sampleId || state.sampleId !== sample.sampleId || lifecycle.sampleId !== sample.sampleId) {
    fail(`${sample.sampleId} files are not bound to the same sampleId`)
  }

  if (metadata.canEnterWorld !== false || metadata.formalWorldDisplay !== false) {
    fail(`${sample.sampleId} must not enter the formal world before VisualJudge and ApprovedFrame`)
  }

  if (metadata.canTrain === true) {
    trainingReadyCount += 1
  }

  if (!Array.isArray(metadata.requiredMasks) || metadata.requiredMasks.length === 0) {
    fail(`${sample.sampleId} must declare requiredMasks`)
  }

  if (!Array.isArray(state.visualChannels) || state.visualChannels.length === 0) {
    fail(`${sample.sampleId} state.visualChannels must not be empty`)
  }

  if (!Array.isArray(lifecycle.supportedLifecycleStates) || !lifecycle.supportedLifecycleStates.includes(metadata.lifecycleState)) {
    fail(`${sample.sampleId} lifecycle must include metadata.lifecycleState`)
  }
}

if (manifest.trainingReadySampleCount !== trainingReadyCount) {
  fail("manifest.trainingReadySampleCount must match metadata.canTrain count")
}

console.log(
  `VisualUnit data check passed: ${manifest.samples.length} sample(s), ${trainingReadyCount} training-ready sample(s).`,
)

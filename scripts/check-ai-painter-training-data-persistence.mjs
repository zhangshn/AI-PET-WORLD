import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const failures = []
const warnings = []

const requiredFiles = [
  ".runtime/ai-painter/training-process-ledger/events.jsonl",
  ".runtime/ai-painter/training-process-ledger/latest.json",
  ".runtime/ai-painter/training-run-archive/latest.json",
]

for (const relativePath of requiredFiles) {
  check(fileExists(relativePath), `required file missing: ${relativePath}`)
  if (fileExists(relativePath)) {
    const size = fs.statSync(resolvePath(relativePath)).size
    check(size > 0, `required file is empty: ${relativePath}`)
  }
}

const manifest = readJson(".runtime/ai-painter/training-run-archive/latest.json")
const currentDictionary = readJson("data/world-visual-data-dictionary/latest.json")
const taskPointer = readJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
const visualFactPointer = readJson(".runtime/ai-painter/world-visual-fact-manifests/latest.json")
if (manifest) checkTrainingRunManifest(manifest, currentDictionary)
checkCurrentWorldTaskPersistence(taskPointer, visualFactPointer, currentDictionary)

check(directoryExists(".runtime/game-map-material-slot-inference-runs"), "material-slot inference run root missing")
check(
  countMatchingDirectories(".runtime/game-map-material-slot-inference-runs/world-d0znz8/0", /^material-slot-inference-/) >= 1,
  "no material-slot inference run directory found",
)
check(countMatchingDirectories(".runtime/ai-painter", /-training$/) >= 1, "no local training directory found under .runtime/ai-painter")

finish()

function checkTrainingRunManifest(manifest, currentDictionary) {
  check(manifest.schemaVersion === "ai-painter-training-run-archive-v1", "latest training archive schemaVersion invalid")
  checkString(manifest.runId, "latest training archive runId missing")
  checkString(manifest.action, "latest training archive action missing")
  checkString(manifest.status, "latest training archive status missing")
  checkString(manifest.startedAt, "latest training archive startedAt missing")
  checkString(manifest.finishedAt, "latest training archive finishedAt missing")

  check(Boolean(manifest.dictionaryContract), "dictionaryContract missing from latest training archive")
  check(manifest.dictionaryContract?.passed === true, "dictionaryContract must be recorded as passed")
  check(
    manifest.dictionaryContract?.dictionaryVersionId === currentDictionary?.dictionaryVersionId,
    `latest training archive dictionary must match current dictionary ${currentDictionary?.dictionaryVersionId ?? "missing"}`,
  )

  const materialQualityFailed =
    manifest.status === "archived_existing_failed_material_quality" &&
    manifest.quality?.materialPassed === false

  checkFile(manifest.referenceBaseline?.archivedImage, "archived reference baseline image missing")
  if (!materialQualityFailed) {
    checkFile(manifest.output?.archivedCompositeOutput, "archived composite output missing")
    checkFile(manifest.output?.archivedRuntimeFrameCandidate, "archived RuntimeFrame candidate missing")
  } else {
    check(manifest.output?.archivedCompositeOutput == null, "failed material archive must not reuse stale composite output")
    check(manifest.output?.archivedRuntimeFrameCandidate == null, "failed material archive must not reuse stale RuntimeFrame candidate")
  }
  checkDirectory(manifest.inference?.archivedMaterialDir, "archived material directory missing")
  checkFile(manifest.quality?.archivedMaterialQualityReport, "archived material quality report missing")
  if (!materialQualityFailed) {
    checkFile(manifest.quality?.archivedFormalVisualJudge, "archived formal visual judge report missing")
  } else {
    check(manifest.quality?.archivedFormalVisualJudge == null, "failed material archive must not reuse stale formal visual judge")
  }
  checkFile(manifest.visualDeltaReview?.archivedReport, "archived visual delta review missing")
  checkFile(manifest.model?.archivedModelManifest, "archived model manifest missing")

  checkFile(manifest.training?.archivedDatasetSummary, "archived dataset summary missing")
  for (const [category, data] of Object.entries(manifest.training?.categories ?? {})) {
    checkFile(data?.archivedSummary, `archived ${category} training summary missing`)
    checkFile(data?.trainingSummaryPath, `source ${category} training summary missing`)
  }

  checkFile(manifest.referenceBaseline?.sourcePath, "source reference baseline image missing")
  checkDirectory(manifest.inference?.materialDir, "source material inference directory missing")
  checkFile(manifest.quality?.materialQualityReportPath, "source material quality report missing")
  if (!materialQualityFailed) {
    checkFile(manifest.quality?.formalVisualJudgePath, "source formal visual judge report missing")
    checkFile(manifest.output?.compositeOutputPath, "source composite output missing")
    checkFile(manifest.output?.runtimeFrameCandidatePath, "source RuntimeFrame candidate missing")
  } else {
    check(manifest.quality?.formalVisualJudgePath == null, "failed material archive must not use stale source formal visual judge")
    check(manifest.output?.compositeOutputPath == null, "failed material archive must not use stale source composite output")
    check(manifest.output?.runtimeFrameCandidatePath == null, "failed material archive must not use stale source RuntimeFrame candidate")
  }
  checkFile(manifest.training?.datasetSummaryPath, "source dataset summary missing")

  if (materialQualityFailed) {
    check(
      Array.isArray(manifest.quality.failedSlots) && manifest.quality.failedSlots.length > 0,
      "failed material run must record failedSlots",
    )
  }
  if (!materialQualityFailed && manifest.quality?.formalVisualJudgePassed === false) {
    check(
      Array.isArray(manifest.quality.formalVisualJudgeIssues) &&
        manifest.quality.formalVisualJudgeIssues.length > 0,
      "failed formal visual judge run must record formalVisualJudgeIssues",
    )
  }

  check(manifest.manualReview?.required === true, "manualReview.required must be true")
  checkString(manifest.manualReview?.status, "manualReview.status missing")

  const materialCount = countFiles(manifest.inference?.archivedMaterialDir)
  check(materialCount >= 1, "archived material directory must contain files")

  if (!manifest.output?.archivedApprovedPack) {
    warnings.push("approved material pack is absent in latest archive; this is allowed only for failed material-quality runs")
  }
}

function checkCurrentWorldTaskPersistence(taskPointer, visualFactPointer, currentDictionary) {
  check(Boolean(currentDictionary?.dictionaryVersionId), "current dictionary pointer is missing")
  check(Boolean(taskPointer), "latest world visual task package pointer is missing")
  check(Boolean(visualFactPointer), "latest VisualFactManifest pointer is missing")
  if (!taskPointer || !visualFactPointer || !currentDictionary) return

  check(taskPointer.dictionaryVersionId === currentDictionary.dictionaryVersionId, "task package dictionary is not current")
  checkFile(taskPointer.taskPath, "latest world visual task package JSON missing")
  checkFile(taskPointer.directorPath, "latest world visual director output missing")
  checkFile(taskPointer.manifestPath, "latest world visual task manifest missing")
  checkFile(visualFactPointer.manifestPath, "latest VisualFactManifest JSON missing")
  check(visualFactPointer.passed === true, "latest VisualFactManifest did not pass")

  const task = readJson(taskPointer.taskPath)
  const director = readJson(taskPointer.directorPath)
  const visualFacts = readJson(visualFactPointer.manifestPath)
  check(task?.taskId === taskPointer.taskId, "task JSON identity mismatch")
  check(task?.dictionaryVersionId === currentDictionary.dictionaryVersionId, "task JSON dictionary is not current")
  check(task?.sourceBindings?.visualFactManifestId === visualFactPointer.manifestId, "task does not bind latest VisualFactManifest")
  check(director?.dictionaryVersionId === currentDictionary.dictionaryVersionId, "director output dictionary is not current")
  check(director?.worldId === task?.worldId && director?.tick === task?.tick, "director output world identity mismatch")
  check(visualFacts?.worldId === task?.worldId && visualFacts?.tick === task?.tick, "VisualFactManifest world identity mismatch")
}

function checkString(value, message) {
  check(typeof value === "string" && value.length > 0, message)
}

function checkFile(value, message) {
  check(fileExists(value), message)
}

function checkDirectory(value, message) {
  check(directoryExists(value), message)
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(resolvePath(relativePath), "utf8"))
  } catch (error) {
    failures.push(`${relativePath}: JSON parse failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

function resolvePath(value) {
  if (typeof value !== "string" || !value.trim()) return null
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value)
}

function fileExists(value) {
  const filePath = resolvePath(value)
  return Boolean(filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile())
}

function directoryExists(value) {
  const directoryPath = resolvePath(value)
  return Boolean(directoryPath && fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory())
}

function countFiles(value) {
  const directoryPath = resolvePath(value)
  if (!directoryPath || !fs.existsSync(directoryPath)) return 0
  const stack = [directoryPath]
  let count = 0
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(fullPath)
      if (entry.isFile()) count += 1
    }
  }
  return count
}

function countMatchingDirectories(relativeRoot, pattern) {
  const root = resolvePath(relativeRoot)
  if (!root || !fs.existsSync(root)) return 0
  let count = 0
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && pattern.test(entry.name)) count += 1
  }
  return count
}

function finish() {
  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          status: "ai_painter_training_data_persistence_check_failed",
          failures,
          warnings,
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: "ai_painter_training_data_persistence_check_passed",
        warnings,
      },
      null,
      2,
    ),
  )
}

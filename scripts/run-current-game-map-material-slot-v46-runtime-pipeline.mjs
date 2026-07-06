import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"

const inferenceRoot = path.resolve(".runtime/game-map-material-slot-inference-runs")
const approvedPackRoot = path.resolve(".runtime/game-map-approved-material-packs")
const runtimeFrameRoot = path.resolve(".runtime/game-map-runtime-frame")
const compositorRoot = path.resolve(".runtime/game-map-runtime-compositor")
const candidateRoot = path.resolve(".runtime/game-map-runtime-frame-candidates")
const aiPainterRoot = path.resolve(".runtime/ai-painter")
const runArchiveRoot = path.join(aiPainterRoot, "training-run-archive")
const referenceBaselineImagePath = path.resolve(
  ".runtime/ai-painter/natural-home-v91-current-mvp-quality-ready-generation/inference/natural-home-crop-v7-04-pond-grass-clean__v28-remix-road-tree/generated.png",
)

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function writeReport(report) {
  console.log(JSON.stringify(report, null, 2))
}

function runNpmScript(script) {
  const command = process.env.ComSpec ?? "cmd.exe"
  const child = spawnSync(command, ["/d", "/s", "/c", `npm run ${script}`], {
    stdio: "inherit",
    env: process.env,
  })
  if (child.status !== 0) {
    throw new Error(`${script} exit code: ${child.status ?? "unknown"}`)
  }
}

function runNodeScript(script, args) {
  const child = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
    env: process.env,
  })
  if (child.status !== 0) {
    throw new Error(`${script} exit code: ${child.status ?? "unknown"}`)
  }
}

function collectFiles(root, fileName) {
  if (!fs.existsSync(root)) return []
  const stack = [root]
  const matches = []
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.name === fileName) {
        matches.push(fullPath)
      }
    }
  }
  return matches.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
}

function copyIfExists(sourcePath, targetPath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(sourcePath, targetPath)
  return targetPath
}

function copyDirIfExists(sourcePath, targetPath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.cpSync(sourcePath, targetPath, { recursive: true })
  return targetPath
}

function countFilesUnder(root) {
  if (!root || !fs.existsSync(root)) return 0
  const stack = [root]
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

function projectRelative(filePath) {
  if (!filePath) return null
  const relative = path.relative(process.cwd(), filePath)
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? relative.replace(/\\/g, "/")
    : filePath
}

function sha256File(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

function pngMeta(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null
  const buffer = fs.readFileSync(filePath)
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
    return { bytes: buffer.length, sha256: sha256File(filePath) }
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.length,
    sha256: sha256File(filePath),
  }
}

function collectTrainingSummary(category) {
  const summaryPath = path.resolve(
    `.runtime/ai-painter/natural-home-local-detail-v46-ground-road-repair-training/${category}/training-summary.json`,
  )
  if (!fs.existsSync(summaryPath)) return null
  return { summaryPath, summary: readJson(summaryPath) }
}

function findLatestPassedMaterialReport() {
  for (const reportPath of collectFiles(inferenceRoot, "material-quality-report.json")) {
    const report = readJson(reportPath)
    if (report?.passed === true && report?.status === "game_map_material_quality_passed") {
      return { reportPath, report }
    }
  }
  return null
}

function findLatestApprovedPackPath() {
  return collectFiles(approvedPackRoot, "approved-material-pack.json")[0] ?? null
}

function findLatestCompositeOutput() {
  return collectFiles(compositorRoot, "game-map-composite-game-map-frame-home-map-structure-world-d0znz8-0-natural-home-0-composite-output.png")[0] ?? null
}

function findLatestCompositorAudit() {
  return collectFiles(compositorRoot, "game-map-composite-game-map-frame-home-map-structure-world-d0znz8-0-natural-home-0-compositor-audit.json")[0] ?? null
}

function findLatestFormalVisualJudge() {
  return collectFiles(compositorRoot, "game-map-composite-game-map-frame-home-map-structure-world-d0znz8-0-natural-home-0-formal-visual-judge.json")[0] ?? null
}

function buildVisualDeltaReview(input) {
  const priorityIssues = [
    {
      id: "road-naturalization",
      severity: "high",
      title: "道路自然度不足",
      observedProblem: "道路仍有重复块和规则网格感，和参考图里的手绘土路、碎边草丛过渡不一致。",
      targetSlots: [
        "slot-terrain-path-corridor-path-current-entry-to-home",
        "slot-terrain-path-corridor-path-current-home-to-water",
      ],
      nextTrainingRequirement: "增加弯曲土路、草边侵入、明暗破碎边缘和非均匀颗粒样本，降低规则砖块纹理权重。",
      acceptance: "道路必须保持走向可读，同时边缘不硬切、不像拼贴块，局部纹理不能出现周期性重复。",
    },
    {
      id: "water-shoreline-transition",
      severity: "high",
      title: "水岸过渡偏硬",
      observedProblem: "水体、岸线和草地之间的融合还不够自然，缺少参考图那种石块、草簇和浅滩共同过渡的层次。",
      targetSlots: [
        "slot-terrain-terrain-terrain-current-water-east",
        "slot-terrain-terrain-terrain-current-shoreline-east",
      ],
      nextTrainingRequirement: "补充水岸交界、浅色岸边、碎石、草簇遮挡和透明水边样本，训练时提高岸线局部一致性。",
      acceptance: "水面要干净，岸线要可读，边缘不能出现整条硬切线或明显贴图边界。",
    },
    {
      id: "grass-detail-sharpness",
      severity: "medium",
      title: "草地细节偏糊",
      observedProblem: "大面积草地虽然通过机器检测，但细看缺少参考图的像素级草叶、野花、明暗斑块和局部节奏。",
      targetSlots: [
        "slot-terrain-terrain-terrain-current-grass-main",
        "slot-object-object-grass-detail-current-east-open-1",
        "slot-object-object-grass-detail-current-north-open-1",
        "slot-object-object-grass-detail-current-west-open-1",
      ],
      nextTrainingRequirement: "加入高频草叶、野花点缀、低频草地明暗分区和局部锐化约束，避免整块绿色雾化。",
      acceptance: "远看草地连续，近看有细碎草叶和花点，不出现平涂或模糊绿雾。",
    },
    {
      id: "object-ground-integration",
      severity: "medium",
      title: "物件贴片感",
      observedProblem: "树、石头、花和设施能被放入画面，但与地表接触处还缺少遮挡、阴影和草边包裹。",
      targetSlots: [
        "slot-object-object-rock-current-shoreline-1",
        "slot-object-object-tree-current-west-boundary-1",
        "slot-object-object-flower-current-east-meadow-1",
        "slot-object-object-shrub-current-water-edge-1",
      ],
      nextTrainingRequirement: "训练物件脚底阴影、草丛遮挡、边缘透明度和环境色统一，让素材不是直接盖上去。",
      acceptance: "物件底部要自然压进地面，不能有漂浮、硬边、孤立贴图感。",
    },
  ]

  return {
    schemaVersion: "ai-painter-visual-delta-review-v1",
    generatedAt: input.finishedAt,
    status: "requires_next_training_repair",
    referenceBaseline: {
      image: projectRelative(referenceBaselineImagePath),
      purpose: "只作为像素风格、草地密度、道路自然度和水岸过渡的视觉基准，不作为直接复制目标。",
    },
    currentOutput: {
      compositeImage: projectRelative(input.compositeOutputPath),
      machineMaterialPassed: input.materialReport?.passed === true,
      machineFormalVisualJudgePassed: input.formalVisualJudge?.passed === true,
      ownerReviewStatus: "pending_owner_review",
    },
    conclusion:
      "本轮已经具备完整训练、推理、合成和归档链路，但机器通过不代表达到参考图质量。下一轮训练应集中修道路、水岸、草地细节和物件落地融合。",
    priorityIssues,
    nextTrainingPlan: {
      focus: "先做材料槽局部修复，再合成完整画面复核。",
      mustKeep: ["每轮保存参考图", "每轮保存完整输出图", "每轮保存全部材料槽图", "每轮保存训练摘要", "每轮保存失败复盘"],
      targetSlots: [...new Set(priorityIssues.flatMap((issue) => issue.targetSlots))],
      stopCondition: "人工确认接近参考图的自然像素质感后，才允许进入正式 /world 展示闭合。",
    },
  }
}

function buildRunArchive(input) {
  const runId = `game-map-material-slot-v46-${input.startedAt.replace(/[:.]/g, "-")}`
  const archiveDir = path.join(runArchiveRoot, runId)
  const imagesDir = path.join(archiveDir, "images")
  const reportsDir = path.join(archiveDir, "reports")
  const modelDir = path.join(archiveDir, "models")
  const latestLinkPath = path.join(runArchiveRoot, "latest.json")

  fs.mkdirSync(archiveDir, { recursive: true })

  const compositeOutputPath = findLatestCompositeOutput()
  const compositorAuditPath = findLatestCompositorAudit()
  const formalVisualJudgePath = findLatestFormalVisualJudge()
  const runtimeFrameCandidatePath = path.join(candidateRoot, "latest-runtime-frame.json")
  const grassTraining = collectTrainingSummary("grass")
  const roadTraining = collectTrainingSummary("road")
  const combinedModelManifestPath = path.resolve(
    ".runtime/ai-painter/natural-home-local-detail-v46-ground-road-repair-combined/combined-model-root-manifest.json",
  )
  const datasetSummaryPath = path.resolve(".runtime/ai-painter/game-map-material-slot-v45-repair-dataset/dataset-summary.json")

  const archivedReference = copyIfExists(referenceBaselineImagePath, path.join(imagesDir, "reference-baseline.png"))
  const archivedComposite = copyIfExists(compositeOutputPath, path.join(imagesDir, "composite-output.png"))
  const archivedMaterials = copyDirIfExists(input.materialDir, path.join(imagesDir, "materials"))
  const archivedMaterialReport = copyIfExists(input.materialQualityReportPath, path.join(reportsDir, "material-quality-report.json"))
  const archivedApprovedPack = copyIfExists(input.approvedPackPath, path.join(reportsDir, "approved-material-pack.json"))
  const archivedCompositorAudit = copyIfExists(compositorAuditPath, path.join(reportsDir, "compositor-audit.json"))
  const archivedFormalVisualJudge = copyIfExists(formalVisualJudgePath, path.join(reportsDir, "formal-visual-judge.json"))
  const archivedRuntimeFrameCandidate = copyIfExists(runtimeFrameCandidatePath, path.join(reportsDir, "latest-runtime-frame-candidate.json"))
  const archivedDatasetSummary = copyIfExists(datasetSummaryPath, path.join(reportsDir, "dataset-summary.json"))
  const archivedGrassSummary = copyIfExists(grassTraining?.summaryPath, path.join(reportsDir, "training-summary-grass.json"))
  const archivedRoadSummary = copyIfExists(roadTraining?.summaryPath, path.join(reportsDir, "training-summary-road.json"))
  const archivedModelManifest = copyIfExists(combinedModelManifestPath, path.join(modelDir, "model-root-manifest.json"))

  const materialReport = input.materialQualityReportPath ? readJson(input.materialQualityReportPath) : null
  const formalVisualJudge = formalVisualJudgePath && fs.existsSync(formalVisualJudgePath) ? readJson(formalVisualJudgePath) : null
  const runtimeFrameCandidate = fs.existsSync(runtimeFrameCandidatePath) ? readJson(runtimeFrameCandidatePath) : null
  const visualDeltaReview = buildVisualDeltaReview({
    finishedAt: input.finishedAt,
    compositeOutputPath,
    materialReport,
    formalVisualJudge,
  })
  const archivedVisualDeltaReview = path.join(reportsDir, "visual-delta-review.json")
  writeJson(archivedVisualDeltaReview, visualDeltaReview)

  const manifest = {
    schemaVersion: "ai-painter-training-run-archive-v1",
    runId,
    action: "full_game_map_material_slot_v46_runtime_frame",
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    purpose:
      "以参考局部自然家园图为质感基准，训练并推理游戏地图材料槽，合成完整 1024x768 RuntimeFrame 候选。",
    autonomyBoundary:
      "程序必须自动保存训练结构、图片、模型引用、质量报告、失败原因和人工复核状态；人工只负责最终审美确认和代码调试。",
    referenceBaseline: {
      sourcePath: projectRelative(referenceBaselineImagePath),
      archivedImage: projectRelative(archivedReference),
      imageMeta: pngMeta(referenceBaselineImagePath),
      role: "视觉质感基准，不是 /world 成果。",
    },
    training: {
      datasetSummaryPath: projectRelative(datasetSummaryPath),
      archivedDatasetSummary: projectRelative(archivedDatasetSummary),
      categories: {
        grass: {
          trainingSummaryPath: projectRelative(grassTraining?.summaryPath),
          archivedSummary: projectRelative(archivedGrassSummary),
          summary: grassTraining?.summary ?? null,
        },
        road: {
          trainingSummaryPath: projectRelative(roadTraining?.summaryPath),
          archivedSummary: projectRelative(archivedRoadSummary),
          summary: roadTraining?.summary ?? null,
        },
      },
    },
    inference: {
      materialDir: projectRelative(input.materialDir),
      archivedMaterialDir: projectRelative(archivedMaterials),
      materialCount:
        materialReport?.summary?.slotCount ??
        materialReport?.slotCount ??
        materialReport?.materials?.length ??
        countFilesUnder(input.materialDir),
    },
    quality: {
      materialQualityReportPath: projectRelative(input.materialQualityReportPath),
      archivedMaterialQualityReport: projectRelative(archivedMaterialReport),
      materialStatus: materialReport?.status ?? null,
      materialPassed: materialReport?.passed ?? null,
      failedSlots: materialReport?.failedSlots ?? [],
      formalVisualJudgePath: projectRelative(formalVisualJudgePath),
      archivedFormalVisualJudge: projectRelative(archivedFormalVisualJudge),
      formalVisualJudgeStatus: formalVisualJudge?.status ?? null,
      formalVisualJudgePassed: formalVisualJudge?.passed ?? null,
      formalVisualJudgeIssues: formalVisualJudge?.issues ?? [],
    },
    output: {
      approvedPackPath: projectRelative(input.approvedPackPath),
      archivedApprovedPack: projectRelative(archivedApprovedPack),
      compositorAuditPath: projectRelative(compositorAuditPath),
      archivedCompositorAudit: projectRelative(archivedCompositorAudit),
      compositeOutputPath: projectRelative(compositeOutputPath),
      archivedCompositeOutput: projectRelative(archivedComposite),
      compositeImageMeta: pngMeta(compositeOutputPath),
      runtimeFrameCandidatePath: projectRelative(runtimeFrameCandidatePath),
      archivedRuntimeFrameCandidate: projectRelative(archivedRuntimeFrameCandidate),
      canShowInWorldByMachineGate:
        runtimeFrameCandidate?.runtimeFrame?.worldPageContract?.canShowInWorld ??
        runtimeFrameCandidate?.worldPageContract?.canShowInWorld ??
        null,
    },
    visualDeltaReview: {
      archivedReport: projectRelative(archivedVisualDeltaReview),
      status: visualDeltaReview.status,
      priorityIssueCount: visualDeltaReview.priorityIssues.length,
      targetSlots: visualDeltaReview.nextTrainingPlan.targetSlots,
      nextAction: visualDeltaReview.nextTrainingPlan.focus,
    },
    model: {
      combinedModelManifestPath: projectRelative(combinedModelManifestPath),
      archivedModelManifest: projectRelative(archivedModelManifest),
      checkpointPolicy: "checkpoint 文件保留在原训练目录，归档记录路径和 summary，避免重复复制大权重。",
    },
    manualReview: {
      status: "pending_owner_review",
      required: true,
      note: "机器通过不等于正式闭合；项目所有者人工确认通过前不得作为最终 /world 成果。",
    },
    files: {
      archiveDir: projectRelative(archiveDir),
      manifest: projectRelative(path.join(archiveDir, "manifest.json")),
      latest: projectRelative(latestLinkPath),
    },
    tags: [
      "local_small_model_training_pipeline",
      "self_archived_training_run",
      "complete_runtime_frame_candidate",
      "requires_owner_review",
    ],
  }

  writeJson(path.join(archiveDir, "manifest.json"), manifest)
  writeJson(latestLinkPath, manifest)
  return manifest
}

function main() {
  const startedAt = new Date().toISOString()
  try {
    if (process.argv.includes("--archive-existing")) {
      const materialReport = findLatestPassedMaterialReport()
      if (!materialReport?.report?.materialDir) {
        throw new Error("latest_passed_material_quality_report_missing")
      }
      const approvedPackPath = findLatestApprovedPackPath()
      if (!approvedPackPath) {
        throw new Error("latest_approved_material_pack_missing")
      }
      const finishedAt = new Date().toISOString()
      const archive = buildRunArchive({
        status: "archived_existing",
        startedAt,
        finishedAt,
        materialQualityReportPath: materialReport.reportPath,
        materialDir: materialReport.report.materialDir,
        approvedPackPath,
      })
      writeReport({
        ok: true,
        status: "game_map_material_slot_v46_existing_outputs_archived",
        startedAt,
        finishedAt,
        trainingRunArchive: archive.files.archiveDir,
        trainingRunManifest: archive.files.manifest,
        tags: ["local_small_model_training_pipeline", "self_archived_training_run", "archive_existing_outputs"],
      })
      return
    }

    const steps = [
      "write:game-map-current-runtime-frame",
      "write:game-map-material-generation-request",
      "write:game-map-material-input-pack",
      "prepare:game-map-material-slot-v45-repair",
      "train:game-map-material-slot-v46-grass",
      "train:game-map-material-slot-v46-road",
      "assemble:game-map-material-slot-v46-model-root",
      "run:game-map-material-slot-inference:v46-local",
      "judge:game-map-material-quality",
    ]

    for (const step of steps) {
      runNpmScript(step)
    }

    const materialReport = findLatestPassedMaterialReport()
    if (!materialReport?.report?.materialDir) {
      throw new Error("latest_passed_material_quality_report_missing")
    }

    runNodeScript("scripts/build-current-game-map-approved-material-pack.mjs", [
      runtimeFrameRoot,
      path.resolve(materialReport.report.materialDir),
      approvedPackRoot,
    ])

    const approvedPackPath = findLatestApprovedPackPath()
    if (!approvedPackPath) {
      throw new Error("latest_approved_material_pack_missing")
    }

    runNodeScript("scripts/write-current-game-map-composite-runtime-frame.mjs", [
      runtimeFrameRoot,
      approvedPackPath,
      compositorRoot,
      candidateRoot,
    ])

    const finishedAt = new Date().toISOString()
    const archive = buildRunArchive({
      status: "completed",
      startedAt,
      finishedAt,
      materialQualityReportPath: materialReport.reportPath,
      materialDir: materialReport.report.materialDir,
      approvedPackPath,
    })

    writeReport({
      ok: true,
      status: "game_map_material_slot_v46_runtime_pipeline_completed",
      startedAt,
      finishedAt,
      materialQualityReportPath: materialReport.reportPath,
      materialDir: materialReport.report.materialDir,
      approvedPackPath,
      candidateRoot,
      trainingRunArchive: archive.files.archiveDir,
      trainingRunManifest: archive.files.manifest,
      tags: [
        "local_small_model_training_pipeline",
        "game_map_material_slot_v46",
        "requires_owner_runtime_frame_review",
        "self_archived_training_run",
      ],
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const runId = `game-map-material-slot-v46-${startedAt.replace(/[:.]/g, "-")}`
    const failureArchiveDir = path.join(runArchiveRoot, runId)
    const failureManifest = {
      schemaVersion: "ai-painter-training-run-archive-v1",
      runId,
      action: "full_game_map_material_slot_v46_runtime_frame",
      status: "failed",
      startedAt,
      finishedAt,
      error: error instanceof Error ? error.message : "unknown_pipeline_error",
      manualReview: {
        status: "not_applicable_failed_before_candidate",
        required: false,
      },
      tags: ["local_small_model_training_pipeline", "self_archived_training_run", "failed_training_run"],
    }
    writeJson(path.join(failureArchiveDir, "manifest.json"), failureManifest)
    writeJson(path.join(runArchiveRoot, "latest.json"), failureManifest)
    writeReport({
      ok: false,
      status: "game_map_material_slot_v46_runtime_pipeline_failed",
      startedAt,
      finishedAt,
      error: error instanceof Error ? error.message : "unknown_pipeline_error",
      trainingRunArchive: projectRelative(failureArchiveDir),
      trainingRunManifest: projectRelative(path.join(failureArchiveDir, "manifest.json")),
      tags: [
        "local_small_model_training_pipeline",
        "game_map_material_slot_v46",
        "not_world_page_runtime",
        "self_archived_training_run",
      ],
    })
    process.exitCode = 1
  }
}

main()

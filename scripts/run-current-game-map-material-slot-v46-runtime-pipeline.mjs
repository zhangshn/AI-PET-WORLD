import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import {
  assertWorldVisualDictionaryContract,
  loadWorldVisualDictionaryContract,
  tryLoadWorldVisualDictionaryContract,
} from "./lib/world-visual-dictionary-contract.mjs"
import {
  completeTrainingControlRun,
  failTrainingControlRun,
  startTrainingControlRun,
  updateTrainingControlStep,
} from "./lib/ai-painter-training-control.mjs"

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
  const summaryPath = collectFiles(aiPainterRoot, "training-summary.json")
    .find((filePath) => path.basename(path.dirname(filePath)) === category)
  if (!summaryPath || !fs.existsSync(summaryPath)) return null
  return { summaryPath, summary: readJson(summaryPath) }
}

function findLatestCombinedModelManifest() {
  return collectFiles(aiPainterRoot, "combined-model-root-manifest.json")[0] ?? null
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

function findLatestMaterialReport() {
  const reportPath = collectFiles(inferenceRoot, "material-quality-report.json")[0] ?? null
  if (!reportPath) return null
  return { reportPath, report: readJson(reportPath) }
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
  const materialSlots = Array.isArray(input.materialReport?.slots) ? input.materialReport.slots : []
  const failedMaterialSlots = materialSlots
    .filter((slot) => slot?.passed === false)
    .map((slot) => ({
      slotId: slot.slotId,
      unitKind: slot.unitKind,
      issues: Array.isArray(slot.issues) ? slot.issues : [],
      metrics: slot.metrics ?? null,
    }))
  const formalIssues = Array.isArray(input.formalVisualJudge?.issues)
    ? input.formalVisualJudge.issues
    : []
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

  if (failedMaterialSlots.some((slot) => slot.issues.includes("grass_material_palette_too_low_for_game_terrain"))) {
    priorityIssues.unshift({
      id: "strict-grass-palette-density",
      severity: "high",
      title: "grass palette density failed",
      observedProblem:
        "Grass material failed the strict professional-game palette-density gate; it still reads as a blurred green base texture.",
      targetSlots: ["slot-terrain-terrain-terrain-current-grass-main"],
      nextTrainingRequirement:
        "Select and train from richer grass patches with higher quantized-color diversity, visible grass blades, flowers, and light/dark terrain rhythm.",
      acceptance:
        "Grass must pass grass_material_palette_too_low_for_game_terrain and formal_world_frame_grass_palette_density_too_low gates.",
    })
  }
  if (
    failedMaterialSlots.some((slot) =>
      slot.issues.includes("material_edge_density_too_low") &&
      slot.unitKind === "grass_texture"
    )
  ) {
    priorityIssues.unshift({
      id: "strict-model-dominant-grass-detail",
      severity: "high",
      title: "model-dominant grass detail failed",
      observedProblem:
        "With procedural texture injection disabled, the grass model output is too smooth and lacks enough edge/detail density.",
      targetSlots: ["slot-terrain-terrain-terrain-current-grass-main"],
      nextTrainingRequirement:
        "Retrain grass with stronger edge, texture, laplacian, gradient, and color-range losses so the local model itself creates professional game terrain detail.",
      acceptance:
        "Grass must pass material_edge_density_too_low and grass_material_palette_too_low_for_game_terrain under model_dominant_material_output inference.",
    })
  }
  if (failedMaterialSlots.some((slot) => slot.issues.includes("material_contrast_too_low"))) {
    priorityIssues.unshift({
      id: "strict-material-contrast",
      severity: "high",
      title: "material contrast too low",
      observedProblem:
        "One or more material slots failed the strict contrast gate. The current complete map cannot advance to approved material pack or composite RuntimeFrame until those slots pass.",
      targetSlots: failedMaterialSlots
        .filter((slot) => slot.issues.includes("material_contrast_too_low"))
        .map((slot) => slot.slotId),
      nextTrainingRequirement:
        "Retrain or refine the failed material category with stronger local luminance variation, clearer high-frequency detail, and preserved natural palette.",
      acceptance:
        "Every target slot must pass material_contrast_too_low in the material quality report before composite RuntimeFrame writing is allowed.",
    })
  }
  if (failedMaterialSlots.some((slot) => slot.issues.includes("path_material_palette_too_repetitive"))) {
    priorityIssues.unshift({
      id: "strict-path-material-variation",
      severity: "high",
      title: "path material repetitive",
      observedProblem:
        "Path material failed the strict professional-game material-variation gate; it reads as a repeated brick/tile road.",
      targetSlots: [
        "slot-terrain-path-corridor-path-current-entry-to-home",
        "slot-terrain-path-corridor-path-current-home-to-water",
      ],
      nextTrainingRequirement:
        "Select and train from irregular natural dirt-road patches with more color variation, broken edges, grass intrusion, and non-periodic detail.",
      acceptance:
        "Path must pass path_material_palette_too_repetitive and formal_world_frame_path_repetitive_brick_artifact gates.",
    })
  }
  if (failedMaterialSlots.some((slot) => slot.issues.includes("path_green_contamination_suspected"))) {
    priorityIssues.unshift({
      id: "strict-model-dominant-path-color",
      severity: "high",
      title: "model-dominant path color failed",
      observedProblem:
        "With procedural texture injection disabled, one road slot is too green and no longer reads as coherent path material.",
      targetSlots: failedMaterialSlots
        .filter((slot) => slot.issues.includes("path_green_contamination_suspected"))
        .map((slot) => slot.slotId),
      nextTrainingRequirement:
        "Retrain road with stronger road and road-edge structure weights so the local model separates earth path color from grass contamination.",
      acceptance:
        "Road slots must pass path_green_contamination_suspected under model_dominant_material_output inference.",
    })
  }
  const contaminatedGrassSlots = failedMaterialSlots.filter((slot) =>
    slot.unitKind === "grass_texture" &&
    slot.issues.some((issue) =>
      [
        "grass_material_water_contamination_suspected",
        "grass_material_path_fragment_suspected",
        "grass_material_pale_paste_fragment_suspected",
        "grass_material_blue_object_fragment_suspected",
        "grass_material_object_fragment_suspected",
      ].includes(issue)
    )
  )
  if (contaminatedGrassSlots.length > 0) {
    priorityIssues.unshift({
      id: "strict-grass-material-contamination",
      severity: "high",
      title: "grass material contamination failed",
      observedProblem:
        "One or more grass-family terrain slots contain water, path, pale paste, blue object, or dark object fragments; material quality must block them before a complete RuntimeFrame can be composed.",
      targetSlots: contaminatedGrassSlots.map((slot) => slot.slotId),
      nextTrainingRequirement:
        "Retrain grass-family terrain materials so mud and tall-grass regions keep natural ground identity without importing water, road, object, or pasted highlight fragments.",
      acceptance:
        "Every target slot must clear grass_material_water_contamination_suspected, grass_material_path_fragment_suspected, grass_material_pale_paste_fragment_suspected, grass_material_blue_object_fragment_suspected, and grass_material_object_fragment_suspected.",
    })
  }
  if (formalIssues.some((issue) => issue?.code === "formal_world_frame_grass_palette_density_too_low")) {
    priorityIssues.unshift({
      id: "formal-grass-palette-density",
      severity: "high",
      title: "formal grass palette density failed",
      observedProblem:
        "The complete /world frame grass has too little local color variation and reads as a blurred base texture.",
      targetSlots: ["slot-terrain-terrain-terrain-current-grass-main"],
      nextTrainingRequirement:
        "Repair the grass material from the latest approved baseline with richer local palette density, visible blade clusters, flowers, and light/dark terrain rhythm.",
      acceptance:
        "The next complete map must clear formal_world_frame_grass_palette_density_too_low without lowering the formal judge threshold.",
    })
  }
  if (formalIssues.some((issue) => issue?.code === "formal_world_frame_muddy_grass_field_artifact")) {
    priorityIssues.unshift({
      id: "formal-muddy-grass-field",
      severity: "high",
      title: "formal muddy grass field failed",
      observedProblem:
        "The complete /world frame grass still reads as muddy training noise instead of deliberate game terrain material.",
      targetSlots: ["slot-terrain-terrain-terrain-current-grass-main"],
      nextTrainingRequirement:
        "Repair grass using cleaner earth-to-grass transitions and natural detail contrast while avoiding camouflage-like noise.",
      acceptance:
        "The next complete map must clear formal_world_frame_muddy_grass_field_artifact and preserve readable grass coverage.",
    })
  }
  if (formalIssues.some((issue) => issue?.code === "formal_world_frame_path_repetitive_brick_artifact")) {
    priorityIssues.unshift({
      id: "formal-path-naturalization",
      severity: "high",
      title: "formal path repetition failed",
      observedProblem:
        "The complete /world frame road reads as a repeated brick or tile texture instead of a natural playable route.",
      targetSlots: [
        "slot-terrain-path-corridor-path-current-entry-to-home",
        "slot-terrain-path-corridor-path-current-home-to-water",
      ],
      nextTrainingRequirement:
        "Repair road material with irregular natural dirt, broken edges, grass intrusion, and non-periodic detail.",
      acceptance:
        "The next complete map must clear formal_world_frame_path_repetitive_brick_artifact and keep route readability.",
    })
  }
  if (formalIssues.some((issue) => issue?.code === "formal_world_frame_shoreline_pasted_strip_artifact")) {
    priorityIssues.unshift({
      id: "formal-shoreline-integration",
      severity: "high",
      title: "formal shoreline pasted strip failed",
      observedProblem:
        "The complete /world frame shoreline reads as an unintegrated pasted material strip.",
      targetSlots: ["slot-terrain-terrain-terrain-current-shoreline-east"],
      nextTrainingRequirement:
        "Repair shoreline material with natural grass-water transition, broken edge shapes, shallow-bank color steps, and reduced vertical strip feel.",
      acceptance:
        "The next complete map must clear formal_world_frame_shoreline_pasted_strip_artifact without reducing visible water.",
    })
  }
  if (failedMaterialSlots.some((slot) => slot.issues.includes("object_material_bright_paste_border_suspected"))) {
    priorityIssues.unshift({
      id: "strict-object-paste-border",
      severity: "medium",
      title: "object paste border failed",
      observedProblem:
        "Some object materials failed the strict bright-border gate and still read as pasted decals.",
      targetSlots: failedMaterialSlots
        .filter((slot) => slot.issues.includes("object_material_bright_paste_border_suspected"))
        .map((slot) => slot.slotId),
      nextTrainingRequirement:
        "Repair object alpha, foot shadow, edge transparency, and local ground-color harmony so objects sit into terrain instead of floating above it.",
      acceptance:
        "Object slots must pass object_material_bright_paste_border_suspected and must not show hard bright borders in the composite map.",
    })
  }

  const strictTargetSlots = [
    ...new Set(
      priorityIssues
        .filter((issue) => issue.id.startsWith("strict-"))
        .flatMap((issue) => issue.targetSlots),
    ),
  ]
  const formalTargetSlots = [
    ...new Set(
      priorityIssues
        .filter((issue) => issue.id.startsWith("formal-"))
        .flatMap((issue) => issue.targetSlots),
    ),
  ]
  const nextTargetSlots =
    strictTargetSlots.length > 0
      ? strictTargetSlots
      : formalTargetSlots.length > 0
        ? formalTargetSlots
      : [...new Set(priorityIssues.flatMap((issue) => issue.targetSlots))]

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
      failedMaterialSlots,
      formalIssues,
      ownerReviewStatus: "pending_owner_review",
    },
    conclusion:
      "本轮已经具备完整训练、推理、合成和归档链路，但机器通过不代表达到参考图质量。下一轮训练应集中修道路、水岸、草地细节和物件落地融合。",
    priorityIssues,
    nextTrainingPlan: {
      focus: "先做材料槽局部修复，再合成完整画面复核。",
      mustKeep: ["每轮保存参考图", "每轮保存完整输出图", "每轮保存全部材料槽图", "每轮保存训练摘要", "每轮保存失败复盘"],
      targetSlots: nextTargetSlots,
      stopCondition: "人工确认接近参考图的自然像素质感后，才允许进入正式 /world 展示闭合。",
    },
  }
}

function buildRunArchive(input) {
  const dictionaryContract = input.dictionaryContract ?? loadWorldVisualDictionaryContract()
  assertWorldVisualDictionaryContract(dictionaryContract)
  const runId = `game-map-material-slot-v46-${input.startedAt.replace(/[:.]/g, "-")}`
  const archiveDir = path.join(runArchiveRoot, runId)
  const imagesDir = path.join(archiveDir, "images")
  const reportsDir = path.join(archiveDir, "reports")
  const modelDir = path.join(archiveDir, "models")
  const latestLinkPath = path.join(runArchiveRoot, "latest.json")

  fs.mkdirSync(archiveDir, { recursive: true })

  const materialReport = input.materialQualityReportPath ? readJson(input.materialQualityReportPath) : null
  const materialPassed = materialReport?.passed === true && materialReport?.status === "game_map_material_quality_passed"
  const compositeOutputPath = materialPassed ? findLatestCompositeOutput() : null
  const compositorAuditPath = materialPassed ? findLatestCompositorAudit() : null
  const formalVisualJudgePath = materialPassed ? findLatestFormalVisualJudge() : null
  const runtimeFrameCandidatePath = materialPassed ? path.join(candidateRoot, "latest-runtime-frame.json") : null
  const grassTraining = collectTrainingSummary("grass")
  const roadTraining = collectTrainingSummary("road")
  const combinedModelManifestPath = findLatestCombinedModelManifest()
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

  const formalVisualJudge = formalVisualJudgePath && fs.existsSync(formalVisualJudgePath) ? readJson(formalVisualJudgePath) : null
  const runtimeFrameCandidate = runtimeFrameCandidatePath && fs.existsSync(runtimeFrameCandidatePath) ? readJson(runtimeFrameCandidatePath) : null
  const visualDeltaReview = buildVisualDeltaReview({
    finishedAt: input.finishedAt,
    compositeOutputPath,
    materialReport,
    formalVisualJudge,
  })
  const failedMaterialSlotsForManifest = Array.isArray(materialReport?.slots)
    ? materialReport.slots
        .filter((slot) => slot?.passed === false)
        .map((slot) => ({
          slotId: slot.slotId,
          unitKind: slot.unitKind,
          issues: Array.isArray(slot.issues) ? slot.issues : [],
        }))
    : materialReport?.failedSlots ?? []
  const archivedVisualDeltaReview = path.join(reportsDir, "visual-delta-review.json")
  writeJson(archivedVisualDeltaReview, visualDeltaReview)

  const manifest = {
    schemaVersion: "ai-painter-training-run-archive-v1",
    runId,
    action: "full_game_map_material_slot_v46_runtime_frame",
    status: input.status,
    dictionaryContract,
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
      failedSlots: failedMaterialSlotsForManifest,
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
  const controlRun = startTrainingControlRun(
    "full_game_map_material_slot_v46_runtime_frame",
    process.argv.includes("--archive-existing")
      ? "archive_existing_game_map_material_slot_runtime_outputs"
      : "game_map_material_slot_v46_runtime_pipeline_started",
  )
  let dictionaryContract = null
  try {
    dictionaryContract = loadWorldVisualDictionaryContract()
    assertWorldVisualDictionaryContract(dictionaryContract)
    if (process.argv.includes("--archive-existing")) {
      updateTrainingControlStep(controlRun, "archive_existing_material_quality_report")
      const materialReport = findLatestMaterialReport()
      if (!materialReport?.report?.materialDir) {
        throw new Error("latest_material_quality_report_missing")
      }
      const approvedPackPath =
        materialReport.report.passed === true ? findLatestApprovedPackPath() : null
      if (materialReport.report.passed === true && !approvedPackPath) {
        throw new Error("latest_approved_material_pack_missing")
      }
      const finishedAt = new Date().toISOString()
      const archive = buildRunArchive({
        status:
          materialReport.report.passed === true
            ? "archived_existing"
            : "archived_existing_failed_material_quality",
        startedAt,
        finishedAt,
        materialQualityReportPath: materialReport.reportPath,
        materialDir: materialReport.report.materialDir,
        approvedPackPath,
        dictionaryContract,
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
      completeTrainingControlRun(controlRun, "archive_existing_outputs_completed")
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
      updateTrainingControlStep(controlRun, step)
      runNpmScript(step)
    }

    updateTrainingControlStep(controlRun, "find_latest_passed_material_quality_report")
    const materialReport = findLatestPassedMaterialReport()
    if (!materialReport?.report?.materialDir) {
      throw new Error("latest_passed_material_quality_report_missing")
    }

    updateTrainingControlStep(controlRun, "build_current_game_map_approved_material_pack")
    runNodeScript("scripts/build-current-game-map-approved-material-pack.mjs", [
      runtimeFrameRoot,
      path.resolve(materialReport.report.materialDir),
      approvedPackRoot,
    ])

    const approvedPackPath = findLatestApprovedPackPath()
    if (!approvedPackPath) {
      throw new Error("latest_approved_material_pack_missing")
    }

    updateTrainingControlStep(controlRun, "write_current_game_map_composite_runtime_frame")
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
      dictionaryContract,
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
    completeTrainingControlRun(controlRun, "game_map_material_slot_v46_runtime_pipeline_completed")
  } catch (error) {
    failTrainingControlRun(
      controlRun,
      "game_map_material_slot_v46_runtime_pipeline_failed",
      error,
    )
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
      dictionaryContract: tryLoadWorldVisualDictionaryContract(),
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

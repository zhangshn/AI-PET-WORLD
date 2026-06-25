import { execFile } from "node:child_process"
import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"
import { readResourceUsageLedger } from "@/server/ai-painter-resource-usage"
import { buildTrainingQualityGateReport } from "@/server/ai-painter-training-quality-gate"
import { readTrainingControlState, readTrainingLogTail } from "@/server/ai-painter-training-state"
import { buildVisualUnitV0Status } from "@/world/world-visual-painter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const execFileAsync = promisify(execFile)
const aiPainterRuntimeRoot = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "ai-painter")
const bootstrapTrainingDir = path.join(aiPainterRuntimeRoot, "bootstrap-training")

export async function GET() {
  const summary = await readJson(path.join(bootstrapTrainingDir, "training-summary.json"))
  const latest = await readLastJsonLine(path.join(bootstrapTrainingDir, "training-log.jsonl"))
  const checkpointReady = await exists(path.join(bootstrapTrainingDir, "best.pt"))
  const inferenceReady = await exists(path.join(aiPainterRuntimeRoot, "bootstrap-inference", "bootstrap-world-001.png"))
  const epoch = numberValue(latest?.epoch ?? summary?.epochs)
  const control = await readTrainingControlState()
  const naturalHomeMultisourceLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v20-multisource-generalization", "latest.json"),
  )
  const naturalHomeWarningFocusLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v22-warning-focus", "latest.json"),
  )
  const naturalHomeCandidateConsolidationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v23-candidate-consolidation", "latest.json"),
  )
  const naturalHomeDiversityGenerationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v24-diversity-generation", "latest.json"),
  )
  const naturalHomeDiversityGeneralizationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v25-diversity-generation", "latest.json"),
  )
  const naturalHomeDiversityRefinerLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v26-diversity-refiner-generation", "latest.json"),
  )
  const naturalHomeV27AugmentedDatasetManifest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v27-augmented-diversity-dataset", "dataset-manifest.json"),
  )
  const naturalHomeV27StructureSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v27-structure-guided-training", "training-summary.json"),
  )
  const naturalHomeV27RefinerSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v27-refiner-training", "training-summary.json"),
  )
  const naturalHomeV27DiversityRefinerLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v27-diversity-refiner-generation", "latest.json"),
  )
  const naturalHomeV28RealMaskRemixDatasetManifest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v28-real-mask-remix-dataset", "dataset-manifest.json"),
  )
  const naturalHomeV28StructureSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v28-structure-guided-training", "training-summary.json"),
  )
  const naturalHomeV28RefinerSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v28-refiner-training", "training-summary.json"),
  )
  const naturalHomeV28DiversityRefinerLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v28-diversity-refiner-generation", "latest.json"),
  )
  const naturalHomeV31QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v31-quality-selection", "latest.json"),
  )
  const naturalHomeV32QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v32-quality-selection", "latest.json"),
  )
  const naturalHomeV33WaterArtifactGuardLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v33-water-artifact-guard-generation", "latest.json"),
  )
  const naturalHomeV33QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v33-quality-selection", "latest.json"),
  )
  const naturalHomeV34WaterStabilityLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v34-water-stability-generation", "latest.json"),
  )
  const naturalHomeV34QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v34-quality-selection", "latest.json"),
  )
  const naturalHomeV35BalancedWaterDetailLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v35-balanced-water-detail-generation", "latest.json"),
  )
  const naturalHomeV35QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v35-quality-selection", "latest.json"),
  )
  const naturalHomeV36BalancedGeneralizationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v36-balanced-generalization-generation", "latest.json"),
  )
  const naturalHomeV36QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v36-quality-selection", "latest.json"),
  )
  const naturalHomeV37WaterFailureRepairLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v37-water-failure-repair-generation", "latest.json"),
  )
  const naturalHomeV37QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v37-quality-selection", "latest.json"),
  )
  const naturalHomeV38WaterEdgeBalanceLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v38-water-edge-balance-generation", "latest.json"),
  )
  const naturalHomeV38QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v38-quality-selection", "latest.json"),
  )
  const naturalHomeV39FailureFocusDatasetManifest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v39-failure-focus-dataset", "dataset-manifest.json"),
  )
  const naturalHomeV39FailureFocusRepairLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v39-failure-focus-repair-generation", "latest.json"),
  )
  const naturalHomeV39QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v39-quality-selection", "latest.json"),
  )
  const naturalHomeV39FailureFocusTrainingSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v39-failure-focus-repair-training", "training-summary.json"),
  )
  const naturalHomeV39FailureFocusTrainingLatest = await readLastJsonLine(
    path.join(aiPainterRuntimeRoot, "natural-home-v39-failure-focus-repair-training", "training-log.jsonl"),
  )
  const naturalHomeV40SharpnessLockRepairLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v40-sharpness-lock-repair-generation", "latest.json"),
  )
  const naturalHomeV40QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v40-quality-selection", "latest.json"),
  )
  const naturalHomeV40SharpnessLockTrainingSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v40-sharpness-lock-repair-training", "training-summary.json"),
  )
  const naturalHomeV40SharpnessLockTrainingLatest = await readLastJsonLine(
    path.join(aiPainterRuntimeRoot, "natural-home-v40-sharpness-lock-repair-training", "training-log.jsonl"),
  )
  const naturalHomeV41V32WaterRescueLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v41-v32-water-rescue-generation", "latest.json"),
  )
  const naturalHomeV41QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v41-quality-selection", "latest.json"),
  )
  const naturalHomeV41V32WaterRescueTrainingSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v41-v32-water-rescue-training", "training-summary.json"),
  )
  const naturalHomeV41V32WaterRescueTrainingLatest = await readLastJsonLine(
    path.join(aiPainterRuntimeRoot, "natural-home-v41-v32-water-rescue-training", "training-log.jsonl"),
  )
  const naturalHomeV42WaterExpertFixLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v42-v32-water-expert-fix-generation", "latest.json"),
  )
  const naturalHomeV42QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v42-quality-selection", "latest.json"),
  )
  const naturalHomeV43FailureFocusDatasetManifest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v43-v32-failure-focus-dataset", "dataset-manifest.json"),
  )
  const naturalHomeV43FailureFocusRepairLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v43-v32-failure-focus-repair-generation", "latest.json"),
  )
  const naturalHomeV43QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v43-quality-selection", "latest.json"),
  )
  const naturalHomeV43FailureFocusTrainingSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v43-v32-failure-focus-repair-training", "training-summary.json"),
  )
  const naturalHomeV43FailureFocusTrainingLatest = await readLastJsonLine(
    path.join(aiPainterRuntimeRoot, "natural-home-v43-v32-failure-focus-repair-training", "training-log.jsonl"),
  )
  const naturalHomeV44StableGeneralizationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v44-v32-stable-generalization-generation", "latest.json"),
  )
  const naturalHomeV44QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v44-quality-selection", "latest.json"),
  )
  const naturalHomeV44StableGeneralizationTrainingSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v44-v32-stable-generalization-training", "training-summary.json"),
  )
  const naturalHomeV44StableGeneralizationTrainingLatest = await readLastJsonLine(
    path.join(aiPainterRuntimeRoot, "natural-home-v44-v32-stable-generalization-training", "training-log.jsonl"),
  )
  const naturalHomeV45GeneralizationDatasetManifest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v45-generalization-dataset", "dataset-manifest.json"),
  )
  const naturalHomeV45GeneralizationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v45-generalization-generation", "latest.json"),
  )
  const naturalHomeV45QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v45-quality-selection", "latest.json"),
  )
  const naturalHomeV45GeneralizationTrainingSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v45-generalization-training", "training-summary.json"),
  )
  const naturalHomeV45GeneralizationTrainingLatest = await readLastJsonLine(
    path.join(aiPainterRuntimeRoot, "natural-home-v45-generalization-training", "training-log.jsonl"),
  )
  const naturalHomeV46FailureFocusDatasetManifest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v46-v45-failure-focus-dataset", "dataset-manifest.json"),
  )
  const naturalHomeV46FailureFocusRepairLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v46-v45-failure-focus-repair-generation", "latest.json"),
  )
  const naturalHomeV46QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v46-quality-selection", "latest.json"),
  )
  const naturalHomeV46FailureFocusTrainingSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v46-v45-failure-focus-repair-training", "training-summary.json"),
  )
  const naturalHomeV46FailureFocusTrainingLatest = await readLastJsonLine(
    path.join(aiPainterRuntimeRoot, "natural-home-v46-v45-failure-focus-repair-training", "training-log.jsonl"),
  )
  const naturalHomeV47HardFailureDatasetManifest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v47-hard-failure-stabilization-dataset", "dataset-manifest.json"),
  )
  const naturalHomeV47HardFailureGenerationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v47-hard-failure-stabilization-generation", "latest.json"),
  )
  const naturalHomeV47QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v47-quality-selection", "latest.json"),
  )
  const naturalHomeV47HardFailureTrainingSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v47-hard-failure-stabilization-training", "training-summary.json"),
  )
  const naturalHomeV47HardFailureTrainingLatest = await readLastJsonLine(
    path.join(aiPainterRuntimeRoot, "natural-home-v47-hard-failure-stabilization-training", "training-log.jsonl"),
  )
  const naturalHomeV48WaterSharpnessExpertFixLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v48-water-sharpness-expert-fix-generation", "latest.json"),
  )
  const naturalHomeV48RepairQualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v48-repair-quality-selection", "latest.json"),
  )
  const naturalHomeV48MergeGateSelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v48-merge-gate-selection", "latest.json"),
  )
  const naturalHomeV49V32DiversitySweepGenerationLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v49-v32-diversity-sweep-generation", "latest.json"),
  )
  const naturalHomeV49QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v49-quality-selection", "latest.json"),
  )
  const naturalHomeV50DiversityWaterGateLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v50-diversity-water-gate", "latest.json"),
  )
  const naturalHomeV51SafeCandidatePackLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v51-safe-candidate-pack", "latest.json"),
  )
  const naturalHomeV87QualityLedgerLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v87-quality-ledger", "latest.json"),
  )
  const naturalHomeV88QualityAllowlistDatasetLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v88-quality-allowlist-dataset", "latest.json"),
  )
  const naturalHomeV89QualityAllowlistTrainingSummary = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v89-quality-allowlist-training", "training-summary.json"),
  )
  const naturalHomeV89QualityAllowlistTrainingLatest = await readLastJsonLine(
    path.join(aiPainterRuntimeRoot, "natural-home-v89-quality-allowlist-training", "training-log.jsonl"),
  )
  const naturalHomeV89QualitySelectionLatest = await readJson(
    path.join(aiPainterRuntimeRoot, "natural-home-v89-quality-selection", "latest.json"),
  )
  const naturalHomeBestTrainingCandidate = selectBestTrainingQualityCandidate([
    { stage: "V49", title: "Natural Home V49 V32 diversity sweep", latest: naturalHomeV49QualitySelectionLatest },
    { stage: "V48", title: "Natural Home V48 split expert merge gate", latest: naturalHomeV48MergeGateSelectionLatest },
    { stage: "V47", title: "Natural Home V47 hard failure stabilization", latest: naturalHomeV47QualitySelectionLatest },
    { stage: "V46", title: "Natural Home V46 V45 failure-focus repair", latest: naturalHomeV46QualitySelectionLatest },
    { stage: "V45", title: "Natural Home V45 generalization dataset", latest: naturalHomeV45QualitySelectionLatest },
    { stage: "V44", title: "Natural Home V44 V32 stable generalization", latest: naturalHomeV44QualitySelectionLatest },
    { stage: "V43", title: "Natural Home V43 V32 failure-focus repair", latest: naturalHomeV43QualitySelectionLatest },
    { stage: "V42", title: "Natural Home V42 water expert fix", latest: naturalHomeV42QualitySelectionLatest },
    { stage: "V41", title: "Natural Home V41 V32 water rescue", latest: naturalHomeV41QualitySelectionLatest },
    { stage: "V40", title: "Natural Home V40 sharpness-lock repair", latest: naturalHomeV40QualitySelectionLatest },
    { stage: "V39", title: "Natural Home V39 failure-focus repair", latest: naturalHomeV39QualitySelectionLatest },
    { stage: "V38", title: "Natural Home V38 water edge balance", latest: naturalHomeV38QualitySelectionLatest },
    { stage: "V37", title: "Natural Home V37 water failure repair", latest: naturalHomeV37QualitySelectionLatest },
    { stage: "V36", title: "Natural Home V36 balanced generalization", latest: naturalHomeV36QualitySelectionLatest },
    { stage: "V35", title: "Natural Home V35 balanced water detail", latest: naturalHomeV35QualitySelectionLatest },
    { stage: "V34", title: "Natural Home V34 water stability", latest: naturalHomeV34QualitySelectionLatest },
    { stage: "V33", title: "Natural Home V33 water artifact guard", latest: naturalHomeV33QualitySelectionLatest },
    { stage: "V32", title: "Natural Home V32 PatchGAN refiner", latest: naturalHomeV32QualitySelectionLatest },
    { stage: "V31", title: "Natural Home V31 edge refiner", latest: naturalHomeV31QualitySelectionLatest },
  ])
  const trainingQualityGateSource =
    naturalHomeBestTrainingCandidate?.latest ??
    naturalHomeCandidateConsolidationLatest ??
    naturalHomeWarningFocusLatest ??
    naturalHomeMultisourceLatest
  const trainingQualityGate = trainingQualityGateSource
    ? buildTrainingQualityGateReport(trainingQualityGateSource)
    : null

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    system: await readGpuInfo(),
    dataset: {
      formalSceneSamples: await countDirectories(path.join(process.cwd(), "data", "ai-painter-datasets", "accepted", "dataset_v0", "scene", "world")),
      bootstrapSamples: await countDirectories(path.join(aiPainterRuntimeRoot, "bootstrap-dataset", "accepted", "dataset_v0", "scene", "world")),
      imageSize: "256 x 192",
      conditionChannels: 14,
    },
    model: { name: "AI-PET-WORLD Local Painter", framework: "PyTorch", ownership: "project-owned local model" },
    multiscene: {
      samples: await countDirectories(path.join(aiPainterRuntimeRoot, "multiscene-dataset", "accepted", "dataset_v0", "scene", "world")),
      baseSummary: await readJson(path.join(aiPainterRuntimeRoot, "multiscene-training", "training-summary.json")),
      ganSummary: await readJson(path.join(aiPainterRuntimeRoot, "multiscene-gan-training", "training-summary.json")),
      structuralV2Summary: await readJson(path.join(aiPainterRuntimeRoot, "structural-v2-training", "training-summary.json")),
      structuralV2GanSummary: await readJson(path.join(aiPainterRuntimeRoot, "structural-v2-gan-training", "training-summary.json")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "multiscene-gan-inference", "scene-world-11-e0e7975b.png")),
      structuralV2InferenceReady: await exists(path.join(aiPainterRuntimeRoot, "structural-v2-inference", "scene-world-11-e0e7975b.png")),
      reviewStatus: "failed_visual_quality",
    },
    structureGuided: {
      summary: await readJson(path.join(aiPainterRuntimeRoot, "structure-guided-training", "training-summary.json")),
      latest: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "structure-guided-training", "training-log.jsonl")),
      checkpointReady: await exists(path.join(aiPainterRuntimeRoot, "structure-guided-training", "best.pt")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "structure-guided-inference", "generated.png")),
      structurePreviewReady: await exists(path.join(aiPainterRuntimeRoot, "structure-guided-inference", "structure-preview.png")),
    },
    rgbRefiner: {
      summary: await readJson(path.join(aiPainterRuntimeRoot, "rgb-refiner-training", "training-summary.json")),
      latest: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "rgb-refiner-training", "training-log.jsonl")),
      checkpointReady: await exists(path.join(aiPainterRuntimeRoot, "rgb-refiner-training", "best.pt")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "rgb-refiner-inference", "generated.png")),
    },
    localAssets: {
      dataset: await readJson(path.join(aiPainterRuntimeRoot, "local-asset-dataset", "manifest.json")),
      summary: await readJson(path.join(aiPainterRuntimeRoot, "local-asset-training", "training-summary.json")),
      inference: await readJson(path.join(aiPainterRuntimeRoot, "local-asset-inference", "latest.json")),
      compositeReady: await exists(path.join(aiPainterRuntimeRoot, "local-asset-inference", "composite.png")),
      reviewStatus: "failed_visual_quality",
    },
    discreteAssets: {
      summary: await readJson(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "training-summary.json")),
      inference: await readJson(path.join(aiPainterRuntimeRoot, "discrete-asset-inference", "latest.json")),
      latestByCategory: {
        building: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "building", "training-log.jsonl")),
        tree: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "tree", "training-log.jsonl")),
        road: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "road", "training-log.jsonl")),
        shoreline: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "shoreline", "training-log.jsonl")),
      },
      compositeReady: await exists(path.join(aiPainterRuntimeRoot, "discrete-asset-inference", "composite.png")),
      reviewStatus: "failed_visual_quality",
    },
    componentReadiness: await readJson(path.join(aiPainterRuntimeRoot, "component-instance-dataset", "report.json")),
    trainingExpansion: {
      manifest: await readJson(path.join(aiPainterRuntimeRoot, "multiscene-dataset", "dataset-manifest.json")),
    },
    autonomousTraining: {
      structureSummary: await readJson(path.join(aiPainterRuntimeRoot, "structure-guided-training", "training-summary.json")),
      rgbSummary: await readJson(path.join(aiPainterRuntimeRoot, "rgb-refiner-training", "training-summary.json")),
      localSummary: await readJson(path.join(aiPainterRuntimeRoot, "local-asset-training", "training-summary.json")),
      discreteSummary: await readJson(path.join(aiPainterRuntimeRoot, "discrete-asset-training", "training-summary.json")),
      latestStructure: await readJson(path.join(aiPainterRuntimeRoot, "structure-guided-inference", "latest.json")),
      latestRgb: await exists(path.join(aiPainterRuntimeRoot, "rgb-refiner-inference", "generated.png")),
      latestLocal: await readJson(path.join(aiPainterRuntimeRoot, "local-asset-inference", "latest.json")),
      latestDiscrete: await readJson(path.join(aiPainterRuntimeRoot, "discrete-asset-inference", "latest.json")),
      reviewStatus: "failed_visual_quality",
    },
    mvpGap: await readJson(path.join(aiPainterRuntimeRoot, "mvp-gap-report", "report.json")),
    visualUnitV0: buildVisualUnitV0Status(),
    visualUnitData: await readJson(path.join(process.cwd(), "data", "visual-units", "manifest.json")),
    naturalHomeReadiness: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-readiness", "report.json")),
    naturalHomeQuality: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-quality", "report.json")),
    naturalHomeTraining: {
      datasetManifest: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-dataset", "dataset-manifest.json")),
      cleanDatasetManifest: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-clean-dataset", "dataset-manifest.json")),
      summary: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-training", "training-summary.json")),
      latest: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "natural-home-training", "training-log.jsonl")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-inference", "natural-home-crop-v7-12-forest-stream-clean.png")),
    },
    naturalHomeStructure: {
      summary: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-structure-guided-training", "training-summary.json")),
      latest: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "natural-home-structure-guided-training", "training-log.jsonl")),
      checkpointReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-structure-guided-training", "best.pt")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-structure-guided-inference", "generated.png")),
      structurePreviewReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-structure-guided-inference", "structure-preview.png")),
    },
    naturalHomeRefiner: {
      summary: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-rgb-refiner-training", "training-summary.json")),
      latest: await readLastJsonLine(path.join(aiPainterRuntimeRoot, "natural-home-rgb-refiner-training", "training-log.jsonl")),
      checkpointReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-rgb-refiner-training", "best.pt")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-rgb-refiner-inference", "generated.png")),
      diagnosis: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-rgb-refiner-diagnosis", "report.json")),
      nextTrainingPlan: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-next-training-plan", "plan.json")),
    },
    naturalHomeSourceExpertBank: {
      latest: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v18-source-expert-bank", "latest.json")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v18-source-expert-bank", "contact-sheet.png")),
    },
    naturalHomePromotedSource: {
      latest: await readJson(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v19-promoted-source", "latest.json")),
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v19-promoted-source", "contact-sheet.png")),
    },
    naturalHomeMultisourceGeneralization: {
      latest: naturalHomeMultisourceLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v20-multisource-generalization", "contact-sheet.png")),
    },
    naturalHomeWarningFocus: {
      latest: naturalHomeWarningFocusLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v22-warning-focus", "contact-sheet.png")),
    },
    naturalHomeCandidateConsolidation: {
      latest: naturalHomeCandidateConsolidationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-local-detail-v23-candidate-consolidation", "contact-sheet.png")),
    },
    naturalHomeDiversityGeneration: {
      latest: naturalHomeDiversityGenerationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v24-diversity-generation", "contact-sheet.png")),
    },
    naturalHomeDiversityGeneralization: {
      latest: naturalHomeDiversityGeneralizationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v25-diversity-generation", "contact-sheet.png")),
    },
    naturalHomeDiversityRefiner: {
      latest: naturalHomeDiversityRefinerLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v26-diversity-refiner-generation", "contact-sheet.png")),
    },
    naturalHomeV27AugmentedDiversity: {
      datasetManifest: naturalHomeV27AugmentedDatasetManifest,
      structureSummary: naturalHomeV27StructureSummary,
      refinerSummary: naturalHomeV27RefinerSummary,
      latest: naturalHomeV27DiversityRefinerLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v27-diversity-refiner-generation", "contact-sheet.png")),
    },
    naturalHomeV28RealMaskRemix: {
      datasetManifest: naturalHomeV28RealMaskRemixDatasetManifest,
      structureSummary: naturalHomeV28StructureSummary,
      refinerSummary: naturalHomeV28RefinerSummary,
      latest: naturalHomeV28DiversityRefinerLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v28-diversity-refiner-generation", "contact-sheet.png")),
    },
    naturalHomeV33WaterArtifactGuard: {
      latest: naturalHomeV33QualitySelectionLatest ?? naturalHomeV33WaterArtifactGuardLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v33-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV34WaterStability: {
      latest: naturalHomeV34QualitySelectionLatest ?? naturalHomeV34WaterStabilityLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v34-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV35BalancedWaterDetail: {
      latest: naturalHomeV35QualitySelectionLatest ?? naturalHomeV35BalancedWaterDetailLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v35-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV36BalancedGeneralization: {
      latest: naturalHomeV36QualitySelectionLatest ?? naturalHomeV36BalancedGeneralizationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v36-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV37WaterFailureRepair: {
      latest: naturalHomeV37QualitySelectionLatest ?? naturalHomeV37WaterFailureRepairLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v37-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV38WaterEdgeBalance: {
      latest: naturalHomeV38QualitySelectionLatest ?? naturalHomeV38WaterEdgeBalanceLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v38-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV39FailureFocusRepair: {
      datasetManifest: naturalHomeV39FailureFocusDatasetManifest,
      trainingSummary: naturalHomeV39FailureFocusTrainingSummary,
      trainingLatest: naturalHomeV39FailureFocusTrainingLatest,
      latest: naturalHomeV39QualitySelectionLatest ?? naturalHomeV39FailureFocusRepairLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v39-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV40SharpnessLockRepair: {
      trainingSummary: naturalHomeV40SharpnessLockTrainingSummary,
      trainingLatest: naturalHomeV40SharpnessLockTrainingLatest,
      latest: naturalHomeV40QualitySelectionLatest ?? naturalHomeV40SharpnessLockRepairLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v40-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV41V32WaterRescue: {
      trainingSummary: naturalHomeV41V32WaterRescueTrainingSummary,
      trainingLatest: naturalHomeV41V32WaterRescueTrainingLatest,
      latest: naturalHomeV41QualitySelectionLatest ?? naturalHomeV41V32WaterRescueLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v41-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV42WaterExpertFix: {
      latest: naturalHomeV42QualitySelectionLatest ?? naturalHomeV42WaterExpertFixLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v42-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV43V32FailureFocusRepair: {
      datasetManifest: naturalHomeV43FailureFocusDatasetManifest,
      trainingSummary: naturalHomeV43FailureFocusTrainingSummary,
      trainingLatest: naturalHomeV43FailureFocusTrainingLatest,
      latest: naturalHomeV43QualitySelectionLatest ?? naturalHomeV43FailureFocusRepairLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v43-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV44V32StableGeneralization: {
      trainingSummary: naturalHomeV44StableGeneralizationTrainingSummary,
      trainingLatest: naturalHomeV44StableGeneralizationTrainingLatest,
      latest: naturalHomeV44QualitySelectionLatest ?? naturalHomeV44StableGeneralizationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v44-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV45Generalization: {
      datasetManifest: naturalHomeV45GeneralizationDatasetManifest,
      trainingSummary: naturalHomeV45GeneralizationTrainingSummary,
      trainingLatest: naturalHomeV45GeneralizationTrainingLatest,
      latest: naturalHomeV45QualitySelectionLatest ?? naturalHomeV45GeneralizationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v45-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV46V45FailureFocusRepair: {
      datasetManifest: naturalHomeV46FailureFocusDatasetManifest,
      trainingSummary: naturalHomeV46FailureFocusTrainingSummary,
      trainingLatest: naturalHomeV46FailureFocusTrainingLatest,
      latest: naturalHomeV46QualitySelectionLatest ?? naturalHomeV46FailureFocusRepairLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v46-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV47HardFailureStabilization: {
      datasetManifest: naturalHomeV47HardFailureDatasetManifest,
      trainingSummary: naturalHomeV47HardFailureTrainingSummary,
      trainingLatest: naturalHomeV47HardFailureTrainingLatest,
      latest: naturalHomeV47QualitySelectionLatest ?? naturalHomeV47HardFailureGenerationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v47-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV48SplitExpertMergeGate: {
      repairLatest: naturalHomeV48RepairQualitySelectionLatest ?? naturalHomeV48WaterSharpnessExpertFixLatest,
      latest: naturalHomeV48MergeGateSelectionLatest ?? naturalHomeV48RepairQualitySelectionLatest ?? naturalHomeV48WaterSharpnessExpertFixLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v48-merge-gate-selection", "contact-sheet.png")),
    },
    naturalHomeV49V32DiversitySweep: {
      latest: naturalHomeV49QualitySelectionLatest ?? naturalHomeV49V32DiversitySweepGenerationLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v49-quality-selection", "contact-sheet.png")),
    },
    naturalHomeV50DiversityWaterGate: {
      latest: naturalHomeV50DiversityWaterGateLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v50-diversity-water-gate", "contact-sheet.png")),
    },
    naturalHomeV51SafeCandidatePack: {
      latest: naturalHomeV51SafeCandidatePackLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v51-safe-candidate-pack", "contact-sheet.png")),
    },
    naturalHomeV87QualityLedger: {
      latest: naturalHomeV87QualityLedgerLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v87-quality-ledger", "contact-sheet.png")),
    },
    naturalHomeV88QualityAllowlistDataset: {
      latest: naturalHomeV88QualityAllowlistDatasetLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v88-quality-allowlist-dataset", "contact-sheet.png")),
    },
    naturalHomeV89QualityAllowlistTraining: {
      trainingSummary: naturalHomeV89QualityAllowlistTrainingSummary,
      trainingLatest: naturalHomeV89QualityAllowlistTrainingLatest,
      latest: naturalHomeV89QualitySelectionLatest,
      inferenceReady: await exists(path.join(aiPainterRuntimeRoot, "natural-home-v89-quality-selection", "contact-sheet.png")),
    },
    naturalHomeBestTrainingCandidate,
    trainingQualityGate,
    control,
    resourceUsage: await readResourceUsageLedger(),
    logs: await readTrainingLogTail(),
    training: {
      status: control.status === "running" ? "running" : summary?.status === "completed" ? "completed" : "not_started",
      epoch,
      targetEpochs: 120,
      percent: Math.min(100, Math.round((epoch / 120) * 100)),
      loss: latest?.trainLoss ?? summary?.bestSelectionLoss ?? null,
      device: latest?.device ?? summary?.device ?? "等待训练",
      checkpointReady,
      inferenceReady,
    },
  })
}

async function readGpuInfo() {
  try {
    const { stdout } = await execFileAsync("nvidia-smi", [
      "--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu,driver_version",
      "--format=csv,noheader,nounits",
    ], { windowsHide: true, timeout: 5000 })
    const [name, memoryTotal, memoryUsed, utilization, temperature, driver] = stdout.trim().split(",").map((value) => value.trim())
    return { gpuAvailable: true, name, memoryTotalMiB: Number(memoryTotal), memoryUsedMiB: Number(memoryUsed), utilizationPercent: Number(utilization), temperatureCelsius: Number(temperature), driver }
  } catch {
    return { gpuAvailable: false, name: "未检测到 NVIDIA GPU", memoryTotalMiB: 0, memoryUsedMiB: 0, utilizationPercent: 0, temperatureCelsius: 0, driver: "--" }
  }
}

async function countDirectories(directory: string) {
  try {
    return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).length
  } catch {
    return 0
  }
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

async function readLastJsonLine(file: string): Promise<Record<string, unknown> | null> {
  try {
    const lines = (await readFile(file, "utf8")).trim().split(/\r?\n/)
    return lines.length ? JSON.parse(lines.at(-1)!) as Record<string, unknown> : null
  } catch {
    return null
  }
}

type TrainingQualityCandidate = {
  stage: string
  title: string
  latest: Record<string, unknown> | null
}

function selectBestTrainingQualityCandidate(candidates: TrainingQualityCandidate[]) {
  const ranked = candidates
    .filter((candidate): candidate is TrainingQualityCandidate & { latest: Record<string, unknown> } => Boolean(candidate.latest))
    .map((candidate) => ({ ...candidate, summary: qualitySummary(candidate.latest) }))
    .sort((left, right) => {
      const scoreDiff = right.summary.averageScore - left.summary.averageScore
      if (scoreDiff !== 0) return scoreDiff
      const passRateDiff = passRate(right.summary) - passRate(left.summary)
      if (passRateDiff !== 0) return passRateDiff
      const rejectedDiff = rejectedRate(left.summary) - rejectedRate(right.summary)
      if (rejectedDiff !== 0) return rejectedDiff
      return right.summary.passedForNextTraining - left.summary.passedForNextTraining
    })

  const best = ranked[0]
  if (!best) return null
  return {
    stage: best.stage,
    title: best.title,
    latest: best.latest,
    summary: best.summary,
  }
}

function qualitySummary(latest: Record<string, unknown>) {
  const summary = isRecord(latest.summary) ? latest.summary : {}
  const rows = Array.isArray(latest.rows) ? latest.rows.filter(isRecord) : []
  const passedForNextTraining = numberValue(summary.passedForNextTraining) ?? countRows(rows, "passed_for_next_training")
  const reviewCandidate = numberValue(summary.reviewCandidate) ?? countRows(rows, "review_candidate")
  const rejectedTrainingCandidate = numberValue(summary.rejectedTrainingCandidate) ?? countRows(rows, "rejected_training_candidate")
  const rowCount = numberValue(summary.rowCount) ?? rows.length
  const averageScore =
    numberValue(summary.averageScore) ??
    (rows.length
      ? rows.reduce((total, row) => total + (numberValue(row.score) ?? 0), 0) / rows.length
      : 0)
  return {
    rowCount,
    passedForNextTraining,
    reviewCandidate,
    rejectedTrainingCandidate,
    averageScore,
    bestScore: numberValue(summary.bestScore),
    worstScore: numberValue(summary.worstScore),
  }
}

function countRows(rows: Record<string, unknown>[], status: string) {
  return rows.filter((row) => row.status === status).length
}

function passRate(summary: ReturnType<typeof qualitySummary>) {
  return summary.rowCount > 0 ? summary.passedForNextTraining / summary.rowCount : 0
}

function rejectedRate(summary: ReturnType<typeof qualitySummary>) {
  return summary.rowCount > 0 ? summary.rejectedTrainingCandidate / summary.rowCount : 1
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

async function exists(file: string) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

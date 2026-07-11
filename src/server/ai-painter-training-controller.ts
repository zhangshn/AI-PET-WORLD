import { spawn } from "node:child_process"
import { appendFile, cp, mkdir, rm, stat, writeFile } from "node:fs/promises"
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import { startResourceUsageSession } from "./ai-painter-resource-usage"
import { archiveTrainingResult } from "./ai-painter-training-result-archive"
import { tryPromoteTrainingResultToWorldVisual } from "./ai-painter-training-world-promotion"
import {
  aiPainterRuntimeRoot,
  appendTrainingProcessEvent,
  readTrainingControlState,
  readTrainingLogTail,
  trainingControlDir,
  trainingControlLogPath,
  writeTrainingControlState,
  writeTrainingRuntimeHeartbeat,
  type TrainingControlState,
  type TrainingRuntimeHeartbeatStatus,
} from "./ai-painter-training-state"

export type TrainingAction =
  | "prepare_natural_home"
  | "train_natural_home"
  | "infer_natural_home"
  | "train_natural_home_structure_guided"
  | "infer_natural_home_structure_guided"
  | "train_natural_home_rgb_refiner"
  | "infer_natural_home_rgb_refiner"
  | "full_natural_home"
  | "full_natural_home_structure_guided"
  | "full_natural_home_rgb_refiner"
  | "full_natural_home_v18_source_expert_bank"
  | "full_natural_home_v19_promoted_source"
  | "full_natural_home_v20_multisource_generalization"
  | "full_natural_home_v22_warning_focus"
  | "full_natural_home_v23_candidate_consolidation"
  | "full_natural_home_v24_diversity_generation"
  | "full_natural_home_v25_diversity_generalization"
  | "full_natural_home_v28_real_mask_remix"
  | "full_natural_home_v31_edge_refiner"
  | "full_natural_home_v32_patchgan_refiner"
  | "full_natural_home_v33_water_artifact_guard"
  | "full_natural_home_v34_water_stability"
  | "full_natural_home_v35_balanced_water_detail"
  | "full_natural_home_v36_balanced_generalization"
  | "full_natural_home_v37_water_failure_repair"
  | "full_natural_home_v38_water_edge_balance"
  | "full_natural_home_v39_failure_focus_repair"
  | "full_natural_home_v40_sharpness_lock_repair"
  | "full_natural_home_v41_v32_water_rescue"
  | "full_natural_home_v42_water_expert_fix"
  | "full_natural_home_v43_v32_failure_focus_repair"
  | "full_natural_home_v44_v32_stable_generalization"
  | "full_natural_home_v45_generalization"
  | "full_natural_home_v46_v45_failure_focus_repair"
  | "full_natural_home_v47_hard_failure_stabilization"
  | "full_natural_home_v48_split_expert_merge_gate"
  | "full_natural_home_v49_v32_diversity_sweep"
  | "full_natural_home_v50_diversity_water_gate"
  | "full_natural_home_v51_safe_candidate_pack"
  | "full_natural_home_v80_quality_preserving_water_repair"
  | "full_natural_home_v81_high_score_diversity_distillation"
  | "full_natural_home_v82_broad_structure_coverage"
  | "full_natural_home_v83_water_failure_repair"
  | "full_natural_home_v84_v82_safe_quality_continuation"
  | "full_natural_home_v85_v82_wide_variant_sweep"
  | "full_natural_home_v86_wide_candidate_distillation"
  | "full_natural_home_v87_quality_ledger"
  | "full_natural_home_v88_quality_allowlist_dataset"
  | "full_natural_home_v89_quality_allowlist_training"
  | "full_natural_home_v96_clean_multilayout"
  | "full_natural_home_v97_edge_boundary_repair"
  | "full_natural_home_v98_vj1_signal_repair"
  | "full_natural_home_v99_vj1_boundary_similarity_repair"
  | "prepare"
  | "train"
  | "infer"
  | "full"
  | "prepare_multiscene"
  | "train_multiscene"
  | "train_multiscene_gan"
  | "infer_multiscene"
  | "full_multiscene"
  | "train_structure_guided"
  | "infer_structure_guided"
  | "full_structure_guided"
  | "train_rgb_refiner"
  | "infer_rgb_refiner"
  | "full_rgb_refiner"
  | "prepare_local_assets"
  | "train_local_assets"
  | "infer_local_assets"
  | "full_local_assets"
  | "prepare_discrete_assets"
  | "train_discrete_assets"
  | "infer_discrete_assets"
  | "full_discrete_assets"
  | "prepare_component_instances"
  | "prepare_training_expansion"
  | "full_autonomous_training"
  | "report_mvp_gap"
  | "report_natural_home"
  | "report_natural_home_quality"
  | "full_game_map_material_slot_v46_runtime_frame"

export { readTrainingControlState, readTrainingLogTail, type TrainingControlState }

let activeRun: Promise<void> | null = null
const preClearArchiveRoot = path.join(/* turbopackIgnore: true */ aiPainterRuntimeRoot, "training-run-history", "pre-clear")
const trainingProcessLockPath = path.join(/* turbopackIgnore: true */ trainingControlDir, "training-process.lock")
const heartbeatIntervalMs = 25_000

export async function startTrainingAction(action: TrainingAction) {
  if (activeRun) {
    throw new Error("已有本地训练任务正在运行，请等待完成。")
  }
  const releaseProcessLock = acquireTrainingProcessLock(action)

  try {
    const persistedState = await readTrainingControlState()
    if (persistedState.status === "running" && isProcessAlive(persistedState.childPid)) {
      throw new Error("已有本地训练任务正在运行，请等待完成。")
    }

    await mkdir(trainingControlDir, { recursive: true })
    await writeFile(trainingControlLogPath, "", "utf8")

    const state: TrainingControlState = {
      status: "running",
      action,
      currentStep: "准备执行",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      controllerPid: process.pid,
      childPid: null,
    }

    await writeTrainingControlState(state)
    const resourceSession = await startResourceUsageSession(action)
    await writeTrainingRuntimeHeartbeat({
      status: "dataset_building",
      activeTaskId: resourceSession.sessionId,
      activeAction: action,
      activeModelRole: modelRoleForAction(action),
      activeStep: state.currentStep,
      lastOutputRef: trainingControlLogPath,
    })
    await appendTrainingProcessEvent({
      action,
      runId: resourceSession.sessionId,
      kind: "run_started",
      status: "running",
      title: "Training run started",
      detail: "The local AI Painter controller accepted the training action.",
      currentStep: state.currentStep ?? undefined,
      resourceSessionId: resourceSession.sessionId,
    })
    activeRun = runAction(action, state, resourceSession).finally(() => {
      activeRun = null
      releaseProcessLock()
    })
    return state
  } catch (error) {
    releaseProcessLock()
    throw error
  }
}

function acquireTrainingProcessLock(action: TrainingAction): () => void {
  mkdirSync(trainingControlDir, { recursive: true })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(trainingProcessLockPath, "wx")
      writeFileSync(fd, JSON.stringify({ controllerPid: process.pid, action, acquiredAt: new Date().toISOString() }), "utf8")
      closeSync(fd)
      let released = false
      return () => {
        if (released) return
        released = true
        try { unlinkSync(trainingProcessLockPath) } catch {}
      }
    } catch (error) {
      const lock = readTrainingProcessLock()
      if (attempt === 0 && lock && !isProcessAlive(lock.controllerPid)) {
        try { unlinkSync(trainingProcessLockPath) } catch {}
        continue
      }
      throw new Error("已有本地训练任务持有跨进程运行锁，请等待完成。", { cause: error })
    }
  }
  throw new Error("无法获取本地训练跨进程运行锁。")
}

function readTrainingProcessLock(): { controllerPid: number } | null {
  try {
    const value = JSON.parse(readFileSync(trainingProcessLockPath, "utf8"))
    return typeof value?.controllerPid === "number" ? value : null
  } catch {
    return null
  }
}

async function runAction(
  action: TrainingAction,
  state: TrainingControlState,
  resourceSession: Awaited<ReturnType<typeof startResourceUsageSession>>,
) {
  const runId = resourceSession.sessionId
  let currentScript: string | null = null
  try {
    await clearOutputs(action)
    for (const script of scriptsFor(action)) {
      currentScript = script
      state.currentStep = labelFor(script)
      await writeTrainingControlState(state)
      await writeTrainingRuntimeHeartbeat({
        status: heartbeatStatusForScript(script),
        activeTaskId: runId,
        activeAction: action,
        activeModelRole: modelRoleForScript(script),
        activeStep: state.currentStep,
        activeScript: script,
        lastOutputRef: trainingControlLogPath,
        childPid: state.childPid,
      })
      await appendFile(trainingControlLogPath, `\n[${new Date().toISOString()}] ${state.currentStep}\n`, "utf8")
      await appendTrainingProcessEvent({
        action,
        runId,
        kind: "step_started",
        status: "running",
        title: "Training step started",
        detail: state.currentStep,
        script,
        currentStep: state.currentStep ?? undefined,
        resourceSessionId: resourceSession.sessionId,
      })
      const childRun = startNpmScript(script)
      state.childPid = childRun.pid
      await writeTrainingControlState(state)
      const writeActiveHeartbeat = () => writeTrainingRuntimeHeartbeat({
        status: heartbeatStatusForScript(script),
        activeTaskId: runId,
        activeAction: action,
        activeModelRole: modelRoleForScript(script),
        activeStep: state.currentStep,
        activeScript: script,
        lastOutputRef: trainingControlLogPath,
        childPid: state.childPid,
      })
      await writeActiveHeartbeat()
      const stopHeartbeat = startPeriodicHeartbeat(writeActiveHeartbeat)
      try {
        await childRun.completion
      } finally {
        await stopHeartbeat()
        state.childPid = null
        await writeTrainingControlState(state)
      }
      await writeTrainingRuntimeHeartbeat({
        status: heartbeatStatusForScript(script),
        activeTaskId: runId,
        activeAction: action,
        activeModelRole: modelRoleForScript(script),
        activeStep: `${state.currentStep} completed`,
        activeScript: script,
        lastOutputRef: trainingControlLogPath,
        childPid: null,
      })
      await appendTrainingProcessEvent({
        action,
        runId,
        kind: "step_completed",
        status: "success",
        title: "Training step completed",
        detail: state.currentStep,
        script,
        currentStep: state.currentStep ?? undefined,
        resourceSessionId: resourceSession.sessionId,
      })
    }
    state.status = "completed"
    await writeTrainingRuntimeHeartbeat({
      status: "completed_round",
      activeTaskId: runId,
      activeAction: action,
      activeModelRole: modelRoleForAction(action),
      activeStep: "completed",
      activeScript: currentScript,
      lastOutputRef: trainingControlLogPath,
    })
    state.currentStep = "全部完成"
    await appendTrainingProcessEvent({
      action,
      runId,
      kind: "run_completed",
      status: "success",
      title: "Training run completed",
      detail: "All local AI Painter scripts finished.",
      currentStep: state.currentStep ?? undefined,
      resourceSessionId: resourceSession.sessionId,
    })
  } catch (error) {
    state.status = "failed"
    await writeTrainingRuntimeHeartbeat({
      status: "blocked",
      activeTaskId: runId,
      activeAction: action,
      activeModelRole: currentScript ? modelRoleForScript(currentScript) : modelRoleForAction(action),
      activeStep: state.currentStep ?? currentScript,
      activeScript: currentScript,
      lastOutputRef: trainingControlLogPath,
    })
    state.error = error instanceof Error ? error.message : "本地任务执行失败"
    if (currentScript) {
      await appendTrainingProcessEvent({
        action,
        runId,
        kind: "step_failed",
        status: "failed",
        title: "Training step failed",
        detail: state.currentStep ?? currentScript,
        script: currentScript,
        currentStep: state.currentStep ?? undefined,
        error: state.error,
        resourceSessionId: resourceSession.sessionId,
      })
    }
    await appendTrainingProcessEvent({
      action,
      runId,
      kind: "run_failed",
      status: "failed",
      title: "Training run failed",
      detail: "The local AI Painter controller stopped this action after an error.",
      currentStep: state.currentStep ?? undefined,
      error: state.error,
      resourceSessionId: resourceSession.sessionId,
    })
    await appendFile(trainingControlLogPath, `\nERROR: ${state.error}\n`, "utf8")
  } finally {
    state.childPid = null
    state.finishedAt = new Date().toISOString()
    await writeTrainingControlState(state)
    await writeTrainingRuntimeHeartbeat({
      status: state.status === "failed" ? "blocked" : "backwriting",
      activeTaskId: runId,
      activeAction: action,
      activeModelRole: currentScript ? modelRoleForScript(currentScript) : modelRoleForAction(action),
      activeStep: "finalizing resource usage, archive, and promotion evidence",
      activeScript: currentScript,
      lastOutputRef: trainingControlLogPath,
    })

    const resourceSummary = await resourceSession.finish({
      status: state.status === "failed" ? "failed" : "completed",
      error: state.error,
    })

    try {
      const archived = await archiveTrainingResult({ action, resourceSummary })
      await appendTrainingProcessEvent({
        action,
        runId,
        kind: archived ? "archive_completed" : "archive_skipped",
        status: archived ? "success" : "info",
        title: archived ? "Training result archived" : "No generated result to archive",
        detail: archived
          ? "Generated rows, summaries, failure data, and resource usage were retained."
          : "Resource usage was retained, but no generated result was found for this action.",
        resourceSessionId: resourceSession.sessionId,
        archiveId: archived?.id,
      })
      await appendFile(
        trainingControlLogPath,
        archived
          ? `\n[${new Date().toISOString()}] 已自动归档训练结果：${archived.id}\n`
          : `\n[${new Date().toISOString()}] 未找到可归档的训练图；资源账本已保存。\n`,
        "utf8",
      )
    } catch (archiveError) {
      await appendTrainingProcessEvent({
        action,
        runId,
        kind: "archive_failed",
        status: "error",
        title: "Training result archive failed",
        detail: "The run finished, but automatic result retention hit an error.",
        error: archiveError instanceof Error ? archiveError.message : "Training result archive failed.",
        resourceSessionId: resourceSession.sessionId,
      })
      const message = archiveError instanceof Error ? archiveError.message : "训练结果自动归档失败"
      await appendFile(trainingControlLogPath, `\n[${new Date().toISOString()}] 训练结果自动归档失败：${message}\n`, "utf8")
    }

    if (state.status !== "failed") {
      try {
        const promotion = await tryPromoteTrainingResultToWorldVisual({ action })
        await appendTrainingProcessEvent({
          action,
          runId,
          kind: "promotion_completed",
          status: promotion.ok ? "success" : promotion.attempted ? "blocked" : "info",
          title: promotion.ok ? "World visual promotion completed" : "World visual promotion not applied",
          detail: `${promotion.status}: ${promotion.message}`,
          resourceSessionId: resourceSession.sessionId,
        })
        await appendFile(
          trainingControlLogPath,
          `\n[${new Date().toISOString()}] 世界视觉自动晋级：${promotion.status}，${promotion.message}\n`,
          "utf8",
        )
      } catch (promotionError) {
        await appendTrainingProcessEvent({
          action,
          runId,
          kind: "promotion_failed",
          status: "error",
          title: "World visual promotion failed",
          detail: "The run finished, but the world visual promotion bridge hit an error.",
          error: promotionError instanceof Error ? promotionError.message : "World visual promotion failed.",
          resourceSessionId: resourceSession.sessionId,
        })
        const message = promotionError instanceof Error ? promotionError.message : "世界视觉自动晋级失败"
        await appendFile(trainingControlLogPath, `\n[${new Date().toISOString()}] 世界视觉自动晋级失败：${message}\n`, "utf8")
      }
    }
    await writeTrainingRuntimeHeartbeat({
      status: state.status === "failed" ? "blocked" : "completed_round",
      activeTaskId: runId,
      activeAction: action,
      activeModelRole: currentScript ? modelRoleForScript(currentScript) : modelRoleForAction(action),
      activeStep: state.currentStep,
      activeScript: currentScript,
      lastOutputRef: trainingControlLogPath,
    })
  }
}

function heartbeatStatusForScript(script: string): TrainingRuntimeHeartbeatStatus {
  const normalized = script.toLowerCase()
  if (/prepare|dataset|pack/.test(normalized)) return "dataset_building"
  if (/train|assemble/.test(normalized)) return "training"
  if (/infer|generate|fix|merge|compose/.test(normalized)) return "inferencing"
  if (/review|judge|audit|select|check/.test(normalized)) return "reviewing"
  if (/diagnos/.test(normalized)) return "diagnosing"
  if (/plan|report|ledger|archive|write/.test(normalized)) return "backwriting"
  return "training"
}

function modelRoleForAction(action: TrainingAction) {
  return action.includes("game_map") ? "complete_game_map" : "natural_home"
}

function modelRoleForScript(script: string) {
  const normalized = script.toLowerCase()
  if (/game-map|world|runtime-frame|material-slot/.test(normalized)) return "complete_game_map"
  if (/visual|judge|review|audit|select/.test(normalized)) return "visual_judge"
  if (/natural-home/.test(normalized)) return "natural_home"
  return "ai_painter"
}

const fullActionScripts: Partial<Record<TrainingAction, string[]>> = {
  full_natural_home: ["prepare:ai-painter-natural-home", "train:ai-painter-natural-home", "infer:ai-painter-natural-home"],
  full_natural_home_structure_guided: ["train:ai-painter-natural-home-structure-guided", "infer:ai-painter-natural-home-structure-guided"],
  full_natural_home_rgb_refiner: [
    "train:ai-painter-natural-home-rgb-refiner",
    "infer:ai-painter-natural-home-rgb-refiner",
    "diagnose:ai-painter-natural-home-rgb-refiner",
    "plan:ai-painter-natural-home-rgb-refiner",
  ],
  full_natural_home_v18_source_expert_bank: ["train:ai-painter-natural-home-local-details-v18-source-expert-bank"],
  full_natural_home_v19_promoted_source: ["train:ai-painter-natural-home-local-details-v19-promoted-source"],
  full_natural_home_v20_multisource_generalization: ["train:ai-painter-natural-home-local-details-v20-multisource-generalization"],
  full_natural_home_v22_warning_focus: ["train:ai-painter-natural-home-local-details-v22-warning-focus"],
  full_natural_home_v23_candidate_consolidation: ["train:ai-painter-natural-home-local-details-v23-candidate-consolidation"],
  full_natural_home_v24_diversity_generation: ["generate:ai-painter-natural-home-v24-diversity"],
  full_natural_home_v25_diversity_generalization: [
    "prepare:ai-painter-natural-home-local-details-v25-diversity-generalization",
    "train:ai-painter-natural-home-local-details-v25-diversity-generalization",
    "generate:ai-painter-natural-home-v25-diversity",
  ],
  full_natural_home_v28_real_mask_remix: [
    "prepare:ai-painter-natural-home-v28-real-mask-remix",
    "train:ai-painter-natural-home-v28-structure",
    "train:ai-painter-natural-home-v28-refiner",
    "generate:ai-painter-natural-home-v28-diversity-refiner",
  ],
  full_natural_home_v31_edge_refiner: [
    "train:ai-painter-natural-home-v31-edge-refiner",
    "generate:ai-painter-natural-home-v31-edge-refiner",
    "select:ai-painter-natural-home-v31-quality",
  ],
  full_natural_home_v32_patchgan_refiner: [
    "train:ai-painter-natural-home-v32-patchgan-refiner",
    "generate:ai-painter-natural-home-v32-patchgan-refiner",
    "select:ai-painter-natural-home-v32-quality",
  ],
  full_natural_home_v33_water_artifact_guard: [
    "train:ai-painter-natural-home-v33-water-artifact-guard",
    "generate:ai-painter-natural-home-v33-water-artifact-guard",
    "select:ai-painter-natural-home-v33-quality",
  ],
  full_natural_home_v34_water_stability: [
    "train:ai-painter-natural-home-v34-water-stability",
    "generate:ai-painter-natural-home-v34-water-stability",
    "select:ai-painter-natural-home-v34-quality",
  ],
  full_natural_home_v35_balanced_water_detail: [
    "train:ai-painter-natural-home-v35-balanced-water-detail",
    "generate:ai-painter-natural-home-v35-balanced-water-detail",
    "select:ai-painter-natural-home-v35-quality",
  ],
  full_natural_home_v36_balanced_generalization: [
    "train:ai-painter-natural-home-v36-balanced-generalization",
    "generate:ai-painter-natural-home-v36-balanced-generalization",
    "select:ai-painter-natural-home-v36-quality",
  ],
  full_natural_home_v37_water_failure_repair: [
    "train:ai-painter-natural-home-v37-water-failure-repair",
    "generate:ai-painter-natural-home-v37-water-failure-repair",
    "select:ai-painter-natural-home-v37-quality",
  ],
  full_natural_home_v38_water_edge_balance: [
    "train:ai-painter-natural-home-v38-water-edge-balance",
    "generate:ai-painter-natural-home-v38-water-edge-balance",
    "select:ai-painter-natural-home-v38-quality",
  ],
  full_natural_home_v39_failure_focus_repair: [
    "prepare:ai-painter-natural-home-v39-failure-focus",
    "train:ai-painter-natural-home-v39-failure-focus-repair",
    "generate:ai-painter-natural-home-v39-failure-focus-repair",
    "select:ai-painter-natural-home-v39-quality",
  ],
  full_natural_home_v40_sharpness_lock_repair: [
    "train:ai-painter-natural-home-v40-sharpness-lock-repair",
    "generate:ai-painter-natural-home-v40-sharpness-lock-repair",
    "select:ai-painter-natural-home-v40-quality",
  ],
  full_natural_home_v41_v32_water_rescue: [
    "train:ai-painter-natural-home-v41-v32-water-rescue",
    "generate:ai-painter-natural-home-v41-v32-water-rescue",
    "select:ai-painter-natural-home-v41-quality",
  ],
  full_natural_home_v42_water_expert_fix: [
    "fix:ai-painter-natural-home-v42-water-expert",
    "select:ai-painter-natural-home-v42-quality",
  ],
  full_natural_home_v43_v32_failure_focus_repair: [
    "prepare:ai-painter-natural-home-v43-v32-failure-focus",
    "train:ai-painter-natural-home-v43-v32-failure-focus-repair",
    "generate:ai-painter-natural-home-v43-v32-failure-focus-repair",
    "select:ai-painter-natural-home-v43-quality",
  ],
  full_natural_home_v44_v32_stable_generalization: [
    "train:ai-painter-natural-home-v44-v32-stable-generalization",
    "generate:ai-painter-natural-home-v44-v32-stable-generalization",
    "select:ai-painter-natural-home-v44-quality",
  ],
  full_natural_home_v45_generalization: [
    "prepare:ai-painter-natural-home-v45-generalization-dataset",
    "train:ai-painter-natural-home-v45-generalization",
    "generate:ai-painter-natural-home-v45-generalization",
    "select:ai-painter-natural-home-v45-quality",
  ],
  full_natural_home_v46_v45_failure_focus_repair: [
    "prepare:ai-painter-natural-home-v46-v45-failure-focus",
    "train:ai-painter-natural-home-v46-v45-failure-focus-repair",
    "generate:ai-painter-natural-home-v46-v45-failure-focus-repair",
    "select:ai-painter-natural-home-v46-quality",
  ],
  full_natural_home_v47_hard_failure_stabilization: [
    "prepare:ai-painter-natural-home-v47-hard-failure-stabilization",
    "train:ai-painter-natural-home-v47-hard-failure-stabilization",
    "generate:ai-painter-natural-home-v47-hard-failure-stabilization",
    "select:ai-painter-natural-home-v47-quality",
  ],
  full_natural_home_v48_split_expert_merge_gate: [
    "fix:ai-painter-natural-home-v48-water-sharpness-expert",
    "select:ai-painter-natural-home-v48-repair-quality",
    "merge:ai-painter-natural-home-v48-merge-gate",
  ],
  full_natural_home_v49_v32_diversity_sweep: [
    "generate:ai-painter-natural-home-v49-v32-diversity-sweep",
    "select:ai-painter-natural-home-v49-quality",
  ],
  full_natural_home_v50_diversity_water_gate: [
    "audit:ai-painter-natural-home-v50-diversity-gate",
  ],
  full_natural_home_v51_safe_candidate_pack: [
    "pack:ai-painter-natural-home-v51-safe-candidates",
  ],
  full_natural_home_v80_quality_preserving_water_repair: [
    "prepare:ai-painter-natural-home-v80-quality-preserving-water-repair",
    "train:ai-painter-natural-home-v80-quality-preserving-water-repair",
    "generate:ai-painter-natural-home-v80-quality-preserving-water-repair",
    "select:ai-painter-natural-home-v80-quality",
  ],
  full_natural_home_v81_high_score_diversity_distillation: [
    "prepare:ai-painter-natural-home-v81-high-score-diversity-distillation",
    "train:ai-painter-natural-home-v81-high-score-diversity-distillation",
    "generate:ai-painter-natural-home-v81-high-score-diversity-distillation",
    "select:ai-painter-natural-home-v81-quality",
  ],
  full_natural_home_v82_broad_structure_coverage: [
    "prepare:ai-painter-natural-home-v82-broad-structure-coverage",
    "train:ai-painter-natural-home-v82-broad-structure-coverage",
    "generate:ai-painter-natural-home-v82-broad-structure-coverage",
    "select:ai-painter-natural-home-v82-quality",
  ],
  full_natural_home_v83_water_failure_repair: [
    "prepare:ai-painter-natural-home-v83-water-failure-repair",
    "train:ai-painter-natural-home-v83-water-failure-repair",
    "generate:ai-painter-natural-home-v83-water-failure-repair",
    "select:ai-painter-natural-home-v83-quality",
  ],
  full_natural_home_v84_v82_safe_quality_continuation: [
    "prepare:ai-painter-natural-home-v84-v82-safe-quality-continuation",
    "train:ai-painter-natural-home-v84-v82-safe-quality-continuation",
    "generate:ai-painter-natural-home-v84-v82-safe-quality-continuation",
    "select:ai-painter-natural-home-v84-quality",
  ],
  full_natural_home_v85_v82_wide_variant_sweep: [
    "generate:ai-painter-natural-home-v85-v82-wide-variant-sweep",
    "select:ai-painter-natural-home-v85-quality",
  ],
  full_natural_home_v86_wide_candidate_distillation: [
    "prepare:ai-painter-natural-home-v86-wide-candidate-distillation",
    "train:ai-painter-natural-home-v86-wide-candidate-distillation",
    "generate:ai-painter-natural-home-v86-wide-candidate-distillation",
    "select:ai-painter-natural-home-v86-quality",
  ],
  full_natural_home_v87_quality_ledger: [
    "gate:ai-painter-natural-home-v87-quality-ledger",
  ],
  full_natural_home_v88_quality_allowlist_dataset: [
    "prepare:ai-painter-natural-home-v88-quality-allowlist",
  ],
  full_natural_home_v89_quality_allowlist_training: [
    "train:ai-painter-natural-home-v89-quality-allowlist",
    "generate:ai-painter-natural-home-v89-quality-allowlist",
    "select:ai-painter-natural-home-v89-quality",
  ],
  full_natural_home_v96_clean_multilayout: [
    "prepare:ai-painter-natural-home-v96-clean-multilayout",
    "check:ai-painter-natural-home-v96-clean-multilayout",
    "train:ai-painter-natural-home-v96-clean-multilayout",
    "generate:ai-painter-natural-home-v96-clean-multilayout",
    "select:ai-painter-natural-home-v96-clean-multilayout-quality",
    "judge:ai-painter-natural-home-v96-clean-multilayout-vj1",
    "check:ai-painter-natural-home-v96-clean-multilayout-vj1",
    "judge:ai-painter-natural-home-v96-clean-multilayout-vj2",
    "check:ai-painter-natural-home-v96-clean-multilayout-vj2",
  ],
  full_natural_home_v97_edge_boundary_repair: [
    "prepare:ai-painter-natural-home-v97-edge-boundary-repair",
    "check:ai-painter-natural-home-v97-edge-boundary-repair",
    "train:ai-painter-natural-home-v97-edge-boundary-repair",
    "generate:ai-painter-natural-home-v97-edge-boundary-repair",
    "select:ai-painter-natural-home-v97-edge-boundary-repair-quality",
    "judge:ai-painter-natural-home-v97-edge-boundary-repair-vj1",
    "check:ai-painter-natural-home-v97-edge-boundary-repair-vj1",
    "judge:ai-painter-natural-home-v97-edge-boundary-repair-vj2",
    "check:ai-painter-natural-home-v97-edge-boundary-repair-vj2",
  ],
  full_natural_home_v98_vj1_signal_repair: [
    "prepare:ai-painter-natural-home-v98-vj1-signal-repair",
    "check:ai-painter-natural-home-v98-vj1-signal-repair",
    "train:ai-painter-natural-home-v98-vj1-signal-repair",
    "generate:ai-painter-natural-home-v98-vj1-signal-repair",
    "select:ai-painter-natural-home-v98-vj1-signal-repair-quality",
    "judge:ai-painter-natural-home-v98-vj1-signal-repair-vj1",
    "check:ai-painter-natural-home-v98-vj1-signal-repair-vj1",
    "judge:ai-painter-natural-home-v98-vj1-signal-repair-vj2",
    "check:ai-painter-natural-home-v98-vj1-signal-repair-vj2",
  ],
  full_natural_home_v99_vj1_boundary_similarity_repair: [
    "prepare:ai-painter-natural-home-v99-vj1-boundary-similarity-repair",
    "check:ai-painter-natural-home-v99-vj1-boundary-similarity-repair",
    "train:ai-painter-natural-home-v99-vj1-boundary-similarity-repair",
    "generate:ai-painter-natural-home-v99-vj1-boundary-similarity-repair",
    "select:ai-painter-natural-home-v99-vj1-boundary-similarity-repair-quality",
    "judge:ai-painter-natural-home-v99-vj1-boundary-similarity-repair-vj1",
    "check:ai-painter-natural-home-v99-vj1-boundary-similarity-repair-vj1",
    "judge:ai-painter-natural-home-v99-vj1-boundary-similarity-repair-vj2",
    "check:ai-painter-natural-home-v99-vj1-boundary-similarity-repair-vj2",
  ],
  full_game_map_material_slot_v46_runtime_frame: [
    "full:game-map-material-slot-v46-runtime-frame",
  ],
  full: ["prepare:ai-painter-bootstrap", "train:ai-painter-bootstrap", "infer:ai-painter-bootstrap"],
  full_multiscene: [
    "prepare:ai-painter-multiscene",
    "train:ai-painter-multiscene",
    "train:ai-painter-multiscene-gan",
    "infer:ai-painter-multiscene-gan",
  ],
  full_structure_guided: ["train:ai-painter-structure-guided", "infer:ai-painter-structure-guided"],
  full_rgb_refiner: ["train:ai-painter-rgb-refiner", "infer:ai-painter-rgb-refiner"],
  full_local_assets: [
    "prepare:ai-painter-local-assets",
    "prepare:ai-painter-local-asset-base",
    "train:ai-painter-local-assets",
    "infer:ai-painter-local-assets",
  ],
  full_discrete_assets: [
    "prepare:ai-painter-discrete-palettes",
    "train:ai-painter-discrete-assets",
    "infer:ai-painter-discrete-assets",
  ],
  prepare_training_expansion: ["prepare:ai-painter-multiscene", "prepare:ai-painter-component-instances"],
  full_autonomous_training: [
    "prepare:ai-painter-multiscene",
    "prepare:ai-painter-component-instances",
    "check:ai-painter-autonomous-training",
    "train:ai-painter-structure-guided",
    "infer:ai-painter-structure-guided",
    "train:ai-painter-rgb-refiner",
    "infer:ai-painter-rgb-refiner",
    "prepare:ai-painter-local-assets",
    "prepare:ai-painter-local-asset-base",
    "train:ai-painter-local-assets",
    "infer:ai-painter-local-assets",
    "prepare:ai-painter-discrete-palettes",
    "train:ai-painter-discrete-assets",
    "infer:ai-painter-discrete-assets",
  ],
}

const singleActionScripts: Partial<Record<TrainingAction, string>> = {
  prepare_natural_home: "prepare:ai-painter-natural-home",
  train_natural_home: "train:ai-painter-natural-home",
  infer_natural_home: "infer:ai-painter-natural-home",
  train_natural_home_structure_guided: "train:ai-painter-natural-home-structure-guided",
  infer_natural_home_structure_guided: "infer:ai-painter-natural-home-structure-guided",
  train_natural_home_rgb_refiner: "train:ai-painter-natural-home-rgb-refiner",
  infer_natural_home_rgb_refiner: "infer:ai-painter-natural-home-rgb-refiner",
  prepare: "prepare:ai-painter-bootstrap",
  train: "train:ai-painter-bootstrap",
  infer: "infer:ai-painter-bootstrap",
  prepare_multiscene: "prepare:ai-painter-multiscene",
  train_multiscene: "train:ai-painter-multiscene",
  train_multiscene_gan: "train:ai-painter-multiscene-gan",
  infer_multiscene: "infer:ai-painter-multiscene-gan",
  train_structure_guided: "train:ai-painter-structure-guided",
  infer_structure_guided: "infer:ai-painter-structure-guided",
  train_rgb_refiner: "train:ai-painter-rgb-refiner",
  infer_rgb_refiner: "infer:ai-painter-rgb-refiner",
  prepare_local_assets: "prepare:ai-painter-local-assets",
  train_local_assets: "train:ai-painter-local-assets",
  infer_local_assets: "infer:ai-painter-local-assets",
  prepare_discrete_assets: "prepare:ai-painter-discrete-palettes",
  train_discrete_assets: "train:ai-painter-discrete-assets",
  infer_discrete_assets: "infer:ai-painter-discrete-assets",
  prepare_component_instances: "prepare:ai-painter-component-instances",
  report_mvp_gap: "report:ai-painter-mvp-gap",
  report_natural_home: "report:ai-painter-natural-home",
  report_natural_home_quality: "report:ai-painter-natural-home-quality",
}

function scriptsFor(action: TrainingAction) {
  const fullScripts = fullActionScripts[action]
  if (fullScripts) return fullScripts
  const singleScript = singleActionScripts[action]
  if (singleScript) return [singleScript]
  throw new Error(`未知训练动作：${action}`)
}

const clearDirectories: Partial<Record<TrainingAction, string[]>> = {
  prepare_natural_home: ["natural-home-dataset", "natural-home-training", "natural-home-inference"],
  full_natural_home: ["natural-home-dataset", "natural-home-training", "natural-home-inference"],
  train_natural_home: ["natural-home-training", "natural-home-inference"],
  infer_natural_home: ["natural-home-inference"],
  train_natural_home_structure_guided: ["natural-home-structure-guided-training", "natural-home-structure-guided-inference"],
  full_natural_home_structure_guided: ["natural-home-structure-guided-training", "natural-home-structure-guided-inference"],
  infer_natural_home_structure_guided: ["natural-home-structure-guided-inference"],
  train_natural_home_rgb_refiner: [
    "natural-home-rgb-refiner-training",
    "natural-home-rgb-refiner-inference",
    "natural-home-rgb-refiner-diagnosis",
    "natural-home-next-training-plan",
  ],
  full_natural_home_rgb_refiner: [
    "natural-home-rgb-refiner-training",
    "natural-home-rgb-refiner-inference",
    "natural-home-rgb-refiner-diagnosis",
    "natural-home-next-training-plan",
  ],
  infer_natural_home_rgb_refiner: [
    "natural-home-rgb-refiner-inference",
    "natural-home-rgb-refiner-diagnosis",
    "natural-home-next-training-plan",
  ],
  full_natural_home_v18_source_expert_bank: ["natural-home-local-detail-v18-source-expert-bank"],
  full_natural_home_v19_promoted_source: ["natural-home-local-detail-v19-promoted-source"],
  full_natural_home_v20_multisource_generalization: ["natural-home-local-detail-v20-multisource-generalization"],
  full_natural_home_v22_warning_focus: ["natural-home-local-detail-v22-warning-focus"],
  full_natural_home_v23_candidate_consolidation: ["natural-home-local-detail-v23-candidate-consolidation"],
  full_natural_home_v24_diversity_generation: ["natural-home-v24-diversity-generation"],
  full_natural_home_v25_diversity_generalization: [
    "natural-home-local-detail-v25-diversity-generalization-dataset",
    "natural-home-local-detail-v25-diversity-generalization-training",
    "natural-home-v25-diversity-generation",
  ],
  full_natural_home_v31_edge_refiner: [
    "natural-home-v31-edge-refiner-training",
    "natural-home-v31-edge-refiner-generation",
    "natural-home-v31-quality-selection",
  ],
  full_natural_home_v32_patchgan_refiner: [
    "natural-home-v32-patchgan-refiner-training",
    "natural-home-v32-patchgan-refiner-generation",
    "natural-home-v32-quality-selection",
  ],
  full_natural_home_v33_water_artifact_guard: [
    "natural-home-v33-water-artifact-guard-training",
    "natural-home-v33-water-artifact-guard-generation",
    "natural-home-v33-quality-selection",
  ],
  full_natural_home_v34_water_stability: [
    "natural-home-v34-water-stability-training",
    "natural-home-v34-water-stability-generation",
    "natural-home-v34-quality-selection",
  ],
  full_natural_home_v35_balanced_water_detail: [
    "natural-home-v35-balanced-water-detail-training",
    "natural-home-v35-balanced-water-detail-generation",
    "natural-home-v35-quality-selection",
  ],
  full_natural_home_v36_balanced_generalization: [
    "natural-home-v36-balanced-generalization-training",
    "natural-home-v36-balanced-generalization-generation",
    "natural-home-v36-quality-selection",
  ],
  full_natural_home_v37_water_failure_repair: [
    "natural-home-v37-water-failure-repair-training",
    "natural-home-v37-water-failure-repair-generation",
    "natural-home-v37-quality-selection",
  ],
  full_natural_home_v38_water_edge_balance: [
    "natural-home-v38-water-edge-balance-training",
    "natural-home-v38-water-edge-balance-generation",
    "natural-home-v38-quality-selection",
  ],
  full_natural_home_v39_failure_focus_repair: [
    "natural-home-v39-failure-focus-dataset",
    "natural-home-v39-failure-focus-repair-training",
    "natural-home-v39-failure-focus-repair-generation",
    "natural-home-v39-quality-selection",
  ],
  full_natural_home_v40_sharpness_lock_repair: [
    "natural-home-v40-sharpness-lock-repair-training",
    "natural-home-v40-sharpness-lock-repair-generation",
    "natural-home-v40-quality-selection",
  ],
  full_natural_home_v41_v32_water_rescue: [
    "natural-home-v41-v32-water-rescue-training",
    "natural-home-v41-v32-water-rescue-generation",
    "natural-home-v41-quality-selection",
  ],
  full_natural_home_v42_water_expert_fix: [
    "natural-home-v42-v32-water-expert-fix-generation",
    "natural-home-v42-quality-selection",
  ],
  full_natural_home_v43_v32_failure_focus_repair: [
    "natural-home-v43-v32-failure-focus-dataset",
    "natural-home-v43-v32-failure-focus-repair-training",
    "natural-home-v43-v32-failure-focus-repair-generation",
    "natural-home-v43-quality-selection",
  ],
  full_natural_home_v44_v32_stable_generalization: [
    "natural-home-v44-v32-stable-generalization-training",
    "natural-home-v44-v32-stable-generalization-generation",
    "natural-home-v44-quality-selection",
  ],
  full_natural_home_v45_generalization: [
    "natural-home-v45-generalization-dataset",
    "natural-home-v45-generalization-training",
    "natural-home-v45-generalization-generation",
    "natural-home-v45-quality-selection",
  ],
  full_natural_home_v46_v45_failure_focus_repair: [
    "natural-home-v46-v45-failure-focus-dataset",
    "natural-home-v46-v45-failure-focus-repair-training",
    "natural-home-v46-v45-failure-focus-repair-generation",
    "natural-home-v46-quality-selection",
  ],
  full_natural_home_v47_hard_failure_stabilization: [
    "natural-home-v47-hard-failure-stabilization-dataset",
    "natural-home-v47-hard-failure-stabilization-training",
    "natural-home-v47-hard-failure-stabilization-generation",
    "natural-home-v47-quality-selection",
  ],
  full_natural_home_v48_split_expert_merge_gate: [
    "natural-home-v48-water-sharpness-expert-fix-generation",
    "natural-home-v48-repair-quality-selection",
    "natural-home-v48-merge-gate-selection",
  ],
  full_natural_home_v49_v32_diversity_sweep: [
    "natural-home-v49-v32-diversity-sweep-generation",
    "natural-home-v49-quality-selection",
  ],
  full_natural_home_v50_diversity_water_gate: [
    "natural-home-v50-diversity-water-gate",
  ],
  full_natural_home_v51_safe_candidate_pack: [
    "natural-home-v51-safe-candidate-pack",
  ],
  full_natural_home_v80_quality_preserving_water_repair: [
    "natural-home-v80-quality-preserving-water-repair-dataset",
    "natural-home-v80-quality-preserving-water-repair-training",
    "natural-home-v80-quality-preserving-water-repair-generation",
    "natural-home-v80-quality-selection",
  ],
  full_natural_home_v81_high_score_diversity_distillation: [
    "natural-home-v81-high-score-diversity-distillation-dataset",
    "natural-home-v81-high-score-diversity-distillation-training",
    "natural-home-v81-high-score-diversity-distillation-generation",
    "natural-home-v81-quality-selection",
  ],
  full_natural_home_v82_broad_structure_coverage: [
    "natural-home-v82-broad-structure-coverage-dataset",
    "natural-home-v82-broad-structure-coverage-training",
    "natural-home-v82-broad-structure-coverage-generation",
    "natural-home-v82-quality-selection",
  ],
  full_natural_home_v83_water_failure_repair: [
    "natural-home-v83-water-failure-repair-dataset",
    "natural-home-v83-water-failure-repair-training",
    "natural-home-v83-water-failure-repair-generation",
    "natural-home-v83-quality-selection",
  ],
  full_natural_home_v84_v82_safe_quality_continuation: [
    "natural-home-v84-v82-safe-quality-continuation-dataset",
    "natural-home-v84-v82-safe-quality-continuation-training",
    "natural-home-v84-v82-safe-quality-continuation-generation",
    "natural-home-v84-quality-selection",
  ],
  full_natural_home_v85_v82_wide_variant_sweep: [
    "natural-home-v85-v82-wide-variant-sweep-generation",
    "natural-home-v85-quality-selection",
  ],
  full_natural_home_v86_wide_candidate_distillation: [
    "natural-home-v86-wide-candidate-distillation-dataset",
    "natural-home-v86-wide-candidate-distillation-training",
    "natural-home-v86-wide-candidate-distillation-generation",
    "natural-home-v86-quality-selection",
  ],
  full_natural_home_v87_quality_ledger: [
    "natural-home-v87-quality-ledger",
  ],
  full_natural_home_v88_quality_allowlist_dataset: [
    "natural-home-v88-quality-allowlist-dataset",
  ],
  full_natural_home_v89_quality_allowlist_training: [
    "natural-home-v89-quality-allowlist-training",
    "natural-home-v89-quality-allowlist-generation",
    "natural-home-v89-quality-selection",
  ],
  full_natural_home_v96_clean_multilayout: [
    "natural-home-v96-clean-multilayout-dataset",
    "natural-home-v96-clean-multilayout-training",
    "natural-home-v96-clean-multilayout-generation",
    "natural-home-v96-clean-multilayout-quality-selection",
    "natural-home-v96-clean-multilayout-vj1-review",
    "natural-home-v96-clean-multilayout-vj2-review",
  ],
  full_natural_home_v97_edge_boundary_repair: [
    "natural-home-v97-edge-boundary-repair-dataset",
    "natural-home-v97-edge-boundary-repair-training",
    "natural-home-v97-edge-boundary-repair-generation",
    "natural-home-v97-edge-boundary-repair-quality-selection",
    "natural-home-v97-edge-boundary-repair-vj1-review",
    "natural-home-v97-edge-boundary-repair-vj2-review",
  ],
  full_natural_home_v98_vj1_signal_repair: [
    "natural-home-v98-vj1-signal-repair-dataset",
    "natural-home-v98-vj1-signal-repair-training",
    "natural-home-v98-vj1-signal-repair-generation",
    "natural-home-v98-vj1-signal-repair-quality-selection",
    "natural-home-v98-vj1-signal-repair-vj1-review",
    "natural-home-v98-vj1-signal-repair-vj2-review",
  ],
  full_natural_home_v99_vj1_boundary_similarity_repair: [
    "natural-home-v99-vj1-boundary-similarity-repair-dataset",
    "natural-home-v99-vj1-boundary-similarity-repair-training",
    "natural-home-v99-vj1-boundary-similarity-repair-generation",
    "natural-home-v99-vj1-boundary-similarity-repair-quality-selection",
    "natural-home-v99-vj1-boundary-similarity-repair-vj1-review",
    "natural-home-v99-vj1-boundary-similarity-repair-vj2-review",
  ],
  train: ["bootstrap-training", "bootstrap-inference"],
  full: ["bootstrap-training", "bootstrap-inference"],
  train_multiscene: ["multiscene-training", "multiscene-gan-training", "multiscene-gan-inference"],
  full_multiscene: ["multiscene-training", "multiscene-gan-training", "multiscene-gan-inference"],
  train_structure_guided: ["structure-guided-training", "structure-guided-inference"],
  full_structure_guided: ["structure-guided-training", "structure-guided-inference"],
  train_rgb_refiner: ["rgb-refiner-training", "rgb-refiner-inference"],
  full_rgb_refiner: ["rgb-refiner-training", "rgb-refiner-inference"],
  prepare_local_assets: ["local-asset-dataset", "local-asset-training", "local-asset-inference", "local-asset-base"],
  full_local_assets: ["local-asset-dataset", "local-asset-training", "local-asset-inference", "local-asset-base"],
  train_local_assets: ["local-asset-training", "local-asset-inference"],
  prepare_discrete_assets: ["discrete-asset-training", "discrete-asset-inference"],
  full_discrete_assets: ["discrete-asset-training", "discrete-asset-inference"],
  train_discrete_assets: ["discrete-asset-training", "discrete-asset-inference"],
  prepare_component_instances: ["component-instance-dataset"],
  prepare_training_expansion: ["multiscene-dataset", "component-instance-dataset"],
  report_mvp_gap: ["mvp-gap-report"],
  report_natural_home: ["natural-home-readiness"],
  report_natural_home_quality: ["natural-home-quality"],
  full_autonomous_training: [
    "multiscene-dataset",
    "component-instance-dataset",
    "structure-guided-training",
    "structure-guided-inference",
    "rgb-refiner-training",
    "rgb-refiner-inference",
    "local-asset-dataset",
    "local-asset-base",
    "local-asset-training",
    "local-asset-inference",
    "discrete-asset-training",
    "discrete-asset-inference",
  ],
}

async function clearOutputs(action: TrainingAction) {
  await clear(...(clearDirectories[action] ?? []))
}

async function clear(...directories: string[]) {
  if (!directories.length) return

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  for (const directory of directories) {
    const outputDir = path.join(/* turbopackIgnore: true */ aiPainterRuntimeRoot, directory)
    await preserveOutputBeforeClear(directory, outputDir, stamp)
    await rm(outputDir, { recursive: true, force: true })
  }
}

async function preserveOutputBeforeClear(directory: string, outputDir: string, stamp: string) {
  try {
    const info = await stat(outputDir)
    if (!info.isDirectory()) return
  } catch {
    return
  }

  const relative = path.relative(/* turbopackIgnore: true */ aiPainterRuntimeRoot, outputDir)
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return

  const backupDir = path.join(preClearArchiveRoot, `${stamp}-${sanitizePathSegment(directory)}`, relative)
  await mkdir(path.dirname(backupDir), { recursive: true })
  await cp(outputDir, backupDir, { recursive: true })
  await appendFile(
    trainingControlLogPath,
    `\n[${new Date().toISOString()}] preserved previous training output before clear: ${relative} -> ${path.relative(process.cwd(), backupDir)}\n`,
    "utf8",
  )
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "training-output"
}

function startNpmScript(script: string) {
  const command = process.env.ComSpec ?? "cmd.exe"
  const child = spawn(command, ["/d", "/s", "/c", `npm run ${script}`], {
    env: process.env,
    windowsHide: true,
  })
  const completion = new Promise<void>((resolve, reject) => {
    child.stdout.on("data", (chunk) => void appendFile(trainingControlLogPath, chunk))
    child.stderr.on("data", (chunk) => void appendFile(trainingControlLogPath, chunk))
    child.once("error", reject)
    child.once("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${script} exit code: ${code ?? "unknown"}`))
    })
  })
  return { pid: child.pid ?? null, completion }
}

function startPeriodicHeartbeat(writeHeartbeat: () => Promise<unknown>) {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null

  function schedule() {
    timer = setTimeout(() => {
      inFlight = writeHeartbeat()
        .then(() => undefined, () => undefined)
        .finally(() => {
          inFlight = null
          if (!stopped) schedule()
        })
    }, heartbeatIntervalMs)
  }

  schedule()
  return async () => {
    stopped = true
    if (timer) clearTimeout(timer)
    if (inFlight) await inFlight
  }
}

function isProcessAlive(pid: number | null | undefined) {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function labelFor(script: string) {
  const labels: Record<string, string> = {
    "prepare:ai-painter-natural-home": "编译纯世界家园训练数据",
    "train:ai-painter-natural-home": "使用本地 GPU 训练纯世界家园基础模型",
    "infer:ai-painter-natural-home": "生成纯世界家园基础推理图",
    "train:ai-painter-natural-home-structure-guided": "训练纯世界家园结构引导模型",
    "infer:ai-painter-natural-home-structure-guided": "生成纯世界家园结构引导推理图",
    "train:ai-painter-natural-home-rgb-refiner": "训练纯世界家园 RGB 细节增强模型",
    "infer:ai-painter-natural-home-rgb-refiner": "生成纯世界家园 RGB 细节增强推理图",
    "diagnose:ai-painter-natural-home-rgb-refiner": "诊断纯世界家园 RGB 细节增强结果",
    "plan:ai-painter-natural-home-rgb-refiner": "生成下一轮纯世界家园训练计划",
    "train:ai-painter-natural-home-local-details-v18-source-expert-bank": "训练 V18 多源自然世界专家模型",
    "train:ai-painter-natural-home-local-details-v19-promoted-source": "训练 V19 晋级自然源专家模型",
    "train:ai-painter-natural-home-local-details-v20-multisource-generalization": "训练 V20 多源自然世界泛化模型",
    "train:ai-painter-natural-home-local-details-v22-warning-focus": "训练 V22 自然源警告样本强化模型",
    "train:ai-painter-natural-home-local-details-v23-candidate-consolidation": "训练 V23 自然家园候选整合模型",
    "generate:ai-painter-natural-home-v24-diversity": "生成 V24 多样自然家园候选",
    "prepare:ai-painter-natural-home-local-details-v25-diversity-generalization": "准备 V25 多样自然家园泛化数据",
    "train:ai-painter-natural-home-local-details-v25-diversity-generalization": "训练 V25 多样自然家园泛化模型",
    "generate:ai-painter-natural-home-v25-diversity": "生成 V25 多样自然家园候选",
    "prepare:ai-painter-natural-home-v28-real-mask-remix": "准备 V28 真实 Mask 重组数据",
    "train:ai-painter-natural-home-v28-structure": "训练 V28 真实 Mask 结构模型",
    "train:ai-painter-natural-home-v28-refiner": "训练 V28 真实 Mask RGB 细化模型",
    "generate:ai-painter-natural-home-v28-diversity-refiner": "生成 V28 真实 Mask 隐藏候选",
    "train:ai-painter-natural-home-v31-edge-refiner": "训练 V31 边缘强化 RGB 细化模型",
    "generate:ai-painter-natural-home-v31-edge-refiner": "生成 V31 边缘强化隐藏候选",
    "select:ai-painter-natural-home-v31-quality": "筛选 V31 候选并归档失败记录",
    "train:ai-painter-natural-home-v32-patchgan-refiner": "训练 V32 PatchGAN RGB 细化模型",
    "generate:ai-painter-natural-home-v32-patchgan-refiner": "生成 V32 PatchGAN 隐藏候选",
    "select:ai-painter-natural-home-v32-quality": "筛选 V32 候选并归档失败记录",
    "train:ai-painter-natural-home-v33-water-artifact-guard": "训练 V33 水体伪影防护模型",
    "generate:ai-painter-natural-home-v33-water-artifact-guard": "生成 V33 水体伪影防护候选",
    "select:ai-painter-natural-home-v33-quality": "筛选 V33 候选并归档失败记录",
    "train:ai-painter-natural-home-v34-water-stability": "训练 V34 水体稳定性模型",
    "generate:ai-painter-natural-home-v34-water-stability": "生成 V34 水体稳定性候选",
    "select:ai-painter-natural-home-v34-quality": "筛选 V34 候选并归档失败记录",
    "train:ai-painter-natural-home-v35-balanced-water-detail": "训练 V35 水体与细节平衡模型",
    "generate:ai-painter-natural-home-v35-balanced-water-detail": "生成 V35 水体与细节平衡候选",
    "select:ai-painter-natural-home-v35-quality": "筛选 V35 候选并归档失败记录",
    "train:ai-painter-natural-home-v36-balanced-generalization": "训练 V36 平衡泛化模型",
    "generate:ai-painter-natural-home-v36-balanced-generalization": "生成 V36 平衡泛化候选",
    "select:ai-painter-natural-home-v36-quality": "筛选 V36 候选并归档失败记录",
    "train:ai-painter-natural-home-v37-water-failure-repair": "训练 V37 水体失败修复模型",
    "generate:ai-painter-natural-home-v37-water-failure-repair": "生成 V37 水体失败修复候选",
    "select:ai-painter-natural-home-v37-quality": "筛选 V37 候选并归档失败记录",
    "train:ai-painter-natural-home-v38-water-edge-balance": "训练 V38 水体与边缘平衡模型",
    "generate:ai-painter-natural-home-v38-water-edge-balance": "生成 V38 水体与边缘平衡候选",
    "select:ai-painter-natural-home-v38-quality": "筛选 V38 候选并归档失败记录",
    "prepare:ai-painter-natural-home-v39-failure-focus": "准备 V39 失败样本加权数据",
    "train:ai-painter-natural-home-v39-failure-focus-repair": "训练 V39 失败样本修复模型",
    "generate:ai-painter-natural-home-v39-failure-focus-repair": "生成 V39 失败样本修复候选",
    "select:ai-painter-natural-home-v39-quality": "筛选 V39 候选并归档失败记录",
    "train:ai-painter-natural-home-v40-sharpness-lock-repair": "训练 V40 锐度锁定修复模型",
    "generate:ai-painter-natural-home-v40-sharpness-lock-repair": "生成 V40 锐度锁定候选",
    "select:ai-painter-natural-home-v40-quality": "筛选 V40 候选并归档失败记录",
    "train:ai-painter-natural-home-v41-v32-water-rescue": "训练 V41 从 V32 出发的水体修复模型",
    "generate:ai-painter-natural-home-v41-v32-water-rescue": "生成 V41 水体修复候选",
    "select:ai-painter-natural-home-v41-quality": "筛选 V41 候选并归档失败记录",
    "fix:ai-painter-natural-home-v42-water-expert": "执行 V42 本地水体专家 Mask 修复候选",
    "select:ai-painter-natural-home-v42-quality": "筛选 V42 候选并归档失败记录",
    "prepare:ai-painter-natural-home-v43-v32-failure-focus": "准备 V43 从 V32 出发的失败样本加权数据",
    "train:ai-painter-natural-home-v43-v32-failure-focus-repair": "训练 V43 从 V32 出发的失败样本修复模型",
    "generate:ai-painter-natural-home-v43-v32-failure-focus-repair": "生成 V43 失败样本修复候选",
    "select:ai-painter-natural-home-v43-quality": "筛选 V43 候选并归档失败记录",
    "train:ai-painter-natural-home-v44-v32-stable-generalization": "训练 V44 从 V32 出发的稳定泛化模型",
    "generate:ai-painter-natural-home-v44-v32-stable-generalization": "生成 V44 稳定泛化隐藏候选",
    "select:ai-painter-natural-home-v44-quality": "筛选 V44 候选并归档失败记录",
    "prepare:ai-painter-natural-home-v45-generalization-dataset": "准备 V45 平衡泛化数据",
    "train:ai-painter-natural-home-v45-generalization": "训练 V45 平衡泛化模型",
    "generate:ai-painter-natural-home-v45-generalization": "生成 V45 泛化候选",
    "select:ai-painter-natural-home-v45-quality": "筛选 V45 候选并归档失败记录",
    "prepare:ai-painter-natural-home-v46-v45-failure-focus": "准备 V46 基于 V45 失败样本的加权数据",
    "train:ai-painter-natural-home-v46-v45-failure-focus-repair": "训练 V46 水体伪影与边缘密度修复模型",
    "generate:ai-painter-natural-home-v46-v45-failure-focus-repair": "生成 V46 失败样本修复候选",
    "select:ai-painter-natural-home-v46-quality": "筛选 V46 候选并归档失败记录",
    "prepare:ai-painter-natural-home-v47-hard-failure-stabilization": "准备 V47 硬失败样本稳定化数据",
    "train:ai-painter-natural-home-v47-hard-failure-stabilization": "训练 V47 硬失败样本稳定化模型",
    "generate:ai-painter-natural-home-v47-hard-failure-stabilization": "生成 V47 稳定化候选",
    "select:ai-painter-natural-home-v47-quality": "筛选 V47 候选并归档失败记录",
    "check:ai-painter-autonomous-training": "执行自主训练闸门检查",
    "report:ai-painter-mvp-gap": "生成 MVP 视觉生成缺口审计",
    "report:ai-painter-natural-home": "生成纯世界家园数据闸门报告",
    "report:ai-painter-natural-home-quality": "生成纯世界家园训练数据质量报告",
    "prepare:ai-painter-multiscene": "编译历史多场景训练数据",
    "prepare:ai-painter-component-instances": "提取 14 类部件实例并执行训练就绪审计",
    "prepare:ai-painter-discrete-palettes": "从训练图建立离散调色板",
    "train:ai-painter-discrete-assets": "训练离散像素模型",
    "infer:ai-painter-discrete-assets": "执行离散像素推理与世界合成",
    "prepare:ai-painter-local-assets": "生成局部资产训练数据",
    "prepare:ai-painter-local-asset-base": "生成局部合成基础画面",
    "train:ai-painter-local-assets": "训练局部资产模型",
    "infer:ai-painter-local-assets": "执行局部资产推理与 Mask 约束合成",
  }

  if (labels[script]) return labels[script]
  if (script.includes("rgb-refiner") && script.startsWith("train:")) return "训练 RGB 像素细化器"
  if (script.includes("rgb-refiner") && script.startsWith("infer:")) return "生成 RGB 细化对照图"
  if (script.includes("structure-guided") && script.startsWith("train:")) return "训练 14 通道结构引导模型"
  if (script.includes("structure-guided") && script.startsWith("infer:")) return "生成结构引导 RGB 与结构预览"
  if (script.includes("multiscene-gan")) return "训练历史多场景 GAN 细节模型"
  if (script.includes("multiscene")) return "执行历史多场景模型阶段"
  if (script.startsWith("prepare:")) return "准备工程验证样本"
  if (script.startsWith("train:")) return "使用本地 GPU 训练模型"
  return "使用本地模型执行推理"
}

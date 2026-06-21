import { spawn } from "node:child_process"
import { appendFile, mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { startResourceUsageSession } from "./ai-painter-resource-usage"
import { archiveTrainingResult } from "./ai-painter-training-result-archive"
import { tryPromoteTrainingResultToWorldVisual } from "./ai-painter-training-world-promotion"
import {
  aiPainterRuntimeRoot,
  readTrainingControlState,
  readTrainingLogTail,
  trainingControlDir,
  trainingControlLogPath,
  writeTrainingControlState,
  type TrainingControlState,
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

export { readTrainingControlState, readTrainingLogTail, type TrainingControlState }

let activeRun: Promise<void> | null = null

export async function startTrainingAction(action: TrainingAction) {
  if (activeRun) {
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
  }

  await writeTrainingControlState(state)
  const resourceSession = await startResourceUsageSession(action)
  activeRun = runAction(action, state, resourceSession).finally(() => {
    activeRun = null
  })
  return state
}

async function runAction(
  action: TrainingAction,
  state: TrainingControlState,
  resourceSession: Awaited<ReturnType<typeof startResourceUsageSession>>,
) {
  try {
    await clearOutputs(action)
    for (const script of scriptsFor(action)) {
      state.currentStep = labelFor(script)
      await writeTrainingControlState(state)
      await appendFile(trainingControlLogPath, `\n[${new Date().toISOString()}] ${state.currentStep}\n`, "utf8")
      await runNpmScript(script)
    }
    state.status = "completed"
    state.currentStep = "全部完成"
  } catch (error) {
    state.status = "failed"
    state.error = error instanceof Error ? error.message : "本地任务执行失败"
    await appendFile(trainingControlLogPath, `\nERROR: ${state.error}\n`, "utf8")
  } finally {
    state.finishedAt = new Date().toISOString()
    await writeTrainingControlState(state)
    const resourceSummary = await resourceSession.finish({
      status: state.status === "failed" ? "failed" : "completed",
      error: state.error,
    })
    if (state.status !== "failed") {
      try {
        const archived = await archiveTrainingResult({ action, resourceSummary })
        if (archived) {
          await appendFile(
            trainingControlLogPath,
            `\n[${new Date().toISOString()}] 已自动归档训练结果：${archived.id}\n`,
            "utf8",
          )
        }
      } catch (archiveError) {
        const message = archiveError instanceof Error ? archiveError.message : "训练结果自动归档失败"
        await appendFile(trainingControlLogPath, `\n[${new Date().toISOString()}] 训练结果自动归档失败：${message}\n`, "utf8")
      }
      try {
        const promotion = await tryPromoteTrainingResultToWorldVisual({ action })
        await appendFile(
          trainingControlLogPath,
          `\n[${new Date().toISOString()}] 世界视觉自动晋级：${promotion.status}，${promotion.message}\n`,
          "utf8",
        )
      } catch (promotionError) {
        const message = promotionError instanceof Error ? promotionError.message : "世界视觉自动晋级失败"
        await appendFile(trainingControlLogPath, `\n[${new Date().toISOString()}] 世界视觉自动晋级失败：${message}\n`, "utf8")
      }
    }
  }
}

function scriptsFor(action: TrainingAction) {
  if (action === "full_natural_home") {
    return ["prepare:ai-painter-natural-home", "train:ai-painter-natural-home", "infer:ai-painter-natural-home"]
  }
  if (action === "full_natural_home_structure_guided") {
    return ["train:ai-painter-natural-home-structure-guided", "infer:ai-painter-natural-home-structure-guided"]
  }
  if (action === "full_natural_home_rgb_refiner") {
    return [
      "train:ai-painter-natural-home-rgb-refiner",
      "infer:ai-painter-natural-home-rgb-refiner",
      "diagnose:ai-painter-natural-home-rgb-refiner",
      "plan:ai-painter-natural-home-rgb-refiner",
    ]
  }
  if (action === "full_natural_home_v18_source_expert_bank") {
    return ["train:ai-painter-natural-home-local-details-v18-source-expert-bank"]
  }
  if (action === "full_natural_home_v19_promoted_source") {
    return ["train:ai-painter-natural-home-local-details-v19-promoted-source"]
  }
  if (action === "full_natural_home_v20_multisource_generalization") {
    return ["train:ai-painter-natural-home-local-details-v20-multisource-generalization"]
  }
  if (action === "full_natural_home_v22_warning_focus") {
    return ["train:ai-painter-natural-home-local-details-v22-warning-focus"]
  }
  if (action === "full_natural_home_v23_candidate_consolidation") {
    return ["train:ai-painter-natural-home-local-details-v23-candidate-consolidation"]
  }
  if (action === "full_natural_home_v24_diversity_generation") {
    return ["generate:ai-painter-natural-home-v24-diversity"]
  }
  if (action === "full_natural_home_v25_diversity_generalization") {
    return [
      "prepare:ai-painter-natural-home-local-details-v25-diversity-generalization",
      "train:ai-painter-natural-home-local-details-v25-diversity-generalization",
      "generate:ai-painter-natural-home-v25-diversity",
    ]
  }
  if (action === "full_natural_home_v28_real_mask_remix") {
    return [
      "prepare:ai-painter-natural-home-v28-real-mask-remix",
      "train:ai-painter-natural-home-v28-structure",
      "train:ai-painter-natural-home-v28-refiner",
      "generate:ai-painter-natural-home-v28-diversity-refiner",
    ]
  }
  if (action === "full") return ["prepare:ai-painter-bootstrap", "train:ai-painter-bootstrap", "infer:ai-painter-bootstrap"]
  if (action === "full_multiscene") {
    return [
      "prepare:ai-painter-multiscene",
      "train:ai-painter-multiscene",
      "train:ai-painter-multiscene-gan",
      "infer:ai-painter-multiscene-gan",
    ]
  }
  if (action === "full_structure_guided") return ["train:ai-painter-structure-guided", "infer:ai-painter-structure-guided"]
  if (action === "full_rgb_refiner") return ["train:ai-painter-rgb-refiner", "infer:ai-painter-rgb-refiner"]
  if (action === "full_local_assets") {
    return [
      "prepare:ai-painter-local-assets",
      "prepare:ai-painter-local-asset-base",
      "train:ai-painter-local-assets",
      "infer:ai-painter-local-assets",
    ]
  }
  if (action === "full_discrete_assets") {
    return [
      "prepare:ai-painter-discrete-palettes",
      "train:ai-painter-discrete-assets",
      "infer:ai-painter-discrete-assets",
    ]
  }
  if (action === "prepare_training_expansion") return ["prepare:ai-painter-multiscene", "prepare:ai-painter-component-instances"]
  if (action === "report_mvp_gap") return ["report:ai-painter-mvp-gap"]
  if (action === "report_natural_home") return ["report:ai-painter-natural-home"]
  if (action === "report_natural_home_quality") return ["report:ai-painter-natural-home-quality"]
  if (action === "full_autonomous_training") {
    return [
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
    ]
  }
  return [scriptFor(action)]
}

async function clearOutputs(action: TrainingAction) {
  if (action === "prepare_natural_home" || action === "full_natural_home") {
    await clear("natural-home-dataset", "natural-home-training", "natural-home-inference")
  }
  if (action === "train_natural_home") await clear("natural-home-training", "natural-home-inference")
  if (action === "infer_natural_home") await clear("natural-home-inference")
  if (action === "train_natural_home_structure_guided" || action === "full_natural_home_structure_guided") {
    await clear("natural-home-structure-guided-training", "natural-home-structure-guided-inference")
  }
  if (action === "infer_natural_home_structure_guided") await clear("natural-home-structure-guided-inference")
  if (action === "train_natural_home_rgb_refiner" || action === "full_natural_home_rgb_refiner") {
    await clear(
      "natural-home-rgb-refiner-training",
      "natural-home-rgb-refiner-inference",
      "natural-home-rgb-refiner-diagnosis",
      "natural-home-next-training-plan",
    )
  }
  if (action === "infer_natural_home_rgb_refiner") {
    await clear("natural-home-rgb-refiner-inference", "natural-home-rgb-refiner-diagnosis", "natural-home-next-training-plan")
  }
  if (action === "full_natural_home_v18_source_expert_bank") {
    await clear("natural-home-local-detail-v18-source-expert-bank")
  }
  if (action === "full_natural_home_v19_promoted_source") {
    await clear("natural-home-local-detail-v19-promoted-source")
  }
  if (action === "full_natural_home_v20_multisource_generalization") {
    await clear("natural-home-local-detail-v20-multisource-generalization")
  }
  if (action === "full_natural_home_v22_warning_focus") {
    await clear("natural-home-local-detail-v22-warning-focus")
  }
  if (action === "full_natural_home_v23_candidate_consolidation") {
    await clear("natural-home-local-detail-v23-candidate-consolidation")
  }
  if (action === "full_natural_home_v24_diversity_generation") {
    await clear("natural-home-v24-diversity-generation")
  }
  if (action === "full_natural_home_v25_diversity_generalization") {
    await clear(
      "natural-home-local-detail-v25-diversity-generalization-dataset",
      "natural-home-local-detail-v25-diversity-generalization-training",
      "natural-home-v25-diversity-generation",
    )
  }
  if (action === "train" || action === "full") await clear("bootstrap-training", "bootstrap-inference")
  if (action === "train_multiscene" || action === "full_multiscene") {
    await clear("multiscene-training", "multiscene-gan-training", "multiscene-gan-inference")
  }
  if (action === "train_structure_guided" || action === "full_structure_guided") {
    await clear("structure-guided-training", "structure-guided-inference")
  }
  if (action === "train_rgb_refiner" || action === "full_rgb_refiner") {
    await clear("rgb-refiner-training", "rgb-refiner-inference")
  }
  if (action === "prepare_local_assets" || action === "full_local_assets") {
    await clear("local-asset-dataset", "local-asset-training", "local-asset-inference", "local-asset-base")
  }
  if (action === "train_local_assets") await clear("local-asset-training", "local-asset-inference")
  if (action === "prepare_discrete_assets" || action === "full_discrete_assets") {
    await clear("discrete-asset-training", "discrete-asset-inference")
  }
  if (action === "train_discrete_assets") await clear("discrete-asset-training", "discrete-asset-inference")
  if (action === "prepare_component_instances") await clear("component-instance-dataset")
  if (action === "prepare_training_expansion") await clear("multiscene-dataset", "component-instance-dataset")
  if (action === "report_mvp_gap") await clear("mvp-gap-report")
  if (action === "report_natural_home") await clear("natural-home-readiness")
  if (action === "report_natural_home_quality") await clear("natural-home-quality")
  if (action === "full_autonomous_training") {
    await clear(
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
    )
  }
}

async function clear(...directories: string[]) {
  for (const directory of directories) {
    await rm(path.join(/* turbopackIgnore: true */ aiPainterRuntimeRoot, directory), { recursive: true, force: true })
  }
}

function runNpmScript(script: string) {
  return new Promise<void>((resolve, reject) => {
    const command = process.env.ComSpec ?? "cmd.exe"
    const child = spawn(command, ["/d", "/s", "/c", `npm run ${script}`], {
      env: process.env,
      windowsHide: true,
    })
    child.stdout.on("data", (chunk) => void appendFile(trainingControlLogPath, chunk))
    child.stderr.on("data", (chunk) => void appendFile(trainingControlLogPath, chunk))
    child.once("error", reject)
    child.once("exit", (code) => {
      code === 0 ? resolve() : reject(new Error(`${script} exit code: ${code ?? "unknown"}`))
    })
  })
}

function scriptFor(
  action: Exclude<
    TrainingAction,
    | "full"
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
    | "full_multiscene"
    | "full_structure_guided"
    | "full_rgb_refiner"
    | "full_local_assets"
    | "full_discrete_assets"
    | "full_autonomous_training"
  >,
) {
  const scripts = {
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
    prepare_training_expansion: "prepare:ai-painter-multiscene",
    report_mvp_gap: "report:ai-painter-mvp-gap",
    report_natural_home: "report:ai-painter-natural-home",
    report_natural_home_quality: "report:ai-painter-natural-home-quality",
  } as const
  return scripts[action]
}

function labelFor(script: string) {
  if (script === "train:ai-painter-natural-home-local-details-v22-warning-focus") {
    return "Train V22 natural-home warning source focus model"
  }
  if (script === "train:ai-painter-natural-home-local-details-v23-candidate-consolidation") {
    return "Train V23 natural-home candidate consolidation model"
  }
  if (script === "prepare:ai-painter-natural-home-v28-real-mask-remix") {
    return "Prepare V28 real-mask remix natural-home dataset"
  }
  if (script === "train:ai-painter-natural-home-v28-structure") {
    return "Train V28 real-mask remix structure model"
  }
  if (script === "train:ai-painter-natural-home-v28-refiner") {
    return "Train V28 real-mask remix RGB refiner"
  }
  if (script === "generate:ai-painter-natural-home-v28-diversity-refiner") {
    return "Generate V28 real-mask remix hidden candidates"
  }
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

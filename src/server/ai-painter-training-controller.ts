import { spawn } from "node:child_process"
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

export type TrainingAction = "prepare" | "train" | "infer" | "full" | "prepare_multiscene" | "train_multiscene" | "train_multiscene_gan" | "infer_multiscene" | "full_multiscene"

export type TrainingControlState = {
  status: "idle" | "running" | "completed" | "failed"
  action: TrainingAction | null
  currentStep: string | null
  startedAt: string | null
  finishedAt: string | null
  error: string | null
}

const runtimeRoot = path.join(/* turbopackIgnore: true */ process.cwd(), ".runtime", "ai-painter")
const controlDir = path.join(runtimeRoot, "training-control")
const statePath = path.join(controlDir, "state.json")
const logPath = path.join(controlDir, "console.log")

const idleState: TrainingControlState = {
  status: "idle",
  action: null,
  currentStep: null,
  startedAt: null,
  finishedAt: null,
  error: null,
}

let activeRun: Promise<void> | null = null

export async function startTrainingAction(action: TrainingAction) {
  if (activeRun) throw new Error("已有本地训练任务正在运行，请等待完成。")
  await mkdir(controlDir, { recursive: true })
  await writeFile(logPath, "", "utf8")
  const state: TrainingControlState = {
    status: "running",
    action,
    currentStep: "准备执行",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  }
  await writeState(state)
  activeRun = runAction(action, state).finally(() => { activeRun = null })
  return state
}

export async function readTrainingControlState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8")) as TrainingControlState
  } catch {
    return idleState
  }
}

export async function readTrainingLogTail(maxLines = 80) {
  try {
    return (await readFile(logPath, "utf8")).trim().split(/\r?\n/).slice(-maxLines)
  } catch {
    return []
  }
}

async function runAction(action: TrainingAction, state: TrainingControlState) {
  try {
    const scripts = action === "full"
      ? ["prepare:ai-painter-bootstrap", "train:ai-painter-bootstrap", "infer:ai-painter-bootstrap"]
      : action === "full_multiscene"
        ? ["prepare:ai-painter-multiscene", "train:ai-painter-multiscene", "train:ai-painter-multiscene-gan", "infer:ai-painter-multiscene-gan"]
        : [scriptFor(action)]
    if (action === "train" || action === "full") {
      await rm(path.join(runtimeRoot, "bootstrap-training"), { recursive: true, force: true })
      await rm(path.join(runtimeRoot, "bootstrap-inference"), { recursive: true, force: true })
    }
    if (action === "train_multiscene" || action === "full_multiscene") {
      await rm(path.join(runtimeRoot, "multiscene-training"), { recursive: true, force: true })
      await rm(path.join(runtimeRoot, "multiscene-gan-training"), { recursive: true, force: true })
      await rm(path.join(runtimeRoot, "multiscene-gan-inference"), { recursive: true, force: true })
    }
    for (const script of scripts) {
      state.currentStep = labelFor(script)
      await writeState(state)
      await appendFile(logPath, `\n[${new Date().toISOString()}] ${state.currentStep}\n`, "utf8")
      await runNpmScript(script)
    }
    state.status = "completed"
    state.currentStep = "全部完成"
  } catch (error) {
    state.status = "failed"
    state.error = error instanceof Error ? error.message : "本地任务执行失败"
    await appendFile(logPath, `\nERROR: ${state.error}\n`, "utf8")
  } finally {
    state.finishedAt = new Date().toISOString()
    await writeState(state)
  }
}

function runNpmScript(script: string) {
  return new Promise<void>((resolve, reject) => {
    const command = process.env.ComSpec ?? "cmd.exe"
    const child = spawn(command, ["/d", "/s", "/c", `npm run ${script}`], {
      env: process.env,
      windowsHide: true,
    })
    child.stdout.on("data", (chunk) => void appendFile(logPath, chunk))
    child.stderr.on("data", (chunk) => void appendFile(logPath, chunk))
    child.once("error", reject)
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${script} 退出码：${code ?? "unknown"}`)))
  })
}

function scriptFor(action: Exclude<TrainingAction, "full" | "full_multiscene">) {
  if (action === "prepare") return "prepare:ai-painter-bootstrap"
  if (action === "train") return "train:ai-painter-bootstrap"
  if (action === "infer") return "infer:ai-painter-bootstrap"
  if (action === "prepare_multiscene") return "prepare:ai-painter-multiscene"
  if (action === "train_multiscene") return "train:ai-painter-multiscene"
  if (action === "train_multiscene_gan") return "train:ai-painter-multiscene-gan"
  return "infer:ai-painter-multiscene-gan"
}

function labelFor(script: string) {
  if (script.includes("multiscene-gan")) return "训练多场景 GAN 细节模型"
  if (script.includes("multiscene")) return "执行多场景模型阶段"
  if (script.startsWith("prepare:")) return "准备工程验证样本"
  if (script.startsWith("train:")) return "使用本地 GPU 训练 Tiny U-Net"
  return "使用本地模型执行推理"
}

async function writeState(state: TrainingControlState) {
  await mkdir(controlDir, { recursive: true })
  await writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf8")
}

import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

const runFile = promisify(execFile)

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止训练模型。" }, { status: 403 })
  }
  try {
    const root = process.cwd()
    const python = path.join(root, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
    const scripts = path.join(root, "ml", "ai-painter", "scripts")
    const dataset = path.join(root, "data", "ai-painter-datasets")
    const readiness = await readReadiness(root, python, scripts, dataset)
    if (readiness.readinessStatus !== "first_training_ready") {
      return NextResponse.json({
        ok: false,
        message: `训练已被阻断：当前 readiness=${readiness.readinessStatus}。请先完成 v1 迁移、逐项复核、索引更新，并达到至少 100 个正式可训练样本。`,
        readiness,
      }, { status: 423 })
    }
    const training = path.join(root, ".runtime", "ai-painter", "training-v0-current")
    const evaluation = path.join(root, ".runtime", "ai-painter", "evaluation-v0")
    await runFile(python, [path.join(scripts, "train_tiny_unet.py"), "--dataset-root", dataset, "--max-epochs", "100", "--output-dir", training], runOptions(root))
    await runFile(python, [path.join(scripts, "evaluate_tiny_unet.py"), "--checkpoint", path.join(training, "best.pt"), "--dataset-root", dataset, "--split", "validation", "--output-dir", evaluation], runOptions(root))
    const report = JSON.parse(await readFile(path.join(evaluation, "evaluation.json"), "utf8")) as {
      meanMae: number; meanPsnr: number; samples: Array<{ sampleId: string }>
    }
    const sampleId = report.samples[0]?.sampleId
    if (!sampleId) throw new Error("验证集中没有可生成的样本。")
    await runFile(python, [path.join(scripts, "infer_tiny_unet.py"), "--checkpoint", path.join(training, "best.pt"), "--dataset-root", dataset, "--sample-id", sampleId, "--output", path.join(root, ".runtime", "ai-painter", "inference-v0", `${sampleId}-current.png`)], runOptions(root))
    return NextResponse.json({
      ok: true,
      message: "训练完成，页面已更新为最新模型结果。",
      meanMae: report.meanMae,
      meanPsnr: report.meanPsnr,
    })
  } catch (error) {
    const value = error as { stdout?: string; stderr?: string; message?: string }
    return NextResponse.json(
      { ok: false, message: value.stderr || value.stdout || value.message || "训练失败。" },
      { status: 500 }
    )
  }
}

async function readReadiness(root: string, python: string, scripts: string, dataset: string) {
  try {
    const result = await runFile(python, [path.join(scripts, "report_v1_readiness.py"), "--dataset-root", dataset], runOptions(root))
    return JSON.parse(result.stdout) as { readinessStatus: string }
  } catch (error) {
    const value = error as { stdout?: string }
    if (value.stdout) return JSON.parse(value.stdout) as { readinessStatus: string }
    throw error
  }
}

function runOptions(cwd: string) {
  return { cwd, windowsHide: true, timeout: 180_000, maxBuffer: 2 * 1024 * 1024 }
}

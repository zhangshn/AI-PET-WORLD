import { execFile } from "node:child_process"
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
    const script = path.join(root, "ml", "ai-painter", "scripts", "report_v1_readiness.py")
    const dataset = path.join(root, "data", "ai-painter-datasets")
    const readiness = await readReadiness(root, python, script, dataset)
    return NextResponse.json({
      ok: false,
      message: `训练入口已被阻断：当前模块只允许训练数据 v1 准备与 readiness 验收，不启动真实模型训练。当前 readiness=${readiness.readinessStatus}。`,
      readiness,
    }, { status: 423 })
  } catch (error) {
    const value = error as { stdout?: string; stderr?: string; message?: string }
    return NextResponse.json(
      { ok: false, message: value.stderr || value.stdout || value.message || "训练前 readiness 检查失败。" },
      { status: 500 }
    )
  }
}

async function readReadiness(root: string, python: string, script: string, dataset: string) {
  try {
    const result = await runFile(python, [script, "--dataset-root", dataset], runOptions(root))
    return JSON.parse(result.stdout) as { readinessStatus: string }
  } catch (error) {
    const value = error as { stdout?: string }
    if (value.stdout) return JSON.parse(value.stdout) as { readinessStatus: string }
    throw error
  }
}

function runOptions(cwd: string) {
  return { cwd, windowsHide: true, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 }
}

import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

const runFile = promisify(execFile)
const pythonEnv = { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止访问训练数据状态。" }, { status: 403 })
  }
  const python = path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe")
  const script = path.join(process.cwd(), "ml", "ai-painter", "scripts", "report_v1_readiness.py")
  const datasetRoot = path.join(process.cwd(), "data", "ai-painter-datasets")
  try {
    const result = await runFile(python, [script, "--dataset-root", datasetRoot], {
      cwd: process.cwd(),
      env: pythonEnv,
      windowsHide: true,
      timeout: 30_000,
    })
    return NextResponse.json({ ok: true, report: JSON.parse(result.stdout) })
  } catch (error) {
    const value = error as { stdout?: string; stderr?: string }
    if (value.stdout) {
      try {
        return NextResponse.json({ ok: true, report: JSON.parse(value.stdout) })
      } catch {}
    }
    return NextResponse.json({ ok: false, message: value.stderr || (error instanceof Error ? error.message : "读取训练数据状态失败。") }, { status: 500 })
  }
}

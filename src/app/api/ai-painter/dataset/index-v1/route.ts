import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

const runFile = promisify(execFile)

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止更新训练索引。" }, { status: 403 })
  }
  const python = path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe")
  const script = path.join(process.cwd(), "ml", "ai-painter", "scripts", "update_v1_indexes.py")
  const datasetRoot = path.join(process.cwd(), "data", "ai-painter-datasets")
  try {
    const result = await runFile(python, [script, "--dataset-root", datasetRoot], {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 30_000,
    })
    return NextResponse.json({ ok: true, message: "已按可训练 v1 样本重建 train/validation 索引。", result: JSON.parse(result.stdout) })
  } catch (error) {
    const value = error as { stdout?: string; stderr?: string }
    if (value.stdout) {
      try {
        return NextResponse.json({ ok: true, message: "索引已更新，但 readiness 仍未就绪。", result: JSON.parse(value.stdout) })
      } catch {}
    }
    return NextResponse.json({ ok: false, message: value.stderr || (error instanceof Error ? error.message : "更新索引失败。") }, { status: 422 })
  }
}

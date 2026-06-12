import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

const runFile = promisify(execFile)
const SAMPLE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u

export async function POST(_request: Request, context: { params: Promise<{ sampleId: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止确认 v1 Blueprint。" }, { status: 403 })
  }
  const { sampleId } = await context.params
  if (!SAMPLE_ID_PATTERN.test(sampleId)) {
    return NextResponse.json({ ok: false, message: "样本 ID 无效。" }, { status: 422 })
  }
  try {
    const python = path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe")
    const script = path.join(process.cwd(), "ml", "ai-painter", "scripts", "confirm_scene_annotation_v1.py")
    const datasetRoot = path.join(process.cwd(), "data", "ai-painter-datasets")
    const result = await runFile(python, [script, sampleId, "--dataset-root", datasetRoot], {
      cwd: process.cwd(), windowsHide: true, timeout: 30_000,
    })
    return NextResponse.json({ ok: true, message: "v1 Blueprint 已人工确认，可进入实验数据读取。", result: JSON.parse(result.stdout) })
  } catch (error) {
    const value = error as { stdout?: string; stderr?: string }
    return NextResponse.json({ ok: false, message: value.stdout || value.stderr || (error instanceof Error ? error.message : "v1 确认失败。") }, { status: 422 })
  }
}

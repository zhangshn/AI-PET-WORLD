import { execFile } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

const runFile = promisify(execFile)
const SAMPLE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u

export async function POST(request: Request, context: { params: Promise<{ sampleId: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止修改训练数据。" }, { status: 403 })
  }
  const { sampleId } = await context.params
  if (!SAMPLE_ID_PATTERN.test(sampleId)) {
    return NextResponse.json({ ok: false, message: "样本 ID 无效。" }, { status: 422 })
  }

  const temporaryRoot = path.join(process.cwd(), "data", "ai-painter-datasets", ".annotation-work")
  const temporaryFile = path.join(temporaryRoot, `${sampleId}.json`)
  try {
    const blueprint = await request.json()
    await mkdir(temporaryRoot, { recursive: true })
    await writeFile(temporaryFile, JSON.stringify(blueprint, null, 2), "utf8")
    const python = path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe")
    const script = path.join(process.cwd(), "ml", "ai-painter", "scripts", "update_scene_annotation.py")
    const datasetRoot = path.join(process.cwd(), "data", "ai-painter-datasets")
    const result = await runFile(python, [script, sampleId, "--dataset-root", datasetRoot, "--blueprint", temporaryFile], {
      cwd: process.cwd(), windowsHide: true, timeout: 30_000,
    })
    return NextResponse.json({ ok: true, message: "Blueprint 与 8 通道 Mask 已更新。", result: JSON.parse(result.stdout) })
  } catch (error) {
    const value = error as { stdout?: string; stderr?: string }
    return NextResponse.json({ ok: false, message: value.stdout || value.stderr || (error instanceof Error ? error.message : "更新失败。") }, { status: 422 })
  } finally {
    await rm(temporaryFile, { force: true })
  }
}

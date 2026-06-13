import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

const runFile = promisify(execFile)
const pythonEnv = { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }
const SAMPLE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,80}$/u

type RequestBody = {
  sampleIds?: unknown
  force?: unknown
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止执行批量 v1 迁移。" }, { status: 403 })
  }
  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ ok: false, message: "请求体必须是 JSON。" }, { status: 422 })
  }
  const sampleIds = Array.isArray(body.sampleIds) ? body.sampleIds.filter((item): item is string => typeof item === "string") : []
  if (!sampleIds.length) return NextResponse.json({ ok: false, message: "请选择至少一个样本。" }, { status: 422 })
  if (sampleIds.some((item) => !SAMPLE_ID_PATTERN.test(item))) return NextResponse.json({ ok: false, message: "样本 ID 列表包含无效值。" }, { status: 422 })
  const python = path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe")
  const script = path.join(process.cwd(), "ml", "ai-painter", "scripts", "migrate_blueprint_v1.py")
  const datasetRoot = path.join(process.cwd(), "data", "ai-painter-datasets")
  const args = [script, "--dataset-root", datasetRoot, ...sampleIds.flatMap((sampleId) => ["--sample-id", sampleId])]
  if (body.force === true) args.push("--force")
  try {
    const result = await runFile(python, args, { cwd: process.cwd(), env: pythonEnv, windowsHide: true, timeout: 60_000 })
    return NextResponse.json({ ok: true, message: "批量 v1 迁移已完成，请继续逐项人工复核。", result: JSON.parse(result.stdout) })
  } catch (error) {
    const value = error as { stdout?: string; stderr?: string }
    if (value.stdout) {
      try {
        return NextResponse.json({ ok: true, message: "批量迁移已执行，但存在失败样本。", result: JSON.parse(value.stdout) })
      } catch {}
    }
    return NextResponse.json({ ok: false, message: value.stderr || (error instanceof Error ? error.message : "批量迁移失败。") }, { status: 422 })
  }
}

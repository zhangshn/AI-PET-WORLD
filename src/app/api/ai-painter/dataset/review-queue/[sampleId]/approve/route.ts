import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

const runFile = promisify(execFile)

export async function POST(_: Request, context: { params: Promise<{ sampleId: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止导入训练数据。" }, { status: 403 })
  }
  const { sampleId } = await context.params
  if (!/^[a-z0-9-]+$/u.test(sampleId)) {
    return NextResponse.json({ ok: false, message: "样本 ID 无效。" }, { status: 400 })
  }
  try {
    const python = path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe")
    const script = path.join(process.cwd(), "ml", "ai-painter", "scripts", "approve_staged_scene.py")
    const root = path.join(process.cwd(), "data", "ai-painter-datasets")
    const result = await runFile(python, [script, sampleId, "--dataset-root", root], {
      cwd: process.cwd(), windowsHide: true, timeout: 30_000,
    })
    return NextResponse.json({ ok: true, message: "样本已批准并导入训练集。", result: JSON.parse(result.stdout) })
  } catch (error) {
    const value = error as { stdout?: string; stderr?: string }
    return NextResponse.json(
      { ok: false, message: value.stdout || value.stderr || "样本导入失败。" },
      { status: 422 }
    )
  }
}

import { execFile } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

const runFile = promisify(execFile)
const SAMPLE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u
const DECISIONS = new Set(["approved", "rejected", "needs_correction"])

type ReviewDecision = {
  structureId?: unknown
  type?: unknown
  decision?: unknown
  reviewerNote?: unknown
}

type ReviewSubmission = {
  sampleId?: unknown
  reviewer?: unknown
  blueprintHash?: unknown
  targetImageHash?: unknown
  overallDecision?: unknown
  overallConfirmation?: unknown
  decisions?: unknown
}

export async function POST(request: Request, context: { params: Promise<{ sampleId: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止确认 v1 Blueprint。" }, { status: 403 })
  }
  const { sampleId } = await context.params
  if (!SAMPLE_ID_PATTERN.test(sampleId)) {
    return NextResponse.json({ ok: false, message: "样本 ID 无效。" }, { status: 422 })
  }
  const parsed = await parseSubmission(request, sampleId)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 422 })
  }
  const temporaryRoot = path.join(process.cwd(), "data", "ai-painter-datasets", ".review-v1-work")
  const temporaryFile = path.join(temporaryRoot, `${sampleId}.review.json`)
  try {
    await mkdir(temporaryRoot, { recursive: true })
    await writeFile(temporaryFile, JSON.stringify(parsed.submission, null, 2), "utf8")
    const python = path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe")
    const script = path.join(process.cwd(), "ml", "ai-painter", "scripts", "confirm_scene_annotation_v1.py")
    const datasetRoot = path.join(process.cwd(), "data", "ai-painter-datasets")
    const result = await runFile(python, [script, sampleId, "--dataset-root", datasetRoot, "--submission", temporaryFile], {
      cwd: process.cwd(), windowsHide: true, timeout: 30_000,
    })
    return NextResponse.json({ ok: true, message: "已完成人工复核，可进入受控实验数据读取。", result: JSON.parse(result.stdout) })
  } catch (error) {
    const value = error as { stdout?: string; stderr?: string }
    return NextResponse.json({ ok: false, message: value.stdout || value.stderr || (error instanceof Error ? error.message : "v1 复核失败。") }, { status: 422 })
  } finally {
    await rm(temporaryFile, { force: true })
  }
}

async function parseSubmission(request: Request, sampleId: string): Promise<{ ok: true; submission: ReviewSubmission } | { ok: false; message: string }> {
  let body: ReviewSubmission
  try {
    body = await request.json() as ReviewSubmission
  } catch {
    return { ok: false, message: "复核请求体必须是 JSON。" }
  }
  const errors: string[] = []
  if (!body || typeof body !== "object") errors.push("复核请求体不能为空。")
  if (body.sampleId !== sampleId) errors.push("复核请求 sampleId 与路由不一致。")
  if (typeof body.reviewer !== "string" || !body.reviewer.trim()) errors.push("审核人不能为空。")
  if (typeof body.blueprintHash !== "string" || !body.blueprintHash) errors.push("Blueprint 哈希不能为空。")
  if (typeof body.targetImageHash !== "string" || !body.targetImageHash) errors.push("target.png 哈希不能为空。")
  if (body.overallDecision !== "approved" || body.overallConfirmation !== true) errors.push("整体复核声明必须为 approved。")
  if (!Array.isArray(body.decisions) || body.decisions.length === 0) {
    errors.push("decisions 数组不能为空。")
  } else {
    errors.push(...validateDecisions(body.decisions as ReviewDecision[]))
  }
  if (errors.length > 0) return { ok: false, message: errors.join("; ") }
  return { ok: true, submission: body }
}

function validateDecisions(decisions: ReviewDecision[]) {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const item of decisions) {
    if (!item || typeof item !== "object") {
      errors.push("复核项必须是对象。")
      continue
    }
    if (typeof item.structureId !== "string" || !item.structureId) {
      errors.push("复核项 structureId 不能为空。")
      continue
    }
    if (seen.has(item.structureId)) errors.push(`复核项重复：${item.structureId}`)
    seen.add(item.structureId)
    if (typeof item.type !== "string" || !item.type) errors.push(`复核项类型不能为空：${item.structureId}`)
    if (typeof item.decision !== "string" || !DECISIONS.has(item.decision)) errors.push(`复核决定无效：${item.structureId}`)
    if (item.decision !== "approved") errors.push(`复核项未通过：${item.structureId}`)
    if (item.reviewerNote !== undefined && typeof item.reviewerNote !== "string") errors.push(`复核备注必须是文本：${item.structureId}`)
  }
  return errors
}

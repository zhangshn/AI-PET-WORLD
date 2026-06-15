import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"

const CANDIDATE_ROOT = path.join(process.cwd(), "data", "ai-painter-assets", "candidates")
const QUALITY_ROOT = path.join(process.cwd(), "data", "ai-painter-quality", "vj-b2", "samples")
const SAFE_ID = /^[a-z0-9_-]+$/
const DECISIONS = new Set(["acceptable", "unacceptable", "redraw"])

type CandidateMetadata = {
  assetId: string
  category: string
  admission: string
  trainable: boolean
  sprite: { sha256: string }
  quality?: { technicalGate?: string }
}

type TechnicalReview = {
  status: string
  vjB?: { status?: string }
}

type CandidateReview = {
  schemaVersion: "vj-b2-candidate-review-v1"
  assetId: string
  decision: "acceptable" | "unacceptable" | "redraw"
  reasonZh: string
  reviewer: string
  reviewedAt: string
  imageSha256: string
  qualitySampleId: string | null
  trainable: false
}

export async function GET() {
  const entries = await safeDirectories(CANDIDATE_ROOT)
  const candidates = await Promise.all(entries.map(async (assetId) => {
    try {
      const root = path.join(CANDIDATE_ROOT, assetId)
      const metadata = await readJson<CandidateMetadata>(path.join(root, "metadata.json"))
      const technicalReview = await readJson<TechnicalReview>(path.join(root, "visual-review.json"))
      const review = await readOptionalJson<CandidateReview>(path.join(root, "vj-b2-review.json"))
      const drawingProfile = await readOptionalJson(path.join(root, "drawing-profile.json"))
      const referenceComparison = await readOptionalJson(path.join(root, "reference-comparison.json"))
      return {
        assetId,
        category: metadata.category,
        technicalPassed: technicalReview.status === "passed" && technicalReview.vjB?.status === "passed",
        review,
        drawingProfile,
        referenceComparison,
      }
    } catch {
      return null
    }
  }))
  return Response.json({ candidates: candidates.filter(Boolean) }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "生产环境禁止修改本地审核数据。" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求 JSON 无效。" }, { status: 400 })
  }
  if (!isReviewRequest(body)) {
    return Response.json({ error: "审核参数无效。" }, { status: 400 })
  }

  const { assetId, decision } = body
  const candidateDir = path.join(CANDIDATE_ROOT, assetId)
  const reviewPath = path.join(candidateDir, "vj-b2-review.json")
  try {
    const existing = await readOptionalJson<CandidateReview>(reviewPath)
    if (existing) {
      return Response.json({ error: "该候选已经完成 VJ-B2 审核，禁止直接覆盖历史结论。", review: existing }, { status: 409 })
    }

    const metadata = await readJson<CandidateMetadata>(path.join(candidateDir, "metadata.json"))
    const technicalReview = await readJson<TechnicalReview>(path.join(candidateDir, "visual-review.json"))
    const comparison = await readOptionalJson<{ warningsZh?: string[]; recommendation?: string }>(
      path.join(candidateDir, "reference-comparison.json"),
    )
    const reasonZh = body.reasonZh.trim() || automaticReason(decision, comparison)
    if (
      metadata.assetId !== assetId ||
      metadata.admission !== "candidate" ||
      metadata.trainable !== false ||
      metadata.quality?.technicalGate !== "passed" ||
      technicalReview.status !== "passed" ||
      technicalReview.vjB?.status !== "passed"
    ) {
      return Response.json({ error: "候选身份或 VJ-A/VJ-B1 技术状态不满足审核条件。" }, { status: 409 })
    }

    const spritePath = path.join(candidateDir, "sprite.png")
    const sprite = await readFile(spritePath)
    const imageSha256 = sha256(sprite)
    if (metadata.sprite.sha256 !== imageSha256) {
      return Response.json({ error: "候选图片哈希与 metadata 不一致，禁止审核。" }, { status: 409 })
    }

    const qualitySampleId = decision === "redraw" ? null : `reviewed-${assetId}`
    if (qualitySampleId) {
      const sampleDir = path.join(QUALITY_ROOT, qualitySampleId)
      try {
        await readFile(path.join(sampleDir, "label.json"))
        return Response.json({ error: "对应 VJ-B2 质量样本已存在，禁止重复登记。" }, { status: 409 })
      } catch {
        await mkdir(sampleDir, { recursive: false })
        await writeFile(path.join(sampleDir, "sprite.png"), sprite)
        await writeJson(path.join(sampleDir, "label.json"), {
          schemaVersion: "vj-b2-quality-sample-v1",
          sampleId: qualitySampleId,
          category: metadata.category,
          qualityLabel: decision,
          sourceKind: "self_owned_project_asset",
          reviewBasis: "project_confirmed_visual_target",
          imageSha256,
          evidenceZh: [reasonZh],
          lineage: {
            sourceAssetId: assetId,
            variationKind: "independent_tree_candidate",
            creationMethod: "project_local_layered_pixel_generation",
          },
        })
      }
    }

    const review: CandidateReview = {
      schemaVersion: "vj-b2-candidate-review-v1",
      assetId,
      decision,
      reasonZh,
      reviewer: "project-owner",
      reviewedAt: new Date().toISOString(),
      imageSha256,
      qualitySampleId,
      trainable: false,
    }
    await writeJson(reviewPath, review)
    return Response.json({ status: "review_saved", review })
  } catch (error) {
    const message = error instanceof Error ? error.message : "审核写入失败。"
    return Response.json({ error: message }, { status: 500 })
  }
}

function isReviewRequest(value: unknown): value is {
  assetId: string
  decision: "acceptable" | "unacceptable" | "redraw"
  reasonZh: string
} {
  if (!value || typeof value !== "object") return false
  const body = value as Record<string, unknown>
  return typeof body.assetId === "string" && SAFE_ID.test(body.assetId)
    && typeof body.decision === "string" && DECISIONS.has(body.decision)
    && typeof body.reasonZh === "string"
}

function automaticReason(
  decision: "acceptable" | "unacceptable" | "redraw",
  comparison: { warningsZh?: string[]; recommendation?: string } | null,
) {
  const warnings = comparison?.warningsZh?.filter(Boolean) ?? []
  if (decision === "acceptable") {
    return "项目所有者确认该候选的轮廓、结构、材质、光影和像素细节符合当前标准。"
  }
  if (warnings.length > 0) return warnings.join("；")
  return decision === "redraw"
    ? "项目所有者确认该候选需要重新绘制，暂不进入质量样本。"
    : "项目所有者确认该候选未达到当前标准树资产质量。"
}

async function safeDirectories(root: string) {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && SAFE_ID.test(entry.name))
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T
}

async function readOptionalJson<T>(file: string): Promise<T | null> {
  try {
    return await readJson<T>(file)
  } catch {
    return null
  }
}

async function writeJson(file: string, value: unknown) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

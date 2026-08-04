import { NextRequest } from "next/server"
import {
  OwnerReviewConflictError,
  OwnerReviewInputError,
  OwnerReviewNotFoundError,
  runOriginalImageOwnerReview,
  type OwnerReviewDecision,
} from "@/server/ai-painter-owner-review-runner"
import { claimOwnerWriteAuthorization, OwnerWriteAuthorizationError } from "@/server/project-owner-write-authorization"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ categoryId: string; recordId: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "生产环境禁止修改本地审核数据。" }, { status: 403 })
  }
  if (!isLocalRequest(request)) {
    return Response.json({ error: "原图审核只允许从本机控制台提交。" }, { status: 403 })
  }

  const { categoryId, recordId } = await context.params
  if (!isSafeId(categoryId) || !isSafeId(recordId)) {
    return Response.json({ error: "原图记录标识无效。" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求 JSON 无效。" }, { status: 400 })
  }
  if (!isOwnerReviewBody(body)) {
    return Response.json({ error: "审核参数无效。" }, { status: 400 })
  }

  try {
    const authorization = await claimOwnerWriteAuthorization(request, {
      action: "ai_painter.original_image.owner_review",
      target: { categoryId, recordId },
      payload: body,
    })
    const result = await runOriginalImageOwnerReview({
      categoryId,
      recordId,
      decision: body.decision,
      comment: body.comment,
      ownerCommandRef: authorization.ownerCommandRef,
    })
    return Response.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "审核程序执行失败。"
    if (error instanceof OwnerWriteAuthorizationError) return Response.json({ error: message, code: error.code }, { status: error.status })
    if (error instanceof OwnerReviewInputError) return Response.json({ error: message }, { status: 400 })
    if (error instanceof OwnerReviewNotFoundError) return Response.json({ error: message }, { status: 404 })
    if (error instanceof OwnerReviewConflictError) return Response.json({ error: message }, { status: 409 })
    return Response.json({ error: message }, { status: 500 })
  }
}

function isOwnerReviewBody(value: unknown): value is { decision: OwnerReviewDecision; comment: string } {
  if (!value || typeof value !== "object") return false
  const body = value as Record<string, unknown>
  return (body.decision === "approved" || body.decision === "rejected")
    && typeof body.comment === "string"
}

function isSafeId(value: string) {
  return /^[a-z0-9][a-z0-9_-]{1,95}$/.test(value)
}

function isLocalRequest(request: NextRequest) {
  if (!isLocalHostname(request.nextUrl.hostname)) return false
  const origin = request.headers.get("origin")
  if (!origin) return true
  try {
    return isLocalHostname(new URL(origin).hostname)
  } catch {
    return false
  }
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

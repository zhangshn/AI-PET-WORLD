import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualFactManifest,
  readLatestWorldVisualCandidateRecord,
} from "@/world/world-visual-painter"

export async function GET() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能读取世界画面候选图。",
        messageEn:
          "Runtime world has not been created, so no world image candidate can be read.",
        readStatus: readResult.status,
        tags: ["world_visual_candidate_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const factManifest = buildWorldVisualFactManifest({
    saveRecord: readResult.record,
  })
  const candidateReadResult = await readLatestWorldVisualCandidateRecord({
    ownerId: readResult.record.ownerId,
    worldId: readResult.record.worldId,
    currentTick: readResult.record.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
  })

  if (candidateReadResult.status !== "found" || !candidateReadResult.record) {
    return NextResponse.json(
      {
        ok: false,
        status: candidateReadResult.status,
        message:
          candidateReadResult.status === "invalid"
            ? "隐藏候选图没有通过当前 VJ-0 读取闸门，不能进入 VisualJudge。"
            : "还没有隐藏候选图，需要先调用 /api/world/visual/generate。",
        messageEn:
          candidateReadResult.status === "invalid"
            ? "The hidden candidate did not pass the current VJ-0 read gate and cannot enter VisualJudge."
            : "No hidden candidate exists yet. Call /api/world/visual/generate first.",
        currentRuntimeGate: {
          worldId: readResult.record.worldId,
          tick: readResult.record.tick,
          sourceFactIds: factManifest.sourceFactIds,
          sourceFactIdCount: factManifest.sourceFactIds.length,
        },
        readAudit: {
          status: candidateReadResult.status,
          path: candidateReadResult.path,
          warnings: candidateReadResult.warnings,
          tags: candidateReadResult.tags,
        },
        canShowToPlayer: false,
        displayRule:
          "没有匹配当前 tick/sourceFactIds 的隐藏候选图时，VisualJudge 不能运行，/world 也不能展示画面。",
        displayRuleEn:
          "Without a hidden candidate that matches the current tick/sourceFactIds, VisualJudge cannot run and /world cannot display anything.",
        tags: [
          "world_visual_candidate_api",
          "current_tick_gate_checked",
          "current_source_facts_gate_checked",
          ...candidateReadResult.tags,
        ],
      },
      {
        status:
          candidateReadResult.status === "empty"
            ? 404
            : candidateReadResult.status === "invalid"
              ? 409
              : 500,
      }
    )
  }

  const record = candidateReadResult.record
  const request = record.aiImageGenerationRequest
  const condition = record.generationCondition

  return NextResponse.json(
    {
      ok: true,
      status: candidateReadResult.status,
      record,
      currentRuntimeGate: {
        worldId: readResult.record.worldId,
        tick: readResult.record.tick,
        sourceFactIds: factManifest.sourceFactIds,
        sourceFactIdCount: factManifest.sourceFactIds.length,
      },
      provenance: {
        candidateId: record.candidate.candidateId,
        sourceKind: record.candidate.sourceKind,
        modelVersion: record.candidate.modelVersion,
        conditionId: condition.conditionId,
        aiImageGenerationRequestId: request?.requestId ?? null,
        visualFixConditionCount: condition.fixConditions.length,
        sourceFactIds: record.sourceFactIds,
        imageUrl: record.candidate.imageUrl,
        imageUrlAudit: buildImageUrlAudit(record.candidate.imageUrl),
        imageFormat: record.candidate.imageFormat,
        width: record.candidate.width,
        height: record.candidate.height,
        license: record.candidate.license,
        originalityConfirmed: record.candidate.originalityConfirmed,
        canShowToPlayer: record.candidate.canShowToPlayer,
      },
      generationInputAudit: {
        hasGenerationCondition: true,
        hasAiImageGenerationRequest: Boolean(request),
        conditionVersion: condition.version,
        conditionWorldId: condition.worldId,
        conditionTick: condition.tick,
        sourceFactIds: condition.sourceFactIds,
        safetyCondition: condition.safetyCondition,
        sceneCondition: condition.sceneCondition,
        spatialCondition: condition.spatialCondition,
        styleCondition: condition.styleCondition,
        fixConditions: condition.fixConditions,
        output: request?.output ?? null,
      },
      canShowToPlayer: false,
      displayRule: "候选图只供 VisualJudge 审核，不允许直接展示。",
      displayRuleEn:
        "The candidate is only for VisualJudge review and cannot be displayed directly.",
      nextStep: {
        zh: "下一步只能调用 /api/world/visual/judge。候选图通过审核后，才可能生成 ApprovedFrame。",
        en: "The next step is /api/world/visual/judge only. The candidate may become ApprovedFrame only after passing VisualJudge.",
      },
      tags: [
        "world_visual_candidate_api",
        "hidden_candidate_only",
        "provenance_exposed_for_audit",
        "current_tick_gate_checked",
        "current_source_facts_gate_checked",
        "not_player_visible",
        ...candidateReadResult.tags,
      ],
    },
    { status: 200 }
  )
}

function buildImageUrlAudit(imageUrl: string) {
  if (imageUrl.startsWith("data:image/")) {
    return {
      scheme: "data:image",
      allowed: true,
      canBeFetchedByVisualJudge: true,
      reason: "data_image_url_allowed",
      reasonZh: "候选图使用 data:image URL，VisualJudge 可以读取图片本体。",
      reasonEn:
        "The candidate uses a data:image URL. VisualJudge can read the image bytes.",
      tags: ["image_url_audit", "data_image_url_allowed"],
    }
  }

  try {
    const url = new URL(imageUrl)
    const allowed = url.protocol === "http:" || url.protocol === "https:"

    return {
      scheme: url.protocol.replace(":", ""),
      allowed,
      canBeFetchedByVisualJudge: allowed,
      reason: allowed ? "network_image_url_allowed" : "scheme_not_allowed",
      reasonZh: allowed
        ? "候选图使用 http/https URL，VisualJudge 可以尝试读取图片本体。"
        : "候选图 imageUrl 的协议不被允许。",
      reasonEn: allowed
        ? "The candidate uses an http/https URL. VisualJudge can try reading the image bytes."
        : "The candidate imageUrl uses a disallowed scheme.",
      tags: [
        "image_url_audit",
        allowed ? "network_image_url_allowed" : "scheme_not_allowed",
      ],
    }
  } catch {
    return {
      scheme: "invalid",
      allowed: false,
      canBeFetchedByVisualJudge: false,
      reason: "invalid_image_url",
      reasonZh: "候选图 imageUrl 不是有效 URL。",
      reasonEn: "The candidate imageUrl is not a valid URL.",
      tags: ["image_url_audit", "invalid_image_url"],
    }
  }
}

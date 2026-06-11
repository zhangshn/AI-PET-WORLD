import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualPainterDecision,
  writeWorldVisualCandidateRecord,
} from "@/world/world-visual-painter"
import type { WorldVisualAiImageCandidate } from "@/world/world-visual-painter"

const DEVELOPMENT_TEST_IMAGE_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="

export async function POST() {
  const runtime = await readWorldRuntimeSaveRecord()

  if (runtime.status !== "found" || !runtime.record) {
    return NextResponse.json(
      {
        ok: false,
        status: "runtime_world_required",
        message: "世界尚未创建，不能生成世界画面候选图。",
        messageEn:
          "The runtime world has not been created, so no world image candidate can be generated.",
        canShowToPlayer: false,
      },
      { status: 409 }
    )
  }

  const decision = await buildWorldVisualPainterDecision({
    saveRecord: runtime.record,
  })

  if (isDevelopmentRuntime()) {
    const candidate: WorldVisualAiImageCandidate = {
      candidateId: `development-test-candidate-${runtime.record.worldId}-${runtime.record.tick}`,
      sourceKind: "development_test_asset",
      modelVersion: null,
      imageUrl: DEVELOPMENT_TEST_IMAGE_URL,
      imageFormat: "png",
      width: 1,
      height: 1,
      license: "self_owned",
      originalityConfirmed: true,
      sourceDescription: {
        zh: "开发环境自有测试图，仅用于验证 Candidate 存储和只读读取链路。",
        en: "Self-owned development test image used only to verify Candidate storage and read-only loading.",
      },
      conditionId: decision.generationCondition.conditionId,
      sourceFactIds: decision.factManifest.sourceFactIds,
      canShowToPlayer: false,
      generationNotes: {
        zh: "该候选图明确标记为 development_test_asset，不是内部模型生成，不允许进入正式 ApprovedFrame。",
        en: "This candidate is explicitly marked as development_test_asset. It is not internally model-generated and must not become a formal ApprovedFrame.",
      },
      tags: [
        "development_test_asset",
        "a4_development_chain_validation",
        "self_owned_test_image",
        "not_project_model_generated",
        "not_for_approved_frame",
        "not_player_visible",
      ],
    }

    const writeResult = await writeWorldVisualCandidateRecord({
      ownerId: runtime.record.ownerId,
      worldId: runtime.record.worldId,
      tick: runtime.record.tick,
      candidate,
      generationCondition: decision.generationCondition,
      factManifest: decision.factManifest,
      aiImageGenerationRequest: null,
    })

    return NextResponse.json(
      {
        ok: writeResult.ok,
        status: writeResult.ok
          ? "development_test_candidate_written"
          : "development_test_candidate_blocked",
        message: writeResult.ok
          ? "开发测试候选图已写入 Candidate 存储。"
          : "开发测试候选图被 Candidate 存储闸门阻断。",
        messageEn: writeResult.ok
          ? "Development test candidate was written to Candidate storage."
          : "Development test candidate was blocked by the Candidate store gate.",
        candidate,
        candidatePath: writeResult.path,
        warnings: writeResult.warnings,
        canShowToPlayer: false,
        displayRule:
          "development_test_asset 只能验证开发链路，不能冒充 project_model_generated，不能生成正式 ApprovedFrame，/world 不能展示。",
        displayRuleEn:
          "development_test_asset may only verify the development chain. It must not pretend to be project_model_generated, must not create a formal ApprovedFrame, and must not be displayed by /world.",
        nextStep: {
          zh: "可读取 /api/world/visual/candidate 验证隐藏候选图存储；调用 judge 也必须继续阻断 ApprovedFrame。",
          en: "Read /api/world/visual/candidate to verify hidden candidate storage. Calling judge must still block ApprovedFrame creation.",
        },
        tags: [
          "world_visual_generate_api",
          "a4_development_chain_validation",
          "development_test_asset_only",
          "no_fake_ai_generation",
          "not_player_visible",
          ...writeResult.tags,
        ],
      },
      { status: writeResult.ok ? 200 : 422 }
    )
  }

  if (!decision.imageModelStatus.canGenerate) {
    return NextResponse.json(
      {
        ok: false,
        status: decision.imageModelStatus.status,
        message: decision.imageModelStatus.reason.zh,
        messageEn: decision.imageModelStatus.reason.en,
        imageModel: decision.imageModelStatus,
        worldGenerationConditionStatus: "not_implemented",
        nextStage: "AI-PAINTER A3: VJ-0 display gate",
        canShowToPlayer: false,
        displayRule: "内部模型产生真实候选图并通过 VisualJudge 前，禁止展示世界画面。",
        displayRuleEn:
          "The world image remains hidden until the internal model produces a real candidate that passes VisualJudge.",
        tags: [
          "world_visual_generate_api",
          "internal_model_only",
          "generation_blocked",
          "no_provider_fallback",
        ],
      },
      { status: 501 }
    )
  }

  return NextResponse.json(
    {
      ok: false,
      status: "internal_inference_not_implemented",
      message: "内部模型配置存在，但项目推理实现尚未完成，不能生成候选图。",
      messageEn:
        "Internal model configuration exists, but project inference is not implemented and cannot generate a candidate.",
      imageModel: decision.imageModelStatus,
      canShowToPlayer: false,
      tags: [
        "world_visual_generate_api",
        "internal_model_only",
        "inference_not_implemented",
        "no_fake_candidate",
      ],
    },
    { status: 501 }
  )
}

function isDevelopmentRuntime(): boolean {
  return process.env.NODE_ENV !== "production"
}

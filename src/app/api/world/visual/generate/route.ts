import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualPainterDecision,
  runWorldVisualAiImageGenerationRequest,
  writeWorldVisualCandidateRecord,
} from "@/world/world-visual-painter"

export async function POST() {
  const readResult = await readWorldRuntimeSaveRecord()

  if (readResult.status !== "found" || !readResult.record) {
    return NextResponse.json(
      {
        ok: false,
        message: "世界尚未创建，不能生成世界画面候选图。",
        messageEn:
          "Runtime world has not been created, so no world image candidate can be generated.",
        readStatus: readResult.status,
        tags: ["world_visual_generate_api", "runtime_save_required"],
      },
      { status: 409 }
    )
  }

  const decision = await buildWorldVisualPainterDecision({
    saveRecord: readResult.record,
  })

  if (decision.aiImageCandidate && decision.promptPackage) {
    const writeResult = await writeWorldVisualCandidateRecord({
      ownerId: readResult.record.ownerId,
      worldId: readResult.record.worldId,
      tick: readResult.record.tick,
      candidate: decision.aiImageCandidate,
      promptPackage: decision.promptPackage,
      factManifest: decision.factManifest,
    })

    return NextResponse.json(
      {
        ok: writeResult.ok,
        candidate: decision.aiImageCandidate,
        persisted: writeResult.ok,
        candidatePath: writeResult.path ?? null,
        persistenceWarnings: writeResult.warnings ?? [],
        error: writeResult.ok
          ? null
          : "隐藏候选图写入失败，禁止进入 VisualJudge。",
        canShowToPlayer: false,
        displayRule:
          "候选图已隐藏保存，必须通过 Visual Judge 后才能生成 ApprovedFrame。",
        displayRuleEn:
          "The candidate was persisted as hidden and must pass Visual Judge before ApprovedFrame can be created.",
        tags: [
          "world_visual_generate_api",
          "hidden_candidate_persisted",
          ...(writeResult.tags ?? []),
        ],
      },
      { status: writeResult.ok ? 200 : 500 }
    )
  }

  if (!decision.aiImageGenerationRequest || !decision.promptPackage) {
    return NextResponse.json(
      {
        ok: false,
        message: decision.aiImageProviderStatus.reason.zh,
        messageEn: decision.aiImageProviderStatus.reason.en,
        provider: decision.aiImageProviderStatus,
        displayRule: "没有 ApprovedFrame 前禁止展示。",
        displayRuleEn: "Display is blocked until ApprovedFrame exists.",
        tags: ["world_visual_generate_api", "provider_not_ready"],
      },
      { status: 409 }
    )
  }

  const generationResult = await runWorldVisualAiImageGenerationRequest({
    request: decision.aiImageGenerationRequest,
    factManifest: decision.factManifest,
    promptPackage: decision.promptPackage,
  })
  const writeResult = generationResult.candidate
    ? await writeWorldVisualCandidateRecord({
        ownerId: readResult.record.ownerId,
        worldId: readResult.record.worldId,
        tick: readResult.record.tick,
        candidate: generationResult.candidate,
        promptPackage: decision.promptPackage,
        factManifest: decision.factManifest,
      })
    : null

  return NextResponse.json(
    {
      ok: generationResult.ok,
      candidate: generationResult.candidate,
      persisted: writeResult?.ok ?? false,
      candidatePath: writeResult?.path ?? null,
      persistenceWarnings: writeResult?.warnings ?? [],
      error: generationResult.error,
      canShowToPlayer: false,
      displayRule:
        "候选图仍然隐藏，必须通过 Visual Judge 后才能生成 ApprovedFrame。",
      displayRuleEn:
        "The candidate remains hidden and must pass Visual Judge before ApprovedFrame can be created.",
      tags: [
        "world_visual_generate_api",
        ...(writeResult?.tags ?? []),
        ...generationResult.tags,
      ],
    },
    { status: generationResult.ok && writeResult?.ok !== false ? 200 : 502 }
  )
}
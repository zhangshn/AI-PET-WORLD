import { NextResponse } from "next/server"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualPainterDecision,
  runWorldVisualAiImageGenerationRequest,
  writeWorldVisualCandidateRecord,
} from "@/world/world-visual-painter"
import type {
  WorldVisualAiImageGenerationResult,
  WorldVisualPainterDecision,
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
  const generationInputAudit = buildGenerationInputAudit(decision)

  if (decision.aiImageCandidate && decision.promptPackage) {
    const writeResult = await writeWorldVisualCandidateRecord({
      ownerId: readResult.record.ownerId,
      worldId: readResult.record.worldId,
      tick: readResult.record.tick,
      candidate: decision.aiImageCandidate,
      promptPackage: decision.promptPackage,
      factManifest: decision.factManifest,
      aiImageGenerationRequest: decision.aiImageGenerationRequest,
    })

    return NextResponse.json(
      {
        ok: writeResult.ok,
        candidate: decision.aiImageCandidate,
        generationInputAudit,
        generationResultAudit: {
          attemptedProviderCall: false,
          reason: "已有隐藏 AiImageCandidate，由当前决策链直接登记候选图。",
          reasonEn:
            "A hidden AiImageCandidate already exists in the current decision chain and was registered directly.",
          responseContractPassed: null,
          responseContractFailureTags: [],
        },
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
          "generation_input_audit_attached",
          "generation_result_audit_attached",
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
        generationInputAudit,
        generationResultAudit: {
          attemptedProviderCall: false,
          reason: "图像生成入口尚未就绪，未调用 AI Image Generation Model。",
          reasonEn:
            "The image generation entry is not ready, so the AI Image Generation Model was not called.",
          responseContractPassed: null,
          responseContractFailureTags: [],
        },
        displayRule: "没有 ApprovedFrame 前禁止展示。",
        displayRuleEn: "Display is blocked until ApprovedFrame exists.",
        tags: [
          "world_visual_generate_api",
          "provider_not_ready",
          "generation_input_audit_attached",
          "generation_result_audit_attached",
        ],
      },
      { status: 409 }
    )
  }

  const generationResult = await runWorldVisualAiImageGenerationRequest({
    request: decision.aiImageGenerationRequest,
    factManifest: decision.factManifest,
    promptPackage: decision.promptPackage,
  })
  const generationResultAudit = buildGenerationResultAudit(generationResult)
  const writeResult = generationResult.candidate
    ? await writeWorldVisualCandidateRecord({
        ownerId: readResult.record.ownerId,
        worldId: readResult.record.worldId,
        tick: readResult.record.tick,
        candidate: generationResult.candidate,
        promptPackage: decision.promptPackage,
        factManifest: decision.factManifest,
        aiImageGenerationRequest: decision.aiImageGenerationRequest,
      })
    : null

  return NextResponse.json(
    {
      ok: generationResult.ok,
      candidate: generationResult.candidate,
      generationInputAudit,
      generationResultAudit,
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
        "generation_input_audit_attached",
        "generation_result_audit_attached",
        ...(writeResult?.tags ?? []),
        ...generationResult.tags,
      ],
    },
    { status: generationResult.ok && writeResult?.ok !== false ? 200 : 502 }
  )
}

function buildGenerationInputAudit(decision: WorldVisualPainterDecision) {
  const request = decision.aiImageGenerationRequest
  const controlSketch = request?.body.controlSketch ?? null
  const visualFixHints = request?.body.visualFixHints ?? []
  const responseContract = request?.body.responseContract ?? null

  return {
    hasPromptPackage: Boolean(decision.promptPackage),
    hasAiImageGenerationRequest: Boolean(request),
    requestId: request?.requestId ?? null,
    providerKind: request?.providerKind ?? decision.aiImageProviderStatus.providerKind,
    hasControlSketch: Boolean(controlSketch),
    controlSketchId: controlSketch?.controlSketchId ?? null,
    controlSketchCanShowToPlayer: controlSketch?.canShowToPlayer ?? null,
    controlSketchCannotApprove: controlSketch?.cannotApprove ?? null,
    hasVisualFixHints: visualFixHints.length > 0,
    visualFixPlanId: request?.body.metadata.visualFixPlanId ?? null,
    visualFixHintCount: visualFixHints.length,
    visualFixHints: visualFixHints.map((hint) => ({
      sourceCheckId: hint.sourceCheckId,
      actionType: hint.actionType,
      priority: hint.priority,
      changesWorldFacts: hint.changesWorldFacts,
      instructionZh: hint.instructionZh,
      instructionEn: hint.instructionEn,
      expectedResultZh: hint.expectedResultZh,
      expectedResultEn: hint.expectedResultEn,
      tags: hint.tags,
    })),
    responseContract,
    responseContractAudit: responseContract
      ? {
          requiredFields: responseContract.requiredFields,
          allowedImageFormats: responseContract.allowedImageFormats,
          allowedLicenses: responseContract.allowedLicenses,
          minimumWidth: responseContract.minimumWidth,
          minimumHeight: responseContract.minimumHeight,
          canShowToPlayer: responseContract.canShowToPlayer,
          mustPersistAsAiImageCandidate:
            responseContract.mustPersistAsAiImageCandidate,
          mustPassVisualJudge: responseContract.mustPassVisualJudge,
          tags: responseContract.tags,
        }
      : null,
    safety: request?.body.safety ?? null,
    imageStyle: request?.body.imageStyle ?? null,
    outputSize: request?.body.outputSize ?? null,
    sourceFactIds: decision.factManifest.sourceFactIds,
    canShowToPlayer: false,
    displayRule:
      "生成请求只用于 AI Image Generation Model，ControlSketch 和候选图都不能直接展示。",
    displayRuleEn:
      "The generation request is only for the AI Image Generation Model. ControlSketch and candidates must not be displayed directly.",
  }
}

function buildGenerationResultAudit(
  generationResult: WorldVisualAiImageGenerationResult
) {
  const responseContractFailureTags = generationResult.tags.filter((tag) =>
    tag.startsWith("response_contract_failed")
  )
  const responseContractDetailTags = generationResult.tags.filter((tag) =>
    [
      "missing_required_fields",
      "empty_image_url",
      "invalid_image_format",
      "invalid_width",
      "invalid_height",
      "image_size_below_contract",
      "invalid_license",
      "originality_not_confirmed",
      "unsafe_contract_gate",
    ].includes(tag)
  )

  return {
    attemptedProviderCall: true,
    ok: generationResult.ok,
    candidateCreated: Boolean(generationResult.candidate),
    responseContractPassed: generationResult.tags.includes(
      "response_contract_passed"
    ),
    responseContractFailed: generationResult.tags.includes(
      "response_contract_failed"
    ),
    responseContractFailureTags: [
      ...responseContractFailureTags,
      ...responseContractDetailTags,
    ],
    error: generationResult.error,
    candidateId: generationResult.candidate?.candidateId ?? null,
    imageFormat: generationResult.candidate?.imageFormat ?? null,
    width: generationResult.candidate?.width ?? null,
    height: generationResult.candidate?.height ?? null,
    license: generationResult.candidate?.license ?? null,
    originalityConfirmed:
      generationResult.candidate?.originalityConfirmed ?? null,
    canShowToPlayer: false,
    displayRule:
      "模型返回结果必须先变成隐藏 AiImageCandidate，再进入 VisualJudge。",
    displayRuleEn:
      "The model response must first become a hidden AiImageCandidate and then enter VisualJudge.",
    tags: generationResult.tags,
  }
}
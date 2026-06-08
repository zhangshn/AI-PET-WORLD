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
        canShowToPlayer: false,
        pipelineNextStep: {
          zh: "先创建世界，再重新调用生成接口。",
          en: "Create the world first, then call the generation endpoint again.",
          endpoint: "/create-world",
        },
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
          responseContractFailed: false,
          responseContractNotConfirmed: false,
          localModelImplementationNotConnected: false,
          responseContractFailureTags: [],
        },
        pipelineNextStep: buildPipelineNextStep({
          generationOk: true,
          candidateCreated: true,
          persisted: writeResult.ok,
          providerCalled: false,
          responseContractFailed: false,
          localModelImplementationNotConnected: false,
        }),
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
          "pipeline_next_step_attached",
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
          responseContractFailed: false,
          responseContractNotConfirmed: false,
          localModelImplementationNotConnected: false,
          responseContractFailureTags: [],
        },
        pipelineNextStep: {
          zh: "先检查 GET /api/world/visual/provider、GET /api/world/visual/provider-health、GET /api/world/visual/provider-dry-run。",
          en: "Check GET /api/world/visual/provider, GET /api/world/visual/provider-health, and GET /api/world/visual/provider-dry-run first.",
          endpoint: "GET /api/world/visual/provider",
        },
        displayRule: "没有 ApprovedFrame 前禁止展示。",
        displayRuleEn: "Display is blocked until ApprovedFrame exists.",
        canShowToPlayer: false,
        tags: [
          "world_visual_generate_api",
          "provider_not_ready",
          "generation_input_audit_attached",
          "generation_result_audit_attached",
          "pipeline_next_step_attached",
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
  const persisted = writeResult?.ok ?? false

  return NextResponse.json(
    {
      ok: generationResult.ok,
      candidate: generationResult.candidate,
      generationInputAudit,
      generationResultAudit,
      pipelineNextStep: buildPipelineNextStep({
        generationOk: generationResult.ok,
        candidateCreated: Boolean(generationResult.candidate),
        persisted,
        providerCalled: true,
        responseContractFailed: generationResultAudit.responseContractFailed,
        localModelImplementationNotConnected:
          generationResultAudit.localModelImplementationNotConnected,
      }),
      persisted,
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
        "pipeline_next_step_attached",
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
    providerKind:
      request?.providerKind ?? decision.aiImageProviderStatus.providerKind,
    modelTask: request?.body.modelTask ?? null,
    modelTaskAudit: request?.body.modelTask
      ? {
          taskKind: request.body.modelTask.taskKind,
          outputPurpose: request.body.modelTask.outputPurpose,
          worldFrameKind: request.body.modelTask.worldFrameKind,
          mustReturnResponseContract:
            request.body.modelTask.mustReturnResponseContract,
          mustNotDisplayDirectly: request.body.modelTask.mustNotDisplayDirectly,
          mustNotRewriteWorldFacts:
            request.body.modelTask.mustNotRewriteWorldFacts,
          mustNotUseProgrammaticRenderer:
            request.body.modelTask.mustNotUseProgrammaticRenderer,
          mustNotCopyUnlicensedThirdPartyWorks:
            request.body.modelTask.mustNotCopyUnlicensedThirdPartyWorks,
          canShowToPlayer: request.body.modelTask.canShowToPlayer,
          tags: request.body.modelTask.tags,
        }
      : null,
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
      "invalid_image_url_scheme",
      "invalid_image_format",
      "invalid_width",
      "invalid_height",
      "image_size_below_contract",
      "invalid_license",
      "originality_not_confirmed",
      "unsafe_contract_gate",
    ].includes(tag)
  )
  const localModelImplementationNotConnected = generationResult.tags.includes(
    "local_model_implementation_not_connected"
  )
  const responseContractNotConfirmed = generationResult.tags.includes(
    "response_contract_not_confirmed"
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
    responseContractNotConfirmed,
    localModelImplementationNotConnected,
    responseContractFailureTags: [
      ...responseContractFailureTags,
      ...responseContractDetailTags,
    ],
    error: generationResult.error,
    candidateId: generationResult.candidate?.candidateId ?? null,
    imageUrl: generationResult.candidate?.imageUrl ?? null,
    imageUrlAudit: buildImageUrlAudit(
      generationResult.candidate?.imageUrl ?? null
    ),
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

function buildImageUrlAudit(imageUrl: string | null) {
  if (!imageUrl) {
    return {
      scheme: null,
      allowed: false,
      canBeFetchedByVisualJudge: false,
      reason: "missing_image_url",
      reasonZh: "模型没有返回 imageUrl。",
      reasonEn: "The model did not return imageUrl.",
      tags: ["image_url_audit", "missing_image_url"],
    }
  }

  if (imageUrl.startsWith("data:image/")) {
    return {
      scheme: "data:image",
      allowed: true,
      canBeFetchedByVisualJudge: true,
      reason: "data_image_url_allowed",
      reasonZh: "模型返回 data:image URL，VisualJudge 可以读取图片本体。",
      reasonEn:
        "The model returned a data:image URL. VisualJudge can read the image bytes.",
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
        ? "模型返回 http/https URL，VisualJudge 可以尝试读取图片本体。"
        : "模型返回的 imageUrl 协议不被允许。",
      reasonEn: allowed
        ? "The model returned an http/https URL. VisualJudge can try reading the image bytes."
        : "The model returned a disallowed imageUrl scheme.",
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
      reasonZh: "模型返回的 imageUrl 不是有效 URL。",
      reasonEn: "The model returned an invalid imageUrl.",
      tags: ["image_url_audit", "invalid_image_url"],
    }
  }
}

function buildPipelineNextStep(input: {
  generationOk: boolean
  candidateCreated: boolean
  persisted: boolean
  providerCalled: boolean
  responseContractFailed: boolean
  localModelImplementationNotConnected: boolean
}) {
  if (input.generationOk && input.candidateCreated && input.persisted) {
    return {
      zh: "隐藏候选图已保存。下一步调用 POST /api/world/visual/judge 执行 VisualJudge。",
      en: "The hidden candidate has been persisted. Next call POST /api/world/visual/judge to run VisualJudge.",
      endpoint: "POST /api/world/visual/judge",
    }
  }

  if (input.generationOk && input.candidateCreated && !input.persisted) {
    return {
      zh: "图像模型已返回合格候选图，但候选图保存失败。先修复 data/world-visual-candidates 写入问题，禁止进入 VisualJudge。",
      en: "The image model returned a valid candidate, but persistence failed. Fix data/world-visual-candidates persistence before VisualJudge.",
      endpoint: null,
    }
  }

  if (input.localModelImplementationNotConnected) {
    return {
      zh: "本地图像模型入口已收到正式生成请求，但真实 local image model implementation 尚未接入。下一步应连接真实 local image model，并确认它返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "The local image model entry received the formal generation request, but no real local image model implementation is connected. Next connect a real local image model and confirm it returns imageUrl / imageFormat / width / height / license / originalityConfirmed.",
      endpoint: "GET /api/world/visual/provider-dry-run",
      requiredResponseShape: [
        "imageUrl",
        "imageFormat",
        "width",
        "height",
        "license",
        "originalityConfirmed",
      ],
    }
  }

  if (input.responseContractFailed) {
    return {
      zh: "图像模型返回结果没有通过 responseContract。先检查 generationResultAudit.responseContractFailureTags。",
      en: "The image model response did not pass responseContract. Check generationResultAudit.responseContractFailureTags first.",
      endpoint: "GET /api/world/visual/provider",
    }
  }

  if (input.providerCalled) {
    return {
      zh: "图像模型调用失败或没有返回候选图。先检查 provider-health、provider-dry-run 和 generationResultAudit.error。",
      en: "The image model call failed or returned no candidate. Check provider-health, provider-dry-run, and generationResultAudit.error first.",
      endpoint: "GET /api/world/visual/provider-health",
    }
  }

  return {
    zh: "当前还不能生成候选图。先检查 provider 与 runtime world 状态。",
    en: "A candidate cannot be generated yet. Check provider and runtime world status first.",
    endpoint: "GET /api/world/visual/status",
  }
}
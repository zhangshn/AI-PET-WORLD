import type {
  WorldVisualFactManifest,
  WorldVisualFixAction,
  WorldVisualFixPlan,
  WorldVisualReviewCheck,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"

export function buildWorldVisualFixPlan(input: {
  factManifest: WorldVisualFactManifest
  reviewReport: WorldVisualReviewReport
}): WorldVisualFixPlan {
  const failedChecks = input.reviewReport.checks.filter(
    (check) => !check.passed && !check.tags.includes("not_implemented")
  )
  const actions = failedChecks.flatMap((check) => buildActionsForFailedCheck(check))
  const status = actions.length > 0 ? "required" : "not_needed"

  return {
    planId: `visual-fix-${input.factManifest.worldId}-${input.factManifest.tick}`,
    status,
    canShowToPlayer: false,
    summary:
      status === "required"
        ? {
            zh: "当前只能修正视觉生成链路，不能修改世界事实。修正后必须重新生成候选图，并重新进入 VisualJudge。",
            en: "Only the visual generation chain may be fixed; world facts must not change. After fixes, a candidate must be regenerated and re-enter VisualJudge.",
          }
        : {
            zh: "当前审核没有发现需要修正的问题，但仍需等待 ApprovedFrame。",
            en: "The current review found no fixes, but ApprovedFrame is still required.",
          },
    actions,
    sourceReviewScore: input.reviewReport.score,
    sourceFactIds: input.factManifest.sourceFactIds,
    tags: [
      "visual_fix_plan",
      status,
      "visual_expression_only",
      "world_facts_locked",
      "display_blocked",
      "vj_0_vj_1_visual_fix_only",
      "regeneration_only",
    ],
  }
}

function buildActionsForFailedCheck(
  check: WorldVisualReviewCheck
): WorldVisualFixAction[] {
  if (check.id.startsWith("vj_1_")) {
    return [
      action(
        `fix-${check.id}`,
        check.id,
        "generate_ai_image_candidate",
        "high",
        `VJ-1 检测未通过：${check.label.zh}。调整内部图像模型的生成条件并重新生成候选图，不允许修改世界事实，也不允许通过添加标签绕过检测。`,
        `VJ-1 failed: ${check.label.en}. Adjust the internal image model generation conditions and regenerate the candidate. World facts must not change and tags must not bypass the check.`,
        `新候选图真实通过 ${check.label.zh} 检测，并重新进入完整 VisualJudge。`,
        `The new candidate genuinely passes ${check.label.en} and re-enters the full VisualJudge.`
      ),
    ]
  }

  if (
    check.id === "ai_image_candidate" ||
    check.id === "ai_image_candidate_metadata"
  ) {
    return [
      action(
        "fix-ai-image-candidate-metadata",
        check.id,
        "generate_ai_image_candidate",
        "high",
        "重新调用内部图像生成链路或授权导入流程，必须返回完整候选图元数据：candidateId、imageUrl、imageFormat、width、height、license、originalityConfirmed、conditionId、sourceFactIds。候选图仍然禁止展示，必须重新进入 VisualJudge。",
        "Call the internal image generation chain or authorized import flow again. It must return complete candidate metadata: candidateId, imageUrl, imageFormat, width, height, license, originalityConfirmed, conditionId, and sourceFactIds. The candidate remains hidden and must re-enter VisualJudge.",
        "得到一张元数据完整、仍然隐藏的 AI 位图候选图。",
        "A metadata-complete hidden AI bitmap candidate exists."
      ),
    ]
  }

  if (check.id === "real_image_bytes") {
    return [
      action(
        "fix-real-image-bytes",
        check.id,
        "generate_ai_image_candidate",
        "high",
        "重新生成或重新导入真实 PNG/WebP/JPG 位图，禁止 SVG、HTML、JSON、文本、空 URL、调试图或占位图进入候选图。",
        "Regenerate or re-import a real PNG/WebP/JPG bitmap. SVG, HTML, JSON, text, empty URLs, debug images, and placeholders must not enter the candidate stage.",
        "候选图可以读取真实图片本体，并能进入格式、尺寸和文件质量审核。",
        "The candidate exposes real image bytes and can enter format, size, and file-quality review."
      ),
    ]
  }

  if (check.id === "image_byte_fingerprint") {
    return [
      action(
        "fix-image-byte-fingerprint",
        check.id,
        "generate_ai_image_candidate",
        "high",
        "重新生成或重新导入可稳定读取的真实 PNG/WebP/JPG 位图，确保 VisualJudge 能生成图片本体 sha256 指纹，证明审核对象没有漂移。",
        "Regenerate or re-import a stable readable PNG/WebP/JPG bitmap so VisualJudge can generate an image byte sha256 fingerprint and prove the reviewed object did not drift.",
        "候选图图片本体具备可审计字节指纹。",
        "The candidate image bytes have an auditable fingerprint."
      ),
    ]
  }

  if (check.id === "image_metadata_matches_bytes") {
    return [
      action(
        "fix-image-metadata-matches-bytes",
        check.id,
        "repair_generation_condition",
        "high",
        "修正候选图登记逻辑，确保 imageFormat、width、height 与图片本体一致；不允许用声明值伪装图片格式或尺寸。",
        "Fix candidate registration so imageFormat, width, and height match the actual image bytes. Declared values must not spoof image format or size.",
        "候选图声明和图片本体一致。",
        "The candidate metadata matches the actual image bytes."
      ),
    ]
  }

  if (check.id === "mvp_image_size") {
    return [
      action(
        "fix-mvp-image-size",
        check.id,
        "repair_generation_condition",
        "high",
        "调整图像生成请求的 outputSize 或重生成参数，重新生成至少 1024x768 的静态世界位图。",
        "Adjust the image generation request outputSize or regeneration parameters, and regenerate a static world bitmap of at least 1024x768.",
        "候选图达到 MVP 世界静态画面的最低尺寸要求。",
        "The candidate meets the minimum MVP static world frame size."
      ),
    ]
  }

  if (check.id === "bitmap_payload_quality") {
    return [
      action(
        "fix-bitmap-payload-quality",
        check.id,
        "generate_ai_image_candidate",
        "high",
        "重新生成真实、有足够文件信息量的 PNG/WebP/JPG 位图，避免极低字节量空白图、占位图、调试图或伪装压缩图进入候选图。",
        "Regenerate a real PNG/WebP/JPG bitmap with enough file payload. Tiny blank images, placeholders, debug images, and spoofed compressed results must not enter the candidate stage.",
        "候选图图片本体具备基础文件信息量，能继续进入 VisualJudge。",
        "The candidate image payload has enough baseline file information and can continue through VisualJudge."
      ),
    ]
  }

  if (check.id === "candidate_world_binding") {
    return [
      action(
        "fix-candidate-world-binding",
        check.id,
        "restore_fact_source",
        "high",
        "修正候选图登记流程，候选图必须写入当前 worldId、当前 tick，并保留 world_id、tick、runtime_bound_candidate 标签；不能展示旧 tick 候选图。",
        "Fix candidate registration so the candidate records current worldId, current tick, and keeps world_id, tick, and runtime_bound_candidate tags. Stale tick candidates must not be displayed.",
        "候选图绑定当前世界与当前 tick。",
        "The candidate binds the current world and current tick."
      ),
    ]
  }

  if (check.id === "candidate_condition_binding") {
    return [
      action(
        "fix-candidate-condition-binding",
        check.id,
        "repair_generation_condition",
        "high",
        "修正 WorldGenerationCondition 和候选图登记，必须保持 conditionId、modelVersion、canShowToPlayer=false、安全条件和候选图一致。",
        "Fix WorldGenerationCondition and candidate registration so conditionId, modelVersion, canShowToPlayer=false, safety conditions, and the candidate stay consistent.",
        "候选图绑定当前 WorldGenerationCondition。",
        "The candidate binds the current WorldGenerationCondition."
      ),
    ]
  }

  if (check.id === "candidate_source_kind") {
    return [
      action(
        "fix-candidate-source-kind",
        check.id,
        "generate_ai_image_candidate",
        "high",
        "候选图必须来自 project_model_generated，并绑定内部 modelVersion；development_test_asset 只能用于开发期，不允许进入正式 ApprovedFrame。",
        "The candidate must come from project_model_generated and bind an internal modelVersion. development_test_asset is development-only and must not enter formal ApprovedFrame.",
        "候选图来源符合正式展示链要求。",
        "The candidate source matches the formal display-chain requirement."
      ),
    ]
  }

  if (check.id === "candidate_generation_request") {
    return [
      action(
        "fix-candidate-generation-request",
        check.id,
        "repair_generation_condition",
        "high",
        "修正内部图像生成请求登记，requestId、modelVersion、condition、output 必须与候选图和当前事实链一致。",
        "Fix internal image generation request registration so requestId, modelVersion, condition, and output match the candidate and current fact chain.",
        "候选图可追溯到内部模型生成请求。",
        "The candidate is traceable to the internal model generation request."
      ),
    ]
  }

  if (check.id === "candidate_fact_link") {
    return [
      action(
        "fix-candidate-fact-link",
        check.id,
        "restore_fact_source",
        "high",
        "修正候选图登记流程，必须绑定当前 sourceFactIds 和 conditionId，保证视觉表达来自当前世界事实。不能为了修画面修改 WorldRuntimeSaveRecord。",
        "Fix candidate registration so current sourceFactIds and conditionId are bound, ensuring the visual expression is grounded in current world facts. WorldRuntimeSaveRecord must not be changed to fix visuals.",
        "候选图可追溯到当前世界事实和生成输入。",
        "The candidate is traceable to current world facts and generation input."
      ),
    ]
  }

  if (check.id === "candidate_license") {
    return [
      action(
        "fix-candidate-license",
        check.id,
        "repair_generation_condition",
        "high",
        "修正生成约束和候选图来源登记：候选图必须确认来源为自有、CC0 或商业授权，并确认没有直接复制未授权第三方作品。",
        "Fix generation constraints and candidate source registration: the candidate must be confirmed as self-owned, CC0, or commercially licensed, and must not directly copy unlicensed third-party work.",
        "候选图满足授权和原创安全要求。",
        "The candidate satisfies license and originality safety requirements."
      ),
    ]
  }

  return [
    action(
      `fix-${check.id}`,
      check.id,
      "repair_generation_condition",
      "medium",
      `修正审核项：${check.label.zh}。只允许修改生成条件、重生成参数或候选图登记，不允许修改世界事实。`,
      `Fix review check: ${check.label.en}. Only generation conditions, regeneration parameters, or candidate registration may change; world facts must not change.`,
      "该审核项重新进入可通过状态。",
      "This review check becomes passable again."
    ),
  ]
}

function action(
  id: string,
  sourceCheckId: string,
  actionType: WorldVisualFixAction["actionType"],
  priority: WorldVisualFixAction["priority"],
  zhInstruction: string,
  enInstruction: string,
  zhExpectedResult: string,
  enExpectedResult: string
): WorldVisualFixAction {
  return {
    id,
    sourceCheckId,
    actionType,
    priority,
    changesWorldFacts: false,
    targetLayerId: null,
    instruction: {
      zh: zhInstruction,
      en: enInstruction,
    },
    expectedResult: {
      zh: zhExpectedResult,
      en: enExpectedResult,
    },
    tags: [
      sourceCheckId,
      actionType,
      priority,
      "world_facts_locked",
      "visual_expression_only",
      "must_reenter_visual_judge",
    ],
  }
}

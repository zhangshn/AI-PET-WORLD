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
  const failedChecks = input.reviewReport.checks.filter((check) => !check.passed)
  const actions = failedChecks.flatMap((check) => buildActionsForFailedCheck(check))
  const status = actions.length > 0 ? "required" : "not_needed"

  return {
    planId: `visual-fix-${input.factManifest.worldId}-${input.factManifest.tick}`,
    status,
    canShowToPlayer: false,
    summary:
      status === "required"
        ? {
            zh: "当前只能修正视觉生成链路，不能修改世界事实。修正后必须重新生成候选图，并重新进入 Visual Judge。",
            en: "Only the visual generation chain may be fixed; world facts must not change. After fixes, a candidate must be regenerated and re-enter Visual Judge.",
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
      "no_programmatic_renderer",
      "prompt_or_regeneration_only",
    ],
  }
}

function buildActionsForFailedCheck(
  check: WorldVisualReviewCheck
): WorldVisualFixAction[] {
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
        "重新调用 AI 图像生成模型或授权导入流程，必须返回完整候选图元数据：imageUrl、imageFormat、width、height、license、originalityConfirmed。候选图仍然禁止展示，必须重新进入 Visual Judge。",
        "Call the AI image generation model or authorized import flow again. It must return complete candidate metadata: imageUrl, imageFormat, width, height, license, and originalityConfirmed. The candidate remains hidden and must re-enter Visual Judge.",
        "得到一张元数据完整的隐藏 AI 位图候选图。",
        "A hidden AI bitmap candidate with complete metadata exists."
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
        "候选图可以读取真实图片本体，并能进入格式、尺寸和质量审核。",
        "The candidate exposes real image bytes and can enter format, size, and quality review."
      ),
    ]
  }

  if (check.id === "image_metadata_matches_bytes") {
    return [
      action(
        "fix-image-metadata-matches-bytes",
        check.id,
        "repair_prompt_package",
        "high",
        "修正 AI 图像生成模型输出登记逻辑，确保 imageFormat、width、height 与图片本体一致；不允许用声明值伪装图片格式或尺寸。",
        "Fix the AI image generation model output registration so imageFormat, width, and height match the actual image bytes. Declared values must not spoof image format or size.",
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
        "repair_prompt_package",
        "high",
        "调整图像生成请求的 outputSize 或重生成参数，重新生成至少 1024x768 的静态世界位图。",
        "Adjust the image generation request outputSize or regeneration parameters, and regenerate a static world bitmap of at least 1024x768.",
        "候选图达到 MVP 世界静态画面的最低尺寸要求。",
        "The candidate meets the minimum MVP static world frame size."
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
        "修正候选图登记流程，必须绑定 sourceFactIds 和 promptPackageId，保证视觉表达来自当前世界事实。不能为了修画面修改 WorldRuntimeSaveRecord。",
        "Fix candidate registration so sourceFactIds and promptPackageId are bound, ensuring the visual expression is grounded in current world facts. WorldRuntimeSaveRecord must not be changed to fix visuals.",
        "候选图可追溯到世界事实和生成输入。",
        "The candidate is traceable to world facts and generation input."
      ),
    ]
  }

  if (check.id === "candidate_license") {
    return [
      action(
        "fix-candidate-license",
        check.id,
        "repair_prompt_package",
        "high",
        "修正生成约束和候选图来源登记：候选图必须确认来源为自有、CC0 或商业授权，并确认没有直接复制未授权第三方作品。",
        "Fix generation constraints and candidate source registration: the candidate must be confirmed as self-owned, CC0, or commercially licensed, and must not directly copy unlicensed third-party work.",
        "候选图满足授权和原创安全要求。",
        "The candidate satisfies license and originality safety requirements."
      ),
    ]
  }

  if (check.id === "visual_style_quality") {
    return [
      action(
        "fix-visual-style-quality",
        check.id,
        "repair_prompt_package",
        "high",
        "修正正向 prompt 和风格约束，强化明亮、治愈、精细、俯视像素风、清晰世界主焦点；禁止改写世界事实来制造画面效果。",
        "Fix the positive prompt and style constraints to reinforce bright, healing, detailed top-down pixel style and a clear world focal point. World facts must not be rewritten to create visual effects.",
        "候选图具备正式世界画面的基础风格质量。",
        "The candidate has the baseline style quality required for a formal world frame."
      ),
      action(
        "fix-visual-style-negative-prompt",
        check.id,
        "repair_prompt_package",
        "medium",
        "补强 negative prompt，排除照片感、3D 感、模糊插画感、低细节、空绿地、程序块感。",
        "Strengthen the negative prompt to reject photorealism, 3D look, blurry illustration, low detail, empty green fields, and programmatic blockiness.",
        "重生成时减少错误风格和低质量画面。",
        "Regeneration reduces wrong style and low-quality frames."
      ),
    ]
  }

  if (check.id === "world_structure_quality") {
    return [
      action(
        "fix-world-structure-quality",
        check.id,
        "increase_layer_depth",
        "high",
        "修正 composition、terrain 和 asset 视觉表达，强化地形层次、路径逻辑、自然边界、材料/施工关系；只能补视觉表达，不能新增重大世界事实。",
        "Fix composition, terrain, and asset visual expression to reinforce terrain layering, path logic, natural boundaries, and material/construction relationships. Only visual expression may be improved; major world facts must not be added.",
        "候选图呈现可读的世界结构和自然施工关系。",
        "The candidate presents readable world structure and natural construction relationships."
      ),
      action(
        "fix-world-structure-composition",
        check.id,
        "rebalance_composition",
        "medium",
        "重新平衡构图主次，让路径、水岸、建设区、自然边界之间的关系更清晰。",
        "Rebalance composition hierarchy so paths, waterfront, construction area, and natural boundaries relate clearly.",
        "画面主次更清楚，世界结构更容易阅读。",
        "The frame hierarchy is clearer and the world structure is easier to read."
      ),
    ]
  }

  if (check.id === "visual_artifact_rejection") {
    return [
      action(
        "fix-visual-artifact-rejection",
        check.id,
        "repair_prompt_package",
        "high",
        "补强 negative prompt 和重生成约束，明确禁止占位块、脏路径、随机散点、乱码、水印、UI 卡片、调试框、程序矩形块。",
        "Strengthen the negative prompt and regeneration constraints to forbid placeholder blocks, dirty paths, random scatter, garbled text, watermarks, UI cards, debug boxes, and programmatic rectangles.",
        "重生成候选图不包含明显视觉污染。",
        "The regenerated candidate does not contain obvious visual artifacts."
      ),
    ]
  }

  if (check.id === "fact_and_rights_quality") {
    return [
      action(
        "fix-fact-and-rights-quality",
        check.id,
        "restore_fact_source",
        "high",
        "修正 Prompt Package 和候选图登记，必须保留 no_added_world_facts 与 copyright_safe 证明；只能使用授权数据或抽象设计原则，不能复制具体受保护作品、角色、标志或截图。",
        "Fix the Prompt Package and candidate registration so no_added_world_facts and copyright_safe proof are preserved. Only licensed data or abstract design principles may be used; specific protected works, characters, logos, or screenshots must not be copied.",
        "候选图没有新增世界事实，并满足版权安全要求。",
        "The candidate adds no world facts and satisfies copyright safety requirements."
      ),
    ]
  }

  return [
    action(
      `fix-${check.id}`,
      check.id,
      "repair_prompt_package",
      "medium",
      `修正审核项：${check.label.zh}。只允许修改 prompt、negative prompt、控制草图、重生成参数或局部视觉表达，不允许修改世界事实。`,
      `Fix review check: ${check.label.en}. Only prompt, negative prompt, control sketch, regeneration parameters, or local visual expression may change; world facts must not change.`,
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
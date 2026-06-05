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
            zh: "当前只能修正视觉生成链路，不能修改世界事实。修正后必须重新进入 Visual Judge。",
            en: "Only the visual generation chain may be fixed; world facts must not change. After fixes, the result must re-enter Visual Judge.",
          }
        : {
            zh: "当前审核没有发现需要修正的问题，但仍需等待 AI 位图候选图和 ApprovedFrame。",
            en: "The current review found no fixes, but an AI bitmap candidate and ApprovedFrame are still required.",
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
    ],
  }
}

function buildActionsForFailedCheck(
  check: WorldVisualReviewCheck
): WorldVisualFixAction[] {
  if (check.id === "ai_image_candidate") {
    return [
      action(
        "fix-ai-image-candidate",
        check.id,
        "generate_ai_image_candidate",
        "high",
        "接入 AI 图像生成模型，输入世界事实、Prompt Package、负面约束和规则数据，生成 PNG/WebP/JPG 位图候选图；候选图仍然不能直接展示，必须先进入 Visual Judge。",
        "Connect an AI image generation model. Feed it world facts, prompt package, negative constraints, and rule data to generate a PNG/WebP/JPG candidate. The candidate is still hidden until Visual Judge passes it.",
        "得到一张真正的 AI 生成位图候选图，可进入视觉审核，但还不是玩家可见画面。",
        "A real AI-generated bitmap candidate exists for visual review, but it is not yet player-visible."
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
        "候选图必须绑定 sourceFactIds 和 promptPackageId，保证视觉表达来自当前世界事实。",
        "The candidate must bind sourceFactIds and promptPackageId so the visual expression is grounded in current world facts.",
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
        "候选图必须确认来源为自有、CC0 或商业授权，并确认没有直接复制未授权第三方作品。",
        "The candidate must be confirmed as self-owned, CC0, or commercially licensed, and must not directly copy unlicensed third-party work.",
        "候选图满足授权和原创安全要求。",
        "The candidate satisfies license and originality safety requirements."
      ),
    ]
  }

  return [
    action(
      `fix-${check.id}`,
      check.id,
      "repair_prompt_package",
      "medium",
      `修正审核项：${check.label.zh}。只允许修改视觉生成输入，不允许修改世界事实。`,
      `Fix review check: ${check.label.en}. Only visual generation input may change; world facts must not change.`,
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
    tags: [sourceCheckId, actionType, priority, "world_facts_locked"],
  }
}

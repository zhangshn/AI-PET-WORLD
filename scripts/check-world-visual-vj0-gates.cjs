/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require("node:fs")
const path = require("node:path")

const ROOT = process.cwd()

const files = {
  schema: "src/world/world-visual-painter/world-visual-painter-schema.ts",
  authorizedData: "src/world/world-visual-painter/authorized-data/authorized-data-manifest.ts",
  visualReview: "src/world/world-visual-painter/visual-review/visual-review-builder.ts",
  visualQuality:
    "src/world/world-visual-painter/visual-quality/visual-quality-judge.ts",
  approvedBuilder: "src/world/world-visual-painter/approved-frame/approved-frame-builder.ts",
  approvedStore: "src/world/world-visual-painter/approved-frame/approved-frame-store.ts",
  candidateStore: "src/world/world-visual-painter/ai-image-candidate/visual-candidate-store.ts",
  worldPage: "src/app/world/world-live-runtime-page.tsx",
  approvedApi: "src/app/api/world/visual/approved/route.ts",
  judgeApi: "src/app/api/world/visual/judge/route.ts",
  integrity: "src/app/api/world/visual/integrity/route.ts",
  status: "src/app/api/world/visual/status/route.ts",
  packageJson: "package.json",
  behaviorTest: "scripts/test-world-visual-vj0-behavior.cjs",
  displayPolicy:
    "src/world/world-visual-painter/approved-frame/controlled-mvp-display-policy.ts",
}

const source = Object.fromEntries(
  Object.entries(files).map(([key, relPath]) => [key, read(relPath)])
)

const allFormalVisualSource = joinSources(source)

const checks = [
  assertIncludes(
    "受控 MVP 展示策略在生产环境返回 false",
    source.displayPolicy,
    'runtimeEnvironment !== "production"'
  ),
  assertIncludes(
    "/world 实际渲染闸门接入受控 MVP 环境策略",
    source.worldPage,
    "controlledMvpDisplayEnvironmentAllowed"
  ),
  assertIncludes(
    "Status API 实际渲染闸门接入受控 MVP 环境策略",
    source.status,
    "controlledMvpDisplayEnvironmentAllowed"
  ),
  assertIncludes(
    "Approved API 实际渲染闸门接入受控 MVP 环境策略",
    source.approvedApi,
    "controlledMvpDisplayEnvironmentAllowed"
  ),
  assertIncludes(
    "当前 tick 正常匹配：/world 要求 record tick 与 current tick 一致",
    source.worldPage,
    "currentTickMatched"
  ),
  assertIncludes(
    "旧 tick 被阻断：ApprovedFrame Store 检查 current_tick_mismatch",
    source.approvedStore,
    "current_tick_mismatch"
  ),
  assertIncludes(
    "worldId 不匹配被阻断：/world 检查 record worldId",
    source.worldPage,
    "currentWorldMatched"
  ),
  assertIncludes(
    "ApprovedFrame 自身 worldId 不匹配被阻断",
    source.worldPage,
    "currentFrameWorldMatched"
  ),
  assertIncludes(
    "sourceFactIds 不匹配被阻断：/world 检查 record sourceFactIds",
    source.worldPage,
    "currentSourceFactsMatched"
  ),
  assertIncludes(
    "ApprovedFrame 自身 sourceFactIds 不匹配被阻断",
    source.worldPage,
    "currentFrameSourceFactsMatched"
  ),
  assertIncludes(
    "Candidate 正式读取入口强制 currentTick",
    source.candidateStore,
    "currentTick: number"
  ),
  assertIncludes(
    "Candidate 正式读取入口强制 currentSourceFactIds",
    source.candidateStore,
    "currentSourceFactIds: string[]"
  ),
  assertIncludes(
    "ApprovedFrame 正式读取入口强制 currentTick",
    source.approvedStore,
    "currentTick: number"
  ),
  assertIncludes(
    "ApprovedFrame 正式读取入口强制 currentSourceFactIds",
    source.approvedStore,
    "currentSourceFactIds: string[]"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 current_tick_not_requested 绕过标签",
    allFormalVisualSource,
    "current_tick_not_requested"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 current_source_facts_not_requested 绕过标签",
    allFormalVisualSource,
    "current_source_facts_not_requested"
  ),
  assertIncludes(
    "development_test_asset 被阻断：ApprovedFrame Store 检查开发测试资产",
    source.approvedStore,
    "development_test_asset"
  ),
  assertIncludes(
    "缺少 GenerationRequest 被阻断：ApprovedFrame Store 检查 request",
    source.approvedStore,
    "warnings.push(\"request\")"
  ),
  assertIncludes(
    "图片元数据和真实字节不一致被阻断",
    source.visualReview,
    "image_metadata_matches_bytes"
  ),
  assertIncludes(
    "Candidate 添加虚假质量标签也不能通过视觉质量审核",
    source.visualReview,
    "candidate_tags_not_used_as_quality_evidence"
  ),
  assertIncludes(
    "Candidate 标签只作为元数据，不作为质量证据",
    source.visualReview,
    "candidate_tags_are_metadata_only"
  ),
  assertIncludes(
    "ReviewReport 使用 vj_0_passed 状态",
    source.visualReview,
    "vj_0_passed"
  ),
  assertIncludes(
    "ReviewReport 使用 vj_0_failed 状态",
    source.visualReview,
    "vj_0_failed"
  ),
  assertIncludes(
    "ReviewReport 暴露 VJ-1 真实通过状态",
    source.visualReview,
    "vj_1_passed"
  ),
  assertIncludes(
    "VJ-1 使用真实像素解码",
    source.visualQuality,
    ".raw()"
  ),
  assertIncludes(
    "VJ-1 检查亮度",
    source.visualQuality,
    "vj_1_brightness"
  ),
  assertIncludes(
    "VJ-1 检查对比度",
    source.visualQuality,
    "vj_1_contrast"
  ),
  assertIncludes(
    "VJ-1 检查颜色范围",
    source.visualQuality,
    "vj_1_color_range"
  ),
  assertIncludes(
    "VJ-1 检查单色占比",
    source.visualQuality,
    "vj_1_not_solid_color"
  ),
  assertIncludes(
    "VJ-1 检查边缘密度",
    source.visualQuality,
    "vj_1_edge_density"
  ),
  assertIncludes(
    "VJ-1 检查锐度",
    source.visualQuality,
    "vj_1_sharpness"
  ),
  assertIncludes(
    "ReviewReport 暴露 VJ-2 未实现",
    source.visualReview,
    "vj_2_not_implemented"
  ),
  assertIncludes(
    "ApprovedFrame 只能进入受控 MVP 批准范围",
    source.approvedBuilder,
    "approved_for_controlled_mvp"
  ),
  assertIncludes(
    "ApprovedFrame 明确不是生产批准",
    source.approvedBuilder,
    "not_approved_for_production"
  ),
  assertIncludes(
    "ApprovedFrame 生产批准布尔值必须为 false",
    source.approvedBuilder,
    "approvedForProduction: false"
  ),
  assertIncludes(
    "ApprovedFrame Store 校验生产批准布尔值为 false",
    source.approvedStore,
    "frame.approvedForProduction !== false"
  ),
  assertIncludes(
    "Status API 暴露生产展示阻断",
    source.status,
    "productionDisplayAllowed: false"
  ),
  assertIncludes(
    "Judge API 暴露生产展示阻断",
    source.judgeApi,
    "productionDisplayAllowed: false"
  ),
  assertIncludes(
    "Approved API 暴露生产展示阻断",
    source.approvedApi,
    "productionDisplayAllowed: false"
  ),
  assertIncludes(
    "Integrity API 暴露生产展示阻断",
    source.integrity,
    "productionDisplayAllowed: false"
  ),
  assertNotIncludes(
    "禁止保留 passed_candidate 误导视觉质量通过",
    allFormalVisualSource,
    "passed_candidate"
  ),
  assertNotIncludes(
    "禁止保留 visual_style_quality 作为 VJ-0 通过条件",
    source.visualReview,
    "visual_style_quality"
  ),
  assertNotIncludes(
    "禁止保留 world_structure_quality 作为 VJ-0 通过条件",
    source.visualReview,
    "world_structure_quality"
  ),
  assertNotIncludes(
    "禁止保留 visual_artifact_rejection 作为 VJ-0 通过条件",
    source.visualReview,
    "visual_artifact_rejection"
  ),
  assertNotIncludes(
    "禁止保留 fact_and_rights_quality 作为 VJ-0 通过条件",
    source.visualReview,
    "fact_and_rights_quality"
  ),
  assertIncludes(
    "没有 ApprovedFrame 时 /world 不展示图片",
    source.worldPage,
    "approved_frame_empty"
  ),
  assertIncludes(
    "Integrity API 检查 GenerationCondition 存在",
    source.integrity,
    "generation_condition_exists_if_candidate_exists"
  ),
  assertIncludes(
    "Integrity API 检查 GenerationRequest 绑定",
    source.integrity,
    "generation_request_binding_if_candidate_exists"
  ),
  assertIncludes(
    "Integrity API 高严重度失败时 canShowToPlayer=false",
    source.integrity,
    "highSeverityFailedChecks"
  ),
  assertIncludes(
    "Candidate 写入闸门要求 project_model_generated 绑定请求",
    source.candidateStore,
    "project_model_generated candidate requires aiImageGenerationRequest"
  ),
  assertIncludes(
    "ApprovedFrame 写入/读取闸门要求来源为 project_model_generated",
    source.approvedStore,
    "candidate.sourceKind !== \"project_model_generated\""
  ),
  assertIncludes(
    "ApprovedFrame 写入/读取闸门要求 Review 真实通过 VJ-1",
    source.approvedStore,
    "review.status !== \"vj_1_passed\""
  ),
  assertIncludes(
    "ApprovedFrame 写入/读取闸门要求图片 SHA-256",
    source.approvedStore,
    "sourceImageSha256.length !== 64"
  ),
  assertIncludes(
    "ApprovedFrame 写入/读取闸门要求 Review 摘要 SHA-256 绑定",
    source.approvedStore,
    "review_summary_sha256"
  ),
  assertIncludes(
    "Status API 暴露 ApprovedFrame 当前 Runtime gate",
    source.status,
    "currentFrameTickMatched"
  ),
  assertIncludes(
    "Schema 明确定义 ApprovedFrame worldId",
    source.schema,
    "worldId: string"
  ),
  assertIncludes(
    "Schema 明确定义 ApprovedFrame tick",
    source.schema,
    "tick: number"
  ),
  assertIncludes(
    "Schema 明确定义 VJ-1 通过状态",
    source.schema,
    'vj1Status: "vj_1_failed" | "vj_1_passed"'
  ),
  assertIncludes(
    "Schema 明确定义 VJ-2 未实现状态",
    source.schema,
    "vj2Status: \"vj_2_not_implemented\""
  ),
  assertIncludes(
    "授权数据使用 condition reference 命名",
    source.authorizedData,
    "canUseAsConditionReference"
  ),
  assertIncludes(
    "package.json 接入真实行为测试命令",
    source.packageJson,
    "\"test:vj0\": \"node scripts/test-world-visual-vj0-behavior.cjs\""
  ),
  assertIncludes(
    "真实行为测试使用临时目录",
    source.behaviorTest,
    "mkdtempSync"
  ),
  assertIncludes(
    "真实行为测试结束后清理临时目录",
    source.behaviorTest,
    "rmSync(tempDir, { recursive: true, force: true })"
  ),
  assertIncludes(
    "真实行为测试调用 Candidate 写入函数",
    source.behaviorTest,
    "writeWorldVisualCandidateRecord"
  ),
  assertIncludes(
    "真实行为测试调用 Candidate 读取函数",
    source.behaviorTest,
    "readLatestWorldVisualCandidateRecord"
  ),
  assertIncludes(
    "真实行为测试调用 ReviewReport 构建函数",
    source.behaviorTest,
    "buildWorldVisualReviewReport"
  ),
  assertIncludes(
    "真实行为测试调用 ApprovedFrame 构建函数",
    source.behaviorTest,
    "buildWorldVisualApprovedFrame"
  ),
  assertIncludes(
    "真实行为测试调用 ApprovedFrame 写入函数",
    source.behaviorTest,
    "writeWorldVisualApprovedFrameRecord"
  ),
  assertIncludes(
    "真实行为测试调用 ApprovedFrame 读取函数",
    source.behaviorTest,
    "readLatestWorldVisualApprovedFrameRecord"
  ),
  assertIncludes(
    "真实行为测试覆盖旧 tick Candidate 阻断",
    source.behaviorTest,
    "旧 tick Candidate 被读取闸门阻断"
  ),
  assertIncludes(
    "真实行为测试覆盖旧 tick ApprovedFrame 阻断",
    source.behaviorTest,
    "旧 tick ApprovedFrame 被读取闸门阻断"
  ),
  assertIncludes(
    "真实行为测试覆盖 sourceFactIds 缺失、增加、替换",
    source.behaviorTest,
    "sourceFactIds 缺失、增加或替换时被阻断"
  ),
  assertIncludes(
    "真实行为测试覆盖虚假质量标签不能通过 VJ-1/VJ-2",
    source.behaviorTest,
    "Candidate 添加全部虚假质量标签，也不能获得 VJ-1/VJ-2 通过状态"
  ),
  assertIncludes(
    "真实行为测试覆盖 Runtime tick 推进后上一帧失效",
    source.behaviorTest,
    "当前 Runtime tick 推进后，上一 tick ApprovedFrame 立即失效"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 PromptPackage",
    allFormalVisualSource,
    "PromptPackage"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 ControlSketch",
    allFormalVisualSource,
    "ControlSketch"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 positivePrompt",
    allFormalVisualSource,
    "positivePrompt"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 negativePrompt",
    allFormalVisualSource,
    "negativePrompt"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 prompt_reference_only",
    allFormalVisualSource,
    "prompt_reference_only"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 canUseAsPromptReference",
    allFormalVisualSource,
    "canUseAsPromptReference"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 not_from_control_sketch",
    allFormalVisualSource,
    "not_from_control_sketch"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 prompt_or_regeneration_only",
    allFormalVisualSource,
    "prompt_or_regeneration_only"
  ),
]

const failed = checks.filter((item) => !item.passed)

for (const item of checks) {
  console.log(`${item.passed ? "✓" : "✗"} ${item.name}`)
}

if (failed.length > 0) {
  console.error(`\nVisual gate check failed: ${failed.length} failed.`)
  process.exit(1)
}

console.log(`\nVisual gate check passed: ${checks.length} assertions.`)

function read(relPath) {
  return readFileSync(path.join(ROOT, relPath), "utf8")
}

function assertIncludes(name, content, expected) {
  return { name, passed: content.includes(expected) }
}

function assertNotIncludes(name, content, forbidden) {
  return { name, passed: !content.includes(forbidden) }
}

function joinSources(value) {
  return Object.values(value).join("\n---FILE---\n")
}

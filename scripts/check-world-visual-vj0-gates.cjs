const { readFileSync } = require("node:fs")
const path = require("node:path")

const ROOT = process.cwd()

const files = {
  visualReview: "src/world/world-visual-painter/visual-review/visual-review-builder.ts",
  approvedBuilder: "src/world/world-visual-painter/approved-frame/approved-frame-builder.ts",
  approvedStore: "src/world/world-visual-painter/approved-frame/approved-frame-store.ts",
  candidateStore: "src/world/world-visual-painter/ai-image-candidate/visual-candidate-store.ts",
  worldPage: "src/app/world/world-live-runtime-page.tsx",
  integrity: "src/app/api/world/visual/integrity/route.ts",
  status: "src/app/api/world/visual/status/route.ts",
}

const source = Object.fromEntries(
  Object.entries(files).map(([key, relPath]) => [key, read(relPath)])
)

const checks = [
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
    "ApprovedFrame 写入/读取闸门要求 Review 真实通过",
    source.approvedStore,
    "review.status !== \"passed_candidate\""
  ),
  assertIncludes(
    "ApprovedFrame 写入/读取闸门要求图片 SHA-256",
    source.approvedStore,
    "sourceImageSha256.length !== 64"
  ),
  assertIncludes(
    "Status API 暴露 ApprovedFrame 当前 Runtime gate",
    source.status,
    "currentFrameTickMatched"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 PromptPackage",
    joinSources(source),
    "PromptPackage"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 ControlSketch",
    joinSources(source),
    "ControlSketch"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 positivePrompt",
    joinSources(source),
    "positivePrompt"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 negativePrompt",
    joinSources(source),
    "negativePrompt"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 not_from_control_sketch",
    joinSources(source),
    "not_from_control_sketch"
  ),
  assertNotIncludes(
    "正式视觉代码不得保留 prompt_or_regeneration_only",
    joinSources(source),
    "prompt_or_regeneration_only"
  ),
]

const failed = checks.filter((item) => !item.passed)

for (const item of checks) {
  console.log(`${item.passed ? "✓" : "✗"} ${item.name}`)
}

if (failed.length > 0) {
  console.error(`\nVJ-0 gate check failed: ${failed.length} failed.`)
  process.exit(1)
}

console.log(`\nVJ-0 gate check passed: ${checks.length} assertions.`)

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

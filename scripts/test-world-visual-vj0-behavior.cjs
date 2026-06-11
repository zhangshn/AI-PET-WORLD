/* eslint-disable @typescript-eslint/no-require-imports */
const { mkdtempSync, rmSync, readFileSync } = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const repoRoot = process.cwd()
const tempDir = mkdtempSync(path.join(os.tmpdir(), "ai-pet-world-vj0-"))
const tests = []

registerTypeScriptRuntime()

async function main() {
  try {
    process.chdir(tempDir)

    const candidateStore = requireFromRepo(
      "src/world/world-visual-painter/ai-image-candidate/visual-candidate-store.ts"
    )
    const approvedStore = requireFromRepo(
      "src/world/world-visual-painter/approved-frame/approved-frame-store.ts"
    )
    const approvedBuilder = requireFromRepo(
      "src/world/world-visual-painter/approved-frame/approved-frame-builder.ts"
    )
    const reviewBuilder = requireFromRepo(
      "src/world/world-visual-painter/visual-review/visual-review-builder.ts"
    )
    const displayPolicy = requireFromRepo(
      "src/world/world-visual-painter/approved-frame/controlled-mvp-display-policy.ts"
    )

    const api = {
      ...candidateStore,
      ...approvedStore,
      ...approvedBuilder,
      ...reviewBuilder,
      ...displayPolicy,
    }

    await testCurrentRuntimePasses(api)
    await testStaleCandidateBlocked(api)
    await testStaleApprovedFrameBlocked(api)
    await testWorldIdMismatchBlocked(api)
    await testSourceFactMismatchBlocked(api)
    await testConditionCandidateMismatchBlocked(api)
    await testGenerationRequestMissingBlocked(api)
    await testGenerationRequestConditionMismatchBlocked(api)
    await testDevelopmentAssetCannotApprove(api)
    await testImageFormatMismatchBlocked(api)
    await testImageDimensionMismatchBlocked(api)
    await testImageShaMismatchBlocked(api)
    await testFailedReviewCannotApprove(api)
    await testFakeQualityTagsDoNotPassVj1Vj2(api)
    testProductionEnvironmentBlocksControlledMvpDisplay(api)
    await testNoApprovedFrameBlocksRuntimeRender(api)
    await testAdvancedTickInvalidatesApprovedFrame(api)

    for (const item of tests) console.log(`✓ ${item}`)
    console.log(`\nVJ-0 behavior tests passed: ${tests.length} assertions.`)
  } catch (error) {
    for (const item of tests) console.log(`✓ ${item}`)
    console.error("\nVJ-0 behavior test failed.")
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  } finally {
    process.chdir(repoRoot)
    rmSync(tempDir, { recursive: true, force: true })
  }
}

async function testCurrentRuntimePasses(api) {
  const bundle = await buildValidPipeline(api, {
    ownerId: "owner-pass",
    worldId: "world-pass",
    tick: 7,
    sourceFactIds: ["world:world-pass", "tick:7", "zone:a"],
  })

  assert(bundle.candidateWrite.ok, "valid candidate write should pass")
  assert(bundle.candidateRead.status === "found", "valid candidate read should be found")
  assert(bundle.review.status === "vj_0_passed", "valid review should pass VJ-0")
  assert(bundle.review.vj1Status === "vj_1_not_implemented", "VJ-1 must remain not implemented")
  assert(bundle.review.vj2Status === "vj_2_not_implemented", "VJ-2 must remain not implemented")
  assert(bundle.approvedFrame, "valid VJ-0 review should build controlled MVP ApprovedFrame")
  assert(bundle.approvedFrame.approvalScope === "approved_for_controlled_mvp", "approved frame scope must be controlled MVP")
  assert(bundle.approvedFrame.approvedForProduction === false, "approved frame must not be production approved")
  assert(bundle.approvedWrite.ok, "valid approved frame write should pass")
  assert(bundle.approvedRead.status === "found", "valid approved frame read should be found")

  pass("当前 worldId、tick、sourceFactIds 全部匹配时通过")
}

async function testStaleCandidateBlocked(api) {
  const bundle = await buildValidPipeline(api, {
    ownerId: "owner-stale-candidate",
    worldId: "world-stale-candidate",
    tick: 3,
    sourceFactIds: ["world:stale-candidate", "tick:3"],
    skipApproved: true,
  })

  const staleRead = await api.readLatestWorldVisualCandidateRecord({
    ownerId: bundle.ownerId,
    worldId: bundle.worldId,
    currentTick: bundle.tick + 1,
    currentSourceFactIds: bundle.sourceFactIds,
  })

  assert(staleRead.status === "invalid", "stale candidate must be invalid")
  assert(staleRead.warnings.includes("current_tick_mismatch"), "stale candidate must report current tick mismatch")

  pass("旧 tick Candidate 被读取闸门阻断")
}

async function testStaleApprovedFrameBlocked(api) {
  const bundle = await buildValidPipeline(api, {
    ownerId: "owner-stale-approved",
    worldId: "world-stale-approved",
    tick: 4,
    sourceFactIds: ["world:stale-approved", "tick:4"],
  })

  const staleRead = await api.readLatestWorldVisualApprovedFrameRecord({
    ownerId: bundle.ownerId,
    worldId: bundle.worldId,
    currentTick: bundle.tick + 1,
    currentSourceFactIds: bundle.sourceFactIds,
  })

  assert(staleRead.status === "invalid", "stale approved frame must be invalid")
  assert(staleRead.warnings.includes("current_tick_mismatch"), "stale approved frame must report current tick mismatch")

  pass("旧 tick ApprovedFrame 被读取闸门阻断")
}

async function testWorldIdMismatchBlocked(api) {
  const bundle = await buildValidPipeline(api, {
    ownerId: "owner-world-mismatch",
    worldId: "world-a",
    tick: 2,
    sourceFactIds: ["world:a", "tick:2"],
  })

  const candidateRead = await api.readLatestWorldVisualCandidateRecord({
    ownerId: bundle.ownerId,
    worldId: "world-b",
    currentTick: bundle.tick,
    currentSourceFactIds: bundle.sourceFactIds,
  })
  const approvedRead = await api.readLatestWorldVisualApprovedFrameRecord({
    ownerId: bundle.ownerId,
    worldId: "world-b",
    currentTick: bundle.tick,
    currentSourceFactIds: bundle.sourceFactIds,
  })

  assert(candidateRead.status !== "found", "worldId mismatch must not return candidate")
  assert(approvedRead.status !== "found", "worldId mismatch must not return approved frame")

  pass("worldId 不匹配被阻断")
}

async function testSourceFactMismatchBlocked(api) {
  const bundle = await buildValidPipeline(api, {
    ownerId: "owner-fact-mismatch",
    worldId: "world-fact-mismatch",
    tick: 5,
    sourceFactIds: ["fact:a", "fact:b", "fact:c"],
  })

  for (const sourceFactIds of [
    ["fact:a", "fact:b"],
    ["fact:a", "fact:b", "fact:c", "fact:d"],
    ["fact:a", "fact:b", "fact:x"],
  ]) {
    const candidateRead = await api.readLatestWorldVisualCandidateRecord({
      ownerId: bundle.ownerId,
      worldId: bundle.worldId,
      currentTick: bundle.tick,
      currentSourceFactIds: sourceFactIds,
    })
    const approvedRead = await api.readLatestWorldVisualApprovedFrameRecord({
      ownerId: bundle.ownerId,
      worldId: bundle.worldId,
      currentTick: bundle.tick,
      currentSourceFactIds: sourceFactIds,
    })

    assert(candidateRead.status === "invalid", "candidate sourceFactIds mismatch must be invalid")
    assert(approvedRead.status === "invalid", "approved sourceFactIds mismatch must be invalid")
  }

  pass("sourceFactIds 缺失、增加或替换时被阻断")
}

async function testConditionCandidateMismatchBlocked(api) {
  const fixture = makeFixture({
    ownerId: "owner-condition-mismatch",
    worldId: "world-condition-mismatch",
    tick: 6,
    sourceFactIds: ["fact:condition"],
  })
  const badCandidate = {
    ...fixture.candidate,
    conditionId: "different-condition",
  }

  const result = await api.writeWorldVisualCandidateRecord({
    ownerId: fixture.ownerId,
    worldId: fixture.worldId,
    tick: fixture.tick,
    candidate: badCandidate,
    generationCondition: fixture.condition,
    factManifest: fixture.factManifest,
    aiImageGenerationRequest: fixture.request,
  })

  assert(!result.ok, "condition/candidate mismatch must block candidate write")

  pass("Condition 与 Candidate 不一致时被阻断")
}

async function testGenerationRequestMissingBlocked(api) {
  const fixture = makeFixture({
    ownerId: "owner-request-missing",
    worldId: "world-request-missing",
    tick: 8,
    sourceFactIds: ["fact:request-missing"],
  })

  const result = await api.writeWorldVisualCandidateRecord({
    ownerId: fixture.ownerId,
    worldId: fixture.worldId,
    tick: fixture.tick,
    candidate: fixture.candidate,
    generationCondition: fixture.condition,
    factManifest: fixture.factManifest,
    aiImageGenerationRequest: null,
  })

  assert(!result.ok, "missing GenerationRequest must block project_model_generated candidate")
  assert(result.warnings.some((warning) => warning.includes("aiImageGenerationRequest")), "missing request warning should be explicit")

  pass("GenerationRequest 缺失时被阻断")
}

async function testGenerationRequestConditionMismatchBlocked(api) {
  const fixture = makeFixture({
    ownerId: "owner-request-mismatch",
    worldId: "world-request-mismatch",
    tick: 9,
    sourceFactIds: ["fact:request-mismatch"],
  })
  const badRequest = {
    ...fixture.request,
    condition: {
      ...fixture.request.condition,
      conditionId: "different-condition",
    },
  }

  const result = await api.writeWorldVisualCandidateRecord({
    ownerId: fixture.ownerId,
    worldId: fixture.worldId,
    tick: fixture.tick,
    candidate: fixture.candidate,
    generationCondition: fixture.condition,
    factManifest: fixture.factManifest,
    aiImageGenerationRequest: badRequest,
  })

  assert(!result.ok, "request/condition mismatch must block candidate write")

  pass("GenerationRequest 与 Condition 不一致时被阻断")
}

async function testDevelopmentAssetCannotApprove(api) {
  const fixture = makeFixture({
    ownerId: "owner-dev-asset",
    worldId: "world-dev-asset",
    tick: 10,
    sourceFactIds: ["fact:dev-asset"],
  })
  const devCandidate = {
    ...fixture.candidate,
    sourceKind: "development_test_asset",
    tags: [...fixture.candidate.tags, "development_test_asset"],
  }
  const review = await api.buildWorldVisualReviewReport({
    factManifest: fixture.factManifest,
    generationCondition: fixture.condition,
    aiImageGenerationRequest: fixture.request,
    aiImageCandidate: devCandidate,
  })
  const approvedFrame = api.buildWorldVisualApprovedFrame({
    factManifest: fixture.factManifest,
    generationCondition: fixture.condition,
    aiImageGenerationRequest: fixture.request,
    aiImageCandidate: devCandidate,
    reviewReport: review,
  })

  assert(review.status === "vj_0_failed", "development_test_asset review should fail VJ-0")
  assert(approvedFrame === null, "development_test_asset must not build ApprovedFrame")

  pass("development_test_asset 不能生成正式 ApprovedFrame")
}

async function testImageFormatMismatchBlocked(api) {
  const fixture = makeFixture({
    ownerId: "owner-format-mismatch",
    worldId: "world-format-mismatch",
    tick: 11,
    sourceFactIds: ["fact:format"],
  })
  const candidate = { ...fixture.candidate, imageFormat: "webp" }
  const request = { ...fixture.request, output: { ...fixture.request.output, imageFormat: "webp" } }
  const review = await api.buildWorldVisualReviewReport({
    factManifest: fixture.factManifest,
    generationCondition: fixture.condition,
    aiImageGenerationRequest: request,
    aiImageCandidate: candidate,
  })
  const approvedFrame = api.buildWorldVisualApprovedFrame({
    factManifest: fixture.factManifest,
    generationCondition: fixture.condition,
    aiImageGenerationRequest: request,
    aiImageCandidate: candidate,
    reviewReport: review,
  })

  assert(review.status === "vj_0_failed", "format mismatch should fail VJ-0")
  assert(approvedFrame === null, "format mismatch must not build ApprovedFrame")

  pass("图片声明格式与真实字节不一致时被阻断")
}

async function testImageDimensionMismatchBlocked(api) {
  const fixture = makeFixture({
    ownerId: "owner-dimension-mismatch",
    worldId: "world-dimension-mismatch",
    tick: 12,
    sourceFactIds: ["fact:dimension"],
  })
  const candidate = { ...fixture.candidate, width: fixture.candidate.width + 1 }
  const request = { ...fixture.request, output: { ...fixture.request.output, width: candidate.width } }
  const review = await api.buildWorldVisualReviewReport({
    factManifest: fixture.factManifest,
    generationCondition: fixture.condition,
    aiImageGenerationRequest: request,
    aiImageCandidate: candidate,
  })
  const approvedFrame = api.buildWorldVisualApprovedFrame({
    factManifest: fixture.factManifest,
    generationCondition: fixture.condition,
    aiImageGenerationRequest: request,
    aiImageCandidate: candidate,
    reviewReport: review,
  })

  assert(review.status === "vj_0_failed", "dimension mismatch should fail VJ-0")
  assert(approvedFrame === null, "dimension mismatch must not build ApprovedFrame")

  pass("图片声明尺寸与真实尺寸不一致时被阻断")
}

async function testImageShaMismatchBlocked(api) {
  const bundle = await buildValidPipeline(api, {
    ownerId: "owner-sha-mismatch",
    worldId: "world-sha-mismatch",
    tick: 13,
    sourceFactIds: ["fact:sha"],
    skipApprovedWrite: true,
  })
  const badFrame = {
    ...bundle.approvedFrame,
    sourceImageSha256: "0".repeat(64),
  }
  const result = await api.writeWorldVisualApprovedFrameRecord({
    ownerId: bundle.ownerId,
    worldId: bundle.worldId,
    tick: bundle.tick,
    approvedFrame: badFrame,
    reviewReport: bundle.review,
    sourceCandidateRecord: bundle.candidateRead.record,
  })

  assert(!result.ok, "wrong sha must block approved frame write")
  assert(result.warnings.includes("review_summary_sha256"), "wrong sha should be compared against review summary")

  pass("图片 SHA-256 缺失或错误时被阻断")
}

async function testFailedReviewCannotApprove(api) {
  const fixture = makeFixture({
    ownerId: "owner-failed-review",
    worldId: "world-failed-review",
    tick: 14,
    sourceFactIds: ["fact:failed-review"],
  })
  const badCandidate = { ...fixture.candidate, width: 1, height: 1 }
  const badRequest = { ...fixture.request, output: { ...fixture.request.output, width: 1, height: 1 } }
  const review = await api.buildWorldVisualReviewReport({
    factManifest: fixture.factManifest,
    generationCondition: fixture.condition,
    aiImageGenerationRequest: badRequest,
    aiImageCandidate: badCandidate,
  })
  const approvedFrame = api.buildWorldVisualApprovedFrame({
    factManifest: fixture.factManifest,
    generationCondition: fixture.condition,
    aiImageGenerationRequest: badRequest,
    aiImageCandidate: badCandidate,
    reviewReport: review,
  })

  assert(review.status === "vj_0_failed", "bad candidate review should fail")
  assert(approvedFrame === null, "failed review must not build ApprovedFrame")

  pass("ReviewReport 未通过时不能生成 ApprovedFrame")
}

async function testFakeQualityTagsDoNotPassVj1Vj2(api) {
  const fixture = makeFixture({
    ownerId: "owner-fake-tags",
    worldId: "world-fake-tags",
    tick: 15,
    sourceFactIds: ["fact:fake-tags"],
  })
  const fakeTags = [
    "visual_style_quality",
    "world_structure_quality",
    "visual_artifact_rejection",
    "fact_and_rights_quality",
    "no_watermark",
    "pixel_style_passed",
    "composition_passed",
    "semantic_copyright_safe",
  ]
  const write = await api.writeWorldVisualCandidateRecord({
    ownerId: fixture.ownerId,
    worldId: fixture.worldId,
    tick: fixture.tick,
    candidate: fixture.candidate,
    generationCondition: fixture.condition,
    factManifest: fixture.factManifest,
    aiImageGenerationRequest: fixture.request,
  })
  assert(write.ok, "fake-tag fixture candidate write should pass")

  const read = await api.readLatestWorldVisualCandidateRecord({
    ownerId: fixture.ownerId,
    worldId: fixture.worldId,
    currentTick: fixture.tick,
    currentSourceFactIds: fixture.sourceFactIds,
  })
  assert(read.status === "found", "fake-tag fixture candidate read should be found")
  assert(read.record, "fake-tag fixture candidate record should exist")

  const candidate = {
    ...read.record.candidate,
    tags: [...read.record.candidate.tags, ...fakeTags],
  }
  const review = await api.buildWorldVisualReviewReport({
    factManifest: fixture.factManifest,
    generationCondition: read.record.generationCondition,
    aiImageGenerationRequest: read.record.aiImageGenerationRequest,
    aiImageCandidate: candidate,
  })

  assert(review.status === "vj_0_passed", "otherwise valid fake-tag candidate can only pass VJ-0")
  assert(review.vj1Status === "vj_1_not_implemented", "fake tags must not pass VJ-1")
  assert(review.vj2Status === "vj_2_not_implemented", "fake tags must not pass VJ-2")
  assert(review.productionApprovalStatus === "not_approved_for_production", "fake tags must not grant production approval")
  assert(review.checks.some((check) => check.id === "vj_1_not_implemented" && check.passed === false), "VJ-1 not implemented check must remain failed")
  assert(review.checks.some((check) => check.id === "vj_2_not_implemented" && check.passed === false), "VJ-2 not implemented check must remain failed")

  pass("Candidate 添加全部虚假质量标签，也不能获得 VJ-1/VJ-2 通过状态")
}

function testProductionEnvironmentBlocksControlledMvpDisplay(api) {
  assert(
    api.isControlledMvpDisplayEnvironmentAllowed("development") === true,
    "development must allow controlled MVP display"
  )
  assert(
    api.isControlledMvpDisplayEnvironmentAllowed("test") === true,
    "test must allow controlled MVP display"
  )
  assert(
    api.isControlledMvpDisplayEnvironmentAllowed("production") === false,
    "production must block controlled MVP display"
  )

  pass("Controlled MVP 画面只允许开发和测试环境，生产环境强制阻断")
}

async function testNoApprovedFrameBlocksRuntimeRender(api) {
  const read = await api.readLatestWorldVisualApprovedFrameRecord({
    ownerId: "owner-no-frame",
    worldId: "world-no-frame",
    currentTick: 1,
    currentSourceFactIds: ["fact:none"],
  })

  assert(read.status === "empty", "missing ApprovedFrame should read empty")
  assert(read.record === null, "missing ApprovedFrame should not return a renderable record")

  pass("没有 ApprovedFrame 时，Runtime Render 返回禁止展示")
}

async function testAdvancedTickInvalidatesApprovedFrame(api) {
  const bundle = await buildValidPipeline(api, {
    ownerId: "owner-tick-advance",
    worldId: "world-tick-advance",
    tick: 16,
    sourceFactIds: ["fact:tick-advance", "tick:16"],
  })
  const advancedRead = await api.readLatestWorldVisualApprovedFrameRecord({
    ownerId: bundle.ownerId,
    worldId: bundle.worldId,
    currentTick: 17,
    currentSourceFactIds: bundle.sourceFactIds,
  })

  assert(advancedRead.status === "invalid", "advanced runtime tick should invalidate previous frame")
  assert(advancedRead.warnings.includes("current_tick_mismatch"), "advanced tick should report mismatch")

  pass("当前 Runtime tick 推进后，上一 tick ApprovedFrame 立即失效")
}

async function buildValidPipeline(api, options) {
  const fixture = makeFixture(options)
  const candidateWrite = await api.writeWorldVisualCandidateRecord({
    ownerId: fixture.ownerId,
    worldId: fixture.worldId,
    tick: fixture.tick,
    candidate: fixture.candidate,
    generationCondition: fixture.condition,
    factManifest: fixture.factManifest,
    aiImageGenerationRequest: fixture.request,
  })
  const candidateRead = await api.readLatestWorldVisualCandidateRecord({
    ownerId: fixture.ownerId,
    worldId: fixture.worldId,
    currentTick: fixture.tick,
    currentSourceFactIds: fixture.sourceFactIds,
  })

  let review = null
  let approvedFrame = null
  let approvedWrite = null
  let approvedRead = null

  if (!options.skipApproved && candidateRead.record) {
    review = await api.buildWorldVisualReviewReport({
      factManifest: fixture.factManifest,
      generationCondition: candidateRead.record.generationCondition,
      aiImageGenerationRequest: candidateRead.record.aiImageGenerationRequest,
      aiImageCandidate: candidateRead.record.candidate,
    })
    approvedFrame = api.buildWorldVisualApprovedFrame({
      factManifest: fixture.factManifest,
      generationCondition: candidateRead.record.generationCondition,
      aiImageGenerationRequest: candidateRead.record.aiImageGenerationRequest,
      aiImageCandidate: candidateRead.record.candidate,
      reviewReport: review,
    })
    if (approvedFrame && !options.skipApprovedWrite) {
      approvedWrite = await api.writeWorldVisualApprovedFrameRecord({
        ownerId: fixture.ownerId,
        worldId: fixture.worldId,
        tick: fixture.tick,
        approvedFrame,
        reviewReport: review,
        sourceCandidateRecord: candidateRead.record,
      })
      approvedRead = await api.readLatestWorldVisualApprovedFrameRecord({
        ownerId: fixture.ownerId,
        worldId: fixture.worldId,
        currentTick: fixture.tick,
        currentSourceFactIds: fixture.sourceFactIds,
      })
    }
  }

  return {
    ...fixture,
    candidateWrite,
    candidateRead,
    review,
    approvedFrame,
    approvedWrite,
    approvedRead,
  }
}

function makeFixture(options) {
  const ownerId = options.ownerId
  const worldId = options.worldId
  const tick = options.tick
  const sourceFactIds = options.sourceFactIds
  const width = 1024
  const height = 768
  const modelVersion = "vj0-test-model"
  const conditionId = `condition-${worldId}-${tick}`
  const imageUrl = makePngDataUrl(width, height)
  const text = (zh, en) => ({ zh, en })
  const factManifest = {
    worldId,
    tick,
    sourceFactIds,
  }
  const condition = {
    conditionId,
    version: "world-generation-condition-v1",
    worldId,
    tick,
    modelVersion,
    sceneCondition: {
      sceneType: "forest_construction_clearing",
      mainStory: text("测试场景", "Test scene"),
      mustShow: [text("世界事实", "World fact")],
      mayShow: [],
      mustNotShow: [],
    },
    spatialCondition: {
      camera: "top_down_pixel_scene",
      focalArea: text("中心", "Center"),
      background: text("背景", "Background"),
      midground: text("中景", "Midground"),
      foreground: text("前景", "Foreground"),
      edgeFraming: text("边缘", "Edges"),
    },
    terrainCondition: {
      baseBiome: "green_forest_clearing",
      groundTexture: text("草地", "Grass"),
      pathStrategy: text("路径", "Path"),
      waterStrategy: text("无水", "No water"),
      elevationStrategy: text("平地", "Flat"),
    },
    assetCondition: {
      constructionFocus: text("材料", "Materials"),
      natureLayers: [text("树", "Trees")],
      materialLayers: [text("木头", "Wood")],
      blockedPlaceholderPolicy: text("禁止占位", "No placeholder"),
    },
    styleCondition: {
      imageMode: "static_world_frame",
      directions: [text("像素风", "Pixel style")],
      allowedWorldElements: [text("草地", "Grass")],
    },
    motionCondition: {
      enabled: false,
      reason: text("静态", "Static"),
    },
    safetyCondition: {
      preserveWorldFacts: true,
      forbidProgrammaticFinalFrame: true,
      forbidPlaceholderFrame: true,
      forbidUnlicensedCopy: true,
      requireVisualJudge: true,
    },
    fixConditions: [],
    ruleDataIds: [],
    sourceFactIds,
    canShowToPlayer: false,
    tags: [],
  }
  const request = {
    requestId: `request-${worldId}-${tick}`,
    modelVersion,
    condition,
    output: {
      width,
      height,
      imageFormat: "png",
    },
    canShowToPlayer: false,
    tags: [],
  }
  const candidate = {
    candidateId: `candidate-${worldId}-${tick}`,
    sourceKind: "project_model_generated",
    modelVersion,
    imageUrl,
    imageFormat: "png",
    width,
    height,
    license: "self_owned",
    originalityConfirmed: true,
    sourceDescription: text("内部测试候选图", "Internal test candidate"),
    conditionId,
    sourceFactIds,
    canShowToPlayer: false,
    generationNotes: text("测试", "Test"),
    tags: [],
  }

  return {
    ownerId,
    worldId,
    tick,
    sourceFactIds,
    factManifest,
    condition,
    request,
    candidate,
  }
}

function makePngDataUrl(width, height) {
  const bytes = Buffer.alloc(25 * 1024, 0)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write("IHDR", 12, "ascii")
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  bytes[24] = 8
  bytes[25] = 6

  return `data:image/png;base64,${bytes.toString("base64")}`
}

function registerTypeScriptRuntime() {
  require.extensions[".ts"] = function compileTypeScript(module, filename) {
    const source = readFileSync(filename, "utf8")
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
      },
      fileName: filename,
    }).outputText

    module._compile(output, filename)
  }

  const originalResolve = Module._resolveFilename
  Module._resolveFilename = function resolveWithAlias(request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      const resolved = path.join(repoRoot, "src", request.slice(2))
      return originalResolve.call(this, resolved, parent, isMain, options)
    }

    return originalResolve.call(this, request, parent, isMain, options)
  }
}

function requireFromRepo(relPath) {
  return require(path.join(repoRoot, relPath))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function pass(name) {
  tests.push(name)
}

void main()

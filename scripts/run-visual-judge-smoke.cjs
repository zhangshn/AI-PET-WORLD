async function main() {
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)

  function fail(message) {
    console.log("VISUAL JUDGE SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function readFile(filePath, label) {
    assert(fs.existsSync(filePath), `${label} is missing.`)
    return fs.readFileSync(filePath, "utf8")
  }

  function installTypeScriptRequireHook() {
    const moduleConstructor = moduleApi.default
    const originalResolveFilename = moduleConstructor._resolveFilename

    moduleConstructor._resolveFilename = function resolveFilename(
      request,
      parent,
      isMain,
      options
    ) {
      if (request.startsWith("@/")) {
        return originalResolveFilename.call(
          this,
          path.join(repoRoot, "src", request.slice(2)),
          parent,
          isMain,
          options
        )
      }

      return originalResolveFilename.call(this, request, parent, isMain, options)
    }

    localRequire.extensions[".ts"] = function compileTypescript(module, filename) {
      const source = fs.readFileSync(filename, "utf8")
      const output = ts.transpileModule(source, {
        compilerOptions: {
          esModuleInterop: true,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: filename,
      }).outputText

      module._compile(output, filename)
    }
  }

  installTypeScriptRequireHook()

  const visualJudgeDir = path.join(repoRoot, "src", "world", "visual-judge")
  const schemaSource = readFile(path.join(visualJudgeDir, "visual-judge-schema.ts"), "visual judge schema")
  const gatewaySource = readFile(path.join(visualJudgeDir, "visual-judge-gateway.ts"), "visual judge gateway")
  const indexSource = readFile(path.join(visualJudgeDir, "index.ts"), "visual judge index")
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const combined = [schemaSource, gatewaySource, indexSource, packageSource].join("\n")
  const moduleSource = [schemaSource, gatewaySource, indexSource].join("\n")

  const requiredTokens = [
    "VisualJudgeReport",
    "VisualJudgeFinding",
    "VisualJudgeInput",
    "VisualCorrectionPlan",
    "VisualCorrectionAction",
    "VisualCorrectionIntent",
    "VisualFactManifest",
    "VisualDisplayGateReview",
    "buildVisualFactManifestFromWorldViewModel",
    "VisualDisplayGateDecision",
    "judgePixelWorldVisual",
    "buildVisualCorrectionPlan",
    "applyVisualCorrectionPlanToPixelBufferFrame",
    "buildVisualDisplayGateDecision",
    "illegal_debug_visual",
    "readability",
    "density",
    "composition",
    "semantic",
    "world_fact_consistency",
    "structure_logic",
    "construction_stage",
    "access_readability",
    "path_connectivity",
    "ecology_coherence",
    "player_focus",
    "business_rule",
    "visual_display_gate_decision",
    "visual_judge_does_not_modify_runtime",
    "marker_fallback",
    "object_block",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  const forbiddenTokens = [
    "writeWorldRuntimeSaveRecord",
    "runAndPersistOneRuntimeTick",
    "createRuntimeWorldFromCreateWorldInput",
    "HomeMapState",
    "WorldRuntimeSaveRecord",
  ]
  const forbiddenHits = forbiddenTokens.filter((token) => moduleSource.includes(token))
  assert(forbiddenHits.length === 0, `Visual Judge should not mutate runtime but contains: ${forbiddenHits.join(", ")}`)

  const {
    applyVisualCorrectionPlanToPixelBufferFrame,
    buildVisualCorrectionPlan,
    buildVisualDisplayGateDecision,
    buildVisualFactManifestFromWorldViewModel,
    judgePixelWorldVisual,
  } = localRequire(
    path.join(repoRoot, "src", "world", "visual-judge", "index.ts")
  )

  const failingReport = judgePixelWorldVisual(createFailingInput())
  const failingCorrectionPlan = buildVisualCorrectionPlan(failingReport)
  const failingGateDecision = buildVisualDisplayGateDecision(createFailingInput())
  assert(!failingReport.ok, "Failing visual report should not be ok.")
  assert(failingReport.severity === "fail", `Unexpected failing severity: ${failingReport.severity}`)
  assert(failingReport.findings.some((finding) => finding.category === "illegal_debug_visual"), "Large debug visual should be detected.")
  assert(failingReport.findings.some((finding) => finding.category === "semantic"), "Marker fallback should be detected.")
  assert(failingReport.findings.some((finding) => finding.category === "world_fact_consistency"), "Unknown visual source should be detected.")
  assert(failingReport.findings.some((finding) => finding.category === "business_rule"), "Forbidden business token should be detected.")
  assert(failingReport.findings.some((finding) => finding.category === "composition"), "Out of bounds or center obstruction should be detected.")
  assert(failingCorrectionPlan.shouldRegenerateVisuals, "Failing report should request visual regeneration.")
  assert(failingCorrectionPlan.intentCount === failingReport.findings.length, "Correction intent count should match finding count.")
  assert(failingCorrectionPlan.actionCount === failingReport.findings.length, "Correction action count should match finding count.")
  assert(failingCorrectionPlan.intents.every((intent) => intent.visualOnly && intent.preservesRuntimeFacts), "Correction intents must stay visual-only and preserve runtime facts.")
  assert(failingCorrectionPlan.actions.every((action) => action.intentId), "Every correction action should reference a structured intent.")
  assert(failingCorrectionPlan.actions.every((action) => action.affectsRuntimeFacts === false), "Correction actions must stay visual-only.")
  assert(failingCorrectionPlan.actions.some((action) => action.type === "remove_visual_block"), "Correction plan should remove illegal visual blocks.")
  assert(failingCorrectionPlan.actions.some((action) => action.type === "replace_visual_recipe"), "Correction plan should replace marker fallback recipes.")
  assert(failingGateDecision.status === "block_display", `Failing display gate should block display but got ${failingGateDecision.status}.`)
  assert(!failingGateDecision.canShowToPlayer, "Failing display gate must not show visuals to player.")
  assert(failingGateDecision.review.remainingFailCount > 0, "Failing display gate review should expose remaining fail count.")
  assert(failingGateDecision.review.blockReasons.length > 0, "Failing display gate review should expose block reasons.")
  assert(failingGateDecision.review.phases.includes("post_correction_failed"), "Failing display gate review should mark post-correction failure.")

  const repairableInput = createRepairableInput()
  const repairableReport = judgePixelWorldVisual(repairableInput)
  const repairableCorrectionPlan = buildVisualCorrectionPlan(repairableReport)
  const repairApplyResult = applyVisualCorrectionPlanToPixelBufferFrame({
    pixelBufferFrame: repairableInput.pixelBufferFrame,
    correctionPlan: repairableCorrectionPlan,
  })
  const repairableGateDecision = buildVisualDisplayGateDecision(repairableInput)
  assert(!repairableReport.ok, "Repairable visual report should initially fail.")
  assert(repairableCorrectionPlan.shouldRegenerateVisuals, "Repairable visual should request correction.")
  assert(repairApplyResult.affectsRuntimeFacts === false, "Visual correction apply result must not affect runtime facts.")
  assert(repairApplyResult.appliedActionIds.length > 0, "Repairable correction should apply at least one action.")
  assert(repairableGateDecision.status === "allow_display", `Repairable display gate should allow corrected display but got ${repairableGateDecision.status}.`)
  assert(repairableGateDecision.canShowToPlayer, "Repairable display gate should allow player display after correction.")
  assert(repairableGateDecision.correctedPixelBufferFrame, "Repairable display gate should expose corrected pixel buffer.")
  assert(repairableGateDecision.postCorrectionReport?.ok, "Repairable post-correction report should pass.")
  assert(repairableGateDecision.review.correctionApplied, "Repairable display gate review should mark correction as applied.")
  assert(repairableGateDecision.review.phases.includes("post_correction_passed"), "Repairable display gate review should mark post-correction pass.")
  assert(repairableGateDecision.review.resolvedFindingCount > 0, "Repairable display gate review should count resolved findings.")

  const expandedJudgementReport = judgePixelWorldVisual(createExpandedJudgementInput())
  assert(expandedJudgementReport.findings.some((finding) => finding.category === "structure_logic"), "Structure visual logic should be detected.")
  assert(expandedJudgementReport.findings.some((finding) => finding.category === "path_connectivity"), "Fragmented trace/path visuals should be detected.")
  assert(expandedJudgementReport.findings.some((finding) => finding.category === "ecology_coherence"), "Ecology visual coherence should be detected.")

  const advancedReviewReport = judgePixelWorldVisual(createAdvancedVisualReviewInput())
  const advancedCorrectionPlan = buildVisualCorrectionPlan(advancedReviewReport)
  const advancedApplyResult = applyVisualCorrectionPlanToPixelBufferFrame({
    pixelBufferFrame: createAdvancedVisualReviewInput().pixelBufferFrame,
    correctionPlan: advancedCorrectionPlan,
  })
  assert(advancedReviewReport.findings.some((finding) => finding.category === "construction_stage"), "Construction stage readability should be detected.")
  assert(advancedReviewReport.findings.some((finding) => finding.category === "access_readability"), "Structure access readability should be detected.")
  assert(advancedReviewReport.findings.some((finding) => finding.category === "player_focus"), "Player focus overcrowding should be detected.")
  assert(advancedCorrectionPlan.intents.some((intent) => intent.type === "add_construction_stage_cue"), "Construction stage finding should create construction cue intent.")
  assert(advancedCorrectionPlan.intents.some((intent) => intent.type === "add_access_trace_cue"), "Access readability finding should create access trace intent.")
  assert(advancedCorrectionPlan.intents.some((intent) => intent.type === "protect_player_focus_area"), "Player focus finding should create focus protection intent.")
  assert(advancedCorrectionPlan.actions.some((action) => action.type === "generate_visual_cue"), "Advanced visual intents should create visual cue generation actions.")
  assert(advancedApplyResult.generatedCellIds.length >= 4, "Advanced visual correction should generate visual-only buffer cells.")
  assert(advancedApplyResult.affectsRuntimeFacts === false, "Advanced visual correction must not affect runtime facts.")
  assert(
    advancedApplyResult.correctedPixelBufferFrame.layers.some((layer) =>
      layer.cells.some((cell) => (cell.stateTags ?? []).includes("foundation"))
    ),
    "Advanced correction should generate construction foundation cue."
  )
  assert(
    advancedApplyResult.correctedPixelBufferFrame.layers.some((layer) =>
      layer.cells.some((cell) => (cell.stateTags ?? []).includes("access_trace"))
    ),
    "Advanced correction should generate access trace cue."
  )

  const generatedManifest = buildVisualFactManifestFromWorldViewModel(createWorldViewModelFixture())
  assert(generatedManifest.tags.includes("world_fact_source_manifest"), "Visual fact manifest should expose source manifest tag.")
  assert(generatedManifest.entries.some((entry) => entry.sourceId === "facility_primary" && entry.sourceKind === "construction"), "Facility source should be classified as construction.")
  assert(generatedManifest.entries.some((entry) => entry.sourceId === "tree_primary" && entry.sourceKind === "ecology"), "Tree source should be classified as ecology.")

  const manifestPassingReport = judgePixelWorldVisual(createPassingInputWithManifest())
  assert(manifestPassingReport.ok, `Manifest-backed passing visual should be ok: ${manifestPassingReport.findings.map((finding) => finding.id).join(", ")}`)

  const missingManifestReport = judgePixelWorldVisual(createMissingManifestInput())
  assert(!missingManifestReport.ok, "Missing visual fact source should fail.")
  assert(missingManifestReport.findings.some((finding) => finding.tags.includes("world_fact_manifest")), "Missing visual fact source should be tagged as manifest issue.")

  const passingReport = judgePixelWorldVisual(createPassingInput())
  const passingCorrectionPlan = buildVisualCorrectionPlan(passingReport)
  const passingGateDecision = buildVisualDisplayGateDecision(createPassingInput())
  assert(passingReport.ok, `Passing visual report should be ok: ${passingReport.findings.map((finding) => finding.id).join(", ")}`)
  assert(passingReport.severity === "pass", `Unexpected passing severity: ${passingReport.severity}`)
  assert(passingReport.score === 100, `Passing report should score 100 but got ${passingReport.score}.`)
  assert(!passingCorrectionPlan.shouldRegenerateVisuals, "Passing report should not request visual regeneration.")
  assert(passingCorrectionPlan.intentCount === 0, "Passing report should not create correction intents.")
  assert(passingCorrectionPlan.actionCount === 0, "Passing report should not create correction actions.")
  assert(passingGateDecision.status === "allow_display", `Passing display gate should allow display but got ${passingGateDecision.status}.`)
  assert(passingGateDecision.canShowToPlayer, "Passing display gate should allow player display.")
  assert(passingGateDecision.review.phases.includes("original_passed"), "Passing display gate review should mark original pass.")
  assert(passingGateDecision.review.phases.includes("correction_not_needed"), "Passing display gate review should mark correction not needed.")
  assert(passingGateDecision.review.remainingFindingCount === 0, "Passing display gate review should have no remaining findings.")

  console.log("VISUAL JUDGE SMOKE")
  console.log("Visual Judge schema exists: ok")
  console.log("Visual Judge gateway exists: ok")
  console.log("Visual Judge public exports exist: ok")
  console.log("Runtime mutation boundary: ok")
  console.log(`Failing report findings: ${failingReport.findings.length}`)
  console.log(`Failing correction intents: ${failingCorrectionPlan.intentCount}`)
  console.log(`Failing correction actions: ${failingCorrectionPlan.actionCount}`)
  console.log(`Repairable correction applied actions: ${repairApplyResult.appliedActionIds.length}`)
  console.log(`Repairable display gate: ${repairableGateDecision.status}`)
  console.log(`Repairable gate phases: ${repairableGateDecision.review.phases.join("|")}`)
  console.log(`Expanded judgement findings: ${expandedJudgementReport.findings.length}`)
  console.log(`Advanced visual review findings: ${advancedReviewReport.findings.length}`)
  console.log(`Advanced correction intents: ${advancedCorrectionPlan.intentCount}`)
  console.log(`Advanced generated visual-only cells: ${advancedApplyResult.generatedCellIds.length}`)
  console.log(`Visual fact manifest entries: ${generatedManifest.entries.length}`)
  console.log(`Passing report score: ${passingReport.score}`)
  console.log("Autonomous world visual review: ok")
  console.log("Result: PASS")
}

function createFailingInput() {
  const visualGenerationPlan = createBaseVisualGenerationPlan({
    markerFallbackObjectCount: 1,
    markerFallbackKinds: ["structure"],
    objectRecipes: [
      createObjectRecipe("tree_primary", "tree", "natural_tree_object_recipe"),
    ],
    tags: ["visual_generation_plan", "debug_placeholder"],
  })
  const renderPlan = createBaseRenderPlan({
    commands: [
      createObjectBlockCommand("tree_primary", "block_1", 48, 48, 12, 12),
      {
        id: "render_object_structure_marker",
        layer: "object",
        kind: "place_object_recipe",
        sourceId: "structure_fallback",
        bounds: { x: 80, y: 80, width: 24, height: 32 },
        sortY: 112,
        recipeId: "world_building_placeholder_recipe",
        visible: true,
        stateTags: ["world_fact"],
      },
    ],
  })
  const pixelBufferFrame = createBaseBuffer({
    cells: [
      createObjectBlockCell("tree_primary", "block_1", 48, 48, 12, 12),
      createObjectBlockCell("debug_large", "block_2", 72, 52, 92, 86, {
        stateTags: ["debug_block"],
        opacity: 0.5,
      }),
      createObjectBlockCell("orphan_visual_object", "block_9", 112, 38, 10, 10),
      createObjectBlockCell("outside", "block_3", 196, 20, 28, 18),
      {
        id: "buffer_marker_structure",
        layer: "object",
        kind: "object_marker",
        x: 80,
        y: 80,
        width: 24,
        height: 32,
        sourceCommandId: "render_object_structure_marker",
        visible: true,
        opacity: 1,
        recipeId: "world_building_placeholder_recipe",
        stateTags: ["world_fact"],
      },
    ],
  })

  return { visualGenerationPlan, renderPlan, pixelBufferFrame }
}

function createPassingInput() {
  const visualGenerationPlan = createBaseVisualGenerationPlan({
    markerFallbackObjectCount: 0,
    markerFallbackKinds: [],
    objectRecipes: [
      createObjectRecipe("tree_primary", "tree", "natural_tree_object_recipe"),
      createObjectRecipe("facility_primary", "facility", "world_facility_object_recipe"),
    ],
    tags: ["visual_generation_plan"],
  })
  const renderPlan = createBaseRenderPlan({
    commands: [
      createObjectBlockCommand("tree_primary", "block_1", 40, 42, 12, 12),
      createObjectBlockCommand("tree_primary", "block_2", 52, 44, 10, 10),
      createObjectBlockCommand("tree_primary", "block_3", 46, 56, 9, 13),
      createObjectBlockCommand("facility_primary", "block_1", 118, 96, 18, 8),
      createObjectBlockCommand("facility_primary", "block_2", 122, 78, 14, 20),
      createObjectBlockCommand("facility_primary", "block_3", 132, 82, 4, 11),
    ],
  })
  const pixelBufferFrame = createBaseBuffer({
    cells: [
      createObjectBlockCell("tree_primary", "block_1", 40, 42, 12, 12),
      createObjectBlockCell("tree_primary", "block_2", 52, 44, 10, 10),
      createObjectBlockCell("tree_primary", "block_3", 46, 56, 9, 13),
      createObjectBlockCell("facility_primary", "block_1", 118, 96, 18, 8),
      createObjectBlockCell("facility_primary", "block_2", 122, 78, 14, 20),
      createObjectBlockCell("facility_primary", "block_3", 132, 82, 4, 11),
    ],
  })

  return { visualGenerationPlan, renderPlan, pixelBufferFrame }
}

function createPassingInputWithManifest() {
  return {
    ...createPassingInput(),
    visualFactManifest: {
      worldId: "visual-judge-smoke-world",
      tick: 1,
      entries: [
        {
          sourceId: "tree_primary",
          sourceKind: "ecology",
          semanticKind: "tree",
          visualOnly: false,
          originTags: ["world_view_object", "object_kind:tree"],
        },
        {
          sourceId: "facility_primary",
          sourceKind: "construction",
          semanticKind: "facility",
          visualOnly: false,
          originTags: ["world_view_object", "object_kind:facility"],
        },
      ],
      tags: ["visual_fact_manifest", "world_fact_source_manifest"],
    },
  }
}

function createMissingManifestInput() {
  return {
    ...createPassingInput(),
    visualFactManifest: {
      worldId: "visual-judge-smoke-world",
      tick: 1,
      entries: [
        {
          sourceId: "tree_primary",
          sourceKind: "ecology",
          semanticKind: "tree",
          visualOnly: false,
          originTags: ["world_view_object", "object_kind:tree"],
        },
      ],
      tags: ["visual_fact_manifest", "world_fact_source_manifest"],
    },
  }
}

function createRepairableInput() {
  const visualGenerationPlan = createBaseVisualGenerationPlan({
    markerFallbackObjectCount: 0,
    markerFallbackKinds: [],
    objectRecipes: [
      createObjectRecipe("tree_primary", "tree", "natural_tree_object_recipe"),
    ],
    tags: ["visual_generation_plan"],
  })
  const renderPlan = createBaseRenderPlan({
    commands: [
      createObjectBlockCommand("tree_primary", "block_1", 40, 42, 12, 12),
      createObjectBlockCommand("tree_primary", "block_2", 52, 44, 10, 10),
      createObjectBlockCommand("tree_primary", "block_3", 46, 56, 9, 13),
      createObjectBlockCommand("tree_primary", "block_4", 196, 20, 28, 18),
    ],
  })
  const pixelBufferFrame = createBaseBuffer({
    cells: [
      createObjectBlockCell("tree_primary", "block_1", 40, 42, 12, 12),
      createObjectBlockCell("tree_primary", "block_2", 52, 44, 10, 10),
      createObjectBlockCell("tree_primary", "block_3", 46, 56, 9, 13),
      createObjectBlockCell("tree_primary", "block_4", 196, 20, 28, 18),
    ],
  })

  return { visualGenerationPlan, renderPlan, pixelBufferFrame }
}

function createExpandedJudgementInput() {
  const visualGenerationPlan = createBaseVisualGenerationPlan({
    markerFallbackObjectCount: 0,
    markerFallbackKinds: [],
    objectRecipes: [
      createObjectRecipe("facility_thin", "facility", "world_facility_object_recipe"),
      createObjectRecipe("tree_ecology", "tree", "natural_tree_object_recipe", {
        stateTags: ["ecology_recovery"],
      }),
    ],
    tags: ["visual_generation_plan"],
  })
  const renderPlan = createBaseRenderPlan({
    commands: [
      createObjectBlockCommand("facility_thin", "block_1", 84, 72, 4, 18),
      createObjectBlockCommand("tree_ecology", "block_1", 20, 24, 12, 12),
      createObjectBlockCommand("tree_ecology", "block_2", 32, 26, 10, 10),
      createObjectBlockCommand("tree_ecology", "block_3", 26, 38, 9, 13),
      createTraceCommand("north_trace", 8, 8),
      createTraceCommand("center_trace", 96, 68),
      createTraceCommand("south_trace", 176, 120),
    ],
  })
  const pixelBufferFrame = createBaseBuffer({
    cells: [
      createObjectBlockCell("facility_thin", "block_1", 84, 72, 4, 18),
      createObjectBlockCell("tree_ecology", "block_1", 20, 24, 12, 12, {
        stateTags: ["ecology_recovery"],
      }),
      createObjectBlockCell("tree_ecology", "block_2", 32, 26, 10, 10, {
        stateTags: ["ecology_recovery"],
      }),
      createObjectBlockCell("tree_ecology", "block_3", 26, 38, 9, 13, {
        stateTags: ["ecology_recovery"],
      }),
      createTraceCell("north_trace", 8, 8),
      createTraceCell("center_trace", 96, 68),
      createTraceCell("south_trace", 176, 120),
    ],
  })

  return { visualGenerationPlan, renderPlan, pixelBufferFrame }
}

function createAdvancedVisualReviewInput() {
  const visualGenerationPlan = createBaseVisualGenerationPlan({
    markerFallbackObjectCount: 0,
    markerFallbackKinds: [],
    objectRecipes: [
      createObjectRecipe("facility_stage", "facility", "world_facility_object_recipe", {
        stateTags: ["under_construction"],
      }),
    ],
    tags: ["visual_generation_plan"],
  })
  const commands = [
    createObjectBlockCommand("facility_stage", "block_1", 68, 48, 22, 22),
    createObjectBlockCommand("facility_stage", "block_2", 90, 48, 22, 22),
    createObjectBlockCommand("facility_stage", "block_3", 112, 48, 22, 22),
    createObjectBlockCommand("facility_stage", "block_4", 68, 70, 22, 22),
    createObjectBlockCommand("facility_stage", "block_5", 90, 70, 22, 22),
    createObjectBlockCommand("facility_stage", "block_6", 112, 70, 22, 22),
    createObjectBlockCommand("facility_stage", "block_7", 80, 92, 22, 18),
    createObjectBlockCommand("facility_stage", "block_8", 104, 92, 22, 18),
    createTraceCommand("far_access_trace", 8, 8),
  ]
  const cells = [
    createObjectBlockCell("facility_stage", "block_1", 68, 48, 22, 22),
    createObjectBlockCell("facility_stage", "block_2", 90, 48, 22, 22),
    createObjectBlockCell("facility_stage", "block_3", 112, 48, 22, 22),
    createObjectBlockCell("facility_stage", "block_4", 68, 70, 22, 22),
    createObjectBlockCell("facility_stage", "block_5", 90, 70, 22, 22),
    createObjectBlockCell("facility_stage", "block_6", 112, 70, 22, 22),
    createObjectBlockCell("facility_stage", "block_7", 80, 92, 22, 18),
    createObjectBlockCell("facility_stage", "block_8", 104, 92, 22, 18),
    createTraceCell("far_access_trace", 8, 8),
  ]

  return {
    visualGenerationPlan,
    renderPlan: createBaseRenderPlan({ commands }),
    pixelBufferFrame: createBaseBuffer({ cells }),
  }
}

function createWorldViewModelFixture() {
  return {
    worldId: "visual-judge-smoke-world",
    ownerId: "smoke-owner",
    tick: 1,
    savedAt: "2026-06-03T00:00:00.000Z",
    canvas: {
      width: 200,
      height: 140,
      tileSize: 16,
      columns: 12,
      rows: 8,
    },
    tiles: [
      {
        id: "tile_grass_0_0",
        x: 0,
        y: 0,
        width: 16,
        height: 16,
        kind: "grass",
        variant: 1,
        traceIntensity: 0,
        traceSource: "none",
        passable: true,
      },
    ],
    objects: [
      {
        id: "tree_primary",
        kind: "tree",
        x: 40,
        y: 42,
        layer: "middle",
        scale: 1,
        opacity: 1,
        health: 88,
        growthStage: "mature",
        label: "Tree",
        source: "world_fact",
        tags: ["ecology"],
      },
      {
        id: "facility_primary",
        kind: "facility",
        x: 118,
        y: 78,
        layer: "middle",
        scale: 1,
        opacity: 1,
        health: 92,
        growthStage: "built",
        label: "Facility",
        source: "world_fact",
        tags: ["construction"],
      },
    ],
    traces: [
      {
        id: "trace_maintenance_1",
        visualKind: "maintenance",
        x: 80,
        y: 80,
        radius: 8,
        intensity: 0.8,
        opacity: 0.5,
        layer: "surface",
      },
    ],
    actors: [
      {
        id: "butler_1",
        kind: "butler",
        x: 64,
        y: 72,
        layer: "front",
        pose: "observe",
        label: "Butler",
        visible: true,
      },
    ],
    atmosphere: {
      mood: "calm",
      weather: "clear",
      opacity: 0.2,
    },
    butlerExplanation: {
      title: "Smoke",
      body: "Smoke",
    },
    pPhone: {
      unreadCount: 0,
      latestMessageTitle: "Smoke",
      latestMessageBody: "Smoke",
    },
    tags: ["smoke"],
  }
}

function createBaseVisualGenerationPlan(input) {
  return {
    worldId: "visual-judge-smoke-world",
    tick: 1,
    deterministicKey: "visual_judge_smoke",
    objectRecipes: input.objectRecipes,
    objectMigration: {
      blockEnabledKinds: input.objectRecipes.map((recipe) => recipe.kind),
      markerFallbackKinds: input.markerFallbackKinds,
      blockEnabledObjectCount: input.objectRecipes.length,
      markerFallbackObjectCount: input.markerFallbackObjectCount,
      tags: ["visual_generation_object_migration"],
    },
    actorSpriteFrames: [],
    traceVisuals: [],
    atmosphereVisuals: [],
    audit: { ok: true, warnings: [], tags: ["visual_generation_audit"] },
    tags: input.tags,
  }
}

function createObjectRecipe(sourceObjectId, kind, recipeId, options = {}) {
  return {
    recipeId,
    recipeVersion: "smoke",
    sourceObjectId,
    kind,
    anchor: { type: "center_bottom", x: 48, y: 64 },
    bounds: { x: 40, y: 42, width: 24, height: 28 },
    blocks: [
      {
        id: "block_1",
        x: 40,
        y: 42,
        width: 12,
        height: 12,
        color: "#2f7a3d",
        opacity: 1,
        layer: "object",
        stateTags: ["smoke"],
      },
      {
        id: "block_2",
        x: 52,
        y: 44,
        width: 10,
        height: 10,
        color: "#78c65a",
        opacity: 1,
        layer: "object",
        stateTags: ["smoke"],
      },
      {
        id: "block_3",
        x: 46,
        y: 56,
        width: 9,
        height: 13,
        color: "#11381f",
        opacity: 1,
        layer: "object",
        stateTags: ["smoke"],
      },
    ],
    deterministicKey: `${kind}:${sourceObjectId}`,
    stateTags: options.stateTags ?? ["smoke"],
  }
}

function createBaseRenderPlan(input) {
  return {
    worldId: "visual-judge-smoke-world",
    tick: 1,
    canvas: { width: 200, height: 140, tileSize: 16 },
    commands: input.commands,
    layerSummaries: [{ layer: "object", count: input.commands.length }],
  }
}

function createObjectBlockCommand(sourceId, blockId, x, y, width, height) {
  return {
    id: `render_object_block_${sourceId}_${blockId}`,
    layer: "object",
    kind: "draw_object_block",
    sourceId,
    bounds: { x, y, width, height },
    sortY: y + height,
    recipeId: "smoke_recipe",
    colorHint: "#2f7a3d",
    opacity: 1,
    visible: true,
    stateTags: ["visual_generation_block"],
  }
}

function createTraceCommand(sourceId, x, y) {
  return {
    id: `render_trace_${sourceId}`,
    layer: "trace",
    kind: "draw_trace_patch",
    sourceId,
    bounds: { x, y, width: 8, height: 8 },
    sortY: y + 8,
    opacity: 1,
    visible: true,
    stateTags: ["maintenance_trace"],
  }
}

function createBaseBuffer(input) {
  return {
    bufferId: "visual_judge_smoke_buffer",
    worldId: "visual-judge-smoke-world",
    tick: 1,
    canvas: { width: 200, height: 140, tileSize: 16 },
    layers: [
      {
        layer: "object",
        cells: input.cells,
        visibleCount: input.cells.filter((cell) => cell.visible).length,
        hiddenCount: input.cells.filter((cell) => !cell.visible).length,
      },
    ],
    cellCount: input.cells.length,
  }
}

function createObjectBlockCell(sourceId, blockId, x, y, width, height, options = {}) {
  return {
    id: `buffer_${sourceId}_${blockId}`,
    layer: "object",
    kind: "object_block",
    x,
    y,
    width,
    height,
    sourceCommandId: `render_object_block_${sourceId}_${blockId}`,
    visible: true,
    opacity: options.opacity ?? 1,
    colorHint: "#2f7a3d",
    recipeId: "smoke_recipe",
    stateTags: options.stateTags ?? ["visual_generation_block"],
  }
}

function createTraceCell(sourceId, x, y) {
  return {
    id: `buffer_trace_${sourceId}`,
    layer: "trace",
    kind: "trace",
    x,
    y,
    width: 8,
    height: 8,
    sourceCommandId: `render_trace_${sourceId}`,
    visible: true,
    opacity: 1,
    colorHint: "#6f7f52",
    stateTags: ["maintenance_trace"],
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

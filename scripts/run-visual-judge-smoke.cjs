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
    "judgePixelWorldVisual",
    "buildVisualCorrectionPlan",
    "illegal_debug_visual",
    "readability",
    "density",
    "composition",
    "semantic",
    "business_rule",
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

  const { buildVisualCorrectionPlan, judgePixelWorldVisual } = localRequire(
    path.join(repoRoot, "src", "world", "visual-judge", "index.ts")
  )

  const failingReport = judgePixelWorldVisual(createFailingInput())
  const failingCorrectionPlan = buildVisualCorrectionPlan(failingReport)
  assert(!failingReport.ok, "Failing visual report should not be ok.")
  assert(failingReport.severity === "fail", `Unexpected failing severity: ${failingReport.severity}`)
  assert(failingReport.findings.some((finding) => finding.category === "illegal_debug_visual"), "Large debug visual should be detected.")
  assert(failingReport.findings.some((finding) => finding.category === "semantic"), "Marker fallback should be detected.")
  assert(failingReport.findings.some((finding) => finding.category === "business_rule"), "Forbidden business token should be detected.")
  assert(failingReport.findings.some((finding) => finding.category === "composition"), "Out of bounds or center obstruction should be detected.")
  assert(failingCorrectionPlan.shouldRegenerateVisuals, "Failing report should request visual regeneration.")
  assert(failingCorrectionPlan.actionCount === failingReport.findings.length, "Correction action count should match finding count.")
  assert(failingCorrectionPlan.actions.every((action) => action.affectsRuntimeFacts === false), "Correction actions must stay visual-only.")
  assert(failingCorrectionPlan.actions.some((action) => action.type === "remove_visual_block"), "Correction plan should remove illegal visual blocks.")
  assert(failingCorrectionPlan.actions.some((action) => action.type === "replace_visual_recipe"), "Correction plan should replace marker fallback recipes.")

  const passingReport = judgePixelWorldVisual(createPassingInput())
  const passingCorrectionPlan = buildVisualCorrectionPlan(passingReport)
  assert(passingReport.ok, `Passing visual report should be ok: ${passingReport.findings.map((finding) => finding.id).join(", ")}`)
  assert(passingReport.severity === "pass", `Unexpected passing severity: ${passingReport.severity}`)
  assert(passingReport.score === 100, `Passing report should score 100 but got ${passingReport.score}.`)
  assert(!passingCorrectionPlan.shouldRegenerateVisuals, "Passing report should not request visual regeneration.")
  assert(passingCorrectionPlan.actionCount === 0, "Passing report should not create correction actions.")

  console.log("VISUAL JUDGE SMOKE")
  console.log("Visual Judge schema exists: ok")
  console.log("Visual Judge gateway exists: ok")
  console.log("Visual Judge public exports exist: ok")
  console.log("Runtime mutation boundary: ok")
  console.log(`Failing report findings: ${failingReport.findings.length}`)
  console.log(`Failing correction actions: ${failingCorrectionPlan.actionCount}`)
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

function createObjectRecipe(sourceObjectId, kind, recipeId) {
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
    stateTags: ["smoke"],
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

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

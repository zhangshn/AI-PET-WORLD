async function main() {
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)

  function fail(message) {
    console.log("VISUAL GENERATION NATURAL OBJECT SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
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

  const { buildVisualGenerationPlan } = localRequire(
    path.join(repoRoot, "src", "world", "visual-generation", "index.ts")
  )
  const {
    buildPixelWorldPixelBufferFrame,
    buildPixelWorldRenderPlan,
    buildPixelWorldRendererFrame,
    mapPixelWorldViewModelFromSnapshot,
    mapWorldViewModelToPixelWorldSourceSnapshot,
  } = localRequire(path.join(repoRoot, "src", "world", "pixel-worldview", "index.ts"))

  const worldViewModel = createTreeWorldViewModel()
  const visualPlan = buildVisualGenerationPlan({ worldViewModel })
  const source = mapWorldViewModelToPixelWorldSourceSnapshot(worldViewModel)
  const pixelModel = mapPixelWorldViewModelFromSnapshot(source)
  const renderPlan = buildPixelWorldRenderPlan(pixelModel, {
    visualGenerationPlan: visualPlan,
  })
  const rendererResult = buildPixelWorldRendererFrame({ plan: renderPlan })
  const bufferResult = buildPixelWorldPixelBufferFrame({
    plan: renderPlan,
    frame: rendererResult.frame,
  })

  const treeResult = inspectObjectPipeline({
    sourceId: "tree_primary",
    visualPlan,
    renderPlan,
    buffer: bufferResult.buffer,
  })
  const stoneResult = inspectObjectPipeline({
    sourceId: "stone_primary",
    visualPlan,
    renderPlan,
    buffer: bufferResult.buffer,
  })
  const insectResult = inspectObjectPipeline({
    sourceId: "insect_primary",
    visualPlan,
    renderPlan,
    buffer: bufferResult.buffer,
  })
  const bushResult = inspectObjectPipeline({
    sourceId: "bush_primary",
    visualPlan,
    renderPlan,
    buffer: bufferResult.buffer,
  })
  const flowerResult = inspectObjectPipeline({
    sourceId: "flower_primary",
    visualPlan,
    renderPlan,
    buffer: bufferResult.buffer,
  })
  const mushroomResult = inspectObjectPipeline({
    sourceId: "mushroom_primary",
    visualPlan,
    renderPlan,
    buffer: bufferResult.buffer,
  })
  const structureResult = inspectObjectPipeline({
    sourceId: "structure_primary",
    visualPlan,
    renderPlan,
    buffer: bufferResult.buffer,
  })
  const facilityResult = inspectObjectPipeline({
    sourceId: "facility_primary",
    visualPlan,
    renderPlan,
    buffer: bufferResult.buffer,
  })

  assert(visualPlan.audit.ok, `Visual generation audit failed: ${visualPlan.audit.warnings.join(" | ")}`)
  assertMigrationSummary(assert, visualPlan)
  assertVisualObjectPipeline(assert, treeResult, "Tree", 8)
  assertVisualObjectPipeline(assert, stoneResult, "Stone", 8)
  assertVisualObjectPipeline(assert, insectResult, "Insect signal", 8)
  assertVisualObjectPipeline(assert, bushResult, "Bush", 8)
  assertVisualObjectPipeline(assert, flowerResult, "Flower", 8)
  assertVisualObjectPipeline(assert, mushroomResult, "Mushroom", 7)
  assertVisualObjectPipeline(assert, structureResult, "Structure", 8)
  assertVisualObjectPipeline(assert, facilityResult, "Facility", 6)

  console.log("VISUAL GENERATION NATURAL OBJECT SMOKE")
  console.log(`Tree recipe blocks: ${treeResult.recipe.blocks.length}`)
  console.log(`Tree render block commands: ${treeResult.blockCommands.length}`)
  console.log(`Tree buffer block cells: ${treeResult.blockCells.length}`)
  console.log("Tree marker fallback: disabled")
  console.log(`Stone recipe blocks: ${stoneResult.recipe.blocks.length}`)
  console.log(`Stone render block commands: ${stoneResult.blockCommands.length}`)
  console.log(`Stone buffer block cells: ${stoneResult.blockCells.length}`)
  console.log("Stone marker fallback: disabled")
  console.log(`Insect signal recipe blocks: ${insectResult.recipe.blocks.length}`)
  console.log(`Insect signal render block commands: ${insectResult.blockCommands.length}`)
  console.log(`Insect signal buffer block cells: ${insectResult.blockCells.length}`)
  console.log("Insect signal marker fallback: disabled")
  console.log(`Bush recipe blocks: ${bushResult.recipe.blocks.length}`)
  console.log(`Bush render block commands: ${bushResult.blockCommands.length}`)
  console.log(`Bush buffer block cells: ${bushResult.blockCells.length}`)
  console.log("Bush marker fallback: disabled")
  console.log(`Flower recipe blocks: ${flowerResult.recipe.blocks.length}`)
  console.log(`Flower render block commands: ${flowerResult.blockCommands.length}`)
  console.log(`Flower buffer block cells: ${flowerResult.blockCells.length}`)
  console.log("Flower marker fallback: disabled")
  console.log(`Mushroom recipe blocks: ${mushroomResult.recipe.blocks.length}`)
  console.log(`Mushroom render block commands: ${mushroomResult.blockCommands.length}`)
  console.log(`Mushroom buffer block cells: ${mushroomResult.blockCells.length}`)
  console.log("Mushroom marker fallback: disabled")
  console.log(`Structure recipe blocks: ${structureResult.recipe.blocks.length}`)
  console.log(`Structure render block commands: ${structureResult.blockCommands.length}`)
  console.log(`Structure buffer block cells: ${structureResult.blockCells.length}`)
  console.log("Structure marker fallback: disabled")
  console.log(`Facility recipe blocks: ${facilityResult.recipe.blocks.length}`)
  console.log(`Facility render block commands: ${facilityResult.blockCommands.length}`)
  console.log(`Facility buffer block cells: ${facilityResult.blockCells.length}`)
  console.log("Facility marker fallback: disabled")
  console.log(`Block-enabled kinds: ${visualPlan.objectMigration.blockEnabledKinds.join(", ")}`)
  console.log(`Marker fallback kinds: ${visualPlan.objectMigration.markerFallbackKinds.join(", ") || "none"}`)
  console.log("Visual generation audit: ok")
  console.log("Result: PASS")
}

function inspectObjectPipeline(input) {
  const recipe = input.visualPlan.objectRecipes.find(
    (item) => item.sourceObjectId === input.sourceId
  )
  const markerCommands = input.renderPlan.commands.filter(
    (command) =>
      command.sourceId === input.sourceId &&
      command.kind === "place_object_recipe"
  )
  const blockCommands = input.renderPlan.commands.filter(
    (command) =>
      command.sourceId === input.sourceId &&
      command.kind === "draw_object_block"
  )
  const blockCells = input.buffer.layers
    .flatMap((layer) => layer.cells)
    .filter(
      (cell) =>
        cell.sourceCommandId.includes(`render_object_block_${input.sourceId}`) &&
        cell.kind === "object_block"
    )

  return {
    recipe,
    markerCommands,
    blockCommands,
    blockCells,
  }
}

function assertVisualObjectPipeline(assert, result, label, minBlockCount) {
  assert(result.recipe, `${label} VisualObjectRecipe was not generated.`)
  assert(
    result.recipe.blocks.length >= minBlockCount,
    `${label} recipe did not generate enough blocks.`
  )
  assert(
    result.blockCommands.length === result.recipe.blocks.length,
    `${label} render commands do not match recipe blocks.`
  )
  assert(
    result.blockCells.length === result.recipe.blocks.length,
    `${label} buffer cells do not match recipe blocks.`
  )
  assert(result.markerCommands.length === 0, `${label} still falls back to object_marker.`)
  assert(
    result.blockCells.every((cell) => /^#[0-9a-f]{6}$/i.test(cell.colorHint)),
    `${label} block cells are missing concrete color hints.`
  )
}

function assertMigrationSummary(assert, visualPlan) {
  const blockEnabledKinds = visualPlan.objectMigration.blockEnabledKinds
  const markerFallbackKinds = visualPlan.objectMigration.markerFallbackKinds

  ;["tree", "stone", "insect_signal", "bush", "flower", "mushroom", "structure", "facility"].forEach((kind) => {
    assert(
      blockEnabledKinds.includes(kind),
      `Migration summary does not mark ${kind} as block-enabled.`
    )
  })
  assert(markerFallbackKinds.length === 0, `Unexpected marker fallback kinds: ${markerFallbackKinds.join(", ")}`)
  assert(
    visualPlan.objectMigration.markerFallbackObjectCount === 0,
    `Unexpected fallback object count: ${visualPlan.objectMigration.markerFallbackObjectCount}`
  )
}

function createTreeWorldViewModel() {
  return {
    worldId: "visual-generation-tree-smoke-world",
    ownerId: "visual-generation-tree-smoke-owner",
    tick: 3,
    savedAt: "2026-06-03T00:00:00.000Z",
    canvas: {
      width: 320,
      height: 220,
      tileSize: 16,
      columns: 20,
      rows: 13,
    },
    tiles: [],
    objects: [
      {
        id: "tree_primary",
        kind: "tree",
        x: 96,
        y: 112,
        layer: "middle",
        scale: 1,
        opacity: 1,
        health: 84,
        growthStage: "mature",
        label: "Tree",
        source: "world_fact",
        tags: ["world_fact", "visual_generation_tree_smoke"],
      },
      {
        id: "stone_primary",
        kind: "stone",
        x: 176,
        y: 136,
        layer: "middle",
        scale: 0.82,
        opacity: 1,
        health: 76,
        growthStage: "mature",
        label: "Stone",
        source: "world_fact",
        tags: ["world_fact", "visual_generation_stone_smoke"],
      },
      {
        id: "insect_primary",
        kind: "insect_signal",
        x: 224,
        y: 118,
        layer: "front",
        scale: 0.9,
        opacity: 1,
        health: 82,
        growthStage: "mature",
        label: "Insect signal",
        source: "derived_visual_only",
        tags: [
          "derived_visual_only",
          "not_world_fact",
          "visual_generation_insect_smoke",
        ],
      },
      {
        id: "bush_primary",
        kind: "bush",
        x: 252,
        y: 142,
        layer: "middle",
        scale: 0.86,
        opacity: 1,
        health: 78,
        growthStage: "mature",
        label: "Bush",
        source: "derived_visual_only",
        tags: [
          "derived_visual_only",
          "not_world_fact",
          "visual_generation_marker_fallback_smoke",
        ],
      },
      {
        id: "flower_primary",
        kind: "flower",
        x: 278,
        y: 154,
        layer: "front",
        scale: 0.72,
        opacity: 1,
        health: 74,
        growthStage: "mature",
        label: "Flower",
        source: "derived_visual_only",
        tags: [
          "derived_visual_only",
          "not_world_fact",
          "visual_generation_marker_fallback_smoke",
        ],
      },
      {
        id: "mushroom_primary",
        kind: "mushroom",
        x: 294,
        y: 160,
        layer: "front",
        scale: 0.7,
        opacity: 1,
        health: 68,
        growthStage: "mature",
        label: "Mushroom",
        source: "derived_visual_only",
        tags: [
          "derived_visual_only",
          "not_world_fact",
          "visual_generation_marker_fallback_smoke",
        ],
      },
      {
        id: "structure_primary",
        kind: "structure",
        x: 204,
        y: 164,
        layer: "middle",
        scale: 0.76,
        opacity: 1,
        health: 72,
        growthStage: "mature",
        label: "Structure",
        source: "world_fact",
        tags: [
          "world_fact",
          "visual_generation_structure_fallback_smoke",
        ],
      },
      {
        id: "facility_primary",
        kind: "facility",
        x: 250,
        y: 164,
        layer: "middle",
        scale: 0.76,
        opacity: 1,
        health: 74,
        growthStage: "mature",
        label: "Facility",
        source: "world_fact",
        tags: [
          "world_fact",
          "visual_generation_facility_smoke",
        ],
      },
    ],
    traces: [],
    actors: [],
    atmosphere: {
      mood: "calm",
      weather: "clear",
      opacity: 0,
    },
    butlerExplanation: {
      title: "Butler",
      body: "Read-only smoke.",
    },
    pPhone: {
      unreadCount: 0,
      latestMessageTitle: "P-Phone",
      latestMessageBody: "Inactive in this smoke.",
    },
    tags: ["visual_generation_tree_smoke"],
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

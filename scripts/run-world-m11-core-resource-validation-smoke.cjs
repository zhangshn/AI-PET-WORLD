async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")

  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const worldPagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const pixelViewPath = path.join(repoRoot, "src", "app", "world", "components", "pixel-world-view", "pixel-world-view.tsx")
  const viewModelDir = path.join(repoRoot, "src", "world", "world-view-model")
  const viewModelGatewayPath = path.join(viewModelDir, "world-view-model-gateway.ts")
  const viewModelSchemaPath = path.join(viewModelDir, "world-view-model-schema.ts")
  const runtimeSchemaPath = path.join(repoRoot, "src", "world", "runtime", "world-runtime-schema.ts")
  const homeMapSchemaPath = path.join(repoRoot, "src", "world", "map-state", "home-map-state-schema.ts")
  const spaceIndexPath = path.join(repoRoot, "src", "world", "space", "index.ts")
  const spaceSchemaPath = path.join(repoRoot, "src", "world", "space", "space-schema.ts")
  const spaceBuilderPath = path.join(repoRoot, "src", "world", "space", "space-grid-builder.ts")

  const REGION_KINDS = new Set([
    "home",
    "yard",
    "nature",
    "structure",
    "town_connection",
    "blocked",
    "boundary",
    "unopened",
    "locked",
    "unknown",
  ])
  const TERRAIN_KINDS = new Set([
    "grass",
    "soil",
    "forest_floor",
    "sand",
    "wetland",
    "stone",
    "built",
    "unknown",
  ])
  const PASSABILITY_KINDS = new Set(["passable", "blocked", "restricted", "unknown"])
  const TRACE_LEVELS = new Set(["none", "weak", "medium", "strong"])
  const OCCUPANCY_KINDS = new Set([
    "empty",
    "natural_object",
    "structure_object",
    "life_object",
    "event_anchor",
    "unknown",
  ])

  function fail(message) {
    console.log("M11 CORE RESOURCE VALIDATION SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function hashText(raw) {
    return crypto.createHash("sha256").update(raw).digest("hex")
  }

  function parseJson(raw, message) {
    try {
      return JSON.parse(raw)
    } catch (error) {
      fail(`${message} ${error.message}`)
    }
  }

  function installTypeScriptRequireHook() {
    const moduleConstructor = moduleApi.default
    const originalResolveFilename = moduleConstructor._resolveFilename

    moduleConstructor._resolveFilename = function resolveFilename(request, parent, isMain, options) {
      if (request.startsWith("@/")) {
        return originalResolveFilename.call(this, path.join(repoRoot, "src", request.slice(2)), parent, isMain, options)
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

  function readDirectorySources(directory) {
    return fs
      .readdirSync(directory)
      .filter((fileName) => fileName.endsWith(".ts"))
      .map((fileName) => fs.readFileSync(path.join(directory, fileName), "utf8"))
      .join("\n")
  }

  function assertStaticValidationLibraryContract() {
    const worldPageSource = fs.readFileSync(worldPagePath, "utf8")
    const pixelViewSource = fs.readFileSync(pixelViewPath, "utf8")
    const viewModelSchemaSource = fs.readFileSync(viewModelSchemaPath, "utf8")
    const viewModelSources = readDirectorySources(viewModelDir)
    const runtimeSchemaSource = fs.readFileSync(runtimeSchemaPath, "utf8")
    const homeMapSchemaSource = fs.readFileSync(homeMapSchemaPath, "utf8")
    const spaceSchemaSource = fs.readFileSync(spaceSchemaPath, "utf8")
    const spaceBuilderSource = fs.readFileSync(spaceBuilderPath, "utf8")
    const formalSources = [worldPageSource, pixelViewSource, viewModelSources].join("\n")

    const requiredTokens = [
      "WorldRuntimeSaveRecord",
      "HomeMapState",
      "TraceField",
      "TraceMemorySeedField",
      "TraceInfluenceSummary",
      "WorldViewModel",
      "WorldViewObjectSource",
      "SpaceCell",
      "SpaceGrid",
      "SpaceRegion",
      "regionKind",
      "terrainKind",
      "passability",
      "passable",
      "traceStrength",
      "traceLevel",
      "movementCost",
      "buildSpaceGridFromHomeMapState",
      "world_fact",
      "derived_visual_only",
      "not_world_fact",
      "no_runtime_write",
      "runtime_read_only_projection",
      "no_world_fact_generation",
      "no_default_pet_actor",
      "pet_actor_requires_existing_fact",
      "readWorldRuntimeForView",
      "buildWorldViewModelForPixelWorld",
      "data-surface-state=\"cleared\"",
    ]

    const combinedValidationSources = [
      runtimeSchemaSource,
      homeMapSchemaSource,
      spaceSchemaSource,
      spaceBuilderSource,
      viewModelSchemaSource,
      viewModelSources,
      worldPageSource,
      pixelViewSource,
    ].join("\n")

    requiredTokens.forEach((token) =>
      assert(combinedValidationSources.includes(token), `Core validation library is missing required token: ${token}.`)
    )

    const forbiddenFormalTokens = [
      "buildSceneSvg",
      "data:image/svg+xml",
      "WorldPainterReadonlyPreview",
      "FormalWorldView",
      "ProceduralRendererView",
      "scene-composer-gateway",
      "composeScene",
      "buildDefaultSceneComposerFact",
      "adaptHomeMapStateToSceneComposerFact",
      "roadGraph",
      "pathGraph",
      "pet_default",
      "createPet",
    ]

    const forbiddenHits = forbiddenFormalTokens.filter((token) => formalSources.includes(token))
    assert(forbiddenHits.length === 0, `Formal validation path contains forbidden token: ${forbiddenHits.join(", ")}`)
    assert(!pixelViewSource.includes("P-Phone"), "M11 core validation found old P-Phone card copy in formal /world surface.")
    assert(!pixelViewSource.includes("管家说明"), "M11 core validation found old butler explanation card copy in formal /world surface.")
    assert(!pixelViewSource.includes("当前记录"), "M11 core validation found old current record card copy in formal /world surface.")
  }

  function assertRuntimeRecord(record) {
    assert(record.version === "v2.6-runtime-00", "Runtime save version is not v2.6-runtime-00.")
    assert(typeof record.worldId === "string" && record.worldId.length > 0, "Runtime save has no worldId.")
    assert(typeof record.ownerId === "string" && record.ownerId.length > 0, "Runtime save has no ownerId.")
    assert(Number.isInteger(record.tick) && record.tick >= 0, "Runtime tick is invalid.")
    assert(record.homeMapState, "Runtime save has no HomeMapState.")
    assert(record.traceField, "Runtime save has no TraceField.")
    assert(record.traceMemorySeedField, "Runtime save has no TraceMemorySeedField.")
    assert(record.traceInfluenceSummary, "Runtime save has no TraceInfluenceSummary.")
    assert(Array.isArray(record.recentEvents), "Runtime recentEvents is not an array.")
    assert(Array.isArray(record.tags), "Runtime tags is not an array.")
  }

  function assertHomeMapState(record) {
    const homeMapState = record.homeMapState
    const mapSize = homeMapState.mapSize

    assert(homeMapState.worldId === record.worldId, "HomeMapState worldId does not match runtime worldId.")
    assert(homeMapState.ownerId === record.ownerId, "HomeMapState ownerId does not match runtime ownerId.")
    assert(Number.isInteger(mapSize.columns) && mapSize.columns > 0, "HomeMapState columns is invalid.")
    assert(Number.isInteger(mapSize.rows) && mapSize.rows > 0, "HomeMapState rows is invalid.")
    assert(Number.isInteger(mapSize.tileSize) && mapSize.tileSize > 0, "HomeMapState tileSize is invalid.")
    assert(Array.isArray(homeMapState.placements), "HomeMapState placements is not an array.")
    assert(Array.isArray(homeMapState.zones), "HomeMapState zones is not an array.")
    assert(Array.isArray(homeMapState.constructionPlans), "HomeMapState constructionPlans is not an array.")
    assert(Array.isArray(homeMapState.mapDiffs), "HomeMapState mapDiffs is not an array.")

    const petPlacements = homeMapState.placements.filter(
      (placement) =>
        placement.layer === "actor" &&
        (placement.tags.includes("pet") ||
          placement.id.toLowerCase().includes("pet") ||
          placement.label.toLowerCase().includes("pet") ||
          placement.label.includes("宠物"))
    )

    assert(petPlacements.length === 0, "Core validation found a default pet placement in HomeMapState.")
  }

  function assertSpaceGrid(record, spaceGrid, model) {
    const expectedTileCount = record.homeMapState.mapSize.columns * record.homeMapState.mapSize.rows
    const expectedWidth = record.homeMapState.mapSize.columns * record.homeMapState.mapSize.tileSize
    const expectedHeight = record.homeMapState.mapSize.rows * record.homeMapState.mapSize.tileSize
    const tileById = new Map(model.tiles.map((tile) => [tile.id, tile]))
    const regionCountTotal = Object.values(spaceGrid.summary.regionCounts).reduce((sum, value) => sum + value, 0)
    const terrainCountTotal = Object.values(spaceGrid.summary.terrainCounts).reduce((sum, value) => sum + value, 0)
    const occupancyCountTotal = Object.values(spaceGrid.summary.occupancyCounts).reduce((sum, value) => sum + value, 0)
    const passableCells = spaceGrid.cells.filter((cell) => cell.passability === "passable").length
    const blockedCells = spaceGrid.cells.filter((cell) => cell.passability === "blocked").length
    const restrictedCells = spaceGrid.cells.filter((cell) => cell.passability === "restricted").length
    const occupiedCells = spaceGrid.cells.filter((cell) => cell.occupancyKind !== "empty").length
    const traceInfluencedCells = spaceGrid.cells.filter((cell) => cell.traceInfluenceStrength > 0).length
    const boundaryCells = spaceGrid.cells.filter((cell) => cell.regionKind === "boundary")

    assert(spaceGrid.worldId === record.worldId, "SpaceGrid worldId does not match runtime record.")
    assert(spaceGrid.columns === record.homeMapState.mapSize.columns, "SpaceGrid columns do not match HomeMapState.")
    assert(spaceGrid.rows === record.homeMapState.mapSize.rows, "SpaceGrid rows do not match HomeMapState.")
    assert(spaceGrid.tileSize === record.homeMapState.mapSize.tileSize, "SpaceGrid tileSize does not match HomeMapState.")
    assert(spaceGrid.width === expectedWidth, "SpaceGrid width does not match HomeMapState.")
    assert(spaceGrid.height === expectedHeight, "SpaceGrid height does not match HomeMapState.")
    assert(spaceGrid.cells.length === expectedTileCount, "SpaceGrid cell count does not match map size.")
    assert(spaceGrid.regions.length > 0, "SpaceGrid has no regions.")
    assert(boundaryCells.length > 0, "SpaceGrid has no boundary cells.")
    assert(spaceGrid.summary.totalCells === expectedTileCount, "SpaceGrid summary totalCells does not match cell count.")
    assert(spaceGrid.summary.passableCells === passableCells, "SpaceGrid summary passableCells mismatch.")
    assert(spaceGrid.summary.blockedCells === blockedCells, "SpaceGrid summary blockedCells mismatch.")
    assert(spaceGrid.summary.restrictedCells === restrictedCells, "SpaceGrid summary restrictedCells mismatch.")
    assert(spaceGrid.summary.occupiedCells === occupiedCells, "SpaceGrid summary occupiedCells mismatch.")
    assert(spaceGrid.summary.traceInfluencedCells === traceInfluencedCells, "SpaceGrid summary traceInfluencedCells mismatch.")
    assert(regionCountTotal === expectedTileCount, "SpaceGrid regionCounts total does not match cell count.")
    assert(terrainCountTotal === expectedTileCount, "SpaceGrid terrainCounts total does not match cell count.")
    assert(occupancyCountTotal === expectedTileCount, "SpaceGrid occupancyCounts total does not match cell count.")

    spaceGrid.cells.forEach((cell) => {
      const tile = tileById.get(`world_view_tile_${cell.id}`)

      assert(tile, `WorldViewModel is missing tile for ${cell.id}.`)
      assert(cell.id === `space_cell_${cell.column}_${cell.row}`, `SpaceCell id is not coordinate-stable: ${cell.id}.`)
      assert(Number.isInteger(cell.row) && cell.row >= 0 && cell.row < spaceGrid.rows, `SpaceCell row out of range: ${cell.id}.`)
      assert(Number.isInteger(cell.column) && cell.column >= 0 && cell.column < spaceGrid.columns, `SpaceCell column out of range: ${cell.id}.`)
      assert(cell.x === cell.column * spaceGrid.tileSize + spaceGrid.tileSize / 2, `SpaceCell x center mismatch: ${cell.id}.`)
      assert(cell.y === cell.row * spaceGrid.tileSize + spaceGrid.tileSize / 2, `SpaceCell y center mismatch: ${cell.id}.`)
      assert(cell.coordinate.x === cell.x && cell.coordinate.y === cell.y, `SpaceCell coordinate copy mismatch: ${cell.id}.`)
      assert(REGION_KINDS.has(cell.regionKind), `SpaceCell regionKind is invalid: ${cell.regionKind}.`)
      assert(cell.regionType === cell.regionKind, `SpaceCell regionType does not mirror regionKind: ${cell.id}.`)
      assert(TERRAIN_KINDS.has(cell.terrainKind), `SpaceCell terrainKind is invalid: ${cell.terrainKind}.`)
      assert(PASSABILITY_KINDS.has(cell.passability), `SpaceCell passability is invalid: ${cell.passability}.`)
      assert(TRACE_LEVELS.has(cell.traceLevel), `SpaceCell traceLevel is invalid: ${cell.traceLevel}.`)
      assert(OCCUPANCY_KINDS.has(cell.occupancyKind), `SpaceCell occupancyKind is invalid: ${cell.occupancyKind}.`)
      assert(cell.traceStrength >= 0 && cell.traceStrength <= 100, `SpaceCell traceStrength out of range: ${cell.id}.`)
      assert(cell.traceInfluenceStrength >= 0 && cell.traceInfluenceStrength <= 100, `SpaceCell traceInfluenceStrength out of range: ${cell.id}.`)
      assert(cell.moistureHint >= 0 && cell.moistureHint <= 100, `SpaceCell moistureHint out of range: ${cell.id}.`)
      assert(cell.ecologyHealthHint >= 0 && cell.ecologyHealthHint <= 100, `SpaceCell ecologyHealthHint out of range: ${cell.id}.`)
      assert(cell.passable === (cell.passability === "passable"), `SpaceCell passable boolean does not match passability: ${cell.id}.`)
      assert(cell.passability !== "blocked" || cell.movementCost === 999, `Blocked SpaceCell movementCost must be 999: ${cell.id}.`)
      assert(cell.passability === "blocked" || (cell.movementCost >= 12 && cell.movementCost <= 180), `SpaceCell movementCost out of expected range: ${cell.id}.`)
      assert(cell.movementCostFactors.length > 0, `SpaceCell has no movementCostFactors: ${cell.id}.`)
      assert(cell.occupancyIds.length === cell.occupancy.length, `SpaceCell occupancyIds do not match occupancy: ${cell.id}.`)
      assert(tile.x === cell.column * spaceGrid.tileSize, `WorldViewTile x does not match SpaceCell column: ${cell.id}.`)
      assert(tile.y === cell.row * spaceGrid.tileSize, `WorldViewTile y does not match SpaceCell row: ${cell.id}.`)
      assert(tile.width === spaceGrid.tileSize && tile.height === spaceGrid.tileSize, `WorldViewTile size does not match SpaceGrid tileSize: ${cell.id}.`)
      assert(tile.passable === cell.passable, `WorldViewTile passable does not mirror SpaceCell passable: ${cell.id}.`)
      assert(tile.traceIntensity === Math.round(Math.max(cell.traceStrength, cell.traceInfluenceStrength)), `WorldViewTile traceIntensity does not mirror SpaceCell trace strength: ${cell.id}.`)
    })
  }

  function assertWorldViewModel(record, model) {
    const expectedTileCount = record.homeMapState.mapSize.columns * record.homeMapState.mapSize.rows
    const expectedWidth = record.homeMapState.mapSize.columns * record.homeMapState.mapSize.tileSize
    const expectedHeight = record.homeMapState.mapSize.rows * record.homeMapState.mapSize.tileSize
    const factObjects = model.objects.filter((object) => object.source === "world_fact")
    const derivedObjects = model.objects.filter((object) => object.source === "derived_visual_only")
    const visiblePetActors = model.actors.filter((actor) => actor.kind === "pet" && actor.visible)

    assert(model.worldId === record.worldId, "WorldViewModel worldId does not match runtime record.")
    assert(model.ownerId === record.ownerId, "WorldViewModel ownerId does not match runtime record.")
    assert(model.tick === record.tick, "WorldViewModel tick does not match runtime record.")
    assert(model.canvas.width === expectedWidth, "WorldViewModel canvas width is not mapped from HomeMapState / SpaceGrid.")
    assert(model.canvas.height === expectedHeight, "WorldViewModel canvas height is not mapped from HomeMapState / SpaceGrid.")
    assert(model.canvas.columns === record.homeMapState.mapSize.columns, "WorldViewModel columns do not match HomeMapState.")
    assert(model.canvas.rows === record.homeMapState.mapSize.rows, "WorldViewModel rows do not match HomeMapState.")
    assert(model.canvas.tileSize === record.homeMapState.mapSize.tileSize, "WorldViewModel tileSize does not match HomeMapState.")
    assert(model.tiles.length === expectedTileCount, "WorldViewModel tile count does not match SpaceGrid size.")
    assert(model.objects.length > 0, "WorldViewModel has no objects.")
    assert(factObjects.length > 0, "WorldViewModel has no world_fact objects.")
    assert(derivedObjects.length > 0, "WorldViewModel has no derived_visual_only objects.")
    assert(
      derivedObjects.every((object) => object.tags.includes("not_world_fact") && object.tags.includes("no_runtime_write")),
      "derived_visual_only objects are not marked as not_world_fact / no_runtime_write."
    )
    assert(model.traces.length === record.traceField.traces.length, "WorldViewModel trace projection count does not match TraceField.")
    assert(model.actors.some((actor) => actor.kind === "butler" && actor.visible), "WorldViewModel has no visible butler actor.")
    assert(visiblePetActors.length === 0, "WorldViewModel generated a default visible pet actor.")
    assert(model.tags.includes("runtime_read_only_projection"), "WorldViewModel is missing runtime_read_only_projection tag.")
    assert(model.tags.includes("no_world_fact_generation"), "WorldViewModel is missing no_world_fact_generation tag.")
    assert(model.tags.includes("no_default_pet_actor"), "WorldViewModel is missing no_default_pet_actor tag.")
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(worldPagePath)) fail("World page is missing.")
  if (!fs.existsSync(pixelViewPath)) fail("PixelWorldView is missing.")
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")
  if (!fs.existsSync(viewModelSchemaPath)) fail("WorldViewModel schema is missing.")
  if (!fs.existsSync(runtimeSchemaPath)) fail("Runtime schema is missing.")
  if (!fs.existsSync(homeMapSchemaPath)) fail("HomeMapState schema is missing.")
  if (!fs.existsSync(spaceIndexPath)) fail("Space index is missing.")
  if (!fs.existsSync(spaceSchemaPath)) fail("Space schema is missing.")
  if (!fs.existsSync(spaceBuilderPath)) fail("SpaceGrid builder is missing.")

  assertStaticValidationLibraryContract()
  installTypeScriptRequireHook()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = hashText(beforeRaw)
  const record = parseJson(beforeRaw, "Runtime save is not valid JSON.")
  const beforeTick = record.tick
  const beforePlacementCount = record.homeMapState.placements.length

  assertRuntimeRecord(record)
  assertHomeMapState(record)

  const { buildSpaceGridFromHomeMapState } = localRequire(spaceIndexPath)
  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const spaceGrid = buildSpaceGridFromHomeMapState({
    homeMapState: record.homeMapState,
    traceField: record.traceField,
  })
  const model = buildWorldViewModelForPixelWorld({ saveRecord: record, isPersisted: true })

  assertWorldViewModel(record, model)
  assertSpaceGrid(record, spaceGrid, model)

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = hashText(afterRaw)
  const afterRecord = parseJson(afterRaw, "Runtime save after core validation smoke is not valid JSON.")

  assert(afterRecord.tick === beforeTick, "Core resource validation changed runtime tick.")
  assert(afterRecord.homeMapState.placements.length === beforePlacementCount, "Core resource validation changed HomeMapState placements.")
  assert(afterHash === beforeHash, "Core resource validation changed runtime save hash.")

  console.log("M11 CORE RESOURCE VALIDATION SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`World: ${record.worldId}`)
  console.log(`Canvas: ${model.canvas.width}x${model.canvas.height}`)
  console.log(`Space cells: ${spaceGrid.cells.length}`)
  console.log(`Space regions: ${spaceGrid.regions.length}`)
  console.log(`Tiles: ${model.tiles.length}`)
  console.log(`World fact objects: ${model.objects.filter((object) => object.source === "world_fact").length}`)
  console.log(`Derived visual-only objects: ${model.objects.filter((object) => object.source === "derived_visual_only").length}`)
  console.log(`Traces: ${model.traces.length}`)
  console.log(`Actors: ${model.actors.length}`)
  console.log("Runtime save read-only: ok")
  console.log("HomeMapState fact source: ok")
  console.log("SpaceCell validation: ok")
  console.log("TraceField projection: ok")
  console.log("WorldViewModel validation: ok")
  console.log("No default pet fact: ok")
  console.log("Debug renderer isolation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

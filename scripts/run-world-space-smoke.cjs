async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = resolveRuntimeSavePath({
    fs,
    latestIndexPath: path.join(
      repoRoot,
      "data",
      "world-runtime",
      "latest-world.json"
    ),
  })
  const spaceBuilderPath = path.join(
    repoRoot,
    "src",
    "world",
    "space",
    "space-grid-builder.ts"
  )
  const runtimeSmokePath = path.join(
    repoRoot,
    "scripts",
    "run-world-runtime-smoke.cjs"
  )

  function fail(message) {
    console.log("WORLD SPACE SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function parseJson(raw, message) {
    try {
      return JSON.parse(raw)
    } catch (error) {
      fail(`${message} ${error.message}`)
    }
  }

  function hash(raw) {
    return crypto.createHash("sha256").update(raw).digest("hex")
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

  function assertNoMovementMotherArchitecture() {
    const source = fs.readFileSync(spaceBuilderPath, "utf8")
    const forbiddenPatterns = [
      "movementChannel",
      "movement_channel",
      "routeGraph",
      "buildRoad",
      "buildRoute",
      "buildMovementChannel",
    ]
    const hits = forbiddenPatterns.filter((pattern) => source.includes(pattern))

    assert(
      hits.length === 0,
      `Space builder contains movement mother architecture tokens: ${hits.join(", ")}`
    )
  }

  function assertReadBoundaryStillPresent() {
    const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

    assert(
      runtimeSmokeSource.includes("World read boundary: ok"),
      "Runtime smoke no longer reports world read-boundary validation."
    )
  }

  if (!savePath || !fs.existsSync(savePath)) {
    fail("Runtime save file not found.")
  }

  installTypeScriptRequireHook()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = hash(beforeRaw)
  const beforeStat = fs.statSync(savePath)
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const homeMapState = record.homeMapState

  assert(homeMapState, "HomeMapState is missing.")
  assert(Array.isArray(homeMapState.zones), "HomeMapState.zones is missing.")
  assert(
    Array.isArray(homeMapState.placements),
    "HomeMapState.placements is missing."
  )

  const { buildSpaceGridFromHomeMapState } = localRequire(spaceBuilderPath)
  const spaceGrid = buildSpaceGridFromHomeMapState({ homeMapState })
  const traceInfluencedSpaceGrid = record.traceField
    ? buildSpaceGridFromHomeMapState({
        homeMapState,
        traceField: record.traceField,
      })
    : null

  assert(Array.isArray(spaceGrid.cells), "SpaceGrid.cells is not an array.")
  assert(spaceGrid.cells.length > 0, "SpaceGrid has no cells.")
  assert(
    spaceGrid.cells.length ===
      homeMapState.mapSize.columns * homeMapState.mapSize.rows,
    "SpaceGrid cell count does not match map size."
  )

  const malformedCell = spaceGrid.cells.find(
    (cell) =>
      !cell.coordinate ||
      typeof cell.coordinate.x !== "number" ||
      typeof cell.coordinate.y !== "number" ||
      typeof cell.regionId !== "string" ||
      cell.regionId.length === 0 ||
      typeof cell.passable !== "boolean" ||
      typeof cell.baseMoveCost !== "number" ||
      typeof cell.movementCost !== "number" ||
      !Array.isArray(cell.movementCostFactors)
  )
  assert(!malformedCell, `Malformed SpaceCell found: ${malformedCell?.id}`)

  const unmarkedFallback = spaceGrid.cells.find(
    (cell) =>
      cell.regionSource === "fallback" && !cell.regionId.startsWith("fallback:")
  )
  assert(
    !unmarkedFallback,
    `Fallback region is not marked: ${unmarkedFallback?.id}`
  )

  const zoneBackedCells = spaceGrid.cells.filter(
    (cell) => cell.regionSource === "home_map_zone"
  )
  assert(zoneBackedCells.length > 0, "No cells were mapped from HomeMapState.zones.")

  const occupiedCells = spaceGrid.cells.filter((cell) => cell.occupancy.length > 0)
  assert(
    occupiedCells.length > 0 || homeMapState.placements.length === 0,
    "Placements exist but no SpaceCell occupancy was produced."
  )

  const blockingCells = spaceGrid.cells.filter(
    (cell) => !cell.passable || cell.movementCost >= 120
  )
  assert(
    blockingCells.length > 0,
    "No blocked, restricted, boundary, or high-cost cells were found."
  )

  const boundaryCells = spaceGrid.cells.filter(
    (cell) => cell.regionKind === "boundary"
  )
  assert(boundaryCells.length > 0, "Boundary cells were not generated.")
  assert(
    boundaryCells.every((cell) => !cell.passable || cell.movementCost >= 120),
    "Boundary cells are neither non-passable nor high-cost."
  )

  assert(
    spaceGrid.cells.every((cell) =>
      cell.movementCostFactors.some((factor) => factor.source === "terrain")
    ),
    "Movement cost is missing terrain factor."
  )
  assertNoMovementMotherArchitecture()
  assertReadBoundaryStillPresent()

  if (traceInfluencedSpaceGrid) {
    assert(
      traceInfluencedSpaceGrid.cells.length === spaceGrid.cells.length,
      "Trace-influenced SpaceGrid changed the cell count."
    )
    assert(
      traceInfluencedSpaceGrid.traceInfluenceSummary,
      "Trace-influenced SpaceGrid is missing traceInfluenceSummary."
    )
    assert(
      traceInfluencedSpaceGrid.cells.every(
        (cell) =>
          cell.passability !== "blocked" ||
          cell.passable === false ||
          cell.movementCost >= 999
      ),
      "Trace influence made a blocked cell passable."
    )
  }

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterStat = fs.statSync(savePath)
  const afterRecord = parseJson(
    afterRaw,
    "Runtime save became invalid during SpaceGrid build."
  )

  assert(
    afterRecord.tick === record.tick,
    `SpaceGrid build changed tick from ${record.tick} to ${afterRecord.tick}.`
  )
  assert(
    hash(afterRaw) === beforeHash && afterStat.mtimeMs === beforeStat.mtimeMs,
    "SpaceGrid build wrote to the runtime save file."
  )

  const fallbackCells =
    spaceGrid.cells.length - zoneBackedCells.length - boundaryCells.length

  console.log("WORLD SPACE SMOKE")
  console.log(`World id: ${spaceGrid.worldId}`)
  console.log(`Cells: ${spaceGrid.cells.length}`)
  console.log(`Regions: ${spaceGrid.regions.length}`)
  console.log(`Zone-backed cells: ${zoneBackedCells.length}`)
  console.log(`Fallback cells: ${fallbackCells}`)
  console.log(`Occupied cells: ${occupiedCells.length}`)
  console.log(`Boundary cells: ${boundaryCells.length}`)
  console.log(
    `Trace-influenced cells: ${
      traceInfluencedSpaceGrid?.summary.traceInfluencedCells ?? 0
    }`
  )
  console.log(`Current tick: ${record.tick}`)
  console.log("Read-only build: ok")
  console.log("Movement cost audit factors: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

function resolveRuntimeSavePath(input) {
  if (!input.fs.existsSync(input.latestIndexPath)) return null

  try {
    const index = JSON.parse(input.fs.readFileSync(input.latestIndexPath, "utf8"))

    return typeof index.path === "string" ? index.path : null
  } catch {
    return null
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

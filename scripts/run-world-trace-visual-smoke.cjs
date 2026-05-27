async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(
    repoRoot,
    ".runtime",
    "world-state",
    "default-world.json"
  )
  const traceProjectionPath = path.join(
    repoRoot,
    "src",
    "world",
    "trace",
    "trace-visual-projection.ts"
  )
  const traceSceneAdapterPath = path.join(
    repoRoot,
    "src",
    "world",
    "trace",
    "trace-scene-adapter.ts"
  )
  const formalVisualGatewayPath = path.join(
    repoRoot,
    "src",
    "world",
    "formal-visual-model",
    "formal-visual-model-gateway.ts"
  )
  const worldLoopGatewayPath = path.join(
    repoRoot,
    "src",
    "world",
    "world-loop",
    "world-loop-gateway.ts"
  )
  const runtimeSmokePath = path.join(
    repoRoot,
    "scripts",
    "run-world-runtime-smoke.cjs"
  )

  function fail(message) {
    console.log("WORLD TRACE VISUAL SMOKE")
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

  function assertNoForbiddenCalls() {
    const combinedSource = [
      fs.readFileSync(traceProjectionPath, "utf8"),
      fs.readFileSync(traceSceneAdapterPath, "utf8"),
    ].join("\n")
    const forbiddenPatterns = [
      "writeWorldRuntimeSaveRecord",
      "runAndPersistOneRuntimeTick",
      "runTraceLifecycleTick",
      "movementChannel",
      "movement_channel",
      "roadGraph",
      "pathGraph",
      "buildRoad",
      "buildRoute",
    ]
    const hits = forbiddenPatterns.filter((pattern) =>
      combinedSource.includes(pattern)
    )

    assert(
      hits.length === 0,
      `Trace visual projection source contains forbidden tokens: ${hits.join(", ")}`
    )
  }

  function assertReadBoundaryStillPresent() {
    const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

    assert(
      runtimeSmokeSource.includes("World read boundary: ok"),
      "Runtime smoke no longer reports world read-boundary validation."
    )
  }

  if (!fs.existsSync(savePath)) {
    fail("Runtime save file not found.")
  }

  installTypeScriptRequireHook()
  assertNoForbiddenCalls()
  assertReadBoundaryStillPresent()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const beforeRecord = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const beforeTick = beforeRecord.tick
  const { buildTraceVisualProjectionFromTraceField } =
    localRequire(traceProjectionPath)
  const { buildFormalVisualModelFromSnapshot } = localRequire(
    formalVisualGatewayPath
  )
  const { buildWorldLoopRenderableState } = localRequire(worldLoopGatewayPath)
  const projection = buildTraceVisualProjectionFromTraceField({
    traceField: beforeRecord.traceField,
  })

  assert(Array.isArray(projection.items), "Projection items is not an array.")
  assert(projection.summary, "Projection summary is missing.")
  assert(
    projection.summary.totalItems === projection.items.length,
    "Projection summary.totalItems does not match items length."
  )

  const malformedItem = projection.items.find(
    (item) =>
      typeof item.traceId !== "string" ||
      typeof item.visualKind !== "string" ||
      typeof item.intensity !== "number" ||
      !item.area ||
      !Array.isArray(item.cellIds) ||
      typeof item.productSafeDescription !== "string"
  )
  assert(!malformedItem, `Malformed projection item: ${malformedItem?.id}`)

  assert(
    projection.items.every((item) => item.visualKind !== "none" || !item.visible),
    "visualKind=none item is marked visible."
  )

  const renderableState = buildWorldLoopRenderableState({
    homeMapState: beforeRecord.homeMapState,
    now: beforeRecord.homeMapState.updatedAt,
  })
  const formalVisualModel = buildFormalVisualModelFromSnapshot(
    renderableState.renderableWorldSnapshot,
    {
      traceVisualProjection: projection,
    }
  )

  assert(
    formalVisualModel.traceVisualProjection,
    "FormalVisualModel did not carry traceVisualProjection."
  )
  assert(
    formalVisualModel.auditTags.includes("trace_visual_projection_attached"),
    "FormalVisualModel auditTags do not mention trace projection."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(
    afterRaw,
    "Runtime save after projection build is not valid JSON."
  )

  assert(afterRecord.tick === beforeTick, "Projection build changed runtime tick.")
  assert(afterHash === beforeHash, "Projection build changed runtime save hash.")

  console.log("WORLD TRACE VISUAL SMOKE")
  console.log(`World id: ${projection.worldId}`)
  console.log(`Runtime tick: ${beforeTick}`)
  console.log(`Projection items: ${projection.items.length}`)
  console.log(`Visible items: ${projection.summary.visibleItems}`)
  console.log(`Average intensity: ${projection.summary.averageIntensity}`)
  console.log("TraceVisualProjection shape: ok")
  console.log("FormalVisualModel projection attach: ok")
  console.log("Projection read-only: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

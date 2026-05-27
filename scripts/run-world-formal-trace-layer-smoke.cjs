async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const packageJsonPath = path.join(repoRoot, "package.json")
  const savePath = path.join(
    repoRoot,
    ".runtime",
    "world-state",
    "default-world.json"
  )
  const formalWorldViewPath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "formal-world-view",
    "formal-world-view.tsx"
  )
  const formalWorldViewStylesPath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "formal-world-view",
    "formal-world-view.styles.module.css"
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
  const formalTraceSurfaceSmokePath = path.join(
    repoRoot,
    "scripts",
    "run-world-formal-trace-surface-smoke.cjs"
  )

  function fail(message) {
    console.log("FORMAL TRACE LAYER SMOKE")
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

  function assertSourceBoundary() {
    const packageJson = parseJson(
      fs.readFileSync(packageJsonPath, "utf8"),
      "package.json is not valid JSON."
    )
    const componentSource = fs.readFileSync(formalWorldViewPath, "utf8")
    const stylesSource = fs.readFileSync(formalWorldViewStylesPath, "utf8")
    const forbiddenComponentTokens = [
      "traceField.traces",
      "runAndPersistOneRuntimeTick",
      "writeWorldRuntimeSaveRecord",
      "runTraceLifecycleTick",
      "JSON.stringify",
      "sourceReliability",
      "evidenceLevel",
      "movementCostDelta",
      "auditTags",
      "rawTrace",
    ]
    const forbiddenHits = forbiddenComponentTokens.filter((token) =>
      componentSource.includes(token)
    )

    assert(
      packageJson.scripts?.["smoke:formal-trace-layer"] ===
        "node scripts/run-world-formal-trace-layer-smoke.cjs",
      "package.json does not contain smoke:formal-trace-layer."
    )
    assert(
      componentSource.includes("renderFormalTraceLayer"),
      "FormalWorldView does not define renderFormalTraceLayer."
    )
    assert(
      componentSource.includes("model.traceVisualProjection"),
      "FormalWorldView does not read model.traceVisualProjection."
    )
    assert(
      forbiddenHits.length === 0,
      `FormalWorldView contains forbidden trace layer tokens: ${forbiddenHits.join(", ")}`
    )
    assert(
      stylesSource.includes("formalTraceLayer") &&
        stylesSource.includes("formalTraceItem"),
      "FormalWorldView styles do not contain trace layer classes."
    )
  }

  function assertReadBoundaryStillPresent() {
    const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")
    const formalTraceSurfaceSmokeSource = fs.readFileSync(
      formalTraceSurfaceSmokePath,
      "utf8"
    )

    assert(
      runtimeSmokeSource.includes("World read boundary: ok"),
      "Runtime smoke no longer reports world read-boundary validation."
    )
    assert(
      formalTraceSurfaceSmokeSource.includes("FORMAL TRACE SURFACE SMOKE"),
      "Formal trace surface smoke is missing."
    )
  }

  if (!fs.existsSync(savePath)) {
    fail("Runtime save file not found.")
  }

  installTypeScriptRequireHook()
  assertSourceBoundary()
  assertReadBoundaryStillPresent()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const beforeRecord = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const { buildFormalVisualModelFromSnapshot } = localRequire(
    formalVisualGatewayPath
  )
  const { buildWorldLoopRenderableState } = localRequire(worldLoopGatewayPath)
  const renderableState = buildWorldLoopRenderableState({
    homeMapState: beforeRecord.homeMapState,
    now: beforeRecord.homeMapState.updatedAt,
  })
  const formalVisualModel = buildFormalVisualModelFromSnapshot(
    renderableState.renderableWorldSnapshot,
    {
      traceField: beforeRecord.traceField,
    }
  )
  const projection = formalVisualModel.traceVisualProjection

  assert(projection, "FormalVisualModel has no traceVisualProjection.")
  assert(Array.isArray(projection.items), "Trace visual projection items invalid.")
  assert(projection.summary, "Trace visual projection summary is missing.")

  const visibleLayerItems = projection.items
    .filter((item) => item.visible)
    .slice(0, 16)
  const malformedLayerItem = visibleLayerItems.find(
    (item) =>
      typeof item.visualKind !== "string" ||
      typeof item.opacityHint !== "number" ||
      typeof item.productSafeDescription !== "string" ||
      !item.area ||
      typeof item.area.x !== "number" ||
      typeof item.area.y !== "number" ||
      typeof item.area.radius !== "number"
  )

  assert(
    !malformedLayerItem,
    `Malformed formal trace layer item: ${malformedLayerItem?.id}`
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(
    afterRaw,
    "Runtime save after formal trace layer build is not valid JSON."
  )

  assert(
    afterRecord.tick === beforeRecord.tick,
    "Formal trace layer build changed runtime tick."
  )
  assert(afterHash === beforeHash, "Formal trace layer build changed runtime hash.")

  console.log("FORMAL TRACE LAYER SMOKE")
  console.log(`Runtime tick: ${beforeRecord.tick}`)
  console.log(`Projection items: ${projection.items.length}`)
  console.log(`Visible layer items: ${visibleLayerItems.length}`)
  console.log("FormalWorldView trace layer source: ok")
  console.log("Trace layer read-only: ok")
  console.log("World read boundary: ok")
  console.log("Formal trace surface smoke presence: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

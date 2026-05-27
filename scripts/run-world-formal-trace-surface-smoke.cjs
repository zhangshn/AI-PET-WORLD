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
  const worldPagePath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "world-live-runtime-page.tsx"
  )
  const traceSurfaceComponentPath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "formal-trace-surface-summary.tsx"
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
    console.log("FORMAL TRACE SURFACE SMOKE")
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

  function assertPageReadBoundary() {
    const pageSource = fs.readFileSync(worldPagePath, "utf8")
    const componentSource = fs.readFileSync(traceSurfaceComponentPath, "utf8")
    const combinedSurfaceSource = `${pageSource}\n${componentSource}`
    const forbiddenPageTokens = [
      "runAndPersistOneRuntimeTick",
      "writeWorldRuntimeSaveRecord",
      "runTraceLifecycleTick",
      "buildTraceVisualProjectionFromTraceField",
      "traceField.traces",
      "TraceFact",
      "JSON.stringify",
    ]
    const forbiddenDisplayTokens = [
      "traceId",
      "sourceReliability",
      "evidenceLevel",
      "movementCostDelta",
      "auditTags",
      "rawTrace",
      "debug",
    ]
    const forbiddenPageHits = forbiddenPageTokens.filter((token) =>
      combinedSurfaceSource.includes(token)
    )
    const forbiddenDisplayHits = forbiddenDisplayTokens.filter((token) =>
      combinedSurfaceSource.includes(token)
    )

    assert(
      pageSource.includes("readWorldRuntimeForView"),
      "/world page does not use readWorldRuntimeForView."
    )
    assert(
      pageSource.includes("traceField: saveRecord.traceField"),
      "/world page does not pass traceField through the formal visual builder."
    )
    assert(
      componentSource.includes("formalVisualModel.traceVisualProjection"),
      "Trace surface component does not read formalVisualModel.traceVisualProjection."
    )
    assert(
      forbiddenPageHits.length === 0,
      `/world trace surface contains forbidden page tokens: ${forbiddenPageHits.join(", ")}`
    )
    assert(
      forbiddenDisplayHits.length === 0,
      `/world trace surface contains raw/debug display tokens: ${forbiddenDisplayHits.join(", ")}`
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
  assertPageReadBoundary()
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
  assert(projection.summary, "Trace visual projection summary is missing.")
  assert(
    typeof projection.summary.visibleItems === "number",
    "Trace visual projection visibleItems is invalid."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(
    afterRaw,
    "Runtime save after surface summary build is not valid JSON."
  )

  assert(
    afterRecord.tick === beforeRecord.tick,
    "Formal trace surface build changed runtime tick."
  )
  assert(afterHash === beforeHash, "Formal trace surface build changed runtime hash.")

  console.log("FORMAL TRACE SURFACE SMOKE")
  console.log(`Runtime tick: ${beforeRecord.tick}`)
  console.log(`Visible trace signs: ${projection.summary.visibleItems}`)
  console.log(`Average intensity: ${projection.summary.averageIntensity}`)
  console.log("Page read boundary: ok")
  console.log("Formal trace surface summary: ok")
  console.log("No raw trace display tokens: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

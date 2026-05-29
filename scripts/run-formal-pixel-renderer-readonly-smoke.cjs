async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")

  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const viewModelGatewayPath = path.join(repoRoot, "src", "world", "world-view-model", "world-view-model-gateway.ts")
  const formalRendererGatewayPath = path.join(repoRoot, "src", "world", "formal-pixel-renderer", "formal-pixel-renderer-gateway.ts")

  function fail(message) {
    console.log("FORMAL PIXEL RENDERER READONLY SMOKE")
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

  function readRequiredFile(filePath, label) {
    if (!fs.existsSync(filePath)) fail(`${label} is missing.`)
    return fs.readFileSync(filePath, "utf8")
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

  installTypeScriptRequireHook()

  const beforeRaw = readRequiredFile(savePath, "Runtime save before formal renderer")
  const beforeHash = hashText(beforeRaw)
  const beforeRecord = parseJson(beforeRaw, "Runtime save before formal renderer is not valid JSON.")
  const beforeTick = beforeRecord.tick
  const beforePlacementCount = beforeRecord.homeMapState.placements.length
  const beforeTraceCount = beforeRecord.traceField.traces.length

  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const { buildFormalPixelRenderModel } = localRequire(formalRendererGatewayPath)
  const worldViewModel = buildWorldViewModelForPixelWorld({
    saveRecord: beforeRecord,
    isPersisted: true,
  })
  const renderModel = buildFormalPixelRenderModel(worldViewModel)

  assert(renderModel.audit.readOnly === true, "Render model audit is not read-only.")
  assert(renderModel.audit.runtimeWrite === false, "Render model audit says runtime write happened.")
  assert(renderModel.audit.worldFactWrite === false, "Render model audit says world fact write happened.")
  assert(renderModel.audit.tickAdvance === false, "Render model audit says tick advanced.")

  const afterRaw = readRequiredFile(savePath, "Runtime save after formal renderer")
  const afterHash = hashText(afterRaw)
  const afterRecord = parseJson(afterRaw, "Runtime save after formal renderer is not valid JSON.")

  assert(afterRecord.tick === beforeTick, "Formal renderer changed runtime tick.")
  assert(afterRecord.homeMapState.placements.length === beforePlacementCount, "Formal renderer changed HomeMapState placements.")
  assert(afterRecord.traceField.traces.length === beforeTraceCount, "Formal renderer changed TraceField traces.")
  assert(afterHash === beforeHash, "Formal renderer changed runtime save hash.")

  console.log("FORMAL PIXEL RENDERER READONLY SMOKE")
  console.log(`Runtime tick: ${beforeTick}`)
  console.log(`Runtime placements: ${beforePlacementCount}`)
  console.log(`Runtime traces: ${beforeTraceCount}`)
  console.log(`Render tiles: ${renderModel.layers.tiles.items.length}`)
  console.log(`Render objects: ${renderModel.layers.objects.items.length}`)
  console.log("Runtime hash unchanged: ok")
  console.log("Runtime tick unchanged: ok")
  console.log("HomeMapState unchanged: ok")
  console.log("TraceField unchanged: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

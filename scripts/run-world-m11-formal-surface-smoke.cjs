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
  const pixelViewPath = path.join(repoRoot, "src", "app", "world", "components", "pixel-world-view", "pixel-world-view.tsx")
  const pixelViewCssPath = path.join(repoRoot, "src", "app", "world", "components", "pixel-world-view", "pixel-world-view.module.css")
  const createWorldPath = path.join(repoRoot, "src", "app", "create-world", "create-world-route-page.tsx")
  const worldPagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")

  function fail(message) {
    console.log("M11 FORMAL WORLD SURFACE SMOKE")
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

  function assertStaticSurfaceContract() {
    const pixelViewSource = fs.readFileSync(pixelViewPath, "utf8")
    const pixelViewCss = fs.readFileSync(pixelViewCssPath, "utf8")
    const createWorldSource = fs.readFileSync(createWorldPath, "utf8")
    const worldPageSource = fs.readFileSync(worldPagePath, "utf8")
    const combinedSource = [pixelViewSource, pixelViewCss, createWorldSource, worldPageSource].join("\n")

    const requiredTokens = [
      "PixelWorldView",
      "data-surface-state=\"cleared\"",
      "readWorldRuntimeForView",
      "buildWorldViewModelForPixelWorld",
      "router.push(\"/world\")",
      "宠物不会默认出现",
    ]

    requiredTokens.forEach((token) =>
      assert(combinedSource.includes(token), `M11 cleared formal surface is missing required token: ${token}.`)
    )

    const forbiddenSurfaceTokens = [
      "PixelWorldCanvas",
      "pixelWorldStageFrame",
      "worldStatusCard",
      "worldSurfaceNotes",
      "butlerExplanation",
      "pPhoneEntry",
      "当前记录",
      "管家说明",
      "P-Phone",
      "你的自主像素家园正在运行",
      "buildSceneSvg",
      "scene-composer-gateway",
      "WorldPainterReadonlyPreview",
      "FormalWorldView",
      "ProceduralRendererView",
      "pet_default",
      "createPet",
      "roadGraph",
      "pathGraph",
    ]
    const forbiddenHits = forbiddenSurfaceTokens.filter((token) =>
      [pixelViewSource, pixelViewCss].join("\n").includes(token)
    )

    assert(
      forbiddenHits.length === 0,
      `M11 cleared /world surface still contains removed card/canvas/debug tokens: ${forbiddenHits.join(", ")}`
    )
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")
  if (!fs.existsSync(pixelViewPath)) fail("PixelWorldView is missing.")
  if (!fs.existsSync(pixelViewCssPath)) fail("PixelWorldView CSS is missing.")
  if (!fs.existsSync(createWorldPath)) fail("create-world route page is missing.")
  if (!fs.existsSync(worldPagePath)) fail("world live runtime page is missing.")

  installTypeScriptRequireHook()
  assertStaticSurfaceContract()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({ saveRecord: record, isPersisted: true })

  assert(model.tags.includes("runtime_read_only_projection"), "WorldViewModel is missing read-only projection tag.")
  assert(model.tags.includes("pixel_world_primary"), "WorldViewModel is missing pixel primary tag.")
  assert(!model.actors.some((actor) => actor.kind === "pet" && actor.visible), "Formal cleared surface generated a default pet actor.")

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after M11 surface smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "M11 formal surface smoke changed runtime tick.")
  assert(afterHash === beforeHash, "M11 formal surface smoke changed runtime save hash.")

  console.log("M11 FORMAL WORLD SURFACE SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log("/world homepage cleared: ok")
  console.log("Removed canvas/cards from formal homepage: ok")
  console.log("Create-world to /world path still present: ok")
  console.log("No default pet fact: ok")
  console.log("Read-only formal surface: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

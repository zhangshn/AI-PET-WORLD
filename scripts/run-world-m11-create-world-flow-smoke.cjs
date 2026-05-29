async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const runtimeGatewayPath = path.join(repoRoot, "src", "world", "runtime", "world-runtime-gateway.ts")
  const createWorldPagePath = path.join(repoRoot, "src", "app", "create-world", "create-world-route-page.tsx")
  const createWorldApiPath = path.join(repoRoot, "src", "app", "api", "world", "create", "route.ts")
  const worldPagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const viewModelGatewayPath = path.join(repoRoot, "src", "world", "world-view-model", "world-view-model-gateway.ts")
  let shouldRestoreRuntimeSave = false
  let hadRuntimeSaveBeforeSmoke = false
  let runtimeSaveBeforeSmoke = ""

  function restoreRuntimeSave() {
    if (!shouldRestoreRuntimeSave) return

    if (hadRuntimeSaveBeforeSmoke) {
      fs.writeFileSync(savePath, runtimeSaveBeforeSmoke, "utf8")
      return
    }

    if (fs.existsSync(savePath)) {
      fs.unlinkSync(savePath)
    }
  }

  function fail(message) {
    restoreRuntimeSave()
    console.log("M11 CREATE-WORLD FLOW SMOKE")
    console.log(message)
    console.log("Runtime save restored after smoke: ok")
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

  function extractUserFacingStringLiterals(source) {
    const matches = source.matchAll(/(?<![A-Za-z0-9_$])(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)/g)

    return Array.from(matches)
      .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
      .filter((value) => /[\u4e00-\u9fa5]/.test(value))
      .join("\n")
  }

  function assertStaticFlowContract() {
    const createWorldSource = fs.readFileSync(createWorldPagePath, "utf8")
    const apiSource = fs.readFileSync(createWorldApiPath, "utf8")
    const gatewaySource = fs.readFileSync(runtimeGatewayPath, "utf8")
    const worldPageSource = fs.readFileSync(worldPagePath, "utf8")
    const combinedSource = [createWorldSource, apiSource, gatewaySource, worldPageSource].join("\n")

    const requiredTokens = [
      "fetch(\"/api/world/create\"",
      "router.push(\"/world\")",
      "createRuntimeWorldFromCreateWorldInput",
      "buildRuntimeSaveRecordFromCreateWorldInput",
      "writeWorldRuntimeSaveRecord",
      "m11_create_world_to_world_path",
      "created_from_create_world_input",
      "no_default_pet_fact",
      "readWorldRuntimeForView",
      "宠物不会默认出现",
      "你不是直接操控者，而是这个世界的源头",
    ]

    requiredTokens.forEach((token) =>
      assert(combinedSource.includes(token), `M11 create-world flow is missing required token: ${token}.`)
    )

    const userFacingText = extractUserFacingStringLiterals(createWorldSource)
    const forbiddenUserFacingTokens = [
      "TraceField",
      "AuditSummary",
      "ButlerRuntimeAuditSummary",
      "WorldViewModel",
      "SafeApply",
      "debugScore",
      "rawScore",
      "finalScore",
      "riskPenalty",
      "JSON.stringify",
      "runtime save",
      "HomeMapState",
      "MapDiff",
    ]
    const forbiddenUserFacingHits = forbiddenUserFacingTokens.filter((token) =>
      userFacingText.includes(token)
    )

    assert(
      forbiddenUserFacingHits.length === 0,
      `Create-world user-facing copy exposes backend/debug tokens: ${forbiddenUserFacingHits.join(", ")}`
    )

    const forbiddenSourceTokens = [
      "createPet",
      "pet_default",
      "buildSceneSvg",
      "scene-composer-gateway",
      "WorldPainterReadonlyPreview",
      "roadGraph",
      "pathGraph",
    ]
    const forbiddenSourceHits = forbiddenSourceTokens.filter((token) => combinedSource.includes(token))

    assert(
      forbiddenSourceHits.length === 0,
      `M11 create-world formal path contains forbidden source tokens: ${forbiddenSourceHits.join(", ")}`
    )
  }

  function assertNoDefaultPet(record) {
    const petPlacements = record.homeMapState.placements.filter(
      (placement) =>
        placement.layer === "actor" &&
        (placement.tags.includes("pet") ||
          placement.id.toLowerCase().includes("pet") ||
          placement.label.toLowerCase().includes("pet") ||
          placement.label.includes("宠物"))
    )

    assert(petPlacements.length === 0, "Create-world flow generated a default pet actor placement.")
  }

  if (!fs.existsSync(runtimeGatewayPath)) fail("Runtime gateway is missing.")
  if (!fs.existsSync(createWorldPagePath)) fail("create-world page is missing.")
  if (!fs.existsSync(createWorldApiPath)) fail("create-world API route is missing.")
  if (!fs.existsSync(worldPagePath)) fail("world live runtime page is missing.")
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")

  installTypeScriptRequireHook()
  assertStaticFlowContract()

  hadRuntimeSaveBeforeSmoke = fs.existsSync(savePath)
  runtimeSaveBeforeSmoke = hadRuntimeSaveBeforeSmoke ? fs.readFileSync(savePath, "utf8") : ""
  shouldRestoreRuntimeSave = true

  const beforeRaw = runtimeSaveBeforeSmoke
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const beforeRecord = beforeRaw ? parseJson(beforeRaw, "Existing runtime save is not valid JSON.") : null

  const { createRuntimeWorldFromCreateWorldInput, readWorldRuntimeForView } = localRequire(runtimeGatewayPath)
  const result = await createRuntimeWorldFromCreateWorldInput({
    createWorldInput: {
      year: 1998,
      month: 1,
      day: 1,
      time: "08:00",
      perspective: "unspecified",
      createdAt: 1998011080,
    },
  })

  assert(result.persisted, "Create-world runtime result was not persisted.")
  assert(result.tags.includes("m11_create_world_to_world_path"), "Create-world runtime result is missing M11 tag.")
  assert(result.saveRecord.tags.includes("created_from_create_world_input"), "Created save record is missing creation source tag.")
  assert(result.saveRecord.tags.includes("no_default_pet_fact"), "Created save record is missing no default pet guard tag.")
  assert(result.saveRecord.tick === 0, "Created world should start at tick 0.")
  assert(result.saveRecord.worldId !== "default-world", "Created world still uses default-world id.")
  assertNoDefaultPet(result.saveRecord)

  const viewResult = await readWorldRuntimeForView()
  assert(viewResult.isPersisted, "World view did not read persisted created world.")
  assert(viewResult.saveRecord.worldId === result.saveRecord.worldId, "World view did not read the created world id.")
  assert(viewResult.saveRecord.ownerId === result.saveRecord.ownerId, "World view did not read the created owner id.")

  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({
    saveRecord: viewResult.saveRecord,
    isPersisted: true,
  })

  assert(model.tags.includes("runtime_read_only_projection"), "Created world view model is missing read-only tag.")
  assert(model.actors.some((actor) => actor.kind === "butler" && actor.visible), "Created world view has no visible butler actor.")
  assert(!model.actors.some((actor) => actor.kind === "pet" && actor.visible), "Created world view generated a default pet actor.")

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after create-world flow smoke is not valid JSON.")

  assert(afterRecord.worldId === result.saveRecord.worldId, "Saved world id does not match create result.")
  assert(afterRecord.tick === 0, "Create-world flow should not advance runtime tick.")
  assert(afterHash !== beforeHash || beforeRecord?.worldId === afterRecord.worldId, "Create-world flow did not update runtime save.")

  restoreRuntimeSave()
  shouldRestoreRuntimeSave = false

  console.log("M11 CREATE-WORLD FLOW SMOKE")
  console.log(`Created world: ${result.saveRecord.worldId}`)
  console.log(`Owner: ${result.saveRecord.ownerId}`)
  console.log(`Tick: ${result.saveRecord.tick}`)
  console.log(`Canvas: ${model.canvas.width}x${model.canvas.height}`)
  console.log("Create-world API writes runtime save: ok")
  console.log("/world reads created runtime save: ok")
  console.log("No default pet fact: ok")
  console.log("No user-facing backend/debug copy: ok")
  console.log("Runtime save restored after smoke: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

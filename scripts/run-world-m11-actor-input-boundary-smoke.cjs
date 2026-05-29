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
  const actorMapperPath = path.join(repoRoot, "src", "world", "world-view-model", "world-actor-mapper.ts")

  function fail(message) {
    console.log("M11 ACTOR INPUT BOUNDARY SMOKE")
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

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value))
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

  function assertStaticActorBoundaryContract() {
    const actorMapperSource = fs.readFileSync(actorMapperPath, "utf8")
    const requiredTokens = [
      "FORMAL_PET_ENTRY_TAGS",
      "formal_life_entry_validated",
      "pet_world_entry_validated",
      "actor_input_boundary_validated",
      "hasFormalPetEntryTag",
    ]

    requiredTokens.forEach((token) =>
      assert(actorMapperSource.includes(token), `Actor mapper is missing required boundary token: ${token}.`)
    )
  }

  function buildUnvalidatedPetPlacement(record) {
    const tileSize = record.homeMapState.mapSize.tileSize

    return {
      id: "legacy_pet_actor_probe",
      assetId: "actor_placeholder_butler",
      x: tileSize * 3,
      y: tileSize * 3,
      layer: "actor",
      scale: 1,
      alpha: 1,
      label: "宠物测试残留",
      source: "placement_engine",
      tags: [
        "pet",
        "legacy_probe",
        "must_not_render_without_formal_entry",
      ],
    }
  }

  function buildValidatedPetPlacement(record) {
    const placement = buildUnvalidatedPetPlacement(record)

    return {
      ...placement,
      id: "validated_pet_actor_probe",
      label: "宠物正式入场测试",
      tags: [
        "pet",
        "formal_life_entry_validated",
        "pet_world_entry_validated",
        "actor_input_boundary_validated",
      ],
    }
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")
  if (!fs.existsSync(actorMapperPath)) fail("World actor mapper is missing.")

  assertStaticActorBoundaryContract()
  installTypeScriptRequireHook()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = hashText(beforeRaw)
  const record = parseJson(beforeRaw, "Runtime save is not valid JSON.")
  const beforeTick = record.tick
  const beforePlacementCount = record.homeMapState.placements.length

  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const currentModel = buildWorldViewModelForPixelWorld({
    saveRecord: record,
    isPersisted: true,
  })
  const currentButlers = currentModel.actors.filter((actor) => actor.kind === "butler" && actor.visible)
  const currentPets = currentModel.actors.filter((actor) => actor.kind === "pet" && actor.visible)

  assert(currentButlers.length === 1, `Expected exactly one visible butler actor, got ${currentButlers.length}.`)
  assert(currentPets.length === 0, `Current runtime already has visible pet actors: ${currentPets.length}.`)
  assert(currentButlers[0].x >= 0 && currentButlers[0].x <= currentModel.canvas.width, "Butler actor x is outside canvas.")
  assert(currentButlers[0].y >= 0 && currentButlers[0].y <= currentModel.canvas.height, "Butler actor y is outside canvas.")

  const unvalidatedProbeRecord = cloneJson(record)
  unvalidatedProbeRecord.homeMapState.placements.push(buildUnvalidatedPetPlacement(record))
  const unvalidatedProbeModel = buildWorldViewModelForPixelWorld({
    saveRecord: unvalidatedProbeRecord,
    isPersisted: true,
  })
  const unvalidatedPetActors = unvalidatedProbeModel.actors.filter((actor) => actor.kind === "pet" && actor.visible)

  assert(
    unvalidatedPetActors.length === 0,
    "Unvalidated legacy pet placement leaked into WorldViewModel actors."
  )

  const validatedProbeRecord = cloneJson(record)
  validatedProbeRecord.homeMapState.placements.push(buildValidatedPetPlacement(record))
  const validatedProbeModel = buildWorldViewModelForPixelWorld({
    saveRecord: validatedProbeRecord,
    isPersisted: true,
  })
  const validatedPetActors = validatedProbeModel.actors.filter((actor) => actor.kind === "pet" && actor.visible)

  assert(
    validatedPetActors.length === 1,
    `Validated pet placement should map to exactly one pet actor, got ${validatedPetActors.length}.`
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = hashText(afterRaw)
  const afterRecord = parseJson(afterRaw, "Runtime save after actor input boundary smoke is not valid JSON.")

  assert(afterRecord.tick === beforeTick, "Actor input boundary smoke changed runtime tick.")
  assert(afterRecord.homeMapState.placements.length === beforePlacementCount, "Actor input boundary smoke changed HomeMapState placements.")
  assert(afterHash === beforeHash, "Actor input boundary smoke changed runtime save hash.")

  console.log("M11 ACTOR INPUT BOUNDARY SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Actors: ${currentModel.actors.length}`)
  console.log(`Visible butlers: ${currentButlers.length}`)
  console.log(`Visible pets: ${currentPets.length}`)
  console.log("Unvalidated pet placement blocked: ok")
  console.log("Validated future pet entry accepted by boundary: ok")
  console.log("Actor projection read-only: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

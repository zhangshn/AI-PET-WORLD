async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const latestIndexPath = path.join(
    repoRoot,
    "data",
    "world-runtime",
    "latest-world.json"
  )
  const savePath = resolveRuntimeSavePath({ fs, latestIndexPath })
  const gatewayPath = path.join(
    repoRoot,
    "src",
    "world",
    "world-view-model",
    "world-view-model-gateway.ts"
  )
  const storyMapperPath = path.join(
    repoRoot,
    "src",
    "world",
    "world-view-model",
    "world-story-composition-mapper.ts"
  )

  function fail(message) {
    console.log("WORLD VIEW MODEL SMOKE")
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

  function assertStoryMapperBoundary() {
    const source = fs.readFileSync(storyMapperPath, "utf8")
    const requiredTokens = [
      "buildWorldStoryCompositionTraces",
      "world_view_story_staging_trace",
      "isWorldStoryAnchorObject",
      "sourceObjectId",
    ]
    const forbiddenTokens = [
      "writeWorldRuntimeSaveRecord",
      "runAndPersistOneRuntimeTick",
      "createRuntimeWorldFromCreateWorldInput",
      "placements.push",
      "homeMapState.placements",
      "mapDiffs.push",
      "nextHomeMapState",
    ]

    requiredTokens.forEach((token) => {
      assert(source.includes(token), `Story composition mapper is missing token: ${token}`)
    })

    const forbiddenHits = forbiddenTokens.filter((token) => source.includes(token))
    assert(
      forbiddenHits.length === 0,
      `Story composition mapper contains runtime/fact mutation token(s): ${forbiddenHits.join(", ")}`
    )
  }

  if (!savePath || !fs.existsSync(savePath)) {
    fail("Runtime save file not found.")
  }

  installTypeScriptRequireHook()
  assertStoryMapperBoundary()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = hash(beforeRaw)
  const beforeStat = fs.statSync(savePath)
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const beforePlacementIds = new Set(
    (record.homeMapState?.placements ?? []).map((placement) => placement.id)
  )

  const { buildWorldViewModelForPixelWorld } = localRequire(gatewayPath)
  const model = buildWorldViewModelForPixelWorld({
    saveRecord: record,
    isPersisted: true,
  })
  const objectIds = new Set(model.objects.map((object) => object.id))
  const storyTraces = model.traces.filter((trace) =>
    trace.id.startsWith("world_view_story_staging_trace_")
  )
  const storyAnchorObjects = model.objects.filter(
    (object) =>
      object.source === "world_fact" &&
      (object.kind === "facility" || object.kind === "structure") &&
      object.tags.some(
        (tag) =>
          tag === "butler_construction_result" ||
          tag === "construction_plan_add_diff" ||
          tag.startsWith("construction_stage:") ||
          tag.startsWith("construction_project:") ||
          tag.includes("care_station") ||
          tag.includes("under_construction") ||
          tag.includes("event")
      )
  )

  if (storyAnchorObjects.length > 0) {
    assert(storyTraces.length > 0, "Story anchor exists but no story staging traces were generated.")
  }
  const storyRoles = new Set(
    storyTraces
      .flatMap((trace) => trace.tags ?? [])
      .filter((tag) => tag.startsWith("story_trace_role:"))
      .map((tag) => tag.slice("story_trace_role:".length))
  )

  if (storyAnchorObjects.length > 0) {
    ;["foundation_pad", "worked_ground", "staging_edge", "access_path"].forEach((role) => {
      assert(storyRoles.has(role), `Story staging traces missing role: ${role}`)
    })
  }

  storyTraces.forEach((trace) => {
    const sourceObjectId = trace.sourceId
    const tags = trace.tags ?? []

    assert(sourceObjectId, `Story trace does not encode a source object id: ${trace.id}`)
    assert(
      objectIds.has(sourceObjectId),
      `Story trace source object is not present in WorldViewModel.objects: ${sourceObjectId}`
    )
    assert(tags.includes("story_staging_trace"), `Story trace missing story_staging_trace tag: ${trace.id}`)
    assert(tags.includes("fact_backed_visual_projection"), `Story trace missing fact-backed projection tag: ${trace.id}`)
    assert(tags.includes("read_only_projection"), `Story trace missing read-only projection tag: ${trace.id}`)
    assert(tags.includes("no_runtime_write"), `Story trace missing no_runtime_write tag: ${trace.id}`)
    assert(
      tags.includes(`source_object:${sourceObjectId}`),
      `Story trace tag source object mismatch: ${trace.id}`
    )
    tags
      .filter((tag) => tag.startsWith("connected_source_object:"))
      .map((tag) => tag.slice("connected_source_object:".length))
      .forEach((connectedObjectId) => {
        assert(
          objectIds.has(connectedObjectId),
          `Story network trace connected object is not present in WorldViewModel.objects: ${connectedObjectId}`
        )
      })
    assert(
      trace.layer === "surface",
      `Story staging trace should stay on surface layer: ${trace.id}`
    )
  })

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterStat = fs.statSync(savePath)
  const afterRecord = parseJson(
    afterRaw,
    "Runtime save became invalid during WorldViewModel build."
  )
  const afterPlacementIds = new Set(
    (afterRecord.homeMapState?.placements ?? []).map((placement) => placement.id)
  )

  assert(
    afterRecord.tick === record.tick,
    `WorldViewModel build changed tick from ${record.tick} to ${afterRecord.tick}.`
  )
  assert(
    beforePlacementIds.size === afterPlacementIds.size &&
      [...beforePlacementIds].every((id) => afterPlacementIds.has(id)),
    "WorldViewModel build changed runtime placements."
  )
  assert(
    hash(afterRaw) === beforeHash && afterStat.mtimeMs === beforeStat.mtimeMs,
    "WorldViewModel build wrote to the runtime save file."
  )

  console.log("WORLD VIEW MODEL SMOKE")
  console.log(`World id: ${model.worldId}`)
  console.log(`Objects: ${model.objects.length}`)
  console.log(`Traces: ${model.traces.length}`)
  console.log(`Story anchors: ${storyAnchorObjects.length}`)
  console.log(`Story staging traces: ${storyTraces.length}`)
  console.log(`Story staging roles: ${[...storyRoles].sort().join("|") || "none"}`)
  console.log("Story staging traces derive from existing objects: ok")
  console.log("Runtime read-only projection: ok")
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

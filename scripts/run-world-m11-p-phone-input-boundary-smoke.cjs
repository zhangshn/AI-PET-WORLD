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
  const pPhoneMapperPath = path.join(repoRoot, "src", "world", "world-view-model", "p-phone-view-mapper.ts")
  const worldPagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const pixelViewPath = path.join(repoRoot, "src", "app", "world", "components", "pixel-world-view", "pixel-world-view.tsx")

  function fail(message) {
    console.log("M11 P-PHONE INPUT BOUNDARY SMOKE")
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

  function extractStringLiterals(source) {
    const matches = source.matchAll(/(?<![A-Za-z0-9_$])(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)/g)

    return Array.from(matches)
      .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
      .join("\n")
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

  function assertStaticPPhoneBoundaryContract() {
    const pPhoneSource = fs.readFileSync(pPhoneMapperPath, "utf8")
    const pPhoneUserFacingText = extractStringLiterals(pPhoneSource)
    const worldPageSource = fs.readFileSync(worldPagePath, "utf8")
    const pixelViewSource = fs.readFileSync(pixelViewPath, "utf8")
    const formalSurfaceSource = `${worldPageSource}\n${pixelViewSource}`

    const requiredTokens = [
      "buildPPhoneView",
      "lastButlerRuntimeAuditSummary",
      "世界规则验证",
      "家园事实",
      "正式写入边界",
      "记忆种子",
    ]

    requiredTokens.forEach((token) =>
      assert(pPhoneSource.includes(token), `P-Phone mapper is missing required user-facing boundary token: ${token}.`)
    )

    const forbiddenPPhoneCopyTokens = [
      "HomeMapState",
      "SafeApply",
      "TraceField",
      "AuditSummary",
      "WorldViewModel",
      "rawScore",
      "finalScore",
      "riskPenalty",
      "debugScore",
      "JSON",
    ]
    const forbiddenPPhoneCopyHits = forbiddenPPhoneCopyTokens.filter((token) =>
      pPhoneUserFacingText.includes(token)
    )

    assert(
      forbiddenPPhoneCopyHits.length === 0,
      `P-Phone user-facing copy contains backend/debug tokens: ${forbiddenPPhoneCopyHits.join(", ")}`
    )

    const forbiddenPPhoneSourceTokens = [
      "JSON.stringify",
      "runAndPersistOneRuntimeTick",
      "writeWorldRuntimeSaveRecord",
      "rawScore",
      "finalScore",
      "riskPenalty",
      "debugScore",
    ]
    const forbiddenPPhoneSourceHits = forbiddenPPhoneSourceTokens.filter((token) =>
      pPhoneSource.includes(token)
    )

    assert(
      forbiddenPPhoneSourceHits.length === 0,
      `P-Phone mapper contains debug/write tokens: ${forbiddenPPhoneSourceHits.join(", ")}`
    )

    assert(pixelViewSource.includes("data-surface-state=\"cleared\""), "Formal PixelWorldView is no longer cleared.")
    assert(!formalSurfaceSource.includes("P-Phone"), "Formal /world restored old P-Phone card copy.")
    assert(!formalSurfaceSource.includes("当前记录"), "Formal /world restored old current record card copy.")
    assert(!formalSurfaceSource.includes("管家说明"), "Formal /world restored old butler explanation card copy.")
  }

  function assertPPhoneView(model) {
    const pPhone = model.pPhone
    const pPhoneText = [pPhone.latestMessageTitle, pPhone.latestMessageBody].join("\n")

    const forbiddenOutputTokens = [
      "HomeMapState",
      "SafeApply",
      "TraceField",
      "AuditSummary",
      "WorldViewModel",
      "rawScore",
      "finalScore",
      "riskPenalty",
      "debugScore",
      "JSON",
    ]
    const forbiddenOutputHits = forbiddenOutputTokens.filter((token) => pPhoneText.includes(token))

    assert(typeof pPhone.unreadCount === "number", "P-Phone unreadCount is not numeric.")
    assert(pPhone.unreadCount >= 0, "P-Phone unreadCount is negative.")
    assert(pPhone.latestMessageTitle.length > 0, "P-Phone latestMessageTitle is empty.")
    assert(pPhone.latestMessageBody.length > 0, "P-Phone latestMessageBody is empty.")
    assert(pPhoneText.includes("管家"), "P-Phone copy does not mention butler naturally.")
    assert(
      pPhoneText.includes("世界规则验证") || pPhoneText.includes("正式写入边界"),
      "P-Phone copy does not explain validation / formal write boundary."
    )
    assert(
      pPhoneText.includes("痕迹") || pPhoneText.includes("记忆"),
      "P-Phone copy does not explain trace or memory continuity."
    )
    assert(
      forbiddenOutputHits.length === 0,
      `P-Phone output exposes backend/debug tokens: ${forbiddenOutputHits.join(", ")}`
    )
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")
  if (!fs.existsSync(pPhoneMapperPath)) fail("P-Phone mapper is missing.")
  if (!fs.existsSync(worldPagePath)) fail("World live runtime page is missing.")
  if (!fs.existsSync(pixelViewPath)) fail("PixelWorldView is missing.")

  assertStaticPPhoneBoundaryContract()
  installTypeScriptRequireHook()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = hashText(beforeRaw)
  const record = parseJson(beforeRaw, "Runtime save is not valid JSON.")
  const beforeTick = record.tick
  const beforePlacementCount = record.homeMapState.placements.length

  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({
    saveRecord: record,
    isPersisted: true,
  })

  assertPPhoneView(model)

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = hashText(afterRaw)
  const afterRecord = parseJson(afterRaw, "Runtime save after P-Phone input boundary smoke is not valid JSON.")

  assert(afterRecord.tick === beforeTick, "P-Phone input boundary smoke changed runtime tick.")
  assert(afterRecord.homeMapState.placements.length === beforePlacementCount, "P-Phone input boundary smoke changed HomeMapState placements.")
  assert(afterHash === beforeHash, "P-Phone input boundary smoke changed runtime save hash.")

  console.log("M11 P-PHONE INPUT BOUNDARY SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`P-Phone title: ${model.pPhone.latestMessageTitle}`)
  console.log(`Unread count: ${model.pPhone.unreadCount}`)
  console.log("P-Phone reads formal model: ok")
  console.log("No backend/debug tokens in P-Phone copy: ok")
  console.log("Formal /world does not restore old P-Phone card: ok")
  console.log("P-Phone projection read-only: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

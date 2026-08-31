import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const failures = []
const CONDITION_CONTRACT_PATH = "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json"
const conditionContractBytes = readBytes(CONDITION_CONTRACT_PATH)
const conditionContract = conditionContractBytes ? JSON.parse(conditionContractBytes.toString("utf8")) : null
const explicitConditionManifestPath = argumentValue("--condition-manifest")
const registryContract = conditionContract?.currentPackageRegistry ?? {}
const registryPath = registryContract.path ?? null
const registryExists = !explicitConditionManifestPath && pathExists(registryPath)
const currentRegistry = registryExists ? readJson(registryPath) : null
const manifestPath = explicitConditionManifestPath ?? currentRegistry?.conditionManifestPath ?? null
const manifestBytes = manifestPath ? readBytes(manifestPath) : null
const manifest = manifestBytes ? parseJsonBytes(manifestBytes) : null
const conditionPackPath = manifest?.conditionPackPath ?? currentRegistry?.conditionPackagePath ?? null
const conditionPackBytes = conditionPackPath ? readBytes(conditionPackPath) : null
const conditionPack = conditionPackBytes ? parseJsonBytes(conditionPackBytes) : null
const manifestBindings = manifest?.identityBindings ?? null
const conditionBindings = conditionPack?.identityBindings ?? null
const taskPath = manifestBindings?.taskPackagePath ?? conditionBindings?.taskPackagePath ?? null
const taskBytes = taskPath ? readBytes(taskPath) : null
const task = taskBytes ? parseJsonBytes(taskBytes) : null
const currentPackageRequested = Boolean(explicitConditionManifestPath || currentRegistry)
const historicalPackageSelected = Boolean(
  explicitConditionManifestPath
  && manifest
  && conditionPack
  && (
    !manifestBindings
    || !conditionBindings
    || manifestBindings.conditionContractIdentity !== conditionContract?.conditionContractIdentity
    || conditionBindings.conditionContractIdentity !== conditionContract?.conditionContractIdentity
  )
)
if (historicalPackageSelected) check(false, "explicit condition package is historical_not_current and cannot be used as the current package")

if (registryExists) check(Boolean(currentRegistry), "current condition package registry is unreadable")
if (currentRegistry) {
  check(currentRegistry.schemaVersion === registryContract.schemaVersion, "current condition package registry schema mismatch")
  for (const field of registryContract.requiredBindings ?? []) {
    check(hasBindingValue(currentRegistry, field), `current condition package registry binding missing: ${field}`)
  }
  check(currentRegistry.conditionContractIdentity === conditionContract?.conditionContractIdentity, "current condition package registry binds the wrong contract identity")
  check(currentRegistry.conditionContractPath === CONDITION_CONTRACT_PATH, "current condition package registry binds the wrong contract path")
  check(currentRegistry.conditionContractSha256 === sha256(conditionContractBytes), "current condition package registry binds the wrong contract SHA-256")
  if (manifestBytes) check(sha256(manifestBytes) === currentRegistry.conditionManifestSha256, "current condition manifest file SHA-256 mismatch")
}
if (currentPackageRequested) {
  check(Boolean(manifest), "registered current condition manifest missing or invalid")
  check(Boolean(conditionPack), "registered current condition package missing or invalid")
  check(Boolean(task), "registered current task package missing or invalid")
}
check(Boolean(conditionContract), "current complete-map condition contract missing or invalid")
check(conditionContract?.schemaVersion === "ai-painter-complete-map-condition-contract-v1", "current condition contract schema mismatch")
check(conditionContract?.contractId === "ai-painter-complete-map-condition-contract-v1", "current condition contract identity mismatch")
check(conditionContract?.conditionContractIdentity === "ai-painter-complete-map-23-channel-condition-v1", "current condition tensor identity mismatch")
check(conditionContract?.status === "active_current_machine_condition_contract", "current condition contract is not active")
check(conditionContract?.authority === "local_ai_pet_world_program", "current condition contract authority mismatch")

const tensorContract = conditionContract?.tensorContract ?? {}
const configuredOrder = tensorContract.channelOrder ?? []
const configuredDiscrete = tensorContract.typePartitions?.discrete ?? []
const configuredContinuous = tensorContract.typePartitions?.continuous ?? []
const channelDefinitions = conditionContract?.channelDefinitions ?? []
check(tensorContract.channelCount === 23, "current condition contract must declare 23 channels")
check(configuredOrder.length === 23 && new Set(configuredOrder).size === 23, "current condition order must contain 23 unique channels")
check(configuredDiscrete.length === 15 && new Set(configuredDiscrete).size === configuredDiscrete.length, "current condition contract must contain 15 unique discrete channels")
check(configuredContinuous.length === 8 && new Set(configuredContinuous).size === configuredContinuous.length, "current condition contract must contain 8 unique continuous channels")
check(configuredDiscrete.every((id) => !configuredContinuous.includes(id)), "current discrete and continuous channel types overlap")
check(JSON.stringify([...configuredDiscrete, ...configuredContinuous].sort()) === JSON.stringify([...configuredOrder].sort()), "current channel types do not cover the complete order")
check(channelDefinitions.length === 23, "current condition channel definitions are incomplete")
check(channelDefinitions.every((channel, index) => channel.index === index && channel.id === configuredOrder[index]), "current condition definitions do not match the exact channel order")
check(channelDefinitions.every((channel) => channel.type === (configuredDiscrete.includes(channel.id) ? "discrete" : "continuous")), "current condition definition type mismatch")
check(tensorContract.storage?.dtype === "uint8", "condition storage dtype must be uint8")
check(JSON.stringify(tensorContract.storage?.valueRangeInclusive) === JSON.stringify([0, 255]), "condition storage range must be [0,255]")
check(JSON.stringify(tensorContract.storage?.nativeShape) === JSON.stringify([1, 768, 1024]), "condition storage native shape mismatch")
check(tensorContract.modelInput?.dtype === "float32", "condition model dtype must be float32")
check(tensorContract.modelInput?.normalizationFormula === "float32(storage_uint8) / 255.0", "condition model normalization formula mismatch")
check(JSON.stringify(tensorContract.modelInput?.normalizedRangeInclusive) === JSON.stringify([0, 1]), "condition model normalized range must be [0,1]")
check(tensorContract.resize?.contractId === "discrete_nearest_continuous_bilinear_v1", "condition resize contract mismatch")
check(tensorContract.resize?.typePartitionMustOccurBeforeResize === true, "condition type partition must precede resize")
check(tensorContract.resize?.featureMixingBeforeTypedResizeAllowed === false, "condition contract permits feature mixing before typed resize")
check(tensorContract.resize?.discrete?.mode === "nearest", "discrete resize mode must be nearest")
check(tensorContract.resize?.continuous?.mode === "bilinear" && tensorContract.resize?.continuous?.alignCorners === false, "continuous resize mode must be bilinear with alignCorners=false")
check(conditionContract?.authoritativeInputInvariance?.conditionCompilerMayModifyWorldFacts === false, "condition contract permits WorldFacts mutation")
check(conditionContract?.authoritativeInputInvariance?.conditionCompilerMayModifyVisualFactManifest === false, "condition contract permits VisualFactManifest mutation")
check(conditionContract?.authoritativeInputInvariance?.conditionCompilerMayInferMissingWorldFacts === false, "condition contract permits missing WorldFacts inference")
for (const forbiddenField of conditionContract?.forbiddenFieldNames ?? []) {
  check(!objectHasKey(conditionContract, forbiddenField), `current condition contract contains forbidden historical field: ${forbiddenField}`)
}

const resizeBehaviorScript = resolveProjectPath("ml/ai-painter/scripts/check_typed_condition_resize_behavior.py")
const projectPython = resolveProjectPath("ml/ai-painter/.venv/Scripts/python.exe")
let resizeBehavior = null
if (fs.existsSync(projectPython) && fs.existsSync(resizeBehaviorScript)) {
  const behaviorRun = spawnSync(projectPython, [resizeBehaviorScript, "--condition-contract", CONDITION_CONTRACT_PATH], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
  })
  check(behaviorRun.status === 0, `typed condition resize behavior failed: ${(behaviorRun.stderr || behaviorRun.stdout).trim()}`)
  if (behaviorRun.status === 0) {
    try { resizeBehavior = JSON.parse(behaviorRun.stdout) }
    catch { check(false, "typed condition resize behavior report is not valid JSON") }
  }
} else {
  check(false, "typed condition resize behavior checker or project Python is missing")
}
check(resizeBehavior?.discreteIntroducedInterpolation === false, "discrete resize behavior introduced interpolation")
check(resizeBehavior?.continuousBilinearIntermediateObserved === true, "continuous bilinear behavior was not observed")
check(resizeBehavior?.invalidTypePartitionRejected === true, "invalid channel type partition was not rejected")

if (task && manifest && conditionPack && !historicalPackageSelected) {
  check(manifest.schemaVersion === "complete-world-visual-condition-manifest-v1", "invalid condition manifest schema")
  check(conditionPack.schemaVersion === "complete-world-visual-condition-pack-v1", "invalid condition pack schema")
  check(manifest.status === "compiled_conditions_ready", "condition compiler did not complete")
  check(manifest.outputKind === "model_condition_only_no_rgb", "condition output must not be an RGB candidate")
  check(manifest.generatesPlayerFacingPixels === false, "condition compiler must not generate player-facing pixels")
  check(conditionPack.changesWorldFacts === false, "condition compiler must not change world facts")
  check(conditionPack.changesVisualFactManifest === false, "condition compiler must not change the VisualFactManifest")
  check(conditionPack.generatesPlayerFacingPixels === false, "condition pack must not be player-facing")
  check(Boolean(manifestBindings), "condition manifest current identityBindings missing")
  check(Boolean(conditionBindings), "condition pack current identityBindings missing")
  if (manifestBindings && conditionBindings) {
    const requiredBindingFields = conditionContract.identityBindings?.requiredFields ?? []
    for (const field of requiredBindingFields) {
      check(hasBindingValue(manifestBindings, field), `condition manifest identity binding missing: ${field}`)
      check(hasBindingValue(conditionBindings, field), `condition pack identity binding missing: ${field}`)
    }
    for (const field of conditionContract.identityBindings?.exactMatchAcrossConditionPackageManifestDatasetAndExecution ?? []) {
      check(manifestBindings[field] === conditionBindings[field], `condition manifest/pack identity mismatch: ${field}`)
    }
    check(conditionBindings.conditionContractIdentity === conditionContract.conditionContractIdentity, "condition pack binds the wrong condition contract identity")
    check(conditionBindings.conditionContractPath === CONDITION_CONTRACT_PATH, "condition pack binds the wrong condition contract path")
    check(conditionBindings.conditionContractSha256 === sha256(conditionContractBytes), "condition pack binds the wrong condition contract SHA-256")
    check(conditionBindings.conditionPackagePath === conditionPackPath, "condition pack binds the wrong package path")
    check(conditionBindings.taskPackagePath === taskPath, "condition pack binds the wrong task path")
    check(manifestBindings.conditionContractIdentity === conditionContract.conditionContractIdentity, "condition manifest binds the wrong condition contract identity")
    check(manifestBindings.conditionContractPath === CONDITION_CONTRACT_PATH, "condition manifest binds the wrong condition contract path")
    check(manifestBindings.conditionContractSha256 === sha256(conditionContractBytes), "condition manifest binds the wrong condition contract SHA-256")
    const taskCanonical = JSON.parse(JSON.stringify(task))
    delete taskCanonical.taskSha256
    check(sha256(Buffer.from(JSON.stringify(taskCanonical))) === conditionBindings.taskPackageSha256, "bound task package canonical SHA-256 mismatch")
    const taskManifestBytes = readBytes(conditionBindings.taskManifestPath)
    check(Boolean(taskManifestBytes), "bound task manifest is missing")
    if (taskManifestBytes) check(sha256(taskManifestBytes) === conditionBindings.taskManifestSha256, "bound task manifest file SHA-256 mismatch")
    const visualFactBytes = readBytes(conditionBindings.visualFactManifestPath)
    check(Boolean(visualFactBytes), "bound VisualFactManifest is missing")
    if (visualFactBytes) {
      const visualFactManifest = parseJsonBytes(visualFactBytes)
      const visualFactCanonical = visualFactManifest ? JSON.parse(JSON.stringify(visualFactManifest)) : null
      if (visualFactCanonical) delete visualFactCanonical.manifestSha256
      check(Boolean(visualFactCanonical), "bound VisualFactManifest is invalid JSON")
      if (visualFactCanonical) check(sha256(Buffer.from(JSON.stringify(visualFactCanonical))) === conditionBindings.visualFactManifestSha256, "bound VisualFactManifest canonical SHA-256 mismatch")
    }
  }
  check(manifest.taskId === task.taskId && conditionPack.taskId === task.taskId, "task identity mismatch")
  check(manifest.taskSha256 === task.taskSha256 && conditionPack.taskSha256 === task.taskSha256, "task hash mismatch")
  check(manifest.dictionaryVersionId === task.dictionaryVersionId, "dictionary identity mismatch")
  check(manifest.worldId === task.worldId && manifest.tick === task.tick, "world identity mismatch")
  check(manifest.worldProfileId === "mainland-southeast-asia-tropical-monsoon-natural-home-v1", "condition manifest world profile mismatch")
  check(conditionPack.worldProfileId === manifest.worldProfileId, "condition pack world profile mismatch")
  check(conditionPack.visualFactManifestId === task.sourceBindings?.visualFactManifestId, "visual fact identity mismatch")
  check(conditionPack.sourceBindings?.taskPackagePath === taskPath, "condition source task path mismatch")
  check(conditionPack.sourceBindings?.directorOutputPath === task.sourceBindings?.directorOutputPath, "condition source director path mismatch")
  check(conditionPack.sourceBindings?.visualFactManifestPath === task.sourceBindings?.visualFactManifestPath, "condition source visual fact path mismatch")
  check(conditionPack.sourceBindings?.dictionaryPath === task.sourceBindings?.dictionaryPath, "condition source dictionary path mismatch")
  check(conditionPack.sourceBindings?.datasetPackagePath === task.sourceBindings?.datasetPackagePath, "condition source dataset package path mismatch")
  for (const [label, sourcePath] of Object.entries(conditionPack.sourceBindings ?? {})) {
    if (!label.endsWith("Path")) continue
    check(fs.existsSync(resolveProjectPath(sourcePath)), `condition source file missing: ${label}`)
  }
  check(conditionPack.canvas?.width === 1024 && conditionPack.canvas?.height === 768, "condition canvas must be 1024x768")
  check(conditionPack.canvas?.frameScope === "complete_runtime_frame", "condition pack must represent the complete map")
  check(conditionPack.bootstrapInferenceGate?.status === "historical_third_party_bootstrap_disabled", "historical bootstrap isolation status missing")
  check(conditionPack.bootstrapInferenceGate?.canRunBootstrapInference === false, "historical bootstrap must stay disabled")
  check(conditionPack.bootstrapInferenceGate?.canEnterWorld === false, "bootstrap inference gate must block /world")
  check(conditionPack.bootstrapInferenceGate?.independentTrainingEligible === false, "historical bootstrap must be excluded from independent training")
  check(Array.isArray(conditionPack.unavailableChannels), "unavailable channel evidence missing")

  const requiredChannels = configuredOrder
  const channelOrder = conditionPack.channels?.map((channel) => channel.id) ?? []
  const channelIds = new Set(conditionPack.channels?.map((channel) => channel.id) ?? [])
  for (const id of requiredChannels) check(channelIds.has(id), `required condition channel missing: ${id}`)
  check(JSON.stringify(channelOrder) === JSON.stringify(configuredOrder), "condition channel order differs from the current machine contract")
  check(channelIds.size === conditionPack.channels?.length, "condition channel ids must be unique")
  check(manifest.channelCount === 23, "condition manifest must declare exactly 23 channels")
  check(manifest.channelCount === conditionPack.channels?.length, "condition channel count mismatch")

  for (const channel of conditionPack.channels ?? []) {
    const filePath = resolveProjectPath(channel.path)
    check(fs.existsSync(filePath), `condition channel file missing: ${channel.id}`)
    if (!fs.existsSync(filePath)) continue
    const bytes = fs.readFileSync(filePath)
    check(sha256(bytes) === channel.sha256, `condition channel hash mismatch: ${channel.id}`)
    const metadata = await sharp(bytes, { failOn: "error" }).metadata()
    check(metadata.width === 1024 && metadata.height === 768, `condition channel size mismatch: ${channel.id}`)
    check(metadata.space === "b-w", `condition channel must be single-channel grayscale: ${channel.id}`)
    check(channel.dtype === "uint8", `condition channel dtype mismatch: ${channel.id}`)
    check(JSON.stringify(channel.valueRange) === JSON.stringify([0, 255]), `condition channel value range mismatch: ${channel.id}`)
    check(JSON.stringify(channel.shape) === JSON.stringify([1, 768, 1024]), `condition channel shape mismatch: ${channel.id}`)
    check(Number.isInteger(channel.statistics?.minimum), `condition channel statistics missing: ${channel.id}`)
    check(Number.isInteger(channel.statistics?.maximum), `condition channel statistics missing: ${channel.id}`)
    check(channel.statistics?.minimum >= 0 && channel.statistics?.minimum <= 255, `condition channel minimum out of range: ${channel.id}`)
    check(channel.statistics?.maximum >= 0 && channel.statistics?.maximum <= 255, `condition channel maximum out of range: ${channel.id}`)
    check(channel.statistics?.minimum <= channel.statistics?.maximum, `condition channel statistics are inverted: ${channel.id}`)
    const definition = channelDefinitions.find((entry) => entry.id === channel.id)
    check(Boolean(definition), `condition channel definition missing from current contract: ${channel.id}`)
    check((configuredDiscrete.includes(channel.id) ? "discrete" : "continuous") === definition?.type, `condition channel type differs from current contract: ${channel.id}`)
  }

  for (const id of ["terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline", "walkable", "collision", "object_footprints"]) {
    const channel = conditionPack.channels.find((item) => item.id === id)
    check((channel?.statistics?.nonZeroCount ?? 0) > 0, `required condition channel is empty: ${id}`)
  }

  const canonical = JSON.parse(JSON.stringify(conditionPack))
  delete canonical.conditionPackSha256
  if (canonical.identityBindings) delete canonical.identityBindings.conditionPackageSha256
  check(sha256(Buffer.from(JSON.stringify(canonical))) === conditionPack.conditionPackSha256, "condition pack hash mismatch")
  check(conditionBindings?.conditionPackageSha256 === conditionPack.conditionPackSha256, "condition package identity binding hash mismatch")
  check(manifest.conditionPackSha256 === conditionPack.conditionPackSha256, "condition manifest pack hash mismatch")
  if (currentRegistry) check(currentRegistry.conditionPackageSha256 === conditionPack.conditionPackSha256, "current condition package registry pack SHA-256 mismatch")
}

const packageStatus = !currentPackageRequested
  ? (registryContract.missingRegistryStatus ?? "no_current_condition_package_registered")
  : historicalPackageSelected
    ? "historical_not_current"
    : failures.length === 0
      ? "current_condition_package_verified"
      : "current_condition_package_check_failed"
const result = {
  ok: failures.length === 0,
  status: failures.length === 0 && !currentPackageRequested ? packageStatus : failures.length === 0 ? "world_visual_conditions_check_passed" : packageStatus,
  currentPackageStatus: packageStatus,
  currentPackageRegistryPath: registryPath,
  legacyLatestPointerFallbackUsed: false,
  taskId: task?.taskId ?? null,
  conditionPackId: conditionPack?.conditionPackId ?? null,
  channelCount: conditionPack?.channels?.length ?? 0,
  unavailableChannels: conditionPack?.unavailableChannels ?? [],
  inferenceEligible: manifest?.inferenceEligible ?? false,
  inferenceBlockers: manifest?.inferenceBlockers ?? [],
  outputKind: manifest?.outputKind ?? null,
  conditionContract: {
    identity: conditionContract?.conditionContractIdentity ?? null,
    path: CONDITION_CONTRACT_PATH,
    sha256: conditionContractBytes ? sha256(conditionContractBytes) : null,
    status: conditionContract?.status ?? null,
    channelCount: tensorContract.channelCount ?? null,
    channelOrder: configuredOrder,
    discreteChannels: configuredDiscrete,
    continuousChannels: configuredContinuous,
    storage: tensorContract.storage ?? null,
    modelInput: tensorContract.modelInput ?? null,
    resizeContract: tensorContract.resize?.contractId ?? null,
    resizeBehavior,
  },
  failures,
}

console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(resolveProjectPath(filePath), "utf8"))
  } catch {
    return null
  }
}

function readBytes(filePath) {
  try {
    return fs.readFileSync(resolveProjectPath(filePath))
  } catch {
    return null
  }
}

function parseJsonBytes(bytes) {
  try {
    return JSON.parse(bytes.toString("utf8"))
  } catch {
    return null
  }
}

function pathExists(filePath) {
  if (!filePath) return false
  try {
    return fs.existsSync(resolveProjectPath(filePath))
  } catch {
    return false
  }
}

function resolveProjectPath(filePath) {
  const resolved = path.resolve(ROOT, filePath)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project root: ${filePath}`)
  return resolved
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

function objectHasKey(value, targetKey) {
  if (!value || typeof value !== "object") return false
  if (Array.isArray(value)) return value.some((item) => objectHasKey(item, targetKey))
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) return true
  return Object.values(value).some((item) => objectHasKey(item, targetKey))
}

function hasBindingValue(bindings, field) {
  const value = bindings?.[field]
  if (typeof value === "string") return value.length > 0
  if (field === "tick") return Number.isInteger(value) && value >= 0
  return value !== null && value !== undefined
}

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

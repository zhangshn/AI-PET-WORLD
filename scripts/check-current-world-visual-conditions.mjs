import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const failures = []
const modelConfig = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json")
const modelSourcePath = resolveProjectPath("ml/ai-painter/src/ai_painter/complete_world/model.py")
const modelSource = fs.readFileSync(modelSourcePath, "utf8")
const latestTask = readJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
const task = latestTask?.taskPath ? readJson(latestTask.taskPath) : null
const taskDir = latestTask?.taskPath ? path.dirname(resolveProjectPath(latestTask.taskPath)) : null
const manifestPath = taskDir ? path.join(taskDir, "compiled-conditions", "manifest.json") : null
const manifest = manifestPath ? readJson(manifestPath) : null
const conditionPack = manifest?.conditionPackPath ? readJson(manifest.conditionPackPath) : null

check(Boolean(latestTask), "latest task pointer missing")
check(Boolean(task), "latest task package missing")
check(Boolean(manifest), "compiled condition manifest missing")
check(Boolean(conditionPack), "compiled condition pack missing")
check(modelConfig?.schemaVersion === "project-owned-complete-world-model-config-v1", "V7 model config missing or invalid")
check(modelConfig?.conditionChannels === 23, "V7 condition channel count must be 23")
check(modelConfig?.conditionResizeContract === "discrete_nearest_continuous_bilinear_v1", "V7 condition resize contract mismatch")

const configuredOrder = modelConfig?.conditionChannelOrder ?? []
const configuredDiscrete = modelConfig?.conditionChannelTypes?.discrete ?? []
const configuredContinuous = modelConfig?.conditionChannelTypes?.continuous ?? []
check(configuredOrder.length === 23 && new Set(configuredOrder).size === 23, "V7 condition order must contain 23 unique channels")
check(new Set(configuredDiscrete).size === configuredDiscrete.length, "V7 discrete channel types contain duplicates")
check(new Set(configuredContinuous).size === configuredContinuous.length, "V7 continuous channel types contain duplicates")
check(configuredDiscrete.every((id) => !configuredContinuous.includes(id)), "V7 discrete and continuous channel types overlap")
check(JSON.stringify([...configuredDiscrete, ...configuredContinuous].sort()) === JSON.stringify([...configuredOrder].sort()), "V7 channel types do not cover the complete order")
check(modelSource.includes("def resize_typed_conditions"), "typed condition resize implementation missing")
check(modelSource.includes('mode="nearest"'), "discrete nearest resize implementation missing")
check(modelSource.includes('mode="bilinear"'), "continuous bilinear resize implementation missing")

if (task && manifest && conditionPack) {
  check(manifest.schemaVersion === "complete-world-visual-condition-manifest-v1", "invalid condition manifest schema")
  check(conditionPack.schemaVersion === "complete-world-visual-condition-pack-v1", "invalid condition pack schema")
  check(manifest.status === "compiled_conditions_ready", "condition compiler did not complete")
  check(manifest.outputKind === "model_condition_only_no_rgb", "condition output must not be an RGB candidate")
  check(manifest.generatesPlayerFacingPixels === false, "condition compiler must not generate player-facing pixels")
  check(conditionPack.changesWorldFacts === false, "condition compiler must not change world facts")
  check(conditionPack.generatesPlayerFacingPixels === false, "condition pack must not be player-facing")
  check(manifest.taskId === latestTask.taskId && conditionPack.taskId === latestTask.taskId, "task identity mismatch")
  check(manifest.taskSha256 === task.taskSha256 && conditionPack.taskSha256 === task.taskSha256, "task hash mismatch")
  check(manifest.dictionaryVersionId === latestTask.dictionaryVersionId, "dictionary identity mismatch")
  check(manifest.worldId === latestTask.worldId && manifest.tick === latestTask.tick, "world identity mismatch")
  check(manifest.worldProfileId === "mainland-southeast-asia-tropical-monsoon-natural-home-v1", "condition manifest world profile mismatch")
  check(conditionPack.worldProfileId === manifest.worldProfileId, "condition pack world profile mismatch")
  check(conditionPack.visualFactManifestId === task.sourceBindings?.visualFactManifestId, "visual fact identity mismatch")
  check(conditionPack.sourceBindings?.taskPackagePath === latestTask.taskPath, "condition source task path mismatch")
  check(conditionPack.sourceBindings?.directorOutputPath === latestTask.directorPath, "condition source director path mismatch")
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
  check(JSON.stringify(channelOrder) === JSON.stringify(configuredOrder), "condition channel order differs from the V7 contract")
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
    check(configuredDiscrete.includes(channel.id) || configuredContinuous.includes(channel.id), `condition channel type missing from V7 contract: ${channel.id}`)
  }

  for (const id of ["terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline", "walkable", "collision", "object_footprints"]) {
    const channel = conditionPack.channels.find((item) => item.id === id)
    check((channel?.statistics?.nonZeroCount ?? 0) > 0, `required condition channel is empty: ${id}`)
  }

  const canonical = { ...conditionPack }
  delete canonical.conditionPackSha256
  check(sha256(Buffer.from(JSON.stringify(canonical))) === conditionPack.conditionPackSha256, "condition pack hash mismatch")
  check(manifest.conditionPackSha256 === conditionPack.conditionPackSha256, "condition manifest pack hash mismatch")
}

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "world_visual_conditions_check_passed" : "world_visual_conditions_check_failed",
  taskId: latestTask?.taskId ?? null,
  conditionPackId: conditionPack?.conditionPackId ?? null,
  channelCount: conditionPack?.channels?.length ?? 0,
  unavailableChannels: conditionPack?.unavailableChannels ?? [],
  inferenceEligible: manifest?.inferenceEligible ?? false,
  inferenceBlockers: manifest?.inferenceBlockers ?? [],
  outputKind: manifest?.outputKind ?? null,
  conditionContract: {
    configPath: "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json",
    channelCount: modelConfig?.conditionChannels ?? null,
    channelOrder: configuredOrder,
    discreteChannels: configuredDiscrete,
    continuousChannels: configuredContinuous,
    resizeContract: modelConfig?.conditionResizeContract ?? null,
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

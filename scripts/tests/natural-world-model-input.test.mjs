import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { buildNaturalWorldModelInputDescriptor, writeNaturalWorldModelInputDescriptor, validateNaturalObjectTable } from "../lib/natural-world-model-input.mjs"

const root = process.cwd(), output = path.resolve(process.env.NATURAL_MODEL_INPUT_OUTPUT_ROOT ?? ".runtime/ai-painter/controller-repair-reviews/natural-world-model-input-102-20261028/implementation/node-fixtures")
const requestPath = path.resolve(process.env.NATURAL_MODEL_INPUT_REQUEST ?? ".runtime/ai-painter/controller-repair-reviews/natural-world-model-input-102-20261028/implementation/real-request.json")
const request = JSON.parse(fs.readFileSync(requestPath, "utf8"))
const sha = b => createHash("sha256").update(b).digest("hex")
const json = v => JSON.stringify(v, null, 2) + "\n"
fs.mkdirSync(output, { recursive: true })
const relative = p => path.relative(root, p).replace(/\\/g, "/")
let positive
test("actual 098 natural source/Store/original23 descriptor is target-free and immutable", async () => {
  const p = path.join(output, "natural-model-input.json")
  positive = await writeNaturalWorldModelInputDescriptor({ request, outputPath: relative(p) })
  assert.equal(positive.binding.sha256, sha(fs.readFileSync(p)))
  const d = positive.descriptor
  assert.equal(d.scope, "natural_world_runtime_v1"); assert.equal(d.newWorldIsDatasetSample, false)
  assert(!("sampleId" in d)); assert(!("image" in d)); assert.equal(d.channels.length, 23)
  assert.equal(d.objectInstanceTable.length, 52)
  assert.equal(d.ecology.regionalLandscapeType, "forested-low-mountain")
  assert.equal(d.ecology.seasonScenario.kind, "initial_simulation_scenario"); assert.equal(d.ecology.seasonScenario.season, "wet_season")
  for (const k of ["weather", "lighting", "wind", "localTime"]) assert.equal(d.ecology.environment[k].status, "unknown")
  assert.equal(d.channels.find(c => c.id === "object_instance").resize, "nearest")
  assert.equal(d.channels.find(c => c.id === "signed_distance_path").resize, "bilinear")
  assert.deepEqual(d.nativeStages.map(s => [s.width, s.height]), [[256, 192], [512, 384], [1024, 768]])
  assert(d.sourceReadBindings.every(b => !b.path.includes("/design/")))
  fs.writeFileSync(path.join(output, "descriptor-binding.json"), json(positive.binding), { flag: "wx" })
  fs.writeFileSync(path.join(output, "actual-node-receipt.json"), json({ binding: positive.binding, identity: d.identity,
    sourceFactReleaseIdentity: d.sourceFactReleaseIdentity, inputReads: positive.inputReads,
    sourceReadBindings: d.sourceReadBindings, memoryUsage: process.memoryUsage(), rendererExecuted: false, storeWritten: false }), { flag: "wx" })
  await assert.rejects(() => writeNaturalWorldModelInputDescriptor({ request, outputPath: relative(p) }), /EEXIST/)
})
for (const variant of ["swapped_world", "stale_state", "stripped_scope", "caller_pass_flag", "wrong_file_hash"]) test("Node refuses " + variant, async () => {
  const r = structuredClone(request)
  if (variant === "swapped_world") r.identity.worldId = "natural-other-world"
  if (variant === "stale_state") r.stateVersion++
  if (variant === "stripped_scope") delete r.scope
  if (variant === "caller_pass_flag") r.sourceQualified = true
  if (variant === "wrong_file_hash") r.runtimeSave.sha256 = "f".repeat(64)
  let error
  await assert.rejects(async () => { try { await buildNaturalWorldModelInputDescriptor({ request: r }) } catch (e) { error = e.message; throw e } })
  fs.writeFileSync(path.join(output, variant + ".json"), json({ request: r, rejected: true, error }), { flag: "wx" })
})
for (const variant of ["same_shaped_png", "altered_ecology", "altered_season"]) test("immutable saved binding rejects " + variant, async () => {
  assert(positive)
  const r = structuredClone(request)
  if (variant === "same_shaped_png") {
    const pack = JSON.parse(fs.readFileSync(path.resolve(root, r.conditionPackage.path), "utf8"))
    const sameShape = fs.readFileSync(path.resolve(root, pack.channels.find(c => c.id === "terrain_water").path))
    const fakePath = path.join(output, "same-shaped-fake.png"); fs.writeFileSync(fakePath, sameShape, { flag: "wx" })
    pack.channels[0].path = relative(fakePath); pack.channels[0].sha256 = sha(sameShape)
    const p = path.join(output, "same-shaped-forged-pack.json"); fs.writeFileSync(p, json(pack), { flag: "wx" }); r.conditionPackage = { path: relative(p), sha256: sha(fs.readFileSync(p)) }
  } else {
    const task = JSON.parse(fs.readFileSync(path.resolve(root, r.taskPackage.path), "utf8"))
    if (variant === "altered_ecology") task.singleMapEcologyFields.regionalLandscapeType = "bamboo-grove"
    else task.singleMapEcologyFields.environment.seasonScenario.season = "dry_season"
    const p = path.join(output, variant + "-task.json"); fs.writeFileSync(p, json(task), { flag: "wx" }); r.taskPackage = { path: relative(p), sha256: sha(fs.readFileSync(p)) }
  }
  let error
  await assert.rejects(async () => { try { await buildNaturalWorldModelInputDescriptor({ request: r }) } catch (e) { error = e.message; throw e } }, /saved immutable binding differs/)
  fs.writeFileSync(path.join(output, variant + "-rejected.json"), json({ request: r, error }), { flag: "wx" })
})
test("unsupported roles and native-coordinate table tampering are rejected", () => {
  const table = structuredClone(positive.descriptor.objectInstanceTable), footprints = table.map(({ value: _v, ...o }) => { assert(_v); return o })
  table[0].kind = "animal"; footprints[0].kind = "animal"
  assert.throws(() => validateNaturalObjectTable(table, footprints), /unsupported natural object role/)
  table[0].kind = footprints[0].kind = "tree"; table[0].footprint.x = -1
  assert.throws(() => validateNaturalObjectTable(table, footprints), /outside native coordinates/)
})
test("missing production Store configuration has no legacy fallback", async () => {
  const old = process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT
  delete process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT
  try { await assert.rejects(() => buildNaturalWorldModelInputDescriptor({ request }), /AI_PET_WORLD_RUNTIME_STORE_ROOT/) }
  finally { process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT = old }
})

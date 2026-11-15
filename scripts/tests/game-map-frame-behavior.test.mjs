import assert from "node:assert/strict"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"
import ts from "typescript"
import sharp from "sharp"

// Execute actual pure map modules in memory with a closed import table.
// No runtime store, server, model, filesystem writes or production world access.
const allowed = new Set([
  "game-map-frame-builder", "game-map-layer-generator", "game-map-geometry",
  "game-map-frame-validator", "game-map-frame-schema", "home-map-structure-schema",
  "natural-home-mvp-sample", "source-fact-identity", "game-map-composite-image-analysis",
])
const cache = new Map()
function load(name) {
  assert.ok(allowed.has(name), `unexpected dependency: ${name}`)
  if (cache.has(name)) return cache.get(name).exports
  const relative = name === "source-fact-identity" ? "runtime-core/source-fact-identity" : `game-map-frame/${name}`
  const file = fileURLToPath(new URL(`../../src/world/${relative}.ts`, import.meta.url))
  const result = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  assert.deepEqual(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error), [])
  const loadedModule = { exports: {} }
  cache.set(name, loadedModule)
  new Function("require", "module", "exports", result.outputText)(specifier => {
    if (name === "game-map-composite-image-analysis" && specifier === "sharp") return { default: sharp }
    if (specifier === "../runtime-core/source-fact-identity") return load("source-fact-identity")
    assert.ok(specifier.startsWith("./"), `external import forbidden: ${specifier}`)
    return load(specifier.slice(2))
  }, loadedModule, loadedModule.exports)
  return loadedModule.exports
}

const { buildGameMapFrameFromHomeMapStructure: build } = load("game-map-frame-builder")
const { validateGameMapFrame, validateHomeMapStructure } = load("game-map-frame-validator")
const { naturalHomeMvpHomeMapStructure: sample } = load("natural-home-mvp-sample")

test("visual masks retain their edge convention without changing collision overlap", () => {
  const { pointInVisualMaskPolygon: contains, polygonsOverlap } = load("game-map-geometry")
  const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]
  for (const polygon of [square, [...square].reverse()]) {
    for (const [x, y, expected] of [[2, 2, true], [0, 0, true], [0, 2, true], [2, 0, true], [4, 2, false], [2, 4, false], [4, 4, false], [-1, 2, false]]) {
      assert.equal(contains(x, y, polygon), expected, `visual edge ${x},${y}`)
    }
  }
  const adjoining = square.map(({ x, y }) => ({ x: x + 4, y }))
  assert.equal(polygonsOverlap(square, adjoining), false)
  assert.equal(contains(1, 1, []), false)
  assert.equal(contains(1, 1, [{ x: 1, y: 1 }]), false)
  assert.equal(contains(1, 1, [{ x: 0, y: 0 }, { x: 2, y: 2 }]), false)
})

test("concave visual masks preserve cutouts and repeated closing vertices", () => {
  const { pointInVisualMaskPolygon: contains } = load("game-map-geometry")
  const shape = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 4 }]
  for (const polygon of [shape, [...shape].reverse(), [...shape, shape[0]]]) {
    assert.equal(contains(0.5, 3, polygon), true)
    assert.equal(contains(3, 0.5, polygon), true)
    assert.equal(contains(2, 2, polygon), false)
  }
})

function fixture() {
  const structure = structuredClone(sample)
  structure.worldId = "private-behavior-world"
  structure.ownerId = "private-behavior-owner"
  structure.tick = 7
  return { structure, frame: build(structure) }
}

test("real builder preserves source identity and creates a valid unapproved map", () => {
  const { structure, frame } = fixture()
  assert.deepEqual(validateHomeMapStructure(structure), { passed: true, issues: [] })
  assert.deepEqual(validateGameMapFrame(frame, structure), { passed: true, issues: [] })
  assert.equal(frame.worldId, structure.worldId)
  assert.equal(frame.ownerId, structure.ownerId)
  assert.equal(frame.tick, structure.tick)
  assert.equal(frame.visualLayer.status, "not_generated")
  assert.equal(frame.visualLayer.approvedFrameId, null)
  assert.equal(frame.visualLayer.imageSha256, null)
})

test("real layer generation preserves objects, blocking geometry and inspect actions", () => {
  const { structure, frame } = fixture()
  assert.deepEqual(frame.objectLayer.objects.map(o => o.sourceObjectId), structure.objects.map(o => o.id))
  const blocking = structure.objects.filter(o => o.blocksMovement)
  assert.ok(blocking.length > 0)
  assert.deepEqual(frame.collisionLayer.blockedObjectIds, blocking.map(o => o.id))
  for (const object of blocking) {
    const region = frame.collisionLayer.regions.find(r => r.sourceId === object.id)
    const { x, y, width, height } = object.footprint
    assert.deepEqual(region.polygon, [
      { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height },
    ])
  }
  assert.deepEqual(frame.interactionLayer.items.map(i => i.sourceObjectId),
    structure.objects.filter(o => o.interactionKind === "inspect").map(o => o.id))
  for (const path of structure.paths) {
    assert.ok(frame.walkableLayer.regions.some(r => r.sourceId === path.id && r.polygon.length >= 4))
  }
})

for (const [label, mutate, code] of [
  ["different owner", f => { f.ownerId = "other-owner" }, "owner_id_mismatch"],
  ["different world", f => { f.worldId = "other-world" }, "world_id_mismatch"],
  ["different tick", f => { f.tick += 1 }, "tick_mismatch"],
  ["different structure", f => { f.structureId = "other-structure" }, "structure_id_mismatch"],
  ["foreign source facts", f => { f.sourceFactIds = ["foreign-fact"] }, "source_fact_ids_mismatch"],
  ["duplicate facts hiding missing facts", f => { assert.ok(new Set(f.sourceFactIds).size > 1); f.sourceFactIds = f.sourceFactIds.map(() => f.sourceFactIds[0]) }, "source_fact_ids_mismatch"],
  ["missing objects", f => { f.objectLayer.objects = [] }, "object_missing"],
  ["missing collisions", f => { f.collisionLayer.blockedObjectIds = [] }, "blocked_object_missing"],
  ["missing paths", f => { f.walkableLayer.regions = [] }, "path_walkable_missing"],
  ["missing interactions", f => { f.interactionLayer.items = [] }, "interaction_item_missing"],
  ["missing runtime binding", f => { f.runtimeLayer.stateRefs = [] }, "runtime_layer_structure_ref_missing"],
]) test(`real validator rejects ${label}`, () => {
  const { structure, frame } = fixture()
  mutate(frame)
  const result = validateGameMapFrame(frame, structure)
  assert.equal(result.passed, false)
  assert.ok(result.issues.some(issue => issue.code === code), JSON.stringify(result.issues))
})

for (const [label, mutate, code] of [
  ["missing geometry despite retained IDs", f => { f.collisionLayer.regions = [] }, "collision_region_missing"],
  ["shifted geometry", f => { f.collisionLayer.regions[0].polygon.forEach(p => { p.x += 1 }) }, "collision_geometry_mismatch"],
  ["shrunk geometry", f => { f.collisionLayer.regions[0].polygon[1].x -= 1 }, "collision_geometry_mismatch"],
  ["crossed polygon edges", f => {
    const p = f.collisionLayer.regions[0].polygon
    ;[p[1], p[2]] = [p[2], p[1]]
  }, "collision_geometry_mismatch"],
  ["incorrect collision kind", f => { f.collisionLayer.regions[0].kind = "walkable_area" }, "collision_region_kind_invalid"],
  ["duplicate collision region", f => { f.collisionLayer.regions.push(structuredClone(f.collisionLayer.regions[0])) }, "collision_region_duplicate"],
  ["foreign collision region", f => { f.collisionLayer.regions[0].sourceId = "foreign-object" }, "collision_region_unexpected"],
  ["foreign blocking ID", f => { f.collisionLayer.blockedObjectIds.push("foreign-object") }, "blocked_object_ids_mismatch"],
  ["duplicate blocking ID", f => { f.collisionLayer.blockedObjectIds.push(f.collisionLayer.blockedObjectIds[0]) }, "blocked_object_ids_mismatch"],
  ["duplicate ID replacing another object", f => { f.collisionLayer.blockedObjectIds[1] = f.collisionLayer.blockedObjectIds[0] }, "blocked_object_ids_mismatch"],
]) test(`real validator rejects ${label}`, () => {
  const { structure, frame } = fixture()
  mutate(frame)
  const result = validateGameMapFrame(frame, structure)
  assert.equal(result.passed, false)
  assert.ok(result.issues.some(issue => issue.code === code), JSON.stringify(result.issues))
})

test("equivalent collision winding, starting vertex and region order remain valid", () => {
  const { structure, frame } = fixture()
  frame.collisionLayer.regions.reverse()
  frame.collisionLayer.blockedObjectIds.reverse()
  for (const region of frame.collisionLayer.regions) {
    const points = region.polygon.toReversed()
    region.polygon = [...points.slice(1), points[0]]
  }
  assert.deepEqual(validateGameMapFrame(frame, structure), { passed: true, issues: [] })
})

test("a structure without blocking objects requires no collision geometry", () => {
  const { structure } = fixture()
  structure.objects = []
  const frame = build(structure)
  assert.deepEqual(frame.collisionLayer, { blockedObjectIds: [], regions: [] })
  assert.deepEqual(validateGameMapFrame(frame, structure), { passed: true, issues: [] })
})

test("rebuilding a later tick changes its identity without changing the source structure", () => {
  const { structure, frame } = fixture()
  const before = structuredClone(structure)
  const next = build({ ...structure, tick: structure.tick + 1 })
  assert.deepEqual(structure, before)
  assert.notEqual(next.frameId, frame.frameId)
  assert.ok(next.runtimeLayer.stateRefs.includes("tick:8"))
  assert.equal(frame.tick, 7)
})


test("composite image analysis preserves uniform pixels and distinguishes object alpha", async () => {
  const analysis = load("game-map-composite-image-analysis")
  const png = await sharp({ create: { width: 96, height: 80, channels: 4, background: { r: 40, g: 80, b: 120, alpha: 1 } } }).png().toBuffer()
  const metrics = await analysis.measureCompositeOutputQuality(png)
  assert.equal(metrics.averageVerticalSeamDelta, 0)
  assert.equal(metrics.averageHorizontalSeamDelta, 0)
  assert.equal(metrics.objectMaterialAlphaMissingCount, 0)
  assert.equal(metrics.objectMaterialAlphaMissingSuspected, false)
  const audit = [{ slotId: "terrain-patch-1-1", left: 32, top: 32, width: 32, height: 32,
    unitKind: "tree_visual_unit", sourceHasAlpha: false }]
  const missing = await analysis.measureCompositeOutputQuality(png, audit)
  assert.equal(missing.objectMaterialAlphaMissingCount, 1)
  assert.equal(missing.objectMaterialAlphaMissingSuspected, true)
  const isolated = await analysis.measureCompositeOutputQuality(png, [{ ...audit[0], sourceHasAlpha: true }])
  assert.equal(isolated.objectMaterialAlphaMissingCount, 0)
  const repaired = await analysis.repairCompositeSeams(png, audit)
  const raw = async input => sharp(input).ensureAlpha().raw().toBuffer()
  assert.deepEqual(await raw(repaired), await raw(png))
})

test("composite seam processing changes only the requested seam band", async () => {
  const { repairCompositeSeams } = load("game-map-composite-image-analysis")
  const width = 96, height = 32, raw = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4
    raw.fill(x < 32 ? 20 : 220, offset, offset + 3)
    raw[offset + 3] = 255
  }
  const png = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer()
  const result = await repairCompositeSeams(png, [{ slotId: "ground-patch-0-1", left: 32, top: 0 }])
  const pixels = await sharp(result).ensureAlpha().raw().toBuffer()
  assert.notDeepEqual(pixels, raw)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4
    assert.equal(pixels[offset + 3], 255)
    if (Math.abs(x - 32) > 5 && Math.abs(x - 64) > 5)
      assert.deepEqual(pixels.subarray(offset, offset + 4), raw.subarray(offset, offset + 4))
  }
})

test("composite analysis retains terrain patch identity and rejects corrupt images", async () => {
  const analysis = load("game-map-composite-image-analysis")
  assert.deepEqual(analysis.parseTerrainPatchSlotId("grass-main-patch-12-3"), { groupId: "grass-main", row: 12, column: 3 })
  assert.equal(analysis.parseTerrainPatchSlotId("grass-main"), null)
  assert.equal(analysis.parseTerrainPatchSlotId("grass-patch--1-2"), null)
  await assert.rejects(analysis.measureCompositeOutputQuality(Buffer.from("invalid png")))
  await assert.rejects(analysis.repairCompositeSeams(Buffer.from("invalid png"), []))
})

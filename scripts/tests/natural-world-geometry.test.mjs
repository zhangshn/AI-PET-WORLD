import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import * as geometry from '../lib/natural-world-geometry.mjs'
import { createNaturalWorldHydrology } from '../lib/natural-world-hydrology.mjs'
import { createNaturalWorldComposition } from '../lib/natural-world-composition.mjs'
import { createNaturalWorldGeometryNovelty } from '../lib/natural-world-geometry-novelty.mjs'
import crypto from 'node:crypto'
import { buildVariableWidthCorridorPolygons, NATURAL_WORLD_PRODUCER_FILES } from '../lib/natural-world-geospatial-generator.mjs'

test('geometry novelty detects reflected occupancy without losing object categories', () => {
  const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
  const metrics = createNaturalWorldGeometryNovelty({ width: 1024, height: 768, sha256 })
  assert.throws(() => createNaturalWorldGeometryNovelty({ width: 0, height: 768, sha256 }), /canvas and digest/u)
  assert.equal(metrics.maximumTransformedOccupancySimilarity([], []), 1)
  assert.equal(metrics.maximumTransformedOccupancySimilarity(['1,2'], []), 0)
  assert.equal(metrics.maximumTransformedOccupancySimilarity(['1,2', '2,2'], ['14,2', '13,2']), 1)
  assert.equal(metrics.maximumTransformedTaggedOccupancySimilarity(['tree:1,2'], ['rock:14,2']), 0)
  assert.equal(metrics.maximumTransformedTaggedOccupancySimilarity(['tree:1,2'], ['tree:14,2']), 1)
  assert.equal(metrics.canonicalTaggedOccupancyFingerprint(['tree:1,2', 'tree:1,2']), metrics.canonicalTaggedOccupancyFingerprint(['tree:14,2']))
  const shape = { pathCenterline: [{ x: 256, y: 192 }, { x: 512, y: 384 }, { x: 768, y: 192 }] }
  const before = structuredClone(shape)
  const reversed = { pathCenterline: [...shape.pathCenterline].reverse() }
  assert.deepEqual(metrics.buildTransformedSkeletonPayloads(shape).sort(), metrics.buildTransformedSkeletonPayloads(reversed).sort())
  metrics.geometrySkeletonPayload(shape)
  assert.deepEqual(shape, before)
})

test('geometry novelty is bound as a producer and cannot read history or write world state', () => {
  const file = 'scripts/lib/natural-world-geometry-novelty.mjs'
  assert.equal(NATURAL_WORLD_PRODUCER_FILES.filter(p => p === file).length, 1)
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  function visit(node) {
    if (ts.isImportDeclaration(node)) assert.equal(node.moduleSpecifier.text, './natural-world-geometry.mjs')
    if (ts.isCallExpression(node)) assert.ok(!['import', 'require', 'eval', 'Function'].includes(node.expression.getText(ast)))
    ts.forEachChild(node, visit)
  }
  visit(ast)
})

test('composition places measured objects outside forbidden regions and fails when no space is available', () => {
  const unused = () => { throw Error('unexpected composition dependency') }
  const context = { width: 1024, height: 768, naturalSources: {}, canonicalSha256: unused, currentPathBoundaryConnection: unused, irregularEllipsePolygon: unused, landscapeTypeToEcosystem: unused, assert: (ok, message) => { if (!ok) throw Error(message) } }
  assert.throws(() => createNaturalWorldComposition({}), /canvas and calculation dependencies/u)
  const composition = createNaturalWorldComposition(context)
  assert.equal(NATURAL_WORLD_PRODUCER_FILES.filter(p => p === 'scripts/lib/natural-world-composition.mjs').length, 1)
  const mask = geometry.rectanglePolygon(400, 100, 170, 500)
  const input = () => ({ conditionId: 'private-placement', random: geometry.mulberry32(17), forbiddenMasks: [mask], targetCount: 45 })
  const objects = composition.placeObjects(input())
  assert.deepEqual(composition.placeObjects(input()), objects)
  assert.equal(objects.length, 45)
  assert.equal(new Set(objects.map(o => o.objectId)).size, 45)
  for (const [index, object] of objects.entries()) {
    assert.equal(geometry.boundsTouchesPolygon(object.footprint, mask), false)
    assert.equal(object.blocksMovement, ['tree', 'rock'].includes(object.kind))
    for (const previous of objects.slice(0, index)) assert.equal(geometry.boundsOverlap(geometry.expandBounds(object.footprint, 12), previous.footprint), false)
  }
  assert.throws(() => composition.placeObjects({ ...input(), forbiddenMasks: [geometry.rectanglePolygon(0, 0, 1024, 768)] }), /unable to place required object footprints/u)
  assert.equal(composition.objectCountFromFacts({ measuredNaturalFacts: { landCoverAfterHumanRemoval: { classHistogram: { 10: 100, 20: 100 } } } }), 43)
})

test('composition computation cannot depend on orchestration, storage or runtime evidence', () => {
  const source = ts.createSourceFile('composition.mjs', fs.readFileSync('scripts/lib/natural-world-composition.mjs', 'utf8'), ts.ScriptTarget.Latest, true)
  function visit(node) {
    if (ts.isImportDeclaration(node)) assert.equal(node.moduleSpecifier.text, './natural-world-geometry.mjs')
    if (ts.isCallExpression(node)) {
      assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword)
      if (ts.isIdentifier(node.expression)) assert.notEqual(node.expression.text, 'require')
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
})

test('world generator retains its corridor export and binds the geometry source exactly once', () => {
  assert.equal(buildVariableWidthCorridorPolygons, geometry.buildVariableWidthCorridorPolygons)
  assert.equal(NATURAL_WORLD_PRODUCER_FILES.filter(p => p === 'scripts/lib/natural-world-geometry.mjs').length, 1)
  const source = ts.createSourceFile('geometry.mjs', fs.readFileSync('scripts/lib/natural-world-geometry.mjs', 'utf8'), ts.ScriptTarget.Latest, true)
  function visit(node) {
    assert(!ts.isImportDeclaration(node), 'geometry leaf must not import execution or storage modules')
    if (ts.isCallExpression(node)) {
      assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword)
      if (ts.isIdentifier(node.expression)) assert.notEqual(node.expression.text, 'require')
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
})

test('hydrology binds its source and requires explicit canvas and basin geometry', () => {
  assert.equal(NATURAL_WORLD_PRODUCER_FILES.filter(p => p === 'scripts/lib/natural-world-hydrology.mjs').length, 1)
  for (const input of [{}, { width: 0, height: 768, irregularEllipsePolygon() {} }, { width: 1024, height: Infinity, irregularEllipsePolygon() {} }, { width: 1024, height: 768 }]) {
    assert.throws(() => createNaturalWorldHydrology(input), /canvas and basin geometry/u)
  }
  const hydro = createNaturalWorldHydrology({ width: 1024, height: 768, irregularEllipsePolygon() { throw Error('unused basin calculation') } })
  assert.throws(() => hydro.buildMeasurementDerivedMonotonicAnabranch({ start: { x: 0, y: 100 }, end: { x: 0, y: 0 }, branchDirection: 1, pointCount: 49, branchHalfWidths: Array(49).fill(4) }), /inputs are invalid/u)
  const source = ts.createSourceFile('hydrology.mjs', fs.readFileSync('scripts/lib/natural-world-hydrology.mjs', 'utf8'), ts.ScriptTarget.Latest, true)
  const allowed = new Set(['./natural-world-geometry.mjs', './anonymous-water-naturalness.mjs', './measurement-derived-coarse-hydrology.mjs'])
  function visit(node) {
    if (ts.isImportDeclaration(node)) assert(allowed.has(node.moduleSpecifier.text), 'hydrology must not import orchestration or storage')
    if (ts.isCallExpression(node)) {
      assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword)
      if (ts.isIdentifier(node.expression)) assert.notEqual(node.expression.text, 'require')
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
})

test('corridor polygons remain bounded, connected along the segment and deterministic', () => {
  const points = [{ x: 0, y: 0 }, { x: 40, y: 30 }, { x: 100, y: 80 }]
  const polygons = geometry.buildVariableWidthCorridorPolygons(points, [4, 10, 5], 100, 80)
  assert.equal(polygons.length, 5)
  assert.deepEqual(polygons, geometry.buildVariableWidthCorridorPolygons(points, [4, 10, 5], 100, 80))
  assert(polygons.every(p => p.length >= 3 && p.every(v => v.x >= 0 && v.x <= 100 && v.y >= 0 && v.y <= 80)))
  assert(geometry.pointInPolygon({ x: 20, y: 15 }, polygons[3]))
  assert(geometry.pointInPolygon({ x: 70, y: 55 }, polygons[4]))
  assert.throws(() => geometry.buildVariableWidthCorridorPolygons([], [], 100, 80), /inputs are invalid/u)
  assert.throws(() => geometry.buildVariableWidthCorridorPolygons(points, [4], 100, 80), /inputs are invalid/u)
})

test('polygon intersections detect crossings without any contained vertices', () => {
  const horizontal = geometry.rectanglePolygon(0, 4, 10, 2)
  const vertical = geometry.rectanglePolygon(4, 0, 2, 10)
  assert(horizontal.every(p => !geometry.pointInPolygon(p, vertical)))
  assert(vertical.every(p => !geometry.pointInPolygon(p, horizontal)))
  assert.equal(geometry.polygonsOverlap(horizontal, vertical), true)
  assert.equal(geometry.boundsTouchesPolygon({ x: 0, y: 4, width: 10, height: 2 }, vertical), true)
  assert.equal(geometry.polygonsOverlap(horizontal, geometry.rectanglePolygon(20, 20, 2, 2)), false)
  assert.equal(geometry.boundsOverlap({ x: 0, y: 0, width: 4, height: 4 }, { x: 4, y: 0, width: 4, height: 4 }), false)
})

test('water occupancy and ribbon clipping preserve rejection and coordinate boundaries', () => {
  const polygon = geometry.rectanglePolygon(10, 20, 30, 40)
  assert.equal(geometry.minimumPolygonXAtY([polygon], 40), 10)
  assert.equal(geometry.minimumPolygonXAtY([polygon], 20), 10)
  assert.throws(() => geometry.minimumPolygonXAtY([polygon], 80), /no horizontal occupancy/u)
  const points = [{ x: 0, y: 0 }, { x: 20, y: 20 }]
  assert.deepEqual(geometry.ribbonPolygon(points, 5, 20, 20), geometry.ribbonPolygonVariable(points, [5, 5], 20, 20))
  assert(geometry.ribbonPolygon(points, 100, 20, 20).every(p => p.x >= 0 && p.x <= 20 && p.y >= 0 && p.y <= 20))
})

test('seeded sampling preserves the established sequence and consumes exactly one draw per operation', () => {
  const a = geometry.mulberry32(123), b = geometry.mulberry32(123)
  assert.deepEqual(Array.from({ length: 4 }, () => a()), [0.7872516233474016, 0.1785435655619949, 0.49531551403924823, 0.23136196262203157])
  assert.equal(geometry.randomInt(5, 15, b), Math.floor(5 + 0.7872516233474016 * 11))
  assert.equal(geometry.jitter(40, 8, b), Math.round(40 + (0.1785435655619949 * 2 - 1) * 8))
  assert.equal(b(), 0.49531551403924823)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function loadTs(file, resolve = () => { throw Error('unexpected runtime dependency') }) {
  const source = fs.readFileSync(file, 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const loaded = { exports: {} }
  new Function('require', 'module', 'exports', output)(resolve, loaded, loaded.exports)
  return loaded.exports
}
const policyPath = 'src/world/world-visual-painter/runtime-frame/approved-frame-display-policy.ts'
const identity = loadTs('src/world/runtime-core/source-fact-identity.ts')
const policy = loadTs(policyPath, id => {
  assert.equal(id, '../../runtime-core/source-fact-identity')
  return identity
})
const { buildWorldRuntimeFrameGate } = loadTs('src/world/world-visual-painter/runtime-frame/runtime-frame-gate.ts', id => {
  assert.equal(id, './approved-frame-display-policy')
  return policy
})

test('generation and review share source requirements without sharing mutable channel lists', () => {
  const {buildRequiredSourceChannelGroups} = loadTs('src/world/world-visual-painter/visual-target-policy/mvp-visual-target-policy.ts')
  const condition = {sceneCondition:{sceneType:'forest_construction_clearing'}}
  const groups = buildRequiredSourceChannelGroups(condition)
  assert.deepEqual(groups.map(group=>group.id), ['natural_ground','readable_path','construction_core','construction_materials'])
  const present = new Set(['grass','walkable','shelter_roof','construction_material'])
  assert(groups.every(group=>group.channels.some(channel=>present.has(channel))))
  present.delete('construction_material')
  assert.equal(groups.every(group=>group.channels.some(channel=>present.has(channel))), false)
  groups[0].channels.length = 0
  assert.deepEqual(buildRequiredSourceChannelGroups(condition)[0].channels, ['grass'])
  assert.deepEqual(buildRequiredSourceChannelGroups({sceneCondition:{sceneType:'natural_home'}}), [])
  for (const file of ['src/world/world-visual-painter/internal-image-model/internal-image-candidate-generator.ts','src/world/world-visual-painter/visual-review/visual-review-builder.ts']) {
    const ast = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true)
    assert.equal(ast.statements.some(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='buildRequiredSourceChannelGroups'), false)
    assert(ast.statements.some(node=>ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='../visual-target-policy'&&node.importClause.namedBindings.elements.some(element=>element.name.text==='buildRequiredSourceChannelGroups')))
  }
})

function fixture() {
  const approvedFrame = { worldId: 'private-world', tick: 3, sourceFactIds: ['fact-a', 'fact-b'], imageUrl: 'data:image/png;base64,cHJpdmF0ZQ==', canShowToPlayer: true, sourceImageSha256: 'a'.repeat(64), sourceImageByteLength: 7, sourceImageContentType: 'image/png', sourceImagePayloadQualityPassed: true, approvalScope: 'approved_for_game_world', productionApprovalStatus: 'not_approved_for_production', approvedForProduction: false, vj0Status: 'vj_0_passed', vj1Status: 'vj_1_passed', vj2Status: 'vj_2_passed', tags: ['game_world_ready_for_player', 'formal_full_world_frame'] }
  return { approvedFrame, reviewReport: { vj0Status: 'vj_0_passed', vj1Status: 'vj_1_passed', vj2Status: 'vj_2_passed', approvalScope: 'approved_for_game_world', productionApprovalStatus: 'not_approved_for_production', canShowToPlayer: false }, recordWorldId: 'private-world', recordTick: 3, recordSourceFactIds: ['fact-a', 'fact-b'], recordCanShowToPlayer: true, currentWorldId: 'private-world', currentTick: 3, currentSourceFactIds: ['fact-a', 'fact-b'], runtimeFrameReady: true, runtimeFrameId: 'private-frame' }
}

test('duplicated fact IDs cannot hide a missing current-world fact', () => {
  assert.equal(policy.sameStringSet, identity.sameSourceFactIds)
  assert.equal(policy.sameStringSet(['fact-a', 'fact-a'], ['fact-a', 'fact-b']), false)
  assert.equal(policy.sameStringSet(['fact-a', 'fact-b'], ['fact-a', 'fact-a']), false)
  assert.equal(policy.sameStringSet(['fact-b', 'fact-a'], ['fact-a', 'fact-b']), true)
  const input = fixture()
  input.recordSourceFactIds = ['fact-a', 'fact-a']
  input.approvedFrame.sourceFactIds = ['fact-a', 'fact-a']
  const gate = buildWorldRuntimeFrameGate(input)
  assert.equal(gate.currentSourceFactsMatched, false)
  assert.equal(gate.currentFrameSourceFactsMatched, false)
  assert.equal(gate.canRuntimeRender, false)
  assert(gate.blockedReasons.includes('current_source_facts_mismatch'))
})

test('world facts use one comparison across review, storage, binding and Runtime', () => {
  const files = [
    'src/app/api/world/visual/integrity/route.ts',
    'src/world/world-visual-painter/visual-review/visual-review-builder.ts',
    'src/world/world-visual-painter/ai-image-candidate/visual-candidate-store.ts',
    'src/world/world-visual-painter/approved-frame/approved-frame-store.ts',
    'src/world/world-visual-painter/approved-frame/approved-frame-builder.ts',
    'src/world/world-visual-painter/runtime-frame/runtime-frame-builder.ts',
    ...['game-map-approved-visual-unit-material-pack', 'game-map-composite-material-binding', 'game-map-frame-validator', 'game-map-runtime-frame-store', 'game-map-visual-judge', 'game-map-visual-layer-binding'].map(name => `src/world/game-map-frame/${name}.ts`),
  ]
  for (const file of files) {
    const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const imported = ast.statements.find(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text.endsWith('/source-fact-identity'))
    assert(imported, file)
    assert(imported.importClause.namedBindings.elements.some(n => n.propertyName?.text === 'sameSourceFactIds' && n.name.text === 'sameStringSet'))
    assert.equal(ast.statements.some(n => ts.isFunctionDeclaration(n) && n.name.text === 'sameStringSet'), false)
  }
})

test('shared display fields preserve review and candidate restrictions', () => {
  const { approvedFrame: frame } = fixture()
  assert.equal(policy.approvedFrameHardFieldsValid(frame), true)
  assert.equal(policy.approvedFrameGameWorldDisplayBoundaryPassed(frame), true)
  for (const patch of [{ canShowToPlayer: false }, { sourceImageSha256: '' }, { sourceImageByteLength: 0 }, { sourceImageContentType: 'text/html' }, { sourceImagePayloadQualityPassed: false }]) assert.equal(policy.approvedFrameHardFieldsValid({ ...frame, ...patch }), false)
  for (const patch of [{ approvalScope: 'not_approved' }, { approvedForProduction: true }, { vj0Status: 'vj_0_failed' }, { vj1Status: 'vj_1_failed' }, { vj2Status: 'vj_2_failed' }, { tags: [] }]) assert.equal(policy.approvedFrameGameWorldDisplayBoundaryPassed({ ...frame, ...patch }), false)
  for (const tag of ['training_candidate', 'partial_or_crop_candidate', 'controlled_mvp_player_visible_allowed']) assert.equal(policy.approvedFrameGameWorldDisplayBoundaryPassed({ ...frame, tags: [...frame.tags, tag] }), false)
})

test('Runtime retains its own data-image, world, tick, review and composed-frame checks', () => {
  assert.equal(buildWorldRuntimeFrameGate(fixture()).canRuntimeRender, true)
  for (const patch of [{ currentWorldId: 'wrong' }, { currentTick: 4 }, { runtimeFrameReady: false }, { reviewReport: null }]) assert.equal(buildWorldRuntimeFrameGate({ ...fixture(), ...patch }).canRuntimeRender, false)
  const input = fixture()
  input.approvedFrame.imageUrl = 'https://invalid.example/frame.png'
  assert.equal(policy.approvedFrameHardFieldsValid(input.approvedFrame), true)
  const gate = buildWorldRuntimeFrameGate(input)
  assert.equal(gate.hardFieldsValid, false)
  assert.equal(gate.canRuntimeRender, false)
  assert.equal(gate.productionDisplayAllowed, false)
})

test('both image APIs and Runtime consume the shared display and fact comparison policy', () => {
  for (const file of ['src/app/api/world/visual/approved/route.ts', 'src/app/api/world/visual/status/route.ts', 'src/world/world-visual-painter/runtime-frame/runtime-frame-gate.ts']) {
    const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const importNode = ast.statements.find(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text.endsWith('/approved-frame-display-policy'))
    assert(importNode, file)
    const imported = importNode.importClause.namedBindings.elements.map(n => n.propertyName?.text ?? n.name.text)
    for (const name of ['approvedFrameHardFieldsValid', 'approvedFrameGameWorldDisplayBoundaryPassed', 'sameStringSet']) assert(imported.includes(name), file + ': ' + name)
    assert.equal(ast.statements.some(n => ts.isFunctionDeclaration(n) && ['approvedFrameGameWorldDisplayBoundaryPassed', 'sameStringSet', 'isApprovedContentType'].includes(n.name.text)), false)
  }
})

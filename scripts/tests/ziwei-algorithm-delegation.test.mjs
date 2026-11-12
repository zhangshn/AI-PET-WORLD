import test from 'node:test'
import assert from 'node:assert/strict'
import { ESLint } from 'eslint'
import { createZiweiCheckRequire } from '../lib/ziwei-check-module-loader.mjs'

const require = createZiweiCheckRequire(import.meta.url)
const base = '../../src/ai/destiny-core/ziwei-core/'
const lunar = require(base + 'lunar.ts')
const engine = require(base + 'ziwei-engine.ts')
const birth = require(base + 'birth/time-branch-resolver.ts')
const foundation = require(base + 'natal-foundation/life-body-palace.ts')

test('page label compatibility shares canonical objects and dynamic stem source text',()=>{
  const shared=require(base+'shared/chart-labels.ts'),page=require(base+'page-view/labels.ts')
  assert.deepEqual(Object.keys(page).sort(),Object.keys(shared).sort())
  for(const key of Object.keys(shared))assert.strictEqual(page[key],shared[key])
  for(const [source,label] of [['birthYearStem','本命年干'],['currentYearStem','流年年干'],['currentMonthStem','流月月干'],['currentDayStem','流日日干'],['currentTimeStem','流时时干'],['dynamicPalaceStem','动态宫干'],['unknown','动态宫干']]){
    assert.equal(shared.getDynamicStemSourceLabel(source),label)
  }
})

test('Ziwei interpretation and shared layers reject imports from page implementations',async()=>{
  const eslint=new ESLint()
  for(const [filePath,source] of [
    ['src/ai/destiny-core/ziwei-core/interpretation/boundary-fixture.ts','../page-view/labels'],
    ['src/ai/destiny-core/ziwei-core/interpretation/content-details/boundary-fixture.ts','../../page-view/labels'],
    ['src/ai/destiny-core/ziwei-core/shared/boundary-fixture.ts','@/ai/destiny-core/ziwei-core/page-view/labels'],
  ]){
    const [result]=await eslint.lintText(`import '${source}'`,{filePath})
    assert(result.messages.some(message=>message.ruleId==='no-restricted-imports'))
  }
})

test('legacy time conversion exports the canonical birth rule with unchanged hourly boundaries', () => {
  assert.equal(lunar.getTimeBranchFromHour, birth.getTimeBranchFromHour)
  const expected = ['zi', 'chou', 'chou', 'yin', 'yin', 'mao', 'mao', 'chen', 'chen', 'si', 'si', 'wu', 'wu', 'wei', 'wei', 'shen', 'shen', 'you', 'you', 'xu', 'xu', 'hai', 'hai', 'zi']
  assert.deepEqual(expected.map((_, hour) => lunar.getTimeBranchFromHour(hour)), expected)
})

test('legacy life/body calculation exports the canonical foundation rule', () => {
  assert.equal(engine.calculateLifeAndBodyPalace, foundation.calculateLifeAndBodyPalace)
  for (const [month, hour, life, body] of [[1, 1, 'yin', 'yin'], [1, 12, 'mao', 'chou'], [12, 1, 'chou', 'chou'], [12, 12, 'yin', 'zi'], [6, 7, 'chou', 'chou']]) {
    const result = engine.calculateLifeAndBodyPalace(month, hour)
    assert.equal(result.lifePalace, life)
    assert.equal(result.bodyPalace, body)
  }
})

test('dynamic branch compatibility is distinct from strict shared branch validation', () => {
  const legacy = require(base + 'dynamic/branch-utils.ts')
  const strict = require(base + 'shared/branch-utils.ts')
  assert.equal(legacy.moveBranch('unknown', 1), 'unknown')
  assert.throws(() => strict.moveBranch('unknown', 1), /Unknown branch palace/u)
  for (const branch of ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai']) {
    for (const step of [-13, -1, 0, 1, 12, 13]) assert.equal(legacy.moveBranch(branch, step), strict.moveBranch(branch, step))
  }
})

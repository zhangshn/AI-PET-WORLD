import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { validateAiPainterDocumentState } from '../lib/ai-painter-document-governance-state.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SPEC = 'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'
const PLAN = 'docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md'
const CHECKER = 'scripts/check-ai-painter-document-governance.mjs'
const HEADER = '| 需求ID | 机器合同绑定 | 程序实现绑定 | 测试绑定 | 运行证据绑定 | 当前符合状态 |'
const STATUSES = ['document_defined_program_pending', 'partial_legacy_implementation_not_certified', 'machine_conformant', 'superseded']
const ids = Array.from({ length: 37 }, (_, index) => `AP-TEST-${String(index + 1).padStart(3, '0')}`)
const row = (id, status = STATUSES[0], bindings = ['合同引用', '程序引用', '正反测试引用', '运行证据引用']) =>
  `| \`${id}\` | ${bindings.join(' | ')} | \`${status}\` |`
const plan = (progress = '3/5（60%）') => `# AI-PET-WORLD 唯一模块计划表\n状态：active-module-plan\n本文是全项目唯一模块计划表，只保存模块状态。\n固定进度${progress}\n`
const fixture = (rows = ids.map(id => row(id))) => [
  '# 纯文档夹具', ...ids.map(id => `**${id}**：需求定义`),
  '### 17.2 37条稳定需求逐项追踪', HEADER, '|---|---|---|---|---|---|', ...rows,
  '### 17.3 程序适配缺口与验收责任', '| AP-TEST-001 | 此处是缺口引用，不是追踪行 |',
].join('\n')
const validate = (spec = fixture(), guide = plan()) => validateAiPainterDocumentState(spec, guide)

function assertNoCertification(result) {
  assert.equal(result.validationScope, 'normative_document_and_traceability_structure_only')
  for (const field of ['machineEvidenceVerified', 'programConformanceCertified', 'modelQualificationGranted', 'capabilityReleaseGranted', 'moduleProgressCertified']) {
    assert.equal(result[field], false, field)
  }
  assert.equal(Object.hasOwn(result, 'fixedAiPainterProgress'), false)
}

for (const status of STATUSES) {
  test(`all 37 rows may declare ${status} without document certification`, () => {
    const result = validate(fixture(ids.map(id => row(id, status))))
    assert.deepEqual(result.failures, [])
    assert.equal(result.documentedStatusCounts[status], 37)
    assertNoCertification(result)
  })
}

test('mixed statuses and CRLF preserve one-to-one traceability', () => {
  const result = validate(fixture(ids.map((id, index) => row(id, STATUSES[index % 4]))).replaceAll('\n', '\r\n'))
  assert.deepEqual(result.failures, [])
  assert.equal(Object.values(result.documentedStatusCounts).reduce((sum, count) => sum + count, 0), 37)
})

test('module progress is not a permanent document acceptance threshold', () => {
  for (const progress of ['3/5（60%）', '4/5（80%）', '5/5（100%）', '未取得新资格']) {
    const result = validate(fixture(), plan(progress))
    assert.deepEqual(result.failures, [])
    assertNoCertification(result)
  }
  assert.deepEqual(validate(fixture(), plan().replace(/固定进度[^\n]*\n/u, '')).failures, [])
})

test('inactive or nonexclusive plans still fail', () => {
  for (const guide of [plan().replace('active-module-plan', 'retired-module-plan'), plan().replace('唯一模块计划表', '实验记录'), plan().replace('本文是全项目唯一模块计划表', '本文是另一张计划表')]) {
    assert.ok(validate(fixture(), guide).failures.some(failure => failure.includes('module plan')))
  }
})

test('missing, duplicate and undefined requirement rows fail', () => {
  const cases = [ids.slice(1).map(id => row(id)), ids.map((id, index) => row(index === 1 ? ids[0] : id)), ids.map((id, index) => row(index === 1 ? 'AP-TEST-999' : id))]
  for (const rows of cases) assert.ok(validate(fixture(rows)).failures.length > 0)
})

test('missing definitions cannot be supplied by a later gap section', () => {
  const result = validate(fixture().replace('**AP-TEST-001**：需求定义\n', ''))
  assert.ok(result.failures.some(failure => failure.includes('formal requirement definitions')))
  assert.ok(result.failures.some(failure => failure.includes('no formal definition: AP-TEST-001')))
})

test('an out-of-section row cannot fill a missing traceability row', () => {
  const result = validate(fixture(ids.slice(1).map(id => row(id))) + '\n' + row(ids[0]))
  assert.ok(result.failures.some(failure => failure.includes('row missing: AP-TEST-001')))
})

test('unknown status and status with multiple tokens fail', () => {
  for (const status of ['released', 'verified=true', '', 'machine_conformant` `superseded']) {
    const rows = ids.map(id => row(id))
    rows[0] = row(ids[0], status)
    assert.ok(validate(fixture(rows)).failures.some(failure => failure.includes('invalid traceability status')))
  }
})

test('each binding column is mandatory for every allowed status', () => {
  for (const status of STATUSES) for (let index = 0; index < 4; index += 1) {
    const bindings = ['合同', '程序', '测试', '运行']
    bindings[index] = '  '
    const rows = ids.map(id => row(id))
    rows[0] = row(ids[0], status, bindings)
    assert.ok(validate(fixture(rows)).failures.some(failure => failure.includes('empty')))
  }
})

test('extra/missing columns, delimiters, headings and table headers fail', () => {
  for (const spec of [
    fixture().replace(row(ids[0]), row(ids[0]).replace('程序引用', '程序 | 多余列')),
    fixture().replace(row(ids[0]), row(ids[0]).slice(0, -1)),
    fixture().replace(row(ids[0]), `| \`${ids[0]}\` | 合同 | 程序 | 测试 | \`machine_conformant\` |`),
    fixture().replace(HEADER, HEADER.replace('运行证据绑定', '聊天结论')),
    fixture().replace('### 17.2 37条稳定需求逐项追踪', '### 缺失追踪'),
    fixture() + '\n### 17.2 37条稳定需求逐项追踪\n',
  ]) assert.ok(validate(spec).failures.length > 0)
})

test('SHA strings, chat and verified flags cannot become certification via this validator', () => {
  // Deliberately untrusted text: only its column structure is checked. A
  // machine evidence consumer must authenticate it before any qualification.
  const spec = fixture(ids.map(id => row(id, 'machine_conformant', ['verified=true', 'Owner聊天自报通过', 'a'.repeat(64), '历史成功声明'])))
  const result = validate(spec)
  assert.deepEqual(result.failures, [])
  assertNoCertification(result)
  assert.equal(validate(spec).documentedStatusCounts.machine_conformant, 37)
})

test('current formal traceability remains structurally valid without altering its declarations', () => {
  const spec = fs.readFileSync(path.join(ROOT, SPEC), 'utf8')
  const guide = fs.readFileSync(path.join(ROOT, PLAN), 'utf8')
  const result = validate(spec, guide)
  assert.deepEqual(result.failures, [])
  assertNoCertification(result)
})

function checkerFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-painter-document-state-'))
  t.after(() => {
    const resolved = fs.realpathSync(directory)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(resolved).startsWith('ai-painter-document-state-'))
    fs.rmSync(resolved, { recursive: true, force: true })
  })
  const source = fs.readFileSync(path.join(ROOT, CHECKER), 'utf8')
  // Copy the checker's explicit static inputs and byte-preserved historical
  // contracts. No runtime records, training data or model files are fabricated.
  const files = new Set([...source.matchAll(/"((?:docs\/|data\/|AGENTS\.md|README\.md|package\.json|\.gitattributes)[^"]*)"/g)].map(match => match[1]))
  const supersession = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ai-painter/system-governance/contract-supersession-index-v2.json'), 'utf8'))
  for (const entry of supersession.supersessions) files.add(entry.historicalPath)
  for (const file of [CHECKER, 'scripts/lib/ai-painter-document-governance-state.mjs', 'scripts/lib/unique-module-plan-contract.mjs', ...files]) {
    const target = path.join(directory, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(ROOT, file), target)
  }
  return directory
}

test('actual CLI accepts a future conformant declaration and changed progress, without certifying either', t => {
  const directory = checkerFixture(t)
  const specPath = path.join(directory, SPEC)
  fs.writeFileSync(specPath, fs.readFileSync(specPath, 'utf8').replace(/(\| `AP-[A-Z]+-\d{3}` \|[^\n]+\| )`(?:document_defined_program_pending|partial_legacy_implementation_not_certified)`( \|)/g, '$1`machine_conformant`$2'))
  const planPath = path.join(directory, PLAN)
  fs.writeFileSync(planPath, fs.readFileSync(planPath, 'utf8').replaceAll('3/5', '4/5').replaceAll('60%', '80%'))
  const result = spawnSync(process.execPath, [CHECKER], { cwd: directory, encoding: 'utf8', timeout: 30_000, windowsHide: true })
  assert.equal(result.status, 0, result.stderr)
  const summary = JSON.parse(result.stdout)
  assert.equal(summary.documentedStatusCounts.machine_conformant, 37)
  assert.equal(summary.currentMachineContractAdoption, 'not_evaluated_by_document_check')
  assertNoCertification(summary)
  assert.equal(fs.existsSync(path.join(directory, '.runtime')), false)
})

test('actual CLI rejects removal of the machine evidence and chat boundary', t => {
  for (const boundary of [
    '只有机器合同、程序实现、正反测试和本地运行证据四层同时存在且身份一致时',
    '文档检查通过本身不能提升程序符合状态',
    'Owner签名、聊天、调用方布尔字段、页面身份、外部智能体记忆和历史授权包都不是发布条件或发布证明',
  ]) {
    const directory = checkerFixture(t)
    const specPath = path.join(directory, SPEC)
    fs.writeFileSync(specPath, fs.readFileSync(specPath, 'utf8').replaceAll(boundary, '聊天可认证机器能力'))
    const result = spawnSync(process.execPath, [CHECKER], { cwd: directory, encoding: 'utf8', timeout: 30_000, windowsHide: true })
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /missing required text/u)
    assert.equal(result.stdout, '')
  }
})

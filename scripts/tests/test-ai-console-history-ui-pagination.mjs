import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'

// Exercise the real component's state, effects and click handlers without a
// desktop browser. This does not claim DOM, image decoding or browser coverage.
function harness() {
  const source = readFileSync(new URL('../../src/app/ai-console/ai-console-training-history.tsx', import.meta.url), 'utf8')
  const slots = [], effects = [], requests = []
  let position = 0, poll, tree
  const hooks = {
    useState(initial) {
      const index = position++
      if (!slots[index]) slots[index] = { value: initial }
      return [slots[index].value, value => { slots[index].value = value }]
    },
    useRef() { const index = position++; return slots[index] ??= { current: null } },
    useEffect(callback, deps) {
      const index = position++, prior = slots[index]
      if (!prior || deps.some((value, i) => value !== prior.deps[i])) {
        prior?.cleanup?.()
        slots[index] = { deps }
        effects.push(() => { slots[index].cleanup = callback() })
      }
    },
  }
  const row = { runId: 'ui-run', runKind: 'learning_capacity', terminalStatus: 'completed', sourceRevision: 1, finishedAtUtc: null }
  const original = { artifactId: 'first-image', role: 'original', url: '/image', logicalPath: 'data/image.png', sha256: 'a'.repeat(64) }
  const extra = { ...original, artifactId: 'unpaged-image' }
  const listing = { schemaVersion: 'ai_console_training_history_v1', dataStatus: 'partial', reasonCode: 'history_snapshot_missing', records: [row], nextCursor: null, total: null }
  const detail = { schemaVersion: 'ai_console_training_run_detail_v1', dataStatus: 'partial', reasonCode: 'history_snapshot_missing', record: { ...row, artifacts: [original, extra], events: [], metrics: [{ fullOnly: true }] } }
  let page = { schemaVersion: detail.schemaVersion, dataStatus: 'partial', reasonCode: 'history_snapshot_missing', record: row, section: 'artifacts', items: [original], nextCursor: 'opaque-next', knownItemCount: 2, total: null }
  const exports = {}
  const jsx = (type, props) => ({ type, props })
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, {
    exports, Date, TextEncoder, TextDecoder, AbortController,
    require(name) {
      if (name === 'react') return hooks
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
      if (name.includes('history-poll')) return { startHistoryPolling(run, failed) { poll = { run, failed }; return () => {} } }
      return { default: {} }
    },
    async fetch(url) {
      requests.push(url)
      const data = url.includes('section=') ? page : url.includes('/ui-run') ? detail : listing
      return { ok: data.reasonCode !== 'history_cursor_revision_conflict', status: data.reasonCode === 'history_cursor_revision_conflict' ? 409 : 200, json: async () => data }
    },
  })
  function render() { position = 0; tree = exports.AiConsoleTrainingHistory(); effects.splice(0).forEach(run => run()); return tree }
  function descendants(node) {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(descendants)
    return [node, ...descendants(node.props?.children)]
  }
  function nodes() { return descendants(tree) }
  function button(label) { return nodes().find(node => node.type === 'button' && (node.props.children === label || node.props.children?.[1]?.props?.children === label)) }
  render()
  return { render, nodes, button, requests, detail, listing, row,
    setPage(value) { page = value }, getPage() { return page },
    async tick(signal = new AbortController().signal) { await poll.run(signal); render() },
    disconnect() { poll.failed(new Error('test_disconnect')); render() } }
}

test('actual UI handlers load only the artifact page and keep selection after refresh and disconnect', async () => {
  const ui = harness()
  await ui.tick()
  ui.button('ui-run').props.onClick()
  ui.render(); await ui.tick()
  const images = ui.nodes().filter(node => typeof node.type === 'function' && node.type.name === 'EvidenceImage')
  assert.equal(images.length, 1)
  assert.equal(images[0].props.item.artifactId, 'first-image')
  ui.disconnect()
  assert.ok(ui.nodes().some(node => node.props?.['aria-label'] === '选中Run详情'))
  ui.listing.records = [] // Selection survives disappearance from a refreshed list page.
  await ui.tick()
  assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === 'ui-run'))
})

test('actual section pagination sends the opaque cursor and recovers revision conflict without losing Run', async () => {
  const ui = harness()
  await ui.tick(); ui.button('ui-run').props.onClick(); ui.render(); await ui.tick()
  ui.button('本节下一页').props.onClick(); ui.render()
  ui.setPage({ ...ui.getPage(), reasonCode: 'history_cursor_revision_conflict' })
  await ui.tick()
  assert.ok(ui.requests.at(-1).includes('cursor=opaque-next'))
  assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === 'ui-run'))
  ui.setPage({ ...ui.getPage(), reasonCode: 'history_snapshot_missing' }); await ui.tick()
  assert.ok(!ui.requests.at(-1).includes('cursor='))
})

test('actual section switch resets its cursor and requests metrics rather than rendering full-detail metrics', async () => {
  const ui = harness()
  await ui.tick(); ui.button('ui-run').props.onClick(); ui.render(); await ui.tick()
  ui.button('指标与观测').props.onClick(); ui.render()
  ui.setPage({ ...ui.getPage(), section: 'metrics', items: [{ pagedOnly: true }], nextCursor: null })
  await ui.tick()
  assert.ok(ui.requests.at(-1).includes('section=metrics&limit=20'))
  const component = ui.nodes().find(node => typeof node.type === 'function' && node.type.name === 'MetricSummary')
  assert.equal(component.props.metrics[0].pagedOnly, true)
  assert.equal(component.props.metrics[0].fullOnly, undefined)
})

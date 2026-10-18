import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'

// Exercise the real component's state, effects and click handlers without a
// desktop browser. This does not claim DOM, image decoding or browser coverage.
function harness(initialUrl = null, { hydrating = false } = {}) {
  const source = readFileSync(new URL('../../src/app/ai-console/ai-console-training-history.tsx', import.meta.url), 'utf8')
  const slots = [], effects = [], requests = [], failures = new Map(), deferred = new Map()
  let position = 0, poll, tree, inEffect = false, useServerSnapshot = hydrating
  const hooks = {
    useState(initial) {
      const index = position++
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, value => {
        assert.equal(inEffect, false, 'URL restoration must not synchronously set state in an Effect')
        slots[index].value = typeof value === 'function' ? value(slots[index].value) : value
      }]
    },
    useRef() { const index = position++; return slots[index] ??= { current: null } },
    useSyncExternalStore(_subscribe, getSnapshot, getServerSnapshot) {
      position++
      return useServerSnapshot || !browser ? getServerSnapshot() : getSnapshot()
    },
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
  const browser = initialUrl ? { location: { href: initialUrl }, history: { state: null, replaceState(_state, _title, url) { browser.location.href = url } } } : undefined
  vm.runInNewContext(compiled, {
    exports, Date, TextEncoder, TextDecoder, AbortController, URL, window: browser,
    require(name) {
      if (name === 'react') return hooks
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
      if (name.includes('history-poll')) return { startHistoryPolling(run, failed) {
        const queries = typeof run === 'function' ? [{ run, failed }] : run
        poll = { async run(signal) { for (const query of queries) { if (signal.aborted) break; try { await query.run(signal) } catch (error) { if (!signal.aborted) query.failed(error) } } }, failed(error) { queries.forEach(query => query.failed(error)) } }
        return () => {}
      } }
      return { default: {} }
    },
    async fetch(url) {
      requests.push(url)
      const kind = url.includes('section=') ? 'section' : url.split('?')[0] === '/api/ai-console/training/history' ? 'list' : 'detail'
      if (deferred.has(kind)) await deferred.get(kind)
      if (failures.has(kind)) throw failures.get(kind)
      const data = url.includes('section=') ? page : url.split('?')[0] === `/api/ai-console/training/history/${encodeURIComponent(detail.record.recordId ?? detail.record.runId)}` ? detail : listing
      return { ok: data.reasonCode !== 'history_cursor_revision_conflict', status: data.reasonCode === 'history_cursor_revision_conflict' ? 409 : 200, json: async () => data }
    },
  })
  function render() {
    position = 0; tree = exports.AiConsoleTrainingHistory()
    for (const run of effects.splice(0)) {
      inEffect = true
      try { run() } finally { inEffect = false }
    }
    return tree
  }
  function descendants(node) {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(descendants)
    return [node, ...descendants(node.props?.children)]
  }
  function nodes() { return descendants(tree) }
  function button(label) { return nodes().find(node => node.type === 'button' && (node.props.children === label || node.props.children?.[1]?.props?.children === label)) }
  render()
  return { render, nodes, button, requests, detail, listing, row, browser,
    finishHydration() { useServerSnapshot = false; render() },
    setPage(value) { page = value }, getPage() { return page },
    fail(kind, error = new Error(`test_${kind}_disconnect`)) { failures.set(kind, error) }, recover(kind) { failures.delete(kind) },
    defer(kind) { let release; deferred.set(kind, new Promise(resolve => { release = resolve })); return () => { deferred.delete(kind); release() } },
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
  assert.ok(ui.requests.filter(url => url.includes('section=')).at(-1).includes('cursor=opaque-next'))
  assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === 'ui-run'))
  ui.setPage({ ...ui.getPage(), reasonCode: 'history_snapshot_missing' }); await ui.tick()
  assert.ok(!ui.requests.filter(url => url.includes('section=')).at(-1).includes('cursor='))
})

test('actual section switch resets its cursor and requests metrics rather than rendering full-detail metrics', async () => {
  const ui = harness()
  await ui.tick(); ui.button('ui-run').props.onClick(); ui.render(); await ui.tick()
  ui.button('指标与观测').props.onClick(); ui.render()
  ui.setPage({ ...ui.getPage(), section: 'metrics', items: [{ pagedOnly: true }], nextCursor: null })
  await ui.tick()
  assert.ok(ui.requests.filter(url => url.includes('section=')).at(-1).includes('section=metrics&limit=20'))
  const component = ui.nodes().find(node => typeof node.type === 'function' && node.type.name === 'MetricSummary')
  assert.equal(component.props.metrics[0].pagedOnly, true)
  assert.equal(component.props.metrics[0].fullOnly, undefined)
})

test('exact Run lookup uses the existing detail API even outside the listing page', async () => {
  const ui = harness()
  await ui.tick()
  ui.listing.records = []; ui.render()
  const input = ui.nodes().find(node => node.type === 'input')
  input.props.onChange({ target: { value: ' ui-run ' } }); ui.render()
  let prevented = false
  ui.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() { prevented = true } })
  ui.render(); await ui.tick()
  assert.equal(prevented, true)
  assert.ok(ui.requests.includes('/api/ai-console/training/history/ui-run'))
  assert.ok(ui.requests.includes('/api/ai-console/training/history/ui-run?section=artifacts&limit=20'))
  assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === 'ui-run'))
  const nodes = ui.nodes()
  assert.ok(nodes.findIndex(node => node.type?.name === 'EvidenceImage') < nodes.findIndex(node => node.type?.name === 'TrainingArtifactStatus'))
  assert.equal(nodes.filter(node => node.type?.name === 'EvidenceImage').length, 1)
})

test('invalid Run lookup cannot become a path query or reset a selected Run', async () => {
  const ui = harness()
  await ui.tick(); ui.button('ui-run').props.onClick(); ui.render(); await ui.tick()
  for (const value of ['../outside', 'bad/path', 'bad?query=1', 'x'.repeat(193), '']) {
    ui.nodes().find(node => node.type === 'input').props.onChange({ target: { value } }); ui.render()
    assert.equal(ui.button('查看该Run图像与证据').props.disabled, true)
    ui.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); ui.render()
    assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === 'ui-run'))
  }
  assert.ok(ui.requests.every(url => !url.includes('outside') && !url.includes('bad')))
})

test('browser refresh restores only exact historical selection via a read-only page URL', async () => {
  const ui = harness('http://localhost:3000/ai-console/training/runs?view=history&run=ui-run')
  ui.render(); await ui.tick()
  assert.ok(ui.requests.includes('/api/ai-console/training/history/ui-run'))
  assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === 'ui-run'))
  assert.equal(new URL(ui.browser.location.href).searchParams.get('view'), 'history')
  assert.equal(new URL(ui.browser.location.href).searchParams.get('run'), 'ui-run')
  assert.ok(ui.requests.every(url => url.startsWith('/api/ai-console/training/history')))
  const invalid = harness('http://localhost:3000/ai-console/training/runs?run=..%2Foutside')
  invalid.render(); await invalid.tick()
  assert.equal(invalid.nodes().some(node => node.props?.['aria-label'] === '选中Run详情'), false)
  assert.ok(invalid.requests.every(url => !url.includes('outside')))
})

test('server and simulated hydration snapshots agree before restoring the browser deep link', async () => {
  const url = 'http://localhost:3000/ai-console/training/runs?view=history&run=ui-run#evidence'
  const server = harness()
  const ui = harness(url, { hydrating: true })
  assert.equal(ui.nodes().find(node => node.type === 'input').props.value, '')
  assert.equal(ui.nodes().some(node => node.props?.['aria-label'] === '选中Run详情'), false)
  assert.deepEqual(JSON.parse(JSON.stringify(ui.render())), JSON.parse(JSON.stringify(server.render())))
  assert.equal(ui.browser.location.href, url, 'hydration must not erase the deep link')
  ui.finishHydration(); await ui.tick()
  assert.equal(ui.nodes().find(node => node.type === 'input').props.value, 'ui-run')
  assert.ok(ui.requests.includes('/api/ai-console/training/history/ui-run'))
  assert.equal(new URL(ui.browser.location.href).hash, '#evidence')
  ui.disconnect()
  assert.ok(ui.nodes().some(node => node.props?.['aria-label'] === '选中Run详情'))
  await ui.tick()
  assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === 'ui-run'))
})

test('manual selection replaces the restored Run and reload keeps the new identity independently of the list', async () => {
  const ui = harness('http://localhost:3000/ai-console/archive/training?view=images&run=ui-run#details')
  await ui.tick()
  const identity = 'fixture-run.v2'
  ui.listing.records = [{ ...ui.row, runId: identity }]
  ui.detail.record.runId = identity
  ui.setPage({ ...ui.getPage(), record: { ...ui.row, runId: identity } })
  ui.render(); ui.button(identity).props.onClick(); ui.render(); await ui.tick()
  assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === identity))
  assert.ok(ui.requests.includes(`/api/ai-console/training/history/${identity}`))
  const url = new URL(ui.browser.location.href)
  assert.equal(url.searchParams.get('run'), identity)
  assert.equal(url.searchParams.get('view'), 'images')
  assert.equal(url.hash, '#details')
  const reloaded = harness(url.toString())
  reloaded.listing.records = []
  reloaded.detail.record.runId = identity
  reloaded.setPage({ ...reloaded.getPage(), record: { ...reloaded.row, runId: identity } })
  await reloaded.tick()
  assert.equal(reloaded.nodes().find(node => node.type === 'input').props.value, identity)
  assert.ok(reloaded.nodes().some(node => node.type === 'code' && node.props.children === identity))
  assert.ok(reloaded.requests.every(request => request.startsWith('/api/ai-console/training/history')))
})

function previewMessage(ui) {
  const node = ui.nodes().find(node => node.type?.name === 'TrainingPreviewCoverage')
  return JSON.stringify(node.type(node.props))
}

test('list failure does not gate a deep-linked Run detail or its content; content gets the first request slot', async () => {
  const ui = harness('http://localhost:3000/ai-console/training/runs?run=ui-run')
  ui.fail('list')
  await ui.tick()
  assert.ok(ui.requests[0].includes('section=artifacts'))
  assert.ok(ui.requests.includes('/api/ai-console/training/history/ui-run'))
  assert.equal(ui.nodes().filter(node => node.type?.name === 'EvidenceImage').length, 1)
  assert.ok(ui.nodes().some(node => node.type?.name === 'TrainingArtifactStatus'))
  assert.match(JSON.stringify(ui.nodes()), /test_list_disconnect/)
  assert.doesNotMatch(JSON.stringify(ui.nodes()), /详情元数据为上次成功快照/)
  ui.recover('list'); await ui.tick()
  assert.doesNotMatch(JSON.stringify(ui.nodes()), /test_list_disconnect/)
  assert.equal(new URL(ui.browser.location.href).searchParams.get('run'), 'ui-run')
})

test('missing detail leaves content queryable and never calls preview absence a current fact', async () => {
  const ui = harness('http://localhost:3000/ai-console/training/runs?run=ui-run')
  ui.detail.record.detailCoverage = { trainingPreview: { status: 'not_recorded' } }
  ui.fail('detail')
  assert.match(previewMessage(ui), /详情未取得或已过期/)
  await ui.tick()
  assert.equal(ui.nodes().filter(node => node.type?.name === 'EvidenceImage').length, 1)
  assert.ok(ui.nodes().some(node => node.props?.['aria-label'] === '详情内容分区'))
  assert.equal(ui.nodes().some(node => node.type?.name === 'TrainingArtifactStatus'), false)
  assert.match(previewMessage(ui), /登记状态待重新核验/)
  assert.doesNotMatch(previewMessage(ui), /未登记训练预览/)
  ui.recover('detail'); await ui.tick()
  assert.match(previewMessage(ui), /未登记训练预览/)
})

test('a stale detail snapshot cannot overwrite new content or assert preview not-recorded until detail recovers', async () => {
  const ui = harness('http://localhost:3000/ai-console/training/runs?run=ui-run')
  ui.detail.record.detailCoverage = { trainingPreview: { status: 'not_recorded' } }
  await ui.tick()
  ui.fail('detail')
  ui.setPage({ ...ui.getPage(), items: [{ ...ui.getPage().items[0], artifactId: 'new-preview', role: 'image', evidenceKind: 'training_diagnostic_preview' }] })
  await ui.tick()
  assert.match(previewMessage(ui), /登记状态待重新核验/)
  assert.doesNotMatch(previewMessage(ui), /未登记训练预览/)
  assert.equal(ui.nodes().find(node => node.type?.name === 'EvidenceImage').props.item.artifactId, 'new-preview')
  assert.match(JSON.stringify(ui.nodes()), /详情元数据为上次成功快照，已过期/)
  assert.doesNotMatch(JSON.stringify(ui.nodes()), /本节保留上次成功内容/)
  ui.detail.record.detailCoverage.trainingPreview.status = 'available'
  ui.recover('detail'); await ui.tick()
  assert.match(previewMessage(ui), /已核验绑定的训练诊断预览/)
  assert.doesNotMatch(JSON.stringify(ui.nodes()), /test_detail_disconnect/)
})

test('content failure reports an unavailable or stale page without invalidating successful detail or list', async () => {
  const ui = harness('http://localhost:3000/ai-console/training/runs?run=ui-run')
  ui.fail('section'); await ui.tick()
  assert.match(JSON.stringify(ui.nodes()), /内容页未取得；将在下一轮自动重试/)
  assert.equal(ui.nodes().filter(node => node.type?.name === 'EvidenceImage').length, 0)
  assert.ok(ui.nodes().some(node => node.type?.name === 'TrainingArtifactStatus'))
  ui.recover('section'); await ui.tick()
  assert.equal(ui.nodes().filter(node => node.type?.name === 'EvidenceImage').length, 1)
  ui.fail('section'); await ui.tick()
  assert.match(JSON.stringify(ui.nodes()), /本节保留上次成功内容，已过期/)
  assert.equal(ui.nodes().filter(node => node.type?.name === 'EvidenceImage').length, 1)
  ui.recover('section'); await ui.tick()
  assert.doesNotMatch(JSON.stringify(ui.nodes()), /test_section_disconnect/)
})

test('list revision conflicts cannot prevent the selected Run from refreshing content', async () => {
  const ui = harness('http://localhost:3000/ai-console/training/runs?run=ui-run')
  ui.listing.reasonCode = 'history_cursor_revision_conflict'
  await ui.tick()
  assert.equal(ui.nodes().filter(node => node.type?.name === 'EvidenceImage').length, 1)
  assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === 'ui-run'))
  ui.listing.reasonCode = 'history_snapshot_missing'; await ui.tick()
  assert.doesNotMatch(JSON.stringify(ui.nodes()), /登记已更新，正在刷新首页/)
})

test('unknown-or-stale detail cannot display a fresh not-recorded preview even on HTTP 200', async () => {
  const ui = harness('http://localhost:3000/ai-console/training/runs?run=ui-run')
  ui.detail.dataStatus = 'unknown_or_stale'
  ui.detail.record.detailCoverage = { trainingPreview: { status: 'not_recorded' } }
  await ui.tick()
  assert.match(previewMessage(ui), /登记状态待重新核验/)
  assert.doesNotMatch(previewMessage(ui), /未登记训练预览/)
})

test('a URL identity change hides the old detail and content immediately, before another request completes', async () => {
  const ui = harness('http://localhost:3000/ai-console/training/runs?run=ui-run')
  await ui.tick()
  ui.browser.location.href = 'http://localhost:3000/ai-console/training/runs?run=other-run'
  ui.render()
  assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === 'other-run'))
  assert.equal(ui.nodes().filter(node => node.type?.name === 'EvidenceImage').length, 0)
  assert.equal(ui.nodes().some(node => node.type?.name === 'TrainingArtifactStatus'), false)
  assert.match(previewMessage(ui), /详情未取得或已过期/)
})

test('content publishes before a slow detail completes, and cancelled old responses cannot replace a new Run', async () => {
  const ui = harness('http://localhost:3000/ai-console/training/runs?run=ui-run')
  const release = ui.defer('detail'), controller = new AbortController()
  const pending = ui.tick(controller.signal)
  for (let i = 0; i < 10; i++) await Promise.resolve()
  ui.render()
  assert.equal(ui.nodes().filter(node => node.type?.name === 'EvidenceImage').length, 1)
  assert.equal(ui.nodes().some(node => node.type?.name === 'TrainingArtifactStatus'), false)
  assert.match(previewMessage(ui), /登记状态待重新核验/)
  controller.abort()
  ui.browser.location.href = 'http://localhost:3000/ai-console/training/runs?run=other-run'
  ui.render(); release(); await pending
  assert.ok(ui.nodes().some(node => node.type === 'code' && node.props.children === 'other-run'))
  assert.equal(ui.nodes().filter(node => node.type?.name === 'EvidenceImage').length, 0)
  assert.equal(ui.nodes().some(node => node.type?.name === 'TrainingArtifactStatus'), false)
  assert.equal(ui.requests.some(url => url === '/api/ai-console/training/history?limit=20'), false, 'cancelled cycle must skip the remaining list request')
})

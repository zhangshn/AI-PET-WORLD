// The history indexer is a bounded, separate observation writer. API GETs never
// start scans or mutate its state. The global guard avoids duplicate dev reloads.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const scope = globalThis as typeof globalThis & { __aiConsoleHistoryIndexerStarted?: boolean }
  if (scope.__aiConsoleHistoryIndexerStarted) return
  // Next also compiles instrumentation for Edge. The indexer is Node-only and
  // must stay outside that module graph, while still starting in Node runtime.
  const cwd = process.cwd().replaceAll('\\', '/')
  const indexerUrl = `${cwd.startsWith('/') ? 'file://' : 'file:///'}${cwd}/src/server/ai-console/training-history-evidence-index.mjs`
  const { scanHistoryEvidence } = await import(/* webpackIgnore: true */ indexerUrl)
  scope.__aiConsoleHistoryIndexerStarted = true
  let busy = false
  const scan = async () => {
    if (busy) return
    busy = true
    try { await scanHistoryEvidence({ root: process.env.AI_CONSOLE_HISTORY_ROOT || process.cwd() }) }
    catch (error) { console.error('ai_console_history_index_scan_failed', error) }
    finally { busy = false }
  }
  void scan()
  const timer = setInterval(() => { void scan() }, 5000)
  timer.unref()
}

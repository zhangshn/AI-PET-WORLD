type HistoryQuery = { run: (signal: AbortSignal) => Promise<void>; failed: (error: unknown) => void }

// One HTTP request at a time. Each query owns its full deadline (including body
// reads); a failed list/detail cannot consume or skip another query's budget.
// The function form remains compatible with existing single-request callers.
export function startHistoryPolling(run: ((signal: AbortSignal) => Promise<void>) | readonly HistoryQuery[], failed: (error: unknown) => void = () => {}, interval = 2000, timeout = 10000) {
  const queries = typeof run === 'function' ? [{ run, failed }] : run
  let stopped = false
  let controller: AbortController | null = null
  let next: ReturnType<typeof setTimeout> | undefined
  const tick = async () => {
    if (stopped || controller) return
    controller = new AbortController()
    const active = controller
    try {
      for (const query of queries) {
        if (active.signal.aborted) break
        const request = new AbortController()
        const cancel = () => request.abort(active.signal.reason)
        active.signal.addEventListener('abort', cancel, { once: true })
        const deadline = setTimeout(() => request.abort(new Error('history_request_timeout')), timeout)
        try {
          await query.run(request.signal)
          if (request.signal.aborted) throw request.signal.reason
        } catch (error) { if (!stopped) query.failed(error) }
        finally { clearTimeout(deadline); active.signal.removeEventListener('abort', cancel) }
      }
    } finally { controller = null; if (!stopped) next = setTimeout(tick, interval) }
  }
  void tick()
  return () => { stopped = true; if (next) clearTimeout(next); controller?.abort() }
}

// One request chain in flight, including timeout/abort; no retry storm on failure.
export function startHistoryPolling(run: (signal: AbortSignal) => Promise<void>, failed: (error: unknown) => void, interval = 2000, timeout = 10000) {
  let stopped = false
  let controller: AbortController | null = null
  let next: ReturnType<typeof setTimeout> | undefined
  const tick = async () => {
    if (stopped || controller) return
    controller = new AbortController()
    const active = controller
    const deadline = setTimeout(() => active.abort(new Error('history_request_timeout')), timeout)
    try { await run(active.signal) } catch (error) { if (!stopped) failed(error) }
    finally { clearTimeout(deadline); controller = null; if (!stopped) next = setTimeout(tick, interval) }
  }
  void tick()
  return () => { stopped = true; if (next) clearTimeout(next); controller?.abort() }
}

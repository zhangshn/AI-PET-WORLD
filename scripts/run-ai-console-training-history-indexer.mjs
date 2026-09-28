import { scanHistoryEvidence } from '../src/server/ai-console/training-history-evidence-index.mjs'

const once = process.argv.includes('--once')
const root = process.env.AI_CONSOLE_HISTORY_ROOT || process.cwd()
async function tick() {
  try { process.stdout.write(`${JSON.stringify({ atUtc: new Date().toISOString(), ...(await scanHistoryEvidence({ root })) })}\n`) }
  catch (error) { process.stderr.write(`${JSON.stringify({ atUtc: new Date().toISOString(), errorCode: error?.message || 'history_index_scan_failed' })}\n`) }
}
await tick()
if (!once) {
  const timer = setInterval(() => { void tick() }, 5000)
  process.once('SIGINT', () => { clearInterval(timer); process.exitCode = 0 })
  process.once('SIGTERM', () => { clearInterval(timer); process.exitCode = 0 })
}

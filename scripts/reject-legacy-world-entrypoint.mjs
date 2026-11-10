// Compatibility names are retained so old callers receive a precise refusal.
// Historical writers must not compete for current pointers or launch models.
const entries = new Set([
  'run:current-world-visual-inference',
  'run:current-world-bootstrap-inference',
  'run:current-world-foundation-bootstrap-inference',
])
const requested = process.argv[2]
console.error(JSON.stringify({
  status: 'historical_entrypoint_not_dispatchable',
  entrypoint: entries.has(requested) ? requested : null,
  reason: 'This historical inference path is not registered for current autonomous execution. Original source and evidence are retained for isolated historical reproduction.',
  currentRegistry: 'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json',
  modelStarted: false, evidenceModified: false,
}, null, 2))
process.exitCode = 2

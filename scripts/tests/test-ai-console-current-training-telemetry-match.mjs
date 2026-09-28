import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/server/ai-console/active-run-telemetry-match.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { matchesCurrentTrainingTelemetry } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`)
const valid = { registryVerified: true, activeRunId: 'mvp-v18-dry-stage0-6061ccf56942a9bfaec776761e5ec30f6bf52629cd871898', activeProcessId: 17704, telemetryStatus: 'connected', reportedRunId: 'mvp-v18-dry-stage0-6061ccf56942a9bfaec776761e5ec30f6bf52629cd871898', reportedProcessId: 17704 }

test('only verified active Run, process and fresh telemetry match', () => {
  assert.equal(matchesCurrentTrainingTelemetry(valid), true)
  for (const changed of [
    { registryVerified: false },
    { telemetryStatus: 'unknown_or_stale' },
    { reportedRunId: 'previous-run' },
    { activeRunId: null },
    { activeProcessId: 9000 },
    { reportedProcessId: null },
  ]) assert.equal(matchesCurrentTrainingTelemetry({ ...valid, ...changed }), false)
})

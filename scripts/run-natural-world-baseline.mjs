import { runNaturalWorldBaseline, runBaselineWorker } from './lib/natural-world-baseline.mjs'

try {
  const args = process.argv.slice(2)
  if (args[0] === '--internal-worker' && args.length === 4) {
    await runBaselineWorker(args[1], args[2], args[3])
  } else {
    if (args.length !== 1 || !['create', 'verify', 'publish-selection'].includes(args[0])) throw new Error('baseline_cli_arguments')
    const result = await runNaturalWorldBaseline({ command: args[0] })
    process.stdout.write(JSON.stringify(result) + '\n')
    if (result.status !== 'baseline_verified' && result.status !== 'selection_published') process.exitCode = 1
  }
} catch (error) {
  process.stderr.write(JSON.stringify({ schemaVersion: 'natural-world-baseline-cli-error-v1',
    reasonCode: /^baseline_[a-z_]+$/.test(error.message) ? error.message : 'baseline_operation_failed', automaticRetry: false }) + '\n')
  process.exitCode = 1
}

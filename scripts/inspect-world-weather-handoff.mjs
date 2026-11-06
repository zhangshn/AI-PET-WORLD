import { inspectWorldWeatherHandoff } from './lib/world-weather-handoff.mjs'

try {
  if (process.argv.length !== 2) throw new Error('fixed read-only handoff inspection takes no arguments')
  console.log(JSON.stringify(await inspectWorldWeatherHandoff(), null, 2))
} catch (error) {
  console.error(JSON.stringify({ status: 'handoff_inspection_rejected', error: error.message }))
  process.exitCode = 1
}

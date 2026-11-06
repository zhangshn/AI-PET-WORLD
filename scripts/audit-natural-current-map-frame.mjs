import assert from 'node:assert/strict'
import {readCurrentNaturalFrameCandidate} from './lib/natural-current-frame-source.mjs'
import {evaluateNaturalFrameAudit} from './lib/natural-current-frame-review.mjs'

assert.equal(process.argv.length,2,'This read-only world audit accepts only the registered current world.')
const frame=await readCurrentNaturalFrameCandidate()
const report=await evaluateNaturalFrameAudit(frame)
console.log(JSON.stringify({token:report.token,worldId:report.worldId,tick:report.tick,status:report.status,releaseEligible:report.releaseEligible,
  gates:report.gates.map(({id,status})=>({id,status})),reportPath:report.reportPath},null,2))

import test from "node:test"
import assert from "node:assert/strict"
import {proposeGuidePaletteCorrection} from "../lib/ai-painter-guide-palette-proposal.mjs"

const base = ".runtime/ai-painter/ai-assisted-cold-start/source-failure-cases/source-failure-aa5b6f68f851d6815056b0b06dc2b9d8031ac45b03fa06b6f973a3ba6191237f/"
const problem = {path:base+"case.json",sha256:"f8aab971f7b4632b4d363e4ea6e9c43cf7776282df54a9569716f7c7690e5c5b"}
const observation = {path:base+"source-guide-review-715c54618abf87686753cf6e30fe3687d756a100108d7f5b9f13c6ec429a423f.json",
  sha256:"b409694ac821cd27aa186c38fdeec699b3c4b560dd657f079105feed2c5ed27b" }

test("the committed 168 case reproduces the independently measured dominant bins and preserves its only guide",async() => {
  const result = await proposeGuidePaletteCorrection({problem,observation})
  assert.equal(result.status,"inconclusive"); assert.equal(result.executionGranted,false)
  assert.equal(result.attribution.dimensions,98)
  assert(Math.abs(result.attribution.paletteDistanceShare-0.8931948357431547)<1e-12)
  assert.deepEqual(result.attribution.bins.slice(0,2).map(b=>[b.feature,b.direction]),[["color_hist_40","reduce"],["color_hist_56","reduce"]])
  assert(Math.abs(result.attribution.bins.slice(0,2).reduce((s,b)=>s+b.distanceShare,0)-0.8563820771542436)<1e-12)
  assert.deepEqual(result.candidatePrompt.referenceImages,[result.invariants.guide.path])
  assert.equal(result.invariants.objectInstances.length,52); assert.equal(result.invariants.split,"train")
  assert.equal(result.calibration.metrics.approvedEnvelopeRadius,1.463107)
  assert(result.repairInstructions.every(line=>line.includes("减少")))
})

test("refuses extra image, threshold, execution flag and suspected foreign observation",async() => {
  for (const change of [{referenceImages:["candidate.png"]},{threshold:999},{executionGranted:true}]) {
    await assert.rejects(proposeGuidePaletteCorrection({problem,observation,...change}),/only captured/)
  }
  await assert.rejects(proposeGuidePaletteCorrection({problem:{...problem,path:"elsewhere/case.json"},observation}))
  await assert.rejects(proposeGuidePaletteCorrection({problem,observation:{...observation,path:observation.path.replace("source-failure-aa5","source-failure-ba5")}}),/noncanonical/)
  await assert.rejects(proposeGuidePaletteCorrection({problem:{...problem,sha256:"0".repeat(64)},observation}),/committed identity/)
  await assert.rejects(proposeGuidePaletteCorrection({problem,observation:{...observation,sha256:"0".repeat(64)}}),/committed identity/)
})

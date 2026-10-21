// Data-consistency and arithmetic only. This module grants no admission; callers
// must independently authenticate their registered policy, package and live Run.
import assert from 'node:assert/strict';
export const LEGACY_CAPABILITY='stage4_mvp256_dry_decode1_entry_weight_quality24_v1';
export const COMPLETION_CAPABILITY='stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1';
export const COMPLETION_SELECTOR='decode1-entry-weight-quality-completion-v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n);

export function validateTrainingClock(capabilityVersion,ceiling,contract=null){
  assert(ceiling&&typeof ceiling==='object'&&!Array.isArray(ceiling),'training ceiling required');
  for(const [key,value] of Object.entries({epochs:24,generatorOptimizerSteps:1152,discriminatorOptimizerSteps:1152}))
    assert.equal(ceiling[key],value,'fixed completion schedule '+key);
  if(capabilityVersion===LEGACY_CAPABILITY){
    assert.equal(ceiling.maxWallSeconds,8400,'legacy training deadline stays8400');
    assert(!Object.hasOwn(ceiling,'trainingWallMode')||ceiling.trainingWallMode==='wall_clock','legacy cannot inherit completion mode');
    assert(contract===null||contract.capabilityVersion===LEGACY_CAPABILITY,'cross-route timing contract');
    return Object.freeze({trainingWallMode:'wall_clock',maxWallSeconds:8400});
  }
  assert.equal(capabilityVersion,COMPLETION_CAPABILITY,'unknown training capability');
  assert.equal(ceiling.trainingWallMode,'completion','explicit completion mode required');
  assert.equal(ceiling.maxWallSeconds,null,'completion deadline must be actual null');
  assert(contract&&typeof contract==='object'&&!Array.isArray(contract),'registered contract values required');
  assert.equal(contract.capabilityVersion,COMPLETION_CAPABILITY);assert.equal(contract.trainingWallMode,'completion');
  assert.equal(contract.maxWallSeconds,null);assert.equal(contract.candidateSelection,COMPLETION_SELECTOR);
  return Object.freeze({trainingWallMode:'completion',maxWallSeconds:null});
}
export function phaseMaximumSeconds(phase,timing){
  if(phase==='training'){
    assert(timing&&['wall_clock','completion'].includes(timing.trainingWallMode));
    assert.equal(timing.maxWallSeconds,timing.trainingWallMode==='completion'?null:8400);
    return timing.maxWallSeconds;
  }
  assert(Object.hasOwn({cpu:240,qualification:720,review:120,validation:120,adjudication:120,finalization:120},phase),'unknown finite phase');
  return {cpu:240,qualification:720,review:120,validation:120,adjudication:120,finalization:120}[phase];
}
export function executionDeadline(startedSeconds,timing){
  assert(finite(startedSeconds)&&startedSeconds>=0,'finite actual start required');
  const seconds=phaseMaximumSeconds('training',timing);
  return seconds===null?null:startedSeconds+seconds;
}
export function requireExecutionTime(now,deadline){
  assert(finite(now)&&now>=0,'finite monotonic observation required');
  if(deadline!==null){assert(finite(deadline)&&deadline>=0,'finite deadline or explicit null required');assert(now<deadline,'training wall deadline exhausted');}
}
export function publicationDeadline(now,deadline){
  requireExecutionTime(now,deadline);
  return deadline===null?now+.250:Math.min(deadline,now+.250);
}
export function observedElapsedSeconds(started,ended){
  assert(finite(started)&&started>=0,'actual monotonic start required');
  if(ended===null)return null;
  assert(finite(ended)&&ended>=started,'actual monotonic end required');return ended-started;
}

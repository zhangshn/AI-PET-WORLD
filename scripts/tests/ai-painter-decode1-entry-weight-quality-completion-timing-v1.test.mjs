import test from 'node:test';import assert from 'node:assert/strict';
import {LEGACY_CAPABILITY as OLD,COMPLETION_CAPABILITY as NEW,COMPLETION_SELECTOR,
 validateTrainingClock,phaseMaximumSeconds,executionDeadline,requireExecutionTime,publicationDeadline,observedElapsedSeconds}
 from '../lib/ai-painter-decode1-entry-weight-quality-completion-timing-v1.mjs';
const ceiling=()=>({epochs:24,generatorOptimizerSteps:1152,discriminatorOptimizerSteps:1152,maxWallSeconds:8400});
const completion=()=>({...ceiling(),trainingWallMode:'completion',maxWallSeconds:null});
const contract=()=>({capabilityVersion:NEW,candidateSelection:COMPLETION_SELECTOR,trainingWallMode:'completion',maxWallSeconds:null});
test('legacy remains8400; new explicitly registered values use actual null',()=>{
 const old=validateTrainingClock(OLD,ceiling()),next=validateTrainingClock(NEW,completion(),contract());
 assert.equal(executionDeadline(100,old),8500);assert.equal(executionDeadline(100,next),null);
 assert.throws(()=>requireExecutionTime(8500,8500));requireExecutionTime(864000,null);
 assert.throws(()=>validateTrainingClock(OLD,completion(),contract()));assert.throws(()=>validateTrainingClock(NEW,completion()));
 assert.throws(()=>validateTrainingClock('unknown',completion(),contract()));
 for(const value of [0,8400,999999,Infinity,NaN,'null'])assert.throws(()=>validateTrainingClock(NEW,{...completion(),maxWallSeconds:value},contract()));
});
test('fixed schedule and non-training phase budgets cannot be relaxed',()=>{
 const timing=validateTrainingClock(NEW,completion(),contract());
 for(const [phase,seconds] of Object.entries({cpu:240,qualification:720,review:120,validation:120,adjudication:120,finalization:120}))assert.equal(phaseMaximumSeconds(phase,timing),seconds);
 for(const key of ['epochs','generatorOptimizerSteps','discriminatorOptimizerSteps'])assert.throws(()=>validateTrainingClock(NEW,{...completion(),[key]:1},contract()));
 assert.throws(()=>phaseMaximumSeconds('other',timing));
});
test('publication and elapsed stay bounded/actual after8400; unknown end is unknown',()=>{
 assert.equal(publicationDeadline(20000,null),20000.25);assert.equal(publicationDeadline(10,10.1),10.1);
 assert.equal(observedElapsedSeconds(100,20100),20000);assert.equal(observedElapsedSeconds(100,null),null);
 assert.throws(()=>observedElapsedSeconds(100,99));assert.throws(()=>publicationDeadline(1,Infinity));
});

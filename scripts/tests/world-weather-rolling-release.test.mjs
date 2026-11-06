import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {ROLLING_WEATHER_VERSION,ROLLING_WEATHER_RELEASE_PATH,ROLLING_WEATHER_POLICY_PATH,
  FIRST_WEATHER_SCOPED_PATH,loadAndValidateReleasedCapabilityBinding,verifyFirstWeatherReleaseForLifecycle,
  verifyScopedWeatherReleaseForLifecycle} from "../lib/ai-painter-autonomous-package-decision-core-v3.mjs";
import {publishMachineAdjudicatedCapability} from "../lib/ai-painter-machine-capability-release-orchestrator-v1.mjs";

test("rolling requires its exact release profile and its own policy; registration claims are insufficient",()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"missing-rolling-194-"));
  try {
    const scoped={root,requiredCapabilityScope:"world_evolution",expectedRegistryRevision:0};
    const fixed={capabilityReleaseIdentity:ROLLING_WEATHER_VERSION};
    assert.throws(()=>publishMachineAdjudicatedCapability(fixed,scoped),/fixed weather policy is missing/);
    for(const claims of [{policy:ROLLING_WEATHER_POLICY_PATH},{bindings:{}},{releaseEvidence:[]},{modelCapabilityVersion:ROLLING_WEATHER_VERSION}]){
      assert.throws(()=>publishMachineAdjudicatedCapability({...fixed,...claims},scoped),/caller evidence rejected/);
    }
    assert.throws(()=>publishMachineAdjudicatedCapability({capabilityReleaseIdentity:"sakaerat-weather-153-rolling-v5"},{root}),/reserved weather identity/);
    assert.throws(()=>loadAndValidateReleasedCapabilityBinding({projectRoot:root,capabilityReleasePath:ROLLING_WEATHER_RELEASE_PATH}),/requires explicit/);
    assert.throws(()=>verifyFirstWeatherReleaseForLifecycle({projectRoot:root,capabilityReleasePath:ROLLING_WEATHER_RELEASE_PATH}),/fixed weather lifecycle/);
    assert.throws(()=>verifyScopedWeatherReleaseForLifecycle(ROLLING_WEATHER_VERSION,{projectRoot:root,capabilityReleasePath:FIRST_WEATHER_SCOPED_PATH}),/fixed weather lifecycle/);
    assert.deepEqual(fs.readdirSync(root),[]);
  } finally {fs.rmdirSync(root);}
});

test("disposable dual-version registry authenticates distinct snapshots, scopes, recovery and revocation",()=>{
  const child=spawnSync(process.execPath,[path.join(import.meta.dirname,"world-weather-scoped-release.test.mjs"),"--isolated-dual-weather"],{encoding:"utf8"});
  assert.equal(child.status,0,child.stderr);
});

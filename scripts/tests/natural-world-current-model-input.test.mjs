import test from "node:test";
import assert from "node:assert/strict";
import {currentSpatialChannels,currentVisualState} from "../lib/natural-world-current-model-input.mjs";
import {BASELINE_IDENTITY} from "../lib/natural-world-baseline-proof.mjs";

function fixture(){
  const season={season:"wet_season"},initialEnv={seasonScenario:season};
  const weather={origin:"model_predicted",period:{logicalEndUtc:"2020-01-09T00:00:00Z"},fieldOrder:["PRECTOTCORR","RH2M","T2M","WS2M"],values:[1,2,3,4]};
  const obj={objectId:"fixture-tree",kind:"tree",footprint:{x:2,y:3,width:4,height:7},blocksMovement:true};
  const g={objectFootprints:[obj],terrainRegions:[],walkableRegions:[],collisionRegions:[]};
  const saved={...BASELINE_IDENTITY,tick:1,stateVersion:2,eventCursor:2,worldFacts:{tick:1,payload:structuredClone(g)},worldState:{tick:1,
    payload:{objects:[structuredClone(obj)],resources:[],environment:{...initialEnv,evolution:{weather,logicalEndUtc:weather.period.logicalEndUtc}}}}};
  return [saved,{scope:"production",worldId:saved.worldId,receipt:{identity:{...BASELINE_IDENTITY}},tick:1,stateVersion:2,eventCursor:2,weather},
    {identity:BASELINE_IDENTITY,tick:0,factHash:"prior",ecology:{environment:initialEnv,regionalLandscapeType:"forest"}},
    {worldId:saved.worldId,tick:0,factHash:"prior",spatialLayers:g,directorPlan:{singleMapEcologyPlan:{environment:initialEnv,regionalLandscapeType:"forest"}}}];
}
test("world clock and weather advance with stable spatial controls",()=>{
  const input=fixture(),resolved=currentVisualState(...input);
  assert.deepEqual(resolved.weather.values,[1,2,3,4]);assert.equal(resolved.season.season,"wet_season");
  const masks=currentSpatialChannels(resolved.geometry);
  assert.equal(masks.size,23);assert.equal(masks.get("object_instance")[3*1024+2],1);
  assert.equal(masks.get("object_tree")[3*1024+2],255);assert.equal(masks.get("moisture_proximity")[0],0);
});
test("stale world, changed object or unsupported appearance must not reuse the initial director",()=>{
  for(const change of [
    ([s])=>s.tick=0,([s])=>s.worldId="another-world",
    ([s])=>s.worldState.payload.objects[0].footprint.x++,
    ([s])=>s.worldFacts.payload.objectFootprints[0].footprint.x++,
    ([s])=>s.worldState.payload.environment.seasonScenario={season:"dry_season"},
    ([s])=>s.worldState.payload.resources.push({}),([,r])=>r.weather={values:[1,2,3,4]},
  ]){
    const args=fixture();change(args);assert.throws(()=>currentVisualState(...args));
  }
});

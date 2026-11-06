import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {BASELINE_IDENTITY as id} from "../lib/natural-world-baseline-proof.mjs";
import {publishImmutableMapInputs,validateWeatherVisualState} from "../lib/natural-world-live-map-input.mjs";

function stateFixture(){
  const geometry={objectFootprints:[{objectId:"rock-1",kind:"rock"}],terrainRegions:[{kind:"grass"}],walkableRegions:[],collisionRegions:[]};
  const occ=(n)=>({eventSha256:"event-"+n,businessKey:"commit-"+n,historyHead:{cursor:n+1,eventSha256:"event-"+n}});
  const make=(n)=>({...id,tick:n,stateVersion:n+1,eventCursor:n+1,sourceBindings:["fixed"],
    worldFacts:{tick:n,payload:structuredClone(geometry)},worldState:{tick:n,payload:{objects:structuredClone(geometry.objectFootprints),resources:[],
      environment:{season:"wet",evolution:{commit:occ(n),logicalEndUtc:"day-"+n,weather:{origin:"model_predicted",fieldOrder:["PRECTOTCORR","RH2M","T2M","WS2M"],
        units:["mm/day","%","C","m/s"],values:[1,2,3,4],period:{logicalStartUtc:"day-"+(n-1),logicalEndUtc:"day-"+n}}}}}}});
  const before=make(7),current=make(8);
  return [current,before,{eventKind:"evolution",identity:{...id},evidence:{kind:"evolution",capabilityRef:{version:"sakaerat-weather-153-rolling-v4"}},
    fromTick:7,toTick:8,fromStateVersion:8,toStateVersion:9,cursor:9,previousEventSha256:"event-7",...occ(8),interval:current.worldState.payload.environment.evolution.weather.period}];
}
test("only committed weather fields change under a weather release; the route is not a fixed day",()=>{
  assert.equal(validateWeatherVisualState(...stateFixture()).logicalEndUtc,"day-8");
  for(const mutate of [
    ([c])=>c.worldId="wrong",([c])=>c.tick--,([c])=>c.worldFacts.payload.objectFootprints[0].kind="tree",
    ([c])=>c.worldState.payload.environment.season="dry",([,,e])=>e.evidence.capabilityRef.version="unknown",
    ([,,e])=>e.previousEventSha256="foreign",([c])=>c.sourceBindings=[],
  ]){const args=stateFixture();mutate(args);assert.throws(()=>validateWeatherVisualState(...args));}
  const a=stateFixture();for(const r of a.slice(0,2)){r.worldState.payload.objects[0].kind="flower-new";r.worldFacts.payload.objectFootprints[0].kind="flower-new";}
  assert.throws(()=>validateWeatherVisualState(...a),/unsupported object kind: flower-new/);
});
test("racing publishers produce one byte-exact archive; later heads preserve it and corruption is not overwritten",async t=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),"map-input-209-")),dir=fs.realpathSync.native(base);
  t.after(()=>{assert(base.startsWith(path.join(os.tmpdir(),"map-input-209-")));fs.rmSync(base,{recursive:true,force:true});});
  const first="a".repeat(64),next="b".repeat(64);
  const entries=new Map([["input.json",Buffer.from("one")],["channels/terrain_grass.png",Buffer.from("native bytes")]]);
  const sub=`import {publishImmutableMapInputs} from './scripts/lib/natural-world-live-map-input.mjs';publishImmutableMapInputs(process.argv[1],process.argv[2],new Map([['input.json',Buffer.from('one')],['channels/terrain_grass.png',Buffer.from('native bytes')]]),()=>{});`;
  await Promise.all([0,1,2].map(()=>promisify(execFile)(process.execPath,["--input-type=module","-e",sub,dir,first])));
  assert.deepEqual(fs.readdirSync(dir),[first]);
  let reads=0;assert.throws(()=>publishImmutableMapInputs(dir,next,entries,()=>{if(++reads===2)throw Error("head changed");}),/head changed/);
  assert.deepEqual(fs.readdirSync(dir),[first]);publishImmutableMapInputs(dir,next,entries,()=>{});
  assert.equal(fs.readFileSync(path.join(dir,first,"input.json"),"utf8"),"one");
  fs.writeFileSync(path.join(dir,next,"input.json"),"tampered");
  assert.throws(()=>publishImmutableMapInputs(dir,next,entries,()=>{}),/immutable live input differs/);
  assert.equal(fs.readFileSync(path.join(dir,next,"input.json"),"utf8"),"tampered");
});

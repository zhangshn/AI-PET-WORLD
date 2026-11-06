import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {fillBounds,rasterizeFootprints,rasterizePolygons} from "./current-world-condition-raster.mjs";
import {BASELINE_IDENTITY,baselineDigest,baselineSha256} from "./natural-world-baseline-proof.mjs";
import {createEvolutionInputReader} from "./natural-world-evolution-input.mjs";
import {readFirstWeatherRuntime} from "./world-first-weather-runtime.mjs";

export const CURRENT_MAP_OUTPUT=".runtime/ai-painter/controller-repair-reviews/world-current-map-189-20261103/run";
const original={path:".runtime/ai-painter/controller-repair-reviews/natural-world-mainline-172-20261102/visual/node-verified/natural-model-input.json",
  sha256:"088e9034df56fdc8569e8c786f9e293db15d516aed69ed61065819ec120301e8"};
const storePath="data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json";
const runtimeResult=".runtime/ai-painter/world-first-weather-runtime/v3/result.json";
const contract={path:"data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json",
  sha256:"c8941c7730edb73c0b0a733bc877cf550184e2f3ab2adb08102fb0214d38cac2"};
const width=1024,height=768;
const terrainKinds=["grass","water","path_ground","shoreline","natural_boundary","mud_patch","tall_grass"];
const geometryKeys=["terrainRegions","walkableRegions","collisionRegions","objectFootprints"];

// Float32 two-pass chamfer and rounding match the registered condition contract's
// native compiler. Weather variables do not participate in these spatial fields.
function chamfer(mask,inside){
  const d=new Float32Array(width*height);
  for(let i=0;i<d.length;i++)d[i]=(mask[i]>0)===inside?width+height:0;
  for(const step of [1,-1]){
    const stop=step===1?d.length:-1;
    for(let i=step===1?0:d.length-1;i!==stop;i+=step){
      if(!d[i])continue;
      const x=i%width, prior=i-step*width;
      const near=step===1?x>0:x<width-1,far=step===1?x<width-1:x>0;
      if(near)d[i]=Math.min(d[i],d[i-step]+1);
      if(prior>=0&&prior<d.length){
        d[i]=Math.min(d[i],d[prior]+1);
        if(near)d[i]=Math.min(d[i],d[prior-step]+Math.SQRT2);
        if(far)d[i]=Math.min(d[i],d[prior+step]+Math.SQRT2);
      }
    }
  }
  return d;
}

export function currentSpatialChannels(layers){
  const channels=new Map(),objects=layers.objectFootprints;
  assert(objects.length>0&&objects.length<=254,"native instance values must be unique");
  assert(objects.every(o=>["tree","rock","shrub","grass_detail"].includes(o.kind)),"unsupported current object kind");
  assert(layers.terrainRegions.every(t=>terrainKinds.includes(t.kind)),"unsupported current terrain");
  for(const kind of terrainKinds)channels.set("terrain_"+kind,rasterizePolygons(layers.terrainRegions.filter(r=>r.kind===kind),width,height));
  channels.set("walkable",rasterizePolygons(layers.walkableRegions,width,height));
  channels.set("collision",rasterizePolygons(layers.collisionRegions,width,height));
  channels.set("object_footprints",rasterizeFootprints(objects,width,height));
  channels.set("object_tree",rasterizeFootprints(objects.filter(o=>o.kind==="tree"),width,height));
  channels.set("object_rock",rasterizeFootprints(objects.filter(o=>o.kind==="rock"),width,height));
  channels.set("object_vegetation",rasterizeFootprints(objects.filter(o=>o.kind==="shrub"||o.kind==="grass_detail"),width,height));
  channels.set("focal_area",Buffer.alloc(width*height));
  const ids=Buffer.alloc(width*height);
  objects.forEach((o,i)=>fillBounds(ids,o.footprint,width,height,i+1));
  channels.set("object_instance",ids);
  const xx=Buffer.alloc(width*height),yy=Buffer.alloc(width*height);
  for(let i=0;i<ids.length;i++){xx[i]=Math.round(255*(i%width)/(width-1));yy[i]=Math.round(255*Math.floor(i/width)/(height-1));}
  channels.set("coordinate_x",xx);channels.set("coordinate_y",yy);
  for(const [name,target] of [["path","terrain_path_ground"],["water","terrain_water"],["shoreline","terrain_shoreline"],
    ["object_ground","object_footprints"],["boundary","terrain_natural_boundary"]]){
    const mask=channels.get(target),inner=chamfer(mask,true),outer=chamfer(mask,false);
    const result=Buffer.alloc(mask.length);
    for(let i=0;i<result.length;i++)result[i]=Math.round(128+127*(mask[i]?Math.min(96,inner[i]):-Math.min(96,outer[i]))/96);
    channels.set("signed_distance_"+name,result);
  }
  const water=channels.get("terrain_water"),distance=chamfer(water,false),moisture=Buffer.alloc(water.length);
  for(let i=0;i<water.length;i++)moisture[i]=water[i]?255:Math.round(255*(1-Math.min(160,distance[i])/160));
  channels.set("moisture_proximity",moisture);
  return channels;
}

export function currentVisualState(saved,readback,initial,initialTask){
  const id=Object.fromEntries(Object.keys(BASELINE_IDENTITY).map(k=>[k,saved[k]]));
  assert.deepEqual(id,BASELINE_IDENTITY);assert.deepEqual(readback.receipt.identity,id);assert.deepEqual(initial.identity,id);
  assert.deepEqual([saved.tick,saved.stateVersion,saved.eventCursor],[1,2,2],"only the first committed model day is supported");
  assert.deepEqual([readback.tick,readback.stateVersion,readback.eventCursor],[1,2,2]);
  assert.equal(readback.scope,"production");assert.equal(readback.worldId,id.worldId);
  assert.equal(saved.worldState.tick,1);assert.equal(saved.worldFacts.tick,1);
  assert.equal(initial.tick,0);assert.equal(initialTask.tick,0);
  assert.equal(initialTask.worldId,id.worldId);assert.equal(initialTask.factHash,initial.factHash);
  for(const key of geometryKeys)assert.deepEqual(saved.worldFacts.payload[key],initialTask.spatialLayers[key],"initial director cannot be reused for changed "+key);
  assert.deepEqual(saved.worldState.payload.objects,saved.worldFacts.payload.objectFootprints,"state object placement differs");
  assert.deepEqual(saved.worldState.payload.resources,[],"new resources require a visual input contract");
  const {evolution,...initialEnvironment}=saved.worldState.payload.environment;
  assert.deepEqual(initialEnvironment,initial.ecology.environment,"initial season, light or other visual regime changed");
  assert.deepEqual(readback.weather,evolution.weather);
  assert.equal(evolution.weather.origin,"model_predicted");
  assert.equal(evolution.logicalEndUtc,evolution.weather.period.logicalEndUtc);
  assert.deepEqual(evolution.weather.fieldOrder,["PRECTOTCORR","RH2M","T2M","WS2M"]);
  assert.equal(evolution.weather.values.length,4);assert(evolution.weather.values.every(Number.isFinite));
  const ecology=initialTask.directorPlan.singleMapEcologyPlan;
  assert.equal(ecology.regionalLandscapeType,initial.ecology.regionalLandscapeType);
  assert.deepEqual(ecology.environment.seasonScenario,initialEnvironment.seasonScenario);
  return {identity:id,weather:evolution.weather,logicalEndUtc:evolution.logicalEndUtc,season:initialEnvironment.seasonScenario,
    landscape:ecology.regionalLandscapeType,geometry:saved.worldFacts.payload,geometrySha256:baselineDigest(saved.worldFacts.payload)};
}

export async function writeCurrentModelInput(){
  const {read}=createEvolutionInputReader(process.cwd());
  function readRef(ref,limit=2**21){const b=read(ref.path,limit);assert.equal(baselineSha256(b),ref.sha256,ref.path);return b;}
  const state=await readFirstWeatherRuntime();
  const store={path:storePath,sha256:state.fileSha256};
  const saved=JSON.parse(readRef(store)),initial=JSON.parse(readRef(original)),oldTask=JSON.parse(readRef(initial.bindings.taskPackage));
  const receiptBytes=read(runtimeResult,2**20),receipt=JSON.parse(receiptBytes);
  assert.equal(receipt.fileSha256,store.sha256);assert.deepEqual(receipt.receipt,state.receipt);
  const snap=currentVisualState(saved,state,initial,oldTask);
  const policy=JSON.parse(readRef(contract));
  assert.equal(policy.status,"active_current_machine_condition_contract");
  const channels=currentSpatialChannels(snap.geometry);
  assert.deepEqual([...channels.keys()],policy.tensorContract.channelOrder);
  assert.deepEqual([...channels.keys()],initial.channels.map(c=>c.id));
  const views=snap.geometry.objectFootprints.map(({objectId,kind,footprint,blocksMovement},i)=>({value:i+1,objectId,kind,footprint,blocksMovement}));
  assert.deepEqual(views,initial.objectInstanceTable);
  const root=path.resolve(CURRENT_MAP_OUTPUT);
  fs.mkdirSync(root);fs.mkdirSync(path.join(root,"channels"));
  const fresh=[];
  for(const c of initial.channels){
    const pixels=channels.get(c.id);
    const old=await sharp(readRef(c)).greyscale().raw().toBuffer({resolveWithObject:true});
    assert.deepEqual([old.info.width,old.info.height,old.info.channels],[width,height,1]);assert(old.data.equals(pixels),c.id+" differs with identical spatial facts");
    const png=await sharp(pixels,{raw:{width,height,channels:1}}).toColourspace("b-w").png().toBuffer();
    const p=CURRENT_MAP_OUTPUT+"/channels/"+c.id+".png";
    fs.writeFileSync(p,png,{flag:"wx"});
    fresh.push({id:c.id,kind:c.kind,path:p,sha256:baselineSha256(png),pixelSha256:baselineSha256(pixels),dtype:"uint8",nativeShape:[1,height,width],resize:c.resize});
  }
  // Reopen the live source after all image work. This read is intentionally outside the cached reader.
  assert.equal(baselineSha256(fs.readFileSync(store.path)),store.sha256,"live Store advanced during descriptor construction");
  const body={schemaVersion:"natural-world-current-visual-input-v1",scope:"committed_first_weather_day_diagnostic",
    identity:snap.identity,tick:saved.tick,stateVersion:saved.stateVersion,eventCursor:saved.eventCursor,
    factHash:saved.worldFactsPayloadSha256,statePayloadSha256:saved.statePayloadSha256,recordContentSha256:saved.recordContentSha256,
    geometrySha256:snap.geometrySha256,store,weatherResult:{path:runtimeResult,sha256:baselineSha256(receiptBytes)},scopeRelease:state.scopeRelease,
    initialDescriptor:original,initialTask:initial.bindings.taskPackage,conditionContract:contract,
    currentWeather:snap.weather,logicalEndUtc:snap.logicalEndUtc,renderInputs:{season:snap.season,regionalLandscapeType:snap.landscape},
    weatherFieldsEncoded:[],temperatureOrRainOverlay:false,channels:fresh,objectInstanceTable:views,
    stage:2,width,height,qualification:"diagnostic_input_only"};
  const descriptor={...body,descriptorDigest:baselineDigest(body)};
  const p=CURRENT_MAP_OUTPUT+"/natural-current-input.json",bytes=Buffer.from(JSON.stringify(descriptor,null,2)+"\n");
  fs.writeFileSync(p,bytes,{flag:"wx"});return {path:p,sha256:baselineSha256(bytes)};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {measureSourceSemantics} from '../lib/ai-painter-source-semantic-measurement-v1.mjs';
const bind=value=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));return {bytes,sha256:createHash('sha256').update(bytes).digest('hex')};};
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
function fixture(change=()=>{}) {
 const t={taskId:'synthetic',outputSize:{width:100,height:100},spatialLayers:{objectFootprints:[{objectId:'tree-1',kind:'tree',footprint:{x:20,y:20,width:10,height:10}}],terrainRegions:[{kind:'path_ground',polygon:rect(10,40,80,20)}]}};
 const task=bind(t),image=bind(Buffer.from('synthetic opaque RGB identity, not image recognition'));
 const o={schemaVersion:'ai-painter-source-observation-draft-v1',actor:'synthetic_test',method:'known_geometry',taskId:t.taskId,taskSha256:task.sha256,imageSha256:image.sha256,frame:{width:100,height:100,coordinates:'native_xy'},objects:[{objectId:'tree-1',state:'observed',observedClass:'tree',groundContact:{x:25,y:25},contactKind:'ground_contact'}],road:{polygon:rect(10,40,80,20),sections:[{origin:{x:50,y:50},tangent:{x:1,y:0}}]}};
 change(o,t);return {task:bind(t),image,observation:bind(o)};
}
const run=f=>measureSourceSemantics(fixture(f));
test('known geometry measured without qualification',()=>{const r=run(()=>{});assert.equal(r.status,'diagnostic_only');assert.equal(r.measurements[0].distanceToClosedFootprintPixels,0);assert.equal(r.measurements[1].expectedWidthPixels,20);assert.equal(r.measurements[1].widthDeltaPixels,0);assert.equal(r.trainingEligible,false);assert.equal(r.observationTruthVerified,false);});
test('road translation separates offset from width',()=>{const r=run(o=>o.road.polygon=rect(10,45,80,20));assert.deepEqual(r.measurements[1].signedBoundaryOffsetsPixels,[5,5]);assert.equal(r.measurements[1].widthDeltaPixels,0);});
test('road widening measured',()=>{const r=run(o=>o.road.polygon=rect(10,35,80,30));assert.equal(r.measurements[1].widthDeltaPixels,10);});
test('diagonal normal uses Euclidean distance',()=>{const r=run(o=>o.road.sections[0].tangent={x:1,y:1});assert.ok(Math.abs(r.measurements[1].expectedWidthPixels-20*Math.SQRT2)<1e-8);});
test('ground contact outside footprint has distance not rejection',()=>{const r=run(o=>o.objects[0].groundContact={x:33,y:34});assert.equal(r.measurements[0].distanceToClosedFootprintPixels,5);assert.equal(r.measurements[0].contactInsideClosedFootprint,false);assert.equal(r.status,'diagnostic_only');});
test('closed boundary convention explicit',()=>assert.equal(run(o=>o.objects[0].groundContact={x:30,y:30}).measurements[0].contactInsideClosedFootprint,true));
test('missing annotation unresolved',()=>{const f=fixture();delete f.observation;assert.equal(measureSourceSemantics(f).status,'unresolved');});
for(const state of ['unknown','occluded']) test(`${state} creates no invented class or location`,()=>{const r=run(o=>o.objects=[{objectId:'tree-1',state}]);assert.equal(r.measurements[0].observedClass,undefined);assert.equal(r.measurements[0].distanceToClosedFootprintPixels,undefined);});
for(const [name,mutate,code] of [
 ['wrong image',o=>o.imageSha256='a'.repeat(64),'OBSERVATION_IDENTITY_MISMATCH'],
 ['wrong object',o=>o.objects[0].objectId='other','OBJECT_IDENTITY_MISMATCH'],
 ['wrong resolution',o=>o.frame.width=256,'OBSERVATION_FRAME_MISMATCH'],
 ['canopy contact',o=>o.objects[0].contactKind='canopy','CANOPY_IS_NOT_GROUND_CONTACT'],
 ['zero tangent',o=>o.road.sections[0].tangent={x:0,y:0},'INVALID_TANGENT'],
 ['outside image',o=>o.objects[0].groundContact.x=101,'POINT_OUT_OF_FRAME'],
 ['duplicate object',o=>o.objects.push({...o.objects[0]}),'DUPLICATE_OBJECT_OBSERVATION'],
 ['self crossing polygon',o=>o.road.polygon=[{x:10,y:10},{x:90,y:90},{x:10,y:90},{x:90,y:10}],'POLYGON_SELF_INTERSECTION'],
 ['missing provenance',o=>delete o.actor,'OBSERVATION_PROVENANCE_MISSING'],
]) test(name,()=>{const r=run(mutate);assert.equal(r.status,'invalid_input');assert.ok(r.issues.includes(code));assert.deepEqual(r.measurements,[]);});
test('changed bytes rejected',()=>{const f=fixture();f.image.bytes=Buffer.from('tampered');assert.ok(measureSourceSemantics(f).issues.includes('BYTE_BINDING_MISMATCH'));});
test('claimed approval never propagates',()=>{const r=run(o=>{o.trainingEligible=true;o.verified=true;o.actor='external_codex';});assert.equal(r.trainingEligible,false);assert.equal(r.observationTruthVerified,false);assert.equal(r.provenance.actor,'external_codex');});
test('no road crossing unresolved section',()=>assert.equal(run(o=>o.road.sections[0].origin.x=0).measurements[1].state,'ambiguous_or_missing_intersection'));
test('collinear boundary unresolved section',()=>{const r=run(o=>{o.road.sections[0].origin={x:10,y:50};});assert.equal(r.measurements[1].state,'ambiguous_or_missing_intersection');});

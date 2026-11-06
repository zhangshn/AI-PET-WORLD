import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import sharp from 'sharp'
import {createEvolutionInputReader} from './natural-world-evolution-input.mjs'
import {baselineDigest} from './natural-world-baseline-proof.mjs'
import {inspectNaturalFrameRgbPng} from '../../src/world/game-map-frame/natural-frame-snapshot.mjs'
import {assembleNaturalCurrentFrame,staleNaturalMap} from '../../src/world/game-map-frame/natural-current-frame.mjs'

const worldId='mvp-natural-world-001',ownerId='mvp-natural-owner-001'
const storePath='data/world-runtime/'+ownerId+'/'+worldId+'.json'
const inputs='.runtime/ai-painter/natural-world-live-map-inputs/'+worldId+'/'
const candidates='.runtime/ai-painter/natural-world-live-map-candidates/'+worldId+'/'
// The first enrolled renderer fixes model, programs, numerical rule and interpreter.
// Replace only the world/Store/descriptor in its native key as the world advances.
const enrolled={path:candidates+'c9dc2d0904b8969143d422199c1e81ee3a26626c5669b8e94948f92d76047925/reservation.json',
  sha256:'55bae4a51a72b120396ce2180f0021d97c5501a6543298182fbbf366a90ee775'}
const hash=b=>createHash('sha256').update(b).digest('hex')
const parse=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
const binding=(path,bytes)=>({path,sha256:hash(bytes),bytes:bytes.length})
const pair=b=>({path:b.path,sha256:b.sha256})
const MiB=1024**2
function fixedMissing(error){
  if(error?.code==='ENOENT')throw Object.assign(new Error('no immutable candidate for current natural map'),{code:'current_natural_map_candidate_missing'})
  throw error
}
export async function readCurrentNaturalFrameCandidate({expectedToken}={}){
  if(expectedToken!==undefined&&!/^[0-9a-f]{64}$/.test(expectedToken))throw staleNaturalMap()
  const root=process.cwd(),reader=createEvolutionInputReader(root)
  const read=(path,max=4*MiB)=>reader.read(path,max)
  const bound=(ref,path,max)=>{
    assert.equal(ref.path,path,'unexpected source path');const bytes=read(path,max)
    assert.equal(hash(bytes),ref.sha256,'immutable source has changed: '+path)
    if(ref.bytes!==undefined)assert.equal(ref.bytes,bytes.length)
    return bytes
  }
  const storeBytes=read(storePath),store=binding(storePath,storeBytes),record=parse(storeBytes)
  assert.equal(record.ownerId,ownerId);assert.equal(record.worldId,worldId)
  const descriptorPath=inputs+store.sha256+'/input.json'
  let descriptorBytes
  try{descriptorBytes=read(descriptorPath,256*1024)}catch(error){if(expectedToken&&error.code==='ENOENT')throw staleNaturalMap();fixedMissing(error)}
  const descriptor=binding(descriptorPath,descriptorBytes),d=parse(descriptorBytes)
  const template=parse(bound(enrolled,enrolled.path,256*1024)).plan.identityPayload
  const payload={...template,world:d.identity,store:pair(store),descriptor:pair(descriptor)},key=baselineDigest(payload),base=candidates+key+'/'
  const path=base+'candidate.json'
  let candidateBytes
  try{candidateBytes=read(path,65536)}catch(error){if(expectedToken&&error.code==='ENOENT')throw staleNaturalMap();fixedMissing(error)}
  const candidate=binding(path,candidateBytes),c=parse(candidateBytes)
  // The original enrolled image already has an independently read-back receipt.
  if(key==='c9dc2d0904b8969143d422199c1e81ee3a26626c5669b8e94948f92d76047925'){
    assert.equal(candidate.sha256,'62526088ad326f0035805e9ab8bfe8439a942eab3f047f63f01c6f8772621b58','enrolled current candidate differs')
    const archived={path:'.runtime/ai-painter/controller-repair-reviews/natural-world-current-map-render-227-20261103/repeat.stdout',
      sha256:'b4f72c2a51ead70fcfdff716bc396c2fd664e41adca00181f7d3e8a46a16c3b0'}
    const replay=parse(bound(archived,archived.path,65536))
    assert.equal(replay.cacheHit,true);assert.equal(replay.modelForwardsThisCall,0);assert.deepEqual(replay.candidate,c)
  }
  const reservationBytes=read(base+'reservation.json',256*1024),reservation=parse(reservationBytes)
  assert.equal(c.key,key);assert.deepEqual(reservation.plan.identityPayload,payload)
  assert.deepEqual(c.world,payload.world);assert.deepEqual(c.model,payload.model.checkpoint);assert.deepEqual(c.store,pair(store));assert.deepEqual(c.descriptor,pair(descriptor))
  assert.deepEqual([c.tick,c.stateVersion,c.eventCursor],[record.tick,record.stateVersion,record.eventCursor])
  assert.equal(c.status,'current_native_candidate_unpublished');assert.equal(c.published,false);assert.equal(c.formalVisualReviews,0)
  const render=parse(bound(c.execution,base+'render.json',65536)),owned=parse(bound(c.owned,base+'ownership.json',65536)),receipt=owned.receipt
  assert.equal(render.key,key);assert.deepEqual(render.identity,d.identity);assert.deepEqual(render.store,c.store);assert.deepEqual(render.descriptor,c.descriptor)
  assert.deepEqual(render.parent,payload.model);assert.deepEqual(render.counts,{checkpointLoads:1,generatorForwards:1,criticForwards:0,gradientCalls:0,optimizerStarts:0,cudaStarts:0,sourceRgbReads:0})
  assert.deepEqual([render.provenance.tick,render.provenance.stateVersion,render.provenance.eventCursor],[record.tick,record.stateVersion,record.eventCursor])
  assert.equal(render.status,'private_native_candidate');assert.equal(render.scope,'diagnostic_unpublished')
  assert.equal(render.published,false);assert.equal(render.formalImageReviews,0);assert.deepEqual(render.outputShape,[1,3,768,1024])
  assert.equal(render.provenance.factHash,record.worldFactsPayloadSha256);assert.equal(render.provenance.eventSha256,record.worldState.payload.environment.evolution.commit.eventSha256)
  assert.equal(render.snapshot,payload.numericSource.sha256)
  assert(owned.ok&&receipt.ownerClosed&&receipt.liveOwnerCleanupConfirmed&&receipt.cleanupConfirmed&&receipt.guardReleaseConfirmed&&receipt.proof.assignedBeforeResume&&receipt.proof.killOnJobClose)
  assert.equal(receipt.proof.exitCode,0);assert.equal(receipt.proof.activeProcessesAfterCleanup,0);assert.equal(receipt.proof.rootPid,render.pid);assert.equal(render.guard,receipt.guard.identity)
  assert(/^[a-f0-9-]{36}$/.test(render.guard))
  const cleanupPath='.runtime/ai-painter/owned-worker-guards/'+render.guard+'-native/cleanup-observation.json'
  const cleanupBytes=read(cleanupPath,65536),cleanup=parse(cleanupBytes)
  assert.equal(cleanup.bindingBase64,receipt.proof.bindingBase64);assert.equal(cleanup.rootPid,render.pid);assert.equal(cleanup.activeProcessesAfterCleanup,0)
  const native=parse(Buffer.from(cleanup.bindingBase64,'base64'))
  assert.equal(native.guard.runnerPid,reservation.launcherPid);assert.equal(native.guard.executableSha256,payload.interpreterSha256)
  assert.equal(render.outputPixelSha256,c.pixelSha256)
  const n='native-rgb.npy',png='native-rgb.png',imageBytes=bound(c.artifacts[png],base+png,4*MiB)
  for(const name of [n,png]){assert.equal(c.artifacts[name].sha256,render.artifacts[name].sha256);assert.equal(c.artifacts[name].bytes,render.artifacts[name].bytes)}
  // The producer verifies every float-to-PNG conversion before making this candidate
  // visible. Rehash the exact input to that check and decode the consumer's actual PNG.
  bound(c.artifacts[n],base+n,12*MiB)
  await inspectNaturalFrameRgbPng(imageBytes,c.artifacts[png].sha256,c.pixelSha256)
  const channelSources=[]
  for(const ch of d.channels){
    assert(/^[a-z][a-z0-9_]{0,63}$/.test(ch.id),'unexpected channel name')
    const bytes=bound(ch,inputs+store.sha256+'/channels/'+ch.id+'.png',2*MiB)
    const data=await sharp(bytes,{limitInputPixels:1024*768,failOn:'error'}).greyscale().raw().toBuffer({resolveWithObject:true})
    assert.deepEqual([data.info.width,data.info.height,data.info.channels],[1024,768,1]);assert.equal(hash(data.data),ch.pixelSha256)
    channelSources.push({...ch,bytes:bytes.length})
  }
  const snapshot={identity:d.identity,tick:record.tick,stateVersion:record.stateVersion,eventCursor:record.eventCursor,storeFileSha256:store.sha256,descriptorSha256:descriptor.sha256}
  const assertCurrent=()=>{
    const fresh=createEvolutionInputReader(root)
    try{
      for(const [ref,max] of [[store,4*MiB],[descriptor,256*1024],[candidate,65536],[c.artifacts[png],4*MiB],[c.execution,65536],[c.owned,65536],
        [binding(base+'reservation.json',reservationBytes),256*1024],[binding(cleanupPath,cleanupBytes),65536],...channelSources.map(ch=>[ch,2*MiB])]){
        if(hash(fresh.read(ref.path,max))!==ref.sha256)throw staleNaturalMap()
      }
      if(hash(createEvolutionInputReader(root).read(store.path,4*MiB))!==store.sha256)throw staleNaturalMap()
    }catch(e){if(e.code==='ENOENT')throw staleNaturalMap();throw e}
  }
  const frame=assembleNaturalCurrentFrame({storeBytes,descriptorBytes,snapshot,candidate:c,imageBytes,assertCurrent})
  if(expectedToken!==undefined&&expectedToken!==frame.token)throw staleNaturalMap()
  return {...frame,sources:{store,descriptor,candidate,image:c.artifacts[png],render:c.execution,ownership:c.owned,channels:channelSources}}
}

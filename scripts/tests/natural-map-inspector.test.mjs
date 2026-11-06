import test from 'node:test'
import assert from 'node:assert/strict'
import {nativePixelAt} from '../../src/world/game-map-frame/natural-map-inspector-coordinates.mjs'
import {parseNaturalMapReview,safeMapPoint} from '../../src/server/local-backup/natural-map-review.mjs'

const url='http://localhost:3000/api/local-backup/natural-map-review',token='a'.repeat(64)
test('click keeps native pixel centres under zoom, mobile layout and scrolling',()=>{
  for(const w of [365,730,1024,2048]){
    const rect={left:-18.5,top:-132.75,width:w,height:w*0.75}
    for(const [x,y] of [[0,0],[112,235],[810,320],[1023,767]]){
      assert.deepEqual(nativePixelAt(rect.left+(x+.5)*w/1024,rect.top+(y+.5)*rect.height/768,rect,1024,768),{x,y})
    }
    assert.equal(nativePixelAt(rect.left-1,rect.top,rect,1024,768),null)
    assert.deepEqual(nativePixelAt(rect.left+w,rect.top+rect.height,rect,1024,768),{x:1023,y:767})
    assert.equal(nativePixelAt(0,0,{...rect,width:0},1024,768),null)
  }
})
test('API accepts exactly the current summary, bound bitmap or integer pixel',()=>{
  assert.deepEqual(parseNaturalMapReview(url),{kind:'summary'})
  assert.deepEqual(parseNaturalMapReview(url+'?token='+token+'&image=1'),{kind:'image',token})
  assert.deepEqual(parseNaturalMapReview(url+'?token='+token+'&x=1023&y=767'),{kind:'point',token,x:1023,y:767})
  for(const args of ['file=secret','image=1','token='+token,'token='+token+'&image=1&path=../secret',
    'token='+token+'&x=0&x=1&y=0','token='+token+'&x=-1&y=0','token='+token+'&x=0&y=768','token='+token+'&x=1024&y=0']){
    assert.throws(()=>parseNaturalMapReview(url+'?'+args),{status:400})
  }
})
test('projection publishes only explicit business fields and rejects incomplete geometry',()=>{
  const pixel={x:112,y:235},hit={pixel,terrain:[{kind:'grass',sourceId:'grass'}],onPathGround:false,movement:'blocked_by_collision',
    walkableRegionIds:[],collisionRegionIds:['collision'],store:'/private',objects:[{objectId:'tree-1',kind:'tree',footprint:{x:112,y:235,width:35,height:21},blocksMovement:true,stateRef:'/private'}]}
  const projected=safeMapPoint(hit,pixel)
  assert.deepEqual(projected.objects[0],{id:'tree-1',kind:'tree',blocksMovement:true,footprint:hit.objects[0].footprint})
  assert(!JSON.stringify(projected).includes('private'));assert.throws(()=>safeMapPoint(hit,{x:0,y:0}),{status:503})
  hit.objects[0].footprint={};assert.throws(()=>safeMapPoint(hit,pixel),{status:503})
})

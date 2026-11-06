import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {parseDevelopmentQuery as query,readDevelopmentReview as read} from '../../src/server/local-backup/native-stage0-development-review.mjs'

test('review endpoint accepts only a registered epoch or a receipt-bound index in the eight fixed images',()=>{
  const token='a'.repeat(64),url='http://localhost:3000/api/local-backup/native-stage0-review?'
  assert.deepEqual(query(url+'epoch=12'),{epoch:12});assert.deepEqual(query(url+'epoch=24&role=prediction&index=7&token='+token),{epoch:24,role:'prediction',index:7,token})
  for(const value of ['epoch=8','epoch=12&epoch=24','epoch=12&path=file.png','epoch=12&role=challenge&index=1&token='+token,'epoch=12&role=source&index=8&token='+token,'epoch=12&role=source&index=1','epoch=12&role=source&index=&token='+token]){
    assert.throws(()=>query(url+value),e=>e.status===400)
  }
})
test('all published epoch12 rows match immutable fixed source and prediction hashes',t=>{
  const dir='.runtime/ai-painter/native-stage0-formal-training/stage0-native-256-formal-229/review'
  if(!fs.existsSync(dir+'/receipt-12.json'))return t.skip('epoch12 is not sealed on this installation')
  const review=JSON.parse(fs.readFileSync(dir+'/epoch-12.json')),s=read({epoch:12})
  assert.equal(s.rows.length,8);assert.equal(s.status,'observation_only')
  for(const [index,row] of review.rows.entries()){
    for(const role of ['prediction','source']){
      const {bytes}=read({epoch:12,index,role,token:s.token})
      assert.equal(createHash('sha256').update(bytes).digest('hex'),(role==='source'?row.sourceImage:row.prediction).sha256)
    }
  }
  assert.throws(()=>read({epoch:12,index:1,role:'prediction',token:'0'.repeat(64)}),e=>e.status===409)
})

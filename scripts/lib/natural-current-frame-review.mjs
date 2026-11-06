import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
import {auditAiAssistedConditionAlignment} from './ai-assisted-condition-alignment.mjs'
import {classifyRgb, RULES} from './natural-object-discrimination.mjs'
import {extractStyleFeatures,auditStyleFeatures,fingerprintLatestPath} from './ai-assisted-style-fingerprint.mjs'
import {auditAiAssistedProfessionalAesthetic} from './ai-assisted-professional-aesthetic.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const auditBase='.runtime/ai-painter/controller-repair-reviews/current-natural-game-frame-232-20261103/audit/evaluated'
const discrEvidence='.runtime/ai-painter/controller-repair-reviews/natural-object-discrimination-208-20261103/delivery.json'
const sourceEvidence='.runtime/ai-painter/controller-repair-reviews/game-map-object-source-review-223-20261103/delivery.json'
const programFiles=['scripts/lib/natural-current-frame-review.mjs','scripts/lib/ai-assisted-condition-alignment.mjs','scripts/lib/natural-object-discrimination.mjs',
  'scripts/lib/ai-assisted-style-fingerprint.mjs','scripts/lib/ai-assisted-professional-aesthetic.mjs']
const sha=value=>crypto.createHash('sha256').update(value).digest('hex')
const hex=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s)
const persisted=v=>Buffer.from(JSON.stringify(v,null,2)+'\n')
const absolute=p=>{const full=path.resolve(root,p);assert(full.startsWith(root+path.sep));return full}
function ref(p){const b=fs.readFileSync(absolute(p));return {path:p,sha256:sha(b),bytes:b.length}}
function checked(binding){
  assert(hex(binding.sha256));const p=absolute(binding.path),s=fs.statSync(p);assert(s.isFile()&&s.size>0&&s.size<=32*1024**2)
  const b=fs.readFileSync(p);assert.equal(sha(b),binding.sha256);if(binding.bytes!=null)assert.equal(b.length,binding.bytes);return b
}
function immutable(name,bytes){
  const p=absolute(name);fs.mkdirSync(path.dirname(p),{recursive:true})
  if(fs.existsSync(p)){assert(fs.readFileSync(p).equals(bytes));return ref(name)}
  const temp=p+'.'+crypto.randomUUID()+'.pending'
  fs.writeFileSync(temp,bytes,{flag:'wx',flush:true})
  try{fs.linkSync(temp,p)}catch(e){if(e.code!=='EEXIST'||!fs.readFileSync(p).equals(bytes))throw e}
  finally{fs.unlinkSync(temp)}
  return ref(name)
}
function pipeline(){
  const pointer=ref(fingerprintLatestPath()),calibration=ref(JSON.parse(checked(pointer)).fingerprintPath)
  return {programs:programFiles.map(ref),pointer,calibration}
}
function prefix(token,identity){assert(hex(token));return auditBase+'/'+token+'/'+sha(persisted(identity))}
const gate=(id,status,summary,measurements,issues=[],repair=null)=>({id,status,summary,measurements,issues,repair})
function gateForChannel(audit,id,positive,negative,repair){
  assert.equal(audit.channelId,id)
  return gate(id,audit.passed?'passed':'failed',audit.passed?positive:negative,audit,audit.issues??[],audit.passed?null:repair)
}
export function describeMorphology(figures){
  const groups={}
  for(const o of figures){
    const row=groups[o.kind]??={total:0,predictionCounts:{}}
    row.total++;row.predictionCounts[o.prediction]=(row.predictionCounts[o.prediction]??0)+1
  }
  return groups
}
async function objectReadback(imageBytes,records){
  const {data,info}=await sharp(imageBytes,{failOn:'error'}).removeAlpha().raw().toBuffer({resolveWithObject:true})
  assert(info.channels===3&&info.width===1024&&info.height===768)
  const figures=[];const ids=new Set()
  for(const o of records){
    assert(!ids.has(o.objectId));ids.add(o.objectId)
    const {x,y,width,height}=o.footprint
    assert([x,y,width,height].every(Number.isInteger)&&x>=0&&y>=0&&width>0&&height>0&&x+width<=info.width&&y+height<=info.height)
    // The registered geometry selects the window. Only native RGB bytes are given to the blind diagnostic.
    const side=Math.min(Math.max(Math.max(width,height)+48,72),192)
    const left=Math.min(Math.max(x+Math.floor(width/2)-Math.floor(side/2),0),info.width-side)
    const top=Math.min(Math.max(y+Math.floor(height/2)-Math.floor(side/2),0),info.height-side)
    const native=Buffer.alloc(side*side*3)
    for(let i=0;i<side;i++){const offset=3*((top+i)*info.width+left);data.copy(native,3*i*side,offset,offset+3*side)}
    const result=classifyRgb(native,side,side)
    figures.push({objectId:o.objectId,kind:o.kind,footprint:o.footprint,window:{left,top,width:side,height:side},rgbSha256:sha(native),
      prediction:result.prediction,reason:result.reason})
  }
  return {rule:RULES.version,windowProtocol:'中心取自登记占地；原生RGB裁窗边长 max(72,占地最长边+48)，上限192；不画框、不缩放。',groups:describeMorphology(figures),figures}
}
export async function evaluateNaturalFrameAudit(view){
  const identity=pipeline(),out=prefix(view.token,identity);await view.assertCurrent()
  const src=view.sources;const descriptor=JSON.parse(checked(src.descriptor))
  const sources={descriptor:src.descriptor,store:src.store,image:src.image,candidate:src.candidate}
  const store=JSON.parse(checked(src.store));checked(src.candidate)
  const img=await view.readImage();const image=checked(src.image);assert(Buffer.from(img).equals(image))
  assert(view.image.sha256===src.image.sha256&&view.image.width===1024&&view.image.height===768)
  assert.equal(store.tick,descriptor.tick);assert.equal(store.stateVersion,descriptor.stateVersion);assert.equal(store.eventCursor,descriptor.eventCursor)
  const worldId=descriptor.identity.worldId;assert.equal(worldId,'mvp-natural-world-001')
  const tensor=descriptor.channels;assert(tensor.length===23&&new Set(tensor.map(c=>c.id)).size===23)
  const channels=[]
  for(const ch of tensor){
    const bytes=checked(ch),{data,info}=await sharp(bytes,{failOn:'error'}).greyscale().raw().toBuffer({resolveWithObject:true})
    assert(info.width===1024&&info.height===768&&info.channels===1);assert.equal(sha(data),ch.pixelSha256)
    let nonZeroCount=0;for(const v of data)if(v!==0)nonZeroCount++
    channels.push({id:ch.id,path:ch.path,sha256:ch.sha256,pixelSha256:ch.pixelSha256,statistics:{nonZeroCount,nonZeroRatio:nonZeroCount/data.length}})
  }
  const binding=immutable(out+'/condition-adapter.json',persisted({schemaVersion:'current-world-native-channel-auditor-projection-v1',
    conditionPackId:'current-'+src.descriptor.sha256,worldId,tick:descriptor.tick,canvas:{width:1024,height:768},channels,
    originalDescriptor:src.descriptor}))
  const record={conditionBinding:{conditionPackPath:binding.path,worldId,tick:descriptor.tick},classification:{
    monsoonSeason:descriptor.renderInputs.season.season,regionalLandscapeType:descriptor.renderInputs.regionalLandscapeType}}
  assert(['dry_season','wet_season','transition_season'].includes(record.classification.monsoonSeason))
  const machine=await auditAiAssistedConditionAlignment({record,imagePath:src.image.path})
  const audit=immutable(out+'/condition-response.json',persisted(machine))
  const byId=Object.fromEntries(machine.channelAudits.map(a=>[a.channelId,a]))
  const waterCount=channels.find(c=>c.id==='terrain_water').statistics.nonZeroCount
  const gates=[
    gate('native_binding','passed','已重算同一世界状态、候选图和全部23路原生输入像素。',{channels:23,worldId,tick:descriptor.tick,shape:[1024,768],source:binding}),
    gateForChannel(byId.terrain_path_ground,'terrain_path_ground','画面道路信号通过原有条件对齐门。','画面道路信号未通过原有位置、覆盖或边界要求。','将同图道路掩码、预测RGB和边界误差交给道路对应审核；按原阈值复审。'),
    gateForChannel(byId.terrain_water,'terrain_water',waterCount===0?'本区水体掩码为零；画面通过原有无水误绘检查。':'水色信号通过当前水体条件检查。',
      waterCount===0?'本区水体掩码为零；画面中的水色信号超过允许误绘比例。':'水色信号与登记水体不符。','对照当前水体掩码定位候选画面误绘或遗漏的区域。'),
    gate('water_connectivity',waterCount===0?'not_applicable':'not_qualified',waterCount===0?'当前事实没有水体，水道连通、岸线和进出口无适用对象。':'水道连通按当前世界图另验。',{waterPixels:waterCount,originalOutcome:machine.hydrologyConnectivityAudit})]
  for(const a of machine.objectSemanticAudits){
    gates.push(gate(a.channelId+'_local_response',a.passed?'passed':'failed',
      a.passed?'本条件区域的颜色或边缘响应达到原局部对比门。':'本条件区域的颜色和边缘响应未达到原局部对比门。',
      a,a.issues??[],a.passed?null:'核对实际输入核心／支撑区域与候选对象边缘，再按同图同门复审。'))
  }
  const features=await extractStyleFeatures(absolute(src.image.path))
  assert.equal(features.imageSha256,src.image.sha256)
  const fingerprint=JSON.parse(checked(identity.calibration))
  const style=auditStyleFeatures(features,fingerprint)
  const aesthetic=await auditAiAssistedProfessionalAesthetic(absolute(src.image.path))
  assert.deepEqual(pipeline(),identity)
  gates.push(gate('style_fingerprint',style.passed?'passed':'failed',style.passed?'整图风格特征落在项目已认可样图的范围。':'整图风格特征未满足项目已有样图指纹门。',
    {metrics:style.metrics,calibration:identity.calibration},style.issues,style.passed?null:'根据已有风格指纹的偏离项目对照自然图候选，再以同一指纹复审。'))
  gates.push(gate('professional_aesthetic',aesthetic.passed?'passed':'failed',aesthetic.passed?'多尺度纹理、安静区和层次通过项目原有审美检查。':'整图的纹理、安静区或层次未达到原有审美指标。',
    aesthetic,aesthetic.issues,aesthetic.passed?null:'针对实际未通过的多尺度纹理或区域层次项复核，保留原阈值。'))
  gates.push(gate('paired_reference_fidelity','not_applicable','当前自主世界没有逐像素配对原图，训练图专用的参考边缘／亮度保真门无适用输入。',
    {registeredTrainComparison:'auditMvp256DetailSufficiency requires a paired original and a registered 256×192 measurement contract',
     exactSceneReference:null,sourceArtReplaced:false}))
  const morphology=await objectReadback(image,descriptor.objectInstanceTable)
  const morphologyRef=immutable(out+'/object-readback.json',persisted(morphology))
  const classifier=ref(discrEvidence),registered=ref(sourceEvidence)
  assert.equal(JSON.parse(checked(classifier)).status,'actual_rgb_competing_class_probe_failed_real_world_qualification')
  const denied=JSON.parse(checked(registered)).verdict;assert(denied.startsWith('no_new_registered_independent_game_object_visible_extent_cohort'))
  gates.push(gate('object_recognizability','not_qualified',
    '已逐登记对象运行盲RGB形态诊断。树、灌木、草和石头的可辨识资格尚未取得。',
    {objects:morphology.figures.length,groups:morphology.groups,readback:morphologyRef,diagnosticQualification:classifier,independentExtentCohort:registered,
     noReferenceMaskedCorrelation:true},
    ['裁窗由占地定位，可见树冠与占地不等同。','形态规则只输出石头、植被、空或弃判；既有独立资格未通过。'],
    '补独立的游戏风格可见范围与负例，先验证类别审核器，再对同一候选的逐对象结果裁决。'))
  gates.push(gate('formal_visual_judge','not_qualified','当前模型权重与这张候选图尚无可供发布的正式视觉审核记录。',
    {trainingReferenceForThisExactWorld:false,legacyCompositorEvidenceUsed:false,formallyReleased:false},
    ['原合成器的材质放置、分层精灵或冻结配对训练原图不能替代本次原生RGB输出的视觉证据。'],
    '沿同模型资格、适用于原生画面的正式审核、同世界能力登记和帧发布流程分别验收。'))
  await view.assertCurrent()
  const report={schema:'natural-current-frame-review-v1',token:view.token,status:gates.some(g=>g.status==='failed')?'failed':'not_qualified',
    releaseEligible:false,worldId,tick:descriptor.tick,stateVersion:descriptor.stateVersion,eventCursor:descriptor.eventCursor,sources,
    ...identity,originalConditionAudit:audit,channelAdapter:binding,morphology:morphologyRef,reportPath:out+'/report.json',gates}
  const stored=immutable(report.reportPath,persisted(report))
  immutable(out+'/seal.json',persisted({schema:'current-natural-frame-audit-seal-v1',token:view.token,report:stored,image:src.image,descriptor:src.descriptor}))
  return report
}
export function readNaturalFrameAudit(view){
  const identity=pipeline(),out=prefix(view.token,identity),sealPath=out+'/seal.json'
  if(!fs.existsSync(absolute(sealPath)))return null
  const seal=JSON.parse(fs.readFileSync(absolute(sealPath)));assert.equal(seal.schema,'current-natural-frame-audit-seal-v1');assert.equal(seal.token,view.token)
  assert.equal(seal.report.path,out+'/report.json');assert.equal(seal.image.sha256,view.sources.image.sha256);assert.equal(seal.descriptor.sha256,view.sources.descriptor.sha256)
  const doc=JSON.parse(checked(seal.report));assert.equal(doc.schema,'natural-current-frame-review-v1');assert.equal(doc.token,view.token)
  assert.equal(doc.releaseEligible,false)
  for(const k of ['store','image','descriptor','candidate'])assert.equal(doc.sources[k].sha256,view.sources[k].sha256)
  assert.deepEqual(doc.programs,identity.programs);assert.deepEqual(doc.calibration,identity.calibration)
  for(const [key,name] of Object.entries({originalConditionAudit:'condition-response.json',channelAdapter:'condition-adapter.json',morphology:'object-readback.json'})){
    assert.equal(doc[key].path,out+'/'+name);checked(doc[key])
  }
  return doc
}

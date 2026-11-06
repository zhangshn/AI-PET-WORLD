import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import * as jsx from 'react/jsx-runtime'
import * as React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {NextRequest,NextResponse} from 'next/server.js'
import {requiresNaturalWorldPlayerGrant} from '../../src/world/runtime/natural-world-client-access.ts'

const file = 'src/app/world/world-live-runtime-page.tsx'
test('authorized natural image reads distinguish a missing publication from a broken record or an unreadable store',async()=>{
  const worldId='mvp-natural-world-001',ownerId='test-owner',playerId='test-player'
  const source=fs.readFileSync('src/world/runtime/natural-player-view.ts','utf8')
  const built=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}})
  const request=new Request('http://localhost/api/world/game-map-runtime-frame/image?worldId='+worldId)
  for(const [status,warnings,http,reason] of [
    ['empty',[],404,'natural_frame_unpublished'],
    ['failed',['game_map_runtime_frame_read_failed:EIO'],503,'natural_frame_read_unavailable'],
    ['invalid',['game_map_runtime_frame_transaction_incomplete'],409,'natural_frame_record_conflict'],
    ['invalid',['legacy_runtime_frame_missing_natural_world_authority'],409,'natural_frame_unqualified'],
    ['found',[],409,'natural_frame_unqualified'],
  ]){
    const api={},modules={
      'node:path':await import('node:path'),
      'next/server':{NextResponse},
      '@/server/world-player-access/session.mjs':{authorizeWorldPlayerRead:async()=>({ok:true,ownerId,playerId,worldId,permission:'world.read'})},
      './world-runtime-production-store':{createProductionWorldRuntimeStore:()=>({
        readNatural:async()=>({status:'found',record:{worldId,tick:30,worldState:{payload:{}}}}),
        readNaturalTransition:()=>assert.fail('unexpected history read'),
      })},
      '@/world/game-map-frame':{readLatestGameMapRuntimeFrameRecord:async query=>{
        assert.deepEqual(query,{worldId,ownerId,currentTick:30})
        return {status,warnings,path:'sensitive-private-path'}
      }},
      './natural-player-history':{},
    }
    new Function('require','exports',built.outputText)(k=>modules[k],api)
    const reply=await api.readNaturalPlayerFrameResponse(request,worldId)
    assert.equal(reply.status,http)
    assert.equal(reply.headers.get('Cache-Control'),'private, no-store')
    assert.deepEqual(await reply.json(),{ok:false,status:reason})
  }
})
test('before hydration all session forms use POST and cannot submit credentials in the page URL',()=>{
  const source=fs.readFileSync('src/app/world/natural-world-session-form.tsx','utf8')
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
    jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
  const exports={}
  const deps={'react':React,'next/navigation':{useRouter:()=>({})},'react/jsx-runtime':jsx,'./natural-world-player.module.css':{default:{}}}
  new Function('require','exports',code)(k=>deps[k],exports)
  for(const signedIn of [false,true]){
    const html=renderToStaticMarkup(jsx.jsx(exports.NaturalWorldSessionForm,{signedIn}))
    assert.match(html,/<form[^>]+method="post"/)
    assert.match(html,/<form[^>]+action="\/api\/world\/player-session"/)
    assert.match(html,/<button[^>]*type="submit"[^>]*disabled/)
  }
})
const built = ts.transpileModule(fs.readFileSync(file,'utf8'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX},
  reportDiagnostics:true,
})
assert.deepEqual(built.diagnostics,[])

function entry({readWorld, readFrame, facts}={}) {
  const unexpected = () => assert.fail('unexpected dependency invocation')
  const modules = {
    './natural-world-player-page':{NaturalWorldPlayerPage:({worldId})=>{
      assert(requiresNaturalWorldPlayerGrant(worldId))
      return jsx.jsx('h1',{children:'登录自然首区'})
    }},
    '@/world/runtime/natural-world-client-access':{requiresNaturalWorldPlayerGrant},
    'react/jsx-runtime':jsx,
    '@/world/runtime/world-runtime-gateway':{readWorldRuntimeForView:readWorld ?? unexpected},
    '@/world/game-map-frame':{readLatestGameMapRuntimeFrameRecord:readFrame ?? unexpected},
    '@/world/world-visual-painter':{buildWorldVisualFactManifest:facts ?? unexpected},
    './world-runtime-surface':{WorldRuntimeSurface:unexpected},
  }
  const exports={}
  new Function('require','exports',built.outputText)(id=>{
    assert(Object.hasOwn(modules,id),id)
    return modules[id]
  },exports)
  return async input=>renderToStaticMarkup(await exports.WorldLiveRuntimePage(input))
}

for (const route of ['world','ai-painter']) {
  test(route+' image route denies reserved or ambiguous world identity before frame lookup',async()=>{
    const filename='src/app/api/'+route+'/game-map-runtime-frame/image/route.ts'
    const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{
      target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
    }})
    let calls=0
    const exports={}
    const modules={
      'next/server':{NextResponse},
      '@/world/runtime/natural-world-client-access':{requiresNaturalWorldPlayerGrant},
      '@/world/runtime/natural-player-view':{readNaturalPlayerFrameResponse:async(request,worldId)=>{
        assert.equal(new URL(request.url).searchParams.get('worldId'),worldId)
        return NextResponse.json({ok:false,status:'player_login_required'},{status:401,headers:{'Cache-Control':'private, no-store'}})
      }},
      '@/world/game-map-frame':{readLatestGameMapRuntimeFrameRecord:async()=>{calls++;return {status:'empty'}}},
    }
    new Function('require','exports',compiled.outputText)(key=>modules[key]??{},exports)
    const request=query=>new NextRequest('http://localhost/api/'+route+'/game-map-runtime-frame/image?'+query)
    for(const id of ['mvp-natural-world-001','MVP-NATURAL-WORLD-001']){
      const reply=await exports.GET(request('worldId='+id+'&ownerId=owner&playerId=player'))
      assert.equal(reply.status,401)
      assert.match(reply.headers.get('Cache-Control'),/no-store/)
    }
    assert.equal((await exports.GET(request('worldId=legacy&worldId=mvp-natural-world-001'))).status,400)
    assert.equal(calls,0)
    assert.equal((await exports.GET(request('worldId=legacy'))).status,404)
    assert.equal(calls,1)
  })
}

test('formal natural namespace requires trusted player access before any store or frame lookup',async()=>{
  for(const worldId of ['mvp-natural-world-001','MVP-NATURAL-WORLD-001']){
    const html=await entry()({worldId,ownerId:'mvp-natural-owner-001',playerId:'mvp-natural-player-001'})
    assert.match(html,/登录自然首区/)
    assert.doesNotMatch(html,/<img|href="\/create-world"|mvp-natural-owner|Tick|mvp-natural-world-001/i)
  }
})

test('missing or repeated worldId never reaches the store',async()=>{
  for(const worldId of [undefined,'',['mvp-natural-world-001','other']]){
    assert.match(await entry()({worldId}),/需要指定世界/)
  }
})

test('legacy invalid or failed reads never offer replacement creation, while a truly empty result can',async()=>{
  for(const status of ['empty','invalid','failed']){
    const html=await entry({readWorld:async input=>{
      assert.deepEqual(input,{worldId:'existing-legacy-world'})
      return {isPersisted:false,readResult:{status}}
    }})({worldId:'existing-legacy-world'})
    if(status==='empty')assert.match(html,/href="\/create-world"/)
    else {assert.match(html,/世界存档暂时无法读取/);assert.doesNotMatch(html,/href="\/create-world"/)}
  }
})

test('an existing legacy world without a published frame still has no game picture',async()=>{
  const stored={ownerId:'fixture-owner',worldId:'fixture-world',tick:3}
  const html=await entry({
    readWorld:()=>({isPersisted:true,saveRecord:stored}),
    facts:()=>({sourceFactIds:['fixture-fact']}),
    readFrame:input=>{
      assert.deepEqual(input,{ownerId:stored.ownerId,worldId:stored.worldId,currentTick:3,currentSourceFactIds:['fixture-fact']})
      return {status:'empty',record:null,path:'fixture',warnings:[]}
    },
  })({worldId:stored.worldId})
  assert.match(html,/游戏 RuntimeFrame 尚未就绪/);assert.doesNotMatch(html,/<img/)
})

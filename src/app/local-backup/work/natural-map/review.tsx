'use client'
import {useEffect,useRef,useState} from 'react'
import {NaturalMapInspector} from '@/world/game-map-frame/natural-map-inspector'
import type {MapPixel} from '@/world/game-map-frame/natural-map-inspector'
import styles from './review.module.css'
type Frame={token:string;scope:'local_candidate_review';worldId:string;tick:number;stateVersion:number;eventCursor:number;width:number;height:number;imageSha256:string;
 audit:null|{status:string;gates:{id:string;status:string;summary:string;repair:string|null;styleDistance?:{actual:number;maximum:number}}[]}}
type Hit={token:string;pixel:MapPixel;movement:string;onPathGround:boolean;terrain:{kind:string;sourceId:string}[];walkableRegionIds:string[];collisionRegionIds:string[];
 objects:{id:string;kind:string;blocksMovement:boolean;footprint:{x:number;y:number;width:number;height:number}}[]}
const words:Record<string,string>={grass:'草地',path_ground:'自然路径',water:'水体',shoreline:'岸线',tall_grass:'高草',mud_patch:'泥地',natural_boundary:'自然边界',tree:'树木',rock:'石块',vegetation:'植被',
 walkable_here:'已登记可通行',blocked_by_collision:'有碰撞阻挡',outside_walkable_region:'未登记为可通行'}
const endpoint='/api/local-backup/natural-map-review'
const verdict:Record<string,string>={passed:'通过',failed:'未通过',not_qualified:'未取得资格',not_applicable:'本区不适用',unavailable:'记录无法核验'}
async function read<T>(url:string,signal:AbortSignal):Promise<T>{
 const r=await fetch(url,{cache:'no-store',credentials:'same-origin',signal})
 if(!r.ok)throw Error(r.status===409?'stale':r.status===403?'forbidden':r.status===404?'missing':'unavailable')
 const v=await r.json();if(v.ok!==true||!v.data)throw Error('unavailable')
 return v.data
}
export function NaturalMapReview(){
 const [version,reload]=useState(0),[frame,setFrame]=useState<Frame|null>(null),[hit,setHit]=useState<Hit|null>(null)
 const [selected,setSelected]=useState<MapPixel|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const pending=useRef<AbortController|null>(null)
 useEffect(()=>{
  const c=new AbortController()
  read<Frame>(endpoint,c.signal).then(v=>{if(!c.signal.aborted)setFrame(v)}).catch(e=>{if(!c.signal.aborted)setError(e.message)})
  return ()=>{c.abort();pending.current?.abort()}
 },[version])
 function reloadCurrent(){
  pending.current?.abort();setFrame(null);setError('');setHit(null);setSelected(null);setBusy(false);reload(n=>n+1)
 }
 async function inspect(p:MapPixel){
  if(!frame)return;pending.current?.abort();const c=new AbortController();pending.current=c
  setSelected(p);setHit(null);setBusy(true);setError('')
  try{
   const v=await read<Hit>(endpoint+'?'+new URLSearchParams({token:frame.token,x:String(p.x),y:String(p.y)}),c.signal)
   if(v.token!==frame.token||v.pixel.x!==p.x||v.pixel.y!==p.y)throw Error('stale')
   if(!c.signal.aborted)setHit(v)
  }catch(e){if(!c.signal.aborted){setError(e instanceof Error?e.message:'unavailable');setFrame(null);setSelected(null)}}
  finally{if(!c.signal.aborted)setBusy(false)}
 }
 if(error)return <div role="alert"><p>{error==='stale'?'所选画面对应的世界快照已更新。请重新读取当期候选。':error==='forbidden'?'此审核仅允许本机工作台访问。':error==='missing'?'当前存档尚无对应的候选图。':'当期候选或其世界记录目前无法核验。'}</p><button onClick={reloadCurrent}>重新读取当期候选</button></div>
 if(!frame)return <p role="status">正在读取当期存档和候选图…</p>
 return <section className={styles.workspace} aria-label="当期地图审核">
  <div className={styles.meta}><strong>未发布候选</strong><span>世界第 {frame.tick} 步</span><span>状态版本 {frame.stateVersion}</span><span>事件游标 {frame.eventCursor}</span><span>原图 {frame.width} × {frame.height}</span></div>
  <NaturalMapInspector key={frame.token} width={frame.width} height={frame.height} imageLabel="当前存档的本地模型自然地图候选" imageUrl={endpoint+'?image=1&token='+frame.token}
   selected={selected} onInspect={inspect} onImageError={()=>{pending.current?.abort();setHit(null);setFrame(null);setError('unavailable')}}/>
  <div className={styles.result} aria-live="polite" aria-label="所选位置的世界记录">
   <h2>{selected?'原图坐标 ('+selected.x+', '+selected.y+')':'所选位置'}</h2>
   {busy?<p>正在读取这个位置的世界记录…</p>:!hit?<p>点击图中位置，或输入原图坐标。</p>:<>
    <dl><dt>地形</dt><dd>{hit.terrain.map(t=>words[t.kind]??t.kind).join('、')||'没有命中地形区域'}</dd>
     <dt>通行状态</dt><dd>{words[hit.movement]??hit.movement}</dd><dt>对象</dt><dd>{hit.objects.length?hit.objects.map(o=><div key={o.id}>
       <strong>{words[o.kind]??o.kind}</strong> · {o.blocksMovement?'阻挡移动':'不阻挡移动'} · 占地 {o.footprint.width} × {o.footprint.height} 像素<br/><code>{o.id}</code></div>):'此像素未命中已登记对象'}</dd></dl>
    <details><summary>地形、通行与碰撞的来源记录</summary><p>地形 {hit.terrain.map(t=>t.sourceId).join('、')||'无'}</p>
     <p>通行区域 {hit.walkableRegionIds.join('、')||'无'}</p><p>碰撞区域 {hit.collisionRegionIds.join('、')||'无'}</p></details>
   </>}
  </div><details className={styles.source}><summary>本图机器审核 · {frame.audit?(verdict[frame.audit.status]??'未知状态'):'尚无报告'}</summary>
   {frame.audit?.gates.map(g=><p key={g.id}><b>{verdict[g.status]}</b> · {g.summary}{g.styleDistance&&<> 距离 {g.styleDistance.actual}，校准上限 {g.styleDistance.maximum}。</>}{g.repair&&<><br/>{g.repair}</>}</p>)}
  </details><details className={styles.source}><summary>查看画面身份</summary><p>世界 {frame.worldId}</p><p>帧标识 {frame.token}</p><p>PNG 字节 SHA-256 {frame.imageSha256}</p></details>
 </section>
}

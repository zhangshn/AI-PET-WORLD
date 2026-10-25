'use client'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './diagram-canvas.module.css'

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
export function DiagramCanvas({children,title}:{children:ReactNode;title:string}){
 const viewport=useRef<HTMLDivElement>(null),surface=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),fullscreenButton=useRef<HTMLButtonElement>(null),drag=useRef<{x:number;y:number;panX:number;panY:number}|null>(null)
 const [scale,setScale]=useState(1),[pan,setPan]=useState({x:0,y:0}),[expanded,setExpanded]=useState(false),[mode,setMode]=useState<'fit'|'manual'>('fit')
 const fit=useCallback(()=>{const box=viewport.current,content=surface.current;if(!box||!content||!content.scrollWidth||!content.scrollHeight)return;setScale(clamp(Math.min((box.clientWidth-40)/content.scrollWidth,(box.clientHeight-40)/content.scrollHeight,1),0.05,4));setPan({x:0,y:0})},[])
 useEffect(()=>{if(mode!=='fit')return;const observer=new ResizeObserver(fit);if(viewport.current)observer.observe(viewport.current);if(surface.current)observer.observe(surface.current);fit();return()=>observer.disconnect()},[mode,fit])
 useEffect(()=>{if(expanded)fullscreenButton.current?.focus()},[expanded])
 const zoom=(delta:number)=>{setMode('manual');setScale(s=>clamp(s+delta,0.05,4))}
 const reset=()=>{setMode('manual');setScale(1);setPan({x:0,y:0})}
 const move=(x:number,y:number)=>{setMode('manual');setPan(p=>({x:clamp(p.x+x,-20000,20000),y:clamp(p.y+y,-20000,20000)}))}
 function exit(){setExpanded(false);fullscreenButton.current?.focus()}
 const viewStyle={'--diagram-scale':scale,'--diagram-pan-x':pan.x+'px','--diagram-pan-y':pan.y+'px'} as CSSProperties
 return <div className={styles.holder}><div ref={shell} className={expanded?styles.fullscreen:styles.shell} role={expanded?'dialog':undefined} aria-modal={expanded?true:undefined} aria-label={expanded?title+'：全屏图形查看':undefined} onKeyDown={e=>{
  if(e.key==='Escape'&&expanded){e.preventDefault();exit()}
  if(e.key==='Tab'&&expanded){const elements=shell.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]');if(!elements?.length)return;const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
 }}>
  <div className={styles.title}><strong>{title}</strong><span>规范职责图源 · 不表示实现完成</span></div>
  <div className={styles.controls} aria-label="图形查看工具"><div><button onClick={()=>zoom(-0.25)} disabled={scale<=0.05} aria-label="缩小设计图">−</button><output aria-label="当前缩放比例">{Math.round(scale*100)}%</output><button onClick={()=>zoom(0.25)} disabled={scale>=4} aria-label="放大设计图">＋</button></div><div><button onClick={()=>{setMode('fit');fit()}}>适配</button><button onClick={reset}>还原 100%</button><button ref={fullscreenButton} onClick={()=>expanded?exit():setExpanded(true)}>{expanded?'退出全屏':'全屏查看'}</button></div></div>
  <div ref={viewport} tabIndex={0} className={styles.viewport} role="region" aria-label={title+'：可缩放和平移画布'} onKeyDown={e=>{const delta:Record<string,[number,number]>={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};if(delta[e.key]){e.preventDefault();move(...delta[e.key])}else if(e.key==='+'||e.key==='='){e.preventDefault();zoom(0.25)}else if(e.key==='-'){e.preventDefault();zoom(-0.25)}else if(e.key==='0'){e.preventDefault();reset()}}}
   onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y};e.currentTarget.setPointerCapture(e.pointerId)}}
   onPointerMove={e=>{const start=drag.current;if(!start)return;setMode('manual');setPan({x:clamp(start.panX+e.clientX-start.x,-20000,20000),y:clamp(start.panY+e.clientY-start.y,-20000,20000)})}}
   onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>{drag.current=null}} onDragStart={e=>e.preventDefault()}>
   <div ref={surface} className={styles.surface} style={viewStyle}>{children}</div>
  </div><p className={styles.help}>拖动或聚焦画布后用方向键平移；＋/− 缩放，0 还原。全屏是本页视图，Esc 退出。</p>
 </div></div>
}

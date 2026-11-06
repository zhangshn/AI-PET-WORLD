'use client'
import {useRef,useState} from 'react'
import type {CSSProperties} from 'react'
import {nativePixelAt} from './natural-map-inspector-coordinates.mjs'
import styles from './natural-map-inspector.module.css'

export type MapPixel={x:number;y:number}
type Props={imageUrl:string;width:number;height:number;imageLabel:string;selected:MapPixel|null;onInspect:(p:MapPixel)=>void;onImageError:()=>void}
export function NaturalMapInspector({imageUrl,width,height,imageLabel,selected,onInspect,onImageError}:Props){
 const [zoom,setZoom]=useState(100),[loaded,markLoaded]=useState(false)
 const [x,setX]=useState(''),[y,setY]=useState('')
 const image=useRef<HTMLImageElement>(null)
 function choose(p:MapPixel){setX(String(p.x));setY(String(p.y));onInspect(p)}
 const valid=(s:string,n:number)=>/^(0|[1-9]\d*)$/.test(s)&&Number(s)<n
 return <section className={styles.inspector} aria-label="地图坐标检查">
  <div className={styles.toolbar}><span>点选地图查询该像素的世界记录。放大后可横向或纵向滚动。</span>
   <fieldset><legend>显示比例</legend>{[100,150,200].map(n=><button type="button" key={n} aria-pressed={zoom===n} onClick={()=>setZoom(n)}>{n===100?'适应宽度':n+'%'}</button>)}</fieldset>
  </div>
  <div className={styles.viewport}><div className={styles.canvas} style={{'--map-width':zoom+'%'} as CSSProperties}>
   {/* A native img provides one unmodified same-origin PNG and its exact displayed rectangle. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img ref={image} src={imageUrl} alt={imageLabel} width={width} height={height} draggable={false}
    onLoad={e=>{if(e.currentTarget.naturalWidth===width&&e.currentTarget.naturalHeight===height)markLoaded(true);else onImageError()}}
    onError={onImageError} onClick={e=>{if(!loaded)return
      const p=nativePixelAt(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect(),width,height);if(p)choose(p)}}/>
   {selected&&<span aria-hidden="true" className={styles.marker} style={{left:(selected.x+.5)/width*100+'%',top:(selected.y+.5)/height*100+'%'}}/>}
  </div></div>
  <form className={styles.coordinate} onSubmit={e=>{e.preventDefault();if(loaded&&valid(x,width)&&valid(y,height))choose({x:Number(x),y:Number(y)})}}>
   <label>X <input type="number" required min="0" max={width-1} step="1" aria-label="原图 X 坐标" value={x} onChange={e=>setX(e.target.value)}/></label>
   <label>Y <input type="number" required min="0" max={height-1} step="1" aria-label="原图 Y 坐标" value={y} onChange={e=>setY(e.target.value)}/></label>
   <button disabled={!loaded||!valid(x,width)||!valid(y,height)}>查询坐标</button><small>原点在左上，X 向右，Y 向下。</small>
  </form>
 </section>
}

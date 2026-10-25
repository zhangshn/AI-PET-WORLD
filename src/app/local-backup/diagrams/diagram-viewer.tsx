'use client'
import { useState } from 'react'
import Image from 'next/image'
import type { DiagramBody } from '../documents/document-types'
import { checkedSvgImage } from './svg-output'
import { DiagramCanvas } from './diagram-canvas'
import styles from './diagrams.module.css'

export function DiagramViewer({diagram}:{diagram:DiagramBody}){
 const [image,setImage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function render(){if(busy)return;setBusy(true);setError('');try{
  if(diagram.source.length>65536||/[<&\\]|%%|(?:^|\n)\s*(?:click|link|style|classDef|class |config|init)\b|https?:|javascript:|data:|file:|url\s*\(/i.test(diagram.source))throw Error('diagram_unsafe_source')
  const {default:mermaid}=await import('mermaid')
  mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'neutral',htmlLabels:false,maxTextSize:65536,maxEdges:256,flowchart:{htmlLabels:false,useMaxWidth:false},suppressErrorRendering:true})
  const result=await mermaid.render('registered-'+crypto.randomUUID().replaceAll('-',''),diagram.source)
  setImage(checkedSvgImage(result.svg))
 }catch(e){setError(e instanceof Error&&/^diagram_[a-z_]{1,80}$/.test(e.message)?e.message:'diagram_render_failed_or_unsafe_output')}finally{setBusy(false)}}
 return <><div className={styles.viewerToolbar}><span>{diagram.type==='mermaid'?'Mermaid · 本地严格渲染':'文本结构图 · 原格式'}</span>{diagram.type==='mermaid'&&<div><button onClick={render} disabled={busy}>{busy?'正在渲染…':image?'重新渲染':'渲染设计图'}</button></div>}</div>
 {error&&<p role="alert" className={styles.error}>设计图渲染失败：{error}。来源仍保留，未将源码展示计为绘图成功。</p>}
 {diagram.type==='text'?<DiagramCanvas title={diagram.title}><pre>{diagram.source}</pre></DiagramCanvas>:image?<DiagramCanvas title={diagram.title}>{/* Validated SVG stays in an inert image. View transforms never modify its bytes. */}
  <Image unoptimized width={1600} height={1000} src={image} alt={diagram.title+'，来自原文的已渲染设计图'}/></DiagramCanvas>:<div className={styles.emptyCanvas}><span>已有图源 · 尚未渲染</span><p>选择“渲染设计图”在本机绘制此图。</p></div>}
 <details className={styles.source}><summary>查看已有图源</summary><pre>{diagram.source}</pre></details></>
}

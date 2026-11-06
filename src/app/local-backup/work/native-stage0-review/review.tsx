'use client'
import {useEffect,useState} from 'react'
type Row={sample:string;rgbMae:number;baselineRgbMae:number;objects:Record<string,number|null>}
type Report={epoch:number;token:string;status:string;rows:Row[];summary:{rgbMae:number;baselineRgbMae:number;worstObject:number;baselineWorstObject:number}}
const api='/api/local-backup/native-stage0-review',labels:Record<string,string>={object_footprints:'对象占地',object_tree:'树',object_rock:'岩石',object_vegetation:'植被'}
export function DevelopmentGallery({epoch}:{epoch:number}){
  const [data,setData]=useState<Report|null>(null),[message,setMessage]=useState('正在读取固定审核收据。')
  useEffect(()=>{
    const ac=new AbortController()
    fetch(api+'?epoch='+epoch,{cache:'no-store',signal:ac.signal}).then(async r=>{
      if(!r.ok){if(r.status===404)throw Error('本轮固定审核收据尚未封存。');throw Error('当前无法核对本轮审核原件。')}
      const {data}=await r.json();if(!ac.signal.aborted)setData(data)
    }).catch(e=>{if(!ac.signal.aborted){setData(null);setMessage(e.message)}})
    return ()=>ac.abort()
  },[epoch])
  return <section>
    <h1>原生地图训练 · 第 {epoch} 轮固定验证</h1>
    <p>{epoch===12?'第 12 轮只观察。模型继续按已登记的数据、损失和时点训练。':'第 24 轮为唯一可选权重，模型资格还需独立重载和完整审核。'} 以下为开发验证地图。生成图尺寸为 256 × 192。</p>
    {data?.epoch===epoch&&<>
      <p>8 图平均 RGB 误差（越低越好）由历史基线 {data.summary.baselineRgbMae.toFixed(5)} 变为 {data.summary.rgbMae.toFixed(5)}。
        最弱对象区域亮度相关（越高越好）由 {data.summary.baselineWorstObject.toFixed(4)} 变为 {data.summary.worstObject.toFixed(4)}。</p>
      {epoch===24&&<p>{data.status==='stage0_quality_passed'?'固定画质审核通过。':'固定画质审核未通过。'}</p>}
    </>}
    {!data||data.epoch!==epoch?<p role="status">{message}</p>:data.rows.map((r,i)=><article key={r.sample} style={{borderTop:'1px solid #b0becc',padding:'1rem 0'}}>
      <h2 style={{overflowWrap:'anywhere'}}>{i+1}. {r.sample}</h2>
      <div style={{display:'flex',flexWrap:'wrap',gap:'1rem'}}>
        {(['source','prediction'] as const).map(role=>{
          const url=api+'?epoch='+epoch+'&role='+role+'&index='+i+'&token='+data.token,label=role==='source'?'来源原图':'本轮模型预测'
          return <figure key={role} style={{margin:0,width:256,maxWidth:'100%'}}>
            <figcaption>{label}</figcaption>
            {/* Local byte-verified, access-controlled PNGs must not pass through a public image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={url}><img src={url} alt={r.sample+' '+label} width={256} height={192} style={{display:'block',maxWidth:'100%',height:'auto'}}/></a>
          </figure>
        })}
      </div>
      <p>整图 RGB 平均绝对误差 {r.rgbMae.toFixed(4)}，历史基线 {r.baselineRgbMae.toFixed(4)}。对象区域亮度相关系数为 {Object.entries(r.objects).map(([k,v])=>labels[k]+' '+(v===null?'无可计算分数':v.toFixed(3))).join('，')}。</p>
    </article>)}
  </section>
}
